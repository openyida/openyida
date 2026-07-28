---
name: yida-page-uiux
description: >
  宜搭自定义页面 UI/UX 视觉方向决策技能。用于在页面实现前，按页面类型（工作台/看板/数据大屏/列表/详情/官网落地页）确定布局骨架、信息密度、视觉风格、素材/图标策略和模板路由，产出「视觉方向决策块」，默认交 Code Canvas 落地。
  当用户要新建或改造自定义页面，并明确关注好看、高级、品牌化、去 AI 味、UI 视觉、美化、页面太丑、不够惊艳，或进入深度视觉设计阶段时触发。
  完成范围：单页自定义页面的页面类型判断、视觉方向选择、差异化设计原则、素材与图标策略、去 AI 味自检和可交给实现阶段使用的决策块。
---

# yida-page-uiux — 自定义页面视觉方向决策

## 定位（先读这段）

本技能是**视觉方向决策层**，不是编码层：

- **产出**：一个「视觉方向决策块」（纯文字方向 + 差异化说明），供后续页面代码按对应 `design-system.md` 的 token / 组件落地。
- **不产出**：JSX 代码、具体像素数值表（那是 `design-system.md` 的职责）。
- **为什么存在**：`design-system.md` 是「安全平庸」的 token 层——直接套用会得到千篇一律的 AI 模板脸。本技能在写码前先强制做**差异化视觉决策**，让每个页面有自己的性格。

## 实现链路交接

- **默认**：视觉决策完成后交 `yida-canvas-custom-page`，生成 `.canvas.jsx`。
- **图表/看板默认**：常规业务图表交 `yida-rechart`。
- **ECharts 例外**：只有用户明确要求 ECharts、复杂 ECharts option/扩展系列，或维护旧普通自定义页面图表时，才交 `yida-chart`。
- **legacy/native fallback**：用户明确要求普通 JSX/Jsx 页面，或页面深度依赖 `this.$()`、`this.utils.yida.*`、`this.dataSourceMap` 等实例桥时，交 `yida-custom-page`。

本技能只做视觉决策，不得因为 references 中存在普通页示例就把新页面从 Canvas 降级到 native。

## 重要限制：自定义页面不做表单/录入 UI

- 自定义页面**只做展示、工具、看板、详情**，**不手写表单控件**（输入框群、字段校验、提交表单）。
- 需要录入/提交 → 一律走宜搭**原生表单**，不要在自定义页里重写字段、校验和提交流程。
- 详情页 / 列表页需要「新建 / 编辑」入口时，用既有 iframe 方式嵌入原生表单：`workbench/{formUuid}?iframe=true`（禁用 `formDetail`），不要在自定义页里重写表单。
- 因此本技能**不含「表单页」场景**。页面类型只覆盖展示/工具/看板/详情/落地页这类自定义页。

## 核心工作流（严格按顺序，不跳步）

每一步的判定法、checklist、代码/模板都在 `workflow/` 对应文件里，**按需只读命中的那一个**。

```
Step 0 导航形态判定 → Step 1 页面类型 → Step 2 意图解码 → Step 3 路由 scene
   → Step 4 视觉方向决策 → Step 5 图标与素材 → Step 6 去 AI 味自检 → 输出决策块
```

| 步骤 | 做什么 | 详细文件 | 产出 |
|---|---|---|---|
| **Step 0** 导航形态判定 | 应用导航是否隐藏（`isRenderNav`）？决定要不要跟应用框架融合、要不要自带导航壳 | [workflow/step-0-nav-shape.md](workflow/step-0-nav-shape.md) | 导航形态（可见/隐藏 + 壳型） |
| **Step 1** 页面类型判定 | 锁定属于哪一类（workbench/dashboard/screen/list/detail/landing），决定后续所有决策 | [workflow/step-1-page-type.md](workflow/step-1-page-type.md) | 页面类型 + 判定依据 |
| **Step 2** 意图解码 | 提取 2-3 个气质关键词 + 3-5 条项目特定设计原则 | [workflow/step-2-intent-decode.md](workflow/step-2-intent-decode.md) | 气质关键词 + 设计原则 |
| **Step 3** 路由到 scene | 只读命中的那一个 `references/scenes/*.md`，拿骨架/密度/焦点/组件套餐 | [workflow/step-3-scene-routing.md](workflow/step-3-scene-routing.md) | 布局骨架 + 密度 + 焦点 |
| **Step 4** 视觉方向决策 | 调用 `visual-decision-engine.md`，做 5 个差异化维度 + 反默认自检 | [workflow/step-4-visual-decision.md](workflow/step-4-visual-decision.md) | 差异化 5 维 + 反默认说明 |
| **Step 5** 图标与素材 | 默认内联 SVG 语义集；iconfont 仅用户提供项目 URL 时 opt-in | [workflow/step-5-icon-and-assets.md](workflow/step-5-icon-and-assets.md) | 图标策略 |
| **Step 6** 去 AI 味自检 | 逐条扫黑名单 + 8 问自检，任一命中即回对应 Step 修正 | [workflow/step-6-deai-selfcheck.md](workflow/step-6-deai-selfcheck.md) | 自检通过 |
| **输出** | 汇总成「视觉方向决策块」，提示交码落地 | [workflow/output-decision-block.md](workflow/output-decision-block.md) | 视觉方向决策块 |

