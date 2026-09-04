---
version: alpha
template_type: visual_dna_preset
name: soft-timeline-analytics-workbench
design_id: soft-timeline-analytics-workbench
design_status: draft
description: "适用于带核心指标、时间轴、趋势图和明细数据的柔和分析工作台视觉 DNA。"
scenes: [dashboard, workbench, analytics_home, operations_overview, data_table_page]
density: medium-high
layout: asymmetric_summary_timeline_chart_table
tone: [soft, analytical, clean, precise, calm]
tags: [light_dashboard, metric_stack, timeline_panel, trend_chart, data_table]
avoid: [marketing_landing_page, immersive_storytelling, media_gallery, freeform_canvas]
selection:
  best_for: [工作台首页, 运营概览, 分析看板, 进度追踪页, 列表管理页]
  user_intent: [快速扫读核心状态, 对比周期趋势, 查看近期节点, 下钻明细记录]
  visual_tone: [浅底留白, 柔和边框, 小面积强调色, 精细数据组件, 克制高效]
  avoid_for: [强品牌叙事, 大屏暗色展示, 内容型门户, 单一长表单, 图片优先页面]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: left_metric_stack
    name: 左侧指标栈
    confidence: observed
    hooks: [summary_card, metric_grid, large_number, icon_badge, decorative_progress_ring]
    invariant: [左侧使用较窄列承载主摘要与 2x2 指标卡, 主摘要卡比普通指标卡更高, 指标数字形成强层级, 普通指标卡保持白底和轻边框]
    variable: [指标数量, 指标名称, 数值格式, 环比文本, 图标语义, 默认强调色]
  - id: floating_timeline_panel
    name: 浮动时间轴面板
    confidence: observed
    hooks: [date_strip, horizontal_cards, active_marker, dotted_axis, rounded_outline_panel]
    invariant: [时间选择条位于面板顶部, 内容区使用浅色描边容器, 节点卡片错落但对齐到同一时间轴, 当前节点使用小面积高饱和强调色]
    variable: [时间粒度, 节点数量, 节点标题, 附加信息, 头像或图标, 操作入口]
  - id: refined_trend_panel
    name: 轻网格趋势面板
    confidence: observed
    hooks: [line_chart, soft_grid, hollow_points, tooltip_card, range_select]
    invariant: [图表面板白底大圆角, 标题栏与图表区分层, 折线使用强调色和空心节点, 辅助序列使用浅灰虚线, tooltip 使用深色高对比浮层]
    variable: [指标维度, 时间范围, 图表序列数量, 坐标标签, tooltip 内容, 主题色]
  - id: rounded_detail_table
    name: 圆角明细表
    confidence: observed
    hooks: [search_input, sortable_header, checkbox_column, status_pill, iconized_cell]
    invariant: [表格作为底部宽面板, 表头浅灰底并带分隔线, 行高稳定, 首列可选择, 状态使用胶囊标签和小圆点表达]
    variable: [列定义, 行数据, 筛选控件, 状态集合, 单元格图标, 批量操作]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-primary, tokens.colors.chart-primary-soft, tokens.colors.status-positive, tokens.colors.surface-accent, tokens.colors.timeline-active]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.colors.shadow-color]
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
    text-primary: "#111827"
    text-secondary: "#5B6472"
    text-tertiary: "#8B95A1"
    border-subtle: "#E5E9E7"
    border-accent-soft: "#CFEFE1"
    brand: "#1FB975"
    brand-strong: "#13A463"
    brand-soft: "#DFF7EC"
    focus-ring: "#8BE0B8"
    chart-primary: "#20B875"
    chart-primary-soft: "#DDF5EA"
    chart-secondary: "#CBD5D1"
    status-positive: "#22B879"
    status-warning: "#F0A92E"
    status-danger: "#E35D5D"
    shadow-color: "rgba(17, 24, 39, 0.06)"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0 }
    panel-title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0 }
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
    panel: "0 1px 2px rgba(17, 24, 39, 0.04), 0 12px 28px rgba(17, 24, 39, 0.04)"
    floating: "0 10px 24px rgba(17, 24, 39, 0.08)"
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
  - id: oversized_summary_card
    name: 大号摘要卡与装饰性进度纹理
    required_when: PRD 提供一个最高优先级摘要或总览状态
    rule: 摘要卡使用强调色底、超大数字、低透明纹理和局部进度环，普通指标卡不得抢夺主摘要层级。
  - id: staggered_timeline_panel
    name: 错落时间轴节点面板
    required_when: PRD 包含日程、阶段、流程、里程碑或时序节点
    rule: 时间条、垂直当前线、节点卡片和选中态必须共同出现，节点卡错落但保持网格对齐。
  - id: crafted_trend_tooltip
    name: 精致趋势图浮层
    required_when: PRD 包含趋势、周期对比或多序列数据
    rule: 图表需要空心节点、浅网格、辅助虚线序列和深色 tooltip，不能只放默认折线。
  - id: utility_table_shell
    name: 工具化明细表壳
    required_when: PRD 包含记录列表、检索、排序或状态追踪
    rule: 表格必须有圆角面板、搜索或筛选工具、浅灰表头、稳定行高、状态胶囊和 hover/focus 状态。
  - id: micro_icon_rhythm
    name: 微图标节奏
    required_when: PRD 包含指标卡、列表项、节点项或状态项
    rule: 小图标置于浅描边圆形容器内，图标大小与文本基线对齐，避免散乱贴图感。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [precise_alignment, stable_panel_heights, subtle_borders, soft_shadow, refined_table_header, chart_tooltip, active_state_texture]
