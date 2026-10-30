# 千问办公桌面登录

面向 Agent 的公开命令为 `openyida login --qwenwork [--json]`。客户端先完成内部登录准备，公开命令仍真实执行，以服务端状态确认是否可用并返回退出码。普通 `openyida login` 保留原 OAuth 行为。

## 客户端与 CLI 分工

在配置启用且本轮执行环境为 local 或 QXC 时，客户端识别公开命令，在执行授权通过后，使用当前千问身份向可信 HTTPS origin 的 `/openapi/cli/v1/auth/qwenwork/desktop/token` 请求短期一次性兑换票。VM 不接入这条桌面链路。

客户端通过内部进程调用以下命令，参数不进入模型工具输入、审批或会话记录：

```text
openyida login-qwenwork --exchange-ticket <ONE_TIME_TICKET> --ticket-context <JSON_CONTEXT> --json
```

票据上下文包含 expires_at、base_url、corp_id、user_id、exchange_id，均来自可信签票结果。这里的命令和字段仅供客户端集成，Agent 不生成票据。旧环境交付保留兼容读取，新客户端不注入票据环境变量。

内部 CLI 消费 `/openapi/cli/v1/auth/qwenwork/desktop/consume`，回查同源 `/openapi/cli/v1/auth/status`，持久化 access token 和 refresh token，再回读确认写入。票据最长 300 秒且仅消费一次，真实登录态按宜搭普通双 Token 生命周期管理。

客户端等待内部命令成功，再继续执行原 `login --qwenwork`。两个进程必须使用相同 CLI、工作目录、执行环境和认证目录。QXC 的内部调用仍在同一沙箱策略中，本地调用使用当前 Turn 的环境快照。取消、身份变化或准备失败不放行旧调用。

## 公开命令行为

1. 回查已有登录态；服务端确认有效时静默成功。
2. access token 失效或缺失时，尝试 refresh token，并验证刷新后的身份。
3. 没有可用登录态或 refresh token 明确失效时，复用普通 `openyida login` 的前台 OAuth：自动尝试打开浏览器，在当前进程内接收回调、保存登录态并返回结果；`--no-browser` 交由调用方打开链接。
4. 网络故障、身份不一致、配置冲突不会被伪装成未登录并触发浏览器。
5. `--check-only` 不发起浏览器登录；成功时默认无输出，`--json` 只返回 `{"ok":true,"status":"ok","can_auto_use":true}`。

成功后 Agent 静默继续业务，只汇报业务结果；不展示用户、组织、认证目录、环境域名或 Token。内部票据与真实凭据不能出现在模型可见的输入、输出或普通诊断日志中。

OAuth 授权完成、凭据持久化和身份校验通过前，不返回登录成功，也不继续创建应用。不启动脱离命令生命周期的后台回调子进程，避免 Windows QXC 在命令结束时清理 Job Object 导致回调失效。
