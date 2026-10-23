# 一起改进 OpenYida / Contributing

欢迎！你描述问题，AI 帮你整理；愿意的话，我们再一起把它修好。不会写代码、没有源码或还没有 GitHub 账号，都可以先开始。

- **遇到问题了**：告诉我们原本想做什么、实际发生了什么、希望怎样。填写 [问题表单](https://github.com/openyida/openyida/issues/new?template=bug_report.yml)，技术信息不清楚可以留空。
- **希望体验更好**：填写 [建议表单](https://github.com/openyida/openyida/issues/new?template=feature_request.yml)，说使用场景，不用设计命令或参数。
- **想一起改进**：欢迎提交 PR（把修改交给项目审阅）。错别字、文档、Skill 提示词和代码修复都很有价值；已有具体改动可直接提 PR，无需先建 Issue。

只反馈问题也完全可以，是否贡献代码不影响反馈处理。提交和合并是两件事，维护者会审阅改动，不保证每个建议都会合入。

<a id="ai-help"></a>
## 让 AI 陪你完成第一次贡献

把下面这段话发给正在使用的 AI 工具，并附上 Issue 链接（还没有可以省略）：

> 我想帮 OpenYida 改进这个问题，但不熟悉 Git 和代码。请先解释问题和预计改动，再用公开的 openyida/openyida 源码尝试最小修复并验证。请把问题发生时的环境与现在的环境分开记录，不知道的写未知。找到可验证的改进后，给我看修改内容、真实测试结果和将公开的文字与截图；经我确认后，再通过我的个人 Fork 提交 PR 并关联这个 Issue。请保留客户数据、凭证和内部源码在本地。不能修复时就说明原因，帮我完善 Issue，不要为了提 PR 制造无关改动。

AI 会先整理材料和检查公开代码；需要账号时，由你在 GitHub 官方页面自行注册、登录，无需向 AI 提供密码或 Token。Fork 是你账号下的公开代码副本，只有准备贡献时才需要，不是提 Issue 的条件；Star 同样自愿。

不需要先搞懂 CLI 或 MCP。AI 会优先使用你已有的 GitHub 工具；只提 Issue 可以直接走网页。贡献 PR 需要安装官方工具或连接 GitHub 时，AI 会先说明用途和影响，得到你的同意再协助配置；登录授权由你完成。你也可以选择网页或先保留成果，配置完成后接着处理原草稿，不用重填问题和环境。工具配置成功不等于同意公开提交。

可以直接告诉 AI：“请复用已有工具；缺少工具时先说明并征得我同意，再帮我配置。注册和登录由我在官方页面完成，不向你提供密码或 Token。请接着处理原草稿，公开提交前仍让我确认。”

公开前，你会看到正文、diff、截图和测试结果，可以要求修改或取消。环境信息只收集相关版本、系统、安装方式等摘要，不上传整份日志、环境变量或登录缓存。没有账号或暂不想公开，可以先保留本地报告；也可自行反馈到 AI 开发者群。

### 验证做到什么程度？

| 改动 | 建议提供的证据 |
| --- | --- |
| 文档、说明 | 链接有效、步骤与当前能力一致 |
| Skill、提示词 | `npm run check:skills`、相关路由或生成案例的实际结果 |
| 代码修复 | 原问题的修复前后对比、相关回归测试；提交前运行 `npm run check:ci` |
| 宜搭平台行为 | 在有权限的测试环境验证；未验证的账号、部署环境或设备明确注明 |

文档和本地测试不要求宜搭账号。检查未完成时，可以先提草稿 PR，请维护者协助；只写实际结果，不把“未运行”当作“通过”。英文贡献同样欢迎，下面保留开发者说明。

## Quick Links

- **GitHub:** https://github.com/openyida/openyida
- **Issues:** https://github.com/openyida/openyida/issues
- **npm:** https://www.npmjs.com/package/openyida

## Maintainers

- **九神 (yize)** — Core architecture, CLI design
  GitHub: [@yize](https://github.com/yize)
- **alex-mm** — Feature development, testing
  GitHub: [@alex-mm](https://github.com/alex-mm)
- **nicky1108** — OpenClaw integration, skill extensions
  GitHub: [@nicky1108](https://github.com/nicky1108)
- **fryaninc** — Core development, user issue support, skill maintenance
  GitHub: [@fryaninc](https://github.com/fryaninc)

## Ways to Contribute

1. **Report a Bug** → Open an Issue with reproduction steps and environment info
2. **Suggest a Feature** → Describe the desired experience; discuss larger changes first, or send a focused PR directly
3. **Improve Docs** → PRs for documentation are always welcome
4. **Add Skills** → Extend the skill pack under `yida-skills/`
5. **Fix Bugs / New Features** → Follow the development workflow below

## Development Setup

```bash
# 1. Fork and clone the repo
git clone git@github.com:your-username/openyida.git
cd openyida

# 2. Use the CI Node.js version and install locked dependencies
nvm install
nvm use
npm ci --ignore-scripts

# 3. Run the local CLI without replacing a global installation
node bin/yida.js --help

# 4. Run the full local CI check
npm run check:ci
```

CI validation uses the Node.js version in `.nvmrc`. Without nvm, install that version directly. Run `check:ci` with it before pushing: Node.js/npm versions can produce different compressed package sizes from identical files. The test matrix also checks Node.js 18, 20, 22 and 24.

Local CLI login uses OAuth loopback and stores a token session. Use `openyida login`, then verify with `openyida login --check-only --json` or `openyida auth status`. In host-injected agent mode, `YIDA_AUTH_ENABLED=true` means the host provides token env; if the token is missing, fix the host injection rather than using QR/Codex/Playwright login flags.

## PR Checklist

- [ ] Relevant checks and actual results are documented; untested cases are clearly marked
- [ ] Full local CI run: `npm run check:ci` (or explain the limitation for a draft PR)
- [ ] A real Yida account is used only when platform behavior needs verification
- [ ] PR description clearly explains what changed and why
- [ ] Screenshots or recordings attached if there are UI/behavior changes

## PR Guidelines

- **One PR, one thing** — don't mix unrelated changes
- **PR title** format: `feat: add xxx` / `fix: fix xxx` / `docs: update xxx`
- **Description** should cover: what, why, and how to test
- If the PR closes an Issue, add `Closes #123` in the description

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add export-app command
fix: fix get-page-config path error
docs: update CLI command reference
refactor: refactor login module
test: add utils unit tests
chore: upgrade dependencies
```

## Code Style

- Follow the existing code style (CommonJS modules, prefer Node.js native APIs)
- Use meaningful English names for variables and functions; avoid abbreviations
- Handle errors completely — don't silently swallow exceptions
- When adding a new command, update the CLI command table in `README.md`
- When adding user-visible text, update all locale files under `lib/core/locales/`

## Project Structure

```
openyida/
├── bin/yida.js          # CLI entry point, command routing
├── lib/                 # Command implementation modules
│   ├── core/            # Environment detection, i18n, utilities
│   ├── auth/            # OAuth login, token sessions, organizations
│   ├── app/             # Application, form, page commands
│   └── ...
├── project/             # User workspace template
│   ├── config.json      # App configuration
│   └── pages/           # Custom page templates
├── yida-skills/         # AI skill pack (read by MCP/Claude/Cursor etc.)
│   ├── SKILL.md         # Skill entry document
│   └── skills/          # Sub-skill directories
└── scripts/             # Build and publish scripts
```

## AI / Vibe-Coded PRs Welcome! 🤖

PRs assisted by Codex, Claude Code, Cursor, OpenCode, or any other AI tool are fully welcome!
Please mention which AI tool you used in the PR description.

## License

By contributing, you agree to license your contribution under the [MIT License](./LICENSE).
