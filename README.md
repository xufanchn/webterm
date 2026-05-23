# WShell

> [中文文档](README_zh.md)

Web-based SSH/SFTP/Database terminal manager. Single binary, Go backend + React frontend.

## Features

- **SSH Terminal** — xterm.js based, multi-tab, split panes with CSS Grid
- **SFTP File Manager** — dual-pane, drag-drop upload, context menu, directory following (OSC 7)
- **Database Query Editor** — SQL highlighting, result table
- **Connection Manager** — groups, tags, color labels, search, multi-select batch ops
- **OneKey** — preset credential key-value pairs for quick auth
- **Broadcast** — send input to all terminals in a pane or globally
- **Theme** — multiple terminal color schemes, highlight rules

## Quick Start

```bash
make build          # build frontend + Go binary
./wshell            # runs on :8443 by default (see config.yaml)
```

Default admin: `admin` / `admin`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22+, net/http |
| Frontend | React 19, TypeScript, Vite |
| Terminal | xterm.js 5.x, @xterm/addon-fit, @xterm/addon-search |
| SSH | golang.org/x/crypto/ssh |
| SFTP | github.com/pkg/sftp |
| Database | SQLite (mattn/go-sqlite3) |
| State | Zustand |
| Auth | JWT (golang-jwt/jwt) |

## Open Source Dependencies

- [xterm.js](https://github.com/xtermjs/xterm.js) — MIT
- [x/crypto/ssh](https://pkg.go.dev/golang.org/x/crypto/ssh) — BSD-3
- [pkg/sftp](https://github.com/pkg/sftp) — BSD-2
- [zustand](https://github.com/pmndrs/zustand) — MIT
- [go-sqlite3](https://github.com/mattn/go-sqlite3) — MIT
- [golang-jwt](https://github.com/golang-jwt/jwt) — MIT
- [Vite](https://vitejs.dev/) — MIT
- [React](https://react.dev/) — MIT

## Config

`config.yaml`:
```yaml
port: 8443
encryption_key: "64-char-hex-string"
log_level: "info"
```

## License

MIT
