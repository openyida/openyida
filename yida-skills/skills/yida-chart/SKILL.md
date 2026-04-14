---
name: yida-chart
description: "宜搭 ECharts 高级报表技能。通过 ECharts + 自定义页面 JSX 实现高度定制化、更美观的数据可视化报表。本技能不负责创建宜搭原生报表（标准报表由 yida-report 技能负责），但 ECharts 报表必须依赖宜搭原生报表的 getDataAsync.json 或 getCacheData.json 接口获取聚合数据，禁止前端聚合。当用户提到「更美观」「高级」「定制化」「ECharts」「echarts」「Dashboard 大屏」「数据大屏」等关键词，或用户提供了报表 URL 要求优化时，使用此技能。普通的「报表」「统计」等需求默认由 yida-report 技能处理。"
---

# 宜搭 ECharts 高级报表技能

## 严格禁止 (NEVER DO)

- 不要在前端直接聚合表单数据，必须通过宜搭原生报表接口（`getDataAsync.json` / `getCacheData.json`）获取聚合数据
- 不要在没有原生报表的情况下直接创建 ECharts 页面，必须先用 `yida-report` 创建原生报表作为数据源
- 不要支持多表关联数据源，当前仅支持单表数据源
- 不要将 ECharts 图表的输出误认为是"优化原生报表"，输出始终是 ECharts 自定义页面
- 不要编造 `reportId`、`datasetId`，必须从报表 URL 或 Schema 中提取
- 不要使用 `cdnjs.cloudflare.com` CDN，宜搭环境有安全策略限制，必须使用阿里 CDN

## 严格要求 (MUST DO)

- **创建/发布前必须确认**：执行创建页面或发布操作前，必须向用户展示即将创建的页面配置摘要，获得用户明确同意后再执行
- 用户提供报表 URL 时，必须先解析 URL 提取 `appType` 和 `reportId`，再获取报表 Schema
- 若用户没有原生报表，必须先调用 `yida-report` 技能创建原生报表，再基于其数据源创建 ECharts 页面
- ECharts 必须通过 `this.utils.loadScript` 加载 CDN，不得 `import`
- 数据加载失败时必须显示错误状态，不得静默失败
- **编写代码前必须读取** `references/echarts-code-template.md`，遵循必备代码结构

## 触发条件

**正向触发**：
- "更美观"、"ECharts"、"大屏"、"Dashboard"、"定制化"
- "数据大屏"、"可视化看板"、"高级报表"
- 用户提供报表 URL 要求优化

**不适用场景（不要触发）**：
- 普通"报表"、"统计"需求 → `yida-report`（默认选择）
- 没有原生报表时直接创建 ECharts → 必须先用 `yida-report` 创建原生报表作为数据源
- 管理表单数据 → `yida-data-management`

**与相邻技能的边界**：
| 场景 | 使用技能 |
|------|---------|
| 普通报表/统计需求 | `yida-report` |
| 高级定制化可视化（ECharts） | **本技能** |
| 创建/修改表单字段 | `yida-create-form-page` |
| 查询表单数据 | `yida-data-management` |

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 没有原生报表就要创建 ECharts | 必须先调用 `yida-report` 创建原生报表，再基于其数据源创建 ECharts 页面 |
| reportId/datasetId 不存在 | 不得编造，必须从报表 URL 或 Schema 中提取 |
| ECharts CDN 加载失败 | 使用 `this.utils.loadScript` 加载阿里 CDN，失败时显示错误状态 |
| 数据 rows 为空 | 必须处理空数据情况，显示"暂无数据"而非页面崩溃 |
| 多表关联数据源 | 当前仅支持单表数据源，不支持多表关联，提示用户调整需求 |

