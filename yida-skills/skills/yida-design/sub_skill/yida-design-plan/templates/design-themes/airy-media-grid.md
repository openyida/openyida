---
name: "{{PROJECT_NAME}}"
description: 以纯白画布、分隔式无卡底摘要带、单行命令工具条和低对比大圆角媒体栅格构成宽松、克制、对象优先的轻量主题。
themeId: airy-media-grid
tokens:
  application-global:
    colors:
      "--color-white": "#FFFFFF"
      "--color-brand1-1": "<基于 --color-brand1-6 生成的实际色值：与白色混合 14%，用于悬停>"
      "--color-brand1-2": "<基于 --color-brand1-6 生成的实际色值：与白色混合 88%，用于平台品牌浅色>"
      "--color-brand1-3": "<基于 --color-brand1-6 生成的实际色值：与白色混合 95%，用于浅色导航框架>"
      "--color-brand1-5": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 16%，用于深色导航框架>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<基于 --color-brand1-6 生成的实际色值：与黑色混合 10%，用于按下与激活>"
      "--color-brand1-10": "<基于 --color-brand1-6 生成的实际色值：与白色混合 64%，用于禁用>"
      "--color-line1-1": "#EEEEEE"
      "--color-line1-2": "#DDDDDD"
      "--color-fill1-1": "#FAFAFA"
      "--color-fill1-2": "#F4F4F4"
      "--color-fill1-3": "#E9E9E9"
      "--color-fill1-10": "rgba(255, 255, 255, 0.97)"
      "--color-text1-4": "#181818"
      "--color-text1-10": "#606060"
      "--color-text1-3": "#929292"
    typography:
      base:
        "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 500
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
      "--corner-5": 24px
      "--corner-circle": 50%
      "--corner-semicircle": 500px
  custom-page:
    colors:
      "--oyd-page-background": "#FFFFFF"
      "--oyd-media-surface": "#F6F6F6"
      "--oyd-media-selected": "color-mix(in srgb, var(--color-brand1-6) 5%, #F6F6F6)"
      "--oyd-media-shadow": "rgba(0, 0, 0, 0.028)"
    typography:
      metric-primary:
        "--font-size-metric-primary": 28px
        "--font-weight-metric-primary": 500
        "--font-lineheight-metric-primary": 1.2
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题以纯白画布和极弱无彩边界建立安静基底。顶部摘要不包卡，而是通过宽松留白与细竖分隔形成连续数据带；其下的搜索、视图切换、范围选择、排序与筛选组成单行命令工具条。主体使用等宽、等高的大圆角媒体对象栅格，每项以低对比浅灰表面承载居中的透明背景素材，标题与辅助信息固定在底部，左上保留极简状态短线与弱操作点。主题色面积控制在焦点、当前视图、主操作和选中态，避免干扰真实素材。

### 风格定位与应用说明

