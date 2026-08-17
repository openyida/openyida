# 输出：design.md

> 本文件定义完整应用的 `prd/<项目名>/design.md` 输出格式。`design.md` 是应用级 UI 视觉设计系统，结构以本文件为准，并参考 `references/style-designs/_design-md-template.md` 的字段完整度：先记录设计风格选择依据和主题换肤结果，再写可复用视觉 DNA、token、布局、组件、状态和自检，最后在“实现适配”里写清宜搭运行时主题契约。PRD 只写主题色和风格摘要，完整 UI 设计以本文件为准。

最终 `design.md` 的依据分四层：结构依据本文件和 `_design-md-template.md`；视觉 DNA、布局机制、组件机制和换肤规则依据选中的设计风格文件；业务内容、页面区块、数据来源和操作路径依据当前 PRD；主题 token 依据 Step 2 的主题色来源和所选风格的 `theme_adaptation`。

## design.md 输出格式

```markdown
---
version: 1.0
name: <应用或风格系统英文 slug>
description: <内容中立的中文用途说明>
design_id: <design-id>
design_status: ready
baseDesignSource: references/style-designs/<selected-style>.md
styleDesignSelection:
  inferredUserTask: <判断 / 处理 / 追踪 / 分析 / 展示 / 汇报>
  inferredInformationTopology: <摘要优先 + 趋势承接 + 明细落地>
  interactionFocus: <搜索筛选 / 待办处理 / 下钻详情 / 多入口跳转 / 趋势比较>
  requiredVisualDNA:
    - <dna-id>
  selectedStyleDesign:
    name: <style-name>
    source: references/style-designs/<selected-style>.md
    reason: <为什么该风格最适合当前业务>
  rejectedStyleDesigns:
    - <style-name>: <为什么不选>
  selectionConfidence: <high / medium / low>
scenes: [工作台, 列表, 详情, 看板]
density: <high / medium / comfortable；业务工具页默认 high>
layout: <preferred archetype or custom layout；工作台默认紧凑双栏/三栏，不用低密大卡墙>
tone: <视觉气质关键词>
tags: [<业务领域>, <角色>, <数据形态>]
avoid: [<不适合场景>]
themeProfile:
  name: <平台预置 key 或自定义色盘名称>
  themeScope: <app / page>
  themeColorSource: <user-specified / application-theme / platform-preset-match / business-inferred / template-default>
  themePresetKey: <命中平台预置时填写；自定义色盘留空>
  shouldPassCreateAppTheme: <true 仅限平台预置；false 表示 create-app 不传 theme/colour>
  globalThemeInjection: <style#yida-global-theme / customThemeStyle.tokens / none>
  navTheme: light
  colorMode: <宜搭配色模式，如 gradient；不表示暗黑>
themeAdaptationResult:
  inputThemeColor: <主题色 key 或色值>
  strategy: replace_hue_preserve_visual_mechanism
  replaced:
    brand: <主色>
    brand-strong: <深主色>
    brand-soft: <浅主色>
    focus-ring: <焦点色>
  preservedVisualDNA:
    - <dna-id>
  preservedMechanisms:
    - <画布 / 面板 / 布局 / 深色舞台 / 右侧栏等>
yidaThemeRuntime:
  globalThemeInjection: <style#yida-global-theme / customThemeStyle.tokens / none>
  formRuntimeInjection: style#yida-global-theme
  formDetailStyleInjection: style#yida-form-detail-style
  themeConsistency: app, custom pages, normal forms, process forms, submission pages, and formDetail pages share the same themeProfile tokens
  styleElementId: yida-global-theme
  helperRef: yida-canvas-custom-page/references/theme-runtime-helpers.md
  injectTargets: [currentDocument, sameOriginParentDocuments]
  rootAttribute: data-yida-theme-root
tokens:
  --color-brand1-1: <明亮品牌浅色或浅 hover 色>
  --color-brand1-2: <浅背景>
  --color-brand1-3: <透明/浅边界>
  --color-brand1-5: <主色 hover 档>
  --color-brand1-6: <主色>
  --color-brand1-7: <主色 active 档>
  --color-brand1-9: <深主色>
  --color-brand1-10: <深色或透明强调档>
  --color-brand-1: <移动端品牌色 1>
  --color-brand-2: <移动端品牌色 2>
  --color-brand-3: <移动端品牌色 3>
  --color-brand-4: <移动端品牌色 4>
  --color-group: <图表和分组色板，逗号分隔>
visual_dna:
  - name: <可识别的设计记忆点名称>
    confidence: observed
    evidence: <参考或需求中可见的证据>
    rule: <生成新 UI 时必须如何保留它>
    implementation_hooks: [<布局/组件/token/CSS/图表钩子>]
    failure_mode: <缺失该 DNA 时会出现的风格漂移>
colors:
  bg-outer: "#..."
  surface: "#..."
  surface-muted: "#..."
  text-primary: "#..."
  text-secondary: "#..."
  border-subtle: "#..."
  brand: "#..."
backgroundLayer:
  baseCanvas: <默认低饱和浅底或带装饰的近白画布；深色舞台仅用户明确要求暗色/大屏时使用；推荐避免无层次的纯空白画布>
  primitives:
    [softTintCanvas, topIrregularWash, radialGlowWash, flowLight, organicNoise]
  topIrregularWash: <可选；不规则顶部色块、波浪或斜切背景，内容仍按规则栅格排布>
  motionLayer: <none / subtle-flow-light；必须有 prefers-reduced-motion 静态降级>
  contrastGuard: <前景文字和控件对比度要求>
surfaceContrast:
  rule: <页面背景与卡片背景必须有明显层次，不可相近或相同>
  pairing: <white-bg-bordered-card / gray-bg-white-card / tinted-bg-white-card / gradient-bg-glass-card>
  pageBackground: <浅色背景色或渐变>
  cardBackground: <白色、浅色或玻璃 rgba>
  cardBorder: <白色/浅色背景时必须写边框；浅灰/浅彩背景时可 none；玻璃卡片写半透明边框>
  forbidden: <浅底白卡无边框、同色背景同色卡片、只靠弱阴影区分层级>
iconSystem:
  defaultLibrary: lucide-react
  allowedLibraries: [lucide-react, "@ant-design/icons"]
  style: <线性描边 / Outlined；同一页面保持一致>
  strokeWidth: <默认 1.75 或 2>
  sizes:
    toolbar: 16
    quickAction: 18
    status: 16
  actionIconMap:
    <业务动作名>: <lucide-react 或 @ant-design/icons 的具体组件名>
  statusIconMap:
    <业务状态名>: <lucide-react 或 @ant-design/icons 的具体组件名>
  navigationIconMap:
    <导航项名>: <lucide-react 或 @ant-design/icons 的具体组件名>
  emptyStateIconMap:
    <空态类型>: <lucide-react 或 @ant-design/icons 的具体组件名>
typography:
  page-title:
    fontFamily: "<字体栈>"
    fontSize: <数字>
    fontWeight: <数字>
    lineHeight: <数字>
    letterSpacing: 0
spacing:
  page-x: <默认 20-28>
  page-y: <默认 20-28>
  grid-gap: <默认 12-18；卡片和卡片的 gap 必须小于 20>
  section-gap: <默认 14-18；用于跨区块呼吸和分组，不用于撑空白>
  card-x: <默认 22-28；卡片 padding 必须大于 20>
  card-y: <默认 22-28；卡片 padding 必须大于 20；列表/摘要类不是卡片时可更紧>
  row-y: <默认 10-12>
breathingRule:
  rhythm: <首屏主区、列表区、右侧上下文和操作条之间的分组节奏>
  sectionGap: <默认 14-18；卡片之间的 gap 必须小于 20>
  innerPadding: <默认 22-28；卡片 padding 必须大于 20>
  compression: <内容不足时压缩高度、转薄行或补业务上下文/下一步动作>
rounded:
  sm: <默认 10-12>
  md: <默认 14-16>
  card: <范围 0-32；业务卡片默认 20-24>
  panel: <范围 0-32；主容器/抽屉/重点面板默认 22-32>
  pill: 999
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-y} {spacing.card-x}"
  empty-state:
    density: compact
    maxHeight: <默认 88-120>
  metric-strip:
    height: <默认 64-88>
inferred_modules:
  quick_actions:
    required_for: [工作台, 仪表盘, 管理后台, 运营首页]
    confidence: inferred
    rule: <基于整体视觉风格推断的快捷入口区域规则>
---

# <应用名> design.md

## 1. 总览

用 2-4 个短段落说明可复用设计意图。保持内容中立，只说明气质、信息密度、主要用途和页面组织方式。

## 2. 设计风格选择依据

说明 `styleDesignSelection` 的推演过程：当前业务的用户任务、信息拓扑、交互重心、必需视觉 DNA、选中风格和排除风格。选择理由必须来自业务结构和视觉 DNA 命中，不得按行业、颜色或主观偏好直接套风格。

## 3. 主题色与换肤结果

说明 `themeProfile` 和 `themeAdaptationResult`：主题色来源、是否命中平台主题 key、是否允许传给 `create-app/update-app --theme`、如何替换所选风格的 `replace_tokens`、派生 `derive_tokens`、保留 `preserve_tokens` 和 `visual_dna.invariant`。必须明确“换 hue，不换 DNA；换 token，不换结构”。

## 4. 适用场景

列出适合和不适合使用该风格的场景。

## 5. 视觉氛围

说明运营工具感/表达型、克制/戏剧化、密度、留白、专业度等取向。

默认业务工具页采用“圆润但高密”的现代 B 端气质：业务面板和重点容器默认 20px 以上大圆角，页面信息密度默认 high，留白用于分组和阅读，不用于撑页面面积。只有官网、品牌页、展示页或用户明确要求舒展时，才把 density 调到 medium / comfortable。

## 6. 视觉 DNA / 设计母体

从所选设计风格和当前业务结构中提取 2-5 个内容替换后仍必须保留的设计记忆点。每个 DNA 必须包含名称、证据、规则、实现钩子、失败表现和置信度；证据必须同时说明业务触发条件和风格来源。

## 7. 色彩角色

用表格列出 token、取值和用途，覆盖背景、表面、文字、边框、品牌色、状态色和图表序列。必须包含 `themeProfile` 和 `yidaThemeRuntime` 中声明的主题 token。

| token               | 取值                        | 用途                                               |
| ------------------- | --------------------------- | -------------------------------------------------- |
| `--color-brand1-1`  | <明亮品牌浅色或浅 hover 色> | 列表 hover、菜单 hover、轻量背景，不直接当深色文字 |
| `--color-brand1-2`  | <品牌浅底>                  | 弱强调背景、浅底提示、选中底色、标签浅底           |
| `--color-brand1-3`  | <透明/浅边界>               | 选中边框、禁用/弱化品牌态、浅描边                  |
| `--color-brand1-5`  | <主色 hover 档>             | 主按钮 hover、链接 hover、可点击强调 hover         |
| `--color-brand1-6`  | <主色>                      | 主按钮、链接、选中态、重点标签、图表主序列         |
| `--color-brand1-7`  | <主色 active 档>            | 按下态、active、pressed                            |
| `--color-brand1-9`  | <深主色>                    | 强调文字、深底按钮、深色强调块                     |
| `--color-brand1-10` | <深色或透明强调档>          | 深色 hover、强强调背景、深色主题补充               |
| `--color-brand-1`   | <移动端品牌浅/透明档 1>     | 移动端壳层、移动端表单、旧版移动组件浅品牌态       |
| `--color-brand-2`   | <移动端品牌浅/中档 2>       | 移动端 hover、轻量强调、移动端组件浅色面           |
| `--color-brand-3`   | <移动端主品牌档 3>          | 移动端主操作、选中态、原生表单移动主色             |
| `--color-brand-4`   | <移动端深品牌档 4>          | 移动端 active、深色强调、移动壳层深色态            |
| `--color-group`     | <色组>                      | 图表、分类、状态序列                               |

`--color-brand1-*` 是页面和 PC 端主要消费的品牌色阶；`--color-brand-*` 是移动端和部分原生表单/壳层桥接仍会消费的品牌色阶，必须保留，不能删掉、改名或替换成其他 token。

## 8. 字体规则

定义字体栈、字号体系、行高、字重和数字排版。不要使用 viewport width 缩放字体，默认 `letter-spacing: 0`。

## 9. 布局原则

说明页面壳、最大宽度、网格比例、间距、内容顺序和中性槽位关系。布局机制应来自所选风格的 `layout_stability`、`modules` 和当前 PRD 页面结构，不得凭空增加 PRD 未要求的图表、右侧栏、时间轴或深色舞台。

工作台、门户首页、管理后台和运营首页必须写清紧凑状态摘要、任务/记录列表、右侧上下文、高频动作条和薄空态行动。首屏不能出现超宽但内容稀疏的 KPI 横框、孤立大空态卡或右侧大面积留白；空白区域必须用最近记录、动态、风险、负责人、下一步动作、配置提示或薄空态行动承接。

## 10. 层级与深度

说明深度来自平面表面、边框、阴影、色调层、毛玻璃、覆盖层或空间效果，并说明哪些地方不该使用阴影。

### Background Layer Contract

展示型页面、工作台、看板、门户、官网、登录页和空状态页推荐使用有层次的页面画布，而不是无氛围的纯空白背景。画布可以接近白色，但应通过淡渐变、细线装饰、星芒、高光、插图、顶部不规则色块或内容密度形成背景感。背景层写成可实现字段 `backgroundLayer`，优先选择 1-2 个背景 primitive：

| primitive          | 适用场景                                   | 实现要求                                                                                             |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `softTintCanvas`   | 工作台、列表、管理后台                     | 使用低饱和高明度底色，例如暖灰、浅青、浅粉、浅蓝紫，也可以是带弱渐变的近白画布；前景内容保持规则栅格 |
| `topIrregularWash` | 官网、品牌页、主页面首屏、登录页、空状态页 | 顶部或首屏使用不规则色块、波浪、斜切、有机边界或轻装饰曲线；内容不跟随背景扭曲                       |
| `radialGlowWash`   | AI 产品、SaaS、驾驶舱、视觉化工作台        | 使用大面积柔和径向光或光洗，不使用离散装饰圆球、bokeh 或随机漂浮点                                   |
| `flowLight`        | 科技感主视觉、数据看板、引导卡片           | 使用极慢速流光或光影位移动效；必须提供 `prefers-reduced-motion` 静态降级                             |
| `organicNoise`     | 温暖亲和、生活方式、轻品牌页               | 叠加 0.02-0.06 透明度微噪点或细纹理，减少机械感，不影响阅读                                          |

背景可以不规则，内容必须规则。所有主要内容仍使用明确网格、分栏、对齐和稳定间距，不能因为背景形状导致文字、按钮、图表或表格漂移。B 端页面的背景色保持低饱和、高明度；深色大屏可使用低亮度流动线条或光效纹理衬托数据，但正文对比度必须达标。若选择极简近白画布，必须用清晰内容结构、细线装饰、局部渐变或素材焦点证明页面不是未设计的空白底。

### Surface Contrast Contract

页面背景与卡片背景必须形成明显层次对比，不可相近或相同。默认背景色保持浅色调，确保整体视觉清爽，同时与卡片之间有清晰层次；必须在 `surfaceContrast` 中选择以下搭配之一：

| pairing                  | 背景                         | 卡片                                                                 |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------- |
| `white-bg-bordered-card` | 白色/浅色背景                | 卡片添加 `1px` 边框，边框色与背景形成可见分隔                        |
| `gray-bg-white-card`     | 浅灰色背景，例如 `#F3F4F6`   | 白色无边框卡片，用背景色差形成层次                                   |
| `tinted-bg-white-card`   | 浅彩色背景，例如浅蓝、浅暖灰 | 白色无边框卡片，必要时补极弱阴影                                     |
| `gradient-bg-glass-card` | 渐变色背景                   | 玻璃感卡片，使用半透明表面、半透明边框、`backdrop-filter` 和柔和阴影 |

