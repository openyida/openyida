# 可编程分析卡片：设计、运行与验收

适用于报表里的 `YoushuAnalysisCard`、普通自定义页里的 `YidaAnalysisCard`，以及 AI 画布中的组合。卡片是可编辑 React 内容，不是固定的 bar/donut/kpi 枚举。数据与权限由平台提供，设计由源码控制。

## 分层

- 平台层：应用上下文、服务端聚合、分页明细、权限、取消过期请求、原生报表筛选与下钻。
- 运行层：复用 CodeCanvas 的固定版本依赖资源；React 实例必须与渲染器一致。只加载实际导入的库，缓存并发加载，失败可重试。不能给每张卡插入一套 CDN script。
- 设计层：OpenYida 输出可读 JSX 模板；模板随页面保存，不能把大型业务模板作为转义字符串堆进 yida-ui，也不能把未固定版本的远程模板当运行依赖。
- 宿主层：报表、独立组件、AI 画布只适配数据与事件，不分别维护一套业务 UI。原生报表配置和独立 query 两条链路分别验收。

## 独立查询接口

不依赖报表页面的筛选、分页、受限公式、日期粒度、缓存、异步轮询与服务端 CSV 导出，按 [独立查询 API](independent-query-api.md) 编写。先核对目标环境 capabilities 与宿主 API，区分 V1 Hook 和 V2 全码调用。

## 先选叙事，再选图形

| 页面 | 主卡片 | 配套卡片 | 主要交互 |
| --- | --- | --- | --- |
| 经营总览 | 大数字与预算结构 | 分组排行、构成环图、精确表格 | 选择分组联动、刷新、CSV、下钻 |
| 趋势探索 | 面积/柱线图和时间选区 | 最新周期值、最高周期、选区明细 | Brush、图表 Tab、时间范围回写服务端过滤 |
| 结构比较 | 水平对比条与选中项详情 | 份额、分布、指标切换 | 图表双向选择、清除选择、分页明细 |
| 经营报告 | 结论先行的组合图 | 关键指标、解释与数据表 | 图表/表格切换、下载图形、原生下钻 |

不为“丰富”塞入无意义图表。每张卡回答一个问题，卡内图表可组合，跨卡联动必须有明确共享筛选状态。

## 页面、卡片与数据集的边界

- 页面拥有布局和跨卡筛选状态；一个页面由多个独立可编程卡片实例组成，禁止把整页标题、全局筛选、全部图表打包成一个巨型卡片。
- 一张卡片回答一个问题，内部可组合 1–3 个相关图表。报表中每张卡是独立 `YoushuAnalysisCard` 节点，拥有唯一 cid/fieldId、自己的 dataSetModelMap 和 renderCard；Canvas 中每个分析区块独立挂载 Host/query/source。仅在同一渲染函数内画几个面板不算多个卡片实例。
- 不同卡片可以绑定不同源表/数据集与指标口径；不得把第一张卡的 rows/columns 默认传给所有卡。源码使用本卡片的字段别名、单位和格式；不要靠数组第一列猜业务含义。
- 跨卡关联显式声明源维度→目标字段映射；目标数据集没有该字段时显示不适用，禁止拼入无效条件或把两个不同口径总量相加。单卡刷新、错误、下钻和返回独立；页面全局筛选只作用明确登记的卡片。
- 有源码时不提供表格/排行/环形的“展示形式”选择器；图形由源码控制。历史无源码卡片可以保留旧 view 作为兼容数据，但不能让失效选项误导用户。
- 卡片服从宿主宽高，根节点 `width/max-width:100%; min-width:0; box-sizing:border-box`，内部使用容器响应式布局；不要用 100vw/100vh、页面固定宽度或整页 padding。长表在卡片内部滚动，整页由页面负责滚动。原生网格缩放时按实际卡宽重新排版，不只监听浏览器宽度。
- 验收必须包含同页至少两张独立卡、两个真实数据集、单卡刷新/切换数据互不串扰、窄卡与横向缩放。设计器数据面板、源码、实际查询和渲染标题/单位必须一一对应。

