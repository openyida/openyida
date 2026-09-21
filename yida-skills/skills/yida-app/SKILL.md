---
name: yida-app
description: 创建完整宜搭应用，或补齐已有应用时使用。先确认核心功能和实际用法；Fast 直接搭建，Plan 先确认方案。由 yida-prd 和 yida-design 同时准备业务与基础视觉，校验后创建或复用资源；表单/流程先于自定义页面。页面 UI 按已确认设计实现，代码示例按需参考；前后台都规划菜单顺序与默认页面，发布后分别验收实际入口。
---

# yida-app

完整应用编排技能。它负责把一次“创建/搭建/补齐应用”的需求拆成资源解析、产品设计、资源落地、页面发布和结果输出。全局 CLI、ID、存储、发布和输出规则以主入口 `SKILL.md` 为准；按步骤执行该步骤所需 `use_skill(...)`。

完整应用交付默认保留开发者管理后台（CLI `adminUrl`），与业务后台区分：有前后台时共三个地址；仅前台或统一工作区时共两个地址。登录态来源不影响 `/admin` 的交付；单页任务保持单页范围，用户明确排除的入口优先。详见 Step 9。

## 模式入口（先按这里路由）

首次需求澄清优先进入 Step 2 的 2.0；首问前不执行 Step 1 的环境和资源预检，已有明确资源引用作为需求上下文保留。澄清完成后再按需核验资源、补齐规划输入。

