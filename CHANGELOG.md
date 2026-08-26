# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> **版本规则**：从 v2026.03.19 起，版本号采用日期格式 `vYYYY.MM.DD`，每次发布以当天日期为版本号，Git tag 格式为 `v2026.03.19`，npm 包版本格式为 `2026.03.19`。

## 说明

海外版宜搭暂不适用当前 OAuth token 登录与创建应用链路；如需在海外版宜搭创建应用，请使用 `2026.7.14-2` 以前的版本，例如 `npm install -g openyida@2026.7.13`。

## [Unreleased]

### Changed

- `integration create --process-code` 执行整图替换时必须同时传入 `--replace`；LLM 在确认目标 `appType`、`formUuid`、`processCode` 和替换摘要后执行该命令。已有命令补充 `--replace` 后继续使用。
- Canvas 源码中的非标准运行时能力通过 `window.<name>` 或 `parentWindow.<name>` 访问并检查目标方法；裸 `dd.biz.*` 改为通过 `window.dd` 调用。已发布页面继续运行，重新编译或发布源码时按该写法迁移。

## [2026.8.25-1] - 2026-08-25

### Fixed

- 修复连接器列表分页失效导致的查找失败：`listConnectors` 此前硬编码 `currentPage=1` 且未使用 `total` 判断后续分页，企业连接器数量超过单页上限（默认 100）时，靠列表匹配定位的命令会误报「连接器不存在」。受影响命令为 `connector detail` / `connector add-action` / `connector delete-action` / `connector list-connections` / `connector create-connection`；现改为逐页遍历，触达 100 页上限时抛 `CONNECTOR_LIST_PAGINATION_LIMIT`（鉴权账号列表同理抛 `CONNECTOR_CONNECTION_PAGINATION_LIMIT`），不再基于不完整列表下结论。
- 修复 i18n 棘轮校验长期失效：此前 `CORE_CHECK_LOCALES` 将棘轮限定为仅校验 `en`，10 个可选语言完全跳过，且基线记录的缺失数远高于实际值，使 `current > saved` 永不成立。现所有语言均参与棘轮，并改为记录 `missingKeys` 精确路径比对，防止「补一个 key 同时漏一个新 key」在总数不变时绕过校验；`ar` / `de` / `es` / `fr` / `hi` / `ja` / `ko` / `pt` / `vi` / `zh-HK` 已补齐全部缺失文案（含 `publish.lint_*` 等历史欠账），11 个目标语言包与基准 `zh` 完全对齐。

### Changed

- `openyida aggregate-table`、`openyida report`、`openyida connector` 三个业务域统一改为「本地契约校验 → 一次性远端写 → canonical 回读逐字段比对」：校验不通过抛 `AGGREGATE_DESIGN_CONTRACT_INVALID` / `CONNECTOR_CONTRACT_JSON_INVALID`，回读不一致抛 `AGGREGATE_DESIGN_READBACK_MISMATCH` / `REPORT_SCHEMA_READBACK_MISMATCH` / `CONNECTOR_READBACK_MISMATCH`，聚合表写入额外校验服务端 revision 变化（`AGGREGATE_WRITE_REVISION_MISSING` / `AGGREGATE_WRITE_REVISION_UNCHANGED`），不再仅依赖接口返回码判定成功。
- `openyida connector delete <id> [--force]` 明确为只读指引命令：CLI 仅查询并展示目标连接器，输出平台手工删除入口，不执行删除。因连接器为企业级共享资源，CLI 无法确定性证明其未被表单、页面、流程或集成自动化引用，故不代为执行不可逆删除。README、技能文档与 12 个语言包的命令描述已同步对齐。
- 连接器保存不再向平台 `description` 字段写入操作者 userId（此前会写入 `👤 创建人` / `✏️ 最近修改人`）。已存在该内容的连接器在下次保存时会自动清除，无需手工处理。

### Added

- 新增聚合表、报表与连接器的契约模块（`lib/aggregate-table/contract.js`、`lib/report/contract.js`、`lib/connector/contract.js`）及配套真实环境 E2E 校验资产；`lib/core/yida-client.js` 新增受 one-shot 鉴权约束的 `postJsonOnce` 写通道。

## [2026.8.25] - 2026-08-25

### Changed

- `openyida save-permission` 目标权限包匹配改为 fail-closed：未命中抛 `SAVE_PERMISSION_NO_MATCHING_PACKAGE`、多义抛 `SAVE_PERMISSION_AMBIGUOUS_PACKAGE`、查询结果触达分页上限抛 `SAVE_PERMISSION_QUERY_LIMIT_REACHED`，避免误写到非预期角色；`--members` 仅增删 `PERSONS`，保留原有 `DEPARTMENT`/`ROLE`/`PARAM`/`MANAGER` 配置，压扁复合成员结构必须显式 `--confirm-member-replace`。
- `openyida get-permission` 返回结果新增 `roleData`（含 `include` 明细）与 `query` 元信息（`pageSize`/`returned`/`mayHaveMore`），便于确认是否存在未返回的权限包。
- `openyida save-share-config`、`openyida app-permission`、`openyida corp-manager` 全部改为「写前读 + 写后回读逐字段比对」，校验不通过时抛出对应 `*_VERIFY_FAILED` 错误，不再仅依赖接口返回码判定成功。
- `openyida integration-create` 调整执行顺序为「本地校验与构建全部通过后才发起首次远端写」，并对节点类型、赋值、审批动作、连接器模式、`${alias}` 引用做白名单强校验；发布失败时返回 `success:false / savedAsDraft:true` 并抛 `INTEGRATION_PUBLISH_FAILED`，不再静默当作成功。
- `openyida configure-process` 先用占位 processCode 完成本地编译，编译失败即抛 `CONFIGURE_PROCESS_BUILD_FAILED` 且零远端写入；流程编译器对路由目标缺失、节点重名、审批人缺失改为 fail-closed 报错（`PROCESS_COMPILE_ROUTE_TARGET_INVALID` / `PROCESS_COMPILE_NODE_NAME_DUPLICATE` / `PROCESS_COMPILE_APPROVER_REQUIRED`）。

### Added

- 新增流程、集成自动化与表单权限的契约测评与真实环境 E2E 校验资产（`scripts/eval/integration-contract/`、`scripts/eval/process-contract/`、`scripts/e2e-real/process/`、`scripts/e2e-real/permission/`），用于在改动上述模块后回归编译产物与平台回读一致性。

