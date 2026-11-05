# 表单数据格式指南

## 基础规则

- `searchFieldJson` 传字符串，不直接传对象
- `formDataJson` 传字符串，不直接传对象
- `updateFormDataJson` 传字符串，不直接传对象
- `dynamicOrder` 传字符串，不直接传对象
- 保存、更新和测试数据中，`DateField` 传毫秒时间戳数字，`CascadeDateField` 传开始、结束毫秒时间戳数组，空端点传 `""`

`data seed form/process` 的 records-file 支持 ISO 日期字符串，由 CLI 转换后再保存；直接 `data create/update` 和 API 写入仍使用上述毫秒格式。seed 的 ID 回执消费、关联顺序与恢复规则见[技能正文](../SKILL.md#直接消费回执与关联-id)。

## 字段级写入核验

普通表单 create/update 可加 `--verify-write --json`。CLI 获取当前 Schema，写前聚合错误；仅发出一次写请求，随后按实例 ID 回读本次提交字段。使用真实 fieldId；`--resolve-aliases` 只解析已配置别名，不把显示名称当作字段 ID。同名、跨子表和重复引用不静默选择。

- 文本、单选使用字符串；数字、评分、日期使用有限数字，日期为毫秒。数字零不视为空。多选、人员、部门使用数组；日期区间为两个数字或空端点；子表使用行对象数组，子字段必须属于该子表。
- 成员、部门写入真实 ID 数组，回读时原字段可能是名称数组，CLI 优先核对同字段 `_id` 身份投影，包含子表内字段；名称不能代替 ID。复选、多选、成员、部门、图片、附件提交明确 `[]`，投影缺失时，可使用同响应保留的唯一同类型原始单元格：`fieldData={}` 是当前服务端存储空集合的序列化表示；子表还需通过行数、rowId和文本锚点核对。整个单元格或快照缺失、隐藏、损坏、重复、错行、类型不符或矛盾非空投影仍失败；不把任意缺字段当空值。
- 关联字段按已有五字段规则写入，回读时读取原字段或 `_id` 投影，以关联实例 ID 核对。图片/附件使用带字符串文件 ID 或完整 URL 的对象数组，以资源身份核对，不宣称核验全部文件元数据。回读中的数组 JSON 字符串会按字段类型解码，普通文本不做 JSON 解码。
- 关联 ID 回读一致只证明引用身份，不证明页面展示。`_id` 投影可能有两层 JSON 编码；页面须按[关联记录显示](../../yida-canvas-data-binding/SKILL.md#关联记录显示)解码并核对实际客户名称，不能直接输出 JSON，也不能因此把正确关联重写为文本。
- `readbackVerified=true` 表示本次提交字段核对通过；缺失回读字段不当作空值成功。失败仍保留已接受写入的实例身份，返回 `mutationAccepted=true`、`retrySafe=false` 和核实已有实例的提示。不要因核验失败重新创建记录。

## 查询条件格式

```json
[
  {
    "key": "字段ID",
    "value": "搜索值",
    "type": "查询类型，见下表",
    "operator": "操作符",
    "componentName": "组件英文名，见下表"
  }
]
```

示例：

```bash
--search-json '[{"key":"textField_xxx","value":"测试","type":"TEXT","operator":"eq","componentName":"TextField"}]'
```

## 常见字段值格式

先用 `get-schema --field-map-json` 获取真实字段 ID 填入 `key`，再按表填写 `componentName`、`type`、`value` 和括号中的 `operator`。`type` 是查询类型；保存 / 更新只传字段值。多条件按 AND 组合，完整操作符见[查询条件指南](../../../references/query-condition-guide.md)。

| 组件类型（`componentName`） | 查询 `type` | 查询 `value`（操作符） | 保存 / 更新值 |
| --- | --- | --- | --- |
| `TextField` / `TextareaField` | `TEXT` | `"文本"`（eq / like） | `"文本"` |
| `NumberField` | `DOUBLE` | `1`（eq / gt / ge / lt / le）或 `[1,10]`（between） | `1` |
| `RateField` | `DOUBLE` | `3`（eq / gt / ge / lt / le）或 `[2,4]`（between） | `3` |
| `RadioField` / `SelectField` | `ARRAY` | `"选项值"`（eq）或 `["选项值"]`（contains） | `"选项值"` |
| `CheckboxField` / `MultiSelectField` | `ARRAY` | `["选项值"]`（contains） | `["选项值一","选项值二"]` |
| `DateField` | `DOUBLE` | 毫秒时间戳数字（eq / gt / ge / lt / le）或 `[开始毫秒时间戳,结束毫秒时间戳]`（between） | 毫秒时间戳数字，如 `1719705600000` |
| `CascadeDateField` | `DOUBLE` | `[[开始下限,开始上限],[结束下限,结束上限]]`，省略 operator | `[开始毫秒时间戳,结束毫秒时间戳]`；空端点用 `""` |
| `EmployeeField` | `STRING` | `"userId"`（eq）或 `["userId"]`（contains） | `["userId"]` |
| `DepartmentSelectField` | `ARRAY` | `1123456` 或 `["1123456"]` | `["1123456"]` |
| `CitySelectField` | `STRING` | `[省ID,市ID,区ID]` | `[省ID,市ID,区ID]` |
| `CountrySelectField` / `AddressField` | — | 按实际查询能力确认 | 见下方国家与地址示例 |
| `ImageField` / `AttachmentField` | `TEXT` | 按实际字段条件查询 | 文件对象数组，见下方文件示例 |
| `TableField` | `TEXT` | `"关键词"`（contains）；子字段条件带 `parentId` | `[{"textField_xxx":"值"}]` |
| `AssociationFormField` | — | 先查询关联目标表，再按业务关系定位记录 | `[{"appType":"xxx","formUuid":"xxx","formType":"receipt","instanceId":"xxx","title":"关联记录标题"}]` |

## 国家与地址的固定 mock 示例

```json
{
  "countrySelectField_xxx": [{"value":"CN","text":{"zh_CN":"中国"}}],
  "addressField_xxx": {
    "regionIds":[110000,110100,110105,110105009],
    "regionText":[{"zh_CN":"北京"},{"zh_CN":"北京市"},{"zh_CN":"朝阳区"},{"zh_CN":"亚运村街道"}],
    "address":"亚运村（测试样例）"
  }
}
```

使用真实 fieldId。国家多选需 `multiple=true`。地址仅默认国内 `ADDRESS`，核验 regionIds 与 address。

## 图片与附件

准备 mock 记录时，附件和图片统一使用以下默认文件引用；业务已指定文件时使用指定引用。字段 ID 替换为真实 Schema 中的 ID。

```json
{
  "attachmentField_xxx": [{"name":"附件示例.jpg","downloadUrl":"https://img.alicdn.com/imgextra/i3/O1CN01unOuIwZRQ4J3OTaP_!!6000000005693-0-tps-1672-941.jpg"}],
  "imageField_xxx": [{"name":"图片示例.jpg","downloadUrl":"https://img.alicdn.com/imgextra/i3/O1CN01unOuIwZRQ4J3OTaP_!!6000000005693-0-tps-1672-941.jpg"}]
}
```

文件类型、大小按实际资源响应填写；CDN 可能根据请求将 JPG 转为 WebP。对象支持 `fileId`、`id`、`downloadUrl` 或 `url` 作为资源身份，核验优先文件 ID。seed 使用传入的引用；需要真实上传与文件绑定时按[文件上传](../../yida-canvas-custom-page/references/file-upload.md)执行。身份回读一致不代表文件内容、权限或所有文件类型均已验收。

## 保存 / 更新格式

```json
{
  "textField_xxx": "文本",
  "numberField_xxx": 10,
  "dateField_xxx": 1719705600000,
  "employeeField_xxx": ["2212173665758008"]
}
```

更新时只传要修改的字段：

```json
{
  "textField_xxx": "更新后的值"
}
```

## 排序格式

```json
{"numberField_1ac":"+"}
```

## 为空与不为空（is / is_not）

判断字段有无值时，`is` 与 `is_not` 的 `value` 都固定传 `""`；`type` 仍使用字段的查询类型。例如 `DateField` 使用 `DOUBLE`。这里的空字符串是查询参数，保存格式仍按上表填写。

日期为空：

```bash
openyida data query form APP_xxx FORM-xxx --search-json '[{"key":"dateField_xxx","componentName":"DateField","type":"DOUBLE","operator":"is","value":""}]'
```

日期不为空：

```bash
openyida data query form APP_xxx FORM-xxx --search-json '[{"key":"dateField_xxx","componentName":"DateField","type":"DOUBLE","operator":"is_not","value":""}]'
```

日期零时间戳和数字 `0` 属于有值，`is_not` 会保留这些记录。页面调用将条件数组传给 `JSON.stringify()`，再赋给 `searchFieldJson`。

日期区间两端均未填，用两个端点条件按 AND 组合：

```json
[
  {"key":"cascadeDateField_xxx.start","componentName":"DateField","type":"DOUBLE","operator":"is","value":""},
  {"key":"cascadeDateField_xxx.end","componentName":"DateField","type":"DOUBLE","operator":"is","value":""}
]
```

日期区间两端均已填：

```json
[
  {"key":"cascadeDateField_xxx.start","componentName":"DateField","type":"DOUBLE","operator":"is_not","value":""},
  {"key":"cascadeDateField_xxx.end","componentName":"DateField","type":"DOUBLE","operator":"is_not","value":""}
]
```

“任一端已填”使用已填端点数 `gt 0`；多选未选择、子表无行分别按选项数、行数查询。计数与原值同步维护，具体见查询指南。

## 日期字段（DateField / CascadeDateField）

直接使用 `data create/update` 或 API 录入、更新数据时，日期字段必须写入毫秒级时间戳；`data seed form` 的字符串转换由 CLI 完成：

```json
{
  "dateField_xxx": 1719705600000,
  "cascadeDateField_xxx": [1719705600000, 1722384000000]
}
```

`DateField` 的 `0` 是有效时间戳。日期区间部分填写时，空端点使用 `""`，例如 `[1719705600000, ""]`。

先按业务时区转换，再将数字填入 `--data-json` 或 `--data-file`。例如业务使用北京时间，`2026-10-18` 当天零点应写为 `1792252800000`：

```js
new Date('2026-10-18T00:00:00+08:00').getTime() // 1792252800000
```

时间统一按业务时区转换为毫秒。空值查询使用 `is` / `is_not`；区间按 `.start` / `.end` 查询，完整写法见[查询条件指南](../../../references/query-condition-guide.md)。新增字段写入历史记录时使用 `--use-latest-version y`，再回读确认实际值。

## 关联表单字段（AssociationFormField）

关联表单字段用于引用其他表单的数据记录，数据格式较为特殊。

### 保存格式

必须传入**数组对象**，每个对象包含五个必填字段；`subTitle` 可选，省略时 CLI 会补为空字符串：

```json
[
  {
    "appType": "APP_xxx",
    "formUuid": "FORM-xxx",
    "formType": "receipt",
    "instanceId": "FINST-xxx",
    "title": "客户名称",
    "subTitle": ""
  }
]
```

| 字段 | 说明 |
| --- | --- |
| `appType` | 被关联表单所属应用的 appType |
| `formUuid` | 被关联表单的 formUuid |
| `formType` | 被关联表单类型，普通表单 `receipt`，流程表单 `process`；以目标真实类型为准 |
| `instanceId` | 普通记录使用已核验 formInstId；流程实例使用已核验 processInstanceId。字段名统一为 instanceId，类型与目标匹配 |
| `title` | 被关联记录在关联组件中展示的标题，应取真实记录标题字段值 |
| `subTitle` | 可选的展示副标题；无值时传空字符串或省略 |

### 示例

```bash
# 已有目标记录且没有可用的已核验 seed 回执时，查询真实 formInstId
openyida data query form APP_xxx FORM-客户表 --size 1
# 返回: formInstId: "FINST-ABC123"

# 使用已核验 seed 回执或上述查询中的 ID；seed 回执按 recordIndex 消费，不额外查 ID
openyida data create form APP_xxx FORM-商机表 --expect-form-name 商机表 --expect-form-type receipt --verify-write --json --data-json '{
  "textField_xxx": "商机名称",
  "associationFormField_xxx": [{"appType":"APP_xxx","formUuid":"FORM-客户表","formType":"receipt","instanceId":"FINST-ABC123","title":"杭州客户"}]
}'
```

### 查询返回格式

查询时返回的 `formData` 中，关联表单字段以 `_id` 后缀显示：

```json
{
  "associationFormField_xxx_id": "\"[{...}]\""
}
```

`associationFormField_xxx_id` 是查询投影出的只读派生字段，不能复制回 create/update payload。写入时必须使用不带 `_id` 后缀的原始字段 `associationFormField_xxx`。

### 注意事项

- **instanceId 命名**：保存时字段名必须是 `instanceId`，不是 `formInstId`
- **数组格式**：即使只关联一条数据，也必须使用数组格式 `[{...}]`
- **五字段必填**：`appType`、`formUuid`、`formType`、`instanceId`、`title` 缺一不可；CLI 会在请求前拒绝不完整值
- **跨应用关联**：如果关联的是其他应用的表单，需要使用对应应用的 appType
- **服务端约束**：权限、过滤和回填结果按实际回读验收；失败保留已接受实例 ID，按回执核查

### 场景与边界

| 场景 | 格式与处理 |
| --- | --- |
| 单选 / 多选 | 均为对象数组；Schema 明确 `multiple: false` 时最多一项；多选不允许重复 `instanceId` |
| 创建 / 更新 / seed / 流程数据写入 | 共用完整五字段检查，`subTitle` 省略补 `""`；不接受 JSON 字符串、裸 ID、单对象代替数组 |
| 清空 / 不修改 | 清空提交 `[]`；更新时省略字段表示不修改；写入 `null`、`""` 拒绝，不猜测清空意图 |
| 跨应用 / 流程目标 | 使用目标 appType、formUuid、formType；seed 或 `--verify-write` 按已读取 Schema 检查目标和单选约束，不为校验新增查询 |
| 子表中的关联 | 在子表行对象内使用真实子字段 ID 和同一数组格式；递归检查并补 subTitle；只读 `_id` 不可写；平台省略空关联投影时只使用同响应 instValue 中对应行的明确字段值核验 |
| 回读 | 关联数组可为原生数组、单层或双层 JSON 编码；`_id` 投影只读；只含 instanceId 的投影可用于身份核验 |
| 回读一致性 | 校验全部实例 ID，忽略多选顺序和标题改名；返回了 appType/formUuid/formType 时必须与写入及 Schema 一致，不能只凭相同 ID 认定成功 |
| 页面展示 | 主表复用 `readCanvasAssociation`；子表先 `readCanvasSubformRows` 再逐行读取关联；显式空值为 empty，缺失/隐藏、损坏、重复关联为 error；缺标题先用页面已加载名称字典，无法解析则报错 |

Schema 约束只能在 Schema 已读取时检查；未开启 `--verify-write` 或别名解析的旧单条写入仍进行数组格式检查，不额外请求 Schema。返回只含 ID 时不能证明服务端省略的目标元数据，也不能证明权限、过滤规则、自动回填或流程状态正确。流程关联只接受真实允许关联的已有实例，seed 不负责发起流程。未知格式应显式报错并检查实际回执，不把任意对象/文本转成展示名称，也不因失败重复写入。

## 实现建议

- 统一把 CLI 传入的 JSON 参数当作字符串接收
- 在发送请求前再做 `json.dumps(...)` 或直接透传字符串
- `currentPage` 从 `1` 开始
- `pageSize` 一般写 `50`，并且不超过 `100`
