---
version: alpha
template_type: visual_dna_preset
name: teal-rail-analytics-workbench
design_id: teal-rail-analytics-workbench
design_status: draft
description: 可被流程选择和换色的双栏数据工作台视觉 DNA 风格，适合高密度摘要、分析图表、右侧洞察栏和明细列表组合界面。
scenes: [工作台, 首页, 仪表盘, 管理后台, 列表管理页]
density: medium-high
layout: split_main_with_right_insight_rail
tone: [清爽, 专业, 数据化, 精致, 克制]
tags: [双栏工作台, 右侧洞察栏, 图表列表组合, 青绿强调, 高密度信息]
avoid: [营销落地页, 品牌叙事页, 沉浸式大屏, 强插画页面, 纯表单流程页]
selection:
  best_for: [数据总览页, 运营工作台, 管理后台首页, 分析列表页, 状态追踪页]
  user_intent: [快速扫描状态, 比较多组摘要, 查看趋势, 管理明细记录, 追踪排行或洞察]
  visual_tone: [白底, 右侧信息栏, 青绿强调, 深墨对比, 卡片化, 高品质数据纹理]
  avoid_for: [强品牌转化, 大屏展示, 内容阅读, 低信息密度展示, 情绪化活动传播]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: split_main_with_right_insight_rail
    name: 左宽主工作区 + 右侧洞察栏
    confidence: observed
    hooks: [page_shell, main_workspace, right_insight_rail, vertical_divider, stacked_side_sections]
    invariant: [wide_main_area, persistent_right_rail, vertical_section_boundary, scan_from_summary_to_detail]
    variable: [module_count, rail_section_count, content_type, business_content]
  - id: airy_bordered_card_grid
    name: 通透白底细边框卡片网格
    confidence: observed
    hooks: [summary_cards, bordered_panels, low_shadow, white_canvas, rounded_14_18]
    invariant: [white_canvas, subtle_borders, restrained_shadow, generous_inner_padding, quiet_card_surfaces]
    variable: [card_labels, card_values, card_count, accent_hue]
  - id: dual_tone_data_texture
    name: 深墨 + 主题强调色的数据纹理
    confidence: observed
    hooks: [bar_mini_chart, progress_bar, line_chart, status_dot, tab_badge, icon_accent]
    invariant: [dark_ink_contrast, small_area_accent, light_gray_tracks, chart_as_primary_color_carrier]
    variable: [brand_hue, deep_accent_hue, chart_series_hues, status_palette]
  - id: layered_chart_analytics_panel
    name: 分层图表分析面板
    confidence: observed
    hooks: [large_chart_panel, ghost_bars, highlighted_series, floating_tooltip, segmented_control, axis_ticks]
    invariant: [large_fixed_chart_area, pale_chart_context, one_or_two_highlighted_series, floating_detail_cards]
    variable: [chart_type, time_granularity, highlighted_data, label_content]
  - id: tabbed_toolbar_detail_table
    name: 标签筛选 + 轻工具栏 + 图标化明细表
    confidence: observed
    hooks: [tab_strip, active_tab_underline, count_badge, search_icon_button, filter_button, primary_light_action, progress_cell, rating_or_score_cell, row_menu]
    invariant: [horizontal_tab_filter, compact_toolbar_actions, rounded_table_header, stable_rows, iconized_row_actions]
    variable: [tab_count, table_columns, row_content, action_set]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.deep-accent, tokens.colors.brand-track, tokens.colors.warning, tokens.colors.info, tokens.colors.badge-bg]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.text-tertiary, tokens.colors.border-subtle, tokens.colors.border-muted]
  rules:
    - theme_color_only_changes_accent_hue
    - keep_deep_accent_as_dark_readable_counterpart
    - do_not_tint_page_background
    - do_not_turn_white_cards_into_colored_cards
    - keep_accent_usage_small_area
    - keep_charts_progress_tabs_and_badges_as_primary_color_carriers
