---
name: "{{PROJECT_NAME}}"
description: 以柔和中性画布、深色聚焦舞台、半透明信息组和主题色派生数据纹理构成克制而鲜明的层次化界面主题。
themeId: dark-focus-layered
tokens:
  application-global: # 全应用 Token，原生页面和自定义页面共同使用
    colors:
      "--color-white": "#FFFFFF" # 全应用基础表面色
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值>" # 悬停色
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值>" # 品牌浅色，保留平台既有消费关系
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值>" # 浅色导航框架背景色
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值>" # 深色导航框架背景色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 前置确定的全应用主题主色
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值>" # 激活、按下状态色
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值>" # 禁用状态色
      "--color-line1-1": "#E8E8E8" # neutral-gray；弱边界、图表辅助线和表格行分隔线
      "--color-line1-2": "#DADADA" # neutral-gray；控件和容器常规边界
      "--color-fill1-1": "#F4F4F4" # neutral-gray；菜单悬停和弱状态填充
      "--color-fill1-2": "#ECECEC" # neutral-gray；点击或中性选中填充
      "--color-fill1-3": "#E3E3E3" # neutral-gray；更重的中性填充
      "--color-fill1-10": "rgba(18, 18, 18, 0.94)" # neutral-gray；气泡浮层背景色
      "--color-text1-4": "#171717" # neutral-gray；默认一级文字色
      "--color-text1-10": "#8A8A8A" # neutral-gray；表头和 placeholder
      "--color-text1-3": "#6F6F6F" # neutral-gray；二级文字色
    typography:
      base:
        "--font-family-base": "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 600
        "--font-lineheight-subhead": 1.2
      body-2:
        "--font-size-body-2": 16px
        "--font-weight-body-2": 500
        "--font-lineheight-body-2": 1.4
      body-1:
        "--font-size-body-1": 14px
        "--font-weight-body-1": 400
        "--font-lineheight-body-1": 1.5
      table:
        "--font-size-table": 13px
        "--font-weight-table": 400
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
      "--s-6": 24px
      "--s-8": 32px
    rounded:
      "--corner-zero": 0px
      "--corner-1": 4px
      "--corner-2": 8px
      "--corner-3": 12px
      "--corner-4": 18px
      "--corner-5": 24px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page: # 页面专属 Token，仅在指定自定义页生效
    colors:
      "--oyd-page-background": "#F7F7F7" # neutral-gray；固定中性画布，不随主题色变化
      "--oyd-surface-soft": "#F3F3F3" # neutral-gray；固定中性弱表面
      "--oyd-stage-top": "#121212" # neutral-gray；固定中性深色舞台基底
      "--oyd-stage-bottom": "<由 --color-brand1-6 与 --oyd-stage-top 混合生成的低明度实际色值>"
      "--oyd-stage-card": "rgba(255, 255, 255, 0.10)"
      "--oyd-stage-border": "rgba(255, 255, 255, 0.28)"
      "--oyd-heat-1": "<由 --color-brand1-6 与白色混合生成的 8% 强度实际色值>"
      "--oyd-heat-2": "<由 --color-brand1-6 与白色混合生成的 20% 强度实际色值>"
      "--oyd-heat-3": "<由 --color-brand1-6 与白色混合生成的 38% 强度实际色值>"
      "--oyd-heat-4": "<由 --color-brand1-6 与白色混合生成的 68% 强度实际色值>"
      "--oyd-heat-5": "<与 --color-brand1-6 一致的实际色值>"
      "--oyd-chart-deep": "#161616" # neutral-gray；固定中性深色图表材质
      "--oyd-chart-stripe": "<基于 --color-brand1-6 生成的实际色值>"
      "--oyd-chart-pale": "<由 --color-brand1-6 与白色混合生成的 16% 强度实际色值>"
    typography: # 仅补充全局字体体系没有的指标数字语义
      metric-primary:
        "--font-size-metric-primary": 32px
        "--font-weight-metric-primary": 500
        "--font-lineheight-metric-primary": 1.1
      data-emphasis:
        "--font-size-data-emphasis": 20px
        "--font-weight-data-emphasis": 600
        "--font-lineheight-data-emphasis": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题面向 SaaS 分析工作台、运营看板和数据洞察页。柔和中性画布承托大圆角白色分析面板，首屏用一块横向深色聚焦摘要舞台建立明确视觉重心；舞台内部通过半透明深色指标单元、细亮边界和底部主题色派生辉光形成层次。下方数据区以同色相离散热力矩阵、斜纹/深色/浅色三组对比柱和高密度明细表构成精致数据纹理。页面强调清楚的标题工具带、稳定双列网格和小面积主题色，不使用官网式 Hero、超大字号或大号 CTA。

