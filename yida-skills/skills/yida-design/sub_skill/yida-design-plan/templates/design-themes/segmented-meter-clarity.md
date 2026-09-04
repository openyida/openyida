---
name: "{{PROJECT_NAME}}"
description: "以近白画布、细描边圆角框架、分隔式指标带、分段微计量尺和连续网格内容构成中高密度、精确而克制的结构主题。"
themeId: "segmented-meter-clarity"
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
      "--color-brand1-10": "AI 根据 --color-brand1-6 与白色混合生成 66% 禁用色"
      "--color-line1-1": "#EEEEEE"
      "--color-line1-2": "#DDDDDD"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E8E8E8"
      "--color-fill1-10": "rgba(255, 255, 255, 0.96)"
      "--color-text1-4": "#181818"
      "--color-text1-10": "#666666"
      "--color-text1-3": "#8C8C8C"
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
      "--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"
      "--oyd-theme-deep": "color-mix(in srgb, var(--color-brand1-6) 12%, #111111)"
      "--oyd-category-1": "#FF6A1A"
      "--oyd-category-2": "#7B6CF6"
      "--oyd-category-3": "#4FC49A"
      "--oyd-category-4": "#4B9CF5"
      "--oyd-category-5": "#EC3E7D"
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

本主题在近白画布上使用白色表面、1px 中性边界和统一大圆角建立清晰框架。页面整体为中高密度，卡片内部保持充足留白；核心信息以单一外框内的分隔式指标带聚合，细粒度进展通过分段微计量尺表达，长数据以连续网格承载，辅助信息则使用带柔和图标底的短列表和环首进度条。主题色只占据主操作、聚焦、选中和少量关键图标，固定分类色只用于真实的并列类别，绝不铺满表面。桌面端通过拉伸网格、确定高度和面板内部溢出保持上下边缘稳定。

### 风格定位与应用说明

