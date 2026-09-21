# 应用风格模板与自由创意

先决定应用的整体设计语言，再让导航、应用框架、首页、自定义页面、提交/编辑表单与记录详情共同使用它。按 [导航与应用框架](application-theme-consistency.md#导航与应用框架) 同时设计表面、状态、边界、形状、文字和间距。模板提供可执行的起点；**自由创意是同等可用的独立路径**，从业务推演，不要求先匹配模板。已有应用沿用其设计，不为单页重选风格。

## 找到和导出

`openyida design-plan catalog --json` 返回模板 `themes` 与独立的 `creativeOption`。全部 34 个主题入口统一采用三文件目录，均可用 `application-style` 导出；其中 18 套应用风格与自由创意仍保留 `collection: application-styles` 分类。目录元数据提供完整设计、CSS 和原生布局的相对路径，可直接定位对应文件。

```bash
openyida sample yida-design application-style --style-id app-executive --output prd/my-app/style-start
openyida sample yida-design application-style --style-id free-creative --output prd/my-app/creative-start
```

每套导出 `design.md`、`app_theme.css`、`form-layout.json`；目标目录中任一同名文件已存在时，CLI 报错并保留原文件。每份 `design.md` 同时包含自定义页面的逐页设计引导，以及表单的组件位置、布局、样式、状态和响应式引导。设计与 CSS 中的品牌颜色保留占位：`--color-brand1-6` 使用 `{{PRIMARY_COLOR}}`，`--color-brand1-1` 按主色生成悬停色，其余品牌档位保持同源。项目占位符与空字段布局是项目化起点；使用时替换真实项目内容、完成最终设计并生成项目主题与表单布局。上传主题时使用项目实际生成的 CSS 路径，`app-theme.css` 与 `app_theme.css` 均可。

## 命令与参数

| 步骤 | 命令与参数 | 输入与结果 |
| --- | --- | --- |
| 查询主题 | `openyida design-plan catalog --json` | 从 `themes[].themeId` 或 `creativeOption.themeId` 取值 |
| 导出三文件 | `openyida sample yida-design application-style --style-id <themeId> --output <目录>` | `--style-id` 必填，支持目录中的全部主题；`--output` 缺省为当前目录下 `.cache/samples/application-style` |
| 生成或更新 CSS | `openyida sample yida-design app-theme --design-file <design.md> --output <CSS路径>` | 设计中的品牌色和派生颜色先填成实际值；同路径更新保留自定义 CSS，并维护旁边的 `<CSS路径>.tokens.md` 更新记录 |
| 绑定应用 | `openyida update-app <appType> --theme-file <CSS路径> --nav-theme <light或dark> --layout <side或top或l_shape> --show-app-nav` | 上传后分别核对主题和导航回读，再检查页面实际效果；应用级自绘导航改用 `--hide-app-nav` |

`--style-id` 只用于三文件导出，`--design-file` 只用于主题生成。`--var KEY=VALUE` 用于其他代码示例的占位替换；应用主题的品牌色和导航值写入 `design.md`。`app-theme` 的 `--output` 缺省为 `.cache/samples/app-theme.css`；省略 `--design-file` 会用公共模板重置目标 CSS。三文件导出中的占位 CSS 先经过主题生成，再上传。

`--nav-theme` 选择平台导航明暗，`--layout` 选择结构。平台兼容参数还接受 `white` / `gray`，正式设计使用模板派生的 `light` / `dark`。菜单圆角、普通/悬停/选中边框、选中阴影、项高、内距与间距是[导航 token](application-theme-consistency.md#导航与应用框架)，在 Fast 的设计 token 或 Plan 的 `visualStyle.tokens` 中填写。CLI 读取设计文件后生成消费样式；这些值没有单独的命令行开关。较早的 CSS 在设计提供菜单边框 token 后会补齐缺失的菜单形状规则。四种差异明显的组合及访问态验收方式见[案例经验](application-theme-consistency.md#导航形状与密度的案例经验)。

## 主题明暗双轴

`contentTone` 表示页面画布、卡片、表单、详情、自定义页面和浮层采用浅色或暗色界面；`navTheme` 表示平台导航框架采用浅色或深色。两者是独立维度；命名模板从模板元数据派生导航明暗，自由创意由项目明确设计并配套导航 Token。两者独立选择：深色导航可以搭配浅色内容，浅色导航也可以搭配暗色内容。模板名中的“深色侧栏”描述 `navTheme`，应用整体明暗以 `contentTone` 为准。

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

按业务任务、品牌和使用环境选择风格。暗色方向仅在用户或使用环境明确需要时选择。单行控件的半径、高度、边界、状态与布局一起设计。装饰使用平台已验证的组件和样式能力。

## Fast 与 Plan 如何消费

- **Fast**：选定方向后导出一套起点，按唯一输出契约补成最终 `design.md`；保留模板已有的 `applicationStyle` 消费标记，删除模板 `themeId`，填入真实项目、颜色、页面与引用，完成 `check-design`。然后运行 `openyida sample yida-design app-theme --design-file <design.md> --output <app_theme.css>`。共享生成器会携带这组应用风格的语义类配方，后续重生成保留配方之外的自定义 CSS。
- **Plan**：`design-plan init` 使用目录中的 `themeId`（`--theme-id`），项目差异放 `visualStyle.tokens`，各页布局写入已有逐页设计。CLI 物化时生成正式 `design.md` 与返回路径中的 `app-theme.css`；文件名沿用 Plan 契约，不另生成第二份应用主题。
- **实现**：应用级上传一次项目 CSS。导航读取完整的 `tokens.application-global.appearance.navigation`，平台导航保留原变量消费关系，自定义导航由组件明确引用。Canvas 读取设计里的 Token，并可使用 `.oyd-style-workspace`、`.oyd-style-intro`、`.oyd-style-section`；框架、表单和详情应用同一主题。自定义页面落实具体构图。
- **表单**：先在 `design.md` 写清各区域使用的组件、列比例、间距、长字段整行和移动端重排。`form-layout.json` 提供字段与分栏的初始结构；在各列填入 PRD 字段，并按设计调整布局。`--theme compact` 等参数只设置密度，应用 CSS 负责视觉样式。

表单支持在顶部、左侧、主体、右侧和字段之间放置 Tab、按钮组、图片或图形、标题与 `Divider`、分栏、状态区、辅助内容和字段。各组件分别负责导航切换、操作入口、视觉焦点、状态反馈、内容组织或数据采集。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。

编辑已有表单时保留现有组件。列比例按内容与宽度确定；抽屉和 iframe 按实际宽度重排。

## 自由创意必须能独立完成

选择 `free-creative` 表示**不选择任何现成视觉模板**。基础文件只是平台合法 Token 的编写骨架，没有被选中的风格；不要把模板改名充当自由设计。比较候选时必须提供“自由创意：根据这项业务重新推演”这一项；已委托 AI 的 Fast 可直接采用它，不追加无必要确认。

Plan 将下列对象写入 `visualStyle.creativeDirection`；Fast 写入最终设计 frontmatter 的 `creativeDirection`。用真实、具体的项目决策替换说明文字：

```json
{
  "businessRationale": "用户、使用频率、业务重点，以及为何采用此视觉方向",
  "composition": "导航、标题区、主体、上下文区域的位置和宽度",
  "typography": "正文、标题、数字的字体、层级和对齐关系",
  "material": "画布、内容面、边界、阴影与状态的关系",
  "formLayout": "提交、编辑、详情的组件树、顶部/左侧/主体/右侧区域、列比例、间距、底栏和窄屏重排"
}
```

Plan 的 `visualStyle.tokens` 必须显式提供：画布 `--pod-page-bg-color`、表面 `--pod-card-bg-color`、文字 `--color-text1-4`、控件 `--form-element-medium-corner` / `--form-element-medium-height`、底栏 `--pod-page-footer-bg-color` / `--pod-sticky-footer-box-shadow`，以及自定义页面 `--oyd-content-width` / `--oyd-content-padding` / `--oyd-field-gap` / `--oyd-heading-font` / `--oyd-heading-size` / `--oyd-rule-style`。其余角色同样按完整设计配套，数据管理外层底栏与按钮内层分别决定。Fast 将这些值写入设计的 Token 分组。缺少决策或关键值时生成器报错，不自动选一套模板。

自由创意还需显式写入 [六个基础导航色](application-theme-consistency.md#导航与应用框架) 与 `navTheme`，并按业务布局设计框架、菜单形状、文字、间距及状态。Fast 与 Plan 使用同一完整主题文件。

## 验收与维护

看应用整体，覆盖导航、自定义页、提交、编辑、详情、数据管理内嵌、抽屉和移动端，核对正文/底栏对齐、背景连续、hover/focus、禁用/错误和窄屏布局。应用主题与表单组件树共同作为验收基线。

维护既有主题时修改对应目录的 `design.md` 与 `form-layout.json`；维护导航时修改 `templates/navigation-styles.json`，维护应用风格预设时修改 `templates/application-styles.json` 与共用配方，再运行 `node scripts/build-application-styles.js`；随后运行模板、Plan/Fast、原生布局测试及 `check:skills`。该脚本仅用于仓库维护，应用搭建使用上述 CLI。
