---
name: yida-chart
description: >-
  宜搭 ECharts 高级报表技能。通过 ECharts + 自定义页面 JSX 实现高度定制化、更美观的数据可视化报表。
  本技能不负责创建宜搭原生报表（标准报表由 yida-create-report 技能负责），但 ECharts 报表必须依赖宜搭原生报表的 getDataAsync.json 或 getCacheData.json 接口获取聚合数据，禁止前端聚合（当前仅支持单表数据源，暂不支持多表关联）。
  数据源获取方式：若用户已有原生报表，直接读取其信息作为数据源；若用户没有原生报表，则先调用 yida-create-report 技能创建原生报表作为数据源。
  当用户提供了已有报表 URL（如 https://www.aliwork.com/APP_XXX/admin/REPORT-XXX）时，解析现有报表 Schema 提取数据源参数，基于该数据源创建 ECharts 自定义页面（输出始终是 ECharts 自定义页面，而非优化后的原生报表）。
  当用户提到"更美观"、"高级"、"定制化"、"ECharts"、"echarts"、"Dashboard 大屏"、"数据大屏"等关键词，或用户提供了报表 URL 要求优化时，使用此技能。
  普通的"报表"、"统计"等标准报表需求默认由 yida-create-report 技能处理。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-development
  version: 3.0.0
  tags:
    - yida
    - low-code
    - chart
    - echarts
    - report
    - visualization
    - vc-yida-report
    - table
    - filter
---

# 宜搭 ECharts 高级报表技能

## 概述

本技能负责通过 **ECharts + 自定义页面 JSX** 实现高度定制化的数据可视化报表。本技能**不负责创建宜搭原生报表**（标准报表由 `yida-create-report` 技能负责），但 ECharts 报表依赖原生报表的 `getDataAsync.json` 接口作为数据源。

| 方案 | 技术栈 | 适用场景 | 数据源 |
|------|--------|---------|--------|
| **方案 A：ECharts 高级报表**（从头创建） | ECharts + 自定义页面 JSX | 高度定制化图表、复杂交互、更美观的视觉效果 | 用户无原生报表 → 调用 `yida-create-report` 新建；用户已有 → 直接复用 |
| **方案 B：基于已有报表创建 ECharts 页面** | 解析现有报表 Schema + ECharts 自定义页面 | 用户已有原生报表，希望用 ECharts 实现更美观的展示 | 用户提供的报表 URL 中的原生报表作为数据源 |

> 💡 **与 yida-create-report 的分工**：普通的"报表"、"统计"需求默认由 `yida-create-report` 技能处理。只有当用户明确要求"更美观"、"高级"、"定制化"、"ECharts"，或提供了报表 URL 要求用 ECharts 优化时，才使用本技能。

---

## ⚠️ 核心规则（必须遵守）

### 1. 方案选择规则

```
场景 A: 用户提供了已有报表 URL（如 https://www.aliwork.com/APP_XXX/admin/REPORT-XXX）
  → 使用【方案 C：基于已有报表创建 ECharts 页面】
  → 从 URL 中解析 appType 和 formUuid，获取现有 Schema 作为数据源
  → 最终输出：ECharts 自定义页面（非优化后的原生报表）

场景 B: 用户未提供报表 URL，从头创建 ECharts 高级报表
  → 使用【方案 B：ECharts 高级报表】
  → 数据源获取：
    - 用户已有原生报表 → 直接读取已有报表信息作为数据源
    - 用户没有原生报表 → 先调用【yida-create-report 技能】创建原生报表作为数据源
  → 最终输出：ECharts 自定义页面
```

> ⚠️ **注意**：本技能的所有方案最终输出都是 **ECharts 自定义页面**。如果用户只需要标准原生报表（无 ECharts 定制需求），应直接使用 `yida-create-report` 技能。

### 2. `cid` 与 `fieldId` 的区分（易混淆，必须注意）

报表 Schema 中有两种 ID，**绝对不能混用**：

