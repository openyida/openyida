---
name: yida-plugin-lifecycle
description: 管理宜搭平台“插件管理”中的开发插件、版本、安装状态与运行时注册。仅在用户明确指向宜搭平台插件时使用；npm 包、Codex/AI 工具插件、连接器本身或普通页面组件不触发。
---

# 宜搭平台插件开发、管理与使用

本技能处理宜搭平台管理后台的“插件管理”，不是 npm、浏览器扩展或 AI 工具插件。开始前核对登录组织；插件操作是组织级影响，不能借应用级授权推定组织级写权限。

前端资源部署，或连接类组件的服务、输入输出映射、参数、鉴权设计，必须先读 [宜搭插件开发规范](./references/development-guide.md)。其中前端资源按已核实的集团/非集团开发环境选择发布方式；连接类组件以官方《宜搭插件开发指南》为权威来源。CLI 生命周期接口不能替代官方编辑器中的组件设计和组织内真实测试。

## 没有开发插件权限时

- 当前组织没有“开发插件”入口，或操作明确提示未开通插件开发权限时，先核对登录账号与目标组织；空列表或登录失效不能直接判定为没有权限。
- 确认未开通后，直接提供申请入口：[宜搭开放－插件需求共创](https://ding.aliwork.com/o/Plug-in)。有页面打开能力时主动打开该页面，优先使用用户指定的 OpenYida 页面打开入口；无法打开时提供可点击链接。
- 引导用户在“共创类型”中选择“我想成为插件开发者，开发插件”，填写联系人、组织信息和拟开发插件的业务场景，由用户核对并提交。页面说明提交后由宜搭团队联系沟通，不承诺审批时效或自动开通。
- 权限开通后，在目标组织的“平台管理 → 插件管理 → 开发插件”核对入口并继续原任务。用户已经开通时无需重复申请；不能用直达开发页或 CLI 写入来绕过明确的权限限制。
- 开发者准入与前端资源托管分别核实，不宣称申请通过就自动获得 `g.alicdn.com` 上传权限，也不把该申请表所在组织当成用户必须加入的开发组织。

## 先判断证据层级

插件可用性分为四层，必须分别陈述，不能互相替代：

1. **持久化配置**：`get` / `version-get` 能回读开发插件与版本配置。
2. **静态资源可访问**：版本中的前端入口可由目标网络请求成功；仅有 CDN 字段不算资源可访问。
3. **运行时注册候选可见**：`runtime-list --extensions ...` 返回当前组织匹配扩展点的候选项，其中包含 `isEnabled=n` 的停用项；必须另外检查启用态。返回候选不等于某个页面已消费。
4. **消费者真实执行**：在实际表单、页面、门户或流程宿主里看到插件被加载并完成目标交互。只有这一层能证明最终运行效果。

## 只读查询

```bash
openyida plugin dev-list --search '插件名' --json
openyida plugin get PLUGIN-XXX --json
openyida plugin version-list PLUGIN-XXX --json
openyida plugin version-get PLUGIN-XXX 1.2.3 --json
openyida plugin extensions --json
openyida plugin installed-list --search '插件名' --json
openyida plugin installed-get PLUGIN-XXX --json
openyida plugin runtime-list --extensions yida.app.custom-page.component --json
openyida plugin probe PLUGIN-XXX 1.2.3 --check-resource --json
```

`extensions` 返回真实扩展点目录。配置版本前先查询目录，不猜扩展点 ID。`probe --check-resource` 对完整 HTTPS 或允许的本机 HTTP 入口发送只读 HEAD 请求；成功只证明该地址在 CLI 所在网络可达。`javascriptContentType=false` 表示响应类型不是 JavaScript（例如登录页），不能据 HTTP 200 宣称资源有效；即使类型正确也没有执行脚本或验证 chunks。

`probe` 保留原始 `plan.entry`，并返回 URL 解析依据、是否仅用于本机调试及未验证的 SDK 容器名提示。相对路径中的已知官方命名空间只生成 `official-default-candidate`，其他命名空间标为 `unresolved-relative-path`、不发起请求；这不是不支持该命名空间，应核对实际运行时地址。未指定版本且基础信息没有开发配置时返回 `PROBE_EXPLICIT_VERSION`，再查询明确版本。完整字段解释见开发规范。

`runtime-list` 会隐藏安装配置值，只说明是否存在配置，并原样保留启停状态；不要把加密参数、令牌或连接凭据写进对话、日志或仓库。

## 开发与版本配置

当前平台通用创建入口为 `ConnectorPlugin`。创建只生成开发资源和默认版本，不发布、不安装：

```bash
openyida plugin create --name '订单连接器插件' --description '提供订单能力' --logo 'https://...' --confirm --json
openyida plugin create-version PLUGIN-XXX --version 1.1.0 --description '新增查询能力' --confirm --json
```

修改版本前先 `version-get`，使用其 `snapshotHash` 做乐观并发校验。配置文件仅接受 `frontEndDevInfo`、`backEndDevInfo`、`paramConfig`；未知字段和未知扩展点拒绝。此命令保存完整三段配置，不是局部 PATCH；以回读对象为基础保留无关字段，省略的段会提交为空对象。

保存字段使用 `frontEndDevInfo.cdnEntry`；CLI 兼容 `cdnUrl` 输入并转换成 `cdnEntry`，两字段值冲突则拒绝。完整 HTTPS 地址不改域名、不补官方前缀。保存前再次读取、写入不覆盖备份，保存后核对目标插件/版本及三段配置；服务端改写资源地址或配置会报 `PLUGIN_READBACK_MISMATCH`。此时写入可能已经发生，先回读排查，不自动重试或恢复备份；不会顺带发布。

前端资源先按[部署分流与验收](./references/development-guide.md#前端资源部署分流与验收)确定渠道，再读[前端资源创建与部署引导](./references/frontend-hosting.md)带用户完成下一步：优先复用已授权的企业静态资源服务器/发布流程（集团优先现有内网流程）；没有现成渠道时，国内默认推荐“码云 + 阿里云 OSS”，GitHub Actions + Pages 作为备选。不要只罗列产品名或要求用户自己研究；先核对已有资源，再提供对应创建入口和步骤，遇到账号、权限、费用或协议由用户确认。以保存回读和当前宿主的实际加载契约核对完整 URL 或 CDN 相对路径，不仅凭输入框前缀断言第三方必须使用 `g.alicdn.com`。

CLI 当前为 `http://localhost`、`http://127.0.0.1`、`http://0.0.0.0` 和 `http://[::1]` 放行 HTTP，普通 HTTP 域名仍拒绝。这只是 CLI 校验行为，不证明浏览器或插件宿主能够加载；本机调试地址不能作为组织发布后的稳定资源地址。

```bash
openyida plugin save-dev PLUGIN-XXX 1.1.0 \
  --config .cache/openyida/plugin/dev.json \
  --expected-hash <version-get返回值> \
  --backup .cache/openyida/plugin/PLUGIN-XXX-1.1.0.before.json \
  --confirm --json
```

发布到当前组织、发布到插件中心、撤回、删除开发插件或删除版本仍走官方插件编辑器及审核流程；CLI 不把未核实的发布接口暴露为可复用能力。

遇到协议、授权等必须由用户本人确认的步骤，定位并打开对应的官方页面，优先使用用户指定的 OpenYida 打开入口并落到已登录的外部浏览器，停留在待确认位置让用户操作；不代勾选、代同意或只给一句拒绝。用户完成后读回状态继续；打开失败时说明具体障碍并给出已核实链接。

### 连接类组件开发契约

- `willFetch(vars)` 从真实 `vars.data.<fieldId>` 取值，并把插件服务入参序列化到 `vars.data.input`；HTTP/HTTPS 服务按目标接口构造 `query`、`body`、`header`、`path`。
- `didFetch(content)` 从 `content.outputs` 读取真实服务结果，写回目标字段并返回 `content`；动态选项返回 `{ text, value }` 数组。
- 动态数据源调用必须使用真实 `pluginId` 与 `serviceUuid`。处理函数对安装者可见，不得包含 Token、AppSecret 或 API Key。
- 自定义参数以 `$参数名` 用于服务输入，系统常量为 `$CORP_ID`、`$USER_ID`、`$ORG_ID`、`$DING_UID`。密钥参数必须加密，不共享开发者凭据时清空默认值。
- Basic、API Key、阿里云 API 网关和钉钉开放平台鉴权均由插件服务与参数配置表达，不在前端处理函数里自行保存凭据。

`save-dev` 只保存平台已接受的配置对象，不会猜测或重写编辑器生成的服务/组件结构。对上述开发契约的验收必须结合版本回读、官方编辑器和独立测试组织中的真实表单消费。

## 已安装插件

```bash
openyida plugin installed-get PLUGIN-XXX --json
openyida plugin configure PLUGIN-XXX --config .cache/openyida/plugin/install-config.json --expected-hash <configHash> --backup .cache/openyida/plugin/PLUGIN-XXX-install.before.json --confirm --json
openyida plugin enable PLUGIN-XXX --confirm --json
openyida plugin disable PLUGIN-XXX --confirm --json
openyida plugin upgrade PLUGIN-XXX --confirm --json
openyida plugin uninstall PLUGIN-XXX --confirm --json
```

每个写命令只请求一次并回读结果；超时或回读失败先查询实际状态，禁止盲目重放。安装配置文件视为敏感文件，放在 `.cache/openyida/plugin/`，不要提交。

平台实际语义是：停用后新场景不能再选择插件，已有使用场景可能仍不受影响。因此 `disable` 的回读只能证明安装状态变为停用，不能宣称已从所有运行时卸载。升级影响组织内所有应用，卸载会让组织应用无法再使用，应在明确授权和影响评估后执行。

当前 CLI 不提供从插件中心安装，因为市场目标、版本和授权契约尚未形成可安全回读的通用参数；使用官方插件中心安装并在随后用 `installed-get` 核对。

## 宿主懒加载

`lib/plugin/runtime-registry.js` 提供无全局状态的 `createPluginRuntimeRegistry`：按插件 ID、版本、HTTPS 入口及扩展点集合去重；同一加载中的请求共享 Promise，失败会清除缓存以允许人工修复后重试，版本变化会形成新实例，`invalidate` 只清指定插件/版本。每个页面或宿主创建自己的 registry，卸载或版本切换时只清自己的实例，避免污染其他页面。

拿到 `runtime-list` 注册项后，再由实际宿主的 Module Federation/脚本加载器作为 `loadEntry` 注入。该 helper 不决定脚本执行方式、不写 `window`、不绕过 CSP，也不把“registry 已返回模块”当成业务组件已渲染。最终必须在真实消费者中验收。

## 完成标准

- 查询：业务 payload 成功且目标插件、版本或安装项精确匹配。
- 创建/新版本：返回真实 ID/版本并回读，明确 `published=false`。
- 保存：备份成功、原摘要匹配、写入后扩展点与配置回读一致，未隐式发布。
- 启停/升级/卸载：写后安装列表读回符合预期，并说明组织级影响边界。
- 使用：持久化、资源、注册、消费者执行四层证据分别记录；缺哪层就明确缺哪层。
- 连接类组件：按官方规范核对真实字段 ID、服务输入四段结构、`content.outputs` 映射、动态数据源、参数替换、密钥加密和组件值类型；组织内测试不能替代插件中心上架审核。
