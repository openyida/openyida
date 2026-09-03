# YidaCodeCanvas 组件数据桥

`YidaCodeCanvas` 组件运行时提供 React 函数组件上下文；`YidaComp` 内没有普通页面实例 `this`。读写宜搭表单数据时，发布层必须在外层普通自定义页面 `didMount` 中把 `this.utils.yida.*` 注册成 `window.__OPENYIDA_YIDA_API__`，并把根级 `this.utils.*` 方法注册成 `window.__OPENYIDA_UTILS__`，`YidaCodeCanvas` 组件只消费这些 window 桥。连接器代理和自定义同源接口仍用 HTTP 数据桥。

## 三条数据路径，先选对

| 路径 | 是否可在浏览器页面内直接调 | 说明 |
| --- | --- | --- |
| 外层 yida JS-API 桥 `window.__OPENYIDA_YIDA_API__` | **表单默认** | 发布使用 `YidaCodeCanvas` 组件实现的页面时由外层页面 `didMount` 自动注册，底层调用官方 `this.utils.yida.searchFormDatas`、`saveFormData`、`startProcessInstance`、`getProcessInstances` 等表单/流程 API，并同步运行态已有的 `this.utils.yida` 函数。 |
| 根级 utils 桥 `window.__OPENYIDA_UTILS__` | **工具默认** | 同一个发布层自动注册，暴露 `toast`、`dialog`、`router.push`、`openPage`、`isMobile` 等根级工具；`window.__OPENYIDA_UTILS__.yida` 指向 `window.__OPENYIDA_YIDA_API__`。 |
| 宜搭开放 API（OpenAPI，`appKey`/`appSecret` 签名） | 服务端 / 连接器代理 | 需服务端签名；浏览器直连会泄露 secret。由后端 / 连接器代理调用。 |
| 平台已配置**连接器**（HTTP 连接器暴露的同源代理端点） | **推荐** | 同源 `fetch(url, { credentials: 'include' })` 带 cookie 即可，鉴权与密钥留在平台侧，符合数据源治理。 |
| 内部表单数据端点（同源、依赖登录 cookie + CSRF） | 降级可用 | 仅在 yida JS-API 桥不存在时使用；必须使用同源相对路径、`credentials: 'include'` 和运行态 CSRF token。 |

选路原则：读本应用或本轮创建的宜搭表单，默认走 yida JS-API 桥；读第三方或复杂后端数据，走连接器代理；只有桥不存在且必须读表单时，才同源直连内部端点。Cookie / CSRF / appSecret 由平台上下文、连接器或后端服务提供。

## 推荐：先写 dataBinding，再实现数据桥

使用 `YidaCodeCanvas` 组件实现的页面先把数据契约写成结构化 `dataBinding`，再在页面实现里注入为 `OPENYIDA_DATA_BINDING_JSON` 或 `DATA_BINDING` 常量，并生成统一的数据桥状态、错误态和总数保护。

```json
{
  "template": "business-list",
  "dataBinding": {
    "mode": "form",
    "appType": "APP_xxx",
    "formUuid": "FORM_xxx",
    "sourceName": "订单数据",
    "fields": {
      "code": "textField_orderNo",
      "summary": "textareaField_desc",
      "owner": "employeeField_owner",
      "amount": "numberField_amount",
      "status": "selectField_status"
    },
    "pageSize": 50,
    "refresh": "manual"
  }
}
```

数据绑定规则：

- `mode=form` 使用真实 `appType/formUuid` 和字段 ID，字段来源为 `get-schema`、表单创建结果或已确认的业务 Schema。
- `mode=connector/url` 使用同源代理端点，第三方密钥留在连接器或后端服务侧。
- `mode=seed` 只用于离线预览或明确标注的演示页；完整应用/真实交付页默认先由 `yida-app` 调用 `yida-data-management` 把 1-3 条 demo records 写入真实表单，再用 `mode=form` 读取。
- 页面生成或手写的 `DataBridge` 状态要保留，用于呈现“接口没通 / 结构没识别 / 权限不足”等运行时状态。

