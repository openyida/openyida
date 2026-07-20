# OpenYida UI 生成质量升级完整方案

## 1. 背景与目标

当前 OpenYida 已经把自定义页面默认链路切到 Code Canvas，并补充了 `official-homepage`、`data-screen`、`dashboard-overview`、`workbench-home`、`business-list`、`detail-profile` 等模板。但从线上测试看，生成结果仍容易出现几个问题：

| 问题 | 表现 | 根因 |
| --- | --- | --- |
| 官网首页模板感强 | 首屏像工作台，缺图片、动效、品牌叙事和 section 节奏 | 生成前缺少轻量行业调研和官网设计决策 |
| 数据看板不够惊艳 | KPI 卡、图表、排行和洞察都偏平，像静态信息卡 | 只有页面模板，没有 dashboard 级组件契约和布局契约 |
| 工作台/列表/详情等场景覆盖不足 | 方案容易只围绕官网和看板展开，忽略原有业务页形态 | 缺少统一的全场景路由矩阵和场景级契约 |
| 应用整体缺 IA | 多页面应用只是创建多个页面，导航和用户角色路径没有被设计 | 缺少应用级 UI/信息架构决策层 |
| 主题理解过窄 | “宜搭应用主题风格”被误解成固定颜色或浅色卡片 | 缺少运行态主题、色组、辅助色和不同场景的解释 |
| 速度与效果冲突 | 官网如果做完整调研太慢，不调研又像模板 | 缺少分级 research 策略 |

本方案目标：

1. 让 OpenYida 从“生成页面”升级为“生成应用体验”。
2. 覆盖官网、工作台、数据看板、大屏、列表/管理页、详情/展示页、门户/导航壳、表单详情等主要自定义页面场景。
3. 复用 `dingtalk-ai-app` dashboard 体系中的主题、壳形态、组件契约和图表规范，并扩展为应用级体验蓝图。
4. 建立官网/落地页的轻量调研机制，在速度和效果之间取得稳定平衡。
5. 明确 skill、reference、CLI template、`lib/samples` 的边界，避免所有知识塞进一个模板。
6. 把模板演进纳入当前整改范围，而不是放到后续优化；否则 skill 判断变好后仍会被旧模板拉低效果。
7. 形成可测试、可迭代的落地路径。

## 2. 总体架构

建议把 UI 生成能力拆成四层：

| 层级 | 职责 | 主要承载 |
| --- | --- | --- |
| 应用级体验蓝图 | 角色路径、页面组合、导航分组、门面页、应用壳形态 | 新增 `yida-app-uiux` 或 `yida-page-uiux` 的 app reference |
| 页面级视觉决策 | 判断页面类型，输出视觉方向、素材策略、dashboard/landing 设计契约 | `yida-page-uiux` |
| Code Canvas / 普通自定义页面 JSX 落地规则 | 把设计契约翻译成 JSX、主题 token、图表、交互 | `yida-canvas-custom-page` / `yida-custom-page` |
| 可执行模板 | CLI 直接渲染并可编译发布的稳定 JSX 模板 | `lib/samples/*` |

一句话分工：

```text
应用级 UIUX 定“应用怎么组织”
页面级 UIUX 定“页面应该长成什么”
Code Canvas / 普通自定义页面 JSX skill 定“怎么写代码”
lib/samples 提供“可执行模板”
```

### 2.1 全场景覆盖矩阵

OpenYida UI 生成不能只围绕官网和 dashboard。完整场景矩阵如下：

