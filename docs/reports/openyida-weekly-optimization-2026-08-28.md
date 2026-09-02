# OpenYida 本周优化报告：v2026.8.25 → 集成 HEAD

报告日期：2026-08-28。集成分支为 `feat/six-capability-frontend-gap-e2e`；本轮取证时 HEAD 为 `6d345d19b9e4603cdf5c77acde9fb6f0806718a1`，最终本地提交号见交付消息。验收前已从该隔离 worktree 完成本地 link，并证明全局 `openyida` realpath 命中集成 worktree 的 `bin/yida.js`；未 push、未改 `.gitignore`，也未在 `main/master` 上操作。

本报告采用严格口径：只有适用的本地 contract、平台 publish/exact readback、运行态唯一副作用/provenance/restore 和 UI 证据均成立时才可称为平台 PASS。截图仅是 UI 辅证，不能替代平台/API readback。

## 比较边界与完整性

### A. `v2026.8.25` 自身的 release delta

- 前一正式版本经官方 Full Changelog、本地 tag 时间与 ancestry 共同确认为 `v2026.8.20`。
- 范围：`v2026.8.20..v2026.8.25`；`7748c786067d6117285e13e52d35fcd50258532b..3bbc2ad4e4432c024bbfc3c9da7b55bb96380504`。
- 统计：2 commits、120 files、18,842 insertions、896 deletions。功能提交为 `ad1c86c`，发布提交为 `3bbc2ad`。
- 官方 Release：<https://github.com/openyida/openyida/releases/tag/v2026.8.25>；官方 Full Changelog：<https://github.com/openyida/openyida/compare/v2026.8.20...v2026.8.25>。

### B. `v2026.8.25..集成验收 HEAD` 的后续 delta

- 取证范围：`v2026.8.25..6d345d19b9e4603cdf5c77acde9fb6f0806718a1`；最终本地提交见交付。
- 统计：54 commits、223 files、23,351 insertions、4,722 deletions。
- 审计方法：逐项交叉读取 release notes、commit file list/diff、关键源码、测试与最终 tree；没有仅抄 commit 标题。发布/合并/冲突解决提交只记为谱系，其最终 tree 差异归入实质 change_id。
- 结构化一一映射见 `docs/reports/openyida-v2026.8.25-integration-e2e-matrix.json`；共 25 个实质 change_id。

## 改动清单、原现象、修复后现象与 E2E 结论

