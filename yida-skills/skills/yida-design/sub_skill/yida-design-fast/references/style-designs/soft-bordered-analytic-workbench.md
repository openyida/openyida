---
version: alpha
template_type: visual_dna_preset
name: soft-bordered-analytic-workbench
design_id: visual-dna-soft-bordered-analytic-workbench
design_status: draft
description: 适用于高密度信息工作台、运营概览、数据摘要页和管理控制台的通用视觉 DNA，以浅色画布、软边框面板、深色摘要舞台、轻量图表和分层操作控件建立精致而稳定的界面气质。
scenes: [workbench, dashboard, admin_console, analytic_overview, operation_home]
density: medium-high
layout: top_toolbar_summary_stage_then_modular_grid
tone: [clean, precise, calm, premium, data_focused]
tags: [soft_bordered, analytic, modular_grid, command_toolbar, chart_panel]
avoid: [marketing_landing_page, editorial_content_site, immersive_gallery, playful_game, long_form_article]
selection:
  best_for: [数据工作台, 指标概览页, 管理后台首页, 运营驾驶舱, 列表加图表混合页]
  user_intent: [快速掌握状态, 扫描多组信息, 对比趋势与明细, 执行少量高频操作]
  visual_tone: [浅色克制, 高密度但不拥挤, 圆角柔和, 边框精细, 强调色小面积点亮]
  avoid_for: [品牌叙事页, 低信息量宣传页, 大幅图片展示页, 强沉浸内容页]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: command_toolbar
    name: 顶部轻量命令栏
    confidence: observed
    hooks: [topbar, search_input, date_filter, secondary_button, icon_button, keyboard_hint]
    invariant: [顶部控件低高度横向排列, 输入与筛选控件使用白底浅边框, 右侧聚合全局操作, 所有控件对齐到同一基线]
    variable: [控件数量, 筛选类型, 命令文案, 是否展示快捷键提示]
  - id: dark_summary_stage
    name: 深色摘要舞台
    confidence: observed
    hooks: [summary_stage, hero_metric, dark_surface, faint_pattern, primary_action_group]
    invariant: [首屏上方使用横向深色大面板承载核心摘要, 左侧大号主信息, 右侧高频操作成组, 背景纹理低对比且不干扰阅读]
    variable: [主摘要内容, 操作数量, 默认强调色, 背景纹理形态]
  - id: chart_with_side_insights
    name: 主图表加侧向洞察
    confidence: observed
    hooks: [chart_panel, positive_negative_bars, side_insight_stack, divider, segmented_control]
    invariant: [主内容面板采用左大右小分栏, 左侧保留轻网格图表或等价主内容区域, 右侧垂直堆叠摘要条目并用细线分隔]
    variable: [图表类型, 维度粒度, 侧向洞察数量, 右侧是否替换为辅助列表]
  - id: equal_metric_grid
    name: 等高指标卡栅格
    confidence: observed
    hooks: [metric_card, equal_height_grid, icon_label_row, delta_badge, comparison_caption]
    invariant: [指标卡同一行等高, 图标与标题在顶部对齐, 主数值大号突出, 辅助说明置底或次级层级, 卡片只用浅边框和极轻阴影]
    variable: [卡片数量, 指标含义, 趋势方向, 是否展示对比说明]
  - id: split_detail_surface
    name: 明细表与辅助面板并列
    confidence: observed
    hooks: [detail_table, list_row_icon, table_toolbar, supporting_panel, visual_object_card]
    invariant: [底部区域使用宽主面板加窄辅助面板, 明细表头浅灰小写层级, 行内图标容器柔和, 工具按钮集中在面板标题右侧]
    variable: [表格列, 行内容, 辅助面板类型, 工具按钮数量]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.brand-muted, tokens.colors.chart-primary, tokens.colors.chart-secondary, tokens.colors.status-positive, tokens.colors.status-info]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle, tokens.colors.shadow-color]
  rules:
    - theme_color_only_changes_accent_hue
    - replace_hue_preserve_visual_mechanism
    - do_not_tint_page_background
    - do_not_turn_neutral_cards_into_colored_cards
    - keep_accent_usage_small_area
    - preserve_dark_summary_contrast
