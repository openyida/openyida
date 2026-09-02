---
name: yida-report
description: "创建宜搭原生报表。"
---

# 宜搭原生报表技能

## 适用范围

- 不得把不支持、冲突或状态不确定的任务改走 `create-report` 写入，不得按标题、组件类型或数组位置 adopt、猜 report/chart/filter ID。
- 只有报表目标明确属于当前普通 OpenYida 资源时，以下示例、stdout/stderr 和返回行为才按本技能契约使用；所有权不明确时零远端写。

## 严格禁止 (NEVER DO)

- 不要在前端直接聚合表单数据，必须通过宜搭原生报表的 `getDataAsync.json` 或 `getCacheData.json` 接口获取聚合数据
- 不要编造 `reportId`、`datasetId`、`fieldId`，必须从报表 Schema 或 URL 中提取
- 不要将本技能与 `yida-chart` 混淆：本技能负责创建原生报表（数据源），`yida-chart` 负责 ECharts 可视化
- 不要在没有原生报表的情况下直接使用 ECharts，ECharts 必须依赖原生报表作为数据源
- 不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成报表配置 JSON
- 不要把其他应用的 `REPORT_xxx`、`prdId/topicId`、`cid` 复制给当前应用的 ECharts 页面

## 严格要求 (MUST DO)

- **创建/发布前必须确认**：执行报表创建或发布操作前，必须向用户展示报表配置摘要（图表类型、数据源、字段映射），获得用户明确同意后再执行
- 普通"报表"、"统计"需求默认使用本技能，不要直接跳到 `yida-chart`
- 报表作为 ECharts 页面数据源时，必须创建或同步到消费页面所在的同一个 `appType`；跨应用迁移必须重新创建/同步报表并替换绑定
- 参考官方示例时先确认 schema 证据：只有 `formType: "report"` 或组件树出现 `Youshu*` 报表组件时才按原生报表处理；`report` 标签但默认页是 `receipt` 或自定义页时，先判断是否只是数据准备页或看板页
- 调用报表数据 API 前必须确认 `reportId`、`cid`、`dataSetKey`、`filterKey` 来自当前应用真实报表 Schema
- 解析报表数据时必须处理 `data.rows` 为空的情况，避免页面崩溃
- 报表配置 JSON 需要落盘时，必须用结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/`，例如 `<projectRoot>/.cache/openyida/pm/pm-report-team.json`；不要在仓库根目录、系统临时目录或 `.cache/` 顶层生成 `*-report*.json`
- 为 ECharts 页面创建报表后，必须同步写入 `<projectRoot>/.cache/openyida/<任务名>/report-binding.json`，记录数据源表单、`REPORT_xxx`、组件 `cid`、`className`、`dataSetKey`、`filterKey`
- 本技能不读写 memory，报表配置通过 `openyida create-report` 命令写入宜搭平台，不依赖跨会话的 memory 状态

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 普通报表/统计需求 | "报表"、"统计"、"数据分析"（默认使用本技能） |
| 读取报表聚合数据 | 调用 `getDataAsync.json` / `getCacheData.json` |
| 为 ECharts 提供数据源 | 先用本技能创建原生报表，再用 `yida-chart` 可视化 |

## 触发条件

**正向触发**：
- "报表"、"统计"、"数据分析"（默认使用本技能）
- "创建报表"、"生成统计图表"
- 为 ECharts 可视化提供数据源

> ⚠️ 严禁在前端直接聚合表单数据，必须通过原生报表 `getDataAsync.json` 或 `getCacheData.json` 获取聚合数据。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| reportId/datasetId 不存在 | 不得编造，必须从报表 URL 或 Schema 中提取 |
| 报表数据 rows 为空 | 必须处理空数据情况，显示"暂无数据"而非页面崩溃 |
| 前端直接聚合表单数据 | 严禁，必须通过 `getDataAsync.json` 或 `getCacheData.json` 获取聚合数据 |
| 命令执行失败 | 检查登录态（`openyida env`），确认 appType 和 formUuid 正确 |

---


## 概述

本技能用于通过宜搭原生报表（YoushuTable）的聚合数据驱动 ECharts 图表看板，覆盖 API 调用方式、数据解析、常见风险和处理规则。

---

## 核心架构

```
宜搭表单（数据源）
    ↓ 数据写入
宜搭原生报表（服务端聚合）
    ↓ 报表 API
