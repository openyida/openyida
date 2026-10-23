# 宜搭插件前端构建与加载契约

适用于已明确的宜搭平台插件。托管渠道与创建步骤见[部署引导](./frontend-hosting.md)，配置保存和组织级操作见[生命周期技能](../../yida-plugin-lifecycle/SKILL.md#开发与版本配置)。

## 第三方前端配置与构建契约

开发配置字段是 `frontEndDevInfo.cdnEntry`，运行时字段是 `cdnUrl`。例如自有静态站点的配置如下；地址、插件 ID 和扩展点均需替换为实际值，示例不能直接发布。空对象仅演示字段形状，实际保存必须保留回读中的后端和参数配置：

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

此前核对的本地 `yida-plugin-sdk`（提交 `b2277ef`）提供以下实现证据，不代表已确认线上宿主正在使用此版本：

- `src/utils/plugin.helper.ts` 的 `isOfficialPlugin` 通过 `cdnUrl` 是否包含 `yida-components` 或 `teambition-fe` 分类。这是字符串包含判定，不是开发者身份或域名白名单；第三方 URL 恰好包含这些文字也可能走官方分支，不应为了通过校验而模仿官方目录。
- `src/plugin/runtime/plugin.ts` 的 `_generateRemoteConfigFromPlugin`：官方分支使用宿主 `cdnHost`、插件 group、id 和 version 拼入口；第三方分支原样使用完整 `plugin.cdnUrl`，容器名取 `plugin.uuid.split("-")[1]`。资产目录与容器名是不同概念，不能都固定成 `yida-components` 或随意选一个相同名称。
- `src/plugin/runtime/plugin.executor.ts` 的 `_getContainerId`：第三方按 UUID 派生容器名，再按实际场景选择导出模块。日历自定义页面示例需分别核对 `./app/custom-page` 和 `./designer/custom-page`，其他扩展点不能套用这两个模块名。
- 本地 `yida-single-app` 的 `OpenPluginFacadeImpl` 将保存的 `cdnEntry` 赋给运行时 `cdnUrl`，因此不能仅凭编辑器的固定前缀断言运行时必然拼接官方 CDN。

按上述 SDK 契约，示例插件 ID `PLUGIN-ABC123` 对应 webpack Module Federation 的 `name: "ABC123"`，而不是日历展示名称。构建时配置 `filename: "remoteEntry.js"` 与实际场景 `exposes`；使用 `output.publicPath: "auto"` 或与真实部署目录一致的绝对路径，连同生成的 chunks/CSS 一起部署。React 等依赖的 externals/shared 必须匹配实际宿主，不能仅凭编译成功认为可运行。以上是待当前宿主核验的构建要求，不是自动发布流程。

CLI 当前为 `http://localhost`、`http://127.0.0.1`、`http://0.0.0.0` 和 `http://[::1]` 放行 HTTP，普通 HTTP 域名仍拒绝。这只是 CLI 校验行为，不证明浏览器或插件宿主能够加载；本机调试地址不能作为组织发布后的稳定资源地址。

## CLI 探测结果怎么读

| 返回字段 | 含义与后续动作 |
|---|---|
| `plan.entry` | 保存回读的原始地址，不改写第三方完整 URL |
| `hostingGuide` | 随 CLI 安装的前端部署技能入口绝对路径；用于引导创建或复用资源，不代表命令会创建仓库或云资源 |
| `plan.urlResolution=verbatim` | 使用完整输入地址探测，不代表平台已允许此来源 |
| `official-default-candidate` | `/yida-components/` 或 `/teambition-fe/` 路径按默认 `https://g.alicdn.com` 生成候选；宿主 CDN 配置可能不同，须比对实际请求 |
| `unresolved-relative-path` | 自定义相对路径保留原值，不猜 CDN；查运行时和发布渠道取得真实完整地址 |
| `plan.localDebugOnly=true` | 本机 HTTP 候选，不作为组织发布资源；跨设备、HTTPS 页面、CSP/本地网络权限均需另验 |
| `plan.runtimeContract` | 来自上述本地 SDK 的分类与容器名提示；`verifiedInCurrentHost=false`，不是当前宿主检测结果 |
| `resource.reachable` / `javascriptContentType` | HEAD 的最终 2xx 与响应类型；HTML 页面即使 200 也不是脚本，缺失类型保持未知 |
| `nextAction` | `PROBE_EXPLICIT_VERSION`：补明确版本；`VERIFY_FRONTEND_ENTRY_AND_HOST`：核对入口和宿主；`VERIFY_RUNTIME_URL_AND_CONSUMER`：对照注册项后做真实消费验收 |

HEAD 不携带宜搭登录凭据到资源域名，不执行代码；限制重定向次数、拒绝 HTTPS 降级到 HTTP。HEAD 被拒绝（如 405）也不能直接断定浏览器 GET 失败，应在真实宿主查看网络请求。只读探测不会自动安装、发布、修改 CSP 或切换组织。

此前记录的验证范围是 CLI 单元测试和本机 HTTP 测试服务：覆盖 URL 保留、别名归一化、配置回读差异、相对路径不误拼接、HTML/JavaScript 响应区分与重定向。没有执行 GitHub Actions/Pages 部署，也没有新增第三方线上资源或宜搭消费者加载成功的证据；不可把这些本地测试写成第三方部署验收通过。

未指定版本且基础信息没有开发配置时返回 `PROBE_EXPLICIT_VERSION`，先查询明确版本，不以缺失字段推断未配置。`runtime-list` 候选项还需核对启用态，不能代替当前页面消费。

## 真实宿主验收（获准后）

依次对照保存回读的 `cdnEntry`、运行时返回的 `cdnUrl`、浏览器实际入口/chunks 请求和组件交互。检查 HTTPS、JavaScript 响应类型、目标用户网络可达性及当前加载方式需要的 CORS/CSP；不要通过放宽安全策略掩盖错误来源。注册候选可见、HEAD 成功或配置保存都不能替代浏览器执行。组织测试与生产应使用稳定 HTTPS 资源，本机 HTTP 仅作为待验证的调试候选。

## 宿主懒加载

`lib/plugin/runtime-registry.js` 提供无全局状态的 `createPluginRuntimeRegistry`：按插件 ID、版本、HTTPS 入口及扩展点集合去重；同一加载中的请求共享 Promise，失败会清除缓存以允许人工修复后重试，版本变化会形成新实例，`invalidate` 只清指定插件/版本。每个页面或宿主创建自己的 registry，卸载或版本切换时只清自己的实例，避免污染其他页面。

拿到 `runtime-list` 注册项后，再由实际宿主的 Module Federation/脚本加载器作为 `loadEntry` 注入。该 helper 不决定脚本执行方式、不写 `window`、不绕过 CSP，也不把“registry 已返回模块”当成业务组件已渲染。最终必须在真实消费者中验收。
