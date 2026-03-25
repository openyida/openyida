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
获取指定连接器的详细信息。`node scripts/get-connector-detail.js <connector-id>`

### 示例 5：列出鉴权账号
列出指定连接器的所有鉴权账号。`node scripts/list-connections.js <connector-id>`

### 示例 6：创建鉴权账号
支持基本身份验证、API 密钥、钉钉开放平台、阿里云 API 网关、钉钉零信任网关等多种鉴权方式。`node scripts/create-connection.js <connector-id> "账号名称" [鉴权参数]`

### 示例 7：添加执行动作到已有连接器（智能匹配）
根据域名和鉴权方式智能匹配已有连接器，避免重复创建。必须先展示匹配列表让用户确认，再执行追加操作。`node scripts/add-action-to-connector.js --operations ./new-action.json --host api.dingtalk.com`

### 示例 8：测试执行动作（传统方式）
测试连接器的执行动作，支持有鉴权和无鉴权的连接器。`node scripts/test-action.js <connector-id> <action-id> [参数]`

### 示例 9：测试连接器（推荐）
使用 `test-connector.js` 进行更便捷的测试，自动获取连接器配置和默认参数，支持自定义测试参数和指定认证账号。`node scripts/test-connector.js --connector-id <id> --action <action-file> [参数]`

## 智能创建连接器（推荐）

智能创建采用三阶段流程：**解析**（提取接口信息）→ **匹配**（查找已有连接器）→ **配置**（生成动作并测试）。

```bash
# 方式 1：从 curl 命令创建（推荐）
node scripts/smart-create-connector.js --curl "curl 'https://api.dingtalk.com/v1.0/hrm/rosters' -H 'Authorization: Bearer xxx'" --name "钉钉花名册连接器"

# 方式 2：解析接口文档
node scripts/parse-api-info.js --doc ./api-doc.md

# 方式 3：生成接口文档模板（信息不足时）
node scripts/generate-api-template.js
```

## 执行动作配置文件格式

详细的执行动作配置文件格式、字段说明、inputs 分组规则、outputs 格式等，请参考 [连接器执行动作配置文件格式](references/connector-action-format.md)。

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
