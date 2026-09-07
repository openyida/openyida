# B 端导航壳形态目录

这里提供**选型方向 + 布局骨架 + 小段代码示例**。根据已确认的 PRD 和 `design.md` 选择一种主形态，再按业务设计外观；标签页可以叠加为二级导航。用户给过参考或已有满意实现时，沿用其设计，不用示例的默认样式覆盖。

应用及页面导航配置按 [导航技能](../SKILL.md#必做配置) 执行。导航数据、权限和跳转遵守下方契约，UI 按设计手写；不以选择 CLI 组件或拼装整套模板作为实现起点。

## 选型速查

| 形态 | 何时用 | 项目数量参考 | 移动端 |
| --- | --- | --- | --- |
| 左侧边栏 | 模块多、分组多，需要常驻入口的后台或门户 | 5–12 项，可分组 | 按钮唤出抽屉菜单 |
| 顶部导航 | 模块少，表格、看板或内容需要较宽空间 | 2–6 项 | 汉堡菜单或紧凑菜单 |
| 顶部＋侧边 | 顶部切业务域，侧栏切该域内模块 | 顶部 2–5 域，侧栏按域分组 | 业务域切换＋抽屉菜单 |
| 悬浮胶囊 / Dock | 沉浸展示、轻量门户，减少常驻导航占位 | 3–6 项 | 底部胶囊或可收起菜单 |
| 标签页 | 同一模块的同级视图，不替代应用主导航 | 2–8 项 | 横向滚动 |

数量是布局参考，不是增删业务模块的依据。需求已确认导航归属和形态后直接落地；不为这些样式再发起一轮提问。

## 通用设计要点

- 导航需要表达“应用是谁、当前在哪、还能去哪”。菜单名称与层级按业务组织；图标、文字、当前项和分组要有清晰主次。
- 选中态可用胶囊底色、指示条、下划线或字重组合，按整体设计选择，不规定所有应用采用同一种外观。
- 图标只作功能用途，使用同一套 `lucide-react` 或 `@ant-design/icons`；不用 emoji、字母占位和 CSS 拼图标。
- 应用名、用户区、搜索和操作按实际需要安排；少量菜单不必填满整条屏幕，复杂菜单不宜硬塞进一条胶囊。
- 页面内容与导航共同设计。浮导要留出间距，侧栏要给内容分配宽度；当前页已由菜单标明时，内容区不重复一个同名大标题。
- 颜色与材质消费应用主题，详见 [主题 token](#主题-token)。导航外观调整不改变业务接口、筛选逻辑、权限与跳转参数。

## 形态 1：左侧边栏

```text
应用名    │ 面包屑 / 页面操作
─────────┼──────────────────
概览      │
业务分组  │     业务内容
  订单    │
  客户    │
折叠按钮  ↔ 可拖拽边缘
```

适合模块较多且经常跨模块工作的场景。分组可以用小标题、间距或分隔线区分；应用名、常用项、业务分组、底部操作按使用频率安排。可按设计采用实体侧栏或与页面背景留出间距的悬浮侧栏。必须落实下面的折叠和调宽交互。

## 形态 2：顶部导航

```text
        ╭─────────────────────────────────╮
        │ 应用名   概览  订单  客户   操作 │
        ╰─────────────────────────────────╯

                     业务内容
```

自定义顶部导航默认推荐**浮导**：与顶部和两侧留出间距，根据菜单数量和内容宽度设计成紧凑胶囊、居中悬浮栏或较宽的浮动容器。明确已选贴边通栏时沿用用户选择。仍记录 `navigation.variant=top`，浮导是呈现方式，不需要额外选择一种导航归属。

浮导顶部间距必须留在 Canvas 内：根容器用 `display: flow-root` 阻止首子元素 margin 折叠，或改由根 padding 承载，不能让整个 Canvas 产生顶部偏移。

位置、容器宽度、圆角、选中态和滚动行为写入 `design.md` 后实现；不把通栏套一个圆角就视为完成浮导设计。`sticky` 留在布局流中，`fixed` 叠在内容上，需要预留对应高度；移动端改为可展开的菜单，不能挤压文字。

## 形态 3：顶部＋侧边

```text
应用名    业务域 A    业务域 B        用户
───────────────────────────────────────
域内模块  │
域内模块  │           业务内容
折叠按钮  ↔ 可拖拽边缘
```

用于真实的两级信息架构。顶部承担业务域切换，侧栏仅显示当前域的模块；切换域时进入该域可见的默认模块或恢复上次入口。两层不要重复同一组菜单。侧栏同样必须支持折叠和拖拽调宽。

## 形态 4：悬浮胶囊 / Dock

```text
                  业务内容

          ╭──────────────────────╮
          │ 概览  活动  我的记录 │
          ╰──────────────────────╯
```

适合少量高频入口的沉浸页或轻量门户。可以根据内容构图放在顶部、底部或侧边；已选择顶部导航时优先使用上面的顶部浮导方向。菜单保持紧凑，必要时收起，避开表单提交按钮、图表图例和移动端安全区。

以下是**底部胶囊定位**的小段样式参考，尺寸和材质按设计调整，不是整页 UI 模板：

```css
.business-nav-dock {
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  max-width: calc(100vw - 32px);
  padding: 6px;
  border-radius: 999px;
  background: var(--pod-shell-theme-bg-color, #fff);
  box-shadow: var(--pod-nav-popup-shadow, 0 6px 24px rgba(0, 0, 0, 0.12));
}
```

同时为内容底部预留 Dock 实际高度与安全间距，并设置合适的层级和窄屏菜单策略；不能让导航遮住最后一行数据。

## 形态 5：标签页

在主导航下切换同模块视图，例如“待处理 / 已完成”。可用 antd `Tabs` 或按设计自绘，标签选中态与内容同步。长标签窄屏横向滚动；键盘支持方向键、Home、End 并跳过禁用项。只有页面内标签时保留平台导航，不因此关闭应用导航。

## 视图切换骨架

同页视图与跨真实页面分别处理：同页只切内容可用 React 状态；要分享、刷新恢复、前进后退则同步 URL hash；跨页面使用现有路由与数据桥。不要为了套用一个导航示例，把 PRD 的多个真实页面改造成一个静态页。

下面只演示已过滤菜单的选中态与视图绑定。`views` 是当前页面自己的业务组件映射，布局与样式按选定形态补齐；需要 URL 同步的场景复用已有路由，不直接使用这个纯本地状态版本。

```jsx
import React from 'react';

function LocalViews({ items, views }) {
  const [selectedKey, setSelectedKey] = React.useState(null);
  const activeItem = items.find(item => item.key === selectedKey && !item.disabled)
    || items.find(item => !item.disabled);
  if (!activeItem) return <p>无可用导航</p>;
  const ActiveView = views[activeItem.key];
  return (
    <div className="business-shell">
      <nav aria-label="业务导航">
        {items.map(item => (
          <button key={item.key} type="button" disabled={item.disabled}
            aria-current={item.key === activeItem.key ? 'page' : undefined}
            onClick={() => setSelectedKey(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>
      <main aria-label={activeItem.label}>
        {ActiveView ? <ActiveView /> : <p>当前入口暂不可用</p>}
      </main>
    </div>
  );
}
```

页面变化时选中项必须仍在可见范围内；请求失败、加载中与空菜单按下方状态处理。`hashchange`、`matchMedia`、拖拽等监听在 effect 清理时移除。

## 侧栏交互

自定义侧边导航及顶部＋侧边布局的 PC 端必须支持折叠/展开和拖拽调宽，手写 UI 也要实现：

- 提供明确的折叠按钮和可拖拽边缘；折叠状态与展开宽度分开保存，展开时恢复折叠前宽度。
- 折叠后图标、当前项和展开入口仍可用，菜单全名可通过 Tooltip 显示；按钮带可访问名称和展开状态。
- 侧栏宽度变化时内容区同步调整；拖拽设合理上下限并随视口收窄，例如展开宽度可在 180–400px 内调整，具体按设计确定。
- 拖拽使用指针捕获，结束或取消时释放；边缘可聚焦，支持方向键调宽、Home/End 到边界、双击恢复默认值。
- 移动端切为抽屉菜单或可展开/收起的菜单，不要求拖拽调宽。

默认宽度可消费 `--shell-dark-aside-width`，折叠宽度可消费 `--pod-nav-side-collapsed-width`，在组件内提供合理回退。交互能力必须保留，具体 UI 无须沿用示例样式。

## 导航数据来源

自定义导航的数量、名称、顺序、分组和用途来自 PRD，通常工作台或首页在第一位。使用当前访问者登录态请求 `/{appType}/query/formdesign/getAccessableNavs.json`，获取可见范围；`formUuid` 和 CSRF 值来自当前页面运行态。已有请求和正确的过滤逻辑时直接复用；首次接入可使用下面的数据片段，其中 `filterCanvasNavigation(plannedItems, navs, hiddenNav)` 负责可见性过滤，不包含导航 UI：

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
<iframe title="活动报名" src={buildCanvasNavigationUrl(registration, appType, { embedded: true })} />
```

`canvas-nav-data` 同时提供 `buildCanvasNavigationUrl`：`submission` 生成原生提交页地址，`page` 生成 workbench 地址；嵌入时自动补对应导航参数，`params` 保留预填值和业务参数。入口用途明确后再生成 URL。导航任务占主内容区；页面内新增或详情按钮复用 [FormOpenContainer 抽屉](../../yida-canvas-custom-page/references/navigation-and-entry-guide.md#标准-formopencontainer)。原生表单的页面导航参数由容器生成；自定义页面的应用导航按技能中的应用设置隐藏。已有自定义页的 `/{appType}/custom/{formUuid}` 地址可继续使用。用 `URL` / `URLSearchParams` 构造地址，保留 `corpid`、`locale` 和业务参数。

## 菜单契约

| 菜单数据 | 用途 |
| --- | --- |
| `key` | 稳定且唯一的入口标识；分组和叶子项不重名 |
| `navUuid / formUuid` | 真实平台资源标识，用于权限过滤；本地视图绑定承载页面 |
| `label / icon` | PRD 业务名称、可选功能图标 |
| `targetType` | 提交、页面或外链等入口用途，按上节确定 |
| `params` | 预填、来源和其他业务参数，构造 URL 时保留 |
| `href / targetNew` | 完整跳转地址及平台配置的新窗口行为 |
| `disabled / children` | 禁用状态和两级菜单结构 |

这是一份数据约定，手写 UI 的组件名和 props 不受限制。当前入口从可见菜单与当前 URL / 状态推导；两级导航从叶子项反推所在分组。跨页入口保留原生链接语义及修饰键点击行为。

应用内页面优先使用数据桥。已构造的完整地址调用 `router.push(href, params, false, true)`；桥不可用时当前窗口跳转，详见 [Canvas 点击骨架](../../yida-canvas-custom-page/references/navigation-and-entry-guide.md#canvas-点击骨架)。只做本地视图切换时更新 React 状态，需要 URL 同步时清理相应监听。

### 路由模式与数据桥兜底

曾出现的错误：将完整 `/APP_xxx/workbench/FORM_xxx` 地址当成页面 ID 或相对路由传入，平台再次添加当前应用前缀，产生重复的应用路径，无法正常切页。

- 生成代码通过 `window.__OPENYIDA_UTILS__.router` 数据桥跳转，完整地址明确使用 `router.push(href, params, false, true)`：第三参控制新标签，第四参控制 URL 模式。
- 数据桥已有兼容修复：仅在第四参 `isUrl` 未传或为 `undefined` 时，自动识别 `/APP_...`、HTTP(S) 和协议相对地址，并补为 `true`；路径中的 query/hash 保持原样。
- 显式传入 `isUrl=false` 时保持调用方选择，不会自动纠正。因此不要对完整地址写 `router.push(href, params, false, false)`，也不要绕过数据桥直接调用底层平台工具。
- 仅传页面 ID 时仍可用 `router.push('FORM-xxx', params, false)`；不要把页面 ID 与完整 URL 混用。
- 验收：普通点击保持当前标签，最终 URL 仅含一层应用路径，目标页面、选中态和业务参数正确。新代码显式传 URL 模式，自动识别只作兼容兜底。

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
| 自定义页整页画布 | `--oyd-page-background`（无应用导航默认透明）、`--pod-nav-page-padding` |
| 业务卡片 | `--pod-card-bg-color`、`--pod-card-border` |

主题由 `yida-design` 在应用级生成和配置；导航组件消费已有变量，必要的默认值放在 `var(...)` 回退中。颜色修改在主题文件完成，固定的布局结构留在组件中。导航深浅由导航主题决定，业务内容明暗由页面主题决定，分别验证。

## 验证

- 用权限不同的账号检查平台与自定义导航的可见入口，覆盖隐藏分组、空结果、请求失败及指向不可见入口的 hash。
- 菜单选中项与当前业务视图一致；点击、深链、刷新和浏览器前进后退由页面现有路由正确处理。
- 浅色及深色导航下，文字、背景、选中态、禁用态、焦点与分隔线可辨认。
- 窄屏菜单可展开或滚动，悬浮导航按所在位置留出内容空间；需要覆盖式菜单时接入抽屉。
- 自定义侧栏已验证折叠、展开后恢复宽度、拖拽上下限及内容区联动；这些功能不能因手写外观而省略。
- 页面只保留一个应用导航组件，按 `design.md` 或用户参考检查悬浮位置、容器比例、留白和选中态；编译通过不等于视觉验收通过。
- Canvas 宿主与自定义页根节点顶部对齐，浮导上边距留在根节点内（根节点使用 flow-root 或 flex/grid）；隐藏应用导航时透明画布透出 Shell，原生页面仍保留独立底色，不出现顶部异色条。
- 本地编译通过后按发布技能更新目标页面；缺少运行态视觉检查时明确记录未验收，不得仅凭用了示例报告视觉完成。

## 可选代码参考

需要具体交互实现时，可用 `openyida sample openyida-page-template canvas-nav-side --output .cache/samples/canvas-nav.jsx` 查看侧栏折叠、调宽逻辑；其他现有示例 `canvas-nav-top`、`canvas-nav-mixed`、`canvas-nav-dock`、`canvas-nav-tabs` 同样按需参考。它们保留供兼容和查阅，不是导航设计流程，也不是默认交付 UI。

只提取需要的逻辑；CodeCanvas 使用单文件源码，合并片段时处理 import 和同名函数。菜单数据片段可独立复用，导航外观仍按上面的选型和业务设计实现。
