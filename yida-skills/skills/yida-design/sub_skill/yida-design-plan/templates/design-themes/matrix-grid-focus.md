---
name: "{{PROJECT_NAME}}"
description: 以浅中性画布、细描边表面、单主题数据标记、离散矩阵纹理和紧凑工具栏构成中高密度的精确主题。
themeId: matrix-grid-focus
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
      "--color-line1-2": "#D8D8D8"
      "--color-fill1-1": "#F7F7F7"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E6E6E6"
      "--color-fill1-10": "rgba(255, 255, 255, 0.97)"
      "--color-text1-4": "#1A1A1A"
      "--color-text1-10": "#606060"
      "--color-text1-3": "#8A8A8A"
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
      "--s-5": 20px
      "--s-7": 28px
    rounded:
      "--corner-zero": 0px
      "--corner-1": 4px
      "--corner-2": 8px
      "--corner-3": 10px
      "--corner-4": 12px
      "--corner-5": 14px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "var(--pod-page-bg-color, var(--color-white, #fff))"
      "--oyd-matrix-level-1": "color-mix(in srgb, var(--color-brand1-6) 12%, #FFFFFF)"
      "--oyd-matrix-level-2": "color-mix(in srgb, var(--color-brand1-6) 35%, #FFFFFF)"
      "--oyd-matrix-level-3": "color-mix(in srgb, var(--color-brand1-6) 68%, #FFFFFF)"
      "--oyd-matrix-level-4": "var(--color-brand1-6)"
    typography:
      metric-primary:
        "--font-size-metric-primary": 28px
        "--font-weight-metric-primary": 650
        "--font-lineheight-metric-primary": 1.2
      data-eyebrow:
        "--font-family-data-eyebrow": "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace"
        "--font-size-data-eyebrow": 12px
        "--font-weight-data-eyebrow": 500
        "--font-lineheight-data-eyebrow": 1.4
        "--font-letterspacing-data-eyebrow": 0.08em
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以浅中性画布、白色细描边表面和紧凑工具栏建立精确秩序。所有非文字的强数据标记——主按钮、矩阵单元、柱线、点、图例、选中态与范围指针——统一消费 `--color-brand1-6`；无品牌色时默认将纯黑 `#111111` 作为 `{{PRIMARY_COLOR}}`，换色后这些标记同步替换，文字颜色保持独立。视觉记忆点由微柱摘要卡、离散矩阵主图、细柱对照面板、内嵌提示条和连续明细表构成；页面中高密度、面板内距克制、阴影极轻，以边界与层级标题维持稳定性。

### 风格定位与应用说明

