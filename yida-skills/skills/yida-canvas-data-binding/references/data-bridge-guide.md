# DataBridge 规则

## dataBinding 示例

```json
{
  "mode": "form",
  "appType": "APP_xxx",
  "formUuid": "FORM_xxx",
  "sourceName": "经销商经营数据",
  "fields": {
    "name": "textField_storeName",
    "amount": "numberField_gmv",
    "status": "selectField_status"
  },
  "refresh": "manual"
}
```

## 状态规则

1. 保留 `loading`、`error`、`rows`、`totalCount`、`lastUpdatedAt`。
2. 首屏可以显示 loading；轮询或手动刷新使用 silent refresh，不清空旧列表。
3. 返回体兼容 `data`、`result.data`、`content.data`、`content.result.data`、`list`、`records`、`values`。
4. `totalCount > 0 && rows.length === 0` 视为解析故障。
5. seed 数据只用于本地预览或错误提示，并标记“示例数据”或“接口异常”。
6. `useEffect` 请求使用 `AbortController` 或等价 cleanup。
7. 常规业务页轮询不低于 5 秒；避免重复并发请求。

## 返回体解析

```javascript
function unwrapRows(payload) {
  var candidates = [
    payload && payload.data,
    payload && payload.result && payload.result.data,
    payload && payload.content && payload.content.data,
    payload && payload.content && payload.content.result && payload.content.result.data,
    payload && payload.list,
    payload && payload.records,
    payload && payload.values
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    if (Array.isArray(candidates[i])) return candidates[i];
  }
  return [];
}

function unwrapTotal(payload, rows) {
  var candidates = [
    payload && payload.totalCount,
    payload && payload.total,
    payload && payload.data && payload.data.totalCount,
    payload && payload.result && payload.result.totalCount,
    payload && payload.content && payload.content.totalCount
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    var value = Number(candidates[i]);
    if (!Number.isNaN(value)) return value;
  }
  return rows.length;
}
```

解析后执行保护：

```javascript
var rows = unwrapRows(payload);
var totalCount = unwrapTotal(payload, rows);
if (totalCount > 0 && rows.length === 0) {
  throw new Error('表单返回 totalCount > 0，但页面没有解析到行数据，请检查返回体和字段映射。');
}
```

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面显示 0 条，但数据管理里有数据 | 检查 runtime、返回体包裹层和字段映射 |
| 首屏后定时闪白 | 改成 silent refresh，保留旧数据 |
| 登录态存在但接口 403 | 优先恢复 yida JS-API 桥；降级直连时再检查同源路径和 CSRF |
| 接口失败后仍显示演示数据 | 显示错误状态并标记 seed，不伪装成功 |
| 字段值全为空 | 回读 Schema，确认使用真实 fieldId 而不是 label |
