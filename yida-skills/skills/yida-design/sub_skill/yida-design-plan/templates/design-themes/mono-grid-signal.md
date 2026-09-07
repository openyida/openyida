---
name: "{{PROJECT_NAME}}"
description: "以点阵感等宽排版、浅灰模块框、矩阵式数值单元、中央输入舞台和斜纹数据纹理构成中等密度、理性且带轻复古数字感的结构主题。"
themeId: "mono-grid-signal"
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
      "--color-fill1-3": "#E6E6E6"
      "--color-fill1-10": "rgba(255, 255, 255, 0.97)"
      "--color-text1-4": "#171717"
      "--color-text1-10": "#666666"
      "--color-text1-3": "#929292"
    typography:
      base:
        "--font-family-base": "ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
      subhead:
        "--font-size-subhead": 24px
        "--font-weight-subhead": 600
        "--font-lineheight-subhead": 1.3
        "--font-letterspacing-subhead": 0.01em
      body-2:
        "--font-size-body-2": 16px
        "--font-weight-body-2": 600
        "--font-lineheight-body-2": 1.4
        "--font-letterspacing-body-2": 0.025em
      body-1:
        "--font-size-body-1": 14px
        "--font-weight-body-1": 400
        "--font-lineheight-body-1": 1.5
        "--font-letterspacing-body-1": 0.015em
      table:
        "--font-size-table": 14px
        "--font-weight-table": 400
        "--font-lineheight-table": 1.45
        "--font-letterspacing-table": 0.01em
      caption:
        "--font-size-caption": 12px
        "--font-weight-caption": 400
        "--font-lineheight-caption": 1.4
        "--font-letterspacing-caption": 0.025em
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
      "--oyd-pattern-surface": "AI 根据 --color-brand1-6 8% 与 #F3F3F3 92% 混合生成纹理浅底"
      "--oyd-rating-accent": "#F2A900"
      "--oyd-avatar-1": "#B98432"
      "--oyd-avatar-2": "#4D7058"
      "--oyd-avatar-3": "#B65B47"
      "--oyd-avatar-4": "#F0A112"
    typography:
      metric-primary:
        "--font-size-metric-primary": 34px
        "--font-weight-metric-primary": 500
        "--font-lineheight-metric-primary": 1.15
---

# {{PROJECT_NAME}} design.md

## 设计总览

- 业务领域：{{BUSINESS_DOMAIN}}
- 产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题来源：{{THEME_SOURCE}}
- 项目约束：{{PROJECT_CONSTRAINTS}}

本主题在近白画布上使用点阵感等宽字体、浅灰填充和 1px 中性边界，构成带轻复古数字气质的理性界面。信息层级由顶部状态横幅、矩阵式数值单元、中央命令输入舞台和纹理化图表建立；面板圆角克制、阴影几乎不可见，主要依靠边框与灰阶分层。主题色只参与主操作、焦点、链接和少量关键纹理，成功等状态沿用平台语义色；头像和评分等具有独立语义的颜色保持受控。页面整体中等密度，卡片内部留白适中，并通过拉伸网格、固定图表高度和面板内滚动保持稳定。

### 风格定位与应用说明

- 核心气质是系统化、精确、略带终端与点阵显示器韵味；真实内容包含运行状态、指标集合、会话式输入或结构化图表时最能发挥记忆点，但这不是页面类型限制。
- 所有页面共享本主题的全应用 Token 和基础组件语言；逐页视觉应用根据项目实际页面、页面模式和真实内容生成，视觉记忆点仅在满足内容契约时使用。
- 迁移时保留等宽字形、浅灰模块框、重叠圆形标识、矩阵指标、中央输入舞台和斜纹/点阵图表，不复制人员、时间、业务动作、数值或文案。
- 内容不匹配时，只把字体、边界、圆角、灰阶、纹理和交互迁移到既有槽位；无法承载的组件使用 `recipe_only`，新增会话或智能能力只能 `suggest_only`。

### 视觉 DNA