| 名称 | 格式 | 用途 | 示例 |
|------|------|------|------|
| **`cid`** | `node_xxx` | `getDataAsync.json` 的请求参数 | `node_oc8u7tmwt95z55` |
| **`fieldId`** | `YoushuXxx_xxx` | Schema 中组件的标识符，不能用于 API 请求 | `YoushuSimpleIndicatorCard_5rugy68y` |

**获取 `cid` 的方法**：执行 `openyida get-schema <appType> <reportFormUuid>`，在 `componentsTree` 中找到目标组件节点，其 `id` 字段即为 `cid`（`node_xxx` 格式）。

### 3. ECharts 高级报表必须依赖原生报表

**ECharts 高级报表的数据来源必须是宜搭原生报表的接口**，禁止前端聚合。

```
【ECharts 高级报表创建流程】

Step 1: 分析报表需求，确定需要哪些图表、指标
    ↓
Step 2: 调用【yida-create-report 技能】创建宜搭原生报表页面
    ↓  （由 yida-create-report 负责配置图表组件，生成 getDataAsync.json / getCacheData.json 数据接口）
    ↓
Step 3: 从原生报表 Schema 中提取 getDataAsync.json 所需的关键参数
    ↓  （通过 openyida get-schema 获取，解析 cubeCode、cid、componentClassName 等）
    ↓
Step 4: 在宜搭管理后台将原生报表页面设置为【双端隐藏】
    ↓  （PC 端和移动端均不显示在导航中，需手动操作或通过管理接口）
    ↓
Step 5: 创建【ECharts 自定义页面】，通过原生报表接口获取聚合数据
    ↓
Step 6: 记录关联关系到 .cache/<项目名>-report-bindding.json
```

### 4. 原生报表与 ECharts 报表的关联关系

两种报表**高度耦合**，必须记录关联关系并同步更新：

**关联关系存储**：`.cache/<项目名>-report-bindding.json`

```json
{
  "binddings": [
    {
      "echartsPageUuid": "FORM-ECHARTS-XXX",
      "echartsPageName": "销售数据大屏",
      "nativeReportUuid": "REPORT-NATIVE-XXX",
      "nativeReportName": "销售数据报表（数据源）",
      "bindingTime": "2024-01-15T10:30:00Z",
      "components": [
        {
          "echartsChartId": "chart-sales-trend",
          "nativeComponentCid": "node_ocmmwwwhdmg",
          "nativeComponentName": "折线图_销售趋势",
          "nativeComponentType": "YoushuLineChart"
        }
      ]
    }
  ]
}
```

### 5. 报表更新规则

**后续报表需求变化时，必须同步更新两个页面**：

```
【报表更新流程】

Step 1: 读取 .cache/<项目名>-report-bindding.json 获取关联关系
    ↓
Step 2: 调用【yida-create-report 技能】更新原生报表的 Schema
    ↓  （修改图表配置、字段定义等，由 yida-create-report 负责）
    ↓
Step 3: 调用 saveFormSchema.json 更新【ECharts 页面】的代码
    ↓  （同步修改图表渲染逻辑）
    ↓
Step 4: 更新 .cache/<项目名>-report-bindding.json 中的组件映射（如有变化）
```

> ⚠️ **禁止**：为新需求创建新的页面关系，必须在已有的关联页面上更新

### 6. 原生报表页面隐藏规则

一旦创建了 ECharts 高级报表，对应的原生报表页面必须**双端隐藏**：

隐藏方式：在宜搭应用管理后台 → 页面导航设置中，将原生报表页面的 PC 端和移动端可见性均设置为隐藏。

或通过 updateFormNavigation.json 接口（需在服务端/CLI 环境中调用，非自定义页面前端代码）：
  - formUuid: 原生报表页面 UUID
  - pcVisible: false
  - mobileVisible: false

### 7. 开发者态与用户态的展示规则

| 视角 | 原生报表页面 | ECharts 报表页面 | 关联关系 |
|------|-------------|-----------------|---------|
| **用户态**（普通用户） | 隐藏 | 显示 | 隐藏 |
| **管理态**（开发者/管理员） | 显示（标注为"数据源"） | 显示 | 显示在 ECharts 页面配置中 |

