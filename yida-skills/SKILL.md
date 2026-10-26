---
name: openyida
description: >
  宜搭应用开发总入口技能。通过具备代码生成能力的智能体（千问办公/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。
  当用户提到“宜搭”、“yida”、“低代码”、“创建应用”、“创建表单”、“发布页面”、“自定义页面模板”、“搭建”、“系统”等关键词时，使用此技能；只是讨论通用前端/后端代码、非宜搭平台产品、或只解释概念而不操作宜搭资源时不触发。
  重要路由规则：完整应用/系统/平台的从零搭建、已有 app 但没有任何页面、或已有 app/page 需要补成完整业务系统时，必须先加载 yida-app 子技能作为编排入口。已有资源的单点改字段、改页面、发布、权限或数据任务按对应子技能路由。
---

# 宜搭应用开发指南

在执行宜搭应用/页面/审批流等任务前先确认环境与登录态，再根据用户需求和已解析的 app/page/form/process 等上下文资源，分析任务属于完整搭建、已有资源补齐还是单点任务，并加载对应子技能执行。

完整系统不能只读本入口、查看 CLI 帮助后直接拼装命令：必须加载 `yida-app`，进入实施与收尾时继续读取对应 workflow。前后台场景默认是两个业务入口：前台页面自绘导航并持久化隐藏平台导航，后台使用原生导航，前台专用页面从后台 PC/移动端菜单隐藏；页面隐藏、菜单隐藏、权限和公开访问分别处理。两个入口均须实际打开验收，发布回读不代表交付完成。

Fast / Plan 选定的主题和主色属于整个应用：导航、原生页、自定义页共用项目 design.md 与同一份应用主题 CSS。不能只把自定义页写成品牌色、让应用继续默认蓝色；发布不会自动保存应用主题。完整搭建交付前按 yida-app 回读应用主题设置并实测各类页面，未同步或未验证不得宣称主题统一。

## 本地使用问题与贡献反馈

用户反馈 OpenYida 使用问题或体验建议、想贡献改进、不会提 Issue/PR，先加载 `yida-feedback`；没有 GitHub 账号或源码也可先整理材料。
它负责基于当前证据分析根因、生成脱敏本地材料，并按用户授权提交 Issue 或个人 Fork PR。无账号先引导注册，实在不行提示“反馈到AI开发者群”。
自动发现重复失败只建议并整理本地草稿，不自动公开提交。网页关联本地 Agent 异常先按下节诊断，需要反馈时再进入此技能。普通宜搭产品 VOC 清单仍用 `yida-voc`。

## 本地 Agent 故障分流

当用户描述“网页找不到本地 CLI / 电脑离线 / 本地 Agent 忙碌或不执行”，或提供
带 `sessionId=local_*` 的宜搭会话链接时，先读取并执行
[本地 Agent 诊断](references/local-agent-diagnostics.md)，不要先要求用户提供
`runId`、`runtimeId` 或日志文件。排障通常发生在另一个普通本地 Agent 会话中，
不能只依据 `OPENYIDA_MANAGED_RUN` 判断是否属于云端关联本地 Agent 场景。

## 云端关联本地 Agent 的业务澄清

只有当前工作区 `AGENTS.md` 明确声明这是 OpenYida managed local-agent Run 时，才可使用
`openyida agent ask-human`。当继续搭建确实缺少会改变业务结构的关键信息时：

1. 在当前工作区写入不含密码、Token、Cookie 或其他秘密的结构化问题 JSON；
2. 执行 `openyida agent ask-human --request-key <稳定业务键> --questions-file <相对路径> --json`；
3. 收到 `queued` 后立即结束当前轮次，不再执行写操作；用户在宜搭回答后，系统会在同一会话创建续接轮次。

问题文件使用本地 CLI 的 `questions` 数组，不能直接复制云端 `ask_human` 的顶层 `question/options/submitLabel` 对象。格式示例可通过 `openyida agent ask-human --help` 查看。

方案确认也使用同一命令：问题 JSON 顶层携带生成器返回的 `revision`、`attachments`，选项保留稳定 `value`。附件 `path` 是当前任务工作目录内显式声明的 HTML/Markdown/文本（每文件至多 1 MiB，至多 10 个），CLI 会冻结其内容，Runtime 上传成功后才展示问题。不要把本机路径作为网页链接，不扫描或上传整个目录。同一 request-key 不能换题或换文件；方案修改后使用新 key。续接上下文包含原方案标识、文件引用和结构化答案；确认后只能执行用户实际确认的方案，不能将旧答案套用到新稿。

受管任务中的素材命令 `asset resolve` 必须显式携带当前绑定应用的 `--app-type`；`materialize.assetTasks.resolve.argv` 已自动包含该参数，直接复用，不重复追加。手动构造命令时补入绑定应用。应用级数据、多语言、表单恢复和权限读取按统一命令声明校验目标；组织级连接器管理仍需普通 CLI 独立授权，不能通过当前应用任务扩大组织操作范围。

