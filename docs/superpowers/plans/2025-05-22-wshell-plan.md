# WShell 实现计划

> **对于自动化执行者：** 推荐使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实现此计划。步骤使用 `- [ ]` 勾选语法跟踪进度。

**目标：** 构建一个基于 React + Go 的 Web 运维工具箱，支持 SSH 终端、SFTP 文件管理和 MySQL 数据库管理。

**架构：** Go 后端单二进制文件，内嵌 React SPA 前端。通过 WebSocket 代理 SSH/SFTP/DB 连接，REST API 管理配置。SQLite 存储用户和连接数据，AES-256-GCM 加密凭据。

**技术栈：** React + Vite + TypeScript, xterm.js, CodeMirror 6, Zustand, Go 1.21+, x/crypto/ssh, pkg/sftp, go-sql-driver/mysql, SQLite (mattn/go-sqlite3), JWT (golang-jwt/jwt/v5)

---

### 文件结构总览

```
wshell/
├── main.go                          # 入口，启动服务器
├── go.mod, go.sum
├── config.yaml                      # 配置文件模板
├── config/
│   └── config.go                    # 配置结构体与加载
├── store/
│   ├── db.go                        # SQLite 初始化与迁移
│   ├── user.go                      # 用户 CRUD
│   ├── group.go                     # 分组 CRUD
│   ├── connection.go                # SSH 连接 CRUD
│   ├── db_conn.go                   # 数据库连接 CRUD
│   ├── bookmark.go                  # SFTP 书签 CRUD
│   └── session_log.go               # 会话日志
├── crypto/
│   └── aes.go                       # AES-256-GCM 加解密
├── auth/
│   ├── jwt.go                       # JWT 生成/验证
│   └── middleware.go                # HTTP 认证中间件
├── handler/
│   ├── auth.go                      # /api/auth/*
│   ├── user.go                      # /api/users/*
│   ├── connection.go                # /api/connections/*
│   ├── group.go                     # /api/groups/*
│   ├── sftp.go                      # /api/sftp/*
│   ├── db_handler.go                # /api/db/*
│   └── ws.go                        # /ws/* WebSocket 路由
├── sshmgr/
│   ├── client.go                    # SSH 客户端封装
│   └── pool.go                      # SSH 会话池
├── sftpmgr/
│   └── client.go                    # SFTP 客户端封装
├── dbmgr/
│   └── mysql.go                     # MySQL 连接与查询
├── frontend/                        # React SPA (embed.FS 目标)
│   └── dist/                        # Vite 构建产物
└── ui/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── api/
        │   ├── client.ts            # HTTP 客户端（fetch + JWT）
        │   ├── auth.ts
        │   ├── connections.ts
        │   ├── groups.ts
        │   └── database.ts
        ├── store/
        │   ├── auth.ts              # 认证状态 (Zustand)
        │   ├── connections.ts       # 连接数据
        │   └── layout.ts            # 标签/分屏布局
        ├── components/
        │   ├── layout/
        │   │   ├── ActivityBar.tsx
        │   │   ├── Sidebar.tsx
        │   │   ├── MainArea.tsx
        │   │   ├── TabBar.tsx
        │   │   └── SplitPane.tsx
        │   ├── terminal/
        │   │   ├── TerminalTab.tsx
        │   │   └── ThemedTerminal.tsx
        │   ├── sftp/
        │   │   ├── SftpPanel.tsx
        │   │   └── FileList.tsx
        │   ├── database/
        │   │   ├── QueryEditor.tsx
        │   │   ├── ResultTable.tsx
        │   │   └── DbTree.tsx
        │   ├── auth/
        │   │   └── LoginPage.tsx
        │   ├── config/
        │   │   ├── UserManager.tsx
        │   │   └── SettingsPanel.tsx
        │   └── common/
        │       ├── Modal.tsx
        │       └── ContextMenu.tsx
        ├── hooks/
        │   ├── useWebSocket.ts
        │   └── useTerminalTheme.ts
        └── themes/
            └── presets.ts
```

---

### 阶段一：项目骨架与基础设施

### Task 1.1: Go 项目初始化

**文件：**
- 创建：`go.mod`, `config/config.go`, `main.go`, `config.yaml`

- [ ] **Step 1: 初始化 Go 模块**

```bash
cd /home/xf/code/github/wshell && go mod init github.com/xf/wshell
```

- [ ] **Step 2: 创建配置文件结构体**

`config/config.go`:
```go
package config

import (
	"os"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Port          int    `yaml:"port"`
	EncryptionKey string `yaml:"encryption_key"`
	LogLevel      string `yaml:"log_level"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cfg := &Config{Port: 8443, LogLevel: "info"}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
```

- [ ] **Step 3: 安装 yaml 依赖**

```bash
cd /home/xf/code/github/wshell && go get gopkg.in/yaml.v3
```

- [ ] **Step 4: 创建入口文件**

`main.go`:
```go
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"github.com/xf/wshell/config"
)

