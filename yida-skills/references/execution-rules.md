# 常见问题解决方案

| 问题 | 处理 |
| --- | --- |
| 发布提示登录失效 | 先 `openyida login`，再 `openyida publish <源文件> <appType> <formUuid> --health-check` |
| 查已有表单的字段 ID | 字段级命令优先内部解析；仅当歧义未解、页面/流程/公式/数据代码需要多字段映射，或要人工确认时，用 `openyida get-schema <appType> <formUuid> --compact --resolve-fields "字段名"`，只使用唯一命中的 `fieldId` |
| 更新已有表单字段 | 表单用 `create-form` 的 update/add-option/bind-datasource/validation/rule：`openyida create-form update <appType> <formUuid> '[{"action":"update","label":"备注","changes":{"required":true}}]'`；CLI 内部读 schema 并输出 resolved/updated evidence，通常不需要先 `get-schema` |
| 发布提示 corpId 不匹配 | 问用户：确认在当前组织继续操作已解析资源，或 `openyida logout` 后重新登录到正确组织 |


## 发布与验收证据

证据按环境、组织、appType 分别保留 CLI 原始回执，摘要不能替代。

### 主题上传与绑定

- 本轮上传须 `themeUpload.status=uploaded`、`uploadedThisRun=true`；核对应用/环境/组织、文件名、`sourceSha256/sourceBytes`、`cssUrl`，保存到执行记录或 `build-manifest.themeEvidence`。CSS 修改后旧回执失效。
- 源哈希对应实际上传字节；`resourceContentVerified=false` 表示未下载远端 CSS 比对，不表示上传失败或页面已加载。
- 绑定另须 `themeVerification.scope=configuration_readback`、`operation=bind_resource`、`verified=true`，`colour=custom`、主色符合设计、`customThemeStyle.enabled=true` 且 URL 与上传回执相同；导航单独回读。
- `not_requested` 或 `operation=preserve` 不证明本轮上传，即使 `verified=true`。已有主题只读核对并记录复用。上传结果 `unknown` 或绑定失败时保留资源/错误，先只读核实，不盲目重传。
- `app-settings --section theme` 只返回入口，其 `runtimeVerified=false` 及上传结果的 `runtimeVerification.verified=false` 均不诊断主题失败；`iframePropagation=false` 也不证明主题未加载。

### 本地浏览器验收

- 先核实 Agent 执行位置。仅用户本机的本地 Agent 可做浏览器验收；云端、沙箱、远程电脑或位置未知时禁止打开浏览器，即使 agent_browser=true、有登录态或页面公开。不注入 Cookie/storage state/CLI Token 绕过，不用 Playwright 或远程桌面补验。
- 各环境仍执行编译、发布回读、资源/配置核对及数据 query。远端将页面未验状态记在内部，交付业务结果与真实入口；不默认转为用户确认任务。入口卡片不是云电脑浏览器操作。
- 本地再核实已有浏览器工具、登录态和目标身份，检查受影响页面及交互，截图按需求留存。能力不足时记录原因，不临时安装工具，继续已授权操作、回读与交付。
- browser_handoff 仅交接入口；can_auto_use 和打开标签页都不证明验收通过。用户要求的页面验收未执行仍记未完成；权威 URL 经配置核对可登记交付，完整性检查 pass 不证明页面效果。
