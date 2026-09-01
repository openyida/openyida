---
version: alpha
template_type: visual_dna_preset
name: blue-productivity-insight-workbench
design_id: blue-productivity-insight-workbench
design_status: draft
description: "适用于指标概览、柱状趋势、右侧行动栏和记录表并重的蓝色生产力工作台视觉 DNA。"
scenes: [dashboard, workbench, productivity_home, operations_overview, task_center]
density: medium-high
layout: metric_row_large_chart_right_rail_table
tone: [clean, focused, professional, bordered, calm]
tags: [blue_dashboard, metric_cards, bar_chart, right_rail, action_table]
avoid: [marketing_landing_page, immersive_media_page, dark_big_screen, freeform_canvas]
selection:
  best_for: [生产力工作台, 任务概览页, 周期分析页, 行动中心, 记录管理页]
  user_intent: [查看周期成果, 识别待处理事项, 跟进今日任务, 检索记录列表]
  visual_tone: [白底浅灰画布, 细边框卡片, 蓝色主操作, 右侧纵向洞察栏, 克制高效]
  avoid_for: [强视觉营销, 图片优先页面, 单一长表单, 没有行动队列的低信息页]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: command_filter_header
    name: 命令与筛选头部
    confidence: observed
    hooks: [primary_button, secondary_button, date_range_control, sort_filter_buttons, page_identity]
    invariant: [顶部左侧为页面身份和辅助说明, 中部或右侧承载主次操作, 日期范围与排序筛选在同一水平线, 控件都使用细边框圆角]
    variable: [标题文案, 操作数量, 筛选维度, 日期语义, 主题色]
  - id: bordered_metric_row
    name: 细边框指标横排
    confidence: observed
    hooks: [metric_card, large_number, split_caption, positive_delta, equal_width_grid]
    invariant: [四个左右等宽指标卡横排, 卡片白底细边框, 数字大且紧凑, 辅助文本分两段或一段, 正向变化用小面积绿色文本]
    variable: [指标数量, 指标名称, 数值格式, 变化语义, 卡片数量]
  - id: large_bar_analytics_panel
    name: 大幅柱状分析面板
    confidence: observed
    hooks: [bar_chart, dashed_threshold, metric_strip, insight_callout, panel_actions]
    invariant: [主图表面板占左侧最大面积, 顶部有面板标题和操作图标, 图表上方有摘要条和浅色洞察块, 柱状图使用圆角竖条和虚线阈值]
    variable: [图表类型, 时间粒度, 阈值数量, 洞察文案, 统计项]
  - id: stacked_action_rail
    name: 右侧堆叠行动栏
    confidence: observed
    hooks: [side_rail, focus_card, tabbed_panel, summary_card, avatar_stack, small_pills]
    invariant: [右侧窄栏由多个等宽卡片纵向堆叠, 每个卡片内部有标题栏和右箭头或分页, 重点卡使用内嵌白卡和胶囊状态]
    variable: [行动类型, 卡片数量, 状态集合, 参与者或对象展示, 标签页]
  - id: utility_record_table
    name: 工具化记录表
    confidence: observed
    hooks: [checkbox_table, filter_button, search_icon, row_actions, platform_or_type_chip]
    invariant: [底部表格横跨左主栏, 表头轻量, 行高稳定, 首列复选框, 右上角有筛选搜索更多和跳转图标]
    variable: [列定义, 行数据, 行操作, 图标语义, 搜索筛选]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-primary, tokens.colors.chart-threshold, tokens.colors.status-info, tokens.colors.insight-soft]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - preserve_thin_bordered_cards
    - keep_primary_action_prominent_but_small_area
