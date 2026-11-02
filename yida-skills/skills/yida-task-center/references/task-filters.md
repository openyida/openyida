# 个人任务筛选示例

需要为个人任务查询或自定义展示添加筛选时读取本文件。先按用户描述选择所需类型；订单待发货、工单待处理等业务记录仍查询业务表单，不套用这里的流程任务条件，也不默认增加完整待办中心。

## 先确认可用条件和真实 ID

以下示例使用 Bash，`APP_REPLACE`、`USER_ID`、`PROCESS_CODE`、`FORM_UUID` 都是需要替换的占位符。候选项返回的 `items[].label` 用于显示，`items[].value` 用于查询；不要拿显示名称代替 ID。

```bash
openyida task-center capabilities --json
openyida task-center options APP_REPLACE --type originators --keyword 张 --json
openyida task-center options APP_REPLACE --type processes --keyword 报销 --json
openyida task-center options APP_REPLACE --type forms --keyword 采购 --json
```

`originators` 提供可读取的人员候选；`processes` 提供流程候选；`forms` 用于我创建的普通表单与流程，其中普通表单的值是表单 UUID，流程的值是流程标识。候选项可读取不代表一定存在匹配任务。

流程与表单候选沿用宜搭原生 `taskCenter.html` 的高级筛选链路：选择应用后查询“流程名称”；“我创建的”场景将同一候选用于“表单名称”。原生请求中的 `formTypes=process` 用于回填流程标识，不代表服务端已按行过滤；OpenYida 会按 `formType`、标题关键词和 `--size` 对返回结果再次归一化，避免端点忽略搜索或分页参数时静默返回全量数据。

高级筛选显式使用 `--transport app-query`。默认的 `app-v1` 保留原查询行为，不要混用两种传输的条件；字段和取值以能力查询返回的 `transports["app-query"].filters` 为准。

| 条件 | 待我处理 `todo` | 我创建的 `created` | 我已处理 `done` | 抄送我的 `cc` |
| --- | --- | --- | --- | --- |
| 关键词 `--keyword` | 支持 | 支持 | 支持 | 支持 |
| 发起人 `--originators` | 单人 | 不支持 | 单人 | 单人 |
| 流程 `--process-codes` | 支持 | 普通表单 UUID 或流程标识 | 支持 | 支持 |
| 创建／发起时间 `--instance-create-from/to` | 支持 | 支持 | 支持 | 支持 |
| 到达时间 `--task-create-from/to` | 支持 | 不支持 | 不支持 | 不支持 |
| 处理时间 `--task-finish-from/to` | 不支持 | 不支持 | 支持 | 不支持 |
| 抄送时间 `--carbon-create-from/to` | 不支持 | 不支持 | 不支持 | 支持 |
| 流程状态 `--instance-status` | 不支持 | 不支持 | 不支持 | 支持 |

表中的 `from/to` 是两个独立参数，例如 `--instance-create-from` 和 `--instance-create-to`。时间使用 Unix 毫秒，可只给一个端点；同时给出时开始时间不得大于结束时间。先按用户时区确定边界，不把秒时间戳直接当毫秒传入。

下面的日期范围是北京时间 2026-10-01 00:00:00 至 2026-10-19 23:59:59.999。按实际需求替换，并在执行后续示例的同一终端设置：

```bash
TASK_FROM_MS=1790784000000
TASK_TO_MS=1792425599999
```

## 待我处理：关键词、发起人、流程和时间组合

例如查找某人发起的报销任务，要求创建时间和到达时间都落在所选范围：

```bash
openyida data query tasks APP_REPLACE --type todo \
  --transport app-query --normalized \
  --keyword 报销 --originators '["USER_ID"]' \
  --process-codes '["PROCESS_CODE"]' \
  --instance-create-from "$TASK_FROM_MS" --instance-create-to "$TASK_TO_MS" \
  --task-create-from "$TASK_FROM_MS" --task-create-to "$TASK_TO_MS" \
  --page 1 --size 20
```

创建／发起时间与任务到达时间是不同条件。只要求最近到达的待办时，去掉 `--instance-create-from/to`，不要额外限制流程何时发起。

