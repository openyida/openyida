---
name: "{{PROJECT_NAME}}"
description: 以柔和主题灰画布、大圆角白色浮岛、小面积高对比焦点和精密嵌套模块构成清爽而醒目的模块化界面主题。
themeId: high-contrast-modular
tokens:
  application-global: # 全应用 Token，原生页面和自定义页面共同使用
    colors:
      "--color-white": "#FFFFFF" # 全应用基础表面色
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值>" # 悬停色
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值>" # 品牌浅色，保留平台既有消费关系
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值>" # 浅色导航框架背景色
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值>" # 深色导航框架背景色
      "--color-brand1-6": "{{PRIMARY_COLOR}}" # 前置确定的全应用主题主色
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值>" # 激活、按下状态色
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值>" # 禁用状态色
      "--color-line1-1": "#E8E8E8" # neutral-gray；弱边界、辅助线和表格行分隔线
      "--color-line1-2": "#DEDEDE" # neutral-gray；控件和容器常规边界
      "--color-fill1-1": "#F4F4F4" # neutral-gray；菜单悬停和弱状态填充
      "--color-fill1-2": "#ECECEC" # neutral-gray；点击或中性选中填充
      "--color-fill1-3": "#E3E3E3" # neutral-gray；更重的中性填充
      "--color-fill1-10": "rgba(22, 22, 22, 0.92)" # neutral-gray；气泡浮层背景色
      "--color-text1-4": "#171717" # neutral-gray；默认一级文字色
      "--color-text1-10": "#858585" # neutral-gray；表头和 placeholder
      "--color-text1-3": "#666666" # neutral-gray；二级文字色
    typography:
      base:
        "--font-family-base": "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 600
        "--font-lineheight-subhead": 1.2
      body-2:
        "--font-size-body-2": 16px
        "--font-weight-body-2": 500
        "--font-lineheight-body-2": 1.4
      body-1:
        "--font-size-body-1": 14px
        "--font-weight-body-1": 400
        "--font-lineheight-body-1": 1.5
      table:
        "--font-size-table": 13px
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
  custom-page: # 页面专属 Token，仅在指定自定义页生效
    colors:
      "--oyd-page-background": "<theme-gray：由 --color-brand1-6 3% + #F5F5F5 97% 混合生成的实际色值>"
      "--oyd-surface-soft": "<theme-gray：由 --color-brand1-6 5% + #F1F1F1 95% 混合生成的实际色值>"
      "--oyd-accent-deep": "<由 --color-brand1-6 与 --oyd-chart-dark 混合生成的低明度实际色值>"
      "--oyd-chart-dark": "#202020" # neutral-gray；固定中性深色图表基段
      "--oyd-chart-grid": "#DADADA" # neutral-gray；固定中性图表网格
      "--oyd-card-dark": "#1A1A1A" # neutral-gray；固定中性深色对象表面
      "--oyd-positive": "#35B978"
      "--oyd-negative": "#EF6B70"
      "--oyd-warning": "#EFCB31"
    typography: # 仅补充全局字体体系没有的指标数字语义
      metric-primary:
        "--font-size-metric-primary": 32px
        "--font-weight-metric-primary": 600
        "--font-lineheight-metric-primary": 1.1
      metric-secondary:
        "--font-size-metric-secondary": 28px
        "--font-weight-metric-secondary": 500
        "--font-lineheight-metric-secondary": 1.15
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以低彩度主题灰画布承托大圆角白色浮岛，用醒目的页面标题和高对比数字建立直接、友好的阅读入口；首屏采用宽窄不等的模块拼图，白色主面板内部再嵌套主题灰工具区与小型信息单元。单一高对比主题色只出现在主操作、关键摘要和数据焦点，并通过同色相深色渐变形成强记忆点；近黑数据块负责稳定视觉重心。主题灰嵌套容器、双色胶囊柱、贴身趋势标签和图标化明细行是主题层需要保护的精致度锚点，但单个页面只按 PRD 内容契约选择兼容的记忆组件。整体留白充足，但所有面板遵循确定高度、对齐边缘和内部溢出规则，不形成松散瀑布流。