| 设计母体 | 可见证据与置信度 | 复用规则与实现钩子 | 缺失后的失败表现 |
| --- | --- | --- | --- |
| 点阵等宽信息语调 | 标题、标签、数字与控件普遍使用带机械节奏的等宽字，字母间距轻微拉开。`observed`，高置信度 | 全局等宽字体、等宽数字和受控字距不可变；真实语言、大小写与内容可变。使用全局 typography Token 与 `font-variant-numeric` | 退化为普通无衬线模板，主题最强身份消失 |
| 重叠标识状态横幅 | 一行浅灰长面板中，左侧圆形标识重叠，中部两级状态摘要，右侧深色操作。`observed`，高置信度 | 重叠圆形组、两级文本和右侧强操作的三段式构图不可变；数量、文本和操作由 PRD 决定。使用三列 grid 和负 margin | 退化为普通通知条，失去人员感与横向叙事 |
| 矩阵式数值单元 | 大面板内部以 3×2 紧凑小卡组织同类指标，数值居中突出，变化标签沉底。`observed`，高置信度 | 等尺寸矩阵、标签—数值—变化三段结构不可变；行列数与数据可变。使用 auto-fit grid 和卡内 flex | 退化为一排 KPI 或松散列表，模块密度和节奏失衡 |
| 中央命令输入舞台 | 右侧大面板由浅灰提示舞台和下方白色多操作输入区组成，发送动作以深色圆形聚焦。`observed`，高置信度 | 上下双层舞台、居中提示、宽输入区和圆形主提交不可变；能力、占位和附加操作由 PRD 决定。使用双行 grid 与 composer form | 退化为普通单行输入框，互动焦点消失 |
| 纹理化数据表面 | 柱图选中项使用深色与斜纹，未选柱保留浅轮廓；面积图内部为细密点阵或网格纹理。`observed`，高置信度 | 纹理只标识选中或数据面积、其余保持中性不可变；图形、序列和值可变。使用 repeating gradient、SVG pattern 和 clipPath | 退化为纯色默认图表，数字终端感和状态识别下降 |

### 视觉记忆点应用策略

| 视觉记忆组件或构图 | 内容契约 | 落地策略 | 可迁移机制与适配目标 | 无匹配内容时 |
| --- | --- | --- | --- | --- |
| 点阵等宽信息语调 | `content_contract`: 无额外业务要求，属于全应用基础视觉语言 | `render_policy: adapt_existing_slot`；`direct_trigger`: 任意真实文本与数值槽位 | `transferable_mechanism`: 等宽字、受控字距、等宽数字；`adaptation_targets`: 全部原生页面与自定义页文本 | `fallback`: 使用系统 monospace 回退栈；`forbidden`: 用图片字或不可访问位图替代文本 |
| 重叠标识状态横幅 | `content_contract`: 存在一组真实参与者/对象标识、总体状态和一个高优先级操作 | `render_policy: prd_match_only`；`direct_trigger`: 标识集合、摘要与操作同时存在 | `transferable_mechanism`: 重叠圆形组＋两级摘要＋贴右操作；`adaptation_targets`: `primary_summary`、状态通知、协作摘要 | `fallback`: 使用普通摘要区；`forbidden`: 编造人员、头像、状态或操作 |
| 矩阵式数值单元 | `content_contract`: 存在 3-8 个同层级数值及可选变化信息 | `render_policy: prd_match_only`；`direct_trigger`: 指标集合 | `transferable_mechanism`: 等尺寸矩阵、三段信息和浅描边小卡；`adaptation_targets`: `primary_metrics`、已有统计槽位 | `fallback`: 采用 PRD 原摘要形式；`forbidden`: 为填满矩阵新增指标或变化率 |
| 中央命令输入舞台 | `content_contract`: PRD 明确包含会话、指令、查询或多行提交能力 | `render_policy: suggest_only`；`direct_trigger`: 已有可提交的会话式输入任务 | `transferable_mechanism`: 上部提示舞台、下部 composer、圆形主提交；`adaptation_targets`: 已有 `form_fields`、命令输入或消息编辑区 | `fallback`: 没有能力时只输出产品建议；`forbidden`: 擅自新增智能能力、语音、附件或发送流程 |
| 纹理化数据表面 | `content_contract`: 存在真实柱、线、面积或分布数据，并需要强调选中点或数据面积 | `render_policy: adapt_existing_slot`；`direct_trigger`: 已有图表和明确选中/面积语义 | `transferable_mechanism`: 斜纹选中、点阵面积、浅轮廓未选态；`adaptation_targets`: `primary_content_panel`、现有图表 | `fallback`: 保留普通数据图并仅迁移灰阶；`forbidden`: 编造序列、选中状态、评分或时间轴 |
| 2/1 与三列拼图布局 | `content_contract`: 同时存在高权重双面板和三个可独立阅读的次级模块 | `render_policy: prd_match_only`；`direct_trigger`: 主内容对与次级内容组三者均存在 | `transferable_mechanism`: 上层近 1:1、下层窄/中/宽三列、同顶底线；`adaptation_targets`: `primary_content_panel`、`supporting_panel` | `fallback`: 按 PRD 回到单列或原网格；`forbidden`: 为保持拼图创建额外模块 |

