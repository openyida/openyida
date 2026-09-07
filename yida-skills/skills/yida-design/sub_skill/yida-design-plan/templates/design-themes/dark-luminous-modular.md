---
name: "{{PROJECT_NAME}}"
description: 以近黑画布、分层暗面板、微光数据纹理和条件式主辅拼图构成中高密度、高对比且克制的视觉主题。
themeId: dark-luminous-modular
tokens:
  application-global:
    colors:
      "--color-white": "#181818"
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值：与白色混合 10%，用于悬停>"
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值：与 #181818 混合 76%，用于品牌浅色>"
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值：与 #101010 混合 90%，用于浅层导航框架>"
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值：降低明度约 18%，用于深层导航框架>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值：降低明度约 10%，用于激活和按下>"
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值：与 #181818 混合 58%，用于禁用>"
      "--color-line1-1": "#292929"
      "--color-line1-2": "#3B3B3B"
      "--color-fill1-1": "#202020"
      "--color-fill1-2": "#252525"
      "--color-fill1-3": "#303030"
      "--color-fill1-10": "rgba(28, 28, 28, 0.96)"
      "--color-text1-4": "#F5F5F5"
      "--color-text1-10": "#B8B8B8"
      "--color-text1-3": "#777777"
    typography:
      base:
        "--font-family-base": "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 600
        "--font-lineheight-subhead": 1.3
      body-2:
        "--font-size-body-2": 16px
        "--font-weight-body-2": 600
        "--font-lineheight-body-2": 1.45
      body-1:
        "--font-size-body-1": 14px
        "--font-weight-body-1": 400
        "--font-lineheight-body-1": 1.5
      table:
        "--font-size-table": 14px
        "--font-weight-table": 500
        "--font-lineheight-table": 1.45
      caption:
        "--font-size-caption": 12px
        "--font-weight-caption": 400
        "--font-lineheight-caption": 1.4
    spacing:
      "--s-1": 4px
      "--s-2": 8px
      "--s-3": 12px
      "--s-4": 16px
      "--s-6": 20px
      "--s-8": 24px
    rounded:
      "--corner-zero": 0px
      "--corner-1": 4px
      "--corner-2": 8px
      "--corner-3": 12px
      "--corner-4": 16px
      "--corner-5": 20px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#101010"
      "--oyd-brand-glow-soft": "<基于 --color-brand1-6 生成的实际色值：主题色 18% + 透明 82%，用于局部辉光>"
      "--oyd-brand-chart-strong": "<基于 --color-brand1-6 生成的实际色值：与白色混合 6%，用于主图形>"
      "--oyd-brand-chart-muted": "<基于 --color-brand1-6 生成的实际色值：主题色 46% + 透明 54%，用于次图形>"
      "--oyd-brand-chart-area": "<基于 --color-brand1-6 生成的实际色值：主题色 14% + 透明 86%，用于面积填充>"
    typography:
      metric-primary:
        "--font-size-metric-primary": 30px
        "--font-weight-metric-primary": 500
        "--font-lineheight-metric-primary": 1.18
      chart-emphasis:
        "--font-size-chart-emphasis": 40px
        "--font-weight-chart-emphasis": 500
        "--font-lineheight-chart-emphasis": 1.1
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以近黑无彩画布承载一组轻微抬升的暗色模块，依靠 1px 弱边界、内侧柔光和极低透明度阴影建立层级，而不是依靠大面积色块。首层可由等宽指标卡形成微光摘要带；主要内容在契约满足时采用约 2:1 的主辅拼图，主面板承载带细网格与面积雾化的多序列趋势，辅面板承载分段环或竖向步骤列表；下层结构化明细保持低对比行底与精确数字对齐。主题色只用于关键曲线、活跃节点、短条和少量图标辉光，深色表面与高亮文字关系始终不变。

### 风格定位与应用说明