禁止输出浅底白卡无边框、同色背景同色卡片、卡片和页面背景只差 1-2 个灰阶，或只靠弱阴影承担层次。若背景和卡片都接近白色，卡片必须有可见边框；若背景为浅灰或浅彩，卡片优先白色无边框；若背景为渐变，卡片必须按玻璃材质处理。

## 11. 形状

定义圆角尺度，以及每个尺度分别用于哪里。

默认形状语言是圆润但不低密，并且布局要有呼吸感：卡片圆角范围 0-32px，业务卡片/面板默认 20-24px，主面板/抽屉/重点区域默认 22-32px，按钮和输入框 10-14px，标签/状态胶囊 999px。卡片 padding 必须大于 20px，卡片和卡片的 gap 必须小于 20px；圆角服务形状性格，不用空白卡撑版面。

## 12. 组件样式

覆盖顶部栏、按钮、图标按钮、卡片/面板、输入框/选择器、表格/列表、图表、标签/徽标、快捷入口、空状态、弹窗/浮层。相关组件要包含 default、hover、active、focus、disabled、loading、selected、error 等状态。图标规则写入 `iconSystem`：页面图标只使用 `lucide-react` 或 `@ant-design/icons`，默认使用 `lucide-react` named import；快捷入口、按钮、状态、导航和空态必须给出可实现的 `actionIconMap` / `statusIconMap` / `navigationIconMap` / `emptyStateIconMap`。emoji 不能改成 CSS 形状、字母占位、Unicode 符号或临时 SVG。

