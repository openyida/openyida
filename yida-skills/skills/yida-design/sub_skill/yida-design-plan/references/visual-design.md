# 视觉规划与 design.md 生成规则

## 用途与边界

本文件供复杂视觉定制时按需查阅。常规规划使用紧凑契约和 CLI 返回的主题上下文。完整主题模板决定视觉设计内容和文档结构；本文件负责选择结果校验、项目事实融合、页面视觉应用和交付检查。

```text
PRD 决定做什么
页面规划决定内容如何组织
完整主题模板决定既定结构如何呈现
```

视觉生成保持 PRD 中的页面核心任务、内容优先级、首屏结构、页面模式和信息密度不变。正常生成应用时不读取 [主题模板维护说明](../templates/design-themes/README.md)；该文件只用于维护主题模板库。

## 运行时输入

CLI 生成项目 `design.md` 时读取：

1. 当前版本 `build-plan.json`：项目事实、产品形态、页面规划、视觉证据、项目视觉方向、主题色、导航选择和内部选中主题。
2. [主题索引](../templates/design-themes/index.json)：校验内部 `selectedTheme`，取得 `defaultProfile` 和模板路径。
3. 内部选中主题对应的完整模板：作为项目 `design.md` 的设计底稿。
4. [page-patterns.md](page-patterns.md)：解释各页面已经确定的页面模式。

CLI 完整读取选中的模板，不假设模板的章节、frontmatter 或内容组织方式。主题模板内部结构由模板自身维护。

## 产物关系

| 产物 | 面向对象 | 内容 |
| --- | --- | --- |
| `build-plan.html` | 用户确认 | 项目视觉方向、色彩策略、导航选择和素材缺口摘要 |
| `prd.md` | 后续 AI 开发 | 业务、数据、流程、页面任务、内容优先级、页面模式和权限 |
| `design.md` | 后续 AI 开发 | 完整主题模板的项目实例、组件状态和逐页视觉应用 |

主题 ID、模板路径等实现身份只保存在 `build-plan.json` 内部或物化内存中。最终 `prd.md`、`design.md` 和 `build-plan.html` 不展示主题模板名称、ID、路径或来源。页面实现阶段只读取最终 `prd.md` 和 `design.md`。

## 生成顺序

1. 校验 `visualStyle.internal.selectedTheme.themeId`，并从索引确定性取得模板路径；兼容旧计划时可读取 `forUser.selectedTheme`。
2. CLI 完整读取该路径指向的模板；模型使用初始化返回的主题上下文。
3. 以索引中的 `defaultProfile` 为起点，由 materialize 补齐 `themeProfile`；该摘要只读。模型将用户要求、品牌规范和可访问性约束落实为 `visualStyle.tokens`，主题色写入 `colorStrategy`。
4. 根据 `meta.experienceTopology`、页面范围和前后台边界生成 `visualStyle.forDesignMd.productTopologyApplication`，说明全应用共享主题基础语言、记忆点按真实页面内容使用；该字段不判断主题是否适用，也不增删页面或业务能力。
5. 保持 `pages.customPageDetails[]` 中的页面模式、内容优先级、首屏结构和信息密度；模型只生成每页 `visualMemoryApplications`，页面基础视觉应用由 materialize 从主题模板补齐。
6. 根据 `PRIMARY_COLOR` 推导模板要求的 Brand Token 和自定义页主题衍生色；导航背景按 `light → --color-brand1-3`、`dark → --color-brand1-5` 映射。
7. 由 materialize 在单一位置注入“项目视觉选择”，写明视觉方向、主题色、导航结构、导航明暗、导航背景 Token 和选择依据；不要求所有主题模板预留空字段。
8. 按模板自身结构写入其他项目事实、页面模式、页面视觉应用和素材状态；模板定义的占位符全部替换。
9. 保留模板中的视觉 DNA、消费规则、组件规则和交付检查，同时从最终项目文档移除主题 ID、模板名称、路径等内部身份字段。
10. 将 `build-plan.json`、`prd.md` 和 `design.md` 写入同一个 `meta.revision`，再执行交付检查。

Step 4 不重新发起常规视觉 `ask_human`。页面规划新暴露品牌素材冲突或前后台表达边界冲突时，返回 Step 2 更新视觉选择。

## 页面级视觉应用

每个自定义页面必须在 `visualStyle.forUser.pageApplications` 中有一条紧凑记录：

```json
{
  "pageId": "procurement-workbench",
  "visualMemoryApplications": [
    {
      "name": "<模板中的视觉记忆组件名称>",
      "renderPolicy": "adapt_existing_slot | prd_match_only | direct | suggest_only",
      "target": "<PRD 已有的指标、分类、进度、图表或其他内容槽位>",
      "reason": "<该页面内容满足此记忆点内容契约的依据>"
    }
  ]
}
```

`pageName`、页面模式引用、基础表面、主操作、状态说明和 `visualMemories` 由 materialize 派生。模型只负责把模板记忆点绑定到真实内容，不改写 `contentPriority`、`firstScreenStructure`、`layoutPattern` 或 `density`。

