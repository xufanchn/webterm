package handler

import (
	"io"
	"strconv"
	"time"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/crypto"
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
	user := auth.GetUser(conn.Request())

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		websocket.JSON.Send(conn, map[string]string{"error": "connection not found"})
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
			websocket.JSON.Send(conn, map[string]string{"error": "failed to create client: " + err.Error()})
			return
		}
		if err := client.Connect(); err != nil {
			websocket.JSON.Send(conn, map[string]string{"error": "connection failed: " + err.Error()})
			return
		}
		h.Pool.Set(connID, client)
	}

	session, err := client.NewSession()
	if err != nil {
		websocket.JSON.Send(conn, map[string]string{"error": "session failed: " + err.Error()})
		return
	}
	defer session.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 80, 24, modes); err != nil {
		websocket.JSON.Send(conn, map[string]string{"error": "pty failed: " + err.Error()})
		return
	}

	stdinPipe, _ := session.StdinPipe()
	stdoutPipe, _ := session.StdoutPipe()
	stderrPipe, _ := session.StderrPipe()

	if err := session.Shell(); err != nil {
		websocket.JSON.Send(conn, map[string]string{"error": "shell failed: " + err.Error()})
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
