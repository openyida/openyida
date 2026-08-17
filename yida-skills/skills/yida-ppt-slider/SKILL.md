---
name: yida-ppt-slider
description: "宜搭全屏幻灯片页面开发，兼容旧 yida-ppt / PPT / 演示 / 幻灯片触发词，使用 React hooks 管理翻页、URL hash、键盘/演讲笔、全屏和副作用清理。支持浅色简约与 dark-tech 主题。平台 JSX 组件生命周期模式仅用于对应运行时维护。"
---

# 宜搭 PPT 幻灯片开发指南

## 核心定位

本技能用于在宜搭内交付全屏演示页：

- `.canvas.jsx` / `.canvas.tsx` + `YidaComp` 函数组件。
- `useState` 管当前页、主题、语言、导航显隐和全屏状态。
- `useEffect` 管键盘、hash、触摸、定时器和 cleanup。
- `useMemo` 派生当前页与页码数据。
- 常规图表默认交 `yida-rechart`；明确 ECharts/复杂 option 时才使用 `yida-chart`。

已有 `.oyd.jsx` / `.oyb.jsx` 或深度依赖平台实例桥时，按平台 JSX 组件运行时维护。

## 适用场景

| 用户意图 | 触发条件 | 处理方式 |
|---------|---------|---------|
| 在宜搭内创建演示文稿 | "PPT"、"yida-ppt"、"幻灯片"、"演示页面"、"产品路演" | 使用本技能 |
| 需要读取宜搭数据的演示 | 演示页要接入表单、权限或宜搭页面能力 | `YidaCodeCanvas` 组件 + `yida-canvas-data-binding` |
| 纯静态演讲稿 | 不依赖宜搭发布、不读取宜搭数据 | 优先改用独立 HTML 幻灯片能力 |
| 维护已有 `renderJsx` / `didMount` PPT | 已有平台 JSX 组件页面或强依赖平台实例桥 | 按平台 JSX 组件运行时维护 |

## 致命规则

1. **源码格式正确**：不得把 `.oyd.jsx`、`renderJsx`、`didMount` 写成默认页面实现。
2. **状态归 hooks**：翻页、导航、语言、主题、全屏状态用 React hooks。
3. **副作用必须清理**：键盘、触摸、鼠标、hash、fullscreen、定时器和图表副作用均在 `useEffect` cleanup。
4. **事件真实可触发**：禁止 `onClick={foo()}`、小写 `onclick`；可见按钮必须有 handler 或 disabled。
5. **图片完整展示**：默认 `object-fit: contain`，不得裁掉关键演示素材。
6. **hash 双向同步**：初始页读取 hash；翻页更新 hash；浏览器前进/后退能恢复页码。
7. **全屏由用户手势触发**：监听 `fullscreenchange` 同步 UI；卸载时移除监听。
8. **隐藏平台导航**：演示页发布后配置 `isRenderNav=false` 并验证最终 URL。

## 开发流程

```bash
# 1. 只读检测
openyida env --json
openyida login --check-only --json

# 2. 已获授权后创建应用/页面（已有则跳过）
openyida create-app "<应用名>"
openyida create-page <appType> "<页面名>"

# 3. 编写 `.canvas.jsx` 源码
# project/pages/src/<页面名>.canvas.jsx

# 4. 本地快检（以 yida-canvas-custom-page 的 compileCanvasLocal 为准）

# 5. 用户确认内容与主题后发布
openyida publish project/pages/src/<页面名>.canvas.jsx <appType> <formUuid>

# 6. 隐藏宜搭导航并回读验证
openyida update-form-config <appType> <formUuid> false "<页面名>"
openyida get-schema <appType> <formUuid>
```

`openyida check-page` / `openyida compile` 是平台 JSX 组件页面校验，不是使用 `YidaCodeCanvas` 组件实现页面的默认验证步骤。

## 技术骨架

```jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';

function clampPage(value, total) {
  return Math.max(0, Math.min(total - 1, value));
}

function readHashPage(total) {
  const raw = Number(window.location.hash.replace(/^#/, ''));
  return Number.isFinite(raw) && raw >= 1 ? clampPage(raw - 1, total) : 0;
}

function YidaComp() {
  const total = SLIDES.length;
  const [current, setCurrent] = useState(() => readHashPage(total));
  const [navVisible, setNavVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const goTo = useCallback((next) => {
    setCurrent((previous) => clampPage(
      typeof next === 'function' ? next(previous) : next,
      total,
    ));
  }, [total]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        goTo((page) => page + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        goTo((page) => page - 1);
      } else if (event.key === 'Home') {
        goTo(0);
      } else if (event.key === 'End') {
        goTo(total - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goTo, total]);

  useEffect(() => {
    const handleHashChange = () => setCurrent(readHashPage(total));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [total]);

  useEffect(() => {
    const hash = '#' + String(current + 1);
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
  }, [current]);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const slide = useMemo(() => SLIDES[current], [current]);
  return (
    <PresentationShell
      slide={slide}
      current={current}
      total={total}
      navVisible={navVisible}
      isFullscreen={isFullscreen}
      onNavigate={goTo}
      onNavVisibleChange={setNavVisible}
    />
  );
}

export default YidaComp;
```

