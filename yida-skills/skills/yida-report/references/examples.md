# yida-report 使用示例

## 示例 1：创建任务管理数据报表

### 场景

为"任务管理"表单创建一个包含指标卡、柱状图和明细表格的原生报表。

### 前置步骤：获取表单 Schema

```bash
openyida get-schema APP_XXX FORM-TASK
# 从 stdout 中提取字段信息，并用结构化文件写入工具更新 <projectRoot>/.cache/<项目名>-schema.json：
# 任务名称：textField_taskName（STRING）
# 优先级：selectField_priority（STRING；raw/_value 候选由运行时探针确认）
# 状态：selectField_status（STRING；raw/_value 候选由运行时探针确认）
# 完成时间：dateField_finishDate（DATE）
# 负责人：employeeField_owner（STRING；raw/_value 候选由运行时探针确认）
```

### 使用结构化文件写入工具创建报表配置文件 `<projectRoot>/.cache/openyida/task-report/task-report-config.json`

```json
{
  "reportName": "任务管理数据报表",
  "formUuid": "FORM-TASK",
  "charts": [
    {
      "title": "任务总数",
      "type": "indicator",
      "cubeCode": "FORM_TASK",
      "kpi": [
        {
          "fieldCode": "pid",
          "aliasName": "任务总数",
          "dataType": "STRING",
          "aggregateType": "COUNT"
        }
      ]
    },
    {
      "title": "按优先级分布",
      "type": "pie",
      "cubeCode": "FORM_TASK",
      "xField": {
        "fieldCode": "selectField_priority",
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
    },
    {
      "title": "按状态统计",
      "type": "bar",
      "cubeCode": "FORM_TASK",
      "xField": {
        "fieldCode": "selectField_status",
        "aliasName": "状态",
        "dataType": "STRING",
        "aggregateType": "NONE"
      },
      "yField": [
        {
          "fieldCode": "pid",
          "aliasName": "任务数",
          "dataType": "STRING",
          "aggregateType": "COUNT"
        }
      ]
    },
    {
      "title": "任务明细",
      "type": "table",
      "cubeCode": "FORM_TASK",
      "columnFields": [
        { "fieldCode": "textField_taskName", "aliasName": "任务名称", "dataType": "STRING", "aggregateType": "NONE" },
        { "fieldCode": "selectField_priority", "aliasName": "优先级", "dataType": "STRING", "aggregateType": "NONE" },
        { "fieldCode": "selectField_status", "aliasName": "状态", "dataType": "STRING", "aggregateType": "NONE" },
        { "fieldCode": "employeeField_owner", "aliasName": "负责人", "dataType": "STRING", "aggregateType": "NONE" },
        { "fieldCode": "dateField_finishDate", "aliasName": "完成时间", "dataType": "DATE", "aggregateType": "NONE" }
      ]
    }
  ]
}
```

### 执行命令

```bash
openyida create-report APP_XXX "任务管理数据报表" .cache/openyida/task-report/task-report-config.json --json

# 创建/追加后只读回读真实绑定；不要从示例猜 cid/dataSetKey/filterKey/prdId/pageId
openyida report inspect APP_XXX REPORT_XXX --json
```

### 输出

```json
{
  "success": true,
  "reportUrl": "https://www.aliwork.com/APP_XXX/admin/REPORT-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "formUuid": "REPORT-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "appType": "APP_XXX"
}
```

---

## 示例 2：fieldCode 运行时确认

表单 Schema 只提供 raw fieldId 以及可能的 `_value` 候选。以 `create-report` / `report inspect` 的逐图表 `queryProbe` 为最终依据，不手工固定后缀规则。

---

## 示例 3：cubeCode 格式转换

```
formUuid:  FORM-AB4ACB9DD12C470D82047E05CDC19166CJSU
cubeCode:  FORM_AB4ACB9DD12C470D82047E05CDC19166CJSU
```

规则：将 `formUuid` 中的连字符 `-` 替换为下划线 `_`，即为 `cubeCode`。

---

## 常见错误

| 错误 | 原因 | 解决方式 |
|------|------|---------|
| 图表显示为空 | `dataSetModelMap` 两层字段定义不完整 | 确保 `dataViewQueryModel.fieldDefinitionList` 和外层字段数组都正确填充 |
| 图表提示 metadata missing | fieldCode 与 cube 实际元数据不一致 | 检查 `queryProbe`；只修复既有 reportId，不重新创建 |
| 报表名称错误 | 第二个参数传了 formUuid | 第二个参数必须是业务含义的中文名称，如"任务管理数据报表" |
| 命令执行失败 | 登录态过期 | 执行 `openyida env` 检查登录态，重新登录后重试 |
