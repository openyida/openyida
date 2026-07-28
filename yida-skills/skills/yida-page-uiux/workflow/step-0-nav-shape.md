# Step 0：导航形态判定

> 决定要不要跟应用框架融合、要不要自带导航壳。这是页面类型之上的**前置条件**，先于 Step 1。

先确认这个自定义页**运行时是否隐藏了应用导航**，它决定了主色策略和是否需要自建导航。

## 怎么判定

- 页面配置为隐藏导航：发布时用 `openyida update-form-config <appType> <formUuid> false "<页面标题>"`（第 3 参 `isRenderNav=false`），或访问地址带 `?isRenderNav=false`。
- 用户诉求里出现「沉浸式 / 独立页 / 全屏 / 门户首页当应用入口 / 大屏 / 分享页 / 不要宜搭那圈框」等，通常意味着导航隐藏。
- 不确定时按「导航可见」这个更安全的默认走，并在决策块里标注假设。

## 两种形态的策略分叉

| | 导航可见（默认） | 导航隐藏（`isRenderNav=false`，沉浸/独立/门户/大屏） |
|---|---|---|
| **页面角色** | 嵌在应用框架内的一块内容区，左侧/顶部还是宜搭的应用导航 | 页面即整个视口，应用框架的导航已消失，页面就是完整体验 |
| **主色策略** | 真实业务页**跟随应用品牌**（`var(--color-brand1-*)`），与应用框架无缝融合；官方 sample / 示例展示应用必须页面级独立主题，不继承宿主 App | **不必严格跟品牌**，可自立一套完整视觉体系（尤其大屏/分享/科技风）；品牌色仍是安全默认，但允许换主色相。**语义色（成功/警告/错误）永远固定**，去 AI 味红线照样生效 |
| **导航责任** | 无需自建，应用导航负责跨页跳转 | **必须自带导航壳**：应用导航没了，页面要自己承担应用级导航 |

## 导航隐藏时的自带导航壳要点

- **壳型选择**：顶部标签栏 / 左侧边栏 / 顶部条 + 面包屑——按信息广度选，别只堆一个孤零零的返回按钮。
- **多视图切换**：默认 Canvas 用 `useState`，需要可分享/可后退时用 URL hash + `useEffect` cleanup；普通页 `_customState.activeView` 仅作 legacy fallback。
- **跨页跳转**：需要跳到别的自定义页/表单时，用 [field-and-url-reference.md](../../../references/field-and-url-reference.md) 的地址模板拼完整 URL，并把导航项参数合并进去；跳目标自定义页必须带 `?isRenderNav=false` 保持沉浸，不要用会丢参数的裸 `router.push(formUuid)`。
- **配置闭环**：只要页面内自绘应用级导航，发布后必须执行 `openyida update-form-config <appType> <formUuid> false "<页面标题>"` 隐藏宜搭原导航，并验证最终 URL 仍带 `isRenderNav=false`。
- **移动端**：侧边栏在窄屏要能收起为抽屉/底部标签；Canvas 默认走 CSS media query/`matchMedia` hook，legacy 普通页才用 `this.utils.isMobile()`。

**导航壳形态选型**：侧边栏 / 顶部 / 顶部+侧边混合 / 浮动胶囊 / 标签页——按顶级模块数量和是否常驻选。需要选型表、每种形态的骨架、选中态、移动端收敛、Code Canvas 优先示例和 legacy 普通页 fallback 时，调用 `use_skill("yida-nav-shell", "设计页面内自绘导航壳")`。

> 导航壳的**视觉方向**仍走 Step 1–6；形态与实现调用 `yida-nav-shell`，默认交 `yida-canvas-custom-page`。仅实例桥依赖或维护旧 `.oyd.jsx` 时交 `yida-custom-page`。

## 产出

在决策块「导航形态」一行记录：导航可见（跟品牌融合）/ 导航隐藏 `isRenderNav=false`（视觉自立 + 自带导航壳，说明壳型、隐藏原导航配置方式、导航项公共 URL 参数）。

## 下一步

→ [Step 1：页面类型判定](step-1-page-type.md)
