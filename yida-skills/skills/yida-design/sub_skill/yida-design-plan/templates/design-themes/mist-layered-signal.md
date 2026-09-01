---
name: "{{PROJECT_NAME}}"
description: 以雾白画布、无描边软阴影大圆角表面、细线微趋势和斜线带状数据纹理构成宽松、低对比而精密的层次主题。
themeId: mist-layered-signal
tokens:
  application-global:
    colors:
      "--color-white": "#FFFFFF"
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值：与白色混合 14%，用于悬停>"
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值：与白色混合 88%，用于平台品牌浅色>"
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值：与白色混合 94%，用于浅色导航框架>"
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 16%，用于深色导航框架>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 10%，用于按下与激活>"
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值：与白色混合 64%，用于禁用>"
      "--color-line1-1": "#ECECEC"
      "--color-line1-2": "#DCDCDC"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E8E8E8"
      "--color-fill1-10": "rgba(255, 255, 255, 0.96)"
      "--color-text1-4": "#171717"
      "--color-text1-10": "#5F5F5F"
      "--color-text1-3": "#929292"
    typography:
      base:
        "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 500
        "--font-lineheight-subhead": 1.3
      body-2:
        "--font-size-body-2": 16px
        "--font-weight-body-2": 600
        "--font-lineheight-body-2": 1.4
      body-1:
        "--font-size-body-1": 14px
        "--font-weight-body-1": 400
        "--font-lineheight-body-1": 1.5
      table:
        "--font-size-table": 14px
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
      "--corner-1": 6px
      "--corner-2": 10px
      "--corner-3": 14px
      "--corner-4": 18px
      "--corner-5": 24px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#F4F4F4"
      "--oyd-surface-shadow": "rgba(0, 0, 0, 0.065)"
      "--oyd-thread-line": "rgba(24, 24, 24, 0.44)"
      "--oyd-thread-node": "#181818"
      "--oyd-theme-halo": "color-mix(in srgb, var(--color-brand1-6) 12%, #FFFFFF)"
      "--oyd-signal-seq-1": "#36B58A"
      "--oyd-signal-seq-2": "#D35D63"
      "--oyd-signal-seq-3": "#F39A38"
      "--oyd-signal-seq-4": "#9B5B2E"
      "--oyd-signal-seq-5": "#58B7E6"
    typography:
      metric-primary:
        "--font-size-metric-primary": 30px
        "--font-weight-metric-primary": 400
        "--font-lineheight-metric-primary": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以雾白无彩画布托起白色软悬浮表面，使用较大圆角、低透明扩散阴影和宽松内距形成平静层次；主题色只连接主操作、当前选择、焦点与关键定位。五联微趋势指标、由密集斜线连接上下包络的带状主图、条件式空间缩略面板、边缘色轨列表和尾部微折线表格构成主要视觉记忆。整体为中等密度，卡片内部留白偏宽，信息依靠字号、位置和细线纹理分层，不依靠重边框或大面积高饱和色。

### 风格定位与应用说明

