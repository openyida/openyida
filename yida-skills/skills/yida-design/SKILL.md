---
name: yida-design
description: >
  当用户要做完整应用产品设计、单页 UI 改造、主页面视觉设计、应用主题色或全局换肤时使用。
  完整应用场景读取共享需求简报，独立输出 prd/<项目名>/design.md；PRD 由 yida-prd 并行生成。
  design.md 写主题 token、布局、材质、圆角、密度、呼吸感、组件和状态规则。
---

# yida-design

宜搭应用和页面视觉设计技能。它是 Visual Design artifact 的唯一 owner，只输出 `design.md`，不写 PRD 或页面源码。

---

## 入口快速路由（必读，先做设计对象判断）

进入本技能后，先判断设计对象，并按表中唯一动作执行。

| 用户诉求 | 判定为 | 唯一动作 |
| --- | --- | --- |
| 完整应用、多个角色、多页面、导航分组、首页/入口页、官网 + 看板 + 后台 | 完整应用视觉设计 | 读取共享需求简报，输出 `prd/<项目名>/design.md`；与 `yida-prd` 并行 |
| 单个自定义页要求好看、高级、品牌化、去 AI 味、页面太丑、不够惊艳 | 单页设计 | 读 [page-design](sub_skill/page-design/SKILL.md)，确认当前页面和应用主题后输出设计补充 |
| 应用主题色、品牌色、全局换肤、`--color-brand1-*`、自定义主题 CSS、`themeColor`、`navTheme` | 主题色和 token 设计 | 读 `workflow/step-2-theme-system.md` 和 `workflow/step-6-handoff.md`，输出 themeProfile、应用主题文件和 token 契约 |
| 页面 / 主页面 / 首页 / 工作台 UI 设计 | 页面视觉设计 | 读取当前页面上下文，输出或更新 `design.md` |

---

## 标准流程

完整应用按以下步骤生成视觉 artifact。页面实现阶段仍必须同时读取并行生成的 `prd.md` 和本技能生成的 `design.md`。