不要用普通 Markdown 问句、provider 原生业务问答或权限弹框模拟该能力。普通 OpenYida
本地使用、非 managed Run 和故障诊断会话都不得调用此命令；命令本身也会 fail closed。

## 步骤模版（进行时展示给用户看的步骤）

完整应用搭建时，直接使用对应模式的步骤名称。

**Plan 模式**

1. 需求识别与分析
2. 设计功能和页面
3. 确认搭建方案
4. 创建应用
5. 搭建表单与审批流
6. 准备示例数据
7. 准备页面图片
8. 搭建业务页面
9. 发布页面与配置导航
10. 检查功能并交付

**Fast 模式**

1. 需求识别与分析
2. 设计功能和页面
3. 创建应用
4. 搭建表单与审批流
5. 准备示例数据
6. 准备页面图片
7. 搭建业务页面
8. 发布页面与配置导航
9. 检查功能并交付

按本轮范围选用步骤：已有应用时省略“创建应用”，无需示例数据或图片时省略对应步骤，并重新编号。

每项待办对应一个阶段，直接使用上方短标题。创建应用、表单、数据、图片、页面和发布分别展示。执行中保持标题与列表顺序稳定，完成后标记完成并保留记录。图片准备与表单、页面搭建可同时进行，列表顺序仅用于展示。业务细节写在进度消息中，任务编号、命令、路径、授权依据和耗时写入内部执行记录；用户要求的耗时统计集中放入报告。素材采集与应用创建同时进行时，进度描述统一为“素材采集&应用创建”；单独进行时使用对应阶段名称。图片数量、用途及任务详情归入内部执行记录。

## 千问办公桌面端的后台准备

当前快照确认运行于千问办公桌面端时，安装、环境检查和自动登录按[后台准备规则](references/qwenwork-desktop-login.md)静默执行。用户只需要看到业务进度和业务结果。

## 执行步骤

### Step 1：环境与登录态确认

完整应用首轮需求澄清先按 `yida-app` 进入需求分析，只读取提问必需的需求材料，不以环境、登录或资源预检阻塞首问。需求澄清完成后，需要核验资源或准备执行时，再执行 `openyida agent-capabilities --summary-json`，确认 OpenYida、Node/npm、登录态和工作目录可用。`openyida agent-capabilities --json` 是完整能力信息，只在命令契约排障、manifest 差异诊断或深度调试时使用；不要把完整能力信息放进常规完整搭建链路。`workdir` 对应完整能力信息里的 `active.projectRoot`。

如果快照显示 `builder_path.interactive_login.mode=caller_open_url`，说明 CLI 已把浏览器归属交给 Agent。执行 `openyida login --no-browser` 后，Agent 必须优先调用当前宿主的沙箱浏览器 / 内置 Browser 打开 CLI 输出的授权 URL 一次；只有没有浏览器工具或工具调用失败时，才让用户手动打开链接。

未完成环境与登录态确认前，不创建应用、页面、表单，不发布页面。环境异常、登录失败、env token 注入和 `openyida copy` 初始化见 [环境准备与登录检测](references/setup-and-env.md)。

核心判断：

| 快照结果 | 动作 |
| --- | --- |
| `openyida` 不可用 | 先安装或更新 `openyida`，不创建资源 |
| 工作目录不存在 | 先执行 `openyida copy` 初始化工作目录 |
| 登录态可用 | 进入 Step 2 |
| 登录态缺失 | 按快照提示补登录态；未恢复前停止资源写操作 |

千问云端身份接入开发或宿主身份诊断，可显式运行 `openyida auth qwenwork user-info --json`；它只验证千问身份，不建立宜搭登录态，不能据此跳过上述宜搭 auth snapshot 检查。详细边界见 `yida-login`。

### Step 2：解析资源上下文

任何写操作前先解析目标 app/page/form/process。按本轮显式资源、外部绑定资源、workspace cache/config、会话历史的顺序选择目标；同级冲突或目标不明才询问用户。

执行 Step 2 时必须读取 [资源上下文与补齐判定](references/resource-context.md)，并按其中规则解析目标资源。已有 app 默认复用，不执行 `yida-create-app`；已有 app 但没有任何页面时，进入完整应用补齐；PRD 不需要页面时，不强制创建自定义页面。

核心判断：

| 已解析到 | 动作 |
| --- | --- |
| 目标 app | 复用该 app，在其中修改、补齐或发布 |
| 目标 app 但没有任何页面 | 进入完整应用补齐；PRD 不需要页面时不强制创建自定义页面 |
| 目标页面 / 表单 / 流程 | 修改已有资源，不创建同类新资源 |
| 目标缺失且用户明确允许创建 | 进入对应创建技能 |
| 多个同级候选或上下文冲突 | 先询问用户 |

### Step 3：意图识别