## 核心规则（红线，任何步骤都适用）

- 🚫 **严禁 emoji（FATAL）**：页面渲染的任何位置一律禁止 emoji，需要图标走功能性内联 SVG。详见 [Step 6](workflow/step-6-deai-selfcheck.md)。
- **主色策略**：真实业务页导航可见时主色跟随平台品牌 `var(--color-brand1-*)`，不自由换主色相；导航隐藏（`isRenderNav=false`）时主色相可自立。官方 sample / 示例展示应用是独立样板库，必须每页自带不同主题色，不被宿主应用主题接管。**语义色（成功/警告/错误）永远固定**。详见 [Step 0](workflow/step-0-nav-shape.md) / [Step 4](workflow/step-4-visual-decision.md)。
- **不做表单**：见上「重要限制」。
- **只讲方向不写码**：本技能只产出决策块，不输出 JSX 与像素数值表。
- **参考不是口号**：用户明确要求参考 Dribbble、优秀案例、免费素材网站或“高级感”时，决策块必须把参考转成可执行选择：主色、背景素材、首屏构图、信息密度、数据丰富度、动线、区块数量和反默认点。禁止只写“参考 Dribbble 风格”这类空话。
- **素材优先真实可见**：官网、产品首页、品牌页、视觉化工作台默认使用真实图片或生成图片作为视觉锚点；拿不到素材时标注 draft，不要用纯渐变、空白大留白或无内容卡片冒充高级。
- **截图反馈要归因**：如果用户基于截图指出“不好看、颜色怪、导航没覆盖、内容不丰富、地图问题、详情页不像详情页”，先判断是页面类型误判、主题污染、素材缺失、数据不足、布局断层还是模板缺口，再把结论带回实现 skill 或 CLI。
- **预置主题与自定义 token 分开**：决策块里如果选择 `deepBlue/podBlue/royalBlue/lightBlue/teal/podGreen/deepPurple/purple/podOrange/yellow/magenta/red/greyBlue/coffee/black`，可写 `appThemeKey`；如果是自定义色系，必须写 `themeTokens` / `themeScope=page`，并提示实现阶段为每个页面注入 `style#yida-global-theme`，不要把自定义主题名传给 `--theme`。

## Dribbble / 优秀案例参考纪律

当用户明确说“参考 Dribbble / Dribble / 优秀示例 / 高级设计 / 免费素材网站”时，本技能必须执行下面 4 步，并把结论写进「视觉方向决策块」：

1. **看同类，不看泛图**：按页面类型搜索同类案例，例如 `SaaS dashboard`、`CRM list table`、`profile detail page`、`product landing page`、`admin portal`、`data screen map`。不要用无关的营销插画套到 B 端工作台。
2. **只提炼，不抄袭**：从 2-3 个案例抽象设计变量：布局比例、首屏焦点、色相组合、背景素材方式、卡片密度、表格行高、状态标签样式、数据可视化组织、导航覆盖方式。禁止照搬单个作品的构图、文案或图形资产。
3. **转成可执行决策**：输出必须落到 OpenYida 能实现的字段或代码策略，例如 `themeScope=page`、固定页面 CSS 变量、真实图片/生成图片、左导航全高覆盖、表格工具栏密度、详情页 hero + 侧栏 + 时间线、地图底图/区域标注/tooltip 结构。
4. **最终说明要回扣**：交付时简短说明“参考转译成了什么”，例如“借鉴 Dribbble 上 SaaS detail 的对象 hero + sticky metadata 结构”，而不是只说“已参考优秀案例”。

如果无法联网或没有条件即时浏览，也要明确按已有设计知识做「案例启发式」转译，并在决策块中标注没有做实时检索；不能假装已经看过具体案例。

## OpenYida 模板路由补充

视觉方向决策完成后，交给 Code Canvas 生成时必须带上模板选择，不要让所有页面都回落到通用工作台。这里的“模板”只表示运行时基底、数据桥和 primitive 契约；实现时要按决策块重组区块、样式、文案和交互，不要把默认模板当最终页面照抄。

