# 原生宜搭数据查询

已有图层的 `source` 接口须在原生设计器中选择“宜搭数据源”、选择当前应用并进入配置，绑定真实数据集和字段。保存后用 `datav config` 找到图层 ID，再用 `datav data --component` 读取查询。

## 查询对象

以 `datav data` 返回的完整 `query` 为输入，保留服务器实际字段。顶层支持 `datasetId`、`field`、`condition`、`orderBy`、`paging`、`distinct`、`autoMapping`、`enabledCache`。`datasetId` 必须与原绑定一致；分页 `limit` 为 1–1000，不承诺返回全部分组。

`field` 的每项记录真实 `code`、`chartKey`、字段类型和聚合等属性。例如柱状图中分类映射 `chartKey=x`，数值映射 `chartKey=y`，`aggregation=SUM` 表示求和，`COUNT` 表示计数。字段标识、日期拆分字段与复杂筛选结构均从实际绑定或原生设计器取得，不按中文名称猜测。

只更改聚合时，保留完整查询以及其他字段属性，将目标度量的 `aggregation` 改为本轮要求的计算方式，再执行：

```bash
openyida datav configure-data <appType> <formUuid> --component "<真实图层ID>" --query-file <任务缓存目录/query.json> --expected-hash <读取结果中的expectedHash> --json
```

命令不接受认证、Token、分享设置或 DataV 完整布局；未完成首次绑定、使用 API/静态数据源或接口不是 `source` 时，返回不支持，继续在原生设计器配置。

## 验收与恢复

- 写前核对目标、完整查询和本轮改动，避免设计器同时修改；哈希只提供客户端写前检查，不是服务端原子锁。
- `changed=false` 表示当前查询已相同，无需写入。`changed=true,readbackVerified=true` 表示配置保存并回读一致，仍须运行验证。
- 在原生设计器数据响应中对比维度与数值。求和与计数分别核对；不要以保存成功推断筛选、公式、时间粒度或权限已经等价。
- 写入或回读不确定时按返回 `recovery` 读取原图层，保留 `retrySafe=false`，不重建大屏或盲目重放。
- 发布启用使用单独的 `datav publish --confirm`，仅在用户要求发布时执行。
