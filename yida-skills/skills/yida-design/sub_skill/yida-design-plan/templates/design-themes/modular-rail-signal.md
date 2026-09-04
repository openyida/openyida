---
name: "{{PROJECT_NAME}}"
description: 以近白画布、细描边模块、方形图标焦点、条件式主辅双列和复合趋势信号构成中等密度、清晰而富有节奏的层次主题。
themeId: modular-rail-signal
tokens:
  application-global:
    colors:
      "--color-white": "#FFFFFF"
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值：与白色混合 14%，用于悬停>"
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值：与白色混合 88%，用于平台品牌浅色>"
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值：与白色混合 94%，用于浅色导航框架>"
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 18%，用于深色导航框架>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 10%，用于按下与激活>"
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值：与白色混合 64%，用于禁用>"
      "--color-line1-1": "#EAEAEA"
      "--color-line1-2": "#DADADA"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E7E7E7"
      "--color-fill1-10": "rgba(255, 255, 255, 0.97)"
      "--color-text1-4": "#181818"
      "--color-text1-10": "#606060"
      "--color-text1-3": "#8E8E8E"
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
      "--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"
      "--oyd-theme-soft": "color-mix(in srgb, var(--color-brand1-6) 12%, #FFFFFF)"
      "--oyd-theme-bar": "color-mix(in srgb, var(--color-brand1-6) 18%, #FFFFFF)"
      "--oyd-theme-spotlight": "color-mix(in srgb, var(--color-brand1-6) 78%, #111111)"
      "--oyd-theme-object": "color-mix(in srgb, var(--color-brand1-6) 42%, #FFFFFF)"
      "--oyd-inverted-marker": "#181818"
      "--oyd-category-seq-1": "#28B87A"
      "--oyd-category-seq-2": "#F28A22"
      "--oyd-category-seq-3": "#9B63E6"
      "--oyd-category-seq-4": "#E84FA7"
    typography:
      metric-primary:
        "--font-size-metric-primary": 28px
        "--font-weight-metric-primary": 600
        "--font-lineheight-metric-primary": 1.2
      metric-focus:
        "--font-size-metric-focus": 40px
        "--font-weight-metric-focus": 600
        "--font-lineheight-metric-focus": 1.15
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以近白画布、白色细描边模块和稳定 16-20px 圆角建立清晰秩序。页面身份与操作位于顶部，三联摘要以主题色或独立分类色的方形图标块建立焦点；主体在内容契约成立时采用约 2:1 主辅双列，左侧承载结构化行列表、复合折线与柱形图、活动流，右侧承载日期条、色轨事件、清单和主题聚焦卡。主题色连接主操作、当前日期、主趋势线、链接和聚焦卡；独立分类色仅区分真实等权事件类别，平台状态色保持独立。

### 风格定位与应用说明

