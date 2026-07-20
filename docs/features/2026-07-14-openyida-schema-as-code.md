# OpenYida Schema-as-Code 技术方案

## 0. Metadata

| Item | Value |
| --- | --- |
| Status | Approved for progressive implementation |
| Date | 2026-07-14 |
| Owner | OpenYida CLI |
| Current Task | SAC-10 Phase 1 release candidate - Review passed/final; full repository CI passed; release approval pending |
| Scope | OpenYida only |

## 1. Executive Decision

Schema-as-Code 作为 OpenYida CLI 的声明式编排层实现：

```text
业务 Manifest
→ 本地校验和归一化
→ 读取 lastApplied 和最新远端 observed
→ 生成三方差异计划
→ 按依赖顺序执行
→ 回读真实资源和字段 ID
→ 原子更新 state 和 bindings
```

实现采用三层架构和领域 adapter：

```text
现有 CLI adapters
→ 各领域共享 compiler/services
→ lib/schema 通用编排 core + resource adapters
```

不把完整能力继续塞入 `lib/app/create-form.js`，也不把 form 当成唯一 Schema 模型。表单、流程、集成自动化、报表和页面拥有不同远端结构，但共享同一套 validate/plan/apply/state 生命周期。现有命令只做最小重构以调用各领域 shared service，并保持参数、stdout 和错误行为兼容。

## 2. Goals

- 用户和 builder 只维护语义化 Manifest，不手写环境真实 ID。
- `validate` 在本地确定性发现结构、引用和依赖错误。
- `plan` 每次读取最新远端，不产生写操作。
- `apply` 使用最新远端 Schema、乐观并发检查和逐资源 checkpoint。
- semantic key 稳定映射到 `appType/formUuid/fieldId`。
- process、automation、report、page 的语义 key 稳定映射到各自真实资源和节点 ID。
- Manifest、state、observed 使用同一 managed IR 进行三方比较。
- 原有 `create-app/create-form/create-page/get-schema/publish` 输出保持兼容。
- agent 使用紧凑 JSON 协议，不读取完整 Schema stdout。

## 3. Non-Goals

- MVP 不自动删除字段、表单、页面或应用。
- MVP 不实现完整双向 `pull`。
- MVP 不自动按标题 adopt 远端资源。
- MVP 不无损建模所有宜搭高级属性。
- MVP 不建设后台常驻同步进程或跨调用 observed 缓存。
- MVP 不修改 yida-agent core runtime。
- MVP 不依赖子进程调用现有 OpenYida CLI。

## 4. Current Facts

- `get-schema --resolve-fields` v1 已完成并通过 2 个 suite、21 个窄测试。
- 宜搭当前只有全量 Schema 获取能力，没有字段搜索接口。
- `lib/app/create-form.js` 在编译字段时生成 fieldId，但只导出 `run/parseArgs`。
- fieldId 当前包含时间、计数器和随机数，每次重新编译可能不同。
- `create-app/create-page` 当前同样以 CLI `run` 为主要复用面。
- 流程编排会构建 `processJson/viewJson`，保存并发布 process version；`create-process` 当前还通过子进程调用 create-form。
- 集成自动化会构建 logicflow `processJson/viewJson`，保存草稿或发布，并已返回 `specNodeIdMap`。
- 报表会构建独立 report Schema，内部生成 chart fieldId/nodeId，再保存到远端 reportId。
- `package.json` 当前没有 JSON Schema validator 运行时依赖。
- `lib/core/command-manifest.js` 已支持 local_read、remote_read、remote_write 和 mixed 副作用模型。

## 5. Target Architecture