| 判定 | 用户诉求信号 | 下一步 |
| --- | --- | --- |
| 完整搭建 / 补齐 | 创建/搭建/做一个 + 应用/系统/管理系统；已有 app 没有任何页面；或已有 app/page 需要补成完整系统 | 加载 `yida-app` |
| 单一 / 增量任务 | 对已有应用/表单/页面做单点操作：加字段、查改数据、配公式、建报表、改权限、发布、美化等 | 从下方技能路由表选 1 个子技能 |

意图识别只决定入口，不展开执行细节。完整搭建 / 补齐加载 `yida-app` 后按其 workflow 执行；单点任务只选 1 个主技能，不升级成完整搭建。

### Step 4：加载子技能并执行

如果当前 AI 工具提供 `use_skill` / `search_skills`，必须用 `use_skill("<技能名>", "<本阶段目的>")` 加载技能，不用 `Read` / `read_file` / `cat` 直接读取 `SKILL.md` 路径。如果当前工具没有 `use_skill` / `search_skills`，按 `skills/<技能名>/SKILL.md` 定位当前阶段要执行的子技能文档。

单点任务按意图选 1 个主技能；完整应用由 `yida-app` workflow 分阶段推进，每一步加载当前步骤对应的子技能。`skills-index.json` 只给能读取索引的工具辅助匹配，不作为运行前置。执行边界见下方核心规则。

## 技能路由表

这张表给人工 fallback 和人审使用：先按用户任务命中一个大类目录，再在该目录内选定 1 个最匹配的子技能。机器索引和精排方法见 [路由补充说明](references/routing-supplement.md)。

`yida-data-card` 只在用户显式指定宜搭原生数据卡片，或继续已明确的原生卡片上下文时触发。泛称数据卡片、指标卡、看板、投放、数据播报或发送到群不满足条件；不能在完整应用搭建中自行添加原生数据卡片。用户主动提供原生卡片链接并要求操作该资源属于明确指定；否定原生时按实际页面、图表或自动化意图路由。按本次实际修改对象判断，提及或引用原生卡片不等于请求修改该资源。

`yida-cool-card` 只在用户明确指定宜搭原生酷卡片（交互卡片、置顶卡片），或继续已明确的酷卡片任务时使用。它使用 `cardPageCode`/`cardTemplateId`，独立于 `yida-data-card` 的 `CARD-xxx` 和页面中的展示卡片。`dataCardDesigner.html?cardCode=CARD-...` 属于原生数据卡片；酷卡片管理入口为 `coolCardManage`。创建前核对认证环境；集团版（`alibaba`）直接告知“集团版不支持酷卡片搭建”并停止搭建流程。名称与链接冲突时说明实际资源并核对目标，不能互换接口。泛称卡片、图表或群通知不自动选择这两类原生资源。

### 大类目录

| 大类目录 | 第一层意图信号 | 子技能 |
| --- | --- | --- |
| `yida-skills/context` | 登录、退出、切换组织、组织版本/容量、Schema、fieldId、执行前检查 | `yida-login`、`yida-logout`、`yida-basic-info`、`yida-get-schema`、`yida-corp-efficiency` |
| `yida-skills/app` | 从零搭应用、完整系统、应用启停、应用导航、多语言、AI 老应用主题升级 | `yida-app`、`yida-create-app`、`yida-app-lifecycle`、`yida-nav-group`、`yida-i18n`、`yida-upgrade-app-theme`（仅明确升级要求并 ask_human 确认） |
| `yida-skills/design` | 完整应用需求分析、PRD、视觉设计、单页 UI 改造、应用主题色、全局换肤、图片素材 | `yida-requirement-analysis`、`yida-prd`、`yida-design`、`yida-data-manage-ui`、`yida-image-assets` |
| `yida-skills/form` | 表单字段、公式、校验、业务关联规则、原生自定义按钮、打印模板、批量录入、数据记录 | `yida-create-form-page`、`yida-custom-button`、`yida-print-template`、`yida-form-view`、`yida-formula`、`yida-formula-evaluate`、`yida-business-rule`、`yida-canvas-table-form`、`yida-table-form`、`yida-data-management` |
| `yida-skills/process` | 审批、流程表单、流程规则、节点/分支/字段权限、流程代理 | `yida-create-process`、`yida-process-rule`、`yida-flow-node-config`、`yida-agent-center` |
| `yida-skills/page` | 工作台、办事门户、任务看板、自定义展示页、页面源码开发、平台 JSX 组件页面维护、页面发布、页面内导航、PPT 页面 | `yida-create-page`、`yida-canvas-custom-page`、`yida-custom-page`、`yida-canvas-data-binding`、`yida-task-center`（仅显式选择自定义待办）、`yida-canvas-upgrade`、`yida-publish-page`、`yida-openyida-publish-guard`、`yida-density`、`yida-nav-shell`、`yida-ppt-slider` |
| `yida-skills/analytics` | 用户显式指定宜搭原生数据卡片（含其投放播报）；聚合表、虚拟视图、报表、统计、图表、Recharts、ECharts、经营分析看板、驾驶舱、大屏 | `yida-data-card`、`yida-aggregate-table`、`yida-report`、`yida-rechart`、`yida-chart`、`yida-dashboard` |
| `yida-skills/integration` | 用户明确指定宜搭原生酷卡片；连接器、钉钉开放平台、外部 API、执行动作、设计器数据源、集成自动化、逻辑流 | `yida-cool-card`、`yida-integration`、`yida-flow-node-config`、`yida-dingtalk-openapi`、`yida-connector`、`yida-connector-safe-actions`、`yida-data-source-connectors` |
| `yida-skills/access` | 平台/应用/表单/页面权限、公开访问、分享 | `yida-corp-manager`、`yida-app-permission`、`yida-form-permission`、`yida-page-config` |
| `yida-skills/ops` | Sequence、主键冲突、VOC、OpenYida 本地故障、Issue/Fork PR | `yida-db-seq-fix`、`yida-voc`、`yida-feedback` |
| `yida-skills/agent` | 导出对话、读取钉钉文档/听记、会议纪要/闪记转 PRD | `yida-export-conversation`、`yida-document-markdown`、`yida-tingji`、`yida-flash-note-to-prd` |