tokens:
  colors:
    bg-page: "#FFFFFF"
    surface: "#FFFFFF"
    surface-muted: "#F8F9FA"
    surface-soft: "#FBFCFC"
    text-primary: "#0C2A3A"
    text-secondary: "#7A7F86"
    text-tertiary: "#B0B4B9"
    border-subtle: "#ECEFF1"
    border-muted: "#F2F3F4"
    brand: "#0F9A9B"
    brand-soft: "#E8F7F7"
    brand-track: "#EAF1F1"
    deep-accent: "#082C3D"
    warning: "#FFAA1B"
    danger: "#E85B5B"
    info: "#6D77FF"
    badge-bg: "#EAF7FF"
    focus-ring: "#45B7B7"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    page-title: { fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0 }
    breadcrumb: { fontSize: 18, fontWeight: 400, lineHeight: 1.35, letterSpacing: 0 }
    section-title: { fontSize: 22, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0 }
    card-label: { fontSize: 20, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 }
    metric-value: { fontSize: 34, fontWeight: 700, lineHeight: 1.1, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 14, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0 }
  spacing:
    page-x-desktop: 42
    page-y-desktop: 34
    page-x-mobile: 18
    grid-gap: 28
    rail-gap: 28
    card-gap: 26
    card-x: 28
    card-y: 24
    panel-x: 30
    panel-y: 28
  rounded:
    sm: 8
    md: 12
    control: 16
    card: 16
    panel: 18
    pill: 999
  shadow:
    panel: "0 8px 24px rgba(8, 44, 61, 0.035)"
    floating: "0 14px 36px rgba(8, 44, 61, 0.10)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    summary_card: 146px
    compact_stat_card: 250px
    main_chart_panel: 440px
    right_rail_section: 300px
    tab_bar: 84px
    detail_toolbar: 68px
    table_header: 58px
    table_row: 96px
quality_anchors:
  - id: four_card_status_strip
    name: 顶部四卡摘要状态条
    required_when: PRD 包含多个核心状态、摘要或待处理分类
    rule: 使用一行 4 个等高白底细边框摘要卡，标签弱化、主数值强层级，允许单个标签使用当前主题强调色或警示色，但卡片底色保持白色。
  - id: persistent_right_insight_rail
    name: 持续可见的右侧洞察栏
    required_when: PRD 包含排行、关键对象、状态摘要、趋势小图或辅助洞察
    rule: 右侧使用独立栏位与主区用竖线分隔，内部纵向堆叠卡片、小图、排行项和轻操作链接，保持稳定宽度和统一分割线。
  - id: layered_bar_chart_panel
    name: 分层柱状图分析面板
    required_when: PRD 包含月份、阶段、进度、转化或分组比较数据
    rule: 使用浅灰背景柱作为上下文，当前主题色和深墨色突出选中组，叠加白底 tooltip 小卡和顶部粒度切换控件。
  - id: soft_tabbed_detail_table
    name: 细线标签筛选与圆角明细表
    required_when: PRD 包含状态筛选和记录列表
    rule: 使用横向 tab，选中项有细顶部线或下划线和小型数量徽标；表格表头浅灰，行高稳定，进度/评分/状态使用图形化单元格。
  - id: avatar_badge_rank_items
    name: 图标头像式排行条目
    required_when: PRD 包含排行、推荐、重点对象或侧栏列表
    rule: 条目左侧使用圆形头像或抽象图标容器，右侧使用标题、弱说明、短数值和状态徽章，行间用细分割线分隔。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [right_rail_boundary, four_card_status_strip, subtle_bordered_cards, layered_chart_tooltip, tab_active_indicator, rounded_table_header, iconized_row_actions]
components:
  summary_card: { backgroundRef: tokens.colors.surface, borderRef: tokens.colors.border-subtle, roundedRef: tokens.rounded.panel }
  panel: { backgroundRef: tokens.colors.surface, borderRef: tokens.colors.border-subtle, roundedRef: tokens.rounded.panel, shadowRef: tokens.shadow.panel }
  input: { height: 46, roundedRef: tokens.rounded.control }
  button: { height: 46, roundedRef: tokens.rounded.control }
  tab: { height: 74, activeIndicator: top_or_bottom_line, badgeShape: pill }
  table_row: { height: 96 }
  progress: { trackRef: tokens.colors.brand-track, fillRef: tokens.colors.brand }
  chart: { brandLineRef: tokens.colors.brand, deepLineRef: tokens.colors.deep-accent, gridRef: tokens.colors.border-muted }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_after_summary
    item_count: 4-8
---

