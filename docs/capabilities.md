# OpenYida 功能完整列表

这份清单面向宜搭使用者和 AI Agent，按本地 OpenYida `2026.8.19` 的 101 条命令和技能路由整理。参数细节可以继续查看 `openyida --help`、`openyida <command> --help` 或 `openyida commands --json`。

<Note>
日常使用建议先运行 `openyida agent-capabilities --summary-json`，它会轻量返回版本、登录态、组织、工作目录和命令清单摘要。只有排查命令契约、权限元数据或登录异常时，再使用完整的 `openyida agent-capabilities --json`。
</Note>

## 基础操作

| 功能 | 执行操作 |
|---|---|
| 检测当前环境和登录态 | `openyida env` / `openyida env --json` |
| 管理环境 profile（切换目标环境、维护 endpoint/login-url） | `openyida env <setup\|list\|show\|switch\|add\|remove>` |
| 登录宜搭 | `openyida login` |
| 指定入口登录 | `openyida login <target-url>` |
| 只检查是否已登录 | `openyida login --check-only --json` |
| 查看可切换组织 | `openyida org list` |
| 交互式切换组织 | `openyida org switch` |
| 切换到指定组织 | `openyida org switch --corp-id <corpId>` |
| 退出登录 | `openyida logout` |
| 管理 token 登录态 | `openyida auth <status\|login\|refresh\|logout>` |
| 查看全部命令清单 | `openyida commands --json` |
| 默认轻量预检 | `openyida agent-capabilities --summary-json` |
| 获取完整 Agent 能力诊断 | `openyida agent-capabilities --json` |

## 应用与组织管理

| 功能 | 执行操作 |
|---|---|
| 查询我的应用 | `openyida app-list [--size N]` |
| 创建应用 | `openyida create-app "<应用名称>"` |
| 更新应用名称、自定义主题、导航风格、Logo 来源、布局、访问态应用导航显示 | `openyida update-app <appType> [--theme-file <css>] [--nav-theme light\|dark\|white\|gray] [--logo-source appIcon\|customImage] [--layout side\|top\|l_shape]` |
| 启用应用 / 上线应用 | `openyida app-online <appType> [--to-ding-app-center] [--show-app-center]` |
| 停用应用 / 下线应用 | `openyida app-offline <appType> [--to-ding-app-center] [--show-app-center]` |
| 导出应用迁移包 | `openyida export <appType> [output]` |
| 导入应用迁移包 | `openyida import <file> [name]` |
| 管理左侧导航分组 | `openyida nav-group <list\|create\|rename\|delete\|move\|order\|auto-order\|hide\|show> <appType> ...` |
| 管理应用管理员 | `openyida app-permission <get\|set\|add\|remove\|search-user> ...` |
| 管理应用多语言 | `openyida i18n <overview\|config\|languages\|list\|upsert\|delete\|translate\|translate-all\|upgrade> <appType> ...` |
| 查询组织基础信息、容量、额度、域名 | `openyida basic-info <overview\|commodity\|grant\|capacity\|quota\|abs-path\|dataflow\|i18n\|domain>` |
| 查询企业效能 | `openyida corp-efficiency [overview\|details\|detail\|groups\|notify] [options]` |
| 管理平台管理员和通讯录权限 | `openyida corp-manager <search-user\|list\|add\|remove\|address-book> ...` |

说明：CLI 界面语言默认内置 `zh` / `en`。其他语言包可通过 `OPENYIDA_LOCALE_DIR` 按需加载；应用内多语言仍使用 `openyida i18n` 管理宜搭应用文案。

## 表单与数据模型

| 功能 | 执行操作 |
|---|---|
| 创建表单 | `openyida create-form create <appType> ...` |
| 校验表单字段配置 | `openyida create-form validate-fields <fieldsJsonOrFile>` |
| 更新表单字段 | `openyida create-form update <appType> ...` |
| 用 patch 更新表单 | `openyida create-form patch <appType> <formUuid> <patchJsonOrFile>` |
| 配置表单联动规则 | `openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>` |
| 配置字段校验 | `openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>` |
| 快速新增字段校验 | `openyida add-validation <appType> <formUuid> --field <labelOrId> --type <phone\|regex\|idCard\|email\|...>` |
| 绑定字段远程数据源 | `openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>` |
| 给选项字段追加选项 | `openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...` |
| 查询应用内表单/页面 | `openyida list-forms <appType> [--keyword <text>]` |
| 获取表单 Schema | `openyida get-schema <appType> <formUuid>` |
| 获取应用全部 Schema | `openyida get-schema <appType> --all` |
| 导出 ER 关系图 | `openyida er <appType> [--format mermaid\|json] [--output file]` |
| 管理聚合表 virtualView | `openyida aggregate-table <list\|create-empty\|inspect\|preview\|save\|publish\|status> <appType> ...` |