`dataBinding.mode=form` 默认调用 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`。同一个桥还会暴露 `saveFormData`、`updateFormData`、`deleteFormData`、`startProcessInstance`、`updateProcessInstance`、`getProcessInstances`、`getProcessInstanceIds`、`getProcessInstanceById`、`request`、`searchUserList` 等 `this.utils.yida` 方法，并运行时枚举已有的额外函数；流程列表、流程详情或发起审批时优先使用这些桥接方法。根级 `toast`、`dialog`、`router.push`、`openPage`、`isMobile` 等工具通过 `window.__OPENYIDA_UTILS__` 访问，`window.__OPENYIDA_UTILS__.yida` 等于同一个 yida API 桥。表单查询参数至少包含 `formUuid`、`currentPage`、`pageSize` 和 `searchFieldJson`，`pageSize` 一般显式写 `50`；`appType` 可保留在 `dataBinding` 中用于校验和构造详情/提交链接。只有桥不存在时才同源直连 `/dingtalk/web/<appType>/v1/form/searchFormDatas.json`；直连 query 至少包含 `formUuid`、`appType`、`currentPage`、`pageSize`、`searchFieldJson` 和 `_csrf_token`，并设置 `credentials: 'include'` 与 `global_csrf_token` 头。`/query/form/searchFormDatas.json` 不是可用表单数据端点。

## 可复用读数据 Hook

```jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

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

function requestJson(url, options) {
  options = options || {};
  var csrfToken = getCsrfToken();
  var headers = { 'Content-Type': 'application/json' };
  if (csrfToken) {
    headers.global_csrf_token = csrfToken;
    headers['x-csrf-token'] = csrfToken;
  }

  return fetch(url, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })
    .then(function (resp) {
      if (!resp.ok) { throw new Error('HTTP ' + resp.status); }
      return resp.json();
    })
    .then(function (json) {
      if (json && json.success === false) {
        throw new Error(json.errorMsg || json.message || 'request failed');
      }
      return json;
    });
}

// 通用：同源、带 cookie、可取消、带 loading/error 的 fetch hook
function useYidaFetch(buildRequest, deps) {
  var stateHook = React.useState({ loading: false, data: null, error: null });
  var state = stateHook[0];
  var setState = stateHook[1];
  var abortRef = React.useRef(null);

  var run = React.useCallback(function () {
    if (abortRef.current) { abortRef.current.abort(); }
    var controller = new AbortController();
    abortRef.current = controller;
    setState({ loading: true, data: null, error: null });

    var req = buildRequest(); // { url, method, body }
    return requestJson(req.url, {
      method: req.method,
      body: req.body,
      signal: controller.signal,
    })
      .then(function (json) {
        setState({ loading: false, data: json, error: null });
      })
      .catch(function (err) {
        if (err.name === 'AbortError') { return; }
        setState({ loading: false, data: null, error: err.message });
      });
  }, deps || []);

  React.useEffect(function () {
    run();
    return function () { if (abortRef.current) { abortRef.current.abort(); } };
  }, deps || []);

  return { loading: state.loading, data: state.data, error: state.error, refetch: run };
}
```

要点：

- `credentials: 'include'` 让浏览器带上同源登录态；Cookie 由浏览器和平台管理。
- 如需 CSRF，优先从 `window.g_config`、`window.pageConfig`、`window.__YIDA__` 等运行态配置动态读取；预览域名缺少注入字段时，兜底读取 meta 或同源 cookie（如 `tianshu_csrf_token`）。内部端点同时放入 `_csrf_token` query 和 `global_csrf_token` 头。
- 用 `AbortController` 在卸载 / 依赖变化时取消请求，保证副作用清理完整（对应编码规则 #5）。
- 解析响应按**真实返回结构**处理；不同端点和运行态会出现 `data`、`result.data`、`content.data`、`content.result.data`、`list`、`values`、`records` 等包装。

## 表单查询返回体必须递归解析

“数据管理里有数据，但自定义页面显示 0 条”的常见失败模式是响应体被多层包装，页面只读了错误层级。统一使用下面的解析器，既兼容数组位置，也能在 `totalCount > 0` 但解析为 0 条时主动暴露故障。

```jsx
function unwrapRows(payload) {
  var queue = [payload];
  var seen = [];

  while (queue.length) {
    var item = queue.shift();
    if (!item || seen.indexOf(item) >= 0) { continue; }
    seen.push(item);

    if (Array.isArray(item)) { return item; }
    ['data', 'list', 'values', 'records'].forEach(function (key) {
      if (Array.isArray(item[key])) {
        queue.unshift(item[key]);
      }
    });
    ['result', 'content', 'value'].forEach(function (key) {
      if (item[key] && typeof item[key] === 'object') {
        queue.push(item[key]);
      }
    });
  }

  return [];
}