- 核心气质是精密、安静、秩序明确；最能发挥记忆点的是同时包含摘要、可筛选明细与短辅助信息的真实内容组合，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 代表性构图迁移时保留“单框分隔、短条计量、连续网格、柔和图标底、环首进度”的机制，不复制固定字段、列数、数值、对象或模块顺序。
- 内容不匹配时，把边界、密度、圆角和交互语言迁移到现有槽位；无法合法承载的母体降级为 `recipe_only`，涉及新增能力时仅用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 单框分隔指标带 | 一个大圆角外框内由等距竖线组织多个指标单元，单元不各自投影。`observed`，高置信度 | 外框、内分隔和统一基线不可变；指标数可按真实数据变化。使用 `display:grid`、`border-inline-start` 与 `minmax(0,1fr)` | 退化为互不相关的卡片阵列，失去整体秩序 |
| 分段微计量尺 | 多枚等高短竖条连续排列，已完成段着色，剩余段保持中性。`observed`，高置信度 | 离散短段、单一基线和“着色段＋中性段”不可变；段数、比例和分类色可变。使用 CSS Grid 与 `data-value` | 变成普通长进度条，精密识别度消失 |
| 工具栏连接的连续网格 | 标题、说明、筛选、分段选择和表格共享一个表面，表体以横纵细线形成连续网格。`observed`，高置信度 | 工具栏与数据体一体、列线连续、表头弱化不可变；列与操作由 PRD 决定。使用 `table-layout:fixed` 与 sticky header | 变成卡片列表或默认表格，层级与密度失衡 |
| 柔和图标事件栈 | 短事件各自置于细描边小容器，左侧图标位于低饱和浅底，右侧为两级文本。`observed`，高置信度 | 图标底、两级文本、均匀栈间距不可变；事件类型、图标和语义色可变。使用列表语义与固定图标槽 | 退化为无锚点文本流，扫读效率下降 |
| 环首进度轨 | 每项由标签、比例、细轨道和起点圆环组成，彩色线从圆环后延伸。`observed`，高置信度 | 环形起点、细轨道和同色填充不可变；比例、名称和独立分类色可变。使用伪元素绘制双层圆环 | 变成通用进度条，辅助列缺少独特节奏 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 单框分隔指标带 | `content_contract`: PRD 存在 2-6 个同层级摘要值，且它们需要同屏比较 | `render_policy: prd_match_only`；`direct_trigger`: 同层级指标集合 | `transferable_mechanism`: 共享外框、竖向分隔、统一数值基线；`adaptation_targets`: `primary_metrics`、已有摘要槽位 | `fallback`: 保留普通信息区；`forbidden`: 为凑数量新增指标 |
| 分段微计量尺 | `content_contract`: 已有值可转换为比例、阶段或离散完成度 | `render_policy: adapt_existing_slot`；`direct_trigger`: 指标已有明确上限或总量 | `transferable_mechanism`: 离散短段和中性余量；`adaptation_targets`: 指标进度、容量、配额 | `fallback`: 仅显示真实数值；`forbidden`: 推测目标值或伪造比例 |
| 主内容与辅助列构图 | `content_contract`: PRD 同时存在高权重主内容和独立、短小、可压缩的辅助内容 | `render_policy: prd_match_only`；`direct_trigger`: 主辅任务同时成立 | `transferable_mechanism`: 桌面约 62/38 分栏、同顶线、侧列纵向堆叠；`adaptation_targets`: `primary_content_panel`、`supporting_panel` | `fallback`: 按 PRD 回到单列或原有网格；`forbidden`: 为保留侧栏拆散主流程 |
| 工具栏连接的连续网格 | `content_contract`: 存在需要比较、排序、筛选或批量选择的结构化记录 | `render_policy: prd_match_only`；`direct_trigger`: 真实字段与记录集合 | `transferable_mechanism`: 一体工具栏、细网格、固定表头；`adaptation_targets`: `detail_table`、已有数据列表 | `fallback`: 采用 PRD 原列表；`forbidden`: 编造字段、记录或批量操作 |
| 柔和图标事件栈 | `content_contract`: 存在按时间或优先级排列的短事件、提醒或变更 | `render_policy: adapt_existing_slot`；`direct_trigger`: 已有事件型数据 | `transferable_mechanism`: 浅色图标槽、两级文本、独立短行；`adaptation_targets`: `detail_list`、通知、动态 | `fallback`: 保留现有列表；`forbidden`: 新增消息源或假事件 |
| 环首进度轨 | `content_contract`: 存在 2-5 个真实、同层级且可比较的类别比例 | `render_policy: recipe_only`；`direct_trigger`: 类别比例与总量均明确 | `transferable_mechanism`: 起点圆环、细轨道、末端留白；`adaptation_targets`: 分布、构成、完成率列表 | `fallback`: 只保留实现配方；`forbidden`: 把状态或金额强制归一化为比例 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；变量名与消费语义稳定，具体值体现本主题的中高密度、清晰细边界、统一圆角与克制主题强调。`tokens.custom-page` 仅补充近白页面画布、主题派生深色焦点、五枚等权分类色和大数值语义；分类色用于真正的并列类别，主题派生深色用于主操作或强选中，大数值语义用于全局排版体系没有覆盖的指标读数，均不能与全局 Token 等义互换。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 画布使用 `--oyd-page-background`，一级面板使用 `--color-white`，边界依次使用 `--color-line1-1` 与 `--color-line1-2`；层级主要靠边界与留白，不靠大阴影。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 主按钮、链接、焦点与关键选中 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用 | `--color-brand1-10` | 应用全局 |
| 弱分隔、表格行线和辅助轨道 | `--color-line1-1` | 应用全局 |
| 控件与一级容器边界 | `--color-line1-2` | 应用全局 |
| 页面底层画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片与浮层基础表面 | `--color-white` | 应用全局 |
| 悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底与按下填充 | `--color-fill1-2` | 应用全局 |
| 微计量尺未完成段 | `--color-fill1-3` | 应用全局 |
| 气泡、提示与弹出表面 | `--color-fill1-10` | 应用全局 |
| 标题、核心数值、正文与主要图标 | `--color-text1-4` | 应用全局 |
| 表头、输入占位和次级标签 | `--color-text1-10` | 应用全局 |
| 时间、说明、坐标和元信息 | `--color-text1-3` | 应用全局 |
| 主题派生的深色主操作与强选中 | `--oyd-theme-deep` | 自定义页 |
| 等权类别的图标、微计量和进度 | `--oyd-category-1` 至 `--oyd-category-5` | 自定义页 |

`--color-brand1-6` 来自前置确定的全应用主题色，是唯一品牌色种子。最终项目实例化时必须把其余六枚 Brand Token 的生成期标记解析为实际色值。若没有品牌色，默认以中等明度、可访问的蓝色为锚点；换色后仍保持约 85% 以上的画布与表面为中性色。

### 本主题的配色约束

