---
name: yida-custom-page
description: 宜搭普通自定义页面 JSX / Jsx 组件开发规范（React 16 宜搭原生 export function renderJsx 模式、宜搭 JS API、状态管理与编码约束）。当用户明确要求 JSX/Jsx 组件链路、普通自定义页面，或页面强依赖 this.$(fieldId)、this.utils.yida.*、dataSourceMap、表单提交/字段双向绑定深度耦合时使用。
---

# 自定义页面开发

> **先确认链路**：普通自定义页面 JSX/Jsx 组件链路走本技能，发布后落到平台 `Jsx` 组件；Code Canvas 链路走 `yida-canvas-custom-page`，发布后落到 `YidaCodeCanvas` 组件。两者是并列页面实现链路，不要把本技能描述成 Code Canvas 的备用链路。已有普通自定义页面升级到 Code Canvas 时才走 `yida-canvas-upgrade`。

## Resource-First 页面开发

编写页面源码前，先按根技能解析目标 app/page/form context：

- 已有页面 URL、display `formUuid`、bound page 或 workspace cache/config 中可确认的自定义页面时，直接为该页面编写/修改源码，并交给 `yida-publish-page` 发布；不要先调用 `yida-create-page`。
- bound page 只是默认页面，不是锁定目标；如果当前会话绑定页面 A，但用户本轮明确说要修改页面 B，先解析 B 的 URL / display `formUuid` / 页面名称。B 能唯一解析时改 B；B 无法唯一解析时询问用户；禁止静默把需求发布到 A。
- 完整应用 `fast_build` 如果已有 bound app/page，主页面源码直接落到该页面；只在缺少主入口 display page 且用户意图允许新增时创建页面容器。
- 用户只说“优化这个页面 URL / 修改现有页面 / 重新发布”时，本技能与 `yida-publish-page` 配合即可完成，不创建 app/page。
- 如果用户给的是普通表单 `formUuid`，页面源码只能把它作为数据源或入口链接使用；不能把数据表单 ID 当作发布目标。
- 页面源码路径按 Bash cwd 选择：从仓库根执行命令时用 `project/pages/src/...`；如果 cwd 已是 `<workspace>/project`，用 `pages/src/...`，不要写成 `project/pages/src/...`。

## 核心规则

### 致命规则（FATAL）

违反会导致页面崩溃或运行时报错：

1. **默认使用 OpenYida 页面源码格式**：推荐文件名 `project/pages/src/<页面名>.oyd.jsx`。宜搭原生写法仍使用 `export function renderJsx()`；有限现代 authoring 可用 `export default function Page()` + `useState` + `useEffect(..., [])`，由 OpenYida 发布前降级
2. **export function 定义方法**：所有需要 `this` 的方法必须用 `export function` 定义，不得用箭头函数或函数表达式
3. **事件绑定箭头函数包裹**：`renderJsx` 顶部先写 `var self = this`，事件使用 `onClick={(e) => { self.handleClick(e) }}`，严禁 `onClick={this.handleClick}` 或 `.bind(this)`
4. **.map()/.filter() 回调用箭头函数**：`.map((item) => ...)`，禁止 `.map(function(item) {...})`，否则回调内 `this` 丢失；`.oyd.jsx` 构建会尝试自动修复，但生成时仍应直接写正确形式
5. **输入框非受控模式**：`<input>` 用 `defaultValue` + `onChange` 写入 `_customState`，禁止 `value` 受控模式
6. **禁止 import/require**：第三方库通过 `this.utils.loadScript` 加载 CDN 脚本
7. **字段 ID 必须通过 get-schema 获取**：执行 `openyida get-schema <appType> <formUuid>` 获取真实 fieldId，文件顶部定义 `FIELDS` 常量映射字段别名，禁止猜测或手写
8. **所有 API 调用必须 .catch()**：异常通过 `this.utils.toast({ title: message, type: 'error' })` 提示用户
9. **renderJsx 每个 return 分支必须渲染 timestamp**：`<div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>`；`.oyd.jsx` 构建会自动补齐，但生成原生写法时仍必须显式写出
10. **禁止 ES6 计算属性名**：不要写 `{ [key]: value }`、`{ [FIELDS.xxx]: value }` 或 `setCustomState({ [key]: value })`；宜搭运行时可能静默白屏，`check-page` 会以 `computed-property` error 阻塞。改用 `var obj = {}; obj[key] = value;`
11. **生命周期名称大小写固定**：只允许 `export function didMount()` 与 `export function didUnmount()`；`didmount`、`componentDidMount`、`componentWillUnmount` 会被 `check-page` 阻塞
12. **按钮必须真的绑定事件**：禁止 `onclick` 小写属性、`onClick={self.save()}`、`onClick={(e) => self.save}`、`<button>静态标签</button>` 等看起来有按钮但不会正确绑定的写法；统一使用 `onClick={(e) => { self.save(e); }}`。如果只是状态标签/截图标记，用 `span`/`div`，不要用 `button`
13. **业务状态禁止直接 `this.setState`**：业务态只写 `_customState`，通过 `setCustomState()` / `forceUpdate()` 触发重渲染；`this.setState` 只允许写 `timestamp` 等运行时契约字段
14. **读状态只能用 `getCustomState()`，禁止读 `this.state.<业务字段>`**：`this.state` 里只有 `timestamp`（重渲染标记）和 `urlParams`，业务态在 `_customState`。读 `this.state.agg`、`this.state.loading` 等恒为 `undefined`，页面无报错却渲染成"数据全占位、图表全空"的空壳页，极难排查。`renderJsx`/`renderCharts` 等所有读状态处一律 `this.getCustomState()`；遇到状态同步问题时再读 [编码指南 · 状态管理](references/coding-guide.md)

