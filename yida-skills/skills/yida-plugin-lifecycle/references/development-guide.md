# 宜搭插件开发规范

权威来源：[宜搭插件开发指南](https://docs.aliwork.com/docs/yida_support/_13/isxkg8bbkick91q7)。涉及连接类组件、插件服务、参数或鉴权设计时，先以该文档的最新版本为准，再结合平台接口回读；本参考只提炼 OpenYida 编排需要长期保留的契约。

## 生命周期顺序

官方开发链路是：新建插件 → 选择插件类型 → 注册插件服务 → 配置插件参数 → 前后端开发 → 发布到组织测试 → 提交插件中心上架。

- `openyida plugin create` 只创建连接类开发插件和默认版本。
- `save-dev` 只保存开发配置，不等于发布到组织、启用、消费者执行或插件中心上架。
- 前端扩展需要先构建 Module Federation `remoteEntry.js` 并托管相关 chunk，按下方部署分流选择发布方式并验证实际加载。
- 动态数据源目前不能只靠设计器预览完成验收；应先在独立测试目标发布到组织并启用，再到真实表单消费者验证。
- 创建新版本时版本号必须符合 `x.x.x`。在表单内调试过的处理函数仍需回填到目标插件版本并重新核对。
- 发布到组织、插件中心上架和审核仍使用官方编辑器，不由 CLI 推断成功。

## 前端资源部署分流与验收

以下是资源部署的编排建议，不代表宜搭已为所有账号开通某项托管服务。用户明确禁止或暂缓某渠道时排除该渠道；只要求编写引导、暂不测试时，停留在文档和配置准备，不执行构建、探测或部署。这些建议不授权自动创建公共仓库、上传源码或触发部署。具体创建入口、所需信息和逐步操作见[前端资源创建与部署引导](./frontend-hosting.md)。

1. **判断开发环境与已有资源**：先问是否已有可复用的企业静态资源服务器、HTTPS 域名及发布权限；有就优先复用，不要求迁移代码或另建 OSS。集团/非集团身份采用用户明确说明与已核实权限；宜搭页面域名、能访问内网或存在某个本地仓库不能单独证明具备集团发布权限。信息不足时只询问当前阻塞项，不推定身份；开发者身份也不等同于运行时的“官方插件”分类。
2. **集团开发环境**：建议通过已授权的内网代码仓库及资源发布流程（例如团队现有的 DEF/云构建流程）发布产物，使用其真实生成的 CDN 地址。资产 group、项目名和版本来自实际发布配置，不固定写成 `yida-components`，不编造目录。内网构建发布与资源仅限内网访问是两回事，发布后的资源仍须能被目标组织用户的浏览器加载。渠道未开通时引导联系团队发布管理员或插件接入负责人。
3. **非集团开发环境**：有企业静态资源服务器就沿用；没有时，国内默认推荐“码云存源码 + 阿里云 OSS 托管构建产物”，CDN 按实际需要添加。已有可用代码仓库无需为此迁移。GitHub Actions 构建 + Pages 托管是备选，不作为国内默认；Gitee Pages 已下线，不把码云仓库本身当作静态资源服务器。仓库首页、`blob` 查看页、Release 下载页都不能直接替代稳定脚本 URL。只上传可公开交付的构建产物，保留完整 chunks/CSS 目录及匹配的 publicPath；不要把集团内部代码或私有依赖自动发布到公共仓库。具体选择和创建步骤见部署引导，所有第三方渠道仍待宜搭宿主实测。
4. **核对插件加载契约**：区分官方插件的 CDN 路径拼接和第三方插件的完整 `cdnUrl` 加载；以当前平台实现和回读结果为准，不能仅从编辑器固定前缀推断最终请求地址。核对 Module Federation 容器名、扩展点模块导出及 chunks 路径；若当前宿主按插件 UUID 派生容器名，构建配置必须匹配，资产目录可自定义不代表容器名可任意命名。
5. **先验证再宣称可用**：依次验证保存后的 `cdnEntry`、运行时返回的 `cdnUrl`、浏览器实际资源请求及组件执行。检查 HTTPS、脚本响应类型、目标网络可达性，以及当前加载方式需要的 CORS/CSP 条件。组织测试和生产使用稳定 HTTPS 资源；本机 HTTP 地址只作为待验证的调试候选，不以 CLI 接受配置代替浏览器验收。
6. **接入要求不明确时**：向宜搭插件接入负责人或已有插件开发者咨询外部资源 URL 支持范围、部署示例、域名要求、版本更新和上架审核约定。复用上方已核实的发布渠道，不要求非集团开发者先取得阿里内网发布权限，也不承诺任意外部 URL 都能通过当前平台的保存及运行时校验。

### 第三方前端配置与构建契约

开发配置字段是 `frontEndDevInfo.cdnEntry`，运行时字段是 `cdnUrl`。例如自有静态站点的配置如下；地址、插件 ID 和扩展点均需替换为实际值，示例不能直接发布：

```json
{
  "frontEndDevInfo": {
    "cdnEntry": "https://static.example.com/calendar/1.0.0/remoteEntry.js",
    "extensions": [{ "extensionId": "yida.app.custom-page.component" }]
  },
  "backEndDevInfo": {},
  "paramConfig": {}
}
```

本轮核对的本地 `yida-plugin-sdk`（提交 `b2277ef`）提供以下实现证据，不代表已确认线上宿主正在使用此版本：

- `src/utils/plugin.helper.ts` 的 `isOfficialPlugin` 通过 `cdnUrl` 是否包含 `yida-components` 或 `teambition-fe` 分类。这是字符串包含判定，不是开发者身份或域名白名单；第三方 URL 恰好包含这些文字也可能走官方分支，不应为了通过校验而模仿官方目录。
- `src/plugin/runtime/plugin.ts` 的 `_generateRemoteConfigFromPlugin`：官方分支使用宿主 `cdnHost`、插件 group、id 和 version 拼入口；第三方分支原样使用完整 `plugin.cdnUrl`，容器名取 `plugin.uuid.split("-")[1]`。资产目录与容器名是不同概念，不能都固定成 `yida-components` 或随意选一个相同名称。
- `src/plugin/runtime/plugin.executor.ts` 的 `_getContainerId`：第三方按 UUID 派生容器名，再按实际场景选择导出模块。日历自定义页面示例需分别核对 `./app/custom-page` 和 `./designer/custom-page`，其他扩展点不能套用这两个模块名。
- 本地 `yida-single-app` 的 `OpenPluginFacadeImpl` 将保存的 `cdnEntry` 赋给运行时 `cdnUrl`，因此不能仅凭编辑器的固定前缀断言运行时必然拼接官方 CDN。

按上述 SDK 契约，示例插件 ID `PLUGIN-ABC123` 对应 webpack Module Federation 的 `name: "ABC123"`，而不是日历展示名称。构建时配置 `filename: "remoteEntry.js"` 与实际场景 `exposes`；使用 `output.publicPath: "auto"` 或与真实部署目录一致的绝对路径，连同生成的 chunks/CSS 一起部署。React 等依赖的 externals/shared 必须匹配实际宿主，不能仅凭编译成功认为可运行。以上是待当前宿主核验的构建要求，不是自动发布流程。

### CLI 探测结果怎么读

| 返回字段 | 含义与后续动作 |
|---|---|
| `plan.entry` | 保存回读的原始地址，不改写第三方完整 URL |
| `hostingGuide` | 随 CLI 安装的部署指南绝对路径；用于引导创建或复用资源，不代表命令会创建仓库或云资源 |
| `plan.urlResolution=verbatim` | 使用完整输入地址探测，不代表平台已允许此来源 |
| `official-default-candidate` | `/yida-components/` 或 `/teambition-fe/` 路径按默认 `https://g.alicdn.com` 生成候选；宿主 CDN 配置可能不同，须比对实际请求 |
| `unresolved-relative-path` | 自定义相对路径保留原值，不猜 CDN；查运行时和发布渠道取得真实完整地址 |
| `plan.localDebugOnly=true` | 本机 HTTP 候选，不作为组织发布资源；跨设备、HTTPS 页面、CSP/本地网络权限均需另验 |
| `plan.runtimeContract` | 来自上述本地 SDK 的分类与容器名提示；`verifiedInCurrentHost=false`，不是当前宿主检测结果 |
| `resource.reachable` / `javascriptContentType` | HEAD 的最终 2xx 与响应类型；HTML 页面即使 200 也不是脚本，缺失类型保持未知 |
| `nextAction` | `PROBE_EXPLICIT_VERSION`：补明确版本；`VERIFY_FRONTEND_ENTRY_AND_HOST`：核对入口和宿主；`VERIFY_RUNTIME_URL_AND_CONSUMER`：对照注册项后做真实消费验收 |

HEAD 不携带宜搭登录凭据到资源域名，不执行代码；限制重定向次数、拒绝 HTTPS 降级到 HTTP。HEAD 被拒绝（如 405）也不能直接断定浏览器 GET 失败，应在真实宿主查看网络请求。只读探测不会自动安装、发布、修改 CSP 或切换组织。

本轮验证范围是 CLI 单元测试和本机 HTTP 测试服务：覆盖 URL 保留、别名归一化、配置回读差异、相对路径不误拼接、HTML/JavaScript 响应区分与重定向。没有执行 GitHub Actions/Pages 部署，也没有新增第三方线上资源或宜搭消费者加载成功的证据；不可把这些本地测试写成第三方部署验收通过。

## 连接类组件数据契约

连接类组件由输入组件、输出组件和可选按钮组成。设计器负责把字段与插件服务的输入输出映射起来。

### 请求处理函数

`willFetch(vars)` 可从 `vars.data.<fieldId>` 读取表单组件值，并把服务输入序列化到 `vars.data.input`。不要把示例字段 ID 当成固定字段；先读取当前设计器中的真实唯一标识。

HTTP/HTTPS 插件服务的输入对象按目标 API 需要使用以下四个区域：

- `query`：查询字符串。
- `body`：请求体。
- `header`：请求头。
- `path`：替换 URL 中 `{name}` 形式的路径变量。

FaaS 服务同样通过 `vars.data.input` 传入业务参数，但参数形状由该服务自己的入参契约决定。OpenYida 不应把 HTTP 四段结构强行套到 FaaS 服务。

### 响应处理函数

`didFetch(content)` 从 `content.outputs` 读取插件服务结果，把目标值写入 `content.<fieldId>`，并返回更新后的 `content`。必须根据真实响应判断成功与失败，不能只因请求完成就写入组件。

动态选项数据源应返回由 `{ text, value }` 项组成的数组。单选、复选和普通输出字段的数据类型不同，应按官方附录中的组件传值结构核对，不把所有 `fieldData.value` 当成字符串。

### 动态数据源

设计器动态数据源调用使用 `/query/publicService/invokeExtService.json`，请求处理函数返回：

- `serviceUuid`：真实插件服务 ID。
- `pluginId`：真实插件 ID。
- `input`：序列化后的服务输入。
- `extensionId`：无目标扩展实例时为 `null`，有明确实例时使用真实值。

这段前端代码对安装插件的用户可见，禁止写入 Token、AppSecret、API Key 或其他凭据。

## 参数、常量与密钥

- 自定义参数在服务输入体中使用 `$参数名`；不要假设它在任意脚本位置都会替换。
- 系统常量包括 `$CORP_ID`、`$USER_ID`、`$ORG_ID`、`$DING_UID`，运行时由平台替换。
- 密钥参数必须标记为加密。开发者默认值会随插件提供给安装者；不希望共享自己的鉴权信息时必须清空默认值。
- 安装者启用后可以覆盖参数配置，因此消费验收必须使用目标组织的安装配置，不能只验证开发态默认值。
- `installed-get` 和运行时候选只输出脱敏结果；备份与配置文件放在 `.cache/openyida/plugin/` 且不得提交。

## HTTP 服务鉴权

平台文档列出的鉴权类型包括：无鉴权、Basic、API Key、阿里云 API 网关 AppCode、钉钉开放平台 AppKey/AppSecret。选择类型和参数位置必须匹配目标 API：

- Basic 的用户名和密码、API Key、AppCode、AppKey/AppSecret 都通过参数配置提供，不硬编码在处理函数。
- API Key 根据目标服务放入 query 或 header，并保留服务要求的前缀格式。
- 钉钉开放平台鉴权由平台生成访问令牌并注入请求头；不要在处理函数中再实现一套令牌生成和存储。

## 验收清单

1. `version-get` 能回读服务、扩展点、参数与版本，且版本号为 `x.x.x`。
2. 请求处理使用真实字段 ID，HTTP 输入的 query/body/header/path 与目标接口一致。
3. 响应处理读取 `content.outputs`，输出组件类型与官方传值结构一致。
4. 动态数据源使用真实 `pluginId`/`serviceUuid`，前端代码无凭据。
5. 密钥参数已加密且没有开发者凭据默认值；系统常量只用于受支持的服务输入位置。
6. 组织内发布、启用、安装配置、运行时候选和真实表单消费逐层验证；缺少哪层就明确记录哪层未证实。
7. 插件中心上架单独走官方审核，不把组织内测试成功写成已上架。
