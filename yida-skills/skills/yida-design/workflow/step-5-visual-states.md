# Step 5：UI 视觉和状态设计

> 这一步写 `design.md` 草稿。`design.md` 规定所有页面共同遵守的 UI 视觉、组件样式、状态样式和响应式规则。

## 1. 生成 design.md 基准系统

先为完整应用生成一套主设计契约，再为不同页面场景写局部变体。自定义展示页、工作台、列表管理页、处理台、看板和首页门户都遵守同一个 `prd/<项目名>/design.md`。

1. 读取 [design.md 生成规则](../references/style-design-selection.md)。
2. 读取 [style-design 风格注册表](../references/style-designs/registry.md)，再读取 `_design-md-template.md`。
3. 从 Step 1-4 产物推演 `inferredUserTask`、`inferredInformationTopology`、`interactionFocus` 和 `requiredVisualDNA`。用户通常不会主动描述视觉结构，agent 必须从业务对象、数据形态、页面区块和操作路径中推演。
4. 按 `业务任务匹配 30% + 信息拓扑匹配 25% + 视觉 DNA 命中 30% + 实现稳定性 10% - 风险扣分 5%` 选择唯一设计风格，并把对应 `style-designs/*.md` 记录为 `baseDesignSource`；纯表单、长文、品牌营销、移动端单任务、未要求暗色时要过滤明显不合适的风格。
5. 读取被选中的 style-design 风格文件，抽取 `visual_dna`、`theme_adaptation`、`layout_stability`、`quality_anchors`、`components` 和 `modules`。
6. 根据 Step 2 的主题色来源和主题色输入执行换肤：替换风格文件中的 `theme_adaptation.replace_tokens`，派生 `derive_tokens`，保留 `preserve_tokens` 和 `visual_dna.invariant`。主题色只换 hue，不换 DNA，不改结构。
7. 需要判断详略时读取唯一示例 `generated-business-design.example.md`；只学习结构和粒度，不复制示例业务、色盘、字段、页面顺序或组件组合。
8. 读取 [视觉脚手架配方库](../references/visual-scaffold-recipes.md)，把应用内各类页面映射到统一 `visualScaffold` 规则。
9. 读取 [页面质量门禁](../references/page-quality-gates.md)，把质量门禁补进 `acceptanceChecks`。
10. 写清 `roundedRule`、`densityRule` 与 `breathingRule` 的具体数值；默认业务页是圆润高密且有呼吸感，不得只写“圆润 / 舒适 / 留白合理 / 有呼吸感”。
11. 完整应用内默认保持同一套主设计系统；页面场景差异很大时，在同一份 `design.md` 里写页面场景变体，不为每个页面另起独立设计文件。

输出字段：

```markdown
- designFile：prd/<项目名>/design.md
- baseDesignSource：references/style-designs/<selected-style>.md；所有内置风格都不适用时才写 generated-from-business-context
- styleDesignSelection：<推演任务 / 信息拓扑 / requiredVisualDNA / 选中风格 / 排除风格 / 置信度>
- themeAdaptationResult：<输入主题色 / 换肤策略 / replaced tokens / preservedVisualDNA / preservedMechanisms>
- styleReason：<为什么适合当前应用和页面组合>
- Visual DNA：<所有页面都必须保留的 2-5 个视觉 DNA>
- sceneRecipes：<workbench/list/detail/dashboard/landing/screen 各自如何遵守同一 design.md>
- themeRelation：<继承当前应用主题 / 平台预置主题 / 应用自定义主题文件>
```

## 2. 写 UI 视觉规则

在应用级 `design.md` 中写清：

- 2-3 个气质关键词：稳重可信、轻盈现代、克制高端、温暖亲和、前沿科技等。
- 3-5 条业务专属设计原则：结合业务对象和用户任务写具体规则。
- 差异化 5 维：色彩、构图、密度、组件语言、动线；这些规则必须来自业务推演和所选风格视觉 DNA 的融合。
- 基础版式：全应用视觉锚点、区块节奏、密度、操作位置和响应式规则。
- `visualScaffold`：给所有页面实现使用的硬骨架，写清 `layoutRecipe`、`surfaceMap`、`sectionRhythm`、`densityRule`、`breathingRule`、`componentRecipe`、`emptyStateRecipe`、`responsiveSlots` 和 `acceptanceChecks`。这些字段属于 `design.md`，PRD 只引用。
- 默认业务工具页采用圆润高密且有呼吸感的规则：卡片 padding 默认 22-28px 且必须大于 20px，卡片与卡片的 gap 默认 12-18px 且必须小于 20px，卡片圆角范围 0-32px，控件 10-14px；状态摘要 64-88px，动作条 40-56px，列表行 44-56px，空态 88-120px 内。官网、品牌页或用户明确要求舒展时才放宽。

