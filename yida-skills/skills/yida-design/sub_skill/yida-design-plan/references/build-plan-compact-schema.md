# 计划编写契约（schemaVersion 2.0）

## 输入与生成

`design-plan init` 从已确认需求建立草稿、主题上下文和业务/视觉片段，返回并行任务与依赖。片段写入与合并见 [并行交接](../../../../yida-app/workflow/parallel-work.md#plan-的-cli-交接)。保留生成的项目目录名、页面 ID 与 sceneKey；业务名称使用 `meta.appName`。补齐业务与视觉片段后执行并行交接命令；直接维护单一计划时使用：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --json
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
| `overview.businessGraph.relations` | `{from,to,label,description}` 数组，from/to 对应数据模型名称；无关系写 `[]` |
| `overview.navigationSummary` | 有菜单分组或特殊入口安排时填写文本数组 |
| `overview.flowSummary` | 存在独立业务规则或额外流程说明时保留；规则同时写入对应流程明细 |

业务全景节点、数据模型摘要、页面概览和视觉摘要由 CLI 派生。

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
| `contentPriority/blocks` | 内容优先级数组、功能区块数组 |
| `firstScreenStructure/signatureInteraction` | 首屏布局与关键交互 |
| `layoutPattern` | `{id,reason,adaptations}`；id 从当前上下文的页面模式选择，adaptations 只写项目差异 |
| `contentRichness.contentLayers` | 实际业务需要的决策、任务、上下文、异常或下一步内容，非空数组 |
| `density/permissionSummary` | 信息密度与权限说明 |
| `dataBinding/dataSources` | `form/report/connector/static-empty`；来源为名称数组，form 对应已有模型 |
| `emptyReason` | static-empty 时填写原因，并将 dataSources 设为 `[]` |

页面模式的 mode、mustKeep、丰富度标准、页面概览由 CLI 补齐。页面按任务选择模式，工作台通常在首位。报名、申请、登记入口承接表单提交；查询和维护承接数据管理。

只有覆盖默认值时才写 `pageSpecHandoff`，允许的字段为：

- `scene`：`workbench/dashboard/list/detail/landing/screen`，也可写在页面顶层；与页面模式 ID 分开。
- `pageStructure`：`workbench/dashboard-overview/business-list/detail-profile/official-homepage/data-screen/split-pane-detail/portal-shell-home`。
- `entryMode`：`platform-shell/standalone`；自定义导航由 CLI 使用 standalone。
- `contentBlocks/dataSources/dataBinding/emptyReason/primaryAction/themeSummary`：本页交接差异。
- `designFile/designRefs`：默认由 CLI 生成 `prd/<projectName>/design.md` 和 `themeProfile`、`sceneRecipes.<sceneKey>`。额外引用须存在于最终设计文档的 components、states 或 sceneRecipes 中。

## 视觉事实

`visualStyle` 保存项目选择和差异：

```json
{
  "forUser": {
    "visualDirection": {"label":"清晰柔和","description":"突出待办与业务状态，浅色界面搭配暖棕色重点操作","source":"user_selected"},
    "colorStrategy": {"primaryColor":"#6F4E37","primaryColorName":"暖棕色","source":"user_selected","usage":"主操作与选中状态"},
    "navigationStyle": {"structure":"side","tone":"light","source":"user_selected","selectionReason":"沿用已选的左侧导航"},
    "pageApplications": [
      {"pageId":"page-1","visualMemoryApplications":[{"name":"摘要拼接组","renderPolicy":"prd_match_only","target":"采购待办摘要","reason":"页面已有并列的待办状态"}]}
    ],
    "assetStrategy": {"materialStatus":"none","missingAssets":[],"notes":"使用业务内容，不添加装饰图片"}
  },
  "internal": {"selectedTheme":{"themeId":"airy-modular-clarity","source":"user_selected"}},
  "forDesignMd": {"productTopologyApplication":"工作台与表单共享主题，视觉重点绑定已有采购任务"}
}
```

- 已选主题取当前上下文；主色为 6 位 HEX。导航 structure 为 top/side，tone 为 light/dark；它与整页暗色风格分开记录。
- 页面视觉绑定使用相同 pageId，按上下文中的视觉记忆点及适用条件匹配真实区块；没有匹配内容时保留空数组，并在项目应用中说明。
- `visualStyle.evidence/constraints` 保留实际视觉依据和约束。
- `visualStyle.tokens` 可写具体单行 CSS token 差异，如 `{"--pod-card-border-radius":"16px"}`。品牌色阶由主色派生；themeProfile 为只读摘要。
- 完整主题的 token、组件、状态、响应式和自检规则由 CLI 注入 design.md。项目独有组件调整时再读模板对应章节；整体暗色主题按需读取暗色浮层规则。

## 执行交接

`execution` 为可选差异对象，CLI 默认生成资源蓝图、应用先于表单及页面的创建顺序、页面实现顺序、示例数据计划、交互状态和验收标准。模型按依赖顺序排列，有特殊要求时写：

| 字段 | 格式 |
| --- | --- |
| `appConfig` | 已知真实 `appType/corpId/baseUrl`；`navigationType` 为 platform-l-shape/platform-top/platform-side/custom。hideAppNav/layoutDirection/navTheme/logoSource 由导航与视觉派生 |
| `explicitScope` | 用户明确的页面、表单、流程和导航范围；自定义导航布局保留在 navigation.variant |
| `resourceBlueprint` | `{name,type,purpose,pageId?}` 数组；type 为 normal-form/process-form/display-page/report，名称与模型、页面对应且唯一 |
| `resourceCreationOrder` | 覆盖全部资源的有序名称数组，先应用，再被依赖模型，最后依赖它们的页面 |
| `pageImplementationOrder` | 覆盖全部页面的 pageId 或名称数组 |
| `navigationOrder/navigationFallback` | 已确认的菜单顺序，或明确的排序策略；权限接口决定可见性 |
| `sampleDataPlan` | `{form,records}` 或 `{form,skipReason}` 数组，覆盖全部普通表单 |
| `interactionStates` | 可覆盖 empty/loading/error/formEntry/detail 的业务行为说明 |
| `acceptanceCriteria` | 非空业务验收标准数组 |

源 JSON 保留项目事实；派生后的 PRD 包含完整 11 章业务与实施交接，HTML 展示同一套业务内容。

## 调整与确认

调整现有事实使用字段级修改：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json --set 'visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C' --materialize --json
```

CLI 自动递增 revision、清除旧确认，并在使用 `--materialize` 时同步三份文档和主题 CSS。支持首次添加 execution 的可选字段、tokens、已有页面交接字段和模型示例数据；数组项需已存在。

并行合并时 CLI 设置 `meta.status=awaiting_confirmation`；直接维护单一计划时由编排在生成前设置。展示成功后记录 `meta.planState.presentedRevision=meta.revision`；收到明确确认后设置 status=confirmed、planConfirmed=true、confirmedRevision=presentedRevision，再生成文档同步确认状态。详细交互见应用流程的生成与确认步骤。`askhuman` 只保存需要留档的交互事实，未选候选留在会话中。

旧版无 schemaVersion 或 1.x 文件继续使用原结构；维护旧计划时按需查阅旧版结构说明。

## 可选字段 patch 与完成校验

CLI 集中返回可独立检查的问题及字段路径，再执行完整业务、主题和 HTML 校验。按问题清单一次补齐源事实后重试；草稿空值表示待规划，全部校验通过才写入派生产物。仅做诊断时使用 `--check`。
