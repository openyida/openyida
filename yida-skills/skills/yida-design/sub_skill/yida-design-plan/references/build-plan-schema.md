# build-plan.json 结构

## 用途

本文件描述 materialize 使用的完整逻辑结构，并用于校验或迁移 1.x 计划。新计划不要按本文逐字段生成，改读 [2.0 紧凑写入契约](build-plan-compact-schema.md)；用户可见内容要求读取 [build-plan-content.md](build-plan-content.md)。

`build-plan.json` 是搭建计划的结构化事实源。`prd.md`、`design.md` 和 `build-plan.html` 都从它转化，不得各自推导互相冲突的业务、页面或视觉结论。

`schemaVersion=2.0` 时，下文中的摘要、索引字段和标准规则可以不在源 JSON 中出现，由 materialize 确定性补齐；补齐后的完整逻辑结构仍遵守本文约束，派生产物完整度不变。

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

- 计划生成前原则上只执行一次结构化交互，最多包含应用范围与完整视觉方向两个逻辑问题；每个问题必须有 `interactionId` 和 `writeBackPath`。
- `questionType` 只取 `single_choice`、`multi_choice`、`free_text` 或最终计划使用的 `confirm`，不设置 AI 代填项中间确认类型。
- 只有宽泛应用名称且缺少模块、场景、任务、流程和可读需求时才问应用范围。
- 审批、角色权限、字段、首页、看板、页面和常规流程细节不进入 `ask_human`；用户已提供时承接，未提供时基于业务推断并在最终计划统一呈现。
- 来源不可读时只生成来源补齐问题。
- 视觉问题生成恰好三套完整方向；选中后原子写入 `visualDirection`、`internal.selectedTheme`、`colorStrategy` 和 `navigationStyle`，未选候选不写入最终 JSON。

`askhuman` 保留为 `build-plan.json` 的存储字段名；技能动作和用户交互统一称为 `ask_human`。

## planState

`meta.revision` 是四份产物共享的版本标识，`meta.status` 是当前状态，`meta.planState` 记录展示与确认事实。状态更新遵守 [`ask_human` 交互契约](../../../references/ask-human-interaction-contract.md)。

- `draft`：当前版本正在生成或调整。
- `awaiting_confirmation`：当前版本已通过会话摘要和 `build-plan.html` 展示，`presentedRevision=meta.revision`。
- `confirmed`：用户已在最终确认交互中确认，`confirmedRevision=meta.revision`、`planConfirmed=true`。
- 每次影响计划事实的修改都生成新的 `meta.revision`，并清空旧确认信息。
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

