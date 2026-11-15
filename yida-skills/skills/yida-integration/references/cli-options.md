# 集成自动化 CLI 选项与示例

仅在需要查具体命令参数时读取；节点配置的共用规则由 `use_skill("yida-flow-node-config")` 提供。

创建的事件和定时配置见 [触发设置](triggers.md)；更新、日志、监听与复制等命令见 [维护与运行排查](operations.md)。本页集中查创建参数及简短示例。

### 参数说明

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `appType` | 是 | 应用 ID，如 `APP_XXXX` |
| `formUuid` | 是 | 触发表单 UUID，如 `FORM-XXXX` |
| `flowName` | 是 | 逻辑流名称 |

### 选项说明

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--process-code <code>` | 自动生成 | 已有逻辑流的 processCode（`LPROC-xxx` 格式）；与 `--replace` 同时使用，执行整图替换 |
| `--replace` | 关闭 | 显式确认 `--process-code` 执行整图替换 |
| `--receivers <userId,...>` | 空（无接收人） | 接收钉钉工作通知的用户 ID，多个用逗号分隔 |
| `--title <title>` | 同 flowName | 通知标题，支持 `#{fieldId-ComponentType}#` 引用表单字段 |
| `--content <content>` | `"表单有新记录提交，请及时查看。"` | 通知内容，支持 `#{fieldId-ComponentType}#` 引用表单字段 |
| `--events <insert,update>` | `insert` | 触发事件，可选值：`insert`/`update`/`delete`/`comment`/`processFinish`/`activityTask`（也支持别名 `create`/`approval`/`approvalNode`），多个用逗号分隔 |
| `--approval-actions <agree,...>` | 空 | 当 `--events processFinish` 或 `--events activityTask` 时必填；可选值：`agree`/`disagree`/`terminated`，多个用逗号分隔 |
| `--approval-node-ids <nodeId,...>` | 空 | 当 `--events activityTask` 时必填；审批节点 ID，多个用逗号分隔 |
| `--trigger-condition <fieldId:fieldName:opCode:value[:componentType[:valueType]]>` | 空 | 触发过滤条件，可多次传入；固定值用 `literal`（默认），右侧为另一个字段时用 `processVar`，见 [字段比较示例](../../yida-flow-node-config/references/conditions-variables.md) |
| `--trigger-recursively` | 关闭 | 允许自动触发，对应设计器里的“允许自动触发” |
| `--spec <file.json>` | 不启用 | 使用结构化编排文件创建复杂自动化，支持 `getSelf`、`dataRetrieve`、`dataCreate`、`dataUpdate`、`route`、`parallel`、`cycle`、`sendMessage`、`connector`、`initiateApproval`。循环体受组织权益和节点范围限制，见 [流转控制](../../yida-flow-node-config/references/control.md#循环逐条通知示例) |
| `--get-self` | 关闭 | 自动插入“获取自身”节点：流程表单运行态查询字段为 `pid`、设计器字段为 `proc_inst_id`；普通表单两侧使用 `form_inst_id`，均等于触发事件字段 `__masterdata_form_inst_id` |
| `--get-self-field <field>` | `__masterdata_form_inst_id` | 覆盖右侧触发事件系统字段；仅在确认环境变量名不同后使用 |
| `--get-self-query-field <field>` | 自动按来源表单类型选择 | 覆盖左侧查询系统字段；流程表单运行态使用 `pid` / `流程实例ID`、设计器使用 `proc_inst_id`，普通表单两侧使用 `form_inst_id` / `表单实例ID`；仅在确认平台字段名不同后使用 |
| `--data-form-uuid <formUuid>` | 不启用 | 获取单条数据节点的目标表单 UUID（B 表单），传入后在触发节点和通知节点之间插入 GetSingleDataNode |
| `--data-condition <bFieldId:bFieldName:aFieldId[:componentType[:opCode[:valueType]]]>` | 无 | 获取单条数据节点的“按条件过滤”；左侧目标表字段，右侧触发记录字段，字段用 `processVar`（默认），固定值显式用 `literal`；组件默认 `TextField`，操作符默认 `Contain`。数字比较别名自动转换为原生码；多节点引用用 spec，详见 [取数字段筛选](../../yida-flow-node-config/references/conditions-variables.md#获取数据节点按条件过滤--字段) |
| `--add-data-form-uuid <formUuid>` | 不启用 | 新增数据节点的目标表单 UUID，传入后在通知节点之后插入 AddDataNode；目标必须是普通表单（如 `formType=receipt`），不能是流程表单（`formType=process`） |
| `--add-data-assignment <targetFieldId:valueType:value>` | 无 | 新增数据的字段赋值，可多次传入；格式：`目标字段ID:valueType:value`，valueType 可选 `processVar`（引用触发表单字段）/ `literal`（固定值）/ `column`（公式） |
| `--initiate-approval-form-uuid <formUuid>` | 不启用 | 发起审批节点的目标流程表单 UUID；当 B 是流程表单（`formType=process`）时必须使用它，不要用 `--add-data-form-uuid` |
| `--initiate-approval-initiator-user <userId[:name]>` | 无 | 发起审批的发起人，推荐格式 `01376266634908:张三`；只传 userId 时设计器中会显示原始 ID。使用发起审批节点时必填 |
| `--initiate-approval-assignment <targetFieldId:valueType:value>` | 无 | 发起审批时写入目标流程表单字段的赋值规则，可多次传入；格式同 `--add-data-assignment` |
| `--connector-id <id>` | 空 | 真实连接器 ID，必须与 `--action-id` 同传 |
| `--action-id <id>` | 空 | 该连接器的真实动作 ID，参数以平台发现的 action schema 为准 |
| `--connector-name <name>` | 连接器 | 节点显示名称 |
| `--connector-assignment <path:valueType:value>` | 空 | 按真实输入 schema 赋值，可重复；嵌套参数使用完整路径，值类型为 `literal/processVar/column` |
| `--connector-mode <mode>` | 自动推断 | 连接器类型；HTTP 自定义连接器使用 `5`，`connectorId` 以 `Http_` 开头时会自动按 `5` 处理 |
| `--connection-id <id>` | 空 | HTTP 连接器鉴权连接 ID；HTTP 连接器建议传入，否则设计器右侧配置面板可能无法加载连接实例详情 |
| `--connector-display-name <name>` | `--connector-name` | 连接器展示名称，用于设计器画布和右侧配置面板 |
| `--connector-inputs <file>` | 禁止 | 调用方文件不是平台证据；CLI 会拒绝并要求只读发现或固定已证 preset |
| `--connector-system-token-app <appType>` | 空 | 为宜搭官方 OpenAPI 安全绑定目标应用 `systemToken`；只适用于 HTTPS 官方域名且 Action 唯一声明 `body.systemToken` |
| `--publish` | 不发布 | 加此标志则保存后立即发布（开启状态），否则仅保存为草稿 |
| `--flow-types <types>` | `1,2,3,5,6` | 仅用于 `integration list`，按逗号过滤触发类型；默认枚举全部已知类型，每条结果返回 `flowType` |

`--receivers` 必须填写目标组织的真实 userId，不是姓名。通知节点至少配置成员、角色或成员字段中的一类接收来源；纯数据链路不强制添加通知节点。

### 示例

```bash
# 整图替换已有自动化
openyida integration create APP_XXX FORM-XXX "替换已有自动化" \
  --process-code LPROC-XXX \
  --replace \
  --spec .cache/openyida/<项目名或任务名>/integration/desired-spec.json

# 最简用法：表单新增时通知指定用户，仅保存草稿
openyida integration create APP_XXX FORM-XXX "新增记录通知" \
  --receivers user123 \
  --title "有新记录提交" \
  --content "表单有新记录提交，请及时处理。"

# 引用表单字段变量，保存并发布
openyida integration create APP_XXX FORM-XXX "记录变更通知" \
  --receivers user123,user456 \
  --title "记录变更：#{textField_abc-TextField}#" \
  --content "内容：#{textField_abc-TextField}#" \
  --events insert,update,delete,comment \
  --publish

# 带获取单条数据节点：触发时从 B 表单获取匹配记录，再发送通知
# --data-condition 格式：B表单字段ID:B表单字段名:A表单字段ID[:组件类型[:opCode[:valueType]]]
# 可多次传入 --data-condition 添加多个过滤条件
openyida integration create APP_XXX FORM-A-XXX "跨表通知" \
  --receivers user123 \
  --title "关联记录变更：#{textField_a1-TextField}#" \
  --content "B表单数据已更新，请查看。" \
  --events insert,update \
  --data-form-uuid FORM-B-XXX \
  --data-condition "textField_b1:B表单姓名字段:textField_a1:TextField" \
  --publish

# 获取自身：触发后重新读取当前记录，避免流水号、定时值或触发 payload 不是最新值
openyida integration create APP_XXX FORM-A-XXX "获取自身后通知" \
  --title "记录已提交" \
  --content "已按表单实例ID重新读取当前记录。" \
  --events insert,update \
  --get-self \
  --publish

# 带新增数据节点：触发时将 A 表单数据同步到 B 表单，并发送通知
# --add-data-assignment 格式：目标字段ID:valueType:value
# valueType 可选：processVar（引用触发表单字段）、literal（固定值）、column（公式）
# 可多次传入 --add-data-assignment 添加多个字段赋值
openyida integration create APP_XXX FORM-A-XXX "表单A新增后同步到表单B并通知" \
  --receivers user123 \
  --title "数据已同步" \
  --content "表单A新增了一条记录，已自动同步到表单B。" \
  --add-data-form-uuid FORM-B-XXX \
  --add-data-assignment "textField_b1:processVar:textField_a1" \
  --add-data-assignment "numberField_b2:literal:0" \
  --add-data-assignment "textareaField_b3:column:CONCATENATE(#{textField_a1},#{textField_a2})" \
  --publish

# A 流程审批完成后，发起 B 流程审批（B 是流程表单时使用）
openyida integration create APP_XXX FORM-A-XXX "A审批完成后发起B流程" \
  --events processFinish \
  --approval-actions agree \
  --get-self \
  --initiate-approval-form-uuid FORM-PROCESS-B-XXX \
  --initiate-approval-initiator-user "01376266634908:张三" \
  --initiate-approval-assignment "textField_b1:processVar:textField_a1" \
  --initiate-approval-assignment "textareaField_b2:literal:自动发起" \
  --publish

# 调用 HTTP 自定义连接器动作，并保留设计器右侧面板所需的连接器元信息
openyida integration create APP_XXX FORM-A-XXX "调用 HTTP 连接器" \
  --connector-id Http_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --action-id publish_month_qs \
  --connection-id 28336 \
  --connector-display-name "BI 后端" \
  --connector-assignment "month:processVar:textField_month" \
  --publish

# 调用需要 systemToken 的宜搭 OpenAPI；凭据由 CLI 内部读取，不写入命令参数
openyida integration create APP_XXX FORM-A-XXX "服务端调用宜搭 OpenAPI" \
  --connector-id Http_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --action-id query_yida_data \
  --connector-system-token-app APP_TARGET \
  --connector-assignment "formUuid:literal:FORM_TARGET" \
  --publish
```

## 查询、启停与异常日志

- `integration list` 默认枚举 `1/2/3/5/6`，逐项返回 `flowType`；读取全部应用分组分页，分组 `hasMore=true` 时继续读取表单下剩余逻辑流，不能把一页当全量。
- `enable/disable` 后必须精确回读 `formUuid + processCode` 唯一目标及 `status=y/n`，并确认详情非空；身份冲突、缺失、状态不符或详情失败均不能宣称启停成功。
- `check` 分页盘点逻辑流并按 `status=2` 查询执行异常，返回 `totalFlows/abnormalFlows`、Code、名称、触发表单和日志。JSON、Excel、文本输出均附诊断建议；进度按单行输出。
- `--output <file.xlsx>` 按应用分 sheet，分别记录异常、无异常或检查失败原因。无异常日志不代表查询命中、分支执行或目标写入正确。
- `diagnose --text/--file` 可离线分析异常文本、OCR 文本或日志，不要求登录态。
- 缺失参数、节点格式错误或未知错误时停止并展示详情；登录／权限问题用 `openyida auth status` 核对，按 CLI 提示刷新或重新登录。不根据 HTTP 200 推断业务成功。
- 只读查询遇到网络超时可重试一次，仍失败停止；任何写入超时或结果未知必须先只读核对，禁止直接重放创建、保存或发布。

```bash
openyida integration check APP_XXX APP_YYY --output project/output/自动化异常.xlsx
openyida integration diagnose --text "连接器异常：接口参数异常"
openyida integration diagnose --file project/tickets/automation-error.txt --json
```
