---
name: yida-create-form-page
description: 表单页面创建与更新；支持 19 种业务字段和 Divider、ColumnContainer 等表单展示布局组件，PageSection/GroupContainer 仅少量特殊场景使用；支持联动规则和数据源绑定。
---

# 表单页面创建与更新

> 资源边界：本技能处理普通表单创建与更新。目标不明时先只读确认或询问用户。

## Resource-First create/update 判定

执行本技能前必须先解析 app/form resource context：

- 已有目标 `formUuid`、表单 URL、bound form，或 workspace cache/config 中可确认的表单时，字段结构诉求默认走 update/patch/rule/bind-datasource 模式；不要再 create 同名或同类表单。
- bound form/page 只是默认候选，不是锁定目标；如果当前会话绑定表单或页面 A，但用户本轮明确要求修改 B 的字段，必须先解析 B 对应的表单 `formUuid`。B 能唯一解析时改 B；B 无法唯一解析或字段归属不清时问用户；禁止默认改 A。
- 已有目标 app 但缺少业务数据表，且用户明确要求“增加客户表 / 新建订单表 / 新增数据收集入口”等，才使用 create 模式创建新表单。
- 用户给页面 URL 或自定义页面 `formUuid` 且诉求是优化页面 UI 时，改走页面源码开发和 `yida-publish-page`；不要创建表单。
- 多个表单候选时按根技能来源优先级选择；同级冲突、字段目标不明或无法判断要改哪张表时才问用户。

## 严格禁止 (NEVER DO)

- 不要编造 formUuid，必须从命令返回的 JSON 中提取
- 不要猜测 fieldId。字段级命令优先用字段 `label`、必要时用已知 `fieldId` 或 `tableLabel + label`；CLI 内部读 schema/定位并返回 compact evidence。只有字段解析失败/歧义、patch 底层路径或页面/公式/流程等确实需要多字段映射时，才用 `yida-get-schema` 一次性取证。
- 不要用此命令操作数据记录（增删改查），应使用 `yida-data-management`
- 不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成字段、变更、补丁、规则、数据源 JSON 文件
- OpenYida CLI 不要加 `2>/dev/null`；失败时保留 stdout/stderr 诊断，遇到 DENIED 或重复失败必须换策略
- 多表单 batch 契约已在本技能给出时，不要再调用 `create-form batch --help`、`create-form batch --check`，也不要搜索 CLI 安装目录或源码来探测格式；这些调用同样占用本轮唯一一次 batch 调用名额
- 已有目标表单且用户是改字段/联动/属性时，不要创建新表单；必须走 update/patch/rule/bind-datasource。
- 不要用 `GroupContainer` / `PageSection` 承载普通业务分组；普通分组必须优先用 `Divider`
- 严禁为原生表单或 `formDetail` 生成、注入 CSS、JS、HTML 或主题代码；详情页由平台渲染。

## 严格要求 (MUST DO)

