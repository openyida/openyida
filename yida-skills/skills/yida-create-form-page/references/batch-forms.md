# 并行创建表单

多个普通表单使用一次批量命令。字段配置可同时编写；CLI 校验依赖后，默认最多同时创建 3 张表单，每张完成后回读字段。应用、主题与导航排序由主流程统一处理。

```bash
openyida create-form batch <appType> .cache/openyida/<项目名>/forms.json --json
```

## 任务文件

```json
{
  "forms": [
    { "key": "customer", "title": "客户", "fieldsFile": "customer-fields.json" },
    { "key": "product", "title": "商品", "fieldsFile": "product-fields.json" },
    { "key": "order", "title": "订单", "fieldsFile": "order-fields.json", "dependsOn": ["customer", "product"] }
  ]
}
```

`fieldsFile` 相对任务文件所在目录，也可使用 `fields` 直接填写字段定义。每项可设置 `icon`、`locale`；已有完整表单填写 `formUuid`，CLI 回读并复用。

客户和商品同时创建。订单的前置表单完成后开始创建；其他独立任务继续执行。依赖环、未知依赖、重复 key 和无效字段会在创建前报错。

## 关联字段

在字段配置中，用以下对象引用同批次的真实 ID，CLI 自动补入依赖：

```json
{
  "type": "AssociationFormField",
  "label": "客户",
  "associationForm": {
    "appType": "APP_XXX",
    "formUuid": { "$form": "customer" },
    "formTitle": "客户",
    "mainFieldId": { "$form": "customer", "field": "客户名称" },
    "mainFieldLabel": "客户名称",
    "mainComponentName": "TextField"
  }
}
```

`field` 按字段名称或 ID 精确匹配，重名时使用 ID。关联表单完成且字段回读成功后，才解析引用并创建当前表单。普通关联字段属性沿用 [关联表单配置](association-form-field.md)。

## 检查与恢复

- `--check` 只校验字段和依赖，返回可并行的分组。
- `--concurrency 1..4` 设置并发上限，默认 3。
- 结果保存在任务文件旁的 `.state.json`，包含每张表单的 ID、字段和状态。主流程从中汇总资源上下文，再配置导航。
- 相同任务再次执行时，成功表单回读复用。失败及中断任务保留原状态，其依赖标记为 blocked；独立任务继续。
- 恢复失败任务前，核对已创建资源并修复。准备新任务文件时，用 `formUuid` 复用完整表单，仅为确认尚未创建的表单保留创建任务。
- `.lock` 防止同一任务重复启动。进程异常退出遗留锁时，确认原进程已结束、核对已创建资源后再清理。

已有表单的字段修改仍使用 update/patch 等命令；不同表单可分别更新，同一张表单由一个任务维护。流程审批按 `yida-create-process` 执行，等待其依赖的表单就绪后再配置。
