---
version: alpha
template_type: visual_dna_preset
name: command-filter-card-console
design_id: yida-style-command-filter-card-console
design_status: draft
description: 内容中立的命令型筛选卡片控制台视觉 DNA，适合左侧高级筛选、顶部命令栏、卡片矩阵和分页管理并存的页面。
scenes: [management_catalog, resource_console, inventory_grid, searchable_collection, object_admin]
density: high
layout: bordered_filter_console_with_command_grid
tone: [crisp, operational, structured, neutral, efficient]
tags: [filter_drawer_panel, command_toolbar, segmented_status_tabs, dense_card_grid, pagination]
avoid: [editorial_gallery, marketing_page, executive_dashboard, long_text_reading, immersive_media_page]
selection:
  best_for: [资源管理目录, 对象管理控制台, 可搜索卡片库, 状态筛选列表, 带分页的管理页]
  user_intent: [搜索定位, 多条件筛选, 按状态切换, 新建对象, 批量浏览管理, 分页查看]
  visual_tone: [清晰硬朗, 管理效率优先, 中性边框, 高密度但有秩序, 命令感明确]
  avoid_for: [强视觉陈列, 低密品牌展示, 长流程表单, 复杂图表看板, 移动端单任务]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: bordered_filter_drawer_panel
    name: 边框化高级筛选面板
    confidence: observed
    hooks: [layout.sidebar, components.filter_section, components.checkbox, components.color_swatch, components.range_slider]
    invariant: [左侧筛选区像可关闭抽屉一样独立成面, 分组之间有细分割线, 分组标题右侧有清除/折叠动作, 内部可局部滚动]
    variable: [筛选字段, 分组开合状态, 控件类型, 是否固定在左侧, 小屏展示方式]
  - id: command_toolbar_status_tabs
    name: 状态标签与命令工具条
    confidence: observed
    hooks: [layout.toolbar, components.segmented_control, components.search_input, components.filter_button, components.primary_button]
    invariant: [顶部一行同时承载状态切换、搜索、筛选入口和主要命令, 控件高度统一, 主要命令使用更高对比按钮]
    variable: [状态数量, 搜索占位, 命令数量, 是否出现新增入口, 控件排列顺序]
  - id: compact_admin_card_grid
    name: 紧凑管理卡片矩阵
    confidence: observed
    hooks: [layout.card_grid, components.admin_card, components.media_preview, components.more_menu, css.align-items-stretch]
    invariant: [卡片边框清晰但阴影很轻, 顶部微状态点和更多菜单固定在角落, 媒体预览居中, 信息区简洁]
    variable: [卡片列数, 预览类型, 菜单动作, 状态点数量, 字段数量]
  - id: bottom_pagination_bar
    name: 底部分页控制条
    confidence: observed
    hooks: [layout.pagination_bar, components.page_size_select, components.pagination]
    invariant: [分页位于内容面板底部, 每页数量控制在左, 页码和翻页在右, 控件尺寸一致]
    variable: [分页数量, 每页条数, 是否出现总数, 是否改为无限滚动]
  - id: swatch_and_range_filters
    name: 色点与范围筛选微控件
    confidence: observed
    hooks: [components.color_swatch, components.range_slider, components.price_inputs, tokens.colors.brand]
    invariant: [颜色/类型类筛选使用圆形色点或小方控件, 范围筛选使用输入框加滑杆, 选中态同时有边框和填充]
    variable: [筛选语义, 色点数量, 范围单位, 是否展示分布柱]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.brand-strong, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.brand-hover, tokens.colors.brand-pressed, tokens.colors.slider-active, tokens.colors.status-accent, tokens.colors.selected-swatch-ring]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.text-muted, tokens.colors.border-subtle, tokens.colors.border-strong, tokens.colors.command-dark]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - preserve_command_button_contrast
