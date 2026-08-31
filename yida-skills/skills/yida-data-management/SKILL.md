---
name: yida-data-management
description: 宜搭数据管理。表单实例/子表/流程实例/任务中心的查询、新增、更新，以及普通表单单实例的精确删除。表单走 /v1/form/，流程走 /v1/process/，不能混用。
---

# 数据管理

## 创建/录入数据强制闭环

涉及新增记录、生成测试数据、批量导入或发起流程时，必须连续完成下面 5 步；任一步断开都不算完成。

1. **只读预检**：先确认登录态和目标 `appType`/`formUuid`；执行 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实 `fieldId`，必要时先 `openyida data query ...` 确认目标表单/流程可读。
2. **类型分流**：普通表单用 `openyida data create form <appType> <formUuid> ...`；流程表单用 `openyida data create process <appType> <formUuid> --process-code <processCode> ...`。表单接口和流程接口不能互相替代。
3. **写入即提交**：小 JSON 可直接用 `--data-json '<json>'`；长 JSON 或批量造数先用结构化文件写入工具创建到 `.cache/openyida/<项目名或任务名>/data-import/<name>.json`，创建后必须立刻调用对应 `openyida data create ... --data-file <path>`。
4. **批量逐条创建**：`openyida data create form/process` 每次只创建一条实例；多条记录按单次不超过 30 条循环/分批逐条调用。不要把多条实例数组塞进一个 `--data-file`，除非该数组是某个子表字段的字段值。
5. **写后验收**：create/update 返回无报错后，必须执行 `openyida data query form|process <appType> <formUuid> ...` 抽查至少 1 条新记录，确认 `formData` 非空且包含本次写入字段值；流程记录可再用返回的 `processInstanceId` 执行 `get process` 复核。

## 完整应用默认 seed records

`yida-app` 从零生成完整应用时，表单创建完成后默认加载本技能，为核心业务普通表单写入 1-3 条业务化示例记录，再让自定义页面读取这些真实表单记录。

执行规则：

- 只对本轮新建或页面 `dataBinding.mode=form` 依赖的核心普通表单默认写入；配置字典表、权限表、敏感个人数据表、纯附件表或用户明确说不要造数时跳过，并在 final 说明原因。
- 记录数量默认 1-3 条：单对象轻应用写 1 条；列表/工作台写 2 条；看板/排行/状态分布写 3 条。不要为了展示效果批量灌入大量数据。
- 示例记录必须是当前业务语义，不写“测试1 / demo / mock”；例如客户、订单、学生、商品、工单、活动等对象要有合理名称、状态、金额、数量、负责人或日期。
- 先执行 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实 `fieldId`；保存数据使用真实 fieldId 或 `--resolve-aliases` 可解析别名，禁止猜测字段 ID。
- 日期字段必须转成 13 位毫秒时间戳；单选/多选必须使用表单已配置选项；成员/部门字段只有可安全确认 userId/deptId 时才填，否则留空或跳过该字段。
- 每条实例单独执行一次 `openyida data create form`；不要把 1-3 条记录作为顶层数组塞进一个 `--data-file`。
- 写完必须 `openyida data query form` 抽查至少 1 条，并把写入数量和抽查结果交给 `yida-app` 页面阶段使用。

## 严格禁止 (NEVER DO)

- 不要混用表单接口和流程接口，两套接口完全独立，参数和返回结构不同
- 不要编造 formInstId 或 processInstanceId，必须从查询结果中提取
- 不要用此命令修改表单结构（字段增删改），应使用 `yida-create-form-page`
- **绝对禁止猜测或编造字段 ID（fieldId）**，宜搭字段 ID 由平台随机生成（如 `textField_eftt1aa5m`），无法预测，必须通过 `openyida get-schema` 获取
- 不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成 `--data-file`、`--search-file`、CSV 或一次性脚本
- 不要把顶层 JSON 数组当作 `openyida data create form/process` 的批量实例导入；顶层数组只适用于子表字段值等字段内部结构

## 严格要求 (MUST DO)

