# Code Canvas 数据桥指南（自写 HTTP 读写宜搭数据）

Code Canvas 运行时**没有** `this.utils.yida.*` / `dataSourceMap` / `this.$(fieldId)` 实例数据桥（核实自 `factory.tsx`：物料只透传 `code / runtimeCode / importedModules / pageType`，`YidaComp` 是普通函数组件，wrapper 只注入 `window`）。因此 `YidaComp` 要读写宜搭数据，只能**自己补一座 HTTP 桥**。本文件给出干净、可复用、合规的写法。

## 三条数据路径，先选对

| 路径 | 是否可在浏览器（Canvas）直接调 | 说明 |
| --- | --- | --- |
| 宜搭开放 API（OpenAPI，`appKey`/`appSecret` 签名） | **不可** | 需服务端签名；在浏览器里必然泄露 secret。只能由后端 / 连接器代理调，Canvas 不直连。 |
| 平台已配置**连接器**（HTTP 连接器暴露的同源代理端点） | **推荐** | 同源 `fetch(url, { credentials: 'include' })` 带 cookie 即可，鉴权与密钥留在平台侧，符合数据源治理。 |
| 内部表单数据端点（同源、依赖登录 cookie + CSRF） | 可，但要谨慎 | 与普通自定义页面 `this.utils.yida.searchFormDatas` 命中的是同类端点；需自行带 CSRF token，端点随环境可能变化，不要硬编码跨域绝对地址。 |

选路原则：**优先走连接器代理**（编码规则 #6「不要绕过数据源治理」）。真需要直连内部端点时，只用**同源相对路径** + `credentials: 'include'`，绝不在源码里硬编码 Cookie / CSRF / appSecret。

## 推荐：先写 dataBinding，再生成数据桥

OpenYida `generate-page --spec` 支持把 Canvas 数据契约写成结构化 `dataBinding`，模板会把它注入为 `OPENYIDA_DATA_BINDING_JSON` 并生成统一的数据桥状态、错误态和总数保护。

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
    "pageSize": 20,
    "refresh": "manual"
  }
}
```

数据绑定规则：

- `mode=form` 必须来自真实 `appType/formUuid` 和字段 ID，不要猜字段。
- `mode=connector/url` 必须使用同源代理端点，不把第三方密钥放进 Canvas 源码。
- `mode=seed` 只能用于 `openyida sample`、离线预览或明确标注的演示页，不能标注“已接真实数据”；完整应用/真实交付页需要演示记录时，先把 demo/mock records 写入真实表单，再用 `mode=form` 读取。
- 模板生成的 `DataBridge` 状态要保留，方便线上排查“接口没通 / 结构没识别 / 权限不足”。

## 可复用读数据 Hook

```jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

function getCsrfToken() {
  if (window.g_config && window.g_config._csrf_token) {
    return window.g_config._csrf_token;
  }
  if (window.g_config && window.g_config.csrfToken) {
    return window.g_config.csrfToken;
  }
  return '';
}

