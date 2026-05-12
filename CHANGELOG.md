# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> **版本规则**：从 v2026.03.19 起，版本号采用日期格式 `vYYYY.MM.DD`，每次发布以当天日期为版本号，Git tag 格式为 `v2026.03.19`，npm 包版本格式为 `2026.03.19`。

## [Unreleased]

## [2026.5.12] - 2026-05-12

### Highlights
- 这是 2026-05-12 的正式版发布，包含平台权限管理、A2A 本地 Adapter 预览能力、GitHub 协作模板优化，以及对应的 CLI / Agent 发现能力补齐。
- `openyida corp-manager` 扩展平台管理能力，可用于企业成员搜索、管理员维护和通讯录可见性配置。
- 新增本地只读 A2A 1.0 预览 Adapter，为后续 Agent-to-Agent 集成提供标准 Agent Card、消息发送和任务查询基础能力。

### Added
- 新增 `openyida corp-manager` 平台权限管理命令，支持搜索企业成员、查询应用/平台/子管理员列表，以及新增或移除管理员。
- `corp-manager` 支持通讯录可见性配置查询与更新，可用于查看和调整全员可见、管理员可见等平台通讯录权限。
- 新增 `yida-corp-manager` 子技能，并同步注册 CLI 路由、命令清单、README 和 12 种语言的帮助文案。
- 新增 `openyida a2a <serve|agent-card>` 命令，支持启动本地只读 A2A Adapter 或输出 Agent Card。
- A2A Adapter 支持 Agent Card 发现、健康检查、`message:send`、任务查询和任务取消；默认绑定 `127.0.0.1`，不读取或返回 Cookie，不创建或修改真实宜搭资源。

### Changed
- 优化 GitHub Issue 和 PR 模板，补充复现信息、环境诊断、变更清单、测试验证、兼容性风险和 DWS / 钉钉 CLI 集成检查项。

### Tests
- 新增 `corp-manager` API 与 CLI smoke 测试，覆盖用户搜索、管理员管理、通讯录配置和命令发现等核心路径。
- 新增 A2A Agent Card、`message:send`、任务查询和 unsupported streaming 的离线测试，并补充 CLI smoke 覆盖。

## [2026.5.12-beta.1] - 2026-05-12

### Added
- 新增 `openyida corp-manager` 平台权限管理命令，支持搜索企业成员、查询应用/平台/子管理员列表，以及新增或移除管理员。
- `corp-manager` 支持通讯录可见性配置查询与更新，可用于查看和调整全员可见、管理员可见等平台通讯录权限。
- 新增 `yida-corp-manager` 子技能，并同步注册 CLI 路由、命令清单、README 和 12 种语言的帮助文案。

### Tests
- 新增 `corp-manager` API 与 CLI smoke 测试，覆盖用户搜索、管理员管理、通讯录配置和命令发现等核心路径。

## [2026.5.9] - 2026-05-09

### Highlights
- 这是面向 AI 编程工具和悟空技能分发的一次正式版发布，重点提升登录链路稳定性、自定义页面开发体验，以及技能包发布的一致性。
- `openyida login` 在 Codex / Qoder / 悟空 / Claude Code / OpenCode / Cursor 等 AI 工具中更易用：优先复用本地浏览器 CDP 登录能力，不可用时自动回退到可在对话框中展示的二维码 handoff。
- 悟空技能包发布链路标准化，`npm run build:skills` 与 GitHub Release 使用同一份 `openyida-skills.zip` 产物，降低本地构建和线上发布不一致的风险。

### Added
- 新增 Codex 登录模式：在有缓存时优先复用 Cookie，无有效缓存时引导使用内置浏览器或二维码 handoff 完成登录。
- 新增终端二维码登录链路，支持钉钉 OAuth 扫码，并可通过 `openyida login --qr --corp-id <corpId>` 显式选择多组织账号的目标组织。
- 新增自定义页面生成与本地校验命令：`generate-page`、`check-page`、`compile`，用于更完整地覆盖页面开发到发布前检查的流程。
- 新增通用 AI 对话框二维码命令别名：`openyida login --agent-qr` 和 `openyida login --agent-poll`，并继续兼容旧的 `--codex-qr` / `--codex-poll`。

