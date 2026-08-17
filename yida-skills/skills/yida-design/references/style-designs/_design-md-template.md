---
version: alpha
name: <风格或系统名称，可用英文 slug>
description: <内容中立的中文用途说明>
design_id: <design-id>
design_status: draft
scenes: [工作台, 首页]
density: high
layout: <preferred archetype or custom layout；工作台默认紧凑双栏/三栏，不用低密大卡墙>
tone: <视觉气质关键词>
tags: [<业务领域>, <角色>, <数据形态>]
avoid: [<不适合场景>]
visual_dna:
  - name: <可识别的设计记忆点名称>
    confidence: observed
    evidence: <参考图中可见的中文证据>
    rule: <生成新 UI 时必须如何保留它>
    implementation_hooks: [<布局/组件/token/CSS/图表钩子>]
    failure_mode: <缺失该 DNA 时会出现的风格漂移>
colors:
  bg-outer: "#..."
  surface: "#..."
  surface-muted: "#..."
  text-primary: "#..."
  text-secondary: "#..."
  border-subtle: "#..."
  brand: "#..."
surfaceContrast:
  rule: <页面背景与卡片背景必须有明显层次，不可相近或相同>
  pairing: <white-bg-bordered-card / gray-bg-white-card / tinted-bg-white-card / gradient-bg-glass-card>
  pageBackground: <浅色背景色或渐变>
  cardBackground: <白色、浅色或玻璃 rgba>
  cardBorder: <白色/浅色背景时必须写边框；浅灰/浅彩背景时可 none；玻璃卡片写半透明边框>
  forbidden: <浅底白卡无边框、同色背景同色卡片、只靠弱阴影区分层级>
typography:
  page-title:
    fontFamily: "..."
    fontSize: ...
    fontWeight: ...
    lineHeight: ...
    letterSpacing: 0
spacing:
  page-x: <默认 20-28；平台导航可见时避免过宽边距>
  page-y: <默认 20-28；首屏内容要上移，避免标题下大空白>
  grid-gap: <默认 12-18；卡片和卡片的 gap 必须小于 20>
  section-gap: <默认 14-18；用于跨区块呼吸和分组，不用于撑空白>
  card-x: <默认 22-28；卡片 padding 必须大于 20>
  card-y: <默认 22-28；卡片 padding 必须大于 20；列表/摘要类不是卡片时可更紧>
  row-y: <默认 10-12>
breathingRule:
  rhythm: <说明首屏主区、列表区、右侧上下文和操作条之间如何形成呼吸节奏>
  sectionGap: <默认 14-18；卡片之间的 gap 必须小于 20>
  innerPadding: <默认 22-28；卡片 padding 必须大于 20，控件和文字不能贴边>
  compression: <内容不足时压缩高度/转薄行/补上下文动作，不用空白撑版面>
rounded:
  sm: <默认 0-8>
  md: <默认 10-16>
  card: <范围 0-32；业务卡片默认 20-24>
  panel: <范围 0-32；主容器/抽屉/重点面板默认 22-32>
  pill: 999
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-y} {spacing.card-x}"
  empty-state:
    density: compact
    maxHeight: <默认 88-120；列表内薄空态，不使用大空白白卡>
  metric-strip:
    height: <默认 64-88；内容对齐，不做横跨全屏的空矩形>
inferred_modules:
  quick_actions:
    required_for: [工作台, 仪表盘, 管理后台, 运营首页]
    confidence: inferred
    rule: <基于整体视觉风格推断的快捷入口区域规则>
---

# <风格名称> DESIGN.md

## 1. 总览

用 2-4 个短段落说明可复用设计意图。保持内容中立，只说明气质、信息密度、主要用途和页面组织方式。

## 2. 适用场景

列出适合和不适合使用该风格的场景。

## 3. 视觉氛围

说明运营工具感/表达型、克制/戏剧化、密度、留白、专业度等取向。

默认业务工具页应是“圆润、紧凑、有呼吸感、有内容承接”的现代 B 端界面：圆角默认偏大，信息密度默认 high，留白服务阅读、分组和扫读节奏，不用于撑页面面积。只有官网、品牌页、展示页或用户明确要求舒展时，才把 density 调到 medium / comfortable。

## 4. 视觉 DNA / 设计母体

提取 2-5 个内容替换后仍必须保留的设计记忆点。每个 DNA 必须包含名称、证据、规则、实现钩子、失败表现和置信度。

## 5. 色彩角色

用表格列出 token、取值和用途，覆盖背景、表面、文字、边框、品牌色、状态色和图表序列。

## 6. 字体规则

定义字体栈、字号体系、行高、字重和数字排版。不要使用 viewport width 缩放字体，默认 `letter-spacing: 0`。

## 7. 布局原则

说明页面壳、最大宽度、网格比例、间距、内容顺序和中性槽位关系。

工作台、门户首页、管理后台和运营首页必须优先使用紧凑状态摘要、任务/记录列表、右侧上下文和高频动作条。页面布局要有呼吸感：主区、右栏、工具条和列表之间保留稳定间距，文字和按钮不贴边，区块之间有清晰分组；首屏不能出现超宽但内容很少的 KPI 横框、孤立大空态卡或右侧大面积留白；空白区域必须用最近记录、动态、风险、负责人、下一步动作、配置提示或薄空态行动承接。

