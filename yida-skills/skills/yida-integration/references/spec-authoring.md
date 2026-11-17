# 自动化 spec 编排

什么时候用：编排多个节点、引用上游结果或声明安全凭据绑定时。

必填配置：外层 `events` 和非空 `nodes`；节点的必填项按通用节点 Skill 确定。此文件补充自动化专有的别名、展示字段和凭据格式。

### 结构化编排 `--spec`

复杂自动化优先使用 `--spec`，不要手写 `saveProcess` payload。spec 的节点可以用 `id` 作为别名，后续用 `${别名}.fieldId` 引用上游节点输出，OpenYida 会在保存前替换成真实 `node_xxx`。

HTTP 连接器的嵌套路径、Body 固定值与动态字段混用，按[扩展执行的类型规则](../../yida-flow-node-config/references/extensions.md#http-body-赋值与类型)填写；配置后需真实核对接口收到的值与类型。

需要复杂计算或嵌套分支时，选 [完整取数 spec](../../yida-formula/references/node-examples.md#按编号字段嵌套公式和固定状态取数) 或 [两层 route spec](../../yida-formula/references/node-examples.md#嵌套分支先决定是否复核再决定级别)。节点放在 nodes，分支放在 branches，分支内的后续节点再放在该分支的 nodes；右侧公式对象放在对应条件的 value 中。取数 conditions 仍是平铺条件，不能把路由嵌套格式放进去。

```json
{
  "events": ["insert"],
  "nodes": [
    { "id": "self", "type": "getSelf", "formType": "receipt" },
    {
      "id": "branch",
      "type": "route",
      "branches": [
        {
          "id": "hasSelf",
          "name": "已获取自身",
          "conditions": [
            {
              "fieldId": "${self}.form_inst_id",
              "fieldName": "表单实例ID",
              "opCode": "ExistValue",
              "componentType": "TextField"
            }
          ],
          "nodes": [
            {
              "id": "updateSelf",
              "type": "dataUpdate",
              "source": "self",
              "assignments": [
                {
                  "column": "textareaField_result",
                  "valueType": "literal",
                  "value": "已处理"
                }
              ]
            }
          ]
        },
        {
          "id": "fallback",
          "name": "其他情况",
          "default": true,
          "nodes": [
            {
              "id": "notice",
              "type": "sendMessage",
              "title": "未获取到记录",
              "content": "获取自身节点无匹配结果，请检查过滤条件。",
              "toRoles": [{"roleCode":"<真实角色ID>","roleName":"负责人"}]
            }
          ]
        }
      ]
    }
  ]
}
```

```bash
openyida integration create APP_XXX FORM-XXX "获取自身后分支更新" \
  --spec .cache/openyida/<项目名或任务名>/integration/get-self-update.json \
  --publish
```

> `--spec` 文件先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；从 workspace 根执行命令时路径加 `project/` 前缀。

`initiateApproval` 必须把目标流程表单、发起人和至少一个字段赋值完整写进 spec；不要再混传同名 CLI 结构参数。`select_user.value` 是员工身份 JSON 字符串，必须含非空 `id` 和固定 `type: "employee"`；使用当前登录用户时写 `current_user`，CLI 会在远端写入前解析为员工身份。

需要 `systemToken` 的 connector 节点用安全绑定声明目标应用。`assignments` 不写 `systemToken`：

```json
{
  "type": "connector",
  "connectorId": "Http_xxx",
  "actionId": "query_yida_data",
  "secretBindings": [
    { "target": "body.systemToken", "provider": "yidaSystemToken", "appType": "APP_TARGET" }
  ],
  "assignments": [
    { "column": "formUuid", "valueType": "literal", "value": "FORM_TARGET" }
  ]
}
```

```json
{
  "type": "initiateApproval",
  "formUuid": "FORM-PROCESS-XXX",
  "initiator": { "type": "current_user" },
  "assignments": [
    { "column": "textField_title", "valueType": "literal", "value": "自动发起审批" }
  ]
}
```

## 子表单行查询与追加

单行仍使用 `dataRetrieve/dataCreate`，不设置批量模式。下例中 `record` 是已声明的上游主表记录：

```json
{
  "events":["insert"],
  "nodes":[
    {"id":"record","type":"getSelf"},
    {
      "id":"lookupRow",
      "type":"dataRetrieve",
      "originalType":"sub_table",
      "source":"record",
      "subSourceId":"<真实子表字段ID>",
      "conditions":[{
        "bFieldId":"<真实子表编号字段ID>",
        "bFieldName":"编号",
        "aFieldId":"<真实触发表单编号字段ID>",
        "componentType":"TextField",
        "opCode":"Equal",
        "valueType":"processVar"
      }]
    },
    {
      "id":"appendRow",
      "type":"dataCreate",
      "insertType":"sub_table",
      "source":"record",
      "subFormUuid":"<真实子表字段ID>",
      "assignments":[{
        "column":"<真实子表编号字段ID>",
        "valueType":"processVar",
        "value":"<真实触发表单编号字段ID>"
      }]
    }
  ]
}
```

- 子表查询的 `source` 必须在拓扑上游，`subSourceId` 是该来源主表下的真实子表 ID；不要再用目标主表 `formUuid` 代替来源。
- 子表新增的 `source` 指定目标记录，`subFormUuid` 指定目标子表，赋值字段必须属于该子表。`parentFormUuid` 可显式提供；省略时按来源节点推断，`getSelf` 回退到触发表单 UUID。
- 来源须是确定的单条主表记录，不能用批量结果或其他分支的节点。字段 ID 全部替换为实际查询结果；使用批量模式时另读 [批量数据示例](batch-data.md)。
- 新建、发布或整图替换遵守主技能授权门槛；这些结构不能解锁 `integration update`，也不能自动覆盖现网自动化。

## 特有限制

流程事件的完整 spec 需同时包含 `events` 和 `approvalActions`；`activityTask` 还需 `approvalNodeIds`。例如 `{"events":["processFinish"],"approvalActions":["agree"]}` 是触发片段。不要假设命令选项会补入这些字段。

默认只保存草稿。已有逻辑流不能把 `integration update` 的能力阻断降级为整图替换；保存发布的授权和验证规则遵循主技能。公式与变量格式统一见 `use_skill("yida-flow-node-config", "条件与变量")`。

公式赋值的运行表达式 `value` 使用 `${alias}.fieldId`；设计器展示源码 `__source` 使用 `#{alias//fieldId}`。CLI 分别替换为真实节点 ID；不能只写运行值就假设设计器可以恢复“值设置”展示。需要保留原公式展示时，两侧都要核对。

## 保存与验证规则

### 保存顺序与输出

1. 使用有效 token session；连接器先只读发现真实 action 的 inputs/outputs。首个写入前完成节点 ID、运行 JSON 与设计 JSON 的构建及校验。
2. 新建时先调用 `createLogicflow.json` 取得真实 `processCode` 并创建绑定；已确认的整图替换复用归属已核实的 Code。禁止直接调用 `saveProcess` 冒充新建。
3. `saveProcess(isOnline=false)` 保存草稿；用户确认发布且带 `--publish` 时，再用同一接口 `isOnline=true` 启用。
4. 保存后按 `formUuid + processCode` 完整列表回读，校验唯一目标和期望状态，并核对详情存在性及接口实际返回的身份字段。精确匹配为零或多条、状态不符、详情为空或失败、详情身份与目标冲突时，必须报告失败。

草稿成功时 stdout 返回 JSON，例如：

```json
{
  "success":true,
  "published":false,
  "processCode":"LPROC-<真实返回的逻辑流ID>",
  "flowName":"新增记录通知",
  "appType":"APP_XXX",
  "formUuid":"FORM_XXX",
  "formEventTypes":["insert"]
}
```

只有精确列表、最终状态与非空详情回读通过，`published` 才为 true，验证等级为 `PLATFORM_LIST_EXACT_DETAIL_PRESENT`。详情缺少可核实的身份字段时，只能报告详情存在，不能宣称 detail exact 或完整 runtime graph 已验证。写成功但回读无法证明时命令失败，`published=null`、`verificationLevel=UNVERIFIED`；不得把写响应当完成证据。

### 修改已有自动化

已有节点的增量修改、基线检查、预览和并发限制统一见 [修改已有自动化](operations.md#修改已有自动化)。`PLATFORM_PROBE_REQUIRED` 时保持 `remoteWrites=0`，保留 probe artifact 与 blocker；列表或详情存在性不足以证明完整运行定义，不能据此解锁修改。

已有可靠双定义基线时按支持的补丁范围更新。缺少基线或远端已改变时先停止；不将阻断结果降级为整图替换、通用 JSON Patch 或重建同名逻辑流。

### 运行验收

配置保存、配置回读与真实运行分别报告。`runtimeVerified=false` 时不得宣称连接器已执行、通知已送达或目标数据已写入。用户要求运行验收时，必须在授权范围内真实触发并独立读回业务结果。

使用 `scripts/e2e-real/integration/runtime-runner.js` 的真实平台 adapter 时，必须提供 owned fixture 的 `prepare/trigger/readback/cleanup`。prepare 是只读前置检查，必须声明 `remoteWrites=0`，并提供结构化 `ownershipEvidence`、资源 fingerprint 和 correlation proof；归属通过后才可 trigger/cleanup。

该 runner 对 `dataCreate/dataRetrieve/dataUpdate/route/sendMessage/connector/initiateApproval` 设有独立读回合同和 mutation 失败条件，不能用一次通用成功响应替代各节点的业务结果。

主流程和 cleanup 都失败时，必须同时报告机器错误及残留资源。compiler、builder 单测或写响应不能替代运行证据。