### 重要规则（IMPORTANT）

影响代码质量和用户体验：

0. **视觉方向按需加载**：单点页面美化、用户明确要求好看/去 AI 味，或 `yida-app` 进入 `deep_design` 时，调用 `use_skill("yida-page-uiux", "确定自定义页面视觉方向")` 完成「视觉方向决策」。`yida-app fast_build` 默认不加载该技能，直接使用克制的 MVP 工作台/列表/入口布局，禁 emoji、少装饰、真实业务页主色跟随 App 品牌即可；`lib/samples/**` 和官方 sample 展示应用例外，必须使用页面级独立主题。
1. **代码生成前确认功能摘要**：详见 [编码指南 编注 0](references/coding-guide.md)
2. **pageSize 推荐 50，最大 100**：列表/看板默认 `pageSize: 50`；分页接口 `searchFormDatas` 等的 `pageSize` 最大 100
3. **didUnmount 清理定时器**：在 `didUnmount` 中清理所有 `setInterval`/`setTimeout`，防止内存泄漏
4. **默认 Tailwind 风格层 + native 控件 reset**：面向用户的自定义页面默认使用 Tailwind utility className 组织视觉层，并默认导入 Tailwind preflight；同时必须保留 `openyida-native-control-reset` 或等效页面级样式，覆盖 input/textarea/select/自定义下拉的 focus、appearance、font-weight 和 shadow，避免浏览器黑色粗边。reset 使用 `.oyd-page` 通用作用域时可以复用全局 id，但不能因为同名 style 已存在就跳过更新；如果页面使用 `.oyd-grade-page`、`.oyd-data-page` 等自定义作用域，style id 必须页面专属，避免多 native 页面切换时下拉选项和 SVG 勾选样式丢失。运行时脚本只允许使用已验证的 `g.alicdn.com` 或企业自托管地址，未配置有效地址时走内联兜底样式
5. **DateField 时间戳格式**：日期字段值必须是时间戳（毫秒），不能是字符串
6. **forceUpdate 后延迟操作 DOM**：`forceUpdate()` 后 DOM 不会立即更新，ECharts/Canvas/第三方组件初始化必须放入 `setTimeout` 或 `requestAnimationFrame`
7. **多端适配**：使用 `this.utils.isMobile()` 判断设备类型，适配 PC 和移动端
8. **输入法组合输入处理**：使用 `_isComposing` 标记配合 `compositionstart`/`compositionend` 事件，避免输入过程中触发提交
9. **iframe 嵌入表单 URL**：数据列表用 `workbench/{formUuid}?iframe=true`，禁止用 `formDetail`
10. **Tabs 显隐控制**：下拉值变更后自动回退到第一个可见 Tab，内容区用 `display: none` 保留 DOM
11. **加载态必须可恢复**：列表/看板页默认保留空态或演示数据；接口失败、超时或返回异常时必须把 `loading` 置回 `false`，不要只渲染“正在加载...”挡住整页
12. **禁止可见原生下拉**：筛选、预约、审批等用户可见下拉交互不要使用 `<select>`；普通自定义页也不要把表单设计器里的 `SelectField` 当 React 筛选组件直接渲染。默认使用 Tailwind className 组合 `button + menu + option` 的自定义下拉组件，并带 `.oyd-select-arrow` 下箭头、`.oyd-select-check` 选中标记和页面级 focus reset；light 模式下选中项整块背景必须用 `--oyd-control-selected-bg` 这类低透明度浅色 token，不要直接用 `--color-brand1-1`
13. **严禁 emoji**：页面渲染出来的任何位置（标题、按钮、标签、状态、空态文案、图表标题等）**一律禁止出现 emoji**（😀🚀✅⚠️📦📊 等一切彩色符号字符）。需要图标一律用功能性内联 SVG（见 `skills/yida-page-uiux` 图标策略）；需要状态标记用文字 + 语义色标签。emoji 是最明显的 AI 味来源之一，且跨端显示不一致。JS 注释、文件路径、数据常量和示例数组里也不要留装饰性符号；`check-page` / `compile` / `publish` 报 emoji 错误时必须删除或改为 SVG/图标组件，不能用 `--skip-lint` 绕过。
14. **light 页面禁灰黑主题**：普通业务列表、协同表、录入表、工作台和门户默认不要用近黑按钮、近黑描边、灰黑重阴影作为主题；主操作、选中态、筛选焦点和批量操作使用品牌色或 sample 自带主题色，边框用浅色品牌混合。只有用户明确要求暗色/高对比时才使用深色主视觉。
15. **发布前必须跑检查链路**：先执行 `openyida check-page <file>` 和 `openyida compile <file>`；若出现 warning/error，按规则修复后再发布
16. **源码修改发布闭环**：只要本轮 Write/Edit/Create 了 `project/pages/src/*.{oyd.jsx,jsx,tsx}` 普通自定义页面源码，`check-page` / `compile` 只证明源码可发布，不等于远端页面已更新；final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>`。没有 publish 成功证据时，只能说“源码已修改，尚未发布”，不能说“页面已更新 / 已重新发布”。

> 每条规则的代码示例、反模式和常见错误见 [编码指南](references/coding-guide.md)；`fast_build` 默认先遵守本技能正文，不预读长 reference，只有 check-page 报错、复杂交互、`deep_design` 或正文覆盖不了的问题时才读取。
> 运行时易错点、`check-page` 规则和兼容层自动修复边界见 [运行时护栏](references/runtime-guardrails.md)，按需读取。
> 表单类 JSX 控件、筛选栏、表格、成员/附件等组件写法见 [组件指南](references/component-jsx-guide.md)，涉及这些复杂组件时读取；未验证的平台组件能力不得编造。

## 官方示例范式内化

官方示例中心的自定义页不是“整页手写逻辑”，而是 `状态层 + 数据源层 + 交互层` 三层结构。生成页面前先列出这三层，再写代码：

| 层 | 默认内容 | 生成要求 |
| --- | --- | --- |
| 状态层 | `loading`、`list/tableData`、`currentPage`、`pageSize`、`totalCount`、`filters/searchFieldJson`、`selectedRowKeys`、`dialogVisible` | 放入 `_customState`，所有失败路径必须恢复 `loading: false` |
| 数据源层 | 表单查询、保存、更新、删除、流程发起、任务列表、连接器动作 | 只有已存在或本轮已创建设计器数据源时，才允许调用 `this.dataSourceMap.<name>.load()`；`fast_build` 默认不得生成依赖 dataSourceMap 的代码。查询本轮新建的宜搭表单数据时默认用 `this.utils.yida.searchFormDatas(params)`；不需要真实列表时用入口卡片 + 统计占位，不编造 dataSourceMap |
| 交互层 | 筛选栏、表格/卡片列表、分页、弹窗、Tab/Collapse、操作按钮 | `renderJsx` 只负责展示和事件分发，业务逻辑拆成 `export function` |

默认页面结构按官方高频组件范式转译为 JSX：顶部筛选/操作区、主体表格或卡片列表、分页、详情/编辑弹窗、空态/错误态。不要把数据查询、复杂计算和大段 DOM 混在一个 `renderJsx` 里。

如果用户的需求实际是字段公式、字段联动、原生报表、审批规则或集成自动化，先切换到对应技能；自定义页面只在需要跨数据展示、工具页交互、可视化看板或连接器调用界面时承担前端层。

## 适用场景
自定义展示页面、JSX 页面、跨数据展示、复杂交互

## 快速开始

以开发「员工信息查询页」为例，完整流程如下：

下面命令以仓库根为视角；如果当前 cwd 已经是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。读取生成文件和 Schema 时优先用宿主 Read / Glob / Grep，不要在 CLI 成功后 Bash `cat`/`ls` 复核。

1. 获取表单 Schema，确认字段 ID：

```bash
openyida get-schema APP_XXX FORM-EMPLOYEE
```

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/employee-query/employee-schema.json`；ID 映射仍写 `<projectRoot>/.cache/employee-query-schema.json`。