## 多页面差异与分析闭环

丰富度取决于可解释的信息与分析路径，不以图表、卡片或颜色数量计分。生成前逐页写清：用户问题、数据粒度、主结论、比较基准、下一步动作；没有证据的目标、同比、异常和项目状态不得补造。业务线×月份汇总源记录不能标成项目明细。

用户要求多种风格的实验室时，先写差异矩阵再编码。以下是可编辑组合方向，不是固定整页模板：

| 分析任务 | 构图与组件 | 视觉方向 | 可发现的交互 |
| --- | --- | --- | --- |
| 经营简报 | 非对称开放数字、执行带、结论旁注 | 暖纸、葡萄色、黄铜；报刊字级、轻边界 | 每条业务显式“分析业务线”，展开月份与源记录 |
| 预算对账 | 预算/实际对比点图、差额贡献、对账表 | 白灰、墨色、陶橙；刻度、方角、紧凑密度 | 排序、月度下钻、导出当前结果 |
| 时间探索 | 主导双系列趋势、Brush、月份索引 | 深紫、薰衣草、青柠；大图与时间节奏 | 可见拖拽条、范围提示、业务筛选、月份明细 |
| 数据工作台 | 筛选侧栏、精确金额、分页表与详情 | 冷白、灰蓝；小圆角、紧凑控件 | 条件标签、清空、分页、记录详情 |

允许实验页显式使用不同局部主题；作用域限制在页面根节点，不覆盖全局品牌。普通同一业务应用仍保持设计一致。不同页面至少在主图形、构图、信息密度或操作方式上形成可观察差异；仅改背景、图标、标题而重复“指标行＋柱图＋环图”不通过。页面图标按任务选择并读回导航配置，不能默认全部用页面图标。

每个可点击图元必须有等效文字入口。下钻显示当前位置、下一层与返回；点击后不能只高亮，必须改变层级或打开对应记录。跨卡分析由父级持有共享筛选，所有受影响的查询都消费它：

```jsx
const filters = business ? [{ field: businessField, op: 'eq', values: [business] }] : [];
// 下游 Host query.filters = filters；明细再叠加被选月份。
// 更换业务线时清空月份、分页、时间选区和旧记录。
```

区别三种动作：选中高亮、裁剪当前结果、服务端重查；界面说明真实范围。局部 Brush 不能宣称查询全库。合计仅汇总可加总指标；各月项目统计之和不能称为去重项目数。预算减支出叫预算差额，缺少业务依据时不称节省、超期或风险。

专用明细接口尚不可用时，可在 Canvas 中明确使用 `yida-canvas-data-binding` 的已验证表单数据桥；按真实字段转换条件、服务端分页并保留访问者权限。不能改用管理员导出的数据填充页面，也不能把接口失败隐藏为空数据。明确记录使用的链路，不宣称专用卡片明细接口已验收。

多页面交付分别核对首屏、主问题、数据口径与图标；至少真实走通一次“业务线 → 月份 → 源记录 → 返回”，一次跨卡筛选，一次清空恢复，一次分页或导出。截图必须呈现可比较的不同构图，并单独保存交互状态证据。组件模板继续以指标、图形、筛选与动作插槽为复用单位；业务页面只做组合示例。

## 指标与视觉

### 组件优先，页面只是组合示例

独立图表组件模板放在 `lib/samples/yida-custom-chart-comp`，整页和组合示例使用 `openyida-page-template`。用 `openyida sample yida-custom-chart-comp analysis-metric` 提取单个指标卡，用 `openyida sample yida-custom-chart-comp analysis-chart` 提取单个图表组件。复制进组合源码时将默认 `YidaComp` 分别重命名为 `MetricCard`、`AnalysisChart`，合并 import，最终只保留一个页面或卡片入口。模板由 CLI 提取源码后在编辑阶段组合。