### 高频分歧

| 用户意图 | 选哪个 |
| --- | --- |
| 从零搭一个完整应用/系统 | `yida-app`；先分析需求并完成首次搭建确认，再规划与搭建 |
| 已有 app 但没有任何页面，需要补成完整系统 | `yida-app`；属于首次搭建，同样先询问搭建方式，复用已有 `appType` 补齐资源 |
| OpenYida 使用问题、体验建议、希望贡献改进或不会提 Issue/PR | `yida-feedback`；先整理脱敏材料，成功提交 Issue 后可选邀请 PR，贡献代码使用个人 Fork |
| 读取钉钉在线文档正文 | `yida-document-markdown`，使用登录态接口获取 Markdown |
| 按 taskUuid 读取钉钉听记 | `yida-tingji`，将听记任务 ID 原样传入命令 |
| 将钉钉开放平台官方 API 接入宜搭或 Canvas | `yida-dingtalk-openapi`；密钥不进聊天，账号由用户在宜搭或本机 TTY 配置 |
| 钉钉事件订阅、Stream 或 HTTP 回调 | OpenYida 不支持；直接说明能力边界并停止，不生成连接器动作 |
| 用户给 taskUuid 并要求转 PRD | 先用 `yida-tingji` 读取听记内容，再把已有内容交给 `yida-flash-note-to-prd` 生成 PRD |
| 已有会议纪要/闪记内容转 PRD | `yida-flash-note-to-prd`，只处理已有内容，不负责按 taskUuid 拉取听记 |
| 只创建应用壳并拿 appType | `yida-create-app`；若随后继续完整搭建，已经确认的 `requirement-brief.json`、`prd.md` 与 `design.md` 保持不变，真实 `appType` 只写入 schema 或当前任务资源上下文 |
| 明确强制要求 AI 老应用升级成新版主题 | `yida-upgrade-app-theme`；必须先取得针对目标应用的 ask_human 肯定回复，普通美化/换色/建应用不得触发 |
| 启用/上线或停用/下线已有应用 | `yida-app-lifecycle`；只有用户明确要求时执行，`app-offline` 执行前需再次确认目标应用 |
| 创建自定义展示页资源 | `yida-create-page`，之后交给 `yida-canvas-custom-page` 编写页面源码，再交给 `yida-publish-page` 发布 |
| 开发表单字段结构 / 增删改字段 | 使用 `yida-create-form-page` 落地字段结构 |
| 创建带审批的流程表单 | `yida-create-process` |
| 修改已有流程节点/分支/字段权限，配置加签/转交操作权限 | `yida-process-rule` 保存；人员、字段权限及按钮按需加载 `yida-flow-node-config` |
| 流程或自动化的节点、人员、字段权限、按钮、条件变量配置 | `yida-flow-node-config` 按六类节点与共用配置项读取；保存交回 `yida-process-rule` 或 `yida-integration` |
| 设置发起节点能填写、只读或隐藏哪些字段 | `yida-process-rule` 入口，通用节点技能的字段权限说明；使用顶层 `startFormConfig` |
| 设置谁能发起或提交 | `yida-form-permission`，查询和保存都指定 `FORM_PACKAGE_START` |
| 权限组成员、通用 AND／OR 条件、操作权限、字段权限、权限组及矩阵本体管理 | `yida-form-permission`，组合配置时按需读取成员、数据范围与字段权限说明 |
| 流程设计器字段列表空白 | `yida-process-rule`，先用 `process fields` 检查字段来源 |
| 查字段 ID / 保存 Schema 证据 | `yida-get-schema`；凡涉及 fieldId 的数据、流程、公式、页面代码先取证 |
| 改表单数据记录 | `yida-data-management`，不是 `yida-create-form-page` |
| 查询流程当前任务、管理员转交已有流程任务 | `yida-data-management`；先查询 process-tasks，再 transfer task 并回读实际处理人 |
| 查询指定应用/流程表单中当前审批人为某人的实例或条数 | `yida-data-management`；`data query process --current-approver <userId> [--count]`，仅统计当前登录人经服务端授权可见的实例 |
| 配置或修改公式、字段计算、提交校验、节点筛选、报表计算 | 共用 `yida-formula`，按实际保存内容读取说明；查看字段公式、查参数和检查用 `yida-formula-evaluate` |
| 提交后跨表写入/更新/删除 | 默认 `yida-integration`；用户明确要业务关联规则/高级函数时用 `yida-business-rule` |
| 集成自动化定时、字段变化触发、并行循环、批量取数及生命周期管理 | `yida-integration` 的 `--spec` 路径，读取 `references/batch-data.md`；已有自动化按其更新能力处理 |
| 自定义页面开发 | `yida-canvas-custom-page`，新建和默认页面源码开发入口，源码使用 `.canvas.jsx`；Canvas 发布层会自动注入 `window.__OPENYIDA_YIDA_API__` 和 `window.__OPENYIDA_UTILS__` |
| JSX 自定义页面开发 | `yida-custom-page`，仅用于已检测到的 `.oyd.jsx` / `.oyb.jsx` / `renderJsx` / 平台 `Jsx` 组件页面维护 |
| `.canvas.jsx` 页面使用成员/部门/上传等宜搭运行态组件 | `yida-canvas-custom-page`，读取 `native-components-bridge.md` |
| `.canvas.jsx` 页面接真实数据、表单 API、流程 API、根级工具，轮询刷新列表或 KPI，排查页面 0 条但数据管理有数据 | `yida-canvas-data-binding`，默认消费发布层注入的 yida/utils window 桥 |
| 已有 `.oyd.jsx` / `renderJsx` 迁到 `YidaCodeCanvas` 组件实现 | `yida-canvas-upgrade` |
| 高级图表、可视化、看板图表 | 默认 `yida-rechart` |
| 明确 ECharts、维护旧 ECharts 页面、复杂 option 超出 Recharts 能力 | `yida-chart` |
| 产品化经营分析看板/驾驶舱交付 | `yida-dashboard`，按指标分析任务触发 |
| 自定义内容需要“我创建的”“待我处理”等个人流程任务或业务待处理数据 | `yida-canvas-data-binding`；按用户描述确定任务含义、数据来源和所需能力，不因页面或区块名称默认四类栏目或待办中心 |
| 用户已明确选择自定义流程任务展示，并需要复用任务列表装配 | `yida-task-center`；按需求选择栏目，已有明确要求不重复确认，沿用应用主题 |
| 普通待办查询 | `yida-data-management`，使用 CLI 任务查询，不加载 `yida-task-center` |
| 增加待办中心、审批工作台或任务页签，但未指定自定义页面 | 不加载 `yida-task-center`、不默认创建自定义待办页面；先复用原生入口，已有入口整理用 `yida-nav-group`。完整应用仍由 `yida-app` 编排；Agent 建议自定义实现时先 ask_human，明确同意后才交接；Fast、通用授权和已有 Canvas 均不能替代该选择 |
| 业务操作队列、业务工作台或办事门户页面 | `yida-canvas-custom-page`；接业务数据时加载 `yida-canvas-data-binding`，不因页面名称或辅助统计转为经营看板；不顺带新增自定义审批待办中心 |
| 批量录入、表格填写、多行编辑 | 默认 `yida-canvas-table-form`；已检测到平台 JSX 组件页面、native 页面或存量源码使用 `this.utils.yida.saveFormData` 时用 `yida-table-form` |
| 页面设置中的自定义按钮、客户跟进/分配、审批后发起订单、按钮触发自动化或打开页面 | `yida-custom-button`；配置原生按钮定义和显示位置，自定义页面内 React 按钮不走此入口 |
| 打印这条数据/数据详情链接、原生打印模板、打印设置、订单/报价/出入库/审批单、单据版式与字段明细、字段二维码/条形码、备份恢复和PDF生成 | `yida-print-template`；复用已有表单和模板，以真实打印字典生成动态内容；Word组件、叮当打印和浏览器页面打印不走此入口 |
| 原生数据管理页视图列表、显示列配置、字段显隐与顺序、列宽、冻结列、默认筛选、多视图 | `yida-form-view`；使用原生配置读写，保存前备份并回读，不通过 CSS 隐藏字段或重建自定义列表 |
| 当前数据管理页换风格、只留横线、突出新增/筛选/行操作、列级强调、状态列标签、数据管理 UI 异常、自定义简单数据管理 | `yida-data-manage-ui`（优先于通用美化）；保留承载类型和业务，从目标推导维度、定位 token/CSS 并按页改写；备份发布并实测，不要求选择配方 |
| 页面视觉方向、页面美化、去 AI 味、优化应用 UI、不好看、太乱、美化后不满意或恢复 | `yida-design`；已有资源优先走 `sub_skill/ui-improve/SKILL.md`，先展示视觉方案，经 `ask_human` 确认并备份后才交接实施，只改 UI；不满意恢复本轮前状态。新页面设计沿用原设计流程 |
| 应用级主题、品牌色、全局换肤 | `yida-design`；已有应用按 ui-improve 确认应用级影响范围和恢复方式后执行 |
| 图片需求、搜图、生图 | `yida-image-assets`；完整应用按 `design.md.assetStrategy` 加载 |
| 平台左侧导航树分组/排序 | `yida-nav-group` |
| 自定义应用导航或独立前台菜单 | `yida-nav-shell` |
| 用户明确指定宜搭原生酷卡片（交互卡片或置顶卡片） | `yida-cool-card`；创建、读取与模板查询，返回官方入口由用户配置保存，再由 CLI 回读；要求完全不同的样式或自由 HTML/CSS/React 时仍由本技能判断原生限制和替代方案，不自动切换成网页；不代替编辑器保存、发布或发送，不调整权益 |
| 用户显式指定宜搭原生数据卡片，或在已明确的原生卡片上下文中继续操作 | `yida-data-card`；仅泛称卡片、指标卡、看板、投放或播报不触发；原生卡片保存、发布与播报分离，启用或测试发送另需明确授权 |
| 自定义页面中的数据卡片、指标卡、统计卡 | 页面内组件随页面发布：新增/开发走页面技能，接数据走 `yida-canvas-data-binding`，仅外观走 `yida-design`；不自动创建原生 CARD 资源 |
| 页面引用了原生 `CARD-xxx` | 按实际修改对象分流：页面外层或引用配置仍归页面；用户明确要求修改源卡片配置才用 `yida-data-card`，不能只凭 CARD/FORM 字样判断 |
| 查询主题配置、业务前后台配置或数据卡片管理入口 | 使用 `openyida app-settings <appType> --section theme|basic|data-card|cool-card --json`，直接返回对应 url；只问入口不修改设置 |
| 普通报表/统计、原生报表零值隐藏配置 | `yida-report`；隐藏数值 0 必须由用户明确要求，默认关闭 |
| 聚合表 / 虚拟视图的读取、预览、草稿保存或发布 | `yida-aggregate-table`；save 验证 stash revision，publish 验证 live revision |
| PPT 页面 | `yida-ppt-slider` |
| 公开访问/组织内分享 | `yida-page-config` |
| 评测指定技能质量并给出评分建议 | `yida-skill-evaluator` |

