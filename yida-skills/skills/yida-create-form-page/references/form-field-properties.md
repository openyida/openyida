# 宜搭表单字段属性参考

本文档详细描述宜搭表单各字段类型的属性配置、默认值和使用说明。

## 通用属性

所有字段类型共享以下通用属性：

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | String | 是 | 字段类型 |
| `label` | String | 是 | 字段标签 |
| `required` | Boolean | 否 | 是否必填，**默认 `false`（非必填）** |
| `placeholder` | String | 否 | 占位提示文本 |
| `behavior` | String | 否 | 字段行为，`NORMAL`（正常，默认）/ `READONLY`（只读）/ `HIDDEN`（隐藏） |
| `visibility` | String[] | 否 | 显示端，`["PC", "MOBILE"]`（默认）/ `["PC"]`（仅 PC）/ `["MOBILE"]`（仅移动端） |
| `labelAlign` | String | 否 | 标签对齐方式，`top`（默认）/ `left` / `right` |

---

## 表单展示/布局组件

展示/布局组件按 `vc-deep-yida` 表单版原型中的真实字段生成，不使用未确认的组件名。默认用 `Divider` 做章节标题和分隔，用 `ColumnContainer` 做左右/多列布局；普通分组不要使用 `GroupContainer` / `PageSection`，只有需要折叠、边框、整块隐藏、整块权限或平台分组容器语义时再使用。

### 布局决策规则

默认表单是单列。不要为了“更高级”默认把整表改成双列，也不要用 `GroupContainer` / `PageSection` 做普通分组。

- 默认单列：字段较少、流程表单、移动端优先、长文本、说明、附件、地址、子表、审批意见、需要逐项认真填写的字段。
- 局部多列：短字段且天然成对或成组时使用 `ColumnContainer`，例如开始/结束日期、姓名/工号、部门/岗位、金额/币种、联系人/电话。
- 全局 `--layout double`：只有用户明确要求“整个表单双列”时才使用；一般更推荐在字段 JSON 内用 `ColumnContainer` 做局部多列。
- 语义分组：按业务含义分段，不按字段数量平均分。常见分组包括“基本信息”“业务信息”“时间计划”“补充材料”“审批信息”。

推荐结构：

```text
Divider > ColumnContainer > Field
Divider > Field
```

### 主题规则

表单布局组件应跟随运行态主题变量。本参考只说明字段 JSON 如何消费主题，以及 `Divider` 出现时 OpenYida 必须执行的主题样式注入规则。

生成建议：

- 默认 `Divider` 使用主题模式：不写 `colorType` 或写 `"theme"`。
- 不要为了“更好看”给每个 Divider 随机写 `backgroundColor` / `secondaryColor`。
- 只有用户明确指定颜色时，才使用 `colorType: "custom"` 并写 `backgroundColor`、`secondaryColor`、`titleColor`。
- 表单中出现 `Divider` 时，OpenYida 会注入 `style#yida-global-theme`，并尽可能同步到当前页面和同源 `window.top`。

### Divider

映射到 `componentName: "Divider"`。

样式推荐顺序以宜搭历史 AI 应用工具 `dingtalk-ai-app` 的企业表单建议为优先，再按当前 CLI 支持的 `Divider.props.type` 白名单生成：

1. 默认推荐 `bold-with-thin`，适合企业级业务表单的章节标题。普通场景不要写 `dividerType`，OpenYida 会默认写入 `props.type: "bold-with-thin"`。
2. `double-color-trapezoid`，适合需要更强品牌识别和区块视觉权重的表单。
3. `left-dot-title`，适合轻量分组、字段较密但不希望分割线太重的表单。
4. `solid` / `dashed` / `thick` / `dotted` 等纯线型样式只用于低调分隔、兼容兜底或用户明确指定线型。
5. `multi-parallelograms-end` 来自 `dingtalk-ai-app` 的门户/强分区场景经验，只在用户明确要求门户、强分区、流程阶段强调或已有线上表单已使用该样式时显式使用。

生成 Schema 时默认写入 `props.type: "bold-with-thin"`。只有在用户明确指定样式时才通过 `dividerType` 覆盖 `props.type`。同一张表单中的 `Divider` 必须保持同一个 `props.type`，避免章节样式跳变。如果是修改已有表单，先看线上 Schema 中 Divider 的原始 `props.type`，属于上述支持清单或强分区特殊值时优先复用。

