# Code Canvas 表单 runtime

## 运行时入口

发布 Code Canvas 页面时，外层页面的 `didMount` 把宜搭能力注册到：

- `window.__OPENYIDA_RUNTIME__.yida`
- `window.openyidaRuntime.yida`
- 兼容别名 `window.__OPENYIDA_YIDA_API__`
- 兼容别名 `window.openyidaYidaApi`

`YidaComp` 内不能直接调用普通页面的 `this.utils.yida.*`。底层普通页面 API 由脚手架注册到上述 window runtime。

官方方法名固定，不要按页面语义或接口标题改名。

runtime 提供 7 个表单方法：`saveFormData`、`updateFormData`、`deleteFormData`、`getFormDataById`、`searchFormDatas`、`searchFormDataIds`、`getFormComponentDefinationList`。

runtime 提供 6 个流程方法：`startProcessInstance`、`updateProcessInstance`、`deleteProcessInstance`、`getProcessInstances`、`getProcessInstanceIds`、`getProcessInstanceById`。

`runtime.theme.install(...)` 负责把主题写入 `style#yida-global-theme`。

## 读取顺序

```javascript
function getYidaApiBridge() {
  var candidates = [];
  try { candidates.push(window.__OPENYIDA_RUNTIME__ && window.__OPENYIDA_RUNTIME__.yida); } catch (err) {}
  try { candidates.push(window.parent && window.parent.__OPENYIDA_RUNTIME__ && window.parent.__OPENYIDA_RUNTIME__.yida); } catch (err) {}
  try { candidates.push(window.__OPENYIDA_YIDA_API__); } catch (err) {}
  try { candidates.push(window.parent && window.parent.__OPENYIDA_YIDA_API__); } catch (err) {}
  try {
    if (typeof parentWindow !== 'undefined') candidates.push(parentWindow.__OPENYIDA_YIDA_API__);
  } catch (err) {}
  return candidates.find(function (item) {
    return item && typeof item.searchFormDatas === 'function';
  }) || null;
}
```

表单查询参数至少包含 `formUuid`、`currentPage`、`pageSize` 和 `searchFieldJson`：

```javascript
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
  return payload;
}
```

## 同源降级

只有 yida JS-API 桥不存在时，才请求：

```text
/dingtalk/web/<appType>/v1/form/searchFormDatas.json
```

请求必须：

- 使用 `credentials: 'include'`。
- 从 `window.g_config`、`window.pageConfig`、`window.__YIDA__`、meta 或同源 cookie 读取 CSRF。
- 同时写入 `_csrf_token` query 和 `global_csrf_token` 请求头。

`/query/form/searchFormDatas.json` 不是可用表单数据端点。

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
```