```text
bin/yida.js
├── create-app/create-form/create-page/publish
│   └── legacy CLI adapters
└── schema validate/plan/apply
    └── lib/schema/command.js

lib/app/services/
├── app-service.js
├── form-compiler.js
├── form-service.js
├── form-schema-reader.js
└── field-bindings.js

lib/process/services/
├── process-compiler.js
├── process-service.js
└── process-reader.js

lib/integration/services/
├── automation-compiler.js
├── automation-service.js
└── automation-reader.js

lib/report/services/
├── report-compiler.js
├── report-service.js
└── report-reader.js

lib/schema/
├── command.js
├── manifest-schema-v1.json
├── manifest-loader.js
├── normalize-manifest.js
├── dependency-graph.js
├── resource-adapter.js
├── resource-registry.js
├── contracts.js
├── state-store.js
├── remote-reader.js
├── managed-projector.js
├── planner.js
├── applier.js
├── adapters/
│   ├── app.js
│   ├── form.js
│   ├── process.js
│   ├── automation.js
│   ├── report.js
│   └── page.js
└── errors.js
```

### 5.1 CLI Adapter Layer

- 负责旧参数解析、i18n、终端日志、browser handoff 和旧 stdout。
- 不再独占业务编译和远端资源操作。
- 不允许 Schema 层调用 adapter 的 `run()`。

### 5.2 Shared Service Layer

- 每个领域负责自己的 Schema/JSON 编译、资源创建、保存/发布、远端回读和 bindings 验证。
- 只返回结构化结果，不打印 stdout，不调用 `process.exit()`。
- 现有 CLI 和 Schema applier 共用同一实现。

### 5.3 Schema Orchestration Layer

- 负责 Manifest、managed IR、依赖图、state、plan、apply 和恢复。
- 通过 adapter registry 调度资源，不包含 form/process/report 专用分支。
- 不复制任何领域的组件、节点或图表生成规则。
- 不保存 Cookie、token、header 或原始错误堆栈。

### 5.4 Resource Adapter Contract

通用 core 只依赖以下逻辑接口：

```js
{
  resourceType,
  adapterVersion,
  validateDefinition(definition, context),
  normalizeDesired(definition, context),
  getDependencies(desired, context),
  discoverCandidates(desired, context),
  readObserved(binding, context),
  projectObserved(observed, binding, context),
  create(desired, context),
  resumeCreate(desired, identityCheckpoint, context),
  update(desired, observed, binding, context),
  verify(result, context),
  buildBindings(result, context)
}
```

规则：

- core 统一计算 desired/lastApplied/observed hash、planId、冲突和 checkpoint。
- adapterVersion 必须进入 managed hash 和 planId，防止归一化规则升级后静默复用旧计划。
- adapter 负责领域专用编译与远端投影，但不能直接写 state 或 stdout。
- Registry 只硬性要求 `normalize` 与 `validate`；其他 planner/observed/apply hook 由同名函数是否存在决定，不再维护 boolean capability matrix。
- Registry 仅接受 plain adapter 自身的 data-property function，并保存浅冻结合同快照；继承函数、accessor、unknown callable、legacy capabilities 和注册后方法替换均不能改变 live 合同。
- 普通多写 create 可实现通用 `resumeCreate` 方法：core 在 durable pending intent 之后私有提供一次 `checkpointCreateIdentity`，使用 adapter `buildBindings` + State validator 归一化 identity，并在恢复时只调用配对的 `resumeCreate`。adapter 不取得 journal path，也不能自行写 journal。
- create 返回 identity 与 core checkpoint 之间仍有不可原子的 uncertain 窗口；无 identity 的 pending create 永不自动重发，有 identity 的 pending create 只按 binding exact read/resume，不能再次 create。
- identity checkpoint 前会重新校验真实 apply lock、磁盘 journal、plan/manifest/environment、operation 和 State revision；任一 currentness 校验失败时保留磁盘最新 journal，不用内存旧快照回写覆盖。
- Staged apply 仍为 process 专属：generic journal 只持久化 opaque `stageCheckpoint`，process adapter/service 独占 stage 顺序、process identity、node bindings 与 managed hash 的严格验证和推进；core 仍独占 journal 写入。
- adapter update 必须基于最新 observed，只修改当前领域声明管理的属性。
- 不支持的资源类型在 validate 阶段返回 `UNSUPPORTED_RESOURCE_TYPE`，不能被静默忽略。

