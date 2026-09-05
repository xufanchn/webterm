# AGENTS.md

## 项目简介

WebTerm —— 基于 Web 的 SSH / SFTP / 数据库终端管理器。仓库根目录为 Go 后端，`ui/` 为 React 19 + TypeScript 前端，最终打包为内嵌前端的单一二进制。默认端口 8888（`config.yaml`），默认管理员 `admin`/`admin`，SQLite 数据库位于 `webterm.db`。

## 常用命令

```bash
make build            # 顺序固定：先构建 ui/（输出到 ../frontend/dist），再构建 Go 二进制
make dev              # go run . -config config.yaml  （后端监听 :8888）
make dev-ui           # Vite 开发服务器，端口 5173，/api 和 /ws 代理到 :8888 —— 需先跑 make dev
cd ui && npm run build   # tsc -b && vite build（这就是类型检查步骤）
cd ui && npm run lint    # eslint
```

- 全新检出时直接 `go build` 会失败：`main.go` 有 `//go:embed frontend/dist`，必须先构建前端。
- 仓库没有 Go 测试；后端用 `go build ./...` / `go vet ./...` 做基本校验，前端用 `tsc -b`。

## 后端结构

- `main.go` —— 所有路由注册（Go 1.22 方法+路径模式路由）、`//go:embed frontend/dist`、管理员种子数据。
- `handler/` —— HTTP 与 WebSocket 处理器（`ws.go` 的 HandleSSH/HandleSFTP/HandleDB；`sftp.go` 为 REST 上传/下载；另有 `connection.go`、`group.go`、`db_handler.go`、`local_fs.go`、`user.go`、`auth.go`）。
- `store/` —— SQLite 数据层。驱动是 **modernc.org/sqlite（纯 Go，无 CGO）** —— README 里写的 "mattn/go-sqlite3" 已过时，不要重新引入 CGO。
- `sshmgr/` —— SSH 连接池，`Acquire/Add/Release` 引用计数，最后一次 Release 时才关闭连接。
- `sftpmgr/`、`dbmgr/`（MySQL）、`crypto/`（凭据 AES-256-GCM 加密）、`auth/`（JWT 中间件）。

**WebSocket 路由绕过 auth 中间件**（浏览器无法在 WS 上设置自定义请求头）。鉴权靠 `GetUserWS()` / `?token=` 查询参数 —— 不要给 `/ws/*` 路由套标准中间件。

**连接 Update 处理器与已有记录合并** —— 部分 PUT 不能清空未指定的字段，必须保持该行为。

## 前端结构（`ui/src`）

- `store/` —— Zustand：`layout.ts`（activeModule、标签队列、广播范围、终端注册表、focusedPaneId）、`auth.ts`、`connections.ts`、`preferences.ts`。
- `hooks/useWebSocket.ts` —— 用回调 ref 防止重连循环；`wasOpenRef` 在成功后停止重试。
- `components/terminal/SplitPane.tsx` —— 基于 CSS Grid 的分屏；窗格是 grid 的直接子元素，**绝不重挂载**；`LayoutNode` 树只用于计算 `grid-template-areas`。
- `components/terminal/TerminalTab.tsx` / `ThemedTerminal.tsx` —— xterm.js + FitAddon + ResizeObserver。
- `components/sftp/SftpPanel.tsx` —— 通过 `cacheRef` 实现按连接缓存状态。
- 主题：`themes/presets.ts`，内联 CSS-in-JS（无 CSS 框架）。
- `api/client.ts` —— 统一 API 客户端；`i18n/en.ts` + `zh.ts` —— **每个新增 UI 字符串必须同时加到两个语言文件**。

## 关键行为

- 所有模块（SSH/SFTP/DB/本地文件）始终挂载，未激活的用 `display: none` 隐藏，切换时不要卸载。
- 每个 LeafPane 本地持有自己的标签/activeTabId —— 标签状态不是全局的。
- OSC 7：后端向 PTY 注入 `PROMPT_COMMAND`；shell 在 `cd` 时发出 OSC 7，xterm.js 解析后同步 SFTP 面板路径。
- 广播输入：关闭 / 当前窗格 / 全局 三种模式。

## 已知问题与约定

- ZMODEM `rz` 上传卡住问题已解决（根因与验证记录见 `docs/known-issues.md`）。注意：`zmodem.js` 0.1.10 的 `Zmodem.Browser.send_files` 有缺陷（丢结尾块、不发 ZFIN），前端用 `ThemedTerminal.tsx` 里自实现的 `zmodemSendFiles()`，不要改回去。改动 `ws.go` 二进制通道或 zmodem 相关代码前先读 `docs/known-issues.md`。
- 提交遵循带 scope 的约定式提交，如 `fix(ui): ...`、`feat: ...`；面向用户的变更需更新 `CHANGELOG.md`（中文）。
- 文档站（VitePress，独立仓库）：https://github.com/xufanchn/webterm-docs ，每 6 小时自动同步 release 的 changelog。
- 更多架构细节见 `CLAUDE.md`；产品文档见 `README.md` / `README_zh.md`。
