# 高级表单模式：patch / rule / bind-datasource

## patch 模式（设计器 Schema 补丁）

当宜搭后台已有配置项，但 OpenYida 还没有高阶 DSL 时，使用 patch 模式对表单 V5 Schema 做受控修改：

```bash
openyida create-form patch <appType> <formUuid> <patchJsonOrFile>
# 文件路径示例：.cache/openyida/<项目名或任务名>/<表单名>-patch.json
```

执行前必须先 `openyida get-schema <appType> <formUuid> --json` 确认现有结构，补丁文件必须用结构化文件写入工具写在 `<projectRoot>/.cache/openyida/<项目名或任务名>/` 下。

| 操作 | 说明 |
|------|------|
| `field-props` | 按 `fieldId` / `field` / `label` 合并字段 `props`，适合补字段状态、提交策略、设计器属性 |
| `form-props` | 合并 `FormContainer.props` |
| `add` / `replace` / `remove` | JSON Pointer 形式的底层 Schema Patch |
| `merge` | 对指定 JSON Pointer 路径做对象深合并 |
| `actions-module` | 写入页面动作模块 `source` / `compiled`，`source` 会自动编译 |
| `bind-field-action` | 给字段事件（如 `onChange`）绑定动作引用 |
| `bind-datasource` | 给选项类字段绑定远程搜索数据源（高阶入口优先用 bind-datasource 模式） |

隐藏但仍提交字段：

```json
[
  {
    "action": "field-props",
    "fieldId": "textField_xxx",
    "props": { "behavior": "HIDDEN", "submittable": "ALWAYS" }
  }
]
```

## 自定义校验函数（customValidate）

通过 patch 模式的 `field-props` 给字段绑定自定义校验函数。推荐把完整逻辑写在字段 `validation` 中，避免不必要的 JS 面板桥接。

```json
[
  {
    "action": "field-props",
    "fieldId": "numberField_xxx",
    "props": {
      "validation": [
        {
          "type": "customValidate",
          "param": {
            "source": "function validateRule(value) {\n  var values = (this.item && this.item.values) || {};\n  var stock = Number(values.numberField_yyy) || 0;\n  return Number(value) <= stock;\n}",
            "type": "js",
            "error": {}
          },
          "message": { "zh_CN": "领用数量不能超过当前库存", "en_US": "Quantity cannot exceed current stock", "type": "i18n" }
        }
      ]
    }
  }
]
```

关键规则：

- `param` 必须是 `{ source, type: "js", error: {} }`，不能用 `{ actionType, actionName }` 或 `{ type: "JSExpression" }`
- `source` 中的函数名必须是 `validateRule`
- 函数返回 `true` 表示校验通过，`false` 表示校验失败
- 子表内字段通过 `this.item.values` 获取同行其他字段的值

如必须桥接 JS 面板函数，先用 `actions-module` 写入函数，再在字段自定义函数里通过 `this.xxx()` 调用。

## rule 模式（字段联动与自动赋值）

常见字段联动不要直接写底层 Schema Patch，优先使用 rule 模式：

```bash
openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>
# 文件路径示例：.cache/openyida/<项目名或任务名>/<表单名>-rules.json
```

| 类型 | 说明 |
|------|------|
| `visibility` / `show-hide` | 根据字段值动态设置目标字段 `NORMAL` / `HIDDEN` / `READONLY` |
| `set-value` / `assign` | 在字段 `onChange` 时给目标字段赋固定值、复制字段值、模板值或 JS 表达式结果 |

显示隐藏：

```json
[
  {
    "type": "visibility",
    "when": { "field": "部门", "operator": "eq", "value": "技术部" },
    "target": "预算说明",
    "behavior": "NORMAL",
    "elseBehavior": "HIDDEN"
  }
]
```

自动赋值：

```json
[
  {
    "type": "set-value",
    "on": "状态",
    "target": "处理说明",
    "template": "当前状态：{{状态}}"
  }
]
```

JS 表达式计算目标值，表达式可使用 `value`（触发字段值）和 `fields`（按字段名/fieldId 映射的当前表单值）：

```json
[
  {
    "type": "set-value",
    "on": "数量",
    "target": "金额",
    "expression": "Number(value || 0) * Number(fields['单价'] || 0)"
  }
]
```

rule 模式会自动生成宜搭动作代码，绑定触发字段的 `onChange`，并在页面加载/表单数据初始化后执行一次规则。若字段已有 `onChange` 动作，OpenYida 会先调用原动作，再执行生成的规则。

## bind-datasource 模式（选项字段远程搜索数据源）

当 `SelectField` / `MultiSelectField` / `RadioField` / `CheckboxField` 不是固定选项，而是需要从接口、连接器代理或宜搭内部接口搜索加载时，使用 bind-datasource 模式：

```bash
openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>
# 文件路径示例：.cache/openyida/<项目名或任务名>/<字段名>-datasource.json
```

数据源配置示例：

```json
{
  "url": "/query/deptService/searchDepts.json",
  "dataType": "json",
  "queryParam": "key",
  "listPath": "values",
  "labelField": "name",
  "valueField": "deptId",
  "notFoundContent": "无匹配数据"
}
```

复杂返回结构可提供宜搭运行时 `beforeFetch` / `afterFetch` 函数源码：

```json
{
  "url": "https://example.com/api/customers",
  "dataType": "json",
  "beforeFetch": "function willFetch(params) { params.keyword = params.key || ''; return params; }",
  "afterFetch": "function didFetch(content) { return (content.data || []).map(function(item) { return { text: item.name, value: item.id }; }); }"
}
```

创建字段时也可直接在字段定义里写 `remoteDataSource`：

```json
[
  {
    "type": "SelectField",
    "label": "客户",
    "remoteDataSource": {
      "url": "https://example.com/api/customers",
      "listPath": "data",
      "labelField": "name",
      "valueField": "id"
    }
  }
]
```

说明：bind-datasource 负责写入字段的 `searchConfig`、`defaultDataSource.searchConfig`、`filterLocal=false` 和初始选项；如果要绑定宜搭连接器动作，请先用 `yida-connector` 创建连接器/动作，再把平台可访问的代理 URL 或设计器抓取到的原始配置放入该 JSON。
