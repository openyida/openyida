---
name: "{{PROJECT_NAME}}"
description: "以近白画布、轻悬浮圆角表面、独立摘要卡、比例分段带与虚线分隔账册构成中高密度、清晰且具有柔和空间感的结构主题。"
themeId: "ribbon-ledger-lift"
tokens:
  application-global:
    colors:
      "--color-white": "#FFFFFF"
      "--color-brand1-1": "AI 根据 --color-brand1-6 与白色混合生成 10% 品牌色"
      "--color-brand1-2": "AI 根据 --color-brand1-6 与白色混合生成 18% 品牌色"
      "--color-brand1-3": "AI 根据 --color-brand1-6 与白色混合生成 26% 品牌色"
      "--color-brand1-5": "AI 根据 --color-brand1-6 与黑色混合生成 16% 深色"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "AI 根据 --color-brand1-6 与黑色混合生成 12% 按下色"
      "--color-brand1-10": "AI 根据 --color-brand1-6 与白色混合生成 68% 禁用色"
      "--color-line1-1": "#EEEEEE"
      "--color-line1-2": "#DEDEDE"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F3F3F3"
      "--color-fill1-3": "#EAEAEA"
      "--color-fill1-10": "rgba(255, 255, 255, 0.97)"
      "--color-text1-4": "#151515"
      "--color-text1-10": "#626262"
      "--color-text1-3": "#8A8A8A"
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
      "--corner-1": 4px
      "--corner-2": 8px
      "--corner-3": 12px
      "--corner-4": 16px
      "--corner-5": 20px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#FAFAFA"
      "--oyd-lift-shadow": "rgba(0, 0, 0, 0.06)"
      "--oyd-category-1": "#8661F1"
      "--oyd-category-2": "#4B77F3"
      "--oyd-category-3": "#2BCB7E"
      "--oyd-category-4": "#F2B637"
    typography:
      metric-primary:
        "--font-size-metric-primary": 30px
        "--font-weight-metric-primary": 600
        "--font-lineheight-metric-primary": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以近白画布和白色圆角表面建立安静背景，通过极细边界、低扩散阴影和稳定留白制造轻微悬浮感。页面整体为中高密度：顶部摘要使用彼此独立、内部宽松的卡片；主体信息使用虚线分隔的轻账册，而非重网格；多类别比例以一条大圆角分段带和对应的微型量轨建立视觉焦点；辅助事件以小尺寸主题浅底图标对齐。主题色只承担焦点、选中、链接与少量图标，等权类别色限于分段带、量轨和标记。所有区域使用拉伸网格与面板内溢出，保持横纵基线稳定。

### 风格定位与应用说明

