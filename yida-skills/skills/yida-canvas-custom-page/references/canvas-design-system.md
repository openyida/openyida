# Code Canvas 主色对齐与视觉落地

本文件是 Code Canvas 页面的**实现层**引导：真实业务页怎么跟随宿主 App 的品牌主题色，而不是永远一片 antd 默认蓝；官方 sample / 示例展示应用则相反，必须自带页面级固定主题和差异化色盘，不被宿主 App 主题统一接管。视觉方向怎么定（页面类型、差异化、去 AI 味）是**栈无关**的，走共用的决策层技能 `yida-page-uiux`，本文件只讲 Canvas（React18 + antd + Tailwind）这套栈怎么把主色落地。

> 决策层：需要视觉方向时调用 `use_skill("yida-page-uiux", "确定 Code Canvas 页面视觉方向")`（先做 Step 0 导航形态判定，再定工作台/仪表盘/列表/详情、5 维差异化、去 AI 味、禁 emoji）。
> 实现层：本文件负责把「真实业务页主色跟随 App 品牌」和「sample 页面级独立主题」落到 antd token / Tailwind / 图表。

> **前提是导航可见且是真实业务页**：跟随品牌主色是为了跟应用框架融合。若页面隐藏了应用导航（`isRenderNav=false`，沉浸/独立/门户/大屏，由 `yida-page-uiux` Step 0 判定），主色相可自立、不必严格跟品牌。若是 `lib/samples/**` 或官方 sample 展示应用，也必须自立主色相：`followRuntimeTheme: false`，antd `colorPrimary` / 图表色 / CSS 变量都喂页面自己的固定色盘，**语义色仍固定、去 AI 味红线仍生效**。

## themeScope：页面级与应用级换肤

OpenYida 生成页会把主题拆成两个概念：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `themeProfile` | `yida-app-theme` | 宜搭应用主题色、壳层模式、移动导航样式等配置 |
| `themeScope` | `page` | 主题作用域，决定只影响当前页还是请求应用壳层一起换肤 |

`themeScope: page` 是默认安全模式：真实业务页默认跟随宜搭运行态 `style#yida-global-theme`，不污染应用其他页面。只有 `profile.followRuntimeTheme === false`、用户显式传了 `themeColor`，或当前文件是官方 sample 时，才在当前 Canvas 根节点注入 CSS 变量做页面级覆盖。sample 默认必须走覆盖模式。

