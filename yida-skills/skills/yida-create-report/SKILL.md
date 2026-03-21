---
name: yida-create-report
description: 宜搭报表创建与图表追加技能，支持创建报表页面（create-report）和向已有报表追加图表（append-chart），支持 9 种图表类型（柱状图/折线图/饼图/漏斗图/仪表盘/柱线混合/表格/指标卡/交叉透视表）和筛选器联动。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - low-code
    - report
    - chart
    - dashboard
---

# 宜搭报表创建与图表追加技能

## 概述

本技能描述如何通过 `openyida` 命令行工具**创建报表页面**和**向已有报表追加图表**。支持两个命令：

- **`create-report`**：创建新报表页面，定义图表列表、数据源、筛选器联动等。先创建空白报表获取 reportId，再构建并保存报表 Schema。
- **`append-chart`**：向已有报表追加图表，自动计算布局位置，追加到现有图表下方。

## 何时使用

当以下场景发生时使用此技能：
- 用户需要创建数据分析报表/仪表盘
- 用户需要在报表中添加柱状图、折线图、饼图等图表
- 用户需要向已有报表追加新图表
- 用户需要配置报表筛选器联动
- 已通过 `yida-create-app` 创建应用后，需要创建报表来展示数据

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

## 注意事项

1. **cubeCode 必须正确**：`cubeCode` 是数据源表单的 formUuid，格式如 `FORM_XXX`，必须是已存在的表单
2. **字段 fieldCode 必须存在**：`xField` 和 `yField` 中的 `fieldCode` 必须是数据源表单中实际存在的字段 ID，可通过 `openyida get-schema` 获取
3. **筛选器联动**：筛选器的 `linkTo` 指定联动的图表索引或标题，不指定则默认联动所有图表
4. **布局栅格**：报表使用 12 列栅格系统，每个图表默认宽度 6（半行），高度 22
5. **登录态**：命令自动读取 `.cache/cookies.json`，失效时自动触发重新登录
6. **DEBUG 输出**：`create-report` 会将完整 Schema 写入 `.cache/debug-full-schema.json`，便于调试

---

## 常见问题

**Q：如何获取表单的 cubeCode？**
`cubeCode` 就是表单的 `formUuid`，通过 `openyida get-schema <appType> <formUuid>` 可以确认。

**Q：如何获取字段的 fieldCode？**
使用 `openyida get-schema <appType> <formUuid>` 获取表单 Schema，从中读取各字段的 `fieldId` 作为 `fieldCode`。

**Q：追加图表后位置不对？**
`append-chart` 自动计算现有图表的最大 Y 位置，新图表从下方开始排列。如需调整位置，可在宜搭报表编辑器中手动拖拽。

**Q：筛选器不生效？**
检查筛选器的 `cubeCode` 和 `valueField.fieldCode` 是否与图表的数据源一致，且 `linkTo` 指向了正确的图表索引。
