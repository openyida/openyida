# OpenYida — AI Agent 开发指引

本文件为 AI 编程助手（Codex、Claude Code、Aone Copilot、Cursor、OpenCode、Qoder、悟空 等）提供项目上下文，帮助 AI 更准确地理解项目结构和开发规范。

## 项目简介

OpenYida 是一个 CLI 工具，让开发者通过 AI 对话驱动宜搭低代码平台，实现应用的创建、表单管理、页面发布等全流程操作。

**核心定位**：AI 编程工具 × 宜搭低代码平台 的桥接层。

## 项目结构

```
openyida/
├── bin/
│   └── yida.js              # CLI 入口，解析命令并路由到 lib/
├── lib/
│   ├── core/                # 核心基础模块
│   │   ├── utils.js         # 公共工具函数（Token、HTTP、路径等）
│   │   ├── chalk.js         # 终端彩色输出公共样式模块（统一 chalk 风格）
│   │   ├── i18n.js          # 国际化支持
│   │   ├── locales/         # 语言包（zh、en、zh-HK、ja、ko、fr、de、es、pt、ar、hi、vi）
│   │   ├── env.js           # 检测 AI 工具环境（Codex/Claude/Cursor/Copilot/Qoder/悟空 等）
│   │   ├── env-cmd.js       # env 命令入口（显示当前环境信息）
│   │   ├── env-manager.js   # 多环境配置管理（私有化部署多环境切换）
│   │   ├── copy.js          # 初始化 project 工作目录
│   │   ├── sample.js        # sample 命令（输出代码示例到工作目录）
│   │   ├── check-update.js  # 版本检测（每天一次）
│   │   ├── check-data.js    # 数据异常检测（流程表单数据校验）
│   │   ├── update.js        # self-update 命令（通过 npm 自动更新 openyida）
│   │   ├── doctor.js        # 环境诊断与自动修复
│   │   ├── query-data.js    # 统一数据管理命令（表单/流程/任务/子表单）
│   │   ├── task-center.js   # 全局任务中心（待办/我创建的/我已处理/抄送/代提交）
│   │   └── babel-transform/ # Babel 编译器（用于自定义页面）
│   ├── auth/                # 登录认证模块
│   │   ├── token-auth.js    # OAuth loopback + token 登录态管理
│   │   ├── token-store.js   # 本地 token session 存储
│   │   ├── oauth-loopback.js # OAuth 回调监听与授权码换取
│   │   └── org.js           # 组织管理（列出/切换组织）
│   ├── basic-info/          # 企业基础信息查询（版本 / 授权 / 域名）
│   │   └── basic-info.js    # 企业版本、授权信息与域名管理
│   ├── bridge/              # 浏览器桥接服务（本地 HTTP 代理连接宜搭页面）
│   │   └── bridge.js        # Bridge HTTP 服务器（本地代理 + 页面唤起）
│   ├── samples/             # 代码示例/模板（通过 openyida sample 命令输出到工作目录）
│   │   ├── yida-chart/            # ECharts 图表示例（7个）
│   │   ├── yida-custom-page/      # 自定义页面模板（2个）
│   │   ├── yida-create-app/       # 应用创建模板（1个）
│   │   ├── yida-data-management/  # 表单字段模板（1个）
│   │   ├── yida-density/          # 密度切换示例（1个）
│   │   └── yida-table-form/       # 表格表单示例（1个）
│   ├── a2a/                 # A2A 协议服务器（Agent-to-Agent HTTP 通信）
│   │   ├── cmd.js           # a2a 命令入口（参数解析与启动）
│   │   └── server.js        # A2A HTTP 服务实现（JSON-RPC 路由）
│   ├── agent-center/        # 智能代理任务中心（代理人任务管理）
│   │   ├── agent-center.js  # 代理人任务命令（创建/更新/取消/查询）
│   │   └── api.js           # 代理人 API 请求封装
│   ├── aggregate-table/     # 聚合表管理（虚拟视图 / 聚合表单）
│   │   └── aggregate-table.js # 聚合表创建与配置
│   ├── ai/                  # 宜搭 AI 能力（文生文 / 识图）
│   │   └── ai.js            # AI 命令入口（txtFromAI / 图片识别）
│   ├── app/                 # 应用 / 表单 / 页面管理
│   │   ├── app-list.js      # yida-app-list：查询我的应用列表（名称/appType/地址）
│   │   ├── create-app.js    # 创建宜搭应用
│   │   ├── create-page.js   # 创建自定义展示页面
│   │   ├── create-form.js   # 创建 / 更新表单页面
│   │   ├── get-schema.js    # 获取表单 Schema
│   │   ├── generate-page.js # 基于模板生成自定义页面源码
│   │   ├── check-page.js    # 自定义页面规范检查
│   │   ├── compile.js       # 本地编译自定义页面
│   │   ├── publish.js       # 编译并发布自定义页面（Babel 转译）
│   │   ├── export-app.js    # 导出应用（生成迁移包）
│   │   ├── import-app.js    # 导入迁移包，重建应用
│   │   └── update-form-config.js  # 更新表单配置
│   ├── app-permission/      # 应用权限管理（管理员角色配置）
│   │   └── app-permission.js # 应用管理员角色分配（主管理/数据/应用管理员）
│   ├── page-config/         # 页面公开访问 / 分享配置
│   │   ├── verify-short-url.js    # 验证短链接 URL
│   │   ├── save-share-config.js   # 保存公开访问 / 分享配置
│   │   └── get-page-config.js     # 查询页面公开访问 / 分享配置
│   ├── permission/          # 表单权限管理
│   │   ├── get-permission.js      # 查询表单权限配置
│   │   └── save-permission.js     # 保存表单权限配置
│   ├── process/             # 流程管理
│   │   ├── configure-process.js   # 配置并发布流程规则
│   │   ├── create-process.js      # 创建流程表单（一体化）
│   │   └── preview-process.js     # 流程预览（可视化流程图 + 高亮当前节点）
│   ├── conversation/        # AI 对话管理
│   │   ├── collector.js     # 对话记录收集
│   │   ├── formatter.js     # 对话格式化
│   │   └── export-conversation.js  # 导出对话记录
│   ├── feedback/            # 体验反馈收集（表单化反馈提交）
│   │   └── feedback.js      # 反馈表单创建与提交（自动检测 AI 工具环境）
│   ├── flash-note/          # 闪记转 PRD
│   │   └── flash-to-prd.js  # 闪记转高质量 prompt（支持会议识别）
│   ├── formula/             # 公式求值引擎（宜搭公式本地计算）
│   │   └── evaluate.js      # 宜搭公式解析与求值（支持 60+ 内置函数）
│   ├── dingtalk/            # 钉钉链接生成（AppLink / 页面链接构建）
│   │   └── dingtalk-link.js # 钉钉 AppLink URL 与页面链接生成
│   ├── dws/                 # 钉钉 CLI 集成
│   │   └── dws-wrapper.js   # 钉钉 CLI 包装器（通讯录/日历/待办/审批等）
│   ├── i18n-management/     # 应用多语言管理（语言包配置）
│   │   └── i18n-management.js # 应用级多语言资源管理（12 种语言）
│   ├── integration/         # 集成 & 自动化
│   │   └── integration-create.js  # 创建集成逻辑流
│   ├── connector/           # HTTP 连接器管理
│   │   ├── api.js                 # 连接器 API 请求封装
│   │   ├── connector-list.js
│   │   ├── connector-create.js
│   │   ├── connector-detail.js
│   │   ├── connector-delete.js
│   │   ├── connector-add-action.js
│   │   ├── connector-list-actions.js
│   │   ├── connector-delete-action.js
│   │   ├── connector-test.js
│   │   ├── connector-list-connections.js
│   │   ├── connector-create-connection.js
│   │   ├── connector-smart-create.js
│   │   ├── connector-parse-api.js
│   │   ├── connector-gen-template.js
│   │   ├── curl-parser.js         # cURL 命令解析
│   │   ├── doc-parser.js          # API 文档解析
│   │   ├── response-parser.js     # 响应结构解析
│   │   ├── action-generator.js    # Action 自动生成
│   │   └── desc-generator.js      # 描述自动生成
│   ├── corp-efficiency/     # 企业效能分析（平台管理效能指标）
│   │   └── corp-efficiency.js # 效能概览 / 详情 / 分组 / 通知
│   ├── corp-manager/        # 平台权限管理（管理员 / 通讯录可见性）
│   │   ├── api.js           # 管理员与通讯录 API 封装
│   │   └── corp-manager.js  # 管理员增删查 / 通讯录可见性配置
│   ├── cdn/                 # CDN / OSS 管理
│   │   ├── cdn-config.js          # CDN 配置读写
│   │   ├── cdn-config-cmd.js      # CDN 配置命令
│   │   ├── cdn-upload.js          # 上传图片到 OSS/CDN
│   │   └── cdn-refresh.js         # 刷新 CDN 缓存
│   ├── mcp/                 # MCP 协议服务器（Model Context Protocol）
│   │   └── server.js        # MCP JSON-RPC 服务实现（工具注册与调用）
│   ├── report/              # 宜搭报表管理
│   │   ├── create-report.js       # 创建报表（入口）
│   │   ├── index.js               # 创建报表主流程
│   │   ├── append.js              # 向已有报表追加图表
│   │   ├── chart-builder.js       # 图表 Schema 构建
│   │   ├── http.js                # 报表 HTTP 请求封装
│   │   └── constants.js           # 常量与 ID 生成工具
│   ├── db/                  # 数据库工具
│   │   └── db-seq-fix.js          # PostgreSQL Sequence 自动修复（解决主键序列漂移）
├── project/
│   ├── config.json          # 应用配置（appType、pageId 等）
│   └── pages/               # 自定义页面源码目录
├── yida-skills/
│   ├── SKILL.md             # 源码态技能入口（索引表，列出所有子技能）
│   ├── skills/              # 子技能目录（每个 skill 自包含 SKILL.md + references/）
│   └── references/           # 跨 skill 共享参考文档（yida-api、model-api、query-condition-guide）
└── scripts/
    ├── build-skills-package.js # 生成悟空可上传的 dist/skills/openyida 技能目录和 openyida-skills.zip
    ├── postinstall.js       # 安装后脚本（环境检测 + 配置注入）
    ├── e2e-real/            # 真实环境确定性 CLI 链路测试（runner/full-runner/skill-coverage/cleanup）
    ├── eval/               # Skill 测评 harness（路由测评 + 端到端截图打分），见下文
    ├── validate-ci.sh       # CI 校验脚本
    └── validate-structure.js # 项目结构校验
```

