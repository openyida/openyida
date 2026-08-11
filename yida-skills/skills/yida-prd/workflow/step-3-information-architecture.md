# Step 3：规划页面和导航

> 先画功能结构，再定页面。宜搭里优先使用平台导航、原生表单和流程能力，自定义页面负责体验入口和信息展示。

## 确定应用入口

1. 首页/入口页：官网首页、工作台、经营驾驶舱或其他入口。
2. 页面清单：用户明确列出页面时，按用户清单生成，不新增同级 display 页面；用户没有明确页面时，按业务目标、角色任务和资源关系推导必要页面。
3. 内容区块：每个页面写清 scene、目标用户、主任务和需要设计的区块。`contentBlocks` 数量由页面任务和 PRD 范围决定，工作台、首页、门户、看板、展示页和业务入口页默认要有足够支撑首屏判断和操作的业务区块，但不得为了凑数增加 PRD 没有的功能。
4. 导航分组：按角色路径和业务主次分组，门面页靠前，数据录入/配置类页面靠后。
5. 表单/流程关系：录入、审批、权限、校验交给原生表单和流程。

## 列资源清单

完整应用要输出页面与表单资源清单，便于 `yida-app` 后续创建或复用资源。

### 列页面资源

| resourceKey | 页面 | resourceType | scene | 用途 | 页面链路 |
| --- | --- | --- | --- | --- | --- |
| `home` | 主页 / 首页 / 工作台 | `display-page` | `workbench/dashboard/landing` | 应用第一入口、指标概览、快捷入口 | 默认 Code Canvas |
| `management_list` | 管理列表页 | `display-page` | `list` | 查询、筛选、批量操作、详情入口 | 默认 Code Canvas |
| `detail` | 详情页 | `display-page` | `detail` | 单对象信息总览、时间线、关联对象 | 默认 Code Canvas |
| `dashboard` | 数据大屏 / 看板 | `display-page` 或报表 | `screen/dashboard` | 指标监控、经营分析、投屏展示 | Canvas / Recharts / 报表 |

### 列表单资源

| resourceKey | 表单 | formKind | 用途 | 字段口径 |
| --- | --- | --- | --- | --- |
| `data_form` | 普通数据表单 | `normal-form` | 数据录入、编辑、查询、列表数据源 | 字段名、字段类型、必填、默认值、Divider 分组 |
| `approval_process` | 流程表单 | `process-form` | 审批、流转、节点处理 | 表单字段 + 流程节点、审批人、流转条件 |

每个资源使用唯一 `resourceKey`。`appType/corpId/baseUrl` 写入 PRD 的应用配置，`formUuid`、`fieldId`、`processCode` 等真实 ID 由实现阶段按 `resourceKey` 写入 `.cache/<项目名>-schema.json`。

## 给页面标场景

页面 `scene` 只作为分类标签和实现提示，不作为页面模板。页面结构必须来自当前业务目标、用户任务、用户明确页面范围、资源关系和后续 `design.md`。

| 页面场景 | 适用判断 | 结构来源 |
| --- | --- | --- |
| workbench | 进入应用后处理任务、看状态、做高频动作 | 当前业务 `contentBlocks` + `design.md.visualScaffold` |
| dashboard | 经营分析、指标判断、趋势和排行 | 指标口径 + 图表目的 + `design.md.visualScaffold` |
| screen | 投屏、监控、态势感知 | 实时信息层级 + 大屏展示目标 + `design.md.visualScaffold` |
| list | 查询、筛选、批量操作、详情入口 | 数据字段、筛选条件、操作路径 + `design.md.visualScaffold` |
| detail | 单对象总览、时间线、关联对象 | 对象信息架构 + 关联关系 + `design.md.visualScaffold` |
| landing | 对外介绍、品牌表达、价值转化 | 价值路径、素材清单、CTA + `design.md.visualScaffold` |
| split-pane | 左列表右详情、处理台 | 主从关系、处理路径 + `design.md.visualScaffold` |

## 排导航顺序

- 默认保留平台应用导航。
- 默认自定义页**保留平台应用导航**。
- 页面内 tab / 分段导航 / 自绘导航记录为当前页内容结构，同时保持平台导航可见。
- 页面内 tab、自绘侧边栏或独立门户壳写 `appBlueprint.hasPageNavigation: true`，同时保持平台导航可见。
- 仅说「工作台 / 门户 / 看板 / 大屏 / 首页」时，优先解释为平台导航下的当前页面体验。
- 显式要求隐藏平台导航、无导航、全屏无框或独立分享页时，设置隐藏导航分支。
- 快捷入口目标是同应用内页面时，优先进入平台导航或导航分组。

## 产出

```markdown
- appBlueprint：<应用目标、角色、页面清单、导航分组>
- resourceBlueprint：<pages: resourceKey/name/resourceType/scene/purpose；forms: resourceKey/name/formKind/fields/process>
- 页面场景：<scene + 判定依据>
- 页面区块 / contentBlocks：<逐条列出当前页面真实需要的区块；KPI 组和快捷入口组各只算 1 个区块；少于默认丰富度时说明该页面是窄场景或用户范围已限定>
- 页面关系：<上一层入口、下钻目标、原生表单/流程关系>
```

## 下一步

→ [PRD 输出格式](output-prd.md)