| 组件 | 数据与展示参数 | 交互参数 |
| --- | --- | --- |
| 指标卡 | `title, value, unit, note`；可选真实 `delta`（小数比率）、`target`；`emphasis` 主指标强调 | `actions` 插槽、`onRetry`；loading/error；没有指标时显示 — |
| 趋势图 | `kind="trend"`；`rows, labelKey, valueKey`；时间升序、同一粒度 | 带缩略图的 Brush；受控 `range`/`onRangeChange(window, visibleRows)`；`null` 表示全区间 |
| 排行图 | `kind="ranking"`；服务端已排序分组结果 | `selectedKey`/`onSelect(rawRow)`；父级决定联动、下钻或明细 |
| 环形图 | `kind="donut"`；仅非负、非全零、可比较的份额 | 与排行共享 `selectedKey` 和原始行回调；不会自行拉数据 |

上述指标与轻量图表组件都有 `appearance="light|dark"`、`style`、loading/error；图表有 `height`、`onRefresh` 和 `actions`。类型只是起始源码，生成后可以替换图形、增加系列、SVG、Tab 和布局，不受枚举限制。下载/全量导出由动作插槽接入已验证能力，不预置无实现按钮。

```jsx
<MetricCard title="预算" value={budgetResult} unit="元" emphasis note="当前查询范围" />
<AnalysisChart kind="trend" rows={monthlyRows} labelKey="month" valueKey="budget"
  range={range} onRangeChange={(next, visible) => { setRange(next); setVisibleRows(visible); }} />
<AnalysisChart kind="ranking" rows={businessRows} labelKey="business" valueKey="budget"
  selectedKey={selection?.business} onSelect={setSelection} />
```

父级在数据源/指标/时间粒度变化时重置受控 range 和 selection；联动跨不同粒度需要转换，不可共享索引硬套。组件只展示已授权聚合结果；服务端筛选、鉴权和下钻仍由 `analysis.api`/宿主提供。

### 卡片操作层级

- 刷新等通用操作用右上角弱化图标，图标约 16px、点击区域至少 30–32px；触屏按需扩大至 44px。图标有可访问名称、悬停/键盘焦点提示、禁用与加载态。
- 图表/数据表使用紧凑分段切换，保持选中态；卡片没有第二种视图时不放切换。低频导出/下载放入更多菜单，只提供已接通的动作。
- 下钻由图形点击触发，并提供语义明确的文字入口；当前层级与返回路径始终可发现。错误重试和关键业务操作保留文字，不将所有动作机械地替换为图标。
- 图标优先使用宿主已有图标库。报表卡片可内联带来源与许可证的标准图标 SVG。普通工具栏与标题、图例和主要数据保持视觉层级。

### 图表组件库与数据契约

`openyida sample yida-custom-chart-comp analysis-echarts` 提取可编辑的高级图表组件。重命名默认组件为 `AdvancedChart`；`analysisChartOption(kind, data, config)` 只生成 option，不查询数据、不规定平台展示枚举。可以完全绕过配方传入自定义 option。指标卡继续用 `analysis-metric`，常规轻量图用 `analysis-chart`。

| 配方 | 必需数据 | 适合表达 |
| --- | --- | --- |
| line / area / bar | name + 指标；config.measures 定义多系列 | 趋势、量级、比较 |
| stacked-area / stacked-bar | 同单位且可相加的系列 | 构成变化；预算与支出不可直接叠加 |
| pie / donut / rose | name/value，非负、同口径 | 部分占整体；全零用空态 |
| radar | indicators(name/max) + series(name/values) | 多维轮廓；统一量程或明确归一化依据 |
| scatter / bubble | name/x/y；气泡另有非负 size | 关系、聚类；不暗示因果 |
| heatmap | x/y 分类 + cells[x索引,y索引,值] | 时间×类别的密度分布 |
| boxplot | name/values[下须,Q1,中位数,Q3,上须]，可配 outliers | 分布；声明样本范围、分位算法与须规则 |
| wordcloud | name/value，明确是词频还是业务权重 | 关键词概览；不拿词云替代精确排行 |
| treemap / sunburst | name/value/children 层级树 | 层级构成；不得虚构父子关系 |
| funnel | 同一转化链路按阶段排列的非递增人数 | 转化；分类排行不是漏斗 |
| sankey | nodes(name) + links(source/target/value) | 有依据的流向，核对流量守恒 |
| gauge | value 为0–100、name | 有明确分母的百分比进度 |