tokens:
  colors:
    bg-page: "#FFFFFF"
    surface: "#FFFFFF"
    surface-muted: "#F7F8FA"
    media-bg: "#FFFFFF"
    text-primary: "#171717"
    text-secondary: "#5F6673"
    text-muted: "#9CA3AF"
    border-subtle: "#E5E7EB"
    border-strong: "#D4D7DE"
    brand: "#DF604C"
    brand-soft: "#FFF1EE"
    brand-strong: "#C94C39"
    brand-hover: "#D85844"
    brand-pressed: "#B94332"
    focus-ring: "rgba(223, 96, 76, 0.26)"
    slider-active: "#DF604C"
    status-accent: "#DF604C"
    selected-swatch-ring: "#DF604C"
    rating: "#96A64A"
    command-dark: "#2C2C2C"
  typography:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 24, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0 }
    section-title: { fontSize: 22, fontWeight: 650, lineHeight: 1.3, letterSpacing: 0 }
    card-title: { fontSize: 18, fontWeight: 600, lineHeight: 1.35, letterSpacing: 0 }
    card-value: { fontSize: 18, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    meta: { fontSize: 15, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }
  spacing:
    page-x-desktop: 28
    page-y-desktop: 30
    page-x-tablet: 20
    page-x-mobile: 14
    shell-gap: 22
    sidebar-width: 422
    sidebar-x: 28
    sidebar-y: 24
    toolbar-height: 96
    grid-gap-x: 22
    grid-gap-y: 24
    card-x: 22
    card-y: 18
    media-height: 210
  rounded:
    shell: 16
    panel: 16
    card: 10
    control: 8
    swatch: 999
    pagination: 8
  shadow:
    panel: "0 1px 2px rgba(17, 24, 39, 0.03)"
    card-hover: "0 8px 20px rgba(17, 24, 39, 0.08)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_cards_align
  fixed_height_tokens:
    toolbar_height: 96px
    sidebar_min_height: 900px
    filter_section_min_height: 104px
    card_media: 210px
    card_info: 118px
    card_min_height: 338px
    pagination_height: 76px
quality_anchors:
  - id: command_toolbar_alignment
    name: 命令工具条精准对齐
    required_when: PRD 包含状态切换、搜索、筛选或主命令
    rule: 所有顶部控件高度统一，状态标签靠左，搜索和命令靠右；主要命令使用高对比按钮但不改变整体中性色。
  - id: sectional_filter_boundaries
    name: 筛选分组边界
    required_when: PRD 包含多组高级筛选
    rule: 筛选面板分组必须有标题、分割线和局部清除/折叠动作；长列表区域内部滚动。
  - id: micro_status_card_header
    name: 卡片顶部微状态行
    required_when: PRD 对象存在状态、更多操作或卡片级菜单
    rule: 微状态点固定在左上，更多菜单固定在右上；它们不能挤占媒体预览或导致卡片高度变化。
  - id: clean_preview_separator
    name: 预览与信息细分割
    required_when: PRD 对象以卡片管理
    rule: 媒体预览与文本信息之间使用细分割线，保持管理感和扫描效率。
  - id: anchored_pagination
    name: 底部分页锚定
    required_when: PRD 需要分页、每页数量或批量浏览
    rule: 分页条固定在内容面板底部，左侧每页数量，右侧页码；翻页状态必须完整。
quality_floor:
  target: polished_management_catalog_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [aligned_toolbar, sectional_filters, micro_status_dots, stable_preview_cards, anchored_pagination, complete_menu_states]
components:
  shell_panel: { roundedRef: tokens.rounded.shell, borderRef: tokens.colors.border-subtle, backgroundRef: tokens.colors.surface }
  filter_panel: { widthRef: tokens.spacing.sidebar-width, roundedRef: tokens.rounded.panel, borderRef: tokens.colors.border-subtle }
  segmented_control: { height: 50, roundedRef: tokens.rounded.control }
  search_input: { height: 50, roundedRef: tokens.rounded.control }
  filter_button: { height: 50, roundedRef: tokens.rounded.control }
  primary_button: { height: 50, roundedRef: tokens.rounded.control, backgroundRef: tokens.colors.command-dark }
  checkbox: { size: 26, roundedRef: tokens.rounded.control, checkedColorRef: tokens.colors.brand }
  range_slider: { trackHeight: 4, thumbSize: 20, activeRef: tokens.colors.slider-active }
  color_swatch: { size: 32, roundedRef: tokens.rounded.swatch, ringRef: tokens.colors.selected-swatch-ring }
  admin_card: { roundedRef: tokens.rounded.card, borderRef: tokens.colors.border-subtle, hoverShadowRef: tokens.shadow.card-hover }
  pagination: { itemSize: 44, roundedRef: tokens.rounded.pagination }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: toolbar_after_primary_command_or_independent_row
    item_count: 2-5
    visual_rule: 快捷入口应使用小型按钮或菜单，不得抢主命令层级。
  filter_panel:
    confidence: observed
    render_policy: prd_required_when_filters_exist
    placement: left_panel_desktop_modal_mobile
  pagination:
    confidence: observed
    render_policy: prd_required_when_paginated
    placement: bottom_of_content_panel
---

# Command Filter Card Console DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 面向需要搜索、筛选、状态切换和卡片化管理的高效率页面。它由左侧边框化筛选面板、顶部命令工具条、紧凑卡片矩阵和底部分页构成。PRD 决定对象、状态、筛选项、命令和分页规则；本文件只约束视觉结构、控件密度、边框层级、状态表达和响应式。主题色只能替换小面积选中态和辅助状态，不改变中性控制台、细边框卡片和高对比主命令的机制。

## 2. 使用边界

适合管理型对象目录、资源库、状态筛选列表、可搜索集合和分页浏览控制台。若页面需要强图片陈列、品牌叙事、复杂图表或单一步骤表单，不应选择该风格。

不要为了套用视觉槽位创造 PRD 没有的状态切换、筛选分组、新建命令、更多菜单或分页。具体字段、对象名称、状态名称、数值和操作必须来自 PRD。

## 3. 设计风格选择与换色逻辑

当任务重心是“管理一批对象并快速定位/操作”时选择该风格。它比柔和画廊更偏控制台，强调顶部命令、左侧筛选、卡片操作和分页闭环。

主题色只作用于复选框、范围滑块、色点选中环、微状态点和 focus ring。主命令按钮可以保持深色高对比，也可以在 PRD 或主题策略要求时映射为主题色，但不能把整个工具条染色。

背景、白色面板、边框、卡片、媒体预览区、中性文字和分页形态必须保持稳定。

## 4. 视觉 DNA

`bordered_filter_drawer_panel` 是高级筛选机制。它像固定抽屉，左侧独立成面，分组可滚动，标题右侧可放清除或折叠动作。可变的是筛选字段和控件；不可变的是清晰分组边界。

`command_toolbar_status_tabs` 是管理效率来源。状态标签、搜索、筛选入口和主命令在同一工具条里精准对齐。可变的是命令和状态内容；不可变的是统一高度、左右分区和主命令层级。

`compact_admin_card_grid` 是对象承载方式。卡片紧凑、边框明确、顶部角落有微状态和更多菜单，预览区居中。可变的是预览内容和字段；不可变的是稳定高度和管理感。

`bottom_pagination_bar` 形成批量浏览闭环。分页条应锚定在内容面板底部，左右分工明确。没有分页需求时不要强行显示，可替换为加载更多或总量提示。

`swatch_and_range_filters` 是筛选面板的微细节。颜色、类别或状态可用圆点/小方控件，范围用输入框和滑杆组合。主题色替换后仍要保持小面积表达。

## 5. 视觉品质基线

命令工具条精准对齐能避免普通后台的松散感。所有控件高度、圆角和间距必须统一。

筛选分组边界让复杂条件不混乱。每组有标题、分割线、内部滚动或折叠策略。

卡片顶部微状态行提供管理感。状态点和更多菜单固定位置，不能随内容漂移。

预览与信息细分割让卡片更容易扫描。分割线要轻，不要变成厚重表格线。

底部分页锚定让批量浏览闭环完整。分页、每页数量和翻页按钮要有 hover、focus、disabled、selected 状态。

## 6. 布局规则

桌面端使用外层双栏：左侧 `filter_panel`，右侧 `content_panel`。右侧内容面板内部是 `command_toolbar`、`card_grid`、`pagination_bar`。内容面板和筛选面板都使用浅边框白底。

卡片网格使用 `repeat(auto-fit, minmax(250px, 1fr))`，宽屏可稳定为 4 列。主 grid 必须 `align-items: stretch`，卡片设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。

媒体预览区和信息区固定高度。长标题最多 1-2 行，长状态和菜单项内部截断。筛选长列表使用内部滚动，分页条保持在面板底部。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 渲染规则 |
| --- | --- | --- |
| 状态分类 | `status_tabs` | 顶部左侧分段控件；没有状态分类则隐藏 |
| 搜索 | `toolbar_search` | 顶部右侧输入框，宽度稳定 |
| 主命令 | `primary_command` | 高对比按钮；没有主命令则不占位 |
| 高级筛选 | `filter_panel` | 左侧分组面板，小屏弹层 |
| 范围条件 | `range_filter` | 输入框加滑杆；没有范围则隐藏 |
| 色点/枚举 | `swatch_filter` | 圆形或小方选项，选中态有边框和填充 |
| 对象集合 | `admin_card_grid` | 紧凑等高卡片；不适合卡片时遵循 PRD 改为表格 |
| 对象预览 | `media_preview` | 居中展示，固定高度 |
| 卡片菜单 | `more_menu` | 右上角纯图标按钮，必须有 tooltip 和菜单状态 |
| 分页 | `pagination_bar` | 底部锚定；无分页需求则隐藏 |

## 8. 组件规则

筛选面板使用 16px 左右圆角和浅边框。分组之间使用分割线，标题与操作按钮对齐。长列表必须内部滚动。

工具条控件高度统一为 50px 左右。分段控件当前项用白底或轻填充突出；主命令按钮比其他控件更高对比。

卡片使用细边框、轻圆角和低阴影。hover 时提升边框和阴影，不改变卡片底色。更多菜单按钮固定在右上角，菜单打开时有明确选中态。

预览区保持白底和固定高度。加载态使用骨架，错误态用中性占位，不能改变卡片尺寸。

分页控件使用固定方形按钮，当前页高对比，禁用翻页按钮降低透明度但保留布局位置。

## 9. 响应式与可访问性

桌面端保留左侧筛选和右侧内容面板。平板端筛选可收窄或折叠。移动端筛选进入弹层，工具条拆成状态行、搜索行和命令行，卡片 1-2 列。

触控目标不小于 44px。纯图标按钮必须有 `aria-label`。更多菜单支持键盘打开、关闭和焦点回退。状态不能只靠颜色表达，必须有文本、图标或选中边框辅助。

## 10. 禁止项

禁止复制具体业务词、示例数据、对象名称、品牌名、分类名或页面专属文案。

禁止让主题色污染大面积背景、卡片、工具条、筛选面板或分页条。

禁止自由高度卡片、无固定媒体区、顶部控件高度不一、分页漂浮、长筛选列表撑破面板和零散 margin 拼接。

禁止在 PRD 没有要求时强行加入新建按钮、更多菜单、分页、色点筛选或范围筛选。

## 11. Agent 使用提示

先读 PRD，确认是否属于管理型对象目录，是否需要状态标签、搜索、筛选、主命令、卡片菜单和分页。再应用主题色，只替换小面积强调 token。实现时优先保证工具条对齐、筛选分组、卡片微状态、媒体区固定高度和分页锚定。不要凭空创造任何内容。

## 12. 交付自检清单

- 内容、字段和命令是否全部来自 PRD。
- 是否保留左侧高级筛选、顶部命令工具条、紧凑卡片网格和底部分页机制。
- 主题色是否只用于小面积选中态、状态点和 focus ring。
- 工具条控件是否等高对齐。
- 卡片媒体区、信息区和同一行高度是否稳定。
- 筛选长列表是否内部滚动。
- 分页、菜单、按钮、输入、空态和错误态是否完整。
- 小屏是否有筛选弹层和工具条折叠策略。
