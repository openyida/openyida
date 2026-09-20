# 共享主题模板维护规则

本目录是 Fast、Plan 和单页设计共用的唯一主题库。先读取索引摘要选型，再按 `templatePath` 读取选中的完整模板。索引路径相对 `yida-design`，不相对 Plan 子技能。Plan 的项目化流程见 [visual-design.md](../../sub_skill/yida-design-plan/references/visual-design.md)。

## 文件职责

- [index.json](index.json) 维护主题 ID、用户可读名称、模板路径和选型摘要，`schemaVersion` 为 `2.0`。
- `<themeId>.md` 保存完整 V2 主题模板，是视觉规则和 Token 数值的事实源。
- [basic-tokens.json](basic-tokens.json) 保存 69 个全局变量及固定值，作为模板校验依据。
- [validate_design_themes.py](../../scripts/validate_design_themes.py) 校验索引、模板及变量引用。

每条索引记录包含以下字段：

| 字段 | 维护要求 |
| --- | --- |
| `themeId` | 唯一的小写连字符 ID，与模板 frontmatter 和文件名一致 |
| `label` | 唯一的用户可读名称 |
| `templatePath` | `templates/design-themes/<themeId>.md`，相对公共 `yida-design` 根目录 |
| `styleSummary` | 从模板“风格摘要”精简约 150–250 字，保留外观、核心差异、偏离风险与真实内容适用条件 |

一条索引记录对应一份模板，所有模板均须登记。修改风格摘要后同步修改索引摘要，不增加原文没有的特征或另一组关键词。`openyida design-plan catalog --json` 返回同一份索引；三种设计入口不得维护平行主题清单。主题不按业务领域或产品形态限制候选资格，具体布局与特色表达由真实内容决定。

## V2 模板结构

Frontmatter 包含 `name`、`description`、`themeId` 和 `tokens`。正文依次包含五个章节：

1. 风格摘要
2. 页面视觉系统
3. 基础组件表达
4. 特色表达配方
5. 项目应用与调整规则

特色配方只在页面存在匹配内容时启用，不为套用主题新增业务内容。

## Token 契约

`tokens.application-global` 按 `appearance`（含表面和导航）、`colors`、`typography`、`spacing`、`rounded`、`shadow` 分组，完整定义契约中的 69 个基础变量；这是最小集合，允许按角色补充变量。`tokens.custom-page` 可为空，也可组织跨页面与组件复用的项目扩展变量，包括材质、布局、字体、动效等。两组均写入主题 CSS 的 `:root`，分组不是运行时隔离作用域，变量前缀不限定为 `--oyd-*`。递归读取以 `--` 开头的标量叶子，分组名不拼入 CSS 变量名。

- 字体与间距使用契约固定值；页面标题使用 subhead，表格正文使用 table。
- 颜色与圆角保留主题差异。Tooltip 固定使用 `#262626` 与 `#FFFFFF`。
- `--color-white` 和 `--pod-table-cell-color` 通过 `var(--pod-card-bg-color)` 继承内容表面；页面桥接 `--oyd-page-bg` 若存在，使用 `var(--pod-page-bg-color)`。
- `--color-brand1-6` 使用项目主色占位符，其他品牌档位明确引用这个主色种子推导。`<生成实际色值：…>` 属于推导指令，项目化时替换为实际 CSS 值。
- 变量名在两层及各分组中均唯一；平台基础与项目扩展均在主题中声明，可无环引用，并按实际设计补充变量。声明与正文中的引用必须存在，不得循环引用，不使用后缀缩写或 `*` 通配写法。
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

`check:skills` 还通过 CLI 的公共主题校验检查 `references/theme/app-custom-theme-template.css`，包括括号、字符串和注释闭合、品牌色阶及受限内容。主题生成测试检查 15 套主题的 token 位于顶层 `:root`，并保留白色、灰色导航的变量引用与回退链；不能用正则匹配到变量代替作用域验证。

校验覆盖索引与模板一一对应、ID 和路径安全、五章节与四个项目占位符、分组变量声明、固定值、同源关系、未知与循环引用。测试使用真实共享库，并以缺失字段、非法路径、固定值漂移和错误引用等坏样例验证错误能被拦截。