触摸手势、鼠标底部热区、数字键缓冲和自动播放也分别放进 `useEffect`，每个 effect 独立 cleanup；不要把所有事件塞进一个难以维护的大 effect。

## 幻灯片数据与类型

`SLIDES` 放在组件外作为静态数据，或通过 props/数据桥加载；不要把全部文案硬编码在 JSX 分支中。

| 类型 | 用途 |
| --- | --- |
| `cover` | 封面 |
| `toc` | 目录 |
| `chapter` | 章节过渡 |
| `key-points` | 要点列表 |
| `image-text` | 图文混排 |
| `scene-image` | 场景展示 |
| `two-images` | 双图对比 |
| `chart` | 业务图表，默认 `yida-rechart` |
| `ending` | 结束页 |

## 主题

| theme | 风格 | 适合场景 |
| --- | --- | --- |
| `default` | 浅色简约、内容优先 | 技术分享、产品路演、培训 |
| `dark-tech` | 深色、粒子/网格、电影级转场 | 科技发布、沉浸演示 |

粒子背景用 `<canvas>` 时，在 React `ref` + `useEffect` 中初始化 `requestAnimationFrame`，cleanup 必须 `cancelAnimationFrame`、移除 resize 监听并释放引用。不要用固定 `setTimeout` 等 DOM。

## 响应式与交互

- 响应式优先 CSS media query / `matchMedia` hook，不使用一次性 `this.utils.isMobile()`。
- 页面根节点固定覆盖视口：`position: fixed; inset: 0; overflow: hidden`。
- 键盘支持方向键、PageDown/PageUp、Home/End；演讲笔通常映射到这些键。
- 数字键跳页用独立 hook 管缓冲与定时器，并在 cleanup 清除。
- 底部导航默认隐藏，鼠标靠近底部或触摸时显示；移动端触控目标不少于 44px。
- 图片使用 `max-width/max-height: 100%` + `object-fit: contain`。
- prefers-reduced-motion 时关闭粒子、自动播放和大幅转场。

## 图表边界

- 常规折线、柱、面积、饼/环、组合图：`use_skill("yida-rechart", "在 Canvas 幻灯片中实现业务图表")`。
- 只有用户明确要求 ECharts、复杂 ECharts option、bar chart race 或旧 native ECharts 演示时，调用 `yida-chart`。
- `references/echarts-race-example.md` 是明确 ECharts 的专项/legacy 参考，不是默认幻灯片骨架。

## 平台 JSX 组件维护注意事项

维护平台 JSX 组件页面或必须使用页面实例桥时：

- 状态可用 `_customState + forceUpdate`。
- 生命周期使用 `didMount` / `didUnmount`。
- 移动端可用 `this.utils.isMobile()`。
- 源码使用 `.oyd.jsx`，校验走 `openyida check-page` / `openyida compile`。

`references/examples.md` 和 `references/dark-tech-theme.md` 中标记为平台 JSX 组件/native 的代码只用于对应运行时维护；同等能力优先用 hooks 表达。

## 验收

- Canvas 本地编译通过，发布后回读到非空 `runtimeCode`。
- 方向键、PageUp/PageDown、hash 前进后退、全屏按钮、触摸翻页实际可用。
- 离开页面后不再响应事件、轮询或动画。
- 图片无关键裁切，手机竖屏可读，reduced-motion 有降级。
- 平台导航隐藏，分享 URL 定位页码有效。
- 使用 ECharts 时已明确记录命中的例外条件；否则图表默认 `yida-rechart`。

## 参考文档

| 文档 | 用途 |
| --- | --- |
| [核心示例](references/examples.md) | hooks 示例优先；旧 native 完整示例明确标记 legacy |
| [dark-tech 主题](references/dark-tech-theme.md) | 粒子/转场原则；旧 `renderJsx` 框架只作 legacy |
| [ECharts race 示例](references/echarts-race-example.md) | 仅明确 ECharts/bar chart race 或维护旧实现时阅读 |
| `yida-canvas-data-binding` | 演示页真实数据桥 |