- 核心气质是轻盈、精确、克制而不僵硬；同屏存在摘要、结构化明细、类别构成和短事件时最能展现视觉记忆点，但这不是使用门槛。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 迁移时保留独立浮层摘要、圆角分段带、虚线轻账册、带量轨的类别行和图标事件轨，不复制字段、类别、数值、时间或模块顺序。
- 内容不匹配时仅将轻表面、留白、边界、圆角和交互迁移至已有槽位；不能合法承载的组件保留为 `recipe_only`，涉及新能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 独立悬浮摘要列 | 多枚同高摘要卡在宽松横向网格中独立成面，标签在上、数值居中、变化信息沉底。`observed`，高置信度 | 独立表面、统一高度、三段垂直基线不可变；数量、文案和数值可由 PRD 替换。使用 `grid-auto-rows:1fr` 与卡片内 flex | 退化为拥挤小卡或无层级数字行，失去轻悬浮节奏 |
| 比例圆角分段带 | 多个不同比例的高色块在同一圆角轨道内并排，每段以细间隙分开。`observed`，高置信度 | 单一外壳、比例宽度、圆角块和受控间隙不可变；段数、比例、标签与类别色可变。使用 CSS Grid 或 flex-basis | 变成饼图或普通图例，横向构成焦点消失 |
| 虚线轻账册 | 圆角浅填充表头下方为无竖线的数据行，行间仅用细虚线分隔，首列可带语义图标。`observed`，高置信度 | 浅表头、无纵向网格、虚线行界和对齐列不可变；字段和图标按 PRD 变化。使用 CSS Grid 行模板或语义 table | 退化为重边框表格，空气感与扫读速度下降 |
| 量轨类别行 | 每个类别行同时含色标、名称、短比例轨、次级说明和右对齐双层数值。`observed`，高置信度 | 五段式对齐和短量轨不可变；类别数、文案、比例和独立色可变。使用嵌套 grid 与 `minmax(0,1fr)` | 退化为单纯图例或数字清单，构成关系不再直观 |
| 图标事件轨 | 紧凑事件行以小型浅色图标为锚，主副文本左对齐，时间独立贴右，行间以虚线连接节奏。`observed`，高置信度 | 图标锚、两级文本、右侧时间和虚线节奏不可变；事件内容、状态和图标可变。使用列表语义与三列 grid | 退化为无锚文本流或卡片堆叠，辅助区显得散乱 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 独立悬浮摘要列 | `content_contract`: PRD 存在 2-5 个同层级核心摘要及可选比较信息 | `render_policy: prd_match_only`；`direct_trigger`: 可同屏比较的摘要集合 | `transferable_mechanism`: 独立卡面、统一高度、三段基线；`adaptation_targets`: `primary_metrics`、现有摘要槽位 | `fallback`: 使用 PRD 原摘要形式；`forbidden`: 为凑列数新增指标或比较值 |
| 比例圆角分段带 | `content_contract`: 存在 2-6 个互斥类别，比例总和有可靠分母 | `render_policy: prd_match_only`；`direct_trigger`: 真实类别构成数据 | `transferable_mechanism`: 单壳比例分段、圆角端部、受控间隙；`adaptation_targets`: 构成、容量分配、阶段占比 | `fallback`: 仅显示真实数值列表；`forbidden`: 推测类别、总量或比例 |
| 主体与辅助轨布局 | `content_contract`: PRD 同时含高权重明细和独立短摘要、构成或事件信息 | `render_policy: prd_match_only`；`direct_trigger`: 主辅内容均真实存在且可独立折叠 | `transferable_mechanism`: 桌面约 2:1 分栏、同顶线、侧轨纵向堆叠；`adaptation_targets`: `primary_content_panel`、`supporting_panel` | `fallback`: 恢复 PRD 单列或原网格；`forbidden`: 为保留侧轨拆散主要任务 |
| 虚线轻账册 | `content_contract`: 存在多字段、重复记录、情景或明细数据 | `render_policy: adapt_existing_slot`；`direct_trigger`: 真实结构化行列数据 | `transferable_mechanism`: 浅表头、无竖线、虚线行界、图标首列；`adaptation_targets`: `detail_table`、比较列表、结果清单 | `fallback`: 保留现有列表但迁移行距与分隔；`forbidden`: 编造字段、记录、计算结果或操作 |
| 量轨类别行 | `content_contract`: 类别同时具备名称、占比和至少一个补充量值 | `render_policy: recipe_only`；`direct_trigger`: 类别构成与补充值均存在 | `transferable_mechanism`: 色标、短量轨、双层说明和右对齐值；`adaptation_targets`: `supporting_panel`、分组摘要 | `fallback`: 仅保留配方或降级为文本行；`forbidden`: 派生未经 PRD 定义的附加指标 |
| 图标事件轨 | `content_contract`: 存在可按时间排序的事件、提醒或状态变化 | `render_policy: adapt_existing_slot`；`direct_trigger`: 真实事件流数据 | `transferable_mechanism`: 小图标锚、两级文本、贴右时间、虚线行界；`adaptation_targets`: `detail_list`、消息、更新记录 | `fallback`: 使用 PRD 原列表；`forbidden`: 新增消息源、时间或虚构事件 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；变量名和语义稳定，本主题值强调高对比文字、轻边界、较大圆角、克制阴影与中高密度。`tokens.custom-page` 仅补充近白画布、轻浮层阴影色、四枚等权分类色和大指标数值语义：阴影色是全局颜色体系没有的材质角色；分类色承担真实类别区分而非状态；大指标数值是全局排版未覆盖的独立语义，因此均不与全局 Token 重复。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- `--oyd-page-background` 承载底层画布，`--color-white` 承载所有一级表面；`line1` 只做细轮廓与虚线分隔，空间层级由白度、边界和低扩散阴影共同建立。

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
| 虚线行界、弱辅助线与微量轨底 | `--color-line1-1` | 应用全局 |
| 输入、按钮和一级面板边界 | `--color-line1-2` | 应用全局 |
| 菜单悬停、弱标签和表头浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底与按下填充 | `--color-fill1-2` | 应用全局 |
| 次级轨道与稳定骨架 | `--color-fill1-3` | 应用全局 |
| tooltip、popover 和菜单表面 | `--color-fill1-10` | 应用全局 |
| 标题、核心数字、正文与主要图标 | `--color-text1-4` | 应用全局 |
| 表头、输入占位与次级标签 | `--color-text1-10` | 应用全局 |
| 时间、说明、比较基准与元信息 | `--color-text1-3` | 应用全局 |
| 页面底层近白画布 | `--oyd-page-background` | 自定义页 |
| 轻悬浮卡片的低扩散阴影 | `--oyd-lift-shadow` | 自定义页 |
| 等权类别的分段块、量轨和色标 | `--oyd-category-1` 至 `--oyd-category-4` | 自定义页 |

