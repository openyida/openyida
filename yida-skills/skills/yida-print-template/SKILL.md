---
name: yida-print-template
description: 宜搭原生富文本打印模板管理与单据搭建。用于打印这条数据、打印数据详情链接、打印设置、订单/报价/出入库/审批单模板、字段二维码和条形码，支持按真实字段生成版式、查询、创建、复制、保存、备份恢复、文件名、使用范围、启停、排序和请求原生PDF。不用于Word模板组件、叮当打印、浏览器页面打印或物理打印机控制。
---

# 宜搭打印模板

让业务表单中的数据按不同单据版式输出。先理解用途、必需字段、明细列、签字位置和打印对象，从真实打印字典中选择字段；不要把一张普通网页截图当作打印模板。

## 范围

- 原生富文本编辑器：标题、段落、字体字号、表格布局、普通字段、日期格式、图片、字段二维码和条形码、子表明细、系统字段、评论记录及字典中存在的审批节点。
- `document`、`compact`、`formal` 是生成器的排版起点；可自由组合区块和静态 XHTML，形成订单、报价、出入库、审批单、窄内容收据等多种版式。
- 保存后直接生效，没有独立 publish 命令。默认保留模板启停状态与使用范围，不修改组织版本、权益和额度。
- 模板正文是原生 `termContents`、`termJsonAttr`、`dictionaryList` 三件套。原生编辑器的复杂样式和组件可导出后修改、保存，不凭空添加未经证实的协议键。
- 不承诺完整桌面排版能力：纸张规格、页边距、固定页眉页脚、页码、强制分页、精确套打、自动金额大写与汇总不在此编辑器已验证范围内。合计用已有计算字段；宽度是内容宽度，不是纸张规格。
- Word、叮当和政务打印是不同链路，本技能不通过富文本接口改写它们。标准原生自定义打印仍受平台付费版本和权限限制；遇到拒绝保留原始原因。

## 从数据详情页打印

用户给出宜搭数据详情链接说“打印这条数据/这个详情页”时，优先复用该记录与已有模板，无须先去管理后台新建。使用 [详情链接打印指南](references/detail.md)：读取记录有权限使用的模板，明确选用哪份，生成原生 PDF 并核对文件。多份模板用途不明确时先展示名称让用户选择。

原生模板把该条记录数据排成单据；“把页面按屏幕样子打印”属于浏览器页面打印，应说明两者的效果差别，不能把截图当原生模板。

## 新建与修改入口

按用户意图选择：新建单据用场景 build → create --config；已有模板的正文改动用 inspect → 编辑配置 → save；仅改名称、说明或文件名前缀用 settings；在原稿上做不同版式用 copy 后修改新编号。保留真实业务字段语义，不因套用场景把单价伪装为商品名。

六种场景与字段映射、新建、修改、复制变体的完整用法见 [场景搭建指南](references/scenarios.md)。场景只是可编辑起点，用户可以任意组合已有区块，不受六种名称限制。

## 操作步骤

1. 解析用户已有 app/form/template。链接中 `templateId` 就是模板编号；同一表单可以有多份模板。已有模板默认修改；比较不同版式时优先复制或新建，保留原稿。
2. 按总入口完成登录态确认，再读取：

```bash
openyida print-template list <appType> <formUuid> --json
openyida print-template fields <appType> <formUuid> --out .cache/openyida/print/fields.json --json
openyida print-template inspect <appType> <formUuid> <templateId> --out .cache/openyida/print/before.json --json
```

`list` 返回 `orderHash`；`inspect` 返回正文、元信息、`configHash` 和原生 `gmtModified`。尚未保存过正文的模板可返回空正文，不能声称空内容已经是默认版式。内置编号 0 的默认模板正文不能直接编辑。

3. 选择真实字段名或 key。重名时用确切 key；子表列必须从对应子表 children 选择。不可用截图或相似字段名猜 ID。申请单、审批单只放业务需要的系统字段和审批节点，不默认加入个人信息或评论。
4. 生成配置。示例：

```json
{
  "document": {
    "title": "销售报价单",
    "style": "document",
    "font": "宋体",
    "fontSize": 14,
    "blocks": [
      {"type":"fields","columns":2,"fields":["客户名称",{"field":"报价日期","format":"yyyy-MM-dd"}]},
      {"type":"heading","text":"商品明细"},
      {"type":"table","field":"报价明细","columns":["商品名称","数量","单价","金额"]},
      {"type":"fields","fields":["总金额"]},
      {"type":"html","html":"<p>经办人：{{发起人}}</p><p>客户签字：________________</p>"}
    ]
  }
}
```

字段名称仅为说明，实施前替换成实际字典中的名称。模板示例通过 `openyida sample yida-print-template order|quotation|delivery|receipt|approval|codes --output <file.json>` 输出。六个 sample 不会创建模板；先替换字段，再执行 build 校验。

```bash
openyida print-template build <appType> <formUuid> --config .cache/openyida/print/document.json --out .cache/openyida/print/native.json --json
openyida print-template create <appType> <formUuid> --name "销售报价单" --json
openyida print-template save <appType> <formUuid> <新templateId> --config .cache/openyida/print/document.json --expected-hash <create返回的configHash> --json
```