- 核心气质是“宽松白场、对象优先、弱容器、强对齐、少量焦点”；带真实缩略素材、可筛选对象和并列摘要的内容最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据真实页面、页面模式与内容生成，视觉记忆点仅在满足内容契约时使用。
- 构图迁移时保留无卡底摘要、等高工具控件、低对比媒体表面、居中留白、底部双层文字和连续等高网格，不照搬固定指标数量、列数、素材或筛选项。
- 无真实媒体时，将对象卡降级为文本或图标对象卡；无并列摘要时移除摘要带；需要新增搜索、筛选、排序或视图切换能力时只能使用 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 无卡底分隔摘要带 | 多个摘要直接位于白色画布，组间仅用细竖线分隔；每组为小标题、主值和行内变化信息。`observed` | 保留连续白场、等宽分段、细竖分隔与紧凑文字层级；数量、值和变化内容由 PRD 决定。 | 退化为一排独立阴影卡，页面变重并失去通透感。 |
| 单行命令工具条 | 宽搜索框占主要空间，右侧依次排列视图分段、范围、排序与筛选，控件等高且间距统一。`observed` | 保留主输入弹性伸展、操作组稳定顺序和 40px 等高；只渲染 PRD 已定义的真实操作。 | 控件散落、尺寸不一或换成多行表单，扫描路径被打断。 |
| 媒体优先对象卡 | 大圆角浅灰卡以 58%-68% 高度承载居中透明素材，底部固定标题与辅助信息，视觉焦点落在对象轮廓。`observed` | 保留大面积媒体舞台、`object-fit: contain`、统一安全区和底部文本带；素材、名称与字段由 PRD 决定。 | 图片被裁切、贴边或被文字覆盖，对象辨识度和高级感下降。 |
| 极简卡内状态标记 | 卡片左上使用短横线和两个弱圆点形成克制状态/操作锚点，不设置重型标题栏。`observed` | 仅在存在真实状态或行内操作时使用；主状态消费主题色，非交互点使用中性灰。 | 替换为大标签、彩色角标或完整工具栏，破坏素材主导关系。 |
| 连续等高宽松栅格 | 桌面以四列宽松网格连续铺排，同一行卡片尺寸一致，下一行自然延续，页面不依赖瀑布流。`observed` | 列数按容器自适应，固定最小卡宽、统一高宽比和父级 gap；真实对象数量决定行数。 | 卡片自由高、列宽漂移或密集小缩略图会丢失稳定节奏。 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 无卡底分隔摘要带 | `content_contract`: 至少两个同层摘要，且每项包含主值与可选变化说明。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供 `primary_metrics`。 | `transferable_mechanism`: 连续白场、细竖分隔、主值与行内变化；`adaptation_targets`: `primary_metrics`、`primary_summary`。 | `fallback`: 单项摘要独立排版，多项缺失时移除该带；`forbidden`: 不得编造指标、变化率或比较周期。 |
| 单行命令工具条 | `content_contract`: PRD 已定义搜索、视图切换、时间范围、排序或筛选中的一个或多个操作。 | `render_policy: adapt_existing_slot`；`direct_trigger`: 存在真实 `global_actions` 或内容过滤任务。 | `transferable_mechanism`: 主输入弹性伸展、其余操作等高成组；`adaptation_targets`: `global_actions`、列表工具栏、对象检索。 | `fallback`: 仅保留真实操作并重新对齐；`forbidden`: 不得新增搜索、筛选、排序、日期或视图模式。 |
| 媒体优先对象卡 | `content_contract`: 对象具有真实可访问的主媒体或视觉缩略素材，以及主标题和可选辅助字段。 | `render_policy: prd_match_only`；`direct_trigger`: PRD 提供对象集合与合法素材。 | `transferable_mechanism`: 低对比媒体舞台、居中 contain、底部文本带；`adaptation_targets`: `primary_content_panel`、对象集合、素材集合。 | `fallback`: 无媒体时使用图标或文本对象卡，不生成假图片；`forbidden`: 不得编造名称、品牌、类别、价格、图片地址或对象。 |
| 极简卡内状态标记 | `content_contract`: 对象存在真实状态、选中态或 1-2 个弱操作。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 定义状态或卡内操作。 | `transferable_mechanism`: 左上短线、弱圆点、小面积主题焦点；`adaptation_targets`: 对象卡状态、批量选择、弱操作。 | `fallback`: 无状态和操作时移除标记；`forbidden`: 不得把装饰点伪装成可点击控件或编造状态。 |
| 连续等高宽松栅格 | `content_contract`: 页面存在同构对象集合，卡片字段与媒体区域可以统一。 | `render_policy: adapt_existing_slot`；`direct_trigger`: PRD 提供可重复对象集合。 | `transferable_mechanism`: 自适应等宽列、固定卡高、统一 gap 与稳定滚动；`adaptation_targets`: `primary_content_panel`、`detail_list`。 | `fallback`: 异构内容保持 PRD 原有结构，仅迁移表面与间距；`forbidden`: 不得为凑列数复制对象或补空卡。 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用契约；本主题使用无彩色灰阶、24px 以内标题、4px 基础间距、4-24px 圆角阶梯和轻字重。`tokens.custom-page` 仅补充纯白页面画布、低对比媒体舞台、主题派生选中表面、极轻卡片阴影与全局层缺失的摘要主值。普通浅填充、边界、tooltip、正文与状态色均复用全局 Token，不重复声明同义变量。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 纯白画布与低对比浅灰媒体舞台承担绝大部分面积；主题色只连接当前视图、焦点、主操作、选中态和少量正向信息。