**ECharts 页面管理态展示**：
- 在页面配置或代码注释中明确标注数据来源的原生报表
- 格式：`/* 数据源报表: REPORT-NATIVE-XXX (销售数据报表) */`

---

## 核心原则

1. **聚合统计禁止前端聚合**：必须通过 `getDataAsync.json` 或 `getCacheData.json` 接口由服务端完成，详见上方核心规则第 2 节
2. **安全引用**：通过 `this.utils.loadScript()` 从可信 CDN 动态加载 ECharts，禁止内联大段脚本
3. **遵循自定义页面规范**：所有代码必须遵循 `yida-custom-page` 的开发规范

## 何时使用

当用户提出以下需求时使用此技能：
- 创建数据报表、统计图表（柱状图、折线图、饼图等）
- 基于表单数据做数据可视化分析
- 搭建数据看板 / Dashboard
- 需要对表单数据进行聚合统计并图形化展示
- **优化已有报表**（用户提供了报表 URL）

**方案选择**：
- **用户提供了已有报表 URL** → 使用【方案 C：基于已有报表创建 ECharts 页面】，以已有报表为数据源，输出 ECharts 自定义页面
- **用户未提供报表 URL** → 使用【方案 B：ECharts 高级报表】，若用户无原生报表则先调用 yida-create-report 创建数据源
- **用户只需要标准报表**（无 ECharts 定制需求）→ 不使用本技能，直接使用 `yida-create-report` 技能

---

## 前置依赖

- 必须先加载 **`yida-custom-page`** 技能，遵循其编码规范
- ECharts 高级报表需要依赖 **`yida-create-report`** 技能创建原生报表作为数据源（yida-chart 本身不包含原生报表的创建逻辑）
- 需要已创建好数据源表单（通过 `yida-create-form-page` 创建）
- 需要知道数据源表单的 `formUuid` 和字段 `fieldId`（通过 `yida-get-schema` 获取）

---

## ECharts 安全引入方案

### 可信 CDN 地址（按优先级排序）

| CDN | URL | 说明 |
|-----|-----|------|
| **阿里 CDN**（推荐） | `https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js` | 阿里内网外网均可访问，速度最快 |
| **cdnjs** | `https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js` | 国际通用，Cloudflare 托管 |
| **jsDelivr** | `https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js` | npm 镜像，全球加速 |

### 中国地图 GeoJSON 数据源

ECharts 5 不再内置中国地图数据，需要额外加载 GeoJSON 并通过 `echarts.registerMap('china', geoJson)` 注册。

| 数据源 | URL | 说明 |
|--------|-----|------|
| **阿里云 DataV**（推荐） | `https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json` | 阿里云公开数据服务，地图数据权威合规 |

```javascript
// 加载中国地图 GeoJSON 并注册
fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
  .then(function(response) { return response.json(); })
  .then(function(geoJson) {
    window.echarts.registerMap('china', geoJson);
    // 注册完成后即可使用 type: 'map', map: 'china'
  });
```

> ⚠️ **地图安全要求**：
> - **必须**使用阿里云 DataV 提供的官方 GeoJSON 数据，确保地图边界合规
> - 省份名称需使用全称（如"北京市"、"广东省"、"内蒙古自治区"），与 GeoJSON 中的 `name` 字段匹配
> - 示例中提供了 `normalizeProvinceName()` 函数，自动将简称转换为全称

> ⚠️ **安全要求**：
> - **必须**使用上述可信 CDN 之一，**禁止**使用来源不明的第三方 URL
> - **必须**锁定版本号（如 `5.6.0`），**禁止**使用 `latest` 或不带版本的 URL
> - **推荐**优先使用阿里 CDN（`g.alicdn.com`），在宜搭环境中加载速度最快

### 加载方式

使用宜搭内置的 `this.utils.loadScript()` 动态加载，在 `didMount` 中执行：

```javascript
var ECHARTS_CDN = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';

export function didMount() {
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      // ECharts 加载完成，初始化图表
      this.bindChartResize();
      this.loadChartData();
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: 'ECharts 加载失败，请刷新重试', type: 'error' });
    }.bind(this));
}
```

### 防重复加载

如果页面有多个图表，ECharts 只需加载一次：

