# Step 5：写入设计并刷新脚手架

> 本步骤写 `design.md` 和精简视觉配置，再调用 CLI 生成项目级表单与 Canvas 脚手架。`prd.md` 由 `yida-prd` 生成；页面业务源码由页面技能实现。

## 写入内容

写入前先读取 [design.md 输出格式](output-design.md)，再用 Step 2、Step 4、Step 5 的产物填充。

| 模块 | 必填内容 |
| --- | --- |
| frontmatter | version、design_id、baseDesignSource、styleDesignSelection、themeProfile、themeAdaptationResult、tokens、visual_dna、scenes、density、layout、tone |
| 总览 / 模板选择依据 / 主题色与换肤结果 / 适用场景 / 视觉氛围 | 可复用设计意图、选中模板和拒绝模板、主题色来源、换肤策略、适合与不适合场景、密度、气质和页面组织方式 |
| 视觉 DNA / 设计母体 | 所有页面都必须保留的 2-5 个视觉 DNA，每个包含证据、规则、交接钩子、失败表现和置信度 |
| 色彩角色 / 字体 / 布局 / 深度 / 形状 | token、字体栈、字号、网格、间距、层级、圆角和材质规则 |
| 组件样式 / 快捷入口区域 | 按组件写 default、hover、active、focus、disabled、loading、selected、error；工作台等必须写快捷入口区域 |
| 页面结构配方 | 中性槽位、`visualScaffold`、`surfaceMap`、`componentRecipe`、`sceneRecipes` |
| 状态与交互 / 响应式 / 可访问性 | loading、empty、error、mobile、reduced motion、焦点和对比度 |
| 页面技能交接 | `designFile`、`designRefs`、主题作用域、token 来源、视觉脚手架、状态和组件约束 |
| 交付自检 | 10+ contentBlocks、低密大卡片、主题一致性、背景层次、圆角密度、页面技能引用 |

## 写文件前检查

1. 确认业务对象、页面场景、品牌和色彩偏好已来自共享需求简报或当前单页上下文。
2. 读取 [design.md 输出格式](output-design.md)。
3. 读取 [页面质量门禁](../references/page-quality-gates.md)，确认设计规则可交给页面技能。
4. 用 Step 2 的主题结果填充 `themeProfile`、tokens 和 `themeAdaptationResult`。
5. 用 Step 5 的视觉结果填充 `visualScaffold`、`sceneRecipes`、组件、图标和状态规则。
6. 写入 `prd/<项目名>/design.md`。
7. 同步写入 `.cache/openyida/<项目名>/design-runtime.json`。只保留脚手架需要的 token、圆角、间距、密度和表单视觉默认值：

```json
{
  "version": 1,
  "designFile": "prd/<项目名>/design.md",
  "designId": "<design_id>",
  "tokens": {
    "--color-brand1-6": "#...",
    "--color-brand1-1": "#...",
    "--openyida-bg": "#...",
    "--openyida-surface": "#...",
    "--openyida-border": "#...",
    "--openyida-text": "#...",
    "--openyida-muted": "#..."
  },
  "layout": {
    "pagePadding": 24,
    "panelPadding": 24,
    "sectionGap": 16,
    "panelRadius": 22,
    "controlRadius": 12
  },
  "form": {
    "theme": "comfortable",
    "labelAlign": "top",
    "formDetailPreset": "clean-card"
  }
}
```

8. 立即生成项目脚手架，可并行执行：

```bash
openyida sample yida-create-form-page form --design-config .cache/openyida/<项目名>/design-runtime.json --output .cache/openyida/<项目名>/scaffolds/form.form.json
openyida sample yida-canvas-custom-page canvas --design-config .cache/openyida/<项目名>/design-runtime.json --output .cache/openyida/<项目名>/scaffolds/canvas.canvas.jsx
```

9. 把 `designFile`、可用 `designRefs`、`design-runtime.json` 和两份脚手架路径交给 `yida-app`；完整应用在 `prd.md` 与 `design.md` 都完成后统一校验并派生页面 spec。

## 完成标准

- `prd/<项目名>/design.md` 已写入。
- `.cache/openyida/<项目名>/design-runtime.json` 已写入并通过 CLI 校验。
- 两份项目脚手架已生成；固定主题运行时、13 个 Yida API、表单抽屉和 iframe 同步仍来自标准脚手架。
- `design.md` 包含 `themeProfile`、tokens、`visualScaffold`、`surfaceContrast`、`roundedRule`、`densityRule`、`breathingRule`、组件、图标、状态和响应式规则。
- 每个 display 页面都有可消费的 `sceneRecipes` 或 `designRefs`。
- 没有写 `prd.md`，没有手写 JSX/TSX/CSS 或运行时 helper。
