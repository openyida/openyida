# 钉钉开放平台连接器技能设计

## 状态

- 阶段：钉钉 OpenAPI 连接器与宜搭 `systemToken` 安全调用已完成本地实现、离线验证和 Bearer 真实只读验证；待具备空默认值 Action 与有效鉴权账号后验收自动化真实运行
- 目标技能：`yida-dingtalk-openapi`
- 配套技能：`yida-connector`、`yida-integration`、`yida-canvas-data-binding`
- 非目标：复制整套钉钉开放平台文档、让页面直连钉钉域名、让前端持有宜搭 `systemToken`、钉钉事件订阅、Stream/WebSocket、HTTP 回调接收

## 1. 背景与目标

钉钉开放平台包含日程、通讯录、考勤、审批、待办、文档、即时通信等大量服务端 API，接口文档会持续更新。OpenYida 当前已有通用 HTTP 连接器管理能力，但缺少一个专门负责理解钉钉官方文档、鉴权与权限约束，并稳定生成连接器 Action 的领域技能。

本设计需要完成四项结果：

1. 钉钉官方接口文档转换为可验证的连接器 Action。
2. 普通连接器 Action 可由宜搭自定义页面稳定调用；需要宜搭 `systemToken` 的 Action 只允许由集成自动化在服务端调用。
3. 写操作具备幂等、失败状态和业务回读约束。
4. OpenYida 自动获取并使用目标应用的 `systemToken`，但不把密钥交给用户、Agent、页面源码或本地文件。

