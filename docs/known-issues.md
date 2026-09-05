# 已知问题记录

## 2026-08-13 ZMODEM `rz` 上传卡住（已解决 2026-09-06）

**现象**：远端执行 `rz` 后选完文件，无进度、无完成提示，会话挂起。

**根因**（均在 `zmodem.js` 0.1.10 的 `Zmodem.Browser.send_files` 及其用法上，已用本地 lrzsz + PTY 测试台复现确认）：

1. **不发 ZFIN**：批量发送完成后从不调用 `session.close()`。远端 `rz` 传完文件后等待下一个 ZFILE/ZFIN，超时后反复重发 ZRINIT，浏览器侧又把 `Unhandled header: ZRINIT` 异常吞掉——表现为"无完成、会话挂起"。
2. **丢结尾数据块**：`reader.onload` 中 `new Uint8Array(e.target.result, xfer, piece)` 参数错误（byteOffset/length 被强转为 0）。一旦 FileReader 触发过 progress 事件（大文件），结尾块变成空块，最后一个 progress 块之后的字节全部丢失——实测 200000 字节只收到 199999（文件静默损坏）。未触发 progress 的小文件反而正常（onload 自动补发全量）。

**修复**（`ui/src/components/terminal/ThemedTerminal.tsx`）：弃用 `Zmodem.Browser.send_files`，自实现 `zmodemSendFiles()`：`send_offer` → 分块 `xfer.send()` → `xfer.end(最后一块)`（同时支持 ZRPOS 断点续传偏移）→ 批量结束 `session.close()` 发 ZFIN 让 rz 正常退出。附带改进：上传进度行内刷新、取消文件选择框时 `session.abort()`、发送出错时 abort 以免 rz 挂起、WebSocket 断开时清理 ZMODEM 状态。

**验证**：真实 lrzsz `rz` 端到端（Go PTY 桥接 + Node 驱动 zmodem.js）：1KB / 200KB / 0 字节文件逐字节一致，rz 打印 "Transfer complete" 并以 code=0 退出；`sz` 下载路径同法验证通过（内容一致、code=0）。前端 `tsc -b && vite build` 通过。另经真实 webterm 服务端 + sshd 全栈 E2E 确认：`rz` 上传 1KB/3MB 内容一致、close 后 shell 提示符正常返回。

## 2026-09-06 sz 下载在 webterm PTY 下 session_end 不触发（待排查，不影响文件完整性）

- **现象**：全栈 E2E 中 `sz` 下载文件内容完整、sz 正常退出（exit=0、提示符返回），但浏览器侧 Receive 会话的 `session_end` 事件不触发 → sentry 不复位，该连接后续新传输的自动检测可能失效（重连可恢复）。直连 PTY（无 webterm）时同一流程 session_end 正常触发。
- **已确认**：浏览器侧 `session.close()` 前的 ZFIN 已正确发出（服务端 stdinPipe 日志可见 `**\x18B0800000000022d\r\n`）；sz 侧 `saybibi()`（lrzsz 0.12.20 lsz.c）只有收到对端 ZFIN 才发 "OO"，超时/ZCAN 则静默退出——流里未见 "OO"，疑似 sz 未收到或未处理我们的 ZFIN，具体卡点未定位。
- **附带发现（zmodem.js 0.1.10 源码 bug）**：`zsession.js` 的 `_stop_keepalive()` 写的是 `this._keep_alive_promise = null`（多了下划线），实际字段是 `_keepalive_promise` —— 停不掉保活计时器的重挂路径，可能产生僵尸 keepalive 周期性发 ZSINIT（E2E 服务端日志已观测到 sz 阶段出现一次来自上一会话的 ZSINIT）。
- **待办**：定位 sz 未响应 ZFIN 的原因（怀疑与 webterm PTY 终端配置/输出处理相关）；评估是否需要在前端 Receive 分支加兜底清理（如 offer 全部完成后主动复位 sentry）。