| 场景 | 用户自然表达 | 设计目标 | 默认承载 | 关键质量门槛 |
| --- | --- | --- | --- | --- |
| 官网/落地页 `landing` | 官网首页、品牌官网、律所官网、招商页、活动页 | 讲清价值、建立信任、引导下一步 | `official-homepage` | 有轻量调研、素材策略、section 节奏，不能像工作台 |
| 工作台/门户首页 `workbench` | 工作台、运营台、任务中心、系统首页、部门门户 | 看状态、进待办、跳入口 | `workbench-home` | 欢迎区克制，指标和入口有主次，不能营销大 Hero |
| 数据看板 `dashboard` | 经营看板、数据看板、驾驶舱、管理看板 | 一屏判断业务健康、趋势和异常 | `dashboard-overview` | KPI 主次、图表、排行/明细、洞察齐全 |
| 数据大屏 `screen` | 数据大屏、实时监控、预警系统、态势屏、指挥舱 | 投屏/监控/态势感知 | `data-screen` | full-bleed、深色、中心态势图、左右信息塔 |
| 列表/管理页 `list` | 订单管理、客户列表、工单池、商品管理、数据管理 | 找到、筛选、批量处理、下钻详情 | 当前整改新增 `business-list`；复杂录入仍走原生表单 | 筛选克制、表格主次列、三态齐全、详情抽屉 |
| 详情/展示页 `detail` | 订单详情、客户档案、商品详情、项目详情、报告页 | 围绕单对象讲清楚全貌 | 当前整改新增 `detail-profile`；表单详情美化走 `yida-form-detail` | 反字段墙、主图/主数据完整、章节按对象叙事 |
| 表单详情 `form-detail` | 美化详情页、字段详情视觉优化 | 在原生详情能力上提升可读性 | `yida-form-detail` CSS 注入 | 不重写表单，不破坏字段/权限/流程 |
| 页面内导航壳 `nav-shell` | 隐藏导航、沉浸门户、独立分享、多页面内切换 | 自定义页面内组织多个视图 | `yida-nav-shell` | 仅在 `isRenderNav=false` 时使用，URL 参数完整 |
| PPT/演示页 `presentation` | 路演、培训、幻灯片、演示文稿 | 全屏讲故事 | `yida-ppt-slider` | 键盘翻页、移动适配、视觉素材 |
| 批量录入表格 `table-form` | Excel 式录入、批量提交 | 高效录入和校验 | `yida-table-form` | 行内校验、草稿、批量提交反馈 |

全场景生成前都要先走 `yida-page-uiux` 的页面类型判断；只有落地链路不同：

- 展示/看板/官网/工作台默认 Code Canvas。
- 强依赖普通自定义页实例桥的页面选择普通自定义页面 JSX/Jsx 组件链路。
- 录入、流程、权限和字段结构优先交给原生表单/流程技能。

### 2.2 场景级设计契约总览

| 场景 | 必须设计的问题 | 禁止的默认脸 |
| --- | --- | --- |
| `landing` | 受众是谁、首屏承诺是什么、素材从哪来、每屏承担什么叙事任务 | 纯文字 + 三卡片；无素材硬做大 Hero；连续同构 section |
| `workbench` | 用户进来先处理什么、常用入口如何分组、待办/动态怎么呈现 | 营销大 Hero；入口九宫格平铺；欢迎语占主视觉 |
| `dashboard` | 核心 KPI 是谁、图表回答什么问题、洞察落在哪里 | KPI 等大平铺；无洞察图表；彩色渐变卡片墙 |
| `screen` | 大屏中心态势是什么、左右信息塔是什么、实时刷新如何表达 | 普通 dashboard 放大；浅色卡片堆；导航和表格挤满屏 |
| `list` | 主键列是谁、常用筛选有哪些、点行后如何保留上下文 | 等宽列；满屏彩色标签；点行跳整页；缺空/载/错态 |
| `detail` | 对象第一眼身份是什么、章节顺序为何如此、主数据/主图如何完整展示 | 字段墙；“基本信息/详细信息/其他信息”万能标题；每章配装饰图标 |
| `form-detail` | 哪些字段需要分组、哪些字段需要强调、详情态如何更易读 | 重写表单控件；破坏流程/权限；全局 CSS 误伤 |

## 3. Dashboard 体系如何复用到应用级

`/Users/fangruiyan/dingtalk-ai-app/app/skills/web-app-dashboard-frontend-design` 里的 dashboard 体系，不只是看板 UI。它实际包含一套应用体验方法论：

- 主题预设：17 套 preset，带 `mood` 和 `businessFit`。
- 壳形态：`single_page`、`top_nav`、`side_nav`、`l_shaped`、`fullbleed-screen`、`split-pane`。
- 页面模板：不同 shell 对应不同起点页。
- 组件契约：`KPICard`、`DashboardCard`、`TrendLabel`、`InsightCallout`、`DataFreshnessBadge`。
- 图表契约：图表高度、legend、series name、主题注入、色板、hover 安全。

OpenYida 可以吸收为“应用级体验蓝图”，用于一句话建应用时先回答：

| 决策问题 | 示例 |
| --- | --- |
| 这个应用有几个用户角色？ | 消费者、经销商、运营管理员 |
| 哪个页面是应用门面？ | 官网首页 / 经营驾驶舱 / 工作台 |
| 左侧导航如何分组？ | 用户展示、经销商经营、后台配置 |
| 哪些页面用平台导航？ | 表单、列表、普通工作台 |
| 哪些页面隐藏导航自绘壳？ | 官网、投屏大屏、沉浸驾驶舱 |
| 看板是普通 dashboard 还是 fullbleed screen？ | 经销商看板是 dashboard，水质实时预警是 screen |

