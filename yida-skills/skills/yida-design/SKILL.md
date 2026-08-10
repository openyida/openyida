---
name: yida-design
description: 生成 prd/<项目名>/design.md，并把主题、圆角、密度和间距写入项目表单与 Canvas 脚手架。
---

# yida-design

本技能读取 `yida-requirement-analysis` 生成的共享需求简报，生成 `prd/<项目名>/design.md` 和精简视觉配置，再用 CLI 刷新项目表单与 Canvas 脚手架。`prd.md` 由 `yida-prd` 同时生成，页面源码由页面技能实现。

## 何时使用

| 用户诉求 | 动作 |
| --- | --- |
| 完整应用、多个页面、主页面视觉设计 | 读取共享需求简报并生成 `design.md`；可与 `yida-prd` 同时执行 |
| 单个自定义页要求更美观、品牌化、去 AI 味或重做视觉 | 读 [page-design](sub_skill/page-design/SKILL.md)，再写当前页设计补充 |
| 应用主题色、品牌色、全局换肤、`--color-brand1-*` | 生成 `themeProfile`、token 和主题作用域 |
| 只要 PRD、字段建模、流程配置、页面发布 | 不用本技能，交给 `yida-prd` 或对应子技能 |

## 必须做到

1. 写入 `prd/<项目名>/design.md` 和 `.cache/openyida/<项目名>/design-runtime.json`。
2. 完整应用先读取 `.cache/openyida/<项目名>/requirement-brief.json`，确认业务对象、页面场景、用户任务、品牌和色彩偏好。
3. `design.md` 只写项目视觉决策：主题与色彩、视觉 DNA、布局、层级、背景、材质、圆角、密度、间距、组件、图标、状态和响应式规则。
4. 完整应用只产出一份应用级 `design.md`；页面差异写成 `sceneRecipes`，不要为每页另起设计文件。
5. 写完设计后，用 `design-runtime.json` 刷新项目级表单与 Canvas 脚手架；不手写主题注入、抽屉或 iframe 代码。

## 不要做

- 不写 `prd.md`。
- 不写 JSX、TSX、CSS 或 helper 用法。
- 主题注入、ConfigProvider、表单抽屉、iframe 同步和 13 个 Yida API 由标准脚手架提供。
- 不把业务字段、真实 ID、资源创建顺序写成视觉规则。
- 不按行业或颜色套模板；先根据业务任务、信息结构和视觉风格选择模板。

## 标准流程

执行到每一步前，读取对应 workflow 或 reference。

