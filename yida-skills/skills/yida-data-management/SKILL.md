---
name: yida-data-management
description: 查询、新增、更新宜搭表单和流程数据，按当前审批人查询流程实例或统计条数，精确删除普通表单单条记录，查询指定流程当前任务并执行管理员转交。支持日期为空、日期区间端点、多选数量、子表条件及服务端分页；表单使用 /v1/form/，流程使用 /v1/process/。
---

# 数据管理


仅调整数据管理页外观、换风格或突出操作时，转 `use_skill("yida-data-manage-ui")`，不执行本技能的数据写入。
## CLI 查询隐藏字段

- 启用 CLI 隐藏字段过滤时，查询结果不返回表单配置或当前账号字段权限中隐藏的字段，字段 key 可能直接缺失；这属于正常行为，不代表原数据为空或写入失败。
- 如果全部字段都隐藏，实例的字段数据可能为空；隐藏子表的查询也可能返回空数据。写后验收必须确认返回了目标实例 ID，并核对本次写入的可见字段；没有可见字段时，记录“实例已确认，隐藏字段无法通过 CLI 回读”。查询未命中目标实例或接口报错仍需排查，不能当作隐藏字段过滤后验收通过。
- 后续更新只提交本次明确修改的字段；不要把查询中缺失的隐藏字段自动补成 `null` 或空字符串。

## 创建/录入数据强制闭环

涉及新增记录、生成测试数据、批量导入或发起流程时，必须连续完成下面 5 步；任一步断开都不算完成。

1. **只读预检**：先确认目标 `appType`、资源名称、`formUuid`、`formType`；执行 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实 `fieldId`，必要时先 query 确认资源可读。
2. **类型分流**：普通表单写操作固定传 `--expect-form-name <真实名称> --expect-form-type receipt`；流程写操作固定传 `--expect-form-name <真实名称> --expect-form-type process`。名称、UUID 或类型不一致时必须停止，不能改写成当前上下文里的其他资源。
3. **写入即提交**：小 JSON 可直接用 `--data-json '<json>'`；长 JSON 或批量造数先用结构化文件写入工具创建到 `.cache/openyida/<项目名或任务名>/data-import/<name>.json`，创建后必须立刻调用对应 `openyida data create ... --data-file <path>`。
4. **批量逐条创建**：`openyida data create form/process` 每次只创建一条实例；多条记录按单次不超过 30 条循环/分批逐条调用。不要把多条实例数组塞进一个 `--data-file`，除非该数组是某个子表字段的字段值。
5. **写后验收**：create/update 返回无报错后，必须执行 `openyida data query form|process <appType> <formUuid> ...` 抽查至少 1 条目标记录，核对实例 ID 和本次写入的可见字段值；隐藏字段缺失或全部字段隐藏导致字段数据为空时，按上方“CLI 查询隐藏字段”规则验收。流程记录可再用返回的 `processInstanceId` 执行 `get process` 复核。

## 完整应用默认 seed records

`yida-app` 从零生成完整应用时，表单创建完成后默认加载本技能，为核心业务普通表单写入 1-3 条业务化示例记录，再让自定义页面读取这些真实表单记录。

执行规则：

- 只对本轮新建或页面 `dataBinding.mode=form` 依赖的核心普通表单默认写入；配置字典表、权限表、敏感个人数据表、纯附件表或用户明确说不要造数时跳过，并在 final 说明原因。
- 记录数量默认 1-3 条：单对象轻应用写 1 条；列表/工作台写 2 条；看板/排行/状态分布写 3 条。不要为了展示效果批量灌入大量数据。
- 示例记录必须是当前业务语义，不写“测试1 / demo / mock”；例如客户、订单、学生、商品、工单、活动等对象要有合理名称、状态、金额、数量、负责人或日期。
- 先执行 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实 `fieldId`；保存数据使用真实 fieldId 或 `--resolve-aliases` 可解析别名，禁止猜测字段 ID。
- 单个日期传毫秒时间戳数字，日期范围传时间戳数组；单选/多选必须使用表单已配置选项；成员/部门字段只有可安全确认 userId/deptId 时才填，否则留空或跳过该字段。
- 每条实例单独执行一次 `openyida data create form`；不要把 1-3 条记录作为顶层数组塞进一个 `--data-file`。
- 写完必须 `openyida data query form` 抽查至少 1 条，并把写入数量和抽查结果交给 `yida-app` 页面阶段使用。

