---
name: "{{PROJECT_NAME}}"
description: 以低饱和环境光晕画布、乳白半透大圆角表面、柔线微趋势和深色胶囊主操作构成宽松、轻盈而连续的层次主题。
themeId: ambient-halo-layered
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
      "--color-line1-2": "#DCDCDC"
      "--color-fill1-1": "#F8F8F8"
      "--color-fill1-2": "#F2F2F2"
      "--color-fill1-3": "#E7E7E7"
      "--color-fill1-10": "rgba(255, 255, 255, 0.96)"
      "--color-text1-4": "#171717"
      "--color-text1-10": "#5D5D5D"
      "--color-text1-3": "#8F8F8F"
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
      "--corner-1": 6px
      "--corner-2": 10px
      "--corner-3": 14px
      "--corner-4": 20px
      "--corner-5": 28px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#F7F7F7"
      "--oyd-halo-primary": "color-mix(in srgb, var(--color-brand1-6) 10%, transparent)"
      "--oyd-halo-secondary": "color-mix(in srgb, var(--color-brand1-6) 5%, transparent)"
      "--oyd-milk-surface": "rgba(255, 255, 255, 0.78)"
      "--oyd-milk-surface-strong": "rgba(255, 255, 255, 0.92)"
      "--oyd-deep-action": "color-mix(in srgb, var(--color-brand1-6) 12%, #111111)"
      "--oyd-soft-shadow": "rgba(0, 0, 0, 0.055)"
    typography:
      metric-primary:
        "--font-size-metric-primary": 30px
        "--font-weight-metric-primary": 500
        "--font-lineheight-metric-primary": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题在近白无彩画布上叠加两层由主题色派生的低透明环境光晕，以乳白半透表面、超大圆角和柔和阴影形成轻盈层级。顶部页面身份与深色胶囊主操作左右分置；摘要区使用四联等高卡、左上圆形线性图标、右上柔线微趋势、底部主值与状态胶囊。主体以一个连续大圆角壳体容纳标题统计、宽搜索、筛选控件、表头和数据行，头像身份单元、浅色状态胶囊与圆形尾部操作共同维持扫描节奏。主题色只影响环境光晕、焦点与选中；成功、警告、错误等状态保持平台语义。

### 风格定位与应用说明