`build` 只编译/校验，不远端保存。`create` 不传 --config 时创建空模板；传 --config 会先校验内容，再创建并保存回读。它由两步原生操作组成，不能视为原子事务；后续保存失败时错误中的 createdTemplateId 指明已创建资源，先 inspect，再对该编号 save，不能重复 create。每次修改已有模板先 inspect，使用最新 configHash；`save` 是全量正文替换，元信息和使用范围保持原样。保存实际送出最新 gmtModified，平台可以拒绝并发冲突；没有正文时间戳的首次保存只能做客户端指纹校验。

5. 需要复制时执行 `copy ... <源templateId> --name "新名称" --expected-hash <源hash>`，回读新编号；复制正文和平台复制规则，以新模板实际回读为准。
6. 设置与恢复：

```bash
openyida print-template settings <appType> <formUuid> <templateId> --config .cache/openyida/print/settings.json --expected-hash <hash> --json
openyida print-template status <appType> <formUuid> <templateId> --status START --expected-hash <hash> --json
openyida print-template order <appType> <formUuid> --config .cache/openyida/print/order.json --expected-hash <orderHash> --json
openyida print-template restore <appType> <formUuid> <templateId> --config .cache/openyida/print/before.json --expected-hash <当前hash> --json
```

`settings.json` 仅支持 title、description、fileNameConfig、roleData。title/description 可用字符串或保留其他语言的 i18n 对象。文件名支持固定文本和 `$!{instanceTitle}`、`$!{originator}`、`$!{createTime}`、`$!{serialNo}`。使用范围必须是用户明确要求的修改，使用平台格式的 `[{"roleType":"ALL","roleValue":"y"}]`，并显式传 `--allow-permission-change`；不默认为所有人扩大范围。默认模板仅允许修改角色范围。

排序文件为所有现有模板编号的数组，包括默认编号 0，每个恰好一次。`restore` 只恢复同 app/form/template 的正文，不恢复角色、启停或文件名。所有远端写操作先独占创建备份文件；不覆盖旧备份。

7. 按任务需要验证真实数据输出：

```bash
openyida print-template render <appType> <formUuid> <templateId> --instance <真实记录ID> --json
openyida print-template files <appType> <formUuid> --page 1 --size 50 --json
```

render 返回 fileId 只说明请求已受理。在 files 中按 ID 确认 FINISH 与下载地址，查看实际 PDF 后才能说排版和数据正确。失败时保留原生状态，不自动重发。该操作使用已有单条记录，不生成/更改业务记录，也不控制物理打印机。受管云端应用搭建任务不能执行 render。

## 区块配置

| type | 内容 |
| --- | --- |
| heading / text | text；可选 align=left/center/right |
| fields | fields 字段数组；columns=1/2/3/4；每项可用字符串或 `{field,label,format,width,height,render}` |
| field | field 单个动态字段；日期 format 必须命中字典；图片 width/height 为像素 |
| qrcode / barcode | field 真实字段名或 key；可选 width/height 像素，默认二维码128×128、条形码240×80；按每条记录的字段值动态生成 |
| table | field 子表、评论或审批节点；columns 指定真实子字段、顺序和标签；可选日期格式 |
| html | 静态 XHTML；`{{字段名或key}}` 注入原生动态组件；禁止脚本、事件处理器、Velocity 指令 |
| image | 已有 HTTPS 图片 url，可选 width/height；不自动上传文件 |
| divider | 分隔线 |

字体只用宋体、Arial、新宋、微软雅黑、黑体。fontSize=8–72，width=160–2000 内容像素。原生配置必须完整提供三件套；复杂复选框等组件可通过原生导出保留，未知 key 或格式不能悄悄降级。

## 二维码与条形码

先读取 fields：可转码字段的 `codeFormats` 返回 qrcode/barcode；不可用时有 codeUnavailableReason。遵循原生编辑器的专业级/专属级版本与功能开关，不通过自行画图、改版本或改开关绕过。文本、数字、单选、下拉单选及系统流水号可转码；日期、成员、附件和明细父组件不能直接转码。明细列按实际子字段判断。

```json
{"document":{"title":"扫码核验单","blocks":[
  {"type":"qrcode","field":"订单编号","width":128,"height":128},
  {"type":"barcode","field":"订单编号","width":320,"height":100}
]}}
```

字段网格或子表列可写 `{"field":"商品编码","render":"barcode","width":240,"height":80}`。码图使用原生 `<字段key>.qrcode` / `<字段key>.barcode` 动态图片协议，并可原生导出、恢复和复制。不要把字段名称编码成静态码图，不能把一张码图在不同记录间重复使用。

二维码可承载原字段内容（含中文），条形码按原生编辑器限制使用英文大写字母、数字、中划线、斜杠、点等支持字符；不可擅自将小写变大写、删除中文或替换原字段值。长内容与较小尺寸会影响识别率，按真实PDF检查并解码比对；没有手机/扫码枪验证时不宣称设备验收。原生保存成功、PDF有图片不等于内容正确。

## 完成与失败

成功交付说明模板用途、真实编号、回读结果和编辑入口；完整路径为用户提供域名下的 `/alibaba/web/<appType>/admin/printTemplateEdit?formUuid=<formUuid>&templateId=<templateId>`，无须追加 `defaultTemplate=true`。平台前缀可能随环境不同，以实际已有链接为准。

只有 build 不能说模板已保存；保存成功不能说 PDF 通过；PDF 请求受理不能说文件已生成；截图不能证明物理打印完成。写请求失败或回读不符可能已经产生变更，先 inspect/list 并使用备份恢复，不自动重放写操作。

详细命令及边界见 [打印模板指南](references/guide.md)。
