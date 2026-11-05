# 条件与变量

## 什么时候用

比较字段、选择变量来源、给数据或连接器参数赋值，或者在通知中展示表单内容时。条件分支、条件选人和多人会签分别配置。

## 必填配置

先从真实 schema 确认字段 ID、组件类型和子表归属，再确定值来自哪里。

| 场景 | 格式或来源 |
| --- | --- |
| 流程分支比较 | `fieldId/fieldName/componentType/op/value`，分支用 `logic: AND/OR` |
| 自动化触发/分支比较 | `fieldId/fieldName/componentType/opCode/value/valueType`；分别放到顶层 `triggerConditions` 或分支 `conditions` |
| 自动化取数筛选 | 左侧 `bFieldId` 是目标表字段，右侧 `aFieldId` 是触发表单或上游节点字段；固定值须设置 `valueType: literal` |
| 数据/连接器赋固定值 | `valueType: literal` |
| 自动化引用字段或上游输出 | `valueType: processVar`；触发表单字段 ID 或 `${别名}.字段ID` |
| 公式赋值 | `valueType: column`，公式按对应节点契约编写 |
| 自动化公式的设计器展示源码 | 可提供 `__source`，上游引用用 `#{别名//字段ID}` |
| 消息标题/正文中的触发表单字段 | `#{fieldId-ComponentType}#` |
| 批量新增中的当前源行 | `${batchSource别名}.字段ID`，CLI 转为平台的 `batch_` 引用 |

流程原生组件中的上游引用采用真实节点 ID；不要套用仅由自动化 spec 解析的别名。消息模板语法也不能直接当作查询条件或赋值表达式。

## 最小示例

取数右侧选择“公式”时，使用 `valueType: column`，在 `value` 中同时保存执行文本、编辑器原文和显示文字，见 [节点表达式](../../yida-formula/references/automation-formulas.md)。左侧是目标表字段，右侧是指定的触发记录或上游节点的值。

