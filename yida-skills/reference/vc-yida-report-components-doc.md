# vc-yida-report 图表组件使用文档

> 组件库地址：`//g.alicdn.com/code/npm/@ali/vc-yida-report/1.0.101/pc.js`  
> 全局挂载：`window.YidaReport`  
> 架构说明：图表组件采用懒加载（dynamic import）架构，各图表 chunk 按需加载。

---

## 组件总览

| 组件名 | 中文名 | 类型 |
|---|---|---|
| `YoushuSimpleIndicatorCard` | 指标卡 | 内联组件 |
| `YoushuCrossPivotTable` | 交叉透视表 | 懒加载 |
| `YoushuCalendarHeatmap` | 日历热力图 | 懒加载 |
| `YoushuComboChart` | 组合图 | 懒加载 |
| `YoushuFunnelChart` | 漏斗图 | 懒加载 |
| `YoushuGauge` | 仪表盘 | 懒加载 |
| `YoushuGroupedBarChart` | 分组条形图 | 懒加载 |
| `YoushuHeatmap` | 热力图 | 懒加载 |
| `YoushuLineChart` | 折线图 | 懒加载 |
| `YoushuPieChart` | 饼图 | 懒加载 |
| `YoushuRadarChart` | 雷达图 | 懒加载 |
| `YoushuWordCloud` | 词云图 | 懒加载 |
| `YoushuMap` | 地图 | 懒加载 |
| `YoushuTopFilterContainer` | 顶部筛选容器 | 内联组件 |
| `DateField2` | 日期筛选器 | 内联组件 |
| `CascadeDateField2` | 级联日期筛选器 | 内联组件 |

---

## 通用说明

### 数据模型（youshuData）

所有图表组件均通过 `youshuData` prop 接收数据，数据模型包含以下核心方法：

| 方法/属性 | 说明 |
|---|---|
| `youshuData.data` | 数据数组，`data[0]` 为当前行数据 |
| `youshuData.originData` | 原始数据数组 |
| `youshuData.getFields(type)` | 获取指定类型字段列表，如 `getFields('kpi')` |
| `youshuData.getFieldTitle(fieldKey)` | 根据 fieldKey 获取字段显示名称 |
| `youshuData.handleDataLinkClick(fieldKey, rowData)` | 触发数据链接跳转 |

### 数据链接（dataLink）

字段配置中可包含 `dataLink` 对象：

```json
{
  "dataLink": {
    "type": "URL",
    "url": "https://example.com"
  }
}
```

`type` 为 `"NONE"` 时不启用数据链接。

### 通用 settings 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | `string` | 组件标题 |
| `height` | `number/string` | 组件高度 |
| `colorType` | `string` | 颜色类型 |
| `customColor` | `string[]` | 自定义颜色数组 |
| `drillDown` | `boolean` | 是否开启下钻 |
| `limit` | `number` | 数据条数限制 |
| `percent` | `boolean` | 是否显示百分比 |

---

## 1. YoushuSimpleIndicatorCard — 指标卡

展示 KPI 指标数据，支持多指标并排展示，适合数据大屏的核心指标展示场景。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `youshuData` | `object` | — | 数据模型对象（必填） |
| `settings` | `object` | `{}` | 组件配置项 |
| `settings.columnCount` | `number` | — | PC 端每行显示的指标数量 |
| `settings.columnCountForH5` | `number` | `2` | 移动端每行显示的指标数量 |
| `userSelectedFields` | `string[]` | — | 用户手动选择的字段 key 列表 |
| `enableFieldSelect` | `boolean` | `false` | 是否开启字段选择功能 |
| `_leaf` | `object` | — | 页面引擎叶子节点，用于判断模拟器设备类型 |
| `dataSetModelMap` | `object` | — | 数据集模型映射，包含 `kpi` 字段图标配置 |

### 数据字段结构（kpi 类型）

每个 KPI 字段对象包含以下属性：

