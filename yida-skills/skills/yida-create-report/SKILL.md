---
name: yida-create-report
description: >-
  宜搭原生报表创建与管理技能。支持通过 CLI 命令创建报表页面（create-report）和向已有报表追加图表（append-chart），
  涵盖 9 种图表类型（柱状图/折线图/饼图/漏斗图/仪表盘/柱线混合/表格/指标卡/交叉透视表）和筛选器联动。
  同时包含原生报表 Schema 构建规则（vc-yida-report 组件库、build-yida-report-schema.js 构建脚本）和 chart-builder.js 的关键规则。
  当用户需要创建"标准报表"、"数据统计"、"数据看板"时使用此技能。本技能输出宜搭原生报表页面。
  如需 ECharts 高级定制化图表（更美观、更灵活的可视化），请使用 yida-chart 技能。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-development
  version: 2.0.0
  tags:
    - yida
    - low-code
    - report
    - chart
    - dashboard
    - vc-yida-report
    - schema
---

# 宜搭原生报表创建与管理技能

## 概述

本技能负责宜搭**原生报表**的创建和管理，包含两部分：

1. **CLI 命令**：通过 `openyida` 命令行工具创建报表页面和追加图表
2. **Schema 构建规则**：原生报表组件库（vc-yida-report）的 Schema 构建规范和 chart-builder.js 的关键规则

支持两个命令：
- **`create-report`**：创建新报表页面，定义图表列表、数据源、筛选器联动等
- **`append-chart`**：向已有报表追加图表，自动计算布局位置

> 💡 **与 yida-chart 的分工**：本技能负责宜搭原生报表（标准报表）。如果用户需要"更美观"、"高级"、"定制化"、"ECharts"、"Dashboard 大屏"等高级可视化，请使用 `yida-chart` 技能。

## 何时使用

当以下场景发生时使用此技能：
- 用户需要创建数据分析报表/仪表盘
- 用户需要在报表中添加柱状图、折线图、饼图等图表
- 用户需要向已有报表追加新图表
- 用户需要配置报表筛选器联动
- 已通过 `yida-create-app` 创建应用后，需要创建报表来展示数据
- `yida-chart` 技能需要先创建原生报表作为 ECharts 的数据源

## 支持的图表类型

| 类型标识 | 组件名 | 说明 |
|---------|--------|------|
| `bar` | YoushuGroupedBarChart | 柱状图（分组） |
| `line` | YoushuLineChart | 折线图 |
| `pie` | YoushuPieChart | 饼图 |
| `funnel` | YoushuFunnelChart | 漏斗图 |
| `gauge` | YoushuGauge | 仪表盘 |
| `combo` | YoushuComboChart | 柱线混合图 |
| `table` | YoushuTable | 基础表格 |
| `indicator` | YoushuSimpleIndicatorCard | 指标卡 |
| `pivot` | YoushuCrossPivotTable | 交叉透视表 |

---

## 命令1：create-report（创建报表）

### 用法

```bash
openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>
```

**⚠️ 第二个参数是报表名称，必须使用业务含义的中文名称**（如"任务管理数据报表"），不要传 formUuid。

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `报表名称` | 是 | 报表标题 |
| `图表定义JSON或文件路径` | 是 | 图表定义，支持两种格式：JSON 文件路径或 JSON 字符串 |

### 图表定义格式

#### 格式1：纯图表数组（简单模式）

```json
[
  {
    "type": "bar",
    "title": "销售额柱状图",
    "cubeCode": "FORM_XXX",
    "xField": {
      "fieldCode": "textField_xxx",
      "aliasName": "产品名称",
      "dataType": "STRING"
    },
    "yField": [
      {
        "fieldCode": "numberField_xxx",
        "aliasName": "销售额",
        "dataType": "NUMBER",
        "aggregator": "SUM"
      }
    ]
  },
  {
    "type": "pie",
    "title": "占比饼图",
    "cubeCode": "FORM_XXX",
    "xField": {
      "fieldCode": "selectField_xxx",
      "aliasName": "类别",
      "dataType": "STRING"
    },
    "yField": [
      {
        "fieldCode": "numberField_xxx",
        "aliasName": "数量",
        "dataType": "NUMBER",
        "aggregator": "COUNT"
      }
    ]
  }
]
```

