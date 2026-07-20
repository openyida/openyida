---
name: yida-create-form-page
description: 表单页面创建与更新，支持 19 种业务字段和 Divider、ColumnContainer 等表单展示布局组件，PageSection/GroupContainer 仅少量特殊场景使用；支持联动规则和数据源绑定。适用于新建表单、设计表单结构、添加或修改表单字段；schema-managed 表单由根技能或明确 context 路由到 schema workflow。
---

# 表单页面创建与更新

> 资源边界：本技能只处理普通 OpenYida 资源；若根技能、上下文或 CLI guard 显示目标是 schema-managed，停止本技能并走 schema workflow；目标不明时回到根技能确认。
> direct/standalone 路径才可执行本技能；schema-managed 路径必须回到 schema validate → plan → apply，不在本技能内降级写入。

## Resource-First create/update 判定

执行本技能前必须先解析 app/form resource context：

- 已有目标 `formUuid`、表单 URL、bound form，或 workspace cache/config 中可确认的 standalone form 时，字段结构诉求默认走 update/patch/rule/bind-datasource 模式；不要再 create 同名或同类表单。
- bound form/page 只是默认候选，不是锁定目标；如果当前会话绑定表单或页面 A，但用户本轮明确要求修改 B 的字段，必须先解析 B 对应的表单 `formUuid`。B 能唯一解析时改 B；B 无法唯一解析或字段归属不清时问用户；禁止默认改 A。
- 已有目标 app 但缺少业务数据表，且用户明确要求“增加客户表 / 新建订单表 / 新增数据收集入口”等，才使用 create 模式创建新表单。
- 用户给页面 URL 或自定义页面 `formUuid` 且诉求是优化页面 UI 时，改走 `yida-custom-page` + `yida-publish-page`；不要创建表单。
- 多个表单候选时按根技能来源优先级选择；同级冲突、字段目标不明或无法判断要改哪张表时才问用户。

## 严格禁止 (NEVER DO)

- 不要编造 formUuid，必须从命令返回的 JSON 中提取
- 不要在 update / patch / rule / validation / bind-datasource 模式中使用猜测的 fieldId，必须先用 `yida-get-schema` 获取
- 不要用此命令操作数据记录（增删改查），应使用 `yida-data-management`
- 不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成字段、变更、补丁、规则、数据源 JSON 文件
- 已有目标表单且用户是改字段/联动/属性时，不要创建新表单；必须走 update/patch/rule/bind-datasource。
- 不要用 `GroupContainer` / `PageSection` 承载普通业务分组；普通分组必须优先用 `Divider`

## 严格要求 (MUST DO)

