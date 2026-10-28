# 宜搭插件前端构建与加载契约

适用于已明确的宜搭平台插件。托管渠道与创建步骤见[部署引导](./frontend-hosting.md)，配置保存和组织级操作见[生命周期技能](../../yida-plugin-lifecycle/SKILL.md#开发与版本配置)。

## 第三方前端配置与构建契约

开发字段为 `frontEndDevInfo.cdnEntry`，运行时为 `cdnUrl`。以下地址、组件名需替换；后端和参数配置保留真实回读，不能照抄空对象：

```json
{
  "frontEndDevInfo": {
    "cdnEntry": "https://static.example.com/calendar/1.0.0/remoteEntry.js",
    "extensions": [
      { "extensionId": "yida.designer.custom-page.component" },
      { "extensionId": "yida.app.custom-page.component", "config": { "componentNameList": ["OpenYidaCalendarView"] } }
    ]
  },
  "backEndDevInfo": {},
  "paramConfig": {}
}
```

同时配置设计态和运行态扩展。运行态的 `config.componentNameList` 必须匹配 `addComponent` 注册名：日历为 `OpenYidaCalendarView`，时间线为 `OpenYidaStickyTimeline`。发布后核对运行时 config 和真实页面，不把勾选扩展点当成配置完成。

显式设置同名 `displayName`，如 `StickyTimeline.displayName = "OpenYidaStickyTimeline"`；不依赖压缩前函数名。检查设计器日志及面板是否出现组件。

此前核对的本地 `yida-plugin-sdk`（提交 `b2277ef`）提供以下实现证据，不代表已确认线上宿主正在使用此版本：

- `src/utils/plugin.helper.ts` 的 `isOfficialPlugin` 按 URL 是否包含 `yida-components` 或 `teambition-fe` 分类；这是字符串判定，不是身份或域名白名单，不应模仿官方目录。
- `src/plugin/runtime/plugin.ts` 的 `_generateRemoteConfigFromPlugin`：官方入口按宿主 CDN/group/id/version 拼接；第三方保留完整 `plugin.cdnUrl`，容器名为 `plugin.uuid.split("-")[1]`，与资产目录分开配置。
- `src/plugin/runtime/plugin.executor.ts` 的 `_getContainerId`：自定义页面导出 `./app/custom-page`、`./designer/custom-page`；其他扩展点核对实际场景。
- 本地 `yida-single-app` 的 `OpenPluginFacadeImpl` 将 `cdnEntry` 赋给 `cdnUrl`；不能凭编辑器前缀推断运行时拼官方 CDN。

`PLUGIN-ABC123` 对应 Module Federation 的 `name: "ABC123"`。设置 `filename: "remoteEntry.js"`、实际场景 `exposes`、`publicPath: "auto"` 或真实部署目录，上传全部 chunks/CSS。React externals/shared 必须匹配当前宿主；编译不等于加载成功。

容器名可能以数字开头，webpack 默认 `var` 库会构建失败。使用 `library: { type: "window", name: containerName }` 保留原名；加下划线会与宿主 UUID 查找不符。构建后核对两个场景的浏览器执行。

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

HEAD 不带宜搭凭据、不执行脚本；限制重定向并拒绝 HTTPS 降级。405 需另验浏览器 GET。探测不安装、发布、改 CSP 或切组织。

[吸顶时间线样例](https://github.com/openyida/yida-plugin-sticky-timeline/blob/main/docs/validation.md) 0.0.4 已通过 Pages、组织发布启用、设计器拖入、真实运行与吸顶验证；其他消费者交互仍须独立验收。

未指定版本且基础信息没有开发配置时返回 `PROBE_EXPLICIT_VERSION`，先查询明确版本，不以缺失字段推断未配置。`runtime-list` 候选项还需核对启用态，不能代替当前页面消费。

## 真实宿主验收（获准后）

核对 `cdnEntry`、运行时 `cdnUrl`、实际入口/chunks 和交互，检查 HTTPS、类型、网络、CORS/CSP。组织部署使用稳定 HTTPS；保存、HEAD、注册均不能替代消费者执行。吸顶组件另验中间祖先的 `overflow:hidden`，优先在组件内兼容，不全局修改宿主布局。

## 宿主懒加载

`lib/plugin/runtime-registry.js` 的 `createPluginRuntimeRegistry` 按插件 ID、版本、HTTPS 入口和扩展点集合去重，共享加载 Promise；失败清缓存，版本变化建新实例，`invalidate` 只清指定插件/版本。每页独立创建，无全局状态。

实际宿主将 Module Federation/脚本加载器作为 `loadEntry` 注入；helper 不写 `window` 或绕过 CSP。返回模块后仍需验证业务组件渲染。