组件默认密度和呼吸规则必须写到可实现数值：状态摘要 64-88px 高，动作条 40-56px 高，列表行 44-56px，高频按钮 36-40px，卡片 padding 默认 22-28px 且必须大于 20px，卡片和卡片的 gap 默认 12-18px 且必须小于 20px。空状态默认嵌在列表/面板内部，使用薄提示行、补录/刷新/新建动作和简短说明；不得用 160px 以上大白卡只显示“暂无数据”。

## 13. 快捷入口区域

工作台、仪表盘、管理后台或运营首页必须输出快捷入口区域规则。说明位置、容器、条目、数量、图标、文字、状态、响应式、与 DNA 的关系和禁止漂移。

快捷入口的图标使用 `iconSystem` 中的具体组件名。常用映射示例：新增/创建用 `Plus`，搜索/查询用 `Search`，刷新用 `RefreshCw`，查看用 `Eye`，入库/上传用 `Upload`，出库/下载用 `Download`，供应商/组织用 `Building2`，告警用 `AlertCircle`，完成用 `Check`。

## 14. 页面结构配方

提供 2-4 个使用中性槽位的布局配方，例如 `primary_metrics`、`quick_actions`、`trend_panel`、`detail_table`、`status_note`。每个使用到自定义页面的场景都必须写 `visualScaffold`：