```jsx
var THEME_COLOR_LEVELS = {
  themeColor: 6,
  themeColorSoft: 2,
  themeColorTint: 3,
  themeColorDeep: 9,
};

function getThemeColor(profile, key, fallback) {
  if (profile && profile.followRuntimeTheme && THEME_COLOR_LEVELS[key]) {
    return readBrandColor(THEME_COLOR_LEVELS[key], fallback);
  }
  return (profile && profile[key]) || fallback;
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

`themeScope: app` 用于用户明确希望导航、顶部壳层和内容页统一换肤时。此时页面加载后调用壳层桥接能力；桥不存在时静默降级，不阻塞页面渲染。

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

命令侧：`openyida generate-page product-homepage --theme-profile yida-app-theme --theme-scope page|app --compile`。不要默认手写全局 `:root` 覆盖；应用级换肤必须是显式选择。

## 自然语言推断规则

Agent 不应要求用户说出 `themeScope`。当用户表达以下含义时，直接在 spec 中写入对应字段：

| 用户说法 | spec |
| --- | --- |
| 整个应用统一、全局换肤、系统整体主题、应用主题也改 | `{ "themeScope": "app" }` |
| 左侧导航/菜单/顶部壳层也一起变色，导航和内容区同色 | `{ "themeScope": "app" }` |
| 只说某个页面/首页/看板/自定义页变好看或换色 | `{ "themeScope": "page" }` |
| 明确说不要影响导航、不要改其他页面、只改当前页 | `{ "themeScope": "page" }` |

同一句话同时出现“整体应用”和“不要影响导航”这类冲突时，以限制更强的 `page` 为准，或者简短确认一次。

## 核心事实：CSS 变量能穿透，antd token 不能

Canvas 的 `runtimeCode` 在**宿主页真实 `window`** 里 `new Function` 执行（见 SKILL.md「运行时事实」），组件挂在宿主 DOM 树内。由此得到主色落地的分界：

| 消费方 | 品牌色怎么给 | 原因 |
| --- | --- | --- |
| 普通 DOM / Tailwind 元素（`style` / `className`） | **直接用 CSS 变量** `var(--color-brand1-6)` | CSS 变量沿 DOM 树级联，Canvas 节点在宿主树内，能读到平台注入的 `--color-brand1-*` |
| antd 组件（Button / Table / Tabs…） | **JS 解析成真实色值**喂 `ConfigProvider.theme.token.colorPrimary` | antd 的色板（hover/active/disabled）由 JS 算法从一个真实颜色推导，`var(...)` 是字符串塞不进算法 |
| JS 消费的颜色：recharts `stroke`/`fill`、canvas 绘制、图表配色数组 | **JS 解析成真实色值** | 传给库的是运行时字符串，不走 CSS 级联 |

所以只有「JS 要拿到真实颜色」的场景才需要读值，其余直接用 CSS 变量最省事。

## 读品牌色的 helper（JS 消费场景用）

因为跑在真 window，直接读根节点计算样式即可。带兜底，读不到时退 OpenYida 默认的宜搭应用主题低饱和蓝灰。

```jsx
// 品牌色阶：1 最浅 → 6 主色 → 10 最深，与平台 --color-brand1-* 对齐
function readBrandColor(level, fallback) {
  try {
    var el = document.documentElement;
    var v = getComputedStyle(el).getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

// hook 形式：首帧同步取值，无闪烁
function useBrandColor(level, fallback) {
  var s = React.useState(function () { return readBrandColor(level, fallback); });
  return s[0];
}
```

> ⚠️ **变量作用域**：若平台把 `--color-brand1-*` 定义在某个容器而非 `:root`，`document.documentElement` 可能读到空串 → 命中 fallback。更稳的做法是给组件根节点挂 `ref`，在 `useEffect` 里读 `getComputedStyle(rootRef.current)`（组件节点一定在变量作用域内），读到后 `setState` 触发一次重渲染。先用 `documentElement` 同步取，空串再降级到 ref 方案即可。

## antd：ConfigProvider 注入 colorPrimary

用 `readBrandColor` 取主色，交给 `ConfigProvider`，antd 会自动推导 hover/active/disabled 整套色板。语义色（success/warning/error）用 antd 默认，不覆盖，保证语义稳定。

```jsx
import React from 'react';
import { ConfigProvider, Button, Table } from 'antd';

function readBrandColor(level, fallback) {
  try {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || fallback;
  } catch (e) { return fallback; }
}

function YidaComp(props) {
  var colorPrimary = readBrandColor(6, '#6b7cab'); // 缺失时退宜搭应用主题默认主色
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: colorPrimary,   // 主色跟随 App 品牌
          borderRadius: 8,              // 圆角等非主色 token 可按视觉方向调
        },
        // 不覆盖 colorSuccess/colorWarning/colorError，语义色保持固定
      }}
    >
      <div style={{ padding: 16 }}>
        <Button type="primary">主操作</Button>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
