# Canvas 原生报表数据集成

## 1. 确认数据量与用户选择

为 Canvas 接入业务数据时，先对当前应用、数据源和分析范围做一次小页查询，并使用返回的真实 `totalCount`：

```bash
openyida data query form <appType> <formUuid> --page 1 --size 1 --no-hydrate-subforms
```

分析范围包含筛选条件时携带同一份 `--search-file`。每个数据源分别确认，以底层明细查询的 `totalCount` 作为唯一计数依据。

- `totalCount <= 2000`：按业务目标使用分页明细或原生报表聚合。
- `totalCount > 2000`：当前范围尚无明确选择时，向用户询问：“当前查询范围有 12,580 条数据，请选择使用宜搭原生报表服务端聚合，或继续使用分页明细。选择聚合后将创建或复用本应用的报表配置。”
- 用户选择原生报表：记录实际总数、查询范围、用户原话和 `decision: report`，然后执行报表绑定流程。
- 用户选择分页明细：记录 `decision: paged-detail`，使用服务端分页；也可以按用户要求缩小分析范围。
- `totalCount` 未返回：记录 `countStatus: unknown`，先询问用户预期数据规模和数据模式。
- 当前任务已对同一应用、数据源和分析范围作出明确选择：直接复用该选择。

将选择记录保存到 `.cache/openyida/<任务名>/analysis-decision.json`。该确认发生在 Agent 配置阶段；Canvas 访客直接使用已配置的数据模式。

## 2. 配置真实报表绑定

1. 从当前应用的真实表单 Schema 取得字段与类型，根据用户确认的业务口径配置指标、维度和筛选。
2. 加载 `yida-report`。已有明确绑定时复用对应报表；其余情况执行 `create-report`。报表资源在配置阶段创建。
3. 执行 `openyida report inspect <appType> <reportUuid> --json`。从 `canvasBindings` 选择与业务指标对应的组件和数据集，将结果写入 `report-binding.json`。
4. 使用 `queryProbes` 确认每个数据集的最终查询结果。成功的 `canvasBindings` 提供 `reportUuid`、`cid`、`componentClassName`、`dataSetKey`、`filterKeys` 和 `aliases`。
5. 浏览器每次刷新从当前应用导航精确匹配 `reportUuid`，动态解析 `topicId/prdId`，读取运行态报表 Schema 并核对组件和数据集。

`DATA_BINDING` 使用以下结构，所有值均来自本次 `report inspect`：

```javascript
const DATA_BINDING = {
  mode: 'report',
  appType,
  reportUuid,
  cid,
  componentClassName,
  dataSetKey,
};
```

## 3. 在 CodeCanvas 中消费聚合结果

生成可编译示例：

```bash
openyida sample yida-canvas-data-binding report-data --output pages/src/analysis.canvas.jsx
```

按页面设计调整展示，并用 `canvasBindings` 的真实值替换模板绑定。发布层会为使用 `window.__OPENYIDA_REPORT__` 的 Canvas 页面安装报表客户端。

```javascript
const bridge = window.__OPENYIDA_REPORT__.createBridge(DATA_BINDING);
const unsubscribe = bridge.subscribe(setReportState);

bridge.refresh({
  filters: filterValueMap,
  start: 0,
  limit: 50,
}).catch(() => {
  // bridge state 已包含可展示的错误。
});

// 组件卸载时：
unsubscribe();
bridge.dispose();
```

`filters` 使用该数据集的真实 `filterKey -> 值数组` 映射。`orderByList` 使用 `aliases` 中的字段，运行时保留模型中其余默认排序。结果分页大小为 1–100。当前集成使用普通筛选模型；变量筛选返回明确错误，配置时选择普通筛选模型。

## 4. 运行时协议

客户端通过同源 `POST /alibaba/web/{appType}/visual/visualizationDataRpc/getDataAsync.json` 查询聚合结果，并携带当前访问者登录凭据、CSRF 和 `application/x-www-form-urlencoded` 参数。

首个请求直接返回数据时完成查询。返回 `continuePolling=true` 和 `traceId` 时，每 3 秒顺序调用 `getCacheData.json`，直到获得数据或达到默认 90 秒总体期限。

每个 bridge 维护以下状态：

- `loading`
- `error`
- `rows`
- `meta`
- `totalCount`
- `lastUpdatedAt`
- `appliedQuery`

相同查询复用当前请求；筛选变化取消旧请求并忽略旧响应。刷新期间保留上次成功数据，失败时展示错误，首次失败显示错误态，合法空结果展示空态。`totalCount=null` 表示接口未返回总数。

## 5. 验证

发布前完成以下验证：

- 对照原生报表验证相同筛选条件下的数据和总数。
- 验证合法空结果、登录失效、无权限和接口错误。
- 验证 `getDataAsync -> getCacheData` 异步轮询、超时和取消。
- 验证重复请求合并、筛选乱序保护和刷新保留旧数据。
- 验证多组件、多数据集和跨应用绑定拒绝。
- 记录真实应用验证结果；缺少测试身份或真实数据时，将对应项标记为待验证。
