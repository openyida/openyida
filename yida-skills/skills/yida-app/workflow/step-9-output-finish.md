# Step 9：输出与收尾

最终输出让用户先理解业务能力，再看到一组用途明确的应用访问入口。内部 ID、构建产物、中间文件和逐项业务资源不作为用户可见交付物。

交付话术遵循 [用户可见表达契约](../../yida-design/references/ask-human-interaction-contract.md)。本文件中的接口字段用于内部核验；对用户描述已验证的业务效果。例如，自定义导航完成配置和跨页跳转验证后写“已启用自定义导航，可在各业务页面间切换”。尚未验证的部分如实说明待验证的页面或操作。

## 输入

- 发布成功证据；
- 主入口 URL；
- 资源创建、复用、更新摘要；
- seed records 写入或跳过结果；
- 导航排序结果。
- 页面/资源数量完整性风险检查结果。
- `requirement-brief.json.constraints.prohibitedActions` 与对应跳过证据。

主入口与页面入口必须取自本轮 CLI 成功结果返回的 `appUrl`、`workbenchUrl`、`adminUrl` 或 `url`，并在后续只读回查中保持一致。不得由模型根据 `appType` 自行拼接或猜测链接；下文 URL 规则仅用于校验服务端/CLI 返回值，不是缺失链接时的生成规则。若成功结果没有权威 URL，必须明确交付失败并执行只读回查，不能交付空卡片或用模板补齐。

入口层级由用户的交付目标决定：应用访问、应用入口或应用工作台使用成功结果的 `appUrl`；具体表单、流程、报表或页面入口使用对应资源结果的 `url` / `workbenchUrl`。同一结果同时提供两种入口时，优先满足用户明确点名的层级。

## 完成条件核对

`execution.explicitScope.allowInferredResources=false` 时，逐项核对范围内资源的成功结果、必要回读和真实链接，完成后交付。下面的完整应用检查表适用于 `allowInferredResources=true`。

按 PRD 的有效交付范围核对：第 1–2 条仅适用于本轮有自定义页面发布任务的应用；仅原生管理视图时记录不适用，并验证真实管理列表。frontend-only 不执行平台排序，不能为满足默认条件追加首页。其余条件按实际资源核验：

1. 主页面发布成功；
2. Canvas 主页面发布结果为 `publishMode=canvas`，读回 `hasYidaCodeCanvas=true` 且 `runtimeCodeBytes>0`；
3. 真实数据页面在已登录浏览器中退出 loading、无业务错误，并显示至少一条已 query 确认的记录；看板还必须有至少一个 KPI 数量或列表记录与只读 query 结果一致。已知记录数大于 0 但页面 KPI 全 0、列表为空或显示“暂无数据”时必须失败或标记 `needs_review`；
4. 获得可访问 URL；
5. 轻量导航排序已执行，或给出明确 warning；
6. 新建或作为页面数据源的核心普通表单已写入 1-3 条真实示例记录并 query 抽查，或明确说明跳过原因；
7. 汇合此前并行执行的主题任务，确认 `themeVerification.verified=true`、`colour=custom`、`themeColor`、`navTheme`、`layoutDirection` 与已确认设置一致，`customThemeStyle.cssUrl` 非空；这里是完成检查，不是首次更新主题的时机。应用主题文件已在应用级统一配置，自定义页面只在 `YidaComp` 内消费对应 token，未向上层注入或同步主题样式。
8. final 前先写入轻量 `prd/<项目名>/build-manifest.json`，再运行 `openyida check-prd-completeness prd/<项目名>/prd.md --app-type <appType> --build-manifest prd/<项目名>/build-manifest.json --json`；该命令检查页面/资源数量及已提供的素材执行记录一致性，不能替代第 3 条运行态数据验收。只有 `verdict=pass` 且运行态数据证据通过时才说“已按 PRD 完成搭建”；`verdict=needs_review` 时可以交付但必须列出 `items` 中 `status=needs_review/not_checked` 的复核项，`verdict=fail` 时列出 `hardFailures` 并说明未完成；
9. 未继续执行用户未要求的公开访问、截图验收、报表、大屏、数据源深接或精细导航分组。

用户明确禁止的动作优先于上述默认条件：禁止 `theme-file` 时，第 7 条改为核验本轮没有生成、复制、修改或上传主题文件，并如实说明沿用现有/平台默认主题，不把它判为主题任务失败；禁止 `publish` 时不得宣称完整应用已发布或把历史 URL 当成本轮发布产物，只交付已完成的未发布范围和后续发布条件；禁止 `page-source` 时不得宣称本轮修改了页面源码，也不得用编译或现有页面状态替代源码变更证据。跳过项必须来自用户明确约束，不能由模型自行缩减范围。