- 核心气质是“低照度舞台上的精确微光”：整体中高密度、卡片内部留白克制、信息对比集中在数值与图形焦点。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 代表性构图迁移到其他页面时保留暗面层级、微光焦点、主次对比、细网格和紧凑信息节奏，不复制具体指标、品类、步骤或固定模块顺序。
- 缺少图表数据时将发光描边迁移到进度、选中态或时间轴；缺少主辅内容时回退 PRD 的单列结构。任何会新增业务指标、报告入口或步骤数据的迁移均降级为 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 低照度分层暗面 | 近黑画布上叠放略亮面板，边界和阴影都极弱，面板内部仍有可辨层级。`observed` | 不可变：画布、一级表面、嵌套表面至少三级明度；可变：模块内容与数量。复用 `--oyd-page-background`、`--color-white` 与 Fill Token。 | 退化为纯黑平面或高灰卡片堆叠，暗色质感与层级同时消失。 |
| 微图嵌入指标卡 | 等宽摘要卡内同时出现标签、主值、趋势说明、图标与迷你趋势纹理。`observed` | 不可变：主值左上、微图右下、趋势贴底、图标置于柔光区域；可变：数据语义和微图类型。使用固定卡高与 SVG/canvas 小图。 | 指标卡退化为只有数字的通用卡，首屏缺少细节密度。 |
| 发光双轨网格 | 主图使用细密暗网格、两条同色相不同强度曲线、轻面积雾化与悬浮对齐线。`observed` | 不可变：主序列高亮、次序列降权、网格克制、tooltip 与定位线共同出现；可变：序列数量不超过三条、数据和轴语义。 | 退化为默认图表库样式，线条与背景没有空间感。 |
| 外置标注分段环 | 分段圆环留出明显间隙，关键值居中，少量标签悬浮在环外，底部以短条图例收束。`observed` | 不可变：圆角弧段、分段间隙、中心值、外置短标与底部对齐图例；可变：2-5 个分段及文案。 | 退化为普通饼图或满环仪表，失去辨识度和层次。 |
| 条件式主辅拼图 | 宽主面板与窄辅助列组合，辅助列再纵向分层，底部明细与上方网格对齐。`observed` | 不可变：仅在主数据与独立辅助数据同时存在时使用约 2:1 分栏；可变：各槽位内容。CSS Grid 统一 gap 与拉伸。 | 强制分栏会制造空洞；无分栏则失去聚焦与辅助阅读节奏。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 微图指标卡带 | `content_contract`: PRD 提供 2-6 个同层级摘要值及趋势或变化信息 | `render_policy: prd_match_only`；`direct_trigger`: 摘要值可横向比较且存在最小时间序列 | `transferable_mechanism`: 固定高暗卡、主值优先、右下微图、底部趋势；`adaptation_targets`: `primary_metrics` | `fallback`: 无趋势时移除微图但保留结构；`forbidden`: 不得编造时间序列或变化值 |
| 发光双轨网格 | `content_contract`: PRD 提供带共同横轴的 1-3 条连续序列 | `render_policy: prd_match_only`；`direct_trigger`: 需要比较趋势、目标或基准 | `transferable_mechanism`: 细暗网格、主次线、面积雾化、定位线；`adaptation_targets`: `primary_content_panel`、已有图表槽 | `fallback`: 数据不连续时改柱、点或列表；`forbidden`: 不得伪造序列、预测或百分比 |
| 外置标注分段环 | `content_contract`: PRD 提供 2-5 个构成整体的分类值 | `render_policy: adapt_existing_slot`；`direct_trigger`: 分类总量具有明确整体关系 | `transferable_mechanism`: 圆角弧段、环外短标、中心值与短条图例；`adaptation_targets`: `supporting_panel`、现有占比组件 | `fallback`: 不满足整体关系时改排序条；`forbidden`: 不得强行归一化无关数据 |
| 主辅拼图骨架 | `content_contract`: PRD 同时存在一个主要可视槽和一组独立辅助槽 | `render_policy: adapt_existing_slot`；`direct_trigger`: 主内容需要聚焦且辅助内容可独立阅读 | `transferable_mechanism`: 2:1 分栏、右侧纵向堆叠、统一面板边线；`adaptation_targets`: `primary_content_panel` + `supporting_panel` | `fallback`: 契约不成立时单列或按页面模式布局；`forbidden`: 不得为保持分栏新增辅助模块 |
| 暗面结构化明细 | `content_contract`: PRD 提供多字段对象集合或步骤序列 | `render_policy: adapt_existing_slot`；`direct_trigger`: 内容需要逐行扫描和比较 | `transferable_mechanism`: 低对比行底、左侧识别锚、右侧数值、末端微趋势；`adaptation_targets`: `detail_table`、`detail_list` | `fallback`: 字段少时使用紧凑列表；`forbidden`: 不得新增列、缩略图或趋势字段 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；本主题保留平台变量名，但将基础表面语义映射为深色：`--color-white` 在本主题中承担全应用一级暗表面，而不是字面白色。`tokens.custom-page` 只补充近黑画布、主题辉光与三档主题派生图形色，以及全局字体层级缺少的指标数字和图表强调值；弱网格复用 `--color-line1-1`，常规浮层复用 `--color-fill1-10`，不重复声明。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 画布消费 `--oyd-page-background`（当前值 `#101010`），一级表面消费 `--color-white`（当前值 `#181818`），普通嵌套填充消费 `--color-fill1-1`（当前值 `#202020`）；文字依次消费 `--color-text1-4`、`--color-text1-10`、`--color-text1-3`。括号内色值仅说明本主题当前取值，组件实现禁止硬编码。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅层导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深层导航框架背景 | `--color-brand1-5` | 应用全局 |
| 主按钮、关键焦点、主曲线和选中强调 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、表格行线和图表网格 | `--color-line1-1` | 应用全局 |
| 控件与一级面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层画布 | `--oyd-page-background` | 自定义页 |
| 一级暗面板、卡片和表单容器 | `--color-white` | 应用全局 |
| 图标井、节点和局部边缘柔光 | `--oyd-brand-glow-soft` | 自定义页 |
| 图表主序列与关键短条 | `--oyd-brand-chart-strong` | 自定义页 |
| 图表次序列与非主分段 | `--oyd-brand-chart-muted` | 自定义页 |
| 图表面积雾化填充 | `--oyd-brand-chart-area` | 自定义页 |
| 菜单悬停、弱标签和嵌套暗底 | `--color-fill1-1` | 应用全局 |
| 菜单点击和中性选中底 | `--color-fill1-2` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 坐标轴、时间和次要说明 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 来自前置确定的全应用主题色，先解析为实际色值；AI 再以它为唯一品牌色种子生成其余 Brand Token。最终项目 `design.md` 必须写入七个 Brand Token 的实际色值，不得保留生成期标记。没有品牌色时选择在近黑背景上达到至少 4.5:1 对比的明亮交互色作为锚点；换色后仍保持约 82% 暗中性表面、12% 文字与边界、6% 主题辉光和图形焦点的面积关系。

