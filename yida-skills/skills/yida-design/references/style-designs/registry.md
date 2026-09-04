# style-design 风格注册表

本目录为完整应用的 `prd/<项目名>/design.md` 提供内置设计风格注册表。生成 `design.md` 时必须先判断内容兼容性，再根据视觉策略选择唯一风格，并把对应 `style-designs/*.md` 记录为 `baseDesignSource`，最后结合主题色和当前 PRD 生成最终自包含的视觉设计契约。

`_design-md-template.md` 仍是结构参考文件；它不参与视觉风格选择。实现阶段只读取当前项目的 `prd.md` 和 `design.md`，不回读本目录。

默认审美方向是“圆润、高密且有呼吸感”：卡片 padding 默认 22-28px 且必须大于 20px，卡片与卡片的 gap 默认 12-18px 且必须小于 20px，卡片圆角范围 0-32px，控件使用 10-14px 圆角，状态摘要、动作条、列表行和空态保持紧凑；页面主区、右栏、工具条和列表之间要有稳定分组节奏。呼吸感不是大留白；不得用额外 margin、超高空态或超宽空状态框撑出页面面积。

## 基础文件

| 文件 | 类型 | 用途 | 使用规则 |
| --- | --- | --- | --- |
| `_design-md-template.md` | structure-template | `design.md` 完整结构和字段完整度参考 | 必读；最终产物章节和字段完整度必须对齐它 |

## 可选设计风格

| 风格文件 | 视觉策略 | 可承载内容 | 强选择触发 | 近邻边界 |
| --- | --- | --- | --- | --- |
| `soft-analytic-workbench.md` | `soft_neutral` 均衡办公 | 指标、轻图表、右侧辅助列表、明细表、普通入口 | 用户明确需要低噪声、均衡、朴素办公感；所有模块视觉优先级接近 | 通用兜底，有泛化惩罚；若需要重点舞台、趋势洞察、行动队列、常驻右栏或规整边框，应输给对应风格 |
| `soft-bordered-analytic-workbench.md` | `bordered_enterprise` 规整控制台 | 命令栏、深色摘要区、图表洞察、分区明细 | 页面需要边界清晰、系统化、控制台感，搜索筛选和全局命令是稳定入口 | 若只是均衡办公输给 `soft-analytic`；若深色舞台是主记忆点输给 `dark-stage` |
| `soft-modular-analytic-workbench.md` | `bordered_enterprise` 模块化复杂工作台 | 多模块、多指标、趋势、洞察卡、明细表 | 页面模块很多，需要规整网格和混合尺度承载，不希望单一大舞台主导 | 若模块少且均衡输给 `soft-analytic`；若趋势图是主视觉输给 `blue-insight` |
| `soft-progress-analytics-workbench.md` | `progress_narrative` 进度分析 | 优先级指标、周期节点、趋势、明细表 | 阶段、周期、进度是核心体验，但整体仍偏分析工作台 | 若没有阶段推进语义输给非进度风格；若服务资源和媒体上下文更强输给 `aqua-service` |
| `soft-timeline-analytics-workbench.md` | `progress_narrative` 时间轴工作台 | 指标栈、时间轴、趋势、明细表 | 时间轴本身是页面骨架，用户需要按阶段/里程碑阅读 | 若时间轴只是辅助提示输给 `soft-progress` 或非进度风格 |
| `teal-rail-analytics-workbench.md` | `teal_fresh_rail` 常驻洞察右栏 | 左侧主工作区、右侧洞察栏、标签筛选、明细表 | 右侧洞察栏是持续结构，用于提醒、排名、状态、上下文，而非普通补充列表 | 若右栏只是辅助列表输给 `soft-analytic`；若行动队列更强输给 `blue-productivity` |
| `dark-stage-analytic-dashboard.md` | `dark_accent_stage` 局部深色重点舞台 | 指标、图表、表格、待办、右侧上下文 | 浅色页面中需要一个强记忆点，突出核心判断、风险、目标完成度或经营结果 | 不要求用户明确说深色；若只是全模块均衡扫描输给 `soft-analytic`，若命令处理更强输给 `contrast-command` |
| `contrast-command-analytics-workbench.md` | `action_command` 高对比指挥 | 大标题、表现图、事件流、深色命令面板、媒体化明细 | 页面需要指挥感、推荐处理、助手面板、日程协同或高能量主操作 | 若只是待办列表输给 `blue-productivity`；若只是核心指标舞台输给 `dark-stage` |
| `blue-productivity-insight-workbench.md` | `action_command` 生产力行动队列 | 指标、柱状图、右侧行动栏、记录表 | 指标之后立刻驱动今日处理、待办、跟进、确认、分派等动作 | 若主图表洞察更强输给 `blue-insight`；若右栏是洞察而非行动输给 `teal-rail` |
| `aqua-service-progress-dashboard.md` | `progress_narrative` 服务进度 | 状态头、时间轴、进度评分、渐变状态卡、媒体/上下文卡 | 服务、资源、场地、设备、交付进度或上下文媒体共同构成体验 | 若是密集后台或纯表格处理输给工作台风格；若只是阶段管理输给 timeline/progress 风格 |
| `blue-insight-operations-dashboard.md` | `blue_insight` 趋势洞察 | 火花线指标、主趋势图、洞察卡、活动表、进度列表 | 主要记忆点是趋势、分析、经营洞察，图表不只是轻量状态分布 | 若数据不足以支撑趋势图输给 `soft-analytic`；若行动队列更强输给 `blue-productivity` |
| `green-timeline-progress-workbench.md` | `progress_narrative` 清爽阶段推进 | 主摘要指标栈、浮动日期时间轴、趋势图、全宽表格 | 阶段推进明确，同时希望气质更清爽、轻运营、低压 | 若没有时间/阶段语义输给非进度风格；若需要更中性时间轴输给 `soft-timeline` |
| `filterable-card-catalog.md` | `catalog_browse` 高密筛选目录 | 左筛选栏、结果工具条、条件胶囊、等高卡片矩阵 | 主体验是搜索、筛选、比较、选择对象；卡片比表格更适合承载结果 | 若只是工作台里的辅助筛选输给 analytic 风格；若需要大图陈列输给 `soft-curated-filter-gallery` |
| `soft-curated-filter-gallery.md` | `catalog_browse` 视觉精选画廊 | 大标题、分类切换、柔和筛选、大图卡片、收藏/徽标 | 主体验是视觉浏览、候选挑选、精选展示，图片或视觉对象重要 | 若需要高密管理和批量操作输给 `command-filter-card-console` 或 `filterable-card-catalog` |
| `command-filter-card-console.md` | `catalog_browse` 管理型卡片控制台 | 边框筛选、状态标签、紧凑管理卡片、分页 | 主体验是对象管理、状态筛选、批量查看，卡片是管理单元而非展示物 | 若偏视觉陈列输给 `soft-curated-filter-gallery`；若偏普通结果浏览输给 `filterable-card-catalog` |