## 我创建的：关键词、表单或流程和创建时间组合

例如查找当前访问者在指定采购表单中创建的记录：

```bash
openyida data query tasks APP_REPLACE --type created \
  --transport app-query --normalized --keyword 采购 \
  --process-codes '["FORM_UUID"]' \
  --instance-create-from "$TASK_FROM_MS" --instance-create-to "$TASK_TO_MS" \
  --page 1 --size 20
```

筛选流程时，将 `FORM_UUID` 替换为 `forms` 候选返回的流程值。`created` 包含普通表单和流程，`submitted` 是其兼容别名；创建人由当前登录身份决定，不传 `--originators`，也不添加状态或数据类型参数。

## 我已处理：关键词、发起人、流程和处理时间组合

例如查找当前访问者在所选时间内处理过、由指定人员发起的报销任务：

```bash
openyida data query tasks APP_REPLACE --type done \
  --transport app-query --normalized \
  --keyword 报销 --originators '["USER_ID"]' \
  --process-codes '["PROCESS_CODE"]' \
  --task-finish-from "$TASK_FROM_MS" --task-finish-to "$TASK_TO_MS" \
  --page 1 --size 20
```

我已处理表示当前访问者已经处理过该任务，不表示整个流程已经完成，也不等同于同意。需要再限制流程发起时间时，可增加 `--instance-create-from/to`；不能用 `--instance-status` 或审批结果参数过滤此栏目。

## 抄送我的：关键词、发起人、流程、抄送时间和状态组合

例如查找指定人员发起、在所选时间抄送给当前访问者且流程已经完成的采购事项：

```bash
openyida data query tasks APP_REPLACE --type cc \
  --transport app-query --normalized \
  --keyword 采购 --originators '["USER_ID"]' \
  --process-codes '["PROCESS_CODE"]' \
  --carbon-create-from "$TASK_FROM_MS" --carbon-create-to "$TASK_TO_MS" \
  --instance-status 2 --page 1 --size 20
```

`app-query` 的抄送流程状态取数字：`0` 进行中、`1` 已终止、`2` 已完成、`3` 运行异常。查询进行中的流程用 `--instance-status 0`；不限制状态时省略此参数，不传 `RUNNING`、`COMPLETED` 或“全部”。抄送任务不是待审批任务。

## 单条件、分页与自定义展示

- 单条件查询只保留需要的筛选选项，其余删除；不限制发起人或流程时省略对应参数，不传占位值、空字符串或“全部”。发起人数组最多一位。
- 条件传给服务端后再分页，不先取一页再在前端过滤。改变筛选、移除条件或清空时回到第 1 页；查询始终限定目标应用与当前访问者，不能覆盖访问者身份或改为跨应用查询。
- `--normalized` 返回统一的 `content.items/total/page/pageSize` 及列表项的 `detailTarget`。总数未知时 `total` 为 `null`，不当作零；读取或权限失败不能当作成功空列表，也不静默去掉条件重查。
- CLI 查询用于核查本机登录人的样本；发布后的展示通过任务加载契约读取实际访问者的数据，保留现有布局、主题和原生详情入口，不把 CLI 查询结果当作其他用户的线上数据。

已明确选择自定义展示并使用 CLI 装配时，可用下面的**配置片段**设置一个任务类型及初始筛选；它不是可直接提交的完整 spec，应用、设计文件及真实选择记录仍按能力查询返回的要求填写：

```json
{
  "transport": "app-query",
  "kinds": ["todo"],
  "defaultKind": "todo",
  "filters": {
    "todo": {
      "keyword": "报销",
      "originators": ["USER_ID"],
      "processCodes": ["PROCESS_CODE"],
      "taskCreateFrom": 1790784000000,
      "taskCreateTo": 1792425599999
    }
  }
}
```

页面配置使用驼峰字段（如 `taskCreateFrom`），CLI 参数使用短横线（如 `--task-create-from`）；更换类型后只使用该类型声明的字段。用户只需要一个区块或一种任务时，保持所需类型，不因示例增加其他栏目或页面。
