# build-plan.json 紧凑写入契约（schemaVersion 2.0）

## 目的

新计划只按本文件写 `build-plan.json`。模型保存项目选择、业务事实和必要差异；主题模板规则、页面预设规则、摘要副本和展示字段由 `openyida design-plan materialize` 确定性补齐。

```text
紧凑 build-plan.json
  + 主题索引与选中的完整主题模板
  + 页面模式索引
  ─────────────────────────────
  = 完整 prd.md + 完整 design.md + build-plan.html
```

压缩只发生在结构化输入层。最终 `design.md` 仍包含选中主题模板中的完整 Token、组件、状态、响应式、禁忌和自检规则；不得为了缩小 JSON 删除项目业务事实。

## 顶层结构

```json
{
  "schemaVersion": "2.0",
  "meta": {},
  "overview": {},
  "dataModels": [],
  "businessFlows": [],
  "pages": {},
  "visualStyle": {},
  "askhuman": {}
}
```

`meta`、`dataModels`、`businessFlows`、`askhuman` 的业务字段沿用 [完整逻辑结构](build-plan-schema.md)，不得压缩字段、流程规则、来源证据和确认状态。

## 模型必须写的事实

### overview

```json
{
  "title": "需求总览",
  "summary": "应用定位、核心用户、业务对象和核心问题",
  "businessGraph": {
    "relations": [
      {
        "from": "采购申请",
        "to": "采购订单",
        "label": "承接",
        "description": "审批通过后生成采购订单。"
      }
    ],
    "content": "只有存在不可由关系数组表达的补充内容时才写"
  },
  "navigationSummary": ["采购执行：采购申请、采购订单"],
  "rolePermissionSummary": ["采购专员：维护供应商并处理采购全流程"]
}
```

必须保留：

- `summary`，因为应用定位和核心问题不能仅靠表单机械恢复。
- `businessGraph.relations`，因为对象关系是业务事实。
- `navigationSummary`，当它表达菜单分组、入口组织或路径选择时保留。
- `rolePermissionSummary`，因为权限边界不能从字段表可靠推导。

下列内容按职责处理，源 JSON 保存项目事实与差异：

- `businessGraph.nodes`：由 `dataModels` 派生。
- `dataModelSummary`：由 `dataModels` 派生。
- `flowSummary`：由 `businessFlows` 派生。
- `pageSummary`：由自定义页面的名称、定位和核心任务派生。
- `visualSummary`：由选中主题和项目色彩策略派生。

### pages

`customPageDetails[]` 必须完整保存页面业务差异：页面定位、用户、核心任务、内容优先级、功能区块、首屏结构、标志性交互、项目内容层、信息密度和权限边界。

```json
{
  "customPageDetails": [
    {
      "pageId": "procurement-workbench",
      "name": "采购工作台",
      "type": "AI 自定义页面",
      "positioning": "采购团队的每日工作入口。",
      "primaryUsers": ["采购专员", "采购主管"],
      "primaryTask": "判断并处理当天最重要的采购事项。",
      "contentPriority": ["待处理事项", "临期与异常", "最近记录"],
      "blocks": ["状态摘要", "优先任务队列", "最近动态"],
      "firstScreenStructure": "顶部摘要，主区任务队列，右侧最近动态。",
      "signatureInteraction": "处理返回后数量与队列同步刷新。",
      "layoutPattern": {
        "id": "compact-workbench",
        "reason": "每日入口需要先判断处理优先级。",
        "adaptations": ["增加持续展开的采购上下文区"]
      },
      "contentRichness": {
        "contentLayers": [
          "决策层：待处理与临期异常",
          "主任务层：采购任务队列与处理动作",
          "上下文层：供应商与最近记录",
          "异常层：到货、对账和付款异常",
          "承接层：申请、收货和付款入口"
        ]
      },
      "density": "compact",
      "permissionSummary": "组织内可见；按角色和负责人过滤。"
    }
  ]
}
```

下列内容按职责处理，源 JSON 保存项目事实与差异：

