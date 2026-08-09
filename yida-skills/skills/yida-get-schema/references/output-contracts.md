# get-schema 输出 contract

## compact 输出

```json
{
  "kind": "yida_schema_field_resolution",
  "contractVersion": 1,
  "resource": {
    "appType": "APP_XXX",
    "formUuid": "FORM-XXX",
    "schemaHash": "sha256:<64位小写十六进制>"
  },
  "fields": [
    {
      "query": "订单明细/商品名称",
      "label": "商品名称",
      "fieldId": "textField_xxx",
      "componentType": "TextField",
      "valueType": "custom",
      "path": ["tableField_xxx", "textField_xxx"],
      "labelPath": ["订单明细", "商品名称"],
      "parentFieldId": "tableField_xxx",
      "alias": ""
    }
  ],
  "missingFields": [],
  "ambiguousFields": []
}
```

`--compact` 不带 `--resolve-fields` 时按 Schema 顺序返回全部正规化字段。带 `--resolve-fields` 时只返回唯一命中项；未命中和重名分别进入 `missingFields`、`ambiguousFields`。

## 字段摘要输出

```json
{
  "success": true,
  "appType": "APP_XXX",
  "formUuid": "FORM-XXX",
  "fieldCount": 2,
  "fields": [
    {
      "label": "访客姓名",
      "componentName": "TextField",
      "fieldId": "textField_xxx",
      "alias": "visitorName",
      "reportFieldCode": "textField_xxx",
      "options": [],
      "optionCount": 0,
      "optionsTruncated": false
    }
  ]
}
```

`--summary-json` 与 `--field-map-json` 都输出字段摘要，不把完整 Schema 放入 stdout。

## 完整和批量输出

单表不带 compact 或 summary 参数时，stdout 包含完整 Schema，包括 `pages`、`componentsMap` 等结构。

批量模式先读取应用导航中的表单和页面，再逐个请求 Schema。指定 `--output-dir` 后：

- 每个成功的 Schema 写入 `<表单名>-<formUuid>.json`。
- `index.json` 记录 `formUuid`、名称、类型、字段摘要、失败原因和文件路径。
- stdout 输出汇总 JSON。
- 加 `--summary-json` 时，stdout 和 `index.json` 不内联完整 Schema。