## [2026.8.20] - 2026-08-20

### Added

- `openyida save-permission` 支持复杂 `dataPermit` 规则透传与权限矩阵成员配置，可在保留原始权限表达能力的同时批量生成成员维度的数据权限。
- `save-permission --all-members` 新增全员可见全部数据快捷配置，并同步表单权限技能文档中的权限矩阵与全员数据可见说明。

### Fixed

- 流程表单数据提交改用 `startInstance` 链路，避免通过通用数据更新路径发起流程实例时出现提交语义不一致。

## [2026.8.19-2] - 2026-08-19

### Fixed

- 修正 `2026.8.19-1`（#497）引入的 env token 不落盘语义：`OPENYIDA_AUTH_MODE=token` 现在按 **env token bootstrap** 处理，refresh 结果写入项目级 token 缓存（文件权限 0600，原子写入）并优先复用，避免每次命令重复 refresh；也避免 refresh token 轮换场景下新凭证丢失导致后续认证失败。落盘隔离在项目作用域，不污染用户级共享登录档案。
- refresh-only 的 env token 现在正确上报 `ok` / `can_auto_use=true`。

### Changed

- 保留“不回退 OAuth”保障：env token 模式下 `openyida login` 仍返回 noop 结果（凭证可用→`ok=true`；缺凭证→明确提示请运行环境注入 token），两者均不弹浏览器。
- 移除 CLI 对 `YIDA_AUTH_ENABLED` 的依赖，判定统一为 `OPENYIDA_AUTH_MODE=token`；`agent-capabilities` 将 `host_injected_token_mode` / `host_token_env_detected` / `env_token_present` 等重叠字段收敛为单一 env token 语义，`auth_runtime` 新增 `env_token_bootstrap`，`missing_token_action` 统一为 `STOP_AND_REQUEST_ENV_TOKEN`（受影响环境：yida-agent 云端等运行环境注入 token 场景；本地 OAuth 与三端浏览器拉起路径不变）。

## [2026.8.19-1] - 2026-08-19

### Fixed

