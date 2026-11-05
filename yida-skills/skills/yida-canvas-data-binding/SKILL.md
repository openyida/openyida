---
name: yida-canvas-data-binding
description: 为 YidaCodeCanvas 自定义内容接入真实表单、个人流程任务、连接器或同源接口数据；按用户描述判断数据来源，处理 dataBinding、DataBridge、数据桥、数据解析、空值筛选、服务端分页、totalCount 和静默刷新。适用于页面或区块接入真实数据、展示个人任务、轮询刷新列表或 KPI，以及排查页面显示 0 条但数据管理有数据。
---

# 自定义页面数据绑定

## 核心定位

先根据用户描述确定“待办”指什么：对象是个人流程任务还是业务记录，与当前访问者有什么关系，需要哪些信息、筛选、刷新及点击行为。页面、区块、卡片或“待办”名称都不能代替业务含义；只接入需求涉及的能力，不默认增加四类栏目、统计或审批按钮。关键语义无法从上下文确定时，只澄清影响数据来源或权限范围的问题。 个人任务的当前应用或本组织所有应用范围不明确时，必须通过 `ask_human` 确认；数量与原生入口使用同一范围。数量卡片及端内入口复用[流程任务能力](references/workflow-capabilities.md)中的 CLI 与发布桥，不手拼另一套请求或打开逻辑。

个人流程任务复用 CLI 的 `todo`（待我处理）、`created`（我创建的普通表单与流程）、`done`（我已处理）、`cc`（抄送我的）契约；先用 `openyida task-center capabilities --json` 查询条件，再按所需类型执行 `openyida data query tasks <appType> --type <类型> --normalized` 核查。需要加载实现时复用 CLI 装配产物中的任务加载与详情助手，保留当前展示布局；发布运行态读取实际访问者的任务，不把 CLI 登录人的结果或凭证嵌入页面。订单待发货、工单待处理等业务记录仍按真实表单字段和权限查询，不用流程任务接口代替。

用户已明确要求该自定义展示时按原范围接入，不因使用任务接口再确认，也不强制装配待办中心。确需复用任务列表装配时交接 `yida-task-center`，仅选择所需类型并沿用已确认的页面设计范围；Agent 主动建议增加自定义任务展示时先 ask_human，未明确同意不实施。普通任务查询直接用 CLI，不创建展示界面。

个人任务需要过滤时，按需读取[四类任务筛选与组合示例](../yida-task-center/references/task-filters.md)；业务记录的条件继续按其表单字段确定。

需要个人任务数量、业务关联审批进度或操作历史时，按需读取[流程任务能力与装配](references/workflow-capabilities.md)，复用 CLI 读取契约和所需组件，不默认增加完整审批中心。

本技能只处理使用 `YidaCodeCanvas` 组件实现的页面里的真实数据接入：把页面所需数据先声明成 `dataBinding` 契约，再由页面生成器或业务组件生成统一的 `DataBridge`。读取宜搭表单数据时，默认消费外层普通自定义页面在 `didMount` 中注册到 `window.__OPENYIDA_YIDA_API__` 的 yida JS-API 桥；根级工具消费同层注册的 `window.__OPENYIDA_UTILS__`，其中 `.yida` 指向同一个 yida API 桥；连接器代理或自定义同源接口仍按自身 endpoint 读取。

`YidaCodeCanvas` 组件运行时是标准 React 组件环境，组件没有普通宜搭自定义页实例对象。因此数据接入要显式写清来源、字段映射、刷新策略和异常处理，不能靠隐式页面实例补齐。连接器模式使用发布层注入的 `window.__OPENYIDA_CONNECTOR_API__`。

## 运行时事实

涉及确认、取消、签到、删除等写操作时，编码前先读[业务动作授权](references/business-action-permissions.md)，在当前实现计划中记录角色、真实资源、数据范围、可写字段、前置状态和服务端实现；无法满足约束的动作保持禁用并列为未完成。界面显隐和管理员正向测试不能替代服务端授权及普通用户越权用例验证。