### 适用范围

- 适用于综合工作台、任务与状态总览、经营概览、资源中心、个人中心和包含明细列表的管理首页。
- 可用于前后台一体产品中的概览与控制区域；普通表单、流程详情和内容页只继承 Token、圆角、控件与状态语言，不照搬整套面板拼图。
- 不适用于长篇阅读、极高密度专业终端、沉浸式深色监控、强叙事营销首屏或大面积图像驱动页面。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 低彩度主题灰画布上的大圆角白色浮岛 | 页面使用极浅主题灰底，主要内容由独立白色大圆角面板承载；阴影极弱，边界主要靠明度差形成。`observed` | 画布消费 `--oyd-page-background`：由 `--color-brand1-6` 3% 与 `#F5F5F5` 97% 混合；一级面板消费 `--color-white` 与 `--corner-5`。边框使用固定 `neutral-gray` 的 `--color-line1-1`，阴影不超过 `0 12px 36px rgba(20, 20, 20, 0.04)`。 | 会退化为纯白页面上的普通后台卡片，失去柔和浮岛层次和主题关联。 |
| 高对比主题焦点到深同色相的摘要舞台 | 一个核心摘要块使用主题色上沿、深同色相下沿和白色内容，周围模块保持中性。`observed` | `accent_summary` 使用由 `--color-brand1-6` 派生的主题色与深色同色相渐变，文字为白色，趋势标签使用低透明白色胶囊；换肤时重新派生两端色值，但保留渐变方向、对比关系和唯一焦点地位。 | 若改成普通白卡或多个彩色卡，主题会失去最强识别点并出现注意力竞争。 |
| 主题灰容器内的模块嵌套 | 大面板内部包含主题灰圆角工具条、分组区和多个白色小单元，形成“白色外壳—主题灰内层—白色内容”的三层结构。`observed` | `nested_cluster` 使用由主题色 5% 与 `#F1F1F1` 95% 派生的 `--oyd-surface-soft`、`--corner-4` 和 16-24px 内边距；内部单元使用白色、`--corner-3`、无明显阴影。内容数量可由 PRD 改变，但三层色调关系与统一间距不可改变。 | 页面会变成一组平铺卡片，缺少组件之间的归属关系和精密模块感。 |
| 双色胶囊柱与斜纹高亮 | 图表以深色下段和主题色上段组成圆角堆叠柱，高亮部分带轻斜纹；网格和坐标轴极淡。`observed` | `split_capsule_chart` 使用固定高度堆叠柱、8-12px 圆角、深色基段与主题色顶段；顶段使用低对比同色斜纹，序列顺序和数据由 PRD 决定。主题色替换后斜纹仍使用同色系。 | 会退化成常规多色柱图，失去深色重心与主题斜纹构成的鲜明节奏。 |
| 图标化高密度明细面板 | 大型明细面板带独立搜索与筛选工具，表头置于固定 `neutral-gray` 圆角带中，行内使用小型图标、状态点、复选框和尾部操作。`observed` | `detail_table` 固定标题工具带、48-56px 表头和 56-64px 行高；图标容器 28-32px，数值列稳定对齐，状态同时使用点和文字。字段与数据可替换，但行结构和柔和表头必须保留。 | 会变成组件库默认表格，精致度、扫描速度和页面整体一致性都会下降。 |

### 视觉记忆点应用策略

