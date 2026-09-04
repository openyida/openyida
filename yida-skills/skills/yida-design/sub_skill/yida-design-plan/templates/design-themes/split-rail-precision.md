---
name: "{{PROJECT_NAME}}"
description: 以白色画布、细线分区、条件式边缘辅助轨和双重对比焦点构成中等密度、低阴影的精密主题。
themeId: split-rail-precision
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
      "--color-line1-1": "#EEEEEE"
      "--color-line1-2": "#DDDDDD"
      "--color-fill1-1": "#F7F7F7"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E8E8E8"
      "--color-fill1-10": "rgba(255, 255, 255, 0.96)"
      "--color-text1-4": "#102B3A"
      "--color-text1-10": "#666666"
      "--color-text1-3": "#999999"
    typography:
      base:
        "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 650
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
      "--corner-3": 10px
      "--corner-4": 12px
      "--corner-5": 16px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"
      "--oyd-structural-ink": "#102B3A"
      "--oyd-focus-hatch": "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-brand1-6) 72%, transparent) 0 2px, transparent 2px 8px)"
      "--oyd-rating-accent": "#F5B21A"
      "--oyd-verification-accent": "#6875F5"
    typography:
      metric-primary:
        "--font-size-metric-primary": 28px
        "--font-weight-metric-primary": 600
        "--font-lineheight-metric-primary": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以近白画布、纯白内容表面和极细分隔线建立清晰秩序，页面整体保持中等密度，卡片内部使用 16-24px 的舒适留白。视觉焦点由主题色与深色结构墨色形成双重对比，但两者合计不超过页面面积的 15%。当页面同时存在主要任务与独立辅助内容时，可采用主内容区加边缘辅助轨；摘要使用独立描边卡，主图表以中性基准柱、主题色实际柱、短基准帽和斜纹焦点构成，明细区通过标签导航、轻工具栏、进度条与符号化等级信息维持高扫描效率。

### 风格定位与应用说明