### 适用范围

- 适用于分析工作台、运营看板、指标概览、趋势洞察、成员或对象分析、行为矩阵和带明细记录的管理页面。
- 列表、详情、表单和流程页面可继承画布、Token、圆角、按钮和表格语言，但不强制复制摘要舞台与全部图表。
- 不适用于官网落地页、内容阅读页、沉浸式深色监控、极高密度专业终端或以复杂录入为唯一任务的页面。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 中性灰画布上的白色分析浮岛 | 页面底色为中性浅灰，数据模块使用纯白大圆角面板，阴影极弱，主要靠明度差与留白分层。`observed` | 画布消费 `--oyd-page-background`，一级面板消费 `--color-white`、`--corner-5` 和极弱中性阴影；主题色变化不得染色普通面板。 | 会退化成纯白后台页面，丢失柔和画布和精致浮岛感。 |
| 深色聚焦横向摘要舞台 | 首屏存在一块全宽深色渐变舞台，顶部保留标题说明，底部排列多个半透明指标单元，并在下沿形成主题色派生光带。`observed` | `summary_stage` 使用中性 `--oyd-stage-top` 到由 `--color-brand1-6` 派生的低明度同色相渐变；指标单元消费 `--oyd-stage-card`、`--oyd-stage-border` 和白色文字。换色时只重算派生光带，不改变深色舞台与横向指标阵列。 | 页面会变成普通白色 KPI 卡组，失去最强视觉识别点和首屏聚焦。 |
| 同色相热力矩阵与离散色阶 | 主分析区使用规则小方格表达二维强度分布，色阶从近白中性色过渡到当前主题色，顶部带筛选和离散图例。`observed` | `intensity_matrix` 使用由 `--color-brand1-6` 派生的 5 档 `--oyd-heat-1 / --oyd-heat-2 / --oyd-heat-3 / --oyd-heat-4 / --oyd-heat-5` 色阶、统一小圆角单元、固定行列间距和清楚的横纵标签；数据和维度由 PRD 决定。 | 若替换为普通折线图或连续彩虹热图，页面会失去精密、可扫描的矩阵纹理。 |
| 纹理化三柱对比 | 辅助分析面板以三根宽柱表达并列比例：一根主题色斜纹、一根深色实心、一根浅色实心，标签悬浮于柱顶。`observed` | `ratio_triptych` 保留三类材质、统一圆角、底部对齐和顶部浮动标签；颜色可随主题同色相适配，但斜纹/深色/浅色的材质对比不可改变。 | 会退化为普通同色柱图，失去鲜明材质差和小面板记忆点。 |
| 圆角表头与图标化明细行 | 明细区使用白色大面板、弱化表头、图标化身份列、双行主次信息和克制行分隔。`observed` | `insight_table` 使用固定工具带、44-48px 表头、52-60px 行高、13px 表格字号和 24-28px 图标容器；状态和数值稳定对齐。 | 会回落为组件库默认表格，破坏页面精致度和扫描节奏。 |

### 视觉记忆点应用策略