```javascript
export function loadECharts() {
  if (window.echarts) {
    // 已加载，直接初始化
    this.initCharts();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.initCharts();
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: 'ECharts 加载失败', type: 'error' });
    }.bind(this));
}
```

---

## ⚠️ ECharts 页面代码必备结构

> 完整的代码模板、数据请求函数、初始化流程、meta 解析规则、图表渲染时序等，详见 [`reference/echarts-code-template.md`](reference/echarts-code-template.md)。
> **编写 ECharts 页面代码前必须先读取该文档。**

### 必备函数清单

| 函数 | 类型 | 作用 | 缺少后果 |
|------|------|------|---------|
| `_customState` | `var` 变量 | 存储所有业务状态（loading、数据等） | 无法管理页面状态 |
| `getCustomState` | `export function` | 获取状态 | 编译警告 |
| `setCustomState` | `export function` | 设置状态并触发重渲染 | `setCustomState is not a function` |
| `forceUpdate` | `export function` | 通过 `this.setState({ timestamp })` 触发 React 重渲染 | `forceUpdate is not a function` |
| `didMount` | `export function` | 页面加载完成时初始化 | 页面无法初始化 |
| `didUnmount` | `export function` | 页面卸载时清理资源 | 内存泄漏 |
| `renderJsx` | `export function` | 页面渲染入口 | 页面空白 |

### 关键规则速查

| 规则 | 说明 |
|------|------|
| **CDN** | 必须使用 `https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js`，禁止 cloudflare |
| **timestamp div** | `renderJsx` 每个 return 分支必须含 `<div style={{ display: 'none' }}>{this.state.timestamp}</div>` |
| **函数声明** | 需要 `this` → `export function`；纯工具函数 → `var _xxx = function() {}`；禁止 `const` |
| **prdId** | 必须通过 `getFormNavigationListByOrder` 动态获取，禁止硬编码 |
| **图表渲染时序** | 必须在 `loading=false` + `forceUpdate()` 后通过 `setTimeout` 延迟渲染，禁止在数据请求 `.then()` 中直接调用 |
| **meta 解析** | `meta[0]` 是维度，`meta[1]` 是度量，禁止用 `find` 猜测 |

### 生成代码前的自检清单

- [ ] 包含 `_customState`、`getCustomState`、`setCustomState`、`forceUpdate` 函数
- [ ] `renderJsx` 每个 return 分支含 timestamp 隐藏 div
- [ ] CDN 使用阿里 CDN 5.6.0
- [ ] 纯工具函数用 `var` 声明，组件方法用 `export function`
- [ ] `prdId` 动态获取
- [ ] 聚合数据通过 `getDataAsync.json` 获取，明细表通过 `searchFormDatas` 获取
- [ ] 包含 `didUnmount`，清理 ECharts 实例和 resize 监听
- [ ] 事件绑定用箭头函数包裹
- [ ] 图表渲染统一在 `checkDone` 中延迟调用
- [ ] `_fetchReportData` 包含完整的 URL 参数、headers、body 参数
- [ ] 页面使用白底商务风配色（除非用户要求暗色）

---

## 数据获取方案

> ⚠️ **核心规则**：
> - **聚合统计**（图表数据）：必须通过 `getDataAsync.json` 接口，禁止前端聚合
> - **数据明细表**：使用 `this.utils.yida.searchFormDatas` 获取原始数据（含 `formInstId`）
> - 完整的接口参数、代码模板详见 [`reference/echarts-code-template.md`](reference/echarts-code-template.md)

### 方案一：`searchFormDatas`（仅用于数据明细表）

**仅适用于**数据明细表格，展示每条表单记录的原始字段值。**禁止**用于聚合统计。

| 接口 | 用途 | 关键参数 |
|------|------|---------|
| `searchFormDatas` | 获取表单数据列表（含 `formInstId`） | `formUuid`, `pageSize`(≤100), `currentPage`, `searchFieldJson` |
| `getFormDataById` | 获取单条数据详情 | `formInstId` |

> 分页拉取代码模板详见 [`reference/echarts-code-template.md`](reference/echarts-code-template.md)

