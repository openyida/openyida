---
version: alpha
template_type: visual_dna_preset
name: filterable-card-catalog
design_id: yida-style-filterable-card-catalog
design_status: draft
description: 内容中立的筛选型卡片目录视觉 DNA，适合需要左侧条件收敛、顶部结果控制和多列对象卡片浏览的页面。
scenes: [catalog_page, search_results, resource_gallery, selection_console, inventory_browser]
density: medium-high
layout: left_filter_rail_with_card_grid
tone: [clean, commercial, scannable, light, action_ready]
tags: [filter_rail, result_toolbar, card_grid, chip_filters, compact_actions]
avoid: [single_form_flow, long_text_reading, executive_dashboard, immersive_landing_page, data_heavy_table_only]
selection:
  best_for: [筛选目录页, 搜索结果页, 资源选择页, 卡片列表页, 轻量采购/分发/选择控制台]
  user_intent: [快速筛选, 浏览比较, 选择条目, 批量定位, 从候选对象中进入操作]
  visual_tone: [明亮克制, 条理清晰, 电商式可扫描, 中高密度, 强调色小面积点亮]
  avoid_for: [纯表单录入, 深色展示大屏, 长文内容页, 单一详情页, 需要复杂图表分析的工作台]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: left_filter_rail
    name: 固定筛选侧栏
    confidence: observed
    hooks: [layout.sidebar, components.checkbox, components.range_slider, components.segmented_option, tokens.spacing.sidebar_gap]
    invariant: [左侧独立筛选栏与主内容并列, 筛选分组垂直堆叠, 控件对齐清晰, 侧栏使用浅边框承载而非深色块]
    variable: [筛选字段数量, 分组名称, 控件类型, 是否吸顶, 侧栏在小屏折叠为抽屉]
  - id: result_toolbar_with_chips
    name: 结果工具条与条件胶囊
    confidence: observed
    hooks: [layout.toolbar, components.filter_chip, components.select, components.view_toggle, components.clear_action]
    invariant: [结果摘要在左, 排序和视图切换在右, 已选条件以圆角胶囊横向排列, 清除入口使用强调色文本]
    variable: [结果摘要文案, 筛选条件数量, 排序维度, 视图切换模式, 工具条是否换行]
  - id: uniform_media_card_grid
    name: 等高媒体卡片矩阵
    confidence: observed
    hooks: [layout.card_grid, components.item_card, components.media_frame, css.aspect-ratio, css.align-items-stretch]
    invariant: [主区域使用规则多列网格, 卡片等宽等高, 顶部保留稳定媒体框, 信息区固定层级, 同一行高度一致]
    variable: [卡片列数, 媒体类型, 主标题长度, 辅助信息种类, 操作按钮数量]
  - id: compact_value_and_meta
    name: 紧凑价值信息层
    confidence: observed
    hooks: [components.primary_value, components.secondary_value, components.meta_pill, components.inline_divider]
    invariant: [主数值大号加粗, 次级数值弱化并可用细线划分, 元信息用胶囊或短行承载, 信息区高度稳定]
    variable: [数值语义, 是否展示历史值/对比值, 元信息类型, 状态语义, 辅助指标个数]
  - id: small_area_accent_actions
    name: 小面积高饱和操作点
    confidence: observed
    hooks: [tokens.colors.brand, tokens.colors.rating, components.icon_button, components.badge, components.range_slider]
    invariant: [强调色只用于勾选、滑块、胶囊、图标按钮和关键文本, 大面积背景保持中性, 操作按钮圆形且易识别]
    variable: [主题色相, 操作图标, 状态颜色, hover/focus 反馈, 是否出现次级强调色]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-soft, tokens.colors.brand-strong, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.brand-hover, tokens.colors.brand-pressed, tokens.colors.accent-pill-bg, tokens.colors.accent-track, tokens.colors.status-positive-soft]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.surface-raised, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.text-muted, tokens.colors.border-subtle, tokens.colors.border-strong, tokens.colors.shadow-soft]
  rules:
    - theme_color_only_changes_accent_hue
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - keep_media_frames_neutral_and_consistent
tokens:
  colors:
    bg-page: "#FFFFFF"
    surface: "#FFFFFF"
    surface-muted: "#F1F3F6"
    surface-raised: "#FFFFFF"
    text-primary: "#111318"
    text-secondary: "#6F7480"
    text-muted: "#9AA0AB"
    border-subtle: "#E7EAF0"
    border-strong: "#D9DDE6"
    brand: "#FF6A00"
    brand-soft: "#FFF0E5"
    brand-strong: "#E85C00"
    brand-hover: "#F56400"
    brand-pressed: "#D85200"
    focus-ring: "rgba(255, 106, 0, 0.28)"
    accent-pill-bg: "#FFC21A"
    accent-track: "#FF6A00"
    status-positive-soft: "#EAF6FF"
    shadow-soft: "rgba(17, 24, 39, 0.06)"
  typography:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 22, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0 }
    section-title: { fontSize: 18, fontWeight: 700, lineHeight: 1.35, letterSpacing: 0 }
    card-value: { fontSize: 28, fontWeight: 800, lineHeight: 1.12, letterSpacing: 0 }
    card-title: { fontSize: 16, fontWeight: 700, lineHeight: 1.35, letterSpacing: 0 }
    body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    meta: { fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }
  spacing:
    page-x-desktop: 48
    page-y-desktop: 18
    page-x-tablet: 24
    page-x-mobile: 16
    shell-gap: 42
    sidebar-width: 460
    sidebar-x: 32
    sidebar-y: 34
    sidebar-group-gap: 38
    toolbar-gap: 20
    chip-gap: 12
    grid-gap-x: 34
    grid-gap-y: 34
    card-x: 22
    card-y: 24
    media-padding: 26
  rounded:
    sidebar: 12
    card: 8
    media: 8
    control: 9
    chip: 999
    icon-button: 999
  shadow:
    panel: "0 1px 2px rgba(17, 24, 39, 0.03)"
    card-hover: "0 10px 28px rgba(17, 24, 39, 0.10)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_cards_align
  fixed_height_tokens:
    sidebar_min_height: 720px
    toolbar_height: 72px
    chip_row_min_height: 58px
    media_frame_desktop: 230px
    card_info_area: 210px
    card_min_height: 440px
    card_row_gap: 34px
