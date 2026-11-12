# 连接器动作与原生设计器兼容

新建或追加 HTTP 动作时，省略 `id` 可稳定生成 `operation-<operationId>`；显式提供的 `id` 必须是以 `operation-` 开头的非空字符串，且同一批次的 `id`、`operationId` 各自唯一。不符合原生设计器约定的 ID 在写入前拒绝，避免编辑保存时动作集合丢失。已有远端动作的稳定 ID 不会被自动改写。

cURL 生成器和文档解析器共用递归 Schema/字段生成逻辑，保留嵌套 Object、Number、Boolean 和数组类型，以及 `children/childList`、完整 `_key`、Body 参数位置。cURL 的原始 Body 默认 JSON 保持不变；非对象 Body 以原始文本保留，不伪造叶子映射。JSON 请求应在 cURL 中明确声明 `Content-Type: application/json`，未声明时不擅自改变 cURL 的表单传输语义。

验收应覆盖 CLI 创建/追加、原生设计器打开编辑保存、重新加载、CLI 回读动作身份与多层 Body，以及上游实际收到的请求。配置保存回读与原生编辑往返分别验证；单靠 HTTP 200 也不能证明嵌套字段值与类型正确。

自动化输入使用平台发现的完整字段路径，例如 `Body.options.enabled`；CLI 按真实 Schema 生成运行参数树，字段名自身含点号时保持原名。Body 全为固定值时，CLI 自动组成完整 JSON；混合动态字段与固定数字、数组时，自动生成 JSON Body 表达式，安全序列化动态值并保留固定值类型。用户仍可逐叶配置，无需手写拼接公式；`"TRUE()"` 等文本保持文本。只接受真实字段 ID 或已解析的上游节点字段引用，不把任意 `processVar` 文本升级为可执行代码；不安全引用以 `INTEGRATION_CONNECTOR_JSON_REFERENCE_INVALID` 在写前拒绝。自动化链路会省略对象中的 null 成员，当前 CLI 对固定 JSON 中的 null 统一以 `INTEGRATION_CONNECTOR_JSON_NULL_UNSUPPORTED` 写前拒绝，避免静默丢键。直接 `value: null` 仍由参数必填校验拒绝，非有限数字和同一对象与子字段的重叠赋值也在写前拒绝。

原生自动化界面读取 `rules` 参数树。CLI 同时填充原生分组、嵌套对象和叶子规则；Number 参数使用数值编辑组件，Boolean 在文本组件中保留可见值，避免配置已保存但界面为空。原生设计器重新保存会自行生成运行参数；真实对照中，同一配置经 CLI 发布后保留 Number/Boolean，经原生设计器再次发布后变成字符串，单行文本中的换行也被裁剪。本次修复仅控制 OpenYida 编译路径，不修改平台重新编译器；原生编辑、发布后需再次执行类型回显验收，不能套用修改前的通过结论。

平台 HTTP 详情可能返回空的模式哨兵并省略仅用于 IDP 的模板字段。动作预检只对已知 HTTP 哨兵做规范化，仍拒绝缺少 host、完整动作集合等关键定义；不会根据不完整详情重建或覆盖已有动作。

`connector test` 同时检查外层契约、HTTP 状态和响应体中的明确业务失败：非零 `errcode`、布尔 `success: false` / `hasError: true`，以及钉钉 `AuthenticationFailed` 错误。未知业务 `code` 不直接推定失败，以免将正常的 `code: 200` 等协议误判。CLI 的失败判定不会修改平台自动化的运行日志状态；自动化仍需核对节点输出和业务数据。

生成响应输出时，若 `responses` 明确声明顶层 `success` 为 Boolean，CLI 会生成原生 `successFlag: true`、`successCondition: isTrue`。这使自动化对该协议中的业务失败返回异常状态。显式提供的 `outputs` 保持调用方配置；其他协议应按官方契约配置原生成功条件，不能把任意 `code` 或 `errcode` 当成布尔字段。真实对照中，相同的 HTTP 200 / `success: false` 响应，无成功条件时运行日志为成功，设置 `isTrue` 后为异常。

输出 Schema 不是脱敏白名单：平台网关及自动化日志可能保留未声明的原始响应字段。使用返回票据的接口验证自动化时，仅在用户授权的专用测试账号及隔离资源上运行，并明确平台日志的留存行为；本地报告只保留状态、有效期及存在性断言，不转存原始响应。CLI 会屏蔽账号 credential blob、AppKey 和 JSAPI 票据，但这不修改平台保存的日志。

账号元数据与更新方式见[鉴权账号维护](connector-accounts.md)。
