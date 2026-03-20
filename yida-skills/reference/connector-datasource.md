# 宜搭连接器使用指南

本文档介绍如何在宜搭**表单页面**和**自定义页面**中，通过**连接器**调用外部服务，解决前端直接请求外部接口时的跨域和鉴权问题。

宜搭连接器支持多种类型，包括但不限于：
- **HTTP 连接器**：调用任意 HTTP 接口，`connectorId` 格式为 `Http_xxxxxxxx...`
- **宜搭内置连接器**：如获取附件临时免登地址等平台内置能力，`connectorId` 格式为 `G-CONN-xxx`
- **第三方连接器**：钉钉、飞书等平台的 OpenAPI 封装

> 无论哪种类型，在页面中的**定义方式和调用方式完全一致**，区别仅在于 `connectorId`、`actionId` 和请求参数结构。

---

## 概念说明

| 概念 | 说明 |
|------|------|
| **连接器** | 宜搭平台提供的服务代理能力，由平台后端转发请求，前端无需处理跨域/鉴权 |
| **connectorId** | 连接器唯一标识，HTTP 连接器格式为 `Http_xxxxxxxx...`，内置连接器格式为 `G-CONN-xxx` |
| **actionId** | 连接器下的具体动作名称，如 `getTemporaryUrl`、`queryData` 等 |
| **数据源（dataSource）** | 页面中对连接器的引用配置，通过 `this.dataSourceMap.<名称>.load()` 调用 |

---

## 第一步：确定要使用的连接器

在页面中使用连接器之前，需要先确定 `connectorId` 和 `actionId`。

**AI 操作原则：优先从已有连接器中查找，不要轻易新建。** 组织内通常已有大量连接器可复用，新建前必须先查询确认没有满足需求的已有连接器。

### 查询已有连接器（首选）

使用 `openyida connector list` 命令列出当前组织下所有可用连接器，支持关键字过滤：

```bash
# 按名称关键字过滤（推荐，缩小范围）
openyida connector list --name 附件

# 列出所有连接器
openyida connector list

# 列出某个连接器下的所有执行动作，获取 actionId
openyida connector list-actions <connectorId>
```

输出示例：
```
连接器列表（共 33 个）：
1. 获取宜搭附件临时免登地址-v2
   connectorId: Http_a695a4381efc4bacb6f752a3b281f090
   描述: 调用钉钉开放平台API，获取宜搭附件的临时免登下载地址
```

> 详细用法参见 `yida-skills/skills/yida-connector/SKILL.md`。

### 新建连接器（备选，仅当已有连接器无法满足需求时）

```bash
# 智能创建：从 curl 命令或接口文档一键生成连接器
openyida connector smart-create

# 手动创建：指定连接器名称和域名
openyida connector create "我的API" "api.example.com"
```

创建成功后会输出 `connectorId`，再通过 `openyida connector list-actions <connectorId>` 查看 `actionId`。

---

## 第二步：在页面中定义连接器数据源

### 方式一：通过 CLI 命令注入（推荐，AI 使用）

使用 `--datasource` 参数在创建表单或自定义页面时直接注入数据源：

```bash
# 创建表单时注入连接器数据源
openyida create-form create <appType> "<表单名>" <字段JSON> \
  --datasource '[{
    "id": "connector910244",
    "connectorId": "Http_a695a4381efc4bacb6f752a3b281f090",
    "actionId": "getTemporaryUrl",
    "isAutoLoad": false
  }]'

# 创建自定义页面时注入连接器数据源
openyida create-page <appType> "<页面名>" \
  --datasource '[{
    "id": "connector910244",
    "connectorId": "Http_a695a4381efc4bacb6f752a3b281f090",
    "actionId": "getTemporaryUrl",
    "isAutoLoad": false
  }]'
```

### 方式二：手动在设计器中配置

在宜搭页面设计器 → 数据源面板 → 添加 → 选择"连接器"类型，填写：
- **名称**：自定义，如 `connector910244`（JS 中通过此名称引用）
- **连接器**：选择已创建的 HTTP 连接器
- **执行动作**：选择对应的 Action
- **自动加载**：通常关闭，由 JS 手动触发

---

## 数据源 Schema 结构

CLI 注入时，每个数据源项的完整结构如下：