## 6. Workspace Model

```text
project/
├── yida/
│   ├── app.yida.json
│   ├── forms/
│   ├── processes/
│   ├── automations/
│   ├── reports/
│   └── pages/
├── pages/src/
└── .cache/openyida/
    ├── state.v1.json
    ├── apply.lock
    ├── apply-operations.v1.json
    └── snapshots/
```

| Path | Ownership | MVP behavior |
| --- | --- | --- |
| `project/yida/**` | 业务源码 | 可审阅、可 diff、可提交 |
| `project/pages/src/**` | 页面源码 | 保持现有行为 |
| `.cache/openyida/state.v1.json` | identity bindings、lastApplied 和 revision | bindings 唯一持久化权威；不作为 observed 缓存 |
| `.cache/openyida/apply-operations.v1.json` | pending/completed/uncertain recovery | 严格 journal，不保存完整 Schema 或凭据 |
| `.cache/openyida/snapshots/**` | 显式诊断材料 | 默认不生成 |

本项目不主动修改 `.gitignore`。State/journal 环境状态不属于业务源码，也不再生成第二份 bindings 持久化副本。

## 7. Manifest v1

本节保留架构约束，不再提供可复制的执行样例。唯一可执行的 Phase 1 Manifest、companion page source、State 路径和 `validate -> plan -> explicit apply` 命令见 [Schema-as-Code Phase 1 Manifest guide](../../yida-skills/references/schema-as-code-phase1.md)。历史草案中的 process definition 文件、automation/report 资源和 README 内嵌 Manifest 均不是当前合同。

Manifest 中禁止出现：

- `appType`
- `formUuid`
- `fieldId`
- Cookie、token、header
- 内部 API path

语义 key 使用稳定 ASCII 标识，v1 建议规则为 `^[A-Za-z][A-Za-z0-9_-]*$`。`.` 和 `/` 保留给内部资源路径组合。

Manifest v1 使用 Ajv draft-07 校验。结构校验后继续执行语义 key、跨资源引用和依赖环检查。

## 8. Managed IR

Manifest 和各领域远端完整 Schema/JSON 不能直接比较。每个 adapter 必须把 desired 和 observed 转换为同构 managed IR：

```json
{
  "resourceType": "form",
  "key": "visitor",
  "title": "访客登记",
  "fields": {
    "visitorName": {
      "type": "TextField",
      "label": "访客姓名",
      "required": true
    }
  }
}
```

规则：

- 只包含 Manifest 明确管理的属性。
- 宜搭自动默认值和未建模属性不进入 managed hash。
- observed 投影必须依赖已确认 bindings，不按重名 label 猜测。
- 更新已有表单时，以最新远端完整 Schema 为基底，只 patch managed 属性。
- 非受管属性必须原样保留。
- managed IR 只要求同一 resourceType/adapterVersion 内可比较，不要求所有领域共享同一个对象结构。
- process 节点、automation 节点和 report chart 同样使用 semantic key 与真实 nodeId/fieldId 分离。

## 9. Resource Compilers and Bindings

共享 compiler API：

```js
compileFormDefinition(definition, {
  existingBindings
})
```

返回：

```json
{
  "schema": {},
  "fieldBindings": {
    "visitorName": "textField_xxx",
    "items.productName": "textField_yyy"
  }
}
```

约束：

- 只有显式 semantic key 才进入持久 bindings。
- 子表字段使用点分 semantic path，Manifest key 本身禁止包含 `.`。
- existing binding 优先于新 ID 分配。
- 新 ID 只在 apply 中分配一次并进入 operation checkpoint。
- 保存后按 fieldId 回读验证，不主要依赖 label。
- 对旧表单显式绑定时可复用 `get-schema --resolve-fields`，missing/ambiguous 不得继续写入。

其他领域遵守同一模式：

