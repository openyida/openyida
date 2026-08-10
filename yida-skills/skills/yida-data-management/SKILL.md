---
name: yida-data-management
description: 查询、新增或更新宜搭表单数据、子表数据、流程实例和任务中心数据。
---

# 宜搭数据管理

## 何时使用

- 查询、新增或更新普通表单记录。
- 查询子表数据。
- 查询、发起或更新流程实例。
- 查询待办、已办、已提交或抄送任务。
- 修改表单字段结构 → 使用 `yida-create-form-page`。

## 写入数据前

1. 确认目标 `appType`、`formUuid` 和表单类型。
2. 执行 `openyida get-schema <appType> <formUuid> --field-map-json`。
3. 使用返回的完整真实 `fieldId`；别名必须由 `--resolve-aliases` 唯一解析。
4. 普通表单使用 `data ... form`，流程表单使用 `data ... process`。

## 常用命令

```bash
openyida data query form <appType> <formUuid> [options]
openyida data get form <appType> --inst-id <formInstId>
openyida data create form <appType> <formUuid> --data-json '<json>' [--resolve-aliases]
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --data-json '<json>' [--resolve-aliases]

openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId> [--page 1 --size 100]

openyida data query process <appType> <formUuid> [options]
openyida data get process <appType> --process-inst-id <processInstanceId>
openyida data create process <appType> <formUuid> --process-code <processCode> --data-json '<json>' [--resolve-aliases]
openyida data update process <appType> --process-inst-id <processInstanceId> --form-uuid <formUuid> --data-json '<json>' [--resolve-aliases]
openyida data query operation-records <appType> --process-inst-id <processInstanceId>
openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --out-result AGREE|DISAGREE --remark '<text>' [options]

openyida data query tasks <appType> --type todo|done|submitted|cc [--page 1 --size 20]
```

长 JSON 写入 `.cache/openyida/<任务名>/data-import/`，再使用 `--data-file` 或 `--search-file`。

## 写入规则

- `data create form/process` 每次创建一条实例。多条记录按每批不超过 30 条逐条执行。
- 顶层数组不能作为多条实例提交；数组只用于子表等字段值。
- 日期字段使用 13 位毫秒时间戳。
- 子表超过 50 行时使用 `data query subform` 分页读取。
- 更新或执行任务前确认真实实例 ID、任务 ID 和目标字段。

## 写后检查

1. 检查每条 create 或 update 命令都返回成功。
2. 执行对应的 `data query form|process`。
3. 抽查至少一条新记录，确认 `formData` 中包含本次写入值。
4. 流程记录可继续用 `processInstanceId` 执行 get 检查。

只生成数据文件、只执行登录或 Schema 查询、没有查询回读，都不算完成。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [命令与接口](references/api-matrix.md) | 查询完整命令和接口对应关系时 |
| [数据格式](references/data-format-guide.md) | 编写查询条件、字段值、日期或关联字段时 |
| [已验证接口](references/verified-endpoints.md) | 排查接口地址和请求方式时 |
