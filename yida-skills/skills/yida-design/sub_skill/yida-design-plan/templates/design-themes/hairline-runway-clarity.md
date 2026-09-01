---
name: "{{PROJECT_NAME}}"
description: "以近白开放画布、无卡片分区、横纵发丝轨道、错位大数值和低饱和阶段条构成宽松、直接且高度秩序化的结构主题。"
themeId: "hairline-runway-clarity"
tokens:
  application-global:
    colors:
      "--color-white": "#FFFFFF"
      "--color-brand1-1": "AI 根据 --color-brand1-6 与白色混合生成 10% 品牌色"
      "--color-brand1-2": "AI 根据 --color-brand1-6 与白色混合生成 18% 品牌色"
      "--color-brand1-3": "AI 根据 --color-brand1-6 与白色混合生成 26% 品牌色"
      "--color-brand1-5": "AI 根据 --color-brand1-6 与黑色混合生成 18% 深色"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "AI 根据 --color-brand1-6 与黑色混合生成 12% 按下色"
      "--color-brand1-10": "AI 根据 --color-brand1-6 与白色混合生成 70% 禁用色"
      "--color-line1-1": "#EEEEEE"
      "--color-line1-2": "#DCDCDC"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E8E8E8"
      "--color-fill1-10": "rgba(255, 255, 255, 0.98)"
      "--color-text1-4": "#111111"
      "--color-text1-10": "#666666"
      "--color-text1-3": "#929292"
    typography:
      base:
        "--font-family-base": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
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
      "--corner-1": 3px
      "--corner-2": 6px
      "--corner-3": 10px
      "--corner-4": 14px
      "--corner-5": 18px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#FCFCFC"
      "--oyd-series-strong": "#2477D4"
      "--oyd-series-soft": "#A9D8F5"
      "--oyd-category-1": "#6F8BFF"
      "--oyd-category-2": "#74D4F3"
      "--oyd-category-3": "#B895EE"
      "--oyd-category-4": "#A5D9D2"
    typography:
      metric-primary:
        "--font-size-metric-primary": 30px
        "--font-weight-metric-primary": 600
        "--font-lineheight-metric-primary": 1.2
      metric-hero:
        "--font-size-metric-hero": 42px
        "--font-weight-metric-hero": 500
        "--font-lineheight-metric-hero": 1.15
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题把页面视为一张连续的近白信息画布，不依赖常规卡片堆叠。一级区域由贯穿宽度的 1px 发丝横线划分；同层摘要用竖向发丝线分栏；核心数据通过左侧超大数值锚与右侧淡化双层柱带形成不对称焦点；阶段或类别信息使用低饱和跑道条；明细则以文本标签、下划线选中态和轻量表格承接。页面整体留白宽松但数据密度中等，主题色仅用于主操作、焦点与选中，图表序列和等权类别色保持独立角色。布局通过统一分区内边距、固定可视高度和内部溢出维持稳定。

### 风格定位与应用说明

