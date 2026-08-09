# 普通页面数据源实现

## Schema 字段

连接器数据源需要：

- `dpType: "YIDACONNECTOR"`
- `protocal: "REMOTE"`
- `requestHandler.value: "this.utils.legaoBuiltin.dataSourceHandler"`
- `options.connector` 指向连接器名
- `options.connectorAction.value` 使用 Action `operationId`
- `options.params.inputs` 包含 `Headers`、`Query`、`Body`
- `options.shouldFetch: false`
- `options.didFetch` 归一返回 content
- `options.onError` 暴露数据源和 Action 名，并恢复 loading

平台回读时可能把数据源归一为：

```text
REMOTE
  + /query/publicService/invokeService.json
  + serviceInfo.connectorInfo
```

这是可接受的只读形态。源码仍保留可审计的连接器配置，不写死 `_csrf_token`。

## 调用 helper

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

## 状态处理

- 请求失败、取消或超时后设置 `loading: false`。
- 页面显示具体错误或 toast，不只写 console。
- 超时和重试次数有限。
- mutation 防止重复提交。

## 回读检查

- 设计器左侧能看到连接器数据源。
- `dataSource.online` 存在显式配置，或被归一为 `REMOTE + publicService/invokeService + serviceInfo.connectorInfo`。
- `actions.module.source` 不包含 `ConnectorFactory.testConnector`、`newconnector/testConnector` 或外部 API 直连。
- 运行时代码使用 `this.dataSourceMap.<name>.load()`。

## 不允许的调用

```javascript
fetch('https://api.example.com/data');
new XMLHttpRequest();
postYidaForm('/query/newconnector/testConnector.json?_api=ConnectorFactory.testConnector', payload);
```

Canvas 页面不能使用：

```javascript
this.dataSourceMap.getDeviceList.load();
```

Canvas 的 runtime、CSRF、返回体解析和刷新状态由 `yida-canvas-data-binding` 负责。