- 核心气质是“离散数据纹理、单主题强标记、精细边界、紧凑控制”；连续数据、密度分布、对照序列和结构化明细最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留数据眉标、微柱、矩阵格、细柱、分段控件、白色 tooltip、连续表格和边界层级，不照搬固定业务内容。
- 内容不匹配时，将矩阵密度阶梯迁移到已有离散状态或热度槽位；无合法承载则 `recipe_only`，需要新增能力则 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 微柱摘要卡 | 同层摘要卡由主内容区、右侧 5-7 根微柱与底部弱比较条组成，卡体细边、低圆角、无重阴影。`observed` | 保持“眉标—主值—微柱—比较脚注”四层结构；字段与比较内容由 PRD 决定，微柱中的强标记消费 `--color-brand1-6`。 | 退化为纯文字 KPI 或大色块卡，失去精密数据气质。 |
| 离散矩阵密度场 | 主图由大量等尺寸小方格组成，主题色格从底部形成峰谷，灰阶格提供对照；焦点使用垂直指针与悬浮信息层。`observed` | 保留固定单元尺寸、4-6px 间隙、主题派生四阶、低对比对照格和明确焦点；真实维度与数值由 PRD 决定。 | 退化为普通面积图或连续柱图，最核心的离散纹理消失。 |
| 细柱双层对照 | 窄面板使用灰色背景柱与主题色前景细柱，共享中心轴和稀疏虚线网格。`observed` | 保留背景基准、前景实际、细圆端柱与固定基线；对照关系必须有真实数据，主题前景消费 `--color-brand1-6`。 | 只有单层柱或粗柱，主次比较不清且与矩阵主图失去呼应。 |
| 分层工具面板 | 面板包含眉标标题带、主内容容器、分段选择、日期/筛选控件、提示条和尾部操作，全部沿统一高度与细边界组织。`observed` | 保留 28-40px 离散控件高度、细描边、左右对齐和内嵌提示条；操作是否存在由 PRD 决定。 | 控件尺寸混乱、操作漂浮，页面退化为拼装式组件库外观。 |
| 连续明细表 | 明细区标题工具栏与表头、数据行连续衔接，状态使用描边胶囊，尾部操作为小方形图标按钮。`observed` | 保留连续容器、44px 表头、56-64px 行、等宽数字、状态图标+文字和内部滚动。 | 退化为每行独立卡或重边框表格，扫描效率下降。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 微柱摘要卡组 | `content_contract`: 至少 2 个并列摘要，每项具有主值和可选微趋势或分布。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供摘要与真实微序列。 | `transferable_mechanism`: 眉标、主值、右侧微柱和底部脚注；`adaptation_targets`: `primary_metrics`、`primary_summary`。 | `fallback`: 无微序列时移除微柱，保留摘要与脚注；`forbidden`: 不得编造趋势、比较期或变化值。 |
| 离散矩阵密度场 | `content_contract`: 数据能映射为有序时间/类别 × 离散层级或计数密度。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供可离散化的真实二维或密度数据。 | `transferable_mechanism`: 固定方格、主题四阶、对照灰格、指针与 tooltip；`adaptation_targets`: `primary_content_panel`、日历热度、区间分布。 | `fallback`: 数据不支持矩阵时使用 PRD 指定图表，只迁移单主题标记与 tooltip；`forbidden`: 不得伪造格点、密度、时间轴或峰值。 |
| 细柱对照面板与条件式主辅分栏 | `content_contract`: 页面同时存在主要密度视图和可独立阅读的真实对照分布。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 同时提供主数据与辅助对照数据。 | `transferable_mechanism`: 约 2:1 主辅比例、灰基准+主题前景、稀疏虚线网格；`adaptation_targets`: `primary_content_panel`、`supporting_panel`。 | `fallback`: 无独立对照时使用单列主视图；`forbidden`: 不得为形成窄面板新增分类、洞察、日期范围或对照值。 |
| 分层工具与提示面板 | `content_contract`: 页面存在真实时间范围、筛选、导出、分段视图或辅助建议。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 已定义对应操作。 | `transferable_mechanism`: 等高控件、细边界、分段选择与内嵌提示条；`adaptation_targets`: `global_actions`、面板工具栏、`supporting_panel`。 | `fallback`: 只渲染 PRD 要求的操作；`forbidden`: 不得新增导出、智能建议、日期筛选或详情入口。 |
| 连续明细表 | `content_contract`: 存在结构化记录及真实状态、数值和行操作。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 要求表格或结构化列表。 | `transferable_mechanism`: 连续容器、轻表头、等宽数字、状态胶囊和弱尾部操作；`adaptation_targets`: `detail_table`、`detail_list`。 | `fallback`: 无明细时不渲染；`forbidden`: 不得虚构记录、人物、产品、状态、金额或操作。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、24px 以内标题、4px 基础间距和 4-14px 圆角阶梯。`tokens.custom-page` 只补充页面画布、矩阵主题四阶与全局层缺失的主指标数字、等宽数据眉标。图表网格复用 `--color-line1-1`，tooltip 复用 `--color-fill1-10`，对照柱与空闲矩阵格复用 `--color-fill1-3 / --color-fill1-2`，不重复声明同义 Token。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 画布、卡片和表格保持中性；所有非文字的强数据标记统一由主题色驱动。默认主色锚点为 `#111111`，但不得在组件 CSS 中写死纯黑。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 主按钮、链接、矩阵格、柱线、点、图例、选中态与范围指针 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、图表网格和表格行线 | `--color-line1-1` | 应用全局 |
| 输入框、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 矩阵最低密度主题阶 | `--oyd-matrix-level-1` | 自定义页 |
| 矩阵中低密度主题阶 | `--oyd-matrix-level-2` | 自定义页 |
| 矩阵中高密度主题阶 | `--oyd-matrix-level-3` | 自定义页 |
| 矩阵最高密度主题阶 | `--oyd-matrix-level-4` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底与空闲矩阵格 | `--color-fill1-2` | 应用全局 |
| 更重中性填充、微柱轨道与对照柱 | `--color-fill1-3` | 应用全局 |
| 标题、核心数字、正文和文字图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子。上游未提供品牌色时，将 `#111111` 写入 `{{PRIMARY_COLOR}}`；一旦替换主题色，所有非文字纯黑角色必须同步替换，不能保留硬编码黑色。文字仍消费 `text1-*`，平台状态仍消费成功、警告、错误与信息语义色。中性画布与白色表面应占页面面积 88% 以上，主题色标记面积控制在 8%-12%。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3` 均为 `neutral-gray`，Hex 满足 `R = G = B`；`--color-fill1-10` 为等通道白色 rgba。
- `--oyd-matrix-level-1 / --oyd-matrix-level-2 / --oyd-matrix-level-3 / --oyd-matrix-level-4` 是 `theme-gray` / 主题同色阶，由 `--color-brand1-6` 分别以 12%、35%、68%、100% 与白色混合；项目实例化时写入实际色值。
- 除文字外，不得使用 `#000000`、`#111111` 或其他固定纯黑表达主按钮、数据、图例、选中与交互焦点；这些角色必须消费 `--color-brand1-6`。
- 成功、警告、错误和信息状态直接消费平台语义色，并配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 同一图表默认只使用主题色阶与中性对照灰，不额外引入独立分类色；多个真实类别必须通过线型、形状、标签或受控分类色共同区分。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；正文消费 `body-1`；表格消费 `table`；辅助信息消费 `caption`。
- `subhead` 为 24px / 600 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 28px / 650 / 1.2，仅用于摘要主值；`data-eyebrow` 使用 12px / 500 / 1.4、0.08em 字距和等宽字体，仅用于大写数据眉标。这两个语义在全局层不存在，不覆盖已有 Token。
- 数值启用 `font-variant-numeric: tabular-nums`；长标题最多两行，表格主文本单行省略并提供完整值。
- 图标使用 1.5px 线性描边、圆端点；正文图标 16-18px，工具栏图标 18px。图标与首行文字视觉居中，不用 emoji 替代功能图标。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-7`：微间距用 `--s-1 / --s-2`，控件组用 `--s-3`，卡片内距用 `--s-4 / --s-5`，大区块用 `--s-5 / --s-7`。
- 全页面最大宽度 1680px，安全边距 20-28px；父级使用 `gap`，同类面板拉伸，长内容内部处理。
- 四列摘要只在至少 2 个同层摘要内容契约成立时按真实数量生成；主辅约 2:1 仅在矩阵主视图与独立对照内容同时存在时使用。
- 页面身份和全局操作两端对齐；`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table/detail_list` 是否出现与顺序由 PRD 决定。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items: stretch`；禁止瀑布流与 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题固定，内容区 `flex: 1; min-height: 0`。
- `metric_card` 高 160-184px；矩阵 `chart_panel` 高 540-640px；细柱辅助面板高 540-640px；`detail_panel` 首屏高 340-520px；可选 `quick_action_item` 高 68-80px。
- 矩阵绘图区固定 400-480px，细柱绘图区固定 280-360px；表格与长文本内部滚动、截断或折叠，不撑破外层。
- ≥1280px：摘要按真实数量横排，主辅契约成立时约 2:1；768-1279px：摘要 2 列，主辅上下排列；<768px：单列，工具栏按组换行，矩阵允许横向滚动或降低列密度，辅助面板排在主内容后，可解除等高但保留控件高度与溢出。
- 内容契约不成立时，各断点按 PRD 页面模式组织，不生成空卡、空图或空辅助列。