### Skill 测评 Harness（scripts/eval/）

`e2e-real/` 验证 CLI 链路是否跑通；`eval/` 验证**改动 `yida-skills/SKILL.md` 后 agent 的路由与产出是否变好**，是 harness engineering 的反馈闭环。

- `config.js`：解析配置，优先级 `CLI flag > env(OPENYIDA_EVAL_*) > eval.config.json > 默认`；`--skill` 经 `SKILL_COVERAGE` 矩阵反查 stages。
- `agent.js`：唯一的 headless agent 封装（`claude -p --output-format json`），路由测评与截图打分共用；CLI 缺失时返回 `available:false` 优雅降级。
- `routing.js` + `scenarios/`：**路由测评（选对子技能吗）**——把自然语言 prompt 跑一遍，比对选中的子技能与 golden 集，算命中率/混淆对。无副作用、不建资源。
- `generate.js` + `scenarios/generation/`：**真实生成（自然语言建应用）**——把「帮我创建一个订单管理系统」这类自然语言喂给 `claude -p`，让它**自主读技能 + 真的执行 CLI** 产出真实应用，再复用截图 + 打分 + 报告链路。测「端到端：一句话能否真生成可用应用」。与「工具管道基线」（确定性 CLI、固定命名、不经过 agent）的区别是 agent 自主编排。agent 运行器可注入，单测永不碰真实 CLI/不建资源。
- `guardrail.js`：纯函数护栏——任何资源变更命令出现前必须先有成功的 `login --check-only`，否则红线 fail。
- `screenshot.js`：动态解析 Playwright（软依赖），注入 token session 截发布页；缺失则跳过。
- `score.js`：调本地多模态 `claude -p` 对截图按 rubric 打分；不开自动分则只生成 `scoring.md` 人工模板。
- `report.js`：把护栏 + 截图 + 打分渲染成自包含 `eval-report.html`（截图 base64 内联，单文件可分享），与 `scoring.md` 并列产出。
- `manifest.js` + `runner.js`：把 eval 结果**增量回写**进现有 `acceptance-manifest.json` 的 `eval` 段，不另起产物；真实生成产物落 `project/.cache/eval/generate/gen-<时间戳>/`。其中 `runner.js` 的「工具管道基线（端到端）」用固定命令验证「建应用→截图→打分」管道本身健康，是排查 agent vs 工具问题的对照基线。
- `dashboard/`：零依赖本地控制台（`npm run eval:dashboard` → `http://127.0.0.1:4500`），按钮触发 + SSE 实时流式输出，首页「ℹ︎ 测评思路」概览讲清各任务目的，「📊 查看最新报告」打开最新 `eval-report.html`。

