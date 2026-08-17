---
name: openyida
description: >
  宜搭应用开发总入口技能。通过具备代码生成能力的智能体（千问办公/Claude/Open Code 等）+ 宜搭低代码平台，实现一句话搭建或修改完整应用。
  当用户提到“宜搭”、“yida”、“低代码”、“创建应用”、“创建表单”、“发布页面”、“搭建”、“系统”等关键词时，使用此技能；只是讨论通用前端/后端代码、非宜搭平台产品、或只解释概念而不操作宜搭资源时不触发。
  重要路由规则：完整应用/系统/平台的从零搭建、已有 app 但没有任何页面、或已有 app/page 需要补成完整业务系统时，必须先加载 yida-app 子技能作为编排入口。已有资源的单点改字段、改页面、发布、权限或数据任务按对应子技能路由。
---

# 宜搭应用开发指南

在执行宜搭应用/页面/审批流等任务前先确认环境与登录态，再根据用户需求和已解析的 app/page/form/process 等上下文资源，分析任务属于完整搭建、已有资源补齐还是单点任务，并加载对应子技能执行。

## 执行步骤

### Step 1：环境与登录态确认

先执行 `openyida agent-capabilities --summary-json`，确认 OpenYida、Node/npm、登录态和工作目录可用。`openyida agent-capabilities --json` 是完整能力信息，只在命令契约排障、manifest 差异诊断或深度调试时使用；不要把完整能力信息放进常规完整搭建链路。`workdir` 对应完整能力信息里的 `active.projectRoot`。

未完成环境与登录态确认前，不创建应用、页面、表单，不发布页面。环境异常、登录失败、env token 注入和 `openyida copy` 初始化见 [环境准备与登录检测](references/setup-and-env.md)。

核心判断：

| 快照结果 | 动作 |
| --- | --- |
| `openyida` 不可用 | 先安装或更新 `openyida`，不创建资源 |
| 工作目录不存在 | 先执行 `openyida copy` 初始化工作目录 |
| 登录态可用 | 进入 Step 2 |
| 登录态缺失 | 按快照提示补登录态；未恢复前停止资源写操作 |

### Step 2：解析资源上下文

任何写操作前先解析目标 app/page/form/process。按本轮显式资源、外部绑定资源、workspace cache/config、会话历史的顺序选择目标；同级冲突或目标不明才询问用户。

执行 Step 2 时必须读取 [资源上下文与补齐判定](references/resource-context.md)，并按其中规则解析目标资源。已有 app 默认复用，不执行 `yida-create-app`；已有 app 但没有任何页面时，进入完整应用补齐；PRD 不需要页面时，不强制创建自定义页面。

核心判断：

| 已解析到 | 动作 |
| --- | --- |
| 目标 app | 复用该 app，在其中修改、补齐或发布 |
| 目标 app 但没有任何页面 | 进入完整应用补齐；PRD 不需要页面时不强制创建自定义页面 |
| 目标页面 / 表单 / 流程 | 修改已有资源，不创建同类新资源 |
| 目标缺失且用户明确允许创建 | 进入对应创建技能 |
| 多个同级候选或上下文冲突 | 先询问用户 |

### Step 3：意图识别

| 判定 | 用户诉求信号 | 下一步 |
| --- | --- | --- |
| 完整搭建 / 补齐 | 创建/搭建/做一个 + 应用/系统/管理系统；已有 app 没有任何页面；或已有 app/page 需要补成完整系统 | 加载 `yida-app` |
| 单一 / 增量任务 | 对已有应用/表单/页面做单点操作：加字段、查改数据、配公式、建报表、改权限、发布、美化等 | 从下方技能路由表选 1 个子技能 |

意图识别只决定入口，不展开执行细节。完整搭建 / 补齐加载 `yida-app` 后按其 workflow 执行；单点任务只选 1 个主技能，不升级成完整搭建。

### Step 4：加载子技能并执行