已有任务先按 [续做与恢复](#续做与恢复) 定位当前阶段。

需求确认不能替代当前 Plan revision 的批准或工具权限确认。`intake.designMode` 沿用用户最后一次明确选择，其他问题的回答只更新对应字段。Plan 收到与当前 revision 匹配的 `confirm_build` 后进入资源实施；选择 `continue_editing` 时修改当前计划，生成新 revision 后再确认。素材进度更新不改变已有的需求确认和模式选择。

Plan 规划阶段的工作流入口只读取 `workflow/step-1-resource-context.md`、`workflow/step-2-design.md` 和精确路径 `workflow/plan/workflow.md`；后者已经包含完整 Plan 入口。禁止用 Glob 查找 Plan 文件，也不要额外读取 `workflow/plan/step-1-understand.md` 或 `workflow/plan/step-2-confirm.md`。此读取范围不限制确认后的实施、验收和交付，各阶段按需读取对应 workflow。Plan 确认恢复后，若 `explicitScope.allowInferredResources=false`，直接读取 `workflow/step-4-forms-processes.md` 实施范围内资源，不再重读 Step 1、调用 list-forms 或做应用设置预检。

## 续做与恢复

先判断本轮是否已有有效需求确认：历史回答或同任务 `intake.confirmed=true` 覆盖当前范围且未被撤回时，复用答案、PRD、设计和资源回执，从未完成阶段继续。刷新、恢复、压缩或用户说“继续”不触发重新首问；仅应用已存在也不代表需求已确认。状态不明时先只读核对当前任务材料；范围变更、材料缺失或冲突按 [需求分析的适用阶段与续做](../yida-requirement-analysis/workflow/prepare-brief.md#适用阶段与续做) 处理。

已发布但尚未完成本轮导航、验收或交付时，按缺项进入 [Step 8](workflow/step-8-publish-navigation.md) 或 [Step 9](workflow/step-9-output-finish.md)，不返回需求首问。发布成功回执不能替代实际验收。

## 执行步骤（进行时展示给用户）

先从已经确认的 `execution.explicitScope` 生成本轮步骤，再开始资源实施。步骤对应范围内资源和交付；资源成功回读后从内部执行队列中移除，用户待办保留并标记完成。`allowInferredResources=true` 表示完整应用交付，可使用下面的完整应用模版；`allowInferredResources=false` 表示边界已闭合，使用“需求识别与分析 / 设计功能和页面 / 确认搭建方案（Plan）+ 范围内资源步骤 + 检查范围并交付”的精简步骤。

完整应用搭建时使用对应模式的步骤名称。

**Plan 模式**

1. 需求识别与分析
2. 设计功能和页面
3. 确认搭建方案
4. 创建应用
5. 搭建表单与审批流
6. 准备示例数据
7. 准备页面图片
8. 搭建业务页面
9. 发布页面与配置导航
10. 检查功能并交付

**Fast 模式**

1. 需求识别与分析
2. 设计功能和页面
3. 创建应用
4. 搭建表单与审批流
5. 准备示例数据
6. 准备页面图片
7. 搭建业务页面
8. 发布页面与配置导航
9. 检查功能并交付

按本轮范围选用步骤：已有应用时省略“创建应用”，无需示例数据或图片时省略对应步骤，并重新编号。

用户明确把本轮交付限定为一个或若干具体表单、流程、报表或页面时，按 `explicitScope` 只保留达到该交付所需的步骤；即使需求背景使用“应用/系统”，也不自动补示例数据、自定义工作台、主题设置、导航排序或其他资源。Plan 模式仍生成并确认方案，但确认后只执行该窄范围。

若窄范围只要求创建一个普通表单并交付链接，成功的 `create-form create` 结果就是本轮资源回读证据。`url` 是兼容字段，与 `formUrl` 表示同一表单入口；`appUrl` 表示应用工作台入口。按用户要求的入口层级选择权威字段，资源保存成功且证据齐全后完成当前范围；证据缺失时执行一次针对性只读回查。普通表单保存成功后进入可用状态，自定义展示页遵循页面发布生命周期。

每项待办对应一个阶段，直接使用上方短标题。创建应用、表单、数据、图片、页面和发布分别展示。执行中保持标题与列表顺序稳定，完成后标记完成并保留记录。图片准备与表单、页面搭建可同时进行，列表顺序仅用于展示。业务细节写在进度消息中，任务编号、命令、路径、授权依据和耗时写入内部执行记录；用户要求的耗时统计集中放入报告。素材采集与应用创建同时进行时，进度描述统一为“素材采集&应用创建”；单独进行时使用对应阶段名称。图片数量、用途及任务详情归入内部执行记录。

## 触发条件

用户要求创建、搭建、生成一个完整宜搭应用/系统/平台/管理工具，或已有 app/page 需要补齐成完整业务系统时使用本技能。

## 工作流

完整应用先分析需求；首次搭建按 yida-requirement-analysis/workflow/prepare-brief.md 确认未决事项，再进入已选 Fast / Plan。两种模式共享需求分析与 PRD 契约，以下并行生成规则用于 Fast；Plan 确认当前版本后交接派生文件，直接进入 Step 3。只有 Plan 的 build-plan.html 用于方案展示，其余设计文件保持内部使用。

以下 9 步仅用于内部执行，不复制为宿主待办；用户可见的步骤名称直接使用上方“步骤模版”。需求首问前只读本阶段必需材料；后续每一步开始前读取对应 workflow 文件；按真实依赖满足下游输入后继续。Step 3 拿到 appType 即可启动表单创建，主题生成与设置同步作为独立分支继续，不将主题完成作为所有后续步骤的串行前置条件。无直接依赖的页面同时开发，每页只等待自身资源，独立校验并发布；全部页面完成后再统一导航排序。

| 步骤 | 名称 | 目标 | 产出 |
| --- | --- | --- | --- |
| 1 | [解析资源上下文](workflow/step-1-resource-context.md) | 合并本轮显式资源、绑定上下文、workspace 配置/缓存和会话历史，确认复用还是允许创建 | 目标 app/page/form/process 上下文 |
| 2 | [业务与视觉设计](workflow/step-2-design.md) | 整理需求后按 Fast 并行生成，或按 Plan 生成方案并确认；校验 PRD 与视觉契约 | 内部 `requirement-brief.json` + `prd.md` + `design.md` |
| 3 | [创建或复用应用](workflow/step-3-create-or-reuse-app.md) | 已有 `appType` 直接复用；缺少 app 且允许创建时执行 `use_skill("yida-create-app")` | 真实目标 `appType` |
| 4 | [创建或更新业务资源](workflow/step-4-forms-processes.md) | 执行 `use_skill("yida-create-form-page")`；按 PRD 执行 `use_skill("yida-create-process")`、`use_skill("yida-get-schema")`、`use_skill("yida-report")` 和 `use_skill("yida-integration")` | 真实 `formUuid`、`processCode`、必要 `fieldId/reportId` |
| 5 | [写入初始表单数据](workflow/step-5-seed-records.md) | 执行 `use_skill("yida-data-management")`，为核心普通表单写入 1-3 条业务化 seed records 并 query 抽查 | 真实表单记录或明确跳过原因 |
| 6 | [创建或复用主页面](workflow/step-6-main-page.md) | 已有 display 页面直接复用；PRD 明确需要且缺失时执行 `use_skill("yida-create-page")` | 真实主页面 `formUuid` |
| 7 | [编写或更新页面](workflow/step-7-page-code.md) | 按 `design.md.assetStrategy` 加载素材、页面、看板和数据绑定技能 | 素材状态明确；页面源码和 dataBinding 通过校验 |
| 8 | [发布页面并排序导航](workflow/step-8-publish-navigation.md) | 执行 `use_skill("yida-publish-page")`，发布本轮源码到主页面并执行轻量导航排序 | 已发布主页面 URL |
| 9 | [输出与收尾](workflow/step-9-output-finish.md) | 核对完成条件，按业务语言输出结果 | 2-3 句业务总结 + 一组应用访问入口 |

独立工作按 [并行执行](workflow/parallel-work.md) 调度，任务分别产出，由主流程汇合。完整应用在计划或主题确认后生成主题 CSS，appType 和 CSS 就绪就同步应用设置；`explicitScope.allowInferredResources=false` 的资源级交付不生成或上传主题、不修改应用设置、不排序导航。

## 核心规则

素材准备先核实宿主后台 Agent 与后台 Bash 能力。按 materialize.assetTasks[].executionContract 派发后立即继续主流程；QwenWork 核实 Bash.run_in_background 后可后台执行脚本步骤。只有同步工具时先做已授权资源及独立页面工作，再分批素材，禁止将整包素材前置。仅在对应页面接图/验收时等待该页结果；执行记录按 [并行执行](workflow/parallel-work.md) 汇总校验。

1. **资源判断以 Step 1 为准**：已有 app/page/form/process 默认复用；只有用户明确从零创建，或目标缺失且本轮允许创建时，才创建缺失资源。
2. **显式目标优先**：本轮用户给出的 `appType`、`formUuid`、URL、页面名或流程标识，优先级高于绑定上下文和历史缓存；同级冲突或无法唯一识别时才问用户。
3. **产品与视觉分工**：`yida-requirement-analysis` 先统一整理用户需求；业务目标、资源蓝图、页面结构、导航顺序和验收标准由 `yida-prd` 写入 `prd.md`；主题 token、布局、材质、圆角、密度、组件和状态规则由 `yida-design` 写入 `design.md`。两份文件校验通过前不得创建资源。
4. **阶段技能按需加载**：进入应用壳、表单、流程、页面、发布、数据写入等阶段时，才执行对应 `use_skill(...)`。
5. **真实 ID 和真实数据**：不编造 `appType`、`formUuid`、`fieldId`、`processCode`、`reportId`。无显式窄范围的完整应用默认给核心普通表单写入 1-3 条业务化 seed records 并 query 抽查；`explicitScope.allowInferredResources=false` 时不得增加未点名的 seed records 或页面。
6. **自定义页面开发技能固定**：完整应用页面源码按 Step 7 执行；管理端仅需原生视图时不创建 display 首页。前后台按 [访问态入口契约](references/entry-navigation.md) 分别规划菜单及分组顺序、默认页面、首屏任务和权限；平台导航与自定义导航都要落实排序并验收。
7. **删除必须确认**：用户要求删除应用时，先展示应用名称、应用 ID 和影响范围，等待明确“确认删除”后才能执行。
8. **页面实现选择**：前台默认一个 coding 页承载已选任务的多个视图；后台按操作效率选择原生或 coding。平台数据管理满足任务时可复用，需要不同交互时由 AI 为已选功能规划自定义视图。
9. **交付物收口**：Step 2 的三个文件和 Step 9 的 build manifest 都是内部文件，不是用户交付物。表单、流程、报表和页面只在业务总结中概述，不逐项生成用户可见附件；宿主支持交付工具时，final 只交付一次“应用访问入口”组。
10. **范围完成点**：以 `explicitScope` 的资源集合为任务队列；集合清空且真实链接已交付时，本轮完成。完整应用默认完成条件只在 `allowInferredResources=true` 时生效。

## 关键决策树

- 需要收集或存储数据：先创建或复用核心普通表单，再生成页面；纯展示或静态内容可跳过表单创建。
- 需要审批、申请、审核、工单流转：先创建或复用流程表单，再生成页面。
- 需要标准统计：优先创建原生报表；明确高级图表或大屏时，再选择 `yida-rechart` / `yida-chart`。
- 按页面主任务选技能：经营分析、指标判断或投屏监控页面加载 `yida-dashboard`；待办、操作队列、业务列表和门户式工作台由 `yida-canvas-custom-page` 实现，不能仅凭“工作台”或“看板”名称加载经营看板技能。页面读取任何表单业务数据时继续加载 `yida-canvas-data-binding`。
- PRD 明确包含报表或集成自动化时，它们属于 Step 4 主流程资源，不得推迟到 final 后置建议；自动化动作必须按通知、数据新增/更新、审批完成、定时或手动触发分别建模，不得统一退化成新增通知。

## 页面数据契约

- 默认页面源码不得使用 `this.dataSourceMap.*`，除非本轮已经创建并绑定对应设计器数据源。
- 真实表单数据默认通过页面数据桥或 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)` 读取；流程发起、流程列表、表单保存/更新等能力也通过发布层注入的同一个 yida API 桥调用；不要用前端 seedRows 冒充真实表单数据。
- 页面根级运行态工具通过 `window.__OPENYIDA_UTILS__` 读取，`toast/dialog/openPage/router.push/isMobile` 等工具不能在 `YidaComp` 内直接写 `this.utils.*`。
- 自定义页内普通表单新建/提交/详情必须接入 CLI 提供的 `FormOpenContainer` 抽屉模板，前台全码开发也不豁免；调用 `openForm` 并挂载 `formOpenContainer`，详情页从真实行数据解析 `formInstId`。不另写普通填写表单、直接跳转或简化弹层。
- 用户明确要求的自定义列表、看板和详情页优先读取真实表单数据；`page-spec.json` 写 `dataBinding.mode=form`、真实 `appType/formUuid/fieldId` 和字段映射。表单数据管理页不另生成页面源码。
- 完整应用默认先写入 1-3 条业务化 seed records 并 query 抽查；没写入成功时，页面展示空态、表单入口、刷新或登记按钮，并在 final 说明原因。
- 若页面确实依赖 `this.dataSourceMap.*`，必须执行 `use_skill("yida-data-source-connectors")` 创建/绑定数据源，并在发布后确认页面 Schema 中存在对应数据源；发布输出出现 `No custom page data sources to preserve` 时，本次发布不能视为完成。

## 完成条件

按 [Step 9：输出与收尾](workflow/step-9-output-finish.md) 核对完成条件。包含自定义数据页面的完整应用，完成点除资源和发布外，还要求已知非空的数据源在该页面显示至少一个一致的 KPI 数量或业务记录；仅原生管理视图以真实列表和权限验证为准，不追加首页；页面全 0、空列表或数据绑定未验证时不得宣称完成。只有 `verdict=pass` 且运行态数据证据通过时才能说“已按 PRD 完成搭建”。

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [Step 1：解析资源上下文](workflow/step-1-resource-context.md) | 只读预检、资源优先级、命令选择、路径口径 | 必读 |
| [Step 2：业务与视觉设计](workflow/step-2-design.md) | 模式选择、业务与视觉交接、主题文件交付 | 必读 |
| [Step 3：创建或复用应用](workflow/step-3-create-or-reuse-app.md) | app 复用、app 创建、主题文件与导航配置 | 必读 |
| [Step 4：创建或更新表单/流程](workflow/step-4-forms-processes.md) | 表单、流程、字段 ID 与表单结构规则 | 必读 |
| [Step 5：写入初始表单数据](workflow/step-5-seed-records.md) | seed records、字段类型、query 抽查、跳过条件 | 必读 |
| [Step 6：创建或复用主页面](workflow/step-6-main-page.md) | display 页面复用、页面创建、corpId 一致性检查 | 必读 |
| [Step 7：编写或更新页面](workflow/step-7-page-code.md) | 页面源码、page-spec、dataBinding、本地校验 | 必读 |
| [Step 8：发布页面并排序导航](workflow/step-8-publish-navigation.md) | publish、导航排序、发布完成证据 | 必读 |
| [Step 9：输出与收尾](workflow/step-9-output-finish.md) | final 口径、URL 规则、可选后置、错误处理 | 必读 |
| [常见问题解决思路](references/common-issues.md) | 资源冲突、字段 ID、seed records、页面数据、发布失败、输出口径等高频问题 | 遇到异常或执行结果不符合预期时 |


应用整体设计可使用[应用风格模板或自由创意](../yida-design/references/application-style-library.md)。导航、自定义页面、表单与详情继承同一设计语言；自由创意从业务推演，不强制选模板。模板中的表单布局 JSON 提供结构起点，使用时填入真实字段并核对间距和响应式。
