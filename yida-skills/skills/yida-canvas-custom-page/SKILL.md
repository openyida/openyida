---
name: yida-canvas-custom-page
description: 宜搭 Code Canvas / 代码画布自定义页面开发规范，是自定义页面的默认链路。用于现代 React 交互、hooks 状态、可视化、AI 生成、官网、看板、工作台、列表、详情或需要崩溃隔离的页面（真 React18 + runtimeCode + importedModules）。也覆盖用户明确提到 code canvas、代码画布、YidaCodeCanvas、runtimeCode、importedModules，或在 Code Canvas 中使用门户、数据管理视图、成员、部门、上传等宜搭运行态组件的场景。
---

# 宜搭 Code Canvas 自定义页面开发

## 核心定位

Code Canvas 是宜搭的代码画布自定义页面链路：以 `YidaCodeCanvas` 物料为承载，用户写标准 React18 函数组件源码，OpenYida 本地编译为 `runtimeCode` + `importedModules`，运行时按依赖白名单加载资源并执行 `YidaComp`。

相较普通 `.oyd.jsx` 自定义页，Code Canvas 更适合：

- 现代 React hooks 交互、图表、动效、复杂状态。
- AI 首次生成页面：官网、看板、工作台、列表、详情、门户壳。
- 需要组件级崩溃隔离和更现代前端体验的页面。
- 只需要通过 HTTP / 连接器读写数据的页面。
- 需要在 Canvas 内受控接入门户、成员、部门、上传等宜搭运行态组件的页面。

如果用户明确要求普通自定义页面 JSX/Jsx 组件链路，或页面强依赖普通自定义页实例桥，则选择 `yida-custom-page`：例如 `this.$(fieldId)` 双向绑定、`this.utils.yida.*`、`this.dataSourceMap`、提交流程深度耦合等。

## 运行时事实

- Canvas 源码写成 `.canvas.jsx` / `.canvas.tsx`，`openyida publish` 会自动走 Canvas 链路。
- 页面源码路径按 Bash cwd 选择：从仓库根执行命令时用 `project/pages/src/...`；如果 cwd 已是 `<workspace>/project`，用 `pages/src/...`，不要写成 `project/pages/src/...`。
- `runtimeCode` 在宿主页真实 `window` 中执行，入口必须返回 `YidaComp` / `YidaComp.default` / 组件函数。
- Canvas 组件没有普通页面实例上下文；数据读写通过 fetch、开放 API、连接器代理或显式 props 数据桥完成。
- 第三方依赖走白名单；React、antd、ahooks、d3、recharts、Radix、framer-motion 等可按规则 import。
- 宜搭运行态组件通过“原生组件桥 + fallback + 值归一化”接入；不改 `vc-deep-yida` 时，以宿主已存在的 `window.Deep` / `window.DeepYida` 探测为主，`window.YidaNativeComponents` 仅作为兼容入口。需要嵌入门户数据管理视图时探测 `DataManageViews`，并显式传入目标表单 `form.value/formUuid`。

> 依赖白名单和运行时细节见 [dependencies-and-cdn.md](references/dependencies-and-cdn.md) 与 [employeefield-verification.md](references/employeefield-verification.md)。

## 使用决策

| 需求 | 推荐做法 |
| --- | --- |
| 官网、看板、工作台、列表、详情、门户壳 | 使用本技能，按页面类型生成 `.canvas.jsx` |
| 需要开放 API / 连接器读写数据 | 使用本技能，在 `YidaComp` 内自建 HTTP 数据桥 |
| 需要门户 topBanner / quickEntry / 数据卡片 | 使用本技能，按“门户组件桥”接入，必要时 fallback 自绘 |
| 需要成员、部门、附件上传、图片上传 | 使用本技能，按“宜搭组件桥”接入并归一化值 |
| 需要字段结构、公式、联动、权限、报表、流程 | 使用对应配置型技能承载，Canvas 只做展示和事件分发 |
| 深度依赖普通页 `this` 实例桥 | 选择 `yida-custom-page` |
| 强依赖普通自定义页实例数据桥：表单内字段双向绑定 `this.$(fieldId)`、`this.utils.yida.*`、`dataSourceMap`、提交流程深度耦合 | 使用 `yida-custom-page`（该实例桥由普通自定义页面提供） |

