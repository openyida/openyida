---
name: yida-canvas-data-binding
description: 自定义页面真实数据接入技能。用于在使用 `YidaCodeCanvas` 组件实现的页面中用 dataBinding + 外层页面 yida JS-API 桥接接入宜搭表单、连接器代理或同源接口数据，处理返回体包裹解析、totalCount 保护、DataBridge 状态和静默刷新。触发词：dataBinding、DataBridge、数据桥、YidaCodeCanvas 真实数据、页面显示 0 条但数据管理有数据、表单数据接入、轮询刷新列表或 KPI。
---

# 自定义页面数据绑定

## 核心定位

本技能只处理使用 `YidaCodeCanvas` 组件实现的页面里的真实数据接入：把页面所需数据先声明成 `dataBinding` 契约，再由页面生成器或业务组件生成统一的 `DataBridge`。读取宜搭表单数据时，默认消费外层普通自定义页面在 `didMount` 中注册到 `window.__OPENYIDA_YIDA_API__` 的 yida JS-API 桥；连接器代理或自定义同源接口仍按自身 endpoint 读取。

`YidaCodeCanvas` 组件运行时是标准 React 组件环境，组件没有普通宜搭自定义页实例对象。因此数据接入要显式写清来源、字段映射、刷新策略和异常处理，不能靠隐式页面实例补齐。

## 运行时事实

- `YidaCodeCanvas` 组件只透传 `code / runtimeCode / importedModules / pageType`。
- 组件内没有 `this` 上下文，也没有 `dataSourceMap`。
- `this.utils.yida.*`、`didMount()`、`_customState` 等普通页面契约在 `YidaComp` 内不可直接使用；发布使用 `YidaCodeCanvas` 组件实现的页面时，外层普通页面的 `didMount` 必须自动把 `this.utils.yida.*` 封装到 `window.__OPENYIDA_YIDA_API__`，组件内部只能消费该 window 桥。
- `YidaCodeCanvas` 组件没有官方 `useDataBinding` hook，不得从任何包 `import { useDataBinding }`；真实表单数据绑定用页面内本地 `useYidaData(binding)`、`DataBridge` 和 yida JS-API 桥实现。
- Cookie 由浏览器同源请求自动携带，前端代码不能硬编码 Cookie、appSecret、accessKey 或外部密钥。
- `mode=form` 读取宜搭表单数据时，默认调用 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`，它底层来自官方 `this.utils.yida.searchFormDatas(params)`。参数至少包含 `formUuid`、`currentPage`、`pageSize` 和 `searchFieldJson`，字段 ID 必须来自真实 schema。
- 只有 yida JS-API 桥不存在时，才允许降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json`。直连请求必须带 `credentials: 'include'`，并从 `window.g_config`、`window.pageConfig`、`window.__YIDA__`、meta 或同源 cookie 读取 CSRF，同时写入 `_csrf_token` query 和 `global_csrf_token` 请求头。`/query/form/searchFormDatas.json` 不是可用表单数据端点。

## dataBinding 契约

`page-spec.json` 或生成命令中优先携带 `dataBinding`。没有真实数据时只能标记为 `seed`，不能声称已经接入线上数据。

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
| `seed` | 演示兜底 / 本地预览 | 无 | 只用本地演示数据 |
| `form` | 读宜搭表单数据 | `appType`、`formUuid`、`fields` | 默认 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`；桥不存在时才降级同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json` |
| `connector` | 读平台连接器代理 | `endpoint` | 同源代理端点，鉴权留在平台侧 |
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
4. `totalCount > 0 && rows.length === 0` 必须视为数据桥故障，页面显式报错，不能静默显示“暂无数据”。
5. seed 数据只能作为接口失败时的低保真兜底，并在状态区标记“示例数据”或“接口异常”。
6. `useEffect` 内请求要用 `AbortController` 或等价 cleanup，避免页面切换后继续 setState。
7. 轮询间隔需要可控，常规业务页不低于 5 秒；实时大屏可更短，但必须避免重复并发请求。

实现骨架：

