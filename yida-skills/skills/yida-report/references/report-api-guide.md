# 宜搭报表 API 详解与风险处理

> 本文档是 `yida-report` 技能的参考文档，说明报表 API 调用方式、数据解析、常见风险和处理规则。

## 报表 API 详解

### 接口地址

```
POST /alibaba/web/{appType}/visual/visualizationDataRpc/getDataAsync.json
```

### 关键参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pageName` | String | 是 | 固定值 `"report"` |
| `prdId` | String | 是 | 当前应用导航中目标 `REPORT_xxx` 对应的 `topicId`；页面运行时动态获取 |
| `cid` | String | 是 | 报表组件 ID（如 `YoushuTable_mmx9ha6ar`） |
| `cname` | String | 是 | 组件名称（如 `"按状态统计"`） |
| `className` | String | 是 | 组件类名（如 `"YoushuTable"`、`"YoushuSimpleIndicatorCard"`） |
| `dataSetKey` | String | 是 | 数据集 key（表格用 `"table"`，指标卡用 `"youshuData"`） |

### 请求示例

这里只定义报表接口的请求参数。Code Canvas 页面如何发起请求由 `yida-canvas-data-binding` 负责，页面内不直接使用普通 JSX 的 `this.utils.yida.*`。

```javascript
var requestBody = {
  pageName: "report",
  prdId: currentReportTopicId,
  cid: currentReportComponent.cid,
  cname: "按状态统计",
  className: "YoushuTable",
  dataSetKey: "table",
};
```

### 返回数据结构

```json
{
  "content": {
    "data": [
      ["进行中", 8],
      ["已完成", 5],
      ["规划中", 4],
      ["已延期", 2],
      ["已取消", 1]
    ],
    "meta": [
      {
        "alias": "项目状态",
        "dataType": "STRING",
        "type": "DIMENSION"
      },
      {
        "alias": "项目数量",
        "dataType": "LONG",
        "type": "MEASURE"
      }
    ]
  }
}
```

### 数据解析方法

```javascript
function parseTableData(responseData) {
  var dataArray = responseData.data || [];
  var metaArray = responseData.meta || [];

  var dimensionIndex = -1;
  var measureIndex = -1;
  var dimensionAlias = "";
  var measureAlias = "";

  metaArray.forEach(function(m, i) {
    if (m.type === "DIMENSION") {
      dimensionIndex = i;
      dimensionAlias = m.alias;
    } else if (m.type === "MEASURE") {
      measureIndex = i;
      measureAlias = m.alias;
    }
  });

  // 如果 meta 没有 type 字段，按顺序推断：第一个是维度，第二个是度量
  if (dimensionIndex === -1 && metaArray.length >= 2) {
    dimensionIndex = 0;
    measureIndex = 1;
    dimensionAlias = metaArray[0].alias;
    measureAlias = metaArray[1].alias;
  }

  return dataArray.map(function(row) {
    return {
      name: String(row[dimensionIndex] || ""),
      value: parseFloat(row[measureIndex]) || 0,
    };
  });
}
```

---

## 报表组件类型

### YoushuSimpleIndicatorCard（指标卡）

- **用途**：显示单个聚合数值（如项目总数、总预算）
- **dataSetKey**：`"youshuData"`
- **返回格式**：`{ content: { data: [[42]], meta: [...] } }`
- **取值方式**：`data[0][0]`

### YoushuTable（统计表格）

- **用途**：按维度分组统计（如按状态统计项目数）
- **dataSetKey**：`"table"`
- **返回格式**：`{ content: { data: [["进行中", 8], ["已完成", 5]], meta: [...] } }`
- **取值方式**：遍历 `data` 数组，每行 `[维度值, 度量值]`

---

## 常见风险

### 坑 1：数值聚合必须使用 NumberField

**现象**：报表对"项目预算"字段做 SUM 聚合时返回 0 或报错。

**原因**：预算字段使用了 `TextField`（文本组件），文本类型无法进行数值聚合（SUM、AVG 等）。

**解决**：将字段类型从 `TextField` 改为 `NumberField`。

```bash
openyida create-form update <appType> <formUuid> '[
  {"action":"delete","fieldId":"textField_j2xeja4e"},
  {"action":"add","field":{"type":"NumberField","label":"项目预算","placeholder":"请输入预算金额"}}
]'
```