## 两类特殊组件场景

### 1. 门户组件、topBanner 与数据卡片

需要门户展示能力时，优先用 `portal-shell-home` 或 `portal-native-components` 示例作为起点；需要确认运行态组件清单时先跑 `native-components-smoke`：

```bash
openyida generate-page portal-shell-home --theme-profile yida-app-theme --theme-scope page --output project/pages/src/portal-shell-home.canvas.jsx --compile
openyida sample yida-canvas-custom-page native-components-smoke --output project/pages/src/native-components-smoke.canvas.jsx
openyida sample yida-canvas-custom-page portal-native-components --output project/pages/src/portal-native-components.canvas.jsx
```

组件选择建议：

- `PortalTopBanner`、`PortalQuickEntry`：优先接入，适合门户首页的 Banner 和快捷入口。
- `QuickAccessCard`、`RecentlyUsedCard`：先做运行态验证，再用于动态门户卡片。
- `DataCard`、`PortalContainer`：依赖门户上下文、数据卡片配置和样式变量，作为增强能力谨慎启用。

做法：从 `window.Deep`、`window.DeepYida` 探测组件；若环境已有 `window.YidaNativeComponents` 也可兼容读取。探测失败时使用 Canvas 自绘卡片，页面仍保持可用。

### 2. 成员、部门、上传组件

需要数据管理视图、成员、部门、附件上传、图片上传时，使用原生组件桥从宿主运行态探测 `@ali/deep` / `vc-deep-yida` 已挂载组件：

```bash
openyida sample yida-canvas-custom-page native-components-smoke --output project/pages/src/native-components-smoke.canvas.jsx
openyida sample yida-canvas-custom-page portal-native-components --output project/pages/src/portal-native-components.canvas.jsx
```

组件选择建议：

- `EmployeeField`：优先验证和接入，记录真实 `onChange` 结构。
- `DepartmentSelectField`：验证部门搜索、弹层、权限提示、单选/多选后启用。
- `AttachmentField` / `ImageField`：验证 OSS 签名、上传权限、预览、删除、失败提示后启用。

做法：原生组件只负责交互输入；页面业务状态保存归一化后的成员、部门、文件结构；提交仍通过 fetch / 连接器 / 开放 API 完成。组件条件未满足时 fallback 到 Canvas 自绘输入、搜索或链接录入。

> 详细桥接规则、值结构和验收清单见 [native-components-bridge.md](references/native-components-bridge.md)。

## 核心规则

### 致命规则（FATAL）