| 视觉记忆组件 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 午夜摘要舞台 | `content_contract`：PRD 存在一个首要概览，以及 3-6 个可并列的摘要、状态或指标。 | `render_policy: adapt_existing_slot`；`direct_trigger`：存在 `primary_summary` 与 `primary_metrics`，或同义概览槽位。 | `transferable_mechanism`：深色横向舞台、底部同色相辉光、半透明信息单元；`adaptation_targets`：现有概览区、状态总览或高优先摘要组。 | `fallback: recipe_only`；没有概览与并列摘要时不生成舞台。`forbidden`：编造 KPI、角色、用户数、金额或趋势。 |
| 同色相热力矩阵 | `content_contract`：PRD 提供二维离散强度数据，例如时间×类别、对象×状态或其他矩阵维度。 | `render_policy: prd_match_only`；`direct_trigger`：存在合法二维矩阵数据和色阶语义。 | `transferable_mechanism`：由主题色派生的离散五档色阶、规则小方格、顶部图例和筛选；`adaptation_targets`：已有热力图、状态矩阵或活动矩阵。 | `fallback: recipe_only`；没有二维数据时不渲染。`forbidden`：伪造日期、类别、活动量或矩阵值。 |
| 纹理化三柱对比 | `content_contract`：PRD 存在 2-4 个可比较比例或同尺度数值。 | `render_policy: prd_match_only`；`direct_trigger`：存在合法比例比较或目标/实际/基准数据。 | `transferable_mechanism`：斜纹主题柱、深色实心柱、浅色实心柱和顶部浮动标签；`adaptation_targets`：已有比例比较、进度对比或小型柱图。 | `fallback: recipe_only`；无比例数据时不渲染。`forbidden`：伪造百分比、目标或比较组。 |
| 圆角图标化明细表 | `content_contract`：PRD 存在重复记录，以及可展示的主字段、辅助字段和数值/状态列。 | `render_policy: adapt_existing_slot`；`direct_trigger`：存在 `detail_table`、`detail_list` 或记录集合。 | `transferable_mechanism`：弱化圆角表头、图标化主列、双行信息和稳定数值列；`adaptation_targets`：现有表格、列表或任务记录。 | `fallback: recipe_only`；没有重复记录时不创建明细区。`forbidden`：编造姓名、机构、联系方式、字段、记录或操作。 |
| 胶囊分段筛选 | `content_contract`：PRD 存在两个或多个互斥视图、维度或时间范围。 | `render_policy: adapt_existing_slot`；`direct_trigger`：存在真实 tabs、segment 或 view switch。 | `transferable_mechanism`：固定 `neutral-gray` 胶囊容器、白色选中项和克制文字层级；`adaptation_targets`：现有筛选器、分段控件或视图切换。 | `fallback: recipe_only`；没有互斥视图时不添加切换。`forbidden`：编造筛选维度或隐藏页面。 |

- 每个页面优先清楚落地 1-3 个满足内容契约的主记忆点，不要求五个组件同时出现。
- 只能迁移视觉机制，不能借记忆组件新增 PRD 未要求的数据、对象、筛选、导出、操作或流程。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；字号变化先更新全局字体 Token，并严格遵守 `subhead ≤ 24px`。`tokens.custom-page` 只补充中性灰画布、摘要舞台、半透明指标单元、离散热力色阶、对比柱材质和全局体系没有的指标数字语义，不覆盖全应用 Token。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 柔和中性画布、纯白分析面板和深色聚焦摘要舞台构成三档主表面；主题派生浅色只承担弱数据纹理，不能替代中性表面。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；用于主操作、选中态、热力高阶和舞台光带 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、表格行分隔线和辅助线 | `--color-line1-1` | 应用全局 |
| 输入框、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层中性灰画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 分段控件、弱状态和内嵌工具区 | `--oyd-surface-soft` | 自定义页 |
| 摘要舞台深色上沿和同色相下沿 | `--oyd-stage-top` / `--oyd-stage-bottom` | 自定义页 |
| 舞台内半透明指标表面与亮边界 | `--oyd-stage-card` / `--oyd-stage-border` | 自定义页 |
| 离散热力矩阵五档色阶 | `--oyd-heat-1` 至 `--oyd-heat-5` | 自定义页 |
| 对比柱深色、斜纹和浅色材质 | `--oyd-chart-deep` / `--oyd-chart-stripe` / `--oyd-chart-pale` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 菜单点击和中性选中底 | `--color-fill1-2` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表格表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 来自前置确定的全应用主题色，先解析为实际色值；AI 再以它为唯一品牌色种子生成其余 Brand Token。最终项目 `design.md` 必须写入七个 Brand Token 及全部主题派生页面 Token 的实际色值，不得保留生成期标记。没有品牌色输入时由上游主题流程提供中性默认主色；换色时同步重建舞台下沿、热力矩阵色阶和斜纹柱，但保持“深色中性基底 + 同色相高亮 + 大面积中性表面”的消费关系。