执行规则：表单中出现 `Divider` 时，OpenYida 必须注入运行时主题样式 `style#yida-global-theme`，并尽可能同步到当前页面和同源 `window.top`。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `behavior` | `"NORMAL"` | 默认状态，支持 `"NORMAL"` / `"HIDDEN"` |
| `dividerType` | `"bold-with-thin"` | 写入 vc 的 `props.type`；优先级：`bold-with-thin` → `double-color-trapezoid` → `left-dot-title` → `solid` / `dashed` / `thick` / `dotted`；强分区特殊场景可显式用 `multi-parallelograms-end` |
| `showTitle` | `true` | 是否显示标题 |
| `title` | `"标题"` | 分割线标题，写入 `props.title` |
| `description` | `""` | 标题描述，写入 `props.description` |
| `tips` | `""` | 标题提示，写入 `props.tips` |
| `colorType` | `"theme"` | 配色类型，支持 `"theme"` / `"custom"` |
| `backgroundColor` | `"#0089ff"` | 自定义主题色 |
| `titleColor` | `"#171a1d"` | 自定义标题色 |
| `secondaryColor` | `"#cce5ff"` | 自定义背景/辅助色 |

### ColumnContainer

映射到 `componentName: "ColumnsLayout"`，内部生成 `Column` 子节点。`children` 按列传二维数组。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `layout` | `"6:6"` | 12 栅格布局比例，例如 `"12"`、`"6:6"`、`"4:4:4"`、`"3:9"` |
| `columnGap` | `"16px"` | 相邻列间距，写入 `props.columnGap` |
| `rowGap` | `"16px"` | 多行场景行间距，写入 `props.rowGap` |
| `display` | `"VERTICAL"` | 移动端排列方式，支持 `"VERTICAL"` / `"HORIZONTAL"` |
| `mobileRowGap` | `"0px"` | 移动端垂直布局行间距 |
| `children` | `[]` | 二维数组，每个子数组是一列内的字段或展示组件 |

### GroupContainer / PageSection

`GroupContainer` 是 `PageSection` 的别名，映射到 `componentName: "PageSection"`。标题写入 `props.title`，不会写 `props.label`。

默认不要为了普通字段分段而使用本组件。普通分段应写成 `Divider` + 后续字段，横向字段排布应写成 `Divider` + `ColumnContainer`。只有当整块内容需要作为一个容器被折叠、加边框、整体隐藏或承接平台分组样式时，才使用 `GroupContainer` / `PageSection`。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `behavior` | `"NORMAL"` | 默认状态，支持 `"NORMAL"` / `"HIDDEN"` |
| `label` / `title` | `"分组"` | 分组标题，写入 `props.title` |
| `showHeader` | `true` | 是否显示头部 |
| `tooltip` / `tips` | `""` | 用户提示，写入 `props.tooltip` |
| `showHeadDivider` | `true` | 是否显示头部分割线 |
| `sectionHeaderStyle` | `"origin"` | 分组头部样式 |
| `sectionHeaderBgColor` | `"#0089ff"` | 头部背景配色 |
| `sectionHeaderTitleColor` | `"#171A1D"` | 标题颜色 |
| `pcStyle` | `{ "value": "origin" }` | PC 端布局样式 |
| `showBorder` | `false` | PC 端显示边框 |
| `withMargin` | `false` | PC 端外边距 |
| `withPadding` | `true` | PC 端内边距 |
| `mobileStyle` | `{ "value": "origin" }` | Mobile 端布局样式 |
| `showBorderMobile` | `false` | Mobile 端显示边框 |
| `withMarginMobile` | `false` | Mobile 端外边距 |
| `withPaddingMobile` | `false` | Mobile 端内边距 |

---

## TextField / TextareaField

单行文本和多行文本字段。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `validationType` | `"text"` | 校验类型 |
| `maxLength` | `200` | 最大字符数 |
| `hasClear` | `true` | 显示清除按钮 |
| `isCustomStore` | `true` | 自定义存储 |
| `scanCode.enabled` | `false` | 扫码输入 |

---

## NumberField

数字字段，用于金额、数量、年龄等。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `precision` | `0` | 小数位数 |
| `step` | `1` | 步进值 |
| `thousandsSeparators` | `false` | 千分位分隔符 |
| `isCustomStore` | `true` | 自定义存储 |
| `innerAfter` | "" | 单位 |

---

## RateField

评分字段，用于满意度评价等星级打分。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `count` | `5` | 星级总数 |
| `allowHalf` | `false` | 允许半星 |
| `showGrade` | `false` | 显示等级文案 |

---

## RadioField / CheckboxField

单选和多选字段，用于性别、状态、兴趣爱好等互斥或可多选的选项。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `dataSourceType` | `"custom"` | 数据源类型 |
| `valueType` | `"custom"` | 值类型 |
| `dataSource` | 数组 | 选项数据源数组，每个元素是选项对象 |
| `defaultDataSource` | 对象 | 默认数据源配置，包含 `options` 数组 |

### 选项数据格式

