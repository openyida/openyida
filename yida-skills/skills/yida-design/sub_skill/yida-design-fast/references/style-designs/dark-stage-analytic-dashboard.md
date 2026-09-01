---
version: alpha
template_type: visual_dna_preset
name: dark-stage-analytic-dashboard
design_id: dark-stage-analytic-dashboard
design_status: draft
description: 可被流程选择和换色的深色指标舞台型分析仪表盘视觉 DNA 风格。
scenes: [仪表盘, 数据工作台, 管理后台首页, 分析看板]
density: medium-high
layout: hero_metric_stage_with_analysis_grid
tone: [专业, 精致, 数据化, 高对比, 轻奢]
tags: [深色指标舞台, 玻璃指标卡, 轻量图表面板, 明细表格, 数据纹理]
avoid: [营销落地页, 内容阅读页, 表单密集录入页, 移动端单任务流程, 极简工具页]
selection:
  best_for: [指标总览页, 数据分析首页, 运营看板, 管理后台仪表盘, 明细追踪页]
  user_intent: [快速浏览关键摘要, 对比多个指标, 查看分布热度, 追踪明细记录, 导出或筛选数据]
  visual_tone: [浅色画布, 深色焦点区, 大圆角, 克制霓虹强调, 精致数据纹理]
  avoid_for: [长文阅读, 强品牌叙事, 沉浸式大屏, 复杂表单编辑, 低密度宣传页]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: editorial_header_actions
    name: 大标题与轻量全局操作
    confidence: observed
    hooks: [page_shell, page_title, global_actions, icon_button, primary_action]
    invariant: [large_left_title, compact_right_actions, clear_top_scan_path, icon_action_pairing]
    variable: [page_title_text, action_count, action_semantics, brand_hue]
  - id: dark_metric_stage
    name: 深色渐变指标舞台
    confidence: observed
    hooks: [summary_stage, dark_surface, bottom_accent_glow, metric_card_grid, glass_metric_card]
    invariant: [dark_high_contrast_stage, rounded_full_width_container, embedded_metric_cards, subtle_bottom_glow]
    variable: [metric_count, metric_labels, icon_set, brand_hue, numeric_content]
  - id: soft_analysis_panels
    name: 柔和白底分析面板网格
    confidence: observed
    hooks: [analysis_grid, equal_height_panels, chart_panel, supporting_panel, align_items_stretch]
    invariant: [white_card_panels, generous_radius, stable_two_column_grid, parent_gap_spacing]
    variable: [panel_count, chart_type, side_panel_content, module_order]
  - id: micro_texture_visualization
    name: 细颗粒数据可视化纹理
    confidence: observed
    hooks: [heatmap_cells, segmented_control, legend_steps, striped_bar, floating_badge]
    invariant: [small_rounded_cells, pale_grid_baseline, small_area_accent, soft_label_badges, textured_comparison_marks]
    variable: [series_count, time_unit, category_names, chart_values, brand_hue]
  - id: rounded_detail_table
    name: 大圆角明细表系统
    confidence: observed
    hooks: [detail_table, search_icon_button, iconized_rows, stable_row_height, truncated_secondary_text]
    invariant: [large_panel_container, roomy_table_rows, light_dividers, iconized_first_column, compact_tool_button]
    variable: [columns, row_actions, cell_content, sort_filter_controls]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.brand-mid, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.brand-glow, tokens.colors.chart-step-1, tokens.colors.chart-step-2, tokens.colors.chart-step-3, tokens.colors.chart-step-4, tokens.colors.status-soft]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.bg-page-warm, tokens.colors.stage-bg, tokens.colors.stage-card, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle]
  rules:
    - theme_color_only_changes_accent_hue
    - replace_hue_preserve_dark_stage_contrast
    - do_not_tint_page_background
    - do_not_turn_neutral_panels_into_colored_panels
    - keep_accent_usage_small_area
    - keep_dark_stage_as_primary_contrast_mechanism