- 先匹配 `content_contract`，再决定是否渲染组件本体；不能为了保留视觉记忆点而新增 PRD 未要求的字段、数据、入口、对象或流程。
- 每页优先清楚落地 1-3 个与 PRD 匹配的主记忆点，不要求全部组件同时出现。
- 无合法业务承载时保留为 `recipe_only`；若需要新增业务能力则使用 `suggest_only`，不进入默认实现。

### 设计变量范围

`tokens.application-global` 是原生表单、流程页面和自定义页面共同遵守的全应用设计契约；本主题通过等宽字体、轻字距、紧凑圆角、中性表面与清楚边界形成统一语言。`tokens.custom-page` 仅补充近白画布、主题派生纹理浅底、评分强调色、四枚真实标识分类色和大数值语义：纹理浅底是全局填充无法表达的主题派生材质；评分与标识色为独立语义，不承担状态；大数值是全局字体体系缺失的层级，因此均不与全局 Token 重复。

## 色彩

- 色彩来源：{{COLOR_SOURCE}}
- 颜色 Token 的名称和值以文档顶部 YAML 的 `tokens` 为唯一事实源；AI 可以根据主题调整色值，不改变宜搭应用全局变量名。
- 页面由 `--oyd-page-background`、白色面板和 `line1` 边界组成；浅灰只分隔区域，深色仅用于核心文字、深色操作和图表聚焦。

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
| 弱分隔、表格行线和图表辅助线 | `--color-line1-1` | 应用全局 |
| 控件、面板和小卡常规边界 | `--color-line1-2` | 应用全局 |
| hover、浅标签和弱背景 | `--color-fill1-1` | 应用全局 |
| 中性选中底与按下填充 | `--color-fill1-2` | 应用全局 |
| 图表未选表面和骨架 | `--color-fill1-3` | 应用全局 |
| tooltip、popover 和菜单表面 | `--color-fill1-10` | 应用全局 |
| 标题、核心数字、正文和主要图标 | `--color-text1-4` | 应用全局 |
| 表头、输入占位和次级标签 | `--color-text1-10` | 应用全局 |
| 时间、说明、坐标和元信息 | `--color-text1-3` | 应用全局 |
| 页面底层近白画布 | `--oyd-page-background` | 自定义页 |
| 斜纹、点阵和主题浅纹理表面 | `--oyd-pattern-surface` | 自定义页 |
| 真实评分图形的独立强调 | `--oyd-rating-accent` | 自定义页 |
| 真实等权标识的圆形底色 | `--oyd-avatar-1` 至 `--oyd-avatar-4` | 自定义页 |

