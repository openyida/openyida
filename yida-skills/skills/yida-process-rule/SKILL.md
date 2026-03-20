---
name: yida-process-rule
description: 宜搭流程规则配置技能，通过调用流程设计器 API 实现流程的创建、配置（条件分支、嵌套分支、审批节点、字段权限、抄送节点、跳转规则）、保存和发布。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - low-code
    - process
    - workflow
    - approval
---

# 宜搭流程规则配置技能

## 概述

本技能描述如何通过流程设计器 API 为宜搭流程表单配置审批流程。支持审批节点、条件分支、嵌套分支、字段权限、抄送节点、跳转规则等完整的流程配置能力。

## 何时使用

当以下场景发生时使用此技能：
- 用户需要为已有的流程表单配置审批流程
- 用户需要修改已有流程的审批规则
- 用户需要配置条件分支、嵌套分支等复杂流程
- 已通过 `yida-create-form-page` 创建表单后，需要配置流程规则

> **提示**：如果需要一步到位创建表单 + 配置流程，请使用 `yida-create-process` 技能。

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
openyida configure-process "APP_XXX" "FORM-YYY" process-definition.json
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

当 AI 根据用户需求（如 PRD 文档、流程图、口头描述）生成流程定义 JSON 时，**必须自动分析并生成以下两项配置**，而不是等用户手动指定。

### 🔐 自动生成字段权限（formConfig.behaviorList）

**核心原则**：每个审批节点只允许编辑与其职责直接相关的字段，其他字段设为只读或隐藏。

**判断规则**：

1. **识别节点职责**：根据节点名称和描述，判断该节点负责填写/操作哪些字段
   - 例如：节点名为「首件取样」→ 负责填写「首件取样记录」
   - 例如：节点名为「数据分析判断」→ 负责填写「首件检验结论」
   - 例如：节点名为「抽样检查」→ 负责填写「抽样检查记录」和「抽样检验结论」

2. **设置字段行为**：
   - **NORMAL（可编辑）**：该节点职责范围内需要填写的字段
   - **READONLY（只读）**：前序节点已填写的字段（需要查看但不能修改）
   - **HIDDEN（隐藏）**：后续节点才需要填写的字段（当前阶段无需展示）
   - **附件字段**：通常在所有节点都设为 NORMAL（允许随时补充附件）
   - **流水号/编号字段**：通常在所有节点都设为 READONLY

3. **生成时机**：当表单有 **3 个以上字段** 且流程有 **2 个以上审批节点** 时，必须自动生成字段权限配置

4. **完整性要求**：`behaviorList` 必须包含表单中的**所有字段**，不能遗漏。未明确归属的字段默认设为 READONLY

**示例**：一个有「取样」→「检验」→「判断」三个节点的流程：

```json
{
  "type": "approval",
  "name": "取样",
  "approver": "originator",
  "formConfig": {
    "behaviorList": [
      { "fieldId": "textField_xxx", "fieldBehavior": "READONLY" },
      { "fieldId": "textareaField_sample", "fieldBehavior": "NORMAL" },
      { "fieldId": "textareaField_inspect", "fieldBehavior": "HIDDEN" },
      { "fieldId": "radioField_result", "fieldBehavior": "HIDDEN" },
      { "fieldId": "attachmentField_xxx", "fieldBehavior": "NORMAL" }
    ]
  }
}
```

```json
{
  "type": "approval",
  "name": "检验",
  "approver": "originator",
  "formConfig": {
    "behaviorList": [
      { "fieldId": "textField_xxx", "fieldBehavior": "READONLY" },
      { "fieldId": "textareaField_sample", "fieldBehavior": "READONLY" },
      { "fieldId": "textareaField_inspect", "fieldBehavior": "NORMAL" },
      { "fieldId": "radioField_result", "fieldBehavior": "HIDDEN" },
      { "fieldId": "attachmentField_xxx", "fieldBehavior": "NORMAL" }
    ]
  }
}
```

