---
name: "{{PROJECT_NAME}}"
description: "以三轨分栏、开放筛选脊柱、图像优先对象卡和黏性对象检查器构成中高密度、柔和克制且强调真实媒体的结构主题。"
themeId: "media-rail-inspector"
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
      "--color-brand1-10": "AI 根据 --color-brand1-6 与白色混合生成 68% 禁用色"
      "--color-line1-1": "#EEEEEE"
      "--color-line1-2": "#DCDCDC"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E8E8E8"
      "--color-fill1-10": "rgba(255, 255, 255, 0.97)"
      "--color-text1-4": "#171717"
      "--color-text1-10": "#666666"
      "--color-text1-3": "#8E8E8E"
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
      "--corner-3": 10px
      "--corner-4": 14px
      "--corner-5": 18px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"
      "--oyd-media-surface": "AI 根据 --color-brand1-6 4% 与 #F7F7F7 96% 混合生成媒体浅底"
      "--oyd-tag-surface": "AI 根据 --color-brand1-6 8% 与 #F2F2F2 92% 混合生成标签浅底"
      "--oyd-action-deep": "AI 根据 --color-brand1-6 14% 与 #151515 86% 混合生成深色操作"
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以近白画布、白色细描边容器和主题派生的柔和媒体浅底构成安静空间。核心构图是左侧开放筛选脊柱、中部图像优先对象网格、右侧黏性详情检查器：筛选区不额外套卡，中部卡片让真实媒体占据主要面积，右侧把主媒体、图标指标、折叠信息与底部提交动作整合为一条连续任务轨。页面整体中高密度，但依靠大图、规则留白和稳定三轨比例保持易读。主题色仅用于主操作、选中、焦点和浅表面派生，状态沿用平台语义色；没有真实媒体时使用结构化中性占位，绝不编造素材。

### 风格定位与应用说明