第 6 条按资源独立核验：每个被 final 声称“已写入”“已验证”或给出记录数的表单/流程，都必须有该资源自己的成功 create 返回值和只读 query/readback 证据。不得把一张表单的 3 条记录复制成其他表单也有 3 条；没有证据的资源只能写“未写入”“未抽查”或“跳过”，不能用应用发布成功替代数据核验。

若本轮修改过页面源码但没有成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，只能交付“源码已修改，尚未发布”的说明。

需求含 `userTasks` 和 `entryRecommendation` 时，按最终 PRD 核对服务与管理任务的实际访问路径，沿用用户已确认的调整；入口建议不作为完成证据。只有相关页面及访问配置回读通过后才交付对应入口，不为双入口补造后台功能，不用 `/admin` 开发后台代替业务管理工作区。

## build-manifest 约定

完整搭建收尾前，从本轮真实创建、复用和发布结果写入 `prd/<项目名>/build-manifest.json`。它只是轻量事实源，不是严格 schema；只记录已经拿到的真实资源名、类型和 ID，用于让 `check-prd-completeness` 做一次 app 资源列表 readback 后判断页面/资源数量是否完整。

`build-manifest.json` 与 Step 2 的 `requirement-brief.json`、`prd.md`、`design.md` 一样只供内部编排和验收使用。不得把它们登记为用户可见附件或下载卡片。若 final 将概述 seed records，manifest 中为每个资源分别记录实际写入数、query 抽查数和核验状态；未知值保持未知，不得从其他资源推导。

平台导航管理页需另外从实际 workbench 入口核对没有重复跨模块菜单；将页面配置回读与视觉检查分开记录，未打开页面时标记视觉待验证，不把 build-manifest 资源齐全或编译成功当作导航验收。

资源检查只消费 `display-page`、`normal-form`、`process-form` 资源项；不检查字段、必填、选项、seed records、导航顺序、表单 Schema、页面发布内容、截图或视觉体验。

最小示例：

```json
{
  "resources": [
    { "name": "销售工作台", "type": "display-page", "formUuid": "FORM-HOME", "main": true, "required": true },
    { "name": "客户信息", "type": "normal-form", "formUuid": "FORM-CUSTOMER", "required": true }
  ],
  "pages": [
    { "name": "销售工作台", "type": "display-page", "formUuid": "FORM-HOME", "main": true, "required": true }
  ],
  "forms": [
    { "name": "客户信息", "type": "normal-form", "formUuid": "FORM-CUSTOMER", "required": true }
  ],
  "seedEvidence": [
    { "name": "客户信息", "formUuid": "FORM-CUSTOMER", "createdCount": 3, "queriedCount": 3, "verified": true },
    { "name": "商机信息", "formUuid": "FORM-OPPORTUNITY", "createdCount": 0, "queriedCount": 0, "verified": true }
  ]
}
```

## 素材调度记录

有素材任务时，build-manifest 另保留物化输出 `assetTasks`（Fast 使用同契约），并汇总每页真实 taskState 到 `assetExecution.tasks`；业务任务起止时间记录在 `assetExecution.businessWork`。所有时间使用带时区的 ISO 格式，不能用当前时间补造历史。示例只说明字段，值必须换成真实执行回执：

```json
{
  "assetExecution": {
    "tasks": [{
      "taskKey": "/actual/project/asset-manifests/home.json", "pageId": "home",
      "executionMode": "background_shell", "toolName": "Bash", "backgroundOption": "run_in_background=true",
      "hostTaskId": "actual-host-job-id", "status": "completed",
      "startedAt": "2026-09-16T07:00:00Z", "dispatchReturnedAt": "2026-09-16T07:00:01Z", "endedAt": "2026-09-16T07:00:30Z"
    }],
    "businessWork": [{ "taskKey": "create-app", "startedAt": "2026-09-16T07:00:02Z", "endedAt": "2026-09-16T07:00:20Z" }]
  }
}
```

`executionMode=synchronous` 必须记录 fallbackReason，并先推进独立业务；不伪造 hostTaskId。复用已验证 final 素材用 reused/completed 和 reuseEvidence。纯素材修补确无独立业务时，记录 independentWork=none、noIndependentWorkReason，businessWork 为空；仍不能声称业务并行。

`check-prd-completeness` 返回 assetExecution 审计状态。后台调用完成后才返回、业务与素材没有实际时间重叠、同步路径素材前置、缺少时间或预期任务记录，都会产生 needs_review 项；正确的同步退化可通过记录检查，不被说成异步。旧 manifest 没有这类记录时为 not_checked，不能认定已经并行；有 assetTasks 却缺记录则需复核。本检查只验证记录一致性，不独立证明宿主确实执行，更不替代图片内容验收。

