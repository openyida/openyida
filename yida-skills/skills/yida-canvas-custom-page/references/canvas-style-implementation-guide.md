# YidaCodeCanvas 组件样式实现指南

本文件是 `YidaCodeCanvas` 组件的样式实现适配指南，不是新的设计系统，也不产出配色、视觉 DNA 或页面风格。设计事实唯一来自 `yida-design` 输出的 `prd.md` 与 `design.md`：PRD 给业务场景和页面边界，`design.md` 给完整主题、token、视觉 DNA、布局、材质、圆角、密度、呼吸感、背景层、组件和状态规则。`YidaCodeCanvas` 组件只负责把这些规则落到 antd token、CSS 变量、Tailwind、图表、控件状态、背景 CSS 和表单 iframe 主题同步。

真实业务页、页面重构和局部美化以当前应用主题色为基准；缺少主题证据时先按业务气质选择平台预置主题或自定义色盘，不固定回到 `podBlue` / #1677ff。独立品牌/活动页、隐藏导航沉浸页和用户明确要求完全不同风格的页面使用页面级固定主题和差异化色盘。

## 应用主题与页面风格冲突处理

| 冲突现象 | 处理方式 |
| --- | --- |
| 左侧平台导航选中态是应用主题色，页面主按钮 / 标题强调 / 卡片选中态用了另一套主色 | 页面主操作、链接、选中态、重点标签和图表主序列改回应用主题 `--color-brand1-*` |
| design.md 生成了青绿、紫色、蓝色等辅助色，但当前应用主题是橙色或其他色 | 保留 `design.md` 的布局、卡片、密度、图表语言，把生成色彩降为辅助色、浅底背景、分组色或第二图表序列 |
| 用户要求导航和内容一起换色 | 走 `themeScope=app`，由应用主题配置或壳层主题更新统一处理 |
| 页面是隐藏导航的独立官网、活动页、公开落地页 | 走 `themeScope=page`，页面根节点注入 scoped CSS vars，并在 PRD 写明独立色盘原因 |

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

## 背景层实现规则

实现 `design.md` 的 `backgroundLayer` 时，先考虑页面根画布，再做内容面板。不要先堆白卡片再临时补装饰。展示型页面、工作台、看板、门户、官网、登录页和空状态页推荐有非纯空白的画布；近白画布可以保留，但要通过淡渐变、细线、星芒、局部装饰、素材或内容密度形成背景感。如果 `design.md` 指定 `topIrregularWash`、`radialGlowWash`、`flowLight` 或 `organicNoise`，必须在源码里落成对应 CSS。

推荐结构：

```jsx
<div className="oy-page-root" data-yida-theme-root="true">
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
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 8%, rgba(120, 170, 255, .16), transparent 34%),
    linear-gradient(135deg, #f7fbff 0%, #fff8f0 48%, #f4faf7 100%);
}
.oy-page-root::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 320px;
  background: linear-gradient(120deg, rgba(255, 210, 222, .42), rgba(204, 238, 231, .38));
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
@keyframes oy-flow-light {
  0%, 100% { transform: translateX(-28%); opacity: .22; }
  50% { transform: translateX(28%); opacity: .42; }
}
@media (prefers-reduced-motion: reduce) {
  .oy-page-root::after { animation: none; opacity: .18; }
}
```

落地要求：

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
| `--color-brand1-5` / `--color-brand1-7` | 交互色阶 | hover / active / pressed 状态 |
| `--color-brand1-9` / `--color-brand1-10` | 深色阶 | 深色标题、深底按钮、深色主题强调 |
| `--color-brand-1` ~ `--color-brand-4` | 移动端品牌色阶 | 移动端桥接、原生表单、表单提交/详情 iframe 和平台移动壳层 |
| `--color-group` | 平台图表色组 | 多系列折线、柱状、排名、环形图配色 |
| `--oyd-control-selected-bg` | 页面级选中浅底 | 下拉选中项、Tabs 选中底、轻量筛选块 |
| `--oyd-control-info-bg` | 页面级信息浅底 | 提示块、空态引导、数据说明背景 |

