# 资源上下文与补齐判定

## 用途

在 Step 2 使用本文件解析目标资源，再判断复用、补齐、修改还是创建。

## 资源解析顺序

按以下优先级选择 app/page/form/process，上游来源更明确时覆盖下游来源：

1. 本轮用户明确给出的 `appType`、`formUuid`、应用 URL、页面 URL、流程标识或页面/表单上下文；
2. 外部工具注入的当前任务资源上下文；
3. workspace 中的 `project/config.json`、`.cache/<项目名>-schema.json`、`.cache/openyida/**` 等本地 cache/config；
4. 当前会话历史中已创建或已确认的资源；
5. 无资源且用户明确说“从零创建 / 新建另一个 / 创建新应用或新页面”时，允许创建缺失资源；
6. 仍有多个同优先级候选、当前轮显式资源互相冲突，或无法判断目标时，才 `ask_human`。

## 本轮显式目标覆盖注入上下文

外部工具注入的已绑定 app/page/form 只是默认候选，不是锁定目标。若当前会话绑定页面 A，但用户本轮明确给出页面 B 的 URL、`formUuid`、页面名称或其他可识别线索，必须重新解析 B；B 能唯一解析时切换到 B，B 不能唯一解析时 `ask_human`，禁止静默回落到 A。

## 可选资源上下文协议

本地工具不支持时忽略，不作为运行前置。

```json
{
  "kind": "openyida_resource_context",
  "version": 1,
  "app": {
    "appType": "APP_xxx",
    "source": "explicit_prompt|url|agent_bound|workspace_cache",
    "allowCreate": false,
    "precreated": true
  },
  "page": { "formUuid": "FORM_xxx", "source": "explicit_prompt|url|agent_bound|workspace_cache", "allowCreate": false },
  "form": { "formUuid": "FORM_xxx", "source": "explicit_prompt|url|workspace_cache", "allowCreate": false }
}
```

`precreated` 表示该 app 由外部工具提前创建并绑定到本轮任务。字段缺失时按普通已有资源处理。

## create-or-update 判定

| 已解析到 | 正确动作 |
| --- | --- |
| 目标 app | 在该 app 内修改、补齐或发布，不执行 `yida-create-app` |
| 目标 app 但没有任何页面 | 加载 `yida-app`，复用 app，按 PRD 补齐表单、流程、页面/发布/导航（如需要）；PRD 不需要页面时不强制创建自定义页面 |
| 目标自定义页面 URL / `formUuid` / bound page | 写源码并发布到该页面，不执行 `yida-create-page` |
| 目标表单 `formUuid` | 使用 `yida-create-form-page` 的 update/patch/rule/bind-datasource 模式，不创建同名或同类表单 |
| 目标流程表单 / `processCode` | 使用 `yida-process-rule` 配置或更新流程，不从零执行 `yida-create-process` |
| 目标缺失且用户允许创建 | 记录 `allowCreate=true`，再进入对应创建技能 |

绑定 app 只复用不改名。OpenYida 技能侧不自动修改应用名称；应用名修正如有需要由外部工具侧负责。

## 典型场景

| 场景 | 正确动作 |
| --- | --- |
| `帮我搭建访客系统` + bound app/page | 不 create app/page；直接在已有 app/page 内补表单、写页面并发布 |
| `APP_xxx 现在没有任何页面，帮我补成订单系统` | 加载 `yida-app`；复用已有 app，按 PRD 补表单、流程、页面（如需要）和导航 |
| `在 APP_xxx 里增加客户表和回访页面` | 不 create app；允许按缺口 create form/page |
| `优化这个页面 URL` | 不 create app/page；直接进入 custom-page + publish existing page |
| bound 页面 A，但用户说“修复页面 B 的 xx 字段” | 先解析页面/表单 B；B 有 URL/formUuid 时改 B，只有 B 无法唯一识别时询问用户，不能默认改 A |
| `从零创建一个 CRM 应用` 且无 context | 允许 create app/form/page 并发布 |
| 多个 app/page 候选 | 按来源优先级选；同级冲突或目标不明才问人 |

## 命令选择

- 已有显式 `appType`、应用 URL 或已绑定资源上下文中的 `appType` 且能唯一解析时，直接复用该 app，不要调用 `app-list` 做存在性确认。
- 只有用户只给应用名称、存在多个候选、resource context 冲突，或需要诊断目标 app 访问失败时，才运行 `openyida app-list [--type managed|created] [--page N] [--size N]`。默认查询“我管理的”第 1 页、每页 16 条；需要继续查找时按返回提示逐页查询，不要假设命令会自动拉取全量。
- 已知 `appType` 后，查询应用下表单/页面用 `openyida list-forms <appType> [--keyword <text>]`；选择页面发布目标时只用 `formType=display`。
- 查询表单/页面 Schema、字段 ID 或批量字段摘要用 `openyida get-schema <appType> <formUuid|--all> ...`。
- 页面、流程、公式或多表 dataBinding 确实需要多个 `fieldId` 时，对每个目标业务表单最多一次性执行 `openyida get-schema <appType> <formUuid> --field-map-json`，读取完整 JSON 并合并到 `.cache/<项目名>-schema.json`。
- 禁止编造 `list-apps` / `get-app`；不要把 `--app-type` / `--form-uuid` 当成 `list-forms` 或 `get-schema` 的参数。

## 路径口径

- 从仓库根执行页面命令时使用 `project/pages/src/...`。
- 如果 cwd 已是 `<workspace>/project`，使用 `pages/src/...`，不要传 `project/pages/src/...` 导致 `project/project`。
- 读取 PRD、字段 JSON、页面源码或 schema 文件时优先用当前工具的 Read / Glob / Grep；OpenYida CLI 成功输出已经是操作证据，不要再 Bash `cat`/`ls` 复核。
