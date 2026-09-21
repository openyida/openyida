# Plan：生成方案并确认

由 `yida-app` 在需求确认完成且选择 Plan 后进入。需求与选择明确后并行准备业务和视觉事实，统一生成产物；确认当前方案后进入资源创建。

已有方案需要修改时，直接执行 [局部调整](step-4-deliver.md#4-处理调整)，不重走下面的首版流程。

## 中断恢复与文件缺失

已有方案的继续、调整或确认，先沿用原 `build-plan.json`，通过 patch/materialize 延续其 revision；`init` 仅用于新方案，不能把原文件读取失败当作首次规划。

原文件不存在时，先使用当前运行环境提供的工作区恢复或用户可访问的原方案附件，确认内容和 revision 后继续。不要读取 runtime-internal 路径，不要靠改目录名、反复 init 或手填 revision 伪造恢复成功。

确实无法恢复原方案时，告知用户“原方案文件无法恢复，需要根据已确认需求重建”，请求确认后才能新建；保留已确认需求，不从头重复需求采集。重建产生独立方案，明确标为“重建方案（第 1 版）”，用新的最终确认调用展示，原确认不再适用于新文件。只有用户确认本次重建方案后才能实施；不能将旧确认或旧附件视为新方案已获确认。

## 当前待办名称

- 规划功能、页面和配色：设计功能和页面
- 生成方案并等待用户确认：确认搭建方案
- 方案确认后：读取同一 revision 的 `execution.explicitScope`，为其中非空的资源集合生成对应实施步骤，最后增加“检查范围并交付”
- `allowInferredResources=true` 的完整应用：按 `yida-app` 完整应用模版生成后续步骤
- `allowInferredResources=false` 的闭合范围：后续步骤总集等于确认方案中的资源步骤与交付步骤；每完成并回读一个资源，就从内部剩余集合中移除，用户待办保留并标记完成

沿用已有待办，不把下面的内部执行顺序另建成一份任务列表。

## 执行顺序

1. 直接复用已确认的 `requirement-brief.json`；若尚未完成 Step 2 的规划准备，先按 [交接契约](../../../yida-requirement-analysis/references/handoff.md#规划阶段补齐) 补齐页面承载、导航与主题，AI 建议保留来源，不重新询问业务或导航；本文件已经包含规划入口，不再额外读取 `step-1-understand.md` 或 `step-2-confirm.md`。
2. 用户未给出明确完整视觉风格时，先执行 [Plan 视觉分支](../../../yida-design/sub_skill/yida-design-plan/SKILL.md)：按 Fast / Plan 共用规则生成恰好三套候选，并通过 `ask_human` 获得用户选择。不得因用户未主动要求比较而跳过。获得选择或已有明确完整风格后，再继续主题映射和初始化。
3. 主题映射未确定时，执行一次 `openyida design-plan catalog --json`，从返回的 `themes` 选择 themeId，并复用 `pagePatterns`。已有合法主题 ID 时直接初始化。初始化计划草稿，CLI 返回编写契约与当前主题的精简上下文：

   ```bash
   openyida design-plan init .cache/openyida/<项目名>/requirement-brief.json --theme-id <已选主题> --json
   ```
   `requirement-brief.json` 必须复用 `yida-requirement-analysis` 的输出结构，不要自行发明字段层级；`projectName` 位于 JSON 根级，`businessGoals` 等集合字段保持数组，命令第一次就传入 `visualSelection.themeId`。若 CLI 返回字段路径诊断，按 `expectedPath` 集中修正原文件后最多重试一次，不要通过反复更换项目名规避结构错误。

4. 按 init 返回的 `parallelTasks` 和 `dependsOn` 完成待补内容。CLI 预填业务骨架与已选主题；自定义页仍须补齐焦点、布局、主操作、响应式和验收，写入 `visual.json`。业务页面确定后完成视觉任务，可在同一轮中顺序填写两个文件。纯原生资源且两个片段均已就绪时，直接生成方案。
5. init 已创建并预填 `business.json` 骨架；读取该文件及 `context` 中的类型示例，按 `authoring.pendingFields` 的文件和字段路径补齐内容，保留 `base` 与已有事实。复核需求覆盖后，将已完成片段设为 `ready=true`。`business.json` 的 facts 填写 overview、dataModels、businessFlows、pages 和可选 execution；`visual.json` 的 facts 填写 visualStyle。同一次补齐所有普通表单的 sampleDataPlan（窄范围不造数时写 skipReason）及所有自定义页面的 permissionSummary，然后直接执行 init 返回的 `materialize.command`，只物化一次。标准首版禁止先试 `--from-preview`、`preview`、`--check` 或无参数 materialize；成功 JSON 已返回 HTML 路径和 revision，不再用 Glob、Read 或帮助命令检查产物。只有存在品牌稿、参考图、页面级特殊风格或用户明确要求精修时，才执行 `optionalTasks.visual-refinement` 后再物化。
6. 读取精确路径 `workflow/plan/step-4-deliver.md`，按其中契约直接展示并确认当前方案。超大需求需要展示中间进展或用户明确要求边生成边查看时，才使用 [按模块更新方案](../incremental-preview.md)；普通首版不逐模块预览和重复渲染。

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

草稿按已确定的模块更新，最终校验后统一保存三份文档和主题 CSS。后续业务或视觉调整按 [局部调整](step-4-deliver.md#4-处理调整) 更新并确认；素材进度同步沿用已有确认。

用户交互按 [可见表达契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行。当前展示版本确认后，先按物化返回的 `assetTasks` 启动素材任务，再将 `prd.md`、`design.md` 和 `outputs.theme` 交给主流程 Step 3；搜索与创建应用同时推进。仅完整应用同步主题设置；`explicitScope.allowInferredResources=false` 时忽略主题和导航交接，只创建范围内资源并交付，不重复物化计划。

## 加载失败与内容修复

技能加载失败、限流或换模型后，先成功读取本工作流和当前步骤，再沿用已确认需求继续；未加载成功不得凭记忆生成 HTML 或确认参数。首次物化前只修 business.json/visual.json 对应 facts（菜单与执行规划在 business.facts.execution），不要直接修初始化主计划。字段错误按具体路径修正后重试。

如果已经改动主计划并出现 DESIGN_PLAN_STALE_PART，在原 materialize 命令增加 --rebase-parts。CLI 使用 init 保存的 .build-plan-base.json 做三方核对，保留已完成 facts；冲突按 details.conflicts 明确选择后重试。基线缺失或无法核实时告知阻塞并恢复可信文件，不手填 digest、不删除重建、不重新 init。已物化后调整走 patch --materialize，不继续复用初始化片段。
