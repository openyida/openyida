# Plan 业务规划

输入为已确认的共享需求、CLI 初始化的草稿和 [计划编写契约](../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md)。已有详细计划直接复用，补齐实施所需的缺项。

1. 按“业务目标 → 对象与字段 → 流程与规则 → 用户任务 → 页面”规划。字段、关系、规则、权限和已确认页面范围保留完整。
2. 维护 overview、dataModels、businessFlows、pages 和业务 execution。导航沿用需求选择；资源按依赖排列，页面任务、数据来源、主操作和验收要求明确。
3. init 已创建并预填 `business.json` 骨架。先读取它，保留 base；facts **只能**包含 overview、dataModels、businessFlows、pages 和可选 execution，禁止写 visualStyle。一次补齐全部业务事实并将 ready 设为 true：每个普通表单都有 sampleDataPlan（窄范围不造数写 skipReason），每个自定义页面都有非空 permissionSummary。视觉选择已由 CLI 预填，不等待另一个模型任务。只有命中品牌稿、参考图、页面级特殊视觉或用户明确要求精修时，才将页面任务、区块与 sceneKey 交给可选视觉任务。超大需求需要中间展示时才按 [按模块更新方案](../../yida-app/workflow/incremental-preview.md) 提交；普通首版使用 [完整文件合并](../../yida-app/workflow/parallel-work.md#plan-的-cli-交接)。
4. CLI 生成完整 PRD 与交接，模板规则、摘要副本和默认设计引用由 CLI 补齐。校验问题按字段路径集中修正。

首版只写紧凑契约要求的业务事实和用户指定的差异，不重复写 CLI 可派生的概要、资源顺序副本、通用交互状态与默认验收文案。普通表单先提供 1 条覆盖必填字段的有效示例记录；用户要求多条或业务验收确有需要时再增加。不要先生成完整 PRD Markdown，再将相同内容改写为 JSON。

`explicitScope.allowInferredResources=false` 时只规划点名资源：不增加自定义工作台、列表页、seed records、主题设置或导航任务；普通表单的 sampleDataPlan 用 skipReason 明确“本轮窄范围不造数”。

页面模式选项由 CLI 返回的 authoring-context 提供。遇到复杂跨页流程或特殊资源时，再按需读取 [业务内容检查](../references/plan-content.md) 与 [统一 PRD 格式](output-prd.md)。