quality_anchors:
  - id: crisp_filter_rail
    name: 清晰分组筛选栏
    required_when: PRD 包含多条件筛选、范围筛选或状态筛选
    rule: 侧栏必须使用明确标题、分组间距、统一控件高度和轻边框；选中态只用小面积强调色，未选中态保持安静。
  - id: removable_filter_chips
    name: 可移除条件胶囊
    required_when: PRD 需要展示当前已选筛选条件
    rule: 条件胶囊使用白底、浅边框、圆角胶囊和小型关闭图标；胶囊横向排列并允许换行，清除入口使用强调色文本。
  - id: stable_media_grid
    name: 稳定媒体卡片网格
    required_when: PRD 的主要对象适合以卡片浏览、比较或选择
    rule: 每张卡片顶部都有固定比例媒体/预览区域，主体信息在同一基线展开，整行卡片高度一致，hover 只提升阴影和边框精度。
  - id: bold_primary_value_row
    name: 强主值与弱辅助值
    required_when: PRD 对象存在价格、分数、容量、进度、优先级或其他首要数值
    rule: 主值大号粗体靠左，辅助值低对比并缩小；不要让两个数值抢同一层级，比较关系可用细线、弱化文本或短装饰线表达。
  - id: round_accent_action
    name: 圆形强调操作按钮
    required_when: PRD 中每个卡片有主要快捷操作
    rule: 主要操作使用固定尺寸圆形图标按钮并贴近卡片右下信息区；按钮需有 hover、focus、disabled 和 loading 状态。
  - id: dense_but_breathing_spacing
    name: 中高密度留白节奏
    required_when: 页面同时包含侧栏、工具条和三列以上卡片
    rule: 页面保持大块区域分明，卡片内部留白紧凑但不拥挤；靠父级 gap 管理间距，避免零散 margin 破坏对齐。
quality_floor:
  target: polished_catalog_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [precise_filter_alignment, stable_card_heights, neutral_media_frames, removable_chips, small_area_accent, complete_interaction_states]
