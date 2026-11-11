# API Key 鉴权与旧配置修补

新建 API Key 连接器时，CLI 为 `ApiKeyAuth` 同时保存 `name/location/type/in`。账号密钥以 `name` 为键保存；例如 `name=Authorization` 对应 `{"Authorization":"Bearer ..."}`。Header 和 Query 均遵循此规则，不添加或删除用户提供的 Bearer 前缀。

已有旧连接器若缺少 `type/in/location`，普通 `create-connection` 会在写入前停止。先通过 `openyida connector detail <id> --json` 核对 `name` 和位置，再显式修补并创建替代账号：

```sh
openyida connector create-connection <id> "替代账号" --api-key "FAKE_PROBE" --repair-api-key-scheme --json
```

上例仅为假值示例。修补保留已有动作与其他连接器定义，经完整回读核对后才创建新账号。缺失 name、冲突位置或不支持的类型不会被猜测修复。修补失败时不会创建账号。

**旧账号不会自动更新。** 账号保存了创建时的鉴权配置副本；修补连接器后，仍需将自动化、Canvas 或其他调用方重新绑定至本次返回的新账号 ID，再验证上游确实收到鉴权信息。CLI 不会自动删除、更新或重绑旧账号。若修补成功而后续账号创建失败，先查询已有账号，再决定后续操作。

本修复不修改平台超时语义、运行时 Header 默认值或 DingAuth 行为。上传配置读回成功不等同于上游鉴权已通过。

## 真实回归

真实用例见 `scripts/e2e-real/issue-560-479.js`，启用条件同[应用迁移回归](application-import.md#真实回归)，设置 `OPENYIDA_E2E_ISSUE_CASES=560` 可单独执行。用例分别创建 Header/Query 连接器及随机假值账号，并验证旧配置修补和替代账号创建。`OPENYIDA_E2E_CONFIG_ONLY=1` 仅执行配置链路，结果保持 partial、非零退出，不能当成运行时验证。

完整运行会使用本机 `cloudflared` 将只返回假值匹配结果的回显服务临时暴露为 HTTPS，核验 fixture 标记后才调用；服务不转发或回显真实凭据。也可设置受控的 `OPENYIDA_E2E_FIXTURE_URL`，它须实现 `/echo`，返回本轮 `fixtureRunId` 和 `observed.header/query` 布尔值。用例通过平台 `testOperation` 和 `invokeService` 两条通道核对假值是否实际注入。临时服务在结束后关闭；远端测试连接器和账号保留登记，不自动删除或重绑业务资源。

无法建立本机隧道时，可显式设置 `OPENYIDA_E2E_FIXTURE_KIND=httpbin`，使用公共 `https://httpbin.org/anything/<runId>` 回显接口。此模式只发送生成的随机假值账号，校验响应中的精确路径与实际 Header/Query 值；原始值只在内存比较，证据文件保存匹配布尔值。CLI 脱敏输出仍保持开启，另通过相同的 `testOperation` API 验证原始响应。公共回显服务不属于本轮受控资源，不应用于真实密钥测试。

只启动本机服务可执行 `node scripts/e2e-real/issue-560-479.js --serve-echo`，默认监听 `127.0.0.1:18760`。通过 `OPENYIDA_E2E_ECHO_PORT` 修改端口；通过 `OPENYIDA_E2E_ISSUE_RUN_ID` 复用对应测试登记中的随机假值。`/health` 返回测试标记，`/echo` 仅返回 Header/Query 是否匹配，不回显任意请求头或凭据。此模式不登录、不创建远端资源；localhost 启动不代表宜搭服务端可访问。
