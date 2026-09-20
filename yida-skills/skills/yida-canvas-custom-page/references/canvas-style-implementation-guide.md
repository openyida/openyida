# YidaCodeCanvas 组件样式实现指南

按本指南把 `design.md` 的布局、材质、密度、图表和控件样式写入 Canvas 页面。业务事实来自 `yida-prd` 输出的 `prd.md`，视觉事实来自 `yida-design` 输出的 `design.md`。

应用主题通过 app-theme.css 配置，页面样式限定在 `YidaComp` 内。`--pod-page-*`、`--pod-card-*`、`--color-brand1-*` 和 `--color-group` 等是平台基础角色；页面还可消费项目定义的材质、布局、字体、动效和组件状态变量。平台负责应用壳、原生表单和详情页的主题，新变量需要显式消费或映射后才会影响这些组件。

开发前按 [应用与自定义页面共用主题](../../yida-design/references/application-theme-consistency.md) 核对风格与变量。纯 DOM 页面也必须引用应用主题；省略 antd Provider 不等于可以另写固定色盘。已确认风格缺少变量时先补设计源并重新生成主题，不在每页用 `--canvas: #…`、`--ink: #…` 复制一套基础配色。

CLI 将 Canvas 宿主的 `contentBgColor`、`pageStyle.backgroundColor`、`contentBgColorMobile` 设为 `var(--pod-page-bg-color, var(--color-white, #fff))`。自绘导航页的内部画布按下方规则设置局部背景。

## 导航、画布与切换