components:
  card:
    surface: tokens.colors.surface
    roundedRef: tokens.rounded.card
    border: "1px solid tokens.colors.border-subtle"
    shadowRef: tokens.shadow.panel
  summary_card:
    surface: tokens.colors.brand
    roundedRef: tokens.rounded.summary
    text: "#FFFFFF"
    decoration: low_opacity_pattern_and_progress_ring
  metric_card:
    minHeightRef: layout_stability.fixed_height_tokens.metric_card
    icon: circular_subtle_badge
    number: tokens.typography.metric-number
  input:
    height: 48
    roundedRef: tokens.rounded.control
    border: "1px solid tokens.colors.border-subtle"
  button:
    height: 44
    roundedRef: tokens.rounded.control
    icon_first: true
  status_pill:
    roundedRef: tokens.rounded.pill
    has_dot: true
    neutral_bg: true
  chart:
    line_width: 3
    point_style: hollow_circle
    grid: soft_vertical_guides
  table:
    rowHeightRef: layout_stability.fixed_height_tokens.table_row
    headerHeightRef: layout_stability.fixed_height_tokens.table_header
    sortable_header: true
modules:
  page_identity:
    confidence: observed
    placement: top_left
    render_policy: prd_only
  primary_summary:
    confidence: observed
    placement: left_column_top
    render_policy: prd_only
  primary_metrics:
    confidence: observed
    placement: left_column_below_summary
    item_count: 2-4
    render_policy: prd_only
  timeline_panel:
    confidence: observed
    placement: right_column_top
    render_policy: prd_only
  trend_panel:
    confidence: observed
    placement: right_column_middle
    render_policy: prd_only
  detail_table:
    confidence: observed
    placement: full_width_bottom
    render_policy: prd_only
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_after_summary
    item_count: 4-8
---

# Soft Timeline Analytics Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 适合做浅底、高精度、面板化的分析工作台。它的关键形态是左侧摘要指标栈、右侧时间轴与趋势面板、底部圆角明细表。

PRD 决定页面内容、字段、模块和业务优先级；本文件只决定 UI 风格、布局机制和组件质感。默认强调色可以被主题色替换，但只能改变小面积强调色相，不能改变白底面板、轻边框、大圆角、稳定网格和数据组件的组织方式。