- 核心气质是“雾面悬浮、柔和大圆角、细线信号、克制多序列”；连续变化、空间关系、阶段状态和结构化记录最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留无描边软表面、同类等高、线性图标、细线数据纹理、轻 tooltip 和边缘状态锚点，不照搬固定字段、地图、指标数量或模块顺序。
- 内容不匹配时，把微趋势语言迁移到已有摘要，把主辅分栏降级为单列；空间关系和斜线带无真实数据时保留为 `recipe_only`，需要新增能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 软悬浮五联指标 | 一排等宽白卡使用大圆角、无描边软阴影；每卡由圆形线性图标、两级标题、主值、变化符号和底部微可视化组成。`observed` | 保留等高、相同内距和“图标—标题—主值—微趋势”层级；数量与字段由 PRD 决定，主题焦点消费 `--color-brand1-6`，真实独立类别可消费受控序列色。 | 退化为纯文字数字卡、彩色大底卡或高度不齐的卡片拼盘。 |
| 斜线包络信号带 | 主图以两条起伏包络之间的密集平行斜线构成带状区域，边界节点为小方点，选中点弹出轻量浮层。`observed` | 保留上下包络、规则斜线、节点节奏、低对比线色和焦点 tooltip；时间、类别和数值必须来自真实数据。 | 被替换成普通面积图或粗柱图，最具识别度的细线纹理消失。 |
| 条件式空间缩略辅栏 | 主内容右侧存在独立白色面板，以细线空间底图、位置点、连接线、局部放大框和缩放控件表达范围与当前选择。`observed` | 仅在 PRD 有真实空间或拓扑关系时使用；保留低彩底图、主题色定位、局部放大和独立工具，不复制具体地域。 | 无依据渲染地图会伪造业务；去掉定位层级则辅栏退化为装饰图片。 |
| 边缘色轨任务列 | 列表行用窄竖色轨作为类型或状态锚点，主体含两级文本、日期/进度信息、弱状态胶囊和尾部箭头。`observed` | 保留左侧 4-6px 色轨、三段信息网格、轻胶囊和尾部操作；颜色必须映射真实类别或平台状态。 | 退化为重分隔表格，或用整行彩底造成视觉噪声。 |
| 微折线结果表 | 表格使用无外框连续行，数值列对齐，突出值用浅胶囊，尾列以小型彩色折线表达真实趋势。`observed` | 保留轻表头、56-64px 行高、等宽数字、弱胶囊和 48-72px 微折线；字段与趋势由 PRD 决定。 | 退化为密集默认表格，趋势提示和柔和层次同时丢失。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 软悬浮微趋势指标组 | `content_contract`: 至少两个同层摘要，且每项具有主值和可选真实微趋势、分段或比较信息。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供 `primary_metrics` 与对应微序列。 | `transferable_mechanism`: 等高白卡、大圆角、线性图标、底部微可视化；`adaptation_targets`: `primary_metrics`、`primary_summary`。 | `fallback`: 无微序列时移除微图，仅保留摘要层级；`forbidden`: 不得编造趋势、变化率、评分或比较周期。 |
| 斜线包络信号带 | `content_contract`: 存在两条相关边界、上下范围或区间宽度随有序维度变化的真实数据。 | `render_policy: prd_match_only`；`direct_trigger`: 数据可形成上下包络和节点序列。 | `transferable_mechanism`: 平行斜线、包络边界、方点节点与悬浮焦点；`adaptation_targets`: `primary_content_panel`、区间带、容量带、置信区间。 | `fallback`: 无区间关系时使用 PRD 指定图表并仅迁移轻线与 tooltip；`forbidden`: 不得伪造上下界、时间轴或选中对象。 |
| 条件式空间缩略辅栏与主辅分栏 | `content_contract`: 页面同时存在主要时序/关系视图和可独立阅读的真实空间或拓扑视图。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供坐标、区域或节点连接数据。 | `transferable_mechanism`: 约 3:2 主辅比例、细线底图、主题定位点、局部放大；`adaptation_targets`: `primary_content_panel`、`supporting_panel`。 | `fallback`: 无空间数据时主内容占满，不保留空辅栏；`forbidden`: 不得新增地点、路径、区域、坐标或地图操作。 |
| 边缘色轨明细列 | `content_contract`: 存在结构化记录、真实类别或状态以及尾部查看/处理动作。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供 `detail_list` 或分组记录。 | `transferable_mechanism`: 窄色轨、两级文本、元信息、胶囊与尾部箭头；`adaptation_targets`: `detail_list`、事件流、对象队列。 | `fallback`: 无类别色时统一使用主题色或中性轨；`forbidden`: 不得编造状态、日期、负责人、优先级或操作。 |
| 微折线结果表 | `content_contract`: 结构化记录包含可比较值，尾列存在真实短序列或变化方向。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供 `detail_table` 与真实微趋势。 | `transferable_mechanism`: 轻表头、等宽数字、浅胶囊和尾部微折线；`adaptation_targets`: `detail_table`、对比清单。 | `fallback`: 无短序列时移除尾部微折线；`forbidden`: 不得伪造数值、趋势、评级或类别。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、24px 以内标题、4px 基础间距、6-24px 圆角阶梯和偏宽松卡片内距。`tokens.custom-page` 只补充雾白画布、软阴影色、斜线带中性线与节点、主题浅光晕、五个独立分类序列和全局缺失的指标数字语义。普通边界、浅填充、tooltip 与正文色均复用全局 Token，不重复声明同义变量。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 页面由雾白画布、纯白表面和深浅文字构成；主题色面积保持克制，独立分类色只出现在微趋势、窄色轨、节点或小型标记中。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；主操作、当前选择、链接、焦点与定位标记 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、表格行线和图表辅助线 | `--color-line1-1` | 应用全局 |
| 输入、按钮和必要容器边界 | `--color-line1-2` | 应用全局 |
| 页面底层雾白画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 软悬浮表面的扩散阴影 | `--oyd-surface-shadow` | 自定义页 |
| 斜线带的中性连接线 | `--oyd-thread-line` | 自定义页 |
| 斜线带的中性节点 | `--oyd-thread-node` | 自定义页 |
| 当前焦点、定位或主题强调的浅光晕 | `--oyd-theme-halo` | 自定义页 |
| 第一至第五真实独立类别的小面积序列标记 | `--oyd-signal-seq-1 / --oyd-signal-seq-2 / --oyd-signal-seq-3 / --oyd-signal-seq-4 / --oyd-signal-seq-5` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底和嵌套浅层 | `--color-fill1-2` | 应用全局 |
| 更重中性填充和禁用轨道 | `--color-fill1-3` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子，其他六个 Brand Token 与 `--oyd-theme-halo` 均由它派生并在项目实例化时写入实际色值。无品牌色时使用产品流程给出的默认主色，不从分类序列中反推主题色。五个 `--oyd-signal-seq-1 / --oyd-signal-seq-2 / --oyd-signal-seq-3 / --oyd-signal-seq-4 / --oyd-signal-seq-5` 是独立分类色，只在 PRD 确认存在多个等权类别且需要颜色区分时使用；它们不参与主题同色演变，也不用于主按钮、导航或全局选中。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3`、`--oyd-page-background` 与 `--oyd-thread-node` 均为 `neutral-gray`，Hex 满足 `R = G = B`；`--color-fill1-10`、`--oyd-surface-shadow` 与 `--oyd-thread-line` 的前三通道相等。
- `--oyd-theme-halo` 是 `theme-gray` / 主题浅色，由 `--color-brand1-6` 12% 与 `#FFFFFF` 88% 混合；项目实例化时必须写入实际色值。
- `--oyd-signal-seq-1 / --oyd-signal-seq-2 / --oyd-signal-seq-3 / --oyd-signal-seq-4 / --oyd-signal-seq-5` 是固定独立分类色，角色是区分真实等权序列；单序列或主焦点不得消费它们，避免与主题主色竞争。
- 成功、警告、错误和信息状态直接消费平台语义色，并配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 白色与无彩画布占页面面积 88% 以上，主题色和所有分类色合计控制在 8%-12%；禁止把分类色扩展为大面积卡片底色。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；正文消费 `body-1`；表格消费 `table`；辅助信息消费 `caption`。
- `subhead` 为 24px / 500 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 30px / 400 / 1.2，仅用于摘要主值；它是全局层缺失的独立数据语义，不替代页面标题或面板标题。
- 数值启用 `font-variant-numeric: tabular-nums`；页面标题单行省略，卡片标题最多两行，表格与列表主文本单行截断并提供完整值。
- 图标使用 1.5px 线性描边、圆端点；指标圆形图标 18-20px，工具图标 16-18px，均与首行文字视觉居中，不使用 emoji。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：图标与文字用 `--s-2 / --s-3`，工具组用 `--s-3`，卡片内距用 `--s-4 / --s-6`，大区块用 `--s-6 / --s-8`。
- 全页面最大宽度 1760px，桌面安全边距 24-32px；父级网格使用统一 `gap`，同类面板拉伸对齐，任何子项设置 `min-width: 0`。
- 指标组按真实数量使用自适应等宽列，不固定必须五列；主要内容与独立辅助内容同时存在时可使用约 3:2 分栏，底部两个独立明细面板同时存在时可使用 1:1 分栏。
- 页面身份、全局操作、主要内容和辅助内容是否出现及顺序由 PRD 与页面模式决定；无相应内容时不保留空白卡或空辅栏。

