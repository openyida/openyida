---
version: alpha
template_type: visual_dna_preset
name: contrast-command-analytics-workbench
design_id: contrast-command-analytics-workbench
design_status: draft
description: "适用于需要高对比命令面板、分段趋势图、日程列表和明细表协同呈现的分析工作台视觉 DNA。"
scenes: [dashboard, workbench, operations_overview, command_center, data_table_page]
density: medium-high
layout: large_greeting_two_column_mosaic_command_table
tone: [premium, airy, analytical, high_contrast, rounded]
tags: [light_dashboard, dark_command_panel, segmented_chart, schedule_list, data_table]
avoid: [marketing_landing_page, immersive_big_screen, single_long_form, text_heavy_portal]
selection:
  best_for: [工作台首页, 运营概览页, 资源管理页, 日程协同页, 明细管理页]
  user_intent: [快速查看表现, 处理待办或日程, 使用智能命令入口, 检索明细记录]
  visual_tone: [大字号问候, 浅灰画布, 白色大圆角面板, 黑色高对比命令区, 小面积彩色数据纹理]
  avoid_for: [强叙事落地页, 低信息展示页, 纯录入表单, 只需要单表格的后台]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: oversized_identity_bar
    name: 大号身份与胶囊操作栏
    confidence: observed
    hooks: [page_identity, pill_action, date_chip, primary_button, large_title]
    invariant: [页面顶部使用超大标题形成亲和入口, 右侧放置轻量日期胶囊和深色主操作胶囊, 顶部操作不放入卡片内, 首屏保持宽松留白]
    variable: [标题文案, 操作数量, 日期或筛选语义, 主操作图标, 主题色]
  - id: segmented_performance_panel
    name: 分段堆叠表现面板
    confidence: observed
    hooks: [segmented_bar_chart, stacked_blocks, legend_dots, metric_list, soft_chart_fill]
    invariant: [左侧主面板使用图表与指标列表并列, 图表由圆角分段块和浅色连接带构成, 图例点在底部对齐, 右侧指标列表以分隔线和浅色涨跌标签形成节奏]
    variable: [指标维度, 分段数量, 时间粒度, 图例数量, 默认强调色]
  - id: rounded_schedule_stream
    name: 圆角日程流
    confidence: observed
    hooks: [date_strip, schedule_row, icon_bubble, priority_flag, time_column]
    invariant: [右上面板顶部有水平日期条, 当前日期使用深色竖向胶囊, 列表项为浅灰圆角长条, 左侧图标圆泡独立于文本, 优先级和时间在行内右侧对齐]
    variable: [日期粒度, 列表数量, 图标语义, 优先级集合, 时间或状态文案]
  - id: dark_assistant_command_panel
    name: 深色命令面板
    confidence: observed
    hooks: [dark_panel, command_chip, media_or_illustration_slot, prompt_input, icon_action]
    invariant: [命令区使用近黑大圆角外壳, 内部嵌入白色内容面板, 快捷命令用带彩色图标的胶囊, 底部输入框为超大圆角并带发送按钮]
    variable: [快捷命令数量, 图标语义, 媒体或插画内容, 输入提示, 辅助操作]
  - id: refined_record_table
    name: 精细记录表格
    confidence: observed
    hooks: [table_shell, search_input, filter_icon, avatar_stack, status_dot, row_thumbnail]
    invariant: [底部明细面板横跨主区域, 标题与搜索工具同层, 表头轻量无厚背景, 行内支持缩略图或图标、叠放头像、数字和状态点, 行分隔线极细]
    variable: [列定义, 行数据, 搜索筛选, 状态集合, 单元格媒体类型]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.chart-primary, tokens.colors.chart-secondary, tokens.colors.chart-tertiary, tokens.colors.positive, tokens.colors.command-accent]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.colors.command-bg]
  rules:
    - theme_color_only_changes_accent_hue
    - preserve_dark_command_panel
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
tokens:
  colors:
    bg-page: "#F5F5F4"
    surface: "#FFFFFF"
    surface-muted: "#F2F2F1"
    text-primary: "#111111"
    text-secondary: "#5F6268"
    text-tertiary: "#9BA0A6"
    border-subtle: "#E6E6E3"
    command-bg: "#171716"
    command-surface: "#FFFFFF"
    brand: "#9B55D4"
    brand-strong: "#7E3CAA"
    brand-soft: "#EFE3FA"
    chart-primary: "#7E3CAA"
    chart-secondary: "#A965D5"
    chart-tertiary: "#C77AE8"
    positive: "#24B45A"
    warning: "#F2C94C"
    focus-ring: "#C99AF0"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 52, fontWeight: 500, lineHeight: 1.08, letterSpacing: 0 }
    panel-title: { fontSize: 24, fontWeight: 650, lineHeight: 1.25, letterSpacing: 0 }
    metric-number: { fontSize: 42, fontWeight: 600, lineHeight: 1.05, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 450, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 13, fontWeight: 450, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 28
    page-y-desktop: 28
    grid-gap: 18
    panel-x: 24
    panel-y: 24
    row-gap: 14
  rounded:
    panel: 20
    card: 18
    control: 999
    command: 24
    icon: 999
  shadow:
    panel: "0 1px 2px rgba(17,17,17,0.04), 0 14px 36px rgba(17,17,17,0.04)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    performance_panel: 560px
    schedule_panel: 560px
    command_panel: 520px
    table_panel: 520px
    schedule_row: 88px
    table_row: 86px
quality_anchors:
  - id: greeting_command_header
    name: 大标题与胶囊命令头
    required_when: PRD 需要工作台入口、全局操作或日期筛选
    rule: 顶部标题应足够大且不包卡片，右侧操作用胶囊按钮，主操作深色高对比。
  - id: segmented_chart_craft
    name: 分段堆叠图表工艺
    required_when: PRD 包含分组、阶段、构成或趋势对比
    rule: 图表使用圆角分段块、浅色连接带、顶部数值标签和底部图例点，不使用默认柱状图替代。
  - id: dark_command_surface
    name: 深色命令面板
    required_when: PRD 包含智能助手、快捷入口、命令输入或推荐操作
    rule: 深色外壳、白色内层、胶囊快捷命令和大圆角输入框必须共同出现。
  - id: schedule_row_rhythm
    name: 日程行节奏
    required_when: PRD 包含待办、日程、流程节点或事件队列
    rule: 每行有图标圆泡、浅灰长条、状态或优先级、右侧时间，行高稳定。
  - id: media_rich_table_rows
    name: 媒体化明细行
    required_when: PRD 包含记录列表、对象管理或人员协同信息
    rule: 行内可使用缩略图、叠放头像、状态点和搜索工具，表格不得退化为裸文本表。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [oversized_title, pill_actions, segmented_chart, dark_command_panel, rounded_schedule_rows, media_table_rows]
components:
  panel: { surface: tokens.colors.surface, rounded: tokens.rounded.panel, shadow: tokens.shadow.panel, border: "1px solid tokens.colors.border-subtle" }
  command_panel: { surface: tokens.colors.command-bg, rounded: tokens.rounded.command, innerSurface: tokens.colors.command-surface }
  button_primary: { height: 56, rounded: tokens.rounded.control, surface: tokens.colors.text-primary, text: "#FFFFFF" }
  input: { height: 58, rounded: tokens.rounded.control, border: "1px solid tokens.colors.border-subtle" }
  table: { rowHeight: 86, headerHeight: 54, statusStyle: dot_with_label }
modules:
  quick_actions:
    confidence: observed
    render_policy: prd_only
    placement: inside_dark_command_panel_or_independent_section
    item_count: 3-8
  command_panel:
    confidence: observed
    render_policy: prd_only
    placement: lower_left_or_prominent_secondary_panel
  detail_table:
    confidence: observed
    render_policy: prd_only
    placement: lower_right_or_full_width_panel
---

# Contrast Command Analytics Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 适合把分析、日程、命令输入和明细管理放在同一工作台中。它的关键气质是浅灰画布上的白色圆角面板，再用一个近黑命令面板制造高对比记忆点。PRD 决定业务内容，DESIGN.md 只约束视觉承载。主题色可以替换图表和小面积强调色，但不能改变深色命令面板、圆角面板和稳定网格。编码结果必须有分段图、胶囊操作、媒体化表格和命令输入这些可见工艺。

## 2. 使用边界

适用于运营首页、资源管理工作台、事件处理台、协同看板和带搜索明细的管理页面。若 PRD 同时包含概览指标、列表队列、快捷命令或推荐操作、明细记录，该风格匹配度较高。

不适合纯表单、单一表格、品牌落地页和需要暗色大屏的场景。禁止复制任何视觉材料中的具体人名、行业名、记录名、金额、日期、地址、状态文案或页面标题。没有命令输入需求时，不要强行创建命令面板，可用同等质感的深色洞察或快捷操作区替代。

## 3. 设计风格选择与换色逻辑

选择该风格时优先看信息拓扑：顶部身份与全局操作、左上表现分析、右上事件流、下方命令面板和明细表。如果 PRD 只有图表或只有表格，不应硬套完整结构。

主题色只替换分段图表、图例点、快捷命令图标、focus ring、正向状态和少量标签。页面背景、白色面板、黑色命令区、中性文字、浅边框、圆角和阴影保持不变。不要把主题色铺满所有卡片。

## 4. 视觉 DNA

`oversized_identity_bar` 保持大标题和右侧胶囊操作的首屏节奏。可变的是标题、操作和筛选语义；不可变的是标题不入卡片、主操作高对比、顶部留白充足。

`segmented_performance_panel` 保持圆角分段块、连接带、底部图例和右侧指标列表。可变的是图表数据和指标数量；缺失后页面会变成普通图表卡。

`rounded_schedule_stream` 保持日期条、当前日期胶囊、图标圆泡和浅灰长条列表。可变的是事件内容和状态集合；没有时序语义时可转为普通队列。

`dark_assistant_command_panel` 保持近黑外壳、白色内层、胶囊快捷命令和大圆角输入框。可变的是命令数量和辅助媒体；缺失后会失去高对比记忆点。

`refined_record_table` 保持底部明细表的搜索、筛选、媒体化行和状态点。可变的是列和数据形态。

## 5. 视觉品质基线

大标题与胶囊命令头用于建立工作台入口，不要缩成普通后台标题栏。分段堆叠图表用于承载分组或阶段数据，必须使用自定义圆角块和连接带。深色命令面板用于承载智能、推荐或快捷命令，不能只放一个普通输入框。日程行要有图标圆泡、长条背景、右侧信息和稳定行高。明细行要支持缩略图、头像、状态点等微细节。

## 6. 布局规则

推荐结构：

```text
page_shell
  page_identity + global_actions
  top_grid: performance_panel + schedule_panel
  lower_grid: command_panel + detail_table
```

主 grid 使用 `align-items: stretch`，同排面板等高。面板设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。图表、列表行和表格行必须有固定高度，长内容内部截断或滚动，间距由父级 `gap` 管理。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 规则 |
| --- | --- | --- |
| 页面身份与主操作 | `page_identity` | 大标题加右侧胶囊操作，不包入卡片。 |
| 分组表现或阶段趋势 | `performance_panel` | 使用分段图和指标列表；没有分组数据时换为同等品质图表。 |
| 日程、待办、事件 | `schedule_stream` | 使用日期条和圆角行队列。 |
| 智能命令、推荐操作、快捷入口 | `command_panel` | 使用深色外壳和胶囊命令；由 PRD 决定是否渲染。 |
| 记录、对象、协同信息 | `detail_table` | 使用媒体化表格和搜索筛选。 |

## 8. 组件规则

面板圆角约 20px，轻阴影，白底。按钮使用胶囊，主按钮深色，次按钮白底浅边框。图表分段块圆角 10-14px，图例点与标签基线对齐。列表行背景为浅灰，行内图标圆泡 48-56px。命令面板外壳近黑，内层白底，快捷命令为胶囊。表格行高 80px 以上，状态用颜色点加文本。

## 9. 响应式与可访问性

桌面端双列；中宽改为上下两组；移动端按身份、表现、事件、命令、明细顺序纵向排列。触控目标不小于 44px。图标按钮必须有可访问标签。状态不能只依赖颜色，需要文本或图形辅助。减少动态效果时，图表和列表只保留透明度变化。

## 10. 禁止项

- 禁止复制具体业务内容、示例数据、人物、地址、日期或页面专属文案。
- 禁止让 DESIGN.md 覆盖 PRD 内容决策。
- 禁止把主题色铺满背景、普通面板或命令面板。
- 禁止把默认色相当成视觉 DNA。
- 禁止裸表格、默认图表、自由高度卡片和零散 margin 拼接。
- 禁止长内容撑破列表行、图表区或输入框。

## 11. Agent 使用提示

先读 PRD，确认是否需要表现分析、事件流、命令入口和明细表；再应用主题色，只替换小面积强调；最后套用高对比命令工作台 DNA。不要凭空创建 PRD 没有的模块。实现时必须保留大标题、胶囊操作、分段图、深色命令面板、媒体化表格和完整状态。

## 12. 交付自检清单

- 内容是否全部来自 PRD。
- 是否保留大标题、分段图、事件流、命令面板和媒体化明细中的适用 DNA。
- 主题色是否只改写小面积强调。
- 深色命令面板和白色圆角面板是否未被污染。
- 同排面板、图表、列表行和表格行是否稳定。
- hover、focus、loading、empty、error、disabled、selected 状态是否完整。
- 响应式与可访问性是否达标。