## Agent 错误处理策略

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试或调整参数 |
| 参数缺失（appType/reportId 等） | 主动询问用户补充，不得猜测或编造 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida auth status` 检查登录态 |
| 原生报表不存在 | 停止当前流程，引导用户先使用 `yida-report` 创建原生报表 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |

## 触发条件

**正向触发**：
- "更美观"、"ECharts"、"大屏"、"Dashboard"、"定制化"
- "数据大屏"、"可视化看板"、"高级报表"
- 用户提供报表 URL 要求优化

**不适用场景（不要触发）**：
- 普通"报表"、"统计"需求 → `yida-report`（默认选择）
- 没有原生报表时直接创建 ECharts → 必须先用 `yida-report` 创建原生报表作为数据源
- 管理表单数据 → `yida-data-management`

**与相邻技能的边界**：
| 场景 | 使用技能 |
|------|---------|
| 普通报表/统计需求 | `yida-report` |
| 高级定制化可视化（ECharts） | **本技能** |
| 创建/修改表单字段 | `yida-create-form-page` |
| 查询表单数据 | `yida-data-management` |

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 没有原生报表就要创建 ECharts | 必须先调用 `yida-report` 创建原生报表，再基于其数据源创建 ECharts 页面 |
| reportId/datasetId 不存在 | 不得编造，必须从报表 URL 或 Schema 中提取 |
| ECharts CDN 加载失败 | 使用 `this.utils.loadScript` 加载阿里 CDN，失败时显示错误状态 |
| 数据 rows 为空 | 必须处理空数据情况，显示"暂无数据"而非页面崩溃 |
| 多表关联数据源 | 当前仅支持单表数据源，不支持多表关联，提示用户调整需求 |

## Agent 错误处理策略

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试或调整参数 |
| 参数缺失（appType/reportId 等） | 主动询问用户补充，不得猜测或编造 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida auth status` 检查登录态 |
| 原生报表不存在 | 停止当前流程，引导用户先使用 `yida-report` 创建原生报表 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |

---

## 参考文档索引（渐进式加载）

> ⚠️ **编写 ECharts 页面代码前，必须先读取相关参考文档**，不要凭记忆编写代码。

| 文档 | 路径 | 何时读取 |
|------|------|---------|
| **代码模板（必读）** | [`references/echarts-code-template.md`](references/echarts-code-template.md) | 编写任何 ECharts 页面代码前必须读取 |
| **数据绑定指南** | [`references/echarts-bindding-guide.md`](references/echarts-bindding-guide.md) | 需要从报表接口获取数据时读取 |
| **设计规范** | [`references/echarts-design-spec.md`](references/echarts-design-spec.md) | 需要设计图表布局、配色时读取 |
| **完整示例** | [`references/examples.md`](references/examples.md) | 需要参考完整页面代码时读取 |
| **JS 示例文件** | `openyida sample yida-chart <name>` | 需要特定图表类型示例时执行命令获取 |

### JS 示例文件索引

> 执行 `openyida sample yida-chart <name>` 将示例输出到 `.cache/samples/<name>.js`，再用 `read_file` 读取。

| name | 图表类型 | 说明 |
|------|---------|------|
| `line-trend` | 折线图 | 趋势分析 |
| `multi-bar-compare` | 柱状图 | 多维度对比 |
| `radar-chart` | 雷达图 | 多维度评估 |
| `stacked-area` | 堆叠面积图 | 占比趋势 |
| `china-map` | 中国地图 | 地域分布 |
| `dashboard-bindform` | 综合看板 | 多图表组合 |
| `scatter-bindform` | 散点图 | 相关性分析 |

---

## 与 yida-report 的分工

| 技能 | 定位 | 典型场景 |
|------|------|---------|
| **yida-report**（原生报表） | 创建宜搭平台内置报表，作为数据源 | 普通「报表」「统计」需求 |
| **yida-chart**（本技能） | 基于原生报表数据，用 ECharts 实现自定义可视化页面 | 「更美观」「大屏」「ECharts」「定制化」需求 |

> **使用本技能前**：若用户尚无原生报表，需先调用 `yida-report` 技能创建原生报表作为数据源，再由本技能创建 ECharts 自定义页面。

---

## 前置依赖

- 必须先加载 **`yida-custom-page`** 技能，遵循其编码规范
- ECharts 高级报表需要依赖 **`yida-report`** 技能创建原生报表作为数据源
- 需要已创建好数据源表单（通过 `yida-create-form-page` 创建）
- 需要知道数据源表单的 `formUuid` 和字段 `fieldId`（通过 `yida-get-schema` 获取）

---

## ECharts CDN 地址（必须使用）

| CDN | URL | 说明 |
|-----|-----|------|
| **阿里 CDN**（必须使用） | `https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js` | 阿里内网外网均可访问 |

