# CodeCanvas 导航模板

PRD 已确定自定义导航时，按形态复制一个组件，接入现有菜单和页面状态。应用及页面导航配置按 [导航技能](../SKILL.md#必做配置) 执行。

## 按需复制

| 形态 | CLI 模板名 | 组件 | 移动端 |
| --- | --- | --- | --- |
| 侧边导航 | `canvas-nav-side` | `CanvasNav` | 按钮展开页内菜单 |
| 顶部导航 | `canvas-nav-top` | `CanvasNav` | 按钮展开页内菜单 |
| 顶部＋侧边 | `canvas-nav-mixed` | `CanvasNav` | 按钮展开二级菜单 |
| 悬浮胶囊 | `canvas-nav-dock` | `CanvasNav` | 底部横向滚动，预留安全区 |
| 页内标签 | `canvas-nav-tabs` | `CanvasTabs` | 横向滚动，支持键盘切换 |

```bash
openyida sample openyida-page-template canvas-nav-side --output .cache/samples/canvas-nav.jsx
```

替换模板名即可复制其他形态。前四种每页选择一种；标签页按业务需要组合。CLI 在复制时拼接公共代码和选定布局；侧边及顶部＋侧边模板同时带入调宽与收起组件。标签页独立输出自己的样式和交互。

## 接入已有页面

1. 将生成片段的 import 合并到当前 `.canvas.jsx`，保留一份 React 导入；CodeCanvas 使用单文件源码，组件片段合并到该文件。
2. 合并生成文件中的组件与样式常量，包含所选布局需要的侧栏组件。已有导航时替换原导航实现，同名组件保留一份。
3. 按 PRD 配置菜单，经下方接口过滤后生成 `items`，接入 `activeKey` 和 `onSelect`，把原业务内容作为 children。路由选中态和内容入口与可见菜单保持一致。
4. 需要二级标签时，再复制 `canvas-nav-tabs`；需要表单抽屉时，再复制 `form-open-container`。

```jsx
// navigationItems、activeKey、openNavigationItem、content 使用当前页面已有数据和逻辑。
<CanvasNav
  title={appName}
  items={navigationItems}
  activeKey={activeKey}
  onSelect={openNavigationItem}
>
  {content}
</CanvasNav>
```

组件只提供导航与内容容器，业务内容、数据请求和表单由调用方接入。生成文件保留 CSS 变量引用，应用主题在应用级加载一次。

导航选中态承担当前页面标识，`children` 直接从表单、列表或业务区块开始。`title` 用于应用品牌名称；内容区的独立页头只承载新增信息，例如具体客户名、任务说明和操作。通过内容容器的 `aria-label` 和 iframe 的 `title` 保留可访问名称；“报名信息”等业务分区标题继续显示。移动端菜单折叠后，当前页名称可显示在导航栏内。

## 侧栏交互

侧边及顶部＋侧边模板默认支持拖动右侧边缘调宽、按钮收起与展开；展开时恢复原宽度。调宽限制在 180–400px，并随视口收窄。边缘支持方向键调宽、Home/End 切到最小/最大宽度、双击恢复默认值。移动端使用菜单展开按钮。

默认宽度消费 `--shell-dark-aside-width`，收起宽度消费 `--pod-nav-side-collapsed-width`。可传 `sidebarWidth={240}` 或 CSS 长度指定默认宽度，`defaultCollapsed` 控制初始收起。菜单图标、名称和可见性沿用原配置。

## 导航数据来源

自定义导航的数量、名称、顺序、分组和用途来自 PRD，通常工作台或首页在第一位。使用当前访问者登录态请求 `/{appType}/query/formdesign/getAccessableNavs.json`，获取可见范围；`formUuid` 和 CSRF 值来自当前页面运行态。已有此请求时复用，并调用 `filterCanvasNavigation(plannedItems, navs, hiddenNav)`；首次接入时复制数据片段，与选定布局合并：

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

`plannedItems` 使用下方菜单契约：每个任务入口有独立 key，绑定真实 `navUuid/formUuid`，保存业务 label、图标、入口用途及跳转参数。工作台的本地视图绑定承载它的自定义页面 formUuid；同一资源可以对应多个任务入口。分组可只配置 label 和 children，具有独立资源约束时同时绑定该资源。

数据片段递归过滤接口中 `hidden` 的节点，以及 `g_config.navConfig.hiddenNav` 命中 `slug` 或 `navUuid` 的节点及子树，再以可见资源 ID 筛选 PRD 菜单。返回值保持 PRD 的顺序、分组和展示配置；未规划的接口资源不会自动增加到菜单，失去所有可见子项的分组会移除。侧边、顶部和 Dock 使用规划的扁平入口；混合导航使用规划的两级结构。

页面首次加载或应用切换时清空旧菜单，取消旧请求，再加载当前应用菜单。按以下状态展示：

| 状态 | 页面处理 |
| --- | --- |
| 加载中 | 显示加载提示，菜单和对应内容等待加载完成 |
| 请求失败 | 显示重试入口 |
| 没有可见入口 | 显示“无可用导航” |
| 菜单加载完成 | 按当前地址选中可见入口；未指定入口时按 PRD 选择，通常先进入工作台 |
| 地址中的 hash 指向不可见入口 | 切至 PRD 顺序中的首个可见入口；没有可见入口时显示“无可用导航” |

页面访问和数据权限继续由平台校验。

## 入口用途与嵌入页面

按 PRD 主任务为可见节点配置 `targetType`：填写、报名、申请等入口用 `submission`；查询、审核、管理入口用 `page`；外部链接用 `url`。同一表单可对应不同任务入口，接口结果控制可见性，页面映射补充入口用途。

```jsx
// 此入口来自过滤后的 PRD 菜单，其 targetType 已规划为 submission。
const registration = items.find(item => item.key === 'registration');
<iframe title="活动报名" src={buildCanvasNavigationUrl(registration, appType, { embedded: true })} />
```

`canvas-nav-data` 同时提供 `buildCanvasNavigationUrl`：`submission` 生成原生提交页地址，`page` 生成 workbench 地址；嵌入时自动补对应导航参数，`params` 保留预填值和业务参数。入口用途明确后再生成 URL。导航任务占主内容区；页面内新增或详情按钮复用 [FormOpenContainer 抽屉](../../yida-canvas-custom-page/references/navigation-and-entry-guide.md#标准-formopencontainer)。原生表单的页面导航参数由容器生成；自定义页面的应用导航按技能中的应用设置隐藏。已有自定义页的 `/{appType}/custom/{formUuid}` 地址可继续使用。用 `URL` / `URLSearchParams` 构造地址，保留 `corpid`、`locale` 和业务参数。

## 菜单契约

| 字段 / 参数 | 用途 |
| --- | --- |
| `items[].key` | 稳定且唯一的菜单标识 |
| `items[].navUuid / formUuid` | 规划入口绑定的平台资源标识，用于可见性过滤；本地视图绑定所属页面 |
| `items[].label` | 业务名称 |
| `items[].icon` | 可选图标组件，页面已导入的 `lucide-react` 或 `@ant-design/icons` 图标 |
| `items[].href` | 可选完整跳转地址，由页面按真实资源构造，保留业务参数 |
| `items[].targetNew` | 沿用平台导航的新窗口配置，配合 href 使用 |
| `items[].disabled` | 禁用入口 |
| `items[].children` | 混合导航的二级菜单；其他形态使用扁平菜单 |
| `activeKey` | 当前入口；混合导航填写当前叶子项 key |
| `onSelect(item)` | 页面负责更新视图或执行跳转；混合导航点击分组时传入首个可用子项 |
| `title / logo / actions` | 应用标题、可选 Logo、可选用户或操作区 |
| `children` | 当前业务内容 |

提供 `href` 且未传 `onSelect` 时使用原生链接；传入 `onSelect` 时普通点击交给页面处理，修饰键点击仍保留原生链接行为。只做当前页切换时在 `onSelect` 中更新 React 状态；需要分享、刷新恢复或前进后退时，复用页面现有 URL hash / 路由同步逻辑。页面卸载时清理 `hashchange`、`matchMedia` 等监听。

混合导航从 `activeKey` 推导当前分组，分组及子项使用全局唯一 key。标签页接收 `items/activeKey/onSelect/children`，使用叶子项的 key；支持左右方向键、Home、End，自动跳过禁用项。

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
| 业务内容区 | `--pod-page-bg-color`、`--pod-nav-page-padding` |

主题由 `yida-design` 在应用级生成和配置；导航组件消费已有变量，必要的默认值放在 `var(...)` 回退中。颜色修改在主题文件完成，固定的布局结构留在组件中。导航深浅由导航主题决定，业务内容明暗由页面主题决定，分别验证。

## 验证

- 用权限不同的账号检查平台与自定义导航的可见入口，覆盖隐藏分组、空结果、请求失败及指向不可见入口的 hash。
- 菜单选中项与当前业务视图一致；点击、深链、刷新和浏览器前进后退由页面现有路由正确处理。
- 浅色及深色导航下，文字、背景、选中态、禁用态、焦点与分隔线可辨认。
- 窄屏菜单可展开或滚动，悬浮导航留有底部内容空间；需要覆盖式菜单时接入抽屉。
- 模板合并后只保留一个应用导航组件；用本地编译检查，再按发布技能更新目标页面。
