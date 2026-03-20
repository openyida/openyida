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