function requestJson(url, options) {
  options = options || {};
  var csrfToken = getCsrfToken();
  var headers = { 'Content-Type': 'application/json' };
  if (csrfToken) {
    headers.global_csrf_token = csrfToken;
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

- `credentials: 'include'` 让浏览器带上同源登录态，**不要**手动拼 `Cookie`；很多 Cookie 是 HttpOnly，`document.cookie` 读不到。
- 如需 CSRF，优先从 `window.g_config._csrf_token` / `window.g_config.csrfToken` 动态读取，按接口要求放入 `_csrf_token` 请求参数和 / 或 `global_csrf_token` 头，别写死。
- 用 `AbortController` 在卸载 / 依赖变化时取消，避免 setState-after-unmount（对应编码规则 #5 副作用清理）。
- 解析响应按**真实返回结构**处理，不要假设字段名；不同端点和运行态会出现 `data`、`result.data`、`content.data`、`content.result.data`、`list`、`values`、`records` 等包装。

## 表单查询返回体必须递归解析

“数据管理里有 9 条，但 Code Canvas 页面显示 0 条”的常见根因不是没发请求，而是响应体被多层包装，页面只读了错误层级。统一使用下面的解析器，既兼容数组位置，也能在 `totalCount > 0` 但解析为 0 条时主动暴露故障。

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

- 首屏只有 sample/离线预览可以用 seed 数据做本地预览兜底；真实交付页未接表单数据时展示空态和登记入口，不用 seedRows 冒充业务记录。真实接口返回后必须以接口为准。
- 如果 `getTotalCount(json) > 0` 且 `unwrapRows(json).length === 0`，抛出“接口返回结构未识别”，不要展示“暂无数据”。
- 用 `openyida data query form <appType> <formUuid> --size 20` 或数据管理页核对总数，页面统计必须和真实表单一致。

## 在组件里用

```jsx
function YidaComp(props) {
  var appType = props.appType || '<APP_TYPE>';        // 来自 props 或页面约定
  var formUuid = props.formUuid || '<FORM_UUID>';

  var q = useYidaFetch(function () {
    return {
      url: '/your-connector-proxy/searchFormDatas',    // 连接器同源代理端点（示意）
      method: 'POST',
      body: { appType: appType, formUuid: formUuid, pageSize: 20, pageNumber: 1 },
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

`url`、`body` 字段按你实际接的连接器 / 端点契约填；上面是结构示意，不是可直接跑的真实端点。

## 轮询只刷新数据，不刷新整页

多人同时提交、点赞、更新状态的留言板 / 投票墙 / 任务看板，需要轮询让不同用户看到同一份状态。轮询只应更新统计和列表，不应刷新浏览器页面，也不应每次把页面打回 loading。

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

    // ⚠️ 直连 searchFormDatas.json 必须 GET + query（见下文「直连内部端点」红线）：
    // formUuid/appType 放 URL query，分页参数名是 currentPage（不是 pageNumber）。
    var qs = new URLSearchParams({
      formUuid: '<FORM_UUID>',
      appType: '<APP_TYPE>',
      currentPage: '1',
      pageSize: '50',
      searchFieldJson: '{}',
    }).toString();
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

排序也要按用户语义明确：如果页面是“最新建议”，按 `gmtCreate` / 提交日期倒序；如果页面是“排行榜”，先按点赞数倒序，再用创建时间做 tie-break。不要因为按点赞排序，就误判新增的 0 赞数据“没有同步”。

## 直连内部端点 `searchFormDatas.json` 红线（已验证，看板/列表最常踩）

不方便配连接器、只需读本应用表单数据时，可同源直连内部端点 `searchFormDatas.json`。三个**踩过坑、务必照做**的点，写错任意一个都会「看板全 0」或报「参数校验失败formUuid」，且三个请求会一起 reject：

1. **必须 `GET` + query 参数**，`formUuid`/`appType` 放 **URL query**。若用 `POST` 把 `formUuid` 塞进 body，后端从 query 读不到 → 直接报 **`参数校验失败formUuid`**。
2. **分页参数名是 `currentPage`**（不是 `pageNumber`）；`searchFieldJson` 传 `'{}'` 表示不过滤。
3. **返回列表在 `content.data`**，不是顶层 `data`。响应形如 `{ content: { data: [...], totalCount, currentPage }, success: true }`。上文的 `unwrapRows` 已递归兜底解包，直接用即可。（注意：openyida CLI `data query` 会**归一化**把 `data` 提到顶层，你用 CLI 抽查看到的是顶层 `data`，别被误导——浏览器直连拿到的是 `content.data`。）每行字段值在 `row.formData[fieldId]`，`SelectField`/`RadioField` 已是纯字符串，`DateField` 是 13 位毫秒数。

```jsx
// 已验证：GET + query，读一个表单的数据
function fetchFormData(appType, formUuid, signal) {
  var qs = new URLSearchParams({
    formUuid: formUuid,
    appType: appType,
    currentPage: '1',
    pageSize: '100',
    searchFieldJson: '{}',
  }).toString();
  var url = '/dingtalk/web/' + appType + '/v1/form/searchFormDatas.json?' + qs;
  return requestJson(url, { method: 'GET', signal: signal }).then(function (json) {
    return unwrapRows(json); // content.data 由 unwrapRows 递归兜底
  });
}

// 取字段值：优先 row.formData[fieldId]
function fieldOf(row, fieldId) { return (row.formData || row)[fieldId]; }
```

## 本次故障复盘：为什么页面会一直拿不到最新表单数据

1. **把 Code Canvas 当普通自定义页面写**：Canvas 没有 `this.utils.yida.*` / `dataSourceMap`，必须自写 HTTP 桥。
2. **CSRF 来源取错**：只从 `document.cookie` 找 token 会失败，因为 Cookie 可能是 HttpOnly；应从 `window.g_config` 取页面上下文 token。
3. **响应结构只解析一层**：表单查询可能返回 `content.result.data` 这类多层包裹，页面只读 `json.data` 就会显示 0 条。
4. **Demo 数据掩盖真实错误**：seed 数据让页面看起来“有内容”，但没有证明接口数据真的接入；真实数据页必须用 `totalCount` 做保护，接口异常或未接 dataBinding 时展示错误/空态，不回退成漂亮 demo 列表。
5. **刷新策略不对**：多人状态同步需要 5 秒左右轮询，但轮询只能刷新数值和列表，不能整页 reload，也不能首屏之后反复清空旧数据。
6. **排序口径混淆**：数据存在但按点赞排行时，0 赞新数据可能排在后面；验收时要同时看总数和列表排序规则。

交付验收清单：

- 已确认 appType、formUuid 和字段 ID 来自真实表单 Schema。
- 页面首屏接口返回后，统计总数与数据管理页 / `openyida data query form` 的总数一致。
- 真实接口异常时显示错误原因，不静默回退成“暂无数据”。
- 提交、点赞等写操作成功后调用 silent reload，只更新统计和列表。
- 轮询 `setInterval` 有 cleanup，页面隐藏时暂停请求。

## 写数据（新增 / 更新 / 删除）额外红线

- **确认再写**：删除、批量更新等不可逆操作，先让用户在 UI 里显式确认，不在 `useEffect` 里静默触发。
- **幂等**：提交按钮加 loading 锁与去重键，避免重复写入。
- **权限**：写操作是否允许由平台权限决定，浏览器侧不要伪造身份；失败按后端返回的 `errorMsg` 提示，不吞错。
- **不硬编码密钥**：任何 `appSecret` / 签名逻辑都必须留在服务端 / 连接器，Canvas 源码里只出现同源相对路径与业务参数。