### 方案二：`getDataAsync.json`（ECharts 图表数据来源）

**所有聚合统计需求**必须通过此接口实现，禁止前端聚合。

| 接口 | 用途 | 特点 |
|------|------|------|
| `getDataAsync.json` | 实时获取报表组件数据 | 每次请求实时计算 |
| `getCacheData.json` | 获取缓存的报表数据 | 性能更好，参数相同 |

- **地址**：`POST /alibaba/web/{appType}/visual/visualizationDataRpc/getDataAsync.json`
- **参数获取**：执行 `openyida get-schema <appType> <reportFormUuid>` 从 Schema 中提取 `cid`、`componentClassName` 等

> 完整的接口参数说明、请求代码模板、使用示例详见 [`reference/echarts-code-template.md`](reference/echarts-code-template.md)

### 更新报表 Schema：`saveFormSchema.json`

- **地址**：`POST /dingtalk/web/{appType}/_view/query/formdesign/saveFormSchema.json`
- **参数**：`formUuid`、`content`（Schema JSON）、`schemaVersion`（固定 `V5`）、`importSchema`（固定 `"true"`）、`_csrf_token`

> ⚠️ 修改原生报表后需同步更新 ECharts 页面，两个页面的更新必须在同一次操作中完成。

---

## 图表渲染与设计规范

> 图表初始化/销毁、resize 自适应、setOption 原地更新、常用图表配置模板、多端适配等代码模板，详见 [`reference/echarts-code-template.md`](reference/echarts-code-template.md)。
>
> 报表设计规范（配色方案、卡片样式、筛选器交互、数据明细表格样式等），详见 [`reference/echarts-design-spec.md`](reference/echarts-design-spec.md)。

### 编码注意事项

1. **必须遵循 `yida-custom-page` 规范**：`export function` 定义方法、事件绑定用箭头函数包裹、禁止 React Hooks
2. **ECharts 加载时序**：所有图表操作必须在 `loadScript` 的 `.then()` 回调中执行
3. **DOM 就绪**：`echarts.init()` 必须在 `loading=false` + `forceUpdate()` 后通过 `setTimeout` 延迟调用
4. **内存管理**：`didUnmount` 中必须 `dispose()` 所有图表实例并移除 `resize` 监听
5. **筛选刷新**：使用 `setOption(option, true)` 原地更新，禁止 `dispose()` 重建
6. **日期筛选**：`searchFormDatas` 的日期筛选需要毫秒时间戳数组，不能传日期字符串
7. **样式内联**：所有样式通过 JS 对象定义，不使用外部 CSS
8. **CSS 渐变必须用 `background`**：`backgroundColor` 只接受纯色值，不支持 `linear-gradient()` 等渐变。使用渐变时必须用 `background` 属性，否则浏览器会忽略该值导致背景变白：
   ```javascript
   // ✅ 正确
   style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
   // ❌ 错误：backgroundColor 不支持渐变，会被浏览器忽略
   style={{ backgroundColor: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
   ```
9. **表单详情页跳转 URL**：从明细表格点击跳转到表单详情页时，必须使用宜搭标准 URL 格式 `/{appType}/formDetail/{formUuid}?formInstId={formInstId}`，不要使用 `/d/` 等非标准路径

---

## 与其他技能配合

| 技能 | 配合方式 |
|------|----------|
| `yida-custom-page` | **必须先加载**，遵循其编码规范 |
| `yida-create-report` | **数据源依赖**，创建原生报表获取 `getDataAsync.json` 接口参数 |
| `yida-create-form-page` | 创建数据源表单 |
| `yida-get-schema` | 获取表单/报表 Schema，解析 cid、cubeCode 等参数 |
| `yida-create-page` | 创建自定义页面容器 |
| `yida-publish-page` | 编译并发布图表页面 |

---

## 原生报表 Schema 构建

原生报表的 Schema 构建（vc-yida-report 组件库、`build-yida-report-schema.js` 构建脚本）由 **`yida-create-report`** 技能负责。