`--color-brand1-6` 是唯一品牌色种子。最终项目实例化时必须把其余六枚 Brand Token 的生成期标记解析为实际色值；若无品牌色，默认以中等明度、满足对比的蓝色为锚点。换色后至少 88% 的画布与表面保持中性，四枚独立分类色不参与主题同色推演。

### 本主题的配色约束

- `--color-white`、`line1`、`fill1`、`text1` 与 `--oyd-page-background` 均为 `neutral-gray`；所有固定 Hex 的 RGB 三通道相等。
- `--oyd-lift-shadow` 是 `neutral-gray` 透明色，前三通道相等，仅用于低扩散阴影，不参与主题推演。
- `--oyd-category-1` 至 `--oyd-category-4` 为等权独立分类色，只能用于真实类别的分段块、短量轨、图标或小色标；每种颜色单屏面积不超过 8%。
- 主题同色演变由 `--color-brand1-6` 派生，主色只用于主操作、焦点、链接、选中和少量语义图标，不铺满画布、普通卡片或表格行。
- 成功、警告、错误和信息状态直接消费平台语义色，并同时使用文字、图标或方向符号；不在 `custom-page` 重复定义。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 使用 `tokens.application-global.typography.subhead`：24px / 600 / 1.3；普通页面不得放大为展示标题。
- `panel-title` 使用 `tokens.application-global.typography.body-2`：16px / 600 / 1.4；英文或缩写型面板标题可使用同字号、600 字重和正常字距，不强制全大写。
- `content-title` 与正文使用 `tokens.application-global.typography.body-1`：14px / 400 / 1.5；内容标题只提高字重至 600。
- 表格使用 `tokens.application-global.typography.table`：14px / 400 / 1.45；表头使用同字号、500 字重和 `--color-text1-10`。
- 辅助说明使用 `tokens.application-global.typography.caption`：12px / 400 / 1.4。
- 核心摘要使用 `tokens.custom-page.typography.metric-primary`：30px / 600 / 1.2；全局字体体系没有大指标数字语义，因此单独补充，不能用于页面标题。
- 数值使用 `font-variant-numeric: tabular-nums`；同列数字右对齐，单位与数值保持 8px 间距，正负号不换行。
- 标题单行省略；主副文本组的副文本最多两行；表格长文本单行省略，并通过 tooltip 或详情操作提供完整信息。
- 图标采用 1.75px 线性描边与圆角端点；常规 18px，强调 20px，小事件图标 16px，与文字首行光学居中。

## 布局与间距