#### 格式2：带筛选器的完整配置

```json
{
  "filters": [
    {
      "title": "竞赛项目",
      "placeholder": "请选择竞赛项目",
      "cubeCode": "FORM_XXX",
      "valueField": {
        "fieldCode": "selectField_xxx_value",
        "aliasName": "竞赛项目_值",
        "dataType": "STRING"
      },
      "labelField": {
        "fieldCode": "selectField_xxx_code",
        "aliasName": "竞赛项目_ID",
        "dataType": "STRING"
      },
      "linkTo": [0, 1]
    }
  ],
  "charts": [
    {
      "type": "bar",
      "title": "柱状图",
      "cubeCode": "FORM_XXX",
      "xField": { "fieldCode": "textField_xxx", "aliasName": "名称", "dataType": "STRING" },
      "yField": [{ "fieldCode": "numberField_xxx", "aliasName": "数值", "dataType": "NUMBER", "aggregator": "SUM" }]
    }
  ]
}
```

### 筛选器配置说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 筛选器标题 |
| `placeholder` | 否 | 占位提示文本 |
| `cubeCode` | 是 | 数据源表单 ID（如 `FORM_XXX`） |
| `valueField` | 是 | 值字段定义（`fieldCode`、`aliasName`、`dataType`） |
| `labelField` | 是 | 显示字段定义 |
| `linkTo` | 否 | 联动目标图表，数组元素可以是图表索引（数字）或图表标题（字符串）。不指定则联动所有图表 |
| `cubeTenantId` | 否 | 租户 ID，默认使用登录态中的 corpId |

### 图表字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `type` | 是 | 图表类型（见上方支持的图表类型表） |
| `title` | 否 | 图表标题 |
| `cubeCode` | 是 | 数据源表单 ID（如 `FORM_XXX`） |
| `xField` | 是 | X 轴/维度字段定义 |
| `yField` | 是 | Y 轴/度量字段定义（数组） |
| `w` | 否 | 图表宽度（1-12 栅格，默认 6） |
| `h` | 否 | 图表高度（默认 22） |

### 字段定义格式

推荐使用**结构化格式**（`xField`/`yField`），而非简化的 `fields` 数组格式：

```json
{
  "fieldCode": "textField_xxx",
  "aliasName": "字段显示名",
  "dataType": "STRING",
  "aggregator": "SUM"
}
```

- **dataType**：`STRING`、`NUMBER`、`DATE`
- **aggregator**（仅 yField）：`SUM`、`COUNT`、`AVG`、`MAX`、`MIN`

### 各图表类型的字段配置

| 图表类型 | 必填字段 | 说明 |
|---------|---------|------|
| `indicator` | `kpi`（数组） | 每个 kpi 字段需要 `fieldCode`、`aliasName`、`aggregateType` |
| `pie` | `xField`（单个）+ `yField`（数组） | xField 为分类维度，yField 为数值度量 |
| `bar`/`line`/`area` | `xField`（单个）+ `yField`（数组） | 可选 `groupField` 分组 |
| `table` | `columnFields`（数组） | 每列一个字段对象 |
| `combo` | `xField` + `leftYFields` + `rightYFields` | 柱线混合图 |
| `gauge` | `valueField`（单个） | 可选 `assitValueField` |
| `pivot` | `columnList`（数组） | 交叉透视表 |

### 示例

#### 示例1：创建简单报表

```bash
openyida create-report APP_XXX "销售报表" charts.json
```

#### 示例2：创建带筛选器的报表

```bash
openyida create-report APP_XXX "竞赛数据看板" config-with-filters.json
```

### 输出

日志输出到 stderr，JSON 结果输出到 stdout：

