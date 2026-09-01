# Step 2：选择主题色和 token

> 这一步选择应用主色、辅助色、字体层级、组件基调和宜搭 token 作用域。

视觉方向要从“高级 / 简洁 / 商务”继续落细。PRD 只写应用主题色和风格摘要；`design.md` 写完整 `themeProfile`、主题 token、主色、辅助色、中性色、字体层级和组件基调。

已有应用里的单页重构/美化优先读取并沿用当前应用主题；只有用户明确要求完全不同视觉、独立品牌/活动页、页面级沉浸页、应用导航隐藏后的自绘壳或指定新品牌色时，才做页面级独立主色。

## 选择主题色

先确定主题色来源，再确定是否能传给应用主题接口。主题色来源优先级如下：

| 优先级 | themeColorSource | 触发条件 | 输出规则 |
| --- | --- | --- | --- |
| 1 | `user-specified` | 用户明确给出色值、品牌色、主题 key 或换肤要求 | 原样记录用户意图；命中平台 key 才允许传 `--theme`，任意色值写 token |
| 2 | `application-theme` | 已有应用、工作区、历史命令输出中能读到 `theme`、`colour`、`themeProfile` 或 `customThemeStyle.tokens` | 单页美化和已有应用改造默认跟随；页面主按钮、链接、选中态和图表主序列跟随应用主题 |
| 3 | `platform-preset-match` | 根据业务气质推导出的主题刚好命中平台预置主题 key | 写 `themePresetKey=<key>`，`shouldPassCreateAppTheme=true` |
| 4 | `business-inferred` | 无明确主题证据，需要根据行业、品牌气质、业务情绪和视觉目标推导 | 设计自定义品牌色盘，写 token 和注入方案，`shouldPassCreateAppTheme=false` |
| 5 | `template-default` | 没有任何主题证据且无法稳定推导业务色彩 | 临时使用 Step 5 所选 style-design 的默认 brand token，并明确标记为兜底 |

1. 先判断业务气质：行业、目标用户、品牌关键词、业务情绪、视觉目标，以及是否需要亲和/专业/活力/稳重/科技/自然感。
2. 再判断是否命中平台预置主题 key：命中时写 `themePresetKey=<key>`，创建或更新应用时才允许传 `--theme <key>` / `colour=<key>`。
3. 若设计色不是平台预置主题 key，写 `shouldPassCreateAppTheme=false`，创建应用时不要显式传 `theme/colour`。
4. 自定义色的 token 和注入方式写入 `design.md`，通过 `style#yida-global-theme` 或 `customThemeStyle.tokens` 注入，至少包含 `--color-brand1-6`、`--color-brand1-9`、`--color-brand1-2`、`--color-brand-1` ~ `--color-brand-4` 和 `--color-group`。
5. `podBlue`、`podGreen`、`podOrange` 只是常用浅底候选，不是固定默认。不要因为没有特别说明就自动回到 #1677ff，也不要套用“科技=蓝、宠物=橙、法律=蓝”这类行业刻板配色。
6. 主题色只作为 Step 5 所选设计风格的换肤输入；除用户明确要求深色/夜间/高对比或强品牌独立页外，不用主题色反向决定风格。

## 品牌 token 语义

`design.md` 必须写清 `--color-brand1-*` 与 `--color-brand-*` 的语义。`--color-brand1-*` 是页面和 PC 端主要消费的品牌色阶，`--color-brand-*` 是移动端和部分原生表单/壳层桥接仍会消费的品牌色阶，不能删掉、改名或替换为别的变量。

| token | 语义 | 典型用途 |
| --- | --- | --- |
| `--color-brand1-1` | 明亮品牌浅色或浅 hover 色 | 列表 hover、菜单 hover、轻量背景，不直接当深色文字 |
| `--color-brand1-2` | 品牌浅底 | 标签浅底、提示块、选中底、弱强调背景 |
| `--color-brand1-3` | 品牌透明/浅边界 | 选中边框、禁用/弱化品牌态、浅描边 |
| `--color-brand1-5` | 主色 hover 档 | 主按钮 hover、链接 hover、可点击强调 hover |
| `--color-brand1-6` | 主品牌色 | 主按钮、链接、选中态、重点标签、图表主序列 |
| `--color-brand1-7` | 主色 active 档 | 按下态、active、pressed |
| `--color-brand1-9` | 深主色 | 深色强调、深底按钮、强调标题、深色场景锚点 |
| `--color-brand1-10` | 深色或透明强调档 | 深色 hover、强强调背景、深色主题补充 |
| `--color-brand-1` | 移动端品牌浅/透明档 1 | 移动端壳层、移动端表单、旧版移动组件浅品牌态 |
| `--color-brand-2` | 移动端品牌浅/中档 2 | 移动端 hover、轻量强调、移动端组件浅色面 |
| `--color-brand-3` | 移动端主品牌档 3 | 移动端主操作、选中态、原生表单移动主色 |
| `--color-brand-4` | 移动端深品牌档 4 | 移动端 active、深色强调、移动壳层深色态 |
| `--color-group` | 图表和分类色组 | 多系列图表、排行、状态分组；第一色通常跟随主色 |