- 核心气质是开放、直接、平面且具有编辑式秩序；当真实内容同时包含摘要、一个主视觉量值、阶段分组与结构化明细时最能展现记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 迁移时保留连续画布、发丝分区、错位数据锚、淡化双层柱、阶段跑道和下划线筛选，不复制具体字段、数值、状态、对象或模块次序。
- 内容不匹配时只迁移平面表面、分隔、排版、间距与交互；无合法承载的视觉组件降级为 `recipe_only`，需要新增能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 连续画布发丝分区 | 一级内容直接落在统一近白画布上，区域之间由贯穿宽度的细横线划分，几乎没有外卡框。`observed`，高置信度 | 连续表面、整行分隔和统一水平内边距不可变；分区数量与内容由 PRD 决定。使用 section border 与父级 padding | 退化为常规圆角卡片墙，开放感和整体节奏消失 |
| 竖轨摘要带 | 同层摘要并排放置，以短竖线分隔，标签、数值与比较信息共享三条水平基线。`observed`，高置信度 | 无外框、内部竖线、同高三段基线不可变；摘要数量和内容可变。使用 grid 与 `border-inline-start` | 退化为浮动 KPI 卡片，平面编辑式语言被破坏 |
| 错位数据锚与淡化双层柱 | 左侧用超大数值建立锚点，右侧柱带由低透明全高柱与底部实色短柱叠加，浮层悬于数据上方。`observed`，高置信度 | 左右不对称、双层柱和白色浮层不可变；时间范围、序列和值可变。使用主辅 grid、absolute 双柱与 portal tooltip | 变成普通柱图面板，主数值与趋势之间失去张力 |
| 阶段跑道组 | 多个阶段横向并列，每项先显示细色标、名称与数值，再以低饱和圆角长条压住底部。`observed`，高置信度 | 顶部元信息＋底部长跑道的两层结构不可变；阶段数、比例、标签与分类色可变。使用等分 grid 和固定轨高 | 退化为默认进度条列表，缺少横向推进节奏 |
| 下划线筛选账册 | 文本型筛选项位于表格上方，激活项以短黑线压底；搜索与导出贴右，明细行无卡片化。`observed`，高置信度 | 文本标签、底部选中线、右侧工具和轻表格不可变；标签、列和操作由 PRD 决定。使用 tablist 与语义 table | 退化为胶囊标签和卡片行，轻量连续性消失 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 连续画布发丝分区 | `content_contract`: 页面存在两个以上可按阅读顺序独立分组的真实内容区 | `render_policy: adapt_existing_slot`；`direct_trigger`: 已有一级内容区块 | `transferable_mechanism`: 统一表面、整行发丝线、共享水平内边距；`adaptation_targets`: 页面现有 section、`primary_content_panel`、`detail_table` | `fallback`: 保留 PRD 原结构但迁移表面语言；`forbidden`: 为制造分区新增模块 |
| 竖轨摘要带 | `content_contract`: 存在 2-4 个同层级摘要值及可选比较信息 | `render_policy: prd_match_only`；`direct_trigger`: 同屏摘要集合 | `transferable_mechanism`: 无外框等分栏、内部竖线、三段基线；`adaptation_targets`: `primary_metrics` | `fallback`: 显示已有摘要但不强制并排；`forbidden`: 凑数新增指标或比较基准 |
| 错位数据锚与淡化双层柱 | `content_contract`: 存在一个总量锚点和两条可按同一横轴比较的真实序列 | `render_policy: prd_match_only`；`direct_trigger`: 总量与配对时序数据同时存在 | `transferable_mechanism`: 左侧大数值、右侧双层柱、浮层与轻轴；`adaptation_targets`: `primary_content_panel`、已有趋势槽位 | `fallback`: 仅显示真实总量或单序列图；`forbidden`: 推算第二序列、时间轴或总量 |
| 阶段跑道组 | `content_contract`: 存在 2-5 个有顺序或同层比较关系的阶段/类别及量值 | `render_policy: adapt_existing_slot`；`direct_trigger`: 真实阶段或类别集合 | `transferable_mechanism`: 元信息顶排、细色标、底部长跑道；`adaptation_targets`: 状态摘要、分组进度、流程概览 | `fallback`: 使用普通分组列表；`forbidden`: 为保持跑道数量创造阶段或百分比 |
| 下划线筛选账册 | `content_contract`: 存在可筛选的结构化记录和至少两个真实筛选维度 | `render_policy: prd_match_only`；`direct_trigger`: 筛选集合与记录列表同时存在 | `transferable_mechanism`: 文本 tab、短下划线、贴右工具、轻表格；`adaptation_targets`: `detail_table`、已有数据列表 | `fallback`: 保留原筛选和列表；`forbidden`: 新增筛选、字段、记录或导出能力 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；本主题使用高对比文字、极轻边界、紧凑圆角与宽松区块间距形成平面秩序。`tokens.custom-page` 只补充近白连续画布、两枚独立数据序列色、四枚等权阶段色和两级指标数字：序列色与阶段色用于真实数据编码而非主题或状态；两级指标数字是全局字体体系没有的大数值语义，因此不与全局 Token 重复。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 页面使用 `--oyd-page-background` 作为连续画布，必要浮层与控件使用 `--color-white`；区域层级依靠 `line1` 发丝线，而不是卡片背景或阴影。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 主按钮、关键焦点、链接和选中强调 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用 | `--color-brand1-10` | 应用全局 |
| 全宽分区线、表格行线与轻辅助线 | `--color-line1-1` | 应用全局 |
| 控件与浮层常规边界 | `--color-line1-2` | 应用全局 |
| 悬停、弱标签和淡化表头 | `--color-fill1-1` | 应用全局 |
| 中性选中底与按下填充 | `--color-fill1-2` | 应用全局 |
| 禁用轨道与骨架占位 | `--color-fill1-3` | 应用全局 |
| tooltip、popover 和菜单表面 | `--color-fill1-10` | 应用全局 |
| 标题、核心数值、正文与主要图标 | `--color-text1-4` | 应用全局 |
| 表头、输入占位和次级标签 | `--color-text1-10` | 应用全局 |
| 时间、说明、坐标和比较基准 | `--color-text1-3` | 应用全局 |
| 连续近白页面画布 | `--oyd-page-background` | 自定义页 |
| 双层柱的强、弱配对序列 | `--oyd-series-strong`、`--oyd-series-soft` | 自定义页 |
| 阶段跑道与对应细色标 | `--oyd-category-1` 至 `--oyd-category-4` | 自定义页 |