⚠️ 注意：改字段类型后，旧数据中该字段的值会丢失，需要重新写入。

### 坑 2：报表 API 路径

**错误路径**：
```
❌ /yida-report/data/queryReportData.json
❌ /alibaba/web/{appType}/query/reportData.json
```

**正确路径**：
```
✅ /alibaba/web/{appType}/visual/visualizationDataRpc/getDataAsync.json
```

### 坑 3：prdId 获取方式

**prdId 不是 formUuid**。自定义页面运行时调用 `getFormNavigationListByOrder`，按目标 `REPORT_xxx` 找到当前应用导航项，再使用该导航项的 `topicId`。不要把另一个应用或一次调试请求中的数字写死在页面源码里。

### 坑 4：组件 ID（cid）获取方式

每个报表组件都有唯一的 `cid`，格式为 `{组件类名}_{随机字符串}`。

获取方式：回读目标报表 Schema，从 `componentsTree` 中读取目标组件的真实 ID。

### 坑 5：dataSetKey 区分

| 组件类型 | dataSetKey |
|---------|-----------|
| `YoushuSimpleIndicatorCard`（指标卡） | `"youshuData"` |
| `YoushuTable`（统计表格） | `"table"` |

**用错 dataSetKey 会导致返回空数据。**

### 坑 6：不要用明细接口代替报表聚合

Code Canvas 的表单明细读取由 `yida-canvas-data-binding` 提供统一 window runtime 和同源 HTTP 降级契约。报表指标仍使用本文件的报表接口，不把 `searchFormDatas` 明细拉到页面后自行聚合。

### 坑 7：不要手动拼鉴权参数

OpenYida CLI 默认使用 OAuth token 登录态，业务 HTTP 请求由 `httpPost` / `httpPostJson` / `httpGet` 等工具自动携带 `Authorization: Bearer <access_token>`。技能或脚本不要手动读取 Cookie、拼接 Cookie Header，或把 `_csrf_token` 写入请求参数。

### 坑 8：不要用 fallback 逻辑

**反模式**：报表 API 失败时回退到 `searchFormDatas` 前端聚合。

**问题**：`searchFormDatas` 的 pageSize 最大 100，数据量超过 100 条时聚合结果不准确。

**正确做法**：报表 API 失败时直接显示错误信息，方便排查问题。

---

## 可用的聚合函数

| 聚合函数 | 说明 | 适用字段类型 |
|---------|------|------------|
| `COUNT` | 计数 | 所有类型 |
| `COUNT_DISTINCT` | 去重计数 | 所有类型 |
| `SUM` | 求和 | `NumberField` |
| `AVG` | 平均值 | `NumberField` |
| `MIN` | 最小值 | `NumberField`、`DateField` |
| `MAX` | 最大值 | `NumberField`、`DateField` |

---

## 表单数据批量写入（HTTP API）

```javascript
const { httpPost } = require('lib/utils.js');
const querystring = require('querystring');

const postData = querystring.stringify({
  formUuid: FORM_UUID,
  formDataJson: JSON.stringify({
    textField_xxx: '项目名称',
    numberField_xxx: 280,
    selectField_xxx: '进行中',
  }),
});

await httpPost(baseUrl, `/dingtalk/web/${APP_TYPE}/query/punchFormDataProvider/saveFormData.json`, postData);
```

**注意**：不要手动传 Cookie 或 `_csrf_token`；OpenYida 请求工具会根据本地 token session 自动注入 Bearer token。

---

## 常见问题

**Q：报表 API 返回空数据？**
- 检查 `prdId` 是否正确
- 检查 `cid` 是否与报表中的组件匹配
- 检查 `dataSetKey` 是否正确（指标卡用 `youshuData`，表格用 `table`）

**Q：SUM 聚合返回 0？**
- 检查字段是否为 `NumberField` 类型
- `TextField` 无法进行数值聚合，必须改为 `NumberField`
- 改字段类型后旧数据会丢失，需要重新写入

**Q：如何调试报表 API？**
1. 在浏览器中打开报表页面
2. 打开 DevTools → Network → 搜索 `getDataAsync`
3. 查看请求参数和返回数据
4. 用当前应用导航和报表 Schema 核对参数；页面实现仍动态获取 `topicId`，不复制调试请求里的旧数值
