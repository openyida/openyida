---
name: yida-form-permission
description: 表单权限组管理。查询、新增权限组，配置成员/数据权限/操作权限。
---

# 表单权限配置

## 查询权限组

```bash
openyida get-permission <appType> <formUuid>
```

## 更新权限组

```bash
openyida save-permission <appType> <formUuid> [选项]
```

| 选项 | 说明 |
|------|------|
| `--data-permission <json>` | 修改数据权限范围 |
| `--action-permission <json>` | 修改操作权限（完全替换，只保留 true 的项） |
| `--members <userIds>` | 修改成员，多个 userId 逗号分隔 |

### 数据权限 `dataRange` 可选值

| 值 | 说明 |
|----|------|
| `ALL` | 全部数据 |
| `SELF` / `ORIGINATOR` | 本人提交 |
| `DEPARTMENT` / `ORIGINATOR_DEPARTMENT` | 本部门提交 |
| `SAME_LEVEL_DEPARTMENT` | 同级部门 |
| `SUBORDINATE_DEPARTMENT` | 下级部门 |

### 操作权限 key

`OPERATE_VIEW`、`OPERATE_EDIT`、`OPERATE_DELETE`、`OPERATE_HISTORY`、`OPERATE_COMMENT`、`OPERATE_PRINT`、`OPERATE_CREATE`、`OPERATE_BATCH_EDIT`、`OPERATE_BATCH_EXPORT`、`OPERATE_BATCH_IMPORT`、`OPERATE_BATCH_DELETE`、`OPERATE_BATCH_PRINT`、`OPERATE_BATCH_DOWNLOAD`、`OPERATE_BATCH_DOWNLOAD_QRCODE`

## 新增权限组

```bash
openyida save-permission <appType> <formUuid> --create --name <名称> [选项]
```

示例：

```bash
openyida save-permission APP_XXX FORM-XXX \
  --create --name "部门数据查看组" \
  --members "54255850977641" \
  --data-permission '{"dataRange":"ORIGINATOR_DEPARTMENT"}' \
  --action-permission '{"operations":{"OPERATE_VIEW":true}}'
```

## 限制

- 字段权限暂不支持，需通过宜搭管理后台手动配置
- 不支持自定义部门和自定义过滤条件