tokens:
  colors:
    bg-page: "#ffffff"
    bg-app: "#f7f9fb"
    surface: "#ffffff"
    surface-muted: "#f4f7f9"
    surface-raised: "#ffffff"
    dark-stage: "#075f66"
    dark-stage-muted: "#0d7078"
    text-primary: "#17191c"
    text-secondary: "#718092"
    text-tertiary: "#9aa5b1"
    border-subtle: "#e7edf2"
    border-strong: "#dbe4eb"
    brand: "#09d47d"
    brand-strong: "#05686f"
    brand-soft: "#e7fbf2"
    brand-muted: "#4d858b"
    status-positive: "#12b981"
    status-negative: "#ef4b7b"
    status-neutral: "#eef2f5"
    status-info: "#4d858b"
    chart-primary: "#075f66"
    chart-secondary: "#09d47d"
    focus-ring: "#09d47d"
    shadow-color: "rgba(18, 31, 44, 0.08)"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 24, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0 }
    section-title: { fontSize: 20, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0 }
    metric-hero: { fontSize: 46, fontWeight: 500, lineHeight: 1.05, letterSpacing: 0 }
    metric-card: { fontSize: 36, fontWeight: 500, lineHeight: 1.1, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
    caption: { fontSize: 14, fontWeight: 400, lineHeight: 1.35, letterSpacing: 0 }
    table-head: { fontSize: 12, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0.04em }
  spacing:
    page-x-desktop: 28
    page-x-tablet: 20
    page-x-mobile: 16
    page-y: 24
    grid-gap: 20
    panel-x: 28
    panel-y: 24
    control-gap: 8
    row-gap: 18
  rounded:
    control: 12
    panel: 20
    stage: 22
    icon-tile: 12
    status-pill: 8
  shadow:
    panel: "0 1px 2px rgba(18, 31, 44, 0.04), 0 8px 24px rgba(18, 31, 44, 0.04)"
    control: "0 1px 2px rgba(18, 31, 44, 0.06)"
    none: "none"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  min_width_policy: "min-width: 0 on all grid children"
  min_height_policy: "min-height: 0 on nested flex panels"
  fixed_height_tokens:
    topbar: 48px
    summary_stage: 170px
    chart_panel: 430px
    metric_card: 150px
    detail_panel: 420px
    table_row: 72px
quality_anchors:
  - id: soft_command_bar
    name: 轻量顶部命令栏
    required_when: 页面存在搜索、筛选、导出、时间范围或全局命令
    rule: 控件使用同高度、浅边框、微阴影和图标前缀，右侧命令组合保持紧凑，不让顶部变成厚重导航。
  - id: dark_summary_stage
    name: 深色摘要舞台
    required_when: PRD 存在核心状态、主摘要或一组最高优先级操作
    rule: 用深色横向大面板形成首屏锚点，主信息左对齐，操作组右对齐，低对比纹理只用于增加层次。
  - id: airy_chart_panel
    name: 轻网格主内容面板
    required_when: PRD 存在趋势、分布、对比或时间序列信息
    rule: 图表容器固定高度，网格线极浅，主序列和辅助序列形成清晰正负或主次对比，坐标标签不抢占视觉焦点。
  - id: side_insight_stack
    name: 侧向洞察摘要栈
    required_when: 主内容需要配套解释、摘要、分组统计或关键状态
    rule: 在主面板侧边使用窄列摘要块，每块包含色块图标、标题、主值和变化状态，中间用细分隔线控制节奏。
  - id: equal_metric_cards
    name: 等高指标卡组
    required_when: PRD 需要展示三到六个并列摘要项
    rule: 卡片同高同宽，顶部为图标标题和周期/标签，中央为大号主值，底部为次级对比说明，避免自由高度造成参差。
  - id: refined_detail_surface
    name: 精致明细承载面
    required_when: PRD 存在表格、列表、事件流、对象清单或近期记录
    rule: 表头用浅灰背景与小号强调字，行高稳定，行首用柔和图标容器建立扫描点，状态用低饱和标签而非纯文字。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [precise_alignment, stable_panel_heights, subtle_borders, refined_table_header, iconized_rows, restrained_accent_usage, chart_grid_texture]
components:
  card:
    background: tokens.colors.surface
    border: "1px solid tokens.colors.border-subtle"
    roundedRef: tokens.rounded.panel
    shadowRef: tokens.shadow.panel
    padding: tokens.spacing.panel-x
  input:
    height: 48
    roundedRef: tokens.rounded.control
    border: "1px solid tokens.colors.border-subtle"
    icon_slot: leading
    hint_slot: trailing
  button:
    height: 48
    roundedRef: tokens.rounded.control
    variants: [primary_accent, secondary_soft, ghost_icon]
    icon_required_for_commands: true
  segmented_control:
    height: 46
    background: tokens.colors.surface-muted
    selected_background: tokens.colors.surface
    roundedRef: tokens.rounded.control
  chart:
    min_height: 320
    grid_color: tokens.colors.border-subtle
    bar_radius: 5
    axis_label_color: tokens.colors.text-secondary
  table:
    header_height: 48
    row_height: 72
    header_background: tokens.colors.surface-muted
    border: tokens.colors.border-subtle
  status:
    roundedRef: tokens.rounded.status-pill
    positive_background: "#e9fbf2"
    neutral_background: tokens.colors.status-neutral
    negative_background: "#fff0f5"
modules:
  global_toolbar:
    confidence: observed
    render_policy: prd_only
    placement: page_top
    alignment: search_left_filters_right
  primary_summary:
    confidence: observed
    render_policy: prd_only
    placement: below_toolbar
    layout: dark_stage_with_action_cluster
  quick_actions:
    confidence: observed
    render_policy: prd_only
    placement: embedded_in_primary_summary_when_related_otherwise_independent_section
    item_count: 3-6
  primary_content_panel:
    confidence: observed
    render_policy: prd_only
    placement: after_primary_summary
    layout: large_content_area_with_optional_side_stack
  metric_grid:
    confidence: observed
    render_policy: prd_only
    placement: after_primary_content
    item_count: 3-6
  detail_surface:
    confidence: observed
    render_policy: prd_only
    placement: lower_grid
    layout: wide_detail_panel_plus_supporting_panel
---

# Soft Bordered Analytic Workbench DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这是一套用于高密度工作台和分析型首页的视觉 DNA：浅色画布、软边框面板、深色摘要舞台、轻网格主内容区和等高信息卡共同形成稳定首屏。

PRD 决定页面要呈现什么内容、有什么功能、信息优先级如何；本文件只约束 UI 风格、布局气质、组件形态、状态和响应式规则。

默认强调色可以替换为任意主题色，但只改变小面积强调、图表序列、状态辅助色和 focus ring，不改变深色摘要舞台、浅色背景、软边框、稳定网格和高密度构图。

它适合需要快速扫描状态、对比趋势、查看明细并执行少量命令的界面；不适合低信息量品牌叙事、沉浸式内容展示或强营销落地页。

编码结果必须具备精细边框、稳定面板高度、清晰数字层级、图标化扫描点和轻量图表纹理，不能退化成普通后台套路。

## 2. 使用边界

PRD 决定内容、功能、信息架构、业务优先级、模块是否存在，以及每个模块的真实字段和交互目标。

DESIGN.md 只负责视觉 DNA、布局气质、组件形态、密度、状态、响应式和可访问性。没有 PRD 支撑的模块不要为了填满画面而新增；没有量化信息时不要强行生成大号数字；没有列表数据时不要伪造表格。

禁止复用非 PRD 的具体业务字段、示例数值、人名、机构名、分类名、品牌表达或页面专属文案。所有内容都必须来自 PRD，或使用中性占位槽位等待 PRD 填充。

## 3. 设计风格选择与换色逻辑

当页面需要在首屏内同时承载搜索/筛选、核心摘要、高频操作、图表或主内容面板、并列指标卡和明细列表时，优先选择该风格。

不要把默认强调色理解成视觉 DNA。视觉 DNA 是“浅背景 + 软边框 + 深色摘要舞台 + 稳定模块栅格 + 小面积高亮”的机制，主题色只能替换强调色相与派生状态色。

主题色可改写 `brand`、`brand-strong`、`brand-soft`、`focus-ring`、图表主辅色和状态辅助色。背景、白色表面、中性文字、浅边框、大圆角、等高网格、主次分栏和留白节奏必须保持。

不要把主题色铺满页面背景、普通卡片底色或大面积信息面板；强调色应集中在主按钮、图标底、趋势符号、图表关键序列、选中态和 focus ring。

## 4. 视觉 DNA

`command_toolbar` 保证页面开场轻、快、可操作。顶部控件应低高度横向排列，搜索、筛选、导出等命令采用白底浅边框，不做厚重导航栏。缺失时界面会变成普通模块堆叠，首屏任务感不足。

`dark_summary_stage` 是首屏视觉锚点。它用深色横向大面板承载最高优先级摘要和相关命令，主信息必须左对齐并用大号数字或短文本突出，右侧操作组保持紧凑。主题色替换后仍应保持深色高对比区，而不是把整个舞台改成浅色卡片。

`chart_with_side_insights` 建立主内容的分析质感。左侧大区域用于趋势、分布、进度或等价主内容；右侧窄列用于摘要、状态解释或分组洞察。若 PRD 不需要图表，可用同等高度和细节密度的主内容面板替代，但仍保留左大右小的稳定分栏。

`equal_metric_grid` 控制卡片密集区的秩序。并列摘要卡必须同高，标题、图标、主值和辅助说明的相对位置固定。主题色只影响图标、趋势和局部状态，不能把每张卡变成不同颜色的大色块。

`split_detail_surface` 用于承载细节信息。宽主面板适合表格、事件流、对象列表或记录流；窄辅助面板适合补充对象、摘要、图示或快捷查看。缺失时页面会缺少从宏观到明细的落点。

## 5. 视觉品质基线

轻量顶部命令栏在存在全局搜索、筛选、时间范围、导入导出或页面级命令时必须落地。控件高度统一，边框极浅，图标前缀和键盘提示可作为精致细节；不要让顶部区域比主内容更重。

深色摘要舞台在存在核心状态、主摘要或最高优先级操作时必须落地。舞台可以承载一个主摘要，也可以承载少量并列摘要，但必须保留横向稳定构图和低对比装饰纹理。

轻网格主内容面板在存在趋势、分布、对比、进度或时间序列时必须落地。图表容器需要固定高度，轴线和网格线只做轻辅助，主序列与辅序列形成明确对比。

侧向洞察摘要栈在主内容需要解释或拆解时落地。每个摘要块由图标、标题、主值和状态组成，分隔线控制节奏；如果 PRD 没有摘要，可替换为同等密度的短列表或说明块。

等高指标卡组在三到六个并列摘要项出现时落地。所有卡片同高同宽，避免因内容长短造成错位；长标题截断或换行后仍不能推高单张卡片。

精致明细承载面在存在表格、列表、事件流、对象清单或近期记录时落地。表头、行高、状态标签、图标容器和工具栏要一起设计，不能只套默认表格。

## 6. 布局规则

推荐槽位顺序为 `global_toolbar`、`primary_summary`、`primary_content_panel`、`metric_grid`、`detail_surface`。这些槽位不是业务结构要求，PRD 没有的模块不要强行补齐。

页面画布使用浅背景或白色背景，主体宽度尽量铺满容器但保留 24-32px 外边距。模块之间使用父级 `gap` 控制节奏，避免在子组件上堆零散 margin。

主 grid 必须使用 `align-items: stretch`。同一行面板等高，卡片和面板设置 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`。长内容在内部滚动、截断或折叠，不允许撑破父级。

主内容面板建议桌面端使用 2.2:1 到 2.6:1 的左右分栏；指标卡使用三列或四列等高 grid；底部明细区使用约 2:1 的宽窄分栏。移动端按优先级纵向堆叠，保留摘要舞台在前。

固定格式区域必须定义稳定尺寸：顶部命令栏约 48px，高优先级摘要舞台约 170px，主内容面板约 430px，指标卡约 150px，表格行约 72px。

## 7. PRD 槽位映射

| PRD 内容类型 | 推荐槽位 | 视觉处理 |
| --- | --- | --- |
| 页面级搜索、筛选、日期、导出、创建等命令 | `global_toolbar` | 左侧输入或主筛选，右侧组合操作，控件同高浅边框 |
| 最高优先级状态或主摘要 | `primary_summary` | 深色横向舞台，大号主信息，相关命令靠右成组 |
| 高频快捷入口 | `quick_actions` | 由 PRD 决定是否出现；可嵌入摘要舞台，也可独立成组 |
| 趋势、对比、分布、进度 | `primary_content_panel` | 左侧大图表或等价主内容，右侧摘要栈可选 |
| 三到六个并列摘要项 | `metric_grid` | 等高软边框卡片，图标标题、主值、辅助说明层级固定 |
| 表格、记录流、对象清单、事件明细 | `detail_surface` | 宽主面板承载明细，工具栏在标题右侧，行高稳定 |
| 补充对象、预览、概览图示、附属信息 | `supporting_panel` | 窄辅助面板，与明细面板同高，内部可滚动或截断 |

没有量化指标时，不强造数字；没有图表数据时，用同等品质的主内容面板替代；没有明细数据时，用空状态或摘要说明替代，仍保持面板尺寸稳定。

## 8. 组件规则

卡片和面板使用白色表面、1px 浅边框、20px 左右圆角和极轻阴影。卡片内部留白以 24-28px 为主，内容密集但不贴边。

摘要和指标组件以大号主值或短句为视觉中心，标题为 18-20px 中等字重，辅助说明为 14-16px 次级色。趋势或状态符号必须同时使用颜色、箭头/图标或文本，不只依赖颜色。

图表使用轻网格、圆角柱形、低噪坐标标签和明确主辅色。图例、tooltip、悬停态和空数据状态都要设计；图表容器不能无固定高度。

表格和列表使用浅灰表头、稳定行高、细分隔线和图标化行首扫描点。状态标签使用低饱和背景，文字颜色与背景对比达标。

输入、按钮和筛选控件高度保持 44-48px。按钮应优先使用图标加短文本；纯图标按钮必须有可访问名称和 tooltip。主按钮使用强调色实底，次级按钮使用白底或半透明底。

快捷入口是否渲染由 PRD 决定。出现时应是独立入口组或与核心摘要强相关的操作组，不要塞进表格工具栏或侧栏尾部来凑数量。

所有组件都要覆盖 hover、focus、loading、empty、error、disabled、selected 状态。focus ring 使用主题色派生 token，但不改变组件尺寸。

## 9. 响应式与可访问性

桌面端优先使用 12 列或 CSS grid 布局。宽屏保留顶部命令栏、深色摘要舞台、主内容分栏和底部宽窄分栏；中屏将指标卡降为两列；移动端所有主模块单列堆叠。

移动端顶部命令栏允许横向滚动或折叠为图标命令组，触控目标不小于 44px。深色摘要舞台的操作组可换行，但不能遮挡主摘要。

长表格在小屏使用横向滚动或转换为列表卡片。图表应保留最小高度和必要标签，避免坐标文字重叠。

可访问性要求包括：纯图标按钮提供 `aria-label`，焦点态清晰可见，状态不只靠颜色表达，文本与背景对比满足 WCAG AA，动画尊重 `prefers-reduced-motion`。

## 10. 禁止项

- 禁止复制具体业务字段、示例数值、人名、机构名、分类名、品牌表达或页面专属文案。
- 禁止让 DESIGN.md 覆盖 PRD 的内容、功能和信息优先级决策。
- 禁止把输入主题色铺满页面背景、普通卡片底色、指标卡底色或大面积面板。
- 禁止把默认强调色误当成视觉 DNA。
- 禁止使用默认后台质感：粗糙边框、无节奏留白、随意阴影、原生表格、缺少图标化扫描点。
- 禁止瀑布流、自由高度卡片、无固定高度图表容器、长内容撑破父级和零散 margin 拼接。
- 禁止用过大的英雄标题、营销式说明卡或装饰性大图替代真实工作台首屏。

## 11. Agent 使用提示

先阅读 PRD，确认真实内容、模块优先级和交互目标；再读取主题色输入，替换强调色 token；最后套用本视觉 DNA。

不要硬套槽位，不要凭空创造内容。PRD 没有主摘要、图表、快捷入口、指标卡或明细数据时，应删除对应模块或用 PRD 中同等层级的内容替代。

主题色只改变小面积强调色、图表序列、状态辅助色和 focus ring，不改变浅色画布、白色面板、深色摘要舞台、软边框、等高栅格、分栏结构和组件密度。

实现时优先保证稳定尺寸、精细边框、图标化行首、轻网格图表、统一控件高度、完整交互状态和响应式折叠。交付前必须按自检清单逐项检查。

## 12. 交付自检清单

- 内容、字段、文案、数据和模块是否全部来自 PRD。
- 是否保留顶部轻量命令栏、深色摘要舞台、主内容分栏、等高卡片和明细承载面的核心 DNA。
- 主题色是否只改写强调色、图表序列、状态辅助色和 focus ring。
- 背景、表面、中性文字、浅边框、圆角、网格和面板尺寸是否保持稳定。
- 品质锚点是否按 PRD 条件落地，缺失模块是否使用同等品质替代。
- 主 grid 是否 `align-items: stretch`，同一行面板是否等高。
- 卡片、图表、表格和列表是否有稳定高度、内部滚动、截断或折叠策略。
- hover、focus、loading、empty、error、disabled、selected 状态是否完整。
- 移动端是否单列可读，横向滚动是否只用于必要表格或命令组。
- 纯图标按钮、状态颜色、焦点态、文本对比和 reduced motion 是否符合可访问性要求。
