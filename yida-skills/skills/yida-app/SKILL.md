---
name: yida-app
description: 宜搭完整应用开发编排技能。对普通 OpenYida 应用做完整搭建或补齐时使用；默认走 fast_build，先解析资源上下文，再创建缺失资源、更新主页面并发布输出链接。
---

# yida-app — 完整应用编排契约

本技能只做完整应用流程编排，不承担全局单点任务路由。进入每个阶段前，按根入口的宿主能力适配规则只加载当前阶段唯一需要的子技能；不要预读未来阶段，不要批量加载技能。

## 触发条件

用户要求从零创建、搭建、生成一个完整宜搭应用/系统/平台/管理工具，或已有 app/page 需要补齐成完整业务系统时使用本技能。

用户说“按默认方案”“不要追问”“直接创建”“尽快搭建”等，必须选择 `fast_build`，用合理 MVP 假设直接执行，不展开深度 PRD 讨论。

**默认判定**：完整应用搭建或补齐时，用户表达“默认方案 / 不要追问 / 直接创建 / 尽快搭建”等快速交付信号，就命中 `fast_build`。默认链路：`resolve app → reserve main page → resolve forms → 编写/更新主页面源码 → 发布 → 返回访问链接`。

> 资源边界：本技能是默认完整应用编排。目标不明时先只读确认或询问用户。

## 阶段 0：resolve_resource_context

进入 `fast_build` / `full_demo` / `deep_design` 前，先按根技能的 Resource-First 规则解析本次目标 app/page/form/process：

- 来源优先级：本轮显式 `appType` / `formUuid` / URL → agent bound context → workspace config/cache → 会话历史 → 明确从零创建。
- agent bound context 只是默认候选，不是锁定目标；如果用户本轮明确提到另一个 app/page/form/process，必须重新解析本轮目标，能唯一解析则切换，不能唯一解析才问用户。
- 已有 app 时在该 app 内补齐资源，不加载 `yida-create-app`；只有无 app 且用户意图允许创建时才创建。
- 若已有 app 来自 agent 预创建资源，OpenYida 技能侧只复用该 `appType`，不自动修改应用名称；应用名修正由宿主或 yida-agent 侧负责。
- 已有主页面 URL / `formUuid` / bound page 时，直接写源码并发布到该页面，不加载 `yida-create-page`；已有页面 update path 也必须在本轮源码 Write/Edit 后执行真实 `openyida publish <source> <appType> <displayPageFormUuid>`，只有缺少 display page 且本次意图允许新增页面时才创建。
- 已有表单 context 时，字段诉求走 `yida-create-form-page` 的 update/patch/rule/bind-datasource；只有已有 app 但缺少业务数据表时才 create form。
- 已有流程表单或 `processCode` 时，流程诉求走 `yida-process-rule`；只有没有表单/流程且用户要新建审批表单时才进入 `yida-create-process`。
- 多个同优先级候选、当前轮显式资源冲突或目标不明时才问用户；不要因为 cache 和历史里同时存在资源就默认打断。

### 阶段 0 命令选择（不要猜命令）

- 已有显式 `appType`、应用 URL 或 agent bound `appType` 且能唯一解析时，直接复用该 app；不要调用 `app-list` 做存在性确认。
- 只有用户只给应用名称、存在多个候选、resource context 冲突，或需要诊断目标 app 访问失败时，才运行 `openyida app-list [--size N]`。
- 已知 `appType` 后，查询该应用下表单/页面用 `openyida list-forms <appType> [--keyword <text>]`；选择页面发布目标时只用 `formType=display`。
- 查询表单/页面 Schema、字段 ID 或批量字段摘要用 `openyida get-schema <appType> <formUuid|--all> ...`；简单字段属性更新不要先拉大 schema，直接交给 `create-form update` 的 label-based schema-aware 解析。
- 完整应用页面阶段只有在页面代码、数据查询、流程/公式或多表 dataBinding 确实需要多个 `fieldId` 时，才对每个目标业务表单执行一次 `openyida get-schema <appType> <formUuid> --field-map-json`，读取完整 JSON 并合并到 `.cache/<项目名>-schema.json`；不要对同一表单用 `tail/head/grep` 截断 stdout 后再重复拉取。
- 阶段 0 禁止编造 `list-apps` / `get-app`；也不要把 `--app-type` / `--form-uuid` 当成 `list-forms` 或 `get-schema` 的参数。按目的在 `app-list`、`list-forms`、`get-schema` 三者中选择。