| 视觉记忆组件 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 主题渐变摘要卡 | `content_contract`：PRD 存在一个明确的首要摘要、优先结果、关键状态或高优先任务，且能以短标题、核心内容和辅助说明表达。 | `render_policy: adapt_existing_slot`；`direct_trigger`：存在 `primary_summary`、`priority_status` 或同义首要槽位。 | `transferable_mechanism`：唯一亮到深同色相渐变、白色内容栈和半透明辅助标签；`adaptation_targets`：PRD 已有的首要摘要、状态概览或高优先任务面板。 | `fallback: recipe_only`；没有首要内容时不生成渐变摘要卡。`forbidden`：编造指标、金额、百分比或趋势。 |
| 主题灰嵌套摘要组 | `content_contract`：PRD 存在两个以上具有明确归属关系的条目、动作或对象。 | `render_policy: adapt_existing_slot`；`direct_trigger`：存在分组列表、相关对象、操作组或二级摘要。 | `transferable_mechanism`：白色外壳—主题灰分组—白色单元的三层表面；`adaptation_targets`：`related_items`、`secondary_actions`、`supporting_list`。 | `fallback: recipe_only`；没有真实分组关系时不创建空分组。`forbidden`：编造条目、快捷操作或对象。 |
| 双色斜纹胶囊柱图 | `content_contract`：PRD 提供可比较的定量序列，且存在基段/增量、组成或上下段语义。 | `render_policy: prd_match_only`；`direct_trigger`：存在合法堆叠比较数据。 | `transferable_mechanism`：深色基段、主题色斜纹顶段和胶囊圆角；`adaptation_targets`：语义一致的堆叠柱，或已有比例数据对应的 `progress_track`。 | `fallback: recipe_only`；无定量数据时完全不渲染。`forbidden`：伪造图表、时间序列、分类或数值。 |
| 深色对象预览卡 | `content_contract`：PRD 存在具有身份、状态和元信息的真实对象或媒体预览。 | `render_policy: prd_match_only`；`direct_trigger`：存在 `object_gallery`、`credential_preview` 或同义对象预览。 | `transferable_mechanism`：深色表面、极弱几何纹理、角落状态胶囊和底部稳定信息区；`adaptation_targets`：PRD 已有对象卡或媒体卡。 | `fallback: recipe_only`；没有对象型内容时不渲染。`forbidden`：编造对象、凭证、品牌标识或素材。 |
| 图标化明细面板 | `content_contract`：PRD 存在重复记录，以及可显示的主字段、状态和可选操作。 | `render_policy: adapt_existing_slot`；`direct_trigger`：存在 `detail_table`、`detail_list` 或记录集合。 | `transferable_mechanism`：独立工具带、固定 `neutral-gray` 圆角表头、图标化行和文字配状态点；`adaptation_targets`：现有表格、列表或任务记录。 | `fallback: recipe_only`；没有重复记录时不创建明细区。`forbidden`：编造字段、记录、筛选条件或行操作。 |

- 每个页面优先选择 1-3 个满足内容契约的主记忆点，不要求五个组件同时出现。
- 只能把视觉机制迁移到 PRD 已有内容；若落地会新增业务能力，应改为 `suggest_only` 并从默认实现中移除。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；视觉要求需要改变已有语义的字体、间距、圆角或颜色时，直接修改这一层的 Token 值，正文与组件不得另写覆盖值。`tokens.custom-page` 只补充全局层没有对应语义的主题灰画布、主题灰嵌套表面、图表纹理、深色对象表面、语义状态色，以及 `metric-primary`、`metric-secondary` 两个指标数字层级；同一语义不得跨层重复定义。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 低彩度主题灰画布、纯白一级面板和主题灰嵌套层必须同时存在，三者共同形成轻柔但清楚的空间关系。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；用于主按钮、关键摘要、链接和选中强调 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、表格行分隔线和辅助线 | `--color-line1-1` | 应用全局 |
| 输入框、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 由主题色 3% 与中性基底 97% 派生的页面主题灰画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 由主题色 5% 与中性基底 95% 派生的工具区、分组区和弱内容底 | `--oyd-surface-soft` | 自定义页 |
| 摘要渐变深端和深色主题对象 | `--oyd-accent-deep` | 自定义页 |
| 双色图表的中性深色基段 | `--oyd-chart-dark` | 自定义页 |
| 图表辅助网格和弱刻度 | `--oyd-chart-grid` | 自定义页 |
| 深色媒体、凭证或对象预览表面 | `--oyd-card-dark` | 自定义页 |
| 正向、负向与进行中状态 | `--oyd-positive` / `--oyd-negative` / `--oyd-warning` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 菜单点击和中性选中底 | `--color-fill1-2` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表格表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 来自前置确定的全应用主题色，先解析为实际色值；AI 再以它为唯一品牌色种子生成其余 Brand Token。最终项目 `design.md` 必须写入七个 Brand Token 及全部主题派生页面 Token 的实际色值，不得保留生成期标记。没有品牌色输入时由上游主题流程提供中性默认主色；实例化时必须重新生成 `--oyd-accent-deep` 的同色相深色值，并保持“小面积高亮 + 深色稳定块 + 大面积中性表面”的消费比例。

