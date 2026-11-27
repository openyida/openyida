# 数据操作

## 什么时候用

读取当前或关联记录、写入其他表单、更新字段，或复制多行明细时。共用思路是先确定数据来源和目标，再配置筛选与赋值。

## 必填配置

| 操作 | 流程原生配置 | 自动化 spec |
| --- | --- | --- |
| 当前记录 | 使用已有、已验证的取数组件配置 | `getSelf`，可直接生成 |
| 查询单条/多条 | `GetSingleDataNode/GetBatchDataNode` 的真实 `getData` | `dataRetrieve`，可直接生成；多条另填 `retrieveType: batch/quantity` |
| 新增单条/多条 | `AddDataNode` 的真实 `addDataRules` | `dataCreate`，可直接生成；多条另填 `createType: batch/batchSource` |
| 更新 | `UpdateDataNode` 的真实 `updateDataRules` | `dataUpdate`，可直接生成 |
| 删除 | `DeleteDataNode` 的真实 `deleteData` | `dataDelete`，引用同一路径已执行的 `dataRetrieve` |

流程数据节点当前需要已有真实配置才能透传；自动化有明确的简化输入。不能因为复用同一配置器，就在两种入口中交换 JSON。

自动化必填项：

- 查询主表：目标 `formUuid`、筛选条件；明确全部范围时用 `filterType: all`。
- 查询子表：`originalType: sub_table`、上游单条记录 `source`、子表字段 `subSourceId`。
- 新增主表：普通目标表单 `formUuid` 和非空 `assignments`。
- 新增子表：`insertType: sub_table`、目标记录 `source`、目标子表 `subFormUuid` 和非空 `assignments`。
- 更新：上游 `source` 或明确的匹配条件，以及非空 `assignments`。
- 删除：在同一应用的普通表单主表上先按条件取数，再以 `{"type":"dataDelete","source":"queryRows"}` 引用上游取数节点的 `id`。上游必须按真实主表字段做 `Equal` 比较，`valueType` 为 `literal`，目前接受非空文本或有限数字。多条查询还需明确 `quantity`，需要固定批次顺序时同时提供排序。确认草稿和启用版本的节点、来源、筛选及数量后，再用运行日志与实例 ID 核对实际删除结果。

赋值的 `column` 使用目标字段 ID，值来源按 [条件与变量](conditions-variables.md) 选择。真实流程表单不能当作普通新增数据的目标；发起流程用 [扩展执行](extensions.md) 中的 `initiateApproval`。

## 获取数据时选择过滤来源

先选目标表和左侧字段，再选择右侧来源：金额大于固定的 `100` 用 `literal`；金额大于上一步的金额用 `processVar`；金额大于上一步金额乘二用 `column`。字段原样比较和计算后比较分别配置，完整格式见 [条件与变量](conditions-variables.md) 及 [节点表达式](../../yida-formula/references/automation-formulas.md)。

右侧字段从已执行的上游节点选取；左侧字段属于被查询的表。操作符按该取数节点和字段类型选择，例如原生数值比较使用 `Bigger`。CLI 也接受并转换 `GreaterThan` 等输入别名；读写平台配置时保留原生编码，具体转换见条件与变量说明。读取单条和多条数据时都应保留可供下游选择的输出字段；编辑已有节点时保留原输出配置。

多条件或嵌套计算使用 [完整取数 spec](../../yida-formula/references/node-examples.md#按编号字段嵌套公式和固定状态取数)，包含字段、IF/ROUND 公式、固定状态和预期匹配记录；目标表任意嵌套 AND/OR 条件树尚不在当前简化输入范围内。

## 最小示例

自动化中读取当前记录，再将处理状态更新为“待处理”：

```json
{
  "events":["insert"],
  "nodes":[
    {"id":"self","type":"getSelf"},
    {"type":"dataUpdate","source":"self","assignments":[{"column":"<真实状态字段ID>","valueType":"literal","value":"待处理"}]}
  ]
}
```

流程原生节点不复用上面的 spec。应保留实际组件的 `getData/addDataRules/updateDataRules/deleteData`；配置从既有流程或已验证接口取得，缺少时报告所需配置，不生成空对象。

## 特有限制

- 批量取数、新增及子表复制只在需要时读 [批量配置](../../yida-integration/references/batch-data.md)，其示例是自动化 spec，不是流程原生 props。
- `quantity` 是本次查询上限，不表示自动分页取完；子表的目标记录 `source` 与来源行集 `batchSource` 分别指定。
- 需要流水号或最新值时先取当前记录。普通表单查询用 `form_inst_id`，流程查询用 `pid`；CLI 负责生成获取自身的匹配，不手写非唯一条件。
- 获取自身优先用 `--get-self`：流程表单运行侧用 `pid`、设计器侧用 `proc_inst_id`，普通表单两侧用 `form_inst_id`，均匹配事件字段 `__masterdata_form_inst_id`。禁止用 `formInstId = formInstId`、“包含”或非唯一字段匹配自身。
- 新增／编辑事件中的流水号可能为空或不是最新值；定时触发数据也可能是历史值，需要最新数据时先获取自身或目标记录。
- 平台“直接更新”模式的匹配字段只能取当前触发表单字段，不能任意引用前置节点字段；文本字段不能用于匹配单选／多选字段。它与 spec 中按上游 `source` 更新的模式分别配置。
- 直接更新不会触发被更新表单的集成自动化。跨应用内置新增／编辑／删除节点写入目标表时，不会接力触发目标表同类事件自动化；跨应用链式联动必须按此阻塞项规划，不能宣称等价完成。
- 异常重试可能从头执行，已执行的新增／更新节点可能再次写入或覆盖；重试前先核对已写入结果和幂等性，不能假设只重跑失败节点。
- 新增、更新或删除结果未知时先查询，不能直接重试，防止重复数据。平台版本、额度或条数限制以服务端返回为准，不修改权益。
- 高级原生结构仅在排查实际 payload 时读 [自动化结构参考](../../yida-integration/references/integration-node-schemas.md)，不要将底层 runtime JSON 当作 spec 输入。
