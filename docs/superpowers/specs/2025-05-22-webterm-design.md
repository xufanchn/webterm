# WebTerm 设计文档

## 概述

WebTerm 是一个基于 Web 的运维开发工具，部署在 Linux 服务器上，通过浏览器访问。提供 SSH 终端、SFTP 文件管理、MySQL 数据库管理及配置管理，内置登录系统。

## 技术栈

- **前端**：React (SPA), xterm.js, CodeMirror 6, sql-formatter
- **后端**：Go（单二进制文件）, x/crypto/ssh, go-sql-driver/mysql
- **存储**：SQLite（用户、连接、书签、分组）
- **通信**：REST API + WebSocket
- **部署**：Go 单二进制文件，前端静态文件通过 `embed.FS` 打包

## 系统架构

```
浏览器 (React SPA)
  │ HTTP + WebSocket
Go 后端（单二进制文件）
  ├── HTTP/WS 路由
  ├── SSH 模块 (x/crypto/ssh)
  ├── SFTP 模块 (pkg/sftp)
  ├── 数据库模块 (go-mysql)
  └── 认证 + 配置服务 (SQLite)
```

- 单文件部署：`./webterm -config config.yaml`
- 配置文件 `config.yaml` 放在二进制同目录下，包含 `port`、`encryption_key`（AES-256 用 32 字节 hex）、`log_level`
- 前端静态文件通过 `embed.FS` 编译进二进制
- WebSocket 维持 SSH 终端和 SFTP 面板的实时连接
- SSH 凭据用 AES-256-GCM 加密存储，密钥来自配置文件 `encryption_key`
- 配置文件权限：`chmod 600`

## 导航与布局

采用 VS Code Activity Bar 模式：

- **最左侧图标栏**（44px）：功能模块切换 — SSH 终端、SFTP 文件、数据库、配置
- **左侧面板**（210px）：当前模块的连接树，支持分组折叠和搜索
- **主区域**：标签页 + 内容区，支持无限分屏

### 模块切换

- 点击图标栏切换侧边面板内容和主区域上下文
- SSH 模块：侧边栏展示 SSH 主机分组树，主区域展示终端标签
- SFTP 模块：侧边栏展示 SFTP 书签，主区域展示 WinSCP 风格双栏
- 数据库模块：侧边栏展示数据库连接，主区域展示查询编辑器
- 配置模块：仅管理员可见，侧边栏展示配置分类

### 标签页

- 每个打开的会话（SSH 终端、SFTP 面板、数据库查询）对应一个标签
- 标签支持拖拽排序、关闭、关闭其他
- `+` 按钮打开连接选择器

### 无限分屏

- 右键任一面板 → "横向分屏"或"纵向分屏"
- 递归拆分，无数量限制
- 拖动分隔线调整面板大小
- 关闭面板 → 相邻面板自动扩展填充
- 每个面板组内有独立的标签栏

## 功能模块

### 1. 登录认证

- 本地账号系统，支持 admin 和 user 两种角色
- 管理员可创建/编辑/禁用用户
- JWT Token，有效期 24 小时，前端存 localStorage
- 简单的用户名 + 密码认证

### 2. SSH 终端

- xterm.js 渲染终端（256 色、TrueColor）
- 通过 WebSocket 代理与 x/crypto/ssh 通信
- 功能特性：
  - **心跳与重连**：服务端每 10s 发送 WS Ping 帧。客户端检测断连后指数退避重试（1s→2s→4s→8s，最大间隔 30s）。WS 重连成功后尝试复用原有 SSH 会话，若会话已断开则自动重新拨号。
  - **主题**：预设 Dracula、Solarized Dark/Light、One Dark、Monokai，支持自定义背景色、前景色、ANSI 色板、光标样式、字体大小
  - **关键字高亮**：用户自定义关键字和颜色。运维常用预设：ERROR（红色）、WARN（黄色）、DEBUG（灰色）、INFO（绿色）。前端在 `onLineFeed` 回调中匹配，支持纯文本和正则表达式
  - **查找**：Ctrl+F，使用 `@xterm/addon-search`
  - **sz/rz (ZMODEM)**：检测终端流中的 ZMODEM 数据帧，触发浏览器文件对话框进行收发
  - **广播模式**：选中一个标签作为"广播源"，进入广播模式后键盘输入同步发送到所有已选目标标签
  - **在线编辑**：双击 SFTP 面板中的文件 → CodeMirror 6 编辑浮层 → Ctrl+S 写回远程。按文件扩展名自动选择语言高亮

### 3. SFTP 文件管理

两种模式：

| | 跟随 SSH 模式 | 独立 SFTP 模式 |
|---|---|---|
| 入口 | SSH 终端右侧面板自动展示 | 图标栏切换到 SFTP 模块 |
| 布局 | 终端（左）+ SFTP 面板（右） | WinSCP 风格双栏 |
| 路径 | 跟随当前选中 SSH 终端的 `$PWD` | 左栏远程，右栏默认本机（可切换） |