该阶段只决定常规 resource context；不要在本技能里绕过资源前置解析或自动新建同类资源。

## 阶段 1：resolve app

完成最小需求分析后，只确认本轮目标 `appType` 是复用已有资源还是允许创建新应用。若目标 app 来自 agent / 宿主预创建资源，也只复用当前 `appType`；不得因为占位名称、页面标题或业务语义推导触发应用名修改。应用名修正如有需要由宿主或 yida-agent 侧负责。

## 模式

| 模式 | 何时使用 | 目标 |
|------|----------|------|
| `fast_build` | 默认；用户要求不追问/直接创建 | 复用已解析资源，只创建缺失且允许创建的应用/表单/页面，发布并输出访问 URL |
| `full_demo` | 用户明确要演示完整、示例数据、导航整理、可点验收 | 在 `fast_build` 后补导航、示例数据、公开访问或截图 |
| `deep_design` | 用户明确要深度产品设计、视觉方向、多角色、多页面、复杂流程 | 先做详细 PRD/应用体验蓝图/视觉决策，再执行多阶段搭建 |

默认不要把 `full_demo` / `deep_design` 的动作塞进 `fast_build`。不要因为用户说“看板”“系统”“管理”就自动加载视觉决策、数据源、示例数据、导航整理或截图验收。

## 预检

遵循根入口的只读预检结果。若当前会话还没做预检，先按根入口执行一次只读校验；只有登录态可用后，才执行会创建、修改或发布宜搭资源的命令。不要在每个阶段重复跑 env/help/login 探测。

## 路径与文件读取口径

- 页面源码路径按当前 Bash cwd 选择：从仓库根执行时用 `project/pages/src/...`；如果 cwd 已是 `<workspace>/project`，用 `pages/src/...`，不要传 `project/pages/src/...` 导致 `project/project`。
- 读取 PRD、字段 JSON、页面源码或 schema 文件时优先用宿主 Read / Glob / Grep；OpenYida CLI 成功输出已经是操作证据，不要再 Bash `cat`/`ls` 复核。

## 标准执行流

```text
[Step 1] 创建应用 → use_skill("yida-create-app", "创建应用并获取 appType") → openyida create-app
              ↓
[Step 2] 需求分析 → 写入 prd/<项目名>.md
              ↓      fast_build 只记录 MVP 假设、核心表单/页面、完成标准；deep_design 才补应用体验蓝图
              ↓
[Step 3] 创建必要表单 → use_skill("yida-create-form-page", "创建核心表单字段结构")
              ↓      生成表单 schema 前必须先加载该技能；字段配置文件写入 .cache/openyida/<项目名>/
              ↓
[Step 4] 创建自定义页面 → use_skill("yida-create-page", "创建主入口自定义页面") → openyida create-page
              ↓      创建页面前必须做 corpId 一致性检查
              ↓
[Step 5]（按需）配置流程 → use_skill("yida-create-process", "创建带审批流程表单")
              ↓      需求含“审批 / 流程 / 申请 / 审核 / 工单”等关键词时执行
              ↓
[Step 6] 编写自定义页面代码 → 默认 use_skill("yida-canvas-custom-page", "生成 Code Canvas 主页面")
              ↓      先写业务化 page-spec.json，再 openyida generate-page <模板> --theme-profile yida-app-theme --theme-scope page --spec <page-spec.json> --compile
              ↓      字段映射优先来自 create/update 命令输出和 `.cache/<项目名>-schema.json`；同一表单不要重复 get-schema，除非页面/数据链路确实需要 fieldId 且缓存不完整
              ↓      本轮已创建/解析业务表单且页面需要列表/看板/详情数据时，必须在 spec.dataBinding 写 mode=form + 真实 appType/formUuid/fieldId；深度接入再加载 yida-canvas-data-binding
              ↓      明确要求普通自定义页面 JSX/Jsx 组件链路，或强依赖 this.$ / this.utils.yida.* / this.dataSourceMap 等实例桥时选择 yida-custom-page
              ↓
[Step 7] 发布页面 → use_skill("yida-publish-page", "发布主页面") → openyida publish <源文件路径> <appType> <formUuid> [--health-check]
              ↓
[Step 8] 输出访问链接和资源摘要 → 默认完成
```

