---
name: yida-connector
description: 宜搭 HTTP 连接器管理技能，用于创建、配置、测试宜搭 HTTP 连接器，打通钉钉应用、自建系统或第三方应用系统。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-connector-management
  version: 1.2.0
  tags:
    - yida
    - connector
    - http
    - integration
    - api
---

# 宜搭 HTTP 连接器管理技能

## 概述

本技能提供宜搭 HTTP 连接器的完整管理能力，支持创建连接器、配置执行动作、管理鉴权账号、测试连接等操作，实现宜搭与外部系统的数据打通。

## 何时使用

- 需要连接钉钉开放平台 API（如获取员工花名册、部门信息等）
- 需要连接自建系统的 HTTP 接口
- 需要连接第三方应用系统的 API
- 需要在表单流程中调用外部接口
- 需要管理连接器的鉴权账号

## 支持的鉴权方式

| 界面显示 | 内部类型 | 适用场景 | 创建账号参数 |
|---------|---------|---------|-------------|
| 无身份验证 | `NONE` | 公开 API，无需鉴权 | - |
| 基本身份验证 | `BasicAuth` | 用户名密码鉴权 | `--username`, `--password` |
| API 密钥 | `ApiKeyAuth` | 通过 Header 或 Query 传递密钥 | `--api-key` |
| 钉钉开放平台验证 | `DingAuth` | 调用钉钉 OpenAPI | `--app-key`, `--app-secret` |
| 阿里云 API 网关 | `AliyunApiGateway` | 阿里云 API 网关鉴权 | `--app-code` |
| 钉钉零信任网关 | `DingTrustGW` | 钉钉零信任网关鉴权 | `--app-key`, `--app-secret` |

## 脚本列表

### 连接器管理
- `list-connectors.js` - 列出所有连接器
- `create-connector.js` - 创建/更新连接器
- `get-connector-detail.js` - 获取连接器详情
- `delete-connector.js` - 删除连接器
- `add-action-to-connector.js` - 添加执行动作到已有连接器（智能匹配）

### 执行动作管理
- `list-actions.js` - 列出连接器的执行动作
- `create-action.js` - 创建执行动作
- `delete-action.js` - 删除执行动作
- `test-action.js` - 测试执行动作（传统方式）
- `test-connector.js` - 测试连接器（推荐）

### 鉴权账号管理
- `list-connections.js` - 列出鉴权账号
- `create-connection.js` - 创建鉴权账号

### 智能创建工具
- `smart-create-connector.js` - 智能创建连接器（三阶段流程）
- `parse-api-info.js` - 解析 curl 命令或接口文档
- `generate-api-template.js` - 生成接口文档模板

### 公共模块
- `common.js` - 公共工具模块（登录态、API 请求等）

## 使用示例

### 示例 1：列出所有连接器
```bash
node scripts/list-connectors.js
```

### 示例 2：创建连接器

**无身份验证：**
```bash
node scripts/create-connector.js "测试API" "api.example.com"
```

**基本身份验证：**
```bash
node scripts/create-connector.js "内部系统" "internal.company.com" \
  --auth "基本身份验证" --username admin --password 123456
```

**API 密钥（Header 方式）：**
```bash
node scripts/create-connector.js "第三方API" "api.example.com" \
  --auth "API密钥" --api-key-label "Authorization" --api-key-name "X-API-Key"
```

**API 密钥（Query 方式）：**
```bash
node scripts/create-connector.js "第三方API" "api.example.com" \
  --auth "API密钥" --api-key-label "Token" --api-key-name "token" --api-key-location QUERY
```

**钉钉开放平台验证：**
```bash
node scripts/create-connector.js "钉钉API" "api.dingtalk.com" \
  --auth "钉钉开放平台验证" --app-key "your-app-key" --app-secret "your-app-secret"
```

