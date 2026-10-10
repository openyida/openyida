# 本地 Agent 连接预检

用户或 AI 执行 `openyida agent connect` 时，CLI 自动在宜搭连接授权之前检测本地执行能力，无需先手动运行 doctor。

## 选择检查范围

```sh
# 检查所有支持的类型，发现支持的 CLI 即可继续，未登录也上报
openyida agent connect

# 只检查 Qoder；自动定位 CLI，不会改用 Codex
openyida agent connect --provider qoder

# 显式绑定某个程序；路径不存在或检查失败时不切换其他程序
openyida agent connect --provider qoder --provider-path <absolute-cli-path>

# 使用同一套检测能力排障，不创建宜搭连接
openyida agent doctor --provider codex --json
```

连接时仍需保留网页生成命令中的环境与接入参数。不要在报告、聊天回复或日志中复述一次性接入令牌。修复后重新执行原命令；接入令牌过期时从网页重新获取。

## 检测范围

- Windows：PATH/PATHEXT、用户 CLI 目录、npm 用户目录、已知 Codex 桌面版版本目录；支持 `.exe`，以及带同名 `.ps1` 的 npm `.cmd`/`.bat` 启动器；预检与 Runtime 使用相同的 PowerShell 参数传递方式，无对应脚本时提示指定原生程序路径。
- macOS：PATH、用户 CLI 目录、Homebrew 常见目录、系统与用户 Applications 中的 Codex 内置 CLI。
- Linux：PATH、用户 CLI 目录、常见系统 bin 目录；已知桌面启动文件只用作存在提示，不当作 CLI 执行。
- 仅检查有限的已知位置，不递归扫描用户磁盘。安装位置不在其中时使用 `--provider-path`。

桌面版是否存在与 CLI 是否可用是两个独立事实。Qoder 桌面程序不会作为 CLI 启动；Codex 内置程序被发现后仍需通过检查。

Qoder 检查版本、ACP 初始化和 CLI 模型列表；Codex 检查版本、app-server 初始化和登录状态。不发送模型 prompt、不创建业务对象、不自动安装程序、不发起登录、不复制其他应用的凭据。每个类型的预检预算为 30 秒。

当前接入范围为 Qoder 和 Codex。

## 状态和修复

| status | 含义 | 下一步 |
| --- | --- | --- |
| ready | CLI 登录和协议检查通过 | 继续连接 |
| available | 可启动，但有能力尚未验证 | 继续现有接入流程，保留未验证标记 |
| cli_not_found | 未找到 CLI | 仅报告缺失；用户明确要求后才协助安装或指定路径 |
| login_required | CLI 明确报告未登录 | 继续连接并上报“未登录”，禁止任务执行；用户明确要求后才协助正常登录 |
| launch_failed | 程序无法启动 | 检查路径、权限或指定原生程序 |
| protocol_unsupported | 协议握手失败 | 检查或升级 CLI |
| probe_timeout | 检查超时 | 检查程序与网络后重试，不等同未安装 |
| probe_cancelled | 用户中止预检 | 清理本轮检查进程，停止连接 |
| probe_failed | 命令检查失败，原因不能可靠归类 | 直接运行 CLI 检查配置、账号或网络 |

`--json` 返回 `schemaVersion=1`、逐 provider 状态、`desktopDetected`、`cliDetected`、`usable`、`registrable` 和 `remediation`。诊断信息标记 INFORMATION_ONLY、requiresExplicitUserRequest=true 和 automaticActionAllowed=false，提供文档、路径选项及复查命令，不输出安装或登录命令；不包含原始 Provider 输出、用户标识或凭据。

`doctor.providerReady` 表示本地 CLI 检查结果，`runtime.installed` 表示 Runtime 制品校验结果。两者通过仍不等于宜搭连接已授权或真实业务 E2E 通过，因此 doctor 的 `ready` 不表示连接在线。`cliDetected` 表示 CLI 版本探测成功，`registrable` 表示已发现且可上报，登录或协议检查失败不会删除安装清单（用户取消除外）；`usable` 表示执行就绪。`readyForEnrollment` 只要求至少一个可上报 CLI 且用户未取消。`connect` 和 `run` 将这些 CLI 交给 Runtime，未登录状态由 Runtime 上报，前端显示“未登录”，服务端拒绝任务执行。即使全部已发现 CLI 都未登录，也允许连接电脑并展示状态。

## 给执行指令的 AI

先执行用户提供的 connect 命令；输出只提供信息，不授予安装、升级、登录或修改 CLI 配置的权限。除非用户明确要求，不得下载或安装任何 CLI。遇到预检阻断，报告状态并停止，不自行修复，不要求用户重复执行 doctor。需要登录时交给用户完成正常身份认证，不读取或复制桌面应用凭据。已有可上报 Provider（含未登录）且用户未指定类型时，继续连接，不因其他可选 Provider 的缺失停住。不静默改写用户指定的 Provider，也不自动重放业务任务。