- 拿到或确认真实 `formUuid` 后，用于后续字段更新、数据绑定和页面入口配置。
- create 成功后，将 formUuid 记录到 `.cache/<项目名>-schema.json`
- 完整应用生成场景中，create 成功并记录 formUuid 后，把核心普通表单交给 `yida-data-management` 默认写入 1-3 条业务化示例记录；不要在本技能里直接操作数据记录。
- update / add-option / bind-datasource / validation / rule 等字段级操作不要求先执行外部 `get-schema`；直接提交 compact JSON 或字段 label/fieldId，CLI 会内部读取 schema、定位字段，并在成功 JSON 中输出 compact `resolved`/`updatedProps` evidence。字段解析失败/歧义时按 `diagnostics[].candidates` 补 `tableLabel`、修正 label 或再执行一次 compact `get-schema`。
- 字段定义或变更定义需要落盘时，必须使用 agent 的结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/`，例如 `<projectRoot>/.cache/openyida/pm/pm-fields-team.json`
- 普通表单分组必须优先使用 `Divider`，多列排版必须通过字段 JSON 中的 `ColumnContainer` 局部表达
- **重复结构化记录默认使用 `TableField`**：用户未指定具体字段类型时，凡一个业务字段承载多条同构记录，且每条记录由一组固定子字段组成，必须用 `TableField + children` 建模，不以字段名称或业务领域作为判断依据；用户明确指定具体字段类型时按用户要求执行，不将模型推断、跨会话记忆或历史兼容性说法视为用户指定。未在当前应用、当前提交链路验证的限制不能作为字段改型依据。
- **本技能不读写 memory**：formUuid 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户需要“创建表单”“新建表单”“新增字段”“修改字段”“删除字段”“修改表单结构”“字段显示隐藏联动”“onChange 自动带出”“搜索选择字段绑定数据源”时使用。

关键区分：

| 用户意图 | 选择 |
|------|------|
| 创建新表单 / 设计字段结构 | 本技能 `create` 模式 |
| 增删改字段结构 | 本技能 `update` 模式 |
| 配置 OpenYida 尚未封装的平台字段属性/动作 | 本技能 `patch` 模式；字段事件动作使用原子 `field-action`，先读 [advanced-form-modes.md](references/advanced-form-modes.md) |
| 字段显示隐藏、只读、自动赋值 | 本技能 `rule` 模式，先读 [advanced-form-modes.md](references/advanced-form-modes.md) |
| 选项字段远程搜索数据源 | 本技能 `bind-datasource` 模式，先读 [advanced-form-modes.md](references/advanced-form-modes.md) |
| 表单数据记录增删改查 | `yida-data-management` |
| 字段公式、默认值、计算 | `yida-formula` |
| 流程审批规则 | `yida-process-rule` |
| 连接器动作创建 | `yida-connector` |

## 多表单创建

同一轮需要新建两个及以上普通表单时，必须按 [并行创建表单](references/batch-forms.md) 把全部表单写入同一个 `forms.json`，并且只调用一次 `openyida create-form batch <appType> <任务文件> --json`。独立表单和关联表单放在同一任务文件中，依赖通过 `dependsOn` / `$form` 表达，由 CLI 在一次 batch 内部完成分组、真实 `formUuid/fieldId` 回读和依赖调度；不要手工拆成多次 batch，也不要逐个调用 `create-form create`。调用前先确认 CLI 的实际项目根目录，并让 Write 创建的绝对路径与 Bash 使用的任务文件指向同一个物理文件：常见 `<workspace>/project` 布局中应写入 `<workspace>/project/.cache/openyida/<项目名>/forms.json`，再从该项目根传 `.cache/openyida/<项目名>/forms.json`。先用 Read 确认任务文件存在，不要通过试跑 batch 探测路径。batch 返回 background pending 时等待运行时投递完成结果，不得再次调用 batch。只有修改已有表单、恢复已有 `formUuid`，或当前 batch 契约无法表达依赖时，才走明确的非 batch 路径并说明原因。

主技能内的最小任务文件契约如下，执行普通批量创建无需再查 help、sample 或 CLI 源码：

```json
{
  "forms": [
    { "key": "customer", "title": "客户", "fields": [{ "type": "TextField", "label": "客户名称", "required": true }] },
    { "key": "contact", "title": "联系人", "fields": [{ "type": "TextField", "label": "联系人姓名", "required": true }] },
    {
      "key": "relation",
      "title": "客户联系人关系",
      "dependsOn": ["customer", "contact"],
      "fields": [{
        "type": "AssociationFormField",
        "label": "关联客户",
        "associationForm": {
          "appType": "APP_XXX",
          "formUuid": { "$form": "customer" },
          "formTitle": "客户",
          "mainFieldId": { "$form": "customer", "field": "客户名称" },
          "mainFieldLabel": "客户名称",
          "mainComponentName": "TextField"
        }
      }]
    }
  ]
}
```

`fieldsFile` 也可替代内联 `fields`，其路径相对 `forms.json` 所在目录；已有完整表单可提供 `formUuid` 回读复用。普通搭建的 batch 项必须省略 `icon`，由 CLI 按标题和字段语义自动选择；只有用户明确给出 `openyida create-form icons --json` 目录中的表单图标名时才设置，应用图标 `xian-*` 绝不是表单图标。`locale` 同样只在用户明确指定时设置。普通多表单创建的执行顺序固定为：确认 `projectRoot` → Write 一个任务文件 → Read 确认文件 → 唯一一次真实 batch → 使用 batch 结果和必要的 compact `get-schema` 回读。

最小 `forms.json` 结构如下；`fieldsFile` 相对 `forms.json` 所在目录解析：

```json
{
  "forms": [
    { "key": "customer", "title": "客户", "fieldsFile": "customer-fields.json" },
    {
      "key": "order",
      "title": "订单",
      "fieldsFile": "order-fields.json",
      "dependsOn": ["customer"]
    }
  ]
}
```

关联字段必须把引用放在 `associationForm` 内。推荐使用紧凑写法 `"associationForm": { "$form": "customer", "field": "客户名称" }`；batch 会将其规范化为 `associationForm.formUuid` 和 `associationForm.mainFieldId`。完整写法则分别在 `formUuid` 使用 `{ "$form": "customer" }`、在 `mainFieldId` 使用 `{ "$form": "customer", "field": "客户名称" }`。不要把 `$form` 放在 `AssociationFormField` 顶层，也不要用 `batch --help`、空参数或临时计划探索格式；技能中的结构就是正式契约。

Batch 以任务文件指纹和 `<forms.json>.state.json` 共同标识一次批量操作，恢复动作由结果中的 `recoveryAction` 唯一决定：

| 当前结果 | 状态事实 | 下一动作 |
| --- | --- | --- |
| background pending | 原任务仍在执行，task/state/lock 保持为同一操作 | 保持当前执行单元，后续只接收该任务的最终结果 |
| `FORM_BATCH_PARTIAL_FAILURE` + `rerun_unchanged_plan` | 已知 `formUuid` 已记录在 state，原任务指纹可安全恢复 | 后续使用原任务文件和原参数重新执行同一 batch，由 CLI 从 state 复用已知资源 |
| `FORM_BATCH_PARTIAL_FAILURE` + `inspect_unknown_write_then_reconcile` | 至少一个远端写结果缺少资源 ID，当前指纹进入待核对状态 | 先回读远端资源；核对完成后建立新的 reconcile 任务，用已确认 `formUuid` 表示已有表单，仅保留确定尚未创建的任务 |

CLI 在同一次 batch 内对已取得真实 `formUuid` 的空壳表单执行一次保守恢复。每个结果状态只沿表中对应的下一动作推进。

## 官方表单示例范式

官方示例中心的表单类能力大多用 `FormContainer + 标准字段 + 字段属性/公式/联动` 承载，少量 `RichText` 用于说明。创建或更新表单时优先按这个顺序落地：

1. 字段结构：用 `TextField`、`NumberField`、`DateField`、`EmployeeField`、`SelectField`、`TableField`、`AssociationFormField` 等标准字段表达数据模型。
   电话号码使用 `TextField` 加 `validation: [{ "type": "regex", "pattern": "^1[3-9]\\d{9}$", "message": "请输入正确的 11 位手机号码" }]`；不要创建或 patch `PhoneField`。CLI 会把正则规则编译为 `customValidate`。
2. 字段公式：计算、默认值、日期/文本转换等用字段 `valueType: "formula"`、`complexValue.formula`、`formula`，不要改写成自定义页面 JS。
3. 字段联动：显示隐藏、只读、onChange 自动赋值优先用 `rule` 模式；只有 OpenYida DSL 不覆盖的平台属性才用 `patch`。
4. 说明/示例文字：需要解释能力时可增加 `RichText` 或说明字段，但业务字段仍应保持结构化。
5. 提交后跨表/通知/流程动作不要塞进字段 JS；分别交给 `yida-integration`、`yida-process-rule` 或 `yida-connector`。

## 布局决策规则

默认表单是单列，使用 `Divider` / `ColumnContainer` / 标准字段表达业务结构。严禁为了“更高级”默认把整表改成双列；严禁用 `GroupContainer` / `PageSection` 做普通分组。

- 默认单列：字段较少、流程表单、移动端优先、长文本、说明、附件、地址、子表、审批意见、需要逐项认真填写的字段。
- 局部多列：短字段且天然成对或成组时使用 `ColumnContainer`，例如开始/结束日期、姓名/工号、部门/岗位、金额/币种、联系人/电话。
- 全局 `--layout double`：只有用户明确要求“整个表单双列”时才使用；一般更推荐在字段 JSON 内用 `ColumnContainer` 做局部多列。
- 语义分组：按业务含义分段，不按字段数量平均分。常见分组包括“基本信息”“业务信息”“时间计划”“补充材料”“审批信息”。
- Divider 样式：按页面业务、字段密度和主题，从 [23 个可见样式](references/form-field-properties.md#divider) 中选择并显式填写 `dividerType`；不要套用固定推荐顺序。
- 字段 JSON 和表单 Schema JS 只承载表单结构与业务动作。

推荐结构：

```text
Divider > ColumnContainer > Field
Divider > Field
```

## 企业级表单质量规则

生成企业级表单时按以下规则执行：

- 字段必须先覆盖 PRD 明确要求，再按真实业务补充少量必要字段，避免堆砌冗余字段。
- 字段较多时必须用 `Divider` 做语义分组；每个分组开头都要有 `Divider`，包括第一个分组；`Divider` 不放在字段列表末尾。
- 同页同层级的 `Divider` 尽量使用同一个 `dividerType`；不同业务页面优先选择不同且合适的样式；场景不明确或候选同样合适时，按页面随机轮换，并把选定值写入 `dividerType`，同页不逐组随机。标题概括组内字段，已有页面局部修改沿用原样式。
- 完整业务应用包含多张表单时，表单之间应有业务关联；涉及数据流转的主表建议有文本型业务编号/名称字段，涉及时间、金额、数量的业务应使用日期/数值字段表达。
- 复杂业务表单应自然使用多种字段类型，例如文本、数值、日期、选择、成员/部门、附件、子表、关联表单；字段类型多样性服务于业务语义。
- `TableField` 必须提供 `children` 子字段，`AssociationFormField` 必须提供关联表单信息。
- 审批人、审批状态、审批节点等流程运行字段由流程能力承载；表单只收集业务数据。
- 表单标题、字段 label/title、选项、提示语、校验文案、动作源码、字段 JSON 常量和字段 JSON 文件路径都禁止 emoji；`create-form` / schema compiler 报 emoji 错误时必须改字段 JSON 或路径，不能重复 create 或用同义命令绕过。

## 表单布局样式

- 表单和详情必须延续前面已确定的应用风格。先读 `design.md`，再按 [原生表单样式与提交页背景](../yida-design/references/native-form-styles.md) 将字体、控件、状态、背景与底栏规则落实到同一份应用主题 CSS；例如杂志风应用的表单也延续其纸面、线条和阅读节奏。禁止在表单/详情加载代码、动作模块或 iframe 中注入主题代码。
- 支持与主题协调的布局多样性：按任务、字段长度和设备选择单列、多列、主次列宽、标签位置与分组间距，在 `design.md` 记录理由，通过平台支持的 Schema 属性、`ColumnContainer`、`Divider` 实现。不要让所有主题固定采用同一种白卡双列，也不要在同一应用里随机混搭风格。
- `--theme compact|comfortable` 配置页面密度，不是完整视觉主题，也不能代替应用主题 token。新版主题以运行态实际消费的变量为准；不要为了美化重建已有表单或改变字段。
- 普通业务分组使用 `Divider`，下面直接接字段或 `ColumnContainer`
- 局部多列容器保持背景克制，避免给每个列容器单独上色
- 流程表单更偏单列和清晰分段，颜色只用于章节识别
- 用户明确指定颜色时才写 `colorType: "custom"` 和具体色值

## create 模式

仅当目标表单缺失且用户意图允许新增数据收集入口时使用。已有 `formUuid` / 表单 URL / bound form 时禁止使用 create 模式。

```bash
openyida create-form create <appType> <formTitle> <fieldsJsonOrFile> [--layout double|card] [--theme compact|comfortable] [--label-align top|left]
# 文件路径示例：.cache/openyida/<项目名或任务名>/<表单名>-fields.json
```

默认不传 `--icon`，由 CLI 根据表单标题和字段语义选择导航图标，再更新导航节点并回读校验。只有用户明确指定某个图标时才传 `--icon <iconName>`；普通搭建不得调用 `openyida create-form icons` 枚举候选，也不得先猜图标、失败后再探索。`icons` 仅供用户明确指定但值不合法时的人工诊断。表单导航图标是纯图标名（如 `name-card`、`Project`、`Todo`、`clock`），不是应用图标的 `xian-*%%color` 协议。

导航图标更新必须先读取 `getFormNavigationListByOrder.json` 的当前节点，保留完整节点及 `gmtModified`、`formType`、`isNewForm`、`listOrder` 等原值，将 `title` 序列化为 JSON，沿用节点的 `formUuid`（缺失时使用 `NAV-SYSTEM-FROM-ME-UUID`），仅替换目标 `icon`。再请求带 `_api=Nav.update&_mock=false&_stamp=...` 的 `updateFormNavigation.json`，最后重新读取导航列表校验图标。禁止仅凭 formUuid 拼一个精简更新 payload。

> 文件先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；如果从 workspace 根执行命令，传 `project/.cache/openyida/<项目名或任务名>/<表单名>-fields.json`。

输出：

```json
{"success":true,"formUuid":"FORM-XXX","formTitle":"用户信息表","appType":"APP_xxx","fieldCount":4,"icon":"name-card","iconSource":"auto","url":"{base_url}/APP_xxx/workbench/FORM-XXX","formUrl":"{base_url}/APP_xxx/workbench/FORM-XXX","appUrl":"{base_url}/APP_xxx/workbench"}
```

`url` 是兼容字段，与 `formUrl` 表示同一表单入口；`appUrl` 表示应用工作台入口。普通表单保存成功后进入可用状态，自定义展示页使用 `publish-page` 生命周期。终态交付按用户请求的层级选择对应权威入口和 `resourceType`/`resourceId`：应用级使用 `appUrl`、`app_home`、`appType`，表单级使用 `formUrl`、`form`、`formUuid`。

完整应用模式下的下一步：

1. 将 `formUuid`、字段摘要和字段 JSON 路径写入 `.cache/<项目名>-schema.json`。
2. 对需要作为页面列表、看板或详情数据源的核心普通表单，加载 `yida-data-management`。
3. 用 `openyida get-schema <appType> <formUuid> --field-map-json` 获取真实 `fieldId`，再逐条写入 1-3 条业务化 seed records。
4. 写入失败时不要在表单技能里重建表单；保留表单，报告数据写入失败原因，页面阶段展示空态和登记入口。

### create 失败恢复决策树

create 命令失败后，不要立刻重复同一条 create：

1. 先确认字段 JSON 文件存在，且内容是结构化写入后的最终字段数组/对象，不是半截 JSON、update changes 或 shell 拼接残留。
2. 运行 `openyida list-forms <appType> --keyword "<表单名>"` 查同名表单；若失败结果已给出本轮创建的 `formUuid`，使用 `openyida create-form resume <appType> <formUuid> <fieldsJsonOrFile> --json` 先回读、比较并仅补缺失字段。冲突或结果未知时停止，不能重新 create；普通已知修改仍用 `update` / `patch`。
3. 只有确认远端没有同名目标表单，并且已经修改输入文件、参数、登录态或组织后，才重试 create。
4. 同一 create 命令最多重试 2 次；仍失败时停止并带上完整 stdout/stderr、字段文件路径、appType、表单名和已发现的 formUuid 给用户。

## update 模式

已有 `formUuid` / 表单 URL / bound form 时优先使用本模式。简单字段属性更新直接写 compact changes，不需要模型先 `get-schema --field-map-json`；CLI 会内部读取当前 schema，按 `label`、`fieldId` 或 `tableLabel + label` 定位字段，成功 JSON 会返回 `changes[].resolved` 和 `changes[].updatedProps`。

```bash
openyida create-form update <appType> <formUuid> <changesJsonOrFile>
openyida create-form update <appType> <formUuid> --data-file <changesJsonOrFile>
# 文件路径示例：.cache/openyida/<项目名或任务名>/<表单名>-changes.json
```

位置参数和 `--data-file` 是同一输入的两种写法，不能同时使用。


输出：

```json
{"success":true,"formUuid":"FORM-YYY","appType":"APP_XXX","changesApplied":1,"changes":[{"action":"update","label":"备注","changedProps":"required","resolved":{"label":"备注","fieldId":"textField_xxx","componentName":"TextField"},"updatedProps":{"required":true}}],"url":"{base_url}/APP_XXX/workbench/FORM-YYY","formUrl":"{base_url}/APP_XXX/workbench/FORM-YYY","appUrl":"{base_url}/APP_XXX/workbench"}
```

常见 compact changes：

```json
[
  { "action": "update", "label": "备注", "changes": { "required": true } }
]
```

字段不存在、重名或歧义时，CLI 会返回 `success:false`、`diagnostics[].code` 和 compact `candidates`；优先按候选补充 `tableLabel`、改用 `fieldId` 或修正 label 后重试。只有仍不明确、需要底层 patch path，或要为页面/公式/流程生成多字段映射时，才调用 `get-schema --compact --resolve-fields` 或 `--field-map-json`。

字段级内置解析也覆盖常用高级字段命令：

```bash
openyida create-form add-option <appType> <formUuid> <fieldLabelOrId> <option1> [option2] ...
openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>
openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>
openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>
```

`validation` / `rule` JSON 可优先写 label，例如 `{ "field": "备注", "type": "required" }`；若位于子表或存在重名，补 `{ "tableLabel": "明细", "field": "备注" }` 或直接使用已知 `fieldId`。成功 JSON 会返回每条规则或事件绑定的 compact `resolved` evidence；失败只返回 compact `diagnostics[].candidates`，不会打印完整字段列表。

## 半成功 create 恢复

create 已返回真实 `formUuid`、但后续 schema 保存或回读失败时，使用保守恢复命令：

```bash
openyida create-form resume <appType> <formUuid> <fieldsJsonOrFile> --json
```

该命令先回读目标表单并核对字段，只添加可唯一判定的缺失字段，保存后再次回读；同名异类型、重复
目标字段、归属不匹配或回读不确定时均停止且不写入。它不会新建替代表单，也不会覆盖已有字段。

`resume` 的保存端 HTTP 5xx 恢复流程固定为：精确回读目标表单；目标字段已存在时收口为成功，目标字段缺失且无冲突时绑定最新服务端 revision 执行一次保存，再做最终回读。成功 JSON 提供真实 `formUuid`、表单入口 `url`/`formUrl` 和应用工作台入口 `appUrl`，据此完成终态交付；用户要求资源 ID 时，将已验证的 `formUuid` 写入终态 artifact 的可见 `description`。


输出示例（已有两个字段，补齐一个字段）：

```json
{"success":true,"appType":"APP_XXX","formUuid":"FORM-YYY","completedStages":["read_target","verify_ownership","compare_fields","add_missing_fields","save_schema","verify_final_schema"],"requestedFieldCount":3,"existingFieldCount":2,"addedFieldCount":1,"finalFieldCount":3,"recoveredBlankShell":false,"url":"{base_url}/APP_XXX/workbench/FORM-YYY","formUrl":"{base_url}/APP_XXX/workbench/FORM-YYY","appUrl":"{base_url}/APP_XXX/workbench"}
```

`resume` 的终态交付沿用相同入口映射：应用级交付选择 `appUrl` / `app_home`，表单级交付选择 `formUrl` / `form`；`url` 继续兼容表单入口。

## 高级模式

高级模式只在用户明确要求或普通 create/update 不足时使用，执行前必须先读取 [advanced-form-modes.md](references/advanced-form-modes.md)。

| 模式 | 命令 | 何时使用 |
|------|------|------|
| `patch` | `openyida create-form patch <appType> <formUuid> <patchJsonOrFile>` | 受控修改底层 Schema；字段事件动作必须用 `field-action` 并确认 `designerBindingFound: true`、`readbackVerified: true` |
| `rule` | `openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>` | 字段显示隐藏、只读、自动赋值、onChange 带出 |
| `validation` | `openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>` | 字段校验规则，优先用内置校验，复杂场景再用 customValidate |
| `bind-datasource` | `openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>` | 选项字段绑定远程搜索数据源；成功输出 `resolved` |
| `add-option` | `openyida create-form add-option <appType> <formUuid> <fieldLabelOrId> <option1> [option2] ...` | 给已有选项字段追加选项；成功输出 `resolved` |

## 字段定义 JSON 高频范式

字段 JSON 详细属性、布局组件、update changes 和完整字段类型表见 [field-definition-guide.md](references/field-definition-guide.md)。

常用结构：

```json
[
  { "type": "Divider", "title": "基本信息", "dividerType": "light-left-bar" },
  {
    "type": "ColumnContainer",
    "layout": "6:6",
    "children": [
      [{ "type": "TextField", "label": "申请人", "required": true }],
      [{ "type": "DepartmentSelectField", "label": "所属部门" }]
    ]
  },
  { "type": "Divider", "title": "业务信息", "dividerType": "light-left-bar" },
  { "type": "TextField", "label": "事项名称", "required": true },
  { "type": "SelectField", "label": "优先级", "dataSource": ["P0", "P1", "P2"] },
  { "type": "AttachmentField", "label": "附件" }
]
```

常用 update changes：

```json
[
  { "action": "add", "field": { "type": "TextField", "label": "备注" }, "after": "事项名称" },
  { "action": "update", "label": "优先级", "changes": { "required": true } },
  { "action": "delete", "label": "旧字段" }
]
```

## 常用字段类型

| 字段类型 | 说明 | 特殊说明 |
|------|------|------|
| `TextField` / `TextareaField` | 单行 / 多行文本 | 最常用文本字段 |
| `NumberField` | 数字 | 金额、数量、分值 |
| `DateField` / `CascadeDateField` | 日期 / 日期区间 | 流程表单常用 |
| `SelectField` / `RadioField` | 单选 | 创建字段 JSON 时必须提供 `dataSource`，不要省略或只写旧式 `options` |
| `CheckboxField` / `MultiSelectField` | 多选 | 创建字段 JSON 时必须提供 `dataSource`，不要省略或只写旧式 `options` |
| `EmployeeField` | 成员 | 细节见 [employee-field.md](references/employee-field.md) |
| `DepartmentSelectField` | 部门 | 支持 `multiple` |
| `AttachmentField` / `ImageField` | 附件 / 图片 | 表单内上传能力 |
| `TableField` | 子表 | `children` 必填，子表不能嵌套子表 |
| `AssociationFormField` | 关联表单 | 细节见 [association-form-field.md](references/association-form-field.md) |
| `SerialNumberField` | 流水号 | 细节见 [serial-number-field.md](references/serial-number-field.md) |
| `Divider` / `ColumnContainer` | 分组 / 局部多列 | 细节见 [field-definition-guide.md](references/field-definition-guide.md) |

## 参考文件

| 文档 | 何时读取 |
|------|------|
| [field-definition-guide.md](references/field-definition-guide.md) | 需要完整字段属性、布局组件、update changes 或字段类型表时 |
| [advanced-form-modes.md](references/advanced-form-modes.md) | 使用 patch / rule / validation / bind-datasource 高级模式前必须读取 |
| [form-field-properties.md](references/form-field-properties.md) | 需要字段属性细节或平台属性映射时 |
| [employee-field.md](references/employee-field.md) | 成员字段配置 |
| [association-form-field.md](references/association-form-field.md) | 关联表单字段配置 |
| [serial-number-field.md](references/serial-number-field.md) | 流水号字段配置 |

## 注意事项

- `appType` 必须来自已创建应用或用户提供
- 字段类型必须使用标准组件名，如 `TextField`、`SelectField`
- 电话字段固定使用 `TextField` 加正则自定义校验；读取已有 Schema 时可以识别历史 `PhoneField`，但不得把它作为新建或 patch 能力。
- `SelectField`、`MultiSelectField`、`RadioField`、`CheckboxField` 固定选项必须提供 `dataSource`；远程选项字段必须提供 `remoteDataSource` 或通过 `bind-datasource` 配置，不要生成无选项源的字段 JSON。
- `TableField` 必须提供 `children`，且子表不能嵌套子表
- `AssociationFormField` 必须提供 `associationForm`
- update / add-option / bind-datasource / validation / rule 按字段 `label`、`fieldId` 或 `tableLabel + label` 解析并要求唯一命中；如果有重名字段，先看命令返回的 `diagnostics[].candidates`，可用 `tableLabel` 或 `fieldId` 缩小范围，仍不明确时再用 `get-schema --compact --resolve-fields`。

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| create 返回失败 | 检查 appType 是否正确，确认登录态有效 |
| 字段级命令找不到字段 | 先看命令 JSON 的 `diagnostics[].candidates` 修正 label、补 `tableLabel` 或改用已知 `fieldId`；仍不明确时再用 `openyida get-schema --compact --resolve-fields` |
| 字段类型不支持 | 检查字段类型是否在支持的 19 种业务字段或已验证展示布局组件列表中 |
| 子表字段创建失败 | 确认 `children` 数组格式正确，子表字段不能嵌套子表 |
| 返回 JSON 中无 formUuid | 不要猜测 formUuid，重新执行命令获取 |


应用整体设计可使用[应用风格模板或自由创意](../yida-design/references/application-style-library.md)。导航、自定义页面、表单与详情继承同一设计语言；自由创意从业务推演，不强制选模板。模板中的原生布局 JSON 只提供结构，须填入真实字段并核对间距和响应式，禁止加载代码注入样式。