### 本主题的配色约束

- 画布和嵌套区使用 `theme-gray`：分别由 `--color-brand1-6` 以 3% 和 5% 混入 `#F5F5F5`、`#F1F1F1` 中性基底；AI 在项目实例化时计算实际色值。一级面板保持纯白，其他固定 `neutral-gray` 必须满足 RGB 三通道相等。
- 主题色只用于唯一主操作、一个核心摘要、图表高亮段、链接和选中状态；不得给每个指标卡分配独立颜色。
- 黑色和深同色相只用于稳定数据重心、深色对象预览与摘要渐变下沿，不能扩展成全页深色主题。
- 正向、负向和进行中沿用独立语义色，并同时使用文字、图标或方向符号，不能只依赖颜色。
- 图表同屏以主题色、深中性色和浅网格为主；斜纹只用于主题色高亮段，不能扩散到面板背景。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 定义的一套无衬线字体。

```text
page-title → tokens.application-global.typography.subhead
page-subtitle → tokens.application-global.typography.body-2
panel-title → tokens.application-global.typography.body-2
content-title → tokens.application-global.typography.body-1
body → tokens.application-global.typography.body-1
table → tokens.application-global.typography.table
caption / trend-label → tokens.application-global.typography.caption
metric-primary → tokens.custom-page.typography.metric-primary
metric-secondary → tokens.custom-page.typography.metric-secondary
```

- 页面主标题直接消费全局 `subhead`：24px/600/1.2，已达到宜搭该 Token 的允许上限；不得在组件内另行放大。
- 页面副标题与一级面板标题消费全局 `body-2`：16px/500/1.4；需要整体调整时直接修改该全局 Token，不能在组件内覆盖。
- 小卡标题、内容标题、正文和常规控件标签消费全局 `body-1`：14px/400/1.5，不在组件内另写字号或字重覆盖。
- 表格正文消费全局 `table`：13px/400/1.45；说明与趋势胶囊消费全局 `caption`：12px/400/1.4。
- 全局体系没有指标数字语义，因此核心摘要数字消费页面级 `metric-primary`：32px/600/1.1，普通指标数字消费 `metric-secondary`：28px/500/1.15。所有数值启用 `font-variant-numeric: tabular-nums`；字号以平台合法范围和层级关系为边界。
- 辅助文案不超过两行，表格长文本单行截断并提供完整内容查看方式。
- 图标采用简洁圆角线性风格，常规 16-20px；表格行图标使用 18-20px，并置于 28-32px 的浅色圆形或圆角方形容器。

## 布局与间距

- 所有间距统一消费文档顶部 YAML 的 `--s-1` 至 `--s-8`；页面外边距使用 24-32px，主网格间距使用 20-24px，一级面板内边距使用 24-32px，嵌套模块内边距使用 16-24px。
- 桌面端使用 12 列网格。首屏摘要区推荐 `4 / 4 / 4` 或 `4 / 4 / 4` 的三组布局，但每组内部结构不同；下方内容区推荐左侧 4 列辅助栈、右侧 8 列明细面板。
- 页面标题与副标题位于独立顶部带，不包入卡片；标题区下方保留 36-48px 空白，再进入主网格。
- 页面结构以 `page_identity → primary_summary / primary_metrics / primary_visualization → supporting_progress / object_gallery / detail_table` 为主，实际模块是否存在由 PRD 决定。

