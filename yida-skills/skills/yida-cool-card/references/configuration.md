# 酷卡片配置协议与验证

[官方酷卡片设计文档](https://docs.aliwork.com/docs/yida_support/_9/tspkdk/pqnynb) 区分消息通知卡片、交互卡片和置顶卡片。当前命令覆盖应用酷卡片管理的后两类；消息通知卡片由表单/流程消息设置维护，不能套用管理卡片接口。

## 已核实的协议

管理接口位于目标应用的 `/query/cardDesign/`：`listCards.json`、`listTpls.json`、`createCard.json`、`getCardSchema.json`。类型 `im` / `onebox`，读取参数为 `cardAppId` 与 `cardPageCode`，创建参数仅 `cardName` 与 `cardType`。平台返回 cardSchema 内部的 template、editorData、widgetInfo、renderTemplate、extension 和变量信息，必须保留未知配置。

编辑器地址为 `/editor?templateId=...&scene=yida_card&bizId=<appId>.<cardPageCode>`。已在测试卡片上核实：自动保存调用 `/api/commTemplate/save`，点击“保存”调用 `/api/commTemplate/build`，宜搭侧回读 `publishStatus=build`。通用编辑器虽包含 `/api/commTemplate/publish`，但实际 `yida_card` 场景配置为 `PublishBtn=false`、`SaveBtn=true`，不能将通用 publish 接口直接当作宜搭酷卡片的发布步骤。测试发送是另外的操作，不随保存自动执行。

浏览器通过已有钉钉 SSO 会话登录编辑器，请求携带会话及 `x-csrf-token`，无需用户另行申请卡片权益。接口响应以 `code=200` 为成功，不能套用宜搭 `success/content` 解包逻辑。已验证宜搭 OAuth Bearer 调用编辑器读取接口返回 HTTP 403；宜搭 `/query/auth/getToken.json` 为数据准备跳转提供的 `yidaToken` 也未让编辑器建立登录态。这些结果只说明已测试凭证不可复用，不代表所有服务端桥接均不存在。不能提取浏览器 Cookie、修改 OAuth 回调白名单或跳过鉴权来凑齐能力。

保存请求的 URL 参数为 `templateId`、`scene`、`bizId`；JSON 字段包括 `isNewTemplate`、`templateId`、`name`、`orgId`、`type`、`appType`、`appLogo`、`editorData`、`widgetInfo`、`templateSchema`、`multiScenarioWidgetInfo`、`multiScenarioSchema`、`fileTypeList`、`templateCdsInfos`。其中部分字段由模板的 `extension` 映射。请求结构已定位不等于 CLI 已能保存，仍需核实合法会话复用及编译产物生成。

已检查的 tianshu `CardDesignRpc` 和 `CardDesignServiceWrapper` 提供管理及模板读取操作，没有发现接收编辑器完整配置的保存方法。tianshu 还存在运行时配置的网关映射；未读取该映射时，应明确“静态源码未发现”，不能断言整个服务没有保存入口。

管理接口的 `editCard` 会复制模板，产生新的 templateId，是写操作；不能用于只读查询。`copyCard` 和 `deleteCard` 分别复制并发布、删除并发布，也不能伪装为草稿操作。`saveUseCardSetting` 接受平台配置标记，不属于当前支持范围。CLI 不调用这些接口。

新建资源可能已有 cardTemplateId，但 getCardSchema 仍返回平台 500“卡片模板不存在”。创建流程分别标记资源列表回读与模板回读，不重复创建，不把模板失败当成空配置。已有卡片的 cardTemplateId 与 cardSchema.templateId 也可能不同；原样保留，并显示 templateIdsMatch，不凭字段名假定版本相同。

## 代码与样式边界

宜搭原生酷卡片使用平台组件及其原生属性，不是任意 HTML/CSS/React 的执行环境。当前场景的对照实测结果：

- 原始 HTML 或 JSX 源码作为导入内容时，被 JSON 格式检查拒绝；写进 `BaseText` 文本后可以保存，但原样显示，不执行。
- 原生 `BaseText` 的 `fontSizeType`、`customFontSize`、`fontColorType`、`customLightColor`、`customDarkColor` 和 `bold` 已验证保存与预览生效。额外添加任意 `props.style` 的字号、颜色、背景、旋转等 CSS 对象可留在设计数据里，但本次实测没有进入对应原生编译输出，预览不生效。
- `RichText` 的 DX 内容及样式结构有专用协议，需同时保留编辑表示、辅助变量和数据绑定；其中的 `style` 不是任意 CSS。已验证生成 `DDRichTextView` 并通过变量绑定渲染。
- 未注册的 HTML `div` 节点可留在设计数据里，保存状态仍可能为 `build`，但本次实测没有有效渲染；结合原生编译输出、预览和编译诊断判定，不能只凭状态或一条 Durbo 日志下结论。

`editorData` 保留代码不等于代码生效。`widgetInfo` 在该实测版本中是平台生成的原生 XML DSL，也不是 HTML，更不是已验证可直接提交源码的入口。Markdown 和表达式变量只支持各自协议，不能据此推导可运行任意 JavaScript 或 JSX。未来平台能力改变时重新核实当前宜搭场景；不为了验证隐藏入口修改权益或开关。用户需要超出原生范围的外观时，按 [完全不同样式的处理方式](design.md#用户要求完全不同的样式时) 说明限制与替代方案。

## 后续保存链路的验收条件

先确认适用于 CLI 的登录契约、模板版本与保存回调，再实现允许字段、原始摘要、备份、写前重读及保存后回读；单次写请求不自动重放。不能只改 editorData 而忽略编译后的 widgetInfo/renderTemplate，也不能把旧模板 ID 的内容当成新版本验证。

分别验证交互与置顶卡片的多组件布局、变量绑定、循环内容、条件可见、链接/动作；回读结果、编辑器可编辑性、真实业务变量渲染需分开记录。文档的组件数量不作为固定白名单：平台组件可能升级，未知配置应读取保留，尚未支持的生成能力明确拒绝。酷卡片不是原生报表，不能照搬 Youshu 图表 Schema。

发送另需用户明确指定接收目标和用途。只做配置测试时使用本地样例变量，不发送卡片。需要验证真实发送时再核对酷应用发布、群安装及人员/群上下文；定时触发没有“当前群”上下文。保存成功不证明已发送的卡片更新，也不证明客户端可见。

## 复杂配置的编辑器验收

已实测交互与置顶卡片：每张 33 个节点、6 类组件、15 个顶层变量，包含双列指标、循环明细、逐行进度、条件显示和两个链接按钮。创建走 CLI，配置导入与保存走官方编辑器，再用 CLI 回读；这不是 CLI 保存能力。

- 循环文本用 `${loop.title}` 等 `${loop.<字段>}`，数值动态绑定则保留平台生成的变量 ID（如 `tasks[0].progress`）并标记 `variableType=loop`。直接把 `${tasks[0].title}` 当作文本会原样显示；选择属性面板可能自动规范化，所以验收必须重新打开并预览，不能只看设计态。
- 布尔条件使用平台生成的 `isTrue` / `isFalse` 规则。当前编辑器中固定条件值应保持字符串（示例为空字符串），不能把原始 boolean 传给字符串编译路径；错误样例曾导致 `e.replace is not a function` 和保存失败。此为已测版本的协议事实，不是可跨版本硬编码的通用 Schema。
- 导入是异步操作。确认覆盖后先观察画布已切换到目标内容，再点保存；紧接导入点击保存可能仍构建旧配置。自动保存提示仅证明草稿保存，不能替代显式保存与宜搭回读。回读核对目标类型、变量/循环样例、`publishStatus=build` 及非空编译产物。
- 设计态会展示条件分支和循环占位行；预览才验证实际可见性。至少覆盖多条不同循环数据与空数组、有风险与无风险两个分支，并重新打开核验。编辑器预览不等同于真实客户端送达，链接按钮存在也不证明动作执行成功。

## 外部 dws 安装与调用

[钉钉 Workspace CLI 官方安装说明](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli#installation)。dws 独立安装和升级，不加入 OpenYida 的 dependencies、optionalDependencies、发布包、postinstall 或内置 Skill 副本；由用户选择安装方式。仅检查或使用现有 dws，不因路径不同擅自删除旧二进制或重建软链。

先运行 `dws version` 检查已有安装；命令不存在时提供下面的官方安装指引，不执行下载脚本。只有用户明确要求安装/升级时才执行相应动作。已安装但版本缺少命令时说明缺口，并给出官方升级说明；不自动升级。

需要钉钉侧功能时，直接调用已安装的 `dws <command> [args]`，参数和输出格式以其 `--help` 为准。

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.ps1 | iex
```

也可使用 npm 独立安装：

```bash
npm install -g dingtalk-workspace-cli
dws version
```

钉钉业务访问使用 dws 自己的 `dws auth login`；不读取它的凭据存储、不将宜搭令牌写入 dws。核对 dws 的目标组织与账号，不能因两者在同一台机器上就假定身份相同。遵守平台实际权限错误，不自动申请更广权限。

按用户所需能力检查精确命令，例如离线 A2UI 编写/校验检查 `dws aicard --help`，消息卡片更新检查 `dws chat message update-a2ui-card --help`。Help 只是能力发现，不能据此宣称业务调用成功；`aicard preview` 会向当前用户发送卡片，不作为离线检查运行。实际调用外部 CLI 使用参数数组及结构化输出，不拼接用户内容为 shell 命令。

宜搭与钉钉的连接点是 `appId + cardPageCode → 当前 cardTemplateId`。未来若 dws 提供适用的模板保存能力，应先核实模板归属、`scene=yida_card` 和 `bizId=appId.cardPageCode` 的关联、版本准备及保存回调，再对同一宜搭卡片回读验收。当前 dws 的 A2UI 命令使用消息 `bizId`，不能把宜搭编辑器 URL 的 bizId 或 cardTemplateId 代入消息更新。对传统模板保存尚未验证兼容前，保留官方编辑器链接交付。