# Teal Rail Analytics Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一套双栏数据工作台视觉 DNA：左侧是宽主工作区，右侧是持续可见的洞察栏，中间用极细竖线建立结构边界。

整体以白色画布、细边框卡片、大圆角面板、深墨文字和小面积主题强调色构成，适合需要同时看摘要、图表、排行、筛选和明细的高密度页面。

PRD 决定页面有哪些内容、功能和模块，DESIGN.md 只决定这些模块长什么样。

流程可以用输入主题色重算强调色，但只能改变色相，不能改变左宽右栏、白底细边框、分层图表和图标化列表的视觉机制。

生成结果必须达到精致数据工具的视觉品质，不能只是默认后台组件堆叠。

## 2. 使用边界

PRD 是内容、功能、信息架构、业务优先级和模块是否存在的唯一来源。DESIGN.md 只负责 UI 风格：视觉 DNA、布局气质、组件形态、密度、状态、响应式和可访问性。

当 PRD 与本文的槽位示例不一致时，以 PRD 为准。不要为了套用 `primary_metrics`、`right_insight_rail`、`ranked_items`、`detail_table` 或 `quick_actions` 而凭空创造业务内容；只需把 PRD 中真实存在的模块映射到最接近的视觉槽位。

禁止复用风格来源中的业务名词、人名、指标名、示例数据和页面专属文案。所有业务内容必须来自 PRD。

## 3. 设计风格选择与换色逻辑

这个文件是视觉 DNA preset，不是一次性最终稿。上游流程应先根据用户场景、需求、信息密度、页面类型和主题色分析结果，判断是否选择本风格。

适合选择本风格的信号：用户需要管理首页、数据总览、状态追踪、排行洞察、分析图表和明细列表共存。真正的 DNA 是左宽右栏、白底细边框卡片、深墨与主题强调色的数据纹理、分层图表和图标化明细，而不是默认青绿色本身。

主题色改写时，只允许改写强调色相关 token，例如 `brand`、`brand-soft`、`focus-ring`、图表序列色、徽标色和进度条填充色。`deep-accent` 应从主题色派生为足够深、可读的对比色；如果主题色过浅，必须生成更深的同色系或近似墨色作为深色数据层。

必须保留白色画布、浅灰表面、中性文字、浅边框、大圆角、右侧洞察栏和小面积强调的使用方式。不要把输入主题色铺满背景、指标卡或大面积面板。

## 4. 视觉 DNA

### 左宽主工作区 + 右侧洞察栏

桌面端必须优先形成左侧主工作区和右侧洞察栏的结构。右栏不是浮动卡片，也不是普通侧边导航，而是用于承载排行、小型趋势、关键对象、状态摘要或辅助洞察的持续信息栏。PRD 不需要右栏时可以折叠为下方区块，但主辅层级和边界感必须保留。

### 通透白底细边框卡片网格

卡片、面板、摘要块都以白底、极淡边框和低阴影建立层级。卡片底色不被主题色污染，视觉品质依靠精确间距、圆角、数字层级和边框克制感，而不是彩色块。

### 深墨 + 主题强调色的数据纹理

默认强调色和深墨色用于数据可视化、进度、选中态、状态点和图标细节。流程输入主题色后，可以替换默认色相，但仍要保留“深色对比层 + 小面积亮强调 + 浅灰轨道”的数据纹理。

### 分层图表分析面板

主图表应有浅灰上下文层、少量高亮数据层、固定高度容器、轻坐标线、浮动 tooltip 和粒度切换控件。图表不能只是一张普通折线或普通柱状图，必须有前后层次与可读焦点。

### 标签筛选 + 轻工具栏 + 图标化明细表

明细区域应包含横向筛选标签、轻量搜索/筛选/主操作工具，以及带浅灰表头、图形化单元格和行操作的稳定列表。PRD 没有表格时，可以替换为同等密度的列表，但仍要保留标签筛选与轻工具栏语言。

## 5. 视觉品质基线

这个风格要求编码结果达到精致数据工作台的品质下限。只使用白底、卡片、表格还不够，必须保留足够的微观设计信号。