语义色保持固定：成功、警告、错误继续用 antd 默认或平台语义变量，避免被主色覆盖。

## themeScope：主题作用域落地

使用 `YidaCodeCanvas` 组件实现的页面 `page-spec.json` 会把主题拆成两个概念：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `themeProfile` | 当前应用主题；缺证据时按业务气质选择平台预置 key 或自定义 token | 应用主题；页面重构/局部美化先沿用当前应用主题 |
| `themeScope` | `page` | 主题作用域，决定只影响当前页还是请求应用壳层一起换肤 |

`themeScope: page` 是默认安全模式：真实业务页默认使用应用主题 token profile，不污染应用其他页面。页面重构/局部美化即使是 page scope，也先以当前应用主题为基准，只补当前页密度、间距、状态色和图表色阶。用户明确要求完全不同风格、显式传了 `themeColor`，或页面是独立品牌/活动页时，在当前页面根节点注入 CSS 变量做页面级覆盖。

`podBlue`、`podGreen`、`podOrange` 是常用浅底候选，不是固定默认。`blue`、`green`、`orange`、`podBlue`、`podGreen`、`podOrange` 都作为应用主题 token profile 保留原名，不互相改写；完整变量和语义以 `yida-design/references/theme/theme-token-presets.md` 为准。自定义品牌色必须在页面源码里注入 `style#yida-global-theme` 或 scoped vars，不能假装是平台 `--theme`。需要注入时复制 [Yida Global Theme Runtime Helpers](theme-runtime-helpers.md) 的 YidaCodeCanvas helper；它会同时写入当前文档、同源可访问的父级 iframe 文档，以及 `FormOpenContainer` 打开的同源提交页/详情页子 iframe 文档。

```jsx
var THEME_COLOR_LEVELS = {
  themeColor: 6,
  themeColorSoft: 2,
  themeColorTint: 3,
  themeColorDeep: 9,
};

function getThemeColor(profile, key, defaultColor) {
  if (profile && profile.followRuntimeTheme && THEME_COLOR_LEVELS[key]) {
    return readBrandColor(THEME_COLOR_LEVELS[key], defaultColor);
  }
  return (profile && profile[key]) || defaultColor;
}

function buildScopedThemeVars(scope, profile) {
  if (scope !== 'page' || (profile && profile.followRuntimeTheme)) { return {}; }
  return {
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#6B7CAB'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#F3F5FB'),
    '--color-brand1-3': getThemeColor(profile, 'themeColorTint', 'rgba(107, 124, 171, 0.2)'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#435480'),
  };
}
```

`themeScope: app` 用于用户明确希望导航、顶部壳层和内容页统一换肤时。此时页面加载后调用壳层桥接能力；桥不存在时静默跳过，不阻塞页面渲染。

```jsx
React.useEffect(function () {
  if (themeScope !== 'app') { return; }
  try {
    window.__YIDA__ && window.__YIDA__.updateShellConfig && window.__YIDA__.updateShellConfig({
      themeConfig: {
        theme: profile.navTheme || 'light',
        colorMode: profile.colorMode || 'gradient',
        mode: profile.mode || 'color_color',
        themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#6B7CAB')),
        mobileNavStyle: profile.mobileNavStyle || 'top',
      },
    });
  } catch (e) {}
}, []);
```

页面重构先把当前应用主题写入 spec；缺少主题证据时按业务气质判断，而不是固定三选一。页面级换肤写 scoped 变量；用户明确要求应用主题风格/应用主题色时，使用 `themeProfile: yida-app-theme` 或显式 `themeScope: app`。

## PRD 与 design.md 字段落地规则

从 PRD 或派生的 `page-spec.json` 读取业务边界，从 design.md 读取主题 token 与视觉执行规则，并落地 `themeScope`：

| 用户说法 | spec |
| --- | --- |
| 整个应用统一、全局换肤、系统整体主题、应用主题也改 | `{ "themeScope": "app" }` |
| 左侧导航/菜单/顶部壳层也一起变色，导航和内容区同色 | `{ "themeScope": "app" }` |
| 某个页面/首页/看板/自定义页变好看、页面重构或局部美化 | `{ "themeScope": "page", "themeBase": "current-app-theme" }` |
| 明确说保持导航不变、其他页面不变、只改当前页 | `{ "themeScope": "page" }` |