### 3.1 应用级壳形态映射

| dingtalk shell | OpenYida 应用级映射 | 适用场景 |
| --- | --- | --- |
| `single_page` | 平台导航可见 + 单自定义页 | 单页工作台、简单看板 |
| `top_nav` | 隐藏应用导航后自绘顶部导航，或平台导航少量同级页面 | 官网/门户、多专题轻应用 |
| `side_nav` | 宜搭左侧导航分组 | 常规中后台应用 |
| `l_shaped` | 平台导航分组 + 页面内 tab，或隐藏导航后 `yida-nav-shell` 混合壳 | 复杂 BI/运营工作台 |
| `split-pane` | 单页主从详情自定义页 | 工单、告警、客户详情、库存明细 |
| `fullbleed-screen` | `isRenderNav=false` + `data-screen` | 投屏、监控大屏、指挥舱 |

### 3.2 新增应用级决策块

建议在完整应用搭建流程中，PRD 后、创建页面前增加“应用体验蓝图”：

```markdown
### 【应用体验蓝图】
- 用户角色：消费者 / 经销商 / 运营管理员
- 应用门面：消费者官网首页（landing，隐藏或弱化应用导航）
- 核心业务页：经销商数据看板（dashboard，平台导航可见）
- 后台配置：门店、产品、库存、活动表单（平台原生表单）
- 导航分组：品牌展示 / 经销商经营 / 后台数据
- 壳形态：side_nav 为主；官网可使用 landing 自带顶部导航，数据大屏使用 fullbleed
- 主题策略：`themeProfile: { "name": "yida-app-theme" }`，跟随运行态主题；图表使用 `--color-group`
```

## 4. Dashboard 页面生成升级

当前 `yida-page-uiux/references/scenes/dashboard.md` 已有 dashboard 场景，但需要从“方向提示”升级为“设计契约”。

### 4.1 Dashboard Archetype

新增或强化以下类型：

| Archetype | 适用 | 必备结构 |
| --- | --- | --- |
| 总览型 | 管理层一屏看全局 | 1 个核心 KPI + KPI 组 + 主趋势图 + 排行/异常 |
| 分析型 | 多维下钻 | 筛选器 + 分组图表 + 下钻路径 + 明细表 |
| 监控型 | 实时状态/告警 | 状态灯 + 告警流 + 小趋势 + 刷新时间 |
| 报告型 | 周报/月报复盘 | 摘要结论 + 分节图表 + 行动建议 |
| 对比型 | 区域/渠道/时间对比 | 维度切换 + 并排图表 + 差异洞察 |
| 运营型 | 日常动作工作台 | 待办/Feed + 快捷动作 + 重点指标 |

### 4.2 Dashboard 组件契约

建议在 `yida-page-uiux/references/dashboard/component-contracts.md` 中定义这些“视觉原子”，不一定做真实组件库，但模板生成要遵守。

| 原子 | 必备槽位 | 规则 |
| --- | --- | --- |
| KPI Primitive | title / value / unit / delta / footer | 一排 variant 一致，核心 KPI 要有主次，不裸数字 |
| Chart Panel | title / subtitle / chart / insight / action | 每张图回答一个业务问题，必须有高度和洞察 |
| Insight Callout | conclusion / evidence / suggestion | 看板至少一处全局结论 |
| Rank List | rank / name / value / progress / status | 排行要有排序理由和业务含义 |
| Freshness Badge | source / updatedAt / refresh | 数据来源和更新时间可见 |
| Alert Feed | level / subject / reason / action | 告警红只给真实异常 |

### 4.3 图表契约

Code Canvas 当前模板可用 Recharts，也可逐步支持 ECharts。无论图表库是什么，skill 层先定义统一契约：

- 图表容器必须有稳定高度，避免 0 高度。
- 每个 series 必须有名称，用于 legend/tooltip。
- 图表色从 `--color-group` 派生；不要硬编码 `#1677ff`。
- Canvas 图表不能直接消费 CSS var 字符串时，必须用 `getComputedStyle` 解析成真实色值。
- 图表必须服务一个业务问题，不放纯装饰图。
- 每张图至少有一句具体洞察，格式为“数字 + 业务含义 + 建议/风险”。

### 4.4 数据大屏与普通看板分流

| 用户说法 | 模板 | 视觉 |
| --- | --- | --- |
| 数据看板、经营看板、驾驶舱 | `dashboard-overview` | 业务系统风格，密度高但克制 |
| 数据大屏、实时监控、预警系统、态势屏 | `data-screen` | full-bleed、深色、中心态势图、左右信息塔 |
| 工作台、运营台、任务中心 | `product-homepage --scene workbench` | 动作/入口/待办优先，不要大屏化 |

## 4.5 工作台 / 门户首页生成升级

工作台是高频业务入口，不是官网，也不是 dashboard。它的核心是“看一眼状态 + 快速跳去干活”。

### 4.5.1 工作台信息架构

| 区块 | 职责 | 规则 |
| --- | --- | --- |
| 欢迎/上下文区 | 当前用户、日期、待办数、系统状态 | 克制 1-2 行，不做大图 banner |
| 核心概览 | 3-5 个门户级指标 | 有主次，不做完整经营分析 |
| 快捷入口 | 高频操作、常用页面、核心表单 | 分组排序，高频在前，长尾靠后 |
| 我的待办 | 待处理流程、异常任务、提醒 | 列表化，可点进详情 |
| 最近动态 | 最近提交、审批、系统通知 | 可选，不抢主视觉 |

### 4.5.2 工作台质量红线

- 禁营销大 Hero。顶部巨图、渐变遮罩和口号属于官网，不属于工作台。
- 禁入口九宫格无脑平铺。入口要分组、有主次。
- 禁 5 个 KPI 一样大。最重要的 1 个可以更突出。
- 欢迎区是配角，不能压过待办和入口。
- 适合使用平台导航；只有门户化、独立分享或隐藏应用导航时才自绘导航壳。

## 4.6 列表 / 管理页生成升级

列表页的目标是“找到 → 筛选 → 处理”，不是展示品牌，也不是聚合结论。

### 4.6.1 列表信息架构

| 区块 | 职责 | 规则 |
| --- | --- | --- |
| 标题 + 主操作 | 当前对象类型 + 新建/导入等主动作 | 主操作右上，避免多按钮同权 |
| 筛选栏 | 状态、时间、负责人、关键词 | 常用筛选一行，高级筛选收起 |
| 数据表/卡片列表 | 对象主数据 | 主键列加重，数值右对齐，状态标签克制 |
| 批量操作条 | 多选后出现 | 显示选中数量和可执行动作 |
| 详情抽屉 | 点行后保留上下文 | 不轻易整页跳转 |
| 空/载/错态 | 三态兜底 | 空态给下一步，新建或清空筛选 |

### 4.6.2 列表质量红线

- 禁每列等宽。主键列宽，状态/时间/操作列窄。
- 禁每个字段都彩色标签。只有状态/告警用色。
- 禁点行整页跳走后丢失筛选上下文。优先详情抽屉。
- 禁缺少空态、加载态、错误态。
- 数据录入/编辑优先跳原生表单或 iframe，不在自定义页里重写复杂表单。

## 4.7 详情 / 展示页生成升级

详情页围绕单个对象，不是字段导出页。它需要对象叙事。

### 4.7.1 详情信息架构

| 区块 | 职责 | 规则 |
| --- | --- | --- |
| Hero 身份区 | 对象名、状态、主图/主数据、主操作 | 第一眼确认对象身份 |
| 关键摘要 | 3-6 个最重要字段或指标 | 弱化标签、加重值 |
| 章节内容 | 按业务逻辑分组 | 标题具体化，不用万能“基本信息” |
| 侧栏元信息 | 创建人、更新时间、权限、操作 | 30% 左右宽度，次要信息 |
| 时间线/关联对象 | 流程、日志、附件、关联记录 | 列表化，支持跳转 |

### 4.7.2 详情质量红线

- 禁字段墙。一屏 20 个 label:value 是数据库导出，不是详情页。
- 禁万能章节标题：基本信息、详细信息、其他信息。
- 禁主图裁切、彩色发光和渐变遮罩；对象展示要完整。
- 主标题与正文要拉开字号跨度，建议至少 2.5 倍。
- 操作区主次分明，录入/编辑走原生表单或 iframe。

## 4.8 表单详情页与自定义详情页边界

| 诉求 | 推荐技能 | 原因 |
| --- | --- | --- |
| 美化宜搭原生表单详情页 | `yida-form-detail` | 只注入 CSS，保留字段、权限、流程、移动端能力 |
| 做单对象展示页/档案页 | `yida-page-uiux detail` + `yida-canvas-custom-page` | 适合自定义叙事、关联数据、视觉展示 |
| 编辑/提交字段 | 原生表单 / iframe | 不在自定义页重写复杂表单控件 |
| 流程详情/审批上下文 | 原生流程详情优先 | 避免破坏流程任务和权限 |

## 5. 主题体系升级

### 5.1 默认策略：跟随宜搭运行态

“宜搭应用主题风格”默认不是固定色值，而是：

```json
{
  "themeProfile": { "name": "yida-app-theme" },
  "themeScope": "page"
}
```

模板运行时读取：

- `--color-brand1-6`：主色
- `--color-brand1-2`：浅底
- `--color-brand1-9`：深色
- `--color-group`：图表和强调色组

只有用户明确要求固定品牌色或应用级换肤，才写入 `themeColor` 或使用 `themeScope: app`。

### 5.2 吸收 dingtalk 主题预设为“配方”

不要把 dingtalk 的 `tailwind-theme.css` 机制照搬到宜搭，因为 OpenYida 线上已有 `#yida-global-theme`。建议吸收为“设计配方”：

| 配方 | 适用 | OpenYida 表达 |
| --- | --- | --- |
| `emerald` | 增长、SaaS、通用看板 | 跟随主题主色，辅助色偏青绿 |
| `midnight-indigo` | 监控大屏、科技态势 | `data-screen` 深色基底 + 主色发光 |
| `navy-trust` | 法律、金融、合规 | 冷灰、微圆、低饱和辅助色 |
| `amber` | 零售、消费品牌 | 暖灰、琥珀辅助色、图片优先 |
| `forest-moss` | 环保、农业、教育 | 暖绿、自然纹理、柔和圆角 |
| `glass-aurora` | 发布会、城市大屏 | 仅用于隐藏导航/展示页，不用于普通业务后台 |

新增 `theme-recipes.md` 时记录：

- `slug`
- `mood`
- `businessFit`
- `recommendedScene`
- `neutralTone`
- `cornerPersonality`
- `chartPaletteStrategy`
- `whenNotToUse`

### 5.3 避免单色主题

即便用户说“绿色”，也不应把页面所有元素刷成绿色。推荐：

- 主色：跟随 `--color-brand1-6`
- 图表：读取 `--color-group`
- 成功/警告/危险：使用语义色
- 大面积背景：低饱和中性色或浅品牌底
- 深色大屏：主色只做发光和关键线条

## 6. 官网/落地页生成策略

官网不是工作台，也不是普通展示卡片。它需要“轻量调研 + 设计决策 + 素材策略”。

### 6.1 researchLevel 分级

| 等级 | 触发 | 耗时目标 | 行为 |
| --- | --- | --- | --- |
| `none` | 内部工具、工作台、列表、详情 | 0 秒 | 不做调研，直接按业务类型生成 |
| `light` | 官网、品牌页、落地页默认 | 30-90 秒 | 行业/受众/参考方向/素材策略/首屏叙事 |
| `enhanced` | 用户说“真实官网感、高级感、参考优秀设计” | 3-5 分钟 | 找 2-3 个参考，提取构图/图片/section 节奏 |
| `deep` | 用户明确要竞品、品牌方案、严肃交付 | 10 分钟以上 | 品牌分析、竞品拆解、多版方向、确认后实现 |

默认采用 `light`，不阻塞生成太久。

### 6.2 Light Research 输出

官网/品牌页在生成前必须输出内部设计摘要，写入 spec：

```json
{
  "researchLevel": "light",
  "industry": "奶茶品牌",
  "audience": ["年轻消费者", "经销商"],
  "designReference": "清新消费品牌 + 渠道可信背书",
  "assetStrategy": "hero 使用产品摄影，section 使用产品图/门店图/数据证明",
  "heroNarrative": "先让消费者看到鲜活产品，再让经销商看到经营能力",
  "sectionRhythm": ["Hero 产品图", "明星产品", "门店体验", "经销商价值", "CTA"]
}
```

### 6.3 素材策略

| 情况 | 策略 |
| --- | --- |
| 用户提供图片 | 优先使用，校验可访问性 |
| 有 CDN 配置 | 可 AI 生成/本地素材后 `openyida cdn-upload` |
| 无 CDN 配置 | 使用已验证公开 URL 或先交付低保真并标注素材缺口 |
| 无法联网 | 使用行业默认构图 + 信息图/流程图，不声称已调研 |

官网交付红线：

- 强视觉行业（餐饮、茶饮、零售、美妆、酒店、文旅）没有 `heroImage` 时，只能算草稿。
- 每个 section 至少有一个视觉锚点：图片、产品卡、流程图、数据证明、引文或对比表。
- 禁止连续同构 section，例如一路“三卡片 + 左文右图”。

## 7. Skill 拆分方案

### 7.1 推荐结构

短期先增强 `yida-page-uiux`，避免新增过多顶层 skill 导致路由复杂。

