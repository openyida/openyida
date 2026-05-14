---
name: yida-process-rule
description: 宜搭流程规则配置技能，通过调用流程设计器 API 实现流程的创建、配置（条件分支、嵌套分支、审批节点、字段权限、抄送节点、跳转规则）、保存和发布。不适用于：从零创建流程表单（应使用 yida-create-process），或配置集成自动化逻辑流（应使用 yida-integration）。
---

# 宜搭流程规则配置技能

## 严格禁止 (NEVER DO)

- 不要在流程定义中使用猜测的 fieldId，必须先用 `yida-get-schema` 获取
- 不要在未读取本 SKILL.md 的情况下编写流程定义 JSON，格式复杂且易出错
- 不要用此技能创建流程表单，应使用 `yida-create-process`

## 严格要求 (MUST DO)

- **发布前必须确认**：执行流程发布操作前，必须向用户展示流程配置摘要（节点数、审批人、条件分支），获得用户明确同意后再发布
- 字段 ≥ 3 且审批节点 ≥ 2 时，必须为每个节点配置字段权限
- 存在回退/循环语义时，必须配置 `routeRules` 跳转规则
- 配置前先用 `yida-get-schema` 获取所有字段 ID
- 流程定义 JSON 必须写入 `.cache/openyida/<项目名>/`，不要在仓库根目录生成 `process-definition.json` 等临时文件

## 适用场景

| 用户意图 | 触发条件 |
|---------|---------|
| 配置/修改审批流程 | "配置审批"、"审批节点"、"条件分支"、"字段权限" |
| 从零创建流程表单 | → 改用 `yida-create-process` |

## 触发条件

**正向触发**：
- "配置审批流程"、"设置审批节点"、"配置条件分支"
- "设置字段权限"、"配置抄送节点"、"设置跳转规则"
- 已有流程表单（processCode 已知），需要修改或配置审批规则
- `yida-create-process` 完成后，需要进一步配置复杂流程规则

**不适用场景（不要触发）**：
- 从零创建流程表单（新建表单 + 配置流程一步到位）→ `yida-create-process`
- 配置集成自动化逻辑流 → `yida-integration`

---


## 概述

本技能描述如何通过流程设计器 API 为宜搭流程表单配置审批流程。支持审批节点、条件分支、嵌套分支、字段权限、抄送节点、跳转规则等完整的流程配置能力。

## 何时使用

当以下场景发生时使用此技能：
- 用户需要为已有的流程表单配置审批流程
- 用户需要修改已有流程的审批规则
- 用户需要配置条件分支、嵌套分支等复杂流程
- 已通过 `yida-create-form-page` 创建表单后，需要配置流程规则

## 与 yida-create-process 的区别

| 场景 | 使用技能 |
|------|---------|
| **已有流程表单**：只需修改/配置已有表单的审批流程规则 | **本技能（yida-process-rule）** |
| **从零创建**：需要新建表单 + 配置审批流程（一步到位） | **yida-create-process** |

> 简单判断：有没有现成的流程表单？有 → 本技能；没有 → `yida-create-process`。

## 使用方式

```bash
openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]
```

**参数说明**：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `formUuid` | 是 | 表单 UUID，如 `FORM-XXX` |
| `processDefinitionFile` | 是 | 流程定义 JSON 文件路径 |
| `processCode` | 否 | 流程 Code，如 `TPROC--XXX`。不传则自动获取 |

**示例**：

```bash
openyida configure-process "APP_XXX" "FORM-YYY" .cache/openyida/order/process-definition.json
```

**输出**：日志输出到 stderr，JSON 结果输出到 stdout：

```json
{
  "success": true,
  "processCode": "TPROC--XXX",
  "processId": "83145794990",
  "processVersion": 2,
  "appType": "APP_XXX",
  "formUuid": "FORM-YYY"
}
```

## 流程定义 JSON 格式

流程定义文件描述审批流程的节点结构，脚本会自动转换为宜搭平台需要的 `processJson` 和 `viewJson`。

### 节点类型

| 类型 | 说明 | 必填属性 |
| --- | --- | --- |
| `approval` | 审批节点 | `name`, `approver` |
| `route` | 条件分支路由 | `conditions` |
| `carbon` | 抄送节点 | `name`, `approver` |

### 审批节点属性

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | String | 是 | 固定 `"approval"` |
| `name` | String | 是 | 节点名称 |
| `approver` | String | 是 | 审批人，目前支持 `"originator"`（发起人） |
| `description` | String | 否 | 节点描述 |
| `formConfig` | Object | 否 | 字段权限配置 |
| `routeRules` | Array | 否 | 跳转规则 |