| 步骤 | 读取文件 | 产出 |
| --- | --- | --- |
| 1. 读取设计输入 | `.cache/openyida/<项目名>/requirement-brief.json`；单页任务读取当前页面上下文 | 业务对象、页面场景、品牌和色彩偏好、视觉目标 |
| 2. 选择主题色和 token | [选择主题色和 token](workflow/step-2-theme-system.md) | `themeProfile` 和 token 草稿 |
| 3. 设计页面结构和交互 | [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 布局骨架、区块、主操作、状态 |
| 4. 设计 UI 视觉和状态 | [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 视觉风格、组件、素材、状态规则 |
| 5. 写入设计并刷新脚手架 | [写入设计和脚手架](workflow/step-6-handoff.md) | `design.md`、`design-runtime.json`、两份项目脚手架 |

## 核心规则

1. **视觉输入来自需求简报**：完整应用的行业、业务目标、用户、页面场景、品牌和色彩偏好来自 `yida-requirement-analysis`；单页任务读取当前页面上下文。
2. **主题作用域写清楚**：应用级换肤写 `themeScope=app`；单页美化写 `themeScope=page`；自定义色盘写 token；不把任意色值传给 create-app/update-app。
3. **默认主题先做业务判断**：主色从行业、品牌、业务情绪和视觉目标推导；先根据行业、品牌、业务情绪和视觉目标做创意色彩判断；主色不固定为 `podBlue` 或 #1677ff，不套行业刻板配色。
4. **先选模板再定制**：按业务任务、信息结构和视觉风格选择一个模板，再调整主题色和页面内容。
5. **参考转成可执行选择**：用户要求参考 Dribbble 或优秀案例时，必须转成构图、视觉锚点、密度、色彩关系、组件细节和反默认点。
6. **应用主题先统领页面主色**：平台导航可见时，页面主按钮、链接、选中态、重点标签和图表主序列都跟随应用主题 `--color-brand1-*`；创建应用时不显式传 `theme/colour`。
7. **默认浅底业务屏**：默认浅底业务屏，只有用户明确说暗色/深色/夜间/高对比时才用深色沉浸。
8. **design.md 是唯一视觉依据**：主题、token、页面结构、背景、材质、组件、图标、状态和响应式规则写在 `design.md`；`design-runtime.json` 和项目脚手架都从它生成。
9. **表单入口只写交互意图**：写清新建、提交、详情查看的视觉位置和打开体验；具体 URL、真实记录校验、容器实现和主题同步由页面实现技能处理。
10. **默认页面保留平台应用导航**：同应用页面优先放入平台导航或导航分组；页面内 tab、自绘侧边栏或独立门户壳写 `appBlueprint.hasPageNavigation: true`，同时保持平台导航可见。
11. **页面布局要到可交接粒度**：写清顶部/左侧/主体/右侧/底部区域、核心组件、信息密度、主操作位置、PC/移动端差异和空/载/错态。
12. **页面丰富度保底**：工作台、首页、门户、看板、展示页和业务入口页至少规划 10 个有业务目的的区块以上；KPI 组、快捷入口组和列表组各只算 1 个区块。
13. **工作台禁低密大卡片模板**：不用“标题 + 4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡”撑首屏。
14. **默认圆润高密且有呼吸感**：`design.md` 写清 `roundedRule`、`densityRule` 和 `breathingRule` 的具体数值。
15. **背景与卡片必须有层次对比**：`design.md` 写清 `surfaceContrast`，避免浅底白卡无边框、同色背景同色卡片。
16. **美感提升保持功能契约**：页面美化、视觉升级和页面重构只调整颜色、布局、密度、间距、层级、素材和图标表达；页面重构/单页美化默认以当前应用主题色为基准。
17. **图标使用专业组件**：图标只使用 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认选择 `lucide-react`。
18. **页面类型由实现技能处理**：新自定义页面使用 `yida-canvas-custom-page`；Recharts 图表使用 `yida-rechart`；已有普通 JSX 或 ECharts 页面分别使用对应维护技能。

## 参考文件

| 文件 | 说什么 |
| --- | --- |
| [选择主题色和 token](workflow/step-2-theme-system.md) | 主题来源、平台主题 key、自定义 token |
| [页面结构和交互设计](workflow/step-4-wireframe-interaction.md) | 布局骨架、内容区块、操作路径 |
| [UI 视觉和状态设计](workflow/step-5-visual-states.md) | 视觉风格、模板选择、组件、素材、状态 |
| [design.md 输出格式](workflow/output-design.md) | `design.md` 字段结构 |
| [写入设计和脚手架](workflow/step-6-handoff.md) | 输出前检查、生成视觉配置并刷新项目脚手架 |
| [design.md 生成规则](references/style-design-selection.md) | 选择内置 style-design 模板并换肤 |
| [视觉脚手架配方库](references/visual-scaffold-recipes.md) | `visualScaffold` 槽位和页面结构配方 |
| [页面质量门禁](references/page-quality-gates.md) | 区块数量、视觉层次、圆角密度、并行产物对齐 |
| [style-design 内置模板注册表](references/style-designs/registry.md) | 模板选择、拒绝理由和输出粒度 |
| [应用主题与 token 参考](references/theme/theme-token-presets.md) | 平台主题 key 和 token profile |

## 完成条件

- 已写入 `prd/<项目名>/design.md` 和 `.cache/openyida/<项目名>/design-runtime.json`。
- 已生成 `.cache/openyida/<项目名>/scaffolds/form.form.json` 和 `canvas.canvas.jsx`。
- 完整应用已读取 `.cache/openyida/<项目名>/requirement-brief.json`。
- `design.md` 包含 `themeProfile`、tokens、`visualScaffold`、`roundedRule`、`densityRule`、`breathingRule`、`surfaceContrast`、组件、图标、状态和响应式规则。
- 每个 display 页面都有可供页面技能读取的 `sceneRecipes` 或 `designRefs`。
- 没有写 `prd.md`，没有手写页面源码或运行时 helper。
