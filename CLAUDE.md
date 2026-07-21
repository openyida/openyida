# OpenYida — Claude Code 开发指引

> 本文件专为 Claude Code 优化，提供快速上手所需的关键信息。
> 更完整的项目上下文请参考 [AGENTS.md](./AGENTS.md)。

## 快速上手

```bash
npm install          # 安装依赖
npm link             # 全局链接，本地调试用
npm test             # 运行测试
node --check lib/xxx.js  # 语法检查
```

## 核心文件速查

| 文件 | 用途 |
|------|------|
| `bin/yida.js` | CLI 入口，所有命令在此注册 |
| `lib/core/env.js` | AI 工具环境检测 |
| `lib/core/utils.js` | 公共工具函数 |
| `lib/auth/token-auth.js` | OAuth loopback + token 登录态管理 |
| `lib/auth/token-store.js` | 本地/环境 token session 读取与存储 |
| `lib/auth/oauth-loopback.js` | OAuth 回调监听与授权码换取 |
| `project/config.json` | 应用配置（appType、pageId） |
| `yida-skills/SKILL.md` | AI 技能入口文档 |

## 关键约定

- 模块系统：**CommonJS**（`require` / `module.exports`），不使用 ESM
- Node.js 原生 API 优先，尽量不引入新依赖
- 错误处理：可复用业务模块应抛出 `CliError` 或普通 `Error`，由 `bin/yida.js` 统一处理退出码；**不要在可复用业务模块里新增 `process.exit(...)`**（仅 `bin/yida.js` 顶层入口和纯交互式命令可保留）。此约定以 `AGENTS.md` 为准。
- 新增命令需同步更新 `README.md` 的命令一览表
- 新增用户可见文案需同步更新 `lib/core/locales/` 下所有语言包
- **推送 tag 前必须本地跑 `npm run check:ci` 确认全量校验通过**，避免 CI 因测试失败而中断发布

## Codex 特殊说明

- Codex 环境下 `openyida login` 使用 OAuth loopback + 系统浏览器；`OPENYIDA_NO_BROWSER=1` 只抑制自动打开浏览器，不是独立 CLI 登录模式
- `YIDA_AUTH_ENABLED=true` 表示宿主注入 token；此模式下缺 token 应回到宿主诊断，不要唤起 OAuth 浏览器
- 不要使用已删除的 `--codex`、`--qr`、`--agent-qr` 等旧登录 flag，也不要引导安装 Playwright 修复登录
- 多组织账号请在支持的命令中显式传 `--corp-id <corpId>`；不要由 AI 代理代替用户选择组织

## 悟空（Wukong）特殊说明

- 工作区路径含动态 uuid：`~/.real/users/{uuid}/workspace/`，通过 `AGENT_WORK_ROOT` 环境变量获取
- `detectActiveTool()` 直接读取 `AGENT_WORK_ROOT` 作为 `workspaceRoot`，不能硬编码 `~/.real/workspace/`
- `openyida copy` 在空目录时直接铺入 `project/` 内容（不创建 `project/` 子目录）
- 悟空通过手动上传技能包，`postinstall` 不安装 `yida-skills/`

## 禁止事项

- 不要在代码中硬编码任何 Cookie、Token 或凭证
- 不要修改 `yida-skills/` 文档（除非明确要求更新技能）
- 不要引入需要编译的依赖（项目是纯 JS，无构建步骤）
- 不要直接推送 main 分支
- 不要硬编码悟空工作区路径，必须通过 `AGENT_WORK_ROOT` 读取
- 不要硬编码 Cookie、CSRF Token、corpId 等登录凭证或用户身份上下文