### 本主题的配色约束

- 画布保持中性浅灰，常规分析面板保持纯白；所有固定中性灰必须满足 RGB 三通道相等，主题色不能铺满普通面板或页面背景。
- 本主题的画布、弱表面、文字、边界、阴影和深色基底均定义为 `neutral-gray`，不使用 `theme-gray`；它们不随 `--color-brand1-6` 改变。
- 摘要舞台以近黑中性色为主，主题色只在下沿辉光、内部渐变和少量选中态出现，不能把舞台改成整块高饱和纯色。
- 热力矩阵使用同一色相的五档离散明度，不引入彩虹色阶。
- 对比柱依赖材质差而非多色：主题斜纹、近黑实心和浅同色相实心。
- 状态色沿用平台语义色，并同时使用图标、文字或形状，不能只靠颜色。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 定义的一套无衬线字体。

```text
page-title → tokens.application-global.typography.subhead
panel-title → tokens.application-global.typography.body-2
content-title → tokens.application-global.typography.body-1
body → tokens.application-global.typography.body-1
table → tokens.application-global.typography.table
caption → tokens.application-global.typography.caption
metric-primary → tokens.custom-page.typography.metric-primary
data-emphasis → tokens.custom-page.typography.data-emphasis
```

- 页面标题消费全局 `subhead`：24px/600/1.2，不新增展示型大标题。
- 一级面板标题消费全局 `body-2`：16px/500/1.4；内容标题、正文和常规控件标签消费全局 `body-1`：14px/400/1.5。
- 表格消费全局 `table`：13px/400/1.45；说明、图例和辅助标签消费全局 `caption`：12px/400/1.4。
- 摘要舞台核心数字消费页面级 `metric-primary`：32px/500/1.1；图表顶部比例等重点数据消费 `data-emphasis`：20px/600/1.2。
- 数值统一启用 `font-variant-numeric: tabular-nums`；长文本单行截断并提供完整内容查看方式。
- 图标采用 16-18px 圆角线性风格；摘要指标图标可置于 28-32px 半透明圆角方形容器。

## 布局与间距

- 所有间距统一消费顶部 YAML 的 `--s-1` 至 `--s-8`；页面外边距 12-20px，主区块间距 20-24px，一级面板内边距 24px，舞台内边距 24-28px。
- 桌面端使用 12 列网格：标题工具带和摘要舞台跨 12 列；中部主分析面板占 7-8 列，辅助分析面板占 4-5 列；明细区跨 12 列。
- 标题位于左侧，日期、范围、导出或其他 PRD 操作位于右侧；操作组使用 8-12px gap，不挤压标题。
- 页面结构以 `page_identity / global_actions → primary_summary / primary_metrics → primary_analysis / supporting_analysis → detail_table` 为主，模块是否存在由 PRD 决定。

### 布局稳定性硬规则

- 主网格必须使用 `align-items: stretch`；同一行分析面板顶部和底部对齐，禁止瀑布流和 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题区固定，内容区使用 `flex: 1; min-height: 0`。
- 建议高度：`summary_stage` 260-300px，`metric_card` 112-136px，`analysis_panel` 340-400px，`detail_panel` 420-560px，推断的 `quick_action_item` 64-80px。
- 摘要舞台的指标单元在桌面端等高；空间不足时横向滚动或改为 2-3 列换行，不压缩到不可读宽度。
- 热力矩阵和对比柱必须有确定绘图区；表格和长列表在面板内部滚动，不撑高外层网格。
- 区块间距由父级 grid/flex 的 `gap` 管理，不使用零散 margin 拼接页面节奏。
- 1200-1439px 时中部改为 7/5 列；768-1199px 时分析面板改单列，摘要指标改为 2-3 列；小于 768px 时标题工具带换行、指标改单列或横向滚动、图表内部横向滚动、表格内部滚动，并解除桌面等高要求。

