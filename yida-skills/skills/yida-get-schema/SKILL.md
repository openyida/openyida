---
name: yida-get-schema
description: 确定性解析表单字段 ID（fieldId）和子表路径；agent 优先使用 compact 字段契约，排障时仍可获取完整 Schema。
---

# 获取表单 Schema

## 严格禁止 (NEVER DO)

- **绝对禁止猜测或编造 fieldId**，宜搭字段 ID 由平台随机生成（格式如 `textField_eftt1aa5m`、`selectField_fix024y92`），无法从字段名称推断，必须通过此命令获取
- 不要在未获取 Schema 的情况下执行任何涉及字段 ID 的操作
- 不要假设字段 ID 格式，即使看起来像 `textField_xxx`，也必须通过命令确认
- 不要跳过 Schema 获取步骤直接进行数据操作，即使用户催促也必须先获取
- 不要在 Schema 获取失败时继续执行后续操作，必须先解决问题
- 不要缓存过期的 Schema 信息，表单结构变更后必须重新获取
- 不要把进程内状态或 CLI 自动派生索引当作跨调用缓存；查询新字段时允许重新拉取完整 Schema
- 不要把 `openyida get-schema` 的 stdout 通过 shell 重定向保存成 JSON，也不要用 heredoc、`cat`/`echo`/`printf`/`tee` 生成 Schema 文件
- 不要把 `openyida get-schema` 的 stdout 再接 `head`、`tail`、`grep`、`sed`、`awk` 等截断/筛选命令作为 Schema 证据；这会丢字段、选项或子表路径，导致后续重复拉取
- 不要在同一阶段对同一个 `formUuid` 连续执行 `--compact`、`--field-map-json`、完整 Schema 等多轮“探一段 stdout”式查询；除非表单刚被修改、上次命令失败/不完整，或排障需要完整组件 props

## 严格要求 (MUST DO)

- **凡是需要用到字段 ID（fieldId）的操作，必须先执行此命令**，不得跳过
- 页面开发、数据查询、报表配置或流程规则只需要字段身份时，先执行 `openyida get-schema <appType> <formUuid> --compact --resolve-fields "<字段1,字段2>"`，不要拉取完整 Schema
- 页面开发默认使用 compact 输出，只读取必要字段契约，不内联完整 Schema
- 完整应用页面、看板、列表或详情页需要一个表单的大部分字段，或需要跨多个表单建立 `dataBinding` 时，优先对每个表单执行一次 `openyida get-schema <appType> <formUuid> --field-map-json`，消费完整 JSON 后解析所需字段，不用 shell 截断 stdout
- 多表单场景同一阶段同一 `formUuid` 默认最多拉取一次字段映射；把 `appType`、`formUuid`、`fieldId`、`label`、`componentName`、`options` 等合并写入 `<projectRoot>/.cache/<项目名>-schema.json`，后续页面 spec 和源码复用该本地 ID 映射
- 执行 compact 查询后，只消费唯一命中的 `fields[]`；`missingFields` 或 `ambiguousFields` 非空时停止，不得猜测或继续写操作
- 只有用户明确需要完整组件 props、布局结构、字段数据源配置，或 compact/summary 无法排障时，才执行不带 `--compact`/`--summary-json` 的完整 Schema 输出；拿到完整 Schema 后只读取必要片段，不内联完整 Schema
- 已有 `<projectRoot>/.cache/<项目名>-schema.json` 等本地 ID 映射文件可显式复用；目标字段缺失、重名、结构已变或无法确认新鲜度时，必须重新执行 compact 查询
- 如需保存关键字段 ID 映射，使用结构化文件写入工具；这是 agent 管理的本地工件，不是 OpenYida CLI 自动缓存
- 如需保存完整 Schema 文件，先执行命令获取 stdout，再用 create_file / Write / file edit tool 写入 `<projectRoot>/.cache/openyida/<项目名或任务名>/<表单名>-schema.json`；从 workspace 根执行后续命令时传 `project/.cache/...`
- **录入/更新数据后，必须用 `openyida data query --size 1` 抽查一条记录，确认 `formData` 中字段有实际值（非空 `""`），若全部为空说明字段 ID 有误，需重新排查**

