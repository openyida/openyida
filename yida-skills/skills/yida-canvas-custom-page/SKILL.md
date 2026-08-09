---
name: yida-canvas-custom-page
description: 宜搭 Code Canvas / 代码画布自定义页面实现规则。新建自定义页面使用本技能；负责 page-spec 派生、数据绑定、主题落地、运行态组件、源码修复和编译发布校验。
---

# 宜搭 Code Canvas 自定义页面开发

## 核心定位

Code Canvas 是宜搭的代码画布自定义页面链路：用户写标准 React18 函数组件源码，OpenYida 本地编译为 `runtimeCode` + `importedModules`，运行时由 `YidaCodeCanvas` 加载前端资源并执行 `YidaComp`。

页面设计输入来自 `yida-prd` 输出的 `prd.md` 和 `yida-design` 输出的 `design.md`。本技能负责把这两份文件落到 `.canvas.jsx` / `.canvas.tsx`、数据桥、表单入口和发布验收。

本技能负责 Code Canvas 页面实现规则：`page-spec.json` 派生、数据绑定、主题落地、运行态组件、源码修复、编译和发布前校验，都由本技能或本技能明确调用的确定性脚本处理。

OpenYida 只提供一份完整 Canvas 脚手架：`openyida sample yida-canvas-custom-page canvas --output project/pages/src/canvas.canvas.jsx`。这份脚手架预置 13 个 Yida API、主题、表单提交/详情抽屉、URL 构造、实例 ID 校验、iframe 主题同步和基础状态。官网、看板、列表、详情、表单入口等页面都从这份脚手架扩展，不按场景裁剪脚手架。

相较普通 `.oyd.jsx` 自定义页，Code Canvas 更适合：

- 现代 React hooks 交互、图表、动效、复杂状态。
- 首版页面生成：官网、看板、工作台、列表、详情、门户壳。
- 需要 React18 函数组件、状态隔离和现代前端体验的页面。
- 只需要通过 HTTP / 连接器读写数据的页面。
- 需要在 Canvas 内受控接入门户、成员、部门、上传等宜搭运行态组件的页面。

新建自定义页面使用 Code Canvas。`yida-custom-page` 只用于修改已确认的存量普通 JSX/Jsx 页面。

## 使用决策

| 需求 | 推荐做法 |
| --- | --- |
| 官网、看板、工作台、列表、详情、门户壳 | 使用本技能；页面生成规则见 `page-generation-guide.md` |
| 需要开放 API、表单、流程、连接器读写数据 | 使用本技能；数据规则见 `data-bridge-guide.md` |
| 需要门户、成员、部门、附件上传、图片上传 | 使用本技能；组件规则见 `native-components-bridge.md` |
| 需要字段结构、公式、联动、权限、报表、流程 | 使用对应配置型技能完成配置，Canvas 展示结果并分发页面事件 |
| 新建自定义页面 | 使用本技能，写 `.canvas.jsx` / `.canvas.tsx` |
| 需要 Canvas 起步代码 | 使用 `openyida sample yida-canvas-custom-page canvas` 输出 `canvas.canvas.jsx` |
| 修改已有 `YidaCodeCanvas` 页面 | 使用本技能，保留 Canvas 链路 |
| 修改已确认的存量普通 JSX/Jsx 页面 | 使用 `yida-custom-page` |
| 新建页面提到 `this.$`、`this.utils.yida.*` 或 `dataSourceMap` | 使用本技能；改成 Canvas 数据桥、统一 window runtime 或开放 API 方案 |

## 核心规则