自定义色盘生成时，先确定 `--color-brand1-6` 主色，再推导浅底、hover、active、深色和移动端桥接色阶。移动端 `--color-brand-1` ~ `--color-brand-4` 必须保留，不能只输出 `--color-brand1-*`。

## 处理应用主题和页面风格

- 平台导航、顶部壳层或应用菜单可见时，应用主题色是页面主色来源；页面主按钮、链接、选中态、重点标签、图表主序列和表单入口都使用应用主题 `--color-brand1-*`。
- `design.md` 负责布局配方、信息密度、卡片形态、图表语言和视觉 DNA；当 `design.md` 色相与应用主题不同，把 `design.md` 色相降为辅助色、浅背景、分组色或装饰色。
- 需要页面主色明显不同于应用主题时，PRD 只写业务原因：页面级沉浸页、应用导航隐藏后的自绘壳、独立品牌/活动页、公开落地页，或用户明确要求全局换肤；`design.md` 写 `themeScope=app/page`、`themeRelation`、token 和注入方式。
- 若截图或预览中出现左侧导航选中态与页面主操作颜色不一致，优先把页面主操作和高频强调色改回应用主题；只有用户确认要改变整个应用主题时，再调用应用主题配置能力。

## 写颜色角色

- 主色：先按行业、品牌、业务情绪和视觉目标做创意判断，可选择平台预置主题，也可设计自定义品牌色盘；不得固定为 `podBlue` / #1677ff，不得套用行业刻板配色。
- 辅助色：用于按钮强调、状态提示、图表分组和重点指标。
- 中性色：背景、文字、边框、分割线，默认保持浅底业务风。
- 语义色：成功、警告、错误、信息保持稳定，不随意改成品牌色。
- 明暗模式：默认 `light`；`design.md` 的 `themeProfile.navTheme` 保持 `light`。
- `design.md` 的 `themeProfile.colorMode` 是宜搭配色模式，例如 `gradient`，不表示暗黑模式。

`openyida create-app --theme <key>` / `openyida update-app --theme <key>` 只填写平台预置主题 key。完整 key 与 token 见 [应用主题与 token 参考](../references/theme/theme-token-presets.md)。自定义色盘不传 `--theme`，token 和注入方案写入 `design.md`。

## 写字体层级

- 标题、正文、说明文字、数字指标分别建立层级。
- 管理页和列表页保持扫描效率；官网/落地页可以用更强的标题层级。
- 数字指标使用稳定对齐方式，单位、量级和口径一起出现。

## 写风格关键词

按业务选择，而不是只写“高级/简洁”：

- 企业管理：克制、清晰、可扫描。
- 经营看板：指标优先、图表成组、洞察明确。
- 监控大屏：态势清楚、风险突出、远距离可读。
- 品牌官网：真实素材、首屏主张、信任背书。
- 工具协作：高频动作突出、状态和反馈及时。

## 写组件基调

统一按钮、卡片、表格、标签、抽屉、弹窗、图标、空态、加载态和错误态。页面级自定义主题写入 `style#yida-global-theme` 或 scoped token；应用级换肤写 `customThemeStyle.tokens`。

## 产出

```markdown
PRD 主题摘要：
- 应用主题色：<平台预置 key 或自定义色盘名称>
- 风格摘要：<2-3 个业务风格关键词>
- 主题作用域摘要：<app / page；完整配置见 design.md>

design.md Theme Profile：
- themeProfile.name：<平台预置 key 或自定义色盘名称>
- themeScope：<page/app>
- themeColorSource：<user-specified / application-theme / platform-preset-match / business-inferred / template-default>
- themePresetKey：<命中平台预置时填写；自定义色盘留空>
- shouldPassCreateAppTheme：<true 仅限平台预置；false 表示 create-app 不传 theme/colour>
- globalThemeInjection：<style#yida-global-theme / customThemeStyle.tokens / none>
- navTheme：light
- colorMode：<宜搭配色模式，如 gradient；不表示暗黑>
- typography：<标题/正文/数字层级>
- componentTone：<按钮/卡片/表格/标签/抽屉风格>
```

## 下一步

→ [Step 3：规划页面和导航](step-3-information-architecture.md)
