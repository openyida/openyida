# Data Format Guide

## 基础规则

- `searchFieldJson` 传字符串，不直接传对象
- `formDataJson` 传字符串，不直接传对象
- `updateFormDataJson` 传字符串，不直接传对象
- `dynamicOrder` 传字符串，不直接传对象

## 查询条件格式

```json
[
  {
    "key": "字段ID",
    "value": "搜索值",
    "type": "字段类型",
    "operator": "操作符",
    "componentName": "组件名称"
  }
]
```

示例：

```bash
--search-json '[{"key":"textField_xxx","value":"测试","type":"TEXT","operator":"eq","componentName":"TextField"}]'
```

## 保存 / 更新格式

```json
{
  "textField_xxx": "文本",
  "numberField_xxx": 10,
  "employeeField_xxx": ["2212173665758008"]
}
```

更新时只传要修改的字段：

```json
{
  "textField_xxx": "更新后的值"
}
```

## 排序格式

```json
{"numberField_1ac":"+"}
```

## 常见字段值格式

| 组件类型 | 查询格式 | 保存 / 更新格式 |
| --- | --- | --- |
| 单行 / 多行文本 | `"文本"` | `"文本"` |
| 数字 | `["1","10"]` 或单值 | `1` |
| 单选 | `"选项一"` | `"选项一"` |
| 多选 | `["选项一"]` | `["选项一","选项二"]` |
| 日期 | `[开始时间戳,结束时间戳]` | `时间戳` |
| 成员 | `["userId"]` | `["userId"]` |
| 部门 | `1123456` 或 `["1123456"]` | `["1123456"]` |
| 城市 | `[省ID,市ID,区ID]` | `[省ID,市ID,区ID]` |
| 子表单 | `"模糊搜索文本"` | `[{"textField_xxx":"值"}]` |

## 实现建议

- 统一把 CLI 传入的 JSON 参数当作字符串接收
- 在发送请求前再做 `json.dumps(...)` 或直接透传字符串
- `currentPage` 从 `1` 开始
- `pageSize` 建议不超过 `100`