```bash
# Step 2：确认或补齐自定义页面发布目标
# 已有页面 URL / display formUuid 时直接复用该 formUuid，例如 FORM-QUERY001。
# 只有没有目标页面且允许新增时才执行：
openyida create-page APP_XXX "员工信息查询"

# Step 3：生成/编写普通自定义页面 JSX 代码
openyida sample yida-custom-page custom-page-template
# 在 project/pages/src/employee-query.oyd.jsx 中编写；Code Canvas 页面使用 yida-canvas-custom-page / .canvas.jsx

# Step 4：本地规范检查 + 编译校验（不发布）
openyida check-page project/pages/src/employee-query.oyd.jsx
openyida compile project/pages/src/employee-query.oyd.jsx

# Step 5：发布页面
openyida publish project/pages/src/employee-query.oyd.jsx APP_XXX FORM-QUERY001
```

**关键说明**：
- **Step 1** 的 get-schema 输出包含所有字段的 fieldId，在代码中必须使用 `FIELDS` 常量映射这些 ID
- **Step 2** 默认复用已有页面 context 并跳过 `openyida create-page`；但本轮用户明确指定另一个页面时先切换目标，不能唯一识别时询问；只有页面缺失且允许新增时才执行创建命令
- **Step 3** 的页面代码必须遵循本技能正文；[编码指南](references/coding-guide.md) 和 [运行时护栏](references/runtime-guardrails.md) 在 check-page 报错、复杂交互、`deep_design` 或正文覆盖不了时读取
- 注意：`openyida generate-page` 默认生成 Code Canvas `.canvas.jsx`；明确需要普通自定义页面 JSX/Jsx 组件链路时输出 `.oyd.jsx` 或加 `--native`
- **Step 4** 是本地质量门槛，**Step 5** 才是远端页面更新证据；如果本轮只完成文件 Write/Edit 或 `check-page` / `compile`，final 只能说明“源码已修改，尚未发布”
- 优先通过 `openyida generate-page ... --compile` 生成高质量骨架；需要完整交互样板时使用 `todo-mvc`
- 页面生成 spec、接口调试 JSON、一次性验证脚本等临时工件必须用结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/` 下；不要在仓库根目录、系统临时目录或 `.cache/` 顶层生成 `page.json`、`data.json` 或脚本文件
- `check-page` 支持行级禁用：`// openyida-lint-disable-line <rule>` 或 `// openyida-lint-disable-next-line <rule>`。只在确认该行不会触发宜搭运行时问题时使用。

