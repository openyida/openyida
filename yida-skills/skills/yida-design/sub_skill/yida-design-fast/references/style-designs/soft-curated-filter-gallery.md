---
version: alpha
template_type: visual_dna_preset
name: soft-curated-filter-gallery
design_id: yida-style-soft-curated-filter-gallery
design_status: draft
description: 内容中立的柔和筛选画廊视觉 DNA，适合带分类切换、筛选面板、排序控制和大图卡片浏览的选择型页面。
scenes: [curated_gallery, visual_catalog, selection_browser, item_discovery, card_market]
density: medium
layout: left_soft_filter_panel_with_visual_grid
tone: [soft, airy, curated, visual_first, approachable]
tags: [soft_filter_panel, category_tabs, visual_cards, favorite_action, histogram_range]
avoid: [dense_admin_table, executive_dashboard, long_form_content, multi_step_form, dark_console]
selection:
  best_for: [视觉型目录页, 候选对象浏览页, 分类筛选页, 资源挑选页, 轻量发现页]
  user_intent: [按分类浏览, 通过筛选缩小范围, 快速比较候选对象, 收藏或标记对象, 按偏好排序]
  visual_tone: [柔和留白, 亲和清爽, 视觉优先, 轻商业感, 卡片规整]
  avoid_for: [纯数据管理, 高密报表, 流程审批, 单对象详情, 深色沉浸展示]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: headline_tabs_toolbar
    name: 标题与分类标签工具条
    confidence: observed
    hooks: [layout.header, components.category_tabs, components.dropdown_button, components.sort_select]
    invariant: [左侧大号标题建立页面语境, 中部分类标签使用白底胶囊容器, 右侧筛选和排序控件并列, 当前分类以填充色突出]
    variable: [标题语义, 分类数量, 排序维度, 是否显示筛选按钮, 当前分类名称]
  - id: soft_filter_canvas
    name: 柔和筛选面板
    confidence: observed
    hooks: [layout.filter_panel, components.search_input, components.checkbox_grid, components.option_tiles, components.range_histogram]
    invariant: [筛选区使用大圆角白色面板, 分组标题醒目, 控件以两列或短网格排列, 分组之间留出明显呼吸感]
    variable: [筛选字段, 控件类型, 分组数量, 是否出现搜索框, 小屏是否折叠]
  - id: oversized_visual_cards
    name: 大图留白卡片
    confidence: observed
    hooks: [layout.card_grid, components.visual_card, components.media_stage, css.aspect-ratio, css.object-fit-contain]
    invariant: [卡片以大面积媒体/预览区域吸引视线, 信息区留白充足, 卡片圆角柔和, 同一行卡片高度一致]
    variable: [媒体内容, 卡片列数, 信息字段, 是否展示角标, 是否有收藏动作]
  - id: corner_badges_and_favorites
    name: 角标与悬浮标记动作
    confidence: observed
    hooks: [components.corner_badge, components.favorite_button, tokens.colors.brand, tokens.colors.favorite]
    invariant: [角标贴在媒体区左上, 标记动作贴在右上, 两者不占据信息区高度, 状态变化清晰但面积很小]
    variable: [角标语义, 图标语义, 收藏/标记/关注动作, 是否默认高亮]
  - id: visual_range_histogram
    name: 轻量直方范围筛选
    confidence: observed
    hooks: [components.histogram_slider, components.range_slider, tokens.colors.brand-soft, tokens.colors.border-subtle]
    invariant: [范围筛选用浅灰柱状纹理表达分布, 选中范围以强调色覆盖, 双端点清晰, 不渲染复杂图表坐标轴]
    variable: [范围语义, 分布数据, 端点值, 是否显示输入框]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.brand-strong, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.brand-hover, tokens.colors.brand-pressed, tokens.colors.histogram-active, tokens.colors.selected-tile-bg, tokens.colors.favorite-active]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.media-bg, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.text-muted, tokens.colors.border-subtle, tokens.colors.shadow-soft]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - preserve_soft_white_gallery_feel
