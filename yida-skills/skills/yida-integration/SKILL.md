---
name: yida-integration
description: 宜搭集成&自动化（逻辑流）技能，用于在宜搭平台创建「集成&自动化」逻辑流，支持表单事件触发、多节点组合处理（消息通知/数据新增/查询/更新/条件分支）等场景。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-integration
  version: 1.0.0
  tags:
    - yida
    - integration
    - automation
    - logicflow
    - notification
---

# yida-integration — 宜搭集成&自动化（逻辑流）技能

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

### 节点类型速查

| 节点名称 | `json` 中的 `type` | `viewJson` 中的 `componentName` |
| --- | --- | --- |
| 触发节点 | `trigger` | `StartNode` |
| 消息通知节点 | `sendMessage` | `SendMessageNode` |
| 新增数据节点 | `dataCreate` | `AddDataNode` |
| 获取单条数据节点 | `dataRetrieve` | `GetSingleDataNode` |
| 更新数据节点 | `dataUpdate` | `UpdateDataNode` |
| 条件分支容器 | `route` | `ConditionContainer` |
| 条件分支子节点 | `condition` | `ConditionNode` |
| 结束节点 | `finish` | `EndNode` |

### 典型链路示例

**最简通知流（3 个节点）：**
```
trigger → sendMessage → finish
```

**跨表查询后通知（4 个节点）：**
```
trigger → dataRetrieve → sendMessage → finish
```

**复杂流（含新增、查询、条件分支、更新/新增）：**
```
trigger
  → sendMessage（通知）
  → dataCreate（新增表单B数据）
  → dataRetrieve（获取表单C单条数据）
  → route（条件分支）
      ├─ condition（条件1：C有数据）→ dataUpdate（更新C的字段）→ finish
      └─ condition（其他情况，isDefault=true）→ dataCreate（新增C数据）→ finish
```

---

### 各节点 JSON 结构详解

#### 触发节点（trigger）

```json
{
  "type": "trigger",
  "nodeId": "node_xxx",
  "nextId": ["node_yyy"],
  "props": {
    "inputs": {
      "formEventType": ["insert"],
      "formUuid": "FORM-XXX",
      "conditions": null,
      "activityAction": [],
      "triggerFormEventRecursively": true
    },
    "triggerType": "FormEvent"
  }
}
```

- `formEventType`：触发事件数组，可选值：`insert`（新增）、`update`（修改）、`delete`（删除）、`comment`（评论）
- `triggerFormEventRecursively`：固定 `true`

---

#### 消息通知节点（sendMessage）

```json
{
  "type": "sendMessage",
  "nodeId": "node_xxx",
  "props": {
    "messageType": "NORMAL",
    "messageInfo": {
      "title": "标题：#{textField_abc-TextField}#",
      "content": "内容：#{textField_xyz-TextField}#",
      "buttons": [
        {
          "name": "查看详情",
          "type": "commit",
          "value": "//yidalogin.aliwork.com/{appType}/formDetail/{formUuid}?formInstId=${formInstId}",
          "buttonUuid": "button-XXXX"
        }
      ]
    },
    "appType": "APP_XXX",
    "toRoles": [],
    "toUsers": [
      { "userId": "0162193625672514", "userName": "张三" }
    ],
    "userFields": ["employeeField_abc"]
  }
}
```

- `toUsers`：指定接收人（userId + userName），可为空数组
- `userFields`：引用触发表单中的成员字段 ID，该字段的值也会收到通知
- 标题/内容中引用字段变量格式：`#{fieldId-ComponentType}#`（注意带组件类型后缀）
- 按钮 URL 中用 `${formInstId}` 引用当前触发的表单实例 ID

---

#### 新增数据节点（dataCreate）

```json
{
  "type": "dataCreate",
  "nodeId": "node_xxx",
  "props": {
    "formUuid": "FORM-目标表单",
    "appType": "APP_XXX",
    "subFormUuid": "",
    "insertType": "form",
    "type": "single",
    "sourceId": "",
    "assignments": [
      {
        "column": "textField_目标字段",
        "valueType": "processVar",
        "value": "textField_触发表单字段",
        "assignments": []
      },
      {
        "column": "textareaField_目标字段",
        "valueType": "column",
        "value": "CONCATENATE(#{textField_a},#{textField_b})",
        "assignments": []
      },
      {
        "column": "numberField_目标字段",
        "valueType": "literal",
        "value": 0,
        "assignments": []
      }
    ]
  }
}
```

---

#### 获取单条数据节点（dataRetrieve）

