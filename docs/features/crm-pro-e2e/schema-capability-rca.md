# CRM PRO Schema → OpenYida 能力根因分析

> 目标：从参照 CRM PRO 与冷启动应用的真实 Schema 差异，反推 OpenYida 技能和 CLI 的能力缺口。本文不把 CRM 交付质量问题直接改写成测试规则，也不以“多造数据 / 多建图表 / 多建自动化”作为根因。

## 1. 结论

冷启动应用资源数量接近目标，但语义完整度不足，核心原因不是缺少三个验收项，而是三类 Schema 没有完整进入“读取 → 规划 → 写入 → 回读”链路：

| Schema 域 | 参照应用事实 | 当前 OpenYida 断点 | 直接影响的技能 / CLI |
| --- | --- | --- | --- |
| 表单行为 Schema | 客户表除了字段外还有生命周期动作、URL 参数分支、默认赋值、只读联动；多个工作台还有 dataSource 与动作函数 | `get-schema --field-map-json` 主要暴露字段身份；agent 反向设计时看不到行为摘要，虽有 `actions-module` 写入能力也不会规划使用 | `yida-get-schema`、`yida-create-form-page`、`yida-app`；`openyida get-schema` |
| 集成自动化 Schema | 11 条表单事件、1 条定时、6 条手动/卡片触发；包含字段变化、审批完成、更新其他表单和阶段推进 | `integration list` 固定 `flowTypes: ['1']`，创建器固定 `FormEvent`；CLI 只能看到并创建表单事件子集 | `yida-integration`、`yida-app`；`openyida integration list/create` |
| 报表 Schema | 19 个原生报表使用指标卡、表格、漏斗、地图、日历热力图、多 cube 和子表 cube | CLI 模板里已有 `YoushuMap` / `YoushuCalendarHeatmap`，但 capability registry 未注册，校验层会拒绝；技能只能退化到基础柱/饼图 | `yida-report`、`yida-app`；`openyida create-report/report append` |

## 2. 表单行为 Schema 根因

### 2.1 Schema 证据

参照应用“客户”表的 `actions.module.source` 不是空模板。其 `didMount` 至少表达了以下业务行为：

- `urlParams.type === "my"` 时自动写入当前用户为负责人，并将负责人设为只读；
- 自动把客户状态设为“已分配”，写入领取时间；
- URL 携带客户名时自动回填客户名称并设为只读；
- 从线索转化进入时设置操作类型；
- 公海入口进入时锁定负责人和所属部门。

冷启动应用的对应表单只有 OpenYida 默认动作与主题注入，没有这些业务动作。字段数量差异只是表象；即使补齐字段，领取、转化、公海等业务仍无法成立。

### 2.2 CLI 根因

`openyida get-schema --field-map-json` 当前摘要包含字段名称、类型、fieldId、选项、required/defaultValue 等，但没有输出：

- 生命周期和字段事件绑定；
- 动作函数名、引用字段和 URL 参数；
- 公式、条件校验、行为切换；
- 关联表单/回填关系与远程数据源的语义摘要。

完整原始 Schema 实际包含这些信息；问题是 CLI 没有提供适合 agent 消费的稳定语义 contract。与此同时，`create-form patch` 已支持 `actions-module`、`bind-field-action`、`bind-datasource`，所以“写不进去”并不是第一根因，“读不懂并规划不到”才是。

### 2.3 对应优化

1. `openyida get-schema` 增加语义分析输出（建议 `--analysis-json`），在不回显整段源码的前提下输出 behavior/action/dataSource/formula/association 摘要及 schema hash。
2. `yida-get-schema` 在“复刻/迁移/分析已有应用”场景要求读取语义分析，而非只读 field map。
3. `yida-app` 的表单阶段把“字段结构”和“行为结构”分开规划；存在行为 Schema 时调用 `yida-create-form-page` 的高级 patch 能力，并在写后回读动作绑定。

## 3. 集成自动化 Schema 根因

### 3.1 Schema 证据

管理端只读核验显示：

- 表单事件触发：11；
- 定时触发：1（销售简报，工作日触发）；
- 手动触发：6（线索/客户领取、商机阶段推进等，其中包含卡片手动触发）；
- 表单事件内部还包括“指定字段变化”和“审批完成事件”，并非全是表单创建通知。

冷启动应用只有 6 条表单创建后的消息通知，业务动作被降级成了通知动作。

### 3.2 CLI 根因

- `lib/integration/integration-list.js` 明确固定 `flowTypes: ['1']`，因此把 18 条自动化读成 11 条；
- `integration-create` 的绑定与流程构建固定使用 `type: '1'` / `triggerType: 'FormEvent'`；
- list 输出没有稳定的 `flowType`，detail/readback 也没有面向 agent 的完整 trigger + node graph 摘要。

这意味着 agent 即使严格按技能执行，也无法先获得完整自动化资产图，更无法等价创建定时和手动/卡片触发流程。

### 3.3 对应优化

1. `integration list` 默认枚举平台已知类型 `1,2,3,5,6`，允许 `--flow-types` 显式过滤，并为每条结果返回 `flowType`。
2. 增加自动化 detail 的语义 contract：trigger 类型/事件、节点类型、关键输入输出、分支与发布状态；避免只靠“名称存在”判断等价。
3. 在获得平台保存协议证据后，再扩展 `integration create --spec` 支持定时与手动/卡片触发；未支持前必须返回精确 capability gap，不得退化成通知并声称完成。
4. `yida-integration` / `yida-app` 根据 PRD 动词区分通知、更新数据、创建数据、审批完成、定时汇总、手动阶段推进，不能把所有自动化统一路由成 `--events insert` 通知。