- 核心气质是“环境光晕、乳白表面、柔线数据、深色主操作、连续明细壳体”；并列摘要、可检索记录与明确状态最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留低透明环境光、乳白表面、大圆角、圆形线性图标、细微趋势、深色主操作和连续行结构，不照搬固定字段、人物、指标数量或导出能力。
- 内容不匹配时，把指标卡语言迁移到已有摘要，把连续明细壳体迁移到真实列表或表格；无趋势或明细时保留为 `recipe_only`，新增能力时使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 主题派生环境光晕 | 近白画布具有低饱和、低透明、边界模糊的大片光晕，色层位于内容下方且不影响阅读。`observed` | 保留 2-3 个大尺度 radial-gradient 光层，全部由 `--color-brand1-6` 派生，透明度 5%-10%；位置可随布局调整。 | 退化为纯白默认页，或变成高饱和渐变背景抢夺内容焦点。 |
| 乳白微趋势指标卡 | 四联等高半透白卡，左上圆形图标、右上细线微趋势，下方为标题、主值和浅状态胶囊。`observed` | 保留“图标与微趋势 / 标题 / 主值与状态”三层结构、统一高度和模糊背景；真实数量与数据由 PRD 决定。 | 变成实色数字卡或普通统计框，柔和层次与信息节奏消失。 |
| 深色胶囊主操作 | 页面级唯一主操作使用近黑主题派生表面、白色线性图标和文字，轮廓为完整胶囊。`observed` | 每个页面级操作区最多一个深色主操作，背景消费 `--oyd-deep-action`；能力、文案和图标由 PRD 决定。 | 多个黑色胶囊竞争，或改成大面积主题色按钮破坏克制关系。 |
| 连续大圆角明细壳体 | 标题与数量、宽搜索、两个筛选器、表头和数据行共享一个大圆角乳白容器；行间仅有极弱分隔。`observed` | 保留统一外壳、工具区与表格连续衔接、44-52px 表头和稳定行高；字段与筛选由 PRD 决定。 | 工具栏、表头与每行拆成独立卡，扫描连续性被破坏。 |
| 头像身份与轻状态行 | 首列由小头像和主文本组成，状态使用浅胶囊，尾部为白色圆形省略操作；数值与时间按列对齐。`observed` | 仅在真实身份素材、状态和行操作存在时使用；无头像时回退为首字母或中性图标。 | 使用大头像、整行状态色或裸露操作文字，密度和轻盈感下降。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 主题派生环境光晕 | `content_contract`: 页面允许装饰性背景层且不影响阅读、性能与品牌约束。 | `render_policy: adapt_existing_slot`；`direct_trigger`: `{{PROJECT_CONSTRAINTS}}` 允许低透明背景光层。 | `transferable_mechanism`: 大尺度模糊光晕、主题同色双层透明度；`adaptation_targets`: 页面底层画布、聚焦区背景。 | `fallback`: 受限时使用纯 `--oyd-page-background`；`forbidden`: 不得引入额外业务信息或高饱和多色背景。 |
| 乳白微趋势指标组 | `content_contract`: 至少两个同层摘要，每项具有主值与可选真实微趋势或状态。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供 `primary_metrics` 和真实短序列。 | `transferable_mechanism`: 半透明白卡、圆形图标、右上微线、底部主值与胶囊；`adaptation_targets`: `primary_metrics`、`primary_summary`。 | `fallback`: 无短序列时移除微线；`forbidden`: 不得编造趋势、变化率、人数、次数或比较周期。 |
| 深色胶囊主操作 | `content_contract`: 页面有一个明确且合法的最高优先级操作。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 定义单一 `global_actions.primary`。 | `transferable_mechanism`: 深色胶囊、白色线性图标与文字、右上对齐；`adaptation_targets`: 页面主操作、提交或创建操作。 | `fallback`: 无主操作时不保留空按钮；`forbidden`: 不得新增导出、创建、邀请或批量操作。 |
| 连续明细壳体 | `content_contract`: 存在结构化记录，以及可选的搜索、筛选、统计或行操作。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供 `detail_table` 或结构化 `detail_list`。 | `transferable_mechanism`: 大圆角单壳体、标题工具区、连续表头与行；`adaptation_targets`: `detail_table`、`detail_list`、记录队列。 | `fallback`: 无明细时不渲染壳体；`forbidden`: 不得新增搜索、筛选、字段、状态或行操作。 |
| 头像身份与轻状态行 | `content_contract`: 记录具有真实身份对象、可用头像或回退标记，以及真实状态。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供身份与状态字段。 | `transferable_mechanism`: 28-32px 头像、主文本、浅状态胶囊和圆形尾部操作；`adaptation_targets`: 表格身份列、对象列表。 | `fallback`: 无头像时首字母或中性图标，无状态时移除胶囊；`forbidden`: 不得编造头像、姓名、联系方式、状态或操作。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、24px 以内标题、4px 基础间距、6-28px 圆角阶梯和中等偏宽松的内距。`tokens.custom-page` 仅补充近白画布、主题派生双层光晕、乳白半透表面、主题混合深色主操作、柔和阴影与全局层缺失的指标数字语义。普通边界、浅填充、tooltip 和状态色复用全局或平台 Token，不重复声明同义变量。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 近白画布、乳白表面和无彩文字构成主体；主题同色光晕位于底层，深色派生只用于唯一主操作，平台状态色只在小胶囊和反馈中出现。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；关键焦点、选中、链接与环境光种子 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔、表格行线和微图辅助线 | `--color-line1-1` | 应用全局 |
| 输入、按钮和必要容器边界 | `--color-line1-2` | 应用全局 |
| 页面底层近白画布 | `--oyd-page-background` | 自定义页 |
| 常规实色面板、弹窗和表单容器 | `--color-white` | 应用全局 |
| 主题同色主环境光层 | `--oyd-halo-primary` | 自定义页 |
| 主题同色次环境光层 | `--oyd-halo-secondary` | 自定义页 |
| 指标卡与主明细壳体的乳白半透表面 | `--oyd-milk-surface` | 自定义页 |
| 搜索、筛选、表头与浮层的强化乳白表面 | `--oyd-milk-surface-strong` | 自定义页 |
| 页面唯一深色主操作 | `--oyd-deep-action` | 自定义页 |
| 乳白卡片的柔和阴影 | `--oyd-soft-shadow` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底和嵌套浅层 | `--color-fill1-2` | 应用全局 |
| 更重中性填充和禁用轨道 | `--color-fill1-3` | 应用全局 |
| 标题、主值、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、时间、次级字段和弱操作 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子。其他六个 Brand Token、双层环境光和 `--oyd-deep-action` 均由它派生，并在项目实例化时写入实际色值。换主题色只改变光晕与焦点色相，不改变半透明度、圆角、连续表格结构和深浅关系。页面 85% 以上保持近白与乳白，主题光层只作底层气氛，不能降低文字对比。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3` 与 `--oyd-page-background` 均为 `neutral-gray`，Hex 满足 `R = G = B`；`--color-fill1-10`、`--oyd-milk-surface / --oyd-milk-surface-strong` 与 `--oyd-soft-shadow` 的前三通道相等。
- `--oyd-halo-primary` 与 `--oyd-halo-secondary` 是主题派生透明色，分别由 `--color-brand1-6` 10% / 5% 与透明基底混合；实例化时写入实际色值。
- `--oyd-deep-action` 是主题派生深色，由 `--color-brand1-6` 12% 与 `#111111` 88% 混合，不声明为灰色；必须保证白字对比度至少 4.5:1。
- 成功、警告、错误和信息状态直接消费平台语义色，并配合文字或图标；`custom-page` 不重复声明同义状态 Token。
- 状态色只用于胶囊文字、图标和浅底，环境光与状态色不得混用；禁止使用多个固定色相装饰画布。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；正文与身份主文本消费 `body-1`；表格消费 `table`；辅助信息消费 `caption`。
- `subhead` 为 24px / 600 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 30px / 500 / 1.2，仅用于摘要主值；它是全局层缺失的独立数字语义，不替代页面标题。
- 数值启用 `font-variant-numeric: tabular-nums`；页面说明最多两行，表格主文本和联系方式单行省略并提供完整值，状态文案保持单行。
- 图标使用 1.5px 线性描边、圆端点；摘要圆形图标 18-20px，按钮图标 18px，头像 28-32px，均与首行文字视觉居中。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：图标与文字用 `--s-2`，状态与主值用 `--s-3`，控件组用 `--s-4`，卡片内距用 `--s-6`，大区块用 `--s-6 / --s-8`。
- 全页面最大宽度 1760px，桌面安全边距 24-32px；父级使用 `gap`，同类卡片拉伸对齐，子项设置 `min-width: 0`。
- 页面身份与唯一主操作两端对齐；摘要组按真实数量自适应等宽列；明细壳体工具区只包含 PRD 已定义的标题统计、搜索和筛选。
- 模块是否出现及顺序由 PRD 与页面模式决定；无明细时不渲染空壳体，无主操作时页面身份区自然占满。

