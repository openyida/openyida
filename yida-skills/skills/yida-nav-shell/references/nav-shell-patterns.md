# 自定义导航壳形态目录

根据 PRD、design.md 和用户参考选形态并设计，不用示例默认外观覆盖已有设计。应用/页面隐藏按 [导航技能](../SKILL.md#必做配置)，权限与跳转按下方契约。

## 选型速查

| 形态 | 何时用 | 项目数量参考 | 移动端 |
| --- | --- | --- | --- |
| 左侧边栏 | 模块多、分组多，需要常驻入口的后台或门户 | 5–12 项，可分组 | 按钮唤出抽屉菜单 |
| 顶部导航 | 模块少，表格、看板或内容需要较宽空间 | 2–6 项 | 汉堡菜单或紧凑菜单 |
| 顶部＋侧边 | 顶部切业务域，侧栏切该域内模块 | 顶部 2–5 域，侧栏按域分组 | 业务域切换＋抽屉菜单 |
| 悬浮胶囊 / Dock | 沉浸展示、轻量门户，减少常驻导航占位 | 3–6 项 | 底部胶囊或可收起菜单 |
| 标签页 | 同一模块的同级视图，不替代应用主导航 | 2–8 项 | 横向滚动 |

数量仅供布局参考，不增删业务模块。沿用用户指定形态，否则 AI 按场景决定，不另问样式选项。

## 通用设计要点

导航表达应用身份、当前位置和有效任务。名称、顺序、分组来自 PRD，图标统一用 lucide-react 或 @ant-design/icons。选中态按设计采用胶囊、指示线或字重，不用 emoji、字母或 CSS 拼图标。导航与内容共同构图，避免重复菜单标题；外观变化不改变业务接口、权限、筛选及跳转参数。

## 形态 1：左侧边栏

适合多模块、分组频繁切换的后台或门户。按使用频率安排应用名、常用入口、业务分组和底部操作；实体或浮动侧栏均需落实下方折叠、调宽交互。

## 形态 2：顶部导航

默认贴顶通栏，无顶部/左右外侧留白或胶囊轮廓；内侧内容可居中限宽。悬浮栏仅按明确设计选用，仍记录 navigation.variant=top。业务工作区导航占位；有首屏背景图时叠加背景，默认透明，滚动后加遮罩底色，回顶恢复透明。

sticky 本身占位，共享网格建立叠加关系；先检查宿主滚动和祖先 overflow/transform，受限时按宿主边界用 fixed，不能覆盖平台侧栏。位置与首屏/滚动态写入 design.md；固定定位不等于悬浮外观，文字安全区不推下背景。

## 连续展示页共享首屏背景

`canvas-nav-content` 的 `layout="document"` 使导航与 main 共用网格区域，导航默认 sticky，宿主限制时显式用 `navigationPosition="fixed"`，按本页边界定位，main 随已有页面滚动；不固定高度、不裁切内容，也不额外创建滚动条。document 的根、main、content 均使用自然高度，不套 workspace 的 `flex:1 1 0/min-height:0`。导航包裹层保持透明；提取 canvas-nav-top 后传 `headerOnly`，让它只渲染菜单，避免重复 main 和 100vh 外壳。`ResizeObserver` 测量菜单真实高度，在根节点写入局部 `--openyida-navigation-height`；窄屏展开和换行后也能更新安全区。

```jsx
<div className="brand-page">
  <style>{`
    .brand-page .hero {
      padding: calc(var(--openyida-navigation-height, 0px) + 48px) 24px 72px;
      background-size: cover; background-position: center;
    }
    .brand-page .section {
      scroll-margin-top: calc(var(--openyida-navigation-height, 0px) + 16px);
    }
    .brand-page .content { max-width: 1200px; margin: 0 auto; }
  `}</style>
  <CanvasNavigationContent layout="document" navigation={<CanvasNav headerOnly overlay title={brandName} items={items} activeKey={activeKey} onSelect={select} />}>
    <section className="hero section" id="home" style={{ backgroundImage: heroBackground }}>
      <div className="content">{renderHeroContent()}</div>
    </section>
    <section className="section" id="products">{renderProducts()}</section>
  </CanvasNavigationContent>
</div>
```

这是结构片段，`heroBackground` 来自已验证素材和设计遮罩；品牌、菜单、选择回调及内容函数由页面实现。导航的顶部/左右间距放在菜单内部 padding 中，让测量包含它；不要用折叠 margin 造间距。背景覆盖首屏，内容安全区只加一次。`maxWidth/gutter/radius/height` 是工作区参数，document 模式由页面区块设置内容宽度和间距。

锚点不改变 contentKey、不卸载整页。容器捕获宿主滚动事件并同步局部 data-scrolled；CanvasNav 的 overlay 随它切换透明/底色，展开时保持底色。锚点选中态仍由页面按实际滚动位置同步，并清理监听。滚动后加底色、回顶透明，文字随背景切换，移动端展开时保留底色。实际宿主验证 sticky，不能仅凭本地预览。document 不支持 iframeSrc，原生任务用 workspace 或表单抽屉。

## 形态 3：顶部＋侧边

用于真实两级信息架构：顶部切业务域，侧栏显示域内任务；切域进入该域默认或上次可见入口，两层不重复同一组菜单。侧栏支持折叠和拖拽。

## 形态 4：悬浮胶囊 / Dock

适合少量高频入口的沉浸页或轻量门户。按构图放在顶部、底部或侧边，避开表单提交按钮、图例和移动端安全区。底部 Dock 可使用 fixed、left:50%、translateX(-50%)、bottom:calc(20px + env(safe-area-inset-bottom, 0px))，内容底部预留实际 Dock 高度及间距；尺寸材质依设计，不遮最后一行数据。

## 形态 5：标签页

同模块视图使用 antd Tabs 或自绘标签，选中态与内容同步；窄屏横向滚动，键盘支持方向键、Home、End，跳过禁用项。页内标签不隐藏平台导航。

## 视图切换骨架

只做本地切换时用 React 状态；分享、刷新、前进后退沿用路由或同步 hash。下方 AppShell 演示保留导航和 URL 的切换，纯本地视图可将 iframe 分支替换为业务组件映射；状态放在稳定父层，不把 PRD 的多个真实页面变成静态占位。快速切换、无权限回退和未保存内容遵循 [页面与导航连续性](../../yida-design/references/page-continuity.md)。

## 侧栏交互

自定义侧边导航及顶部＋侧边布局的 PC 端必须支持折叠/展开和拖拽调宽，手写 UI 也要实现：

- 提供明确的折叠按钮和可拖拽边缘；折叠状态与展开宽度分开保存，展开时恢复折叠前宽度。
- 折叠后图标、当前项和展开入口仍可用，菜单全名可通过 Tooltip 显示；按钮带可访问名称和展开状态。
- 侧栏宽度变化时内容区同步调整；拖拽设合理上下限并随视口收窄，例如展开宽度可在 180–400px 内调整，具体按设计确定。
- 拖拽使用指针捕获，结束或取消时释放；边缘可聚焦，支持方向键调宽、Home/End 到边界、双击恢复默认值。
- 移动端切为抽屉菜单或可展开/收起的菜单，不要求拖拽调宽。

默认宽度可消费 `--shell-dark-aside-width`，折叠宽度可消费 `--pod-nav-side-collapsed-width`，在组件内提供合理回退。交互能力必须保留，具体 UI 无须沿用示例样式。

## 导航数据来源

自定义导航的数量、名称、顺序、分组、默认任务和用途来自当前入口的 PRD。

先区分页面内展示与真实资源导航。公开官网的首页、文化介绍等页内视图直接使用本地数组；需要统一过滤/选择 helper 时，显式用 local，不请求 getAccessableNavs：

```jsx
const items = [
  { key: 'home', label: '首页', targetType: 'local', viewKey: 'home' },
  { key: 'culture', label: '文化介绍', targetType: 'local', viewKey: 'culture' },
];
const menus = await loadCanvasNavigation({ items, mode: 'local' });
const active = selectCanvasNavigation(menus, requestedKey, 'home');
// 按 active.viewKey 渲染真实本页组件，URL 同步沿用下方切换骨架。
```

local 不接受 href/url 或真实页面跳转。含 access 时仍需 appType 和真实 resolveAccess；未授权项隐藏，查询失败不放行。业务数据读取、预约提交和管理操作另按平台权限执行；不得删除受保护菜单的 access。规划中的 sceneKey/resource/access 仍保留，不能把公开内容的菜单显示与受保护业务授权混为一谈。

platform 只接绑定 formUuid/navUuid 的真实页面，local 或未绑定资源的叶子会在网络请求前报错。编译器也拦截静态可识别的误用；动态配置仍要验证。不要将“过滤后为空”或请求失败兜底为全量菜单。

下面的数据树过滤用于 mode=platform；独立资源任务用 mode=independent 和真实 resolveAccess，按 [访问态入口契约](../../yida-app/references/entry-navigation.md#自定义菜单过滤) 执行，不能将平台树展示规则当作业务授权。使用当前访问者登录态请求 `/{appType}/query/formdesign/getAccessableNavs.json`，获取可见范围；`formUuid` 和 CSRF 值来自当前页面运行态。已有请求和正确的过滤逻辑时直接复用；首次接入可使用下面的数据片段，其中 `filterCanvasNavigation(plannedItems, navs, hiddenNav)` 负责可见性过滤，不包含导航 UI：

```bash
openyida sample openyida-page-template canvas-nav-data --output .cache/samples/canvas-nav-data.jsx
```

```jsx
const items = await loadCanvasNavigation({
  items: plannedItems, // PRD 导航配置，叶子项绑定真实 navUuid 或 formUuid
  appType,
  formUuid,
  csrfToken, // 当前页面运行态的 CSRF 值
  hiddenNav, // 当前 g_config.navConfig.hiddenNav，未配置时传 []
  signal: controller.signal, // 页面 effect 清理时调用 controller.abort()
});
```

`plannedItems` 遵守菜单及访问态入口契约：任务 key 独立，绑定真实资源、用途与参数，本地视图绑定承载页。同一资源可有多个任务入口；分组仅需 label/children，有资源约束时另绑定。独立入口补齐 formUuid/viewUuid/access，不以平台展示范围代替授权。

片段递归排除 hidden 节点及 hiddenNav 命中 slug/navUuid 的子树，以可见 ID 过滤 PRD 菜单；保留规划顺序、分组和展示配置，不添加计划外资源，移除空组。侧边/顶部/Dock 用扁平入口，混合导航用两级结构。

页面首次加载或应用切换时清空旧菜单，取消旧请求，再加载当前应用菜单。按以下状态展示：

| 状态 | 页面处理 |
| --- | --- |
| 加载中 | 显示加载提示，菜单和对应内容等待加载完成 |
| 请求失败 | 显示重试入口 |
| 没有可见入口 | 显示“无可用导航” |
| 菜单加载完成 | 按当前地址选中可见入口；未指定入口时按 PRD 选择，先进入 defaultMenuKey 对应的可用任务，再回退首个可用任务 |
| 地址中的 hash 指向不可见入口 | 先切至 defaultMenuKey 对应的可用任务，再回退首个可见入口；没有可见入口时显示“无可用导航” |

页面访问和数据权限继续由平台校验。

## 入口用途与嵌入页面

同一张表单有两种访问链接，`formUuid` 相同而路由用途不同：

| 入口用途 | 路径 | 内容 |
| --- | --- | --- |
| 表单工作台 / 管理 | `/{appType}/workbench/{formUuid}` | 包含管理视图，用于查询、审核、维护记录 |
| 填写 / 提交 | `/{appType}/submission/{formUuid}` | 直接进入原生提交表单 |

管理链接可以带 `hideLeftNav=true`，两种链接都可带 `corpid`。这些参数不决定入口用途，也不能代替应用导航持久化配置。路由由业务任务决定；管理与提交入口绑定同一资源时仍使用独立菜单 key，权限过滤不能把两个入口合并成一个。

按 PRD 主任务为可见节点配置 `targetType`：填写、报名、申请等入口用 `submission`；查询、审核、管理入口用 `page`；外部链接用 `url`。同一表单可对应不同任务入口，接口结果控制可见性，页面映射补充入口用途。

```jsx
// 此入口来自过滤后的 PRD 菜单，其 targetType 已规划为 submission。
const registration = items.find(item => item.key === 'registration');
<CanvasNavigationContent title="活动报名" iframeSrc={buildCanvasNavigationUrl(registration, appType, { embedded: true })} />
```

`canvas-nav-data` 同时提供 `buildCanvasNavigationUrl`：`submission` 生成原生提交页地址，`page` 生成 workbench 地址；嵌入时自动补对应导航参数，`params` 保留预填值和业务参数。入口用途明确后再生成 URL。导航任务占主内容区；页面内新增或详情按钮复用 [FormOpenContainer 抽屉](../../yida-canvas-custom-page/references/navigation-and-entry-guide.md#标准-formopencontainer)。原生表单的页面导航参数由容器生成；自定义页面的应用导航按技能中的应用设置隐藏。已有自定义页的 `/{appType}/custom/{formUuid}` 地址可继续使用。用 `URL` / `URLSearchParams` 构造地址，保留 `corpid`、`locale` 和业务参数。

## 保留导航壳的最小示例

**MUST**：自定义导航属于应用外壳，点击应用内导航后必须仍可见、可操作。原生提交页和数据管理页不包含这套自绘导航，不能直接用 `location.href` / `router.push` 替换顶层页面。`isRenderNav=false` 只隐藏原生导航，不会自动保留自绘导航。

导航任务在主内容区打开；页内新增/详情使用标准 FormOpenContainer 抽屉，不混用。

先提取并整体合并标准内容容器（合并重复 import）：

```bash
openyida sample openyida-page-template canvas-nav-content --output .cache/samples/canvas-nav-content.jsx
```

`CanvasNavigationContent` 默认 `layout="workspace"`。嵌入分支使用平台的 `window.YidaCanvasIframe`，让平台组件准备免登地址；缺少组件的旧运行时显示提示及新窗口按钮，不直接渲染原生 iframe。新窗口优先调用传入的 `utils.openPage(href)` 或 `window.__OPENYIDA_UTILS__.openPage(href)`，参数是 URL 字符串。`navigation` 只接顶部菜单，`children` 接本地工作台，`iframeSrc` 接原生页面地址；不传地址时显示 children，可用于无权限或加载失败提示。`contentKey` 变化会卸载旧内容，导航保持挂载；默认重置滚动，显式 `preserveScroll` 按任务 key 恢复本地内容区位置。筛选、分页、已载数据和草稿需由稳定父层持有，并在恢复时已渲染足够内容；容器不缓存业务状态、iframe 或异步数据。`height` 默认 `100dvh`，已有宿主或侧栏分配高度时传入该区域的确定高度（只有父级高度确定时才能用 `100%`）。`maxWidth`、`gutter`、`radius`、`background` 按 design.md 设置并在视图间保持一致；默认透明背景承接页面画布，不跨 iframe 改色。容器不负责鉴权、路由、草稿保存或判断跨域加载失败。

先用 `openyida sample openyida-page-template canvas-nav-data` 合并 helper。下例 items 是权限已就绪的叶子菜单，资源、targetType、params 均真实；只含本地工作台与原生任务，外链及带壳跨页不进 iframe 分支。外观按 design.md。

```jsx
import React, { useEffect, useState } from 'react';

function AppShell({ items, homeKey, appType, renderWorkbench }) {
  const readKey = () => new URLSearchParams(window.location.hash.slice(1)).get('view');
  const [requestedKey, setRequestedKey] = useState(readKey);
  useEffect(() => {
    const sync = () => setRequestedKey(readKey());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  const active = selectCanvasNavigation(items, requestedKey, homeKey);
  function select(item) {
    if (item.disabled || item.key === active?.key) return;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    hash.set('view', item.key);
    url.hash = hash.toString();
    window.history.pushState(window.history.state, '', url.toString());
    setRequestedKey(item.key);
  }
  return (
    <CanvasNavigationContent
      title={active?.label || '页面内容'}
      contentKey={active?.key}
      preserveScroll
      iframeSrc={active && active.key !== homeKey
        ? buildCanvasNavigationUrl(active, appType, { embedded: true }) : undefined}
      navigation={<nav aria-label="应用导航">
        {items.map(item => (
          <button key={item.key} type="button" disabled={item.disabled}
            aria-current={item.key === active?.key ? 'page' : undefined}
            onClick={() => select(item)}>{item.label}</button>
        ))}
      </nav>}
    >
      {!active ? <p>无可用导航</p> : renderWorkbench()}
    </CanvasNavigationContent>
  );
}
```

hash 的 `view` 保存任务入口 key，刷新及前进后退恢复选中内容，其他 query/hash 参数和 history.state 保留。该例约定 hash 为参数形式；已有路由协议的页面沿用原协议，不强行覆盖。权限完成后，若请求入口不可用，按 active.key 用 replaceState 校正 view，不新增历史；没有可用入口则移除 view 并显示无权限内容。嵌入地址必须指向真实内容资源，不能再次嵌入当前壳页或带同一导航的壳页，避免递归和双导航。仅 iframe 内页滚动；不再给 iframe 外套滚动卡片。嵌入失败时保留导航并显示错误和明确的新窗口入口，不自动跳走。

切换会卸载当前内容；存在未提交表单时，应结合原生页面支持的通信能力处理离开提示，不能声称本例自动保存草稿或能读取所有 iframe 的脏状态。

## MUST：主内容撑满剩余空间

本节仅用于业务工作区的 `layout="workspace"`，连续展示页使用上方 document 布局。工作区导航壳必须有确定的可用高度。独立全屏壳可用 `height: 100dvh`；已有宿主占用高度时使用宿主实际分配的确定高度，不能再叠加一个视口高度。仅 `min-height` 不能保证百分比高度链成立，也不要猜测 `calc(100vh - 80px)` 之类固定导航高度。

布局链逐层成立：壳 `display:flex; flex-direction:column`，导航 `flex-shrink:0`，main 同时具有 `display:flex; flex-direction:column; flex:1 1 0; min-height:0; overflow:hidden`；iframe 视口为 `position:relative; flex:1 1 0; min-height:0; overflow:hidden`，iframe 绝对定位填满该视口。仅给子级写 `flex:1`、父级仍为 block 不合格。工作台分支使用独立 `overflow:auto` 的滚动容器；原生页面分支仅 iframe 内页滚动。

切换后的连续性：工作台与嵌入页共享画布、内容最大宽度及左右边距，导航与内容保持相同的顶部间距。不能从居中工作台突然变成贴边满屏表单；宽表格确需更宽时在 design.md 明确。iframe 视口可裁切圆角，但不额外加白卡、内边距或另一层滚动；留白放在视口外侧，让画布自然衔接原生表面，不跨 iframe 修改原生页面 CSS。

- [ ] 各导航视图、窗口高度变化及窄屏下，内容视口高度均等于壳的剩余可用高度减去设计外侧留白；短内容不塌到 150px，长内容不撑开外层。
- [ ] 比较 main、iframe 视口和 iframe 的实际边界；iframe 与其视口等高，底部按钮可到达，无重复滚动条或大段意外空白。
- [ ] 工作台与原生页面来回切换，内容宽度、留白和画布连续；导航选中项及返回操作仍然正常。

## 菜单契约

| 菜单数据 | 用途 |
| --- | --- |
| `key` | 稳定且唯一的入口标识；分组和叶子项不重名 |
| `navUuid / formUuid` | platform/independent 的真实资源标识；local 展示项使用 viewKey |
| `viewKey` | local 的本页视图标识，不是平台资源 ID |
| `label / icon` | PRD 业务名称、可选功能图标 |
| `targetType` | 提交、页面或外链等入口用途，按上节确定 |
| `params` | 预填、来源和其他业务参数，构造 URL 时保留 |
| `href / targetNew` | 完整跳转地址及平台配置的新窗口行为 |
| `disabled / children` | 禁用状态和两级菜单结构 |

这是一份数据约定，手写 UI 的组件名和 props 不受限制。当前入口从可见菜单与当前 URL / 状态推导；两级导航从叶子项反推所在分组。跨页入口保留原生链接语义及修饰键点击行为。

应用内导航默认切换壳内内容。只有确认目标页面保留同一导航壳后，整页跳转才使用数据桥；已构造的完整地址调用 `router.push(href, params, false, true)`；桥不可用时当前窗口跳转，详见 [Canvas 点击骨架](../../yida-canvas-custom-page/references/navigation-and-entry-guide.md#canvas-点击骨架)。只做本地视图切换时更新 React 状态，需要 URL 同步时清理相应监听。

### 路由模式与数据桥兜底

完整地址使用 `window.__OPENYIDA_UTILS__.router.push(href, params, false, true)`，避免平台重复添加应用前缀；第三参控制新标签，第四参控制 URL 模式。数据桥仅在第四参缺省时自动识别 /APP_、HTTP(S) 和协议相对地址，保留 query/hash；显式 false 不会纠正。页面 ID 仍用 `router.push('FORM-xxx', params, false)`，不要与 URL 混用或绕过数据桥。验收最终地址只有一层应用路径，选中态、参数和目标正确。

## 主题 token

| 样式 | 使用的应用变量 |
| --- | --- |
| 导航表面与标题 | `--pod-shell-theme-bg-color`、`--pod-nav-logo-text` |
| 普通 / 悬停 / 选中 / 禁用文字 | `--pod-nav-item-text-*` |
| 悬停 / 选中背景 | `--pod-nav-menu-bg-hover-color`、`--pod-nav-menu-bg-selected-color` |
| 分隔线、选中指示、焦点 | `--pod-nav-sub-divider-color`、`--pod-nav-tab-line-selected-color` |
| 菜单高度、圆角、文字、间距 | `--pod-nav-menu-*`、`--pod-nav-top-tab-*` |
| 悬浮阴影 | `--pod-nav-popup-shadow` |
| 页内标签 | `--tab-pure-text-color-*`、`--tab-pure-ink-bar-color` |
| 自定义页整页画布 | `--pod-page-bg-color`（与原生页面统一）、`--pod-nav-page-padding` |
| 业务卡片 | `--pod-card-bg-color`、`--pod-card-border` |

主题由 `yida-design` 在应用级生成和配置；导航组件消费已有变量，必要的默认值放在 `var(...)` 回退中。颜色修改在主题文件完成，固定的布局结构留在组件中。导航深浅由导航主题决定，业务内容明暗由页面主题决定，分别验证。

## 验证

按 [页面与导航连续性](../../yida-design/references/page-continuity.md) 验证首屏、往返及异常；补测不同权限的隐藏分组/不可见 hash，侧栏折叠、恢复宽度与拖拽，浅深色导航的文字/焦点。无递归 iframe、双导航和双滚动；局部背景不修改宿主主题，未做运行态检查须明确记录。

## 可选代码参考

按需用 `openyida sample openyida-page-template canvas-nav-side --output .cache/samples/canvas-nav.jsx` 查看折叠/调宽；top、mixed、dock、tabs 示例同理，外观仍按设计。

CodeCanvas 是单文件，合并片段时去重 import 和同名函数；只提取需要的逻辑。
