---
name: yida-process-rule
description: 为已有流程表单设置审批节点、条件分支、字段权限和跳转规则。
---

# 宜搭流程规则

## 何时使用

- 已有流程表单或 `processCode`，需要修改审批节点、条件分支、字段权限、抄送或跳转规则。
- 已有普通表单，需要先转成流程表单 → 使用 `yida-create-process --formUuid`。
- 没有目标表单，需要新建流程表单 → 使用 `yida-create-process`。
- 目标不明时先只读确认或询问用户。

## 必须遵守

1. 执行前用 `yida-get-schema` 取得完整真实 `fieldId`。
2. 流程定义文件写入 `<projectRoot>/.cache/openyida/<任务名>/`。
3. 发布前向用户展示节点数、审批人和条件分支，并取得确认。
4. 字段不少于 3 个且审批节点不少于 2 个时，为每个节点设置字段权限。
5. 需求包含退回或循环时设置 `routeRules`。
6. 将命令返回的真实 `processCode` 写入 `.cache/<项目名>-schema.json`。

## 命令

```bash
openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]
```

从 workspace 根执行时，文件路径以 `project/.cache/` 开头；从 `project/` 执行时，以 `.cache/` 开头。

## 流程定义最小 DSL 合约

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

- 审批节点使用 `"type": "approval"`。
- 不要手写 `startNode`，CLI 自动生成发起节点。
- 不要手写 `endNode`，CLI 自动生成结束节点。
- 不要写 `"type": "approve"`，改成 `approval`。
- 审批人、条件、并行、办理、抄送、字段权限和跳转规则读取 [流程 DSL](references/process-dsl.md)；连接器、消息、代码等节点读取官方组件参考。

## 执行步骤

1. 确认 `appType`、`formUuid`、`processCode` 和审批需求。
2. 使用 `yida-get-schema` 获取涉及字段的真实 ID。
3. 按需求生成流程定义文件。
4. 检查节点、审批人、分支、字段权限和跳转规则。
5. 向用户展示摘要并取得发布确认。
6. 执行 `openyida configure-process`。
7. 检查返回的 `success`、`processCode`、`processId` 和版本。

## 完成条件

- 命令返回成功。
- 返回的 `processCode` 与目标流程一致。
- 节点、条件、字段权限和跳转规则与确认内容一致。
- 真实 ID 已写入 `.cache/<项目名>-schema.json`。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [流程 DSL](references/process-dsl.md) | 编写节点、审批人、条件、并行、字段权限或跳转规则时 |
| [流程示例](references/examples.md) | 需要条件分支、嵌套分支、字段权限或跳转示例时 |
| [官方组件节点](references/official-component-nodes.md) | 使用连接器、消息、代码、子流程、循环或 AI 节点时 |
| [流程生成规则](references/process-ai-rules.md) | 自动生成字段权限和退回规则时 |