如需创建或更新原生报表，请调用 `yida-create-report` 技能。相关参考：
- **Schema 构建脚本**：[`build-yida-report-schema.js`](../yida-create-report/build-yida-report-schema.js)
- **组件详细文档**：[`reference/vc-yida-report-components-doc.md`](../../reference/vc-yida-report-components-doc.md)

---

## 方案 C：基于已有报表创建 ECharts 页面

当用户提供了已有的宜搭原生报表 URL（如 `https://www.aliwork.com/APP_XXX/admin/REPORT-XXX`），以该原生报表作为数据源，创建 ECharts 自定义页面。

> 完整的执行流程、Schema 解析规范、filterKey 提取规则、数据源完整性校验等，详见 [`reference/echarts-bindding-guide.md`](reference/echarts-bindding-guide.md)。
> **执行方案 C 前必须先读取该文档。**

### 触发条件

用户消息中包含报表 URL：`https://www.aliwork.com/{appType}/admin/REPORT-XXX`

### 核心要点

- 从 URL 解析 `appType` 和 `formUuid`，通过 `openyida get-schema` 获取 Schema
- 递归遍历 Schema 的 `children`，按白名单过滤图表组件，提取核心参数（cid、className、dataSetKey、cname）
- **⚠️ 每个图表组件有独立的 filterKey**，绝对不能共用。同一个筛选维度（如"项目状态"）在不同组件中的 filterKey 完全不同，必须从每个组件的 `props.dataSetModelMap.<dataSetKey>.dataViewQueryModel.filterList` 中逐个提取
- **⚠️ 当报表有多个筛选维度时**，每个组件的 `filterList` 中会有多个条目，需要通过 `paramId` 区分筛选维度（`paramId` 格式为 `node_xxx-selectFilter`，其中 `node_xxx` 是筛选器组件的 id），然后取对应条目的 `filterKey`
- 将提取的 filterKey 写入 COMPONENTS 配置的 `filterKeys` 属性中，格式如：`filterKeys: { status: 'filter-xxx', priority: 'filter-yyy' }`
- 缺失的图表类型需通过 `openyida append-chart` 补充
- 最终输出 ECharts 自定义页面，原生报表设为双端隐藏

## 常见问题

**Q：ECharts 加载失败怎么办？**

**必须使用阿里 CDN**（`https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js`）。宜搭环境（aliwork.com）对 `cdnjs.cloudflare.com` 有安全策略限制，会导致脚本加载失败。禁止使用 cloudflare CDN。

**Q：`forceUpdate is not a function` 报错？**

代码中缺少宜搭自定义页面必需的 `forceUpdate` 函数定义。必须在代码中包含以下三个函数：
```javascript
export function getCustomState(key) { if (key) return _customState[key]; return Object.assign({}, _customState); }
export function setCustomState(newState) { Object.assign(_customState, newState); this.forceUpdate(); }
export function forceUpdate() { this.setState({ timestamp: new Date().getTime() }); }
```
详见上方「ECharts 页面代码必备结构」章节。

**Q：页面数据更新后不刷新？**

`renderJsx` 的每个 `return` 分支都必须包含 `<div style={{ display: 'none' }}>{this.state.timestamp}</div>`，否则 `forceUpdate` 无法触发 React 重渲染。

**Q：图表不显示？**

1. **最常见原因：渲染时序问题** — 异步数据加载完成后立即调用 `renderXxxChart()`，但此时 `loading=true`，图表容器 DOM 还不存在。**必须在 `loading=false` + `forceUpdate()` 后通过 `setTimeout` 延迟渲染**，详见上方「图表渲染时序」章节
2. 确认 DOM 容器有明确的 `height`（ECharts 要求容器有高度）
3. 确认 `echarts.init()` 在 DOM 渲染完成后调用
4. 打开浏览器控制台查看是否有报错

**Q：数据量很大，页面卡顿？**

1. 使用 `chart.showLoading()` 展示加载状态
2. 考虑只展示最近 N 条数据或按时间范围筛选
3. 所有聚合统计必须使用方案二（宜搭报表 `getDataAsync.json` 接口），由服务端完成聚合计算

**Q：如何实现图表联动筛选？**

在筛选条件变化时，重新调用数据获取函数并更新图表。数据请求函数必须用 `var` 声明。

