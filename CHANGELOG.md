# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> **版本规则**：从 v2026.03.19 起，版本号采用日期格式 `vYYYY.MM.DD`，每次发布以当天日期为版本号，Git tag 格式为 `v2026.03.19`，npm 包版本格式为 `2026.03.19`。

## [Unreleased]

## [2026.03.26] - 2026-03-26

### Added
- 发布自定义页面前自动检查代码规范，发现问题时提前拦截，避免发布后页面崩溃
- 新增 `--skip-lint` 参数，可跳过发布前的自动检查

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

[Unreleased]: https://github.com/openyida/openyida/compare/v2026.03.26...HEAD
[2026.03.26]: https://github.com/openyida/openyida/compare/v2026.03.24...v2026.03.26
[2026.03.24]: https://github.com/openyida/openyida/compare/v2026.03.19...v2026.03.24
[2026.03.19]: https://github.com/openyida/openyida/compare/v1.0.0-beta.0...v2026.03.19
[1.0.0-beta.0]: https://github.com/openyida/openyida/compare/v0.1.0...v1.0.0-beta.0
[0.1.0]: https://github.com/openyida/openyida/releases/tag/v0.1.0
