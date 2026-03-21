# 宜搭原生报表 + ECharts 自定义看板 技能文档

## 概述

本技能记录了通过宜搭原生报表（YoushuTable）的聚合数据驱动 ECharts 图表看板的完整实践经验，包含 API 调用方式、数据解析、踩坑记录和最佳实践。

---

## 核心架构

```
宜搭表单（数据源）
    ↓ 数据写入
宜搭原生报表（服务端聚合）
    ↓ 报表 API
ECharts 自定义页面（前端渲染）
```

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

### 请求示例

```javascript
var requestBody = {
  pageName: "report",
  prdId: "13085982",
  cid: "YoushuTable_mmx9ha6ar",
  cname: "按状态统计",
  className: "YoushuTable",
  dataSetKey: "table",
};

this.utils.yida.request({
  url: "/alibaba/web/" + APP_TYPE + "/visual/visualizationDataRpc/getDataAsync.json",
  method: "POST",
  data: requestBody,
});
```

### 返回数据结构

```json
{
  "content": {
    "data": [
      ["进行中", 8],
      ["已完成", 5],
      ["规划中", 4],
      ["已延期", 2],
      ["已取消", 1]
    ],
    "meta": [
      {
        "alias": "项目状态",
        "dataType": "STRING",
        "type": "DIMENSION"
      },
      {
        "alias": "项目数量",
        "dataType": "LONG",
        "type": "MEASURE"
      }
    ]
  }
}
```

### 数据解析方法

```javascript
function parseTableData(responseData) {
  var dataArray = responseData.data || [];
  var metaArray = responseData.meta || [];

  // 从 meta 中识别维度字段和度量字段
  var dimensionIndex = -1;
  var measureIndex = -1;
  var dimensionAlias = "";
  var measureAlias = "";

  metaArray.forEach(function(m, i) {
    if (m.type === "DIMENSION") {
      dimensionIndex = i;
      dimensionAlias = m.alias;
    } else if (m.type === "MEASURE") {
      measureIndex = i;
      measureAlias = m.alias;
    }
  });

  // 如果 meta 没有 type 字段，按顺序推断：第一个是维度，第二个是度量
  if (dimensionIndex === -1 && metaArray.length >= 2) {
    dimensionIndex = 0;
    measureIndex = 1;
    dimensionAlias = metaArray[0].alias;
    measureAlias = metaArray[1].alias;
  }

  return dataArray.map(function(row) {
    return {
      name: String(row[dimensionIndex] || ""),
      value: parseFloat(row[measureIndex]) || 0,
    };
  });
}
```

---

## 报表组件类型

### YoushuSimpleIndicatorCard（指标卡）

- **用途**：显示单个聚合数值（如项目总数、总预算）
- **dataSetKey**：`"youshuData"`
- **返回格式**：`{ content: { data: [[42]], meta: [...] } }`
- **取值方式**：`data[0][0]`

### YoushuTable（统计表格）

- **用途**：按维度分组统计（如按状态统计项目数）
- **dataSetKey**：`"table"`
- **返回格式**：`{ content: { data: [["进行中", 8], ["已完成", 5]], meta: [...] } }`
- **取值方式**：遍历 `data` 数组，每行 `[维度值, 度量值]`

---

## 🔥 踩坑记录

### 坑 1：数值聚合必须使用 NumberField

**现象**：报表对"项目预算"字段做 SUM 聚合时返回 0 或报错。

**原因**：预算字段使用了 `TextField`（文本组件），文本类型无法进行数值聚合（SUM、AVG 等）。

**解决**：将字段类型从 `TextField` 改为 `NumberField`。

```bash
# 更新表单字段类型
openyida create-form update <appType> <formUuid> '[
  {"action":"delete","fieldId":"textField_j2xeja4e"},
  {"action":"add","field":{"type":"NumberField","label":"项目预算","placeholder":"请输入预算金额"}}
]'
```

**⚠️ 注意**：改字段类型后，旧数据中该字段的值会丢失，需要重新写入。

