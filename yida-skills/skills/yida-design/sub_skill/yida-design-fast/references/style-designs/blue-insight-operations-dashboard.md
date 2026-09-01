---
version: alpha
template_type: visual_dna_preset
name: blue-insight-operations-dashboard
design_id: blue-insight-operations-dashboard
design_status: draft
description: "适用于顶部指标、主趋势图、右侧洞察卡、活动表和团队列表的蓝色运营分析仪表盘视觉 DNA。"
scenes: [dashboard, analytics_home, operations_overview, executive_summary, team_overview]
density: medium-high
layout: metric_row_chart_insight_table_side_list
tone: [clean, confident, structured, crisp, analytical]
tags: [blue_dashboard, sparkline_metrics, area_chart, insight_cards, activity_table]
avoid: [media_gallery, marketing_landing_page, single_form, immersive_dark_screen]
selection:
  best_for: [运营概览页, 管理看板, 指标分析页, 团队概览页, 活动追踪页]
  user_intent: [查看核心指标, 分析主趋势, 阅读洞察提醒, 跟进近期活动, 对比成员或对象状态]
  visual_tone: [浅灰背景, 白色圆角卡片, 蓝色主图表, 彩色洞察卡片, 清晰表格]
  avoid_for: [强图片展示, 低信息门户, 纯录入流程, 暗色大屏]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: sparkline_metric_cards
    name: 火花线指标卡组
    confidence: observed
    hooks: [metric_card, pastel_icon_square, large_number, delta_text, sparkline]
    invariant: [顶部四张指标卡等宽横排, 左上为浅色图标方块, 中部大数字, 下方变化文本, 右下角有彩色火花线]
    variable: [指标数量, 图标语义, 数值格式, 变化方向, 火花线颜色]
  - id: primary_area_trend_panel
    name: 主面积趋势面板
    confidence: observed
    hooks: [area_chart, smooth_line, tooltip_card, vertical_marker, range_select]
    invariant: [左侧主面板占据最大面积, 标题区显示主数值和变化, 折线使用蓝色实线与浅色面积填充, hover 有垂直虚线和白色 tooltip]
    variable: [指标类型, 时间范围, 数据单位, tooltip 内容, 主题色]
  - id: pastel_insight_stack
    name: 彩色洞察卡堆叠
    confidence: observed
    hooks: [insight_rail, pastel_card, icon_tile, chevron, soft_tint_background]
    invariant: [右侧洞察面板内有 3 个左右浅色提示卡, 每张卡有图标方块、标题、两行摘要和右箭头, 色彩低饱和且不污染外层面板]
    variable: [洞察数量, 图标语义, 状态级别, 文案长度, 主题色派生]
  - id: activity_table_panel
    name: 活动明细表面板
    confidence: observed
    hooks: [activity_table, avatar_cell, action_icon, status_pill, row_menu]
    invariant: [底部左侧使用记录表, 行内头像或对象标识、动作图标、时间和状态胶囊齐全, 表格分隔线细且行高稳定]
    variable: [列定义, 行数据, 状态集合, 行操作, 图标语义]
  - id: compact_progress_side_list
    name: 紧凑进度侧列表
    confidence: observed
    hooks: [side_list, avatar, progress_bar, percentage_text, view_all_link]
    invariant: [右下侧列表在卡片内纵向排列, 每行头像/图标、两行文本、右侧进度条和百分比, 标题栏有查看入口]
    variable: [列表对象, 进度含义, 行数, 排序方式, 头像或图标]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-primary, tokens.colors.chart-fill, tokens.colors.insight-positive, tokens.colors.insight-warning, tokens.colors.insight-info]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle]
  rules:
    - theme_color_only_changes_accent_hue
    - preserve_light_gray_canvas
    - keep_insight_cards_pastel
    - do_not_tint_all_metric_cards
