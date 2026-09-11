# Permission Safety Optimization

## Goal

在不增加宜搭平台能力的前提下，收紧现有表单权限与页面访问配置的写入边界，并让四类权限技能统一使用可验证的变更流程。

## Done Contract

- 表单权限更新只允许唯一、明确的目标；未知操作键、危险成员替换和不可验证数据结构均在写入前失败且零写入。
- 页面 `/o/` 与 `/s/` 修改保留另一类现有配置，保存后重查并验证实际 URL。
- 回归测试、touched JS 语法检查、相关 Jest、`check:skills` 与 `build:skills` 提供完成证据；最终状态交给用户 review，不 push。

### 阶段 B 真实权限 E2E Done Contract

- 先通过 deterministic target selection 与精确 readback 证明唯一 `FORM_PACKAGE_VIEW` 权限组、可恢复 before 原值和非目标维度指纹，再允许一次 CLI 真实权限变更。
- 变更后按精确 `packageUuid` 重查；只在当前操作权限仍与本轮 mutated 指纹一致时，用当前包作底并仅恢复 `operatePermit`。
- restore 后再次精确 readback：owned 维度必须回到 before，非 owned 维度必须与 restore 前当前值一致；否则 E2E 不得宣称通过。
- 本地 registry/manifest 记录唯一 runId、脱敏目标指纹、样本、资源计数、trace、readback/restore 结果；不打印或提交 profile、UserID、corpId、token、session 原值。

## Scope and Goal Coverage

| 目标 | 最小落点 |
|------|----------|
| 唯一权限组更新 | `lib/permission/save-permission.js`：限制 role 枚举；匹配数不是 1 或查询返回满 20 条时列出名称/UUID 并零写入 |
| 未知操作键保护 | 更新 action-permission 前解析目标组 `operatePermit`；存在白名单外键时拒绝该维度修改，其他维度原样保留 |
| 成员替换安全 | 解析完整 `roleData`；展示 before/after 与会丢失的角色类型；复合角色替换要求显式确认；未修改成员时原样透传 |
| 写前结构校验 | 校验操作集、数据 rule、CUSTOM_DEPARTMENT、FORMULA 和当前可验证的矩阵选择一致性 |
| 页面短链保留和验证 | `lib/page-config/save-share-config.js`：保存前查询，构建同时包含当前 `/o/`、`/s/` 状态的载荷，保存后重查并严格比对目标 URL |
| 应用/平台管理员验证 | `lib/app-permission/app-permission.js`、`lib/corp-manager/`：写前读取 before，写后读取 after；成员或通讯录开关不一致时失败关闭 |
| 权限事实修正 | 四份 `yida-*-permission/page-config` SKILL.md：修正接口模型、角色语义、字段权限、20 条查询边界、`/o/` `/s/` 与 openAuth 能力边界 |
| 统一技能流程 | 四份 SKILL.md 明确“查询 → before/after 差异预览 → 用户确认 → 写入 → 重查验证” |

## State and Data Flow

### 表单权限更新

`CLI 参数 → 静态校验 → 查询 FORM_PACKAGE_VIEW 前 20 个权限组 → 按 DEFAULT/MANAGER/MATRIX 匹配 → 要求恰好 1 个 → 生成 before/after → 危险成员替换确认校验 → 保存完整包 → Agent 重跑 get-permission 并按 packageUuid 验证目标维度`

新增权限组仍固定写入 `FORM_PACKAGE_VIEW`。更新时只修改用户指定的维度，其余服务端字段保持原始序列化值。

### 页面配置更新

`CLI 参数 → 格式校验 → 查询当前 share config → 合并目标 /o/ 或 /s/ 与另一类现有值 → 保存 → 再次查询 → 比对目标 URL 和开关 → 输出 before/after`

### 阶段 B 权限 E2E

`runId/registry 落盘 → 读取冻结的 ownership 规则 → 扫描非 residual 目标 → 唯一权限组 exact readback → 保存 before 原始证据与脱敏 hash → 记录 owned change → CLI 单次 action-permission 变更 → packageUuid exact readback → 证明只变更 owned 维度 → 再读并证明 mutated ownership → 仅恢复 operatePermit → restore exact readback → manifest/registry 收口`

目标选择只使用现有应用/表单，不创建资源；显式排除流程 29 项和集成 6 项 residual 记录的 app/form/process/integration 标识。排除证据不完整或无候选时 fail-closed。

## Failure and Recovery

