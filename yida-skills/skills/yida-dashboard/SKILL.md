---
name: yida-dashboard
description: 设计经营看板、驾驶舱或数据大屏的指标、布局、筛选、操作和验收方式。
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

# 宜搭经营看板

## 何时使用

- 设计经营看板、驾驶舱或数据大屏。
- 定义指标、筛选、图表、明细、派单、截图和分享。
- 单个普通统计报表 → 使用 `yida-report`。
- 只实现一张 Recharts 图表 → 使用 `yida-rechart`。

## 输出内容

1. 5 至 8 个经营维度，每个维度写明指标口径、数据来源和刷新频率。
2. 首屏重点、趋势区、分布区、明细区、操作区和移动端结构。
3. 筛选项与受影响的指标、图表和明细。
4. 派单、截图、分享和导航要求。
5. 可验证的业务验收标准。

## 执行步骤

1. 完整应用读取 `page-spec.json` 和项目 Canvas 脚手架；单点看板任务读取当前 PRD 与设计上下文。
2. 输出指标、区块、筛选、图表、明细和操作入口。
3. 按下表加载实现技能。
4. 实现完成后检查真实数据、交互、移动端、截图和分享结果。

| 内容 | 使用技能 |
|------|----------|
| Code Canvas 页面实现和发布 | `yida-canvas-custom-page` |
| 页面真实数据 | `yida-canvas-data-binding` |
| Recharts 图表 | `yida-rechart` |
| 服务端聚合和原生报表 | `yida-report` |
| 已有普通 JSX ECharts 页面 | `yida-chart` |
| 页面内导航 | `yida-nav-shell` |
| 派单表单和自动化 | `yida-create-form-page`、`yida-integration` |

## 必须遵守

- 统计指标使用原生报表或已聚合接口，不在前端拉全量明细计算。
- 页面使用真实数据；示例数据必须明确标记，不能作为交付结果。
- 工作通知和真实待办分别描述。
- 新看板使用 Code Canvas；已有普通 JSX 看板才使用普通页面维护技能。

## 完成条件

- 每个指标都有口径、数据来源和刷新频率。
- 页面包含筛选、图表、明细和操作入口。
- 页面发布和数据接入都有真实验证结果。
- 需要派单时，触发表单和自动化已验证。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [结构和布局](references/structure-and-layout.md) | 设计区块和响应式布局时 |
| [主题](references/theme-presets.md) | 选择看板主题时 |
| [交互](references/interaction-patterns.md) | 设计派单、搜人、截图和分享时 |
| [常见问题](references/pitfalls.md) | 发布前检查数据和旧页面兼容时 |