## fast_build 默认页面模板

完整应用 `fast_build` 编写或更新主页面时，默认选择以下轻量闭环之一：

1. 入口型页面：展示表单入口、核心流程说明、少量统计占位和快捷按钮，不执行真实列表查询。
2. 内置数据 API 页面：用 `this.utils.yida.searchFormDatas` 查询已创建表单，用 `this.utils.yida.saveFormData` 做快速新增；所有失败路径恢复 `loading: false` 并展示空态。

最小查询形态：

```js
export function loadVisitorList() {
  var self = this;
  var state = self.getCustomState();
  self.setCustomState({ loading: true });
  return self.utils.yida.searchFormDatas({
    formUuid: FORM_UUIDS.visitor,
    currentPage: state.currentPage || 1,
    pageSize: state.pageSize || 50,
    searchFieldJson: JSON.stringify(state.searchFieldJson || []),
  }).then(function(res) {
    var data = (res && res.data) || (res && res.content && res.content.data) || [];
    var total = (res && res.totalCount) || (res && res.content && res.content.totalCount) || 0;
    self.setCustomState({
      loading: false,
      list: Array.isArray(data) ? data : [],
      totalCount: total,
    });
    self.forceUpdate();
  }).catch(function(error) {
    self.setCustomState({ loading: false, list: [], totalCount: 0 });
    self.utils.toast({ title: error && error.message ? error.message : '数据加载失败', type: 'error' });
    self.forceUpdate();
  });
}
```

