---
version: alpha
template_type: visual_dna_preset
name: aqua-service-progress-dashboard
design_id: aqua-service-progress-dashboard
design_status: draft
description: "适用于服务进度、资源状态、媒体支持、位置上下文和报告分析混合呈现的水青色柔和仪表盘视觉 DNA。"
scenes: [dashboard, service_portal, operations_overview, progress_tracking, resource_center]
density: medium
layout: airy_multi_panel_service_dashboard
tone: [soft, reassuring, spacious, data_rich, aqua]
tags: [aqua_dashboard, gradient_status_card, media_panel, map_context, progress_chart]
avoid: [dense_crm_table, finance_terminal, dark_big_screen, marketing_landing_page]
selection:
  best_for: [服务门户, 进度追踪页, 资源状态页, 支持中心, 综合概览页]
  user_intent: [查看今日更新, 追踪进度, 进入服务资源, 查看位置或空间上下文, 阅读报告趋势]
  visual_tone: [大留白, 水青强调, 柔和浅色卡片, 渐变状态卡, 可信服务感]
  avoid_for: [纯表格后台, 高压交易页面, 暗色大屏, 密集筛选管理台]
policies:
  prd_first: true
  content_neutral: true
  no_source_locked_content: true
  quick_actions_rendered_by_prd: true
  theme_can_change_hue_not_dna: true
visual_dna:
  - id: airy_status_header
    name: 宽松状态头部
    confidence: observed
    hooks: [large_title, subtitle, compact_metric_badges, circular_icon_badges]
    invariant: [左侧用超大轻字重标题和副标题建立亲和感, 右侧使用横向小指标徽章, 指标图标在白色圆形浮层中, 顶部不使用厚导航条]
    variable: [标题内容, 指标数量, 图标语义, 指标单位, 主题色]
  - id: schedule_or_timeline_column
    name: 左侧日程时间列
    confidence: observed
    hooks: [date_strip, vertical_time_axis, time_pill, schedule_card, participant_stack]
    invariant: [左侧卡片内有淡化日期条, 纵向时间轴连接时间胶囊, 内容卡使用浅色底和圆角, 行内可放头像或操作图标]
    variable: [时间粒度, 节点内容, 数量, 附加人员或对象, 跳转操作]
  - id: progress_score_panel
    name: 大号进度评分面板
    confidence: observed
    hooks: [large_percent, segmented_progress_bar, mini_metric_tiles, striped_remaining_area]
    invariant: [中心主面板突出一个大号进度数字, 下方用分段条和斜线剩余区表示进程, 右侧或上方嵌入浅色小指标 tile]
    variable: [数值格式, 分段数量, 指标 tile 数量, 进度语义, 主题色]
  - id: gradient_status_chart_card
    name: 渐变状态图表卡
    confidence: observed
    hooks: [gradient_card, translucent_bar_chart, white_text, rounded_chart_bars]
    invariant: [右上强调卡使用水平方向渐变和大圆角, 白色文本叠加, 内部图表为半透明圆角竖条, 周期标签低对比]
    variable: [状态标题, 周期粒度, 图表数值, 强调色相, 辅助信息]
  - id: media_and_context_tiles
    name: 媒体与上下文卡片
    confidence: observed
    hooks: [media_card, overlay_badge, map_panel, floating_label, area_chart]
    invariant: [下方区域用媒体卡、面积图和地图/空间上下文面板混合, 叠加信息使用毛玻璃或半透明胶囊, 所有面板保持大圆角与轻阴影]
    variable: [媒体类型, 图表类型, 空间背景, 浮层内容, 操作入口]
theme_adaptation:
  accepts_theme_color: true
  strategy: replace_hue_preserve_visual_mechanism
  input: theme_color
  replace_tokens: [tokens.colors.brand, tokens.colors.brand-strong, tokens.colors.brand-soft, tokens.colors.focus-ring]
  derive_tokens: [tokens.colors.gradient-start, tokens.colors.gradient-end, tokens.colors.chart-fill, tokens.colors.timeline-active, tokens.colors.overlay-tint]
  preserve_tokens: [tokens.colors.bg-page, tokens.colors.surface, tokens.colors.surface-muted, tokens.colors.text-primary, tokens.colors.text-secondary, tokens.colors.border-subtle]
  rules:
    - theme_color_only_changes_accent_hue
    - preserve_airiness_and_soft_surfaces
    - keep_gradient_card_as_single_accent_area
    - do_not_tint_all_panels
