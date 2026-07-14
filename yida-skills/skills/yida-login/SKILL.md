---
name: yida-login
description: 宜搭登录态管理。默认 OAuth token 模式，access_token / refresh_token 持久化到 .cache/auth-token-<env>.json。适用于首次登录、token 失效或切换环境时获取有效 Bearer token。
---

# 宜搭登录态管理

## 严格禁止 (NEVER DO)

- 不要在代码、文档或命令参数中硬编码 `access_token` / `refresh_token` / Cookie / CSRF 等凭证。
- 不要手动编辑 `.cache/auth-token-<env>.json`，token 必须通过 `openyida login` / `openyida auth refresh` 获取和刷新。
- 不要再引导用户使用旧 Cookie 登录、`--browser`、`--qr`、`--agent-qr`、MCP 组织选择或手写 Cookie 缓存。
- 不要让业务命令携带 Cookie 或 `_csrf_token`；OpenYida CLI 会在请求时自动注入 `Authorization: Bearer <access_token>`。

## 严格要求 (MUST DO)

- 执行任何会访问宜搭的操作前，优先运行 `openyida agent-capabilities --json` 或 `openyida env --json` 确认环境和 token 登录态。
- 未登录或 token 不可用时，执行 `openyida login`；登录后用 `openyida auth status` 或 `openyida login --check-only --json` 验证 `status=ok` / `can_auto_use=true`。
- **本技能不读写 memory**：登录态通过项目工作目录下的 `.cache/auth-token-<env>.json` 持久化，不依赖跨会话 memory。
- 用户提到登录"海外宜搭/国际版/日本宜搭/全球宜搭/Global YiDA"等海外语义时，必须给登录命令加 `--intl`（或 `--global` / `--overseas`），否则会走默认国内登录环境。

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 首次使用或 token 失效 | 其他命令报 401/未登录/token 失效时触发 |
| 切换账号/组织 | 先 `openyida logout` 再重新登录 |
| 切换宜搭环境 | 登录命令带目标 URL、`--endpoint` 或环境 flag |

## 触发条件

**正向触发**：

- 其他命令返回 401 / 未登录 / token 失效 / refresh 失败。
- 用户明确说"登录"、"重新登录"、"换账号登录"。
- 首次使用 openyida，尚无 `.cache/auth-token-<env>.json`。

**不适用场景（不要触发）**：

- 已有有效 token 登录态（先用 `openyida env --json` 或 `openyida auth status` 确认）。
- 只需要刷新 access token 时，优先 `openyida auth refresh`，不要强制重新登录。
- 切换组织时，应先 `openyida logout` 再重新登录到目标组织。

---

> 通常无需手动调用；业务命令会读取本地 token session，并在请求时自动携带 Bearer token。token 不可用时再执行登录。

## 命令

```bash
openyida login
```

当前版本默认就是 token 模式，不需要再加 `--token`。登录流程会打开钉钉 OAuth 授权页，用户在浏览器完成登录后回调到本机 loopback 地址，CLI 用 `code` / `authCode` 向宜搭服务端换取 `access_token` / `refresh_token`，并保存到当前 project 的 `.cache/auth-token-<env>.json`。

若用户明确给出宜搭入口 URL，必须把该 URL 传给登录命令，或使用对应环境 flag；不要退化成裸 `openyida login`：

```bash
openyida login https://yida-group.alibaba-inc.com/
openyida login --alibaba
openyida login --alibaba --endpoint https://www.aliwork.com
```

`https://yida-group.alibaba-inc.com/` 属于阿里内网宜搭，登录态应写入 `auth-token-alibaba.json`；默认公有云环境写入 `auth-token-public.json`。

### Token 状态 / 刷新 / 退出

```bash
openyida auth status
openyida auth refresh
openyida auth logout
```

`auth refresh` 使用本地 `refresh_token` 换取新的 `access_token`，成功后覆盖同一个 token session 文件。业务命令通常会自动刷新，不需要频繁手动执行。

### 海外宜搭 / Global YiDA 登录

海外用户使用 DingTalk International（`login.dingtalk.io`）登录。海外登录必须显式声明环境，否则默认走国内 `login.dingtalk.com`。

**触发条件**（用户表达任意一项即视为海外场景，必须加 `--intl`）：

- 中文：海外、海外版、国际、国际版、全球、全球版、海外宜搭、国际宜搭、全球宜搭、日本、日本宜搭
- 英文：overseas、international、global、abroad、intl、Global YiDA

**推荐流程**：

```bash
openyida env switch intl     # 持久切到 intl，后续命令默认走海外
openyida login --intl        # OAuth token 登录，写入 auth-token-intl.json
openyida app-list            # 验证 API 调通
```

**也支持的命令形式**（任选一种 flag 皆等价）：

```bash
openyida login --intl                  # 推荐写法
openyida login --global                # 别名
openyida login --overseas              # 别名
openyida login --env intl              # 通用 --env 形式
```

`--intl` 标志会在 OAuth 授权时使用 `login.dingtalk.io`。

## 输出

```json
{
  "ok": true,
  "status": "ok",
  "auth_mode": "token",
  "token_type": "Bearer",
  "access_token": "********",
  "expires_at": "2026-07-14T10:30:00.000Z",
  "base_url": "https://www.aliwork.com",
  "corp_id": "dingxxx",
  "user_id": "1955225xxx",
  "user_name": "张三"
}
```

> `base_url` 是后续业务 API 请求的服务端域名；OpenYida 会从 token session 和当前环境配置中解析它。后续所有 API 请求使用 `Authorization: Bearer <access_token>`，CLI 不再发送 Cookie。

## 错误处理

各命令通过响应体和 HTTP 状态自动处理 token 异常：

| 场景 | 含义 | 处理方式 |
|------|------|---------|
| `not_logged_in` / `missing_access_token` | 本地没有可用 access token | 执行 `openyida login` |
| access token 过期 | 短期访问 token 失效 | CLI 优先自动 `auth refresh` |
| refresh token 缺失或过期 | 无法静默续期 | 执行 `openyida login` 重新登录 |
| 401 / 403 / 302 | 服务端未识别当前 Bearer token | 先 `openyida auth refresh`，仍失败则 `openyida login` |

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 浏览器未自动打开 | 复制终端输出的 OAuth URL 到本机浏览器完成登录 |
| 登录后 token 仍无效 | 执行 `openyida auth status` 和 `openyida env --json` 验证环境、base_url 与 token 文件 |
| 反复登录失败 | 停止重试，提示用户联系开发同学 @天晟，不要自主尝试其他登录方案 |
| access token 过期 | 自动刷新；必要时手动执行 `openyida auth refresh` |
| refresh token 过期 | 执行 `openyida login` 重新获取 token |
