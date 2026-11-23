# 宜搭反馈提交

## 收集当前现场

从当前会话复用用户原本想做什么、实际情况、期望结果和复现情况。只追问影响理解的缺口。技术字段未知时省略，不猜测发生次数或根因。

- `type` 使用 `slow`、`error`、`unexpected_result`、`hard_to_use`、`suggestion`。
- `description` 写本次目标和实际发生的情况，`expected` 写期望结果，`reproduction` 写已确认的步骤及频率。
- `title` 可由 Agent 从描述生成。`occurredAt` 已知时使用带时区的 ISO 8601 时间。
- `host`、`channel` 只填出错时已确认的宿主和版本渠道。当前版本与出错版本不同要在描述中说明。
- `commandExecutionId`、`traceId`、`errorCode` 填原失败命令的原生值，每项字符串最多 128 字符。数值错误码只按原值转字符串，不映射或改写。`diagnosticRef` 保留已有 UUID 兼容输入。
- `environment` 可显式提供 `cliVersion`、`nodeVersion`、`platform`、`arch`。只有用户同意附带当前环境时才用 `--include-environment`。报告生成环境不能冒充出错环境。

调用 `feedback submit` 会产生新的执行上下文，不能拿它自己的 ID 补原失败命令的 ID。前序成功步骤和重试仍可帮助还原本次现场。

## 选择日志与截图

选择用户本次搭建相关的日志片段，成功和失败记录均可保留。最多一份日志，最多 512 KiB。允许 UTF-8 文本、JSON、NDJSON 或 gzip，gzip 字节与解压后的文本都不超过 512 KiB。仅从显式文件读取，避免收集整份历史、登录缓存、配置或环境变量。

日志使用已核对的命令类型、时间、版本、执行 ID、Trace ID、耗时、状态与原生错误码。异常摘要可保留异常类名和少量代码栈帧，原始异常消息中出现的表单值、流程内容、请求/响应正文和业务参数必须在生成日志片段前排除。

页面有可见报错、显示异常或卡住时，推荐用户补充截图。最多三张 PNG/JPEG，每张最多 2 MiB，全部证据合计最多 4 MiB。检查将提交的每张图，遮住客户表单值、流程内容和凭证。CLI 凭据检测只检查常见模式，不能替代内容核对。

## 预览与一次确认

Agent 用文件工具生成最多 16 KiB 的反馈 JSON，再选择明确的日志和截图路径。不要把反馈正文拼入 shell 参数或 URL。

```bash
openyida feedback submit --input feedback.json --request-id <UUID> --log selected-log.jsonl --screenshot selected-error.png --preview --json
```

预览不发送网络请求。把反馈描述、期望、复现情况、已选截图与日志片段展示给用户，确认这与当前遇到的情况一致。可以在同一次确认里让用户修改描述或补图。无需向用户解释审阅码。

Agent 保存预览返回的 `reviewDigest`。用户确认后，使用同一请求编号、同一内容、同一账号环境和同一文件提交。

```bash
openyida feedback submit --input feedback.json --request-id <UUID> --log selected-log.jsonl --screenshot selected-error.png --confirm --review-digest <SHA256> --json
```

正文、附件、目标或请求编号变化后重新预览并确认最终内容。提交使用当前登录 session 的 HTTPS origin，JSON `evidence` 每项包含通用文件名、类型和 Base64 内容，完整请求最多 6 MiB。

## 收件结果

- 仅在返回 `status=submitted` 和真实 `feedbackId` 时告知“已提交”，展示反馈编号。
- 返回 202/pending 或网络中断时，说明结果待确认，保留原请求编号、原内容和已确认文件，先核对收件结果。不要自动重发，不生成新编号再次提交。
- 验证明确失败时，根据已知错误指导修正。附件失败时保留原反馈与证据，不静默删除附件改成纯文字提交。
- 登录故障使用 `feedback url` 返回的浏览器入口，保持已整理内容。用户主动选 GitHub 时，按对应参考继续，不把 GitHub 账号作为宜搭反馈前置。