### 条件分支属性

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | String | 是 | 固定 `"route"` |
| `conditions` | Array | 是 | 条件列表 |

### 条件定义

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | String | 是 | 条件名称 |
| `rules` | Array | 是 | 条件规则列表 |
| `logic` | String | 否 | 规则逻辑，`"AND"`（默认）或 `"OR"` |
| `childNodes` | Array | 否 | 条件满足时执行的子节点列表 |

### 条件规则

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `fieldId` | String | 是 | 字段 ID，如 `selectField_xxx` |
| `fieldName` | String | 是 | 字段名称 |
| `op` | String | 是 | 操作符 |
| `value` | String/Array | 是 | 比较值 |
| `componentType` | String | 是 | 字段组件类型 |

### 支持的操作符

| 操作符 | 说明 | 适用类型 |
| --- | --- | --- |
| `Equal` | 等于 | 所有类型 |
| `NotEqual` | 不等于 | 所有类型 |
| `Contains` | 包含 | TextField |
| `NotContain` | 不包含 | TextField |
| `IsEmpty` | 为空 | 所有类型 |
| `IsNotEmpty` | 不为空 | 所有类型 |
| `GreaterThan` | 大于 | NumberField |
| `GreaterThanOrEqual` | 大于等于 | NumberField |
| `LessThan` | 小于 | NumberField |
| `LessThanOrEqual` | 小于等于 | NumberField |
| `In` | 属于 | SelectField, RadioField |
| `NotIn` | 不属于 | SelectField, RadioField |

### 字段权限配置（formConfig）

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
| --- | --- |
| `NORMAL` | 可编辑 |
| `READONLY` | 只读 |
| `HIDDEN` | 隐藏 |

### 跳转规则（routeRules）

```json
{
  "routeRules": [
    { "when": "disagree", "jumpTo": "部门主管审核" }
  ]
}
```

`jumpTo` 的值为目标审批节点的 `name`，或 `"结束"` 表示跳到流程结束。

## AI 自动生成流程特性（必须遵守）

> 📖 AI 生成流程定义的完整规范（字段权限自动生成、回退规则识别、检查清单）详见 [references/process-ai-rules.md](references/process-ai-rules.md)。

---

## 使用示例

### 示例 1：简单审批流程

```json
{
  "nodes": [
    {
      "type": "approval",
      "name": "主管审批",
      "approver": "originator"
    }
  ]
}
```

流程：`发起 → 主管审批 → 结束`

> 📖 更多示例（条件分支、嵌套分支、字段权限、跳转规则、自定义详情页等）详见 [references/examples.md](references/examples.md)。

## 注意事项

- 所有 `fieldId` 必须通过 `openyida get-schema` 获取，不能手写猜测
- 条件分支的 `conditionNodes` 最后一个节点必须是 `else`（`conditionType: "else"`）
- 嵌套分支不超过 3 层
- 流程发布前必须先保存
- **本技能不读写 memory**：流程定义通过 CLI 命令写入宜搭平台，processCode 等信息输出到 stdout，不依赖跨会话的 memory 状态

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 流程保存失败 | 检查 processCode 是否正确，确认登录态有效 |
| 条件分支报错 | 确认最后一个 conditionNode 的 `conditionType` 为 `"else"` |
| fieldId 不存在 | 先执行 `openyida get-schema` 获取真实 fieldId，不能手写猜测 |
| 流程发布后未生效 | 确认已执行发布步骤（save 后还需 publish），检查流程版本 |
| 嵌套分支超过 3 层 | 重新设计流程结构，将复杂条件拆分为多个节点 |
## 前置依赖

- Node.js ≥ 16
- 项目根目录存在 `.cache/cookies.json`（首次运行会自动触发扫码登录）

## 文件结构

```
yida-process-rule/
└── SKILL.md                    # 本文档
```

## 与其他技能配合

| 步骤 | 技能 | 说明 |
| --- | --- | --- |
| 1 | `yida-create-app` | 创建应用，获取 `appType` |
| 2 | `yida-create-form-page` | 创建表单，获取 `formUuid` 和字段 ID |
| 3 | **本技能** | 配置表单的流程规则 |
| 4 | `yida-custom-page` | 编写自定义页面代码 |
| 5 | `yida-publish-page` | 发布自定义页面 |

> **快捷方式**：使用 `yida-create-process` 技能可一键完成步骤 2-3（创建表单 + 配置流程）。