| 字段 | 类型 | 说明 |
|---|---|---|
| `fieldKey` | `string` | 字段唯一标识 |
| `dataLink` | `object` | 数据链接配置 |
| `titleTip` | `string` | 标题提示文字 |
| `unit` | `string` | 数值单位（如：万、百万） |
| `desc` | `string` | 指标描述 |
| `icon` | `string` | 图标标识 |
| `hoverRef` | `string` | 悬停显示的参考值字段 |
| `hoverTitle` | `string` | 悬停显示的标题 |

### 渲染数据结构（getData 返回值）

```js
[
  {
    title: "指标名称",
    type: "NORMAL",           // 指标类型
    value: 12345,             // 指标值
    onValueLinkClick: null,   // 数据链接点击回调（无链接时为 null）
    tooltip: {
      show: false,            // 是否显示 tooltip
      reference: "参考值"     // tooltip 内容
    },
    hideMinus: false,         // 是否隐藏负号
    titleTip: "提示文字",
    unit: "万",
    desc: "描述文字"
  }
]
```

### 使用示例

```jsx
<YoushuSimpleIndicatorCard
  youshuData={youshuData}
  settings={{
    columnCount: 4,
    columnCountForH5: 2
  }}
  enableFieldSelect={false}
/>
```

---

## 2. YoushuCrossPivotTable — 交叉透视表

多维度交叉分析表格，支持行列维度自由组合，适合复杂数据的多维分析场景。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 表格标题 |
| `settings.height` | `number` | 表格高度 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |

### 特性

- 支持行维度、列维度、度量值的自由配置
- 支持数据下钻
- 支持导出为 Excel
- 支持固定表头

---

## 3. YoushuCalendarHeatmap — 日历热力图

以日历形式展示时间序列数据的热力分布，适合展示按日期分布的数据密度。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 热力颜色区间数组（从低到高） |

### 特性

- 以月/年为单位展示日历格子
- 颜色深浅代表数值大小
- 支持 tooltip 悬停查看具体数值

---

## 4. YoushuComboChart — 组合图

将柱状图与折线图组合展示，适合同时展示数量和趋势的场景。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 系列颜色数组 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |
| `settings.limit` | `number` | 数据条数限制 |

### 特性

- 左右双 Y 轴支持
- 柱状图与折线图自由组合
- 支持数据下钻与联动

---

## 5. YoushuFunnelChart — 漏斗图

展示流程各阶段的转化率，适合销售漏斗、用户转化等场景。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 各阶段颜色数组 |
| `settings.percent` | `boolean` | 是否显示转化率百分比 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |
| `settings.limit` | `number` | 数据条数限制 |

### 特性

- 支持转化率标注
- 支持自定义颜色
- 支持 tooltip 悬停

---

## 6. YoushuGauge — 仪表盘