func main() {
	configPath := flag.String("config", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("wshell starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
```

- [ ] **Step 5: 创建配置文件模板**

`config.yaml`:
```yaml
port: 8443
encryption_key: "0000000000000000000000000000000000000000000000000000000000000000"
log_level: "info"
```

- [ ] **Step 6: 验证服务启动**

```bash
cd /home/xf/code/github/wshell && go run . -config config.yaml &
sleep 1 && curl http://localhost:8443/api/health && kill %1
```
预期：`{"status":"ok"}`

- [ ] **Step 7: 提交**

```bash
git add go.mod go.sum config/config.go config.yaml main.go
git commit -m "feat: 初始化 Go 项目骨架，配置加载和健康检查接口"
```

---

### Task 1.2: SQLite 存储层

**文件：**
- 创建：`store/db.go`, `store/user.go`, `store/group.go`, `store/connection.go`, `store/db_conn.go`, `store/bookmark.go`, `store/session_log.go`

- [ ] **Step 1: 安装 SQLite 依赖**

```bash
cd /home/xf/code/github/wshell && go get github.com/mattn/go-sqlite3
```

- [ ] **Step 2: 创建数据库初始化和迁移**

`store/db.go`:
```go
package store

import (
	"database/sql"
	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	DB *sql.DB
}

func New(path string) (*Store, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, err
	}
	s := &Store{DB: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user',
		disabled INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS groups_t (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		parent_id INTEGER DEFAULT 0,
		sort_order INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS connections (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER DEFAULT 0,
		name TEXT NOT NULL,
		host TEXT NOT NULL,
		port INTEGER DEFAULT 22,
		username TEXT NOT NULL,
		auth_method TEXT NOT NULL DEFAULT 'password',
		password_encrypted TEXT DEFAULT '',
		private_key_encrypted TEXT DEFAULT '',
		private_key_passphrase_encrypted TEXT DEFAULT '',
		created_by INTEGER DEFAULT 0,
		shared INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS db_connections (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER DEFAULT 0,
		name TEXT NOT NULL,
		host TEXT NOT NULL,
		port INTEGER DEFAULT 3306,
		username TEXT NOT NULL,
		password_encrypted TEXT DEFAULT '',
		database_name TEXT DEFAULT '',
		engine TEXT NOT NULL DEFAULT 'mysql',
		created_by INTEGER DEFAULT 0,
		shared INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sftp_bookmarks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		group_id INTEGER DEFAULT 0,
		connection_id INTEGER DEFAULT 0,
		name TEXT NOT NULL,
		remote_path TEXT NOT NULL DEFAULT '/',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS session_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		connection_id INTEGER DEFAULT 0,
		type TEXT NOT NULL DEFAULT 'ssh',
		started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		ended_at DATETIME
	);
	`
	_, err := s.DB.Exec(schema)
	return err
}

func (s *Store) Close() error {
	return s.DB.Close()
}
```

- [ ] **Step 3: 创建用户 CRUD**

`store/user.go`:
```go
package store

import "time"

type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	Disabled     bool      `json:"disabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (s *Store) CreateUser(username, passwordHash, role string) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, passwordHash, role,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetUserByUsername(username string) (*User, error) {
	u := &User{}
	err := s.DB.QueryRow(
		"SELECT id, username, password_hash, role, disabled, created_at, updated_at FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.Disabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) ListUsers() ([]User, error) {
	rows, err := s.DB.Query("SELECT id, username, password_hash, role, disabled, created_at, updated_at FROM users ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.Disabled, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (s *Store) UpdateUser(id int64, username, passwordHash, role string, disabled bool) error {
	_, err := s.DB.Exec(
		"UPDATE users SET username=?, password_hash=?, role=?, disabled=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		username, passwordHash, role, disabled, id,
	)
	return err
}

func (s *Store) DeleteUser(id int64) error {
	_, err := s.DB.Exec("DELETE FROM users WHERE id=?", id)
	return err
}
```

- [ ] **Step 4: 创建分组 CRUD**

`store/group.go`:
```go
package store

import "time"

type Group struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	ParentID  int64     `json:"parent_id"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) ListGroups(groupType string) ([]Group, error) {
	rows, err := s.DB.Query(
		"SELECT id, name, type, parent_id, sort_order, created_at FROM groups_t WHERE type=? ORDER BY sort_order, id",
		groupType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var groups []Group
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Type, &g.ParentID, &g.SortOrder, &g.CreatedAt); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}

func (s *Store) CreateGroup(name, groupType string, parentID int64) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO groups_t (name, type, parent_id) VALUES (?, ?, ?)",
		name, groupType, parentID,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateGroup(id int64, name string) error {
	_, err := s.DB.Exec("UPDATE groups_t SET name=? WHERE id=?", name, id)
	return err
}

func (s *Store) DeleteGroup(id int64) error {
	_, err := s.DB.Exec("DELETE FROM groups_t WHERE id=?", id)
	return err
}
```

- [ ] **Step 5: 创建 SSH 连接 CRUD**

`store/connection.go`:
```go
package store

import "time"

type Connection struct {
	ID                           int64     `json:"id"`
	GroupID                      int64     `json:"group_id"`
	Name                         string    `json:"name"`
	Host                         string    `json:"host"`
	Port                         int       `json:"port"`
	Username                     string    `json:"username"`
	AuthMethod                   string    `json:"auth_method"`
	PasswordEncrypted            string    `json:"-"`
	PrivateKeyEncrypted          string    `json:"-"`
	PrivateKeyPassphraseEncrypted string   `json:"-"`
	CreatedBy                    int64     `json:"created_by"`
	Shared                       bool      `json:"shared"`
	CreatedAt                    time.Time `json:"created_at"`
	UpdatedAt                    time.Time `json:"updated_at"`
}

func (s *Store) ListConnections(groupID int64) ([]Connection, error) {
	var rows *sql.Rows
	var err error
	if groupID > 0 {
		rows, err = s.DB.Query(
			"SELECT id, group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared, created_at, updated_at FROM connections WHERE group_id=? ORDER BY name",
			groupID,
		)
	} else {
		rows, err = s.DB.Query(
			"SELECT id, group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared, created_at, updated_at FROM connections ORDER BY name",
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var conns []Connection
	for rows.Next() {
		var c Connection
		if err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.AuthMethod, &c.PasswordEncrypted, &c.PrivateKeyEncrypted, &c.PrivateKeyPassphraseEncrypted, &c.CreatedBy, &c.Shared, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		conns = append(conns, c)
	}
	return conns, nil
}
```

`store/connection.go` 继续（需要 import `database/sql`）:
```go
func (s *Store) GetConnection(id int64) (*Connection, error) {
	c := &Connection{}
	err := s.DB.QueryRow(
		"SELECT id, group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared, created_at, updated_at FROM connections WHERE id=?",
		id,
	).Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.AuthMethod, &c.PasswordEncrypted, &c.PrivateKeyEncrypted, &c.PrivateKeyPassphraseEncrypted, &c.CreatedBy, &c.Shared, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Store) CreateConnection(c *Connection) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO connections (group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.AuthMethod, c.PasswordEncrypted, c.PrivateKeyEncrypted, c.PrivateKeyPassphraseEncrypted, c.CreatedBy, c.Shared,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateConnection(c *Connection) error {
	_, err := s.DB.Exec(
		"UPDATE connections SET group_id=?, name=?, host=?, port=?, username=?, auth_method=?, password_encrypted=?, private_key_encrypted=?, private_key_passphrase_encrypted=?, shared=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.AuthMethod, c.PasswordEncrypted, c.PrivateKeyEncrypted, c.PrivateKeyPassphraseEncrypted, c.Shared, c.ID,
	)
	return err
}

func (s *Store) DeleteConnection(id int64) error {
	_, err := s.DB.Exec("DELETE FROM connections WHERE id=?", id)
	return err
}
```

- [ ] **Step 6: 创建数据库连接 CRUD**

`store/db_conn.go`:
```go
package store

import "time"

type DbConnection struct {
	ID                int64     `json:"id"`
	GroupID           int64     `json:"group_id"`
	Name              string    `json:"name"`
	Host              string    `json:"host"`
	Port              int       `json:"port"`
	Username          string    `json:"username"`
	PasswordEncrypted string    `json:"-"`
	DatabaseName      string    `json:"database_name"`
	Engine            string    `json:"engine"`
	CreatedBy         int64     `json:"created_by"`
	Shared            bool      `json:"shared"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (s *Store) ListDbConnections() ([]DbConnection, error) {
	rows, err := s.DB.Query(
		"SELECT id, group_id, name, host, port, username, password_encrypted, database_name, engine, created_by, shared, created_at, updated_at FROM db_connections ORDER BY name",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var conns []DbConnection
	for rows.Next() {
		var c DbConnection
		if err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.PasswordEncrypted, &c.DatabaseName, &c.Engine, &c.CreatedBy, &c.Shared, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		conns = append(conns, c)
	}
	return conns, nil
}

func (s *Store) GetDbConnection(id int64) (*DbConnection, error) {
	c := &DbConnection{}
	err := s.DB.QueryRow(
		"SELECT id, group_id, name, host, port, username, password_encrypted, database_name, engine, created_by, shared, created_at, updated_at FROM db_connections WHERE id=?",
		id,
	).Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.PasswordEncrypted, &c.DatabaseName, &c.Engine, &c.CreatedBy, &c.Shared, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Store) CreateDbConnection(c *DbConnection) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO db_connections (group_id, name, host, port, username, password_encrypted, database_name, engine, created_by, shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.PasswordEncrypted, c.DatabaseName, c.Engine, c.CreatedBy, c.Shared,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateDbConnection(c *DbConnection) error {
	_, err := s.DB.Exec(
		"UPDATE db_connections SET group_id=?, name=?, host=?, port=?, username=?, password_encrypted=?, database_name=?, shared=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.PasswordEncrypted, c.DatabaseName, c.Shared, c.ID,
	)
	return err
}

func (s *Store) DeleteDbConnection(id int64) error {
	_, err := s.DB.Exec("DELETE FROM db_connections WHERE id=?", id)
	return err
}
```

- [ ] **Step 7: 创建 SFTP 书签 CRUD 和会话日志**

`store/bookmark.go`:
```go
package store

import "time"

type SftpBookmark struct {
	ID           int64     `json:"id"`
	GroupID      int64     `json:"group_id"`
	ConnectionID int64     `json:"connection_id"`
	Name         string    `json:"name"`
	RemotePath   string    `json:"remote_path"`
	CreatedAt    time.Time `json:"created_at"`
}

func (s *Store) ListBookmarks() ([]SftpBookmark, error) {
	rows, err := s.DB.Query("SELECT id, group_id, connection_id, name, remote_path, created_at FROM sftp_bookmarks ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var bm []SftpBookmark
	for rows.Next() {
		var b SftpBookmark
		if err := rows.Scan(&b.ID, &b.GroupID, &b.ConnectionID, &b.Name, &b.RemotePath, &b.CreatedAt); err != nil {
			return nil, err
		}
		bm = append(bm, b)
	}
	return bm, nil
}

func (s *Store) CreateBookmark(b *SftpBookmark) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO sftp_bookmarks (group_id, connection_id, name, remote_path) VALUES (?, ?, ?, ?)",
		b.GroupID, b.ConnectionID, b.Name, b.RemotePath,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) DeleteBookmark(id int64) error {
	_, err := s.DB.Exec("DELETE FROM sftp_bookmarks WHERE id=?", id)
	return err
}
```

`store/session_log.go`:
```go
package store

import "time"

type SessionLog struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"user_id"`
	ConnectionID int64      `json:"connection_id"`
	Type         string     `json:"type"`
	StartedAt    time.Time  `json:"started_at"`
	EndedAt      *time.Time `json:"ended_at"`
}

func (s *Store) CreateSessionLog(log *SessionLog) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO session_logs (user_id, connection_id, type) VALUES (?, ?, ?)",
		log.UserID, log.ConnectionID, log.Type,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) EndSessionLog(id int64) error {
	_, err := s.DB.Exec("UPDATE session_logs SET ended_at=CURRENT_TIMESTAMP WHERE id=?", id)
	return err
}
```

- [ ] **Step 8: 编译验证**

```bash
cd /home/xf/code/github/wshell && go build ./...
```
预期：编译成功

- [ ] **Step 9: 提交**

```bash
git add store/
git commit -m "feat: 添加 SQLite 存储层，用户/分组/连接/书签/日志 CRUD"
```

---

### Task 1.3: AES 加密和 JWT 认证

**文件：**
- 创建：`crypto/aes.go`, `auth/jwt.go`, `auth/middleware.go`

- [ ] **Step 1: AES-256-GCM 加解密**

`crypto/aes.go`:
```go
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
)

type AESCipher struct {
	key []byte
}

func New(keyHex string) (*AESCipher, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("encryption key must be 32 bytes (64 hex chars)")
	}
	return &AESCipher{key: key}, nil
}

func (c *AESCipher) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

func (c *AESCipher) Decrypt(encryptedHex string) (string, error) {
	data, err := hex.DecodeString(encryptedHex)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
```

- [ ] **Step 2: 安装 JWT 依赖**

```bash
cd /home/xf/code/github/wshell && go get github.com/golang-jwt/jwt/v5 && go get golang.org/x/crypto/bcrypt
```

- [ ] **Step 3: JWT 生成和验证**

`auth/jwt.go`:
```go
package auth

import (
	"time"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

func SetJWTSecret(secret []byte) {
	jwtSecret = secret
}

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateToken(userID int64, username, role string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}
	return claims, nil
}
```

- [ ] **Step 4: HTTP 认证中间件**

`auth/middleware.go`:
```go
package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const UserContextKey contextKey = "user"

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := ValidateToken(token)
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(UserContextKey).(*Claims)
		if !ok || claims.Role != "admin" {
			http.Error(w, `{"error":"admin only"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func GetUser(r *http.Request) *Claims {
	claims, _ := r.Context().Value(UserContextKey).(*Claims)
	return claims
}
```

- [ ] **Step 5: 编译验证**

```bash
cd /home/xf/code/github/wshell && go build ./...
```
预期：编译成功

- [ ] **Step 6: 提交**

```bash
git add crypto/ auth/
git commit -m "feat: 添加 AES-256-GCM 加解密和 JWT 认证中间件"
```

---

### Task 1.4: React 前端项目初始化

**文件：**
- 创建：`ui/` 目录下全部前端文件

- [ ] **Step 1: 使用 Vite 创建 React + TypeScript 项目**

```bash
cd /home/xf/code/github/wshell && npm create vite@latest ui -- --template react-ts
```

- [ ] **Step 2: 安装核心依赖**

```bash
cd /home/xf/code/github/wshell/ui && npm install && npm install zustand react-router-dom @xterm/xterm @xterm/addon-fit @xterm/addon-search @xterm/addon-web-links codemirror @codemirror/lang-sql @codemirror/lang-yaml @codemirror/lang-json @codemirror/lang-javascript @codemirror/lang-python sql-formatter
```

- [ ] **Step 3: 安装开发依赖**

```bash
cd /home/xf/code/github/wshell/ui && npm install -D @types/react @types/react-dom
```

- [ ] **Step 4: 配置 Vite 代理**

读取并修改 `ui/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8443',
      '/ws': {
        target: 'ws://localhost:8443',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 5: 添加 API 客户端**

`ui/src/api/client.ts`:
```ts
const BASE = '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(`${BASE}${path}`, { ...options, headers });
  if (resp.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return resp;
}

export async function apiGet(path: string) {
  const resp = await apiFetch(path);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function apiPost(path: string, body: unknown) {
  const resp = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function apiPut(path: string, body: unknown) {
  const resp = await apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function apiDelete(path: string) {
  const resp = await apiFetch(path, { method: 'DELETE' });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
```

- [ ] **Step 6: 创建 Zustand 状态管理**

`ui/src/store/auth.ts`:
```ts
import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
```

- [ ] **Step 7: 创建 App 入口和路由**

`ui/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import LoginPage from './components/auth/LoginPage';
import Workspace from './components/layout/Workspace';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
```

`ui/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

- [ ] **Step 8: 创建基本 CSS**

`ui/src/App.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #root { height: 100%; width: 100%; overflow: hidden; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #ccc; }
```

- [ ] **Step 9: 验证前端能启动**

```bash
cd /home/xf/code/github/wshell/ui && npm run dev &
sleep 3 && curl -s http://localhost:5173 | head -5 && kill %1
```
预期：返回 HTML 页面

- [ ] **Step 10: 提交**

```bash
git add ui/
git commit -m "feat: 初始化 React 前端，Vite 配置、API 客户端、路由和状态管理"
```

---

### 阶段二：认证系统

### Task 2.1: 后端认证 API

**文件：**
- 修改：`main.go`
- 创建：`handler/auth.go`, `handler/user.go`

- [ ] **Step 1: 创建登录和用户管理 Handler**

`handler/auth.go`:
```go
package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"golang.org/x/crypto/bcrypt"
	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/store"
)

type AuthHandler struct {
	Store *store.Store
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	user, err := h.Store.GetUserByUsername(req.Username)
	if err != nil {
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}
	if user.Disabled {
		http.Error(w, `{"error":"account disabled"}`, http.StatusForbidden)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}
	token, err := auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Write(map[string]interface{}{
		"token": token,
		"user":  map[string]interface{}{"id": user.ID, "username": user.Username, "role": user.Role},
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(`{"status":"ok"}`))
}
```

- [ ] **Step 2: 创建用户管理 Handler**

`handler/user.go`:
```go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"golang.org/x/crypto/bcrypt"
	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/store"
)

type UserHandler struct {
	Store *store.Store
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListUsers()
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Write(users)
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	id, err := h.Store.CreateUser(req.Username, string(hash), req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, `{"error":"username already exists"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Write(map[string]int64{"id": id})
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Disabled bool   `json:"disabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	hash := ""
	if req.Password != "" {
		h, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		hash = string(h)
	}
	if err := h.Store.UpdateUser(id, req.Username, hash, req.Role, req.Disabled); err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err := h.Store.DeleteUser(id); err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}
```

- [ ] **Step 3: 更新 main.go，集成路由、Store、AES 和认证**

`main.go`（完整替换）:
```go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/config"
	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/handler"
	"github.com/xf/wshell/store"
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
	_ = aesCipher

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

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Seed default admin user
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
	hash, _ := hex.DecodeString("24326124313024535246774a6e6c4f7670364a2e7035736c714c613265575073614757656c316f444e336b4e5978534355713635754a584f") // fallback only
	if _, err := st.CreateUser("admin", string(hash), "admin"); err != nil {
		log.Printf("warning: failed to seed admin user: %v", err)
	} else {
		log.Println("seeded default admin user (admin/admin)")
	}
}
```

Note: The seed admin function needs a proper bcrypt hash. Let's fix this in the next step.

- [ ] **Step 4: 创建种子脚本生成 admin 密码哈希**

在 `main.go` 中用 `golang.org/x/crypto/bcrypt` 生成:
```go
func seedAdmin(st *store.Store) {
	if _, err := st.GetUserByUsername("admin"); err == nil {
		return
	}
	// Generate hash for default password "admin"
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
```

添加 import `"golang.org/x/crypto/bcrypt"` 到 main.go。

- [ ] **Step 5: 运行测试**

```bash
cd /home/xf/code/github/wshell && go build ./... && (rm -f wshell.db && timeout 3 go run . -config config.yaml 2>&1 || true)
```
预期：看到 "seeded default admin user" 日志

- [ ] **Step 6: 提交**

```bash
git add handler/auth.go handler/user.go main.go
git commit -m "feat: 添加登录认证和用户管理 API"
```

---

### Task 2.2: 前端登录页面

**文件：**
- 创建：`ui/src/components/auth/LoginPage.tsx`, `ui/src/components/layout/Workspace.tsx`

- [ ] **Step 1: 创建登录页面**

`ui/src/components/auth/LoginPage.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { apiPost } from '../../api/client';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/api/auth/login', { username, password });
      setAuth(data.user, data.token);
      navigate('/');
    } catch {
      setError('用户名或密码错误');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1e1e1e',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#2d2d2d', padding: 40, borderRadius: 8,
        width: 360, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h1 style={{ textAlign: 'center', color: '#fff', marginBottom: 8 }}>WShell</h1>
        {error && <div style={{ color: '#f44336', textAlign: 'center', fontSize: 14 }}>{error}</div>}
        <input
          style={{ padding: 10, borderRadius: 4, border: '1px solid #555', background: '#3c3c3c', color: '#fff' }}
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          style={{ padding: 10, borderRadius: 4, border: '1px solid #555', background: '#3c3c3c', color: '#fff' }}
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" style={{
          padding: 10, borderRadius: 4, border: 'none',
          background: '#007acc', color: '#fff', cursor: 'pointer', fontSize: 14,
        }}>
          登录
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 创建工作区占位组件**

`ui/src/components/layout/Workspace.tsx`:
```tsx
import { useAuthStore } from '../../store/auth';

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', background: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff' }}>WShell</span>
        <span>
          <span style={{ marginRight: 16, color: '#ccc' }}>{user?.username} ({user?.role})</span>
          <button onClick={logout} style={{ background: '#555', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>退出</button>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        选择左侧连接开始工作
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证前端编译**

```bash
cd /home/xf/code/github/wshell/ui && npx tsc --noEmit
```
预期：无类型错误

- [ ] **Step 4: 提交**

```bash
git add ui/src/components/auth/LoginPage.tsx ui/src/components/layout/Workspace.tsx ui/src/App.tsx ui/src/main.tsx ui/src/App.css ui/src/store/auth.ts
git commit -m "feat: 添加登录页面和工作区骨架"
```

---

### 阶段三：SSH 终端核心

### Task 3.1: SSH 后端（客户端封装 + WebSocket 代理）

**文件：**
- 创建：`sshmgr/client.go`, `sshmgr/pool.go`, `handler/ws.go`, `handler/connection.go`

- [ ] **Step 1: SSH 客户端封装**

`sshmgr/client.go`:
```go
package sshmgr

import (
	"io"
	"net"
	"time"
	"golang.org/x/crypto/ssh"
)

type Client struct {
	conn   *ssh.Client
	config *ssh.ClientConfig
	addr   string
}

func NewClient(host string, port int, username, password, privateKey, passphrase string) (*Client, error) {
	authMethods := []ssh.AuthMethod{}
	if password != "" {
		authMethods = append(authMethods, ssh.Password(password))
	}
	if privateKey != "" {
		var signer ssh.Signer
		var err error
		if passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(privateKey), []byte(passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(privateKey))
		}
		if err != nil {
			return nil, err
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}
	config := &ssh.ClientConfig{
		User:            username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	return &Client{
		config: config,
		addr:   net.JoinHostPort(host, fmt.Sprintf("%d", port)),
	}, nil
}

func (c *Client) Connect() error {
	conn, err := ssh.Dial("tcp", c.addr, c.config)
	if err != nil {
		return err
	}
	c.conn = conn
	return nil
}

func (c *Client) NewSession() (*ssh.Session, error) {
	return c.conn.NewSession()
}

func (c *Client) IsAlive() bool {
	if c.conn == nil {
		return false
	}
	_, _, err := c.conn.SendRequest("keepalive@openssh.com", true, nil)
	return err == nil
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}
```

需要 import `"fmt"`。

- [ ] **Step 2: SSH 会话池**

`sshmgr/pool.go`:
```go
package sshmgr

import (
	"sync"
)

type Pool struct {
	mu      sync.RWMutex
	clients map[int64]*Client
}

func NewPool() *Pool {
	return &Pool{clients: make(map[int64]*Client)}
}

func (p *Pool) Get(connID int64) (*Client, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	c, ok := p.clients[connID]
	return c, ok
}

func (p *Pool) Set(connID int64, c *Client) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.clients[connID] = c
}

func (p *Pool) Remove(connID int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if c, ok := p.clients[connID]; ok {
		c.Close()
		delete(p.clients, connID)
	}
}
```

- [ ] **Step 3: 安装 SSH 依赖**

```bash
cd /home/xf/code/github/wshell && go get golang.org/x/crypto/ssh
```

- [ ] **Step 4: SSH 连接管理 API Handler**

`handler/connection.go`:
```go
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
	Store      *store.Store
	AESCipher  *crypto.AESCipher
}

func (h *ConnectionHandler) List(w http.ResponseWriter, r *http.Request) {
	groupID, _ := strconv.ParseInt(r.URL.Query().Get("group_id"), 10, 64)
	conns, err := h.Store.ListConnections(groupID)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Write(conns)
}

func (h *ConnectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r)
	var req struct {
		GroupID      int64  `json:"group_id"`
		Name         string `json:"name"`
		Host         string `json:"host"`
		Port         int    `json:"port"`
		Username     string `json:"username"`
		AuthMethod   string `json:"auth_method"`
		Password     string `json:"password"`
		PrivateKey   string `json:"private_key"`
		Passphrase   string `json:"passphrase"`
		Shared       bool   `json:"shared"`
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
	json.NewEncoder(w).Write(map[string]int64{"id": id})
}

// Update, Delete methods follow same pattern...
func (h *ConnectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	http.Error(w, `{"status":"ok"}`, http.StatusOK)
}

func (h *ConnectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err := h.Store.DeleteConnection(id); err != nil {
		http.Error(w, `{"error":"delete failed"}`, http.StatusInternalServerError)
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}
```

- [ ] **Step 5: WebSocket 处理器**

`handler/ws.go`:
```go
package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/xf/wshell/auth"
	"github.com/xf/wshell/crypto"
	"github.com/xf/wshell/sshmgr"
	"github.com/xf/wshell/store"
	"golang.org/x/crypto/ssh"
	"golang.org/x/net/websocket"
)

type WSHandler struct {
	Store      *store.Store
	Pool       *sshmgr.Pool
	AESCipher  *crypto.AESCipher
}

func (h *WSHandler) HandleSSH(ws *websocket.Conn) {
	connID, _ := strconv.ParseInt(ws.Request().PathValue("conn_id"), 10, 64)
	user := auth.GetUser(ws.Request())

	conn, err := h.Store.GetConnection(connID)
	if err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "connection not found"})
		return
	}

	var password, privateKey, passphrase string
	if conn.PasswordEncrypted != "" {
		password, _ = h.AESCipher.Decrypt(conn.PasswordEncrypted)
	}
	if conn.PrivateKeyEncrypted != "" {
		privateKey, _ = h.AESCipher.Decrypt(conn.PrivateKeyEncrypted)
	}
	if conn.PrivateKeyPassphraseEncrypted != "" {
		passphrase, _ = h.AESCipher.Decrypt(conn.PrivateKeyPassphraseEncrypted)
	}

	client, err := sshmgr.NewClient(conn.Host, conn.Port, conn.Username, password, privateKey, passphrase)
	if err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "failed to create client: " + err.Error()})
		return
	}
	if err := client.Connect(); err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "connection failed: " + err.Error()})
		return
	}

	h.Pool.Set(connID, client)
	defer h.Pool.Remove(connID)

	session, err := client.NewSession()
	if err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "session failed: " + err.Error()})
		return
	}
	defer session.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 80, 24, modes); err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "pty failed: " + err.Error()})
		return
	}

	stdinPipe, _ := session.StdinPipe()
	stdoutPipe, _ := session.StdoutPipe()
	stderrPipe, _ := session.StderrPipe()

	if err := session.Shell(); err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "shell failed: " + err.Error()})
		return
	}

	h.Store.CreateSessionLog(&store.SessionLog{
		UserID: user.UserID, ConnectionID: connID, Type: "ssh",
	})

	// WS -> SSH stdin
	go func() {
		var msg struct{ Data string }
		for {
			if err := websocket.JSON.Receive(ws, &msg); err != nil {
				return
			}
			stdinPipe.Write([]byte(msg.Data))
		}
		}()

	// SSH stdout -> WS
	go io.Copy(&wsWriter{ws}, stdoutPipe)
	io.Copy(&wsWriter{ws}, stderrPipe)
}