| Resource | Stable Keys | Environment Bindings |
| --- | --- | --- |
| process | process key、node key | processCode、processId/version、nodeId |
| automation | automation key、step key | processCode、nodeId、published status |
| report | report key、chart/filter key | reportId、chart fieldId/nodeId |
| page | page key | pageId/formUuid、publish revision |

各 compiler 必须接受 existing bindings，避免重新编译时随机节点 ID 漂移。

## 10. State v1

State v1 的可执行 shape 只由 `state-store` 严格 schema 决定；本 Program 不再复制容易漂移的 JSON。State 保存 app/form/page/process identity bindings、lastApplied managed projection/hash、Manifest hash、environment 和 revision，是 bindings 的唯一持久化权威；恢复 operation 位于独立 apply journal，不存在旧草案的 `pendingOperations` 字段。State 和 journal 都不表示 current observed，每次 plan/apply 必须重新读取远端。

## 11. Freshness and Synchronization

### 11.1 Plan

```text
读取 Manifest
→ 读取 state
→ 全量拉取最新远端
→ 投影 observed managed IR
→ 三方比较
→ 生成 planId
```

### 11.2 Apply

```text
获取 apply lock
→ 重新读取 Manifest/state/remote
→ 重算并确认 planId
→ 每个资源写前再次读取
→ patch 最新远端完整 Schema
→ 保存
→ 立即回读验证
→ 原子更新 state/bindings
```

如果服务端支持 revision/version 条件写，必须使用。若不支持，则通过 just-in-time read、最新 Schema patch 和 post-read verification 缩小竞态窗口，但不承诺推送式实时或严格 exactly-once。

## 12. Three-Way Plan

比较：

```text
desired = 当前 Manifest managed IR
lastApplied = state 中上次成功 managed IR/hash
observed = 当前远端 managed IR
```

| Condition | Result |
| --- | --- |
| observed == lastApplied, desired changed | update |
| observed == desired | noop，并补齐 state |
| desired == lastApplied, observed changed | remote_drift |
| desired 和 observed 都相对 lastApplied 变化且不相等 | conflict |
| Manifest 新资源且无远端同名候选 | create |
| state 缺失且存在同名远端候选 | unbound，要求显式 adopt |
| state 有资源但 Manifest 已删除 | warning，MVP 不删除 |

plan contract：

```json
{
  "kind": "openyida_schema_plan",
  "contractVersion": 1,
  "success": true,
  "planId": "sha256:...",
  "counts": {
    "create": 1,
    "update": 0,
    "noop": 2,
    "conflict": 0,
    "unbound": 0
  },
  "changes": [
    {
      "operation": "create",
      "resourceType": "form",
      "key": "visitor",
      "risk": "low"
    }
  ]
}
```

`planId` 至少包含 contractVersion、environmentKey、normalizedManifestHash、state revision 和每个资源的 observedManagedHash。

## 13. Apply and Recovery

基础 applier 在 SAC-05 先支持 app/forms；后续 adapter 按依赖接入：

```text
确认或创建应用
→ 创建/更新无依赖表单
→ 按拓扑顺序处理有关联的表单
→ 配置并发布流程
→ 配置并发布集成自动化
→ 创建/更新报表
→ 创建并发布页面
→ 生成所有资源 bindings
→ 最终回读确认
```

恢复要求：

- apply 使用独占 lock，防止并发写 state 和远端资源。
- 每个远端操作前写 pending operation intent。
- 需要多写恢复的普通 create 在第一个远端 create 前已有 durable pending intent；远端返回 identity 后，core 在同一 apply lock、plan/environment/State revision/operation identity 校验下最多写一次 identity checkpoint。
- 每个已确认资源完成后立即原子 checkpoint。
- state 写入采用同目录临时文件、file fsync、rename；可用时执行 directory fsync。
- 网络错误结果不确定时返回 `RECONCILIATION_REQUIRED`，不盲目重试创建。
- 已完成且 hash 一致的资源重试时跳过。
- apply 前后均不自动删除。

## 14. CLI Contract

