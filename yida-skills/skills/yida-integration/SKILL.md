---
name: yida-integration
description: 宜搭集成&自动化配置技能。支持创建/查询/开启/关闭集成自动化，包括消息通知、新增数据、获取数据、更新数据、条件分支等节点。不适用于：配置审批流程（应使用 yida-process-rule），或直接操作表单数据（应使用 yida-data-management）。
---

# yida-integration — 宜搭集成&自动化（逻辑流）技能

## 严格禁止 (NEVER DO)

- 不要在未读取本 SKILL.md 的情况下编写逻辑流定义，节点格式复杂且易出错
- 不要编造 formUuid 或 fieldId，必须从已有记录或 `yida-get-schema` 获取
- 不要用此技能配置审批流程，应使用 `yida-process-rule`

## 严格要求 (MUST DO)

- **创建/发布前必须确认**：执行集成自动化创建或发布操作前，必须向用户展示逻辑流配置摘要（触发条件、节点列表、通知对象），获得用户明确同意后再执行
- 创建前先确认触发表单的 formUuid 和相关字段 ID
- 创建成功后记录逻辑流 ID 到 `.cache/<项目名>-schema.json`

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 表单提交后自动通知 | "自动通知"、"数据变更触发"、"集成&自动化" |
| 数据操作自动化 | "自动新增"、"自动更新"、"逻辑流" |
| 人工审批流程 | → 改用 `yida-process-rule` |

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| formUuid 不存在 | 不得编造，必须从已有记录或 `yida-get-schema` 获取 |
| 逻辑流创建失败 | 检查节点配置格式，确认触发表单和目标表单存在 |
| 通知接收人为空 | 必须指定至少一个 userId，不得留空 |
| 变量引用格式错误 | 确认使用 `#{fieldId-ComponentType}#` 格式 |
| 发布失败 | 检查逻辑流配置完整性，确认登录态有效 |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试或调整参数 |
| 参数缺失（appType/formUuid/userId 等） | 主动询问用户补充，不得猜测或编造 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida auth status` 检查登录态 |
| 节点配置格式错误 | 停止执行，展示错误详情，引导用户参照文档修正配置 |
| 网络超时 | 重试 1 次，仍失败则停止并提示用户检查网络 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |

---


本技能用于在宜搭平台创建「集成&自动化」（逻辑流），支持场景：**表单事件触发 → 多节点组合处理 → 钉钉工作通知 / 数据操作**。

## 功能概述

- 监听指定表单的新增 / 更新 / 删除 / 评论事件
- 可选：从另一张表单获取单条数据，支持按触发表单字段值过滤
- 可选：向指定表单新增数据，支持字段赋值（含公式）
- 可选：更新指定表单数据（按节点查询结果或条件过滤）
- 可选：条件分支，根据上游节点数据有无 / 字段值走不同分支
- 通知内容和标题支持引用表单字段变量（`#{fieldId-ComponentType}#` 格式）
- 支持保存为草稿（未开启状态）或直接发布（开启状态）

## 命令格式

```bash
openyida integration create <appType> <formUuid> <flowName> [选项]
```

### 参数说明

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `appType` | 是 | 应用 ID，如 `APP_XXXX` |
| `formUuid` | 是 | 触发表单 UUID，如 `FORM-XXXX` |
| `flowName` | 是 | 逻辑流名称 |

### 选项说明

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `--process-code <code>` | 自动生成 | 已有逻辑流的 processCode（`LPROC-xxx` 格式），不传则自动生成 |
| `--receivers <userId,...>` | 空（无接收人） | 接收钉钉工作通知的用户 ID，多个用逗号分隔 |
| `--title <title>` | 同 flowName | 通知标题，支持 `#{fieldId-ComponentType}#` 引用表单字段 |
| `--content <content>` | `"表单有新记录提交，请及时查看。"` | 通知内容，支持 `#{fieldId-ComponentType}#` 引用表单字段 |
| `--events <insert,update>` | `insert` | 触发事件，可选值：`insert`/`update`/`delete`/`comment`（也支持别名 `create`），多个用逗号分隔 |
| `--data-form-uuid <formUuid>` | 不启用 | 获取单条数据节点的目标表单 UUID（B 表单），传入后在触发节点和通知节点之间插入 GetSingleDataNode |
| `--data-condition <bFieldId:bFieldName:aFieldId[:componentType]>` | 无 | 获取单条数据的过滤条件，可多次传入；格式：`B表单字段ID:B表单字段名:A表单字段ID[:组件类型]`，组件类型默认 `TextField` |
| `--add-data-form-uuid <formUuid>` | 不启用 | 新增数据节点的目标表单 UUID，传入后在通知节点之后插入 AddDataNode |
| `--add-data-assignment <targetFieldId:valueType:value>` | 无 | 新增数据的字段赋值，可多次传入；格式：`目标字段ID:valueType:value`，valueType 可选 `processVar`（引用触发表单字段）/ `literal`（固定值）/ `column`（公式） |
| `--publish` | 不发布 | 加此标志则保存后立即发布（开启状态），否则仅保存为草稿 |

### 示例

```bash
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
# --data-condition 格式：B表单字段ID:B表单字段名:A表单字段ID[:组件类型]
# 可多次传入 --data-condition 添加多个过滤条件
openyida integration create APP_XXX FORM-A-XXX "跨表通知" \
  --receivers user123 \
  --title "关联记录变更：#{textField_a1-TextField}#" \
  --content "B表单数据已更新，请查看。" \
  --events insert,update \
  --data-form-uuid FORM-B-XXX \
  --data-condition "textField_b1:B表单姓名字段:textField_a1:TextField" \
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
```

