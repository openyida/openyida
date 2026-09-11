# Plan：生成方案并确认

由 `yida-app` 在需求确认完成且选择 Plan 后进入。需求与选择明确后并行准备业务和视觉事实，统一生成产物；确认当前方案后进入资源创建。

## 当前待办名称

- 规划功能、页面和配色：设计功能和页面
- 生成方案并等待用户确认：生成PRD方案&确认
- 新建应用确认后：创建应用 → 搭建表单与审批流 → 准备示例数据 → 搭建业务页面 → 发布页面与配置导航 → 检查功能并交付
- 已有应用确认后：搭建表单与审批流 → 准备示例数据 → 搭建业务页面 → 发布页面与配置导航 → 检查功能并交付

沿用已有待办，不把下面的内部执行顺序另建成一份任务列表。

## 执行顺序

1. 直接复用已确认的 `requirement-brief.json`；本文件已经包含规划入口，不再额外读取 `step-1-understand.md` 或 `step-2-confirm.md`。
2. 初始化计划草稿，CLI 返回编写契约与当前主题的精简上下文：

   ```bash
   openyida design-plan init .cache/openyida/<项目名>/requirement-brief.json --theme-id <已选主题> --json
   ```
   `requirement-brief.json` 必须复用 `yida-requirement-analysis` 的输出结构，不要自行发明字段层级；`projectName` 位于 JSON 根级，`businessGoals` 等集合字段保持数组，命令第一次就传入 `visualSelection.themeId`。若 CLI 返回字段路径诊断，按 `expectedPath` 集中修正原文件后最多重试一次，不要通过反复更换项目名规避结构错误。

3. 执行 init 返回的 `parallelTasks`：普通标准首版只有一个业务规划任务；显式窄范围且表单字段已完整时，CLI 返回 `preparedInputs.businessReady=true` 和空任务列表，直接进入第 4 步，不再 Read/Edit business 或补规划。视觉方向、主题色和导航样式已在需求阶段确定，CLI 将其预填到 `preparedInputs.visual`，并从主题模板确定性补齐页面标准视觉，不再启动“基础视觉 → 等待页面 → 逐页视觉绑定”两段模型任务。
4. init 已创建并预填 `business.json` 骨架；先 Read 该文件，保留 `base`，一次补完后再 Write/Edit，避免覆盖保护失败。`facts` 只允许 overview、dataModels、businessFlows、pages 和可选 execution，绝不写 `visualStyle`。同一次补齐所有普通表单的 sampleDataPlan（窄范围不造数时写 skipReason）及所有自定义页面的 permissionSummary，然后直接执行 init 返回的 `materialize.command`，只物化一次。标准首版禁止先试 `--from-preview`、`preview`、`--check` 或无参数 materialize；成功 JSON 已返回 HTML 路径和 revision，不再用 Glob、Read 或帮助命令检查产物。只有存在品牌稿、参考图、页面级特殊风格或用户明确要求精修时，才执行 `optionalTasks.visual-refinement` 后再物化。
5. 读取精确路径 `workflow/plan/step-4-deliver.md`，按其中契约直接展示并确认当前方案。超大需求需要展示中间进展或用户明确要求边生成边查看时，才使用 [按模块更新方案](../incremental-preview.md)；普通首版不逐模块预览和重复渲染。

明确窄交付时，方案只描述 `explicitScope` 中的资源；确认后裁剪无关步骤，在这些资源回读并交付真实链接后停止。不得因用户使用“应用”一词自行增加 seed records、自定义页面、主题或导航工作。

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

草稿按已确定的模块更新，最终校验后统一保存三份文档和主题 CSS。调整由对应技能更新源事实，再由编排重新生成并确认，具体命令与版本条件见 [生成与确认](step-4-deliver.md)。

用户交互按 [可见表达契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行。当前展示版本确认后，将 `prd.md`、`design.md` 和已生成的 `outputs.theme` 交给应用主流程 Step 3。仅完整应用同步主题设置；`explicitScope.allowInferredResources=false` 时忽略主题和导航交接，只创建范围内资源并交付，不重复物化计划。