- `pages.overview`：由自定义页面和 `dataModels` 派生。
- `layoutPattern.mode`：无改造项为 `preset`，有改造项为 `adapted`，`custom-page-pattern` 为 `custom`。
- `layoutPattern.mustKeep`：从页面模式索引补齐。
- `contentRichness.requirement`：固定派生为 `rich-but-relevant`。
- `contentRichness.antiFiller`：从页面模式索引的全局防填充规则补齐。

项目独有的页面事实不能因为预设存在而省略。`adaptations` 只写相对预设的项目差异。

### visualStyle

```json
{
  "evidence": [],
  "constraints": {},
  "forUser": {
    "visualDirection": {
      "label": "稳重流程型",
      "description": "强调流程状态、任务处理和异常识别，界面稳定而不沉闷。",
      "source": "user_selected"
    },
    "colorStrategy": {
      "source": "user_selected",
      "primaryColor": "#6F4E37",
      "primaryColorName": "暖咖啡棕",
      "usage": "只用于主操作、关键焦点和选中状态",
      "confidence": "high"
    },
    "navigationStyle": {
      "structure": "side",
      "tone": "dark",
      "source": "user_selected",
      "selectionReason": "高频流程处理需要稳定入口，深色导航加强模块边界。"
    },
    "pageApplications": [
      {
        "pageId": "procurement-workbench",
        "visualMemoryApplications": [
          {
            "name": "摘要拼接组",
            "renderPolicy": "prd_match_only",
            "target": "待审批、待收货、待付款和临期订单摘要",
            "reason": "页面已有四个同层级摘要字段，满足内容契约。"
          }
        ]
      }
    ],
    "assetStrategy": {
      "materialStatus": "none",
      "missingAssets": [],
      "notes": "内部管理应用不强行添加装饰图片。"
    }
  },
  "internal": {
    "selectedTheme": {
      "themeId": "airy-modular-clarity",
      "source": "user_selected",
      "customText": ""
    }
  },
  "forDesignMd": {
    "productTopologyApplication": "内部管理型应用；工作台与原生表单共享全应用设计语言，视觉记忆点只绑定已有内容。"
  }
}
```

模型只写：

- 视觉证据和项目约束。
- 项目视觉方向名称、体验说明和来源。
- 导航结构、导航明暗、来源和选择依据。
- 内部 `selectedTheme.themeId`、选择来源和真实自定义说明。
- 项目色彩来源、色值、名称、使用差异和置信度。
- 每页 `visualMemoryApplications`：把选中模板的记忆点绑定到 PRD 已有真实内容。
- 素材现状、真实来源和缺口。
- 产品形态如何应用主题的项目差异。

下列内容按职责处理，源 JSON 保存项目事实与差异：

- `candidateThemes`、`candidateVisualDirections`：用于视觉选择阶段，确认后的计划保存所选方向。
- `selectedTheme.label/templatePath/summary`：从主题索引补齐。
- `themeProfile`：从主题索引 `defaultProfile` 派生，只读；用户差异写入 `visualStyle.tokens`。
- `styleSummary`、`hierarchySummary`、`componentToneSummary`、`stateSummary`、`responsiveSummary`、`iconSummary`、`designMdReady`：确定性派生。
- `pageName/layoutPatternMode/layoutPatternId/visualApplication/surface/primaryAction/states/visualMemories`：由页面事实、主题模板和记忆点绑定派生。
- `forDesignMd.designTemplate/pagePatterns/themeStrategy`：确定性派生。
- `componentRules/stateRules/responsiveRules/qualityGates`：标准规则只存在于选中的完整主题模板，不复制到 JSON。

## 派生与兼容

- `openyida design-plan materialize` 在内存中把 2.0 紧凑计划补齐为完整逻辑结构，再生成三份产物；不会把派生字段回写进源 JSON。
- 旧版无 `schemaVersion` 或 1.x 计划继续按原结构读取，现有产物不受影响。
- 新版 `selectedTheme` 只放在 `visualStyle.internal`；它是物化实现细节，不得出现在最终 `prd.md`、`design.md` 或 `build-plan.html`。
- 紧凑计划中的用户明确覆盖项优先于索引默认值；索引只补缺失字段，不覆盖项目事实。
- 未知主题 ID、主题路径冲突或未知页面模式必须报错，不凭印象恢复。

## 用户调整