- visualScaffold：<rootShell / prioritySurface / statusPrimitive / actionPrimitive / contentPrimitive / contextPrimitive / statePrimitive / responsiveRule / breathingRule>
- surfaceMap：<每个区块的容器形态、背景、边框、阴影、毛玻璃或平面规则>
- surfaceContrast：<页面背景与卡片背景的层次搭配；从 white-bg-bordered-card / gray-bg-white-card / tinted-bg-white-card / gradient-bg-glass-card 中选择>
- densityRule：<页面边距、卡片 gap、状态摘要高度、列表行高、卡片 padding、空态高度和压缩空白规则>
- breathingRule：<首屏分组节奏、跨区块间距、组内内距、贴边修正、内容不足时的压缩/补充策略>
- roundedRule：<业务面板、主面板、控件、标签、抽屉和弹层的圆角数值>
- componentRecipe：<每个关键组件的结构、密度、状态和 token 使用>

## 15. 状态与交互

列出 hover、active、focus、loading、empty、error、disabled、selected、mobile 和 reduced motion 规则。

## 16. 响应式

定义断点和布局折叠方式。说明文字适配、工具栏换行、表格横向滚动和触控目标尺寸。

## 17. 可访问性

要求对比度、focus 状态、纯图标控件标签、非纯颜色状态表达、键盘可访问和 reduced motion。