ECharts 自定义页面（前端渲染）
```

官方示例中心的报表范式是“原生报表先聚合，自定义页面后增强”。因此，除非用户明确要做高级视觉看板，否则先创建或复用原生报表；只有在已有报表提供聚合数据后，再让 `yida-chart` 或 `yida-canvas-custom-page` 承载展示层高级视觉。

### 作为 ECharts 页面数据源的绑定纪律

ECharts 页面出现 `no permission for the report` 时，优先怀疑页面绑定了旧应用报表。修复顺序必须是：

1. 在当前业务应用内创建或同步数据源表单与原生报表。
2. `openyida get-schema <appType> <REPORT_xxx> --json` 回读新报表 Schema。
3. 从 `componentsTree` 提取真实 `node_oc...` 形式的 `cid`、`componentName/className`、`dataSetModelMap` key 和组件级 `filterKey`。
4. ECharts 页面通过 `getFormNavigationListByOrder` 按 `REPORT_xxx` 动态拿 `topicId/prdId`，不要硬编码旧 `prdId`。
5. 把绑定关系落到 `.cache/openyida/<任务名>/report-binding.json`，再补 Jest / grep 断言，禁止旧 `REPORT_xxx`、旧 appType、旧 cid 回流。

**为什么不用 `searchFormDatas` 前端聚合？**

| 对比项 | `searchFormDatas` 前端聚合 | 原生报表 API |
|--------|--------------------------|-------------|
| 数据准确性 | ❌ pageSize 最大 100，数据量大时不完整 | ✅ 服务端聚合，数据 100% 准确 |
| 性能 | ❌ 需要分页拉取全部数据再前端计算 | ✅ 服务端直接返回聚合结果 |
| 适用场景 | 数据量 < 100 条的简单统计 | 任意数据量的聚合统计 |

---

## 报表 API 详解

### 接口地址

```
POST /alibaba/web/{appType}/visual/visualizationDataRpc/getDataAsync.json
```

### 关键参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pageName` | String | 是 | 固定值 `"report"` |
| `prdId` | String | 是 | 报表的 prdId（从报表 URL 中获取） |
| `cid` | String | 是 | 报表组件 ID（如 `YoushuTable_mmx9ha6ar`） |
| `cname` | String | 是 | 组件名称（如 `"按状态统计"`） |
| `className` | String | 是 | 组件类名（如 `"YoushuTable"`、`"YoushuSimpleIndicatorCard"`） |
| `dataSetKey` | String | 是 | 数据集 key（表格用 `"table"`，指标卡用 `"youshuData"`） |

> 📖 请求示例、返回数据结构、数据解析方法、常见风险（8条）、聚合函数、常见问题详见 [references/report-api-guide.md](references/report-api-guide.md)，按需读取。

---

## 原生报表 Schema 构建（vc-yida-report）

### 概述

宜搭原生组件库本身包含更多组件，但 OpenYida CLI 只开放已经接入并纳入确定性契约的类型。未知类型、未探测类型和缺失 `type` 均会在远端写入前失败，绝不静默回退成柱状图。Agent 应通过 `openyida create-report` 传入结构化图表配置，由 CLI 内部构建并发布 Schema，不要尝试读取或手写 `build-yida-report-schema.js`。

<!-- runtime-supported-chart-types: bar, calendarheatmap, combo, funnel, gauge, indicator, line, map, pie, pivot, table -->

- **组件库地址**：`//g.alicdn.com/code/npm/@ali/vc-yida-report/1.0.101/pc.js`
- **全局挂载**：`window.YidaReport`
- **创建入口**：`openyida create-report <appType> "<报表名称>" <配置JSON文件路径> --json`
- **字段配置参考**：[`report-field-config-guide.md`](../../references/report-field-config-guide.md)

### 组件总览

| 组件名 | 中文名 | 构建函数 | 类型 |
|--------|--------|---------|------|
| `YoushuSimpleIndicatorCard` | 指标卡 | `buildSchema.simpleIndicatorCard()` | KPI 展示 |
| `YoushuLineChart` | 折线图 | `buildSchema.lineChart()` | 图表 |
| `YoushuPieChart` | 饼图 | `buildSchema.pieChart()` | 图表 |
| `YoushuGroupedBarChart` | 分组条形图 | `buildSchema.groupedBarChart()` | 图表 |
| `YoushuFunnelChart` | 漏斗图 | `buildSchema.funnelChart()` | 图表 |
| `YoushuGauge` | 仪表盘 | `buildSchema.gauge()` | 图表 |
| `YoushuComboChart` | 组合图 | `buildSchema.comboChart()` | 图表 |
| `YoushuCalendarHeatmap` | 日历热力图 | `type: calendarHeatmap` | 图表 |
| `YoushuMap` | 地图 | `type: map` | 图表 |
| `YoushuCrossPivotTable` | 交叉透视表 | `buildSchema.crossPivotTable()` | 表格 |
| `YoushuTable` | 基础表格 | `buildSchema.table()` | 表格 |
| `YoushuPageHeader` | 页面标题栏 | `buildSchema.pageHeader()` | 布局 |
| `YoushuTopFilterContainer` | 顶部筛选容器 | `buildSchema.topFilterContainer()` | 筛选 |
| `YoushuSelectFilter` | 下拉筛选器 | `buildSchema.selectFilter()` | 筛选 |