- role 非法、目标为 0 个或多个：抛出可识别 CLI 错误，列出当前匹配候选名称/UUID，不调用保存接口。
- 查询返回满 20 条：无法证明下一页没有同 role 权限组，列出当前页名称/UUID 并零写入。
- action-permission 目标组包含未知操作键：拒绝 action 维度写入；用户可改为只修改其他维度，未知键保持原样。
- 成员替换会删除复合角色且缺少显式确认：输出会丢失的角色条目并零写入；用户确认后用同一命令加确认参数重试。
- 写前数据或矩阵校验失败：参数错误，零远端写入。
- 保存接口失败：保留查询到的 before 状态并报告失败，不宣称完成。
- 写后重查失败或实际值不匹配：返回验证失败，报告 expected/actual；不自动进行第二次写入。
- 修改 `/s/` 时若当前 `/o/` 的授权配置未随查询返回：无法证明完整保留，保存前失败关闭。
- 阶段 B 在目标唯一性、before 原值、非 owned 指纹或 residual 排除任一无法证明时：不执行真实写入。
- CLI 返回失败或写后验证失败：仍进行一次 readback 判定 owned mutation 是否已落盘；只有指纹精确匹配本轮 mutated 值才恢复。
- restore 前发现 owned 维度被第三方改动：禁止覆盖，标记 `restore_blocked`，保留脱敏证据交给人工处理。
- restore 请求或 restore readback 失败：主流程失败，registry/manifest 保留 owned 维度指纹与失败阶段；不触碰其他 E2E residual。

## Validation

- `tests/save-permission.test.js`：未知/歧义 role 零写入、未知操作键、空操作/数据集、CUSTOM_DEPARTMENT、FORMULA、矩阵一致性、fieldStatus、复合成员保留与替换确认。
- `tests/page-config.test.js`：修改 `/o/` 保留 `/s/`、修改 `/s/` 保留 `/o/` 及公开授权配置、无既有 `/o/` 配置时 `/s/` 成功写入、`isOpen=n` 时非空 URL 仍须通过格式校验、写后 URL 验证失败。
- `tests/app-permission.test.js`、`tests/corp-manager.test.js`：管理员 before/after、写后不一致失败、子管理员 `manageDeptIds`/`manageScene` 集合语义验证、通讯录省略值保留和重查。
- touched JS 执行 `node --check`。
- 运行相关 Jest、`npm run check:skills`、`npm run build:skills`；若引入 i18n key，再运行 `npm run check:i18n`。

## Explicit Non-goals

- 不支持 `FORM_PACKAGE_START`、新操作键、新成员创建参数、`--package-uuid`、权限组删除/复制/重命名、矩阵 CRUD、页面人员/部门白名单或 permission-v2。
- 不新增权限统一框架，不重构无关模块，不依赖远程 bundle 的压缩变量名。
- 不修改 `.gitignore`，不写凭据或运行记忆，不 push。
- 阶段 B 只运行一次最小真实表单操作权限 E2E；不扩展到成员、矩阵、应用管理员、平台管理员、页面短链或权限组 CRUD。
- 不清理、恢复、更名或其他方式触碰流程 29 项、集成 6 项 residual；它们只作为目标排除集的读取证据。

## Restated Understanding

现有接口与枚举已经核实。本次只修复现有 CLI 在整块保存、模糊匹配和短链配置覆盖上的安全问题，并让技能文档准确描述 CLI 当前能做、不能做以及如何验证。

## Checkpoint Summary

- 当前任务理解：收紧现有权限写入，不增加平台功能。
- 当前核心目标：所有目标选择与整块保存风险在写入前可见、可阻止，写入后可回查。
- 当前进度：阶段 A Review 缺口已最小修复；阶段 B 已完成一次真实权限变更、精确回查、owned restore 和独立恢复复查，离线回归与门禁通过。
- 下一步：本地提交后只进行用户独立 review；不再运行真实权限 E2E。
- 风险：平台保存接口可能返回成功但未落目标值；写后查询必须作为独立失败条件。
- 验证方式：窄范围测试、语法检查、技能结构与构建检查。
- Execution Approval: `Approved`（用户已明确要求 Spec 后直接实施）

## Change Log