## 18. 实现适配

只包含相关适配，例如 CSS 变量、Ant Design ConfigProvider、Tailwind class 映射、Yida / YidaCodeCanvas 容器重置或 React 组件建议。宜搭主题必须写成可执行契约：

### Yida Global Theme Runtime Contract

| 项目         | 规则                                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平台预置主题 | 只有 `themePresetKey` 命中平台预置 key 且 `shouldPassCreateAppTheme=true` 时，`create-app/update-app` 才传 `theme/colour`                                                    |
| 自定义色盘   | `shouldPassCreateAppTheme=false`，创建应用时不传 `theme/colour`                                                                                                              |
| 页面注入     | 自定义色盘、隐藏导航沉浸页、页面级独立主题使用 `style#yida-global-theme`                                                                                                     |
| 应用级换肤   | 需要全应用换肤时写 `customThemeStyle.tokens`，页面运行态统一注入 `style#yida-global-theme`                                                                                   |
| 表单运行态   | 普通表单、流程表单、提交页和 formDetail 详情页必须消费同一套应用主题 token；表单 JS 固定注入 `style#yida-global-theme`                                                        |
| 详情页样式   | formDetail 页面必须由同一个 `openyidaThemeDidMount` 条件注入 `style#yida-form-detail-style`，不得只完成页面主题而漏掉详情页样式                                                |
| 主题一致性   | 自定义页面、普通表单、流程表单、提交页、formDetail 详情页和应用主题色必须一致；抽屉 iframe 打开表单时同步父页面当前主题 tokens                                                 |
| 注入目标     | 当前窗口 `document` 和所有同源可访问父级窗口 `document`；跨域父级静默跳过                                                                                                    |
| Helper       | YidaCodeCanvas 和平台 JSX 组件页面都复制 `yida-canvas-custom-page/references/theme-runtime-helpers.md`，使用其中的 `collectYidaThemeDocuments` 收集当前文档和同源父级文档，不要临场重写 |
| 样式 ID      | 固定为 `yida-global-theme`，重复执行只更新同一个 style                                                                                                                       |
| 根节点       | 页面根节点加 `data-yida-theme-root="true"`，让 token 在当前页和父级 iframe 壳层都能命中                                                                                      |