components:
  page_shell:
    backgroundRef: tokens.colors.bg-page
    paddingXRef: tokens.spacing.page-x-desktop
    gapRef: tokens.spacing.shell-gap
  sidebar:
    widthRef: tokens.spacing.sidebar-width
    backgroundRef: tokens.colors.surface
    borderRef: tokens.colors.border-subtle
    roundedRef: tokens.rounded.sidebar
  filter_group:
    titleStyleRef: tokens.typography.section-title
    gap: 16
  checkbox:
    size: 28
    roundedRef: tokens.rounded.control
    checkedColorRef: tokens.colors.brand
  range_slider:
    trackHeight: 8
    thumbSize: 24
    activeTrackRef: tokens.colors.accent-track
  input:
    height: 56
    roundedRef: tokens.rounded.control
    borderRef: tokens.colors.border-subtle
  filter_chip:
    height: 58
    roundedRef: tokens.rounded.chip
    borderRef: tokens.colors.border-subtle
  card:
    backgroundRef: tokens.colors.surface
    roundedRef: tokens.rounded.card
    borderRef: tokens.colors.border-subtle
    hoverShadowRef: tokens.shadow.card-hover
  media_frame:
    backgroundRef: tokens.colors.surface-muted
    heightRef: layout_stability.fixed_height_tokens.media_frame_desktop
  icon_button:
    size: 46
    roundedRef: tokens.rounded.icon-button
    backgroundRef: tokens.colors.brand
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: independent_section_above_grid_or_toolbar_extension
    item_count: 3-8
    visual_rule: 使用紧凑图标按钮或轻量胶囊入口，不能挤占筛选侧栏，也不能替代卡片主操作。
  filter_rail:
    confidence: observed
    render_policy: prd_required_when_filters_exist
    placement: left_side_desktop_drawer_mobile
  result_grid:
    confidence: observed
    render_policy: prd_required_when_items_exist
    placement: main_content_below_toolbar
---

# Filterable Card Catalog DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 的核心是左侧筛选栏、顶部结果控制区和主区域等高卡片矩阵。它适合把一组可比较对象以图片、图标、摘要或预览块承载，并让用户通过筛选、排序和视图切换快速收敛范围。PRD 决定页面展示什么对象、哪些字段可筛选、是否有主操作；本文件只约束视觉母体、组件形态、密度、状态和响应式。默认强调色是小面积操作色，可被主题色替换，但不能改变白底、浅灰媒体框、圆角胶囊和规则网格这些机制。编码结果必须有清晰对齐、稳定卡片高度和完整交互状态，不能退化成普通后台列表。

## 2. 使用边界

PRD 决定内容、功能、信息架构、业务优先级和模块是否存在。没有筛选需求时，不要强行渲染左侧筛选栏；没有可卡片化对象时，不要把表格数据硬改成卡片；没有快捷操作时，不要虚构卡片按钮。

DESIGN.md 约束的是视觉 DNA：并列式页面骨架、筛选控件层级、结果工具条、胶囊条件、卡片网格、媒体框比例、信息密度、强调色使用边界、响应式折叠和可访问性。

禁止复制任何风格材料中的具体字段、示例数据、品牌词、对象名称、分类名称或页面专属文案。所有标题、字段、数值和操作名称都必须来自 PRD。

## 3. 设计风格选择与换色逻辑

当页面主要任务是“筛选一组候选对象并浏览比较”，且内容可以被拆成重复卡片时，优先选择该风格。典型信息拓扑是：左侧筛选条件、顶部结果摘要与排序控制、已选条件胶囊、主内容卡片网格、卡片内主值与辅助信息、卡片级快捷操作。

默认强调色只代表“可操作、已选中、关键动作”的视觉层级，不是 DNA 本身。主题色输入后，只改写 `brand`、`brand-soft`、`focus-ring`、滑块活动轨道、按钮 hover/pressed 和少量状态辅助色。页面背景、卡片底、媒体框、浅边框、中性文字、卡片圆角、等高网格和侧栏结构必须保持不变。

不要把主题色铺满页面背景、筛选栏底色、卡片底色或媒体框。该风格的品质来自大量中性留白与小面积高饱和强调之间的对比。

## 4. 视觉 DNA

`left_filter_rail` 是页面的条件收敛机制。它必须是独立侧栏，拥有清楚的标题、分组和控件节奏。可变的是字段、控件和折叠方式；不可变的是侧栏和主内容的并列关系，以及浅边框白底的轻量容器气质。缺失时页面会变成普通卡片墙，筛选任务不再清晰。

`result_toolbar_with_chips` 是主内容区的上下文说明机制。结果摘要、排序控件、视图切换和条件胶囊应该在首屏上方可见。可变的是文案和控制项，不可变的是“左摘要、右操作、下方胶囊条件”的扫描路径。缺失时用户无法理解当前列表状态和筛选结果。

