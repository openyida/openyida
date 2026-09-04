---
version: alpha
template_type: visual_dna_preset
name: green-timeline-progress-workbench
design_id: green-timeline-progress-workbench
design_status: draft
description: "适用于主进度摘要、浮动时间轴、趋势图和明细表结合的绿色柔和进度工作台视觉 DNA。"
scenes: [dashboard, workbench, progress_tracking, staged_operations, operations_overview]
density: medium-high
layout: left_metric_stack_right_timeline_trend_table
tone: [soft, analytical, fresh, precise, operational]
tags: [green_dashboard, progress_summary, timeline_cards, trend_chart, detail_table]
avoid: [marketing_landing_page, single_form, media_story_page, dark_big_screen]
selection:
  best_for: [进度追踪页, 周期任务看板, 运营概览页, 阶段管理页, 明细记录页]
  user_intent: [判断完成进度, 查看当前节点, 对比趋势, 检索明细记录]
  visual_tone: [浅灰画布, 绿色主摘要, 白色指标卡, 浮动时间轴, 精致趋势图]
  avoid_for: [无时间或阶段语义的普通后台, 纯表单, 图片优先页面, 低信息展示页]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: green_priority_summary_stack
    name: 绿色优先摘要栈
    confidence: observed
    hooks: [primary_summary_card, progress_arc_texture, metric_grid, icon_badge, large_number]
    invariant: [左侧窄列顶部使用大面积强调色摘要卡, 摘要卡内有超大数字和低透明进度纹理, 下方 2x2 指标卡白底轻边框, 指标数字层级清晰]
    variable: [摘要语义, 指标数量, 图标语义, 数值格式, 强调色]
  - id: floating_date_timeline
    name: 浮动日期时间轴
    confidence: observed
    hooks: [date_strip, active_date_pill, dotted_vertical_axis, node_card, selected_node]
    invariant: [右上大面板顶部为日期条, 当前项用小胶囊高亮, 内容区有浅色描边容器, 垂直虚线贯穿当前列, 节点卡错落但网格对齐]
    variable: [时间粒度, 节点数量, 节点标题, 附加信息, 图标或头像, 操作]
  - id: polished_line_trend_panel
    name: 精致折线趋势面板
    confidence: observed
    hooks: [line_chart, hollow_points, dotted_secondary_line, dark_tooltip, range_pill]
    invariant: [趋势面板白底大圆角, 标题栏和筛选胶囊同层, 主折线使用强调色和空心节点, 辅助序列浅灰虚线, tooltip 为深色浮层]
    variable: [趋势指标, 时间范围, 序列数量, tooltip 内容, 主题色]
  - id: full_width_detail_table
    name: 全宽明细表
    confidence: observed
    hooks: [table_panel, search_input, sortable_header, checkbox_column, status_pill]
    invariant: [底部明细表横跨页面宽度, 标题与搜索框同层, 表头浅灰底, 首列复选框, 列标题带排序图标, 状态使用胶囊和点状信号]
    variable: [列定义, 行数据, 搜索筛选, 状态集合, 单元格图标]
  - id: low_noise_green_texture
    name: 低噪声绿色纹理
    confidence: observed
    hooks: [subtle_pattern, soft_border, micro_shadow, accent_rail, status_dot]
    invariant: [强调色集中在摘要卡、选中节点、折线和状态点, 其他区域保持白底和浅边框, 通过纹理、短竖条和点位增加精致度]
    variable: [纹理类型, 状态语义, 色相, 图标库, 文案长度]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-primary, tokens.colors.chart-soft, tokens.colors.timeline-active, tokens.colors.status-positive, tokens.colors.surface-accent]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.colors.shadow-color]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - preserve_white_panels_and_soft_borders
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
    chart-primary: "#20B875"
    chart-soft: "#DDF5EA"
    chart-secondary: "#CBD5D1"
    status-positive: "#22B879"
    status-warning: "#F0A92E"
    status-danger: "#E35D5D"
    focus-ring: "#8BE0B8"
    shadow-color: "rgba(17, 24, 39, 0.06)"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0 }
    panel-title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0 }
    hero-number: { fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: 0 }
    metric-number: { fontSize: 44, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0 }
    body: { fontSize: 15, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 24
    page-y-desktop: 32
    grid-gap: 16
    panel-x: 24
    panel-y: 22
    table-cell-x: 20
  rounded:
    panel: 20
    summary: 20
    card: 16
    control: 14
    pill: 999
  shadow:
    panel: "0 1px 2px rgba(17,24,39,0.04), 0 12px 28px rgba(17,24,39,0.04)"
    floating: "0 10px 24px rgba(17,24,39,0.08)"
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
  - id: textured_summary_card
    name: 纹理化主摘要卡
    required_when: PRD 提供最高优先级进度、状态或总览
    rule: 摘要卡使用强调色底、超大数字、低透明纹理和局部进度弧。
  - id: aligned_timeline_nodes
    name: 对齐的时间轴节点
    required_when: PRD 包含时间、阶段、流程或里程碑
    rule: 日期条、当前胶囊、垂直虚线、节点卡和选中态共同出现。
  - id: dark_chart_tooltip
    name: 深色图表浮层
    required_when: PRD 包含趋势或周期对比
    rule: 折线图有空心节点、辅助虚线、垂直辅助线和深色 tooltip。
  - id: sortable_table_shell
    name: 可排序表格壳
    required_when: PRD 包含明细记录
    rule: 表格有搜索框、浅灰表头、排序图标、复选框、状态胶囊和稳定行高。
  - id: accent_micro_signals
    name: 小面积强调信号
    required_when: PRD 包含状态、节点或列表
    rule: 通过短竖条、点状状态、胶囊和 focus ring 表达，不大面积染色。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [textured_summary, aligned_timeline, hollow_chart_points, dark_tooltip, sortable_table, status_pills]
components:
  panel: { surface: tokens.colors.surface, rounded: tokens.rounded.panel, border: "1px solid tokens.colors.border-subtle", shadow: tokens.shadow.panel }
  summary_card: { surface: tokens.colors.brand, rounded: tokens.rounded.summary, texture: progress_arc_pattern, text: "#FFFFFF" }
  metric_card: { minHeight: 168, icon: circular_subtle_outline }
  timeline_node: { height: 76, rounded: tokens.rounded.card, selectedSurface: tokens.colors.brand, activeRail: tokens.colors.timeline-active }
  chart: { height: 230, lineStyle: smooth_with_hollow_points, tooltip: dark_compact_card }
  table: { rowHeight: 64, headerHeight: 56, headerSurface: tokens.colors.surface-muted, statusStyle: pill_with_dot }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_after_summary_or_before_detail
    item_count: 4-8
  timeline:
    confidence: observed
    render_policy: prd_only
    placement: upper_right_primary_panel
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: full_width_bottom_panel
---

# Green Timeline Progress Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一个绿色柔和的进度分析工作台。它用左侧主摘要和指标栈建立状态判断，用右侧浮动时间轴呈现阶段或节点，用趋势图和底部明细表完成分析与检索。PRD 决定内容是否存在，DESIGN.md 只约束视觉 DNA。主题色只替换绿色强调，不改变白色面板、浅边框、时间轴和图表工艺。

## 2. 使用边界

适合进度追踪、阶段管理、周期任务、运营概览和记录管理。不适合没有时间或阶段语义的普通后台、纯表单、媒体页或暗色大屏。禁止复制视觉材料中的具体业务词、记录名、日期、数值、路线、对象名和表格字段。

## 3. 设计风格选择与换色逻辑

当 PRD 包含主进度、多个辅助指标、节点或日程、趋势分析和明细记录时选择该风格。主题色替换摘要卡、选中节点、主折线和状态点；背景、白色卡片、浅灰表头、中性文字和圆角机制保持。

## 4. 视觉 DNA

`green_priority_summary_stack` 保持左侧主摘要和 2x2 指标。`floating_date_timeline` 保持日期条、垂直当前线和错落节点。`polished_line_trend_panel` 保持空心节点、辅助虚线和深色 tooltip。`full_width_detail_table` 保持全宽表格壳、搜索、排序和状态胶囊。`low_noise_green_texture` 控制强调色只小面积出现。

## 5. 视觉品质基线

主摘要需要纹理和大数字。时间轴需要日期条、当前胶囊、虚线和节点卡。趋势图需要空心点、深色 tooltip 和浅网格。表格需要搜索、排序、复选框、状态胶囊。强调色必须集中，不能染满页面。

## 6. 布局规则

```text
page_shell
  page_identity
  main_grid
    left_metric_stack
    right_timeline_and_trend
  full_width_detail_table
```

主 grid `align-items: stretch`，同排面板等高。面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`。图表、时间轴、表格行固定高度。长文本截断或内部滚动。间距用父级 `gap`。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 规则 |
| --- | --- | --- |
| 主进度或总览状态 | `primary_summary` | 强调色摘要卡加纹理。 |
| 辅助指标 | `metric_grid` | 白底 2x2 指标卡。 |
| 阶段、节点、日程 | `timeline` | 日期条加错落节点。 |
| 趋势或周期对比 | `trend_panel` | 折线图加深色 tooltip。 |
| 明细记录 | `detail_table` | 全宽表格壳。 |

## 8. 组件规则

摘要卡圆角 20px，白字，大数字 64px。指标卡白底轻边框。节点卡高度 76px，选中态强调色。图表高度 230px，主线 3px，空心节点。表格表头 56px，行高 64px，状态胶囊加点。

## 9. 响应式与可访问性

桌面左右布局，移动端按摘要、指标、时间轴、趋势、明细排列。表格可横向滚动或转卡片。触控目标不小于 44px。状态不能只靠颜色，需文本或图形辅助。

## 10. 禁止项

- 禁止复制具体业务内容、字段、日期、数值和示例对象。
- 禁止主题色污染背景和普通卡片。
- 禁止默认折线图、裸表格、自由高度时间轴。
- 禁止瀑布流和零散 margin。
- 禁止 PRD 无时间语义时强行创建时间轴。

## 11. Agent 使用提示

先读 PRD，判断主进度、指标、时间节点、趋势和明细是否存在。再用主题色替换绿色强调。不要凭空创建模块。实现时必须保留纹理摘要、对齐时间轴、精制折线和工具化表格。

## 12. 交付自检清单

- 内容是否来自 PRD。
- 适用 DNA 是否保留。
- 主题色是否只改写小面积强调。
- 时间轴、图表、表格是否稳定。
- 状态、响应式和可访问性是否完整。