```text
yida-page-uiux/
  SKILL.md
  workflow/
  references/
    scenes/
      workbench.md
      dashboard.md
      list.md
      detail.md
      landing.md
      screen.md
    app/
      blueprint.md
      navigation-patterns.md
      role-journey.md
    dashboard/
      theme-recipes.md
      layout-patterns.md
      component-contracts.md
      chart-contracts.md
      app-blueprint.md
    workbench/
      entry-patterns.md
      task-feed.md
      portal-layouts.md
    list/
      table-patterns.md
      filter-patterns.md
      drawer-detail.md
      empty-loading-error.md
    detail/
      object-narrative.md
      section-patterns.md
      timeline-and-related.md
    landing/
      research-levels.md
      section-patterns.md
      assets-workflow.md
      industry-playbooks.md
```

### 7.2 是否新增顶层 skill

如果后续发现 `yida-page-uiux` 过大，可以再拆：

| 新 skill | 触发 | 职责 |
| --- | --- | --- |
| `yida-app-uiux` | 从零创建多页面应用、应用整体规划 | 应用级信息架构、导航分组、页面组合 |
| `yida-landing-page-uiux` | 官网、品牌页、落地页 | 调研分级、素材策略、section 节奏 |
| `yida-dashboard-uiux` | 数据看板、驾驶舱、大屏 | dashboard archetype、组件契约、图表契约 |
| `yida-workbench-uiux` | 工作台、门户、任务中心 | 入口分组、待办流、门户首页布局 |
| `yida-list-uiux` | 列表、管理页、数据管理页 | 筛选、表格、批量操作、详情抽屉、三态 |
| `yida-detail-uiux` | 详情、档案、展示页 | 单对象叙事、章节分组、时间线、关联对象 |

不建议把真正独立技能放在 `yida-page-uiux/subskills/<name>/SKILL.md` 后期待自动触发。当前 OpenYida 技能校验和索引主要识别：

```text
yida-skills/skills/<skill-name>/SKILL.md
```

嵌套 subskills 更适合作为内部 reference 或 workflow，不适合作为外部 agent 自动路由入口。

## 8. 为什么模板放在 `lib/samples`

这是正确分工，建议继续保持：

| 位置 | 放什么 | 原因 |
| --- | --- | --- |
| `lib/samples` | 可执行 JSX / Canvas 模板 | CLI 可以直接读取、渲染、编译、测试 |
| `yida-skills` | 行为说明、设计规则、路由策略 | 给 agent 读，控制生成行为 |
| `references` | 长文档、设计契约、checklist | 按需 progressive disclosure |
| `docs` | 方案、规划、设计决策记录 | 给研发和产品对齐 |

不建议把完整大模板放进 skill：

- skill 会被打包到悟空等环境，过长模板会影响读取和路由。
- 模板需要 Jest/编译/发布链路验证，放 `lib/samples` 更自然。
- 大模板放文档里容易过期，CLI 真实使用的仍是另一份。

建议 skill 中只放短骨架和规则，完整模板仍在 `lib/samples`。

## 9. CLI 与 IR 改造建议

### 9.1 Page IR 字段

建议逐步补充：

```json
{
  "scene": "landing | dashboard | screen | workbench | list | detail | form-detail | presentation | table-form",
  "researchLevel": "none | light | enhanced | deep",
  "appBlueprint": {
    "roles": [],
    "navigationGroups": [],
    "entryPage": "",
    "shell": "single_page | top_nav | side_nav | l_shaped | fullbleed | split_pane"
  },
  "visualProfile": {
    "name": "yida-app-theme",
    "archetype": "overview | analysis | monitor | report | compare | operation",
    "density": "business-compact",
    "tone": "",
    "motif": []
  },
  "interactionProfile": {
    "primaryAction": "",
    "detailMode": "drawer | page | iframe | none",
    "bulkActions": [],
    "states": ["empty", "loading", "error"]
  },
  "themeProfile": {
    "name": "yida-app-theme",
    "followRuntimeTheme": true,
    "themeColorSource": "runtime-css-vars"
  },
  "assets": {
    "heroImage": "",
    "productImages": [],
    "materialStrategy": ""
  },
  "insights": []
}
```

### 9.2 模板路由