**阿里云 API 网关：**
```bash
node scripts/create-connector.js "阿里云API" "api.aliyun.com" \
  --auth "阿里云API网关"
```

**钉钉零信任网关：**
```bash
node scripts/create-connector.js "零信任API" "trust.dingtalk.com" \
  --auth "钉钉零信任网关"
```

### 示例 3：更新连接器（添加 openyida 元数据）
```bash
# 为现有连接器添加 openyida 元数据（保留原描述）
node scripts/create-connector.js --id 910241

# 更新连接器描述（完全替换）
node scripts/create-connector.js \
  --id 910241 \
  --desc "新的描述内容"
```

> **描述格式**: 创建或更新连接器时，描述会自动附加元数据：
> ```
> 用户描述内容
> ---
> 🤖 created by openyida
> 👤 创建人: 0162193625672514
> 📅 创建时间: 2026/3/17 10:00:00
> ✏️ 最近修改人: 0162193625672514
> 🔄 最近保存: 2026/3/17 10:30:00
> ```

### 示例 4：获取连接器详情
```bash
node scripts/get-connector-detail.js <connector-id>
```

### 示例 5：列出鉴权账号
```bash
node scripts/list-connections.js <connector-id>
```

### 示例 6：创建鉴权账号

**基本身份验证：**
```bash
node scripts/create-connection.js 910264 "测试账号" \
  --username "nameceshi" --password "pwdceshi"
```

**API 密钥：**
```bash
node scripts/create-connection.js 910258 "生产密钥" \
  --api-key "sk-xxxxxxxx"
```

**钉钉开放平台：**
```bash
node scripts/create-connection.js 910244 "钉钉账号" \
  --app-key "dingxxx" --app-secret "xxx"
```

**阿里云 API 网关：**
```bash
node scripts/create-connection.js 910264 "阿里云账号" \
  --app-code "your-app-code"
```

**钉钉零信任网关：**
```bash
node scripts/create-connection.js 910264 "零信任账号" \
  --app-key "ak" --app-secret "sk"
```

### 示例 7：添加执行动作到已有连接器（智能匹配）

> **⚠️ 重要工作流规范（必须严格遵守）**：
> 1. **必须先执行第一步**展示匹配列表，**停下来询问用户**是追加到已有连接器还是新建，**不能直接带 `--connector-id` 跳过用户确认**
> 2. 即使用户之前已经说过要追加到某个连接器，也必须先展示匹配结果让用户再次确认，才能执行第二步
> 3. 如果未找到匹配连接器，展示"未找到匹配连接器"并询问用户是否新建

```bash
# 第一步：智能匹配，展示候选连接器列表（必须先执行这步，停下来让用户确认）
node scripts/add-action-to-connector.js \
  --operations ./new-action.json \
  --host api.dingtalk.com

# 第二步：用户确认后，追加到指定连接器（需用户明确确认后才能执行）
node scripts/add-action-to-connector.js \
  --operations ./new-action.json \
  --connector-id 910244

# 或者：用户选择新建连接器
node scripts/create-connector.js "新连接器名称" "api.dingtalk.com" \
  --auth "API密钥" --operations ./new-action.json
```

> **智能匹配**: 脚本会根据域名和鉴权方式自动筛选可复用的连接器，避免重复创建。

### 示例 8：测试执行动作（传统方式）

**有鉴权的连接器（需要 connection-id）：**
```bash
# 测试连接
node scripts/test-action.js 910244 testConnection 25967

# 测试获取附件临时免登地址
node scripts/test-action.js 910244 getTemporaryUrl 25967 \
  --params '{"path":{"appType":"APP_XXX"},"query":{"fileUrl":"https://..."}}'
```

**无鉴权的连接器（不需要 connection-id）：**
```bash
node scripts/test-action.js 910258 sendDeviceAlarm \
  --params '{"body":[{"name":"测试告警"}]}'
```

### 示例 9：测试连接器（推荐）

使用 `test-connector.js` 进行更便捷的测试：

