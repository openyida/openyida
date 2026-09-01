# 生成 design.md 规则

本文件用于为完整应用提供一份应用级 `prd/<项目名>/design.md` 生成规则。生成 `design.md` 时必须先从业务上下文判断内容兼容性，再推演视觉策略，选择唯一设计风格，最后按主题色适配所选风格并输出自包含的视觉设计契约。

业务对象、字段、表单、流程、导航、权限和页面结构都从当前 PRD 读取；内置风格只提供视觉 DNA、布局机制、组件机制、质量锚点和主题换肤规则，不提供业务内容。指标卡、图表、表格、待办、筛选器、右侧栏、状态标签、快捷入口、时间线等常见内容组件只能判断风格是否可承载，不得作为设计风格的强匹配理由。
`style-designs/_design-md-template.md` 是最终结构参考，只约束章节结构、字段完整度和描述粒度；内置 style-design 风格只提供可复用视觉母体。真实项目的配色、业务内容、资源关系、页面结构和实现交接必须从当前 PRD、应用主题和用户要求生成。

## 何时使用

| 页面类型 | 动作 |
| --- | --- |
| 工作台 / 门户首页 / 首页 | 选择工作台类设计风格，生成 workbench 场景配方，把当前业务的视觉 DNA 落到首屏、指标、入口和侧栏 |
| 列表 / 管理页 / 处理台 | 选择能承载筛选、列表、详情抽屉和状态标签的设计风格，生成 list 场景配方 |
| 看板 / 驾驶舱 / 经营分析 | 选择能承载指标、图表、排行、异常和管理层摘要的设计风格，生成 dashboard 场景配方 |
| 官网 / 品牌页 / 落地页 | 当前 analytic workbench 风格通常不适合；按当前业务价值路径、素材清单、CTA 和 `assetStrategy` 生成 landing 场景配方 |
| 普通表单 / 流程表单 | 沿用应用级 `design.md` 的主题和平台原生表单，不单独选择设计文件 |

## 输入

从 Step 1-4 产物中提取：

| 信号 | 示例 |
| --- | --- |
| 用户任务 | 判断状态、处理待办、追踪阶段、分析趋势、管理明细、展示成果、汇报经营 |
| 业务对象 | 订单、客户、库存、项目、任务、审批、线索、合同、员工、门店 |
| 内容兼容性 | 当前页面是否需要指标、图表、表格、待办、筛选、右侧栏、时间线、卡片目录、媒体卡片 |
| 布局兼容性 | 均衡工作台、重点舞台、右栏工作区、指挥台、趋势看板、进度叙事、目录网格 |
| 视觉策略 | 柔和办公、深色重点舞台、蓝色洞察、规整边框、清爽右栏、高能指挥、进度叙事、目录浏览 |
| 视觉强调 | 所有模块均衡、核心指标强强调、行动队列强强调、趋势图强强调、右侧洞察强强调、目录筛选强强调 |
| 交互重心 | 搜索筛选、待办处理、下钻详情、多入口跳转、趋势比较、异常处置 |
| 数据形态 | KPI、队列、趋势、排行、明细表、日程、快捷入口、预警、阶段节点 |
| 页面区块 | 顶部概览、搜索筛选、表格、图表、右侧详情、表单入口、空态 |
| 主题证据 | 用户指定品牌、当前应用主题、工作区主题、业务气质、是否页面级沉浸或应用导航隐藏 |
| 圆角、密度与呼吸感 | 默认圆润高密且有呼吸感；卡片 padding >20px，卡片间 gap <20px，卡片圆角 0-32px，控件 10-14px，状态摘要 64-88px，列表行 44-56px；区块间距用于分组和扫读，不用于撑空白 |

## 选择流程