### 布局稳定性硬规则

- 桌面端主网格使用 `align-items: stretch`；禁止瀑布流与 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题与工具区固定，数据区 `flex: 1; min-height: 0`。
- `metric_card` 高 220-248px；连续明细 `detail_panel` 高 620-820px；表格可视区高 480-660px；无图表时 `chart_panel` 不渲染；可选 `quick_action_item` 高 68-84px。
- 表头 48-52px，数据行 64-72px；长内容截断，表格在壳体内部滚动并固定表头，不撑破外层。
- ≥1360px：摘要按真实数量最多 4 列，工具区使用“标题摘要 / 弹性搜索 / 1-3 个筛选”单行；900-1359px：摘要 2 列，工具区分两行且标题独占首段；<900px：摘要单列，主操作移到身份下方，搜索独占一行，筛选横向滚动或折叠到真实更多操作，表格允许水平滚动或切换为 PRD 已定义的列表模式。
- 内容契约不成立时，各断点按 PRD 的单列、列表、表单、详情或流程结构组织，不生成空指标、空搜索、空筛选或空表格。

## 表面与层级

- 页面背景由 `--oyd-page-background` 与两个 radial-gradient 光层组成；光晕模糊半径建议为视口短边的 22%-36%，不得形成可见硬边。
- 指标卡和明细壳体使用 `--oyd-milk-surface`、1px `rgba(255,255,255,0.62)` 与 `0 12px 34px --oyd-soft-shadow`；在支持环境可使用 `backdrop-filter: blur(18px)`，不支持时回退为 `--oyd-milk-surface-strong`。
- 搜索、筛选、表头和圆形行操作使用 `--oyd-milk-surface-strong`；tooltip、popover 复用 `--color-fill1-10`、`--corner-3` 和 `0 10px 28px rgba(0,0,0,0.10)`。
- 嵌套层只用乳白强度、轻边界或留白区分，不重复叠加重阴影；禁止霓虹辉光、厚描边和高对比多色渐变。

