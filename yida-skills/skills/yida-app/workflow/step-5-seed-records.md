# Step 5：准备示例数据

使用本轮确认的业务范围、创建回执和真实字段映射。Fast 沿用短执行上下文；Plan 使用已确认的 PRD。核心普通表单默认 1–3 条；流程示例按已确认范围执行。

## 执行

1. 加载 `yida-data-management`。复用创建结果中的 appType、formUuid、类型与字段；缺少映射时一次读取 `get-schema --field-map-json`。
2. 按业务填写名称、状态、金额、日期等，选项取真实配置，成员/部门取可确认的 ID。单对象 1 条、列表 2 条、排行或分布 3 条即可。
3. 用结构化文件工具保存 `.cache/openyida/<任务名>/data-import/records.json` 顶层数组，日期可用 ISO 或毫秒，由 seed 按业务时区转换。
4. 普通表单执行 `data seed form`；流程示例执行[临时本人审批 → seed 核验 → 编辑流程 → 最终发布](../../yida-data-management/references/process-seed-workflow.md)。新建流程直接使用 create-process，原普通表单转流程继续使用 --formUuid。
5. 先写被关联表，再写依赖记录；关联定义按最终 receipt/process 类型，值使用对应 formInstId/processInstanceId 与真实名称。
6. 保留完整回执，按 recordIndex 复用 verified ID。seed 已完成实例及字段回读；页面继续读取真实数据验证可见字段。其他写入按 ID 定向 get/query 业务抽查，未知结果先核实。

```bash
openyida data seed form <appType> <formUuid> --expect-form-name <名称> --records-file <绝对路径>/records.json --timezone +08:00 --json
openyida data seed process <appType> <formUuid> --process-code <真实processCode> --expect-form-name <名称> --records-file <绝对路径>/records.json --timezone +08:00 --json
```

字段适配、可选字段省略、隐藏字段、锁和未知写入按[数据技能](../../yida-data-management/SKILL.md#一次写入普通表单示例记录)处理。CLI 保留目标与类型检查，写入串行，独立前置读取最多两路并发；回执恢复复用原输入和参数。

## 产出与跳过

输出记录数量、核验范围、实例 ID、流程阶段及页面依赖。用户要求不造数，或对象是配置字典、权限、敏感个人数据、纯附件表，或缺少可安全填写的值时，记录跳过原因并继续独立步骤。无流程实例时页面显示“暂无数据”。

CLI 隐藏字段缺失按权限解释；实例未确认、接口报错或回读不一致时保留未完成状态。回执 ID 用于后续关联和验收，页面与业务验证分别记录证据。

→ [Step 6：创建或复用主页面](step-6-main-page.md)