设计输入冲突时，回到 `yida-design` 补齐明确值，再进入自定义页面实现。

## 核心事实：CSS 变量直接级联，antd token 使用解析色值

`YidaCodeCanvas` 组件的 `runtimeCode` 在**运行页面真实 `window`** 里 `new Function` 执行（见 SKILL.md「运行时事实」），组件挂在页面 DOM 树内。由此得到主色落地的分界：

| 消费方 | 品牌色怎么给 | 原因 |
| --- | --- | --- |
| 普通 DOM / Tailwind 元素（`style` / `className`） | **直接用 CSS 变量** `var(--color-brand1-6)` | CSS 变量沿 DOM 树级联，`YidaCodeCanvas` 节点在页面 DOM 树内，能读到平台注入的 `--color-brand1-*` |
| antd 组件（Button / Table / Tabs…） | **JS 解析成真实色值**喂 `ConfigProvider.theme.token.colorPrimary` | antd 的色板（hover/active/disabled）由 JS 算法从一个真实颜色推导，`var(...)` 是字符串塞不进算法 |
| JS 消费的颜色：recharts `stroke`/`fill`、canvas 绘制、图表配色数组 | **JS 解析成真实色值** | 传给库的是运行时字符串，不走 CSS 级联 |

所以只有「JS 要拿到真实颜色」的场景才需要读值，其余直接用 CSS 变量最省事。

## 读品牌色的 helper（JS 消费场景用）

因为跑在真 window，直接读根节点计算样式即可。helper 必须带兜底逻辑：先读运行态 `--color-brand1-*`，读不到、空串或读取异常时返回传入的 `defaultColor`。`defaultColor` 必须来自当前项目 `design.md` 的 tokens 或当前应用主题 token profile，不能另起一套旧默认方案。

```jsx
// 品牌色阶：1 最浅 → 6 主色 → 10 最深，与平台 --color-brand1-* 对齐
function readBrandColor(level, defaultColor) {
  try {
    var el = document.documentElement;
    var v = getComputedStyle(el).getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || defaultColor;
  } catch (e) {
    return defaultColor;
  }
}

// hook 形式：首帧同步取值，无闪烁
function useBrandColor(level, defaultColor) {
  var s = React.useState(function () { return readBrandColor(level, defaultColor); });
  return s[0];
}
```

> **变量作用域**：平台把 `--color-brand1-*` 定义在页面容器时，给组件根节点挂 `ref`，在 `useEffect` 里读 `getComputedStyle(rootRef.current)`，读到后 `setState` 触发一次重渲染。默认先用 `documentElement` 同步取值，空串时再用根节点 ref 读取。

## antd：ConfigProvider 注入 colorPrimary

用 `readBrandColor` 取主色，交给 `ConfigProvider`，antd 会自动推导 hover/active/disabled 整套色板。语义色（success/warning/error）用 antd 默认，不覆盖，保证语义稳定。

```jsx
import React from 'react';
import { ConfigProvider, Button, Table } from 'antd';

function readBrandColor(level, defaultColor) {
  try {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || defaultColor;
  } catch (e) { return defaultColor; }
}

function YidaComp(props) {
  var colorPrimary = readBrandColor(6, 'rgb(0, 137, 255)'); // 兜底值来自当前 design.md 或应用主题 token profile
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: colorPrimary,   // 主色来自应用主题 token；显式要求时才跟随应用品牌
          borderRadius: 12,             // 控件圆角来自 design.md；业务面板的大圆角用 CSS 单独写
        },
        // 不覆盖 colorSuccess/colorWarning/colorError，语义色保持固定
      }}
    >
      <div style={{ padding: 24 }}>
        <Button type="primary">主操作</Button>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
```

