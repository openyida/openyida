---
name: yida-create-process
description: 宜搭流程表单一体化创建技能，整合「创建表单 → 转流程表单 → 获取 processCode → 配置流程」四步为一步，一键创建带流程的表单。
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
    - form
---

# 宜搭流程表单一体化创建技能

## 概述

本技能提供宜搭流程表单的一体化创建能力，将原本需要分步执行的「创建普通表单 → 转为流程表单 → 获取 processCode → 配置并发布流程」四个步骤整合为一个命令。

## 何时使用

当以下场景发生时使用此技能：
- 用户需要创建一个带审批流程的表单
- 用户需要一步到位完成表单创建和流程配置
- 已通过 `yida-create-form-page` 创建了表单，需要将其转为流程表单并配置流程

## 使用方式

### 用法 1：创建新表单 + 转流程（全新创建）

```bash
openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
```

### 用法 2：复用已有表单 + 转流程（推荐）

```bash
openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>
```

> **推荐用法 2**：先用 `openyida create-form create` 创建表单并获取字段 ID，再用 `--formUuid` 直接将该表单转为流程表单，避免创建多余的普通表单。

**参数说明**：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `appType` | 是 | 应用 ID，如 `APP_XXX` |
| `formTitle` | 用法 1 必填 | 表单名称 |
| `fieldsJsonFile` | 用法 1 必填 | 字段定义 JSON 文件路径（格式同 `yida-create-form-page`） |
| `--formUuid` | 用法 2 必填 | 已有表单的 formUuid |
| `processDefinitionFile` | 是 | 流程定义 JSON 文件路径（格式同 `yida-process-rule`） |

**示例 1（全新创建）**：

```bash
openyida create-process "APP_XXX" "订单处理表" fields.json process-definition.json
```

**示例 2（复用已有表单，推荐）**：

```bash
# 先创建表单获取字段 ID
openyida create-form create "APP_XXX" "订单处理表" fields.json

# 再将已有表单转为流程表单并配置流程
openyida create-process "APP_XXX" --formUuid "FORM-YYY" process-definition.json
```

**输出**：日志输出到 stderr，JSON 结果输出到 stdout：

```json
{
  "success": true,
  "formUuid": "FORM-YYY",
  "formTitle": "订单处理表",
  "appType": "APP_XXX",
  "fieldCount": 6,
  "processCode": "TPROC--XXX",
  "url": "https://www.aliwork.com/APP_XXX/workbench/FORM-YYY"
}
```

## 工作流程

```
读取登录态（.cache/cookies.json）
    ↓
Step 1: 创建或复用表单
    ├─ 用法 1: 调用 openyida create-form create → 获取 formUuid
    └─ 用法 2: 使用 --formUuid 传入的已有表单（跳过创建）
    ↓
Step 2: 转为流程表单（switchFormType 接口）
    ↓
Step 3: 获取 processCode
    ├─ 方法 1: 从 getAppPlatFormParam 接口提取（推荐）
    └─ 方法 2: 从 getFormSchema 提取（备用）
    ↓
Step 4: 配置并发布流程（调用 configure-process）
    ↓
输出最终结果
```

## 输入文件格式

### 字段定义文件（fieldsJsonFile）

格式与 `yida-create-form-page` 技能完全一致：

```json
[
  { "type": "TextField", "label": "订单编号", "required": true },
  { "type": "TextField", "label": "客户名称", "required": true },
  { "type": "SelectField", "label": "库存状态", "options": ["充足", "不足"] },
  { "type": "NumberField", "label": "订单金额" }
]
```

### 流程定义文件（processDefinitionFile）

格式与 `yida-process-rule` 技能完全一致，详见 `yida-process-rule` 的 SKILL.md。

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

> **注意**：流程定义中的 `fieldId` 需要在表单创建后才能确定。建议先用 `openyida create-form create` 创建表单获取字段 ID，再编写流程定义，最后用 `--formUuid` 参数将已有表单转为流程表单。

### ⚠️ AI 自动生成流程特性（必须遵守）

在生成流程定义 JSON 时，AI **必须自动分析并生成**以下两项配置，详细规则见 `yida-process-rule` 的 SKILL.md 中「AI 自动生成流程特性」章节：

1. **🔐 字段权限（formConfig.behaviorList）**：当表单字段 ≥ 3 且审批节点 ≥ 2 时，必须为每个审批节点自动配置字段权限。每个节点只允许编辑与其职责相关的字段，前序已填写字段设为只读，后续字段设为隐藏。

2. **🔄 跳转规则（routeRules）**：当流程中存在回退/循环语义（如「不合格→重新检验」「退回→重新提交」）时，必须自动配置跳转规则，使审批人拒绝时跳转到对应的前序节点。

## 前置依赖

- Node.js ≥ 16
- 项目根目录存在 `.cache/cookies.json`（首次运行会自动触发扫码登录）

## 文件结构

```
yida-create-process/
└── SKILL.md                # 本文档
```

## 与其他技能的关系

### 依赖的子技能

| 技能 | 用途 |
| --- | --- |
| `yida-login` | 登录态管理（自动触发） |
| `yida-create-form-page` | 创建表单（用法 1） |
| `yida-process-rule` | 配置并发布流程 |

### 替代的手动流程

本技能替代了以下手动操作序列：

```bash
# 以前需要分步执行：
# 1. 创建表单
openyida create-form create <appType> <formTitle> <fieldsFile>
# 2. 手动在管理后台将表单转为流程表单
# 3. 手动获取 processCode，再配置流程
openyida configure-process <appType> <formUuid> <processDefFile> <processCode>

# 现在只需一步（全新创建）：
openyida create-process <appType> <formTitle> <fieldsFile> <processDefFile>

# 或者两步（推荐，先创建表单获取字段 ID，再转流程）：
openyida create-form create <appType> <formTitle> <fieldsFile>
openyida create-process <appType> --formUuid <formUuid> <processDefFile>
```

## 常见问题

**Q：processCode 获取失败怎么办？**
A：脚本会输出已创建的 `formUuid`，你可以在宜搭管理后台手动查看流程设计器 URL 中的 processCode，然后使用 `openyida configure-process` 手动配置。

**Q：字段 ID 在创建前无法确定怎么办？**
A：如果流程定义中需要引用字段 ID（如条件分支），建议分两步操作：
1. 先用 `openyida create-form create` 创建表单，获取字段 ID
2. 将字段 ID 写入流程定义文件
3. 再用 `--formUuid` 参数将已有表单转为流程表单

如果流程不包含条件分支（不需要引用字段 ID），可以直接用用法 1 一步到位。
