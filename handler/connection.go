package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/store"
)

type ConnectionHandler struct {
	Store     *store.Store
	AESCipher *crypto.AESCipher
}

func (h *ConnectionHandler) List(w http.ResponseWriter, r *http.Request) {
	groupID, _ := strconv.ParseInt(r.URL.Query().Get("group_id"), 10, 64)
	conns, err := h.Store.ListConnections(groupID)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	if conns == nil {
		conns = []store.Connection{}
	}
	json.NewEncoder(w).Encode(conns)
}

func (h *ConnectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r)
	var req struct {
		GroupID    int64  `json:"group_id"`
		Name       string `json:"name"`
		Host       string `json:"host"`
		Port       int    `json:"port"`
		Username   string `json:"username"`
		AuthMethod string `json:"auth_method"`
		Password   string `json:"password"`
		PrivateKey string `json:"private_key"`
		Passphrase string `json:"passphrase"`
		Shared     bool   `json:"shared"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}

	var pwdEnc, keyEnc, passEnc string
	var err error
	if req.Password != "" {
		pwdEnc, err = h.AESCipher.Encrypt(req.Password)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}
	if req.PrivateKey != "" {
		keyEnc, err = h.AESCipher.Encrypt(req.PrivateKey)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}
	if req.Passphrase != "" {
		passEnc, err = h.AESCipher.Encrypt(req.Passphrase)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}

	c := &store.Connection{
		GroupID:                      req.GroupID,
		Name:                         req.Name,
		Host:                         req.Host,
		Port:                         req.Port,
		Username:                     req.Username,
		AuthMethod:                   req.AuthMethod,
		PasswordEncrypted:            pwdEnc,
		PrivateKeyEncrypted:          keyEnc,
		PrivateKeyPassphraseEncrypted: passEnc,
		CreatedBy:                    user.UserID,
		Shared:                       req.Shared,
	}
	id, err := h.Store.CreateConnection(c)
	if err != nil {
		http.Error(w, `{"error":"create failed"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

func (h *ConnectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	user := auth.GetUser(r)
	var req struct {
		GroupID    int64  `json:"group_id"`
		Name       string `json:"name"`
		Host       string `json:"host"`
		Port       int    `json:"port"`
		Username   string `json:"username"`
		AuthMethod string `json:"auth_method"`
		Password   string `json:"password"`
		PrivateKey string `json:"private_key"`
		Passphrase string `json:"passphrase"`
		Shared     bool   `json:"shared"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}

	var pwdEnc, keyEnc, passEnc string
	var err error
	if req.Password != "" {
		pwdEnc, err = h.AESCipher.Encrypt(req.Password)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}
	if req.PrivateKey != "" {
		keyEnc, err = h.AESCipher.Encrypt(req.PrivateKey)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}
	if req.Passphrase != "" {
		passEnc, err = h.AESCipher.Encrypt(req.Passphrase)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}

	c := &store.Connection{
		ID:                           id,
		GroupID:                      req.GroupID,
		Name:                         req.Name,
		Host:                         req.Host,
		Port:                         req.Port,
		Username:                     req.Username,
		AuthMethod:                   req.AuthMethod,
		PasswordEncrypted:            pwdEnc,
		PrivateKeyEncrypted:          keyEnc,
		PrivateKeyPassphraseEncrypted: passEnc,
		Shared:                       req.Shared,
	}
	_ = user
	if err := h.Store.UpdateConnection(c); err != nil {
		http.Error(w, `{"error":"update failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}

func (h *ConnectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err := h.Store.DeleteConnection(id); err != nil {
		http.Error(w, `{"error":"delete failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}
