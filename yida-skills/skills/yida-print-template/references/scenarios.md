# 打印模板场景搭建

这些场景复用同一个生成器和原生资源接口，不创建对应业务表单，也不生成业务记录。先从 fields 获取真实字段，再确定用途和必要信息；缺少字段时调整版式或说明缺失，不能填造数据。

| scene | 布局起点 | 需要映射的业务角色 |
| --- | --- | --- |
| order | 双栏信息、商品明细、金额与签字 | 订单编号、客户名称、订单日期、经办人、订单明细、商品名称、数量、单价、金额、合计金额、备注 |
| quotation | 正式报价、明细和确认签字 | 报价编号、客户名称、报价日期、经办人、报价明细、商品名称、数量、单价、金额、报价总额、报价说明 |
| delivery | 交接信息、数量明细、双方签收 | 发货编号、收货单位、发货日期、经办人、发货明细、商品名称、发货数量、交接备注 |
| receipt | 紧凑单栏、金额和签字 | 收据编号、付款单位、收款金额、收款日期、发起人 |
| approval | 申请信息、说明、真实审批历史 | 申请编号、申请人、申请日期、申请金额、申请说明、审批历史；审批历史必须映射实际 table 或审批节点，普通复核结果文本应改成 field 区块 |
| codes | 编号文本、二维码和条形码 | 订单编号；要求 fields 码图资格与组织能力可用 |

## 通过场景新建

示例 bindings.json 是“场景角色 → 实际字段名或 key”的平面对象；子表列会在对应父表范围内解析。默认使用同名真实字段；传错角色名称、字段缺失、重名不明确或列属于其他子表时都失败，不猜测近似字段。

```json
{
  "收据编号": "textField_receiptNo",
  "付款单位": "客户单位",
  "收款金额": "实收金额",
  "收款日期": "到账日期",
  "发起人": "originator"
}
```

```bash
openyida print-template fields <appType> <formUuid> --json
openyida print-template build <appType> <formUuid> --scene receipt --bindings bindings.json --out receipt-native.json --json
openyida print-template create <appType> <formUuid> --name "收款凭证" --config receipt-native.json --json
```

build 不远端保存，--out 写完整原生正文，JSON 回执还返回映射后的 document。create --config 先校验，后创建并保存；成功返回新 templateId、contentSaved、readbackVerified、正文备份 backupPath 和创建前列表备份 createBackupPath。省略 --config 仍可新建空模板，后续单独 save。

需要调整列、标题或签字栏时，先输出可编辑场景源文件，修改后再 build 或 create --config：

```bash
openyida sample yida-print-template quotation --output quotation-document.json
# 按实际 fields 替换字段，增删 blocks、重排 columns、调整 style/fontSize/width
openyida print-template create <appType> <formUuid> --name "客户报价单" --config quotation-document.json --json
```

映射只选择真实字段，不改动表单值。默认字段网格和明细列显示真实字段名称；需要 label 别名时，应保持业务含义。不同计量、价格与金额不能为了凑齐样例而相互冒用。

## 修改已有模板

已有本地 document 配置时，修改其 blocks、字段顺序、日期格式、码图尺寸或样式，再用当前指纹保存：

```bash
openyida print-template inspect <appType> <formUuid> <templateId> --out before.json --json
openyida print-template build <appType> <formUuid> --config quotation-document.json --json
openyida print-template save <appType> <formUuid> <templateId> --config quotation-document.json --expected-hash <当前configHash> --json
```

save 全量替换正文。平台已手动编辑或没有源配置时，以 inspect 快照为准，将 content 中 termContents、termJsonAttr、dictionaryList 三件套导出为 native.json，再编辑并保存；不要用旧 document 覆盖新的人工排版。只改名称/说明/文件名前缀走 settings，不重建正文。

## 复制变体与恢复

比较标准版、简洁版、带扫码版时，copy 原模板取得新编号，在新编号上 inspect/save。使用不同字号、字段密度、明细列和签字区，避免只是换标题。不要覆盖用户的原参考模板。

保存后的回执带有 backupPath。恢复时使用同目标的备份，加当前 inspect 指纹执行 restore；恢复正文后再回读。copy 的源指纹不能当作新目标的 save 指纹。

## 完成判断

- 仅编译通过：配置可用，模板尚未保存。
- 创建并正文回读通过：新资源已保存，可以给出编辑链接。
- 创建后保存失败：返回的 createdTemplateId 仍可能存在；读取该编号修复，不自动重复创建、删除或重发保存。
- 修改通过：核对目标编号、正文和未计划修改的元信息；可通过备份恢复。
- 请求 PDF 后按 fileId 查 FINISH，再查看文件内容、分页、中文、明细、签字位置及码值；没有真实审批历史、附件图片、设备打印等对应证据时单独说明。

每个真实演示记录用途、模板编号、源配置、写入/回读结果与 PDF 验收状态。示例数量不等于所有行业或所有原生编辑器功能已验收。