`--color-brand1-6` 是唯一品牌色种子。最终项目实例化时必须把其余六枚 Brand Token 的生成期标记解析为实际色值；没有品牌色时以中等明度、满足对比的冷色作为锚点。换色后至少 88% 的画布、表面和边界保持中性，评分与标识分类色不参与主题推演。

### 本主题的配色约束

- `--color-white`、所有 `line1`、`fill1`、`text1` 均为 `neutral-gray`；固定 Hex 的 RGB 三通道相等。
- `--oyd-pattern-surface` 为 `theme-gray`：由 `--color-brand1-6` 占 8% 与中性基底 `#F3F3F3` 占 92% 派生；项目实例化时必须计算并写入实际值。
- `--oyd-rating-accent` 仅用于真实评分、等级或星标图形，不代替警告状态；单屏面积不超过 4%。
- `--oyd-avatar-1` 至 `--oyd-avatar-4` 是等权标识色，仅在真实对象需要区分且没有图片素材时使用；不能形成主题身份。
- 主题色只用于主操作、焦点、链接、选中和纹理浅底；成功、警告、错误与信息状态直接消费平台语义色，并配合文字、图标或方向符号。

## 字体与排版

- 全局使用 `tokens.application-global.typography.base` 的等宽字体栈；若项目提供合法的品牌点阵字体，由 `{{BRAND_ASSETS}}` 声明并置于同一回退栈首位。
- `page-title` 使用 `tokens.application-global.typography.subhead`：24px / 600 / 1.3 / 0.01em；普通页面不得新增超大展示标题。
- `panel-title` 使用 `tokens.application-global.typography.body-2`：16px / 600 / 1.4 / 0.025em；可使用大写处理，但不得改变真实专名的大小写。
- `content-title` 和正文使用 `tokens.application-global.typography.body-1`：14px / 400 / 1.5 / 0.015em。
- 表格使用 `tokens.application-global.typography.table`：14px / 400 / 1.45 / 0.01em；表头只提高到 600 字重。
- 辅助说明使用 `tokens.application-global.typography.caption`：12px / 400 / 1.4 / 0.025em。
- 大数值使用 `tokens.custom-page.typography.metric-primary`：34px / 500 / 1.15；全局字体体系没有大指标数字语义，因此独立补充，不用于页面标题。
- 数字启用 `font-variant-numeric: tabular-nums slashed-zero`，关闭上下文连字；数字、日期与时长保持稳定字宽。
- 标题单行省略，副文案最多两行；长单词允许安全断行；不对用户输入、姓名、品牌或多语言内容强制全大写。
- 图标采用 1.5-1.75px 线性描边、直线感轮廓和圆角端点；常规 18px、强调 20px，与等宽文字首行光学居中。

## 布局与间距

- 页面安全边距使用 `--s-4` 或 `--s-6`，主区块 gap 使用 `--s-6`，面板内边距使用 `--s-4`，小卡内边距使用 `--s-3` 或 `--s-4`，紧凑标签 gap 使用 `--s-2`。
- 内容最大宽度建议 1760px，居中并使用 `minmax(0,1fr)`；同层面板和小卡必须等高。
- 状态横幅内容契约满足时使用 `auto minmax(0,1fr) auto` 三列；标识组只占必要宽度，摘要可截断，操作不被压缩。
- 主内容对同时存在时，桌面使用近 1:1 两列；次级模块组同时存在时可使用约 22/38/40 三列，但两种布局都由内容契约触发。
- 页面标题、时间筛选、横幅、指标、输入舞台、图表与明细是否出现和顺序由 PRD 决定。

### 布局稳定性硬规则

