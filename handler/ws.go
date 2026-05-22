package handler

import (
	"fmt"
	"log"
	"io"
	"strconv"
	"time"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/dbmgr"
	"github.com/xf/wshell/sftpmgr"
	"github.com/xf/wshell/sshmgr"
	"github.com/xf/wshell/store"
	"golang.org/x/crypto/ssh"
	"golang.org/x/net/websocket"
)

type WSHandler struct {
	Store     *store.Store
	Pool      *sshmgr.Pool
	AESCipher *crypto.AESCipher
}

func (h *WSHandler) HandleSSH(conn *websocket.Conn) {
	connID, _ := strconv.ParseInt(conn.Request().PathValue("conn_id"), 10, 64)
	user := auth.GetUserWS(conn.Request())

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		sendErr(conn, "connection not found")
		return
	}

	// Reuse existing client from pool if alive
	var client *sshmgr.Client
	if existing, ok := h.Pool.Get(connID); ok && existing.IsAlive() {
		client = existing
	} else {
		if ok {
			h.Pool.Remove(connID)
		}

		var password, privateKey, passphrase string
		if connInfo.PasswordEncrypted != "" {
			password, _ = h.AESCipher.Decrypt(connInfo.PasswordEncrypted)
		}
		if connInfo.PrivateKeyEncrypted != "" {
			privateKey, _ = h.AESCipher.Decrypt(connInfo.PrivateKeyEncrypted)
		}
		if connInfo.PrivateKeyPassphraseEncrypted != "" {
			passphrase, _ = h.AESCipher.Decrypt(connInfo.PrivateKeyPassphraseEncrypted)
		}

		client, err = sshmgr.NewClient(connInfo.Host, connInfo.Port, connInfo.Username, password, privateKey, passphrase)
		if err != nil {
			sendErr(conn, "failed to create client: " + err.Error())
			return
		}
		var connectErr error
		for attempt := 1; attempt <= 3; attempt++ {
			connectErr = client.Connect()
			if connectErr == nil {
				break
			}
			if attempt < 3 {
				time.Sleep(time.Duration(attempt) * time.Second)
			}
		}
		if connectErr != nil {
			sendErr(conn, fmt.Sprintf("连接失败（已重试3次）: %s", connectErr.Error()))
			return
		}
		h.Pool.Set(connID, client)
	}

	defer h.Pool.Remove(connID)
	session, err := client.NewSession()
	if err != nil {
		sendErr(conn, "session failed: " + err.Error())
		return
	}
	defer session.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 80, 24, modes); err != nil {
		sendErr(conn, "pty failed: " + err.Error())
		return
	}

	stdinPipe, _ := session.StdinPipe()
	stdoutPipe, _ := session.StdoutPipe()
	stderrPipe, _ := session.StderrPipe()

	if err := session.Shell(); err != nil {
		sendErr(conn, "shell failed: " + err.Error())
		return
	}

	h.Store.CreateSessionLog(&store.SessionLog{
		UserID: user.UserID, ConnectionID: connID, Type: "ssh",
	})

	go func() {
		var msg struct {
			Data string `json:"data"`
		}
		for {
			if err := websocket.JSON.Receive(conn, &msg); err != nil {
				return
			}
				log.Printf("SSH stdin: %q", msg.Data)
			stdinPipe.Write([]byte(msg.Data))
		}
	}()

	// Heartbeat: send ping every 10s
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := websocket.JSON.Send(conn, map[string]string{"type": "ping"}); err != nil {
				return
			}
		}
	}()

	go io.Copy(&wsWriter{conn}, stdoutPipe)
	io.Copy(&wsWriter{conn}, stderrPipe)
}

