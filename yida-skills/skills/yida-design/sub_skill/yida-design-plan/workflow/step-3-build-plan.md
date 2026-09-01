# Step 3：生成搭建计划

## 目的

把已确认的需求事实写成完整、结构化、可版本化的 `build-plan.json` 草稿。

## 输入

- Step 2 输出的确认上下文，以及 `visualDirection`、`selectedTheme`、`colorStrategy`、`navigationStyle` 四组已选视觉事实。
- [build-plan-compact-schema.md](../references/build-plan-compact-schema.md)。
- [build-plan-content.md](../references/build-plan-content.md)。
- [page-patterns.md](../references/page-patterns.md)。

## 操作

### 1. 按业务依赖生成计划

严格按以下依赖顺序生成，不从页面或视觉倒推业务：

```text
业务目标 → 业务对象 → 数据模型 → 业务流程 → 用户任务 → 页面规划
```

先建立 `prd/<项目名>/build-plan.json`，写入 `schemaVersion: "2.0"`、元信息、不可机械恢复的需求总览、完整数据模型、完整业务流程、页面业务差异、视觉证据与项目覆盖项。

模型不得重复写可确定性派生的信息：

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

### 3. 完成结构校验

- `selectedTheme.themeId` 存在于主题索引；模板路径由索引补齐，若源计划显式提供路径则必须与索引一致。
- `visualDirection`、`colorStrategy` 和 `navigationStyle` 已写入源事实；导航结构只能是 `top | side`，导航明暗只能是 `light | dark`。
- 源 JSON 不保存未选中的视觉方向；用户可见字段不保存主题标签、模板路径或主题索引摘要。
- 页面规划和视觉事实的数据归属符合 schema；视觉应用即使在 `prd.md` 的页面卡片中展示，也归属于 `visualStyle.forUser.pageApplications`，`build-plan.html` 不重复展示。
- 写入新的 `meta.revision`，草稿状态使用 `meta.status=draft`、`planConfirmed=false`。
- 不先生成 `prd.md`、`design.md` 或 HTML 再反向补 JSON。

## 输出

- `prd/<项目名>/build-plan.json` 完整草稿。
- 可供 Step 4 使用的页面规划、页面模式和选中主题绑定。

## 检查清单

- [ ] 业务、数据、流程、任务、页面按依赖顺序生成。
- [ ] 每个自定义页面都有核心任务、首屏结构、内容丰富度和信息密度。
- [ ] 页面模式是 `preset / adapted / custom` 之一。
- [ ] `adapted` 有非空改造项，`custom` 说明了自定义结构。
- [ ] 页面规划没有被视觉候选或模板反向决定。
- [ ] JSON 已成为唯一事实源并写入新 revision，且 `schemaVersion=2.0`。
- [ ] 业务字段、流程规则、页面任务、项目适配和视觉记忆点绑定没有因为压缩而删除。
- [ ] JSON 没有复制主题标准规则、页面预设标准或可派生摘要。