## 访问态入口验收

按 [访问态入口契约](../references/entry-navigation.md) 分别验收访客与业务管理者。管理端可以直接交付已验证的 `/workbench/{formUuid}?viewUuid=...` 作为本入口的唯一默认任务链接，不展开全部表单地址；根 `/workbench` 只有默认落点符合任务时才使用。管理端没有自定义首页时以原生管理视图和权限验证为准，不要求主页面 KPI。前台必须使用已回读的独立 custom 链接；菜单隐藏不授予权限，未取得真实角色证据时明确标记多身份在线验收未完成。开发后台不属于前后台业务切换。

## 结果输出格式

- 准备 2-3 句业务交付总结，并给一个名为“应用访问入口”的入口组。
- `notify_human` 是终态交付动作，其终态 artifact 的可见 `description` 是本轮业务总结、readback 事实和必要上下文的统一载体；用户要求的记录数、资源 ID、发布状态或核验结果也写入这里。调用成功即完成本轮交付。宿主没有交付工具时，在最终回复中给出相同的总结、核验结果与入口。
- 一次完整应用 run 交付一组用户可见的“应用访问入口”。同一应用的后续交付从已有资源和已验证 URL 生成当前 run 的入口组；资源变更由用户本轮明确要求的变更范围驱动。
- 业务资源在总结中按能力或数量概述，例如“已完成 4 张业务表单、1 条审批流程和 1 个经营看板”。
- 用户或调用方明确要求资源清单、资源 UUID/ID、发布状态或测试数据摘要时，终态 artifact 的 `description` 包含简洁的“交付清单”。清单是本轮真实返回值和只读 readback 的投影，覆盖已创建或发布资源的名称、类型、ID、主页面发布状态及 seed records 写入/抽查摘要；未知信息标记为未核验。
- 业务总结中的资源数量、seed records 数量和完成状态与逐资源真实返回值/readback 一一对应；证据不完整的资源标记为未核验。
- 新增、修改或发布单个具体页面时，交付当前页面并保持单页范围。
- 完整应用的入口组按有效范围交付：统一工作区或前后台双入口包含经验证的“业务管理入口”：根 `{base_url}/{appType}/workbench` 或上述指定任务/视图链接；明确仅前台时不追加业务后台，但仍提供开发者管理后台。
- 前台页面在 PRD 中为 `entryMode=standalone`，且 Step 8 回读确认 `isRenderNav=false` 时，入口组包含“前台” `{base_url}/{appType}/custom/{formUuid}`；否则不得输出。
- 完整应用默认交付“开发者管理后台” `{base_url}/{appType}/admin`，使用 `create-app` 或 `app-list` 成功结果中的 `adminUrl`。`application_entry_policy.entries.admin=include` 不受云端/本地宿主或登录态注入方式影响；不要沿用旧版本云端省略 admin 的规则。地址生成不代表已验证收件人的管理权限，实际访问仍由平台鉴权。
- 完整应用一般为 2–3 个地址：有前后台时为“前台、业务后台、开发者管理后台”；仅前台时为“前台、开发者管理后台”；统一工作区时为“应用工作台、开发者管理后台”。同一业务入口不重复凑数，不为补链接创建额外业务后台。用户明确排除开发者入口时遵从；单页任务保持单页交付范围。
- 若历史创建结果缺少 `adminUrl`，分页查询 `app-list` 并匹配真实 `appType`（名称仅辅助识别），保留其 `adminUrl`；不要自行猜租户域名或资源 ID。无法取得时明确标记开发者入口待补齐，不得静默省略或声明交付完成。
- 三个入口属于同一个应用入口组，不得各自连同业务资源再生成多组交付。
- 不把 `g.alicdn.com` 的 `index.css`、`index.js`、`index.html`、`locales/*.json`、构建产物 URL、CDN 资源 URL 或中间文件链接当成最终结果展示。
- 调用方或评测要求结构化结果时，额外输出顶层 `skillsUsed`，只填写本轮实际读取并使用的 `yida-*` 子技能名；不得把计划使用或未加载的技能写入。

交付卡片描述与入口示例（根据本轮实际完成内容填写）：

```markdown
已完成订单、客户和商品等核心业务表单，并发布首页、订单管理和库存看板等入口页面。当前应用已支持订单录入、库存预警、销售统计、表单提交入口和详情查看，示例记录、轻量导航排序与统一应用主题也已就绪。

应用访问入口：

- 前台：`{base_url}/{appType}/custom/{formUuid}`（仅 `standalone` 且回读通过）
- 业务后台：`{base_url}/{appType}/workbench`（有独立业务后台时，按已验证的默认任务选择入口）
- 开发者管理后台：`{base_url}/{appType}/admin`（完整应用默认提供）
```