### 设计变量消费规则

| 固定消费语义 | 消费 Token | 作用域 |
| --- | --- | --- |
| 主题色交互元素悬停 | `--color-brand1-1` | 应用全局 |
| 平台预留品牌浅色；自定义页不主动绑定 | `--color-brand1-2` | 应用全局 |
| 浅色导航框架背景 | `--color-brand1-3` | 应用全局 |
| 深色导航框架背景 | `--color-brand1-5` | 应用全局 |
| 全应用主题主色；主操作、当前视图、选中与焦点 | `--color-brand1-6` | 应用全局 |
| 主题色交互元素激活或按下 | `--color-brand1-9` | 应用全局 |
| 主题色交互元素禁用状态 | `--color-brand1-10` | 应用全局 |
| 弱分隔、摘要竖线、网格边界与行线 | `--color-line1-1` | 应用全局 |
| 输入、按钮和必要容器边界 | `--color-line1-2` | 应用全局 |
| 页面底层纯白画布 | `--oyd-page-background` | 自定义页 |
| 常规面板、弹窗和表单容器 | `--color-white` | 应用全局 |
| 对象卡的低对比媒体舞台 | `--oyd-media-surface` | 自定义页 |
| 对象卡的主题派生选中表面 | `--oyd-media-selected` | 自定义页 |
| 对象卡的极轻阴影 | `--oyd-media-shadow` | 自定义页 |
| 菜单悬停、弱标签和默认浅填充 | `--color-fill1-1` | 应用全局 |
| 中性选中底和嵌套浅层 | `--color-fill1-2` | 应用全局 |
| 更重中性填充和禁用轨道 | `--color-fill1-3` | 应用全局 |
| 标题、主值、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表头和输入框 placeholder | `--color-text1-10` | 应用全局 |
| 辅助说明、元信息和弱操作点 | `--color-text1-3` | 应用全局 |

`--color-brand1-6` 是唯一主题色种子。其他六个 Brand Token 与 `--oyd-media-selected` 均由它派生，并在项目实例化时写入实际色值。无品牌色时使用产品流程提供的默认主色；真实媒体自身色彩保持原貌，不参与主题推演，也不得被主题滤镜统一染色。无彩区域不少于页面面积的 92%，主题色界面元素控制在 4%-8%。

### 本主题的配色约束

- `--color-line1-1 / --color-line1-2`、`--color-fill1-1 / --color-fill1-2 / --color-fill1-3`、`--color-text1-4 / --color-text1-10 / --color-text1-3`、`--oyd-page-background` 与 `--oyd-media-surface` 均为 `neutral-gray`，Hex 满足 `R = G = B`；`--color-fill1-10` 与 `--oyd-media-shadow` 的前三通道相等。
- `--oyd-media-selected` 是 `theme-gray`，由 `--color-brand1-6` 5% 与中性基底 `#F6F6F6` 95% 混合；项目实例化时必须写入实际色值。
- 真实媒体属于内容素材，允许保留其独立色彩；界面层不得从媒体取色生成随机按钮、标签或卡片底色。
- 成功、警告、错误和信息状态直接消费平台语义色，并配合文字、图标或方向符号；`custom-page` 不重复声明同义状态 Token。
- 主题色不得覆盖对象图像、浅灰媒体舞台、普通文字或整张对象卡，只可作为细边、图标、焦点或选中反馈。