上表中的图表/表格类型与 runtime capability registry 一致；页面标题和 select 筛选器是 CLI 已接入的辅助组件。雷达、普通热力、词云、数字卡等未注册 widget 即使存在于设计器组件库，也不得传给 CLI。

### Schema 构建细节参考

普通报表创建优先使用 `openyida create-report <appType> "<报表名称>" <配置JSON文件路径> --json`，由 CLI 内部构建并发布 Schema。机器调用必须保留 `--json`，以便在远端已经写入但回读不一致时读取安全的恢复信息。需要查看构建函数、组件示例、settings 字段或完整页面组合示例时，再读取 [references/schema-builder-details.md](references/schema-builder-details.md)。

---

## 报表 Schema 构建关键规则（chart-builder.js）

### 命令调用格式

```bash
openyida create-report <appType> "<报表名称>" <配置JSON文件路径> --json
# 配置文件路径示例：.cache/openyida/<项目名或任务名>/<报表名>-report.json
```

> 配置 JSON 先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；从 workspace 根执行命令时传 `project/.cache/openyida/<项目名或任务名>/<报表名>-report.json`。

**⚠️ 第二个参数是报表名称，必须使用业务含义的中文名称**（如"任务管理数据报表"），不要传 formUuid。

对 `REPORT_SCHEMA_READBACK_MISMATCH` 等 post-create failure，同时读取顶层 `sideEffectState`、`residual`、`retrySafe`、`nextStep` 以及兼容字段 `details.nextAction`。若返回 `partial=true`、`residual.owned=true`，立即把 `residual.appType + residual.reportId` 锁定为本 task/run 唯一报表目标。即使更换配置文件、标题、prompt 或进入恢复轮次，也禁止再次执行 `create-report`，禁止按名称猜资源，禁止自动删除、隐藏或创建同名 display 页面掩盖残留。

先且只先执行一次 `openyida report inspect <residual.appType> <residual.reportId> --json`。只有 inspect 证明原报表身份正确、已有组件集合明确，并且能够确定性算出尚未写入的 owned 图表时，才允许用 `append-chart` 修复同一个 `residual.reportId` 并再次 readback；不能证明安全增量或当前 CLI 没有对应 update/repair 能力时，必须停止并交付完整 residual、mismatch 和 nextStep，不能重新创建。

恢复和最终交付只能使用 create/inspect 返回的 `workbenchUrl`（兼容读取 `url`）；禁止自行拼接 `/{appType}/report/{reportId}`。单独交付原生报表时使用 `/{appType}/workbench/{reportId}`，完整应用仍交付应用首页 `/{appType}/workbench`。

<!-- owned-residual-contract:start -->
```json
{
  "when": "partial=true && residual.type=report && residual.owned=true",
  "createReportAllowed": false,
  "inspect": {
    "commandId": "report.inspect",
    "appTypeSource": "residual.appType",
    "reportIdSource": "residual.reportId",
    "maxAttempts": 1
  },
  "allowedRepairCommands": ["append-chart"],
  "repairReportIdSource": "residual.reportId",
  "deleteAllowed": false,
  "unsafeRepairFallback": "stop_and_report_residual"
}
```
<!-- owned-residual-contract:end -->

### cubeCode 格式规则

报表引擎的 `cubeCode` 使用**下划线**分隔，而 `formUuid` 使用**连字符**分隔。代码中 `normalizeCubeCode()` 会自动转换，但配置文件中建议直接使用下划线格式：

```
formUuid:  FORM-AB4ACB9DD12C470D82047E05CDC19166CJSU
cubeCode:  FORM_AB4ACB9DD12C470D82047E05CDC19166CJSU  ← 连字符替换为下划线
```

### 配置文件字段格式

推荐使用**结构化格式**（`xField`/`yField`），而非简化的 `fields` 数组格式：

```json
{
  "reportName": "任务管理数据报表",
  "formUuid": "FORM-xxx",
  "charts": [
    {
      "title": "按优先级分布",
      "type": "pie",
      "cubeCode": "FORM_xxx",
      "xField": {
        "fieldCode": "selectField_xxx",
        "aliasName": "优先级",
        "dataType": "STRING",
        "aggregateType": "NONE"
      },
      "yField": [
        {
          "fieldCode": "pid",
          "aliasName": "数量",
          "dataType": "STRING",
          "aggregateType": "COUNT"
        }
      ]
    }
  ]
}
```

### 各图表类型的字段配置

