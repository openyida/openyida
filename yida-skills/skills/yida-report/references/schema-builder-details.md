# 报表 Schema 构建细节

> 从 yida-report 主技能迁出。只有需要理解底层 schema 结构、组件示例或 settings 字段时读取；普通创建报表优先使用 `openyida create-report` 的结构化配置。

> CLI runtime registry 当前只开放 `bar`、`combo`、`funnel`、`gauge`、`indicator`、`line`、`pie`、`pivot`、`table`。本文中的底层组件库示例不等于 CLI 能力声明；未列入 registry 的组件必须先完成 platform/runtime probe，当前一律 fail-closed。

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
      timeGranularityType: 'DAY',    // YEAR | MONTH | DAY | HOUR | MINUTE | SECOND | null
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


## 新版主题的页面与图表外观

先读取目标应用的主题设置，确认 `newThemeStyle` 是否启用。下列设计器入口用于新版主题；旧主题保留原有配置位置和编辑方式。OpenYida 负责生成和保存原生资源，编辑器控件由平台提供，需要在目标环境确认组件版本。

### 设计器入口

- 页面属性的「样式」中，「默认风格」切换「跟随主题 / 自定义」。切换到自定义后，第一行为「页面样式 / 编辑 CSS」。表单和门户页面沿用相同入口。
- 图表的「样式」页最后一组为「图表卡片样式」。「默认风格」切换到自定义后，仅展示「卡片样式 / 编辑 CSS」；图表颜色、点大小、线宽、轴标签和图例字号等其余外观项隐藏。常用配置、坐标轴等功能设置继续使用原有入口。隐藏不会删除已保存的值。
- 「编辑 CSS」使用 CSS 模式，`:root` 指代当前页面或当前图表卡片。卡片外框、背景、边距和标题等 DOM 样式可按实际结构配置。Canvas 内的点形状、曲线等由图表设置控制，不能以卡片 CSS 替代图表引擎参数。

### 保存协议与兼容

- 页面沿用根组件 `props.containerStyle`；图表卡片沿用根 `props.__style__`。不要改写为 `settings.__style__`，也不要把 CSS 拼入返回数据处理代码。
- 页面默认风格保存在 `props.themeAppearanceMode`（`theme` / `custom`），图表默认风格保存在 `props.settings.customChartStyle`（`theme` / `custom`）。迁移已有页面时保留缺省模式及原配置，不批量补写模式或用当前主题值覆盖用户自定义。
- 主题变量可能解析为渐变、透明色或变量引用。不要按逗号拆分 `rgb()` 或渐变，也不要把渐变当单一 HEX 色写入只支持纯色的字段。保持主题引用；确需自定义时使用目标控件支持的类型，不支持的值采用有效回退。
- CSS 清空需要覆盖旧样式时，使用有效空规则 `:root {}`，避免旧渲染器跳过空字符串后残留此前声明。非法颜色、非有限数字及不支持的模式不得强行保存；遇到编辑器错误先保留原值，核对实际控件支持范围。
- 当前 `create-report` 和 `report configure` 不提供上述外观字段的独立 CLI 参数；不要编造 `--css` 或外观配置命令。需要修改已有报表外观时使用目标设计器，保存后以 `report inspect` 回读实际 Schema，并核对工作台渲染。CLI 回读成功不代表浏览器样式验收通过。

### 门户消费数据卡片

新版主题下，门户 DataCard 外层负责卡片外框；内嵌报表卡片默认不再叠加同一套背景、边框、圆角和内边距。保留数据卡片自身明确配置的 CSS，验收桌面和移动端时核对单层边框及标题、内容间距。不要为了修复门户双框而删除独立数据卡片的样式。
