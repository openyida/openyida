---
name: yida-canvas-upgrade
description: 把已有普通 JSX 自定义页面迁移为 Code Canvas 页面。
---

# OpenYida 普通页面升级到 Code Canvas

## 核心定位

本技能把已有 OpenYida 普通自定义页面转换为 Code Canvas 页面，输出等价的 React18 函数组件源码并发布为 `YidaCodeCanvas`。

- 原页面：通常使用 `project/pages/src/*.oyd.jsx`、`export function renderJsx()`、`_customState` 和 `this.utils.yida.*`，发布后是 `Jsx` 组件。
- 目标页面：Schema 使用 `YidaCodeCanvas` 组件，包含 `code`、`runtimeCode` 和 `importedModules`，运行时执行 `YidaComp`。

## 迁移前必须确认

| 检查项 | 命令 / 做法 |
| --- | --- |
| 登录态只读验证 | `openyida env --json` + `openyida login --check-only --json` |
| 原页面源码 | 找到 `.oyd.jsx` / `.jsx` 源文件；不要只看 dist 编译产物 |
| 目标页面 Schema | 先执行 `openyida get-schema <appType> <formUuid>`，再用 create_file / Write / file edit tool 按需保存到 `<projectRoot>/.cache/openyida/canvas-upgrade/<name>-schema.json`；不要用 shell 重定向 |
| Code Canvas 发布 | `.canvas.jsx` 使用 `openyida publish <源文件> <appType> <formUuid>`，CLI 自动编译并写入 `YidaCodeCanvas` Schema |
| 原页面数据依赖 | 列出 `this.utils.yida.*`、`this.dataSourceMap.*`、连接器、外部脚本、全局变量 |

`openyida publish` 已能把 `.canvas.jsx` 发布为 `YidaCodeCanvas` 页面；升级的主要工作是把普通页面的 `this.utils.yida.*` / `dataSourceMap` 改写为统一 window runtime、dataBinding、连接器或 HTTP 数据桥。改写受阻、无法保证等价时，只交付源码草案和迁移报告，不要声称已完成升级。

## 可迁移性分级

| 原页面能力 | 迁移建议 |
| --- | --- |
| 纯展示 UI、静态数据、轻交互 | 可直接迁为 `YidaComp` 函数组件 |
| 普通 React 状态 / `_customState` | 改为 `useState` / `useMemo` / `useEffect` |
| `didMount` / `didUnmount` | 改为 `useEffect(() => { ...; return cleanup; }, [])` |
| ECharts / d3 / recharts | 优先使用 Code Canvas 依赖白名单；不在白名单则先补依赖或降级 |
| `this.utils.yida.*` 表单 API | 改为统一 window runtime 的 `runtime.yida` |
| `this.dataSourceMap.*` | 改为 dataBinding、连接器代理或 HTTP 数据桥 |
| `this.utils.toast/dialog/router` | 改为 antd Message/Modal 或由 props 注入的能力；需验证 |
| 字段组件如 `EmployeeField` | 按 `yida-canvas-custom-page` 的依赖映射规则先做最小验证 |
| `openyida publish` | 仍是最终发布方式：普通自定义页面源码发 `Jsx` 页面，`.canvas.jsx` 源码（或加 `--canvas`）发 `YidaCodeCanvas` 页面。迁移就是把源码改写成 `.canvas.jsx` 后重新 `publish` |

## 输出产物位置

- 可维护的 Code Canvas 源码放在 `project/pages/src/<页面名>.canvas.jsx`。
- 分析记录、Schema 回读、编译返回值和依赖清单放在 `.cache/openyida/canvas-upgrade/`。
- 不要把一次性 `runtimeCode`、接口抓包、调试 JSON 放到仓库根目录。

## 迁移步骤

1. **盘点原页面**
   - 读取源文件，不从 `project/pages/dist/*.js` 反推。
   - 列出导出的函数、顶层常量、`_customState` 字段、生命周期、API 调用、第三方脚本。
   - 标记依赖 `this` 的能力：`this.utils`、`this.dataSourceMap`、`this.state`、`this.setState`。

2. **判断是否能自动升级**
   - 如果页面主要是 UI + 本地状态 + 白名单图表库，可以继续生成 Canvas 源码。
   - 如果页面强依赖普通页面实例桥，先列出等价改写方式和需要验证的 runtime / dataBinding 输入。
   - 如果目标诉求其实是字段结构、流程、报表、权限，停止迁移，切到对应配置型技能。

3. **生成 Canvas 源码**
   - 把 `export function renderJsx()` 的 JSX 提取到 `function YidaComp(props)`。
   - 把 `_customState` 拆为 React state；复杂派生数据用 `useMemo`。
   - 把生命周期副作用放进 `useEffect` 并返回 cleanup。
   - 把普通页面 API 适配为统一 window runtime、dataBinding、连接器或 HTTP 数据桥。
   - 保持 UI 结构和文案尽量不变，先完成等价迁移，再决定是否重构。

4. **处理依赖**
   - import 只使用 Code Canvas 依赖白名单内的包（能被 CLI 编译识别并注入 `importedModules`）。
   - 对照 `yida-canvas-custom-page` 的依赖规则检查 `importedModules`。
   - 外部 CDN 脚本要么换成白名单依赖，要么在最小验证页确认可加载。

5. **发布 / 验证 Schema**
   - 用 `openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <formUuid>` 发布。CLI 自动编译并填写 `code`、`runtimeCode` 和 `importedModules`。
   - 源码改写受阻、无法保证等价时，只交付 `.canvas.jsx` 草案和升级报告，不要发布覆盖线上页。
   - 发布后回读 Schema，确认组件树中存在 `YidaCodeCanvas`，且 `runtimeCode` 不是空。

6. **运行验收**
   - 打开真实页面，确认首屏非空。
   - 控制台无依赖缺失、`YidaComp` 未定义、CSS 缺失等错误。
   - 核心交互能触发；移动端至少做一次宽度/弹层检查。
   - 如涉及 `EmployeeField`，按 `yida-canvas-custom-page` 的 EmployeeField 验收点逐项验证。

## 转换模式与升级报告

- 转换核心：`_customState` → `useState`/`useMemo`；`didMount`/`didUnmount` → `useEffect` + cleanup；删掉 `forceUpdate`/timestamp 强刷；`this.utils.yida.*` / `dataSourceMap` 改为统一 window runtime、dataBinding、连接器或 HTTP 数据桥；JSX 从 `renderJsx()` 提到 `function YidaComp(props)` 并 `export default`。
- 迁移完成或受阻时输出简短升级报告（含 source/target、status、依赖、schema write path、blockers、验收勾选项）。

> 📖 before/after 完整转换 JSX 示例 + 升级报告模板 → [references/migration-examples.md](references/migration-examples.md)

## 常见阻塞

| 阻塞 | 处理 |
| --- | --- |
| 源码无法等价改写（`this.utils.yida.*` / `dataSourceMap` 深度耦合） | 改写为统一 window runtime、dataBinding、连接器或 HTTP 数据桥；未验证前只交付草案和迁移报告，不发布覆盖 |
| 依赖不在 Code Canvas 白名单 | 补依赖映射、改用已支持库，或保留原页面 |
| 原页面强依赖 `this.utils.yida.*` | 使用统一 window runtime 的 `runtime.yida`；未验证前不要承诺可运行 |
| 原页面使用宜搭原生字段组件 | 先用 `yida-canvas-custom-page` 做最小验证 |
| Schema 回读不是 `YidaCodeCanvas` | 页面仍是普通 `Jsx`，迁移未完成 |