```json
{
  "success": true,
  "reportId": "REPORT-XXX",
  "reportTitle": "销售报表",
  "appType": "APP_XXX",
  "chartCount": 3,
  "url": "{base_url}/APP_XXX/workbench/REPORT-XXX"
}
```

---

## 命令2：append-chart（追加图表）

### 用法

```bash
openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>
```

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `reportId` | 是 | 已有报表 ID，如 `REPORT-XXX` |
| `图表定义JSON或文件路径` | 是 | 要追加的图表定义（数组格式） |

### 图表定义格式

与 `create-report` 的纯图表数组格式相同：

```json
[
  {
    "type": "line",
    "title": "趋势折线图",
    "cubeCode": "FORM_XXX",
    "xField": { "fieldCode": "dateField_xxx", "aliasName": "日期", "dataType": "DATE" },
    "yField": [{ "fieldCode": "numberField_xxx", "aliasName": "访问量", "dataType": "NUMBER", "aggregator": "SUM" }]
  }
]
```

### 示例

```bash
openyida append-chart APP_XXX REPORT-XXX new-charts.json
```

### 输出

```json
{
  "success": true,
  "reportId": "REPORT-XXX",
  "appType": "APP_XXX",
  "appendedChartCount": 2,
  "url": "{base_url}/APP_XXX/workbench/REPORT-XXX"
}
```

### 追加逻辑说明

- 自动获取已有报表 Schema
- 计算现有图表的最大 Y 位置，新图表从下方开始排列
- 自动检查并按需添加 `componentsMap` 条目
- 支持自动换行（当一行宽度超过 6 栅格时换行）

---

## 执行流程

### create-report 流程

```
[Step 1] 读取登录态（自动触发登录）
    ↓
[Step 2] 读取图表定义和筛选器配置
    ↓
[Step 3] 创建空白报表 → 获得 reportId
    ↓
[Step 4] 构建报表 Schema（图表 + 筛选器联动）
    ↓
[Step 5] 保存报表 Schema
    ↓
[完成] 输出报表 ID 和访问链接
```

### append-chart 流程

```
[Step 1] 读取登录态
    ↓
[Step 2] 读取图表定义
    ↓
[Step 3] 获取已有报表 Schema
    ↓
[Step 4] 计算布局位置，构建并追加图表节点
    ↓
[Step 5] 保存 Schema
    ↓
[完成] 输出追加结果和访问链接
```

---

## 报表 Schema 构建关键规则（chart-builder.js）

### cubeCode 格式规则

报表引擎的 `cubeCode` 使用**下划线**分隔，而 `formUuid` 使用**连字符**分隔。代码中 `normalizeCubeCode()` 会自动转换，但配置文件中建议直接使用下划线格式：

```
formUuid:  FORM-AB4ACB9DD12C470D82047E05CDC19166CJSU
cubeCode:  FORM_AB4ACB9DD12C470D82047E05CDC19166CJSU  ← 连字符替换为下划线
```

### fieldCode 后缀规则

| 字段组件类型 | 报表中的 fieldCode | 示例 |
|------------|-------------------|------|
| `SelectField` | 加 `_value` 后缀 | `selectField_xxx` → `selectField_xxx_value` |
| `EmployeeField` | 加 `_value` 后缀 | `employeeField_xxx` → `employeeField_xxx_value` |
| `TextField` | 原样使用 | `textField_xxx` |
| `NumberField` | 原样使用 | `numberField_xxx` |
| `DateField` | 原样使用 | `dateField_xxx` |
| 内置字段 `pid` | 原样使用 | `pid`（用于 COUNT 计数） |

### dataSetModelMap 结构要点

报表引擎要求 `dataSetModelMap` 中每个数据集包含**两层字段定义**：

1. **`dataViewQueryModel.fieldDefinitionList`**：查询模型层，定义字段的 `alias`、`fieldCode`、`aggregateType` 等
2. **外层字段数组**（`xField`/`yField`/`fieldList`/`columnFields` 等）：展示层，每个字段对象包含 20+ 属性（`visible`、`isDimension`、`fieldKey`、`cubeCode`、`title`、`format`、`link`、`drillList`、`orderBy`、`measureType` 等）

