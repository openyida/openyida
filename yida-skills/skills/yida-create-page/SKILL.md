---
name: yida-create-page
description: 创建自定义展示页面（display 类型）并返回 formUuid；仅当目标 page 缺失且用户意图允许新增页面时使用。
---
# 创建自定义页面

> 资源边界：本技能只处理普通 OpenYida 页面创建；目标不明时先只读确认或询问用户。

## Resource-First 使用门槛

本技能只负责创建缺失的 display page，不负责优化、修改或重新发布已有页面。执行前必须已经解析 resource context：

- 如果本轮用户给了页面 URL、`formUuid`、bound page，或 workspace cache/config 中已有目标 display page，禁止调用 `openyida create-page`；直接进入 `yida-custom-page` / `yida-canvas-custom-page` 编写或修改源码，再用 `yida-publish-page` 发布到该页面。
- 如果用户给的是普通表单 `formUuid` 且诉求是改字段结构，改用 `yida-create-form-page`；不要把表单 ID 当作自定义页面创建目标。
- 只有目标 app 已明确、目标 display page 缺失，并且用户意图允许新增页面（例如“在 APP_xxx 里增加回访页面”）时，才加载并执行本技能。
- 多个已有页面候选按根技能来源优先级选择；同级冲突或无法判断主页面时才问用户。

## 严格禁止 (NEVER DO)

- 不要编造 formUuid，必须从命令返回的 JSON 中提取
- 不要用此命令创建表单页面（带字段的数据收集页），应使用 `yida-create-form-page`
- 已有页面 URL / `formUuid` / bound page 时，不要创建新页面；除非用户明确要求新增另一个页面并确认。

## 严格要求 (MUST DO)

- **创建前必须确认**：单点创建页面时，执行创建命令前必须向用户确认页面名称和目标应用。由 `yida-app fast_build` 编排且用户已说“默认方案 / 不要追问 / 直接创建”时，合理命名并直接创建，不再二次追问。
- 创建成功后，将 formUuid 记录到 `.cache/<项目名>-schema.json`
- 由 `yida-app fast_build` 编排的首页/工作台/智能助手/门户门面页，可以先于业务表单创建；先占位记录 `formUuid`，待表单 ID 明确后再写源码并发布。
- 创建页面后，必须继续选择一个页面实现链路编写页面源码，再用 `yida-publish-page` 发布：Code Canvas 链路用 `yida-canvas-custom-page`；普通自定义页面 JSX/Jsx 组件链路用 `yida-custom-page`
- 用户明确要求 JSX / Jsx 组件 / 普通自定义页，或页面强依赖 `this.$`、`this.utils.yida.*`、`this.dataSourceMap` 时，创建后进入 `yida-custom-page`；涉及成员、部门、附件上传或图片上传时必须读取 `component-jsx-guide.md`，上传还必须读取 `attachment-upload-guide.md`
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

> 创建后根据用户意图选择并列链路：Code Canvas 链路编写 `.canvas.jsx` 并发布为 `YidaCodeCanvas`；普通自定义页面 JSX/Jsx 组件链路编写 `.oyd.jsx` / `.jsx`，发布为平台 `Jsx` 组件，并执行 `openyida check-page` / `openyida compile` / `openyida publish`。
> 如果用户说的是 JSX/Jsx 组件，按 `yida-custom-page` 处理：成员/部门选择器不得编造未验证平台组件；附件/图片上传必须验证 OSS 签名、权限、预览和失败提示。
> 如需创建表单页面（带字段的数据收集页），请使用 `yida-create-form-page`。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败 | 检查 appType 是否正确，确认登录态有效（`openyida env`） |
| 返回 JSON 中无 pageId | 不要猜测 formUuid，重新执行命令获取 |
| 页面名称重复 | 宜搭允许同名页面，但建议使用唯一名称避免混淆 |