数据由每卡 Host/query 或原生 analysis 独立传入；库只负责绘图，权限和业务查询继续留在平台。有真实聚合数据即可使用高级图表，不要求为了换图形再建报表。数据不满足契约时说明缺失；实验室演示数据单独分区标记，不掺入业务合计。箱型图需要服务端五数摘要或明确授权的完整样本，禁止用分页片段/几个汇总值猜分位数。

在可编程卡片和 CodeCanvas 中使用 `import * as echarts from 'echarts'`。词云另加 `import 'echarts-wordcloud'`。完整高级组件示例包含词云配方和这条导入。组件运行时根据导入加载 ECharts 5.6.0 和词云扩展，同一页面的卡片共享资源，资源加载错误由运行时展示。

组件支持 ResizeObserver、卸载 dispose、点击回传原始行、dataZoom 回调、loading/error/empty 和动作插槽。点击回调由父级接入关联/下钻，图表库不会自动查询。option 用 useMemo 保持稳定；父级主题变更时提供实际颜色值，Canvas 图表不能直接消费 CSS var。正式交付逐图核对标题、单位、图例、原始数据及交互，不以“图形出现”代替数据验收。

组合时保留模板中的 ECharts import 和 `analysisChartOption`，合并 React import，默认导出改名后再写本卡业务适配层。例如已核实查询别名为 `business/budget`：

```jsx
function BudgetCard({ analysis }) {
  const option = useMemo(() => analysisChartOption('pie', analysis.rows.map(row => ({
    name: row.business, value: row.budget, raw: row,
  }))), [analysis.rows]);
  return <AdvancedChart title="业务线预算构成" note="当前查询范围 · 元"
    option={option} loading={analysis.loading} error={analysis.error}
    empty={!analysis.rows.length} onRefresh={analysis.refresh}
    onSelect={analysis.canDrill ? row => analysis.select(row) : undefined} />;
}
// 每个区块独立 Host；外包一个 min-width:0 的布局节点，防止 renderContent
// 返回 Fragment 时多个子元素直接进入父级 Grid、错占相邻卡片的格位。
<div style={{ minWidth: 0 }}>
  <Host query={budgetQuery} renderContent={a => <BudgetCard analysis={a} />} />
</div>
```

图元回调有等效文字/键盘入口，且仅在支持下钻时调用 `select`；仅做关联时接页面共享筛选。时间必须按实际日期值或服务端时间字段排序，不能对 ISO 日期字符串直接 `Number()` 后排序。缺数值不填零，预算与支出不能堆叠成总额。复杂图形模板是组件起点，不是把所有配方同时塞进一张业务卡。