- 核心气质是柔和、务实、媒体优先且任务连续；同时存在多维筛选、可视对象集合和单对象信息时最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 迁移时保留开放筛选脊柱、图像优先卡、浮动角标、媒体检查器、图标指标与黏性底部操作，不复制商品、分类、品牌、价格、库存或专属字段。
- 内容不匹配时，仅把三轨层级、媒体比例、边界、圆角和交互迁移到已有槽位；缺少合法内容的母体降级为 `recipe_only`，新增查看或编辑能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 开放筛选脊柱 | 左侧窄列由多个可折叠条件组连续组成，组间用发丝线分隔，没有外层卡框。`observed`，高置信度 | 窄列、折叠标题、行内计数、发丝分组不可变；筛选维度和控件由 PRD 决定。使用 aside、fieldset 与 sticky 容器 | 退化为弹窗式筛选或厚重卡片，三轨结构失去左侧锚点 |
| 图像优先对象卡 | 中部卡片的大部分高度由实物媒体占据，角标悬于左上，溢出操作位于右上，文字和状态沉底。`observed`，高置信度 | 大媒体比、双角操作和底部两级元信息不可变；素材、标签和值可变。使用 aspect-ratio、absolute overlay 与底部 flex | 退化为文本卡或小缩略图列表，媒体品质和扫读速度下降 |
| 黏性详情检查器 | 右侧窄列把标题、大媒体、三枚图标指标、折叠信息和底部全宽操作收进同一长面板。`observed`，高置信度 | 单列连续任务轨、主媒体、折叠组和底部操作不可变；字段和操作由 PRD 决定。使用 sticky aside 与 column flex | 退化为弹窗或独立散卡，浏览与编辑上下文断裂 |
| 媒体柔焦舞台 | 对象媒体置于近白至主题浅底的低对比舞台，主体完整可见，边缘留白充足，无深色遮罩。`observed`，高置信度 | 低对比背景、完整主体、受控裁切和轻阴影不可变；真实图片与主题色可变。使用 `object-fit:contain` 和主题派生表面 | 退化为强裁切封面图或彩色背景，细腻商品感消失 |
| 图标指标与折叠轨 | 详情媒体下方以圆形图标＋短数值成组，随后用等高折叠行承接更多信息。`observed`，高置信度 | 三列或自适应指标、圆形图标底、等高折叠行不可变；数量、图标与内容可变。使用 grid 与 accordion | 退化为长文本详情，信息层级和操作扫描性下降 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 开放筛选脊柱 | `content_contract`: 存在至少两个真实筛选维度，且用户需要持续调整条件 | `render_policy: prd_match_only`；`direct_trigger`: 筛选 schema 与候选项存在 | `transferable_mechanism`: 无外卡窄列、折叠组、计数、复选与区间控件；`adaptation_targets`: 现有筛选区、查询条件 | `fallback`: 使用 PRD 原筛选方式；`forbidden`: 新增维度、选项、数量或价格区间 |
| 三轨媒体构图 | `content_contract`: 同时存在筛选、可浏览对象集合和单对象详情/编辑上下文 | `render_policy: prd_match_only`；`direct_trigger`: 三种任务同时真实存在 | `transferable_mechanism`: 左窄/中宽/右窄、侧轨 sticky、中区独立滚动；`adaptation_targets`: `supporting_panel`、`primary_content_panel`、详情槽位 | `fallback`: 按 PRD 回到双列、单列或抽屉；`forbidden`: 为维持三栏创造筛选或详情能力 |
| 图像优先对象卡 | `content_contract`: 对象拥有真实主媒体、标题和至少一个补充字段 | `render_policy: prd_match_only`；`direct_trigger`: 真实媒体对象集合 | `transferable_mechanism`: 大媒体、角标、溢出菜单、底部元信息；`adaptation_targets`: 对象网格、`detail_list`、媒体集合 | `fallback`: 使用文本列表或中性占位；`forbidden`: 编造图片、标签、价格、状态或操作 |
| 黏性详情检查器 | `content_contract`: 已有对象选择与查看/编辑任务，详情需在浏览时保持上下文 | `render_policy: adapt_existing_slot`；`direct_trigger`: 可选对象和详情 schema 同时存在 | `transferable_mechanism`: sticky 单列、主媒体、指标、折叠组、底部操作；`adaptation_targets`: 详情侧栏、抽屉、`form_fields` | `fallback`: 使用已有详情页或抽屉；`forbidden`: 新增编辑、保存、全屏或指标能力 |
| 媒体柔焦舞台 | `content_contract`: PRD 提供透明底、棚拍或适合完整展示的真实媒体 | `render_policy: adapt_existing_slot`；`direct_trigger`: 真实主媒体可用 | `transferable_mechanism`: contain 裁切、主题浅底、充足边距、无遮罩；`adaptation_targets`: 卡片媒体区、详情主媒体、缩略图 | `fallback`: 中性比例占位；`forbidden`: 生成不存在的图片或用远程假地址 |
| 图标指标与折叠轨 | `content_contract`: 详情中存在 2-4 个短指标和两个以上可折叠信息组 | `render_policy: recipe_only`；`direct_trigger`: 指标与信息分组均真实存在 | `transferable_mechanism`: 圆形图标指标＋等高 accordion；`adaptation_targets`: 详情摘要、设置分组 | `fallback`: 只保留配方或使用普通字段组；`forbidden`: 编造指标、说明或操作 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；本主题用高对比文字、轻边界、适中圆角、规则间距和近乎无阴影的表面构成稳定基础。`tokens.custom-page` 仅补充近白画布、主题派生媒体浅底、标签浅底与深色操作：三枚派生色分别承担媒体舞台、浮动标签和深色焦点材质，全局 Token 没有这些特定消费关系，且实例化时均由主色计算，不覆盖全局语义。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 画布使用 `--oyd-page-background`，一级面板与对象卡使用白色；媒体区使用 `--oyd-media-surface`，标签使用更明显的 `--oyd-tag-surface`，边界仍保持中性。

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
| 弱分隔、筛选组线和列表行线 | `--color-line1-1` | 应用全局 |
| 控件、面板和对象卡常规边界 | `--color-line1-2` | 应用全局 |
| hover、浅标签和默认弱底 | `--color-fill1-1` | 应用全局 |
| 中性选中底与按下填充 | `--color-fill1-2` | 应用全局 |
| 禁用轨道与骨架 | `--color-fill1-3` | 应用全局 |
| tooltip、popover 和菜单表面 | `--color-fill1-10` | 应用全局 |
| 标题、价格、正文与主要图标 | `--color-text1-4` | 应用全局 |
| 表头、输入占位和次级标签 | `--color-text1-10` | 应用全局 |
| 说明、计数、时间与元信息 | `--color-text1-3` | 应用全局 |
| 页面底层近白画布 | `--oyd-page-background` | 自定义页 |
| 对象卡与详情的柔焦媒体底 | `--oyd-media-surface` | 自定义页 |
| 媒体角标和主题浅标签底 | `--oyd-tag-surface` | 自定义页 |
| 深色主操作与媒体区强焦点 | `--oyd-action-deep` | 自定义页 |

