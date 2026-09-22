# DWS 登录态交接协议

本文面向 DWS 集成方。OpenYida 提供独立的宜搭登录 profile，不要求普通 CLI 用户了解交接协议。

## 能力探测

```bash
openyida auth sync-dws --capabilities --json
```

返回：

```json
{"protocol_version":1,"private_stdin":true,"independent_profile":true}
```

此探测不读取凭证、不请求服务端、不修改 profile。DWS 在传递凭证前先检查协议能力；认证交接使用私有 stdin，不能把凭证放入模型上下文或工具输出。

CLI 协议支持与宿主技能发现是独立条件。能力探测成功不代表宿主已安装或发现宜搭技能，也不代表用户已登录。

## 交接后的核对

DWS prepare 返回 ready 后，在相同任务目录检查 `openyida agent-capabilities --summary-json`：登录状态可用，credential_source 为 dws，环境、组织、用户与交接结果匹配，session_expires_at 尚未过期。ready 只表示认证准备完成，不表示应用已创建或发布。

## Beta 验证边界

本协议能力随 CLI 包发布；宿主的 DWS 版本、技能路由和运行权限由宿主集成负责。千问办公的本地 DWS 替换和技能移位属于本机测试配置，不随 npm 包分发，也不表示千问办公官方发行版已经接入。
