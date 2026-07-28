---
name: openyida
description: >
  宜搭 AI 应用开发总入口技能。通过有 AI Coding 能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。
  包含资源上下文解析、应用创建/复用、表单设计/更新、自定义页面开发、页面发布、登录态管理等完整开发流程。
  当用户提到"宜搭"、"yida"、"低代码"、"创建应用"、"创建表单"、"发布页面"、"搭建"、"系统"等关键词时，使用此技能；以下情况不要触发：只是讨论通用前端/后端代码、非宜搭平台产品、或只需要解释概念而不操作宜搭资源。
---

# 宜搭 AI 应用开发指南

通过有 AI Coding 能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。所有操作通过 **`openyida`** CLI 统一执行。登录态分流必须以 `openyida agent-capabilities --summary-json` 或 `openyida login --check-only --json` 返回的 auth snapshot 为准；只有 snapshot 明确返回 `login.auth_source=env` 或 `failure_reason=env_token_missing` 时，才按宿主注入 token 模式处理。其他未登录 token 场景走默认 OAuth token 登录，不要根据 agent 名称、宿主类型或手写环境判断自行分流；禁止读取 `.cache/cookies*.json`。

---

## 语言与完成性

- 默认沿用用户语言输出；中文用户用中文。CLI 命令、API 路径、参数名、`fieldId`、`appType`、`formUuid` 等技术标识保持英文原文。
- 一旦进入写操作任务，必须跑到对应子技能的 `doneWhen` 或验收闭环；只做预检、只读 schema、只写本地文件或只规划下一步，都不能对用户宣称完成。

## 宿主能力适配

- 如果当前宿主提供 `use_skill` / `search_skills`：必须通过 `use_skill("<技能名>", "<本阶段目的>")` 加载主技能和子技能，禁止用 `Read` / `read_file` / `cat` 读取 `SKILL.md` 路径；`use_skill` 会稳定返回技能内容和可读取的辅助文件列表。
- `skills-index.json` 仅供 yida-agent 或同构宿主做机器可读发现；不支持该索引的宿主忽略它，不要把它当作运行前置条件。
- 支持 `use_skill` / `search_skills` 的宿主只能读取该工具返回的辅助文件；禁止猜测 `.skills`、`skills`、`yida-skills`、插件缓存、workspace/project/.skills 等安装路径。
- 如果当前宿主没有 `use_skill` / `search_skills`：按本文的技能路由表选定技能名，按 `skills/<技能名>/SKILL.md` 定位当前阶段唯一必要的子技能文档；禁止并发批量读取多个 `SKILL.md`；禁止预读未来阶段技能。
- `references/`、`scripts/`、`assets/` 等辅助文件只能在已加载对应技能后，读取该技能正文明确列出的相对路径；不要把 yida-agent 的 sandbox 路径当作通用路径。

---

## 第一步：只读预检（先于真实资源操作）

> ⚡ **前置门槛**：确认 openyida 已安装、Node/npm 依赖达标、登录态就绪。**未通过只读验证前，禁止创建应用/页面/表单或发布等任何真实资源操作。**

**怎么做**：优先跑一次 `openyida agent-capabilities --summary-json`。该 compact 命令只返回 version、`login.status`、`login.can_auto_use`、`workdir`、`workdir_exists`、`cache_dir`、`openyida_task_cache_dir`、`command_count` 和 `command_manifest_digest` 等 agent 必需字段，避免 stdout 过大导致宿主 offload 或误判未读到结果，也避免反复 `which openyida`、`openyida --version`、`openyida --help`、`openyida env`、`login --check-only`。

`openyida agent-capabilities --json` 是 full capabilities，只在命令契约排障、manifest 差异诊断或深度调试时使用；不要把 full capabilities 放进 `fast_build` 默认链路。

字段映射：compact 输出的 `workdir` 对应 full capabilities 的 `active.projectRoot`；`workdir_exists` 对应 `active.projectRootExists`。

若当前 OpenYida 版本还没有 `agent-capabilities`，退回跑 `openyida env --json` 和 `openyida login --check-only --json`。旧版本地 agent 不需要认识 `skills-index.json`，也不需要支持 `agent-capabilities` 才能继续执行。