`full_demo` / `deep_design` 才在 Step 7 后追加导航整理、示例数据、公开访问、截图验收、报表/大屏、数据桥深度接入等动作。

## UI/体验集成点

UI 不是独立替代主流程的步骤，而是按模式插入到页面生成阶段：

| 模式 | UI/体验怎么集成 | 加载策略 |
|------|----------------|----------|
| `fast_build` | 在 Step 6 通过 Code Canvas 场景模板、`yida-app-theme`、基础工作台/看板/列表布局完成；不做长视觉推演 | 默认不加载 `yida-page-uiux` / `yida-app-uiux` / `yida-theme`；页面主色跟随应用主题 token |
| `full_demo` | 在发布后按用户要求补导航、示例数据、截图、公开访问，让页面可演示 | 只加载命中的后置技能，如 `yida-nav-group`、`yida-data-management`、`yida-page-config` |
| `deep_design` | 先做应用体验蓝图和页面视觉方向，再生成页面 | 加载 `yida-app-uiux` 规划角色路径/页面组合/导航分组/门面/壳形态；加载 `yida-page-uiux` 产出页面视觉方向决策块；涉及全局主题时加载 `yida-theme` |

首次生成面向用户的复杂页面，如果用户明确要求“好看 / 去 AI 味 / 高级视觉 / 品牌化 / 多页面体验”，先用 `use_skill("yida-page-uiux", "确定页面视觉方向")` 产出视觉方向决策块，再交给 `yida-canvas-custom-page` 落地。普通 `fast_build` 不因“系统 / 管理 / 看板”这些词自动升级到视觉深设计。

## 页面链路原则

完整应用里的自定义页面默认使用 `yida-canvas-custom-page`：

- Code Canvas 承载现代 React、hooks、图表、工作台、看板、列表、详情、官网、门户壳等面向用户页面。
- 需要真实数据时，先在页面 spec 中显式写入 `dataBinding` / 字段映射；需要系统化数据桥时加载 `yida-canvas-data-binding`。
- 用户明确要求普通自定义页面 JSX/Jsx 组件链路，或页面强依赖普通自定义页实例桥时，选择 `yida-custom-page`：`this.$(fieldId)` 双向绑定、`this.utils.yida.*`、`this.dataSourceMap`、表单提交或流程发起与页面实例深度耦合。
- 普通自定义页面使用 `.oyd.jsx`、`renderJsx()`、`check-page` / `compile`，发布为平台 `Jsx` 组件；Code Canvas 使用 `.canvas.jsx`、`YidaComp`、`openyida generate-page ... --compile` 或 Canvas 本地快检，发布为 `YidaCodeCanvas` 组件。

## 页面源码修改发布闭环

完整应用、补齐应用和已有主页面 update path 都按同一个 doneWhen 判断：

- 只要本轮 Write/Edit/Create 了 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`，阶段 5 的本地源码校验只算“可发布”，不算远端页面完成。
- final 前必须经过 `yida-publish-page`，并看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>` 命令结果；发布的 `<source>` 必须是本轮修改过的页面源码，`<displayPageFormUuid>` 必须是已解析的 display 自定义页面。
- 如果没有 publish 成功证据，只能对用户说明“源码已修改，尚未发布”，不得声称“页面已更新 / 已重新发布 / 已上线”。规则归页面技能，完成证据归 publish guard，不能靠 final 口头补齐。