| 输入意图 | 默认模板 |
| --- | --- |
| 官网、品牌首页、律所官网、茶叶官网、招商页 | `official-homepage` |
| 数据大屏、实时监控、预警系统、态势屏 | `data-screen` |
| 经营看板、数据看板、驾驶舱 | `dashboard-overview` |
| 工作台、运营台、任务中心 | `workbench-home` |
| 列表管理、数据管理 | 当前整改新增 `business-list` |
| 详情展示、档案页 | 当前整改新增 `detail-profile` |
| 表单详情页美化 | 不走 `generate-page`，使用 `yida-form-detail` |
| 页面隐藏导航后的门户/多视图 | `yida-nav-shell` + 对应页面模板 |
| 批量录入表格 | `yida-table-form` |

### 9.3 当前模板演进

模板演进是当前整改主线，不是后续优化。原因很直接：agent 即使选对了页面类型，如果仍落到泛化模板，线上看到的还是“白卡片 + 大标题 + 三指标”的默认脸。

当前 `product-homepage` 承载了 workbench 和 dashboard，应在本轮拆分：

| 模板 | 说明 |
| --- | --- |
| `workbench-home` | 入口、待办、动作流、常用功能 |
| `dashboard-overview` | KPI、图表、排行、洞察 |
| `official-homepage` | 官网/品牌页 |
| `data-screen` | 大屏/态势屏 |
| `business-list` | 筛选 + 表格 + 状态 |
| `detail-profile` | 摘要 + 分组 + 时间线 |
| `split-pane-detail` | 左列表 + 右详情主从页面 |
| `portal-shell-home` | 隐藏导航后的门户/多入口首页 |

## 10. 实施路线

### P0：skill 契约与模板基线并行

目标：一边让 agent 做对设计决策，一边把当前最影响观感的模板基线同步升级。不能只改 skill 文档，也不能只改 CSS。

#### P0-A：文档与 skill 契约

- 增强 `dashboard.md`：加入 archetype、section 分组、洞察、普通看板/大屏/工作台分流。
- 增强 `workbench.md`：加入入口分组、待办流、动态区、门户首页红线。
- 增强 `list.md`：加入筛选策略、表格主次列、详情抽屉、批量操作和三态。
- 增强 `detail.md`：加入单对象叙事、章节标题具体化、反字段墙纪律。
- 新增 app references：
  - `blueprint.md`
  - `navigation-patterns.md`
  - `role-journey.md`
- 新增 dashboard references：
  - `theme-recipes.md`
  - `layout-patterns.md`
  - `component-contracts.md`
  - `chart-contracts.md`
  - `app-blueprint.md`
- 新增 landing references：
  - `research-levels.md`
  - `section-patterns.md`
  - `assets-workflow.md`
  - `industry-playbooks.md`
- 新增 list/detail/workbench references，沉淀原有高频业务页面的生成契约。
- 更新 `yida-skills/SKILL.md` 的完整应用流程：加入应用体验蓝图。

#### P0-B：当前模板基线升级

- 拆出 `dashboard-overview.canvas.jsx`，不再让 dashboard 继续套用泛化 `product-homepage`。
- 拆出 `workbench-home.canvas.jsx`，把工作台从官网/看板模板里分离出来。
- 新增 `business-list.canvas.jsx`，覆盖筛选、表格、状态、详情抽屉、空/载/错态。
- 新增 `detail-profile.canvas.jsx`，覆盖对象 hero、摘要指标、章节、侧栏元信息、时间线。
- 升级 `official-homepage.canvas.jsx`，支持素材位、首屏叙事、section 节奏和轻量动效。
- 升级 `data-screen.canvas.jsx`，强化 full-bleed、中心态势图、左右信息塔和发光/扫描动效。
- 所有模板默认读取 `#yida-global-theme` 的 `--color-brand*` 和 `--color-group`，并提供场景化辅助色。

验收：

- `npm run check:skills`
- Canvas 编译测试
- routing eval：官网、看板、大屏、工作台、列表、详情、表单详情能选对页面类型和技能。
- generation eval 或线上截图：至少覆盖奶茶官网 + 经销商看板 + 工作台 + 列表 + 详情。

### P1：IR 与 CLI 支持

目标：让设计决策和新模板路由进入可执行 spec。

- Page IR 支持 `researchLevel`、`appBlueprint`、`archetype`、`interactionProfile`、`insights`。
- `generate-page` 支持从 spec 读取这些字段。
- `generate-page` 将 dashboard/list/detail/workbench 路由到新模板，而不是继续挤进 `product-homepage`。
- 完整应用创建流程把应用蓝图写入 PRD 或 `.cache/openyida/page-specs`。

验收：

- `tests/page-ir.test.js`
- `tests/generate-page.test.js`
- spec round-trip：字段不丢失。

### P2：模板深化与组件化

目标：在 P0 模板基线可用之后，把重复视觉原子沉淀为稳定组件和更强动效。