### 本主题的配色约束

- `--color-white`、`--color-line1-1`、`--color-line1-2`、`--color-fill1-1`、`--color-fill1-2`、`--color-fill1-3`、`--color-text1-4`、`--color-text1-10`、`--color-text1-3` 与 `--oyd-page-background` 均为固定 `neutral-gray`，Hex 三通道相等；`--color-fill1-10` 也是无彩透明层。
- `--oyd-brand-glow-soft`、`--oyd-brand-chart-strong`、`--oyd-brand-chart-muted`、`--oyd-brand-chart-area` 均由 `--color-brand1-6` 派生，实例化时必须写入实际色值；它们是主题同色演变，不是独立分类色。
- 主题色只用于主操作、关键焦点、选中状态、主图形和少量图标辉光；不得用主题色铺满画布或普通面板。
- 成功、警告、错误和信息状态直接消费平台语义色，并同时配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 同一图表最多三条主题派生序列；外部分类色仅在 PRD 明确要求区分类别且同色相无法满足辨识时使用，面积不超过可视区 10%。
- 默认强调色可被任意合法主题色替换；换色不改变近黑画布、面板明度阶、发光强度、圆角、网格密度或主辅构图。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base.--font-family-base` 定义的字体栈。
- 视觉材料原始尺寸为 2174×1810、工具展示尺寸为 1728×1438；viewport、DPR、浏览器缩放和导出倍率未知，因此字号按平台 Token 范围推断，不按图片物理像素换算。
- `page-title` 消费 `tokens.application-global.typography.subhead`：`--font-size-subhead: 24px`、`--font-weight-subhead: 600`、`--font-lineheight-subhead: 1.3`。
- `panel-title` 消费 `body-2`：16px / 600 / 1.45；内容标题与正文消费 `body-1`：14px / 400 / 1.5。
- 表格与结构化列表消费 `table`：14px / 500 / 1.45；轴标签、趋势说明和元信息消费 `caption`：12px / 400 / 1.4。
- 主要指标消费 `tokens.custom-page.typography.metric-primary`：30px / 500 / 1.18；主图内独立强调值消费 `chart-emphasis`：40px / 500 / 1.1。二者是全局层缺失的数据展示语义，不覆盖页面或面板标题。
- 数值启用 `font-variant-numeric: tabular-nums`；标签单行省略，说明最多两行，长内容在面板内部滚动或进入详情。
- 图标使用 1.5px 线宽、圆角端点和 18-20px 视图盒；图标默认消费高对比文字色，柔光只作为背景，不降低轮廓可读性。

## 布局与间距

- 页面安全边距使用 `--s-3` 或 `--s-4`，主要模块间距使用 `--s-4`，卡片网格 gap 使用 `--s-3`，卡内 padding 使用 `--s-4`，图标与文本使用 `--s-2`。
- 内容容器建议 `max-width: 1720px; margin-inline: auto; min-width: 0`；所有区块间距由父级 grid/flex 的 `gap` 管理。
- 指标卡带仅在 PRD 有 2-6 个同层摘要值时出现；宽桌面等分为 4-6 列，较窄桌面自动折为 2-3 列，小屏单列或双列。
- 主辅拼图仅在主要可视槽和独立辅助槽同时存在时使用：宽桌面 `grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr)`；辅助列内部垂直堆叠。契约不成立时采用 PRD 的单列、列表、表单或详情结构。
- 页面标题、全局操作、主要内容和辅助内容是否出现及其顺序由 PRD 和页面模式决定；页面结构只使用 `page_identity`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table`、`detail_list` 等中性槽位。