## 严格禁止 (NEVER DO)

- 不要混用表单接口和流程接口，两套接口完全独立，参数和返回结构不同
- 不要省略写操作的 `--expect-form-name` / `--expect-form-type`；`create form` 不会自动改为发起流程
- 不要编造 formInstId 或 processInstanceId，必须从查询结果中提取
- 不要用此命令修改表单结构（字段增删改），应使用 `yida-create-form-page`
- **绝对禁止猜测或编造字段 ID（fieldId）**，宜搭字段 ID 由平台随机生成（如 `textField_eftt1aa5m`），无法预测，必须通过 `openyida get-schema` 获取
- 不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成 `--data-file`、`--search-file`、CSV 或一次性脚本
- 不要把顶层 JSON 数组当作 `openyida data create form/process` 的批量实例导入；顶层数组只适用于子表字段值等字段内部结构

## 严格要求 (MUST DO)

- 操作前先用 query 命令确认目标数据存在
- 所有 create/update/delete/execute/transfer 写操作必须携带只读预检确认的资源名称和类型；CLI 校验不一致时停止，不得换目标重试
- 新增记录、生成测试数据、批量导入或发起流程必须遵守上方“创建/录入数据强制闭环”
- 批量操作单次不超过 30 条记录；多条实例必须逐条/分批执行 `openyida data create ...`
- 删除普通表单记录前，必须先执行 `openyida data get form <appType> --inst-id <formInstId> --form-uuid <formUuid> --json`，核对返回实例 ID 与目标表单，并向用户展示记录数量、标题/关键字段和实例 ID。宿主支持并会在执行删除命令前触发 runtime permission/approval 时，直接发起一次带 `--confirm` 的受保护删除命令，由该唯一权限卡完成用户确认；无需且不得预先调用 `ask_human` 或其他业务确认工具。宿主不支持 runtime permission/approval 时，必须先通过 `ask_human` 或等价交互工具获得用户明确确认；只有用户确认后才能执行删除，用户拒绝或未确认时不得执行
- 删除完成只以 `deleted=true && readbackVerified=true` 为准；`alreadyAbsent=true` 表示本次未再次发删除请求，可按幂等成功处理
- 当前不支持删除流程实例；禁止生成 `openyida data delete process`，禁止在 CLI 报不支持后探索一次性脚本、浏览器私有请求或底层 API 绕过正式能力
- **录入/更新数据前，必须先执行 `openyida get-schema` 获取真实字段 ID，并将字段 ID 映射记录到 `.cache/<项目名>-schema.json`**
- **生成测试数据或录入/更新数据时，`DateField` 传毫秒时间戳数字（如 `1719705600000`），`CascadeDateField` 传开始、结束毫秒时间戳数组；半填区间的空端点传 `""`。转换方法见 [日期字段格式](references/data-format-guide.md#日期字段datefield--cascadedatefield)**
- **录入数据后，必须执行 `openyida data query` 抽查至少 1 条目标记录，核对实例 ID 和本次写入的可见字段值；隐藏字段缺失或字段数据为空按“CLI 查询隐藏字段”规则处理，可见字段值不符合预期时再核对字段 ID 和写入参数**
- **读取子表明细超过 50 行时，必须使用 `openyida data query subform` 或 `listTableDataByFormInstIdAndTableId` 分页查询完整子表；不要把 `searchFormDatas.currentPage` 当作子表分页**
- **本技能不读写 memory**：数据操作通过 CLI 命令写入宜搭平台，不依赖跨会话的 memory 状态
- 一次性造数、旧数据修正、字段迁移脚本可以使用 Python 或 JS，优先选择更快更清晰的实现；脚本、导入数据、查询条件文件必须由结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/` 下，并复用真实查询到的 appType/formUuid/fieldId/formInstId
- **禁止在仓库根目录、系统临时目录或 `.cache/` 顶层生成导入用的 `*.json`、`*.js`、`*.py`、`*.csv` 临时文件**；推荐使用 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/` 存放数据文件，`<projectRoot>/.cache/openyida/<项目名或任务名>/scripts/` 存放一次性执行脚本

## 不可停在这些中间态 (NOT DONE)

- 只执行 `mkdir` 或只创建 `.cache/openyida/.../*.json`
- 只写了 `.json`、`.js`、`.py` 或 CSV 脚本/数据文件，但未执行 `openyida data create ...`
- 只跑了 `openyida auth status`、`openyida login --check-only`、`openyida agent-capabilities` 或 `openyida get-schema`
- 只把导入命令交给用户自行运行，自己没有执行并拿到结果
- `openyida data create ...` 报错、无返回，或未对每条实例执行 create
- 未执行 `openyida data query ...` 抽查、未命中目标实例，或本次写入的可见字段值不符合预期；隐藏字段缺失或全部字段隐藏导致字段数据为空不单独作为失败依据

## 完成检查清单

- [ ] 已确认登录态、`appType`、`formUuid`；发起流程时确认 `processCode`，按当前审批人查询/计数不要求额外获取 `processCode` 或管理员专用 Schema
- [ ] 已通过 schema/field map 使用真实 `fieldId`
- [ ] 如使用 `--data-file`，文件位于 `.cache/openyida/<项目名或任务名>/data-import/`，且创建后已立即调用 `openyida data create ... --data-file ...`
- [ ] 每条实例都实际执行了 `openyida data create form/process`，且命令返回无报错
- [ ] 已用 `openyida data query form|process ...` 抽查至少 1 条目标记录，核对实例 ID 和可见字段值；没有可见字段时已说明隐藏字段无法通过 CLI 回读
- [ ] 已向用户报告创建/更新数量、验收命令与结果摘要；未完成项必须如实说明

## 适用场景

用户需要"查询数据"、"新增记录"、"更新数据"、"查看表单实例"、"发起流程"时使用。

**关键区分**：
- 操作表单数据记录（增删改查）→ 本技能
- 修改表单结构（字段增删改）→ `yida-create-form-page`
- 自定义页面调用连接器或外部 API 数据源 → `yida-data-source-connectors`
- 表单接口（`/v1/form/`）vs 流程接口（`/v1/process/`）不能混用

## 触发条件

**正向触发**：
- "查询数据"、"新增记录"、"更新数据"
- "查看表单实例"、"发起流程"
- "录入数据"、"批量导入"、"查询待办任务"
- "查询流程当前任务"、"管理员转交"、"把这条流程转交给某人"
- "按当前审批人统计"、"某人的待审批流程条数"、"查询指定审批人的流程实例"

> ⚠️ 表单接口（`/v1/form/`）和流程接口（`/v1/process/`）不能混用。

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
openyida data create form <appType> <formUuid> --expect-form-name <name> --expect-form-type receipt --data-json '<json>' [--resolve-aliases]
openyida data create form <appType> <formUuid> --expect-form-name <name> --expect-form-type receipt --data-file .cache/openyida/<项目名或任务名>/data-import/record.json [--resolve-aliases]
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type receipt --data-json '<json>' [--resolve-aliases]
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --expect-form-name <name> --expect-form-type receipt --data-file .cache/openyida/<项目名或任务名>/data-import/patch.json [--resolve-aliases]
openyida data delete form <appType> <formUuid> --inst-id <formInstId> --expect-form-name <name> --expect-form-type receipt --confirm --json
openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId|alias> [--page 1 --size 100] [--resolve-aliases]
```

> `--data-file` / `--search-file` 指向的文件先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；从 workspace 根执行命令时路径加 `project/` 前缀。

当 JSON 使用宜搭组件别名作为 key 时，追加 `--resolve-aliases`，OpenYida 会先读取表单 Schema 中的 `componentAlias.items`，再将别名转换为真实 `fieldId` 后调用数据接口。更新类命令若要解析别名，必须额外传 `--form-uuid <formUuid>`。

使用 `openyida data update form` 更新普通表单，仅提交当前账号可编辑的字段。更新被拒绝时，根据错误提示调整提交内容。

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

## 接口总览

### 表单实例

| 接口 | 方法 | 说明 |
|------|------|------|
| `searchFormDatas` | GET | 查询列表 |
| `searchFormDataIds` | GET | 查询 ID 列表 |
| `getFormDataById` | GET | 查询详情 |
| `saveFormData` | POST | 新增 |
| `updateFormData` | POST | 更新 |
| `deleteFormData` | POST | 删除单个普通表单实例；CLI 删除后必须回读不存在 |
| `listTableDataByFormInstIdAndTableId` | GET | 查询子表数据 |

### 流程实例

当前 CLI 仅支持流程实例的查询、发起和更新，不支持删除。不要尝试 `data delete process`；收到
`DATA_PROCESS_DELETE_UNSUPPORTED` 后停止并交付能力缺口，不得改用脚本或私有 API。

| 接口 | 方法 | 说明 |
|------|------|------|
| `startProcessInstance` | POST | 发起流程 |
| `getInstanceIds` | GET | 查询 ID 列表 |
| `getInstances` | GET | 查询列表 |
| `getInstanceById` | GET | 查询详情 |
| `updateInstance` | POST | 更新 |
| `getOperationRecords` | GET | 审批记录 |
| `executeTask` | POST | 执行任务 |
| `getInstTaskDatas` | GET | 管理员查询指定流程任务，使用 query/formProcInstData 路径 |
| `redirectTask` | POST | 管理员转交任务，使用 query/instance 路径，单次提交并回读 |

### 任务中心

| 接口 | 说明 |
|------|------|
| `getTodoTasksInApp` | 待办 |
| `getDoneTasksInApp` | 已完成 |
| `getMySubmitInApp` | 已提交 |
| `getNotifyMeTasksInApp` | 抄送 |

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

当 JSON 较长或用于批量导入时，使用结构化文件写入工具写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/<name>.json`，再使用 `--data-file` 或 `--search-file`；不要为了拼接命令在仓库根目录、系统临时目录或 `.cache/` 顶层生成临时脚本。`openyida data create form/process` 单次只提交一个实例 JSON，多条实例必须逐条/分批调用；不要把实例数组作为一个 `--data-file` 提交。

### 常见字段格式

先用 `get-schema --field-map-json` 获取真实字段 ID 填入 `key`，再按表填写 `componentName`、`type`、`value` 和括号中的 `operator`。`type` 是查询类型；保存 / 更新只传字段值。多条件按 AND 组合，完整操作符见[查询条件指南](../../references/query-condition-guide.md)。

| 组件类型（`componentName`） | 查询 `type` | 查询 `value`（操作符） | 保存 / 更新值 |
| --- | --- | --- | --- |
| `TextField` / `TextareaField` | `TEXT` | `"文本"`（eq / like） | `"文本"` |
| `NumberField` | `DOUBLE` | `1`（eq / gt / ge / lt / le）或 `[1,10]`（between） | `1` |
| `RateField` | `DOUBLE` | `3`（eq / gt / ge / lt / le）或 `[2,4]`（between） | `3` |
| `RadioField` / `SelectField` | `ARRAY` | `"选项值"`（eq）或 `["选项值"]`（contains） | `"选项值"` |
| `CheckboxField` / `MultiSelectField` | `ARRAY` | `["选项值"]`（contains） | `["选项值一","选项值二"]` |
| `DateField` | `DOUBLE` | 毫秒时间戳数字（eq / gt / ge / lt / le）或 `[开始毫秒时间戳,结束毫秒时间戳]`（between） | 毫秒时间戳数字，如 `1719705600000` |
| `CascadeDateField` | `DOUBLE` | `[[开始下限,开始上限],[结束下限,结束上限]]`，省略 operator | `[开始毫秒时间戳,结束毫秒时间戳]`；空端点用 `""` |
| `EmployeeField` | `STRING` | `"userId"`（eq）或 `["userId"]`（contains） | `["userId"]` |
| `DepartmentSelectField` | `ARRAY` | `1123456` 或 `["1123456"]` | `["1123456"]` |
| `CitySelectField` | `STRING` | `[省ID,市ID,区ID]` | `[省ID,市ID,区ID]` |
| `TableField` | `TEXT` | `"关键词"`（contains）；子字段条件带 `parentId` | `[{"textField_xxx":"值"}]` |
| `AssociationFormField` | — | 先查询关联目标表，再按业务关系定位记录 | `[{"appType":"xxx","formUuid":"xxx","formType":"receipt","instanceId":"xxx","title":"关联记录标题"}]` |

### 为空与不为空（is / is_not）

判断字段有无值时，`is` 与 `is_not` 的 `value` 都固定传 `""`；`type` 仍使用字段的查询类型。例如 `DateField` 使用 `DOUBLE`。这里的空字符串是查询参数，保存格式仍按上表填写。

日期为空：

```bash
openyida data query form APP_xxx FORM-xxx --search-json '[{"key":"dateField_xxx","componentName":"DateField","type":"DOUBLE","operator":"is","value":""}]'
```

日期不为空：

```bash
openyida data query form APP_xxx FORM-xxx --search-json '[{"key":"dateField_xxx","componentName":"DateField","type":"DOUBLE","operator":"is_not","value":""}]'
```

日期零时间戳和数字 `0` 属于有值，`is_not` 会保留这些记录。页面调用将条件数组传给 `JSON.stringify()`，再赋给 `searchFieldJson`。

日期区间两端均未填，用两个端点条件按 AND 组合：

```json
[
  {"key":"cascadeDateField_xxx.start","componentName":"DateField","type":"DOUBLE","operator":"is","value":""},
  {"key":"cascadeDateField_xxx.end","componentName":"DateField","type":"DOUBLE","operator":"is","value":""}
]
```

日期区间两端均已填：

```json
[
  {"key":"cascadeDateField_xxx.start","componentName":"DateField","type":"DOUBLE","operator":"is_not","value":""},
  {"key":"cascadeDateField_xxx.end","componentName":"DateField","type":"DOUBLE","operator":"is_not","value":""}
]
```

“任一端已填”使用已填端点数 `gt 0`；多选未选择、子表无行分别按选项数、行数查询。计数与原值同步维护，具体见查询指南。

### 日期字段写入约定

- `DateField` 保存/更新值使用毫秒时间戳数字，例如 `1719705600000`；`0` 是有效时间戳。
- `CascadeDateField` 保存/更新值使用 `[开始毫秒时间戳,结束毫秒时间戳]`，半填区间的空端点使用 `""`。
- 先用 `new Date('2024-06-30T00:00:00+08:00').getTime()` 按业务时区转换，再提交数字。
- 给历史记录填写新增字段时，使用 `--use-latest-version y`；保存后回读字段值和查询结果，确认新结构与数据都已生效。

```bash
openyida data create form APP_xxx FORM-xxx --expect-form-name 合同信息 --expect-form-type receipt --data-json '{
  "textField_xxx": "测试记录",
  "dateField_xxx": 1719705600000,
  "cascadeDateField_xxx": [1719705600000,1722384000000]
}'
```

### 关联表单字段

关联表单字段保存时必须使用数组对象格式，每项包含五个必填字段；`subTitle` 可选，省略时 CLI 会补为空字符串：

```bash
# 示例：创建带关联客户的商机
openyida data create form APP_xxx FORM-商机表 --expect-form-name 商机表 --expect-form-type receipt --data-json '{
  "textField_xxx": "商机名称",
  "associationFormField_xxx": [{"appType":"APP_xxx","formUuid":"FORM-客户表","formType":"receipt","instanceId":"FINST-xxx","title":"客户名称","subTitle":""}]
}'
```

> 注意：字段名是 `instanceId`（不是 `formInstId`）。`appType`、`formUuid`、`formType`、`instanceId`、`title` 五个字段缺一不可。
>
> 查询结果中的 `associationFormField_xxx_id` 是只读派生字段，只用于读取关联 ID；保存和更新必须写原始的 `associationFormField_xxx` 字段。


## 实现前准备

按字段设计结果创建结构化表单配置，再执行表单创建、更新或数据写入命令。字段 ID 和关联记录 ID 都来自真实 Schema 或查询结果。

## 注意事项

- `pageSize` 一般写 50，最大 100，QPS 限制约 40 次/秒
- `searchFieldJson` 和 `dynamicOrder` 必须传字符串
- 需要稳定顺序的分页、比对或配对必须显式传 `--dynamic-order '{"fieldId":"+"}'`（升序）或 `--dynamic-order '{"fieldId":"-"}'`（降序）；未传时不得依赖默认返回顺序
- 字段 ID 通过 `openyida get-schema` 获取，不要手写猜测
- 批量脚本可以用 Python `subprocess` 调用 `openyida data ...`，也可以用 JS 复用 Node 工具；脚本必须由结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/scripts/`，导入数据放在 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/`

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 查询返回空结果 | 确认 formUuid 正确，检查查询条件是否过于严格 |
| 子表只返回 50 行 | 不要翻 `searchFormDatas.currentPage`；使用 `query subform` / `listTableDataByFormInstIdAndTableId` 按 `formInstId + tableFieldId` 分页查询 |
| 查询中隐藏字段缺失或全部字段隐藏导致字段数据为空 | 属于正常行为；确认目标实例 ID，核对可见字段，不把缺失字段自动补成 `null` 或空字符串 |
| 新增数据后可见字段值不符合预期 | 先执行 `openyida get-schema` 核对真实 fieldId，再检查写入参数 |
| 更新失败（formInstId 不存在） | 先用 query 命令确认记录存在，不要猜测 formInstId |
| 接口返回 401/未登录 | 执行 `openyida login` 重新登录 |
| QPS 超限（429） | 降低请求频率，批量操作单次不超过 30 条 |
| 删除操作误删 | 删除前必须展示操作摘要并获得用户明确确认，不可逆操作 |
| 流程接口用了表单接口路径 | 检查接口路径：表单用 `/v1/form/`，流程用 `/v1/process/` |

## Agent 错误处理策略

当 Agent 执行本技能遇到错误时，必须遵循以下默认行为：

| 错误类型 | 默认处理策略 |
|---------|-------------|
| 命令执行失败 | 停止执行，向用户展示错误信息，询问是否重试或调整参数 |
| 管理员转交失败或结果未验证 | 禁止自动重放转交；按 details.nextStep 只读核查并报告 mutationAccepted/readbackVerified，后续写入须重新核对当前任务和用户意图 |
| 参数缺失（appType/formUuid/fieldId 等） | 主动询问用户补充，或引导用户使用 `yida-get-schema` 获取 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida login` 重新登录 |
| 字段 ID 无效 | 停止执行，引导用户执行 `openyida get-schema` 获取真实字段 ID |
| 删除操作前 | 必须先展示操作摘要（数量 + 关键字段）；宿主支持 runtime permission/approval 时直接发起一次受保护命令，不得预先调用 `ask_human`；宿主不支持时，必须先通过 `ask_human` 或等价交互工具获得用户明确确认 |
| QPS 超限 | 降低请求频率，单次批量操作不超过 30 条，间隔 1 秒重试 |
| 表单/流程接口混用 | 停止执行，提示用户检查接口类型（表单用 `/v1/form/`，流程用 `/v1/process/`） |
| 网络超时 | 查询可重试 1 次；管理员转交禁止自动重试提交，仅按 nextStep 只读回查，仍无法验证则报告结果未知 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |
