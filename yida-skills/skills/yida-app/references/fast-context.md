# Fast 阶段输入

Fast 从本轮已确认需求和真实执行回执直接实施，默认不生成 build-context.json 或任何创建前业务方案 JSON。按 [立即搭建](../workflow/fast-build.md) 创建/复用应用，主题 CSS 独立生成，与页面按实际工具能力并行。

下游共用步骤中，PRD 的业务目标、页面任务、数据、角色、规则和验收读取原始已确认需求；资源与字段映射读取已有真实回执；design.md 的视觉要求读取已选主题、app_theme.css 及本轮明确的布局/交互决定。步骤中的文档生成、章节/锚点、page-spec 和两文件一致性门槛只用于 Plan/已有文档任务，不阻塞 Fast。保留 explicitScope、禁止项、权限、真实数据与发布验收。

build-manifest 随执行逐步记录真实资源 ID、字段映射、主题 applicationTheme、任务编号和验收证据；最后用 --manifest-only 回读。必要时素材草稿自身携带 assetStrategy，直接 --input 解析。已有 build-context/PRD/design.md 可以复用相应旧接口，但不要求新 Fast 补造或校验这些文件，更不等待它们才创建应用。
