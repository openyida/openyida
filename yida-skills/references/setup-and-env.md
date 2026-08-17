# 环境准备与登录检测

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
- 其他 `login.auth_mode=token` 场景使用默认 OAuth token session。
- 不要从 `.cache/cookies*.json` 推断登录态。
- OAuth 浏览器归属以 `builder_path.interactive_login.mode` 为准：`not_required` 不触发 OAuth；`cli_auto_open` 执行 `openyida login`；`caller_open_url` 执行 `openyida login --no-browser`，由 Agent 优先调用沙箱浏览器 / 内置 Browser 打开输出 URL 一次；`unsupported` 停止说明环境没有可用浏览器能力，不要默认安装 Playwright。

## 判断表

| Snapshot | 下一步 |
|---|---|
| command not found | 安装或更新 `openyida`；不要创建资源 |
| `workdir_exists=false` 或 `active.projectRootExists=false` | 先执行 `openyida copy`；工作目录存在前不要创建资源 |
| `auth_mode=token` 且 `status=ok` 或 `can_auto_use=true` | 继续执行 |
| snapshot 返回 `auth_source=env` / `failure_reason=env_token_missing` | 进入运行环境注入 token 模式；缺 token 时停止，让 Codex、yida-agent 等宿主注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN`；不要执行 OAuth |
| `auth_mode=token`，未登录，且 `interactive_login.mode=cli_auto_open` | 只执行一次 `openyida login`，等待该命令结束，并使用其最终 JSON 判断结果 |
| `auth_mode=token`，未登录，且 `interactive_login.mode=caller_open_url` | 只执行一次 `openyida login --no-browser`，由 Agent 优先调用沙箱浏览器 / 内置 Browser 打开输出 URL 一次，并等待原命令结束；无浏览器工具或调用失败时才让用户手动打开 |
| `auth_mode=token`，未登录，且 `interactive_login.mode=unsupported` | 停止并说明当前运行环境没有桌面浏览器或 Agent 浏览器能力 |
| `auth_mode=token`，access token 过期 | 执行 `openyida auth refresh`；仍失败且 snapshot 未返回 env 注入时，再执行 `openyida login` |

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

- `openyida login` 默认自动打开系统浏览器。等待原登录命令结束，不要提取授权 URL 后再次打开。
- `interactive_login.mode=caller_open_url` 时，先执行 `openyida login --no-browser`，再用宿主沙箱浏览器 / 内置 Browser 打开 CLI 输出 URL；不要只把 URL 贴给用户然后等待。只有无浏览器工具或工具调用失败时，才退回手动打开。
- 用户授权可能持续到 OAuth 超时（默认约 5 分钟）。原命令仍运行时，不要固定 `sleep`，也不要重复执行 `login --check-only`。
- 只有原命令成功退出，且最终 JSON 包含 `ok=true` 与 `can_auto_use=true`，才能判定登录成功。
- 用户未授权就关闭浏览器时，CLI 无法可靠感知窗口关闭。继续等待原命令，直到用户停止或命令超时；不要自动发起第二次登录。
- 只有调用方明确接管浏览器时才使用 `openyida login --no-browser`（兼容环境变量：`OPENYIDA_NO_BROWSER=1`），并且只打开一次输出的 URL。
- `--quiet` 只控制文本输出，不会关闭自动打开浏览器。

用户给出目标入口 URL 或环境时，原样传入：

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