- `--color-white`、所有 `line1`、`fill1`、`text1` 和 `--oyd-page-background` 均为 `neutral-gray`；固定 Hex 的 RGB 三通道相等。
- `--oyd-theme-deep` 为 `theme-gray`：由 `--color-brand1-6` 占 12% 与中性基底 `#111111` 占 88% 派生；最终实例化时写入计算后的实际值。
- `--oyd-category-1` 至 `--oyd-category-5` 是等权类别色，不参与主题同色推演，只可用于确有类别对应关系的小面积图标、计量段和进度线；单屏每个类别色的可见面积不超过 6%。
- 主题同色演变只由 `--color-brand1-6` 派生，用于主操作、焦点、选中和链接；不得把主题色铺满画布或普通面板。
- 成功、警告、错误与信息状态直接消费平台语义色，并配合文字、图标或方向符号；不以分类色代替状态色。

## 字体与排版

- 全局仅使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 使用 `subhead`：24px / 600 / 1.3；用于页面主标题，单行省略，移动端最多两行。
- `panel-title` 使用 `body-2`：16px / 600 / 1.4；用于面板标题和重点分组名。
- `content-title` 与 `body` 使用 `body-1`：14px / 400 / 1.5；内容标题可局部提高到 600，但不改变字号与行高。
- `table` 使用 `table`：14px / 400 / 1.45；表头通过 500 字重和 `--color-text1-10` 区分。
- `caption` 使用 `caption`：12px / 400 / 1.4；承载时间、说明和辅助信息。
- `metric-primary` 使用页面专属 Token：28px / 600 / 1.2，仅用于摘要主数值；全局排版没有对应的大数值语义，因此不与 `subhead` 重复。
- 数字启用 `font-variant-numeric: tabular-nums`；金额、百分比和日期保持列内右对齐或基线对齐。
- 长标题优先单行省略；事件副文案最多两行；表格长文本单行省略并通过 tooltip 或详情操作提供完整内容。
- 图标使用 1.75px 线性描边、圆角端点；常规 18-20px，摘要图标 20px，必须与文字首行光学居中。

## 布局与间距

