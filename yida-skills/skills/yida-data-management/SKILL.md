---
name: yida-data-management
description: 查询和维护宜搭表单、流程、任务和子表数据；data seed form/process 批量写入示例、转换日期、核验并返回实例 ID；支持流程当前审批人统计、任务转交和普通记录删除。
---

# 数据管理


仅调整数据管理页外观、换风格或突出操作时，转 `use_skill("yida-data-manage-ui")`，不执行本技能的数据写入。
## CLI 查询隐藏字段

- 启用 CLI 隐藏字段过滤时，查询结果不返回表单配置或当前账号字段权限中隐藏的字段，字段 key 可能直接缺失；这属于正常行为，不代表原数据为空或写入失败。
- 如果全部字段都隐藏，实例的字段数据可能为空；隐藏子表的查询也可能返回空数据。写后验收必须确认返回了目标实例 ID，并核对本次写入的可见字段；没有可见字段时，记录“实例已确认，隐藏字段无法通过 CLI 回读”。查询未命中目标实例或接口报错仍需排查，不能当作隐藏字段过滤后验收通过。
- 后续更新只提交本次明确修改的字段；不要把查询中缺失的隐藏字段自动补成 `null` 或空字符串。

## 创建/录入数据强制闭环

涉及新增记录、生成测试数据、批量导入或发起流程时，必须连续完成下面 5 步；任一步断开都不算完成。

1. **预检目标**：确认 appType、名称、formUuid/formType，复用创建回执的真实字段映射；缺少映射时一次读取 `get-schema --field-map-json`。seed 内部核对实时目标和 Schema。
2. **准备输入**：结构化写入 `.cache/openyida/<任务名>/data-import/records.json`，示例用 1–30 条对象数组。单条新增或修改使用 `data create/update ... --data-file <单条对象>`。
3. **按类型执行**：示例使用 `data seed form|process --expect-form-name`，process 另传真实 `--process-code`。其余写操作提供 `--expect-form-name/--expect-form-type`，按实际目标类型执行。
4. **核验回执**：seed 串行写入并逐条回读；读取 completed、readbackVerified、requestedFieldsVerified 和实例 ID。其他写操作按返回 ID 定向 get/query 抽查可见字段，隐藏字段按上节记录核验范围。
5. **交接页面**：将真实字段、已核验 ID 和结果交给页面阶段，核对实际展示；额外查询用于业务验收或未知结果核实，已返回 ID 直接复用。

## 完整应用默认 seed records

`yida-app` 为核心普通表单准备 1–3 条业务记录；流程示例按已确认范围执行[流程 seed 编排](references/process-seed-workflow.md)。页面读取这些真实记录。

- 单对象 1 条、列表/工作台 2 条、排行或状态分布 3 条，按业务生成合理名称、状态、金额、数量和日期。
- 复用创建字段映射和已配置选项，成员/部门填可确认的真实 ID；文件与复杂字段按下方格式适配。记录数组使用对应 seed，日期转换、串行写入、核验和 ID 汇总由 CLI 完成。
- 用户要求不造数，或对象是配置字典、权限、敏感个人数据、纯附件表，或缺少可安全构造的值时，记录跳过原因，页面显示真实空态。数量、回执与核验结果交给页面阶段。

## 一次写入普通表单示例记录

流程示例使用 `data seed process` 并提供 `--process-code`，返回 `processInstanceIds`；顺序见[流程 seed 编排](references/process-seed-workflow.md)。日期、字段和回执恢复与下方普通 seed 共用规则。

```bash
openyida data seed form <appType> <formUuid> --expect-form-name <真实名称> --records-file <绝对路径>/records.json --timezone +08:00 --json
```