> ⚠️ **filterValueMap 的 key 必须严格使用报表 Schema 中的 `filterKey`**（`filter-xxx-xxx-xxx-xxx` 格式）。
> **绝对禁止**使用表单字段 ID（如 `selectField_xxx`）、alias（如 `field_filter_ref_xxx`）或任何其他格式作为 key，否则接口会返回 `queryContext 格式不正确` 错误。
>
> **每个图表组件有独立的 filterKey**：同一个筛选维度（如"项目状态"）在不同组件中的 filterKey 完全不同。
> 必须从每个组件的 `props.dataSetModelMap.<dataSetKey>.dataViewQueryModel.filterList` 中逐个提取。
> 当有多个筛选维度时，通过 `paramId`（格式 `node_xxx-selectFilter`）区分筛选器，取对应条目的 `filterKey`。

**正确的 COMPONENTS 配置和 filterValueMap 构建方式**：

```javascript
// ✅ 正确：每个组件配置独立的 filterKeys（从报表 Schema 提取）
var COMPONENTS = {
  indicator: {
    cid: 'node_xxx', className: 'YoushuSimpleIndicatorCard', dataSetKey: 'youshuData',
    filterKeys: { status: 'filter-aaa-bbb-ccc-ddd', priority: 'filter-eee-fff-ggg-hhh' },
  },
  pieChart: {
    cid: 'node_yyy', className: 'YoushuPieChart', dataSetKey: 'chartData',
    filterKeys: { status: 'filter-iii-jjj-kkk-lll', priority: 'filter-mmm-nnn-ooo-ppp' },
  },
};

// ✅ 正确：根据组件的 filterKeys 构建该组件专属的 filterValueMap
var _buildFilterValueMap = function(component) {
  var filterValueMap = {};
  if (!component.filterKeys) return filterValueMap;
  if (_customState.filterStatus && component.filterKeys.status) {
    filterValueMap[component.filterKeys.status] = [_customState.filterStatus];
  }
  if (_customState.filterPriority && component.filterKeys.priority) {
    filterValueMap[component.filterKeys.priority] = [_customState.filterPriority];
  }
  return filterValueMap;
};

// ✅ 正确：每个组件传入自己的 filterValueMap
_fetchReportData(COMPONENTS.indicator, _buildFilterValueMap(COMPONENTS.indicator));
_fetchReportData(COMPONENTS.pieChart, _buildFilterValueMap(COMPONENTS.pieChart));

// ❌ 错误：用表单字段 ID 作为 key → 接口报错 "queryContext 格式不正确"
var wrongFilterMap = { 'selectField_xxx': '已完成' };

// ❌ 错误：所有组件共用同一个 filterKey → 只有一个组件能正确筛选
var wrongSharedKey = { 'filter-aaa-bbb-ccc-ddd': ['已完成'] };
// 用这个 key 请求 pieChart 会失败，因为 pieChart 的 filterKey 是 'filter-iii-jjj-kkk-lll'
```

> 完整的筛选联动代码模板详见 [`reference/echarts-code-template.md`](reference/echarts-code-template.md)

**Q：`getDataAsync` 返回的 `meta[].aliasName` 显示为 `[object Object]`？**

报表接口返回的 `meta[].aliasName` 可能是 **i18n 对象**（`{"zh_CN":"项目总数","type":"i18n"}`）而非纯字符串。必须做类型判断并提取 `zh_CN` 字段：

```javascript
// ✅ 正确：解析 i18n 对象
var parseI18nName = function(nameValue) {
  if (!nameValue) return '';
  if (typeof nameValue === 'string') return nameValue;
  if (typeof nameValue === 'object' && nameValue.zh_CN) return nameValue.zh_CN;
  return String(nameValue);
};

// 使用示例
var indicatorName = parseI18nName(meta.aliasName);  // → "项目总数"

// ❌ 错误：直接使用 meta.aliasName → 显示为 "[object Object]"
var wrongName = meta.aliasName;
```

> **注意**：不仅 `aliasName`，报表 Schema 中的 `componentTitle`、`label` 等字段也可能是 i18n 对象，都需要用同样的方式解析。