`dataSource` 数组元素结构：

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | Object | 是 | 选项显示文本，i18n 对象格式 |
| `text.zh_CN` | String | 是 | 中文显示文本，**必须是字符串** |
| `text.en_US` | String | 是 | 英文显示文本，**必须是字符串** |
| `text.type` | String | 是 | 固定为 `"i18n"` |
| `value` | String | 是 | 选项值，**必须是字符串** |
| `sid` | String | 是 | 选项唯一标识，格式为 `serial_xxx` |
| `disable` | Boolean | 否 | 是否禁用，默认 `false` |
| `defaultChecked` | Boolean | 否 | 是否默认选中，默认 `false` |

### defaultDataSource 对象结构

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `complexType` | String | 固定为 `"custom"` |
| `options` | Array | 选项数组，元素结构与 `dataSource` 相同 |
| `formula` | String | 公式配置，默认空字符串 |
| `url` | String | 数据源 URL，默认空字符串 |
| `searchConfig` | Object | 搜索配置 |
| `searchConfig.type` | String | 请求类型，固定为 `"JSONP"` |
| `searchConfig.url` | String | 请求 URL，默认空字符串 |
| `searchConfig.beforeFetch` | String | 请求前处理脚本，默认空字符串 |
| `searchConfig.afterFetch` | String | 请求后处理脚本，默认空字符串 |

### 完整示例

```json
{
  "dataSourceType": "custom",
  "dataSource": [
    {
      "text": { "zh_CN": "选项一", "en_US": "Option 1", "type": "i18n" },
      "value": "选项一",
      "sid": "serial_khe7yak4",
      "disable": false,
      "defaultChecked": false
    }
  ],
  "defaultDataSource": {
    "complexType": "custom",
    "options": [
      {
        "text": { "zh_CN": "选项一", "en_US": "Option 1", "type": "i18n" },
        "value": "选项一",
        "sid": "serial_khe7yak4",
        "disable": false,
        "defaultChecked": false
      }
    ],
    "formula": "",
    "url": "",
    "searchConfig": {
      "type": "JSONP",
      "url": "",
      "beforeFetch": "",
      "afterFetch": ""
    }
  }
}
```

---

## SelectField / MultiSelectField

下拉单选和下拉多选字段，适合选项较多（>5）的场景。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `showSearch` | `true` | 支持搜索 |
| `autoWidth` | `true` | 自动宽度 |
| `filterLocal` | `true` | 本地过滤 |
| `mode` | `"single"` / `"multiple"` | 选择模式 |
| `dataSourceType` | `"custom"` | 数据源类型 |
| `dataSource` | 数组 | 选项数据源数组，每个元素是选项对象 |
| `defaultDataSource` | 对象 | 默认数据源配置，包含 `options` 数组 |

### 选项数据格式

与 RadioField/CheckboxField 完全一致，每个选项对象包含以下属性：

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | Object | 是 | 选项显示文本，i18n 对象格式 |
| `text.zh_CN` | String | 是 | 中文显示文本，**必须是字符串** |
| `text.en_US` | String | 是 | 英文显示文本，**必须是字符串** |
| `text.type` | String | 是 | 固定为 `"i18n"` |
| `value` | String | 是 | 选项值，**必须是字符串** |
| `sid` | String | 是 | 选项唯一标识，格式为 `serial_xxx` |
| `disable` | Boolean | 否 | 是否禁用，默认 `false` |
| `defaultChecked` | Boolean | 否 | 是否默认选中，默认 `false` |

### defaultDataSource 对象结构

- `complexType`: `"custom"`
- `options`: 选项数组，元素结构与 `dataSource` 相同
- `formula`: 公式配置，默认空字符串
- `url`: 数据源 URL，默认空字符串
- `searchConfig`: 搜索配置对象，包含 `type`（固定 `"JSONP"`）、`url`、`beforeFetch`、`afterFetch`

---

## DateField

日期字段，用于生日、截止日期等。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `format` | `"YYYY-MM-DD"` | 日期格式 |
| `hasClear` | `true` | 显示清除按钮 |
| `resetTime` | `false` | 重置时间 |
| `disabledDate.type` | `"none"` | 禁用日期规则 |

### format 格式

- `"YYYY"`：年
- `"YYYY-MM"`：年-月
- `"YYYY-MM-DD"`：年-月-日
- `"YYYY-MM-DD HH:mm"`：年-月-日 时分
- `"YYYY-MM-DD HH:mm:ss"`：年-月-日 时分秒

---

## CascadeDateField

级联日期字段，用于日期范围选择。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `format` | `"YYYY-MM-DD"` | 日期格式 |
| `hasClear` | `true` | 显示清除按钮 |
| `resetTime` | `false` | 重置时间 |