## Sample 与业务页边界

`openyida sample` 和 `openyida generate-page <模板>` 只能提供可编译骨架、运行时契约和 primitive 结构，不能当成真实业务页面的最终稿。生成应用时必须把用户需求转成业务化 `page-spec.json`，至少覆盖：

- `brandName` / `tagline` / `heroText`：使用当前应用的业务名称、角色和问题域，不沿用模板默认标题。
- `features`：写真实业务对象、模块入口或处理事项，不写“统一入口 / 状态跟进 / 流程闭环”这类通用模板卖点。
- `metrics` / 列表 / 看板 / 详情数据：写贴合场景的指标口径；完整应用或真实交付页不得用前端 seedRows 冒充真实业务记录。本轮已有业务表单时必须写 `dataBinding.mode=form`、真实 `appType/formUuid` 和字段映射；若需要演示数据，先通过表单数据写入链路创建 demo/mock records，再让 Canvas 页面读取这些真实表单记录。没有写入 demo records 且没有真实数据时，页面展示空态、表单入口、刷新/登记按钮，并在 final 明确“未接真实表单数据”。
- `roadmap` 或 `interactionProfile`：写用户动作、筛选、下钻、批量处理、空/载/错状态。
- `visualProfile`：写一个区别于 sample 的视觉方向，例如信息密度、构图节奏、强调色来源、图表/列表/队列母题。
- 官网/品牌页还必须写 `assets` 或明确素材缺口；看板/列表/详情页优先写 `dataBinding`、字段映射或表单链接。

生成后检查命令输出和 `.openyida-page.json` 里的 `domainFidelity.status`：只有 `domain-ready` 才能把 sample 视为“只是骨架”。`sample-reference` 或 `draft-needs-domain-spec` 表示仍有 sample fallback，必须继续补 page spec 或改源码，不能对用户声称已完成业务化页面。

## 模板优先

为避免生成错误代码，优先用 CLI 内置模板和生成器，不要读取不存在的 `skills/*/templates` 路径：

| 技能 | 模板获取命令 | 用途 |
|------|---------|------|
| `yida-canvas-custom-page` | `openyida generate-page official-homepage|data-screen|dashboard-overview|workbench-home|business-list|detail-profile|split-pane-detail|portal-shell-home --spec <page-spec.json> --compile` | Code Canvas 自定义页面场景模板 |
| `yida-custom-page` | `openyida sample yida-custom-page custom-page-template` | 普通自定义页面 JSX/Jsx 组件链路模板 |
| `yida-data-management` | `openyida sample yida-data-management form-field-template` | 表单字段定义和数据插入 |
| `yida-create-app` | `openyida sample yida-create-app ipd-app-template` | 完整应用创建示例 |

页面实现必须二选一：

- **模板路径**：先写业务化 `page-spec.json`，再执行 `openyida generate-page ... --spec <page-spec.json> --compile`。生成后只读取 `.openyida-page.json` / CLI 摘要判断 `domainFidelity` 和 dataBinding 状态；若需要补业务语义或样式，基于生成文件做小范围 Edit/patch。禁止在 `generate-page` 后立即 Read 500+ 行源码再全量 Write 覆盖同一路径。
- **手写路径**：如果已经明确最终页面结构、数据桥和视觉细节，跳过 `generate-page`，直接 Write 最终 `.canvas.jsx`，再做本地快检和 publish。不要先生成模板再把模板完全覆盖。
- **emoji 硬门禁**：表单字段 JSON、页面 spec、`.canvas.jsx` / `.oyd.jsx` 源码、发布 Schema 和产物文件路径都不能包含 emoji。OpenYida 报 emoji 错误时修改字段文案、spec、源码或路径；不要用 `--skip-lint`、重复 create/publish 或全量 rewrite 试图绕过。

选择模板路径时必须：

1. 先从 PRD 提炼当前业务自己的 page spec；
2. 再执行对应的 `openyida generate-page` 命令生成 Code Canvas 骨架；
3. 读取 manifest / CLI 摘要的 `domainFidelity`，若仍是 sample-reference / draft，则补 spec 或小范围改源码；
4. 以模板为基础扩展交互和真实数据；
5. 验证所有参数名称与 CLI 一致。

表单详情页视觉优化不走 `openyida publish`。当用户要求“详情页美化 / formDetail 样式优化”时，改由单点任务加载 `use_skill("yida-form-detail", "优化表单详情页样式")`，通过表单 Schema 注入 Html 组件承载 CSS。

## fast_build 阶段

| 阶段 | 子技能 | 必做动作 | doneWhen |
|------|--------|----------|----------|
| 0. 解析资源上下文 | 无 | 合并本轮显式资源、agent bound context、workspace config/cache、会话历史；本轮显式目标覆盖 bound context；判定 app/page/form/process 的 `source` 和 `allowCreate` | 明确复用、创建缺口或需要 ask_human |
| 1. resolve app | `yida-create-app` 仅在 app 缺失且允许创建时加载；不自动修改应用名称 | 已有 `appType`/应用 URL/bound app 时直接复用；否则创建应用并提取真实 `appType` | 拿到真实目标 `appType`，且不会重复创建同类 app |
| 2. 记录最小需求 | 无 | 写 `prd/<项目名>.md`：只记录 MVP 假设、核心表单/页面、完成标准；写/更新 `.cache/<项目名>-schema.json` 本地 ID 映射；不要写长 PRD | 业务语义和 ID 存储位置明确 |
| 3. reserve main page | `yida-create-page` 仅在主页面缺失且允许创建时加载 | 已有页面 URL / `formUuid` / bound page 时直接作为主页面；若需要首页/工作台/智能助手/门户门面且缺少主页面，先创建空 display page 占位，暂不写最终源码 | 拿到真实主页面 `formUuid`，且不会重复创建页面 |
| 4. resolve forms | `yida-create-form-page` | 已有目标表单时 update/patch/rule/bind-datasource；简单字段属性更新直接用 compact changes 让 CLI 内部按 label 读 schema/定位字段并输出 resolved evidence；缺少支撑 MVP 的核心表单且允许创建时才 create；字段配置文件写入 `.cache/openyida/<项目名>/`；页面/数据/流程/公式确需多字段映射时，对每个目标表单最多一次性获取完整 `--field-map-json` 并合并写回 `.cache/<项目名>-schema.json` | 拿到或确认表单 `formUuid`，并在需要时拿到真实 `fieldId` |
| 5. 编写/更新页面 | 默认 `yida-canvas-custom-page`；明确要求 JSX/Jsx 组件链路或实例桥强依赖时选择 `yida-custom-page` | 生成或修改主页面源码；只实现 MVP 首屏和核心操作。可用已解析表单链接、真实空态、表单入口和轻量指标口径完成主页面；若展示业务列表/看板/详情记录，必须接本轮真实表单 `dataBinding.mode=form`，或先写入 demo records 后再读取；不要加载视觉/密度/报表/数据源等额外技能 | 本地源码通过对应页面技能的基础校验；未执行 publish 时仍是“源码已修改，尚未发布” |
| 6. 发布页面 | `yida-publish-page` | 按页面链路校验后发布到已解析主页面：Canvas `.canvas.jsx` 使用 `openyida publish` 的 Canvas 编译阶段或 `compileCanvasLocal` 快检；普通自定义页面 `.oyd.jsx` / `.jsx` 跑 `check-page` / `compile`；再执行 `openyida publish <source> <appType> <displayPageFormUuid>` 发布主页面 | 发布成功并获得可访问 URL |
| 7. 输出结果 | 无 | 返回应用链接、主页面链接、复用/创建/更新的资源摘要、后续可选项 | 用户拿到 URL |

