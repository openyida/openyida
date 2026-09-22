# 输出：design.md

本文件是 Fast、Plan 和单页设计共同使用的唯一项目设计输出契约。Fast 手写项目 `design.md`，Plan 由 CLI 物化生成；两条流程保留各自编写方式，交付相同格式并使用同一校验。

业务对象、数据、流程、页面范围与操作由需求和 PRD 决定；主题选择按 [共享规则](../references/theme-selection.md) 执行。项目文件自包含，实现阶段读取 PRD 与 `design.md`，不再回到主题库推断规则。

## 内容职责

| 内容 | 唯一存放位置 | 用途 |
| --- | --- | --- |
| 项目身份、主题交付、最终 token、素材与图标映射 | frontmatter | 供 CLI 确定性读取；正文解释用途，不重复维护取值 |
| 页面、组件、状态的定位索引 | frontmatter | 只保存稳定 ID 与正文 anchor，不复制规则全文 |
| 视觉系统、组件机制、特色配方、具体页面设计与验收 | 正文 | 供实现者阅读；每条完整规则只写一次 |
| 候选、主题模板身份、生成过程、编写说明 | 内部选择记录或技能文档 | 不进入最终项目设计 |

`version`、`design_id`、`yidaThemeDelivery` 不再是项目必填字段；版本格式由 `schemaVersion` 表示，主题交付统一放在 `themeProfile`。正文可以沿用“布局骨架、表面层次、形状、密度、呼吸节奏”等设计概念，不强制重复建立 `visualScaffold` 或几十个英文字段。

## frontmatter 规范

文档从 YAML frontmatter 开始，完整解析为对象。字符串统一使用正确转义的引号；项目名称、说明包含引号、冒号或换行时不能直接拼接。以 `#` 开头的 HEX 颜色必须加引号，否则 YAML 会将其当作注释；token 数值可写数值或字符串。旧文件的读取兼容不作为新输出格式。frontmatter 结束后先出现唯一 H1，再写下述五章。

| 字段 | 必填与格式 |
| --- | --- |
| `schemaVersion` | 必填字符串 `"1.0"` |
| `name` | 必填，当前项目名 |
| `description` | 必填，当前项目视觉用途说明 |
| `tokens.application-global` | 必填，保留 appearance、colors、typography、spacing、rounded、shadow 六组基础变量，具体变量名与默认值以 [基础变量契约](../templates/design-themes/basic-tokens.json) 为准 |
| `tokens.custom-page` | 必填对象，保存项目扩展变量，可跨页面和组件共用；没有额外变量时允许空对象 |
| `themeProfile` | 必填，字段见下一节 |
| `sceneRecipes` | 必填对象，按场景记录真实页面的 `pageId` 与 `anchor`；没有自定义页时为 `{}` |
| `components` | 必填对象，每项仅为 `{anchor: "#component-…"}`；只登记有具体正文规则的组件 |
| `states` | 必填对象，每项仅为 `{anchor: "#state-…"}`；只登记有具体正文规则的状态 |
| `assetStrategy` | 必填，保持单行 JSON；至少 `{ "pages": [] }`，实际页面按素材契约填写 |
| `iconSystem` | 必填，`{library: "lucide-react", mappings: {}}`；library 仅为 `lucide-react` 或 `@ant-design/icons`，mappings 将实际业务语义映射到具体图标组件，无图标时为空对象 |
| `buildPlanRevision` | 仅 Plan 可选，用于与当前计划版本对应；Fast 不补造计划版本 |

`tokens` 中每个 `--token` 只占一行具体 CSS 值，可以带行尾注释。数值、颜色、变量引用均须能解析为有效单行值；不得遗留占位符、推导指令、同名冲突值或多行标量。字体与间距使用主题默认值，明确项目定制可以写入合法覆盖；`--color-white`、`--pod-table-cell-color` 的桥接关系及 Tooltip 固定值仍按公共契约保持。应用全局的七个品牌色阶为 1/2/3/5/6/9/10，不补造 4/7/8。分组只用于组织，CSS 变量使用叶子的完整原名；可引用同份主题中声明的项目变量，不能依赖只在页面选择器内定义的值。移动端品牌桥接由公共 CSS 模板保留，不能删改其变量名。

### themeProfile

`contentTone` 与 `navTheme` 的语义和组合规则统一见[主题明暗双轴](../references/application-style-library.md#主题明暗双轴)。

| 字段 | 规则 |
| --- | --- |
| `name` | 项目自己的视觉方向名称，不写主题模板名称 |
| `themeColor` | 当前主色，使用 6 位 HEX，与 `--color-brand1-6` 的最终值一致 |
| `themeColorSource` | 实际来源，如 `user-specified`、`application-theme` 或 `business-inferred`；不伪造模板默认品牌色 |
| `contentTone` | `light` 或 `dark` |
| `navTheme` | 从所选主题模板派生的导航明暗 `light` 或 `dark`；与页面画布明暗分开，不由 AI 默认填写；自由创意使用项目明确设计的导航明暗 |
| `themeDelivery` | `app-custom-theme-file` 或 `current-app-theme` |
| `themeFile` | 当前主题 CSS 的实际交付路径；继承当前应用且没有本地主题文件时为空字符串 |
| 既有导航配置 | 保留 navigationType、layoutDirection、hideAppNav、logoSource 等已确认配置，不重新推断入口范围 |

应用导航按 [四类导航契约](../../yida-prd/workflow/output-prd.md#导航类型与执行配置) 与 PRD 保持一致。全应用自绘导航才交接应用级隐藏；独立前台自绘菜单只影响该入口，后台保留平台导航。页面全屏不自动改变应用导航。`colorMode` 如有保留，表示宜搭配色模式，不代表页面明暗。

## 正文构成

使用共享主题现有的五章组织，不新增第二套固定模板。标题保持带编号的 H2，例如 `## 1. 风格摘要`，依次到 `## 5. 项目应用与调整规则`；不要省略编号或改成其他标题层级。内容按当前项目实例化：

1. **风格摘要**：当前项目的视觉方向、用户任务、明确约束与需要保留的核心特征；简要说明已选配色和导航，不写候选比较。
2. **页面视觉系统**：导航、应用框架、画布、表面、边界、排版、间距、形状和色彩角色，覆盖表单提交、编辑、记录详情与自定义页面。项目配色与导航的覆盖合并到对应规则中，不另起一组相互冲突的“默认”和“适配”说明。
3. **基础组件表达**：当前项目组件的结构、变量消费与状态。每套规则正文只写一次，索引定位到该段。
4. **特色表达配方**：保留真实内容可用的配方、启用条件和不适用时处理；不为套用配方新增业务模块。未启用配方可省略细节，不影响基础视觉语言。
5. **项目应用与调整规则**：每个实际自定义页的具体设计与验收、必要项目差异和素材缺口；不保留“请填入下方”“生成时替换”等编写任务。

主题中的模板维护要求、frontmatter 模板身份要求、占位符替换步骤、色值计算指令及模型编写提示不进入最终正文。第 2.2 节统一说明导航与框架的最终表面、状态、边界、形状、文字、间距和消费规则；完整导航 token 保存在 frontmatter。写法见 [导航与应用框架](../references/application-theme-consistency.md#导航与应用框架)。保留的是实例化结果与实现者仍需遵守的消费规则。选中项阴影与导航状态在同一节说明。

按 [页面与导航连续性](../references/page-continuity.md) 逐页交接背景、滚动、切换/返回和异常状态；沉浸页导航叠加首屏，工作区导航占位，页内切换不创建应用导航。

### 页面设计的八项要点

每个实际自定义页只有一段完整设计，放在第 5 章并附显式 anchor；原生表单与流程沿用应用主题，不虚构自定义页面记录。八项逐行写成 `- 页面任务：具体内容` 或 `- **页面任务：** 具体内容`，依下表标签填写；值可以引用正文共享规则的 anchor，但关键标签不改成表格或自由标题，也不把冒号放到加粗范围之外。下表仅解释每项内容，不是产物的排版格式。

| 要点 | 写到可实现的内容 |
| --- | --- |
| 页面任务 | 当前用户要完成什么；内容与操作沿用 PRD |
| 首屏焦点 | 第一眼关注的对象、状态或行动，以及如何突出 |
| 布局 | 区块顺序、主次、宽度/比例、列数、对齐和内容增长方式；真实存在时才规划侧栏或摘要 |
| 表面与组件 | 各区块如何消费共享表面、边界、字体和组件规则；明确局部差异与特色配方位置 |
| 主操作 | 主次动作的位置、入口与反馈，保留表单、详情及现有业务功能契约 |
| 状态 | 当前页加载、空、错、无权限等实际反馈与恢复动作；公共状态用 anchor 引用，业务文案就近补充 |
| 响应式 | 窄屏的排列顺序、折叠、工具栏换行、表格滚动和触控方式 |
| 验收 | 焦点、内容、布局、主题、交互、素材与状态的可检查结果 |

页面外壳、焦点、主要内容、动作区、上下文与反馈这些设计含义都要覆盖；不要求创建同名 JSON/YAML 字段。尺寸和间距优先引用已定义 token，只有项目确实需要的数值差异才另外写明。不能仅写“按主题执行”，也不能把公共组件全文复制到每一页。

Fast 在 design.md 逐页写清背景范围、导航首屏/滚动态、对齐宽度、实际滚动容器、入口行为、返回状态及未保存策略；Plan 写入已有 pageApplications 的 visualApplication、surface、states 后物化，不另问实现字段。

## 稳定引用规则

PRD 继续使用 `themeProfile`、`sceneRecipes.<sceneKey>`、`components.<componentName>` 和 `states.<stateName>` 这些 `designRefs`。引用先定位 frontmatter 索引，再进入对应正文；`themeProfile` 直接读取元数据。

Fast 保留 PRD 的 Markdown 逐页块与 `pageSpecHandoff` 格式，display-page 显式填写共享的稳定 `pageId`；`check-design --prd` 按 `pageId`、`designFile` 和 `designRefs` 核对页面与引用。Plan 使用已有 JSON 交接记录；不要求 Fast 转换成 Plan PRD。

- `sceneKey` 复用共享需求/计划的稳定场景 key，不翻译或重新命名。`sceneRecipes.<sceneKey>.pages[]` 每项仅保存 `pageId` 和 `anchor`，同一场景允许多个真实页面。
- 页面使用 `#page-…`，组件使用 `#component-…`，状态使用 `#state-…`。正文相应位置显式写 `<a id="page-…"></a>` 等 HTML anchor；同一 anchor 唯一，索引值必须能够精确找到。
- `components`、`states` 的 key 与 PRD 引用一致，目标 anchor 位于第 3 章基础组件表达内。只登记实际存在的规则；一个复合组件段落确实覆盖多类组件时可共享 anchor，不能因缺少规则就登记虚假引用。
- 索引只保存定位信息，不保存 `rules`、页面布局或组件正文副本。一个共享段落可以服务多个页面，但每个页面仍有自己的具体应用段。

锚点与八项要点的最小对照（校验只认这种自闭合 HTML 锚点标签，Markdown 标题 `{#id}`、链接 `[文字](#id)` 都不算锚点）：

```markdown
## 3. 基础组件表达

<a id="component-button"></a>
### 按钮
主要操作使用品牌色。

## 5. 项目应用与调整规则

<a id="page-workbench"></a>
### 工作台
- **页面任务：** 处理逾期待办并支持批量完成
- **首屏焦点：** 逾期队列置顶并高亮最紧急一项
- **布局：** 主列表居左、上下文分栏居右，720px 以下上下堆叠
- **表面与组件：** 表格消费共享卡片表面与按钮规则
- **主操作：** 行尾「完成」提交并刷新计数
- **状态：** 空记录显示登记入口，加载显示骨架
- **响应式：** 窄屏工具栏换行、表格横向滚动
- **验收：** 完成操作后计数与列表同源刷新
```

frontmatter 对应 `components.button.anchor: "#component-button"`、`sceneRecipes.workbench.pages: [{ "pageId": "workbench", "anchor": "#page-workbench" }]`：标签 id 不带 `#`，frontmatter 引用带 `#`；页面锚点必须落在第 5 章，八项要点紧跟本页锚点、止于下一个页面锚点。

## 图片素材与图标

`assetStrategy.pages[]` 按 [素材清单契约](../../yida-image-assets/references/manifest-contract.md) 记录图片等级与槽位；槽位含用途、数量、比例、尺寸、焦点、填充方式和生成许可。无图片需求的实际页面记录 `imageNeed: none`。保持 frontmatter 单行 JSON 兼容 `--design design.md`，不能只保留槽位数量；有需求时交给 `yida-image-assets`。

`iconSystem.mappings` 只登记实际业务动作、状态、导航和空态使用的具体组件名称。图标尺寸、描边和容器规则放在正文；Canvas 按选中库 import，旧平台 JSX 则按已验证的运行时加载方式使用。不能用 emoji、CSS 图形、字母占位、Unicode、临时 SVG 或 iconfont 绕过图标规范；无法稳定加载时去掉非必要图标或使用已验证资源。

图标配色按 [主题一致性门禁](../references/page-quality-gates.md#4-主题一致性门禁) 检查。有底盒、按钮背景或选中底色时，在 `iconSystem.colorPairs` 登记配色，例如 `{"name":"统计图标·默认","foreground":"var(--oyd-stat-icon-fg)","background":"var(--oyd-stat-icon-bg)"}`。优先引用已有变量，需要新角色时再加入 `tokens`；共享配色只记录一次，颜色不同的状态分别记录。

Fast 写入 `design.md`；Plan 写入 `visualStyle.forUser.iconSystem.colorPairs`，变量写入 `visualStyle.tokens`。CLI 支持 HEX、rgb/rgba、black/white/transparent 及这些颜色的变量引用；半透明底色需补充实际不透明的 `surface`。低于 3:1、颜色无法解析或缺少底色信息时校验失败。

## 用户配色与模板的优先级

用户确认的整体氛围高于模板默认灰阶。根据品牌和已确认方向协调页面、卡片、导航、填充、边界和交互，同时保留文字可读性和独立状态语义；不能只改按钮，也不能统一抹掉主题原有层次与材质。

Fast 与 Plan 使用同一主题的颜色推导、组件规则和页面设计标准。主色按主题公式推导，其余变量沿用主题；项目差异直接写入 token。Plan 输入使用 `visualStyle.tokens`，Fast 写入 `design.md.tokens`，最终设计相同。完整导航 token 沿用主题模板，并合入明确的项目差异；`navigationStyle.tone` 表示导航明暗，具体外观由这组 token 表达。导航明暗与内容画布分别设计。用户明确保留中性参考或只改强调色时尊重该范围。`--pod-nav-menu-item-selected-shadow` 作为方向无关的基础外观 Token 独立透传，`none` 表示关闭；CLI 不根据导航明暗生成替代配色。

圆角、padding、gap、密度、背景与卡片关系按选中主题和真实任务执行，通用参考值仅补未定义项。同色画布与面板可通过边界、共容器和留白建立层次；渐变、玻璃、阴影、纹理不互相强制绑定。需要动效时提供 reduced motion 降级，装饰不覆盖内容与操作。

## 应用主题 CSS 的职责

按 [应用与自定义页面共用主题](../references/application-theme-consistency.md) 将风格承诺落实到变量，再交接页面开发。文字中的“暖色”“纸感”不是 CLI 的色值输入；模板之外的全局风格必须写入 token，不能只在自定义页实现。

平台基础变量是最低契约，不是允许使用的全部变量。项目可按需扩展颜色、材质、布局、字体、动效和组件状态等语义，命名不限定为 `--oyd-*`。基础变量和扩展变量统一生成到主题 CSS；分组不决定运行时作用域，新增变量需有明确的使用组件、CSS 属性或平台映射，详见 [扩展规则](../references/application-theme-consistency.md#平台基础变量是应用主题基础框架)。

`app-theme.css` 是当前应用的主题资源产物，承载品牌色阶、语义色、字体、间距、圆角、阴影，以及 Shell、导航、页面、表单、表格和浮层的主题 token 与必要样式覆盖。`app_theme.css` 等其他 `.css` 文件名同样可用；CLI 根据 `--theme-file` 路径读取内容，不靠固定文件名识别用途。Plan 使用 `outputs.theme`，其他流程使用已记录的产物路径，避免生成多份后上传错文件。

- `design.md` 定义视觉意图、布局和交互；主题 CSS 把对应的平台样式契约落成可加载的资源。导航是否悬浮、侧栏如何折叠和拖拽、业务内容如何排布，仍由页面代码实现。
- 平台组件与自定义页面通过对应 token 消费主题。保留原有变量名和明暗导航作用域；页面组件用 `var(--token, fallback)`，不在每页重新注入全局主题。只有实际引用该 token 或命中 CSS 选择器的内容才会改变外观。
- 文件生成后，通过 `update-app --theme-file <实际路径>` 上传，再更新应用基础设置中的 `colour=custom`、`themeColor` 和 `customThemeStyle`；导航、Logo 来源与布局在同一次更新中同步。创建应用或仅修改本地 CSS 均不等于绑定了主题。
- iframe 是独立文档，不能假定它继承父页面的 CSS 变量。原生表单页依靠该应用的平台主题加载链路；自绘抽屉外壳由所在页面消费 token，高度兜底由容器代码保证。
- `themeVerification.verified=true` 证明应用设置已绑定资源，不证明所有页面视觉正确。发布后仍需检查实际页面及表单 iframe 的资源加载、计算样式与布局；CLI 无法仅凭 CSS 文件判断最终视觉效果。

主题准备与表单、页面开发按 [并行依赖](../../yida-app/workflow/parallel-work.md#主题与业务资源的依赖) 调度：计划或主题确认后即生成 CSS，不依赖表单或页面实现；appType 与 CSS 就绪便立即同步应用基础设置。页面先按已确认 token 开发，视觉验收再核对主题加载结果。

页面背景统一使用 `--pod-page-bg-color`，卡片和面板使用 `--pod-card-bg-color`，默认回退 `--color-white`；抽屉外壳使用 `--pod-shell-theme-bg-color`，内部 iframe 继续加载表单或详情页主题，标题栏与正文容器透明承接，不用卡片底色铺满抽屉。导航归属不改变页面底色，隐藏导航不自动透明；深色或明确的应用背景通过同一平台 token 配置。Plan 和 Fast 将设计值写入 design.md 并生成 app-theme.css，Canvas 宿主、页面根和 antd 统一消费；渐变、纹理和素材作为页面局部装饰层。

### 背景颜色、渐变与图片

Fast 与 Plan 按同一规则记录背景，先确定作用范围：

- 应用根背景：底色写 `--pod-app-root-bg-color`，渐变或图片写 `--pod-app-root-bg-image`，例如 `linear-gradient(135deg, #F4F8F5, #E8F0EC)`。主题 CSS 提供变量，由实际使用它们的应用根容器显示；不把根背景复制到卡片、输入框或表格。
- 页面与卡片：`--pod-page-bg-color`、`--pod-card-bg-color` 保持颜色值。它们还会被 `background-color` 和组件颜色配置使用，不能填入渐变或图片。实心页面、卡片会遮住后面的根背景，不能认为根背景一改，所有内容面就会一起改变。
- 单页或首屏装饰：在当前页面根容器或区块上使用 `background-image` 或装饰层，保留基础底色。自绘导航需要与首屏连贯时，让两者共用该页面的背景层。
- 应用级样式覆盖写在 `app-theme.css`；先核实目标环境实际承载背景的容器和样式，再做小范围覆盖。不要猜测 `app body` 选择器，也不要从 Canvas 页面修改父页面的 body 或全局主题。iframe 内的页面需要各自加载主题。

## CLI token 契约（Fast / Plan 共用）

`tokens` 的格式与变量契约见 [frontmatter 规范](#frontmatter-规范)。需要改变平台表现的圆角、字体、间距等必须落实为 CSS token，不能只写正文。

Fast 或单独更新主题时，执行 `openyida sample yida-design app-theme --output .cache/openyida/<项目名>/app-theme.css --design-file prd/<项目名>/design.md`。首次从公共模板生成；已有 CSS 只更新设计中变化的 token，保留其他 token 和自定义样式。CLI 自动保存更新记录，内容相同时跳过写入，写入失败回滚。省略 `--design-file` 会用公共模板重置目标 CSS。

主题生成前校验输入 CSS 的括号、字符串和注释闭合，生成后与上传前复用同一检查；纯模板导出也须通过。出现 `THEME_CSS_STRUCTURE_INVALID` 时按错误行修复源模板或已有 CSS，再重试；生成失败保留原 CSS 和 token 更新记录，不能靠重置模板覆盖已有定制。新增全局及页面语义 token 写入顶层 `:root`；白色、灰色导航保留公共模板中的背景变量及回退链，不要求改成固定色值。

主题文件只能由上述 OpenYida CLI 契约生成或更新。不得另写 Python、Node、Shell 或 `run_workspace_script` 临时脚本来生成、复制、整文件重写、正则替换或 retheme 主题 CSS；校验脚本只能读取并报告问题，不能改写主题文件。需要调整 CLI 未覆盖的精确 classname 覆盖时，只允许在现有文件末尾做小范围编辑，并重新通过 `update-app --theme-file` 上传完整文件。

Plan 修改现有方案按 [局部调整](../../yida-app/workflow/plan/step-4-deliver.md#4-处理调整) 更新视觉字段与配色，使用返回的 `outputs.theme`。Fast 由 `yida-design` 直接维护 `design.md`。应用阶段由 `yida-app` 使用 `--theme-file` 应用同一份产物。

整体暗色方案按 [浮层适配](../references/theme/theme-token-presets.md#暗色主题浮层适配) 补齐组件 token。实现阶段可在生成的应用主题 CSS 末尾追加精确 classname 覆盖，再上传完整主题文件。

## 校验与交接

Fast 写完和更新 `design.md` 后执行：

```bash
openyida check-design prd/<项目名>/design.md --json
```

PRD 已就绪时带上关联校验；并行生成 PRD 时先做单文件校验，由 `yida-app` 合并阶段补执行：

```bash
openyida check-design prd/<项目名>/design.md --prd prd/<项目名>/prd.md --json
```

PRD 的相对 `designFile` 默认相对命令的当前工作目录解析，必须指向本次检查的设计文件；绝对路径也会核对。若从其他目录检查项目或导出包，传 `--base-dir <项目根目录>` 指定 PRD 引用的根目录。命令行中的设计文件和 `--prd` 路径仍相对当前工作目录解析。导出包须保留 PRD 中声明的目录结构，或更新引用为实际位置；不因文件名相同或属于导出包而跳过检查。路径不一致返回 `DESIGN_FILE_MISMATCH`，修正引用或根目录后再交接。

Plan 物化内部使用同一校验，不另维护宽松标准。校验覆盖格式、变量、定位引用和跨文档一致性；真实界面的视觉、数据、交互与可访问性仍按 [页面质量门禁](../references/page-quality-gates.md) 检查。

`check-design` 检查设计文档，不读取主题 CSS；CSS 结构检查由主题生成和 `update-app --theme-file` 执行。结构检查不等于完整 CSS 语义或浏览器效果验证。

页面实现交给 `yida-canvas-custom-page`。

交接须满足：五章正文完整且项目化，frontmatter 可解析，所有引用可定位，真实页面八项要点齐备，主题变量和素材/图标记录一致，没有模板身份、未解析指令或重复维护的规则副本。页面实现按 `designRefs` 读取当前页及其共享规则；`page-spec.json` 仅派生业务输入、主题摘要和引用，保留 `sourceOfTruth.prdFile/designFile`，不复制完整设计。