### 布局稳定性硬规则

- 桌面端主网格使用 `align-items: stretch`，同一行一级面板顶部和底部对齐；禁止瀑布流和 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题区固定，内容区使用 `flex: 1; min-height: 0`。
- 建议高度：`balance_summary` 480-520px，`metric_card` 210-240px，`chart_panel` 480-520px，`progress_panel` 160-190px，`object_gallery` 320-360px，`detail_panel` 540-620px，推断的 `quick_action_item` 72-88px。
- 同一指标组使用 2×2 等高网格；图表必须有 300-340px 的确定绘图区；对象预览横向溢出时在面板内部滚动。
- 表格、列表和长文案在面板内部滚动、截断或折叠，不得撑破外层网格；表格工具区固定，不随内容滚出。
- 区块间距由父级 grid/flex 的 `gap` 管理，不使用零散 `margin-top`、`margin-bottom` 拼接页面节奏。
- 1200-1439px 时首屏改为 6+6 两列，第三组换到下一行；768-1199px 时所有一级面板改单列、指标内部保留两列；小于 768px 时指标改单列、页面标题继续消费全局 `subhead: 24px`、工具栏换行、表格内部横向滚动，并解除桌面等高要求。

## 表面与层级

- 一级面板使用纯白表面、`--corner-5`、1px `--color-line1-1` 边界和不超过 `0 12px 36px rgba(20, 20, 20, 0.04)` 的极弱中性阴影。
- 嵌套分组使用 `--oyd-surface-soft`、`--corner-4` 和无阴影；内部小单元回到白色，使用 `--corner-3` 与极弱边界。
- 输入与筛选器使用白色或 `--oyd-surface-soft` 主题灰表面；表头使用 `--color-fill1-1` 固定 `neutral-gray`，均通过 1px 边界区分，不添加明显投影。
- 只有核心摘要允许使用主题色到深同色相的纵向或斜向渐变；普通卡片、图表底、表格行和次按钮禁止渐变。
- 深色对象预览可以使用低对比光斑、微弱同色渐变或几何纹理，但必须保留清晰文字对比，不使用玻璃拟态或霓虹外发光。

## 圆角与形状

- 一级工作台面板使用 `--corner-5`；嵌套分组和大型图表内框使用 `--corner-4`；小卡、表头、输入与提示层使用 `--corner-3`。
- 普通按钮和筛选器优先使用 `--corner-semicircle`；面板内部白色小单元使用 `--corner-2` 或 `--corner-3`。
- 图标按钮、状态点和单选入口使用 `--corner-circle`；图表柱采用 8-12px 圆角，保持上下段胶囊感。
- 同一网格层级使用一致圆角；禁止随机混用直角、小圆角和超大圆角，也不能把大面板做成胶囊。

## 组件

### 按钮与操作

按钮只使用四档离散高度：迷你或表格行内操作 28px、紧凑工具栏按钮 32px、常规按钮 36px、强调或宽松场景按钮 40px；图标按钮也从 28/32/36/40px 中选择正方形尺寸，所有按钮不得超过 40px。本主题首屏并列主次操作使用 40px，常规页面操作默认 36px。主按钮使用 `--color-brand1-6` 实底、一级文字色和胶囊形；按钮内容使用 16-18px 线性图标，标签完整消费全局 `body-1`。次按钮使用 `--oyd-surface-soft` 或白色、一级文字色和弱边界。同一操作组最多一个主按钮。hover 只调整主题色明度或边界，active 轻微缩放至 0.99；focus 使用 2px 同色焦点环并与控件保持 2px 间隔。