```json
{
  "id": "connector910244",
  "type": "connector",
  "connectorId": "Http_a695a4381efc4bacb6f752a3b281f090",
  "actionId": "getTemporaryUrl",
  "isAutoLoad": false,
  "willFetch": "",
  "fit": "",
  "didFetch": "",
  "onError": "",
  "defaultData": null,
  "requestConfig": {
    "inputs": "{}"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String | 数据源名称，JS 中通过 `this.dataSourceMap.<id>` 引用 |
| `type` | String | 固定为 `"connector"` |
| `connectorId` | String | 连接器 ID，格式 `Http_xxxxxxxx...` |
| `actionId` | String | 连接器动作 ID |
| `isAutoLoad` | Boolean | 是否页面加载时自动请求，通常为 `false` |
| `requestConfig.inputs` | String | 默认请求参数（JSON 字符串），通常为 `"{}"` |

> **注意（实现细节）**：宜搭表单 Schema 中，数据源**同时**写入 `pages[0].componentsTree[0].dataSource.online` 和 `dataSource.list` 两个数组（即 `Page` 组件的 `dataSource.online` 和 `dataSource.list`），两者内容完全一致。`urlParams` 默认数据源也需要包含在这两个数组中。`create-form.js` 的 `buildDataSourceList` 函数已正确处理。

---

## 第三步：在 JS 中调用连接器

### 基本调用方式

```javascript
this.dataSourceMap.<数据源名称>.load({
  inputs: JSON.stringify({
    // 连接器执行动作所需的参数
    "Path": { ... },
    "Query": { ... }
  })
}).then(res => {
  // res 即连接器返回的 serviceReturnValue 对象
  console.log('连接器返回结果', res);
}).catch(err => {
  console.error('连接器调用失败', err);
});
```

> **注意**：`res` 是 `content.serviceReturnValue` 的内容，平台已自动解包，无需手动取 `.content.serviceReturnValue`。

### 完整示例：获取附件临时免登地址

**场景**：用户上传图片后，根据图片 URL 调用连接器获取临时免登地址，并赋值给多行文本字段。

**连接器信息**：
- `connectorId`: `Http_a695a4381efc4bacb6f752a3b281f090`
- `actionId`: `getTemporaryUrl`
- 数据源名称: `connector910244`

**连接器请求参数结构**：
```json
{
  "Path": {
    "appType": "<应用ID>"
  },
  "Query": {
    "systemToken": "<应用系统令牌>",
    "fileUrl": "<附件相对路径>",
    "userId": "<当前用户ID>",
    "timeout": "60000"
  }
}
```

**连接器返回值结构**：
```json
{
  "result": "https://tianshu-vpc-private.oss-cn-shanghai.aliyuncs.com/..."
}
```

**JS 代码**：

```javascript
export function getUrlByHttpConnector(url) {
  if (!url) return;

  const loginUser = this.utils.yida.getLoginUserId();

  this.dataSourceMap.connector910244.load({
    inputs: JSON.stringify({
      "Path": {
        "appType": "APP_U7HDFIW6YM66NKNORJ43"
      },
      "Query": {
        "systemToken": "X2766U819804ZRJ6JL3AE6JEN51I3WSFK4QMMON4",
        "fileUrl": url,
        "userId": loginUser,
        "timeout": "60000"
      }
    })
  }).then(res => {
    console.log('连接器返回结果', res);
    const temporaryUrl = res.result || '-';
    this.$('textareaField_mmyhjalp').setValue(temporaryUrl);
  }).catch(err => {
    console.error('获取临时地址失败', err);
  });
}
```

**在图片上传组件的 onChange 事件中触发**：

```javascript
export function onImageUploadChange(value) {
  // value 是上传后的文件列表，取第一个文件的 url
  if (value && value.length > 0) {
    const fileUrl = value[0].url;
    this.getUrlByHttpConnector(fileUrl);
  }
}
```

---

## 常见问题

### Q：如何获取 connectorId 和 actionId？

**方法一（推荐，AI 使用）**：通过 CLI 命令直接查询：

```bash
# 列出所有连接器，找到目标连接器的 connectorId
openyida connector list

# 按名称关键字过滤
openyida connector list --name 附件