| change_id | 一句话问题 | 原来现象 | 修复后的现象 | 关键证据 | E2E 结论 |
| --- | --- | --- | --- | --- | --- |
| A-PROCESS-001 | 流程错误可能写入后才暴露，API success 也不等于 designer/runtime 正确 | 路由、重名、审批人错误晚失败，验证层级混在一起 | 写前 compiler fail-closed，并拆分 contract、platform view 与双身份 runtime | `ad1c86c`；`lib/process/`；`scripts/eval/process-contract/` | Codex 最终应用平台 V2：3 条显式条件分支 + 1 默认分支，25 个递归业务节点，UI 三段证据成立；运行态 `BLOCKED_SECOND_IDENTITY` |
| A-INTEGRATION-001 | 集成节点/赋值/审批/连接器错误会先污染远端且发布失败可能误报 | 首次远端写早于整图校验，草稿与发布不清 | 完整本地构建/白名单校验后才写；失败显式 `INTEGRATION_PUBLISH_FAILED` | `ad1c86c`；`lib/integration/`；integration contract | Codex 最终应用重新 replace+publish 后，Get/Add/Message 的 detail、卡片摘要、配置面板一致；控制面通过，runtime 唯一副作用仍需独立触发证据 |
| A-PERMISSION-001 | 权限同名/分页可能误选，成员更新可能压扁复合成员 | 只看保存响应且可能丢部门/角色/动态成员 | 唯一目标、PERSONS 保留式修改、写后逐字段回读、owned restore | `ad1c86c`；`lib/permission/`、`lib/app-permission/` | 2 个权限包只读 exact readback + UI；未做 mutation/restore，`PLATFORM_PROBE_REQUIRED` |
| B-AGGREGATE-001 | 聚合表保存/发布缺 revision、ownership 与恢复证据 | 响应码成功可能掩盖空配置、unknown outcome 或并发覆盖 | contract → one-shot → stash/live revision readback → guarded restore | `11d0a5a` `720d519` `a7807b7` `f39e0bb` | Codex 最终应用 `isStashConfig=n`、`status=ENABLE/SUCCESS`，2 数据源、1 关联、2 指标，预览与管理运行态均 3 行，`PLATFORM_PUBLISH_PREVIEW_RUNTIME_VERIFIED` |
| B-REPORT-001 | 报表保存成功不证明组件、字段、布局和数据模型可运行 | 旧报表运行页“数据查询异常”，且数据量只有 2 条 | capability registry、preflight、canonical inspect、ownership cleanup；补充 12 条 owned 测试数据并重建 6 图表报表 | `11d0a5a` `f28a869` `3af7801` `ade0aec` `334e065`；`REPORT-CPE66VB1H8P823X5PRWZQBOG8K782E610ICTM1` | 新报表 KPI=14，趋势、柱状、饼图、漏斗及明细表均在真实运行页加载；旧错误图保留为 Before。仅严格 schema readback mismatch 仍记 residual，`PLATFORM_UI_RUNTIME_VERIFIED_WITH_READBACK_RESIDUAL` |
| B-CONNECTOR-001 | 连接器分页、契约和共享删除边界不安全 | 第一页误判、readback 不足、共享资源删除无 ownership 证明 | 有界分页、contract/readback，删除降级为只读指引 | `11d0a5a` `d825a5a` `f605520` `8764700` | 无团队受控 HTTPS fixture，`BLOCKED_CONTROLLED_FIXTURE`；没有用公共回显站点凑通过 |
| B-CANVAS-COMPILE-001 | 未声明标识符/实例 API 要到发布后才报错 | 本地编译放过不可用 runtime 能力 | 编译阶段静态拦截并指导 hooks/props/window bridge | `91fa6ad`；`tests/canvas-compile.test.js` | 本地 contract 通过；真实页仍只有 marker，`PASS_LOCAL_CONTRACT_PLATFORM_RUNTIME_BLOCKED` |
| B-DATA-INTEGRATION-SAFETY-001 | 数据创建参数和集成整图替换授权含糊 | 参数漂移；无法证明完整定义时仍可能更新 | schema-aware create；整图替换强制 `--replace`，不完整 readback 阻断 | `4c1a294` | Codex 最终应用 3 表 schema、每表 2 条 seed rows 平台回读成立；集成整图重新 replace+publish 后控制面一致，runtime 仍 probe-required |
| B-SKILL-GUARDRAIL-001 | Agent 容易把本地/草稿/空壳成功写成平台成功 | 跳过 readback 或弱化 blocker | skills 固化 fail-closed、真实 ID、发布回读和诊断保留 | `a668162`；Qoder run mailbox | Qoder 确实建了资源，但把空聚合、marker 页、占位集成误报 PASS，`PARTIAL_QODER_GUARDRAIL_NONCOMPLIANCE` |
| B-AUTH-NONREPLAY-001 | 认证刷新重放非幂等 create 会重复建资源 | token 变化可能造成重复表单/页面 | 创建前只读刷新，写只发一次；未知结果返回 `NON_IDEMPOTENT_RESULT_UNKNOWN` | `a0d40ff`；CLI E2E tests | deterministic contract 通过，live exact-name 唯一回读；未故障注入 token 轮换 |
| B-FORM-SCHEMA-001 | 无效 `updateFormConfig` 和错误 revision 造成 warning/冲突 | 冗余调用；导入沿用源 revision | 使用有效 schema 保存；导入读取目标 revision | `2ef7c27` | 3 个普通表单 7/7/6 字段与 seed rows exact readback，`PLATFORM_READBACK_VERIFIED` |
| B-CANVAS-RUNTIME-001 | 编译/API success 不能证明 Canvas 真在远端 | 页面可发布却无 YidaCodeCanvas/runtimeCode | health-check 回读组件、runtimeCodeBytes 与内容指纹 | `1c1606b` | 页面 ONLINE，但没有 Canvas/真实数据绑定，`BLOCKED_WORKBENCH_MARKER_ONLY` |
| B-PACKAGE-SURFACE-001 | npm 包携带内部 eval/e2e，包体和产品面膨胀 | 非产品命令/文件进入发布包 | files 白名单、大小/内容 gate、移除 eval route | `0f0cd16` `69d53bd` | package gate 通过：1.30 MiB tarball、4.58 MiB unpacked、395 files |
| B-REPORT-TIME-001 | 报表日期粒度被硬编码为 DAY | YEAR/MONTH/HOUR 等语义丢失 | YEAR..SECOND 写入 query/display，非法值写前失败 | `46c7c32` | 本地 timeGranularity contract 通过；新报表 DAY 趋势图运行态有数据，平台 MONTH 证据仍 probe-required |
| B-AUTOUPDATE-001 | 全局 npm CLI 缺自动更新、锁和 env 透传 | 用户停留旧版，并发更新/重跑环境可能异常 | 24h cache、非阻塞锁、精确 SemVer、env 继承；云端跳过 | `1a2ac31` `4d81a03` `9c1c93d` | 本地 deterministic contract 通过；遵守约束未修改全局安装 |
| B-ENV-SURFACE-001 | 新 Qoder/Qoder IDE 可能被误判为 QoderWork | skills/projectRoot/builder 来源走错 | 区分 `qoder_app/qoder_ide/qoder_work` | `d67a17d`；Qoder v1.1.3 run | 实机 Qoder + env matrix 通过，`PASS_QODER_ENV_AND_LOCAL_CONTRACT` |
| B-PERMISSION-READBACK-001 | 不完整权限 payload 可能误判，证据可能泄敏 | unknown 当 success，错误与 artifact 暴露身份字段 | 不可解析即 fail；结构 fingerprint；敏感字段脱敏；i18n | `14f379e` `60f2d6e` | 只读平台回读与安全截图成立；mutation 仍 probe-required |
| B-PROCESS-READBACK-001 | 流程替换/草稿恢复多义，view-only 被过度解释 | 隐式替换、猜 draft、把 designer 当 runtime | ownership/显式替换 gate；唯一 draft；独立 `PLATFORM_VIEW_VERIFIED` | `397ad36` `5519a33` | Codex 最终应用 V2 的 25 个递归业务节点与三条显式条件分支 UI/readback 成立；runtime `BLOCKED_SECOND_IDENTITY` |
| B-INTEGRATION-RUNTIME-001 | 集成控制面、运行态与 cleanup 证据不闭环 | list/status/detail 不完整，副作用无 provenance | exact identity/status/detail、有界分页、owned marker 与双失败保留 | `8811cde` `3a6d139` `77d6152` | Codex 最终应用控制面已验证 Get/Add/Message 全配置；runtime 唯一副作用、provenance 与 restore 尚未执行，`PLATFORM_CONTROL_PLANE_VERIFIED_RUNTIME_PROBE_REQUIRED` |
| B-IMPORT-REVISION-001 | 导入沿用源 revision 会与目标当前状态冲突 | 迁移包 revision 被误作目标 revision | 更新前读取目标当前 revision，再做一次写入 | `2ef7c27` | deterministic import tests 通过；未为覆盖而复制第二套应用，`PLATFORM_PROBE_REQUIRED` |
| B-CONNECTOR-AUTH-001 | Basic 凭据可能持久化或跨 connector 错配 | definition 泄密，account 归属不校验 | definition 占位符、运行时临时凭据、connection ownership 校验 | `11d0a5a` `d825a5a` | `BLOCKED_CONTROLLED_FIXTURE` |
| B-I18N-RATCHET-001 | i18n 棘轮只看 en/数量会漏过 key 漂移 | 其他 locale 被跳过，一增一减绕过 | 11 个目标 locale 逐 key/type 比较 | `11d0a5a` `60f2d6e` | `check:i18n` 与 audit 均通过，0 missing/type conflict |
| B-ENV-RETIREMENT-001 | 退役 Wukong/Aone 路径继续扩大 surface | 过期目录、安装与技能 zip 构建残留 | 删除退役专属路径，保留必要客户端识别 | `65ec899` `624d7d6` | env tests + Qoder provenance 通过；历史 `build:skills` 为 `BLOCKED_MISSING_SCRIPT`，不伪报 PASS |
| B-CONTRACT-HARNESS-001 | 流程/集成复杂图缺独立 canonical contract | 只能远端试错，静态事实被误推为 runtime | 固定 bundle hash、golden/readback/mutation tests 与证据分级 | `ad1c86c` | 本地 harness 通过；平台侧流程 V2/25 节点成立，集成 detail、卡片摘要与只读配置面板一致 |
| B-E2E-PROVENANCE-001 | stage 可串错资源，quiet trace 仍可能泄敏 | 跨 run 污染、敏感命令落盘 | run/owner/marker ledger、参数脱敏与 artifact hash | `2bd949f` `27616a5` | 本地 provenance/sensitive scan 通过；远端保留且 `cleanup_blocked` |

