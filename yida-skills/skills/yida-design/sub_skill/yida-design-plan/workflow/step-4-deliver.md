# Step 4：生成交付产物并确认

## 目的

在不改变页面规划的前提下完成视觉应用，从同一版 `build-plan.json` 派生三份产物，并把确认状态绑定到当前 revision。

## 输入

- Step 3 的完整 `build-plan.json` 草稿。
- [visual-design.md](../references/visual-design.md)。
- [主题索引](../templates/design-themes/index.json)。
- `visualStyle.internal.selectedTheme` 经主题索引解析出的唯一完整主题模板。

## 操作

### 1. 完成视觉结构化事实

先用主题索引校验内部 `selectedTheme.themeId`，再只读取选中的一份完整主题模板。以索引 `defaultProfile` 和该模板为基础，叠加用户与品牌约束。模型必须写入项目选择事实：

- `visualDirection`
- `colorStrategy`
- `navigationStyle`
- `productTopologyApplication`
- 每页与真实内容匹配的 `visualMemoryApplications`
- 素材现状和缺口

`themeProfile`、用户可读摘要、页面基础视觉应用、页面模式引用和主题标准规则全部由 materialize 补齐。不得把完整主题模板中的组件、状态、响应式和质量门禁复制进 JSON。

保持页面规划中的内容优先级、首屏结构、页面模式和信息密度不变。只有新暴露的品牌素材冲突或前后台表达边界冲突，才返回 Step 2；不要在本步骤建立另一套候选逻辑。

所有页面共享选中模板的全应用 Token 和基础组件语言。`pageApplications` 只遍历项目真实存在的自定义页面；模型为每页匹配满足内容契约的 0–3 个视觉记忆点，基础视觉应用由模板确定性派生。

### 2. 从同一事实源派生产物

先完成 `build-plan.json`，再执行一次确定性物化命令：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --json
```

该命令统一完成结构校验、主题索引一致性校验、`prd.md` 派生、选中主题模板实例化、项目视觉选择章节注入、Brand Token 计算和 `build-plan.html` 渲染。导航明暗映射为：`light → --color-brand1-3`，`dark → --color-brand1-5`。命令成功前不得手写或逐份修补三份派生产物；命令失败时只修正 `build-plan.json`，再重新执行。只校验但不落盘时使用：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --check --json
```

正常生成不读取 [主题模板维护说明](../templates/design-themes/README.md) 或 [HTML 维护说明](../assets/README.md)，也不直接调用内部 Python 渲染脚本。四份产物共享同一个 `meta.revision`。

`build-plan.html` 固定展示“需求总览、数据模型、业务流程、页面规划”四章。视觉信息仅在“需求总览 > 视觉设计”中展示视觉概览、主题色、导航结构、导航明暗和选择依据，不设置独立视觉章节，也不展开逐页视觉应用、模板路径、内部预设、设计系统正文、对话区、编辑/生成按钮或 `ask_human` 过程。此展示收敛不得删改 `build-plan.json` 中供 `prd.md`、`design.md` 消费的视觉事实。

### 3. 展示并确认当前版本

按 [`ask_human` 交互契约](../../../references/ask-human-interaction-contract.md)：

1. 在会话中展示当前 revision、3–7 条摘要和可打开的 `build-plan.html`。
2. 记录 `presentedRevision`。
3. 执行最终确认，只提供“确认并开始搭建”和“继续调整”。

只有以下条件同时成立时才交接：

- `meta.status=confirmed`
- `meta.planState.planConfirmed=true`
- `meta.revision=presentedRevision=confirmedRevision`

交接前再次执行 `openyida design-plan materialize <build-plan.json> --json` 同步当前版本，再把同版本 `prd.md` 和 `design.md` 返回 `yida-app` Step 3；不进入 Fast 分支。

### 4. 处理调整

用户要求修改时只返回并执行字段级 patch，一次更新 `build-plan.json` 中已有的源事实字段并重建其余三份产物：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json \
  --set 'visualStyle.forUser.colorStrategy.primaryColor=#6F4E37' \
  --set 'visualStyle.forUser.colorStrategy.primaryColorName=咖啡色' \
  --materialize --json
```

同一次调整涉及多个源事实时重复传入 `--set`，例如颜色值和颜色名称一起修改。不要 patch `overview.visualSummary` 等派生字段。该命令只接受已存在的字段路径，并自动完成 revision 递增、旧确认失效、结构校验和可选物化；不得返回整份新 JSON，不得分别编辑四份产物。每次修改：

- 生成新的 `meta.revision`。
- 设置 `meta.status=draft`、`planConfirmed=false`。
- 清空 `presentedRevision`、`confirmedRevision`、`confirmationInteractionId`、`confirmedAt`。
- 展示新版本后才能再次确认，旧版本确认自动失效。

调整传播：

- 字段或流程变化：同步相关业务事实、页面、PRD；必要时重算页面模式。
- 页面核心任务或首屏变化：同步页面规划、页面模式、页面视觉应用、PRD 和 `design.md`。
- 主题、品牌色、圆角或阴影变化：只更新视觉摘要、页面视觉应用和 `design.md`，不得修改业务流程、内容优先级或页面模式。
- 页面规划可触发视觉应用重算；视觉变化不得反向改写页面规划。

## 输出

- 四份同 revision 产物。
- 当前版本的展示记录与确认状态。
- 确认后交给 `yida-app` Step 3 的同版本 `prd.md`、`design.md`。

## 检查清单

- [ ] 只加载了最终选中的一份完整主题模板。
- [ ] `design.md` 没有未解析占位符或 Token 推导指令，且没有改变页面规划。
- [ ] `design.md` 直接包含视觉方向、主题色、导航结构、导航明暗和导航背景 Token，不包含主题 ID、模板名称或模板路径。
- [ ] `PRODUCT_TOPOLOGY_APPLICATION` 已生成，页面视觉记忆点只绑定 PRD 已有内容。
- [ ] `pageApplications` 与实际自定义页面一一对应，没有输出项目中不存在的页面类型。
- [ ] 源 JSON 只保存项目事实和差异；主题模板中的组件、状态、响应式和质量门禁仍完整出现在 `design.md`。
- [ ] 四份产物都来自同一 revision。
- [ ] 派生产物由 `openyida design-plan materialize` 一次生成，没有逐份手写或修补。
- [ ] HTML 只展示四个主章节，视觉概览和主题色仅出现在需求总览。
- [ ] 已在会话中展示 revision、摘要和 HTML 入口。
- [ ] 调整后旧确认已失效。
- [ ] 只有当前展示版本被确认后才交接。
