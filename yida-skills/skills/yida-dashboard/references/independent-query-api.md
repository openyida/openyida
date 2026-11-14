# 独立可编程卡片查询 API

适用于普通自定义页和 AI 画布中的可编程卡片。不需要先建报表页面。使用当前卡片的 `analysis.api`，平台负责登录、应用路由和权限；源码负责查询状态、展示与交互。每张卡分别持有查询配置，跨卡筛选显式映射字段。

## 先核对环境

调用 `await analysis.api.capabilities()`，核对 supportedVersions、filterOperators、nativeQuery 和 export 限制。宿主缺少该方法或服务端未开放版本时，说明部署缺口并停止使用对应能力；不要吞掉接口错误展示模拟数据。包、服务端、消费端需要分别部署，源码存在不代表目标环境可用。

| 需求 | API | 返回与边界 |
| --- | --- | --- |
| 聚合行 | query(config) | 仅 rows；保留旧调用行为 |
| 聚合分页 | queryResult(config) | rows、offset、limit、totalCount |
| 校验 | validate(config) | 校验结构、数据源归属和元数据，执行 1 行字段权限预检，公式仍需实际查询验证 |
| 异步执行 | startQuery(v2Config) | 直接结果或 continuePolling/taskId/retryAfterMs |
| 读取任务 | poll(taskId) | 当前企业、应用和用户的任务，最长 300 秒 |
| 导出筛选结果 | export(config) | CSV 的 fileName/mimeType/content/rowCount/scope |
| 分页明细 | queryDetails({formUuid, viewUuid?}, filters, page, limit) | 保留视图和行列权限，limit 最大 100 |

`useQuery(config, drillDimensions)`、组件 `query` 属性、可视化数据设置和源码查询 API 共用 V2 配置。

## 保存和传递筛选

查询配置可随卡片保存，也可由源码 state 构造；提交的对象必须与实际显示的筛选一致。统一使用真实 cubeCode、字段编码与稳定输出别名 as，不能使用字段显示名猜编码。

filters 顶层按 AND 组合，叶子 `{field,op,values}` 支持 eq/ne/in/notIn/gt/gte/lt/lte/between/isNull/isNotNull/like。嵌套组使用 `{logicalOperator:'AND'|'OR',children:[...]}`。空值判断传 values:[]，其他值保持原始类型；like 使用字符串模式，具体匹配由查询引擎执行。最多 8 层、99 个节点；顶层和每组最多 50 项，in/notIn 最多 1000 个值。

基础 OR 组应作为一个完整节点保留，再追加下钻或联动条件。更换筛选时重置 offset；非零 offset 必须提供 orderBy，排序应包含全部分组别名以保持分页稳定。单次聚合 limit 最大 1000，不能对截断结果重新计算全局占比或总额。

## V2 日期与计算指标

先读取元数据，再替换以下示例中的真实 cubeCode 和字段。此示例使用原生引擎按月聚合后计算收入减成本，前端只负责展示。

```js
const config = {
  version: 2,
  cubeCode: 'FORM_EXAMPLE',
  dimensions: [{ field: 'dateField_time', as: 'month', timeGrain: 'MONTH' }],
  metrics: [{
    as: 'margin',
    expression: 'SUM(FORM_EXAMPLE.numberField_revenue)-SUM(FORM_EXAMPLE.numberField_cost)',
  }],
  filters: [],
  orderBy: [{ by: 'month', direction: 'ASC' }],
  offset: 0,
  limit: 100,
  enabledCache: false,
};
const result = await analysis.api.queryResult(config);
// 使用 result.rows，并显示查询的时间范围、单位与分页状态。
```

普通指标仍用 field/aggregation/as；公式指标使用 expression/as，两者互斥。V2 dimensions/metrics 必须显式传数组。公式仅引用同一真实 cube 的字段，采用 cubeCode.fieldCode，支持 capabilities 中列出的数值指标函数子集；最长 4096 字符、32 层括号。字符串仅支持无转义的单引号。网关检查范围，原生引擎负责解析、类型和计算，参数组合仍可能失败。

日期字段可使用 YEAR/HALF_YEAR/QUARTER/MONTH/DEDAK/WEEK/DAY/HOUR/MINUTE/SECOND。点击“2026-01”下钻时，按源字段和业务时区转换成 gte 月初、lt 下月月初两个条件，再切换分组或查询明细；不能把展示月份 eq 到原始日期字段。

缓存默认关闭。允许缓存时 enabledCache:true；主动刷新使用 false。缓存时效由服务端管理，不能自行承诺 TTL 或命中。跨源关联、任意 SQL、完整原生函数库、同比环比/累计统计模型未通过该紧凑协议开放。

## 异步轮询与交互状态

使用 startQuery(config) 发起，continuePolling 为 true 时，按 retryAfterMs 间隔调用 poll(taskId)，完成后展示 rows。定时器一次只执行一个请求，禁止 setInterval 重叠调用。到期显示重试入口；失败显示错误并清除旧结果，不回退成空数据。

在 React effect 中维护 cancelled 标记与定时器。查询变化或组件卸载时清理定时器，旧响应不能覆盖新查询。停止客户端轮询不等于取消下游任务。任务绑定当前访问者和应用，轮询重查数据源与字段权限；结果是执行时快照，不承诺运行中的行权限变化会重算该结果。

需要自动刷新时，上一轮完成后再安排下一次 startQuery；后台页面暂停，恢复后按需刷新。任务轮询与周期刷新是不同操作，不把两种定时器叠在一起。

## 服务端导出与下载

仅在能力声明可用时开放“导出筛选结果”。export(config) 保留完整 filters，忽略当前 Top N/offset，服务端重新分页查询，要求源表导出权限；不会只导出眼前几十行。最多 10000 行、2097152 个字符，超限整体失败，提示缩小筛选。

```js
const file = await analysis.api.export(config);
const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
const link = document.createElement('a');
link.href = url;
link.download = file.fileName;
document.body.appendChild(link);
link.click();
link.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

返回 CSV 已处理 BOM、引号/换行和公式注入，直接下载内容。它是有上限的同步导出，不是无限量异步导出任务；多页读取期间数据可能变化，不承诺事务快照。只导出浏览器内已显示行时，按钮应叫“导出当前结果”，不能混用口径。

## 验收

至少验证：保存读回后筛选树一致、零值/false/空值、OR 组叠加下钻、翻页不重复、普通成员权限、跨应用 taskId 被拒绝、异步旧响应被忽略、主动刷新、导出超限及真实下载。公式金额与已知原生统计结果交叉核对；源码测试与 mock 测试不能代替真实环境查询验收。
