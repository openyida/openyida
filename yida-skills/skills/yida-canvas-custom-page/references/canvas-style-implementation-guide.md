# YidaCodeCanvas 组件样式实现指南

本文件是 `YidaCodeCanvas` 组件的样式实现适配指南，不是新的设计系统，也不产出配色、视觉 DNA 或页面风格。业务事实来自 `yida-prd` 输出的 `prd.md`，视觉事实来自 `yida-design` 输出的 `design.md`。`YidaCodeCanvas` 页面只在 `YidaComp` 内消费当前应用的主题 token，并把布局、材质、密度、图表、控件状态和背景规则落到组件内部。

`app-theme.css` 只在应用级配置，平台负责应用壳、原生表单、详情页和 `YidaCodeCanvas` 外层的主题一致性。Canvas Page 宿主的 `contentBgColor`、`pageStyle.backgroundColor` 和 `contentBgColorMobile` 使用 `var(--pod-page-bg-color, var(--color-white, #fff))`，让宿主与 Canvas 内部使用同一背景 token。

宿主属性绑定不是主题注入。严禁生成 `body` 背景 CSS，也严禁 `YidaComp` 修改 `document.documentElement`、`document.body`、父页面或平台容器的主题变量。组件自己的背景、卡片和控件样式留在 `YidaComp` 内，并使用 `--pod-page-*`、`--pod-card-*`、`--color-brand1-*` 和 `--color-group`。

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
| 左侧平台导航选中态是应用主题色，页面主按钮 / 标题强调 / 卡片选中态用了另一套主色 | 页面主操作、链接、选中态、重点标签和图表主序列改回应用主题 `--color-brand1-*` |
| design.md 生成了青绿、紫色、蓝色等辅助色，但当前应用主题是橙色或其他色 | 保留 `design.md` 的布局、卡片、密度、图表语言，把生成色彩降为辅助色、浅底背景、分组色或第二图表序列 |
| 用户要求导航和内容一起换色 | 交给 `yida-design` 更新应用主题设计 |
| 页面是沉浸页、自绘壳、独立官网、活动页或公开落地页 | 仍消费应用主题变量；页面差异通过布局、材质、素材、构图和辅助色表达，不覆盖品牌 token |

实现时先读取 `themeRelation`。默认值是 `跟随应用主题`，不是 `跟随生成色盘色相`。

## 工作台卡片密度红线

工作台、门户首页、业务首页默认是“进入应用后马上处理事情”的工具页，不是通用 SaaS 展示页。实现工作台页面时：

- 禁止使用“4 个等宽大 KPI 白卡 + 彩色图标盒 + 大数字 0”作为首屏主体；统计摘要只能作为 64-88px 的圆润紧凑条、分段摘要或右侧小面板。
- 禁止把状态摘要做成横跨整页但内容稀疏的空矩形；如果占满宽度，必须放入趋势、更新时间、筛选、主操作或风险状态。
- 禁止用 160px 以上的大空态白卡显示“暂无数据”；空态应是薄行、列表内空态或右侧提示条，并带登记/发布/刷新等下一步动作。
- 快捷入口不要做孤立图标大卡片阵列；高频动作放按钮组、工具条或 40-56px 的紧凑入口，低频动作折叠到更多。
- 首屏必须至少有一个任务/动态/最近记录/待处理列表承接真实工作流；若当前没有记录，显示可执行空态，而不是把空白面积留给装饰。
- 页面整体推荐包含 8-10 个有业务目的的区块以上；这些区块应通过密度、主次、分栏和列表节奏形成丰富度，不通过重复大卡片形成面积。区块数量不是实现准出硬门槛，窄场景或用户要求精简时可以更少。计数按区块组算，KPI 子项、快捷入口子项和列表行不能分别计数。

## 默认圆润高密与呼吸感落地

YidaCodeCanvas 必须把 `design.md` 的 `roundedRule`、`densityRule` 和 `breathingRule` 落成具体 CSS 与 antd token。若 design.md 未写明数值，先回写 design.md，不要在源码里凭感觉补。

