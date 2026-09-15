# 宜搭本地 Agent 诊断

## 先判断是哪一种模式

两种使用方式不能混为一谈：

1. 用户直接在当前 Codex、Qoder 或 OpenCode 中调用 OpenYida 创建/修改应用：这是
   普通本地模式，没有 yida-agent 控制面和 Go Runtime。执行
   `openyida agent-capabilities --summary-json`，按登录态、组织、工作目录和具体 CLI
   错误排查。
2. 用户先在宜搭网页选择一台电脑和本地 CLI，再由云端会话驱动该 CLI：这是托管
   本地 Agent 模式。电脑/CLI 未出现、设备离线、任务未到达、`local_*` 会话失败均
   执行 `openyida agent diagnose`。

用户不需要知道 `runId`。以下任一信息即可开始：

- 只描述“网页没有找到本地 CLI / 电脑离线”：无参数诊断；
- 粘贴宜搭会话 URL：把完整 URL 原样传给 `--session`；
- 只提供 `local_*` 会话 ID：直接传给 `--session`；
- 什么关联信息都没有：先跑无参数诊断，再根据最近两小时的证据判断。

## 安全、只读的诊断步骤

```bash
openyida agent diagnose --json
openyida agent diagnose --session "<宜搭会话 URL 或 local_ 会话 ID>" --json
```

只有基础结果明确指向 Provider 安装、版本或登录探测问题且仍不足以判断时，才执行：

```bash
openyida agent diagnose --deep --json
```

诊断默认只读。不要自行删除 `~/.openyida`、重新配对、刷新凭据、重启 Runtime、
清空 Journal 或重放业务命令。不要读取、展示或要求用户上传 Credential Store、
`device.json`、执行 Journal、整个 `.openyida` 目录。需要把低敏诊断结果保存给研发时：

```bash
openyida agent diagnose --session "<URL>" --output <用户明确指定的目录> --json
```

## 结果解释

优先根据 `findings[].code` 给出原因和下一步，不猜测：

| code | 含义 | 建议 |
| --- | --- | --- |
| `RUNTIME_NOT_AVAILABLE` | OpenYida 包缺少当前平台 Runtime 或完整性失败 | 安装/更新同一渠道的 OpenYida，再复验 |
| `PROVIDER_NOT_FOUND` | PATH 中未发现 Qoder、Codex、OpenCode | 安装 CLI，或确保启动 OpenYida 的用户环境能找到它 |
| `PROVIDER_PROBE_FAILED` | Provider 存在但版本/登录探测失败 | 在当前终端验证该 CLI 登录与版本，再用 `--deep` 复验 |
| `DEVICE_NOT_PAIRED` | 当前组织还没有这台电脑的有效 Connection | 从宜搭网页生成接入命令，或运行浏览器接入流程 |
| `DEVICE_ACCESS_TOKEN_EXPIRED` | 短期设备 AccessToken 已过期，但 RefreshToken 仍有效 | 启动或恢复该组织的 Runtime，让它按正常链路自动刷新 |
| `DEVICE_CREDENTIAL_EXPIRED` | Connection 存在但设备凭据已经过期 | 为当前组织重新连接，不影响其他组织 Connection |
| `SESSION_NOT_SEEN_LOCALLY` | 本机最近 Journal 中没有该 Session | 继续看 `server.matched`，判断服务端是否投递到这条 Connection |
| `SESSION_NOT_ASSIGNED_TO_CONNECTION` | 会话不属于当前电脑的组织 Connection | 在网页核对组织、电脑和 CLI 选择，不重新配对其他组织 |
| `SERVER_DIAGNOSTIC_UNAVAILABLE` | 本机状态可读，但设备鉴权的服务端关联查询失败 | 检查控制域名网络、设备是否过期；保留诊断 ID |
| `RECENT_DEVICE_CREDENTIAL_REJECTION` | 最近两小时出现过连接/换证响应校验失败，不代表当前仍失败 | 查看 `recentConnectionFailures` 的时间、阶段和原因，再结合当前 Connection 判断 |

