# 表单样式与提交页背景

表单通过平台已有变量表达不同风格。按 [整体主题规则](application-theme-consistency.md#导航与应用框架) 将提交、编辑和记录详情与导航、应用框架、自定义页面一起设计，补齐控件、标签、分组、背景和状态。先沿用选中主题，再按填写场景确定具体值，同类表单保持一致。

## 应用风格先于表单选型

**表单支持可组合组件布局，并沿用应用视觉风格。** 顶部、左侧、主体、右侧和字段之间都可放置组件。Tab/切换负责内容切换，按钮组提供操作入口，图片或图形建立视觉焦点，标题与 `Divider`、分栏和状态区组织层级与节奏，字段负责数据采集。每个组件都要有明确作用。普通业务分组和章节分隔使用 `Divider`，横向字段组合使用 `ColumnContainer`。

左侧栏、顶部区、主次分栏和字段间组件都是可用版式。表单支持组合 Tab、按钮、图片、状态区、`Divider`、`ColumnContainer` 和业务字段。为每张表单在 `design.md` 写清组件、区域位置、业务或视觉作用、列宽与窄屏重排，并按抽屉或 iframe 的实际宽度调整。

先读取当前 `design.md` 中已确认的应用风格、字体、表面、线条、圆角、密度与状态规则，再设计提交、编辑和详情页。表单是应用风格的延续，不单独抽取另一套配色或风格；多样性来自不同应用的设计方向，以及同一应用内不同业务任务的合理布局差异，不是让每张表单随机换肤。

| 应用方向示例 | 表单与详情的延续方式 |
| --- | --- |
| 杂志编辑风 | 延续标题字体、纸面底色、细线或强调侧线、章节层级和舒展留白；长说明单列，短字段可用主次分栏，详情保留相同阅读节奏 |
| 精密商务风 | 延续克制圆角、细边界、稳定对齐和紧凑间距，适合成组双列和清晰章节 |
| 柔和服务风 | 延续低对比表面、柔圆控件和宽松标签间距，优先易读单列或舒展双列 |
| 高密度运营风 | 延续紧凑控件、明确网格与分组，按字段长度使用多列或横向标签，窄屏收拢 |

这些是推导示例，不是固定行业映射或新增 preset。不能把杂志风等同于某个固定颜色，也不能让所有风格最后都变成相同白卡、相同圆角和相同间距。

在现有 `design.md` 的组件规则及相关页面说明中写清：表单继承了哪些应用特征、主体宽度、列数/比例、标签位置、字段与组间距、分割线、背景层次、底部操作区和响应式，以及详情如何保持一致。无需新增文档或必填机器字段。

## 实现职责与主题交付

- **设计文件**：风格与页面布局写入 `design.md`；Fast 将 token 写入 `tokens.application-global`，Plan 通过 `visualStyle.tokens` 生成同一份 `design.md`。
- **应用样式**：颜色、字体、控件、状态、背景、详情表面与底栏样式统一进入当前应用的 `app_theme.css` / `app-theme.css`，以实际生成路径为准，通过应用主题设置加载。已有变量优先；需要边框形式、伪元素等额外表达时，仅在核实平台 DOM 后向同一应用 CSS 添加有限作用域规则，并在设计源记录用途。装饰不遮挡输入、不承载必要信息，不用全局 `.next-*` 覆盖所有组件。
- **表单结构**：列数、字段排列和标签位置使用表单属性、`ColumnContainer` 和 `Divider` 配置；不同控件遵守自身能力。应用 CSS 不替代字段结构，也不重排 DOM、伪造字段或改变提交行为。

表单样式使用已验证的平台变量和组件。修改风格时更新设计源和同一份应用主题文件，所有表单复用该主题文件。

## 控件和标签

| 变量 | 平台消费位置 | 未配置时的消费回退 |
| --- | --- | --- |
| `--form-element-medium-corner` | 控件 `border-radius` | `8px` |
| `--form-element-medium-height` | 单行控件 `height`，部分控件的 `line-height` | `32px` |
| `--form-element-medium-font-size` | 控件 `font-size` | `14px` |
| `--input-bg-color` | 输入表面 `background-color` | `#fff` |
| `--input-border-width` | 输入边框宽度 | `1px` |
| `--input-border-color` | 输入边框颜色 | `rgba(24, 28, 31, .12)` |
| `--pod-form-label-color` | 字段标签 `color` | `var(--color-text1-10, rgba(24, 28, 31, .8))` |
| `--color-fill1-6` | 成员选择器末尾按钮等弱图标的前景色 | `#878f95`；深色下按实际输入背景选择可读的辅助前景色 |
| `--form-top-label-margin-b` | 顶部标签 `margin-bottom` | `0` |
| `--yida-divider-secondary-color` | Divider 浅底、胶囊和辅助几何色 | `var(--color-brand1-2)` |

表中的回退不是必须写死的设计值。模板将圆角连接到 `--corner-2`，填充连接到 `--pod-card-bg-color`，边框连接到 `--color-line1-2`，标签连接到 `--color-text1-10`；项目可以按语义单独调整。高度和使用同一变量的行高一起变化，不再增加一个平行行高变量。

### 分割线弱背景

`--color-brand1-2` 表示品牌弱背景，不代表任何主题下都接近白色。根据 `themeProfile.contentTone` 与实际内容底色选择：浅色内容可与白色混合；暗黑/深色内容应与深色画布混合。设计深色方案时，可从主色 12% + `--pod-page-bg-color` 88% 的 sRGB 混合开始，最终按标题可读性与项目风格调整；这不是固定配方，也不能因 `navTheme: dark` 就把浅色内容的品牌弱背景改暗。

主题模式下的原生 Divider 在已验证的平台版本中会内联声明 `--yida-divider-secondary-color: var(--color-brand1-2)`；`inner-ellipse-title` 的内椭圆还会直接内联 `background-color: var(--color-brand1-2)`。继续使用主题模式时，应先在设计源里修正 `--color-brand1-2`，并令应用级 `--yida-divider-secondary-color` 同样引用它；只在 `:root` 把辅助色改为边界色无法覆盖这些声明。这些是默认绑定，不是配色限制；复合样式可按下节使用组件自定义配色。不要用全局 `!important`、逐字段随机配色或改成简单线型掩盖问题。

以上是 Agent 的配色引导，不新增 CLI 参数、自动检查或保存/上传阻断。不要将模板生成或已有命令成功当作分割线可读的证明。预览时关注实际提交页、抽屉和详情里的 `light-left-bar`、`light-bar`、`inner-ellipse-title`：以标题所在子节点的背景为准，而不只看根节点 token。普通标题可按 4.5:1 作为可读性参考；成员选择器等必要图标可按与输入背景 3:1 作为参考。无法预览时说明尚未实测，不宣称已适配。

新建应用时统筹主题色；已有应用只修复少数分割线时，若调整 `--color-brand1-2` 会影响其他消费者，优先按下节配置局部自定义配色。不要为修复一个标题连带更改全局按钮、链接或选中态。

### 内嵌标题与复合分割线

`inner-ellipse-title` 不是单一背景：外层主色横条、内层弱背景胶囊和标题文字分别承担强调、承载和阅读作用。深色方案不能简单套“品牌色横条＋白色胶囊＋浅字”，也不能将整条透明度调低而连带削弱标题。

| 层次 | 已验证的主题模式消费 | 检查要点 |
| --- | --- | --- |
| 外层横条 | `--yida-divider-primary-color` → `--color-brand1-6` | 与内容面协调；观察整页反复出现时的视觉权重，不因装饰面积大就全局调暗按钮和链接共用的主色 |
| 内椭圆 | 直接引用 `--color-brand1-2` | 深色内容使用深色弱背景，与外条保留可辨层次；不能仅检查父节点的辅助色 |
| 标题 | `--color-text1-4`，透过透明文字容器显示内椭圆背景 | 对比度按文字与实际内椭圆底色计算，至少 4.5:1，不按文字与外层主色或页面底色计算 |

双色梯形、徽章、屋顶、六边形等也按实际标题承载区域逐层检查，不能把内椭圆的配色关系机械套给主色实底标题。装饰边界不承担操作状态时，不把它误当按钮边框强制要求 3:1；但标题、必要图标及真正可操作控件仍遵循各自对比度要求。

默认绑定不适合该分割线时，可以配置 `colorType: "custom"`，分别用 `backgroundColor`、`secondaryColor`、`titleColor` 控制主色、辅助色和标题。根据当前主题成组设计，例如单独减弱外条的亮度和饱和度、使用深色内椭圆与可读浅字，不必连带修改按钮和链接共用的应用主色。无需用户逐项指定颜色；同页同层级复用该配色，并记录到现有 `design.md`。自定义配色不会自动跟随应用换肤；修改主题时需同步复核组件配置，不能假设应用 token 校验已经验证了字段里的颜色。

选型时把“可读”与“适合页面”分开判断：高频录入、多分组或长标题的新页面优先比较简单线型和弱底条；内嵌胶囊等强装饰适合有明确强调需求的少量短标题。用户指定或已有样式先保留并修正配色，测试矩阵也保留该样式，不用换形态冒充适配成功。优先用已有组件配色属性表达，不臆造 token 或改全局主色掩盖局部问题。

在提交、详情及实际窄容器分别检查最长标题、内外留白、截断和溢出；纯章节标题不额外添加 hover、指针或点击行为，避免胶囊被误认成按钮。将配色、适用理由和未解决的布局限制记录在现有 `design.md`，随机轮换只在满足这些条件的候选中进行。

以下是不同方向的起点，按主题和真实业务选择，不随机逐字段切换，也不作为 CLI preset：

| 方向 | 控件圆角 / 高度 / 字号 | 填充与边框 | 顶部标签间距 |
| --- | --- | --- | --- |
| 紧凑工具表单 | `4px` / `32px` / `14px` | 内容底色、清晰的 `1px` 细边界 | `4px` |
| 舒展线框表单 | `8px` / `40px` / `14px` | 透明或内容底色、`1px` 细边界 | `8px` |
| 柔和填充表单 | `12px` / `40px` / `14px` | 与内容表面可辨的弱填充、轻边界 | `8px` |
| 暖纸登记表单 | `6px` / `40px` / `14px` | 暖白输入、暖灰边界、深色标签 | `6px` |

多行文本、附件、成员选择和子表保留自身布局，不用全局 `input/textarea/.next-*` 规则强制同一高度。顶部标签间距不代表所有字段的行间距。

默认、hover、focus 和只读详情应成套设计，不能只改默认边框后让聚焦跳回另一套风格。核实当前运行时对 `--input-hover-border-color`、`--input-focus-border-color`、`--input-hover-bg-color`、`--input-focus-bg-color` 等变量的消费与作用域后，写入应用主题；不能假定声明在根部就覆盖组件局部变量。焦点保持可辨，错误、警告、禁用保留独立语义。

## 详情页只读字段数据框

表单详情页使用只读字段数据框展示已提交的数据。修改详情页风格时，将以下 token 与表单控件、卡片和页面画布一起设计，并写入同一份应用主题。背景与卡片形成可辨层次，文字沿用正文色，圆角沿用控件或卡片的形状体系；字号、行高、最小高度、内距和字段间距共同决定信息密度。左侧指示线由指示色与内阴影共同表达，可按当前主题保留、弱化或关闭。

| token | 控制的样式 | 推荐关系 |
| --- | --- | --- |
| `--pod-field-preview-bg-color` | 数据框 `background` | 从当前内容面或弱填充色推导，与 `--pod-card-bg-color` 保持层次 |
| `--pod-field-preview-border-radius` | 数据框 `border-radius` | 与表单控件、卡片使用同一圆角体系 |
| `--pod-field-preview-indicator-color` | 左侧指示线颜色 | 使用当前边界色或主题强调色 |
| `--pod-field-preview-shadow` | 数据框 `box-shadow` 和左侧指示线 | 需要指示线时使用 `inset 2px 0 0 0 var(--pod-field-preview-indicator-color)`；平面风格可用 `none` |
| `--pod-field-preview-text-color` | 数据值 `color` | 使用当前正文色并保证与数据框背景的对比度 |
| `--form-element-medium-font-size` | 数据值 `font-size` | 与编辑态表单值保持同一字号层级 |
| `--pod-field-preview-gap` | 数据框内部元素间距 | 按图标、文本、标签的组合密度确定 |
| `--pod-field-preview-line-height` | 数据值 `line-height` | 与字号配套，保证单行和多行内容可读 |
| `--pod-field-preview-min-height` | 数据框 `min-height` | 与编辑态单行控件高度协调 |
| `--pod-field-preview-padding` | 数据框 `padding` | 与最小高度、行高共同形成垂直和水平留白 |

独立详情页、数据管理详情、抽屉或 iframe 详情都使用这组应用主题 token。设计时在 `design.md` 记录最终值，通过主题生成命令写入 `app-theme.css`，再上传同一份主题文件；验收时分别检查普通文本、关联记录、日期、人员、长文本和空值，并核对 PC、窄屏和抽屉宽度下的计算样式。

## 底部操作区与宽度对齐

`--pod-page-footer-bg-color` 根据应用主题选择与画布或内容表面协调的实色、半透明或透明；不统一强制透明，也不默认白底。`--pod-sticky-footer-box-shadow` 根据材质和层次选取，可为 `none`。区分外层固定区域与内层按钮容器，避免重复背景、双重阴影和无设计依据的边线。

设计表单主题时，这两个变量必须与控件变量一起显式写入设计源并生成到应用 CSS，不能只在正文写“跟随主题”后沿用模板默认值。Fast 写入 `design.md` 的 `tokens.application-global`；Plan 写入 `visualStyle.tokens` 并物化到 `design.md`。正文说明底栏采用哪个表面及是否需要阴影。

| 变量 | 设计决策 | 示例含义 |
| --- | --- | --- |
| `--pod-page-footer-bg-color` | 选择与页面或内容面板协调的底色 | `var(--pod-card-bg-color)` 表示跟随面板；透明仅用于设计需要背景透出的情况 |
| `--pod-sticky-footer-box-shadow` | 按主题选择平面、柔和悬浮或明确层次 | 平面纸张可用 `none`，浮层可用与主题协调的柔影；不统一套用默认黑色双层阴影 |

主体和底栏使用同一内容宽度与水平对齐基准。不能仅为两者设置相同 `max-width` 就认为已对齐；同时检查包含块、百分比宽度、内边距、边框盒、左右 margin、滚动条和平台规则优先级。应用 CSS 的适配限定在已核实的页面/主题作用域，不把实验中的固定尺寸和高优先级覆盖作为所有应用默认值。

当前灰度源码中，居中模式 `.vc-page-content-1180` 的正文与提交按钮栏共同消费 `--pod-page-content-max-width`；自动宽度使用 `--pod-page-auto-width-margin`。优先调整这两个已有变量，不另写两份 `width:calc(...)` 或实验固定宽度。`--pod-page-padding` 控制 PC 正文内距，`--pod-page-inner-group-spacing` 控制居中模式上下留白；移动端另用 `--pod-page-mobile-margin` / `--pod-page-mobile-padding`。宽度 token 不会自动切换页面的布局模式。

底栏变量按实际渲染场景选择，**导航显隐与底栏类型是两个独立维度**。不能用 `isRenderNav=false`、URL 名称或是否在 iframe 中代替运行态判定。变量名保留平台实际大小写 `--pod-formView-stickyFooter-*`，不另造 `form-view-*` 别名。

`factory.js` 根据 `__formRenderEnv__ === 'DATA_MANAGE'` 添加 `.is-data-manage-footer`；新版提交页且在 iframe 抽屉中另加 `.is-in-drawer-submit-footer`。两者可能同时出现，后者在提交页按钮容器样式中有显式适配。`.is-sticky-v2` 是容器内定位，不能套用固定栏的视口偏移和占位规则。

| 场景 | 背景与阴影 | 其他消费项 |
| --- | --- | --- |
| 普通提交（有导航或无导航）/ 抽屉提交的内层按钮容器、详情按钮栏 | `--pod-page-footer-bg-color`、`--pod-sticky-footer-box-shadow` | `--pod-page-footer-border-radius`；该分支外层 `.stickyFooter` 在平台源码中保持透明且无阴影 |
| 管理页表单视图及 `.is-data-manage-footer` | `--pod-formView-stickyFooter-bg-color`、`--pod-formView-stickyFooter-box-shadow` | `--pod-formView-stickyFooter-border`、`--pod-formView-stickyFooter-border-top`、`--pod-formView-stickyFooter`（圆角） |

需要管理页和独立页一致时，在设计源分别配置对应变量，不能通过一条全局 `.stickyFooter` 覆盖抹平场景差异。两类容器有不同层级，阴影不必相同。

应用包含数据管理内的表单视图时，显式确定 `--pod-formView-stickyFooter-bg-color`、`--pod-formView-stickyFooter-box-shadow`、`--pod-formView-stickyFooter-border`、`--pod-formView-stickyFooter-border-top` 及 `--pod-formView-stickyFooter`（圆角）。高度 `--pod-formView-stickyFooter-height` 同时影响外层、按钮行和占位，改变时检查全部三处。`--pod-formView-stickyFooter-bottom` 用于普通固定提交栏；管理页吸底还消费 `--pod-shell-padding`，不能统一强制 bottom 或 left 为零。`--pod-inDrawer-stickyFooter-*` 虽存在于公共定义中，本轮在该仓库的上述分支未发现直接消费，不能仅凭名称认定它能控制 iframe 提交栏。

底部占位在背景连续的布局内处理，避免底部 margin 露出 body 底色；确需从 margin 改成 padding 时，根据实际固定栏高度保留空间，不盲目复制某个固定值。分别检查独立页面、实际 iframe/抽屉宽度与窄屏，左右边缘需符合设计，最后一个字段及错误提示可完整滚动到操作栏上方。

## 提交页的背景分层

`submission/{formUuid}?isRenderNav=false` 隐藏导航，不会取消应用主题，也不要求纯白背景。PC 抽屉里的 iframe 与独立提交页都需要检查；父页面的 CSS 变量不会自动继承进 iframe。

| 层级 | 既有配置 | 作用范围 |
| --- | --- | --- |
| 应用外衬、无导航壳层 | `--pod-app-root-bg-color`、`--pod-app-root-bg-image` | 颜色与图片分开；图片值可为 `none`、渐变或真实 `url(...)` |
| 页面画布、表单内容区 | `--pod-page-bg-color` | 只接受颜色；新版表单可通过 `--yida-form-content-bgcolor` 消费它 |
| 卡片表面 | `--pod-card-bg-color` | 控制卡片及引用它的控件，不替代页面背景 |
| 输入控件内部 | `--input-bg-color` | 独立于外层背景，保证填写内容可读 |

模板通过 `body.pod-premium.page-type-submit .vc-shell-without-nav.pod-premium` 将外衬变量用于新版无导航提交页；平台默认壳层取导航背景，单独声明根背景图变量并不足以显示图片。该规则不修改有导航页面、旧主题或表单字段。渐变或背景图放在外层，内容表面保留可读底色。背景素材必须来自已确定的真实资源，不能让图像妨碍字段阅读；长表单、窄屏和滚动到底部时均应保持连续背景。默认居中靠上、cover、不重复，需要其他铺放方式时在已核实的作用范围调整。

已有表单的 `Page.props.pageStyle`、`contentBgColor` 和 `contentBgColorMobile` 可能保留历史底色；不同运行版本的优先级也可能不同。先查看实际 body、壳层、`.vc-rootcontent` 和控件的计算样式，再通过应用主题或结构化页面属性调整。新表单的透明 `pageStyle` 只是一层默认值，不会自动改变已有表单；表单与详情页视觉统一由应用全局样式管理。

模板显式将 `--yida-form-content-bgcolor` 接到 `--pod-page-bg-color`，避免 DeepContainer 的 inline 变量消费回退到白色。新版 AppThemePage 会过滤 `props.style` 中的自定义属性；因此不能把主题变量写进页面 style 代替应用主题。旧版 LegacyPage 则会在页面局部声明变量，根部设置不保证覆盖它。旧 `.vc-yida-shell-new` 还使用局部 `--vc-form-top-label-margin-b`，并非同名的 `--form-top-label-margin-b`；不要承诺一套 token 改遍所有历史布局。

模板的 hover/focus 边框和 focus 底色已有源码消费者。富文本编辑器使用白色普通背景和固定蓝色焦点阴影时，先核实实际控件，再添加作用域明确的应用级适配，并在验收清单中检查默认、hover 和 focus 状态。

## 写入现有主题源

Fast 将以下变量合并到 `design.md` 的 `tokens.application-global`；Plan 合并到 `build-plan.json` 的 `visualStyle.tokens`，重新物化生成 `design.md` 和 CSS。原有品牌、导航、文字等 token 保留。以下只示范暖纸表单的项目差异，不是所有应用的默认主题：

```json
{
  "--form-element-medium-corner": "6px",
  "--form-element-medium-height": "40px",
  "--form-element-medium-font-size": "14px",
  "--input-bg-color": "#FFFCF6",
  "--input-border-width": "1px",
  "--input-border-color": "#D8CDBD",
  "--pod-form-label-color": "#554B40",
  "--yida-divider-secondary-color": "var(--color-brand1-2)",
  "--form-top-label-margin-b": "6px",
  "--pod-field-preview-bg-color": "#F7F1E7",
  "--pod-field-preview-border-radius": "6px",
  "--pod-field-preview-indicator-color": "#D8CDBD",
  "--pod-field-preview-shadow": "inset 2px 0 0 0 var(--pod-field-preview-indicator-color)",
  "--pod-field-preview-text-color": "#554B40",
  "--pod-field-preview-gap": "4px",
  "--pod-field-preview-line-height": "20px",
  "--pod-field-preview-min-height": "32px",
  "--pod-field-preview-padding": "0 8px",
  "--pod-app-root-bg-color": "#F3EBDD",
  "--pod-app-root-bg-image": "linear-gradient(135deg, #F3EBDD, #E8DDCB)",
  "--pod-page-bg-color": "#FFFCF6",
  "--pod-card-bg-color": "#FFFCF6",
  "--pod-page-footer-bg-color": "var(--pod-card-bg-color)",
  "--pod-sticky-footer-box-shadow": "none",
  "--pod-page-footer-border-radius": "6px",
  "--pod-formView-stickyFooter-bg-color": "var(--pod-page-bg-color)",
  "--pod-formView-stickyFooter-box-shadow": "none",
  "--pod-formView-stickyFooter-border": "none",
  "--pod-formView-stickyFooter-border-top": "1px solid var(--input-border-color)",
  "--pod-formView-stickyFooter": "0 0 6px 6px"
}
```

Fast 更新使用 `openyida sample yida-design app-theme --design-file <design.md> --output <app-theme.css>`；Plan 使用物化结果中的 `outputs.theme`。两条路径都复用现有主题生成器，不新增表单专属主题文件、CLI 参数或一套 preset。已有主题增量更新时保留未修改的变量和定制 CSS。

增量更新不会将新版模板的所有选择器自动合并到旧 CSS。已有主题缺少上述提交页背景规则时，先确认实际 DOM，再将模板中的这一小段规则补入原主题文件；不能省略 `--design-file` 重置整份主题。新建主题已包含该规则。

通过 `openyida update-app <appType> --theme-file <app-theme.css>` 上传并绑定后，读回资源并检查实际页面；本地生成不代表线上生效。已有表单的字段更新不需要重新建表。

## 验证

### 新主题页面消费清单

以下按 `vc-deep-yida` 中的实际消费分组；已有模板变量优先配置，不重复添加同名声明，也不把旧分支或注释里的变量算作新主题能力。

| 页面 / 区域 | 已确认消费的 token | 检查范围 |
| --- | --- | --- |
| 提交 / 编辑原生表单 | `--pod-form-label-color`、`--yida-form-content-bgcolor`、控件自身的 `--form-element-medium-*` / `--input-*` | 新版 AppThemePage 不接收页面 style 中的变量；控件逐项核对，不能沿用 LegacyPage 密度映射的假设 |
| 管理页标题及内容 | `--pod-data-manager-title-padding`、`--pod-page-data-manage-top-padding`、`--pod-page-padding` | 消费在管理页容器，Shell 也有覆盖；不是单张表单字段间距 |
| 管理页表单视图底栏 | `--pod-formView-stickyFooter-*` | 核对 DATA_MANAGE、抽屉提交标记，以及 fixed / sticky-v2 模式 |
| 详情页只读字段数据框 | `--pod-field-preview-bg-color`、`--pod-field-preview-border-radius`、`--pod-field-preview-indicator-color`、`--pod-field-preview-shadow`、`--pod-field-preview-text-color`、`--form-element-medium-font-size`、`--pod-field-preview-gap`、`--pod-field-preview-line-height`、`--pod-field-preview-min-height`、`--pod-field-preview-padding` | 核对数据框与卡片、编辑态控件的色彩、形状、排版和密度关系，并检查长文本与空值 |
| 详情卡片 / 自定义详情 | `--pod-card-bg-color`、`--pod-card-border`、`--pod-card-border-radius`、`--pod-page-inner-group-spacing`、`--pod-page-auto-width-margin` | PC 详情仍有固定最小宽度，不把提交页断点视为详情已支持移动布局 |
| 详情记录历史 | `--pod-card-padding`、`--pod-card-bg-color`、`--pod-card-border`、`--pod-card-border-radius` | 历史面板仍有固定 max-width，源码中注释掉的内容宽度 token 不算有效消费 |
| 门户 / 展示页卡片 | `--pod-card-*`、`--pod-page-inner-group-spacing` | 门户会在特定场景局部重新声明卡片边框，需检查实际作用域 |
| 移动表单 / 移动详情 | `--pod-form-label-color`、`--pod-page-mobile-margin`、`--pod-page-mobile-padding`；详情还用页面背景、组间距和外边距 | 移动端 Meet 控件与安全区有自己的消费路径，不把 PC StickyFooter 规则复制过去 |

公共定义中的 `--pod-detail-*`、`--pod-field-preview-*` 继续保留，但完整只读详情还涉及访问态 owner；不能仅凭本仓库的卡片样式就宣布所有详情字段已覆盖。同样，`--form-element-table-padding`、`--form-icon-scale` 等在本次页面扫描中落在 legacy 路径，不为“补齐 token”而迁到全局新主题。

### 场景验收

- 查看控件包装层、输入文字和标签的计算样式，确认圆角、高度、字号、填充、边框和标签间距实际生效，不能只检查 `:root` 中是否出现变量。
- 分别查看外层背景、表单内容底色和控件填充；外层渐变不能写入 `background-color`。遇到历史 inline 样式，查清来源后只改目标配置。
- 核对长标签、多行文本、选择器、日期、附件、子表，以及焦点、错误和禁用状态；单行行高不能截断内容。
- 检查设计源与生成的应用 CSS 均含显式的 `--pod-page-footer-bg-color`、`--pod-sticky-footer-box-shadow`；再检查底栏实际计算的背景和阴影，排除组件局部变量或旧 CSS 覆盖，不能只检查根变量存在。
- 检查独立提交页、PC 抽屉 iframe、移动端及底部操作区；固定提交按钮不能遮挡最后一个字段。移动端按其实际组件能力验证，不声称 PC token 全部等效。
- PC 分别检查有导航提交、无导航提交、数据管理表单视图、iframe 抽屉提交和详情；有导航时检查侧栏展开/折叠，不手写固定 left 补偿；管理页分别检查 fixed 与 sticky-v2。模板底部 padding 适配按实际固定底栏标记命中，不再依赖无导航 Shell。
- 新版主题、旧版主题与已保存页面分别验证。没有运行态证据时，交付注明“主题已生成/绑定，视觉待验证”。

### 本轮源码核对依据

2026-09-19 拉取的 `origin/trunk-theme-gray`：`yc-common` 为 `5b1a7e0`，`yida-shell` 为 `ec03a98`，`vc-deep-yida` 为 `63d0d5977`。后续适配需重新核对分支，不将此快照视为永久契约。

- `yc-common/styles/_pod_common.scss`：Pod 变量定义；模板已覆盖该文件的变量名，不因默认颜色不同就批量替换主题设计值。
- `yida-shell/src/YidaShell/yida-app-theme.scss`：正文宽度、margin、padding 与无导航容器；`src/Basic/pc.scss`：旧 Shell 标签间距的局部变量。
- `vc-deep-yida/src/vc-form-container/view.less`：两类底栏；`src/vc-page-yida/form/view.less`：提交页底部占位；`src/vc-page-yida/detail/view.less`：详情按钮栏。
- `vc-deep-yida/src/components/deep-container/index.tsx`、`src/vc-page-yida/component/container/{appTheme,legacy}/page.jsx`：内容背景与变量来源；`src/components/deep-editor-field/main.scss`：富文本状态及硬编码边界。
