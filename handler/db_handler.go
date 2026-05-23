package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/store"
)

type DbConnHandler struct {
	Store     *store.Store
	AESCipher *crypto.AESCipher
}

func (h *DbConnHandler) List(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r)
	conns, err := h.Store.ListDbConnections(user.UserID)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	if conns == nil {
		conns = []store.DbConnection{}
	}
	json.NewEncoder(w).Encode(conns)
}

func (h *DbConnHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r)
	var req struct {
		GroupID      int64  `json:"group_id"`
		Name         string `json:"name"`
		Host         string `json:"host"`
		Port         int    `json:"port"`
		Username     string `json:"username"`
		Password     string `json:"password"`
		DatabaseName string `json:"database_name"`
		Shared       bool   `json:"shared"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}

	pwdEnc, err := h.AESCipher.Encrypt(req.Password)
	if err != nil {
		http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
		return
	}

	c := &store.DbConnection{
		GroupID:           req.GroupID,
		Name:              req.Name,
		Host:              req.Host,
		Port:              req.Port,
		Username:          req.Username,
		PasswordEncrypted: pwdEnc,
		DatabaseName:      req.DatabaseName,
		Engine:            "mysql",
		CreatedBy:         user.UserID,
		Shared:            req.Shared,
	}
	id, err := h.Store.CreateDbConnection(c)
	if err != nil {
		http.Error(w, `{"error":"create failed"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

func (h *DbConnHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	var req struct {
		GroupID      int64  `json:"group_id"`
		Name         string `json:"name"`
		Host         string `json:"host"`
		Port         int    `json:"port"`
		Username     string `json:"username"`
		Password     string `json:"password"`
		DatabaseName string `json:"database_name"`
		Shared       bool   `json:"shared"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}

	var pwdEnc string
	if req.Password != "" {
		var err error
		pwdEnc, err = h.AESCipher.Encrypt(req.Password)
		if err != nil {
			http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
			return
		}
	}

	c := &store.DbConnection{
		ID:                id,
		GroupID:           req.GroupID,
		Name:              req.Name,
		Host:              req.Host,
		Port:              req.Port,
		Username:          req.Username,
		PasswordEncrypted: pwdEnc,
		DatabaseName:      req.DatabaseName,
		Shared:            req.Shared,
	}
	if err := h.Store.UpdateDbConnection(c); err != nil {
		http.Error(w, `{"error":"update failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}

func (h *DbConnHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err := h.Store.DeleteDbConnection(id); err != nil {
		http.Error(w, `{"error":"delete failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}