## 自定义页面与发布

| 功能 | 执行操作 |
|---|---|
| 创建自定义页面 | `openyida create-page <appType> "<页面名称>"` |
| 创建看板页 | `openyida create-page <appType> "<页面名称>" --mode dashboard` |
| 查看或输出自定义页面示例 | `openyida sample yida-canvas-custom-page <sample> --output project/pages/src/<name>.canvas.jsx` / `openyida sample yida-custom-page <sample> --output project/pages/src/<name>.oyd.jsx` |
| 构建宜搭兼容页面源码 | `openyida build-page <sourceFile> [--output file\|--write]` |
| 检查普通自定义页面 JSX 规范 | `openyida check-page <src> [--compat]` |
| 本地编译普通自定义页面 JSX | `openyida compile <src>` |
| 发布普通自定义页面 JSX | `openyida publish project/pages/src/home.oyd.jsx <appType> <formUuid>` |
| 发布 Code Canvas 页面 | `openyida publish project/pages/src/home.canvas.jsx <appType> <formUuid>`（`.canvas.jsx` / `.canvas.tsx` 自动启用 Canvas 编译，生成 `runtimeCode` + `importedModules` 并保存为 `YidaCodeCanvas` Schema） |
| 显式按 Code Canvas 链路发布 | `openyida publish <src> <appType> <formUuid> --canvas` |
| 发布并做健康检查 | `openyida publish <src> <appType> <formUuid> --health-check` |
| 更新页面/表单配置 | `openyida update-form-config <appType> ...` |
| 查询页面/表单配置 | `openyida get-form-config <appType> <formUuid> [--json]` |
| 开发高级自定义页面、看板、图表或幻灯片 | 默认优先使用 Code Canvas 链路；明确要求普通自定义页面 JSX/Jsx，或强依赖普通自定义页实例桥时使用 `.oyd.jsx` + `check-page` / `compile` / `publish` |
| Code Canvas 页面使用成员/部门/上传等宜搭运行态组件 | `openyida sample yida-canvas-custom-page native-components-smoke --output pages/src/native-components-smoke.canvas.jsx`；再参考 `yida-canvas-custom-page/references/native-components-bridge.md` |
| Code Canvas 门户 + 成员/部门/上传组件示例 | `openyida sample yida-canvas-custom-page portal-native-components --output pages/src/portal-native-components.canvas.jsx` |
| 普通自定义页面 JSX/Jsx 使用成员/部门组件 | 使用 `.oyd.jsx`，参考 `yida-custom-page/references/component-jsx-guide.md` |
| 普通自定义页面 JSX/Jsx 使用附件/图片上传 | 使用 `.oyd.jsx`，参考 `yida-custom-page/references/attachment-upload-guide.md` |

### 自定义页面链路选择

| 需求 | 推荐链路 |
|---|---|
| 现代 React、Hooks、官网、工作台、看板、列表、详情、可视化、AI 首次生成页面 | Code Canvas：`.canvas.jsx` / `.canvas.tsx` / `YidaCodeCanvas` |
| 需要成员、部门、附件上传、图片上传等宜搭运行态组件，且希望页面保持现代 React 体验 | Code Canvas + 原生组件桥；先跑 smoke 示例验证运行态组件，再做 fallback 和值归一化 |
| 用户明确要求普通自定义页面 JSX/Jsx 组件链路 | 普通自定义页面：`.oyd.jsx` / `Jsx` |
| 强依赖 `this.$(fieldId)`、`this.utils.yida.*`、`this.dataSourceMap`、表单提交或字段双向绑定 | 普通自定义页面：`.oyd.jsx` / `Jsx` |
| 已有普通 `.oyd.jsx` 页面要迁移到 Code Canvas | 参考 `yida-canvas-upgrade` 技能 |

