# 连接器调用映射

Action 需要 `body.systemToken` 时不生成 Canvas 映射，改用 `yida-integration` 服务端调用。Canvas 只绑定不需要该凭据的 Action。

Canvas 的 `dataBinding.mode=connector` 使用稳定资源身份：

```json
{
  "mode": "connector",
  "connectorName": "Http_b589606ce50f42988ff64db17b370472",
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

数字 `connectorId`（例如 `917319`）只用于 `openyida connector detail/list-actions/test` 等管理命令。页面调用网关时必须使用 `connector create/detail --json` 回读的内部 `connectorName`，其值以 `Http_` 开头；发布层会把它映射为 `serviceInfo.connectorInfo.connectorId`。不得把数字 ID 写入页面 binding。

`inputs.body` 必须直接传对象，例如 `{ summary: '合同评审' }`；不得传 `JSON.stringify(...)` 的字符串。业务必填 Header 在页面调用前检查并传入 `inputs.header`，Action Schema 中的 Header 保持 `required=false`。

页面不得保存外部域名、App Secret 或 access token，也不得自行换 token。发布层桥固定调用宜搭同源 `/query/publicService/invokeService.json`，由 `connectionId` 对应的平台鉴权账号注入认证。
