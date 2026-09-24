# 共享主题模板维护规则

本目录是 Fast、Plan 和单页设计共用的唯一主题库。先读取索引摘要选型，再按 `templatePath` 读取选中的完整模板。索引路径相对 `yida-design`，不相对 Plan 子技能。Plan 的项目化流程见 [visual-design.md](../../sub_skill/yida-design-plan/references/visual-design.md)。

## 文件职责

- [index.json](index.json) 维护主题 ID、用户可读名称、模板路径和选型摘要，`schemaVersion` 为 `2.0`。
- `<themeId>/design.md` 保存完整 V2 主题模板，是视觉规则和 Token 数值的事实源。
- 每个主题目录统一包含 `design.md`、`app_theme.css`、`form-layout.json` 三个文件；CSS 保留品牌颜色占位，布局文件提供可填入业务字段的组件结构。
- [basic-tokens.json](basic-tokens.json) 保存 71 个全局变量及固定值，作为模板校验依据。
- [validate_design_themes.py](../../scripts/validate_design_themes.py) 校验索引、模板及变量引用。

每条索引记录包含以下字段：

| 字段 | 维护要求 |
| --- | --- |
| `themeId` | 唯一的小写连字符 ID，与模板 frontmatter 和主题目录名一致 |
| `label` | 唯一的用户可读名称 |
| `templatePath` | `templates/design-themes/<themeId>/design.md`，相对公共 `yida-design` 根目录 |
| `cssTemplatePath` | `templates/design-themes/<themeId>/app_theme.css` |
| `formLayoutPath` | `templates/design-themes/<themeId>/form-layout.json` |
| `legacyTemplatePath` | 已迁移主题的原 Markdown 路径，供历史方案读取；新方案使用 `templatePath` |
| `styleSummary` | 以“深色/浅色导航，深色/浅色内容界面。”开头，再从模板“风格摘要”精简约 150–250 字；使用自然语言，避免把 `dark` 误解为纯黑色，同时保留外观、核心差异、偏离风险与真实内容适用条件 |

34 个主题入口均采用三文件结构，可通过 `sample yida-design application-style --style-id <themeId>` 导出。一条索引记录对应一个主题目录，所有模板均须登记。修改风格摘要后同步修改索引摘要，不增加原文没有的特征或另一组关键词。`openyida design-plan catalog --json` 返回同一份索引；三种设计入口不得维护平行主题清单。主题不按业务领域或产品形态限制候选资格，具体布局与特色表达由真实内容决定。

## V2 模板结构

Frontmatter 包含 `name`、`description`、`themeId`、`navTheme` 和 `tokens`；`navTheme` 只允许 `light` 或 `dark`，并与主题导航 Token 的实际明暗一致。正文依次包含五个章节：

1. 风格摘要
2. 页面视觉系统
3. 基础组件表达
4. 特色表达配方
5. 项目应用与调整规则

特色配方只在页面存在匹配内容时启用，不为套用主题新增业务内容。

## Token 契约

`tokens.application-global` 按 `appearance`（含表面和导航）、`colors`、`typography`、`spacing`、`rounded`、`shadow` 分组，完整定义契约中的 71 个基础变量；这是最小集合，允许按角色补充变量。`tokens.custom-page` 可为空，也可组织跨页面与组件复用的项目扩展变量，包括材质、布局、字体、动效等。两组均写入主题 CSS 的 `:root`，分组不是运行时隔离作用域，变量前缀不限定为 `--oyd-*`。递归读取以 `--` 开头的标量叶子，分组名不拼入 CSS 变量名。