## 表面与层级

- 常规面板使用 `--color-white`、1px `--color-line1-1`、`0 1px 3px rgba(0,0,0,0.04)`；摘要卡底部脚注区使用 `--color-fill1-1`。
- 面板标题带可使用 `--color-fill1-1`，与白色内容区通过 1px 边界区分；不依赖重阴影。
- tooltip、popover 使用 `--color-fill1-10`、`--color-line1-2` 和 `0 8px 24px rgba(0,0,0,0.10)`；嵌套提示条使用浅填充与细边界，不重复投影。
- 禁止毛玻璃、强辉光和大面积渐变；矩阵主题阶是数据编码，不得用于装饰背景。

## 圆角与形状

- `--corner-1` 4px 用于矩阵格、短状态与微柱；`--corner-2` 8px 用于输入、按钮和 tooltip；`--corner-3` 10px 用于分段控件与表格状态；`--corner-4` 12px 用于卡片；`--corner-5` 14px 用于大面板与浮层。
- `--corner-semicircle` 仅用于状态胶囊、细柱端点与分段选择；`--corner-circle` 用于图标按钮、焦点点和信息图标。
- 同层组件圆角一致；矩阵方格保持小圆角，不改为圆点或超大胶囊。

## 组件

### 按钮与操作

按钮仅使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮为同档正方形。主按钮背景必须消费 `--color-brand1-6`，默认纯黑仅来自主题种子，不写死；次按钮白底细边。hover、active 使用 `--color-brand1-1 / --color-brand1-9`，focus 为 2px 主题色外环加 2px offset；disabled 同时降低文字和边界对比。同一操作区只保留一个主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。白色表面、`--color-line1-2`、`--corner-2`；placeholder 用 `--color-text1-10`。focus 使用主题色边界与外环，error 消费平台错误色并配合文字。周期、日期、搜索与次操作保持同高并按组连接。