- create 成功后，将 formUuid 记录到 `.cache/<项目名>-schema.json`
- update / patch / rule / validation / bind-datasource 修改已有表单前，必须先用 `openyida get-schema` 确认字段 ID 和现有结构
- 字段定义或变更定义需要落盘时，必须使用 agent 的结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/`，例如 `<projectRoot>/.cache/openyida/pm/pm-fields-team.json`
- 普通表单分组必须优先使用 `Divider`，多列排版必须通过字段 JSON 中的 `ColumnContainer` 局部表达
- **本技能不读写 memory**：formUuid 等信息输出到 stdout，通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户需要“创建表单”“新建表单”“新增字段”“修改字段”“删除字段”“修改表单结构”“字段显示隐藏联动”“onChange 自动带出”“搜索选择字段绑定数据源”时使用。

关键区分：

| 用户意图 | 选择 |
|------|------|
| 创建新表单 / 设计字段结构 | 本技能 `create` 模式 |
| 增删改字段结构 | 本技能 `update` 模式 |
| 配置 OpenYida 尚未封装的平台字段属性/动作 | 本技能 `patch` 模式，先读 [advanced-form-modes.md](references/advanced-form-modes.md) |
| 字段显示隐藏、只读、自动赋值 | 本技能 `rule` 模式，先读 [advanced-form-modes.md](references/advanced-form-modes.md) |
| 选项字段远程搜索数据源 | 本技能 `bind-datasource` 模式，先读 [advanced-form-modes.md](references/advanced-form-modes.md) |
| 表单数据记录增删改查 | `yida-data-management` |
| 字段公式、默认值、计算 | `yida-formula` |
| 流程审批规则 | `yida-process-rule` |
| 连接器动作创建 | `yida-connector` |

## 官方表单示例范式

官方示例中心的表单类能力大多用 `FormContainer + 标准字段 + 字段属性/公式/联动` 承载，少量 `RichText` 用于说明。创建或更新表单时优先按这个顺序落地：

1. 字段结构：用 `TextField`、`NumberField`、`DateField`、`EmployeeField`、`SelectField`、`TableField`、`AssociationFormField` 等标准字段表达数据模型。
2. 字段公式：计算、默认值、日期/文本转换等用字段 `valueType: "formula"`、`complexValue.formula`、`formula`，不要改写成自定义页面 JS。
3. 字段联动：显示隐藏、只读、onChange 自动赋值优先用 `rule` 模式；只有 OpenYida DSL 不覆盖的平台属性才用 `patch`。
4. 说明/示例文字：需要解释能力时可增加 `RichText` 或说明字段，但业务字段仍应保持结构化。
5. 提交后跨表/通知/流程动作不要塞进字段 JS；分别交给 `yida-integration`、`yida-process-rule` 或 `yida-connector`。

## 布局决策规则

默认表单是单列。不要为了“更高级”默认把整表改成双列，也不要用 `GroupContainer` / `PageSection` 做普通分组。

- 默认单列：字段较少、流程表单、移动端优先、长文本、说明、附件、地址、子表、审批意见、需要逐项认真填写的字段。
- 局部多列：短字段且天然成对或成组时使用 `ColumnContainer`，例如开始/结束日期、姓名/工号、部门/岗位、金额/币种、联系人/电话。
- 全局 `--layout double`：只有用户明确要求“整个表单双列”时才使用；一般更推荐在字段 JSON 内用 `ColumnContainer` 做局部多列。
- 语义分组：按业务含义分段，不按字段数量平均分。常见分组包括“基本信息”“业务信息”“时间计划”“补充材料”“审批信息”。
- Divider 样式：默认 `bold-with-thin`；显式样式按 `bold-with-thin` → `double-color-trapezoid` → `left-dot-title` → `solid` / `dashed` / `thick` / `dotted` 优先级选择；门户/强分区场景可统一显式使用 `multi-parallelograms-end`。

推荐结构：

```text
Divider > ColumnContainer > Field
Divider > Field
```

## 企业级表单质量规则

以下规则吸收自历史 `dingtalk-ai-app` 表单搭建经验：

- 字段必须先覆盖 PRD 明确要求，再按真实业务补充少量必要字段，避免堆砌冗余字段。
- 字段较多时必须用 `Divider` 做语义分组；每个分组开头都要有 `Divider`，包括第一个分组；`Divider` 不放在字段列表末尾。
- 同一张表单内所有 `Divider` 必须使用同一个 `dividerType`，标题要能概括分组下字段的共同主题。
- 完整业务应用包含多张表单时，表单之间应有业务关联；涉及数据流转的主表建议有文本型业务编号/名称字段，涉及时间、金额、数量的业务应使用日期/数值字段表达。
- 复杂业务表单应自然使用多种字段类型，例如文本、数值、日期、选择、成员/部门、附件、子表、关联表单；字段类型多样性服务于业务语义。
- `TableField` 必须提供 `children` 子字段，`AssociationFormField` 必须提供关联表单信息。
- 审批人、审批状态、审批节点等流程运行字段由流程能力承载；表单只收集业务数据。

## Divider 主题规则

表单和流程表单只按运行态主题变量消费颜色。本技能只生成表单字段 JSON，并要求 OpenYida 在存在 `Divider` 时注入必要的运行时主题样式。

- 普通业务分组：`Divider` 标题跟随应用主题，下面直接接字段或 `ColumnContainer`
- 默认 `Divider` 不写颜色属性，或保持 `colorType: "theme"`
- 表单中出现 `Divider` 时，OpenYida 必须注入 `style#yida-global-theme`，并尽可能同步到当前页面和同源 `window.top`
- 局部多列容器：保持背景克制，避免给每个列容器单独上色
- 流程表单：更偏单列和清晰分段，颜色只用于章节识别，不要做大面积品牌色块
- 自定义色：只有用户明确说“红色警示”“绿色成功态”“品牌色 #xxx”时才写 `colorType: "custom"` 和具体色值