```json
{
  "type": "approval",
  "name": "判断",
  "approver": "originator",
  "formConfig": {
    "behaviorList": [
      { "fieldId": "textField_xxx", "fieldBehavior": "READONLY" },
      { "fieldId": "textareaField_sample", "fieldBehavior": "READONLY" },
      { "fieldId": "textareaField_inspect", "fieldBehavior": "READONLY" },
      { "fieldId": "radioField_result", "fieldBehavior": "NORMAL" },
      { "fieldId": "attachmentField_xxx", "fieldBehavior": "NORMAL" }
    ]
  }
}
```

### 🔄 自动识别回退/循环场景并生成跳转规则（routeRules）

**核心原则**：当流程中存在「不合格→重新处理」「退回→重新提交」等回退/循环语义时，自动配置跳转规则。

**识别规则**：

1. **关键词识别**：在流程描述、节点名称、条件分支名称中识别以下语义：
   - **回退语义**：不合格、退回、驳回、返工、重做、重新、再次、整改、修正
   - **循环语义**：循环检验、反复审核、多次提交、迭代

2. **跳转目标判断**：
   - 回退通常跳转到**产生问题的环节**或**需要重新执行的环节**
   - 例如：「不合格→异常处理→再次取样」中，「再次取样」拒绝时应跳回「检验」节点
   - 例如：「抽样不合格→异常分析」中，「异常分析」拒绝时应跳回「抽样检查」节点

3. **跳转动作**：
   - `"when": "disagree"` — 审批人点击「拒绝」时触发跳转
   - `"jumpTo": "<目标节点名称>"` — 跳转到指定节点重新执行

4. **生成时机**：当流程中出现以下模式时，必须自动生成跳转规则：
   - 条件分支中有「不合格/不通过」分支，且该分支的末尾节点语义上需要回到前序节点
   - 节点名称包含「再次」「重新」「返工」等回退语义
   - 用户描述中明确提到「循环」「回退」「退回重审」等需求

5. **常见回退模式**：

   ```
   模式 A：不合格 → 异常处理 → 重新检验（跳回检验节点）
   模式 B：审核不通过 → 退回修改（跳回提交节点）
   模式 C：验收不合格 → 整改（跳回整改前的节点）
   ```

**示例**：

```json
{
  "type": "approval",
  "name": "再次取样",
  "approver": "originator",
  "description": "异常处理后重新取样检验",
  "routeRules": [
    { "when": "disagree", "jumpTo": "检验" }
  ]
}
```

```json
{
  "type": "approval",
  "name": "异常分析检验（抽样）",
  "approver": "originator",
  "description": "抽样不合格，进行异常分析",
  "routeRules": [
    { "when": "disagree", "jumpTo": "抽样检查" }
  ]
}
```

### 📋 AI 生成流程定义的完整检查清单

在生成流程定义 JSON 前，AI 必须逐项检查：

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | 每个审批节点是否配置了 `formConfig.behaviorList` | 当表单字段 ≥ 3 且审批节点 ≥ 2 时必须配置 |
| 2 | `behaviorList` 是否包含所有表单字段 | 不能遗漏任何字段 |
| 3 | 每个节点的可编辑字段是否与其职责匹配 | 节点只能编辑自己负责的字段 |
| 4 | 前序已填写字段是否设为 READONLY | 防止后续节点篡改前序数据 |
| 5 | 后续节点字段是否设为 HIDDEN | 避免展示无关信息 |
| 6 | 是否存在回退/循环场景 | 检查条件分支中的「不合格」分支和节点名称中的回退语义 |
| 7 | 回退节点是否配置了 `routeRules` | 跳转目标是否正确指向需要重新执行的节点 |
| 8 | 附件字段是否在所有节点都可编辑 | 附件通常允许随时补充 |

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

### 示例 2：带条件分支的审批流程

