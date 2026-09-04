---
name: "{{PROJECT_NAME}}"
description: 以低彩度浅画布、白色大圆角表面、互锁多强调摘要带和柔和数据纹理构成中等密度、轻阴影的活力主题。
themeId: interlocked-vivid-modules
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
      "--color-fill1-2": "#F1F1F1"
      "--color-fill1-3": "#E7E7E7"
      "--color-fill1-10": "rgba(255, 255, 255, 0.96)"
      "--color-text1-4": "#161616"
      "--color-text1-10": "#5C5C5C"
      "--color-text1-3": "#888888"
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
      "--corner-1": 6px
      "--corner-2": 10px
      "--corner-3": 14px
      "--corner-4": 18px
      "--corner-5": 24px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "<theme-gray：基于 --color-brand1-6 2% + #F7F7F7 98% 生成的实际色值>"
      "--oyd-category-surface-1": "var(--color-brand1-6)"
      "--oyd-category-surface-2": "#3168D5"
      "--oyd-category-surface-3": "#9339C9"
      "--oyd-category-surface-4": "#F05A09"
      "--oyd-card-watermark": "rgba(255, 255, 255, 0.07)"
      "--oyd-segment-muted": "rgba(255, 255, 255, 0.28)"
      "--oyd-primary-area-fill": "linear-gradient(180deg, color-mix(in srgb, var(--color-brand1-6) 18%, transparent) 0%, transparent 100%)"
    typography:
      metric-primary:
        "--font-size-metric-primary": 28px
        "--font-weight-metric-primary": 650
        "--font-lineheight-metric-primary": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题使用低彩度主题灰画布承托白色大圆角面板，以互锁的多强调摘要带作为强记忆点，再通过多层胶囊柱、平滑面积线、虚线比较序列、头像堆叠明细行和清单式辅助面板形成从概览到执行的阅读节奏。页面整体保持中等密度，面板内部留白充足，阴影轻而柔；高饱和分类表面只集中在摘要带及少量数据序列，合计不超过页面面积的 22%，其余区域保持中性。

### 风格定位与应用说明

