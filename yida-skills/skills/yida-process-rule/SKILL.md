---
name: yida-process-rule
description: 配置已有宜搭流程的节点、分支、人员、字段权限、跳转规则、操作按钮及官方组件高级透传；共用节点参数按需加载 yida-flow-node-config。
---

# 流程规则配置

本技能负责已有流程的读取、完整定义、保存发布和结果核对。目标不明时先只读确认或询问用户；使用前必须按以下门槛确定目标和操作入口。

## Resource-First 使用门槛

本技能是已有流程／表单上下文的默认流程修改入口，必须遵守以下限制：

- 已有流程表单、`processCode`、流程 URL、已绑定流程或可确认的 workflow form 时，审批节点、条件分支、字段权限、抄送、跳转规则等配置默认使用本技能；不得另建同类流程表单。
- 已有普通表单 `formUuid`，用户要求“配置审批／转为审批流程”时，先确认是否对该表单启用流程。只有尚无流程且已确认转流程时，才由 `yida-create-process --formUuid` 复用该表单；已有流程则继续使用本技能，不得新建同名表单。
- 只有没有目标表单／流程，且用户明确要求从零创建审批系统时，才改用 `yida-create-process` 新建；目标不明不能作为新建理由。
- 多个流程候选按根技能的资源来源优先级选择；同级冲突或仍无法确定目标时，必须先询问用户，目标确认前不得写入。

## 严格禁止 (NEVER DO)

- 已有表单的字段 ID 从 `yida-get-schema` 获取；新建表单由 `yida-create-process` 按字段定义校验 `@label`，创建后绑定真实 ID。
- 不要在未加载本技能内容的情况下编写流程定义 JSON，格式复杂且易出错。
- 不要用此技能创建流程表单，应使用 `yida-create-process`。
- 不要用 shell heredoc、`cat`/`echo`/`printf`/`tee` 或重定向生成流程定义 JSON。
- 已有 process/form context 时不要新建同类流程表单；在原流程上配置或更新。
- 不要把 `configure-process` 当作局部 patch；它会替换完整流程图。已有 PUBLISHED 流程或 SAVED 草稿时，未获得用户对替换摘要的明确确认，不得传 `--replace`。
- `NON_IDEMPOTENT_RESULT_UNKNOWN` 或 `PUBLISHED_UNVERIFIED` 后不得自动重试 draft/save/publish；先只读核对平台状态。

## 严格要求 (MUST DO)