| 步骤 | 名称 | 功能描述 | 产出物 |
| --- | --- | --- | --- |
| 1 | [读取共享需求简报](workflow/step-1-read-brief.md) | 读取业务对象、页面场景、明确范围、品牌和色彩偏好 | 视觉输入摘要 |
| 2 | [选择主题色和 token](workflow/step-2-theme-system.md) | 确定主色、辅助色、中性色、字体层级、组件基调和宜搭 token 作用域 | `themeProfile` |
| 3 | [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 根据简报中的页面场景确定布局骨架、区块、主操作、状态和响应式规则 | 低保真结构 + 交互路径 |
| 4 | [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 从业务任务、信息拓扑和视觉 DNA 选择设计风格 | `design.md` 内容草稿 |
| 5 | [写入 design.md](workflow/step-6-handoff.md) | 写入唯一视觉事实源和稳定 `designRefs` | `prd/<项目名>/design.md` |

> 完整应用必须等共享需求简报 ready 后才 start。本技能 end 只代表 `design.md` 完整；它不代表并行 PRD 已完成。

> 本技能不读取本轮并行生成中的 `prd.md`，避免形成串行依赖或并发覆盖。两个 artifact 的引用一致性由 `yida-app` join 校验。

---

## 核心规则

1. **平台能力优先**：数据录入、提交、编辑、审批、权限、字段校验走宜搭表单/流程；自定义页负责展示数据、呈现分析结果、放置业务入口、打开详情页，并串联表单、流程、报表和导航入口。
2. **共享需求简报是视觉输入**：完整应用的用户、目标、对象、页面场景、显式范围、品牌和色彩偏好只从 `requirement-brief.json` 读取。
3. **业务蓝图归 PRD owner**：表单、流程、报表、页面清单、字段语义和三种顺序由 `yida-prd` 生成；本技能只消费页面场景并设计视觉规则。
4. **并行产物互不覆盖**：本技能不写 `prd.md`，不等待本轮 PRD，也不把视觉推断写成新的业务范围。
5. **美感提升保持功能契约**：页面美化、视觉升级和页面重构默认只调整颜色、布局、密度、间距、视觉层级、素材和图标表达；现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态保持原样。
6. **默认保留平台应用导航**：普通自定义页、页面内 tab、分段、筛选和快捷入口都不触发 `yida-nav-shell`。只有自定义页要做顶部导航、侧边导航、导航壳、自绘应用级导航，或用户明确隐藏应用导航时，才写 `appBlueprint.hideAppNav: 'y'` 并交给 `yida-nav-shell`。用户只说全屏、无导航或 `isRenderNav=false` 时，只写页面级隐藏配置。
7. **同应用页面入口归导航**：同应用页面优先放入平台导航或导航分组；自定义页内容区放当前页动作、原生表单新建/查看、外部链接和跨应用资源。
8. **表单入口响应式**：新增/提交页 URL 默认使用页面级隐藏导航的 `submission/{formUuid}?isRenderNav=false`；详情页 URL 默认使用 `formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false`，且 `formInstId` 必须来自真实数据记录并优先取 `row.formInstId`；PC 端默认在侧边抽屉中用 iframe 承载宜搭原生表单，抽屉默认半屏 `50vw`，提交页和详情页使用同一宽度规则；移动端整页或新页打开。
9. **主题文件先复制再修改**：先在 `design.md` 确定主题色。实现阶段执行 `openyida sample yida-design app-theme --output .cache/openyida/<项目名>/app-theme.css` 复制模板，再按主题色修改对应 token。严禁重新生成或覆盖整份 CSS。主色写入 `--color-brand1-6`；保留 `--color-brand1-1/2/3/5/6/9/10`、`--color-brand-1` 至 `--color-brand-4` 和 `--color-group`；严禁补造 `--color-brand1-4/7/8`。
10. **默认主题先做业务判断**：工作台、门户、列表、详情、普通看板和数据大屏默认都是浅底 / light 模式，但主色不固定为 `podBlue` 或 #1677ff；先根据行业、品牌、业务情绪和视觉目标做创意色彩判断，主题色可以是任意合法 CSS 颜色。只有用户明确说暗色/深色/夜间/高对比时才用深色沉浸。
11. **页面布局要到可实现粒度**：每个页面至少写清顶部/左侧/主体/右侧/底部区域、核心组件、信息密度、主操作位置、PC/移动端差异和空/载/错态。
12. **页面丰富度建议**：工作台、首页、门户、看板、展示页和业务入口页推荐规划 8-10 个有业务目的的区块以上，例如上下文标题、状态摘要、主操作、筛选、任务列表、最近记录、动态流、洞察、提醒、空态行动、右侧上下文和底部辅助信息。区块数量不是硬门槛，窄场景、单任务页面或用户明确要求精简时可以更少，但要写清每个区块的业务目的和取舍原因。计数按“区块组”算，不按子项算：`KPI 卡片: 学生总数, 课程总数, 出勤率, 平均分` 只能算 1 个状态摘要区块，`快捷入口: 录入学生/登记成绩/记录考勤/管理课程` 只能算 1 个动作区块；不能用重复 KPI 卡、重复快捷入口或大空白卡凑数量。
13. **工作台禁低密大卡片套路**：工作台 / 业务首页不能用“标题 + 4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡”撑首屏。默认改成紧凑状态摘要条、任务/动态列表、最近记录、右侧上下文面板和高频动作；没有真实数据时也展示薄空态行 + 登记入口，不铺大块空白卡片。
14. **默认圆润高密且有呼吸感**：业务工具页默认使用圆润形状、紧凑信息密度和清晰呼吸节奏。`design.md` 必须写清 `roundedRule`、`densityRule` 和 `breathingRule`：卡片 padding 必须大于 20px（默认 22-28px），卡片与卡片的 gap 必须小于 20px（默认 12-18px），卡片圆角范围 0-32px（业务卡片默认 20-24px），控件 10-14px，状态摘要 64-88px，动作条 40-56px，列表行 44-56px，空态 88-120px 内；页面边距、卡片 gap 和卡片 padding 要形成可扫读的分组节奏。呼吸感来自对齐、分组、层级和节奏，不来自额外 margin、超宽空 KPI 框或空白卡撑页面。
15. **背景与卡片必须有层次对比**：默认业务页背景保持浅色调、清爽但不能与卡片相近或相同。`design.md` 必须写清 `surfaceContrast`：白色/浅色背景配有边框卡片；浅灰背景（如 `#F3F4F6`）配白色无边框卡片；浅彩色背景（如浅蓝、浅暖灰）配白色无边框卡片；渐变背景配玻璃感卡片。禁止浅底白卡无边框、同色背景同色卡片或只有阴影没有色差/边框的层次。
16. **设计风格先选后定制**：进入 UI 视觉和状态设计时，必须先从业务任务、信息拓扑和必需视觉 DNA 推演并选择唯一设计风格，再根据主题系统换肤。主题色只换 token 和强调色，不改变风格 DNA、布局机制和组件机制；不得按行业或颜色直接套风格。
17. **应用主题统一**：`app-theme.css` 只在应用级配置，由平台统一作用于应用壳、原生表单、详情页和自定义页面外层。`YidaCodeCanvas` 页面只在 `YidaComp` 内消费 `--color-brand1-*`、`--color-group` 和 `--pod-*`；严禁页面代码修改或向上层注入主题变量。
18. **design.md 是唯一视觉契约**：完整应用只产出一份应用级 `design.md`。页面技能读取与自身布局、交互和组件表达相关的设计结果。
19. **视觉设计规范只写 design.md**：`themeProfile`、应用主题文件交付、tokens、`visualScaffold`、`backgroundLayer`、`surfaceMaterial`、`surfaceContrast`、`colorRoles`、`depthRule`、`roundedRule`、`densityRule`、`breathingRule`、组件形态、空态规则和响应式规则写入 `design.md`；PRD 只引用这些视觉规则。
20. **稳定引用供 join 使用**：每个页面场景输出稳定 `sceneRecipes` / `designRefs`；`yida-app` 在两个 artifact end 后核对 PRD 的引用，不一致时回到对应 owner 修正。
21. **业务与视觉双事实源分工**：`prd.md` 写业务目标、资源、页面、数据来源、主操作和 `pageSpecHandoff`；`design.md` 写主题、布局、视觉结构、组件、图标、背景和状态规则。
22. **参考转成可执行选择**：参考 Dribbble / 优秀案例时，落到主色、背景素材、首屏构图、信息密度、动线、区块数量和反默认点。
23. **页面文案和图标使用专业表达**：渲染文案使用纯文本；图标只使用 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认选择 `lucide-react`，并在 `design.md` 的 `iconSystem` 中写清业务动作、状态、导航和空态到图标组件的映射。emoji 不能改成 CSS 形状、字母占位、Unicode 符号或临时 SVG；如果需要图标，必须映射到上述两类库的具体组件。
24. **实现交接明确**：设计产物只定义页面结构、视觉系统和验收标准；常规业务图表使用 `yida-rechart`；ECharts 例外只用于用户明确要求复杂 ECharts option 或维护旧图表。

---

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [读取共享需求简报](workflow/step-1-read-brief.md) | 业务对象、页面场景、明确范围、品牌和色彩偏好 | 完整应用必读 |
| [选择主题色和 token](workflow/step-2-theme-system.md) | 主题 token、色彩、字体、组件基调 | 涉及主题或视觉 |
| [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 布局骨架、内容区块、主操作、抽屉、响应式 | 页面设计 |
| [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 设计风格选择、视觉 DNA、主题换肤、素材图标、空/载/错态、去 AI 味 | 输出前自检 |
| [写入 design.md](workflow/step-6-handoff.md) | `design.md` 必填内容、稳定引用和完成条件 | 输出前 |
| [page-design 单页设计](sub_skill/page-design/SKILL.md) | 单页主题证据、页面级设计流程、输出补充字段 | 单个自定义页设计 |
| [design.md 输出格式](workflow/output-design.md) | `design.md` 字段示例 | 写入前 |
| [design.md 生成规则](references/style-design-selection.md) | 从业务推演视觉 DNA，选择设计风格并按主题色换肤，生成应用级 `design.md` | UI 视觉设计 |
| [视觉结构配方库](references/visual-scaffold-recipes.md) | 将高质量页面结构转成 `visualScaffold` 槽位，约束页面实现落地 | UI 视觉设计 |
| [页面质量门禁](references/page-quality-gates.md) | 区块数量、源码槽位、低密大卡片、主题一致性和 `pageSpecHandoff` 检查 | 页面结构、视觉与交接阶段 |
| [style-design 风格注册表](references/style-designs/registry.md) | 内置视觉 DNA 风格、选择评分、风险扣分、风格消费规则 | UI 视觉设计 |
| [应用结构参考](references/app/blueprint.md) | 应用角色、导航、页面清单、页面/表单/流程资源蓝图 | 完整应用或主页面 |
| [应用主题与 token 参考](references/theme/theme-token-presets.md) | 平台主题 key、候选主题、token profile | 需要主题 key 或 token |
| [应用主题 CSS 模板](references/theme/app-custom-theme-template.css) | AI 可复制修改的品牌、Shell、页面、表格和导航 token | 生成自定义应用主题文件时必读 |
| [yida-canvas-custom-page 样式实现指南](../yida-canvas-custom-page/references/canvas-style-implementation-guide.md) | 将 `design.md` 的 token、背景、圆角、密度和组件规则落到页面源码、antd、CSS、图表和控件状态 | 实现阶段 |
| [字段与 URL 参考](../../references/field-and-url-reference.md) | `isRenderNav=false`、页面 URL、跨页跳转 | 拼接页面/表单 URL |