function getTotalCount(payload) {
  var queue = [payload];
  var seen = [];

  while (queue.length) {
    var item = queue.shift();
    if (!item || seen.indexOf(item) >= 0) { continue; }
    seen.push(item);

    if (typeof item.totalCount === 'number') { return item.totalCount; }
    if (typeof item.total === 'number') { return item.total; }
    if (typeof item.count === 'number') { return item.count; }
    ['result', 'content', 'data', 'value'].forEach(function (key) {
      if (item[key] && typeof item[key] === 'object') {
        queue.push(item[key]);
      }
    });
  }

  return null;
}

function normalizeFormRow(row) {
  var formData = row.formData || row.data || row;
  return {
    id: row.formInstanceId || row.instanceId || row.id,
    title: formData.textField_xxx || formData.title || '',
    content: formData.textareaField_xxx || formData.content || '',
  };
}
```

保护规则：

- 首屏只有离线预览可以用 seed 数据做本地预览兜底；真实交付页未接表单数据时展示空态和登记入口。真实接口返回后以接口数据为准。
- 如果 `getTotalCount(json) > 0` 且 `unwrapRows(json).length === 0`，展示“接口返回结构未识别”，并保留原始错误状态供定位。
- 用 `openyida data query form <appType> <formUuid> --size 20` 或数据管理页核对总数，页面统计必须和真实表单一致。

## 在组件里用

```jsx
function YidaComp(props) {
  var appType = props.appType || '<APP_TYPE>';        // 来自 props 或页面约定
  var formUuid = props.formUuid || '<FORM_UUID>';

  var q = useYidaFetch(function () {
    return {
      url: '/your-connector-proxy/searchFormDatas',    // 连接器同源代理端点（示意，不是宜搭表单直连端点）
      method: 'POST',
      body: { appType: appType, formUuid: formUuid, pageSize: 50, pageNumber: 1 },
    };
  }, [appType, formUuid]);

  if (q.loading) { return <div>加载中…</div>; }
  if (q.error) { return <div style={{ color: 'red' }}>加载失败：{q.error}</div>; }

  var rows = unwrapRows(q.data);
  var totalCount = getTotalCount(q.data);
  if (totalCount > 0 && rows.length === 0) {
    return <div style={{ color: 'red' }}>接口返回结构未识别，请检查响应包装层</div>;
  }

  return (
    <ul>
      {rows.map(function (row) {
        var item = normalizeFormRow(row);
        return <li key={item.id}>{item.title}</li>;
      })}
    </ul>
  );
}

export default YidaComp;
```

`url`、`body` 字段按实际连接器 / 端点契约填写；示例结构用于说明数据桥写法。直连宜搭表单数据时不要复用这个连接器代理示例，必须使用下文 `searchFormDatas.json` 请求契约。

## 轮询只刷新数据，不刷新整页

多人同时提交、点赞、更新状态的留言板 / 投票墙 / 任务看板，需要轮询让不同用户看到同一份状态。轮询更新统计和列表，保留当前页面和已加载数据状态。

```jsx
var POLL_INTERVAL_MS = 5000;