```json
{
  "type": "dataRetrieve",
  "nodeId": "node_xxx",
  "props": {
    "type": "single",
    "filterType": "condition",
    "sort": { "type": "none", "column": "" },
    "sourceId": "FORM-目标表单",
    "appType": "APP_XXX",
    "originalType": "form",
    "subSourceId": "",
    "condition": {
      "condition": "AND",
      "rules": [
        {
          "id": "employeeField_目标表单字段",
          "op": "等于任意一个",
          "opCode": "In",
          "value": "employeeField_触发表单字段",
          "componentType": "EmployeeField",
          "extValue": "processVar",
          "ruleValue": "employeeField_触发表单字段",
          "valueType": "processVar",
          "multiple": false,
          "ruleType": "rule_text"
        }
      ],
      "conditionCode": "&&"
    },
    "quantity": "1",
    "assignments": []
  }
}
```

- `quantity: "1"` 表示只取一条
- 过滤条件中 `extValue: "processVar"` 表示右侧值来自触发表单的流程变量
- 该节点的 `nodeId`（如 `node_ocmmzsdai63`）在后续节点中通过 `${nodeId}.fieldId` 引用其查询结果

---

#### 更新数据节点（dataUpdate）

```json
{
  "type": "dataUpdate",
  "nodeId": "node_xxx",
  "props": {
    "type": "node",
    "sourceId": "node_上游dataRetrieve节点ID",
    "subSourceId": "",
    "condition": {},
    "subCondition": {},
    "assignments": [
      {
        "column": "numberField_目标字段",
        "valueType": "column",
        "value": "${node_上游节点ID}.numberField_目标字段+1",
        "__display": "获取单条数据.通知次数+1",
        "__source": "#{node_上游节点ID//numberField_目标字段}+1"
      }
    ],
    "noneOperation": "ignored",
    "rulesFilter": [],
    "tableRulesFilter": []
  }
}
```

- `type: "node"` 表示更新来源是上游节点查询到的那条记录（无需额外过滤条件）
- `sourceId` 填写上游 `dataRetrieve` 节点的 `nodeId`
- `__display` 和 `__source` 仅用于前端展示，不影响执行逻辑

---

#### 条件分支节点（route + condition）

条件分支由一个 `route` 容器节点 + 多个 `condition` 子节点组成：

```json
{
  "type": "route",
  "nodeId": "node_route",
  "nextId": ["node_cond1", "node_cond2"],
  "props": { "outgoingType": "priority" },
  "childNodes": [
    {
      "type": "condition",
      "nodeId": "node_cond1",
      "prevId": "node_route",
      "nextId": ["node_操作节点"],
      "props": {
        "priority": 1,
        "isDefault": false,
        "conditions": {
          "condition": "AND",
          "rules": [
            {
              "id": "${node_上游节点ID}.employeeField_字段",
              "op": "有值",
              "opCode": "ExistValue",
              "componentType": "EmployeeField",
              "extValue": "value",
              "valueType": "literal",
              "multiple": false,
              "ruleType": "rule_text"
            }
          ],
          "conditionCode": "&&"
        },
        "calculate": "condition"
      },
      "childNodes": [
        { "type": "dataUpdate", "nodeId": "node_操作节点", ... }
      ]
    },
    {
      "type": "condition",
      "nodeId": "node_cond2",
      "prevId": "node_route",
      "nextId": ["node_操作节点2"],
      "props": {
        "priority": 2147483647,
        "isDefault": true
      },
      "childNodes": [
        { "type": "dataCreate", "nodeId": "node_操作节点2", ... }
      ]
    }
  ]
}
```

- `outgoingType: "priority"`：按优先级从上到下匹配，第一个满足条件的分支执行
- `priority: 1`：最高优先级（数字越小越优先）
- `isDefault: true` + `priority: 2147483647`：默认分支（其他情况），兜底执行
- 条件中引用上游节点数据：`"id": "${nodeId}.fieldId"`
- 常用 `opCode`：`ExistValue`（有值）、`NotExistValue`（无值）、`Equal`（等于）、`In`（等于任意一个）

---

## 字段赋值 valueType 规律总结

在 `assignments`（字段赋值）中，`valueType` 决定了 `value` 的解析方式：

| `valueType` | 含义 | `value` 格式示例 |
| --- | --- | --- |
| `processVar` | 引用触发表单的字段值 | `"textField_mmq4ldti"`（直接写字段 ID） |
| `literal` | 固定值（字符串/数字） | `"固定文本"` 或 `0` |
| `column` | 公式计算 | `"CONCATENATE(#{fieldId_a},#{fieldId_b})"` |
| `column` | 引用上游节点字段值 | `"${nodeId}.fieldId"` |
| `column` | 引用上游节点字段并运算 | `"${nodeId}.numberField_xxx+1"` |

> ⚠️ 公式中引用字段变量格式为 `#{fieldId}`（不带组件类型），与消息通知中的 `#{fieldId-ComponentType}#` 不同。

---

## 变量引用格式对照