tokens:
  colors:
    bg-page: "#F7F7F8"
    surface: "#FFFFFF"
    media-bg: "#FAFAFA"
    surface-muted: "#F4F5F7"
    text-primary: "#111111"
    text-secondary: "#69707D"
    text-muted: "#A0A6B2"
    border-subtle: "#E8EAEE"
    border-strong: "#DADDE4"
    brand: "#FF6B57"
    brand-soft: "#FFF0ED"
    brand-strong: "#E95B49"
    brand-hover: "#F8624F"
    brand-pressed: "#D94D3D"
    focus-ring: "rgba(255, 107, 87, 0.28)"
    histogram-active: "#FF6B57"
    selected-tile-bg: "#FF6B57"
    favorite-active: "#F43F45"
    rating: "#FFC107"
    shadow-soft: "rgba(15, 23, 42, 0.05)"
  typography:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 42, fontWeight: 800, lineHeight: 1.12, letterSpacing: 0 }
    section-title: { fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0 }
    card-title: { fontSize: 22, fontWeight: 600, lineHeight: 1.32, letterSpacing: 0 }
    card-value: { fontSize: 26, fontWeight: 700, lineHeight: 1.18, letterSpacing: 0 }
    body: { fontSize: 17, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    meta: { fontSize: 15, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }
  spacing:
    page-x-desktop: 56
    page-y-desktop: 32
    page-x-tablet: 28
    page-x-mobile: 16
    header-gap: 32
    shell-gap: 32
    filter-width: 460
    filter-x: 24
    filter-y: 34
    filter-group-gap: 34
    card-gap-x: 34
    card-gap-y: 34
    card-x: 18
    card-y: 18
    media-height: 292
  rounded:
    panel: 18
    card: 14
    control: 10
    tab: 10
    badge: 8
    icon-button: 999
  shadow:
    panel: "0 1px 2px rgba(15, 23, 42, 0.02)"
    card-hover: "0 14px 36px rgba(15, 23, 42, 0.09)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_cards_align
  fixed_height_tokens:
    header_height: 72px
    filter_panel_min_height: 880px
    category_tabs_height: 68px
    card_media: 292px
    card_info: 210px
    card_min_height: 520px
quality_anchors:
  - id: pill_category_switcher
    name: 胶囊分类切换器
    required_when: PRD 包含分类、视图或对象族群切换
    rule: 分类切换器必须是白底圆角容器，当前项使用小面积填充强调色，未选项保持低对比文字。
  - id: soft_filter_panel
    name: 柔和筛选面板
    required_when: PRD 包含多组筛选条件
    rule: 筛选面板使用白底大圆角、明显分组标题和两列控件节奏；不要用密集表单样式压缩筛选。
  - id: large_media_stage
    name: 大幅媒体承载区
    required_when: PRD 对象存在图片、图标、预览或可视摘要
    rule: 卡片顶部媒体区要宽松、留白充足、内容居中，加载和空态不改变高度。
  - id: corner_micro_actions
    name: 卡片角落微操作
    required_when: PRD 需要收藏、标记、推荐或状态提示
    rule: 角标和图标动作固定在媒体区角落，视觉面积小，状态明确，不能挤压标题和数值区。
  - id: histogram_range_control
    name: 直方范围控件
    required_when: PRD 需要范围筛选并能展示分布感
    rule: 用浅柱状纹理和双端点滑块表达范围；没有分布数据时可用普通范围滑块，但保留高度和留白。
quality_floor:
  target: polished_visual_gallery_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [pill_tabs, soft_filter_panel, large_media_frames, corner_actions, subtle_card_shadow, stable_grid_heights]
components:
  header: { heightRef: layout_stability.fixed_height_tokens.header_height, gapRef: tokens.spacing.header-gap }
  category_tabs: { height: 68, roundedRef: tokens.rounded.tab, backgroundRef: tokens.colors.surface }
  filter_panel: { widthRef: tokens.spacing.filter-width, roundedRef: tokens.rounded.panel, backgroundRef: tokens.colors.surface }
  search_input: { height: 62, roundedRef: tokens.rounded.control, borderRef: tokens.colors.border-subtle }
  checkbox: { size: 28, roundedRef: tokens.rounded.control, checkedColorRef: tokens.colors.brand }
  option_tile: { height: 50, roundedRef: tokens.rounded.control, selectedBgRef: tokens.colors.selected-tile-bg }
  histogram_slider: { height: 120, activeRef: tokens.colors.histogram-active }
  card: { roundedRef: tokens.rounded.card, backgroundRef: tokens.colors.surface, hoverShadowRef: tokens.shadow.card-hover }
  media_stage: { heightRef: layout_stability.fixed_height_tokens.card_media, backgroundRef: tokens.colors.media-bg }
  favorite_button: { size: 44, roundedRef: tokens.rounded.icon-button }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_between_header_and_grid
    item_count: 3-6
    visual_rule: 使用轻量胶囊或图标按钮，保持与分类切换器同一圆角语言。
  filter_panel:
    confidence: observed
    render_policy: prd_required_when_filters_exist
    placement: left_desktop_top_drawer_mobile
  visual_grid:
    confidence: observed
    render_policy: prd_required_when_items_exist
    placement: main_content_grid
---

# Soft Curated Filter Gallery DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 适合以大图卡片为核心的筛选浏览体验。页面先用标题和分类胶囊建立上下文，再用左侧柔和筛选面板收敛条件，右侧以等高视觉卡片承载候选对象。PRD 决定对象、字段、筛选项、分类和动作是否存在；本文件只定义柔和画廊式布局、控件形态、密度、状态和响应式。主题色可以替换当前强调色，但不能改变浅灰画布、白色卡片、大图留白和小面积角落动作这些机制。

## 2. 使用边界

该风格适合对象有可视预览、图标或可抽象媒体区域的页面。若 PRD 的主要任务是录入、审批、复杂表格分析或长文阅读，应选择其他视觉母体。

PRD 决定内容结构，DESIGN.md 决定 UI 风格。不要为了套用分类、角标、收藏、评分或范围筛选而创造 PRD 没有的功能。所有字段、标题、数值、分类名称和动作名称都必须来自 PRD。

## 3. 设计风格选择与换色逻辑

当用户目标是“浏览一批候选对象并按偏好筛选”，且对象之间需要视觉比较时选择该风格。它强调轻商业感、柔和留白、图片/预览优先和清楚的筛选路径。

主题色只改写选中分类、勾选框、选中选项、范围控件活动段、角标、focus ring 和少量关键动作。背景、卡片、筛选面板、媒体区、中性文字和浅边框必须保持中性。不要让主题色污染整页，否则会破坏清爽的画廊气质。

## 4. 视觉 DNA

`headline_tabs_toolbar` 要让用户在首屏快速知道当前结果语境。标题大而明确，分类切换器使用白底胶囊，右侧控制项保持统一高度。可变的是标题和分类内容，不可变的是“标题、分类、控制”的横向扫描关系。

`soft_filter_canvas` 是柔和筛选承载。它不应像后台表单，而应像独立控制面板：大圆角、分组清楚、控件松弛。小屏可折叠为抽屉，但分组节奏不变。

`oversized_visual_cards` 是主内容品质来源。卡片顶部媒体区要足够大，信息区不能过密；同一行卡片必须等高。媒体缺失时也要用图标或摘要纹理保持稳定框体。

`corner_badges_and_favorites` 用于承载短状态和微操作。角标与图标动作只占据媒体区角落，不能把卡片标题区挤乱。主题色替换后仍需保持小面积表达。

`visual_range_histogram` 让范围筛选更有质感。它是轻量纹理，不是复杂图表；没有分布数据时可以退化为普通滑块，但保留高度、端点和柔和底色。

## 5. 视觉品质基线

胶囊分类切换器必须有稳定高度、当前项填充色、未选项弱文字和容器阴影。它让页面避免普通标签栏的生硬感。

柔和筛选面板通过大圆角、白底、两列控件和清晰分组提升亲和力。筛选项很少时可转为顶部弹出面板，但仍要保持相同控件语言。

大幅媒体承载区是卡片的视觉重心。图片、图标、骨架屏和空态都必须居中，不能拉伸变形，不能改变卡片高度。

卡片角落微操作用于收藏、标记或短状态。它提升可操作感，但只在 PRD 需要时出现。

直方范围控件用于范围筛选；它通过浅灰柱和强调色活动段形成微细节。没有范围筛选时不要强行渲染。

## 6. 布局规则

页面外层使用浅灰画布和宽松内边距。桌面端采用 `grid-template-columns: minmax(320px, 460px) minmax(0, 1fr)`，主内容网格使用 `repeat(auto-fit, minmax(320px, 1fr))`。

主 grid 必须 `align-items: stretch`。卡片、筛选面板都使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。媒体区域固定高度，信息区域用截断和内部布局保护高度。

区块间距使用父级 `gap`，不要用零散 margin。分类栏和顶部控制项在窄屏允许换行，筛选面板折叠后以按钮或抽屉进入。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 渲染规则 |
| --- | --- | --- |
| 页面标题或结果概览 | `page_identity` | 使用大号粗体标题；没有数量时用页面名或视图名 |
| 分类/视图切换 | `category_tabs` | 白底胶囊容器，当前项填充主题色；没有分类则隐藏 |
| 筛选条件 | `filter_panel` | 分组垂直堆叠；只渲染 PRD 存在的条件 |
| 搜索条件 | `filter_search` | 放在筛选面板顶部或工具条内，高度稳定 |
| 对象预览 | `media_stage` | 顶部大图/图标/摘要纹理；缺失时用中性占位 |
| 对象主标题 | `card_title` | 1-2 行，超长截断 |
| 首要数值或状态 | `card_value` | 靠右或靠左醒目展示，视 PRD 信息优先级决定 |
| 角标/收藏/标记 | `corner_micro_actions` | 只在 PRD 需要时渲染，不占位 |
| 范围筛选 | `histogram_range` | 有分布数据时使用直方纹理，无数据时用普通滑块 |

## 8. 组件规则

卡片使用白底、14px 左右圆角和轻阴影。hover 只提升阴影、边框和轻微位移，避免大面积变色。

筛选输入、复选框、选项块和滑块要尺寸统一。选中态使用主题色，未选态保持浅灰。所有控件必须有 hover、focus、disabled 状态。

媒体区使用中性底色和稳定高度。内容以 `object-fit: contain` 或等价策略居中，加载态用骨架，空态用短说明和图标。

角标使用圆角矩形，收藏或标记按钮使用圆形/纯图标按钮，并提供可访问标签和 tooltip。

排序和筛选入口使用白底按钮，边框轻，箭头图标清晰。按钮文字不能溢出，窄屏允许换行或进入更多菜单。

## 9. 响应式与可访问性

桌面端保留左侧筛选面板与多列卡片。平板端将筛选栏收窄，卡片降为 2 列。移动端筛选进入抽屉，卡片单列或双列，分类标签横向滚动。

触控目标不小于 44px。纯图标动作必须有 `aria-label`。状态不能只靠颜色表达，选中态需要图标、边框或文字层级辅助。动效控制在 120-180ms，并遵守 reduced motion。

## 10. 禁止项

禁止复制具体业务词、示例数据、人名、品牌名、分类名或页面专属文案。

禁止把 PRD 没有的分类、筛选项、收藏、角标、评分或范围控件强行加入页面。

禁止把主题色铺满背景、卡片、筛选面板或媒体区。

禁止瀑布流、自由高度卡片、媒体框随图片比例变化、长标题撑破卡片、零散 margin 拼接和默认后台质感。

## 11. Agent 使用提示

先读 PRD，确认对象是否适合视觉卡片、是否需要分类、筛选、排序和角落动作。再应用主题色，只替换小面积强调色，不改变浅灰画布、白底柔和面板、大图媒体区和等高卡片。实现时优先保证分类胶囊、筛选分组、媒体区、卡片高度、角落动作和移动端抽屉的完整状态。

## 12. 交付自检清单

- 内容是否全部来自 PRD。
- 是否保留大标题、分类胶囊、柔和筛选面板和大图卡片网格。
- 主题色是否只用于小面积选中态和动作态。
- 卡片媒体区是否固定高度且不变形。
- 同一行卡片是否等高。
- 筛选控件、排序按钮和图标动作状态是否完整。
- 小屏筛选是否折叠为抽屉或顶部入口。
- 是否避免了具体业务绑定、默认后台质感和瀑布流。