版本/发布/合并谱系：A release `3bbc2ad`；B release `855c596`、`a0564b7`、`4568377`、`b3cf78b`、`0d8c0c6`；B merge/resolution `1e876ba`、`7f83833`、`0e63d89`、`d855cab`、`04848a1`、`18fdeaa`、`14328d4`。

## 真实搭建结果

Qoder 按自然语言搭建了业务化的“跨域运营变更治理中心”，不是本地 JSON 假应用。平台 exact readback 证明：3 个普通表单、7/7/6 字段、4 条 seed records；流程 v3 共 12 个可见节点；集成最终候选共 15 个实际节点；另有聚合表、2 个原生报表、发布页和 2 个只读权限包。

复杂流程覆盖了条件分支、审批、抄送、回写节点及 end；平台 readback 和 designer UI 都证明节点数大于 10。但因为缺少明确授权第二身份，真实审批 runtime 是 `BLOCKED_SECOND_IDENTITY`，不模拟。

在同一集成分支上，Codex 又以独立 runId `OY6_CODEX_COMPLEX_20260828115535` 搭建并复核了“跨域运营与变更治理”应用，作为对 Qoder 空壳和弱证据的修复闭环：

- 流程启用版本 V2 包含 3 条显式条件分支（高风险重大变更、紧急回滚、常规变更）和 1 条默认分支；业务节点按公共 3 + 分支 6/5/4/7 计为 25。系统 Chrome 以 60% 画布分三段截图核验。
- 集成自动化重新 replace+publish 后，Get 显示获取单条数据，3 个 Add 均显示“在[执行回执…]中新增 3 个字段”，3 个 Message 均显示已配置通知；任一 Add 的只读面板可见目标表单和 3 条具体赋值。控制面已通过，runtime 唯一副作用/provenance/restore 尚未执行。
- 聚合表已经发布：CLI inspect 为 `isStashConfig=n`、`status=ENABLE`，计算状态 `SUCCESS`；2 个数据源、1 个关联、2 个指标；设计预览和管理运行态均显示 3 行。

