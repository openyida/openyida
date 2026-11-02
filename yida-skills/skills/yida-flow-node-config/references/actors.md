# 人员与角色

## 什么时候用

选择审批人、办理人、抄送人或旧版多人审批环节的处理人时。角色是人员来源之一，不能与人员条件模式、权限矩阵或表单数据访问权限混淆。

消息接收人另读 [通知](notifications.md)，不在这里重复消息结构。

## 必填配置

| 来源 | 人员对象 |
| --- | --- |
| 发起人本人 | `"originator"` |
| 指定成员 | `{"type":"user","users":[{"id":"<真实userId>","name":"负责人"}]}` |
| 指定角色 | `{"type":"role","roles":[{"id":"<真实角色ID>","name":"财务","roleType":"YIDA"}]}` |
| 部门主管 | `{"type":"deptLeader","source":"originator","level":1}` |
| 直属主管 | 上一项改为 `"type":"directLeader"` |

这些来源可直接生成配置。审批和旧版多人审批放在 `approver`，办理放在 `executor`，抄送放在 `receiver`，同一人员对象无需重复改写。

用户只给姓名时，先通过 `corp-manager search-user "<姓名>" --json` 等现有通讯录能力查真实 ID；同名时按组织信息消歧。角色 ID 从目标组织已有配置或平台只读查询取得，不用角色名称代替，也不编造角色。

## 最小示例

```json
{
  "type": "approval",
  "name": "财务审批",
  "approver": {
    "type": "role",
    "roles": [
      {
        "id": "<真实角色ID>",
        "name": "财务",
        "roleType": "YIDA"
      }
    ],
    "multiApproverType": "or"
  }
}
```

`multiApproverType` 用 `all`（会签）、`or`（或签）、`oneByOne`（依次审批）。旧版 `multiApproval` 另在节点上设置相同取值的 `mode`。

### 发起人本人

```json
{
  "type": "approval",
  "name": "发起人确认",
  "approver": "originator"
}
```

### 指定成员

```json
{
  "type": "approval",
  "name": "指定成员审批",
  "approver": {
    "type": "user",
    "users": [
      {
        "id": "<真实userId>",
        "name": "<真实姓名>"
      }
    ],
    "multiApproverType": "all"
  }
}
```

成员 ID 通过目标组织的通讯录、应用成员或已知人员配置取得，姓名不能作为 ID 提交。

### 部门主管与直属主管

```json
{
  "type": "approval",
  "name": "部门主管审批",
  "approver": {
    "type": "deptLeader",
    "source": "originator",
    "level": 1,
    "needLeaderReplace": true,
    "ignoreNoLeaderDept": false
  }
}
```

直属主管使用 `type: directLeader`，来源和层级仍用 `source/level`；替补参数使用 `needDeptLeaderReplace`，不要把部门主管的两个替补参数直接套入。

## 表单成员与发起人自选

字段选人、发起时自选及逐级指定下一级经办人，读取 [动态人员来源](dynamic-actors.md)。审批／办理支持两种来源，抄送与旧版多人审批支持成员字段；自选的节点范围、权益与兼容性边界见该文档。

## 按条件选人

审批、办理、抄送分别使用 `approver/executor/receiver`，共用 `kind: conditional`。先查询真实字段、人员和角色。