- `YidaCodeCanvas` 组件只透传 `code / runtimeCode / importedModules / pageType`。
- 组件内没有 `this` 上下文，也没有 `dataSourceMap`。
- `this.utils.yida.*`、`didMount()`、`_customState` 等普通页面契约在 `YidaComp` 内不可直接使用；发布使用 `YidaCodeCanvas` 组件实现的页面时，外层普通页面的 `didMount` 必须自动把 `this.utils.yida.*` 封装到 `window.__OPENYIDA_YIDA_API__`，并把 `this.utils.toast/dialog/router.push/openPage/isMobile` 等根级工具封装到 `window.__OPENYIDA_UTILS__`，组件内部只能消费这些 window 桥。
- 桥对象存在只代表发布层已注入能力，不代表当前访客具有登录态。公开页 `/o/...` 中桥可能存在，但匿名用户调用其 `saveFormData` 仍会返回 `LOGIN FAILED`；写入前必须先按 `pageConfig.FREELOGIN === 'true'` 或 `loginUser.userId === 'FREEUSER'` 分流。
- 登录态表单写入继续使用 `window.__OPENYIDA_YIDA_API__.saveFormData`；匿名态只能按[公开访问（匿名态）提交](../yida-canvas-custom-page/references/data-bridge-guide.md#公开访问匿名态提交)走 `window.pageConfig.RECEIPT_SAVE_FORM_DATA`，不得在桥失败后盲目重试。
- `YidaCodeCanvas` 组件没有官方 `useDataBinding` hook，不得从任何包 `import { useDataBinding }`；真实表单数据绑定用页面内本地 `useYidaData(binding)`、`DataBridge` 和 yida JS-API 桥实现。
- Cookie 由浏览器同源请求自动携带，前端代码不能硬编码 Cookie、appSecret、accessKey 或外部密钥。
- `mode=form` 读取宜搭表单数据时，默认调用 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`，它底层来自官方 `this.utils.yida.searchFormDatas(params)`。发布层同一个桥也同步 `this.utils.yida` 的表单、流程、表单设计与运行态方法，例如 `saveFormData`、`updateFormData`、`startProcessInstance`、`getProcessInstances`、`request`、`searchUserList`。参数至少包含 `formUuid`、`currentPage`、`pageSize` 和 `searchFieldJson`，`pageSize` 一般显式写 `50`，字段 ID 必须来自真实 schema。
- 只有 yida JS-API 桥不存在时，才允许降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json`。直连请求必须带 `credentials: 'include'`，并从 `window.g_config`、`window.pageConfig`、`window.__YIDA__`、meta 或同源 cookie 读取 CSRF，同时写入 `_csrf_token` query 和 `global_csrf_token` 请求头。`/query/form/searchFormDatas.json` 不是可用表单数据端点。

## 业务记录图片

页面需要展示真实对象图片时，按[任务驱动的视觉设计](../yida-design/references/task-driven-visual-design.md)绑定真实图片/附件字段。先读 Schema 与实际返回样本，确认值是地址、对象还是附件数组后再映射，不猜字段 ID 或返回结构；列表与详情使用相同记录 ID 关联图片。图片来自关联对象表时优先使用已有联查或批量查询能力，避免每行单独请求；当前接口不支持时只读取当前页所需对象并限制并发，不拉全库。

图片地址沿用平台或数据源支持的访问方式，保留访问权限，不把鉴权信息拼入公开 URL。缺失或加载失败时局部降级，不让图片失败清空已取得的业务数据、不自动换成网络同类对象图。图片字段随筛选、分页和刷新一起更新；固定页面素材继续走素材清单，二者不混用。

## dataBinding 契约

`page-spec.json` 或生成命令中优先携带 `dataBinding`。`mode=seed` 指本地演示数据；`data seed form/process` 写入平台的记录仍分别用 `mode=form/process` 读取。真实接口返回零条时保留对应模式并展示空态，本地演示使用 `mode=seed` 并明确标注。

Plan 的 `build-plan.json/pageSpecHandoff` 中 `dataBinding:"form"` 是数据源分类；页面源码的 `DATA_BINDING.mode` 按真实普通/流程类型选择。

```json
{
  "mode": "form",
  "appType": "APP_xxx",
  "formUuid": "FORM_xxx",
  "sourceName": "经销商经营数据",
  "fields": {
    "name": "textField_storeName",
    "amount": "numberField_gmv",
    "status": "selectField_status"
  },
  "refresh": "manual"
}
```

| mode | 用途 | 必填 | 运行方式 |
| --- | --- | --- | --- |
| `seed` | 离线预览 / 明确标注的演示页 | 无 | 只用本地演示数据 |
| `form` | 读宜搭表单数据 | `appType`、`formUuid`、`fields` | 默认 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`；桥不存在时才降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json` |
| `process` | 读流程业务记录 | `appType`、`formUuid`、`fields` | `getProcessInstances(params)`；维护的读取片段将返回的 data 归一到 formData，保留真实流程 ID 和状态 |
| `connector` | 读平台连接器代理 | `connectorName`（`Http_*`）、`operationId`；鉴权连接器另需 `connectionId` | 调用 `window.__OPENYIDA_CONNECTOR_API__.invoke(binding, inputs)`，鉴权留在平台侧 |
| `url` | 读同源业务接口 | `endpoint` | 同源 `fetch` |
| `report` | 读报表或聚合结果 | 报表 schema 参数 | 使用平台聚合结果，不在前端拉全量猜聚合 |

页面实现通过以下入口消费数据契约：

- `page-spec.json` 中的 `dataBinding` 字段。
- 页面实现命令或源码中的 `OPENYIDA_DATA_BINDING_JSON`。
- 手写 `.canvas.jsx` 页面里的 `DATA_BINDING` 常量。

当前列表、看板和大屏页面结构可复用 `DataBridge` 状态模型；其他页面结构需要按本技能规则补齐数据桥后再交付真实数据页面。

## DataBridge 实现规则

1. `DataBridge` 必须有 `loading`、`error`、`rows`、`totalCount`、`lastUpdatedAt` 状态。
2. 首屏可以显示 loading；后续轮询或手动刷新必须 silent，不清空旧列表，不重置整页。
3. 返回体解析必须兼容多层包裹：`data`、`result.data`、`content.data`、`content.result.data`、`list`、`records`、`values`。
4. 已知正总数的有效页缺少行时必须报错；分页已越界时允许空列表并提供返回入口。未知结构不能静默显示“暂无数据”。
5. 真实接口失败时展示错误态和重试入口；刷新失败可保留同一数据源上次成功的记录并标记过期。本地演示数据只用于明确的 `mode=seed`。
6. `useEffect` 内请求要用 `AbortController` 或等价 cleanup，避免页面切换后继续 setState。
7. 轮询间隔需要可控，常规业务页不低于 5 秒；实时大屏可更短，但必须避免重复并发请求。

## 普通表单读取骨架

先提取维护的公共片段，合并 import 与函数到同一个 Canvas 文件，再实现业务 UI：

```bash
openyida sample openyida-page-template canvas-data-source --output .cache/samples/canvas-data-source.jsx
```

在组件内调用：

```jsx
const data = useCanvasFormData(DATA_BINDING, { currentPage, pageSize: 50, query });
// DATA_BINDING 为已核实的 appType/formUuid；query 为真实字段条件数组或字典。
// data.rows 保留原始行及字段值；按真实 fields 映射读取 row.formData。
// data.error 时展示业务错误态和重试按钮；onClick={data.refetch}。
```

普通与流程数据均可使用该片段，mode 分别为 form/process。字段映射和筛选选项消费真实创建回执或 Schema，展示从 `row.formData[fieldId]` 读取；流程详情使用 `row.processInstanceId`。历史普通记录缺少流程 ID 或状态时保持未确认，不默认计为审批中，也不根据属性名 formInstId 推断类型。

源码中显式声明的 JSON `DATA_BINDING`（支持常量别名）在发布时按数据源读取一次 Schema，核对 fields。需要校验选项时声明 `optionValues: {status: ["待执行"]}`，其中 status 对应 fields 的语义名；值取配置选项。字段与选项检查复用一次 Schema，不查询业务全量数据。

- `binding`、`request` 使用 JSON 数据。相同配置重渲染不重复查询，修改筛选时将 `currentPage` 归一为 1。`pageSize` 为整数 1–100，每次只取一页；不全量扫描做前端统计。
- `loading` 表示首屏等待，`refreshing` 表示保留当前行的刷新。刷新按钮在请求中禁用，成功后更新 `lastUpdatedAt`；切换数据源或分页条件会清除前一来源的数据。按业务设计显示空态、旧数据提示和重试。
- 片段兼容明确支持的 `data/result/content/list/records/values` 包裹，未知结构、冲突总数和业务失败会报错。合法空数组可以成功；总数缺失保留 `null`，不得把页长度当全表总数。正总数的有效页没有行会报错；越界页允许空列表并由页面提供返回入口。
- Hook 默认 15 秒超时，可通过 `request.timeoutMs` 指定 1–60000 毫秒。超时、卸载和条件变化后忽略晚到结果，恢复 loading；平台桥没有取消契约，不能声称请求已取消。只有显式 `refetch()` 才重试，业务写入保持独立授权与去重。
- 不填充 seed，不自动映射 label 或改写字段值；数字零使用 `??` 等保留语义的取值方式。核对返回记录的实际 `formData` 与字段 ID，隐藏字段缺失不伪装空字符串。片段不是字段、权限或业务验收。
- `DATA_BRIDGE_UNAVAILABLE` 表示当前同源页面桥尚未可用；保留错误态，确认发布桥与运行上下文后重试。只在明确需要降级时按[数据桥指南](../yida-canvas-custom-page/references/data-bridge-guide.md)接入同源端点；片段不自动降级、不读取父窗口身份、不保存凭据。
- 需要区分空子表与不可见字段时，在绑定中声明 Schema 已确认的 `subformFieldIds`。维护片段仅为缺失子表串行补查同一实例，按明确无行返回显示空态；权限过滤和未知返回继续显示读取异常，普通字段与非空子表不增加请求。

## yida JS-API 桥

Canvas 发布层在外层 `actions.module.source` 注册桥，根节点 `componentDidMount` 指向 `didMount`：`this.utils.yida` 对应 `window.__OPENYIDA_YIDA_API__`，根级 utils 对应 `window.__OPENYIDA_UTILS__`。上述片段沿同源父链查找当前页面桥。连接器和同源自定义接口按各自契约读取，不复用普通表单响应的假设。

### 搜索与分页参数

页面 JS-API 桥的 `searchFormDatas` 支持字段 ID 字典和条件数组。空值、比较和组合查询统一使用[查询条件指南](../../references/query-condition-guide.md)的条件数组：

```javascript
var query = [];
if (keyword.trim()) query.push({ key: fields.name, componentName: 'TextField', type: 'TEXT', operator: 'like', value: keyword.trim() });
if (dateState === 'empty' || dateState === 'filled') {
  query.push({ key: fields.date, componentName: 'DateField', type: 'DOUBLE', operator: dateState === 'empty' ? 'is' : 'is_not', value: '' });
}
var payload = await bridge.searchFormDatas({
  formUuid: binding.formUuid,
  currentPage: 1,
  pageSize: 50,
  searchFieldJson: JSON.stringify(query)
});
```

清空搜索时传空数组，并把 `currentPage` 重置为 1。日期区间使用真实字段 ID 加 `.start` / `.end`，分别按 `DateField` 查询；双端条件按 AND 组合。需要“任一端已填”、多选选项数或子表行数时，按指南维护计数字段并由服务端筛选。可用 `openyida sample yida-data-management empty-query` 取得条件构造器。验收核对空值、有值、零值、半填区间及分页总数，再清空筛选确认全部样本恢复。

## 表单数据读取要点

实现前先确认 `dataBinding.mode === 'form'`、`appType/formUuid` 和 `fields` 都来自真实表单 Schema。表单查询必须优先走 yida JS-API 桥，桥缺失时才降级同源直连。连接器模式遵守 [Canvas 连接器绑定](references/connector-binding.md)，不得接收任意外部 endpoint。

### 关联记录显示

`AssociationFormField` 写入对象数组；查询原字段或 `<fieldId>_id` 投影可能经过单层/双层 JSON 编码，`instValue` 也可能包含原数组。整体复用上述 `canvas-data-source` 片段，用 `readCanvasAssociation(row, fieldId, titleById?)` 完成读取、解码、名称解析和状态判断，仅传 Schema 已确认的关联字段 ID。不另写解析包装；普通文本与原始查询记录保持原样。

```jsx
const customer = readCanvasAssociation(row, fields.customer, customerNamesById);
const customerText = customer.status === 'ready' ? customer.titles.join('、')
  : customer.status === 'empty' ? '未关联' : '关联数据异常';
// JSX 中展示 customerText；业务引用使用 customer.instanceIds。
```

`titleById` 是页面已加载目标记录生成的名称字典，适配器不发请求；字典含该 ID 时以当前名称为准，名称不可用时报 error，不回退旧标题。原字段存在时优先读取，明确的 `null`、空字符串或空数组表示清空；仅字段缺失才依次读 `_id`、`instValue`。返回 `ready / empty / error` 及 `items / instanceIds / titles / error`；缺失隐藏字段、坏格式和缺标题均为 error，不显示实例 ID 或原始 JSON。多关联保留全部标题与原顺序。底层 `parseCanvasAssociationValue` 仅供适配器使用，不能捕获其错误后返回空数组。

子表关联先使用同片段的 `readCanvasSubformRows(parentRow, tableFieldId)`，检查其 `status` 再遍历 `rows`，每行传给 `readCanvasAssociation(childRow, childFieldId, titleById?)`。业务值保持子表投影的字段结构，用 `childRow[fieldId]` 读取，不假定存在额外的 `childRow.formData` 包装。平台可能从子表 formData 中省略空关联，但在父记录 instValue 的子表行内保留明确 `value: []`；子表读取器校验行数、可用行 ID 与文本锚点后将该行原始证据交给关联读取器。不要只做 `row.formData[tableId] || []` 后读取子字段，也不要因字段缺失而推断空值；没有原始证据仍为 error。返回行是副本，不修改原始响应，不增加查询。

```jsx
const deliveries = readCanvasSubformRows(contractRow, fields.deliveries);
if (deliveries.status === 'error') return <span>交付明细读取异常</span>;
return deliveries.rows.map((childRow, index) => {
  const opportunity = readCanvasAssociation(childRow, fields.deliveryOpportunity, opportunityNamesById);
  return <span key={index}>{opportunity.status === 'ready' ? opportunity.titles.join('、')
    : opportunity.status === 'empty' ? '未关联' : '关联数据异常'}</span>;
});
```

跨应用及流程关联保留目标元数据，重复实例或已提供但格式错误的目标元数据为 error。最多解码两层 JSON；编码后的 null/空字符串同样表示明确清空，超出层数或未知对象不猜测转换。支持范围见[关联格式场景矩阵](../yida-data-management/references/data-format-guide.md#场景与边界)；业务权限、过滤及回填结果仍按实际业务核验。

关联渲染静态检查在 compile/publish 的本地编译中拦截能确定的吞错和原值直接文本展示，不增加平台请求；发布时声明绑定的 Schema 核验按前述每个数据源读取一次。两者不证明任意自定义渲染器正确。边界用例在 CLI 研发回归验证；搭建沿用已有写入回读和业务抽查。

## 生成与验收

有附件/图片字段时，按 [OpenAPI 文件上传](../yida-canvas-custom-page/references/file-upload.md) 使用文件桥；真实上传并 confirm 后保存字段，再以真实返回实例 ID 调用 bindFiles。保存成功但绑定失败保留实例 ID 仅重试绑定，不重复保存。匿名提交不支持该文件上传接口。

生成真实数据页前必须确认：

- 已拿到目标 `appType` 和 `formUuid`。
- `fields` 中每个字段 ID 来自真实创建回执或已确认的 Schema，不靠猜。
- 页面首屏 KPI、列表、图表至少有一个区域来自真实数据源。
- 接口异常时页面有明确错误态，不用 demo seed 伪装成成功态。
- 发布后回读页面，确认 `YidaCodeCanvas` 组件的 `runtimeCode` 非空。
- 在已登录浏览器中确认页面退出 loading、无数据加载错误，并显示至少一条已 query 确认的记录。
- 公开页匿名提交前，已回读显示页和目标表单的 `isOpen === 'y'`，并确认目标表单 DEFAULT 权限包含 `FREE_LOGIN`。
- 匿名字段数组使用 `{ componentName, fieldId, fieldData: { value } }`，CSRF 优先来自 `window.g_config._csrf_token`。
- 匿名提交不能只检查 HTTP 200、`success`、`formInstId` 或总数增长；必须按返回的实例 ID 回读代表性字段值。

验收命令：

```bash
openyida publish project/pages/src/dashboard.canvas.jsx <appType> <formUuid>
openyida get-schema <appType> <formUuid> > .cache/openyida/dashboard-schema.json
```

## 常见故障

| 现象 | 处理 |
| --- | --- |
| 页面显示 0 条，但数据管理里有数据 | 先检查外层页面是否注入 `window.__OPENYIDA_YIDA_API__`，再检查返回体包裹层和字段映射；触发 `totalCount` 保护 |
| 首屏后每 5 秒闪白 | 轮询改成 silent refresh，保留旧数据直到新数据返回 |
| 登录态存在但接口 403 | 优先改回 yida JS-API 桥；只有降级直连时才检查同源路径、CSRF 参数和 `global_csrf_token` 头 |
| 公开页提交返回 `LOGIN FAILED` | 不以桥对象存在判断登录态；先识别 `FREELOGIN` / `FREEUSER`，匿名态改走 `RECEIPT_SAVE_FORM_DATA` |
| 匿名网关返回成功但字段为空 | 把每项改为 `{ componentName, fieldId, fieldData: { value } }`，再按 `formInstId` 回读字段值 |
| 接口失败后仍显示漂亮 demo 数据 | 展示真实错误态与重试入口；本地演示使用独立 `mode=seed` 并明确标注 |
| 字段值全为空 | 回读 schema 校验字段 ID，确认字段映射没有使用 label |
