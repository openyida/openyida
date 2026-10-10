# 应用风格模板与自由创意

先决定应用的整体设计语言，再让导航、应用框架、首页、自定义页面、提交/编辑表单与记录详情共同使用它。按 [导航与应用框架](application-theme-consistency.md#导航与应用框架) 同时设计表面、状态、边界、形状、文字和间距。模板提供可执行的起点；**自由创意是同等可用的独立路径**，从业务推演，不要求先匹配模板。已有应用沿用其设计，不为单页重选风格。

## 找到和导出

`openyida design-plan catalog --json` 返回模板 `themes` 与独立的 `creativeOption`。当前索引包含 14 套模板与独立的自由创意入口，均采用三文件目录并可用 `application-style` 导出。18 套 `app-*` 模板暂时移出索引，文件保留，待优化后恢复索引记录；候选只从当前索引取得。目录元数据提供完整设计、CSS 和原生布局的相对路径，可直接定位对应文件。

```bash
openyida sample yida-design application-style --style-id soft-inset-surfaces --output prd/my-app/style-start
openyida sample yida-design application-style --style-id free-creative --output prd/my-app/creative-start
```

每套导出 `design.md`、`app_theme.css`、`form-layout.json`；目标目录中任一同名文件已存在时，CLI 报错并保留原文件。每份 `design.md` 同时包含自定义页面的逐页设计引导，以及表单的组件位置、布局、样式、状态和响应式引导。设计与 CSS 中的品牌颜色保留占位：`--color-brand1-6` 使用 `{{PRIMARY_COLOR}}`，`--color-brand1-1` 按主色生成悬停色，其余品牌档位保持同源。项目占位符与空字段布局是项目化起点；使用时替换真实项目内容、完成最终设计并生成项目主题与表单布局。上传主题时使用项目实际生成的 CSS 路径，`app-theme.css` 与 `app_theme.css` 均可。

## 旧主题应用的样式作用域与确认

绑定前读取目标应用服务端解析的 `appThemeEnable` 与 `appThemeMode`；只有 `y` / `modern` 才沿用新版应用主题上传流程，不能只凭存储的 APP_THEME_MODE、模板或版本号判断。`n`、`legacy` 或无法确认能力时，默认保留平台主题，优先使用自定义页根容器内的局部样式，不向应用写入 `customThemeStyle`，不自动升级主题。页面美化、换颜色或完整应用设计的请求不等于同意旧应用全局 CSS 注入。

旧应用的 `customThemeStyle`（用户也可能称为 `appCustomTheme`）由访问态按当前应用加载，可能覆盖工作台、导航、表单及记录详情；`iframePropagation:false` 不是页面作用域隔离。新版主题文件中的全局变量和选择器不能直接视作旧 Shell/表单的兼容样式。确实需要应用层覆盖时，先核查实际访问页 DOM 与主题消费能力，审阅并缩小 CSS 选择器范围，说明涉及的应用、CSS 文件和影响页面，向用户明确询问：“是否同意将这份 CSS 注入该旧应用的应用层，影响访问页面、导航和表单？”取得该应用的肯定回复后才允许传 `--confirm-legacy-app-style`；不能代替用户确认，也不能遇到阻断后自动追加此参数。没有可用的用户确认通道时停在上传前。

不要把完整应用主题 CSS 包裹在页面根节点后就宣称已兼容；页面局部样式只使用该页面已验证的 DOM/变量，不改 `html`、`body`、顶层 `:root` 或平台导航/表单全局选择器。若用户拒绝应用层注入，交付页面局部方案并说明覆盖范围。

用户要求“去掉应用中的 appCustomTheme / customThemeStyle / 应用级自定义 CSS”时，按宜搭界面关闭“启用主题换肤”的方式执行 `openyida update-app <appType> --disable-custom-theme`。先读取最新基础设置，解析原 customThemeStyle，保留 cssUrl、cssFileName 和其他资源字段，将 enabled 与 iframePropagation 改为布尔值 false，再 JSON.stringify 后以字符串提交到该应用的 query/app/updateApp.json；沿用登录态与 CSRF，其他基础设置取最新回读并保持原值。不能清空 URL，不能传空字符串、null、空对象/数组或只传 {"enabled":false}；原配置缺失或无法解析时停止写入并说明原因。该参数不与其他更新字段同传，不删除 CDN 文件，也不修改页面源码。

保存后核对 themeVerification.verified=true，确认 enabled/iframePropagation 为布尔值 false，URL 与文件名仍为原值。随后刷新真实访问页，确认没有 link#yida-app-custom-theme，且网络请求不再加载原主题 CSS；仅 success=true 或配置回读通过不代表访问态已验证。页面检查失败时报告已提交的非认证字段和实际回读结果，隐藏 Token、Cookie、CSRF 等认证信息。结果描述为“自定义主题 CSS 已停用，资源配置仍保留”；没有浏览器证据时补充“访问态效果待验证”。

## 命令与参数

| 步骤 | 命令与参数 | 输入与结果 |
| --- | --- | --- |
| 查询主题 | `openyida design-plan catalog --json` | 从 `themes[].themeId` 或 `creativeOption.themeId` 取值 |
| 导出三文件 | `openyida sample yida-design application-style --style-id <themeId> --output <目录>` | `--style-id` 必填，支持目录中的全部主题；`--output` 缺省为当前目录下 `.cache/samples/application-style` |
| 生成或更新 CSS | `openyida sample yida-design app-theme --design-file <design.md> --output <CSS路径>` | 设计中的品牌色和派生颜色先填成实际值；同路径更新保留自定义 CSS，并维护旁边的 `<CSS路径>.tokens.md` 更新记录 |
| 绑定新版主题应用（旧主题须先完成上述确认） | `openyida update-app <appType> --theme-file <CSS路径> --nav-theme <light或dark> --layout <side或top或l_shape> --show-app-nav` | 上传后分别核对主题和导航回读，再检查页面实际效果；应用级自绘导航改用 `--hide-app-nav` |

`--style-id` 只用于三文件导出，`--design-file` 只用于主题生成。`--var KEY=VALUE` 用于其他代码示例的占位替换；应用主题的品牌色和导航值写入 `design.md`。`app-theme` 的 `--output` 缺省为 `.cache/samples/app-theme.css`；省略 `--design-file` 会用公共模板重置目标 CSS。三文件导出中的占位 CSS 先经过主题生成，再上传。

`--nav-theme` 选择平台导航明暗，`--layout` 选择结构。平台兼容参数还接受 `white` / `gray`，正式设计使用模板派生的 `light` / `dark`。菜单圆角、普通/悬停/选中边框、选中阴影、项高、内距与间距是[导航 token](application-theme-consistency.md#导航与应用框架)，在 Fast 的设计 token 或 Plan 的 `visualStyle.tokens` 中填写。CLI 读取设计文件后生成消费样式；这些值没有单独的命令行开关。较早的 CSS 在设计提供菜单边框 token 后会补齐缺失的菜单形状规则。四种差异明显的组合及访问态验收方式见[案例经验](application-theme-consistency.md#导航形状与密度的案例经验)。

## 主题明暗双轴

`contentTone` 表示页面画布、卡片、表单、详情、自定义页面和浮层采用浅色或暗色界面；`navTheme` 表示平台导航框架采用浅色或深色。两者是独立维度；命名模板从模板元数据派生导航明暗，自由创意由项目明确设计并配套导航 Token。两者独立选择：深色导航可以搭配浅色内容，浅色导航也可以搭配暗色内容。模板名中的“深色侧栏”描述 `navTheme`，应用整体明暗以 `contentTone` 为准。

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

自由创意显式选择 `navTheme`，按业务布局设计框架与菜单，仅填写[必要的导航覆盖项](application-theme-consistency.md#导航与应用框架)，其余沿用平台绑定。Fast 与 Plan 使用同一完整主题文件。

## 验收与维护

看应用整体，覆盖导航、自定义页、提交、编辑、详情、数据管理内嵌、抽屉和移动端，核对正文/底栏对齐、背景连续、hover/focus、禁用/错误和窄屏布局。应用主题与表单组件树共同作为验收基线。

每个主题目录的 `design.md` 是完整视觉设计的唯一维护源：导航、应用框架、自定义页面、表单和详情的颜色、边框、hover、圆角、阴影、字体与密度在同一文件中定义。`form-layout.json` 维护表单结构，`app_theme.css` 是配对生成物；不另建导航配色库或应用风格配置覆盖它们。修改设计后运行 `node scripts/build-application-styles.js`，脚本只编译 CSS，不改写设计正文、Token、表单结构或索引。`npm run check:themes`（即 `node scripts/build-application-styles.js --check`）检查索引内的配对 CSS 是否同步，已接入 `check:quick` 和 CI。新增或恢复模板时添加三文件目录和索引项；未登记模板可保留在目录中，但不参与选型、导出、Plan 生成和默认 CSS 同步检查。已有 Plan 若引用已移出索引的主题，需要恢复该索引记录后才能继续物化；已生成的项目设计和 CSS 可继续使用。随后运行模板、Plan/Fast、原生布局测试及 `check:skills`。该脚本仅用于仓库维护，应用搭建使用上述 CLI。