tokens:
  colors:
    bg-page: "#F7F8F8"
    surface: "#FFFFFF"
    surface-muted: "#EFF8F8"
    text-primary: "#2A2E32"
    text-secondary: "#6B7178"
    text-tertiary: "#A6ADB4"
    border-subtle: "#E8EEEE"
    brand: "#39B9B5"
    brand-strong: "#087D8D"
    brand-soft: "#E7F7F6"
    gradient-start: "#7EDFD2"
    gradient-end: "#08738A"
    chart-fill: "#55BFC1"
    timeline-active: "#3DBDB9"
    overlay-tint: "rgba(255,255,255,0.68)"
    focus-ring: "#9BE5DF"
  typography:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    page-title: { fontSize: 52, fontWeight: 400, lineHeight: 1.1, letterSpacing: 0 }
    panel-title: { fontSize: 30, fontWeight: 500, lineHeight: 1.25, letterSpacing: 0 }
    hero-number: { fontSize: 72, fontWeight: 500, lineHeight: 1, letterSpacing: 0 }
    body: { fontSize: 16, fontWeight: 400, lineHeight: 1.45, letterSpacing: 0 }
    caption: { fontSize: 13, fontWeight: 400, lineHeight: 1.35, letterSpacing: 0 }
  spacing:
    page-x-desktop: 36
    page-y-desktop: 40
    grid-gap: 32
    panel-x: 32
    panel-y: 28
  rounded:
    panel: 28
    card: 22
    control: 999
    media: 22
  shadow:
    panel: "0 12px 40px rgba(33,65,68,0.05)"
    floating: "0 12px 28px rgba(33,65,68,0.12)"
layout_stability:
  grid_align_items: stretch
  panel_display: flex-column
  panel_height: "100%"
  overflow_policy: internal_scroll_or_truncate
  spacing_policy: parent_gap_only
  equal_height_rule: same_row_panels_align
  fixed_height_tokens:
    left_schedule_panel: 500px
    media_panel: 440px
    progress_panel: 500px
    gradient_card: 500px
    report_panel: 430px
    context_panel: 430px
quality_anchors:
  - id: soft_status_header_badges
    name: 柔和状态头与圆形指标徽章
    required_when: PRD 提供页面问候、状态摘要或顶部指标
    rule: 顶部使用大标题和右侧圆形图标指标，不得变成密集导航栏。
  - id: vertical_time_axis_card
    name: 纵向时间轴卡
    required_when: PRD 包含预约、阶段、节点或时段安排
    rule: 时间胶囊、细轴线、浅色内容卡和头像/操作细节必须共同出现。
  - id: segmented_progress_score
    name: 分段进度评分
    required_when: PRD 包含进度、评分、完成度或路径推进
    rule: 大号数字、分段进度条、小指标 tile 和斜纹剩余区共同构成主视觉。
  - id: aqua_gradient_status_card
    name: 水青渐变状态卡
    required_when: PRD 有一个需要突出展示的计划、状态或周期目标
    rule: 渐变卡只能作为单个强调区域，内部图表半透明，文本白色。
  - id: contextual_media_tiles
    name: 媒体与上下文混合卡
    required_when: PRD 包含媒体、地图、空间、资源位置或服务入口
    rule: 媒体和上下文卡使用叠加胶囊、浮动标签和轻阴影，不做平铺图片。
quality_floor:
  target: polished_sample_level
  avoid_default_admin_feel: true
  requires_visible_micro_detail: true
  minimum_craft_signals: [large_light_title, circular_metric_badges, vertical_time_axis, segmented_progress, gradient_status_card, translucent_overlays]
components:
  panel: { surface: tokens.colors.surface, rounded: tokens.rounded.panel, shadow: tokens.shadow.panel }
  gradient_card: { rounded: tokens.rounded.panel, background: "linear-gradient(135deg, tokens.colors.gradient-start, tokens.colors.gradient-end)" }
  time_pill: { height: 42, rounded: tokens.rounded.control, surface: tokens.colors.brand }
  progress_bar: { height: 88, segmentRadius: 12, remainingPattern: diagonal_stripes }
  media_card: { rounded: tokens.rounded.media, overlay: tokens.colors.overlay-tint }
modules:
  quick_actions:
    confidence: inferred
    render_policy: prd_only
    placement: media_or_context_panel_overlay_or_independent_section
    item_count: 2-6
  timeline:
    confidence: observed
    render_policy: prd_only
    placement: left_column
  context_panel:
    confidence: observed
    render_policy: prd_only
    placement: right_lower_or_supporting_panel
---

# Aqua Service Progress Dashboard DESIGN.md