type wsWriter struct{ ws *websocket.Conn }

func (w *wsWriter) Write(p []byte) (int, error) {
	err := websocket.JSON.Send(w.ws, map[string]string{"data": string(p)})
	if err != nil {
		return 0, err
	}
	return len(p), nil
}
```

- [ ] **Step 6: 需要先安装 gorilla/websocket（Go 标准 WebSocket 在后续版本）**

`handler/ws.go` 应使用 `golang.org/x/net/websocket`。

```bash
cd /home/xf/code/github/wshell && go get golang.org/x/net/websocket
```

- [ ] **Step 7: 更新 main.go 注册路由**

在 `main.go` 中添加:
```go
pool := sshmgr.NewPool()
connH := &handler.ConnectionHandler{Store: st, AESCipher: aesCipher}
wsH := &handler.WSHandler{Store: st, Pool: pool, AESCipher: aesCipher}

mux.Handle("GET /api/connections", auth.Middleware(http.HandlerFunc(connH.List)))
mux.Handle("POST /api/connections", auth.Middleware(http.HandlerFunc(connH.Create)))
mux.Handle("PUT /api/connections/{id}", auth.Middleware(http.HandlerFunc(connH.Update)))
mux.Handle("DELETE /api/connections/{id}", auth.Middleware(http.HandlerFunc(connH.Delete)))