- 页面安全边距使用 `--s-6`，超宽画布可增至 `--s-8`；父级区块 gap 使用 `--s-6`，面板内 gap 使用 `--s-3` 或 `--s-4`，紧密行内元素用 `--s-2`。
- 内容最大宽度建议 1680px，并以 `width:100%` 居中；所有网格列使用 `minmax(0,1fr)`，禁止内容决定列宽。
- 同层摘要在内容契约满足时使用 2-6 个等分单元；数量超出时换行成新的完整分组，不压缩到不可读宽度。
- 主辅内容同时存在且辅助内容可独立压缩时，桌面使用约 `minmax(0,1.62fr) minmax(320px,1fr)`；不满足契约时按 PRD 的单列、列表、表单、详情或流程结构组织。
- 页面标题、全局操作、主要内容与辅助内容是否出现及其顺序完全由 PRD 和页面模式决定。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items: stretch`；面板统一 `height:100%; min-width:0; min-height:0; display:flex; flex-direction:column`，标题固定，内容区 `flex:1; min-height:0`。
- `metric_card` 建议高 184-220px；单框指标带建议高 220-260px；`primary_content_panel` 建议高 520-680px；`detail_panel` 建议高 240-360px；可选 `quick_action_item` 高 72-88px。
- 表格内容超过面板高度时仅表体滚动，表头 sticky；列表超长时内部滚动或分页；长文案截断，不得撑破网格。
- 图表若由 PRD 触发，容器必须确定为 280-360px 高；本主题不因常见页面模式默认新增图表。
- 区块间距仅由父级 grid/flex 的 `gap` 管理，不用零散外边距拼接节奏。
- ≥1280px：允许单框多指标和约 62/38 主辅分栏；960-1279px：摘要改为每行 2-3 项，主辅列可维持 58/42 或按契约堆叠；<960px：所有内容单列，辅助列排在对应主内容之后。
- <640px：指标带拆成两列或单列并保留内分隔；工具栏分两行，输入 40px 高，操作按钮 36px 高；表格优先横向内部滚动，不把每行强制卡片化。
- 移动端可解除桌面等高，但仍保留控件档位、文本截断、内部溢出和同一 `content_contract`，触控目标最小 40×40px。

## 表面与层级

- 页面画布为 `--oyd-page-background`，一级面板为 `--color-white`、1px `--color-line1-2` 边界；常规面板不使用可见投影。
- 嵌套事件项、进度项和工具栏控件使用 `--color-white` 或 `--color-fill1-1`，配 1px `--color-line1-1`；同一位置最多出现两层边界。
- tooltip、popover 和菜单使用 `--color-fill1-10`，边界为 `--color-line1-2`，仅允许 `0 8px 24px rgba(0,0,0,.08)` 的局部浮层阴影。
- 禁止玻璃模糊、强渐变和大面积纹理；主题色浅底仅可出现在图标槽、标签与 focus ring。
- 面板间靠 24px gap 分层，面板内部靠 12-16px gap 分组，不用层层阴影表达嵌套。

## 圆角与形状

- `--corner-1` 4px：复选框、小标记与微型焦点。
- `--corner-2` 8px：分段选择项、状态标签、32px 工具按钮。
- `--corner-3` 12px：输入框、筛选器、事件项和嵌套列表项。
- `--corner-4` 16px：常规卡片和窄辅助面板。
- `--corner-5` 20px：一级大面板、单框指标带和主内容外壳。
- `--corner-circle` 用于图标圆底、进度起点和头像；`--corner-semicircle` 仅用于状态标签、分段激活项与进度轨。
- 同一网格层级必须使用一致圆角；不以随机超大圆角制造层级。

## 组件

### 按钮与操作

- 迷你或行内按钮 28px，紧凑工具栏 32px，常规按钮 36px，强调或宽松操作 40px；图标按钮使用同档正方形尺寸。
- 同一操作区只保留一个视觉主操作。主操作使用 `--oyd-theme-deep` 或 `--color-brand1-6` 与白字，次操作使用白底、`--color-line1-2` 边界和一级文字。
- hover 使用对应品牌 hover 色或 `--color-fill1-1`；active 使用 `--color-brand1-9` 或 `--color-fill1-2`；focus 显示 2px `--color-brand1-6` 外环并留 2px 间隔。
- disabled 保留边界，用 `--color-brand1-10` 或中性填充，不仅依赖降低透明度；图标与文字间距 8px。

### 输入与筛选控件

- 紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px；不得出现其他高度。
- 控件为白底、1px `--color-line1-2` 边界、`--corner-3` 圆角；placeholder 用 `--color-text1-10`。
- focus 保持尺寸不变，通过 2px 外环表达；error 同时显示平台错误色边界、图标和辅助文字。
- 连续筛选组允许共享外框，用 1px 内分隔；移动端换行时恢复各控件完整圆角。

### 卡片与面板

- 一级面板使用 20px 圆角、24px 内边距和细边界；紧凑辅助面板使用 16px 圆角、16px 内边距。
- 标题区固定，标题与说明间隔 4px，标题区与内容区间隔 16-24px；右侧工具不挤压标题最小宽度。
- 只有独立、可交互或可复用的信息组才形成嵌套卡；普通段落不额外套卡。

### 单框分隔指标带

- `content_contract`: 2-6 个同层级摘要值；`render_policy: prd_match_only`。
- 外层使用 `--corner-5`、白底、1px 常规边界和 24px 内边距；内部用等分 grid，单元之间只画一条竖线。
- 单元按“图标＋标签 / 大数值 / 微计量尺 / 变化说明”垂直排列；图标 20px，标签为 body，数值用 `metric-primary`，变化说明为 body。
- 分类存在时，一项仅绑定一枚独立分类色；无真实分类时统一使用主题色，不自动制造彩虹。
- 单元 hover 只加入 `--color-fill1-1` 背景，不改变边界、尺寸和分隔线；不可替代成独立投影卡阵列。

### 分段微计量尺

- `content_contract`: 有确定分母或阶段数的真实比例；`render_policy: adapt_existing_slot`。
- 由 20-32 个 4px 宽、26px 高、2px 圆角的短段构成，段间 gap 4px；容器宽度不足时减少段数，不压缩间距到 2px 以下。
- 已完成段使用主题色或合法分类色，未完成段使用 `--color-fill1-3`；每个段只表达离散进度，不承担点击。
- 用 `aria-label` 提供完整值并保留旁侧文本；不可替代成渐变长条或装饰性柱图。

### 工具栏连接的连续网格

- `content_contract`: 可比较、筛选或批量选择的真实记录；`render_policy: prd_match_only`。
- 面板标题区和筛选区共享表面，分段选择位于内容上方；激活项使用主题派生深色底和白字，未激活项使用中性表面。
- 表头高 48px，数据行高 56px；横纵边界均使用 `--color-line1-1`，首列选择框、末列状态或操作由 PRD 决定。
- 表格使用 sticky header、固定布局和列宽约束；数字右对齐，短状态居中，文本左对齐。
- 不将每一行拆成带阴影卡片；小屏保留表格语义并在内部横向滚动。

### 柔和图标事件栈

- `content_contract`: 真实事件、动态、提醒或变更列表；`render_policy: adapt_existing_slot`。
- 每项最小高 72px，使用 12px 圆角和弱边界；左侧 40px 图标槽以对应状态或分类色 8%-12% 浅底呈现。
- 主文本单行，副文本单行或两行；时间和元信息使用 caption。列表 gap 12px，禁止用粗分割线堆叠。
- 图标不能单独传达状态，必须有文字；无事件时保留面板标题与稳定空态。

### 环首进度轨

- `content_contract`: 2-5 个已知比例的同层级类别；`render_policy: recipe_only`。
- 每项使用 12px 圆角弱边界和 16px 内边距；标签与比例同一行，轨道置于其下 16px。
- 轨道高 8px，左端用 20px 空心圆覆盖轨道起点，圆内再放 8px 实心点；填充线从圆心之后开始并与圆环同色。
- 圆环、文字和数值共同说明类别；比例未知时不渲染轨道，只显示已有信息。

### 图表或主内容面板

- 只有 PRD 提供趋势、分布或对比数据时才渲染图表；弱网格用 `--color-line1-1`，坐标与图例用 `--color-text1-3`，强调序列使用主题色。
- 图表固定高 280-360px，tooltip 使用 `--color-fill1-10`；序列超过一条时优先主题同色阶，只有真实等权类别才使用独立分类色。
- 没有图表契约时，以表格、列表、表单或详情作为主内容承载，不补造图表。

### 表格与列表

- 表头高 48px、数据行高 56px；表头 14px / 500，数据 14px / 400，均来自全局字号语义。
- 行 hover 使用 `--color-fill1-1`，selected 使用 `--color-brand1-3` 并保留选择控件；状态必须同时有文字或图标。
- 头像或缩略图仅在 PRD 提供真实素材时显示，建议 28-32px；末尾操作使用 28px 图标按钮并有可访问名称。
- 长文本省略、数字使用等宽特性、表体内部滚动；加载行骨架与真实行同高。

### 快捷入口（推断）

- 未见稳定的快捷入口母体，因此不默认生成。若 PRD 明确存在 `quick_actions`，仅提供 `inferred / render_policy: recipe_only` 配方：白底细边界、40px 主题浅底图标槽、两级文字、72-88px 固定高度。
- 数量建议 2-4 个；移动端单列；禁止默认彩色宫格，禁止为了填充布局新增操作。

### 状态与交互

- 悬停：边界加深一级或加入中性浅底，120ms ease-out，不改变尺寸。
- 按下：使用品牌按下色或中性点击底，允许 `transform:translateY(1px)`，不改变布局占位。
- 聚焦：交互控件显示 2px 高对比 focus ring；纯图标按钮必须有可访问名称。
- 加载：固定面板和行高，使用中性骨架；微计量尺保留段位占位，避免网格跳动。
- 空态与错误：保留标题、工具栏和面板高度，提供简短说明与下一步操作，不把整卡染成状态色。
- 禁用：保留轮廓与文字，配合图标或提示；选中同时使用底色、文字权重和选择标记。
- 动效：颜色与边界 120-180ms，浮层 160-220ms；`prefers-reduced-motion` 下取消位移与过渡，仅保留即时状态。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题是否可用。原生页面和自定义页面共同继承全应用色彩、排版、间距、圆角与状态语言；自定义页面仅在相应内容契约成立时增加分隔指标、微计量、连续网格、事件栈或环首进度母体。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、模块与信息优先级，主题只规定视觉表达。单列、列表、表单、详情、流程或其他真实结构都应保留，不为复刻代表性分栏而改写信息架构。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时仅展开项目真实存在的页面。每页说明 `page_title`、`global_actions`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table` 或 `detail_list` 等真实槽位的位置、跨度、建议高度、移动端顺序，以及采用的 1-3 个视觉 DNA；不要求每页使用全部母体。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；没有素材时使用结构化数据或中性占位，不编造对象、指标、图片地址或事件。

