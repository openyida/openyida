---
name: yida-integration
description: 创建、查询、启用或停用宜搭集成自动化流程。
---

# 宜搭集成自动化

## 何时使用

- 表单新增、修改或流程完成后自动发送通知。
- 自动查询、新增或更新其他表单数据。
- 创建、查询、启用、停用或检查集成自动化。
- 配置审批节点和流程分支 → 使用 `yida-process-rule`。

## 必须遵守

1. 写操作前确认目标 `appType`、触发表单 `formUuid` 和所有真实 `fieldId`。
2. 逻辑流目标或 ID 不明确时先查询或询问用户，不按名称猜测或重建。
3. 创建或发布前展示触发事件、节点、目标表单和通知对象，并取得用户确认。
4. `--spec` 文件写入 `<projectRoot>/.cache/openyida/<任务名>/integration/`。
5. 创建后记录真实逻辑流 ID；发布后检查启用状态。
6. 自动化运行成功但业务结果不符时，继续检查节点输出和数据结果。

## 常用命令

```bash
openyida integration create <appType> <formUuid> "<名称>" [options]
openyida integration list <appType>
openyida integration enable <appType> <formUuid> <processCode>
openyida integration disable <appType> <formUuid> <processCode>
openyida integration check <appType> [--json]
openyida integration diagnose --text "<异常信息>" [--json]
```

简单通知、查询和新增数据优先使用命令选项。需要复杂分支、更新数据、连接器节点或自定义节点时使用 `--spec <file.json>`，并读取节点结构参考。

## 关键规则

- 字段变量引用使用平台要求的 `#{fieldId-ComponentType}#` 格式。
- 获取当前触发记录优先使用 `--get-self`。
- 目标是普通表单时使用新增数据节点；目标是流程表单时使用发起审批节点。
- 接收人参数填写真实 `userId`。
- 重试前检查新增和更新节点是否会重复写入数据。
- 保存草稿和发布都使用平台保存接口，发布状态由 `isOnline` 区分。

## 执行步骤

1. 确认触发事件、来源表单、目标表单、字段和接收人。
2. 使用 `yida-get-schema` 获取真实字段 ID。
3. 选择命令选项或 `--spec`。
4. 展示摘要并取得确认。
5. 创建或更新逻辑流。
6. 按用户要求启用逻辑流。
7. 执行 `integration list` 或 `integration check` 回读状态。

## 完成条件

- CLI 返回真实逻辑流 ID。
- 查询结果中存在目标逻辑流。
- 用户要求启用时，回读状态为已启用。
- 运行检查没有未处理异常；有异常时明确列出流程和日志。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [命令参数](references/cli-options.md) | 选择触发事件、跨表写入、发起审批、连接器或启停参数时 |
| [节点结构](references/integration-node-schemas.md) | 使用 `--spec` 或排查节点参数时 |
| [命令示例](references/examples.md) | 需要通知、跨表新增或跨表查询示例时 |
