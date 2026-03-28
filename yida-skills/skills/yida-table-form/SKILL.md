---
name: yida-table-form
description: 表格形式批量表单提交。动态增删行、行内编辑验证、Excel 粘贴导入、草稿暂存、批量 saveFormData。
---

# 表格表单批量提交

> 适用于批量录入同类数据：批量添加商品、批量录入考勤等。

## 核心数据结构

```javascript
{
  id: 'temp_' + Date.now(),
  fieldA: '',
  _status: 'valid',    // 'valid' | 'invalid' | 'submitting' | 'submitted'
  _errors: {},          // { fieldA: '必填' }
}
```

## 自定义配置

```javascript
var FORM_UUID = 'FORM-XXX';
var COLUMNS = [
  { label: '字段名', field: 'fieldId_xxx', type: 'text', required: true },
  { label: '下拉字段', field: 'selectField_xxx', type: 'select', options: ['A', 'B'] },
];
```

## 功能

- **动态增删行**：添加/删除行，始终保留至少一行
- **Excel 粘贴导入**：按 Tab 分列、换行分行，列顺序需与 COLUMNS 一致
- **行内验证**：提交前自动验证，失败行标红
- **草稿暂存**：自动保存到 localStorage，刷新恢复
- **批量提交**：`Promise.all` 并发，每行独立调用 `saveFormData`

完整示例代码见 [`examples/table-form-batch-submit.js`](./examples/table-form-batch-submit.js)