### 布局稳定性硬规则

- 桌面端主网格使用 `align-items: stretch`；禁止瀑布流与 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题区固定，内容区使用 `flex: 1; min-height: 0`。
- `metric_card` 建议高 220-248px；斜线带 `chart_panel` 高 480-560px；空间 `supporting_panel` 高 480-560px；`detail_panel` 高 340-440px；可选 `quick_action_item` 高 68-84px。
- 斜线带绘图区固定 300-360px；空间视图绘图区固定 320-390px；列表和表格在面板内部滚动，长文本截断，不撑破网格。
- ≥1360px：指标按真实数量最多 5 列；主辅契约成立时约 3:2；两个明细面板契约成立时 1:1。900-1359px：指标 2-3 列，主辅上下排列，空间视图在主内容后。<900px：全部单列，工具栏分组换行，图表必要时横向滚动，移动端可解除等高但保留控件高度、截断和内部溢出。
- 内容契约不成立时，各断点按 PRD 的单列、列表、表单、详情或流程模式组织，不生成空图、空地图、空指标或空明细面板。

## 表面与层级

- 一级面板使用 `--color-white`，常态不描边；阴影为 `0 12px 32px --oyd-surface-shadow, inset 0 1px 0 rgba(255,255,255,0.90)`。面板与画布的明度差和软阴影共同建立层级。
- 小卡与大面板分别消费 `--corner-4` 与 `--corner-5`；同一行的表面投影强度一致，悬停只把阴影提升为 `0 16px 36px rgba(0,0,0,0.085)`，不改变尺寸。
- tooltip、popover 使用 `--color-fill1-10`、`--corner-3`、`0 10px 28px rgba(0,0,0,0.10)`；嵌套选择框或放大框使用白色半透明面与 1px `--color-line1-2`，不叠加第二层重阴影。
- 禁止毛玻璃、霓虹辉光、厚描边和全页渐变；只允许主题浅光晕出现在当前焦点周围，分类色的渐变填充仅限微图下方且透明度不超过 14%。