## 消费硬规则

1. 先读取 `_design-md-template.md`，按当前业务生成新的 `prd/<项目名>/design.md`。
2. 每次优先选择唯一设计风格，并把对应 `style-designs/*.md` 写入 `baseDesignSource`；若所有内置风格都不适合，才写 `generated-from-business-context`，并记录排除原因。
3. 配色由模型根据行业、品牌、应用主题、业务情绪和用户偏好生成；主题色只换 token 和强调色，不改变风格 DNA、布局机制和组件机制。
4. 圆角、间距、密度和呼吸感必须由当前业务决定，但卡片数值要明确：卡片 padding >20px、卡片间 gap <20px、卡片圆角 0-32px、控件 10-14px、状态摘要 64-88px、列表行 44-56px、空态 88-120px 内。
5. `design_id` 使用当前项目生成的 slug，例如 `<业务域>-<体验关键词>-generated`。
6. 每个自定义页面最终只读取当前项目 `prd.md` 和 `design.md`；实现阶段不回读本目录。

## 选择原则

1. 先从业务需求判断内容兼容性，再推演视觉策略、视觉强调、密度气质和交互重心；不要按行业、主题色或公共内容组件直接选风格。
2. 主题色只作为所选风格的 `theme_adaptation` 输入，用于替换强调色 token；主题色不是选择风格的主要依据。
3. 指标卡、图表、表格、待办、筛选器、右侧栏、状态标签、快捷入口、时间线等公共组件只用于判断 `contentCompatibility`，不得作为风格强匹配理由。
4. 每次必须选择唯一设计风格，并把对应 `style-designs/*.md` 写入 `baseDesignSource`。若所有内置风格都不适合，仍读取 `_design-md-template.md` 输出 `baseDesignSource=generated-from-business-context`，并在 `styleDesignSelection.rejectedStyleDesigns` 说明原因。
5. 不得为了套风格凭空创造 PRD 未要求的图表、右侧栏、时间轴、深色舞台或快捷入口；风格只能决定已有业务内容的视觉承载方式。
6. `dark-stage-analytic-dashboard` 是局部深色重点舞台，不是全页面深色沉浸。不得仅以“用户未要求深色”为理由拒绝它；只能在页面不需要强视觉焦点时拒绝。
7. `soft-analytic-workbench` 是 `soft_neutral` 均衡办公风格，不是所有工作台的默认答案。选择它时必须在内部选择草稿中确认其他更强视觉策略证据不足。
8. 最终 `design.md` 必须自包含：包含风格来源、选择依据、主题换肤结果、视觉 DNA、token、组件、状态、响应式、可访问性和实现契约。