**基本测试：**
```bash
node scripts/test-connector.js \
  --connector-id 910296 \
  --action dataQuery_queryThroughView.json
```

**带参数测试：**
```bash
node scripts/test-connector.js \
  --connector-id 910296 \
  --action dataQuery_queryThroughView.json \
  --params '{"appType": "APP_XXX", "formUuid": "FORM_XXX"}'
```

**使用指定认证账号测试：**
```bash
node scripts/test-connector.js \
  --connector-id 910296 \
  --action dataQuery_queryThroughView.json \
  --account-id 12345
```

功能特点：
- 自动获取连接器配置和默认参数
- 显示完整的请求和响应信息
- 支持自定义测试参数
- 自动检测需要的认证账号

## 智能创建连接器（推荐）

智能创建采用三阶段工作流程，让连接器创建更加高效和准确：

### 三阶段工作流程

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   阶段 1: 解析   │ → │   阶段 2: 匹配   │ → │   阶段 3: 配置   │
│  自动解析接口信息 │    │  智能匹配已有连接器│    │  生成配置并测试  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**阶段 1 - 信息收集与解析**
- 解析 curl 命令，提取协议、Host、路径、方法、鉴权方式
- 自动识别 6 种鉴权方式
- 过滤浏览器自动添加的 headers，保留业务参数

**阶段 2 - 智能匹配与选择**
- 根据 Host 和鉴权方式查找已有连接器
- 显示匹配列表供用户选择
- 支持追加到已有连接器或新建

**阶段 3 - 配置与测试**
- 自动生成执行动作配置
- 生成有意义的动作名称和描述
- 提供三种测试方式（自动测试、平台测试、表单测试）

### 方式 1：使用 curl 命令快速创建

```bash
node scripts/smart-create-connector.js \
  --curl "curl 'https://api.dingtalk.com/v1.0/hrm/rosters' -H 'Authorization: Bearer xxx'" \
  --name "钉钉花名册连接器" \
  --desc "查询钉钉员工花名册"
```

执行后将输出：
1. 解析结果（协议、Host、方法、鉴权方式）
2. 匹配的已有连接器列表（如有）
3. 生成的配置信息（动作名称、描述、参数）
4. 下一步操作命令（创建或追加）
5. 测试策略建议

### 方式 2：解析已有信息

```bash
# 解析 curl 命令
node scripts/parse-api-info.js --curl "curl命令"

# 解析接口文档
node scripts/parse-api-info.js --doc ./api-doc.md
```

### 方式 3：使用接口文档模板

当提供的信息不足以创建连接器时，生成模板让用户填写：

```bash
# 生成模板到当前目录
node scripts/generate-api-template.js

# 生成到指定路径
node scripts/generate-api-template.js ./my-api-doc.md
```

模板包含以下信息收集项：
- 基本信息（接口名称、提供方、文档链接）
- 服务器信息（协议、Host、BaseUrl）
- 鉴权方式（6种方式可选）
- 执行动作列表（方法、路径、参数、响应）
- 请求示例（curl）

填写完成后，将文档发送给我，我将为您创建连接器。

## 执行动作配置文件格式

> **字段说明**：
> - `label`：字段在宜搭界面上显示的"显示名称"，应根据接口文档含义填写中文名称
> - `desc`：字段的详细描述，用于 hover 提示
> - `__level`：字段层级，顶层字段填 `0`
> - `hidden`：是否在界面上隐藏该字段，默认 `false`