两层都必须正确填充，否则报表图表会显示为空。

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

---

## 可用的聚合函数

| 聚合函数 | 说明 | 适用字段类型 |
|---------|------|------------|
| `COUNT` | 计数 | 所有类型 |
| `COUNT_DISTINCT` | 去重计数 | 所有类型 |
| `SUM` | 求和 | `NumberField` |
| `AVG` | 平均值 | `NumberField` |
| `MIN` | 最小值 | `NumberField`、`DateField` |
| `MAX` | 最大值 | `NumberField`、`DateField` |

> ⚠️ **数值聚合必须使用 NumberField**：`TextField` 无法进行 SUM/AVG 等数值聚合，必须改为 `NumberField`。改字段类型后旧数据会丢失，需要重新写入。

---

## 原生报表 Schema 构建（vc-yida-report）

### 概述

宜搭提供了原生报表组件库 `vc-yida-report`，包含 **16 种**开箱即用的报表组件，涵盖图表、表格、筛选器、指标卡等。通过 Schema 构建脚本 `build-yida-report-schema.js` 可以快速生成报表页面的完整 Schema，无需手写配置。

- **组件库地址**：`//g.alicdn.com/code/npm/@ali/vc-yida-report/1.0.101/pc.js`
- **全局挂载**：`window.YidaReport`
- **Schema 构建脚本**：[`build-yida-report-schema.js`](./build-yida-report-schema.js)
- **组件详细文档**：[`reference/vc-yida-report-components-doc.md`](../../reference/vc-yida-report-components-doc.md)

### 组件总览

| 组件名 | 中文名 | 构建函数 | 类型 |
|--------|--------|---------|------|
| `YoushuSimpleIndicatorCard` | 指标卡 | `buildSchema.simpleIndicatorCard()` | KPI 展示 |
| `YoushuLineChart` | 折线图 | `buildSchema.lineChart()` | 图表 |
| `YoushuPieChart` | 饼图 | `buildSchema.pieChart()` | 图表 |
| `YoushuGroupedBarChart` | 分组条形图 | `buildSchema.groupedBarChart()` | 图表 |
| `YoushuFunnelChart` | 漏斗图 | `buildSchema.funnelChart()` | 图表 |
| `YoushuGauge` | 仪表盘 | `buildSchema.gauge()` | 图表 |
| `YoushuRadarChart` | 雷达图 | `buildSchema.radarChart()` | 图表 |
| `YoushuHeatmap` | 热力图 | `buildSchema.heatmap()` | 图表 |
| `YoushuCalendarHeatmap` | 日历热力图 | `buildSchema.calendarHeatmap()` | 图表 |
| `YoushuComboChart` | 组合图 | `buildSchema.comboChart()` | 图表 |
| `YoushuWordCloud` | 词云图 | `buildSchema.wordCloud()` | 图表 |
| `YoushuMap` | 地图 | `buildSchema.map()` | 图表 |
| `YoushuCrossPivotTable` | 交叉透视表 | `buildSchema.crossPivotTable()` | 表格 |
| `YoushuTable` | 基础表格 | `buildSchema.table()` | 表格 |
| `YoushuPageHeader` | 页面标题栏 | `buildSchema.pageHeader()` | 布局 |
| `YoushuTopFilterContainer` | 顶部筛选容器 | `buildSchema.topFilterContainer()` | 筛选 |
| `YoushuSelectFilter` | 下拉筛选器 | `buildSchema.selectFilter()` | 筛选 |
| `YoushuTimeFilter` | 时间筛选器 | `buildSchema.timeFilter()` | 筛选 |
| `YoushuInputFilter` | 区间筛选器 | `buildSchema.inputFilter()` | 筛选 |

### 核心工具函数