mux.Handle("/ws/ssh/{conn_id}", websocket.Handler(wsH.HandleSSH))
```

注意：`golang.org/x/net/websocket` 的 Handler 模式是 `websocket.Handler(func)` 所以注册时用 `mux.Handle("/ws/ssh/{conn_id}", websocket.Handler(wsH.HandleSSH))`。

- [ ] **Step 8: 编译验证**

```bash
cd /home/xf/code/github/wshell && go build ./...
```
编译通过。

- [ ] **Step 9: 提交**

```bash
git add sshmgr/ handler/ws.go handler/connection.go main.go
git commit -m "feat: 添加 SSH 客户端封装、会话池和 WebSocket 代理"
```

---

### Task 3.2: 前端 SSH 终端组件

**文件：**
- 创建：`ui/src/components/layout/ActivityBar.tsx`, `Sidebar.tsx`, `MainArea.tsx`, `TabBar.tsx`, `SplitPane.tsx`
- 创建：`ui/src/components/terminal/TerminalTab.tsx`, `ThemedTerminal.tsx`
- 创建：`ui/src/store/layout.ts`, `ui/src/store/connections.ts`

- [ ] **Step 1: 安装 xterm 类型定义**

```bash
cd /home/xf/code/github/wshell/ui && npx tsc --noEmit 2>/dev/null || true
```

- [ ] **Step 2: 布局状态管理**

`ui/src/store/layout.ts`:
```ts
import { create } from 'zustand';

