# 连接器调用映射

Canvas 的 `dataBinding.mode=connector` 使用稳定资源身份：

```json
{
  "mode": "connector",
  "connectorId": "910244",
  "operationId": "calendarCreateEvent",
  "connectionId": "account-7",
  "inputs": { "path": {}, "query": {}, "header": {}, "body": {} }
}
```

```javascript
var bridge = window.__OPENYIDA_CONNECTOR_API__
  || (window.parent && window.parent.__OPENYIDA_CONNECTOR_API__);
var result = await bridge.invoke(DATA_BINDING, DATA_BINDING.inputs);
```

页面不得保存外部域名、App Secret 或 access token，也不得自行换 token。发布层桥固定调用宜搭同源 `/query/publicService/invokeService.json`，由 `connectionId` 对应的平台鉴权账号注入认证。