- 页面安全边距使用 `--s-6`，内容最大宽度建议 1720px；主区块 gap 使用 `--s-6`，卡片内边距使用 `--s-6`，数据行内 gap 使用 `--s-3`，紧凑图标与文字使用 `--s-2`。
- 所有父级网格使用 `minmax(0,1fr)` 和统一 `gap`；同层卡片严格等高，内容不得决定外层列宽。
- 摘要内容契约满足时，≥1280px 可排 4 列；数量与宽度不足时按真实数量降为 2-3 列，不能为了保留四列缩小文字。
- 主体与辅助轨内容契约同时成立时，桌面使用约 `minmax(0,2fr) minmax(320px,1fr)`；辅助轨只包含可独立阅读和压缩的短内容。
- 页面标题、操作、摘要、主要内容与辅助内容是否出现及顺序由 PRD 与页面模式决定，不预置业务模块。

### 布局稳定性硬规则

- 桌面端主网格使用 `align-items:stretch`；面板统一 `height:100%; min-width:0; min-height:0; display:flex; flex-direction:column`，标题区固定，内容区 `flex:1; min-height:0`。
- `metric_card` 建议高 156-188px；比例分段带所在 `detail_panel` 建议高 460-620px；主要账册 `primary_content_panel` 建议高 520-700px；事件 `detail_panel` 建议高 300-420px；可选 `quick_action_item` 高 72-88px。
- 图表若由 PRD 触发，容器固定高 280-360px；表格、列表与事件轨超长时在面板内部滚动或分页，表头可 sticky，长文本截断。
- 父级 grid/flex 的 `gap` 管理区块节奏，不使用零散 `margin-top` 或 `margin-bottom`。
- ≥1280px：摘要 3-4 列，主辅约 2:1；960-1279px：摘要 2 列，主辅可按同一契约调整为 58/42，辅助区内部减少元信息；<960px：主辅单列，辅助区紧随相关主内容。
- <640px：摘要单列或两列；工具栏换行；表格与账册在面板内横向滚动而非强制卡片化；按钮按角色维持 32/36/40px，触控目标最小 40×40px。
- 移动端可解除桌面等高，但必须延续同一 `content_contract`、文本截断、稳定控件高度与内部溢出策略。

## 表面与层级

- 页面底层使用 `--oyd-page-background`，一级面板使用白底、1px `--color-line1-2` 边界、20px 圆角和 `0 6px 18px --oyd-lift-shadow`。
- 摘要卡允许使用上述完整轻阴影；大型内容面板将阴影减弱为 `0 4px 14px --oyd-lift-shadow`，避免大面积浮起。
- 嵌套表头、提示条和次级行容器使用 `--color-fill1-1` 或白底、1px `--color-line1-1`；同一区域最多两层轮廓。
- tooltip、popover 与菜单使用 `--color-fill1-10`、`--color-line1-2` 和 `0 8px 24px rgba(0,0,0,.08)`。
- 分段带内可使用同一独立分类色的轻微明度渐变，但禁止玻璃模糊、霓虹辉光、强纹理与大面积主题渐变。

## 圆角与形状

- `--corner-1` 4px：短色标、微型刻度和极小状态点。
- `--corner-2` 8px：表头外壳、行内标签、28/32px 工具按钮。
- `--corner-3` 12px：输入框、选择器、提示条和嵌套小容器。
- `--corner-4` 16px：分段带外壳、辅助卡与事件面板。
- `--corner-5` 20px：摘要卡和一级大面板。
- `--corner-circle` 用于图标浅底、头像和状态点；`--corner-semicircle` 用于分段块、量轨、状态标签和胶囊选择器。
- 同一网格层级使用一致圆角；不把普通内容块做成随机超大胶囊。

## 组件

### 按钮与操作