命令：`npm run eval:routing`、`npm run eval:e2e`、`npm run eval:generate`、`npm run eval:all`、`npm run eval:dashboard`（端到端 / 生成需 `OPENYIDA_E2E=1` + 有效 token session + 已认证 agent）。`all` = 路由测评 + 工具管道基线 + 真实生成。纯函数逻辑由 `tests/eval-*.test.js` 覆盖，进 CI。

## 关键约定

### 命令实现规范
- 每个 CLI 命令对应 `lib/` 下一个独立的 `.js` 文件
- 所有命令通过 `bin/yida.js` 统一路由，新增命令需在命令清单和路由中注册
- 命令函数导出为 `module.exports = async function commandName(args) {}` 或 `{ run }`
- 错误处理：新增/改造的业务模块应抛出 `CliError` 或普通 `Error`，由 `bin/yida.js` 统一处理退出码；不要在可复用业务模块里新增 `process.exit(...)`

### 宜搭 API 调用
- 所有宜搭 API 调用需通过 `loadAuthData` / `createAuthRef` 读取 token session，并由 HTTP 工具自动注入 `Authorization: Bearer <access_token>`
- API 基础路径：`https://www.aliwork.com`
- 参考 `yida-skills/references/yida-api.md` 了解完整 API 列表

### 环境检测
- `lib/core/env.js` 负责检测当前运行的 AI 工具环境
- 支持环境：Codex、Claude Code、Aone Copilot、Cursor、OpenCode、Qoder、悟空
- 不同环境会影响工作区路径、浏览器可用性和 agent 能力；登录态统一走 OAuth token session，不再依赖 Cookie 提取