- 核心气质是“柔和大表面、互锁模块、多强调概览、圆润数据纹理”；并列摘要、连续数据、成员集合和待处理条目最能发挥其记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留 24px 大面板圆角、浅主题灰画布、柔和阴影、胶囊数据形状、头像叠放和轻量状态反馈，不照搬固定业务模块。
- 无匹配内容时，将互锁关系降级为普通圆角卡片序列，将图表纹理迁移到已有数据槽位；无合法承载使用 `recipe_only`，需要新增能力使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 互锁多强调摘要带 | 四个高饱和圆角卡横向连续排列，相邻卡通过白色短连接件形成互锁感；卡内有淡水印、双层数值和分段进度。`observed` | 不可变机制是连续序列、连接节奏、白字层级与底部分段；分类数量与颜色由真实内容决定，第一强调面消费 `--color-brand1-6`。 | 退化为普通独立 KPI 卡，失去最强识别点；或滥用多色造成整页喧闹。 |
| 多层胶囊柱阵列 | 主柱由同色深浅三段重叠形成，比较柱使用独立分类色，全部为胶囊端点。`observed` | 保留圆端点、层叠深浅和固定组间距；数据、序列数与坐标由 PRD 决定。主题同色层级由 `--color-brand1-6` 派生。 | 退化为直角平柱或无层次的默认柱图，柔和数据纹理消失。 |
| 平滑面积与虚线比较 | 主趋势使用粗平滑线和轻透明面积，第二序列使用细虚线且不填充。`observed` | 保留主实线—次虚线—主题派生面积的三层关系和低对比网格；比较序列仅在真实数据存在时显示。 | 两条实线权重相同，主次混乱；或面积过重遮蔽网格和坐标。 |
| 头像堆叠柔性明细行 | 明细首列由重叠圆形头像与数量圆片构成，行使用浅色胶囊底，进度与状态均轻量图形化。`observed` | 保留 4-8px 负间距头像堆叠、圆形计数、柔性行底和细进度；真实成员、字段与状态由 PRD 决定。 | 退化为硬边框表格或虚假头像集合，信息亲和力与扫描效率下降。 |
| 清单式辅助面板 | 窄面板内以短文本和圆形完成标记构成纵向清单，已完成与未完成同时可辨。`observed` | 保留单列短行、右侧圆形状态、稳定行高和内部滚动；条目和完成状态由 PRD 决定。 | 退化为大卡套小卡或只靠颜色区分状态，辅助任务变得笨重。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 互锁多强调摘要带 | `content_contract`: 3-6 个并列、同层级且具备分类关系的摘要项，每项至少有标签与主值。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 明确存在多分类摘要。 | `transferable_mechanism`: 横向连续、白色连接节奏、淡水印与分段底轨；`adaptation_targets`: `primary_summary`、`primary_metrics`。 | `fallback`: 少于 3 项时使用普通圆角摘要卡；`forbidden`: 不得编造分类、指标、变化率或进度段。 |
| 多层胶囊柱阵列 | `content_contract`: 存在真实分组序列，且至少一组支持组成、区间或层级表达。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供分组与层级数据。 | `transferable_mechanism`: 圆端点、同色深浅叠层、稳定组距；`adaptation_targets`: `primary_content_panel`、分组比较。 | `fallback`: 单序列时使用单层胶囊柱；`forbidden`: 不得虚构组成关系或比较序列。 |
| 平滑面积比较图 | `content_contract`: 存在连续主序列与可选真实比较序列。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供有序维度和数值。 | `transferable_mechanism`: 主实线、次虚线、轻面积与稀疏网格；`adaptation_targets`: `primary_content_panel`、时间线、进度趋势。 | `fallback`: 无比较序列时移除虚线，仅保留主面积线；`forbidden`: 不得伪造趋势、预测或对照数据。 |
| 头像堆叠柔性明细 | `content_contract`: 明细记录真实关联一个或多个成员、对象或素材缩略图。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 已提供成员集合或图像集合。 | `transferable_mechanism`: 圆形叠放、数量圆片、浅胶囊行与轻进度；`adaptation_targets`: `detail_table`、`detail_list`。 | `fallback`: 无真实图像时使用首字母或单色图标，不显示虚假头像；`forbidden`: 不得生成成员、图片地址、状态或金额。 |
| 清单式辅助面板与条件式主辅行 | `content_contract`: 页面同时存在主要明细内容与可独立阅读的短清单或次级任务。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 同时提供 `detail_panel` 与 `supporting_panel`。 | `transferable_mechanism`: 约 3:1 主辅比例、短行清单、圆形状态和右侧内滚动；`adaptation_targets`: 真实主明细与辅助清单。 | `fallback`: 无独立清单时按 PRD 使用单列或其他布局；`forbidden`: 不得为形成窄列新增待办、提醒或状态。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、24px 以内标题、4px 基础间距、6-24px 圆角阶梯与轻柔阴影。`tokens.custom-page` 只补充主题灰画布、分类摘要表面、水印、卡内分段与主题派生面积填充，以及全局层缺失的主指标数字。网格复用 `--color-line1-1`，tooltip 复用 `--color-fill1-10`，普通行底复用 `--color-fill1-1`，不重复声明同义 Token。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 页面底层为低比例主题灰，一级面板纯白；多强调分类色集中于摘要带与数据序列，普通表面、表格和辅助面板保持中性。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；主操作、首个分类表面、主图表和选中强调 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔线、图表网格和表格行线 | `--color-line1-1` | 应用全局 |
| 输入框、按钮和面板常规边界 | `--color-line1-2` | 应用全局 |
| 页面底层主题灰画布 | `--oyd-page-background` | 自定义页 |
| 面板、卡片、弹窗和表单容器 | `--color-white` | 应用全局 |
| 首个分类摘要表面 | `--oyd-category-surface-1` | 自定义页 |
| 其余独立分类摘要与比较序列 | `--oyd-category-surface-2` 至 `--oyd-category-surface-4` | 自定义页 |
| 彩色摘要卡的低对比水印 | `--oyd-card-watermark` | 自定义页 |
| 彩色摘要卡的未激活分段 | `--oyd-segment-muted` | 自定义页 |
| 主趋势线的主题派生面积 | `--oyd-primary-area-fill` | 自定义页 |
| 菜单悬停、弱标签、默认浅填充与柔性表格行 | `--color-fill1-1` | 应用全局 |
| 菜单点击和中性选中底 | `--color-fill1-2` | 应用全局 |
| 更重的中性填充和进度轨道 | `--color-fill1-3` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表格表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、坐标轴、时间和元信息 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题主色种子，最终项目必须将七个 Brand Token 写成实际色值。首个分类表面跟随主色，另外三种分类色表达彼此独立的分类身份，不承担状态或品牌语义，也不参与主题同色推演。白色与低彩度中性/主题灰区域不少于页面面积的 72%，彩色摘要与数据序列合计不超过 22%。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3` 均为 `neutral-gray`，Hex 满足 `R = G = B`；`--color-fill1-10`、`--oyd-card-watermark` 与 `--oyd-segment-muted` 为等通道白色 rgba。
- `--oyd-page-background` 是 `theme-gray`，由 `--color-brand1-6` 2% 与 `#F7F7F7` 98% 混合；项目实例化时必须写入实际色值，不得保留生成期标记。
- `--oyd-category-surface-1` 与 `--oyd-primary-area-fill` 从 `--color-brand1-6` 派生；其余分类色保持独立分类角色。
- 成功、警告、错误和信息状态直接消费平台语义色，并配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 多强调卡仅用于真实并列分类；单个页面最多四种分类表面，同一大面板中的强调序列不超过两种。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；正文与内容标题消费 `body-1`；表格消费 `table`；元信息消费 `caption`。
- `subhead` 为 24px / 650 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 28px / 650 / 1.2，仅用于摘要主值，因为全局层没有独立主指标语义，不得替代页面标题。
- 彩色表面的标题、主值与辅助信息使用白色并通过字号、字重和 70%-100% 不透明度区分；数值启用等宽数字。
- 长标题最多两行；表格主文本单行省略并提供完整值。图标使用 1.5-2px 圆角线性描边，正文 16-18px，卡片水印图形可扩大但必须低于 10% 不透明度。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：微间距用 `--s-1 / --s-2`，控件组用 `--s-3`，卡片内距用 `--s-4 / --s-6`，大区块用 `--s-6 / --s-8`。
- 全页面最大宽度 1760px，安全边距 28-32px；父级统一使用 `gap`，同类面板拉伸，长内容内部处理。
- 互锁摘要带的 4 列布局仅在 3-6 个并列摘要内容契约成立时使用；不足时按真实数量生成普通网格，不保留空连接件。
- 主辅 3:1 行仅在主要明细与独立短清单同时存在时使用；否则遵守页面模式的单列、列表、表单、详情或流程结构。
- `page_identity`、`primary_summary`、`primary_content_panel`、`detail_table/detail_list` 与 `supporting_panel` 是否出现及顺序由 PRD 决定。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items: stretch`；禁止瀑布流与 `align-items: start`。
- 面板使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；标题固定，内容区 `flex: 1; min-height: 0`。
- `metric_card` 高 180-220px；互锁摘要带整体同高；`chart_panel` 高 420-500px；`detail_panel` 高 380-560px；清单辅助面板高 380-560px；可选 `quick_action_item` 高 76-92px。
- 图表绘图区固定 300-360px；表格、列表与长文本内部滚动、截断或折叠，不撑破外层。
- ≥1280px：摘要带按真实数量横排，双主图可 1:1，主辅内容契约成立时使用 3:1；768-1279px：摘要改 2 列，双图上下或 1:1，主辅上下排列；<768px：全部单列，互锁连接件隐藏，辅助清单排在主内容后，可解除等高但保留控件高度与溢出策略。
- 内容契约不成立时，各断点遵循 PRD 页面模式，不生成空卡、空列或空辅助面板。

## 表面与层级

- 页面画布消费 `--oyd-page-background`；一级面板使用白色、无可见边框或 1px `--color-line1-1`，阴影 `0 6px 20px rgba(0,0,0,0.035)`。
- 彩色摘要卡无阴影，依靠高饱和表面、白色连接件和 `--corner-5` 建立层级；普通面板禁止使用同等高饱和背景。
- tooltip 与 popover 使用 `--color-fill1-10`、`--color-line1-2`、`0 8px 24px rgba(0,0,0,0.10)`；嵌套内容使用 `--color-fill1-1`，不重复加阴影。
- 不使用毛玻璃、强辉光或大面积装饰渐变；只允许主题派生的图表面积渐变和卡内低对比水印。

## 圆角与形状

- `--corner-1` 6px 用于短状态块；`--corner-2` 10px 用于输入与按钮；`--corner-3` 14px 用于行内胶囊和 tooltip；`--corner-4` 18px 用于普通卡片；`--corner-5` 24px 用于彩色摘要与大型面板。
- `--corner-semicircle` 用于图表柱、进度条、状态胶囊和数量圆片；`--corner-circle` 用于头像、完成标记和图标按钮。
- 同层面板圆角一致；胶囊形只服务数据纹理与短状态，不将长文案容器强制胶囊化。

## 组件

### 按钮与操作

按钮仅使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮为同档正方形。默认 `--corner-2`，主按钮使用 `--color-brand1-6`，次按钮白底细边。hover、active 分别消费 `--color-brand1-1 / --color-brand1-9`；focus 使用 2px 主题色外环与 2px offset；disabled 同时降低文字和边界对比并移除反馈。同一操作区只保留一个主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。白色表面、`--color-line1-2` 边界、`--corner-2`；placeholder 用 `--color-text1-10`。focus 显示主题色边界和外环，error 消费平台错误色并配合文字。组合控件保持等高，移动端按组换行。

### 卡片与面板

一级面板使用 `--corner-5`、白色表面、轻阴影和 `--s-6 / --s-8` 内距；普通卡片使用 `--corner-4`。标题区固定，内容区 `flex: 1`。嵌套内容以浅填充区分，不反复套卡。只有可独立理解、操作或滚动的内容才进入卡片。

### 互锁多强调摘要带

固定公式：3-6 个等高彩色 `metric_card` + 8-12px 视觉间隙 + 位于卡片侧边中部的白色短连接件。卡内按“标题与尾部操作—辅助值与主变化—四段底轨”组织；低对比水印固定在右下或中央，不干扰文字。第一表面消费主题色，其他表面消费独立分类色；文字统一白色。小屏隐藏连接件并改普通网格。禁止将多色扩散到普通面板，禁止为凑满四卡编造摘要。

### 多层胶囊柱阵列

固定公式：每组 1-2 个主柱，每个可由 2-3 个同色深浅层叠胶囊组成；柱宽 28-36px，组内 gap 10-16px，组间 gap 28-40px。主色层级从 `--color-brand1-6` 推演，第二真实序列可消费独立分类色。网格使用 `--color-line1-1`，坐标使用 `caption`。禁止直角柱、3D 柱、无真实语义的三层叠加。

### 平滑面积比较图

固定公式：3px 主实线 + `--oyd-primary-area-fill` + 1.5px 次虚线 + 稀疏网格。主线使用主题色，次线只在真实比较数据存在时使用独立分类色；节点仅在 hover/focus 或终点显示。曲线平滑但不得越过真实极值，面积透明度保持低于 20%。禁止用两条同权实线或高饱和满面积填充。

### 头像堆叠柔性明细

固定公式：44px 头像堆叠区 + 主文本字段 + 细进度 + 短状态胶囊 + 数值字段。头像直径 36-40px，相邻负间距 6-10px，最后使用白色数量圆片；无真实图像时使用首字母或单色图标。行高 64-76px，行底使用 `--color-fill1-1`，相邻行间 8-12px。禁止虚构头像、成员或数量。

### 清单式辅助面板

固定公式：面板标题 + 单列短条目 + 右侧 28-32px 圆形状态。条目行高 52-60px，完成状态消费平台成功色并包含勾选图标，未完成状态用中性边界与空心圆；长文本最多两行，更多内容内部滚动。禁止只靠颜色表达完成状态，禁止把每条清单包成独立卡片。

### 图表或主内容面板

同排主图面板在内容契约成立时使用 1:1；标题位于左上，图例或筛选位于右上。绘图区固定 300-360px，网格低对比，tooltip 复用全局浮层 Token。无数据时保留面板高度和坐标区域骨架，不生成虚假曲线或柱形。所有图表提供文本摘要与键盘焦点。

### 表格与列表

表头高 44px、无重边框；数据行高 64-76px，优先使用浅灰柔性行底而非全边框。主文本左对齐，数字右对齐并启用等宽数字；进度由细胶囊轨道与百分比共同表达，状态由文案与形状共同表达。表体固定高度内滚动，长文本省略且可访问完整值；移动端转字段分组列表或横向滚动。

### 快捷入口（推断）

未观察到独立快捷入口，因此只保留 `inferred / render_policy: recipe_only` 配方：PRD 明确存在高频入口时，使用独立白色区块、2-4 个等宽项、76-92px 高、单色线性图标和短标签；可使用主题色小面积图标底，但禁止复制互锁多色摘要带作为快捷入口。

### 状态与交互

- 悬停：120-180ms 内轻微提升阴影、改变边界或浅填充，不改变尺寸。
- 按下：80-120ms 消费 `--color-brand1-9` 或 1px 内收反馈。
- 聚焦：控件显示清楚 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持卡片、图表与列表固定高度，以骨架或稳定占位避免跳动。
- 空态与错误：保留原面板结构，提供简短说明和下一步操作，不整块染成状态色。
- 禁用与选中：禁用结合低对比、图标和文案；选中结合主题色边界、标记或形状，不只依赖颜色。
- 动效：常规 140-200ms `ease-out`，图表序列 220-320ms；`prefers-reduced-motion` 下关闭位移与逐项动画。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题资格。原生页面与自定义页面共同继承全应用颜色、字体、间距与圆角；自定义页面仅在需要主题灰画布、多分类表面、水印、卡内分段、面积填充或主指标数字时消费页面级 Token。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉表达。互锁摘要、双主图、3:1 主辅行、头像明细和清单面板均须经过内容契约，不得把所有页面强制改造成同一结构。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面，并说明中性槽位、跨度、高度、移动端顺序与采用的视觉 DNA。页面无需使用全部组件母体，但采用对应信息类型时必须遵守构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图和辅助图形必须有真实来源；缺少素材时使用结构化数据或中性占位，不编造人物、对象、指标、状态或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护主题灰画布、白色大圆角面板、轻柔阴影、圆润数据纹理和受控多强调面积。
- 内容契约满足时，互锁摘要必须保护连续排列、白色连接件、低对比水印、双层数值与分段底轨。
- 分组层级数据存在时，多层柱必须保护胶囊端点、同色深浅和稳定组距；连续比较存在时，面积图必须保护主实线、次虚线与轻面积。
- 成员集合存在时，明细行必须保护头像叠放、数量圆片、柔性行底与轻进度；短清单存在时保护右侧圆形状态和非纯颜色表达。
- 同类面板等高、图表固定高度、长内容内部处理、父级 gap 统一；完整实现状态、响应式、键盘访问与 reduced motion。

### 禁止项

- 禁止复制模板来源中的业务内容，或让本文件覆盖 PRD 的内容决策。
- 禁止把主色或分类色铺满普通面板与页面画布；禁止把任一默认色相写成主题身份。
- 禁止把互锁摘要固定为四项或强制所有页面渲染；禁止把双图 1:1、主辅 3:1 与模块顺序写成全页面硬规则。
- 禁止用普通独立 KPI 卡替代互锁构图；禁止把胶囊柱改成直角柱，把主实线—次虚线改成同权双实线。
- 禁止虚构头像、成员、比较序列、清单或完成状态；禁止把每条明细和清单再套一层重阴影卡。
- 禁止瀑布流、自由高度卡片、`align-items: start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、无依据装饰和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：四张普通彩色卡仅并排；正确：真实并列摘要满足契约时，使用连续互锁、白色连接节奏、水印与分段底轨。
- 错误：多层柱只是随机叠色；正确：每一层都对应真实组成或区间，并使用同色明度阶梯与圆端点。
- 错误：两条趋势线同粗同色；正确：主实线加轻面积、次虚线无填充，明确主次。
- 错误：明细首列使用虚假头像；正确：有真实素材才叠放，否则用首字母或单色图标。
- 错误：所有页面固定 3:1 主辅行；正确：主要明细与独立清单同时存在时使用，否则遵循 PRD 页面模式。
- 错误：多色覆盖整页；正确：多强调集中于摘要与少量序列，普通面板保持白色。
- 错误：卡片随内容形成瀑布流；正确：同类面板等高，长内容内部滚动或截断。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成七个实际 Brand Token 与主题灰画布实际值。所有页面先继承全应用 Token 与基础组件语言，再按内容契约选择互锁摘要、多层胶囊柱、面积比较、头像明细或清单面板。分类色只表达真实并列类别，主题色只改色相，不改变互锁关系、圆润形状、柔和表面、密度和交互机制。页面级 Token 已完成全局语义复用扫描，禁止重新声明网格、tooltip、普通行底或进度轨道的同义 Token。

