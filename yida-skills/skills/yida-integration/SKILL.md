---
name: yida-integration
description: 配置宜搭自动化的执行时机和处理步骤，修改已有自动化，查看运行日志和设置异常提醒，也可复制、重命名或删除。节点参数按需读取通用节点说明。
---

# 集成自动化

本技能负责逻辑流的触发、完整 spec、保存发布和结果核对。节点参数统一由 `use_skill("yida-flow-node-config", "集成自动化；所需节点类别或配置项")` 提供，按需读取。

## 使用范围与限制

表单或流程事件后的自动通知、跨表新增／更新、创建待办、调用连接器等动作，默认使用本技能。不要把提交后的自动动作塞进表单字段 JS 或自定义页面按钮；只有用户明确要求一次性人工触发工具页时才采用该方式。

审批、办理等人工流程配置使用 `yida-process-rule`。先解析目标应用、表单和已有逻辑流；目标或资源归属不明确时保持零写入。当前入口未封装的触发或节点必须报告具体缺口，不能改变用户要求的触发语义。

## 严格禁止 (NEVER DO)

- 不要在未加载本技能内容的情况下编写逻辑流定义，节点格式复杂且易出错。
- 不要编造 `formUuid` 或 `fieldId`，必须从已有记录或 `yida-get-schema` 获取。
- 不要用此技能配置审批流程，应使用 `yida-process-rule`。
- 不得把 `integration update` 的 fail-closed 结果降级为 `integration create --process-code --replace`。

## 严格要求 (MUST DO)

