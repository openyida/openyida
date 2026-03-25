---
name: yida-process-rule
description: 宜搭流程规则配置。支持审批节点、条件分支、嵌套分支、字段权限、抄送节点、跳转规则。
---

# 流程规则配置

## 命令

```bash
openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `formUuid` | 是 | 表单 UUID |
| `processDefinitionFile` | 是 | 流程定义 JSON 文件路径 |
| `processCode` | 否 | 流程 Code，不传则自动获取 |

## 输出

```json
{"success":true,"processCode":"TPROC--XXX","processId":"83145794990","processVersion":2,"appType":"APP_XXX","formUuid":"FORM-YYY"}
```

## 流程定义 JSON 格式

### 节点类型

| 类型 | 说明 | 必填属性 |
|------|------|----------|
| `approval` | 审批节点 | `name`, `approver` |
| `route` | 条件分支 | `conditions` |
| `carbon` | 抄送节点 | `name`, `approver` |

### 审批节点

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | String | 是 | `"approval"` |
| `name` | String | 是 | 节点名称 |
| `approver` | String | 是 | 审批人，支持 `"originator"` |
| `description` | String | 否 | 节点描述 |
| `formConfig` | Object | 否 | 字段权限配置 |
| `routeRules` | Array | 否 | 跳转规则 |

### 条件分支

```json
{
  "type": "route",
  "conditions": [
    {
      "name": "金额大于1000",
      "logic": "AND",
      "rules": [{ "fieldId": "numberField_xxx", "fieldName": "金额", "op": "GreaterThan", "value": "1000", "componentType": "NumberField" }],
      "childNodes": [{ "type": "approval", "name": "财务审批", "approver": "originator" }]
    }
  ]
}
```

### 支持的操作符

| 操作符 | 说明 | 适用类型 |
|--------|------|----------|
| `Equal` | 等于 | 所有 |
| `NotEqual` | 不等于 | 所有 |
| `Contains` | 包含 | TextField |
| `NotContain` | 不包含 | TextField |
| `IsEmpty` | 为空 | 所有 |
| `IsNotEmpty` | 不为空 | 所有 |
| `GreaterThan` | 大于 | NumberField |
| `GreaterThanOrEqual` | 大于等于 | NumberField |
| `LessThan` | 小于 | NumberField |
| `LessThanOrEqual` | 小于等于 | NumberField |
| `In` | 属于 | SelectField, RadioField |
| `NotIn` | 不属于 | SelectField, RadioField |

### 字段权限（formConfig）

```json
{
  "formConfig": {
    "behaviorList": [
      { "fieldId": "textField_xxx", "fieldBehavior": "READONLY" },
      { "fieldId": "radioField_xxx", "fieldBehavior": "NORMAL" }
    ]
  }
}
```

| fieldBehavior | 说明 |
|---------------|------|
| `NORMAL` | 可编辑 |
| `READONLY` | 只读 |
| `HIDDEN` | 隐藏 |

### 跳转规则（routeRules）

```json
{ "routeRules": [{ "when": "disagree", "jumpTo": "部门主管审核" }] }
```

`jumpTo` 为目标节点 `name`，或 `"结束"`。

## AI 自动生成流程特性

生成流程定义 JSON 时，**必须自动分析并生成**：

1. **🔐 字段权限**：每个审批节点只允许编辑相关字段，其他设为 READONLY/HIDDEN
2. **🔄 跳转规则**：识别回退/循环语义，自动配置 `routeRules`

详见 [AI 自动生成流程定义规范](references/process-ai-rules.md)。

## 示例

### 简单审批

```json
{ "nodes": [{ "type": "approval", "name": "主管审批", "approver": "originator" }] }
```

### 条件分支 + 抄送

```json
{
  "nodes": [
    { "type": "route", "conditions": [{ "name": "金额大于1000", "rules": [{ "fieldId": "numberField_xxx", "op": "GreaterThan", "value": "1000", "componentType": "NumberField", "fieldName": "金额" }], "childNodes": [{ "type": "approval", "name": "财务审批", "approver": "originator" }] }] },
    { "type": "carbon", "name": "抄送通知", "approver": "originator" }
  ]
}
```

> 一步到位创建表单 + 配置流程，请使用 `yida-create-process`。
