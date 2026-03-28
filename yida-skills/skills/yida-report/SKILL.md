---
name: yida-report
description: 宜搭报表创建。支持 9 种图表类型（柱状图/折线图/饼图/漏斗图/仪表盘/柱线混合/表格/指标卡/透视表），支持筛选器联动。
---

# 报表创建

## 命令

```bash
openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `报表名称` | 是 | 报表标题 |
| `图表定义` | 是 | 图表定义 JSON 字符串或文件路径 |

## 输出

```json
{"success":true,"reportId":"FORM-XXX","reportTitle":"销售报表","appType":"APP_XXX","chartCount":3,"url":"{base_url}/APP_XXX/workbench/FORM-XXX"}
```

## 图表类型

| type | 说明 | 组件名 |
|------|------|--------|
| `bar` | 柱状图（分组） | YoushuGroupedBarChart |
| `line` | 折线图 | YoushuLineChart |
| `pie` | 饼图 | YoushuPieChart |
| `funnel` | 漏斗图 | YoushuFunnelChart |
| `gauge` | 仪表盘 | YoushuGauge |
| `combo` | 柱线混合图 | YoushuComboChart |
| `table` | 基础表格 | YoushuTable |
| `indicator` | 指标卡 | YoushuSimpleIndicatorCard |
| `pivot` | 交叉透视表 | YoushuCrossPivotTable |

## 图表定义格式

### 格式 1：纯图表数组

```json
[
  { "type": "bar", "title": "月度销售额", "cubeCode": "FORM_XXX" },
  { "type": "pie", "title": "部门占比", "cubeCode": "FORM_XXX" },
  { "type": "indicator", "title": "总销售额", "cubeCode": "FORM_XXX" }
]
```

### 格式 2：带筛选器的完整配置

```json
{
  "filters": [
    {
      "title": "竞赛项目",
      "placeholder": "请选择竞赛项目",
      "cubeCode": "FORM_XXX",
      "valueField": { "fieldCode": "selectField_xxx_value", "aliasName": "竞赛项目_值", "dataType": "STRING" },
      "labelField": { "fieldCode": "selectField_xxx_code", "aliasName": "竞赛项目_ID", "dataType": "STRING" },
      "linkTo": [0, 1]
    }
  ],
  "charts": [
    { "type": "bar", "title": "得分统计", "cubeCode": "FORM_XXX" },
    { "type": "line", "title": "趋势分析", "cubeCode": "FORM_XXX" }
  ]
}
```

### 筛选器属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | String | 是 | 筛选器标题 |
| `cubeCode` | String | 是 | 数据源表单 UUID |
| `valueField` | Object | 是 | 值字段（`fieldCode` + `aliasName` + `dataType`） |
| `labelField` | Object | 是 | 显示字段 |
| `linkTo` | Array | 否 | 联动目标图表（index 或 title），不传则联动所有 |
| `placeholder` | String | 否 | 占位提示 |

## 注意事项

- `cubeCode` 通常等于表单的 `formUuid`（如 `FORM_XXX`）
- 图表创建后需在宜搭管理后台配置具体的维度和度量字段
- 筛选器的 `fieldCode` 需通过 `openyida get-schema` 获取
