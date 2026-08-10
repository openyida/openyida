---
name: yida-prd
description: 生成 prd/<项目名>/prd.md，记录业务需求、资源结构、页面结构、数据关系、顺序和验收标准。
---

# yida-prd

本技能读取 `yida-requirement-analysis` 生成的共享需求简报，并生成 `prd/<项目名>/prd.md`。`design.md` 由 `yida-design` 同时生成，页面源码由页面技能实现。

## 何时使用

| 用户诉求 | 动作 |
| --- | --- |
| 从零搭完整应用、系统、平台 | 读取共享需求简报并生成 `prd.md`；可与 `yida-design` 同时执行 |
| 已有会议需求稿，需要整理成完整应用 PRD | 读取需求稿，补齐业务事实后写入 `prd.md` |
| 只改字段、流程、页面实现、发布或权限 | 不用本技能，交给对应子技能 |

## 必须做到

1. 先读取 `.cache/openyida/<项目名>/requirement-brief.json`，再写入 `prd/<项目名>/prd.md`。
2. PRD 只写业务事实、角色、数据对象、带唯一 `resourceKey` 的资源、页面结构、创建顺序、交付顺序、导航顺序和验收。
3. 每个 display 页面写薄 `pageSpecHandoff`，只包含页面结构、场景、区块、数据来源、主操作、`designFile` 和 `designRefs`。
4. 品牌和色彩只保留共享需求简报中的偏好摘要；完整视觉规则交给 `yida-design`。
5. `appType`、`formUuid`、`fieldId`、`processCode` 等真实 ID 不写进 PRD，运行后写 `.cache/<项目名>-schema.json`。

## 不要做

- 不写 `design.md`。
- 不写 JSX、TSX、CSS 或页面实现规则。
- `page-spec.json` 由页面实现阶段按需生成，不写入 PRD。
- 不编造真实 ID。

## 标准流程

| 步骤 | 读取文件 | 产出 |
| --- | --- | --- |
| 1. 读取需求简报 | [读取需求简报](workflow/step-1-read-brief.md) | 应用类型、核心用户、业务目标、业务对象 |
| 2. 规划页面和导航 | [规划页面和导航](workflow/step-3-information-architecture.md) | 页面清单、导航分组、表单/流程关系 |
| 3. 写入 PRD | [PRD 输出格式](workflow/output-prd.md) | `prd/<项目名>/prd.md` |

## 参考文件

| 文件 | 说什么 |
| --- | --- |
| [读取需求简报](workflow/step-1-read-brief.md) | 读取 `yida-requirement-analysis` 的共享输入 |
| [PRD 输出格式](workflow/output-prd.md) | `prd.md` 的结构和字段 |
| [应用结构参考](references/app/blueprint.md) | 应用角色、导航、页面、表单、流程资源蓝图 |
| [导航模式参考](references/app/navigation-patterns.md) | 平台导航、分组、顺序和页面入口 |
| [角色旅程参考](references/app/role-journey.md) | 用户角色、任务路径和权限边界 |

## 完成条件

- 已写入 `prd/<项目名>/prd.md`。
- 已读取 `.cache/openyida/<项目名>/requirement-brief.json`。
- 每个资源有唯一 `resourceKey`，导航顺序只引用 `resourceKey`。
- PRD 里有资源创建顺序、页面交付顺序和导航顺序。
- 每个 display 页面都有 `pageSpecHandoff`，并引用 `prd/<项目名>/design.md`。
- 没有写 `design.md` 或页面源码。
