---
name: yida-plugin-lifecycle
description: 管理宜搭平台“插件管理”中的开发插件、版本配置、安装状态与运行时注册查询；前端构建、托管与加载排查交给 yida-plugin-frontend-deploy。仅在用户明确指向宜搭平台插件时使用；npm 包、Codex/AI 工具插件、连接器本身或普通页面组件不触发。
---

# 宜搭平台插件开发、管理与使用

本技能处理宜搭平台管理后台的“插件管理”，不是 npm、浏览器扩展或 AI 工具插件。开始前核对登录组织；插件操作是组织级影响，不能借应用级授权推定组织级写权限。

连接类组件的服务、输入输出映射、参数与鉴权设计，先读[宜搭插件开发规范](./references/development-guide.md)。前端构建、托管或加载排查时，通过 `use_skill("yida-plugin-frontend-deploy", "构建、托管或排查插件前端资源")` 加载部署技能；本技能接收其真实资源地址并负责平台配置保存。CLI 生命周期接口不能替代官方编辑器中的组件设计和组织内真实测试。

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

`extensions` 返回真实扩展点目录，配置版本前先查询，不猜 ID。`probe --check-resource` 只检查资源 HEAD，不执行脚本；解析候选地址、响应类型或未验证容器名时，读取[前端部署技能的探测契约](../yida-plugin-frontend-deploy/references/frontend-contract.md#cli-探测结果怎么读)。未获测试授权时不要执行探测。

`runtime-list` 会隐藏安装配置值，只说明是否存在配置，并原样保留启停状态；不要把加密参数、令牌或连接凭据写进对话、日志或仓库。

## 开发与版本配置

当前平台通用创建入口为 `ConnectorPlugin`。创建只生成开发资源和默认版本，不发布、不安装：

```bash
openyida plugin create --name '订单连接器插件' --description '提供订单能力' --logo 'https://...' --confirm --json
openyida plugin create-version PLUGIN-XXX --version 1.1.0 --description '新增查询能力' --confirm --json
```

修改版本前先 `version-get`，使用其 `snapshotHash` 做乐观并发校验。配置文件仅接受 `frontEndDevInfo`、`backEndDevInfo`、`paramConfig`；未知字段和未知扩展点拒绝。此命令保存完整三段配置，不是局部 PATCH；以回读对象为基础保留无关字段，省略的段会提交为空对象。

保存字段使用 `frontEndDevInfo.cdnEntry`；CLI 兼容 `cdnUrl` 输入并转换成 `cdnEntry`，两字段值冲突则拒绝。完整 HTTPS 地址不改域名、不补官方前缀。保存前再次读取、写入不覆盖备份，保存后核对目标插件/版本及三段配置；服务端改写资源地址或配置会报 `PLUGIN_READBACK_MISMATCH`。此时写入可能已经发生，先回读排查，不自动重试或恢复备份；不会顺带发布。

尚无稳定前端资源地址时，通过 `use_skill("yida-plugin-frontend-deploy", "选择托管渠道并准备稳定资源入口")` 完成渠道选择与创建指导；拿到真实入口后再继续以下保存步骤。构建、资源部署和平台发布是独立操作，不因保存配置而自动执行。

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

按[开发规范](./references/development-guide.md)核对真实字段、服务输入输出、动态数据源、参数加密和鉴权。`save-dev` 只保存平台已接受的配置对象，不会猜测或重写编辑器生成的服务/组件结构；验收需结合版本回读、官方编辑器和独立测试组织中的真实表单消费。

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

## 完成标准

- 查询：业务 payload 成功且目标插件、版本或安装项精确匹配。
- 创建/新版本：返回真实 ID/版本并回读，明确 `published=false`。
- 保存：备份成功、原摘要匹配、写入后扩展点与配置回读一致，未隐式发布。
- 启停/升级/卸载：写后安装列表读回符合预期，并说明组织级影响边界。
- 使用：持久化、资源、注册、消费者执行四层证据分别记录；缺哪层就明确缺哪层。
- 连接类组件：按官方规范核对真实字段 ID、服务输入四段结构、`content.outputs` 映射、动态数据源、参数替换、密钥加密和组件值类型；组织内测试不能替代插件中心上架审核。