`visualScaffold` 的最低要求：

- `layoutRecipe` 写成明确版式，例如「左 2/3 主工作区 + 右 1/3 上下文栏」「上方紧凑摘要条 + 中部双列表 + 右侧提醒」。
- `surfaceMap` 写清每个区块的容器形态：无框区、细线面板、浅底条、表格、列表行、右侧栏、抽屉；不要全写卡片。
- `sectionRhythm` 写清区块间距、首屏主次和阅读顺序。
- `densityRule` 写清页面边距、卡片 gap、卡片 padding、状态摘要高度、列表行高和空态高度，避免靠额外 margin 或空白高度撑页面。
- `breathingRule` 写清主区/右栏/工具条/列表之间的呼吸节奏、组内内距、贴边修正和内容不足时的压缩/补充策略。
- `roundedRule` 写清业务面板、主面板、控件、标签、抽屉和弹层圆角；卡片圆角必须在 0-32px 范围内。
- `componentRecipe` 写清按钮、入口、标签、列表、图表和空态的具体形态。
- 源码槽位写清 `rootShell`、`prioritySurface`、`statusPrimitive`、`actionPrimitive`、`contentPrimitive`、`contextPrimitive`、`statePrimitive` 和 `responsiveRule`。
- 视觉层次写清 `backgroundLayer`、`surfaceMaterial`、`surfaceContrast`、`colorRoles` 和 `depthRule`；需要玻璃感时，明确半透明表面、`backdrop-filter`、细边框、柔和阴影和背景层。
- `backgroundLayer` 写清基础画布和推荐装饰方式，可选 `softTintCanvas`、`topIrregularWash`、`radialGlowWash`、`flowLight` 或 `organicNoise`。工作台、看板、门户、官网、登录页和空状态页推荐使用非纯空白的画布；如果选择近白画布，要说明渐变、细线、星芒、插图、局部光影或内容密度如何形成背景感。
- `surfaceContrast` 写清页面背景与卡片背景的层次搭配：白色/浅色背景配有边框卡片，浅灰背景（如 `#F3F4F6`）配白色无边框卡片，浅彩色背景配白色无边框卡片，渐变背景配玻璃感卡片；禁止背景和卡片相近或相同。
- 不规则背景只作用于页面壳、顶部首屏、功能引导卡或空状态安全区；内容布局继续使用规则栅格、稳定分栏和清晰对齐，做到“背景自由、内容严谨”。
- `flowLight`、流动线条或光影动效必须低饱和、低对比、低速，并写 `prefers-reduced-motion` 静态降级；禁止离散装饰圆球、bokeh 或干扰文字阅读的背景动效。
- 这些字段要能直接指导实现，而不是形容词；实现者应能按 `design.md` 写出根容器、分栏、背景层、表面材质、按钮状态和空态。
- `acceptanceChecks` 建议包含：`contentBlocks` 推荐 8-10 个区块以上、KPI/快捷入口子项不计数、首屏至少两层信息、没有大空白卡、主色跟随应用主题、背景或装饰层不干扰前景对比度。区块数量不作为准出硬门槛。

## 3. 写组件和状态规则

- 按主题统一按钮、输入、卡片、表格、标签、弹窗、抽屉和图标样式；图标输出 `iconSystem`，只选择 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认选择 `lucide-react`。
- 页面美感提升、重构和改 UI 时保留当前功能契约：数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态继续有效。
- 明确正常、hover/active、禁用、加载、空态、错误、无权限、无数据状态。
- 表单验证、成功/失败提示使用平台语义色和原生能力。
- 下拉刷新、上拉加载、轮询刷新等只在真实场景需要时设计。

## 4. 选择素材和图标