- 卡片 `border-radius` 范围 `0px-32px`，业务面板 / 卡片默认 `20px-24px`，主面板、抽屉和重点容器默认 `22px-32px`。
- Button、Input、Select、DatePicker 等控件 `borderRadius` 默认 `10px-14px`；状态标签和徽标使用 `999px` 胶囊。
- 页面 padding 默认 `20px-28px`，卡片和卡片的 gap 默认 `12px-18px` 且必须小于 `20px`，卡片 padding 默认 `22px-28px` 且必须大于 `20px`。
- 页面布局必须有呼吸感：主区、右侧上下文、工具条和列表之间通过 `12px-18px` 的紧凑 gap 和清晰分组形成节奏；列表行内部 `10px-12px`，文字、按钮和标签不能贴边。
- 列表行高 `44px-56px`，高频按钮高度 `36px-40px`，状态摘要高度 `64px-88px`。
- 空态默认高度 `88px-120px`；超过 `120px` 必须有说明、主操作或配置入口，超过 `160px` 的纯空白不通过。
- 大圆角和呼吸感只负责形状性格与阅读节奏，不负责撑版面；出现大面积空白时，优先压缩容器或补任务、动态、风险、负责人、下一步动作。

## 视觉落地顺序

页面实现不要从“高级、简洁、好看”等形容词直接写 CSS。先读取 `prd/<项目名>/design.md`，再用 PRD 的 `pageSpecHandoff.designRefs` 定位当前页面要遵守的 `visualScaffold`，按固定顺序落地：

1. `layoutRecipe`：先确定页面骨架和分栏比例。
2. `surfaceMap`：决定每个区块是无框、细线面板、浅底条、列表行、表格、右侧栏还是抽屉。
3. `sectionRhythm` / `breathingRule`：确定首屏主次、区块间距、阅读顺序、组内/组间节奏和移动端折叠间距。
4. `densityRule`：控制卡片高度、列表行高、按钮尺寸和信息密度。
5. `componentRecipe`：统一按钮、入口、标签、图标、列表、图表、空态和弹层。
6. `acceptanceChecks`：逐项检查 contentBlocks 是否支撑业务目标、无大空白卡、主色跟随应用主题、KPI/快捷入口子项不计数、移动端不挤压；区块数量不作为硬门槛。

## 背景与导航的关联

背景职责统一：Shell 的 `--pod-shell-bg-color-light/white/gray/dark` 承载外层氛围；原生页面与自定义页面的基础底色统一消费 `--pod-page-bg-color`；卡片、表格外壳和面板消费 `--pod-card-bg-color`，回退 `--color-white`。渐变、纹理和图片作为页面局部装饰层叠加，不另设应用基础背景变量。

导航布局和页面底色分别配置。隐藏应用导航不自动把 Canvas 改为透明；深色或明确的应用底色在 `design.md` 的平台 token 中定义，生成 `app-theme.css` 后统一生效。页面局部视觉不能通过修改应用 token 影响其他页面。

Canvas 根背景使用 `background: var(--pod-page-bg-color, var(--color-white, #fff));`，与 PC/移动宿主和 antd 的布局背景保持一致。

浮导距顶部的留白放在自定义页根节点内部。发布层的 `.yida-code-canvas{display:flow-root}` 只保护宿主，不能阻止 `.doll-page` / `.oy-page-root` 等内层根节点与导航的 margin 折叠。页面根必须使用 `display:flow-root`（已有 flex/grid 可保留），或用根容器 padding 承载顶部间距；不能仅给 Canvas 宿主加 flow-root。验收时分别测量宿主、页面根与导航的 top：宿主和页面根贴齐，导航仍保留设计间距。不要用 overflow:hidden 修复，它可能影响 sticky 和弹层；不要向平台父容器写负 margin 抵消。

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

实现 `design.md` 的 `backgroundLayer` 时，先考虑页面根画布，再做内容面板。不要先堆白卡片再临时补装饰。展示型页面、工作台、看板、门户、官网、登录页和空状态页推荐有非纯空白的画布；近白画布可以保留，但要通过淡渐变、细线、星芒、局部装饰、素材或内容密度形成背景感。如果 `design.md` 指定 `topIrregularWash`、`radialGlowWash`、`flowLight` 或 `organicNoise`，必须在源码里落成对应 CSS。

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