| 检测结果 | 处理 |
|---------|------|
| 命令跑不了（`command not found`） | openyida 未安装 → `npm install -g openyida` |
| Node/npm 版本不达标 | 先升级 Node（≥16）再装/升级 openyida |
| `login.auth_mode=token` 且 `status=ok` / `can_auto_use=true` | 继续执行业务命令 |
| snapshot 返回 `login.auth_source=env` / `failure_reason=env_token_missing` | STOP；宿主必须注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN`；禁止触发 OAuth；禁止读 `.cache/cookies*.json` |
| `login.auth_mode=token` 且未登录，且 snapshot 未返回 env 注入模式 | `openyida login`（指定入口带 URL 或 flag），完成后再 `openyida login --check-only --json` 验证 |
| `workdir_exists` / `active.projectRootExists` 为 false | 无工作目录 → `openyida copy` 初始化 |

**👉 环境异常、登录失败、悟空降级、OAuth token 登录异常等特殊分支 → [references/setup-and-env.md](references/setup-and-env.md)。正常 `agent-capabilities` 通过时不要默认读取该 reference。**

---

## 默认执行路径

OpenYida builder 默认使用 `create-app / create-form / create-page / generate-page / publish` 等常规命令链路。CLI 内部负责读取必要的 schema、定位字段、输出 compact diff/evidence、readback 和 bindings，模型不要为了简单字段更新先拉取大 schema，也不要把新建命令当作默认动作。

`.cache/<项目名>-schema.json` 只是本地 ID 映射，不等于远端真相。路径不明确时先只读确认或询问用户；不要通过新建同类资源规避不确定性。

---

## 路由前置：resolve_resource_context

> Resource-First Workflow：任何完整搭建或单点任务都先解析目标资源上下文，再判断是新建、补齐、修改还是发布。不要把 `create-app` / `create-page` / `create-form` 当作默认动作。

### 资源解析顺序

按以下优先级选择 app/page/form/process，上游来源更明确时覆盖下游来源：

1. 本轮用户明确给出的 `appType`、`formUuid`、应用 URL、页面 URL、流程标识或页面/表单上下文；
2. agent 或宿主注入的当前任务 resource context；
3. workspace 中的 `project/config.json`、`.cache/<项目名>-schema.json`、`.cache/openyida/**` 等本地 cache/config；
4. 当前会话历史中已创建或已确认的资源；
5. 无资源且用户明确说“从零创建 / 新建另一个 / 创建新应用或新页面”时，允许创建缺失资源；
6. 仍有多个同优先级候选、当前轮显式资源互相冲突，或无法判断目标时，才 `ask_human`。

**本轮显式目标覆盖注入上下文**：agent / 宿主注入的 bound app/page/form 只是默认候选，不是锁定目标。若当前会话绑定页面 A，但用户本轮明确给出页面 B 的 URL、`formUuid`、页面名称或其他可识别线索，必须重新解析 B；B 能唯一解析时切换到 B，B 不能唯一解析时 `ask_human`，禁止静默回落到 A。

可选的 agent 注入协议如下；本地 agent 不支持时忽略，不作为运行前置：

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

`precreated` 表示该 app 由 agent / 宿主提前创建并绑定到本轮任务。这些字段都是可选提示：缺失时按普通已有资源处理，不作为运行前置。

**绑定 app 只复用不改名**：OpenYida 技能侧不自动修改应用名称；即使目标 app 来自 agent / 宿主预创建资源，也只复用该 `appType` 继续创建、更新或发布资源。应用名修正如有需要由宿主或 yida-agent 侧负责；技能不得因为占位名、页面标题或业务语义推导触发应用名修改。

### create-or-update 判定

- 已解析到目标 app 时，默认在该 app 内修改、补齐或发布，不执行 `yida-create-app`；只有用户明确要求“新建另一个应用”并确认目标组织后才创建新 app。
- 已解析到目标自定义页面 URL / `formUuid` / bound page 时，默认写源码并发布到该页面，不执行 `yida-create-page`；只有缺少目标 display page 且本次意图允许新增页面时才创建。
- 已解析到目标表单 `formUuid` 时，字段结构诉求默认走 `yida-create-form-page` 的 update/patch/rule/bind-datasource 模式，不创建同名或同类表单。
- 已解析到目标流程表单 / `processCode` 时，默认走 `yida-process-rule` 配置/更新流程，不从零执行 `yida-create-process`。
- 完整应用 `fast_build` 也遵守本规则：先占位主页面，再建表单，最后回填发布。

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
> 用户说“按默认方案 / 不要追问 / 直接创建 / 尽快搭建”时，`yida-app` 选择 `fast_build`：先解析并复用已有资源，只创建缺失且允许创建的应用/表单/页面，最后发布并输出链接。
> `yida-app fast_build` 使用常规 OpenYida 命令编排。

**默认链路**：`fast_build` 必须只做 `resolve app → reserve main page → resolve forms → 编写/更新主页面源码 → 发布 → 返回访问链接`。若需要首页/工作台/智能助手/门户门面且主页面缺失，先创建空 display page 占位，再建表单，最后回填发布；不要因此默认执行导航重排。不要因为应用名里有“看板 / 系统 / 管理”就升级到 `deep_design` 或 `full_demo`。

**fast_build 默认加载边界**：只加载 `yida-app` 和当前阶段必需的子技能。`yida-create-app`、`yida-create-page`、`yida-create-form-page` 只有在目标资源缺失且本次意图允许创建时才加载；已有资源时进入对应 update / publish 分支。页面默认走 Code Canvas；当用户明确要求普通自定义页面 JSX/Jsx 组件链路，或页面强依赖普通自定义页实例桥（`this.$(fieldId)` / `this.utils.yida.*` / `this.dataSourceMap` / 表单提交或字段双向绑定深度耦合）时，选择 `yida-custom-page`。不要默认加载 `yida-page-uiux`、`yida-data-source-connectors`、`yida-data-management`、`yida-nav-group`、`yida-dashboard`，也不要默认深读 `references/`。

**Canvas 数据边界**：完整应用/真实交付页如果展示列表、看板或详情记录，必须优先把本轮真实 `appType/formUuid/fieldId` 写入 `page-spec.json` 的 `dataBinding.mode=form`；需要演示记录时先写入真实表单再读取。未接真实表单且未写入 demo records 时，页面展示空态/入口，不用前端 seedRows 冒充业务数据。

**字段级命令内置解析**：简单字段属性更新（例如“把备注字段改为必填”）直接调用 `openyida create-form update <appType> <formUuid> '[{"action":"update","label":"备注","changes":{"required":true}}]'`；CLI 会内部读取当前 schema，按 label/fieldId/tableLabel 定位字段，并在 JSON 中输出 resolved/updated evidence。`add-option`、`bind-datasource`、`validation`、`rule` 等字段级命令也可直接按 label 或已知 fieldId 操作，成功返回 compact `resolved`，失败返回 compact `diagnostics[].candidates`。只有字段解析仍歧义、需要底层 patch path，或页面代码/数据查询/流程/公式等确实需要多个 `fieldId` 时，才对目标表单执行一次 `openyida get-schema <appType> <formUuid> --field-map-json` 并合并到 `.cache/<项目名>-schema.json`。不要用 `head`/`tail`/`grep` 截断 get-schema stdout 作为字段证据，也不要因此对同一表单重复拉取多轮 schema。

**Canvas 生成路径二选一**：走模板路径时，先写业务化 `page-spec.json` 再 `openyida generate-page ... --spec ... --compile`，后续只读 manifest/摘要并小范围 Edit；不要立即 Read 大段源码再全量 Write 覆盖同一路径。若已经明确最终页面结构，跳过 `generate-page` 直接 Write 最终 `.canvas.jsx`。

**doneWhen**：`yida-app` 发布主页面成功并输出可访问 URL。到这里默认完成；不要发布后继续 TaskCreate、重复读技能或继续规划。

**optionalAfterDone**：导航整理、示例数据、公开访问、截图验证、深度视觉方向、数据源/连接器深度接入、报表/大屏，只在用户明确要求或 `yida-app` 模式为 `full_demo` / `deep_design` 时执行。

---

## 技能路由（单一 / 增量任务）

先按用户任务命中一个**大类目录**，再在该目录内选定 1 个最匹配的子技能。支持 `search_skills` 的宿主可优先用用户原话搜索；支持 `use_skill` 的宿主用 `use_skill("<技能名>", "<本阶段目的>")` 加载。`skills-index.json` 中的 `route_groups` 与下表保持一致，供 yida-agent 或同构宿主做机器路由。

**机器路由推荐顺序**：先用 `route_groups[].signals` 命中 `yida-skills/<area>` 大类；只在该 `category` 下用 skill 的 `description`、`tags`、`aliases`、`positive_signals` 精排；命中 `negative_signals` 的候选降权或剔除；再用下方“高频分歧”覆盖易混场景；最后调用 `use_skill`。`command_ids` 只用于解释该技能可能调用哪些 CLI，不要替代技能加载；`done_when` 只用于判断完成条件。`category` 是路由目录，不是技能路径，必须保持 `yida-skills/<简名>` 格式。

| 大类目录 | 第一层意图信号 | 子技能 |
|------|------|------|
| `yida-skills/context` | 登录、退出、切换组织、组织版本/容量、Schema、fieldId、只读预检 | `yida-login`、`yida-logout`、`yida-basic-info`、`yida-get-schema`、`yida-corp-efficiency` |
| `yida-skills/app` | 从零搭应用、完整系统、应用蓝图、应用导航、主题、多语言 | `yida-app`、`yida-create-app`、`yida-app-uiux`、`yida-nav-group`、`yida-theme`、`yida-i18n` |
| `yida-skills/form` | 表单字段、公式、校验、业务关联规则、详情页、批量录入、数据记录 | `yida-create-form-page`、`yida-formula`、`yida-formula-evaluate`、`yida-business-rule`、`yida-form-detail`、`yida-table-form`、`yida-data-management` |
| `yida-skills/process` | 审批、流程表单、流程规则、节点/分支/字段权限、流程代理 | `yida-create-process`、`yida-process-rule`、`yida-agent-center` |
| `yida-skills/page` | 自定义展示页、Code Canvas、普通自定义页面 JSX/Jsx 组件、页面发布、页面视觉、页面内导航、PPT 页面 | `yida-create-page`、`yida-canvas-custom-page`、`yida-custom-page`、`yida-canvas-data-binding`、`yida-canvas-upgrade`、`yida-publish-page`、`yida-openyida-publish-guard`、`yida-page-uiux`、`yida-density`、`yida-nav-shell`、`yida-ppt-slider` |
| `yida-skills/analytics` | 报表、统计、图表、ECharts、看板、驾驶舱、大屏 | `yida-report`、`yida-chart`、`yida-dashboard` |
| `yida-skills/integration` | 连接器、外部 API、执行动作、设计器数据源、集成自动化、逻辑流 | `yida-integration`、`yida-connector`、`yida-connector-safe-actions`、`yida-data-source-connectors` |
| `yida-skills/access` | 平台/应用/表单/页面权限、公开访问、分享 | `yida-corp-manager`、`yida-app-permission`、`yida-form-permission`、`yida-page-config` |
| `yida-skills/ops` | Sequence、主键冲突、VOC 反馈 | `yida-db-seq-fix`、`yida-voc` |
| `yida-skills/agent` | 导出对话、读取钉钉文档/听记、会议纪要/闪记转 PRD | `yida-export-conversation`、`yida-document-markdown`、`yida-tingji`、`yida-flash-note-to-prd` |

### 高频分歧

| 用户意图 | 选哪个 |
|------|------|
| 从零搭一个完整应用/系统 | `yida-app`；默认 `fast_build`，不要自动升级到深度设计 |
| 读取钉钉在线文档正文 | `yida-document-markdown`，使用登录态接口获取 Markdown |
| 按 taskUuid 读取钉钉听记 | `yida-tingji`，将听记任务 ID 原样传入命令 |
| 用户给 taskUuid 并要求转 PRD | 先用 `yida-tingji` 读取听记内容，再把已有内容交给 `yida-flash-note-to-prd` 生成 PRD |
| 已有会议纪要/闪记内容转 PRD | `yida-flash-note-to-prd`，只处理已有内容，不负责按 taskUuid 拉取听记 |
| 只创建应用壳并拿 appType | `yida-create-app` |
| 创建自定义展示页资源 | `yida-create-page`，之后默认接 `yida-canvas-custom-page` 和 `yida-publish-page` |
| 开发表单字段结构 / 增删改字段 | `yida-create-form-page` |
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
| 页面视觉方向、去 AI 味 | `yida-page-uiux`；实现层仍交给 Code Canvas 或普通自定义页面技能 |
| 应用级主题、品牌色、全局换肤 | `yida-theme` |
| 平台左侧导航树分组/排序 | `yida-nav-group` |
| 页面隐藏原导航后自绘导航壳 | `yida-nav-shell` |
| 普通报表/统计 | `yida-report` |
| ECharts、高级图表、大屏视觉 | `yida-chart` |
| 产品化经营看板/驾驶舱交付 | `yida-dashboard` |
| 页面美化/视觉方向 | `yida-page-uiux` 只产出视觉决策；落地实现仍回到 `yida-canvas-custom-page` 或 `yida-custom-page` |
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

1. **技能加载唯一入口**：执行任何子技能前，支持 `use_skill` 的宿主必须调用 `use_skill("<技能名>", "<本阶段目的>")` 加载对应技能；不要用 `Read` / `read_file` / `cat` 读取 SKILL.md 路径，不凭记忆猜参数格式。
2. **corpId 一致性检查**：创建或发布页面前对比 prd/resource context 与当前 auth snapshot（本地 OAuth token session 或 snapshot 明确返回的宿主注入 env token）中的 corpId，不一致必须询问用户（重新登录到目标组织，或确认在当前组织继续操作已解析资源/缺失资源）。
3. **发布前本地校验**：普通自定义页面 `.oyd.jsx` / `.jsx` 发布前跑 `openyida check-page` + `openyida compile`；Code Canvas `.canvas.jsx` 不跑这两个普通自定义页面检查，改由 `openyida publish` 的 Canvas 编译阶段或 `compileCanvasLocal` 快检校验；JSON 配置写盘后先解析校验，再调用平台命令。OpenYida 生成产物硬禁 emoji：页面源码、Canvas 源码、表单 Schema、发布 Schema 和产物文件路径出现 emoji 时必须改源码/字段 JSON/路径，不得用 `--skip-lint` 或重复发布绕过。
4. **页面源码修改必须发布闭环**：只要本轮 Write/Edit/Create 了页面源码 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`（含完整搭建、补齐、已有页面 update path、单点优化），final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>` 命令结果；本地文件编辑、diff、本地校验或编译只证明源码可发布，不等于远端页面已更新。若没有 publish 成功证据，final 只能说“源码已修改，尚未发布”，禁止说“页面已更新 / 已重新发布 / 已上线”。
5. **命令输入文件禁止 shell 写入**：当 OpenYida 命令需要 JSON/YAML/CSV/config/script 文件参数时，先使用当前 agent 运行时提供的结构化文件写入工具（如 create_file / Write / file edit tool）创建文件，再把路径传给命令；禁止用 shell heredoc、`cat`/`echo`/`printf`/`tee` 加输出重定向，或把命令 stdout 重定向成业务文件。
6. **读文件少用 Bash 噪声**：读取或定位 workspace 文件优先用宿主的 Read / Glob / Grep；OpenYida CLI 已返回成功 JSON、URL 或 `formUuid/appType` 时，不要再用 Bash `cat`/`ls` 做无意义复核。
7. **OpenYida CLI 不吞诊断**：不要给 `openyida` 命令加 `2>/dev/null`；失败时保留 stdout/stderr（必要时用 `2>&1` 合并诊断）。遇到 DENIED 或同一命令重复失败，先换策略、改输入或重做只读确认，不要盲目微调后重跑。

### 重要规则（IMPORTANT，影响质量/性能/可维护性）

1. **按阶段加载必要技能**：按意图选 1 个主技能；完整应用按阶段加载当下唯一需要的子技能，禁止并发批量读取多个 `SKILL.md` 或预读未来阶段技能。
2. **Resource-First**：任何写操作前先解析本轮显式资源、agent bound context、workspace cache/config、历史上下文；已有目标资源时默认修改/补齐/发布，只有目标缺失且意图允许创建时才加载 create 类技能。
3. **优先复用本地 ID 映射**：已有 `.cache/<项目名>-schema.json` 中可确认新鲜的 `appType`/`formUuid`/`fieldId` 可复用；该文件不是远端真相。字段级表单操作优先交给 `create-form update/add-option/bind-datasource/validation/rule` 的 schema-aware 解析，不要求先外部 `get-schema`；若 CLI 返回字段不存在/重名/歧义 diagnostics，再按 candidates、`tableLabel`、已知 `fieldId` 或 `get-schema --compact --resolve-fields` 收敛。页面代码、数据、流程、公式等确实需要多字段/多表单映射时，每表单一次性执行 `get-schema --field-map-json` 并缓存完整字段摘要。不得猜测字段 ID，也不要用 `head`/`tail`/`grep` 截断 schema stdout 当证据。
4. **模板优先**：复杂产物先用 `openyida sample` 或现有示例生成骨架，再做最小改动。
5. **配置承载优先于代码**：字段/公式/联动/报表/审批/集成交给对应技能，自定义页面只做展示与胶水。
6. **数据性能优先**：统计聚合用 `yida-report` 服务端聚合，不在前端拉全量后自行聚合。
7. **避免无效重试**：失败先查登录态/组织/参数/字段 ID，无修改不连续重试超 1 次。
8. **配置分两处存**：业务语义 → `prd/<项目名>.md`；Schema ID → `.cache/<项目名>-schema.json`（prd 不记 ID）。
9. **临时文件入 project `.cache/`**：OpenYida 业务中间文件写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/`；Schema ID 映射仍写 `<projectRoot>/.cache/<项目名>-schema.json`。从 workspace 根执行命令时使用 `project/.cache/...`，从 project 工作目录内执行时使用 `.cache/...`；不要写仓库根目录或系统临时目录。
10. **报表美化先问方案**：用户说"优化/美化报表"时先问选原生报表(`yida-report`)还是 ECharts(`yida-chart`)。
11. **按 schema 证据选技能**：先看 `formType`、组件树、`dataSource.online`；`receipt/process/report` 分别落到表单/流程/报表技能。
12. **官方示例范式优先**：蒸馏官方示例时先理解脱敏 schema 承载方式，不凭截图/标题/视觉判断。
13. **默认完成即停止**：完整应用默认以发布成功并输出 URL 为 doneWhen；UIUX、数据源深读、示例数据、导航、截图、TaskCreate 和深度设计都是 optionalAfterDone。
14. **主题技能优先**：涉及应用主题色、品牌色、全局换肤或 `--color-brand1-*` 时先读 `yida-theme`；表单和页面只消费主题，不要在局部 Schema/JSX 中随意写死蓝色/紫色等品牌色。
15. **任务复盘沉淀**：任务完成前判断是否有可复用经验需要落盘到 CLI、测试、sample 或 skill。用户多次纠正、平台接口假成功、sample 共性质量问题、线上回读验收方法、一次性脚本可产品化等情况必须沉淀；详见 `references/task-retrospective.md`。

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
| [任务复盘与沉淀规范](references/task-retrospective.md) | 任务收尾沉淀、CLI/skill/sample 反哺、Dribbble/sample/主题经验 | 任务完成前、用户要求总结经验或多次纠正同类问题时 |
| [查询条件构造](references/query-condition-guide.md) | 数据查询条件写法 | 数据查询/筛选时 |
| [报表字段配置](references/report-field-config-guide.md) | 报表字段配置规范 | 配置报表时 |
| [版本功能差异](references/edition-features-guide.md) | 各版本能力差异 | 版本能力查询时 |
| [模型 API](references/model-api.md) | AI 模型接口 | 调用宜搭 AI 模型时 |