- 官网、产品首页、品牌页、视觉化工作台默认要有真实图片或生成图片。
- 强视觉官网至少形成“场景 Hero + 产品/服务 + 过程/空间”的素材故事。
- 素材暂缺时标注 draft，并写清缺口，例如 heroImage、productImages、brandLogo、caseImages。
- 图标只使用 `lucide-react` 或 `@ant-design/icons`，默认使用 `lucide-react`。在 `design.md` 中输出 `iconSystem`、尺寸、描边/Outlined 风格、`actionIconMap`、`statusIconMap`、`navigationIconMap` 和 `emptyStateIconMap`，把新增、查询、刷新、查看、入库、出库、组织、告警、完成等业务语义映射到具体图标组件。emoji 不能退成 CSS 形状、字母占位、Unicode 符号或临时 SVG。

## 5. 检查页面是否像真实产品

检查：

1. 页面是否有当前业务专属信息，而不是示例品牌名、默认指标和通用卖点。
2. 首屏是否只有一个明确主张或核心判断。
3. 每个区块是否有不同的信息目的和构图节奏。
4. 颜色是否服务业务语义，语义色是否稳定。
5. 图标是否来自 `lucide-react` 或 `@ant-design/icons` 的具体组件映射，页面渲染文案是否使用纯文本。
6. 空态、加载态、错误态是否符合当前业务。
7. 列表、看板、详情是否保留用户当前上下文。
8. 新增/提交/编辑是否使用原生表单入口。
9. 首屏是否有视觉锚点、主操作、关键状态和至少两个信息层。
10. 自定义展示页是否在 PRD 中引用 `designFile` 和 `designRefs`，且 `design.md` 已写清视觉 DNA 和页面场景规则。
11. 工作台 / 业务首页是否避开“4 个等宽大 KPI 卡 + 图标快捷卡 + 大空态白卡”的低密套路；空数据是否用薄空态行和主操作入口承接。
12. 工作台、首页、门户、看板、展示页和业务入口页是否推荐有 8-10 个有业务目的的区块以上，并且不是靠重复卡片或空白容器凑数；窄场景可以更少并说明取舍。KPI 子项、快捷入口子项和列表行不能分别计数。
13. 页面是否已考虑 `backgroundLayer`：优先选择淡色背景、顶部不规则色块、柔和光洗、低速流光、微噪点、细线装饰、插图或局部渐变之一；近白画布可以保留，但不能呈现为未设计的空白底。
14. 不规则背景是否只服务氛围和视觉焦点，内容区是否仍保持规则栅格、稳定对齐、可读对比度和 reduced motion 静态降级。
15. 页面背景与卡片背景是否形成明显层次对比，并按白色/浅色背景配边框、浅灰/浅彩背景配白色无边框、渐变背景配玻璃卡片的方案落地。
16. 圆角、padding、gap 是否同时满足现代感和信息密度：卡片 padding >20px，卡片 gap <20px，卡片圆角 0-32px，状态摘要、任务列表、右侧上下文和空态没有被撑成大空白容器。
17. `styleDesignSelection` 是否能从业务任务、信息拓扑和 requiredVisualDNA 解释风格选择，而不是按行业、颜色或主观喜好套风格。
18. `themeAdaptationResult` 是否遵守所选风格的 `theme_adaptation`：换 hue，不换 DNA；换 token，不换结构；保留 `preserve_tokens` 和 `visual_dna.invariant`。

## 产出

```markdown
- designFile：<prd/<项目名>/design.md>
- styleDesignSelection：<推演任务 / 信息拓扑 / requiredVisualDNA / selectedStyleDesign / rejectedStyleDesigns>
- themeAdaptationResult：<inputThemeColor / strategy / replaced / preservedVisualDNA / preservedMechanisms>
- designSystem：<themeProfile / Visual DNA / 基础版式 / visualScaffold / sceneRecipes>
- componentSpec：<按钮/表格/卡片/标签/抽屉/图标>
- iconSystem：<defaultLibrary / allowedLibraries / sizes / actionIconMap / statusIconMap>
- stateSpec：<正常/禁用/加载/空态/错误/无权限>
- assetStrategy：<图片/图标/素材缺口/materialStatus>
- pageDesignRefs：<每个 display 页面在 PRD 中引用 design.md 的章节 ID>
- deAiChecks：<通过项和需要修正项>
```

## 下一步

→ [Step 6：写入 prd.md 和 design.md](step-6-handoff.md)