### 全应用继承与逐页生成

1. 原生表单、流程页面和自定义页面共同消费模板 `tokens.application-global` 中的颜色、字体、间距和圆角；自定义页面再消费模板的 `tokens.custom-page`。
2. 生成器只遍历 `pages.customPageDetails[]` 中真实存在的自定义页面，不预先枚举工作台、列表、表单、详情等全部可能页面类型。
3. 每页先绑定主题画布、表面、文字、边界、主操作和状态语言，再读取该页的功能区块与真实组件。
4. 筛选、输入、表格、列表、图表、指标、状态和操作等组件只在页面规划已经包含对应内容时写入 `visualApplication`、`surface`、`primaryAction` 和 `states`。
5. 页面基础消费完成后，再按“页面级视觉记忆点应用”匹配主题记忆点；没有匹配记忆点的页面仍完整继承主题基础设计语言。
6. `{{PAGE_APPLICATIONS}}` 只渲染项目真实页面的应用结果，不输出项目中不存在的页面类型说明。

### 页面级视觉记忆点应用

1. 读取选中模板“视觉记忆点应用策略”中的 `content_contract`、`render_policy`、适配目标和 fallback。
2. 用当前页面已有的业务内容逐项判断内容契约；匹配时选择 1–3 个主记忆点，无匹配内容时记录空数组，同一页面不要求使用模板的全部记忆点。
3. `adapt_existing_slot` 和 `prd_match_only` 只绑定 PRD 已有内容；无匹配内容时不渲染该组件，并保留模板配方供后续真实内容使用。
4. 会新增业务能力、字段、对象或虚构数据的记忆点标记为 `suggest_only`，不进入默认页面实现。
5. `visualMemories` 由 `visualMemoryApplications[].name` 派生，用于 `prd.md` 和 `build-plan.html` 展示；结构化应用记录用于生成 `design.md`。

## 冲突处理

按以下优先级合并视觉规则：

```text
可访问性与真实素材要求
> 用户明确视觉约束
> 品牌与参考素材
> 已选完整主题模板
> AI 补齐
```

- 页面任务与主题冲突：保留页面任务和页面模式，调整主题在该页的应用强度。
- 品牌色与模板示例色冲突：保留品牌色，复用模板的色彩角色和使用策略。
- 用户要求与模板必须保留特征冲突：返回主题选择阶段，选择更匹配的完整模板。
- 前后台表达不同：共享主题 Token、字体、图标和状态体系；前台提高品牌强度，后台使用同主题的克制变体。

## build-plan.html 展示边界

`build-plan.html` 只展示用户能判断和调整的视觉结果：

- 一句话视觉主题和确认来源
- 品牌色或主题色来源与使用强度
- 表面、对比、圆角、阴影、图标和动效摘要
- 页面级视觉应用与跨页面视觉记忆点
- 状态、响应式、可访问性和素材缺口摘要

模板名称、主题 ID、模板路径、模板全文、候选评分和内部实例化过程保存在内部数据中，不进入任何用户可见派生产物。

## 交付检查

- 内部 `selectedTheme` 的 ID 存在于主题索引，物化后的路径与同一索引记录一致。
- `visualDirection`、`colorStrategy` 和 `navigationStyle` 完整，导航结构与明暗值合法。
- `design.md` 包含项目视觉选择章节，导航背景 Token 与明暗选择一致。
- `design.md` 不包含主题 ID、模板名称或模板路径。
- 物化后的 `themeProfile` 以同一索引记录的 `defaultProfile` 为基础，；用户与品牌的具体 CSS 差异写入 `visualStyle.tokens`，再由 CLI 应用到 `design.md`。
- `design.md` 没有未解析的 `{{...}}` 占位符、Token 推导指令或无关示例业务数据。
- `PRODUCT_TOPOLOGY_APPLICATION` 已由产品形态、页面范围和前后台边界生成，且没有改变页面规划。
- 每个自定义页面都有页面模式摘要和页面视觉应用。
- 所有页面共享全应用 Token；`PAGE_APPLICATIONS` 只包含项目真实存在的自定义页面。
- 每条页面视觉应用只消费页面规划中已有的组件和内容。
- 每个页面只应用满足内容契约的视觉记忆点；无匹配内容时没有虚构指标、分类、进度或图表。
- 页面视觉应用与 PRD 的内容优先级、首屏结构、页面模式和信息密度一致。
- 状态覆盖加载、空态、错误、禁用、无权限、选中和移动端。
- 官网、品牌页和展示页记录真实素材来源或素材缺口。
- `build-plan.json`、`prd.md` 和 `design.md` 使用同一版本。

具体 token 差异写入 `visualStyle.tokens`（单行字符串值），不能只修改 `themeProfile.radiusScale` 等摘要而期待 CSS 改变。应用主题使用公共模板与 `sample --design-file` 流程；主题 Markdown 模板用于设计规则，不能替代公共 CSS 模板。
