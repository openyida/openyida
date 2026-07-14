---
name: yida-logout
description: 退出宜搭登录，清空本地 token session。适用于需要切换账号、切换组织或重置 refresh token 时。
---

# 退出登录

## 严格禁止 (NEVER DO)

- 不要在退出登录后立即执行需要登录态的命令，必须先重新登录
- 不要手动删除或编辑 `.cache/auth-token-<env>.json`，必须通过 `openyida logout` / `openyida auth logout` 清空

## 严格要求 (MUST DO)

- 退出后如需继续使用，必须重新执行 `openyida login` 获取新的登录态
- **本技能不读写 memory**：退出操作仅清空当前环境的 token session，不依赖跨会话的 memory 状态

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 切换账号 | "切换账号"、"换个账号登录" |
| 切换组织 | "切换组织"、当前 token 绑定了错误组织 |
| 重置登录态 | refresh token 缺失、过期或服务端拒绝刷新 |

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
```

清空当前环境的 `.cache/auth-token-<env>.json` token session。下次调用需要鉴权的命令前，需要重新执行 `openyida login`。

**适用场景**：切换账号、切换组织、refresh token 失效无法自动刷新。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| logout 后忘记重新登录 | 执行 `openyida login` 获取新的 token session |
| 手动删除了 auth-token 文件 | 效果等同于 logout，下次需要重新登录 |
| logout 后立即执行需要登录的命令 | 先完成 token 登录后再继续 |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试 |
| auth-token 文件不存在 | 无需处理，说明已处于未登录状态 |
| 文件权限不足 | 提示用户检查 `.cache/` 目录权限 |
| logout 后需要继续操作 | 提示用户执行 `openyida login` 重新登录 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |
