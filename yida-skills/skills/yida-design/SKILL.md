---
name: yida-design
description: 宜搭设计统一入口。完整应用设计时先在 Fast Design 与 Plan Design 之间路由；单页 UI 改造、主页面视觉设计、应用主题色或全局换肤直接进入 Fast Design。两个分支统一产出 prd/<项目名>/prd.md 与 prd/<项目名>/design.md，本入口不写页面源码。
---

# 宜搭设计统一入口

本技能只负责选择设计模式并加载对应子技能，不重复实现产品设计、视觉设计或搭建计划。

## 路由规则

先判断当前任务是否属于 `yida-app` 的完整应用搭建 / 补齐流程：

| 场景 | 路由 |
| --- | --- |
| 单页 UI 改造、页面美化、主页面视觉设计、主题色或全局换肤 | 直接加载 [yida-design-fast](sub_skill/yida-design-fast/SKILL.md) |
| 完整应用，用户明确说“直接生成 / 直接搭建 / 不用计划 / 跳过计划 / 按默认方案” | 直接加载 [yida-design-fast](sub_skill/yida-design-fast/SKILL.md) |
| 完整应用，用户明确说“先出计划 / 先对焦 / 先确认需求 / 搭建计划 / 确认后再生成” | 直接加载 [yida-design-plan](sub_skill/yida-design-plan/SKILL.md) |
| 完整应用，用户未表达模式偏好 | 执行下方 Gate |

## Fast / Plan Gate

仅在完整应用且模式不明确时询问一次：

- **Fast Design（快速设计）**：根据现有需求直接完成产品设计，随后进入应用生成。
- **Plan Design（计划设计）**：先对焦需求并生成可调整的搭建计划，用户确认后再进入应用生成。

路由判断在内部完成。用户可见的进度说明、选择题和确认消息统一执行 [用户交互与可见表达契约](references/ask-human-interaction-contract.md)，使用“直接开始搭建”和“先确认整体方案”等业务表达，不复述技能加载、Gate 判断、分支名称、步骤编号或状态字段。

按交互契约先处理不可读需求来源，再执行一次 `single_choice`：宿主提供结构化提问工具时必须实际调用；宿主没有该工具或调用失败时，才用普通对话提供同样的二选一并等待回答。将结果和原因写入当前会话的 `designMode`、`gateReason`，不替用户选择，也不把模式选择写进 `build-plan.html`。

用户选择后，本轮保持该模式，不重复询问：

- Fast → 加载 `sub_skill/yida-design-fast/SKILL.md`。
- Plan → 加载 `sub_skill/yida-design-plan/SKILL.md`。

## 分支交接契约

两个分支进入 `yida-app` Step 3 前都必须具备：

- `prd/<项目名>/prd.md`
- `prd/<项目名>/design.md`

Fast 分支完成双文件后直接返回 `yida-app`。

Plan 分支只有在用户明确确认当前搭建计划后才算完成；确认前停留在 Plan 分支继续调整，不得进入 Step 3。用户确认后，以 Plan 分支同步的最终 `prd.md` 和 `design.md` 直接返回 `yida-app`，不得再加载 Fast 分支或重新执行产品设计。

若当前会话已经存在用户对最新搭建计划的明确确认，直接按 Plan 已完成处理，不再次执行 Gate。

Plan 的“最新计划”按 `build-plan.json` 中 `meta.revision`、`meta.status` 和 `meta.planState` 判定。只有 `meta.status=confirmed`、`planConfirmed=true` 且 `meta.revision=presentedRevision=confirmedRevision` 时，才能进入 `yida-app` Step 3。

## 参考文件

| 文件 | 何时读取 |
| --- | --- |
| [用户交互与可见表达契约](references/ask-human-interaction-contract.md) | 所有用户可见进度消息、Gate 提问、Plan 需求确认、搭建计划展示和最终确认 |

## 禁止事项

- 不在统一入口内复制 Fast 或 Plan 的业务规则。
- 不同时加载两个分支。
- Plan 确认后不再运行 Fast，避免二次设计和覆盖已确认事实源。
- 不在本技能中创建、修改或发布宜搭资源。