## 圆角与形状

- `--corner-1` 6px 用于短状态与小提示；`--corner-2` 10px 用于输入、次按钮和 tooltip；`--corner-3` 14px 用于筛选、搜索与小容器；`--corner-4` 20px 用于指标卡；`--corner-5` 28px 用于连续明细大壳体。
- `--corner-semicircle` 用于页面主操作、状态胶囊和紧凑标签；`--corner-circle` 用于摘要图标底、头像与行尾操作。
- 同层表面统一圆角；状态胶囊只包裹短文本，不拉伸为整列色块。

## 组件

### 按钮与操作

按钮只使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮使用同档正方形。页面级主操作使用 40px 胶囊、`--oyd-deep-action` 与白字，且同一区域最多一个；次操作使用乳白强表面与必要细边。hover、active 使用 `--color-brand1-1 / --color-brand1-9` 或深色表面明度变化，focus 为 2px 主题色外环加 2px offset；disabled 同时降低文字与表面对比。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。宽搜索使用 40px 高、`--corner-3` 和 `--oyd-milk-surface-strong`；筛选器同高并使用 `--corner-semicircle` 或 `--corner-3`。placeholder 消费 `--color-text1-10`，focus 使用主题色边界与浅光晕，error 使用平台错误色并附文字。

### 卡片与面板

指标卡使用 `--corner-4`、`--s-6` 内距和固定高度；连续明细壳体使用 `--corner-5`、外层统一乳白表面，内部工具区与数据区通过留白和弱分隔过渡。禁止把每行、每个筛选器或表头再包成独立阴影卡。

### 乳白微趋势指标

固定公式为“左上圆形线性图标 / 右上 80-120px 柔线微趋势 / 下部标题 / 主值与浅状态胶囊”。微趋势线宽 1.5px、端点 8-10px 空心圆、无坐标轴和重网格；线与端点焦点消费主题色派生 35%-55% 明度。无真实短序列时删除趋势线，不绘制装饰波形。

### 深色胶囊主操作

固定使用 40px 高、水平内距 18-22px、`--corner-semicircle`、18px 线性图标和 14px 按钮文字；背景消费 `--oyd-deep-action`。hover 轻微提亮，active 轻微压暗，禁止使用阴影光晕或同时出现多个同级深色胶囊。

### 连续明细壳体

外壳依次容纳标题统计、弹性搜索、真实筛选、表头和连续行；工具区内距 `--s-6`，表头与行使用 1px `--color-line1-1` 分隔。搜索优先占据剩余宽度，筛选保持 180-260px 合理宽度。壳体内部滚动并固定表头，不能拆成多个相邻卡片。

