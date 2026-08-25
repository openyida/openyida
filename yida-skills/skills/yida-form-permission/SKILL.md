---
name: yida-form-permission
description: 宜搭表单权限组管理。查询、新增权限组，配置成员权限、数据权限、操作权限和字段权限。适用于控制表单数据的访问范围和操作权限。
---

# 表单权限配置

## 适用范围

用户要求查询或修改表单权限组、成员范围、数据范围、操作权限或字段权限时使用本技能。

当前 CLI 只查询和保存 `FORM_PACKAGE_VIEW` 权限组。平台模型还包含 `FORM_PACKAGE_START`，本技能不管理该类型。`get-permission` 当前只读取第 1 页、每页 20 条；输出不能代表第 21 条以后的权限组。

## 铁律

1. **目标必须唯一**：更新前按 `DEFAULT`、`MANAGER` 或 `MATRIX` 匹配权限组。匹配 0 个或多个时停止；查询返回满 20 条时也停止，因为无法证明下一页没有同 role 权限组。停止时列出名称和 packageUuid。
2. **未知操作键必须保留**：目标组的 `operatePermit` 包含 CLI 白名单外键时，停止 action-permission 修改；修改其他维度时原样保留整个 `operatePermit`。
3. **成员替换必须展示损失**：执行 `--all-members` 或 `--matrix` 前展示完整 roleData before/after 和会移除的 `DEPARTMENT`、`ROLE`、`PARAM`、`MANAGER` 等条目。CLI 要求确认时，用户确认后追加 `--confirm-member-replace`。
4. **整块保存必须先确认**：action-permission 会整块替换为 operations 中值为 true 的白名单键；执行前展示完整 before/after。
5. **平台状态是真相源**：本技能不使用 memory 保存权限状态；每次修改都查询平台并在写后重查。

## 标准流程

1. **查询**：运行 `openyida get-permission <appType> <formUuid>`，记录目标组名称、packageUuid 和四个权限维度。
2. **差异预览**：输出明确的 `before` 与 `after`；未修改的 roleData、dataPermit、operatePermit、fieldPermit 标记为“保持原值”。
3. **确认**：向用户确认唯一目标、成员损失、操作权限整块替换和数据范围变化。
4. **写入**：只传需要修改的维度，执行一次 `save-permission`。
5. **重查验证**：再次运行 `get-permission`，按写入前记录的 packageUuid 找到目标组并逐项比对。找不到目标或实际值不一致时报告验证失败。

新增权限组也先查询现有配置并展示新组的完整 after，再确认、写入和重查。

## 命令

查询前 20 个查看权限组：

```bash
openyida get-permission <appType> <formUuid>
```

更新唯一权限组：

```bash
openyida save-permission <appType> <formUuid> [选项]
```

| 选项 | 作用 |
|------|------|
| `--data-permission <json>` | 修改 dataPermit；顶层可带 `role` 选择目标组 |
| `--action-permission <json>` | 整块替换 operatePermit；顶层可带 `role` |
| `--field-permission <json>` | 修改真实 fieldPermit；顶层可带 `role` |
| `--members <userIds>` | 替换 `PERSONS` 条目并保留其他 roleData 条目 |
| `--all-members` | 把成员维度替换为 `DEFAULT/ALL` |
| `--matrix <json>` | 把成员维度替换为指定矩阵；与 `--members`、`--all-members` 互斥 |
| `--confirm-member-replace` | 确认会删除复合 roleData 的成员替换 |

新增权限组：

```bash
openyida save-permission <appType> <formUuid> --create --name <名称> [选项]
```

更新目标 role 只支持 `DEFAULT`、`MANAGER`、`MATRIX`。平台 roleData 可出现 `DEFAULT`、`MANAGER`、`PERSONS`、`DEPARTMENT`、`ROLE`、`PARAM`、`MATRIX`；CLI 不新增 `DEPARTMENT`、`ROLE` 或 `PARAM` 成员条目。

## 数据权限

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

```json
{
  "role": "DEFAULT",
  "rule": [
    { "type": "ORIGINATOR", "value": "y" },
    { "type": "CUSTOM_DEPARTMENT", "value": "y" },
    { "type": "FORMULA", "value": "y" }
  ],
  "customDepartmentData": {
    "departmentIds": ["637215248"],
    "drillDown": "n"
  },
  "formulaData": {
    "condition": "OR",
    "ruleId": "group-xxx",
    "rules": []
  }
}
```

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
| 查询为空、目标不唯一或首批返回满 20 条 | 零写入；展示名称/packageUuid，并让用户缩小目标或改在平台处理 |
| 登录态或权限失败 | 停止；运行 `openyida auth status` 后由用户处理账号或组织 |
| 参数或结构校验失败 | 零写入；修正 rule、部门 ID、formulaData、矩阵或 fieldStatus |
| 保存失败 | 停止，不重复写入；保留 before 和错误响应 |
| 写后不一致 | 报告 expected/actual，停止；不宣称完成 |
| 网络超时 | 先重查目标状态；只有证明未写入后才允许用户确认重试 |

## 明确不支持

`FORM_PACKAGE_START`、新操作键、新成员创建参数、packageUuid 直选、权限组删除/复制/重命名、矩阵 CRUD 和 permission-v2。
