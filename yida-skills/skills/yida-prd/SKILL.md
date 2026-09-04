---
name: yida-prd
description: 基于整理好的需求事实规划业务，生成 prd/<项目名>/prd.md，负责业务、资源、页面、顺序和验收规则。
---

# yida-prd

本技能负责业务规划，基于 `yida-requirement-analysis` 的需求事实生成 `prd/<项目名>/prd.md`。适用于完整应用的初次规划与业务方案调整。

## 输入与执行

读取 `.cache/openyida/<项目名>/requirement-brief.json`。发现影响规划的需求缺口时，将具体问题交回 `yida-requirement-analysis`，由 `yida-app` 组织澄清。

基于输入事实，按 [页面与导航规划](workflow/step-2-information-architecture.md) 形成业务资源蓝图，再按当前模式交付：

| 模式 | 执行与完成条件 |
| --- | --- |
| Fast | 与 `yida-design` 并行，按 [11 章 PRD 契约](workflow/output-prd.md) 写入完整 `prd.md` |
| Plan | 按 [计划业务规划](workflow/plan-business.md) 补齐 `build-plan.json` 的 `overview`、`dataModels`、`businessFlows`、`pages` 和业务 `execution`，交给 `yida-app` 调用 CLI 派生同一契约的 PRD |

Plan 的业务调整通过字段级 patch 更新源事实，再由编排重新物化和确认。

## 业务要求

- 规划目标、角色、对象、字段语义、流程、资源、页面任务、数据来源和验收标准；写清资源创建、页面实现交付和导航三种顺序。
- 用户存在 `explicitScope` 时，以该范围规划页面、表单、流程、报表和本轮交付。
- 真实 `appType`、`formUuid`、`fieldId`、`processCode` 以资源证据为准；实现阶段产生的 ID 写入 `.cache/<项目名>-schema.json`。
- 每个 display 页面提供 `pageSpecHandoff`，包含场景、区块、数据来源、主操作，以及指向对应 `design.md` 的 `designFile` / `designRefs`。视觉细则由 `yida-design` 维护。

## 按需参考

- [应用结构](references/app/blueprint.md)：规划资源与页面关系。
- [导航模式](references/app/navigation-patterns.md)：安排导航结构。
- [角色旅程](references/app/role-journey.md)：规划跨页面业务流程。
