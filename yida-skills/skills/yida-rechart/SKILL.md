---
name: yida-rechart
description: 自定义页面 Recharts 高级图表技能。使用 `YidaCodeCanvas` 组件和 Recharts 实现可视化、看板图表、趋势图、组合图等现代 React 图表页面；聚合数据必须来自宜搭原生报表或已聚合接口，不在前端拉全量明细自行聚合。明确要求 ECharts、维护旧 ECharts 页面或 Recharts 无法覆盖的复杂 option 时改用 yida-chart。
---

# 自定义页面 Recharts 图表

## 核心定位

本技能是“高级图表 / 可视化 / 看板图表”的默认实现链路：

- 页面使用 `.canvas.jsx` / `.canvas.tsx`。
- 入口使用 `YidaComp` React 函数组件。
- 状态、筛选和生命周期使用 React hooks。
- 图表使用白名单依赖 `recharts`，页面组件优先使用 `antd`。
- 数据读取与错误态遵循 `yida-canvas-data-binding`。

本技能负责图表展示和交互，不替代服务端聚合能力。KPI、分组、求和、平均、趋势、占比等统计口径仍由 `yida-report` 或已验证的聚合接口产生。

## 路由边界

| 用户意图 | 选择 |
| --- | --- |
| 高级图表、可视化、看板图表、趋势组合图，没有指定技术栈 | `yida-rechart` |
| 标准统计报表、原生筛选器、指标卡和表格报表 | `yida-report` |
| 明确指定 ECharts | `yida-chart` |
| 维护已有 ECharts / 普通自定义页面 | `yida-chart` |
| 地图、graph、custom series、复杂 option 等 Recharts 无法覆盖 | `yida-chart` |
| 自定义页面图表接真实数据、CSRF、同源 fetch、错误态 | 同时遵循 `yida-canvas-data-binding` |

不要仅因为用户说“高级”“好看”“大屏”就切到 ECharts。默认先用本技能；只有明确技术要求、维护平台 JSX 组件页面或能力缺口才使用 `yida-chart`。

## 致命规则（FATAL）

1. **禁止前端全量聚合**：不得拉取全量表单明细后在浏览器中 `reduce` / `groupBy` 计算 KPI、趋势、占比或排名。
2. **聚合口径有来源**：统计数据必须来自 `yida-report` 原生报表接口，或经过验证、已完成权限与聚合的后端/连接器接口。
3. **YidaCodeCanvas 组件契约正确**：源码使用 `.canvas.jsx` / `.canvas.tsx`，主入口是 `YidaComp` 函数组件，使用 hooks，不使用 `renderJsx`、`didMount` 或 `this.utils.yida.*`。
4. **依赖只用可用资源清单**：从 `recharts`、`react`、`antd` 等 `YidaCodeCanvas` 可用资源清单内的包导入；不通过脚本标签加载 Recharts。
5. **错误与空态真实**：接口失败、无权限、字段不匹配和无数据分别展示明确状态，不用 seed 数据伪装真实成功。
6. **源码修改后才可声明发布**：真实交付中创建或修改页面源码后，只有成功执行 `openyida publish <source> <appType> <displayPageFormUuid>` 才能说“页面已发布”；本地编译只能说明“源码可发布”。

## 数据边界

| 数据类型 | 正确来源 | 页面允许做什么 |
| --- | --- | --- |
| KPI、求和、平均、分组、趋势、占比、排名 | `yida-report` 或已聚合接口 | 格式化、排序已聚合点、切换展示窗口 |
| 已聚合时间序列 | 报表组件接口或聚合 API | 映射字段、过滤当前展示范围、渲染组合图 |
| 明细记录 | 分页表单查询 | 展示明细、跳转详情，不在前端转成聚合指标 |
| seed 数据 | 本地演示 | 必须显式标注未接真实报表 |

如果需求同时包含“创建统计口径”和“做定制图表”，先用 `yida-report` 形成聚合数据源，再用本技能展示。已有聚合 API 时，先用 `yida-canvas-data-binding` 验证请求、鉴权、返回体和错误态。

## 推荐实现结构

```jsx
import React, { useMemo, useState } from 'react';
import { Segmented } from 'antd';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function YidaComp(props) {
  const [windowSize, setWindowSize] = useState(7);
  const aggregatedRows = Array.isArray(props.aggregatedRows)
    ? props.aggregatedRows
    : [];
  const visibleRows = useMemo(
    () => aggregatedRows.slice(-windowSize),
    [aggregatedRows, windowSize]
  );

  return (
    <div>
      <Segmented value={windowSize} onChange={setWindowSize} options={[7, 30]} />
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={visibleRows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="amount" fill="#1677ff" />
          <Line dataKey="target" stroke="#fa8c16" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default YidaComp;
```

这段结构只消费已聚合行；不要在 `useMemo` 中把原始明细聚合成图表点。

## 开发流程

下面命令以仓库根为视角；如果 cwd 已是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。

```bash
# 1. 如需真实统计，先创建/确认原生报表或已聚合接口
# yida-report 负责统计口径；yida-canvas-data-binding 负责接口接入

# 2. 本地快检
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/trend-combo.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"

# 3. 真实交付时发布
openyida publish project/pages/src/trend-combo.canvas.jsx <appType> <displayPageFormUuid>
```

## 验收清单

- [ ] 源码后缀是 `.canvas.jsx` / `.canvas.tsx`，入口是 `YidaComp`。
- [ ] `compileCanvasLocal` 返回的依赖包含 `react`、`recharts`，使用 antd 时包含 `antd`。
- [ ] 图表消费的是报表结果或已聚合接口，不是全量明细前端聚合。
- [ ] 筛选控件受控，并真正改变展示数据或请求参数。
- [ ] loading、空态、错误态、无权限状态可区分。
- [ ] 响应式容器有明确高度，Tooltip、坐标轴和图例可读。
- [ ] seed 数据有可见标识；真实交付不把 seed 当真实数据。
- [ ] 只有真实 `publish` 成功后才声明页面已发布。

## 完成证据

- 本地样例或源码：`compileCanvasLocal` 成功且依赖清单正确。
- 真实交付：聚合数据源已验证，页面发布成功并返回目标页面 URL。
- 若本轮没有远程写入，只能报告“技能/源码/样例已完成本地验证，尚未发布”。
