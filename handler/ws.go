package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strconv"
	"time"

	"io.github.xufanchn.webterm/auth"
	"io.github.xufanchn.webterm/crypto"
	"io.github.xufanchn.webterm/dbmgr"
	"io.github.xufanchn.webterm/sftpmgr"
	"io.github.xufanchn.webterm/sshmgr"
	"io.github.xufanchn.webterm/store"
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
	if user == nil {
		sendErr(conn, "unauthorized")
		return
	}

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		sendErr(conn, "connection not found")
		return
	}

	// Reuse existing client from pool if alive
	var client *sshmgr.Client
	if existing, ok := h.Pool.Acquire(connID); ok {
		client = existing
	} else {
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
			sendErr(conn, "创建连接失败: "+friendlyErr(err))
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
			sendErr(conn, "连接失败: "+friendlyErr(connectErr))
			return
		}
		h.Pool.Add(connID, client)
	}

	defer h.Pool.Release(connID)

	// Check session limit (default 10, matching OpenSSH MaxSessions)
	if connInfo.MaxSessions > 0 {
		count := h.Pool.SessionCount(connID)
		if count > connInfo.MaxSessions {
			sendErr(conn, fmt.Sprintf("会话数已达上限(%d)，请关闭一些标签页后重试", connInfo.MaxSessions))
			return
		}
	}

	session, err := client.NewSession()
	if err != nil {
		sendErr(conn, "创建会话失败: "+friendlyErr(err))
		return
	}
	defer session.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          0, // start silent to inject PROMPT_COMMAND without visible echo
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 120, 40, modes); err != nil {
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

		
			// Configure shell to report PWD via OSC 7 for SFTP sync
			// ECHO is off in PTY modes, so this line is not echoed; stty echo re-enables it
			stdinPipe.Write([]byte("PROMPT_COMMAND='printf \"\\033]7;file://%s%s\\033\\\\\" \"$HOSTNAME\" \"$PWD\"'; stty echo\n"))

		h.Store.CreateSessionLog(&store.SessionLog{
			UserID: user.UserID, ConnectionID: connID, Type: "ssh",
	})

	go func() {
		for {
			var raw json.RawMessage
			if err := websocket.JSON.Receive(conn, &raw); err != nil {
				return
			}
			var resizeMsg struct {
				Cols int `json:"cols"`
				Rows int `json:"rows"`
			}
			if err := json.Unmarshal(raw, &resizeMsg); err == nil && resizeMsg.Cols > 0 {
				if err := session.WindowChange(resizeMsg.Rows, resizeMsg.Cols); err != nil { log.Printf("SSH resize failed: %v", err) }
				continue
			}
			var dataMsg struct {
				Data string `json:"data"`
			}
			if err := json.Unmarshal(raw, &dataMsg); err == nil && dataMsg.Data != "" {
				log.Printf("SSH stdin: %q", dataMsg.Data)
				stdinPipe.Write([]byte(dataMsg.Data))
			}
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
	if user == nil {
		sendErr(conn, "unauthorized")
		return
	}

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
	if user == nil {
		sendErr(conn, "unauthorized")
		return
	}

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		sendErr(conn, "connection not found")
		return
	}

	// Get or create SSH client (with retry if existing client is stale)
	var sshClient *sshmgr.Client
	var sftpClient *sftpmgr.Client
	var acquireErr error
	sshClient, ok := h.Pool.Acquire(connID)
	if ok {
		sftpClient, acquireErr = sftpmgr.NewClient(sshClient.RawConn())
		if acquireErr != nil {
			// Existing client is stale — close it, release ref, force new connection
			sshClient.Close()
			h.Pool.Release(connID)
			ok = false
		}
	}
	if !ok {
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
			sendErr(conn, "SSH 连接失败: "+friendlyErr(err))
			return
		}
		if err := sshClient.Connect(); err != nil {
			sendErr(conn, "SSH 连接失败: "+friendlyErr(err))
			return
		}
		h.Pool.Add(connID, sshClient)

		sftpClient, err = sftpmgr.NewClient(sshClient.RawConn())
		if err != nil {
			sendErr(conn, "SFTP 初始化失败: "+friendlyErr(err))
			return
		}
	}

	defer sftpClient.Close()
	defer h.Pool.Release(connID)

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
	websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": msg})
	time.Sleep(500 * time.Millisecond)
}
