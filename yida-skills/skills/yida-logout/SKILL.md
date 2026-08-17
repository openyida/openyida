---
name: yida-logout
description: 退出宜搭登录或解绑当前项目登录态。默认只解绑当前项目 profile pointer；显式传 --profile 或 --all 才删除共享登录 profile。
---

# 退出登录

## 严格禁止 (NEVER DO)

- 不要把默认 `openyida logout` 当成删除共享登录态；它只解绑当前项目 profile pointer，并清当前项目 legacy token
- 不要在目标 profile 已存在时要求用户重新 OAuth 登录；应先执行 `openyida auth profile switch <auth_profile>`
- 不要手动删除或编辑 `.cache/auth-token-<env>.json`、`.cache/openyida/auth-profile-<env>.json` 或用户 auth profile 文件
- 运行环境注入 token 模式下，不要尝试写入或删除本地 user profile

## 严格要求 (MUST DO)

- 默认退出后如需继续使用，先执行 `openyida auth status` / `openyida auth profiles`，优先切换已有 profile
- 只有目标 profile 不存在时，才执行 `openyida login` 新增登录态
- 删除共享 profile 必须显式使用 `openyida auth logout --profile <auth_profile>` 或 `openyida auth logout --all`
- **本技能不读写 memory**：退出操作仅清空当前环境的 token session，不依赖跨会话的 memory 状态

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 解绑当前项目 | "退出登录"、当前项目绑定了错误 profile |
| 切换账号 | "切换账号"、"换个账号登录"，且已有目标 profile 可切换 |
| 切换组织 | "切换组织"、当前 token 绑定了错误组织，且已有目标 profile 可切换 |
| 重置登录态 | refresh token 缺失、过期或服务端拒绝刷新 |
| 删除共享 profile | 用户明确要求删除某个 profile 或清空全部本地共享登录态 |

## 触发条件

**正向触发**：
- "切换账号"、"换个账号登录"、"退出登录"
- "切换组织"、"换个组织"
- refresh token 失效且无法自动刷新，需要重置登录态

**不适用场景（不要触发）**：
- 仅需刷新 access token（优先 `openyida auth refresh`）
- 登录态正常但命令失败（先排查其他原因）

---


## 命令

```bash
openyida logout
openyida auth profiles
openyida auth profile switch <auth_profile>
openyida auth logout --profile <auth_profile>
openyida auth logout --all
```

`openyida logout` / `openyida auth logout` 默认只解绑当前项目的 profile pointer，并清当前项目 legacy token；不会删除用户级共享 profile。

**适用场景**：解绑当前项目、切换到已有 profile、显式删除共享 profile、refresh token 失效无法自动刷新。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| logout 后仍需继续操作 | 执行 `openyida auth profiles`，优先 `openyida auth profile switch <auth_profile>` |
| 目标 profile 不存在 | 执行 `openyida login` 新增登录态，再切到新增 profile |
| 手动删除了 auth-token 文件 | 执行 `openyida auth status` 检查状态，不要继续手动删 profile |
| logout 后立即执行需要登录的命令 | 先确认 `openyida auth status` 返回可用登录态 |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试 |
| auth-token 文件不存在 | 无需处理；默认 logout 仍会尝试解绑 project pointer |
| 文件权限不足 | 提示用户检查 `.cache/` 目录权限 |
| logout 后需要继续操作 | 提示用户先 `openyida auth profiles` 并切换已有 profile；目标不存在时再 `openyida login` |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |
