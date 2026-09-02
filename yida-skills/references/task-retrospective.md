# 任务复盘与沉淀规范

OpenYida 任务完成后，除了交付当前结果，还要判断是否有可复用经验需要落盘到 CLI、测试或 skill。目标是让下一次类似任务更少踩坑，而不是只把本次问题修好。

## 何时必须沉淀

以下情况出现任一项，就必须做一次沉淀判断：

- 用户多次纠正同一类问题，例如“要参考 Dribbble”“颜色不好”“不像产品首页”“内容不丰富”“导航没覆盖”。
- 平台接口出现“回包成功但实际未生效”、字段名和错误文案不一致、需要通过线上回读才确认的行为。
- 发现 `openyida` CLI 缺少参数校验、命令链路、测试覆盖或错误提示。
- 新增或改造了页面生成器、页面骨架或通用页面能力，且经验会影响同类页面质量。
- 发布线上页面后，需要固定验收方法，例如 `get-schema` 回读、运行态样式检查、主题变量检查。
- 任务中使用了一次性脚本绕过问题，而这个绕过可以变成 CLI 能力或测试。

## 沉淀到哪里

| 经验类型 | 首选落盘位置 | 示例 |
| --- | --- | --- |
| 命令行为、参数校验、平台 API 链路 | `lib/**` + `tests/**` | `update-app --theme` 不能只走 `updateAppName`，需回读详情后用 `updateApp` 保存 |
| 技能路由、工作流、验收纪律 | `yida-skills/SKILL.md` 或对应子技能 `SKILL.md` | 主题任务必须先读 `yida-design`，页面视觉先读 `yida-design` |
| 页面视觉、Dribbble/优秀案例参考方法 | `yida-design` workflow/reference | 参考案例要转译为布局、视觉锚点、密度、色彩、组件细节 |
| 自定义页面共性规则 | `yida-canvas-custom-page` | 独立页面按场景确定主题、演示数据有标识、发布后回读 Schema |
| 应用主题、全局 CSS 变量 | `yida-design` | `--theme` 只接受平台预置 key，自定义主题走 `style#yida-global-theme` |
| 表单/流程/报表等领域规则 | 对应子技能 | 字段、公式、流程规则、报表配置分别沉淀到所属 skill |
| 临时经验但暂不适合入主技能 | 子技能 references 或新增 reference | 一组可复用接口探测、截图验收清单、素材流程 |

## 页面质量改造沉淀

页面批量改造暴露出的共性经验应长期保留。以后用户继续要求“同步到前面改进的应用 / 看起来更高级 / 去 Dribbble 参考 / 加真实数据”时，按下面规则执行。

### 通用经验

1. **参考 Dribbble 不是一句话**
   用户要求参考 Dribbble / 优秀示例时，必须把参考转成可执行设计变量：页面类型、构图、视觉锚点、信息密度、色彩关系、组件细节、反默认点。交付时说明“参考转译成了什么”。

2. **独立品牌页使用页面级主题**
   独立品牌页、活动页、页面级沉浸页和应用导航隐藏后的自绘壳应自带页面级主题 token。普通业务页、页面重构和局部美化优先读取当前应用主题色。

3. **`--theme` 只能填平台预置 key**
   `deepBlue/podBlue/royalBlue/lightBlue/teal/podGreen/deepPurple/purple/podOrange/yellow/magenta/red/greyBlue/coffee/black` 才能作为 app `colour`。默认优先使用 `podBlue`、`podGreen`、`podOrange`；自定义“活力橙”“深玫红”“暗黑金”等设计主题，应在每个页面注入 `style#yida-global-theme` 或 scoped tokens，`blue`、`green`、`orange` 作为应用主题 token profile 保留原名。

4. **CLI 成功不等于线上生效**
   修改应用主题后必须回读 `getAppIncludingAecpInfo`，确认 `colour` 和 `config.COLOUR`。如果接口回包成功但字段没变，要修 CLI 链路和测试，而不是只用一次性脚本绕过。

5. **页面要像真实产品，不只像模板**
   列表、详情、工作台、数据管理、大屏必须有足够真实的数据结构：筛选、状态、分组、时间线、趋势、排名、tooltip、异常态、批量操作等。只放几个卡片会显得空。

6. **截图反馈要归因并反哺**
   用户基于截图指出问题时，先判断是主题污染、素材缺失、布局断层、数据不足、组件 props 缺失还是页面结构缺口。属于共性问题就补 skill、页面生成器或测试。

7. **工作台是操作首页**
   工作台页面应铺满应用内容区，侧栏、导航和主面板形成真实产品首页。使用真实业务模块、待办、行动队列和数据入口，不把设计过程标签露给用户。

8. **地图类大屏不能显示“组件暂不可用”**
   大屏中心区域如果是地图，优先探测平台地图组件；组件不可用时也要用内置区域 SVG / GeoJSON 兜底，保留区域数据和 tooltip，不把“地图组件暂不可用”作为正常展示态。

9. **原生组件页面要有设计场景**
   `native-components-smoke`、`portal-native-components` 等 native 系列不应只是诊断表格。先参考同类组件实验室、门户组件面板或管理台设计，再做运行态探测、局部 ErrorBoundary、fallback 和 payload inspector。

### 场景经验表

