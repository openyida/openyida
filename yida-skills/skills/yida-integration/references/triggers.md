# 自动化触发设置

通过 `integration create APP FORM 名称 --spec 文件` 创建；初次默认保存草稿。所有字段、表单 ID 必须真实查询。

## 按执行时机选择

| 执行时机 | spec 配置 |
| --- | --- |
| 表单新增、修改、删除或评论 | `events: ["insert","update","delete","comment"]`，选择所需事件 |
| 流程完成 | `events: ["processFinish"]`，同时给出 `approvalActions` |
| 指定流程节点完成操作 | `events: ["activityTask"]`，同时给出 `approvalActions/approvalNodeIds` |
| 指定字段内容变化 | `events: ["update"]` 加 `changedFields`，见下文 |
| 到指定时间或重复执行 | `schedule`，见下文 |

流程事件的 `approvalActions` 使用实际需要的 `agree/disagree/terminated`；节点 ID 从目标流程读取。只用 CLI 选项时使用 `--events/--approval-actions/--approval-node-ids`。使用 `--spec` 时在文件中写完整配置，这些选项不会自动补入文件。

```json
{
  "events": [
    "processFinish"
  ],
  "approvalActions": [
    "agree"
  ],
  "nodes": [
    {
      "id": "self",
      "type": "getSelf"
    }
  ]
}
```

以上示例只展示触发设置，后续节点按任务补齐。应用事件、手动或卡片触发当前只能查询，CLI 尚未封装创建。保留原触发方式，需要时在平台配置。

## 基本定时

下例每天 09:00 执行，最多 5 次。替换未来的北京时间和真实表单 ID，按本页开头的命令保存。

```json
{
  "schedule": {
    "startDate": "2026-10-20 09:00:00",
    "repeat": "DAILY",
    "maxCount": 5
  },
  "nodes": [
    {
      "id": "read",
      "type": "dataRetrieve",
      "formUuid": "<真实表单ID>",
      "retrieveType": "batch",
      "quantity": 10,
      "filterType": "all"
    }
  ]
}
```

时间按平台 Asia/Shanghai（UTC+8）输入，秒必须为 00。`repeat` 支持 ONCE、DAILY、WORKDAY、WEEKLY、BI_WEEKLY、MONTHLY、LAST_DAY_PER_MONTH。非 ONCE 须选择 `maxCount` 或毫秒时间戳 `expireDate`，二者互斥。创建绑定类型为 3，运行触发类型为 TimerEvent，设计器保留定时配置。当前不提供日期字段定时、法定工作日和 CUSTOM 的简写。

定时不能混用 events、changedFields、表单触发过滤或审批节点动作；定时没有当前提交记录，应显式取数后再引用。必须等到真实触发后读取日志和目标数据，才可报告定时运行通过。

### 结束条件

指定时间开始的重复任务，按实际结束条件选择以下两种方式：

| 界面选项 | spec 字段 | 设计器字段 | 运行态字段 |
| --- | --- | --- | --- |
| 触发次数 | `schedule.maxCount`，1–100 的整数 | `overTimeType = "count"`、`overCount` | `inputs.end.maxCount` |
| 指定时间 | `schedule.expireDate`，晚于开始时间的毫秒时间戳 | `overTimeType = "time"`、`overTime` | `inputs.end.expireDate` |

需要“一直执行”或长期持续运行时，建议选择指定时间，将截止日期设得较远，在配置摘要中展示实际截止时间。例如业务选择北京时间 2036-10-20 09:30 截止时，将该日期转换成毫秒时间戳后填写 `schedule.expireDate`。具体截止日期按用户确认的业务安排填写。

结束条件缺失时，CLI 会在认证和远端操作前提示补充 `maxCount` 或 `expireDate`。一次性任务仍使用下方 ONCE 配置，运行态只执行一次，设计器结束方式保留为 `count`、次数为 1。

### 只执行一次

```json
{
  "schedule": {"startDate": "2026-10-20 09:00:00", "repeat": "ONCE"},
  "nodes": [{"id": "read", "type": "dataRetrieve", "formUuid": "<真实表单ID>", "filterType": "all"}]
}
```

日期改为未来的北京时间。只执行一次时只填 `startDate/repeat`；循环执行才选择 `maxCount` 或 `expireDate`。发布后，预期在指定时间出现一次成功运行记录。

## 指定字段内容变化

用途：修改订单金额时执行自动化，修改备注时不执行。下方 `<真实字段ID>` 替换为金额字段 ID；监听多个字段时，把真实 ID 依次放进同一个 `changedFields` 数组。

```json
{
  "events": [
    "update"
  ],
  "changedFields": [
    "<真实字段ID>"
  ],
  "nodes": [
    {
      "id": "self",
      "type": "getSelf"
    }
  ]
}
```

编译为平台独立的 `targetField` 事件和 `formEventField` 字段集合，不用字段值比较替代变化检测。列表不能为空、不能重复，字段必须存在。分别修改监听字段和未监听字段，用两组日志及业务数据验证触发／不触发。不要同时配置普通 update 来抵消监听范围。

| 操作 | 本例预期 |
| --- | --- |
| 修改已有订单的金额 | 触发，`self` 读到修改后的记录 |
| 只修改备注 | 不触发 |
| 新建订单 | 不触发；本例只配置了修改事件 |
