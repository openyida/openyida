---
name: yida-requirement-analysis
description: 识别并读取需求来源，理解和澄清用户需求，输出供 PRD 与视觉设计共同使用的需求事实。
---

# yida-requirement-analysis

本技能负责来源识别、内容读取、需求理解与澄清，结合已确认资源输出 `requirement-brief.json`。

该文件只是一次性提问后保存的内部需求记录，不是另一份 PRD 或用户交付物。记录粒度与用户提供的信息一致，具体保存与复用规则见下方流程；不独立生成长文简报，不增加简报确认环节。

对用户的阶段名称统一为“需求分析”，进度直接说明正在分析的需求内容；技能名和执行身份仅用于内部调度。

## 流程

按 [整理需求事实](workflow/prepare-brief.md) 完成来源读取、范围澄清和输出校验。Fast 与 Plan 使用同一套需求整理流程；首次搭建的未决事项由 `yida-app` 集中询问，回答由本技能写回；确认完成后再进入业务和视觉规划。

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
| `pageScenes` | 已确认的页面与表单范围，记录稳定 key、name、kind、purpose 及已有细项 |
| `intake` | 首次搭建判断、来源详细程度、搭建方式和需求确认状态 |
| `visualSelection` | 已确认风格及其主题、主色、导航明暗映射 |
| `navigation` | 应用导航决策：`type`、`source`、`reason`，自定义导航增加 `variant`；类型遵守四类导航契约，未决时 type 为 null，规划前补齐 |
| `resourceContext` | 已确认可复用的 app/page/form/process 业务上下文，不写猜测 ID |
| `explicitScope` | 用户明确指定的页面、表单、流程、报表、导航项和本轮范围；没有时为 `null` |
| `brandHints` / `colorHints` | 明确的品牌、参考页面、已有主题、偏好色与避用色 |
| `constraints` | 组织、设备、权限、交付等约束 |
| `assumptions` / `openQuestions` | 可安全默认的事项与会改变范围的未决问题 |

## 交付与更新

- brief 必须可解析，已知的项目名、目标、用户、对象、功能、场景及范围准确且无遗漏；不为填满字段补造需求。会改变资源范围、权限或业务对象的问题写入 `openQuestions`，由编排组织确认后再进入规划；不影响范围的待设计细节由 PRD 或视觉设计补齐。
- 用户指定的资源和范围原样保留在 `explicitScope`；真实 ID 有证据时写入 `resourceContext`。
- 需求文件校验通过后保持不变。后续创建出的真实 ID 写入 schema 或当前任务资源上下文。
- 用户需求或已确认范围实质变化时，由本技能更新 brief，并交给 `yida-app` 同步业务与视觉规划。
