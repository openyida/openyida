---
name: yida-canvas-data-binding
description: 为 Code Canvas 页面接入宜搭表单、流程、连接器或同源接口数据，并处理加载、空数据、错误和刷新状态。
---

# Code Canvas 数据绑定

## 何时使用

Code Canvas 页面需要读取宜搭表单、流程、连接器、报表或同源接口数据时使用本技能。

已有普通 JSX 页面通过设计器 `dataSourceMap` 接入数据时，使用 `yida-data-source-connectors`。

## 数据来源

| `dataBinding.mode` | 数据来源 | 必填信息 | 读取规则 |
| --- | --- | --- | --- |
| `seed` | 本地演示数据 | 无 | 页面必须标记“示例数据” |
| `form` | 宜搭表单 | `appType`、`formUuid`、`fields` | 使用统一 window runtime；桥不存在时才同源降级 |
| `connector` | 平台连接器代理 | `endpoint` | 使用同源代理，鉴权留在平台侧 |
| `url` | 同源业务接口 | `endpoint` | 使用带凭证的同源请求 |
| `report` | 报表或聚合结果 | 报表参数 | 使用服务端聚合结果 |

`page-spec.json`、`OPENYIDA_DATA_BINDING_JSON` 或页面内 `DATA_BINDING` 常量只能声明其中一种来源。没有真实数据时使用 `seed`，不能声称已经接入线上数据。

## 必须遵守

1. `YidaComp` 内不直接使用普通页面的 `this`、`this.utils.yida.*` 或 `this.dataSourceMap.*`。
2. 表单和流程数据通过 `window.__OPENYIDA_RUNTIME__.yida` 读取；兼容已有的 `window.__OPENYIDA_YIDA_API__`。
3. 不导入不存在的官方 `useDataBinding`。页面使用本地 `useYidaData(binding)` 或 `DataBridge`。
4. `formUuid` 和每个字段 ID 都来自 `openyida get-schema` 或已确认的新鲜缓存，不按名称猜测。
5. 不在前端硬编码 Cookie、appSecret、accessKey 或外部密钥。
6. 页面必须有 loading、error、空数据和刷新状态；接口失败时不用 seed 数据伪装成功。
7. `totalCount > 0` 但没有解析到行数据时显示错误，不显示“暂无数据”。

## 执行步骤

1. 确认 `dataBinding.mode` 和真实资源 ID。
2. `mode=form` 时读取 [表单 runtime](references/form-runtime-guide.md)。
3. 实现统一状态和返回体解析时读取 [DataBridge 规则](references/data-bridge-guide.md)。
4. 把 KPI、列表或图表中的至少一个主要区域接到真实数据。
5. 发布并回读页面：

```bash
openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <displayPageFormUuid>
openyida get-schema <appType> <displayPageFormUuid> --summary-json
```

## 完成条件

- 数据来源和字段映射可追溯到真实 Schema 或明确的 endpoint。
- 首屏和刷新过程不会闪白或丢失旧数据。
- 接口失败会显示错误状态。
- 发布回读中 `YidaCodeCanvas.runtimeCode` 非空。

## 参考文件

| 文件 | 什么时候读 |
| --- | --- |
| [表单 runtime](references/form-runtime-guide.md) | `mode=form`，需要调用宜搭表单或流程 API、处理桥降级时 |
| [DataBridge 规则](references/data-bridge-guide.md) | 实现加载、返回体解包、静默刷新、取消请求或排查空数据时 |