### 布局稳定性硬规则

- 桌面端主网格必须使用 `align-items: stretch`，同一行同类面板顶部和底部对齐；禁止瀑布流和 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题区固定，内容区使用 `flex: 1; min-height: 0`。
- `metric_card` 建议高度 196-220px；`chart_panel` 建议 520-640px；`detail_panel` 建议 360-460px；辅助环形面板建议 360-430px；可选 `quick_action_item` 高度 72-88px。
- 图表、表格、列表和长文案必须在面板内部滚动、截断或折叠，不得撑破外层网格；主图绘图区高度固定 360-440px，微图高度固定 56-72px。
- 区块间距由父级 grid/flex 的 `gap` 管理，不用零散 `margin-top`、`margin-bottom` 拼接页面节奏。
- ≥1440px 可执行指标横排与 2:1 主辅分栏；960-1439px 指标折为两列、主辅比改为 3:2；640-959px 主辅上下堆叠且辅助面板双列；<640px 全部单列、图表高度降至 300px、表格内部横向滚动。移动端可解除桌面等高，但保留控件高度、截断与溢出策略。

## 表面与层级

- 页面画布必须消费 `--oyd-page-background`，一级面板必须消费 `--color-white`，普通嵌套块消费 `--color-fill1-1`，悬停、选中或需要提高层级的嵌套块消费 `--color-fill1-2`；面板弱边界使用 `1px solid var(--color-line1-1)`，常规阴影为 `0 10px 28px rgba(0,0,0,0.24)`。这些 Token 的当前值以 YAML 为唯一事实源，组件实现不得直接写入 Hex。
- 面板可增加 `inset 0 1px 0 rgba(255,255,255,0.025)` 形成精细内缘；主题辉光只允许围绕图标井、活跃节点和图形端点，范围 18-32px、透明度受 `--oyd-brand-glow-soft` 控制。
- tooltip 与 popover 复用 `--color-fill1-10`，边界为 `--color-line1-2`，阴影 `0 14px 36px rgba(0,0,0,0.42)`；背景模糊只用于浮层，普通面板不使用玻璃效果。
- 嵌套层级优先使用明度与 1px 分隔线，不无限叠加阴影；一个面板内最多一层可见嵌套卡。

## 圆角与形状

- `--corner-1` 用于图例短条、进度端点和微型标记；`--corner-2` 用于 28-32px 控件、表格缩略图和 tooltip；`--corner-3` 用于图标井、筛选器和嵌套块；`--corner-4` 用于一级面板；`--corner-5` 仅用于大幅聚焦容器。
- `--corner-circle` 用于圆点、节点和纯圆图标底；`--corner-semicircle` 用于短状态胶囊、环外标注和紧凑计数。
- 折线端点与分段环端帽保持圆润，细网格保持直线；圆角只柔化容器和图形端部，不将所有内容胶囊化。
- 同一网格层级使用一致圆角，禁止随机混用直角、小圆角和超大圆角。

