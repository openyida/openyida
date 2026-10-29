# 千问办公网页态免登与普通登录回退

1. 以当前能力快照的 `runtime.tool=qwenwork`、`runtime.subtype=qwenwork_web`、`builder_path.interactive_login.mode=cloud_token` 确认环境。
2. 已登录直接继续业务；未登录时静默执行快照推荐的命令，通常为 `openyida login --qwenwork --json`，并等待结束。普通 `openyida login` 在该网页态也会自动走同一路径。
3. CLI 自行消费沙箱提供的 Agent Token 与网关地址，直接交给当前宜搭环境验证并换取登录态。不要让模型读取、复制、打印环境变量或认证文件。
4. 成功后直接继续创建应用等用户任务，只展示业务结果和链接；不展示安装、登录、Token、用户、组织、环境或凭据路径。
5. 缺少或无效凭据、服务端解密或身份兑换被拒绝、网络失败和超时，由同一个 CLI 进程回退现有普通 OAuth。命令会保持运行直到授权完成；不要另起一个登录进程。云端无桌面浏览器时，按能力快照的 `interactive_login.oauth_fallback` 使用 Agent Browser 打开 CLI 输出的授权 URL；没有可用浏览器或回调不可达时说明阻塞，不要求用户粘贴 Token。
6. `--check-only` 只检查既有登录态，不兑换、不触发 OAuth。endpoint 不合法、签发响应不符合协议或显式组织／用户不匹配时仍报错；OAuth 回退继续保留原 endpoint、profile 和身份约束，完成服务端校验后才保存。
7. 桌面态仍走桌面换票；其他宿主继续采用其快照中的认证规则；已注入宜搭 Token 的运行环境保持原规则，包括显式 `OPENYIDA_AUTH_MODE=token` 的限制。

## 云端身份协议

登录命令直接从宿主读取 Agent Token 与网关 URL，经 HTTPS 提交给宜搭 `/openapi/cli/v1/auth/qwenwork/token`。由宜搭服务端调用该受信任网关的固定 `/api/agent-gw/yida/user_info`，取得钉钉 UID 和组织关联后签发宜搭会话。CLI 不再调用旧的 `/api/agent-gw/token/exchange` 或 `/user/info`；保留的 `auth qwenwork user-info` 是独立诊断命令，不用于本次自动登录。

网关来源由宜搭服务端配置校验；免登认证失败后仅回退正常 OAuth，不改 URL 猜环境、不调用旧兑换协议。OAuth 也失败时停止，保留脱敏云端诊断和回退失败标记，不回显授权参数、异常原文或凭据。成功后继续用户业务。


## 宜搭业务域名

认证入口和业务域名可以不同。成功响应含 base_url 时，由宜搭服务端按当前环境 Diamond hosts 和集团专属域名规则决定；CLI 校验纯 HTTPS origin，在该域名用宜搭 Token 验证同一组织与用户后才保存登录态。缺少该字段则沿用原入口，不由模型猜域名。Agent Token 仅交给最初选定的宜搭认证入口。

客户端在原签票地址消费兑换票，再从受信的消费响应取得业务域名；后续刷新沿用保存的业务地址，并消费服务端返回的合法域名更新。普通用户流程仍只展示业务结果。
