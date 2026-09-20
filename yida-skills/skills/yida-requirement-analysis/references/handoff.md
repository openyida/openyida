# requirement-brief 交接契约

保存或更新 brief 时读取。写入 `.cache/openyida/<项目名>/requirement-brief.json`，供 PRD 与视觉设计共用。

## 兼容现有字段

保留 `schemaVersion: 1`、根级 `projectName` 和已有字段形态，按已有事实补充新关系字段。

| 字段 | 内容与阶段 |
| --- | --- |
| `appName` / `industry` | 应用名称候选、业务领域；真实应用标识写入 `resourceContext.app.appType`，不把业务类型当真实 ID |
| `targetUsers` / `businessGoals` | 使用者和目标，保持字符串数组；单个目标也写数组 |
| `coreFunctions` / `businessObjects` | 当前有效功能与对象，保持数组及原有细项；新建功能项可用 `{key,name,purpose}`，不强制改写旧字符串项 |
| `pageScenes` | 用户明确要求的页面及下游规划补齐的场景，使用 `{key,name,kind,purpose}`；kind 为 `custom-page/form/process-form/report`。首轮未知时为 `[]`，不把功能选择等同于页面选择 |
| `intake` | `firstBuild`、`sourceDetail: detailed/brief`、`designMode: fast/plan/null`、`confirmed`；confirmed 仅表示关键前置澄清完成 |
| `visualSelection` | 首轮保留 `visualDirection` 与已有主题/颜色要求；下游补齐主题映射。Plan 初始化前必须含非空 `themeId` |
| `navigation` | 应用工作区导航；首轮保留用户要求或既有决策，未知时 type 为 null；规划字段见下方“前后台导航交接” |
| `resourceContext` | 有证据的 app/page/form/process 复用上下文，不编造 ID；后续创建出的 ID 写入执行上下文或 schema |
| `explicitScope` | 用户明确页面、表单、流程、报表、导航与交付；窄范围含 `allowInferredResources:false`，无明确资源边界时为 null |
| `brandHints` / `colorHints` | 品牌、参考页面、主题、偏好色及避用色 |
| `constraints` | 组织、设备、权限、交付限制；`prohibitedActions` 同时保留禁止原文和规范化动作 `theme-file/page-source/publish` |
| `assumptions` / `openQuestions` | 分别记录可调整的建议，以及影响业务范围或实际用法的关键待答问题 |
| `userTasks` | `{key,user,functionRefs,source,reason}` 数组；functionRefs 引用有效功能的稳定 key，旧字符串项引用原文，不重复复制功能内容 |
| `entryRecommendation` | `{mode,source,reason,entries}`；mode 为 `unified/service-management/frontend-only/undetermined`，每项 `{key,name,taskRefs}` 引用 userTasks；可补 `role: service/management/workspace`、`sceneKey` 和 `presentationHint`。旧 unified 单前台记录仍可复用 |
| `evidence` | 必要时用 `{path,source,reason}` 数组为旧字段保留简短来源；path 使用 JSON Pointer 指向当前有效值，数组变化后同步更新 |

来源统一区分 `user_explicit`（用户直接说明）、`user_selected`（可见选项的回答）、`ai_inferred`（有业务依据的推导）、`ai_default`（技能默认建议）。导航沿用既有兼容规则：AI 决策写 `ai_default` 并在 reason 说明依据，用户明确指定归属才写 `user_selected`。用户委托的具体方案仍是 AI 推导，reason 保留委托依据。

## 保留式更新

- 按首轮分析得到的有效范围更新变化字段，保留其余已确认内容，同步移除失效角色、关系、入口及来源引用。
- `intake.designMode` 保留用户最后一次明确选择；用户改选时更新，尚未确定时为 null。具体路由按 [模式规则](../../yida-design/references/design-mode.md) 执行。
- 短需求保存简短事实及关系；已有字段、流程与页面细项完整保留。
- 用户禁止事项作为执行约束；与要求的结果直接冲突时说明并澄清。
- 明确只完成一个表单并交付链接时，`explicitScope.pages=[]`，仅保留对应 forms/delivery，Plan 按此资源范围执行。
- 中断恢复可保存 `confirmed=false` 草稿；收到关键问题的实际回答或明确委托后，按完成条件更新状态。