## 组件

### 按钮与操作

- 迷你/行内按钮高 28px、紧凑工具栏按钮高 32px、常规按钮高 36px、强调操作高 40px；图标按钮使用对应档位的正方形尺寸，禁止其他高度或超过 40px。
- 主按钮使用 `--color-brand1-6` 与高对比文字；次按钮使用 `--color-fill1-1`、`--color-line1-2` 和 `--color-text1-4`。同一操作区只保留一个视觉主操作。
- hover 消费 `--color-brand1-1`，active 消费 `--color-brand1-9`，disabled 消费 `--color-brand1-10` 并保留边界；focus 使用 2px 主题色外环加 2px 暗色间隔。
- 图标与文字间距为 `--s-2`，纯图标按钮必须提供可访问名称与 tooltip。

### 输入与筛选控件

- 紧凑工具栏控件高 32px、常规表单控件高 36px、宽松搜索和选择器高 40px；背景 `--color-fill1-1`、边界 `--color-line1-2`、圆角 `--corner-3`。
- 输入值消费 `--color-text1-4`，placeholder 消费 `--color-text1-10`；focus 提升主题边界并出现柔光，error 使用平台错误色加文字说明。
- 搜索、时间筛选和视图选择组成紧凑工具组；不得把每个筛选器做成发光主按钮。

### 卡片与面板

- 一级面板使用 `--color-white`、1px 弱边界、`--corner-4` 和低扩散暗阴影；嵌套块使用 `--color-fill1-1` 或 `--color-fill1-2`，不重复阴影。
- 标题区高 48-56px，内容区 `flex: 1; min-height: 0`；标题与操作两端对齐。面板 padding 使用 `--s-6`，高密度列表可收为 `--s-4`。
- 不把每段内容包成独立卡；图例、工具提示和行项目通过明度、分隔线和局部填充区分。

### 微图指标卡带

- 公式：左上标签 → 下方主值 → 左下变化信息；右上图标井 → 右下固定高度微图。卡片保持 196-220px 等高。
- 微柱宽 6-8px、间距 5-7px、圆角端帽；微线最多两条，主线消费 `--oyd-brand-chart-strong`，次线消费 `--oyd-brand-chart-muted`，面积消费 `--oyd-brand-chart-area`。
- 图标井为 40px 圆角块，使用 `--oyd-brand-glow-soft`，轮廓不低于 3:1 对比。趋势同时显示方向和文字，不只依赖颜色。

### 发光双轨网格

- 公式：面板标题与轻量筛选 → 独立强调值 → 细网格绘图区 → 主次双线与面积雾化 → 悬浮定位线、双节点和紧凑 tooltip → 低对比轴标。
- 网格消费 `--color-line1-1`，透明度控制在 35%-55%；主线 2.5px，次线 1.5px，曲线平滑但不得过度圆滑掩盖数据变化。
- tooltip 同时列出相关序列，宽度 136-184px；垂直定位线与节点保持同一 x 坐标。不得用默认白底 tooltip 或高亮整列背景。
- 数据点常态隐藏，只在 hover、键盘聚焦和关键节点显示；面积填充只在主序列下方，底部透明归零。

### 外置标注分段环

- 公式：2-5 个圆角弧段组成开放间隙圆环 → 中心展示一个核心值 → 1-3 个短标签悬浮环外 → 底部等宽图例块与短进度线。
- 圆环宽度为外径的 10%-13%，分段间隙 8-12px；同色相强弱由主色派生，最弱弧段仍须与暗底区分。
- 外置标签使用高对比中性表面和深色文字，不使用大面积主题色；标签必须通过位置或引导关系与弧段对应。
- 当分类超过五个或标签过长时改用排序条形图，禁止压缩成难读碎环。

### 条件式主辅拼图

- 公式：宽主面板占约 2/3，窄辅助列占约 1/3；辅助列按内容分成 1-2 张等宽面板，下层明细与主列边线对齐。
- 仅在主要可视内容和独立辅助内容同时存在时使用；无辅助内容时主面板全宽，不保留空列。
- 同一行使用 `align-items: stretch`，辅助列内部使用 `grid-auto-rows: minmax(0, 1fr)`；小屏按主要内容、辅助摘要、辅助明细顺序堆叠。

### 图表或主内容面板

