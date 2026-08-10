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

- 完整应用先读薄 `page-spec.json`，再按 `prdRefs` 和 `designRefs` 读取 PRD/design.md 的当前页章节，并使用 `.cache/openyida/<项目名>/scaffolds/canvas.canvas.jsx`。
- 单页任务读取用户要求、当前页面上下文和可用的 `prd.md` / `design.md`。
- `appType`、页面 `formUuid`、表单 `formUuid` 和 `fieldId` 使用 CLI 返回的完整真实值。
- `page-spec.json` 只记录引用、真实资源、数据绑定和源码路径，不复制或概括 PRD/design.md 内容。

## 脚手架

OpenYida 提供一份完整脚手架：

```bash
openyida sample yida-canvas-custom-page canvas --output project/pages/src/canvas.canvas.jsx
```

完整应用从项目 Canvas 脚手架扩展；单页任务使用上面的标准脚手架。脚手架内置 13 个 Yida API，方法名见 [数据接入](references/data-bridge-guide.md)，不要改名或自造方法。主题、表单提交、详情和数据管理抽屉、URL 构造、实例 ID 校验、iframe 主题同步，以及加载、空数据和错误状态也已内置。表单新建、提交、详情和数据管理在所有设备都使用抽屉，移动端使用全屏抽屉。

## 核心规则

1. 源码使用 `.canvas.jsx` 或 `.canvas.tsx`。
2. `FORM_UUIDS` 和 `FIELDS.<formKey>` 使用 `get-schema --field-map-json` 返回的完整值。
3. 表单、流程、连接器和同源接口的数据接入读取 [数据接入](references/data-bridge-guide.md)。
4. 成员、部门、附件、图片和门户组件读取 [运行时组件](references/native-components-bridge.md)。
5. 完整应用使用项目脚手架，并按 `designRefs` 读取 design.md 后执行 [样式实现](references/canvas-style-implementation-guide.md)。
6. 提交页、详情页、数据管理页和页面跳转读取 [页面入口](references/navigation-and-entry-guide.md)。数据管理抽屉使用 `workbench/{formUuid}?hideLeftNav=true&corpid={corpId}`，不得显示平台左侧导航。
7. 用户未明确要求整页跳转时，不得把脚手架的表单抽屉改成 `window.location`、`openPage`、`window.open` 或新标签。
8. `searchFormDatas` 返回行的字段值只从 `row.formData[fieldId]` 读。使用脚手架的 `fieldOf(row, fieldId)`；不要写 `row[fieldId]`、`item[FIELDS.xxx]` 或 `apt[FIELDS.xxx]`。
9. JSX 中使用的组件必须有明确的 import 或本地定义。按钮、搜索、筛选、Tab、分页、菜单、链接、快捷入口、可点击卡片和“查看全部”等可操作外观必须绑定真实事件；暂不实现就改成禁用态或静态文本。
10. React Hooks、自定义 Hooks、`antd` 和 `@ant-design/icons` 都可用。包依赖使用标准 import；Ant Design 图标使用该包真实导出的 `*Outlined`、`*Filled` 或 `*TwoTone` 名称，不混用 `lucide-react` 图标名。
11. 本地执行 `openyida check-page <source> --json` 或 `openyida compile <source> --json`；`.canvas.jsx` / `.canvas.tsx` 会自动使用 Canvas 编译器。
12. 不直接调用普通 JSX 的 compatibility compiler、`page-compiler` 或 `build-page`。本地检查结果必须包含 `mode: "canvas"`；出现 `OPENYIDA_PAGE_COMPILER_MISMATCH` 时先改命令或文件后缀，不按普通 JSX 错误修改 Hooks、import 和默认导出。
13. 本轮修改源码后，必须成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，才能说明页面已发布。

发布命令会与线上 Schema 精确核对 `appType`、`formUuid` 和 `fieldId`。空值、错位或缺少字符都会阻止发布，并返回可供核对的真实候选值。

## 开发步骤

1. 检查环境和登录状态。
2. 确认或创建目标展示页面，取得页面 `formUuid`。
3. 获取涉及表单的真实字段映射。
4. 完整应用写入薄 page-spec，复制项目 Canvas 脚手架，按 `prdRefs` 和 `designRefs` 读取原文后实现；单页任务生成标准脚手架并按当前需求实现。
5. 按当前功能读取下方对应 reference。
6. 执行 `openyida compile <source> --json`，修复全部 Canvas 编译错误。
7. 执行 `openyida publish <source> <appType> <displayPageFormUuid> --health-check`。
8. 回读页面 Schema，确认组件为 `YidaCodeCanvas`，并检查真实页面。

从仓库根执行时使用 `project/pages/src/...`；从 `<workspace>/project` 执行时使用 `pages/src/...`。

## 完成条件

- 发布命令成功。
- 本地检查返回 `mode: "canvas"`。
- Schema 回读中存在 `YidaCodeCanvas`，`runtimeCode` 和 `importedModules` 有效。
- 页面使用真实资源 ID 和真实数据。
- 加载、空数据、错误和移动端状态可用。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [页面生成](references/page-generation-guide.md) | 写 page-spec、读取 PRD/design.md 引用或生成页面源码时 |
| [数据接入](references/data-bridge-guide.md) | 接入表单、流程、连接器或 HTTP 数据时 |
| [运行时组件](references/native-components-bridge.md) | 使用成员、部门、附件、图片或门户组件时 |
| [成员字段验证](references/employeefield-verification.md) | 验证成员选择组件时 |
| [页面入口](references/navigation-and-entry-guide.md) | 打开提交页、详情页、应用页面或外链时 |
| [样式实现](references/canvas-style-implementation-guide.md) | 单页设计落地或项目视觉配置需要更新时 |
| [源码示例](references/canvas-authoring-examples.md) | 编写组件、hooks、副作用或图表时 |
| [依赖与 CDN](references/dependencies-and-cdn.md) | 添加依赖或外部资源时 |
| [组件选择](references/component-library-guide.md) | 选择 UI 或图表组件时 |
| [旧主题工具](references/theme-runtime-helpers.md) | 维护旧源码的主题同步时 |
