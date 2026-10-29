# 常见问题解决方案

| 问题 | 处理 |
| --- | --- |
| 发布提示登录失效 | 先 `openyida login`，再 `openyida publish <源文件> <appType> <formUuid> --health-check` |
| 查已有表单的字段 ID | 字段级命令优先内部解析；仅当歧义未解、页面/流程/公式/数据代码需要多字段映射，或要人工确认时，用 `openyida get-schema <appType> <formUuid> --compact --resolve-fields "字段名"`，只使用唯一命中的 `fieldId` |
| 更新已有表单字段 | 表单用 `create-form` 的 update/add-option/bind-datasource/validation/rule：`openyida create-form update <appType> <formUuid> '[{"action":"update","label":"备注","changes":{"required":true}}]'`；CLI 内部读 schema 并输出 resolved/updated evidence，通常不需要先 `get-schema` |
| 发布提示 corpId 不匹配 | 问用户：确认在当前组织继续操作已解析资源，或 `openyida logout` 后重新登录到正确组织 |

## 发布与验收证据

按环境、组织、appType 保存本轮 CLI 原始回执。

### 主题上传与绑定

- 上传成功须 `themeUpload.status=uploaded`、`uploadedThisRun=true`。核对目标、文件名、`sourceSha256/sourceBytes` 和 `cssUrl`，保存到执行记录或 `build-manifest.themeEvidence`；CSS 变更后重新上传。
- 绑定成功须 `themeVerification.scope=configuration_readback`、`operation=bind_resource`、`verified=true`，且 `colour=custom`、主色符合设计、`customThemeStyle.enabled=true`、URL 与上传回执一致；导航单独回读。
- `not_requested` / `operation=preserve` 按已有主题复用记录。上传 `unknown` 或绑定失败时保留 appType、资源和错误，先只读核实，再决定是否重试。
- `sourceSha256` 对应实际上传字节；`resourceContentVerified=false` 表示远端文件内容尚未比对。`runtimeVerified=false` / `runtimeVerification.verified=false` 表示页面未验，`iframePropagation` 是配置；均不能单独诊断主题加载失败。`app-settings --section theme` 仅提供入口。

### 本地浏览器验收

- 先读取 `builder_path.browser_verification` 并核实执行位置。浏览器验收仅限用户本机 Agent，使用已有工具、登录态和正确目标；云端、沙箱、远程或未知位置一律跳过，即使有浏览器、登录态或公开 URL，也不得打开。能力不足时记录待验，不安装工具或注入凭据补验。
- 各环境均执行编译、发布回读、资源/配置核对和数据 query。云端的页面未验状态留在内部，按[完成总结](user-facing-summary.md)交付业务结果与真实入口，不默认交给用户补验。
- 运行态通过须有页面和交互证据；`browser_handoff`、打开标签页及完整性检查只证明各自结果。用户明确要求的页面验收未执行时，记录未完成；入口按权威 URL 及配置回读登记。