- 定时任务按实际结束条件选择 `count`（触发次数）或 `time`（指定时间），spec 分别填写 `schedule.maxCount` 或 `schedule.expireDate`。需要“一直执行”或长期持续运行时，建议选择指定时间，将截止日期设得较远，并在配置摘要中展示实际日期；详见 [触发设置](references/triggers.md#结束条件)。
- **创建/发布前必须确认**：执行集成自动化创建或发布操作前，必须向用户展示逻辑流配置摘要（触发条件、节点列表、通知对象），获得用户明确同意后再执行。
- 创建前先确认触发表单的 `formUuid` 和相关字段 ID。
- 创建成功后记录逻辑流 ID 到 `<projectRoot>/.cache/<项目名>-schema.json`。
- `--spec` JSON 文件必须先用结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/integration/`；不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向写文件，也不要写仓库根目录或系统临时目录。
- 连接器 action schema 只能来自 CLI 的平台只读发现或固定已证 preset；不得使用 `--connector-inputs` 自行声明未知字段类型，未知连接器、动作或输入字段必须停止且保持零写入。
- 连接器嵌套输入使用完整路径赋值，如 `Body.userid`、`Path.unionId`；只有 schema 中唯一的叶子名可以使用短名称。
- 需要宜搭 `systemToken` 的连接器动作使用 `--connector-system-token-app <appType>`，或在 spec 中声明 `secretBindings`；凭据只能由 CLI 校验官方目标后安全绑定，不能写入普通 assignment、页面源码或命令文本。
- `integration create --publish` 的成功只证明控制面保存、启用和配置回读；`runtimeVerified=false` 时不得宣称连接器已执行或通知已送达。需要运行验收时，必须按授权范围真实触发并独立读回业务结果。
- 参考官方示例时不要只看默认页面 schema；逻辑流本体必须通过集成自动化接口或命令查询、创建。
- 分析已有应用时，先执行不带筛选的 `integration list --json` 获取全部已知触发类型；不得只看表单事件就声称已完成自动化盘点。
- 新建逻辑流必须先由 CLI 创建绑定，再保存内容；禁止绕过 `createLogicflow.json` 直接用 `saveProcess` 冒充新建。首个写入前完成完整运行与设计配置的本地构建。
- 本技能不读写 memory；真实逻辑流 ID 从命令结果取得并按上方要求记录，不依赖跨会话记忆判断平台状态。

## 命令选择

从要完成的任务选择说明。入口负责目标确认、执行顺序和验收；节点参数只在通用节点技能中维护。

| 用户目标 | 执行动作 |
| --- | --- |
| 创建新自动化 | 使用 `integration create`，由 CLI 生成 `processCode` |
| 选择表单事件、流程事件、定时或字段变化触发 | 读 [触发设置](references/triggers.md)，先确定何时执行 |
| 选择数据、通知、条件分支、并行或循环 | 调用 `use_skill("yida-flow-node-config", "所需节点类别")`，按类别读取配置 |
| 获取数据时，用触发记录或上游节点的字段来筛选，例如“库存小于申请数量” | 使用 `dataRetrieve.conditions` 或 `--data-condition`，将用来比较的字段配置为 `valueType: processVar`；字段引用格式见 [条件与变量](../yida-flow-node-config/references/conditions-variables.md#获取数据节点按条件过滤--字段) |
| 获取数据时，用公式算出的结果来筛选，例如“库存小于申请数量的两倍”；或用公式决定进入哪个条件分支 | 通过 `use_skill` 加载 `yida-formula`，再读 [完整节点示例](../yida-formula/references/node-examples.md)，保留执行文本和编辑器内容 |
| 开始节点触发过滤或分支的字段与字段比较 | 与取数筛选分别验收；尚未通过平台运行验收，不能由取数字段引用推断已可用，见 [条件与变量](../yida-flow-node-config/references/conditions-variables.md) |
| 批量取数、新增或复制子表多行 | 使用 `integration create --spec`，读取通用技能的数据操作说明 |
| 整图替换已有自动化 | 校验 `appType/formUuid/processCode`，明确告知“CLI 无法读取原有节点定义；本次将整体覆盖，原节点不保留”，获得确认后使用 `integration create ... --process-code <code> --replace` |
| 更新已有自动化 | 读取 [修改已有自动化](references/operations.md#修改已有自动化)，先预览，核对创建时的完整记录后，只修改指定内容 |
| 查询、启停、查日志或设置异常提醒 | 读 [维护与运行排查](references/operations.md) |
| 复制、重命名或删除 | 读 [日常管理](references/operations.md#日常管理)，先核对目标和影响 |
| 目标或归属不明确 | 先只读确认，不写入 |

对目标返回 `PLATFORM_PROBE_REQUIRED` 时，表示该目标的安全更新条件未通过，保持 `remoteWrites=0`；按返回原因核对可信基线和远端状态。

## 命令格式

```bash
openyida integration create <appType> <formUuid> <flowName> [选项]
openyida integration update <appType> <formUuid> <processCode> --patch <patch.json> [--dry-run] [--expect <fingerprint>]
openyida integration list <appType> [--flow-types 1,2,3,5,6] [--form-uuid <uuid>] [--status y|n] [--json]
openyida integration enable <appType> <formUuid> <processCode>
openyida integration disable <appType> <formUuid> <processCode>
openyida integration check <appType...> [--json] [--output result.xlsx] [--no-progress]
openyida integration diagnose --text "<异常信息>" [--json]
openyida integration diagnose --file <异常文件> [--json]
```

| 参数 | 含义 |
| --- | --- |
| `appType` | 目标应用 ID |
| `formUuid` | 自动化绑定的真实表单 ID |
| `flowName` | 新建自动化名称 |
| `processCode` | 已有逻辑流 ID，从查询结果取得 |

`update` 用创建时保存的完整记录核对原配置，再修改指定内容；原记录缺失或远端已变更时停止写入，详见 [修改已有自动化](references/operations.md#修改已有自动化)。创建选项、参数默认值及完整示例见 [CLI 选项与示例](references/cli-options.md)；多节点 JSON 见 [spec 编排示例](references/spec-authoring.md)；批量节点见 [批量数据示例](references/batch-data.md)。

## 节点选择

| 类别 | 自动化当前可直接配置 | 差异或限制 |
| --- | --- | --- |
| 发起/触发 | 表单事件、流程完成或节点事件、定时 | 定时使用 spec schedule；不设置发起页字段权限；当前不创建应用或卡片触发 |
| 人工处理 | 无审批、办理、抄送人工节点 | 需要审批时用 `initiateApproval` 发起目标流程，在目标流程中配置审批人 |
| 流转控制 | `route/parallel/cycle` | 循环目前为单层，格式见 [流转控制](../yida-flow-node-config/references/control.md) |
| 数据操作 | `getSelf/dataRetrieve/dataCreate/dataUpdate`，含批量取数/新增 | 当前 spec 不支持删除；流程表单新增用发起审批 |
| 通知 | `sendMessage`，成员/角色/成员字段 | 当前 spec 不支持邮件或卡片 |
| 扩展执行 | `connector/initiateApproval` | 连接器需发现真实 action schema；当前 spec 不支持代码或 AI |

平台设计器有该节点，不代表当前 CLI 的 spec 支持。不要把流程的原生 props 放入自动化 spec，也不要把尚未封装的节点当作可任意透传。

## 基本步骤

1. 确认目标应用、触发表单、真实字段与触发时机；已有资源复用，不编造 `formUuid/fieldId`。
2. 从通用节点 Skill 选取所需配置。简单通知可用命令选项，多节点、角色通知和批量数据优先使用 `--spec`。
   配置公式前通过 `use_skill` 加载 `yida-formula`，按其中的易错点提示配置：取数条件明确左侧目标字段、右侧来源和操作符；节点公式同时保留执行文本、编辑器原文和显示文字，引用仅来自允许的上游节点。
3. 用结构化文件写入工具创建 `<projectRoot>/.cache/openyida/<任务名>/integration/spec.json`，不要用 shell heredoc、重定向或写到仓库根目录。
4. 展示触发条件、节点、通知对象和目标写入范围，按上方严格要求获得用户明确同意后创建或发布。默认保存草稿，`--publish` 才启用。
5. CLI 在首个远端写入前验证 spec、连接器 schema 和字段，然后创建绑定、保存双 JSON，并按需要发布和回读。
6. 将返回的 `processCode` 等真实 ID 记入 `<projectRoot>/.cache/<项目名>-schema.json`；按 CLI 返回的验证等级报告结果。

```bash
openyida integration create <appType> <formUuid> <flowName> --spec <specFile> [--publish]
# 整图替换仅在已明确授权时使用
openyida integration create APP_XXX FORM_XXX "替换已有自动化" --process-code LPROC-XXX --replace --spec <specFile>
```

需要 spec 外层、公式展示字段或安全凭据绑定时，按上方链接读取 spec 编排示例。

## 最小 spec 与触发设置

```json
{
  "events": ["insert"],
  "nodes": [
    {
      "type":"sendMessage",
      "title":"新的申请",
      "content":"请查看申请详情",
      "toRoles":[{"roleCode":"<真实角色ID>","roleName":"财务"}]
    }
  ]
}
```

表单事件、流程事件、指定字段变化与定时的完整配置统一见 [触发设置](references/triggers.md)。自动化“发起审批”的发起人，与目标流程审批角色分别配置。

需要 `systemToken` 的连接器节点使用安全绑定片段，实际凭据由 CLI 读取，不能放进 `assignments`、命令文本或页面源码：

```json
{
  "secretBindings": [
    { "target": "body.systemToken", "provider": "yidaSystemToken", "appType": "<真实目标appType>" }
  ]
}
```

将片段放在 connector 节点内；完整连接器及安全绑定示例见上方 spec 编排说明。

## 已有自动化的维护

更新先预览；启停、查日志、异常监听和复制等操作见 [维护与运行排查](references/operations.md)。先查询唯一目标，再按任务操作并回读。

[CLI 选项](references/cli-options.md) 用于查参数；[spec 编排](references/spec-authoring.md) 说明文件外层、保存顺序和验证结果；[批量数据示例](references/batch-data.md) 说明多行数据的组合用法。[节点结构参考](references/integration-node-schemas.md) 仅在排查底层参数时读取，完整场景可参考 [创建示例](references/examples.md)。

## 验证与异常

发布成功要求列表中 `formUuid + processCode` 唯一匹配、状态为 `y`，且详情非空；返回 `verificationLevel=PLATFORM_LIST_EXACT_DETAIL_PRESENT`。角色、批量节点、赋值等已启用的投影校验也必须通过。此等级不证明完整运行图已回读，不能据此解锁 `integration update`。

| 结果 | 处理 |
| --- | --- |
| `INTEGRATION_FULL_REPLACEMENT_REQUIRES_REPLACE` | 已获得整图替换确认时，补 `--replace` 重试一次；未授权先展示替换摘要 |
| `INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED` / `INTEGRATION_CONNECTOR_ACTION_NOT_FOUND` | 停止；需要平台只读发现或固定已证 preset，不能用 `--connector-inputs` 自行声明参数 |
| `INTEGRATION_CONNECTOR_REQUIRED_INPUT_MISSING` / `INTEGRATION_CONNECTOR_ASSIGNMENT_*` | 按真实 schema 修正参数，不绕过校验 |
| `INTEGRATION_PUBLISH_READBACK_UNVERIFIED` / `INTEGRATION_READBACK_*` | 报告未验证，保留资源，不将写响应当作成功 |
| 写入超时或结果未知 | 先只读核对状态，不能直接重试新增/更新 |
| 参数缺失、节点结构错误 | 停止，展示错误详情；从已有查询补齐真实参数，无法确定时询问用户，不猜测 |
| 登录态失效或权限不足 | 停止，运行 `openyida auth status` 核对；刷新失败时按 CLI 提示重新登录 |
| 未知错误 | 保留完整错误与资源 ID，停止；先只读核对是否已写入，再决定后续处理 |
| 权益不足 | 保留服务端错误；有明确依据才说明所需版本、权益包或官方购买入口 |

安全更新、保存顺序、输出口径和运行验收限制见 [spec 编排的保存与验证规则](references/spec-authoring.md#保存与验证规则)。`PLATFORM_PROBE_REQUIRED` 时必须保持 `remoteWrites=0`，保留 probe artifact 和 blocker；仅有列表或详情存在性不足以解锁更新，也不得降级为通用 JSON Patch。

连接器凭据只由 CLI 安全绑定，不写入页面、普通赋值或命令文本。保存或启用成功只证明控制面配置；`runtimeVerified=false` 时不能宣称连接器已执行或通知已送达。需要运行验收时再按授权范围触发并独立读回，不把本地测试当作运行证据。