### 交付自检

- [ ] 全部内容和模块是否来自 PRD，而非模板来源？
- [ ] 互锁摘要是否仅在 3-6 个并列摘要契约成立时出现，并保护连接件、水印与分段底轨？
- [ ] 多层胶囊柱是否只编码真实层级，并保持圆端点与稳定组距？
- [ ] 面积比较图是否保护主实线、次虚线、轻面积与真实比较关系？
- [ ] 头像明细是否只使用真实素材，并保护叠放、数量圆片与柔性行底？
- [ ] 清单辅助面板是否仅在真实短清单存在时出现，并使用非纯颜色状态？
- [ ] 每个组件或布局记忆点是否都有 `content_contract`、`render_policy`、迁移目标和回退策略？
- [ ] 固定列数、1:1 双图、3:1 主辅行与模块顺序是否未被写成全页面硬规则？
- [ ] 未触发组件是否没有强行渲染，迁移是否没有新增业务内容？
- [ ] 主题同色演变是否由 `--color-brand1-6` 派生，独立分类色是否角色明确且面积受控？
- [ ] `custom-page` 是否没有与全局层同值同义或角色重叠的 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] 主题身份、DNA、组件标题和总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的中等密度、局部留白、大圆角、轻阴影和受控多强调是否与正文及 Token 一致？
- [ ] `neutral-gray` 是否全部满足 `R = G = B`；`--oyd-page-background` 是否按主题色 2% 与 `#F7F7F7` 98% 计算并写入实际值？
- [ ] 所有真实页面是否共享全应用 Token，视觉记忆点是否按内容契约条件式落地？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开真实页面？
- [ ] 同类面板是否等高，图表是否固定高度，长内容是否内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 与主题灰实际值？