- 操作前先用 query 命令确认目标数据存在
- 新增记录、生成测试数据、批量导入或发起流程必须遵守上方“创建/录入数据强制闭环”
- 批量操作单次不超过 30 条记录；多条实例必须逐条/分批执行 `openyida data create ...`
- 删除普通表单记录前，必须先执行 `openyida data get form <appType> --inst-id <formInstId> --form-uuid <formUuid> --json`，核对返回实例 ID 与目标表单，并向用户展示记录数量、标题/关键字段和实例 ID；只有用户明确确认后，才执行带 `--confirm` 的正式删除命令
- 删除完成只以 `deleted=true && readbackVerified=true` 为准；`alreadyAbsent=true` 表示本次未再次发删除请求，可按幂等成功处理
- 当前不支持删除流程实例；禁止生成 `openyida data delete process`，禁止在 CLI 报不支持后探索一次性脚本、浏览器私有请求或底层 API 绕过正式能力
- **录入/更新数据前，必须先执行 `openyida get-schema` 获取真实字段 ID，并将字段 ID 映射记录到 `.cache/<项目名>-schema.json`**
- **生成测试数据或录入/更新数据时，`DateField` / `CascadeDateField` 必须使用 13 位毫秒时间戳（如 `1719705600000`），不要传 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm:ss` 或 ISO 字符串**
- **录入数据后，必须执行 `openyida data query` 抽查至少 1 条记录，确认 `formData` 中字段有实际值（非空），否则说明字段 ID 有误，需重新排查**
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
- 未执行 `openyida data query ...` 抽查，或抽查结果的 `formData` 为空

## 完成检查清单

- [ ] 已确认登录态、`appType`、`formUuid`；流程表单已确认 `processCode`
- [ ] 已通过 schema/field map 使用真实 `fieldId`
- [ ] 如使用 `--data-file`，文件位于 `.cache/openyida/<项目名或任务名>/data-import/`，且创建后已立即调用 `openyida data create ... --data-file ...`
- [ ] 每条实例都实际执行了 `openyida data create form/process`，且命令返回无报错
- [ ] 已用 `openyida data query form|process ...` 抽查至少 1 条，确认 `formData` 非空且字段值正确
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

> ⚠️ 表单接口（`/v1/form/`）和流程接口（`/v1/process/`）不能混用。

## 危险操作确认

删除数据记录为不可逆操作，执行前必须：
1. 展示将删除的记录摘要（数量 + 关键字段）
2. 等待用户明确确认
3. 执行删除

<!-- data-delete-contract:start -->
```json
{
  "supportedDeleteCommand": "data delete form",
  "requiredTarget": ["appType", "formUuid", "formInstId"],
  "preflightCommand": "data get form",
  "businessConfirmationRequired": true,
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

### 表单实例

```bash
openyida data query form <appType> <formUuid> [--page 1 --size 20] [--search-json '<json>'|--search-file .cache/openyida/<项目名或任务名>/data-import/search.json] [--dynamic-order '{"fieldId":"+"}'] [--resolve-aliases]
openyida data get form <appType> --inst-id <formInstId>
openyida data create form <appType> <formUuid> --data-json '<json>' [--resolve-aliases]
openyida data create form <appType> <formUuid> --data-file .cache/openyida/<项目名或任务名>/data-import/record.json [--resolve-aliases]
> `create form` 会自动探测表单类型；当目标表单为流程表单时，会改用 `/v1/process/startInstance.json` 发起流程。若已知 `processCode`，仍推荐显式使用 `create process`。
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --data-json '<json>' [--resolve-aliases]
openyida data update form <appType> --inst-id <formInstId> --form-uuid <formUuid> --data-file .cache/openyida/<项目名或任务名>/data-import/patch.json [--resolve-aliases]
openyida data delete form <appType> <formUuid> --inst-id <formInstId> --confirm --json
openyida data query subform <appType> <formUuid> --inst-id <formInstId> --table-field-id <fieldId|alias> [--page 1 --size 100] [--resolve-aliases]
```

> `--data-file` / `--search-file` 指向的文件先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；从 workspace 根执行命令时路径加 `project/` 前缀。

当 JSON 使用宜搭组件别名作为 key 时，追加 `--resolve-aliases`，OpenYida 会先读取表单 Schema 中的 `componentAlias.items`，再将别名转换为真实 `fieldId` 后调用数据接口。更新类命令若要解析别名，必须额外传 `--form-uuid <formUuid>`。

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
openyida data create process <appType> <formUuid> --process-code <processCode> --data-json '<json>' [--resolve-aliases]
openyida data create process <appType> <formUuid> --process-code <processCode> --data-file .cache/openyida/<项目名或任务名>/data-import/process-record.json [--resolve-aliases]
openyida data update process <appType> --process-inst-id <processInstanceId> --form-uuid <formUuid> --data-json '<json>' [--resolve-aliases]
openyida data update process <appType> --process-inst-id <processInstanceId> --form-uuid <formUuid> --data-file .cache/openyida/<项目名或任务名>/data-import/process-patch.json [--resolve-aliases]
openyida data query operation-records <appType> --process-inst-id <processInstanceId>
openyida data execute task <appType> --task-id <taskId> --process-inst-id <processInstanceId> --out-result AGREE --remark '同意' [--data-file .cache/openyida/<项目名或任务名>/data-import/task-data.json] [--form-uuid <formUuid>] [--resolve-aliases]
```

### 任务中心

```bash
openyida data query tasks <appType> --type todo|done|submitted|cc [--page 1 --size 20]
```

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

### 任务中心

| 接口 | 说明 |
|------|------|
| `getTodoTasksInApp` | 待办 |
| `getDoneTasksInApp` | 已完成 |
| `getMySubmitInApp` | 已提交 |
| `getNotifyMeTasksInApp` | 抄送 |

## 数据格式

### 查询条件 `searchFieldJson`

必须传**字符串**：

```json
[{"key":"textField_xxx","value":"测试","type":"TEXT","operator":"eq","componentName":"TextField"}]
```

### 保存/更新数据

```json
{"textField_xxx":"文本","numberField_xxx":10,"dateField_xxx":1719705600000,"employeeField_xxx":["userId"]}
```

当 JSON 较长或用于批量导入时，使用结构化文件写入工具写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/<name>.json`，再使用 `--data-file` 或 `--search-file`；不要为了拼接命令在仓库根目录、系统临时目录或 `.cache/` 顶层生成临时脚本。`openyida data create form/process` 单次只提交一个实例 JSON，多条实例必须逐条/分批调用；不要把实例数组作为一个 `--data-file` 提交。

### 常见字段格式

| 组件类型 | 查询格式 | 保存格式 |
|---------|---------|----------|
| 文本 | `"文本"` | `"文本"` |
| 数字 | `["1","10"]` 或单值 | `1` |
| 单选 | `"选项一"` | `"选项一"` |
| 多选 | `["选项一"]` | `["选项一","选项二"]` |
| 日期 | `[开始毫秒时间戳,结束毫秒时间戳]` | `13 位毫秒时间戳` |
| 成员 | `["userId"]` | `["userId"]` |
| 部门 | `["deptId"]` | `["deptId"]` |
| 子表 | `"模糊搜索"` | `[{"textField_xxx":"值"}]` |
| 关联表单 | 不支持直接查询 | `[{"appType":"xxx","formUuid":"xxx","instanceId":"xxx"}]` |

### 日期字段写入约定

- `DateField` 保存/更新值必须是 13 位毫秒时间戳，例如 `1719705600000`。
- `CascadeDateField` 保存/更新值必须是毫秒时间戳数组，例如 `[1719705600000,1722384000000]`。
- 生成测试数据时，先用 `new Date('2024-06-30T00:00:00+08:00').getTime()` 或等价方式转换，不要直接写 `"2024-06-30"`。
- 日期字符串可能导致保存失败、字段为空，或后续报表/筛选异常。

```bash
openyida data create form APP_xxx FORM-xxx --data-json '{
  "textField_xxx": "测试记录",
  "dateField_xxx": 1719705600000,
  "cascadeDateField_xxx": [1719705600000,1722384000000]
}'
```

### 关联表单字段

关联表单字段保存时必须使用数组对象格式，包含三个必填字段：

```bash
# 示例：创建带关联客户的商机
openyida data create form APP_xxx FORM-商机表 --data-json '{
  "textField_xxx": "商机名称",
  "associationFormField_xxx": [{"appType":"APP_xxx","formUuid":"FORM-客户表","instanceId":"FINST-xxx"}]
}'
```

> 注意：字段名是 `instanceId`（不是 formInstId），三个字段缺一不可


## 实现前准备

按字段设计结果创建结构化表单配置，再执行表单创建、更新或数据写入命令。字段 ID 和关联记录 ID 都来自真实 Schema 或查询结果。

## 注意事项

- `pageSize` 最大 100，QPS 限制约 40 次/秒
- `searchFieldJson` 和 `dynamicOrder` 必须传字符串
- 需要稳定顺序的分页、比对或配对必须显式传 `--dynamic-order '{"fieldId":"+"}'`（升序）或 `--dynamic-order '{"fieldId":"-"}'`（降序）；未传时不得依赖默认返回顺序
- 字段 ID 通过 `openyida get-schema` 获取，不要手写猜测
- 批量脚本可以用 Python `subprocess` 调用 `openyida data ...`，也可以用 JS 复用 Node 工具；脚本必须由结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/scripts/`，导入数据放在 `<projectRoot>/.cache/openyida/<项目名或任务名>/data-import/`

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 查询返回空结果 | 确认 formUuid 正确，检查查询条件是否过于严格 |
| 子表只返回 50 行 | 不要翻 `searchFormDatas.currentPage`；使用 `query subform` / `listTableDataByFormInstIdAndTableId` 按 `formInstId + tableFieldId` 分页查询 |
| 新增数据后字段值为空 | 字段 ID 有误，先执行 `openyida get-schema` 获取真实 fieldId |
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
| 参数缺失（appType/formUuid/fieldId 等） | 主动询问用户补充，或引导用户使用 `yida-get-schema` 获取 |
| 权限不足 / 登录态失效 | 停止执行，提示用户执行 `openyida login` 重新登录 |
| 字段 ID 无效 | 停止执行，引导用户执行 `openyida get-schema` 获取真实字段 ID |
| 删除操作前 | 必须先展示操作摘要（数量 + 关键字段），等待用户明确确认 |
| QPS 超限 | 降低请求频率，单次批量操作不超过 30 条，间隔 1 秒重试 |
| 表单/流程接口混用 | 停止执行，提示用户检查接口类型（表单用 `/v1/form/`，流程用 `/v1/process/`） |
| 网络超时 | 重试 1 次，仍失败则停止并提示用户检查网络 |
| 未知错误 | 停止执行，完整展示错误信息，建议用户反馈问题 |