> front matter 是给流程和生成器读取的结构化配置；人工评审优先阅读下方正文。若两者冲突，风格选择、换色策略和 token 数值以前面的 YAML 为准，使用边界和业务取舍以正文为准。

## 1. 快速理解

这个视觉 DNA 是水青色、宽松、柔和的综合服务仪表盘。它把顶部状态徽章、左侧时间轴、中心进度评分、右侧渐变状态卡、下方媒体和上下文面板组合在一起。PRD 决定内容是否存在，DESIGN.md 只规定视觉承载方式。主题色可以改变水青色相，但不能破坏大留白、柔和面板、渐变强调卡和叠加浮层机制。

## 2. 使用边界

适用于服务门户、进度追踪、资源支持、位置上下文、报告概览等页面。不适合纯表格后台、高压交易台、密集筛选页面或暗色大屏。禁止复制视觉材料中的具体行业、人员、项目、指标名、数值、位置名和服务文案。

## 3. 设计风格选择与换色逻辑

当 PRD 有“状态摘要 + 时间节点 + 进度评分 + 资源入口 + 上下文地图或媒体”的结构时选择该风格。主题色只改写徽章、时间轴、渐变卡、进度条和图表填充；白色面板、浅背景、低饱和边界、大圆角和透明叠层保持。

## 4. 视觉 DNA

`airy_status_header` 用大标题和圆形指标徽章建立温和入口。`schedule_or_timeline_column` 用淡化日期条、时间胶囊和轴线承载节点。`progress_score_panel` 用超大数字、分段条和浅色 tile 形成主状态。`gradient_status_chart_card` 作为单个高饱和视觉锚点。`media_and_context_tiles` 用媒体、面积图、地图或空间上下文增强沉浸感。

## 5. 视觉品质基线

顶部指标必须轻，不要做成厚重 KPI 卡。时间轴要有线、胶囊、内容卡和操作细节。进度面板不能只放百分比，要有分段条和斜纹剩余区。渐变卡只能出现为单一强调区域。媒体和上下文卡要使用浮层，不要裸图。

## 6. 布局规则

```text
page_shell
  airy_status_header
  dashboard_grid
    left_column: timeline + media
    center_column: progress + report
    right_column: gradient_status + context
```

桌面端三列，中心列最宽。主 grid `align-items: stretch`。每个面板 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`。媒体和地图固定比例，内部浮层绝对定位但不能遮挡核心内容。

## 7. PRD 槽位映射

| PRD 内容类型 | 视觉槽位 | 规则 |
| --- | --- | --- |
| 页面状态和摘要指标 | `airy_status_header` | 大标题加圆形徽章，不做厚卡。 |
| 时间、阶段、排程 | `timeline` | 纵向轴线和时间胶囊。 |
| 进度、评分、完成度 | `progress_score_panel` | 大数字、分段条、小 tile。 |
| 重点计划或目标 | `gradient_status_card` | 单个渐变强调卡。 |
| 媒体、地图、资源上下文 | `media_and_context_tiles` | 使用叠加浮层和空间感。 |

## 8. 组件规则

面板圆角 28px，阴影柔和。图标用线性水青图标。时间胶囊高度 42px。进度条分段圆角，剩余区斜纹。渐变卡文本使用白色，图表半透明。媒体卡浮层用毛玻璃或半透明底。面积图使用淡网格和渐变填充。

## 9. 响应式与可访问性

桌面三列，中宽两列，移动单列。媒体卡保持固定宽高比。触控目标不小于 44px。渐变卡对比度必须达标。状态不能只靠颜色，需要文字、图标或形状。

## 10. 禁止项

- 禁止复制具体行业内容、人员、数值、地点、项目和服务文案。
- 禁止把主题色铺满所有卡片。
- 禁止多个高饱和渐变卡争抢层级。
- 禁止裸媒体、裸地图、默认图表。
- 禁止自由高度卡片和零散 margin。

## 11. Agent 使用提示

先读 PRD，确认是否有时间节点、进度、资源入口和上下文信息。再应用主题色，保留水青柔和机制。不要凭空创建媒体、地图或状态卡；只有 PRD 支持时才渲染。实现必须保留大留白、圆形徽章、分段进度、渐变锚点和叠加浮层。

## 12. 交付自检清单

- 内容是否来自 PRD。
- 是否保留适用的时间轴、进度、渐变卡、媒体上下文 DNA。
- 主题色是否只改写强调区域。
- 是否避免默认后台感。
- 布局、高度、响应式和可访问性是否达标。