## 字体与排版

- 全局只使用 `tokens.application-global.typography.base` 的字体栈。
- `page-title` 消费 `tokens.application-global.typography.subhead`；`panel-title` 消费 `body-2`；对象标题与正文消费 `body-1`；表格消费 `table`；辅助信息消费 `caption`。
- `subhead` 为 24px / 500 / 1.3；`body-2` 为 16px / 600 / 1.4；`body-1` 为 14px / 400 / 1.5；`table` 为 14px / 400 / 1.45；`caption` 为 12px / 400 / 1.4。
- `tokens.custom-page.typography.metric-primary` 为 28px / 500 / 1.2，仅用于摘要主值；它是全局层缺失的独立数字语义，不替代页面标题。
- 数值启用 `font-variant-numeric: tabular-nums`；摘要标题与辅助信息单行省略，对象标题桌面最多两行、移动端最多两行，完整值通过详情或可访问名称提供。
- 图标使用 1.5px 线性描边、圆端点；工具栏图标 18px，卡内弱操作点 4-6px。图标与文字视觉居中，不使用 emoji 替代功能图标。

## 布局与间距

- 所有间距消费 YAML 的 `--s-1` 至 `--s-8`：图标与文字用 `--s-2`，工具组用 `--s-3 / --s-4`，对象卡文字区用 `--s-4`，主要区块用 `--s-6 / --s-8`。
- 全页面最大宽度 1800px，桌面安全边距 24-32px；父级使用 `gap`，同类卡片拉伸对齐，子项设置 `min-width: 0`。
- 摘要带按真实数量自适应等宽分段，工具条以搜索槽弹性占满剩余空间；对象网格按容器宽度自适应，不固定必须四列。
- 页面身份、摘要、工具条和对象集合是否出现及顺序由 PRD 与页面模式决定；没有对象集合时不得生成空栅格或空对象卡。

### 布局稳定性硬规则

- 桌面端主网格使用 `align-items: stretch`；禁止瀑布流和 `align-items: start`。
- 面板与对象卡使用 `height: 100%`、`min-width: 0`、`min-height: 0`、`display: flex`、`flex-direction: column`；媒体区 `flex: 1; min-height: 0`，文字区固定。
- `metric_card` / 摘要分段高 96-128px；主要对象 `card` 高 360-420px；媒体区高 250-310px；`detail_panel` 高 360-520px；无图表时 `chart_panel` 不渲染；可选 `quick_action_item` 高 68-80px。
- 素材使用 `max-width: 68%`、`max-height: 68%`、`object-fit: contain`，不得溢出媒体安全区；长标题截断，网格由页面滚动，不允许单卡自由增高。
- ≥1440px：对象集合按最小卡宽 300px 自动形成最多 4-5 列；960-1439px：2-3 列，摘要 2 列，工具控件允许分为两组但保持各组单行；<960px：单列或 2 列，摘要单列，工具条分组换行；<640px：对象单列，搜索独占一行，其余控件横向滚动或折叠进已存在的更多操作。
- 各断点不得复制对象补齐列数；移动端可缩短卡高但保持媒体安全区、文字区和触控目标。

## 表面与层级

- 页面底层与常规容器使用纯白；对象卡使用 `--oyd-media-surface`，常态不描边，阴影为 `0 8px 28px --oyd-media-shadow`，主要依靠 6% 明度差与大圆角建立层级。
- 搜索、筛选和分段控件使用白色或 `--color-fill1-1`，1px `--color-line1-2`；视图切换组可以共享一个外层边界，内部按钮不各自投影。
- tooltip、popover 使用 `--color-fill1-10`、`--corner-3` 与 `0 10px 28px rgba(0,0,0,0.10)`；嵌套状态只用浅填充或主题细边，不叠加阴影卡。
- 禁止毛玻璃、强辉光、大面积渐变和重投影；真实媒体可以有自身光影，但界面容器保持无彩、低对比。

