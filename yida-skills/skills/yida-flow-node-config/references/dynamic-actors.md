# 表单成员与发起人自选

## 先区分两个场景

- 发起流程时选择后续审批人／办理人：用 `kind:selfSelect`。
- 当前办理人指定下一级经办人：用 `kind:formField`，由当前节点填写成员组件，下一节点读取这个成员字段。它不会凭空增加“选择下一处理人”按钮。

先用 `openyida get-schema APP_XXX FORM_XXX --field-map-json` 取得真实字段 ID。保存仍走 `configure-process`；已有流程先读取、保留完整配置，再按用户授权使用 `--replace`。这些人员来源只用于流程人工节点，不直接套进自动化的消息接收人。

## 表单内成员字段

```json
{
  "nodes": [
    {"type":"approval","name":"成员字段审批","approver":{"kind":"formField","fieldId":"<真实成员字段ID>","approvalMode":"all"}},
    {"type":"operator","name":"指定成员办理","executor":{"kind":"formField","fieldId":"<真实成员字段ID>"}},
    {"type":"carbon","name":"通知表单成员","receiver":{"kind":"formField","fieldId":"<真实成员字段ID>"}}
  ]
}
```

`fieldId` 是一个顶层 `EmployeeField`，不是姓名、部门字段或子表成员字段。多个成员组件用 `fieldIds:["<真实ID1>","<真实ID2>"]`，不能同时写 `fieldId`。`approvalMode` 为 `all/or/oneByOne`，默认 `all`；旧版 `multiApproval` 也可将此来源放在 `approver`，节点上的 `mode` 控制多人会审方式。

CLI 同时生成运行层 `ext_target_approval_variable` 与设计器的 `formMember`；保存前读取真实表单字段，检查存在性、组件类型和子表归属。不要猜测 `ext_target_approval_field` 等枚举，未知原始人员类型会在远端写入前报错。

### 逐级指定下一级经办人

例如“发起人指定一级经办人，一级经办人指定二级经办人”：准备两个真实成员组件，定义如下。

```json
{
  "startFormConfig":{"behaviorList":[
    {"fieldId":"<一级经办人成员字段ID>","fieldBehavior":"NORMAL"},
    {"fieldId":"<二级经办人成员字段ID>","fieldBehavior":"HIDDEN"}
  ]},
  "nodes":[
    {"type":"operator","name":"一级办理",
      "executor":{"kind":"formField","fieldId":"<一级经办人成员字段ID>"},
      "formConfig":{"behaviorList":[
        {"fieldId":"<一级经办人成员字段ID>","fieldBehavior":"READONLY"},
        {"fieldId":"<二级经办人成员字段ID>","fieldBehavior":"NORMAL"}
      ]}},
    {"type":"operator","name":"二级办理",
      "executor":{"kind":"formField","fieldId":"<二级经办人成员字段ID>"},
      "formConfig":{"behaviorList":[
        {"fieldId":"<二级经办人成员字段ID>","fieldBehavior":"READONLY"}
      ]}}
  ]
}
```

在表单设计中按业务需要将成员组件设为隐藏并开启“始终提交”，流程节点权限再将当前需要填写的字段设为可编辑。**“始终提交”是表单组件属性，不是上面 `formConfig` 的属性**；先读取真实组件配置，不能只配节点权限就声称隐藏成员能正确提交。给需要选人的节点增加必填校验，防止未填下一经办人导致无人处理。

验收依次检查：发起时选甲 → 只有甲收到一级任务；甲填写乙并提交 → 只有乙收到二级任务；成员字段为空、多人和退回重提各按业务规则测试。配置回读成功与真实任务投递成功分别报告。

## 发起人自选

审批放 `approver`，办理放 `executor`。默认全组织范围，也可限制为指定成员或指定角色：

```json
{
  "nodes":[
    {"type":"approval","name":"组织内自选","approver":{"kind":"selfSelect","range":{"type":"ALL"}}},
    {"type":"operator","name":"候选成员自选","executor":{"kind":"selfSelect","range":{"type":"USER","users":[{"id":"<真实userId>","name":"候选人"}]}}},
    {"type":"approval","name":"角色内自选","approver":{"kind":"selfSelect","approvalMode":"or","range":{"type":"ROLE","roles":[{"id":"<真实角色ID>","roleType":"YIDA"}]}}}
  ]
}
```

`USER/ROLE` 必须提供非空真实 ID 列表；钉钉角色用 `roleType:DINGTALK`。`ALL` 不填写 `users/roles`。这里的“自选”指**发起人**，不能用来承诺每个当前办理人都能在提交时重新指定下一级；逐级选择使用上方成员字段方案。

## 权益和兼容性边界

| 场景 | 已核实的边界 |
| --- | --- |
| 审批／办理的表单成员、自选 | 原生设计器列为常规人员来源，不能仅据此保证每个租户和旧应用均可用；以目标环境选项和服务端结果为准 |
| 发起人自选在旧应用中不可见 | 旧应用及锁定资源的应用可能受前端资源兼容性影响，先核对应用版本与设计器选项，不直接要求购买套餐 |
| 抄送的发起人自选 | 官方文档列为支持；本次接入依据的设计器实现另有非免费版和功能开关判断，目标环境尚未核验。当前简化 DSL 明确拒绝，不能绕过开关或静默改成发起人本人 |
| 旧版 `multiApproval` 的自选 | 原生设计器排除此来源，CLI 拒绝；普通审批节点的多人处理方式不等于旧版多人审批节点 |
| `kind:conditional` 条件选人 | 是独立能力，官方标注“专属—OA 增强包”；不能据此推断普通表单成员选人也需要该权益。本次两种新来源不嵌套进条件人员规则 |

套餐与开关是不同维度。平台提示“不支持”时，保留错误码与目标环境信息，分别确认权限、套餐、开关和应用资源版本，不编造可开通的权益或修改平台开关。

参考：[官方逐级指定人员方案](https://docs.aliwork.com/docs/yida_qalist/_1/_4/uqq8fy5gedskzs4f)、[审批节点与自选范围](https://docs.aliwork.com/docs/yida_support/_2/trbqg6/rq8i94)、[抄送节点](https://docs.aliwork.com/docs/yida_support/_2/trbqg6/cntvp8)。