- 页面根画布和业务卡片先按上述 `--pod-page-*` / `--pod-card-*` 契约消费应用主题；装饰层只能叠在主题表面之上，不能用固定渐变或固定白底替代主题表面。
- `softTintCanvas`：根节点使用低饱和浅底、带弱渐变的近白画布或深色舞台；不要为了背景感强行铺满高饱和色。
- `topIrregularWash`：用 `::before`、`clip-path`、局部 SVG 背景或伪元素形成顶部波浪、斜切、有机边界、细线曲线或图形标记；内容层固定在规则栅格上。
- `radialGlowWash`：使用大面积柔和径向光或光洗，禁止离散装饰圆球、bokeh 和随机漂浮点。
- `flowLight`：流光只做低速、低透明背景层，并写 `prefers-reduced-motion`。
- `organicNoise`：微噪点只能用极低透明度背景图或 CSS 纹理，文字和表格区域保持干净。

## 源码结构验收

页面源码不能只堆 section 或 Card。写完 `.canvas.jsx` 后，按下面结构自检：

- 文件输入：实现前已读取 `prd.md` 和 `design.md`；视觉规则来自 `design.md`，业务区块和数据来源来自 PRD。
- `rootShell`：有页面根类、背景带、内容宽度、平台导航可见时的宽度处理。
- `prioritySurface`：首屏最大视觉锚点是主图表、主任务、主对象摘要或主视觉区，不是纯标题或空白卡。
- `statusPrimitive`：有紧凑状态摘要、数据在线、更新时间、主健康分或状态胶囊。
- `actionPrimitive`：主按钮、次按钮、高频动作条或批量动作条能触发真实路径。
- `contentPrimitive`：有表格、列表、任务流、事件流、排行、时间线、图表或详情预览之一作为主要承接。
- `contextPrimitive`：有右侧洞察、风险、负责人、下一步建议或关联对象，避免页面只有左到右平铺卡片。
- `statePrimitive`：loading、empty、error、未接数据都有薄空态、刷新、登记或补录动作。
- `responsiveRule`：移动端分栏退化为单列，关键状态、动作和主内容保留，不让文字和按钮挤压。
- `backgroundLayer` / `surfaceMaterial` / `colorRoles` / `depthRule` / `roundedRule` / `densityRule` / `breathingRule`：源码按 `design.md` 落地分层背景、半透明玻璃或细线面板、明确辅助色角色、深度规则、大圆角、紧凑密度和呼吸节奏；近白画布可接受，但应有渐变、装饰、素材焦点或内容密度支撑。

缺少 `prioritySurface`、`contentPrimitive` 或 `statePrimitive` 任意一项，不能交付为“已打磨页面”。
要求玻璃感但源码只有普通白底和纯白不透明卡片，也不能交付为“已打磨页面”；如果选择极简近白背景，需要在截图和源码中体现细节层次。
要求圆角范围、padding 或 gap 但源码没有落实，或要求高密但截图出现大面积空白容器，也不能交付为“已打磨页面”。

## 品牌 token 实现消费

品牌 token 的完整语义由 `yida-design/workflow/output-design.md` 与 `yida-design/references/theme/theme-token-presets.md` 维护。YidaCodeCanvas 不重新解释 token，只按 `design.md` 的 `tokens` 和 token 语义把它们接到组件、CSS 和图表。

| token | design.md 语义 | YidaCodeCanvas 使用方式 |
| --- | --- | --- |
| `--color-brand1-6` | 主色 | 主按钮、链接、选中态、信息强调、图表主序列 |
| `--color-brand1-1` / `--color-brand1-2` / `--color-brand1-3` | 浅底色阶 | 标签浅底、提示块、筛选选中底、弱强调背景 |
| `--color-brand1-5` / `--color-brand1-9` | 交互色阶 | hover / active / pressed 状态 |
| `--color-brand1-9` / `--color-brand1-10` | 深色阶 | 深色标题、深底按钮、深色主题强调 |
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

新 antd 页面使用 [CanvasThemeProvider 脚本](canvas-theme-provider.md)，不再复制变量映射、读取 hook 或监听代码。纯 DOM 页面直接使用 CSS 变量。

旧页面已有 `useCanvasTheme` 和 `ConfigProvider` 时可继续维护；不要再叠加新的 Provider。迁移时按脚本指南替换整条主题接入链路。旧示例和 `openyida sample openyida-page-template canvas-theme` 仅保留供存量维护，不作为新页面起点。