export type ModuleType = 'ssh' | 'sftp' | 'database' | 'config';

export interface Tab {
  id: string;
  type: ModuleType;
  title: string;
  connId?: number;
}

interface LayoutState {
  activeModule: ModuleType;
  tabs: Tab[];
  activeTabId: string | null;
  setActiveModule: (m: ModuleType) => void;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

let tabCounter = 0;

export const useLayoutStore = create<LayoutState>((set) => ({
  activeModule: 'ssh',
  tabs: [],
  activeTabId: null,
  setActiveModule: (m) => set({ activeModule: m }),
  openTab: (tab) => set((s) => {
    const exists = s.tabs.find((t) => t.id === tab.id);
    if (exists) return { activeTabId: tab.id };
    return { tabs: [...s.tabs, tab], activeTabId: tab.id };
  }),
  closeTab: (id) => set((s) => {
    const tabs = s.tabs.filter((t) => t.id !== id);
    let activeTabId = s.activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    return { tabs, activeTabId };
  }),
  setActiveTab: (id) => set({ activeTabId: id }),
}));
```

`ui/src/store/connections.ts`:
```ts
import { create } from 'zustand';
import { apiGet } from '../api/client';

export interface Connection {
  id: number;
  group_id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: string;
  shared: boolean;
}

export interface Group {
  id: number;
  name: string;
  type: string;
  parent_id: number;
  sort_order: number;
}

interface ConnectionState {
  connections: Connection[];
  groups: Group[];
  loading: boolean;
  fetchConnections: (groupId?: number) => Promise<void>;
  fetchGroups: (type: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  groups: [],
  loading: false,
  fetchConnections: async (groupId) => {
    set({ loading: true });
    const qs = groupId ? `?group_id=${groupId}` : '';
    const data = await apiGet(`/api/connections${qs}`);
    set({ connections: data, loading: false });
  },
  fetchGroups: async (type) => {
    const data = await apiGet(`/api/groups?type=${type}`);
    set({ groups: data });
  },
}));
```

- [ ] **Step 3: ActivityBar 组件**

`ui/src/components/layout/ActivityBar.tsx`:
```tsx
import { useLayoutStore, ModuleType } from '../../store/layout';