| 场景 | 用户反馈中的目标 | 应沉淀的实现策略 |
| --- | --- | --- |
| `business-list` / 业务协同列表 | 主题色蓝色、像真实协同列表 | 蓝色品牌主色；顶部指标、筛选条、批量操作、表格状态标签、详情入口都要完整，避免灰黑按钮和空表格。 |
| `detail-profile` / 详情页 | 看 Dribbble 的详情页再优化 | 单对象 hero、关键元信息侧栏、摘要指标、时间线、关联对象和操作区；不要只堆字段卡片。 |
| `portal-shell-home` / 门户壳 | 紫色，导航色要完整覆盖，内容更丰富 | 紫色页面级主题；侧栏 / 顶栏全高或全宽覆盖，不留下断层；补角色入口、常用应用、动态、指标、团队模块。 |
| `product-homepage` / 产品首页 | 暗黑高级，像产品网站首页 | 首屏必须是产品 / 品牌信号，使用真实或生成图片作为视觉锚点；不要做成业务面板或普通卡片页。 |
| 工作台 / 业务首页 | 不能有大面积空白，是真工作台 | 全屏操作面板，侧栏贴边、主区密集，包含待办、行动队列、指标、快捷入口、动态流；去掉设计过程标签。 |
| `data-management` / 数据管理 | 参考飞书和钉钉多维表 | 多维表工具栏、视图切换、字段管理、筛选、分组、排序、行高、彩色标签、冻结列和批量操作。 |
| `data-screen` / 区域态势屏 | 地图问题，宜搭也有地图组件 | 优先宜搭地图组件探测，内置地图兜底；中心态势图要有区域、点位、tooltip、排名和趋势联动。 |
| native 系列页面 | 都要去 Dribbble 搜同类优秀设计 | 先确定“组件实验室 / 业务门户 / 数据管理视图”的产品形态，再接运行态组件；失败只降级局部区域。 |

### 页面发布验收链路

1. 确认页面对应的 `formUuid` 和源码路径。
2. 修改页面源码后先跑对应编译链路。
3. 跑相关 Jest，并补防回归断言。
4. 跑 `git diff --check`，避免空白错误。
5. 发布到目标应用后，用 `get-schema` 回读确认 `YidaCodeCanvas/runtimeCode` 或普通页面源码更新，并 grep 关键 class / 文案 / 样式。
6. 如果发现“接口成功但线上没变”，优先修 CLI / 测试 / skill，不要只手工绕过。

### ECharts 页面 / 原生报表绑定经验

自定义 ECharts 页面引用旧应用里的 `REPORT_xxx`、旧 `prdId/topicId` 和旧 `cid` 时，会在当前应用中返回 `no permission for the report`。以后遇到 ECharts 页面权限或空数据问题时，按下面链路处理。

1. **先在当前应用创建或同步原生报表**
   不要把另一个应用的 `REPORT_xxx` 复制到当前页面。当前应用如果没有可用数据源表单，先创建专用数据源表单并写入可展示的示例数据；再用 `openyida create-report` 创建原生报表。

2. **所有绑定参数来自新报表 schema**
   创建报表后必须 `openyida get-schema <appType> <REPORT_xxx> --json`，从组件树提取 `cid`、`componentName/className`、`dataSetKey`、`filterKey`、`cname`。不要沿用旧 `YoushuTable_mmx...` 或旧 `YoushuSimpleIndicatorCard_mmx...`。

3. **`prdId/topicId` 运行时动态获取**
   ECharts 页面不能硬编码 `prdId`。用 `getFormNavigationListByOrder` 按 `REPORT_FORM_UUID` 找 `topicId`，再调用 `getDataAsync.json`。

4. **filterKey 是组件级，不是字段级**
   同一个“状态筛选”联动到不同组件时也会生成不同 `filterKey`。记录时用 `statusTableStatus`、`budgetTableStatus` 这类组件级命名，不能只写 `status`。

5. **绑定关系要落盘并加测试**
   写入 `.cache/openyida/<任务名>/report-binding.json`，同时在相关测试中断言页面源码不再包含旧 `REPORT`、旧 `prdId`、旧 appType 或旧 cid 前缀。

6. **发布后全量验收**
   对所有相关 ECharts 页面执行 `check-page`、`compile`、`publish --health-check`、`git diff --check`。如果页面使用了 ECharts 地图，要同时检查地图底图/GeoJSON 兜底，不允许把“地图组件暂不可用”作为正常态。

### 沉淀优先级

判断经验落哪里时按这个顺序：

1. **能用测试防回归**：补 `tests/**`。
2. **属于页面骨架共性**：补页面生成器、页面结构规则或测试。
3. **属于执行纪律 / 路由 / 设计原则**：补对应 `yida-skills/skills/**/SKILL.md` 或 reference。
4. **属于命令能力缺口**：补 `lib/**` CLI 实现和测试。
5. **只是一轮上下文经验**：补本文件，等重复出现后再提升到子技能核心规则。

## 任务收尾清单

任务完成前按顺序检查：

1. 当前请求是否已经真实完成：本地代码、线上资源或页面效果是否已验证。
2. 是否有用户多次强调或纠正的模式，需要补到 skill。
3. 是否发现 CLI 行为缺口，需要补到 `lib/**` 和 `tests/**`。
4. 是否新增/修改页面生成器或通用页面骨架，需要跑相关本地编译、Jest 和 `git diff --check`。
5. 是否发布到线上，需要用 schema 或详情接口回读关键字段。
6. 是否修改 skill，需要跑 `npm run check:skills`。
7. 最终回复里说明本次沉淀到哪里；如果判断“不需要沉淀”，说明原因。

## 不要过度沉淀

沉淀要服务于复用，不要把一次性业务细节写进全局规则：

- 具体客户名、临时页面文案、一次性数据不要写进 skill。
- 尚未验证的平台接口不要写成确定规则，先标注为待验证经验。
- 与当前任务无关的大规模重构不要借“沉淀”名义扩大范围。
- 工作区已有大量未提交改动时，只改与本次经验直接相关的文件，不整理无关 diff。