### format 格式

- `"YYYY"`：年
- `"YYYY-MM"`：年-月
- `"YYYY-MM-DD"`：年-月-日
- `"YYYY-MM-DD HH:mm"`：年-月-日 时分
- `"YYYY-MM-DD HH:mm:ss"`：年-月-日 时分秒

---

## EmployeeField

成员字段，选择组织内成员。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `userRangeType` | `"ALL"` | 人员范围 |
| `showEmpIdType` | `"NAME"` | 显示方式 |
| `startWithDepartmentId` | `"SELF"` | 起始部门 |
| `renderLinkForView` | `true` | 查看时渲染链接 |
| `closeOnSelect` | `false` | 选择后关闭 |

> 如果需要人员默认选中当前登录人，用法参考 `../references/employee-field.md`

---

## DepartmentSelectField

部门字段，选择组织内部门。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `deptRangeType` | `"ALL"` | 部门范围 |
| `mode` | `"single"` | 选择模式 |
| `isShowDeptFullName` | `false` | 显示部门全路径 |
| `hasSelectAll` | `false` | 全选按钮 |

---

## CountrySelectField

国家字段，选择国家/地区。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `mode` | `"single"` | 选择模式 |
| `showSearch` | `true` | 支持搜索 |
| `hasSelectAll` | `false` | 全选按钮 |

---

## AddressField

地址字段，用于收货地址等。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `countryMode` | `"default"` | 国家模式 |
| `addressType` | `"ADDRESS"` | 地址类型 |
| `enableLocation` | `true` | 启用定位 |
| `showCountry` | `false` | 显示国家 |

---

## AttachmentField

附件上传字段。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `listType` | `"text"` | 列表展示类型 |
| `multiple` | `true` | 允许多文件 |
| `limit` | `9` | 最大文件数 |
| `maxFileSize` | `100` | 最大文件大小(MB) |
| `autoUpload` | `true` | 自动上传 |
| `onlineEdit` | `false` | 在线编辑 |

---

## ImageField

图片上传字段。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `listType` | `"image"` | 列表展示类型 |
| `multiple` | `true` | 允许多图片 |
| `limit` | `9` | 最大图片数 |
| `maxFileSize` | `50` | 最大文件大小(MB) |
| `accept` | `"image/*"` | 接受文件类型 |
| `enableCameraDate` | `true` | 拍照水印日期 |
| `enableCameraLocation` | `true` | 拍照水印定位 |
| `onlyCameraUpload` | `false` | 仅拍照上传 |

---

## TableField

表格字段（子表），用于结构化数据。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `showIndex` | `true` | 显示行号 |
| `pageSize` | `20` | 每页行数 |
| `maxItems` | `500` | 最大行数 |
| `minItems` | `1` | 最小行数 |
| `layout` | `"TABLE"` | PC 端布局 |
| `mobileLayout` | `"TILED"` | 移动端布局 |
| `theme` | `"split"` | 表格主题 |
| `showActions` | `true` | 显示操作列 |
| `showDelAction` | `true` | 显示删除按钮 |
| `showCopyAction` | `false` | 显示复制按钮 |
| `enableExport` | `true` | 允许导出 |
| `enableImport` | `true` | 允许导入 |
| `enableBatchDelete` | `false` | 批量删除 |
| `enableSummary` | `false` | 启用汇总 |
| `isFreezeOperateColumn` | `true` | 冻结操作列 |

---

## AssociationFormField

关联表单字段。

> 详细用法参考 `../references/association-form-field.md`

---

## SerialNumberField

流水号字段，自动生成唯一编号。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `serialNumberRule` | 默认规则（前缀+自动递增） | 流水号生成规则数组 |
| `serialNumPreview` | `"serial00001"` | 流水号预览 |
| `serialNumReset` | `1` | 重置起始值 |
| `syncSerialConfig` | `false` | 是否同步流水号配置 |
| `formula` | 自动生成 | 流水号公式（由系统自动生成，包含 corpId、appType、formUuid、fieldId 和规则配置） |

### 默认流水号规则

- 规则1：固定前缀 "serial"（4位）
- 规则2：自动递增数字（5位，从1开始，不重置）

### formula 格式

formula 是对象格式，不是字符串：

```json
{
  "formula": {
    "expression": "SERIALNUMBER(\"<corpId>\", \"<appType>\", \"<formUuid>\", \"<fieldId>\", \"<escapedRuleJson>\")"
  }
}
```

其中 `<escapedRuleJson>` 是 `{ "type": "custom", "value": <serialNumberRule数组> }` 的 JSON 字符串，需对双引号转义（`"` → `\"`）。

> 详细用法参考 `serial-number-field.md`