- 字体与间距使用契约固定值；页面标题使用 subhead，表格正文使用 table。
- 颜色与圆角保留主题差异。Tooltip 固定使用 `#262626` 与 `#FFFFFF`。
- `--color-white` 和 `--pod-table-cell-color` 通过 `var(--pod-card-bg-color)` 继承内容表面；页面桥接 `--oyd-page-bg` 若存在，使用 `var(--pod-page-bg-color)`。
- `--color-fill1-6` 是平台弱图标与辅助操作色，原生成员选择、树形展开等图标会消费它；默认跟随 `--color-text1-3`，深色内容界面不得依赖固定 `#878f95` fallback。
- `appearance.native-form` 可补充原生表单组件语义变量。`--yida-divider-secondary-color` 控制 Divider 的浅底和辅助几何色，默认引用 `var(--color-brand1-2)`。品牌弱背景应随内容明暗设计；深色内容不能保留近白底，也不能仅改根级辅助色而忽略组件的内联绑定。复合分割线可按当前主题成组自定义配色，详见[分割线弱背景与标题搭配](../../references/native-form-styles.md#分割线弱背景)。
- `design.md` 与 `app_theme.css` 中，`--color-brand1-6` 保留 `{{PRIMARY_COLOR}}`，`--color-brand1-1` 保留品牌悬停色的同源生成占位，其他品牌档位也由主色种子推导。`<生成实际色值：…>` 属于推导指令，项目化时替换为实际 CSS 值。先完成项目 `design.md`，再运行 `sample yida-design app-theme --design-file <design.md> --output <app_theme.css>`；该命令会替换导出 CSS 的占位。
- 变量名在两层及各分组中均唯一；平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。声明与正文中的引用必须存在，不得循环引用，不使用后缀缩写或 `*` 通配写法。
- 原生导航选中项阴影统一由 `--pod-nav-menu-item-selected-shadow` 控制；不需要额外标记的主题显式写 `none`，需要标记的主题写完整 `box-shadow` 值。该值不绑定方向：左、右、下强调线分别使用正水平偏移、负水平偏移、负垂直偏移的 `inset` 阴影。公共 CSS 模板负责消费该变量，主题模板不保存平台 DOM 选择器。
- 标量可用双引号、单引号或普通 CSS 文本；数字可以不加引号。不使用 YAML 数组、别名、标签或多行标量。

## 项目化占位符

| 占位符 | 数据来源 |
| --- | --- |
| `{{PROJECT_NAME}}` | 项目名称；Plan 使用 `meta.projectName` |
| `{{PRIMARY_COLOR}}` | 已选项目主色；Plan 使用 `visualStyle.forUser.colorStrategy.primaryColor` |
| `{{COLOR_SOURCE}}` | 主色来源；Plan 使用 `visualStyle.forUser.colorStrategy.source` |
| `{{PAGE_APPLICATIONS}}` | 基于页面事实、主题规则和逐页配方选择生成的项目应用说明 |

## 维护与校验

新增、修改或删除主题时，同步更新模板与索引，然后从仓库根目录运行：

```bash
python3 yida-skills/skills/yida-design/scripts/validate_design_themes.py
npm run check:skills
```

校验器只依赖 Python 3.9+ 标准库；`check:skills` 自动尝试 `python3`、`python`、Windows 的 `py -3`，找不到可用解释器时明确失败，不能跳过。`check:ci` 已包含 `check:skills`。

`check:skills` 还通过 CLI 的公共主题校验检查 `references/theme/app-custom-theme-template.css`，包括括号、字符串和注释闭合、品牌色阶及受限内容。主题生成测试检查全部主题的 token 在包含顶层 `:root` 的统一声明块中只定义一次，并验证平台 light、dark、white、gray 模式使用同一套配色；不能用正则匹配到变量代替作用域验证。

校验覆盖索引与模板一一对应、ID 和路径安全、五章节与四个项目占位符、分组变量声明、固定值、同源关系、未知与循环引用。测试使用真实共享库，并以缺失字段、非法路径、固定值漂移和错误引用等坏样例验证错误能被拦截。

配色维护：先按实际文字/背景角色检查可读性，再看大面积颜色与状态强度。`check:themes` 拦截模板编译后的低对比或无法解析组合；`tests/palette-contrast.test.js` 对全部模板替换七组主色，覆盖正文、表单、详情、导航与搜索。测试不替代实际组件和渐变背景的浏览器检查。
