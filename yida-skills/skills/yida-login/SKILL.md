---
name: yida-login
description: 宜搭登录态管理。以 OpenYida auth snapshot 为准；默认 OAuth token，snapshot 返回 env 注入状态时使用运行环境注入 token。
---

# yida-login

## 模式

- Codex、yida-agent 等宿主都使用同一套 OpenYida auth snapshot 规则。
- 不要根据 agent 名称、宿主产品、workspace 路径或猜测的环境变量推断认证模式。
- 先读 `openyida agent-capabilities --summary-json`；只有需要更多信息时，才降级执行 `openyida login --check-only --json`。
- snapshot 返回 `login.auth_source=env` 或 `failure_reason=env_token_missing` 时，进入运行环境注入 token 模式。凭证只来自运行环境注入的 `OPENYIDA_ACCESS_TOKEN`、`OPENYIDA_REFRESH_TOKEN` 等环境变量。
- 其他 `auth_mode=token` 场景使用默认 OAuth token session。
- 不要从 `.cache/cookies*.json` 推断登录态。
- 浏览器归属以 `builder_path.interactive_login.mode` 为准：`not_required` 不触发 OAuth；`cli_auto_open` 执行 `openyida login` 并等待；`caller_open_url` 执行 `openyida login --no-browser`，由 Agent 只打开一次 CLI 输出的授权 URL；`unsupported` 停止并说明没有可用浏览器能力，不要默认安装 Playwright。

## 前置检查

先执行：

```bash
openyida agent-capabilities --summary-json
```

必要时降级：

```bash
openyida env --json
openyida login --check-only --json
```

## 判断表

| 状态 | 动作 |
|---|---|
| `auth_mode=token` 且 `status=ok` 或 `can_auto_use=true` | 继续执行业务命令 |
| `auth_source=env` / `failure_reason=env_token_missing` | 进入运行环境注入 token 模式；缺 token 时停止，让 Codex、yida-agent 等宿主注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN`；不要执行 OAuth |
| `auth_mode=token`，未登录，且 `interactive_login.mode=cli_auto_open` | 只执行一次 `openyida login`，等待该命令结束，并使用其最终 JSON 判断结果 |
| `auth_mode=token`，未登录，且 `interactive_login.mode=caller_open_url` | 只执行一次 `openyida login --no-browser`，由 Agent 打开输出的授权 URL 一次，并等待原命令结束 |
| `auth_mode=token`，未登录，且 `interactive_login.mode=unsupported` | 停止并向用户说明当前运行环境没有桌面浏览器或 Agent 浏览器能力 |

## Token 模式命令

只有 auth snapshot 未返回 env 注入模式时，才使用 OAuth 登录。

```bash
openyida login
openyida login --check-only --json
openyida auth status
openyida auth refresh
openyida auth logout
```

## Agent OAuth 登录编排

`interactive_login.mode=cli_auto_open` 的默认流程：

1. 只执行一次 `openyida login`，并持续等待同一个命令。
2. CLI 默认自动打开系统浏览器；Agent 禁止提取授权 URL 后再次打开。
3. 用户授权可能需要较长时间，登录进程默认可等待约 5 分钟。
4. 只有原命令成功退出，且最终 JSON 返回 `ok=true` 与 `can_auto_use=true`，才能判定登录成功。
5. 用户未授权就关闭浏览器时，CLI 无法可靠感知窗口关闭。继续等待原命令，直到用户停止或命令超时；不要自动发起第二次登录。

`interactive_login.mode=caller_open_url` 或调用方必须接管浏览器时，显式关闭 CLI 自动打开：

```bash
openyida login --no-browser
# 兼容写法：
OPENYIDA_NO_BROWSER=1 openyida login
```

只有这种模式下，Agent 才能打开输出的授权 URL，并且只能打开一次。`--quiet` 只控制文本输出，不决定浏览器归属。

`openyida login --check-only --json` 仅用于恢复或防御性验证。不要把固定 `sleep` 或重复执行 `check-only` 当作默认完成机制。

用户给出宜搭入口 URL 时，原样传入：

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

如果运行环境没有注入 token，auth snapshot 会返回 `failure_reason=env_token_missing`；停止任务，让 Codex、yida-agent 等宿主补齐 token 注入，不要触发 OAuth。

## 禁止

- 不要硬编码或打印 `access_token`、`refresh_token`、Cookie 或 CSRF。
- 不要手动读写 `.env`、token 文件或 Cookie 文件。
- 运行环境注入 token 模式下，不要再执行 `openyida login` 触发 OAuth。
- 运行环境注入 token 模式下，缺 token 时让 Codex、yida-agent 等宿主修复注入，不要查找本地 `.cache/cookies*.json`。
- 不要在业务命令里手动传 Cookie、`_csrf_token` 或 Bearer token。
- 默认模式下，不要后台执行 `openyida login`、提取 URL 后再次执行 `open`。
- 不要固定 `sleep` 后再检查登录态。
- 不要仅凭浏览器关闭或 OAuth 回调到达就判定最终登录成功。

## 完成条件

- Login/auth snapshot 返回可用登录态；或
- 运行环境注入 token 模式返回明确停止原因，交由宿主修复。