### 按钮语义与优先级

- 主按钮、链接、选中态跟随应用品牌 token；普通按钮使用中性表面、文字和边框。
- 删除、失败、成功、警告保留语义色，不能把所有按钮和提示都染成品牌色。
- 原生 DOM 按钮直接消费 CSS 变量；antd 控件使用 `ConfigProvider` 的解析值，保留库的 disabled/loading/focus 行为。
- 应用 token 优先于 design.md 兜底。内层 `ConfigProvider` 或按钮行内 `background/color` 会覆盖外层主题；仅在明确的业务语义或用户要求下覆盖，不能复制固定蓝色主按钮。
- 浮层保持 React provider 上下文；CSS 变量还取决于实际挂载 DOM。优先使用声明式 Modal/Drawer 和上下文内的消息 API，避免静态调用绕过主题；根据滚动和裁剪情况选择弹层容器并验收。
- 页面差异通过布局、密度、圆角、材质和素材实现，默认不创建另一套页面品牌色。

## antd：当前自动映射范围

生成的 CanvasThemeProvider 内部提供 ConfigProvider。下表是其自动映射的颜色角色，业务页面无需再实现一次：

| antd token | 应用 token / 用途 |
| --- | --- |
| colorPrimary / colorLink | --color-brand1-6，主操作、链接与选中焦点 |
| colorBgLayout | --pod-page-bg-color，回退 --color-white；与页面根容器一致 |
| colorBgContainer | --pod-card-bg-color，回退 --color-white |
| colorBgElevated | --pod-card-bg-color，浮层的可读表面；有独立浮层设计时使用其已确认 token |
| colorText / colorTextHeading | --color-text1-4，正文与标题 |
| colorTextSecondary / colorTextDescription | --color-text1-3，辅助说明 |
| colorTextPlaceholder | --color-text1-10，表头与 placeholder 层级 |
| colorBorder / colorBorderSecondary | --color-line1-2 / --color-line1-1 |
| colorFillAlter / colorFillSecondary | --color-fill1-1 / --color-fill1-2 |
| colorSuccess / colorWarning / colorError / colorInfo | 当前不自动映射，保留 antd 默认语义色 |

这些映射不改变业务数据和操作。表格表头、卡片外壳、自绘文字等 CSS 同步消费对应 token；外壳卡片使用 `background: var(--pod-card-bg-color, var(--color-white, #fff))` 与主题卡片边框；卡片边界按上文背景搭配选择细边框、投影或无框，不能只映射 antd 而遗漏自绘表面。

颜色解析和刷新由 Provider 处理。当前脚本不自动映射尺寸、圆角、字体、图表色组或完整 CSS 选择器，也不会把平台所有组件样式转换成 antd 样式。布局与圆角仍按 design.md 实现；需要 antd 局部配置时仅覆盖所需的尺寸、圆角等属性，保留外层颜色主题。

应用主题模式主色缺失时为 missing、解析抛异常时为 error；其他缺失颜色保留 antd 默认值；这不代表主题验收通过。本地快照只在显式 preview 模式下使用。

## 默认 light 模式避免灰黑主题

业务列表、协同表、数据管理页、工作台和门户默认都是 light 模式。正文使用深色保证可读性；主操作、选中态、筛选焦点、批量操作和信息标签使用平台品牌色或当前页面确认的品牌色；卡片边框、表格分割线和下拉浮层边框使用浅色品牌混合，例如 `#DCE6F2`、`color-mix(in srgb, var(--oy-brand) 16%, #DDE8F4)`。用户明确要求暗色大屏、夜间模式或高对比风格时使用深色主视觉。

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
<button className="bg-[var(--color-brand1-6)] hover:bg-[var(--color-brand1-5)] text-white rounded-lg px-4 py-2">
  主操作
</button>
```

色阶对应以 `design.md` 和 yida-design 主题 token 语义为准：主色 `brand1-6`、填充按钮 hover 使用 `brand1-5`、按下使用深色档 `brand1-9`、通用浅色 hover 底使用 `brand1-1`、选中/标签浅底使用 `brand1-2`。

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