1. **Canvas 入口明确**：源码必须导出或返回 `YidaComp`，并把主组件作为默认导出或 `YidaComp` 暴露。
2. **发布链路正确**：Canvas 源码使用 `.canvas.jsx` / `.canvas.tsx`，或发布时显式加 `--canvas`。
3. **源码修改发布闭环**：只要本轮 Write/Edit/Create 了 `project/pages/src/*.canvas.jsx` 或 `project/pages/src/*.canvas.tsx`，本技能的本地校验只证明源码可发布，不等于远端页面已更新；final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>`。没有 publish 成功证据时，只能说“Canvas 源码已修改，尚未发布”，不能说“页面已更新 / 已重新发布”。
4. **依赖可加载**：普通 import 只使用 Code Canvas 白名单依赖；宜搭运行态组件走原生组件桥。
5. **不使用普通页实例契约**：Canvas 中不写 `renderJsx()`、`didMount()`、`this.forceUpdate()`、`this.utils.yida.*`、`this.dataSourceMap`。
6. **副作用清理**：`useEffect` 注册事件、定时器、图表实例时必须返回 cleanup。
7. **交互控件必须受控且真正驱动数据**：凡是暗示“会改变下方数据/视图”的控件（筛选 `Select`、搜索 `Input`/`Input.Search`、周期切换、`Tabs`/`Segmented`、批量/重置 `Button` 等），禁止只写 `defaultValue` 当装饰。必须用 `useState` 建立受控状态、绑定 `onChange`/`onClick`，并让 `Table`/列表/卡片的数据源经过基于该状态的 `useMemo` 派生过滤后再渲染。**反例（会导致“点了筛选下面数据不变”）**：把固定 `seedRows` 直接喂给 `<Table dataSource={rows} />`，同时摆一排 `defaultValue` 且无 `onChange` 的筛选控件。切换筛选后若可能让当前选中项失效，需回退选中态（如 `selected < filteredRows.length ? selected : 0`）。

### 重要规则（IMPORTANT）

1. **数据桥显式化**：通过 fetch、连接器或开放 API 读写数据，避免在页面里硬编码 Cookie、CSRF 或密钥。
2. **组件增强可降级**：门户、成员、部门、上传组件都要 feature detect 和 fallback，组件缺失时页面不白屏。
3. **值先归一化**：成员、部门、文件的原始返回值只作为 `raw` 调试，业务 payload 使用统一结构。
4. **业务页主色跟随应用主题，sample 例外**：真实业务页默认读取 `--color-brand1-*` 与 `--color-group`，避免硬编码蓝色；但 `lib/samples/**` 和官方 sample 展示应用必须自带页面级固定主题（`followRuntimeTheme: false` 或等价 CSS 变量），每个 sample 使用不同色相，不允许被宿主应用主题统一染成黑灰。
5. **先验证再扩展业务**：原生组件、上传、组织搜索、弹层类能力先做 smoke 页面，确认 PC/移动端都可用后再承载复杂业务。
6. **模板占位符必须可直发**：Canvas sample / generate-page 模板要同时支持“生成器替换变量”和“sample 原样发布”。禁止写 `JSON.parse('{{FEATURES_JSON}}')` 这类裸解析；JSON 占位符必须用 `parseTemplateJson(raw, fallback)`，展示文案占位符必须用 `withFallback` / `applyPageFallbacks` 兜底，确保未替换时不会运行期崩溃，也不会把 `{{BRAND_NAME}}`、`{{HERO_TEXT}}`、`{{OPENYIDA_RESEARCH_LEVEL}}` 等直接显示到页面。
7. **light 页面禁灰黑主题**：业务列表、协同表、数据管理页、工作台和门户默认不要用 `#111827` 这类近黑色做按钮、描边、选中态或大阴影；主操作、选中态、筛选焦点和批量操作使用品牌色或 sample 自带主题色，边框用浅色品牌混合。只有用户明确要求暗色大屏/夜间模式/高对比风格时才使用深色主视觉。
8. **门户运行态组件要补必需 props 和局部降级**：`QuickAccessCard` / `RecentlyUsedCard` 必须传 `theme="row-white"` 等必需 props，避免运行态读取 `theme.includes(...)` 报错；所有门户/字段/上传增强组件外层加局部 ErrorBoundary，单个组件不兼容时只降级该块，不让整页进入 Canvas 错误态。
9. **自定义主题必须页面内注入**：`--theme` 只接受平台预置 key；如果页面设计使用非预置主题（例如活力橙、深玫红、自定义暗黑金），Canvas 页面必须在自身源码中注入 `style#yida-global-theme` 或等价 scoped CSS vars，并在根节点设置 `data-theme-scope="page"`。官方 sample 每个页面都要做，避免宿主应用 `black` 主题把页面染成黑灰。
10. **真实交付不使用前端 seed 冒充业务数据**：`openyida sample` 原样发布可以保留 sample/seed 数据，但必须在页面上标注为 sample/seed。完整应用或真实交付页只要需要列表、看板、详情记录，并且本轮已经创建/解析业务表单，就必须在 `page-spec.json` 写入 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，让页面从表单读取。若需要演示数据，先通过表单数据写入链路创建 demo/mock records，再由 Canvas 读取这些真实表单记录；未写入 demo records 且没有真实数据时展示空态、表单入口、刷新/登记按钮。
11. **页面生成二选一**：选择模板路径时，`openyida generate-page ... --spec ... --compile` 之后只读取 CLI 摘要或 `.openyida-page.json` 判断 `domainFidelity` / dataBinding，并对生成源码做小范围 Edit/patch；禁止立刻 Read 大段源码后全量 Write 覆盖同一路径。选择手写路径时，直接 Write 最终 `.canvas.jsx` 并快检/发布，不要先跑 `generate-page` 再完全覆盖。

## 数据真实性边界

Canvas 模板有两种允许状态：

- **Sample / 离线预览**：`openyida sample` 或模板原样发布可以显示内置 seedRows，页面必须标注 `sample/seed`，final 也要说明“当前为演示数据/未接真实表单数据”。
- **完整应用 / 真实交付**：先解析真实 `appType/formUuid/fieldId`，写入 `page-spec.json` 的 `dataBinding.mode=form` 后再 `openyida generate-page ... --spec <page-spec.json>`。需要 demo/mock 记录时，先用数据写入链路把记录写入表单并抽查，再让页面读取；不能把前端 seedRows、静态 DEFAULT_FEATURES 或固定指标说成真实业务数据。

生成后如果 `.openyida-page.json` 的 `dataBinding.enabled !== true`，且页面仍展示列表/看板/详情业务记录，只能标为 sample/draft；完整应用 final 不得说“已接真实数据”。未接数据的交付页应保留真实空态、登记入口、刷新按钮和数据接入提示。

## 模板占位符防回归

Canvas 模板有两条真实使用链路：

- `openyida generate-page ...`：变量会被生成器替换。
- `openyida sample ...` 或官方 sample 展示应用：源码可能被原样发布。

因此模板源码必须满足：

- 原始 sample 经过 `compileCanvasLocal` 能通过。
- 原始 sample 执行 `YidaComp()` 不应抛错。
- 可见渲染内容不得泄漏 `{{...}}` 占位符。
- 源码不得包含 `JSON.parse('{{...}}')`；用安全解析函数接默认数据。

改 Canvas sample 后运行：

```bash
npx jest tests/canvas-compile.test.js tests/generate-page.test.js --runInBand
```

## Sample 改造沉淀纪律

批量优化 `lib/samples/**` 或官方 sample 展示应用时，不能只按当前模板微调颜色。每个 sample 都要形成可复用经验：

- **先读复盘规范**：如果用户要求总结上轮经验、继续优化官方 sample、同步到官方 Samples 应用，或多次基于截图纠正页面质量，先读全局 [任务复盘与沉淀规范](../../references/task-retrospective.md)，再判断要补模板、测试、CLI 还是 skill。
- **先看参考再动手**：用户要求“高级、Dribbble、好看、像产品/官网/详情页/数据表”时，先参考 Dribbble 的同类构图和免费可商用素材站的真实图片，再抽象成布局、层次、色彩和数据密度原则；不要照搬单个作品。
- **说清参考转译**：交付 sample 改造时要用 1-2 句话说明参考被转译成了什么，例如“详情页采用对象 hero + sticky 元信息 + 时间线结构”、“数据管理页采用多维表工具栏 + 分组行 + 彩色标签密集表格”。不要只说“已参考 Dribbble”。
- **每页独立主题**：sample 页默认 `themeScope=page` 或等价固定 CSS 变量；业务列表、详情、门户、工作台、官网、数据管理、大屏要有不同色相和不同信息节奏，不被宿主应用主题统一染色。
- **非预置主题不走 `--theme`**：`deepBlue/podBlue/.../black` 这些平台 key 才能传给 `--theme`；自己设计的主题色要写到页面 `style#yida-global-theme` / scoped token 中，并确保每个 sample 页面都有这段注入。
- **Sample 数据要像真实业务，但不能冒充真实交付数据**：列表、详情、数据管理、工作台、大屏 sample 必须模拟足够丰富的数据、状态、筛选、趋势、分组、时间线或指标，不要只放 3 个卡片和空泛文案；完整应用/真实交付页必须优先接 `dataBinding.mode=form` 或展示真实空态，不把 sample seed 当业务主列表。
- **工作台不是 demo 壳**：工作台页面要铺满应用内容区，侧栏/导航/主面板形成真实产品首页；禁止用 `max-width + margin: 0 auto + 外层 padding` 做居中展示框，也不要把 `dribbble research`、`sample`、`workbench + operation` 这类设计过程词露给用户。
- **数据大屏地图要稳定**：大屏中心态势图如果是地图，不能只依赖外部 ECharts CDN / GeoJSON 成功后才显示；优先探测宜搭宿主地图组件（如 `YoushuMap` / `ChinaMap` / `MapChart` 等），并提供内置区域地图组件兜底。禁止把“地图组件暂不可用”作为正常展示态暴露给用户。
- **截图问题要反哺模板**：用户指出导航未覆盖、地图抽象、颜色不好、内容不丰富、产品首页不像首页等问题时，不只修当前 JSX；如果属于模板共性，补到 sample 模板、测试或本技能规则。
- **官网实景化不是只换 Hero**：强视觉官网至少形成“场景 Hero + 产品/服务 + 过程/空间”的摄影故事，品牌色从真实材质提取，section 要覆盖真实产品、制作/服务过程与到店/使用情境。具体按 `yida-page-uiux/references/landing/realistic-brand-homepage.md` 执行。
- **交互要真的联动数据**：改完带筛选/搜索/切换的 sample，必须实际验证“改筛选 → 下方列表/表格/卡片数据发生变化”，不能只看 `compileCanvasLocal` 编译通过。装饰性 `defaultValue` 控件（无 `onChange`、数据源恒为固定 `seedRows`）视为缺陷，等同“按钮点了没反应”。
- **线上发布后回读**：发布到官方 sample 应用后，用 `get-schema` 回读确认 `YidaCodeCanvas/runtimeCode` 已更新，必要时检查页面 class/关键文案/关键区块存在。
- **CLI 缺口要落盘**：如果改造过程中发现 CLI 行为“回包成功但未生效”、缺少 sample 注册、缺少模板类型或测试覆盖，应优先补 CLI/测试，而不是只用一次性脚本绕过。

## 开发流程

下面命令以仓库根为视角；如果当前 cwd 已经是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。读取生成文件、Schema 或校验产物时优先用宿主 Read / Glob / Grep，不要在 CLI 成功后 Bash `cat`/`ls` 复核。

```bash
# 1. 只读检查环境和登录态；真实创建资源前必须通过
openyida env --json
openyida login --check-only --json

# 2. 如需新页面，先创建空白自定义页拿 formUuid
openyida create-page <appType> "<页面名>"

# 3. 生成或编写 Canvas 源码
# 模板路径：生成后基于 manifest/摘要和小范围 patch 演进，不全量覆盖生成文件。
openyida generate-page workbench-home --theme-profile yida-app-theme --theme-scope page --output project/pages/src/workbench-home.canvas.jsx --compile
openyida generate-page dashboard-overview --theme-profile yida-app-theme --theme-scope page --output project/pages/src/dashboard-overview.canvas.jsx --compile
openyida generate-page portal-shell-home --theme-profile yida-app-theme --theme-scope page --output project/pages/src/portal-shell-home.canvas.jsx --compile
openyida sample yida-canvas-custom-page native-components-smoke --output project/pages/src/native-components-smoke.canvas.jsx
openyida sample yida-canvas-custom-page portal-native-components --output project/pages/src/portal-native-components.canvas.jsx
# 手写路径：已明确最终页面结构时，跳过 generate-page，直接 Write 最终 .canvas.jsx。

# 4. 本地 Canvas 快检
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/<页面名>.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"

# 5. 发布（本轮修改源码后的远端完成证据）
openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <formUuid>

# 6. 发布后回读字段摘要验收；如需留证，用结构化文件写入工具保存 stdout，不用 shell 重定向
openyida get-schema <appType> <formUuid> --field-map-json
```

`openyida check-page` / `openyida compile` 当前面向普通自定义页面 `.oyd.jsx` / `.jsx`；Canvas 以 `compileCanvasLocal` 和 `openyida publish .canvas.jsx` 的 Canvas 编译阶段为准。`compileCanvasLocal` 是发布前快检，不能替代 `openyida publish` 的远端写入证据。

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/<页面名或任务名>/<页面名>-schema.json`；从 workspace 根执行后续命令时路径加 `project/` 前缀。不要把 `openyida` stdout 通过 shell 重定向保存成 JSON。

## 模板速查

| 场景 | 命令 |
| --- | --- |
| 工作台 | `openyida generate-page workbench-home --theme-profile yida-app-theme --output project/pages/src/workbench.canvas.jsx --compile` |
| 看板 | `openyida generate-page dashboard-overview --theme-profile yida-app-theme --output project/pages/src/dashboard.canvas.jsx --compile` |
| 列表 | `openyida generate-page business-list --theme-profile yida-app-theme --output project/pages/src/list.canvas.jsx --compile` |
| 详情 | `openyida generate-page detail-profile --theme-profile yida-app-theme --output project/pages/src/detail.canvas.jsx --compile` |
| 门户壳 | `openyida generate-page portal-shell-home --theme-profile yida-app-theme --output project/pages/src/portal.canvas.jsx --compile` |
| 原生组件 smoke | `openyida sample yida-canvas-custom-page native-components-smoke --output project/pages/src/native-components-smoke.canvas.jsx` |
| 门户 + 宜搭组件桥 | `openyida sample yida-canvas-custom-page portal-native-components --output project/pages/src/portal-native-components.canvas.jsx` |
| 官网 | `openyida generate-page official-homepage --theme-profile yida-app-theme --output project/pages/src/official-home.canvas.jsx --compile` |
| 数据大屏 | `openyida generate-page data-screen --theme-profile yida-app-theme --output project/pages/src/data-screen.canvas.jsx --compile` |

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [page-generation-guide.md](references/page-generation-guide.md) | 模板路由、官网素材、themeScope、Page Spec、primitives | 生成页面前必读 |
| [native-components-bridge.md](references/native-components-bridge.md) | 门户、成员、部门、上传组件桥接和值归一化 | 需要宜搭运行态组件时必读 |
| [dependencies-and-cdn.md](references/dependencies-and-cdn.md) | 依赖白名单、windowAlias、CDN、antd/dayjs 问题 | 新增依赖或排查依赖加载时必读 |
| [employeefield-verification.md](references/employeefield-verification.md) | 运行时事实、原生组件验证、EmployeeField 验收 | 验证成员/字段组件时阅读 |
| [data-bridge-guide.md](references/data-bridge-guide.md) | Canvas 内自建 HTTP 数据桥 | 接入真实数据时阅读 |
| [canvas-design-system.md](references/canvas-design-system.md) | App 主题色、antd token、控件焦点/下拉 reset、图表配色 | 写样式和主题时阅读 |
| [component-library-guide.md](references/component-library-guide.md) | 开源组件库推荐组合和禁用清单 | 选择 UI/图表依赖时阅读 |
| [canvas-authoring-examples.md](references/canvas-authoring-examples.md) | 最小组件、hooks、副作用、图表示例 | 手写 Canvas 代码时阅读 |
| [真实品牌官网 Playbook](../yida-page-uiux/references/landing/realistic-brand-homepage.md) | 实景素材组、材质配色、品牌旅程、Sample 无 CDN 兜底和视觉验收 | 生成或改造强视觉官网时必读 |
| [任务复盘与沉淀规范](../../references/task-retrospective.md) | 官方 sample 改造经验、Dribbble 转译、页面级主题、发布回读、CLI/skill 反哺 | sample 批量优化、截图纠错、用户要求总结经验时阅读 |