- 桌面主网格使用 `align-items:stretch`；面板统一 `height:100%; min-width:0; min-height:0; display:flex; flex-direction:column`，标题区固定，内容区 `flex:1; min-height:0`。
- `metric_card` 建议高 168-200px；状态横幅建议高 112-136px；命令输入主视觉建议高 420-520px；`chart_panel` 高 300-360px；`detail_panel` 高 300-420px；可选 `quick_action_item` 高 72-88px。
- 指标矩阵、图表、列表和输入舞台都在面板内部处理溢出；图表定高，列表内部滚动，长文案截断，composer 输入区设置最大高度。
- 区块间距由父级 grid/flex gap 管理，不使用零散外边距拼接。
- ≥1280px：状态横幅三列，主内容近 1:1，次级模块按内容契约三列；960-1279px：主内容可保持 1:1 或堆叠，次级模块两列；<960px：全部单列，状态横幅操作移至下一行。
- <640px：指标矩阵两列或单列；命令输入舞台降低提示区高度；图表保持内部横向滚动；按钮保持 32/36/40px，触控目标最小 40×40px。
- 移动端可解除桌面等高，但保留同一内容契约、等宽排版、纹理状态、控件高度、截断和内部溢出。

## 表面与层级

- 页面底层使用 `--oyd-page-background`；一级面板使用白底、1px `--color-line1-2`、12-16px 圆角，不使用常规投影。
- 状态横幅和命令提示舞台使用 `--color-fill1-1`；指标小卡使用白底与 1px 常规边界；嵌套层最多两级。
- tooltip、popover 和菜单使用 `--color-fill1-10`、`--color-line1-2` 与 `0 8px 22px rgba(0,0,0,.07)`；深色提交按钮不投射辉光。
- 纹理只出现在选中数据、图表面积或极浅主题表面，不铺满面板；禁止玻璃模糊、强渐变、霓虹和厚重阴影。
- 面板间通过 24px gap 分层，内部通过 12-16px gap 分组；不为每段文字再套边框。

## 圆角与形状

- `--corner-1` 4px：纹理柱、微型色标与复选框。
- `--corner-2` 8px：小标签、状态胶囊、工具按钮和图表柱。
- `--corner-3` 10px：输入框、composer 和指标小卡。
- `--corner-4` 12px：常规一级面板与状态横幅。
- `--corner-5` 16px：命令输入主视觉或需要更强独立性的面板。
- `--corner-circle` 用于重叠标识、头像和圆形提交；`--corner-semicircle` 仅用于状态与趋势标签。
- 同一网格层级使用一致圆角；禁止随机使用超大胶囊或软糯圆角破坏机械节奏。

## 组件

### 按钮与操作

- 迷你或行内按钮 28px、紧凑工具栏 32px、常规按钮 36px、强调或宽松按钮 40px；图标按钮使用相应正方形档位。
- 主操作使用 `--color-brand1-6` 或由其派生的 `--color-brand1-5` 与白字；次操作使用白底、边界和一级文字。同一操作区只保留一个视觉主操作。
- hover 使用 `--color-brand1-1` 或 `--color-fill1-1`，active 使用 `--color-brand1-9` 或 `--color-fill1-2`；focus 显示 2px 主题色外环并留 2px 间隔。
- disabled 保留边界和可读文字，使用禁用色或中性填充，不只降低透明度；图标与文字间距 8px。

### 输入与筛选控件

- 紧凑工具栏 32px、常规表单 36px、宽松搜索和选择器 40px；不得出现其他高度。
- 控件使用白底或 `--color-fill1-1`、1px 常规边界和 `--corner-3`；placeholder 使用 `--color-text1-10`。
- focus 通过 2px 外环表达，不改变尺寸；error 同时显示平台错误色边界、图标和辅助说明。
- 开关与日期选择器以文字标签补足语义；composer 为多行输入，不受单行高度限制，但工具按钮仍遵守四档高度。

### 卡片与面板

- 一级面板使用 12-16px 圆角、16-24px 内边距和细边界；指标小卡使用 10px 圆角、16px 内边距。
- 标题区固定，标题与标签组间距 8px，标题区与内容区间距 16-24px；右侧扩展按钮不挤压标题。
- 只有独立、可交互或可复用的信息组才形成嵌套卡；普通文本与每条数据不额外套卡。

### 重叠标识状态横幅