<Tip>
新版自定义页面默认走 Code Canvas。`check-page` 和 `compile` 主要用于普通自定义页面 JSX；`.canvas.jsx` / `.canvas.tsx` 由 `openyida publish` 的 Canvas 编译阶段校验。
</Tip>

## 流程、审批与任务

| 功能 | 执行操作 |
|---|---|
| 创建流程表单并配置流程 | `openyida create-process <appType> ...` |
| 配置并发布流程规则 | `openyida configure-process <appType> ...` |
| 预览流程实例 | `openyida process preview <appType> <processInstanceId> [--output <path>]` |
| 查询 AI 审批提示配置 | `openyida ai-form-setting get <appType> <formUuid>` |
| 查询 AI 审批可用字段 | `openyida ai-form-setting fields <appType> <formUuid>` |
| 查询 AI 审批模型 | `openyida ai-form-setting models <appType>` |
| 开启或关闭 AI 审批提示 | `openyida ai-form-setting <enable\|disable> <appType> <formUuid>` |
| 保存 AI 审批提示配置 | `openyida ai-form-setting save <appType> <formUuid> <config.json>` |
| 查询任务中心 | `openyida task-center <type> [options]` |
| 管理流程代理/离职代理 | `openyida agent-center <list\|create\|update\|cancel\|range\|search-user> ...` |

## 数据、权限与分享

| 功能 | 执行操作 |
|---|---|
| 查询表单数据 | `openyida data query form <appType> <formUuid> [options]` |
| 新增表单数据 | `openyida data create form <appType> <formUuid> --data-file <file>` |
| 更新表单数据 | `openyida data update form <appType> <formUuid> <formInstId> --data-file <file>` |
| 查询流程/任务/子表数据 | `openyida data <action> <resource> [args]` |
| 查询表单权限 | `openyida get-permission <appType> <formUuid>` |
| 保存表单权限 | `openyida save-permission <appType> <formUuid> ...` |
| 验证短链接 | `openyida verify-short-url <appType> ...` |
| 保存公开访问/分享配置 | `openyida save-share-config <appType> ...` |
| 查询页面分享配置 | `openyida get-page-config <appType> <formUuid>` |
| 规划公开表单镜像字段 | `openyida externalize-form <appType> <formUuid> [--schema-file file]` |

## 报表、看板与可视化

| 功能 | 执行操作 |
|---|---|
| 创建宜搭原生报表 | `openyida create-report <appType> "<报表名称>" ...` |
| 向已有报表追加图表 | `openyida append-chart <appType> <reportId> ...` |
| 创建 Recharts 高级看板 | 使用 Code Canvas + Recharts 示例，并执行 `openyida publish ...` |
| 维护 ECharts 复杂图表页面 | 使用普通自定义页面或 ECharts 兼容链路，并执行 `openyida publish ...` |
| 创建经营看板/管理驾驶舱/数据大屏 | 使用 `create-page`、数据源配置、报表命令和 `publish` 组合完成 |

## 连接器、集成与钉钉

| 功能 | 执行操作 |
|---|---|
| 查询 HTTP 连接器 | `openyida connector list` |
| 创建 HTTP 连接器 | `openyida connector create "name" "domain" ...` |
| 查看连接器详情 | `openyida connector detail <id>` |
| 删除连接器 | `openyida connector delete <id>` |
| 添加连接器动作 | `openyida connector add-action --operations <file> --connector-id <id>` |
| 查询连接器动作 | `openyida connector list-actions <id>` |
| 删除连接器动作 | `openyida connector delete-action <id> <operation-id>` |
| 测试连接器动作 | `openyida connector test --connector-id <id> --action <actionId>` |
| 查询连接器鉴权账号 | `openyida connector list-connections <id>` |
| 创建连接器鉴权账号 | `openyida connector create-connection <id> <name>` |
| 从 cURL 智能创建连接器 | `openyida connector smart-create --curl "..."` |
| 解析 API 文档/接口信息 | `openyida connector parse-api [options]` |
| 生成 API 文档模板 | `openyida connector gen-template [output]` |
| 创建集成自动化 | `openyida integration create <appType> ... [--spec file.json]` |
| 查询集成自动化 | `openyida integration list <appType> [--form-uuid <uuid>]` |
| 启用集成自动化 | `openyida integration enable <appType> <formUuid> <processCode>` |
| 停用集成自动化 | `openyida integration disable <appType> <formUuid> <processCode>` |
| 检查集成异常日志 | `openyida integration check <appType...>` |
| 诊断集成配置问题 | `openyida integration diagnose (--text <text>\|--file <path>\|--rules)` |
| 调用钉钉 CLI | `openyida dws <command> [args]` |
| 搜索钉钉联系人 | `openyida dws contact user search --keyword <text>` |
| 生成钉钉 AppLink | `openyida dingtalk-link <url> [--target fullScreen]` |