## 圆角与形状

- `--corner-1` 4px 用于弱操作点、短线和微状态；`--corner-2` 8px 用于按钮、输入与小浮层；`--corner-3` 12px 用于分段控件和 tooltip；`--corner-4` 16px 用于普通面板；`--corner-5` 24px 用于媒体对象卡。
- `--corner-semicircle` 只用于短状态、计数和紧凑标签；`--corner-circle` 用于图标按钮、选择点和媒体占位图标。
- 对象卡同层统一使用大圆角；媒体素材自身不裁为圆形或胶囊，除非真实资产就是该形状。

## 组件

### 按钮与操作

按钮只使用 28px 行内、32px 紧凑工具栏、36px 常规、40px 强调四档；图标按钮使用同档正方形。主按钮消费 `--color-brand1-6`，次按钮白底细边，视图切换的当前项只让图标或底部短线使用主题色。hover、active 使用 `--color-brand1-1 / --color-brand1-9`；focus 为 2px 主题色外环加 2px offset；disabled 同时降低文字、图标和边界对比。同一操作区只保留一个主操作。

### 输入与筛选控件

紧凑工具栏 32px、常规表单 36px、宽松搜索与选择器 40px。主搜索使用 40px 高、`--corner-3`、白底与 `--color-line1-2`；筛选、排序和范围选择同高。placeholder 消费 `--color-text1-10`，focus 使用主题边界与外环，error 使用平台错误色并附文字。窄屏按操作组换行，不压缩到不可读宽度。

### 卡片与面板

对象卡使用 `--corner-5`、`--oyd-media-surface` 和固定高度，内部拆为弹性媒体区、固定文字区与可选状态锚点；卡片整体只响应一个主要点击任务。普通信息面板使用 `--corner-4` 与白色表面。禁止在对象卡内再嵌套同等圆角和阴影的卡片。

### 无卡底分隔摘要带

固定公式为“连续白场 / 等宽摘要分段 / 1px 竖分隔 / 小标题 / 主值与行内变化”。分隔线高度占摘要带 58%-72%，不触顶或触底；主值消费 `metric-primary`，变化信息使用平台状态色加方向符号或文字。单项时移除竖分隔，多项时不为每项添加卡底。

### 媒体优先对象卡

固定公式为“左上可选状态锚点 / 58%-68% 媒体舞台 / 居中 contain 素材 / 底部标题与辅助信息”。媒体安全区四周至少保留 `--s-6`，素材不裁切、不拉伸、不统一套主题滤镜；文字区高 76-96px，标题最多两行。无真实媒体时使用经授权的中性图标或文本占位，不生成虚假图片。

### 极简卡内状态标记

左上短线长 20-28px、高 4px，旁边最多两个 4-6px 圆点；有当前状态时短线消费 `--color-brand1-6`，无状态时使用 `--color-text1-3`。若圆点可交互，整体改为 28px 图标按钮并提供名称；禁止让装饰圆点看似可点击。

### 连续等高对象栅格

使用 `repeat(auto-fit, minmax(280px, 1fr))` 或等价自适应网格，父级 gap 为 `--s-6 / --s-8`，同一行卡片等高。排序变化使用 FLIP 或 180-240ms 位移动画，`prefers-reduced-motion` 下直接更新。不得使用 Masonry、自由高媒体或复制占位卡补齐末行。

### 图表或主内容面板

本主题的主内容默认由对象集合承载，不强制图表。若 PRD 确有图表，使用白色或 `--color-fill1-1` 表面、固定 320-420px 高度、1px 弱网格、单主题主序列和轻 tooltip；不得为了匹配主题添加无业务依据的图表。

### 表格与列表