1. 读取 [style-designs/registry.md](style-designs/registry.md)，了解可选设计风格和选择规则。
2. 读取 [style-designs/_design-md-template.md](style-designs/_design-md-template.md)，用它作为最终 `design.md` 的结构基准。
3. 从业务上下文推演 `inferredUserTask`、`contentCompatibility`、`layoutCompatibility`、`visualStyleIntent`、`visualEmphasis` 和 `interactionFocus`。用户通常不会主动描述视觉风格，agent 必须自行推演。
4. 先用内容组件做兼容性筛选：设计风格必须能承载当前页面已有内容，但不得因为“有指标卡 / 有图表 / 有表格 / 有右侧栏 / 有时间线”等公共组件直接胜出。
5. 再用视觉策略选择风格：判断页面需要柔和均衡、重点舞台、趋势洞察、行动指挥、常驻右栏、规整边框、进度叙事、目录浏览还是视觉陈列。
6. 对 registry 中的风格做硬过滤：纯表单、长文、品牌营销、移动端单任务等页面不选择明显不合适的分析工作台风格。不要因用户未明确说“深色”而过滤 `dark-stage-analytic-dashboard`；它是浅色画布上的局部深色重点舞台，不等于全页面深色沉浸。
7. 按 `视觉策略 45% + 视觉强调与密度 15% + 布局兼容性 15% + 内容兼容性 15% + 多样性或用户偏好 10%` 选择唯一风格。内容和布局合计不得超过 30%，避免常见工作台内容把结果塌缩到通用风格。
8. 做内部近邻比较：生成 `design.md` 前必须在工作记忆中比较最相近的 2-4 个风格；选择 `soft-analytic-workbench` 时必须确认其他更强视觉策略证据不足。近邻比较是选择校验，不默认写入最终 `design.md`。
9. 读取被选中的 `style-designs/*.md`，抽取 `visual_dna`、`theme_adaptation`、`layout_stability`、`quality_anchors`、`components` 和 `modules`。
10. 根据 Step 2 的主题色来源和主题色输入，按所选风格的 `theme_adaptation` 执行换肤：替换 `replace_tokens`，派生 `derive_tokens`，保留 `preserve_tokens` 和 `visual_dna.invariant`。
11. 读取 [visual-scaffold-recipes.md](visual-scaffold-recipes.md)，把当前页面组合映射到统一 `visualScaffold` 规则。
12. 读取 [page-quality-gates.md](page-quality-gates.md)，把质量门禁补进 `acceptanceChecks`。
13. 需要判断详略时参考 `_design-md-template.md` 的字段粒度、registry 的输出记录和所选风格的质量锚点；只学习“写到多细”，不复制示例业务、色盘、字段、页面顺序或组件组合。
14. 根据行业、品牌、业务情绪、应用主题和用户偏好生成配色。不要固定使用蓝色、绿色、紫色或任何预置色，也不要复用历史样例色盘。
15. 写入 `densityRule`、`breathingRule`、`spacing` 和 `rounded` 的具体数值。默认业务工具页使用 high density + 圆润形状 + 有呼吸感的分组节奏：页面边距 20-28px，卡片与卡片 gap 12-18px 且必须小于 20px，卡片 padding 默认 22-28px 且必须大于 20px，卡片圆角范围 0-32px；只有品牌展示、官网或用户明确要求舒展时才降低密度。
16. 写入 `surfaceContrast`：页面背景与卡片背景必须形成明显层次对比，不可相近或相同；默认浅色背景保持清爽，但必须按“白色/浅色背景 + 有边框卡片、浅灰背景（如 `#F3F4F6`）+ 白色无边框卡片、浅彩色背景 + 白色无边框卡片、渐变背景 + 玻璃感卡片”四类方案选择。
17. 写入 `emptyStateRecipe` 和 `acceptanceChecks`：空态必须是薄行、面板内提示或右侧上下文，不使用 160px 以上大白卡；状态摘要不能是横跨整页且内容稀疏的空矩形。
18. 如果平台导航可见，页面主按钮、链接、选中态、重点标签和图表主序列默认跟随应用主题；自定义色盘只能作为辅助色、浅背景、图表第二序列或页面级独立主题。

## 内容兼容与视觉策略

公共内容组件只判断风格是否可承载，不决定最终风格。最终设计风格必须由视觉策略、视觉强调和近邻比较决定。

| 常见内容信号 | 只能用于判断 | 不得直接推出 |
| --- | --- | --- |
| 指标卡 / KPI | 是否需要状态摘要、核心舞台、趋势入口、行动队列入口 | `soft-analytic-workbench` |
| 图表 | 是否需要轻量分布、大趋势图、进度图、纹理化洞察 | dashboard 风格 |
| 表格 / 明细 | 是否需要主工作区、详情沉淀、搜索结果、记录日志 | analytic 风格 |
| 右侧栏 | 是辅助上下文、常驻洞察栏还是行动队列 | rail 风格 |
| 时间线 / 阶段 | 是核心叙事骨架还是普通进度提示 | timeline 风格 |
| 筛选器 / 标签 | 是主导航还是表格辅助条件 | catalog 风格 |

| 视觉策略 | 适用判断 |
| --- | --- |
| `soft_neutral` | 低噪声、均衡、朴素办公感；没有强主舞台、强趋势、强指挥或强目录诉求 |
| `dark_accent_stage` | 浅色页面中需要一个局部深色重点舞台，突出核心判断、风险、目标或经营结果 |
| `blue_insight` | 需要更强分析感、趋势感、数据洞察感，主图表或趋势面板应成为记忆点 |
| `bordered_enterprise` | 需要规整、边界清晰、系统化的管理后台气质 |
| `teal_fresh_rail` | 需要清爽、服务感或常驻右侧洞察栏，右栏是页面稳定结构而非临时补充 |
| `action_command` | 需要今日行动、命令入口、推荐处理、任务队列或高能量指挥感 |
| `progress_narrative` | 需要阶段推进、周期节奏、服务进度或里程碑叙事 |
| `catalog_browse` | 需要以筛选、比较、挑选、卡片目录或视觉浏览作为主体验 |

选择 `soft_neutral` / `soft-analytic-workbench` 时必须满足：其他视觉策略都没有更强证据。它是均衡办公风格，不是所有工作台的默认答案。