- 连续趋势优先使用发光双轨网格；构成关系优先使用外置标注分段环；离散比较使用圆角短柱。图表类型由数据语义决定，不为主题记忆点强行转换。
- 图例使用 8px 圆点或 20-28px 短线，靠近绘图区；轴文字使用 `--color-text1-3`，关键数值使用 `--color-text1-4`。
- 图表容器必须有确定高度，并在 resize 后重新计算；加载态保持坐标区和标题区尺寸不变。

### 表格与列表

- 表头高 44px、背景与面板同色或 `--color-fill1-1`；正文行高 60-68px，行线使用 `--color-line1-1`。首行或选中行可使用 `--color-fill1-2`，不得整表高亮。
- 首列使用 32-36px 识别图标或缩略图；文字列左对齐、数值列右对齐、趋势列固定宽度。数值启用等宽数字。
- 竖向步骤列表使用 40px 圆形图标井、主标签、次趋势和尾部数值；每行保持单一识别焦点。
- 长标题单行省略，说明最多两行；表格在面板内部横向滚动，首要识别列可黏附。

### 快捷入口（推断）

- `confidence: inferred`，`render_policy: recipe_only`。仅当 PRD 有明确高频入口时，以 72-88px 暗色条目实现，图标井使用局部柔光，标题与说明纵排。
- 快捷入口不得塞进图表图例或表格表头；移动端单列，禁止彩色宫格和持续脉冲辉光。

### 状态与交互

- 悬停：面板边界由 `--color-line1-1` 提升到 `--color-line1-2`，局部辉光增强约 20%，持续 180ms，不改变尺寸。
- 按下：按钮使用 100-140ms 明度反馈；卡片不整体缩放，避免暗面网格抖动。
- 聚焦：控件显示清晰 focus ring；图表节点可键盘访问并显示同等 tooltip；纯图标按钮必须有可访问名称。
- 加载：保持指标卡、图表和列表固定高度，以暗色骨架与稳定占位替代内容。
- 空态与错误：保留原面板结构，以高对比说明和一个合法操作引导下一步，不把整面板染成状态色。
- 禁用与选中：通过边界、图标、文字和状态词共同表达，不只依赖透明度或辉光。
- 动效：使用 160-220ms `cubic-bezier(.2,.8,.2,1)`；数值更新可短暂淡入，禁止循环闪烁。`prefers-reduced-motion` 下移除线条绘制、面积过渡和辉光扩散。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题是否可用。原生页面和自定义页面共同继承深色全局 Token、按钮、输入、面板、表格和状态语言；图表、指标卡和主辅拼图仅在真实内容满足契约时落地。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉表达，不能强行把所有页面改造成同一种页面结构。没有图表的页面仍通过近黑画布、暗面明度阶、精确分隔、局部主题焦点和紧凑排版保持一致。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化最终项目 `design.md` 时，只展开项目真实存在的页面；每页说明主要中性槽位的位置、跨度、高度、移动端顺序和采用的视觉 DNA。页面不必使用全部组件母体，但采用对应信息类型时必须遵守构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；没有素材时使用结构化数据或中性占位，不编造客户、对象、指标或图片地址。

## 设计规范与禁忌

### 必须做到