`uniform_media_card_grid` 是主要浏览机制。卡片必须使用规则网格、固定媒体框和稳定信息区，同一行高度一致。可变的是媒体内容、列数和字段数量，不可变的是等高、对齐和媒体框比例。缺失时页面会出现自由高度卡片和破碎视觉节奏。

`compact_value_and_meta` 是卡片内部的层级机制。主值大号加粗，辅助值弱化，元信息以胶囊、短文本或分隔线承载。可变的是数值语义和辅助信息，不可变的是主值明显优先、辅助信息轻量靠后的层级。缺失时卡片会失去比较效率。

`small_area_accent_actions` 是操作识别机制。强调色只出现在勾选、滑块、胶囊、按钮和关键文本上。可变的是主题色相和图标语义，不可变的是小面积高饱和使用和中性大面积背景。缺失时页面会过于平淡；滥用时会显得廉价和嘈杂。

## 5. 视觉品质基线

清晰分组筛选栏用于承载多条件筛选。它通过明确分组标题、统一控件尺寸和垂直节奏，让用户快速判断条件集合。若 PRD 筛选项很少，可替换为顶部横向筛选条，但仍要保留分组清晰、控件尺寸一致和选中态明确。

可移除条件胶囊用于展示当前筛选状态。胶囊必须有圆角、浅边框、小关闭图标和足够水平内边距。若 PRD 不需要展示已选条件，可将同等品质用于标签筛选、分段控件或当前视图提示。

稳定媒体卡片网格用于承载主要对象。媒体框固定高度并使用中性浅灰底，信息区按照主值、标题、元信息、操作的顺序组织。若对象没有图片或预览，可用图标、缩略摘要、状态纹理或首字母块替代，但框体比例仍要稳定。

强主值与弱辅助值用于提升比较效率。主值必须清楚、有重量、有一致基线；辅助值不能抢层级。若 PRD 不存在数值，可用主状态、主标题或关键摘要替代该层级。

圆形强调操作按钮用于卡片级主要动作。按钮尺寸固定，位置稳定，图标语义清晰。没有主操作时不要渲染空按钮，可改用 hover 后出现的轻量文本链接或整卡进入详情。

中高密度留白节奏要求页面看起来信息充足但不拥挤。筛选栏、工具条和卡片网格都要依赖父级 `gap`，不要用零散 margin 拼出空间。

## 6. 布局规则

桌面端优先使用双栏布局：左侧 `filter_rail`，右侧 `main_results`。外层页面使用 `display: grid`，列宽为 `minmax(280px, 460px) minmax(0, 1fr)`，列间距使用 `tokens.spacing.shell-gap`。主内容内部依次放置 `result_toolbar`、`active_filter_chips`、`result_grid`。

卡片网格使用 `display: grid`，桌面端建议 `repeat(auto-fit, minmax(260px, 1fr))`，宽屏可以限制为 4 列或由容器宽度决定。主 grid 必须 `align-items: stretch`。卡片设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。

媒体框使用固定高度或固定 `aspect-ratio`，不能被图片、图标或加载态撑开。卡片信息区用固定顺序和稳定间距组织，长标题最多 2 行截断，辅助信息 1 行截断。长内容应该内部滚动、截断或折叠。

区块间距由父级 `gap` 管理。禁止在卡片、筛选组和工具条之间堆叠临时 margin，避免不同状态下布局漂移。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 渲染规则 |
| --- | --- | --- |
| 页面对象集合 | `result_grid` | 使用等高卡片矩阵；没有卡片化需求时改用 PRD 指定的列表或表格，不强行套用 |
| 对象主图、图标或预览 | `media_frame` | 放在卡片顶部固定比例区域；缺失时使用中性占位、图标或摘要纹理 |
| 对象主值或关键状态 | `primary_value` | 大号粗体靠左；没有数值时用主状态或主标题承担首要层级 |
| 对象标题 | `card_title` | 2 行内截断，保持同一卡片区块高度稳定 |
| 次级信息 | `meta_row` | 使用短文本、胶囊、分隔线或小图标；不能堆成长段描述 |
| 多条件筛选 | `filter_rail` | 桌面端左侧栏，小屏抽屉；只渲染 PRD 中存在的筛选项 |
| 当前条件 | `active_filter_chips` | 条件多于 1 个时显示可移除胶囊；没有当前条件则隐藏 |
| 排序与视图切换 | `result_toolbar` | 右侧对齐，控件高度统一；没有排序需求则不渲染 |
| 卡片主操作 | `card_primary_action` | 固定尺寸圆形图标按钮或明确文本按钮；没有主操作则不占位 |
| 快捷入口 | `quick_actions` | 由 PRD 决定是否渲染；作为独立区块或工具条扩展，不塞入侧栏尾部 |