- `content_contract`: 真实对象标识集合、总体状态、补充说明和一个高优先级操作；`render_policy: prd_match_only`。
- 横幅使用浅灰表面、12px 圆角和 24-32px 内边距；内部三列垂直居中。
- 圆形标识 40px，后续标识向前重叠 10px，并以 2px 页面底色描边分离；没有真实图片时才使用 `--oyd-avatar-1 / --oyd-avatar-2 / --oyd-avatar-3 / --oyd-avatar-4` 和首字母。
- 中部主行使用 body-2，副行使用 caption；右侧 36-40px 深色操作。小屏操作换行并铺满，不可替换成独立头像卡片阵列。

### 矩阵式数值单元

- `content_contract`: 3-8 个同层级指标及可选趋势；`render_policy: prd_match_only`。
- 容器内部使用 `repeat(auto-fit,minmax(180px,1fr))`；桌面优先 2-4 列，单元高 168-200px，间隙 16px。
- 单元采用“字距标签 / metric-primary / 状态标签”三段结构，数值左对齐，状态标签沉底。
- 状态标签消费平台语义色并同时包含方向符号或文字；hover 只加深边界，不产生投影。不可替换成一排大彩色卡。

### 中央命令输入舞台

- `content_contract`: PRD 已有会话、查询、指令或多行提交能力；`render_policy: suggest_only`。
- 外层一级面板中，上部提示舞台占 42%-50% 高度，使用浅灰表面并将短提示居中；下部白色 composer 占其余高度。
- composer 底部左侧放次级附加操作，右侧放辅助输入和 40px 圆形主提交；无对应能力时不显示这些操作。
- 多行输入最小高 120px、最大高 220px，超出内部滚动；提交按钮有可访问名称、loading 和 disabled 状态。
- 不可替换成单行搜索框，也不可为了视觉完整新增会话、语音、附件或智能生成能力。

### 纹理化数据表面

- `content_contract`: 已有图表且存在选中、对比或面积语义；`render_policy: adapt_existing_slot`。
- 选中柱使用 `--color-text1-4` 与由 `--oyd-pattern-surface` 参与的 45deg repeating-linear-gradient；未选柱使用白底、弱边界和极浅斜纹。
- 面积图使用 4-6px 点阵或细网格 SVG pattern，纹理裁剪在曲线以下；曲线保持 1.5-2px 实线，不使用辉光。
- tooltip 为白底小浮层，显示真实键值；键盘选择与 hover 共享同一选中纹理，不能只靠颜色。
- 不可把所有数据填成纹理；单图仅允许一个主要纹理焦点，其余序列保持中性或主题浅色。

### 图表或主内容面板

- 图表仅由 PRD 真实数据触发；弱辅助线复用 `--color-line1-1`，tooltip 复用 `--color-fill1-10`，主题色只用于关键焦点。
- 柱图、线图和分布图固定高 300-360px；坐标与图例使用 `--color-text1-3`，数值等宽。
- 评分分布若真实存在，可使用 `--oyd-rating-accent` 的短横条与星标；无评分语义时不得保留该组件。
- 无图表契约时，以列表、表格、表单或详情承载主内容，不编造序列和时间轴。

### 表格与列表

- 表头高 48px、数据行高 56-64px；表头和行使用中性边界，正文使用等宽字与等宽数字。
- 行 hover 使用 `--color-fill1-1`，selected 使用 `--color-brand1-3` 并配选择控件；状态同时有文字或图标。
- 标识或缩略图只在 PRD 提供真实素材时出现，建议 28-32px；尾部操作使用 28px 图标按钮并有可访问名称。
- 表体内部滚动、表头 sticky、长文本省略；加载骨架与真实行同高，避免面板和列宽跳动。

### 快捷入口（推断）

- 未形成独立快捷入口母体，因此不默认生成。若 PRD 明确存在 `quick_actions`，仅保留 `inferred / render_policy: recipe_only` 配方：白底细边界、方形线性图标、两级等宽文字、72-88px 固定高度。
- 数量建议 2-4 个；移动端单列；禁止默认彩色宫格，禁止为填满布局新增操作。