- 核心气质是“清晰模块、方形图标焦点、复合趋势、色轨条目、主辅并行”；时序、进度、负责人、事件与清单等内容最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留细描边白卡、主辅层级、方形图标、主题主线、浅柱背景、色轨条目、状态胶囊和圆形事件标记，不照搬固定模块、日期、对象或指标。
- 内容不匹配时，主辅双列回退到 PRD 单列，复合图与日程/清单组件保留为 `recipe_only`；需要新增业务能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 方形图标摘要条 | 同一行三张横向摘要卡，左侧为高饱和方形图标块，右侧依次为标题、主值和行内变化。`observed` | 保留“方形图标 / 标题 / 主值与变化”的横向结构、等高与宽松内距；真实数量和内容由 PRD 决定。 | 退化为无图标数字卡或整卡彩底，焦点节奏和轻量感下降。 |
| 条件式主辅模块列 | 主区域使用宽主列与窄辅列，宽列连续承载主要任务与趋势，窄列堆叠时间、清单和聚焦摘要。`observed` | 仅在主要内容与独立辅助内容同时存在时使用约 2:1；所有模块拉伸对齐，模块顺序由 PRD 决定。 | 无条件保留窄列会制造空模块；缺失分层则所有内容等权拥挤。 |
| 复合焦点趋势场 | 同一图中叠加主题主线、两条中性比较线、浅色柱和事件焦点点；顶部有指标组与分段切换，焦点配 tooltip。`observed` | 保留“背景柱 / 中性对照线 / 主题主线 / 事件节点 / tooltip”层级；所有序列与事件必须真实。 | 退化为单一折线或花哨多色图，数据层次与交互焦点消失。 |
| 色轨事件条目 | 辅助面板的条目使用浅灰底、左侧 3-4px 分类色轨、方形图标块和两级文字；日期选择使用单个主题色方块。`observed` | 颜色只编码真实等权类别，当前选择消费主题色；保留细色轨、图标块和两级文字。 | 整条染色或无类别色轨会降低扫描性并破坏克制关系。 |
| 主题聚焦证据卡 | 辅列底部使用高对比主题色卡承载主值、比较说明、头像叠层和低对比抽象对象。`observed` | 只在 PRD 有合法聚焦摘要与真实参与对象时渲染；保留主题色面、白字、右侧抽象层与底部头像组。 | 无依据生成会伪造对象；改为普通白卡则失去页面视觉收束。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 方形图标摘要条 | `content_contract`: 至少两个同层摘要，每项具有图标语义、主值与可选变化说明。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供 `primary_metrics`。 | `transferable_mechanism`: 彩色方形图标块、标题、主值与行内变化；`adaptation_targets`: `primary_metrics`、`primary_summary`。 | `fallback`: 无图标时使用主题线性图标，无摘要时移除；`forbidden`: 不得编造指标、变化率或数量。 |
| 条件式主辅模块列 | `content_contract`: 页面同时存在主要任务内容和至少一个可独立阅读的辅助内容。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 同时提供 `primary_content_panel` 与 `supporting_panel`。 | `transferable_mechanism`: 约 2:1 分栏、等高拉伸、辅列模块堆叠；`adaptation_targets`: 主要内容与真实辅助内容。 | `fallback`: 无独立辅助内容时主列占满；`forbidden`: 不得为形成辅列新增日期、清单、指标或摘要。 |
| 复合焦点趋势场 | `content_contract`: 存在一个主时序、可选真实对照序列、柱形背景量和事件节点中的至少两类。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供可共享横轴的真实多层时序数据。 | `transferable_mechanism`: 浅柱、中性线、主题主线、圆形事件点和 tooltip；`adaptation_targets`: `primary_content_panel`、趋势与容量变化。 | `fallback`: 仅有单序列时使用简化折线；`forbidden`: 不得伪造柱值、对照线、事件、月份或变化率。 |
| 色轨事件条目 | `content_contract`: 存在有时间/顺序、真实类别、标题和辅助说明的条目集合。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供有序事件或分组条目。 | `transferable_mechanism`: 浅灰条目、窄色轨、方形图标和两级文本；`adaptation_targets`: `supporting_panel`、`detail_list`、事件流。 | `fallback`: 无类别时色轨统一主题色或移除；`forbidden`: 不得编造日期、类别、时间、地点或操作。 |
| 主题聚焦证据卡 | `content_contract`: PRD 明确一个重点结果，并提供比较信息与可选真实参与对象。 | `render_policy: prd_match_only`；`direct_trigger`: 存在 `primary_summary` 与真实对象集合。 | `transferable_mechanism`: 主题色高对比面、主值、说明、头像叠层与抽象低对比对象；`adaptation_targets`: `supporting_panel`、重点成果、阶段总结。 | `fallback`: 无参与对象时移除头像，无聚焦摘要时不渲染；`forbidden`: 不得编造主值、参与者、头像或比较信息。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩灰阶、24px 以内标题、4px 基础间距和 4-20px 圆角阶梯。`tokens.custom-page` 只补充近白画布、主题浅底、主题柱、主题聚焦卡与抽象对象、反相事件标记、四个独立分类序列，以及全局缺失的常规指标与焦点指标数字语义。普通边界、网格、tooltip 和平台状态色直接复用全局或平台 Token。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 近白画布与白色细描边模块占主导；主题色承担主操作、主趋势、当前选择和聚焦卡，分类色只作为方形图标、窄色轨或小型类别标记。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；主操作、主线、当前选择、链接与焦点 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔、图表网格、表格和列表行线 | `--color-line1-1` | 应用全局 |
| 输入、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层近白画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 主题浅状态底、当前项背景与图标浅底 | `--oyd-theme-soft` | 自定义页 |
| 复合趋势图的主题浅柱 | `--oyd-theme-bar` | 自定义页 |
| 高对比主题聚焦卡背景 | `--oyd-theme-spotlight` | 自定义页 |
| 聚焦卡内低对比抽象对象 | `--oyd-theme-object` | 自定义页 |
| 图表中的反相事件焦点 | `--oyd-inverted-marker` | 自定义页 |
| 第一至第四真实等权类别的方形图标与窄色轨 | `--oyd-category-seq-1 / --oyd-category-seq-2 / --oyd-category-seq-3 / --oyd-category-seq-4` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底和嵌套浅层 | `--color-fill1-2` | 应用全局 |
| 更重中性填充和禁用轨道 | `--color-fill1-3` | 应用全局 |
| 标题、主值、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子。其余六个 Brand Token 与 `--oyd-theme-soft / --oyd-theme-bar / --oyd-theme-spotlight / --oyd-theme-object` 均由它派生并在项目实例化时写入实际色值。`--oyd-category-seq-1 / --oyd-category-seq-2 / --oyd-category-seq-3 / --oyd-category-seq-4` 是独立分类色，仅在 PRD 确认多个等权类别且颜色区分有必要时使用，不参与主题同色推演，不承担平台状态或主操作。无彩区域不少于页面面积的 82%，主题聚焦卡通常不超过首屏面积的 12%。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3` 与 `--oyd-inverted-marker` 均为 `neutral-gray`，Hex 满足 `R = G = B`；`--color-fill1-10` 的前三通道相等。
- `--oyd-theme-soft` 与 `--oyd-theme-bar` 是 `theme-gray` / 主题浅色，分别由 `--color-brand1-6` 12% / 18% 与 `#FFFFFF` 混合；实例化时写入实际色值。
- `--oyd-theme-spotlight` 与 `--oyd-theme-object` 是主题派生色；前者由主题色 78% 与 `#111111` 22% 混合，后者由主题色 42% 与白色 58% 混合。
- `--oyd-category-seq-1 / --oyd-category-seq-2 / --oyd-category-seq-3 / --oyd-category-seq-4` 是独立分类色，只占小面积；成功、警告、错误和信息状态仍直接消费平台语义色并配合文字或图标。
- 禁止从分类色反推主题色，禁止用分类色铺满普通卡片或在同一图表中无节制增加系列。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；正文与列表主文本消费 `body-1`；表格消费 `table`；辅助信息消费 `caption`。
- `subhead` 为 24px / 600 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 28px / 600 / 1.2，用于摘要主值；`metric-focus` 为 40px / 600 / 1.15，用于复合趋势焦点与主题聚焦卡主值。两者是全局层缺失的数据语义，不替代标题。
- 数值启用 `font-variant-numeric: tabular-nums`；页面说明最多两行，列表标题单行省略，清单说明最多两行，完整内容通过详情或可访问名称提供。
- 图标使用 1.5px 线性描边、圆端点；方形图标块内图标 18-20px，工具图标 18px，头像 28-32px，均与首行文字视觉居中。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：图标与文字用 `--s-2 / --s-3`，工具组用 `--s-3 / --s-4`，卡片内距用 `--s-4 / --s-6`，大区块用 `--s-6 / --s-8`。
- 全页面最大宽度 1760px，桌面安全边距 24-32px；父级使用 `gap`，同类面板拉伸对齐，子项设置 `min-width: 0`。
- 摘要组按真实数量自适应等宽列；主辅双列仅在 `primary_content_panel` 与独立 `supporting_panel` 同时存在时使用，约 2:1。
- 页面身份、操作、主要任务、图表、活动、日期条、清单和聚焦摘要是否出现及顺序由 PRD 决定；无相应内容时不保留空卡。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items: stretch`；禁止瀑布流与 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题区固定，内容区 `flex: 1; min-height: 0`。
- `metric_card` 高 116-140px；主要列表 `detail_panel` 高 320-400px；复合趋势 `chart_panel` 高 520-620px；辅列事件面板高 460-540px；清单面板高 380-480px；主题聚焦卡高 220-280px；可选 `quick_action_item` 高 68-84px。
- 复合趋势绘图区固定 300-360px；列表和清单内部滚动或截断，不撑破外层；同一行面板底部对齐。
- ≥1360px：摘要最多 3-4 列，主辅契约成立时约 2:1，辅列模块垂直堆叠。900-1359px：摘要 2 列，主辅上下排列，辅助模块 2 列。<900px：全部单列，操作移到标题下方，日期条和标签允许横向滚动，图表必要时横向滚动；移动端可解除等高但保留固定绘图区和触控目标。
- 内容契约不成立时，各断点按 PRD 的单列、列表、表单、详情或流程模式组织，不生成空辅列、空图表或空摘要。

## 表面与层级

- 常规面板使用 `--color-white`、1px `--color-line1-1`、`--corner-4 / --corner-5`，默认不投影；通过边界、留白和局部浅填充建立层级。
- 方形图标块、当前日期和主操作使用主题或独立类别色；面板内部条目使用 `--color-fill1-1`，不再套同等描边卡。
- tooltip、popover 使用 `--color-fill1-10`、`--color-line1-2` 和 `0 8px 24px rgba(0,0,0,0.10)`；图表事件标记可使用轻投影 `0 4px 12px rgba(0,0,0,0.12)`。
- 仅主题聚焦卡允许主题色大面和低对比抽象对象；禁止毛玻璃、霓虹辉光、全页渐变和普遍强阴影。

## 圆角与形状

- `--corner-1` 4px 用于细色轨、短状态和小点；`--corner-2` 8px 用于输入、按钮、图标块与 tooltip；`--corner-3` 12px 用于事件条目和分段控件；`--corner-4` 16px 用于常规卡片；`--corner-5` 20px 用于大图表和主要面板。
- `--corner-semicircle` 用于状态胶囊、短标签与头像计数；`--corner-circle` 用于头像、图表事件标记、清单选择和圆形图标按钮。
- 同层面板圆角一致；方形图标块保持 8-12px 圆角，不改成圆形大徽章。

## 组件

### 按钮与操作

按钮只使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮使用同档正方形。主按钮消费 `--color-brand1-6`，次按钮白底细边。hover、active 使用 `--color-brand1-1 / --color-brand1-9`，focus 为 2px 主题色外环加 2px offset，disabled 同时降低文字和边界对比。同一操作区只保留一个视觉主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。控件使用白色表面、`--color-line1-2` 与 `--corner-2`；placeholder 消费 `--color-text1-10`。focus 使用主题色边界与外环，error 使用平台错误色并附文字。周期、分段、日期与筛选按真实任务成组等高排列。

### 卡片与面板

摘要卡使用 `--corner-4`、`--s-4 / --s-6` 内距和固定高度；主面板使用 `--corner-5`、`--s-6` 内距；辅助面板使用 `--corner-4 / --corner-5` 并与主面板同一边界语言。嵌套条目只使用浅填充、色轨或分隔线，禁止无限套卡。

### 方形图标摘要条

固定公式为“48-56px 方形图标块 / 两级文字 / 主值与行内变化”。图标块只使用主题色或真实独立分类色，白色线性图标 18-20px；主值消费 `metric-primary`。变化信息使用平台状态色加方向符号或文字，不能只靠颜色。

### 复合焦点趋势场

绘图区固定高度；底层为 `--oyd-theme-bar` 浅柱，中层最多两条 1px 中性对照线，顶层为 2.5px 主题主线。事件节点直径 8-12px，特殊焦点可使用 36-44px 圆形标记并与垂直虚线连接；tooltip 复用白色浮层。缺少真实对照或事件时删除对应层，不用装饰数据补齐。

### 色轨事件与清单条目

事件条目高 72-88px，使用 `--color-fill1-1`、`--corner-3`、左侧 3-4px 色轨、36-40px 方形图标底和两级文字；清单行高 72-92px，使用圆形选择标记、主标题、最多两行说明与弱分隔。类别色只在色轨和图标中出现，整条保持无彩。

### 主题聚焦证据卡

卡体高 220-280px，背景 `--oyd-theme-spotlight`，左侧为标题、`metric-focus` 主值、比较说明与头像叠层，右侧为 `--oyd-theme-object` 低对比抽象对象。文字使用白色，抽象对象面积不超过卡片 46%；无真实头像时删除头像组，不用虚拟人物补齐。

### 图表或主内容面板

图表使用固定绘图区、稀疏坐标标签、最多一个主题主序列与两个中性对照序列；同一图不得让四个分类色同时成为主线。图例和分段控件靠近标题区，tooltip 不遮挡焦点。键盘可逐点导航，提供数据摘要与表格替代。

### 表格与列表

结构化列表和表格表头 44-48px、数据行 60-72px；首列可用线性类型图标，人员或对象列可用 28-32px 头像，状态使用浅胶囊，尾部操作为 28px 图标按钮。长文本单行省略并提供完整值；容器内部滚动且表头可粘附。

### 快捷入口（可见或推断）

视觉材料的顶部主次操作可见，但未形成独立快捷入口区；独立入口默认 `confidence: inferred`、`render_policy: recipe_only`。若 PRD 明确要求，使用 68-84px 白色细描边条目、方形主题图标和两级文字；禁止默认彩色宫格。

### 状态与交互

- 悬停：卡片边界加深至 `--color-line1-2`，列表行和事件条目切换到 `--color-fill1-2`，不发生位移。
- 按下：按钮消费 `--color-brand1-9`，可点击条目使用 1px 内缩反馈，不改变外部尺寸。
- 聚焦：控件、可点击行和图表节点显示 2px 主题色 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持指标、主辅面板和绘图区固定高度，以中性骨架避免网格跳动。
- 空态与错误：保留原面板结构，提供简短说明与真实下一步操作，不把整张卡染成状态色。
- 禁用与选中：禁用同时降低文字、图标和边界对比；选中使用主题色、背景、图标或文字组合，不只依赖颜色。
- 动效：hover 120-160ms，tooltip 160-200ms，图表更新 240-320ms，使用 ease-out；`prefers-reduced-motion` 下关闭路径绘制、缩放与位移。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务和内容上下文，不决定主题是否可用。原生页面与自定义页面共同继承近白画布、白色细描边模块、排版、间距、圆角和控件状态；自定义页面仅在内容契约成立时补充复合趋势、色轨条目、主辅双列与主题聚焦卡。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容、信息架构和模块。本主题只规定视觉表达；没有时序、事件、清单或聚焦摘要时，页面保持 PRD 的列表、表单、详情或流程结构，只迁移模块边界、方形图标、排版、圆角与间距。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面；每页说明 `page_identity`、`global_actions`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table/detail_list` 的位置、跨度、高度、移动端顺序和采用的视觉 DNA。页面不必使用全部组件母体，但采用对应内容类型时必须遵守本文构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 头像、图标、图表、缩略对象和辅助图形必须有真实授权来源；没有素材时使用中性占位或移除相应层，不编造人物、项目、事件、指标或图片地址。

