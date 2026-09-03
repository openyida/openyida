---
name: yida-app
description: 宜搭完整应用开发编排技能。对普通 OpenYida 应用做完整搭建或补齐时使用；先解析资源上下文并消费 yida-design 的 prd.md 与 design.md，再按 PRD 创建或复用应用、表单、流程和页面；页面阶段默认使用 Canvas 发布脚手架注入 yida/utils window 桥。
---

# yida-app

完整应用编排技能。它负责把一次“创建/搭建/补齐应用”的需求拆成资源解析、产品设计、资源落地、页面发布和结果输出。全局 CLI、ID、存储、发布和输出规则以主入口 `SKILL.md` 为准；按步骤执行该步骤所需 `use_skill(...)`。

## 触发条件

用户要求创建、搭建、生成一个完整宜搭应用/系统/平台/管理工具，或已有 app/page 需要补齐成完整业务系统时使用本技能。

## 工作流

按以下 9 个执行步骤顺序推进。每一步开始前先读取对应 workflow 文件；当前步骤达到 doneWhen 后再进入下一步。

| 步骤 | 名称 | 目标 | 产出 |
| --- | --- | --- | --- |
| 1 | [解析资源上下文](workflow/step-1-resource-context.md) | 合并本轮显式资源、绑定上下文、workspace 配置/缓存和会话历史，确认复用还是允许创建 | 目标 app/page/form/process 上下文 |
| 2 | [产品设计](workflow/step-2-design.md) | 执行 `use_skill("yida-design", "完整应用产品设计")`，产出完整 PRD 和视觉契约 | `prd/<项目名>/prd.md` + `prd/<项目名>/design.md` |
| 3 | [创建或复用应用](workflow/step-3-create-or-reuse-app.md) | 已有 `appType` 直接复用；缺少 app 且允许创建时执行 `use_skill("yida-create-app")` | 真实目标 `appType` |
| 4 | [创建或更新业务资源](workflow/step-4-forms-processes.md) | 执行 `use_skill("yida-form-detail")`、`use_skill("yida-create-form-page")`；按 PRD 执行 `use_skill("yida-create-process")`、`use_skill("yida-get-schema")`、`use_skill("yida-report")` 和 `use_skill("yida-integration")` | 真实 `formUuid`、`processCode`、必要 `fieldId/reportId` |
| 5 | [写入初始表单数据](workflow/step-5-seed-records.md) | 执行 `use_skill("yida-data-management")`，为核心普通表单写入 1-3 条业务化 seed records 并 query 抽查 | 真实表单记录或明确跳过原因 |
| 6 | [创建或复用主页面](workflow/step-6-main-page.md) | 已有 display 页面直接复用；缺少主页面且允许创建时执行 `use_skill("yida-create-page")` | 真实主页面 `formUuid` |
| 7 | [编写或更新页面](workflow/step-7-page-code.md) | 执行 `use_skill("yida-canvas-custom-page")`；看板/工作台/驾驶舱必须再执行 `use_skill("yida-dashboard")`，读取表单数据时必须执行 `use_skill("yida-canvas-data-binding")` | 页面源码和真实 dataBinding 通过校验 |
| 8 | [发布页面并排序导航](workflow/step-8-publish-navigation.md) | 执行 `use_skill("yida-publish-page")`，发布本轮源码到主页面并执行轻量导航排序 | 已发布主页面 URL |
| 9 | [输出与收尾](workflow/step-9-output-finish.md) | 核对完成条件，按业务语言输出结果 | 2-3 句业务总结 + 一个主入口链接 |

## 核心规则

1. **资源判断以 Step 1 为准**：已有 app/page/form/process 默认复用；只有用户明确从零创建，或目标缺失且本轮允许创建时，才创建缺失资源。
2. **显式目标优先**：本轮用户给出的 `appType`、`formUuid`、URL、页面名或流程标识，优先级高于绑定上下文和历史缓存；同级冲突或无法唯一识别时才问用户。
3. **设计事实源唯一**：需求分析、资源蓝图、页面结构、导航顺序和验收标准由 `yida-design` 写入 `prd.md`；主题 token、布局、材质、圆角、密度、组件和状态规则由 `design.md` 承担。
4. **阶段技能按需加载**：进入应用壳、表单、流程、页面、发布、数据写入等阶段时，才执行对应 `use_skill(...)`。
5. **真实 ID 和真实数据**：不编造 `appType`、`formUuid`、`fieldId`、`processCode`、`reportId`。完整应用默认给核心普通表单写入 1-3 条业务化 seed records 并 query 抽查；不适合造数时说明原因和空态方案。
6. **自定义页面开发技能固定**：完整应用页面源码按 Step 7 执行。
7. **删除必须确认**：用户要求删除应用时，先展示应用名称、应用 ID 和影响范围，等待明确“确认删除”后才能执行。
8. **列表页选择**：默认使用普通表单的数据管理页；用户明确要求自定义列表页时才创建 display 页面。