# 查看连接器详情，获取 actionId 列表
openyida connector list-actions <connectorId>
```

**方法二**：在宜搭连接器管理页面，进入连接器详情页，URL 中通常包含连接器 ID，执行动作列表中可以看到各 `actionId`。

### Q：`isAutoLoad` 什么时候设为 `true`？

当需要页面加载时立即请求数据（如初始化下拉选项、加载列表数据），设为 `true`。  
如果是用户操作触发（如上传图片后调用），设为 `false`，在 JS 中手动调用 `.load()`。

### Q：连接器调用失败，提示鉴权错误？

连接器使用"测试账号自拟"鉴权模式时，请求由宜搭平台后端代理发出，无需前端携带额外鉴权信息。  
若提示鉴权错误，检查：
1. 连接器配置中的鉴权模式是否正确
2. `systemToken` 是否为当前应用的有效令牌
3. 当前登录用户是否有权限访问该连接器

### Q：如何查询连接器的鉴权账号（connectionId）？

当连接器配置了鉴权模式（如 HTTP Basic Auth、API Key 等），需要在数据源中指定 `connectionId`。通过以下接口查询该连接器下所有可用的鉴权账号：

**接口**：`GET /query/connection/getAliveConnections.json`

**参数**：

| 参数 | 说明 |
|------|------|
| `id` | 连接器 ID，如 `Http_a695a4381efc4bacb6f752a3b281f090` |
| `_api` | 固定值 `dataSourcePane.getYidaConnections` |
| `_mock` | 固定值 `false` |
| `schemaVersion` | 固定值 `V5` |
| `domainCode` | 应用的 domainCode（可从应用配置中获取） |
| `_csrf_token` | CSRF Token |

**返回值示例**：

```json
{
  "content": [
    {
      "id": 25967,
      "connectionName": "测试账号自拟"
    }
  ],
  "success": true
}
```

**字段说明**：
- `id`：即 `connectionId`，在数据源 Schema 的 `connection.value` 字段中使用
- `connectionName`：账号名称，在 `connection.label` 字段中使用

**在 `--datasource` 参数中指定鉴权账号**：

```json
[{
  "id": "myConnector",
  "connectorId": "Http_a695a4381efc4bacb6f752a3b281f090",
  "actionId": "getTemporaryUrl",
  "connectionId": 25967
}]
```

> 当指定 `connectionId` 时，`create-form.js` 会自动通过 `getAliveConnections` 接口查询账号名称，并填充完整的 `connection` 对象到数据源 Schema 中。

### Q：`--datasource` 参数支持同时定义多个连接器吗？

支持，传入数组即可：

```bash
openyida create-form create <appType> "<表单名>" <字段JSON> \
  --datasource '[
    {"id": "connectorA", "connectorId": "Http_xxx", "actionId": "actionA"},
    {"id": "connectorB", "connectorId": "Http_yyy", "actionId": "actionB"}
  ]'
```

---

## 参数速查

### `--datasource` 最简写法

```json
[{
  "id": "myConnector",
  "connectorId": "Http_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "actionId": "myAction"
}]
```

`isAutoLoad` 默认为 `false`，`requestConfig.inputs` 默认为 `"{}"`，可省略。

---

## 附录：动作面板 JS 的 Schema 存储位置

宜搭表单的**动作面板 JS**（即设计器右侧"动作面板"里编写的函数）存储在 Schema 顶层的 `actions.module` 字段中，与 `pages` 平级：

```
Schema 顶层结构：
├── pages[]              # 页面列表（包含字段、数据源等）
├── actions              # 动作面板 JS
│   └── module
│       ├── source       # ES module 格式源码（设计器展示用）
│       └── compiled     # CommonJS 格式（宜搭运行时执行用）
└── config               # 页面配置
```

**`source` 格式**（ES module，设计器里看到的代码）：

```javascript
export function didMount() {
  console.log(`「页面 JS」：当前页面地址 ${location.href}`);
}

export function myFunction() {
  // 在这里调用连接器
  this.dataSourceMap.myConnector.load({ inputs: JSON.stringify({...}) });
}
```

**`compiled` 格式**（CommonJS，运行时实际执行的代码）：

```javascript
"use strict";

exports.__esModule = true;
exports.didMount = didMount;
exports.myFunction = myFunction;

function didMount() { ... }
function myFunction() { ... }
```

> **注意**：`source` 和 `compiled` 必须同步更新，两者描述同一套函数。`compiled` 中的中文字符串需要用 Unicode 转义（如 `\u8fde\u63a5\u5668`），但函数逻辑本身与 `source` 保持一致即可。通过 `saveFormSchema` 接口保存时，将修改后的完整 Schema 的 `content` 字段序列化为 JSON 字符串传入。
