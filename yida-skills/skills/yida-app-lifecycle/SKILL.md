---
name: yida-app-lifecycle
description: 宜搭应用启用与停用。仅当用户明确要求启用、停用、上线或下线某个已有应用时使用；不用于创建应用、发布页面或发布到钉钉应用中心。
---

# 宜搭应用启用与停用

## 严格要求 (MUST DO)

- 只有用户明确说“启用应用 / 上线应用 / 停用应用 / 下线应用”时，才允许调用本技能的远程写命令；不得从“发布页面”“更新应用”“应用不可用”等间接描述推断执行。
- 执行前必须确认唯一的 `appType` 和当前登录组织；目标不明确时先询问用户。
- `app-offline` 会让现有应用停止服务，执行前必须向用户展示目标 `appType` 与完整命令并获得确认。
- 默认保持 `isToDingAppCenter=n`、`showAppCenter=n`。只有用户明确要求同步钉钉应用中心或显示应用中心时，才添加对应开关。
- 命令失败后完整展示错误并停止；不得无修改连续重试，也不得改用浏览器抓包中的 Cookie、token 或 `sec-*` header 绕过认证。

## 严格禁止 (NEVER DO)

- 不得把首次创建应用、表单/页面发布、应用信息更新自动升级为应用启用。
- 不得把“暂时隐藏页面”“禁用集成自动化”“关闭公开访问”路由为应用停用。
- 不得在测试、评测或默认 shared real E2E 中执行真实启用/停用。
- 不得把本能力扩展为钉钉应用中心完整发布流程。

## 意图与命令

启用或上线已有应用：

```bash
openyida app-online <appType>
```

停用或下线已有应用（需确认）：

```bash
openyida app-offline <appType>
```

仅在用户明确要求应用中心相关行为时使用：

```bash
openyida app-online <appType> --to-ding-app-center --show-app-center
openyida app-offline <appType> --to-ding-app-center --show-app-center
```

## 完成条件

- CLI 返回 `success: true`，且返回的 `action` 与用户意图一致。
- 向用户说明目标 `appType` 已启用或已停用；失败时不得宣称状态已改变。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 缺少或存在多个 appType 候选 | 停止并要求用户确认唯一目标 |
| 登录态失效 / 组织不符 | 重新登录或切换到目标组织后再执行 |
| 权限不足 | 停止并提示使用具备应用管理权限的账号 |
| 平台返回 `success: false` 或 `content: false` | 展示 `errorMsg` / `errorCode`，不得重试或宣称成功 |