tokens:
  colors:
    bg-page: "#F7F8FA"
    surface: "#FFFFFF"
    surface-muted: "#F7F9FC"
    text-primary: "#0F172A"
    text-secondary: "#4B5563"
    text-tertiary: "#8B95A1"
    border-subtle: "#D9DEE7"
    brand: "#2367C9"
    brand-strong: "#1C55AA"
    brand-soft: "#EAF2FF"
    chart-primary: "#2D6CCB"
    chart-threshold: "#2D6CCB"
    insight-soft: "#F5FAFF"
    positive: "#159447"
    warning: "#D97706"
    danger: "#D85C67"
    focus-ring: "#8EB8F2"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 28, fontWeight: 750, lineHeight: 1.2, letterSpacing: 0 }
    panel-title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0 }
    metric-number: { fontSize: 40, fontWeight: 750, lineHeight: 1.05, letterSpacing: 0 }
    body: { fontSize: 15, fontWeight: 450, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 13, fontWeight: 450, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 32
    page-y-desktop: 28
    grid-gap: 24
    panel-x: 28
    panel-y: 24
  rounded:
    panel: 16
    card: 14
    control: 10
    pill: 999
  shadow:
    panel: "0 1px 2px rgba(15,23,42,0.03)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    metric_card: 160px
    chart_panel: 560px
    side_card_large: 310px
    side_card_small: 250px
    table_row: 58px
quality_anchors:
  - id: action_filter_header
    name: 操作筛选头部
    required_when: PRD 包含创建、开始、调度、排序或筛选
    rule: 主次操作、日期范围、排序筛选要在同一视觉系统内，按钮边框和圆角一致。
  - id: bordered_metric_cards
    name: 细边框指标卡组
    required_when: PRD 提供多个核心指标
    rule: 指标卡横向等宽，数字、变化和补充文本层级清晰，不使用厚重阴影。
  - id: threshold_bar_chart
    name: 阈值柱状图
    required_when: PRD 包含周期分布、频次、容量或用量数据
    rule: 柱状图使用圆角竖条、虚线阈值、左侧标签和上方摘要条。
  - id: stacked_right_rail
    name: 堆叠右侧行动栏
    required_when: PRD 包含今日焦点、下一步、摘要或提醒
    rule: 右侧卡片等宽纵向堆叠，标题栏、箭头、胶囊和头像细节完整。
  - id: table_toolbar_finish
    name: 表格工具栏完成度
    required_when: PRD 包含可检索记录
    rule: 表格标题右侧必须有筛选、搜索、更多或跳转等工具，行内状态和操作齐全。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [thin_borders, primary_secondary_actions, rounded_bar_chart, right_rail_cards, table_toolbar, avatar_pills]
components:
  panel: { surface: tokens.colors.surface, rounded: tokens.rounded.panel, border: "1px solid tokens.colors.border-subtle", shadow: tokens.shadow.panel }
  metric_card: { minHeight: 160, rounded: tokens.rounded.panel, border: "1px solid tokens.colors.border-subtle" }
  button_primary: { height: 44, rounded: tokens.rounded.control, surface: tokens.colors.brand, text: "#FFFFFF" }
  button_secondary: { height: 44, rounded: tokens.rounded.control, border: "1px solid tokens.colors.brand" }
  chart: { height: 330, barRadius: 999, thresholdStyle: dashed }
  table: { rowHeight: 58, headerHeight: 54, checkboxColumn: true }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: top_command_bar_or_independent_section
    item_count: 2-6
  right_rail:
    confidence: observed
    render_policy: prd_only
    placement: persistent_right_column
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: lower_main_column
---

# Blue Productivity Insight Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 是白底、细边框、蓝色主操作的生产力工作台。核心结构是顶部命令筛选、横排指标卡、大幅柱状分析面板、右侧堆叠行动栏和底部记录表。PRD 决定具体内容，DESIGN.md 决定视觉层级和组件工艺。主题色只替换主操作、图表和 focus ring，不改变细边框和右侧栏机制。

## 2. 使用边界

适合任务中心、周期分析、行动跟进、团队或项目概览等中高密工作台。不适合营销页、图片页面、沉浸大屏、纯表单。不得复制视觉材料中的个人名、专属活动名、工具品牌、具体日期、时间、数量或文案。没有行动队列时，不要强行渲染右侧栏。

## 3. 设计风格选择与换色逻辑

当 PRD 同时包含核心指标、周期图表、右侧焦点卡和记录列表时选择该风格。主题色替换 `brand`、图表柱、按钮和 focus ring；背景、白色面板、浅灰边框、表格分隔线和右栏堆叠结构保持。

## 4. 视觉 DNA

`command_filter_header` 负责把页面身份、主次操作和筛选控制组织在一行。`bordered_metric_row` 用等宽指标卡建立扫读入口。`large_bar_analytics_panel` 是主分析区域，柱状图必须有圆角条、阈值线和摘要条。`stacked_action_rail` 是右侧持续上下文，承载焦点、下一步和摘要。`utility_record_table` 是记录落地层，必须有工具栏和稳定行高。

## 5. 视觉品质基线

头部操作要呈现主次关系；指标卡要靠细边框和数字层级，而不是厚阴影；柱状图不能使用默认样式，需有圆角、阈值和轻网格；右侧栏卡片要有分页、箭头、胶囊、头像或状态细节；表格必须有筛选搜索和行操作。

## 6. 布局规则

```text
page_shell
  command_filter_header
  metric_row
  main_grid
    chart_and_table_column
    stacked_right_rail
```

主 grid 使用 `align-items: stretch`。左主栏和右栏同高策略由父级控制。面板 `height: 100%`、`min-width: 0`、`min-height: 0`。柱状图固定高度，右栏内部可滚动，表格行固定高度，间距只用父级 `gap`。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 规则 |
| --- | --- | --- |
| 全局操作和筛选 | `command_filter_header` | 主次按钮、日期、筛选排序同层。 |
| 核心指标 | `metric_row` | 细边框等宽卡片，不强造数字。 |
| 周期分布或容量数据 | `large_chart_panel` | 优先圆角柱状图；无数据时用同等品质主内容面板。 |
| 今日焦点、下一步、提醒 | `right_rail` | 右侧堆叠卡片，由 PRD 决定数量。 |
| 记录列表 | `detail_table` | 表格工具栏、复选框、行操作齐全。 |

## 8. 组件规则

卡片圆角 14-16px，1px 边框，轻阴影或无阴影。主按钮使用实底，次按钮白底描边。指标数字 36-42px。柱状图条宽稳定、端点全圆角，阈值线虚线。右栏卡片内嵌子卡可用浅蓝或白底。表格首列复选框，末列更多操作。

## 9. 响应式与可访问性

桌面端右栏固定在右侧；中等宽度右栏下移；移动端按头部、指标、图表、右栏卡片、表格顺序纵向。触控目标不小于 44px。图标按钮有标签。状态用颜色加文字或图标。

## 10. 禁止项

- 禁止复制具体业务、人物、专属活动、工具品牌、日期和示例数字。
- 禁止让主题色污染背景或所有卡片。
- 禁止默认柱状图、裸表格、无工具栏列表。
- 禁止自由高度右栏卡片和零散 margin。
- 禁止 PRD 没有行动队列时强加右栏。

## 11. Agent 使用提示

先读 PRD 判断是否存在指标、周期分析、行动栏和记录表。再按主题色替换蓝色强调。实现时必须保留细边框、圆角柱状图、右栏堆叠卡片和工具化表格。

## 12. 交付自检清单

- 内容是否来自 PRD。
- 指标、图表、右栏、表格是否按 PRD 条件落地。
- 主题色是否只改写强调色。
- 面板边框、稳定高度和父级 gap 是否正确。
- 组件状态、响应式、可访问性是否完整。