### 输入与筛选控件

搜索框和普通输入统一高 40px，紧凑工具栏输入高 32px；搜索框宽度 280-360px，使用白色表面、`--color-line1-2` 边框和 `--corner-3` 或胶囊形，左侧搜索图标 16-18px。筛选按钮与搜索框等高且不得超过 40px，图标置于文字右侧。聚焦时边界消费主题色，错误状态使用独立语义色并附带说明文字。

### 卡片与面板

一级面板由固定标题区和自适应内容区组成，内边距 24-32px；同一行面板必须等高。嵌套卡片只用于摘要拆分、对象预览、图表内框或有明确归属关系的内容组，不把每段文字包成白卡。面板标题与可选说明形成 4-8px 垂直间距，右侧操作不得挤压标题。

### 主题渐变摘要卡（可见记忆点）

`accent_summary` 使用固定四段构图：顶部短标题消费全局 `body-1`，右上为 18-20px 线性图标；中部核心数字消费页面级 `metric-primary`；底部趋势胶囊消费全局 `caption`，并配短说明；背景从主题色亮端过渡到同色相深端。卡片高 210-240px、内边距 24-28px、`--corner-4`。文字统一使用白色及 70%-85% 白色透明度。禁止增加第二张同等强度渐变卡、彩色图标底座或无依据迷你折线。

### 主题灰嵌套摘要组（可见记忆点）

`nested_cluster` 的外层一级面板保持白色；内部操作组使用两枚等宽胶囊按钮，信息组使用 `--oyd-surface-soft` 主题灰背景和 3-4 个白色小单元。小单元固定为“图标或短标识—主信息—辅助说明—状态”的垂直结构，右上允许一个溢出操作。条目数量可由 PRD 调整，但容器必须保持 16-20px gap、统一小卡高度和白—主题灰—白三层关系。

### 双色胶囊柱图（可见记忆点）

`split_capsule_chart` 使用深色下段与主题色上段构成堆叠柱，每根柱宽 34-48px、段间 2-4px、圆角 8-12px。上段覆盖 45° 低对比同色斜纹，斜纹间距 5-7px；下段使用 `--oyd-chart-dark`。网格只保留横向虚线，坐标轴和刻度使用二级文字色，图例使用 8-10px 圆角色块。禁止改成彩虹柱、普通直角堆叠柱、3D 图表或高饱和背景。

### 深色对象预览卡（可见记忆点）

`dark_object_card` 采用横向 1.55-1.7 比例、`--corner-3` 和深色表面；允许极弱几何纹理、同色光斑、角落状态胶囊与品牌/类型标识。底部信息使用稳定三列或主次两段排布，文字为高对比白色和 60%-75% 白色。多项内容在面板内部横向滚动或截断显示，不撑宽外层布局。没有对应 PRD 内容时，不强行生成该组件。

### 进度轨道

`progress_track` 使用 10-14px 高胶囊轨道，未完成段为带极浅斜纹的中性色，完成段使用 `--oyd-accent-deep` 或由主题色派生的可读深色。轨道下方左右对齐当前值和目标值，辅助说明紧贴当前值；数值必须有文字，不仅依靠长度表达。

### 表格与列表

`detail_table` 使用独立标题工具带、`--color-fill1-1` 固定 `neutral-gray` 圆角表头、56-64px 行高和无竖向边框结构。首列选择控件固定 18-20px，第二信息列允许 28-32px 图标容器；数值列使用等宽数字并右对齐或稳定左对齐，整表保持一致。状态由 6-8px 色点与文字共同表达，尾部操作使用三点图标。选中行仅使用 `--color-fill1-1` 轻底色，不能整行使用主题色。

### 快捷入口（推断）