```json
{
  "nodes": [
    {
      "type": "route",
      "conditions": [
        {
          "name": "金额大于1000",
          "rules": [
            {
              "fieldId": "numberField_xxx",
              "op": "GreaterThan",
              "value": "1000",
              "componentType": "NumberField",
              "fieldName": "金额"
            }
          ],
          "childNodes": [
            { "type": "approval", "name": "财务审批", "approver": "originator" }
          ]
        }
      ]
    },
    { "type": "carbon", "name": "抄送通知", "approver": "originator" }
  ]
}
```

流程：`发起 → 条件分支（金额>1000 → 财务审批 / 其他 → 直接通过） → 抄送通知 → 结束`

### 示例 3：嵌套分支 + 字段权限 + 跳转规则

```json
{
  "nodes": [
    {
      "type": "approval",
      "name": "检查订单",
      "approver": "originator",
      "formConfig": {
        "behaviorList": [
          { "fieldId": "textField_xxx", "fieldBehavior": "READONLY" },
          { "fieldId": "radioField_aaa", "fieldBehavior": "NORMAL" }
        ]
      }
    },
    {
      "type": "route",
      "conditions": [
        {
          "name": "订单有效",
          "rules": [
            {
              "fieldId": "radioField_aaa",
              "op": "Equal",
              "value": "有效",
              "componentType": "RadioField",
              "fieldName": "订单是否有效"
            }
          ],
          "childNodes": [
            { "type": "approval", "name": "确认订单", "approver": "originator" },
            {
              "type": "route",
              "conditions": [
                {
                  "name": "库存充足",
                  "rules": [
                    {
                      "fieldId": "selectField_xxx",
                      "op": "Equal",
                      "value": "充足",
                      "componentType": "SelectField",
                      "fieldName": "库存状态"
                    }
                  ],
                  "childNodes": [
                    { "type": "approval", "name": "交付产品", "approver": "originator" }
                  ]
                },
                {
                  "name": "库存不足",
                  "rules": [
                    {
                      "fieldId": "selectField_xxx",
                      "op": "Equal",
                      "value": "不足",
                      "componentType": "SelectField",
                      "fieldName": "库存状态"
                    }
                  ],
                  "childNodes": [
                    { "type": "approval", "name": "采购", "approver": "originator" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 示例 4：配置自定义详情页（解决钉钉工作通知链接问题）

```json
{
  "processDetailUrl": "https://mson55.aliwork.com/alibaba/web/APP_XXX/inst/taskDetail.htm?customPage=true&pageId=PAGE-YYY",
  "processMobileDetailUrl": "https://mson55.aliwork.com/alibaba/mobile/APP_XXX/inst/detail/taskDetail/",
  "nodes": [
    {
      "type": "approval",
      "name": "主管审批",
      "approver": "originator"
    }
  ]
}
```

配置 `processDetailUrl` 后，钉钉工作通知推送的链接将直接指向自定义详情页，而不再是原生 `taskDetail.htm`。

### 示例 5：带跳转规则的审批流程

```json
{
  "nodes": [
    {
      "type": "approval",
      "name": "部门主管审核",
      "approver": "originator"
    },
    {
      "type": "approval",
      "name": "财务部审核",
      "approver": "originator",
      "routeRules": [
        { "when": "disagree", "jumpTo": "部门主管审核" }
      ]
    }
  ]
}
```

流程：`发起 → 部门主管审核 → 财务部审核（拒绝时跳回部门主管审核） → 结束`

## 工作流程

```
读取登录态（.cache/cookies.json）
    ↓
读取流程定义 JSON
    ↓
获取 processCode（自动或手动传入）
    ├─ switchFormType 转为流程表单
    ├─ getAppPlatFormParam 提取 processCode（推荐）
    └─ getFormSchema 正则匹配（备用）
    ↓
查询流程版本列表
    ↓
创建新流程版本草稿
    ↓
构建 processJson + viewJson
    ↓
saveProcessById 保存流程
    ↓
publishProcessById 发布流程
    ↓
输出结果 JSON
```

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