| 页面类型 | 推荐模板 | 说明 |
| --- | --- | --- |
| 官网/落地页/律所官网/茶叶官网/品牌首页 | `official-homepage` | 专门处理首屏叙事、品牌可信感、服务矩阵和信任背书 |
| 数据大屏/实时监控/预警系统/态势屏 | `data-screen` | 专门处理深色沉浸、中心态势图、左右信息塔、趋势和排名 |
| 数据看板/经营看板/驾驶舱 | `dashboard-overview`；若用户强调“大屏/惊艳/指挥舱”则改 `data-screen` | 普通经营看板用 KPI + 图表 + 排行 + 洞察，不再回落通用首页 |
| 工作台/任务中心/业务首页 | `workbench-home` | 聚焦入口、待办、状态、流程闭环 |
| 列表/管理页/数据管理页/订单管理 | `business-list` | 筛选、表格、状态标签、详情抽屉、空/载/错态 |
| 详情/档案/画像/单对象展示 | `detail-profile` | 单对象 hero、摘要指标、章节叙事、侧栏元信息、时间线 |
| 主从分栏/工单处理台/左列表右详情 | `split-pane-detail` | 保留列表上下文，右侧承载详情、时间线和处理动作 |
| 页面内门户壳/多入口门户/隐藏导航门户 | `portal-shell-home` | 自带页面内导航、角色入口、常用应用和动态摘要 |
| 日历/排期/地图/看板拖拽/设置/知识库等专项页 | 先用最接近的 `workbench-home` / `business-list` / `detail-profile`，再按场景补模板 | 不要硬套官网或 dashboard，需在决策块标注专项模板缺口 |

如果决策块选择自绘应用级导航（例如工作台侧边导航、页面内门户壳、沉浸式大屏），后续 `generate-page` 产物应带 `appBlueprint.renderNav: false`，发布或更新页面配置时同步设置 `isRenderNav=false`。

用户说“采用宜搭应用主题风格”不是要求所有页面都浅色卡片化。官网可更有品牌叙事，大屏可更沉浸；真实业务页共同点是主色读取 `yida-app-theme` / `--color-brand1-*`，图表和强调色读取 `--color-group`，圆角和信息密度遵循宜搭应用主题风格。官方 sample / 示例展示应用共同点相反：每个页面都要有独立主题和明显差异化色相，不要读取宿主 App 主题。决策块里默认只写 `themeProfile: { "name": "yida-app-theme" }`；不要补固定 `themeColor`，除非用户明确要求某个品牌色、色值覆盖当前应用主题，或正在制作 sample。

官网/品牌首页额外要求：**先跑[素材工作流](references/asset-workflow.md)拿真实图片，再写页面。** 品牌官网默认就应该有大 Hero 图——餐饮、茶饮、零售、美妆、酒店、文旅等强视觉行业尤其如此。取图路径：智能体自己生成，或到免费可商用素材库（Unsplash / Pexels / Pixabay / unDraw）取真实图片直链，再用 `openyida asset verify-url` 校验、写进 `spec.assets.heroImage / productImages`，生成时 `openyida generate-page ... --resolve-assets`（有 CDN 加 `--upload-assets` 转存）。每个 section 至少有图片、图示、图表、产品卡、品牌纹理中的一个视觉锚点。**确实拿不到素材时**才降级：决策块标注“需要补 heroImage / productImages”，页面自动打「素材草稿」水印，**不得声称已交付最终版**；绝不编造未经校验的图片 URL。

