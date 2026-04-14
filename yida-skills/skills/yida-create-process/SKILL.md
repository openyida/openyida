---
name: yida-create-process
description: 宜搭流程表单一体化创建。整合创建表单 → 转流程表单 → 获取 processCode → 配置流程四步为一步。不适用于：已有流程表单只需修改审批规则（应使用 yida-process-rule），或只需创建普通表单无审批（应使用 yida-create-form-page）。
---
# 流程表单一体化创建

## 严格禁止 (NEVER DO)

- 不要编造 processCode，必须从命令返回的 JSON 中提取
- 不要在流程定义中使用猜测的 fieldId，必须先用 `yida-get-schema` 获取

## 严格要求 (MUST DO)

- **创建前必须确认**：执行创建命令前，必须向用户确认表单名称、流程配置和目标应用，获得用户明确同意后再执行
- 优先使用用法 2（先创建表单获取字段 ID，再 `--formUuid` 转流程）
- 创建成功后，将 formUuid 和 processCode 记录到 `.cache/<项目名>-schema.json`
- 流程定义中字段 ≥ 3 且审批节点 ≥ 2 时，必须自动配置字段权限
- **本技能不读写 memory**：formUuid 和 processCode 输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户需要"创建审批流程"、"新建流程表单"、"搭建审批系统"时使用。

**关键区分**：
- 从零创建流程表单（含表单+流程配置）→ 本技能
- 为已有表单配置/修改审批规则 → `yida-process-rule`

## 触发条件

**正向触发**：
- "创建审批流程"、"新建流程表单"
- "搭建审批系统"、"创建带审批的表单"
- 需求中含「审批」「流程」「申请」「审核」「工单」等关键词，且尚无表单

**不适用场景（不要触发）**：
- 已有流程表单，只需修改审批规则 → `yida-process-rule`
- 只需创建普通表单（无审批）→ `yida-create-form-page`

---


## 用法 1：全新创建

```bash
openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
```

## 用法 2：复用已有表单（推荐）

```bash
openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>
```

> **推荐用法 2**：先用 `openyida create-form create` 创建表单获取字段 ID，再用 `--formUuid` 转流程表单。

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `formTitle` | 用法 1 必填 | 表单名称 |
| `fieldsJsonFile` | 用法 1 必填 | 字段定义文件（格式同 `yida-create-form-page`） |
| `--formUuid` | 用法 2 必填 | 已有表单 UUID |
| `processDefinitionFile` | 是 | 流程定义文件（格式同 `yida-process-rule`） |

## 输出

```json
{"success":true,"formUuid":"FORM-YYY","formTitle":"订单处理表","appType":"APP_XXX","fieldCount":6,"processCode":"TPROC--XXX","url":"{base_url}/APP_XXX/workbench/FORM-YYY"}
```

## 推荐两步流程

```bash
# Step 1: 创建表单获取字段 ID
openyida create-form create "APP_XXX" "订单处理表" fields.json

# Step 2: 将已有表单转为流程表单
openyida create-process "APP_XXX" --formUuid "FORM-YYY" process-definition.json
```

> 流程定义中的 `fieldId` 需在表单创建后确定。如流程不含条件分支，可用用法 1 一步到位。

## AI 自动生成流程特性

生成流程定义 JSON 时，**必须自动分析并生成**：

1. **🔐 字段权限**：当字段 ≥ 3 且审批节点 ≥ 2 时，每个节点只允许编辑相关字段
2. **🔄 跳转规则**：存在回退/循环语义时，自动配置 `routeRules`

详见 `yida-process-rule` 的 SKILL.md。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败 | 检查 appType 和 formUuid 是否正确，确认登录态有效 |
| processCode 获取失败 | 确认表单已成功转为流程表单类型，重新执行 |
| 流程定义 JSON 格式错误 | 参考 `yida-process-rule` SKILL.md 中的 JSON 格式说明 |
| 返回 JSON 中无 processCode | 不要猜测 processCode，重新执行命令获取 |
| 流程发布失败 | 检查流程定义中的 fieldId 是否为真实 ID（先 get-schema 获取） |
| 登录态失效 | 执行 `openyida login` 重新登录后再试 |
| appType 格式错误 | 确认格式为 `APP_` 开头的字符串 |
| formUuid 格式错误 | 确认格式为 `FORM-` 开头的字符串 |
| 网络超时 | 检查网络连接，等待后重试 |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示完整错误信息，询问是否重试或调整参数 |
| 参数格式错误 | 停止执行，提示正确的参数格式，引导用户修正 |
| 登录态失效 | 提示用户执行 `openyida login` 重新登录 |
| processCode 缺失 | 停止执行，不得编造，提示用户重新执行命令 |
| fieldId 不存在 | 停止执行，提示用户先执行 `yida-get-schema` 获取真实 ID |
| 用户拒绝确认 | 停止执行，询问用户是否需要调整配置 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |
