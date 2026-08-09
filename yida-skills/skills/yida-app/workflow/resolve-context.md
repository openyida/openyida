# 确认目标资源

本文件用于阶段 0。先确认本轮要复用哪些资源、缺哪些资源、能不能创建缺口。

## 输入来源

按以下顺序选择目标 app/page/form/process：

1. 本轮用户明确给出的 `appType`、`formUuid`、应用 URL、页面 URL、流程标识或页面/表单上下文；
2. 外部工具注入的当前任务资源上下文，例如 yida-agent 绑定的 app/page/form/process；
3. workspace 中的 `project/config.json`、`.cache/<项目名>-schema.json`、`.cache/openyida/**` 等本地配置和缓存；
4. 当前会话历史中已创建或已确认的资源；
5. 用户明确说“从零创建 / 新建另一个 / 创建新应用或新页面”时，允许创建缺失资源；
6. 多个同优先级候选、显式资源互相冲突，或无法判断目标时，询问用户。

本轮显式目标优先于已绑定资源。会话绑定页面 A，但用户本轮明确给出页面 B 的 URL、`formUuid`、页面名称或其他可识别线索时，先解析 B；B 能唯一确认时切换到 B，B 不能唯一确认时询问用户。

## 输出

输出一份资源判断结果，供后续阶段使用：

| 字段 | 含义 |
| --- | --- |
| `targetApp` | 已确认或待创建的应用 |
| `targetMainPage` | 已确认或待创建的主 display page |
| `targetForms` | 已确认或待创建的普通表单 |
| `targetProcesses` | 已确认或待创建的流程表单 |
| `source` | `explicit`、`boundContext`、`workspaceConfig`、`conversation`、`new` 或 `unknown` |
| `allowCreate` | 本轮是否允许创建缺失资源 |
| `needAskHuman` | 是否必须询问用户 |

## 命令选择

- 已有显式 `appType`、应用 URL 或已绑定资源中的 `appType` 且能唯一确认时，直接复用该 app。
- 用户只给应用名称、存在多个候选、资源上下文冲突或需要诊断 app 访问失败时，运行 `openyida app-list [--size N]`。
- 已知 `appType` 后，查询该应用下表单/页面用 `openyida list-forms <appType> [--keyword <text>]`；选择页面发布目标时只用 `formType=display`。
- 简单字段属性更新交给 `create-form update/add-option/bind-datasource/validation/rule` 的 schema-aware 解析。
- 页面代码、数据、流程或公式需要多个字段映射时，对目标表单执行 `openyida get-schema <appType> <formUuid> --field-map-json`。
- 阶段 0 不编造 `list-apps` / `get-app`；`list-forms` 和 `get-schema` 只使用命令支持的参数。

## 完成检查

阶段 0 结束时，只允许出现三种结果：

1. 已确认复用现有资源；
2. 已确认创建缺失资源；
3. 目标不明，已询问用户。
