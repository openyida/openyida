---
name: yida-prd
description: 基于整理好的需求事实编写或修改业务 PRD，负责业务、资源、页面、顺序和验收规则。
---

# yida-prd

**Fast 完整应用输入**：由 yida-app 从已确认需求和真实执行回执直接交接，按 [Fast 阶段映射](../yida-app/references/fast-context.md) 使用业务、页面、app_theme.css 与按页素材；不要求 build-context 或完整业务 JSON，不阻塞应用创建。下方要求 PRD/design.md 的文档生成、关联检查与 page-spec 派生步骤仅适用于 Plan/已有文档任务；Fast 不补写长文件。共用业务、数据、权限、样式和发布验收规则照常执行。


本技能负责业务规划，基于 `yida-requirement-analysis` 的需求事实生成 `prd/<项目名>/prd.md`。适用于完整应用的初次规划与业务方案调整。

## 输入与执行

读取 `.cache/openyida/<项目名>/requirement-brief.json`。发现影响规划的需求缺口时，将具体问题交回 `yida-requirement-analysis`，由 `yida-app` 组织澄清。

PRD 编写、修改与确认均保留 brief 的 `visualSelection`、已选 themeId 和选择来源。交给视觉设计时按[已选风格只确认一次](../yida-design/references/theme-selection.md#已选风格只确认一次)直接补齐配色和页面细节，不重问风格，不重新比较候选；选择记录缺失时先从真实历史回答恢复。

开始规划前复用 brief 的 `navigation.type/source/reason`；导航未补齐时由应用编排按 [导航决策](../yida-design/references/navigation-decision.md) 作出 AI 判断，不交回首轮、不另设强制技术选择题；用户明确选择时保留其要求，按导航决策中的导航交付与确认规则处理。Plan 将该类型写入 `execution.appConfig.navigationType`，Fast 在当前任务中交接同一选择和依据。

基于输入事实，按 [页面与导航规划](workflow/step-2-information-architecture.md) 形成业务资源蓝图，再按当前模式交付：

| 模式 | 执行与完成条件 |
| --- | --- |
| Fast | 不生成独立 PRD 或完整 JSON；直接按已确认需求与真实回执实施，业务规则在操作处检查 |
| Plan | 按 [计划业务规划](workflow/plan-business.md) 补齐 `build-plan.json` 的 `overview`、`dataModels`、`businessFlows`、`pages` 和业务 `execution`，交给 `yida-app` 调用 CLI 派生同一契约的 PRD |

修改已有 PRD 时，只读并修改相关业务内容及其引用。Plan 按 [局部调整](../yida-app/workflow/plan/step-4-deliver.md#4-处理调整) 更新源字段，由 CLI 同步文档；直接维护已有 Markdown PRD 时，只修改对应章节。

## 业务要求

- PRD 的业务说明和验收标准遵循 [用户可见表达契约](../yida-design/references/ask-human-interaction-contract.md)，用功能和使用效果描述方案；接口参数及配置键值写入 Agent 实施交接。Plan 的摘要、规则和验收文案会直接展示在 HTML 中，填写时使用同一业务表达。
- 消费 brief 的 `userTasks` 和 `entryRecommendation`，将已选业务任务映射到页面、流程和访问路径；双入口不等于两个应用，不新增未选后台，业务管理入口不使用开发后台 `/admin` 代替。Plan 在现有页面/流程/执行字段表达这些要求，不新增未支持的 facts 字段。
- 规划目标、角色、对象、字段语义、流程、资源、页面任务、数据来源和验收标准；写清资源创建、页面实现交付和导航三种顺序。
- 用户存在 `explicitScope` 时，以该范围规划页面、表单、流程、报表和本轮交付。
- Fast 的简单官网按 [展示范围与依赖](../yida-app/workflow/fast-build.md) 规划实际需要的资源；展示案例、联系方式不自动增加内容管理后台、表单与示例数据写入。用户已要求数据库、提交保存、后台维护、角色或数据隔离时，完整保留对应业务资源和服务端权限。
- 真实 `appType`、`formUuid`、`fieldId`、`processCode` 以资源证据为准；实现阶段产生的 ID 写入 `.cache/<项目名>-schema.json`。
- 每个 display 页面提供 `pageSpecHandoff`，包含场景、区块、数据来源、主操作，以及指向对应 `design.md` 的 `designFile` / `designRefs`。视觉细则由 `yida-design` 维护。
- 在已有页面任务、区块说明和验收中写清使用环境、操作频率、行动前必需的信息，以及返回页面时需要保留的状态。证据不足时标明假设，仅对会改变业务范围的缺口澄清。PRD 按比较、逐条处理或录入等任务确定信息需求；宽窄布局由设计阶段决定，复用已有字段记录。
- 导航结构、菜单顺序和默认入口由业务任务确定；导航外观与应用框架、表单、记录详情和自定义页面交给 `yida-design` 统一设计。PRD 保留整体风格摘要与设计引用，完整 token 和消费规则只在 `design.md` 维护。

任务涉及对象识别、证据或外观比较时，核对真实图片/附件字段与对象的关联，将其纳入已有数据来源与字段映射；没有字段时记录缺口，不凭美化新增字段。图文呈现与无图降级交给[任务驱动的视觉设计](../yida-design/references/task-driven-visual-design.md)，不把网络示意图当作真实对象资料。

## 按需参考

- [应用结构](references/app/blueprint.md)：规划资源与页面关系。
- [导航模式](references/app/navigation-patterns.md)：安排导航结构。
- [角色旅程](references/app/role-journey.md)：规划跨页面业务流程。