1. **Canvas 源码和发布**：源码写 `.canvas.jsx` / `.canvas.tsx`，入口和依赖规则见 `canvas-authoring-examples.md`、`dependencies-and-cdn.md`。
2. **页面事实源**：页面先消费 `prd.md` 与 `design.md`；`page-spec.json` 只是派生产物，详细规则见 `page-generation-guide.md`。
3. **真实数据接入**：表单、流程、连接器和同源接口接入见 `data-bridge-guide.md`；不要用前端 seedRows 冒充真实数据。
4. **运行态组件**：门户、成员、部门、上传等组件见 `native-components-bridge.md` 和 `employeefield-verification.md`。
5. **主题和样式**：`design.md` 到 Canvas 样式的落地见 `canvas-style-implementation-guide.md`；旧源码主题 helper 见 `theme-runtime-helpers.md`。
6. **表单入口**：提交页、详情页、应用内页面和外链跳转见 `navigation-and-entry-guide.md`，新建 Canvas 页面使用脚手架内置的 `FormOpenContainer` 能力。
7. **源码修改发布闭环**：本轮 Write/Edit/Create 了 Canvas 源码后，final 前需要成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`。有 publish 成功证据时表述为“页面已发布”；只有本地校验证据时表述为“Canvas 源码已修改，尚未发布”。

## 开发流程

下面命令从仓库根执行；如果当前 cwd 已经是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。读取生成文件、Schema 或校验产物时优先用当前工具的 Read / Glob / Grep。

```bash
# 1. 只读检查环境、登录态和可用能力；真实创建资源前必须通过
openyida agent-capabilities --summary-json

# 2. 如需新页面，先创建空白自定义页拿 formUuid
openyida create-page <appType> "<页面名>"

# 3. 按 yida-prd 的 prd.md + yida-design 的 design.md 生成或编写 Canvas 源码；结构化实现路径再读取派生 page-spec.json
# 结构化实现路径：先从 prd.md + design.md 派生 page-spec.json，生成可编译骨架后基于 manifest/摘要做小范围 patch。
# 手写路径：已明确最终页面结构、数据桥和样式细节时，直接 Write 最终 .canvas.jsx。

# 4. 本地 Canvas 快检
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/<页面名>.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"

# 5. 发布（本轮修改源码后的远端完成证据）
openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <formUuid>

# 6. 发布后回读字段摘要验收；如需留证，用结构化文件写入工具保存 stdout，不用 shell 重定向
openyida get-schema <appType> <formUuid> --field-map-json
```

`openyida check-page` / `openyida compile` 当前面向普通自定义页面 `.oyd.jsx` / `.jsx`；Canvas 以 `compileCanvasLocal` 和 `openyida publish .canvas.jsx` 的 Canvas 编译阶段为准。`compileCanvasLocal` 是发布前快检，`openyida publish` 是远端写入证据。

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/<页面名或任务名>/<页面名>-schema.json`；从 workspace 根执行后续命令时路径加 `project/` 前缀。

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [page-generation-guide.md](references/page-generation-guide.md) | PRD 到 Canvas 实现入口、官网素材、themeScope、Page Spec、primitives | 写页面前必读 |
| [navigation-and-entry-guide.md](references/navigation-and-entry-guide.md) | 应用内页面、表单、外链和跨应用快捷入口的导航职责与跳转方式；含 `FormOpenContainer` 标准容器 | 工作台/门户含快捷入口、表单新增或详情查看时必读 |
| [native-components-bridge.md](references/native-components-bridge.md) | 门户、成员、部门、上传组件桥接和值归一化 | 需要宜搭运行态组件时必读 |
| [dependencies-and-cdn.md](references/dependencies-and-cdn.md) | 可用前端资源、import 写法、运行时加载方式 | 选择或验证前端资源时必读 |
| [employeefield-verification.md](references/employeefield-verification.md) | 运行时事实、原生组件验证、EmployeeField 验收 | 验证成员/字段组件时阅读 |
| [data-bridge-guide.md](references/data-bridge-guide.md) | Canvas 内自建 HTTP 数据桥 | 接入真实数据时阅读 |
| [canvas-style-implementation-guide.md](references/canvas-style-implementation-guide.md) | 将 `design.md` 的 App 主题色、antd token、背景层、圆角密度、控件焦点/下拉 reset、图表配色落到 Code Canvas | 写样式和主题时阅读 |
| [theme-runtime-helpers.md](references/theme-runtime-helpers.md) | 旧 Canvas 源码 / 普通 JSX 主题 helper，支持父级窗口和表单抽屉同源子文档 | 维护旧源码、普通 JSX 页面或排查历史页面主题问题时阅读 |
| [component-library-guide.md](references/component-library-guide.md) | 组件库推荐组合和页面选型建议 | 选择 UI/图表依赖时阅读 |
| [canvas-authoring-examples.md](references/canvas-authoring-examples.md) | 最小组件、hooks、副作用、图表示例 | 手写 Canvas 代码时阅读 |