> **inputs 分组规则**：
> - `Headers`：请求头参数（`Content-Type` 等）
> - `Query`：URL 查询参数（GET 接口的参数、POST 接口中需要放在 query 的参数如 `access_token`）
> - `Path`：路径变量（URL 中 `{variable}` 形式的参数）
> - `Body`：请求体参数（POST/PUT 接口的 JSON body）
>
> **GET 接口处理规则**：GET 接口没有 Body，所有业务参数放在 `Query` 分组中，`inputs` 只包含 `Headers` 和 `Query`，`parameters` 只有 `header` 和 `query` 字段，无 `body`。
>
> **access_token 在 query 的处理**：当接口的 `access_token` 通过 URL query 传递时，若连接器已配置 `ApiKeyAuth`（`in: query`），则 `access_token` 由鉴权账号自动注入，**不需要**在 inputs 中重复添加。若接口有其他 query 参数（如 `pubaccId`），则单独放在 `Query` 分组中。

> **连接器描述规则**：
> - 描述应为**一句话总结**，概括连接器的核心用途，而**不是**列出动作名称
> - 示例：`支持向 diwork 群组发送文本消息` 而非 `动作列表: 群组发送文本消息`
> - 描述由 `buildConnectorDesc` 函数根据 operations 自动生成，无需手动填写

```json
[
  {
    "id": "operation-id",
    "operationId": "actionName",
    "summary": "动作名称",
    "description": "动作描述",
    "url": "v1.0/api/path",
    "method": "post",
    "inputs": [
      {
        "childList": [
          {
            "componentName": "TextField",
            "defaultValue": "application/json",
            "desc": "Content-Type",
            "name": "Content-Type",
            "required": false
          }
        ],
        "desc": "请求头",
        "name": "Headers",
        "paramType": "Object",
        "required": false
      },
      {
        "defaultValue": "{}",
        "desc": "请求体",
        "name": "Body",
        "paramType": "Object",
        "required": false,
        "childList": [
          {
            "componentName": "TextField",
            "name": "fieldName",
            "label": "字段显示名称",
            "desc": "字段含义描述",
            "required": true,
            "__level": 0,
            "hidden": false
          }
        ]
      }
    ],
    "parameters": {
      "header": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ],
      "body": {
        "default": "{}"
      }
    },
    "responses": {
      "type": "object",
      "properties": {
        "fieldName": { "type": "string", "description": "fieldName" }
      }
    },
    "outputs": [
      {
        "defaultValue": "{\n    \"fieldName\": \"value\"\n}",
        "desc": "响应体结构",
        "name": "Response",
        "paramType": "Object",
        "required": false,
        "childList": [
          {
            "_key": "actionName%fieldName",
            "name": "fieldName",
            "paramType": "String",
            "children": [],
            "childList": [],
            "__level": 0,
            "hidden": false,
            "label": "字段显示名称"
          }
        ]
      }
    ],
    "origin": true
  }
]

> **outputs childList 字段说明**：
> - `_key`：格式为 `operationId%fieldName`，如 `sendServiceTxt%flag`
> - `paramType`：字段类型，`String` / `Number` / `Boolean`（注意：outputs 用 `paramType` 而非 `componentName`，两者不能混用）
> - `children`：固定为空数组 `[]`
> - `childList`：固定为空数组 `[]`（叶子节点无子字段）
> - `outputs defaultValue`：应填写接口返回的真实响应示例 JSON 字符串

> **responses JSON Schema 说明**：
> - `type` 固定为 `"object"`（小写）
> - `properties` 中每个字段的 `type` 也用小写：`"string"` / `"number"` / `"boolean"`
> - 接口无返回字段时：`"properties": {}`
> - 接口有返回字段时，每个字段格式为：`"fieldName": { "type": "string", "description": "fieldName" }`
> - 示例（有返回字段）：
>   ```json
>   {
>     "type": "object",
>     "properties": {
>       "msg": { "type": "string", "description": "msg" },
>       "flag": { "type": "string", "description": "flag" }
>     }
>   }
>   ```
> - 示例（无返回字段）：
>   ```json
>   { "type": "object", "properties": {} }
>   ```
```

## 技术细节

### securitySchemes 格式

