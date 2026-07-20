---
name: yida-canvas-data-binding
description: Code Canvas / YidaCodeCanvas 页面真实数据接入技能。用于在 Canvas 页面中用 dataBinding + 同源 fetch 接入宜搭表单、连接器代理或同源接口数据，处理 CSRF、credentials、返回体包裹解析、totalCount 保护、DataBridge 状态和静默刷新。触发词：dataBinding、DataBridge、Canvas 数据桥、Code Canvas 真实数据、页面显示 0 条但数据管理有数据、表单数据接入 Canvas、轮询刷新列表或 KPI。
---

# Code Canvas 数据绑定

## 核心定位

本技能只处理 Code Canvas 页面里的真实数据接入：把页面所需数据先声明成 `dataBinding` 契约，再由模板或业务组件生成统一的 `DataBridge`，在 `YidaComp` 内通过同源 `fetch` 读取数据并驱动 UI。

Code Canvas 运行时是标准 React 组件环境，组件没有普通宜搭自定义页实例对象。因此数据接入要显式写清来源、字段映射、刷新策略和异常处理，不能靠隐式页面实例补齐。

## 运行时事实

- `YidaCodeCanvas` 物料只透传 `code / runtimeCode / importedModules / pageType`。
- 组件内没有 `this` 上下文，也没有 `dataSourceMap`。
- `this.utils.yida.*`、`didMount()`、`_customState` 等普通页面契约不可用。
- Cookie 由浏览器同源请求自动携带，前端代码不能硬编码 Cookie、appSecret、accessKey 或外部密钥。
- 调宜搭同源端点时，请求必须带 `credentials: 'include'`。
- CSRF 优先从 `window.g_config._csrf_token` 或 `window.g_config.csrfToken` 读取；内部端点常同时需要 `_csrf_token` 参数和 `global_csrf_token` 请求头。

## dataBinding 契约

页面 spec 或生成命令中优先携带 `dataBinding`。没有真实数据时只能标记为 `seed`，不能声称已经接入线上数据。

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
| `seed` | 演示兜底 / 本地预览 | 无 | 只用模板 seed 数据 |
| `form` | 读宜搭表单数据 | `appType`、`formUuid`、`fields` | 同源 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json` |
| `connector` | 读平台连接器代理 | `endpoint` | 同源代理端点，鉴权留在平台侧 |
| `url` | 读同源业务接口 | `endpoint` | 同源 `fetch` |
| `report` | 读报表或聚合结果 | 报表 schema 参数 | 使用平台聚合结果，不在前端拉全量猜聚合 |

OpenYida 模板可通过以下入口消费数据契约：

- `openyida generate-page --spec <file>` 中的 `dataBinding` 字段。
- `openyida generate-page ... --data-binding <json>`。
- `openyida generate-page ... --data-source <mode>` 的轻量模式。
- 环境变量 `OPENYIDA_DATA_BINDING_JSON`。

当前 `business-list` 和 `dashboard-overview` 模板已内置 `DataBridge` 结构；其他模板需要按本技能规则补齐数据桥后再交付真实数据页面。

## DataBridge 实现规则

1. `DataBridge` 必须有 `loading`、`error`、`rows`、`totalCount`、`lastUpdatedAt` 状态。
2. 首屏可以显示 loading；后续轮询或手动刷新必须 silent，不清空旧列表，不重置整页。
3. 返回体解析必须兼容多层包裹：`data`、`result.data`、`content.data`、`content.result.data`、`list`、`records`、`values`。
4. `totalCount > 0 && rows.length === 0` 必须视为数据桥故障，页面显式报错，不能静默显示“暂无数据”。
5. seed 数据只能作为接口失败时的低保真兜底，并在状态区标记“示例数据”或“接口异常”。
6. `useEffect` 内请求要用 `AbortController` 或等价 cleanup，避免页面切换后继续 setState。
7. 轮询间隔需要可控，常规业务页不低于 5 秒；实时大屏可更短，但必须避免重复并发请求。

示例骨架：

```javascript
function getCsrfToken() {
  var config = window.g_config || {};
  return config._csrf_token || config.csrfToken || '';
}

function unwrapRows(payload) {
  var candidates = [
    payload && payload.data,
    payload && payload.result && payload.result.data,
    payload && payload.content && payload.content.data,
    payload && payload.content && payload.content.result && payload.content.result.data,
    payload && payload.list,
    payload && payload.records,
    payload && payload.values
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    if (Array.isArray(candidates[i])) return candidates[i];
  }
  return [];
}

function unwrapTotal(payload, rows) {
  var candidates = [
    payload && payload.totalCount,
    payload && payload.total,
    payload && payload.data && payload.data.totalCount,
    payload && payload.result && payload.result.totalCount,
    payload && payload.content && payload.content.totalCount
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    var value = Number(candidates[i]);
    if (!Number.isNaN(value)) return value;
  }
  return rows.length;
}
```

## 表单数据读取要点

表单查询请求必须同源、带 Cookie、带 CSRF，并根据字段映射把宜搭字段 ID 归一成页面业务字段。

```javascript
async function fetchFormRows(binding, signal) {
  var csrfToken = getCsrfToken();
  var url = '/dingtalk/web/' + binding.appType + '/v1/form/searchFormDatas.json';
  var body = new URLSearchParams();
  body.set('formUuid', binding.formUuid);
  body.set('pageSize', String(binding.pageSize || 20));
  body.set('currentPage', String(binding.currentPage || 1));
  if (csrfToken) body.set('_csrf_token', csrfToken);

  var response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'global_csrf_token': csrfToken
    },
    body: body,
    signal: signal
  });

  if (!response.ok) {
    throw new Error('表单数据读取失败：HTTP ' + response.status);
  }

  var payload = await response.json();
  var rows = unwrapRows(payload);
  var totalCount = unwrapTotal(payload, rows);
  if (totalCount > 0 && rows.length === 0) {
    throw new Error('表单返回 totalCount > 0，但页面没有解析到行数据，请检查返回体包裹层和字段映射。');
  }
  return { rows: rows, totalCount: totalCount, raw: payload };
}
```

## 生成与验收

生成真实数据页前必须确认：

- 已拿到目标 `appType` 和 `formUuid`。
- `fields` 中每个字段 ID 来自 `openyida get-schema` 或缓存 schema，不靠猜。
- 页面首屏 KPI、列表、图表至少有一个区域来自真实数据源。
- 接口异常时页面有明确错误态，不用 demo seed 伪装成成功态。
- 发布后回读页面，确认 `YidaCodeCanvas` 的 `runtimeCode` 非空。

验收命令：

```bash
openyida generate-page dashboard-overview --spec .cache/openyida/page-spec.json --output project/pages/src/dashboard.canvas.jsx --compile
openyida publish project/pages/src/dashboard.canvas.jsx <appType> <formUuid>
openyida get-schema <appType> <formUuid> > .cache/openyida/dashboard-schema.json
```

## 常见故障

| 现象 | 处理 |
| --- | --- |
| 页面显示 0 条，但数据管理里有数据 | 检查 CSRF、`credentials: 'include'`、返回体包裹层和字段映射；触发 `totalCount` 保护 |
| 首屏后每 5 秒闪白 | 轮询改成 silent refresh，保留旧数据直到新数据返回 |
| 登录态存在但接口 403 | 检查同源路径、CSRF 参数和 `global_csrf_token` 头 |
| 接口失败后仍显示漂亮 demo 数据 | 改成错误态 + seed 标识，不能伪装真实成功 |
| 字段值全为空 | 回读 schema 校验字段 ID，确认字段映射没有使用 label |
