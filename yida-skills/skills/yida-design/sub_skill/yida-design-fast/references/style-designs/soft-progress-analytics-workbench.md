---
version: alpha
template_type: visual_dna_preset
name: soft-progress-analytics-workbench
design_id: soft-progress-analytics-workbench
design_status: draft
description: "适用于进度追踪、周期分析、任务概览和明细管理的柔和浅色分析工作台视觉 DNA。"
scenes: [dashboard, workbench, operations_overview, progress_tracking, data_table_page]
density: medium-high
layout: left_metric_stack_right_timeline_chart_table
tone: [soft, analytical, structured, precise, calm]
tags: [light_dashboard, progress_overview, timeline_panel, trend_chart, refined_table]
avoid: [marketing_landing_page, immersive_big_screen, media_gallery, single_long_form, text_heavy_portal]
selection:
  best_for: [工作台首页, 进度追踪页, 周期分析页, 运营概览页, 明细管理页]
  user_intent: [快速判断整体状态, 追踪阶段节点, 对比周期趋势, 检索明细记录]
  visual_tone: [浅底留白, 柔和圆角, 小面积高饱和强调色, 精细数据组件, 清爽有序]
  avoid_for: [强品牌叙事, 暗色沉浸展示, 单一表单录入, 内容阅读页, 图片优先页面]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: left_priority_metric_stack
    name: 左侧优先级指标栈
    confidence: observed
    hooks: [summary_card, metric_grid, large_number, icon_badge, decorative_progress_texture]
    invariant: [左侧窄列承载最高优先级摘要和 2x2 小指标, 摘要卡高度明显大于普通指标卡, 摘要卡使用强调色底和超大数字形成首要视觉层级, 普通指标卡保持白底轻描边并通过小图标建立节奏]
    variable: [指标数量, 指标名称, 数值格式, 环比说明, 图标语义, 默认强调色]
  - id: floating_milestone_timeline
    name: 浮动里程碑时间轴
    confidence: observed
    hooks: [date_strip, active_date_marker, dotted_axis, staggered_node_cards, selected_node_card]
    invariant: [顶部使用紧凑时间选择条, 内容区放在浅色描边大圆角容器内, 当前时间或当前节点使用垂直虚线对齐, 节点卡片可错落分布但必须服从网格对齐, 选中节点以小面积强调色填充]
    variable: [时间粒度, 节点数量, 节点标题, 附加说明, 图标或头像占位, 操作入口]
  - id: crafted_trend_panel
    name: 精制轻网格趋势面板
    confidence: observed
    hooks: [line_chart, hollow_markers, dotted_secondary_series, tooltip_card, range_selector]
    invariant: [趋势面板使用白底大圆角和标题栏分层, 主序列用强调色折线和空心圆点, 辅助序列使用浅灰虚线弱化, tooltip 使用深色浮层与细分图例提升质感]
    variable: [指标维度, 时间范围, 序列数量, 坐标标签, tooltip 内容, 主题色]
  - id: rounded_utility_detail_table
    name: 圆角工具化明细表
    confidence: observed
    hooks: [search_input, sortable_header, checkbox_column, status_pill, iconized_cell]
    invariant: [底部明细区是横向宽面板, 标题与搜索或筛选控件同层, 表头使用浅灰底和细分隔线, 行高稳定, 首列支持选择, 状态用胶囊标签和点状信号表达]
    variable: [列定义, 行数据, 筛选控件, 状态集合, 单元格图标, 批量操作]
  - id: soft_micro_detail_rhythm
    name: 柔和微细节节奏
    confidence: observed
    hooks: [subtle_border, soft_shadow, icon_circle, pill_control, vertical_accent_bar]
    invariant: [所有信息块依靠浅边框、轻阴影和圆角建立层次, 图标放在浅描边圆形容器中, 被强调的列表项或节点使用短竖条或胶囊态提示, 页面不得依赖厚重色块堆叠]
    variable: [图标库, 操作数量, 状态语义, 强调色相, 文案长度]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-primary, tokens.colors.chart-primary-soft, tokens.colors.status-positive, tokens.colors.surface-accent, tokens.colors.timeline-active]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.text-tertiary, tokens.colors.border-subtle, tokens.colors.shadow-color]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - preserve_white_panels_soft_borders_and_large_radius
