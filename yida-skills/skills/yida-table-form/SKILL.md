---
name: yida-table-form
description: 宜搭自定义页面表格形式批量表单提交技能。支持动态增删行、行内多字段编辑、行内验证、Excel 粘贴导入、草稿暂存（localStorage）、批量调用 saveFormData 提交。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - low-code
    - custom-page
    - table
    - batch-submit
---

# 宜搭自定义页面表格表单提交技能

## 概述

在批量录入同类数据（如批量添加商品、批量录入考勤、批量创建任务）的场景下，标准表单页面每次只能提交一条记录，效率低下。本技能提供表格形式的批量表单提交方案，支持行内编辑、验证和批量提交。

---

## 何时使用

- 批量录入同类数据（如：批量添加商品、批量录入考勤）
- Excel 式数据编辑体验
- 行内编辑 + 批量保存

---

## 核心数据结构

```javascript
// 每行数据结构
{
  id: 'temp_' + Date.now(),   // 临时行 ID（提交后替换为 formInstId）
  fieldA: '',                  // 各字段值
  fieldB: '',
  _status: 'valid',            // 'valid' | 'invalid' | 'submitting' | 'submitted'
  _errors: {},                 // { fieldA: '必填', fieldB: '格式错误' }
}
```

---

## 完整示例代码

完整示例代码见 [`examples/table-form-batch-submit.js`](./examples/table-form-batch-submit.js)

---

## 功能说明

### 动态增删行

- 点击「+ 添加行」在表格末尾新增空行
- 点击行末的 🗑 按钮删除该行（已提交成功的行不可删除）
- 表格始终保留至少一行

### Excel 粘贴导入

点击「📋 粘贴 Excel 数据」后，将从 Excel 复制的内容粘贴到剪贴板，系统自动按 Tab 分隔解析列，按换行分隔解析行，追加到现有数据后。

> **注意**：列顺序需与 `COLUMNS` 定义一致。

### 行内验证

提交前自动验证所有行：
- 必填字段为空 → 标红并显示错误信息
- 验证失败的行背景变为浅红色
- 全部通过后才发起提交请求

### 草稿暂存

每次修改单元格后自动将数据保存到 `localStorage`，key 为 `yida_table_form_draft_{formUuid}`。刷新页面后自动恢复草稿。提交全部成功后自动清除草稿。

### 批量提交

使用 `Promise.all` 并发提交所有行，每行独立调用 `saveFormData`：
- 提交中的行显示 loading 状态
- 提交成功的行背景变绿，显示 ✓
- 提交失败的行背景变红，显示错误信息，可修正后重新提交

---

## 自定义配置

修改文件顶部的配置区即可适配不同表单：

```javascript
var FORM_UUID = 'FORM-XXX';   // 替换为实际表单 UUID

var COLUMNS = [
  // type 支持：'text' | 'select' | 'date'
  { label: '字段名', field: 'fieldId_xxx', type: 'text', required: true },
  { label: '下拉字段', field: 'selectField_xxx', type: 'select', required: false,
    options: ['选项A', '选项B', '选项C'] },
];
```

---

## 与其他技能配合

| 步骤 | 技能 | 说明 |
| --- | --- | --- |
| 1 | `yida-get-schema` | 获取表单字段 ID，填入 `COLUMNS` 配置 |
| 2 | **本技能** | 编写表格表单页面代码 |
| 3 | `yida-publish-page` | 发布自定义页面 |