- 修正云端宿主注入 token 的识别：`OPENYIDA_AUTH_MODE=token` 且存在 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN` 时，即使未设置 `YIDA_AUTH_ENABLED` 也识别为宿主注入登录态，不再回退到 OAuth 浏览器登录（修正 yida-agent 等无浏览器云端环境下 refresh-token 会误触发 OAuth 的问题）。
- `openyida login` 在宿主注入模式下短路返回 `login_action=noop`：凭证可用时直接报 `ok=true`，缺 token 时给出“请宿主注入 token”的明确提示，两者均不弹浏览器。

### Changed

- host-injected 登录判定收敛为单一事实源：`agent-capabilities` 与 `core/utils` 统一复用 `token-store` 的 `isHostInjectedTokenMode`，CLI 层的 `isEnvAuthMode()` 分支下沉至 `tokenLogin`，消除多处判定漂移（受影响环境：yida-agent 云端等宿主注入 token 场景，本地 OAuth 与三端浏览器拉起路径不变）。

## [2026.8.19] - 2026-08-19

### Added
- `openyida update-app` 新增 `--hide-app-nav` / `--show-app-nav` 及兼容别名，用于自定义页面自绘顶部导航或侧边导航壳时显式隐藏或恢复访问态应用导航。

### Changed
- 自定义页面、完整应用设计和导航壳技能规则统一为默认保留平台应用导航，仅在用户明确要求自定义页侧边导航、顶部导航、导航壳或全屏无导航时才开启隐藏应用导航。
- 同步命令 manifest、README 命令表和能力清单中的 `update-app` 导航隐藏参数，并补齐 `nav-group auto-order` 能力清单说明。

### Fixed
- `hideAppNav` 默认不写入更新应用请求，避免普通应用或未明确导航诉求的自定义页面被误隐藏应用导航。
## [2026.8.17-3] - 2026-08-17

### Added

- auth profile 管理 UX：新增 `openyida auth profiles` 列出共享登录档案、`openyida auth profile switch <profile|corpId>` 非破坏性切换当前项目指针；auth status / agent-capabilities 新增 `profile_required` 候选与 `next_step` 提示。

### Changed

- logout 语义拆分：默认 `openyida auth logout` 只解绑当前项目指针 / legacy token，保留共享用户档案；`--profile <id>` 删单个档案，`--all` 删全部。
- 移除已废弃的 cookie authRef 兼容分支：`createAuthRef` 仅接受 token 登录态，HTTP helper 不再构造 `Cookie` / `global_csrf_token` header，legacy cookie 数组参数被忽略并继续走 Bearer token；与 `agent-capabilities` 的 `cookie_auth_supported:false` 声明对齐。（无破坏性变更：删除的是已声明不支持的 cookie 登录回退路径，OAuth token / host-injected token 路径不受影响。）

## [2026.8.17-2] - 2026-08-17

### Changed

- 强化 `caller_open_url` 登录模式的 Agent 行为契约：web sandbox 下 `openyida login --no-browser` 后，Agent 必须优先调用宿主沙箱浏览器 / 内置 Browser 打开 CLI 输出的授权 URL，只有无浏览器工具或调用失败时才回退让用户手动打开；`agent-capabilities` 快照新增 `url_source` / `manual_user_open_fallback` / `must_not_only_print_url_when_agent_browser_available` 字段，并同步 yida-login 与环境准备技能文档（受影响平台：QwenWork web sandbox 等 agent browser 环境）。

## [2026.8.17-1] - 2026-08-17

### Added

- 新增 `openyida check-prd-completeness`：对照 PRD 与应用实际资源的交付风险雷达（只读命令，输出结构化 JSON）。
- 用户级 auth profile store：优先用户级登录档案，保留项目级缓存兼容；宿主注入 token 仍为最高优先且不持久化。
- `agent-capabilities --summary-json` 暴露登录/浏览器能力提示与项目根/技能目录来源说明。

### Changed

- 发布健康检查改为基于 token 鉴权的 schema 回读比对（指纹校验 Canvas runtimeCode / native compiled），取代已失效的 Cookie + HTML 检查。
- 稳定 QwenWork / Mule / Qoder 工作区识别，避免 `work` 与 `work/project` 漂移。
- Release notes 技能包文案改为通用表述。

### Fixed

- 修正 #489 带入的 `package.json` 版本回退（`2026.8.16-beta.1` → `2026.8.17-1`），使仓库版本重新高于已发布的 latest。

## [2026.8.17] - 2026-08-17

### Added
- 新增 2026.8.11 到 2026.8.14 的版本改造对比报告，补充技能体积、文档结构和性能影响分析。

### Changed
- 自定义页面默认开发链路收拢到 `yida-canvas-custom-page` 与 `YidaCodeCanvas`，`yida-custom-page` 聚焦历史 `.oyd.jsx` / `.oyb.jsx` / `renderJsx` / 平台 `Jsx` 页面维护。
- 更新 `yida-app`、技能路由、评测场景和覆盖矩阵，清理普通自定义页面与 Code Canvas 双链路选择提示，减少弱模型误选。
- 调整自定义页面编译与发布说明，将历史 JSX 编译维护口径归入 `yida-custom-page`，新建自定义页面继续使用 YidaCodeCanvas 组件实现。
- 新建应用链路默认携带 Builder AI / OpenYida 创建标识，由 CLI 调用接口时自动传入，不再暴露给用户手动填写。
- 更新现代版主题接口相关技能说明与示例，统一主题运行时、注入和页面设计侧的调用口径。

### Fixed
- 修正 `renderJsx`、`didMount`、`this.utils.yida`、`this.dataSourceMap` 等平台 JSX 组件能力的描述边界，避免误判为普通新建页面链路。
- 收窄 `skills-index.json` 和跨技能引用改动范围，保留必要技能指向，同时避免其他技能过度依赖 `yida-custom-page`。
- 恢复并明确附件上传、图片上传、成员和部门等能力不属于历史 JSX 特性，避免自定义页面能力说明被误删或错误归类。
- 优化 `yida-publish-page` 严禁事项与发布边界，保留具体约束，避免发布阶段提示过度抽象。

### Tests
- 更新技能契约、路由测评、`get-schema` 和 CLI smoke 测试，覆盖自定义页面路由收拢、历史 JSX 维护边界和 Builder AI 创建标识。
- 重新构建并校验技能发布包，确认源码态与悟空发布态的技能索引、子技能引用和路由说明一致。

## [2026.8.16-beta.1] - 2026-08-17

### Changed
- auth profile、project pointer、business context、host-injected token 与 `agent-capabilities` 状态输出保留非密钥组织名字段 `corp_name`，便于多组织账号在新会话中识别候选组织。
- `org list` / `org switch --json` 复用统一组织名解析；登录身份匹配仍以 `corpId` / `userId` / `baseUrl` / `clientId` 为准，`corp_name` 不参与 profile key。

### Tests
- 补充 auth profile 候选列表脱敏、组织名别名归一化、env token 组织名、自动刷新后 authRef 组织名透传等回归测试。

## [2026.8.16-beta.0] - 2026-08-16

### Added
- 新增用户级 auth profile 存储，OAuth 登录优先写入稳定用户目录，project cache 仅保存非密钥指针；用户目录不可写时显式降级到 project legacy 并报告持久化范围。
- `agent-capabilities --summary-json` 补充 runtime、project root、skills 目录、auth store 与 interactive login 策略，减少 Agent 反复扫描工作区和登录态目录。
- 新增 `check-prd-completeness` 命令，用 build manifest 与远端资源列表做 PRD 交付数量风险检查。

### Changed
- 优化千问办公本地版/网页版、MuleRun 继承环境、Qoder/QoderWork 等运行时识别；千问办公强信号优先于 MULE/QODER 兼容变量。
- 登录浏览器归属改为由能力摘要指导：桌面环境默认 CLI 打开系统浏览器，Web sandbox 使用 `--no-browser` 由 Agent 打开授权 URL；Playwright 仅作为可选兜底，不默认安装。
- `publish --health-check` 改为发布后读取远端 Schema 并校验发布内容指纹，替代依赖页面 HTML/cookie 的健康检查。

### Fixed
- 修复 `--no-browser --quiet` 与 `OPENYIDA_NO_BROWSER=1 ... --quiet` 下授权 URL 不输出的问题；授权 URL 始终写入 stderr，避免污染 stdout JSON。
- 修复用户级 auth profile 写入成功但 project pointer 不可写时被误判为登录态不可持久化的问题。

### Tests
- 新增/更新 OAuth loopback、agent capabilities、project root/skills、auth profile、publish readback、PRD completeness 与 CLI smoke 回归测试。
- 已用 Codex 和 Qoder 本地 Agent 跑通真实搭建验证；千问办公本地版完成环境识别验证。

## [2026.8.14] - 2026-08-14

### Added
- `openyida login` 与 `openyida auth login` 新增 `--no-browser` 参数，供明确需要由调用方接管授权链接的 Agent 或无头环境使用；默认行为保持由 CLI 自动打开系统浏览器。

### Changed
- 在 Agent capabilities 中公开交互登录的浏览器归属、抑制参数和完成信号，指导 Agent 等待原登录命令退出及最终 JSON，避免重复打开授权页。
- 更新 `yida-login` 技能与环境参考文档，禁止默认流程中后台提取 URL、再次执行 `open`、固定 `sleep` 或重复轮询 `login --check-only`。
- 登录等待阶段补充 OAuth 超时和取消提示，降低用户延迟登录或关闭浏览器时的无反馈感。
- 重构 OpenYida 主入口技能说明，保留搭应用开发总入口、资源上下文、意图识别、技能路由表和必须遵守规则，去掉冗余子技能长列表与重复说明。
- 将 `yida-app` 拆成 9 个 workflow 阶段文件，完整应用搭建、已有应用无页面、已有资源补齐等场景统一由 `yida-app` 编排。
- 收拢存储约定、临时文件规范、命令输入文件规则和 FAQ 处理思路，减少主入口、共享 reference 与子技能之间的重复描述。
- 优化 `yida-publish-page` 与 `yida-flash-note-to-prd` 描述，明确发布目标确认、真实发布证据、闪记/会议内容转 PRD 和交给 `yida-app` 的边界。

### Fixed
- 删除过时的 `development-rules.md` 与 `app-build-contract.md` 参考文档，将仍有效的规则迁移到主入口、`yida-app` workflow 或常见问题文件。
- 移除主入口中针对 Wukong 的定制化描述，保留 Codex / yida-agent 使用 OpenYida auth snapshot 的通用约束。

### Tests
- 新增浏览器归属、`--no-browser`、Agent capabilities 与登录技能编排契约测试。
- 更新技能契约、路由卫生和技能包构建测试，覆盖主入口路由、`yida-app` workflow、冗余 reference 清理和发布证据约束。

## [2026.8.12-1] - 2026-08-12

### Changed
- 调整 `yida-design` 与 `yida-canvas-custom-page` 的页面丰富度说明，将区块数量改为“推荐 8-10 个区块以上”的建议口径，并保留窄场景可精简的说明。
- 收敛完整应用与技能入口文档，减少重复路由提示，强化按 PRD 与设计契约推进页面实现的边界。
- 更新 README 贡献者展示内容。

### Fixed
- 移除 Code Canvas 编译和页面 linter 中的内容区块数量硬校验，避免少于指定区块数时阻塞 `check-page`、`compile` 或 `publish`。
## [2026.8.12] - 2026-08-12

### Changed
- 更新 README 与 CLI 帮助中的 OpenYida 帮助网站入口，统一指向新的 `demo.aliwork.com` helpCenter 路由，并补齐完整功能列表、CLI Reference、案例展示和更新日志等快捷链接。
- 在自定义页面文档中补充“AI 自定义页面支持的宜搭原生组件”支持清单入口，便于查看 Code Canvas 可用的成员、部门、上传等原生组件能力。
- 优化 `yida-design` 设计风格选择与 registry 说明，强化风格适用场景、选择边界和弱模型路由提示。

### Fixed
- 修复 `nav-group auto-order` 未纳入命令 manifest 权限契约的问题，避免导航自动排序被误判为未知动作并触发额外权限确认。

### Tests
- 新增 CLI smoke 回归断言，覆盖 `nav-group auto-order` 的 manifest 权限分类，确保自动排序为预授权动作且删除动作仍需确认。

## [2026.8.11] - 2026-08-11

### Added
- 新增应用生命周期管理命令与 `yida-app-lifecycle` 技能，支持查询、启用和停用已有宜搭应用，并同步中英文文档、命令清单、技能索引和多语言文案。
- 新增 OpenYida 技能自适应治理方案与执行计划文档，沉淀技能路由、压缩、评测和治理演进路径。

### Changed
- 优化 `get-schema` 展示页返回信息，补充页面 Schema 摘要信号，便于发布后快速判断页面类型、核心组件和运行时代码状态。
- 更新 `yida-design` 资源工作流与技能索引说明，进一步收拢应用构建与设计阶段的路由提示。

### Fixed
- 修正技能路由与测试中的本地化断言边界，降低不同语言环境下的误报。

### Tests
- 新增应用生命周期命令、CLI smoke、技能契约和技能覆盖矩阵测试。
- 扩展 `get-schema` 单元测试，覆盖展示页 Schema 摘要解析与输出。

## [2026.8.5] - 2026-08-05

### Added
- 新增 `yida-design` 统一设计技能，沉淀 PRD、设计稿、页面视觉、主题令牌、质量门禁和应用蓝图等分阶段交付工作流。
- 新增多套页面风格模板与视觉决策参考，覆盖工作台、看板、列表、筛选目录、进度分析、深色大屏等典型业务页面。
- 新增表单详情页增强链路，支持详情样式注入、主题动作、实例打开校验和详情链接校验，提升表单详情入口的稳定性与可控性。
- 新增技能优化指南与检查脚本，提供评估、重构、改写和验证的标准流程。

### Changed
- 将 `yida-page-uiux`、`yida-app-uiux`、`yida-theme` 等分散页面设计能力收拢到 `yida-design`，同步更新技能索引、路由规则、应用构建契约和评测场景。
- 重构 Code Canvas / 自定义页面作者指导，补充主题运行时辅助、样式实现指南、组件库、导航入口、数据桥接和页面生成规范。
- 收缩旧版生成页与示例体系，清理历史 demo PRD、离线缓存、旧 OYD 示例和过期素材，降低发布包噪音。
- 优化表单创建、Canvas 编译、页面 lint、sample 输出和 agent 能力识别等基础链路，增强生成结果的一致性。

### Fixed
- 修复表单详情实例相关入口与样式注入边界问题，避免无效链接、错误打开方式或样式覆盖导致的体验异常。
- 收拢移动端颜色、页面背景、图文丰富度和样式主题规则，减少生成页面在不同端上的视觉漂移。
- 修正文案与输出约束，强化 emoji、样例信息和文件干扰等生成规范。

### Tests
- 新增或更新 `form-detail-style`、`canvas-compile`、`create-form`、`sample`、`page-linter`、`skill-contracts`、`eval-routing` 和设计 PRD 质量相关测试。
- 同步更新路由测评、技能覆盖矩阵和构建包测试，覆盖新的 `yida-design` 编排与技能发布态契约。

## [2026.8.4] - 2026-08-04

### Fixed
- 千问办公登录优化。


## [2026.8.3] - 2026-08-03

### Added
- 新增 `yida-nav-group` 导航编排能力，支持创建导航分组、设置父子关系、自动排序和入口页优先展示，便于完整应用生成后整理应用导航。
- 新增 `yida-app` UI 引导参考文档，补充应用生成模式、主页面引导、业务入口和验收契约，明确完整应用主页面默认包含轻量 UI 引导。
- 新增 `yida-theme` 主题令牌预设参考，沉淀业务场景色、导航主题和页面主题应用规则。
- 新增千问办公等 AI 工具环境识别，完善 OpenYida 在不同 AI 编程工具中的环境适配。

### Changed
- 优化技能索引与路由描述，收口应用创建、页面 UIUX、Code Canvas、主题、导航和发布等子技能边界，减少技能误选和重复读取。
- 应用创建默认主题色改为 `podBlue`/`podGreen` 等新版主题色，并将创建成功后的默认入口从管理后台调整为应用工作台。
- 自定义页面创建新增隐藏平台导航参数，显式支持 `--hide-nav` / `--no-nav` / `--render-nav` 等导航展示控制。
- 页面生成输出补充主题来源、主题色、导航主题和颜色模式等元信息，让生成结果的视觉决策更可追踪。
- `generate-page`、`page-ir` 与页面 UIUX 文档强化主页面、门户、工作台、导航结构和主题决策规则，避免把样例页面直接当成完整信息架构。

### Fixed
- 修复 AI 能力、环境检测、Doctor、bridge handoff、postinstall 注入和命令清单中的品牌与环境描述漂移。
- 调整 `publish`、`canvas-compile`、复制和更新应用相关校验，提升 Code Canvas / 自定义页面发布链路在边界参数下的稳定性。

### Tests
- 新增或扩展 `nav-group`、`create-page`、`generate-page`、`page-ir`、`publish`、`canvas-compile`、`skill-contracts`、`utils`、`env`、`doctor`、`bridge` 等测试，覆盖导航排序、隐藏平台导航、主题元信息、技能契约和发布参数。
- 同步更新路由测评、技能覆盖矩阵和构建包测试，校验新增导航、主题和 UI 引导契约。


## [2026.7.27-beta.1] - 2026-07-27

### Added
- 新增 `openyida read-dingtalk-doc <docUrl> [--output <file>] [--json]`，通过当前 OAuth token 登录态读取钉钉在线文档并返回 Markdown，支持原文输出、JSON 输出和文件落盘。
- 新增 `openyida read-dingtalk-tingji <taskUuid> [--json]`，按听记任务 ID 读取钉钉听记详情。
- 新增 `yida-document-markdown` 与 `yida-tingji` 两个 Agent skill，并同步技能索引、命令清单、中英文文档及可选语言包。

### Changed
- HTTP GET 请求工具支持显式读取文本响应，以兼容文档 Markdown 接口。
- 文档读取命令自动识别并解包 tianshu 返回的 JSON 文本响应，同时保留对直接 Markdown 和 JSON 形态文档正文的兼容。

### Tests
- 新增文档与听记 CLI 单元测试，覆盖接口路径和参数、文档 URL 与听记 ID 校验、Markdown 响应解包、失败响应及听记结构解析。
- 使用真实钉钉文档链接与听记任务 ID 完成接口联调，两个只读命令均返回 HTTP 200 和有效内容。


## [2026.7.19] - 2026-07-20

### Highlights
- Skill 评测体系扩展：新增多维评测、并行执行、覆盖率、Junit 报告、历史记录、dashboard 控制台和 Skill-as-Evaluator，提升技能发布前的质量判断能力。
- CLI 语言包从「全量内置」调整为「核心中英内置 + 非中英按需加载」，降低 npm 默认包体积，同时保留小语种扩展能力。
- 继续收口高频业务模块的错误退出方式，减少可复用模块内直接 `process.exit(...)` 对测试、批处理、MCP/A2A 嵌入调用的影响。
- 优化 OpenYida 技能路由与技能文档结构，补充机器可读路由提示，并拆分过长的报表技能文档，降低 Agent 加载成本。

### Added
- 新增 `yida-skill-evaluator` 等技能与参考文档，补齐应用 UIUX、数据绑定、主题和测评工作流。
- 新增可选 CLI 语言包目录 `locales-extra/core/`，用于存放 `zh-HK`、`ja`、`ko`、`fr`、`de`、`es`、`pt`、`ar`、`hi`、`vi` 等非核心语言包；可通过 `OPENYIDA_LOCALE_DIR` 指向外部语言包目录按需启用。
- 新增 `lib/core/command-errors.js`，提供 `CliError`/usage/error 抛错辅助方法，供可复用业务模块统一错误处理。
- 新增 `docs/project-risk-and-optimization-2026-07-19.md`，记录当前项目风险点、已完成优化和后续治理建议。
- 新增 `yida-skills/skills/yida-report/references/schema-builder-details.md`，承载报表 Schema 构建细节、组件示例和低频参考内容。

### Changed
- CLI 发布包默认只内置核心界面语言 `zh` / `en`，降低默认安装体积；其他 CLI UI 语言包不随 npm 包默认分发，运行时按 `OPENYIDA_LANG` + `OPENYIDA_LOCALE_DIR` 加载。
- 国际化运行时回退链路调整为「目标语言 -> en -> zh」；非中英可选语言包已补齐结构缺失，便于真实用户使用某语种时单独校对和分发。
- `app-list`、`list-forms`、`create-app`、`create-page`、`get-schema`、`get-form-config`、`i18n-management`、`corp-manager`、`agent-center`、`formula` 等高频业务模块改为抛错交由 CLI 入口统一处理，减少业务层直接退出。
- `yida-skills/skills-index.json` 补充 `positive_signals`、`negative_signals`、`command_ids`、`done_when` 等自动匹配字段，降低表单结构、数据管理、Canvas 页面和 UIUX 等高混淆技能的误选概率。
- `yida-skills/SKILL.md` 同步补充技能索引读取策略和路由提示，要求先用索引快速判断，再按需读取单个子技能文档。
- `yida-report/SKILL.md` 从长文档拆为主流程文档 + `references/schema-builder-details.md`，主文档保留路由信号、必要步骤和完成标准。
- `README.md`、`README_zhCN.md`、`docs/capabilities.md` 补充 CLI 语言包按需加载说明，并对齐当前 OAuth token 登录和功能清单说明。

### Removed
- 清理旧的 demo 源码、构建产物和演示 CSV 数据，减少发布包中的历史示例噪音。
- 移除旧 `docs/custom-page-solutions.md`，相关说明已迁移到 README、能力清单与各技能参考文档。
- 从默认 npm 发布内容中移除非中英 CLI UI 语言包，保留在源码态 `locales-extra/core/` 作为可选语言包。

### Fixed
- 修复 Jest 全量测试结束后的 open-handle / worker 未优雅退出提示：`scripts/eval/parallel.js` 统一 child process timeout 清理，避免 spawn 原生 timeout 与自定义 timeout 叠加。
- 修复 `tests/utils.test.js`、`tests/token-auth.test.js` 中本地 HTTP server 未等待 `close` 完成的问题，避免测试资源释放滞后。
- 补齐 `en` 顶层历史 key 和非中英可选语言包结构缺失，`npm run check:i18n` 中核心语言与可选语言均达到缺失 0。
- `npm pack --dry-run` 的 package smoke 测试增加核心语言包、能力文档和可选语言包排除校验，并放宽超时时间，减少 CI 假失败。

### Tests
- 新增或扩展 asset、safe-json、generate-page、page-ir、page-linter、canvas-compile、create-form、CLI smoke、package smoke、i18n、skill contract 和 eval 系列测试。
- 新增 Skill eval CI workflow、命令文档校验、i18n 棘轮校验和发布包体积校验适配，覆盖本次 UI 生成与技能评测链路。
- 补充业务模块抛错、可选语言加载、技能索引自动匹配字段、长技能文档校验、package smoke 和 Jest open-handle 相关回归测试。
- 验证 `npm test` 默认并行模式下 111 个 suite / 1303 个用例全绿，且不再出现 Jest open-handle 或 worker 退出提示。

## [2026.7.18-2] - 2026-07-19

### Changed
- 优化 `openyida login` 与 `openyida bridge` 的浏览器登录体验：新增跨平台默认浏览器检测。

### Tests
- `tests/oauth-loopback.test.js`：新增默认浏览器检测（依赖可注入）、三平台新窗口命令、未知/不支持浏览器回退等用例，共 20 个用例。
- 新增 `tests/check-release-risks.test.js`：覆盖 HARD 反模式命中、注释/字符串误判排除，以及「当前 `lib/` 源码零 HARD 反模式」的仓库守卫。
- `tests/check-release-risks.test.js`：补充普通业务枚举值 `open` 不触发 soft warning 的回归用例。
- `tests/process-small.test.js`：补充流程预览三端打开命令与路径 argv 传递用例。
- `npm run check:structure`：新增锁文件版本一致性校验。


## [2026.7.18-1] - 2026-07-18

### Fixed
- 修复 Windows 下 `openyida login` 无法登录的问题：拉起浏览器时改用 `rundll32 url.dll,FileProtocolHandler`，不再经过 `cmd /c start`。此前 cmd.exe 会把 OAuth URL 中的 `&` 当作命令分隔符，导致 URL 在第一个 `&` 处被截断，`client_id`、`response_type`、`scope`、`state` 全部丢失，钉钉登录页报「参数无效：clientId is blank」。macOS/Linux 不受影响，因此该问题仅在 Windows 用户侧出现。
- 同步修复 `openyida bridge` 页面唤起在 Windows 下的相同缺陷：bridge 页面 URL 通过 hash 片段携带的 `oy_bridge_url`、`oy_bridge_token` 参数会被 `cmd /c start` 在 `&` 处截断，导致 bridge 配对回连信息丢失、配对失败。现与登录链路复用同一套浏览器拉起逻辑（`resolveBrowserLauncher`），行为统一。


## [2026.7.18] - 2026-07-18

### Highlights

- 自定义页面与应用生成继续强化双链路能力：默认使用 Code Canvas `.canvas.jsx` 生成与发布，只有在页面明确依赖普通自定义页面实例桥时才走 `.oyd.jsx` / native JSX。
- 自定义页面补充门户类组件与宜搭运行态组件支持，覆盖门户导航、成员/部门选择、附件上传和图片上传等常见业务门户场景。
- 页面生成链路从模板输出升级为「UIUX 决策 + 页面 IR + 主题 profile + 素材状态」的产品化流程，提升 AI 一次生成工作台、看板、列表、详情页和官网落地页的稳定性。
- 表单创建能力增强，支持更丰富的布局组件、主题配置、字段属性、规则和增量更新，便于生成更接近真实业务的表单结构。
- ![表单支持分割线示例1](https://img.alicdn.com/imgextra/i2/O1CN01b66Noa1OpqFXJ42ZN_!!6000000001755-0-tps-3024-1370.jpg)

### Added
- `openyida generate-page` 新增多套 Code Canvas 页面模板，覆盖官网/落地页、数据大屏、驾驶舱、工作台、业务列表、详情页、分栏详情、门户壳、待办清单，以及成员/部门/上传组件验证场景。
- 新增 `openyida asset` 素材命令，支持素材能力检测、图片 URL 校验、素材解析回填、CDN 转存/镜像和素材来源引导，帮助官网/落地页生成前确认素材可用性。
- 自定义页面新增门户组件、门户导航壳、成员、部门、附件上传、图片上传等宜搭运行态组件的 Code Canvas 桥接文档与模板，并补充 native JSX 链路下的组件使用指引。
- 新增自定义页面支持宜搭组件（JSX 与 Canvas）示意截图，展示门户、成员/部门、上传、导航壳等组件在双链路下的效果；示例页面见下：

  - ![自定义页面截图1](https://img.alicdn.com/imgextra/i2/O1CN01ivyoA01VoC8RsfVkJ_!!6000000002699-2-tps-3840-4798.png)
  - ![自定义页面截图2](https://img.alicdn.com/imgextra/i1/O1CN01ykxr161F2X4A4GkuC_!!6000000000429-2-tps-3840-2320.png)
  - ![自定义页面截图3](https://img.alicdn.com/imgextra/i1/O1CN01PPLkQV1f8eMmITj52_!!6000000003962-2-tps-3840-2506.png)
  - ![自定义页面截图7](https://img.alicdn.com/imgextra/i2/O1CN016lbFwu1zNZaMLnCwG_!!6000000006702-2-tps-3840-1916.png)
  - ![自定义页面截图8](https://img.alicdn.com/imgextra/i1/O1CN01b6oO2u1gSdGJeC9Cy_!!6000000004141-2-tps-3840-2256.png)
  - ![自定义页面截图10](https://img.alicdn.com/imgextra/i1/O1CN01fxmCH81xG7uq7hfjU_!!6000000006415-2-tps-3840-4316.png)
  - ![自定义页面截图11](https://img.alicdn.com/imgextra/i1/O1CN01gyslBU1WkMR4Pcw4k_!!6000000002826-0-tps-3840-1916.jpg)
- 新增 `yida-app-uiux`、`yida-canvas-data-binding`、`yida-theme` 等子技能，并扩展 `yida-page-uiux` 的多页面应用蓝图、导航、主题、素材和场景化页面设计参考。
- 新增中文版 README 与多份设计、发布和 Code Canvas 能力规划文档，补充当前能力清单与开发规则说明。


### Changed
- 优化 yida-skills 技能树与路由描述，明确完整应用、页面 UIUX、Code Canvas、native JSX、数据绑定、主题和发布等子技能的协作边界。
- 自定义页面主链路调整为先做 UIUX 视觉方向决策，再默认使用 Code Canvas 生成与发布；仅在页面强依赖 `this.$(...)`、`this.utils.yida.*`、`dataSourceMap` 等原生实例桥时使用 native JSX 链路。
- `create-form` 拆分为参数解析、字段定义读取、Schema 构建、补丁、规则、校验和数据源绑定模块，增强表单布局、主题、分组组件和增量更新能力。
- `generate-page` 引入页面 IR、主题 profile/scope、素材状态、模板推断和本地 Canvas 编译输出，提升 AI 从需求到页面源码的一次生成稳定性。
- CLI 入口、命令清单、首次复制、脚本校验和 npm 包体积规则同步适配新增的 asset、Canvas、表单与技能包内容。
- Code Canvas 编译、发布、页面 lint、示例模板和技能路由持续优化，增强数据接口、导航壳、门户组件和运行态组件的一致性。
- 打磨 native 自定义页面控件视觉：统一输入框 hover / focus 态，修复下拉浅色选中态与控件焦点样式，减少默认蓝色描边干扰。
- 对齐并美化「数据管理」场景的 native 与 Code Canvas 示例（设备台账 / 多维表风格），同步优化图表、密度切换和官网 / 落地页等自定义页面样例，详见 [`docs/demo-page-samples.md`](docs/demo-page-samples.md)。

### Removed
- 移除旧的 `docs/custom-page-solutions.md`，相关页面链路和组件使用说明已迁移到 README、能力清单和 yida-skills。

### Tests
- 新增或扩展 asset、safe-json、generate-page、page-ir、page-linter、canvas-compile、create-form、CLI smoke、package smoke 和 skill contract 测试，覆盖本次页面生成、素材、表单和命令路由调整。

## [2026.7.17-3] - 2026-07-17

### Fixed
- refresh token 换取新 access token 时，如果服务端未返回业务 `base_url`，继续保留本地 token session 中已有的业务域名，避免刷新后业务请求错误落到认证 endpoint。

## [2026.7.17-2] - 2026-07-17

### Fixed
- 业务请求遇到 access token 失效时，自动使用本地 refresh token 刷新 access token 并重试原请求；仅 refresh token 也失效时才提示重新 OAuth 登录。
- refresh token 换取新 access token 时使用当前环境的认证 endpoint，并保留服务端返回的业务 `base_url` 写入本地 token session。
- 移除 CLI 业务请求中显式拼接 `_csrf_token` 的逻辑，运行态只向宜搭服务端传递 `Authorization: Bearer <access_token>`。

## [2026.7.14-2] - 2026-07-14

### Highlights
- 登录鉴权从本地 Cookie / 二维码模式切换为钉钉 OAuth loopback + 宜搭 CLI token 模式，后续业务请求统一通过 `Authorization: Bearer <access_token>` 进入宜搭服务端鉴权。
- 本版本面向国内 `aliwork.com` 链路；海外版宜搭暂无法通过新的 OAuth token 方式登录。需要继续使用海外版宜搭的用户，请安装低于 `2026.7.14-2` 的版本，例如 `npm install -g openyida@2026.7.13`。

### Changed
- `openyida login`、`openyida auth` 默认进入 token 登录态管理，不再要求 CLI 感知或保存 `ai_app_user_auth_token`、`tianshu_csrf_token` 等 Web Cookie。
- 所有宜搭 HTTP API 调用统一从本地 token session 读取 `base_url` 和 access token，并由请求层自动封装 Bearer 鉴权头。
- `openyida org list` 改为通过 token 请求 `/query/userservice/listCorpInfos.json` 获取可访问组织；`openyida org switch --corp-id <corpId>` 通过 OAuth 重新登录并校验目标组织。
- MCP Server、批处理、环境诊断、技能文档和命令清单同步使用 token 登录态语义。

### Removed
- 移除旧 Cookie 登录、二维码登录、Codex 浏览器登录和相关 Cookie 缓存链路，降低本地明文 Cookie 持久化风险。

### Tests
- 更新 CLI、请求层、登录态、MCP、环境诊断和各业务命令的离线测试，覆盖 token session 读取、刷新、登出、组织列表和 Bearer 请求封装。

## [2026.7.8] - 2026-07-08

### Added
- `openyida publish` 支持 Code Canvas 自定义页面发布：`.canvas.jsx` / `.canvas.tsx` 会自动走本地 Babel 编译，生成 `runtimeCode` 与 `importedModules` 并保存为 `YidaCodeCanvas` Schema；扩展名不规范时可使用 `--canvas` 显式启用。
- 新增 `yida-canvas-custom-page` 和 `yida-canvas-upgrade` 技能，覆盖 Code Canvas 页面从零开发、依赖白名单、HTTP 数据桥、品牌主色落地和原生页面迁移。
- 新增 `yida-page-uiux` 与 `yida-nav-shell` 技能，在编写自定义页面前先确定工作台、看板、列表、详情或官网落地页的视觉方向，并支持隐藏应用导航后的页面内自绘导航壳。

### Changed
- 自定义页面技能路由调整为默认优先使用 Code Canvas；仅在强依赖原生页面实例数据桥时回退到 native 自定义页面链路。
- 自定义页面模板和设计 token 强化“主色跟随应用品牌”的约束，减少固定蓝色、统一圆角卡片等模板化视觉。
- npm 包校验和 CI 校验使用隔离 npm cache，并同步放宽技能包文件数量阈值，降低本地环境缓存对发布校验的影响。

### Tests
- 新增 Code Canvas 本地编译测试，覆盖依赖提取、window alias 改写、React 自动注入、TypeScript 剥离和编译错误提示。

## [2026.7.7] - 2026-07-07

### Highlights
- 重点覆盖集成自动化编排、应用结构导出、技能包内容优化和发布防护能力。
- 补充 Skill 测评 Harness 与自定义页面兼容性检查能力，便于在发布前验证 AI Agent 路由、真实生成链路和页面运行时风险。

### Added
- 新增应用 ER 图导出能力，支持从应用结构生成可视化关系图，便于梳理表单、页面和数据关系。
- 集成自动化新增结构化编排能力，并支持从集成流发起审批、HTTP 连接器模式和流程节点视图生成。
- 新增 OpenYida 发布防护技能，明确 tag 发布、CHANGELOG、校验、npm 与 GitHub Release 验证流程。
- 新增 Skill 测评 Harness，覆盖路由测评、真实生成、截图、打分、报告和本地 dashboard。
- 自定义页面能力补充运行时护栏、兼容性检查、页面 lint 和示例解决方案文档。

### Changed
- 优化根技能索引和多项子技能内容，降低长文档负担，并补充字段、URL、环境搭建与开发规则参考文档。
- 优化登录路径、首次升级体验和无头环境云端注入认证的兼容性。
- 导航分组首次生成顺序和自定义页面发布兼容处理进一步收敛，减少页面生成与发布时的异常。

### Fixed
- 修复自定义函数编辑框显示空白的问题。
- 修复自定义页面部分兼容性问题，并增强页面源码检查与发布前校验。
- 公式校验支持子表字段前缀检测和自动修复，降低公式配置错误。
- 修复集成自动化在 HTTP 连接器模式和 PR 评审中暴露的若干稳定性问题。

### Tests
- 新增 ER 图、集成自动化结构构建、Skill 测评、页面兼容性、登录、导航、公式校验和工具函数相关测试。
- 扩展 CLI smoke、真实 E2E 技能覆盖矩阵和 npm 包校验相关脚本。

## [2026.5.21] - 2026-05-21

### Highlights
- 这是 2026-05-21 的正式版发布，包含本地 OpenYida Web Bridge、体验反馈表单工作流、流程并行分支配置，以及自定义页面发布数据源保护。
- 面向 AI 编程工具补充多个示例页面和 Qoder Normandy CLI 技能资料，便于从对话直接进入应用搭建、登录诊断和控制台能力联动。

### Added
- 新增 `openyida bridge start`，启动仅监听本机回环地址的 OpenYida Web Bridge，供 `https://demo.aliwork.com/s/openyida` 进行本地探测、配对和能力调用。
- 新增 `openyida feedback <setup|url|dismiss|status>` 体验反馈表单工作流，可创建公开反馈表单、生成隐私安全反馈链接，并管理本地提醒状态。
- `openyida configure-process` 支持并行分支与 join 节点配置，覆盖更复杂的流程自动化场景。
- 新增 Agent Chatbox、图片转幻灯片、OpenYida 知识文档等示例页面，并补充 Qoder Normandy CLI 技能资料。