```

**要点**：`ConfigProvider` 包在组件最外层，页面内所有 antd 组件才统一吃到品牌色。只设 `colorPrimary` 一个入口，不要逐组件手写颜色。

## 默认 light 模式避免灰黑主题

业务列表、协同表、数据管理页、工作台和门户默认都是 light 模式。用户没有明确要求暗色大屏、夜间模式或高对比风格时，禁止把 `#111827`、近黑按钮、近黑描边、灰黑大阴影作为主题质感。正文可保留深色以保证可读性，但主操作、选中态、筛选焦点、批量操作和信息标签必须使用品牌色或 sample 自带主题色；卡片边框、表格分割线和下拉浮层边框使用浅色品牌混合，例如 `#DCE6F2`、`color-mix(in srgb, var(--oy-brand) 16%, #DDE8F4)`。

## 控件焦点态与下拉浮层 reset

Code Canvas 页面只要出现搜索框、筛选下拉、日期选择、文本输入、成员/部门/上传等运行态控件，就必须在页面 `<style>` 顶部注入控件 reset。否则浏览器默认样式或宿主样式会在 focus 时把输入框/下拉触发器变成黑色粗边、字重变粗，用户会感觉和宜搭平台控件风格割裂。

实现规则：

- `ConfigProvider` 增加 `getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}`，让 antd Select / DatePicker 等弹层留在当前页面作用域，避免浮层脱离页面样式。
- 页面根节点使用 `oy-*` 根类，并在 `<style>` 顶部放 `OPENYIDA_CANVAS_CONTROL_CSS` 同款 reset。
- 控件默认边框使用浅灰蓝，hover 使用品牌色低饱和混合，focus 使用浅品牌描边 + 3px 柔和 ring；禁止黑色粗边、系统默认 outline、突兀加粗。
- 下拉浮层统一 10px 圆角、浅边框、柔和阴影，active / selected 选项使用品牌浅底，不用黑色描边或浏览器原生 select。

最小片段：

```jsx
<ConfigProvider
  getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}
  theme={{ token: { colorPrimary: brand, borderRadius: 8 } }}
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

Canvas 节点在宿主树内，Tailwind 运行时对普通元素直接用 arbitrary value 引用 CSS 变量即可，**不需要 JS**：

```jsx
// 主色文字 / 背景 / 边框，直接引平台变量，跟随 App 主题
<div className="text-[var(--color-brand1-6)] border border-[var(--color-brand1-3)]">…</div>
<button className="bg-[var(--color-brand1-6)] hover:bg-[var(--color-brand1-5)] text-white rounded-lg px-4 py-2">
  主操作
</button>
```

色阶对应（与 native `design-system.md` 一致）：主色 `brand1-6`、填充按钮 hover 亮一档 `brand1-5`、按下深一档 `brand1-7`、通用浅色 hover 底 `brand1-1`、选中/标签浅底 `brand1-2`。

## 图表 / recharts：用解析后的品牌色组

图表颜色是 JS 传给库的字符串，必须用 `readBrandColor` 或解析 `--color-group`，不能硬编码 `#1677ff`。多系列图表优先读 `--color-group`，这样应用主题里的色组可以控制趋势线、柱状、排名和环形图的层次。

```jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function readBrandColor(level, fallback) {
  try {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || fallback;
  } catch (e) { return fallback; }
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

多色系列需要区分时，用 `--color-group` + 语义色，不要整排饱和撞色（见 `yida-page-uiux` 去 AI 味清单）。

## 自查清单（主色相关）

- 页面最外层有 `ConfigProvider` 且 `token.colorPrimary` 来自 `readBrandColor`，不是硬编码色值。
- 有输入/筛选/下拉/日期/运行态字段组件时，已注入控件 focus/dropdown reset，focus 后没有黑色粗边或突兀加粗。
- Tailwind 主色类用 `var(--color-brand1-*)`，没有散落的 `#1677ff` / `bg-blue-500`。
- 图表 / canvas 绘制颜色走 `readBrandColor` 或 `--color-group`，无硬编码蓝。
- 语义色（成功/警告/错误）保持 antd 默认或平台语义变量，未被主色覆盖。
- 视觉方向已按 `yida-page-uiux` 决策：不是默认蓝 + 大圆角 + emoji 的 AI 味套版。
