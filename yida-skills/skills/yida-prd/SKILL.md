---
name: yida-prd
description: 读取整理后的用户需求，生成 prd/<项目名>/prd.md，负责业务、资源、页面、顺序和验收规则。
---

# yida-prd

本技能读取 `yida-requirement-analysis` 整理的用户需求，生成 `prd/<项目名>/prd.md`；不生成 `design.md` 或页面源码。

## 使用场景

- 从零搭建或补齐完整应用：用户需求整理完成后启动，可与 `yida-design` 并行。
- 已有会议需求稿，需要整理成完整应用 PRD：先统一整理用户需求，再运行本技能。
- 只做视觉美化、页面实现、字段或权限操作：使用对应单点技能。

## 执行条件

- 开始：`.cache/openyida/<项目名>/requirement-brief.json` 已存在且可解析。
- 完成：`prd/<项目名>/prd.md` 已写入并通过下方完成条件；只写完部分章节不算完成。
- 失败：PRD 不完整时只重跑本技能，不重跑或覆盖已经完成的 `design.md`。

## 标准流程

1. 读取 [整理后的用户需求](workflow/step-1-read-brief.md)。
2. 按 [页面与导航规划](workflow/step-2-information-architecture.md) 形成业务资源蓝图。
3. 按 [PRD 输出格式](workflow/output-prd.md) 写入 `prd/<项目名>/prd.md`。

## 核心规则

1. PRD 只写业务目标、角色、对象、字段语义、资源、页面结构、数据来源、业务逻辑、三种顺序和验收标准。
2. 视觉规则只写主题色和风格摘要，并通过 `designFile` / `designRefs` 引用并行产出的 `design.md`。
3. 用户存在 `explicitScope` 时，页面、表单、流程、报表和本轮交付范围不得扩展。
4. `appType`、`formUuid`、`fieldId`、`processCode` 等真实 ID 不得编造；运行 ID 由实现阶段写入 `.cache/<项目名>-schema.json`。
5. 每个 display 页面必须有 `pageSpecHandoff`，明确场景、区块、数据来源、主操作、`designFile` 和 `designRefs`。

## 完成条件

- `prd/<项目名>/prd.md` 存在。
- PRD 包含资源创建顺序、页面实现交付顺序、导航顺序和验收标准。
- 资源蓝图覆盖必要表单、流程、页面及明确要求的报表/集成/权限。
- 每个 display 页面都有可供一致性校验的 `pageSpecHandoff`。
- 没有写入 `design.md` 或页面源码。

## 参考

- [应用结构参考](references/app/blueprint.md)
- [导航模式参考](references/app/navigation-patterns.md)
- [角色旅程参考](references/app/role-journey.md)