### Changed
- `openyida login --browser` 改为优先使用本地 Chrome / Edge / Chromium CDP 登录，CDP 不可用时再使用 Playwright 兜底。
- AI 工具中的默认登录策略调整为本地 CDP 优先、对话框二维码 handoff 兜底，减少对本地桌面浏览器、Playwright 或远程服务器图形环境的依赖。
- 对话框二维码 handoff 增加 `qr_image_markdown` 和 `agent_response_markdown`，便于不同 AI 工具直接在聊天框中渲染二维码。
- `npm run build:skills` 现在会同时生成悟空可直接上传的 `openyida-skills.zip`，GitHub Release 也复用该构建产物作为附件。

### Fixed
- 修复 Qoder 登录模式在缺少环境变量时误回退成 Codex 文案的问题，并明确提示如需 CLI Cookie 应使用 `openyida login --browser`。
- 修复终端二维码渲染带警告前缀导致 QRCode 对齐异常的问题。
- 修复钉钉 OAuth 多组织账号在 `chooseOrganization`、`corpId` 传递、`confirm_auth` 参数和二次换凭证流程中的多处稳定性问题。
- 修复直接执行 `openyida login` 时，扫码后选择组织又要求再次扫码的问题。

### Documentation
- README 增加 Codex Support 说明，补充 Codex 登录、终端 QR 回退和多组织登录用法。
- 更新 AGENTS / CLAUDE / CONTRIBUTING / SECURITY 中关于 Codex、登录态和本地校验的说明。

## [2026.5.9-beta.9] - 2026-05-09

### Changed
- AI 工具中的 `openyida login` 默认策略调整为：先尝试本地 Chrome / Edge / Chromium CDP 浏览器登录；本地 CDP 不可用时再兜底返回对话框二维码 handoff
- 对话框二维码 handoff 增加 `qr_image_markdown` 和 `agent_response_markdown`，方便 Codex / Qoder / 悟空 / Claude Code / OpenCode / Cursor 等工具直接在聊天框渲染二维码，而不是只展示图片路径或 URL
- 新增通用二维码命令别名 `openyida login --agent-qr` 和 `openyida login --agent-poll`，旧的 `--codex-qr` / `--codex-poll` 继续兼容

## [2026.5.9-beta.8] - 2026-05-09

### Changed
- `npm run build:skills` 现在会同时生成悟空可直接上传的 `openyida-skills.zip`，不再只输出 `dist/skills/openyida/` 目录
- 发布 workflow 复用构建脚本产出的 `openyida-skills.zip`，避免本地构建与 GitHub Release 打包逻辑不一致

## [2026.5.9-beta.7] - 2026-05-09

### Changed
- `openyida login --browser` 改为优先使用本地 Chrome / Edge / Chromium CDP 登录，CDP 不可用时再使用 Playwright 兜底
- Codex / Qoder / 悟空等 AI 工具中，直接执行 `openyida login` 默认返回二维码 handoff，便于在对话框展示二维码并通过 `poll_command` 写入 CLI Cookie 缓存
- 默认二维码 handoff 不依赖本地桌面浏览器或 Playwright，阿里云 ECS 等远程服务器环境也可以直接完成扫码登录并写入 CLI Cookie 缓存

## [2026.5.9-beta.6] - 2026-05-09

### Fixed
- Qoder 登录模式与 Codex 保持一致：`openyida login` 在 Qoder 环境下返回 Qoder 内置浏览器 handoff，并明确提示如需 CLI Cookie 使用 `openyida login --browser`
- `openyida login --qoder` 现在会显式返回 `browser: "qoder"`，不再因缺少 Qoder 环境变量回退成 Codex 文案

## [2026.5.9-beta.5] - 2026-05-09

### Added
- Codex 登录模式：`openyida login` 在 Codex 环境下缓存优先，缺少有效缓存时引导使用 Codex 内置浏览器登录，无需安装 Playwright 或额外 Chromium
- 终端二维码登录支持钉钉 OAuth 二维码链路，并支持 `openyida login --qr --corp-id <corpId>` 显式选择多组织账号的目标组织
- 自定义页面生成与本地校验命令：`generate-page`、`check-page`、`compile`

