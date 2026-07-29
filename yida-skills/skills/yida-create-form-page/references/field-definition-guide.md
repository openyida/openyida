# 字段定义 JSON 指南

## 常用结构

```json
[
  { "type": "Divider", "title": "基本信息" },
  {
    "type": "ColumnContainer",
    "layout": "6:6",
    "children": [
      [{ "type": "TextField", "label": "申请人", "required": true }],
      [{ "type": "DepartmentSelectField", "label": "所属部门" }]
    ]
  },
  {
    "type": "ColumnContainer",
    "layout": "6:6",
    "children": [
      [{ "type": "DateField", "label": "申请日期" }],
      [{ "type": "SelectField", "label": "申请类型", "dataSource": [{"text":{"zh_CN":"采购","en_US":"采购","type":"i18n"},"value":"采购"}] }]
    ]
  },
  { "type": "Divider", "title": "业务信息" },
  { "type": "TextField", "label": "事项名称", "required": true }
]
```

## 字段属性

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | String | 是 | 字段类型 |
| `label` | String | 是 | 字段标签 |
| `required` | Boolean | 否 | 是否必填，默认 `false` |
| `placeholder` | String | 否 | 占位提示 |
| `behavior` | String | 否 | `NORMAL`（默认）/ `READONLY` / `HIDDEN` |
| `visibility` | String[] | 否 | `["PC", "MOBILE"]`（默认） |
| `dataSource` | Array | 条件必填 | 选项类字段必填 |
| `multiple` | Boolean | 否 | 是否多选 |
| `remoteDataSource` | Object | 否 | 选项类字段远程搜索数据源配置 |
| `children` | Object[] | 条件必填 | `TableField` / 展示布局组件必填 |
| `associationForm` | Object | 条件必填 | `AssociationFormField` 必填 |

选项类字段包括 `SelectField`、`MultiSelectField`、`RadioField`、`CheckboxField`。固定选项必须在字段 JSON 中提供非空 `dataSource`；不要省略选项源，也不要只写旧式 `options`。

## 展示/布局组件

### Divider

普通业务分组优先使用 Divider：

```json
{ "type": "Divider", "title": "基本信息" }
```

普通企业表单不写 `dividerType`，OpenYida 会默认生成 `bold-with-thin`。显式样式优先级为 `bold-with-thin`、`double-color-trapezoid`、`left-dot-title`、`solid` / `dashed` / `thick` / `dotted`。需要门户/强分区识别时，同一张表单可统一显式写 `dividerType: "multi-parallelograms-end"`。

### ColumnContainer

局部多列使用 ColumnContainer，适合短字段成组：

```json
{
  "type": "ColumnContainer",
  "layout": "6:6",
  "columnGap": "16px",
  "rowGap": "16px",
  "children": [
    [{ "type": "TextField", "label": "姓名" }],
    [{ "type": "NumberField", "label": "年龄" }]
  ]
}
```

### GroupContainer / PageSection

只在特殊场景使用，不要承载普通业务分组：

```json
{
  "type": "PageSection",
  "title": "高级配置",
  "showHeadDivider": true,
  "children": [
    { "type": "TextField", "label": "配置说明" }
  ]
}
```

## update changes

```json
[
  { "action": "add", "field": { "type": "TextField", "label": "备注" }, "after": "姓名" },
  { "action": "update", "label": "年龄", "changes": { "required": true } },
  { "action": "delete", "label": "旧字段" }
]
```

| 操作 | 必填属性 | 说明 |
|------|------|------|
| `add` | `field.type`, `field.label` | 新增字段，`after`/`before` 指定位置 |
| `delete` | `label` | 删除字段 |
| `update` | `label`, `changes` | 修改字段属性，子表内字段需 `tableLabel` |

## 支持的字段类型

| 字段类型 | 说明 | 特殊属性 |
|------|------|------|
| `TextField` | 单行文本 | - |
| `TextareaField` | 多行文本 | - |
| `RadioField` | 单选 | `dataSource` |
| `SelectField` | 下拉单选 | `dataSource` |
| `CheckboxField` | 多选 | `dataSource` |
| `MultiSelectField` | 下拉多选 | `dataSource` |
| `NumberField` | 数字 | - |
| `RateField` | 评分 | - |
| `DateField` | 日期 | - |
| `CascadeDateField` | 级联日期 | - |
| `EmployeeField` | 成员 | `multiple` |
| `DepartmentSelectField` | 部门 | `multiple` |
| `CountrySelectField` | 国家 | `multiple` |
| `AddressField` | 地址 | - |
| `AttachmentField` | 附件 | - |
| `ImageField` | 图片 | - |
| `TableField` | 子表 | `children` |
| `AssociationFormField` | 关联表单 | `associationForm` |
| `SerialNumberField` | 流水号 | 自动生成 |
| `Divider` | 分割线 | `title`、`dividerType`、`showTitle` |
| `ColumnContainer` | 分栏布局，映射 `ColumnsLayout` | `layout`、`columnGap`、`rowGap`、二维 `children` |
| `GroupContainer` / `PageSection` | 特殊分组容器，映射 `PageSection` | `label`/`title`、`showHeadDivider`、`children` |
