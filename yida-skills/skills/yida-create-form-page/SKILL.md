---
name: yida-create-form-page
description: 创建或更新宜搭原生表单，包括字段、分组、校验、规则、数据源、主题和详情样式。
---

# 宜搭原生表单

## 何时使用

- 创建普通表单或修改已有表单字段。
- 添加选项、校验、字段规则或远程数据源。
- 调整字段分组、多列布局和详情页样式。
- 修改表单记录 → 使用 `yida-data-management`。
- 创建流程表单 → 使用 `yida-create-process`。

目标不明时先只读确认或询问用户。已有 `formUuid` 时更新原表单；确认缺少目标表单且允许创建时才创建。

## 原生表单脚手架

原生表单使用独立脚手架：

```bash
openyida sample yida-create-form-page form
```

在 `.form.json` 中填写字段、Divider/多列分组、校验、规则、远程数据源、主题 token 和 formDetail preset。`lib/app/scaffolds/form/form-schema-builder.js` 与 `lib/app/services/form-runtime.js` 负责生成和保存 Schema。不要把原生表单写成自定义页面 JSX。

## 常用命令

```bash
openyida create-form create <appType> <formTitle> <fieldsJsonOrFile> [options]
openyida create-form update <appType> <formUuid> <changesJsonOrFile>
openyida create-form patch <appType> <formUuid> <patchJsonOrFile>
openyida create-form add-option <appType> <formUuid> <fieldLabelOrId> <option...>
openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>
openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>
openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>
```

## 执行步骤

1. 确认目标应用、表单名称和创建或更新方式。
2. 读取 [创建与更新规则](references/create-update-workflow.md)，确定目标表单、失败恢复和字段定位方式。
3. 读取 `yida-form-detail`，确定字段分组和详情样式。
4. 从脚手架扩展 `.form.json`，填写字段、Divider、校验和规则。
5. 运行表单定义校验。
6. 执行 create、update 或对应子命令。
7. 将真实 `formUuid` 和 `fieldId` 写入 `.cache/<项目名>-schema.json`。
8. 回读 revision、字段、生命周期、主题、formDetail 样式和 13 个 Yida API。

视觉引导必须和 `Divider` 分割线语义分组合并执行。常规业务表单优先使用 Divider 和多列容器，表单标题、说明、字段顺序和校验文案保持业务语义。

## 关键规则

- 字段 ID 使用平台生成的真实值，不按标签猜测。
- 选项、校验、规则和数据源优先使用对应子命令，不直接修改底层 Schema。
- 只有对应子命令不能表达时才使用 `patch`。
- 创建或更新前校验 JSON；保存失败时保留原文件和完整错误信息。
- 真实表单已有数据时，结构变更前说明影响并取得确认。

## 完成条件

- 命令返回成功和真实 `formUuid`。
- Schema 回读中的字段、分组、校验和规则与输入一致。
- 生命周期、主题和 formDetail 样式回读通过。
- 真实 ID 已写入 `.cache/<项目名>-schema.json`。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [创建与更新规则](references/create-update-workflow.md) | 选择 create/update、处理创建失败或字段重名时 |
| [字段定义](references/field-definition-guide.md) | 编写字段 JSON 时 |
| [字段属性](references/form-field-properties.md) | 设置组件属性时 |
| [表单模式](references/advanced-form-modes.md) | 使用 patch、规则、校验或数据源时 |
| [关联表单](references/association-form-field.md) | 配置关联表单字段时 |
| [成员字段](references/employee-field.md) | 配置成员选择时 |
| [流水号字段](references/serial-number-field.md) | 配置自动编号时 |