当页面切换到真实列表模式时，表头高 44px、数据行 56-64px，缩略图 40-48px 并使用 `object-fit: contain`；标题与辅助信息保持两级，状态配合文字或图标，尾部操作为 28px 图标按钮。长内容单行省略，表格在面板内部滚动并固定表头。

### 快捷入口（可见或推断）

视觉材料未形成独立快捷入口区，置信度为 `inferred`，默认 `render_policy: recipe_only`。若 PRD 明确要求，使用 68-80px 白色条目、单色线性图标与两级文字，继承本主题大留白和弱边界；禁止默认彩色宫格。

### 状态与交互

- 悬停：对象卡阴影提升至 `0 12px 32px rgba(0,0,0,0.045)`，素材可缩放至 1.015，但容器尺寸不变。
- 按下：按钮消费 `--color-brand1-9`；对象卡使用 1px 内缩或素材回到 1.0，不改变网格尺寸。
- 聚焦：控件和可点击卡片显示 2px 主题色 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持摘要、工具条和卡片固定尺寸；媒体区使用中性骨架，禁止布局跳动。
- 空态与错误：保留对象网格容器或列表面板，给出简短说明与真实下一步操作，不把整屏染成状态色。
- 禁用与选中：禁用同时降低文字、图标和边界对比；选中使用 `--oyd-media-selected`、主题细边与可访问标记，不只依赖颜色。
- 动效：hover 120-160ms，筛选与排序 180-240ms，浮层 160-200ms，均使用 ease-out；`prefers-reduced-motion` 下关闭缩放和位移。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务与内容上下文，不决定主题是否可用。原生页面和自定义页面共同继承纯白画布、无彩灰阶、轻字重、稳定间距和控件状态；仅在内容契约成立时使用无卡底摘要、命令工具条和媒体对象栅格。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容、信息架构与模块。本主题只规定视觉表达；没有对象集合或真实媒体时，页面保持 PRD 的列表、表单、详情、流程或数据结构，只迁移白场、弱边界、大圆角、间距和交互语言。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时只展开项目真实存在的页面；每页说明 `page_identity`、`primary_metrics`、`global_actions`、`primary_content_panel`、`detail_list/detail_table` 的位置、跨度、高度、移动端顺序和采用的视觉 DNA。页面不必使用全部母体，但采用对象卡或摘要带时必须遵守本文构图公式。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 媒体素材必须来自真实授权来源，优先使用透明背景或干净轮廓素材；没有素材时使用中性图标或结构化占位，不编造品牌、对象、名称、类别或图片地址。

## 设计规范与禁忌

### 必须做到

- 所有页面必须保留纯白主画布、无彩灰阶、轻字重、克制主题焦点和稳定留白；不得用大面积主题底色替代白场。
- 摘要契约成立时必须保护连续白场、细竖分隔和主值行内变化；对象契约成立时必须保护低对比媒体舞台、居中 contain、安全区和底部文字带。
- 命令操作契约成立时必须让主搜索弹性伸展、其余控件等高成组；不得为保持工具条而新增不存在的功能。
- 对象网格必须等宽等高、父级 gap 统一、素材不裁切、长文本截断；状态与选中必须可通过非颜色线索识别。
- 完整 hover、active、focus、loading、empty、error、disabled、selected、三档响应式与键盘访问必须落地。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让 DESIGN.md 覆盖 PRD 的内容决策。
- 禁止把输入主题色铺满背景、普通卡片或大面积面板；禁止从真实媒体随机取色作为界面主题。
- 禁止把固定四列、固定摘要数量、完整筛选组合或模块顺序写成所有页面无条件执行的结构。
- 禁止裁切主体、拉伸媒体、用主题滤镜统一素材、让文字覆盖素材或让对象贴近卡边。
- 禁止把摘要改为一排重阴影卡、把对象卡改为密集小缩略图、把连续网格改为瀑布流。
- 禁止自由高度卡片、`align-items: start`、无固定媒体区、长内容撑破父级和零散 margin 拼接。
- 禁止默认后台质感、厚描边、强投影、毛玻璃、无依据装饰和与主题不一致的组件库默认样式。

