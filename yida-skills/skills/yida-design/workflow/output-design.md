# 输出：design.md

> Step 6 自检通过后，写入 `prd/<项目名>/design.md`。`design.md` 是应用级 UI 视觉设计系统，结构以本文件为准，并参考 `references/style-designs/_design-md-template.md` 的字段完整度：先记录 style-design 模板选择依据和主题换肤结果，再写可复用视觉 DNA、token、布局、组件、状态和自检，最后写清页面技能交接摘要。

最终 `design.md` 的依据分四层：结构依据本文件和 `_design-md-template.md`；视觉 DNA、布局机制、组件机制和换肤规则依据选中的 `style-designs/*.md`；行业、用户、业务目标、页面场景、品牌和色彩偏好依据共享需求简报；主题 token 依据 Step 2 的主题色来源和所选模板的 `theme_adaptation`。

## design.md 输出格式

```markdown
---
version: 1.0
name: <应用或风格系统英文 slug>
description: <内容中立的中文用途说明>
design_id: <design-id>
design_status: ready
baseDesignSource: references/style-designs/<selected-template>.md
styleDesignSelection:
  inferredUserTask: <判断 / 处理 / 追踪 / 分析 / 展示 / 汇报>
  inferredInformationTopology: <摘要优先 + 趋势承接 + 明细落地>
  interactionFocus: <搜索筛选 / 待办处理 / 下钻详情 / 多入口跳转 / 趋势比较>
  requiredVisualDNA:
    - <dna-id>
  selectedStyleDesign:
    name: <template-name>
    source: references/style-designs/<selected-template>.md
    reason: <为什么该模板最适合当前业务>
  rejectedStyleDesigns:
    - <template-name>: <为什么不选>
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
  styleElementId: yida-global-theme
  themeScope: <app / page>
  tokenSource: design.md tokens
  parentShellExpectation: <follow-app-theme / page-level-theme / none>
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
    handoff_hooks: [<布局/组件/token/图表/状态交接点>]
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

## 2. 模板选择依据

说明 `styleDesignSelection` 的推演过程：当前业务的用户任务、信息拓扑、交互重心、必需视觉 DNA、选中模板和拒绝模板。选择理由必须来自业务结构和视觉 DNA 命中，不得按行业、颜色或主观偏好直接套模板。

## 3. 主题色与换肤结果

说明 `themeProfile` 和 `themeAdaptationResult`：主题色来源、是否命中平台主题 key、是否允许传给 `create-app/update-app --theme`、如何替换模板 `replace_tokens`、派生 `derive_tokens`、保留 `preserve_tokens` 和 `visual_dna.invariant`。必须明确“换 hue，不换 DNA；换 token，不换结构”。

## 4. 适用场景

列出适合和不适合使用该风格的场景。

## 5. 视觉氛围

说明运营工具感/表达型、克制/戏剧化、密度、留白、专业度等取向。

默认业务工具页采用“圆润但高密”的现代 B 端气质：业务面板和重点容器默认 20px 以上大圆角，页面信息密度默认 high，留白用于分组和阅读，不用于撑页面面积。只有官网、品牌页、展示页或用户明确要求舒展时，才把 density 调到 medium / comfortable。

## 6. 视觉 DNA / 设计母体

从选中 style-design 模板和当前业务结构中提取 2-5 个内容替换后仍必须保留的设计记忆点。每个 DNA 必须包含名称、证据、规则、交接钩子、失败表现和置信度；证据必须同时说明业务触发条件和模板来源。

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

说明页面壳、最大宽度、网格比例、间距、内容顺序和中性槽位关系。布局机制应来自选中模板的 `layout_stability`、`modules` 和共享需求简报中的页面场景，不得凭空增加需求简报未要求的图表、右侧栏、时间轴或深色舞台。

工作台、门户首页、管理后台和运营首页必须写清紧凑状态摘要、任务/记录列表、右侧上下文、高频动作条和薄空态行动。首屏不能出现超宽但内容稀疏的 KPI 横框、孤立大空态卡或右侧大面积留白；空白区域必须用最近记录、动态、风险、负责人、下一步动作、配置提示或薄空态行动承接。

## 10. 层级与深度

说明深度来自平面表面、边框、阴影、色调层、毛玻璃、覆盖层或空间效果，并说明哪些地方不该使用阴影。

### Background Layer Contract

展示型页面、工作台、看板、门户、官网、登录页和空状态页推荐使用有层次的页面画布，而不是无氛围的纯空白背景。画布可以接近白色，但应通过淡渐变、细线装饰、星芒、高光、插图、顶部不规则色块或内容密度形成背景感。背景层写成可交接字段 `backgroundLayer`，优先选择 1-2 个背景 primitive：

| primitive          | 适用场景                                   | 设计要求                                                                                             |
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

组件默认密度和呼吸规则必须写到可交接数值：状态摘要 64-88px 高，动作条 40-56px 高，列表行 44-56px，高频按钮 36-40px，卡片 padding 默认 22-28px 且必须大于 20px，卡片和卡片的 gap 默认 12-18px 且必须小于 20px。空状态默认嵌在列表/面板内部，使用薄提示行、补录/刷新/新建动作和简短说明；不得用 160px 以上大白卡只显示“暂无数据”。

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

## 18. 页面技能交接

只写页面技能需要消费的设计信息，不写 JSX、CSS、helper、import 方式或组件代码。主题关系必须写成清楚的交接摘要：

### Yida Theme Handoff

| 项目 | 规则 |
| --- | --- |
| 平台预置主题 | 只有 `themePresetKey` 命中平台预置 key 且 `shouldPassCreateAppTheme=true` 时，`create-app/update-app` 才传 `theme/colour` |
| 自定义色盘 | `shouldPassCreateAppTheme=false`，创建应用时不传 `theme/colour` |
| 主题作用域 | `themeScope=app` 表示应用级换肤；`themeScope=page` 表示单页独立色盘 |
| token 来源 | 页面技能只从本 `design.md` 的 `tokens` 和 `themeProfile` 取值，不临场另配 |
| 壳层关系 | 写清页面跟随应用主题、页面级独立主题或无运行时主题需求 |
| 交接边界 | 具体注入方式、组件代码、样式代码和发布链路由页面技能负责 |

## 19. 必须包含

列出硬性正向要求。每个视觉 DNA 都必须作为明确必选规则出现。必须包含 `styleDesignSelection`、`themeAdaptationResult` 和 `baseDesignSource`。若 `globalThemeInjection` 不是 `none`，必须写清主题作用域、token 来源和壳层关系。

## 20. 禁止项

列出硬性负向约束，覆盖会抹掉每个 DNA 的错误做法。必须包含：不得按行业或颜色直接套模板；不得为了还原模板凭空创造需求简报未要求的模块；自定义主题名或任意色值不得传给 `create-app --theme`；不得在设计文件中写主题注入代码，主题落地由页面技能处理。

## 21. 错误 vs 正确

用短对照保护视觉 DNA、快捷入口风格继承和主题运行时契约。

| 错误                                 | 正确                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| 看到绿色业务就选 `teal-rail`         | 先推演用户任务、信息拓扑和 requiredVisualDNA，再选模板；绿色只用于换肤 |
| 为了套时间轴模板新增不存在的阶段模块 | 需求简报没有阶段/里程碑时拒绝时间轴模板                               |
| 自定义色盘仍传 `--theme myBrand`     | 不传应用 theme，把自定义色盘写入 `themeProfile` 和 `tokens`            |
| 主题作用域不清                       | 明确 `themeScope=app/page`，并说明页面跟随应用主题还是单页独立色盘     |
| 在其他文件复制完整视觉规则           | 完整 UI 规则只写在 design.md                                            |

## 22. Agent 使用提示

提供一段简洁提示词，明确告诉 AI 如何使用该 design.md。必须说明选中 style-design 只是设计母体，最终事实源是当前项目 `design.md`；视觉 DNA 在内容替换后也要保留；页面技能根据自身链路选择实现指南，不从 `yida-design` 补写源码细节。

## 23. 交付自检清单

- [ ] `baseDesignSource` 已写选中的 `references/style-designs/<template>.md`，或在所有模板不适用时说明 `generated-from-business-context` 原因。
- [ ] `styleDesignSelection` 已说明用户任务、信息拓扑、requiredVisualDNA、选中模板、拒绝模板和置信度。
- [ ] 模板选择依据来自业务结构和视觉 DNA 命中，不是行业、颜色或主观偏好。
- [ ] `themeAdaptationResult` 已说明输入主题色、换肤策略、replaced token、preservedVisualDNA 和 preservedMechanisms。
- [ ] 主题色遵守“换 hue，不换 DNA；换 token，不换结构”。
- [ ] 源图或参考业务内容已抽象为中性槽位。
- [ ] 文档识别了 2-5 个视觉 DNA / 设计母体。
- [ ] 每个 DNA 都包含证据、规则、交接钩子、失败表现和置信度。
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
- [ ] 需要运行时主题时，已写清主题作用域、token 来源和壳层关系。
- [ ] 不依赖原截图，也能指导生成一个新页面。
```

## 交给页面技能

- `yida-app` 读取 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md` 后创建或复用资源。
- 页面技能读取 `prd.md` 的业务内容，并直接读取 `design.md` 的视觉 DNA、token、布局、组件、状态和 `Yida Theme Handoff`。
- 只有走页面生成器或需要稳定交接时才派生 `page-spec.json`，并标记 `sourceOfTruth.prdFile/designFile`。`page-spec.json` 不复制完整 design.md，只保存与 design.md 一致的主题摘要和引用。