## 字段变量引用格式

在通知标题和内容中，可以使用 `#{fieldId-ComponentType}#` 格式引用触发表单的字段值：

```
#{textField_mmq4ldti-TextField}#
#{numberField_abc123-NumberField}#
#{selectField_xyz-SelectField}#
```

- `fieldId`：字段 ID（可通过 `yida-get-schema` 技能查询）
- `ComponentType`：字段组件类型（如 `TextField`、`NumberField`、`SelectField` 等）

## 输出结果

命令执行成功后，向 stdout 输出 JSON：

```json
{
  "success": true,
  "published": false,
  "processCode": "LPROC-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "flowName": "新增记录通知",
  "appType": "APP_XXX",
  "formUuid": "FORM-XXX",
  "formEventTypes": ["insert"]
}
```

加 `--publish` 后 `published` 为 `true`。若发布失败，`published` 为 `false` 并附带 `warning` 字段说明原因。

## 调用流程

1. 读取 `.cache/cookies.json` 获取登录态（不存在则触发扫码登录）
2. 若未传入 `--process-code`，调用 `createLogicflow.json` 接口新建绑定关系，获取真实 `processCode`
3. 生成各节点 ID（`node_xxx` 格式，随机生成）
4. 根据用户传入的节点配置，构建 `json` 参数（节点定义）和 `viewJson` 参数（画布 Schema）
5. 调用 `saveProcess` 接口（`isOnline=false`）保存为草稿
6. 若指定 `--publish`，再次调用 `saveProcess` 接口（`isOnline=true`）发布生效

> ⚠️ **必须先调用 `createLogicflow.json` 新建绑定关系**，再调用 `saveProcess` 写入内容。直接调用 `saveProcess` 无法创建新逻辑流，只能覆盖更新已有逻辑流。

## 逻辑流节点结构

复杂节点 JSON 不再内联在主技能中，避免每次触发都占用大量上下文。需要手写或排查节点结构时，只读取对应参考文档：

- 节点类型速查、trigger / sendMessage / dataCreate / dataRetrieve / dataUpdate / route + condition 完整结构： [references/integration-node-schemas.md](references/integration-node-schemas.md)
- 常见创建示例： [references/examples.md](references/examples.md)

快速链路：

```text
trigger -> sendMessage -> finish
trigger -> dataRetrieve -> sendMessage -> finish
trigger -> sendMessage -> dataCreate -> finish
trigger -> dataRetrieve -> route -> condition -> dataUpdate/dataCreate -> finish
```

读取规则：

- 仅使用 CLI 选项创建标准通知、查询、新增数据链路时，不需要展开节点 JSON 参考。
- 需要自定义复杂分支、更新数据、排查 saveProcess payload 时，再读取 `integration-node-schemas.md`。
- 需要给用户展示示例命令时，优先读取 `examples.md`。

## 变量引用与字段赋值

> 📖 字段赋值 valueType 规律和变量引用格式对照详见 [references/integration-node-schemas.md](references/integration-node-schemas.md)。

## 接口说明

> 📖 saveProcess、listLogicflows、switchLogicflow 接口的完整参数和返回值结构详见 [references/integration-node-schemas.md](references/integration-node-schemas.md)。

## 前置依赖

- Node.js
- 项目根目录存在 `.cache/cookies.json`（首次运行会自动触发扫码登录）

## 文件结构

```
lib/
└── integration/
    └── integration-create.js    # integration create 子命令实现
```

## 与其他技能配合

1. **创建应用** → 使用 `yida-create-app` 技能获取 `appType`
2. **创建表单页面** → 使用 `yida-create-form-page` 技能获取 `formUuid`
3. **查询字段 ID** → 使用 `yida-get-schema` 技能获取 `fieldId` 和 `ComponentType`，用于构建字段变量引用
4. **创建集成&自动化** → 本技能，传入 `appType` 和 `formUuid`
5. **公式计算** → 当需要在赋值中使用复杂公式（如 `CONCATENATE`、`IF`、`SUM` 等）时，参考 `yida-formula` 技能（独立技能，待完善）；目前已支持基础公式：
   - 字符串拼接：`CONCATENATE(#{fieldId_a},#{fieldId_b})`
   - 数值运算：`${nodeId}.numberField_xxx+1`

## 触发条件

**正向触发**：
- "配置集成自动化"、"数据联动"、"自动触发"
- "表单提交后自动发消息"、"自动新增数据"
- "配置逻辑流"、"自动化规则"

**不适用场景（不要触发）**：
- 配置审批流程 → `yida-process-rule`
- 直接操作表单数据（增删改查）→ `yida-data-management`
- 配置 HTTP 连接器 → `yida-connector`

## 注意事项

- `--receivers` 填写的是宜搭/钉钉用户 ID（`userId`），不是姓名
- 触发事件使用 API 内部名称：`insert`（新增）、`update`（更新）、`delete`（删除）、`comment`（评论），也支持别名 `create`
- `processCode` 格式为 `LPROC-` 加 38 位大写字母数字，不传则自动随机生成
- 保存（草稿）和发布使用**同一个接口** `saveProcess`，通过 `isOnline` 参数区分
- 错误码处理：接口返回 `errorCode: "TIANSHU_000030"`（csrf 校验失败）时，脚本会自动刷新 token 后重试；`errorCode: "307"`（登录过期）时，会自动重新登录后重试
- **本技能不读写 memory**：集成逻辑流配置通过 CLI 命令写入宜搭平台，processCode 等信息输出到 stdout，不依赖跨会话的 memory 状态