function YidaComp() {
  var dataState = React.useState([]);
  var rows = dataState[0];
  var setRows = dataState[1];
  var loadingState = React.useState(true);
  var loading = loadingState[0];
  var setLoading = loadingState[1];
  var hasLoadedRef = React.useRef(false);
  var requestSeqRef = React.useRef(0);

  var loadRows = React.useCallback(function (opts) {
    var silent = opts && opts.silent;
    var seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    if (!silent && !hasLoadedRef.current) {
      setLoading(true);
    }

    // 直连 searchFormDatas.json 必须 GET + query（见下文请求契约）：
    // formUuid/appType 放 URL query，分页参数名是 currentPage。
    var qs = new URLSearchParams({
      formUuid: '<FORM_UUID>',
      appType: '<APP_TYPE>',
      currentPage: '1',
      pageSize: '50',
      searchFieldJson: '{}',
    });
    var csrfToken = getCsrfToken();
    if (csrfToken) qs.set('_csrf_token', csrfToken);
    return requestJson('/dingtalk/web/<APP_TYPE>/v1/form/searchFormDatas.json?' + qs, {
      method: 'GET',
    }).then(function (json) {
      if (seq !== requestSeqRef.current) { return; }
      var nextRows = unwrapRows(json).map(normalizeFormRow);
      var totalCount = getTotalCount(json);
      if (totalCount > 0 && nextRows.length === 0) {
        throw new Error('接口返回结构未识别');
      }
      setRows(nextRows);
      hasLoadedRef.current = true;
    }).finally(function () {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    });
  }, []);

  React.useEffect(function () {
    loadRows({ silent: false });

    var timer = setInterval(function () {
      if (!document.hidden) {
        loadRows({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    return function () { clearInterval(timer); };
  }, [loadRows]);

  if (loading && !hasLoadedRef.current) { return <div>加载中...</div>; }
  return <List rows={rows} />;
}
```

轮询骨架固定使用 `hasLoadedRef`；复制或调整代码时，声明、写入和读取必须保持同名，不能只把部分引用改成 `loadedRef`。

排序也要按用户语义明确：页面是“最新建议”时，按 `gmtCreate` / 提交日期倒序；页面是“排行榜”时，先按点赞数倒序，再用创建时间做 tie-break。验收时同时看总数和排序规则，确认新增记录是否进入正确位置。

## 直连内部端点 `searchFormDatas.json` 请求契约

不方便配连接器、只需读本应用表单数据时，可同源直连内部端点 `searchFormDatas.json`。请求契约如下：

1. **`GET` + query 参数**：`formUuid`/`appType` 放 URL query。
2. **分页参数名是 `currentPage`**；`searchFieldJson` 传 `'{}'` 表示不过滤。
3. **CSRF 和登录态同时带上**：运行态 CSRF 写入 query 的 `_csrf_token`，请求头写 `global_csrf_token`，fetch 设置 `credentials: 'include'`。
4. **返回列表在 `content.data`**：响应形如 `{ content: { data: [...], totalCount, currentPage }, success: true }`。上文的 `unwrapRows` 已递归兜底解包，直接用即可。每行字段值在 `row.formData[fieldId]`，`SelectField`/`RadioField` 已是纯字符串，`DateField` 是 13 位毫秒数。

```jsx
// GET + query，读一个表单的数据
function fetchFormData(appType, formUuid, signal) {
  var qs = new URLSearchParams({
    formUuid: formUuid,
    appType: appType,
    currentPage: '1',
    pageSize: '50',
    searchFieldJson: '{}',
  });
  var csrfToken = getCsrfToken();
  if (csrfToken) qs.set('_csrf_token', csrfToken);
  var url = '/dingtalk/web/' + appType + '/v1/form/searchFormDatas.json?' + qs;
  return requestJson(url, { method: 'GET', signal: signal }).then(function (json) {
    return unwrapRows(json); // content.data 由 unwrapRows 递归兜底
  });
}

// 取字段值：优先 row.formData[fieldId]
function fieldOf(row, fieldId) { return (row.formData || row)[fieldId]; }
```

## 数据接入验收清单

- 已确认 appType、formUuid 和字段 ID 来自真实表单 Schema。
- 页面首屏接口返回后，统计总数与数据管理页 / `openyida data query form` 的总数一致。
- 真实接口异常时显示错误原因和重试入口。
- 提交、点赞等写操作成功后调用 silent reload，只更新统计和列表。
- 轮询 `setInterval` 有 cleanup，页面隐藏时暂停请求。

## 写数据（新增 / 更新 / 删除）额外红线

- **确认再写**：删除、批量更新等不可逆操作，先让用户在 UI 里显式确认，严禁在 `useEffect` 里静默触发。
- **幂等**：提交按钮加 loading 锁与去重键，拦截重复写入。
- **权限**：写操作是否允许由平台权限决定；失败按后端返回的 `errorMsg` 提示。
- **密钥位置**：任何 `appSecret` / 签名逻辑都留在服务端 / 连接器，页面源码里只出现同源相对路径与业务参数。
