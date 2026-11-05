# 流程 seed 编排

需要流程示例时，按以下顺序准备 1–3 条业务记录。发起真实申请和本人待办属于本轮示例范围；沿用用户已确认的范围和组织。用户要求不造数或缺少授权时，配置最终业务流程，页面显示“暂无数据”。

## 操作顺序

1. 用 `yida-create-process` 直接创建流程表单；临时定义只含一个 `approval` 节点，`approver: "originator"`。使用创建回执的 `formUuid/processCode/fields/processVersion`。
2. 将真实字段 ID 和业务值写入一份 records 数组，执行：

```bash
openyida data seed process <appType> <formUuid> --process-code <真实processCode> --expect-form-name <真实名称> --records-file <绝对路径>/records.json --timezone +08:00 --json
```

3. 核对 `completed/readbackVerified/requestedFieldsVerified`，按 `items[].recordIndex` 直接消费 `processInstanceId`，流程关联使用 `formType:"process"`。日期、子表、可选字段和回执恢复与[普通 seed](../SKILL.md#一次写入普通表单示例记录)共用规则；`--check` 只预检。已有核验回执用于字段验收，页面验收继续读取真实记录。
4. 加载 `yida-process-rule`，在同一流程上编辑完整业务节点、审批人、条件和字段权限；保存最终定义，按已确认的临时到最终编辑范围执行 `configure-process ... --replace`，由 CLI 保存、发布并回读。已有 mock 使用旧流程版本，新申请使用最终版本。

被关联的流程表单先完成创建和 seed，再创建依赖普通表单；关联定义显式填写最终 `formType:"process"`、真实表单和标题字段。普通表单到流程的转换继续使用 `create-process --formUuid`；历史普通记录保持原类型和 ID，审批状态以实际返回为准。

## 阶段与恢复

在现有 build-manifest 的该资源项记录 `temporaryProcessVersion`、`seed.receiptFile`、`seed.processInstanceIds`、`finalDefinitionFile`、`finalProcessVersion` 和当前阶段。每项只消费真实回执。

| 当前阶段 | 恢复动作 |
| --- | --- |
| 创建已返回 formUuid，配置未完成 | 使用原表和 create-process 的 recovery 指引补齐临时流程 |
| seed 部分核验 | 原 records-file 和参数重跑；verified 复用，pending 有 ID 只回读，未知写入先核实 |
| seed 完成，最终流程未发布 | 直接继续编辑与最终发布，复用已核验实例 ID |
| 最终流程已发布 | 核对最终版本与平台 view，保留 seed 的原版本归属 |
| 发布结果未知或未核验 | 先只读核对平台状态，保留原版本与回执 |

配置回读、数据核验、页面展示和真实流转分别记录结果。用户要求验证最终流程时，用已授权的少量新申请核对审批任务，数字分支覆盖零值和阈值边界；旧示例继续保留其原有流转结果。