不得在 fast_build 里写 `this.dataSourceMap.<name>.load()`，除非本轮已明确创建并绑定该数据源，并且已加载 `yida-data-source-connectors` 完成数据源链路。

## 开发规范

> `fast_build` 默认不读取长 reference，直接遵守本技能正文的核心规则和模板。只有 check-page 报错、复杂交互/复杂组件、`deep_design`、或正文覆盖不了的运行时问题，才读取下方 Available Files。
> 涉及输入控件、日期、选择、成员/部门、附件、表格或筛选栏时，读取 [组件指南](references/component-jsx-guide.md)。

## 官方示例模板与编码注意事项

原“官方示例模板”的全局变量表已归并到 [编码指南](references/coding-guide.md) 的“全局变量”；原“编码注意事项”的完整规则和示例仍在 [编码指南](references/coding-guide.md)。fast_build 不默认读取这些长 reference，入口层只保留导航和执行命令，避免与 reference 重复。

代码编写前，先按需获取模板并完整读取生成文件：

```bash
openyida sample yida-custom-page custom-page-template   # 完整页面模板（didMount/renderJsx/状态管理/API调用）
openyida sample yida-custom-page product-homepage       # 产品/项目首页轻量模板（支持 --var KEY=VALUE）
openyida sample yida-custom-page todo-mvc               # TodoMVC 完整交互模板（事件/状态/循环/本地存储）
openyida sample yida-custom-page design-tokens          # 设计 token 参考（颜色/间距/字体规范）
openyida generate-page product-homepage --spec .cache/openyida/<项目名或任务名>/page-specs/home.json --output pages/src/home.oyd.jsx --native --compile  # 基于 spec/blocks 生成首页并本地编译
openyida generate-page todo-mvc --output pages/src/todo-mvc.oyd.jsx --native --compile  # 生成官方 TodoMVC 风格交互样板
openyida check-page pages/src/home.oyd.jsx --json      # 输出机器可读的规范检查结果；.oyd.jsx 会先兼容构建
```