可执行命令只维护在 [canonical Phase 1 guide](../../yida-skills/references/schema-as-code-phase1.md) 和 generated README command table。本 Program 只冻结顺序：本地 validate、`remote_read` plan、用户审阅本次 planId 并显式批准、携带 `--plan-id <reviewed-planId>` 的 `mixed/write` apply。错误 `nextAction`/`ask_human` 不能替代首次写授权，`stale_replanned` 也只返回待重新审阅的 replacement plan。

`pull` 延期。

`--json --quiet` 规则：

- stdout 只允许一个 JSON document。
- 日志和诊断输出到 stderr。
- 不输出完整 Schema。
- 不输出 Cookie、token、header、原始 endpoint 或内部 path。

command-manifest IDs：

| ID | Side Effect | Permission |
| --- | --- | --- |
| `schema.validate` | local_read | allow/read |
| `schema.plan` | remote_read | allow/read |
| `schema.apply` | mixed | allow/write |

## 15. Compatibility Boundary

- 现有 `create-app` 返回值不变。
- 现有 `create-form` 所有模式和 stdout 不变。
- 现有 `create-page` 返回值不变。
- 现有 `get-schema` legacy/compact 返回值不变。
- 现有 `publish` 行为不变。
- shared service 不打印 stdout，不调用 `process.exit()`。
- Schema 层不通过 subprocess 调用 CLI。

## 16. Security Boundary

- OpenYida 是本地 CLI + Skill。同一 UID 下的本地用户与代码属于可信边界；本方案防御误调用、过期、重放、路径逃逸、并发竞态与流程越权，但不声称防御同 UID 恶意代码篡改本地文件或进程。
- state 和 bindings 不保存凭据。
- State `revision` 是 plan/apply 的一致性与并发计数，不是防恶意回滚的独立 authority。
- environment 使用 hash/opaque key，不默认保存明文私有 endpoint。
- 所有输入输出路径限制在 workspace 允许范围。
- 拒绝通过符号链接逃逸状态目录。
- snapshots 只在显式请求时生成并脱敏。
- unknown contractVersion 拒绝读写。
- lock、state 和 bindings 文件尽量限制为当前用户可读写。
- `schema plan` 只通过 command-manifest 的 `remote_read` 权限执行 baseline/observed 读取；`schema apply` 才通过 `mixed`/write 权限进入写前 JIT、save 和 readback。一次 baseline read 授权绝不隐含任何写授权。
- Form/page `saveFormSchema` 已确认并接入 root `gmtModified` 乐观并发校验：token 只从本次 exact JIT read 传到本次 save，stale 响应是确定性零写 `SCHEMA_APPLY_JIT_CONFLICT`。App/process API 仍无同类 CAS 证据；所有资源的写后 readback 仍不是事前 CAS。
- `schema validate/plan/apply` 正常结果不触发错误恢复型 `ask_human`；但任何 create/update 的 plan 完成后必须独立暂停，等待用户对当前 `planId` 的显式批准，才可执行首次 `apply`。失败结果附加紧凑 `action`；只有 reconciliation/uncertain 与 managed conflict/unmanaged 提供 `choices` 并要求 Agent 使用 ask_human（无工具时呈现选项后停止）。`nextAction` 永远不能授予 `mixed/write`。
- 仅可信 `SCHEMA_APPLY_PLAN_STALE` 和 form/page 本次 JIT `gmtModified` 明确拒绝会自动执行一次只读 re-plan；新 plan 只供审阅，不自动 apply，也不重试 save/write。

## 17. Progressive Implementation Plan

任务状态只维护在 [Schema-as-Code task index](../../mydocs/specs/openyida-schema-as-code/index.md)，本 Program 不再复制 Ready/Pending 表。当前事实是 app/form/page/process 已接入 generic lifecycle，automation/report 为 Review-verified Phase 2 deferral；SAC-10 已通过主会话 final re-Review，Phase 1 产物仍只是 release candidate，等待独立 full repository CI 和发布审批。

