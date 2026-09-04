# Plan 业务规划

输入为已确认的共享需求、CLI 初始化的草稿和 [计划编写契约](../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md)。已有详细计划直接复用，补齐实施所需的缺项。

1. 按“业务目标 → 对象与字段 → 流程与规则 → 用户任务 → 页面”规划。字段、关系、规则、权限和已确认页面范围保留完整。
2. 维护 overview、dataModels、businessFlows、pages 和业务 execution。导航沿用需求选择；资源按依赖排列，页面任务、数据来源、主操作和验收要求明确。
3. 与基础视觉任务同时启动，已确定的内容按 [按模块更新方案](../../yida-app/workflow/incremental-preview.md) 提交。页面任务、区块与 sceneKey 确定后立即交给视觉任务。包含自定义 execution 的完整计划使用 [完整文件合并](../../yida-app/workflow/parallel-work.md#plan-的-cli-交接)。
4. CLI 生成完整 PRD 与交接，模板规则、摘要副本和默认设计引用由 CLI 补齐。校验问题按字段路径集中修正。

页面模式选项由 CLI 返回的 authoring-context 提供。遇到复杂跨页流程或特殊资源时，再按需读取 [业务内容检查](../references/plan-content.md) 与 [统一 PRD 格式](output-prd.md)。