### Codex 特殊说明
- Codex 环境下 `openyida login` 仍使用 OAuth loopback + token session；登录完成后用 `openyida login --check-only --json` 或 `openyida auth status` 验证
- 不要引导用户导出浏览器 Cookie、使用旧二维码 handoff，或手写 `.cache/cookies.json`
- 多组织账号测试时，优先传入 `--corp-id <corpId>`，不要由 AI 代理代替用户选择组织

### 悟空（Wukong）特殊说明
- 悟空工作区路径含动态 uuid：`~/.real/users/{uuid}/workspace/`，通过 `AGENT_WORK_ROOT` 环境变量获取
- `lib/core/utils.js` 的 `detectActiveTool()` 直接读取 `AGENT_WORK_ROOT` 作为工作区根目录
- `openyida copy` 在**空目录**时会直接把 `project/` 内容铺入工作区（不创建 `project/` 子目录层级）
- 悟空通过手动上传技能包，`postinstall` 不会自动安装 `yida-skills/`
- 悟空发布包由 `npm run build:skills` 生成到 `dist/skills/openyida/`，同时输出可直接上传悟空的 `openyida-skills.zip`。该包只保留一个根 `SKILL.md`，frontmatter 只能包含 `name` 和 `description`，子技能文档会被转换到 `references/subskills/`。
- 悟空自带 node/npm 路径：macOS/Linux 为 `~/.real/.bin/node/bin/`，Windows 为 `%USERPROFILE%\.real\.bin\node\bin\`。执行任何 `npm`/`node`/`npx` 命令前**必须**先设置 PATH：
  - macOS/Linux：`export PATH="$HOME/.real/.bin/node/bin:$PATH"`
  - Windows (PowerShell)：`$env:PATH = "$env:USERPROFILE\.real\.bin\node\bin;$env:PATH"`
  否则可能调用到本地系统 node 导致权限报错

### 自定义页面
- 源码位于 `project/pages/src/`，使用 React + 宜搭 SDK
- 发布前通过 `lib/babel-transform/` 进行 Babel 编译
- 编译产物输出到 `project/pages/dist/`

### yida-skills 架构规范
- **源码目录** 保持为 `yida-skills/`，便于与历史安装路径和 Codex/OpenYida 插件兼容；对外发布的悟空 zip 使用生成目录 `dist/skills/openyida/`
- **入口文件** `yida-skills/SKILL.md` 是索引表，列出所有子技能和共享参考文档；为兼容悟空上传规范，根 frontmatter 只能包含 `name` 和 `description`
- **每个子技能**位于 `yida-skills/skills/<skill-name>/` 目录下，包含独立的 `SKILL.md`
- **专属参考文档**放在各 skill 的 `references/` 目录下（复数形式），实现自包含
- **跨 skill 共享文档**保留在 `yida-skills/references/` 目录下（`yida-api.md`、`model-api.md`、`query-condition-guide.md`）
- 新增子技能时，同步更新 `yida-skills/SKILL.md` 的索引表
- 修改技能结构后运行 `npm run check:skills` 和 `npm run build:skills`，确认源码态和悟空发布态都正确

## 开发注意事项

1. **不要修改 `yida-skills/` 下的文档**，除非是在更新技能描述
2. **新增 CLI 命令**时，同步更新 `README.md` 的命令一览表
3. **登录态**存储在本地缓存，不要在代码中硬编码任何凭证
4. **测试**：优先运行 `npm run check:ci`，窄范围修改可先运行相关 Jest 用例
5. **JS 语法检查**：`node --check <file>` 验证语法正确性
6. **终端输出样式**：统一使用 `lib/core/chalk.js` 提供的公共样式模块，不要在各命令文件中单独 `require('chalk')` 并自定义颜色
7. **国际化**：新增用户可见的文案时，需以 `zh` 为基准同步到 `lib/core/locales/` 下所有 12 个语言包（至少补齐 `en`，它是运行时缺失兜底链 `当前语言 → en → zh` 的中转轴）。CI 通过 `npm run check:i18n`（棘轮模式）拦截**新增**漂移；本地可用 `npm run check:i18n:audit` 看完整缺失清单，补齐后运行 `npm run check:i18n:baseline` 收紧基线（`scripts/i18n-baseline.json`）
8. **私有化部署**：多环境配置通过 `lib/core/env-manager.js` 管理，不要在命令文件中硬编码 API 域名

## 常见任务示例

### 添加新 CLI 命令
1. 在 `lib/` 下创建 `new-command.js`
2. 在 `bin/yida.js` 中注册命令路由
3. 在 `README.md` 的 CLI 命令一览表中添加说明
4. 在 `yida-skills/SKILL.md` 中更新技能描述（索引表中添加新行）

### 添加新子技能
1. 在 `yida-skills/skills/` 下创建 `<skill-name>/SKILL.md`
2. 若有专属参考文档，放在 `<skill-name>/references/` 目录下
3. 在 `yida-skills/SKILL.md` 的索引表中添加新行
4. 在 `AGENTS.md` 中无需额外更新（索引表自动覆盖）

### 调试登录问题
- 检查 `lib/auth/token-auth.js`、`lib/auth/token-store.js`、`lib/auth/oauth-loopback.js` 中的 OAuth token 登录与缓存逻辑
- 使用 `openyida env`、`openyida login --check-only --json` 或 `openyida auth status` 确认当前环境与 token session 是否正确