`quick_actions` 的 `confidence: inferred`，`render_policy: prd_match_only`。若 PRD 需要快捷入口，将其作为一级面板内的独立主题灰分组或摘要区后的等高横排条目；桌面端 4-6 项，每项高 72-88px，使用白色或 `--oyd-surface-soft` 主题灰表面、`--corner-3`、18-20px 主题色线性图标和短标签。平板改为 2-3 列，移动端两列或横向滚动。禁止彩色宫格、超大图标墙、营销插画和多种高饱和背景。

### 状态与交互

- 悬停：可交互小卡边界略增强或上移 1px；一级数据面板不整体漂浮。
- 按下：主操作消费 `--color-brand1-9`，入口卡轻微缩放至 0.99，持续 100-140ms。
- 聚焦：显示清楚的 2px focus ring；纯图标按钮必须有可访问名称和 tooltip。
- 加载：保持面板、图表和表格的确定高度，以 `--color-fill1-1` 固定 `neutral-gray` 骨架替代内容，不造成网格跳动。
- 空态与错误：保留原面板结构，提供简短说明和下一步操作；错误不能把整张卡片染红。
- 禁用：降低对比但保持文字可读，同时禁用指针与键盘触发；不能只把透明度降到不可辨认。
- 选中：使用轻中性底、勾选控件或清楚边界表达，主题色只作为小面积辅助。
- 动效：颜色与位移过渡 140-200ms，使用 `ease-out`；`prefers-reduced-motion` 下取消位移与缩放，仅保留即时状态变化。

## 项目应用

### 产品形态与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题应用：{{PRODUCT_TOPOLOGY_APPLICATION}}

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、摘要、对象、图表和明细结构；本主题只规定柔和中性画布、白色浮岛、高对比主题焦点、模块嵌套和数据纹理的视觉表达。普通表单、流程详情或内容页只继承基础 Token 与组件语言，不能被强行改造成拼图式工作台。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

每个工作台类页面应明确 `page_identity`、`primary_summary`、`primary_metrics`、`primary_visualization`、`supporting_progress`、可选 `object_gallery`、可选 `quick_actions` 和 `detail_table` 的位置、跨度、高度与移动端顺序。页面不必同时使用全部组件母体；凡采用对应信息类型，就必须使用本文定义的构图公式。没有量化内容时，不强造数字；没有图表数据时，用同等品质的主内容面板承载 PRD 信息。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图标、图表、对象缩略内容和辅助图形必须有真实来源；没有素材时使用结构化数据或中性占位，不编造客户、商品、指标、品牌或外部资源地址。

## 设计规范与禁忌

### 必须做到

- 保留低彩度主题灰画布、纯白一级面板和主题灰嵌套层的三层表面关系。
- PRD 存在首要摘要时，保留唯一主题渐变摘要卡，并使用亮主题色到深同色相的渐变与白色内容栈；否则仅保留配方。
- PRD 存在真实分组内容时，保留白色外壳、主题灰分组和白色小单元组成的精密嵌套模块语言。
- 数据为堆叠比较形态时，保留深色基段、主题色斜纹顶段和胶囊圆角。
- PRD 存在重复记录时，大型明细区保留标题工具带、固定 `neutral-gray` 圆角表头、图标化行、状态点与稳定行高。
- 保持同类卡片等高、边缘对齐、固定图表高度、面板内部溢出和父级 `gap`。
- 主题色只占小面积，并贯穿主操作、唯一摘要、数据焦点和选中提示。
- 保证 hover、active、focus、loading、empty、error、disabled、selected、移动端和 reduced motion 状态完整。

### 禁止项

- 禁止复制模板来源中的业务字段、示例数据、人物、机构、分类名称或页面专属文案；禁止让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满画布、普通指标卡或大面积面板；禁止把视觉材料中的默认高亮色相误当成不可变视觉 DNA。
- 禁止把唯一渐变摘要扩展成彩色指标卡墙，或给每张卡分配不同高饱和色。
- 禁止把主题灰嵌套组拆成散落白卡，或使用多档明显阴影叠加层级。
- 禁止把双色斜纹胶囊柱改成普通多色柱、直角堆叠柱、饼图或 3D 图表。
- 禁止把明细面板退化为组件库默认表格，或使用重表格线、彩色整行状态和自由行高。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认彩色快捷宫格、无依据插画、玻璃拟态、霓虹外发光和大面积装饰渐变。