Schema 构建脚本提供以下核心函数，使用前需先引入：

```javascript
const {
  buildSchema,           // 各组件 Schema 构建器
  buildDataSetEntry,     // 构建数据集配置
  buildFieldDefinition,  // 构建字段定义
  buildFilterItem,       // 构建过滤条件
  buildOrderByItem,      // 构建排序项
  generateComponentId,   // 生成唯一组件 ID
} = require('./build-yida-report-schema');
```

### 数据集配置（dataSetModelMap）

所有报表组件通过 `dataSetModelMap` 配置数据源，每个数据集由 `buildDataSetEntry` 构建：

```javascript
buildDataSetEntry({
  cubeCode: 'your_cube_code',        // 数据集 cubeCode（必填）
  fieldDefinitionList: [              // 字段定义列表
    buildFieldDefinition({
      alias: 'date',                  // 字段别名（fieldKey）
      aliasName: '日期',              // 字段显示名称
      isDim: false,                   // ⚠️ 固定为 false（宜搭报表引擎要求所有字段 isDim 均为 false）
      dataType: 'DATE',              // STRING | NUMBER | DATE | BOOLEAN | ARRAY
      aggregateType: 'NONE',         // NONE | SUM | AVG | COUNT | MAX | MIN | COUNT_DISTINCT
      timeGranularityType: 'DAY',    // YEAR | QUARTER | MONTH | WEEK | DAY | HOUR | MINUTE | null
    }),
    buildFieldDefinition({
      alias: 'sales',
      aliasName: '销售额',
      isDim: false,
      dataType: 'NUMBER',
      aggregateType: 'SUM',
    }),
  ],
  fieldList: ['date', 'sales'],       // 查询字段别名列表
  filterList: [],                     // 过滤条件列表
  orderByList: [                      // 排序列表
    buildOrderByItem('date', 'ASC'),  // ASC | DESC
  ],
  limit: 1000,                        // 数据条数限制
  // 以下为筛选器专用参数
  cubeCodes: ['your_cube_code'],      // cubeCode 数组（筛选器使用）
  valueField: ['field_alias'],        // 值字段数组（筛选器使用）
  labelField: ['field_alias'],        // 显示字段数组（筛选器使用）
})
```

### 常用组件 Schema 构建示例

#### 指标卡

```javascript
buildSchema.simpleIndicatorCard({
  dataSetModelMap: {
    kpi_dataset: buildDataSetEntry({
      cubeCode: 'your_cube_code',
      fieldDefinitionList: [
        buildFieldDefinition({ alias: 'total_sales', aliasName: '总销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
        buildFieldDefinition({ alias: 'order_count', aliasName: '订单数', isDim: false, dataType: 'NUMBER', aggregateType: 'COUNT' }),
      ],
      fieldList: ['total_sales', 'order_count'],
    })
  },
  settings: { columnCount: 4, columnCountForH5: 2 }
})
```

#### 折线图

```javascript
buildSchema.lineChart({
  dataSetModelMap: {
    line_dataset: buildDataSetEntry({
      cubeCode: 'your_cube_code',
      fieldDefinitionList: [
        buildFieldDefinition({ alias: 'date', aliasName: '日期', isDim: false, dataType: 'DATE', timeGranularityType: 'DAY' }),
        buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
      ],
      fieldList: ['date', 'sales'],
      orderByList: [buildOrderByItem('date', 'ASC')],
    })
  },
  settings: {
    titleConfig: { label: '销售趋势' },
    height: 400,
    smooth: true,
    drillDown: false,
  }
})
```

#### 饼图（环形图）

```javascript
buildSchema.pieChart({
  dataSetModelMap: {
    pie_dataset: buildDataSetEntry({
      cubeCode: 'your_cube_code',
      fieldDefinitionList: [
        buildFieldDefinition({ alias: 'category', aliasName: '类别', isDim: false, dataType: 'STRING' }),
        buildFieldDefinition({ alias: 'amount', aliasName: '金额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
      ],
      fieldList: ['category', 'amount'],
    })
  },
  settings: {
    titleConfig: { label: '销售占比' },
    innerRadius: 0.6,  // >0 为环形图
  }
})
```