func (h *WSHandler) HandleDB(conn *websocket.Conn) {
	connID, _ := strconv.ParseInt(conn.Request().PathValue("conn_id"), 10, 64)
	user := auth.GetUserWS(conn.Request())

	dbInfo, err := h.Store.GetDbConnection(connID)
	if err != nil {
		sendErr(conn, "db connection not found")
		return
	}

	password, _ := h.AESCipher.Decrypt(dbInfo.PasswordEncrypted)

	client, err := dbmgr.NewClient(dbInfo.Host, dbInfo.Port, dbInfo.Username, password, dbInfo.DatabaseName)
	if err != nil {
		sendErr(conn, "db connect failed: " + err.Error())
		return
	}
	defer client.Close()

	h.Store.CreateSessionLog(&store.SessionLog{
		UserID: user.UserID, ConnectionID: connID, Type: "db",
	})

	var msg struct {
		Action   string `json:"action"`
		Query    string `json:"query"`
		Database string `json:"database"`
		Table    string `json:"table"`
	}
	for {
		if err := websocket.JSON.Receive(conn, &msg); err != nil {
			return
		}
		switch msg.Action {
		case "query":
			result, err := client.Execute(msg.Query)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "query_result", "result": result})
			}
		case "databases":
			dbs, err := client.ListDatabases()
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "database_list", "databases": dbs})
			}
		case "tables":
			tables, err := client.ListTables(msg.Database)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "table_list", "database": msg.Database, "tables": tables})
			}
		case "describe":
			cols, err := client.DescribeTable(msg.Database, msg.Table)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "describe_result", "database": msg.Database, "table": msg.Table, "columns": cols})
			}
		default:
			websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": "unknown action"})
		}
	}
}

type wsWriter struct {
	conn *websocket.Conn
}

func (w *wsWriter) Write(p []byte) (int, error) {
	err := websocket.JSON.Send(w.conn, map[string]string{"data": string(p)})
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

func (h *WSHandler) HandleSFTP(conn *websocket.Conn) {
	connID, _ := strconv.ParseInt(conn.Request().PathValue("conn_id"), 10, 64)
	user := auth.GetUserWS(conn.Request())

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		sendErr(conn, "connection not found")
		return
	}

	// Get or create SSH client
	sshClient, ok := h.Pool.Get(connID)
	if !ok || !sshClient.IsAlive() {
		if ok {
			h.Pool.Remove(connID)
		}

		var password, privateKey, passphrase string
		if connInfo.PasswordEncrypted != "" {
			password, _ = h.AESCipher.Decrypt(connInfo.PasswordEncrypted)
		}
		if connInfo.PrivateKeyEncrypted != "" {
			privateKey, _ = h.AESCipher.Decrypt(connInfo.PrivateKeyEncrypted)
		}
		if connInfo.PrivateKeyPassphraseEncrypted != "" {
			passphrase, _ = h.AESCipher.Decrypt(connInfo.PrivateKeyPassphraseEncrypted)
		}

		sshClient, err = sshmgr.NewClient(connInfo.Host, connInfo.Port, connInfo.Username, password, privateKey, passphrase)
		if err != nil {
			sendErr(conn, "ssh client failed: " + err.Error())
			return
		}
		if err := sshClient.Connect(); err != nil {
			sendErr(conn, "ssh connect failed: " + err.Error())
			return
		}
		h.Pool.Set(connID, sshClient)
	}

	sftpClient, err := sftpmgr.NewClient(sshClient.RawConn())
	if err != nil {
		sendErr(conn, "sftp init failed: " + err.Error())
		return
	}
	defer sftpClient.Close()

	h.Store.CreateSessionLog(&store.SessionLog{
		UserID: user.UserID, ConnectionID: connID, Type: "sftp",
	})

	var msg struct {
		Action  string `json:"action"`
		Path    string `json:"path"`
		NewPath string `json:"new_path"`
		Content string `json:"content"`
	}
	for {
		if err := websocket.JSON.Receive(conn, &msg); err != nil {
			return
		}
		switch msg.Action {
		case "list":
			files, err := sftpClient.ListDir(msg.Path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "file_list", "path": msg.Path, "files": files})
			}
		case "read":
			data, err := sftpClient.ReadFile(msg.Path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "file_content", "path": msg.Path, "content": string(data)})
			}
		case "write":
			err := sftpClient.WriteFile(msg.Path, []byte(msg.Content))
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "write_done", "path": msg.Path})
			}
		case "delete":
			err := sftpClient.Delete(msg.Path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "delete_done", "path": msg.Path})
			}
		case "rename":
			err := sftpClient.Rename(msg.Path, msg.NewPath)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "rename_done", "path": msg.Path, "new_path": msg.NewPath})
			}
		case "mkdir":
			err := sftpClient.Mkdir(msg.Path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "mkdir_done", "path": msg.Path})
			}
		case "getwd":
			wd, err := sftpClient.Getwd()
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "pwd", "path": wd})
			}
		default:
			websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": "unknown action: " + msg.Action})
		}
	}
}

func sendErr(conn *websocket.Conn, msg string) {
	sendErr(conn, msg)
	time.Sleep(500 * time.Millisecond)
}
