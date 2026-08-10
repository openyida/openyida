---
name: yida-formula
description: 编写宜搭表单公式、字段计算和校验表达式，并查询内置函数用法。
---

# 宜搭表单公式

## 何时使用

- 配置字段默认值、自动计算、求和、日期计算或条件判断。
- 编写表单字段自定义校验。
- 查询宜搭公式函数和语法。
- 检查现有公式 → 使用 `yida-formula-evaluate`。
- 提交后跨表增删改 → 使用 `yida-business-rule` 或 `yida-integration`。

## 核心规则

1. 公式写在普通字段的属性中；宜搭没有独立的“公式字段”组件。
2. 字段引用写成 `#{fieldId}`，子表字段写成 `#{tableFieldId.childFieldId}`。
3. `fieldId` 必须来自 `openyida get-schema`，不得手写或缩短。
4. 函数名使用大写英文，参数符号使用英文字符，字符串使用双引号。
5. 比较使用 `GE`、`LE`、`GT`、`LT`、`EQ`、`NE`，不使用 `>=`、`<=`、`>`、`<`、`==`、`!=`。
6. 公式不能引用当前字段本身。
7. 隐藏字段参与计算时开启“始终提交”。
8. 公式结果类型必须与目标字段兼容：文本结果写入文本字段，日期结果写入日期字段，人员结果写入成员字段；数值结果可写入数值或文本字段。

## 字段属性

公式字段同时设置：

| 属性 | 值 |
|------|----|
| `valueType` | `"formula"` |
| `complexValue` | `{"complexType":"formula","formula":"<公式>"}` |
| `formula` | 与 `complexValue.formula` 相同 |

单选结果写入单选字段，多选结果写入多选字段。类型不确定时先用 `yida-formula-evaluate` 检查；检查失败时修正公式或目标字段类型，不把字段改成文本来掩盖错误。

## 执行步骤

1. 创建或确认基础字段。
2. 执行 `openyida get-schema <appType> <formUuid> --field-map-json`。
3. 使用返回的完整 `fieldId` 编写公式。
4. 使用 `openyida create-form update` 写入公式属性。
5. 使用 `yida-formula-evaluate` 检查公式。
6. 回读表单 Schema，确认公式和字段引用已保存。

## 完成条件

- 公式静态检查通过。
- Schema 回读中的公式与输入一致。
- 所有字段引用都能在当前表单 Schema 中找到。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [公式函数](../../references/formula-functions.md) | 查询函数签名和参数时 |
| [公式示例](references/examples.md) | 需要金额、条件、子表、人员或部门示例时 |
