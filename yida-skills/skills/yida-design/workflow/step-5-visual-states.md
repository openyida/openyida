# Step 5：UI 视觉和状态设计

这一步生成应用级 `design.md` 草稿。应用内所有页面使用同一个 `prd/<项目名>/design.md`，共用一套主题、视觉 DNA、组件和状态规则；页面差异写入 `sceneRecipes`。

## 读取顺序

1. 读取 [design.md 生成规则](../references/style-design-selection.md)，完成模板选择和主题换肤。
2. 只读取被选中的一个 `style-designs/*.md`，不读取全部模板。
3. 读取 [视觉脚手架配方库](../references/visual-scaffold-recipes.md)，生成各页面的 `visualScaffold`。
4. 读取 [页面质量门禁](../references/page-quality-gates.md)，生成 `acceptanceChecks`。
5. 需要图片或品牌素材时读取 [素材规则](../references/asset-workflow.md)。

模板选择、评分、近邻比较和换肤规则只以 `style-design-selection.md` 为准，本文件不重复定义。

## 生成内容

1. 记录 `baseDesignSource`、`styleDesignSelection` 和 `themeAdaptationResult`。
2. 从所选模板和当前业务提取 2-5 个视觉 DNA，不复制模板中的业务内容、示例数据或色盘。
3. 写应用级 token、背景层、表面层次、圆角、密度、间距和呼吸节奏。
4. 为每类页面写 `sceneRecipes` 和 `visualScaffold`，覆盖布局、区块、主操作、上下文区、状态区和响应式变化。
5. 写按钮、输入、表格、列表、标签、弹窗、抽屉、图表和图标规则。
6. 写正常、hover、active、disabled、loading、empty、error、无权限和无数据状态。
7. 官网、品牌页或视觉化工作台需要真实或生成图片；素材不足时在 `assetStrategy` 中标记缺口。

图标使用 `lucide-react` 或 `@ant-design/icons` 的具体组件，默认使用 `lucide-react`。页面美化只改视觉表达，不改变数据源、字段映射、按钮动作、权限或业务状态。

## 检查

- 页面内容来自当前业务，不出现示例品牌名、默认指标和通用卖点。
- 首屏有明确视觉锚点、主操作、关键状态和至少两个信息层。
- 工作台、首页、门户、看板、展示页和业务入口页满足页面质量门禁中的区块数量要求。
- 页面没有“4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡”的低密结构。
- 背景和内容表面有清晰层次，文字、按钮、图表和表格保持可读。
- `roundedRule`、`densityRule`、`breathingRule` 和 `surfaceContrast` 都有具体数值或可执行规则。
- 所有组件有完整交互状态，移动端布局不溢出。
- `styleDesignSelection` 能用业务任务和视觉策略解释模板选择。
- `themeAdaptationResult` 保留所选模板的视觉 DNA 和结构机制。

## 下一步

读取 [design.md 输出格式](output-design.md)，再进入 [写入 design.md](step-6-handoff.md)。