## 设计规范与禁忌

### 必须做到

- 无条件保护近白画布、白色表面、1px 中性边界、统一圆角、中高密度和小面积主题焦点。
- 内容契约满足时，单框分隔指标带必须共享一个外框、统一基线和内部竖分隔，不拆成投影卡。
- 比例契约满足时，分段微计量尺必须保留离散短段和中性余量；环首进度必须保留起点双层圆环。
- 表格契约满足时，工具栏与连续网格保持一体，表头固定，长内容在面板内部处理。
- 事件契约满足时，保留柔和图标槽、两级文本和均匀事件栈。
- 同类卡片等高、桌面网格拉伸、图表固定高度、父级 gap、完整状态、响应式与键盘可访问性必须落实。

### 禁止项

- 禁止复制业务内容，或让主题文件覆盖 PRD 的字段、模块、数据与优先级决策。
- 禁止把输入主题色铺满背景、普通卡片或大面积面板；禁止把默认色相当作视觉 DNA。
- 禁止把固定主辅比例、右侧列或模块顺序写成所有页面无条件执行的结构。
- 禁止把分隔指标带拆成互相漂浮的卡阵列，把分段微计量尺替换成渐变长条，或把环首进度简化成默认进度条。
- 禁止把连续网格拆成卡片行，把事件栈变成无图标锚点的长文本，把独立分类色用于状态或装饰。
- 禁止瀑布流、自由高度卡片、`align-items:start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、无依据装饰、过度投影、玻璃模糊和与本主题不一致的组件库默认样式。

### 错误与正确

- 错误：每个摘要值各自一张投影卡；正确：同层摘要共享大外框，以细竖线分隔并对齐数值基线。
- 错误：用一根普通彩色长条表示所有进度；正确：比例可靠时使用等距离散短段，并明确中性余量。
- 错误：工具栏、筛选和表格分别悬浮；正确：将它们收进一个连续表面，用细线而非投影区分层级。
- 错误：事件仅以连续文本和粗分隔线排列；正确：用浅底图标槽、主副两级文本和等距小容器形成事件栈。
- 错误：所有页面强制使用代表性分栏；正确：内容契约成立时使用主辅构图，否则保留 PRD 页面模式并迁移表面、排版与间距语言。
- 错误：主题色铺满页面；正确：主题色只连接主操作、焦点与选中，大部分表面保持中性。
- 错误：卡片随内容自由增高形成瀑布流；正确：同类卡片固定高度、网格拉伸，长内容内部滚动或截断。
- 错误：快捷入口使用默认彩色宫格；正确：仅在 PRD 触发时继承白底细边界、统一图标槽和固定高度。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token。所有真实页面先继承全应用 Token 和基础组件语言，再按内容契约选择单框分隔指标带、分段微计量尺、连续网格、柔和图标事件栈或环首进度轨。代表构图只作为配方，不用于创造字段、数据、对象、入口或流程；主题色只替换色相，不改变画布、层级、构图、密度、形状和组件机制。字号与控件尺寸按平台 Token 范围推断，不把图片物理像素当作 CSS 像素。

### 交付自检

- [ ] 全部页面内容、字段和模块是否来自 PRD，而非主题模板？
- [ ] 同层摘要是否在契约成立时共享单一外框、内部竖分隔和统一数值基线？
- [ ] 微计量尺是否仅在分母明确时出现，并保留等距短段与中性余量？
- [ ] 连续网格是否保持工具栏一体、固定表头、细网格和内部溢出？
- [ ] 事件栈是否保留柔和图标槽、两级文本和固定行高？
- [ ] 环首进度是否保留双层圆环起点，且比例与类别均来自真实数据？
- [ ] 每个视觉记忆组件和主辅布局是否都有 `content_contract`、`render_policy`、迁移目标、回退与禁止项？
- [ ] 未被 PRD 触发的组件是否没有强行渲染，且没有新增业务能力或假数据？
- [ ] 主操作、焦点和选中是否共享 `--color-brand1-6` 的同色体系，其余表面保持中性？
- [ ] 等权分类色是否只用于真实类别，平台状态色是否未在 `custom-page` 重复声明？
- [ ] 所有固定灰色是否为三通道相等的 `neutral-gray`，`--oyd-theme-deep` 是否按 12% 主题色与 88% `#111111` 计算并写入实际值？
- [ ] `application-global` 变量名和消费语义是否稳定，`custom-page` 是否无同值同义重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、DNA 与组件名称是否只描述视觉机制，不绑定页面类型或默认色相？
- [ ] 同类面板是否等高、主网格是否拉伸、图表是否固定高度、长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不导致布局跳动？
- [ ] 三档以上响应式规则、移动端触控、键盘访问、非纯颜色状态与 reduced motion 是否达标？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在的页面，没有预先枚举不存在的页面？
- [ ] 最终项目实例化时是否替换全部占位符并把七枚 Brand Token 写成实际色值？