### Fixed
- 终端二维码渲染不再带警告前缀，避免破坏 QRCode 对齐
- 修复钉钉 OAuth 多组织账号扫码后停在 `chooseOrganization` 的登录凭证换取流程
- 修复终端二维码登录未把 `--corp-id` 传入钉钉 OAuth 首次轮询，导致多组织账号二次换凭证时二维码失效的问题
- 修正钉钉 OAuth 组织选择参数为官方 `corpId`，避免误用仅适用于专属账号登录的 `exclusiveCorpId`
- 修复钉钉 OAuth 扫码返回 `pass: true` 但无跳转 URL 时未继续调用 `confirm_auth`，导致换取登录凭证失败的问题
- 修复 `confirm_auth` 未携带 OAuth 页面 query 参数导致服务端报 `clientId is blank` 的问题
- 修复直接执行 `openyida login` 时扫码后选择组织又要求再次扫码的问题

### Documentation
- README 新增 Codex Support 说明，补充 Codex 登录、终端 QR 回退和多组织登录用法
- 更新 AGENTS / CLAUDE / CONTRIBUTING / SECURITY 中的 Codex、登录态和本地校验说明

## [2026.04.20] - 2026-04-20

### Fixed
- **登录无限循环问题**: 修复 `ReferenceError: warn is not defined` 错误，恢复正常的登录流程（提交 `fdb5dd5`）
  - `login.js`: 将子进程模板字符串中的 `warn()` 改回 `console.error()`（3 处）
  - `qr-login.js`: 添加缺失的 `warn` import 语句
  - 解决了因登录失败导致的潜在无限循环问题

## [2026.04.02-beta.12] - 2026-04-02

### Fixed
- **悟空工作区路径**：`utils.js` / `env.js` / `copy.js` 中悟空的 `workspaceRoot` 改为直接读取 `AGENT_WORK_ROOT` 环境变量，支持动态 uuid 路径（`~/.real/users/{uuid}/workspace/`），不再硬编码 `~/.real/workspace/`
- **postinstall 污染**：删除 `postinstall.js` 中向 `~/.real/` 复制 `yida-skills/` 的逻辑，悟空通过手动上传技能，无需自动安装

### Added
- **`openyida copy` 空目录铺平**：检测目标目录是否为空，空目录时直接把 `project/` 内容铺入（不创建 `project/` 子目录），适配悟空新工作区场景
- **i18n**：新增 `copy.dest_empty_flatten` 翻译 key，覆盖全部 12 种语言

## [2026.04.01] - 2026-04-01

### Improved
- `yida-skills`：按钉钉 dws 规范全面重构 26 个子技能 SKILL.md
  - 统一添加 `## 严格禁止 (NEVER DO)` / `## 严格要求 (MUST DO)` 规则区
  - 新增 `## 适用场景` 意图判断表，明确每个技能的触发关键词
  - 调整文档结构：`frontmatter → # 一级标题 → 规则区 → 正文`，符合钉钉规范
  - 修复 `yida-integration`、`yida-process-rule` 规则区误插入 frontmatter 内部的问题
  - 修复 `yida-formula` 缺失规则区的问题

### Fixed
- `create-form.js`：`buildFormSchema` 添加缺失的 `componentDidMount` 生命周期配置，修复表单初始化异常
- CI：`validate-ci.sh` 改用 `find` 递归检查 `lib/` 子目录，修复子目录 JS 文件语法检查遗漏问题
- 修复多语言 README 链接路径错误（`zh-Hant`、`pt`）

### Refactored
- 报表模块重构（`lib/report/`）：拆分为 `index.js`、`append.js`、`chart-builder.js`、`http.js`、`constants.js`，提升可维护性
- 移除非英文 README 文件，统一通过语言链接跳转至文档站

### Documentation
- `yida-skills/references/`：根据官方 Excel 全面更正宜搭版本功能对比指南
- 恢复误删的 `yida-create-report` 技能目录
- 删除技能文档中不存在的 `compile` 命令引用

