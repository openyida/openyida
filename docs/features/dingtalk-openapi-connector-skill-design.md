# 钉钉开放平台连接器技能设计

## 状态

- 阶段：本地实现与离线验证完成，待显式授权租户上的真实只读链路验收
- 目标技能：`yida-dingtalk-openapi`
- 配套技能：`yida-connector`、`yida-canvas-data-binding`
- 非目标：复制整套钉钉开放平台文档、让页面直连钉钉域名、钉钉事件订阅、Stream/WebSocket、HTTP 回调接收

## 1. 背景与目标

钉钉开放平台包含日程、通讯录、考勤、审批、待办、文档、即时通信等大量服务端 API，接口文档会持续更新。OpenYida 当前已有通用 HTTP 连接器管理能力，但缺少一个专门负责理解钉钉官方文档、鉴权与权限约束，并稳定生成连接器 Action 的领域技能。

本方案需要完成三个闭环：

1. 钉钉官方接口文档转换为可验证的连接器 Action。
2. 连接器 Action 由宜搭自定义页面稳定调用，不暴露凭证。
3. 写操作具备幂等、失败状态和业务回读约束。

官方“创建日程”接口同时包含路径参数、嵌套请求体、应用类型、权限、访问凭证头和幂等头，不能只根据 URL 或请求示例猜测 Action。参考：[创建日程接口](https://open.dingtalk.com/document/development/create-schedule)。

## 2. 已确认的实现边界

### 2.1 只支持服务端 REST API

- 服务端 REST API 可以映射为 HTTP Connector Action。
- 客户端 JSAPI 不能用服务端连接器代替。
- OpenYida 不支持事件订阅、Stream/WebSocket 或 HTTP 回调接收。遇到此类需求时直接说明不支持并停止，不生成连接器或接收端方案。

### 2.2 官方文档是唯一接口事实源

技能不在仓库内复制几千条、持续变化的完整 API 清单，而是在 `references/api-contract.md` 维护钉钉文档中心“开放接口一览”中的业务域入口。用户给出精确官方 URL 时直接使用；只给业务目标时先从业务域入口定位具体接口页。

每个生成的 Action 必须单独保存精确 `operation.sourceUrl`，并记录文档更新时间、应用类型、权限和接口版本；同一个连接器含多个 Action 时不能只依赖文件顶层 URL。

### 2.3 现有连接器 CLI 继续负责平台写入

新技能负责“官方文档 → 标准化契约 → Action 草稿”，现有 `yida-connector` 继续负责：

- 查找或创建连接器；
- 创建鉴权账号；
- 添加、更新和查询 Action；
- 使用真实连接账号测试 Action；
- 写后回读连接器及 Action。

不在新技能中复制连接器 CRUD 和测试实现。

## 3. 技能协作架构

```text
钉钉官方接口文档
        ↓
yida-dingtalk-openapi
解析应用类型、权限、鉴权、参数、返回值、幂等性
        ↓
标准化接口契约 + Connector Action JSON
        ↓
yida-connector
创建连接器 / 鉴权账号 / Action / test
        ↓
yida-canvas-data-binding
生成结构化 binding，通过宜搭平台代理调用
        ↓
自定义页面运行态验证
```

| 技能 | 单一职责 |
| --- | --- |
| `yida-dingtalk-openapi` | 理解钉钉官方文档，生成接口契约和 Action 草稿 |
| `yida-connector` | 创建、管理、测试宜搭 HTTP 连接器 |
| `yida-canvas-data-binding` | Canvas 页面调用已有连接器并完成运行态验收 |
| `yida-data-source-connectors` | 只维护旧版 JSX 页面的 `dataSourceMap` |
| `yida-connector-safe-actions` | 从 Controller 或前端源码生成 Action，不承担官方文档解析 |

## 4. 新技能设计

### 4.1 目录

```text
yida-skills/skills/yida-dingtalk-openapi/
├── SKILL.md
└── references/
    ├── api-contract.md
    └── connector-mapping.md
```

`SKILL.md` 保留路由、工作流、事件订阅不支持声明和完成条件；`api-contract.md` 保存官方文档入口与契约，`connector-mapping.md` 保存 Canvas 字段映射。

### 4.2 工作流

#### 第一步：定位并分类官方文档

输入可以是官方 URL、准确接口名或业务目标。先判断页面属于：

- 服务端 API；
- 客户端 JSAPI；
- 事件订阅（直接停止并说明不支持）；
- 历史或废弃接口。

只有服务端 API 进入 Connector Action 生成流程。

#### 第二步：提取标准化契约

契约落到：

```text
.cache/openyida/<任务名>/connector/dingtalk-openapi-contract.json
```

建议结构：

```json
{
  "provider": "dingtalk",
  "sourceUrl": "https://open.dingtalk.com/document/development/create-schedule",
  "docUpdatedAt": "2026-06-02",
  "domain": "calendar",
  "operationId": "createCalendarEvent",
  "method": "POST",
  "host": "api.dingtalk.com",
  "path": "/v1.0/calendar/users/{userId}/calendars/{calendarId}/events",
  "applicationTypes": ["internal_app", "isv_app", "personal_app"],
  "requiredPermissions": ["日历应用中日程写权限"],
  "auth": {
    "connectorAuth": "DingAuth",
    "tokenHeader": "x-acs-dingtalk-access-token"
  },
  "idempotency": {
    "supported": true,
    "header": "x-client-token"
  },
  "inputs": {
    "path": {},
    "query": {},
    "header": {},
    "bodySchema": {}
  },
  "responseSchema": {},
  "errorCodes": []
}
```

每个 Action 都必须保存对应的精确官方 `sourceUrl`。契约必须保留嵌套 Object、Array、Map 和必填信息。`appKey`、`appSecret`、access token、Cookie 不得进入契约或 Action 文件。

#### 第三步：生成并测试 Connector Action

优先复用同 Host、同鉴权上下文的连接器，不为每个 API 创建新连接器。不同接口作为连接器下具有稳定 `operationId` 的独立 Action。

执行顺序：

```text
connector list/detail
→ 创建或复用连接器
→ list-connections/create-connection
→ add-action
→ list-actions 回读
→ connector test
```

设计态测试只能使用 `connector test`；页面运行态不能调用 `testOperation`。

#### 第四步：按页面运行时路由

- 新建 `.canvas.jsx` / `YidaCodeCanvas` 页面：使用 `yida-canvas-data-binding`。
- 维护已有平台 JSX `this.dataSourceMap` 页面：使用 `yida-data-source-connectors`。
- 没有页面需求：只完成连接器 Action 及测试，不创建页面。

## 5. 当前 AK/SK 鉴权实现

### 5.1 连接器定义只声明鉴权类型

[`connector-create.js`](../../lib/connector/connector-create.js#L162) 的 `buildSecuritySchemes()` 在钉钉鉴权模式下生成：

```json
{
  "DingAuth": {}
}
```

该值跟随连接器定义提交到宜搭平台，只说明“这个连接器需要钉钉开放平台鉴权”，不包含 AK/SK。

`connector create` 现在不再要求 AK/SK，并明确拒绝 `--app-key` / `--app-secret`，在任何远端操作前返回 `CONNECTOR_CREDENTIALS_NOT_ACCEPTED_ON_CREATE`。创建载荷仍只包含 `securitySchemes`；JSON 成功结果增加 `detailUrl`，供用户自行配置鉴权账号。

### 5.2 AK/SK 在创建鉴权账号时提交

[`connector-create-connection.js`](../../lib/connector/connector-create-connection.js#L60) 根据连接器的 `DingAuth` 定义构造：

```json
{
  "appKey": "<AK>",
  "appSecret": "<SK>"
}
```

随后 [`api.js`](../../lib/connector/api.js#L386) 将其序列化为 `securityValue`，与以下信息一起提交给宜搭平台：

```text
POST /query/newconnector/createConnection.json
  connectionName
  connectorName
  securitySchemes
  authType = 5
  securityValue = { appKey, appSecret }
```

因此当前真实链路是：

```text
AK/SK
  → openyida connector create-connection
  → securityValue
  → 宜搭 ConnectorFactory.createConnection
  → 平台保存鉴权账号
  → 返回 connectionId
```

OpenYida 本地配置、Connector Action 和页面源码都不应保存 AK/SK。

### 5.3 调用时只引用 connectionId

[`connector-test.js`](../../lib/connector/connector-test.js#L185) 会先确认 `--account-id` 对应的连接账号属于当前连接器，然后把账号 ID 写入测试载荷的 `connection` 字段。

运行态调用使用相同引用模型：

```json
{
  "connectorInfo": {
    "connectorId": "910244",
    "actionId": "createCalendarEvent",
    "type": "httpConnector",
    "connection": 2391
  }
}
```

宜搭平台根据 `connection` 找到已保存的 DingAuth 账号，负责获取或复用 access token，并为 Action 注入鉴权。Action 本身的 `x-acs-dingtalk-access-token` 默认值必须为空，页面也不能自行获取 Token。

钉钉新版企业内部应用 Token 接口使用 `appKey/appSecret` 换取 `accessToken`，有效期为 7200 秒且不应频繁调用。该缓存责任应留在 DingAuth 平台鉴权层。参考：[获取企业内部应用 accessToken](https://open.dingtalk.com/document/development/obtain-the-access-token-of-an-internal-app)。

### 5.4 已实现的安全输入

`connector create-connection <id> <name> --interactive` 已实现仅限 TTY 的隐藏输入：App Key 与 App Secret 不进入聊天、shell history 和进程参数，也不会回显。非 TTY、空输入、取消输入、与显式凭据参数混用、非 DingAuth/DingTrustGW 鉴权类型都会在账号写入前失败，并返回稳定错误码及 `sideEffectState=none`。

为兼容已有自动化，底层解析仍暂时保留旧凭据参数，但技能、帮助示例和接口模板均不再引导使用。其他鉴权类型第一版统一引导用户在宜搭连接器详情页配置账号；不扩展通用密钥输入框架。

### 5.5 用户配置鉴权后的恢复协议

新技能不得要求用户把 AK/SK、`connectionId` 或鉴权页面内容复制到聊天窗口。AI 创建连接器和 Action 后，先读取一次鉴权账号列表作为 before 快照，再暂停并向用户提供：

- 连接器显示名称；
- `connectorId`；
- 建议使用的唯一鉴权账号名称；
- 连接器配置页 `detailUrl`；
- 可选的本地隐藏输入命令；
- 配置完成后只需回复“已配置”的说明。

建议暂停结果：

```json
{
  "success": false,
  "status": "NEEDS_USER_ACTION",
  "errorCode": "CONNECTOR_AUTH_CONFIGURATION_REQUIRED",
  "connectorId": "910244",
  "connectorName": "Http_xxx",
  "connectorUrl": "https://yidalogin.aliwork.com/platformManage/customConnectorFactory/update?id=910244&connectorName=Http_xxx&mode=http",
  "authType": "DingAuth",
  "expectedConnectionName": "钉钉日程账号",
  "beforeConnectionIds": ["2388"],
  "nextSteps": [
    "open_connector_url_and_create_connection",
    "or_run_create_connection_interactively"
  ],
  "interactiveCommand": "openyida connector create-connection 910244 \"钉钉日程账号\" --interactive",
  "resumeCommand": "openyida connector list-connections 910244"
}
```

用户可以选择：

1. 打开 `connectorUrl`，在宜搭后台填写 AK/SK 并创建鉴权账号；
2. 在自己的本地终端执行 `interactiveCommand`，由 CLI 以不回显方式读取 AK/SK。

无论选择哪种方式，用户都不需要向 AI 返回凭证或 ID，只需回复“已配置”。AI 恢复后执行：

```bash
openyida connector list-connections <connector-id> --json
```

然后用 before/after 差异和预期名称确定账号：

```text
配置前 connectionIds
  → 用户配置鉴权
  → 配置后 connectionIds
  → 唯一新增账号或唯一同名账号
  → connectionId
  → connector test
```

确定性选择规则：

- 恰好一个新增账号：使用该账号，并核对名称和状态；
- 没有新增账号，但 `expectedConnectionName` 恰好匹配一个 `ACTIVE` 账号：复用该账号；
- 多个新增账号、多个同名账号或名称不一致：停止并展示低敏候选，让用户选择；
- 账号不是 `ACTIVE`：停止，引导用户检查鉴权配置；
- 查询失败：保留连接器和 Action，不重新创建连接器或账号。

第一版由 Agent 编排两次 `list-connections` 完成差异判断，不新增 `resolve-connection` 命令。若后续多个宿主重复实现导致漂移，再下沉为确定性 CLI 命令。

## 6. Canvas 连接器调用优化

当前 [`yida-canvas-data-binding`](../../yida-skills/skills/yida-canvas-data-binding/SKILL.md) 的 `mode=connector` 只要求抽象 `endpoint`，无法证明页面调用了哪个连接器、Action 和连接账号。

建议改为结构化契约：

```json
{
  "mode": "connector",
  "connectorId": "910244",
  "operationId": "createCalendarEvent",
  "connectionId": 2391,
  "operationType": "mutation",
  "inputs": {
    "path": {},
    "query": {},
    "header": {},
    "body": {}
  },
  "response": {
    "dataPath": "content.serviceReturnValue"
  },
  "verification": {
    "readbackOperationId": "getCalendarEvent"
  }
}
```

### 6.1 增加统一运行时桥

在 [`canvas-page-schema-builder.js`](../../lib/app/services/canvas-page-schema-builder.js#L13) 注入：

```javascript
window.__OPENYIDA_CONNECTOR_API__.invoke(binding, inputs)
```

桥负责：

- 调用同源 `/query/publicService/invokeService.json`；
- 将 `operationId` 映射为 `connectorInfo.actionId`；
- 将 `connectionId` 映射为 `connectorInfo.connection`；
- 组装 `path/query/header/body`；
- 携带登录态和 CSRF；
- 解包 `content.serviceReturnValue`；
- 返回结构化错误；
- 拒绝页面直接请求 `api.dingtalk.com`。

仓库已有相同的平台调用结构，可复用 [`ai.js`](../../lib/ai/ai.js#L377) 的 `connectorInfo` 与 `/query/publicService/invokeService.json` 契约。

### 6.2 查询与写操作分流

查询 Action：

- 可以在页面加载时调用；
- 支持取消、静默刷新和有限重试；
- 页面结果必须和设计态 `connector test` 的业务字段一致。

写 Action：

- 只能由明确用户交互触发；
- 按钮使用 `submitting/disabled` 防止重复提交；
- 默认不自动重试；
- 官方接口支持幂等键时必须生成并复用同一幂等键；
- 成功后使用查询 Action 回读；
- 无法确定副作用时返回 `sideEffectState=unknown`，禁止盲目再次提交。

## 7. 失败与恢复

| 场景 | 行为 |
| --- | --- |
| 官方文档无法定位或字段不完整 | 停止生成，不猜 method/path/参数 |
| 应用类型不匹配 | 创建连接器前停止，报告支持的应用类型 |
| 缺少接口权限 | 403 后停止，报告文档中的权限名称，不重复创建账号 |
| Token 或凭证失败 | 区分 AK/SK 错误与权限不足，不在日志中输出凭证 |
| 查询接口超时或 429 | 有限退避重试，保留旧页面数据 |
| 写接口超时 | 有幂等键和回读能力时先回读；否则标记结果未知，不重试 |
| 设计态测试成功但页面失败 | 检查运行态 `connectorInfo`、connection 和返回包裹，不调用 testOperation |
| 文档属于事件订阅 | 说明 OpenYida 不支持并停止，不生成连接器或接收端方案 |

## 8. 实施范围

建议一个分支、一个 PR，使用两个逻辑 commit：

### Commit 1：新技能与路由

- 新建 `yida-dingtalk-openapi`；
- 更新 `yida-skills/SKILL.md`、`skills-index.json` 和 postinstall 路由索引；
- 在 `yida-connector` 中增加钉钉官方文档路由说明；
- `connector create` 的 DingAuth 模式不再要求或接收 AK/SK，并在 JSON 结果中返回 `detailUrl`；
- `connector create-connection` 增加仅限 TTY 的 `--interactive` 隐藏输入；
- 技能在缺少鉴权账号时返回 `CONNECTOR_AUTH_CONFIGURATION_REQUIRED`，记录 before 列表并暂停；
- 增加服务端 API、Canvas、旧 JSX 的路由回归及事件订阅不支持断言。

### Commit 2：Canvas 运行时闭环

- 增加 `__OPENYIDA_CONNECTOR_API__`；
- 收紧 `dataBinding.mode=connector`；
- 新增 `references/connector-binding.md`；
- 增加 payload、返回解包、账号归属、查询和 mutation 测试。

第一版不增加 `connector parse-api --url`。先验证技能读取官方页面并生成契约的稳定性；只有真实评测证明页面解析不可靠，再增加确定性 URL 导入能力。

## 9. 验证矩阵

| 场景 | 预期结果 |
| --- | --- |
| 把钉钉日程列表接入宜搭并在 Canvas 展示 | 命中 OpenAPI、connector、Canvas data binding 三个阶段 |
| 创建日程 | 保留嵌套 body、路径参数、权限与幂等头，写后查询回读 |
| 订阅通讯录变更事件 | 明确返回 OpenYida 不支持，不生成任何远端资源 |
| 已有 JSX 页面使用 `this.dataSourceMap` | 路由到 `yida-data-source-connectors` |
| 账号不属于当前连接器 | 写入或调用前阻断 |
| 没有鉴权账号 | 返回配置地址并暂停，不向用户索要 AK/SK |
| 用户在后台完成鉴权 | 用户只回复“已配置”，AI 通过 before/after 列表确定唯一账号 |
| 配置期间新增多个账号 | 不猜 `connectionId`，展示低敏候选并停止 |
| `create-connection --interactive` 在非 TTY 执行 | 返回 `CONNECTOR_SECRET_INPUT_TTY_REQUIRED`，不读取或打印凭证 |
| 连接器测试成功但 Canvas binding 错误 | 发布后运行态验收失败 |
| 页面源码扫描 | 不含 AK/SK、Token、Cookie 或钉钉外部域名直连 |

离线门禁：

```bash
npm run check:skills
npm run eval:routing
npm run check:ci
```

真实验收先选一个低风险只读 API，验证“官方文档 → Action → 鉴权账号 → connector test → Canvas 页面显示”的完整链路。写接口只在明确授权的测试应用、测试账号、幂等键和可回读条件全部具备时执行。

## 10. 完成标准

- 新技能能覆盖钉钉开放平台不同业务域的服务端 API，而不是只覆盖日程。
- 每个 Action 保存精确官方接口文档链接；官方文档中的应用类型、权限、参数位置、嵌套类型和错误码进入标准化契约。
- AK/SK 只进入平台鉴权账号，不进入连接器定义、Action、页面或日志。
- 用户配置鉴权后只需回复“已配置”，AI 能通过鉴权列表差异获得唯一 `connectionId`。
- 无法唯一确定鉴权账号时停止，不要求用户把 AK/SK 或鉴权页面内容发到聊天窗口。
- Canvas 页面只通过宜搭同源平台代理调用连接器。
- 设计态 test 成功和页面运行态成功分别验证。
- 写接口具备幂等或结果未知保护，不发生模型盲目重复调用。

## 11. 实现与验证记录

已实现：

- 新增 `yida-dingtalk-openapi` 及两份按需参考文档；`api-contract.md` 提供官方“开放接口一览”业务域链接和逐 Action `sourceUrl` 契约。根技能、机器索引、安装态索引与路由场景已同步。事件订阅只保留不支持声明，不提供专属参考或实现流程。
- `connector create` 拒绝 DingTalk 凭据并返回 `detailUrl`；`list-connections --json` 不再混入进度文本。
- `create-connection --interactive` 在 TTY 中隐藏读取 AK/SK，并对非 TTY、冲突、空值和取消做写前阻断。
- Canvas 发布层注入 `window.__OPENYIDA_CONNECTOR_API__`，固定调用同源 `/query/publicService/invokeService.json`，组装 `connectorId/operationId/connectionId` 并解包业务结果。
- `yida-connector`、接口模板及 `yida-canvas-data-binding` 已切换到不经聊天传密钥的流程。

本地验证：

- 连接器鉴权、JSON 输出、Canvas bridge、技能契约定向测试 109/109 通过。
- 全量 `check:ci` 通过：180 个测试套件、2562 个测试全部通过；命令清单、生成文档、i18n 棘轮、语法、lint、包体和发布风险检查均完成。
- 全局 `openyida` 已 link 到本分支并验证凭据参数在登录和远端读取前被结构化阻断。
- Eval Pipeline Gate 通过；本机无可用 `claude` CLI，因此真实 agent 路由项降级为 WARN，不影响静态路由用例。

尚未执行真实租户连接器与 Canvas 发布：当前任务没有提供可写 `corpId`、目标测试应用或专用 DingAuth 测试账号。后续只在用户明确授权这些目标后，先选只读钉钉 API 跑“连接器 → 用户配置账号 → CLI 差异发现 → connector test → Canvas 页面”闭环；不会使用个人真实 AK/SK 或擅自创建远端资源。
