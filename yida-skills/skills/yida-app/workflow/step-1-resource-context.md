# Step 1：解析资源上下文

先确认本轮要操作哪个 app/page/form/process，再决定复用、补齐还是创建。不要把 `create-app`、`create-page`、`create-form` 当成默认动作。

## 只读预检

若根入口已经完成只读预检，沿用结果，不要每个阶段重复跑 env/help/login。

若还没有预检，优先跑一次 `openyida agent-capabilities --summary-json`；旧版本没有该命令时，退回 `openyida env --json` 和 `openyida login --check-only --json`。只有登录态可用后，才执行会创建、修改或发布宜搭资源的命令。

## 资源解析顺序

按以下优先级选择目标，上游来源更明确时覆盖下游来源：

1. 本轮用户显式给出的 `appType`、`formUuid`、应用 URL、页面 URL、流程标识、页面/表单名称；
2. 外部工具注入或当前会话绑定的资源上下文；
3. workspace 中的 `project/config.json`、`.cache/<项目名>-schema.json`、`.cache/openyida/**`；
4. 当前会话历史中已创建或已确认的资源；
5. 用户明确说“从零创建 / 新建另一个 / 创建新应用或新页面”时，允许创建缺失资源；
6. 多个同级候选、显式资源互相冲突或目标不明时，才询问用户。

已绑定资源上下文只是默认候选，不是锁定目标。若当前会话绑定页面 A，但用户本轮明确给出页面 B 的 URL、`formUuid` 或名称，必须重新解析 B；B 能唯一解析就切换，不能唯一解析才询问。

## create-or-update 判定

| 已解析到 | 正确动作 |
| --- | --- |
| 目标 app | 在该 app 内补齐资源，不执行 `use_skill("yida-create-app")` |
| 目标自定义页面 URL / `formUuid` / bound page | 直接写源码并发布到该页面，不执行 `use_skill("yida-create-page")` |
| 目标表单 `formUuid` | 走 `yida-create-form-page` 的 update/patch/rule/bind-datasource，不创建同类表单 |
| 目标流程表单或 `processCode` | 走 `yida-process-rule` 配置或更新流程，不从零执行 `yida-create-process` |
| 缺少 app 且用户允许创建 | 记录 `allowCreate=true`，等 Step 2 PRD 完成后再创建应用 |
| 缺少页面且用户允许创建 | 在表单/流程和 seed records 完成后再创建 display 页面占位 |

若已有 app 来自外部工具预创建资源，OpenYida 技能侧只复用 `appType`，不自动修改应用名称；应用名修正由外部工具侧负责。

## 命令选择

- 已有显式 `appType`、应用 URL 或已绑定上下文中的 `appType` 且能唯一解析时，直接复用；不要调用 `app-list` 做存在性确认。
- 只有用户只给应用名称、存在多个候选、resource context 冲突，或需要诊断目标 app 访问失败时，才运行 `openyida app-list [--type managed|created] [--page N] [--size N]`。默认查询“我管理的”第 1 页、每页 16 条；需要继续查找时按返回提示逐页查询，不要假设命令会自动拉取全量。
- 已知 `appType` 后，查询应用下表单/页面用 `openyida list-forms <appType> [--keyword <text>]`；选择页面发布目标时只用 `formType=display`。
- 查询表单/页面 Schema、字段 ID 或批量字段摘要用 `openyida get-schema <appType> <formUuid|--all> ...`。
- 页面、流程、公式或多表 dataBinding 确实需要多个 `fieldId` 时，对每个目标业务表单最多一次性执行 `openyida get-schema <appType> <formUuid> --field-map-json`，读取完整 JSON 并合并到 `.cache/<项目名>-schema.json`。
- 禁止编造 `list-apps` / `get-app`；不要把 `--app-type` / `--form-uuid` 当成 `list-forms` 或 `get-schema` 的参数。

## 路径口径

- 从仓库根执行页面命令时使用 `project/pages/src/...`。
- 如果 cwd 已是 `<workspace>/project`，使用 `pages/src/...`，不要传 `project/pages/src/...` 导致 `project/project`。
- 读取 PRD、字段 JSON、页面源码或 schema 文件时优先用当前工具的 Read / Glob / Grep；OpenYida CLI 成功输出已经是操作证据，不要再 Bash `cat`/`ls` 复核。

## 产出

进入 Step 2 前，必须得到以下结论：

- 本轮目标 app/page/form/process 的来源和 ID；
- 哪些资源复用，哪些资源缺失；
- 是否允许在 PRD 完成后创建缺失 app 或页面；
- 目标组织和 `corpId` 线索，供创建或发布页面前核对。

## 下一步

→ [Step 2：产品设计](step-2-design.md)