## 8. 组件规则

卡片和面板使用白底、浅边框、8px 左右圆角和轻阴影。默认状态应非常克制，hover 时只提升边框对比、阴影和轻微上移，不能出现大面积彩色底。

筛选控件必须尺寸统一。复选框、单选、分段选项、范围滑块和输入框都要有明确 focus ring。选中态使用 `brand`，禁用态降低透明度但保留边框。

条件胶囊使用白底浅边框，关闭图标放在右侧，图标按钮至少 24px 可点区域。胶囊过多时允许横向滚动或换行，但不能压缩主内容标题。

媒体框使用 `surface-muted`，图片或预览内容居中展示，保持 `object-fit: contain` 或等价策略。加载态用浅灰骨架，不改变框体尺寸。空态用中性图标和短说明，不能使用长文。

主值行使用大号粗体，辅助值和比较信息使用 `text-muted`。若需要表达修正、变化或对比，使用细线、浅色文本或短图形标记，不要引入复杂图表。

按钮分为主要操作、次要操作和图标操作。主要操作可使用小面积主题色；次要操作使用白底边框；纯图标按钮必须有可访问标签和 tooltip。所有按钮都要覆盖 hover、focus、pressed、loading、disabled 状态。

## 9. 响应式与可访问性

宽屏保持左侧筛选栏和多列卡片矩阵。中等屏幕可将筛选栏收窄，卡片降为 2-3 列。小屏幕把筛选栏折叠为抽屉或顶部筛选按钮，卡片使用单列或双列，工具条允许分行。

触控目标不小于 44px。纯图标按钮必须有 `aria-label` 或等价文本。focus ring 使用 `tokens.colors.focus-ring`，不能只依赖颜色表达状态。

长标题、长条件名和长数值都要有截断策略。小屏下胶囊行可横向滚动，并保留清除入口。动效控制在 120-180ms，遵守 reduced motion，禁用夸张缩放和大幅位移。

## 10. 禁止项

禁止复制具体业务内容、示例数据、对象名称、品牌词、分类名称或页面专属文案。

禁止让 DESIGN.md 覆盖 PRD 的内容决策；没有的模块不要强行补。

禁止把输入主题色铺满背景、筛选栏、卡片底、媒体框或大面积面板。

禁止把默认强调色误当成视觉 DNA；DNA 是结构、密度、层级和组件机制。

禁止瀑布流、自由高度卡片、无固定高度媒体框、无固定高度图表容器、长内容撑破父级、零散 margin 拼接和默认后台质感。

禁止在卡片里塞入过多字段。超过 5 个核心信息点时，应根据 PRD 改用详情抽屉、展开区或表格。

## 11. Agent 使用提示

先读 PRD，确认页面是否真的需要筛选、排序、卡片浏览和卡片级操作。再应用主题色，只替换强调色相和派生状态色，不改变白底、浅边框、浅灰媒体框、等高卡片网格和小面积操作点。实现时优先保证左侧筛选栏、结果工具条、条件胶囊、媒体框、主值行、卡片操作和响应式折叠的完整状态。所有字段、数据、标题、动作都必须来自 PRD；不要为了套视觉槽位创造内容。交付时检查卡片是否等高、媒体框是否稳定、胶囊是否可移除、按钮是否有状态、长内容是否截断。

## 12. 交付自检清单

- 内容、字段、数据和操作是否全部来自 PRD。
- 是否保留左侧筛选栏、顶部工具条、条件胶囊和等高卡片矩阵这些核心 DNA。
- 主题色是否只用于勾选、滑块、胶囊、图标按钮、focus ring 和关键文本。
- 页面背景、卡片底、媒体框和中性文字是否保持干净克制。
- 同一行卡片是否等高，媒体框和信息区是否稳定。
- 长标题、长条件、长数值是否截断或折叠，没有撑破父级。
- hover、focus、pressed、loading、disabled、empty、error 状态是否完整。
- 小屏是否将筛选栏折叠为抽屉或顶部入口，工具条是否能自然换行。
- 纯图标按钮是否有可访问标签和 tooltip。
- 是否避免了默认后台质感、瀑布流、自由高度卡片和零散 margin 拼接。