tokens:
  colors:
    bg-page: "#F7F5F2"
    bg-page-warm: "#F3F0EC"
    surface: "#FFFFFF"
    surface-muted: "#F1F0F5"
    surface-soft: "#FAFAFB"
    stage-bg: "#060A12"
    stage-bg-soft: "#101529"
    stage-card: "rgba(255,255,255,0.12)"
    stage-card-border: "rgba(255,255,255,0.22)"
    text-primary: "#08090D"
    text-secondary: "#686872"
    text-tertiary: "#9A99A4"
    text-inverse: "#FFFFFF"
    text-inverse-muted: "rgba(255,255,255,0.62)"
    border-subtle: "#E8E5E1"
    border-muted: "#F0EEF2"
    brand: "#4C43F5"
    brand-mid: "#8F86F3"
    brand-soft: "#E9E6FF"
    brand-glow: "rgba(76,67,245,0.72)"
    chart-step-1: "#F2F1F6"
    chart-step-2: "#DAD7F5"
    chart-step-3: "#AEA7EE"
    chart-step-4: "#5951E9"
    status-soft: "#EDEAFB"
    focus-ring: "#9289FF"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    page-title: { fontSize: 46, fontWeight: 650, lineHeight: 1.08, letterSpacing: 0 }
    stage-title: { fontSize: 28, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0 }
    section-title: { fontSize: 28, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0 }
    metric-label: { fontSize: 18, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0 }
    metric-value: { fontSize: 42, fontWeight: 500, lineHeight: 1.05, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    caption: { fontSize: 14, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 32
    page-y-desktop: 28
    page-x-mobile: 16
    grid-gap: 24
    stage-x: 36
    stage-y: 34
    panel-x: 32
    panel-y: 30
    card-gap: 14
    control-gap: 12
  rounded:
    sm: 8
    md: 12
    control: 18
    pill: 22
    panel: 30
    stage: 28
  shadow:
    panel: "0 18px 52px rgba(36, 32, 45, 0.06)"
    stage: "0 18px 48px rgba(8, 9, 13, 0.16)"
    floating: "0 14px 32px rgba(36, 32, 45, 0.10)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    global_action_button: 64px
    primary_action_button: 64px
    summary_stage: 320px
    metric_card: 150px
    chart_panel: 440px
    supporting_panel: 440px
    detail_panel_min: 420px
    table_row: 78px
quality_anchors:
  - id: dark_metric_stage_anchor
    name: 深色全宽指标舞台
    required_when: PRD 包含多个关键摘要或核心指标
    rule: 使用全宽深色大圆角容器承载摘要，底部保留小面积主题色光晕，内部指标卡使用半透明玻璃质感和细边框，不把主题色铺满舞台。
  - id: glass_metric_cards_anchor
    name: 玻璃态指标卡组
    required_when: PRD 包含 3 个以上可并列比较的摘要项
    rule: 指标卡等高等宽，内部左上放图标容器，标签与数值强弱分明，卡片边框比背景亮一档，底部可透出轻微强调色渐变。
  - id: heatmap_panel_anchor
    name: 浅色热力网格面板
    required_when: PRD 包含时间、频率、分布、活跃度或密度类数据
    rule: 使用大幅白底面板、圆角小方块、浅灰基线格、3-5 阶主题色图例和分段控制；格子尺寸固定，不能随数值撑开布局。
  - id: comparison_texture_anchor
    name: 纹理化对比图面板
    required_when: PRD 包含目标、比例、分组对比、进度或构成关系
    rule: 使用圆角条形、斜纹填充、浅色占位块和悬浮标签组合，强调色只用于关键条或纹理，不使用默认柱状图裸样式。
  - id: spacious_detail_table_anchor
    name: 宽松明细表与图标化首列
    required_when: PRD 包含记录、实体、任务、交易、事件或可搜索列表
    rule: 表格放入大圆角白底面板，行高稳定，首列配图标容器与主副文本，右上工具使用圆形或圆角图标按钮，长文本截断。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [deep_metric_stage, glass_metric_cards, stable_equal_height_grid, heatmap_micro_cells, textured_comparison_marks, spacious_table_rows, precise_icon_buttons]
components:
  page_header: { titleRef: tokens.typography.page-title, actionHeight: 64 }
  stage: { tokenRef: tokens.colors.stage-bg, roundedRef: tokens.rounded.stage, shadowRef: tokens.shadow.stage }
  metric_card: { tokenRef: tokens.colors.stage-card, borderRef: tokens.colors.stage-card-border, roundedRef: tokens.rounded.panel }
  panel: { tokenRef: tokens.colors.surface, roundedRef: tokens.rounded.panel, shadowRef: tokens.shadow.panel }
  icon_button: { size: 64, roundedRef: tokens.rounded.control }
  button: { height: 64, roundedRef: tokens.rounded.control }
  segmented_control: { height: 56, roundedRef: tokens.rounded.pill }
  chart_cell: { size: 36, roundedRef: tokens.rounded.sm }
  table_row: { height: 78 }
modules:
  page_identity:
    confidence: observed
    render_policy: prd_only
    placement: top_left
  global_actions:
    confidence: observed
    render_policy: prd_only
    placement: top_right
    style: icon_button_plus_primary_pill
  primary_summary:
    confidence: observed
    render_policy: prd_only
    placement: first_section_full_width
    preferred_item_count: 3-6
  paired_analysis_panels:
    confidence: observed
    render_policy: prd_only
    placement: after_primary_summary
    desktop_ratio: 2fr_1.15fr
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: after_analysis_panels
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_after_summary
    item_count: 4-8
---

# Dark Stage Analytic Dashboard DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一套深色指标舞台型分析仪表盘视觉 DNA：浅暖画布承托页面，首屏用深色全宽容器集中展示核心摘要，下面用柔和白底面板承载图表、对比和明细。

PRD 决定内容、功能、模块和信息优先级，DESIGN.md 只决定这些内容的视觉形态、布局稳定性、组件状态和可访问性。

适合指标总览、分析首页、数据工作台和带明细追踪的管理后台；不适合长文阅读、表单密集录入、营销转化和极简单任务页面。

主题色可以替换默认强调色的色相，但不能改变“浅色画布 + 深色舞台 + 玻璃指标卡 + 轻面板分析网格”的机制。

编码结果必须保留足够的微观品质：半透明指标卡、底部光晕、热力小格、斜纹对比条、悬浮标签、图标化行和稳定等高网格。

## 2. 使用边界

PRD 是内容来源。页面标题、指标含义、筛选项、图表维度、表格字段、导出或搜索等操作，都必须来自 PRD 或产品上下文。

DESIGN.md 不决定业务信息架构，不强制页面必须有指标、热力图、对比图或表格。它只在 PRD 存在对应内容时，规定这些内容如何落到高品质 UI 中。

禁止复用风格来源中的具体业务字段、示例数据、分类名称、人名、机构名和页面专属文案。需要样例时只能使用中性槽位名，例如 `primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table`。

如果 PRD 没有量化数据，不要硬造数字；如果没有明细数据，不要硬造表格；如果没有全局操作，不要为了视觉完整而补按钮。

## 3. 设计风格选择与换色逻辑

上游流程可在用户需要“数据总览 + 图表分析 + 明细追踪”的页面时选择本风格。它尤其适合首屏需要形成强焦点、同时下方仍要保持高密度扫描效率的产品界面。

不要把默认强调色理解成固定风格。这个视觉母体的关键是深浅反差、圆角尺度、玻璃卡、数据纹理和小面积强调，而不是某一种具体色相。

主题色改写时，只替换 `brand`、`brand-mid`、`brand-soft`、`brand-glow`、图表阶梯色、选中态、focus ring 和状态辅助色。背景、白底面板、深色舞台、中性文字、浅边框、圆角尺度、卡片透明度和布局比例必须保留。

输入主题色再鲜艳，也不能铺满页面背景、白色面板、指标卡主体或表格区域。主题色应集中在舞台底部光晕、图表格子、图例、关键条、选中态、状态点和少量主要按钮中。

## 4. 视觉 DNA

### 大标题与轻量全局操作

首屏顶部使用大字号页面身份和右侧紧凑操作区。标题要成为第一视觉落点，操作区只保留 PRD 需要的全局工具：可以是图标按钮、主要操作按钮、筛选入口或导出入口。

主题色可影响主要操作按钮和 focus ring，但不能让顶部变成厚重导航栏。缺失该 DNA 时，页面会退化成普通后台标题栏，首屏气质明显变弱。

### 深色渐变指标舞台

核心摘要应进入全宽深色容器。容器大圆角、暗色底、低饱和内部渐变和底部小面积主题光晕共同形成“舞台”感。

内部指标卡应像嵌入舞台的玻璃块：半透明暗面、细亮边、图标容器、强数值层级。PRD 可以改变指标数量和内容，但不能改成松散白色卡片或普通彩色 KPI 区。

### 柔和白底分析面板网格

舞台之后进入白底分析区，桌面端优先使用主辅两列或等高卡片行。面板之间通过父级 `gap` 分隔，不使用零散 margin。

PRD 可以决定左侧是图表、趋势、地图、列表或其他主内容，右侧是对比、摘要、提醒或辅助判断。没有辅内容时可以单列全宽，但仍要保持稳定高度和大圆角轻阴影。

### 细颗粒数据可视化纹理

图表不应只使用默认线图或柱图。该母体需要小颗粒视觉细节：圆角热力格、渐进图例、分段控制、斜纹填充、悬浮数值标签、浅色占位条。

主题色只改变这些纹理的色相和阶梯，不改变纹理形态。缺失时页面会变成普通卡片图表，精致度不足。

### 大圆角明细表系统

明细内容应被放入宽松白底大面板。表格行高稳定，首列可以使用图标容器和主副文本形成扫描锚点；右上工具可用搜索、筛选、排序或更多操作的图标按钮。

PRD 决定列和行操作。长文本必须截断或折叠，不能撑高整行，也不能破坏表格列对齐。

## 5. 视觉品质基线

本风格的品质下限不是“有卡片、有图表、有表格”，而是每个模块都带有清晰的微观设计信号。

- PRD 包含多个核心摘要时，必须优先落地深色全宽指标舞台。没有这个舞台，风格识别度会明显下降。
- PRD 包含 3 个以上摘要项时，指标卡应使用玻璃态卡组：等高、等宽、图标容器、细边框、数值强层级。
- PRD 包含时间、频率、分布或密度数据时，优先使用浅色热力网格面板。若数据不适合热力图，可改成同等精度的轻网格趋势图或分布图。
- PRD 包含比例、目标、构成或分组对比时，优先使用纹理化对比图面板。斜纹、悬浮标签和圆角条是品质信号，不要退化为裸柱状图。
- PRD 包含可搜索记录时，使用宽松明细表与图标化首列。没有记录类内容时，可用同等精致度的列表、事件流或资源网格替代。

## 6. 布局规则

推荐桌面结构为 `page_identity + global_actions`、`primary_summary`、`paired_analysis_panels`、`detail_table`。这些是视觉槽位，不是业务模块清单；PRD 没有的模块不要强行补。

页面外层使用浅暖背景，桌面端左右内边距约 32px，纵向区块间距约 24px。首屏标题区与摘要舞台之间要留出明显呼吸感，舞台下方的分析区保持紧凑。

卡片密集区域必须使用稳定网格：主 grid 设置 `align-items: stretch`，同一行面板等高，面板设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。

长内容只能在面板内部滚动、截断或折叠。不要让图表、表格、标签、按钮或动态文本撑破父容器。

舞台内指标卡在桌面端优先一行 3-6 个；空间不足时换成 2 列或横向滚动。分析面板在桌面端可用 `2fr 1.15fr`，中屏变成单列堆叠，移动端所有模块单列。

## 7. PRD 槽位映射

| PRD 内容类型 | 推荐视觉槽位 | 规则 |
| --- | --- | --- |
| 页面身份、周期范围、全局入口 | `page_identity`、`global_actions` | 大标题左置，操作右置；只渲染 PRD 明确需要的工具。 |
| 核心摘要、关键数字、状态总览 | `primary_summary` | 放入深色指标舞台；3-6 项最佳，少于 3 项时可扩大单卡宽度。 |
| 时间、频率、分布、密度 | `primary_content_panel` | 优先热力网格、轻网格趋势或密度分布；固定图表高度。 |
| 目标、比例、构成、对比 | `supporting_panel` | 使用纹理化条形、圆角块、悬浮标签、图例点。 |
| 可搜索记录、任务、资源、事件 | `detail_table` 或 `detail_list` | 大圆角白底容器，行高稳定，首列图标化，长内容截断。 |
| 常用入口、快速发起、批量操作 | `quick_actions` | 仅 PRD 需要时渲染，作为独立区块，不塞进表格工具栏。 |

## 8. 组件规则

卡片和面板：外层面板使用 28-30px 大圆角、白底、极轻阴影和浅边框。深色舞台内的指标卡使用半透明暗面和亮边，不使用纯黑硬边框。

指标和摘要：标签字号小于数值，数值不使用负字距。图标容器固定尺寸，图标线宽统一，卡片内部上下间距稳定。

图表和主内容面板：图表容器必须有固定高度。热力格、柱条、占位块和图例尺寸固定，hover tooltip 使用白底、轻阴影、短文本，不遮挡关键数据。

表格和列表：表头文字弱化但清晰，行分隔线很浅。首列主副文本保持两行以内，右侧数值或状态对齐。搜索、筛选、排序等工具使用图标按钮，并提供 tooltip 或可访问标签。

输入和按钮：按钮高度可大于普通后台控件，桌面端全局操作约 64px。主要按钮可用深色或主题色，小图标按钮保持白底或浅底。禁用、加载、hover、focus、selected 状态都要完整。

快捷入口：若 PRD 需要，使用独立网格区块。每个入口固定高度、图标容器、短标题和可选副文案；不要让入口卡片高度随文案漂移。

## 9. 响应式与可访问性

桌面端以 1200px 以上为完整形态：顶部标题与操作同排，舞台内指标横排，分析区双列。768-1199px 可保留标题操作同排，但分析区改为单列，指标卡 2-3 列。小于 768px 时全部单列，顶部操作允许换行或横向滚动。

触控目标不小于 44px。纯图标按钮必须提供 `aria-label` 或 tooltip。focus ring 使用 `focus-ring` token，不能只靠颜色变化表达可聚焦状态。

图表状态不能只用颜色区分，至少结合纹理、标签、形状、深浅或图例文本。动态图表和光晕动效应支持 `prefers-reduced-motion`，减少或关闭非必要动画。

移动端表格可转为卡片列表或保留横向滚动，但表头、列宽和操作入口必须稳定，不允许内容互相遮挡。

## 10. 禁止项

- 禁止复制具体业务内容、示例数据、人名、机构名、字段名和页面专属文案。
- 禁止让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景、指标卡主体、白色面板或表格区域。
- 禁止把当前默认强调色误当成视觉 DNA。
- 禁止退化成默认后台质感：普通白卡、裸表格、裸柱状图、没有微纹理的图表。
- 禁止瀑布流、自由高度卡片、无固定高度图表容器和零散 margin 拼接。
- 禁止按钮、标签、tooltip、表格文本互相遮挡或撑破父级。
- 禁止在深色舞台里使用低对比灰字；所有反色文字必须满足可读性。

## 11. Agent 使用提示

先读 PRD，确认真实内容和模块；再读取输入主题色并改写强调色 token；最后套用本视觉 DNA。

不要硬套槽位，不要凭空创造指标、图表、表格或快捷入口。PRD 没有的模块可以缺席，但已出现的模块必须达到本文的品质锚点。

保留浅暖画布、深色指标舞台、玻璃指标卡、白底分析面板、细颗粒图表纹理、大圆角明细表和稳定等高网格。主题色只改色相，不改变这些机制。

实现后检查桌面和移动端：指标卡是否等高，图表容器是否固定，表格行是否稳定，长文本是否截断，图标按钮是否有可访问标签，视觉是否避免默认后台感。

## 12. 交付自检清单

- [ ] 页面内容、字段、数据、操作都来自 PRD 或产品上下文。
- [ ] 深色指标舞台在 PRD 有摘要内容时被保留，并且没有被主题色大面积污染。
- [ ] 指标卡具备半透明暗面、细边框、图标容器和强数值层级。
- [ ] 图表或主内容面板有固定高度，包含热力格、图例、纹理、tooltip 或等价微观细节。
- [ ] 分析面板同一行等高，父级使用 `gap`，没有零散 margin 拼接。
- [ ] 表格或列表行高稳定，长文本截断，首列有清晰扫描锚点。
- [ ] hover、focus、selected、loading、empty、error、disabled 状态完整。
- [ ] 移动端没有文本、按钮、tooltip、图表和表格互相遮挡。
- [ ] 主题色只替换强调色、图表阶梯、状态辅助色和 focus ring。
- [ ] 最终 UI 没有默认后台感，具备可见的精致微细节。