### 自定义页面实现要求

- 使用 `YidaCodeCanvas` 组件实现时，复制 `theme-runtime-helpers.md` 的 YidaCodeCanvas Helper。
- 在根组件中调用 `useYidaGlobalTheme(CUSTOM_THEME_TOKENS)`。
- `CUSTOM_THEME_TOKENS` 必须来自本 design.md 的 `tokens`，不能临场另配。
- 根节点写 `<div data-yida-theme-root className="...">`。
- `backgroundLayer` 必须落到根节点背景、`::before` 顶部不规则色块或大面积光洗、`::after` 流光/纹理层；内容层使用相对定位和更高 `z-index`，保证背景不盖住操作区。
- `surfaceContrast` 必须落到页面根背景和卡片/面板样式：白色/浅色背景配有边框卡片，浅灰或浅彩背景配白色无边框卡片，渐变背景配玻璃感卡片。
- `flowLight` 动效必须写 `@media (prefers-reduced-motion: reduce)` 停止动画。
- 页面图标使用 `lucide-react` 或 `@ant-design/icons` 的标准 import，默认从 `lucide-react` named import 具体组件；源码按 `iconSystem.actionIconMap` / `statusIconMap` / `navigationIconMap` / `emptyStateIconMap` 渲染图标。CSS 只能控制图标容器样式，不能绘制或替代图标本体。

### 平台 JSX 组件实现要求

- 复制 `theme-runtime-helpers.md` 的 Ordinary JSX Helper。
- 在 `didMount` 或等价初始化中调用 `installYidaGlobalTheme(CUSTOM_THEME_TOKENS, window)`。
- 平台 JSX 组件页面发布后落到平台 `Jsx` 组件，不支持 `import/require`。
- 平台 JSX 组件页面的图标来源仍只允许 `lucide-react` 或 `@ant-design/icons`，默认 `lucide-react`；但加载方式不是 import，而是已验证运行时脚本/global。emoji 报错时按 `iconSystem` 映射到这两类图标来源，不退成 CSS 图形、字母占位、Unicode 符号、iconfont 或临时 SVG。
- 使用 ES5 写法，避免平台 JSX 组件编译链不支持的语法；若当前平台 JSX 组件运行环境无法稳定加载图标库，必须去掉非必要图标或改用已验证资源，不能绕过图标规范。

## 19. 必须包含

列出硬性正向要求。每个视觉 DNA 都必须作为明确必选规则出现。必须包含 `styleDesignSelection`、`themeAdaptationResult` 和 `baseDesignSource`。若 `globalThemeInjection` 不是 `none`，必须包含 `style#yida-global-theme` / `customThemeStyle.tokens` 的落地规则。

## 20. 禁止项

列出硬性负向约束，覆盖会抹掉每个 DNA 的错误做法。必须包含：不得按行业或颜色直接套风格；不得为了还原风格凭空创造 PRD 未要求的模块；自定义主题名或任意色值不得传给 `create-app --theme`；不得只向当前页面 `document.head` 注入主题而漏掉同源父级 iframe。

## 21. 错误 vs 正确

用短对照保护视觉 DNA、快捷入口风格继承和主题运行时契约。