如果当前 AI 工具提供 `use_skill` / `search_skills`，必须用 `use_skill("<技能名>", "<本阶段目的>")` 加载技能，不用 `Read` / `read_file` / `cat` 直接读取 `SKILL.md` 路径。如果当前工具没有 `use_skill` / `search_skills`，按 `skills/<技能名>/SKILL.md` 定位当前阶段要执行的子技能文档。

单点任务按意图选 1 个主技能；完整应用由 `yida-app` workflow 分阶段推进，每一步加载当前步骤对应的子技能。`skills-index.json` 只给能读取索引的工具辅助匹配，不作为运行前置。执行边界见下方核心规则。

## 技能路由表

这张表给人工 fallback 和人审使用：先按用户任务命中一个大类目录，再在该目录内选定 1 个最匹配的子技能。机器索引和精排方法见 [路由补充说明](references/routing-supplement.md)。

### 大类目录

| 大类目录 | 第一层意图信号 | 子技能 |
| --- | --- | --- |
| `yida-skills/context` | 登录、退出、切换组织、组织版本/容量、Schema、fieldId、执行前检查 | `yida-login`、`yida-logout`、`yida-basic-info`、`yida-get-schema`、`yida-corp-efficiency` |
| `yida-skills/app` | 从零搭应用、完整系统、应用启停、应用导航、多语言 | `yida-app`、`yida-create-app`、`yida-app-lifecycle`、`yida-nav-group`、`yida-i18n` |
| `yida-skills/design` | 完整应用产品设计、单页 UI 改造、主页面视觉设计、应用主题色、全局换肤、PRD 和 design.md | `yida-design` |
| `yida-skills/form` | 表单字段、公式、校验、业务关联规则、详情页、批量录入、数据记录 | `yida-create-form-page`、`yida-formula`、`yida-formula-evaluate`、`yida-business-rule`、`yida-form-detail`、`yida-canvas-table-form`、`yida-table-form`、`yida-data-management` |
| `yida-skills/process` | 审批、流程表单、流程规则、节点/分支/字段权限、流程代理 | `yida-create-process`、`yida-process-rule`、`yida-agent-center` |
| `yida-skills/page` | 自定义展示页、页面源码开发、平台 JSX 组件页面维护、页面发布、页面内导航、PPT 页面 | `yida-create-page`、`yida-canvas-custom-page`、`yida-custom-page`、`yida-canvas-data-binding`、`yida-canvas-upgrade`、`yida-publish-page`、`yida-openyida-publish-guard`、`yida-density`、`yida-nav-shell`、`yida-ppt-slider` |
| `yida-skills/analytics` | 报表、统计、图表、Recharts、ECharts、看板、驾驶舱、大屏 | `yida-report`、`yida-rechart`、`yida-chart`、`yida-dashboard` |
| `yida-skills/integration` | 连接器、外部 API、执行动作、设计器数据源、集成自动化、逻辑流 | `yida-integration`、`yida-connector`、`yida-connector-safe-actions`、`yida-data-source-connectors` |
| `yida-skills/access` | 平台/应用/表单/页面权限、公开访问、分享 | `yida-corp-manager`、`yida-app-permission`、`yida-form-permission`、`yida-page-config` |
| `yida-skills/ops` | Sequence、主键冲突、VOC 反馈 | `yida-db-seq-fix`、`yida-voc` |
| `yida-skills/agent` | 导出对话、读取钉钉文档/听记、会议纪要/闪记转 PRD | `yida-export-conversation`、`yida-document-markdown`、`yida-tingji`、`yida-flash-note-to-prd` |

### 高频分歧

