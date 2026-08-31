---
name: yida-design
description: >
  当用户要做完整应用产品设计、单页 UI 改造、主页面视觉设计、应用主题色或全局换肤时使用。
  本技能基于需求分析和资源上下文，输出 prd/<项目名>/prd.md 与 prd/<项目名>/design.md。
  prd.md 写业务目标、数据结构、页面功能、资源顺序、导航顺序和验收标准；design.md 写主题 token、布局、材质、圆角、密度、呼吸感、组件和状态规则。
---

# yida-design

宜搭应用和页面设计技能。它输出 `prd.md` 和 `design.md`，不写页面源码。

---

## 入口快速路由（必读，先做设计对象判断）

进入本技能后，先判断设计对象，并按表中唯一动作执行。

| 用户诉求 | 判定为 | 唯一动作 |
| --- | --- | --- |
| 完整应用、多个角色、多页面、导航分组、首页/入口页、官网 + 看板 + 后台 | 完整应用设计 | 读 Step 1-6，输出 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md` |
| 单个自定义页要求好看、高级、品牌化、去 AI 味、页面太丑、不够惊艳 | 单页设计 | 读 [page-design](sub_skill/page-design/SKILL.md)，先确认当前应用主题，再复用 Step 1-6 |
| 应用主题色、品牌色、全局换肤、`--color-brand1-*`、`style#yida-global-theme`、`customThemeStyle.tokens` | 主题色和 token 设计 | 读 Step 2、6，PRD 输出主题摘要，`design.md` 输出 themeProfile 和 token 契约 |
| 页面 / 主页面 / 首页 / 工作台 UI 设计 | 完整主页面设计 | 读 Step 1-6，输出 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md` |

---

## 标准流程

按以下 6 步完成宜搭产品设计，最终产出两份并列文件：`prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`。页面实现阶段必须同时读取两份文件；只有走页面生成器或需要稳定交接时，才从两份文件派生 `page-spec.json`。

| 步骤 | 名称 | 功能描述 | 产出物 |
| --- | --- | --- | --- |
| 1 | [分析需求和资源](workflow/step-1-positioning.md) | 明确应用类型、用户角色、核心任务、业务对象、页面/表单/流程资源和设计范围 | 设计目标 + 角色任务 + 资源蓝图 |
| 2 | [选择主题色和 token](workflow/step-2-theme-system.md) | 确定主色、辅助色、中性色、字体层级、组件基调和宜搭 token 作用域 | `themeProfile` |
| 3 | [规划页面和导航](workflow/step-3-information-architecture.md) | 规划首页/入口页、平台导航、页面清单、页面场景和表单/流程关系 | `appBlueprint` / 页面结构 |
| 4 | [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 确定布局骨架、内容区块、主操作、联动、交互、PC/移动端差异 | 低保真结构 + 交互路径 |
| 5 | [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 从业务任务、信息拓扑和视觉 DNA 选择设计风格，换主题色后生成应用级 `design.md` | `design.md` 内容草稿 |
| 6 | [写入 prd.md 和 design.md](workflow/step-6-handoff.md) | 汇总业务 PRD 与 `design.md` 视觉规则，分别写入 `prd.md` 和 `design.md` | `prd/<项目名>/prd.md` + `prd/<项目名>/design.md` |

> 进入标准流程后，从 Step 1 开始按顺序执行；每步开始前先读取对应步骤文件，每步形成产物后再进入下一步。Step 6 输出前核对 Step 1-5 的产物齐全，确保不跳步、不停在中间步骤。

> 本技能输出 `prd.md` 和 `design.md`，不写 JSX/TSX。`prd.md` 记录业务、资源、页面、数据和验收；`design.md` 记录所有页面必须遵守的视觉系统。

---

## 核心规则

1. **平台能力优先**：数据录入、提交、编辑、审批、权限、字段校验走宜搭表单/流程；自定义页负责展示数据、呈现分析结果、放置业务入口、打开详情页，并串联表单、流程、报表和导航入口。
2. **需求分析归本技能**：完整应用设计先写清应用基本信息、用户角色、核心任务、业务对象、数据结构、页面与表单/流程资源、业务逻辑、交互状态和验收标准。
3. **应用资源蓝图先行**：资源蓝图列出必要的 display 页面、表单、流程和报表。普通表单的数据管理页默认作为列表；用户明确要求时才规划自定义列表页。表单写业务语义、类型、必填、默认值、关系和分组；运行 ID 由实现阶段记录。
4. **顺序分开写清**：PRD 同时写资源创建顺序、页面实现交付顺序和导航顺序。资源创建顺序服务依赖关系，表单/流程在自定义页面之前；页面实现交付顺序服务开发验收；导航顺序服务用户入口展示。
5. **美感提升保持功能契约**：页面美化、视觉升级和页面重构默认只调整颜色、布局、密度、间距、视觉层级、素材和图标表达；现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态保持原样。
6. **默认保留平台应用导航**：普通自定义页、页面内 tab、分段、筛选和快捷入口都不触发 `yida-nav-shell`。只有自定义页要做顶部导航、侧边导航、导航壳、自绘应用级导航，或用户明确隐藏应用导航时，才写 `appBlueprint.hideAppNav: 'y'` 并交给 `yida-nav-shell`。用户只说全屏、无导航或 `isRenderNav=false` 时，只写页面级隐藏配置。
7. **同应用页面入口归导航**：同应用页面优先放入平台导航或导航分组；自定义页内容区放当前页动作、原生表单新建/查看、外部链接和跨应用资源。
8. **表单入口响应式**：新增/提交页 URL 默认使用页面级隐藏导航的 `submission/{formUuid}?isRenderNav=false`；详情页 URL 默认使用 `formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false`，且 `formInstId` 必须来自真实数据记录并优先取 `row.formInstId`；PC 端默认在侧边抽屉中用 iframe 承载宜搭原生表单，抽屉默认半屏 `50vw`，提交页和详情页使用同一宽度规则；移动端整页或新页打开。
9. **主题作用域写清楚**：应用级换肤写 `themeScope=app`；单页美化写 `themeScope=page`；页面重构/单页美化默认以当前应用主题色为基准，用户明确要求很不一样的独立风格时再做页面级独立色盘；`--theme` / `colour` 只使用平台预置主题 key，自定义品牌色绝不能传给 create-app/update-app。
10. **默认主题先做业务判断**：工作台、门户、列表、详情、普通看板和数据大屏默认都是浅底 / light 模式，但主色不固定为 `podBlue` 或 #1677ff；先根据行业、品牌、业务情绪和视觉目标做创意色彩判断，选择最贴合当前业务的色彩关系，禁止套用“科技=蓝、宠物=橙、法律=蓝”这类刻板配色。若命中平台预置主题 key，再传给 `create-app/update-app --theme`；若是任意自定义色盘，创建应用时不显式传 `theme/colour`，PRD 只写主题色和风格摘要，`style#yida-global-theme` / `customThemeStyle.tokens` 注入方案写入 design.md。只有用户明确说暗色/深色/夜间/高对比时才用深色沉浸。
11. **页面布局要到可实现粒度**：每个页面至少写清顶部/左侧/主体/右侧/底部区域、核心组件、信息密度、主操作位置、PC/移动端差异和空/载/错态。
12. **页面丰富度建议**：工作台、首页、门户、看板、展示页和业务入口页推荐规划 8-10 个有业务目的的区块以上，例如上下文标题、状态摘要、主操作、筛选、任务列表、最近记录、动态流、洞察、提醒、空态行动、右侧上下文和底部辅助信息。区块数量不是硬门槛，窄场景、单任务页面或用户明确要求精简时可以更少，但要写清每个区块的业务目的和取舍原因。计数按“区块组”算，不按子项算：`KPI 卡片: 学生总数, 课程总数, 出勤率, 平均分` 只能算 1 个状态摘要区块，`快捷入口: 录入学生/登记成绩/记录考勤/管理课程` 只能算 1 个动作区块；不能用重复 KPI 卡、重复快捷入口或大空白卡凑数量。
13. **工作台禁低密大卡片套路**：工作台 / 业务首页不能用“标题 + 4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡”撑首屏。默认改成紧凑状态摘要条、任务/动态列表、最近记录、右侧上下文面板和高频动作；没有真实数据时也展示薄空态行 + 登记入口，不铺大块空白卡片。
14. **默认圆润高密且有呼吸感**：业务工具页默认使用圆润形状、紧凑信息密度和清晰呼吸节奏。`design.md` 必须写清 `roundedRule`、`densityRule` 和 `breathingRule`：卡片 padding 必须大于 20px（默认 22-28px），卡片与卡片的 gap 必须小于 20px（默认 12-18px），卡片圆角范围 0-32px（业务卡片默认 20-24px），控件 10-14px，状态摘要 64-88px，动作条 40-56px，列表行 44-56px，空态 88-120px 内；页面边距、卡片 gap 和卡片 padding 要形成可扫读的分组节奏。呼吸感来自对齐、分组、层级和节奏，不来自额外 margin、超宽空 KPI 框或空白卡撑页面。
15. **背景与卡片必须有层次对比**：默认业务页背景保持浅色调、清爽但不能与卡片相近或相同。`design.md` 必须写清 `surfaceContrast`：白色/浅色背景配有边框卡片；浅灰背景（如 `#F3F4F6`）配白色无边框卡片；浅彩色背景（如浅蓝、浅暖灰）配白色无边框卡片；渐变背景配玻璃感卡片。禁止浅底白卡无边框、同色背景同色卡片或只有阴影没有色差/边框的层次。
16. **设计风格先选后定制**：Step 5 必须先从业务任务、信息拓扑和必需视觉 DNA 推演并选择唯一设计风格，再根据 Step 2 主题色换肤。主题色只换 token 和强调色，不改变风格 DNA、布局机制和组件机制；不得按行业或颜色直接套风格。
17. **应用主题先统领页面主色**：平台导航可见时，页面主按钮、链接、选中态、重点标签和图表主序列都跟随应用主题 `--color-brand1-*`；普通表单、流程表单、提交页、formDetail 详情页和自定义页面必须消费同一套主题 token。`design.md` 的色相只转成辅助色、浅背景、图表第二序列和装饰气质。页面级独立主色只用于页面级沉浸页、应用导航隐藏后的自绘壳、独立品牌/活动页或用户明确要求完全不同风格；独立主色必须通过 `style#yida-global-theme` 或 scoped CSS vars 注入。
18. **design.md 是全局设计契约**：完整应用只产出一份应用级 `design.md`，所有 display 页面、普通表单、流程表单、表单入口、formDetail 详情、列表、看板和工作台都必须遵守它；PRD 不再复制或二次抽象 `design.md`，只引用 `design.md` 的章节和规则。
19. **视觉设计规范只写 design.md**：`themeProfile`、tokens、`visualScaffold`、`backgroundLayer`、`surfaceMaterial`、`surfaceContrast`、`colorRoles`、`depthRule`、`roundedRule`、`densityRule`、`breathingRule`、组件形态、空态规则和响应式规则写入 `design.md`；PRD 只写业务目标、资源关系、区块目的、数据来源、主操作、应用主题色/风格摘要和 `designRefs`，摘要必须与 `design.md` 一致。
20. **实现交接必须结构化但保持薄**：每个 display 页面在 PRD 中输出 `pageSpecHandoff`，只写 `pageStructure`、`scene`、`contentBlocks`、`themeSummary`、`designFile=prd/<项目名>/design.md`、`designRefs`、数据来源和主操作；实现阶段必须读取 `prd.md` 与 `design.md` 后才能写页面。
21. **设计事实源唯一**：`prd.md` 写业务目标、资源、页面、数据来源、主操作和 `pageSpecHandoff`；`design.md` 写主题、布局、视觉脚手架、组件、图标、背景和状态规则。页面 `scene` 只作为分类标签，不对应参考文件、固定样式文件或实现阶段读取入口。
22. **参考转成可执行选择**：参考 Dribbble / 优秀案例时，落到主色、背景素材、首屏构图、信息密度、动线、区块数量和反默认点。
23. **页面文案和图标使用专业表达**：渲染文案使用纯文本；图标只使用 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认选择 `lucide-react`，并在 `design.md` 的 `iconSystem` 中写清业务动作、状态、导航和空态到图标组件的映射。emoji 不能改成 CSS 形状、字母占位、Unicode 符号或临时 SVG；如果需要图标，必须映射到上述两类库的具体组件。
24. **实现交接明确**：设计产物只定义页面结构、视觉系统和验收标准；常规业务图表使用 `yida-rechart`；ECharts 例外只用于用户明确要求复杂 ECharts option 或维护旧图表。

