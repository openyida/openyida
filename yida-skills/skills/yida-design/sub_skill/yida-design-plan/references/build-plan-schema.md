# build-plan.json 结构

## 用途

本文件描述 materialize 使用的完整逻辑结构，并用于校验或迁移 1.x 计划。新计划不要按本文逐字段生成，改读 [2.0 紧凑写入契约](build-plan-compact-schema.md)；用户可见内容要求读取 [build-plan-content.md](../../../../yida-prd/references/plan-content.md)。

`build-plan.json` 是搭建计划的结构化事实源。`prd.md`、`design.md` 和 `build-plan.html` 都从它转化，不得各自推导互相冲突的业务、页面或视觉结论。

`schemaVersion=2.0` 时，下文中的摘要、索引字段和标准规则可以不在源 JSON 中出现，由 materialize 确定性补齐；补齐后的完整逻辑结构仍遵守本文约束，派生产物完整度不变。

页面导航策略是[紧凑契约中的派生输出](build-plan-compact-schema.md#派生的页面导航策略)：`pages[].navigationPolicy` 仅存在于 PRD 实施交接，不作为本源 JSON 或 pageSpecHandoff 的输入；旧计划同样从导航归属派生。

## 顶层结构

```json
{
  "meta": {},
  "overview": {},
  "dataModels": [],
  "businessFlows": [],
  "pages": {},
  "visualStyle": {},
  "askhuman": {}
}
```

## meta

```json
{
  "projectName": "CRM 客户管理应用",
  "source": {
    "sourceKind": "free_text | pasted_requirement | linked_document | meeting_transcript | yida_template | local_file | unreadable_source",
    "sourceReadable": true,
    "sourceConfidence": "high | medium | low",
    "sourceResolver": {
      "resolverType": "none | built_in_skill | external_adapter | manual_paste",
      "resolverName": "",
      "resolverStatus": "not_needed | pending | success | failed",
      "resolverOutputPath": ""
    },
    "templateSource": {
      "templateId": "",
      "templateName": "",
      "templateUrl": "",
      "templateCategory": "",
      "templateSummary": "",
      "extractedObjects": [],
      "extractedPages": [],
      "extractedFlows": [],
      "extractedVisualHints": [],
      "confidence": "high | medium | low"
    },
    "sourceTitle": "",
    "sourceUrl": "",
    "attachmentSource": {
      "fileName": "",
      "fileType": "docx | pdf | md | txt | xlsx | xls | csv | image | other",
      "sheetNames": [],
      "extractedTables": [
        {
          "name": "",
          "headers": [],
          "exampleRowsCount": 0,
          "inferredEntity": "",
          "fieldHints": [],
          "relationHints": []
        }
      ],
      "parseStatus": "not_needed | success | failed"
    },
    "extractedRequirementCompleteness": "low | medium | high",
    "extractedAt": "2026-08-20T12:00:00+08:00",
    "sourceNotes": "需求正文来自用户自然语言 / 文档读取 / 听记抽取 / 附件解析"
  },
  "appCategory": "enterprise_internal | marketing_site | single_page | composite_app",
  "businessDomain": "crm | erp | procurement | commerce | project | asset | hr | finance | other",
  "experienceTopology": "internal_management | brand_marketing | transactional_frontend | frontend_backend_composite | single_task_form | data_monitoring | content_browse",
  "inputCompleteness": "low | medium | high",
  "complexity": "simple | moderate | complex",
  "revision": "2026-08-26-01",
  "status": "draft | awaiting_confirmation | confirmed",
  "planState": {
    "presentedRevision": null,
    "confirmedRevision": null,
    "planConfirmed": false,
    "confirmationInteractionId": "",
    "confirmedAt": ""
  },
  "updatedAt": "2026-08-20T12:00:00+08:00"
}
```

## askhuman

`askhuman` 记录问题生成过程和用户确认结果，是内部工作数据，不在 `build-plan.html` 中展示。

```json
{
  "knownFacts": {
    "rawIntent": "用户原始输入",
    "source": {},
    "appCategory": "enterprise_internal",
    "businessDomain": "crm",
    "experienceTopology": "internal_management",
    "entities": [],
    "flows": [],
    "pages": [],
    "visualHints": []
  },
  "missingSlots": [
    {
      "slot": "dataModels",
      "priority": "required",
      "reason": "缺少核心业务对象，无法生成数据模型。"
    }
  ],
  "conflicts": [],
  "assumptions": [
    {
      "path": "businessFlows",
      "value": "AI 根据已选模块推断常规审批与状态流转",
      "needsConfirmation": false
    }
  ],
  "questions": [
    {
      "interactionId": "plan_entities_core_r2026-08-26-01",
      "id": "application_scope",
      "priority": "required",
      "questionType": "multi_choice",
      "title": "应用范围",
      "prompt": "这个应用主要包含哪些业务模块？",
      "options": [],
      "allowCustom": true,
      "aiDefault": [],
      "writeBackPath": "overview.moduleScope",
      "reason": "当前输入只有宽泛应用名称，需要先确定主要范围。"
    }
  ],
  "answers": []
}
```

约束：

- 计划生成前先确定应用范围，导航方式与布局按 [导航设计](../../../../yida-design/references/navigation-decision.md) 写入 brief，用户明确要求优先。视觉候选沿用该导航决策，随整体方案确认。其余必要问题必须有 `interactionId` 和 `writeBackPath`。
- `questionType` 只取 `single_choice`、`multi_choice`、`free_text` 或最终计划使用的 `confirm`，不设置 AI 代填项中间确认类型。
- 只有宽泛应用名称且缺少模块、场景、任务、流程和可读需求时才问应用范围。
- 审批、角色权限、字段、首页、看板、页面和常规流程细节不进入 `ask_human`；用户已提供时承接，未提供时基于业务推断并在最终计划统一呈现。
- 来源不可读时只生成来源补齐问题。
- 视觉问题生成恰好三套完整方向；选中后原子写入 `visualDirection`、`internal.selectedTheme`、`colorStrategy` 和 `navigationStyle`，未选候选不写入最终 JSON。

`askhuman` 保留为 `build-plan.json` 的存储字段名；技能动作和用户交互统一称为 `ask_human`。

## planState

`meta.revision` 是四份产物共享的版本标识，`meta.status` 是当前状态，`meta.planState` 记录展示与确认事实。状态更新遵守 [`ask_human` 交互契约](../../../references/ask-human-interaction-contract.md)。

- `draft`：当前版本正在生成或调整。
- `awaiting_confirmation`：当前版本准备确认；展示成功后写回 `presentedRevision=meta.revision`，不能仅凭 status 判断已展示。
- `confirmed`：用户已在最终确认交互中确认，`confirmedRevision=meta.revision`、`planConfirmed=true`。
- 未展示草稿补全保留版本；已展示/确认方案实质变化才升版并清空确认。相同内容及素材进度不升版；旧文件缺 planState 时保守升版。
- 只有 `meta.status=confirmed`、`planConfirmed=true` 且 `meta.revision=presentedRevision=confirmedRevision` 时，应用生成链路才能消费该计划。

## overview

```json
{
  "title": "需求总览",
  "summary": "一段结构化文字，包含应用名称、定位、核心用户、业务对象和 1-3 个核心问题。",
  "businessGraph": {
    "type": "table_relation_graph",
    "nodes": [
      {
        "id": "customer",
        "name": "客户",
        "source": "普通表单",
        "group": "客户域",
        "color": "#2B8CFF"
      }
    ],
    "relations": [
      {
        "from": "客户",
        "to": "联系人",
        "label": "包含",
        "description": "一个客户下可维护多个联系人。"
      }
    ],
    "content": "可选兜底：graph LR ..."
  },
  "dataModelSummary": ["客户管理：客户列表与详情"],
  "flowSummary": ["线索获取与分配：多渠道线索录入，销售主管按负载分配"],
  "pageSummary": ["工作台：销售团队首页，承接待办、重点客户和销售摘要"],
  "navigationSummary": ["总览：销售工作台、审批工作台"],
  "rolePermissionSummary": ["销售代表：录入客户、商机和跟进，发起报价"],
  "visualSummary": "<已选主题的用户可读摘要>"
}
```

`businessGraph.nodes` 必须覆盖全部 `dataModels`；关系表达数据对象之间的结构关系，不表达页面跳转或审批节点。

## dataModels

```json
[
  {
    "name": "客户",
    "formType": "普通表单",
    "description": "客户档案的增删改查与跟进管理。",
    "views": ["全部数据", "我负责的客户", "表单提交"],
    "fields": [
      {
        "name": "客户名称",
        "type": "单行文本",
        "required": true,
        "defaultOrOptions": "-",
        "relation": "-",
        "group": "基础信息",
        "description": "企业名称"
      }
    ]
  }
]
```

## businessFlows

```json
[
  {
    "type": "自动化",
    "name": "线索获取与分配",
    "trigger": "线索创建时",
    "nodes": ["线索录入", "按负载分配", "接受并跟进"],
    "description": "市场活动、官网、转介绍等渠道产生销售线索，由销售代表录入或被自动分配。",
    "rules": ["官网线索且意向金额大于 5 万时，分配给对应区域的高级销售代表。"]
  }
]
```

`type` 可取：`自动化`、`审批流`、`业务流`。

## pages

```json
{
  "overview": [
    {
      "name": "工作台",
      "type": "AI 自定义页面",
      "purpose": "销售团队首页，用于判断并处理当天最重要的销售事项"
    }
  ],
  "customPageDetails": [
    {
      "pageId": "sales-workbench",
      "name": "工作台",
      "type": "AI 自定义页面",
      "positioning": "销售团队的日常工作首页。",
      "primaryUsers": ["销售代表", "销售主管"],
      "primaryTask": "判断并处理当天最重要的销售事项。",
      "contentPriority": [
        "待跟进客户和待办事项",
        "重点商机和异常状态",
        "销售指标与近期记录"
      ],
      "blocks": [
        "状态摘要：展示待办、重点商机和异常数量",
        "优先任务队列：按紧急程度展示当天需要处理的客户和商机",
        "近期记录：承接最近跟进和快捷入口"
      ],
      "firstScreenStructure": "顶部为紧凑状态摘要，下方以优先任务队列为主，右侧承接异常和近期上下文。",
      "signatureInteraction": "用户处理一条待办后，当前状态、队列排序和关联记录同步反馈。",
      "layoutPattern": {
        "mode": "adapted",
        "id": "compact-workbench",
        "reason": "该页面是每日入口，需要在首屏判断优先级并进入高频操作。",
        "adaptations": ["增加持续展开的客户与商机上下文区"],
        "mustKeep": ["高频动作显眼", "首屏至少两层信息"]
      },
      "contentRichness": {
        "requirement": "rich-but-relevant",
        "contentLayers": [
          "决策层：待办、重点商机和异常状态",
          "主任务层：优先任务队列与直接处理动作",
          "上下文层：客户、商机和最近跟进记录",
          "异常层：逾期、停滞和权限限制",
          "承接层：跟进、转交、报价和查看详情"
        ],
        "antiFiller": ["不使用无任务承接的等宽 KPI 卡", "不重复快捷入口凑内容"]
      },
      "density": "compact",
      "permissionSummary": "组织内可见；销售代表只看自己负责数据，主管可看团队数据。"
    }
  ]
}
```

页面字段约束：

- `primaryTask`、`contentPriority`、`firstScreenStructure`、`contentRichness`、`layoutPattern` 和 `density` 由 PRD 与页面规划决定。
- 新计划的 `contentRichness.requirement` 固定为 `rich-but-relevant`；`contentLayers` 覆盖当前任务适用的信息层，`antiFiller` 明确禁止的填充内容。
- 新计划的 `layoutPattern.mode` 必须是 `preset | adapted | custom`。`preset` 和 `adapted` 的 `id` 读取 [page-patterns.md](page-patterns.md)；`custom` 使用 `custom-page-pattern`。`adapted` 必须包含非空 `adaptations`。
- 页面模式不由视觉主题决定；没有强匹配时不得为了复用预设而硬套。
- 页面记录不保存独立的 `visualAtmosphere`；页面视觉应用写入 `visualStyle.forUser.pageApplications`。
- 渲染器可以把页面视觉应用展示在对应页面详情中；显示位置不改变事实归属。

## visualStyle

业务规划复用已确认的视觉选择；字段格式见 [紧凑契约的视觉事实](build-plan-compact-schema.md#视觉事实)。下表区分模型维护的输入与 CLI 派生内容。

| 字段 | 内容与来源 |
| --- | --- |
| evidence | 素材或用户要求的证据数组，每项为 type、value、confidence |
| constraints | 保留 brandColors、preferredTone、forbiddenColors、avoidPatterns、referenceMaterials、accessibilityLevel |
| forUser.visualDirection | 已选方向的 label、description、source |
| forUser.colorStrategy | 项目主色、来源与用法；格式沿用紧凑契约 |
| forUser.navigationStyle | structure=top/side、tone=light/dark、source、selectionReason |
| internal.selectedTheme | themeId、source、customText；label、templatePath 和 summary 由主题索引补齐 |
| forUser.themeProfile | 由选中主题 token、正文规则和项目视觉选择派生的只读摘要 |
| forUser.pageApplications | 按 pageId 对应实际页面；最终物化必填 firstScreenFocus/primaryAction/layout/responsive 非空字符串与 acceptanceChecks 非空字符串数组，按需补局部差异和 visualMemoryApplications；记忆点含 name、renderPolicy、target、reason |
| forUser.iconSystem | 可选，library 为 lucide-react 或 @ant-design/icons，mappings 记录实际语义到具体组件；沿用 brief，未配置才用默认空映射 |
| forUser.assetStrategy | 页面图片用途、槽位与缺口，沿用[素材交接契约](../../../../yida-image-assets/references/manifest-contract.md)；保留 materialStatus、pages、missingAssets、notes |
| forUser 的各项 Summary、styleSource、designMdReady | 从主题、项目选择和生成状态派生；已有项目差异保留 |
| forDesignMd | designTemplate、pagePatterns、themeStrategy 由 CLI 派生，productTopologyApplication 保留项目形态差异 |

逐页 surface、states 和 visualApplication 可保留公共基准并补项目差异；首屏焦点、主操作及位置、布局、响应式与验收必须是当前页具体决定。缺项草稿可预览，最终物化要求补齐，包括旧计划；纯原生页无逐页设计门槛。最终文档格式与索引只按 [公共输出契约](../../../workflow/output-design.md) 执行。

## 结构约束

- 字段值为空时写 `-`，不要省略固定列。
- `build-plan.html` 不展示内部判断字段、预设 ID 或候选过程。
- `pages` 是页面内容与体验结构的事实源；`visualStyle` 是视觉主题与页面视觉应用的事实源。
- `businessDomain` 决定业务对象与流程，`experienceTopology` 描述项目结构；两者都不排除或绑定视觉主题。
- `visualStyle.forUser.pageApplications` 与 `pages.customPageDetails[]` 按 `pageId` 一一对应，只记录项目真实存在的自定义页面。
- 页面视觉应用先消费全应用 Token 和页面已有组件，再匹配视觉记忆点；新计划不维护一份固定页面类型规则表。
- 1.x 结构中的 `candidateThemes` 与 `selectedTheme` 必须从 [主题索引](../../../templates/design-themes/index.json) 取得；2.0 不保存任何未选候选，模板路径由 `visualStyle.internal.selectedTheme.themeId` 确定性补齐。
- `forDesignMd.designTemplate` 必须与 `visualStyle.internal.selectedTheme` 指向同一模板；生成的 `design.md` 不得残留 `{{...}}` 占位符、Token 推导指令、主题 ID、模板名称或模板路径。
- 主题 ID 仅保存在 2.0 `build-plan.json` 的内部字段，模板路径由主题索引补齐；用户可见 HTML 按 [展示规范](../assets/README.md#需求确认内容范围) 呈现需求确认内容，完整业务与视觉事实仍保留在源文件和执行文档中。
- 视觉变化不得改写 `pages`；页面规划变化时允许重新生成 `visualStyle.forUser.pageApplications`。
- `prd.md`、`design.md` 和 `build-plan.html` 必须来自同一个 `meta.revision`；用户确认后把 `meta.status` 更新为 `confirmed`。
- 确认生成应用前，`build-plan.json` 是唯一搭建计划事实源。
- 旧数据中的 `selectedStyleOption`、`pageVisualPlanning`、`firstScreen`、`signatureMoment` 和 `visualAtmosphere` 仅用于渲染兼容；新计划不得继续写入。
- 输入只有 `themeId` 时，从当前主题索引的对应记录补齐 `templatePath`；ID 不在当前索引中时，返回 Step 2 选择当前可用主题。

### 紧凑区块输入（schemaVersion 2.0）

`blocks` 支持按优先顺序填写 `{name,purpose}` 数组，两项均为非空文本，每个区块只使用这两个键。CLI 将其转换为区块说明，并在省略时派生 contentPriority 和 contentRichness.contentLayers；明确填写的内容原样保留。旧版字符串数组继续沿用原字段。业务验收条件写入 execution.acceptanceCriteria，与按资源生成的通用检查合并去重。
