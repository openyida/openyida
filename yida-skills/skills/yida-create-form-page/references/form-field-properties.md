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

## 表单组件与布局

表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab、按钮组、图片、状态区、`Divider`、`ColumnContainer` 与业务字段。`create-form` 字段 JSON 使用下表中的结构组件；更新表单时保留其他已有组件。

| 结构组件 | 用法 | 典型场景 |
| --- | --- | --- |
| `Divider` | 作为独立字段插入字段数组，用 `title` 表达章节标题，按页面用途显式选择 `dividerType` | 普通业务分组、章节分隔、字段较多时提升可读性 |
| `ColumnContainer` | 用二维 `children` 表达多列，每个子数组是一列；内部字段仍按普通字段 JSON 写 | 开始/结束日期、姓名/工号、部门/岗位、金额/币种、联系人/电话等短字段成组 |

### 布局决策规则

先按业务任务确定区域、组件作用和响应式行为，再选择单列、局部多列、全局双列、卡片或章节布局。不要从字段数量机械推导固定结构，也不要把 `Divider` 当成每个分组的必选组件。

- 单列：适合字段较少、流程表单、移动端优先、长文本、附件、地址、子表、审批意见或需要逐项认真填写的内容。
- 局部多列：短字段且天然成对或成组时使用 `ColumnContainer`，例如开始/结束日期、姓名/工号、部门/岗位、金额/币种、联系人/电话。
- 全局布局：`--layout single|double|card|section` 设置整表布局起点；按业务和设备选择，再结合页面内容调整组件位置。
- 语义结构：按业务含义组织区域和层级。普通业务分组和章节分隔使用 `Divider`。

常用结构示例：

```text
ColumnContainer > Field
Divider > ColumnContainer > Field
Divider > Field
```

### 主题规则

本参考只说明字段 JSON 和表单布局属性。

生成建议：

- 默认 `Divider` 使用主题模式：不写 `colorType` 或写 `"theme"`。
- 不要为了“更好看”给每个 Divider 随机写 `backgroundColor` / `secondaryColor`。
- 只有用户明确指定颜色时，才使用 `colorType: "custom"` 并写 `backgroundColor`、`secondaryColor`、`titleColor`。
- 主题模式下，浅底、胶囊、梯形尾部等辅助色由应用主题变量 `--yida-divider-secondary-color` 控制。浅色内容通常接 `var(--color-brand1-2)`，深色内容应接当前主题的弱边界或弱填充色，避免在暗底上出现亮色横条。

### Divider

映射到 `componentName: "Divider"`。

OpenYida 支持以下 **23 个可见样式**，不接受 `none`（无分割线）。外观来自 `vc-deep-yida` 的 `components/yida-divider/index.tsx`、`style.less` 和样式选择器；场景列是选型建议，不是固定映射或优先级。

| `dividerType` | 实际外观 | 适合的内容 |
| --- | --- | --- |
| `solid` | 1px 实线 | 密集录入、正式资料 |
| `dashed` | 1px 虚线 | 补充资料、轻量清单 |
| `thick` | 3px 粗实线 | 需要明确章节边界的长文档 |
| `dotted` | 1px 点线 | 轻量问卷、辅助分段 |
| `bold-with-thin` | 标题下短粗线接长细线 | 有章节层次的业务申请 |
| `solid-center` | 标题居中，两侧细线 | 简短、对称的章节标题 |
| `solid-left` | 左短线、标题、右长线 | 左对齐的阅读或填写分段 |
| `left-dot-title` | 左圆点加标题 | 高频登记、紧凑字段组 |
| `light-left-bar` | 浅底标题条，左侧短竖条 | 审核、资料维护的分组 |
| `light-bar` | 浅底标题条 | 温和的资料采集、说明章节 |
| `dark-bar` | 主色实底标题条 | 需要强识别的少量章节；不是固定黑底 |
| `light-left-title` | 浅底横条，左侧主色圆角标签 | 服务办理、品牌资料分段 |
| `light-center-title` | 浅底横条，中间主色圆角标签 | 活动报名、居中章节 |
| `light-house-title` | 浅底横条，中间屋顶形标签 | 服务专题、活动章节 |
| `light-hexagon-title` | 浅底横条，中间六边形标题 | 专题展示、阶段章节 |
| `hexagon-title` | 六边形标题与两侧错层线 | 主题展示、强章节识别 |
| `badge-line` | 徽章式标题接细线 | 荣誉、资质或专题资料 |
| `multi-parallelograms-end` | 梯形标题，尾部多条斜杠 | 赛事、制造或有动势的专题 |
| `center-title-with-bar` | 中间标题，两侧粗色条 | 短标题、强对称章节 |
| `double-color-trapezoid` | 主色梯形标题拼浅底横条 | 品牌分区、项目资料 |
| `arrow-right-title` | 右箭头标题接浅底横条 | 有明确先后顺序的阶段；样式本身不提供流程操作 |
| `square-blocks-title` | 左侧双方块、标题及底部细线 | 项目、资源或技术资料 |
| `inner-ellipse-title` | 主色胶囊横条内嵌浅底椭圆标题 | 轻松的活动、服务专题 |

