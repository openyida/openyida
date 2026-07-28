---
name: yida-dashboard
description: "经营看板/驾驶舱/数据大屏产品化交付，默认使用 Code Canvas + yida-rechart。含真实数据、筛选联动、卡片截图、组织内短链和钉钉待办闭环。仅在用户明确要求 ECharts、复杂 ECharts option 或维护旧普通自定义页时转 yida-chart。普通统计优先 yida-report。"
license: MIT
metadata:
  audience: developers
  workflow: yida-development
  version: 2.0.0
  tags:
    - yida
    - dashboard
    - code-canvas
    - executive-report
    - data-visualization
---

# 宜搭 Dashboard 经营看板技能

## 核心定位

本技能负责完整 Dashboard 产品化交付：业务指标、真实数据、交互筛选、洞察、派单、截图和分享闭环。它决定“看什么、怎么组织、怎么验收”，默认实现层是 **Code Canvas**：

- 页面容器、状态、筛选、响应式、副作用：`yida-canvas-custom-page`。
- Canvas 真实数据：`yida-canvas-data-binding`。
- 常规图表：`yida-rechart`。
- 只有用户明确要求 ECharts、需要复杂 ECharts `option`/扩展系列，或维护已有普通自定义页面时，才使用 `yida-chart`。

普通自定义页面能力仍保留为 legacy/native fallback，但不得作为新看板默认链路。

## 何时触发

- 看板 / 驾驶舱 / 大屏 / Dashboard / 数据大屏。
- 经营看板 / 业务看板 / 管理驾驶舱 / 高层汇报。
- 指标卡截图、组织内短链、隐藏导航、看板派单闭环。

单个普通统计报表优先 `yida-report`；只解决单张图的实现问题时按“图表路由边界”选择 `yida-rechart` 或 `yida-chart`。

## 默认交付物

1. 单屏控制塔结构，见 `references/structure-and-layout.md`。
2. 真实数据绑定：聚合指标走报表/聚合结果，明细走分页查询；禁止前端拉全量后聚合。
3. 视觉主题和信息层级，见 `references/theme-presets.md`。
4. 筛选与图表联动；控件必须受控并真实改变下方数据。
5. 每元素可派单：`saveFormData → 集成自动化 → 待办2.0 ConnectorCall`。
6. 卡片截图分享：真实可点击，截图时排除截图按钮本身。
7. PC / 平板 / 手机响应式。
8. 隐藏导航时的组织内分享 URL；需要页面内导航壳时调用 `yida-nav-shell`。
9. loading / empty / error / freshness 状态与 1–3 条业务洞察。

## 链路决策

| 信号 | 实现链路 |
| --- | --- |
| 新建经营看板、驾驶舱、大屏 | Code Canvas + `yida-rechart` |
| React hooks、复杂筛选、轮询、动画、组件状态 | Code Canvas |
| 表单/报表/连接器数据进入 Canvas | `yida-canvas-data-binding`，用同源 HTTP 数据桥 |
| 用户明确要求 ECharts 或提供 ECharts option | `yida-chart` |
| 地图、桑基、graph、custom series 等 Recharts 不覆盖的复杂图 | 明确说明原因后使用 `yida-chart` |
| 维护已有 `.oyd.jsx`、`renderJsx`、`didMount` 页面 | legacy `yida-custom-page` + `yida-chart` |
| 单个原生统计报表 | `yida-report` |

不得因为历史样本是普通自定义页面，就把新看板降级为 `.oyd.jsx`。

## Canvas-first 交付流程

```text
[Step 1] 澄清业务范围 → 5–8 个经营维度、指标、角色与刷新频率
   ↓
[Step 2] 数据契约 → appType/formUuid/fieldId/report/connector endpoint
   ↓
[Step 3] 需要派单时创建“看板派单触发表”并配置集成自动化
   ↓
[Step 4] 用 yida-page-uiux 决定 dashboard/screen、主题、Shell、Archetype
   ↓
[Step 5] 生成 dashboard-overview.canvas.jsx 或 data-screen.canvas.jsx
   ↓
[Step 6] 用 hooks 实现筛选、轮询、截图、hash/导航与 cleanup
   ↓
[Step 7] 常规图表交 yida-rechart；仅命中 ECharts 条件才交 yida-chart
   ↓
[Step 8] compileCanvasLocal 快检；获用户确认后发布并回读 Schema
   ↓
[Step 9] 隐藏导航、验证组织内 URL、截图、数据刷新和派单闭环
```

Canvas 模板入口：

```bash
openyida generate-page dashboard-overview --spec <page-spec.json> \
  --theme-profile yida-app-theme \
  --output project/pages/src/<name>.canvas.jsx --compile
```

用户强调“大屏 / 指挥舱 / 实时监控”时使用 `data-screen` 模板。Canvas 编译与发布细节以 `yida-canvas-custom-page` 为准；不要把 `openyida check-page`、`.oyd.jsx` 或 `renderJsx` 写成默认步骤。

## 数据与派单边界

### 真实数据