## AI、公式与知识整理

| 功能 | 执行操作 |
|---|---|
| AI 文生文 | `openyida ai text [options]` |
| AI 识图 | `openyida ai image [options]` |
| 检测素材能力 | `openyida asset status [options]` |
| 校验图片 URL | `openyida asset verify-url <url> [options]` |
| 解析并回填页面素材 | `openyida asset resolve [options]` |
| 生成 AI 图片素材 | `openyida asset generate [options]` |
| 检查宜搭公式 | `openyida formula evaluate <formula\|file> [--schema file]` |
| 读取钉钉文档并转为 Markdown | `openyida read-dingtalk-doc <docUrl> [--output <file>] [--json]` |
| 按 taskUuid 读取钉钉听记 | `openyida read-dingtalk-tingji <taskUuid> [--json]` |
| 闪记/会议纪要转 PRD | `openyida flash-to-prd --file <path> --name "<project>"` |
| 导出 AI 对话记录 | `openyida export-conversation [options]` |
| 整理 VOC 反馈材料 | 按故障、需求或性能问题整理成可提交材料 |
| 配置体验反馈入口 | `openyida feedback <setup\|url\|dismiss\|status> [options]` |

## 本地开发、诊断与运维

| 功能 | 执行操作 |
|---|---|
| 初始化 project 工作目录 | `openyida copy [--force]` |
| 查看/输出示例模板 | `openyida sample [--list]` |
| 环境诊断与自动修复 | `openyida doctor [--fix]` |
| 批量执行命令文件 | `openyida batch <file> [--stop-on-error] [--json]` |
| 批量执行内联命令 | `openyida batch --commands "cmd1 ; cmd2" [--stop-on-error] [--json]` |
| 检查并更新 OpenYida | `openyida update` |
| 配置 CDN/OSS 上传 | `openyida cdn-config [options]` |
| 上传图片到 CDN | `openyida cdn-upload <image-path>` |
| 刷新 CDN 缓存 | `openyida cdn-refresh [options]` |
| 检测/修复 PostgreSQL Sequence 漂移 | `openyida db-seq-fix [--fix]` |
| 启动 MCP 服务 | `openyida mcp` |
| 启动 A2A adapter 或输出 Agent Card | `openyida a2a <serve\|agent-card> [options]` |
| 启动本地 Web bridge | `openyida bridge start [--token <pair-token>] [--port 6736]` |
| 输出机器可读命令清单 | `openyida commands --json` |
| 静默 CLI 装饰输出 | `openyida --quiet ...` 或 `YIDA_QUIET=1` |
| 禁用更新检查提示 | `OPENYIDA_SKIP_UPDATE_CHECK=1` / `NO_UPDATE_NOTIFIER=1` / `CI=1` |
| 输出完整 Agent 能力诊断 | `openyida agent-capabilities --json` |
| 运行技能评测 | `openyida eval --mode <mode> [--skill <name>] [--runs N]` |

## Agent 能力、评测与安全提示

| 功能 | 执行操作 |
|---|---|
| 快速判断当前工作区、登录态、组织和命令能力 | `openyida agent-capabilities --summary-json` |
| 获取完整 Agent 能力诊断（含完整环境、登录状态与命令 Manifest） | `openyida agent-capabilities --json` |
| 获取完整命令 Manifest、副作用和权限元数据 | `openyida commands --json` |
| 运行无副作用路由评测 | `openyida eval --mode routing [--skill <name>]` |
| 运行文档质量 / 安全 / 覆盖率评测 | `openyida eval --mode <doc-quality\|safety\|coverage\|comprehensive>` |
| 运行真实端到端评测 | `OPENYIDA_E2E=1 openyida eval --mode <e2e\|generate>` |

`commands --json` 中的 `sideEffect` 和 `permission` 是 Agent 执行前的重要依据。`mixed` 命令需要继续查看具体子命令或参数：例如 `data query` 是读操作，`data delete` 是删除；`nav-group list` 是读操作，`nav-group delete` 需要确认。
