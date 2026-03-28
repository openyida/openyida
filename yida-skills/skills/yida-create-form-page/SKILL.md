---
name: yida-create-form-page
description: 宜搭表单页面创建与更新。create 模式创建新表单，update 模式增删改字段。支持 19 种字段类型。
---

# 表单页面创建与更新

## create 模式

```bash
openyida create-form create <appType> <formTitle> <fieldsJsonOrFile> [--layout double|card] [--theme compact|comfortable] [--label-align top|left]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `formTitle` | 是 | 表单名称 |
| `fieldsJsonOrFile` | 是 | 字段定义 JSON 字符串（以 `[` 开头）或文件路径 |

### 输出

```json
{"success":true,"formUuid":"FORM-XXX","formTitle":"用户信息表","appType":"APP_xxx","fieldCount":4,"url":"{base_url}/APP_xxx/workbench/FORM-XXX"}
```

## update 模式

```bash
openyida create-form update <appType> <formUuid> <changesJsonOrFile>
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `formUuid` | 是 | 表单 UUID |
| `changesJsonOrFile` | 是 | 修改定义 JSON 字符串或文件路径 |

### 输出

```json
{"success":true,"formUuid":"FORM-YYY","appType":"APP_XXX","changesApplied":3,"url":"{base_url}/APP_XXX/workbench/FORM-YYY"}
```

## 字段定义 JSON 格式

```json
[
  { "type": "TextField", "label": "姓名", "required": true },
  { "type": "SelectField", "label": "部门", "dataSource": [{"text":{"zh_CN":"技术部","en_US":"技术部","type":"i18n"},"value":"技术部"}] },
  { "type": "DateField", "label": "入职日期" },
  { "type": "TableField", "label": "费用明细", "children": [
    { "type": "TextField", "label": "项目" },
    { "type": "NumberField", "label": "金额" }
  ]}
]
```

### 字段属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | String | 是 | 字段类型（见下方类型表） |
| `label` | String | 是 | 字段标签 |
| `required` | Boolean | 否 | 是否必填，默认 `false` |
| `placeholder` | String | 否 | 占位提示 |
| `behavior` | String | 否 | `NORMAL`（默认）/ `READONLY` / `HIDDEN` |
| `visibility` | String[] | 否 | `["PC", "MOBILE"]`（默认） |
| `dataSource` | Array | 条件必填 | 选项类字段必填 |
| `multiple` | Boolean | 否 | 是否多选 |
| `children` | Object[] | 条件必填 | `TableField` 必填 |
| `associationForm` | Object | 条件必填 | `AssociationFormField` 必填 |

各字段类型默认属性参考 [表单字段属性参考](references/form-field-properties.md)。

## 修改定义 JSON 格式（update 模式）

```json
[
  { "action": "add", "field": { "type": "TextField", "label": "姓名", "required": true }, "after": "部门" },
  { "action": "delete", "label": "备注" },
  { "action": "update", "label": "年龄", "changes": { "required": true, "placeholder": "请输入年龄" } }
]
```

| 操作 | 必填属性 | 说明 |
|------|---------|------|
| `add` | `field.type`, `field.label` | 新增字段，`after`/`before` 指定位置 |
| `delete` | `label` | 删除字段 |
| `update` | `label`, `changes` | 修改字段属性，子表内字段需 `tableLabel` |

### update changes 支持的属性

`label`、`required`、`placeholder`、`dataSource`、`multiple`、`behavior`、`visibility`、`innerAfter`（NumberField 单位）

## 支持的字段类型

| 字段类型 | 说明 | 特殊属性 |
|---------|------|----------|
| `TextField` | 单行文本 | — |
| `TextareaField` | 多行文本 | — |
| `RadioField` | 单选 | `dataSource` |
| `SelectField` | 下拉单选 | `dataSource` |
| `CheckboxField` | 多选 | `dataSource` |
| `MultiSelectField` | 下拉多选 | `dataSource` |
| `NumberField` | 数字 | — |
| `RateField` | 评分 | — |
| `DateField` | 日期 | — |
| `CascadeDateField` | 级联日期 | — |
| `EmployeeField` | 成员 | `multiple` |
| `DepartmentSelectField` | 部门 | `multiple` |
| `CountrySelectField` | 国家 | `multiple` |
| `AddressField` | 地址 | — |
| `AttachmentField` | 附件 | — |
| `ImageField` | 图片 | — |
| `TableField` | 子表 | `children` |
| `AssociationFormField` | 关联表单 | `associationForm` |
| `SerialNumberField` | 流水号 | 自动生成 |

## 注意事项

- 临时文件写在 `.cache/` 目录中
- update 模式操作按顺序执行，注意依赖关系
- 字段匹配基于中文标签（`label.zh_CN`）
- 如需创建自定义展示页面（无字段），请使用 `yida-create-page`