### Changed
- `openyida publish` 默认保留已有自定义页面数据源，发布前读取当前页面 Schema 并合并 Page 级 `dataSource`，避免重发布清空手工配置的数据源。
- 更新钉钉 AI 解决方案中心示例页面，增强页面内容与交互展示。

### Fixed
- 修复 `openyida publish` 参数顺序处理，避免 source/appType/formUuid 识别错位。
- 优化 Windows 登录二维码打开方式，并补充终端二维码无法扫码时的排查文档。

### Tests
- 新增 Bridge、Feedback、流程并行分支、发布预检和二维码登录相关测试，并让 DWS 集成测试使用当前 Node 可执行文件，提升 CI 一致性。

## [2026.5.18] - 2026-05-18

### Highlights
- 这是 2026-05-18 的正式版发布，新增应用级管理员设置能力，让 AI Agent 可以查询和维护单个宜搭应用的应用主管理员、数据管理员与开发成员。
- 新增 `yida-app-permission` 子技能，面向“应用设置 → 权限管理”场景提供可复用的操作指引，便于从对话中完成应用级权限治理。

### Added
- 新增 `openyida app-permission` 命令，支持 `search-user`、`get`、`set`、`add`、`remove`，可查询人员并维护 `main`、`data`、`dev` 三类应用成员。
- 新增 `yida-app-permission` 技能，并同步注册到根技能索引、命令清单、README 和 CLI 路由。
- 12 种语言帮助文案补齐 `app-permission` 命令入口，保持 OpenYida 多语言命令发现一致。