## 4. 报表 Schema 根因

### 4.1 Schema 证据

参照报表 Schema 已确认存在：

- `YoushuMap`：订单量按省/市/区地址层级展示；
- `YoushuCalendarHeatmap`：日期字段（日粒度）+ 实例计数；
- `YoushuSimpleIndicatorCard`、漏斗、表格和多图布局；
- 多 cube 及合同订单产品子表 cube。

冷启动报表只有 3 个基础图表（两个分组柱图和一个饼图），并未表达地图、订单日历和复杂数据集关系。

### 4.2 CLI 根因

`lib/report/schema-template.js` 已有地图和日历热力图组件模板，但 `lib/report/capability-registry.js` 只开放 bar/combo/funnel/gauge/indicator/line/pie/pivot/table。校验和 chart builder 以 registry 为准，因此 map/calendar heatmap 会在本地被拒绝。

这属于 CLI 能力注册与已有 Schema 构造实现不一致，不是简单的 CRM 图表数量不足。

### 4.3 对应优化

1. 以参照 Schema 的字段角色为基线，为 `map` 和 `calendarHeatmap` 补齐 capability：
   - map：地址层级维度 + 数值指标；
   - calendar heatmap：日期维度（DAY）+ 数值指标。
2. chart builder 生成与参照一致的 `chartData`、`dataViewQueryModel` 和字段角色，不只把空组件模板放进页面。
3. report inspect 输出 cube、子表 cube、字段角色和组件能力摘要，让 `yida-report` 能从已有报表反向生成配置。
4. `yida-report` / `yida-app` 发现 PRD 中有地域分布、订单日历、子表明细时，优先路由到对应原生图表能力；只有 CLI 明确不支持时才降级并报告。

## 5. 本轮已实现与真实验证

### 5.1 表单行为读取链

- CLI 已增加 `get-schema --analysis-json`，输出 `yida_schema_semantic_analysis` v1；它只输出动作/字段行为摘要和 hash，不泄露完整动作源码。
- 真实回读对比：参照客户表 30 个字段、`actions.module.source` 1950 bytes、1 个 `didMount`、4 个 URL 参数、8 次字段 mutation（覆盖 6 个字段）、1 条关联规则；冷启动客户表 18 个字段，虽因主题注入达到 11902 bytes，但 URL 参数、字段 mutation、关联规则均为 0。由此可确定缺口是业务行为 Schema，而不是源码体积或单纯字段数量。
- `yida-get-schema` 已要求复刻/迁移场景消费该 contract；`yida-app` 已要求把字段结构和行为结构分开规划，并路由到 `yida-create-form-page` 的 actions/dataSource patch。
- 尚未完成：自动把语义摘要反编译为可直接写入的 `actions-module` spec。当前优化先解决“agent 看不见行为、因此不会规划”的根因。

### 5.2 自动化全类型读取链

- `integration list` 已从固定 `flowTypes=['1']` 改为默认枚举 `1,2,3,5,6`，支持 `--flow-types` 筛选，并为每条结果返回 `flowType`。
- 真实参照应用回读为 18 条：`flowType=1` 11 条、`flowType=3` 1 条、`flowType=5` 6 条，与管理端的表单事件/定时/手动三个页签一致；修复前 CLI 只能返回前 11 条。
- `yida-integration` 已明确区分“读取全量”和“当前 create 只支持表单事件”：遇到定时或手动/卡片触发必须报告 capability gap，不能改造成通知并声称完成；`yida-app` 同步禁止这种语义降级。
- 尚未完成：`integration create --spec` 对 `flowType=3/5` 的保存协议。需要继续从真实逻辑流 detail/graph Schema 提取稳定触发器 contract 后实现，不能凭 UI 名称猜 payload。

### 5.3 地图/日历报表写入链

- capability registry、数据模型和 chart builder 已接入 `map -> YoushuMap`、`calendarHeatmap -> YoushuCalendarHeatmap`，并按参考 Schema 构建地域层级/数值和日期 DAY/数值字段角色。
- 日历热力图已真实写入测试应用报表并回读：数据源 `FORM_CFEBAEC890D94466A10D19FC10B6424FGZJQ`，横轴 `dateField_lx415yk4p`、粒度 `DAY`，纵轴 `pid`、聚合 `COUNT`，布局项存在。
- 真实写入还发现并修复了 `append-chart` 保存契约 bug：平台会省略 Youshu 图表中值为 `null` 的 `height`、`exportData.filterList`、`exportData.exportPromptFilter`；CLI 原先把这种平台规范化误判为 `REPORT_SCHEMA_READBACK_MISMATCH`。现在保存前按平台真实行为规范化，同时仍严格核对组件、字段绑定、聚合和布局。
- 地图 builder 已通过参考 Schema 对照和单元/schema 构造测试；当前测试应用没有地址字段，因此没有伪造一个无业务意义的地址表单来冒充平台 E2E。后续应在包含真实地址字段的可写样本应用验证地图运行态。

## 6. 后续实施顺序

1. 先修只读完整性：自动化全类型 list、表单语义 analysis、报表 inspect 语义摘要。
2. 再修已有写入能力的编排：表单 actions/dataSource 与复杂表单事件自动化。
3. 最后扩展平台写协议：定时/手动触发、地图/日历热力图完整 builder。

每一步的验证必须是“读取真实参照 Schema → 生成结构化 contract → 在测试应用写入 → 再读取并做语义 diff”。数量只能作为资源清单证据，不能替代语义等价证明。