## 8. 层级与深度

说明深度来自平面表面、边框、阴影、色调层、毛玻璃、覆盖层或空间效果，并说明哪些地方不该使用阴影。

页面背景与卡片背景必须形成明显层次对比，不可相近或相同。背景色默认保持浅色调，确保整体视觉清爽，同时与卡片之间有清晰层次：白色/浅色背景使用有边框卡片；浅灰色背景（如 `#F3F4F6`）使用白色无边框卡片；浅彩色背景（如浅蓝、浅暖灰）使用白色无边框卡片；渐变色背景使用玻璃感卡片。不得输出浅底白卡无边框、同色背景同色卡片，或只靠弱阴影区分层级。

## 9. 形状

定义圆角尺度，以及每个尺度分别用于哪里。

默认形状语言是圆润但不低密：卡片圆角范围 0-32px，业务卡片/面板默认 20-24px，主面板/抽屉/重点区域默认 22-32px，按钮和输入框 10-14px，标签/状态胶囊 999px。卡片 padding 必须大于 20px，卡片之间的 gap 必须小于 20px；圆角服务形状性格，不用空白卡撑版面。

## 10. 组件样式

覆盖顶部栏、按钮、图标按钮、卡片/面板、输入框/选择器、表格/列表、图表、标签/徽标、快捷入口、空状态、弹窗/浮层。相关组件要包含 default、hover、active、focus、disabled、loading、selected、error 等状态。

组件默认密度和呼吸规则必须写到可实现数值：状态摘要 64-88px 高，动作条 40-56px 高，列表行 44-56px，高频按钮 36-40px，卡片 padding 默认 22-28px 且必须大于 20px，卡片之间的 gap 默认 12-18px 且必须小于 20px。空状态默认嵌在列表/面板内部，使用薄提示行、补录/刷新/新建动作和简短说明；不得用 160px 以上大白卡只显示“暂无数据”。

## 11. 快捷入口区域

工作台、仪表盘、管理后台或运营首页必须输出快捷入口区域规则。说明位置、容器、条目、数量、图标、文字、状态、响应式、与 DNA 的关系和禁止漂移。

## 12. 页面结构配方

提供 2-4 个使用中性槽位的布局配方，例如 `primary_metrics`、`quick_actions`、`trend_panel`、`detail_table`、`status_note`。

## 13. 状态与交互

列出 hover、active、focus、loading、empty、error、disabled、selected、mobile 和 reduced motion 规则。

## 14. 响应式

定义断点和布局折叠方式。说明文字适配、工具栏换行、表格横向滚动和触控目标尺寸。

## 15. 可访问性

要求对比度、focus 状态、纯图标控件标签、非纯颜色状态表达、键盘可访问和 reduced motion。

## 16. 实现适配

只包含相关适配，例如 CSS 变量、Ant Design ConfigProvider、Tailwind class 映射、Yida / YidaCodeCanvas 容器重置或 React 组件建议。

## 17. 必须包含

列出硬性正向要求。每个视觉 DNA 都必须作为明确必选规则出现。

## 18. 禁止项

列出硬性负向约束，覆盖会抹掉每个 DNA 的错误做法。

## 19. 错误 vs 正确

用短对照保护视觉 DNA 和快捷入口风格继承。

## 20. Agent 使用提示

提供一段简洁提示词，明确告诉 AI 如何使用该 DESIGN.md。必须说明视觉 DNA 在内容替换后也要保留。

## 21. 交付自检清单

- [ ] 源图业务内容已抽象为中性槽位。
- [ ] 文档识别了 2-5 个视觉 DNA / 设计母体。
- [ ] 每个 DNA 都包含证据、规则、实现钩子、失败表现和置信度。
- [ ] DNA 已同步进入必须包含、禁止项、错误 vs 正确、Agent 使用提示和最终自检。
- [ ] 若页面类型是工作台、仪表盘、管理后台或运营首页，文档已包含快捷入口区域。
- [ ] 可推断的 token 已给出具体值。
- [ ] 页面背景与卡片背景已形成明显层次对比，并写清 `surfaceContrast` 搭配方案。
- [ ] 组件包含状态规则，而不只是静态外观。
- [ ] 已明确卡片圆角范围：0-32px，并说明业务卡片、主面板、控件和状态胶囊各自取值。
- [ ] 已明确紧凑密度默认值：状态摘要、动作条、列表行、空态高度、卡片 padding >20px、卡片 gap <20px 都有数值范围。
- [ ] 已明确呼吸感规则：跨区块间距、组内内距、贴边修正和内容不足时的压缩/补充策略都有数值或规则。
- [ ] 工作台/首页首屏没有超宽空 KPI 框、大空态白卡、无内容右栏或靠 margin/padding 撑出的空白。
- [ ] 响应式和可访问性规则完整。
- [ ] 不依赖原截图，也能指导生成一个新页面。