- 若 PRD 包含多个核心状态、摘要或分类，使用顶部四卡摘要状态条：一行等高白底卡片，标签弱、数值强，卡片之间间距稳定。
- 若 PRD 包含排行、重点对象、辅助摘要或小趋势，使用持续可见的右侧洞察栏：竖线分隔、独立宽度、纵向 section、轻操作链接和细分割线。
- 若 PRD 包含分组比较、时间序列或进度数据，使用分层图表面板：浅灰上下文柱/线、当前主题高亮、深色对比层、白底 tooltip。
- 若 PRD 包含记录列表，使用细线标签筛选和圆角明细表：选中 tab 有细线和数量徽标，表头浅灰，行高稳定，图形化单元格可扫读。
- 若 PRD 包含排行或侧栏列表，使用头像/图标式条目：圆形图标容器、标题、副说明、短数值和状态徽章组合。

品质失败表现：页面只是普通白卡片、普通表头、普通按钮和普通表格的堆叠；没有右侧洞察栏边界、没有分层图表、没有标签筛选细节、没有图标化行和状态微纹理。

## 6. 布局规则

以下槽位是参考映射，不是业务结构要求。生成 UI 时先读 PRD，再选择、重命名、合并、省略或扩展槽位；PRD 没有的模块不要强行补，但必须保留视觉 DNA 和布局稳定性规则。

```text
page_shell
  main_workspace
    page_header
      page_identity
      breadcrumb_or_context
    primary_summary / primary_metrics
    analytics_grid
      compact_insight_column
      primary_chart_panel
    detail_section
      tab_filter
      detail_toolbar
      detail_table / detail_list
  right_insight_rail
    spotlight_item
    rail_metric_strip
    compact_trend_panel
    ranked_item_list
```

桌面端主布局使用两列：左侧 `main_workspace` 占约 68%-72%，右侧 `right_insight_rail` 占约 28%-32%，中间用 1px 浅边界区分。主工作区内部按摘要、分析、明细自上而下排列。

布局稳定性是硬规则：主 grid 使用 `align-items: stretch`，同一行面板等高；面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；长内容在内部滚动、截断或折叠；区块间距由父级 `gap` 管理。

禁止瀑布流、自由高度卡片、无固定高度图表容器、长内容撑破父级和零散 margin 拼接布局。

## 7. PRD 槽位映射

| PRD 内容类型 | 推荐视觉槽位 | 处理规则 |
| --- | --- | --- |
| 页面标题、路径、上下文说明 | `page_identity` / `breadcrumb_or_context` | 放在左上，标题强、路径弱，当前层级可加粗。 |
| 多个核心状态、摘要或分类 | `primary_summary` / `primary_metrics` | 使用顶部四卡摘要状态条；没有数字时用短摘要卡，不强造数值。 |
| 局部洞察、重点对象、小型排行 | `right_insight_rail` / `ranked_item_list` | 放入右侧栏；若 PRD 不需要右栏，可折叠为主区下方洞察 section。 |
| 趋势、比较、进度、阶段数据 | `primary_chart_panel` | 使用分层图表；没有图表数据时替换为同等品质主内容面板。 |
| 状态筛选、分类筛选 | `tab_filter` | 使用横向 tab，选中项有细线和可选数量徽标。 |
| 搜索、筛选、导出、新建等操作 | `detail_toolbar` / `global_actions` | 使用轻量图标按钮或圆角线框按钮，不做厚重工具栏。 |
| 记录、任务、资源、审批、消息 | `detail_table` / `detail_list` | 表格和列表由 PRD 数据形态决定，必须保留稳定行高和图形化状态单元格。 |
| 常用入口、快捷操作、快速发起 | `quick_actions` | 是否渲染由 PRD 决定；需要时使用独立区块，不塞进表格工具栏或右侧栏尾部。 |

## 8. 组件规则

组件的具体 token 以前面的 YAML 为准，使用时遵循这些原则：