| 鉴权方式 | securitySchemes 格式 |
|---------|---------------------|
| 无身份验证 | `{}` |
| 基本身份验证 | `{"BasicAuth": {"username": "...", "password": "...", "type": "http", "scheme": "basic"}}` |
| API 密钥 | `{"ApiKeyAuth": {"label": "...", "name": "...", "location": "query/header", "type": "apiKey", "in": "query/header"}}` |
| 钉钉开放平台验证 | `{"DingAuth": {}}` |
| 阿里云 API 网关 | `{"AliyunApiGateway": {}}` |
| 钉钉零信任网关 | `{"DingTrustGW": {}}` |

### securityValue 格式（创建鉴权账号）

| 鉴权方式 | securityValue 格式 |
|---------|-------------------|
| 基本身份验证 | `{"username": "...", "password": "..."}` |
| API 密钥 | `{"token": "..."}` |
| 钉钉开放平台验证 | `{"appKey": "...", "appSecret": "..."}` |
| 阿里云 API 网关 | `{"appCode": "..."}` |
| 钉钉零信任网关 | `{"appKey": "...", "appSecret": "..."}` |

### authType 代码

| 鉴权类型 | authType |
|---------|----------|
| 无身份验证 | 0 |
| 基本身份验证 | 2 |
| API 密钥 | 3 |
| 钉钉开放平台验证 | 4 |
| 阿里云 API 网关 | 6 |
| 钉钉零信任网关 | 7 |

## 文件结构

```
yida-connector/
├── SKILL.md                          # 本文档
├── scripts/
│   ├── common.js                     # 公共工具模块（登录态、API 请求等）
│   │
│   ├── 连接器管理
│   ├── list-connectors.js            # 列出所有连接器
│   ├── create-connector.js           # 创建/更新连接器
│   ├── get-connector-detail.js       # 获取连接器详情
│   ├── delete-connector.js           # 删除连接器
│   ├── add-action-to-connector.js    # 添加动作到已有连接器（智能匹配）
│   │
│   ├── 执行动作管理
│   ├── list-actions.js               # 列出执行动作
│   ├── create-action.js              # 创建执行动作
│   ├── delete-action.js              # 删除执行动作
│   ├── test-action.js                # 测试执行动作（传统方式）
│   ├── test-connector.js             # 测试连接器（推荐）
│   │
│   ├── 鉴权账号管理
│   ├── list-connections.js           # 列出鉴权账号
│   ├── create-connection.js          # 创建鉴权账号
│   │
│   └── 智能创建工具
│   ├── smart-create-connector.js     # 智能创建连接器（三阶段流程）
│   ├── parse-api-info.js             # 解析 curl 命令或接口文档
│   └── generate-api-template.js      # 生成接口文档模板
│
├── templates/
│   └── api-document-template.md      # 接口文档模板
│
└── examples/
    ├── operations-yida-attachment.json    # 示例：宜搭附件连接器动作配置
    ├── operations-search-formdata.json    # 示例：搜索表单数据动作配置
    ├── operations-search-formdata-v2.json # 示例：搜索表单数据 V2 动作配置
    └── operations-device-alarm.json       # 示例：设备告警动作配置
```

## 前置依赖

- Node.js ≥ 16
- 已登录宜搭（`.cache/cookies.json` 存在且有效）

## 错误处理

| 错误码 | 含义 | 处理方式 |
|-------|------|---------|
| TIANSHU_000030 | CSRF Token 失效 | 自动刷新 Token 或重新登录 |
| TIANSHU_000015 | 应用/连接器不存在 | 检查 ID 是否正确 |
| 400 | 参数错误 | 检查请求参数格式 |
| 401/403 | 鉴权失败 | 检查鉴权配置 |

## 参考文档

- [宜搭 HTTP 连接器官方文档](https://docs.aliwork.com/docs/yida_support/_10/zbq17y)
- [钉钉开放平台 API](https://open.dingtalk.com/document/isvapp-server/create-an-app)
