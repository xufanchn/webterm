package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/sftpmgr"
	"github.com/xf/wshell/sshmgr"
	"github.com/xf/wshell/store"
)

type SftpHandler struct {
	Store     *store.Store
	Pool      *sshmgr.Pool
	AESCipher *crypto.AESCipher
}

func (h *SftpHandler) makeSSHFactory(connInfo *store.Connection) func() (*sshmgr.Client, error) {
	return func() (*sshmgr.Client, error) {
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
		client, err := sshmgr.NewClient(connInfo.Host, connInfo.Port, connInfo.Username, password, privateKey, passphrase)
		if err != nil {
			return nil, err
		}
		if err := client.Connect(); err != nil {
			return nil, err
		}
		return client, nil
	}
}

func (h *SftpHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(100 << 20); err != nil { // 100MB max
		http.Error(w, `{"error":"file too large"}`, http.StatusBadRequest)
		return
	}

	connID, _ := strconv.ParseInt(r.FormValue("conn_id"), 10, 64)
	path := r.FormValue("path")

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		http.Error(w, `{"error":"connection not found"}`, http.StatusNotFound)
		return
	}

	sshClient, err := h.Pool.AcquireOrCreate(connID, h.makeSSHFactory(connInfo))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"ssh: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer h.Pool.Release(connID)

	sftpClient, err := sftpmgr.NewClient(sshClient.RawConn())
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"sftp init: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer sftpClient.Close()

	if err := sftpClient.WriteFileFromReader(path, file); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upload: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "path": path})
}

func (h *SftpHandler) Download(w http.ResponseWriter, r *http.Request) {
	connID, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, `{"error":"path required"}`, http.StatusBadRequest)
		return
	}

	connInfo, err := h.Store.GetConnection(connID)
	if err != nil {
		http.Error(w, `{"error":"connection not found"}`, http.StatusNotFound)
		return
	}

	sshClient, err := h.Pool.AcquireOrCreate(connID, h.makeSSHFactory(connInfo))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"ssh: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer h.Pool.Release(connID)

	sftpClient, err := sftpmgr.NewClient(sshClient.RawConn())
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"sftp init: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer sftpClient.Close()

	data, err := sftpClient.ReadFile(path)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"read: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	fileName := path
	if idx := strings.LastIndex(path, "/"); idx >= 0 {
		fileName = path[idx+1:]
	}
	// Escape quotes and backslashes in filename for Content-Disposition header
	escapedName := strings.ReplaceAll(fileName, `\`, `\\`)
	escapedName = strings.ReplaceAll(escapedName, `"`, `\"`)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, escapedName))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.Write(data)
}