参考：[ECharts 数据变换](https://echarts.apache.org/handbook/en/concepts/data-transform/)、[ECharts 词云扩展](https://github.com/ecomfe/echarts-wordcloud)。

### 颜色与圆角基线

- 浅色经营分析：浅灰绿画布、白色图表面、青绿主色、暖橙辅助色；深色趋势分析：藏蓝画布、稍亮藏蓝面、青蓝主色、琥珀辅助色。主指标可用低跨度渐变与原创低透明度几何 SVG，不复制参考站点图片。
- 层级用背景和留白形成：卡片 12px、组合区 16px、控件 6–8px、柱端 4px；卡间 16px、内边距 22–24px。避免整页大白框内再嵌多层边框；圆角不随卡片尺寸无限放大。
- 每个组件可通过 `--analysis-accent/surface/ink/muted/line/radius` 覆盖，主指标还可设 `--analysis-hero-start/end`。默认浅色继承平台 token，深色是显式选择；不得覆盖应用全局变量。系列按原始分组保持颜色，图、图例、选中态一致。
- 深色必须一起调整 tooltip、轴文字、网格、Brush 背景、原生 select 和焦点态；不能只改容器背景。装饰不表达虚构数据。

### ECharts 与 Recharts 的时间选区

网页默认复用运行时 Recharts，使用组件模板中的 Brush 缩略图、双端手柄和受控范围。ECharts 对应 `dataZoom` 的 `slider`（可见拖拽条）和 `inside`（图内缩放）；已有 ECharts 宿主可将以下配置合入 option：

```js
dataZoom: [
  { id: 'window', type: 'slider', xAxisIndex: 0, height: 32, bottom: 12,
    showDataShadow: true, start: 0, end: 100, brushSelect: false },
  { type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
],
grid: { left: 56, right: 24, top: 36, bottom: 88 }
```

从 `datazoom` 事件或 `getOption().dataZoom` 读取边界，再映射真实时间值；只在需要跨范围查询时防抖回写服务端 filters。销毁时解除监听与 dispose；普通更新不重建实例。ECharts Canvas 渲染器不识别 CSS `var()`，先用 `getComputedStyle` 解析颜色。复用已核实的宿主 CDN 加载器并固定版本，不逐卡插 script。`@wuba/react-native-echarts` 是原生移动端适配，宜搭 Web 不安装 Skia/react-native-svg，也不把它称作 Recharts。

参考：[Recharts Brush](https://recharts.github.io/en-US/api/Brush/)、[React Native ECharts](https://github.com/wuba/react-native-echarts)。上述 ECharts option 是复用配方，当前富交互预发样例使用 Recharts；不能把配方写入当作 ECharts 运行验收通过。

- 指标有大数字、单位、口径、时间范围和状态；有真实目标时提供进度，有真实历史时提供 sparkline/同比。没有历史或目标不得伪造增幅、目标达成率或趋势。
- 同一指标行统一尺寸与字级，主指标可用跨列强调；页面通过分组、开放留白、轻边界和主次比例形成层次，不用四个空白大盒子代替设计。
- 金额/数量紧凑显示，tooltip 与表格保留精确值；数值右对齐、tabular-nums。均值、比率和去重计数不能跨分组直接求和；模板的合计/份额仅适用于可加总指标。百分比明确分母，Top N/当前选区之和不能称为全量总额。
- 颜色继承应用 token。图表系列优先读取 `--color-group`；图形、文字、边界和控件分角色。装饰 SVG 使用 currentColor/主题变量、低透明度、aria-hidden、pointer-events:none；不得遮挡内容或伪装成数据。
- 容器宽度决定重排，窄卡隐藏次要说明但保留指标、筛选、状态和主操作。装饰与动效服从 prefers-reduced-motion。

## 动作契约

| 操作 | 实现与范围 | 必验 |
| --- | --- | --- |
| 刷新 | `analysis.refresh()`，刷新过程中标注旧数据，禁止重复提交 | 请求失败可重试，更新时间只在成功后变化 |
| Tab | 受控状态切换同一份数据的图形/表格；切指标时更新轴与单位 | 切回保留筛选和选择 |
| 联动 | 主组件拥有 selection；所有关联图、表、摘要消费同一派生结果 | 任一图选择、另一图响应；清除恢复 |
| 下钻 | 仅在存在下一层钻取维度时显示入口，`analysis.select(rawRow)`，`analysis.back(depth)`；传原始行 | 真实路径、回退、权限与过滤条件正确 |
| 明细 | 已提供的 `analysis.details(rawRow)` 或 `analysis.api.queryDetails` | 真实源表、字段与分页；不把聚合行当明细 |
| 时间拖拽 | 时间字段升序、明确粒度；Brush 可先裁剪已返回区间 | 图表 data 引用保持稳定，避免每次拖动因重新构造数组而重置选区。局部缩放注明当前结果；跨时间查询需把边界写回服务端 filters，不能宣称局部裁剪查询了全库 |
| CSV 导出 | 仅导出用户当前有权看到的结果；按钮命名“导出当前结果” | UTF-8 BOM、引号/换行转义、公式注入防护、真实下载文件 |
| 图形下载 | 导出实际渲染 SVG；需完整卡片 PNG 时使用已验证截图能力 | 保留主题样式，排除操作按钮；不以 SVG 冒充 PNG |
| 全量导出 | 平台有已验证服务接口时才开放 | 后端权限、分页/上限与异步任务状态；未接入时不放假按钮 |

`analysis.api.useQuery` 必须在函数组件顶层调用。独立查询不会自动继承报表过滤；共享筛选需要显式转换。多个数据源不同口径时，不把局部过滤当跨源服务端联动。

## 生成与验收

基础内容：`openyida sample openyida-page-template analysis-card-content`。富交互内容：`openyida sample openyida-page-template analysis-card-explorer`。内容可放入报表 `renderCard.source`；Canvas 使用 `YidaAnalysisCard` 的 `renderContent`，独立组件保存 source/runtimeCode，均保留完整源码自由。

交付至少检查正常、加载、空、错误、负值、零值、长名称；操作用真实事件验证。外部浏览器宽屏检查完整内容，再检查窄屏。发布读回、浏览器渲染、交互成功是三项独立证据。示例数据必须显著标注，不能展示为实际经营数据。

设计依据：吸收 dingtalk-ai-app 的 web-app-dashboard-ui-design / frontend-design 中 DashboardCard 动作槽、MetricTrendCard、Brush、四态与组合联动，以及 ai-app-skills 的 dashboard-layout/warm-dashboard 的层级与材质经验；这里只迁移设计原则，不能引用那些项目私有组件或未经 OpenYida 验证的 Hook/Props。


### 统一主题样式与设置器

每张卡片保留自己的数据配置。自定义页面通过数据集、字段选择器配置查询；报表继续使用原生分组、指标、筛选和公式设置器。报表源码入口在「其他 → 高级功能 → 卡片源码」，位于「返回数据处理」之前。编辑源码不改变数据集配置。

宿主提供 `analysis.appearance` 时，将它传给复用组件的 `cardAppearance`：

```jsx
<AdvancedChart option={option} cardAppearance={analysis.appearance} />
<AnalysisChart rows={rows} cardAppearance={analysis.appearance} />
<MetricCard value={total} cardAppearance={analysis.appearance} />
```

`cardAppearance` 与组件原有 `appearance="light|dark"` 风格参数分开。卡片根节点使用 `analysis.appearance?.cardStyle`；自写 HTML 图例使用 `legendMarkerStyle` 和 `legendTextStyle`；ECharts 图例使用 `echartsLegend`，保留原来的位置、选择状态及联动事件。组件的 `style` 可显式覆盖卡片样式，使用前说明它优先于设置器。

样式设置包含卡片背景、卡片圆角、图例字号、标记大小与标记圆角。每项复用设计器的 `ThemeTokenSetter`，提供「跟随主题 / 自定义」切换。`null` 或未设置表示跟随主题；切到自定义时读取当前主题值作为初值，之后保存字面值；切回主题保存 `null`。不要另造模式字段或用“清空输入框”替代模式切换。图例配置只影响实际存在的图例，不替代图表内的数据标记或整张卡片圆角。

旧宿主没有 `analysis.appearance` 时保留原有样式。更新既有源码时接入上述参数并验证效果，不只添加设置器入口。验收至少包括主题切换、单卡覆盖与恢复、两张卡片设置互不影响、图例点击与下钻仍可用，以及更换数据集后重新配置分组和指标。