## [2026.03.28] - 2026-03-28

### Security
- `cdn-config.js`：保存 AccessKey 配置后自动设置文件权限为 600，防止凭证泄露
- `cdn-upload.js`：新增 `isPathSafe()` 路径安全校验，过滤 null-byte 注入攻击
- `query-data.js`：`--search-json` 参数在发送前强制校验是否为合法 JSON

### Fixed
- `utils.js`：修复 `httpPost` / `httpGet` 中双重 reject 问题（通过 `hasRejected` 标志位防止重复触发）
- `formatter.js`：实现 `escapeMarkdown()` 函数，正确转义 Markdown 特殊字符，防止 XSS

### Changed
- 合并 `lib/data-management.js` 到 `lib/core/query-data.js`，统一数据管理命令入口
  - 支持表单/流程/任务/子表单的查询、新增、更新全操作
  - 删除冗余的 `lib/data-management.js` 和对应测试文件
- `bin/yida.js`：`data` 命令统一路由至 `lib/core/query-data`

### Documentation
- `yida-skills/SKILL.md`：删除孤立标题、修复重复条目，新增模板文件引用表格
- `yida-app/SKILL.md`：重构步骤详解，步骤编号与流程图对齐（Step 1-9），补充缺失的流程配置和预检步骤，每步添加子技能文档链接
- 恢复三个模板文件（从 v2026.03.24 tag 还原）：
  - `yida-custom-page/templates/custom-page-template.js`
  - `yida-data-management/templates/form-field-template.js`
  - `yida-create-app/templates/ipd-app-template.js`

### Tests
- 重写 `tests/query-data.test.js`：更新为新接口格式（`query form / get form / create form / query tasks`），新增 19 个测试用例，覆盖参数校验、未登录、查询/创建/错误场景

## [2026.03.26] - 2026-03-26

### Added
- 发布自定义页面前自动检查代码规范，发现问题时提前拦截，避免发布后页面崩溃
- 新增 `--skip-lint` 参数，可跳过发布前的自动检查
- 新增 `dws` 命令：集成钉钉 CLI（通讯录/日历/待办/审批等）
- 新增 `export-conversation` 命令：导出 AI 对话记录
- 新增 `flash-to-prd` 命令：闪记转高质量 prompt（支持会议识别）
- 新增 `integration` 命令：集成 & 自动化逻辑流
- 新增 `task-center` 命令：全局任务中心（待办/我创建的/我已处理/抄送/代提交）

### Fixed
- 修复 3 个示例页面中按钮点击等交互事件无法正常工作的问题
- 修复创建流程表单时内部路径引用错误导致命令失败的问题
- 修复代码风格检查错误、测试用例失败和安全漏洞
- 清理多个模块中无用的代码引用

### Documentation
- 补全 13 种语言版本 README 中遗漏的 14 个命令说明
- 补全帮助信息中缺失的 `query-data` 命令
- 完善连接器技能文档中的模板引用说明

### i18n
- 新增发布预检功能的 11 种语言翻译

## [2026.03.24] - 2026-03-24

### Added
- 新增登录和 Cookie 存储 Mock 测试 (`tests/login.test.js`)
  - 25 个测试用例覆盖 Cookie 解析、加载、保存逻辑
  - 测试多 AI 工具环境检测（Qoder/Claude Code/悟空/OpenCode）
  - 测试项目根目录解析逻辑
  - 验证 Cookie 存储路径兼容性

### Changed
- 更新 Jest 到 `^29.7.0`
- 完善 `.gitignore`，忽略根目录 `.cache/` 缓存文件

## [2026.03.19] - 2026-03-19

### Added
- 多语言 README 支持（13 种语言）：简体中文、繁體中文（台灣/香港）、日本語、한국어、Français、Deutsch、Español、Português、Tiếng Việt、हिन्दी、العربية
- i18n 国际化扩展：新增 ko、fr、de、es、pt、vi、hi、ar、zh-HK 语言包，支持 12 种语言
- CI 新增 `concurrency` 配置（自动取消重复运行）和 `permissions: contents: read` 最小权限声明
- README 顶部添加封面图和 Vernor Vinge 引言