> ⚠️ **禁止使用 `cdnjs.cloudflare.com`**，宜搭环境（aliwork.com）对 cloudflare CDN 有安全策略限制，会导致脚本加载失败。

---

## 方案选择规则

```
场景 A: 用户提供了已有报表 URL（如 https://www.aliwork.com/APP_XXX/admin/REPORT-XXX）
  → 使用【方案 C：基于已有报表创建 ECharts 页面】
  → 从 URL 中解析 appType 和 formUuid，获取现有 Schema 作为数据源
  → 最终输出：ECharts 自定义页面（非优化后的原生报表）

场景 B: 用户未提供报表 URL，但有数据源表单
  → 使用【方案 B：ECharts 高级报表】
  → 先调用 yida-report 创建原生报表作为数据源
  → 再创建 ECharts 自定义页面

场景 C: 用户只需要标准报表（无 ECharts 定制需求）
  → 不使用本技能，直接使用 yida-report 技能
```

---

## 方案 C：基于已有报表创建 ECharts 页面

### 触发条件

用户消息中包含符合以下格式的报表 URL：
```
https://www.aliwork.com/{appType}/admin/{formUuid}
```

其中 `formUuid` 以 `REPORT-` 开头，表明这是一个宜搭原生报表页面。

### 执行流程

```
Step 1: 从 URL 中解析 appType 和 formUuid
    ↓
Step 2: 执行 openyida env 检测环境和登录态
    ↓
Step 3: 执行 openyida get-schema <appType> <formUuid> 获取现有报表 Schema
    ↓  （将完整输出重定向到文件，避免终端截断）
    ↓  命令：openyida get-schema <appType> <formUuid> > .cache/report-schema-output.txt 2>&1
    ↓
Step 4: 解析现有 Schema，提取关键信息：
    ↓  - cubeCode（数据集编码）
    ↓  - cubeTenantId（租户 ID）
    ↓  - 各组件的 fieldDefinitionList（字段定义）
    ↓  - 各组件的 settings（配置项）
    ↓
Step 5: 读取 references/echarts-code-template.md，基于模板编写 ECharts 页面代码
    ↓
Step 6: 隐藏原生报表页面（双端隐藏）
    ↓
Step 7: 输出 ECharts 自定义页面访问链接
```

### 关键约束

1. **必须复用原有数据源**：`cubeCode`、`cubeTenantId`、`cid`、`componentClassName` 等必须从原报表 Schema 中提取
2. **不要修改原生报表和数据源表单**：只基于原报表的数据接口创建 ECharts 展示层
3. **数据获取必须通过 getDataAsync.json**：禁止前端聚合
4. **隐藏原生报表页面**：创建 ECharts 页面后，将原生报表设置为双端隐藏
5. **prdId 必须动态获取**：通过 `getFormNavigationListByOrder` 接口获取，不能硬编码
6. **纯工具函数必须用 `var` 声明**：不能用 `export function`，否则会被 UglifyJS 消除

> 📖 详细代码模板和数据请求函数请读取 [`references/echarts-code-template.md`](references/echarts-code-template.md)

---

## 常见问题

**Q：ECharts 加载失败怎么办？**

**必须使用阿里 CDN**（`https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js`）。宜搭环境对 `cdnjs.cloudflare.com` 有安全策略限制。

**Q：`forceUpdate is not a function` 报错？**

代码中缺少必需的 `forceUpdate` 函数定义。请读取 `references/echarts-code-template.md` 中的必备代码模板。

**Q：页面数据更新后不刷新？**

`renderJsx` 的每个 `return` 分支都必须包含 `<div style={{ display: 'none' }}>{this.state.timestamp}</div>`。

**Q：图表不显示？**

1. 确认 DOM 容器有明确的 `height`
2. 确认 `echarts.init()` 在 DOM 渲染完成后调用
3. 打开浏览器控制台查看是否有报错

**Q：如何实现图表联动筛选？**

请读取 `references/echarts-bindding-guide.md` 中的筛选联动章节。

---

## Memory 策略

本技能不读写 memory。ECharts 页面代码通过 `yida-publish-page` 发布到宜搭平台，报表关联信息写入 `.cache/<项目名>-report-bindding.json`，不依赖跨会话的 memory 状态。