## 设计规范与禁忌

### 必须做到

- 所有页面必须保留近白画布、白色细描边模块、清晰主次层级、小面积主题焦点和稳定间距。
- 摘要契约成立时保护方形图标、两级文字、主值与变化；主辅契约成立时保护 2:1 层级和等高拉伸，无辅助内容时主列占满。
- 复合趋势契约成立时保护浅柱、中性对照线、主题主线、事件节点和 tooltip；缺少真实层级时必须简化。
- 事件或清单契约成立时保护色轨、方形图标、两级文本或圆形选择标记；聚焦摘要契约成立时保护高对比主题面和真实头像降级。
- 图表固定高度、同类面板等高、父级 gap、内部溢出、三档响应式、键盘访问与完整状态必须落地。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景或普通面板；主题大色面只允许出现在内容契约成立的聚焦卡。
- 禁止把固定三卡、2:1 分栏、辅列模块或顺序写成所有页面无条件执行的结构。
- 禁止为复合图编造柱、对照线、事件和月份；禁止为辅列编造日期、清单、人员或指标。
- 禁止把色轨扩展为整条彩底、让分类色承担主操作或平台状态、在同一图表中堆叠无关彩色序列。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止毛玻璃、霓虹辉光、普遍强阴影、无依据装饰和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：摘要卡整卡使用不同高饱和底色；正确：白色卡体加小面积方形图标焦点和行内状态。
- 错误：把复合趋势简化为无层级的多色折线；正确：浅柱在底、中性线居中、主题主线与事件焦点在顶。
- 错误：为保持辅列生成不存在的日期、清单或聚焦指标；正确：内容契约成立时使用 2:1，否则主列占满。
- 错误：事件条目整行染色；正确：浅灰条目只用 3-4px 色轨和方形图标编码真实类别。
- 错误：无真实对象仍显示头像叠层；正确：移除头像组或使用 PRD 提供的合法回退。
- 错误：主题色铺满所有卡片；正确：主题色连接主操作、主线、当前选择和单个聚焦卡，其余表面保持中性。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token 与主题派生图表/聚焦色。所有真实页面先继承近白画布、细描边白卡、方形图标、排版、间距和状态语言，再按内容契约选择主辅双列、复合焦点趋势、色轨事件、清单或主题聚焦卡。不得为复刻代表构图新增项目、事件、人员、图表序列、日期或操作；主题色只替换色相，不改变模块层级、复合图顺序、色轨机制和布局稳定性。