需要复杂配置时，读取 [字段、公式、固定值一起过滤的完整 spec](../../yida-formula/references/node-examples.md#按编号字段嵌套公式和固定状态取数) 或 [两层分支及 AND/OR 公式](../../yida-formula/references/node-examples.md#嵌套分支先决定是否复核再决定级别)。当前取数 conditions 是平铺条件，节点级 logic 为 AND 或 OR；右侧公式能嵌套，不代表目标表多字段筛选支持任意嵌套条件树。

### 获取数据节点：按条件过滤 → 字段

适用于 `dataRetrieve` 的获取单条／多条数据节点。左侧是目标表的待筛选字段，右侧可选固定值、触发记录字段或已执行上游单条节点的字段。例如“目标库存 < 上游记录的库存下限”，不是在触发开始节点配置，也不是自动逐行比较目标表自己的两列。

先分别查询来源表和目标表的字段：

```bash
openyida get-schema APP_XXX FORM_SOURCE --field-map-json
openyida get-schema APP_XXX FORM_TARGET --field-map-json
```

```json
{
  "events": ["insert"],
  "nodes": [
    {"id":"self","type":"getSelf"},
    {
      "id":"matched","type":"dataRetrieve","formUuid":"<真实目标formUuid>",
      "retrieveType":"batch","quantity":20,"filterType":"condition",
      "conditions":[{
        "bFieldId":"<目标库存字段ID>","bFieldName":"库存",
        "componentType":"NumberField","opCode":"LessThan",
        "aFieldId":"${self}.<上游库存下限字段ID>","valueType":"processVar"
      }]
    }
  ]
}
```

字段 ID 必须先查真实 schema；左右字段属于各自表单，数据类型必须兼容。`bFieldId/aFieldId` 也可分别写为 `fieldId/value`。引用触发记录时右侧直接用字段 ID；引用上游单条数据时用 `${别名}.字段ID`，CLI 解析为真实节点引用。图中“字段”的值类型为 `processVar`；“值”为 `literal`。不要把字段 ID 作为 literal 文本提交。

照上面完整 spec 替换其中一条 `conditions`，按右侧来源选择写法：

| 想比较什么 | 右侧怎么填 |
| --- | --- |
| 目标库存小于固定数字 10 | `"aFieldId":10,"valueType":"literal"` |
| 目标库存小于触发记录的库存下限 | `"aFieldId":"<上游库存下限字段ID>","valueType":"processVar"` |
| 目标库存小于上游 `self` 记录的库存下限 | `"aFieldId":"${self}.<上游库存下限字段ID>","valueType":"processVar"` |

例如库存下限为 10，目标库存有 0、9、10、11，`LessThan` 应取出 0 和 9。要取出等于 10 的记录，将操作符改为 `LessThanOrEqual`。固定数字保留数字类型，字段引用保留字符串类型。

普通 CLI 参数可引用触发记录字段；多节点别名使用 spec：

```bash
openyida integration create APP_XXX FORM_SOURCE "按字段筛选库存" \
  --events insert --data-form-uuid FORM_TARGET \
  --data-condition 'numberField_stock:库存:numberField_minStock:NumberField:LessThan:processVar'
```

取数节点的数字操作符将 `LessThan/LessThanOrEqual/GreaterThan/GreaterThanOrEqual` 转为平台原生 `Lesser/LesserOrEqual/Bigger/BiggerOrEqual`，也接受这四个原生值。不要把本地输入别名直接当平台保存协议。固定值与字段引用共用此转换。

用字段来筛选时，比较的是一条记录中的字段值。上游批量查询返回的一整列有多个值；需要逐行匹配时，在循环体中引用当前行的字段，不把未执行节点或整个结果数组作为单个值。现有过滤字段、操作符和变量支持以目标组织平台返回为准；分页查询的条数上限不代表全量数据。

取数字段引用的文本相等、数字小于以及零值／相等边界已经过真实运行验证。图中的“公式”是另一种结构（`column`），不能将以下触发／分支公式的未验收结论套用于取数的 processVar 字段引用，也不能由字段测试推断所有公式均可运行。

### 触发过滤：同一触发记录的两个字段

以下触发字段比较格式当前仅通过本地编译检查，尚未通过平台保存及运行验收，不能作为已可用能力直接交付。固定值比较不受此说明影响；它与上面的取数节点筛选是不同消费场域。

先从真实 schema 取得两个数字字段 ID。下面的 `numberField_stock`、`numberField_minStock` 和接收人 ID 都须替换。

直接设置自动化触发条件，默认保存草稿：

```bash
openyida integration create APP_XXX FORM_XXX "库存不足通知" \
  --events insert,update \
  --trigger-condition "numberField_stock:当前库存:LessThan:numberField_minStock:NumberField:processVar" \
  --receivers USER_ID
```

关键是最后的 `processVar`：右侧取“库存下限”字段的值。省略时默认 `literal`，会把字段 ID 当作固定文本。若比较“当前库存 < 10”，则写 `numberField_stock:当前库存:LessThan:10:NumberField:literal`。

使用 `--spec` 时，将同一条件放到顶层 `triggerConditions`，不要同时传 `--trigger-condition`：

```json
{
  "events": ["insert", "update"],
  "triggerConditions": [{
    "fieldId": "numberField_stock",
    "fieldName": "当前库存",
    "componentType": "NumberField",
    "opCode": "LessThan",
    "value": "numberField_minStock",
    "valueType": "processVar"
  }],
  "nodes": [{"type":"sendMessage","content":"库存不足，请补货","receivers":["<真实用户ID>"]}]
}
```

触发条件只引用触发表单字段，不能引用尚未执行的下游节点。多条 spec 触发条件默认 `AND`，需要任选其一时设置顶层 `triggerConditionLogic: OR`。

### 分支中的字段比较（待验收）

自动化分支的以下字段比较格式仅作待验收输入示例，不能将取数节点的运行结论直接套用。例如先配置 `getSelf` 节点 `id: self`，再在 `route` 分支的 `conditions` 中写：

```json
{"fieldId":"${self}.numberField_stock","fieldName":"当前库存","componentType":"NumberField","opCode":"LessThan","value":"${self}.numberField_minStock","valueType":"processVar"}
```

取数节点比较“目标表库存”和“上游记录库存下限”时，应放到 `dataRetrieve.conditions`，参见本页首个完整示例；不能放到 `route.conditions` 或顶层 `triggerConditions`。同一筛选条件的简写：

```json
{"bFieldId":"numberField_stock","bFieldName":"当前库存","componentType":"NumberField","opCode":"LessThan","aFieldId":"${self}.numberField_minStock","valueType":"processVar"}
```

`self` 必须是当前节点的上游别名，字段 ID 也须与各自表单一致。取数条件默认 `processVar`，触发和分支条件默认 `literal`；建议显式写出。完整分支结构见 [流转控制](control.md)。

### 流程分支中的固定值比较

流程分支中的一条数字规则：

```json
{"fieldId":"<真实金额字段ID>","fieldName":"金额","componentType":"NumberField","op":"GreaterThan","value":10000}
```

当前流程 DSL 的 `route.conditions[].rules` 按固定值编译；上述 `processVar` 字段比较写法适用于自动化，不能直接套入流程 DSL。

流程条件由 CLI 按 `componentType/op/value` 生成原生规则；数字保留数值类型，包括 `0`。条件分支、并行条件和跳转条件使用同一比较协议，业务定义只填写上述 DSL 字段。

## 特有限制

- 流程操作符按下表和字段真实类型选择；`value` 使用对应类型的固定值或选项数组。
- 自动化存在性判断使用其支持的 `ExistValue/NotExistValue`；不要因为流程有同名含义就直接照搬操作符。复杂空值规则需要时用已验证公式。
- 自动化 route 分支采用完整公式时，使用 `expression` 并保留编辑器内容，见 [分支按公式判断](../../yida-formula/references/automation-formulas.md#分支按公式判断)。
- 自动化分支的复杂空值判断优先使用已验证的 `ISEMPTY()` 公式，不只依赖设计器“没有值”选项；公式写在支持公式的条件位置，不能直接替换操作符。
- `valueType`、右侧值来源和数据类型一起检查；`0`、`false`、空值不能互相代替。
- 字段比较属于自动化条件配置，与审批人“条件模式”是两项能力；按 `integration create` 返回处理，明确提示权益不足时再引导开通。执行前仍须按自动化入口确认配置摘要。
- 人员条件模式使用 [人员选择](actors.md#审批办理抄送的完整配置) 的完整定义；审批、办理、抄送分别使用 `approver/executor/receiver`。
- 没有真实资源 ID 或参数 schema 时，先补齐证据，不为通过编译随意填字段类型、节点别名或占位条件。

## 流程操作符速查

| 操作符 | 含义 | 适用类型 |
| --- | --- | --- |
| `Equal` | 等于 | 各字段类型，值须与类型匹配 |
| `NotEqual` | 不等于 | 各字段类型 |
| `Contains` | 包含 | 文本 |
| `NotContain` | 不包含 | 文本 |
| `IsEmpty` | 为空 | 各字段类型 |
| `IsNotEmpty` | 不为空 | 各字段类型 |
| `GreaterThan` | 大于 | 数字 |
| `GreaterThanOrEqual` | 大于等于 | 数字 |
| `LessThan` | 小于 | 数字 |
| `LessThanOrEqual` | 小于等于 | 数字 |
| `In` | 属于 | 单选、下拉选项 |
| `NotIn` | 不属于 | 单选、下拉选项 |

这是流程规则的 `op` 清单；自动化使用其自己的 `opCode`，不要跨入口替换参数名。
