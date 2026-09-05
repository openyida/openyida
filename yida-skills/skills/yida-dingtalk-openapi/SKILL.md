---
name: yida-dingtalk-openapi
description: 将钉钉开放平台官方服务端 API 转成宜搭 HTTP 连接器动作，并供表单、集成自动化或 YidaCodeCanvas 自定义页面安全调用。负责官方文档核对、DingAuth 账号配置暂停与确定性回读。触发词：钉钉开放平台接口、api.dingtalk.com、x-acs-dingtalk-access-token。
---

# 钉钉开放平台连接器

## 触发条件

- 用户给出钉钉开放平台官方接口文档，要求接入宜搭连接器、表单、自动化或 Canvas 页面。
- 需求包含 `api.dingtalk.com`、`DingAuth` 或 `x-acs-dingtalk-access-token`。

## WHEN NOT

- 普通第三方或自建 HTTP API 使用 `yida-connector`。
- 已有连接器且只需从前后端代码提取动作时使用 `yida-connector-safe-actions`。
- 只在历史平台 JSX 页面绑定已有连接器数据源时使用 `yida-data-source-connectors`。

## 核心原则

- 只以用户指定的钉钉官方文档为接口契约；页面较多时按本次业务所需接口逐项读取，不复制整站目录。
- OpenYida 不支持钉钉事件订阅、Stream/WebSocket 或 HTTP 回调接收；遇到此类需求时直接说明不支持并停止，不生成连接器动作。
- App Key、App Secret、access token 永远不进入聊天、源码、JSON、命令参数或日志。
- AI 创建连接器和动作；鉴权账号由用户打开 `accountManageUrl`，在宜搭页面自行配置。
- 不需要 `systemToken` 的 Action 可由 Canvas 通过 `window.__OPENYIDA_CONNECTOR_API__` 调用。需要 `systemToken` 的宜搭 OpenAPI 必须改用 `yida-integration`，由 CLI 在服务端安全绑定；页面源码和 Action 默认值都不保存该凭据。

## 工作流

1. 按 [官方文档入口](references/api-contract.md#官方文档入口) 定位目标接口页；用户给了精确官方 URL 时直接使用。
2. 从目标接口页提取 method、host、path、path/query/header/body、响应、权限和幂等字段，按 [API 契约](references/api-contract.md#契约格式) 生成无密钥契约文件；每个 Action 保存自己的 `sourceUrl`。
3. 按 [入参依赖](references/api-contract.md#入参依赖) 检查每个必填参数的真实语义、固定值和“调用其他接口获取”链接。所有前置接口也必须生成宜搭自定义连接器 Action，通过连接器调用；不得改用 `curl`、临时脚本或页面直连。依赖值未解析时不得创建或调用主 Action。
4. 若文档属于事件订阅、Stream/WebSocket 或 HTTP 回调接收，直接说明 OpenYida 不支持并停止。
5. 创建 `DingAuth` 连接器；不得传 `--app-key` / `--app-secret`。
6. 创建结果必须满足 `readbackVerified=true`；`CONNECTOR_READBACK_MISMATCH` 是阻断错误，即使 `list-actions` 能看到动作也不得继续。记录数字管理 ID `connectorId` 和页面运行时内部名 `connectorName`（必须以 `Http_` 开头）。
7. 执行 `list-actions` 回读稳定 `operationId`。
8. 执行一次 `list-connections --json`，记录 `beforeConnectionIds`。
9. 若没有可确定复用的 ACTIVE 账号，返回授权账号地址 `accountManageUrl`、连接器详情地址 `detailUrl` 和建议账号名后暂停；用户打开 `accountManageUrl`，在宜搭中自行添加授权账号。
10. 用户只需回复“已配置”，不要回复密钥或账号 ID。再次执行 `list-connections --json`：
   - 恰好新增一个且名称符合预期：使用该账号；
   - 没有新增，但存在唯一同名 ACTIVE 账号：复用；
   - 多个新增、同名不唯一、名称不符或状态非 ACTIVE：停止，展示低敏候选信息，不猜测。
11. 用 `connector test --account-id` 做真实只读探针；宜搭 OpenAPI 额外传 `--system-token-app <appType>`，CLI 只在内存中注入 `body.systemToken`。写类接口需单独确认业务副作用。
12. 不需要 `systemToken` 的页面调用加载 `yida-canvas-data-binding`，页面 binding 写 `connectorName: "Http_*"`，Body 传对象。需要 `systemToken` 时加载 `yida-integration`，创建服务端自动化；不生成前端连接器调用。

## 创建命令

```bash
openyida connector create "<名称>" "api.dingtalk.com" \
  --auth "钉钉开放平台验证" \
  --operations .cache/openyida/<任务>/connector/operations.json \
  --json

openyida connector list-actions <connector-id> --json
openyida connector list-connections <connector-id> --json
```

`connector create --json` 返回 `accountManageUrl` 和 `detailUrl`。添加授权账号时优先把 `accountManageUrl` 交给用户；`detailUrl` 用于查看连接器定义。不得要求用户把配置后的 ID 发给 AI；CLI 通过前后两次列表差异自行发现。

## 完成标准

- 每个 Action 都有精确官方 `sourceUrl`，契约字段可追溯且无任何凭据值。
- 每个必填入参都已解析为用户输入、固定值、页面运行态值或前置 Action 输出；不能只按字段名猜语义。
- 连接器返回 `readbackVerified=true`，数字 `connectorId` 与 `Http_*` `connectorName` 均已记录；页面只使用 `connectorName`。
- Action Header 均为 `required=false`，固定 `Content-Type` 有非空默认值，可选 Header 不保存空默认项。
- 连接器及动作已回读，账号归属和 ACTIVE 状态已确定。
- 只读测试返回业务可识别结果；不能仅凭 HTTP 200 宣称完成。
- Canvas 场景已通过固定平台代理调用，刷新后仍可读取真实数据。
- 若停在鉴权阶段，明确报告 connectorId、accountManageUrl、detailUrl、建议账号名和暂停原因，不宣称集成完成。

## 参考

- [官方文档入口与 API 契约](references/api-contract.md)
- [连接器与 Canvas 映射](references/connector-mapping.md)
- [钉钉开放平台文档](https://open.dingtalk.com/document/)