- 把 KPI/Chart/Rank/Insight/Freshness 等契约沉淀为模板内可复用 primitive。
- 把官网 hero、产品图廊、信任背书、CTA band 沉淀为 section pattern。
- 把列表筛选栏、批量操作条、详情抽屉、空/载/错态沉淀为 list primitive。
- 把详情页对象 hero、元信息侧栏、时间线、关联对象沉淀为 detail primitive。
- 为 dashboard/screen 增加更稳定的图表主题、背景层、动效和响应式降级。

验收：

- Canvas 编译测试。
- 线上 demo：奶茶应用、律所官网、水质大屏、运营工作台、订单管理列表、客户档案详情。
- 截图评分或人工 rubric：官网素材、看板洞察、工作台入口主次、列表可扫读、详情反字段墙、主题跟随、布局层次。

### P3：素材与调研工具化

目标：兼顾速度和真实感。

- CDN 配置检测与素材上传流程固化。
- 支持轻量公开图库 URL 校验。
- 支持 AI 图片生成后上传 CDN。
- enhanced/deep research 可选择接入浏览器或搜索工具。

验收：

- 无 CDN 时不声称已上传。
- 有 CDN 时图片可转存并回填 spec。
- 官网生成不会在无素材情况下交付“最终版”。

## 11. 测评与质量门槛

### 11.1 路由测评

新增场景：

| Prompt | 期望 |
| --- | --- |
| “帮我做奶茶品牌应用，有官网首页和经销商看板” | 产生应用体验蓝图，landing + dashboard |
| “做水质实时监控预警系统” | `data-screen` |
| “做律所官网首页” | `official-homepage` + light research |
| “做运营工作台” | `product-homepage --scene workbench` |
| “做库存经营看板” | dashboard overview + KPI/图表/告警 |
| “做订单管理页，能筛选处理订单” | list + 筛选/表格/详情抽屉 |
| “做客户档案详情页” | detail + 单对象叙事/章节/时间线 |
| “美化这个表单详情页” | `yida-form-detail`，不走自定义页模板 |

### 11.2 生成质量 rubric

| 维度 | 及格线 |
| --- | --- |
| 页面类型 | 官网不像工作台，看板不像官网，大屏不像普通看板 |
| 主题 | 默认跟随 `#yida-global-theme`，不硬编码主色 |
| 素材 | 官网有真实/验证/生成素材策略 |
| Dashboard | 有 KPI 主次、图表、排行/明细、洞察 |
| Workbench | 欢迎区克制，入口分组有主次，待办/动态可操作 |
| List | 筛选克制，表格列有主次，状态标签不过量，三态齐全 |
| Detail | 不是字段墙，有对象 hero、具体章节、时间线/关联对象 |
| 信息架构 | 多页面应用有导航分组和角色路径 |
| 去 AI 味 | 无 emoji，无彩色渐变卡片瀑布，无空泛文案 |
| 可运行 | Canvas 编译通过，线上 Schema 为 `YidaCodeCanvas` |

## 12. 关键原则

1. **先设计应用，再生成页面**：多页面应用必须先有应用体验蓝图。
2. **先轻量调研，再写官网**：默认 30-90 秒，不做竞品报告，但不能完全不想。
3. **每个场景都有自己的纪律**：工作台重动作，列表重可扫读，详情重对象叙事，dashboard 重洞察，官网重叙事和素材。
4. **Dashboard 是信息产品，不是卡片拼图**：必须有分组、主次和洞察。
5. **宜搭主题默认运行态跟随**：`yida-app-theme` 不等于写死一套颜色。
6. **模板代码与技能文档分离**：`lib/samples` 放可执行模板，skill 放选择和质量规则。
7. **模板演进当前化**：P0 就要改关键模板；P2 只做深化和组件化，不承担“第一次变好看”的责任。

## 13. 推荐下一步

建议按以下顺序推进：

1. 先做 P0-A + P0-B：同时补 `yida-page-uiux` 全场景 references，并新增/拆分 `dashboard-overview`、`workbench-home`、`business-list`、`detail-profile` 等模板。
2. 跑 routing eval + Canvas 编译测试，确认“选得对”和“模板能跑”同时成立。
3. 做一次 generation eval 或线上测试，覆盖官网、看板、工作台、列表、详情，直接看截图质量。
4. 再做 P1，把新决策字段和新模板路由沉淀到 Page IR、manifest 和 CLI。
5. 最后做 P2/P3：组件化、素材上传、轻量调研工具化和更高级动效。

这样可以避免两个极端：只改 skill 导致模板仍旧，或者只改模板导致 agent 仍然选错场景。