`--color-brand1-6` 是唯一品牌色种子。最终项目实例化时必须把其余六枚 Brand Token 与三枚主题派生页面色写成实际值；没有品牌色时使用中低明度、自然且满足对比的中性色调锚点。换色后至少 85% 的画布、白色表面和边界保持中性，真实媒体色不参与主题同色推演。

### 本主题的配色约束

- `--color-white`、所有 `line1`、`fill1`、`text1` 均为 `neutral-gray`；固定 Hex 的 RGB 三通道相等。
- `--oyd-media-surface` 为 `theme-gray`：由 `--color-brand1-6` 4% 与中性基底 `#F7F7F7` 96% 派生；实例化时写入实际值。
- `--oyd-tag-surface` 为 `theme-gray`：由 `--color-brand1-6` 8% 与中性基底 `#F2F2F2` 92% 派生；仅用于小角标与浅标签。
- `--oyd-action-deep` 为深色主题派生色：由 `--color-brand1-6` 14% 与中性基底 `#151515` 86% 派生；用于小面积强操作，不是普通灰色表面。
- 主题色只用于主操作、焦点、选中和主题派生媒体层；成功、警告、错误和信息状态直接消费平台语义色，并配合文字或图标。

## 字体与排版

- 全局仅使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 使用 `tokens.application-global.typography.subhead`：24px / 600 / 1.3；普通页面不新增展示型标题。
- `panel-title` 使用 `tokens.application-global.typography.body-2`：16px / 600 / 1.4；用于筛选组、对象卡标题与详情分组名。
- `content-title` 和正文使用 `tokens.application-global.typography.body-1`：14px / 400 / 1.5；内容标题只提高字重至 600。
- 表格使用 `tokens.application-global.typography.table`：14px / 400 / 1.45；表头使用同字号、500 字重。
- 辅助说明使用 `tokens.application-global.typography.caption`：12px / 400 / 1.4。
- 数值使用 `font-variant-numeric: tabular-nums`；价格、数量和日期保持完整，不将符号或单位拆到下一行。
- 卡片标题最多两行，详情标题单行省略，描述最多两行预览；完整内容通过详情或展开操作提供。
- 图标采用 1.75px 线性描边和圆角端点；常规 18px、强调 20px、详情指标 18px，与文字首行光学居中。

## 布局与间距

