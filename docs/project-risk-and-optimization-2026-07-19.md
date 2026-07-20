# OpenYida 项目风险点与优化建议

> 盘点日期：2026-07-19
> 范围：当前 checkout `/Users/fangruiyan/test/openyida`，重点查看 CLI 路由、command manifest、README、功能列表、package 分发配置和现有校验脚本。

## 结论

当前项目的主链路已经比较完整：`openyida commands --json` 可输出 94 个命令、10 个命令分组，README 的 CLI 指令区块由 `scripts/generate-command-docs.js` 从 `lib/core/command-manifest.js` 自动生成，`scripts/validate-command-manifest.js` 也会检查路由、manifest 和 README 的对齐。

主要阻塞风险已在本轮处理到可合入状态：文档分发覆盖、核心错误处理复用、核心语言包体积、可选语言结构补齐、技能路由提示、Jest open-handle 和长技能文档拆分均已有对应实现与校验。当前剩余风险以持续治理项为主，尤其是历史大命令里直接退出的分批迁移、能力文档自动校验和未注册命令取舍。

## P0：需要优先处理

| 风险点 | 现状证据 | 影响 | 建议 |
|---|---|---|---|
| npm 包未包含完整功能列表文档 | `package.json` 的 `files` 白名单原本只包含 `README.md`，未包含 README 链接的 `docs/capabilities.md` | npm 包或包页面上的“完整功能列表”可能无法随包分发 | 已补充 `docs/capabilities.md` 到 `files` 白名单；后续若 README 新增 docs 链接，也要同步白名单 |
| 中文 README 登录说明滞后 | `README_zhCN.md` 仍描述 Chrome/Edge/Chromium CDP 与二维码 handoff | Agent 可能引导用户走旧登录方式，偏离 OAuth token session 主线 | 已改为 OAuth loopback + token session，并强调不要提取 Cookie 或手写 `.cache/cookies.json` |
| 功能列表不是自动校验目标 | `check:docs` 只校验 README 自动生成区块；`docs/capabilities.md` 需要人工维护 | 新增命令后功能列表容易漏项，之前缺少 `auth`、`agent-capabilities`、`asset`、`eval`、`get-form-config`、`integration enable/disable` 的可搜索条目 | 建议新增 `scripts/validate-capabilities-doc.js`，用 command manifest 检查 `docs/capabilities.md` 至少覆盖所有可见命令根或指定例外 |

## P1：近期优化

| 风险点 | 现状证据 | 影响 | 建议 |
|---|---|---|---|
| Action-dependent 命令较多，顶层权限摘要容易被误读 | `commands --json` 统计为 `allow:92, ask:2`，但 `data`、`nav-group`、`i18n`、`app-permission` 等是 `mixed`，内部含 delete/remove 等需要确认的动作 | Agent 如果只看顶层 `mode=allow`，可能跳过子动作判断 | 在 Agent 文档和 SDK 调用侧强制读取 `permission.action_dependent`、`ask_actions`、`ask_patterns`；对 `mixed` 命令不要只看顶层 mode |
| 可复用业务模块的退出方式需要继续收口 | 本轮已新增 `lib/core/command-errors.js`，并继续改造 `app-list`、`list-forms`、`create-app`、`create-page`、`get-schema`、`get-form-config`、`i18n-management`、`corp-manager`、`agent-center` 等高频模块；但 `publish`、connector、bridge、CDN 等历史大命令仍有直接退出点 | 单测、批处理、A2A/MCP 嵌入调用时，未改造模块仍可能直接终止进程 | 后续按命令热度继续迁移：业务层只 throw `CliError` 或普通 `Error`，由 `bin/yida.js` 统一处理退出码 |
| 可选语言翻译质量需要真实用户校准 | `npm run check:i18n` 现在核心语言和可选语言结构均为缺失 0；非中英缺失 key 已用英文兜底补齐，`zh-HK` 用中文补齐 | 结构已完整，但机器/兜底补齐不等于面向目标语种的最终本地化质量 | 维持按需加载机制；当有真实用户使用某语言时，把该语言包放入 `OPENYIDA_LOCALE_DIR` 并做人工/母语校对，再收紧对应翻译质量基线 |
| Jest open-handle 提示已修复，但需防回归 | 根因定位到 `scripts/eval/parallel.js` 中 `spawn` 原生 timeout 与自定义 timeout 叠加，命令不存在路径会导致 Jest 结束后仍有异步资源；另补齐测试 server close await | `npm test` 已在默认并行模式下通过 111 suites / 1303 tests，且无 open-handle/worker 退出提示 | 保留 `eval-parallel` 的单测覆盖；新增会启动 server、child_process 或 timer 的测试时，必须 await 关闭并避免重复 timeout 控制 |
| `check-data` 有实现和测试但没有进入路由/manifest | `lib/core/check-data.js`、`tests/check-data.test.js` 存在，`bin/yida.js` 和 `command-manifest` 未注册 `data check` | 文档和 issue 覆盖中提到数据异常检测，但用户无法通过正式命令发现/调用 | 产品上确认是否保留；若保留，注册 `openyida data check` 或独立 `check-data`，并补 README/skill/locale；若废弃，清理文档引用 |
| README CLI 区块自动生成，但 help 文案复用较粗 | 多个 `create-form` 子命令都使用 `help.cmd_update_form` | README 命令表能覆盖命令，但说明不够区分 patch/rule/validation/bind-datasource/add-option 的具体差异 | 为高频子命令补独立 locale key，降低 Agent 只读命令表时的误解成本 |

