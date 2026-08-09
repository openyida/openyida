# Step 5：写入 design.md

> 本步骤只写 `prd/<项目名>/design.md`。`prd.md` 由 `yida-prd` 生成；页面源码由页面技能实现。

## 写入内容

写入前先读取 [design.md 输出格式](output-design.md)，再用 Step 2、Step 4、Step 5 的产物填充。

| 模块 | 必填内容 |
| --- | --- |
| frontmatter | version、design_id、baseDesignSource、styleDesignSelection、themeProfile、themeAdaptationResult、yidaThemeRuntime、tokens、visual_dna、scenes、density、layout、tone |
| 总览 / 模板选择依据 / 主题色与换肤结果 / 适用场景 / 视觉氛围 | 可复用设计意图、选中模板和拒绝模板、主题色来源、换肤策略、适合与不适合场景、密度、气质和页面组织方式 |
| 视觉 DNA / 设计母体 | 所有页面都必须保留的 2-5 个视觉 DNA，每个包含证据、规则、交接钩子、失败表现和置信度 |
| 色彩角色 / 字体 / 布局 / 深度 / 形状 | token、字体栈、字号、网格、间距、层级、圆角和材质规则 |
| 组件样式 / 快捷入口区域 | 按组件写 default、hover、active、focus、disabled、loading、selected、error；工作台等必须写快捷入口区域 |
| 页面结构配方 | 中性槽位、`visualScaffold`、`surfaceMap`、`componentRecipe`、`sceneRecipes` |
| 状态与交互 / 响应式 / 可访问性 | loading、empty、error、mobile、reduced motion、焦点和对比度 |
| 页面技能交接 | `designFile`、`designRefs`、主题作用域、token 来源、视觉脚手架、状态和组件约束 |
| 交付自检 | 10+ contentBlocks、低密大卡片、主题一致性、背景层次、圆角密度、页面技能引用 |

## 写文件前检查

1. 确认业务对象、页面场景、主操作和数据来源已来自用户诉求或 `prd.md`。
2. 读取 [design.md 输出格式](output-design.md)。
3. 读取 [页面质量门禁](../references/page-quality-gates.md)，确认设计规则可交给页面技能。
4. 用 Step 2 的主题结果填充 `themeProfile`、tokens 和 `themeAdaptationResult`。
5. 用 Step 5 的视觉结果填充 `visualScaffold`、`sceneRecipes`、组件、图标和状态规则。
6. 写入 `prd/<项目名>/design.md`。
7. 若已有 `prd.md`，确认其中的 `designFile/designRefs` 能指向本文件；不一致时提示回到 `yida-prd` 修正 PRD 引用。

## 完成标准

- `prd/<项目名>/design.md` 已写入。
- `design.md` 包含 `themeProfile`、tokens、`visualScaffold`、`surfaceContrast`、`roundedRule`、`densityRule`、`breathingRule`、组件、图标、状态和响应式规则。
- 每个 display 页面都有可消费的 `sceneRecipes` 或 `designRefs`。
- 没有写 `prd.md`，没有写 JSX/TSX/CSS。