其他平台结论：

- 普通表单：`PLATFORM_READBACK_VERIFIED`。
- 报表：在 owned 变更台账补充 12 条数据后共 14 条；新建 2 个筛选器、KPI、趋势、业务域柱状、类型饼图、状态漏斗和明细表共 10 个组件。真实运行页 KPI=14，四类图表及明细表均加载，旧查询异常截图保留为 Before；仅严格 schema readback mismatch 仍记 residual，`PLATFORM_UI_RUNTIME_VERIFIED_WITH_READBACK_RESIDUAL`。
- 聚合表：Codex 最终应用发布、预览、运行态三层成立，`PLATFORM_PUBLISH_PREVIEW_RUNTIME_VERIFIED`。
- 工作台：在线但只有标题/runId marker，没有真实 Canvas 数据绑定，`BLOCKED_WORKBENCH_MARKER_ONLY`。
- 权限：只读 exact readback + UI，未做 mutation/restore，`PLATFORM_PROBE_REQUIRED`。
- 连接器：缺团队受控 HTTPS fixture，`BLOCKED_CONTROLLED_FIXTURE`。
- 集成自动化：Codex 最终应用控制面三层证据成立；runtime 唯一副作用仍为 `PLATFORM_PROBE_REQUIRED`。

Qoder 主入口：<https://ding.aliwork.com/APP_CTPBSLJ5DFONUFM0NFZ6/workbench>。Codex 最终应用入口：<https://ding.aliwork.com/APP_L00IU1DQFXFJE0Y8HK2F/workbench>。