选型顺序：用户指定的有效样式优先；已有页面局部修改保留原有有效样式；新页面再按下面的业务场景选择。先排除不适合标题长度、内容密度和主题的形态，同页同层级复用一个主样式。

| 页面情况 | 推荐候选 | 选择依据 |
| --- | --- | --- |
| 高频登记、密集录入、正式资料，或标题较长、主要在手机使用 | `solid`、`solid-left`、`left-dot-title`、`light-bar` | 装饰轻，便于连续扫描和填写 |
| 审核、档案维护、多章节申请 | `light-left-bar`、`bold-with-thin`、`light-left-title`、`double-color-trapezoid` | 分组明确，便于定位不同资料段 |
| 辅助材料、问卷、轻量清单 | `dashed`、`dotted` | 分隔存在感较低，不抢正文 |
| 活动报名、服务专题，标题简短且适合居中 | `solid-center`、`light-center-title`、`light-house-title`、`inner-ellipse-title` | 用对称或柔和标签组织章节 |
| 项目阶段、技术资料、赛事或需要明显章节识别的页面 | `arrow-right-title`、`square-blocks-title`、`multi-parallelograms-end`、`light-hexagon-title`、`hexagon-title` | 用方向或几何形态强化分区；箭头不代表已有流程交互 |
| 资质、荣誉、品牌专题或少量重点章节 | `badge-line`、`dark-bar`、`center-title-with-bar`、`thick` | 视觉权重较强，避免在密集页面大量重复 |

**不知道如何选择时，随机轮换。** 场景不明确，或多个候选同样合适时，将合适的候选随机打乱，按页面依次选用。优先用本轮尚未用过的样式，用完再重新打乱；没有可用的场景判断依据时，从全部 23 种中轮换。每页只选一次，同页各分组复用，不逐条随机。

把选定样式和理由（例如“场景不明确，随机轮换”）写入现有 `design.md` 的页面说明，并显式填入该页每个 `Divider.dividerType`。后续生成、编译、重试和局部修改复用已记录的值，不重新抽签，不需要新增状态文件或 CLI 参数。

`form-fields` 示例仅演示布局，其中的分割线不代表推荐默认值；复用示例时按当前页面重新选择。

把“页面 → 样式 → 选择理由”写在现有 `design.md` 对应页面说明里，Fast 与 Plan 使用同一规则。表单结构通过组件树配置，Canvas 分组标题按相同外观原则实现。

未提供样式时 CLI 以 `bold-with-thin` 兜底，不替 AI 决定业务风格。显式的不支持值会报错，不静默替换。`dividerType` 写入 `props.type`；也接受历史别名 `dividerStyle`、`styleType`、`typeStyle` 和 `props.type`，按此前顺序取值，新生成统一用 `dividerType`。

`none` 不参与推荐、轮换或字段生成；确实不需要分隔的内容区直接省略 Divider 组件。复杂装饰主要用于短标题；长标题和窄屏优先选简单线型、圆点或浅底，发布后检查换行与截断。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `behavior` | `"NORMAL"` | 默认状态，支持 `"NORMAL"` / `"HIDDEN"` |
| `dividerType` | `"bold-with-thin"`（遗漏时兜底） | 从上表按页面选型，写入 `Divider.props.type`，不是 CLI 参数 |
| `showTitle` | `true` | 是否显示标题 |
| `title` | `"标题"` | 分割线标题，写入 `props.title` |
| `description` | `""` | 标题描述，写入 `props.description` |
| `tips` | `""` | 标题提示，写入 `props.tips` |
| `colorType` | `"theme"` | 配色类型，支持 `"theme"` / `"custom"` |
| `backgroundColor` | `"#0089ff"` | 自定义主题色 |
| `titleColor` | `"#171a1d"` | 自定义标题色 |
| `secondaryColor` | `"#cce5ff"` | 自定义背景/辅助色；仅在 `colorType: "custom"` 时使用，主题模式改 `--yida-divider-secondary-color` |

### ColumnContainer

映射到 `componentName: "ColumnsLayout"`，内部生成 `Column` 子节点。`children` 按列传二维数组。

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `layout` | `"6:6"` | 12 栅格布局比例，例如 `"12"`、`"6:6"`、`"4:4:4"`、`"3:9"` |
| `columnGap` | `"16px"` | 相邻列间距，写入 `props.columnGap` |
| `rowGap` | `"16px"` | 多行场景行间距，写入 `props.rowGap` |
| `display` | `"VERTICAL"` | 移动端排列方式，支持 `"VERTICAL"` / `"HORIZONTAL"` |
| `mobileRowGap` | `"0px"` | 移动端垂直布局行间距 |
| `children` | `[]` | 二维数组，每个子数组是一列内的字段或其他表单组件 |

### 分组组件

普通业务分组和章节分隔使用 `Divider`，横向字段排布使用 `ColumnContainer`。

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