官方“创建日程”接口同时包含路径参数、嵌套请求体、应用类型、权限、访问凭证头和幂等头，不能只根据 URL 或请求示例猜测 Action。它的路径参数名为 `userId`，实际语义却是 `unionId`，企业应用必须先通过[查询用户详情](https://open.dingtalk.com/document/development/query-user-details)完成转换。参考：[创建日程接口](https://open.dingtalk.com/document/development/create-schedule)。

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

### 2.4 `systemToken` 的调用边界

- `systemToken` 是目标宜搭应用的应用密钥，与 `appType` 对应，不等同于钉钉 App Key、App Secret 或 access token。
- OpenYida 使用当前 Bearer 登录态调用 `App.getSystemToken`，在 CLI 进程内获取目标应用密钥；不提供显示密钥的公开命令。
- 设计态 `connector test` 可以在内存中临时把密钥注入 `body.systemToken`，请求结束后立即丢弃。
- 集成自动化可以在保存前把无密钥引用解析为连接器节点的 Body 固定值；业务页面不接触该值。
- 自定义页面、表单 JS 和页面连接器 binding 不得传递 `systemToken`。需要该参数的前端需求改为“页面提交业务参数 → 集成自动化服务端调用”。
- 集成自动化能避免密钥进入业务页面和浏览器请求，但不等同于平台密钥保险箱：拥有自动化编辑权限的管理员仍可能看到节点固定值。若要求管理员也不可见，需要平台提供 Body Secret 注入能力。

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
        ↓ requiresSystemToken?
   ┌────否────┴────是────┐
   ↓                    ↓
yida-canvas-       yida-integration
data-binding       服务端连接器节点
   ↓                    ↓
页面运行态验证       自动化运行记录验证
```

| 技能 | 单一职责 |
| --- | --- |
| `yida-dingtalk-openapi` | 理解钉钉官方文档，生成接口契约和 Action 草稿 |
| `yida-connector` | 创建、管理、测试宜搭 HTTP 连接器 |
| `yida-integration` | 为需要 `systemToken` 的 Action 创建服务端集成自动化 |
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
  "credentialRequirements": {
    "requiresYidaSystemToken": false
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
  "fixedInputs": {
    "path.calendarId": "primary"
  },
  "inputDependencies": [{
    "target": "path.userId",
    "semanticType": "unionId",
    "sourceUrl": "https://open.dingtalk.com/document/development/query-user-details",
    "sourceInput": "body.userid",
    "sourceOutput": "result.unionid"
  }],
  "responseSchema": {},
  "errorCodes": []
}
```

每个 Action 都必须保存对应的精确官方 `sourceUrl`。契约必须保留嵌套 Object、Array、Map 和必填信息。`appKey`、`appSecret`、access token、Cookie 不得进入契约或 Action 文件。

#### 第三步：解析入参依赖

逐个读取必填参数的完整描述和其中链接的官方接口。固定值进入 `fixedInputs`；需要其他接口生成的值进入 `inputDependencies`。参数名与描述语义冲突时以描述为准。每个前置接口也必须生成宜搭自定义连接器 Action，并通过 `connector test` 或页面连接器桥调用；不得用 `curl`、临时脚本或页面直连绕过连接器。

例如创建日程时，先以通讯录 `userId` 调用“查询用户详情”，读取 `result.unionid`，再把它写入创建日程的 `path.userId`；`calendarId` 固定为 `primary`。如果前置接口与主接口的 Host 或鉴权不同，分别创建或复用连接器，不能把两个 Host 混进同一个 Action。

#### 第四步：生成并测试 Connector Action

优先复用同 Host、同鉴权上下文的连接器，不为每个 API 创建新连接器。不同接口作为连接器下具有稳定 `operationId` 的独立 Action。

执行顺序：

```text
connector list/detail
→ 创建或复用连接器
→ list-connections 读取账号快照
→ 用户通过 accountManageUrl 配置账号
→ list-connections 回读新增账号
→ add-action
→ list-actions 回读
→ connector test
```

设计态测试只能使用 `connector test`；页面运行态不能调用 `testOperation`。

#### 第五步：按页面运行时路由

- Action 不需要 `systemToken`，且目标是新建 `.canvas.jsx` / `YidaCodeCanvas` 页面：使用 `yida-canvas-data-binding`。
- Action 不需要 `systemToken`，且目标是已有平台 JSX `this.dataSourceMap` 页面：使用 `yida-data-source-connectors`。
- Action 需要 `body.systemToken`：前端调用停止，改用 `yida-integration` 创建服务端自动化；页面只负责提交触发自动化所需的业务参数。
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

`connector create` 现在不再要求 AK/SK，并明确拒绝 `--app-key` / `--app-secret`，在任何远端操作前返回 `CONNECTOR_CREDENTIALS_NOT_ACCEPTED_ON_CREATE`。创建载荷仍只包含 `securitySchemes`；JSON 成功结果返回 `accountManageUrl` 和 `detailUrl`。前者直接打开授权账号管理，后者查看连接器定义。

### 5.2 AK/SK 只在宜搭授权账号页提交

[`connector-create-connection.js`](../../lib/connector/connector-create-connection.js#L60) 根据连接器的 `DingAuth` 定义构造：

```json
{
  "appKey": "<AK>",
  "appSecret": "<SK>"
}
```

宜搭授权账号页将其作为 `securityValue`，与以下信息一起提交给平台：

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
  → 用户打开 accountManageUrl
  → 宜搭授权账号页
  → 宜搭 ConnectorFactory.createConnection
  → 平台保存鉴权账号
  → 返回 connectionId
```

OpenYida 本地配置、Connector Action 和页面源码都不应保存 AK/SK。

### 5.3 调用时只引用 connectionId

[`connector-test.js`](../../lib/connector/connector-test.js#L185) 会先确认 `--account-id` 对应的连接账号属于当前连接器，然后把账号 ID 写入测试载荷的 `connection` 字段。

集成自动化运行态使用连接器内部名；数字 ID 只用于 CLI 管理命令：

```json
{
  "connectorInfo": {
    "connectorId": "Http_xxx",
    "actionId": "createCalendarEvent",
    "type": "httpConnector",
    "connection": 2391
  }
}
```

宜搭平台根据 `connection` 找到已保存的 DingAuth 账号，负责获取或复用 access token，并为 Action 注入鉴权。Action 本身的 `x-acs-dingtalk-access-token` 默认值必须为空，页面也不能自行获取 Token。

钉钉新版企业内部应用 Token 接口使用 `appKey/appSecret` 换取 `accessToken`，有效期为 7200 秒且不应频繁调用。该缓存责任应留在 DingAuth 平台鉴权层。参考：[获取企业内部应用 accessToken](https://open.dingtalk.com/document/development/obtain-the-access-token-of-an-internal-app)。

### 5.4 终端输入不是技能交付路径

`connector create-connection <id> <name> --interactive` 作为已有底层命令保留，但它依赖当前 CLI 登录身份、连接器归属和终端 TTY，不能作为 Agent 面向用户的稳定交付路径。技能不再展示或推荐该命令。

为兼容已有自动化，底层解析仍暂时保留旧凭据参数。所有需要密钥的鉴权类型统一引导用户打开 `accountManageUrl`，在宜搭页面配置账号；不扩展通用密钥输入框架。

### 5.5 用户配置鉴权后的恢复协议

新技能不得要求用户把 AK/SK、`connectionId` 或鉴权页面内容复制到聊天窗口。AI 创建连接器和 Action 后，先读取一次鉴权账号列表作为 before 快照，再暂停并向用户提供：

- 连接器显示名称；
- `connectorId`；
- 建议使用的唯一鉴权账号名称；
- 授权账号管理页 `accountManageUrl`；
- 连接器定义页 `detailUrl`；
- 配置完成后只需回复“已配置”的说明。

建议暂停结果：

```json
{
  "success": false,
  "status": "NEEDS_USER_ACTION",
  "errorCode": "CONNECTOR_AUTH_CONFIGURATION_REQUIRED",
  "connectorId": "910244",
  "connectorName": "Http_xxx",
  "accountManageUrl": "https://yidalogin.aliwork.com/platformManage/customConnectorFactory?connectorName=Http_xxx&action=accountManage",
  "detailUrl": "https://yidalogin.aliwork.com/platformManage/customConnectorFactory/update?id=910244&connectorName=Http_xxx&mode=http",
  "authType": "DingAuth",
  "expectedConnectionName": "钉钉日程账号",
  "beforeConnectionIds": ["2388"],
  "nextStep": "open_account_manage_url_and_create_connection",
  "resumeCommand": "openyida connector list-connections 910244"
}
```

用户打开 `accountManageUrl`，在宜搭后台填写 AK/SK 并创建鉴权账号。用户不需要向 AI 返回凭证或 ID，只需回复“已配置”。AI 恢复后执行：

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

### 5.6 宜搭 `systemToken` 的最终实现方案

#### 5.6.1 契约只声明需求，不保存密钥

接口契约增加：

```json
{
  "credentialRequirements": {
    "requiresYidaSystemToken": true,
    "location": "body",
    "parameter": "systemToken",
    "appTypeSource": "targetApp"
  }
}
```

Connector Action 可以声明必填的 `body.systemToken`，但默认值必须为空。Action、契约、页面源码和缓存文件出现非空 `systemToken` 时停止，返回 `CONNECTOR_SECRET_DEFAULT_FORBIDDEN`。

#### 5.6.2 CLI 内部获取

新增内部方法 `resolveYidaSystemToken(authRef, appType)`，调用：

```text
POST /dingtalk/web/{appType}/query/app/getSystemToken.json
_api=App.getSystemToken
```

该方法只供连接器测试和集成自动化构建器调用，不注册公开的“读取/显示 systemToken”命令。返回值只保留在当前进程内存；成功输出仅包含 `systemTokenResolved: true`，不包含密钥、摘要或可关联指纹。

读取失败后只做只读诊断，依次检查目标应用详情和当前应用列表，区分：

- `YIDA_SYSTEM_TOKEN_APP_INACCESSIBLE`：当前登录有效，但目标 `appType` 不可访问；
- `YIDA_SYSTEM_TOKEN_PERMISSION_DENIED`：目标应用可访问，但无密钥读取权限；
- `YIDA_SYSTEM_TOKEN_AUTH_REQUIRED`：当前 OpenYida 登录态无法通过只读探针。

三类错误均返回 `remoteWrites=0`、`sideEffectState=none`、`retrySafe=true`，且不回传平台原始错误中可能出现的凭据内容。

#### 5.6.3 连接器测试临时注入

`connector test` 增加目标应用参数：

```bash
openyida connector test \
  --connector-id Http_xxx \
  --action queryYidaData \
  --system-token-app APP_TARGET
```

CLI 在调用 `testOperation.json` 前依次验证：

1. Action 精确存在且声明了 Body 参数 `systemToken`；
2. 连接器 Host 和 Action 路径属于已核对的宜搭/钉钉官方接口，防止把密钥发送到第三方；
3. 调用者没有通过 `--body-json`、旧 `--params` 或 Action 默认值传入另一个 `systemToken`；
4. `APP_TARGET` 可由当前登录身份读取密钥。

验证完成后，CLI 在内存中把密钥合并到 `body.systemToken`，只执行一次测试请求，请求结束后丢弃。日志和结构化输出只报告 `systemTokenResolved`、`systemTokenInjected` 与业务测试结果。

#### 5.6.4 集成自动化使用无密钥引用

`yida-integration` 的 connector 节点增加 OpenYida 专用的 `secretBindings`。spec 只保存引用：

```json
{
  "type": "connector",
  "connectorId": "Http_xxx",
  "actionId": "queryYidaData",
  "connectionId": "123",
  "assignments": [
    {
      "column": "formUuid",
      "valueType": "processVar",
      "value": "textField_formUuid"
    }
  ],
  "secretBindings": [
    {
      "target": "systemToken",
      "provider": "yidaSystemToken",
      "appType": "APP_TARGET"
    }
  ]
}
```

简单命令提供同一语义的快捷参数：

```bash
openyida integration create APP_TRIGGER FORM_TRIGGER "调用宜搭接口" \
  --connector-id Http_xxx \
  --action-id queryYidaData \
  --connection-id 123 \
  --connector-system-token-app APP_TARGET \
  --publish
```

CLI 的执行顺序固定为：

```text
读取无密钥 spec
→ 回读连接器和 Action Schema
→ 校验 systemToken 的参数位置、官方 Host/Path 和目标 appType
→ 完成集成自动化摘要确认
→ 获取 systemToken（此时仍未发生远端写入）
→ 在内存中转换成平台 connector assignment literal
→ 创建并保存自动化
→ 内部回读验证绑定和发布状态
→ 对外只返回脱敏结果
```

获取密钥、目标校验或 Schema 回读失败时，必须发生在 `createLogicflow` 之前，保证 `remoteWrites=0`。不得允许 `--connector-assignment systemToken:literal:...`，也不得在 spec 的普通 `assignments` 中写入真实密钥。

#### 5.6.5 前端硬阻断

`yida-canvas-data-binding`、旧 JSX 数据源技能和页面 linter 在生成或发布前检查：

- Action 是否要求 `body.systemToken`；
- 页面源码是否包含 `systemToken`、`App.getSystemToken` 或 `getSystemToken.json`；
- binding 的 `body` 是否携带非空 `systemToken`。

命中任一项时返回：

```json
{
  "success": false,
  "errorCode": "YIDA_SYSTEM_TOKEN_FRONTEND_UNSUPPORTED",
  "sideEffectState": "none",
  "nextStep": "use_integration_automation"
}
```

页面按钮需要触发此类能力时，页面只提交业务请求记录或触发参数；集成自动化收到事件后再调用连接器。页面需要同步取得接口结果时，本方案不适用，应使用具备服务端 Secret 存储的 FaaS 或自建代理。

#### 5.6.6 脱敏与回读

`systemToken` 必须加入统一敏感字段识别。以下内容不得出现真实值：

- stdout、stderr 与 `CliError.details`；
- Action JSON、集成 spec、PRD、页面源码和本地缓存；
- 测试快照、运行诊断和对 Agent 返回的 readback；
- 失败响应中包含的请求 Body。

CLI 可以在内部用真实值验证自动化回读，但对外只返回：

```json
{
  "systemTokenResolved": true,
  "systemTokenBound": true,
  "credentialExposed": false,
  "readbackVerified": true
}
```

本方案只解决“密钥不进入业务前端、Agent 和本地文件”。平台当前把连接器参数作为自动化节点配置保存，拥有自动化编辑权限的管理员可能看到固定值；这项限制必须在创建摘要中明确说明。

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
- `connector create` 的 DingAuth 模式不再要求或接收 AK/SK，并在 JSON 结果中返回 `accountManageUrl` 与 `detailUrl`；
- `connector create-connection --interactive` 作为兼容命令保留，但不进入技能面向用户的工作流；
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
| 连接器测试成功但 Canvas binding 错误 | 发布后运行态验收失败 |
| 页面源码扫描 | 不含 AK/SK、Token、Cookie 或钉钉外部域名直连 |
| Canvas 绑定需要 `systemToken` 的 Action | 发布前返回 `YIDA_SYSTEM_TOKEN_FRONTEND_UNSUPPORTED`，零远端写入 |
| `connector test --system-token-app` | 内部获取并临时注入，输出和缓存不含密钥 |
| 集成自动化绑定 `systemToken` | spec 无密钥，CLI 保存前解析，真实运行成功且业务页面不接触密钥 |
| 第三方 Host 声明 `systemToken` | 获取密钥和创建自动化前阻断，`remoteWrites=0` |
| `App.getSystemToken` 无权限或失败 | 不创建、不发布自动化，返回稳定低敏错误 |

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
- 需要 `systemToken` 的 Action 不得从自定义页面直接调用；集成自动化只通过无密钥引用配置，CLI 在内存中解析并完成脱敏回读。

## 11. 实现与验证记录

已实现：

- 新增 `yida-dingtalk-openapi` 及两份按需参考文档；`api-contract.md` 提供官方“开放接口一览”业务域链接和逐 Action `sourceUrl` 契约。根技能、机器索引、安装态索引与路由场景已同步。事件订阅只保留不支持声明，不提供专属参考或实现流程。
- 接口契约记录 `fixedInputs` 和 `inputDependencies`；创建日程明确通过自定义连接器执行通讯录 `userId → result.unionid → path.userId`，并固定 `calendarId=primary`，不再按字段名猜值或绕过连接器调用前置接口。
- `connector create` 拒绝 DingTalk 凭据并返回授权账号管理页 `accountManageUrl` 与连接器定义页 `detailUrl`；创建结果的 `connectorId` 以详情回读为准，避免写接口返回的非资源 ID 污染后续命令；`list-connections --json` 不再混入进度文本。
- `create-connection --interactive` 保留为兼容命令，但技能只引导用户通过 `accountManageUrl` 配置鉴权。
- Canvas 发布层注入 `window.__OPENYIDA_CONNECTOR_API__`，固定调用同源 `/query/publicService/invokeService.json`，把 `connectorName/operationId/connectionId` 映射为网关请求并解包业务结果。
- `yida-connector`、接口模板及 `yida-canvas-data-binding` 已切换到不经聊天传密钥的流程。

本地与真实只读验证：

- 连接器鉴权、JSON 输出、Canvas bridge、技能契约定向测试 109/109 通过。
- 本地逐项验证中 181 个测试套件、2590 个测试全部通过；结构、技能、命令清单、生成文档、i18n、语法、lint 与发布风险检查通过。GitHub CI 的同批测试也全部通过，但最新提交在 Step 11 包体门禁失败：解包后 5.85 MiB，超过 5.80 MiB 上限；在修复包体门禁前不得把 PR 记为可发布。
- 全局 `openyida` 已 link 到本分支并验证凭据参数在登录和远端读取前被结构化阻断。
- Eval Pipeline Gate 通过；本机无可用 `claude` CLI，因此真实 agent 路由项降级为 WARN，不影响静态路由用例。
- `systemToken` 定向回归 9 个套件、138 个用例通过；覆盖可信 Host/Path、Body 唯一位置、明文值拒绝、连接器测试注入、集成 spec 安全绑定、脱敏回读与页面 linter。
- 使用当前 OAuth Bearer 登录态对可管理的 `APP_G4TLOE3F1L7FPWRC3N3U` 实测，`App.getSystemToken` 读取成功；输出只包含 `systemTokenResolved=true`和 `credentialExposed=false`。
- 使用不可访问的 `APP_T30GE48FJHEBYZXQGDBH` 实测，稳定返回 `YIDA_SYSTEM_TOKEN_APP_INACCESSIBLE`，`remoteWrites=0`，不再误报整体登录失效。
- 对现有含非空 `systemToken` 默认值的 Action 执行真实 `connector test` 和 `integration create` 前置验证，两条链路均在任何远程业务写入前返回 `YIDA_SYSTEM_TOKEN_EXPLICIT_VALUE_FORBIDDEN`。

尚未完成的实测项：当前租户中唯一已配置 DingAuth 账号且声明宜搭 `systemToken` 的 Action，本身已保存非空旧默认值，不能用于新安全链路。尝试追加唯一命名的只读 Action 时，现有 `add-action` 因连接器详情不完整按守卫停止，没有写入。因此本轮已证明 Bearer 取密和两条零副作用阻断，但“空默认值 Action → 有效鉴权账号 → 自动化发布后运行”仍需在平台账号页为新连接器配置账号后验收。

本轮已实现：

- `resolveYidaSystemToken` 内部读取、统一脱敏、可信目标校验和失败分类；
- `connector test --system-token-app` 的临时注入；
- 集成 connector 节点 `secretBindings` 与 `--connector-system-token-app`；
- Canvas 页面 linter 和数据绑定技能的前端硬阻断；
- `systemToken` 在对象、URL/form 参数和序列化 JSON 中的统一脱敏；
- 连接器、集成自动化、页面调用三条技能路由的同步更新。

## 12. Owner campaign 记录

- 日期：2026-09-04
- 执行模式：`full_auto`
- 输入分支：`feat/dingtalk-openapi-connector-skill`
- 输入 HEAD：`74f3109a8b56d7e1319eb78844efdd55a576c47b`
- 问题：宜搭 OpenAPI 的 `systemToken` 目前只能作为普通 Body 参数传入，页面直调会泄露密钥，集成自动化也缺少无密钥配置入口。
- 范围：CLI 内部读取、连接器测试临时注入、集成自动化无密钥引用、前端硬阻断、统一脱敏、技能契约与回归测试。
- 非目标：通用 Secret 管理平台、自动获取钉钉 App Key/App Secret、让页面同步调用需要 `systemToken` 的接口、事件订阅。
- 已确认：`App.getSystemToken` 接受 OpenYida Bearer 登录态；用户同意前端不支持、集成自动化支持；管理员可能看到自动化节点固定值属于当前已知平台边界。
- 设计证据：本文件第 2.4、5.6、9、10 节。
- 源码证据：`lib/connector/connector-test.js`、`lib/integration/integration-create.js`、`lib/integration/integration-process-builder.js`、`lib/core/redact.js`。
- 下一步：在新建、`systemToken` 默认值为空的宜搭 OpenAPI 连接器上由用户完成 DingAuth 账号鉴权，再执行 `connector test` 和集成自动化发布后运行验收。

Done Contract 状态：前端阻断、明文拒绝、可信目标校验、CLI 内部取密、脱敏输出和集成配置生成已通过源码与真实只读验证；自动化发布后的真实运行仍等待一个已配置 DingAuth 的新安全 Action，因此本 campaign 尚未完整达成。

## 13. Canvas 连接器真实调用修复

- 日期：2026-09-04
- 执行模式：`full_auto`
- 核心目标：页面只能使用 `Http_*` 内部连接器名调用网关；Action Header、Body 和回读结果在发布前满足真实运行契约；调用失败时页面显示可定位的安全错误。
- 已确认：数字连接器 ID 会让页面网关走错分支；Header `required=true` 与空 Header 默认项会触发平台运行时误判；Body 必须传结构化值；当前桥只读取顶层错误信息；现有技能示例错误地把数字 ID 写入 Canvas binding。
- 范围：Canvas connector bridge、Action 规范化与写前校验、连接器回读差异、相关技能与回归测试。
- 非目标：修改平台网关、兼容页面直连外部 API、放宽 AK/SK 或 `systemToken` 安全边界、处理事件订阅。
- 最小实现：管理命令继续使用数字 `connectorId`；页面 binding 改用 `connectorName`，桥仅把 `Http_*` 映射为网关 `connectorId`；Header 输入统一为非必填并忽略空默认项；字符串 Body 在 fetch 前失败；错误读取覆盖常见嵌套包裹；readback mismatch 返回首个差异并阻止继续。
- 验证：单元测试覆盖数字 ID 阻断、`Http_*` 映射、Header 规范化、空 Header 删除、Body 对象、字符串 Body、嵌套错误、回读差异；技能检查和相关 CI 通过后再运行真实按钮场景。

Done Contract：错误身份、Header 和 Body 均在网络调用或远端保存前阻断；合法 `Http_*` + 对象 Body 能生成正确网关请求；回读不一致不得宣称完成；真实页面按钮能显示业务成功或明确错误。

实现与验证记录：

- Canvas bridge 已只接受 `connectorName: "Http_*"`，兼容旧页面把 `Http_*` 暂存在 `connectorId` 的写法，但拒绝数字管理 ID；发布前 linter 同时覆盖对象字面量和 JSON 风格的数字 ID。
- Action 规范化已把 Header 分组和子字段统一保存为 `required=false`，保留非空固定 `Content-Type`，删除空 `x-client-token` 等默认项。
- `inputs.body` 字符串会在 fetch 前返回 `CONNECTOR_BODY_OBJECT_REQUIRED`；合法对象按平台表单协议序列化。
- 网关顶层错误与 `content/serviceReturnValue/result/data/errors` 中的嵌套错误均可提取；业务响应为 `success=false` 时不再被当作成功值返回。
- `CONNECTOR_READBACK_MISMATCH` 现在返回低敏 `firstDifference`、残留资源身份、`sideEffectState=committed` 和只读 `nextStep`，技能明确要求立即停止。
- 14 个相关测试套件、237 个用例通过；新增 linter 变体后 Canvas/linter 96 个用例通过。最新 GitHub CI 的全量 Jest 通过，但包体门禁仍失败；真实场景与发布状态均不得仅以定向单测通过代替。
- 当前登录组织 `ding8196cd9a2b2405da24f2f5cc6abecb85` 中只读查询不到现场连接器 `917319`，因此本轮没有修改远端资源，也不能在该组织复跑原按钮。真实页面验收仍需提供该连接器所在组织，或在当前组织完成一个新连接器的账号鉴权后执行。

Done Contract 状态：源码、技能和本地运行契约已完成；原现场资源的真实按钮复验因当前组织不可见该连接器而待补，不影响本地 fail-fast 与请求映射结论。

## 14. 集成自动化嵌套连接器现场 case 与收口计划

### 14.1 问题背景

一个真实应用需要完成以下服务端自动化链路：

```text
任务负责人 userId
→ 自建 DingAuth 通讯录连接器查询 unionId
→ 自建待办连接器创建钉钉待办
→ 将 unionId、待办 ID 写回宜搭映射表和任务表
```

现场已确认钉钉应用权限和直连 API 可用，自建连接器及鉴权账号也能够完成控制面回读。OpenYida 可以生成、保存并发布包含连接器节点的集成自动化，但真实触发后，第一个通讯录连接器节点持续返回“自定义连接器运行失败”，下游待办创建与数据回写均未执行。设计态 `connector test` 多次收到 HTTP 200，CLI 却返回 `CONNECTOR_TEST_RESPONSE_INVALID`，没有保留足以定位真实 envelope 的低敏结构信息。

为排查问题，调用方重复执行了创建、发布、触发和 `integration check`。其中 `integration check` 虽然查到了业务异常，但命令仍以退出码 0 结束；外层脚本再经过 `grep`、`head` 或 `tail` 后被执行环境记录为成功，导致上层继续沿同一路径重试。控制面“已发布”、工具“退出码为 0”和业务“真实运行成功”因此被错误混为一件事。

现场连接器 Action 的关键输入结构为分组后的嵌套字段：

```text
Body
└── userid  (required=true, paramLocation=body)
```

旧实现的 `buildConnectorRulesFromInputs()` 只会为顶层输入生成赋值规则。它能识别 assignment 中的 `userid`，也能给子节点补 `Body%userid` 的 `id/parentId`，但不会把 assignment 写入 `Body%userid.rules[0]`。生成结果因此可以通过控制面保存，却在运行时缺少真实 Body 参数。这是当前 case 与 PR #544 嵌套规则修复之间的直接对应关系。

### 14.2 PR #544 已覆盖的部分

当前 PR 已递归生成子字段规则，并支持以下两种无歧义写法：

```text
userid
Body.userid
```

同时已处理同名叶子字段歧义、嵌套 `id/parentId`、空 Header 默认项和 Header `required` 误判。对于上述 `Body.userid` 丢失问题，这些改动是必要修复；重新使用新版本 OpenYida 生成并发布流程后，预期应出现：

```text
connectorRules.rules[Body].childList[userid].rules[0]
```

但当前证据只证明本地编译结构正确，尚未证明目标组织中的 DingAuth 连接器完成真实自动化运行。既有已发布流程也不会自动获得新规则，必须由新版本重新生成、回读并发布。

### 14.3 P0：解决该 case 必须补齐的能力

#### P0-1 发布前校验 required leaf 和 assignment 消费结果（已本地实现）

`validateConnectorAssignmentsAgainstSchema()` 当前只检查字段名是否存在及是否歧义，还需要生成规范化叶子字段索引并验证：

- 每个 `required=true` 的可赋值叶子字段都有 assignment、非空固定默认值或受支持的安全绑定；
- 每个用户提供的 assignment 恰好被消费一次；
- assignment 的 `paramLocation` 与完整路径一致；
- 最终生成的 leaf rule 非空，且 `valueType/value/ruleId` 完整。

任一条件不满足时，在 `createLogicflow` 之前返回稳定 `CliError`，包含低敏 `path`、`required`、`assignmentState` 和 `remoteWrites=0`。推荐涉及文件：

- `lib/integration/integration-connector-schema.js`
- `lib/integration/connector-presets.js`
- `tests/integration-connector-schema.test.js`
- `tests/integration-view-builder.test.js`

#### P0-2 发布后回读通用 ConnectorNode assignments（已本地实现）

当前最终回读只精确检查 AddData assignments 和 `systemToken` binding，没有通用投影 ConnectorNode 的输入规则。需要在 `integration-readback.js` 增加 `projectConnectorAssignments()`，至少投影并比较：

```text
nodeId
connectorId
actionId
connectionId
input path
valueType
value（敏感字段只比较 bound 状态）
```

本 case 必须验证 `Body.userid` 已持久化为 `Body%userid.rules[0]`。平台回读丢失或改写规则时，`integration create --publish` 应非零失败，并返回 `INTEGRATION_READBACK_CONNECTOR_ASSIGNMENTS_MISMATCH`；不能只因流程存在且状态为启用就输出业务完成。

推荐涉及文件：

- `lib/integration/integration-readback.js`
- `lib/integration/integration-create.js`
- `tests/integration-readback.test.js`
- `tests/integration-create.test.js`

#### P0-3 让 connector test 对真实 envelope 可诊断、可验收（通用契约已本地实现）

`canonicalizeConnectorTestResponse()` 仍只接受 canonical response 或一层已证 success envelope。遇到未知 envelope 时应继续 fail closed，但错误详情必须提供脱敏后的：

```json
{
  "errorCode": "CONNECTOR_TEST_RESPONSE_INVALID",
  "topLevelKeys": [],
  "contentKeys": [],
  "responseShape": "object(...)"
}
```

取得真实平台 fixture 后，只增加对该精确 envelope 的适配，不得把任意 HTTP 200 视为成功。通用契约识别钉钉 `errcode/errmsg`，`errcode != 0` 返回非零退出码；`result.unionid` 等具体业务字段由对应 Action 的验收用例断言，不硬编码进共享连接器契约。所有错误详情必须经过统一脱敏，不输出 access token、Cookie、AK/SK 或请求 Body 中的凭据。

推荐涉及文件：

- `lib/connector/contract.js`
- `lib/connector/api.js`
- `lib/connector/connector-test.js`
- `tests/connector-contract.test.js`
- `tests/connector-api.test.js`

#### P0-4 为 integration check 增加确定性严格模式

需要支持按单次业务运行定位，而不是扫描整个应用后再依赖文本管道筛选：

```bash
openyida integration check APP_TEST \
  --process-code LPROC_TEST \
  --form-inst-id FINST_TEST \
  --start-time <timestamp> \
  --wait-seconds 60 \
  --fail-on-abnormal \
  --json
```

严格模式契约：

- 唯一目标运行成功时退出 0；
- 命中异常日志、查询失败或等待超时时退出非零；
- JSON 稳定返回 `success/status/errorCode/processCode/procInstId/formInstId/exceptionEntity`；
- 不要求调用方通过 `grep/head/tail` 判断业务成败。

为兼容现有批量报表用途，`--fail-on-abnormal` 可以先作为显式选项；`yida-integration` 技能中的自动验收命令必须使用该选项。

推荐涉及文件：

- `lib/integration/integration-check.js`
- `lib/integration/integration-api.js`
- `tests/integration-check.test.js`
- `tests/integration-api.test.js`
- `yida-skills/skills/yida-integration/SKILL.md`

#### P0-5 补真实 grouped connector Runtime E2E

现有 runtime contract 已声明 connector case，但缺少可运行的真实平台 adapter。应使用自有、可清理的测试资源补一条最小链路：

```text
只读确认 fixture ownership
→ 生成并发布包含 Body.userid 的连接器自动化
→ 创建带 correlation marker 的触发记录
→ 等待唯一运行日志
→ 独立读回 unionId 和下游写入结果
→ 清理测试记录和自动化
```

断言至少包含：

- `Body%userid.rules[0]` 精确存在；
- `connectionId` 与 owned fixture 一致；
- 自定义连接器只执行一次；
- `result.unionid` 非空并完成映射表写入；
- 下游待办创建只执行一次并回写待办 ID；
- 异常时 runner 非零失败并报告 residual；
- cleanup 失败不能覆盖主失败。

真实资源 ID、组织 ID、用户 ID 和凭据只进入本地 E2E 配置，不得硬编码进源码、fixture 或文档。

推荐涉及文件：

- `scripts/e2e-real/integration/runtime-contracts.js`
- `scripts/e2e-real/integration/runtime-runner.js`
- 新增受环境变量驱动的真实平台 adapter
- `tests/e2e-real-integration-runtime-runner.test.js`

### 14.4 P1：减少重复创建和错误完成声明

完成 P0 后再处理以下防复发能力：

1. `integration create` 在写入前检查同一表单下的同名流程；默认返回已有 `processCode` 并停止，只有显式 `--allow-duplicate` 才允许重复创建。
2. 发布结果明确区分：

   ```json
   {
     "controlPlaneVerified": true,
     "runtimeVerified": false,
     "requiresRuntimeVerification": true
   }
   ```

3. 技能要求嵌套字段优先使用完整路径，如 `Body.userid`、`Path.unionId`；唯一叶子名只作为兼容快捷写法，避免 Action 后续新增同名字段导致歧义。
4. 新流程真实运行成功前不得自动停用或覆盖旧流程；新流程验收通过后，再按明确 processCode 停用旧流程，避免故障窗口和重复触发并存。

### 14.5 Done Contract

该现场 case 只有在以下证据全部具备时才算完成：

1. PR CI 全绿并发布包含修复的新 OpenYida 版本。
2. 新版本重新生成流程后，控制面回读确认 `Body%userid.rules[0]` 与期望 assignment 一致。
3. `connector test` 能识别真实平台 envelope；成功时返回非空 `result.unionid`，业务失败时返回稳定非零错误。
4. 严格模式 `integration check` 确认目标运行成功，且不依赖 shell 文本过滤判断结果。
5. 通讯录查询、待办创建、unionId 回写和待办 ID 回写均由独立读回证明，调用次数均为一次。
6. 注入缺少 `Body.userid`、错误 connectionId、DingTalk 业务错误和运行超时后，OpenYida 都能在正确边界非零失败，不生成重复流程或错误完成声明。

当前状态：嵌套 child rule、required leaf 完整性、assignment 唯一消费、通用 ConnectorNode assignment 回读、测试响应低敏结构诊断、钉钉 `errcode` 判断及控制面/运行时状态区分已在本地实现并通过定向测试。真实平台 envelope 适配、`integration check` 严格模式和真实 grouped connector Runtime E2E 仍待补，因此本 case 仍不能仅凭控制面发布成功宣告完成。
