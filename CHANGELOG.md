# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> **版本规则**：从 v2026.03.19 起，版本号采用日期格式 `vYYYY.MM.DD`，每次发布以当天日期为版本号，Git tag 格式为 `v2026.03.19`，npm 包版本格式为 `2026.03.19`。

## [Unreleased]

### Added
- Codex 登录模式：`openyida login` 在 Codex 环境下缓存优先，缺少有效缓存时引导使用 Codex 内置浏览器登录，无需安装 Playwright 或额外 Chromium
- 终端二维码登录支持钉钉 OAuth 二维码链路，并支持 `openyida login --qr --corp-id <corpId>` 显式选择多组织账号的目标组织
- 自定义页面生成与本地校验命令：`generate-page`、`check-page`、`compile`

### Fixed
- 终端二维码渲染不再带警告前缀，避免破坏 QRCode 对齐
- 修复钉钉 OAuth 多组织账号扫码后停在 `chooseOrganization` 的登录凭证换取流程

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
- i18n 国际化扩展：新增 ko、fr、de、es、pt、vi、hi、ar、zh-TW 语言包，支持 12 种语言
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

[Unreleased]: https://github.com/openyida/openyida/compare/v2026.04.20...HEAD
[2026.04.20]: https://github.com/openyida/openyida/compare/v2026.04.02-beta.12...v2026.04.20
[2026.04.02-beta.12]: https://github.com/openyida/openyida/compare/v2026.04.01...v2026.04.02-beta.12
[2026.04.01]: https://github.com/openyida/openyida/compare/v2026.03.28...v2026.04.01
[2026.03.28]: https://github.com/openyida/openyida/compare/v2026.03.26...v2026.03.28
[2026.03.26]: https://github.com/openyida/openyida/compare/v2026.03.24...v2026.03.26
[2026.03.24]: https://github.com/openyida/openyida/compare/v2026.03.19...v2026.03.24
[2026.03.19]: https://github.com/openyida/openyida/compare/v1.0.0-beta.0...v2026.03.19
[1.0.0-beta.0]: https://github.com/openyida/openyida/compare/v0.1.0...v1.0.0-beta.0
[0.1.0]: https://github.com/openyida/openyida/releases/tag/v0.1.0
