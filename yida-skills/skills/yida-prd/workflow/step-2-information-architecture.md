# Step 2：规划页面和导航

> 先画功能结构，再定页面。宜搭里优先使用平台导航、原生表单和流程能力，自定义页面负责体验入口和信息展示。

## 确定应用入口

1. 首页/入口页：官网首页、工作台、经营驾驶舱或其他入口。
2. 页面清单：每个页面写清 scene、目标用户、主任务和需要设计的区块；工作台、首页、门户、看板、展示页和业务入口页推荐显式列出 8-10 个 `contentBlocks` 以上，但不作为硬性门槛。
3. 导航分组：按角色路径和业务主次分组，门面页靠前，数据录入/配置类页面靠后。
4. 表单/流程关系：录入、审批、权限、校验交给原生表单和流程。

## 列资源清单

完整应用要输出页面与表单资源清单，便于 `yida-app` 后续创建或复用资源。

### 列页面资源

| 页面 | resourceType | scene | 用途 | 实现链路 |
| --- | --- | --- | --- | --- |
| 主页 / 首页 / 工作台 | `display-page` | `workbench/dashboard/landing` | 应用第一入口、指标概览、快捷入口 | 自定义页面 |
| 表单数据管理页 | `normal-form` | `native-list` | 查询、筛选、查看、编辑和维护 | 宜搭表单数据管理页（默认） |
| 自定义列表页 | `display-page` | `list` | 用户明确要求自定义列表页 | 自定义页面 |
| 详情页 | `display-page` | `detail` | 单对象信息总览、时间线、关联对象 | 自定义页面 |
| 数据大屏 / 看板 | `display-page` 或报表 | `screen/dashboard` | 指标监控、经营分析、投屏展示 | Canvas / Recharts / 报表 |

### 列表单资源

| 表单 | formKind | 用途 | 字段口径 |
| --- | --- | --- | --- |
| 普通数据表单 | `normal-form` | 数据录入、编辑、查询、列表数据源 | 字段名、字段类型、必填、默认值、Divider 分组 |
| 流程表单 | `process-form` | 审批、流转、节点处理 | 表单字段 + 流程节点、审批人、流转条件 |

资源清单使用业务语义和资源类型；`appType/corpId/baseUrl` 写入 PRD 的应用配置，`formUuid`、`fieldId`、`processCode` 等细节 ID 由实现阶段写入 `.cache/<项目名>-schema.json`。

同一业务对象默认使用普通表单的数据管理页；用户明确要求时才增加自定义列表页。

## 给页面标场景

页面 `scene` 只作为分类标签和实现提示，不作为固定页面样式。页面结构必须来自当前业务目标、用户任务、资源关系和后续 `design.md`。

| 页面场景 | 适用判断 | 结构来源 |
| --- | --- | --- |
| workbench | 进入应用后处理任务、看状态、做高频动作 | 当前业务 `contentBlocks` + `design.md.visualScaffold` |
| dashboard | 经营分析、指标判断、趋势和排行 | 指标口径 + 图表目的 + `design.md.visualScaffold` |
| screen | 投屏、监控、态势感知 | 实时信息层级 + 大屏展示目标 + `design.md.visualScaffold` |
| list | 用户明确要求的自定义列表 | 数据字段、筛选、操作路径 + `design.md.visualScaffold` |
| detail | 单对象总览、时间线、关联对象 | 对象信息架构 + 关联关系 + `design.md.visualScaffold` |
| landing | 对外介绍、品牌表达、价值转化 | 价值路径、素材清单、CTA + `design.md.visualScaffold` |
| split-pane | 左列表右详情、处理台 | 主从关系、处理路径 + `design.md.visualScaffold` |

## 排导航顺序

先分清两件事：

| 概念 | 控制位置 | 典型信号 | 设计输出 |
| --- | --- | --- | --- |
| 应用导航隐藏 | 应用基础设置 `hideAppNav='y'` | 自绘应用级顶部/侧边/导航壳，或明确隐藏应用导航 | 写 `appBlueprint.hideAppNav: 'y'`，实现阶段用 `yida-nav-shell` |
| 页面导航隐藏 | 页面配置 `isRenderNav=false` | 页面全屏、无导航、独立分享页 | 只写页面级隐藏，不自动写 `hideAppNav` |

默认规则：

- 默认保留平台应用导航。
- 页面内 tab、分段、筛选、卡片切换只是当前页内容结构。
- 只说「工作台 / 门户 / 看板 / 大屏 / 首页」不是隐藏导航信号。
- 同应用跨页面入口优先进入平台导航或导航分组。

必须避免：

- 不要因为“看板 / 门户 / 首页”自动隐藏应用导航。
- 不要用 `isRenderNav=false` 代替 `hideAppNav`。
- 不要让平台应用导航和自绘应用级导航同时出现。

## 产出

```markdown
- appBlueprint：<应用目标、角色、页面清单、导航分组>
- resourceBlueprint：<pages: name/resourceType/scene/purpose；forms: name/formKind/fields/process>
- 页面场景：<scene + 判定依据>
- 页面区块 / contentBlocks：<工作台、首页、门户、看板、展示页和业务入口页推荐逐条列出 8-10 个区块以上；KPI 组和快捷入口组各只算 1 个区块>
- 页面关系：<上一层入口、下钻目标、原生表单/流程关系>
```

## 下一步

→ [PRD 输出格式](output-prd.md)