| 使用场景 | 格式 | 示例 |
| --- | --- | --- |
| 消息通知标题/内容 | `#{fieldId-ComponentType}#` | `#{textField_abc-TextField}#` |
| 公式中引用触发表单字段 | `#{fieldId}` | `#{textField_abc}` |
| 赋值中引用触发表单字段 | `processVar` + `fieldId` | `valueType: "processVar", value: "textField_abc"` |
| 赋值中引用上游节点字段 | `column` + `${nodeId}.fieldId` | `"${node_xxx}.numberField_abc"` |
| 条件中引用上游节点字段 | `${nodeId}.fieldId`（作为 `id`） | `"id": "${node_xxx}.employeeField_abc"` |

## 接口说明

### saveProcess（保存 / 发布逻辑流）

> 保存和发布使用**同一个接口**，通过 `isOnline` 参数区分。

- **地址**：`POST /alibaba/web/{appType}/query/simpleProcess/saveProcess.json`
- **Content-Type**：`application/x-www-form-urlencoded`
- **参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_csrf_token` | String | 是 | CSRF Token |
| `formUuid` | String | 是 | 关联表单 UUID |
| `isLogic` | String | 是 | 固定 `"true"` |
| `isOnline` | String | 是 | `"false"`=保存草稿（未开启），`"true"`=发布生效（已开启） |
| `json` | String (JSON) | 是 | 节点定义 JSON 字符串 |
| `viewJson` | String (JSON) | 是 | 画布 Schema JSON 字符串 |
| `processCode` | String | 是 | 逻辑流唯一标识，格式 `LPROC-xxx`（自动生成或由用户传入） |
| `needReportLine` | String | 是 | 固定 `"y"` |

- **返回值**：

```json
{ "success": true }
```

---

### listLogicflows（查询逻辑流列表）

- **地址**：`GET /alibaba/web/{appType}/query/appLogicflowBinding/listflow.json`
- **Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `appType` | String | 是 | 应用 ID |
| `key` | String | 否 | 按自动化名称关键字模糊搜索，空字符串=不过滤 |
| `formUuid` | String | 否 | 按触发表单 UUID 过滤，空字符串=不过滤 |
| `status` | String | 否 | 按状态过滤：`y`=开启，`n`=关闭，空字符串=全部 |
| `pageIndex` | Number | 是 | 页码，从 1 开始 |
| `pageSize` | Number | 是 | 每页条数，**最大 10**（超出会报参数校验失败） |
| `type` | String | 是 | 固定 `"1"` |

- **返回值结构**：

```json
{
  "content": {
    "data": [
      {
        "formUuid": "FORM-XXX",
        "formTitle": "表单A",
        "flowList": [
          {
            "processCode": "LPROC-XXX",
            "name": "自动化名称",
            "status": "y",
            "formUuid": "FORM-XXX",
            "eventName": "表单创建成功",
            "lastAction": "启用",
            "gmtModified": "2026-03-21 15:00:00"
          }
        ]
      }
    ],
    "totalCount": 3,
    "hasMore": false
  }
}
```

> ⚠️ `totalCount` 是表单分组数（不是自动化总数），每个分组内的 `flowList` 才是具体的自动化列表。

---

### switchLogicflow（开启 / 关闭逻辑流）

- **地址**：`POST /alibaba/web/{appType}/query/formLogicflowBinding/switchflow.json`
- **Content-Type**：`application/x-www-form-urlencoded`
- **参数**：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `_csrf_token` | String | 是 | CSRF Token |
| `processCode` | String | 是 | 逻辑流唯一标识（`LPROC-xxx` 格式） |
| `formUuid` | String | 是 | 触发表单 UUID |
| `enable` | String | 是 | `"y"`=开启，`"n"`=关闭 |
| `type` | String | 是 | 固定 `"1"` |

- **返回值**：

```json
{
  "content": {
    "processCode": "LPROC-XXX",
    "name": "自动化名称",
    "status": "n"
  },
  "success": true
}
```

> ⚠️ 若目标逻辑流已处于目标状态（如已关闭再次关闭），接口仍返回 `success: true`，不会报错。

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

## 注意事项

- `--receivers` 填写的是宜搭/钉钉用户 ID（`userId`），不是姓名
- 触发事件使用 API 内部名称：`insert`（新增）、`update`（更新）、`delete`（删除）、`comment`（评论），也支持别名 `create`
- `processCode` 格式为 `LPROC-` 加 38 位大写字母数字，不传则自动随机生成
- 保存（草稿）和发布使用**同一个接口** `saveProcess`，通过 `isOnline` 参数区分
- 错误码处理：接口返回 `errorCode: "TIANSHU_000030"`（csrf 校验失败）时，脚本会自动刷新 token 后重试；`errorCode: "307"`（登录过期）时，会自动重新登录后重试