### 状态与交互

- 悬停：边界或浅底在 120-160ms 内变化，不引起尺寸或位置变化。
- 按下：使用品牌按下色或中性点击底，允许 `translateY(1px)`，不改变布局占位。
- 聚焦：控件、图表选中点和 composer 显示 2px 高对比 focus ring；纯图标按钮必须有可访问名称。
- 加载：保持横幅、指标矩阵、输入舞台和图表高度，使用稳定骨架与纹理占位。
- 空态与错误：保留标题、工具和面板结构，提供简短说明及下一步操作，不整卡染色。
- 禁用与选中：保留轮廓和文字；选中使用纹理、边界或图标共同表达，不只依赖颜色或透明度。
- 动效：颜色与边界 120-180ms，浮层 160-220ms；`prefers-reduced-motion` 下取消位移和图表补间。

## 项目应用

### 项目上下文与主题应用

- 当前产品形态：{{EXPERIENCE_TOPOLOGY}}
- 主题在当前项目中的应用说明：{{PRODUCT_TOPOLOGY_APPLICATION}}

产品形态只提供任务和内容上下文，不决定主题资格。原生页面和自定义页面共同继承等宽排版、灰阶、边界、圆角和交互；自定义页仅在内容契约成立时采用状态横幅、指标矩阵、命令输入舞台或纹理化数据表面。

### 页面模式

{{PAGE_PATTERN_SUMMARY}}

页面模式决定任务、内容和模块；本主题只规定视觉承载。单列、列表、表单、详情、流程或其他真实结构均应保留，不能为代表构图增设会话、指标或图表。

### 逐页视觉应用

{{PAGE_APPLICATIONS}}

实例化时仅展开项目真实存在的页面。每页说明 `page_identity`、`global_actions`、`primary_summary`、`primary_metrics`、`primary_content_panel`、`supporting_panel`、`detail_table`、`detail_list` 或 `form_fields` 等真实槽位的位置、跨度、建议高度、移动端顺序和采用的 1-3 个视觉 DNA；未匹配母体不渲染。

### 素材要求

- 已有品牌与真实素材：{{BRAND_ASSETS}}
- 素材缺口：{{ASSET_GAPS}}
- 图片、图表、缩略图、字体和辅助图形必须有真实来源；没有素材时使用系统等宽字体、结构化数据或中性占位，不编造人物、指标、对话、评分、图表或图片地址。

## 设计规范与禁忌

### 必须做到

- 无条件保护等宽点阵语调、近白画布、中性浅框、克制圆角、少阴影和小面积主题焦点。
- 状态横幅契约成立时保护重叠圆形组、两级状态摘要和右侧强操作。
- 指标契约成立时保护等尺寸矩阵、标签—数值—状态三段结构和稳定卡高。
- 命令输入契约成立时保护上下双层舞台、宽 composer 和圆形主提交；图表契约成立时保护单一斜纹焦点或点阵面积。
- 保护同类面板拉伸、固定图表高度、面板内溢出、完整状态、响应式与可访问性。

### 禁止项

- 禁止复制视觉材料中的业务内容，或让主题文件覆盖 PRD 的字段、模块、数据与优先级。
- 禁止把主题色铺满背景和普通卡片；禁止把评分色、标识色或默认深色当作主题身份。
- 禁止把固定 3×2 指标矩阵、1:1 主分栏、三列底部拼图或模块顺序写成所有页面硬规则。
- 禁止把全局等宽字替换成普通无衬线，把状态横幅拆成头像卡，把指标矩阵改成彩色 KPI 横排。
- 禁止无会话能力时生成命令输入舞台，或把纹理铺满所有数据与面板。
- 禁止瀑布流、自由高度同类卡、`align-items:start`、无固定高度图表、长内容撑破父级和零散 margin 拼接。
- 禁止玻璃模糊、霓虹、厚重阴影、过软圆角和组件库默认样式漂移。

### 错误与正确