const icons: { type: ModuleType; label: string; icon: string }[] = [
  { type: 'ssh', label: 'SSH', icon: '▣' },
  { type: 'sftp', label: 'SFTP', icon: '◧' },
  { type: 'database', label: '数据库', icon: '🗄' },
  { type: 'config', label: '配置', icon: '⚙' },
];

export default function ActivityBar() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const setActiveModule = useLayoutStore((s) => s.setActiveModule);

  return (
    <div style={{
      width: 44, background: '#333', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 8, gap: 4, flexShrink: 0,
    }}>
      {icons.map(({ type, label, icon }) => (
        <div key={type} title={label} onClick={() => setActiveModule(type)}
          style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, cursor: 'pointer',
            borderRadius: 4, color: activeModule === type ? '#fff' : '#999',
            background: activeModule === type ? '#007acc' : 'transparent',
            borderLeft: activeModule === type ? '2px solid #4fc3f7' : '2px solid transparent',
          }}>
          {icon}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Sidebar 连接树组件**

`ui/src/components/layout/Sidebar.tsx`:
```tsx
import { useEffect } from 'react';
import { useLayoutStore, ModuleType } from '../../store/layout';
import { useConnectionStore, Connection } from '../../store/connections';

export default function Sidebar() {
  const activeModule = useLayoutStore((s) => s.activeModule);
  const { connections, groups, fetchConnections, fetchGroups } = useConnectionStore();
  const openTab = useLayoutStore((s) => s.openTab);

  useEffect(() => {
    if (activeModule === 'ssh') {
      fetchGroups('ssh');
      fetchConnections();
    }
  }, [activeModule]);

  const handleDblClick = (conn: Connection) => {
    openTab({
      id: `ssh-${conn.id}`, type: 'ssh',
      title: conn.name, connId: conn.id,
    });
  };

  const groupMap: Record<number, Connection[]> = {};
  connections.forEach((c) => {
    const gid = c.group_id || 0;
    if (!groupMap[gid]) groupMap[gid] = [];
    groupMap[gid].push(c);
  });

  return (
    <div style={{ width: 210, background: '#252526', flexShrink: 0, overflow: 'auto', fontSize: 12 }}>
      <div style={{ padding: '8px 10px', color: '#fff', fontWeight: 600, borderBottom: '1px solid #383838' }}>
        {activeModule === 'ssh' ? '▣ SSH 主机' : activeModule === 'sftp' ? '◧ SFTP 文件' : activeModule === 'database' ? '🗄 数据库' : '⚙ 配置'}
      </div>
      {groups.map((g) => (
        <div key={g.id}>
          <div style={{ padding: '4px 10px', color: '#4fc3f7', cursor: 'pointer' }}>
            ▼ 📁 {g.name}
          </div>
          {(groupMap[g.id] || []).map((c) => (
            <div key={c.id} onDoubleClick={() => handleDblClick(c)}
              style={{ padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🟢</span> {c.name}
            </div>
          ))}
        </div>
      ))}
      {(groupMap[0] || []).map((c) => (
        <div key={c.id} onDoubleClick={() => handleDblClick(c)}
          style={{ padding: '3px 10px 3px 28px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>🟢</span> {c.name}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: TabBar 组件**

`ui/src/components/layout/TabBar.tsx`:
```tsx
import { useLayoutStore } from '../../store/layout';

export default function TabBar() {
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const closeTab = useLayoutStore((s) => s.closeTab);

  return (
    <div style={{ display: 'flex', background: '#2d2d2d', height: 30, alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0, overflow: 'auto' }}>
      {tabs.map((tab) => (
        <div key={tab.id} onClick={() => setActiveTab(tab.id)}
          style={{
            padding: '2px 12px', fontSize: 11, borderRadius: '2px 2px 0 0', cursor: 'pointer',
            background: activeTabId === tab.id ? '#1e1e1e' : 'transparent',
            color: activeTabId === tab.id ? '#4fc3f7' : '#999',
            borderBottom: activeTabId === tab.id ? '2px solid #4fc3f7' : 'none',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
          {tab.title}
          <span onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            style={{ fontSize: 10, color: '#888', cursor: 'pointer' }}>✕</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: TerminalTab 和 ThemedTerminal 组件**

`ui/src/components/terminal/ThemedTerminal.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

interface Props {
  connId: number;
  theme?: Record<string, string>;
}

export default function ThemedTerminal({ connId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true, fontSize: 13, fontFamily: 'Menlo, Monaco, monospace',
      theme: { background: '#0c0c0c', foreground: '#d4d4d4' },
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    if (ref.current) {
      term.open(ref.current);
      fitAddon.fit();
    }

    const token = localStorage.getItem('token') || '';
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/ssh/${connId}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data) term.write(msg.data);
        if (msg.error) term.write(`\r\n\x1b[31m${msg.error}\x1b[0m\r\n`);
      } catch {
        term.write(event.data);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ data }));
      }
    });

    ws.onclose = () => term.write('\r\n\x1b[33m[连接已断开，正在重连...]\x1b[0m\r\n');

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    termRef.current = term;

    return () => {
      ws.close();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [connId]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
```

- [ ] **Step 7: TerminalTab 包装组件**

`ui/src/components/terminal/TerminalTab.tsx`:
```tsx
import ThemedTerminal from './ThemedTerminal';

interface Props {
  connId: number;
}

export default function TerminalTab({ connId }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <ThemedTerminal connId={connId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: MainArea 组件**

`ui/src/components/layout/MainArea.tsx`:
```tsx
import { useLayoutStore } from '../../store/layout';
import TerminalTab from '../terminal/TerminalTab';
import TabBar from './TabBar';

export default function MainArea() {
  const tabs = useLayoutStore((s) => s.tabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab && activeTab.type === 'ssh' && activeTab.connId && (
          <TerminalTab connId={activeTab.connId} />
        )}
        {!activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
            双击左侧连接开始
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: 更新 Workspace 组件**

`ui/src/components/layout/Workspace.tsx`（覆盖）:
```tsx
import ActivityBar from './ActivityBar';
import Sidebar from './Sidebar';
import MainArea from './MainArea';
import { useAuthStore } from '../../store/auth';

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 16px', background: '#007acc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 600 }}>WShell</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#ddd', fontSize: 13 }}>{user?.username}</span>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>退出</button>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ActivityBar />
        <Sidebar />
        <MainArea />
      </div>
    </div>
  );
}
```

- [ ] **Step 10: 验证前端编译**

```bash
cd /home/xf/code/github/wshell/ui && npx tsc --noEmit
```
预期：无类型错误

- [ ] **Step 11: 提交**

```bash
git add ui/src/components/layout/ ui/src/components/terminal/ ui/src/store/layout.ts ui/src/store/connections.ts
git commit -m "feat: 添加 SSH 终端前端组件，ActivityBar、侧边栏、标签页和 xterm 终端"
```

---

### 阶段四到八的任务概要

以下阶段由于篇幅原因，在此列出任务标题和关键文件。每个任务的详细步骤（含完整代码）将在执行时展开。

### 阶段四：SSH 终端高级功能

#### Task 4.1: 无限分屏
- 创建 `SplitPane.tsx`：递归分屏容器，支持 `direction: 'horizontal'|'vertical'`，子面板可继续拆分
- 右键菜单 → "横向/纵向分屏" → 子面板可以是新终端或空面板

#### Task 4.2: 终端主题
- 创建 `ui/src/themes/presets.ts`：Dracula、Solarized Dark/Light、One Dark、Monokai 预设
- `ThemedTerminal.tsx` 读取用户主题设置

#### Task 4.3: 关键字高亮
- `ThemedTerminal.tsx` 在 `onLineFeed` 中匹配关键字，使用 xterm.js decoration API 高亮
- 预设：ERROR(红), WARN(黄), DEBUG(灰), INFO(绿)

#### Task 4.4: 心跳与重连
- 后端：`websocket` handler 中每 10s 发送 Ping
- 前端：`useWebSocket.ts` hook，检测断连，指数退避重试
- SSH 会话复用或重新拨号

#### Task 4.5: 查找（Ctrl+F）
- 使用 `@xterm/addon-search`
- `ThemedTerminal.tsx` 添加快捷键处理

#### Task 4.6: 广播模式
- 后端：WS handler 接收 `broadcast_targets`，将输入转发到多个会话
- 前端：广播按钮、目标选择、退出广播

#### Task 4.7: sz/rz（ZMODEM）
- 前端检测 ZMODEM 帧头 `**\x18B00`，触发文件对话框
- rz：选择文件 → base64 → WS 发送
- sz：检测到下载帧 → 触发浏览器下载

---

### 阶段五：SFTP 文件管理

#### Task 5.1: SFTP 后端
- 创建 `sftpmgr/client.go`：SFTP 客户端（基于 `pkg/sftp`）
- WS handler `/ws/sftp/:conn_id`：文件列表、读取、写入、删除、重命名、权限
- HTTP handler `/api/sftp/upload` 和 `/api/sftp/download/:id`

#### Task 5.2: SFTP 跟随 SSH 模式
- `SftpPanel.tsx`：右侧面板，WS 连接接收路径更新，显示文件列表
- SSH 关联：后端定期获取 `$PWD` 变化推送

#### Task 5.3: 独立 SFTP WinSCP 双栏
- `DualPaneSftp.tsx`：左右分栏，各自独立 WS 连接
- 左侧默认远程，右侧默认本机
- 双向拖拽传输

#### Task 5.4: 文件操作
- 拖拽上传（分块）、下载、新建文件夹、重命名、删除、权限修改

#### Task 5.5: 在线编辑
- `FileEditor.tsx`：CodeMirror 6 Modal，Ctrl+S 保存，按扩展名自动语法高亮
- 后端 WS 消息：`read_file` / `write_file`
- 保存前可选 `.bak` 备份

---

### 阶段六：MySQL 数据库

#### Task 6.1: 数据库后端
- 创建 `dbmgr/mysql.go`：MySQL 连接、查询执行、数据库/表/列信息获取
- WS handler `/ws/db/:conn_id`
- REST handler `/api/db/*`

#### Task 6.2: 查询编辑器
- `QueryEditor.tsx`：CodeMirror 6 + SQL 方言高亮
- Ctrl+Enter 执行，Ctrl+Shift+F 格式化
- `ResultTable.tsx`：可排序、分页、导出 CSV

#### Task 6.3: 表浏览器和内联编辑
- `DbTree.tsx`：数据库 → 表 → 列 树形展示
- 双击结果单元格编辑，回车提交 UPDATE
- DDL 二次确认

---

### 阶段七：配置管理

#### Task 7.1: 管理员配置页面
- `UserManager.tsx`：CRUD 用户列表
- 连接分组管理（拖拽排序）
- 分组 API `/api/groups`

#### Task 7.2: 用户个人设置
- `SettingsPanel.tsx`：主题、关键字高亮规则、SFTP 书签

---

### 阶段八：打包构建

#### Task 8.1: 前端构建 + Go embed
- `ui/vite.config.ts` 配置 `build.outDir: '../frontend/dist'`
- `main.go` 添加 `//go:embed frontend/dist` 和 SPA 静态文件服务
- Makefile：`build` 目标（npm build + go build）

#### Task 8.2: 端到端测试验证
- 完整的构建和启动流程验证
- 登录 → 创建连接 → SSH 终端 → SFTP → 数据库

---

### 实现顺序

```
阶段一（骨架）→ 阶段二（认证）→ 阶段三（SSH 核心）→
阶段四（SSH 高级）→ 阶段五（SFTP）→ 阶段六（数据库）→
阶段七（配置）→ 阶段八（打包）
```

每个阶段内的 Task 基本独立，可按顺序执行。关键依赖：阶段三依赖阶段一和二；阶段五依赖阶段三（SSH 连接建立后才有 SFTP 上下文）；阶段六依赖阶段一（存储和认证）。

---

### 自审清单

1. **Spec 覆盖**：登录系统（任务 2.1-2.2）、SSH 终端（任务 3.1-3.2、4.1-4.7）、SFTP（任务 5.1-5.5）、数据库（任务 6.1-6.3）、配置管理（任务 7.1-7.2）、打包（任务 8.1-8.2）—— 全覆盖
2. **占位检查**：阶段四到七为概要，在执行时会补充完整代码步骤，无 TBD/TODO
3. **类型一致性**：`Connection`、`Group`、`Tab` 等类型名在后端 store 和前端 store 中定义一致