适合需要扫读状态、追踪时序、查看趋势和检索明细的工具型页面。不适合强叙事、强媒体、暗色大屏或单一表单页面。编码结果必须保留可见微细节，不能退化成普通后台套路。

## 2. 使用边界

PRD 负责内容、功能、信息架构、模块是否存在、字段是否展示、数据优先级和交互流程。本文件负责视觉 DNA、布局气质、组件形态、密度、状态、响应式和可访问性。

不要为了套用本风格而凭空创造 PRD 未要求的业务内容。没有核心摘要时，不渲染 `primary_summary`；没有时序节点时，不渲染 `timeline_panel`；没有趋势数据时，用同等品质的主内容面板替代 `trend_panel`；没有明细记录时，不强行生成表格。

禁止复用风格来源中的具体业务字段、示例数据、机构名、分类名称、页面专属文案或特殊图标语义。所有文本、数据、图标和状态都必须来自 PRD 或真实数据契约。

## 3. 设计风格选择与换色逻辑

当用户意图包含“概览、追踪、趋势、明细、状态管理、运营工作台”时，可以选择该风格。页面需要同时容纳摘要信息和结构化数据时最适合；如果只是单纯展示文章、相册、营销转化或全屏可视化，应选择其他视觉 DNA。

不要把默认强调色理解成 DNA。该风格的 DNA 是白底面板、左窄右宽的不对称网格、摘要卡强层级、时间轴节点、轻网格折线图和工具化表格。主题色只改写 `brand`、`brand-soft`、`chart-primary`、`timeline-active`、状态辅助色和 `focus-ring`。

背景、表面、中性文字、浅边框、阴影、大圆角、面板层级、图表空心节点、深色 tooltip 和表格结构不能被主题色改变。主题色不得铺满页面背景，也不得把普通白色卡片变成大面积彩色卡片。

## 4. 视觉 DNA

### 左侧指标栈

不可变机制是左侧较窄列中的“一个大摘要 + 多个小指标”。大摘要负责页面最强视觉重心，普通指标卡保持白底、轻边框和稳定等高。主题色替换后，大摘要可以使用新主题色，但小指标卡仍以中性表面为主。

可变部分包括指标名称、数值格式、趋势表达、图标语义和卡片数量。若缺失该机制，页面会失去快速扫读入口，整体变成松散面板堆叠。

### 浮动时间轴面板

不可变机制是顶部时间选择条、内容区浅描边容器、当前时间线和错落节点卡片。当前节点使用小面积高饱和强调色，其他节点保持白底和细边框。

可变部分包括时间粒度、节点数量、节点信息、图标和操作入口。主题色只替换当前节点、竖线、选中标签和少量边框光晕。若 PRD 没有时序内容，应用同等品质的分组列表、阶段面板或主内容面板，不要伪造时间轴。

### 轻网格趋势面板

不可变机制是大圆角白底面板、清晰标题栏、浅网格、强调色折线、空心节点、辅助虚线序列和深色 tooltip。图表容器必须有固定高度，不能随数据或标签撑开。

可变部分包括图表类型、序列数量、时间范围、坐标标签和 tooltip 内容。若用其他图表承载 PRD 数据，也要保留轻网格、精细图例、悬浮反馈和足够留白。

### 圆角明细表

不可变机制是底部全宽面板、工具栏、浅灰表头、稳定行高、复选框列、可排序列头和状态胶囊。表格边界要干净，行分隔线要轻，hover 与 selected 状态要明确但克制。

可变部分包括列定义、筛选控件、状态集合、图标化单元格和批量操作。若 PRD 是列表而非表格，也要保留圆角面板、统一行高、状态标签和工具区。

## 5. 视觉品质基线

`oversized_summary_card` 用于承载最高优先级摘要。它通过超大数字、强调色底、局部进度纹理和足够内边距建立首屏重心。没有核心摘要时，可用高品质信息面板替代，但不能强造数字。

