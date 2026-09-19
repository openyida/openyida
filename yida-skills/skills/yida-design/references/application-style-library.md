# 应用风格模板与自由创意

先决定应用的整体设计语言，再让导航、首页、自定义页面、表单、编辑与详情共同使用它。模板提供可执行的起点；**自由创意是同等可用的独立路径**，从业务推演，不要求先匹配模板。已有应用沿用其设计，不为单页重选风格。

## 找到和导出

`openyida design-plan catalog --json` 返回模板 `themes` 与独立的 `creativeOption`。本次新增的 18 套应用风格标记 `collection: application-styles`；已有主题保持兼容。目录元数据含完整设计、CSS 和原生布局的相对路径，不需要猜路径。

```bash
openyida sample yida-design application-style --style-id app-executive --output prd/my-app/style-start
openyida sample yida-design application-style --style-id free-creative --output prd/my-app/creative-start
```

每套导出 `design.md`、`app_theme.css`、`form-layout.json`。导出拒绝覆盖现有文件。这里的设计保留项目占位符，CSS 为示范配色，布局只有结构和占位标题：三者都是设计起点，不能原样当成最终交付或直接发布。不要把目录中的参考 `app_theme.css` 与项目正在维护的主题同时上传。

## 18 个应用方向

| ID | 风格 | 构图与表单差异 |
| --- | --- | --- |
| app-wire | 精密线框 | 工具带、细边界、稳定双列 |
| app-paper | 奶油手账 | 窄幅纸页、题签、单列长阅读 |
| app-sage | 植物浮雕 | 柔绿分区、轻内凹、宽松双列 |
| app-pop | 波普印刷 | 大标题、粗边与硬阴影、二比一布局 |
| app-neon | 午夜霓虹 | 暗色技术工作区、局部微光、双列 |
| app-line | 极简下划线 | 窄单列、纯文字标题、强调线 |
| app-glass | 雾面玻璃 | 雾紫衬底、轻透层次、舒展双列 |
| app-ticket | 复古票据 | 票据抬头、双线、窄幅键值阅读 |
| app-editorial | 杂志编辑 | 左侧衬线大标题与导语、右侧正文 |
| app-terminal | 终端像素 | 等宽标题、点线、紧凑记录集合 |
| app-platinum | 铂金商务 | 铂灰细线、合同摘要、均衡双列 |
| app-executive | 墨金行政 | 香槟金标题、左介绍栏、右单列章节 |
| app-finance | 金融蓝图 | 编号章节、水平标签、紧凑双列 |
| app-nordic | 北欧云白 | 大段间距、柔白、单列服务流程 |
| app-teal | 青岚运营 | 状态带、主次二比一、任务流 |
| app-amber | 琥珀工单 | 三列短字段、长字段跨栏、紧凑工单 |
| app-graphite | 石墨数据 | 暗色连续表格、细行线、双列 |
| app-plum | 绛紫咨询 | 衬线导语、双线章节、七比五分栏 |

这不是行业到风格的硬映射。暗色方向仅在用户或使用环境明确需要时选择。单行控件的半径、高度、边界及状态与布局一起设计，不能只换主色。装饰在原生控件中能否成立取决于已核实的平台能力；不能为了复刻名称而覆盖整个组件库。

## Fast 与 Plan 如何消费

- **Fast**：选定方向后导出一套起点，按唯一输出契约补成最终 `design.md`；保留其 `applicationStyle` 消费标记，删除模板 `themeId`，填入真实项目、颜色、页面与引用，完成 `check-design`。然后运行 `openyida sample yida-design app-theme --design-file <design.md> --output <app_theme.css>`。共享生成器会携带这组应用风格的语义类配方，后续重生成保留配方之外的自定义 CSS。
- **Plan**：`design-plan init` 使用目录中的 `themeId`（`--theme-id`），项目差异放 `visualStyle.tokens`，各页布局写入已有逐页设计。CLI 物化时生成正式 `design.md` 与返回路径中的 `app-theme.css`；文件名沿用 Plan 契约，不另生成第二份应用主题。
- **实现**：应用级上传一次项目 CSS。Canvas 读取设计里的 Token，并可使用 `.oyd-style-workspace`、`.oyd-style-intro`、`.oyd-style-section`；原生页面通过平台 Token 与 Schema 消费。类名不是自动布局引擎，自定义页面必须落实具体构图。
- **原生表单**：读取 `form-layout.json`，替换标题说明，在各列填入 PRD 的真实字段，再交给 `create-form`。`design.md` 不会自动变成 Schema；按设计设置列比例、间距、移动端纵向排列和长字段整行。`--theme compact` 等密度参数不能替代明确的 Schema 和应用 CSS。

布局结构可以比普通字段更丰富：截图式介绍栏由外层 `ColumnContainer` 的 `3:9` 布局、左列 `Divider.title/description` 和右列业务字段组成；章节使用原生 Divider。业务文字不能写进伪元素。Divider 展示效果不足时，降级为顶部介绍，不能写加载代码或跨 iframe 注入。原生展示效果仍需在当前平台版本验证。

## 自由创意必须能独立完成

选择 `free-creative` 表示**不选择任何现成视觉模板**。基础文件只是平台合法 Token 的编写骨架，没有被选中的风格；不要把模板改名充当自由设计。比较候选时必须提供“自由创意：根据这项业务重新推演”这一项；已委托 AI 的 Fast 可直接采用它，不追加无必要确认。

Plan 将下列对象写入 `visualStyle.creativeDirection`；Fast 写入最终设计 frontmatter 的 `creativeDirection`。用真实、具体的项目决策替换说明文字：

```json
{
  "businessRationale": "用户、使用频率、业务重点，以及为何采用此视觉方向",
  "composition": "导航、标题区、主体、上下文区域的位置和宽度",
  "typography": "正文、标题、数字的字体、层级和对齐关系",
  "material": "画布、内容面、边界、阴影与状态的关系",
  "formLayout": "提交、编辑、详情的列比例、间距、介绍区、底栏和窄屏规则"
}
```

Plan 的 `visualStyle.tokens` 必须显式提供：画布 `--pod-page-bg-color`、表面 `--pod-card-bg-color`、文字 `--color-text1-4`、控件 `--form-element-medium-corner` / `--form-element-medium-height`、底栏 `--pod-page-footer-bg-color` / `--pod-sticky-footer-box-shadow`，以及自定义页面 `--oyd-content-width` / `--oyd-content-padding` / `--oyd-field-gap` / `--oyd-heading-font` / `--oyd-heading-size` / `--oyd-rule-style`。其余角色同样按完整设计配套，数据管理外层底栏与按钮内层分别决定。Fast 将这些值写入设计的 Token 分组。缺少决策或关键值时生成器报错，不自动选一套模板。

## 验收与维护

看应用整体，不能只看首页截图：导航、自定义页、提交、编辑、详情、数据管理内嵌、抽屉和移动端，核对正文/底栏对齐、背景连续、hover/focus、禁用/错误和窄屏布局。原生无注入对照只作为平台基线，不作为“自由创意”结果。

维护配对资产时修改 `templates/application-styles.json` 与共用配方，再运行 `node scripts/build-application-styles.js`；随后运行模板、Plan/Fast、原生布局测试及 `check:skills`。该脚本仅用于仓库维护，应用搭建使用上述 CLI。
