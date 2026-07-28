---
name: yida-data-source-connectors
description: 宜搭普通自定义页面（native）设计器 dataSourceMap 专用技能。仅用于把连接器/远程 API 注册到 Page dataSource.online 并通过 this.dataSourceMap.<name>.load() 调用。Code Canvas 没有 dataSourceMap，Canvas 数据接入必须转 yida-canvas-data-binding / Canvas HTTP 数据桥。
---

# 宜搭普通自定义页面连接器数据源规范

## 核心定位

本技能只服务 **普通自定义页面 native 链路**：

```text
设计器 Page dataSource.online
  → this.dataSourceMap.<name>.load()
  → 连接器 / REMOTE 数据源
```

它不是 Canvas 通用数据接入技能。Code Canvas 组件没有普通页面 `this` 实例，也没有 `dataSourceMap`；遇到 `.canvas.jsx`、`YidaCodeCanvas`、`YidaComp`、React hooks 或 Canvas 看板时，立即转：

```text
use_skill("yida-canvas-data-binding", "为 Code Canvas 页面接入连接器或同源 API 数据")
```

需要 Canvas 页面容器与运行时规范时同时使用 `yida-canvas-custom-page`。

## 路由边界

| 信号 | 路由 |
| --- | --- |
| 普通自定义页、`.oyd.jsx`、`renderJsx`、已有 `this.dataSourceMap` | 本技能 |
| 用户明确要求“设计器左侧数据源可见” | 本技能 |
| 维护已有 `dataSource.online` / YIDACONNECTOR Schema | 本技能 |
| Code Canvas、`.canvas.jsx`、`YidaComp`、hooks | `yida-canvas-data-binding` |
| 新建看板/工作台/列表/详情需要连接器数据 | 默认 Canvas 数据桥，不使用本技能 |
| 需要创建/管理连接器或 Action 本身 | `yida-connector` |

不要为了使用本技能而把 Canvas 页面降级成普通自定义页面。

## Native 核心规则

普通自定义页面调用连接器或远程 API 时，先在设计器 Page 根节点 `dataSource.online` 注册数据源，再通过：

```javascript
this.dataSourceMap.<数据源名>.load()
```

禁止在 native 页面用 `fetch`、`XMLHttpRequest`、`/query/newconnector/testConnector.json`、`ConnectorFactory.testConnector` 或手写外部 URL 绕过设计器数据源。

官方示例回读时可能把数据源归一为：

```text
REMOTE
  + /query/publicService/invokeService.json
  + serviceInfo.connectorInfo
```

这是平台可接受的只读形态；源码仍以可审计的连接器配置为准，不写死 `_csrf_token`。

## Native 实施流程

### 1. 确认连接器与 Action

```bash
openyida connector detail <connector-id>
openyida connector list-actions <connector-id>
```

### 2. 规划数据源名称

使用业务语义小驼峰，例如：

- `getDeviceList`
- `getDeviceState`
- `submitDeviceCommand`

每个远程能力使用独立数据源；查询、详情、保存、删除不要混成一个万能 Action。

### 3. 注册 `dataSource.online`

连接器数据源需要：

- `dpType: "YIDACONNECTOR"`
- `protocal: "REMOTE"`
- `requestHandler.value: "this.utils.legaoBuiltin.dataSourceHandler"`
- `options.connector` 指向连接器名
- `options.connectorAction.value` 使用 Action `operationId`
- `options.params.inputs` 包含 `Headers`、`Query`、`Body`
- `options.shouldFetch: false`，页面按需触发
- `options.didFetch` 归一返回 content
- `options.onError` 暴露数据源/Action 名并恢复 loading

### 4. 页面只调用已注册数据源

```javascript
export function loadConnectorDataSource(dataSourceName, headers, query, body) {
  var dataSource = this.dataSourceMap && this.dataSourceMap[dataSourceName];
  if (!dataSource || typeof dataSource.load !== 'function') {
    return Promise.reject(new Error('页面数据源不存在：' + dataSourceName));
  }
  return dataSource.load({
    inputs: JSON.stringify({
      Headers: headers || {},
      Query: query || {},
      Body: body || {}
    })
  });
}
```

### 5. 恢复状态

- 请求失败、取消或超时后必须 `loading: false`。
- 页面显示具体错误或 toast，不能只写 console。
- 超时和重试必须有限，不能永久停在“加载中”。
- mutation 操作避免重复提交；按钮有 submitting/disabled 状态。

## Canvas 转交说明

Canvas 中不得复制上面的 `this.dataSourceMap` 代码。Canvas 数据接入使用：

- `dataBinding.mode=connector` + 同源代理 `endpoint`。
- 或 `dataBinding.mode=url/form/report` + Canvas `DataBridge`。
- `fetch(..., { credentials: 'include' })`。
- CSRF、AbortController、返回体解包、`totalCount` 保护、silent refresh。
- Cookie、密钥、签名留在平台连接器或后端服务侧。

详细规则由 `yida-canvas-data-binding` 决定。本技能只负责判断“当前需求不是 native dataSourceMap”并完成转交，不为 Canvas 发明伪 `dataSourceMap`。

## Native 发布与回读验证

```bash
openyida check-page <src>
openyida compile <src>
openyida publish <src> <appType> <formUuid> --health-check
openyida get-schema <appType> <formUuid>
```

这些是普通自定义页面验证步骤。Canvas 验证必须按 `yida-canvas-custom-page` 使用 `compileCanvasLocal`、Canvas publish 和 `YidaCodeCanvas/runtimeCode` 回读，不要复用这里的 `check-page` 默认。

Native 回读检查：

- 设计器左侧“数据源”能看到连接器数据源。
- `dataSource.online` 存在显式连接器数据源，或被平台归一为 `REMOTE + publicService/invokeService + serviceInfo.connectorInfo`。
- `actions.module.source` 没有 `ConnectorFactory.testConnector`、`newconnector/testConnector` 或外部 API 直连。
- 运行时代码使用 `this.dataSourceMap.<name>.load()`。

## 反模式

### Native 反模式

```javascript
fetch('https://api.example.com/data');
new XMLHttpRequest();
postYidaForm('/query/newconnector/testConnector.json?_api=ConnectorFactory.testConnector', payload);
```

### Canvas 反模式

```javascript
// Canvas 中不存在 this 页面实例
this.dataSourceMap.getDeviceList.load();
```

也禁止看到连接器需求就自动选择本技能；先判断页面运行时。

## 验收清单

- 已确认目标是普通自定义页面，而不是 Canvas。
- Page Schema 包含可审计的数据源配置。
- native 代码只通过 `this.dataSourceMap` 调用。
- loading / error / timeout / retry 可恢复。
- `check-page`、compile、发布回读属于 native 链路且通过。
- 如果目标是 Canvas，已转 `yida-canvas-data-binding`，本技能没有生成 native 代码。

> 子表内嵌明细只返回 50 行时，应使用 `openyida data query subform` 按 `formInstId + tableFieldId` 分页查询，不为此新建连接器数据源。