- 错误：只给标题使用等宽字；正确：标题、正文、数字和控件共享全局等宽节奏，同时保护真实文本大小写。
- 错误：状态信息拆成多张对象卡；正确：使用重叠圆形标识、两级摘要和贴右操作形成单一横幅。
- 错误：同层指标自由大小排列；正确：内容契约成立时使用等尺寸矩阵和三段数据基线。
- 错误：用普通搜索框替代命令输入舞台；正确：已有会话能力时保留提示区、宽 composer 与圆形提交。
- 错误：所有柱和面积都铺斜纹；正确：只对选中柱或有效面积使用一个主纹理焦点。
- 错误：所有页面强制使用代表性拼图；正确：内容契约成立时使用分栏，否则保留 PRD 页面模式。
- 错误：主题色铺满页面；正确：主题色只连接主操作、关键焦点与选中，大部分表面保持中性。
- 错误：同类面板随内容自由增高；正确：网格拉伸、图表定高，长内容内部滚动或截断。
- 错误：快捷入口使用默认彩色宫格；正确：仅在 PRD 触发时使用细边界、方形图标和等宽文字。

### AI 使用提示

先读取 PRD，再解析 `{{PRIMARY_COLOR}}` 并生成七枚实际 Brand Token。所有真实页面先继承全应用等宽排版、灰阶、边界和基础组件，再按内容契约选择重叠标识状态横幅、矩阵式数值单元、中央命令输入舞台或纹理化数据表面。代表构图只是视觉配方，不用于创造参与者、指标、会话、附件、语音、评分、序列或操作；主题色只替换交互和纹理浅底的色相，不改变点阵语调、矩阵构图、密度、形状和纹理机制。字号与控件尺寸按平台 Token 范围推断，不把图片物理像素当作 CSS 像素。

### 交付自检

- [ ] 全部页面内容、字段和模块是否来自 PRD，而非模板来源？
- [ ] 全局文本和数字是否使用等宽栈、受控字距和稳定数字特性？
- [ ] 状态横幅是否在契约成立时保留重叠圆形组、两级摘要和贴右强操作？
- [ ] 指标集合是否在契约成立时保持等尺寸矩阵、三段结构和稳定高度？
- [ ] 命令输入舞台是否仅在已有会话能力时出现，并保留上下双层构图和可访问提交？
- [ ] 图表是否仅对选中或面积使用一个纹理焦点，并保留非纯颜色状态表达？
- [ ] 每个视觉组件及 2/1、三列布局是否都有 `content_contract`、`render_policy`、适配目标、回退与禁止项？
- [ ] 未被 PRD 触发的母体是否没有强行渲染，且未新增业务能力或假数据？
- [ ] 主操作、焦点和选中是否共享 `--color-brand1-6`，其余表面是否保持中性？
- [ ] 评分与标识色是否仅用于真实独立语义，平台状态色是否未重复定义？
- [ ] 固定灰色是否为三通道相等的 `neutral-gray`，`--oyd-pattern-surface` 是否按 8% 主题色与 92% `#F3F3F3` 计算并写入实际值？
- [ ] `application-global` 语义是否稳定，`custom-page` 是否没有同值同义或角色重复 Token？
- [ ] 文字对比是否保持 `text1-4` 高于 `text1-10`、`text1-10` 高于 `text1-3`？
- [ ] `themeId`、描述、DNA、组件标题和正文总结是否与默认色相及页面类型解耦？
- [ ] 同类面板是否等高、网格是否拉伸、图表是否定高、长内容是否在内部处理？
- [ ] hover、active、focus、loading、empty、error、disabled、selected 是否完整且不引起布局跳动？
- [ ] 三档以上响应式规则、移动端触控、键盘访问、非纯颜色状态与 reduced motion 是否达标？
- [ ] `{{PAGE_APPLICATIONS}}` 是否只展开项目真实存在页面，没有枚举不存在的页面？
- [ ] 最终项目实例化时是否替换全部占位符并把七枚 Brand Token 写为实际色值？