- 全应用无条件保护近黑画布、三级暗面明度、弱边界、高对比文字和小面积主题辉光。
- 内容契约满足时，微图指标卡必须保持固定构图；双轨图必须保护细网格、主次线、面积雾化与定位 tooltip；分段环必须保护间隙、中心值、外置标注和底部图例。
- 主辅分栏仅在主要内容与独立辅助内容同时存在时启用，并在窄屏按同一契约有序折叠。
- 同类面板等高、图表高度固定、长内容内部处理、父级 gap 统一；图形和文字必须达到暗色背景可访问对比。
- hover、active、focus、loading、empty、error、disabled、selected 和 reduced motion 必须完整，图表焦点可键盘访问。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景、普通面板或大面积区域；禁止把默认色相误当成视觉 DNA。
- 禁止把 2:1 分栏、右侧辅助列、指标带或模块顺序写成所有页面无条件执行的结构。
- 禁止将三级暗面压成单一纯黑，禁止用高亮边框包围所有卡片，禁止把柔光升级为霓虹外发光。
- 禁止把双轨网格替换成默认白底 tooltip、粗网格或彩虹多序列；禁止把分段环替换成无间隙饼图。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、无依据装饰、持续闪烁和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：所有暗色层级都用纯黑或在组件中硬编码 Hex；正确：依次消费 `--oyd-page-background`、`--color-white`、`--color-fill1-1`，交互层消费 `--color-fill1-2`，并以 `--color-line1-1` 建立弱边界。
- 错误：指标卡只保留大数字；正确：契约满足时固定标签、主值、趋势、图标井与微图的五点构图。
- 错误：图表使用高亮粗网格和彩色多线；正确：细暗网格、单主题主次线、轻面积雾化和对齐 tooltip。
- 错误：构成数据使用无间隙饼图；正确：2-5 个圆角弧段、外置短标、中心值与底部图例共同表达。
- 错误：所有页面强制使用代表性分栏；正确：内容契约成立时使用主辅拼图，否则保留 PRD 页面模式并迁移暗面层级与微光语言。
- 错误：主题色铺满页面；正确：主题色只连接主操作、关键焦点、图形强调与选中状态，其余表面保持暗中性。
- 错误：卡片随内容自由增高形成瀑布流；正确：同类卡片固定高度、网格拉伸，长内容内部滚动或截断。
- 错误：快捷入口使用默认彩色宫格；正确：仅由 PRD 触发并继承暗面、弱边界和局部柔光。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token 与主题派生图形 Token。所有真实页面先继承深色全应用 Token 和基础组件语言，再按内容契约选择可落地的视觉记忆点。主辅拼图、微图指标卡、双轨网格和分段环只作为视觉配方，不用于枚举项目不存在的指标、分类、步骤或数据；主题色只替换色相，不改变近黑画布、三级暗面、构图、密度、圆角、辉光强度和交互机制。不匹配时迁移表面、边界、排版与焦点语言，不创造业务内容。

### 交付自检

- [ ] 全部页面内容和模块是否来自 PRD，而非模板来源？
- [ ] 画布、一级面板和嵌套表面是否保持三级暗面明度，而非单一纯黑？
- [ ] 微图指标卡是否保持标签、主值、趋势、图标井和微图的固定构图？
- [ ] 双轨网格是否包含细网格、主次序列、轻面积、定位线、节点和紧凑 tooltip？
- [ ] 分段环是否限制为 2-5 段，并保留间隙、圆角端帽、中心值、外置标注和底部图例？
- [ ] 主辅拼图是否只在主要内容与独立辅助内容同时存在时启用？
- [ ] 每个视觉记忆组件是否都有 `content_contract`、`render_policy`、迁移目标和无匹配回退策略？
- [ ] 固定列数、主辅比例、辅助列和模块顺序是否具有内容契约，且未被写成全页面硬规则？
- [ ] 未被 PRD 触发的组件是否没有强行渲染，视觉迁移是否没有新增业务内容？
- [ ] 主操作、关键焦点、主图形和选中状态是否共享 `--color-brand1-6`，其余表面保持暗中性？
- [ ] `application-global` 的变量名和消费语义是否稳定，具体值是否依据当前主题生成？
- [ ] 全局与自定义页 Token 属性是否全部使用以 `--` 开头的完整 kebab-case 名称？
- [ ] `custom-page` 是否逐项通过全局语义复用检查，没有同值同义或角色重叠的重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、视觉 DNA、组件标题和正文总结是否没有绑定默认色相？
- [ ] `themeId` 和描述是否只表达视觉机制，没有把某种页面任务或业务领域写成主题身份？
- [ ] 描述中的中高密度、高对比、弱边界、暗面层级和克制辉光是否与 Token 和正文一致？
- [ ] 是否没有建立适用/不适用产品形态清单，页面类型只用于视觉解读？
- [ ] 所有真实页面是否共享全应用 Token 和基础组件语言，视觉记忆点是否只按内容契约条件式落地？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在的页面？
- [ ] 主题同色演变是否由 `--color-brand1-6` 派生；独立分类色是否角色明确；平台状态色是否未在 `custom-page` 重复声明？
- [ ] 所有固定灰色 Token 是否为 `neutral-gray` 且满足三通道相等；是否没有未声明的偏色灰？
- [ ] 同类面板是否等高对齐，图表是否有固定高度，长内容是否在内部处理？
- [ ] 快捷入口如有生成，是否由 PRD 触发并继承本主题的组件语言？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引发布局跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 和主题派生图形 Token 的实际色值？