`staggered_timeline_panel` 用于承载时序、阶段或里程碑。时间条、当前线、节点卡片和选中态必须作为一个完整组件出现。没有时序内容时，用分组看板或横向步骤面板替代，仍需保持对齐和层级。

`crafted_trend_tooltip` 用于承载趋势数据。折线图至少包含空心节点、浅色辅助线、细网格和深色 tooltip。默认图表库样式需要被覆写，避免粗糙坐标轴、拥挤标签和无状态反馈。

`utility_table_shell` 用于承载记录检索和状态追踪。表格必须包含工具区、圆角外壳、稳定表头、行 hover、选中状态和状态胶囊。只有表格线条和文字会显得廉价。

`micro_icon_rhythm` 用于指标卡、节点项、列表项和状态项。小图标应放入圆形浅描边容器，尺寸统一，和文本基线对齐。图标只辅助识别，不承担业务定义。

## 6. 布局规则

推荐桌面布局为 12 列网格：左侧 4 列承载摘要和指标栈，右侧 8 列承载时间轴和趋势面板，底部明细区横跨 12 列。页面外边距约 24px，区块间距约 16px，首屏结构应紧凑但不拥挤。

这些槽位不是业务结构要求。PRD 没有的模块不要强行补齐，已有模块也可以根据内容优先级调整顺序，但需要保留“摘要优先、分析居中、明细沉底”的阅读节奏。

布局稳定性硬规则：

- 主 grid 使用 `align-items: stretch`。
- 同一行面板等高，面板使用 `height: 100%`。
- 面板内部使用 `display: flex` 和 `flex-direction: column`。
- 所有面板设置 `min-width: 0` 和 `min-height: 0`。
- 长文本必须截断、折叠或在面板内部滚动。
- 图表容器必须有固定高度或响应式高度 token。
- 区块间距由父级 `gap` 管理，不用零散 margin 拼接。

## 7. PRD 槽位映射

| PRD 内容类型 | 推荐槽位 | 渲染规则 |
| --- | --- | --- |
| 页面名称与全局操作 | `page_identity`, `global_actions` | 顶部左侧标题，右侧可放轻量筛选或操作；没有操作时只保留标题。 |
| 最高优先级摘要 | `primary_summary` | 使用强调色大卡；没有量化摘要时不要生成大数字。 |
| 次级指标集合 | `primary_metrics` | 使用 2 到 4 个白底指标卡；指标必须来自 PRD。 |
| 时序、阶段、里程碑 | `timeline_panel` | 使用顶部时间条、当前线和节点卡；没有时序内容时不渲染。 |
| 趋势、周期对比、多序列数据 | `trend_panel` | 使用轻网格图表；没有图表数据时替换为同品质主内容面板。 |
| 记录、清单、状态追踪 | `detail_table` 或 `detail_list` | 使用底部圆角工具化外壳；列和操作由 PRD 决定。 |
| 常用入口或批处理 | `quick_actions` | 仅当 PRD 要求快捷入口时渲染，作为独立区块。 |
| 加载、空状态、错误状态 | `status_note`, `empty_state` | 保持白底、轻描边、明确反馈和可恢复操作。 |

## 8. 组件规则

卡片和面板使用白底、20px 左右圆角、1px 浅边框和极轻阴影。不要把页面区块包进多层卡片；重复项、表格外壳、浮层和工具面板才使用卡片样式。

指标组件需要明确层级。主摘要数字可使用 56px 到 68px，普通指标数字使用 36px 到 48px。趋势文本使用小字号和主题色或状态色，但不能只靠颜色表达含义。

图表组件需要稳定高度、浅网格、克制轴线、空心节点、图例点和 hover tooltip。折线厚度约 3px，辅助序列可用浅灰虚线。tooltip 使用深色面板、8px 到 12px 圆角和清晰的左右对齐数值。