`pull`、自动删除、自动 adopt、后台 watch 和 yida-agent 集成作为后续候选，不进入 SAC-00 至 SAC-10。

### Page convergence target

- Page 最终必须复用通用 `resource adapter -> planner -> applier -> apply-store/state-store` 生命周期，不维护第二套 planner、runtime provider、trust ceremony、provisioning authority 或 State authority。
- 保留 workspace-safe page source loader、native compiler、managed projection、exact-ID reader、save/readback 与最小 recovery；这些能力由最小 page adapter 接入通用 core。
- Page baseline 读取只属于 `schema plan` 的 `remote_read` 权限；page save/readback 只属于 `schema apply` 的 `mixed`/write 权限，两者材料与执行入口不得互相推导授权。
- Page V1 已以最小 native/default display adapter 接入默认 registry：Manifest 只管理 `title/source/dependsOn`，managed IR 只含 `title/formType/profile/sourceHash/compiledHash`；title update、delete、adopt、config 与 Canvas/dashboard 继续拒绝或延期。
- Historical SAC-09D-M/R second-control-plane runtime 已删除；live page path 只保留 generic adapter 所需的 source loader、native compiler、managed foundation、exact read/save/readback 与纯 data-source builder。Generic apply journal 不再接受 historical `pageRecovery` payload。
- Page config 继续延期，直到存在独立、可验证的 readback 证据；不得用 write acknowledgement 声称可检测远端 config drift。

## 18. Program Acceptance

- 同一 Manifest 在同一环境重复 apply 得到 noop。
- 同一 Manifest 可在不同环境生成不同真实 ID bindings。
- Phase 1 的 app/form/process/page 通过同一 core 生命周期和独立 adapter 执行；automation/report 明确延期到 Phase 2。
- 人工修改受管属性后 plan 返回 drift/conflict，不静默覆盖。
- 人工修改非受管属性后 apply 基于最新远端 Schema 保留该属性。
- apply 中断后可以跳过已确认完成资源；结果不确定时停止 reconciliation。
- legacy CLI contract fixtures 保持通过。
- agent 主链路不读取完整 Schema stdout。
- state/bindings 不包含凭据和内部路径。
- 正常结果不触发错误恢复型 ask_human；create/update 的 plan 后仍须独立暂停并取得当前 planId 的显式 apply 批准。需要人工决策的阻断提供稳定 choices，其他异常提供确定性 nextAction；这些 action 永远不授予 mixed/write。
- stale 自动恢复最多生成一次新 plan，绝不隐式 apply 或重试写入。

## 19. Change Log