- 迷你或行内操作 28px、紧凑工具栏 32px、常规按钮 36px、强调或宽松操作 40px；图标按钮使用相应正方形档位，不得出现其他高度。
- 主按钮使用 `--color-brand1-6` 与白字；次按钮使用白底、`--color-line1-2` 边界和一级文字。同一操作区只保留一个视觉主操作。
- hover 使用 `--color-brand1-1` 或 `--color-fill1-1`，active 使用 `--color-brand1-9` 或 `--color-fill1-2`；focus 显示 2px 主题色外环并留 2px 间隔。
- disabled 保留边界和可读文字，使用禁用色或中性填充，不只降低透明度；图标与文字相距 8px。

### 输入与筛选控件

- 紧凑工具栏使用 32px，常规表单使用 36px，宽松搜索和选择器使用 40px；不得由图片物理高度推导其他尺寸。
- 控件使用白底、1px `--color-line1-2`、`--corner-3`，placeholder 使用 `--color-text1-10`。
- focus 通过 2px 外环表达，不改变控件尺寸；error 同时使用平台错误色边界、图标与说明文字。
- 连续工具组可以共享外框和内分隔；移动端换行后恢复各控件完整圆角。

### 卡片与面板

- 摘要卡使用 20px 圆角、24px 内边距、细边界和完整轻阴影；大型面板使用相同圆角与较弱阴影。
- 面板标题区固定，标题与说明间隔 4px，标题区与内容间隔 16-24px；右侧工具不挤压标题最小宽度。
- 只有独立、可交互或可复用的信息组才进入嵌套容器；普通段落和每一行数据不额外套卡。

### 独立悬浮摘要列

- `content_contract`: 2-5 个同层级摘要及可选比较值；`render_policy: prd_match_only`。
- 每张卡 156-188px 高，采用“标签 / 核心数值 / 趋势与基准”三段布局，底部信息通过 `margin-top:auto` 对齐。
- 核心数值使用 `metric-primary` 和等宽数字；趋势使用平台语义色、方向图标与文字，基准说明使用 `--color-text1-3`。
- 卡片 hover 仅将阴影提升到 `0 8px 22px rgba(0,0,0,.08)`，不移动卡片；不可合并为单一分隔框或彩色大卡。

### 比例圆角分段带

- `content_contract`: 2-6 个互斥类别和可靠总量；`render_policy: prd_match_only`。
- 外壳高 104-128px、16px 圆角、12px 内边距和 `--color-fill1-1` 背景；内部用比例 grid 或 flex 排列。
- 分段块高 80-104px，间隙 4px，首尾遵循外壳曲率；最大段可放一枚半透明描边标签，小段仅显示可访问 tooltip。
- 每段使用一枚合法独立分类色，可有同色相轻微明度渐变；总量、比例和类别名必须来自 PRD，不可替换成饼图或均分按钮。

### 虚线轻账册

- `content_contract`: 重复的结构化记录、情景或明细；`render_policy: adapt_existing_slot`。
- 表头高 48px，使用 `--color-fill1-1` 与 `--corner-2`；数据行高 58-64px，仅以 1px dashed `--color-line1-1` 分隔，不画竖线。
- 首列可使用 18px 线性图标加 12px 间距；数字右对齐、文本左对齐、状态居中；尾部汇总行提高到 600 字重但不增加背景色。
- 使用固定列模板、sticky header、内部滚动和单行省略；移动端优先横向滚动，不拆成投影卡片。

### 量轨类别行

- `content_contract`: 类别名称、占比及至少一个补充值；`render_policy: recipe_only`。
- 每行 64-76px，以 `色标＋名称 / 量轨＋说明 / 主值＋比例` 三组对齐；组间 gap 16px，行间用虚线弱分隔。
- 量轨高 8px、圆角胶囊，轨道使用 `--color-fill1-3`，填充使用对应独立分类色；右侧数值启用等宽数字。
- 色标与文字共同标识类别，不能只靠颜色；小屏先隐藏补充说明，再将主值移至第二行。

### 图标事件轨

