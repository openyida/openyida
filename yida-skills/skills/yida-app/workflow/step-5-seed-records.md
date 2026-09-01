# Step 5：写入初始表单数据

完整应用默认给本轮新建或页面数据源依赖的核心普通表单写入 1-3 条业务化 seed records。

## 输入

- 真实 `appType`；
- 核心普通表单 `formUuid`；
- `.cache/<项目名>-schema.json` 或字段 schema；
- PRD 中的业务对象和示例数据语义。

## 操作

1. 执行 `use_skill("yida-data-management", "为核心业务表单写入 1-3 条示例记录")`。
2. 先执行 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实字段 ID。
3. 生成当前业务语义的字段值，不写“测试1 / demo / mock”。
4. 每个核心普通表单 1-3 条即可；列表/工作台通常 2 条，看板/排行/状态分布通常 3 条。
5. `DateField` / `CascadeDateField` 使用 13 位毫秒时间戳。
6. 每条记录单独执行 `openyida data create form <appType> <formUuid> --expect-form-name <真实名称> --expect-form-type receipt --data-file ...` 或 `--data-json ...`；名称/UUID/类型不一致时停止。
7. 最后执行 `openyida data query form` 抽查至少 1 条，确认 `formData` 非空。

以下情况可以跳过，并在 final 说明原因：

- 用户明确要求不要造数；
- 表单是配置字典、权限表、敏感个人数据表或纯附件表；
- 字段缺少可安全构造的有效值；
- 流程表单没有确认 `processCode`，且页面不需要流程实例。

## 产出

- 1-3 条真实普通表单记录；
- query 抽查结果；
- 或明确跳过原因和页面空态方案。

## Checklist

- [ ] seed records 使用真实 `fieldId`；
- [ ] 每条记录单独创建；
- [ ] query 抽查已确认 `formData` 非空；
- [ ] 跳过时已写明原因和页面空态方案。

## 下一步

→ [Step 6：创建或复用主页面](step-6-main-page.md)