#### 基础表格（明细表）

```javascript
buildSchema.table({
  dataSetModelMap: {
    table: buildDataSetEntry({
      cubeCode: 'your_cube_code',
      fieldDefinitionList: [
        buildFieldDefinition({ alias: 'name', aliasName: '姓名', isDim: false, dataType: 'STRING' }),
        buildFieldDefinition({ alias: 'dept', aliasName: '部门', isDim: false, dataType: 'STRING' }),
        buildFieldDefinition({ alias: 'sales', aliasName: '销售额', isDim: false, dataType: 'NUMBER', aggregateType: 'SUM' }),
      ],
      fieldList: ['name', 'dept', 'sales'],
      orderByList: [buildOrderByItem('sales', 'DESC')],
    })
  },
  settings: {
    fixedHeader: true,
    theme: 'border',
    maxBodyHeight: 500,
    pagination: {
      pageSize: 20,
      showPageSelect: true,
      pageSizeList: [10, 20, 50, 100],
    }
  }
})
```

#### 筛选器（下拉 + 时间 + 区间）

```javascript
// 下拉筛选器
buildSchema.selectFilter({
  dataSetModelMap: {
    selectFilter: buildDataSetEntry({
      cubeCode: 'your_cube_code',
      cubeCodes: ['your_cube_code'],
      fieldDefinitionList: [
        buildFieldDefinition({ alias: 'dept_id', aliasName: '部门ID', isDim: true, dataType: 'STRING' }),
        buildFieldDefinition({ alias: 'dept_name', aliasName: '部门名称', isDim: true, dataType: 'STRING' }),
      ],
      fieldList: ['dept_id', 'dept_name'],
      valueField: ['dept_id'],
      labelField: ['dept_name'],
    })
  },
  settings: { labelConfig: { label: '部门' }, mode: 'multiple', showLabel: true }
})

// 时间筛选器
buildSchema.timeFilter({
  dataSetModelMap: {
    filterData: buildDataSetEntry({
      cubeCode: 'your_cube_code',
      cubeCodes: ['your_cube_code'],
      fieldDefinitionList: [
        buildFieldDefinition({ alias: 'create_date', aliasName: '创建日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
      ],
      fieldList: ['create_date'],
      valueField: ['create_date'],
    })
  },
  settings: { labelConfig: { label: '日期范围' }, mode: 'range', dataConfig: { queryType: 'Between' } }
})
```

### 完整报表页面 Schema 构建示例

以下示例展示如何组合多个组件构建一个完整的报表页面：

```javascript
const {
  buildSchema, buildDataSetEntry, buildFieldDefinition, buildOrderByItem,
} = require('./build-yida-report-schema');

const CUBE_CODE = 'your_cube_code_here';

const reportPageSchema = buildSchema.pageHeader({
  titleContent: '销售数据看板',
  titleTip: '数据每日 08:00 更新',
  children: [
    buildSchema.topFilterContainer({
      showTag: true,
      children: [
        buildSchema.timeFilter({ /* 时间筛选器配置 */ }),
        buildSchema.selectFilter({ /* 下拉筛选器配置 */ }),
      ],
    }),
    buildSchema.simpleIndicatorCard({ /* 指标卡配置 */ }),
    buildSchema.lineChart({ /* 折线图配置 */ }),
    buildSchema.table({ /* 明细表格配置 */ }),
  ],
});

console.log(JSON.stringify(reportPageSchema, null, 2));
```

### 通用 settings 配置参考

| 字段 | 类型 | 说明 |
|------|------|------|
| `titleConfig.label` | `string` | 组件标题 |
| `height` | `number` | 组件高度（默认 300） |
| `colorType` | `string` | 颜色类型，`default` 或 `CUSTOM_COLOR` |
| `customColor` | `string` | 自定义颜色，逗号分隔 |
| `drillDown` | `boolean` | 是否开启下钻（默认 false） |
| `limit` | `number` | 数据条数限制（默认 1000） |