### 卡片与面板

摘要卡使用 `--corner-4`、大面板用 `--corner-5`；内距 `--s-4 / --s-5`。标题带、内容区与脚注区是明确的三个层级，内容区 `flex: 1`。嵌套提示条可用浅填充，不把每段文本包卡。卡片边界始终轻于控件焦点边界。

### 微柱摘要卡

固定公式：眉标 + 主值与可选单位 + 右侧 5-7 根 2-4px 微柱 + 底部比较脚注。微柱轨道用 `--color-fill1-3`，单根强柱使用 `--color-brand1-6`；脚注区高 40-48px，状态色仅用于真实语义。卡片等高、无彩色大底。禁止把微柱误作装饰或硬编码黑色。

### 离散矩阵密度场

固定公式：固定高度绘图区 + 8-14px 方格 + 4-6px gap + 主题四阶 + 中性对照格 + 坐标标签。焦点使用 1px 垂直虚线、12-16px 主题色点和白色 tooltip；当前区间标签加粗。单元格颜色按真实密度映射 `--oyd-matrix-level-1 / --oyd-matrix-level-2 / --oyd-matrix-level-3 / --oyd-matrix-level-4`，无数据格使用 `--color-fill1-2`。禁止使用固定黑色、随机深浅或把矩阵替换成连续面积。

### 细柱双层对照

固定公式：每个数据位一根 3-5px 中性背景柱 + 一根 3-5px 主题前景柱，底部共线，端点微圆；网格为 1px 虚线。背景消费 `--color-fill1-3`，前景消费 `--color-brand1-6`。无真实对照时只显示主题单柱，不保留虚假灰柱。

### 分层工具与提示面板

面板标题眉标位于浅填充标题带；分段控件使用 32-36px 胶囊容器与白色激活项；日期、筛选和更多操作保持同高。提示条由 32px 图标块、短文案和尾部箭头组成，只在 PRD 有对应建议或入口时出现。主操作背景消费主题色，非文字黑色不得写死。

### 图表或主内容面板

图表工具栏固定，绘图区有确定高度；网格与坐标保持低对比。图例使用主题色点与中性点并附文本，不只靠颜色。tooltip 复用全局浮层 Token，包含维度、主值与可选对照。图表提供文本摘要、键盘焦点和 `aria-label`；加载时使用稳定矩阵/柱骨架。

### 表格与列表

标题工具栏、44px 表头和 56-64px 数据行共享一个连续容器；只使用水平分隔。主文本左对齐，数字右对齐并启用等宽数字；状态胶囊高 28-32px，必须包含图标与文字；尾部操作为 28/32px 方形图标按钮。表头 sticky，表体内部滚动；移动端转字段分组列表或横向滚动。

### 快捷入口（推断）

未观察到独立快捷入口，因此只保留 `inferred / render_policy: recipe_only` 配方：PRD 明确存在高频入口时，使用独立区块、2-4 个等宽项、68-80px 高、白底细边与单色线性图标。非文字图标焦点消费主题色，禁止默认彩色宫格，禁止塞入表格工具栏。

### 状态与交互

- 悬停：100-160ms 内改变边界、浅填充或矩阵阶级，不改变尺寸。
- 按下：80-120ms 消费 `--color-brand1-9` 或 1px 内收反馈。
- 聚焦：显示清楚 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持面板与图表固定高度，使用骨架或稳定占位。
- 空态与错误：保留原结构，提供简短说明与下一步操作，不整块染色。
- 禁用与选中：禁用结合低对比、图标和文案；选中结合主题色边界、点或字重，不只依赖颜色。
- 动效：常规 100-180ms `ease-out`，矩阵与柱更新 180-260ms；`prefers-reduced-motion` 下关闭位移和逐项动画。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题资格。原生页面与自定义页面共同继承全应用颜色、字体、间距与圆角；自定义页面仅在需要矩阵主题阶、主指标数字或等宽眉标时消费页面级 Token。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉表达。矩阵主图、微柱摘要、细柱对照、分层工具和连续表格均须经过内容契约，不得把所有页面强制改造成同一结构。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面，并说明中性槽位、跨度、高度、移动端顺序与采用的视觉 DNA。页面无需使用全部组件母体，但采用对应信息类型时必须遵守构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；缺少素材时使用结构化数据或中性占位，不编造人物、对象、指标、状态或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护浅中性画布、白色细描边表面、紧凑间距、低阴影、等宽数据眉标和单主题强数据标记。
- 所有非文字纯黑角色必须消费 `--color-brand1-6`；默认主色可为 `#111111`，换色后主按钮、矩阵格、柱线、点、图例、选中与范围指针必须同步替换。
- 摘要真实包含微序列时，必须保护右侧微柱与底部脚注；密度数据存在时，矩阵必须保护固定方格、主题四阶、焦点指针与白色 tooltip。
- 对照数据存在时，细柱面板必须保护灰基准与主题前景；明细存在时保护连续容器、等宽数字、状态图标+文字与弱尾部操作。
- 同类面板等高、图表固定高度、长内容内部处理、父级 gap 统一；完整实现状态、响应式、键盘访问与 reduced motion。