连接失败可能发生在创建有效 Connection 之前，因此无参数诊断也会读取安装级的
安全日志，不需要会话链接。`recentConnectionFailures` 最多返回五条低敏历史摘要，
包含稳定错误码 `DEVICE_CREDENTIAL_RESPONSE_INVALID`、`credentialReason` 和本机计算的
access/refresh 剩余秒数，不包含 Token。它不是当前连接在线状态，也不代表某个
会话的错误；指定 `--session` 时不把安装级旧错误归因到该会话。

- `access_expired` / `refresh_expired`：服务端响应的到期时间已经早于本机时间。
  先核对操作系统自动时间同步，再检查是否使用过期接入命令；这只是原因线索，
  不能只凭负剩余秒数就断言服务器时钟错误。不要手工修改 Token 或机器时间来绕过鉴权。
- `protocol_invalid` / `access_format_invalid` / `refresh_format_invalid` /
  `device_invalid` / `version_invalid`：核对 OpenYida 和 Go Runtime 版本、控制域名。
  请求研发按诊断 ID 检查协议，不索要或展示响应中的凭据。
- `rotation_binding_invalid`：换证结果的设备或版本绑定不一致。保留诊断结果，
  不清空状态，不自动重放换证或重新配对，让研发核对换证记录。

客户端不限制设备凭据的最长 TTL；服务端签发时间和服务端鉴权是权威。
若旧版本在刚连接时报告有效期过长而稍后重试成功，应更新 OpenYida/Runtime，
不要让用户通过等待、反复重连或修改本机时间解决。

`server.matched=true` 后再看 `runtimeStatus`、`sessionActive` 和 `latestRun`：

- `runtimeStatus=offline`：连接/心跳问题；
- `runtimeStatus=busy` 且 `latestRun.runId` 不属于目标 Session：该 CLI 正在执行另一轮；
- `startAuthorized=false`：任务已创建但尚未通过启动授权；
- `lastSourceSeq=0`：尚未收到本地流事件；
- 已有 `terminalStatus/errorCode`：按稳定错误码处理，不解析或索要模型输出原文。

`latestRun.errorCode` 的 `agent_error.*` 来自本地 CLI/模型 Provider，不是宜搭
Task Grant 鉴权。不要把这些错误误诊成 OpenYida 普通登录失效或要求重新关联电脑：

| errorCode | 建议 |
| --- | --- |
| `agent_error.provider_auth_or_access` | 在该电脑上检查对应 CLI 的登录账号和所选模型权限；不要打印 API Key 或登录缓存 |
| `agent_error.provider_quota_limit` | 检查该 CLI/模型账号的额度或余额，不重放宜搭写操作 |
| `agent_error.provider_capacity_or_rate_limit` | Provider 限流或容量不足；等待后由用户决定是否重试 |
| `agent_error.provider_network` / `agent_error.provider_server_error` | 检查本机到模型 Provider 的网络或服务状态，保留诊断 ID |
| `agent_error.model_not_found_or_unavailable` | 从网页刷新该 CLI 的模型目录，选择本机账号实际可用的模型 |
| `agent_error.missing_config` | 检查 CLI 自身的 Provider 配置，不修改宜搭 Task Grant 或普通登录态 |
| `agent_error.process_failure` / `agent_error.empty_or_unparseable_output` / `agent_error.unknown` | 核对 CLI 与 Runtime 版本，并按诊断 ID 和本地安全日志定位；不索要 Provider 输出原文 |

## Managed Run 内的边界

若当前进程本身设置了 `OPENYIDA_MANAGED_RUN=1`，不要在该任务中运行 `agent`
管理命令，也不要回退到用户普通 OpenYida 登录态。保留本轮业务命令的错误码，让
Go Runtime 上报终态；用户应在另一个普通本地 Agent 会话中运行上述诊断。