## 适用场景

在执行以下操作前**必须**使用：
- **新增/录入表单数据**（`yida-data-management` create）← 最常见的遗漏场景，必须先 get-schema
- 更新表单数据（`yida-data-management` update）
- 配置数据查询条件（`yida-data-management` query searchFieldJson）
- 更新表单字段结构（`yida-create-form-page` update 模式）
- 配置流程字段权限（`yida-process-rule`）
- 自定义页面中引用字段 ID 常量（`yida-custom-page`）

## 触发条件

**正向触发**：
- 任何需要用到 fieldId 的操作前（自动前置触发）
- "查看表单结构"、"获取字段 ID"、"查看 Schema"
- 其他技能（yida-data-management、yida-process-rule、yida-custom-page）执行前的前置步骤
- "批量获取所有表单 Schema"、"导出应用下所有字段 ID"、"不知道 formUuid 先全量看一遍"

---


## 命令

```bash
openyida get-schema <appType> <formUuid> --compact [--resolve-fields <labelOrFieldId,...>]
openyida get-schema <appType> <formUuid> [--summary-json|--field-map-json]
openyida get-schema <appType> --all [--summary-json] [--output-dir <dir>] [--keyword <text>] [--concurrency N] [--retries N]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `appType` | 是 | 应用 ID |
| `formUuid` | 单表模式必填 | 表单 UUID |
| `--compact` | 否 | 输出 `yida_schema_field_resolution` contract v1，不输出完整 Schema |
| `--resolve-fields <query,...>` | 否 | 按精确 label、fieldId、alias、稳定 ID 路径或 `子表/字段` 可读路径筛选；可重复，自动启用 compact |
| `--all` | 批量模式必填 | 获取应用下所有表单/页面的 Schema |
| `--output-dir <dir>` | 否 | 将每个 Schema 写入独立 JSON 文件，并生成 `index.json` |
| `--keyword <text>` | 否 | 仅批量导出名称、UUID、类型或路径匹配关键词的表单 |
| `--concurrency N` | 否 | 批量并发数，默认 3，范围 1-10 |
| `--retries N` | 否 | 单个 Schema 失败后的重试次数，默认 1，范围 0-5 |
| `--summary-json` / `--field-map-json` | 否 | 只输出字段摘要 JSON，不把完整 Schema 放入 stdout；`--field-map-json` 是语义别名 |

### 单表模式

```bash
openyida get-schema APP_XXX FORM-XXX --compact --resolve-fields "访客姓名,状态"
openyida get-schema APP_XXX FORM-XXX --field-map-json
```

Agent 只需要少量字段 ID 时，默认使用 `--compact --resolve-fields`，读取 `fields[].label`、`fields[].fieldId`、`fields[].componentType`、`fields[].valueType`、`fields[].path`、`fields[].labelPath` 和 `fields[].parentFieldId`。`path` 是稳定的 fieldId 数组，`labelPath` 是可读路径；所有可用语言的 label 都参与精确匹配。同名字段会进入 `ambiguousFields[].matches`，必须使用完整 `labelPath`、稳定 `path` 或已返回的 fieldId 重新精确选择，禁止取第一个。

需要全量字段摘要和选项时继续使用 `--summary-json`。只有需要组件完整 props、布局结构、字段数据源配置或排障时，才执行不带 compact/summary 参数的完整 Schema 输出。

消费输出时读取完整 JSON，再由 agent / 脚本解析字段；不要用 `tail -20`、`head -30` 或 `grep` 只看局部 stdout。局部查看可以作为人工调试，但不能作为后续写页面、写数据或配置流程的字段证据。

如需复用输出，使用 agent 的结构化文件写入工具创建：

```text
<projectRoot>/.cache/openyida/customer/customer-schema.json
<projectRoot>/.cache/customer-schema.json   # 仅保存 appType/formUuid/fieldId/reportId 等 ID 映射
```

### 批量模式

```bash
openyida get-schema APP_XXX --all --summary-json --output-dir .cache/openyida/customer/schemas
openyida get-schema APP_XXX --all --keyword 客户 --concurrency 5 --retries 2
```

批量模式会先读取应用导航中的表单/页面列表，再逐个请求 `getFormSchema`。如果指定 `--output-dir`：

- 每个成功的 Schema 会写入 `<表单名>-<formUuid>.json`
- `index.json` 会记录 `formUuid`、名称、类型、字段摘要、失败原因和 schema 文件路径
- stdout 仍输出汇总 JSON，便于脚本继续处理

## 输出

Agent compact 模式输出共享 contract，不包含完整 Schema 或 props：

```json
{
  "kind": "yida_schema_field_resolution",
  "contractVersion": 1,
  "resource": {
    "appType": "APP_XXX",
    "formUuid": "FORM-XXX",
    "schemaHash": "sha256:<64位小写十六进制>"
  },
  "fields": [
    {
      "query": "订单明细/商品名称",
      "label": "商品名称",
      "fieldId": "textField_xxx",
      "componentType": "TextField",
      "valueType": "custom",
      "path": ["tableField_xxx", "textField_xxx"],
      "labelPath": ["订单明细", "商品名称"],
      "parentFieldId": "tableField_xxx",
      "alias": ""
    }
  ],
  "missingFields": [],
  "ambiguousFields": []
}
```

`--compact` 不带 `--resolve-fields` 时按 Schema 顺序返回全部正规化字段。指定 `--resolve-fields` 时，`fields` 只含唯一命中项，未命中和重名分别进入 `missingFields`、`ambiguousFields`。

单表模式默认仍将完整的 Schema JSON 输出到 stdout，包含 `pages`、`componentsMap` 等字段结构；兼容摘要模式可用 `--summary-json` 或 `--field-map-json`：

```json
{
  "success": true,
  "appType": "APP_XXX",
  "formUuid": "FORM-XXX",
  "fieldCount": 2,
  "fields": [
    {
      "label": "访客姓名",
      "componentName": "TextField",
      "fieldId": "textField_xxx",
      "alias": "visitorName",
      "reportFieldCode": "textField_xxx",
      "options": [],
      "optionCount": 0,
      "optionsTruncated": false
    }
  ]
}
```

批量模式将汇总 JSON 输出到 stdout；指定 `--output-dir` 时，完整 Schema 写入文件，stdout 中的 `forms[].schemaFile` 指向对应文件。加 `--summary-json` 时，stdout 和 `index.json` 都只保留字段摘要与 schemaFile 指针，不内联完整 Schema。

> 编码前可用此命令确认表单中各字段的 `fieldId`。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 命令返回失败 | 确认 appType 和 formUuid 正确，检查登录态 |
| 输出被终端截断 | 优先改用 `--summary-json`；确需完整 Schema 时，再将 stdout 通过结构化文件写入工具保存到 `<projectRoot>/.cache/openyida/<项目名或任务名>/<表单名>-schema.json`；不要使用 shell 重定向 |
| 需要多个表单字段 ID | 使用批量摘要或每表单完整字段映射：`openyida get-schema <appType> --all --summary-json --output-dir .cache/openyida/<项目名或任务名>/schemas`，或对目标表单逐个执行一次 `--field-map-json`；默认只读完整 JSON / `index.json` 字段摘要，不用 `head`/`tail`/`grep` 截断 |
| 批量部分失败 | 查看 stdout 的 `failedCount` 和 `forms[].errorMsg`，必要时提高 `--retries` 或缩小 `--keyword` 范围 |
| 找不到目标字段 | 查看 `missingFields`，确认字段已创建后重新查询；不能手写猜测 fieldId |
| 同名字段无法唯一确定 | 查看 `ambiguousFields[].matches[].labelPath` 和稳定 `path`，使用完整路径或 fieldId 重新查询；不得默认取第一个 |
| Schema 输出为空 | 表单可能没有字段，先用 `yida-create-form-page` 创建字段 |
