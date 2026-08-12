# 已知问题记录

## 2026-08-13 ZMODEM `rz` 上传卡住（待排查）

- **现象**：远端执行 `rz` 后终端提示“按 Enter 选择要上传的文件”，按 Enter 能正常打开系统文件选择框；但**选择文件之后上传卡住**，没有进度、没有完成，会话挂起。
- **已确认正常**：ZMODEM 握手能检测并进入会话；按 Enter 弹文件选择框（用户手势）有效；`sz` 下载流程尚未端到端验证（待测）。
- **排查线索**：
  1. 选文件后走 `Zmodem.Browser.send_files(session, files)`，卡住位置待定位 —— 先确认 send_files 是否发出 ZRINIT/ZFILE/ZDATA，远端 `rz` 是否收到。
  2. 二进制上行通道：文件数据经 base64 JSON（`{b64:true}`）发给服务端，服务端解码后写入 PTY —— 检查大帧是否被 PTY/驱动截断或乱序，建议在 `wsWriter`、HandleSSH 的 stdin 写入、前端 sender 三处加日志。
  3. 之前重复 ZRQINIT 会让 consume 抛 “Unhandled header: ZRINIT”，已改为吞掉；需确认吞掉异常后会话状态是否仍然可用。
  4. 浏览器端 zmodem.js 的 `sender` 回调是否持续触发、分帧大小是否异常。
- **待办**：用真实 SSH + lrzsz 端到端复现，逐步加日志定位卡在哪一段（前端 send_files → WebSocket → 服务端解码 → PTY → rz）。
