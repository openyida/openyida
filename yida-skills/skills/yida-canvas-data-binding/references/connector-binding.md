# Canvas 连接器绑定

`mode=connector` 必须使用平台资源身份，而不是任意外部 URL：

必填身份是 `connectorId`、`operationId`；需要鉴权时还必须提供 `connectionId`。

```json
{
  "mode": "connector",
  "connectorId": "910244",
  "operationId": "queryUsers",
  "connectionId": "account-7",
  "inputs": { "path": {}, "query": {}, "header": {}, "body": {} }
}
```

页面通过 `window.__OPENYIDA_CONNECTOR_API__.invoke(binding, binding.inputs)` 调用。桥固定访问宜搭同源 `/query/publicService/invokeService.json`，外部凭据由平台账号注入。不得在 Canvas 源码中保存 App Key、App Secret、token 或直接请求外部域名。

无鉴权连接器可省略 `connectionId`；需要鉴权时它必须来自 `openyida connector list-connections <id> --json` 的确定性归属回读。