`--color-brand1-6` 是唯一品牌色种子。最终项目实例化时必须把其余六枚 Brand Token 的生成期标记解析为实际色值；没有品牌色时使用中等明度、满足对比的暖色作为主操作锚点。换色后至少 90% 的画布、文字、分隔与表格保持中性，独立数据色不参与主题同色推演。

### 本主题的配色约束

- `--color-white`、所有 `line1`、`fill1`、`text1` 与 `--oyd-page-background` 均为 `neutral-gray`；固定 Hex 的 RGB 三通道相等。
- 本主题不声明固定偏色灰或 `theme-gray`；主题色的浅深变化全部由七枚 Brand Token 承担，并在实例化时写入实际值。
- `--oyd-series-strong` 与 `--oyd-series-soft` 是一组具有强弱关系的独立数据序列色，仅用于真实配对序列；弱序列允许 22%-36% 透明度，强序列保持实色。
- `--oyd-category-1` 至 `--oyd-category-4` 为等权独立分类色，只用于阶段跑道、细色标和必要图例；单屏每种色面积不超过 8%。
- 主题色只用于主操作、焦点、链接和选中状态；成功、警告、错误和信息状态直接消费平台语义色，并配合文字、图标或方向符号。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 使用 `tokens.application-global.typography.subhead`：24px / 600 / 1.3；普通页面不引入展示型标题。
- `panel-title` 使用 `tokens.application-global.typography.body-2`：16px / 600 / 1.4；用于分区标题与重点标签。
- `content-title` 和正文使用 `tokens.application-global.typography.body-1`：14px / 400 / 1.5；内容标题只提高字重到 600。
- 表格使用 `tokens.application-global.typography.table`：14px / 400 / 1.45；表头使用同字号、500 字重。
- 辅助说明使用 `tokens.application-global.typography.caption`：12px / 400 / 1.4。
- 常规摘要使用 `tokens.custom-page.typography.metric-primary`：30px / 600 / 1.2；主视觉总值使用 `metric-hero`：42px / 500 / 1.15。二者都是全局排版未覆盖的数据语义，不得用于页面标题。
- 数值使用 `font-variant-numeric: tabular-nums`；小数的次要部分可使用 `--color-text1-3`，但保持同一字号和基线。
- 标题单行省略；副标题最多两行；表格长文本单行省略并通过 tooltip 或详情操作提供完整信息。
- 图标为 1.75px 线性描边、圆角端点；常规 18px、强调 20px，与文字首行光学居中。