```javascript
function getCsrfToken() {
  var yida = window.__YIDA__ || {};
  var sources = [
    window.g_config,
    window.pageConfig,
    window.YIDA_CONFIG,
    yida,
    yida.config,
    yida.pageConfig,
    yida.runtimeConfig
  ];
  var keys = ['_csrf_token', 'csrfToken', 'csrf_token', 'global_csrf_token', '_tb_token_', 'csrf'];
  for (var i = 0; i < sources.length; i += 1) {
    var source = sources[i] || {};
    for (var j = 0; j < keys.length; j += 1) {
      if (source[keys[j]]) return source[keys[j]];
    }
  }
  var cookie = typeof document !== 'undefined' && document.cookie ? document.cookie : '';
  var match = cookie.match(/(?:^|;\s*)(tianshu_csrf_token|aliwork_csrf_token|XSRF-TOKEN|_csrf_token|csrfToken|_tb_token_)=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : '';
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

## yida JS-API 桥

发布使用 `YidaCodeCanvas` 组件实现的页面时，必须在外层页面 `actions.module.source` 中注入桥接脚本，并把根节点 `componentDidMount` 指向 `didMount`。桥接脚本只做一件事：把普通页面运行态可用的 `this.utils.yida.*` 封装到 `window.__OPENYIDA_YIDA_API__` 和 `window.openyidaYidaApi`，供组件内部通过 `window.parent` / `parentWindow` 查找。

页面内固定使用下面的读取顺序：

```javascript
function getYidaApiBridge() {
  var candidates = [];
  try { candidates.push(window.__OPENYIDA_YIDA_API__); } catch (err) {}
  try { candidates.push(window.parent && window.parent.__OPENYIDA_YIDA_API__); } catch (err) {}
  try {
    if (typeof parentWindow !== 'undefined') {
      candidates.push(parentWindow.__OPENYIDA_YIDA_API__);
    }
  } catch (err) {}
  return candidates.find(function (item) {
    return item && typeof item.searchFormDatas === 'function';
  }) || null;
}

async function fetchFormRows(binding, signal) {
  var bridge = getYidaApiBridge();
  var payload;
  if (bridge) {
    payload = await bridge.searchFormDatas({
      appType: binding.appType,
      formUuid: binding.formUuid,
      currentPage: binding.currentPage || 1,
      pageSize: binding.pageSize || 20,
      searchFieldJson: JSON.stringify(binding.query || {}),
      dynamicOrder: binding.dynamicOrder || ''
    });
  } else {
    payload = await fetchFormRowsBySameOriginFallback(binding, signal);
  }
  var rows = unwrapRows(payload);
  var totalCount = unwrapTotal(payload, rows);
  if (totalCount > 0 && rows.length === 0) {
    throw new Error('表单返回 totalCount > 0，但页面没有解析到行数据，请检查返回体包裹层和字段映射。');
  }
  return { rows: rows, totalCount: totalCount, raw: payload };
}
```

## 表单数据读取要点

实现前先确认 `dataBinding.mode === 'form'`、`appType/formUuid` 和 `fields` 都来自真实表单 Schema。表单查询必须优先走 yida JS-API 桥，桥缺失时才降级同源直连；连接器代理可以使用自己的 endpoint，但不能把连接器代理写成 `/query/form/searchFormDatas.json`。

## 生成与验收

生成真实数据页前必须确认：

- 已拿到目标 `appType` 和 `formUuid`。
- `fields` 中每个字段 ID 来自 `openyida get-schema` 或缓存 schema，不靠猜。
- 页面首屏 KPI、列表、图表至少有一个区域来自真实数据源。
- 接口异常时页面有明确错误态，不用 demo seed 伪装成成功态。
- 发布后回读页面，确认 `YidaCodeCanvas` 组件的 `runtimeCode` 非空。
- 在已登录浏览器中确认页面退出 loading、无数据加载错误，并显示至少一条已 query 确认的记录。

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
| 接口失败后仍显示漂亮 demo 数据 | 改成错误态 + seed 标识，不能伪装真实成功 |
| 字段值全为空 | 回读 schema 校验字段 ID，确认字段映射没有使用 label |