### Tests
- 新增 `tests/app-permission.test.js`，覆盖权限配置查询、保存参数解析、成员配置、错误处理和命令发现。
- 更新真实 E2E 技能覆盖矩阵，将 `yida-app-permission` 标记为离线单测覆盖，避免共享真实应用权限被 CI 修改。

## [2026.5.17-1] - 2026-05-17

### Added
- `openyida integration create` 支持审批完成事件 `processFinish` 与审批节点事件 `activityTask`，可通过 `--approval-actions` 和 `--approval-node-ids` 配置审批动作与节点过滤。
- 海外 / Global YiDA 登录链路补充 `FEForceLogin=true`、`corp_id` Cookie 解析、中文与日本/全球等环境别名，以及 `yida-login` 技能说明。

### Changed
- README 补充 Global YiDA 登录参数与集成自动化审批事件示例。

## [2026.5.17] - 2026-05-17

### Changed
- 海外 `intl` 内置环境切换为 `https://www.yidaapps.com`，登录链路使用 `login.dingtalk.io` OAuth 回调到 YiDA Apps。
- 新增全局 `--yidaapps` 环境选择别名，并让登录相关环境选择参数可用于 `env` 等非登录命令。

### Fixed
- 旧版 `intl` 配置会自动迁移到新的 yidaapps 登录链路，避免继续回调到 aliwork 公网地址。
- 从 DingTalk 国际 OAuth URL 反推服务域名时支持 `yidaapps.com`，提升国际站登录与 Cookie base URL 识别稳定性。