### 禁止项

- 禁止复制模板来源中的业务内容，或让本文件覆盖 PRD 的内容决策。
- 禁止将默认纯黑写死在任何非文字组件；禁止换主题色后残留黑色矩阵、柱线、图例、按钮或选中态。
- 禁止把主题色铺满画布或普通卡片；禁止把默认色相写入主题身份。
- 禁止把四列摘要、2:1 主辅分栏、工具栏操作或模块顺序写成全页面硬规则。
- 禁止用普通面积图替代矩阵密度场，用粗柱替代细柱对照，或用每行独立卡替代连续表格。
- 禁止虚构比较期、矩阵格、对照序列、导出、智能建议、状态或行操作。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。

### 错误与正确

- 错误：在图表和按钮中硬编码 `#000`；正确：所有非文字强标记统一消费 `--color-brand1-6`。
- 错误：摘要只放大数字；正确：有真实微序列时使用眉标、主值、微柱和底部比较脚注。
- 错误：把离散密度改成连续面积；正确：保留固定格、主题四阶、中性对照、指针与 tooltip。
- 错误：双层细柱用两种高饱和色；正确：中性灰表达基准，主题色表达实际。
- 错误：所有页面固定 2:1 分栏；正确：主要矩阵与独立对照同时存在时使用，否则遵循 PRD 页面模式。
- 错误：主题色铺满卡片；正确：主题色只连接数据与交互焦点，中性表面占主导。
- 错误：卡片随内容形成瀑布流；正确：同类面板等高，长内容内部滚动或截断。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}`；无品牌色时写入 `#111111`，并生成七个实际 Brand Token 与四阶矩阵色。所有页面先继承全应用 Token，再按内容契约选择微柱摘要、矩阵密度、细柱对照、分层工具或连续表格。文字黑与主题黑必须分离：文字消费 `text1-*`，所有非文字强标记消费主题色。主题色替换只改变色相，不改变矩阵、细柱、边界、密度、圆角和交互机制。页面级 Token 已完成全局语义复用扫描，禁止重声明网格、tooltip、对照灰或空闲格的同义 Token。

### 交付自检

- [ ] 全部内容和模块是否来自 PRD，而非模板来源？
- [ ] 所有非文字纯黑角色是否消费 `--color-brand1-6`，换色后是否无残留固定黑色？
- [ ] 微柱摘要是否仅在真实微序列存在时显示，并保护眉标、主值、微柱与脚注？
- [ ] 矩阵密度场是否保护固定方格、主题四阶、中性对照、焦点指针与 tooltip？
- [ ] 细柱对照是否只使用真实基准，并保护中性背景与主题前景？
- [ ] 连续表格是否保护连续容器、等宽数字、状态图标+文字和弱尾部操作？
- [ ] 每个组件或布局记忆点是否都有 `content_contract`、`render_policy`、迁移目标和回退策略？
- [ ] 四列摘要、2:1 分栏和模块顺序是否未被写成全页面硬规则？
- [ ] 未触发组件是否没有强行渲染，迁移是否没有新增业务内容？
- [ ] 主题四阶是否全部从 `--color-brand1-6` 派生，平台状态色是否未在页面层重复声明？
- [ ] `custom-page` 是否没有与全局层同值同义或角色重叠的 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] 主题身份、DNA、组件标题和总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的中高密度、克制留白、小圆角、低阴影和单主题焦点是否与正文及 Token 一致？
- [ ] 所有 `neutral-gray` 是否满足 `R = G = B`，矩阵主题阶是否声明种子、基底、比例和实例化要求？
- [ ] 所有真实页面是否共享全应用 Token，视觉记忆点是否按内容契约条件式落地？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开真实页面？
- [ ] 同类面板是否等高，图表是否固定高度，长内容是否内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 与四阶矩阵实际色值？