- 核心气质是“线性分区、精密数据纹理、轻表面、双重对比焦点”；具有摘要、比较、进度或对象列表的内容最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留细线边界、独立描边卡、主题色与结构墨色的角色分工、线性图标、紧凑工具栏和内部溢出机制；边缘辅助轨仅在内容契约成立时使用。
- 内容不匹配时，将斜纹焦点、基准帽、标签下划线或对象列表节奏迁移到已有槽位；无合法承载则 `recipe_only`，需要新增业务能力则 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 条件式边缘辅助轨 | 主要内容与独立窄轨由贯穿全高的 1px 分隔线切开，窄轨内部纵向组织摘要、趋势与对象列表。`observed` | 不可变机制是明确边界、独立滚动与同一阅读方向；比例和模块顺序由 PRD 决定。仅在主次内容同时存在时使用 `grid-template-columns: minmax(0, 7fr) minmax(320px, 3fr)`。 | 所有信息混入同一列，辅助信息抢占主任务，或无依据地在所有页面强制侧栏。 |
| 独立描边摘要序列 | 同层摘要以四个等宽、低圆角、无阴影的独立卡片横向排列，标签弱、数字强。`observed` | 保持等宽等高、1px 边界、明确卡间 gap 与标签—主值两层；数量、标签与数据由 PRD 决定。 | 退化为彩色大卡或紧密拼接组，失去线性节奏与独立状态感。 |
| 基准帽与斜纹焦点图表 | 柱形同时包含浅色基准、短横基准帽、主题色实际值；选中柱叠加斜纹并显示双层 tooltip。`observed` | 保留“基准—实际—焦点”三层编码、低对比网格和固定绘图区；图表类型与数据可替换，斜纹从 `--color-brand1-6` 派生。 | 退化为普通单色柱图，比较语义与交互焦点消失。 |
| 标签驱动明细带 | 标签导航、搜索筛选操作、浅色表头和长行列表沿同一水平基线组织，进度与等级信息图形化。`observed` | 保留激活下划线、工具栏等高、表头弱填充、行分隔和尾部弱操作；字段与标签来自 PRD。 | 列表变成高边框表格，导航、筛选和内容层级割裂。 |
| 头像化对象序列 | 辅助轨中的对象以圆形标识、两级文本、可选验证标记和细行分隔构成。`observed` | 保持 40px 圆形视觉锚点、两级信息与右侧轻标记；对象类型、图像和状态由 PRD 决定。 | 退化为无锚点文字清单或彩色宫格，扫描与可信度下降。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 条件式边缘辅助轨 | `content_contract`: 页面同时存在高优先级主任务与可独立阅读的辅助摘要、趋势或对象列表。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 同时提供 `primary_content_panel` 与 `supporting_panel`。 | `transferable_mechanism`: 全高细分隔、独立滚动、窄轨纵向节奏；`adaptation_targets`: 已有主内容与辅助内容槽位；折叠时辅助内容排在主任务后。 | `fallback`: 契约不成立时按 PRD 使用单列、表单、列表或详情结构；`forbidden`: 不得为保持分栏新增摘要、趋势、排行或对象。 |
| 独立描边摘要序列 | `content_contract`: 至少两个同层级摘要字段，字段可独立表达。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 明确存在可比较或并列摘要。 | `transferable_mechanism`: 等宽等高、1px 边界、低圆角、标签弱值强；`adaptation_targets`: `primary_summary`、`primary_metrics`。 | `fallback`: 单个摘要使用普通面板；`forbidden`: 不得编造指标、状态或数量。 |
| 基准焦点复合图表 | `content_contract`: 真实数据包含实际值与目标、上限、基准或第二比较序列。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供可验证的双层比较关系。 | `transferable_mechanism`: 中性基准、主题实际、短帽标记、斜纹焦点和双层 tooltip；`adaptation_targets`: `primary_content_panel`、比较进度、区间轨迹。 | `fallback`: 只有单序列时移除基准帽与第二 tooltip，保留轻网格和焦点斜纹；`forbidden`: 不得虚构目标、基准或比较值。 |
| 标签驱动明细带 | `content_contract`: 同一数据集合存在真实分类视图或状态筛选，并包含结构化明细。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 指定标签筛选与表格或列表。 | `transferable_mechanism`: 激活下划线、等高工具栏、浅表头、图形化进度与弱尾部操作；`adaptation_targets`: `detail_table`、`detail_list`。 | `fallback`: 无分类时删除标签带，仅保留工具栏与明细；`forbidden`: 不得新增筛选类别、字段、等级或操作。 |
| 头像化对象序列 | `content_contract`: 存在对象集合，且每项有主名称与至少一项辅助信息。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 有对象推荐、最近访问、负责人或相关项列表。 | `transferable_mechanism`: 圆形视觉锚点、两级文本、细分隔和可选语义标记；`adaptation_targets`: `supporting_panel`、`detail_list`。 | `fallback`: 无真实图像时使用首字母或线性图标；`forbidden`: 不得生成虚假对象、头像、评分或认证。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、深色结构文字、4px 基础间距与 4-16px 圆角阶梯。`tokens.custom-page` 只补充页面底层、独立结构墨色、主题派生斜纹、评分语义色、验证语义色与全局层缺少的主指标数字。图表网格复用 `--color-line1-1`，次序列与进度轨道复用 `--color-fill1-3 / --color-fill1-2`，tooltip 复用 `--color-fill1-10`，避免同值同义 Token。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 画布与表面接近同色，以细线、浅填充和深色结构墨色建立层级；主题色只负责交互焦点与主要数据，结构墨色负责标题、基线和第二视觉锚点。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；主操作、关键焦点、链接、选中和主要数据 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、图表网格与表格行线 | `--color-line1-1` | 应用全局 |
| 输入框、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 深色结构线、图表基线与第二视觉锚点 | `--oyd-structural-ink` | 自定义页 |
| 选中数据的主题派生斜纹 | `--oyd-focus-hatch` | 自定义页 |
| 等级或评分符号 | `--oyd-rating-accent` | 自定义页 |
| 已验证身份标记 | `--oyd-verification-accent` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 菜单点击和中性选中底、进度轨道 | `--color-fill1-2` | 应用全局 |
| 更重中性填充、图表次序列 | `--color-fill1-3` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表格表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子，最终项目必须把七个 Brand Token 写成实际色值。无品牌色时可选择中明度、高对比的冷色作为默认锚点。白色与无彩色灰阶占页面面积至少 80%，主题色与结构墨色合计不超过 15%。评分色和验证色具有独立、固定语义，不参与主题同色推演，也不得替代成功、警告、错误或信息状态色。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-10 / --color-text1-3` 均为 `neutral-gray`，其 Hex 满足 `R = G = B`；`--color-fill1-10` 为白色等通道 rgba 浮层。
- 本主题没有 `theme-gray`；如需带主题倾向的浅底，必须生成期声明为 `--color-brand1-6` 3% + `#F7F7F7` 97%，并在实例化时写入实际值，不得保留固定偏色灰。
- `--color-text1-4` 与 `--oyd-structural-ink` 是明确的深色结构墨色，不声明为灰色，也不随主题色变化。
- 主题色只用于主操作、关键焦点、选中状态和主要数据；不得铺满画布或普通卡片。
- 成功、警告、错误和信息状态直接消费平台语义色，并配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 同一图表最多两种主视觉角色：主题实际值与结构墨色基准；中性次序列不算独立强调色。斜纹由 `--color-brand1-6` 派生，评分与验证色只用于各自语义。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- 普通页面标题映射 `tokens.application-global.typography.subhead`，面板标题映射 `body-2`，正文与内容标题映射 `body-1`，表格映射 `table`，元信息映射 `caption`。
- `subhead` 为 24px / 650 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 28px / 600 / 1.2，仅用于摘要主值，因为全局层没有独立主指标语义，不得替代页面标题。
- 数值启用 `font-variant-numeric: tabular-nums`；摘要主值单行，面板标题最多两行，表格主文本单行省略并提供完整值。
- 图标使用 1.5px 线性描边、圆端点；正文图标 16-18px、面板图标 20px、对象视觉锚点 40px。图标与首行文本视觉居中，不以 emoji 代替功能图标。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：图标与文字用 `--s-2`，控件组合用 `--s-3`，卡片内距用 `--s-4 / --s-6`，大区块间距用 `--s-6`。
- 全页面基础规则：内容区最大宽度 1760px，安全边距 24px；父级 Grid/Flex 统一使用 `gap`；同类面板拉伸对齐，长内容内部处理。
- 只有当 PRD 同时提供主要内容与独立辅助内容时，才启用约 7:3 的边缘辅助轨；否则遵守页面模式要求的单列、列表、表单、详情或流程布局。
- `page_identity`、`global_actions`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table/detail_list` 是否出现及顺序由 PRD 决定。

### 布局稳定性硬规则

- 桌面端主网格使用 `align-items: stretch`；禁止瀑布流和 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题固定，内容区 `flex: 1; min-height: 0`。
- `metric_card` 高 120-144px；小型摘要图表 220-280px；复合 `chart_panel` 380-460px；边缘辅助面板 220-360px；`detail_panel` 首屏高 420-620px；可选 `quick_action_item` 高 72-88px。
- 图表绘图区固定 280-340px；表格、列表和长文本在面板内部滚动、截断或折叠，不撑破网格。
- ≥1280px 且内容契约成立：7:3 分栏、辅助轨独立滚动；768-1279px：主辅改为上下排列，辅助轨可成为 2 列网格；<768px：全部单列，辅助内容排在主任务后，可解除等高但保留控件高度与溢出策略。摘要序列从 4 列降为 2 列再降为 1 列。
- 若边缘辅助轨内容契约不成立，以上各断点均按 PRD 页面模式折叠，不生成空白侧栏。

## 表面与层级

- 常规面板使用 `--color-white`、1px `--color-line1-1` 边界、`0 1px 2px rgba(0,0,0,0.02)` 微阴影；大区块可以仅用贯穿分隔线而不包卡。
- tooltip 和 popover 使用 `--color-fill1-10`、`--color-line1-2` 与 `0 8px 24px rgba(0,0,0,0.10)`；弹窗同层但扩大到 `--corner-4`。
- 禁止大面积渐变、毛玻璃与强辉光；斜纹只用于选中数据焦点或无图像对象占位，不作装饰背景。
- 嵌套层级采用浅填充或分隔线二选一；内层不得继续叠加同强度边框与阴影。

## 圆角与形状

- `--corner-1` 4px 用于状态块与进度条；`--corner-2` 8px 用于输入、按钮和 tooltip；`--corner-3` 10px 用于摘要卡；`--corner-4` 12px 用于常规面板；`--corner-5` 16px 用于大型浮层。
- `--corner-semicircle` 仅用于计数、标签、进度条和短状态；`--corner-circle` 用于图标按钮、头像和对象视觉锚点。
- 同一网格层级圆角一致；不使用超大软圆角，也不随机混用直角与圆角。

## 组件

### 按钮与操作

按钮仅使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮使用同档正方形。默认 `--corner-2`，主按钮消费 `--color-brand1-6`，次按钮白底细边，文字型操作以主题色文字加 1px 下划线表达。hover、active 分别消费 `--color-brand1-1 / --color-brand1-9`，focus 为 2px 主题色外环加 2px offset；disabled 同时降低文字和边界对比并移除点击反馈。同一操作区只保留一个主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。白色表面、`--color-line1-2` 边界、`--corner-2`；placeholder 用 `--color-text1-10`。focus 显示主题色边界与外环，error 消费平台错误色并配合文本。搜索、筛选和新增操作在同一工具栏保持等高，窄屏按组换行。

### 卡片与面板

摘要卡使用 `--corner-3`、常规面板用 `--corner-4`；内距为 `--s-4 / --s-6`。卡片标题区固定，内容区 `flex: 1`。大区块优先使用细分隔线而非层层套卡；只有内容可独立理解、独立操作或需要稳定边界时才包卡。

### 独立描边摘要序列

固定公式：2-4 个 `metric_card` + 等宽 Grid + `--s-4 / --s-6` gap + 1px `--color-line1-1` 边界。卡内按“弱标签—主值”垂直排列，主值消费 `metric-primary`；辅助状态放在标签旁或主值下，但不抢主值。每张卡保持同高、无彩色背景、无显著阴影。禁止替换为大面积主题色卡、拼接组或不同高度的 Masonry 卡片。

### 基准焦点复合图表

固定公式：标题与时间切换 + 左侧可选摘要列表 + 固定绘图区。每个数据位包含浅灰基准柱、主题色实际柱和 1-2px 深色基准帽；当前焦点叠加 `--oyd-focus-hatch`，tooltip 分别贴近比较层并避免遮挡。网格消费 `--color-line1-1`，次序列消费 `--color-fill1-3`，基准线消费 `--oyd-structural-ink`。无双层真实数据时移除基准帽，禁止伪造比较值。

### 标签驱动明细带

固定公式：可横向滚动的标签带 + 标题/工具栏 + 44px 浅表头 + 64-72px 数据行。激活标签使用主题色顶线或底线与字重变化，计数使用胶囊；工具栏控件等高。进度以 `--color-fill1-2` 轨道承载主题色实际值，等级用符号与数字共同表达。禁止把标签做成高饱和彩色按钮组，禁止以星形或颜色作为唯一等级信息。

### 头像化对象序列

固定公式：40px 圆形锚点 + 两级文本 + 可选右侧语义标记 + 1px 行分隔。真实图像存在时使用图像；无图像时用首字母、线性图标或 `--oyd-focus-hatch` 占位。验证标记仅在真实状态存在时消费 `--oyd-verification-accent`；评分仅在真实评分存在时消费 `--oyd-rating-accent`。禁止生成虚假头像、评分或认证。

### 图表或主内容面板

复合柱图与双线趋势图均使用固定高度、低对比网格、最多两个主要视觉角色。双线趋势中，主要线使用 `--oyd-structural-ink` 或主题色，次线使用 `--color-fill1-3`，仅终点或焦点显示节点；下方范围控制器为 28-32px 高。所有图表提供文本摘要、键盘焦点和非纯颜色区分。

### 表格与列表

表头高 44px，使用 `--color-fill1-1`；数据行高 64-72px，仅保留水平分隔。主文本左对齐，数字右对齐并使用等宽数字；进度单元由轨道、实际值和百分比组成；等级单元由图标加文本值组成；尾部操作为 28/32px 图标按钮。表体固定高度内滚动、表头 sticky，长文本省略且可访问完整值。

### 快捷入口（推断）

未观察到独立快捷入口，因此只保留 `inferred / render_policy: recipe_only` 配方：PRD 明确存在高频入口时，使用独立区块、2-4 个等宽项、72-88px 高、白底细边、单色线性图标与短标签；移动端改为 2 列或横向滚动。禁止默认彩色宫格，禁止塞入明细工具栏或辅助轨尾部。

### 状态与交互

- 悬停：120-160ms 内改变边界、浅填充或下划线，不改变尺寸和字重。
- 按下：80-120ms 使用 `--color-brand1-9` 或 1px 内收反馈。
- 聚焦：控件显示清楚 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持卡片、图表与列表固定高度，使用骨架或稳定占位。
- 空态与错误：保留原结构，提供简短说明与下一步操作，不整块染色。
- 禁用与选中：禁用结合低对比边界、图标和文案；选中结合主题色线、斜纹或标记，不只依赖颜色。
- 动效：常规 120-180ms `ease-out`，浮层 160-220ms；`prefers-reduced-motion` 下关闭位移和逐项动画。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题资格。原生页面和自定义页面共同继承全应用颜色、字体、间距与圆角；自定义页面仅在需要结构墨色、斜纹焦点、评分、验证或主指标数字时消费页面级 Token。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉表达。边缘辅助轨、复合图表、标签带和对象列表都必须经过内容契约，不得把所有页面强制改造成同一结构。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面，并说明中性槽位、跨度、高度、移动端顺序与采用的视觉 DNA。页面无需使用全部组件母体，但采用对应信息类型时必须遵守构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；缺少素材时使用结构化数据或中性占位，不编造对象、指标、等级或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护白色表面、无彩色灰阶、细线分区、低阴影和双重对比角色；颜色角色必须与 YAML 一致。
- 内容契约满足时，边缘辅助轨必须保留全高分隔、独立滚动和主后辅的响应式顺序；描边摘要必须等宽等高。
- 复合比较数据存在时，必须保护基准柱、实际柱、短基准帽、斜纹焦点与双层 tooltip；无比较数据时主动降级。
- 分类明细存在时，必须保护标签下划线、等高工具栏、浅表头、图形化进度和非纯颜色等级信息。
- 对象集合存在时，必须保护圆形锚点、两级文本、细分隔和真实状态标记。
- 同类面板等高、图表高度固定、长内容内部处理、父级 gap 统一；完整实现状态、响应式、键盘访问与 reduced motion。

### 禁止项

- 禁止复制模板来源中的业务内容，或让本文件覆盖 PRD 的内容决策。
- 禁止把主题色铺满画布、普通卡片或大面积面板；禁止把默认色相当作视觉 DNA。
- 禁止把边缘辅助轨、固定列数或模块顺序写成所有页面的无条件结构；无辅助内容时不得留空轨。
- 禁止把独立描边摘要改成彩色大卡或拼接组；禁止把基准焦点图表简化成无比较层的通用柱图。
- 禁止把标签明细做成厚重按钮页签与全边框表格；禁止用虚假头像、评分或认证填充对象列表。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、无依据装饰和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：所有页面固定 7:3 分栏；正确：主辅内容契约成立时启用边缘轨，否则保持 PRD 页面模式。
- 错误：摘要卡使用不同色块和强阴影；正确：等宽独立描边卡、统一高度、标签弱值强。
- 错误：图表只有普通主题色柱；正确：真实比较存在时使用中性基准、主题实际、短帽与斜纹焦点。
- 错误：标签、工具栏和表格各自悬浮；正确：沿同一水平节奏组成连续明细带。
- 错误：对象列表用彩色宫格与虚假状态；正确：圆形锚点、两级文本、细分隔和真实语义标记。
- 错误：主题色铺满页面；正确：主题色连接主操作、主要数据、选中与焦点，大部分表面保持中性。
- 错误：卡片随内容自由增高；正确：同类卡片固定高度，长内容内部滚动或截断。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成七个实际 Brand Token。所有页面先继承全应用 Token 与基础组件语言，再按内容契约选择独立描边摘要、边缘辅助轨、复合图表、标签明细或对象序列。构图只作为配方，不创造内容；主题色只改色相，不改变线性分区、双重对比、基准帽、斜纹焦点、密度、形状和交互机制。页面级 Token 已完成全局语义复用扫描，禁止重新声明网格、tooltip、次序列或进度轨道的同义 Token。

### 交付自检

- [ ] 全部内容和模块是否来自 PRD，而非模板来源？
- [ ] 边缘辅助轨是否仅在主辅内容契约成立时出现，并具有折叠与回退规则？
- [ ] 独立描边摘要是否等宽等高、标签弱值强且无彩色大底？
- [ ] 复合图表是否仅使用真实基准关系，并保护基准帽、斜纹焦点与固定高度？
- [ ] 标签明细是否保护下划线、等高工具栏、浅表头、进度和非纯颜色等级表达？
- [ ] 对象序列是否保护圆形锚点、两级文本、细分隔和真实标记？
- [ ] 每个组件或布局记忆点是否都有 `content_contract`、`render_policy`、迁移目标和回退策略？
- [ ] 固定比例、辅助轨和模块顺序是否未被写成全页面硬规则？
- [ ] 未触发组件是否没有强行渲染，视觉迁移是否没有新增业务内容？
- [ ] 主题色同色演变是否由 `--color-brand1-6` 派生，独立评分与验证色是否角色明确？
- [ ] `custom-page` 是否没有与全局层同值同义或角色重叠的 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] 主题身份、DNA、组件标题和总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的中等密度、局部留白、低阴影、细线与小面积主题色是否与正文和 Token 一致？
- [ ] 所有灰色 Token 是否为 `neutral-gray` 且满足 `R = G = B`；如新增 `theme-gray` 是否声明种子、基底、比例和实例化要求？
- [ ] 所有真实页面是否共享全应用 Token，视觉记忆点是否按内容契约条件式落地？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开真实页面？
- [ ] 同类面板是否等高，图表是否固定高度，长内容是否内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 实际色值？
