---
name: yida-create-page
description: 创建自定义展示页面（display 类型）并返回 formUuid；仅当目标 page 缺失且用户意图允许新增页面时使用。
---
# 创建自定义页面

> 资源边界：本技能只处理普通 OpenYida 页面创建；目标不明时先只读确认或询问用户。

## Resource-First 使用门槛

本技能只负责创建缺失的 display page，不负责优化、修改或重新发布已有页面。执行前必须已经解析 resource context：

- 如果本轮用户给了页面 URL、`formUuid`、bound page，或 workspace cache/config 中已有目标 display page，禁止调用 `openyida create-page`；改由 `yida-canvas-custom-page` 编写页面源码，再由 `yida-publish-page` 发布。已确认是历史平台 JSX 组件页面维护时，不由本技能创建或派发，改走根路由的“JSX 自定义页面开发”入口。
- 如果用户给的是普通表单 `formUuid` 且诉求是改字段结构，改用 `yida-create-form-page`；不要把表单 ID 当作自定义页面创建目标。
- 只有目标 app 已明确、目标 display page 缺失，并且用户意图允许新增页面（例如“在 APP_xxx 里增加回访页面”）时，才加载并执行本技能。
- 多个已有页面候选按根技能来源优先级选择；同级冲突或无法判断主页面时才问用户。

## 严格禁止 (NEVER DO)

- 不要编造 formUuid，必须从命令返回的 JSON 中提取
- 不要用此命令创建表单页面（带字段的数据收集页），应使用 `yida-create-form-page`
- 已有页面 URL / `formUuid` / bound page 时，不要创建新页面；除非用户明确要求新增另一个页面并确认。

## 严格要求 (MUST DO)

- **创建前必须确认**：单点创建页面时，执行创建命令前必须向用户确认页面名称和目标应用。由 `yida-app` 完整应用统一编排且用户已说“默认方案 / 不要追问 / 直接创建”时，合理命名并直接创建，不再二次追问。
- 创建成功后，将 formUuid 记录到 `.cache/<项目名>-schema.json`
- 由 `yida-app` 完整应用统一编排的首页/工作台/智能助手/门户门面页，可以先于业务表单创建；先占位记录 `formUuid`，待表单 ID 明确后再写源码并发布。
- 创建成功后，将真实 `formUuid` 交给 `yida-canvas-custom-page` 编写页面源码，再交给 `yida-publish-page` 发布；本技能不使用 `yida-custom-page` 处理新建页面。
- **本技能不读写 memory**：formUuid 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户需要创建"自定义展示页面"、"可视化大屏"、"自定义 UI 页面"，且 resource context 未解析到目标页面时使用。

**关键区分**：
- 自定义展示页面（无字段，纯 JSX/React 开发）→ 本技能
- 表单页面（有字段，数据收集）→ `yida-create-form-page`

## 触发条件

**正向触发**：
- "创建自定义展示页面"、"新建可视化大屏"
- "创建自定义 UI 页面"、"新建一个页面"
- 完整应用开发流程中主页面缺失且允许创建的页面创建步骤（由 `yida-app` 编排调用）

---


## 命令

```bash
openyida create-page <appType> <pageName> [--mode dashboard] [--hide-nav]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `pageName` | 是 | 页面名称 |
| `--mode dashboard` | 否 | 看板/驾驶舱页面推荐使用；只表达页面模式，不会自动隐藏导航 |
| `--hide-nav` | 否 | 仅当用户显式要求隐藏导航 / 无导航 / 全屏无框时使用；创建后隐藏顶部导航，并输出无左侧工作台栏的 `custom/{formUuid}?isRenderNav=false` URL |

默认生成页面导航可见；仅说“看板 / 驾驶舱 / 首页 / 门户 / 工作台”不等于隐藏导航。

## 输出

```json
{"success":true,"pageId":"FORM-XXX","pageName":"驾驶舱","appType":"APP_XXX","mode":"dashboard","hideNav":false,"chromeless":false,"url":"{base_url}/APP_XXX/workbench/FORM-XXX","workbenchUrl":"{base_url}/APP_XXX/workbench/FORM-XXX"}
```

> 如需创建表单页面（带字段的数据收集页），请使用 `yida-create-form-page`。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败 | 检查 appType 是否正确，确认登录态有效（`openyida env`） |
| 返回 JSON 中无 pageId | 不要猜测 formUuid，重新执行命令获取 |
| 页面名称重复 | 宜搭允许同名页面，但建议使用唯一名称避免混淆 |