| 用户意图 | 选哪个 |
| --- | --- |
| 从零搭一个完整应用/系统 | `yida-app`；统一编排，先由 `yida-design` 完成产品设计 |
| 已有 app 但没有任何页面，需要补成完整系统 | `yida-app`；复用已有 `appType`，按 PRD 补齐表单、流程、页面（如需要）和导航 |
| 读取钉钉在线文档正文 | `yida-document-markdown`，使用登录态接口获取 Markdown |
| 按 taskUuid 读取钉钉听记 | `yida-tingji`，将听记任务 ID 原样传入命令 |
| 用户给 taskUuid 并要求转 PRD | 先用 `yida-tingji` 读取听记内容，再把已有内容交给 `yida-flash-note-to-prd` 生成 PRD |
| 已有会议纪要/闪记内容转 PRD | `yida-flash-note-to-prd`，只处理已有内容，不负责按 taskUuid 拉取听记 |
| 只创建应用壳并拿 appType | `yida-create-app`；创建成功后把真实 `appType` 交给 `yida-design` 生成或更新 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`，后续表单、流程、页面和发布都消费这两份文件 |
| 启用/上线或停用/下线已有应用 | `yida-app-lifecycle`；只有用户明确要求时执行，`app-offline` 执行前需再次确认目标应用 |
| 创建自定义展示页资源 | `yida-create-page`，之后交给 `yida-canvas-custom-page` 编写页面源码，再交给 `yida-publish-page` 发布 |
| 开发表单字段结构 / 增删改字段 | 先加载 `yida-form-detail` 做表单视觉引导并合并 Divider 分割线，再用 `yida-create-form-page` 落地字段结构 |
| 创建带审批的流程表单 | `yida-create-process` |
| 修改已有流程节点/分支/字段权限 | `yida-process-rule` |
| 查字段 ID / 保存 Schema 证据 | `yida-get-schema`；凡涉及 fieldId 的数据、流程、公式、页面代码先取证 |
| 改表单数据记录 | `yida-data-management`，不是 `yida-create-form-page` |
| 配字段默认值、计算、校验 | `yida-formula`；静态检查用 `yida-formula-evaluate` |
| 提交后跨表写入/更新/删除 | 默认 `yida-integration`；用户明确要业务关联规则/高级函数时用 `yida-business-rule` |
| 自定义页面开发 | `yida-canvas-custom-page`，新建和默认页面源码开发入口，源码使用 `.canvas.jsx` |
| JSX 自定义页面开发 | `yida-custom-page`，仅用于已检测到的 `.oyd.jsx` / `.oyb.jsx` / `renderJsx` / 平台 `Jsx` 组件页面维护 |
| `.canvas.jsx` 页面使用成员/部门/上传等宜搭运行态组件 | `yida-canvas-custom-page`，读取 `native-components-bridge.md` |
| `.canvas.jsx` 页面接真实数据 | `yida-canvas-data-binding` |
| 已有 `.oyd.jsx` / `renderJsx` 迁到 `YidaCodeCanvas` 组件实现 | `yida-canvas-upgrade` |
| 高级图表、可视化、看板图表 | 默认 `yida-rechart` |
| 明确 ECharts、维护旧 ECharts 页面、复杂 option 超出 Recharts 能力 | `yida-chart` |
| 产品化经营看板/驾驶舱交付 | `yida-dashboard` |
| 批量录入、表格填写、多行编辑 | 默认 `yida-canvas-table-form`；已检测到平台 JSX 组件页面、native 页面或存量源码使用 `this.utils.yida.saveFormData` 时用 `yida-table-form` |
| 页面视觉方向、页面美化、去 AI 味 | `yida-design` 产出 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`，或单页 PRD 章节 + design spec；实现阶段默认交给 `yida-canvas-custom-page` |
| 应用级主题、品牌色、全局换肤 | `yida-design` |
| 平台左侧导航树分组/排序 | `yida-nav-group` |
| 页面隐藏原导航后自绘导航壳 | `yida-nav-shell` |
| 普通报表/统计 | `yida-report` |
| PPT 页面 | `yida-ppt-slider` |
| 公开访问/组织内分享 | `yida-page-config` |
| 评测指定技能质量并给出评分建议 | `yida-skill-evaluator` |