- `content_contract`: 按时间或优先级排序的真实事件集合；`render_policy: adapt_existing_slot`。
- 每行 64-72px，采用 `28px 图标槽 / minmax(0,1fr) 文本 / auto 时间` 三列；行间使用 1px dashed 弱线。
- 图标槽为主题或语义色 8%-12% 浅底，图标 16px；主文本单行，副文本最多两行，时间使用 caption 并右对齐。
- hover 只加入极浅中性底；不可把每条事件包装成独立投影卡，也不可省略可读状态文本。

### 图表或主内容面板

- 仅在 PRD 提供趋势、分布或对比数据时渲染图表；弱网格使用 `--color-line1-1`，轴和图例使用 `--color-text1-3`，主序列使用主题色。
- 图表固定高 280-360px，tooltip 使用 `--color-fill1-10`；等权类别存在时才使用独立分类色，且色彩面积受控。
- 没有图表契约时使用账册、列表、表单或详情承载主内容，不凭空新增趋势或预测。

### 表格与列表

- 常规表格表头高 48px，数据行高 56-64px；本主题优先浅表头、无竖线和虚线行分隔。
- 行 hover 使用 `--color-fill1-1`，selected 使用 `--color-brand1-3` 并保留选择控件；状态同时使用文字或图标。
- 缩略图仅在 PRD 提供真实素材时出现，建议 28-32px；尾部操作使用 28px 图标按钮并带可访问名称。
- 表体内部滚动，长文本省略，数字等宽；加载骨架与真实行同高，避免列宽和面板跳动。

### 快捷入口（推断）

- 未形成可识别的快捷入口母体，因此不默认生成。若 PRD 明确存在 `quick_actions`，仅保留 `inferred / render_policy: recipe_only` 配方：白底轻阴影、40px 主题浅底图标槽、两级文字、72-88px 固定高度。
- 建议 2-4 项，独立于面板标题栏；移动端单列；禁止默认彩色宫格，禁止为填满版面新增操作。

### 状态与交互

- 悬停：边界加深一级或阴影轻微增强，120-160ms ease-out，不移动布局。
- 按下：背景切换为品牌按下色或中性点击底，允许 `translateY(1px)`，不改变占位。
- 聚焦：交互控件显示 2px 高对比 focus ring；纯图标按钮提供可访问名称。
- 加载：保持卡片、面板和行高，以稳定骨架替换内容；分段带保留段位占位。
- 空态与错误：保留标题、工具和面板高度，给出简短说明及下一步操作，不整卡染色。
- 禁用与选中：保留轮廓和文字；选中同时使用底色、字重与标记，状态不只依赖透明度或颜色。
- 动效：颜色、边界和阴影 120-180ms，浮层 160-220ms；`prefers-reduced-motion` 下取消位移和渐变过渡。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务和内容上下文，不决定主题资格。原生页面和自定义页面共同继承全应用 Token、排版、边界、圆角、密度与交互；自定义页仅在内容契约成立时使用独立摘要、分段带、轻账册、量轨行或事件轨。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只决定视觉承载。单列、列表、表单、详情、流程或其他真实结构均应保留，不能为复刻代表构图改写信息架构。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面。每页说明 `page_title`、`global_actions`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table`、`detail_list` 等真实槽位的位置、跨度、建议高度、移动端顺序和采用的 1-3 个视觉 DNA；未采用的母体不强行渲染。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；没有素材时使用结构化数据或中性占位，不编造对象、指标、记录、分类或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护近白画布、白色轻悬浮表面、细边界、统一圆角、中高密度和小面积主题焦点。
- 摘要契约成立时保护独立表面、统一高度和“标签—数值—比较”三段基线。
- 类别构成契约成立时保护单一圆角外壳、不同比例分段、4px 间隙和受控类别色。
- 结构化明细契约成立时保护浅表头、无竖线、虚线行界、固定列对齐和内部滚动。
- 辅助类别与事件契约成立时保护量轨双层信息、图标锚、贴右值或时间以及虚线节奏。
- 保护同类面板等高、父级 gap、固定图表高度、响应式折叠、键盘访问和完整状态。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让主题文件覆盖 PRD 的字段、模块、数据和优先级。
- 禁止把主题色铺满背景、普通卡片或表格行；禁止把默认类别色相写进主题身份。
- 禁止把固定四列摘要、2:1 分栏、右侧轨或模块顺序写成所有页面无条件执行的结构。
- 禁止把独立摘要卡合并成分隔大框，把比例分段带替换成饼图或按钮组，把轻账册改成重网格表。
- 禁止把量轨类别行简化为纯图例，把事件轨改成投影卡片堆，或仅靠颜色表达类别与状态。
- 禁止瀑布流、自由高度同类卡、`align-items:start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、过重投影、玻璃模糊、霓虹效果、无依据装饰和组件库默认样式漂移。