| 错误                                 | 正确                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| 看到绿色业务就选 `teal-rail`         | 先推演用户任务、信息拓扑和 requiredVisualDNA，再选风格；绿色只用于换肤 |
| 为了套时间轴风格新增不存在的阶段模块 | PRD 没有阶段/里程碑时排除时间轴风格                                    |
| 自定义色盘仍传 `--theme myBrand`     | 不传应用 theme，在页面复制 helper 注入 `style#yida-global-theme`       |
| 只在当前 iframe 写 style             | 同步当前文档和同源父级窗口文档                                         |
| PRD 里复制完整视觉规则               | PRD 只写摘要，完整 UI 规则写 design.md                                 |

## 22. Agent 使用提示

提供一段简洁提示词，明确告诉 AI 如何使用该 design.md。必须说明选中 style-design 只是设计风格来源，最终事实源是当前项目 `design.md`；视觉 DNA 在内容替换后也要保留；实现自定义色盘时必须读取 `yida-canvas-custom-page/references/theme-runtime-helpers.md` 并复制对应 helper。

## 23. 交付自检清单

- [ ] `baseDesignSource` 已写选中的 `references/style-designs/<style>.md`，或在所有内置风格不适用时说明 `generated-from-business-context` 原因。
- [ ] `styleDesignSelection` 已说明用户任务、信息拓扑、requiredVisualDNA、选中风格、排除风格和置信度。
- [ ] 设计风格选择依据来自业务结构和视觉 DNA 命中，不是行业、颜色或主观偏好。
- [ ] `themeAdaptationResult` 已说明输入主题色、换肤策略、replaced token、preservedVisualDNA 和 preservedMechanisms。
- [ ] 主题色遵守“换 hue，不换 DNA；换 token，不换结构”。
- [ ] 源图或参考业务内容已抽象为中性槽位。
- [ ] 文档识别了 2-5 个视觉 DNA / 设计母体。
- [ ] 每个 DNA 都包含证据、规则、实现钩子、失败表现和置信度。
- [ ] DNA 已同步进入必须包含、禁止项、错误 vs 正确、Agent 使用提示和最终自检。
- [ ] 若页面类型是工作台、仪表盘、管理后台或运营首页，文档已包含快捷入口区域。
- [ ] 可推断的 token 已给出具体值。
- [ ] 组件包含状态规则，而不只是静态外观。
- [ ] `iconSystem` 已声明默认图标库、可用图标库、尺寸、描边风格，并为快捷入口、按钮、状态、导航和空态提供具体 `actionIconMap` / `statusIconMap` / `navigationIconMap` / `emptyStateIconMap`。
- [ ] 已明确卡片圆角范围：0-32px，并说明业务卡片、主面板、控件和状态胶囊各自取值。
- [ ] 已明确紧凑密度默认值：状态摘要、动作条、列表行、空态高度、卡片 padding >20px、卡片 gap <20px 都有数值范围。
- [ ] 工作台/首页首屏没有超宽空 KPI 框、大空态白卡、无内容右栏或靠 margin/padding 撑出的空白。
- [ ] 响应式和可访问性规则完整。
- [ ] `themeProfile`、`yidaThemeRuntime` 和 `tokens` 一致。
- [ ] `backgroundLayer` 已说明基础画布、装饰方式和是否使用背景 primitive；若选择近白画布，已说明如何通过渐变、细线、素材或内容密度形成背景感。
- [ ] `surfaceContrast` 已说明页面背景与卡片背景的明确层次搭配，不存在相近或相同背景。
- [ ] 若使用 `topIrregularWash`、`flowLight` 或 `organicNoise`，已写清对比度、内容栅格和 reduced motion 静态降级。
- [ ] 自定义色盘没有传给 `create-app/update-app --theme`。
- [ ] 需要运行时主题时，已声明复制 `theme-runtime-helpers.md`，并覆盖当前窗口与同源父级窗口。
- [ ] 不依赖原截图，也能指导生成一个新页面。
```

## 交给实现阶段

- `yida-app` 读取 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md` 后创建或复用资源。
- 页面实现阶段读取 `prd.md` 的业务内容，并直接读取 `design.md` 的视觉 DNA、token、布局、组件、状态和 `Yida Global Theme Runtime Contract`。
- 页面实现交给 `yida-canvas-custom-page`。
- 只有走页面生成器或需要稳定交接时才派生 `page-spec.json`，并标记 `sourceOfTruth.prdFile/designFile`。`page-spec.json` 不复制完整 design.md，只保存与 design.md 一致的主题摘要和引用。
