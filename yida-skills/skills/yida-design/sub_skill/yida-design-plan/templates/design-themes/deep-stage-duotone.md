---
name: "{{PROJECT_NAME}}"
description: 以浅色画布、深色聚焦舞台、同主题深浅双色数据和条件式主辅面板构成中等密度、清晰对比的层次主题。
themeId: deep-stage-duotone
tokens:
  application-global:
    colors:
      "--color-white": "#FFFFFF"
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值：与白色混合 12%，用于悬停>"
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值：与白色混合 88%，用于平台品牌浅色>"
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值：与白色混合 94%，用于浅色导航框架>"
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 18%，用于深色导航框架>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 12%，用于按下与激活>"
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值：与白色混合 62%，用于禁用>"
      "--color-line1-1": "#EAEAEA"
      "--color-line1-2": "#DADADA"
      "--color-fill1-1": "#F7F7F7"
      "--color-fill1-2": "#F1F1F1"
      "--color-fill1-3": "#E7E7E7"
      "--color-fill1-10": "rgba(255, 255, 255, 0.96)"
      "--color-text1-4": "#181818"
      "--color-text1-10": "#5E5E5E"
      "--color-text1-3": "#888888"
    typography:
      base:
        "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 600
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
      "--corner-1": 4px
      "--corner-2": 8px
      "--corner-3": 12px
      "--corner-4": 16px
      "--corner-5": 20px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#FBFBFB"
      "--oyd-theme-deep": "color-mix(in srgb, var(--color-brand1-6) 34%, #111111)"
      "--oyd-theme-deep-soft": "color-mix(in srgb, var(--oyd-theme-deep) 76%, #FFFFFF)"
      "--oyd-stage-pattern": "rgba(255, 255, 255, 0.10)"
      "--oyd-stage-secondary-action": "rgba(255, 255, 255, 0.18)"
      "--oyd-stage-object-overlay": "rgba(255, 255, 255, 0.08)"
    typography:
      metric-stage:
        "--font-size-metric-stage": 34px
        "--font-weight-metric-stage": 500
        "--font-lineheight-metric-stage": 1.2
      metric-primary:
        "--font-size-metric-primary": 28px
        "--font-weight-metric-primary": 500
        "--font-lineheight-metric-primary": 1.25
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题在近白画布上放置一个横向深色聚焦舞台，以主题主色与其深色派生建立同色双调对比；白色常规面板、零轴上下双向柱、右侧摘要列、三联指标卡、方向图标明细行和层叠实体卡共同形成由总览到细节的节奏。页面整体为中等密度，面板内部留白充足，圆角稳定，阴影极轻；深色舞台与实体卡是少量高对比区域，合计不超过页面面积的 24%，其余表面保持中性。

### 风格定位与应用说明

