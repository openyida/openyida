# 按模块更新方案

业务与视觉任务各自整理已确定的模块，主流程收到一个模块就更新草稿。每次提交一组完整内容，例如一批已规划的表单；同一模块由一个任务维护。

```bash
openyida design-plan preview prd/<项目名>/build-plan.json --part-file <模块文件> --json
```

模块文件复用 `design-plan init` 生成片段中的 base，只填写本次已确定的 facts：

```json
{
  "base": { "revision": "初始版本", "digest": "初始摘要" },
  "mode": "upsert",
  "facts": { "dataModels": [] }
}
```

facts 支持 overview、dataModels、businessFlows、pages、visualStyle。`mode: "upsert"` 用于分批提交表单、流程或页面：表单和流程按 name，页面按 pageId 新增或替换单项，保留其他项。省略 mode 时替换整个模块，适合概要、基础视觉或完整清单调整。CLI 保留其他模块；相同内容跳过写入。源计划变化后，模块使用新的 base。需要自定义 `execution` 时，将全部最新业务和视觉内容按 [完整文件合并](parallel-work.md#plan-的-cli-交接) 生成最终方案。

| 已确定内容 | 立即更新 |
| --- | --- |
| 应用目标、业务规则摘要 | PRD 总览与 HTML 总览 |
| 一批表单及字段 | PRD 数据结构与 HTML 数据模型、关联图 |
| 业务流程 | PRD 业务逻辑与 HTML 业务流程 |
| 页面任务、区块 | PRD 页面规划与 HTML 页面规划 |
| 主题、配色、token | 设计草稿、主题 CSS 与 HTML 风格摘要 |
| 各页的布局和样式 | 页面设计与设计草稿中的逐页说明 |

先提交基础风格；页面内容确定后，补齐 `visualStyle.pageApplications` 中的逐页设计再提交。

草稿写入计划旁的 `preview/`，未完成章节显示“正在完善”。HTML 沿用完整方案模板，替换受影响章节；PRD 使用相同事实生成章节。CSS 从公共模板初始化，后续只更新变化的 token，保留自定义样式。

并行任务分别写模块文件，主流程逐次调用更新命令；CLI 使用写入锁并在写入失败时回滚。命令提示“writer busy”（正在写入）时，等当前更新结束再重试。异常退出遗留锁时，确认原进程已结束后再清理。

全部模块完成后执行：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --from-preview --json
```

CLI 汇总草稿，检查页面、设计引用与业务要求，再一起写入源计划、prd.md、design.md、build-plan.html 和 app-theme.css。主流程展示完整 HTML，按原确认流程继续搭建；中间草稿用于查看进度。
