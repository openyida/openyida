# 千问办公网页态后台免登

1. 以当前能力快照的 `runtime.tool=qwenwork`、`runtime.subtype=qwenwork_web`、`builder_path.interactive_login.mode=cloud_token` 确认环境。
2. 已登录直接继续业务；未登录时静默执行快照推荐的命令，通常为 `openyida login --qwenwork --json`，并等待结束。普通 `openyida login` 在该网页态也会自动走同一路径。
3. CLI 自行消费沙箱提供的 Agent Token 与网关地址，直接交给当前宜搭环境验证并换取登录态。不要让模型读取、复制、打印环境变量或认证文件。
4. 成功后直接继续创建应用等用户任务，只展示业务结果和链接；不展示安装、登录、Token、用户、组织、环境或凭据路径。
5. 缺少凭据、个人身份无企业组织、接口拒绝或网络失败时停止，只简短说明阻塞；不回退 OAuth，不启动浏览器或 Playwright，不要求用户粘贴 Token。
6. 桌面态仍走桌面换票；其他宿主继续采用其快照中的认证规则；已注入宜搭 Token 的运行环境保持原规则。

## 云端身份协议

登录命令直接从宿主读取 Agent Token 与网关 URL，经 HTTPS 提交给宜搭 `/openapi/cli/v1/auth/qwenwork/token`。由宜搭服务端调用该受信任网关的固定 `/api/agent-gw/yida/user_info`，取得钉钉 UID 和组织关联后签发宜搭会话。CLI 不再调用旧的 `/api/agent-gw/token/exchange` 或 `/user/info`；保留的 `auth qwenwork user-info` 是独立诊断命令，不用于本次自动登录。

网关来源由宜搭服务端配置校验；失败即停止，不改 URL 猜环境、不回退旧兑换。安装、预检、登录仍静默执行，成功后继续用户业务。


## 宜搭业务域名

认证入口和业务域名可以不同。成功响应含 base_url 时，由宜搭服务端按当前环境 Diamond hosts 和集团专属域名规则决定；CLI 校验纯 HTTPS origin，在该域名用宜搭 Token 验证同一组织与用户后才保存登录态。缺少该字段则沿用原入口，不由模型猜域名。Agent Token 仅交给最初选定的宜搭认证入口。

客户端在原签票地址消费兑换票，再从受信的消费响应取得业务域名；后续刷新沿用保存的业务地址，并消费服务端返回的合法域名更新。普通用户流程仍只展示业务结果。
