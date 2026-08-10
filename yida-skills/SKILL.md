---
name: openyida
description: >
  OpenYida / 宜搭总入口。先检查登录和目标资源，再判断是完整应用还是单项任务。
  完整应用加载 yida-app；单项任务加载对应子技能。
  只在用户要操作宜搭资源时使用；通用代码问题不要触发。
---

# OpenYida

使用 `openyida` CLI 创建、查询或修改宜搭资源。

## 第一步：检查环境和登录

先执行：

```bash
openyida agent-capabilities --summary-json
```

| 结果 | 动作 |
|------|------|
| `login.status=ok` 或 `login.can_auto_use=true` | 继续 |
| 返回环境注入 token 模式，但 token 缺失 | 请运行环境注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN` |
| 普通 OAuth token 未登录 | 执行 `openyida login`，再检查一次 |
| `workdir_exists=false` | 执行 `openyida copy` |
| 没有 `agent-capabilities` 命令 | 执行 `openyida env --json` 和 `openyida login --check-only --json` |

`openyida agent-capabilities --json` 返回完整命令信息，只在排查命令或 manifest 时使用。`workdir` 对应完整输出中的 `active.projectRoot`。

登录异常时读取 [环境和登录](references/setup-and-env.md)。正常通过时继续下一步。

## 第二步：确认目标资源

`resolve_resource_context` 按以下顺序查找目标应用、页面、表单或流程：

1. 用户本轮提供的 `appType`、`formUuid`、URL 或流程 ID。
2. 当前工具注入的资源信息。
3. `project/config.json`、`.cache/<项目名>-schema.json` 和 `.cache/openyida/`。
4. 当前对话中已经确认的资源。

处理结果：

- 找到唯一目标 → 修改或补齐该资源。
- 用户明确要求新建且目标不存在 → 创建缺失资源。
- 同级候选冲突或目标不清楚 → 询问用户。
- 用户本轮指定的资源与已绑定资源不同时 → 以本轮指定资源为准。

`.cache/<项目名>-schema.json` 只提供本地线索。写操作前用 CLI 确认真实资源和 ID；不通过新建同类资源绕过不确定性。

## 第三步：判断任务类型

先完成全局预检和资源上下文解析，再选择任务类型。

| 用户要求 | 动作 |
|----------|------|
| 从零搭建应用、创建系统、补齐完整应用 | 加载子技能 `yida-app`，详细流程见 `yida-app` |
| 修改一个已有资源或完成一个独立操作 | 选定 **1 个**，加载对应子技能执行 |

完整应用默认使用 `yida-prd` 生成的 `prd/<项目名>/prd.md` 和 `yida-design` 生成的 `prd/<项目名>/design.md`。创建顺序、页面实现和最终输出见 `yida-app`。

## 第四步：选择子技能

先按任务选择一类，再从该类中选择一个主技能。

| 类别 | 用户要求 | 子技能 |
|------|----------|--------|
| 环境与查询 | 登录、退出、组织信息、Schema、fieldId、企业效能 | `yida-login`、`yida-logout`、`yida-basic-info`、`yida-get-schema`、`yida-corp-efficiency` |
| 应用 | 完整应用、应用壳、启停、导航、多语言 | `yida-app`、`yida-create-app`、`yida-app-lifecycle`、`yida-nav-group`、`yida-i18n` |
| 需求与设计 | 需求分析、PRD、视觉设计、主题 | `yida-requirement-analysis`、`yida-prd`、`yida-design` |
| 表单与数据 | 原生表单、公式、校验、业务规则、详情样式、批量录入、数据记录 | `yida-create-form-page`、`yida-formula`、`yida-formula-evaluate`、`yida-business-rule`、`yida-form-detail`、`yida-canvas-table-form`、`yida-table-form`、`yida-data-management` |
| 流程 | 新流程、流程规则、节点、分支、字段权限、流程代理 | `yida-create-process`、`yida-process-rule`、`yida-agent-center` |
| 自定义页面 | 页面容器、Code Canvas、旧 JSX、数据接入、迁移、发布、页面导航、幻灯片 | `yida-create-page`、`yida-canvas-custom-page`、`yida-custom-page`、`yida-canvas-data-binding`、`yida-canvas-upgrade`、`yida-publish-page`、`yida-openyida-publish-guard`、`yida-density`、`yida-nav-shell`、`yida-ppt-slider` |
| 报表与图表 | 原生报表、Recharts、旧 ECharts、经营看板 | `yida-report`、`yida-rechart`、`yida-chart`、`yida-dashboard` |
| 外部系统 | 连接器、连接器动作、普通页面数据源、集成自动化 | `yida-connector`、`yida-connector-safe-actions`、`yida-data-source-connectors`、`yida-integration` |
| 权限与分享 | 平台、应用、表单权限，页面公开和分享 | `yida-corp-manager`、`yida-app-permission`、`yida-form-permission`、`yida-page-config` |
| 运维与反馈 | Sequence、主键冲突、VOC | `yida-db-seq-fix`、`yida-voc` |
| 文档与工具 | 钉钉文档、听记、会议需求稿、导出对话、技能评测 | `yida-document-markdown`、`yida-tingji`、`yida-flash-note-to-prd`、`yida-export-conversation`、`yida-skill-evaluator` |

### 容易选错的任务

| 用户要求 | 使用 |
|----------|------|
| 只创建应用壳并取得 `appType` | `yida-create-app` |
| 创建或修改原生表单字段 | `yida-create-form-page`；表单布局和详情样式读取 `yida-form-detail` |
| 查询真实 `fieldId` | `yida-get-schema` |
| 新建自定义页面 | `yida-create-page` 创建本轮目标页面，`yida-canvas-custom-page` 实现页面，`yida-publish-page` 发布 |
| 修改 Code Canvas 页面 | `yida-canvas-custom-page` |
| 修改已有普通 JSX 页面 | `yida-custom-page` |
| 把旧 JSX 页面迁移到 Code Canvas | `yida-canvas-upgrade` |
| Code Canvas 页面接入真实数据 | `yida-canvas-data-binding` |
| 批量录入 | 默认 `yida-canvas-table-form`；已有普通 JSX 页面使用 `yida-table-form` |
| 普通统计或原生报表 | `yida-report` |
| 新建 Recharts 图表页 | `yida-rechart` |
| 修改已有 ECharts 普通页面 | `yida-chart` |
| 创建带审批的流程表单 | `yida-create-process` |
| 修改已有流程节点或规则 | `yida-process-rule` |
| 读取 taskUuid 对应的听记 | `yida-tingji` |
| 把已有听记或会议内容转成需求稿 | `yida-flash-note-to-prd` |

没有独立技能的聚合表、AI 审批提示、通用 AI 和批处理任务，分别使用 `openyida aggregate-table`、`openyida ai-form-setting`、`openyida ai` 和 `openyida batch`。

## 全局规则

1. 支持 `use_skill` 的工具用 `use_skill("<技能名>", "<当前任务>")` 加载技能；不支持时才读取对应 `skills/<技能名>/SKILL.md`。
2. 写操作前确认目标组织和 `corpId` 一致。
3. `appType`、`formUuid`、`fieldId` 和流程 ID 使用 CLI 返回的完整真实值，不手写、不缩短。
4. 输入 JSON、YAML、CSV 或脚本文件时，使用当前工具的文件编辑能力创建文件，再把路径交给 CLI。
5. 页面源码修改后必须成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`，才能说明线上页面已更新。
6. OpenYida 命令保留 stdout 和 stderr；同一命令失败后先修正登录、组织、参数或 ID，再重试。
7. 任务达到所选技能的完成条件后停止。完整应用的完成条件见 `yida-app`。

## 参考文件

| 文件 | 何时读取 |
|------|----------|
| [环境和登录](references/setup-and-env.md) | 环境或登录异常时 |
| [字段类型和 URL](references/field-and-url-reference.md) | 创建表单字段或拼接访问地址时 |
| [宜搭 API](references/yida-api.md) | 需要直接核对接口参数时 |
| [公式函数](references/formula-functions.md) | 编写表单公式时 |
| [查询条件](references/query-condition-guide.md) | 查询或筛选数据时 |
| [报表字段](references/report-field-config-guide.md) | 配置原生报表时 |
| [版本功能](references/edition-features-guide.md) | 判断版本能力时 |
| [模型 API](references/model-api.md) | 调用宜搭模型能力时 |