## 表面与层级

- 一级分析面板使用纯白、`--corner-5`、1px `--color-line1-1` 边界和不超过 `0 10px 30px rgba(24, 24, 24, 0.04)` 的极弱中性阴影。
- 摘要舞台使用 `--corner-5`、午夜渐变和底部主题色辉光，不再叠加外投影；舞台之外不得使用同等强度的深色大面板。
- 舞台指标单元使用半透明白色表面、1px 亮边界和极弱内高光，不使用强毛玻璃模糊。
- 热力矩阵单元使用主题色派生浅阶；分段筛选和顶部浮动标签使用中性表面，无明显阴影。
- tooltip 使用白色或近黑中性表面、`--corner-3` 和轻阴影；保证深浅场景下文字对比。

## 圆角与形状

- 一级舞台和分析面板使用 `--corner-5`；舞台指标、图表内框和大型筛选容器使用 `--corner-4`；输入、按钮、表头和 tooltip 使用 `--corner-3`。
- 分段控件、图例标签和浮动比例标签可以使用 `--corner-semicircle`；数据柱使用 12-16px 顶部圆角或完整圆角。
- 图标按钮和单点操作使用 `--corner-circle` 或 `--corner-3` 正方形；热力单元使用 `--corner-1` 或 `--corner-2`。
- 同一组件层级使用一致圆角，禁止随机混用直角、胶囊和超大圆角。

## 组件

### 按钮与操作

按钮只使用四档高度：迷你/行内 28px、紧凑工具栏 32px、常规 36px、强调或宽松场景 40px；图标按钮从同一四档中选择正方形尺寸，所有按钮不得超过 40px。页面顶部主操作使用 40px 深色实底或主题色实底，日期/日历等辅助图标按钮使用 40px 白色表面；常规页面操作默认 36px。按钮标签消费全局 `body-1`，图标 16-18px。同一操作组只保留一个视觉主操作。

### 输入与筛选控件

表单输入默认 36px，宽松搜索与选择器使用 40px，紧凑工具栏控件使用 32px。分段筛选使用 32px 高固定 `neutral-gray` 胶囊容器，选中项为白色或主题浅色表面。搜索按钮/输入边界消费 `--color-line1-2`，聚焦时消费主题色焦点环；错误状态使用独立语义色和说明文字。

### 卡片与面板

一级面板由固定标题工具带与自适应内容区组成，内边距 24px；面板标题与说明保持 4-8px 间距。卡片只用于摘要、图表、记录分组或明确对象，不把每段文字包成白卡。深色舞台内部指标单元使用等高 grid，标题和图标位于上行，核心数字位于下行。

### 深色聚焦摘要舞台（可见记忆点）

`summary_stage` 使用纵向深色渐变：顶部为 `--oyd-stage-top`，下沿过渡到由主题色派生的 `--oyd-stage-bottom`；可增加低透明径向光带但禁止霓虹外发光。舞台顶部为标题和一行辅助说明，底部为 3-6 个等高 `metric_card`。每个指标单元包含 28-32px 图标容器、14px 短标签和 32px 核心数字；单元背景为 `--oyd-stage-card`，边界为 `--oyd-stage-border`。没有 PRD 指标时不得生成虚构数字。

### 离散热力矩阵（可见记忆点）

`intensity_matrix` 由等尺寸小方格构成，单元建议 18-24px、gap 4-6px，使用 `--oyd-heat-1` 至 `--oyd-heat-5` 五档离散色阶。横纵标签固定在矩阵外侧，图例从低到高排列并与色阶一一对应。顶部可放 PRD 已有分段筛选。hover 显示 tooltip，键盘聚焦显示边界；无数据单元使用最浅档，不使用透明消失。

### 纹理化比例三柱（可见记忆点）

