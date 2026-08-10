# 集成自动化命令参数

## 创建或更新

```bash
openyida integration create <appType> <formUuid> "<flowName>" [options]
```

传入 `--process-code` 时更新已有逻辑流；不传时创建逻辑流。

## 触发与通知

| 参数 | 说明 |
|------|------|
| `--process-code <code>` | 已有逻辑流的真实 `LPROC-...` ID |
| `--events <list>` | `insert`、`update`、`delete`、`comment`、`processFinish` 或 `activityTask` |
| `--approval-actions <list>` | 审批事件使用 `agree`、`disagree`、`terminated` |
| `--approval-node-ids <list>` | `activityTask` 事件对应的真实审批节点 ID |
| `--trigger-condition <rule>` | `fieldId:fieldName:opCode:value[:componentType[:valueType]]`，可重复传入 |
| `--trigger-recursively` | 允许自动化再次触发自动化 |
| `--receivers <userId,...>` | 钉钉工作通知接收人 |
| `--user-fields <fieldId,...>` | 从成员字段读取通知接收人 |
| `--title <text>` | 通知标题，支持 `#{fieldId-ComponentType}#` |
| `--content <text>` | 通知内容，支持 `#{fieldId-ComponentType}#` |

`processFinish` 和 `activityTask` 必须传 `--approval-actions`；`activityTask` 还必须传 `--approval-node-ids`。

## 查询数据

| 参数 | 说明 |
|------|------|
| `--get-self` | 按当前表单实例 ID 重新读取触发记录 |
| `--get-self-field <field>` | 触发事件中的实例 ID 字段，默认 `__masterdata_form_inst_id` |
| `--get-self-query-field <field>` | 查询侧实例 ID 字段，默认 `pid` |
| `--data-form-uuid <formUuid>` | 获取单条数据节点的目标表单 |
| `--data-condition <rule>` | `目标字段ID:字段名:触发字段ID[:组件类型[:操作符[:值类型]]]`，可重复传入 |

## 写入数据或发起审批

| 参数 | 说明 |
|------|------|
| `--add-data-form-uuid <formUuid>` | 新增数据节点的目标普通表单 |
| `--add-data-assignment <rule>` | `目标字段ID:valueType:value`，可重复传入 |
| `--initiate-approval-form-uuid <formUuid>` | 发起审批节点的目标流程表单 |
| `--initiate-approval-initiator-user <userId[:name]>` | 发起审批的发起人 |
| `--initiate-approval-assignment <rule>` | 审批表单字段赋值，可重复传入 |

`valueType` 使用 `processVar`、`literal` 或 `column`。普通表单使用新增数据节点；流程表单使用发起审批节点。使用发起审批节点时必须指定发起人。

## 调用连接器

| 参数 | 说明 |
|------|------|
| `--connector-id <id>` | 真实连接器 ID |
| `--action-id <id>` | 真实动作 ID，必须和 `--connector-id` 同时传入 |
| `--connector-name <name>` | 连接器名称 |
| `--connector-display-name <name>` | 设计器显示名称 |
| `--connector-mode <mode>` | HTTP 连接器使用 `5` |
| `--connection-id <id>` | HTTP 连接器的鉴权连接 ID |
| `--connector-icon <url>` | 连接器图标 URL |
| `--connector-inputs <file>` | 连接器输入 Schema JSON 文件 |
| `--connector-assignment <rule>` | `column:valueType:value`，可重复传入 |

HTTP 连接器应提供 `--connection-id`，否则设计器可能无法加载连接实例详情。

## 复杂节点和发布

| 参数 | 说明 |
|------|------|
| `--spec <file.json>` | 使用结构化文件定义 `dataRetrieve`、`dataCreate`、`dataUpdate`、`route`、`sendMessage` 或 `connector` 节点 |
| `--publish` | 保存后立即发布；不传时保存为草稿 |

结构化文件写入 `<projectRoot>/.cache/openyida/<任务名>/integration/`。节点 JSON 读取 [节点结构](integration-node-schemas.md)。

## 查询和启停

```bash
openyida integration list <appType> [--form-uuid <formUuid>] [--status y|n] [--json]
openyida integration enable <appType> <formUuid> <processCode>
openyida integration disable <appType> <formUuid> <processCode>
openyida integration check <appType...> [--json]
openyida integration diagnose (--text <text>|--file <path>|--rules) [--json]
```