- **跟随模式**：后端每 2s 或 `$PWD` 变化时获取当前工作目录，通过 WS 推送路径更新。SFTP 面板自动刷新。切换分屏终端时跟随焦点变化
- **拖拽上传**：文件列表上方有拖拽区域，浏览器 `ondrop` 捕获文件，分块上传（10MB/块）通过 `/api/sftp/upload`，底部显示进度条
- **下载**：点击文件触发浏览器下载，通过 `/api/sftp/download/:id?path=xxx` 流式传输
- **文件操作**：目录树浏览、新建文件夹、重命名、删除（需确认）、权限展示/编辑、符号链接展示
- **WinSCP 双栏传输**：左右均可下拉切换连接（远程或本机），支持从一侧拖拽到另一侧触发传输，底部传输队列面板显示进度
- **在线编辑**：双击文本文件 → CodeMirror 6 编辑浮层，按扩展名自动语法高亮。常用语言预设：YAML、Python、Shell、INI/conf、JSON、JS、SQL，其他默认纯文本。Ctrl+S 保存，可选 `.bak` 备份

### 4. 数据库管理（MySQL）

- WS `/ws/db/:conn_id` 实时通信
- 功能特性：
  - **数据库/表浏览**：树形展示 数据库 → 表 → 列信息（类型、索引）
  - **查询编辑器**：CodeMirror 6 + `@codemirror/lang-sql`（MySQL 方言）。Ctrl+Enter 执行选中的 SQL 或全部 SQL。结果表格支持排序、分页（限制 1000 行）
  - **SQL 格式化**：`sql-formatter` 库，Ctrl+Shift+F 一键格式化，可配置缩进风格
  - **导出**：查询结果导出 CSV
  - **内联编辑**：双击结果表格中的单元格，编辑后回车提交 UPDATE
  - **DDL 执行**：ALTER/CREATE/DROP 需二次弹窗确认
  - **查询历史**：本地存储最近 50 条查询，支持收藏常用查询
- **安全**：服务端不记录完整查询日志（仅记录"发起查询"事件）。危险操作需强制确认

### 5. 配置管理

**管理员**（图标栏"配置"模块）：
- 用户管理（增删改查、角色分配）
- 连接分组管理（拖拽排序、嵌套分组）
- 公共连接配置（所有用户可见）
- 系统设置（加密密钥、端口、日志级别）

**普通用户**（右上角头像下拉 → 个人设置）：
- 个人私有连接
- 终端偏好（主题、字体大小、光标样式）
- 关键字高亮规则
- SFTP 路径书签

## API 设计

```
认证 (/api/auth)
  POST /api/auth/login          登录
  POST /api/auth/logout         登出

用户管理 (/api/users，管理员)
  GET/POST    /api/users        列表/创建
  PUT/DELETE  /api/users/:id    编辑/删除

SSH 连接 (/api/connections)
  GET/POST    /api/connections  列表/创建
  PUT/DELETE  /api/connections/:id  编辑/删除
  POST        /api/connections/:id/test  测试连接

分组管理 (/api/groups)
  GET/POST    /api/groups       列表/创建
  PUT/DELETE  /api/groups/:id   编辑/删除

SFTP (/api/sftp)
  POST /api/sftp/upload        上传（multipart，分块）
  GET  /api/sftp/download/:id  下载（流式传输）

数据库 (/api/db)
  POST /api/db/execute          执行 SQL
  GET  /api/db/databases        数据库列表
  GET  /api/db/:db/tables       表列表
  GET  /api/db/:db/tables/:t    表结构+索引

WebSocket (/ws)
  GET /ws/ssh/:conn_id          SSH 终端流
  GET /ws/sftp/:conn_id         SFTP 文件操作流
  GET /ws/db/:conn_id           数据库查询流
```

## 数据模型

```sql
users (id, username, password_hash, role[admin|user], created_at, updated_at)

groups (id, name, type[ssh|sftp_bookmark|database], parent_id, sort_order, created_at)

connections (
  id, group_id, name, host, port, username,
  auth_method [password|private_key],
  password_encrypted,          -- AES-256-GCM 加密后的密码
  private_key_encrypted,       -- AES-256-GCM 加密后的私钥
  private_key_passphrase_encrypted, -- AES-256-GCM 加密后的私钥口令
  created_by, shared [true|false],
  created_at, updated_at
)

sftp_bookmarks (
  id, group_id, connection_id, name, remote_path, created_at
)

db_connections (
  id, group_id, name, host, port, username,
  password_encrypted, database_name, engine[mysql],
  created_by, shared, created_at, updated_at
)

session_logs (id, user_id, connection_id, type[ssh|sftp|db], started_at, ended_at)
```

## MVP 范围

**本期实现：**
- 登录系统（admin/user 角色）
- SSH 终端（主题、关键字高亮、多标签、无限分屏、广播、sz/rz、查找、在线编辑）
- SFTP（跟随 SSH 侧边栏 + 独立 WinSCP 双栏，拖拽上传）
- MySQL 查询编辑器、表浏览器、内联编辑
- 配置管理（用户管理、连接分组、个人偏好）

**后续版本：**
- LDAP/AD 集成
- MySQL 以外的数据库引擎
- 配置模板下发到远程主机
- 会话录制和回放
- 详细查询审计日志

## 安全

- SSH 凭据：AES-256-GCM 加密存储于 SQLite，密钥来自配置文件
- JWT 认证，24 小时过期
- 配置文件：`chmod 600`
- DDL 操作需二次确认
- 服务端不记录完整 SQL 查询内容
- WebSocket 连接通过 JWT 在连接参数中认证