`ratio_triptych` 使用 2-4 根等宽粗柱，推荐三柱；柱底对齐，宽度 76-104px，柱顶使用 14-18px 圆角。第一材质为主题同色斜纹，第二为 `--oyd-chart-deep` 深色实心，第三为 `--oyd-chart-pale` 浅色实心。比例标签置于柱顶上方的小型浅色胶囊中，重点数字消费 `data-emphasis`。禁止改成彩虹柱、3D 柱、连续渐变或无数据装饰柱。

### 表格与列表

`insight_table` 使用固定标题工具带、44-48px 弱化表头、52-60px 行高和无竖向分隔线结构。主信息列使用 24-28px 图标容器与双行文字；数值列使用等宽数字并稳定对齐，辅助时间或说明使用 `caption`。行间只使用 `--color-line1-1`，选中行使用轻中性底，不能整行高饱和染色。

### 快捷入口（推断）

`quick_actions` 的 `confidence: inferred`，`render_policy: prd_match_only`。若 PRD 明确需要快捷入口，将其放在摘要舞台之后或明细区之前，使用 64-80px 等高白色条目、`--corner-4`、主题色线性图标和短标签；按钮本体仍遵守 28/32/36/40px 四档。若 PRD 没有入口需求，保留配方不渲染。禁止彩色宫格、营销插画和超大图标墙。

### 状态与交互

- 悬停：舞台指标单元边界略增强；白色面板不整体浮起，热力单元只提高一档对比或显示描边。
- 按下：按钮消费 `--color-brand1-9`，持续 100-140ms；不使用明显弹跳。
- 聚焦：控件显示 2px 清楚焦点环；纯图标按钮必须有可访问名称和 tooltip。
- 加载：保持舞台、图表和表格确定高度，以中性或深色环境匹配的骨架屏替代内容。
- 空态与错误：保留面板结构；没有合法数据时不绘制虚构图形，显示简短说明与 PRD 已有下一步操作。
- 禁用：降低对比但保持文字可读，同时禁用指针与键盘触发。
- 动效：颜色与透明度过渡 140-180ms，使用 `ease-out`；`prefers-reduced-motion` 下关闭位移与缩放。

## 项目应用

### 产品形态与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题应用：{{PRODUCT_TOPOLOGY_APPLICATION}}

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定是否存在摘要、矩阵、比例比较和明细记录；本主题只规定中性画布、深色聚焦摘要舞台、主题色派生数据纹理、圆角分析面板和稳定网格的视觉表达。普通列表、表单或详情页只继承兼容的 Token 和组件语言，不能强行补齐整套分析看板。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

每页先按“视觉记忆点应用策略”检查内容契约，再从 `summary_stage`、`intensity_matrix`、`ratio_triptych`、`insight_table` 和可选 `quick_actions` 中选择 1-3 个兼容组件。没有矩阵数据就不生成热力图，没有比例数据就不生成三柱对比，没有重复记录就不生成表格；可迁移的表面、圆角、色阶和工具带机制只能应用到 PRD 已有槽位。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图标、图表数据、头像、缩略内容和辅助图形必须有真实来源；没有素材时使用中性占位，不编造人物、机构、指标、联系方式、品牌或外部资源地址。

## 设计规范与禁忌

### 必须做到

- 保留中性灰画布、白色分析面板和唯一深色聚焦摘要舞台的深浅关系。
- PRD 存在首要概览与并列摘要时，使用横向深色舞台、底部主题辉光和半透明指标单元。
- PRD 存在二维强度数据时，使用由当前主题色派生的五档离散色阶和规则热力矩阵。
- PRD 存在比例比较时，使用主题斜纹、深色实心和浅色实心三类材质。
- PRD 存在重复记录时，使用圆角弱化表头、图标化主列、双行信息和稳定行高。
- 保持同一行分析面板等高、确定图表高度、父级 `gap` 和内部溢出处理。
- 页面标题不超过 24px；按钮只使用 28/32/36/40px 四档且不超过 40px。
- 保证 hover、active、focus、loading、empty、error、disabled、selected、移动端和 reduced motion 状态完整。

### 禁止项

