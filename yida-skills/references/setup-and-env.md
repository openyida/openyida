## 千问办公网页态的后台登录

当前快照为 `runtime.tool=qwenwork`、`runtime.subtype=qwenwork_web` 且 `interactive_login.mode=cloud_token` 时，按[云端免登与 OAuth 回退规则](qwenwork-cloud-login.md)执行快照推荐命令并等待；需要授权时按 `oauth_fallback` 打开 CLI 输出的 URL。成功后继续业务，不读取或展示凭据。桌面态继续使用桌面换票。

## 千问办公桌面端

当前快照确认运行于千问办公桌面端时，遵循[后台准备规则](qwenwork-desktop-login.md)，静默完成下述准备，不向用户逐项播报。

# 环境准备与登录检测

按[用户可见表达](user-facing-summary.md)静默完成准备与恢复，只展示业务进度和必需动作。千问办公优先执行[任务准备](#千问办公任务准备)；下方普通本地 profile 和目标 URL 规则不用于绕过宿主身份隔离。

## 千问办公任务准备

千问办公网页端与客户端均执行本规则。对话始终遵循[用户可见表达](user-facing-summary.md)，只展示业务进度、结果和必需的用户动作。

1. 用户未明确指定其他组织时，使用当前千问办公组织，不询问环境、租户、域名或历史账号；不把本机历史组织作为候选。用户明确指定的目标必须保留，不能静默改到个人空间或其他组织。
2. 需求澄清后读取一次完整的 `openyida agent-capabilities --summary-json`。直接消费 JSON，不用 `head`、`tail`、`grep` 或管道截断结果，不用 `|| true` 掩盖退出码。有效登录态直接执行业务命令，不默认追加 env、profiles 或 check-only 查询。
3. 需要补齐时，执行 `builder_path.interactive_login.recommended_command` 一次，等待同一进程结束。CLI 内部处理换票、刷新和允许的 OAuth 回退。按快照指定的浏览器归属打开实际返回的页面一次；仅需用户操作时给一句动作提示，不播报过程。
4. 以命令退出码和最终 `ok=true`、`can_auto_use=true` 共同确认完成，不以 profile 切换成功或浏览器打开作为成功。这只是内部执行判断，禁止输出环境、登录态或当前组织已就绪的提示，也不生成登录/准备待办及工具调用标题；直接继续业务。身份约束未通过时，不继续写入目标应用。
5. 当前组织不能满足显式目标时，通过宿主支持的组织切换完成后继续；宿主没有可用入口时停止依赖操作。不要用普通登录目标域名、手写 env、复制历史 profile 或修改隔离目录绕过宿主。
6. 命令失败、策略拒绝、身份不匹配或 `retryable=false` 时停止本次自动恢复。不要翻查 CLI 源码、安装目录、全局认证文件、历史记忆或环境变量来寻找恢复办法；不要移除宿主变量或换命令形式重试。仅在用户完成所需操作或宿主状态发生明确变化后，开始新一次准备。

`runtime.subtype` 决定宿主执行路径；`acp` 只是传输方式，Agent 不自行推断 Web/桌面。显式 env Token 模式仍由宿主负责注入，不触发 OAuth 或本地 profile 切换。`auth profiles` 的普通本地账号选择规则不适用于千问办公业务搭建。

## 宜搭平台使用权限不足

CLI 明确返回 `YIDA_PLATFORM_ACCESS_REQUIRED` 时，先说明当前组织缺少宜搭使用权限，将 `details.permissionLinkMarkdown` 原样放进回复正文，让“申请宜搭使用授权”本身可点击。旧回执按 [具名链接规则](../skills/yida-create-app/SKILL.md#创建权限不足时的处理) 使用返回的名称和地址组成链接，再暂停业务操作。旧版只返回“未在宜搭授权范围内”或“没有宜搭使用权限”等明确的平台授权提示时，用本次已确认的宜搭服务地址展示同源官方页面 `/defaultPage.html?type=unauth`。地址不明或权限类型不明确时，不猜申请入口。

用户处理授权后可继续原任务。也可由用户明确选择在其他组织测试，再走宿主支持的切换流程。权限拒绝时不重复登录或重试写入。若缺少的是应用创建权限，使用 [应用创建权限申请](../skills/yida-create-app/SKILL.md#创建权限不足时的处理)。

## 先执行

```bash
openyida agent-capabilities --summary-json
```

必要时降级：

```bash
openyida env --json
openyida login --check-only --json
```

## 认证模式

- Codex、yida-agent 等宿主都使用同一套 OpenYida auth snapshot 规则。
- 不要根据 agent 名称、宿主产品、workspace 路径或猜测的环境变量推断认证模式。
- 先执行 `openyida agent-capabilities --summary-json`；只有简版快照不可用或信息不足时，才降级执行 `openyida login --check-only --json`。
- snapshot 返回 `login.auth_source=env` 或 `failure_reason=env_token_missing` 时，进入运行环境注入 token 模式。凭证只来自运行环境注入的 `OPENYIDA_ACCESS_TOKEN`、`OPENYIDA_REFRESH_TOKEN` 等环境变量。
- 千问办公按快照的 `cloud_token` / `desktop_ticket` 使用宿主准备流程；其他非 env 的 `login.auth_mode=token` 场景使用默认 OAuth token session。
- 不要从 `.cache/cookies*.json` 推断登录态。
- OAuth 浏览器归属以 `builder_path.interactive_login.mode` 为准：`not_required` 不触发 OAuth；`cli_auto_open` 执行 `openyida login`；`caller_open_url` 执行 `openyida login --no-browser`，由 Agent 优先调用沙箱浏览器 / 内置 Browser 打开输出 URL 一次；`unsupported` 停止并对用户说明“当前暂时无法继续操作宜搭，请稍后重试”，不要默认安装 Playwright。

## 判断表

| Snapshot | 下一步 |
|---|---|
| command not found | 安装或更新 `openyida`；不要创建资源 |
| `workdir_exists=false` 或 `active.projectRootExists=false` | 先执行 `openyida copy`；工作目录存在前不要创建资源 |
| `auth_mode=token` 且 `status=ok` 或 `can_auto_use=true` | 继续执行 |
| `interactive_login.mode=cloud_token` 且未登录 | 执行推荐的 `openyida login --qwenwork --json` 并等待；免登认证失败由同一进程回退 OAuth，按 `oauth_fallback` 打开授权 URL；成功后继续业务 |
| 千问办公 `interactive_login.mode=desktop_ticket` 且未登录 | 执行快照推荐命令一次并等待；失败后停止依赖操作 |
| 非千问办公 `auth_mode=token` 且 `status=profile_required` | 不猜组织；执行 `openyida auth profiles`，再用 `openyida auth profile switch <auth_profile>` 切换已有 profile |
| snapshot 返回 `auth_source=env` / `failure_reason=env_token_missing` | 进入运行环境注入 token 模式；缺 token 时停止，让 Codex、yida-agent 等宿主注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN`；不要执行 OAuth |
| `auth_mode=token`，未登录，且 `interactive_login.mode=cli_auto_open` | 只执行一次 `openyida login`，等待该命令结束，并使用其最终 JSON 判断结果 |
| `auth_mode=token`，未登录，且 `interactive_login.mode=caller_open_url` | 只执行一次 `openyida login --no-browser`，由 Agent 优先调用沙箱浏览器 / 内置 Browser 打开输出 URL 一次，并等待原命令结束；无浏览器工具或调用失败时才让用户手动打开 |
| `auth_mode=token`，未登录，且 `interactive_login.mode=unsupported` | 停止并对用户说明“当前暂时无法继续操作宜搭，请稍后重试” |
| `auth_mode=token`，access token 过期 | 执行 `openyida auth refresh`；仍失败且 snapshot 未返回 env 注入时，再执行 `openyida login` |

## Token 模式命令

只有 auth snapshot 未返回 env 注入模式时，才使用 OAuth 登录。

```bash
openyida login
openyida login --check-only --json
openyida auth status
openyida auth profiles
openyida auth profile switch <auth_profile>
openyida auth refresh
openyida auth logout
```

非千问办公的多 profile 场景下优先切换已有 profile；目标 profile 不存在时，才执行 `openyida login` 新增登录态，随后重新 `openyida auth profiles` 并切换到新增 profile。

## Agent OAuth 登录编排

- `openyida login` 默认自动打开系统浏览器。等待原登录命令结束，不要提取授权 URL 后再次打开。
- `interactive_login.mode=caller_open_url` 时，先执行 `openyida login --no-browser`，再用宿主沙箱浏览器 / 内置 Browser 打开 CLI 输出 URL；不要只把 URL 贴给用户然后等待。只有无浏览器工具或工具调用失败时，才退回手动打开。
- 用户授权可能持续到 OAuth 超时（默认约 5 分钟）。原命令仍运行时，不要固定 `sleep`，也不要重复执行 `login --check-only`。
- 只有原命令成功退出，且最终 JSON 包含 `ok=true` 与 `can_auto_use=true`，才能判定登录成功。
- 用户未授权就关闭浏览器时，CLI 无法可靠感知窗口关闭。继续等待原命令，直到用户停止或命令超时；不要自动发起第二次登录。
- 只有调用方明确接管浏览器时才使用 `openyida login --no-browser`（兼容环境变量：`OPENYIDA_NO_BROWSER=1`），并且只打开一次输出的 URL。
- `--quiet` 只控制文本输出，不会关闭自动打开浏览器。

非千问办公场景中，用户给出目标入口 URL 或环境时，原样传入；千问办公按任务准备的宿主切换规则处理：

```bash
openyida login https://yida-group.alibaba-inc.com/
openyida login --alibaba
openyida login --intl
```

海外 / international / global / Japan / Global YiDA 使用 `--intl` 或等价入口。

## 运行环境注入 Token 模式命令

只有 auth snapshot 返回 `auth_source=env` 或 `failure_reason=env_token_missing` 后，才进入本模式。

```bash
openyida agent-capabilities --summary-json
openyida env --json
openyida login --check-only --json
openyida auth status
openyida auth refresh
```

可继续执行的结果：

```json
{
  "auth_mode": "token",
  "auth_source": "env",
  "status": "ok",
  "can_auto_use": true
}
```

如果运行环境没有注入 token，snapshot 会返回 `failure_reason=env_token_missing`；停止任务，让 Codex、yida-agent 等宿主补齐 token 注入。snapshot 已进入运行环境注入 token 模式后，不要再执行 `openyida login`。

## 禁止

- snapshot 已进入运行环境注入 token 模式后，不要执行 `openyida login`。
- 不要读取 `.cache/cookies*.json` 作为登录态。
- 不要要求用户导出浏览器 Cookie。
- 不要打印 Cookie、CSRF、`access_token` 或 `refresh_token`。

环境检测后按[本地浏览器验收](execution-rules.md#本地浏览器验收)核对 `builder_path.browser_verification`；验收位置与 OAuth 登录浏览器分别判定。