| Date | Change |
| --- | --- |
| 2026-07-14 | 在完成 field-resolution v1 后重写为可执行 Program Spec，冻结 shared-service、managed IR、state、plan/apply 和渐进任务边界 |
| 2026-07-14 | 将架构从 form-centric 调整为通用 orchestration core + form/process/automation/report/page resource adapters |
| 2026-07-19 | 冻结资源无关的 resumable-create identity checkpoint：不放宽 process-only stagedApply，不在 applier 添加 page 分支；最小 page adapter 复用 generic journal/State 生命周期 |
| 2026-07-19 | 实现最小 native/default display page adapter：默认 registry、Manifest/State/bindings、plan/apply、generic create identity resume、JIT managed patch 与 exact readback 均完成离线验证；config/delete/adopt/title update 仍不开放 |
| 2026-07-19 | 最小 page adapter Review 通过后删除 historical practical/trust/provenance/ceremony/provider/page-specific recovery 第二控制面；`apply-store` 收回为 ordinary operation + `createIdentity` + process-only staged payload，legacy page CLI 保持不变 |
| 2026-07-19 | Dead-code convergence Review 修复：native Schema/data-source 纯构造下沉到 `app/services/native-page-schema-builder.js`，legacy publish 与 page adapter 共用；schema/default-registry 静态图不再加载 publish CLI、项目 config、auth/browser/network 编排 |
| 2026-07-19 | SAC-R05 接入 form/page `gmtModified` server CAS；stale save 确认为确定性零写 conflict。State 成为 bindings 唯一持久化权威，不再生成 `generated/bindings.v1.json` 第二副本 |
| 2026-07-19 | SAC-R05 controlled page update/noop 与真实 stale-CAS probe 通过；app update ack/readback 不一致后以只读证据收口本地 operation，fresh form create 随后在 identity checkpoint 前进入 uncertain，剩余线上矩阵按 no-retry/no-discovery 契约停止 |
| 2026-07-19 | SAC-R05 review fixes 将 form/page/report/import/publish/create-form 的 `saveFormSchema` 收口为 dispatch 后 one-shot；legacy revision 独立于 mutable Schema，resume create stale CAS 保留 pending identity，Skill 身份权威统一为 State；本批零远端且未触碰 identity-less uncertain journal |
| 2026-07-19 | SAC-R06 删除 15 项 boolean capability matrix，optional hooks 改为 method-presence；process checkpoint shape/stages 下沉到 process service，generic core 只持久化 opaque checkpoint；runtime 净删 28 LOC，26 suites / 450 tests 通过，真实远端 I/O 为 0 |
| 2026-07-19 | SAC-R06 re-Review fixes 冻结 own data-property adapter snapshot，严格重算 v1 operationId，把同一 apply-lock generation 贯穿 remote/journal/State 副作用边界，并要求 draft_created process recovery 具备 operation-bound exact form + SAVED version 正向证据；26 suites / 423 tests 与 19 个 touched JS check/ESLint 通过，真实远端 I/O 为 0 |
| 2026-07-19 | SAC-R06 third-Review fixes 将 apply-lock guard 下沉到 app/form/page/process 每个真实 HTTP primitive；Schema apply 写全部走 one-shot transport，legacy 认证行为不变；process draft recovery 增加当前 exact form-process binding 校验。26 suites / 453 tests 与 19 个 touched JS check/ESLint 通过，真实远端 I/O 为 0 |
| 2026-07-19 | SAC-R06 final-Review fixes 将当前 exact form-process binding 校验扩展到 saved -> publish，重绑/解绑在 definition/version/publish 前 fail-closed；apply 主错误优先于随后 lock release failure，post-dispatch 失锁继续返回 reconciliation required。19 suites / 356 tests 与 5 个 touched JS check/ESLint 通过，真实远端 I/O 为 0 |
| 2026-07-19 | SAC-R06 main-session final Review 通过，无 P0-P2 finding；identity-less form uncertain canary journal 继续隔离，未读取、未改写、未清理、未重试 |
| 2026-07-19 | SAC-R01 增加 command-local 安全 action 与一次只读 re-plan；active Skills 仅在 `nextAction=ask_human` 时询问，State 继续是唯一 bindings 权威。离线 27 suites / 422 tests、123 Markdown skill check、132-file build 和 5 个 touched JS check/ESLint 通过，等待 main-session Review |
| 2026-07-19 | SAC-R01 re-Review fixes 覆盖 automatic re-plan failure 的单次、安全嵌套投影、单行 JSON 与 exit=1；补 branded page 正例、unbranded form/page 反例，并将直接写 Skills 的 stale 文案收口为 replacement-plan review only。CodeMap 的 removed SAC-09D-N 控制面净压缩 130 行；27 suites / 432 tests 与 6 个 touched JS check/ESLint 通过 |
| 2026-07-19 | SAC-R01 main-session final re-Review 通过，无 P0-P2 finding；保留 27 suites / 432 tests、123 Markdown、132-file build、6 JS check/ESLint、remote=0 与 identity-less uncertain form canary 隔离事实 |
| 2026-07-19 | SAC-10 Phase 1 发布前审计：纠正 SAC-05/06 状态漂移，确认 SAC-07/08 为真实 Phase 2 延期而非一期依赖；CLI/README/Skill 静态门禁通过，但 npm dry-run 为约 4.95 MiB/392 files，超过 4.50 MiB/350 files 门禁，且 source E2E 尚缺 page、仍把 process 当 unsupported。SAC-10 只规划 builder handoff、canonical Manifest、E2E/route/package 收尾，等待 plan Review |
| 2026-07-19 | SAC-10 plan Review fixes：npm package 改为逐项 runtime/copy/Skill allowlist 与开发期 denylist，并要求真实 tarball 先解包审计且随后隔离临时安装 consumer smoke；page-config/delete/pull 只做 deferred Skill routing 断言；本批最多形成 focused-offline release candidate，full CI 与 publish approval 是独立后置门禁 |
| 2026-07-19 | SAC-10 final plan P1：同一次 `npm pack` 生成的同一 `.tgz` 必须先完成解包内容/size/count 审计，再从仓库外使用独立 HOME/npm cache/cwd 临时安装并运行 installed-bin smoke；两步均为强制且互不替代 |
| 2026-07-19 | SAC-10 Phase 1 实施完成：新增唯一 canonical Manifest guide 与薄 Skill/README handoff；source runner 走通 app/form/page/process create/update/noop，report/automation stable unsupported；同一真实 tgz 完成解包审计和隔离 `--offline` 安装 smoke。包体为 1.19 MiB compressed、4.40 MiB unpacked、350 files，状态为 release candidate，仍需 main-session final Review、独立 full CI 和发布审批 |
| 2026-07-19 | SAC-10 final Review fixes：首次 apply 必须独立审阅当前 planId 并显式批准，错误 action 不授予写权限；source runner 改为 exact DB/State/journal/process lifecycle 证据并阻断所有网络 primitive；同一 tgz consumer smoke 使用最小环境、显式网络阻断、有效缓存副本、installed-wrapper 与 Skill sentinel hash 校验。状态继续为 release candidate，等待 final re-Review |
| 2026-07-19 | SAC-10 second final re-Review fixes：正常结果只是不触发错误恢复型 ask_human，create/update plan 后仍独立等待当前 planId 批准；routing 证据降为静态 fixture/text contract；source preload 增加 sentinel-verified Socket/dgram/http2/WebSocket/DNS/child-process gate，processJson/checkpoint/field identity 证据收紧；package smoke 执行 Windows `.cmd` 并验证完整 Skill-tree hash 与凭据文件 deny。runtime/core 未改 |
| 2026-07-20 | SAC-10 Phase 1 main-session final re-Review 通过，无 P0-P2 live finding；状态为 Review passed/final，但交付物最多是 release candidate，仍需独立 full repository CI 与发布审批；真实 canary 仍需全新授权，identity-less uncertain form operation 继续隔离 |

