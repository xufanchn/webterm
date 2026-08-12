package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/xufanchn/webterm/auth"
	"github.com/xufanchn/webterm/crypto"
	"github.com/xufanchn/webterm/store"
)

func canUseDbConnection(user *auth.Claims, c *store.DbConnection) bool {
	return user != nil && (user.Role == "admin" || c.CreatedBy == user.UserID || c.Shared)
}

func canManageDbConnection(user *auth.Claims, c *store.DbConnection) bool {
	return user != nil && (user.Role == "admin" || c.CreatedBy == user.UserID)
}

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

	user := auth.GetUser(r)
	existing, err := h.Store.GetDbConnection(id)
	if err != nil {
		http.Error(w, `{"error":"db connection not found"}`, http.StatusNotFound)
		return
	}
	if !canManageDbConnection(user, existing) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
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
	// Merge with existing: keep old values for fields not provided
	if req.Name == "" {
		c.Name = existing.Name
	}
	if req.Host == "" {
		c.Host = existing.Host
	}
	if req.Port == 0 {
		c.Port = existing.Port
	}
	if req.Username == "" {
		c.Username = existing.Username
	}
	if req.DatabaseName == "" {
		c.DatabaseName = existing.DatabaseName
	}
	if req.GroupID == 0 {
		c.GroupID = existing.GroupID
	}
	if pwdEnc == "" {
		c.PasswordEncrypted = existing.PasswordEncrypted
	}
	c.Shared = req.Shared || existing.Shared
	if err := h.Store.UpdateDbConnection(c); err != nil {
		http.Error(w, `{"error":"update failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}

func (h *DbConnHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	user := auth.GetUser(r)
	existing, err := h.Store.GetDbConnection(id)
	if err != nil {
		http.Error(w, `{"error":"db connection not found"}`, http.StatusNotFound)
		return
	}
	if !canManageDbConnection(user, existing) {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	if err := h.Store.DeleteDbConnection(id); err != nil {
		http.Error(w, `{"error":"delete failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}