### 错误与正确

- 错误：每项摘要都有独立卡底和重阴影；正确：摘要共享白场，只用留白与细竖线分组。
- 错误：搜索与筛选尺寸不同、散落两侧；正确：主搜索弹性占位，其余操作按任务等高成组。
- 错误：媒体填满并裁切卡片；正确：素材在统一安全区内居中 contain，保持真实比例和充足留白。
- 错误：为保持四列复制或编造对象；正确：网格按真实数量自然形成末行，并随容器自适应列数。
- 错误：所有页面强制使用媒体对象栅格；正确：内容契约成立时使用本体，否则保留 PRD 页面模式并迁移白场、圆角、排版与间距。
- 错误：主题色覆盖整卡或真实素材；正确：主题色只连接当前视图、主操作、焦点与选中，大部分界面保持无彩。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成全部实际 Brand Token。所有真实页面先继承纯白画布、无彩灰阶、弱边界、大圆角、轻字重和基础控件语言，再按内容契约选择无卡底摘要、命令工具条、媒体对象卡与等高网格。不得为复刻代表性构图新增指标、对象、媒体、搜索或筛选；主题色只替换焦点色相，不改变白场、媒体安全区、对象优先层级和栅格稳定机制。

### 交付自检

- [ ] 全部页面内容和模块是否来自 PRD，而非模板来源？
- [ ] 摘要带是否共享白场并使用细竖分隔，而非独立重卡？
- [ ] 命令工具条是否只包含真实操作，并保持主输入弹性伸展、其余控件等高？
- [ ] 对象卡是否使用低对比媒体舞台、居中 contain、统一安全区和底部文字带？
- [ ] 卡内状态锚点是否具有真实语义，弱圆点是否没有伪装成交互控件？
- [ ] 对象网格是否等宽等高、自适应列数、自然形成末行且没有瀑布流？
- [ ] 每个视觉记忆组件是否都有 `content_contract`、`render_policy`、迁移目标和无匹配回退策略？
- [ ] 固定列数、摘要数量、工具组合和模块顺序是否具有内容契约，而非全页面硬规则？
- [ ] 未被 PRD 触发的组件是否没有强行渲染，视觉迁移是否没有新增业务内容？
- [ ] 主操作、当前视图、选中和焦点是否共享 `--color-brand1-6`，其余表面保持中性？
- [ ] 真实媒体是否保持原色，未被主题滤镜或随机取色影响？
- [ ] `application-global` 的变量名和消费语义是否稳定，具体值是否依据本主题生成？
- [ ] `custom-page` 是否通过全局语义复用检查，没有同值同义或角色重叠的重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、视觉 DNA、组件标题和正文总结是否没有绑定默认色相或页面类型？
- [ ] 描述中的宽松、低对比、大圆角、轻量和对象优先是否与 Token 及正文一致？
- [ ] 是否没有建立适用/不适用产品形态清单，所有页面是否共享全应用 Token 和基础组件语言？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在的页面，没有枚举不存在的页面？
- [ ] 主题同色演变是否由 `--color-brand1-6` 派生，平台状态语义色是否未在 `custom-page` 重复声明？
- [ ] 所有灰色 Token 是否已分类；`neutral-gray` 是否满足三通道相等，`theme-gray` 是否声明基底、比例和实例化要求？
- [ ] 同类卡片是否等高，媒体区是否固定，长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引发布局跳动？
- [ ] 移动端折叠、触控目标、键盘访问、对比度、非纯颜色状态与 reduced motion 是否达标？
- [ ] 最终项目 `design.md` 是否替换全部占位符并写入七个 Brand Token 的实际色值？