- 核心气质是“深色聚焦舞台、同色双调数据、宽松面板、明确方向感”；总值、双向流量、对比指标、活动明细或实体凭证最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留深色舞台、细线抽象纹理、同色深浅序列、零轴方向、圆形行首标记和稳定主辅比例，不照搬固定业务模块。
- 内容不匹配时，将深色舞台降级为普通聚焦摘要面板，将实体卡保留为 `recipe_only`；需要新增能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 深色聚焦摘要舞台 | 横向深色大面板承载单个核心值与右侧操作，背景有低对比线框纹理；主操作使用亮主题色，次操作半透明。`observed` | 保留高对比舞台、左右分区、低对比纹理与一主多次操作；指标和操作由 PRD 决定，舞台消费 `--oyd-theme-deep`。 | 退化为普通白卡或大面积渐变 Hero，核心焦点和产品感丢失。 |
| 零轴双向双色柱 | 主图以零轴为中心，深色柱向上、亮色柱向下，稀疏网格和日期刻度保持轻量。`observed` | 保留共享零轴、上下方向、同主题深浅双色与固定柱宽；序列语义和数据由 PRD 决定。 | 两组柱同向或使用无关分类色，方向关系与主题一致性消失。 |
| 主图右侧摘要列 | 图表右侧由竖分隔线切出窄列，使用方形主题图标、主值、变化信息与水平分隔组织两项摘要。`observed` | 仅在图表和独立摘要同时存在时使用，保留竖分隔、上下等高与图标—文本层级；具体摘要由 PRD 决定。 | 摘要漂浮在图表内部或无条件生成侧栏，造成遮挡与内容伪造。 |
| 方向图标明细行 | 明细首列使用浅主题圆形底与方向图标，两级文本、状态和方法信息沿行内网格排列。`observed` | 保留圆形方向锚点、两级文本、轻分隔与等宽数字；方向、状态和字段必须来自真实记录。 | 退化为密集默认表格，方向语义与亲和力下降。 |
| 层叠实体卡 | 窄面板内两张圆角实体卡前后错位，前卡使用深色舞台与低对比几何水印。`observed` | 只在 PRD 有真实实体凭证、账户卡或可视化对象时使用；保留前后层叠、深色表面、遮罩信息和水印。 | 无依据地生成虚假卡片，或退化为普通文本列表。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 深色聚焦摘要舞台 | `content_contract`: 存在一个页面级核心摘要，以及 0-4 个真实相关操作。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供 `primary_summary` 和可选 `global_actions`。 | `transferable_mechanism`: 深色横向舞台、左右分区、线框纹理、一主多次操作；`adaptation_targets`: `primary_summary`、关键状态、对象总览。 | `fallback`: 无页面级核心摘要时不渲染舞台；`forbidden`: 不得编造总值、变化率或操作。 |
| 零轴双向双色柱 | `content_contract`: 两个真实序列具有方向、增减、流入流出或正负关系。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供共享零轴的双向数据。 | `transferable_mechanism`: 零轴、上下柱、同主题深浅、稀疏网格；`adaptation_targets`: `primary_content_panel`、净变化、双向流。 | `fallback`: 无方向关系时使用普通分组或单序列图；`forbidden`: 不得伪造正负、流向或时间数据。 |
| 主图右侧摘要列与条件式主辅面板 | `content_contract`: 主图旁存在 1-3 个可独立阅读且与主图直接相关的摘要。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 同时提供主图与 `supporting_panel`。 | `transferable_mechanism`: 约 7:3 比例、竖分隔、等高摘要、方形图标块；`adaptation_targets`: 主内容与现有辅助摘要。 | `fallback`: 无独立摘要时图表占满面板；`forbidden`: 不得为形成窄列新增指标、说明或操作。 |
| 方向图标明细 | `content_contract`: 记录具有真实方向、类型或动作语义，并包含至少两级信息。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供带方向或类型的明细。 | `transferable_mechanism`: 圆形行首锚点、两级文本、轻状态与数值对齐；`adaptation_targets`: `detail_table`、`detail_list`。 | `fallback`: 无方向语义时使用单色对象图标；`forbidden`: 不得虚构人物、方向、金额、状态或方法。 |
| 层叠实体卡 | `content_contract`: PRD 明确存在可视化实体凭证、账户卡、会员卡或同类对象，并提供真实脱敏字段。 | `render_policy: prd_match_only`；`direct_trigger`: 有合法实体对象与显示权限。 | `transferable_mechanism`: 前后错位、深色主卡、低对比几何水印与脱敏字段；`adaptation_targets`: `supporting_panel`、对象详情。 | `fallback`: 无实体对象时不渲染；`forbidden`: 不得伪造卡号、品牌、金额、账户或凭证。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、24px 以内标题、4px 基础间距和 4-20px 圆角阶梯。`tokens.custom-page` 只补充页面画布、主题深色舞台、深色柔化变体、舞台纹理与半透明操作层，以及全局层缺失的舞台主值和常规指标数字。图表网格复用 `--color-line1-1`，tooltip 复用 `--color-fill1-10`，普通浅底复用 `--color-fill1-1 / --color-fill1-2`，不重复声明同义 Token。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 浅色画布与白色表面构成主体，亮主题色负责主操作和一组数据，深色派生负责聚焦舞台、另一组数据与实体主卡。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；主操作、亮色数据、选中与链接 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、图表网格和表格行线 | `--color-line1-1` | 应用全局 |
| 输入框、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 深色聚焦舞台、深色数据序列和实体主卡 | `--oyd-theme-deep` | 自定义页 |
| 深色舞台的次级主题变体 | `--oyd-theme-deep-soft` | 自定义页 |
| 深色舞台与实体卡的线框纹理 | `--oyd-stage-pattern` | 自定义页 |
| 深色舞台的次操作表面 | `--oyd-stage-secondary-action` | 自定义页 |
| 实体卡的低对比几何水印 | `--oyd-stage-object-overlay` | 自定义页 |
| 菜单悬停、弱标签和浅图标底 | `--color-fill1-1` | 应用全局 |
| 菜单点击和中性选中底 | `--color-fill1-2` | 应用全局 |
| 更重中性填充与禁用轨道 | `--color-fill1-3` | 应用全局 |
| 标题、核心数字、正文和文字图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子。`--oyd-theme-deep` 由主色 34% 与 `#111111` 66% 混合，`--oyd-theme-deep-soft` 再由深色变体 76% 与白色 24% 混合；项目实例化时必须写入实际色值。同色深浅只改变色相与明度，不改变深色舞台、零轴方向、主辅结构和组件机制。中性与白色区域不少于页面面积的 76%。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3` 与 `--oyd-page-background` 均为 `neutral-gray`，Hex 满足 `R = G = B`；所有 rgba 灰阶前三通道相等。
- `--oyd-theme-deep` 与 `--oyd-theme-deep-soft` 是主题派生深色，不声明为灰色；换主题色时必须重新计算。
- `--oyd-stage-pattern`、`--oyd-stage-secondary-action`、`--oyd-stage-object-overlay` 是等通道白色透明材质，只用于深色表面。
- 成功、警告、错误和信息状态直接消费平台语义色并配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 亮主色与深色派生是唯一主数据双调；平台错误色仅用于真实负向状态，不作为第三条数据序列。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；正文消费 `body-1`；表格消费 `table`；辅助信息消费 `caption`。
- `subhead` 为 24px / 600 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-stage` 为 34px / 500 / 1.2，仅用于深色舞台核心值；`metric-primary` 为 28px / 500 / 1.25，用于白色指标卡与图表摘要。两者是全局层缺失的独立数字语义，不替代页面标题。
- 数值启用等宽数字；深色舞台标题与数值使用白色，辅助说明使用 75%-85% 白色。长标题最多两行，表格主文本单行省略并提供完整值。
- 图标使用 1.5px 线性描边、圆端点；行首图标 18px，方形摘要图标 20px。图标与首行文字视觉居中。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：微间距用 `--s-1 / --s-2`，控件组用 `--s-3`，卡片内距用 `--s-4 / --s-6`，大区块用 `--s-6 / --s-8`。
- 全页面最大宽度 1760px，安全边距 28-32px；父级使用 `gap`，同类面板拉伸，长内容内部处理。
- 深色舞台仅在核心摘要契约成立时出现；主图右侧 7:3 摘要列仅在主图与独立摘要同时存在时使用；底部 2:1 明细与实体卡仅在两类内容同时存在时使用。
- 顶部搜索、日期范围与导出等全局操作是否存在由 PRD 决定；无操作时不保留空白槽位。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items: stretch`；禁止瀑布流与 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题固定，内容区 `flex: 1; min-height: 0`。
- 深色 `summary_stage` 高 168-208px；`chart_panel` 高 420-500px；白色 `metric_card` 高 180-220px；`detail_panel` 高 360-520px；实体卡辅助面板高 360-520px；可选 `quick_action_item` 高 72-88px。
- 双向柱绘图区固定 280-340px；表格、列表和长文本内部滚动、截断或折叠，不撑破外层。
- ≥1280px：主图与摘要契约成立时 7:3，明细与实体卡契约成立时 2:1，三联指标按真实数量横排；768-1279px：主辅上下排列，指标 2 列；<768px：全部单列，舞台操作移到数值下方并可横向滚动，辅助内容排在主任务后，可解除等高但保留控件高度与溢出。
- 内容契约不成立时，各断点遵循 PRD 页面模式，不生成空舞台、空摘要列或空实体卡面板。

## 表面与层级

- 常规面板使用 `--color-white`、1px `--color-line1-1`、`0 1px 3px rgba(0,0,0,0.03)`；深色舞台无阴影，依靠色面和 `--corner-5` 建立层级。
- 深色舞台的线框纹理使用 `--oyd-stage-pattern`，线宽 1px、面积不超过舞台右半区域；次操作使用 `--oyd-stage-secondary-action`。
- tooltip、popover 使用 `--color-fill1-10`、`--color-line1-2` 和 `0 8px 24px rgba(0,0,0,0.10)`；嵌套区使用浅填充或分隔线，不重复投影。
- 禁止毛玻璃、强辉光和全页渐变；深色材质只出现在聚焦舞台、主题图标块和实体主卡。

## 圆角与形状

- `--corner-1` 4px 用于短状态；`--corner-2` 8px 用于输入、按钮和 tooltip；`--corner-3` 12px 用于图标块与分段控件；`--corner-4` 16px 用于普通卡片；`--corner-5` 20px 用于聚焦舞台与大面板。
- `--corner-semicircle` 用于状态胶囊、柱端点和短标签；`--corner-circle` 用于行首方向标记和图标按钮。
- 同层面板圆角一致；实体卡保持 16-20px 圆角，不模拟过度写实材质。

## 组件

### 按钮与操作

按钮仅使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮为同档正方形。浅色区域主按钮消费 `--color-brand1-6`；深色舞台主按钮同样用主色，次按钮用 `--oyd-stage-secondary-action` 与白字。hover、active 使用 `--color-brand1-1 / --color-brand1-9`，focus 为 2px 对比外环加 2px offset；disabled 同时降低文字与表面对比。同一操作区只保留一个主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。白色表面、`--color-line1-2`、`--corner-2`；placeholder 用 `--color-text1-10`。focus 使用主题色边界与外环，error 消费平台错误色并配合文字。搜索、日期范围、周期与导出按真实任务分组并保持等高。

### 卡片与面板

普通卡片使用 `--corner-4`，大面板与舞台使用 `--corner-5`；内距 `--s-4 / --s-6`。标题工具栏固定，内容区 `flex: 1`。一级面板只包可独立理解或滚动的内容；嵌套摘要优先用分隔线，不再包卡。

### 深色聚焦摘要舞台

固定公式：深色横向容器 + 左侧标题/核心值/变化 + 右侧 0-4 个操作 + 右半低对比线框纹理。核心值消费 `metric-stage`，主操作消费主题色，次操作消费半透明白。操作与数据必须来自 PRD。禁止把舞台变成营销 Hero、添加大段叙事或铺满全页。

### 零轴双向双色柱

固定公式：中心 1px 零轴 + 上下两组 22-32px 圆端柱 + 稀疏水平网格 + 时间刻度。深色序列消费 `--oyd-theme-deep`，亮色序列消费 `--color-brand1-6`；上下方向必须对应真实语义。hover 显示同一维度的双值 tooltip。无方向关系时使用普通分组柱，禁止强制拆成正负。

### 主图右侧摘要列

固定公式：1px 竖分隔 + 1-3 个等高摘要块 + 52-60px 方形主题图标 + 主值/变化 + 块间横分隔。深色图标块消费 `--oyd-theme-deep`，亮色块消费主色；变化状态配合方向符号和平台语义色。窄屏移动到主图下方。禁止把摘要浮在绘图区内。

### 三联白色指标卡

当 PRD 有 2-4 个独立指标时，使用等宽白卡、左上主题线性图标、右上周期说明、主值和底部对比说明。主值消费 `metric-primary`，图标消费主色，负向变化消费平台错误色。卡片等高，禁止彩色大底或强阴影。

### 方向图标明细

固定公式：40-44px 浅主题圆形标记 + 两级主信息 + 主数值/辅助数值 + 状态 + 方法或类型字段。行高 72-84px，只保留水平分隔；方向图标与真实记录一致，状态必须有图标和文字。无方向语义时使用单色对象图标，不虚构流向。

### 层叠实体卡

固定公式：辅助面板 + 前后错位两张 16-20px 圆角实体卡 + 深色主卡 + 低对比几何水印 + 脱敏字段。后卡只露出 12%-18% 高度，前卡消费 `--oyd-theme-deep`。必须检查权限与脱敏规则；无真实实体时不渲染，禁止用假卡填充视觉。

### 图表或主内容面板

图表标题与分段控件固定，绘图区高 280-340px。网格用 `--color-line1-1`，零轴比网格高一档，tooltip 复用全局浮层。图例同时使用颜色、方向和标签。加载时保持零轴与面板高度，空态不生成假柱。所有图表支持键盘焦点、文本摘要和 `aria-label`。

### 表格与列表

标题工具栏、44px 表头与 72-84px 数据行共享连续容器；表头浅填充，表体只用水平分隔。主文本左对齐，数字右对齐并启用等宽数字；状态胶囊 28-32px，尾部操作 28/32px。表头 sticky，表体内部滚动；移动端转字段分组列表或横向滚动。

### 快捷入口（可见）

`confidence: observed`。是否渲染由 PRD 决定；有真实高频操作时，快捷入口位于深色聚焦舞台右侧，最多 4 个，使用一个主操作、其余次操作。移动端转为数值下方横向滚动。禁止默认彩色宫格，禁止为填满操作区创造入口。

### 状态与交互

- 悬停：120-180ms 内改变边界、浅填充或深色材质明度，不改变尺寸。
- 按下：80-120ms 消费 `--color-brand1-9` 或 1px 内收反馈。
- 聚焦：显示清楚 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持舞台、图表、卡片和列表固定高度，使用骨架或稳定占位。
- 空态与错误：保留原结构，提供简短说明与下一步操作，不整块染色。
- 禁用与选中：禁用结合低对比、图标和文案；选中结合主题色边界、底色或标记，不只依赖颜色。
- 动效：常规 120-200ms `ease-out`，图表更新 200-300ms；`prefers-reduced-motion` 下关闭位移和逐项动画。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题资格。原生页面与自定义页面共同继承全应用颜色、字体、间距与圆角；自定义页面仅在需要深色舞台、同色深浅序列、舞台透明材质或独立指标数字时消费页面级 Token。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉表达。深色舞台、零轴双向柱、右侧摘要列、三联指标、方向明细和实体卡均须经过内容契约，不得把所有页面强制改造成同一结构。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面，并说明中性槽位、跨度、高度、移动端顺序与采用的视觉 DNA。页面无需使用全部组件母体，但采用对应信息类型时必须遵守构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；缺少素材时使用结构化数据或中性占位，不编造人物、账户、凭证、指标、状态或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护浅色画布、白色细边面板、深色聚焦舞台、同主题深浅双色与清晰方向感。
- 核心摘要契约满足时，舞台必须保护左右分区、低对比纹理和一主多次操作；双向数据存在时保护共享零轴、上下柱和同色双调。
- 主图与独立摘要同时存在时保护竖分隔、等高摘要和响应式后置；方向明细存在时保护圆形行首锚点、两级文本与等宽数字。
- 实体对象存在且有权限时保护前后层叠、深色主卡、脱敏字段和几何水印；无真实对象不得渲染。
- 同类面板等高、图表固定高度、长内容内部处理、父级 gap 统一；完整实现状态、响应式、键盘访问与 reduced motion。

### 禁止项

- 禁止复制模板来源中的业务内容，或让本文件覆盖 PRD 的内容决策。
- 禁止把深色舞台铺满全页或把主题色铺满普通卡片；禁止把默认色相写成主题身份。
- 禁止把舞台、7:3 图表摘要、2:1 明细实体卡或模块顺序写成全页面硬规则。
- 禁止让上下双向柱承载无方向关系的数据，或用无关分类色替代同主题深浅双色。
- 禁止虚构摘要、操作、流向、人员、账户、卡号、凭证、金额、状态或方法。
- 禁止把实体卡做成营销插画，禁止强渐变、玻璃拟态、重辉光和写实反光。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。

### 错误与正确

- 错误：把深色舞台做成全屏 Hero；正确：作为单个高对比摘要区，后续内容回到白色表面。
- 错误：两个数据序列使用无关高饱和色；正确：主色与深色派生构成同色双调，并配合方向与标签。
- 错误：摘要列覆盖绘图区；正确：用竖分隔切出独立窄列，窄屏移动到图表下方。
- 错误：所有明细都强制方向箭头；正确：仅真实方向存在时使用，否则改对象图标。
- 错误：无真实实体也生成卡片；正确：无匹配内容时 `recipe_only`，本页不渲染。
- 错误：卡片随内容形成瀑布流；正确：同类面板等高，长内容内部滚动或截断。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成七个实际 Brand Token、深色舞台与深色柔化变体。所有页面先继承全应用 Token，再按内容契约选择聚焦舞台、双向柱、右侧摘要、指标卡、方向明细或实体卡。主题色替换只改变色相及同色派生，不改变舞台比例、零轴方向、双调角色、表面、圆角、密度和交互机制。页面级 Token 已完成全局语义复用扫描，禁止重声明网格、tooltip、浅底或状态色的同义 Token。

### 交付自检

- [ ] 全部内容和模块是否来自 PRD，而非模板来源？
- [ ] 深色聚焦舞台是否仅在核心摘要契约成立时出现，并保护左右分区、纹理与操作层级？
- [ ] 零轴双向柱是否只承载真实方向关系，并使用主题主色与深色派生？
- [ ] 主图右侧摘要列是否有独立内容契约、竖分隔与移动端回退？
- [ ] 方向明细是否只使用真实方向，并保护圆形锚点、两级文本和等宽数字？
- [ ] 层叠实体卡是否只在真实对象与合法权限存在时出现，并完成脱敏？
- [ ] 每个组件或布局记忆点是否都有 `content_contract`、`render_policy`、迁移目标和回退策略？
- [ ] 舞台、7:3、2:1 和模块顺序是否未被写成全页面硬规则？
- [ ] 未触发组件是否没有强行渲染，迁移是否没有新增业务内容？
- [ ] 深色舞台、深色数据和实体主卡是否都从 `--color-brand1-6` 派生？
- [ ] `custom-page` 是否没有与全局层同值同义或角色重叠的 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] 主题身份、DNA、组件标题和总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的中等密度、充足局部留白、稳定圆角、轻阴影与高对比舞台是否与正文及 Token 一致？
- [ ] 所有 `neutral-gray` 是否满足 `R = G = B`，同主题深浅色是否声明种子、基底、比例与实例化要求？
- [ ] 所有真实页面是否共享全应用 Token，视觉记忆点是否按内容契约条件式落地？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开真实页面？
- [ ] 同类面板是否等高，图表是否固定高度，长内容是否内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 与深色派生实际值？