### 坑 2：报表 API 路径

**错误路径**：
```
❌ /yida-report/data/queryReportData.json
❌ /alibaba/web/{appType}/query/reportData.json
```

**正确路径**：
```
✅ /alibaba/web/{appType}/visual/visualizationDataRpc/getDataAsync.json
```

### 坑 3：prdId 获取方式

**prdId 不是 formUuid**，而是报表页面 URL 中的数字 ID。

获取方式：
1. 在浏览器中打开报表页面
2. 打开开发者工具 → Network
3. 搜索 `getDataAsync` 请求
4. 在请求参数中找到 `prdId` 值

### 坑 4：组件 ID（cid）获取方式

每个报表组件都有唯一的 `cid`，格式为 `{组件类名}_{随机字符串}`。

获取方式：同上，在 Network 中查看 `getDataAsync` 请求的参数。

### 坑 5：dataSetKey 区分

| 组件类型 | dataSetKey |
|---------|-----------|
| `YoushuSimpleIndicatorCard`（指标卡） | `"youshuData"` |
| `YoushuTable`（统计表格） | `"table"` |

**用错 dataSetKey 会导致返回空数据。**

### 坑 6：searchFormDatas 没有 HTTP API

`searchFormDatas` 是宜搭前端 JS SDK 的接口（`this.utils.yida.searchFormDatas`），**不能**通过 HTTP 直接调用。

```
❌ POST /dingtalk/web/{appType}/query/punchFormDataProvider/searchFormDatas.json → 404
❌ POST /dingtalk/web/{appType}/v1/form/searchFormDatas.json → 超时
```

但 `saveFormData` 可以通过 HTTP 调用：
```
✅ POST /dingtalk/web/{appType}/query/punchFormDataProvider/saveFormData.json
```

### 坑 7：cookies.json 格式

openyida 的 `.cache/cookies.json` 中，cookies 是**数组**格式，不是字符串：

```json
{
  "cookies": [
    {"name": "cna", "value": "xxx", "domain": ".aliwork.com", "path": "/"},
    {"name": "tianshu_csrf_token", "value": "xxx", "domain": ".aliwork.com", "path": "/"}
  ],
  "base_url": "https://www.aliwork.com"
}
```

使用时需要拼接：
```javascript
var cookieStr = cookies.map(ck => ck.name + '=' + ck.value).join('; ');
```

### 坑 8：不要用 fallback 逻辑

**反模式**：报表 API 失败时回退到 `searchFormDatas` 前端聚合。

**问题**：`searchFormDatas` 的 pageSize 最大 100，数据量超过 100 条时聚合结果不准确，用户看到错误数据比看到错误提示更糟糕。

**正确做法**：报表 API 失败时直接显示错误信息，方便排查问题。

---

## 完整开发流程

### Step 1：创建数据源表单

确保需要聚合的字段使用正确的组件类型：

| 聚合类型 | 必须使用的组件 | 不能使用的组件 |
|---------|-------------|-------------|
| SUM / AVG | `NumberField` | ❌ `TextField` |
| COUNT | 任意组件 | — |
| COUNT_DISTINCT | 任意组件 | — |
| MIN / MAX | `NumberField` / `DateField` | ❌ `TextField` |

### Step 2：创建原生报表

```bash
openyida create-report <appType> <formUuid> <报表配置JSON>
```

报表配置中定义需要的统计组件（指标卡、统计表格等）。

### Step 3：获取报表参数

- `prdId`：通过 `getFormSchema.json` 接口动态获取（`content.topicId`），或从浏览器 Network 中手动获取
- 各组件的 `cid`、`cname`、`className`、`dataSetKey`：从报表 Schema 中提取

### Step 4：编写 ECharts 自定义页面