直接使用下方[审批、办理、抄送的完整配置](#审批办理抄送的完整配置)，再按任务保留需要的节点。

### 匹配方式

| 参数 | 用途 |
| --- | --- |
| `mode: conditional` | 按顺序选择第一条命中的人员规则，默认方式 |
| `mode: parallel_conditional` | 选择所有命中规则中的人员 |
| `when` | 本项生效的条件，使用真实字段与非空条件组 |
| `actor` | 成员、角色、发起人、部门主管或直属主管，使用上方人员格式 |
| `approvalMode` | 多人处理方式：`all/or/oneByOne` |

`conditional` 模式下，最后一项可省略 `when`，作为前面都没命中时的兜底；其余项提供条件。`parallel_conditional` 会收集所有命中的人员，省略 `when` 的一项每次都会加入。希望只在其他规则没命中时使用兜底，选择 `conditional`。

CLI 同时生成执行所需的人员配置和设计器规则。保存后分别用命中、不命中和兜底数据发起测试，核对实际任务接收人。平台提示权益不可用时，按提示说明所需能力。

审批与办理可使用上述五种人员来源；抄送目前可选成员、角色、发起人和部门主管。抄送中的直属主管会在保存前拒绝，按平台支持的接收人来源配置。

预览用于检查候选人员。预览出现节点缺项时，保留测试数据和流程版本，再核对真实运行记录、当前任务及抄送记录，分别说明预览结果和实际运行结果。

### 审批、办理、抄送的完整配置

用途：金额超过 10000 时找财务审批；优先级是“紧急”时由指定成员办理和接收抄送；其他情况交给发起人。下面是完整流程定义，可只保留需要的节点。

```json
{
  "nodes": [
    {
      "type": "approval", "name": "金额审批",
      "approver": {"kind": "conditional", "mode": "conditional", "cases": [
        {"when": {"logic": "AND", "rules": [
          {"fieldId": "<真实金额字段ID>", "componentType": "NumberField", "op": "GreaterThan", "value": 10000}
        ]}, "actor": {"kind": "role", "roles": [{"id": "<真实角色ID>", "name": "财务"}]}},
        {"actor": {"kind": "originator"}}
      ]}
    },
    {
      "type": "operator", "name": "优先级办理",
      "executor": {"kind": "conditional", "mode": "conditional", "cases": [
        {"when": {"logic": "AND", "rules": [
          {"fieldId": "<真实优先级字段ID>", "componentType": "SelectField", "op": "Equal", "value": "紧急"}
        ]}, "actor": {"kind": "user", "users": [{"id": "<真实办理人ID>", "name": "值班人员"}]}},
        {"actor": {"kind": "originator"}}
      ]}
    },
    {
      "type": "carbon", "name": "优先级抄送",
      "receiver": {"kind": "conditional", "mode": "conditional", "cases": [
        {"when": {"logic": "AND", "rules": [
          {"fieldId": "<真实优先级字段ID>", "componentType": "SelectField", "op": "Equal", "value": "紧急"}
        ]}, "actor": {"kind": "user", "users": [{"id": "<真实抄送人ID>", "name": "跟进人员"}]}},
        {"actor": {"kind": "originator"}}
      ]}
    }
  ]
}
```

金额字段是数字，比较值写 `10000`；优先级字段在本例是单选，`紧急` 填该选项真实存储的值。保存前查询真实字段类型和人员 ID；同一人员规则放到审批的 `approver`、办理的 `executor`、抄送的 `receiver`，CLI 负责生成各自的底层参数。

将完整定义写入 `process.json`，通过流程入口保存：

```bash
openyida get-schema APP_XXX FORM_XXX --field-map-json
openyida configure-process APP_XXX FORM_XXX .cache/openyida/task/process.json
```

已有流程要求替换时，先核对完整定义和替换范围，经用户同意后在命令中加 `--replace`。

| 测试数据 | 预期审批人 | 预期办理人／抄送人 |
| --- | --- | --- |
| 金额 10001，优先级“紧急” | 财务角色成员 | 对应指定成员 |
| 金额 10000，优先级“普通” | 发起人 | 发起人 |
| 金额 0，优先级“紧急” | 发起人 | 对应指定成员 |

### 多条条件同时命中时收集人员

用途：金额大于 10000 加入财务，优先级是“紧急”加入值班人员。两条都命中时两组人员都参加；`approvalMode:all` 表示所有选中的人都要处理。

```json
{
  "nodes": [{
    "type": "approval", "name": "共同确认",
    "approver": {"kind": "conditional", "mode": "parallel_conditional", "approvalMode": "all", "cases": [
      {"when": {"logic": "AND", "rules": [
        {"fieldId": "<真实金额字段ID>", "componentType": "NumberField", "op": "GreaterThan", "value": 10000}
      ]}, "actor": {"kind": "role", "roles": [{"id": "<真实角色ID>", "name": "财务"}]}},
      {"when": {"logic": "AND", "rules": [
        {"fieldId": "<真实优先级字段ID>", "componentType": "SelectField", "op": "Equal", "value": "紧急"}
      ]}, "actor": {"kind": "user", "users": [{"id": "<真实办理人ID>", "name": "值班人员"}]}}
    ]}
  }]
}
```

本例没有无条件兜底。准备仅命中金额、仅命中优先级、同时命中、都不命中四组数据；最后一组可能没有处理人，按用户要求确认这种情况应如何处理。一个 `when` 内多条规则用 `logic:AND` 表示全部满足，用 `OR` 表示任一满足；`mode` 决定命中多条人员规则时怎样选人。

## 原始审批人配置（高级透传）

简化 DSL 无法覆盖某个真实人员规则时，可把完整原始对象放在 `approver` 或 `approverConfig`。下面展示发起人规则的结构：

```json
{
  "type": "approval",
  "name": "发起人确认",
  "approver": {
    "approvalType": "ext_target_approval_originator",
    "approvals": [
      [
        "originator"
      ]
    ],
    "processProps": {},
    "approverRules": {
      "type": "ext_target_approval_originator",
      "mode": "ApprovalNode_rules_only",
      "approverList": [
        {
          "type": "ext_target_approval"
        }
      ],
      "multiApproverType": "all",
      "conditionalMode": "conditional",
      "description": "发起人本人"
    }
  }
}
```

- `approvalType/approvals/processProps` 用于运行配置，`approverRules` 用于设计器；不能只保留其中一侧。`processProps` 兼容原始对象的 `props`。
- `approverConfig` 优先于简化人员参数；不要同时提供相互矛盾的配置。旧版多人审批仍由 CLI 生成对应内外层规则。
- 不同租户的接口人、第三方服务、连接器选人、权限矩阵规则可能不同。必须从已有流程、已验证接口或经授权保存的设计器配置取得完整结构，缺少时停止，不编造参数。
- 示例是单一发起人规则，不是条件选人示例。`conditionalMode` 本身不代表已配置条件模式；条件选人仍需真实的条件、人员、兜底及运行层与设计层配置。

## 特有限制

- `roleType` 默认为 `YIDA`，钉钉角色用 `DINGTALK`；CLI 按来源生成 `multiRoles`。角色数量、成员范围和可用性以真实角色与服务端校验为准，不创建或变更角色成员。
- 部门主管支持 `needLeaderReplace/ignoreNoLeaderDept`；直属主管支持 `needDeptLeaderReplace`。主管来源和层级应按业务需求确定。
- 平台审批、办理、抄送共用“条件模式”：每项配置人员和生效条件，再选按优先级或并行生效，并保留兜底人员。每项也可选择角色。
- 条件选人使用上方 `kind: conditional` 的完整规则。CLI 同时生成运行人员列表与设计器规则；仅修改 mode 不能表达选人条件。
- 超出简化选人范围时，按高级透传要求取得完整的运行和设计配置。保存发布按 `configure-process` 的结果处理；明确提示权益不足时再说明所需权益。
- 普通指定角色不要求因此配置权限矩阵。特殊接口人、连接器选人或矩阵规则需已有真实配置；不能随意套用上述简化对象。