先按[管理页面边界](navigation-and-entry-guide.md#平台导航下的管理页面)确认本页是否拥有导航。平台导航管理页只实现业务内容，不套带菜单的内容壳；以下自绘导航的背景与切换规则仅适用于已确认的独立入口或应用级自绘导航。

按 [页面与导航连续性](../../yida-design/references/page-continuity.md) 实现共同背景、滚动和切换；沉浸展示页不套业务工作区。加载/错误保留导航和画布，验收首屏、第二屏和窄屏菜单。

## 嵌入页面的宿主高度

`openyida publish --canvas` 在 Page Schema 中统一配置宿主最小高度：

```css
.vc-page-yida-pure-container:has(> .yida-code-canvas) {
  min-height: 100vh;
}
```

该规则用于直接承载整页 CodeCanvas 的纯容器，保证嵌入时页面有可见高度；iframe 内的 `100vh` 使用当前 iframe 的视口高度。页面内部仍按业务内容布局，局部 Canvas 组件按所在区块确定高度。

排查空白时，分别测量外层 Canvas、iframe 元素和 iframe 内部容器的高度。外层 Canvas 的宿主样式通过重新发布原 Canvas 源文件更新；iframe 内的页面使用自身文档加载的 CSS。

原生数据管理页在隐藏导航后，若 `.vc-yida-form-manage--fixed` 已有数据但高度为零，在当前应用主题 CSS 中补充以下规则，为绝对定位的表格提供可伸展的父容器：

```css
body.pod-premium.page-type-workbench .vc-page-yida-pure-container:has(> .vc-rootcontent-pure-container > .vc-yida-form-manage--fixed) {
  min-height: 100vh;
}
```

读取并保留线上应用的完整主题 CSS，追加规则后执行 `openyida update-app <appType> --theme-file <app-theme.css>`。刷新页面，确认 iframe 内已加载新主题文件，再验证表格、分页、滚动与新增抽屉；独立入口也需保持正常。此规则只匹配原生数据管理纯容器，颜色继续使用现有 token。

## 应用主题与页面风格冲突处理

| 冲突现象 | 处理方式 |
| --- | --- |
| 导航选中态与页面按钮、指标颜色不同 | 对照 `design.md` 的颜色角色；已设计的协调配色可以保留，临时硬编码或误用变量才需要修正，不以同色为验收标准 |
| design.md 的操作色或指标色与品牌色不同 | 按已定义的用途和表面使用项目变量，同时检查与画布、图片及状态色的关系；未说明搭配时先补设计，不自动降为装饰或改回品牌色 |
| 用户要求导航和内容一起换色 | 交给 `yida-design` 更新应用主题设计 |
| 页面是沉浸页、自绘壳、独立官网、活动页或公开落地页 | 仍消费应用主题变量；页面差异通过布局、材质、素材、构图和辅助色表达，不覆盖品牌 token |

实现时读取 `themeProfile` 的主色与交付方式，以及正文中的颜色角色。品牌、操作和信息强调可以用不同颜色，但必须属于同一份项目设计，不能在页面中另配一套色盘。

## 工作台卡片密度红线

工作台、门户首页、业务首页默认是“进入应用后马上处理事情”的工具页，不是通用 SaaS 展示页。实现工作台页面时：

- 禁止使用“4 个等宽大 KPI 白卡 + 彩色图标盒 + 大数字 0”作为首屏主体；统计摘要按主题采用紧凑条、分段摘要或实际需要的小面板，未定义时可参考 64-88px。
- 禁止把状态摘要做成横跨整页但内容稀疏的空矩形；如果占满宽度，必须放入趋势、更新时间、筛选、主操作或风险状态。
- 禁止用 160px 以上的大空态白卡显示“暂无数据”；空态应是薄行、列表内空态或右侧提示条，并带登记/发布/刷新等下一步动作。
- 快捷入口不要做孤立图标大卡片阵列；高频动作放按钮组、工具条或 40-56px 的紧凑入口，低频动作折叠到更多。
- 首屏必须至少有一个任务/动态/最近记录/待处理列表承接真实工作流；若当前没有记录，显示可执行空态，而不是把空白面积留给装饰。
- 页面整体推荐包含 8-10 个有业务目的的区块以上；这些区块应通过密度、主次、分栏和列表节奏形成丰富度，不通过重复大卡片形成面积。区块数量不是实现准出硬门槛，窄场景或用户要求精简时可以更少。计数按区块组算，KPI 子项、快捷入口子项和列表行不能分别计数。

## 主题形状、密度与呼吸感落地

把 `design.md` 正文中的圆角、密度与分组节奏落实为 CSS 与 antd token。选中主题和页面明确决定优先；下列数值仅在对应项未定义时兜底，不是所有主题的硬门槛。缺少可实现设计时先修设计源事实，不在源码里凭感觉补。

- 业务卡片可参考 `20px-24px` 圆角，控件可参考 `10px-14px`；主题采用微圆、胶囊或不同档位时按其用途分工实现，不统一改为大圆角。
- 页面 padding 可参考 `20px-28px`、卡片 gap `12px-18px`、卡片 padding `22px-28px`；主题明确的 `16px` 内距或 `24px` 间距同样有效。
- 页面布局必须有呼吸感：用主题的组内/组间间距、对齐与边界形成层次；文字、按钮和标签保留内容安全内距。
- 列表行、高频按钮、摘要高度按实际内容与主题确定；未定义时可参考 `44px-56px`、`36px-40px`、`64px-88px`。
- 空态可参考 `88px-120px`，更多空间需承载解释、主操作或真实图示；不得以大块纯空白撑版面。
- 出现大面积空内容时优先压缩容器，或放入已有任务、动态、风险、负责人和下一步动作，不虚构业务内容。

## 视觉落地顺序

先读取 PRD 与 design.md，再通过 `pageSpecHandoff.designRefs` 查询 frontmatter 的 anchor 索引，定位当前页八项要点与共享组件规则。索引只负责定位，不以旧 `visualScaffold` 字段是否存在决定能否实现。

1. 按页面任务、首屏焦点与布局确定真实区块的顺序、主次和分栏。
2. 按表面与组件规则选择开放区、细线面板、连续列表、表格与必要容器。
3. 通过主题 token 与明确局部差异落实圆角、间距、层次和阅读节奏。
4. 实现主操作、状态反馈与恢复入口；按具体响应式决定安排窄屏。
5. 对照当前页验收检查业务内容、焦点、主题、交互和布局，区块数量不作为硬门槛。

## 背景与导航的关联

背景职责统一：Shell 的 `--pod-shell-bg-color-light/white/gray/dark` 承载外层氛围；原生页面与自定义页面的基础底色统一消费 `--pod-page-bg-color`；卡片、表格外壳和面板消费 `--pod-card-bg-color`，回退 `--color-white`。渐变、纹理和图片作为页面局部装饰层叠加，不另设应用基础背景变量。

应用根背景已提供 `--pod-app-root-bg-color` 和 `--pod-app-root-bg-image`，后者可表达图片或 CSS 渐变。它们只影响实际消费这些变量的根容器；不透明页面和卡片仍显示各自底色。全应用背景由主题 CSS 配置，单页渐变在本页根容器用 `background-image` 实现；颜色变量不放渐变，页面代码不向父页面 body 注入样式。Fast 与 Plan 共用这套规则，详见 [背景作用范围](../../yida-design/workflow/output-design.md#背景颜色渐变与图片)。
抽屉整体背景默认使用 `--pod-shell-theme-bg-color`，回退 `--color-white`；标题栏、正文容器透明承接外壳，不铺 `--pod-card-bg-color`。抽屉内独立业务卡片才使用卡片 token。

导航布局和页面底色分别配置。隐藏应用导航不自动把 Canvas 改为透明；深色或明确的应用底色在 `design.md` 的平台 token 中定义，生成 `app-theme.css` 后统一生效。页面局部视觉不能通过修改应用 token 影响其他页面。

普通 Canvas 根背景默认使用 `background: var(--pod-page-bg-color, var(--color-white, #fff));`。自绘应用导航页的内部画布按下节设计，不要求可见底色与平台宿主相同。

顶部导航默认贴顶通栏；首屏有背景图时透明叠加、滚动加遮罩、回顶透明，规则见 [页面与导航连续性](../../yida-design/references/page-continuity.md)。仅明确选择浮导时留外侧间距。Canvas 宿主的 flow-root 无法阻止内部根节点 margin 折叠；内部根也须用 flow-root 或 flex/grid，文字安全区不推下背景。测量宿主、页面根与导航的 top；不用 overflow:hidden 修复，不改平台父容器。

## 自定义导航页的独立画布

**MUST** 区分平台宿主与自绘应用画布：宿主继续使用平台背景 token；内部导航壳可按 `design.md` 使用浅灰、浅彩、低饱和渐变或局部纹理，不强制使用 `--pod-page-bg-color` 作为唯一可见底色。`design.md` 明确 `canvasBackground`、`navigationSurface` 和 `cardSurface`，仅在当前页面根选择器实现，不修改 body、父页面或全局变量。

导航底色按首屏、滚动和展开状态设计，不因浅色画布强制白色浮导。浅彩画布上的白卡可无框，白画布上的白卡用细边框或投影；Logo、选中态和主操作按项目颜色角色搭配，不要求同色。渐变低饱和、集中于局部；深色画布独立设计对比。

```css
/* 明确选择浮导时的局部示例，色值由 design.md 确认。 */
.custom-nav-canvas {
  min-height: 100dvh;
  display: flow-root;
  background: radial-gradient(ellipse at 20% 0%, #f5dfc9 0%, transparent 55%), #f4f2ef;
}
.custom-nav-canvas .floating-nav {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 6px 24px rgba(50, 40, 30, 0.08);
}
```

验收覆盖首屏、滚动底部、窄屏和导航切换：画布铺满内容区，无意外白边；导航与卡片边界清楚，品牌色不过度铺满导航；原生 iframe 不被跨框样式修改。工作台同时压缩重复操作条、等权大指标卡和过高空态，不能仅靠渐变声称完成设计优化。

## 分组标题与分割线

执行 [分组标题与分割线选型](../../yida-design/references/application-theme-consistency.md#分组标题与分割线)：按当前页用途、密度和主题选形态，不把所有页面都写成左竖条或一条实线。同页同层级使用同一实现与配色，不同业务页面优先使用不同且合适的形态。平台 Divider 的选型表可作为外观参考；Canvas 使用自己的标题/CSS 实现，不导入未提供的原生表单组件。表格网格和卡片边框不套用章节装饰。

## 同色表面的卡片边界

根据页面与卡片的底色搭配选择边界，不统一给所有卡片加框：

| 页面背景 | 推荐卡片表现 |
| --- | --- |
| 白色或近白色 | 白卡添加 1px 细边框或清晰柔和的投影，二选一即可 |
| 浅灰色，例如 `#F3F4F6` | 白色无边框卡片，利用底色对比形成层级 |
| 浅彩色，例如浅蓝、浅暖灰 | 白色无边框卡片，利用底色对比形成层级 |

颜色仅说明搭配关系，不要求在源码里写死背景色；页面和卡片继续消费应用主题 token。投影沿用 `design.md` 已确认的阴影规则，不默认同时叠加边框和投影。最终以实际对比为准：近白底色与卡片仍难区分时，补边框或投影；仅圆角或几乎不可见的阴影不算有效边界。

选择边框方案时，优先消费可见的 `--pod-card-border`。若该变量未定义、为 `none`、零宽或透明，在该卡片自己的选择器中显式使用下面的边框；不要修改根节点或应用主题变量：

```css
/* 用于已确认需要边界的同色卡片，不自动套到所有区块。 */
.oy-card-on-white {
  background: var(--pod-card-bg-color, var(--color-white, #fff));
  border: 1px solid var(--color-line1-2, rgba(24, 28, 31, 0.12));
}
```

`var(--pod-card-border, ...)` 的回退只在变量缺失时生效；采用边框方案且主题显式配置 `none` 时，在该卡片局部覆盖；采用投影方案或浅灰、浅彩底上的无框方案时不补边框。普通卡片用中性边框，品牌描边留给选中或强调状态。不要在页面运行时比较两个颜色字符串来自动开关边框；在 `design.md` 的 `surfaceMap` 中明确哪些区域是独立卡片、哪些是无框内容区，并按实际主题验收。

明确设计为无框排版的内容区不强行加边框；已有清晰底色对比的卡片按主题处理。嵌套区块避免层层套框，分组可用分隔线。表单抽屉的 iframe 外层仍不加卡片或边框，原生内页负责自己的布局。

- [ ] 白色或近白背景上的白卡已有可见细边框或清晰投影；浅灰、浅彩色背景上的白卡默认无边框且有足够底色对比；有意采用无框排版的区域在 `surfaceMap` 中明确标注。
- [ ] 按所选方案检查实际 computed style：边框方案宽度非零、非透明；投影方案 `box-shadow` 非 `none` 且实际可见；无框方案有足够底色对比。截图中能区分卡片与页面，仅搜索到 `border` 或 `box-shadow` 不能视为通过。
- [ ] 边框跟随主题中性分割线，投影遵循应用阴影规则，切换主题后仍可辨认，没有全局覆盖、重复套框或 iframe 外层卡片。

## 背景层实现规则

实现 `design.md` 中的背景设计时，先考虑页面根画布，再做内容面板。不要先堆白卡片再临时补装饰。展示型页面、工作台、看板、门户、官网、登录页和空状态页推荐有非纯空白的画布；近白画布可通过主题的边界、留白与信息组织成立，不强制增加装饰。如果 `design.md` 指定 `topIrregularWash`、`radialGlowWash`、`flowLight` 或 `organicNoise`，必须在源码里落成对应 CSS。

推荐结构：

```jsx
<div className="oy-page-root">
  <style>{OPENYIDA_BACKGROUND_LAYER_CSS}</style>
  <main className="oy-page-content">{/* content */}</main>
</div>
```

推荐 CSS：

```css
.oy-page-root {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  display: flow-root;
  background: var(--pod-page-bg-color, var(--color-white, #fff));
}
.oy-page-root::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 320px;
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--color-brand1-2, #e8f2ff) 55%, transparent),
    color-mix(in srgb, var(--color-brand1-1, #f4f8ff) 38%, transparent)
  );
  clip-path: polygon(0 0, 100% 0, 100% 68%, 78% 78%, 52% 68%, 29% 84%, 0 72%);
  pointer-events: none;
  z-index: -2;
}
.oy-page-root::after {
  content: "";
  position: absolute;
  inset: -30% -20% auto -20%;
  height: 240px;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .42), transparent);
  transform: translateX(-28%);
  animation: oy-flow-light 18s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}
.oy-page-content {
  position: relative;
  z-index: 1;
}
.oy-card {
  padding: var(--pod-card-padding, 20px);
  background: var(--pod-card-bg-color, var(--color-white, #fff));
  border: var(--pod-card-border, none);
  border-radius: var(--pod-card-border-radius, 20px);
}
@keyframes oy-flow-light {
  0%, 100% { transform: translateX(-28%); opacity: .22; }
  50% { transform: translateX(28%); opacity: .42; }
}
@media (prefers-reduced-motion: reduce) {
  .oy-page-root::after { animation: none; opacity: .18; }
}
```

落地要求：

- 普通页面和业务卡片按上述主题契约实现；自绘应用导航页的局部画布、导航按下述独立画布规则实现，不覆盖平台或原生内页主题。
- `softTintCanvas`：根节点使用低饱和浅底、带弱渐变的近白画布或深色舞台；不要为了背景感强行铺满高饱和色。
- `topIrregularWash`：用 `::before`、`clip-path`、局部 SVG 背景或伪元素形成顶部波浪、斜切、有机边界、细线曲线或图形标记；内容层固定在规则栅格上。
- `radialGlowWash`：使用大面积柔和径向光或光洗，禁止离散装饰圆球、bokeh 和随机漂浮点。
- `flowLight`：流光只做低速、低透明背景层，并写 `prefers-reduced-motion`。
- `organicNoise`：微噪点只能用极低透明度背景图或 CSS 纹理，文字和表格区域保持干净。

## 源码结构验收

页面源码不能只堆 section 或 Card。下列 primitive 名称用于理解实现职责，不是设计文档的必填字段；只检查当前业务实际需要的项。写完 `.canvas.jsx` 后自检：

- 文件输入：实现前已读取 `prd.md` 和 `design.md`；视觉规则来自 `design.md`，业务区块和数据来源来自 PRD。
- `rootShell`：有页面根类、背景带、内容宽度、平台导航可见时的宽度处理。
- `prioritySurface`：首屏最大视觉锚点是主图表、主任务、主对象摘要或主视觉区，不是纯标题或空白卡。
- `statusPrimitive`：有紧凑状态摘要、数据在线、更新时间、主健康分或状态胶囊。
- `actionPrimitive`：主按钮、次按钮、高频动作条或批量动作条能触发真实路径。
- `contentPrimitive`：有表格、列表、任务流、事件流、排行、时间线、图表或详情预览之一作为主要承接。
- `contextPrimitive`：业务需要时承接已有洞察、风险、负责人、下一步建议或关联对象，不为补齐结构新增侧栏。
- `statePrimitive`：loading、empty、error、未接数据都有薄空态、刷新、登记或补录动作。
- `responsiveRule`：移动端分栏退化为单列，关键状态、动作和主内容保留，不让文字和按钮挤压。
- 表面与组件：源码还原正文指定的背景、边界、材质、色彩角色、圆角和分组节奏；同色画布可以通过主题的边界与留白成立，玻璃、渐变和装饰按需采用。

缺少 `prioritySurface`、`contentPrimitive` 或 `statePrimitive` 任意一项，不能交付为“已打磨页面”。
要求玻璃感但源码只有普通白底和纯白不透明卡片，也不能交付为“已打磨页面”；如果选择极简近白背景，需要在截图和源码中体现细节层次。
要求圆角范围、padding 或 gap 但源码没有落实，或要求高密但截图出现大面积空白容器，也不能交付为“已打磨页面”。

## 品牌 token 实现消费

品牌 token 的完整语义由 `yida-design/workflow/output-design.md` 与 `yida-design/references/theme/theme-token-presets.md` 维护。YidaCodeCanvas 不重新解释 token，只按 `design.md` 的 `tokens` 和 token 语义把它们接到组件、CSS 和图表。

| token | design.md 语义 | YidaCodeCanvas 使用方式 |
| --- | --- | --- |
| `--color-brand1-6` | 主色 | 主按钮、链接、选中态、信息强调、图表主序列 |
| `--color-brand1-1` | 品牌交互悬停色 | 品牌控件 hover，不用作常驻指标背景 |
| `--color-brand1-2` / `--color-brand1-3` | 品牌派生浅色 | 按主题定义用于选中底、提示块和弱强调背景 |
| `--color-brand1-5` | 品牌派生深色 | 按主题定义用于深色导航或强调表面 |
| `--color-brand1-9` / `--color-brand1-10` | 激活 / 禁用色 | 分别用于 pressed / disabled，不用作普通标题、指标或默认按钮背景 |
| `--color-brand-1` ~ `--color-brand-4` | 移动端品牌色阶 | 当前自定义页面的移动端布局和品牌状态 |
| `--color-group` | 平台图表色组 | 多系列折线、柱状、排名、环形图配色 |
| `--oyd-control-selected-bg` | 页面级选中浅底 | 下拉选中项、Tabs 选中底、轻量筛选块 |
| `--oyd-control-info-bg` | 页面级信息浅底 | 提示块、空态引导、数据说明背景 |

语义色保持固定：成功、警告、错误继续用 antd 默认或平台语义变量，避免被主色覆盖。

## 应用主题消费

`podBlue`、`podGreen`、`podOrange` 是常用浅底候选，不是固定默认。`blue`、`green`、`orange`、`podBlue`、`podGreen`、`podOrange` 都作为应用主题 token profile 保留原名，不互相改写；完整变量和语义以 `yida-design/references/theme/theme-token-presets.md` 为准。

主题文件由 `yida-design` 生成。当前自定义页面直接使用 `design.md` 中确定的主题变量。

## PRD 与 design.md 字段落地规则

从 PRD 或派生的 `page-spec.json` 读取业务边界，从 design.md 读取应用主题 token 与视觉执行规则：

| 用户说法 | spec |
| --- | --- |
| 整个应用统一、全局换肤、系统整体主题、应用主题也改 | 交给 `yida-design` 更新应用主题设计 |
| 左侧导航/菜单/顶部壳层也一起变色，导航和内容区同色 | 使用同一应用主题配置，不从页面调用壳层更新能力 |
| 某个页面/首页/看板/自定义页变好看、页面重构或局部美化 | 沿用应用主题，只调整布局、材质、密度、素材和辅助视觉 |
| 明确说保持导航不变、其他页面不变、只改当前页 | 保持当前应用主题配置，只调整页面局部布局、材质和视觉层级 |

设计输入冲突时，回到 `yida-design` 补齐明确值，再进入自定义页面实现。

## 核心事实：CSS 变量直接级联，antd token 使用解析色值

`YidaCodeCanvas` 组件的 `runtimeCode` 在**运行页面真实 `window`** 里 `new Function` 执行（见 SKILL.md「运行时事实」），组件挂在页面 DOM 树内。由此得到主色落地的分界：

| 消费方 | 品牌色怎么给 | 原因 |
| --- | --- | --- |
| 普通 DOM / Tailwind 元素（`style` / `className`） | **直接用 CSS 变量** `var(--color-brand1-6)` | CSS 变量沿 DOM 树级联，`YidaCodeCanvas` 节点能直接读取当前应用提供的 `--color-brand1-*` |
| antd 组件（Button / Table / Tabs…） | **JS 解析成真实色值**喂 `ConfigProvider.theme.token.colorPrimary` | antd 的色板（hover/active/disabled）由 JS 算法从一个真实颜色推导，`var(...)` 是字符串塞不进算法 |
| JS 消费的颜色：recharts `stroke`/`fill`、canvas 绘制、图表配色数组 | **JS 解析成真实色值** | 传给库的是运行时字符串，不走 CSS 级联 |

所以只有「JS 要拿到真实颜色」的场景才需要读值，其余直接用 CSS 变量最省事。

## 统一主题适配

antd 页面统一使用 [CanvasThemeProvider](canvas-theme-provider.md) 读取应用主题。纯 DOM 页面直接使用 CSS 变量。

`openyida sample openyida-page-template canvas-theme` 输出同一份 Provider；表单抽屉、批量表格和趋势图示例已自动装配。已有页面按脚本指南统一接入。

### 按钮语义与优先级

- 按 `design.md` 的[指标卡与按钮配色](../../yida-design/references/application-theme-consistency.md#指标卡与按钮配色)实现背景、文字、图标和状态。指标区检查外层容器的背景，按钮检查内部图标的 `currentColor`、描边和透明度；换背景时一起调整前景。跨应用复用页面后，删除旧主题变量和深色兜底，使用当前设计声明的颜色角色；不能只换品牌色值。
- 内容面板切换用 Tabs，类别单选用 Segmented/Radio.Group，主动作才用实心 Button。按 [默认控件状态](canvas-theme-provider.md#默认控件状态) 接入 Provider：中性普通项、轻底选中项、清晰文字与独立禁用态；不把分类筛选做成一排主操作，不以主色文字叠加同色实心底。
- 主按钮、链接、选中态消费项目为相应角色定义的 token，可与品牌色不同；同类操作跨页面保持一致，普通按钮保持次要层级。
- 删除、失败、成功、警告保留语义色，不能把所有按钮和提示都染成品牌色。
- 原生 DOM 按钮直接消费 CSS 变量；antd 控件使用 `ConfigProvider` 的解析值，保留库的 disabled/loading/focus 行为。
- 应用 token 优先于 design.md 兜底。内层 `ConfigProvider` 或按钮行内 `background/color` 会覆盖外层主题；按已设计的组件配色局部适配，引用项目变量并覆盖完整交互状态，不能复制固定蓝色或黑色按钮。
- 浮层保持 React provider 上下文；CSS 变量还取决于实际挂载 DOM。优先使用声明式 Modal/Drawer 和上下文内的消息 API，避免静态调用绕过主题；根据滚动和裁剪情况选择弹层容器并验收。
- 页面差异通过布局、密度、圆角、材质和素材实现，默认不创建另一套页面品牌色。

## antd：当前自动映射范围

生成的 CanvasThemeProvider 内部提供 ConfigProvider。下表是其自动映射的颜色角色，业务页面无需再实现一次：

| antd token | 应用 token / 用途 |
| --- | --- |
| colorPrimary / colorLink | --color-brand1-6，主操作、链接与选中焦点 |
| colorBgLayout | --pod-page-bg-color，回退 --color-white；与页面根容器一致 |
| colorBgContainer | --pod-card-bg-color，回退 --color-white |
| colorBgElevated | --pod-card-bg-color，普通浮层表面；Drawer 通过组件级 colorBgElevated 单独使用 --pod-shell-theme-bg-color，回退 --color-white |
| colorText / colorTextHeading | --color-text1-4，正文与标题 |
| colorTextSecondary / colorTextDescription | --color-text1-3，辅助说明 |
| colorTextPlaceholder | --color-text1-10，表头与 placeholder 层级 |
| colorBorder / colorBorderSecondary | --color-line1-2 / --color-line1-1 |
| colorFillAlter / colorFillSecondary | --color-fill1-1 / --color-fill1-2 |
| colorSuccess / colorWarning / colorError / colorInfo | 当前不自动映射，保留 antd 默认语义色 |

这些映射不改变业务数据和操作。表格表头、卡片外壳、自绘文字等 CSS 同步消费对应 token；外壳卡片使用 `background: var(--pod-card-bg-color, var(--color-white, #fff))` 与主题卡片边框；卡片边界按上文背景搭配选择细边框、投影或无框，不能只映射 antd 而遗漏自绘表面。

颜色解析和刷新由 Provider 处理。上表是默认映射，不是配色限制；项目明确采用独立操作色时，读取对应项目变量，在 Button 等目标组件范围配置背景、前景和交互状态，不修改全局品牌色或无关组件。扩展变量不会自动被 Provider 消费，必须显式适配。当前脚本也不自动映射尺寸、圆角、字体、图表色组或完整 CSS 选择器，布局与圆角仍按 design.md 实现。

应用主题模式主色缺失时为 missing、解析抛异常时为 error；其他缺失颜色保留 antd 默认值；这不代表主题验收通过。本地快照只在显式 preview 模式下使用。

## 默认 light 模式避免灰黑主题

业务列表、协同表、数据管理页、工作台和门户默认都是 light 模式。正文使用深色保证可读性；主操作、选中态、筛选焦点、批量操作和信息标签按项目颜色角色表达主次，卡片与浮层边界按所在表面选择中性或协调的浅彩色，不强制使用品牌混色。用户明确要求暗色大屏、夜间模式或高对比风格时使用深色主视觉。

## 控件焦点态与下拉浮层 reset

默认保留组件库的焦点、禁用和交互样式。仅当宿主样式干扰控件或设计明确要求时，在页面作用域增加局部 reset；不要默认覆盖所有 antd 控件。

实现规则：

- 弹层默认保留 antd 挂载行为。若页面局部 CSS 必须覆盖弹层，可给 CanvasThemeProvider 传 getPopupContainer；先检查目标容器是否会裁剪浮层，不能统一强制挂在触发器父节点。
- 需要 reset 时使用页面根类限制作用域，保留可见的键盘焦点。
- 边框和焦点消费应用的边框、品牌 token，不能用固定浅灰蓝覆盖主题。
- 下拉浮层统一 10px 圆角、浅边框、柔和阴影，active / selected 选项使用品牌浅底，不用黑色描边或浏览器原生 select。

以下是需要局部弹层样式时的内容片段，放在已存在的 CanvasThemeProvider 下；不再创建第二个主题 Provider：

```jsx
  <div className="oy-business-list" style={{ '--oy-brand': 'var(--color-brand1-6)' }}>
    <style>{`
      .oy-business-list {
        --oy-control-border: var(--color-line1-2, #d7dee8);
        --oy-control-focus: color-mix(in srgb, var(--oy-brand, #6B7CAB) 52%, #ffffff);
        --oy-control-focus-ring: color-mix(in srgb, var(--oy-brand, #6B7CAB) 18%, transparent);
      }
      .oy-business-list :where(input, textarea, select, .ant-input, .ant-select-selector, .ant-picker) {
        border-color: var(--oy-control-border) !important;
        font-weight: 400;
        outline: none !important;
        box-shadow: none !important;
      }
      .oy-business-list :where(input, textarea, select, .ant-input, .ant-select-focused .ant-select-selector, .ant-picker-focused):focus,
      .oy-business-list :where(.ant-select-focused .ant-select-selector, .ant-picker-focused) {
        border-color: var(--oy-control-focus) !important;
        box-shadow: 0 0 0 3px var(--oy-control-focus-ring) !important;
      }
      .oy-business-list :where(.ant-select-dropdown, .ant-picker-dropdown) {
        border-radius: 10px;
        box-shadow: 0 14px 36px rgba(67, 84, 128, .12);
      }
    `}</style>
    {/* page content */}
  </div>
```

## Tailwind：CSS 变量直接用

Canvas 节点在页面 DOM 树内，Tailwind 运行时对普通元素直接用 arbitrary value 引用 CSS 变量即可，**不需要 JS**：

```jsx
// 主色文字 / 背景 / 边框，直接引平台变量，跟随 App 主题
<div className="text-[var(--color-brand1-6)] border border-[var(--color-brand1-3)]">…</div>
<button className="bg-[var(--color-brand1-6)] hover:bg-[var(--color-brand1-1)] text-[var(--oyd-on-action-color)] rounded-lg px-4 py-2">
  主操作
</button>
```

本例要求当前设计已声明并核对 `--oyd-on-action-color`，项目已有同义前景变量时直接复用。色阶以 `design.md` 为准：主色 `brand1-6`、品牌 hover 使用 `brand1-1`、按下使用 `brand1-9`、禁用使用 `brand1-10`、选中/标签浅底使用 `brand1-2`；默认与悬停背景都要能读清文字。

## 图表 / recharts：用解析后的品牌色组

图表颜色是 JS 传给库的字符串，使用 `useCanvasThemeContext()` 的 `token.colorPrimary` 或在组件作用域解析 `--color-group`。多系列图表优先读 `--color-group`，这样应用主题里的色组可以控制趋势线、柱状、排名和环形图的层次。

```jsx
/* @canvas-theme-provider */
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// 本片段经主题脚本展开后编译。
function ChartContent() {
  const { token } = useCanvasThemeContext();
  var data = [
    { name: '1月', value: 120 }, { name: '2月', value: 200 },
    { name: '3月', value: 150 }, { name: '4月', value: 320 },
  ];
  return (
    <div style={{ width: '100%', height: 300, padding: 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={token.colorPrimary} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function YidaComp() {
  return <CanvasThemeProvider><ChartContent /></CanvasThemeProvider>;
}
export default YidaComp;
```

多色系列需要区分时，用 `--color-group` + 语义色，保持低饱和、分层明确的图表色组。

## 自查清单（主色相关）

- 新 antd 页面只有一套主题适配层；Provider 的主色、表面、文字、填充和边界与自绘 CSS 一致。应用主题模式和 preview 分别验证，不能只凭 ready 判断全部通过。
- 检查控件焦点与下拉样式；仅对实际干扰做局部 reset，并保留可见的键盘焦点。
- Tailwind 主色类用 `var(--color-brand1-*)`，没有散落的 `#1677ff` / `bg-blue-500`。
- 图表 / canvas 绘制颜色走 `useCanvasThemeContext` 或组件作用域的 `--color-group`，无硬编码蓝。
- 语义色（成功/警告/错误）保持 antd 默认或平台语义变量，未被主色覆盖。
- 视觉方向来自 `yida-design`：配色、圆角、图标和文案都完成业务化处理。
