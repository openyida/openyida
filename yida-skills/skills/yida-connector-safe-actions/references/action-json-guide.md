# 动作 JSON 规则

## 文件位置

动作文件放在：

```text
<projectRoot>/.cache/openyida/<任务名>/connector-actions/<业务名>-actions.json
```

从 workspace 根执行命令时传 `project/.cache/openyida/...`；从 project 工作目录执行时传 `.cache/openyida/...`。

## 字段规则

| 字段 | 写法 |
| --- | --- |
| `id` | 使用 `operation-1`、`operation-2` 等顺序编号 |
| `operationId` | 使用前端函数名或后端 Action 名 |
| `summary` | 中文短名称 |
| `description` | 一句话说明用途 |
| `url` | 不带域名，只写相对路径 |
| `method` | 使用小写 `get`、`post`、`put` |
| `inputs` | GET 参数只放 `Query`，不放 `Body` |
| `parameters.query` | 与 `inputs[].childList[]` 中的 Query 参数一致 |
| `queryDefaultValue` | Query 参数在 `inputs` 和 `parameters` 两处都写 |
| `outputs` | 未确认响应结构时只保留根对象 `Response` |

## 无参数 GET

```json
{
  "id": "operation-1",
  "operationId": "getAccessToken",
  "summary": "获取 Token",
  "description": "获取接口访问 Token",
  "url": "api/Auth/GetAccessToken",
  "method": "get",
  "inputs": [],
  "parameters": {},
  "responses": {
    "type": "object",
    "properties": {}
  },
  "outputs": [
    {
      "defaultValue": "{}",
      "desc": "响应体结构",
      "name": "Response",
      "paramType": "Object",
      "required": false
    }
  ],
  "origin": true
}
```

## 带 Query 参数的 GET

```json
{
  "id": "operation-2",
  "operationId": "getDeviceData",
  "summary": "查询设备数据",
  "description": "根据设备编号和日期查询数据",
  "url": "api/Device/GetDeviceData",
  "method": "get",
  "inputs": [
    {
      "childList": [
        {
          "componentName": "TextField",
          "desc": "设备编号",
          "name": "deviceSn",
          "queryDefaultValue": {
            "paramType": "fixedValue",
            "defaultValue": ""
          },
          "required": true
        },
        {
          "componentName": "TextField",
          "desc": "查询日期，可为空",
          "name": "date",
          "queryDefaultValue": {
            "paramType": "fixedValue",
            "defaultValue": ""
          },
          "required": false
        }
      ],
      "desc": "请求参数",
      "name": "Query",
      "paramType": "Object",
      "required": false
    }
  ],
  "parameters": {
    "query": [
      {
        "name": "deviceSn",
        "type": "string",
        "required": true,
        "description": "设备编号",
        "queryDefaultValue": {
          "paramType": "fixedValue",
          "defaultValue": ""
        }
      },
      {
        "name": "date",
        "type": "string",
        "required": false,
        "description": "查询日期，可为空",
        "queryDefaultValue": {
          "paramType": "fixedValue",
          "defaultValue": ""
        }
      }
    ]
  },
  "responses": {
    "type": "object",
    "properties": {}
  },
  "outputs": [
    {
      "defaultValue": "{}",
      "desc": "响应体结构",
      "name": "Response",
      "paramType": "Object",
      "required": false
    }
  ],
  "origin": true
}
```

## Controller 映射

ASP.NET Controller 使用 `[Route("api/[controller]/[action]")]` 时，路径为 `api/<ControllerName>/<ActionName>`。

- `[HttpGet]`、`[HttpPost]`、`[HttpPut]` 映射为小写 method。
- `[FromQuery]` 参数映射为 `Query`。
- 有默认值或可空参数映射为 `required: false`。
- 无默认值的必填参数映射为 `required: true`。

Spring Controller 或其他框架也按源码中的 method、route、query、path 和 body 声明映射，不按函数名猜路径。

## Windows 编码

PowerShell 读取中文 JSON 时显式使用 UTF-8：

```powershell
Get-Content -Raw -Encoding UTF8 .cache\openyida\<任务名>\connector-actions\<业务名>-actions.json | ConvertFrom-Json | Out-Null
```

默认编码可能导致中文乱码或 JSON 误判。