- 2026-08-24：建立最小 Feature Spec，固定 P0、非目标、失败行为和验证证据。
- 2026-08-24：实现唯一目标、未知键保留、成员替换确认、数据/字段/矩阵校验和页面短链合并/重查。
- 2026-08-24：四份技能统一查询、before/after、确认、写入、重查流程；修正 role/data/fieldStatus、FORM_PACKAGE_VIEW/20 条和 `/o/` `/s/`/openAuth 事实。
- 2026-08-24：应用管理员、平台管理员和通讯录写入增加 before/after 及离线可验证的 readback 检查。
- 2026-08-24 Review checkpoint：`/s/` 无既有 `/o/` 时 readback 误判、`isOpen=n` 非空 URL 绕过校验、sub 范围 readback 不完整；本轮新增 CLI 文案需接入 i18n。核心目标与非目标不变。
- 2026-08-24 Review 修复：`/s/` 验证仅在 before 真实含 `openPageAuthConfig` 时要求保留；非空 URL 在 `isOpen=n` 时仍校验前缀与字符；sub 管理员写后按集合比较部门与场景；本次新增可见文案接入 zh/en `t()`。
- 2026-08-25 阶段 B red：冻结 residual 门禁按 29/6 通过，只读扫描 8 个应用、21 个表单后零候选、零写入。脱敏结构证据显示 `listPermitPackages` 在查询已固定 `FORM_PACKAGE_VIEW` 时不回传 `packageType`；选择器错误要求响应字段存在。最小修复只允许“缺失（继承查询上下文）或精确 `FORM_PACKAGE_VIEW`”，不放宽未知操作键和唯一 role 条件。
- 2026-08-25 阶段 B green：`OY_PERM_20260825023934552_176f1c` 从 21 个合格候选中按脱敏排序选定唯一样本，对 DEFAULT 组的 `operatePermit` 临时新增 `OPERATE_COMMENT`，按精确 `packageUuid` 验证只有 owned 维度改变；恢复前再次证明 mutated ownership，仅恢复 `operatePermit`，恢复后 readback 与独立复查均返回 before 指纹。
- 2026-08-25 阶段 B Review checkpoint：首次提交只在 `finally` 收口 manifest，无法保证异常终止时存在 pre-write checkpoint；同时错误扩展了冻结的 shared cleanup 公共接口。本轮只补 side effect 前 manifest 持久化和 runner 内部最小 ownership 断言，并将 `scripts/e2e-real/cleanup.js` 原样恢复到 main，不再次运行真实权限 E2E。
- 2026-08-25 阶段 B Review 修复：registry 与 manifest 从初始化开始同步持久化；mutation/restore 的 pre-write、write succeeded/readback pending、exact readback 和最终状态均留有 checkpoint。shared cleanup 与 main 完全一致，ownership 证明只存在于 permission runner 内部。

## Validation Results

- 相关 Jest：9 个 suite、129 个 test 全部通过；阶段 B runner 共 9 个用例，新增覆盖 mutate 回调执行前 manifest 已存在且包含目标/样本/资源数/ownership 的 pre-write 状态，以及 runner-owned 元数据无法证明时 restore 零写入；其余覆盖 runId、deterministic residual 排除、缺失 `packageType` 的稳定查询语义、单键变更、exact readback、owned restore、before 漂移零写入和并发 ownership 丢失禁止覆盖。
- touched JS：逐文件 `node --check` 全部通过；`git diff --check` 通过。
- `npm run check:syntax`：使用统一 owner worktree 已安装的同版本依赖运行，355 个 JavaScript 文件全部通过。
- 目标文件 ESLint：`scripts/e2e-real/permission/runner.js`、冻结 `cleanup.js`、runner test 与 `save-permission.js` 零 warning/error。
- `check:structure`、`check:commands`、`check:docs`、`check:release-risks`：均通过；release risk 仅保留仓库既有 2 条跨端提醒，与本变更无关。
- `npm run check:skills`：通过；`npm run build:skills`：通过；构建后再次 `check:skills` 通过。
- `npm run check:i18n`：棘轮校验通过；本次新增权限安全文案已补齐 zh/en，英文 key 无缺失，其余 10 种可选语言按现有“当前语言 → en → zh”链路 fallback，校验器保留 warning 但无新增棘轮失败。
- 真实 E2E registry：`project/.cache/e2e-real/permission/OY_PERM_20260825023934552_176f1c/registry.json`；manifest：同目录 `acceptance-manifest.json`。两者仅含目标 fingerprint、计数与证据路径，原始 before/mutated/restored 证据仅保留在 ignored 本地 artifact。
- 真实 E2E 结果：`created=0`、`mutated=1`、`restored=1`；mutation exact readback、restore exact readback、独立 restore readback 全部通过，owned residual `0`、unrelated residual touched `0`。
- residual/sensitive scan：流程 29 项、集成 6 项计数在运行后未变，11 个流程 registry 源与 1 个集成 registry 在本轮运行期间修改数为 0；manifest/registry 禁止敏感键命中数为 0。
- 核心目标是否由证据证明完成：阶段 A 离线安全性与阶段 B 真实变更/回查/恢复链路均已由证据证明；最终验收仍交给用户独立 Review。

## Resume / Handoff

- 当前状态：`feat/permission-safety-e2e` 已完成阶段 A/B 实现、离线门禁、一次真实权限 E2E 与阶段 B Review 修复；保持本地提交供独立 Review，绝不 push。
- 当前卡点：无实施卡点；最终验收与 diff review 由用户执行。
- 下一步唯一动作：用户独立 review 当前 commit、Feature Spec 与 ignored 本地 E2E manifest。
- 下一轮核心目标：仅在 review 发现偏差时修正；不再重复真实权限变更。

## Project Sync Candidates

- 是否发现可复用项目事实：No。当前稳定事实已由项目 AGENTS.md 和本 Feature Spec 覆盖。
- 同步状态：Skipped。