## 20. Resume

- Current: SAC-R01 与 SAC-10 均为 Review passed/final；SAC-10 Phase 1 focused implementation 已形成 release candidate。controlled page canary facts retained；identity-less uncertain form create journal 未读取、未写入、未重试、未按标题发现、未 adopt、未 cleanup。
- Next: 独立 full repository CI，随后是显式发布审批。任何真实 canary 需要全新独立授权；不得隐式进入 SAC-07/08、Phase 2 或线上 canary。
- Constraints: legacy stdout 不变；core 不包含领域专用分支；不修改 yida-agent；不自动删除；不使用 observed 缓存。
- Validation: SAC-10 core synthetic 10 suites / 225 tests、local-real/legacy 11 suites / 183 tests、release fixture 4 suites / 29 tests passed；其中 source runner 1 suite / 7 tests、package smoke 1 suite / 2 tests。124 Markdown skill check、133-file temp Skill build、94 command manifest、README generated docs 与 JS check/ESLint 通过。同一 tgz 为约 1.20 MiB compressed、4.40 MiB unpacked、350 files，并通过显式网络阻断下的解包审计与隔离 offline 安装。login/production/remote/canary I/O = 0；SAC-R06/R01 证据保持，identity-less uncertain journal 未读取、未写入、未重试、未按标题发现、未 adopt、未 cleanup。