### 错误与正确

- 错误：摘要数值挤在一张分隔大卡；正确：同层摘要各自成面、同高排列并保持三段基线。
- 错误：用饼图或等宽按钮表达类别构成；正确：在单一圆角轨道内按真实比例排列高分段块。
- 错误：明细表同时画横线、竖线和重边框；正确：使用浅圆角表头、无纵线账册和虚线行界。
- 错误：类别辅助区只放色点与百分比；正确：同时提供色标、名称、短量轨、补充说明和右对齐值。
- 错误：事件逐条做成厚重卡片；正确：使用小图标锚、两级文本、贴右时间和轻虚线节奏。
- 错误：所有页面强制使用代表性分栏；正确：内容契约成立时使用主辅轨，否则保留 PRD 页面模式。
- 错误：主题色铺满页面；正确：主题色只连接主操作、关键焦点和选中，大部分表面保持中性。
- 错误：同类卡片随内容自由增高；正确：桌面网格拉伸、同类卡等高，长内容内部滚动或截断。
- 错误：快捷入口使用默认彩色宫格；正确：仅在 PRD 触发时继承白底轻阴影、统一图标槽与固定高度。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成七枚实际 Brand Token。所有真实页面先继承全应用 Token 与基础组件语言，再按内容契约选择独立悬浮摘要、比例圆角分段带、虚线轻账册、量轨类别行或图标事件轨。代表构图只是视觉配方，不用于创造字段、指标、类别、记录、入口或流程；主题色只替换色相，不改变近白画布、轻悬浮层级、构图、密度、形状和虚线节奏。字号和控件尺寸按平台 Token 范围推断，不把图片物理像素当作 CSS 像素。

### 交付自检

- [ ] 全部页面内容、字段和模块是否来自 PRD，而非模板来源？
- [ ] 摘要是否在契约成立时保持独立表面、统一高度和三段基线？
- [ ] 类别构成是否在单一圆角外壳内按真实比例分段，并保持受控间隙？
- [ ] 轻账册是否保持浅表头、无竖线、虚线行界、列对齐和内部溢出？
- [ ] 量轨类别行是否同时保留色标、短量轨、补充说明和右对齐值？
- [ ] 图标事件轨是否保留小图标锚、主副文本、贴右时间和虚线节奏？
- [ ] 每个视觉组件及主辅布局是否都有 `content_contract`、`render_policy`、迁移目标、回退与禁止项？
- [ ] 未被 PRD 触发的母体是否没有强行渲染，且未新增业务能力或假数据？
- [ ] 主操作、关键焦点和选中是否共享 `--color-brand1-6`，其余表面是否保持中性？
- [ ] 独立分类色是否仅用于真实等权类别，平台状态色是否未在 `custom-page` 重复定义？
- [ ] 所有固定灰色是否为三通道相等的 `neutral-gray`，透明阴影是否前三通道相等？
- [ ] `application-global` 语义是否稳定，`custom-page` 是否没有同值同义或角色重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、DNA、组件标题与正文总结是否与默认色相和页面类型解耦？
- [ ] 同类面板是否等高、网格是否拉伸、图表是否定高、长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引起布局跳动？
- [ ] 三档以上响应式规则、移动端触控、键盘访问、非纯颜色状态与 reduced motion 是否达标？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在页面，没有枚举不存在的页面？
- [ ] 最终项目实例化时是否替换全部占位符并把七枚 Brand Token 写为实际色值？
