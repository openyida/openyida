---
name: yida-requirement-analysis
description: 识别并读取需求来源，理解和澄清用户需求，输出供 PRD 与视觉设计共同使用的需求事实。
---

# yida-requirement-analysis

本技能负责来源识别、内容读取、需求理解与澄清，结合已确认资源输出 `requirement-brief.json`。

## 流程

按 [整理需求事实](workflow/prepare-brief.md) 完成来源读取、范围澄清和输出校验。Fast 与 Plan 使用同一套需求整理流程；Plan 的范围与导航问题由 `yida-app` 与视觉选项统一呈现，回答由本技能写回共享需求事实。

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
| `navigation` | 应用导航决策：`type`、`source`、`reason`；类型遵守四类导航契约，未决时 type 为 null，规划前补齐 |
| `resourceContext` | 已确认可复用的 app/page/form/process 业务上下文，不写猜测 ID |
| `explicitScope` | 用户明确指定的页面、表单、流程、报表、导航项和本轮范围；没有时为 `null` |
| `brandHints` / `colorHints` | 明确的品牌、参考页面、已有主题、偏好色与避用色 |
| `constraints` | 组织、设备、权限、交付等约束 |
| `assumptions` / `openQuestions` | 可安全默认的事项与会改变范围的未决问题 |

## 交付与更新

- brief 必须可解析，项目名、目标、用户、对象、功能、场景及范围完整；会改变资源范围、权限或业务对象的问题写入 `openQuestions`，由编排组织确认后再进入规划。
- 用户指定的资源和范围原样保留在 `explicitScope`；真实 ID 有证据时写入 `resourceContext`。
- 需求文件校验通过后保持不变。后续创建出的真实 ID 写入 schema 或当前任务资源上下文。
- 用户需求或已确认范围实质变化时，由本技能更新 brief，并交给 `yida-app` 同步业务与视觉规划。