- 页面安全边距使用 `--s-6`，主网格 gap 使用 `--s-6`，卡片间 gap 使用 `--s-4`，面板内边距使用 `--s-4` 或 `--s-6`，筛选行 gap 使用 `--s-2`。
- 内容最大宽度建议 1840px，并使用 `minmax(0,1fr)`；三轨内容契约成立时桌面约为 `280px minmax(0,1fr) 420px`。
- 筛选脊柱与详情检查器可 sticky，顶部偏移取页面标题区高度加 16px；中部对象区独立增长并控制内部滚动。
- 对象网格根据可用宽度使用 2-4 列，最小卡宽 260px；固定列数只由对象媒体与视口宽度决定。
- 页面标题、全局时间或刷新、筛选、对象集合、详情和编辑操作是否出现与顺序由 PRD 决定。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items:stretch`；面板统一 `height:100%; min-width:0; min-height:0; display:flex; flex-direction:column`，标题区固定，内容区 `flex:1; min-height:0`。
- `metric_card` 建议高 168-200px；媒体对象卡建议高 420-520px；主对象网格面板建议高 760-980px；详情 `detail_panel` 建议高 760-980px；可选 `quick_action_item` 高 72-88px。
- 媒体区必须使用确定的 `aspect-ratio`；列表、网格与检查器超长时各自在自己的轨道内部滚动，不能撑破页面网格。
- 图表若由 PRD 触发，容器固定高 280-360px；本主题不因对象集合常见而默认生成图表。
- 区块节奏由父级 grid/flex gap 管理，不使用零散外边距拼接。
- ≥1440px：三轨并列，对象网格 2-4 列；1100-1439px：筛选脊柱可收为 240px，对象网格 2 列，详情保持 360-400px；768-1099px：筛选改抽屉或顶部折叠区，主内容＋详情双列。
- <768px：对象网格单列或双列，详情改全宽抽屉/后继区；<640px：对象网格单列，工具栏换行，底部提交保持 40px 高，触控目标最小 40×40px。
- 移动端沿用同一 `content_contract`，可以改变轨道呈现方式，但保留媒体比例、字段截断、控件高度和内部溢出。

## 表面与层级

- 页面使用 `--oyd-page-background`；中部大面板与详情检查器使用白底、1px `--color-line1-2`、14-18px 圆角，常规不投影。
- 左侧筛选脊柱保持开放画布，仅用 `--color-line1-1` 分组；对象卡为白底、1px 常规边界和 14px 圆角。
- 媒体舞台使用 `--oyd-media-surface`；角标使用 `--oyd-tag-surface`；tooltip 与菜单复用 `--color-fill1-10`。
- 局部浮层允许 `0 8px 24px rgba(0,0,0,.07)`；禁止玻璃模糊、重投影、全卡渐变和媒体上的深色遮罩。
- 同一位置最多两层轮廓；详情检查器中的媒体卡和 accordion 不再叠加外阴影。

## 圆角与形状

- `--corner-1` 4px：复选框、滑轨手柄、微型色点与数量标记。
- `--corner-2` 8px：标签、分页项、工具按钮和折叠图标底。
- `--corner-3` 10px：输入框、选择器和详情指标图标底。
- `--corner-4` 14px：对象卡、媒体卡和常规面板。
- `--corner-5` 18px：主网格外壳与详情检查器。
- `--corner-circle` 用于颜色样本、头像和指标图标；`--corner-semicircle` 用于状态标签与横向选项。
- 同一轨道内保持圆角一致；不混用直角图片、软糯卡片和超大胶囊。

## 组件

### 按钮与操作

- 迷你或行内按钮 28px、紧凑工具栏 32px、常规按钮 36px、强调或宽松按钮 40px；图标按钮使用相应正方形档位。
- 顶部强操作使用 `--oyd-action-deep` 与白字，详情底部提交使用 `--color-brand1-6` 与白字；同一操作区仅一个视觉主操作。
- hover 使用 `--color-brand1-1` 或 `--color-fill1-1`，active 使用 `--color-brand1-9` 或 `--color-fill1-2`；focus 显示 2px 主题色外环并留 2px 间隔。
- disabled 保留边界和文字，使用禁用色或中性填充，不只降低透明度；图标与文字间距 8px。

### 输入与筛选控件

- 紧凑工具栏 32px、常规表单 36px、宽松搜索和选择器 40px；不得出现其他高度。
- 输入使用白底、1px 常规边界和 `--corner-3`；placeholder 使用 `--color-text1-10`，focus 不改变尺寸。
- 复选框 16-18px，命中区至少 40px 高；筛选计数贴右并使用 caption。选中同时显示勾选图标和主题色，不只依赖颜色。
- 区间滑轨使用 4px 轨道、16px 手柄和可编辑端点值；色样使用 20px 圆点，当前项加双层描边及文字名称。
- error 同时显示平台错误色边界、图标和说明；折叠组必须有 `aria-expanded`。

### 卡片与面板

- 主网格与检查器使用 18px 圆角、24px 内边距；对象卡使用 14px 圆角并裁切媒体舞台，信息区内边距 16px。
- 标题区固定，标题与副说明间距 4px；工具栏与内容之间使用 24px，媒体与信息之间不留断裂边界。
- 只有独立、可交互或可复用的信息组才形成嵌套卡；筛选组和普通字段行不额外套卡。

### 开放筛选脊柱

- `content_contract`: 两个以上真实筛选维度；`render_policy: prd_match_only`。
- 侧轨宽 240-300px，组标题行高 40px，选项行高 40px；组间用 1px 弱线与 16px 上下间距分隔。
- 组标题左侧为 body-2，右侧折叠图标；复选项左对齐，计数右对齐。范围、色样等复杂控件只在 schema 支持时出现。
- sticky 高度使用 `max-height:calc(100vh - var(--header-offset))` 并内部滚动；不可替换成多张筛选卡或默认一直隐藏在弹窗中。

### 图像优先对象卡

- `content_contract`: 真实主媒体、标题和补充字段；`render_policy: prd_match_only`。
- 卡片高 420-520px；媒体区占 70%-76%，使用 `aspect-ratio:4/3` 或由素材规范决定，图片 `object-fit:contain`。
- 左上角标为 28px 高主题浅底标签，右上为 28px 溢出按钮；二者距离边缘 16px，不能遮挡主体。
- 信息区使用标题一至两行，底部一行放主值和状态；数值等宽，状态同时用文字和平台语义色。
- hover 只加深边界或轻微提升媒体对比，不缩放主体；不可改成图片背景文字叠压卡。

### 黏性详情检查器

- `content_contract`: 选中对象及现有查看/编辑字段；`render_policy: adapt_existing_slot`。
- 外壳 18px 圆角、24px 内边距，内部 column flex；标题固定，内容内部滚动，底部操作通过 `margin-top:auto` 保持可见。
- 主媒体卡使用 14px 圆角和主题媒体浅底；标题/状态置顶，媒体居中，下方为 2-4 个图标指标。
- 折叠轨每行 72-84px，左侧 36px 圆形图标底，中部两级文字，右侧 chevron；展开内容在本行下方，不弹出新卡。
- 底部主操作 40px 高、全宽；没有保存/提交能力时不显示。移动端改抽屉或后继全宽区，不强制常驻侧栏。

### 媒体柔焦舞台

- `content_contract`: 可完整展示的真实媒体；`render_policy: adapt_existing_slot`。
- 使用 `--oyd-media-surface` 和非常轻的径向明度变化，主体四周至少保留 8%-12% 安全边距。
- 图片使用 `object-fit:contain; object-position:center`；只有 PRD 明确要求封面裁切时才能使用 cover。
- 加载时以同尺寸中性骨架占位；缺图时显示结构化空态与补充素材提示，不生成假图。

### 图标指标与折叠轨

- `content_contract`: 2-4 个短指标或操作，以及多个可折叠字段组；`render_policy: recipe_only`。
- 指标使用自适应 2-4 列，每项由 36-40px 圆形浅底图标、主值和 caption 标签组成；同一行等高。
- 折叠行保持 72-84px，图标和 chevron 对齐中线；hover 使用 `--color-fill1-1`，展开态同时旋转 chevron 并加深标题。
- 指标与 accordion 必须来自 schema；不可用图标替换关键信息或凭空增加指标。

### 图表或主内容面板

- 只有 PRD 提供趋势、分布或对比数据时渲染图表；弱网格使用 `--color-line1-1`，tooltip 使用 `--color-fill1-10`，主序列使用主题色。
- 图表固定高 280-360px，坐标与图例使用 `--color-text1-3`；媒体对象不自动转化为图表数据。
- 无图表契约时以媒体网格、列表、表格、表单或详情承载主内容，不编造统计维度。

### 表格与列表

- 表头高 48px、数据行高 56-64px；弱横线分隔，数值等宽，状态同时使用文字或图标。
- 行 hover 使用 `--color-fill1-1`，selected 使用 `--color-brand1-3` 并保留选择控件。
- 缩略图仅在 PRD 提供真实媒体时出现，建议 48-64px 且 `object-fit:contain`；尾部操作使用 28px 图标按钮。
- 表体内部滚动、表头 sticky、长文本省略；加载骨架与真实行同高。

### 快捷入口（推断）

- 未形成独立快捷入口母体，因此不默认生成。若 PRD 明确存在 `quick_actions`，仅保留 `inferred / render_policy: recipe_only` 配方：白底细边界、40px 主题浅底图标、两级文字、72-88px 固定高度。
- 数量建议 2-4 个，独立于筛选与详情轨；移动端单列；禁止默认彩色宫格，禁止为填充版面新增操作。

### 状态与交互

- 悬停：边界或浅底在 120-160ms 内变化，图片不缩放，布局不抖动。
- 按下：使用品牌按下色或中性点击底，可 `translateY(1px)`，不改变占位。
- 聚焦：控件、对象卡、accordion 和纯图标按钮显示 2px focus ring，并提供可访问名称。
- 加载：保持筛选、媒体卡和检查器高度，以固定比例骨架替代图片和字段。
- 空态与错误：保留轨道与标题，给出简短说明及下一步操作，不整面板染色；图片失败提供重试与文本替代。
- 禁用与选中：保留轮廓和文字；选中同时使用描边、勾选或底色，状态不只依赖颜色。
- 动效：颜色与边界 120-180ms，accordion 160-220ms；`prefers-reduced-motion` 下取消位移和折叠补间。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务和内容上下文，不决定主题资格。原生页面与自定义页面共同继承排版、边界、圆角、间距和交互；自定义页仅在内容契约成立时采用开放筛选脊柱、媒体对象卡、三轨构图、黏性检查器或图标折叠轨。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉承载。单列、列表、表单、详情、流程或其他真实结构都应保留，不能为三轨构图新增筛选、媒体或编辑能力。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时仅展开项目真实存在的页面。每页说明 `page_identity`、`global_actions`、`primary_content_panel`、`supporting_panel`、`detail_list`、`detail_table`、`hero_media` 或 `form_fields` 等真实槽位的位置、跨度、建议高度、移动端顺序和采用的 1-3 个视觉 DNA；未匹配母体不渲染。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、缩略图、图表与辅助图形必须有真实来源，并标明授权与裁切要求；没有素材时使用固定比例中性占位，不编造对象、图片、价格、品牌、状态或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护近白画布、主题派生媒体浅底、轻边界、适中圆角、少阴影与真实媒体优先。
- 筛选契约成立时保护开放脊柱、可折叠组、计数对齐和控件命中区。
- 媒体对象契约成立时保护大图比例、双角操作、底部元信息和 contain 裁切。
- 详情契约成立时保护黏性单列、主媒体、图标指标、折叠轨和底部操作；三轨契约不成立时必须回退。
- 保护同类卡片等高、媒体固定比例、内部滚动、响应式、完整状态和键盘访问。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让主题文件覆盖 PRD 的字段、模块、数据和优先级。
- 禁止把主题色铺满背景和普通卡片；禁止让当前默认色相、真实媒体色或状态色成为主题身份。
- 禁止把三轨、固定网格列数、侧栏位置或模块顺序写成所有页面硬规则。
- 禁止把开放筛选脊柱改成卡片堆，把大图卡改成文字小卡，把检查器改成无上下文弹窗。
- 禁止强裁切主体、在媒体上压大段文字、缩放图片制造 hover、编造图片或远程假地址。
- 禁止瀑布流、自由高度同类卡、`align-items:start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止玻璃模糊、重投影、大面积渐变、无依据装饰和组件库默认样式漂移。

