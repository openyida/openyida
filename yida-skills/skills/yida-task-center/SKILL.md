---
name: yida-task-center
description: 仅在用户明确要求用自定义页面开发待办中心，或在应用搭建中通过 ask_human 明确同意该实现方式后使用。支持待我处理、我创建的、我已处理、抄送我的的自定义展示和原生办理入口。普通待办查询、原生任务中心、业务工单或未指定自定义实现的工作台不触发。
---

# 自定义待办中心

先核对用户已明确选择自定义实现及目标应用。仅提到待办中心、Fast 模式、已有 Canvas 页面或委托 AI 决定均不算选择；不要自行补确认记录。应用搭建中由 `yida-app` 先 ask_human，明确同意后才交接本技能；用户已显式要求时不重复问。

先确认数据与入口范围：当前应用（`scope=app`）还是当前用户在本组织所有应用（`scope=corp`）。用户只说“我的待办”且上下文不能确定范围时，必须通过 `ask_human` 确认，不能因正在编辑某个应用就默认应用范围。用户已明确范围时沿用，不重复询问。数量与点击入口必须使用相同范围；不把组织任务误称为所有组织。

按用户描述确定所需个人流程任务及交互，不按整页或区块划分业务能力。仅需接入某项任务数据时走 `yida-canvas-data-binding`，不强制使用本装配；业务记录的待处理状态也由数据绑定处理。

需要筛选时按需读取[个人任务筛选示例](references/task-filters.md)，包含四类任务的组合条件、候选项查询及初始配置片段。

需要数量、摘要或展开审批进度时，按需读取[流程任务能力与装配](../yida-canvas-data-binding/references/workflow-capabilities.md)；单条业务关联进度仍由数据绑定按需接入，不要求装配任务中心。

1. 复用 app/page、业务要求和 `design.md`；旧主题新增页按 [单页风格范围](../yida-design/sub_skill/page-design/SKILL.md#旧主题应用新增页面的风格范围) 确认。沿用该选择，不因接入任务数据重新选风格或升级主题。
2. 执行 `openyida task-center capabilities --json`，按返回的 specExample 派生配置。`customPage.source` 记录真实选择来源，`confirmed=true` 仅用于明确同意；`designFile` 指向当前应用设计文件。`kinds` 仅填写需求涉及的类型，不自动补齐其他栏目；承载方式沿用当前设计，不因接入任务数据另建页面。
3. 用 `openyida data query tasks <appType> --type <todo|created|done|cc> --normalized` 核查数据，再执行 `openyida task-center scaffold --spec <配置.json> --output <新文件.canvas.jsx>`。已有页面先备份，把生成的 `TaskInboxSection` 和依赖合并进原页面，已有主题容器和详情容器各保留一份。
4. 通过 `yida-canvas-custom-page` 的编译检查，再按 `yida-publish-page` 发布回读。检查所选类型的实际数据、分页、详情办理后返回刷新、移动端及应用各页面主题；没有浏览器证据时说明运行态待验。

接口、字段和详情路由由 CLI 装配，不手写另一套请求。CLI 样本属于本机登录人，发布后的页面通过平台桥读取实际访问者的任务，不能嵌入 CLI 凭证或静态查询结果。办理使用原生流程页，不自行新增页内同意或拒绝按钮。

我创建的包括普通表单和流程；我已处理不代表整个流程完成；抄送不是待审批。业务订单的待处理列表继续走业务数据绑定，不用流程任务接口代替。缺少能力、登录、权限或必要详情字段时展示真实错误或禁用入口，不以演示数据代替。