- **发布前必须确认**：执行流程发布操作前，必须向用户展示流程配置摘要（节点数、审批人、条件分支），获得用户明确同意后再发布。
- 字段 ≥ 3 且审批节点 ≥ 2 时，必须为每个节点配置字段权限。
- 存在回退/循环流转语义时，必须配置 `routeRules` 跳转规则。
- 根据需求生成流程定义时，必须阅读并遵守 [AI 自动生成流程规范](references/process-ai-rules.md)；达到上述字段和节点数量时，`behaviorList` 必须覆盖所有字段，未明确归属的字段默认只读。
- 嵌套条件分支不超过 3 层；超过时拆分流程结构，不得省略条件。条件分支由 CLI 补“其他情况”默认分支，不手写猜测底层 `conditionNode`。
- 流程必须先保存再发布，由 CLI 按顺序执行。本技能不读写 memory，资源 ID 以真实命令返回与当前平台查询为准。
- 配置已有表单前，用 `yida-get-schema` 获取全部字段 ID 和子表路径；新建表单按 `yida-create-process` 的字段准备顺序执行，创建后复用其字段回执。
- 流程定义 JSON 必须用结构化文件写入工具创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/`；不要写仓库根目录、系统临时目录或 `.cache/` 顶层。
- 必须以表单 binding 只读结果证明 `processCode` 属于目标 `formUuid`；`CONFIGURE_PROCESS_OWNERSHIP_UNVERIFIED` 时停止，不得换一个 `processCode` 猜测重试。
- 命令成功必须同时返回 `verificationLevel: "PLATFORM_VIEW_VERIFIED"` 和 `platformViewVerified: true`；它证明平台可见 view 的节点、条件、审批模式、字段和操作权限通过比对。实际流转验收使用已授权的少量申请，核对真实审批任务；数字分支覆盖零值和阈值边界，配置回读与运行结果分别记录。

## 节点选择

配置节点时加载 `use_skill("yida-flow-node-config", "流程；所需节点类别或配置项")`，只读取任务需要的参考。

| 类别 | 流程中的节点 | 本入口保留的差异 |
| --- | --- | --- |
| 发起 | 自动生成的 ApplyNode | 字段权限用顶层 `startFormConfig`；谁能发起用 START 权限组 |
| 人工处理 | `approval`、`operator`、`multiApproval`、`carbon` | 审批用 `approver`，办理用 `executor`，抄送用 `receiver` |
| 流转控制 | `route`、`parallel`、循环 | 条件/并行可直接生成；循环需已有真实配置 |
| 数据操作 | 查询、新增、更新、删除 | 流程内采用原生组件配置，不接收自动化 spec |
| 通知 | 消息、邮件、卡片 | 消息可按通用说明生成；邮件/卡片需已有真实配置 |
| 扩展执行 | 连接器、子流程、代码、AI | 使用真实节点配置；不得猜测动作、输入输出结构 |

“可直接生成配置”指 CLI 有已明确的输入契约；“需要已有真实配置才能透传”只说明编译器可接收该结构，不代表能从一句需求补齐全部参数。按金额等条件选择审批人、办理人或抄送人，统一读取 [人员选择](../yida-flow-node-config/references/actors.md#按条件选人)。同一节点选谁处理，与改变处理路线的条件分支分别配置。

## 基本步骤

本轮已确认“临时本人审批 → seed 核验 → 编辑 → 最终发布”时，在原表单上编辑完整最终定义，并复用该范围的发布与替换授权。阶段回执与恢复见[流程 seed 编排](../yida-data-management/references/process-seed-workflow.md)。

涉及原生校验、业务关联或节点公式时，先通过 `use_skill` 加载 `yida-formula`，查看“写配置前先处理这些易错点”。校验保留原文、预处理内容、提示和阻断设置；节点表达式保留真实上游引用及编辑器内容。普通字段取值公式仍通过表单配置处理；当前简化 DSL 没有覆盖的全局规则或节点属性，沿用已读取的真实配置及明确支持的入口。

1. 确认目标 `appType/formUuid` 和当前流程 binding，证明 `processCode` 属于该表单；不猜测 ID。
2. 字段 ID 由 `yida-get-schema` 获取。配置字段权限或诊断字段来源时，先执行 `process fields`。
3. 按需读取通用节点说明，组织完整的 `nodes` 与分支；保留未修改部分。字段 ≥ 3 且审批节点 ≥ 2 时，为每个处理节点配置字段权限。
4. 用结构化文件写入工具创建 `<projectRoot>/.cache/openyida/<任务名>/process-definition.json`。不要用 shell heredoc 或重定向生成配置。
5. 展示节点、处理人、条件、字段权限及替换范围，按上方严格要求获得用户明确同意后执行。CLI 负责本地编译、保存、发布和平台 view 回读。
6. 保存真实资源 ID 与返回的验证等级。配置回读通过不代表实际审批、字段编辑或通知送达已验证。

```bash
openyida process fields <appType> <formUuid> --json
openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode] [--replace]
```

文件路径按实际 project 根目录解析。已有流程不要通过更换 `processCode` 绕过归属或替换检查。

## 命令参数与输出

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `appType` | 是 | 目标应用 ID |
| `formUuid` | 是 | 目标流程表单 UUID |
| `processDefinitionFile` | 是 | 完整流程定义 JSON 文件路径 |
| `processCode` | 否 | 流程 Code；不传时 CLI 从目标表单 binding 获取，仍须验证归属 |
| `--replace` | 条件必填 | 已有 PUBLISHED 流程或 SAVED 草稿时，须先获得整图替换确认；未确认时零写入退出 |

```bash
openyida configure-process APP_XXX FORM_XXX .cache/openyida/order/process-definition.json
```

示例中的 ID 使用查询结果替换。上方路径从 OpenYida project 工作目录执行；从 workspace 根执行时加 `project/` 前缀。执行前确认有效 token session；Node.js 版本按 OpenYida 包要求（当前 ≥ 18）。

日志写入 stderr，JSON 结果写入 stdout。成功结果示例：

```json
{
  "success": true,
  "processCode": "TPROC--XXX",
  "processId": "83145794990",
  "processVersion": 2,
  "appType": "APP_XXX",
  "formUuid": "FORM_XXX",
  "verificationLevel": "PLATFORM_VIEW_VERIFIED",
  "platformViewVerified": true
}
```

## 最小定义与发起设置

CLI 自动生成发起和结束节点；`nodes` 只写中间节点，不添加 `start/end`。

```json
{
  "startFormConfig": {
    "behaviorList": [
      {"fieldId":"<真实申请说明字段ID>","fieldBehavior":"NORMAL"},
      {"fieldId":"<真实成本字段ID>","fieldBehavior":"HIDDEN"}
    ]
  },
  "nodes": [
    {"type":"approval","name":"负责人审批","approver":"originator"}
  ]
}
```

发起、审批、办理等节点的字段权限共用 `NORMAL/READONLY/HIDDEN`；具体位置与子表规则统一见 `use_skill("yida-flow-node-config", "字段权限")`。控制谁能发起时，查询 `get-permission --package-type FORM_PACKAGE_START`，再交给 `yida-form-permission`。

## 结果与异常

成功需同时返回 `verificationLevel: "PLATFORM_VIEW_VERIFIED"` 和 `platformViewVerified: true`，这只证明平台 view 与本次目标配置匹配，不代表完整运行定义已独立回读。

配置前必须取得真实字段、人员和条件信息；保存失败时只读核对 binding、版本及登录态，字段或分支错误按对应参考修正，不能猜 ID。发布未生效时核对保存和发布阶段与流程版本，结果未知时不得重放写入。

| 结果 | 处理 |
| --- | --- |
| `CONFIGURE_PROCESS_REPLACE_REQUIRED` | 未获得整图替换授权时先展示摘要；已授权后补 `--replace` |
| `CONFIGURE_PROCESS_OWNERSHIP_UNVERIFIED` | 只读核对表单 binding，停止写入 |
| `PROCESS_PERMISSION_FIELD_NOT_FOUND` / 字段来源错误 | 修正真实字段或绑定，不覆盖表单 |
| `PROCESS_PLATFORM_VIEW_*_MISMATCH` | 保留已返回资源，报告配置未验证 |
| `NON_IDEMPOTENT_RESULT_UNKNOWN` / `PUBLISHED_UNVERIFIED` | 先只读核对平台状态，不自动重试保存或发布 |
| 权益不足 | 保留平台错误；根据明确提示说明所需版本或权益包，不修改权益 |

普通指定角色不需要配置权限矩阵。涉及矩阵时，先按 `yida-form-permission` 的 CLI 步骤检查可用性；其他配置按 CLI 返回处理，明确提示权益不足时再引导开通。

需要完整业务流程示例时读 [流程示例](references/examples.md)；配置官方组件时读 [高级透传规则与节点示例](references/official-component-nodes.md)。根据需求生成流程时必须遵守上方严格要求和 [生成规则](references/process-ai-rules.md)。新建流程仍由 `yida-create-process` 编排，本技能不创建应用或维护数据记录。

## 与其他技能配合

| 需要处理的资源 | 使用方式 |
| --- | --- |
| 应用 | 复用已解析的 `appType`；仅无应用且用户允许创建时使用 `yida-create-app` |
| 表单 | 复用已解析的 `formUuid`；普通表单字段由 `yida-create-form-page` 维护，首次转流程按使用门槛调用 `yida-create-process --formUuid` |
| 流程规则 | 已有流程使用本技能；`yida-create-process` 完成后仍可回到本技能补充复杂规则 |
| 自定义页面 | 用户需要时才用 `yida-canvas-custom-page` 编写或更新源码，再用 `yida-publish-page` 发布 |

从零创建流程表单通过 `yida-create-process` 一次调用完成表单与流程；已有资源按上方入口复用。