### 错误与正确

- 错误：写死某个偏色灰或用纯白画布直接铺白卡；正确：由当前主题色低比例生成主题灰画布，托起纯白一级面板，内部再用稍高比例主题灰形成分组。
- 错误：所有摘要卡都使用不同渐变；正确：只保留一个主题渐变焦点，其余指标保持中性白卡。
- 错误：内部条目全部平铺成独立卡片；正确：使用白色外壳、主题灰分组和白色小单元建立三层归属关系。
- 错误：堆叠数据使用普通彩色直角柱；正确：使用深色基段、主题色斜纹顶段与圆角胶囊形。
- 错误：明细表直接套组件库默认样式；正确：使用固定 `neutral-gray` 圆角表头、图标化行、状态点、固定行高和克制分隔线。
- 错误：卡片随内容自由增高形成瀑布流；正确：同类卡片固定高度、网格拉伸，长内容内部滚动或截断。
- 错误：快捷入口使用彩色宫格；正确：使用白色或主题灰等高条目、主题色线性图标和短标签继承整体语言。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}`，生成全部实际 Brand Token，并按 3%/5% 比例计算页面画布与嵌套表面的主题灰实际值；然后按“视觉记忆点应用策略”逐项检查 `content_contract`。每页选择 1-3 个与 PRD 匹配的主记忆点：直接匹配则落地组件本体，只有相近槽位则迁移视觉机制，无合法承载则使用 `recipe_only`，涉及新增能力则使用 `suggest_only`。不要硬套槽位、伪造数据或凭空创造功能；无论组件是否落地，都要保持主题灰画布、白色浮岛、主题色小面积焦点、稳定网格和组件状态基线。

### 交付自检

- [ ] `themeId`、描述、视觉 DNA、组件标题和正文总结是否没有绑定默认色相？
- [ ] `themeId` 和描述是否只表达视觉机制，没有把某一种页面类型写成主题身份？
- [ ] 除中性色与状态语义色外，所有强调色、渐变端点和图表高亮是否由 `--color-brand1-6` 派生，没有写死彩色 Hex？
- [ ] 全部页面内容和模块是否来自 PRD，而非模板来源？
- [ ] 五个视觉记忆组件是否都声明了内容契约、落地策略、迁移目标与无匹配回退方式？
- [ ] 每页是否只选择与 PRD 匹配的 1-3 个主记忆点，未匹配组件是否没有强行渲染？
- [ ] 视觉机制迁移是否只改变已有内容的视觉承载，没有新增字段、指标、数据、入口、对象或流程？
- [ ] 页面画布和嵌套表面是否按 3%/5% 比例由当前主题色生成 `theme-gray`，且所有固定 `neutral-gray` 是否满足 RGB 三通道相等？
- [ ] PRD 存在首要摘要时，是否只有一个主题渐变摘要焦点，并保留顶部标题图标、核心信息与底部说明构图？
- [ ] PRD 存在分组内容时，是否保持白色外壳、主题灰分组和白色小单元的三层关系？
- [ ] 堆叠比较数据如有生成，是否使用深色基段、主题色斜纹顶段和胶囊圆角？
- [ ] PRD 存在重复记录时，明细区是否包含独立工具带、固定 `neutral-gray` 圆角表头、图标化行、状态点和固定行高？
- [ ] 主操作、唯一摘要、数据焦点和选中提示是否共享 `--color-brand1-6`，其余表面保持中性？
- [ ] 同类面板是否等高对齐，图表是否有固定高度，长内容是否在内部处理？
- [ ] 快捷入口如有生成，是否由 PRD 触发并继承白色或主题灰表面与主题色线性图标语言？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引发布局跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 的实际色值？