```javascript
// 1. 定义报表组件配置
var REPORT_COMPONENTS = {
  totalCount: {
    cid: "YoushuSimpleIndicatorCard_xxx",
    cname: "项目总数",
    className: "YoushuSimpleIndicatorCard",
    dataSetKey: "youshuData",
  },
  statusTable: {
    cid: "YoushuTable_xxx",
    cname: "按状态统计",
    className: "YoushuTable",
    dataSetKey: "table",
  },
};

// 2. 调用报表 API
function fetchReportData(component) {
  return this.utils.yida.request({
    url: "/alibaba/web/" + APP_TYPE + "/visual/visualizationDataRpc/getDataAsync.json",
    method: "POST",
    data: {
      pageName: "report",
      prdId: PRD_ID,
      cid: component.cid,
      cname: component.cname,
      className: component.className,
      dataSetKey: component.dataSetKey,
    },
  });
}

// 3. 解析数据并渲染 ECharts
```

### Step 5：发布

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

---

## 表单数据批量写入（HTTP API）

通过 openyida 的 `lib/utils.js` 中的 `httpPost` 方法批量写入数据：

```javascript
const { httpPost } = require('lib/utils.js');
const querystring = require('querystring');

const postData = querystring.stringify({
  _csrf_token: csrfToken,
  formUuid: FORM_UUID,
  formDataJson: JSON.stringify({
    textField_xxx: '项目名称',
    numberField_xxx: 280,
    selectField_xxx: '进行中',
  }),
});

await httpPost(baseUrl, `/dingtalk/web/${APP_TYPE}/query/punchFormDataProvider/saveFormData.json`, postData, cookies);
```

**注意**：`cookies` 参数是数组格式 `[{name, value, domain, path}]`，`httpPost` 内部会自动拼接。

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

---

## 常见问题

**Q：报表 API 返回空数据？**
- 检查 `prdId` 是否正确
- 检查 `cid` 是否与报表中的组件匹配
- 检查 `dataSetKey` 是否正确（指标卡用 `youshuData`，表格用 `table`）

**Q：SUM 聚合返回 0？**
- 检查字段是否为 `NumberField` 类型
- `TextField` 无法进行数值聚合，必须改为 `NumberField`
- 改字段类型后旧数据会丢失，需要重新写入

**Q：如何调试报表 API？**
1. 在浏览器中打开报表页面
2. 打开 DevTools → Network → 搜索 `getDataAsync`
3. 查看请求参数和返回数据
4. 将参数复制到自定义页面代码中

**Q：ECharts 图表不显示？**
- 确认 ECharts CDN 加载成功：`https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js`
- 确认 DOM 元素已渲染后再调用 `echarts.init()`
- 使用 `setTimeout` 延迟初始化图表

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
      isDim: true,                    // true=维度，false=度量
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
        buildFieldDefinition({ alias: 'date', aliasName: '日期', isDim: true, dataType: 'DATE', timeGranularityType: 'DAY' }),
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
        buildFieldDefinition({ alias: 'category', aliasName: '类别', isDim: true, dataType: 'STRING' }),
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
        buildFieldDefinition({ alias: 'name', aliasName: '姓名', isDim: true, dataType: 'STRING' }),
        buildFieldDefinition({ alias: 'dept', aliasName: '部门', isDim: true, dataType: 'STRING' }),
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

## 报表 Schema 构建关键规则（chart-builder.js）

### 命令调用格式

```bash
openyida create-report <appType> "<报表名称>" <配置JSON文件路径>
```

**⚠️ 第二个参数是报表名称，必须使用业务含义的中文名称**（如"任务管理数据报表"），不要传 formUuid。

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
        "fieldCode": "selectField_xxx_value",
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
| `bar`/`line`/`area` | `xField`（单个）+ `yField`（数组） | 可选 `groupField` 分组 |
| `table` | `columnFields`（数组） | 每列一个字段对象 |
| `combo` | `xField` + `leftYFields` + `rightYFields` | 柱线混合图 |
| `gauge` | `valueField`（单个） | 可选 `assitValueField` |
| `pivot` | `columnList`（数组） | 交叉透视表 |

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