## 主题色应用规则

主题色是所选设计风格的换肤输入，不是重新选择视觉风格的理由。生成 `design.md` 时必须先读取所选风格的 `theme_adaptation`，将主题色应用到 `replace_tokens` 和 `derive_tokens`，保持 `preserve_tokens` 与 `visual_dna.invariant` 不变。

硬规则：

1. 换 hue，不换 DNA。
2. 换 token，不换结构。
3. 换强调色，不改画布、面板、中性色、布局机制。
4. 平台导航可见时，页面主按钮、链接、选中态、重点标签和图表主序列默认跟随应用主题 `--color-brand1-*`。
5. 风格默认色只在没有任何主题证据时作为 `template-default` 兜底，并必须写入 `themeProfile.themeColorSource`。

## 主题关系判定

| 场景 | 主题关系写法 | 落地规则 |
| --- | --- | --- |
| 平台导航 / 应用菜单可见 | `跟随应用主题` | 主按钮、链接、选中态、重点标签、图表主序列使用应用主题；风格色相仅作为辅助色、浅背景、图表第二序列或装饰色 |
| 生成色盘与应用主题不同 | `应用主题主导，生成色彩作为辅助色` | 保留所选风格的视觉 DNA、布局、密度和组件语言，不把页面主色改成与应用主题冲突的色相 |
| 用户要求全局换肤 / 导航也一起变色 | `应用级换肤` | 输出 `themeScope=app`，实现阶段更新应用主题或壳层主题；自定义色盘写 `customThemeStyle.tokens` |
| 页面级沉浸页、应用导航隐藏后的自绘壳、独立品牌页、活动页、公开落地页 | `页面级独立色盘` | 输出 `themeScope=page` 和独立色盘原因，页面内注入 `style#yida-global-theme` 或 scoped CSS vars |

## 输出字段

`design.md` 是应用级视觉设计契约，PRD 的每个自定义展示页只引用它：

| 字段 | 写入位置 | 写法 |
| --- | --- | --- |
| baseDesignSource | design.md | `references/style-designs/<selected-style>.md`；所有内置风格不适用时才写 `generated-from-business-context` |
| styleDesignSelection | design.md | 只记录风格来源、视觉策略、视觉强调、选中风格、实现约束和置信度；候选比较和排除理由默认不写入 |
| themeAdaptationResult | design.md | 记录输入主题色、换肤策略、替换 token、保留 DNA 和保留机制 |
| designFile | PRD pageSpecHandoff | `prd/<项目名>/design.md` |
| designRefs | PRD pageSpecHandoff | 当前页面引用 design.md 的章节 ID |
| 风格理由 | PRD 页面章节 | 一句话说明为什么适合当前页面任务；不复制完整视觉规则 |
| 视觉 DNA | design.md | 所有页面都必须保留的 2-5 个视觉 DNA |
| 页面区块 | PRD 页面章节 | 当前业务页面实际需要的区块 |
| 主题关系 | design.md + PRD 摘要 | 默认写“跟随应用主题”；若生成色相不同，写“应用主题主导，生成色彩作为辅助色”；只有独立页面才说明页面级独立色盘原因 |
| visualScaffold | design.md | layoutRecipe、surfaceMap、sectionRhythm、densityRule、breathingRule、componentRecipe、emptyStateRecipe、acceptanceChecks |
| rounded / spacing / breathing | design.md | 大圆角、紧凑间距和呼吸节奏的具体数值，不能只写“圆润”“留白舒适”“有呼吸感” |

## 实现交接

实现阶段读取 PRD 中的 `designFile/designRefs`，再读取当前项目 `design.md`，并按以下方式落地：

| design.md 内容 | 实现落点 |
| --- | --- |
| styleDesignSelection | 理解视觉母体来源和禁止偏移点；实现阶段不再回读风格目录 |
| themeAdaptationResult | CSS token、按钮、链接、选中态、图表辅助色和运行时主题注入 |
| 视觉 DNA | 首屏、指标、列表、图表、侧栏、状态标签 |
| 布局配方 | 页面栅格、区域顺序、区块比例 |
| 组件规则 | 卡片、表格、按钮、筛选、抽屉、标签 |
| 状态规则 | 空态、加载、错误、无权限、禁用、选中 |
| visualScaffold | 实现阶段先按槽位填业务内容，再写样式；任何页面实现不得跳过 |
| rounded / spacing / densityRule / breathingRule | 使用 `YidaCodeCanvas` 组件实现页面时的 CSS、antd token、列表行高、面板内距、卡片 gap、空态高度和首屏分组节奏；实现阶段必须保持卡片 padding >20px、卡片 gap <20px、卡片圆角 0-32px |

业务文案、字段、表单入口、流程处理、详情链接和导航顺序都从 PRD 读取；当前项目 `design.md` 提供所有页面必须遵守的视觉 DNA、布局、组件样式、主题 token 和状态规则。