## 关键决策树

- 需要收集或存储数据：先创建或复用核心普通表单，再生成页面；纯展示或静态内容可跳过表单创建。
- 需要审批、申请、审核、工单流转：先创建或复用流程表单，再生成页面。
- 需要标准统计：优先创建原生报表；明确高级图表或大屏时，再选择 `yida-rechart` / `yida-chart`。
- 主页面语义为看板、工作台、驾驶舱或 Dashboard：必须加载 `yida-dashboard`；页面读取任何表单业务数据时必须继续加载 `yida-canvas-data-binding`，不能只加载 `yida-canvas-custom-page`。
- PRD 明确包含报表或集成自动化时，它们属于 Step 4 主流程资源，不得推迟到 final 后置建议；自动化动作必须按通知、数据新增/更新、审批完成、定时或手动触发分别建模，不得统一退化成新增通知。

## 页面数据契约

- 默认页面源码不得使用 `this.dataSourceMap.*`，除非本轮已经创建并绑定对应设计器数据源。
- 真实表单数据默认通过页面数据桥或 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)` 读取；流程发起、流程列表、表单保存/更新等能力也通过发布层注入的同一个 yida API 桥调用；不要用前端 seedRows 冒充真实表单数据。
- 页面根级运行态工具通过 `window.__OPENYIDA_UTILS__` 读取，`toast/dialog/openPage/router.push/isMobile` 等工具不能在 `YidaComp` 内直接写 `this.utils.*`。
- 表单新建/提交/详情入口统一使用 `FormOpenContainer`，详情页必须从真实行数据解析 `formInstId`；新版主题由运行容器在自定义页面和提交页/详情页 iframe 分别加载同一应用主题文件。
- 用户明确要求的自定义列表、看板和详情页优先读取真实表单数据；`page-spec.json` 写 `dataBinding.mode=form`、真实 `appType/formUuid/fieldId` 和字段映射。表单数据管理页不另生成页面源码。
- 完整应用默认先写入 1-3 条业务化 seed records 并 query 抽查；没写入成功时，页面展示空态、表单入口、刷新或登记按钮，并在 final 说明原因。
- 若页面确实依赖 `this.dataSourceMap.*`，必须执行 `use_skill("yida-data-source-connectors")` 创建/绑定数据源，并在发布后确认页面 Schema 中存在对应数据源；发布输出出现 `No custom page data sources to preserve` 时，本次发布不能视为完成。

## 完成条件

按 [Step 9：输出与收尾](workflow/step-9-output-finish.md) 核对完成条件。完整应用默认完成点除资源和发布外，还要求已知非空的数据源在主页面显示至少一个一致的 KPI 数量或业务记录；页面全 0、空列表或数据绑定未验证时不得宣称完成。只有 `verdict=pass` 且运行态数据证据通过时才能说“已按 PRD 完成搭建”。

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [Step 1：解析资源上下文](workflow/step-1-resource-context.md) | 只读预检、资源优先级、命令选择、路径口径 | 必读 |
| [Step 2：产品设计](workflow/step-2-design.md) | `yida-design` 产物边界、主题 key、PRD/design.md 消费 | 必读 |
| [Step 3：创建或复用应用](workflow/step-3-create-or-reuse-app.md) | app 复用、app 创建、主题 key | 必读 |
| [Step 4：创建或更新表单/流程](workflow/step-4-forms-processes.md) | 表单、流程、字段 ID、新版应用主题消费与 legacy formDetail 兼容 | 必读 |
| [Step 5：写入初始表单数据](workflow/step-5-seed-records.md) | seed records、字段类型、query 抽查、跳过条件 | 必读 |
| [Step 6：创建或复用主页面](workflow/step-6-main-page.md) | display 页面复用、页面创建、corpId 一致性检查 | 必读 |
| [Step 7：编写或更新页面](workflow/step-7-page-code.md) | 页面源码、page-spec、dataBinding、本地校验 | 必读 |
| [Step 8：发布页面并排序导航](workflow/step-8-publish-navigation.md) | publish、导航排序、发布完成证据 | 必读 |
| [Step 9：输出与收尾](workflow/step-9-output-finish.md) | final 口径、URL 规则、可选后置、错误处理 | 必读 |
| [常见问题解决思路](references/common-issues.md) | 资源冲突、字段 ID、seed records、页面数据、发布失败、输出口径等高频问题 | 遇到异常或执行结果不符合预期时 |