索引精排方法和无独立子技能的 CLI 见 [路由补充说明](references/routing-supplement.md)。

## 核心规则

以下规则都是执行 OpenYida 任务时必须遵守的全局边界；具体子技能可以补充更细规则，但不能覆盖这些规则。

1. **OpenYida CLI 统一执行**：所有宜搭资源操作通过 `openyida` CLI 执行；创建、修改、发布、查询都以 CLI 返回的 JSON、URL、`formUuid/appType` 作为证据。
2. **技能加载唯一入口**：执行子技能前必须加载对应技能；单点任务按意图选 1 个主技能，完整应用由 `yida-app` workflow 分阶段加载当前步骤对应的子技能。
3. **真实资源先确认**：写操作前解析本轮显式资源、已绑定资源上下文、workspace 配置/缓存和历史上下文；已有目标资源时默认修改、补齐或发布，只有目标缺失且意图允许创建时才加载 create 类技能。
4. **corpId 一致性检查**：创建或发布页面前对比 PRD/resource context 与当前 auth snapshot 的 `corpId`；不一致时先让用户选择重新登录或确认继续。
5. **页面源码修改必须发布闭环**：只要本轮 Write/Edit/Create 了页面源码 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}`，final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>`；没有证据只能说“源码已修改，尚未发布”，禁止说“页面已更新 / 已重新发布 / 已上线”。
6. **发布前本地校验**：平台 JSX 组件页面的 `check-page` / `compile` 归 `yida-custom-page` 执行；使用 `YidaCodeCanvas` 组件实现的自定义页面按本地快检或发布阶段校验；JSON 配置写盘后先解析校验，再调用平台命令。
7. **生成产物严禁 emoji**：页面源码、`.canvas.jsx` 源码、表单 Schema、发布 Schema、产物文件名和路径中严禁使用 emoji；图标语义使用平台组件、图标库或已验证资源表达。
8. **输入文件用结构化写入**：JSON/YAML/CSV/config/script 文件使用当前 agent 的文件写入能力创建，再把路径传给命令；严禁用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成业务文件。
9. **OpenYida CLI 不吞诊断**：不要给 `openyida` 命令加 `2>/dev/null`；失败时保留 stdout/stderr；遇到 DENIED 或同一命令重复失败，先换策略、改输入或重做环境确认。
10. **读取与复核用合适工具**：读取或定位 workspace 文件优先用当前工具的 Read / Glob / Grep 或 `rg`；OpenYida CLI 已返回成功 JSON、URL、`appType`、`formUuid` 或 `fieldId` 时，以 CLI 结果作为证据。
11. **资源 ID 必须精确**：`appType`、`formUuid`、`fieldId` 等应用、表单、字段 ID 必须来自 CLI/API/cache 证据并一字不差传入命令和源码；不得凭名称、截图、相似前缀或记忆补写、改写、截断。
12. **字段和 Schema 以证据为准**：字段级表单操作优先交给 `create-form update/add-option/bind-datasource/validation/rule` 的 schema-aware 解析；页面代码、数据、流程、公式等需要字段映射时，每表单一次性执行 `openyida get-schema --field-map-json` 并缓存字段摘要。
13. **设计事实源固定**：完整应用和真实业务页先由 `yida-design` 输出 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`；页面目标、区块、数据和交互以 PRD 为准，布局、主题、材质和状态视觉以 design.md 为准。
14. **配置优先于页面代码**：字段、公式、联动、报表、审批和集成交给对应技能；自定义页面负责展示数据、放置业务入口，并串联表单、流程、报表和导航入口。
15. **数据性能优先**：统计聚合用 `yida-report` 服务端聚合，不在前端拉全量后自行聚合。
16. **避免无效重试**：失败先查登录态、组织、参数和字段 ID；无修改不连续重试超 1 次。
17. **存储路径固定**：PRD、视觉契约、Schema ID 和临时文件按存储约定写入：
| 类型 | 路径 |
| --- | --- |
| 业务语义 | `prd/<项目名>/prd.md` |
| 视觉契约 | `prd/<项目名>/design.md` |
| Schema ID | `.cache/<项目名>-schema.json` |
| 临时配置/导入数据/脚本 | `<projectRoot>/.cache/openyida/<项目名或任务名>/` |

- `prd.md` 只记录业务语义，不记录字段 ID。
- Schema ID 映射不是远端真相；CLI 返回字段不存在、重名或歧义时重新取证。
- 从 workspace 根执行命令时路径加 `project/` 前缀；在 OpenYida project 工作目录内执行时使用 `.cache/...`。
- 不把 OpenYida 业务中间文件写到仓库根目录或系统临时目录。

18. **报表和可视化先分流**：标准统计与原生报表用 `yida-report`；定制图表页面默认用 `yida-rechart`；只有明确 ECharts、维护旧 ECharts 页面或复杂 option 超出 Recharts 能力时用 `yida-chart`。
19. **UI 设计技能优先**：涉及应用蓝图、页面视觉、应用主题色、品牌色、全局换肤或 `--color-brand1-*` 时先读 `yida-design`；主题必须根据行业、品牌、业务情绪和视觉目标判断，不套用刻板配色。
20. **默认完成即停止**：完整应用默认以资源发布成功、轻量导航排序完成、示例数据就绪并输出主入口 URL 与业务交付总结为 doneWhen；截图、精细导航整理和额外深读属于 optionalAfterDone，除非用户明确要求。
21. **输出业务化**：最终回复先写 2-3 句业务交付总结，再给主入口链接；默认不输出资源 ID 表格、长列表、管理态链接、CDN 构建产物或中间文件 URL。
22. **任务复盘沉淀**：用户多次纠正、平台接口假成功、页面骨架共性质量问题、线上回读验收方法、一次性脚本可产品化等情况，完成前判断是否需要沉淀到 CLI、测试或 skill。

常见问题见 [常见问题解决方案](references/execution-rules.md)。

## 参考文件

| 文档 | 覆盖范围 | 何时阅读 |
| --- | --- | --- |
| [资源上下文与补齐判定](references/resource-context.md) | 资源优先级、绑定上下文、create-or-update、已有 app 无页面 | Step 2 必读 |
| [路由补充说明](references/routing-supplement.md) | 索引精排方法、无独立子技能 CLI | Step 3 排障或索引匹配不准时 |
| [常见问题解决方案](references/execution-rules.md) | 常见问题处理路径 | 遇到发布、字段、表单更新或 corpId 问题时 |
| [环境准备与登录检测](references/setup-and-env.md) | 环境依赖、env 解读、多环境 token 登录、project 初始化 | 环境异常或登录问题时 |
| [宜搭 API](references/yida-api.md) | 宜搭 API 完整参数 | 调用 API 前 |
| [公式函数库](references/formula-functions.md) | 公式函数速查 | 编写公式前 |
| [官方示例 Schema 范式](references/official-example-schema-patterns.md) | 脱敏 schema 承载范式 | 蒸馏官方示例时 |
| [任务复盘与沉淀规范](references/task-retrospective.md) | 任务收尾沉淀、CLI/skill/页面骨架反哺、视觉参考和主题经验 | 任务完成前、用户要求总结经验或多次纠正同类问题时 |
| [查询条件构造](references/query-condition-guide.md) | 数据查询条件写法 | 数据查询/筛选时 |
| [报表字段配置](references/report-field-config-guide.md) | 报表字段配置规范 | 配置报表时 |
| [版本功能差异](references/edition-features-guide.md) | 各版本能力差异 | 版本能力查询时 |
| [模型 API](references/model-api.md) | 宜搭模型接口 | 调用宜搭模型能力时 |
