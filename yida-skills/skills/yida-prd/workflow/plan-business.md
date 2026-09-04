# Plan：生成业务规划

## 目的

按 [统一 PRD 契约](output-prd.md) 将需求事实写入 `build-plan.json` 的业务部分。

## 输入

PRD 规划前必须已确定应用导航类型；读取 brief 的 `navigation.type/source/reason`，按该决策组织整个应用的资源与页面入口。

- Step 2 输出的确认上下文，以及 `visualDirection`、`selectedTheme`、`colorStrategy`、`navigationStyle` 四组已选视觉事实。
- [build-plan-compact-schema.md](../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md)。
- [build-plan-content.md](../references/plan-content.md)。
- [page-patterns.md](../../yida-design/sub_skill/yida-design-plan/references/page-patterns.md)。

## 操作

### 1. 按业务依赖生成计划

严格按以下依赖顺序生成，不从页面或视觉倒推业务：

```text
业务目标 → 业务对象 → 数据模型 → 业务流程 → 用户任务 → 页面规划
```

读取共享需求文件，在 `yida-app` 建立的 `schemaVersion: "2.0"` 计划中写入需求总览、完整数据模型、业务流程、页面业务差异与 `execution`。元信息和确认由 `yida-app` 维护，`visualStyle` 由 `yida-design` 维护。

与基础视觉设计并行准备业务事实；页面任务、区块和 sceneKey 确定后立即交接。业务事实以独立片段返回，由编排合并写入计划。

以下内容由 CLI 从事实、索引和模板派生：

- `overview` 中的数据模型、流程、页面和视觉摘要副本。
- 页面模式的 `mode`、`mustKeep`、固定 `rich-but-relevant` 和全局防填充规则。
- 已选主题的标签、模板路径、默认画像和候选视觉方向副本。
- 组件、状态、响应式、质量门禁等完整主题模板已有的标准表达。
- 页面应用中的主题标准表达；每页只写与 PRD 真实内容匹配的视觉记忆点绑定。

以上字段由 `openyida design-plan materialize` 在内存中补齐，源 JSON 不回填派生副本。

### 2. 独立规划每个页面

每个自定义页面先确定：

- 页面定位、核心用户和核心任务。
- 内容优先级、功能区块、首屏结构和标志性交互。
- `rich-but-relevant` 内容丰富度：覆盖适用的决策、主任务、上下文、异常和承接层，不用无业务价值的 KPI、图表、卡片或占位文案凑内容。
- 信息密度和权限摘要。

完成页面结构需求后，再匹配页面模式：

- `preset`：核心任务和交互骨架与某个预设强匹配。
- `adapted`：核心任务匹配，但必须记录项目化 `adaptations`。
- `custom`：没有明显强匹配，使用 `custom-page-pattern`。

页面模式只决定信息组织和交互骨架，不决定主题色、圆角、阴影或品牌表达。核心任务明显不同的多个页面若使用同一预设，必须重新检查。

### 3. 完成业务校验

- 字段、关系、流程节点与规则、角色权限、页面入口和交互状态覆盖已确认范围。
- 已知业务规则写入对应 `businessFlows[].rules`，明确条件和执行结果；维护已有计划时，将摘要中的独立规则补入对应明细，保持 HTML 与 PRD 的业务要求一致。
- 每页写清页面任务、场景、区块、数据来源和主操作，三种顺序分别规划。
- 视觉规则仅通过设计引用交接，不复制到业务事实。
- 将业务事实交给 `yida-app` 统一维护 revision 和草稿状态；视觉一致性由 `yida-design` 校验。
- 完成源 JSON 后，由编排调用 CLI 生成 `prd.md`、`design.md` 和 HTML。

## 输出

- `prd/<项目名>/build-plan.json` 完整草稿。
- 可供视觉设计和应用编排使用的页面规划、模式和业务执行契约。

## 检查清单

- [ ] 业务、数据、流程、任务、页面按依赖顺序生成。
- [ ] 每个自定义页面都有核心任务、首屏结构、内容丰富度和信息密度。
- [ ] 页面模式是 `preset / adapted / custom` 之一。
- [ ] `adapted` 有非空改造项，`custom` 说明了自定义结构。
- [ ] 页面规划没有被视觉候选或模板反向决定。
- [ ] JSON 已成为唯一事实源并写入新 revision，且 `schemaVersion=2.0`。
- [ ] 业务字段、流程规则、页面任务、项目适配和视觉记忆点绑定没有因为压缩而删除。
- [ ] JSON 没有复制主题标准规则、页面预设标准或可派生摘要。

## 与 Fast 一致的业务交接

每页明确 `scene`、`sceneKey`（原样保留 brief 的 pageScenes key）、`pageStructure`、`entryMode`、`dataBinding` 和 `primaryAction`。平台导航的 `entryMode` 默认 `platform-shell`，自定义导航为 `standalone`，不能填 workbench；`scene` 与页面模式 ID 分开。三种顺序、资源蓝图、示例数据计划、交互状态和验收写入 `execution`，由 CLI 生成对应章节。

`execution` 可写 `appConfig`（真实已知应用信息）、`resourceBlueprint`、`resourceCreationOrder`、`pageImplementationOrder`、`navigationOrder`、`navigationFallback`、`sampleDataPlan`、`interactionStates` 和 `acceptanceCriteria`；`appConfig.navigationType` 按 [导航类型契约](output-prd.md#导航类型与执行配置) 明确填写，决定 `layoutDirection/hideAppNav`；`navTheme/logoSource` 取视觉事实。CLI 派生逐页 `pageNavigation`，供实现阶段执行隐藏与回读。

### 可执行的业务细项

- 每个普通表单提供 1–3 条 `sampleRecords`（业务字段名与具体值），或明确 `skipSampleReason`。执行级覆盖使用 `sampleDataPlan` 数组：`{form, records}` 或 `{form, skipReason}`。允许跳过的范围沿用统一 PRD 契约。
- 每页 `dataBinding` 明确为 form/report/connector/static-empty；前三者写来源名称数组 `dataSources`，form 必须对应数据模型；空态明确 `emptyReason`。不把遗漏来源当作空态规划。
- `pageSpecHandoff` 可逐项补充 scene、pageStructure、entryMode、contentBlocks、dataSources、dataBinding、emptyReason、primaryAction、themeSummary、designFile、designRefs。引用必须存在于最终设计文档。
- 资源蓝图、资源创建顺序和页面实现顺序必须覆盖业务事实；显式 `acceptanceCriteria` 不能为空。
- 资源蓝图 `type` 使用 `normal-form/process-form/display-page/report`，名称唯一；表单类型与数据模型一致，自定义页面对应页面定义，填写 `pageId` 时也须一致。自定义导航的隐藏清单由完整表单、页面及额外报表派生。