## [2026.5.13] - 2026-05-13

### Highlights
- 这是 2026-05-13 的正式版发布，包含 AI 文生文/识图 CLI、钉钉 AppLink 生成器、组织基础信息查询，以及钉钉 AI 解决方案中心示例资产。
- 登录与多环境 Cookie 管理继续增强，支持更清晰的强制重登、浏览器登录和多环境缓存隔离行为。
- Agent 生成的字段配置、报表配置、流程配置、导入数据和一次性脚本统一约束到 `.cache/openyida/`，减少仓库根目录临时文件噪音。

### Added
- 新增 `openyida ai text` 与 `openyida ai image`，支持调用 AI 文生文、图片上传和识图连接器能力。
- 新增 `openyida dingtalk-link`，支持生成 DingTalk AppLink，并保留 legacy scheme 兼容选项。
- 新增 `openyida basic-info` 与 `yida-basic-info` 技能，用于查询组织基本信息、容量、额度和域名等平台管理信息。
- 新增钉钉 AI 解决方案中心示例 PRD、表单字段、种子数据、自定义页面源码、预览 HTML 和本地 runner。
- `openyida data` 支持 `--data-file` 与 `--search-file`，便于从 `.cache/openyida/` 读取导入数据和查询条件。

### Changed
- 优化登录入口：`--agent-qr` 与 `--browser` 明确走强制登录链路，AI 工具环境下可按工具类型控制 Playwright 兜底。
- 多环境配置支持更稳健的 base URL 解析、Cookie 文件隔离和旧缓存迁移。
- README、帮助文案和技能文档统一推荐将临时 JSON / CSV / JS / Python 工件写入 `.cache/openyida/`。

### Tests
- 新增 AI、basic-info、DingTalk AppLink、file-based data 参数、多环境 Cookie、QR 登录和强制重登相关测试。
- 更新 e2e 技能覆盖矩阵，纳入 `yida-basic-info`。

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

[Unreleased]: https://github.com/openyida/openyida/compare/v2026.5.13...HEAD
[2026.5.13]: https://github.com/openyida/openyida/compare/v2026.5.12...v2026.5.13
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