## 规划阶段补齐

由 `yida-app` 按 [规划准备](../../yida-app/workflow/step-2-design.md#规划准备) 补齐页面场景、导航和主题，AI 新增内容记录来源并遵守 explicitScope。

Plan 在 `design-plan init` 前必须补齐合法的导航字段（见下节）及 `visualSelection.themeId`。视觉沿用 `visualSelection` 的 `themeId/visualDirection/colorStrategy/navigationStyle`，AI 补齐颜色或主题时标记 `ai_default`。Fast 共用这些字段。主题 ID 尚未确定时，通过 `openyida design-plan catalog --json` 查询合法主题及页面模式，复用本轮查询结果。

补齐主题和颜色前，按[设计方向比较](../../yida-design/references/theme-selection.md#设计方向比较)完成一次内部比较；保留用户明确的风格，AI 建议记录具体业务依据。

`visualSelection.colorStrategy` 使用对象：`primaryColor` 填本项目选定的 6 位 HEX 色值，`primaryColorName` 填对应色名，`usage` 写配色依据及背景、主操作和强调色的关系。只有文字配色要求时也可先保存字符串；CLI 将原文放入 `usage`，并提示补齐 `primaryColor`。

PRD 将 userTasks 与入口建议转为页面的访问路径、任务和权限；Plan 的 business.json 使用现有 facts 契约，视觉设计共用入口和导航记录。

## 前后台导航交接

入口通过 sceneKey 关联页面，同一场景的多个业务视图共用一个页面资源。需求阶段保存建议，规划准备填写：

- 根级 `navigation`：应用工作区导航，包含 `type/source/reason`；type 为 `platform-l-shape/platform-top/platform-side/custom`，custom 另含 `variant: side/top/mixed/dock`。
- `pageScenes[].pageSpecHandoff.entryMode`：平台工作区为 `platform-shell`，独立入口为 `standalone`。
- 独立入口的 `pageScenes[].pageSpecHandoff.navigation` 仅含菜单字段：`{type:"custom",variant:"top",reason:"员工只需报修与查询"}`，variant 支持 top/side/mixed/dock；无菜单时为 `{type:"none",reason:"单步办理"}`；省略时沿用既有页面契约。

管理端采用自定义页面也默认使用 `platform-shell`；其 menu 描述平台任务，不直接渲染为页面导航。只读交接中的 `navigationPolicy` 由 CLI 派生，不写回 brief 或 pageSpecHandoff。导航按[方案讨论与确认](../../yida-design/references/navigation-decision.md#方案讨论与确认)随业务方案说明。

例如：报修前台为 standalone + custom，维修工作区为根级 platform-side。Plan 初始化保留 pageSpecHandoff，PRD、design 和计划分别展示各入口方案。导航执行和验证按 [导航壳配置](../../yida-nav-shell/SKILL.md#必做配置) 完成；页面访问范围和数据权限按用户要求独立配置。

规划阶段按 [访问态入口契约](../../yida-app/references/entry-navigation.md) 补齐 entryRecommendation.entries 的 role、menu、defaultMenuKey 和权限依赖。Plan 初始化保留建议并要求业务片段补齐；Fast PRD 使用同一结构。

## 保存校验

检查 JSON 与集合类型、稳定 key、功能/任务引用、来源标记及用户约束。`intake.confirmed` 按 [需求完成条件](../workflow/prepare-brief.md#3-依据有效功能推导入口) 设置；计划批准由计划版本状态记录。

需求未变化时直接复用，后续仅更新实际变化涉及的字段。
