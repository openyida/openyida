---
name: yida-form-permission
description: 查询、新增和修改宜搭表单权限组，配置成员范围、数据范围、操作权限和字段权限；支持差异预览和已有矩阵引用。
---

# 表单权限配置

## 适用范围

查询、新增或修改表单权限组时使用。

查询按每页 20 条安全翻页；达到安全上限、分页重复或响应结构不完整时必须停止，不把不完整列表当作全量权限组。

CLI 优先读取原始 `roleData`；平台只返回 `roleMembers` 时，将可完整还原的成员规则转换为 `roleData`，保留包含、排除及矩阵配置。查询返回 `roleDataComplete: false` 表示成员结构缺失、无效或含无法安全转换的值，不得据此更新已有权限组。遇到 `SAVE_PERMISSION_BEFORE_UNKNOWN` 时保持零写入。

| 类型 | 管什么 | 参数 |
|------|--------|------|
| VIEW | 查看和管理已有数据 | 默认 `FORM_PACKAGE_VIEW` |
| START | 发起和提交 | 查询、保存、复核都传 `--package-type FORM_PACKAGE_START` |

## 按任务选择

| 要做什么 | 读取说明 |
| --- | --- |
| 配成员、角色、可访问的数据和字段 | [成员、数据范围与字段权限](references/row-field-access.md) |
| 按字段、当前登录人、部门组合筛选数据 | [按字段组合数据范围](references/row-field-access.md#按字段组合数据范围) |
| 复制、重命名或删除权限组 | [权限组管理](references/management.md#权限组管理) |
| 查询或维护组织矩阵 | [组织矩阵管理](references/management.md#组织矩阵管理)，先核对组织管理权限 |

各维度按用户要求独立配置。普通数据条件不要求配置矩阵。

## 铁律

1. **目标必须唯一**：优先使用查询结果中的 `packageUuid`，通过 `--package-uuid` 精确更新；未提供 UUID 时才按 `DEFAULT`、`MANAGER` 或 `MATRIX` 匹配。匹配 0 个或多个、分页无法完整结束时停止。
   `packageUuid` 只属于本次查询的 `formUuid`；多表单配置必须逐表查询，禁止跨表单复用，也禁止跨权限组类型复用。
2. **未知操作键必须保留**：目标组的 `operatePermit` 包含 CLI 白名单外键时，停止 action-permission 修改；修改其他维度时原样保留整个 `operatePermit`。
3. **成员替换必须展示损失**：执行 `--all-members` 或 `--matrix` 前展示完整 roleData before/after 和会移除的 `DEPARTMENT`、`ROLE`、`PARAM`、`MANAGER` 等条目。CLI 要求确认时，用户确认后追加 `--confirm-member-replace`。
4. **整块保存必须先确认**：action-permission 会整块替换为 operations 中值为 true 的白名单键；执行前展示完整 before/after。
5. **平台状态是真相源**：本技能不使用 memory 保存权限状态；CLI 保存前完整查询、只写一次，保存后按 packageUuid 精确回读。目标维度不一致或非目标维度漂移时报 `verify failed`；无法恢复 create UUID、精确目标暂不可见或回读失败时报 `verify unknown`，两者都不得宣称成功或直接重放写入。

## 标准流程

1. **查询**：运行 `openyida get-permission <appType> <formUuid>`；查 START 时加上表中的类型参数。记录目标组名称、packageUuid，以及 roleData、dataPermit、operatePermit、fieldPermit 四个维度。
2. **差异预览**：输出明确的 `before` 与 `after`；未修改的 roleData、dataPermit、operatePermit、fieldPermit 标记为“保持原值”。
3. **确认**：向用户确认唯一目标、成员损失、操作权限整块替换和数据范围变化。
4. **写入**：只传需要修改的维度，更新时追加 `--package-uuid <packageUuid>`，执行一次 `save-permission`。
5. **重查验证**：CLI 会自动按 packageUuid 做 canonical readback，并返回 `verification.status=verified` 才算成功；Agent 可再用精确查询复核。`failed` 或 `unknown` 时停止且不重放。

新增权限组也先查询现有配置并展示新组的完整 after，再确认、写入和重查。

## 命令

查询全部查看权限组，或按 packageUuid 精确过滤：

```bash
openyida get-permission <appType> <formUuid>
openyida get-permission <appType> <formUuid> --package-uuid <packageUuid>
```

更新唯一权限组：

```bash
openyida save-permission <appType> <formUuid> --package-uuid <packageUuid> [选项]
```

| 选项 | 作用 |
|------|------|
| `--package-uuid <packageUuid>` | 精确选择已有权限组；不能与 `--create` 同时使用 |
| `--package-type <FORM_PACKAGE_VIEW\|FORM_PACKAGE_START>` | 指定查看或发起权限组；默认 VIEW，查询与保存必须一致 |
| `--conditions-file <file>` | 组合字段、当前用户、部门与 AND/OR 数据条件；VIEW 使用 |
| `--data-permission <json>` | 修改 dataPermit；顶层可带 `role` 选择目标组 |
| `--action-permission <json>` | 整块替换 operatePermit；顶层可带 `role` |
| `--field-permission <json>` | 修改真实 fieldPermit；顶层可带 `role` |
| `--members <userIds>` | 替换 `PERSONS` 条目并保留其他 roleData 条目 |
| `--roles <roleIds>` | 指定宜搭角色；更新时替换 ROLE 条目，保留其他成员和排除条目 |
| `--owner-field <fieldId>` | VIEW 数据范围按主表成员字段包含当前登录人限制 |
| `--field-access <fieldId:view\|edit\|hidden\|encrypt>` | 按真实 schema 配置字段；可重复 |
| `--field-default <access>` | 首次自定义字段权限时明确其他字段的权限 |
| `--dry-run` | 仅预览 before/after，零写入；使用 `--owner-field` 时另列其他待复核权限组 |
| `--all-members` | 把成员维度替换为 `DEFAULT/ALL` |
| `--matrix <json>` | 把成员维度替换为指定矩阵；与 `--members`、`--all-members` 互斥 |
| `--confirm-member-replace` | 确认会删除复合 roleData 的成员替换 |

新增权限组：

```bash
openyida save-permission <appType> <formUuid> --create --name <名称> [选项]
```

未指定 UUID 时，更新目标 role 只支持 `DEFAULT`、`MANAGER`、`MATRIX`。`--owner-field/--roles/--field-access` 更新必须指定 UUID；角色、部门等组按真实 UUID 选择。CLI 可设置 PERSONS 和 ROLE，保留其他条目；不新增 DEPARTMENT 或 PARAM 成员条目。

## 发起权限 START

```bash
openyida get-permission <appType> <formUuid> --package-type FORM_PACKAGE_START
openyida save-permission <appType> <formUuid> --package-type FORM_PACKAGE_START --create --name "指定人员发起" --members "<真实userId>"
openyida save-permission <appType> <formUuid> --package-type FORM_PACKAGE_START --package-uuid <真实packageUuid> --members "<真实userId>"
```

- 新建 START 默认允许提交（`OPERATE_CREATE`），可设置成员和字段权限。
- START 不支持已有数据的范围或矩阵配置；这些配置使用 VIEW。
- `--members` 只替换人员名单，保留全员、部门等其他成员范围。要实现“只有这些人能发起”，先检查本组和其他发起组；CLI 无法调整的范围在平台处理。
- 保存后按同一表单、权限组类型和 UUID 回读。配置已保存与真实账号的有效权限验收分别报告。

## 数据权限（VIEW）

简写 `dataRange`：

| 输入 | 写入类型 |
|------|----------|
| `ALL` | `ALL` |
| `SELF` / `ORIGINATOR` | `ORIGINATOR` |
| `DEPARTMENT` / `ORIGINATOR_DEPARTMENT` | `ORIGINATOR_DEPARTMENT` |
| `SUBORDINATE` | `SUBORDINATE` |
| `SAME_LEVEL_DEPARTMENT` | `SAME_LEVEL_DEPARTMENT` |
| `SUBORDINATE_DEPARTMENT` | `SUBORDINATE_DEPARTMENT` |
| `FREE_LOGIN` | `FREE_LOGIN` |
| `CUSTOM_DEPARTMENT` | `CUSTOM_DEPARTMENT` |
| `CUSTOM` / `FORMULA` | `FORMULA` |
| `MATRIX` | `MATRIX` |

组合范围传完整 dataPermit 对象。`rule` 必须非空；启用 `CUSTOM_DEPARTMENT` 时 `customDepartmentData.departmentIds` 必须非空；启用 `FORMULA` 时必须提供非空 `formulaData`；启用 `MATRIX` 时 roleData 必须选择有效的 matrixId 和 columnId，反向也成立。

`--data-permission` 可传完整 `rule`、`customDepartmentData` 和 `formulaData`。自定义条件沿用平台查询到的结构，使用真实字段和部门 ID；不要用空条件或某一种成员字段规则代替用户要求的条件组合。

完整组合对象示例（展示创建人范围、指定部门和自定义条件的配置位置）：

```json
{
  "role":"DEFAULT",
  "rule":[
    {"type":"ORIGINATOR","value":"y"},
    {"type":"CUSTOM_DEPARTMENT","value":"y"},
    {"type":"FORMULA","value":"y"}
  ],
  "customDepartmentData":{"departmentIds":["<真实部门ID>"],"drillDown":"n"},
  "formulaData":{
    "condition":"AND",
    "ruleId":"group-example",
    "rules":[{
      "id":"<真实主表成员字段ID>",
      "fieldId":"<真实主表成员字段ID>",
      "componentType":"EmployeeField",
      "type":"EmployeeField",
      "name":"成员字段",
      "label":"成员字段",
      "op":"contain",
      "value":"${loginUser}",
      "ruleValue":"${loginUser}",
      "extValue":"field",
      "valueType":"value",
      "entityType":"Default",
      "filterType":"bizField",
      "ruleId":"item-example",
      "parentId":"group-example"
    }]
  }
}
```

ID、名称及条件按实际查询结果替换；示例的成员字段条件只是一个选项，不能代替其他字段或条件组合。条件组／条目的 ID 与父子关系须完整保留，不能用空 `rules` 开启 FORMULA。对象传入 `--data-permission` 时会替换该组完整 dataPermit，必须先展示 before/after，保留用户未要求变更的范围。

### 匿名提交的 FREE_LOGIN 门禁

公开访问自定义页面向普通表单匿名提交时，目标表单 `DEFAULT` 权限组的 `dataPermit.rule` 必须包含 `{"type":"FREE_LOGIN","value":"y"}`。它只是三项前置门禁之一；显示页和目标表单还必须分别满足 `isOpen === 'y'`。完整运行时契约见[公开访问（匿名态）提交](../yida-canvas-custom-page/references/data-bridge-guide.md#公开访问匿名态提交)。

配置时必须先查询并锁定 `DEFAULT` 组的 `packageUuid`，复制其完整 `dataPermit`，只在原有 `rule` 中补入 `FREE_LOGIN`，保留 `ORIGINATOR` 及其他已有规则、`customDepartmentData`、`formulaData` 等非目标内容；不得用固定的 `ORIGINATOR + FREE_LOGIN` 模板覆盖现网规则。保存后按同一 `packageUuid` 回读，确认 `FREE_LOGIN` 存在且其他规则未漂移。

## 操作权限

`operations` 至少有一个值为 true 的操作。当前 CLI 白名单为：

`OPERATE_VIEW`、`OPERATE_EDIT`、`OPERATE_DELETE`、`OPERATE_HISTORY`、`OPERATE_COMMENT`、`OPERATE_PRINT`、`OPERATE_CREATE`、`OPERATE_BATCH_EDIT`、`OPERATE_BATCH_EXPORT`、`OPERATE_BATCH_IMPORT`、`OPERATE_BATCH_DELETE`、`OPERATE_BATCH_PRINT`、`OPERATE_BATCH_DOWNLOAD`、`OPERATE_BATCH_DOWNLOAD_QRCODE`。

平台出现白名单外键时，本技能不推断其语义，也不通过 action-permission 删除它。

## 字段权限

全部字段沿用表单状态：

```json
{ "fieldRange": "FORM" }
```

自定义字段权限使用真实 `fieldStatus` 结构：

```json
{
  "role": "DEFAULT",
  "fieldRange": "CUSTOM",
  "fieldStatus": [
    {
      "label": "客户名称",
      "fieldName": "textField_xxx",
      "componentName": "TextField",
      "value": "FORM_FIELD_VIEW"
    }
  ]
}
```

`value` 支持 `FORM_FIELD_VIEW`、`FORM_FILED_EDIT`（平台原始拼写）、`FORM_FIELD_HIDDEN`、`FORM_FIELD_ENCRYPT`。修改前从查询结果复制真实 label、fieldName 和 componentName，只改变目标项的 value。

## 失败处理

| 结果 | 动作 |
|------|------|
| 查询为空、目标不唯一、分页不完整或 UUID 不存在 | 零写入；展示名称/packageUuid，并让用户缩小目标或改在平台处理 |
| 登录态或权限失败 | 停止；运行 `openyida auth status` 后由用户处理账号或组织 |
| 参数或结构校验失败 | 零写入；修正 rule、部门 ID、formulaData、矩阵或 fieldStatus |
| 保存失败 | 停止，不重复写入；保留 before 和错误响应 |
| 写后不一致 | `SAVE_PERMISSION_VERIFY_FAILED`；报告 expected/actual，停止且不宣称完成 |
| 写后无法精确确认 | `SAVE_PERMISSION_VERIFY_UNKNOWN`；先精确查询，禁止直接重放写入 |
| 网络超时 | 先重查目标状态；只有证明未写入后才允许用户确认重试 |

## 明确不支持

新操作键、部门/参数成员创建和 permission-v2。权限组的复制、重命名、删除以及组织矩阵操作按上方管理说明执行；START 的支持范围见上文。
