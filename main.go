package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/config"
	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/handler"
	"github.com/xf/wshell/sshmgr"
	"github.com/xf/wshell/store"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/net/websocket"
)

func main() {
	configPath := flag.String("config", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	st, err := store.New("wshell.db")
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer st.Close()

	aesCipher, err := crypto.New(cfg.EncryptionKey)
	if err != nil {
		log.Fatalf("invalid encryption key: %v", err)
	}
	jwtSecret := make([]byte, 32)
	if _, err := rand.Read(jwtSecret); err != nil {
		log.Fatalf("failed to generate jwt secret: %v", err)
	}
	auth.SetJWTSecret(jwtSecret)

	authH := &handler.AuthHandler{Store: st}
	userH := &handler.UserHandler{Store: st}

	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/auth/login", authH.Login)
	mux.HandleFunc("POST /api/auth/logout", authH.Logout)

	mux.Handle("GET /api/users", auth.Middleware(auth.AdminOnly(http.HandlerFunc(userH.List))))
	mux.Handle("POST /api/users", auth.Middleware(auth.AdminOnly(http.HandlerFunc(userH.Create))))
	mux.Handle("PUT /api/users/{id}", auth.Middleware(auth.AdminOnly(http.HandlerFunc(userH.Update))))
	mux.Handle("DELETE /api/users/{id}", auth.Middleware(auth.AdminOnly(http.HandlerFunc(userH.Delete))))

	pool := sshmgr.NewPool()
	connH := &handler.ConnectionHandler{Store: st, AESCipher: aesCipher}
	wsH := &handler.WSHandler{Store: st, Pool: pool, AESCipher: aesCipher}

	mux.Handle("GET /api/connections", auth.Middleware(http.HandlerFunc(connH.List)))
	mux.Handle("POST /api/connections", auth.Middleware(http.HandlerFunc(connH.Create)))
	mux.Handle("PUT /api/connections/{id}", auth.Middleware(http.HandlerFunc(connH.Update)))
	mux.Handle("DELETE /api/connections/{id}", auth.Middleware(http.HandlerFunc(connH.Delete)))

	mux.Handle("/ws/ssh/{conn_id}", websocket.Handler(wsH.HandleSSH))

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	seedAdmin(st)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("wshell starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func seedAdmin(st *store.Store) {
	if _, err := st.GetUserByUsername("admin"); err == nil {
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("warning: failed to generate admin hash: %v", err)
		return
	}
	if _, err := st.CreateUser("admin", string(hash), "admin"); err != nil {
		log.Printf("warning: failed to seed admin user: %v", err)
	} else {
		log.Println("seeded default admin user (admin/admin)，请立即修改密码")
	}
}