索引精排方法和无独立子技能的 CLI 见 [路由补充说明](references/routing-supplement.md)。

## 核心规则

以下规则都是执行 OpenYida 任务时必须遵守的全局边界；具体子技能可以补充更细规则，但不能覆盖这些规则。

1. **OpenYida CLI 统一执行**：所有宜搭资源操作通过 `openyida` CLI 执行；创建、修改、发布、查询都以 CLI 返回的 JSON、URL、`formUuid/appType` 作为证据。
2. **技能加载唯一入口**：执行子技能前必须加载对应技能；单点任务按意图选 1 个主技能，完整应用由 `yida-app` workflow 分阶段加载当前步骤对应的子技能。
3. **真实资源先确认**：写操作前解析本轮显式资源、已绑定资源上下文、workspace 配置/缓存和历史上下文；已有目标资源时默认修改、补齐或发布，只有目标缺失且意图允许创建时才加载 create 类技能。
4. **corpId 一致性检查**：创建或发布页面前对比 PRD/resource context 与当前 auth snapshot 的 `corpId`；不一致时先让用户选择重新登录或确认继续。
5. **页面源码修改必须发布闭环**：只要本轮 Write/Edit/Create 了页面源码 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`，final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>`；没有证据只能说“源码已修改，尚未发布”，禁止说“页面已更新 / 已重新发布 / 已上线”。
6. **发布前本地校验**：平台 JSX 组件页面的 `check-page` / `compile` 归 `yida-custom-page` 执行；使用 `YidaCodeCanvas` 组件实现的自定义页面按本地快检或发布阶段校验；JSON 配置写盘后先解析校验，再调用平台命令。
7. **生成产物严禁 emoji**：页面源码、`.canvas.jsx` 源码、表单 Schema、发布 Schema、产物文件名和路径中严禁使用 emoji；图标语义使用平台组件、图标库或已验证资源表达。
8. **输入文件用结构化写入**：JSON/YAML/CSV/config/script 文件使用当前 agent 的文件写入能力创建，再把路径传给命令；严禁用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成业务文件。
9. **OpenYida CLI 不吞诊断**：不要给 `openyida` 命令加 `2>/dev/null`；失败时保留 stdout/stderr；遇到 DENIED 或同一命令重复失败，先换策略、改输入或重做环境确认。
10. **读取与复核用合适工具**：读取或定位 workspace 文件优先用当前工具的 Read / Glob / Grep 或 `rg`；OpenYida CLI 已返回成功 JSON、URL、`appType`、`formUuid` 或 `fieldId` 时，以 CLI 结果作为证据。
11. **资源 ID 必须精确**：`appType`、`formUuid`、`fieldId` 等应用、表单、字段 ID 必须来自 CLI/API/cache 证据并一字不差传入命令和源码；不得凭名称、截图、相似前缀或记忆补写、改写、截断。
12. **字段和 Schema 以证据为准**：字段级表单操作优先交给 `create-form update/add-option/bind-datasource/validation/rule` 的 schema-aware 解析；页面代码、数据、流程、公式等需要字段映射时，每表单一次性执行 `openyida get-schema --field-map-json` 并缓存字段摘要。
13. **产品与视觉分工固定**：完整应用先分析需求；首次搭建按 yida-requirement-analysis/workflow/prepare-brief.md 确认未决事项，再进入已选 Fast / Plan。两种模式共享需求分析与 PRD 契约，以下并行生成规则用于 Fast；Plan 确认当前版本后交接派生文件，直接进入 Step 3。首次搭建只有 Plan 的 build-plan.html 用于方案展示，其余设计文件保持内部使用；已有资源 UI 美化使用 ui-improve 的 visual-plan.html 展示并确认视觉方案。完整应用先由 `yida-requirement-analysis` 整理用户需求，再由 `yida-prd` 与 `yida-design` 同时输出 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`，最后由 `yida-app` 做一致性校验；页面目标、区块、数据和交互以 PRD 为准，布局、主题、材质和状态视觉以 design.md 为准。
14. **配置优先于页面代码**：字段、公式、联动、报表、审批和集成交给对应技能；自定义页面负责展示数据、放置业务入口，并串联表单、流程、报表和导航入口。
15. **Canvas 运行桥统一口径**：`.canvas.jsx` / `.canvas.tsx` 发布为 `YidaCodeCanvas` 时，外层页面 `didMount` 默认注入 `window.__OPENYIDA_YIDA_API__` 和 `window.__OPENYIDA_UTILS__`。Canvas 组件内部不得直接写 `this.utils.yida.*`；表单/流程/表单设计 API 走 `window.__OPENYIDA_YIDA_API__`，`toast/dialog/openPage/router.push/isMobile` 等根级工具走 `window.__OPENYIDA_UTILS__`，且 `window.__OPENYIDA_UTILS__.yida` 指向同一个 yida API 桥。
16. **分页查询默认 pageSize 50**：生成表单、流程、任务、成员等分页查询代码时，一般显式写 `pageSize: 50` 或 `pageSize: '50'`。除非用户明确要求小页或大页，不写 `20`、`100` 等其他值；平台上限仍是 100。
17. **数据性能优先**：统计聚合用 `yida-report` 服务端聚合，不在前端拉全量后自行聚合。
18. **避免无效重试**：失败先查登录态、组织、参数和字段 ID；无修改不连续重试超 1 次。
19. **存储路径固定**：PRD、视觉契约、Schema ID 和临时文件按存储约定写入：
| 类型 | 路径 |
| --- | --- |
| 业务语义 | `prd/<项目名>/prd.md` |
| 视觉契约 | `prd/<项目名>/design.md` |
| Schema ID | `.cache/<项目名>-schema.json` |
| 临时配置/导入数据/脚本 | `<projectRoot>/.cache/openyida/<项目名或任务名>/` |

- `prd.md` 只记录业务语义，不记录字段 ID。
- Schema ID 映射不是远端真相；CLI 返回字段不存在、重名或歧义时重新取证。
- 从 workspace 根执行命令时路径加 `project/` 前缀；在 OpenYida project 工作目录内执行时使用 `.cache/...`。
- 不把 OpenYida 业务中间文件写到仓库根目录或系统临时目录。

20. **报表和可视化先分流**：标准统计与原生报表用 `yida-report`；定制图表页面默认用 `yida-rechart`；只有明确 ECharts、维护旧 ECharts 页面或复杂 option 超出 Recharts 能力时用 `yida-chart`。
21. **应用主题只有一份**：涉及应用蓝图、页面视觉、应用主题色、品牌色、全局换肤或 `--color-brand1-*` 时先读 `yida-design`。导航、应用框架、提交/编辑表单、记录详情和自定义页面按[整体主题规则](skills/yida-design/references/application-theme-consistency.md#导航与应用框架)一起设计。`app-theme.css` 只在应用级统一配置，各类页面消费同一份主题 token。严禁在页面级重复写入、同步或向上层注入主题样式；`YidaCodeCanvas` 源码只在 `YidaComp` 内消费现有主题 token。
22. **默认完成即停止**：完整应用默认以资源发布成功、轻量导航排序完成、示例数据就绪并输出一组有明确名称的应用入口与业务交付总结为 doneWhen；截图、精细导航整理和额外深读属于 optionalAfterDone，除非用户明确要求。
23. **说清楚做什么**：对话、任务列表、步骤标题、进度和提问面向非技术用户。用日常用语和短句，一句话说一件事，先说结果或动作，再补必要原因。功能写谁能做什么；进度写当前动作和下一步；失败写问题、影响和处理办法；待核实的结果如实说明。文件名、路径、技能名和调用方式留在内部执行。PRD 业务说明、HTML 和消息使用功能与体验描述；接口参数、配置键值及内部 ID 留在 Agent 实施交接，遵循[用户可见表达契约](skills/yida-design/references/ask-human-interaction-contract.md)。交付卡片的 `description` 写 2-3 句业务交付总结、核验结果与剩余事项，卡片包含一组“应用访问入口”；宿主没有交付工具时，在最终回复中给出相同内容。不得把需求信息文件、PRD、视觉设计、build manifest、资源清单、Schema 或每个表单/流程/报表分别登记成用户可见交付物；不分前后台或包含业务后台时，给出经验证的业务页面入口，前台页面经 PRD 标记为 `standalone` 且导航配置回读通过时给独立业务入口；完整应用默认再提供开发者管理后台 `adminUrl`，不因云端登录方式省略；明确仅业务后台时交付业务后台与开发者管理后台，不追加前台；明确仅前台时不追加业务后台，仍交付前台与开发者管理后台两个地址。有前后台时交付前台、业务后台、开发者管理后台三个地址；不分前后台时交付系统入口与开发者管理后台。用户明确排除的入口和单页任务范围优先。
24. **任务复盘沉淀**：用户多次纠正、平台接口假成功、页面骨架共性质量问题、线上回读验收方法、一次性脚本可产品化等情况，完成前判断是否需要沉淀到 CLI、测试或 skill。

常见问题见 [常见问题解决方案](references/execution-rules.md)。

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [资源上下文与补齐判定](references/resource-context.md) | 资源优先级、绑定上下文、create-or-update、已有 app 无页面 | Step 2 必读 |
| [路由补充说明](references/routing-supplement.md) | 索引精排方法、无独立子技能 CLI | Step 3 排障或索引匹配不准时 |
| [常见问题解决方案](references/execution-rules.md) | 常见问题处理路径 | 遇到发布、字段、表单更新或 corpId 问题时 |
| [环境准备与登录检测](references/setup-and-env.md) | 环境依赖、env 解读、多环境 token 登录、project 初始化 | 环境异常或登录问题时 |
| [本地 Agent 连接预检](references/local-agent-preflight.md) | connect/doctor、指定 Provider、桌面版与 CLI、安装与登录修复 | 用户需要接入本地 Agent 或预检失败时 |
| [本地 Agent 诊断](references/local-agent-diagnostics.md) | 电脑/CLI 发现、连接鉴权、local_ 会话投递诊断 | 用户反馈网页关联本地 Agent 异常时 |
| [宜搭 API](references/yida-api.md) | 宜搭 API 完整参数 | 调用 API 前 |
| [公式函数库](references/formula-functions.md) | 公式函数速查 | 编写公式前 |
| [官方示例 Schema 范式](references/official-example-schema-patterns.md) | 脱敏 schema 承载范式 | 蒸馏官方示例时 |
| [任务复盘与沉淀规范](references/task-retrospective.md) | 任务收尾沉淀、CLI/skill/页面骨架反哺、视觉参考和主题经验 | 任务完成前、用户要求总结经验或多次纠正同类问题时 |
| [查询条件构造](references/query-condition-guide.md) | 日期空值、区间端点、业务计数、子表条件与服务端分页；CLI 和页面共享 | 数据查询/筛选时 |
| [报表字段配置](references/report-field-config-guide.md) | 报表字段配置规范 | 配置报表时 |
| [版本功能差异](references/edition-features-guide.md) | 各版本能力差异 | 版本能力查询时 |
| [模型 API](references/model-api.md) | 宜搭模型接口 | 调用宜搭模型能力时 |

本地设计与 Canvas 编译校验失败时读取[本地校验修复](references/source-repair.md)，按字段修复并限制无进展重试。

执行 `openyida agent connect` 时，CLI 检测输出仅供参考。除非用户明确要求，不得下载安装、升级、登录或修改其他 CLI 配置；发现支持的 CLI 即可连接并上报；未登录的 CLI 也要保留并展示“未登录”，不能据此自动登录。没有可上报 CLI 或用户取消时报告结果并停止。
