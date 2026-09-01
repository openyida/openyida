---
version: alpha
template_type: visual_dna_preset
name: soft-analytic-workbench
design_id: soft-analytic-workbench
design_status: draft
description: 可被流程选择、可换主题色、内容中立的轻量分析工作台视觉 DNA 风格。
scenes: [工作台, 仪表盘, 管理后台首页, 数据概览, 列表分析页]
density: medium-high
layout: asymmetric_analytic_grid
tone: [轻盈, 克制, 清晰, 数据化, 专业]
tags: [浅色工作台, 圆角面板, 指标拼图, 图表面板, 明细列表]
avoid: [营销落地页, 品牌叙事页, 沉浸式大屏, 内容长文页, 低密度展示页]
selection:
  best_for: [数据工作台, 指标总览, 运营首页, 管理后台首页, 分析列表页]
  user_intent: [快速扫描状态, 比较多组数据, 处理待办明细, 追踪趋势变化, 查看摘要与详情]
  visual_tone: [白底, 浅灰画布, 蓝色小面积强调, 大圆角, 轻图表, 高可读]
  avoid_for: [强品牌表达, 情绪化叙事, 海报式首屏, 信息极少的展示页面]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: soft_panel_canvas
    name: 浅灰画布与白色面板
    confidence: observed
    hooks: [page_shell, panel_surface, surface_muted, subtle_border, soft_shadow]
    invariant: [low_contrast_page_background, white_primary_panels, large_radius_panels, quiet_panel_separation]
    variable: [page_content, module_count, brand_hue]
  - id: metric_mosaic_header
    name: 指标拼图式摘要区
    confidence: observed
    hooks: [metric_grid, highlighted_metric_card, icon_badge, trend_pill, equal_height_cards]
    invariant: [compact_metric_tiles, one_accent_tile_allowed, strong_number_hierarchy, tiny_status_pills]
    variable: [metric_labels, metric_values, status_direction, accent_hue]
  - id: light_analytic_charts
    name: 轻网格数据图表
    confidence: observed
    hooks: [chart_panel, dashed_grid, rounded_bar_segments, smooth_line_series, chart_tooltip, legend_dots]
    invariant: [fixed_chart_height, pale_grid_lines, small_area_color_usage, visible_tooltip_craft]
    variable: [chart_type, series_count, category_labels, theme_color]
  - id: side_detail_stream
    name: 右侧纵向明细流
    confidence: observed
    hooks: [side_panel, list_row, avatar_or_icon_token, outline_action_button, row_separator]
    invariant: [narrow_supporting_column, stable_row_height, left_icon_right_action, quiet_dividers]
    variable: [row_content_type, action_label, icon_source, list_density]
  - id: rounded_table_detail
    name: 圆角明细表格系统
    confidence: observed
    hooks: [table_panel, muted_table_header, status_chip, row_action_menu, fixed_row_height]
    invariant: [soft_header_background, aligned_columns, compact_status_chips, icon_only_row_actions]
    variable: [column_schema, record_content, status_categories]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.brand-strong, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-1, tokens.colors.chart-2, tokens.colors.info, tokens.colors.success, tokens.colors.warning, tokens.colors.danger]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.colors.shadow-color]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - preserve_white_panel_system
    - preserve_light_grid_and_rounded_geometry