```json
{
  "evidence": [
    {
      "type": "user_explicit | brand_guide | logo | website | image_reference | template | inferred",
      "value": "用户要求整体克制，不要大面积品牌色",
      "confidence": "high | medium | low"
    }
  ],
  "constraints": {
    "brandColors": ["#F26B38"],
    "preferredTone": ["professional"],
    "forbiddenColors": [],
    "avoidPatterns": ["large-kpi-cards", "excessive-whitespace"],
    "referenceMaterials": [],
    "accessibilityLevel": "AA"
  },
  "forUser": {
    "visualDirection": {
      "label": "稳重流程型",
      "description": "强调流程状态、任务处理和异常识别，界面稳定而不沉闷。",
      "source": "user_selected | user_explicit | material_extracted | ai_inferred"
    },
    "themeProfile": {
      "tone": "<selectedIndexRecord.defaultProfile.tone>",
      "surfaceStyle": "<selectedIndexRecord.defaultProfile.surfaceStyle>",
      "contrastLevel": "<selectedIndexRecord.defaultProfile.contrastLevel>",
      "brandIntensity": "<selectedIndexRecord.defaultProfile.brandIntensity>",
      "radiusScale": "<selectedIndexRecord.defaultProfile.radiusScale>",
      "shadowLevel": "<selectedIndexRecord.defaultProfile.shadowLevel>",
      "iconStyle": "<selectedIndexRecord.defaultProfile.iconStyle>",
      "motionLevel": "<selectedIndexRecord.defaultProfile.motionLevel>",
      "colorStrategy": "<selectedIndexRecord.defaultProfile.colorStrategy>"
    },
    "styleSummary": "<已选主题与项目色彩策略的摘要>",
    "styleSource": "用户选择",
    "colorStrategy": {
      "source": "user_selected | user_specified | brand_guide | material_extracted | ai_inferred",
      "primaryColor": "#F26B38",
      "primaryColorName": "品牌橙",
      "usage": "用于主操作、当前状态和少量关键数据，不作为大面积背景",
      "confidence": "high | medium | low"
    },
    "navigationStyle": {
      "structure": "top | side",
      "tone": "light | dark",
      "source": "user_selected | user_explicit | material_extracted | ai_inferred",
      "selectionReason": "高频流程处理需要稳定入口，深色导航加强模块边界。"
    },
    "pageApplications": [
      {
        "pageId": "sales-workbench",
        "pageName": "工作台",
        "visualApplication": "继承已选主题，在不改变页面模式的前提下说明表面、品牌色、主操作和状态如何呈现。",
        "surface": "状态摘要和任务区使用轻边框表面，不使用大面积悬浮阴影。",
        "primaryAction": "品牌色只用于主操作和当前选中对象。",
        "states": "异常和逾期使用独立语义色、图标和文字共同表达。",
        "visualMemoryApplications": [
          {
            "name": "<选中模板中的视觉记忆组件名称>",
            "renderPolicy": "adapt_existing_slot | prd_match_only | direct | suggest_only",
            "target": "<PRD 已有内容槽位>",
            "reason": "<页面内容满足该记忆点内容契约的依据>"
          }
        ],
        "visualMemories": ["<由 visualMemoryApplications[].name 派生>"]
      }
    ],
    "visualMemories": [
      {
        "name": "清楚细边框",
        "rule": "内容表面主要通过边框和明度差分层。",
        "userValue": "业务区块边界稳定且易扫描。",
        "failureMode": "只靠极弱阴影导致白色表面混在一起。"
      }
    ],
    "hierarchySummary": "中性背景承托清楚边界的内容表面，阴影只用于必要浮层。",
    "componentToneSummary": "组件保持克制，品牌色用于关键操作，状态语义独立。",
    "stateSummary": "空态、加载、错误、禁用、无权限和选中状态都有文字与视觉反馈。",
    "responsiveSummary": "移动端保持页面规划中的主任务顺序，控件满足触控尺寸。",
    "iconSummary": "使用统一线性图标体系，具体图标在开发阶段映射。",
    "assetStrategy": {
      "materialStatus": "final | draft | none",
      "heroImage": "官网或品牌页需要；内部管理应用可为空",
      "productImages": [],
      "missingAssets": [],
      "notes": "不得编造图片 URL；素材缺失时标记草稿"
    },
    "designMdReady": "已同步生成 design.md，后续 AI 开发读取完整设计契约。"
  },
  "internal": {
    "selectedTheme": {
      "themeId": "<selectedIndexRecord.themeId>",
      "source": "user_selected | user_custom | user_explicit | material_extracted | ai_inferred",
      "customText": ""
    }
  },
  "forDesignMd": {
    "designTemplate": {
      "themeId": "<selectedIndexRecord.themeId>",
      "templatePath": "<selectedIndexRecord.templatePath>",
      "instanceRule": "完整读取模板，替换项目变量，注入页面模式与页面视觉应用"
    },
    "productTopologyApplication": "<根据 experienceTopology、页面范围和前后台边界生成的主题应用说明，不改变页面规划>",
    "pagePatterns": [
      {
        "pageId": "sales-workbench",
        "mode": "adapted",
        "id": "compact-workbench",
        "adaptations": ["增加持续展开的客户与商机上下文区"],
        "contentRichness": "rich-but-relevant",
        "mustKeep": ["高频动作显眼", "首屏至少两层信息"]
      }
    ],
    "themeStrategy": {
      "colorSource": "user_specified | brand_guide | material_extracted | ai_inferred",
      "colorRoles": ["主色", "辅助色", "中性色", "语义色"],
      "notes": "主题色策略与页面模式相互独立。"
    },
    "componentRules": [],
    "stateRules": ["hover", "active", "focus", "disabled", "loading", "empty", "error", "no-permission", "selected"],
    "responsiveRules": [],
    "qualityGates": [
      "视觉主题不得改变页面内容、页面模式和信息密度。",
      "不使用低密大空白工作台。",
      "不得编造图片 URL。"
    ]
  }
}
```

## 结构约束

- 字段值为空时写 `-`，不要省略固定列。
- `build-plan.html` 不展示内部判断字段、预设 ID 或候选过程。
- `pages` 是页面内容与体验结构的事实源；`visualStyle` 是视觉主题与页面视觉应用的事实源。
- `businessDomain` 决定业务对象与流程，`experienceTopology` 描述项目结构；两者都不排除或绑定视觉主题。
- `visualStyle.forUser.pageApplications` 与 `pages.customPageDetails[]` 按 `pageId` 一一对应，只记录项目真实存在的自定义页面。
- 页面视觉应用先消费全应用 Token 和页面已有组件，再匹配视觉记忆点；新计划不维护一份固定页面类型规则表。
- 1.x 结构中的 `candidateThemes` 与 `selectedTheme` 必须从 [主题索引](../templates/design-themes/index.json) 取得；2.0 不保存任何未选候选，模板路径由 `visualStyle.internal.selectedTheme.themeId` 确定性补齐。
- `forDesignMd.designTemplate` 必须与 `visualStyle.internal.selectedTheme` 指向同一模板；生成的 `design.md` 不得残留 `{{...}}` 占位符、Token 推导指令、主题 ID、模板名称或模板路径。
- 主题 ID 仅保存在 2.0 `build-plan.json` 的内部字段，模板路径由主题索引补齐；用户可见派生产物只展示视觉方向、主题色、导航结构和导航明暗。
- 视觉变化不得改写 `pages`；页面规划变化时允许重新生成 `visualStyle.forUser.pageApplications`。
- `prd.md`、`design.md` 和 `build-plan.html` 必须来自同一个 `meta.revision`；用户确认后把 `meta.status` 更新为 `confirmed`。
- 确认生成应用前，`build-plan.json` 是唯一搭建计划事实源。
- 旧数据中的 `selectedStyleOption`、`pageVisualPlanning`、`firstScreen`、`signatureMoment` 和 `visualAtmosphere` 仅用于渲染兼容；新计划不得继续写入。
- 旧数据只有 `themeId` 时，ID 仍存在于当前索引 → 通过同一记录补齐 `templatePath`；ID 不存在于当前索引 → 返回 Step 2 重新选择当前主题，不凭印象映射旧主题。
