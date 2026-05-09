---
name: yida-create-page
description: 在宜搭应用中创建自定义展示页面（display 类型），返回 formUuid。不适用于：创建带字段的数据收集表单（应使用 yida-create-form-page），或编写页面 JSX 代码（应使用 yida-custom-page），或发布已有页面（应使用 yida-publish-page）。
---
# 创建自定义页面

## 严格禁止 (NEVER DO)

- 不要编造 formUuid，必须从命令返回的 JSON 中提取
- 不要用此命令创建表单页面（带字段的数据收集页），应使用 `yida-create-form-page`

## 严格要求 (MUST DO)

- **创建前必须确认**：执行创建命令前，必须向用户确认页面名称和目标应用，获得用户明确同意后再执行
- 创建成功后，将 formUuid 记录到 `.cache/<项目名>-schema.json`
- 创建页面后，必须继续执行 `yida-custom-page` 编写 JSX 代码，再用 `yida-publish-page` 发布
- **本技能不读写 memory**：formUuid 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户需要创建"自定义展示页面"、"可视化大屏"、"自定义 UI 页面"时使用。

**关键区分**：
- 自定义展示页面（无字段，纯 JSX/React 开发）→ 本技能
- 表单页面（有字段，数据收集）→ `yida-create-form-page`

## 触发条件

**正向触发**：
- "创建自定义展示页面"、"新建可视化大屏"
- "创建自定义 UI 页面"、"新建一个页面"
- 完整应用开发流程中的页面创建步骤（由 `yida-app` 编排调用）

**不适用场景（不要触发）**：
- 创建带字段的数据收集表单 → `yida-create-form-page`
- 编写页面 JSX 代码 → `yida-custom-page`
- 发布已有页面 → `yida-publish-page`

---


## 命令

```bash
openyida create-page <appType> <pageName> [--mode dashboard]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `pageName` | 是 | 页面名称 |
| `--mode dashboard` | 否 | 看板/驾驶舱页面推荐使用；创建后自动隐藏顶部导航，并输出无左侧工作台栏的 `custom/{formUuid}?isRenderNav=false` URL |

## 输出

```json
{"success":true,"pageId":"FORM-XXX","pageName":"驾驶舱","appType":"APP_XXX","mode":"dashboard","chromeless":true,"url":"{base_url}/APP_XXX/custom/FORM-XXX?isRenderNav=false","workbenchUrl":"{base_url}/APP_XXX/workbench/FORM-XXX"}
```

> 创建后使用 `yida-custom-page` 编写 JSX 代码，再用 `openyida publish` 发布。
> 如需创建表单页面（带字段的数据收集页），请使用 `yida-create-form-page`。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败 | 检查 appType 是否正确，确认登录态有效（`openyida env`） |
| 返回 JSON 中无 pageId | 不要猜测 formUuid，重新执行命令获取 |
| 页面名称重复 | 宜搭允许同名页面，但建议使用唯一名称避免混淆 |
