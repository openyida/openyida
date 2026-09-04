# Plan：生成方案并确认

由 `yida-app` 在需求确认完成且选择 Plan 后进入。需求与选择明确后并行准备业务和视觉事实，统一生成产物；确认当前方案后进入资源创建。

## 执行顺序

1. 复用 [已确认的需求](step-1-understand.md)，检查 [规划入口](step-2-confirm.md)。
2. 初始化计划草稿，CLI 返回编写契约与当前主题的精简上下文：

   ```bash
   openyida design-plan init .cache/openyida/<项目名>/requirement-brief.json --theme-id <已选主题> --json
   ```

3. 按 init 返回的 `parallelTasks` 同时准备业务和基础视觉。已确定内容按 [按模块更新方案](../incremental-preview.md) 更新草稿；页面内容确定后补齐各页设计。
4. 全部完成后，按 [生成与确认](step-4-deliver.md) 校验、展示并确认当前方案。一次收齐完整文件的情况见 [完整文件合并](../parallel-work.md#plan-的-cli-交接)。

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
