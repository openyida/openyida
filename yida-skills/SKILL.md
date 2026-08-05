---
name: openyida
description: >
  宜搭应用开发总入口技能。通过具备代码生成能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。
  包含资源上下文解析、应用创建/复用、表单设计/更新、自定义页面开发、页面发布、登录态管理等完整开发流程。
  当用户提到“宜搭”、“yida”、“低代码”、“创建应用”、“创建表单”、“发布页面”、“搭建”、“系统”等关键词时，使用此技能；以下情况不要触发：只是讨论通用前端/后端代码、非宜搭平台产品、或只需要解释概念而不操作宜搭资源。
  重要路由规则：当用户首次创建完整应用/系统/平台时，如帮我搭建一个管理应用或者创建一个管理系统等，必须先加载 yida-app 子技能作为唯一编排入口，禁止直接调用 create-app/create-form/create-page 等子命令手动拼接。已有 app 且已有自定义页面的补齐或修改按常规路由即可。
---

# 宜搭应用开发指南

通过具备代码生成能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。所有操作通过 **`openyida`** CLI 统一执行。登录态分流必须以 `openyida agent-capabilities --summary-json` 或 `openyida login --check-only --json` 返回的 OpenYida auth snapshot 为准；只有 snapshot 明确返回 `login.auth_source=env` 或 `failure_reason=env_token_missing` 时，才按运行环境注入 token 模式处理。其他未登录 token 场景走默认 OAuth token 登录，不要根据 agent 名称、运行环境类型或手写环境判断自行分流；禁止读取 `.cache/cookies*.json`。

---

## 语言与完成性

- 默认沿用用户语言输出；中文用户用中文。CLI 命令、API 路径、参数名、`fieldId`、`appType`、`formUuid` 等技术标识保持英文原文。
- 一旦进入写操作任务，必须跑到对应子技能的 `doneWhen` 或验收闭环；只做预检、只读 schema、只写本地文件或只规划下一步，都不能对用户宣称完成。

## 不同工具的技能加载方式

- 如果当前 AI 工具提供 `use_skill` / `search_skills`：必须通过 `use_skill("<技能名>", "<本阶段目的>")` 加载主技能和子技能，禁止用 `Read` / `read_file` / `cat` 读取 `SKILL.md` 路径；`use_skill` 会稳定返回技能内容和可读取的辅助文件列表。
- `skills-index.json` 是给能读取索引的工具快速找到技能用的；不能读取它的工具直接忽略，不要把它当作运行前置条件。
- 使用 `use_skill` / `search_skills` 时，只读取该工具返回的辅助文件；禁止猜测 `.skills`、`skills`、`yida-skills`、插件缓存、workspace/project/.skills 等安装路径。
- 如果当前 AI 工具没有 `use_skill` / `search_skills`：按本文的技能路由表选定技能名，按 `skills/<技能名>/SKILL.md` 定位当前阶段唯一必要的子技能文档；禁止并发批量读取多个 `SKILL.md`；禁止预读未来阶段技能。
- `references/`、`scripts/`、`assets/` 等辅助文件只能在已加载对应技能后，读取该技能正文明确列出的相对路径；不要把当前工具的 sandbox 路径当作通用路径。

---

## 第一步：只读预检（先于真实资源操作）

> ⚡ **前置门槛**：确认 openyida 已安装、Node/npm 依赖达标、登录态就绪。**未通过只读验证前，禁止创建应用/页面/表单或发布等任何真实资源操作。**

**怎么做**：优先跑一次 `openyida agent-capabilities --summary-json`。这个简版命令只返回 version、`login.status`、`login.can_auto_use`、`workdir`、`workdir_exists`、`cache_dir`、`openyida_task_cache_dir`、`command_count` 和 `command_manifest_digest`（命令清单摘要）等必要字段，避免 stdout 过大导致工具误判没有读到结果，也避免反复 `which openyida`、`openyida --version`、`openyida --help`、`openyida env`、`login --check-only`。

`openyida agent-capabilities --json` 是完整能力信息，只在命令契约排障、manifest 差异诊断或深度调试时使用；不要把完整能力信息放进常规完整搭建链路。

字段映射：简版输出的 `workdir` 对应完整能力信息里的 `active.projectRoot`；`workdir_exists` 对应 `active.projectRootExists`。

若当前 OpenYida 版本还没有 `agent-capabilities`，退回跑 `openyida env --json` 和 `openyida login --check-only --json`。旧版本地 agent 不需要认识 `skills-index.json`，也不需要支持 `agent-capabilities` 才能继续执行。

| 检测结果 | 处理 |
|---------|------|
| 命令跑不了（`command not found`） | openyida 未安装 → `npm install -g openyida` |
| Node/npm 版本不达标 | 先升级 Node（≥18）再装/升级 openyida |
| `login.auth_mode=token` 且 `status=ok` / `can_auto_use=true` | 继续执行业务命令 |
| snapshot 返回 `login.auth_source=env` / `failure_reason=env_token_missing` | STOP；运行环境必须注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN`；禁止触发 OAuth；禁止读 `.cache/cookies*.json` |
| `login.auth_mode=token` 且未登录，且 snapshot 未返回 env 注入模式 | `openyida login`（指定入口带 URL 或 flag），完成后再 `openyida login --check-only --json` 验证 |
| `workdir_exists` / `active.projectRootExists` 为 false | 无工作目录 → `openyida copy` 初始化 |

**👉 环境异常、登录失败、悟空降级、OAuth token 登录异常等特殊分支 → [references/setup-and-env.md](references/setup-and-env.md)。正常 `agent-capabilities` 通过时不要默认读取该 reference。**

---

## 默认执行路径

OpenYida builder 默认使用 `create-app / create-form / create-page / publish` 等常规命令链路。页面实现先消费 `prd.md` 和 `design.md`；只有走生成器或需要稳定交接时才派生 `page-spec.json`，再选择页面生成器或手写源码。CLI 内部负责读取必要的 schema、定位字段、输出 compact diff/evidence、readback 和 bindings，模型不要为了简单字段更新先拉取大 schema，也不要把新建命令当作默认动作。

`.cache/<项目名>-schema.json` 只是本地 ID 映射，不等于远端真相。路径不明确时先只读确认或询问用户；不要通过新建同类资源规避不确定性。

---

## 路由前置：resolve_resource_context

> Resource-First Workflow：任何完整搭建或单点任务都先解析目标资源上下文，再判断是新建、补齐、修改还是发布。不要把 `create-app` / `create-page` / `create-form` 当作默认动作。

### 资源解析顺序

按以下优先级选择 app/page/form/process，上游来源更明确时覆盖下游来源：

1. 本轮用户明确给出的 `appType`、`formUuid`、应用 URL、页面 URL、流程标识或页面/表单上下文；
2. 外部工具注入的当前任务资源上下文；
3. workspace 中的 `project/config.json`、`.cache/<项目名>-schema.json`、`.cache/openyida/**` 等本地 cache/config；
4. 当前会话历史中已创建或已确认的资源；
5. 无资源且用户明确说“从零创建 / 新建另一个 / 创建新应用或新页面”时，允许创建缺失资源；
6. 仍有多个同优先级候选、当前轮显式资源互相冲突，或无法判断目标时，才 `ask_human`。

**本轮显式目标覆盖注入上下文**：外部工具注入的已绑定 app/page/form 只是默认候选，不是锁定目标。若当前会话绑定页面 A，但用户本轮明确给出页面 B 的 URL、`formUuid`、页面名称或其他可识别线索，必须重新解析 B；B 能唯一解析时切换到 B，B 不能唯一解析时 `ask_human`，禁止静默回落到 A。

可选的资源上下文协议如下；本地工具不支持时忽略，不作为运行前置：

```json
{
  "kind": "openyida_resource_context",
  "version": 1,
  "app": {
    "appType": "APP_xxx",
    "source": "explicit_prompt|url|agent_bound|workspace_cache",
    "allowCreate": false,
    "precreated": true
  },
  "page": { "formUuid": "FORM_xxx", "source": "explicit_prompt|url|agent_bound|workspace_cache", "allowCreate": false },
  "form": { "formUuid": "FORM_xxx", "source": "explicit_prompt|url|workspace_cache", "allowCreate": false }
}
```

`precreated` 表示该 app 由外部工具提前创建并绑定到本轮任务。这些字段都是可选提示：缺失时按普通已有资源处理，不作为运行前置。

**绑定 app 只复用不改名**：OpenYida 技能侧不自动修改应用名称；即使目标 app 来自外部工具预创建资源，也只复用该 `appType` 继续创建、更新或发布资源。应用名修正如有需要由外部工具侧负责；技能不得因为占位名、页面标题或业务语义推导触发应用名修改。

### create-or-update 判定

- 已解析到目标 app 时，默认在该 app 内修改、补齐或发布，不执行 `yida-create-app`；只有用户明确要求“新建另一个应用”并确认目标组织后才创建新 app。
- 已解析到目标自定义页面 URL / `formUuid` / bound page 时，默认写源码并发布到该页面，不执行 `yida-create-page`；只有缺少目标 display page 且本次意图允许新增页面时才创建。
- 已解析到目标表单 `formUuid` 时，字段结构诉求默认走 `yida-create-form-page` 的 update/patch/rule/bind-datasource 模式，不创建同名或同类表单。
- 已解析到目标流程表单 / `processCode` 时，默认走 `yida-process-rule` 配置/更新流程，不从零执行 `yida-create-process`。
- 完整应用统一编排也遵守本规则：先由 `yida-design` 输出 `prd.md` 与 `design.md`，再按 PRD 创建或复用应用；表单/流程先于自定义页面，页面实现消费 PRD 的业务结构、design.md 的视觉契约和真实资源 ID。

验收心智模型：

| 场景 | 正确动作 |
|------|----------|
| `帮我搭建访客系统` + bound app/page | 不 create app/page；直接在已有 app/page 内补表单、写页面并发布 |
| `在 APP_xxx 里增加客户表和回访页面` | 不 create app；允许按缺口 create form/page |
| `优化这个页面 URL` | 不 create app/page；直接进入 custom-page + publish existing page |
| bound 页面 A，但用户说“修复页面 B 的 xx 字段” | 先解析页面/表单 B；B 有 URL/formUuid 时改 B，只有 B 无法唯一识别时询问用户，不能默认改 A |
| `从零创建一个 CRM 应用` 且无 context | 允许 create app/form/page 并发布 |
| 多个 app/page 候选 | 按来源优先级选；同级冲突或目标不明才问人 |

> 该 resource context 是常规写入前置解析，不替代具体技能里的目标确认。

---

## 第二步：意图路由（先判断「完整搭建」还是「单一任务」）

> 环境和 resource context 就绪后，先判断用户诉求属于哪一类，再走对应路线：完整搭建/补齐一个应用，还是对已有资源做单点改动。选错会导致多余步骤或回退；歧义时简短确认一次即可。

| 用户诉求信号 | 判定 | 走哪条路线 |
|------------|------|-----------|
| 创建/搭建/做一个 + 应用/系统/管理系统；或已有 app/page 需要补成完整系统 | **完整搭建 / 补齐** | 加载子技能 `yida-app`，由它执行 create-or-update workflow |
| 对已有应用/表单/页面的单点操作（加字段、查改数据、配公式、建报表、改权限、发布、美化…） | **单一 / 增量任务** | 到 [技能路由](#技能路由单一--增量任务) 选定 **1 个**，加载对应子技能执行，不回退流程 |

---

## 完整开发流程（完整搭建 / 补齐）

> 📌 仅当第二步判定为「完整搭建 / 补齐」时进入；单一/增量任务请跳「技能路由」。
> 加载子技能 `yida-app`，由它负责完整应用 workflow、阶段子技能加载、关键 ID 流转、PRD 与 schema cache 约束。
> 用户说“按默认方案 / 不要追问 / 直接创建 / 尽快搭建”时，`yida-app` 使用统一编排：先解析本轮资源上下文，再由 `yida-design` 完成需求分析和产品设计，输出 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`，随后按 PRD 创建或复用应用/表单/流程/页面，按 design.md 实现页面视觉，发布主页面后立刻做一次轻量导航排序；最终先输出 2-3 句业务交付总结，再给一个主入口链接，不默认输出表格或资源 ID 摘要。
> `yida-app` 使用常规 OpenYida 命令编排。

**默认链路**：完整应用必须只做 `resolve context → yida-design prd.md + design.md → create/reuse app → resolve forms/processes → seed records → reserve main page → 编写/更新主页面源码 → 发布 + 轻量导航排序 → 返回 2-3 句业务交付总结 + 一个主入口链接`。资源创建顺序按 PRD 执行：应用先落位，表单/流程先于自定义页面；页面实现读取真实表单 URL、字段语义、数据来源和 design.md 视觉契约。只有走生成器时才派生 `page-spec.json`。发布主页面成功后，PRD 写明导航顺序时执行 `openyida nav-group order <appType> <页面/表单...>`；PRD 只写宽泛分组或缺少导航顺序时，执行 `openyida nav-group auto-order <appType>` 或 `openyida publish ... --auto-nav-order` 兜底，兜底顺序为门户/首页/工作台入口、业务办理、数据管理、经营分析、系统配置。完整应用默认写入 1-3 条核心普通表单示例记录；用户明确要求公开访问、截图验收、报表/大屏、数据桥深度接入或精细导航分组时，再追加对应技能。

**默认加载边界**：只加载 `yida-app` 和当前阶段必需的子技能。`yida-design` 负责需求分析、产品定位、页面/表单/流程蓝图、主题色、各页面布局、资源创建顺序、页面实现交付顺序、导航顺序和验收标准，并输出 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`；`yida-create-app`、`yida-create-page`、`yida-create-form-page` 只有在目标资源缺失且本次意图允许创建时才加载；已有资源时进入对应 update / publish 分支。主页面实现读取 PRD 的业务输入，并直接读取 design.md 的主题、布局、材质、圆角、密度、组件和状态规则；走生成器时再派生 `page-spec.json`，并标记 `sourceOfTruth.prdFile/designFile`。页面默认走 Code Canvas；当用户明确要求普通自定义页面 JSX/Jsx 组件链路，或页面强依赖普通自定义页实例桥（`this.$(fieldId)` / `this.utils.yida.*` / `this.dataSourceMap` / 表单提交或字段双向绑定深度耦合）时，选择 `yida-custom-page`。数据源深接、数据管理和原生报表只在用户明确要求或 PRD 验收标准命中时追加。

**Canvas 数据边界**：完整应用/真实交付页如果展示列表、看板或详情记录，必须优先把本轮真实 `appType/formUuid/fieldId` 写入 `page-spec.json` 的 `dataBinding.mode=form`；完整应用默认先写入 1-3 条核心普通表单记录再读取。未接真实表单且未写入 demo records 时，页面展示空态/入口，不用前端 seedRows 冒充业务数据。

**字段级命令内置解析**：简单字段属性更新（例如“把备注字段改为必填”）直接调用 `openyida create-form update <appType> <formUuid> '[{"action":"update","label":"备注","changes":{"required":true}}]'`；CLI 会内部读取当前 schema，按 label/fieldId/tableLabel 定位字段，并在 JSON 中输出 resolved/updated evidence。`add-option`、`bind-datasource`、`validation`、`rule` 等字段级命令也可直接按 label 或已知 fieldId 操作，成功返回 compact `resolved`，失败返回 compact `diagnostics[].candidates`。只有字段解析仍歧义、需要底层 patch path，或页面代码/数据查询/流程/公式等确实需要多个 `fieldId` 时，才对目标表单执行一次 `openyida get-schema <appType> <formUuid> --field-map-json` 并合并到 `.cache/<项目名>-schema.json`。不要用 `head`/`tail`/`grep` 截断 get-schema stdout 作为字段证据，也不要因此对同一表单重复拉取多轮 schema。

**Canvas 实现路径二选一**：走页面生成器时，先写业务化 `page-spec.json` 再生成可编译骨架，后续只读 manifest/摘要并小范围 Edit；不要立即 Read 大段源码再全量 Write 覆盖同一路径。若已经明确最终页面结构，直接 Write 最终 `.canvas.jsx`。

**doneWhen**：`yida-app` 发布主页面成功、轻量导航自动排序已执行或给出明确 warning，并先输出 2-3 句业务交付总结、再给可访问主入口链接。到这里默认完成；不要发布后继续 TaskCreate、重复读技能或继续规划。

**optionalAfterDone**：精细导航整理、公开访问、截图验证、数据源/连接器深度接入、报表/大屏，只在用户明确要求或 PRD 验收标准命中时执行；发布后的轻量导航自动排序、seed records 和表单详情页 formDetail CSS 注入是默认收尾，不算可选后置。表单页开发默认加载 `yida-form-detail` 做表单视觉引导，并把 Divider 分割线语义分组合并进字段 JSON；拿到真实 `formUuid` 后默认注入 formDetail CSS。

---

## 技能路由（单一 / 增量任务）

先按用户任务命中一个**大类目录**，再在该目录内选定 1 个最匹配的子技能。如果当前工具支持 `search_skills`，可优先用用户原话搜索；如果支持 `use_skill`，用 `use_skill("<技能名>", "<本阶段目的>")` 加载。`skills-index.json` 中的 `route_groups` 与下表保持一致，给能读取索引的工具做自动匹配。

**如果工具能读取索引，按这个顺序匹配**：先用 `route_groups[].signals` 命中 `yida-skills/<area>` 大类；只在该 `category` 下用 skill 的 `description`、`tags`、`aliases`、`positive_signals` 精排；命中 `negative_signals` 的候选降权或剔除；再用下方“高频分歧”覆盖易混场景；最后调用 `use_skill`。`command_ids` 只用于解释该技能可能调用哪些 CLI，不要替代技能加载；`done_when` 只用于判断完成条件。`category` 是路由目录，不是技能路径，必须保持 `yida-skills/<简名>` 格式。

| 大类目录 | 第一层意图信号 | 子技能 |
|------|------|------|
| `yida-skills/context` | 登录、退出、切换组织、组织版本/容量、Schema、fieldId、只读预检 | `yida-login`、`yida-logout`、`yida-basic-info`、`yida-get-schema`、`yida-corp-efficiency` |
| `yida-skills/app` | 从零搭应用、完整系统、应用启停、应用导航、多语言 | `yida-app`、`yida-create-app`、`yida-app-lifecycle`、`yida-nav-group`、`yida-i18n` |
| `yida-skills/design` | 完整应用产品设计、单页 UI 改造、主页面视觉设计、应用主题色、全局换肤、PRD 和 design.md | `yida-design` |
| `yida-skills/form` | 表单字段、公式、校验、业务关联规则、详情页、批量录入、数据记录 | `yida-create-form-page`、`yida-formula`、`yida-formula-evaluate`、`yida-business-rule`、`yida-form-detail`、`yida-canvas-table-form`、`yida-table-form`、`yida-data-management` |
| `yida-skills/process` | 审批、流程表单、流程规则、节点/分支/字段权限、流程代理 | `yida-create-process`、`yida-process-rule`、`yida-agent-center` |
| `yida-skills/page` | 自定义展示页、Code Canvas、普通自定义页面 JSX/Jsx 组件、页面发布、页面内导航、PPT 页面 | `yida-create-page`、`yida-canvas-custom-page`、`yida-custom-page`、`yida-canvas-data-binding`、`yida-canvas-upgrade`、`yida-publish-page`、`yida-openyida-publish-guard`、`yida-density`、`yida-nav-shell`、`yida-ppt-slider` |
| `yida-skills/analytics` | 报表、统计、图表、Recharts、ECharts、看板、驾驶舱、大屏 | `yida-report`、`yida-rechart`、`yida-chart`、`yida-dashboard` |
| `yida-skills/integration` | 连接器、外部 API、执行动作、设计器数据源、集成自动化、逻辑流 | `yida-integration`、`yida-connector`、`yida-connector-safe-actions`、`yida-data-source-connectors` |
| `yida-skills/access` | 平台/应用/表单/页面权限、公开访问、分享 | `yida-corp-manager`、`yida-app-permission`、`yida-form-permission`、`yida-page-config` |
| `yida-skills/ops` | Sequence、主键冲突、VOC 反馈 | `yida-db-seq-fix`、`yida-voc` |
| `yida-skills/agent` | 导出对话、读取钉钉文档/听记、会议纪要/闪记转 PRD | `yida-export-conversation`、`yida-document-markdown`、`yida-tingji`、`yida-flash-note-to-prd` |

### 高频分歧

| 用户意图 | 选哪个 |
|------|------|
| 从零搭一个完整应用/系统 | `yida-app`；统一编排，先由 `yida-design` 完成产品设计 |
| 读取钉钉在线文档正文 | `yida-document-markdown`，使用登录态接口获取 Markdown |
| 按 taskUuid 读取钉钉听记 | `yida-tingji`，将听记任务 ID 原样传入命令 |
| 用户给 taskUuid 并要求转 PRD | 先用 `yida-tingji` 读取听记内容，再把已有内容交给 `yida-flash-note-to-prd` 生成 PRD |
| 已有会议纪要/闪记内容转 PRD | `yida-flash-note-to-prd`，只处理已有内容，不负责按 taskUuid 拉取听记 |
| 只创建应用壳并拿 appType | `yida-create-app`；创建成功后把真实 `appType` 交给 `yida-design` 生成或更新 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`，后续表单、流程、页面和发布都消费这两份文件 |
| 启用/上线或停用/下线已有应用 | `yida-app-lifecycle`；只有用户明确要求时执行，`app-offline` 执行前需再次确认目标应用 |
| 创建自定义展示页资源 | `yida-create-page`，之后默认接 `yida-canvas-custom-page` 和 `yida-publish-page` |
| 开发表单字段结构 / 增删改字段 | 先加载 `yida-form-detail` 做表单视觉引导并合并 Divider 分割线，再用 `yida-create-form-page` 落地字段结构 |
| 创建带审批的流程表单 | `yida-create-process` |
| 修改已有流程节点/分支/字段权限 | `yida-process-rule` |
| 查字段 ID / 保存 Schema 证据 | `yida-get-schema`；凡涉及 fieldId 的数据、流程、公式、页面代码先取证 |
| 改表单数据记录 | `yida-data-management`，不是 `yida-create-form-page` |
| 配字段默认值、计算、校验 | `yida-formula`；静态检查用 `yida-formula-evaluate` |
| 提交后跨表写入/更新/删除 | 默认 `yida-integration`；用户明确要业务关联规则/高级函数时用 `yida-business-rule` |
| 自定义页面默认开发链路 | `yida-canvas-custom-page` |
| 普通自定义页面 JSX/Jsx 组件使用成员/部门/附件上传/图片上传 | `yida-custom-page`，必须读取 `component-jsx-guide.md`；上传还必须读取 `attachment-upload-guide.md` |
| Code Canvas 页面使用成员/部门/上传等宜搭运行态组件 | `yida-canvas-custom-page`，读取 `native-components-bridge.md` |
| 普通自定义页面 JSX/Jsx 组件链路，或强依赖 `this.$` / `this.utils.yida.*` / `this.dataSourceMap` | `yida-custom-page` |
| Code Canvas 接真实数据 | `yida-canvas-data-binding` |
| 已有 `.oyd.jsx` / `renderJsx` 迁到 Canvas | `yida-canvas-upgrade` |
| 批量录入、表格填写、多行编辑 | 默认 `yida-canvas-table-form`；明确普通自定义页面/native/旧页面或 `this.utils.yida.saveFormData` 时用 `yida-table-form` |
| 页面视觉方向、去 AI 味 | `yida-design`；实现层仍交给 Code Canvas 或普通自定义页面技能 |
| 应用级主题、品牌色、全局换肤 | `yida-design` |
| 平台左侧导航树分组/排序 | `yida-nav-group` |
| 页面隐藏原导航后自绘导航壳 | `yida-nav-shell` |
| 普通报表/统计 | `yida-report` |
| 高级图表、可视化、看板图表 | 默认 `yida-rechart`（Code Canvas + Recharts） |
| 明确 ECharts、维护旧 ECharts 页面、复杂 option 超出 Recharts 能力 | `yida-chart` |
| 产品化经营看板/驾驶舱交付 | `yida-dashboard` |
| 页面美化/视觉方向 | `yida-design` 产出 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`，或单页 PRD 章节 + design spec；落地实现仍回到 `yida-canvas-custom-page` 或 `yida-custom-page` |
| 公开访问/组织内分享 | `yida-page-config` |
| 评测指定技能质量并给出评分建议 | `yida-skill-evaluator` |

### 无独立子技能的 CLI

| 意图 | 直接执行 |
|------|------|
| 聚合表 / 虚拟视图 | `openyida aggregate-table` |
| 流程表单 AI 审批提示 | `openyida ai-form-setting` |
| 文生文 / 识图通用 AI 能力 | `openyida ai` |
| 批量顺序执行 OpenYida 命令 | `openyida batch` |

---

## 核心规则

### 致命规则（FATAL，违反即失败/报错）

1. **技能加载唯一入口**：执行任何子技能前，能调用 `use_skill` 的工具必须用 `use_skill("<技能名>", "<本阶段目的>")` 加载对应技能；不要用 `Read` / `read_file` / `cat` 读取 SKILL.md 路径，不凭记忆猜参数格式。
2. **corpId 一致性检查**：创建或发布页面前对比 prd/resource context 与当前 auth snapshot（本地 OAuth token session 或 snapshot 明确返回的运行环境注入 env token）中的 corpId，不一致必须询问用户（重新登录到目标组织，或确认在当前组织继续操作已解析资源/缺失资源）。
3. **发布前本地校验**：普通自定义页面 `.oyd.jsx` / `.jsx` 发布前跑 `openyida check-page` + `openyida compile`；Code Canvas `.canvas.jsx` 不跑这两个普通自定义页面检查，改由 `openyida publish` 的 Canvas 编译阶段或 `compileCanvasLocal` 快检校验；JSON 配置写盘后先解析校验，再调用平台命令。Code Canvas 依赖只能用标准 import，严禁 `const { Drawer } = antd`、`const { Search } = lucideReact`、`window.antd`、`window.icons` 这类裸变量或手写全局依赖。表单详情入口必须优先读取 `row.formInstId`，缺少实例 ID 时禁用或提示，禁止打开空 `formInstId` 的 formDetail 链接。JSX 中文业务文案只能写成纯文本 `所有级别` 或带引号字符串 `{'所有级别'}`，不能写成 `{所有级别}` 这种裸变量表达式。OpenYida 生成产物硬禁 emoji：页面源码、Canvas 源码、表单 Schema、发布 Schema 和产物文件路径出现 emoji 时必须改源码/字段 JSON/路径，不得用 `--skip-lint` 或重复发布绕过。若 emoji 原本承担图标含义，Code Canvas 改成 `lucide-react` 或 `@ant-design/icons` 的标准 import；普通 JSX 不支持 import，必须使用已验证运行时脚本/global 加载这两类图标库，加载条件不满足时切到 Code Canvas。不得用 CSS 绘制图形、字母占位或临时 SVG 代替。
4. **页面源码修改必须发布闭环**：只要本轮 Write/Edit/Create 了页面源码 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`（含完整搭建、补齐、已有页面 update path、单点优化），final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>` 命令结果；本地文件编辑、diff、本地校验或编译只证明源码可发布，不等于远端页面已更新。若没有 publish 成功证据，final 只能说“源码已修改，尚未发布”，禁止说“页面已更新 / 已重新发布 / 已上线”。
5. **命令输入文件禁止 shell 写入**：当 OpenYida 命令需要 JSON/YAML/CSV/config/script 文件参数时，先使用当前 agent 运行时提供的结构化文件写入工具（如 create_file / Write / file edit tool）创建文件，再把路径传给命令；禁止用 shell heredoc、`cat`/`echo`/`printf`/`tee` 加输出重定向，或把命令 stdout 重定向成业务文件。
6. **读文件少用 Bash 噪声**：读取或定位 workspace 文件优先用当前工具的 Read / Glob / Grep；OpenYida CLI 已返回成功 JSON、URL 或 `formUuid/appType` 时，不要再用 Bash `cat`/`ls` 做无意义复核。
7. **OpenYida CLI 不吞诊断**：不要给 `openyida` 命令加 `2>/dev/null`；失败时保留 stdout/stderr（必要时用 `2>&1` 合并诊断）。遇到 DENIED 或同一命令重复失败，先换策略、改输入或重做只读确认，不要盲目微调后重跑。

### 重要规则（IMPORTANT，影响质量/性能/可维护性）

1. **按阶段加载必要技能**：按意图选 1 个主技能；完整应用按阶段加载当下唯一需要的子技能，禁止并发批量读取多个 `SKILL.md` 或预读未来阶段技能。
2. **资源优先**：任何写操作前先解析本轮显式资源、已绑定资源上下文、workspace 配置/缓存、历史上下文；已有目标资源时默认修改/补齐/发布，只有目标缺失且意图允许创建时才加载 create 类技能。
3. **优先复用本地 ID 映射**：已有 `.cache/<项目名>-schema.json` 中可确认新鲜的 `appType`/`formUuid`/`fieldId` 可复用；该文件不是远端真相。字段级表单操作优先交给 `create-form update/add-option/bind-datasource/validation/rule` 的 schema-aware 解析，不要求先外部 `get-schema`；若 CLI 返回字段不存在/重名/歧义 diagnostics，再按 candidates、`tableLabel`、已知 `fieldId` 或 `get-schema --compact --resolve-fields` 收敛。页面代码、数据、流程、公式等确实需要多字段/多表单映射时，每表单一次性执行 `get-schema --field-map-json` 并缓存完整字段摘要。不得猜测字段 ID，也不要用 `head`/`tail`/`grep` 截断 schema stdout 当证据。
4. **页面规格优先**：真实业务页先由 `yida-design` 输出 `prd.md` 与 `design.md`；两者是唯一设计事实源。`page-spec.json` 只在生成器/交接需要时从两者派生，复杂实现可用页面生成器生成可编译骨架，页面目标、区块、数据和交互以 PRD 为准，布局、主题、材质和状态视觉以 design.md 为准。
5. **配置优先于页面代码**：字段、公式、联动、报表、审批和集成交给对应技能；自定义页面负责展示数据、放置业务入口、打开详情页，并串联表单、流程、报表和导航入口。
6. **数据性能优先**：统计聚合用 `yida-report` 服务端聚合，不在前端拉全量后自行聚合。
7. **避免无效重试**：失败先查登录态/组织/参数/字段 ID，无修改不连续重试超 1 次。
8. **配置分三处存**：业务语义 → `prd/<项目名>/prd.md`；视觉契约 → `prd/<项目名>/design.md`；Schema ID → `.cache/<项目名>-schema.json`（prd 不记 ID）。
9. **临时文件入 project `.cache/`**：OpenYida 业务中间文件写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/`；Schema ID 映射仍写 `<projectRoot>/.cache/<项目名>-schema.json`。从 workspace 根执行命令时使用 `project/.cache/...`，从 project 工作目录内执行时使用 `.cache/...`；不要写仓库根目录或系统临时目录。
10. **报表美化先分流**：标准统计与原生报表用 `yida-report`；定制图表页面默认用 `yida-rechart`；只有明确 ECharts、维护旧 ECharts 页面或复杂 option 超出 Recharts 能力时用 `yida-chart`。
11. **按 schema 证据选技能**：先看 `formType`、组件树、`dataSource.online`；`receipt/process/report` 分别落到表单/流程/报表技能。
12. **官方示例范式优先**：蒸馏官方示例时先理解脱敏 schema 承载方式，不凭截图/标题/视觉判断。
13. **默认完成即停止**：完整应用默认以发布成功、完成轻量导航自动排序并输出 URL 与业务交付总结为 doneWhen；`yida-design` 输出的 `prd.md` 与 `design.md` 只服务于本轮应用或页面交付。数据源深读、精细导航整理、截图和 TaskCreate 都是 optionalAfterDone；seed records 属于完整应用默认阶段。
14. **UI 设计技能优先**：涉及应用蓝图、页面视觉、应用主题色、品牌色、全局换肤或 `--color-brand1-*` 时先读 `yida-design`；应用主题必须先根据行业、品牌、业务情绪和视觉目标做创意判断，禁止套用“科技=蓝、宠物=橙、法律=蓝”这类刻板配色。`podBlue` / `podGreen` / `podOrange` 等只是平台预置候选，同名 profile 可注入页面 token；只有 `yida-design` 明确 `shouldPassCreateAppTheme=true` 且 `themePresetKey` 命中平台 key 时才传给 create/update app。`blue` / `green` / `orange` 只兼容旧 spec。表单和页面只消费主题，不要在局部 Schema/JSX 中随意写死蓝色/紫色等品牌色。
15. **最终输出业务化**：最终回复先写 2-3 句业务交付总结，再给主入口链接。新增/修改/发布单个页面时主入口是当前页面 URL；其他完整应用、表单、流程、权限、主题、导航或批量资源场景主入口是应用首页 `{base_url}/{appType}/workbench`。业务总结说明创建/复用了哪些业务表单和页面、完成了哪些功能和默认示例数据/导航/详情样式状态；不要使用表格、资源 ID 清单或长列表。示例：“已完成订单、商品和客户等核心表单，并发布首页、订单管理和库存看板入口。当前应用已支持订单录入、库存预警、销售统计和表单详情查看，示例记录与轻量导航排序也已就绪。主入口：{base_url}/{appType}/workbench”。默认不输出 `资源类型 | 名称/用途 | ID | 状态` 表格，也不把 `g.alicdn.com` 静态资源、CDN 构建产物、locale JSON、`/admin` 管理页或中间文件 URL 当成最终结果。
16. **任务复盘沉淀**：任务完成前判断是否有可复用经验需要落盘到 CLI、测试或 skill。用户多次纠正、平台接口假成功、页面骨架共性质量问题、线上回读验收方法、一次性脚本可产品化等情况必须沉淀；详见 `references/task-retrospective.md`。

> 📖 每条规则的完整说明、PRD 质量门槛、临时文件路径规范、报表美化话术 → [references/development-rules.md](references/development-rules.md)

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 发布提示登录失效 | 先 `openyida login`，再 `openyida publish <源文件> <appType> <formUuid> --health-check` |
| 查已有表单的字段 ID | 字段级命令优先内部解析；仅当歧义未解、页面/流程/公式/数据代码需要多字段映射，或要人工确认时，用 `openyida get-schema <appType> <formUuid> --compact --resolve-fields "字段名"`，只使用唯一命中的 `fieldId`（详见 `yida-get-schema`） |
| 更新已有表单字段 | 表单用 `create-form` 的 update/add-option/bind-datasource/validation/rule：`openyida create-form update <appType> <formUuid> '[{"action":"update","label":"备注","changes":{"required":true}}]'`；CLI 内部读 schema 并输出 resolved/updated evidence，通常不需要先 `get-schema` |
| 发布提示 corpId 不匹配 | 问用户：确认在当前组织继续操作已解析资源，或 `openyida logout` 后重新登录到正确组织 |

---

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
|------|---------|---------|
| [环境准备与登录检测](references/setup-and-env.md) | 环境依赖、env 解读、多环境 token 登录、悟空降级、project 初始化 | 环境异常或登录问题时 |
| [核心规则详解](references/development-rules.md) | 成功率清单、PRD 门槛、临时文件、报表美化、corpId | 编写 PRD / 规范执行前 |
| [字段类型 / URL 规则](references/field-and-url-reference.md) | 表单字段类型速查、应用 URL 拼接规则 | 建表单 / 拼访问链接时 |
| [宜搭 API](references/yida-api.md) | 宜搭 API 完整参数 | 调用 API 前 |
| [公式函数库](references/formula-functions.md) | 公式函数速查 | 编写公式前 |
| [官方示例 Schema 范式](references/official-example-schema-patterns.md) | 脱敏 schema 承载范式 | 蒸馏官方示例时 |
| [任务复盘与沉淀规范](references/task-retrospective.md) | 任务收尾沉淀、CLI/skill/页面骨架反哺、视觉参考和主题经验 | 任务完成前、用户要求总结经验或多次纠正同类问题时 |
| [查询条件构造](references/query-condition-guide.md) | 数据查询条件写法 | 数据查询/筛选时 |
| [报表字段配置](references/report-field-config-guide.md) | 报表字段配置规范 | 配置报表时 |
| [版本功能差异](references/edition-features-guide.md) | 各版本能力差异 | 版本能力查询时 |
| [模型 API](references/model-api.md) | 宜搭模型接口 | 调用宜搭模型能力时 |