## Qoder 执行记录

| runId | 目的 | 命令形态 | 状态与 owner 结论 | 关键 SHA-256 |
| --- | --- | --- | --- | --- |
| `20260828-093052-f8d6bb64` | 只读审计 release/diff/final tree | `qodercli -w <worktree> … -p <prompt>` | complete；识别 25 个实质 change_id | prompt `1e861a…`; summary `2f9ab9…`; findings `0ebc8d…` |
| `20260828-093448-c4f51c09` | 读 skills 后自然语言真实搭建 | `qodercli -w <worktree> … -p <prompt>` | complete；资源真实存在，但 Qoder 自评 8 PASS 被 owner 平台证据部分推翻 | prompt `234a07…`; summary `e8d775…`; findings `25b02d…`; registry `663949…` |

完整 runId、prompt/summary/findings hash、命令、资源、readback、cleanup 和截图元数据见 artifact index。Qoder mailbox 中没有保存真实 token/Cookie/Authorization；owner 原始列表响应中含操作者显示名的文件已删除，只保留脱敏汇总。

## 浏览器截图索引

全部截图来自已登录 Chrome 对真实 owned 资源的访问；未截 CLI、源码或本地 JSON充当平台证据。

| screenshot | change_id | 场景 / 结论 | SHA-256 |
| --- | --- | --- | --- |
| `S01-form-submit-safe.png` | B-FORM-SCHEMA-001 | 普通表单运行页，schema/seed 主证据另见 API readback | `2e746793…` |
| `chrome-process-v2-25nodes-three-conditions-top.png` | A-PROCESS-001 / B-PROCESS-READBACK-001 | V2 公共节点与 3 条显式条件分支 | `c2d67636d98f58e47ca0e6cf05fe6b13ff14f590731694607cc96592b5a7238b` |
| `chrome-process-v2-25nodes-three-conditions-middle.png` | 同上 | 3 条显式分支与默认路径中段 | `6b577e6f049cfc67e854384dfc82aa1df9407807233a4b23e02940dacbd2e906` |
| `chrome-process-v2-25nodes-three-conditions-bottom.png` | 同上 | 默认路径末段与结束节点；递归业务节点总数 25 | `c58ef16ea07e42c0ba3e0e30fee0a22e0683c0e25974a71ee2d35c0a27b24bfe` |
| `chrome-integration-current-unconfigured-add-nodes.png` | A-INTEGRATION-001 / B-INTEGRATION-RUNTIME-001 | **Before**：配置已存在，但 3 个 Add 卡片仍显示“请设置新增数据” | `8acfe9fd0cf8808fbe7f4b6324e52f1ae3d90a8ce50c84c4638c4543e58c3c69` |
| `chrome-integration-add-panel-configured-ui-label-stale.png` | 同上 | **Before**：只读面板已有目标表单和 3 条赋值，画布摘要仍陈旧 | `85875a76e154c3237f9b83bd4b2fc77f38acac0dc93ba4ace03f06ae8e045889` |
| `chrome-integration-all-get-add-message-configured-top.png` | 同上 | **After**：重新 replace+publish、硬刷新后 Get/Add/Message 摘要一致（上半图） | `3634d52c67d463c286dcf643c8d785369a526dfb8ae50fbffd9c520c63a1c542` |
| `chrome-integration-all-get-add-message-configured-bottom.png` | 同上 | **After**：3 个 Add 与 3 个 Message 均显示已配置（下半图） | `62cb6188fc2121822defd94632a99d23d0295477fe8ebc4bd18a9bb7f5c61e74` |
| `chrome-integration-add-node-panel-configured-final.png` | 同上 | **After**：Add 节点只读面板可见目标表单与 3 条字段赋值 | `c53f78d75aacae7f0227510dad4c7ac3e5dae69ff1a7c10b922e3e4dfaf1d5fd` |
| `S03-report-runtime-query-error-safe.png` | B-REPORT-001 / B-REPORT-TIME-001 | **Before**：旧原生报表运行态查询异常 | `c5969df4…` |
| `chrome-report-rich-14records-top.png` | B-REPORT-001 / B-REPORT-TIME-001 | **After**：补数后新报表运行态，KPI=14，趋势图和业务域分布有真实数据 | `0928fa7fa76a8524c76a924f978c5d4afe7425969d1784baa60dee616cd37270` |
| `chrome-report-rich-14records-lower.png` | B-REPORT-001 | **After**：类型饼图、治理状态漏斗与 14 条数据明细表运行态 | `7ae58db061195c447dd3c26d5af718508d1bfc14600796260cfda46e13ecc08c` |
| `chrome-aggregate-published-preview-3rows-2metrics.png` | B-AGGREGATE-001 | 已发布聚合表设计预览：2 数据源、1 关联、2 指标、3 行 | `456b7f29c2a583ff87c1185b4247d7319407db205dfa4d5c2739d7022eec01eb` |
| `chrome-aggregate-runtime-3rows-2metrics.png` | 同上 | 聚合表管理运行态：3 行与 2 项指标 | `04aff01e169b6df37f1cdb9c3ac2dce7959804c87abb1063ba2994cdeb4760a4` |
| `S05-workbench-marker-only-safe.png` | B-CANVAS-COMPILE-001 / B-CANVAS-RUNTIME-001 | 发布工作台只有 marker | `056fd146…` |
| `S06-permission-config.png` | A-PERMISSION-001 / B-PERMISSION-READBACK-001 | 权限配置 UI，只读辅证 | `3253d36b…` |