`fast_build` 不默认执行：`yida-page-uiux`、`yida-app-uiux`、`yida-canvas-data-binding`、`yida-data-source-connectors`、`yida-data-management`、`yida-nav-group`、`yida-dashboard`、导航重排、示例数据、截图验收、公开访问配置、深度 UI 设计、长 PRD、TaskCreate / 继续规划任务，也不默认读取 `references/app-build-contract.md`。

## 关键决策树

### 决策 1：是否需要存储数据？

```text
用户需求
    │
    ├── 纯展示 / 静态内容 → 跳过表单创建，只创建自定义页面
    │
    └── 需要收集 / 存储数据 → 创建核心表单，再生成页面
```

### 决策 2：是否需要审批流程？

```text
表单创建后
    │
    ├── 无审批需求 → 直接进入页面代码生成
    │
    └── 有审批需求 → 加载 yida-create-process 配置流程后再生成页面
```

### 决策 3：是否需要数据可视化报表？

```text
应用功能需求
    │
    ├── 标准统计报表 → 加载 yida-report 创建原生报表
    │
    └── 高级 ECharts 大屏 → 先 yida-report 创建数据源，再 yida-chart 创建可视化页面
```

### 决策 4：corpId 一致性检查（创建页面前必须执行）

```text
读取 prd 文档中的 corpId vs 读取 token session / `openyida login --check-only --json` 中的 corpId
    │
    ├── 一致 → 继续创建页面
    │
    └── 不一致
        │
        ├── 用户选择“重新登录” → openyida logout → 重新登录到正确组织
        └── 用户选择“新建应用” → 回到 Step 1（会更新 prd 配置）
```

### fast_build 页面数据契约

- 默认页面源码不得使用 `this.dataSourceMap.*`，除非本轮已经明确创建并绑定对应设计器数据源。
- 默认页面只走两类可闭环方案：入口型页面（表单入口、资源链接、轻量统计占位）或内置数据 API 页面（`this.utils.yida.searchFormDatas` / `saveFormData` 等查询本轮已创建表单）。
- Canvas 列表/看板/详情页的业务记录不得回退到前端 seedRows 冒充真实数据。`openyida sample` 原样发布可以显示 sample/seed 并标注；完整应用交付页必须优先在 `page-spec.json` 中写 `dataBinding.mode=form`，用本轮真实 `appType/formUuid/fieldId` 读取表单。若用户要求可演示数据，先加载数据写入链路把 demo/mock records 写入表单并抽查，再由 Canvas 读取；没写入记录时展示空态和登记入口。
- 如果页面源码确实需要 `this.dataSourceMap.*`，必须先把模式升级为可选数据源链路：加载 `yida-data-source-connectors`，创建/绑定数据源，并在发布后确认页面 Schema 中存在对应数据源；否则 `fast_build` 未完成。
- 发布输出出现 `No custom page data sources to preserve` 时，只有源码不依赖 `this.dataSourceMap.*` 才能视为正常；若源码依赖 dataSourceMap，必须改源码或补数据源后重新发布。

## full_demo 可选后置

仅当用户要求，或模式明确为 `full_demo` / `deep_design` 时执行：

| 可选项 | 子技能 | doneWhen |
|--------|--------|----------|
| 导航整理 | `yida-nav-group` | 主页面/核心表单顺序符合业务入口 |
| 示例数据 | `yida-data-management` | 写入少量示例记录并 query 抽查成功 |
| 数据桥深度接入 | `yida-canvas-data-binding` 或 `yida-data-source-connectors` | 页面真实数据读写稳定，空态/错误态可恢复 |
| 报表/图表 | `yida-report` 或 `yida-chart` | 报表或图表页面已创建/发布 |
| 公开访问 | `yida-page-config` | 分享配置保存成功 |
| 截图/人工验收 | 按宿主能力 | 截图或用户确认通过 |

## deep_design 附加要求

