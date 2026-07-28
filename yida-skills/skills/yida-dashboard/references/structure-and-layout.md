# 看板结构与布局规范

> 本文定义看板的信息结构、Canvas 组件树和响应式策略。新建页面默认用 Code Canvas；文末普通自定义页说明仅用于维护旧页面。

## 单屏控制塔结构

从上到下按业务优先级组织，不要求每个看板机械复制九层：

```text
DashboardPage
├── DashboardHeader       标题、数据更新时间、刷新
├── FilterBar             视图、周期、维度、重置
├── MetricStrip           4–6 个核心 KPI，有主次
├── ControlTower
│   ├── HealthSummary     健康指数/核心结论
│   ├── BusinessModules   经营模块
│   └── ActionRiskPanel   今日动作 + 风险水位
├── ChartGrid             主图更大，辅助图更克制
├── DetailAndRanking      审批、排行、项目进度
├── InsightStrip          结论 + 证据 + 建议
└── TodoModal             派单交互，按需出现
```

常规经营看板使用 `dashboard-overview`；强调投屏、中心态势和实时监控时使用 `data-screen`。页面需要跨模块导航且隐藏平台导航时，外层再套 `yida-nav-shell`。

## Canvas 组件骨架

```jsx
import React, { useEffect, useMemo, useState } from 'react';

function YidaComp() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [dataState, setDataState] = useState({
    loading: true,
    error: null,
    rows: [],
    lastUpdatedAt: null,
  });
  const [todoTarget, setTodoTarget] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboardData(filters, controller.signal)
      .then((result) => {
        setDataState({
          loading: false,
          error: null,
          rows: result.rows,
          lastUpdatedAt: Date.now(),
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setDataState((current) => ({ ...current, loading: false, error }));
        }
      });
    return () => controller.abort();
  }, [filters]);

  const viewModel = useMemo(
    () => buildDashboardViewModel(dataState.rows, filters),
    [dataState.rows, filters],
  );

  if (dataState.loading) return <DashboardLoading />;
  if (dataState.error) return <DashboardError error={dataState.error} />;

  return (
    <main className="dashboard-page">
      <DashboardHeader lastUpdatedAt={dataState.lastUpdatedAt} />
      <FilterBar value={filters} onChange={setFilters} />
      <MetricStrip items={viewModel.metrics} onAssign={setTodoTarget} />
      <ControlTower model={viewModel.controlTower} onAssign={setTodoTarget} />
      <ChartGrid charts={viewModel.charts} filters={filters} />
      <DetailAndRanking model={viewModel.details} />
      <InsightStrip insights={viewModel.insights} />
      <TodoModal target={todoTarget} onClose={() => setTodoTarget(null)} />
    </main>
  );
}

export default YidaComp;
```

`ChartGrid` 中的常规图表默认按 `yida-rechart` 实现。只有明确 ECharts、复杂 option/扩展系列或维护旧 native 页面时，才换成 `yida-chart`。

## 响应式策略

优先使用 CSS media query、Grid 和 `ResponsiveContainer`，不要在渲染函数里一次性读取 `window.innerWidth` 后永不更新。

| 区块 | PC（≥1024） | 平板（768–1023） | 手机（<768） |
| --- | --- | --- | --- |
| Header | 横向 | 横向，次要信息收起 | 标题与操作换行 |
| FilterBar | 一行 4–6 控件 | 两行 | Drawer/纵向 |
| KPI | 4–6 列，有主次 | 2–3 列 | 2 列或横向滚动 |
| ControlTower | 主 2/3 + 次 1/3 | 两列 | 单列 |
| ChartGrid | 主图跨 2 列，辅图 1 列 | 两列 | 单列 |
| Detail/Ranking | 两列 | 两列或单列 | 单列 |

图表容器必须有稳定的 `min-height`；PC 常规 320–400px，移动端 240–300px。具体取值服从页面视觉决策，不要所有卡片无差别等高。

## 结构纪律

- 首屏先回答“业务健康吗、哪里异常、下一步做什么”，不要先铺满图表。
- KPI 4–6 个且有主次；不要所有卡片等宽、等高、同强调级。
- 主图回答最关键问题，辅助图只补充证据。
- 每张图都要有业务标题、单位、tooltip、空态和一句洞察。
- loading / empty / error / stale 数据状态都必须可见。
- 筛选控件必须受控，并真实改变 KPI、图表或明细。
- 轮询刷新必须 silent，保留旧数据；`useEffect` 中断请求并清理定时器。

## Legacy/native fallback

历史样本：

- `project/pages/src/supply-chain-dashboard.js`
- `project/pages/src/shangri-la-executive-dashboard.js`

它们只能参考信息架构、业务模块和视觉节奏。其中 `renderJsx`、`_customState`、`didMount`、ECharts CDN 与样式对象属于普通自定义页面实现，仅在维护既有 `.oyd.jsx` 时使用。新建看板不得因参考这些样本而从 Canvas 回退到 native。