## create 模式

仅当目标表单缺失且用户意图允许新增数据收集入口时使用。已有 `formUuid` / 表单 URL / bound form 时禁止使用 create 模式。

```bash
openyida create-form create <appType> <formTitle> <fieldsJsonOrFile> [--layout double|card] [--theme compact|comfortable] [--label-align top|left]
# 文件路径示例：.cache/openyida/<项目名或任务名>/<表单名>-fields.json
```

> 文件先用 create_file / Write / file edit tool 创建。上方路径默认从 OpenYida project 工作目录执行；如果从 workspace 根执行命令，传 `project/.cache/openyida/<项目名或任务名>/<表单名>-fields.json`。

输出：

```json
{"success":true,"formUuid":"FORM-XXX","formTitle":"用户信息表","appType":"APP_xxx","fieldCount":4,"url":"{base_url}/APP_xxx/workbench/FORM-XXX"}
```

## update 模式

已有 `formUuid` / 表单 URL / bound form 时优先使用本模式；修改字段前必须用 `openyida get-schema` 确认字段 ID 和当前结构。

```bash
openyida create-form update <appType> <formUuid> <changesJsonOrFile>
# 文件路径示例：.cache/openyida/<项目名或任务名>/<表单名>-changes.json
```

输出：

```json
{"success":true,"formUuid":"FORM-YYY","appType":"APP_XXX","changesApplied":3,"url":"{base_url}/APP_XXX/workbench/FORM-YYY"}
```

## 高级模式

高级模式只在用户明确要求或普通 create/update 不足时使用，执行前必须先读取 [advanced-form-modes.md](references/advanced-form-modes.md)。

| 模式 | 命令 | 何时使用 |
|------|------|------|
| `patch` | `openyida create-form patch <appType> <formUuid> <patchJsonOrFile>` | 受控修改底层 Schema、字段 props、动作模块、自定义校验 |
| `rule` | `openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>` | 字段显示隐藏、只读、自动赋值、onChange 带出 |
| `validation` | `openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>` | 字段校验规则，优先用内置校验，复杂场景再用 customValidate |
| `bind-datasource` | `openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>` | 选项字段绑定远程搜索数据源 |
| `add-option` | `openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...` | 给已有选项字段追加选项 |

## 字段定义 JSON 高频范式

字段 JSON 详细属性、布局组件、update changes 和完整字段类型表见 [field-definition-guide.md](references/field-definition-guide.md)。

常用结构：

```json
[
  { "type": "Divider", "title": "基本信息" },
  {
    "type": "ColumnContainer",
    "layout": "6:6",
    "children": [
      [{ "type": "TextField", "label": "申请人", "required": true }],
      [{ "type": "DepartmentSelectField", "label": "所属部门" }]
    ]
  },
  { "type": "Divider", "title": "业务信息" },
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
| `SelectField` / `RadioField` | 单选 | 固定选项用 `dataSource` |
| `CheckboxField` / `MultiSelectField` | 多选 | 固定选项用 `dataSource` |
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
- `SelectField`、`RadioField`、`CheckboxField`、`MultiSelectField` 固定选项必须提供 `dataSource`
- `TableField` 必须提供 `children`，且子表不能嵌套子表
- `AssociationFormField` 必须提供 `associationForm`
- update 模式按字段 `label` 查找；如果有重名字段，先用 `get-schema` 确认 fieldId 并使用更精确的高级模式

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| create 返回失败 | 检查 appType 是否正确，确认登录态有效 |
| update 模式找不到字段 | 先用 `openyida get-schema` 确认字段标签（label）拼写正确 |
| 字段类型不支持 | 检查字段类型是否在支持的 19 种业务字段或已验证展示布局组件列表中 |
| 子表字段创建失败 | 确认 `children` 数组格式正确，子表字段不能嵌套子表 |
| 返回 JSON 中无 formUuid | 不要猜测 formUuid，重新执行命令获取 |
