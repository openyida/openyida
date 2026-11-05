---
name: yida-custom-button
description: 配置已有普通表单或流程表单的原生自定义按钮。用于客户跟进、线索分配、审批后发起订单、触发自动化或打开业务页面；不用于自定义页面内的 React 按钮。
---

# 表单自定义按钮

使用 `openyida custom-button` 管理「页面设置 > 自定义按钮」中的按钮定义及显示位置。

| 业务场景 | 动作 |
| --- | --- |
| 分配客户跟进人、员工转正、补充当前记录 | `fillInForm` / `fillCurrentForm`，选择可修改字段 |
| 从客户填写跟进记录、采购审批后发起订单 | `fillInForm` / `fillLinkageForm`，选择平台返回的被关联表单 |
| 手动执行复杂业务处理 | `invokeFlow`，绑定当前表单已发布的自定义按钮手动触发流（type 6） |
| 查看业务说明、进入应用页面或外部系统 | `linkToPage`，应用内页面或 HTTP(S) 链接 |

## 步骤

1. 查询目标表单的按钮、动作和可用资源，使用真实字段或资源 ID。
2. 根据业务动作编写配置，创建或更新按钮定义并回读。
3. 根据用户指定的显示位置验证。仅需向指定视图的操作列追加已有按钮时，使用 `form-view add-button`。

```bash
openyida custom-button list <appType> <formUuid> --json
openyida custom-button options <appType> <formUuid> --json
openyida custom-button inspect <appType> <formUuid> <buttonUuid> --json
openyida custom-button create <appType> <formUuid> --config button.json --json
openyida custom-button update <appType> <formUuid> <buttonUuid> --config patch.json --expected-hash <configHash> --json
```

`options` 返回字段、筛选变量、被关联表单、页面、type 6 自动化流、表格视图和自定义详情页。没有符合条件的流时，用 `yida-integration` 配置按钮手动触发的自动化；本命令不会创建或执行自动化。

需要通过「表格设置 → 自定义按钮」把定义追加到指定视图的操作列时，加载 `use_skill("yida-form-view", "向表格操作列添加按钮")`，使用 `form-view add-button`。创建新定义后使用回读返回的按钮 UUID。

按钮名称的每种语言文案最长 10 个字符。平台会自动补齐备用翻译与空元数据；CLI 回读会核对显式设置和原有翻译，接受这些平台补充项。

可用条件会补齐原生字段类型、规则类型、`ruleValue` 和组/条目 ID；只保存 `id/op/value` 可能在编辑器中可见却无法执行。真实测试应分别验证符合与不符合条件的记录。创建手动触发流当前需在平台设计器完成，再从 `options` 返回的已发布流中绑定。

修改当前记录示例（用查询得到的 ID 替换占位符）：

```json
{
  "name": {"type":"i18n","zh_CN":"分配","en_US":"Assign"},
  "actionType":"fillInForm",
  "actionConfig": {"fillType":"fillCurrentForm","fieldsSelected":["实际字段ID"]},
  "tableViewUuids":["实际表格视图ID"],
  "detailId":[]
}
```

关联表单的 `actionConfig` 使用 `fillType: fillLinkageForm`、`linkageFormId`。CLI 根据关联列表补齐 `linkageFormAppType` 和 `linkageFormType`；自动填充取决于目标表单已有的关联填充配置。

自动化使用 `actionType: invokeFlow`、`actionConfig: {"processCode":"实际流程编码","needSecondCheck":["y"]}`。二次确认默认开启，显式 `[]` 才关闭。这是成员点击按钮时的提示。

页面跳转使用 `actionType: linkToPage`，`actionConfig` 中：

- 应用内：`urlType: inner`、`urlFormUuid`，CLI 补齐 `urlFormType`。
- 外部：`urlType: outer`、`url: https://...`。
- `openWith` 为 `new` 或 `slide`。可选 `paramInfo` 是 `{paramName,paramType,paramValue}` 数组，类型为 `constant`、`variable`、`formula`；字段或公式从实际元数据生成。

可用条件使用 `permissionConfig` 的平台规则树，`null` 表示全部数据。条件按完整树替换，格式为 `{"condition":"AND","rules":[{"id":"实际字段ID","op":"eq","value":"目标值"}]}`。`id` 和 `op` 从 `options.variables[].operatorMap` 取得；CLI 根据该字段支持的操作符解析 SQL 键、原生标签或标准码，补齐 `conditionCode`、`opCode` 和默认 `valueType: literal`。已有树可保留有效的 `opCode` 与 `valueType`，不匹配的操作码会被拒绝。不要将数据查询条件或权限组规则直接传入。公式只使用已有有效平台表达式。隐藏/提示属性受平台能力约束，不绕过灰度或版本限制。

更新时多语言文案与同类动作属性合并，数组及条件整体替换。切换 `actionType`、`fillType` 或 `urlType` 时提供完整新 `actionConfig`。保留未修改的翻译、条件和显示位置；`tableViewUuids: []` / `detailId: []` 清空对应显示引用。旧版详情页和自定义详情布局还可能需要在对应设计器中添加引用与排序，本命令不重写详情布局或系统按钮顺序。

删除定义需要用户明确要求，先 `inspect` 确认目标，再使用真实 hash：

```bash
openyida custom-button delete <appType> <formUuid> <buttonUuid> --expected-hash <configHash> --yes --json
```

删除定义与移除显示引用不同。备份包含原定义，但重建会得到新 UUID，不能自动恢复其他地方的旧引用。仅要求隐藏某处按钮时，调整对应引用。

## 输出

写入前自动备份，成功需返回 `readbackVerified: true`。超时、认证失败或回读不一致时，保留 `backupPath` 并只读检查，不直接重复创建/删除。hash 能检测读取后的变化，平台没有原子比较写入能力。

验收按本轮授权范围，在详情页/数据管理页核对名称、位置、条件和动作配置。执行按钮可能改业务记录或触发外部操作，只有用户授权相应测试时才执行。保存回读不能证明移动端展示、关联填充或自动化执行成功。

平台边界见[官方说明](https://docs.aliwork.com/docs/yida_support/wtwabe/ckyvwt/ohyllrtgx9v5opox)：每表最多 10 个；流程数据结束后才展示；编辑受字段权限约束；自动化按钮不另按字段权限控制触发，应结合页面访问与流程设计确定范围；未开启的流不会生效。版本/权限拒绝如实报告，不修改组织版本、授权或灰度开关。