### Changed
- 版本号规则改为日期格式（`vYYYY.MM.DD`），告别语义化版本
- README.md 改为英文作为默认语言，原中文内容迁移至 `README.zh-CN.md`

## [1.0.0-beta.0] - 2026-03-18

### Added
- 支持多 AI 工具环境：悟空、Aone Copilot、OpenCode、Claude Code、Cursor、Qoder、iFlow
- `openyida env` 命令：检测当前 AI 工具环境和登录态
- `openyida copy` 命令：初始化 openyida 工作目录到当前 AI 工具环境
- 内置自动版本检测（每天检查一次新版本）
- 悟空环境支持 CDP 协议从内置浏览器提取 Cookie
- 完整开发流程文档和子技能 `SKILL.md`
- `AGENTS.md` / `CLAUDE.md` AI 协作开发指引

### Changed
- 架构重构：CLI 命令统一收归 `openyida` 包，安装即用
- 多 AI 工具环境自动检测，无需手动配置

### Fixed
- 修复 `get-page-config.js` 严重 bug（引用未定义变量、GET/POST 路径写反）
- 修复 `postinstall.js` 复用 `env.js` 的环境检测逻辑，避免重复维护
- `prepublish.js` 增加 diff 校验，确保 project 模板拷贝完整性

## [0.1.0] - 2026-03-11

### Added
- 初始版本发布
- `openyida login` / `logout` 登录管理
- `openyida create-app` 创建应用
- `openyida create-page` 创建自定义展示页面
- `openyida create-form` 创建 / 更新表单页面
- `openyida publish` 编译并发布自定义页面
- `openyida get-schema` 获取表单 Schema
- GitHub Actions CI/CD 流程（多平台测试 + npm 发布）
- 最佳实践文档和留资表单完整示例

### Fixed
- `create-form` 支持 JSON 字符串格式输入
- 优化 Babel 编译错误提示信息
- 修复 `SKILL.md` 编号问题

[Unreleased]: https://github.com/openyida/openyida/compare/v2026.5.12...HEAD
[2026.5.12]: https://github.com/openyida/openyida/compare/v2026.5.9...v2026.5.12
[2026.5.12-beta.1]: https://github.com/openyida/openyida/compare/v2026.5.9...v2026.5.12-beta.1
[2026.5.9]: https://github.com/openyida/openyida/compare/v2026.04.20...v2026.5.9
[2026.5.9-beta.9]: https://github.com/openyida/openyida/compare/v2026.5.9-beta.8...v2026.5.9-beta.9
[2026.5.9-beta.8]: https://github.com/openyida/openyida/compare/v2026.5.9-beta.7...v2026.5.9-beta.8
[2026.5.9-beta.7]: https://github.com/openyida/openyida/compare/v2026.5.9-beta.6...v2026.5.9-beta.7
[2026.5.9-beta.6]: https://github.com/openyida/openyida/compare/v2026.5.9-beta.5...v2026.5.9-beta.6
[2026.5.9-beta.5]: https://github.com/openyida/openyida/compare/v2026.04.20...v2026.5.9-beta.5
[2026.04.20]: https://github.com/openyida/openyida/compare/v2026.04.02-beta.12...v2026.04.20
[2026.04.02-beta.12]: https://github.com/openyida/openyida/compare/v2026.04.01...v2026.04.02-beta.12
[2026.04.01]: https://github.com/openyida/openyida/compare/v2026.03.28...v2026.04.01
[2026.03.28]: https://github.com/openyida/openyida/compare/v2026.03.26...v2026.03.28
[2026.03.26]: https://github.com/openyida/openyida/compare/v2026.03.24...v2026.03.26
[2026.03.24]: https://github.com/openyida/openyida/compare/v2026.03.19...v2026.03.24
[2026.03.19]: https://github.com/openyida/openyida/compare/v1.0.0-beta.0...v2026.03.19
[1.0.0-beta.0]: https://github.com/openyida/openyida/compare/v0.1.0...v1.0.0-beta.0
[0.1.0]: https://github.com/openyida/openyida/releases/tag/v0.1.0