- 禁止复制模板来源中的业务字段、人物、机构、指标、示例数据、分类名称或页面专属文案；禁止让 DESIGN.md 覆盖 PRD 内容决策。
- 禁止把普通 SaaS 工作台改造成官网 Hero，禁止大于 24px 的普通页面标题和大于 40px 的按钮。
- 禁止为保留摘要舞台而编造 KPI、角色或趋势，为热力矩阵编造二维数据，为三柱比较编造比例。
- 禁止把午夜舞台复制成多个深色大面板，或把主题色铺满普通白色卡片。
- 禁止把离散热力矩阵改成连续彩虹热图，或随意混用不等尺寸单元。
- 禁止把纹理化三柱改成普通多色柱、3D 图表、饼图或无数据装饰图形。
- 禁止组件库默认表格、重表格线、彩色整行状态和自由行高。
- 禁止瀑布流、`align-items: start`、自由高度分析卡、无固定高度图表和零散 margin 拼接。

### 错误与正确

- 错误：用多张深色卡片铺满页面；正确：只保留一个横向午夜摘要舞台，其余分析面板保持白色。
- 错误：摘要数据使用普通白色 KPI 卡；正确：在 PRD 有摘要时使用半透明指标单元嵌入深色舞台。
- 错误：无二维数据也生成热力图；正确：降级为 `recipe_only`，使用 PRD 已有内容面板。
- 错误：三组比例使用三种高饱和纯色；正确：使用同色相斜纹、深色实心和浅色实心形成材质差。
- 错误：明细区直接使用默认表格；正确：使用弱化表头、图标化主列、双行信息和克制分隔线。
- 错误：普通 SaaS 页面使用 48px 标题或 56px 按钮；正确：普通页标题映射到 24px `subhead`，按钮从 28/32/36/40px 中按角色选择。

### AI 使用提示

先判断页面为 SaaS 产品界面，再读取 PRD、解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token 与主题派生页面 Token。按“视觉记忆点应用策略”逐项检查 `content_contract`：直接匹配则落地组件本体，只有相近槽位则迁移视觉机制，无合法承载则使用 `recipe_only`，涉及新增能力则使用 `suggest_only`。每页优先选择 1-3 个兼容主记忆点，不编造指标、矩阵、比例、记录、筛选或导出能力。无论组件是否落地，都保持中性画布、白色浮岛、单一深色聚焦舞台、主题色派生数据纹理、稳定网格和完整组件状态。

### 交付自检

- [ ] 页面是否按 SaaS 分析工作台处理，没有误用官网 Hero、display title 或大号 CTA？
- [ ] `themeId`、主题名称、描述、视觉 DNA 和组件标题是否没有绑定某个默认色相？
- [ ] `themeId` 和描述是否只表达视觉机制，没有把某一种页面类型写成主题身份？
- [ ] 除状态语义色外，强调色与图表色是否都由 `--color-brand1-6` 派生，而非写死为任意固定色相？
- [ ] 全部页面内容、字段、数据和操作是否来自 PRD？
- [ ] 五个视觉记忆组件是否都有内容契约、落地策略、迁移目标与回退方式？
- [ ] 每页是否只选择与 PRD 匹配的 1-3 个主记忆点，未匹配组件是否没有强行渲染？
- [ ] 中性灰画布、白色分析面板、细边界和极弱阴影是否形成稳定中性基底，所有固定中性颜色是否满足 RGB 三通道相等？
- [ ] PRD 有首要概览与并列摘要时，是否使用唯一午夜舞台、底部辉光和半透明指标单元？
- [ ] PRD 有二维强度数据时，是否使用五档离散色阶、规则矩阵、标签和图例？
- [ ] PRD 有比例比较时，是否使用斜纹、深色和浅色三类材质并保持底部对齐？
- [ ] PRD 有重复记录时，是否使用弱化表头、图标化主列、双行信息和稳定行高？
- [ ] 页面标题是否不超过 24px，按钮是否只使用 28/32/36/40px 四档？
- [ ] 同行面板是否等高，图表是否有固定绘图区，长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 和 reduced motion 是否完整？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 的实际色值？
