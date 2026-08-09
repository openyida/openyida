---
name: yida-custom-page
description: 修改已有普通 JSX 自定义页面。新建自定义页面使用 yida-canvas-custom-page。
---

# 宜搭普通 JSX 页面维护

## 何时使用

- 目标页面已确认使用 `Jsx`、`renderJsx`、`.oyd.jsx` 或 `.jsx`。
- 目标是 `YidaCodeCanvas` → 使用 `yida-canvas-custom-page`。
- 新建自定义页面 → 使用 `yida-canvas-custom-page`。
- 旧页面迁移到 Code Canvas → 使用 `yida-canvas-upgrade`。

## 写代码前

1. 确认目标 `appType` 和展示页面 `formUuid`。
2. 读取页面 Schema 或现有源码，确认页面确实是普通 JSX。
3. 用户本轮指定的页面与已绑定页面不同时，以本轮指定页面为准。
4. 数据表单 `formUuid` 只能用于数据或链接，不能作为页面发布目标。

## 核心规则

1. 源码使用 `.oyd.jsx` 或 `.jsx`。
2. 普通页面函数、状态、事件、URL 和 `FormOpenContainer` 读取 [编码规则](references/coding-guide.md)。
3. 表单控件、成员、附件和表格读取 [组件规则](references/component-jsx-guide.md)。
4. 样式读取 [样式规则](references/design-system.md)，素材读取 [素材规则](references/assets-guide.md)。
5. 只有本轮已通过 `yida-data-source-connectors` 创建并绑定数据源时，才能新增 `this.dataSourceMap.<name>.load()`。
6. 修改后依次执行 `check-page`、`compile` 和 `publish`。

## 命令

```bash
openyida check-page project/pages/src/<page>.oyd.jsx
openyida compile project/pages/src/<page>.oyd.jsx
openyida publish project/pages/src/<page>.oyd.jsx <appType> <displayPageFormUuid>
```

从仓库根执行时使用 `project/pages/src/...`；从 `<workspace>/project` 执行时使用 `pages/src/...`。

## 完成条件

- `check-page` 和 `compile` 成功。
- `openyida publish <source> <appType> <displayPageFormUuid>` 成功。
- 只有本地检查而没有发布成功时，最终回复写“源码已修改，尚未发布”。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [编码规则](references/coding-guide.md) | 修改普通 JSX、状态、事件、URL 或表单入口时 |
| [运行时检查](references/runtime-guardrails.md) | 排查编译或运行错误时 |
| [组件规则](references/component-jsx-guide.md) | 使用输入、日期、成员、附件或表格组件时 |
| [样式规则](references/design-system.md) | 实现 `design.md` 视觉要求时 |
| [素材规则](references/assets-guide.md) | 使用图标和图片时 |
| [附件上传](references/attachment-upload-guide.md) | 修改附件上传时 |
| [宜搭 API](../../references/yida-api.md) | 核对 API 参数时 |