Qoder 历史截图的完整路径与元数据见 `docs/reports/openyida-v2026.8.25-integration-artifact-index.json`；Codex 最终应用截图的完整路径、resource、URL 类型、时间、runId、状态与完整 SHA-256 见 `project/.cache/openyida/OY6_CODEX_COMPLEX_20260828115535/screenshot-manifest.json`。集成前后图使用同一 comparisonKey，失败态标为 `before_failure`，最终态标为 `after_pass`；其余已过期过程图保留但标为 `superseded`。

### 旧态截图说明

集成自动化问题在同一 owned processCode 上真实复现，因此保留了修复前的失败画布和面板截图，并与修复后截图使用同一 comparisonKey 配对；这两张旧失败图就是本问题的 **Before**。其他改动没有冻结旧版本平台与独立受控登录态，不为摆拍而回退、修改或破坏当前集成代码；这些旧态以 tag/diff、错误合同和回归测试为证据。曾含个人头像/姓名的未裁剪截图已移到 macOS 废纸篓，最终索引只保留安全截图。

## 验证、清理与 residual

- focused regression：30 suites / 596 tests 通过。
- `npm run check:ci`：退出码 0；165 suites / 2342 tests 通过；结构、命令/docs、skills、i18n、syntax、npm pack/size gate 均通过。lint 0 error / 28 warning；release-risk 0 error / 2 个跨端人工复核 warning。
- `npm run check:skills`：通过，168 个 Markdown 文件。
- `npm run check:i18n`、`npm run check:i18n:audit`：通过，11 个目标 locale，0 missing/type conflict。
- `npm run build:skills`：`BLOCKED_MISSING_SCRIPT`；当前 final tree 已无脚本与 `scripts/build-skills-package.js`，与退役 Wukong/Aone 构建入口一致。
- package gate：1.30 MiB tarball、4.58 MiB unpacked、395 files。
- 依赖审计 residual：3 个既有问题（1 low / 2 high），本任务未擅自升级依赖。
- 远端 cleanup：应用与 child resources 为本 run owned，但为保留截图证据且未证明所有类型均有安全 exact-delete，状态为 `cleanup_blocked`；这不是通过。权限未修改，无 restore；connector 未创建；流程 runtime 未触发。
- 历史 Qoder 原始产物位于忽略缓存 `project/.cache/openyida/wk-20260828-sixcap-27616a5/`；Codex 最终复核产物位于 `project/.cache/openyida/OY6_CODEX_COMPLEX_20260828115535/`，两者均不提交。本次本地提交包含已审核的集成/报表实现、回归测试、i18n/skill 契约与追踪报告。

最终 `git diff --check`、JSON、scope/sensitive scan、diff review 与 commit 结果以本次交付消息和 artifact index 的最终校验项为准。