## 布局与间距

- 页面水平安全边距使用 `--s-8`，垂直区块内边距使用 `--s-6` 至 `--s-8`；小组 gap 用 `--s-4`，行内元素 gap 用 `--s-2` 或 `--s-3`。
- 最大内容宽度建议 1760px；一级分区共享相同左右边线，使用 `width:100%`，不在每个区块外再套卡。
- 同层摘要契约满足时使用 2-4 个等分单元，以内部竖线分隔；数量变化时重新等分，不保留空列。
- 主视觉总值与时序数据同时存在时，桌面使用约 `28% / 72%` 不对称分栏；契约不成立时按 PRD 原内容模式组织。
- 页面标题、全局操作、摘要、主视觉、阶段组、筛选和明细是否出现及顺序由 PRD 决定。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items:stretch`；内容容器统一 `min-width:0; min-height:0`，需要面板语义时使用 `height:100%; display:flex; flex-direction:column`。
- `metric_card` 在本主题表现为无外框摘要单元，建议高 120-148px；错位数据锚主视觉建议高 360-440px；`chart_panel` 固定高 280-340px；`detail_panel` 建议高 260-360px；可选 `quick_action_item` 高 64-80px。
- 图表、表格和列表在分区内部滚动或分页；图表容器确定高度，表头可 sticky，长文本截断，不得撑破连续画布。
- 区块节奏由 section padding 和父级 gap 管理，不用零散外边距拼接。
- ≥1280px：摘要 3-4 列，数据锚与图表按 28/72 布局，阶段跑道 3-5 列；960-1279px：摘要 2 列，数据锚与图表改为 34/66 或按契约上下堆叠；<960px：全部单列，数据锚位于图表前，阶段跑道两列。
- <640px：阶段跑道单列；筛选 tab 横向滚动，搜索与操作另起一行；表格在内部横向滚动，不强制转卡片；触控目标最小 40×40px。
- 移动端可解除桌面等高，但沿用同一内容契约、控件高度、下划线选中、文本截断和内部溢出策略。

## 表面与层级

- 页面使用连续 `--oyd-page-background`，一级分区不设卡片边框、圆角或阴影；上下只使用 1px `--color-line1-1` 发丝分隔。
- 控件和 tooltip 是少数独立表面：白底、1px `--color-line1-2`、`--corner-3`；tooltip 可使用 `0 8px 24px rgba(0,0,0,.08)`。
- 表格表头保持透明或极浅填充，数据行无独立表面；状态标签和头像使用局部轮廓，不形成卡片层。
- 禁止大面积渐变、玻璃模糊、投影卡阵列和多层嵌套边框；低饱和跑道条允许轻微同色明度渐变。
- 同一分区内部优先用留白、对齐和发丝线分层，嵌套轮廓最多一层。

## 圆角与形状

- `--corner-1` 3px：图例色块、细标记和微型柱。
- `--corner-2` 6px：表格头像、复选框和紧凑行内状态。
- `--corner-3` 10px：输入框、按钮、选择器和 tooltip。
- `--corner-4` 14px：少量独立浮层和提示容器。
- `--corner-5` 18px：仅用于需要强独立性的弹窗或大浮层，不用于一级分区。
- `--corner-circle` 用于头像与圆点；`--corner-semicircle` 用于状态标签、阶段跑道和文本选中指示器。
- 一级分区保持直角连续表面；禁止给每个 section 随机添加大圆角。

## 组件

### 按钮与操作

- 迷你或行内按钮 28px、紧凑工具栏按钮 32px、常规按钮 36px、强调或宽松按钮 40px；图标按钮使用对应正方形档位。
- 主按钮使用 `--color-brand1-6` 与白字，可采用直角感较强的 `--corner-2` 或 `--corner-3`；次按钮白底、常规边界和一级文字。同一操作区只保留一个视觉主操作。
- hover 使用 `--color-brand1-1` 或 `--color-fill1-1`；active 使用 `--color-brand1-9` 或 `--color-fill1-2`；focus 显示 2px 主题色外环并留 2px 间隔。
- disabled 保留边界与可读文字，使用禁用色或中性填充，不只降低透明度；图标与文字间距 8px。

### 输入与筛选控件

- 紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px；不得出现其他高度。
- 控件使用白底、1px `--color-line1-2`、`--corner-3`，placeholder 使用 `--color-text1-10`。
- focus 通过 2px 外环表达，不改变控件尺寸；error 同时显示平台错误色边界、图标和说明文字。
- 筛选 tab 优先文本型并以底部 2px 选中线表达；不要默认改为胶囊按钮组。

### 卡片与面板

- 一级内容不做卡片，直接成为连续画布中的 section；内边距 24-32px，上下用发丝线分隔。
- 只有 tooltip、popover、modal 或强独立嵌套内容才使用白底、10-18px 圆角和局部阴影。
- 标题区与内容区间隔 16-24px；不能把每段内容、每个指标或每行记录都包成卡。

### 连续画布发丝分区

- `content_contract`: 两个以上真实一级内容区；`render_policy: adapt_existing_slot`。
- 每个 section 使用统一水平内边距，上下边界为 1px `--color-line1-1`；相邻 section 共享边界，避免双线。
- 标题、工具和内容共用同一左边线；内部用 16-32px 留白分组，不再叠加外卡框。
- hover 不作用于整个 section；不可替换成圆角投影面板阵列。

### 竖轨摘要带

- `content_contract`: 2-4 个同层级摘要及可选比较值；`render_policy: prd_match_only`。
- 无外框等分 grid，每个单元高 120-148px；除首项外使用 1px 竖线分隔，左右内边距 24-32px。
- 采用“标签 / `metric-primary` 数值 / 趋势＋基准”三段基线；趋势必须使用平台语义色、方向图标和文字。
- 单元 hover 只改变局部文字或弱底，不生成卡片阴影；不可拆成独立悬浮卡。

### 错位数据锚与淡化双层柱

- `content_contract`: 一个真实总量和两条共享横轴的真实序列；`render_policy: prd_match_only`。
- 外层使用约 28/72 grid；左侧大数值靠近底部基线，右侧柱带占据固定 280-340px 高度。
- 每个横轴位置叠放一根低透明全高柱和一根实色底部短柱，宽 10-14px，gap 10-16px；弱序列在后、强序列在前。
- tooltip 为白底局部浮层，显示时间键、图例色标和右对齐值；位置不遮挡选中柱，键盘聚焦可触发。
- 不可替换成常规卡片柱图、饼图或面积图；只有单序列时保留大数值锚并降级为单层柱。

### 阶段跑道组

- `content_contract`: 2-5 个有顺序或可并列比较的真实阶段/类别；`render_policy: adapt_existing_slot`。
- 每项由细竖色标、名称、主值、辅助比例和底部 16-20px 高跑道组成；元信息与跑道间距 12px。
- 跑道使用对应独立分类色的低饱和同色渐变，端部圆角 4-6px；同一行所有跑道等高且铺满各自列宽。
- 状态与阶段必须有文字，不只靠颜色；不可替换为竖向柱、默认进度条或彩色卡片。

### 下划线筛选账册

- `content_contract`: 可筛选结构化记录；`render_policy: prd_match_only`。
- tablist 高 48px，项目使用文本标签和 0 背景；选中项以 2px `--color-text1-4` 下划线、600 字重和 `aria-selected` 表达。
- 搜索与次操作贴右并与 tab 基线对齐；表头高 48px，数据行高 56-60px，只画横向弱分隔。
- 首列可包含复选框、28px 中性头像和名称；状态使用细描边胶囊＋图标/文字；数字右对齐。
- 表体内部滚动、表头 sticky、长文本省略；不可把 tab 改成彩色胶囊或把数据行做成卡片。

### 图表或主内容面板

- 图表必须由 PRD 的真实数据触发；本主题优先使用低饱和双层柱、极少轴线、简洁图例和白色 tooltip。
- 图表固定高 280-340px；弱基线使用 `--color-line1-1`，轴与说明使用 `--color-text1-3`，配对序列使用 `--oyd-series-strong` 与 `--oyd-series-soft`。
- 没有配对序列时使用单序列并保留留白和轻轴；没有图表契约时用表格、列表、表单或详情承载主内容。

### 表格与列表

- 表头 48px、数据行 56-60px；仅使用横向 `--color-line1-1`，不画纵向网格，不为整表加圆角卡壳。
- 行 hover 使用 `--color-fill1-1`，selected 使用 `--color-brand1-3` 并保留选择控件；状态同时使用文字或图标。
- 头像或缩略图仅在 PRD 提供真实素材时出现，建议 28-32px；尾部操作使用 28px 图标按钮并提供可访问名称。
- 数字等宽、长文本省略、表体内部滚动；加载骨架与真实行同高，避免列宽跳动。

### 快捷入口（推断）

- 未形成独立快捷入口母体，因此不默认生成。若 PRD 明确存在 `quick_actions`，仅保留 `inferred / render_policy: recipe_only` 配方：在连续 section 中以文本操作或 40px 描边按钮排列，不创建彩色宫格。
- 数量建议 2-4 个；移动端单列或横向滚动；禁止为填充布局新增操作。

### 状态与交互

- 悬停：文字、下划线或弱背景在 120-160ms 内变化，不产生卡片抬升。
- 按下：使用品牌按下色或中性点击底，可 `translateY(1px)`，不改变占位。
- 聚焦：控件显示 2px 高对比 focus ring；tab、图表数据点和纯图标按钮均可键盘访问并有可访问名称。
- 加载：保持 section、图表和表格高度；双层柱、跑道和行使用稳定骨架，避免全宽布局跳动。
- 空态与错误：保留标题、工具和区域边线，提供简短说明与下一步操作，不新增整卡状态背景。
- 禁用与选中：保留轮廓、文字和状态标记；选中不只依赖颜色，tab 同时使用下划线和字重。
- 动效：颜色与边线 120-180ms，tooltip 160-220ms；`prefers-reduced-motion` 下取消位移和柱高补间。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务和内容上下文，不决定主题资格。原生页面和自定义页面共同继承全应用文字、边界、间距、圆角和交互；自定义页仅在内容契约成立时采用连续发丝分区、竖轨摘要、错位数据锚、阶段跑道或下划线账册。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉承载。单列、列表、表单、详情、流程或其他真实结构均应保留，不能为了代表构图创建不存在的内容。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时仅展开项目真实存在的页面。每页说明 `page_identity`、`global_actions`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table` 或 `detail_list` 等真实槽位的位置、跨度、建议高度、移动端顺序和采用的 1-3 个视觉 DNA；未匹配的母体不渲染。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；没有素材时使用结构化数据或中性占位，不编造对象、指标、状态、记录或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护连续近白画布、贯穿发丝线、共享左右边线、宽松区块留白和小面积主题焦点。
- 摘要契约成立时保护无外框等分栏、内部竖线和三段数据基线。
- 配对时序契约成立时保护左侧大数值锚、右侧双层柱、轻轴与白色 tooltip。
- 阶段契约成立时保护细色标、顶部元信息与底部长跑道；筛选账册契约成立时保护文本 tab、下划线选中和轻表格。
- 保护父级拉伸、固定图表高度、面板内部溢出、完整状态、响应式和可访问性。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让主题文件覆盖 PRD 的字段、模块、数据和优先级。
- 禁止把主题色铺满背景、普通 section 或表格行；禁止把独立图表色和阶段色当作主题身份。
- 禁止把固定摘要列数、28/72 图表比例、阶段数或模块顺序写成所有页面硬规则。
- 禁止给每个一级区块加圆角卡、阴影和独立背景，或把竖轨摘要拆成悬浮卡片。
- 禁止把双层柱替换成默认柱图，把阶段跑道变成通用进度条，把下划线 tab 改成彩色胶囊。
- 禁止瀑布流、自由高度同类区块、`align-items:start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台卡片墙、玻璃模糊、重投影、大面积装饰渐变和组件库默认样式漂移。

### 错误与正确

- 错误：每个 section 都是一张圆角投影卡；正确：一级内容共享连续画布，仅以全宽发丝线划分。
- 错误：摘要各自悬浮；正确：摘要无外框等分，并以短竖线和三段基线建立秩序。
- 错误：主数值塞进图表标题栏；正确：左侧建立独立大数值锚，右侧保留淡化双层柱和轻轴。
- 错误：阶段只显示普通进度条；正确：使用细色标、名称、主值、辅助值和底部长跑道组成完整单元。
- 错误：筛选使用高饱和胶囊；正确：使用文本标签、短下划线和贴右工具连接轻表格。
- 错误：所有页面强制使用代表性结构；正确：内容契约成立时使用对应母体，否则保留 PRD 页面模式。
- 错误：主题色铺满页面；正确：主题色只连接主操作、焦点和选中，大部分画布保持中性。
- 错误：同类内容随高度自由生长；正确：桌面网格拉伸，图表定高，长内容在内部滚动或截断。
- 错误：快捷入口使用彩色宫格；正确：仅在 PRD 触发时以连续 section 内的文本或描边操作呈现。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成七枚实际 Brand Token。所有真实页面先继承全应用 Token 与基础组件语言，再按内容契约选择连续发丝分区、竖轨摘要、错位数据锚与淡化双层柱、阶段跑道或下划线筛选账册。代表构图只是视觉配方，不用于创造字段、指标、序列、阶段、筛选、记录或操作；主题色只替换交互色相，不改变连续画布、平面层级、错位构图、留白、形状和发丝轨道。字号与控件尺寸按平台 Token 范围推断，不把图片物理像素当作 CSS 像素。

### 交付自检

- [ ] 全部页面内容、字段和模块是否来自 PRD，而非模板来源？
- [ ] 一级内容是否共享连续画布，并以贯穿发丝线而非卡片墙分区？
- [ ] 摘要是否在契约成立时保持无外框等分、内部竖线和三段基线？
- [ ] 主视觉是否在契约成立时保持大数值锚、淡化双层柱、轻轴和白色 tooltip？
- [ ] 阶段跑道是否保留细色标、顶部元信息、等高长条和非纯颜色标识？
- [ ] 筛选账册是否保留文本 tab、短下划线、贴右工具和无卡片数据行？
- [ ] 每个视觉组件及不对称布局是否都有 `content_contract`、`render_policy`、适配目标、回退与禁止项？
- [ ] 未被 PRD 触发的母体是否没有强行渲染，且未新增业务能力或假数据？
- [ ] 主操作、焦点和选中是否共享 `--color-brand1-6`，其余画布是否保持中性？
- [ ] 数据序列色和阶段分类色是否仅用于真实等权类别，平台状态色是否未重复定义？
- [ ] 所有固定灰色是否为三通道相等的 `neutral-gray`，且没有未声明偏色灰？
- [ ] `application-global` 语义是否稳定，`custom-page` 是否没有同值同义或角色重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、DNA、组件标题和正文总结是否与默认色相及页面类型解耦？
- [ ] 同类区块是否等高、网格是否拉伸、图表是否定高、长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引起布局跳动？
- [ ] 三档以上响应式规则、移动端触控、键盘访问、非纯颜色状态与 reduced motion 是否达标？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在页面，没有枚举不存在的页面？
- [ ] 最终项目实例化时是否替换全部占位符并把七枚 Brand Token 写为实际色值？