## 圆角与形状

- `--corner-1` 6px 用于短状态与色轨端点；`--corner-2` 10px 用于输入、按钮和小型 tooltip；`--corner-3` 14px 用于圆形图标底、分段控件和嵌套框；`--corner-4` 18px 用于指标卡；`--corner-5` 24px 用于大面板。
- `--corner-semicircle` 用于状态胶囊、趋势段和短标签；`--corner-circle` 用于图标按钮、定位点和焦点节点。
- 斜线带节点保持 4-6px 方点，不改成大圆点；边缘色轨保持窄竖条；同层面板圆角必须一致。

## 组件

### 按钮与操作

按钮只使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮使用同档正方形。主按钮消费 `--color-brand1-6`，次按钮使用白底与必要的 `--color-line1-2`。hover、active 分别消费 `--color-brand1-1 / --color-brand1-9`；focus 为 2px 主题色外环加 2px offset；disabled 同时降低文字和表面对比。同一操作区只保留一个视觉主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。控件使用白色表面、`--corner-2` 和 1px `--color-line1-2`；placeholder 消费 `--color-text1-10`。focus 使用主题色边界与浅光晕，error 使用平台错误色并配合文字。多个筛选器按任务分组、等高对齐，不以阴影区分每个控件。

### 卡片与面板

指标卡使用 `--corner-4`、`--s-6` 内距和固定高度；大面板使用 `--corner-5`、`--s-6` 内距与独立标题区。一级表面使用软阴影，嵌套内容以留白、浅填充或弱边界区分，不再套一张同等阴影卡。面板标题右侧最多保留一组紧凑操作。

### 软悬浮微趋势指标

固定公式为“圆形线性图标与两级标题 / 主值与变化符号 / 底部 52-72px 微趋势或三段条”。卡片组同高，主值消费 `metric-primary`，变化信息使用图标加文本，不能只靠颜色。微折线宽 1.5px、节点 4-6px、面积填充透明度 8%-14%；无真实序列时删除微图，不制造装饰波形。

### 斜线包络信号带

