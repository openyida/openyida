# db-seq-fix - Sequence 起始值修复工具

## 功能说明

`db-seq-fix` 命令用于检测和修复宜搭专属数据库中 PostgreSQL Sequence 的起始值问题。

### 问题背景

在 PostgreSQL 中，使用 `bigserial` 类型作为主键时，会自动创建一个 Sequence 来生成自增 ID。当数据库迁移或数据同步时，如果 Sequence 的起始值小于表中已有的最大 ID，会导致主键冲突错误。

### 解决方案

`db-seq-fix` 会自动：
1. 查询每个表的最大主键 ID
2. 检查对应 Sequence 的当前值
3. 如果 Sequence 值小于最大 ID，自动修复为 `MAX(id) + 1`

## 使用方法

### 检查 Sequence 状态

```bash
openyida db-seq-fix
```

输出示例：
```
📊 Sequence 状态检测报告
──────────────────────────────────────────────────────────────────────

⚠️  需要修复 (2 个)

   📋 alibpms_app_cm_operator_record
      Sequence: pro_operator_record_id_seq
      最大 ID: 12345
      当前 Sequence 值: 1
      建议起始值: 12346

   📋 tianshu_form_data
      Sequence: form_data_id_seq
      最大 ID: 67890
      当前 Sequence 值: 1
      建议起始值: 67891

✅ 状态正常 (6 个)

   ✓ tianshu_data_form_version (最大 ID: 100, 当前 Sequence 值: 101)
   ✓ tianshu_form_data_operation_log (最大 ID: 500, 当前 Sequence 值: 501)
   ...

──────────────────────────────────────────────────────────────────────

💡 发现 2 个 Sequence 需要修复
   运行 openyida db-seq-fix --fix 进行修复
```

### 预览修复 SQL

```bash
openyida db-seq-fix --dry-run
```

输出示例：
```
   📋 alibpms_app_cm_operator_record
      Sequence: pro_operator_record_id_seq
      最大 ID: 12345
      当前 Sequence 值: 1
      建议起始值: 12346
      修复 SQL: ALTER SEQUENCE pro_operator_record_id_seq RESTART WITH 12346;
```

### 自动修复

```bash
openyida db-seq-fix --fix
```

输出示例：
```
正在修复 2 个 Sequence...
  修复 alibpms_app_cm_operator_record...
  修复 tianshu_form_data...
修复完成

📊 Sequence 状态检测报告
──────────────────────────────────────────────────────────────────────

✅ 状态正常 (8 个)

   ✓ alibpms_app_cm_operator_record (最大 ID: 12345, 当前 Sequence 值: 12346)
   ✓ tianshu_form_data (最大 ID: 67890, 当前 Sequence 值: 67891)
   ...

──────────────────────────────────────────────────────────────────────

✨ 所有 Sequence 状态正常
```

## 命令参数

| 参数 | 说明 |
|------|------|
| 无参数 | 检查所有 Sequence 状态（默认） |
| `--fix` | 自动修复有问题的 Sequence |
| `--dry-run` | 预览修复 SQL，不实际执行 |
| `--help` | 显示帮助信息 |

## 支持的表

`db-seq-fix` 支持以下表的 Sequence 检测和修复：

| 表名 | Sequence 名称 | 主键字段 |
|------|---------------|----------|
| alibpms_app_cm_operator_record | pro_operator_record_id_seq | id |
| tianshu_data_form_version | data_form_version_id_seq | id |
| tianshu_form_data | form_data_id_seq | id |
| tianshu_form_data_operation_log | operation_log_id_seq | id |
| tianshu_form_data_stash | form_data_stash_id_seq | id |
| tianshu_form_remark | form_remark_id_seq | id |
| tianshu_instance_relation | instance_relation_id_seq | id |
| tianshu_proc_inst_carbon | proc_inst_carbon_id_seq | id |

## 注意事项

1. **执行权限**：需要具有 ALTER SEQUENCE 权限
2. **生产环境**：建议先使用 `--dry-run` 预览，确认无误后再执行 `--fix`
3. **并发写入**：修复过程中如果有并发写入，可能导致短暂的 ID 分配异常，建议在低峰期执行
4. **备份数据**：修复前建议备份数据库

## 与环境检测结合

在环境检测自动建表后，可以运行 `db-seq-fix` 确保 Sequence 起始值正确：

```bash
# 环境检测（自动建表）
openyida env

# 检查并修复 Sequence
openyida db-seq-fix --fix
```

## 相关命令

- `openyida db-index` - 检测和分析数据库索引
- `openyida env` - 检测环境和登录态