## P2：持续治理

| 风险点 | 现状证据 | 影响 | 建议 |
|---|---|---|---|
| 真实环境能力依赖 token、网络和宜搭线上状态 | E2E/eval 需要 `OPENYIDA_E2E=1` 与有效 token session | CI 通过不等于线上资源创建、发布、截图都可用 | 发布前保留轻量真实链路抽检：`login --check-only --json`、`agent-capabilities --summary-json`、目标命令 smoke、必要时截图/Schema 回读 |
| 文档有中英双入口，但完整功能列表目前只有中文 | README 英文也链接 `docs/capabilities.md` | 海外/Global YiDA 用户阅读成本高 | 后续可增加 `docs/capabilities.en.md`，或在现有文档顶部明确它是中文完整清单 |
| 命令数量增长快，技能索引、README、manifest、locale 容易多点漂移 | 当前命令面已有 94 个条目，且 `yida-skills/` 是 Agent 真实路由依据 | 新增能力若只改 CLI，Agent 可能不知道怎么用；只改 skill，CLI 可能不支持 | 新增命令 checklist 固化为 PR 模板：路由、manifest、locale、README 生成、capabilities、skill、测试、`check:commands`、`check:i18n` |
| 单个技能文档仍需持续控长 | `yida-report/SKILL.md` 已从 505 行拆到 272 行，低频 schema 细节迁入 `references/schema-builder-details.md`；`check:skills` 当前不再提示该长文档 | Agent 加载技能时上下文成本仍随新增示例增长 | 新增详细 API、完整 schema 或长示例时默认放 `references/`，主 `SKILL.md` 只保留路由信号、必要步骤和完成标准 |

## 已完成的本次文档优化

| 文件 | 更新内容 |
|---|---|
| `README_zhCN.md` | 登录说明对齐 OAuth token / loopback / token session |
| `README.md` | 项目结构说明去掉过时 QR login 表述 |
| `docs/capabilities.md` | 补齐 `auth`、`agent-capabilities`、`get-form-config`、`integration enable/disable`、`asset`、`eval` 等功能条目，并增加 Agent 能力与安全提示 |
| `package.json` | 将 `docs/capabilities.md` 纳入 npm `files` 白名单 |
| `lib/core/command-errors.js` | 抽出可复用错误处理辅助方法，减少业务模块直接退出 |
| `lib/app/*`、`lib/basic-info/*`、`lib/corp-*/*`、`lib/agent-center/*`、`lib/i18n-management/*`、`lib/formula/*` | 继续收口高频业务模块的 `process.exit`，改为抛 `CliError`/普通错误 |
| `lib/core/i18n.js`、`locales-extra/core/` | 核心包只保留 `zh` / `en`，其他 CLI UI 语言包改为按需加载 |
| `lib/core/locales/en.js`、`locales-extra/core/*.js` | 补齐非中英可选语言包结构缺失；非中英缺失内容先以英文兜底，`zh-HK` 以中文兜底 |
| `yida-skills/SKILL.md`、`yida-skills/skills-index.json` | 增加机器路由提示、负向信号、命令关联和完成标准，降低技能误路由 |
| `yida-skills/skills/yida-report/SKILL.md`、`yida-skills/skills/yida-report/references/schema-builder-details.md` | 拆分长技能文档，主文档保留路由和必要步骤，低频细节迁入参考文档 |
| `scripts/eval/parallel.js`、`tests/utils.test.js`、`tests/token-auth.test.js` | 修复 Jest open-handle：统一 child process timeout 清理，并等待测试 HTTP server 关闭 |
| `tests/package-smoke.test.js` | 校验 npm 包只包含核心语言包，并放宽 `npm pack --dry-run` 超时时间，避免 CI 假失败 |

## 建议校验命令

```bash
npm test
npm run check:commands
npm run check:docs
npm run check:i18n
npm run check:syntax
npm run check:package
npm run build:skills
npm run check:skills
```

如果要验证更完整的工程健康度，再运行：

```bash
npm run check:ci
```