### 各图表组件特有配置

| 组件 | 特有配置 | 说明 |
|------|---------|------|
| **折线图** | `smooth`, `isStack`, `isPercent` | 平滑曲线、堆叠、百分比堆叠 |
| **饼图** | `innerRadius` | 内半径（>0 为环形图） |
| **条形图** | `isStack`, `isPercent` | 堆叠、百分比堆叠 |
| **仪表盘** | `min`, `max`, `range` | 最小值、最大值、区间配置 |
| **基础表格** | `fixedHeader`, `theme`, `pagination` | 固定表头、风格、分页 |

---

## 注意事项

1. **cubeCode 必须正确**：`cubeCode` 是数据源表单的 formUuid（下划线格式），必须是已存在的表单
2. **字段 fieldCode 必须存在**：`xField` 和 `yField` 中的 `fieldCode` 必须是数据源表单中实际存在的字段 ID，可通过 `openyida get-schema` 获取
3. **fieldCode 后缀**：`SelectField` 和 `EmployeeField` 在报表中需要加 `_value` 后缀
4. **筛选器联动**：筛选器的 `linkTo` 指定联动的图表索引或标题，不指定则默认联动所有图表
5. **布局栅格**：报表使用 **6 列栅格系统**（w=6 表示占满整行），代码会根据图表类型自动分配最佳默认布局，无需手动指定 `w`/`h`：

   | 图表类型 | 默认宽度 `w` | 默认高度 `h` | 布局效果 |
   |---------|-------------|-------------|---------|
   | **indicator** (指标卡) | 6 | 6 | 占满整行，紧凑醒目 |
   | **pie** (饼图) | 3 | 22 | 半行，与其他图表并排 |
   | **bar** (柱状图) | 3 | 22 | 半行，与饼图并排 |
   | **line** (折线图) | 3 | 22 | 半行，可与其他图表并排 |
   | **combo** (组合图) | 6 | 22 | 占满整行 |
   | **table** (表格) | 6 | 38 | 占满整行，更高以显示更多数据 |
   | **pivot** (透视表) | 6 | 30 | 占满整行 |
   | **gauge** (仪表盘) | 2 | 18 | 1/3 行，可三个并排 |

   > 用户可通过 `chart.w` / `chart.h` 覆盖默认值。推荐布局顺序：**指标卡在上 → 图表居中（饼图+柱状图并排）→ 明细表格在下**
6. **登录态**：命令自动读取 `.cache/cookies.json`，失效时自动触发重新登录
7. **DEBUG 输出**：`create-report` 会将完整 Schema 写入 `.cache/debug-full-schema.json`，便于调试
8. **数值聚合**：SUM/AVG 等聚合必须使用 `NumberField`，`TextField` 无法进行数值聚合

---

## 常见问题

**Q：如何获取表单的 cubeCode？**
`cubeCode` 就是表单的 `formUuid`（连字符替换为下划线），通过 `openyida get-schema <appType> <formUuid>` 可以确认。

**Q：如何获取字段的 fieldCode？**
使用 `openyida get-schema <appType> <formUuid>` 获取表单 Schema，从中读取各字段的 `fieldId` 作为 `fieldCode`。

**Q：追加图表后位置不对？**
`append-chart` 自动计算现有图表的最大 Y 位置，新图表从下方开始排列。如需调整位置，可在宜搭报表编辑器中手动拖拽。

**Q：筛选器不生效？**
检查筛选器的 `cubeCode` 和 `valueField.fieldCode` 是否与图表的数据源一致，且 `linkTo` 指向了正确的图表索引。

**Q：SUM 聚合返回 0？**
- 检查字段是否为 `NumberField` 类型
- `TextField` 无法进行数值聚合，必须改为 `NumberField`
- 改字段类型后旧数据会丢失，需要重新写入