- KPI / 趋势 / 占比必须来自服务端聚合、报表结果或明确的聚合接口。
- 明细查询必须分页；不得拉全量后 `reduce` 冒充生产聚合。
- Canvas 页面使用 `dataBinding` + `DataBridge` + 同源 `fetch`，请求带 credentials、CSRF、错误态与 cleanup。
- 不得在 Canvas 使用 `this.dataSourceMap`；连接器代理转 `yida-canvas-data-binding`。
- demo/seed 只能用于 sample 或离线预览，并明确标记；真实交付无数据时展示真实空态。

### 派单

需要派单时固定使用：

1. `yida-create-form-page` 创建“看板派单触发表”，至少包含
   `subject` / `executor` / `description` / `dueTime` / `priority` / `priorityNum`。
2. `openyida integration create ... --events create` 配置待办2.0 ConnectorCall。
3. 前端只写触发表；连接器鉴权和调用留在后端集成自动化。

`priority` 连接器入参必须来自 NumberField `priorityNum`（10/20/30/40），不能直接透传 SelectField/RadioField。不得把工作通知包装成真实待办。

## Canvas 实现纪律

1. 使用 `YidaComp` React 函数组件和 hooks；不使用 `_customState` / `forceUpdate`。
2. `useEffect` 注册的轮询、键盘、resize、hash、截图资源或图表副作用必须 cleanup。
3. 筛选、周期切换、Tabs、刷新按钮均为受控状态，并真实驱动列表/KPI/图表派生数据。
4. 所有数据请求都有 loading / error / retry；静默刷新保留旧数据。
5. 所有可见按钮必须有真实 handler 或显式 disabled。
6. 截图按钮必须可用，并在截图时用 class/属性排除自身。
7. 移动端 KPI 改 2 列或横向滚动，图表纵向堆叠。
8. 隐藏平台导航后需要跨模块切换时，交 `yida-nav-shell`，默认用 Canvas `useState` / hash。

## 图表路由边界

### 默认：`yida-rechart`

以下图表默认调用：

```text
use_skill("yida-rechart", "在 Code Canvas 看板中实现常规业务图表")
```

- 折线、面积、柱、条、饼/环、组合图。
- 常规 tooltip、legend、响应式容器、主题色和数据格式化。
- KPI 趋势、区域营收、渠道贡献、客群分布、排行与同比环比。

### 例外：`yida-chart`

只有出现以下任一信号时调用：

```text
use_skill("yida-chart", "实现明确要求的 ECharts 或维护旧 native 图表")
```

- 用户明确说 ECharts。
- 用户提供或要求维护复杂 ECharts `option`。
- 地图、桑基、graph、custom series、复杂 visualMap 等 Recharts 不覆盖能力。
- 维护已有普通自定义页 / native ECharts 页面。

不要仅因“看板里有图”就调用 `yida-chart`。

## Legacy/native fallback

只有用户明确选择普通自定义页面，或现有页面依赖 `this.utils.yida.*`、`this.dataSourceMap`、`renderJsx`、`didMount` 等实例桥时，才进入 legacy 链路：

- 页面规范交 `yida-custom-page`。
- 旧 ECharts 图表交 `yida-chart`。
- 本地使用 `.oyd.jsx`、`openyida check-page`、`openyida compile`。
- 历史样本和本技能 references 中的 `renderJsx` / `didMount` 片段仅供维护旧页面，不代表新建默认。

## 严格禁止

1. 禁止默认生成普通 `.oyd.jsx` 看板。
2. 禁止前端拉全量明细聚合 KPI。
3. 禁止 Canvas 使用 `this.dataSourceMap`、`this.utils.yida.*` 或普通页生命周期。
4. 禁止在前端直连钉钉 OpenAPI、硬编码 accessToken/Cookie/密钥。
5. 禁止把工作通知声称为真实待办。
6. 禁止 mock/seed 数据冒充真实交付。
7. 禁止无 handler 的按钮。
8. 禁止常规图表无条件路由 `yida-chart`。

## 参考文档

| 文档 | 何时读 |
| --- | --- |
| `references/structure-and-layout.md` | 设计 Dashboard 层次、Canvas 组件树和响应式 |
| `references/theme-presets.md` | 选择主题、色板和图表视觉强度 |
| `references/interaction-patterns.md` | 派单、搜人、截图、marquee、短链；旧普通页代码仅作 legacy |
| `references/pitfalls.md` | 发布前检查数据、连接器、截图与旧页面兼容问题 |

## 验收

- Canvas 本地编译通过，依赖只包含白名单模块。
- 发布后回读到 `YidaCodeCanvas` 与非空 `runtimeCode`。
- 至少一个 KPI/列表/图表来自真实数据契约；否则标记 sample/draft。
- 筛选、刷新、移动端、截图、空/载/错态实际可用。
- 常规图表已路由 `yida-rechart`；使用 `yida-chart` 时交付说明明确命中了哪条 ECharts 例外。
- 需要派单时，真实待办 ConnectorCall 和字段映射验证通过。
- 隐藏导航时，最终组织内 URL 保留 `isRenderNav=false`。