tokens:
  colors:
    bg-page: "#F4F4F3"
    surface: "#FFFFFF"
    surface-muted: "#F7F7F6"
    surface-soft: "#F1F5FF"
    text-primary: "#1F2328"
    text-secondary: "#777B82"
    text-tertiary: "#A2A7AF"
    border-subtle: "#ECEEF2"
    border-muted: "#F3F4F6"
    brand: "#367EF0"
    brand-strong: "#174B99"
    brand-soft: "#EAF2FF"
    chart-1: "#367EF0"
    chart-2: "#40C7DD"
    success: "#22B15B"
    success-soft: "#EAF8F0"
    danger: "#D94A4A"
    danger-soft: "#FDEEEF"
    warning: "#E7A12F"
    info: "#367EF0"
    focus-ring: "#8DBBFF"
    shadow-color: "rgba(31, 35, 40, 0.05)"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    panel-title: { fontSize: 22, fontWeight: 650, lineHeight: 1.25, letterSpacing: 0 }
    metric-label: { fontSize: 17, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 }
    metric-value: { fontSize: 40, fontWeight: 520, lineHeight: 1.05, letterSpacing: 0 }
    body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    caption: { fontSize: 13, fontWeight: 400, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 24
    page-y-desktop: 24
    grid-gap: 22
    panel-x: 28
    panel-y: 26
    card-gap: 14
    row-gap: 0
  rounded:
    panel: 28
    card: 22
    control: 18
    pill: 999
    icon: 999
  shadow:
    panel: "0 18px 44px rgba(31, 35, 40, 0.04)"
    floating: "0 14px 30px rgba(54, 126, 240, 0.24)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  panel_min_width: 0
  panel_min_height: 0
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    metric_group: 360px
    metric_card: 165px
    top_chart_panel: 360px
    primary_chart_panel: 395px
    side_panel: 600px
    table_row: 62px
    list_row: 76px
quality_anchors:
  - id: inset_metric_mosaic
    name: 内嵌式指标拼图区
    required_when: PRD 包含 3 个以上摘要、状态或核心指标
    rule: 使用 2x2 或自适应等高卡片拼图，卡片之间只用父级 gap 分隔；允许一个主强调卡，其余保持浅灰白底。
  - id: refined_chart_texture
    name: 图表微纹理
    required_when: PRD 包含趋势、对比、分布或进度数据
    rule: 图表必须有浅网格、圆角柱或平滑线、半透明填充、图例点和悬浮提示，不使用裸坐标轴默认样式。
  - id: right_hand_detail_stream
    name: 右侧明细流
    required_when: PRD 包含提醒、任务、联系人、消息、审批、资源或事件列表
    rule: 右侧面板使用固定宽度区间、稳定行高、圆形图标位和描边操作按钮，列表项之间用极浅分隔线。
  - id: soft_table_craft
    name: 柔和明细表格
    required_when: PRD 包含结构化记录或可操作明细
    rule: 表头使用浅灰圆角底，状态用低饱和胶囊标签，行操作使用图标按钮；列宽稳定并允许长文本截断。
  - id: floating_chart_tooltip
    name: 悬浮数据提示
    required_when: PRD 包含可交互图表或时间序列高亮
    rule: 使用主题色小面积浮层、圆角、阴影和指向锚点；浮层信息简短，不遮挡主要走势。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [precise_alignment, equal_height_panels, subtle_panel_shadow, pale_chart_grid, rounded_chart_segments, refined_status_pills, stable_row_heights, icon_button_tooltips]
components:
  card:
    surface: tokens.colors.surface
    roundedRef: tokens.rounded.panel
    shadowRef: tokens.shadow.panel
    border: "1px solid tokens.colors.border-subtle"
  metric_card:
    height: tokens.layout_stability.fixed_height_tokens.metric_card
    background: tokens.colors.surface-muted
    highlighted_background: tokens.colors.brand
    roundedRef: tokens.rounded.card
    icon_badge: circular_soft_badge
  chart:
    grid: pale_dashed_horizontal
    line: smooth_2px_with_soft_area
    bar: rounded_segmented_columns
    tooltip: compact_floating_badge
  table:
    header: muted_rounded_header
    row_height: tokens.layout_stability.fixed_height_tokens.table_row
    row_action: icon_only_menu
  list:
    row_height: tokens.layout_stability.fixed_height_tokens.list_row
    leading_visual: circular_icon_or_avatar_slot
    trailing_action: outline_pill_button
  button:
    primary: filled_brand_small_area
    secondary: outline_brand_pill
    icon: circular_or_ghost_with_tooltip
modules:
  page_identity:
    confidence: inferred
    render_policy: prd_only
    placement: above_grid_or_compact_header
  primary_metrics:
    confidence: observed
    render_policy: prd_only
    placement: top_left_or_first_grid_area
    item_count: 2-6
  primary_content_panel:
    confidence: observed
    render_policy: prd_only
    placement: wide_main_column
  supporting_panel:
    confidence: observed
    render_policy: prd_only
    placement: right_or_adjacent_column
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: below_primary_panel_or_full_width
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_after_summary
    item_count: 4-8
---

# Soft Analytic Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一个浅色、克制、高可读的数据工作台视觉 DNA，核心是浅灰画布、白色大圆角面板、指标拼图区、轻网格图表和纵向明细流。它适合需要同时呈现摘要、趋势、列表和结构化明细的页面。

PRD 决定展示什么内容、哪些模块存在、数据优先级如何排序；本文件只定义 UI 风格、布局稳定性、组件形态和视觉品质。主题色可以替换默认强调色，但不能改变白底面板、圆角系统、轻网格图表和小面积强调机制。

不适合用在强品牌叙事、营销转化、沉浸式大屏或信息极少的页面。编码结果必须呈现足够的微观细节，不能退化成默认后台组件的堆叠。

## 2. 使用边界

PRD 决定内容、功能、信息架构、业务优先级、字段结构、模块数量和交互目标。DESIGN.md 约束视觉 DNA、密度、表面层级、圆角、阴影、状态、响应式和可访问性。

不要为了匹配槽位而凭空增加 PRD 没有要求的指标、图表、列表或快捷入口。不要复用任何具体业务字段、示例数据、人名、机构名、分类名称或页面专属文案；所有文案、数据和操作都必须来自 PRD 或产品信息架构。

当 PRD 没有图表数据时，可以使用同等品质的主内容面板承载摘要、流程、状态分布或核心列表，但仍要保留浅面板、稳定高度、精细分隔和小面积强调。

## 3. 设计风格选择与换色逻辑

上游流程应在页面需要高密度扫描、摘要与明细并存、趋势或对比信息明确时选择该风格。若需求主要是品牌展示、长文阅读、海报式视觉、低密度单任务表单，则不应选择。

默认强调色只是初始 token，不是视觉 DNA。主题色只替换 `brand`、`brand-soft`、`focus-ring`、图表序列和少量状态辅助色；背景、白色面板、中性文字、浅边框、大圆角、轻阴影和稳定网格必须保留。

主题色不能铺满页面背景、不能把所有卡片染成品牌色、不能让大面积面板变成高饱和色块。小面积强调应主要出现在主指标卡、图表线条、圆角柱、图例点、聚焦状态、趋势胶囊和描边按钮。

## 4. 视觉 DNA

`soft_panel_canvas` 要求页面从低对比浅灰背景开始，用白色面板和极浅阴影划分区域。可变的是模块内容和数量，不可变的是低噪声画布、大圆角面板和安静边界。缺失时页面会变成普通白底后台，层级不够柔和。

`metric_mosaic_header` 要求摘要信息以等高小卡片形成拼图。允许一个卡片使用主题色作为主强调，其余卡片保持浅灰或白底；数值层级要强，趋势和状态用小胶囊表达。缺失时首屏缺少扫描锚点。

`light_analytic_charts` 要求图表使用浅网格、圆角分段、平滑曲线、轻填充和悬浮提示。主题色替换后仍要保留低对比网格与小面积颜色承载。缺失时图表容易呈现默认库样式，精致度明显下降。

`side_detail_stream` 要求辅助信息以窄列纵向流呈现，行高稳定，左侧保留圆形视觉位，右侧保留轻量操作。可变的是列表内容类型和动作名称，不可变的是窄列、行分隔、圆形视觉位和描边操作按钮。

`rounded_table_detail` 要求结构化明细使用柔和表头、稳定列宽、状态胶囊和图标化行操作。缺失时表格会过硬、过满或缺少与整体圆角系统的统一性。

## 5. 视觉品质基线

当 PRD 有 3 个以上摘要或状态时，必须落地内嵌式指标拼图区。它用等高拼图、强数值层级和小型图标胶囊建立首屏扫描路径；如果没有量化数据，可以用状态摘要或关键对象卡替代。

当 PRD 有趋势、对比或分布时，必须落地图表微纹理。浅网格、圆角柱、平滑线、半透明填充、图例点和精致 tooltip 是区别默认图表的关键；如果没有图表，应以同等高度的主内容面板承载高优先级内容。

当 PRD 有待办、提醒、事件、消息、资源或人员型条目时，应使用右侧明细流。它通过固定宽度、稳定行高、圆形视觉位和描边按钮形成快速处理区；没有此类内容时，不要强行生成右侧列表。

当 PRD 有记录型数据时，应使用柔和明细表格。表头要轻，行高要稳，状态标签要低饱和，行操作应图标化并有 tooltip；没有记录数据时，可替换为卡片列表或主内容面板。

交互式图表应提供悬浮数据提示。浮层使用主题色小面积承载、圆角、阴影和指向锚点，信息简短且不遮挡主体。

## 6. 布局规则

推荐桌面布局为非对称分析网格：左侧主列承载指标组、主图表和明细表格，右侧或相邻列承载辅助列表或短摘要面板。槽位只是视觉映射，不是业务结构要求；PRD 没有的模块不要补。

主 grid 使用 `display: grid` 和 `align-items: stretch`，桌面可采用 `minmax(0, 2fr) minmax(320px, 0.95fr)` 或按信息量调整。面板之间只使用父级 `gap`，不要用零散 margin 拼接。

同一行面板必须等高。所有面板设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。图表容器必须有固定或响应式稳定高度，列表和表格长内容使用内部滚动、截断或折叠。

指标卡高度保持一致，图标位固定在右上或标题旁，趋势胶囊与补充说明同排排列。大图表面板需要保留宽松内边距和明确标题区，图表绘图区不能贴边。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 渲染规则 |
| --- | --- | --- |
| 页面身份、筛选周期、全局动作 | `page_identity` / `global_actions` | 使用紧凑标题区或面板标题右侧控件，不创建大型营销头图。 |
| 多个摘要、状态、核心对象 | `primary_metrics` | 使用等高指标拼图；没有数字时可用短摘要、状态或对象卡。 |
| 趋势、对比、分布、进度 | `primary_content_panel` / `trend_panel` | 优先用轻网格图表；没有图表数据时用同等品质主内容面板。 |
| 辅助提醒、任务、消息、资源 | `supporting_panel` | 使用右侧或相邻纵向明细流；PRD 没有时不渲染。 |
| 结构化记录、明细、审批、资源表 | `detail_table` | 使用柔和表头、稳定行高、状态胶囊和图标化操作。 |
| 高频入口或快捷命令 | `quick_actions` | 仅 PRD 明确需要时渲染为独立区块，不塞入表格工具栏或侧栏尾部。 |

## 8. 组件规则

卡片和面板使用白色或浅灰表面、`22-28px` 圆角、极浅边框和低强度阴影。不要在面板内部再放装饰性大卡片；重复项卡片可以使用更轻的 `16-20px` 圆角。

指标组件需要明确标题、数值、趋势/状态和图标位。主强调指标可以使用主题色底，但最多小面积出现；其他指标保持中性表面。趋势胶囊使用状态色浅底，并同时用图标或文本表达方向，不能只靠颜色。

图表使用浅网格、清晰图例、圆角柱、平滑线和轻透明填充。坐标标签使用次级文字色，线条不超过 `2-3px`，柱体和节点需要圆角或柔化处理。

表格使用浅灰圆角表头、稳定行高、低饱和状态胶囊、轻分隔线和图标按钮。长文本截断并提供完整信息入口，表格操作按钮不得撑高行。

列表行使用固定高度、圆形图标或头像槽、主副文本两级层级、右侧轻量动作。按钮优先使用图标、描边胶囊或小面积品牌色；纯图标按钮必须有 tooltip 和可见 focus ring。

快捷入口只在 PRD 需要时出现，作为独立区块。入口项可使用圆形图标、短标签和浅灰底，数量建议 4-8 个，保持等宽或稳定栅格。

加载态使用骨架屏或淡色占位；空态保持同样的面板结构，不用夸张插画；错误态使用浅色状态提示加明确恢复动作；disabled、selected、hover、focus 状态必须完整。

## 9. 响应式与可访问性

桌面使用双列或多列网格；`<= 1024px` 时辅助列下移；`<= 720px` 时所有面板单列堆叠，指标拼图变为 1-2 列自适应。移动端保持面板宽度满行，列表和表格允许横向滚动或卡片化，不让内容撑破父级。

触控目标不小于 `44px`。focus ring 使用 `tokens.colors.focus-ring`，对比度足够且不依赖颜色本身表达状态。所有图标按钮、图例切换、菜单按钮和行操作都需要可访问名称。

图表信息不能只靠颜色区分，至少用图例、纹理、标签、线型或 tooltip 补充。动效保持轻微，尊重 `prefers-reduced-motion`，避免大幅位移和持续闪烁。

## 10. 禁止项

- 禁止复制具体业务内容、字段、示例数据、名称、头像身份、分类或页面专属文案。
- 禁止让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止为了套槽位而凭空创造指标、图表、列表、快捷入口或表格。
- 禁止把输入主题色铺满背景、指标卡底色或大面积面板。
- 禁止把当前主题色误当成视觉 DNA。
- 禁止默认后台质感、硬边框、密集黑线表格和无细节图表。
- 禁止瀑布流、自由高度卡片、无固定高度图表容器、长内容撑破父级和零散 margin 拼接。
- 禁止使用负字距或随视口宽度缩放字体。

## 11. Agent 使用提示

先阅读 PRD，确定实际内容、模块和业务优先级；再读取本 preset，应用输入主题色到强调 token；最后按视觉 DNA 生成 UI。不要硬套槽位，不要凭空创造内容，不要复用任何页面专属文案或示例数据。

实现时优先保证浅灰画布、白色大圆角面板、等高网格、指标拼图、轻网格图表、右侧明细流和柔和表格这些品质机制。主题色只替换色相和小面积强调，不改变圆角、面板、留白、图表微纹理和布局稳定规则。

交付前必须检查图表、表格、列表、按钮、tooltip、hover、focus、loading、empty、error、disabled 和 selected 状态，确保视觉结果不是默认后台组件的简单拼装。

## 12. 交付自检清单

- [ ] 页面内容、字段、数据、动作和模块是否全部来自 PRD。
- [ ] 是否保留浅灰画布、白色面板、大圆角、轻边框和低强度阴影。
- [ ] 指标、图表、列表、表格是否按 PRD 条件落地，而不是强行补齐。
- [ ] 主题色是否只改写强调色、图表序列、状态辅助色和 focus ring。
- [ ] 是否避免把主题色铺满背景或大面积卡片。
- [ ] 主 grid 是否 `align-items: stretch`，同排面板是否等高。
- [ ] 面板是否设置 `height: 100%`、`min-width: 0`、`min-height: 0` 和内部滚动/截断策略。
- [ ] 图表是否有浅网格、圆角或平滑处理、图例和悬浮提示。
- [ ] 表格和列表是否有稳定行高、轻分隔、状态标签和完整操作状态。
- [ ] 纯图标按钮是否有 tooltip、可访问名称和 focus ring。
- [ ] 响应式折叠后是否无重叠、无溢出、无文本撑破。
- [ ] 加载、空、错误、禁用、选中、悬浮和聚焦状态是否完整。
