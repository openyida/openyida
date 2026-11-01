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
5. `--check-only` 仅验证已有状态，不刷新、不发起浏览器登录；`--json` 返回可用状态和无标识的身份类型。显式指定组织或用户约束时，成功额外返回 `target_match=matched`；身份不匹配不能回退到其他身份。
6. 失败 JSON 保留真实错误码，并返回 `retryable=false`、所属阶段和 `nextAction`；需要宿主或用户改变状态后才重新尝试。不通过截断输出或忽略进程退出码判定成功。

成功后 Agent 静默继续业务，只汇报业务结果；不展示用户、组织、认证目录、环境域名或 Token。内部票据与真实凭据不能出现在模型可见的输入、输出或普通诊断日志中。

OAuth 授权完成、凭据持久化和身份校验通过前，不返回登录成功，也不继续创建应用。不启动脱离命令生命周期的后台回调子进程，避免 Windows QXC 在命令结束时清理 Job Object 导致回调失效。

## 运行环境与 Agent 行为

能力摘要在正式包中为已识别的千问桌面端返回 `desktop_ticket`，不依赖历史 beta 开关。`QWENWORK_CLIENT=acp` 仅表示调用协议；具体沙箱 ID、预览或 VNC 信号识别网页沙箱，优先于继承的桌面产品变量。没有沙箱信号时，已知桌面声明优先于通用千问产品标记，兼容历史 `1` / `true` 布尔声明；单独的工作目录或未知 integration mode 不声明 Web/桌面。执行位置与展示客户端分别判断，桌面也可以把命令放在远端执行。

Agent 默认使用当前办公组织，不读取历史 profile 修复宿主身份。显式目标不匹配时保留目标，停止依赖操作，引导宿主支持的组织切换。准备、成功和失败恢复均只留在内部记录；对话仅说明业务进度、结果与必需动作。详细执行规则随包分发于 `yida-skills/references/setup-and-env.md#千问办公任务准备`。

此 CLI 契约不替代客户端的身份快照与认证协调器。业务命令前的统一预检、宿主策略拒绝的结构化终态，以及实际模型消息展示边界仍需要宿主集成和真实会话验证。
