---
name: yida-create-process
description: 创建新的流程表单，完成表单创建、流程转换和审批规则配置。
---

# 创建流程表单

## 何时使用

- 没有目标表单，需要新建带审批的表单。
- 已有普通表单，用户明确要求把它转成流程表单。
- 已有流程表单或 `processCode`，只修改审批规则 → 使用 `yida-process-rule`。
- 无法确认要新建还是修改时，先查询现有表单和流程；仍无法判断再询问用户。

## 执行前确认

向用户确认以下内容后再创建：

- 目标应用和表单名称。
- 需要新建表单，还是复用已有普通表单。
- 审批节点、审批人、条件分支和字段权限。

## 必须遵守

1. `appType`、`formUuid`、`fieldId` 和 `processCode` 必须来自 CLI 返回值，不得猜测或缩写。
2. 已有普通表单时使用 `--formUuid`，不得再建同名表单。
3. 流程定义格式使用 `yida-process-rule`；不要在本技能重复定义节点结构。
4. 不要在流程定义中手写开始或结束节点，审批节点类型写 `approval`。
5. 字段和流程定义文件写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/`。
6. 创建成功后，将真实 `formUuid`、`fieldId` 和 `processCode` 写入 `.cache/<项目名>-schema.json`。

## 命令

新建表单并转成流程表单：

```bash
openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
```

复用已有普通表单：

```bash
openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>
```

推荐先创建普通表单，取得真实字段 ID，再转成流程表单：

```bash
openyida create-form create <appType> <formTitle> <fieldsJsonFile>
openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>
```

从仓库根执行时，文件路径以 `project/.cache/` 开头；从 `project/` 执行时，以 `.cache/` 开头。

## 执行步骤

1. 查询现有表单和流程，确认没有重复创建。
2. 使用 `yida-create-form-page` 准备或创建表单字段。
3. 使用 `yida-get-schema` 获取完整真实 `fieldId`。
4. 按 `yida-process-rule` 生成流程定义文件。
5. 向用户展示表单和流程摘要，取得创建确认。
6. 执行 `openyida create-process`。
7. 检查返回的 `success`、`formUuid` 和 `processCode`。
8. 写入真实 ID 映射并回读流程配置。

## 失败时

- 没有返回 `processCode`：停止，不得自行填写；检查表单是否已成功转成流程表单。
- `fieldId` 无效：重新使用 `yida-get-schema` 获取字段映射，再生成流程定义。
- 流程定义格式错误：按 `yida-process-rule` 修正，不在本技能内另写一套格式。
- 登录失效：执行 `openyida auth status`，恢复登录后重试。

## 完成条件

- 命令返回成功。
- 返回的 `formUuid` 和 `processCode` 与目标资源一致。
- 审批节点、分支和字段权限与用户确认内容一致。
- 真实 ID 已写入 `.cache/<项目名>-schema.json`。

## 相关技能

| 技能 | 用途 |
|------|------|
| `yida-create-form-page` | 创建或更新表单字段 |
| `yida-get-schema` | 获取真实字段 ID |
| `yida-process-rule` | 生成和检查流程定义；配置已有流程 |
