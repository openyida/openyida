---
name: yida-canvas-custom-page
description: 宜搭自定义页面开发规范，使用 `YidaCodeCanvas` 组件实现现代 React18 自定义页面。用于官网、看板、工作台、列表、详情、门户壳、可视化、hooks 交互，以及需要门户组件、数据管理视图、成员、部门或上传组件的场景。
---

# 自定义页面开发

## 核心定位

本技能是宜搭自定义页面开发的默认实现：用户写标准 React18 函数组件源码，OpenYida 本地编译为 `runtimeCode` + `importedModules`，运行时由 `YidaCodeCanvas` 组件加载前端资源并执行 `YidaComp`。

UI 和产品设计输入来自 `yida-design` 输出的 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`，或单页 PRD 章节 + design spec。本技能负责把 PRD 的页面场景、区块、交互、数据绑定和功能契约，以及 design.md 的主题色、视觉 DNA、布局、材质、圆角、密度、呼吸感、组件和状态规则落到 `.canvas.jsx` / `.canvas.tsx`、antd token、CSS 变量、数据桥、表单入口和发布验收。

本技能适合：

- 现代 React hooks 交互、图表、动效、复杂状态。
- 首版页面生成：官网、看板、工作台、列表、详情、门户壳。
- 需要 React18 函数组件、状态隔离和现代前端体验的页面。
- 只需要通过 HTTP / 连接器读写数据的页面。
- 需要在 `YidaCodeCanvas` 组件内受控接入门户、成员、部门、上传等宜搭运行态组件的页面。

若已确认目标是存量 `.oyd.jsx` / `.oyb.jsx` / `renderJsx` / 平台 `Jsx` 组件页面维护，不在本技能内改写；该历史源码只由 `yida-custom-page` 自身闭环维护。若用户要求把存量页面迁移为 `YidaCodeCanvas` 组件实现，交给 `yida-canvas-upgrade`。

## 运行时事实

- 使用 `YidaCodeCanvas` 组件实现的源码写成 `.canvas.jsx` / `.canvas.tsx`，`openyida publish` 会自动写入 `YidaCodeCanvas` Schema。
- 页面源码路径按 Bash cwd 选择：从仓库根执行命令时用 `project/pages/src/...`；cwd 已是 `<workspace>/project` 时用 `pages/src/...`。
- `runtimeCode` 在运行页面真实 `window` 中执行，入口必须返回 `YidaComp` / `YidaComp.default` / 组件函数。
- 推荐入口写法是 `function YidaComp(props) { ... }`，或 `const App = ...; export default App;`。CLI 已兼容 `const/let/class YidaComp; export default YidaComp`，但生成新代码时优先避开同名默认导出，减少不同运行态装配器下的重复声明风险。
- `YidaCodeCanvas` 组件使用 React 函数组件上下文；数据读写通过 fetch、开放 API、连接器代理或显式 props 数据桥完成。
- 第三方前端资源只从可用资源清单中选择；React、antd、Ant Design Icons、ahooks、d3、recharts、Radix、framer-motion、lucide-react 等必须按规则 import，由编译器写入 `importedModules`。源码严禁出现 `const { Drawer } = antd`、`const { Search } = lucideReact`、`window.antd`、`window.icons` 等手写依赖全局。
- 宜搭运行态组件按“先探测、可用增强、fallback 保底、值统一归一化”接入；以 `window.Deep` / `window.DeepYida` 探测为主，`window.YidaNativeComponents` 作为可用主题。嵌入门户数据管理视图时使用 `DataManageViews`，并显式传入目标表单 `form.value/formUuid`。

> 可用资源清单和运行时细节见 [dependencies-and-cdn.md](references/dependencies-and-cdn.md) 与 [employeefield-verification.md](references/employeefield-verification.md)。

## 实现范围

| 需求 | 推荐做法 |
| --- | --- |
| 官网、看板、工作台、列表、详情、门户壳 | 同时读取 `yida-design` 的 PRD 与 design.md；生成器路径再读取派生 `page-spec.json`，按页面场景实现 `.canvas.jsx` |
| 需要开放 API / 连接器读写数据 | 使用本技能，在 `YidaComp` 内自建 HTTP 数据桥 |
| 需要门户 topBanner / quickEntry / 数据卡片 | 使用本技能，按“门户组件桥”接入，必要时 fallback 自绘 |
| 需要成员、部门、附件上传、图片上传 | 使用本技能，按“宜搭组件桥”接入并归一化值 |
| 需要字段结构、公式、联动、权限、报表、流程 | 使用对应配置型技能完成配置，自定义页面展示结果并分发页面事件 |
| 新建页面需要字段、表单入口、成员/部门/上传或数据源 | 使用本技能，用数据桥、连接器或运行态组件桥实现 |

## 两类特殊组件场景

### 1. 门户组件、topBanner 与数据卡片

需要门户展示能力时，先按目标页面 PRD 确定门户区块、数据来源和降级视图；需要确认运行态组件清单时，按 [native-components-bridge.md](references/native-components-bridge.md) 编写探测页。

组件选择建议：

- `PortalTopBanner`、`PortalQuickEntry`：优先接入，适合门户首页的 Banner 和快捷入口。
- `QuickAccessCard`、`RecentlyUsedCard`：先做运行态验证，再用于动态门户卡片。
- `DataCard`、`PortalContainer`：仅在目标门户上下文、数据卡片配置和样式变量都验证通过后启用。

做法：从 `window.Deep`、`window.DeepYida` 探测组件；若环境已有 `window.YidaNativeComponents` 也可兼容读取。探测到组件时渲染原生组件；未探测到时渲染页面自绘卡片，页面保持可用。

### 2. 成员、部门、上传组件

需要数据管理视图、成员、部门、附件上传、图片上传时，使用原生组件桥从页面 `window.Deep` / `window.DeepYida` 探测已挂载组件，并把探测结果写回当前页面实现计划。

组件选择建议：

- `EmployeeField`：优先验证和接入，记录真实 `onChange` 结构。
- `DepartmentSelectField`：验证部门搜索、弹层、权限提示、单选/多选后启用。
- `AttachmentField` / `ImageField`：验证 OSS 签名、上传权限、预览、删除、失败提示后启用。

做法：原生组件处理交互输入；页面业务状态保存归一化后的成员、部门、文件结构；提交通过 fetch / 连接器 / 开放 API 完成。组件验证通过时使用原生组件；组件条件不足时使用页面自绘输入、搜索或链接录入。

> 详细桥接规则、值结构和验收清单见 [native-components-bridge.md](references/native-components-bridge.md)。

## 核心规则

### 致命规则（FATAL）

1. **YidaComp 入口明确**：源码必须导出或返回 `YidaComp`，并把主组件作为默认导出或 `YidaComp` 暴露。
2. **发布方式正确**：使用 `YidaCodeCanvas` 组件实现的源码写成 `.canvas.jsx` / `.canvas.tsx`，或发布时显式加 `--canvas`。
3. **源码修改发布闭环**：本轮 Write/Edit/Create 了 `project/pages/src/*.canvas.jsx` 或 `project/pages/src/*.canvas.tsx` 后，final 前需要成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`。有 publish 成功证据时表述为“页面已发布”；只有本地校验证据时表述为“源码已修改，尚未发布”。
4. **依赖可加载**：普通 import 只使用 `YidaCodeCanvas` 可用资源清单内的前端资源；React、antd、Ant Design Icons、Recharts、ahooks、lucide-react 等包依赖必须写 `import ... from '包名'`。严禁写未声明裸变量依赖或手写 window 依赖，例如 `const { Drawer } = antd`、`const { Search } = lucideReact`、`const { ConfigProvider } = window.antd`、`const React = window.React`、`window.icons`。宜搭运行态组件才通过 `window.Deep`、`window.DeepYida`、`window.YidaNativeComponents` 探测。
5. **使用 `YidaCodeCanvas` 组件契约**：页面代码写 `YidaComp` React 函数组件；数据、生命周期和渲染都通过 hooks、props、外层 yida JS-API 桥或连接器完成。组件内部不能直接写 `this.$(fieldId)`、`this.utils.yida.*` 或 `this.dataSourceMap`。
6. **副作用清理**：`useEffect` 注册事件、定时器、图表实例时必须返回 cleanup。
7. **交互控件必须受控且真正驱动数据**：筛选 `Select`、搜索 `Input`/`Input.Search`、周期切换、`Tabs`/`Segmented`、批量/重置 `Button` 等控件都用 `useState` 建立受控状态，绑定 `onChange`/`onClick`，并让 `Table`/列表/卡片的数据源通过 `useMemo` 按状态派生后渲染。切换筛选后若当前选中项失效，回退选中态（如 `selected < filteredRows.length ? selected : 0`）。
8. **视觉壳层必须消费 design.md**：工作台、门户、看板、首页、展示页和真实交付页写页面源码前，先从 `design.md` 抽取 `backgroundLayer`、`visualScaffold.rootShell`、`surfaceMap`、`componentRecipe`、`roundedRule`、`densityRule`、`breathingRule`、`themeProfile` 和 `yidaThemeRuntime`。若 `design.md` 声明 `backgroundLayer`，源码完成标准是：页面根节点带 `data-yida-theme-root="true"`；根节点或注入 CSS 承载背景层；背景 primitive 落到根节点、`::before`、`::after` 或等价背景层；内容层使用相对定位和更高 `z-index`；antd 页面包 `ConfigProvider`，并使用 `readBrandColor`、`getPopupContainer` 和控件 reset CSS 让主题、焦点和浮层生效。若 `design.md` 声明圆润高密和呼吸感规则，源码必须同步到 antd `borderRadius`、CSS `border-radius`、页面 padding/gap、区块间距、列表行高、状态摘要高度、空态高度和内容安全内距，并保证卡片 padding >20px、卡片 gap <20px、卡片圆角 0-32px。
9. **表单数据读取必须使用 dataBinding 契约和 yida JS-API 桥**：完整应用、工作台、列表、看板、详情等真实交付页只要本轮已经创建或解析业务表单，先写入 `dataBinding.mode="form"`、真实 `appType/formUuid` 和字段 ID，再用本地 `useYidaData(binding)` / `DataBridge` 读取。发布层必须在外层页面 `didMount` 注册 `window.__OPENYIDA_YIDA_API__`，`YidaCodeCanvas` 组件内部默认调用 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`；只有桥不可用时才降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json`。页面不能使用 `/query/form/searchFormDatas.json`，也不能只写前端 seedRows 后声称已接真实数据。
10. **源码保持零未绑定标识符**：每个 import、辅助函数、Ref、状态、局部变量和函数参数都在同一文件声明后使用。非标准运行时能力通过 `window.<name>` 或 `parentWindow.<name>` 获取，调用前检查目标方法。`compileCanvasLocal` 报 `OPENYIDA_CANVAS_UNBOUND_IDENTIFIER` 时，一次修复 `details.issues` 中的全部名称，再重新编译。

非标准运行时能力使用以下写法：

```jsx
function setNavigationTitle(title) {
  const dingTalk = window.dd;
  if (typeof dingTalk?.biz?.navigation?.setTitle === 'function') {
    dingTalk.biz.navigation.setTitle({ title });
  }
}
```

> **未绑定标识符守卫边界**：该守卫只拦截不属于 ECMAScript、Browser 或 Canvas wrapper 白名单的裸标识符。`name`、`status`、`length`、`event`、`origin`、`top` 等浏览器标准短名会解析为 `window` 属性，无法判断它原本是否是业务变量拼写错误；例如把 `orderName` 误写成 `name`、把 `rowStatus` 误写成 `status` 或把 `listLength` 误写成 `length` 都不会被拦截。守卫主要兜底 `getInstId`、`loadedRef` 这类自定义名，不代表能发现全部拼写错误；生成或重命名代码后仍须逐项核对业务标识符。

### 重要规则（IMPORTANT）

1. **数据桥显式化**：表单数据默认通过外层 yida JS-API 桥读写，连接器和同源业务接口通过显式 endpoint 读写；Cookie、CSRF、密钥和签名留在平台、连接器或后端服务侧。
2. **组件增强可降级**：门户、成员、部门、上传组件都做 feature detect 和 fallback；组件缺失时页面仍展示自绘基线。
3. **值先归一化**：成员、部门、文件的原始返回值保留到 `raw` 用于检查，业务 payload 使用统一结构。
4. **UI 改造保持功能契约**：页面美感提升、页面重构和局部美化只调整颜色、布局、密度、间距、视觉层级、素材和图标表达；已有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态按原有实现保留。
5. **主题实现消费设计结果**：`themeProfile`、`themeScope`、`themeColorSource` 来自 `yida-design` 的 `design.md`，业务场景和页面边界来自 `prd.md` 或派生 `page-spec.json`；真实业务页、页面重构和局部美化以当前应用主题色为基准，并读取对应 `--color-brand1-*` 与 `--color-group`。独立品牌/活动页、页面级沉浸页、应用导航隐藏后的自绘壳和用户明确要求完全不同风格的页面，使用页面级固定主题（`followRuntimeTheme: false` 或等价 CSS 变量）。需要自定义色盘时复制 `references/theme-runtime-helpers.md` 的 `YidaCodeCanvas` helper，向当前文档、同源可访问父级 iframe 文档，以及 `FormOpenContainer` 打开的同源提交页/详情页子 iframe 文档注入 `style#yida-global-theme`。
6. **先验证再扩展业务**：原生组件、上传、组织搜索、弹层类能力先做 smoke 页面，确认 PC/移动端都可用后再进入复杂业务页面。
7. **生成骨架占位符必须可直发**：可编译页面骨架同时支持生成器替换变量和原样发布。JSON 占位符用 `parseTemplateJson(raw, fallback)`，展示文案占位符用 `withFallback` / `applyPageFallbacks` 兜底，未替换时页面继续可运行，并显示业务化 fallback 文案。
8. **light 页面使用清爽业务色**：业务列表、协同表、数据管理页、工作台和门户默认使用 light 模式；主操作、选中态、筛选焦点和批量操作使用品牌色，边框用浅色品牌混合。用户明确要求暗色大屏/夜间模式/高对比风格时使用深色主视觉。
9. **门户运行态组件要补必需 props 和局部降级**：`QuickAccessCard` / `RecentlyUsedCard` 传 `theme="row-white"` 等必需 props；所有门户/字段/上传增强组件外层加局部 ErrorBoundary，单个组件不兼容时只降级该块，整页保持可用。
10. **自定义主题写入页面作用域**：`--theme` 只接受平台预置 key；不要把任意色值或自定义主题名传给 create-app。PRD 指定非预置主题（例如活力橙、深玫红、自定义暗黑金）时，在页面源码中注入 `style#yida-global-theme` 或等价 scoped CSS vars，并在根节点设置 `data-theme-scope="page"`。注入代码复制 `references/theme-runtime-helpers.md`，不能只写当前页面 `document.head`。
11. **真实交付使用真实数据源**：完整应用或真实交付页只要需要列表、看板、详情记录，并且本轮已经创建/解析业务表单，就在 `page-spec.json` 写入 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射，让页面从表单读取。完整应用默认在页面实现前通过 `yida-data-management` 写入 1-3 条业务化 demo records；页面读取这些真实表单记录，不使用前端 seedRows 冒充。真实数据暂未接入或 seed records 写入失败时展示空态、表单入口、刷新/登记按钮。
12. **PRD + design.md 进入实现输入**：完整应用和真实交付页在写页面前，先消费 `yida-design` 的 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`。PRD 提供产品定位、页面场景、页面区块、数据来源、`functionContract`、素材/图标策略、原生表单入口、页面实现交付顺序、业务化自检、应用主题色和风格摘要；design.md 提供完整 UI 设计，包括 `themeProfile`、tokens、视觉 DNA、`visualScaffold`、材质、组件、圆角、密度、呼吸感和状态规则。两者是唯一设计事实源；`page-spec.json` 只能作为派生 handoff，不得覆盖或改写 PRD/design.md，也不得复制完整 UI 设计规则。
13. **页面实现二选一**：结构化实现路径先从 `prd.md + design.md` 派生 `page-spec.json`，写入 `sourceOfTruth.prdFile/designFile/designRefs/conflictPolicy`，生成可编译骨架后读取 CLI 摘要或 `.openyida-page.json` 判断业务化程度和 dataBinding。业务或视觉事实源缺失时先回写 `prd.md` / `design.md` 并重生成 spec；只有 className、布局比例、字段映射、响应式、状态渲染或编译错误等实现偏差才对生成源码做小范围 Edit/patch。手写路径直接 Write 最终 `.canvas.jsx` 并快检/发布。
14. **实现骨架消费业务 spec**：品牌名、行业词、导航、指标、卡片标题、图片 alt、CTA、色彩 profile 和 section 说明来自当前业务 spec。若 CLI 报业务内容不足，补齐/改写 spec 或 patch 源码后重新生成/编译。
15. **页面产物使用纯文本业务文案**：`.canvas.jsx` 源码、`page-spec.json` 中会渲染到页面的文案、JS 注释、数据常量和产物文件路径都使用无 emoji 文本。页面生成、`compileCanvasLocal` 或 `publish` 报 emoji 错误时，先改 spec/源码/路径，再重新校验发布。若 emoji 原本承担图标含义，必须按 `design.md.iconSystem` 改成 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认 `lucide-react`；不得用 CSS 绘制图形、单字母、首字母、标点符号、Unicode 符号或临时 SVG 冒充图标。
16. **JSX 文案只能是文本或字符串**：JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{'所有级别'}`；筛选项、按钮、状态、空态和表格列名等中文业务文案都按此规则书写。花括号里只能放真实 JS 变量/表达式，不能把中文文案写成 `{所有级别}`、`{处理中}`；Unicode escape 被工具解码后也必须保留字符串引号。
17. **应用级导航归平台承载**：默认不要在自定义页面中创建侧边导航、顶部应用导航、门户导航壳或同级模块菜单；同应用页面入口优先写入 `appBlueprint.navigation` 或平台导航分组，由应用导航内切换。自定义页内容区只放当前页动作、表单新建/查看、外部链接、跨应用资源。只有用户显式要求“在自定义页面中实现自己的顶部导航 / 侧边导航 / 导航壳 / 自绘应用级导航 / 隐藏应用导航”时，才执行 `use_skill("yida-nav-shell")`，生成页面内导航壳，并在发布后执行 `openyida update-app <appType> --hide-app-nav`；只要求页面隐藏导航、无导航全屏或 `isRenderNav=false` 时，走页面级配置，不自动配置 `hideAppNav`。其他自定义页默认不配置 `hideAppNav`。
18. **表单打开入口统一容器**：自定义页内「新建 / 提交表单 / 查看详情」保留原生表单能力，并统一封装为 `FormOpenContainer`。按钮事件只能调用 `openForm({ type: "submission" | "detail", ... })`。查看详情必须先从 `searchFormDatas` 返回行解析真实实例 ID，顺序固定为 `row.formInstId || row.formInstanceId || row.instanceId || row.id`，并优先使用 `row.formInstId`；缺少实例 ID 时禁用详情按钮或提示，不得打开空 `formInstId` 的详情页。PC 端主操作使用右侧抽屉 + iframe 承载页面级隐藏导航的提交页或详情页，抽屉默认半屏 `50vw`，提交页和详情页使用同一宽度规则；详情页 URL 固定追加 `formInstId`、`navConfig.layout=1180` 和 `isRenderNav=false`；iframe `onLoad` 后必须用 `installYidaGlobalThemeIntoFrame(themeTokens, iframeElement)` 把当前页面主题同步到同源子文档；关闭后回到当前列表/工作台并刷新数据。移动端可直接进入提交页/详情页或新页打开，依赖表单自身 JS 注入的 `style#yida-global-theme`。
19. **图标资源固定为可加载库**：页面图标只使用 `lucide-react` 或 `@ant-design/icons`，默认使用 `lucide-react` named import。只有页面已经采用 Ant Design 图标语言、或 antd 组件语境需要 Outlined 图标时，才使用 `@ant-design/icons`。快捷入口、按钮、状态、导航和空态图标在写源码前先建立 `actionIconMap` / `statusIconMap`，按业务语义映射到具体组件，例如 `Plus`、`Upload`、`Download`、`Eye`、`Building2`、`AlertCircle`、`Check`。图标外层可以用 CSS 控制尺寸、颜色、圆角、背景和 hover，但图标本体必须来自上述两类组件，不能用 CSS 形状、字母或 emoji 替代。

## 数据真实性边界

- 完整应用或真实交付页先解析真实 `appType/formUuid/fieldId`，并在 `page-spec.json` 写入 `dataBinding.mode=form`。
- 完整应用默认先用 `yida-data-management` 把 1-3 条业务化 seed records 写入核心普通表单并抽查，再让页面读取；前端静态数据只能用于明确标注的离线演示态。
- 生成后如果 `.openyida-page.json` 的 `dataBinding.enabled !== true`，且页面仍展示列表/看板/详情业务记录，交付状态标为草稿；完整应用 final 只有在真实数据绑定已启用并验证后表述为“已接真实数据”。
- 未接数据的交付页保留真实空态、登记入口、刷新按钮和数据接入提示。

## 开发流程

下面命令以仓库根为视角；如果当前 cwd 已经是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。读取生成文件、Schema 或校验产物时优先用当前工具的 Read / Glob / Grep。

```bash
# 1. 只读检查环境、登录态和可用能力；真实创建资源前必须通过
openyida agent-capabilities --summary-json

# 2. 如需新页面，先创建空白自定义页拿 formUuid
openyida create-page <appType> "<页面名>"

# 3. 按 yida-design 的 prd.md + design.md 生成或编写 .canvas.jsx 源码；结构化实现路径再读取派生 page-spec.json
# 结构化实现路径：先从 prd.md + design.md 派生 page-spec.json，生成可编译骨架后基于 manifest/摘要做小范围 patch。
# 手写路径：已明确最终页面结构、数据桥和样式细节时，直接 Write 最终 .canvas.jsx。

# 4. 本地快检
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/<页面名>.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"

# 5. 发布（本轮修改源码后的远端完成证据）
openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <formUuid>

# 6. 发布后回读字段摘要验收；如需留证，用结构化文件写入工具保存 stdout，不用 shell 重定向
openyida get-schema <appType> <formUuid> --field-map-json
```

`openyida check-page` / `openyida compile` 当前面向平台 JSX 组件页面 `.oyd.jsx` / `.jsx`；使用 `YidaCodeCanvas` 组件实现的页面以 `compileCanvasLocal` 和 `openyida publish .canvas.jsx` 的构建阶段为准。`compileCanvasLocal` 是发布前快检，`openyida publish` 是远端写入证据。

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/<页面名或任务名>/<页面名>-schema.json`；从 workspace 根执行后续命令时路径加 `project/` 前缀。

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [page-generation-guide.md](references/page-generation-guide.md) | PRD 到自定义页面实现入口、官网素材、themeScope、Page Spec、primitives | 写页面前必读 |
| [navigation-and-entry-guide.md](references/navigation-and-entry-guide.md) | 应用内页面、表单、外链和跨应用快捷入口的导航职责与跳转方式；含 `FormOpenContainer` 标准容器 | 工作台/门户含快捷入口、表单新增或详情查看时必读 |
| [native-components-bridge.md](references/native-components-bridge.md) | 门户、成员、部门、上传组件桥接和值归一化 | 需要宜搭运行态组件时必读 |
| [dependencies-and-cdn.md](references/dependencies-and-cdn.md) | 可用前端资源、import 写法、运行时加载方式 | 选择或验证前端资源时必读 |
| [employeefield-verification.md](references/employeefield-verification.md) | 运行时事实、原生组件验证、EmployeeField 验收 | 验证成员/字段组件时阅读 |
| [data-bridge-guide.md](references/data-bridge-guide.md) | `YidaCodeCanvas` 组件内自建 HTTP 数据桥 | 接入真实数据时阅读 |
| [canvas-style-implementation-guide.md](references/canvas-style-implementation-guide.md) | 将 `design.md` 的 App 主题色、antd token、背景层、圆角密度、控件焦点/下拉 reset、图表配色落到 `YidaCodeCanvas` 组件 | 写样式和主题时阅读 |
| [theme-runtime-helpers.md](references/theme-runtime-helpers.md) | `YidaCodeCanvas` 组件 / 平台 JSX 组件自定义主题注入 helper，支持 iframe 父级窗口和表单抽屉同源子 iframe | 自定义色盘、`style#yida-global-theme`、页面级沉浸页、应用导航隐藏后的自绘壳或 FormOpenContainer 时阅读 |
| [component-library-guide.md](references/component-library-guide.md) | 组件库推荐组合和页面选型建议 | 选择 UI/图表依赖时阅读 |
| [canvas-authoring-examples.md](references/canvas-authoring-examples.md) | 最小组件、hooks、副作用、图表示例 | 手写 `.canvas.jsx` 代码时阅读 |