tokens:
  colors:
    bg-page: "#F3F6FA"
    surface: "#FFFFFF"
    surface-muted: "#F7F9FC"
    text-primary: "#0F172A"
    text-secondary: "#64748B"
    text-tertiary: "#94A3B8"
    border-subtle: "#E1E7F0"
    brand: "#2169D9"
    brand-strong: "#1756B8"
    brand-soft: "#E8F1FF"
    chart-primary: "#2169D9"
    chart-fill: "rgba(33,105,217,0.14)"
    insight-positive: "#EAF8EE"
    insight-info: "#F5EDFF"
    insight-warning: "#FFF8E6"
    positive: "#18A957"
    focus-ring: "#8CB8F5"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 34, fontWeight: 750, lineHeight: 1.15, letterSpacing: 0 }
    panel-title: { fontSize: 22, fontWeight: 750, lineHeight: 1.25, letterSpacing: 0 }
    metric-number: { fontSize: 32, fontWeight: 800, lineHeight: 1.05, letterSpacing: 0 }
    hero-number: { fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 450, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 14, fontWeight: 450, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 40
    page-y-desktop: 34
    grid-gap: 28
    panel-x: 28
    panel-y: 28
  rounded:
    panel: 12
    card: 12
    control: 8
    pill: 999
  shadow:
    panel: "0 1px 2px rgba(15,23,42,0.04)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    metric_card: 190px
    chart_panel: 560px
    insight_panel: 560px
    activity_panel: 420px
    side_list_panel: 420px
    table_row: 76px
quality_anchors:
  - id: metric_sparkline_finish
    name: 火花线指标完成度
    required_when: PRD 包含多个核心指标
    rule: 每张指标卡都需要图标方块、大数字、变化文本和右下火花线。
  - id: chart_tooltip_marker
    name: 趋势图浮层与垂直标记
    required_when: PRD 包含主趋势或周期对比
    rule: 主图表使用平滑折线、面积填充、点位、垂直虚线和白色 tooltip。
  - id: pastel_insight_cards
    name: 彩色洞察卡
    required_when: PRD 包含建议、提醒、风险、机会或洞察摘要
    rule: 洞察卡使用低饱和背景、图标方块、右箭头和两行摘要，色块不能过重。
  - id: activity_status_table
    name: 活动状态表格
    required_when: PRD 包含活动记录或操作历史
    rule: 表格行含头像/图标、动作、时间、状态胶囊和更多操作。
  - id: progress_side_list
    name: 进度侧列表
    required_when: PRD 包含成员、对象或项目进度
    rule: 每行有头像/图标、标题、副标题、进度条和百分比。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [sparkline_cards, area_chart_tooltip, pastel_insight_stack, status_pills, progress_bars, subtle_borders]
components:
  panel: { surface: tokens.colors.surface, rounded: tokens.rounded.panel, border: "1px solid tokens.colors.border-subtle", shadow: tokens.shadow.panel }
  metric_card: { minHeight: 190, iconShape: pastel_square, sparkline: true }
  chart: { height: 390, lineStyle: smooth, tooltip: white_card_with_marker }
  insight_card: { height: 130, rounded: tokens.rounded.card, iconTile: true, chevron: true }
  table: { rowHeight: 76, headerHeight: 58, statusStyle: pill }
  progress_bar: { height: 8, rounded: tokens.rounded.pill }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: page_header_or_after_metric_row
    item_count: 2-6
  insight_panel:
    confidence: observed
    render_policy: prd_only
    placement: right_of_primary_chart
  activity_table:
    confidence: observed
    render_policy: prd_only
    placement: lower_left
---

# Blue Insight Operations Dashboard DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一个经典、清晰、蓝色主导的运营分析仪表盘视觉 DNA。它由顶部火花线指标卡、主面积趋势图、右侧彩色洞察卡、底部活动表和进度侧列表组成。PRD 管业务内容，DESIGN.md 管视觉机制。主题色可以替换蓝色主图表和强调控件，但不能改变浅灰画布、白色卡片和彩色洞察堆叠。

## 2. 使用边界

适用于运营概览、管理看板、团队状态、活动追踪和指标分析。不适合单一表单、强媒体页面、暗色大屏或低信息门户。禁止复制任何视觉材料中的业务标题、人名、职位、项目、日期、金额、百分比和洞察文案。

## 3. 设计风格选择与换色逻辑

当 PRD 有多个 KPI、一个主趋势、若干洞察提醒、活动记录和进度列表时选择该风格。主题色只替换主图表、火花线、链接、focus ring 和部分图标底；背景、卡片、表格分隔线、低饱和洞察卡结构保持。

## 4. 视觉 DNA

`sparkline_metric_cards` 让指标卡既可扫读又有趋势细节。`primary_area_trend_panel` 是主视觉，需要面积填充和 tooltip。`pastel_insight_stack` 用柔和彩色卡表达提醒和建议。`activity_table_panel` 用表格承载近期记录。`compact_progress_side_list` 用头像或图标加进度条表达对象状态。

## 5. 视觉品质基线

指标卡必须有火花线，不能只是数字。主趋势图必须有渐变面积、垂直标记和 tooltip。洞察卡必须有低饱和背景、图标方块和右箭头。活动表要有状态胶囊和行操作。进度列表要有头像/图标、进度条和百分比。

## 6. 布局规则

```text
page_shell
  page_identity + date_filter
  metric_row
  main_grid: primary_chart + insight_stack
  lower_grid: activity_table + progress_side_list
```

主 grid 使用 `align-items: stretch`。同排面板等高。面板 `height: 100%`、`min-width: 0`、`min-height: 0`。图表和表格固定高度，长内容截断，间距由父级 `gap` 控制。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 规则 |
| --- | --- | --- |
| 多个核心指标 | `metric_row` | 等宽卡片加火花线。 |
| 主趋势或周期对比 | `primary_area_trend_panel` | 面积图加 tooltip。 |
| 洞察、提醒、风险、机会 | `insight_panel` | 彩色低饱和卡片堆叠。 |
| 活动或记录 | `activity_table` | 头像/图标、动作、时间、状态。 |
| 对象进度 | `progress_side_list` | 进度条和百分比。 |

## 8. 组件规则

卡片圆角 12px，细边框。指标卡图标方块 48px，火花线放右下。主图表线宽 3px，面积透明度 12-18%。洞察卡背景低饱和，行高稳定。状态胶囊使用浅底。进度条高度 8px。

## 9. 响应式与可访问性

桌面为两列主内容；中宽下右侧面板下移；移动端按指标、图表、洞察、活动、进度排列。图表 tooltip 在触控端可点击固定。状态不能只用颜色。

## 10. 禁止项

- 禁止复制具体业务内容、人物、项目和示例数据。
- 禁止默认图表、裸表格、无火花线指标卡。
- 禁止主题色污染洞察卡和背景。
- 禁止卡片自由高度造成错位。
- 禁止长内容撑破面板。

## 11. Agent 使用提示

先读 PRD，确认 KPI、趋势、洞察、活动和进度列表是否存在。再按主题色替换蓝色强调。实现时必须保留火花线、面积图 tooltip、洞察卡堆叠、状态表和进度侧列表。

## 12. 交付自检清单

- 内容是否全部来自 PRD。
- 视觉 DNA 是否按 PRD 条件落地。
- 主题色是否只改强调色。
- 图表、表格、列表是否有完整微细节。
- 响应式、键盘焦点和状态可访问性是否达标。