## 选择评分建议

| 维度 | 权重 | 判断方法 |
| --- | --- | --- |
| 视觉策略匹配 | 45% | 页面需要 `soft_neutral`、`dark_accent_stage`、`blue_insight`、`bordered_enterprise`、`teal_fresh_rail`、`action_command`、`progress_narrative` 还是 `catalog_browse` |
| 视觉强调与密度 | 15% | 首屏是均衡扫描、核心舞台、趋势洞察、行动队列、常驻右栏、阶段推进还是目录筛选；密度是高密、规整、舒展还是展示型 |
| 布局兼容性 | 15% | 当前页面是否能稳定承载该风格的舞台、右栏、命令栏、进度骨架、目录网格或趋势面板 |
| 内容兼容性 | 15% | 风格是否支持当前已有指标、图表、表格、待办、筛选、右栏、时间线、卡片和媒体内容 |
| 多样性或用户偏好 | 10% | 用户语气、品牌气质、应用主题和候选分差接近时，避免所有工作台都落到 `soft-analytic-workbench` |
| 风险扣分 | -5% | 是否会强行制造不存在的模块、过度依赖图表、右侧栏、时间轴、深色舞台或图片素材 |

内容兼容性和布局兼容性合计不得超过 30%。如果多个风格都能承载相同内容，必须让视觉策略、视觉强调和近邻边界决定最终选择。

## 输出记录

生成 `design.md` 前必须先形成内部选择草稿，用来防止公共组件误导风格选择。内部选择草稿不写入最终 `design.md`，除非用户要求调试或评估选择过程。

```yaml
selectionScratchpad:
  topCandidates:
    - name: <style-name>
      evidence: <短句或枚举，不写长解释>
  rejectedCloseNeighbors:
    - name: <style-name>
      evidence: <短句或枚举>
  softAnalyticCheck:
    strongerVisualStrategyExists: <true / false>
    result: <select_soft_analytic / choose_stronger_strategy>
```

最终 `design.md` 只记录可交接给实现阶段的精简选择摘要：

```yaml
baseDesignSource: references/style-designs/<selected-style>.md
styleDesignSelection:
  inferredUserTask: <判断 / 处理 / 追踪 / 分析 / 展示 / 汇报>
  contentCompatibility:
    supports: [<metrics / charts / tables / todos / filters / side_panel / timeline / catalog_cards / media_cards>]
    commonComponentsAreWeakSignals: true
  layoutCompatibility: <balanced_workbench / stage_workbench / rail_workspace / command_console / insight_dashboard / progress_narrative / catalog_grid>
  visualStyleIntent: <soft_neutral / dark_accent_stage / blue_insight / bordered_enterprise / teal_fresh_rail / action_command / progress_narrative / catalog_browse>
  visualEmphasis: <均衡扫描 / 核心舞台 / 趋势洞察 / 行动队列 / 常驻右栏 / 阶段推进 / 目录筛选>
  requiredVisualDNA:
    - <dna-id>
  selectedStyleDesign:
    name: <style-name>
    source: references/style-designs/<style>.md
  implementationConstraints:
    - <必须保留的视觉约束，例如局部深色舞台 / 常驻右栏 / 行动队列 / 大趋势面板>
  selectionNotes: <可选，一句话以内；默认省略>
  selectionConfidence: <high / medium / low>
```

## 新增风格规则

新增 `style-designs/*.md` 时，必须包含：

- front matter 中的 `template_type: visual_dna_preset`。
- `selection.best_for`、`selection.user_intent`、`selection.visual_tone`、`selection.avoid_for`。
- registry 中必须为新风格补充 `视觉策略`、`可承载内容`、`强选择触发` 和 `近邻边界`，避免只写宽泛适用场景。
- 2-5 个可稳定复用的 `visual_dna`，每个 DNA 要有 `id`、`hooks`、`invariant`、`variable`。
- `theme_adaptation`，明确 `replace_tokens`、`derive_tokens`、`preserve_tokens` 和换肤规则。
- `quality_anchors`、`layout_stability`、`components` 和 `modules`，让最终 `design.md` 能抽取为可实现规则。