以仪表盘形式展示单一指标的完成进度，适合 KPI 达成率等场景。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.min` | `number` | 最小值（默认 0） |
| `settings.max` | `number` | 最大值（默认 100） |
| `settings.range` | `number[]` | 区间范围配置 |
| `settings.color` | `string[]` | 区间颜色数组 |
| `settings.format` | `string` | 数值格式化 |

### 特性

- 支持自定义最大最小值
- 支持多色区间（红/黄/绿）
- 支持数值格式化显示

---

## 7. YoushuGroupedBarChart — 分组条形图

横向分组条形图，适合多维度对比分析场景。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 系列颜色数组 |
| `settings.isStack` | `boolean` | 是否堆叠显示 |
| `settings.isPercent` | `boolean` | 是否百分比堆叠 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |
| `settings.limit` | `number` | 数据条数限制 |
| `settings.showLabel` | `boolean` | 是否显示数据标签 |

### 特性

- 支持分组/堆叠/百分比堆叠三种模式
- 支持数据下钻
- 横向布局，适合长标签场景

---

## 8. YoushuHeatmap — 热力图

二维矩阵热力图，适合展示两个维度交叉的数值分布。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 热力颜色区间（从低到高） |
| `settings.drillDown` | `boolean` | 是否开启下钻 |

### 特性

- X 轴、Y 轴各取一个维度
- 颜色深浅代表数值大小
- 支持 tooltip 悬停查看具体值

---

## 9. YoushuLineChart — 折线图

展示数据随时间或类别的变化趋势，适合时序数据分析。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 系列颜色数组 |
| `settings.smooth` | `boolean` | 是否平滑曲线 |
| `settings.isStack` | `boolean` | 是否面积堆叠 |
| `settings.isPercent` | `boolean` | 是否百分比堆叠 |
| `settings.showLabel` | `boolean` | 是否显示数据标签 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |
| `settings.limit` | `number` | 数据条数限制 |
| `settings.lineWidth` | `number` | 线条宽度 |

### 特性

- 支持多系列折线
- 支持平滑曲线/折线切换
- 支持面积图模式
- 支持数据下钻与联动

---

## 10. YoushuPieChart — 饼图

展示各部分占整体的比例关系，支持饼图和环形图两种形态。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 各扇区颜色数组 |
| `settings.innerRadius` | `number` | 内半径比例（0~1），大于 0 时为环形图 |
| `settings.startAngle` | `number` | 起始角度（弧度） |
| `settings.endAngle` | `number` | 结束角度（弧度） |
| `settings.percent` | `boolean` | 是否显示百分比标签 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |
| `settings.limit` | `number` | 数据条数限制 |

### 特性

- 支持饼图/环形图切换（通过 `innerRadius` 控制）
- 支持自定义起止角度（半圆饼图等）
- 支持 statistic 中心文字（环形图）
- 支持数据下钻

---

## 11. YoushuRadarChart — 雷达图

多维度能力评估图，适合展示多个维度的综合评分。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 系列颜色数组 |
| `settings.max` | `number` | 各维度最大值 |
| `settings.opacity` | `number` | 填充区域透明度（0~1） |
| `settings.drillDown` | `boolean` | 是否开启下钻 |

### 特性

- 支持多系列对比
- 支持自定义各维度最大值
- 支持填充区域透明度调节

---

## 12. YoushuWordCloud — 词云图

以词云形式展示文本频率分布，适合关键词分析、舆情分析等场景。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 词语颜色数组 |
| `settings.drillDown` | `boolean` | 是否开启下钻 |
| `settings.limit` | `number` | 显示词语数量限制 |

### 特性

- 词语大小代表频率/权重
- 支持自定义颜色池
- 支持点击下钻

---

## 13. YoushuMap — 地图

地理数据可视化，支持省市区域着色，适合地域分布分析。

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `youshuData` | `object` | 数据模型对象（必填） |
| `settings` | `object` | 组件配置项 |
| `settings.title` | `string` | 图表标题 |
| `settings.height` | `number` | 图表高度 |
| `settings.color` | `string[]` | 区域颜色区间（从低到高） |
| `settings.drillDown` | `boolean` | 是否开启省市下钻 |

### 特性

- 支持全国/省级地图
- 颜色深浅代表数值大小
- 支持省市下钻
- 支持 tooltip 悬停

---

## 14. YoushuTopFilterContainer — 顶部筛选容器

页面级筛选器容器，管理多个筛选组件的联动与状态。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `componentId` | `string` | `null` | 组件唯一标识 |
| `style` | `object` | `null` | 容器样式 |
| `children` | `node` | — | 子筛选组件 |
| `config` | `array` | `[]` | 筛选配置数组 |
| `context` | `object` | — | 页面上下文 |
| `showTag` | `boolean` | `false` | 是否显示已选筛选标签 |
| `onFilterChange` | `function` | `() => {}` | 筛选值变化回调 |

### config 数组项结构

```js
[
  {
    componentId: "filter_001",     // 筛选组件 ID
    settings: {
      labelConfig: {
        label: "部门"              // 筛选标签名
      },
      mode: "single"              // 选择模式：single / multiple
    },
    dataSetModelMap: {
      "dataset_001": {
        valueField: ["dept_id"],   // 值字段
        labelField: ["dept_name"], // 显示字段
        cubeCodes: ["cube_001"]    // 数据集编码
      }
    }
  }
]
```

### onFilterChange 回调参数

```js
onFilterChange((filterValues) => {
  // filterValues: { [componentId]: value }
  console.log(filterValues);
})
```

---

## 16. DateField2 — 日期筛选器

日期范围选择筛选组件，支持多种日期格式和快捷选项。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `returnType` | `'string' \| 'timestamp' \| 'dayjs'` | `'string'` | 返回值类型 |
| `format` | `string` | — | 日期格式，如 `'YYYY-MM-DD'` |
| `hasClear` | `boolean` | — | 是否显示清除按钮 |
| `visible` | `boolean` | — | 受控显示/隐藏 |
| `defaultVisible` | `boolean` | — | 默认是否显示 |
| `onVisibleChange` | `function` | — | 显示状态变化回调 |
| `disabledDate` | `function \| object` | — | 禁用日期配置 |
| `resetTime` | `boolean` | — | 是否重置时间部分 |
| `defaultPanelValue` | `function` | — | 默认面板日期 |
| `onVisibleMonthChange` | `function` | — | 月份切换回调 |
| `defaultVisibleYear` | `function` | — | 默认显示年份 |
| `popupTriggerType` | `'click' \| 'hover'` | `'click'` | 弹出触发方式 |
| `popupAlign` | `string` | — | 弹出对齐方式 |
| `popupContainer` | `string \| function` | — | 弹出容器 |
| `popupStyle` | `object` | — | 弹出层样式 |
| `popupClassName` | `string` | — | 弹出层类名 |
| `popupProps` | `object` | — | 弹出层额外属性 |
| `followTrigger` | `boolean` | — | 弹出层是否跟随触发元素 |
| `inputProps` | `object` | — | 输入框属性 |
| `dateCellRender` | `function` | — | 自定义日期格子渲染 |
| `monthCellRender` | `function` | — | 自定义月份格子渲染 |
| `yearCellRender` | `function` | — | 自定义年份格子渲染 |
| `onOk` | `function` | — | 确认按钮回调 |
| `extraFooterRender` | `function` | — | 底部额外内容渲染 |

### 内置快捷选项

- 今天
- 本月至今
- 最近 3 天
- 最近 7 天
- 最近 30 天
- 当前项

### 使用示例

```jsx
<DateField2
  returnType="string"
  format="YYYY-MM-DD"
  hasClear={true}
  onOk={(value) => {
    console.log('选中日期:', value);
  }}