### 交付自检

- [ ] 全部页面内容和模块是否来自 PRD，而非模板来源？
- [ ] 方形图标摘要是否等高，并保留图标、两级文字、主值和非纯颜色变化说明？
- [ ] 主辅双列是否只在主要与独立辅助内容同时存在时渲染，无匹配时是否回退单列？
- [ ] 复合趋势是否保持浅柱、中性对照线、主题主线、事件节点和 tooltip 的正确层级？
- [ ] 色轨事件是否仅编码真实等权类别，整条是否保持无彩？
- [ ] 主题聚焦卡是否只使用真实摘要和对象，抽象对象与头像是否正确降级？
- [ ] 每个视觉记忆组件是否都有 `content_contract`、`render_policy`、迁移目标和无匹配回退策略？
- [ ] 固定摘要数量、主辅比例、辅列和模块顺序是否具有内容契约，而非全页面硬规则？
- [ ] 未被 PRD 触发的组件是否没有强行渲染，视觉迁移是否没有新增业务内容？
- [ ] 主操作、主趋势、当前选择和焦点是否共享 `--color-brand1-6`，平台状态色是否保持独立语义？
- [ ] 独立分类色是否只承担真实等权类别，未替代主题色或平台状态色？
- [ ] `application-global` 的变量名和消费语义是否稳定，具体值是否依据本主题生成？
- [ ] `custom-page` 是否逐项通过全局语义复用检查，没有同值同义或角色重叠的重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、视觉 DNA、组件标题和正文总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的中等密度、细描边、条件式双列和清晰焦点是否与 Token 及正文一致？
- [ ] 是否没有建立适用/不适用产品形态清单，所有页面是否共享全应用 Token 和基础组件语言？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在的页面，没有枚举不存在的页面？
- [ ] 主题同色演变是否由 `--color-brand1-6` 派生，平台状态语义色是否未在 `custom-page` 重复声明？
- [ ] 所有灰色 Token 是否已分类；`neutral-gray` 是否满足三通道相等，主题派生色是否声明基底、比例和实例化要求？
- [ ] 同类面板是否等高，图表是否固定高度，长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引发布局跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 的实际色值？
