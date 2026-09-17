# Plan：生成方案并确认

由 `yida-app` 在需求确认完成且选择 Plan 后进入。需求与选择明确后并行准备业务和视觉事实，统一生成产物；确认当前方案后进入资源创建。

## 当前待办名称

- 规划功能、页面和配色：设计功能和页面
- 生成方案并等待用户确认：确认搭建方案
- 方案确认后：读取同一 revision 的 `execution.explicitScope`，为其中非空的资源集合生成对应实施步骤，最后增加“检查范围并交付”
- `allowInferredResources=true` 的完整应用：按 `yida-app` 完整应用模版生成后续步骤
- `allowInferredResources=false` 的闭合范围：后续步骤总集等于确认方案中的资源步骤与交付步骤；每完成并回读一个资源，就从内部剩余集合中移除，用户待办保留并标记完成

沿用已有待办，不把下面的内部执行顺序另建成一份任务列表。

## 执行顺序

1. 直接复用已确认的 `requirement-brief.json`；若尚未完成 Step 2 的规划准备，先按 [交接契约](../../../yida-requirement-analysis/references/handoff.md#规划阶段补齐) 补齐页面承载、导航与主题，AI 建议保留来源，不重新询问业务或导航；本文件已经包含规划入口，不再额外读取 `step-1-understand.md` 或 `step-2-confirm.md`。
2. 主题映射未确定时，执行一次 `openyida design-plan catalog --json`，从返回的 `themes` 选择 themeId，并复用 `pagePatterns`。已有合法主题 ID 时直接初始化。初始化计划草稿，CLI 返回编写契约与当前主题的精简上下文：

   ```bash
   openyida design-plan init .cache/openyida/<项目名>/requirement-brief.json --theme-id <已选主题> --json
   ```
   `requirement-brief.json` 必须复用 `yida-requirement-analysis` 的输出结构，不要自行发明字段层级；`projectName` 位于 JSON 根级，`businessGoals` 等集合字段保持数组，命令第一次就传入 `visualSelection.themeId`。若 CLI 返回字段路径诊断，按 `expectedPath` 集中修正原文件后最多重试一次，不要通过反复更换项目名规避结构错误。

3. 执行 init 返回的 `parallelTasks`：普通标准首版只有一个业务规划任务；显式窄范围且表单字段已完整时，CLI 返回 `preparedInputs.businessReady=true` 和空任务列表，直接进入第 4 步，不再 Read/Edit business 或补规划。视觉方向来自需求，主题色和导航样式已在规划准备阶段补齐，CLI 将其预填到 `preparedInputs.visual`，并从主题模板确定性补齐页面标准视觉，不再启动“基础视觉 → 等待页面 → 逐页视觉绑定”两段模型任务。
4. init 已创建并预填 `business.json` 骨架；读取该文件及 `context` 中的类型示例，按 `authoring.pendingFields` 的文件和字段路径补齐内容，保留 `base` 与已有事实。复核需求覆盖后，将已完成片段设为 `ready=true`。`facts` 只允许 overview、dataModels、businessFlows、pages 和可选 execution，绝不写 `visualStyle`。同一次补齐所有普通表单的 sampleDataPlan（窄范围不造数时写 skipReason）及所有自定义页面的 permissionSummary，然后直接执行 init 返回的 `materialize.command`，只物化一次。标准首版禁止先试 `--from-preview`、`preview`、`--check` 或无参数 materialize；成功 JSON 已返回 HTML 路径和 revision，不再用 Glob、Read 或帮助命令检查产物。只有存在品牌稿、参考图、页面级特殊风格或用户明确要求精修时，才执行 `optionalTasks.visual-refinement` 后再物化。
5. 读取精确路径 `workflow/plan/step-4-deliver.md`，按其中契约直接展示并确认当前方案。超大需求需要展示中间进展或用户明确要求边生成边查看时，才使用 [按模块更新方案](../incremental-preview.md)；普通首版不逐模块预览和重复渲染。

明确范围的方案以 `explicitScope` 作为完整执行清单。确认后的每个写操作都对应清单中的一个资源或交付项；清单资源全部回读且真实链接完成交付时，本轮达到完成态。

初次编写只读 CLI 返回的紧凑契约、当前主题上下文及共享需求；模板全文由 CLI 读取。具体组件定制、暗色浮层或复杂页面需要额外规则时，再读取对应章节。

并行调度与耗时记录见 [并行执行](../parallel-work.md)。

## 产物与交接

全部产物位于 `prd/<项目名>/`：

```text
build-plan.json（业务和视觉的源事实）
  ├─ prd.md（业务与搭建执行契约）
  ├─ design.md（视觉契约）
  ├─ build-plan.html（供用户查看和确认）
  └─ app-theme.css（应用主题）
```

草稿按已确定的模块更新，最终校验后统一保存三份文档和主题 CSS。业务方案或视觉方案调整由对应技能更新源事实，再由编排重新生成并确认；素材采集后的进度同步沿用已有确认并直接继续，具体命令与版本条件见 [生成与确认](step-4-deliver.md)。

用户交互按 [可见表达契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行。当前展示版本确认后，先按物化返回的 `assetTasks` 启动素材任务，再将 `prd.md`、`design.md` 和 `outputs.theme` 交给主流程 Step 3；搜索与创建应用同时推进。仅完整应用同步主题设置；`explicitScope.allowInferredResources=false` 时忽略主题和导航交接，只创建范围内资源并交付，不重复物化计划。