---

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [Step 1：分析需求和资源](workflow/step-1-positioning.md) | 应用类型、用户角色、核心任务、业务对象、资源蓝图 | 必读 |
| [Step 2：选择主题色和 token](workflow/step-2-theme-system.md) | 主题 token、色彩、字体、组件基调 | 涉及主题或视觉 |
| [Step 3：规划页面和导航](workflow/step-3-information-architecture.md) | 首页/入口页、导航、页面清单、页面场景 | 应用级或单页设计 |
| [Step 4：页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 布局骨架、内容区块、主操作、抽屉、响应式 | 页面设计 |
| [Step 5：UI 视觉和状态设计](workflow/step-5-visual-states.md) | 设计风格选择、视觉 DNA、主题换肤、素材图标、空/载/错态、去 AI 味 | 输出前自检 |
| [Step 6：写入 prd.md 和 design.md](workflow/step-6-handoff.md) | `prd.md` + `design.md` 必填内容、三种顺序、实现交接 | 输出前 |
| [page-design 单页设计](sub_skill/page-design/SKILL.md) | 单页主题证据、页面级设计流程、输出补充字段 | 单个自定义页设计 |
| [PRD 输出格式](workflow/output-prd.md) | `prd.md` 字段示例 | Step 6 输出前 |
| [design.md 输出格式](workflow/output-design.md) | `design.md` 字段示例 | Step 6 输出前 |
| [design.md 生成规则](references/style-design-selection.md) | 从业务推演视觉 DNA，选择设计风格并按主题色换肤，生成应用级 `design.md` | Step 5 |
| [视觉脚手架配方库](references/visual-scaffold-recipes.md) | 将高质量页面结构转成 `visualScaffold` 槽位，约束页面实现落地 | Step 5 |
| [页面质量门禁](references/page-quality-gates.md) | 区块数量、源码槽位、低密大卡片、主题一致性和 `pageSpecHandoff` 检查 | Step 4-6 输出前 |
| [style-design 风格注册表](references/style-designs/registry.md) | 内置视觉 DNA 风格、选择评分、风险扣分、风格消费规则 | Step 5 |
| [应用结构参考](references/app/blueprint.md) | 应用角色、导航、页面清单、页面/表单/流程资源蓝图 | 完整应用或主页面 |
| [应用主题与 token 参考](references/theme/theme-token-presets.md) | 平台主题 key、候选主题、token profile | 需要主题 key 或 token |
| [yida-canvas-custom-page 样式实现指南](../yida-canvas-custom-page/references/canvas-style-implementation-guide.md) | 将 `design.md` 的 token、背景、圆角、密度和组件规则落到页面源码、antd、CSS、图表和控件状态 | 实现阶段 |
| [字段与 URL 参考](../../references/field-and-url-reference.md) | `isRenderNav=false`、页面 URL、跨页跳转 | 拼接页面/表单 URL |