### 错误与正确

- 错误：筛选维度分别放入多张圆角卡；正确：使用开放侧轨、折叠组和发丝分隔形成连续脊柱。
- 错误：媒体只做小缩略图；正确：真实媒体占对象卡主要面积，角标和操作悬于角部，元信息沉底。
- 错误：详情每组独立悬浮；正确：在单一黏性检查器内连续组织主媒体、指标、折叠轨与底部操作。
- 错误：所有图片使用 cover；正确：可完整展示的对象优先 contain，并保留 8%-12% 安全边距。
- 错误：所有页面强制三轨；正确：筛选、对象集合和详情上下文同时成立时使用，否则回退 PRD 原结构。
- 错误：主题色铺满媒体底和卡片；正确：主题色只以低比例派生浅底并连接操作、焦点与选中。
- 错误：同类卡片随图片自由增高；正确：使用固定媒体比例、等高网格和内部溢出。
- 错误：快捷入口使用彩色宫格；正确：仅在 PRD 触发时继承白底细边界与主题浅底图标。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}`，生成七枚实际 Brand Token 与三枚主题派生页面色。所有真实页面先继承全应用 Token 和基础组件语言，再按内容契约选择开放筛选脊柱、图像优先对象卡、三轨媒体构图、黏性详情检查器或图标指标与折叠轨。代表构图只是视觉配方，不用于创造筛选、对象、媒体、价格、状态、查看、编辑或提交能力；主题色只替换派生表面的色相，不改变三轨层级、媒体比例、裁切策略、密度、形状和交互机制。字号与控件尺寸按平台 Token 范围推断，不把图片物理像素当作 CSS 像素。

### 交付自检

- [ ] 全部页面内容、字段和模块是否来自 PRD，而非模板来源？
- [ ] 筛选是否在契约成立时保持开放脊柱、折叠组、计数对齐和 40px 命中区？
- [ ] 对象卡是否保留大媒体比例、双角操作、底部元信息和真实素材？
- [ ] 详情检查器是否保留黏性单列、主媒体、指标、折叠轨和合法底部操作？
- [ ] 媒体舞台是否优先 contain、保留安全边距，并为缺图提供结构化空态？
- [ ] 三轨布局是否具有完整 `content_contract`，且在缺少筛选、对象集合或详情时正确回退？
- [ ] 每个视觉组件是否都有 `render_policy`、适配目标、回退与禁止项？
- [ ] 未被 PRD 触发的母体是否没有强行渲染，且没有新增业务能力或假数据？
- [ ] 主操作、焦点和选中是否共享 `--color-brand1-6`，其余表面是否保持中性？
- [ ] 三枚主题页面色是否按声明比例从 `--color-brand1-6` 与中性基底派生，平台状态色是否未重复定义？
- [ ] 所有固定灰色是否为三通道相等的 `neutral-gray`，真实媒体色是否未被写入主题身份？
- [ ] `application-global` 语义是否稳定，`custom-page` 是否没有同值同义或角色重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、DNA、组件标题和正文总结是否与默认色相及页面类型解耦？
- [ ] 同类卡是否等高、网格是否拉伸、媒体与图表是否定高、长内容是否内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引起布局跳动？
- [ ] 三档以上响应式规则、移动端触控、键盘访问、非纯颜色状态与 reduced motion 是否达标？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在页面，没有枚举不存在的页面？
- [ ] 最终项目实例化时是否替换全部占位符、七枚 Brand Token 和三枚主题派生页面色？
