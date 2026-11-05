---
name: yida-create-process
description: 新建带审批的流程表单，或将指定普通表单转成流程；create-process 一次完成字段创建、流程配置、发布和回读，支持 @label 字段引用。
---

# 创建流程表单

目标不明时先只读确认或询问用户，按下表选择当前资源的入口。

## 触发条件

| 当前资源与目标 | 操作 |
| --- | --- |
| 新建带审批的数据入口、申请、审核或工单 | 确认目标应用、表单名称和流程配置后，直接使用下方新建命令 |
| 指定普通表单转流程 | 使用 `--formUuid` 复用原表，由 CLI 完成模式检查、转换和配置 |
| 已有流程表单、processCode、流程 URL 或绑定流程 | 交给 `yida-process-rule` 读取并编辑原流程 |
| 多个同级候选 | 按根技能的资源优先级定位；仍有歧义时确认目标 |

完整应用沿用本轮已确认的资源和配置；新建流程默认一次调用 `create-process`。

## 工作流

确认资源和配置 → 写入字段与流程定义 → 一次创建并回读 → 保存真实字段映射 → 按需执行流程 seed 编排。

### 命令与输入

字段定义沿用 `yida-create-form-page`；字段和流程 JSON 用结构化文件写入工具保存到 `<projectRoot>/.cache/openyida/<任务名>/`。

```bash
openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
openyida create-process <appType> --formUuid <已有普通表单UUID> <processDefinitionFile>
```

新建和复用模式均在创建或转换前完成流程定义的本地编译；编译错误先修正文件。字段按场景准备：

- **新建表单**：先准备字段定义，本表流程引用使用 `"fieldId":"@label:采购金额"`，子表使用 `"@label:明细/项目"`；CLI 按本地定义检查唯一匹配，创建后读取真实 Schema、绑定 ID 并为条件补齐组件类型。
- **复用已有表单**：先用 `yida-get-schema` 查询该表的字段与子表路径，再编写定义并执行 `--formUuid` 转换；已有真实 ID 直接沿用，`@label` 引用由 CLI 按该表 Schema 解析。

跨表字段映射使用各目标表的真实字段 ID。缺失、歧义或类型冲突按 `PROCESS_FIELD_REFERENCE_INVALID` 的 details 修正。将创建回执的字段映射和流程标识保存到 `.cache/<项目名>-schema.json`，供 seed、关联和页面复用；资源 ID 以回执为准，本技能不使用跨会话 memory。

参数不确定时读取 `openyida create-process --help`。`CREATE_PROCESS_INVALID_ARGUMENTS` 的 `details.argument/reason` 定位缺参、重复参数和未知选项；复用参数写作 `--formUuid`。

## 流程定义

`nodes` 只填写业务节点；CLI 自动生成发起和结束节点。审批使用 `approval`（兼容 `approver/approvalNode`），办理 `operator`，条件 `route`，并行 `parallel`，抄送 `carbon`；多人审批使用 `multiApproval`，提供 `approver` 和 `mode: all|or|oneByOne`。

```json
{
  "nodes": [{
    "type": "approval", "name": "采购复核", "approver": "originator",
    "formConfig": {"behaviorList": [{"fieldId":"@label:采购金额","fieldBehavior":"READONLY"}]}
  }]
}
```

编写定义前用 `use_skill("yida-process-rule", "流程定义与发布约束")` 加载规则，并读取[生成规范](../yida-process-rule/references/process-ai-rules.md)；人员、节点和操作参数按需加载 `yida-flow-node-config`。

- 发起字段权限用顶层 `startFormConfig`；谁能发起用表单 START 权限组。
- 字段至少 3 个且审批节点至少 2 个时，为各节点配置业务所需字段权限，覆盖全部字段；未归属字段默认 READONLY。
- 条件与并行分支按[流转控制](../yida-flow-node-config/references/control.md)填写 `rules/childNodes`；比较字段、类型和操作符按[条件与变量](../yida-flow-node-config/references/conditions-variables.md)确定。流程嵌套最多 3 层，默认“其他情况”由 CLI 补齐。
- 有回退或循环语义时配置 `routeRules`；并行、办理和高级组件沿用流程规则契约。
- 用户要求加签、转交时，配置 `nodes[].actions.normalActions/appendActions`；其余场景保持默认关闭。CLI 生成运行配置并校验操作权限。

## 准备流程示例

需要示例数据时，按[流程 seed 编排](../yida-data-management/references/process-seed-workflow.md)执行：**创建本人审批临时流程 → seed 并核验 → 编辑流程 → 发布最终审批流**。全程使用同一表单；示例会产生真实本人待办。旧示例保留旧版本，后续申请使用最终版本。

## 输出与恢复

成功以 `success=true`、`verificationLevel=PLATFORM_VIEW_VERIFIED`、`platformViewVerified=true` 为准。它证明平台配置回读通过；实际审批、字段编辑和通知按业务验收。

```json
{"success":true,"appType":"APP_XXX","formUuid":"FORM_XXX","formMode":"create","formTitle":"采购申请","fieldCount":1,"fields":[{"fieldId":"numberField_amount","label":"采购金额","componentName":"NumberField","parentFieldId":null,"labelPath":["采购金额"],"alias":""}],"processCode":"TPROC--XXX","processId":83145794990,"processVersion":1,"verificationLevel":"PLATFORM_VIEW_VERIFIED","platformViewVerified":true,"url":"https://<当前环境域名>/APP_XXX/workbench/FORM_XXX"}
```

| 输出 | 含义 |
| --- | --- |
| `formMode` | `create` 为新建，`reuse` 为复用原表；两者均返回真实 `appType/formUuid` |
| `formTitle/fieldCount/fields` | 新建返回名称、字段数与映射；复用的前两项为 `null`、`fields` 不返回，表示未查询，字段映射沿用前置 Schema |
| `processCode/processId/processVersion` | 流程编码、已发布定义 ID 与版本；`processId` 用于定位流程定义，申请实例使用 `processInstanceId` |
| `url` | 当前环境中该流程表单的工作台入口 |

| 回执 | 下一步 |
| --- | --- |
| 配置失败且已返回 formUuid | 保存原表和阶段信息，按 stage/nextStep/recovery 检查原表，修正后使用完整 retryCommand 复用原资源 |
| 已有 PUBLISHED 流程或 SAVED 草稿 | 按 `yida-process-rule` 确认完整替换范围，再使用 `--replace`；本轮已确认的临时到最终流程编辑复用该授权 |
| `CONFIGURE_PROCESS_OWNERSHIP_UNVERIFIED` | 核对原 appType/formUuid 与 binding，使用查询得到的 processCode |
| `PROCESS_COMPILE_ACTION_CONFIG_INVALID` | 修正报错节点的加签位置、结果或按钮配置后重新编译 |
| `noWriteRetry:true`、`NON_IDEMPOTENT_RESULT_UNKNOWN`、`PUBLISHED_UNVERIFIED` | 保留原资源，只读核实版本和平台状态，报告尚未确认的部分 |
| 参数、字段或登录错误 | 按结构化详情修正参数/字段；认证恢复交给 `yida-login` |
| 只读请求超时 | 检查网络后受控重试；写入超时按结果未知处理 |

恢复沿用原 `formUuid` 和真实 `processCode`；未知写入不重放、不另建替代资源。无法完成时交付原表链接、失败阶段和剩余事项。用户拒绝操作时保留当前资源并等待调整。