用户调整通过字段级 patch 修改源事实；支持的可选字段见下方说明：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json \
  --set 'visualStyle.forUser.colorStrategy.primaryColor=#8B5E3C' \
  --set 'visualStyle.forUser.colorStrategy.primaryColorName=暖咖啡棕' \
  --materialize --json
```

不要让模型重写整份 JSON，也不要 patch 派生字段。字段变化后由 materialize 重新生成摘要、主题实例和三份产物。

## 搭建交接

物化器在 PRD 的“搭建交接”中生成资源蓝图、三种顺序、验收标准和 `pageSpecHandoff`。默认应用先落位、模型先于自定义页；模型按输入顺序创建，关联依赖必须在规划时排好。

有明确顺序、验收标准或额外资源时，在顶层 `execution` 中写 `resourceBlueprint`、`resourceCreationOrder`、`pageImplementationOrder`、`navigationOrder`、`acceptanceCriteria`、`explicitScope`，覆盖对应默认值。不要在 `execution` 中复制页面清单。

每个 `pages.customPageDetails[]` 写明 `dataSources`，引用已规划的数据模型名称；只有获得 CLI 证据后才使用真实资源 ID。有明确主操作、页面场景或设计引用时，在该页 `pageSpecHandoff` 写入覆盖项。`designFile` 使用工作区相对路径 `prd/<项目名>/design.md`，`designRefs` 必须指向实际生成的设计章节。平台导航页面未声明独立入口时使用 `entryMode=platform-shell`；自定义导航使用 `standalone`。导航类型写入 `execution.appConfig.navigationType`，四种类型与逐页隐藏要求见 [PRD 导航契约](../../../../yida-prd/workflow/output-prd.md#导航类型与执行配置)。

确认前检查这些交接字段满足当前业务。业务依赖、导航或验收标准变化时修改计划并重新物化，不直接编辑派生 PRD。

## 共同交接契约

业务与 PRD 章节由 [yida-prd](../../../../yida-prd/SKILL.md) 统一维护，遵守其 11 章输出格式。`execution` 业务字段见 [Plan 业务规划](../../../../yida-prd/workflow/plan-business.md)。

`visualStyle.tokens` 是可选的 CSS token 差异对象，例如 `{"--corner-2":"8px","--pod-card-border-radius":"16px"}`，值必须为具体单行字符串。品牌色阶统一由 `forUser.colorStrategy.primaryColor` 派生，不能在此重复定义。`themeProfile` 只作为派生摘要；具体视觉差异用 tokens 表达并由 CLI 写入 design.md 和应用 CSS。

每页的 `sceneKey` 原样保留共享需求 pageScenes 的 key，`scene` 使用标准场景枚举；两者不能用页面预设 ID 代替。生成的 PRD 与 design.md 共享 `themeProfile`、`sceneRecipes.<sceneKey>` 引用。

## 可选字段 patch 与完成校验

可直接添加 `execution` 的资源、顺序、验收、示例数据、交互状态和应用配置子字段，`visualStyle.tokens.--<token>`，已有页面的场景、数据交接字段，以及已有数据模型的 `sampleRecords` / `skipSampleReason`。父对象自动建立，数组项必须已存在，未知字段拒绝写入。具体字段名称以 [Plan 业务规划](../../../../yida-prd/workflow/plan-business.md) 为准。

旧计划中的 `themeProfile` 与主题默认值一致时允许读取；自定义覆盖需迁移为具体 token 或 primaryColor。

页面必须明确 `dataBinding`。`form/report/connector` 必须有非空 `dataSources`，form 来源必须对应数据模型；`static-empty` 必须明确 `emptyReason` 且来源为空。不能以缺少来源自动推断空态。

普通表单必须有 1–3 条 `sampleRecords`，以字段业务名称为键并覆盖必填字段；允许跳过时写 `skipSampleReason`。若使用 `execution.sampleDataPlan`，逐表提供 `form/records` 或 `form/skipReason`，数量须与记录一致，不得遗漏表单。空数组不表示规划完成。

`pageStructure` 限于统一 PRD 枚举；显式 `designRefs` 会保留并与实际生成的 themeProfile、sceneRecipes、components、states 校验；无效引用报错。CLI 同时检查目标、角色、字段、流程、资源覆盖、交付顺序和验收的必需内容。
