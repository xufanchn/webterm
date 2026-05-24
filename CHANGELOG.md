# Changelog

## [0.1.0] - 2026-05-24

WebTerm 首个版本，基于 React + Go 的 Web 运维工具箱。

### 核心功能

- **SSH 终端** — xterm.js 渲染，256 色 / TrueColor，支持多标签页、无限分屏、广播模式
- **SFTP 文件管理** — WinSCP 风格双栏布局，跟随 SSH 终端自动同步路径，拖拽上传 / 下载
- **数据库管理** — MySQL 查询编辑器（CodeMirror 6 + SQL 方言），表浏览，内联编辑，结果导出 CSV
- **本地文件** — WebSocket 通道访问服务器本地文件系统

### 用户系统

- 登录认证（JWT），admin / user 双角色
- 连接按用户隔离，支持公共连接共享
- 凭据 AES-256-GCM 加密存储

### 界面

- Tokyo Night 主题 + 多种预设配色方案
- VS Code Activity Bar 风格导航
- 关键字高亮、终端内搜索 (Ctrl+F)、sz/rz 文件传输
- 页面刷新持久化标签页和分屏布局
- Matrix Rain 动态背景 + ASCII art "WEBTERM" banner

### 运维特性

- SSH 连接池引用计数，断线自动重连
- OSC 7 协议追踪 shell 工作目录
- WebSocket 心跳 + 指数退避重试

### 部署

- Go 单二进制文件，前端静态资源内嵌
- 跨平台：Linux (amd64/arm64)、macOS (amd64/arm64)、Windows (amd64)
- Docker 多架构镜像 (`ghcr.io/xufanchn/webterm`)
- systemd 服务单元 + 启动脚本（start/stop/restart/status）
- GitHub Actions 自动发布：`git tag v* && git push --tags`
