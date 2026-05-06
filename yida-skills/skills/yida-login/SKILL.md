---
name: yida-login
description: 宜搭登录态管理。扫码登录，Cookie 持久化到 .cache/cookies.json。不适用于：已有有效登录态时（先用 openyida env 确认），或切换组织时（应先 logout 再重新登录）。
---

# 宜搭登录态管理

## 严格禁止 (NEVER DO)

- 不要在代码中硬编码 Cookie 或凭证，Cookie 必须通过 `openyida login` 命令获取并缓存到 `.cache/cookies.json`
- 不要在 Cookie 失效时手动修改 `.cache/cookies.json`，必须重新执行登录流程

## 严格要求 (MUST DO)

- 执行任何宜搭操作前，必须先运行 `openyida env` 确认环境和登录态
- Cookie 失效时，重新登录后必须验证新 Cookie 可用（运行任意查询命令确认）
- **本技能不读写 memory**：登录态通过 `.cache/cookies.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 首次使用或 Cookie 失效 | 其他命令报 401/未登录错误时自动触发 |
| 切换账号/组织 | 先 `openyida logout` 再重新登录 |

## 触发条件

**正向触发**：
- 其他命令返回 401 / 未登录 / Cookie 失效错误时自动触发
- 用户明确说"登录"、"重新登录"、"扫码登录"
- 首次使用 openyida，尚无 `.cache/cookies.json`

**不适用场景（不要触发）**：
- 已有有效登录态（先用 `openyida env` 确认）
- 切换组织时（应先 `openyida logout` 再重新登录）

---


> 通常无需手动调用，其他命令在 Cookie 失效时会自动触发登录。

## 命令

```bash
openyida login
```

默认登录路径不需要 Playwright：优先复用缓存；Codex、Qoder、悟空使用内置浏览器 handoff；其他终端环境使用二维码登录。

### 内置浏览器登录模式

在 Codex、Qoder、悟空中不要安装 Playwright，也不要降级成终端二维码接口。没有有效缓存时，登录应使用宿主自带的内置浏览器：

```bash
openyida login --browser
openyida login --codex
openyida login --qoder
openyida login --wukong
```

这些命令返回 `login_url` handoff。收到 handoff 后，用当前宿主的 in-app browser 打开 `login_url`，让用户用钉钉扫码并等待跳转到宜搭工作台。若后续 CLI 仍缺少 `.cache/cookies*.json`，说明当前环境缺少浏览器 Cookie 导出桥接能力，不要手动编造或写入 Cookie。

## 输出

```json
{"csrf_token":"b2a5d192-xxx","corp_id":"dingxxx","user_id":"1955225xxx","base_url":"https://abcd.aliwork.com"}
```

> `base_url` 取自登录后浏览器实际跳转到的域名，可能与 `config.json` 中的 `loginUrl` 不同。后续所有 API 请求使用此值。

## 错误处理

各命令通过响应体 `errorCode` 自动处理登录态异常：

| errorCode | 含义 | 处理方式 |
|-----------|------|---------|
| `TIANSHU_000030` | CSRF Token 过期 | 自动无头刷新 |
| `307` | Cookie 失效 | 自动重新登录 |

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 扫码超时 | 重新执行 `openyida login`，二维码有时效限制 |
| 登录后 Cookie 仍无效 | 检查 `.cache/cookies.json` 是否正确写入，执行 `openyida env` 验证 |
| 反复登录失败 | 停止重试，提示用户联系开发同学 @天晟，不要自主尝试其他登录方案 |
| CSRF Token 过期（TIANSHU_000030） | 自动无头刷新，无需手动干预 |
| Cookie 失效（307） | 自动重新登录，无需手动干预 |
