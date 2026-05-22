# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
make build      # Build frontend (ui/) then Go binary (embeds frontend/dist)
make dev        # Run Go server with config.yaml
make dev-ui     # Run Vite dev server (hot reload for frontend)
```

Go binary embeds `frontend/dist` via `//go:embed`. After any frontend change, `make build` is required (or `cd ui && npm run build && go build -o wshell .`).

## Architecture

A Web-based SSH/SFTP/Database terminal manager. Go backend + React (Vite) frontend, embedded as single binary.

### Backend (Go)

- `main.go` — HTTP routes, frontend embedding (`//go:embed frontend/dist`), admin seed
- `handler/` — HTTP and WebSocket handlers
  - `ws.go` — HandleSSH, HandleSFTP, HandleDB (WebSocket), plus `sendErr` helper and OSC 7 PROMPT_COMMAND injection
  - `local_fs.go` — Local filesystem browser (WebSocket)
  - `sftp.go` — SFTP upload/download (HTTP REST)
  - `connection.go` — SSH connection CRUD; **Update merges with existing** to preserve non-provided fields
  - `group.go`, `user.go`, `auth.go`, `db_handler.go`
- `store/` — SQLite data layer
- `sshmgr/` — SSH client pool with `Acquire/Add/Release` reference counting (multiple tabs share one SSH TCP connection safely)
- `config/`, `crypto/`, `dbmgr/`, `sftpmgr/`
- `auth/` — JWT middleware; supports both `Authorization: Bearer` header and `?token=` query param

**WebSocket routes do NOT use auth middleware** (browsers can't set custom headers). Auth is handled inside handlers via `GetUserWS()` which checks context, header, and query param.

### Frontend (React + TypeScript, `ui/`)

- `ui/src/store/layout.ts` — Zustand: activeModule, tab queue (`requestTab`/`drainTabQueue`), broadcast scope, terminal registry, SFTP disconnect signal, focusedPaneId
- `ui/src/store/connections.ts` — SSH/DB connections and groups state
- `ui/src/hooks/useWebSocket.ts` — WebSocket hook with callback refs (prevents reconnect on re-render), `wasOpenRef` (no retry after successful connection)
- Layout components:
  - `Workspace.tsx` — Top-level: header, ActivityBar, Sidebar, MainArea, SettingsPanel
  - `ActivityBar.tsx` — Module icons + sidebar toggle + personal settings button
  - `Sidebar.tsx` — Connection tree with groups (expandable), drag-to-move, right-click menus
  - `MainArea.tsx` — Renders all modules (SSH/SFTP/Database/Config) with `display` control, keeps them mounted
  - `SplitPane.tsx` — CSS Grid-based split pane system. **All panes are direct children** of the grid container, never remounted. Tree structure (`LayoutNode`) used only for computing `grid-template-areas`.
  - `TabBar.tsx` — Per-pane tab bar with `+` picker, tab drag, broadcast scope cycler
- Terminal: `ThemedTerminal.tsx` (xterm.js + FitAddon + ResizeObserver), `TerminalTab.tsx` (terminal + status bar)
- SFTP: `SftpPanel.tsx` (per-connId state cache via `cacheRef`), `FileList.tsx` (context menus, drag-drop upload)
- Theme: `themes/presets.ts`, inline styles (CSS-in-JS)

### Key Behaviors

- **Module switching preserves state** — All modules rendered, `display: none` for inactive (MainArea)
- **Tab independence** — Each LeafPane manages its own tabs/activeTabId locally; no global tab state
- **Split panes never remount** — Pane components are flat children of CSS Grid container; splitting only changes grid layout
- **SSH pool ref counting** — `Pool.Acquire/Add/Release`; connection closed only when last session releases
- **SFTP per-connection cache** — `cacheRef` stores path+files per connId; tab switching restores cached state
- **OSC 7 cd tracking** — Shell `PROMPT_COMMAND` emits OSC 7 via stdinPipe; xterm.js OSC handler parses and updates SFTP path
- **Broadcast** — Three modes: off/pane/all. Each terminal registers `window['wshell-ws-${myTabId}']`
- **Sidebar collapse** — Width 0 + overflow hidden + transition (like SFTP panel)