容器使用固定高度绘图区；由上、下两条透明包络控制点生成 18-36 根等距斜线，线宽 1px、颜色 `--oyd-thread-line`，两端节点为 `--oyd-thread-node` 4-6px 方点。焦点节点消费 `--color-brand1-6`，tooltip 复用 `--color-fill1-10`。禁止用普通面积图、粗柱或大色块替代斜线纹理。

### 条件式空间缩略面板

仅在真实空间或拓扑数据存在时渲染。底图/拓扑线使用 `--color-line1-2` 与 0.8-1px 描边，辅助连接线虚实结合，关键定位点消费 `--color-brand1-6`；局部放大框与主图通过细连接线关联。缩放与重置使用 28px 图标按钮并提供可访问名称；禁止无坐标数据时用假地图占位。

### 边缘色轨明细与微折线表

列表行高 64-76px，左侧 4-6px 色轨，主体按“主文本 / 元信息 / 状态 / 尾部操作”对齐；表格表头 44px、数据行 56-64px，数字右对齐并启用等宽特性，浅胶囊只突出少量值。微折线宽 48-72px、高 20-28px，线宽 1.5px；没有短序列时删除该列。

### 图表或主内容面板

主内容图表使用固定高度、稀疏轴标签和极弱辅助线；主数据标记不超过 2 种视觉强度。斜线带的中性线不占用主题色，只有当前焦点消费主题色。tooltip 包含标题、1-3 行真实值和必要操作，避免遮挡关键节点；键盘可逐点导航并同步可访问文本。

### 表格与列表

连续表格和列表保持白色表面，无粗外框；行间使用留白、弱分隔或交替极浅填充之一，不同时叠加。状态需图标或文字配合；尾部操作使用 28px 图标按钮。长文本单行省略并提供查看方式，面板内部滚动时表头保持可见。

### 快捷入口（可见或推断）

视觉材料未形成独立快捷入口区，置信度为 `inferred`，默认 `render_policy: recipe_only`。若 PRD 明确要求快捷入口，使用 68-84px 白色软悬浮条目、单色线性图标和两级文字；桌面按真实数量排列，移动端单列或横向滚动，禁止默认彩色宫格。

### 状态与交互

