# OpenYida — AI Agent 开发指引

本文件为 AI 编程助手（Claude Code、Aone Copilot、Cursor、OpenCode 等）提供项目上下文，帮助 AI 更准确地理解项目结构和开发规范。

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
│   │   ├── utils.js         # 公共工具函数（Cookie、HTTP、路径等）
│   │   ├── i18n.js          # 国际化支持
│   │   ├── locales/         # 语言包（zh-CN、en-US）
│   │   ├── env.js           # 检测 AI 工具环境（Claude/Cursor/Copilot 等）
│   │   ├── copy.js          # 初始化 project 工作目录
│   │   ├── check-update.js  # 版本检测（每天一次）
│   │   ├── doctor.js        # 环境诊断与自动修复
│   │   ├── query-data.js    # 查询表单实例数据
│   │   ├── task-center.js   # 全局任务中心（待办/我创建的/我已处理/抄送/代提交）
│   │   └── babel-transform/ # Babel 编译器（用于自定义页面）
│   ├── auth/                # 登录认证模块
│   │   ├── login.js         # 宜搭登录（Cookie 缓存 + 扫码）
│   │   ├── auth.js          # 登录态管理（status/login/refresh/logout）
│   │   ├── org.js           # 组织管理（列出/切换组织）
│   │   └── qr-login.js      # 终端二维码扫码登录
│   ├── app/                 # 应用 / 表单 / 页面管理
│   │   ├── create-app.js    # 创建宜搭应用
│   │   ├── create-page.js   # 创建自定义展示页面
│   │   ├── create-form.js   # 创建 / 更新表单页面
│   │   ├── get-schema.js    # 获取表单 Schema
│   │   ├── publish.js       # 编译并发布自定义页面（Babel 转译）
│   │   ├── export-app.js    # 导出应用（生成迁移包）
│   │   ├── import-app.js    # 导入迁移包，重建应用
│   │   └── update-form-config.js  # 更新表单配置
│   ├── page-config/         # 页面公开访问 / 分享配置
│   │   ├── verify-short-url.js    # 验证短链接 URL
│   │   ├── save-share-config.js   # 保存公开访问 / 分享配置
│   │   └── get-page-config.js     # 查询页面公开访问 / 分享配置
│   ├── permission/          # 表单权限管理
│   │   ├── get-permission.js      # 查询表单权限配置
│   │   └── save-permission.js     # 保存表单权限配置
│   ├── process/             # 流程管理
│   │   ├── configure-process.js   # 配置并发布流程规则
│   │   └── create-process.js      # 创建流程表单（一体化）
│   ├── conversation/        # AI 对话管理
│   │   ├── collector.js     # 对话记录收集
│   │   ├── formatter.js     # 对话格式化
│   │   └── export-conversation.js  # 导出对话记录
│   ├── flash-note/          # 闪记转 PRD
│   │   └── flash-to-prd.js  # 闪记转高质量 prompt（支持会议识别）
│   ├── dws/                 # 钉钉 CLI 集成
│   │   └── dws-wrapper.js   # 钉钉 CLI 包装器（通讯录/日历/待办/审批等）
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
│   ├── cdn/                 # CDN / OSS 管理
│   │   ├── cdn-config.js          # CDN 配置读写
│   │   ├── cdn-config-cmd.js      # CDN 配置命令
│   │   ├── cdn-upload.js          # 上传图片到 OSS/CDN
│   │   └── cdn-refresh.js         # 刷新 CDN 缓存
│   ├── report/              # 宜搭报表管理
│   │   ├── create-report.js       # 创建报表（入口）
│   │   ├── index.js               # 创建报表主流程
│   │   ├── append.js              # 向已有报表追加图表
│   │   ├── chart-builder.js       # 图表 Schema 构建
│   │   ├── http.js                # 报表 HTTP 请求封装
│   │   └── constants.js           # 常量与 ID 生成工具
│   └── data-management.js   # 表单数据管理（增删改查）
├── project/
│   ├── config.json          # 应用配置（appType、pageId 等）
│   └── pages/               # 自定义页面源码目录
├── yida-skills/
│   ├── SKILL.md             # 技能入口（索引表，列出所有子技能）
│   ├── skills/              # 子技能目录（每个 skill 自包含 SKILL.md + references/）
│   └── reference/           # 跨 skill 共享参考文档（yida-api、model-api、query-condition-guide）
└── scripts/
    ├── postinstall.js       # 安装后脚本（环境检测 + 配置注入）
    ├── validate-ci.sh       # CI 校验脚本
    └── validate-structure.js # 项目结构校验
```

## 关键约定

### 命令实现规范
- 每个 CLI 命令对应 `lib/` 下一个独立的 `.js` 文件
- 所有命令通过 `bin/yida.js` 统一路由，新增命令需在此注册
- 命令函数导出为 `module.exports = async function commandName(args) {}`
- 错误处理：使用 `process.exit(1)` 退出，错误信息输出到 `stderr`

### 宜搭 API 调用
- 所有宜搭 API 调用需携带 Cookie（从 `login.js` 获取缓存）
- API 基础路径：`https://www.aliwork.com`
- 参考 `yida-skills/reference/yida-api.md` 了解完整 API 列表

### 环境检测
- `lib/env.js` 负责检测当前运行的 AI 工具环境
- 支持环境：Claude Code、Aone Copilot、Cursor、OpenCode、Qoder、悟空
- 不同环境的 Cookie 提取方式不同（CDP 协议 / 文件读取 / 扫码）

### 自定义页面
- 源码位于 `project/pages/src/`，使用 React + 宜搭 SDK
- 发布前通过 `lib/babel-transform/` 进行 Babel 编译
- 编译产物输出到 `project/pages/dist/`

### yida-skills 架构规范
- **入口文件** `yida-skills/SKILL.md` 是索引表，列出所有子技能和共享参考文档
- **每个子技能**位于 `yida-skills/skills/<skill-name>/` 目录下，包含独立的 `SKILL.md`
- **专属参考文档**放在各 skill 的 `references/` 目录下（复数形式），实现自包含
- **跨 skill 共享文档**保留在 `yida-skills/reference/` 目录下（`yida-api.md`、`model-api.md`、`query-condition-guide.md`）
- 新增子技能时，同步更新 `yida-skills/SKILL.md` 的索引表

## 开发注意事项

1. **不要修改 `yida-skills/` 下的文档**，除非是在更新技能描述
2. **新增 CLI 命令**时，同步更新 `README.md` 的命令一览表
3. **登录态**存储在本地缓存，不要在代码中硬编码任何凭证
4. **测试**：运行 `npm test` 执行 `tests/` 下的单元测试
5. **JS 语法检查**：`node --check <file>` 验证语法正确性

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
- 检查 `lib/login.js` 中的 Cookie 缓存逻辑
- 使用 `openyida env` 确认当前环境检测是否正确
- 悟空环境使用 CDP 协议，其他环境使用扫码登录