- records.json 顶层是 1–30 条业务对象数组，key 为真实 fieldId；显式加 `--resolve-aliases` 可用已配置别名，显示名称不自动匹配。`form` 已固定普通表单，不需要 `--expect-form-type`，流程表单会拒绝。
- `DateField` 和 `CascadeDateField` 的端点可使用毫秒数字、`YYYY-MM-DD`、`YYYY-MM-DDTHH:mm:ss` 或带 `Z` / `±HH:mm` 的日期时间。没有偏移的日期使用 `--timezone`，默认 `+08:00`，只支持固定 UTC 偏移；区间空端点为 `""`，子表日期递归转换。不要把普通文本里的日期改成数字。原 `data create/update` 仍只接受毫秒日期。
- `--check` 只读取 Schema 并返回转换后的 records，既不写记录也不保存回执；通过不代表已完成真实写入。正常执行返回 completed、formInstIds 或 processInstanceIds、readbackVerified 和 receiptFile。页面继续核对实际展示。
- 输入旁的 `.seed-receipt.json` 记录每条结果；相同输入、目标、身份和 Schema 重跑复用已核验条目，有 ID 的 pending 只回读后继续。未知写入不重试，保留 failedIndex 和 items 中的 ID/候选 ID；先核实已有实例，不删除回执或另换文件绕过。结果未验证不能宣称完成。
- 空子表写作 `[]`。详情省略该字段时，CLI 仅补查该实例的该子表；按接口的明确无行返回核验，权限过滤和未知结构保留待核验状态。已有 ID 继续原回执恢复。
- `.lock` 防止同一输入并发执行。进程崩溃后先确认没有在运行的命令，并核实 pending 记录，再清理遗留锁。未提交字段和动态业务规则不由本命令推断，权限与服务端校验照常生效。

### 组件支持与未适配配置

`create-form` 当前默认创建的 18 种可写业务组件均可使用 seed，包括关联表单、子表、人员、部门、国家、国内地址、附件和图片；平台生成字段沿用平台规则。复杂组件按[字段格式](references/data-format-guide.md)提供值，不因组件复杂而跳过 seed。

地址支持默认国内 `ADDRESS`（`countryMode=default`）。定位、国际地址模式及已有表单中的未知组件，按 CLI 实际返回的 `skippedFields` 或 `UNSUPPORTED_COMPONENT` 处理：

- CLI 依据当前 Schema，自动省略**明确非必填、且无字段校验规则**的不支持字段，包含子表字段；通过 `skippedFields` 返回原 `recordIndex`、路径、真实 fieldId、组件类型和原因，回执也保留该清单。其他字段继续正常写入、核验。不修改原 records-file，不删除受支持类型中的坏值。
- `readbackVerified=true` 只证明实际提交字段；存在省略时 `requestedFieldsVerified=false`。省略表示“不提交”，不是确认平台值为空：默认值、公式和自动流水号仍由平台执行。页面对省略字段使用空态或已回读的实际值，不编造显示值。
- 所有记录只有被省略字段时，返回 `success=true, skipped=true, readbackVerified=false, completed=0`，不创建空记录或回执。说明跳过原因，继续其他搭建步骤；不能把它计为已写入数据，也不要重复调用 seed。混合批次中有无可写字段的记录，或省略后成为空行的子表，先调整业务示例或跳过该表造数，不创建空记录/空明细来凑数量。
- 不支持字段是必填、条件必填或校验信息不明确时，写前返回 `DATA_SEED_PREFLIGHT_FAILED`。正常写入模式只有 `sideEffectState=none`、`details.fallback.allowed=true` 且没有已有写入回执时，才可为**整条记录**按已确认格式使用 `data create form --expect-form-name ... --expect-form-type receipt --data-file <单条对象.json> --json`，然后按返回实例 ID 专项回读核对；不使用仍不支持该类型的 `--verify-write`，不冒充 seed 核验成功，不把一条记录拆成多次 create。`--check` 仅预检，失败也不切换写入命令。无法构造有效必填值时，跳过该表示例数据，继续其他资源并保持页面空态。
- 只要出现 `mutationAccepted=true`、pending/候选 ID、已有回执或未知写入，禁止切换命令重建、另换输入文件或修改回执绕过；按既有回执恢复，仅核验已写入记录。错误中的 `retrySameInput=false` 表示相同输入重试无效，按 `nextStep` 分流。