表格和列表需要工具栏、搜索或筛选控件、浅灰表头、可排序图标、复选框列、稳定行高、行 hover 和 selected 状态。状态胶囊使用圆角、浅底、小圆点和短文本，不要使用大面积强色块。

输入和按钮高度建议 44px 到 48px。图标按钮使用熟悉图标，并提供 hover、focus、disabled 和 loading 状态。纯图标按钮必须有可访问名称。

快捷入口如被 PRD 要求，应作为独立区块，使用圆形图标容器、短标签和轻边框，不要塞进表格工具栏或面板尾部。入口数量建议 4 到 8 个，移动端可横向滚动。

## 9. 响应式与可访问性

桌面端使用不对称网格；小于 1100px 时可改为上下结构，摘要指标在前，时间轴和图表在后，明细表最后。小于 720px 时所有面板单列堆叠，表格允许横向滚动，时间轴节点改为纵向列表或可横滑卡片。

触控目标不小于 44px。所有交互控件需要清晰 focus ring，颜色使用 `focus-ring`，同时保留边框或阴影变化。状态不能只依赖颜色，需要配合文字、图标、圆点或形状。

动效保持轻量：hover 可使用 120ms 到 180ms 的阴影、边框或位移动效；图表入场可淡入，不做强烈弹跳。遵守 `prefers-reduced-motion`，在用户减少动态效果时关闭非必要动画。

## 10. 禁止项

- 禁止复制具体业务内容、字段名、示例数据、机构名、分类名称或页面专属文案。
- 禁止让本文件覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景、指标卡底色或大面积面板。
- 禁止把当前主题色误当成视觉 DNA。
- 禁止使用默认后台质感的粗糙表格、默认图表和无状态按钮。
- 禁止瀑布流、自由高度卡片、无固定高度图表容器和零散 margin 拼接。
- 禁止长内容撑破父级、表格列挤压到不可读、按钮文字溢出或图标与文本错位。
- 禁止在紧凑面板中使用英雄级字号。

## 11. Agent 使用提示

先读取 PRD，确认真实模块、字段、数据和交互；再读取主题色输入，改写强调色 token；最后应用本视觉 DNA。不要硬套槽位，不要凭空创造内容，不要复用任何风格来源中的具体文本或数据。

实现时优先保留左侧指标栈、时间轴面板、趋势图面板和明细表外壳这些视觉机制。若 PRD 缺少对应内容，用同等品质的中性组件替代，而不是生成假内容。主题色只替换小面积强调色、图表主序列、选中态、状态辅助色和 focus ring，不能改变浅底、白色面板、轻边框、大圆角和稳定网格。

交付结果必须达到 `quality_floor.target`：有精确对齐、稳定面板高度、细腻边框、轻阴影、完整交互状态、精制表头、图表 tooltip 和可见微细节。

## 12. 交付自检清单

- [ ] 页面内容、字段、数值和状态都来自 PRD 或真实数据契约。
- [ ] 没有复制具体业务内容、示例数据、机构名、分类名称或页面专属文案。
- [ ] 主题色只改写强调色、图表主序列、选中态、状态辅助色和 focus ring。
- [ ] 白底页面、白色面板、轻边框、大圆角、稳定网格和数据组件组织方式被保留。
- [ ] 质量锚点按 PRD 条件落地，缺失内容时使用同等品质替代组件。
- [ ] 主 grid 使用 `align-items: stretch`，同一行面板等高。
- [ ] 面板设置 `height: 100%`、`min-width: 0`、`min-height: 0` 和内部滚动或截断策略。
- [ ] 图表容器有稳定高度，tooltip、图例、hover 和空状态完整。
- [ ] 表格或列表有工具区、稳定表头、行 hover、选中态和状态标签。
- [ ] 移动端布局不会溢出，表格和时间轴有合理折叠或横向滚动。
- [ ] 纯图标按钮有可访问名称，状态不只依赖颜色表达。