### 头像身份与轻状态行

身份单元使用 28-32px 圆形头像、`--s-2 / --s-3` 间距和单行主文本；无头像时使用首字母或中性图标。状态胶囊高 24-28px，使用平台状态浅底、图标或文字；行尾操作为 28px 圆形图标按钮。不得伪造头像、联系方式或状态，不能只用颜色表达状态。

### 图表或主内容面板

本主题不强制独立大图表；若 PRD 有图表，使用乳白表面、固定 320-420px 高度、1px 弱网格、主题同色主序列和轻 tooltip。微趋势不替代完整图表的轴、图例与可访问描述，也不得为视觉完整性编造数据。

### 表格与列表

表头 48-52px，数据行 64-72px；首列可使用头像身份单元，数字右对齐并启用等宽特性，时间与次级字段使用 `--color-text1-3`。状态用浅胶囊，尾部操作用 28px 圆形图标按钮。长文本单行省略并提供完整值；表格内部滚动、表头粘附。

### 快捷入口（可见或推断）

视觉材料未形成独立快捷入口区，置信度为 `inferred`，默认 `render_policy: recipe_only`。若 PRD 明确要求，使用 68-84px 乳白条目、圆形线性图标与两级文字；禁止默认彩色宫格，也不得塞入连续明细壳体的表头。

### 状态与交互

- 悬停：卡片边界略提亮、阴影增至 `0 16px 38px rgba(0,0,0,0.07)`；表格行使用 `--color-fill1-1`，不发生位移。
- 按下：按钮消费激活色或深色表面压暗；可点击行使用 1px 内缩反馈，不改变布局尺寸。
- 聚焦：控件和行操作显示 2px 主题色 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持指标卡、工具区、表头和行高固定，以乳白中性骨架避免布局跳动。
- 空态与错误：保留明细壳体和工具区结构，提供简短说明与真实下一步操作，不把整个容器染成状态色。
- 禁用与选中：禁用同时降低文字、图标与边界对比；选中使用主题细边、浅主题底与文字，不只依赖颜色。
- 动效：hover 120-160ms，浮层 160-200ms，数据更新 220-300ms，均使用 ease-out；`prefers-reduced-motion` 下关闭光层位移、路径绘制与缩放。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题是否可用。原生页面和自定义页面共同继承无彩灰阶、圆角、排版、间距和控件状态；在项目允许时，自定义页面补充主题派生环境光、乳白半透表面、微趋势与连续明细壳体。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容、信息架构与模块。本主题只规定视觉表达；没有并列摘要、短序列或结构化记录时，页面保持 PRD 的表单、详情、流程、列表或数据结构，只迁移环境光、乳白表面、大圆角与深浅层级。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面；每页说明 `page_identity`、`global_actions`、`primary_metrics`、`primary_content_panel`、`detail_table/detail_list` 的位置、跨度、高度、移动端顺序与采用的视觉 DNA。页面无需使用全部母体，但采用微趋势或连续明细壳体时必须遵守本文公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 头像、图标、图表与缩略素材必须有真实授权来源；没有头像时使用首字母或中性图标，不编造人物、联系方式、状态、指标或图片地址。

## 设计规范与禁忌

### 必须做到

