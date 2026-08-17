---
version: alpha
template_type: visual_dna_preset
name: soft-blue-grid-analytic-dashboard
design_id: visual-dna-soft-blue-grid-analytic-dashboard
design_status: draft
description: 适用于通用数据仪表盘、运营工作台、管理后台首页和分析概览页的内容中立视觉 DNA，以浅灰画布、白色软边框面板、蓝色焦点图表、胶囊命令控件和左右分栏网格构成清爽、稳定、可扫描的界面。
scenes: [workbench, dashboard, admin_console, analytic_overview, operation_home]
density: medium
layout: header_controls_metric_row_two_column_analytic_grid
tone: [clean, calm, precise, soft, data_focused]
tags: [light_canvas, soft_cards, blue_accent, analytic_grid, modular_panels]
avoid: [marketing_landing_page, editorial_content_site, immersive_gallery, playful_game, long_form_article, dense_transaction_table]
selection:
  best_for: [数据仪表盘, 指标概览页, 管理后台首页, 运营工作台, 分析看板, 列表加图表混合页]
  user_intent: [快速扫描状态, 对比周期变化, 查看趋势与分布, 从概览下钻到明细, 触发少量全局操作]
  visual_tone: [浅色克制, 柔和圆角, 精细边框, 低阴影, 蓝色小面积点亮, 数据可视化优先]
  avoid_for: [品牌叙事页, 图片优先展示页, 暗色大屏, 纯表单流程, 单一长表格页面]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: soft_metric_card_row
    name: 四宫格软边框指标卡行
    confidence: observed
    evidence: 顶部首屏有一排等高白色指标卡，卡片使用大圆角、极浅边框和轻阴影，主数字醒目，趋势徽标小面积贴近数字。
    rule: 新页面的首屏必须先提供 3-4 个等高 metric_card，用大号数字、短标题、状态徽标和弱化说明形成一眼可扫的摘要层。
    implementation_hooks: [metric_grid, metric_card, delta_badge, icon_corner, comparison_caption, equal_height_grid]
    failure_mode: 如果指标卡高度不齐、边框过重或数字层级不足，页面会变成普通后台表单，失去轻量数据概览记忆点。
  - id: pill_command_header
    name: 右对齐胶囊命令头
    confidence: observed
    evidence: 页面标题左置，右侧是日期筛选、时间范围、次级按钮和蓝色主按钮，所有控件都呈胶囊形并对齐在同一水平线上。
    rule: 顶部必须保留左标题、右命令组的结构；筛选器、次级操作和主操作都使用圆角胶囊控件，主操作以蓝色填充突出。
    implementation_hooks: [page_header, date_filter, segmented_filter, secondary_button, primary_button, icon_button, control_group]
    failure_mode: 如果顶部命令分散、按钮棱角化或主操作不突出，会破坏截图中安静但明确的工具感。
  - id: blue_focus_visualization
    name: 蓝色焦点数据可视化
    confidence: observed
    evidence: 折线、选中柱、主按钮和图标都使用饱和蓝色；图表背景保持白色，其他数据序列使用浅灰或半透明弱化。
    rule: 图表中只允许 1 个主蓝色焦点序列，辅助序列、未选中柱和网格线必须低对比；可使用渐变填充、提示浮层和选中态强化判断。
    implementation_hooks: [line_chart, area_fill, bar_chart_selected, gauge_segment, chart_tooltip, chart_grid, brand_blue]
    failure_mode: 如果多色抢焦、网格线过重或图表缺少蓝色主序列，页面会丢失统一的分析焦点。
  - id: modular_two_column_canvas
    name: 左宽右窄模块化分析画布
    confidence: observed
    evidence: 页面主体以左侧宽内容列承载趋势和明细，右侧窄列垂直堆叠分布、比例和辅助模块，所有面板边缘对齐。
    rule: 桌面端主区域必须采用 8:5 或 2:1 近似分栏，左侧放 trend_panel 与 detail_table，右侧放 breakdown_panel、ratio_panel 或 assistant_panel 等辅助模块。
    implementation_hooks: [main_grid, left_column, right_rail, trend_panel, detail_table, auxiliary_panel, align_items_stretch]
    failure_mode: 如果改成瀑布流或所有模块自由堆叠，会失去原图稳定、平衡、可扫描的工作台结构。
  - id: rounded_micro_detail
    name: 圆角微细节与轻量悬浮层
    confidence: observed
    evidence: 面板、表格缩略图、输入框、趋势徽标、提示浮层都使用统一圆角；阴影极轻，悬浮提示像白色小面板压在图表上。
    rule: 所有局部组件必须继承统一圆角系统和浅边框；tooltip、popover、输入区、标签和缩略图用轻阴影制造层级，不使用厚重卡片阴影。
    implementation_hooks: [rounded_tokens, tooltip, popover, input_shell, table_thumbnail, status_pill, subtle_shadow]
    failure_mode: 如果圆角尺度混乱、阴影过重或局部组件没有浅边框，界面会显得粗糙且不再像同一套系统。
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_accent_hue_preserve_light_canvas
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring, tokens.colors.chart-primary]
  derive_tokens: [tokens.colors.chart-primary-soft, tokens.colors.chart-selected-fill, tokens.colors.status-info]
  preserve_tokens: [tokens.colors.bg-app, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.colors.shadow-color]
  rules:
    - 主题色只替换小面积强调色、选中态、主按钮和主图表序列。
    - 不要把页面背景、卡片底色或表格区域整体染成主题色。
    - 保留浅灰外层画布、白色面板、低阴影和软边框机制。
    - 状态色可随品牌轻微调整，但正向、负向、中性必须仍能被区分。