tokens:
  colors:
    bg-page: "#F6F7F5"
    surface: "#FFFFFF"
    surface-muted: "#F2F4F3"
    surface-accent: "#EAF8F2"
    text-primary: "#101722"
    text-secondary: "#5B6472"
    text-tertiary: "#8B95A1"
    border-subtle: "#E3E8E5"
    border-accent-soft: "#CFEFE1"
    brand: "#1FB975"
    brand-strong: "#13A463"
    brand-soft: "#DFF7EC"
    focus-ring: "#8BE0B8"
    chart-primary: "#20B875"
    chart-primary-soft: "#DDF5EA"
    chart-secondary: "#CDD6D2"
    status-positive: "#22B879"
    status-warning: "#F0A92E"
    status-danger: "#E35D5D"
    shadow-color: "rgba(16, 23, 34, 0.06)"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0 }
    panel-title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0 }
    metric-label: { fontSize: 15, fontWeight: 650, lineHeight: 1.35, letterSpacing: 0 }
    metric-number: { fontSize: 44, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0 }
    hero-number: { fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: 0 }
    body: { fontSize: 15, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 24
    page-y-desktop: 32
    grid-gap: 16
    panel-x: 24
    panel-y: 22
    card-gap: 14
    table-cell-x: 20
  rounded:
    panel: 20
    summary: 20
    card: 16
    control: 14
    pill: 999
    icon: 999
  shadow:
    panel: "0 1px 2px rgba(16, 23, 34, 0.04), 0 12px 28px rgba(16, 23, 34, 0.04)"
    floating: "0 10px 24px rgba(16, 23, 34, 0.08)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    summary_card: 270px
    metric_card: 168px
    timeline_panel: 360px
    trend_panel: 300px
    table_row: 64px
    table_header: 56px
quality_anchors:
  - id: oversized_priority_summary
    name: 大号优先摘要与进度纹理
    required_when: PRD 提供一个最高优先级状态、总览结果或主指标
    rule: 摘要卡使用强调色底、超大数字、低透明纹理和局部进度弧，普通指标卡不得抢夺主摘要层级。
  - id: staggered_milestone_timeline
    name: 错落里程碑时间轴
    required_when: PRD 包含日程、阶段、流程、周期节点或状态迁移
    rule: 时间条、当前线、节点卡片和选中态必须共同出现；节点可错落，但边缘、基线和间距需要严格对齐。
  - id: crafted_chart_tooltip
    name: 精制图表浮层
    required_when: PRD 包含趋势、周期对比、进度走势或多序列分析
    rule: 图表需要空心节点、浅网格、辅助虚线序列和深色 tooltip，不能只放默认折线。
  - id: utility_table_shell
    name: 工具化明细表壳
    required_when: PRD 包含记录列表、检索、排序、筛选或状态追踪
    rule: 明细区必须有圆角面板、搜索或筛选工具、浅灰表头、稳定行高、状态胶囊和 hover/focus 状态。
  - id: micro_icon_alignment
    name: 微图标与状态对齐
    required_when: PRD 包含指标卡、列表项、节点项、状态项或操作入口
    rule: 小图标置于浅描边圆形容器内，尺寸与文本基线对齐；状态除了颜色，还需要点、竖条、胶囊或文本补充。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [precise_alignment, stable_panel_heights, subtle_borders, soft_shadow, refined_table_header, chart_tooltip, active_state_texture]
components:
  card:
    surface: tokens.colors.surface
    rounded: tokens.rounded.card
    border: "1px solid tokens.colors.border-subtle"
    shadow: tokens.shadow.panel
  summary_card:
    surface: tokens.colors.brand
    rounded: tokens.rounded.summary
    text: "#FFFFFF"
    texture: low_opacity_progress_arc_or_line_pattern
  metric_card:
    surface: tokens.colors.surface
    minHeight: 168
    icon: circular_subtle_outline
    numberScale: metric-number
  timeline_node:
    height: 76
    rounded: tokens.rounded.card
    border: "1px solid tokens.colors.border-subtle"
    selectedSurface: tokens.colors.brand
    activeRail: tokens.colors.timeline-active
  chart:
    height: 230
    lineStyle: smooth_with_hollow_points
    tooltip: dark_compact_card
  table:
    headerHeight: 56
    rowHeight: 64
    headerSurface: tokens.colors.surface-muted
    statusStyle: pill_with_dot
  input:
    height: 48
    rounded: tokens.rounded.control
    border: "1px solid tokens.colors.border-subtle"
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_after_summary_or_before_detail
    item_count: 4-8
    item_shape: compact_icon_label_tile
  primary_metrics:
    confidence: observed
    layout: left_column_summary_plus_2x2_metric_grid
  timeline:
    confidence: observed
    render_policy: prd_only
    placement: upper_right_primary_panel
  trend_panel:
    confidence: observed
    render_policy: prd_only
    placement: middle_or_upper_right_after_timeline
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: full_width_bottom_panel
---

# Soft Progress Analytics Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一个柔和浅色、信息密度中高、强调进度与周期判断的分析工作台视觉 DNA。它用左侧优先级指标栈建立首屏判断，用右侧时序节点和趋势面板承接分析，再用底部工具化明细表完成检索与下钻。

PRD 决定内容、模块和业务优先级；DESIGN.md 只决定这些内容如何被视觉化。默认强调色可以被主题色替换，但只能替换小面积强调色、图表主序列、focus ring 和状态辅助色，不能改变浅底、白色面板、柔和边框、稳定网格和精致微细节。最终界面必须像手工打磨的数据产品，而不是默认后台套路。

## 2. 使用边界

适合用于需要同时承载摘要、进度、趋势和明细的工作台、看板、周期分析页、阶段追踪页和列表管理页。它特别适合“先判断状态，再看时序，再进入记录”的任务路径。

不适合强品牌叙事、沉浸式大屏、单一长表单、内容阅读页或图片优先页面。如果 PRD 没有时序、阶段、节点或周期语义，不要强行渲染时间轴；可以保留同样的面板层级、圆角、边框和留白，把右上区替换为 PRD 要求的主内容面板。

禁止复用任何视觉材料中的具体业务字段、示例数据、对象名、机构名、分类名或页面专属文案。槽位名称只表示视觉承载方式，不表示必须创造对应业务内容。

## 3. 设计风格选择与换色逻辑

选择该风格时，先判断 PRD 是否有以下信息拓扑：一个高优先级总览、多个辅助指标、可按时间或阶段理解的节点、可视化趋势，以及需要检索或排序的明细记录。若这些结构中的三项以上成立，该风格通常优先级较高。

主题色只改写 `brand`、`brand-strong`、`brand-soft`、`focus-ring`、图表主序列、选中节点和状态辅助色。页面背景、白色面板、中性文字、浅边框、阴影、圆角尺度、面板等高、图表轻网格、底部明细表壳都必须保持。

不要把默认绿色理解成视觉 DNA。真正的 DNA 是浅底白面板、小面积高饱和强调、左侧优先摘要、右侧浮动节点、精制趋势图和工具化明细表之间的层级关系。

## 4. 视觉 DNA

### 左侧优先级指标栈

不可变机制是左侧窄列承载最重要的总览摘要和 2x2 辅助指标。摘要卡面积最大、颜色最强、数字最大；普通指标卡保持白底和轻描边，只用小图标、数字和辅助说明表达层级。

可变部分是指标数量、指标名称、图标语义和数值格式。主题色替换后，摘要卡和正向变化文本使用新主题色，普通指标卡仍然是白底。缺失该机制时，页面会失去首屏判断重心，容易变成平均用力的普通卡片网格。

### 浮动里程碑时间轴

不可变机制是顶部时间选择条、浅描边内容容器、当前线和节点卡片共同形成时间或阶段感。节点可以错落摆放，但错落不是自由布局，必须对齐到稳定列、稳定行和统一间距。选中节点使用小面积强调色，不把整个面板染色。

可变部分是时间粒度、节点数量、节点内容和节点操作。如果 PRD 没有时间语义，不要硬套该组件；可以把同一视觉空间用于阶段列表、状态流或其他主内容面板。

### 精制轻网格趋势面板

不可变机制是白底大圆角面板、标题栏分层、主折线空心节点、浅灰辅助虚线和深色 tooltip。图表区域应有稳定高度，坐标标签清晰但克制，hover 时通过细竖线、点位高亮和浮层展示细节。

可变部分是指标维度、时间范围、序列数量和 tooltip 内容。主题色只替换主折线与高亮节点；辅助线、网格线和中性标签保持低对比。

### 圆角工具化明细表

不可变机制是底部宽面板承载记录，标题与搜索或筛选工具同层，表头使用浅灰底和细分隔线，行高稳定，状态使用胶囊标签和点状信号。明细表是工作台的落地层，不能像裸表格一样直接贴在页面背景上。

可变部分是列定义、筛选方式、状态集合和单元格内容。没有表格数据时，可以替换为同等品质的列表、队列或空状态面板，但仍保留圆角壳、工具栏、分隔线和稳定高度。

### 柔和微细节节奏

不可变机制是浅边框、轻阴影、圆形图标容器、胶囊控件、短竖条和状态点形成统一节奏。页面的精致度来自这些小信号的持续一致，而不是更多颜色或更厚重阴影。

可变部分是具体图标、状态语义和操作数量。缺失微细节时，界面会变得扁平、粗糙，难以达到高品质数据产品的观感。

## 5. 视觉品质基线

`oversized_priority_summary` 在 PRD 提供主指标或核心状态时必须落地。摘要卡需要超大数字、强调色底、低透明进度纹理和充足留白，普通指标卡只能作为辅助层级。

`staggered_milestone_timeline` 在 PRD 提供阶段、周期、日程或状态迁移时必须落地。时间条、当前线、节点卡和选中态是一个整体，不要只做横向卡片列表。

`crafted_chart_tooltip` 在 PRD 提供趋势或周期对比时必须落地。图表不能只使用库默认样式，至少要有空心节点、辅助虚线、浅网格、hover 竖线和深色 tooltip。

`utility_table_shell` 在 PRD 提供记录列表、检索、排序或筛选时必须落地。明细表需要标题栏、工具区、圆角外壳、浅灰表头、状态胶囊和稳定行高。

`micro_icon_alignment` 在指标卡、节点卡、状态项或操作入口中都应持续出现。图标必须与文本基线对齐，状态不能只依赖颜色，还要用点、竖条、胶囊或文字补充。

## 6. 布局规则

推荐桌面结构：

```text
page_shell
  page_identity
  main_grid
    left_metric_column
      primary_summary
      metric_grid
    right_analysis_column
      timeline_or_primary_panel
      trend_or_supporting_panel
  detail_panel
```

这些槽位不是业务要求。PRD 没有的模块不要补；如果某个槽位不存在，用同等视觉品质的 PRD 内容替换，或让相邻模块自然扩展。

主 grid 使用两列布局：左列约 35%，右列约 65%，列间距 16-20px。左列内部为摘要卡 + 2x2 指标卡；右列上方适合时序或主内容面板，下方适合趋势或辅助分析面板；底部明细面板横跨全宽。

布局稳定性硬规则：

- 主 grid 使用 `align-items: stretch`。
- 同一行面板必须等高。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。
- 图表、时间轴、表格行必须有稳定高度，禁止由内容自由撑开。
- 长文本使用截断、折叠或内部滚动，不能撑破父级。
- 区块间距由父级 `gap` 管理，不用零散 margin 拼页面。

## 7. PRD 槽位映射

| PRD 内容类型 | 推荐视觉槽位 | 使用规则 |
| --- | --- | --- |
| 页面身份、标题、全局操作 | `page_identity` | 顶部只保留必要标题和操作，避免占用过高首屏空间。 |
| 最高优先级状态或总览 | `primary_summary` | 使用强调色摘要卡；没有主指标时不要伪造大数字。 |
| 多个辅助指标 | `primary_metrics` | 使用 2x2 或 2xn 白底指标卡，图标在圆形容器中。 |
| 阶段、日程、周期、节点 | `timeline` | 使用时间选择条、当前线、节点卡和选中态；没有时间语义则替换为主内容面板。 |
| 趋势、走势、周期对比 | `trend_panel` | 使用精制折线或等价图表；没有图表数据时替换为高品质摘要列表。 |
| 记录、对象、任务、明细 | `detail_table` | 使用圆角表格壳、搜索筛选、浅灰表头和状态胶囊。 |
| 常用操作入口 | `quick_actions` | 只在 PRD 明确需要时渲染，作为独立区块，不塞进表格工具栏。 |
| 空数据或加载失败 | `empty_or_error_state` | 放在对应面板内部，保持圆角、图标、说明和操作的精致度。 |

## 8. 组件规则

卡片和面板使用白色表面、1px 浅边框、20px 左右圆角和极轻阴影。面板内部用标题栏和内容区分层，标题栏高度稳定，右侧控件使用胶囊形态。

指标组件必须建立数字层级。主摘要数字可达到 56-68px，普通指标数字约 40-48px；小标题和辅助说明保持 13-15px。指标卡内图标使用 32-40px 圆形浅描边容器。

时间轴节点卡高度保持 72-84px。默认节点为白底轻边框，选中节点为强调色底；节点左侧可使用短竖条增强状态感。节点内图标、标题、说明和更多操作必须在同一基线系统内对齐。

图表容器高度固定，折线可以平滑但不夸张。主序列使用 2.5-3px 线宽和空心节点；辅助序列使用 1.5-2px 浅灰虚线；tooltip 使用深色小浮层，包含标题、图例点和值，不遮挡关键走势。

表格面板必须包含稳定工具区。搜索框高度 48px，圆角 14px，左侧图标和 placeholder 对齐；表头高度 56px，行高 64px。状态标签使用胶囊、浅底、边框和状态点，hover 行使用极浅背景。

按钮和控件只在命令明确时使用文字按钮；翻页、更多、排序、搜索、筛选等优先使用图标或图标加文本。纯图标按钮必须有 tooltip 或可访问标签。loading、empty、error、disabled、selected、hover、focus 状态都需要定义。

快捷入口若由 PRD 要求，应作为独立区块出现，使用紧凑图标加短标签的 tile，不要塞进表格标题栏、侧栏尾部或图表角落。

## 9. 响应式与可访问性

桌面端保持左右两列和底部全宽明细；中等宽度下可把左侧指标栈和右侧分析列改为上下堆叠，但每个面板仍保留稳定高度；移动端按 `primary_summary`、`primary_metrics`、`timeline_or_primary_panel`、`trend_panel`、`detail_panel` 顺序纵向排列。

表格在窄屏可转为横向滚动、卡片列表或字段摘要行，具体由 PRD 和数据复杂度决定。触控目标不小于 44px，输入和按钮的 focus ring 使用主题色派生但保持 2px 可见轮廓。

状态表达不能只依赖颜色，必须配合文本、点、竖条、图标或胶囊。图表 hover 信息在触控设备上应支持点击固定或摘要展示。若用户启用 reduced motion，图表和节点切换只保留轻微透明度变化，不做大幅位移动画。

## 10. 禁止项

- 禁止复制具体业务内容、示例数据、字段名、对象名、机构名、分类名或页面专属文案。
- 禁止让 DESIGN.md 覆盖 PRD 的内容、功能、模块和业务优先级决策。
- 禁止把输入主题色铺满页面背景、普通指标卡或大面积中性面板。
- 禁止把默认强调色误当成视觉 DNA。
- 禁止做成默认后台质感：裸表格、等权卡片、默认图表、粗糙阴影、随机圆角都不合格。
- 禁止瀑布流、自由高度卡片、无固定高度图表容器和零散 margin 拼接。
- 禁止长文本撑破节点卡、表格行、面板标题栏或搜索框。
- 禁止状态只靠颜色区分。

## 11. Agent 使用提示

先读 PRD，确认实际内容、模块、优先级和数据形态；再读取主题色输入，仅替换强调色 token 和派生状态色；最后套用该视觉 DNA。不要为了满足槽位而凭空创建 PRD 没有的指标、时间轴、图表、快捷入口或明细表。

实现时优先保证结构稳定：左右主 grid、等高面板、固定图表高度、稳定表格行高、内部滚动和文本截断。每个落地模块都要带有可见微细节：浅边框、轻阴影、圆形图标容器、状态胶囊、图表 tooltip、hover/focus 状态。编码结果必须达到 `quality_floor.target`，不能停留在默认组件库拼装。

## 12. 交付自检清单

- 内容、字段、模块和文案是否全部来自 PRD。
- 是否保留左侧优先级指标栈、时序节点、精制趋势面板、工具化明细表和微细节节奏中的适用 DNA。
- 主题色是否只改写强调色、图表主序列、状态辅助色和 focus ring。
- 页面背景、白色面板、中性文字、浅边框、圆角和稳定网格是否未被主题色污染。
- 所有同排面板是否等高，图表、时间轴、表格行是否有稳定高度。
- 长内容是否使用截断、折叠或内部滚动。
- 表格是否有工具区、浅灰表头、稳定行高、状态胶囊和 hover/focus 状态。
- 图表是否有空心节点、辅助序列、浅网格和深色 tooltip。
- 纯图标按钮是否有 tooltip 或可访问标签。
- 移动端、键盘 focus、非纯颜色状态表达和 reduced motion 是否达标。
