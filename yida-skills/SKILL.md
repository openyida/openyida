---
name: openyida
description: >
  宜搭 AI 应用开发总入口技能。通过有 AI Coding 能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。
  包含资源上下文解析、应用创建/复用、表单设计/更新、自定义页面开发、页面发布、登录态管理等完整开发流程。
  当用户提到"宜搭"、"yida"、"低代码"、"创建应用"、"创建表单"、"发布页面"、"搭建"、"系统"等关键词时，使用此技能；以下情况不要触发：只是讨论通用前端/后端代码、非宜搭平台产品、或只需要解释概念而不操作宜搭资源。
---

# 宜搭 AI 应用开发指南

通过有 AI Coding 能力的智能体（悟空/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。所有操作通过 **`openyida`** CLI 统一执行，命令自动读取 `.cache/cookies.json`，Cookie 失效时自动触发登录，无需手动登录。

---

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
| `login.status` 不是 `ok` 且 `login.can_auto_use` 不是 true | 未登录 → `openyida login`（指定入口带 URL 或 flag） |
| `workdir_exists` / `active.projectRootExists` 为 false | 无工作目录 → `openyida copy` 初始化 |

**👉 环境异常、登录失败、悟空降级、Codex handoff 等特殊分支 → [references/setup-and-env.md](references/setup-and-env.md)。正常 `agent-capabilities` 通过时不要默认读取该 reference。**

---

## 执行路径：schema-managed 与 direct/standalone

在选择完整应用或单一任务技能前，先判断本次写操作属于哪条执行合同。Agent 只做轻量路由；`schema` 子命令自身强制 validate/plan/apply 与 `planId`，legacy 写命令仅对明确传入的 schema-managed context/state 做最小 fail-closed guard。上下文不足以判断时，先只读确认或询问用户，不由 Agent 猜测 ownership。

| 路径 | 何时选择 | 执行方式 |
|------|----------|----------|
| `schema-managed` | 用户提供 Schema-as-Code manifest、要求 `schema validate/plan/apply`，或 CLI/context 明确目标身份来自 Schema-as-Code state | 走 `openyida schema validate <manifest> --json --quiet` → `openyida schema plan <manifest> --state <path> --json --quiet` → 用户审阅本次 `planId` → `openyida schema apply <manifest> --state <path> --plan-id <reviewed-planId> --json --quiet` |
| `direct/standalone` | 没有 manifest/state 管理关系，或用户明确要求 standalone legacy 命令 | 走下方 Resource-First direct workflow：先解析已有资源，再 create missing only / update / publish |

`.cache/<项目名>-schema.json` 只是 direct/standalone 的 ID 映射，不等于 Schema-as-Code state。路径不明确时先只读确认或询问用户；不要通过新建同类资源规避不确定性。

---

## 路由前置：resolve_resource_context

> Resource-First Workflow：进入 direct/standalone 路径后，任何完整搭建或单点任务都先解析目标资源上下文，再判断是新建、补齐、修改还是发布。不要把 `create-app` / `create-page` / `create-form` 当作默认动作。

### 资源解析顺序

按以下优先级选择 app/page/form/process，上游来源更明确时覆盖下游来源：

1. 本轮用户明确给出的 `appType`、`formUuid`、应用 URL、页面 URL、流程标识或页面/表单上下文；
2. agent 或宿主注入的当前任务 resource context；
3. workspace 中的 `project/config.json`、`.cache/<项目名>-schema.json`、`.cache/openyida/**` 等 standalone cache/config；
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
    "precreated": true,
    "placeholderName": "新应用",
    "allowCreate": false,
    "allowRename": true
  },
  "page": { "formUuid": "FORM_xxx", "source": "explicit_prompt|url|agent_bound|workspace_cache", "allowCreate": false },
  "form": { "formUuid": "FORM_xxx", "source": "explicit_prompt|url|workspace_cache", "allowCreate": false }
}
```

`precreated` 表示该 app 由 agent / 宿主提前创建并绑定到本轮任务；`placeholderName` 是宿主创建时的占位名；`allowRename` 控制 OpenYida 是否可在语义名稳定后修正应用名称。这些字段都是 direct/standalone 的可选提示：缺失时按普通已有资源处理，不作为运行前置。

**预创建占位 app 改名**：当 `app.source === "agent_bound"`，且满足 `precreated === true` 或当前名称 / `placeholderName` 命中“新应用 / 未命名 / 占位 / APP_xxx”等占位样式，并且 `allowRename !== false`、用户没有明确要求保留原应用名称、目标不是 schema-managed、已从本轮需求确定稳定语义应用名时，`yida-app` 应复用该 `appType` 并调用 `openyida update-app APP_xxx --name "语义应用名"`。该动作只修正 agent 预创建占位应用名称；不要按标题发现/adopt 其他应用，不要 cleanup orphan，不要对非占位已有业务应用自动改名，不要让 `yida-create-app` 参与改名，也不要把 schema-managed 资源交给 legacy `update-app`。

### create-or-update 判定

- 已解析到目标 app 时，默认在该 app 内修改、补齐或发布，不执行 `yida-create-app`；只有用户明确要求“新建另一个应用”并确认目标组织后才创建新 app。
- 已解析到目标自定义页面 URL / `formUuid` / bound page 时，默认写源码并发布到该页面，不执行 `yida-create-page`；只有缺少目标 display page 且本次意图允许新增页面时才创建。
- 已解析到目标表单 `formUuid` 时，字段结构诉求默认走 `yida-create-form-page` 的 update/patch/rule/bind-datasource 模式，不创建同名或同类表单。
- 已解析到目标流程表单 / `processCode` 时，默认走 `yida-process-rule` 配置/更新流程，不从零执行 `yida-create-process`。
- 完整应用 `fast_build` 也遵守本规则：`resolve app → resolve forms → resolve main page → create missing resources only → update/publish`。

验收心智模型：

| 场景 | 正确动作 |
|------|----------|
| `帮我搭建访客系统` + bound app/page | 不 create app/page；直接在已有 app/page 内补表单、写页面并发布 |
| `在 APP_xxx 里增加客户表和回访页面` | 不 create app；允许按缺口 create form/page |
| `优化这个页面 URL` | 不 create app/page；直接进入 custom-page + publish existing page |
| bound 页面 A，但用户说“修复页面 B 的 xx 字段” | 先解析页面/表单 B；B 有 URL/formUuid 时改 B，只有 B 无法唯一识别时询问用户，不能默认改 A |
| `从零创建一个 CRM 应用` 且无 context | 允许 create app/form/page 并发布 |
| 多个 app/page 候选 | 按来源优先级选；同级冲突或目标不明才问人 |

> 该 resource context 是 direct/standalone 路径的前置解析；schema-managed 路径仍以 schema CLI 的 validate/plan/apply 结果为准。legacy direct 命令的 guard 只覆盖明确 schema-managed context/state，不替代这里的资源前置解析。

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
> `yida-app fast_build` 是 direct/standalone 编排，仅在上方执行路径选择为 direct/standalone 时使用。

**默认链路**：`fast_build` 必须只做 `resolve app → resolve forms → resolve main page → create missing resources only → 编写/更新主页面源码 → 发布 → 返回访问链接`。不要因为应用名里有“看板 / 系统 / 管理”就升级到 `deep_design` 或 `full_demo`。

**fast_build 默认加载边界**：只加载 `yida-app` 和当前阶段必需的子技能。`yida-create-app`、`yida-create-page`、`yida-create-form-page` 只有在目标资源缺失且本次意图允许创建时才加载；已有资源时直接加载 `yida-create-form-page` 的 update 分支、`yida-custom-page` 和 `yida-publish-page` 等当前阶段技能。Code Canvas 尚未全量，只有用户明确要求、已有页面为 `YidaCodeCanvas`，或已确认当前组织/页面支持时才加载 `yida-canvas-custom-page`。不要默认加载 `yida-page-uiux`、`yida-data-source-connectors`、`yida-data-management`、`yida-nav-group`、`yida-dashboard`，也不要默认深读 `references/`。

**doneWhen**：`yida-app` 发布主页面成功并输出可访问 URL。到这里默认完成；不要发布后继续 TaskCreate、重复读技能或继续规划。

**optionalAfterDone**：导航整理、示例数据、公开访问、截图验证、深度视觉方向、数据源/连接器深度接入、报表/大屏，只在用户明确要求或 `yida-app` 模式为 `full_demo` / `deep_design` 时执行。

---

## 技能路由（单一 / 增量任务）

> 选定 **1 个**最匹配的项执行。表**按业务域分组**，每组内既可能是 skill 也可能是 CLI：
> - 行名为 `yida-xxx` / `sls-log-workbench` 的是 **skill** → 在支持 `use_skill` 的宿主中调用 `use_skill("<技能名>", "<本次目的>")` 加载后执行；
> - 行名为 `openyida xxx` 并标 **`CLI`** 的**无 SKILL.md** → 识别到诉求直接执行命令、**不要当 skill 去 read**。
>
> 按分组 +「何时选择」内联区别对号入座即可。

> ⚠️ **同类易错先分清**：改字段结构→`create-form-page`｜只读 Schema→`get-schema`｜改数据记录→`data-management`｜详情页美化→`form-detail`；自定义页视觉方向/去AI味→`page-uiux`(定方向)｜token/组件实现→`custom-page`(design-system)；加导航先分清→平台左侧菜单分组/排序→`nav-group`｜页面隐藏应用导航后页面内自绘导航壳→`nav-shell`（必须隐藏原导航，并让导航项 URL 带 `isRenderNav=false` 等参数）；字段实时校验→`formula`｜提交后编排→`integration`｜跨表高级函数→`business-rule`；从零建流程→`create-process`｜改已有流程→`process-rule`；权限按层级：组织→`corp-manager`／应用→`app-permission`／表单→`form-permission`／页面分享→`page-config`；**自定义页面选路见下方专表**。

> 🧭 **自定义页面选路（兼容优先，按顺序命中即停）**：
> 1. **默认 → native** `yida-custom-page`：平台全量兼容的 `.oyd.jsx` 链路，适合完整应用 `fast_build` 和未确认 Canvas 能力的组织；
> 2. 仅当用户明确要求 Code Canvas / 代码画布，已有页面 Schema 是 `YidaCodeCanvas`，或已确认当前组织/页面支持 Canvas → `yida-canvas-custom-page`；
> 3. 已有普通 `.oyd.jsx` 要迁到 Canvas，且目标组织支持 Canvas → `yida-canvas-upgrade`。
>
> 依据：Code Canvas 组件在宜搭平台侧尚未全量。native `.oyd.jsx` 是默认兼容链路；Canvas 代码在宿主页真实 `window` 中 `new Function` 执行，但物料只透传 `code/runtimeCode/importedModules/pageType`，无 `this` 上下文、无 `dataSourceMap`，`this.utils.yida.*` 不可用。需要实例桥或未确认 Canvas 支持时留 native。

| 分组 | 加载目标 | 何时选择（关键区别已内联） |
|------|------|--------------------------|
| **应用与登录** | 加载子技能 `yida-app` | 完整搭建或补齐一个 standalone 应用；默认 `fast_build`，复用已解析资源，发布主页面拿到 URL 即完成 |
| | 加载子技能 `yida-create-app` | 仅在没有目标 app 且用户意图允许新建应用时创建并拿 appType；已有 appType/应用 URL/bound app 时禁止创建 |
| | `openyida update-app` `CLI` | 仅由 `yida-app` 在 agent_bound / precreated 占位 app 语义名确定后修正应用名称，或用户明确要求修改当前 app 信息时直接执行；不是子技能，不用于发现或接管其他应用 |
| | 加载子技能 `yida-login` | 手动触发登录（通常自动触发） |
| | 加载子技能 `yida-logout` | 切换账号或组织 |
| **页面与表单** | 加载子技能 `yida-create-page` | 仅在目标 display page 缺失且用户意图允许新增页面时创建空白自定义页面；已有页面 URL/formUuid/bound page 时禁止创建 |
| | 加载子技能 `yida-create-form-page` | 创建/更新表单、增删改**字段结构**（已有 form 走 update；已有 app 中新增数据表才 create） |
| | 加载子技能 `yida-create-process` | 仅在无既有流程/表单上下文且用户要从零建**带审批**流程表单时使用；已有 form/process 先配置或转换现有资源 |
| | 加载子技能 `yida-page-uiux` | 单点页面美化、用户明确要求视觉方向/去 AI 味，或 `yida-app` 进入 `deep_design` 时使用；`fast_build` 不默认加载 |
| | 加载子技能 `yida-custom-page` | **自定义页面默认兼容链路**：native `.oyd.jsx`，适合完整应用 `fast_build` 和未确认 Canvas 能力的组织 |
| | 加载子技能 `yida-canvas-custom-page` | Code Canvas 可选链路：用户明确要求代码画布、已有页面为 `YidaCodeCanvas`，或已确认当前组织/页面支持 Canvas 时使用 |
| | 加载子技能 `yida-canvas-upgrade` | 将已有普通 `.oyd.jsx` / `Jsx` 页面升级迁移到 Code Canvas / `YidaCodeCanvas` 链路；仅在目标组织支持 Canvas 时执行 |
| | 加载子技能 `yida-nav-shell` | 自定义页**隐藏应用导航**（`isRenderNav=false`，沉浸/门户/大屏/分享）后，页面内用 JSX 自绘侧边/顶部/浮动/标签导航壳；发布后要配置隐藏原导航，跨页导航项要拼完整 URL 并合并 `isRenderNav=false` / `corpid` / 业务参数（**区别** `yida-nav-group` 平台左侧菜单分组：那是真实导航树，本项是页面内自建导航） |
| | 加载子技能 `yida-publish-page` | JSX 写完后编译并发布；已有页面 URL/formUuid 时直接发布到该目标，不创建新页面 |
| | 加载子技能 `yida-openyida-publish-guard` | 发布已有自定义页面前检查线上设计器状态，避免本地旧源码覆盖用户在线改动 |
| | 加载子技能 `yida-table-form` | Excel 式表格批量录入提交 |
| | 加载子技能 `yida-ppt-slider` | 全屏幻灯片页面（分享/路演/培训/演示） |
| | `openyida aggregate-table` `CLI` | 聚合表 / 虚拟视图（virtualView）：`list` 列出 · `create-empty` 建空白（返回设计器 URL）· `preview` 预览不保存 · `publish` 发布配置 |
| **数据可视化** | 加载子技能 `yida-report` | 普通报表/统计，开箱即用（原生 16 组件） |
| | 加载子技能 `yida-chart` | 更美观/定制化/数据大屏（ECharts） |
| | 加载子技能 `yida-dashboard` | 完整看板 / 驾驶舱产品化交付 |
| **连接器** | 加载子技能 `yida-connector` | 创建/管理连接器、配鉴权 |
| | 加载子技能 `yida-connector-safe-actions` | 连接器已有，从 API 代码生成执行动作 |
| | 加载子技能 `yida-data-source-connectors` | 用户明确要求通过设计器数据源/连接器调用外部 API 时使用；完整应用 `fast_build` 不默认加载 |
| **数据与公式** | 加载子技能 `yida-data-management` | 增删改查**数据记录**，不动字段结构 |
| | 加载子技能 `yida-get-schema` | **只读**查 Schema / 字段 ID，不改结构 |
| | 加载子技能 `yida-formula` | 配在**字段属性**上的实时计算/默认值/校验 |
| | 加载子技能 `yida-formula-evaluate` | 公式语法与字段引用静态检查 |
| | 加载子技能 `yida-business-rule` | 提交后**跨表**高级函数 INSERT/UPDATE/DELETE |
| **流程与自动化** | 加载子技能 `yida-process-rule` | **改已有**流程节点/分支/字段权限（表单或流程已存在） |
| | 加载子技能 `yida-integration` | 提交后**逻辑编排**（图形化自动化流，推荐） |
| | 加载子技能 `yida-agent-center` | 流程代理（在职/离职代理人） |
| | `openyida ai-form-setting` `CLI` | 流程表单 AI 审批提示：`models` 查模型 · `fields` 查可插入字段（TEXT/IMAGE/ATTACHMENT）· `get` 查配置 |
| **权限与访问** | 加载子技能 `yida-corp-manager` | **组织级**权限（平台/子管理员、通讯录，影响整个组织） |
| | 加载子技能 `yida-app-permission` | **单应用级**权限（应用管理员/开发成员） |
| | 加载子技能 `yida-form-permission` | **单表单级**权限（权限组/数据范围） |
| | 加载子技能 `yida-page-config` | **页面级**：公开访问 / 组织内分享 |
| **应用配置与平台** | 加载子技能 `yida-nav-group` | 应用**左侧菜单**分组/排序（真实导航树；页面内自绘导航壳见 `yida-nav-shell`） |
| | 加载子技能 `yida-form-detail` | 只注 **CSS** 美化详情页，不改字段 |
| | 加载子技能 `yida-density` | 列表/表格信息密度选择 |
| | 加载子技能 `yida-i18n` | 应用多语言 / 国际化 |
| | 加载子技能 `yida-basic-info` | 组织版本/容量/域名/额度查询 |
| | 加载子技能 `yida-corp-efficiency` | 企业效能 / 低代码学习成果 |
| **辅助工具** | 加载子技能 `yida-flash-note-to-prd` | 会议纪要/闪记转 PRD |
| | 加载子技能 `yida-export-conversation` | 导出当前对话为 Markdown |
| | 加载子技能 `yida-voc` | 整理故障/需求反馈材料 |
| | 加载子技能 `sls-log-workbench` | SLS 平台问题日志查询 |
| | 加载子技能 `yida-db-seq-fix` | PostgreSQL 主键冲突 / Sequence 修复 |
| | `openyida ai` `CLI` | 调用宜搭 AI 通用能力：文生文（文本生成）/ 识图（图片识别） |
| | `openyida batch` `CLI` | 批量顺序执行多条 OpenYida 命令（读 tasks 文件，支持 `--json --quiet`） |

---

## 核心规则

### 致命规则（FATAL，违反即失败/报错）

1. **技能加载唯一入口**：执行任何子技能前，支持 `use_skill` 的宿主必须调用 `use_skill("<技能名>", "<本阶段目的>")` 加载对应技能；不要用 `Read` / `read_file` / `cat` 读取 SKILL.md 路径，不凭记忆猜参数格式。
2. **corpId 一致性检查**：创建或发布页面前对比 prd/resource context 与 `.cache/cookies.json` 的 corpId，不一致必须询问用户（重新登录到目标组织，或确认在当前组织继续操作已解析资源/缺失资源）。
3. **发布前本地校验**：native `.oyd.jsx` / `.jsx` 页面发布前跑 `openyida check-page` + `openyida compile`；Code Canvas `.canvas.jsx` 不跑这两个 native 检查，改由 `openyida publish` 的 Canvas 编译阶段或 `compileCanvasLocal` 快检校验；JSON 配置写盘后先解析校验，再调用平台命令。
4. **命令输入文件禁止 shell 写入**：当 OpenYida 命令需要 JSON/YAML/CSV/config/script 文件参数时，先使用当前 agent 运行时提供的结构化文件写入工具（如 create_file / Write / file edit tool）创建文件，再把路径传给命令；禁止用 shell heredoc、`cat`/`echo`/`printf`/`tee` 加输出重定向，或把命令 stdout 重定向成业务文件。

### 重要规则（IMPORTANT，影响质量/性能/可维护性）

1. **按阶段加载必要技能**：按意图选 1 个主技能；完整应用按阶段加载当下唯一需要的子技能，禁止并发批量读取多个 `SKILL.md` 或预读未来阶段技能。
2. **Resource-First**：任何 legacy 写操作前先解析本轮显式资源、agent bound context、workspace cache/config、历史上下文；已有目标资源时默认修改/补齐/发布，只有目标缺失且意图允许创建时才加载 create 类技能。
3. **优先复用 direct 映射**：仅对 direct/standalone 资源，已有 `.cache/<项目名>-schema.json` 中可确认新鲜的 `appType`/`formUuid`/`fieldId` 可复用；该文件不是 Schema-as-Code state，也不是远端真相。字段缺失、重名或结构变化时执行 `get-schema --compact --resolve-fields`，不得猜测。
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

> 📖 每条规则的完整说明、PRD 质量门槛、临时文件路径规范、报表美化话术 → [references/development-rules.md](references/development-rules.md)

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 发布提示登录失效 | 先 `openyida login`，再 `openyida publish <源文件> <appType> <formUuid> --health-check` |
| 查已有表单的字段 ID | `openyida get-schema <appType> <formUuid> --compact --resolve-fields "字段名"`，仅使用唯一命中的 `fieldId`（详见 `yida-get-schema`） |
| 更新已有表单字段 | direct/standalone 表单用 `create-form` 的 update 模式：`openyida create-form update <appType> <formUuid> '[{"action":"add","field":{"type":"TextField","label":"新字段"}}]'`（详见 `yida-create-form-page`）；schema-managed 表单走 schema validate → plan → apply |
| 发布提示 corpId 不匹配 | 问用户：确认在当前组织继续操作已解析资源，或 `openyida logout` 后重新登录到正确组织 |

---

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
|------|---------|---------|
| [环境准备与登录检测](references/setup-and-env.md) | 环境依赖、env 解读、多环境登录、悟空降级、Codex handoff、project 初始化 | 环境异常或登录问题时 |
| [核心规则详解](references/development-rules.md) | 成功率清单、PRD 门槛、临时文件、报表美化、corpId | 编写 PRD / 规范执行前 |
| [字段类型 / URL 规则](references/field-and-url-reference.md) | 表单字段类型速查、应用 URL 拼接规则 | 建表单 / 拼访问链接时 |
| [宜搭 API](references/yida-api.md) | 宜搭 API 完整参数 | 调用 API 前 |
| [公式函数库](references/formula-functions.md) | 公式函数速查 | 编写公式前 |
| [官方示例 Schema 范式](references/official-example-schema-patterns.md) | 脱敏 schema 承载范式 | 蒸馏官方示例时 |
| [查询条件构造](references/query-condition-guide.md) | 数据查询条件写法 | 数据查询/筛选时 |
| [报表字段配置](references/report-field-config-guide.md) | 报表字段配置规范 | 配置报表时 |
| [版本功能差异](references/edition-features-guide.md) | 各版本能力差异 | 版本能力查询时 |
| [模型 API](references/model-api.md) | AI 模型接口 | 调用宜搭 AI 模型时 |
