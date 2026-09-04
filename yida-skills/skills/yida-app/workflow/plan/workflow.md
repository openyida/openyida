# Plan：生成方案并确认

由 `yida-app` 在需求确认完成且选择 Plan 后进入。需求与选择明确后并行准备业务和视觉事实，统一生成产物；确认当前方案后进入资源创建。

## 执行顺序

1. 复用 [已确认的需求](step-1-understand.md)，检查 [规划入口](step-2-confirm.md)。
2. 初始化计划草稿，CLI 返回编写契约与当前主题的精简上下文：

   ```bash
   openyida design-plan init .cache/openyida/<项目名>/requirement-brief.json --theme-id <已选主题> --json
   ```

3. 执行 init 返回的 `parallelTasks`：标准首版只有一个业务规划任务。视觉方向、主题色和导航样式已经在首次提问中确认，CLI 将其预填到 `preparedInputs.visual`，并从主题模板确定性补齐页面标准视觉，不再启动“基础视觉 → 等待页面 → 逐页视觉绑定”两段模型任务。
4. 业务任务一次写完 `business.json` 后，直接使用预填的 `visual.json` 按 [完整文件合并](../parallel-work.md#plan-的-cli-交接) 物化 PRD、设计文档和 HTML。只有存在品牌稿、参考图、页面级特殊风格或用户明确要求精修时，才执行 `optionalTasks.visual-refinement` 后再物化。
5. 按 [生成与确认](step-4-deliver.md) 校验、展示并确认当前方案。超大需求需要展示中间进展或用户明确要求边生成边查看时，才使用 [按模块更新方案](../incremental-preview.md)；普通首版不逐模块预览和重复渲染。

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

用户交互按 [可见表达契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行。当前展示版本确认后，将 `prd.md` 和 `design.md` 交给应用主流程 Step 3。
