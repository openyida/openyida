# Step 2：需求分析与设计

## 2.0 先分析并确认需求

调用 `yida-requirement-analysis`，按 [需求分析与首次搭建确认](../../yida-requirement-analysis/workflow/prepare-brief.md) 整理来源、复用资源及用户已有计划，集中确认未决事项。首次搭建在必要回答写回、`intake.confirmed=true` 后继续。

## 2.1 按已确认方式推进

按 [模式路由](../../yida-design/references/design-mode.md) 读取本次选择：

- Fast：继续 2.2–2.3；已有详细需求直接作为规划基础。
- Plan：执行 [Plan 编排](plan/workflow.md)，用户确认当前方案后完成主题交接并进入 Step 3。

共享需求只整理一次。创建出的资源 ID 写入执行上下文；用户需求或范围实质变化时再更新需求与相关规划。需求文件与实施文档供内部执行，Plan 的 HTML 用于用户查看和确认方案。

## 2.2 同时生成 PRD 和视觉设计

需求确认完成后，按 [并行执行](parallel-work.md) 同时启动：

| 内容 | 负责技能 | 输出 | 完成条件 |
| --- | --- | --- | --- |
| Product PRD | `yida-prd` | `prd/<项目名>/prd.md` | 资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序、页面 handoff 和验收标准完整 |
| Visual Design | `yida-design` | `prd/<项目名>/design.md` | 主题 token、视觉 DNA、布局、材质、圆角、密度、组件、状态、响应式和页面场景引用完整 |

两个技能读取同一份已确认需求，业务规划与基础视觉同时准备；页面任务、区块和 sceneKey 确定后补齐逐页视觉绑定。各自维护职责内的文件。某一份生成失败时只重跑对应技能，不覆盖已经完成的另一份。

## 2.3 校验两份结果

`yida-app` 必须等待两个文件都生成完成，再执行一致性校验：

- 两个文件路径存在且非空；
- PRD 每个 display 页面的 `designFile` 指向当前 `design.md`；
- PRD 的 `designRefs` 在 `design.md` 中可定位；
- 页面场景、主题摘要和 `explicitScope` 没有冲突；
- 冲突时业务范围交给 `yida-prd` 修正，视觉规则交给 `yida-design` 修正，不由 `yida-app` 猜测覆盖。

校验未通过时 Step 2 未完成，不得进入资源创建。校验通过后，后续页面实现以 `prd.md` 和 `design.md` 为准；`page-spec.json` 只用于把要求传给页面实现阶段。

## 主题文件实现指令

在设计中确定配色、导航明暗和布局。Plan 使用 CLI 返回的 `outputs.theme`；Fast 按 [主题文件生成与更新](../../yida-design/workflow/output-design.md#cli-token-契约fast--plan-共用) 准备主题 CSS。进入 Step 3 后，在应用级配置同一份主题文件，页面组件消费主题 token。

## 产出

进入 Step 3 前，必须确认：

- `prd.md` 和 `design.md` 路径存在；
- 若选择 Plan Design，`meta.planState` 已确认当前最新搭建计划版本；
- PRD 写明资源创建顺序、页面实现交付顺序、导航顺序或明确兜底策略；
- PRD 写明业务表单、流程表单、主页面和可选报表/大屏/权限等资源蓝图；
- `design.md` 能直接指导后续页面实现，不需要页面技能再反推视觉方向。

## 下一步

→ [Step 3：创建或复用应用](step-3-create-or-reuse-app.md)