- 悬停：卡片阴影轻微增强，行背景切换到 `--color-fill1-1`，线和文字不位移。
- 按下：按钮消费 `--color-brand1-9`，可点击行使用 1px 内缩反馈，不改变外部尺寸。
- 聚焦：交互控件显示 2px 主题色 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持卡片和图表固定高度，使用中性骨架与稳定占位，避免网格跳动。
- 空态与错误：保留原面板结构，提供简短说明和下一步操作，不将整卡染成状态色。
- 禁用与选中：禁用同时降低文字、图标和边界对比；选中使用主题色焦点、标记形状或文字，不只依赖颜色。
- 动效：hover 与按钮反馈 120-160ms，tooltip 160-200ms，图表更新 220-320ms，使用 ease-out；`prefers-reduced-motion` 下关闭位移动画和路径绘制。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题是否可用。原生页面和自定义页面共同继承全应用灰阶、字体、间距、圆角与控件状态；自定义页面在内容契约成立时补充软悬浮表面、微趋势、斜线带、空间缩略和边缘色轨机制。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容、信息架构和模块；本主题只规定视觉表达。若真实页面没有趋势、范围、空间或多类别数据，应保留其列表、表单、详情或流程结构，仅迁移雾白画布、软表面、排版、圆角、间距和交互语言。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面；每页说明 `page_identity`、`global_actions`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table/detail_list` 的位置、跨度、高度、移动端顺序与采用的视觉 DNA。页面无需使用全部母体，但采用对应信息类型时必须遵守本文构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 地图、拓扑、图标、图表和缩略内容必须有真实来源；没有素材时使用结构化数据或中性占位，不编造对象、地点、指标或图片地址。

## 设计规范与禁忌

### 必须做到

- 所有页面必须保留雾白画布、白色软悬浮表面、大圆角、轻阴影和克制主题焦点；普通卡片不得改为重边框或大色块。
- 指标契约成立时必须保护“圆形图标—两级标题—主值—底部微趋势”层级，并保证同组等高。
- 区间数据契约成立时必须使用上下包络、规则斜线、方点节点和轻 tooltip；空间数据契约成立时必须使用低彩底图、主题定位与局部层级。
- 明细契约成立时保护窄色轨、连续行、等宽数字、弱胶囊和真实微折线；没有短序列时必须删除微折线。
- 图表固定高度、同类面板拉伸、父级 `gap`、内部溢出、完整状态、键盘访问和三档响应式必须落地。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景、普通卡片或大面积面板；禁止把默认色相误当成视觉 DNA。
- 禁止把五列指标、3:2 分栏、空间辅栏或底部双面板写成所有页面无条件执行的结构。
- 禁止用普通面积图替代斜线包络带；禁止用装饰波形冒充微趋势；禁止在无空间数据时生成地图。
- 禁止让独立分类色承担主按钮、导航、全局选中或状态语义；禁止整行、整卡使用高饱和分类底色。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、厚边框、霓虹辉光、无依据装饰和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：指标卡只有数字或使用整卡彩底；正确：白色软卡内保留圆形图标、两级标题、主值、变化符号和真实微可视化。
- 错误：把斜线带改成普通填充面积；正确：由上下包络和规则平行斜线形成轻量数据纹理，主题色只标记焦点。
- 错误：为保持主辅构图伪造地图或辅助指标；正确：内容契约成立时使用 3:2 分栏，否则主内容占满并迁移表面语言。
- 错误：主题色和五个分类色铺满页面；正确：颜色只出现在焦点、节点、微线、窄色轨和小胶囊中，大部分表面保持无彩。
- 错误：列表每行成为独立阴影卡；正确：列表保持连续白色面板，以窄色轨、留白和弱分隔组织行。
- 错误：卡片随内容自由增高形成瀑布流；正确：同类卡片固定高度、网格拉伸，长内容内部滚动或截断。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token。所有真实页面先继承雾白画布、白色软悬浮表面、大圆角、克制阴影与基础组件语言，再按内容契约选择微趋势指标、斜线包络、空间缩略、边缘色轨或微折线表。不得为复刻代表性构图新增业务内容；主题色只替换焦点色相，不改变软表面、细线纹理、密度、形状和布局稳定机制。独立分类色只在真实多类别场景使用。

### 交付自检

- [ ] 全部页面内容和模块是否来自 PRD，而非模板来源？
- [ ] 软悬浮表面是否保持白色、无常态描边、大圆角、统一轻阴影和同类等高？
- [ ] 指标组在契约成立时是否保留完整层级，微趋势是否来自真实序列？
- [ ] 斜线带是否由上下包络、规则斜线、方点节点和轻 tooltip 构成，而非普通面积图？
- [ ] 空间缩略是否仅在真实坐标或拓扑数据存在时渲染，并保留定位与局部层级？
- [ ] 边缘色轨与微折线是否仅编码真实类别、状态或短序列？
- [ ] 每个视觉记忆组件是否都有 `content_contract`、`render_policy`、迁移目标和无匹配回退策略？
- [ ] 固定指标列数、主辅比例、辅栏和模块顺序是否具有内容契约，而非全页面硬规则？
- [ ] 未被 PRD 触发的组件是否没有强行渲染，视觉迁移是否没有新增业务内容？
- [ ] 主操作、关键焦点、定位和选中是否共享 `--color-brand1-6`，其余表面保持中性？
- [ ] 独立分类色是否只承担真实等权类别，未替代主题色或平台状态色？
- [ ] `application-global` 的变量名和消费语义是否稳定，具体值是否依据本主题生成？
- [ ] `custom-page` 是否逐项通过全局语义复用检查，没有同值同义或角色重叠的重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、视觉 DNA、组件标题和正文总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的宽松留白、低对比、大圆角、软阴影和克制主题色是否与 Token 及正文一致？
- [ ] 是否没有建立适用/不适用产品形态清单，所有页面是否共享全应用 Token 和基础组件语言？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在的页面，没有枚举不存在的页面？
- [ ] 主题同色演变是否由 `--color-brand1-6` 派生，平台状态语义色是否未在 `custom-page` 重复声明？
- [ ] 所有灰色 Token 是否已分类；`neutral-gray` 是否满足三通道相等，`theme-gray` 是否声明基底、比例和实例化要求？
- [ ] 同类面板是否等高，图表是否固定高度，长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引发布局跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 的实际色值？
