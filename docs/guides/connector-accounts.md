# 鉴权账号维护

`connector connection detail <connector-id> <connection-id> --json` 从平台账号列表读取唯一匹配账号，只返回 ID、名称、所属连接器、鉴权类型码和状态，不输出凭据。不会将平台详情接口的失败当作空账号。

更新默认只预览目标和新名称：

```sh
openyida connector connection update <connector-id> <connection-id> --name <名称> --json
```

核对后，在 TTY 终端隐藏输入完整替换凭据：

```sh
openyida connector connection update <connector-id> <connection-id> --name <名称> --confirm --interactive --json
```

命令不接受密钥参数，也不从列表回填旧密钥。账号类型和已保存的鉴权定义必须与连接器当前唯一鉴权定义匹配；更新接口只能替换名称和凭据，不能修改类型或鉴权定义。类型不匹配、定义不同或无法读取时，在输入凭据和写入前停止。例如旧 DingAuth 账号类型码为 4 时，需在原生账号管理页新建正确的类型 5 账号，核对后切换调用方绑定；原账号保持不变。命令不会自动迁移绑定。

写前重新核对账号元数据和连接器鉴权定义，单次提交后回读 ID、名称和类型。平台没有暴露账号更新的服务端 CAS，应协调其他编辑者。`metadataReadbackVerified` 只证明元数据匹配；`credentialsVerified: false` 表示仍需用合适的接口验证新凭据。响应丢失或回读不一致时保留原账号 ID 和只读核对命令，不自动重发。

用户在 AI 对话中配置真实账号时，仍优先打开 `connector create --json` 返回的 `accountManageUrl`，在宜搭原生页面填写，回复“已配置”后通过列表差异识别账号。不要将真实凭据发到聊天、文件、命令参数或日志。

当前 CLI 不执行账号删除。平台可用账号列表不等于依赖列表；在无法完整确认表单、页面、流程、自动化等引用时，不能据此断言账号可安全删除。
