# Step 2：需求分析与设计

本阶段对应的用户待办：

- 需求识别与分析
- 设计功能和页面
- 确认搭建方案（仅 Plan）

## 2.0 先分析并确认需求

调用 `yida-requirement-analysis`，按 [首轮需求分析](../../yida-requirement-analysis/workflow/prepare-brief.md) 读取必需来源，尽早确认核心功能和关键用法。该技能统一负责提问、答案合并和需求记录；完成后进入规划准备。

取得 `intake.confirmed=true` 的 brief 后进入规划准备；已有确认记录且需求未变化时直接复用。

### 规划准备

澄清结束后，完成以下准备；字段格式按 [交接契约](../../yida-requirement-analysis/references/handoff.md#规划阶段补齐) 写回同一份 brief：

1. 按 Step 1 核验确实需要的资源上下文，保留用户显式目标；仅整理需求或编写方案时不要求登录，不执行资源写操作。
2. 按 [模式路由](../../yida-design/references/design-mode.md) 确定执行方式，沿用用户最后一次明确选择。
3. AI 根据有效功能、`userTasks` 与 `entryRecommendation`，按 [导航决策](../../yida-design/references/navigation-decision.md) 规划各入口的页面和菜单，补齐稳定 `pageScenes` 与主题映射。新增建议标记来源，范围遵守 explicitScope。

Fast / Plan 的主题与配色统一按[设计方向比较](../../yida-design/references/theme-selection.md#设计方向比较)在本轮规划中选定，结果写回 brief，后续直接复用。两种模式使用同一组三方向生成规则：Fast 内部选一套；Plan 在用户未给出明确完整风格时，先由 `yida-design-plan` 生成恰好三套候选并调用 `ask_human`，获得选择后才能继续 Plan 初始化。

进入 2.1 前校验规划字段完整性和 `intake.designMode`。页面、导航、主题等建议随整体搭建方案展示。

执行规划前读取 `constraints.prohibitedActions`。PRD 与 design 必须把禁止项写成实现门禁：`theme-file` 禁止时沿用现有平台主题且不安排主题文件任务；`page-source` 禁止时只允许只读核查与非源码配置；`publish` 禁止时把发布明确标记为跳过。不得为了满足默认九步流程静默删除这些约束。

按 [访问态入口契约](../references/entry-navigation.md) 为每个入口补齐角色、默认任务、菜单、资源/视图/操作权限。Fast PRD 与 Plan execution.entryRecommendation 共用契约；管理端按 [首页按任务选择](../../yida-requirement-analysis/references/experience-groups.md#首页按任务选择) 确定默认任务；需要汇集办事入口时设计业务工作台，无汇总价值时直接进入业务页。

前台和后台都按 [首页与菜单顺序](../references/entry-navigation.md#每个入口都确定首页与菜单顺序) 确定默认页面、菜单及分组顺序、打开后的首屏任务。顺序写入各入口 `menu`，默认页写入 `defaultMenuKey`；不沿用资源创建顺序，不把前台首页自动放进后台，也不将自定义导航视为无需排序。

## 2.1 按已确认方式推进

按 [模式路由](../../yida-design/references/design-mode.md) 读取本次选择：

- Fast：继续 2.2–2.3；已有详细需求直接作为规划基础。
- Plan：执行 [Plan 编排](plan/workflow.md)，用户确认当前方案后，按返回的 `assetTasks` 启动素材任务，同时进入 Step 3 创建应用。

Plan 分支从已加载 `yida-app` 的 Available Files 读取精确路径 `workflow/plan/workflow.md`；不要把当前文件名当目录拼成 `workflow/step-2-design/plan/workflow.md`，也不要用 Glob 猜路径。

共享需求只整理一次。创建出的资源 ID 写入执行上下文；用户需求或范围实质变化时再更新需求与相关规划。需求文件与实施文档供内部执行，Plan 的 HTML 用于用户查看和确认方案。

## 2.2 同时生成 PRD 和视觉设计

需求确认完成后，按 [并行执行](parallel-work.md) 同时启动：

| 内容 | 负责技能 | 输出 | 完成条件 |
| --- | --- | --- | --- |
| Product PRD | `yida-prd` | `prd/<项目名>/prd.md` | 资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序、页面 handoff 和验收标准完整 |
| Visual Design | `yida-design` | `prd/<项目名>/design.md` | 导航、应用框架、表单、详情与自定义页面共用完整主题 token；布局、材质、形状、密度、组件、状态、响应式和页面场景引用完整 |

两个技能读取同一份已确认需求，业务规划与基础视觉同时准备；页面任务、区块和 sceneKey 确定后补齐逐页视觉绑定。各自维护职责内的文件。某一份生成失败时只重跑对应技能，不覆盖已经完成的另一份。

## 2.3 校验两份结果

`yida-app` 必须等待两个文件都生成完成，再执行 `openyida check-design prd/<项目名>/design.md --prd prd/<项目名>/prd.md --json`。Fast 的设计步骤先完成单文件检查，合并时补上述关联检查；Plan 物化内部调用同一校验。检查：

- 两个文件路径存在且非空；
- PRD 每个 display 页面的 `designFile` 指向当前 `design.md`；
- PRD 的 `designRefs` 在 `design.md` 中可定位；
- 页面场景、主题摘要和 `explicitScope` 没有冲突；
- 冲突时业务范围交给 `yida-prd` 修正，视觉规则交给 `yida-design` 修正，不由 `yida-app` 猜测覆盖。

校验未通过时 Step 2 未完成，不得进入资源创建。校验通过后，后续页面实现以 `prd.md` 和 `design.md` 为准；`page-spec.json` 只用于把要求传给页面实现阶段。

## 2.4 条件式素材分支

`design.md.assetStrategy` 按页面分级：

- 商品目录、品牌、营销和媒体展示页通常为 `required`；
- 门户、工作台、档案、知识库和引导页有图片槽位时为 `beneficial`；
- 表单、审批、台账、设置和库存流水默认 `none`。

Fast 设计就绪后按 [素材调度](parallel-work.md#素材与页面同时推进) 派发 `yida-image-assets` 后台任务，记录任务编号后主流程继续创建应用、表单和页面，有图页面先做布局、数据绑定和交互。Plan 在方案确认后启动同一流程。各页及同页各图片位置并发搜索，每个位置一张、最多两轮。每页草稿就绪即执行 `asset resolve --design design.md --page-id <pageId>`；允许外链的图片直接交付，上传时追加 `--app-type <真实appType>`，写入独立清单；页面按自身状态接图并验收。

## 主题文件实现指令

在设计中同时确定导航、应用框架、表单、详情与自定义页面的整体风格。命名模板提供完整导航 token 与派生的导航明暗，自由创意明确填写；布局沿用业务规划。未禁止 `theme-file` 时，Plan 使用 CLI 返回的 `outputs.theme`，Fast 按 [主题文件生成与更新](../../yida-design/workflow/output-design.md#cli-token-契约fast--plan-共用) 准备主题 CSS；用户确认计划或主题后即可启动 CSS 生成，不等待表单或页面开发。Plan 已生成当前版本的 CSS 时直接复用。拿到真实 appType 后，在应用级配置同一份主题文件，与表单创建和页面开发并行；页面组件按已确认契约消费主题 token。若 `theme-file` 被禁止，跳过生成、复制、修改和上传，沿用现有平台主题并在交付中说明未更改主题。详见 [主题与业务资源的依赖](parallel-work.md#主题与业务资源的依赖)。

## 产出

进入 Step 3 前，必须确认：

- `prd.md` 和 `design.md` 路径存在；
- 若选择 Plan Design，`meta.planState` 已确认当前最新搭建计划版本；
- PRD 写明资源创建顺序、页面实现交付顺序、导航顺序或明确兜底策略；
- PRD 写明业务表单、流程表单、主页面和可选报表/大屏/权限等资源蓝图；
- `design.md` 能直接指导后续页面实现，不需要页面技能再反推视觉方向。

## 下一步

→ [Step 3：创建或复用应用](step-3-create-or-reuse-app.md)
