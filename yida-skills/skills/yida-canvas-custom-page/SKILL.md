---
name: yida-canvas-custom-page
description: 新建或修改 Code Canvas 自定义页面，负责页面生成、数据绑定、主题、组件、源码检查和发布。
---

# 宜搭 Code Canvas 自定义页面

## 何时使用

- 新建自定义页面。
- 修改已有 `YidaCodeCanvas` 页面。
- 创建工作台、列表、详情、门户、看板或图表页面。
- 修改已有普通 JSX 页面 → 使用 `yida-custom-page`。
- 把普通 JSX 页面迁移为 Code Canvas → 使用 `yida-canvas-upgrade`。

## 输入

- 完整应用读取 `page-spec.json` 和 `.cache/openyida/<项目名>/scaffolds/canvas.canvas.jsx`。
- 单页任务读取用户要求、当前页面上下文和可用的 `prd.md` / `design.md`。
- `appType`、页面 `formUuid`、表单 `formUuid` 和 `fieldId` 使用 CLI 返回的完整真实值。
- `page-spec.json` 与 PRD/design.md 冲突时，重新派生，不在源码里临时补设计事实。

## 脚手架

OpenYida 提供一份完整脚手架：

```bash
openyida sample yida-canvas-custom-page canvas --output project/pages/src/canvas.canvas.jsx
```

完整应用从项目 Canvas 脚手架扩展；单页任务使用上面的标准脚手架。脚手架内置 13 个 Yida API、主题、表单提交和详情抽屉、URL 构造、实例 ID 校验、iframe 主题同步，以及加载、空数据和错误状态。表单新建、提交和详情在所有设备都使用抽屉，移动端使用全屏抽屉。

## 核心规则

1. 源码使用 `.canvas.jsx` 或 `.canvas.tsx`。
2. `FORM_UUIDS` 和 `FIELDS.<formKey>` 使用 `get-schema --field-map-json` 返回的完整值。
3. 表单、流程、连接器和同源接口的数据接入读取 [数据接入](references/data-bridge-guide.md)。
4. 成员、部门、附件、图片和门户组件读取 [运行时组件](references/native-components-bridge.md)。
5. 完整应用使用项目脚手架和 `page-spec.visualImplementation`；单页设计、设计变更或生成文件冲突时读取 [样式实现](references/canvas-style-implementation-guide.md)。
6. 提交页、详情页和页面跳转读取 [页面入口](references/navigation-and-entry-guide.md)。
7. 用户未明确要求整页跳转时，不得把脚手架的表单抽屉改成 `window.location`、`openPage`、`window.open` 或新标签。
8. JSX 中使用的组件必须有明确的 import 或本地定义。按钮、搜索、快捷入口、可点击卡片和“查看全部”等操作必须绑定会执行动作的事件。
9. 本轮修改源码后，必须成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，才能说明页面已发布。

发布命令会与线上 Schema 精确核对 `appType`、`formUuid` 和 `fieldId`。空值、错位或缺少字符都会阻止发布，并返回可供核对的真实候选值。

## 开发步骤

1. 检查环境和登录状态。
2. 确认或创建目标展示页面，取得页面 `formUuid`。
3. 获取涉及表单的真实字段映射。
4. 完整应用复制项目 Canvas 脚手架并按 `page-spec.json` 实现；单页任务生成标准脚手架并按当前需求实现。
5. 按当前功能读取下方对应 reference。
6. 执行 `openyida publish <source> <appType> <displayPageFormUuid> --health-check`。
7. 回读页面 Schema，确认组件为 `YidaCodeCanvas`，并检查真实页面。

从仓库根执行时使用 `project/pages/src/...`；从 `<workspace>/project` 执行时使用 `pages/src/...`。

## 完成条件

- 发布命令成功。
- Schema 回读中存在 `YidaCodeCanvas`，`runtimeCode` 和 `importedModules` 有效。
- 页面使用真实资源 ID 和真实数据。
- 加载、空数据、错误和移动端状态可用。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [页面生成](references/page-generation-guide.md) | 派生 `page-spec.json`、处理设计变更或生成页面源码时 |
| [数据接入](references/data-bridge-guide.md) | 接入表单、流程、连接器或 HTTP 数据时 |
| [运行时组件](references/native-components-bridge.md) | 使用成员、部门、附件、图片或门户组件时 |
| [成员字段验证](references/employeefield-verification.md) | 验证成员选择组件时 |
| [页面入口](references/navigation-and-entry-guide.md) | 打开提交页、详情页、应用页面或外链时 |
| [样式实现](references/canvas-style-implementation-guide.md) | 单页设计落地或项目视觉配置需要更新时 |
| [源码示例](references/canvas-authoring-examples.md) | 编写组件、hooks、副作用或图表时 |
| [依赖与 CDN](references/dependencies-and-cdn.md) | 添加依赖或外部资源时 |
| [组件选择](references/component-library-guide.md) | 选择 UI 或图表组件时 |
| [旧主题工具](references/theme-runtime-helpers.md) | 维护旧源码的主题同步时 |
