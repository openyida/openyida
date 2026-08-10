# 流程定义 DSL

流程文件只描述业务节点。开始节点、结束节点、底层节点 ID、`processJson` 和 `viewJson` 由 CLI 生成。

## 节点类型

| `type` | 用途 | 主要字段 |
|--------|------|----------|
| `approval` | 审批 | `name`、`approver` |
| `operator` | 办理或补充资料 | `name`、`executor` 或 `approver` |
| `carbon` | 抄送 | `name`、`approver` |
| `route` | 条件分支 | `conditions` |
| `parallel` | 并行分支 | `branches` |

CLI 兼容 `ApprovalNode`、`OperatorNode`、`CarbonNode`、`ConditionContainer`、`parallelBranch` 等别名，但新文件使用上表中的短名称。

## 审批与办理

```json
{
  "type": "approval",
  "name": "主管审批",
  "approver": "originator",
  "formConfig": {
    "behaviorList": [
      { "fieldId": "textField_reason", "fieldBehavior": "READONLY" }
    ]
  }
}
```

办理节点使用同一套人员配置：

```json
{
  "type": "operator",
  "name": "补充资料",
  "executor": {
    "type": "user",
    "users": [{ "id": "user001", "name": "运营人员" }]
  }
}
```

## 审批人

发起人本人：

```json
"approver": "originator"
```

指定成员：

```json
{
  "type": "user",
  "users": [{ "id": "user001", "name": "审批人" }],
  "multiApproverType": "all"
}
```

指定角色：

```json
{
  "type": "role",
  "roles": [{ "id": "ROLE-FINANCE", "name": "财务", "roleType": "YIDA" }],
  "multiApproverType": "or"
}
```

部门主管或直属主管：

```json
{
  "type": "deptLeader",
  "source": "originator",
  "level": 1,
  "needLeaderReplace": true,
  "ignoreNoLeaderDept": false
}
```

直属主管使用 `directLeader`。`multiApproverType` 可使用 `all`、`or` 或 `oneByOne`。成员和角色 ID 必须来自真实通讯录或平台返回值。

## 条件分支

```json
{
  "type": "route",
  "conditions": [
    {
      "name": "金额较高",
      "logic": "AND",
      "rules": [
        {
          "fieldId": "numberField_amount",
          "fieldName": "金额",
          "componentType": "NumberField",
          "op": "GreaterThan",
          "value": 10000
        }
      ],
      "childNodes": [
        { "type": "approval", "name": "财务审批", "approver": "originator" }
      ]
    }
  ]
}
```

条件支持 `Equal`、`NotEqual`、`Contains`、`NotContain`、`IsEmpty`、`IsNotEmpty`、`GreaterThan`、`GreaterThanOrEqual`、`LessThan`、`LessThanOrEqual`、`In` 和 `NotIn`。`fieldId` 和 `componentType` 必须来自当前表单 Schema。

## 并行分支

```json
{
  "type": "parallel",
  "name": "并行会审",
  "branches": [
    {
      "name": "法务会审",
      "childNodes": [
        { "type": "approval", "name": "法务审批", "approver": "originator" }
      ]
    },
    {
      "name": "财务会审",
      "rules": [],
      "childNodes": [
        { "type": "approval", "name": "财务审批", "approver": "originator" }
      ]
    }
  ]
}
```

每个分支可设置 `name`、`rules`、`logic` 和 `childNodes`。无条件分支使用空 `rules`。

## 字段权限

```json
{
  "formConfig": {
    "behaviorList": [
      { "fieldId": "textField_reason", "fieldBehavior": "READONLY" },
      { "fieldId": "textareaField_comment", "fieldBehavior": "NORMAL" },
      { "fieldId": "textField_internal", "fieldBehavior": "HIDDEN" }
    ]
  }
}
```

`NORMAL` 表示可编辑，`READONLY` 表示只读，`HIDDEN` 表示隐藏。

## 跳转规则

```json
{
  "routeRules": [
    { "when": "disagree", "jumpTo": "补充资料" }
  ]
}
```

`routeRules` 用于退回、返工、循环检验或重新提交。`jumpTo` 使用目标节点名称，或使用 `结束` 跳到流程结束。

## 特殊平台配置

DSL 无法表示租户特有的审批人规则时，先在宜搭设计器创建可用样例并读取真实配置，再把完整 `approver` 对象写入节点。未经验证的 `approverRules` 不得靠猜测生成。
