# CLAUDE.md

## Commands

```bash
make build   # Build frontend (ui/) then Go binary (embeds frontend/dist)
make dev     # Run Go server with config.yaml
make dev-ui  # Vite dev server (hot reload)
```

## Architecture

Web-based SSH/SFTP/Database terminal manager. Go backend + React (Vite) frontend, single binary.

### Backend (Go)

- `main.go` — HTTP routes, `//go:embed frontend/dist`, admin seed
- `handler/ws.go` — HandleSSH, HandleSFTP, HandleDB (WebSocket), OSC 7 PROMPT_COMMAND injection
- `handler/sftp.go` — SFTP upload/download (HTTP REST)
- `handler/connection.go` — SSH connection CRUD; **Update merges with existing**
- `store/` — SQLite data layer
- `sshmgr/` — SSH client pool with `Acquire/Add/Release` reference counting
- `auth/` — JWT middleware; supports `Authorization: Bearer` header and `?token=` query param

**WebSocket routes bypass auth middleware** — browsers can't set custom headers. Auth via `GetUserWS()`.

### Frontend (React + TypeScript, `ui/`)

- `ui/src/store/layout.ts` — Zustand: activeModule, tab queue, broadcast scope, terminal registry, focusedPaneId
- `ui/src/hooks/useWebSocket.ts` — callback refs prevent reconnect; `wasOpenRef` stops retry after success
- `SplitPane.tsx` — CSS Grid-based splits. Panes are direct grid children, never remounted. `LayoutNode` tree only for computing `grid-template-areas`.
- `TerminalTab.tsx` / `ThemedTerminal.tsx` — xterm.js + FitAddon + ResizeObserver
- `SftpPanel.tsx` — per-connId state cache via `cacheRef`
- Theme: `themes/presets.ts`, inline CSS-in-JS

### Key Behaviors

- **Module switching** — All modules mounted; `display: none` for inactive
- **Tab independence** — Each LeafPane owns its tabs/activeTabId locally
- **Split panes never remount** — Only grid layout changes
- **SSH pool ref counting** — `Acquire/Add/Release`; close on last release
- **SFTP per-connection cache** — `cacheRef` stores path+files per connId
- **OSC 7 cd tracking** — `PROMPT_COMMAND` emits OSC 7 via stdinPipe; xterm.js OSC handler updates SFTP path
- **Broadcast** — Three modes: off/pane/all
