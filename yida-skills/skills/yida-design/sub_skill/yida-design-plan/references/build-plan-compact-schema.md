# 计划编写契约（schemaVersion 2.0）

## 输入与生成

`design-plan init` 从已确认需求建立草稿、主题上下文和业务/视觉片段，返回必要任务与可选视觉精修。CLI 预填已确认的风格、主色和导航；模型补齐业务内容及每个自定义页的具体设计。未完成的片段由返回任务处理，主题提供公共规则，不代替逐页决定。片段写入与合并见 [并行交接](../../../../yida-app/workflow/parallel-work.md#plan-的-cli-交接)。保留生成的项目目录名、页面 ID 与 sceneKey；业务名称使用 `meta.appName`。补齐业务与视觉片段后执行交接命令；标准首版使用 init 返回的 `materialize.command`：

init 已预填 `business.json` 结构，业务任务先读后写并保留 base。`authoring.pendingFields` 列出初始化时的待补文件、字段路径与说明；格式示例位于返回的 `context` 文件。示例用于说明类型，实际值按当前业务填写。复核内容后将片段设为 `ready=true`，最终生成继续执行完整校验。业务 facts 仅允许 overview、dataModels、businessFlows、pages、execution；visualStyle 只属于 `visual.json`。首次合并前一次补齐每个普通表单的 sampleDataPlan（跳过则写 skipReason）和每个自定义页面的 permissionSummary，避免用多轮 materialize 探测必填字段。

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --business-file prd/<项目名>/business.json --visual-file prd/<项目名>/visual.json --json
```

CLI 校验源事实，使用预置模板整批生成 `prd.md`、`design.md` 和 `build-plan.html`。模板标准规则、摘要、设计路径和默认交接字段自动补齐。模型只维护源事实及项目差异。

## 元信息与需求总览

| 字段 | 写入内容 |
| --- | --- |
| `meta.projectName/appName/revision` | CLI 初始化；projectName 为稳定目录名，appName 为展示名称，revision 标识当前版本 |
| `meta.businessDomain/experienceTopology` | 业务领域与产品形态，如采购管理、内部协作系统 |
| `meta.source` | 来源文件或来源说明；详细需求继续保留在共享 brief 中 |
| `meta.status/planState` | 编排维护草稿、展示和确认状态，规则见下文 |
| `overview.summary` | 应用定位、核心用户、业务目标 |
| `overview.rolePermissionSummary` | 角色与可见、可操作的数据范围，非空文本数组 |
| `overview.businessGraph.relations` | `{from,to,label,description}` 数组，from/to 使用 `dataModels[].name` 的完整表名；一表一节点，不为简称另建节点，无关系写 `[]` |
| `overview.navigationSummary` | 有菜单分组或特殊入口安排时填写文本数组 |
| `overview.flowSummary` | 存在独立业务规则或额外流程说明时保留；规则同时写入对应流程明细 |

业务全景节点、数据模型摘要、页面概览和视觉摘要由 CLI 派生。

自定义导航在 `overview.navigationSummary` 记录布局、用途和打开方式：展示页顶部叠加共同背景，工作区占位；侧边及混合布局支持折叠、恢复宽度和拖拽。`firstScreenStructure/signatureInteraction` 保留相应设计与交互，CLI 示例不是默认外观。管理走 workbench、填写走 submission，同一表单可有两个入口；区分本页视图、主内容 iframe、保留壳的跨页跳转，沿用 [导航规则](../../../../yida-nav-shell/SKILL.md)，不另问实现字段。

## 数据模型与流程

每个 `dataModels[]` 保存：

```json
{
  "name": "采购订单",
  "formType": "宜搭表单",
  "description": "记录订单及交付进度",
  "views": ["全部订单", "待交付订单"],
  "fields": [
    {"name":"订单编号","type":"单行文本","required":true,"defaultOrOptions":"自动编号","relation":"","group":"基本信息","description":"订单唯一标识"}
  ],
  "sampleRecords": [{"订单编号":"PO-001"}]
}
```

流程表单的 `formType` 使用“宜搭流程表单”。字段保留类型、必填、默认值或选项、关联对象、分组和业务说明。普通表单提供 1–3 条示例记录，使用字段名称作为键并覆盖必填字段；确需跳过时填写 `skipSampleReason`。

每个 `businessFlows[]` 保存 `{name,type,description,trigger,nodes,rules}`。trigger 写触发条件，nodes 为有序节点数组，rules 为条件与执行结果的文本数组。已知业务规则进入相应流程明细，无流程写 `[]`。

## 自定义页面

每个 `pages.customPageDetails[]` 保存：

| 字段 | 内容 |
| --- | --- |
| `pageId/sceneKey/name` | 稳定 ID、稳定场景 key、业务名称；sceneKey 位于页面顶层 |
| `positioning/primaryUsers/primaryTask` | 页面定位、用户数组、核心任务 |
| `blocks` | 按优先顺序填写 `{name,purpose}` 数组，每项写区块名称和具体业务用途 |
| `contentPriority` | 有独立优先级设计时填写；省略时由结构化 blocks 的顺序和名称派生 |
| `firstScreenStructure/signatureInteraction` | 首屏布局与关键交互 |
| `layoutPattern` | `{id,reason,adaptations}`；id 从当前上下文的页面模式选择，adaptations 只写项目差异 |
| `contentRichness.contentLayers` | 有额外内容层次设计时填写非空数组；省略时由结构化 blocks 的名称和用途派生 |
| `density/permissionSummary` | 信息密度与权限说明 |
| `dataBinding/dataSources` | `form/report/connector/static-empty`；来源为名称数组，form 对应已有模型 |
| `emptyReason` | static-empty 时填写原因，并将 dataSources 设为 `[]` |

例如 `blocks: [{"name":"客房选择","purpose":"按日期和人数筛选可预约房型"},{"name":"预约结果","purpose":"查看提交结果，失败时保留输入并显示原因"}]`。每项仅使用 name、purpose；业务动作和成功、失败处理写入用途或 signatureInteraction。现有字符串 blocks 继续配合 contentPriority 与 contentRichness.contentLayers 使用；已填写的独立设计原样保留。

页面模式的 mode、mustKeep、丰富度标准、页面概览由 CLI 补齐。页面按任务选择模式，工作台通常在首位。报名、申请、登记入口承接表单提交；查询和维护承接数据管理。

只有覆盖默认值时才写 `pageSpecHandoff`，允许的字段为：

- `scene`：`workbench/dashboard/list/detail/landing/screen`，也可写在页面顶层；与页面模式 ID 分开。
- `pageStructure`：`workbench/dashboard-overview/business-list/detail-profile/official-homepage/data-screen/split-pane-detail/portal-shell-home`。
- `entryMode`：`platform-shell/standalone`；应用级 custom 及独立前台使用 standalone，后台平台页面使用 platform-shell。
- `navigation`：可选的当前入口菜单 `{type:"custom",variant:"top",reason:"员工只办理自己的事项"}`，variant 为 top/side/mixed/dock；无菜单用 `{type:"none",reason:"单步办理"}`。只能用于 standalone，不接受应用设置字段。省略则沿用既有入口规则；CLI 不据此修改应用 navigationType。
- `contentBlocks/dataSources/dataBinding/emptyReason/primaryAction/themeSummary`：本页交接差异。
- `designFile/designRefs`：源计划默认引用 `prd/<projectName>/design.md`；生成时 designFile 指向实际输出文件，designRefs 包含 `themeProfile`、`sceneRecipes.<sceneKey>`。额外引用须存在于最终设计文档的 components、states 或 sceneRecipes 中。

## 视觉事实

`visualStyle` 保存项目选择和差异：

应用风格可选择目录中的模板，也可使用 `catalog.creativeOption` 的独立创意入口。后者必须补齐 `visualStyle.creativeDirection`（业务推演、构图、字体、材质、表单布局）与显式设计 Token；详见[应用风格模板与自由创意](../../../references/application-style-library.md)。初始化不会把缺失创意决策标成已完成。

在 `visual.json` 中它位于 `facts.visualStyle`。沿用 init 生成的 `forUser.visualDirection` 和 `forUser.navigationStyle` 对象，只编辑内部字段，不改成字符串或数组。`DESIGN_PLAN_VISUAL_FIELD_TYPE_INVALID` 会给出字段路径与对象示例；示例只说明结构，实际值沿用已确认的视觉选择。

```json
{
  "forUser": {
    "visualDirection": {"label":"清晰柔和","description":"突出待办与业务状态，浅色界面搭配暖棕色重点操作","source":"user_selected"},
    "colorStrategy": {"primaryColor":"#6F4E37","primaryColorName":"暖棕色","source":"user_selected","usage":"暖棕浅底、白色卡片与品牌焦点协调"},
    "navigationStyle": {"structure":"side","tone":"light","toneSource":"theme_derived","source":"user_selected","selectionReason":"沿用已选的左侧导航；浅色导航由主题模板派生"},
    "iconSystem": {"library":"lucide-react","mappings":{"新建采购":"Plus"}},
    "pageApplications": [
      {"pageId":"page-1","primaryAction":"列表标题右侧的新建采购按钮打开原生采购表单，成功后刷新列表","firstScreenFocus":"先看到待处理采购数量与最紧急记录，主操作紧邻列表标题","layout":"顶部单行筛选与主操作，下方连续采购列表；必要提示放列表右侧窄栏，列表随记录自然增长","responsive":"窄屏筛选换行，提示移到列表下方，表格保留关键列并允许横向滚动","acceptanceChecks":["首屏可找到待处理记录与新建采购操作","窄屏主操作和错误恢复入口可用"],"visualMemoryApplications":[{"name":"摘要拼接组","renderPolicy":"prd_match_only","target":"采购待办摘要","reason":"页面已有并列的待办状态"}]}
    ],
    "assetStrategy": {"materialStatus":"none","pages":[{"pageId":"page-1","imageNeed":"none","reason":"纯数据操作页","slots":[]}],"missingAssets":[],"notes":"无图片需求"}
  },
  "internal": {"selectedTheme":{"themeId":"soft-outline-rhythm","source":"user_selected"}},
  "forDesignMd": {"productTopologyApplication":"工作台与表单共享主题，视觉重点绑定已有采购任务"}
}
```

- 已选主题取当前上下文；主色为 6 位 HEX。导航 `structure` 为模型维护的 top/side；`tone` 为 CLI 从所选主题模板 `navTheme` 派生的 light/dark，并带 `toneSource=theme_derived`，模型不得修改。导航与内容界面的明暗分开记录。
- 每个实际自定义页使用相同 pageId，最终物化前必须填写 firstScreenFocus、layout、primaryAction、responsive 四项具体说明和 acceptanceChecks 非空字符串数组；内容须具体到当前页，不能只写继承主题。纯原生页无需增加记录。
- 视觉记忆点按适用条件绑定真实区块，无匹配时保留空数组。草稿缺逐页决定可预览，最终产物拒绝缺项；旧计划沿用同一规则，补齐后再物化。
- `visualStyle.evidence/constraints` 保留实际视觉依据和约束。
- `forUser.iconSystem` 可选，包含 `library: "lucide-react" | "@ant-design/icons"` 与 `mappings: {业务语义: 具体组件名}`。有底盒或状态背景时，按 [图标输出契约](../../../workflow/output-design.md#图片素材与图标) 补充 `colorPairs`。初始化保留 brief 的已选图标映射；仅未配置时默认 lucide-react 与空映射。
- `visualStyle.tokens` 可写具体单行 CSS token 差异，如 `{"--pod-card-border-radius":"16px"}`。品牌色阶由主色派生；themeProfile 为只读摘要。
- 最终 design.md 按 [公共输出契约](../../../workflow/output-design.md) 生成并校验：机器数据和 anchor 索引留在 frontmatter，完整规则只写在五章正文一次。主题的 token、组件、状态与公共响应式由 CLI 注入，页面具体布局和响应式来自上述输入。项目独有组件调整时再读模板对应章节；整体暗色主题按需读取暗色浮层规则。

## 执行交接

`execution` 为可选差异对象，CLI 默认生成资源蓝图、应用先于表单及页面的创建顺序、页面实现顺序、示例数据计划、交互状态和验收标准。模型按依赖顺序排列，有特殊要求时写：

| 字段 | 格式 |
| --- | --- |
| `appConfig` | 已知真实 `appType/corpId/baseUrl`；`navigationType` 为 platform-l-shape/platform-top/platform-side/custom。仅代表应用工作区；hideAppNav/layoutDirection/navTheme/logoSource 由应用导航与视觉派生，不被前台菜单覆盖 |
| `explicitScope` | 用户明确的页面、表单、流程、报表、导航和交付范围；`allowInferredResources=false` 时不增加未点名的 seed records、自定义页面、主题或导航任务；自定义导航布局保留在 navigation.variant |
| `resourceBlueprint` | `{name,type,purpose,pageId?}` 数组；type 为 normal-form/process-form/display-page/report，名称与模型、页面对应且唯一 |
| `resourceCreationOrder` | 覆盖全部资源的有序名称数组，先应用，再被依赖模型，最后依赖它们的页面 |
| `pageImplementationOrder` | 覆盖全部页面的 pageId 或名称数组 |
| `entryRecommendation` | 保留 brief 入口建议，按 [访问态入口契约](../../../../yida-app/references/entry-navigation.md) 补齐各入口 role/menu/defaultMenuKey/access；两端均为访问态，管理端无需首页 |
| `navigationOrder/navigationFallback` | 旧计划的菜单顺序或排序策略；提供 entryRecommendation 时从管理菜单派生，不混入前台菜单，重复声明必须一致 |
| `sampleDataPlan` | `{form,records}` 或 `{form,skipReason}` 数组，覆盖全部普通表单 |
| `interactionStates` | 对象，键为 empty/loading/error/formEntry/detail，值为非空业务说明；例如 `{"empty":"展示空态和新建入口","error":"保留输入并提示失败原因"}` |
| `acceptanceCriteria` | 项目特有的业务验收条件，非空文本数组；CLI 与按资源生成的通用检查合并并去重 |

### 派生的页面导航策略

PRD 实施交接中的 `pages[].navigationPolicy` 与 `pageSpecHandoff` 同级，由 CLI 生成，不是 build-plan.json、business.json、brief 或 page-spec.json 的输入字段。派发页面任务时一并传递；Fast 在 PRD/design.md 明确同样边界。

| 条件 | applicationMenuOwner | pageLayout | renderApplicationMenu | localTabs |
| --- | --- | --- | --- | --- |
| platform-shell | platform | content-only | false | same-task-only |
| standalone 且显式 custom 菜单，或沿用应用级 custom | page | standalone | true | planned-views |
| standalone 显式 none，或未规划菜单且应用保留平台导航 | none | standalone | false | same-task-only |

`duplicatePlatformMenu` 始终为 false；显式 none 优先于应用级 custom。策略描述实现约束，不代表线上导航已配置或已通过视觉验收。实际菜单过滤的 `mode=platform` 仅指自绘菜单的数据来源，不表示平台工作区应再渲染菜单。

源 JSON 保留完整项目事实，派生后的 PRD 包含完整 11 章业务与实施交接；HTML 仅按 [展示规范](../assets/README.md#需求确认内容范围) 呈现需求确认内容，不减少 PRD 或设计文档的交接要求。

## 调整与确认

调整现有方案按 [局部调整](../../../../yida-app/workflow/plan/step-4-deliver.md#4-处理调整) 执行；本节只说明版本和校验规则。

初始化 revision=1；未展示的首次合并、preview 汇总和内部 patch 保持当前版。已展示或已确认的当前版发生实质修改才升版并清空确认；相同内容不升版。旧文件缺少 planState 时保守升版。片段仍以 base.digest 校验来源，版本相同也不能复用过期片段。仅更新素材 materialStatus/missingAssets 保留版本与确认。

展示成功后必须将 `meta.planState.presentedRevision=meta.revision` 写回源 JSON，仅更新展示事实，不再物化。awaiting_confirmation 仅表示准备确认，不证明已展示；收到明确确认后绑定 confirmedRevision、planConfirmed 与同版产物，按应用流程交接。内部补全不得伪造展示或确认记录。`--materialize` 同步变化的文档内容和主题变量，`updated` 列出实际写入的产物；不带此参数只校验并保存源事实，不渲染 HTML，也不更新文档。可选字段范围见下节。

旧版无 schemaVersion 或 1.x 文件继续使用原结构；维护旧计划时按需查阅旧版结构说明。

## 可选字段 patch 与完成校验

CLI 集中返回可独立检查的问题及字段路径，再执行完整业务、主题和 HTML 校验。按问题清单一次补齐源事实后重试；草稿空值表示待规划，全部校验通过才写入派生产物。仅做诊断时使用 `--check`。

自由创意（`free-creative`）没有模板导航默认值：在 `navigationStyle.tone` 明确填写项目设计的 `light` 或 `dark`，CLI 标记 `toneSource=project_defined`；此路径可通过 patch 调整 tone，并同步配套导航 Token。命名模板仍按模板派生导航明暗。
