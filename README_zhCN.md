<div align="center">

# OpenYida

**面向 AI 编程工具的宜搭低代码 CLI。**

OpenYida 把 Codex、Claude Code、Cursor、QwenWork（千问办公）、Qoder、悟空等 AI 编程助手连接到宜搭低代码平台，让开发者可以通过自然语言和命令行完成应用创建、表单建模、流程审批、自定义页面、报表、连接器和发布配置。

[快速开始](#快速开始) · [帮助网站&文档](https://demo.aliwork.com/o/openyida/helpCenter) · [核心能力](#核心能力) · [完整功能列表](https://demo.aliwork.com/o/openyida/helpCenter?openyidaPath=capabilities) · [案例展示](https://demo.aliwork.com/o/openyida/helpCenter?openyidaRoute=showcase) · [自定义页面开发](#自定义页面开发) · [常用命令](https://demo.aliwork.com/o/openyida/helpCenter?openyidaPath=features/skills) · [开发与校验](#开发与校验)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**帮助网站&文档:** [帮助网站&文档](https://demo.aliwork.com/o/openyida/helpCenter)

[English README](./README.md) · [简体中文 README](./README_zhCN.md)
</div>

---

## OpenYida 是什么

OpenYida 是 AI 编程工具和宜搭之间的桥接层。AI Agent 不需要直接猜测宜搭接口或页面运行时细节，而是通过稳定的 `openyida` CLI 完成资源创建、Schema 查询、源码生成、编译发布和诊断。

最终产物仍是原生宜搭应用：团队可以继续在宜搭设计器中编辑，沿用组织权限、安全和部署体系。

## 核心能力

| 领域 | 能力 |
|------|------|
| 应用交付 | 创建、更新、导出、导入宜搭应用 |
| 表单建模 | 创建表单、更新字段、查询 Schema、配置权限 |
| 自定义页面 | 生成 Code Canvas / 普通 JSX 页面、检查、编译、发布 |
| 流程自动化 | 创建流程表单、配置审批流、预览流程实例 |
| 数据管理 | 查询/新增/更新表单、流程、任务、子表数据 |
| 连接器与集成 | 管理 HTTP 连接器、鉴权账号、连接器动作和集成自动化 |
| 运营与诊断 | 登录态、组织上下文、环境诊断、页面分享、CDN 素材上传 |

## 快速开始

### 1. 安装

```bash
npm install -g openyida
```

OpenYida 要求 Node.js 18 或更高版本。安装后会提供 `openyida` 和 `yida` 两个命令。

如果本机已安装 Codex，OpenYida 会在安装后尝试导入本地 Codex 插件。重启 Codex 后，在输入框中输入 `@宜搭` 或 `@openyida` 即可挂载 OpenYida 上下文。

### 2. 检查环境

在 AI 编程工作区中运行：

```bash
openyida agent-capabilities --json
```

该命令会一次性返回 OpenYida 版本、当前工作区、AI 工具环境、登录态、组织上下文、命令清单和副作用提示。旧版本或轻量检查也可以使用：

```bash
openyida env --json
openyida login --check-only --json
```

### 3. 登录

```bash
openyida login
```

OpenYida 默认使用 OAuth token 模式：打开钉钉 OAuth 授权页，通过本地 loopback 回调接收授权码，再由宜搭服务换取并缓存 `access_token` / `refresh_token`。Agent 不需要提取浏览器 Cookie，也不需要手写 `.cache/cookies.json`。

AI 工具中建议登录后用下面任一命令确认 token session 可用：

```bash
openyida login --check-only --json
openyida auth status
```

如果用户给出明确的宜搭入口 URL，需要把 URL 传给登录命令：

```bash
openyida login https://yida-group.alibaba-inc.com/
openyida login --alibaba
```

海外 / Global YiDA 场景使用：

```bash
openyida login --intl
```

### 4. 让 AI Agent 构建应用

可以直接向 AI 编程助手提出业务目标：

```text
帮我创建一个 CRM 应用，包含客户、联系人、商机、跟进记录表单和首页看板。
帮我搭建一个采购申请流程，包含审批节点和数据看板。
帮我生成一个品牌官网首页并发布到宜搭应用。
```

Agent 会读取 `yida-skills/` 中的技能说明，调用 OpenYida CLI 创建应用、表单、页面、流程和报表，并返回最终访问链接。

## 悟空安装

悟空使用手动上传技能包：

1. 从 GitHub Releases 下载最新 `.zip` 技能包。
2. 打开悟空。
3. 进入 **技能中心** > **上传技能**，选择下载的 zip。

悟空终端执行 Node/npm 命令前，先设置内置 Node 路径：

```bash
export PATH="$HOME/.real/.bin/node/bin:$PATH"
```

## 语言包

CLI 默认内置 `zh` 和 `en` 两个核心语言包，以中文为主、英文兜底。其他语言包按需启用：将 `ja.js`、`fr.js` 等文件放到一个外部目录，设置 `OPENYIDA_LOCALE_DIR` 指向该目录，再设置 `OPENYIDA_LANG=ja`。如果目标语言包不可用，OpenYida 会按 `en -> zh` 回退，不影响命令执行。

## 项目结构

```text
openyida/
├── bin/yida.js          # CLI 入口和命令路由
├── lib/                 # 应用、表单、登录、连接器、流程、报表等实现
├── project/             # 默认宜搭项目工作目录模板
├── yida-skills/         # Agent 技能源码和宜搭 API 参考
├── docs/                # 能力说明和补充文档
└── scripts/             # CI、技能打包、E2E 和 eval 工具
```

## 自定义页面开发

OpenYida 当前有两条自定义页面链路，先选链路再写页面：

| 场景 | 推荐链路 |
|------|---------|
| 现代 React、hooks、可视化、官网、看板、工作台、列表、详情、AI 首次生成页面 | Code Canvas，使用 `.canvas.jsx` |
| 明确要求普通自定义页面 JSX/Jsx 组件链路 | 普通 JSX，使用 `.oyd.jsx` |
| 页面强依赖 `this.$(fieldId)`、`this.utils.yida.*`、`this.dataSourceMap`、表单提交或字段双向绑定 | 普通 JSX，使用 `.oyd.jsx` |
| 已有普通 `.oyd.jsx` 页面需要升级 | `yida-canvas-upgrade` |

### Code Canvas 默认链路

```bash
openyida create-page APP_XXX "首页看板" --mode dashboard
openyida check-page pages/src/dashboard.canvas.jsx --json
openyida compile pages/src/dashboard.canvas.jsx
openyida publish pages/src/dashboard.canvas.jsx APP_XXX FORM_XXX
```

页面源码直接基于 PRD 和 design.md 编写。默认使用 Code Canvas 的 `.canvas.jsx`；只有明确需要普通自定义页面 JSX/Jsx 组件链路时才使用 `.oyd.jsx`。


### 成员 / 部门 / 上传组件怎么用

需要成员、部门、附件上传、图片上传时，先确认当前页面链路：

支持清单：[AI 自定义页面支持的宜搭原生组件](https://demo.aliwork.com/o/openyida/sample/canvas-native-components)。

| 页面链路 | 做法 |
|----------|------|
| Code Canvas | 使用 `yida-canvas-custom-page`，按 `native-components-bridge.md` 做运行态组件探测、fallback 和值归一化 |
| 普通 JSX / Jsx 组件链路 | 使用 `yida-custom-page`，读取 `references/component-jsx-guide.md`；涉及上传时同时读取 `references/attachment-upload-guide.md` |

使用原则：

- 先验证运行态是否存在 `EmployeeField`、`DepartmentSelectField`、`AttachmentField`、`ImageField` 等组件。
- 原生组件只负责交互输入；业务状态保存归一化后的成员、部门、文件结构。
- 组件不可用时提供 fallback，页面不能白屏。
- 上传类能力需要验证 OSS 签名、权限、预览、删除和失败提示。

普通 JSX 链路：

```bash
openyida check-page pages/src/employee-upload.oyd.jsx
openyida compile pages/src/employee-upload.oyd.jsx
openyida publish pages/src/employee-upload.oyd.jsx APP_XXX FORM_XXX
```

## 表单、流程、数据与报表

### 表单建模

```bash
openyida create-form create APP_XXX "客户表" .cache/openyida/forms/customer-fields.json
openyida create-form update APP_XXX FORM_XXX .cache/openyida/forms/customer-changes.json
openyida get-schema APP_XXX FORM_XXX
```

表单字段定义支持 19 种业务字段，以及 `Divider`、`ColumnContainer` 等布局组件。普通分组优先使用 `Divider`，局部多列使用 `ColumnContainer`；`GroupContainer` / `PageSection` 只在确实需要容器语义时使用。

### 流程审批

```bash
openyida create-process APP_XXX "采购申请" .cache/openyida/process/fields.json .cache/openyida/process/process.json
openyida configure-process APP_XXX FORM_XXX .cache/openyida/process/process.json
openyida process preview APP_XXX PROC_INST_XXX --output .cache/openyida/process/process.html
```

### 数据管理

```bash
openyida data query form APP_XXX FORM_XXX --page 1 --size 20
openyida data create form APP_XXX FORM_XXX --data-file .cache/openyida/data-import/record.json
openyida data query subform APP_XXX FORM_XXX --inst-id FORM_INST_XXX --table-field-id tableField_xxx
```

录入或更新数据前先用 `openyida get-schema` 获取真实 fieldId。`DateField` / `CascadeDateField` 使用 13 位毫秒时间戳，例如 `1719705600000`。

### 报表和 ECharts

```bash
openyida create-report APP_XXX "销售统计报表" .cache/openyida/reports/charts.json
openyida append-chart APP_XXX REPORT_XXX .cache/openyida/reports/chart.json
```

普通“报表 / 统计”默认使用原生报表 `yida-report`。高级视觉、ECharts、大屏等场景先创建或复用原生报表数据源，再由 `yida-chart` 或 Code Canvas 页面承载展示层。

## 连接器与集成

```bash
openyida connector smart-create --curl "curl https://api.example.com/users"
openyida connector list
openyida integration create APP_XXX FORM_XXX "同步客户数据"
openyida integration enable APP_XXX FORM_XXX PROC_CODE
```

连接器鉴权信息通过宜搭连接器配置管理，不写入页面源码。`--operations`、`--action`、`--spec` 等 JSON 文件放到 `.cache/openyida/<项目名或任务名>/` 下。

## CLI 命令参考

运行 `openyida --help` 或 `openyida <command> --help` 查看详细用法。

<!-- OPENYIDA_COMMANDS_START -->
<!-- 本节由 `npm run docs:commands` 自动生成，请勿手动编辑命令行。 -->

### 环境 & 认证

| 命令 | 说明 |
|------|------|
| `openyida login [target-url] [--env <name>\|--intl\|--overseas\|--global\|--yidaapps\|--alibaba] [--client-id <clientId>] [--endpoint <url>] [--no-browser]` | 登录（OAuth token 模式） |
| `openyida logout` | 退出登录 / 清空 token |
| `openyida auth <status\|login\|refresh\|logout>` | token 登录态管理 |
| `openyida org <list\|switch> [--json] [--corp-id <corpId>]` | 组织管理（列表 / 重新登录切换） |
| `openyida env [--json\|setup\|list\|show\|switch\|add\|remove] [options]` | 检测 AI 工具环境和 token 登录态 |

### 应用管理

| 命令 | 说明 |
|------|------|
| `openyida app-list [--size N]` | 查询我的应用列表 |
| `openyida corp-efficiency [overview\|details\|detail\|groups\|notify] [options] [--open\|--no-open]` | 查询企业效能概览和明细报表 |
| `openyida create-app "<name>"\|--name <name> [options] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 创建宜搭应用 |
| `openyida update-app <appType> [--name "..."] [--layout slide\|ver] [--theme deepBlue]` | 更新应用信息 |
| `openyida app-online <appType> [--to-ding-app-center] [--show-app-center]` | 启用宜搭应用 |
| `openyida app-offline <appType> [--to-ding-app-center] [--show-app-center]` | 停用宜搭应用 |
| `openyida nav-group <list\|create\|rename\|delete\|move\|order\|auto-order\|hide\|show> <appType> ...` | 管理应用左侧导航分组 |
| `openyida app-permission <get\|set\|add\|remove\|search-user> ...` | 管理应用主管理员、数据管理员和开发成员 |
| `openyida i18n <overview\|config\|languages\|list\|upsert\|delete\|translate\|translate-all\|upgrade> <appType> ...` | 管理应用多语言文案和语言配置 |
| `openyida export <appType> [output]` | 导出应用（生成迁移包） |
| `openyida import <file> [name]` | 导入迁移包，重建应用 |

### 表单 & 页面

| 命令 | 说明 |
|------|------|
| `openyida create-form create <appType> "<formTitle>" <fieldsJsonFile> [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 创建表单页面 |
| `openyida create-form validate-fields <fieldsJsonOrFile> [--json]` | 本地校验表单字段 JSON |
| `openyida create-form update <appType> ... [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form patch <appType> <formUuid> <patchJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form rule <appType> <formUuid> <rulesJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form validation <appType> <formUuid> <validationsJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida add-validation <appType> <formUuid> --field <labelOrId> --type <phone\|regex\|idCard\|email\|...> [--message <text>]` | 更新表单页面 |
| `openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile> [--open\|--no-open]` | 更新表单页面 |
| `openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...` | 更新表单页面 |
| `openyida list-forms <appType> [--keyword <text>]` | 列出应用下的表单/页面 |
| `openyida aggregate-table <list\|create-empty\|inspect\|preview\|save\|publish\|status> <appType> ...` | 管理聚合表（virtualView） |
| `openyida get-schema <appType> <formUuid\|--all> [--summary-json\|--field-map-json]` | 获取单个或全部表单 Schema |
| `openyida check-prd-completeness <prd.md> --app-type <appType> [--build-manifest <file>] [--json]` | 检查 PRD 页面/资源数量风险 |
| `openyida er <appType> [--format mermaid\|json] [--output file] [--include-system] [--include-pages]` | 导出应用实体关系图 |
| `openyida create-page <appType> "<name>" [--mode dashboard] [--hide-nav] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | 创建自定义展示页面 |
| `openyida build-page <sourceFile> [--output file\|--write]` | 构建宜搭兼容页面源码 |
| `openyida check-page <src> [--compat]` | 检查自定义页面规范 |
| `openyida compile <src>` | 本地编译自定义页面 |
| `openyida publish <src> <appType> <formUuid> [--health-check] [--force] [--canvas] [--auto-nav-order] [--open\|--no-open]` | 编译并发布自定义页面 |
| `openyida update-form-config <appType> ...` | 更新表单配置 |
| `openyida get-form-config <appType> <formUuid> [--json]` | 查询表单配置 |
| `openyida form-detail-style apply <appType> <formUuid> [--css file\|--preset clean-card] [--json]` | 管理表单详情页样式 |
| `openyida form-detail-style remove <appType> <formUuid> [--json]` | 管理表单详情页样式 |
| `openyida form-detail-style check <appType> <formUuid> [--json]` | 管理表单详情页样式 |

### 数据 & 权限

| 命令 | 说明 |
|------|------|
| `openyida data <action> <resource> [args]` | 统一数据管理（表单/流程/任务/子表单） |
| `openyida task-center <type> [options]` | 全局任务中心（待办/已处理/抄送等） |
| `openyida basic-info <overview\|commodity\|grant\|capacity\|quota\|abs-path\|dataflow\|i18n\|domain>` | 查询组织基本信息、容量、额度和域名设置 |
| `openyida read-dingtalk-doc <docUrl> [--output <file>] [--json]` | 获取钉钉文档的 Markdown 内容 |
| `openyida read-dingtalk-tingji <taskUuid> [--json]` | 按任务 UUID 获取钉钉听记详情 |
| `openyida get-permission <appType> <formUuid>` | 查询表单权限配置 |
| `openyida save-permission <appType> <formUuid> ...` | 保存表单权限配置 |
| `openyida corp-manager <search-user\|list\|add\|remove\|address-book> ...` | 管理平台管理员与通讯录权限 |
| `openyida agent-center <list\|create\|update\|cancel\|range\|search-user> ...` | 管理流程代理和离职代理 |

### 流程

| 命令 | 说明 |
|------|------|
| `openyida configure-process <appType> ...` | 配置并发布流程规则 |
| `openyida create-process <appType> ...` | 创建流程表单（一体化） |
| `openyida ai-form-setting <get\|fields\|models\|enable\|disable\|save> <appType> ...` | 管理流程表单 AI 审批提示 |
| `openyida process preview <appType> ...` | 预览流程实例（可视化流程图） |

### 页面配置 & 分享

| 命令 | 说明 |
|------|------|
| `openyida verify-short-url <appType> ...` | 验证短链接 URL |
| `openyida save-share-config <appType> ...` | 保存公开访问 / 分享配置 |
| `openyida get-page-config <appType> <formUuid>` | 查询页面公开访问配置 |
| `openyida externalize-form <appType> <formUuid> [--schema-file file]` | 生成外部开放安全评估和镜像字段方案 |

### 报表

| 命令 | 说明 |
|------|------|
| `openyida create-report <appType> "<name>" ... [--open\|--no-open]` | 创建宜搭报表 |
| `openyida append-chart <appType> <reportId> ... [--open\|--no-open]` | 向已有报表追加图表 |

### 连接器

| 命令 | 说明 |
|------|------|
| `openyida connector list` | 列出 HTTP 连接器 |
| `openyida connector create "name" "domain" ...` | 创建连接器 |
| `openyida connector detail <id>` | 查看连接器详情 |
| `openyida connector delete <id>` | 删除连接器 |
| `openyida connector add-action --operations <file> --connector-id <id>` | 添加执行动作 |
| `openyida connector list-actions <id>` | 列出执行动作 |
| `openyida connector delete-action <id> <operation-id>` | 删除执行动作 |
| `openyida connector test --connector-id <id> --action <actionId>` | 测试执行动作 |
| `openyida connector list-connections <id>` | 列出鉴权账号 |
| `openyida connector create-connection <id> <name>` | 创建鉴权账号 |
| `openyida connector smart-create --curl "..."` | 智能创建连接器（从 cURL） |
| `openyida connector parse-api [options]` | 解析接口信息 |
| `openyida connector gen-template [output]` | 生成接口文档模板 |

### 集成 & 钉钉

| 命令 | 说明 |
|------|------|
| `openyida integration create <appType> ... [--spec file.json]` | 创建集成自动化逻辑流 |
| `openyida integration list <appType> [--form-uuid <uuid>] [--status y\|n] [--json]` | 列出集成自动化逻辑流 |
| `openyida integration enable <appType> <formUuid> <processCode>` | 启用集成自动化逻辑流 |
| `openyida integration disable <appType> <formUuid> <processCode>` | 停用集成自动化逻辑流 |
| `openyida integration check <appType...>` | 检查集成自动化异常运行日志 |
| `openyida integration diagnose (--text <text>\|--file <path>\|--rules) [--json]` | 诊断集成自动化故障文本和常见配置坑 |
| `openyida dws <command> [args]` | 钉钉 CLI（通讯录/日历/待办/审批等） |
| `openyida dws contact user search --keyword <text>` | 钉钉 CLI（通讯录/日历/待办/审批等） |
| `openyida dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]` | 生成钉钉 AppLink / 兼容 dingtalk:// 跳转链接 |

### 工具

| 命令 | 说明 |
|------|------|
| `openyida commands [--json]` | 输出机器可读命令清单 |
| `openyida agent-capabilities [--json] [--summary-json\|--compact]` | 输出 Agent 一次性能力快照 |
| `openyida a2a <serve\|agent-card> [options]` | 启动本地只读 A2A Adapter 或输出 Agent Card |
| `openyida bridge start [--token <pair-token>] [--port 6736] [--origin https://demo.aliwork.com] [--open\|--no-open]` | 启动 OpenYida 本地网页桥接服务 |
| `openyida copy [--force]` | 复制 project 工作目录 |
| `openyida sample [--list]` | 输出代码示例/骨架 |
| `openyida doctor [--fix]` | 环境诊断与自动修复 |
| `openyida eval --mode <mode> [--skill <name>] [--runs N]` | 技能多维评测（文档质量、路由准确率、安全合规等） |
| `openyida db-seq-fix [--fix]` | PostgreSQL Sequence 漂移检测与修复 |
| `openyida formula evaluate <formula\|file> [--schema file]` | 静态检查宜搭公式语法和字段引用 |
| `openyida update` | 检查并更新到最新版本 |
| `openyida export-conversation [options]` | 导出 AI 对话记录 |
| `openyida feedback <setup\|url\|dismiss\|status> [options]` | 配置体验反馈表单和本地提醒状态 |
| `openyida batch <file>\|--commands "cmd1 ; cmd2" [--stop-on-error] [--json]` | 批量执行 OpenYida 命令 |
| `openyida flash-to-prd --file <path> --name "<project>"` | 闪记 / 会议纪要转 PRD prompt |
| `openyida ai <text\|image> [options]` | 调用 AI 文生文和识图能力 |
| `openyida asset <status\|verify-url\|resolve\|generate> [options]` | 检测素材能力 / 校验图片 URL / 解析回填素材 |
| `openyida cdn-config [options]` | 配置 CDN / OSS 上传 |
| `openyida cdn-upload <image-path>` | 上传图片到 CDN |
| `openyida cdn-refresh [options]` | 刷新 CDN 缓存 |

<!-- OPENYIDA_COMMANDS_END -->

## Agent Skills

`yida-skills/` 是 OpenYida 的 Agent 技能源码目录：

| 路径 | 说明 |
|------|------|
| `yida-skills/SKILL.md` | 技能入口和路由索引 |
| `yida-skills/skills/<skill-name>/SKILL.md` | 每个子技能的独立说明 |
| `yida-skills/references/` | 跨技能共享参考文档 |

构建悟空可上传技能包：

```bash
npm run build:skills
```

输出：

```text
dist/skills/openyida/
openyida-skills.zip
```

QwenWork（千问办公）与 QoderWork 一样使用用户级全局 skill 目录：`~/.qwenworkcn/skills/yida-skills/`；未检测到 `~/.qwenworkcn` 时跳过。

## 开发与校验

```bash
npm test
npm run check:skills
npm run build:skills
npm run check:ci
```

真实环境 E2E 需要明确打开：

```bash
OPENYIDA_E2E=1 npm run test:e2e:real
OPENYIDA_E2E=1 npm run test:e2e:real:full
```

Skill 路由和生成质量评测：

```bash
npm run eval:routing
OPENYIDA_E2E=1 npm run eval:e2e -- --skill yida-dashboard --screenshot
OPENYIDA_E2E=1 npm run eval:generate -- --screenshot
npm run eval:dashboard
```

## 贡献

新增 CLI 命令时，同步更新命令路由、README 命令说明和相关 skill。修改技能结构后运行：

```bash
npm run check:skills
npm run build:skills
```

更多说明见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