- 所有页面必须保留近白画布、主题派生低透明光晕、乳白层次、大圆角和克制阴影；光层不得降低文字与控件对比。
- 指标契约成立时必须保护圆形图标、右上柔线、标题、主值与浅胶囊层级；无真实短序列时必须删除微趋势。
- 主操作契约成立时只保留一个深色胶囊；明细契约成立时必须保护工具区、表头和数据行共用一个连续大圆角壳体。
- 身份与状态契约成立时使用真实头像或合规回退、浅状态胶囊和圆形尾部操作，并提供非颜色状态线索。
- 同类卡片等高、图表和表格固定高度、父级 gap、内部滚动、三档响应式、键盘访问和完整状态必须落地。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景、普通卡片或大面积面板；禁止把环境光改成高饱和多色渐变。
- 禁止把固定四卡、完整搜索筛选组合、固定字段或模块顺序写成所有页面无条件执行的结构。
- 禁止绘制装饰微趋势、编造人物头像或联系方式、无依据新增导出、搜索、筛选与行操作。
- 禁止把工具栏、表头和每行拆成独立阴影卡；禁止多个同级深色胶囊同时出现。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止厚描边、霓虹辉光、过强玻璃模糊、无依据装饰和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：把光晕做成可见色块或高饱和渐变；正确：使用主题同色 5%-10% 低透明 radial-gradient，边界不可见。
- 错误：摘要卡只有数字或装饰波形；正确：圆形图标、真实微趋势、标题、主值与浅状态胶囊形成稳定层级。
- 错误：每行独立成卡、工具区悬浮在外；正确：标题工具、表头与连续数据行共用一个大圆角乳白壳体。
- 错误：页面出现多个深色主按钮；正确：一个深色胶囊承担最高优先级，其余操作使用乳白次级样式。
- 错误：所有页面强制使用四联指标与明细表；正确：内容契约成立时使用本体，否则保留 PRD 页面模式并迁移环境光、表面、排版和间距。
- 错误：状态只靠胶囊颜色；正确：颜色同时配合文字、图标或明确语义。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token、环境光与深色主操作。所有真实页面先继承近白画布、乳白表面、大圆角、轻阴影和基础控件语言，再按内容契约选择微趋势指标、深色胶囊主操作、连续明细壳体与头像状态行。不得为复刻代表性构图新增指标、人物、联系方式、趋势、筛选或导出；主题色只替换光晕与焦点色相，不改变透明材质、深浅层级、连续结构和布局稳定机制。

### 交付自检

- [ ] 全部页面内容和模块是否来自 PRD，而非模板来源？
- [ ] 环境光是否全部由 `--color-brand1-6` 派生，透明度受控且未影响可读性？
- [ ] 乳白表面是否有清晰回退方案，未依赖过强玻璃模糊？
- [ ] 指标组是否等高并保留圆形图标、真实微趋势、标题、主值与浅胶囊？
- [ ] 页面级主操作是否最多一个，并使用主题派生深色胶囊？
- [ ] 工具区、表头和数据行是否共用连续大圆角壳体，而非拆成卡片碎片？
- [ ] 头像、联系方式、状态和行操作是否来自真实数据，缺失时是否正确降级？
- [ ] 每个视觉记忆组件是否都有 `content_contract`、`render_policy`、迁移目标和无匹配回退策略？
- [ ] 固定指标数量、工具组合、字段和模块顺序是否具有内容契约，而非全页面硬规则？
- [ ] 未被 PRD 触发的组件是否没有强行渲染，视觉迁移是否没有新增业务内容？
- [ ] 主焦点、选中与环境光是否共享 `--color-brand1-6`，平台状态色是否保持独立语义？
- [ ] `application-global` 的变量名和消费语义是否稳定，具体值是否依据本主题生成？
- [ ] `custom-page` 是否逐项通过全局语义复用检查，没有同值同义或角色重叠的重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、视觉 DNA、组件标题和正文总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的宽松、轻盈、半透明、大圆角和连续层次是否与 Token 及正文一致？
- [ ] 是否没有建立适用/不适用产品形态清单，所有页面是否共享全应用 Token 和基础组件语言？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在的页面，没有枚举不存在的页面？
- [ ] 主题同色演变是否由 `--color-brand1-6` 派生，平台状态语义色是否未在 `custom-page` 重复声明？
- [ ] 所有灰色 Token 是否已分类；`neutral-gray` 是否满足三通道相等，主题派生色是否声明基底、比例和实例化要求？
- [ ] 同类面板是否等高，表格是否固定高度，长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引发布局跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 的实际色值？