强视觉官网还必须读 [真实品牌官网 Playbook](references/landing/realistic-brand-homepage.md)。真实感来自完整的品牌事实和摄影故事，不是只在 Hero 上放一张大图：至少覆盖场景、产品/服务、过程/空间三类素材，并从真实材质提取页面级品牌色。官方 Sample 无 CDN 时允许受控内嵌压缩 JPEG/WebP 保证原样发布稳定，生产页面仍优先 CDN。

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
|------|---------|---------|
| [视觉决策引擎](references/visual-decision-engine.md) | 5 个风格意图 + 反默认组合表 + 5 个差异化维度 + 强制第二选择 + 差异化自检 | Step 4 做视觉决策时（所有场景共用） |
| 页面内自绘导航壳（独立 skill） | 页面隐藏应用导航后自建侧边/顶部/混合/浮动/标签导航壳：Canvas hooks 示例优先，普通页作为 legacy fallback | Step 0 判定导航隐藏、需自建导航壳时调用 `use_skill("yida-nav-shell", "设计页面内自绘导航壳")` |
| [应用蓝图字段](references/app/blueprint.md) | `appBlueprint` 字段、门面页、页面组合 | 当前页面属于多页面应用时 |
| [应用导航模式](references/app/navigation-patterns.md) | 平台导航 / 页面内导航壳 / 混合导航 | 需要决定导航形态或导航分组时 |
| [角色旅程](references/app/role-journey.md) | 角色入口、任务和页面映射 | 用户提到多角色时 |
| [scene-workbench](references/scenes/workbench.md) | 工作台/门户首页的骨架/密度/焦点/组件套餐/去 AI 味要点 | 页面类型 = 工作台时 |
| [scene-dashboard](references/scenes/dashboard.md) | 数据看板/驾驶舱 | 页面类型 = 看板时 |
| [scene-screen](references/scenes/screen.md) | 数据大屏/实时监控/态势屏 | 页面类型 = 大屏时 |
| [scene-list](references/scenes/list.md) | 列表/管理页 | 页面类型 = 列表时 |
| [scene-detail](references/scenes/detail.md) | 详情/展示页（叠加详情页叙事纪律） | 页面类型 = 详情时 |
| [scene-landing](references/scenes/landing.md) | 官网/落地页/品牌展示/产品介绍页：Section 构图、素材锚点、页面节奏 | 页面类型 = 官网落地页时 |
| [素材工作流](references/asset-workflow.md) | 官网真实图片的取图/校验/回填/定级：`openyida asset status\|verify-url\|resolve\|generate` + 免费素材库 + final/draft/none 定级 | 做官网 Hero、需要真实图片素材时 |
| [Dashboard 主题配方](references/dashboard/theme-recipes.md) | 普通看板/大屏主题强度、运行态主题色使用 | dashboard/screen 需要主题策略时 |
| [Dashboard 布局模式](references/dashboard/layout-patterns.md) | 总览/分析/监控/报告/对比型布局 | 页面类型 = dashboard 时 |
| [Dashboard 组件契约](references/dashboard/component-contracts.md) | KPI、图表、洞察、排行、刷新时间等视觉原子 | 生成 dashboard 模板 spec 时 |
| [图表契约](references/dashboard/chart-contracts.md) | 图表高度、series、legend、tooltip、色板 | 页面含图表时 |
| [工作台入口模式](references/workbench/entry-patterns.md) | 高频入口、分组和主次 | 页面类型 = workbench 时 |
| [待办与动态流](references/workbench/task-feed.md) | 待办/动态列表字段和状态 | 工作台含待办或动态时 |
| [工作台门户布局](references/workbench/portal-layouts.md) | 标准工作台、部门门户、运营工作台 | 页面类型 = workbench 时 |
| [列表表格模式](references/list/table-patterns.md) | 列宽、行密度、批量操作 | 页面类型 = list 时 |
| [筛选模式](references/list/filter-patterns.md) | 常用筛选、高级筛选 | 页面类型 = list 时 |
| [详情抽屉](references/list/drawer-detail.md) | 点行详情、主从上下文 | 列表需要下钻时 |
| [列表三态](references/list/empty-loading-error.md) | empty/loading/error | 列表或数据页需要状态设计时 |
| [单对象叙事](references/detail/object-narrative.md) | 商品/订单/客户/项目的首屏优先级 | 页面类型 = detail 时 |
| [详情章节模式](references/detail/section-patterns.md) | Hero、关键信息、时间线、关联对象 | 页面类型 = detail 时 |
| [时间线与关联对象](references/detail/timeline-and-related.md) | 时间线和关联列表 | 详情页含历史或关联数据时 |
| [Landing 调研等级](references/landing/research-levels.md) | none/light/enhanced/deep | 页面类型 = landing 时 |
| [Landing Section 模式](references/landing/section-patterns.md) | Hero/Proof/Services/Process/Case/CTA | 页面类型 = landing 时 |
| [Landing 素材工作流](references/landing/assets-workflow.md) | landing 专属素材写入 spec | 页面类型 = landing 时 |
| [真实品牌官网 Playbook](references/landing/realistic-brand-homepage.md) | 实景摄影组、材质配色、首屏构图、品牌旅程、无 CDN Sample 兜底和视觉验收 | 强视觉官网或用户反馈“像模板、不真实、图片少”时 |
| [Landing 行业 Playbook](references/landing/industry-playbooks.md) | 茶饮/律所/SaaS/文旅等行业策略 | 官网需要行业化时 |
| [Canvas 设计系统](../yida-canvas-custom-page/references/canvas-design-system.md) | Code Canvas 默认落地层：主题 token、antd token、图表配色、themeScope | 方向定完、交给 Canvas 写 JSX 时 |
| [素材工作流](references/asset-workflow.md) | 图片素材解析、校验、上传、Page Spec 回填和 materialStatus | 需要图标/图片/音效时 |
| [字段与 URL 参考](../../references/field-and-url-reference.md) | 隐藏导航 `isRenderNav=false`、各页面类型 URL 拼接模板、跨页跳转 | Step 0 判定导航形态、自带导航壳拼跳转 URL 时 |