| 图表类型 | 必填字段 | 说明 |
|---------|---------|------|
| `indicator` | `kpi`（数组） | 每个 kpi 字段需要 `fieldCode`、`aliasName`、`aggregateType` |
| `pie` | `xField`（单个）+ `yField`（数组） | xField 为分类维度，yField 为数值度量 |
| `bar`/`line`/`funnel` | `xField`（单个）+ `yField`（数组） | `bar`/`line` 可选 `groupField` 分组 |
| `calendarHeatmap` | `xField`（日期）+ `yField`（数值） | 日期字段建议显式 `dataType: DATE`、`timeGranularityType: DAY` |
| `map` | `locationFields`（地域层级）+ `valueField`（数值） | 地域字段按省/市/区顺序传入，数值通常使用 `pid + COUNT` |
| `table` | `columnFields`（数组） | 每列一个字段对象 |
| `combo` | `xField` + `leftYFields`/`rightYFields` 至少一组 | 柱线混合图，横轴和至少一个纵轴角色均为硬校验 |
| `gauge` | `valueField`（单个） | 可选 `assitValueField` |
| `pivot` | `columnList`（数组） | 交叉透视表 |

### 只读检查与绑定提取

创建或追加后使用 `openyida report inspect <appType> <REPORT_xxx> --json` 回读 `schemaVersion=V5`、`domainCode=tEXDRG` 的真实 Schema。输出包含 `url`、`workbenchUrl`、revision、组件 `cid`、`dataSetKeys`、`filterKeys`、`cubeCodes`、`fields`、`queryProbe`、RGL `layout`、`prdId`、`pageId` 及顶层 `runtimeQueryVerified`。只有严格 Schema 回读和所有真实图表查询均成功，才能宣称报表完成；字段缺失时保持 `null`/空数组，不得猜测。运行字段（包括 `css`、`lifeCycles`、`utils`）属于严格 readback 内容，不作为“设计器字段”全局忽略。

真实报表 E2E 必须使用独立 `OY_REPORT_` runId 与 marker，先只读证明 corp/app/预置数据和 owned 写入范围，并在首次写入前同步落盘脱敏 registry、acceptance manifest、完整既有 report ID/可用 identity 摘要与 baseline hash。create 响应只能登记为未拥有的 candidate；平台回读必须证明 reportId、title、marker、corp/app 精确匹配、ID 不在 baseline 且候选唯一，之后才允许登记 owned resource 和 cleanup。runtime marker 必须声明窄 `markerPath` 与精确 `markerValue`，只接受指定路径严格相等；platform、runtime、UI 三层机器断言通过后仍必须执行 exact-identity owned cleanup。无法证明安全删除时结果只能是 `cleanup_blocked` 并报告 residual，截图仅作辅助证据。

### fieldCode 运行时解析

`get-schema` 返回 `reportFieldCodeCandidates`，但候选不等于 cube 真实元数据。配置可先使用真实 `fieldId`；`create-report` 保存后必须逐图表调用运行时数据接口验证。若平台仅对 Select/Radio/Checkbox/Employee 等字段的 raw 与 `_value` 表示存在差异，CLI 只允许在同一个 `reportId` 内做一次候选切换并重新查询；不得新建同名报表，也不得全局忽略 metadata mismatch。

### dataSetModelMap 结构要点

报表引擎要求 `dataSetModelMap` 中每个数据集包含**两层字段定义**：

1. **`dataViewQueryModel.fieldDefinitionList`**：查询模型层，定义字段的 `alias`、`fieldCode`、`aggregateType` 等
2. **外层字段数组**（`xField`/`yField`/`fieldList`/`columnFields` 等）：展示层，每个字段对象包含 20+ 属性（`visible`、`isDimension`、`fieldKey`、`cubeCode`、`title`、`format`、`link`、`drillList`、`orderBy`、`measureType` 等）

两层都必须正确填充，否则报表图表会显示为空。

地域分布、订单日历等需求不得退化成普通柱/饼图：先从真实表单 Schema 取得地址拆分字段或 DateField，再分别使用 `map` / `calendarHeatmap`。既有报表反向分析时，以 `report inspect` 的组件名、cubeCode、字段角色和时间粒度为准，不按图表标题猜配置。

### userConfig 格式

报表引擎期望 `userConfig` 为**数组格式**（带 `ColumnFieldSetter` 配置器定义），而非简单对象格式：

```json
[
  {
    "name": "chartData",
    "title": "配置数据",
    "items": [
      {
        "setterName": "ColumnFieldSetter",
        "name": "xField",
        "title": "横轴",
        "setterProps": { "single": true, "showFormatTab": true }
      },
      {
        "setterName": "ColumnFieldSetter",
        "name": "yField",
        "title": "纵轴",
        "setterProps": { "showFormatTab": true, "showDataLink": true }
      }
    ]
  }
]
```

指标卡（`indicator`）的 `userConfig` 也是数组格式，`name` 为 `youshuData`。
