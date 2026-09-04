---
name: yida-requirement-analysis
description: 整理完整应用的用户需求与现有资源，供 PRD 和视觉设计共同使用。
---

# yida-requirement-analysis

本技能先统一整理用户需求和已确认资源，写入 `requirement-brief.json`。它不生成 PRD、视觉设计或页面源码。

## 使用场景

- 从零搭建或补齐完整应用：先运行本技能，再并行加载 `yida-prd` 与 `yida-design`。
- 只改字段、流程、页面源码、权限或发布：使用对应单点技能，不运行本技能。

## 输出

写入 `.cache/openyida/<项目名>/requirement-brief.json`：

| 字段 | 内容 |
| --- | --- |
| `schemaVersion` | 固定为 `1` |
| `projectName` | 稳定的项目目录名 |
| `appName` | 用户可见的应用名称候选 |
| `industry` / `appType` | 业务领域和应用类型 |
| `targetUsers` | 核心角色和使用场景 |
| `businessGoals` | 要解决的问题和成功结果 |
| `coreFunctions` | 核心功能与必要辅助功能 |
| `businessObjects` | 客户、订单、项目、工单等核心对象 |
| `pageScenes` | 工作台、列表、详情、看板等页面场景候选 |
| `resourceContext` | 已确认可复用的 app/page/form/process 业务上下文，不写猜测 ID |
| `explicitScope` | 用户明确指定的页面、表单、流程、报表、导航项和本轮范围；没有时为 `null` |
| `brandHints` / `colorHints` | 明确的品牌、参考页面、已有主题、偏好色与避用色 |
| `constraints` | 组织、设备、权限、交付等约束 |
| `assumptions` / `openQuestions` | 可安全默认的事项与会改变范围的未决问题 |

## 规则

1. 读取用户原始需求和 Step 1 已确认的资源上下文，只记录可证实事实。
2. 用户明确给出的资源和本轮范围原样写入 `explicitScope`，不得扩展同级页面或业务对象。
3. 真实 `appType`、`formUuid`、`fieldId` 等 ID 只有已有证据时才可放入 `resourceContext`；不得猜测。
4. 会改变资源范围、权限或业务对象的未知项写入 `openQuestions`，不能静默假设。
5. 文件成功写入并通过 JSON 解析后，才允许生成 PRD 和视觉设计。
6. 需求文件校验通过后保持不变。后续创建出的 `appType`、`formUuid`、`fieldId` 等真实资源 ID 写入 schema 或当前任务资源上下文，不回写该文件；只有用户需求或已确认资源范围发生实质变化时，才重新整理需求并重新生成 PRD 和视觉设计。

## 完成条件

- `requirement-brief.json` 存在且是合法 JSON。
- 项目名、用户、业务目标、核心功能、业务对象、页面场景和范围信息完整。
- 没有生成或覆盖 `prd.md`、`design.md` 和页面源码。
