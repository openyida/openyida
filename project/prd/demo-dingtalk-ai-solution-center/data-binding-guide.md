# 页面数据绑定指南

`project/pages/src/demo-dingtalk-ai-solution-center.oyd.jsx` 已经内置数据接入层。

默认行为：

- `FORM_CONFIG` 为空时，页面使用示例数据。
- 填入真实 `formUuid` 和 `fieldId` 后，页面在 `didMount` 自动读取宜搭表单。
- 任一读取失败时，页面回退到示例数据，并弹出提示。

## 1. 创建表单

按 `openyida-build-plan.md` 创建 7 张表单。

## 2. 导出 Schema

```bash
openyida get-schema APP_XXX FORM_CUSTOMER_XXX > .cache/solution-center/customer-schema.json
openyida get-schema APP_XXX FORM_VISIT_XXX > .cache/solution-center/visit-schema.json
openyida get-schema APP_XXX FORM_DEMO_XXX > .cache/solution-center/demo-schema.json
openyida get-schema APP_XXX FORM_RISK_XXX > .cache/solution-center/risk-schema.json
openyida get-schema APP_XXX FORM_WEEKLY_XXX > .cache/solution-center/weekly-schema.json
```

## 3. 填字段映射

参考 `field-map.template.json`，把每个字段 label 对应的真实 `fieldId` 填入页面源码顶部的 `FORM_CONFIG`。

推荐先用脚本自动生成：

```bash
node project/prd/demo-dingtalk-ai-solution-center/generate-form-config.js \
  --schemas-dir .cache/solution-center \
  --created-forms project/prd/demo-dingtalk-ai-solution-center/created-forms.local.json
```

脚本会输出 `form-config.local.js`，其中包含可复制到页面源码顶部的 `FORM_CONFIG`。如果某个字段没有自动匹配，会在终端输出 warning，按 label 手工补齐即可。

示例：

```javascript
var FORM_CONFIG = {
  customer: {
    formUuid: 'FORM-ABC',
    fields: {
      customerName: 'textField_xxx',
      industry: 'selectField_xxx',
      owner: 'employeeField_xxx',
      stage: 'selectField_xxx',
      amount: 'numberField_xxx',
      intentLevel: 'selectField_xxx',
      demands: 'multiSelectField_xxx',
      status: 'selectField_xxx'
    }
  }
};
```

## 4. 数据读取口径

页面读取以下表单：

| 视图 | 表单 |
| --- | --- |
| 客户拜访工作台 | 客户拜访 |
| 拜访推进漏斗 | 客户拜访 |
| 主管大盘 | 客户档案、客户拜访、Demo 实例、风险客户、SA 周报、拜访纪要 |
| 个人状态 | 客户档案、客户拜访、Demo 实例、风险客户、SA 周报 |
| 风险客户 | 风险客户 |

## 5. 当前限制

- 当前只读每张表前 100 条数据，适合样板演示；正式上线需要加分页或按时间筛选。
- 客户/方案引用第一版使用文本字段，正式版本建议升级为关联表单。
- 主管看板健康度默认由准备率、纪要率、下一步明确率推导；如果有 `SA 周报` 数据，会优先使用周报中的三个率。
- 会后纪要沉淀率优先参考 `拜访纪要` 表；未配置纪要表时，会退回使用拜访记录中的 AI 摘要字段做演示态估算。

## 6. 导入样例数据

字段映射完成后，可以用 `seed-solution-center.js` 把 `seed-records.logical.json` 转成真实 `fieldId` 数据并导入表单。

先 dry-run：

```bash
node project/prd/demo-dingtalk-ai-solution-center/seed-solution-center.js \
  --app-type APP_XXX \
  --form-config project/prd/demo-dingtalk-ai-solution-center/form-config.local.js \
  --created-forms project/prd/demo-dingtalk-ai-solution-center/created-forms.local.json \
  --user-map project/prd/demo-dingtalk-ai-solution-center/user-map.local.json
```

确认后执行：

```bash
node project/prd/demo-dingtalk-ai-solution-center/seed-solution-center.js \
  --app-type APP_XXX \
  --form-config project/prd/demo-dingtalk-ai-solution-center/form-config.local.js \
  --created-forms project/prd/demo-dingtalk-ai-solution-center/created-forms.local.json \
  --user-map project/prd/demo-dingtalk-ai-solution-center/user-map.local.json \
  --execute
```

成员字段需要 userId。可以提供 `user-map.local.json`：

```json
{
  "林晨": "userId1",
  "周岚": "userId2",
  "陈越": "userId3"
}
```

或使用 `--default-user-id <userId>` 将所有样例负责人映射到同一个演示账号。