- 完整文件结构、状态管理、全局变量、19 条编码规则见 [编码指南](references/coding-guide.md)，按需读取
- `--spec` 文件先用 create_file / Write / file edit tool 创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/page-specs/`
- 运行时高风险规则、`check-page` 规则和自动修复边界见 [运行时护栏](references/runtime-guardrails.md)
- 输入控件、筛选栏、下拉、表格、附件等组件骨架见 [组件指南](references/component-jsx-guide.md)

## 常见场景示例

- 自定义页面附件上传：见 [AttachmentField 上传指南](references/attachment-upload-guide.md)
- 对应最小代码示例：见 [attachment-upload.js](examples/attachment-upload.js)

## API 速查

### 表单数据（`this.utils.yida.<方法>(params)`）

| 方法 | 说明 | 必填参数 |
|------|------|----------|
| `saveFormData` | 新建实例 | `formUuid`, `appType`, `formDataJson` |
| `updateFormData` | 更新实例 | `formInstId`, `updateFormDataJson` |
| `deleteFormData` | 删除实例 | `formUuid` |
| `getFormDataById` | 查询详情 | `formInstId` |
| `searchFormDatas` | 搜索列表 | `formUuid` |
| `searchFormDataIds` | 搜索 ID 列表 | `formUuid` |

### 流程操作（`this.utils.yida.<方法>(params)`）

| 方法 | 说明 | 必填参数 |
|------|------|----------|
| `startProcessInstance` | 发起流程 | `formUuid`, `processCode`, `formDataJson` |
| `getProcessInstanceById` | 查询流程详情 | `processInstanceId` |
| `getProcessInstances` | 搜索流程列表 | — |

### 工具函数（`this.utils.<方法>()`）

| 方法 | 用途 |
|------|------|
| `toast` | 轻提示 |
| `dialog` | 对话框 |
| `formatter` | 日期/金额格式化 |
| `getLoginUserId` / `getLoginUserName` | 获取当前用户 |
| `isMobile` | 判断移动端 |
| `openPage` | 打开新页面 |
| `router.push` | 路由跳转 |
| `loadScript` | 动态加载脚本 |

> **上表为常用 API 速查，完整 API 列表见 [yida-api.md](../../references/yida-api.md)。复杂参数不确定时读取完整参数文档，禁止猜测参数。**

## Available Files

| key | path | when |
|-----|------|------|
| `coding-guide` | `references/coding-guide.md` | check-page 报错、复杂交互、状态管理问题、`deep_design` |
| `runtime-guardrails` | `references/runtime-guardrails.md` | 页面运行时报错、check-page 规则不清、编译兼容边界不清 |
| `component-jsx-guide` | `references/component-jsx-guide.md` | 输入控件、日期、选择、成员/部门、附件、表格或筛选栏 |
| `design-system` | `references/design-system.md` | 用户明确要求视觉细化，或已进入 `deep_design` / `yida-page-uiux` 后落地样式 |

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
|------|---------|---------|
| **本技能文档** | | |
| `yida-page-uiux` 子技能 | 页面类型 playbook、5 维差异化引擎、去 AI 味黑名单/8 问自检、图标策略 | 用户明确要求好看/去 AI 味或 `deep_design` 时加载；`fast_build` 不默认加载 |
| [编码指南](references/coding-guide.md) | 文件结构模板、状态管理、生命周期、19 条编码规范 | check-page 报错、复杂交互、状态管理问题或 `deep_design` 时阅读 |
| [运行时护栏](references/runtime-guardrails.md) | pageSize、loading 恢复、ECharts DOM 时序、setState 约束、check-page 规则映射 | 页面运行时报错、check-page 规则不清或编译兼容边界不清时阅读 |
| [设计规范](references/design-system.md) | 色彩/圆角/字体/间距系统、7 类组件样式模板、8 条反模式 | 用户明确要求视觉细化，或已进入 `deep_design` / `yida-page-uiux` 后阅读 |
| [素材资源](references/assets-guide.md) | 图片/音乐/Icon 素材库、CDN 安全规范 | 需要引入图片、图标、音效时阅读 |
| [官方示例中心 Schema 范式](../../references/official-example-schema-patterns.md) | 示例中心 156 个 capacity 模板的 schema 抽取链路、类型分布、数据源/报表/连接器模式 | 用户要求参考官方示例、蒸馏模板能力、或实现列表/模板中心/数据源驱动页面时阅读 |
| **全局共享文档** | | |
| [宜搭 API](../../references/yida-api.md) | 表单/流程/工具 API 完整参数文档 | 复杂参数不确定、接口返回结构异常或正文速查不够时阅读 |
| [大模型 API](../../references/model-api.md) | AI 文本生成接口参数 | 调用 `txtFromAI` 且参数不确定时阅读 |

## 注意事项

- 本技能不读写 memory，所有页面状态（`_customState`）仅在当前页面会话内有效，刷新页面后重置，不跨会话持久化
