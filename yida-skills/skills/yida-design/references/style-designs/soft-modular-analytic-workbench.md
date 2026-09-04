---
version: alpha
template_type: visual_dna_preset
name: soft-modular-analytic-workbench
design_id: soft-modular-analytic-workbench-v1
design_status: draft
description: 内容中立的浅色模块化分析工作台视觉预设，适合承载摘要、指标、趋势、明细和操作入口。
scenes: [workbench, dashboard, admin_home, operations_panel, data_overview]
density: medium-high
layout: responsive_modular_grid
tone: [soft, precise, calm, polished, analytical]
tags: [light_surface, rounded_panels, metric_grid, chart_panel, dense_table]
avoid: [marketing_landing, editorial_story, immersive_media, form_only_flow, low_density_showcase]
selection:
  best_for: [数据概览页, 运营工作台, 管理后台首页, 指标看板, 列表密集页面]
  user_intent: [快速掌握状态, 对比多组摘要, 检索明细, 追踪趋势, 执行少量高频操作]
  visual_tone: [浅色克制, 高圆角模块, 精准对齐, 轻量数据感, 低噪声]
  avoid_for: [品牌叙事首页, 大幅沉浸展示, 单一步骤表单, 内容阅读站点, 强视觉营销页]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: airy_page_shell
    name: 浅灰画布与白色圆角面板
    confidence: observed
    hooks: [page_bg, panel_surface, rounded_panel, subtle_border, parent_gap_grid]
    invariant: [页面使用低对比浅灰底, 内容由白色大圆角面板承载, 面板之间用稳定 gap 分隔, 边界依赖轻描边与柔和阴影]
    variable: [页面标题文案, 模块数量, 每个面板承载的内容类型, 主题强调色]
  - id: mixed_scale_summary_grid
    name: 大摘要卡与小指标拼图区
    confidence: observed
    hooks: [summary_card, metric_tile_grid, equal_height_cards, large_numeric_type, compact_delta_pill]
    invariant: [首屏上方以大摘要和 2x2 指标拼图区建立层级, 数字或关键值使用显著字号, 趋势与状态用小胶囊表达]
    variable: [摘要含义, 指标数量, 数值格式, 状态语义, 图标语义]
  - id: contained_insight_panel
    name: 内嵌轻网格洞察面板
    confidence: observed
    hooks: [chart_card, soft_chart_area, legend_dots, dashed_grid_lines, rounded_bars_or_segments]
    invariant: [图表或趋势内容放在独立内嵌浅底区域, 网格线低对比, 图例小而清晰, 数据形状有圆角或纹理细节]
    variable: [图表类型, 维度标签, 数据单位, 对比系列数量, tooltip 内容]
  - id: refined_detail_table
    name: 圆角表头与图标化明细行
    confidence: observed
    hooks: [table_panel, rounded_header, row_icon_badge, checkbox_cell, status_dot, selected_row]
    invariant: [明细区使用大面板包裹, 表头为浅灰圆角块, 行高稳定, 每行保留图标或状态微细节, 选中态以整行浅底反馈]
    variable: [列定义, 行内容, 操作菜单, 状态集合, 排序筛选规则]
  - id: compact_supporting_widgets
    name: 辅助小组件的横向密度
    confidence: observed
    hooks: [progress_strip, compact_cards, icon_button, horizontal_scroller, muted_section]
    invariant: [辅助模块采用较低高度和紧凑间距, 进度或分段信息用横条表达, 关联项可横向排列并保持裁切边界]
    variable: [小组件类型, 项目数量, 是否横向滚动, 卡片内容, 操作按钮]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.brand-deep, tokens.colors.focus-ring, tokens.colors.chart-accent]
  derive_tokens: [tokens.colors.brand-weak, tokens.colors.brand-tint, tokens.colors.status-positive-soft, tokens.colors.chart-sequence]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.shadow.panel]
  rules:
    - theme_color_only_changes_accent_hue
    - replace_hue_preserve_visual_mechanism
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - keep_gradient_usage_limited_to_one_priority_tile_or_small_chart_marks
tokens:
  colors:
    bg-page: "#F4F4F3"
    surface: "#FFFFFF"
    surface-muted: "#F5F5F4"
    surface-raised: "#FAFAF9"
    text-primary: "#181816"
    text-secondary: "#686864"
    text-tertiary: "#8A8A84"
    border-subtle: "#E8E8E5"
    border-muted: "#F0F0EE"
    brand: "#A8FF2F"
    brand-soft: "#DDFDC2"
    brand-weak: "#EEFDDD"
    brand-tint: "#F6FEEB"
    brand-deep: "#075C46"
    focus-ring: "#9BEF2D"
    chart-accent: "#B5FF37"
    chart-dark: "#1F1E1A"
    success: "#38B96D"
    success-soft: "#E8F8EF"
    warning: "#F2C94C"
    warning-soft: "#FFF7D7"
    danger: "#E95F6A"
    danger-soft: "#FDEBED"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    page-title: { fontSize: 44, fontWeight: 650, lineHeight: 1.08, letterSpacing: 0 }
    page-subtitle: { fontSize: 18, fontWeight: 400, lineHeight: 1.45, letterSpacing: 0 }
    section-title: { fontSize: 24, fontWeight: 650, lineHeight: 1.25, letterSpacing: 0 }
    card-title: { fontSize: 18, fontWeight: 560, lineHeight: 1.25, letterSpacing: 0 }
    metric-large: { fontSize: 38, fontWeight: 560, lineHeight: 1.1, letterSpacing: 0 }
    metric-medium: { fontSize: 34, fontWeight: 550, lineHeight: 1.1, letterSpacing: 0 }
    body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    caption: { fontSize: 12, fontWeight: 450, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 28
    page-y-desktop: 26
    page-x-mobile: 16
    grid-gap: 20
    panel-x: 24
    panel-y: 22
    card-gap: 16
    control-gap: 12
  rounded:
    panel: 22
    nested-panel: 18
    card: 16
    control: 14
    pill: 999
    table: 18
  shadow:
    panel: "0 1px 1px rgba(24, 24, 22, 0.03), 0 16px 40px rgba(24, 24, 22, 0.04)"
    control: "0 1px 2px rgba(24, 24, 22, 0.06)"
    selected: "inset 0 0 0 1px rgba(24, 24, 22, 0.08)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  min_width_policy: min-width-0-on-grid_children
  min_height_policy: min-height-0-on_scroll_children
  fixed_height_tokens:
    metric_tile: 164px
    summary_panel: 380px
    supporting_strip: 136px
    chart_panel: 380px
    table_row: 64px
    table_header: 58px
    control: 48px
quality_anchors:
  - id: balanced_top_mosaic
    name: 首屏平衡拼图区
    required_when: PRD 同时包含摘要、指标或趋势概览
    rule: 用三列或两列响应式网格组织上方模块，至少一个大摘要面板、一个指标拼图区和一个洞察面板形成清晰层级，同一行等高。
  - id: premium_metric_tile
    name: 精制指标卡
    required_when: PRD 包含可量化状态或摘要
    rule: 指标卡必须包含标题、主值、微型状态胶囊和小图标容器；优先指标可使用小面积品牌渐变，其余保持中性浅底。
  - id: soft_chart_chamber
    name: 轻网格图表舱
    required_when: PRD 包含趋势、对比、分布或进度数据
    rule: 图表容器采用内嵌浅灰圆角区域、低对比网格、清晰图例和圆角数据标记；缺少真实数据时使用空状态，不伪造数值。
  - id: tactile_progress_detail
    name: 触感化进度细节
    required_when: PRD 包含配额、进度、完成率、容量或阶段状态
    rule: 使用稳定高度的圆角进度条或分段条，未完成区域可加极浅纹理，数值说明左右对齐并避免撑高容器。
  - id: refined_table_rows
    name: 高完成度明细表
    required_when: PRD 包含记录、任务、订单、事项或对象列表
    rule: 表格使用圆角浅灰表头、固定行高、图标徽章、状态点、hover 与 selected 行反馈，工具栏输入和筛选按钮在标题右侧对齐。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [precise_alignment, stable_panel_heights, subtle_borders, refined_table_header, icon_badges, status_pills, chart_grid_texture, complete_interaction_states]
components:
  card:
    bg: tokens.colors.surface
    roundedRef: tokens.rounded.panel
    border: "1px solid tokens.colors.border-muted"
    shadowRef: tokens.shadow.panel
  metric_card:
    heightRef: layout_stability.fixed_height_tokens.metric_tile
    roundedRef: tokens.rounded.nested-panel
    titleStyle: tokens.typography.card-title
    valueStyle: tokens.typography.metric-medium
  primary_metric_card:
    bg: "linear-gradient(180deg, tokens.colors.brand 0%, tokens.colors.brand-deep 100%)"
    text: "#FFFFFF"
    accent_policy: one_priority_tile_only
  button:
    height: 48
    roundedRef: tokens.rounded.pill
    icon_size: 18
    density: compact
  input:
    height: 48
    roundedRef: tokens.rounded.control
    border: "1px solid tokens.colors.border-subtle"
  table:
    row_heightRef: layout_stability.fixed_height_tokens.table_row
    header_heightRef: layout_stability.fixed_height_tokens.table_header
    header_bg: tokens.colors.surface-muted
    selected_bg: "#F3F3F1"
  chart:
    panel_heightRef: layout_stability.fixed_height_tokens.chart_panel
    grid: dashed_low_contrast
    marks: rounded_or_soft_textured
modules:
  page_identity:
    confidence: observed
    placement: top_before_grid
    render_policy: prd_only
  primary_summary:
    confidence: observed
    placement: top_grid_left_or_full_width_on_mobile
    render_policy: prd_only
  primary_metrics:
    confidence: observed
    placement: top_grid_center_or_after_summary_on_mobile
    render_policy: prd_only
  insight_panel:
    confidence: observed
    placement: top_grid_right_or_after_metrics_on_mobile
    render_policy: prd_only
  quick_actions:
    confidence: observed
    render_policy: prd_only
    placement: inside_summary_or_independent_section_after_summary
    item_count: 2-8
  supporting_widgets:
    confidence: observed
    render_policy: prd_only
    placement: below_top_grid_or_side_column
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: largest_lower_panel
---

# Soft Modular Analytic Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和内容取舍以正文为准。

## 1. 快速理解

这是一个浅灰画布、白色大圆角面板、密集但不压迫的分析工作台视觉 DNA。它适合把页面拆成摘要、指标、趋势、辅助小组件和明细列表，并通过稳定网格维持首屏秩序。

PRD 决定显示什么内容、哪些模块存在、字段如何命名以及数据优先级；本文件只约束 UI 风格、布局气质、组件形态、密度、状态和响应式策略。主题色可以替换默认强调色的色相，但不能改变浅色画布、大圆角面板、等高拼图、轻网格图表和精制表格这些视觉机制。

编码结果需要有清晰的微观细节：对齐准确、行高稳定、图标容器一致、状态胶囊克制、图表网格轻而可见，不能退化成普通默认后台。

## 2. 使用边界

PRD 负责内容、功能、信息架构、业务优先级、模块存在性和数据口径。DESIGN.md 负责视觉 DNA、组件样式、布局稳定性、状态表达、响应式与可访问性。

不要为了套用槽位而凭空创造 PRD 未要求的摘要、指标、图表、快捷入口或表格。PRD 没有量化数据时，不强造数字；PRD 没有趋势数据时，可以用同等完成度的主内容面板、摘要列表或空状态替代。

最终界面不得复用风格来源中的具体业务字段、示例数据、人名、机构名、分类名称或页面专属文案。所有文案、字段、数据和操作必须来自 PRD 或真实产品上下文。

## 3. 设计风格选择与换色逻辑

当页面需要在一个首屏中同时呈现多块摘要、少量高频操作、趋势洞察和可检索明细时，优先选择该风格。它特别适合信息密度中高、需要反复查看和操作的工作台，而不是低密度展示页。

默认强调色不是视觉 DNA。主题色流程只能替换 `brand`、`brand-soft`、`brand-deep`、`focus-ring`、图表强调色和状态辅助色的色相。背景、表面、浅边框、中性文字、大圆角、等高网格、内嵌图表舱和表格行结构必须保持不变。

主题色使用面积要克制：通常只用于一个优先指标卡、主要按钮、状态胶囊、图表标记、focus ring 和少量图标反馈。不要把主题色铺满页面背景、普通卡片或大面积面板。

## 4. 视觉 DNA

### airy_page_shell

不可变机制是低对比浅灰画布与白色大圆角面板。页面不依赖重阴影，而依赖柔和背景差、浅描边、稳定间距和大半径面板来产生品质感。

可变部分是页面标题、模块数量和各面板承载的内容。换主题色时也必须保留浅灰画布和中性表面，不能把整页染成主题色。

缺失该 DNA 会让界面变成普通白底后台，模块之间失去呼吸感和边界秩序。

### mixed_scale_summary_grid

不可变机制是首屏上方的混合尺度拼图区：一个较大的摘要面板、多个指标卡和一个洞察面板共同建立信息层级。指标卡要有明确主值、标题、微状态和图标容器。

可变部分是指标含义、数量、状态语义和展示格式。若 PRD 只有少量摘要，可减少卡片数量，但仍要保持等高和网格对齐。

主题色替换后，优先卡仍可使用小面积渐变，其余指标卡保持中性浅底。缺失该 DNA 会让首屏没有重点，所有信息看起来权重相同。

### contained_insight_panel

不可变机制是内嵌轻网格洞察面板。图表或趋势区域不是漂浮在卡片上，而是放入浅灰圆角容器中，配合低对比网格、简洁图例和圆角数据标记。

可变部分是图表类型、维度、单位、系列数量和 tooltip 内容。没有图表数据时，用同样规格的空状态或解释性内容面板替代，不伪造趋势。

主题色只替换图表强调系列或小面积标记。缺失该 DNA 会让数据区显得粗糙或像默认图表库裸渲染。

### refined_detail_table

不可变机制是大面板中的精制明细表：标题和工具栏在同一行，表头为浅灰圆角区域，行高固定，行内包含图标徽章、状态点、选择框和尾部操作入口。

可变部分是列、行、状态集合、筛选方式和操作菜单。PRD 如果要求列表而不是表格，也应保留稳定行高、图标化起点、状态微细节和 hover 或 selected 反馈。

缺失该 DNA 会让下方明细区退化为普通数据表，首屏品质会明显下降。

### compact_supporting_widgets

不可变机制是辅助小组件的紧凑横向密度。进度、配额、容量、阶段或关联项可用低高度面板承载，内部用横条、分段条、紧凑卡片和图标按钮组织。

可变部分是小组件类型、数量和是否横向滚动。长内容必须截断或内部滚动，不能撑高同一行布局。

缺失该 DNA 会让页面只有大模块，无法形成丰富但克制的工作台质感。

## 5. 视觉品质基线

`balanced_top_mosaic` 在 PRD 同时包含摘要、指标或趋势概览时必须落地。上方区域要像拼图一样稳定，面板之间等高对齐，避免一列很长、一列很短的自由高度布局。

`premium_metric_tile` 在 PRD 包含可量化状态或摘要时必须落地。每张指标卡至少包含标题、主值、状态胶囊和图标容器；优先指标可使用主题渐变，其余保持中性，形成层级而不喧宾夺主。

`soft_chart_chamber` 在 PRD 包含趋势、对比、分布或进度数据时必须落地。图表需要有浅底内嵌容器、低对比网格、图例、圆角或纹理化数据标记。若没有数据，保持容器规格并渲染清晰空状态。

`tactile_progress_detail` 在 PRD 包含配额、进度、完成率、容量或阶段状态时必须落地。进度条要有稳定高度、圆角端点、左右对齐说明和轻微材质差，不能只用一条默认浏览器进度条。

`refined_table_rows` 在 PRD 包含记录、任务、对象或事项列表时必须落地。表头、行高、图标徽章、状态点、选中态、hover 态和尾部操作必须完整，不要只输出裸表格。

## 6. 布局规则

推荐页面结构如下，但槽位不是业务要求，PRD 没有的模块不要强行补：

| 槽位 | 视觉用途 | 渲染条件 |
| --- | --- | --- |
| `page_identity` | 页面身份、短说明、全局操作入口 | PRD 需要页面标题或全局动作时 |
| `primary_summary` | 首要摘要、关键行动或当前状态 | PRD 有主摘要或核心状态时 |
| `primary_metrics` | 多个可比较指标 | PRD 有 2 个以上摘要项时 |
| `insight_panel` | 趋势、对比、分布或主内容洞察 | PRD 有图表或洞察内容时 |
| `supporting_widgets` | 进度、容量、阶段、关联对象 | PRD 有辅助状态时 |
| `detail_table` | 明细记录、对象列表、任务列表 | PRD 有列表或表格数据时 |

主 grid 使用 `display: grid`，桌面端优先三列或 `5fr 5fr 5fr` 的均衡布局，父级统一 `gap: var(--grid-gap)`。同一行面板必须 `align-items: stretch`，面板自身设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。

长内容必须在面板内部滚动、截断或折叠。区块之间的间距由父级 `gap` 管理，不使用零散 margin 拼接。图表容器、表格行、工具栏和进度条必须有稳定高度 token，加载、空状态和错误状态不能改变父级尺寸。

## 7. PRD 槽位映射

| PRD 内容类型 | 推荐槽位 | 视觉处理 |
| --- | --- | --- |
| 页面名称、说明、全局命令 | `page_identity` | 大标题加短说明，命令放右侧或下方操作区 |
| 一个核心摘要 | `primary_summary` | 大数字或主状态加少量操作，内部可放辅助子项 |
| 多个摘要项 | `primary_metrics` | 2x2 或横向网格，优先项可小面积渐变 |
| 趋势、对比、分布 | `insight_panel` | 内嵌浅灰图表舱，保留图例、网格和 tooltip |
| 进度、容量、阶段 | `supporting_widgets` | 紧凑进度条、分段条或小卡片 |
| 高频入口 | `quick_actions` | 独立按钮组或摘要面板内按钮组，是否存在由 PRD 决定 |
| 记录或对象集合 | `detail_table` | 圆角表头、固定行高、图标徽章、状态点和行操作 |
| 无数据或权限不足 | 对应槽位空状态 | 保持面板尺寸，展示简洁说明和可用操作 |

## 8. 组件规则

卡片和面板使用白色表面、22px 左右大圆角、浅边框和柔和阴影。嵌套内容使用更小圆角和浅灰底，避免卡片套卡片的厚重感；嵌套区域应像内容舱，而不是另一个完整面板。

指标和摘要使用显著主值、短标题、微状态胶囊和图标容器。主值不要过度加粗，推荐 550 到 600 字重，保持数字清晰和现代。状态胶囊用浅底小面积颜色，并搭配箭头、点、图标或文字，不能只靠颜色。

图表或主内容面板必须有固定高度，内部网格线低对比，图例使用小圆点或小色块。柱、条、线、区域或分段标记要有圆角或细微纹理，tooltip 必须跟随主题色但保持白色表面和浅描边。

表格和列表使用 58px 左右表头、64px 左右行高、浅灰圆角表头、左侧选择框或图标容器、状态点、尾部菜单。hover 使用极浅底色，selected 使用整行浅灰底加明确选择控件，focus ring 使用主题色派生。

输入和按钮保持 48px 高度。主按钮使用主题强调色和图标，次按钮使用中性浅灰底。筛选、更多、展开、搜索等工具按钮优先使用图标加必要短文本，并提供 tooltip 或可访问标签。

快捷入口只在 PRD 要求时渲染。视觉上可以放在摘要面板内或摘要之后的独立区域，按钮使用圆角胶囊、图标和稳定宽高；不要塞进表格工具栏或面板角落作为杂项入口。

所有组件必须覆盖 loading、empty、error、disabled、hover、focus、selected 状态。加载态使用骨架屏或占位块，并保持最终布局尺寸。

## 9. 响应式与可访问性

桌面端使用多列网格；中等宽度降为两列；小屏幕降为单列，顺序为 `page_identity`、`primary_summary`、`primary_metrics`、`insight_panel`、`supporting_widgets`、`detail_table`。移动端页面左右 padding 不低于 16px，面板圆角可降到 18px。

表格在小屏幕可横向滚动或转换为稳定列表行，但列标题、状态、主操作和选择态不能丢失。图表在小屏幕保持最小高度 280px，并允许横向滚动或简化维度标签。

所有可点击目标不小于 44px。纯图标按钮必须有 `aria-label` 和 tooltip。状态不能只靠颜色表达，需要配合文字、图标、形状或位置。键盘 focus ring 使用 `tokens.colors.focus-ring`，对比度清晰但不刺眼。

动效保持轻量，hover 和 selected 过渡在 120ms 到 180ms 之间。遵守 `prefers-reduced-motion`，关闭非必要位移和闪烁。

## 10. 禁止项

- 禁止复制具体业务内容、示例数据、专属文案、人名、机构名或分类名。
- 禁止让 DESIGN.md 覆盖 PRD 的内容、功能和信息架构决策。
- 禁止把输入主题色铺满背景、普通指标卡或大面积面板。
- 禁止把默认强调色误当成视觉 DNA。
- 禁止做成默认后台质感：裸表格、无细节卡片、粗糙图表、随意阴影都不合格。
- 禁止瀑布流、自由高度卡片、无固定高度图表容器和长内容撑破父级。
- 禁止用零散 margin 拼接布局，区块间距必须由父级 gap 管理。
- 禁止文字溢出按钮、卡片、表头或状态胶囊。
- 禁止缺失 hover、focus、selected、loading、empty、error、disabled 状态。

## 11. Agent 使用提示

先读取 PRD，确认内容、模块和数据是否存在；再读取主题色输入，按 `theme_adaptation` 替换强调色；最后应用本视觉 DNA。不要硬套槽位，不要为了还原某种构图而凭空创造 PRD 未要求的内容。

实现时优先搭建稳定网格、等高面板和固定尺寸图表容器，再填充组件。指标卡、图表舱、进度细节和明细表是该风格的品质锚点，凡是 PRD 条件满足就必须做完整状态和微细节。

主题色只改变强调色相和派生辅助色，不改变浅灰画布、白色面板、中性文字、浅边框、大圆角、等高布局和小面积强调机制。交付前必须按自检清单确认视觉品质没有退化为普通后台。

## 12. 交付自检清单

- 内容、字段、数据、文案和操作是否全部来自 PRD 或真实产品上下文。
- 是否保留浅灰画布、白色大圆角面板、稳定 gap 和柔和边界。
- 首屏摘要、指标、洞察或替代主内容是否按 PRD 条件形成平衡拼图区。
- 主题色是否只替换强调色、图表系列、状态辅助色和 focus ring。
- 是否避免把主题色铺满背景、普通卡片或大面积面板。
- 图表或主内容面板是否有固定高度、内嵌浅底、低对比网格或同等品质细节。
- 表格或列表是否有圆角表头、固定行高、图标徽章、状态点、hover 与 selected 反馈。
- 长内容是否内部滚动、截断或折叠，没有撑破父级。
- 布局是否使用 `align-items: stretch`、`height: 100%`、`min-width: 0`、`min-height: 0` 和父级 `gap`。
- loading、empty、error、disabled、hover、focus、selected 状态是否完整。
- 移动端是否按单列顺序折叠，表格和图表是否有可用的窄屏策略。
- 纯图标按钮是否有 tooltip 或 `aria-label`，状态是否不只依赖颜色。