**要点**：`ConfigProvider` 包在组件最外层，页面内所有 antd 组件统一吃到品牌色。主色统一从 `colorPrimary` 注入，组件级颜色只保留必要的业务语义色。

## 默认 light 模式避免灰黑主题

业务列表、协同表、数据管理页、工作台和门户默认都是 light 模式。正文使用深色保证可读性；主操作、选中态、筛选焦点、批量操作和信息标签使用平台品牌色或当前页面确认的品牌色；卡片边框、表格分割线和下拉浮层边框使用浅色品牌混合，例如 `#DCE6F2`、`color-mix(in srgb, var(--oy-brand) 16%, #DDE8F4)`。用户明确要求暗色大屏、夜间模式或高对比风格时使用深色主视觉。

## 控件焦点态与下拉浮层 reset

使用 `YidaCodeCanvas` 组件实现的页面只要出现搜索框、筛选下拉、日期选择、文本输入、成员/部门/上传等运行态控件，就在页面 `<style>` 顶部注入控件 reset，统一输入框、下拉触发器、focus ring 和字体粗细。

实现规则：

- `ConfigProvider` 增加 `getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}`，让 antd Select / DatePicker 等弹层留在当前页面作用域，避免浮层脱离页面样式。
- 页面根节点使用 `oy-*` 根类，并在 `<style>` 顶部放 `OPENYIDA_CANVAS_CONTROL_CSS` 同款 reset。
- 控件默认边框使用浅灰蓝，hover 使用品牌色低饱和混合，focus 使用浅品牌描边 + 3px 柔和 ring。
- 下拉浮层统一 10px 圆角、浅边框、柔和阴影，active / selected 选项使用品牌浅底，不用黑色描边或浏览器原生 select。

最小片段：

```jsx
<ConfigProvider
  getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}
  theme={{ token: { colorPrimary: brand, borderRadius: 12 } }}
>
  <div className="oy-business-list" style={{ '--oy-brand': brand, '--oy-brand-deep': brandDeep }}>
    <style>{`
      .oy-business-list {
        --oy-control-border: #d7dee8;
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
</ConfigProvider>
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

色阶对应以 `design.md` 和 yida-design 主题 token 语义为准：主色 `brand1-6`、填充按钮 hover 亮一档 `brand1-5`、按下深一档 `brand1-7`、通用浅色 hover 底 `brand1-1`、选中/标签浅底 `brand1-2`。

## 图表 / recharts：用解析后的品牌色组

图表颜色是 JS 传给库的字符串，使用 `readBrandColor` 或解析 `--color-group`。多系列图表优先读 `--color-group`，这样应用主题里的色组可以控制趋势线、柱状、排名和环形图的层次。

```jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function readBrandColor(level, defaultColor) {
  try {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || defaultColor;
  } catch (e) { return defaultColor; }
}

function YidaComp(props) {
  var brand = readBrandColor(6, '#6b7cab');
  var groupValue = getComputedStyle(document.documentElement).getPropertyValue('--color-group').trim();
  var colorGroup = groupValue.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g) || [
    brand, '#00c4c4', '#4caf50', '#006868', '#ff6b35', '#a070ff',
  ];
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
          <Line type="monotone" dataKey="value" stroke={colorGroup[0]} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default YidaComp;
```

多色系列需要区分时，用 `--color-group` + 语义色，保持低饱和、分层明确的图表色组。

## 自查清单（主色相关）

- 页面最外层有 `ConfigProvider` 且 `token.colorPrimary` 来自 `readBrandColor`，不是硬编码色值。
- 有输入/筛选/下拉/日期/运行态字段组件时，已注入控件 focus/dropdown reset，focus 后没有黑色粗边或突兀加粗。
- Tailwind 主色类用 `var(--color-brand1-*)`，没有散落的 `#1677ff` / `bg-blue-500`。
- 图表 / canvas 绘制颜色走 `readBrandColor` 或 `--color-group`，无硬编码蓝。
- 语义色（成功/警告/错误）保持 antd 默认或平台语义变量，未被主色覆盖。
- 视觉方向来自 `yida-design`：配色、圆角、图标和文案都完成业务化处理。