进入 `deep_design` 时，可以读取 [详细编排参考](references/app-build-contract.md)，并按需加载：

- `yida-app-uiux`：多页面应用体验蓝图、角色路径、页面组合、导航分组、应用门面、壳形态、主题策略。
- `yida-page-uiux`：单点页面视觉方向、去 AI 味、页面类型和模板路由决策。
- `yida-theme`：应用主题色、品牌色、全局换肤和运行态主题 token。
- `yida-density`、`yida-dashboard`、`yida-canvas-data-binding`、`yida-data-source-connectors`：仅在具体需求命中时加载。

不要在 `fast_build` 中默认读取这些参考或技能。

## 完成条件

完整应用的默认完成条件：

1. 主页面发布成功；
2. 输出可访问 URL；
3. 输出真实 `appType`、页面 `formUuid`、核心表单 `formUuid` 摘要，并标明关键资源是复用、创建还是更新；
4. 未继续执行可选后置动作。

若本轮修改过页面源码但没有成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，完整应用仍未达到 doneWhen；只能交付本地源码修改说明和未发布原因，不能宣称远端主页面已更新。

发布成功并拿到访问 URL 后即完成，不要继续 TaskCreate、重复读技能、重复规划后续阶段。

## 错误处理

- 不编造 `appType`、`formUuid`、`fieldId`、`reportId`。
- OpenYida CLI 不要加 `2>/dev/null`；失败时保留 stdout/stderr 诊断。遇到 DENIED 或同一命令重复失败，先换策略、修改输入文件/参数/登录态/组织或重新只读取证，再重试。
- 同一命令失败后，必须改变登录态、组织、参数、输入文件或字段 ID 后才能重试；禁止无修改连续重试。
- corpId 与目标组织不一致时先停下，让用户选择重新登录或在当前组织继续。
- 已有目标 app/page/form/process 时默认复用；只有用户明确要求新建另一个同类资源，或目标缺失且本次意图允许创建时，才加载 create 类子技能。
- 当前轮用户明确指定的资源优先于 agent bound context；例如会话绑定页面 A、用户要求修复页面 B 时，先解析 B，不能唯一解析才问用户，不要默认改 A。
- agent 预创建 app 只作为默认资源；OpenYida 技能侧只复用该 `appType`，不创建新 app，也不自动修改应用名称。
- 多个同优先级资源候选或当前轮显式资源冲突时，先问用户确认目标，不要通过重复创建规避冲突。
- 输入 JSON/YAML/CSV/JSX 等业务文件必须用结构化文件写入工具创建，不用 shell heredoc、`cat`、`echo`、`printf`、`tee` 或重定向。
- 用户要求删除应用时，必须展示应用名称、应用 ID、影响范围，并等待用户明确回复“确认删除”后才可执行。

## 存储约定

- 业务语义：`prd/<项目名>.md`
- 真实 ID：`.cache/<项目名>-schema.json`
- 临时配置/导入数据/脚本：`.cache/openyida/<项目名或任务名>/`
- 从 workspace 根执行命令时路径加 `project/` 前缀；在 OpenYida project 工作目录内执行时使用 `.cache/...`

## URL 规则

| 页面类型 | URL 格式 |
|---------|---------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 自定义页面（隐藏导航） | `{base_url}/{appType}/custom/{formUuid}?isRenderNav=false` |
| 表单详情页 | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}` |
| 表单详情页（编辑模式） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit` |

## 参考

- [详细编排参考](references/app-build-contract.md)：仅 `full_demo` / `deep_design` / 排障时读取；包含 PRD 模板、字段文件示例、URL 规则、典型场景、删除应用确认、故障处理。
- `use_skill("yida-canvas-custom-page", "实现默认 Code Canvas 页面")`：默认页面实现链路。
- `use_skill("yida-custom-page", "实现普通自定义页面 JSX/Jsx 组件链路")`：明确要求 JSX/Jsx 组件链路，或普通自定义页实例桥强依赖时使用。
