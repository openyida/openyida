# Canvas 连接器绑定

`mode=connector` 必须使用平台资源身份，而不是任意外部 URL：

必填身份是 `connectorName`、`operationId`；需要鉴权时还必须提供 `connectionId`。

```json
{
  "mode": "connector",
  "connectorName": "Http_b589606ce50f42988ff64db17b370472",
  "operationId": "queryUsers",
  "connectionId": "account-7",
  "inputs": { "path": {}, "query": {}, "header": {}, "body": {} }
}
```

页面通过 `window.__OPENYIDA_CONNECTOR_API__.invoke(binding, binding.inputs)` 调用。桥固定访问宜搭同源 `/query/publicService/invokeService.json`，外部凭据由平台账号注入。不得在 Canvas 源码中保存 App Key、App Secret、token 或直接请求外部域名。

`connectorName` 来自 `connector create/detail --json`，必须以 `Http_` 开头。数字 `connectorId` 只用于 CLI 管理命令，不能写入页面；桥会在 fetch 前拒绝数字 ID。`inputs.body` 直接传对象，不调用 `JSON.stringify`。需要业务 Header 时在页面调用前验证非空，再放入 `inputs.header`。

此模式只适用于不需要宜搭 `systemToken` 的 Action。Action 声明 `body.systemToken` 时，页面停止生成连接器调用，改用 `yida-integration` 创建服务端自动化；CLI 通过 `--connector-system-token-app` 或 spec 的 `secretBindings` 安全绑定目标应用。页面不得读取 `App.getSystemToken`，也不得把 `systemToken` 放入 `inputs`。

无鉴权连接器可省略 `connectionId`；需要鉴权时它必须来自 `openyida connector list-connections <id> --json` 的确定性归属回读。