- 摘要卡：白底、细边框、16-18px 圆角、主数值 32-36px，标签可用中性色，个别状态标签允许使用主题强调色或警示色。
- 面板：白底、细边框、轻阴影、18px 圆角；标题区和内容区分明，内容区允许内部滚动。
- 右侧栏：使用竖向 section，section 标题左侧强、右侧可放轻链接；列表项之间用细线分隔。
- 图表：当前主题强调色用于主数据层，深墨色用于第二强调层，浅灰用于上下文轨道和网格；tooltip 为白底浮层。
- 表格和列表：表头使用浅灰底，行高稳定；进度、评分、状态、趋势等单元格必须图形化，行尾操作使用图标按钮。
- 标签筛选：横向排列，选中项使用细线、深色文字和小型数量徽标；非选中项低对比。
- 输入和按钮：高度稳定，圆角一致；hover、active、focus、disabled、loading 状态必须完整。
- 快捷入口：若 PRD 需要，使用独立区块承载 4-8 个入口；线性图标、短标签、轻 hover，不做彩色宫格或插画入口。

## 9. 响应式与可访问性

- `>= 1280px`：保留左主右栏，右栏宽度 28%-32%，主区和右栏独立滚动策略由页面需求决定。
- `960px - 1279px`：右栏可缩窄，内部图表和排行项减少辅助文本。
- `640px - 959px`：右栏下移为洞察 section；摘要卡 2 列，分析面板单列。
- `< 640px`：页面内边距 18px；tab 允许横向滚动；表格横向滚动或改列表；触控目标不小于 44px。

所有纯图标控件必须有可访问标签。focus ring 必须可见。图表和状态不能只依赖颜色。动画控制在 120-180ms，并支持 `prefers-reduced-motion`。

## 10. 禁止项

- 禁止从风格来源或 DESIGN.md 示例中复制具体业务字段、示例数据、人名、机构名、分类名称或页面专属文案。
- 禁止让 DESIGN.md 覆盖 PRD 的内容决策；PRD 没有的业务模块不要强行生成。
- 禁止把当前主题色铺满页面背景、摘要卡底色或大面积面板。
- 禁止把当前主题色误当成视觉 DNA；主题色只改色相，不改左宽右栏、白底细边框、分层图表和图标化列表机制。
- 禁止生成默认后台质感：普通白卡片堆叠、普通表格表头、无图标化行、无轻量数据纹理、无 hover/focus 状态。
- 禁止瀑布流、`align-items: start`、自由高度卡片和无固定高度图表容器。
- 禁止随机混用直角、小圆角、胶囊按钮和超大圆角。
- 禁止把快捷入口做成高饱和彩色宫格、超大插画入口或按钮墙。

## 11. Agent 使用提示

先读取 PRD，确定真实模块、内容优先级和数据形态；再使用流程已解析的主题色改写强调色 token；最后用本 DESIGN.md 约束视觉表达。不要硬套槽位，也不要凭空创造 PRD 未要求的业务内容。主题色可以替换默认色相，但内容替换和换色后仍必须保留五个视觉 DNA：`左宽主工作区 + 右侧洞察栏`、`通透白底细边框卡片网格`、`深墨 + 主题强调色的数据纹理`、`分层图表分析面板`、`标签筛选 + 轻工具栏 + 图标化明细表`。编码时必须达到视觉品质基线：四卡摘要状态条、右侧洞察栏、分层图表、圆角明细表、图标化排行条目和完整交互状态应按 PRD 条件尽量落地。

## 12. 交付自检清单

- [ ] 输出文件名来自 front matter 的 `name`，当前文件名为 `teal-rail-analytics-workbench.md`。
- [ ] 内容、模块和业务优先级均来自 PRD，而不是 DESIGN.md 的示例槽位。
- [ ] PRD 没有的业务模块没有被强行生成。
- [ ] 左侧主工作区和右侧洞察栏的主辅结构清晰；移动端已合理折叠。
- [ ] 白色画布、细边框卡片、轻阴影和大圆角形成主要结构。
- [ ] 当前主题色只改写强调色和派生状态色，没有改变白底、浅灰面板、细边框和右侧栏机制。
- [ ] 页面不是默认后台组件堆叠，能看到四卡摘要、右侧洞察栏、分层图表、标签筛选、圆角表头或图标化行等品质信号。
- [ ] 图表、表格、右侧栏、快捷入口和面板都有稳定高度或溢出策略。
- [ ] 搜索、筛选、tab、行操作、快捷入口都有必要状态。
- [ ] 表格或列表长内容不会撑破父级，移动端可以滚动或折叠。
- [ ] 图标按钮有可访问标签，键盘 focus 清晰可见。
- [ ] 状态表达不只依赖颜色，并支持 reduced motion。
