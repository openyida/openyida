---
name: yida-dashboard
description: "经营看板、驾驶舱和数据大屏产品结构编排。定义指标、布局、筛选、派单、截图、分享和验收；具体图表、聚合、数据接入和页面实现交给对应技能。"
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

本技能负责 Dashboard 产品结构：看什么指标、页面怎么分区、筛选怎么影响数据、哪些元素能派单、截图和分享怎么验收。默认实现层是 **Code Canvas**。

页面代码、数据桥、图表 option 和报表聚合规则见下方对应技能。

## 何时触发

- 看板 / 驾驶舱 / 大屏 / Dashboard / 数据大屏。
- 经营看板 / 业务看板 / 管理驾驶舱 / 高层汇报。
- 指标卡截图、组织内短链、隐藏导航、看板派单。

单个普通统计报表用 `yida-report`。只解决单张图的实现问题时，用 `yida-rechart`；只有用户明确要求 ECharts 或维护旧 ECharts 页面时，用 `yida-chart`。

## 技能分工

| 内容 | 负责人 |
| --- | --- |
| 看板产品结构、指标分区、筛选关系、行动入口、截图和验收 | `yida-dashboard` |
| 页面实现、Canvas 源码、表单入口、发布校验 | `yida-canvas-custom-page` |
| Canvas 真实数据接入、`dataBinding`、返回体解析、轮询刷新 | `yida-canvas-data-binding` |
| 常规图表：折线、柱、条、面积、饼、环、组合图 | `yida-rechart` |
| 服务端聚合、原生统计报表、报表结果作为数据源 | `yida-report` |
| 明确要求 ECharts、复杂 ECharts option、维护旧 ECharts 页面 | `yida-chart` |
| 隐藏平台导航后的页面内导航壳 | `yida-nav-shell` |
| 看板派单触发表和待办集成 | `yida-create-form-page`、`yida-integration` |

## 交付清单

1. 指标分组：5 到 8 个经营维度，每个维度有口径、数据来源和刷新频率。
2. 页面结构：首屏重点、趋势区、分布区、明细区、行动区和移动端形态。
3. 数据路径：聚合指标交 `yida-report` 或已聚合接口；明细和筛选数据交 `yida-canvas-data-binding`。
4. 图表路径：常规图表交 `yida-rechart`；只有用户明确要求 ECharts 或维护旧 ECharts 页面时交 `yida-chart`。
5. 行动路径：需要派单时，定义触发表字段和待办集成目标，再交表单和集成技能实现。
6. 页面路径：新建看板用 `yida-canvas-custom-page` 实现和发布。
7. 分享路径：需要隐藏导航或页面内导航时，交 `yida-nav-shell` 和页面配置技能处理。

## 执行步骤

1. 读取 `prd.md` 与 `design.md`，提取看板目标、用户角色、指标、视觉风格和验收标准。
2. 输出看板结构：指标分组、区块顺序、筛选项、图表类型、明细表、行动入口、截图和分享要求。
3. 按“技能分工”加载实现技能。Canvas、Recharts、报表、数据桥和 ECharts 细则以对应技能为准。
4. 实现技能完成后，本技能只检查看板是否满足业务验收。

## 路由边界

- 常规图表：`yida-rechart`。
- 聚合统计：`yida-report`。
- 数据接入：`yida-canvas-data-binding`。
- 页面实现：`yida-canvas-custom-page`。
- 只有用户明确要求 ECharts、提供复杂 ECharts option，或维护旧 ECharts 页面时：`yida-chart`。
- 单个普通统计报表：`yida-report`，不进入完整 Dashboard 编排。

## 存量普通页维护

只有已确认的存量普通 JSX/Jsx 看板，才进入普通页面维护链路：

- 页面规范交 `yida-custom-page`。
- 旧 ECharts 图表交 `yida-chart`。
- 本地检查和发布按普通页面技能执行。

## 严格禁止

1. 禁止默认生成普通 `.oyd.jsx` 看板。
2. 禁止前端拉全量明细聚合 KPI。
3. 禁止把工作通知说成真实待办。
4. 禁止 mock/seed 数据冒充真实交付。
5. 禁止常规图表无条件路由 `yida-chart`。

## 参考文档

| 文档 | 何时读 |
| --- | --- |
| `references/structure-and-layout.md` | 设计 Dashboard 层次、区块顺序和响应式要求 |
| `references/theme-presets.md` | 选择看板主题和图表视觉强度 |
| `references/interaction-patterns.md` | 派单、搜人、截图、marquee、短链的产品行为 |
| `references/pitfalls.md` | 发布前检查数据、连接器、截图和旧页面兼容问题 |

## 验收

- 看板结构包含指标、图表、筛选、明细、行动入口和分享要求。
- 每个指标都有真实数据来源；聚合不在前端拉全量完成。
- 常规图表已路由 `yida-rechart`；使用 `yida-chart` 时写明命中的 ECharts 条件。
- 页面实现和发布证据来自 `yida-canvas-custom-page`。
- 数据接入证据来自 `yida-canvas-data-binding`、`yida-report` 或已确认接口。
- 需要派单时，触发表字段和待办集成验证通过。