/>
```

---

## 16. CascadeDateField2 — 级联日期筛选器

支持开始/结束日期级联选择的日期范围筛选组件，Props 与 `DateField2` 基本一致，额外支持日期范围联动校验。

---

## 通用交互特性

### 数据下钻（drillDown）

当 `settings.drillDown = true` 时，点击图表元素可下钻到下一层级数据。

### 图表联动（linkage）

多个图表组件可通过 `YoushuTopFilterContainer` 实现联动筛选，点击一个图表的数据点，其他图表自动过滤展示相关数据。

### 导出功能

所有图表组件支持：
- **复制为图片**：将图表复制到剪贴板
- **导出数据**：导出为 Excel 文件（需配置导出权限）

### 演示模式

页面支持演示模式（`settings.演示模式`），在演示模式下隐藏敏感数据。

### 自动刷新

通过 `settings.refreshInterval` 配置自动刷新间隔（毫秒），实现数据实时更新。

### 暗色主题

通过 `settings.colorType` 配置颜色主题，支持以下暗色系：
- `dark-color-1` 至 `dark-color-7`

---

## 错误处理

所有组件内置错误边界，当组件渲染异常时显示：

> 组件渲染异常，请查看控制台日志

同时支持：
- **进入调试**：打开调试面板
- **异常上报**：上报错误信息

---

## 数据为空时的展示

当数据源无数据时，所有图表组件统一显示：

> 暂无数据

---

## 加载状态

数据加载中时，所有图表组件统一显示：

> 加载中...

并提供 **刷新** 按钮供手动重试。