tokens:
  colors:
    bg-app: "#f4f7fa"
    bg-page: "#f4f7fa"
    surface: "#ffffff"
    surface-muted: "#f6f8fb"
    surface-soft: "#eef2f6"
    text-primary: "#0f1217"
    text-secondary: "#6f7782"
    text-tertiary: "#9aa3ad"
    border-subtle: "#e4e9ef"
    border-strong: "#d7dee7"
    brand: "#2f6ff4"
    brand-strong: "#1f5ee6"
    brand-soft: "#eaf2ff"
    focus-ring: "rgba(47, 111, 244, 0.28)"
    status-positive: "#39b981"
    status-positive-soft: "#e8f8f0"
    status-negative: "#e84f83"
    status-negative-soft: "#fdebf2"
    status-warning: "#f59e0b"
    status-warning-soft: "#fff5dc"
    chart-primary: "#2f6ff4"
    chart-primary-soft: "rgba(47, 111, 244, 0.16)"
    chart-secondary: "#45c38a"
    chart-tertiary: "#ff8a2d"
    chart-muted: "#e8edf3"
    chart-grid: "#e9eef4"
    chart-selected-fill: "linear-gradient(180deg, #2f6ff4 0%, #4f8bff 100%)"
    shadow-color: "rgba(18, 31, 44, 0.08)"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 32, fontWeight: 700, lineHeight: 1.18, letterSpacing: 0 }
    section-title: { fontSize: 22, fontWeight: 650, lineHeight: 1.25, letterSpacing: 0 }
    card-title: { fontSize: 20, fontWeight: 650, lineHeight: 1.3, letterSpacing: 0 }
    metric-main: { fontSize: 34, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0 }
    metric-hero: { fontSize: 46, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    caption: { fontSize: 14, fontWeight: 400, lineHeight: 1.35, letterSpacing: 0 }
    table-head: { fontSize: 12, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0.04em }
  spacing:
    page-x-desktop: 36
    page-x-tablet: 24
    page-x-mobile: 16
    page-y: 28
    header-gap: 16
    grid-gap: 24
    panel-x: 28
    panel-y: 24
    card-x: 28
    card-y: 24
    control-gap: 10
    row-gap: 18
  rounded:
    control: 18
    control-lg: 24
    panel: 28
    card: 24
    inner-card: 18
    icon-tile: 10
    status-pill: 10
    tooltip: 10
  shadow:
    panel: "0 1px 2px rgba(18, 31, 44, 0.04), 0 10px 24px rgba(18, 31, 44, 0.035)"
    floating: "0 8px 24px rgba(18, 31, 44, 0.12)"
    control: "0 1px 2px rgba(18, 31, 44, 0.06)"
    primary_button: "0 8px 18px rgba(47, 111, 244, 0.22)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  min_width_policy: "min-width: 0 on all grid children"
  min_height_policy: "min-height: 0 on nested flex panels"
  fixed_height_tokens:
    page_header: 56px
    command_control: 48px
    metric_card: 168px
    trend_panel: 440px
    side_chart_panel: 300px
    ratio_panel: 300px
    assistant_panel: 320px
    detail_panel: 560px
    quick_action_item: 82px
    table_row: 76px
components:
  card:
    backgroundColor: "{tokens.colors.surface}"
    border: "1px solid {tokens.colors.border-subtle}"
    borderRadius: "{tokens.rounded.card}px"
    boxShadow: "{tokens.shadow.panel}"
  primary_button:
    height: 48
    borderRadius: "{tokens.rounded.control-lg}px"
    backgroundColor: "{tokens.colors.brand}"
    color: "#ffffff"
  secondary_button:
    height: 48
    borderRadius: "{tokens.rounded.control-lg}px"
    backgroundColor: "{tokens.colors.surface}"
    border: "1px solid {tokens.colors.border-subtle}"
  badge:
    borderRadius: "{tokens.rounded.status-pill}px"
    padding: "4px 10px"
inferred_modules:
  quick_actions:
    required_for: [工作台, 仪表盘, 管理后台, 运营首页]
    confidence: inferred
    rule: 截图未出现独立快捷入口，但页面类型通常需要；快捷入口应放在指标卡之后或右侧辅助列顶部，使用白色软边框容器、紧凑图标块、短标签和可选弱化说明，不引入彩色宫格或营销插画。
---

# Soft Blue Grid Analytic Dashboard DESIGN.md

## 1. 总览

这是一套内容中立的浅色数据工作台视觉规范，适合把多组摘要、趋势、分布、比例、辅助输入和明细列表组织在同一个首屏或连续画布中。它的核心不是具体业务，而是“浅灰画布 + 白色软边框模块 + 蓝色单焦点可视化 + 稳定分栏网格”的组合。

界面应保持中等信息密度：首屏能快速扫到 `page_title`、`global_filters`、`primary_metrics` 和主要 `trend_panel`，下方再承接 `detail_table` 或 `detail_list`。所有模块以中性槽位命名，具体指标、记录、商品、人名、业务状态都由后续 PRD 注入。

这套风格的可识别感来自边界精细、留白充足、数字层级强、图表克制和局部圆角统一。生成页面时可以替换主题色和业务内容，但不能改变这些视觉母体。

## 2. 适用场景 / 不适用场景

适用场景：

- `dashboard`、`workbench`、`admin_console`、`analytic_overview`、`operation_home`。
- 需要同时展示 `primary_metrics`、`trend_panel`、`breakdown_panel`、`ratio_panel`、`detail_table` 的页面。
- 用户目标是快速判断状态、比较变化、查看明细、执行少量全局操作。
- 需要专业、轻量、干净、可长期使用的后台类界面。

不适用场景：

- 营销落地页、品牌叙事页、长文章、图片画廊、沉浸式大屏。
- 高压交易系统或需要极高密度行列信息的纯表格页面。
- 需要强个性插画、深色科技感、夸张渐变背景的页面。
- 单一步骤表单或移动端原生任务流。

## 3. 视觉氛围

- 工作台工具感强于表达型页面，整体安静、克制、可靠。
- 信息密度为 `medium`：卡片多但留白充足，数字和图表优先于大段说明。
- 视觉亮点集中在蓝色焦点元素、状态徽标、选中图表和主按钮上。
- 背景保持浅灰，面板保持白色，避免单一蓝色铺满页面。
- 边框、阴影和圆角共同制造轻浮层感，但深度必须很浅。

## 4. 视觉 DNA / 设计母体

### 4.1 四宫格软边框指标卡行

- **置信度**：observed
- **可见证据**：首屏顶部有一排等高白色指标卡，主数字很大，标题短，角落放小图标，趋势徽标贴近主数值。
- **复用规则**：首屏摘要必须优先出现 3-4 个 `metric_card`，桌面端同一行等高，卡片内部用标题、主值、趋势徽标、弱化对比说明组成固定结构。
- **实现钩子**：`metric_grid`、`metric_card`、`metric-main`、`delta_badge`、`icon_corner`、`comparison_caption`。
- **缺失后的失败表现**：指标卡如果高度参差、数字不突出或用强色块填充，会变成普通数据卡集合，失去轻量、精致、可扫读的首屏记忆点。

### 4.2 右对齐胶囊命令头

- **置信度**：observed
- **可见证据**：页面标题左置，右侧筛选、次级操作、主操作组成胶囊控件组，主操作为蓝色填充。
- **复用规则**：`page_header` 必须使用左标题右命令组；筛选、选择器、次级按钮和主按钮高度一致，圆角接近胶囊，图标与文字基线对齐。
- **实现钩子**：`page_header`、`global_filters`、`date_filter`、`segmented_filter`、`secondary_button`、`primary_button`、`control_group`。
- **缺失后的失败表现**：命令散落到卡片内部或按钮样式不统一时，页面会丢失成熟仪表盘的全局操作秩序。

### 4.3 蓝色焦点数据可视化

- **置信度**：observed
- **可见证据**：折线、选中柱、主按钮、图标和发送控件使用统一蓝色；辅助数据为浅灰、淡绿或低饱和状态色。
- **复用规则**：每个图表只设置一个主焦点色；辅助序列降低不透明度，网格线轻，tooltip 使用白底轻阴影，选中态可叠加渐变或强调标签。
- **实现钩子**：`line_chart`、`area_fill`、`bar_chart_selected`、`gauge_segment`、`chart_tooltip`、`chart-grid`。
- **缺失后的失败表现**：多色图表、厚重网格或全页面蓝色化会让视线无法聚焦，削弱原风格的专业分析感。

### 4.4 左宽右窄模块化分析画布

- **置信度**：observed
- **可见证据**：主体区域左侧为宽趋势面板和明细表，右侧为窄分析面板纵向堆叠，模块边缘和间距稳定对齐。
- **复用规则**：桌面端主网格采用左宽右窄结构，建议 `grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr)`；左列承载主趋势和明细，右列承载辅助判断、比例、输入或推荐模块。
- **实现钩子**：`main_grid`、`left_column`、`right_rail`、`trend_panel`、`detail_table`、`auxiliary_panel`、`align-items: stretch`。
- **缺失后的失败表现**：瀑布流、随内容变高的散卡或左右列宽无规律，会破坏原图平衡的工作台画布。

### 4.5 圆角微细节与轻量悬浮层

- **置信度**：observed
- **可见证据**：面板、按钮、输入框、表格缩略图、状态徽标和图表 tooltip 都有统一圆角；阴影很轻，不制造厚重层叠。
- **复用规则**：从大面板到小徽标使用分级圆角 token；tooltip、popover、输入区、内嵌小卡使用白底、浅边框和轻阴影。
- **实现钩子**：`rounded_tokens`、`tooltip`、`popover`、`input_shell`、`table_thumbnail`、`status_pill`、`subtle_shadow`。
- **缺失后的失败表现**：圆角尺度随机、阴影太重或局部组件裸露无边界，会让页面显得粗糙、不统一。

## 5. 色彩角色

| Token | 值 | 用途 |
| --- | --- | --- |
| `bg-app` | `#f4f7fa` | 页面外层浅灰画布，承托白色面板 |
| `surface` | `#ffffff` | 主卡片、面板、浮层、控件背景 |
| `surface-muted` | `#f6f8fb` | 输入底、表格头、弱化容器、未选中柱 |
| `surface-soft` | `#eef2f6` | 图表中性条、轻量分割背景 |
| `text-primary` | `#0f1217` | 标题、主数字、关键文本 |
| `text-secondary` | `#6f7782` | 描述、轴标签、次级说明 |
| `text-tertiary` | `#9aa3ad` | 占位、弱按钮、辅助图标 |
| `border-subtle` | `#e4e9ef` | 面板、控件、表格行边界 |
| `border-strong` | `#d7dee7` | 选中或 hover 的边框增强 |
| `brand` | `#2f6ff4` | 主按钮、主图表序列、选中态、强调图标 |
| `brand-soft` | `#eaf2ff` | 蓝色选中背景、轻量徽标底色 |
| `status-positive` | `#39b981` | 正向趋势、通过、增长 |
| `status-positive-soft` | `#e8f8f0` | 正向徽标背景 |
| `status-negative` | `#e84f83` | 负向趋势、异常、下降 |
| `status-negative-soft` | `#fdebf2` | 负向徽标背景 |
| `status-warning` | `#f59e0b` | 注意、评分、提醒 |
| `chart-grid` | `#e9eef4` | 图表网格线和轴线 |
| `shadow-color` | `rgba(18, 31, 44, 0.08)` | 轻量投影基础色 |

图表色序列建议：`brand` 作为主序列，`chart-muted` 作为未选中或历史序列，`status-positive` / `status-negative` 只用于表达明确状态，`chart-tertiary` 只用于第三类维度，禁止同时使用过多高饱和色。

## 6. 字体规则

- 字体栈：`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`。
- `page_title`：32px / 700 / line-height 1.18。
- `section_title`：22px / 650 / line-height 1.25。
- `card_title`：20px / 650 / line-height 1.3。
- `metric_main`：34px / 700 / line-height 1.05。
- `metric_hero`：46px / 700 / line-height 1.05。
- 正文：16px / 400 / line-height 1.5。
- 辅助说明：14px / 400 / line-height 1.35。
- 表头：12px / 700 / line-height 1.2，可使用轻微大写；中文表头不强制大写。
- 所有文字 `letter-spacing: 0`，除表头可使用 `0.04em` 增强扫描。
- 数字使用 `font-variant-numeric: tabular-nums`，金额、百分比、计数和坐标轴都应对齐。
- 禁止用视口宽度缩放字号；移动端只做断点级字号调整。

## 7. 布局原则

- 页面外层：`min-height: 100vh`，背景 `bg-app`，内边距桌面端 36px，平板 24px，移动端 16px。
- 顶部结构：`page_header` 左侧为 `page_title`，右侧为 `global_filters` 与 `global_actions`；窄屏允许换行。
- 摘要结构：`primary_metrics` 使用 4 列等高网格；空间不足时降为 2 列或单列。
- 主体结构：`main_grid` 桌面端左宽右窄，左列放主趋势和明细，右列放辅助图表、比例、输入或建议模块。
- 模块间距：统一使用父级 `gap: 24px`；组件内部再用 8/12/16/20/24px 节奏。
- 内容槽位：使用 `trend_panel`、`breakdown_panel`、`ratio_panel`、`assistant_panel`、`detail_table`、`quick_actions`、`status_note` 等中性名称，不把业务名称写死在设计规范里。

推荐桌面结构：

```text
page_shell
  page_header
    page_title
    global_filters
    global_actions
  primary_metrics
    metric_card x 3-4
  main_grid
    left_column
      trend_panel
      detail_table
    right_rail
      breakdown_panel
      ratio_panel
      assistant_or_status_panel
```

## 8. 布局稳定性硬规则

- 主网格必须使用 `align-items: stretch`；桌面端同一行同类面板顶部、底部对齐。
- 所有主面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。
- 面板标题区固定高度或自然高度，内容区使用 `flex: 1; min-height: 0`。
- 图表容器必须有固定高度或稳定高度范围：`trend_panel` 约 440px，`side_chart_panel` 约 300px，`ratio_panel` 约 300px。
- `metric_card` 建议 168px 高；`quick_action_item` 建议 82px 高；`detail_panel` 建议 560px 高；`table_row` 建议 76px 高。
- 表格、列表、聊天输入、图表 tooltip 和长文本必须在面板内部滚动、截断或折叠，不能撑破外层 grid。
- 页面区块间距由父级 `grid` / `flex` 的 `gap` 管理，禁止用零散 `margin-bottom` / `margin-top` 拼接大结构。
- 移动端可切为单列并解除桌面等高要求，但仍要保留控件高度、文字截断、图表固定高度和内部滚动策略。
- 禁止瀑布流、`align-items: start`、自由高度卡片、无固定高度图表容器、长内容撑破父级和外边距拼接造成的错位。

## 9. 层级与深度

- 第一层：浅灰页面画布，无装饰渐变、无大面积图案。
- 第二层：白色面板，以 `1px` 浅边框和非常轻的阴影浮在画布上。
- 第三层：内嵌小卡、输入框、表格缩略图，使用更轻的边框和局部浅底。
- 第四层：tooltip、popover、下拉菜单，使用白底、浅边框、`floating` 阴影和 10-14px 圆角。
- 主按钮可使用蓝色阴影，但阴影范围要小，不能扩散成发光效果。
- 图表面积填充可以使用透明蓝渐变，但不应成为背景装饰。

## 10. 形状规则

- `panel`: 28px，用于主面板和大型卡片。
- `card`: 24px，用于指标卡和分组卡片。
- `inner-card`: 18px，用于嵌套条目、输入容器、快捷入口。
- `control-lg`: 24px，用于顶部胶囊按钮和筛选器。
- `control`: 18px，用于普通输入框、选择器和组合控件。
- `status-pill`: 10px，用于趋势徽标、状态标签、短文本徽章。
- `icon-tile`: 10px，用于表格缩略图、图标容器。
- 圆角必须成体系递减，禁止在同一层级随机混用 4px、8px、32px、999px。

## 11. 组件样式

### 顶部栏 / 命令区

- `page_header` 高度约 56px，左侧标题，右侧控件组。
- 筛选器和按钮高度统一为 48px，白底、浅边框、胶囊圆角。
- 主操作为蓝底白字，可带图标；次级操作白底黑字。
- 控件间距 10-12px，移动端允许折行但保持统一高度。

状态：

- hover：边框提升到 `border-strong`，白色控件背景略亮或阴影略增。
- active：蓝色按钮降低亮度到 `brand-strong`；白色控件背景改为 `surface-muted`。
- focus：显示 `2px` 蓝色 focus ring，不能只靠阴影。
- disabled：透明度 0.48，禁用点击和 hover 阴影。

### 指标卡 / 面板

- 背景为 `surface`，边框 `border-subtle`，圆角 24-28px。
- 内边距 24-28px；标题在左上，图标在右上或标题旁。
- 主数字必须明显大于标题和说明；趋势徽标贴近数字，不另起大面积色块。
- 说明文本使用 `text-secondary`，最多两行。
- 面板标题右侧可放 `more_button`，用纯图标并提供 `aria-label`。

### 图表

- 主序列使用蓝色，辅助序列使用浅灰、虚线或低透明度。
- 网格线和坐标轴必须低对比，轴标签使用 `text-secondary`。
- 折线可叠加淡蓝面积填充，但填充透明度不超过 18%。
- 柱状图未选中柱使用浅灰，选中柱使用蓝色垂直渐变。
- 半环图可使用分段刻度，已完成部分用状态色，未完成部分用 `chart-muted`。
- tooltip 白底、浅边框、轻阴影、10-14px 圆角；可用一条细色线标识主序列。

### 表格 / 列表

- 表格置于白色大面板内，表头小字号、弱文字、底部分割线。
- 行高 72-76px；行间用浅虚线或浅实线分隔。
- 首列可为编号、头像、缩略图或图标容器，但必须使用统一小圆角浅底。
- 长文本使用单行截断，必要时 tooltip 展示完整内容。
- 数值列右对齐或按列对齐，状态值用颜色和图标共同表达。

### 输入框 / 辅助输入模块

- 输入容器白底或极浅灰底，圆角 24px，内含左侧附件/辅助图标、文本输入和右侧动作按钮。
- 右侧主动作使用圆形或胶囊蓝色按钮，尺寸不小于 40px。
- 占位文本使用 `text-secondary`，真实输入文本使用 `text-primary`。

### 标签 / 徽标

- 趋势徽标使用浅底色和小图标，文案短，内边距约 `4px 10px`。
- 正向为绿，负向为粉红，警示为琥珀；不要只靠颜色表达方向。
- 徽标不能变成大面积横幅。

### 浮层 / 弹窗

- 使用白底、浅边框、10-16px 圆角和轻阴影。
- 宽度按内容约束，避免撑满面板。
- 浮层内容只显示关键值、短标签和必要操作，不放长说明。

### 空状态 / 错误状态

- 空状态放在面板内容区中央，使用轻量线性图标、短标题、弱说明和一个可选次级按钮。
- 错误状态保留面板高度，展示简短错误原因和重试按钮；不要让面板塌陷。
- 加载状态使用骨架屏或淡灰占位，保持固定高度。

## 12. 快捷入口区域

截图未出现独立快捷入口，但该页面类型通常需要 `quick_actions`。本风格按整体视觉 DNA 推断快捷入口，置信度为 `inferred`。

- 位置：放在 `primary_metrics` 之后、`main_grid` 之前；或放在 `right_rail` 顶部作为辅助操作面板。不要抢占 `metric_card` 和主图表。
- 容器：白色软边框面板，圆角 24-28px，内边距 20-24px，阴影同普通面板。
- 条目：使用 `quick_action_item`，包含 `action_icon`、`action_label`、可选 `action_meta`、可选 `action_badge`。
- 数量：桌面端 4-8 个；超过 8 个应分组、折叠或横向滚动。
- 图标：线性或小面性图标，放在 36-40px 的浅蓝或浅灰图标容器中；不要使用大插画。
- 文字：`action_label` 14-15px / 600，一行截断；`action_meta` 12-13px / 400，弱化为 `text-secondary`。
- 状态：hover 时边框增强并出现轻微上浮；active 时背景转 `surface-muted`；focus 有蓝色 ring；disabled 降低透明度且保留布局尺寸；loading 保留条目高度并显示小型 spinner 或骨架。
- 响应式：桌面 4 列或 6 列，平板 2-4 列，移动端 2 列或横向滚动；触控目标不小于 44px。
- 与 DNA 的关系：快捷入口必须继承软边框卡片、胶囊/圆角控件、蓝色小面积焦点和父级 gap 布局。
- 禁止漂移：不要做成彩色宫格、营销卡片、超大插画入口、无边界按钮墙或深色命令面板。

## 13. 页面结构配方

### 配方 A：标准分析工作台

```text
page_shell
  page_header
    page_title
    global_filters
    global_actions
  primary_metrics
    metric_card x 4
  quick_actions
    quick_action_item x 4-8
  main_grid
    left_column
      trend_panel
      detail_table
    right_rail
      breakdown_panel
      ratio_panel
      assistant_panel
```

### 配方 B：摘要 + 趋势 + 明细

```text
page_shell
  page_header
  primary_metrics
  main_grid
    left_column
      hero_metric_with_trend
      supporting_breakdown
      detail_table
    right_rail
      vertical_bar_panel
      ratio_panel
      status_note
```

### 配方 C：辅助输入工作台

```text
page_shell
  page_header
  primary_metrics
  main_grid
    left_column
      trend_panel
      detail_list
    right_rail
      quick_actions
      assistant_panel
        supporting_media
        input_shell
```

## 14. 状态与交互

- hover：卡片和按钮只做轻微边框增强、阴影增强或 `translateY(-1px)`；不要有大幅位移。
- active：主按钮使用更深蓝色，白色控件使用浅灰底。
- selected：用蓝色主序列、浅蓝底或蓝色描边表达；同一区域只允许一个强选中焦点。
- focus：所有按钮、输入、菜单项、表格行操作都必须有 2px focus ring。
- loading：保留原模块尺寸，用骨架线、浅灰柱或 spinner；图表加载时保持坐标区域高度。
- empty：保持面板高度，用中性空状态替代内容，不让布局塌陷。
- error：使用短文案 + 重试动作，状态色和图标同时出现。
- disabled：降低透明度到 0.48-0.56，禁用 pointer 交互。
- 动效：120-180ms，`ease-out`；图表入场可 220ms 内完成。
- reduced motion：关闭上浮和图表绘制动画，只保留状态变化。

## 15. 响应式行为

- `>= 1200px`：使用完整结构，`primary_metrics` 4 列，主体左宽右窄。
- `900px - 1199px`：指标卡 2-4 列，右侧栏可移到主趋势下方，仍保持卡片等高。
- `640px - 899px`：顶部命令换行，主体单列或两列，表格横向滚动。
- `< 640px`：单列布局，页面边距 16px，控件高度保留 44-48px，指标卡 1-2 列。
- 移动端图表高度不低于 260px，表格使用横向滚动或列表化摘要。
- 长标题、按钮文案和表格单元格必须截断或换行，不能覆盖相邻内容。

## 16. 可访问性

- 正文和关键数值对比度至少达到 WCAG AA；弱说明也不能低于 4.5:1 的可读阈值，除非是装饰性占位。
- 纯图标按钮必须提供 `aria-label` 和 hover/focus tooltip。
- 趋势、评分、异常不能只靠颜色表达，需配合箭头、符号、图标或文字。
- 所有交互控件触控目标不小于 44px。
- 表格必须有明确列标题；排序、筛选、选中状态需要可被辅助技术感知。
- 图表需提供摘要文本或数据表替代信息。
- 支持键盘导航，focus 顺序遵循从顶部命令到摘要、主体、明细的阅读顺序。

## 17. 实现适配

### CSS 变量

```css
:root {
  --oyd-bg-app: #f4f7fa;
  --oyd-surface: #ffffff;
  --oyd-surface-muted: #f6f8fb;
  --oyd-text-primary: #0f1217;
  --oyd-text-secondary: #6f7782;
  --oyd-border-subtle: #e4e9ef;
  --oyd-brand: #2f6ff4;
  --oyd-brand-soft: #eaf2ff;
  --oyd-positive: #39b981;
  --oyd-negative: #e84f83;
  --oyd-radius-panel: 28px;
  --oyd-radius-card: 24px;
  --oyd-radius-control: 24px;
  --oyd-shadow-panel: 0 1px 2px rgba(18, 31, 44, 0.04), 0 10px 24px rgba(18, 31, 44, 0.035);
  --oyd-gap: 24px;
}
```

### 布局骨架

```css
.page-shell {
  min-height: 100vh;
  padding: 28px 36px;
  background: var(--oyd-bg-app);
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr);
  gap: var(--oyd-gap);
  align-items: stretch;
}

.panel {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--oyd-border-subtle);
  border-radius: var(--oyd-radius-panel);
  background: var(--oyd-surface);
  box-shadow: var(--oyd-shadow-panel);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
```

### Ant Design / React

- `Button`、`DatePicker`、`Select`、`Input` 高度统一到 44-48px，圆角设置为 18-24px。
- `Card` 不使用默认厚阴影，改为浅边框 + 轻阴影。
- 表格行高 72-76px，列标题弱化，长文本使用 `ellipsis`。
- 图表建议使用 ECharts / Recharts，主题 token 映射到 `brand`、`chart-muted`、`status-positive`、`status-negative`。

### Yida / YidaCodeCanvas

- 页面根节点重置 `box-sizing: border-box`，避免宜搭容器默认样式影响布局。
- 图表和表格容器必须设定稳定高度，发布前检查不同宽度下是否溢出。
- 图标按钮必须带可读标签或 tooltip，适配钉钉内嵌浏览器的键盘和触控行为。

## 18. 必须包含

- 必须保留 `soft_metric_card_row`：首屏 3-4 个等高软边框指标卡，大数字、短标题、小趋势徽标和弱说明。
- 必须保留 `pill_command_header`：左标题右命令组，胶囊筛选器和蓝色主操作对齐。
- 必须保留 `blue_focus_visualization`：图表以一个蓝色主焦点序列为核心，辅助元素低对比。
- 必须保留 `modular_two_column_canvas`：桌面端左宽右窄，左侧主分析与明细，右侧辅助模块堆叠。
- 必须保留 `rounded_micro_detail`：圆角 token、浅边框、轻阴影贯穿面板、控件、浮层和细节组件。
- 工作台、仪表盘、管理后台、运营首页必须包含 `quick_actions`，除非 PRD 明确不需要快捷入口。
- 所有图表、表格、列表、快捷入口必须有固定高度或内部滚动策略。
- 所有内容都必须使用中性槽位承载，不写死具体业务指标、商品、人物、行业术语或示例数据。

## 19. 禁止项

- 禁止把源截图中的具体指标名、日期、商品、列表项、助手文案或示例数字写进最终业务页面。
- 禁止把页面做成深色大屏、营销 hero、图片展示页或一整屏蓝色渐变背景。
- 禁止指标卡自由高度、瀑布流排列、`align-items: start` 或用外边距拼接网格。
- 禁止图表使用多种高饱和颜色抢焦，或让辅助序列比主蓝色序列更强。
- 禁止顶部命令区控件高度不一、圆角不一、主次操作不清。
- 禁止面板阴影过重、边框过黑、圆角随机、内部元素撑破面板。
- 禁止快捷入口变成默认彩色宫格、超大插画卡、无边界图标墙或与软边框体系无关的独立模块。
- 禁止用纯颜色表达状态，必须配合图标、文字或方向符号。

## 20. 错误 vs 正确

| 错误 | 正确 |
| --- | --- |
| 顶部摘要卡数量随机、高度随内容变化 | 3-4 个 `metric_card` 等高排列，标题、数字、徽标、说明结构稳定 |
| 页面标题、筛选器、按钮分散在不同面板里 | `page_header` 左标题右命令组，胶囊控件同高同基线 |
| 图表所有序列都使用高饱和色 | 只保留一个蓝色焦点序列，辅助序列用浅灰或低透明度 |
| 主体模块按内容自然堆叠成瀑布流 | 桌面端使用左宽右窄 `main_grid`，面板边缘对齐 |
| tooltip 和输入框无边框或阴影厚重 | 白底、浅边框、轻阴影、统一圆角 |
| 快捷入口做成彩色大按钮宫格 | `quick_actions` 继承白色软边框容器、浅图标块和蓝色小面积焦点 |
| 表格长文本撑宽页面 | 单行截断、tooltip 补充、表格容器内部横向滚动 |
| 移动端直接压缩桌面网格 | 移动端改为单列或 2 列，保留 44px 触控目标和稳定图表高度 |

## 21. Agent 使用提示

使用本 DESIGN.md 生成界面时，先读取 PRD 的信息拓扑，再把内容映射到 `page_title`、`global_filters`、`primary_metrics`、`trend_panel`、`breakdown_panel`、`ratio_panel`、`detail_table`、`quick_actions` 等中性槽位。视觉 DNA 必须在内容替换后保留：`soft_metric_card_row`、`pill_command_header`、`blue_focus_visualization`、`modular_two_column_canvas`、`rounded_micro_detail`。主题色只能替换小面积强调色，不能改变浅灰画布、白色软边框面板、左宽右窄网格和轻量圆角系统。工作台、仪表盘、管理后台或运营首页必须按 `quick_actions` 规则生成快捷入口区域，除非 PRD 明确排除。

## 22. 交付自检清单

- [ ] 已把所有业务内容抽象为中性槽位，没有复制源图中的指标名、记录名、日期、示例数字或具体文案。
- [ ] 首屏存在 3-4 个等高 `metric_card`，主数字、趋势徽标和弱说明层级明确。
- [ ] 顶部使用左标题右命令组，筛选器、次级按钮、主按钮保持胶囊形和同高。
- [ ] 图表只使用一个蓝色主焦点，辅助序列、网格线、未选中状态保持低对比。
- [ ] 桌面端主体为左宽右窄网格，左列主分析和明细，右列辅助模块堆叠。
- [ ] 面板、控件、tooltip、输入框、徽标、缩略图都继承统一圆角 token。
- [ ] 快捷入口区域存在或有明确 PRD 排除理由，并继承软边框、浅图标块和蓝色小面积焦点。
- [ ] 主网格使用 `align-items: stretch`，面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。
- [ ] 图表、表格、列表、快捷入口和长文案有固定高度、内部滚动、截断或折叠策略。
- [ ] 页面区块间距由父级 `gap` 管理，没有零散外边距造成错位。
- [ ] hover、active、focus、loading、empty、error、disabled、selected 状态完整。
- [ ] 纯图标控件具备 `aria-label`，状态表达不只依赖颜色。
- [ ] 移动端单列或 2 列布局可用，控件不小于 44px，表格不会撑破屏幕。