### 直接消费回执与关联 ID

1. seed 命令保留完整 `--json` 回执，不接 `tail` / `head` / `grep` 截断或筛选。只有 `success=true`、`readbackVerified=true` 且所需条目 `status=verified` 时，才把本批次作为成功结果交给关联表。
2. `recordIndex` 是输入数组的 **0-based 索引**。用 `items[].recordIndex → formInstId` 对应原始业务记录；`formInstIds` 也按输入顺序返回。不要按 ID 排序或按客户名称猜测对应关系，同名记录也不能混用。
3. 先 seed 客户等被关联表，再把已核验回执中的 ID 直接填入跟进、商机、合同等记录的关联字段，每张表一份数组、一次 seed。保留真实 appType、formUuid、formType 和业务标题；关联完整格式见 [关联字段](references/data-format-guide.md#关联表单字段associationformfield)。不生成额外提取 ID 脚本，不为取得本次已返回的 ID 再执行 `data query form`。
4. 工具截断输出时，优先读取本次命令返回的 `receiptFile`，核对目标及条目 verified 状态。跨轮恢复、命令是否成功或文件归属不确定时，原参数重新执行 seed，由 CLI 校验输入/身份/Schema 并复用已核验记录；不要猜测回执路径或使用旧批次的 ID。
5. `--check`、`DATA_SEED_INCOMPLETE`、pending 条目和 candidateIds 不代表成功，不能直接作为关联 ID 使用。先按回执恢复或对账已有实例，依赖这些记录的写入暂停，未知写入不重放。
6. seed 完成实例和逐条字段回读，页面继续核对实际展示与可见字段。业务抽查或对账按已知 ID 定向读取；写入保持串行，独立前置读取最多两路并发，限流按服务端回执降速。

回执关键字段示例：输入依次为远山科技、青禾商贸，即使 ID 字典序与输入不同，也应由 recordIndex 定位。

```json
{
  "success": true,
  "readbackVerified": true,
  "items": [
    {"recordIndex": 0, "status": "verified", "formInstId": "FINST-Z"},
    {"recordIndex": 1, "status": "verified", "formInstId": "FINST-A"}
  ],
  "formInstIds": ["FINST-Z", "FINST-A"]
}
```

青禾商贸使用 `recordIndex=1` 的 `FINST-A`，关联对象为 `{"appType":"<真实应用>","formUuid":"<真实客户表>","formType":"receipt","instanceId":"FINST-A","title":"青禾商贸"}`，放入真实关联字段的数组值中。这里的 ID 仅用于解释回执，实际写入必须使用本轮真实回执。

```bash
openyida data query form <appType> <客户formUuid> --inst-id <回执中的formInstId> --json
```

## 触发条件

查询、录入、导入、更新普通/流程记录，查询个人任务、按审批人统计或管理员转交时使用本技能。字段结构交给 `yida-create-form-page`，外观交给 `yida-data-manage-ui`，页面数据接入交给 `yida-canvas-data-binding`。

## 安全边界

- 使用真实 Schema 字段、已核验实例 ID 和当前目标类型；类型或身份不匹配时核实原目标。
- 配置和导入文件使用结构化写入工具创建到任务目录；shell heredoc、重定向及私有接口不作为替代路径。
- 已有记录先按 ID 确认；单条普通新增/更新使用 `--verify-write --json`。示例数组使用对应 seed，按 readbackVerified 与 requestedFieldsVerified 记录范围。
- 普通更新仅提交当前账号可编辑字段；权限不足反馈“您无更改该数据的权限”。
- 流程实例支持查询、发起、更新及任务操作；`DATA_PROCESS_DELETE_UNSUPPORTED` 表示流程删除能力缺口，保留原实例，不改用脚本或私有 API。

## 完成检查清单

确认目标、真实字段、实际执行回执、已核验数量与实例 ID；seed/create/update 的字段核验和页面展示分别记录。准备文件、登录成功和参数预检属于前置步骤；结果未确认时报告剩余事项，继续按回执恢复。

## 危险操作确认

删除数据记录为不可逆操作，执行前必须：
1. 展示将删除的记录摘要（数量 + 关键字段）
2. 根据宿主是否支持 runtime permission/approval，只选择以下一条确认路径：
   - 宿主支持并会在执行删除命令前触发 runtime permission/approval：直接发起一次受保护的删除命令，由该唯一权限卡完成用户确认；无需且不得预先调用 `ask_human`
   - 宿主不支持 runtime permission/approval：必须先通过 `ask_human` 或等价交互工具获得用户明确确认；只有用户确认后才能执行删除，用户拒绝或未确认时不得执行

<!-- data-delete-contract:start -->
```json
{
  "supportedDeleteCommand": "data delete form",
  "requiredTarget": ["appType", "formUuid", "formInstId", "formName", "formType"],
  "preflightCommand": "data get form",
  "businessConfirmationRequired": true,
  "runtimePermissionPreferred": true,
  "runtimePermissionPreconfirmation": "forbidden",
  "confirmationFallback": "ask_human_or_equivalent",
  "executionFlag": "--confirm",
  "successCondition": "deleted=true && readbackVerified=true",
  "repeatResult": "alreadyAbsent=true && mutationPerformed=false",
  "processDeleteSupported": false,
  "privateApiFallbackAllowed": false
}
```
<!-- data-delete-contract:end -->

---


> 表单与流程是两套独立接口，主键、参数、返回结构都不同，不能混用。

## 命令

`data create/update` 的 `--data-json` 和 `--data-file` 中，日期按业务时区转换为毫秒时间戳，区间按 `[开始,结束]` 提交，空端点使用 `""`。示例见 [日期字段格式](references/data-format-guide.md#日期字段datefield--cascadedatefield)。`--resolve-aliases` 负责字段名解析，日期值由调用方转换。

### 表单实例

```bash
openyida data query form <appType> <formUuid> [--page 1 --size 20] [--search-json '<json>'|--search-file .cache/openyida/<项目名或任务名>/data-import/search.json] [--dynamic-order '{"fieldId":"+"}'] [--resolve-aliases]
openyida data get form <appType> --inst-id <formInstId>
openyida data seed form <appType> <formUuid> --expect-form-name <name> --records-file <绝对路径>/records.json [--timezone +08:00] [--resolve-aliases] [--check] --json
openyida data create form <appType> <formUuid> --expect-form-name <name> --expect-form-type receipt --data-json '<json>' [--resolve-aliases]
openyida data create form <appType> <formUuid> --expect-form-name <name> --expect-form-type receipt --data-file .cache/openyida/<项目名或任务名>/data-import/record.json [--resolve-aliases]
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type receipt --data-json '<json>' [--resolve-aliases]
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type receipt --data-file .cache/openyida/<项目名或任务名>/data-import/patch.json [--resolve-aliases]
openyida data delete form <appType> <formUuid> --inst-id <formInstId> --expect-form-name <name> --expect-form-type receipt --confirm --json
openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId|alias> [--page 1 --size 100] [--resolve-aliases]
```

> `--data-file` / `--search-file` 指向的文件先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；从 workspace 根执行命令时路径加 `project/` 前缀。

当 JSON 使用宜搭组件别名作为 key 时，追加 `--resolve-aliases`，OpenYida 会先读取表单 Schema 中的 `componentAlias.items`，再将别名转换为真实 `fieldId` 后调用数据接口。更新类命令若要解析别名，必须额外传 `--form-uuid <formUuid>`。

使用 `openyida data update form` 更新普通表单，仅提交当前账号可编辑的字段。权限不足时向用户反馈“您无更改该数据的权限”；其他失败根据错误提示处理。

### 子表超过 50 行

当 `searchFormDatas` 或 `getFormDataById` 返回的 `formData.tableField_xxx` 刚好是 50 行时，优先判断为详情接口对子表内嵌数据做了截断，不要直接下结论为"没有更多数据"。

正确处理流程：

1. 先确认主记录的 `formInstId` 和子表真实 `tableFieldId`；如果只有别名，先执行 `openyida get-schema` 或给 `query subform` 追加 `--resolve-aliases`。
2. 使用 `openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <tableFieldId> --page 1 --size 100` 查询子表第一页。
3. 如果返回 `totalCount` 大于 `data.length`，继续按 `currentPage/pageSize` 翻页，或在脚本中复用 `listTableDataByFormInstIdAndTableId` 拉全量。
4. 不要通过 DOM、虚拟滚动列表、页面全局变量抓取子表全量数据；这类方式依赖页面实现，不能作为稳定数据管理方案。

注意：`searchFormDatas.currentPage` 分页的是主表实例列表，不是某条实例里的子表行。把 `currentPage` 改为 2 后返回空，只能说明主表第二页没有记录，不能证明子表不支持分页。

不要把"创建自定义数据源"作为解决宜搭表单/子表 50 行截断的首选方案；只有在确实需要调用 HTTP 连接器、第三方接口或外部系统数据时，才切换到 `yida-data-source-connectors`。

### 流程实例

示例使用 `openyida data seed process <appType> <formUuid> --process-code <processCode> --expect-form-name <name> --records-file <绝对路径>/records.json --json`；该命令真实发起审批，编排见[流程 seed 编排](references/process-seed-workflow.md)。

```bash
openyida data query process <appType> <formUuid> [--instance-status RUNNING] [--search-file .cache/openyida/<项目名或任务名>/data-import/process-search.json] [--resolve-aliases]
openyida data get process <appType> --process-inst-id <processInstanceId>
openyida data create process <appType> <formUuid> --process-code <processCode> --expect-form-name <name> --expect-form-type process --data-json '<json>' [--resolve-aliases]
openyida data create process <appType> <formUuid> --process-code <processCode> --expect-form-name <name> --expect-form-type process --data-file .cache/openyida/<项目名或任务名>/data-import/process-record.json [--resolve-aliases]
openyida data update process <appType> --process-inst-id <processInstanceId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type process --data-json '<json>' [--resolve-aliases]
openyida data update process <appType> --process-inst-id <processInstanceId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type process --data-file .cache/openyida/<项目名或任务名>/data-import/process-patch.json [--resolve-aliases]
openyida data query operation-records <appType> --process-inst-id <processInstanceId>
openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type process --out-result AGREE --remark '同意' [--data-file .cache/openyida/<项目名或任务名>/data-import/task-data.json] [--resolve-aliases]
```

### 按当前审批人查询和统计流程条数

用户要求“某应用、某流程表单中当前审批人为某人的数据有多少条”时，使用：

```bash
openyida data query process <appType> <formUuid> --current-approver <真实userId> --count
# 去掉 --count 返回匹配的实例数据
openyida data query process <appType> <formUuid> --current-approver <真实userId>
# 可叠加业务字段条件；默认每页100条、最多1000页
openyida data query process <appType> <formUuid> --current-approver <真实userId> --count --search-json '<条件数组>' --max-pages 1000
```

- 先确认同一环境、组织、目标应用和流程表单；人员解析为该组织真实 userId，同名时先消歧，不能将姓名直接当作 userId，也不能猜人员 ID。
- 统计口径是当前 `RUNNING` 实例中存在目标人员的 `TODO` 处理记录，每个 `processInstanceId` 只计一次。多人会签、并行任务或同一人有多个任务都不重复计流程条数；`HISTORY`、抄送以及代理人 ID 不用于当前审批人匹配。平台 TODO 也可能包含办理节点，这与“只统计历史同意/拒绝审批动作”不同，需按用户的业务口径说明。
- 不使用 `task-center todo` 或 `data query tasks --type todo` 代替：它们查询的是当前登录人的待办，不能用于代查指定人员。查询目标人员不会切换调用者身份或模拟该人员登录。
- 权限与平台一致：请求由服务端校验当前登录身份及实例可查看权限；CLI 不额外强制应用管理员/数据管理员角色，也不改变数据权限。管理员、数据管理员及普通成员最终能看到哪些记录，以服务端实际授权结果为准；普通用户有实例查看权限时可统计可见范围，不能把此结果称为全应用数量。
- 不强制先调用仅管理员可用的 Schema/管理接口来拦截普通用户。仅需要 `--resolve-aliases` 时才额外读取字段映射，并遵守该接口自身的权限。
- 返回 `count`/`totalCount` 是去重后的匹配数量，`sourceTotalCount` 是筛选前可见的运行中实例总量；`scannedInstanceCount` 和 `pagesFetched` 说明扫描范围。`scope=current_user_visible`、`complete=true` 只表示本次已遍历服务端返回的可见结果，不证明拥有全应用权限，也不是跨请求的事务快照。
- 命令自动从第1页完整扫描，不支持 `--page` 大于1、`--ids-only`、`--task-id`、`--approved-result` 或非 `RUNNING` 状态。`--max-pages` 达到上限、分页重复/总数变化、返回结构不明、身份变化或任一接口鉴权失败都会报错，不把部分结果当作完整计数。
- 返回0条时，只能说明本次可见范围未匹配；若与网页数量不一致，核对环境/组织/账号、appType/formUuid、状态和筛选、原始错误及分页。不得推测“平台API只能查本人提交”或“管理员也无法查看”。

### 任务中心

```bash
openyida data query tasks <appType> --type todo|created|done|cc --normalized [--page 1 --size 20]
```

按用户描述选择待我处理、我创建的、我已处理或抄送我的；`submitted` 兼容为 `created` 别名。我创建的包含普通表单和流程，我已处理不代表流程已完成。筛选条件与候选查询以 `openyida task-center capabilities --json` 为准。自定义内容只需某项任务数据时交接 `yida-canvas-data-binding`，不要求搭建待办中心；业务工单、订单等待处理记录继续使用业务表单查询。

需要过滤时按需读取[个人任务筛选示例](../yida-task-center/references/task-filters.md)，复用所需类型的组合命令与时间条件。

只读数量、流程详情和审批历史可独立使用 `task-center count / inspect`，无需选择自定义页面；返回含义与按需装配见[流程任务能力](../yida-canvas-data-binding/references/workflow-capabilities.md)。

### 流程当前任务与管理员转交

```bash
openyida data query process-tasks <appType> --process-inst-id <processInstanceId> --json
openyida data transfer task <appType> --process-inst-id <processInstanceId> --form-uuid <formUuid> --to-user-id <userId> --expect-form-name <真实表单名称> --expect-form-type process [--remark '用户说明的理由'] [--task-id <taskId>] --json
```

- 这是管理员对已有流程任务的转交；审批同意/拒绝仍使用 `execute task`，配置转交操作权限使用 `yida-process-rule`，流程代理使用 `yida-agent-center`。
- 先查询流程确认实例及表单，再查询 `process-tasks` 展示任务、节点和实际处理人；明确接收人的真实 userId，名称有歧义时不能猜选。不要用“我的待办”代替指定流程的管理员任务查询。
- 用户未说明转交理由时，省略 `--remark`，CLI 固定写“转交”；用户说明了理由时，使用其原话传入 `--remark`。不要自行添加“按用户要求”等理由，也不要为缺少理由追问用户。
- `taskId` 来自任务接口 `content[].id`，CLI 同时输出字符串 `taskId`；禁止使用 `currentActivityInstances[].id`、`taskSequenceId`、`taskGroupId` 或从 URL 猜测任务 ID。
- CLI 会在写前重新查询任务：只有一个运行任务时可省略 `--task-id`，多个任务必须明确指定；任务已结束或不属于目标实例时停止。
- 完成以 `transferred=true && readbackVerified=true` 为准；`ALREADY_ASSIGNED` 表示任务已由接收人处理，本次没有转交写入。接口 `success=true/content=null` 仅代表受理，CLI 还必须回读确认实际处理人。
- 收到 `RESULT_UNKNOWN` / `UNVERIFIED`、提交超时或鉴权异常时，仅按错误 `details.nextStep` 只读回查，禁止自动重放转交。此规则优先于下方通用网络重试策略。

接口、回读规则与错误恢复见 [流程任务查询与管理员转交](references/process-task-transfer.md)。

## 接口与格式

普通记录使用 `/v1/form/`，流程使用 `/v1/process/`；两者的主键和返回结构分别处理。完整命令参数以 `openyida data --help` 为准，API 参考见[共享接口](../../references/yida-api.md)。

## 数据格式

### 查询条件 `searchFieldJson`

传条件数组的 **JSON 字符串**，多个条件按 AND 组合：

```json
[{"key":"textField_xxx","value":"测试","type":"TEXT","operator":"eq","componentName":"TextField"}]
```

日期为空使用 `operator: "is", value: ""`，不为空使用 `operator: "is_not", value: ""`，`type` 为 `DOUBLE`。日期区间用真实字段 ID 加 `.start` / `.end`，按 `DateField` 分别查询端点。业务“任一端已填”、多选未选择、子表无行使用同步维护的计数字段筛选，保留服务端分页。完整格式见[查询条件指南](../../references/query-condition-guide.md)，可复用 `openyida sample yida-data-management empty-query`。

### 保存/更新数据

```json
{"textField_xxx":"文本","numberField_xxx":10,"dateField_xxx":1719705600000,"employeeField_xxx":["userId"]}
```

当 JSON 较长或用于批量导入时，使用结构化文件写入工具写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/<name>.json`。普通表单示例数组使用 `data seed form --records-file`；单条新增、修改或查询使用 `--data-file` 或 `--search-file`。不要为了拼接命令在仓库根目录、系统临时目录或 `.cache/` 顶层生成临时脚本。`openyida data create form/process` 单次只提交一个实例 JSON；不要把实例数组作为一个 `--data-file` 提交。

### 字段格式与空值查询

查询类型、保存格式、日期/空值条件及关联示例统一见[字段格式指南](references/data-format-guide.md)。seed 接收日期字符串并按业务时区转换；直接 create/update 仍按指南提交毫秒数字。关联记录 ID 优先消费已核验 seed 回执，已有记录没有回执时再查询。

## 注意事项

- `pageSize` 一般写 50，最大 100；seed 写入串行执行，请求频率按当前环境的实际限流回执调整
- `searchFieldJson` 和 `dynamicOrder` 必须传字符串
- 需要稳定顺序的分页、比对或配对必须显式传 `--dynamic-order '{"fieldId":"+"}'`（升序）或 `--dynamic-order '{"fieldId":"-"}'`（降序）；未传时不得依赖默认返回顺序
- 字段 ID 通过 `openyida get-schema` 获取，不要手写猜测
- seed 以外的导入/修正任务可用 Python `subprocess` 调用 `openyida data ...`，也可以用 JS 复用 Node 工具；脚本必须由结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/scripts/`，导入数据放在 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/`

## 异常恢复

| 回执或现象 | 下一步 |
| --- | --- |
| 参数或字段不匹配 | 按 details 与真实 Schema 修正，复用当前目标和已确认资源 |
| 查询为空 | 核对环境、身份、目标、筛选和分页；隐藏字段按上方规则记录范围 |
| 子表恰好 50 行 | 按“子表超过 50 行”使用专用分页读取 |
| 401 或认证异常 | 交给 `yida-login` 恢复当前身份 |
| 429 限流 | 降低频率；查询受控重试，写入先核实结果，seed 按回执接续 |
| 查询超时 | 检查网络后受控重试一次 |
| 写入超时、UNKNOWN、UNVERIFIED | 按 nextStep 只读核查已有实例或版本，保留回执，不重放写入 |
| 权限不足 | 保留原数据，说明实际缺少的权限 |
| 其他失败 | 保存结构化错误、阶段与 traceId，报告未完成项；依赖写入等待核实 |

历史普通记录转流程后缺少流程实例 ID 时，CLI 全部流程查询可能在服务端字段过滤阶段失败；保留 traceId 排查该服务端契约，页面已有数据和真实审批实例分别验收。查询条件保持业务原意。