只有用户或调用方明确要求资源清单、资源 UUID/ID、发布状态、测试数据摘要、排障、复盘、迁移或复制配置时，才补充技术 ID。显式要求一旦命中，这些信息写入交付卡片描述，属于本轮验收结果，不能被“默认隐藏技术 ID”规则覆盖。

## URL 规则

| 页面类型 | URL 格式 |
| --- | --- |
| 开发者管理后台 | `{base_url}/{appType}/admin`（取 CLI `adminUrl`） |
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页（默认隐藏导航） | `{base_url}/{appType}/submission/{formUuid}?isRenderNav=false` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 独立自定义页面 | `{base_url}/{appType}/custom/{formUuid}`；页面 `isRenderNav=false` 回读通过，混合前后台应用保留 `hideAppNav=n` |
| 原生报表（仅单独交付该报表时） | 使用 CLI 返回的 `{base_url}/{appType}/workbench/{reportId}`；禁止拼接 `/{appType}/report/{reportId}` |
| 表单详情页（抽屉/隐藏导航） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false` |
| 表单详情页（编辑模式） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit&navConfig.layout=1180&isRenderNav=false` |

完整应用即使包含原生报表，也不得把模型猜测的报表路由或每张表单的管理地址作为应用交付入口。入口组包含范围内的工作台、经回读确认的前台，以及完整应用默认提供的开发者管理后台。

## 可选后置

以下动作只在用户明确要求或 PRD 验收标准命中时追加：

| 可选项 | 子技能 | doneWhen |
| --- | --- | --- |
| 精细导航整理 | `use_skill("yida-nav-group", "整理应用导航分组")` | 主页面/核心表单顺序符合业务入口 |
| 数据桥深度接入 | `use_skill("yida-canvas-data-binding", "接入页面数据")` 或 `use_skill("yida-data-source-connectors", "绑定设计器数据源")` | 页面真实数据读写稳定，空态/错误态可恢复 |
| 报表/图表 | `use_skill("yida-report", "创建原生报表")`、`use_skill("yida-rechart", "创建 Recharts 页面")` 或 `use_skill("yida-chart", "创建 ECharts 页面")` | 报表或图表页面已创建/发布 |
| 公开访问 | `use_skill("yida-page-config", "配置页面公开访问")` | 分享配置保存成功 |
| 截图/人工验收 | 按当前工具能力 | 截图或用户确认通过 |

## 错误处理

- 不编造 `appType`、`formUuid`、`fieldId`、`reportId`。
- OpenYida CLI 失败时保留 stdout/stderr 诊断。
- 同一命令失败后，必须改变登录态、组织、参数、输入文件或字段 ID 后才能重试。
- corpId 与目标组织不一致时先停下，让用户选择重新登录或确认在当前组织继续。
- 输入 JSON/YAML/CSV/JSX 等业务文件必须用结构化文件写入工具创建。
- 用户要求删除应用时，必须展示应用名称、应用 ID、影响范围，并等待明确“确认删除”后才可执行。

## Checklist

- [ ] 唯一一组“应用访问入口”的终态 artifact `description` 已包含业务总结；
- [ ] `notify_human` 作为最后一个动作调用，用户显式要求的事实清单和资源 ID 已进入可见 `description`；
- [ ] final 中每个资源数量和数据完成声明都有对应资源自己的成功返回值/readback；未把一张表单的记录数套用到其他表单；
- [ ] 用户或调用方显式要求资源清单/UUID/发布状态/测试数据摘要时，终态 artifact `description` 已完整列出经核验的交付清单；
- [ ] 已写入轻量 build-manifest 并运行页面/资源数量完整性风险检查；未通过时没有声称“已按 PRD 完成搭建”；
- [ ] 已按 `constraints.prohibitedActions` 调整完成条件；跳过写操作时没有伪造已换肤、已修改源码或已发布；
- [ ] 未把内部文件或每个业务资源分别交付；
- [ ] 按有效范围交付管理入口，frontend-only 不追加工作台；custom 只在 `standalone` 写后回读通过时存在，完整应用默认包含开发者管理后台，登录方式不作为省略依据；
- [ ] 未默认暴露资源 ID 或其他管理态链接；
- [ ] 结构化结果中的 `skillsUsed` 只包含实际读取并使用的技能；
- [ ] 未把 CDN 构建产物当作交付链接；
- [ ] 未执行用户未要求的可选后置动作。

整个应用采用自定义导航时，交付前核对应用导航已隐藏，且 PRD 清单中每个表单、流程表单和自定义页面均有 `get-form-config` 返回 `isRenderNav=false` 的记录。任一页面配置失败时，该导航方案尚未完成。
