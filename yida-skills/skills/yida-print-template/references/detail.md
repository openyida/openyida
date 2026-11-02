# 打印一条数据详情

原生模板配置归属于表单；模板在数据详情、流程详情等入口选择，套入当前记录。用户给出详情 URL 并说“打印这个”时，已有 render 是生成该记录 PDF 的底层操作，不需要先重建模板或数据。

## 直接使用详情链接

```bash
openyida print-template list --detail-url "https://tenant.aliwork.com/APP_XXX/formDetail/FORM_XXX?formInstId=FINST_XXX" --json
openyida print-template render --detail-url "https://tenant.aliwork.com/APP_XXX/formDetail/FORM_XXX?formInstId=FINST_XXX" --template-id <选定编号> --json
openyida print-template files <appType> <formUuid> --page 1 --size 50 --json
```

list 通过原生 `listTemplateWithAuth`，以 formUuid + formInstId 查询该登录用户在该记录可用的模板，回执标记 authorizationScoped；不是管理员的模板管理列表，不返回排序指纹。render 使用同一权限列表预检，再调用原生打印接口，不读取需要管理权限的模板正文。文件生成仍受平台记录、模板、版本与额度校验，不能把“预检可用”当作最终打印许可或 PDF 已生成。

模板编号需要明确选择。默认编号 0 仅在可用列表返回时使用；默认打印发送 DEFAULT 且不发送自定义 templateId。其他原生模板使用 CUSTOM。Word/叮当等模板不能通过此命令伪装为 CUSTOM。

如果用户指定“收据/订单/扫码版”等用途，可与列表中的模板名称和既有上下文对应；用途不明确且有多份时展示选择，不自行修改默认模板或新建一份。用户要求新样式、增删字段时再进入模板新建/修改流程。

## 链接规则与环境

- 支持原生 `/<appType>/formDetail/<formUuid>?formInstId=...`、processDetail 同结构；流程链接有 activityId 时保留到打印请求。
- 支持已包含 formUuid 和 formInstId 的旧 `/alibaba/web|mobile/<appType>/inst/formEdit.html`、taskDetail.html 链接。
- 必须有明确记录 ID。只有表单地址、列表地址、管理编辑器地址或旧流程链接缺少 formUuid 时，先从可见页面或业务查询确认真实记录与表单，不用相近 ID 猜测。
- 链接域名/协议必须与当前认证 base_url 同源；不跟随跳转、不访问该链接指向的任意网络资源、不修改 profile 去迁就链接。不同环境需按总入口明确登录/切换后再执行。
- query 中重复或冲突的 appType/formUuid/formInstId/activityId、带认证信息或 hash 路由的 URL 不接受。短链、钉钉外层跳转及自定义页面地址需先用当前浏览器解析到真实原生详情链接。

也可从已核实的目标标识打印：

```bash
openyida print-template list <appType> <formUuid> --instance <记录ID> --json
openyida print-template render <appType> <formUuid> <templateId> --instance <记录ID> --json
```

不传 --instance 的 list 才是模板管理列表。URL 快捷入口面向本地 CLI；受管云端搭建任务仍禁止 render，不能通过 URL 绕开。

## 输出语义

render 返回 fileId 代表请求受理。按该 ID 查询 FINISH，打开实际 PDF 检查是否为正确记录、明细是否完整、中文、分页与码图是否正确，再交付文件或下载入口。RUNNING、失败、登录缺失和业务错误均保留真实状态，不自动重发请求。不会新增/修改业务记录，也不会自动发给他人或送到物理打印机。

“按详情页当前屏幕原样打印”与“按原生模板打印当前记录”是两种输出。原生 PDF 不保证复制页面导航、按钮、Tab、页面布局或自定义组件。若用户明确要求屏幕原样，说明需要浏览器打印能力；不要宣称此 CLI 已提供任意网页的像素级打印。
