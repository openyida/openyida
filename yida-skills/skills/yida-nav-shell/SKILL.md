---
name: yida-nav-shell
description: 为应用或独立前台页面制作自己的导航菜单时使用。只做前台菜单时，保留管理端的宜搭导航；整个应用都使用自定义菜单时，再隐藏应用导航。
---

# yida-nav-shell

## 先判断

先看需求和方案：是要制作自己的菜单，还是只整理宜搭已有的菜单？前者使用本技能，后者使用 `yida-nav-group`。同一个应用可以让前台使用自己的菜单、管理端继续使用宜搭菜单。用户已有明确要求时直接沿用；尚未确定时按 [导航决策](../yida-design/references/navigation-decision.md) 选择。

| 用户需求 | 怎么处理 |
| --- | --- |
| 导航分组、页面排序、隐藏/显示导航项 | 用 `yida-nav-group` |
| 页面内 tab、分段、筛选、卡片切换 | 当前页内容结构，不用本技能 |
| 独立前台要自己的顶部/侧边菜单 | 用本技能，只配置该页面独立展示，后台保留平台导航 |
| 整个应用采用自绘应用级导航 | 用本技能，按应用级范围隐藏应用导航 |
| 用户只说隐藏应用导航 | 执行 `update-app --hide-app-nav`；需要自绘导航时再用本技能 |
| 用户只说全屏、无导航、`isRenderNav=false` | 这是页面级隐藏，优先用 `yida-page-config` |

关键区别：

- 应用导航隐藏：`hideAppNav='y'`，通过应用基础设置控制。
- 页面导航隐藏：`isRenderNav=false`，只控制某个页面/表单页的导航显示。
- 不要用 `isRenderNav=false` 代替 `hideAppNav`。
- 不要让平台应用导航和自绘应用级导航同时出现。

## 必做配置

先读 PRD 的应用 `navigationType` 与当前页 `pageSpecHandoff.entryMode/navigation`，分别处理：

### 仅独立前台菜单

应用为 platform-top/platform-side/platform-l-shape、当前页为 standalone 时，只对该页面执行下面的 `update-form-config` 和回读；不调用 `update-app --hide-app-nav`，不批量隐藏后台表单或其他页面。需要应用级主题更新时继续保留平台导航。发布后分别验证前台页面链接与后台 workbench 链接；前台仍出现平台菜单时，先排查实际访问路径与页面配置，不能通过全局隐藏“修复”。

### 整个应用自定义导航

需求规划采用自定义导航后，就将应用导航隐藏纳入应用基础设置更新：新建应用时，等 `app-theme.css` 生成后，将 `--hide-app-nav` 与主题、Logo、布局等设置合并到同一次 `update-app`，按 [应用设置同步](../yida-app/workflow/step-3-create-or-reuse-app.md) 执行并回读。已有应用只需切换导航时执行：

```bash
openyida update-app <appType> --hide-app-nav
```

只有整个应用采用自定义导航时，才对 PRD 本轮范围内全部普通表单、流程表单、自定义页面及其他支持页面配置的资源逐页执行；使用已解析的真实 `formUuid` 和原页面标题：

```bash
openyida update-form-config <appType> <formUuid> false "<页面标题>"
openyida get-form-config <appType> <formUuid> --json
```

每页回读 `isRenderNav=false` 才完成；失败时修复该页配置并重读。表单及自定义页面在创建或复用并取得真实 `formUuid` 后立即配置，可与页面代码开发并行，不等待页面发布。发布后只回读核对；若发布改变了配置才补写修复，最终按 PRD 清单逐项核对。`create-page --hide-nav` 可用于新建页初始配置，仍需回读；URL 参数不能代替持久化设置。

## 访问态入口与权限

前台和管理端可以使用不同的菜单，管理端也可以直接打开业务列表，无需首页。菜单显示什么与用户能操作什么要分别处理：平台隐藏的菜单项，仍可能是前台需要的任务；能看到一个页面，也不代表能提交或修改数据。

沿用平台菜单范围时使用 `platform` 模式；前台独立组织菜单时使用 `independent` 模式，并查询当前用户的真实权限。权限查询尚未接通时，不放行相关菜单，明确记录未完成项。字段和步骤见 [前台与管理端的菜单规则](../yida-app/references/entry-navigation.md)。

## 实现要点

本节的 iframe 与原生表单打开规则用于计划选择复用原生页面的工作区。全码前台默认在同一页面切换业务视图、完成填写与结果展示，连接真实数据；不把默认 iframe 当作全码前台。菜单只包含该入口的有效任务，不能把后台菜单自动带入前台。

- **MUST：应用内切换保留导航壳**：点击自定义导航后，导航必须仍然可见且可继续操作；默认只切换主内容区。原生提交页、数据管理页嵌入主内容 iframe，本地工作台切换 React 内容。只有确认目标页面也承载同一套导航壳时才允许整页跳转；不能直接跳到隐藏导航的原生页面。外链和用户主动新窗口打开单独处理。见 [保留导航壳的最小示例](references/nav-shell-patterns.md#保留导航壳的最小示例)。

- **MUST：内容区撑满剩余空间**：先执行 `openyida sample openyida-page-template canvas-nav-content` 并整体合并 `CanvasNavigationContent`，保持 `.openyida-nav-layout` / `.openyida-nav-content` 布局结构；顶部导航通过 `navigation` 接入，侧栏布局在右侧确定高度的内容区域使用。从确定高度的导航壳到 main、iframe 视口建立完整 flex 高度链，每个可收缩内容层设置 `min-height:0`；工作台自身滚动，原生页仅 iframe 内滚动。切换视图保持内容宽度和外侧留白连续，禁止父级 block、子级只写 `flex:1` 的无效布局。实现与验收见 [主内容撑满剩余空间](references/nav-shell-patterns.md#must主内容撑满剩余空间)。

- **画布与浮导间距**：平台宿主继续消费 `--pod-page-bg-color`；自绘导航页的内部画布由 `design.md` 定义，可采用浅灰、浅彩、渐变或局部纹理，不强制跟随白色平台底色。浅色非白画布上，顶部浮导默认白色或近白半透明，卡片默认白色无框；品牌色集中于选中态和主操作，深色方案单独设计。只作用于当前页面选择器，不修改应用全局变量。根节点使用 `display:flow-root` 或 flex/grid，让浮导上边距留在根节点内。

- **先选形态，再写 UI**：根据已确认的 PRD、`design.md` 和用户参考确定布局。模块多用侧栏，模块少且内容需要宽度用顶部，两级业务用顶部＋侧边，沉浸展示可用悬浮 Dock，同模块视图用标签。已确认的选择直接沿用，不重新提问。
- 自定义顶部导航默认推荐浮导，可按内容宽度设计为紧凑胶囊或悬浮栏；“顶部导航”不等于贴边通栏。位置、比例、留白、材质和选中态根据业务与设计实现，不由现成组件决定。此推荐只针对顶部样式，不改变已确定的导航方式。
- 需要布局方向和小段代码时读 [导航壳形态目录](references/nav-shell-patterns.md)。按场景设计和手写实现，不强制复制任何导航组件。已有导航符合设计时直接复用，只补缺失功能；不能仅因存在新示例而替换现有外观。
- 自定义侧边导航（含顶部＋侧边）的 PC 端必须支持折叠/展开和拖拽调宽；展开恢复折叠前宽度，宽度变化时内容区同步调整。移动端改为可展开/收起的菜单，详见 [侧栏交互](references/nav-shell-patterns.md#侧栏交互)。
- 菜单数量、名称、顺序、分组和入口用途来自 PRD，默认落点按当前入口任务确定；平台模式用当前访问者的 `getAccessableNavs.json` 过滤展示，独立前台必须接入真实权限适配，详见 [导航数据来源](references/nav-shell-patterns.md#导航数据来源)。数据逻辑可直接复用，不要求采用同一套 UI。
- 只在当前页切视图时用 React 状态；需要分享、刷新恢复、前进后退时同步 URL hash。跨真实页面时沿用应用路由与数据桥，详见 [菜单契约](references/nav-shell-patterns.md#菜单契约)。`hashchange`、`matchMedia` 等监听必须 cleanup。
- **满足导航壳保留条件后的跨页跳转，避免重复应用前缀**：完整的 `/APP_xxx/workbench/FORM_xxx` 地址通过数据桥调用 `router.push(href, params, false, true)`，第三参 `false` 表示不新开标签，第四参 `true` 表示 URL 模式。数据桥已修复省略第四参时的自动识别，但不会覆盖显式传入的 `false`；生成代码仍须明确传 `true`，详见 [路由模式与数据桥兜底](references/nav-shell-patterns.md#路由模式与数据桥兜底)。
- 导航项保存真实资源 ID、入口用途和 `params`；办理任务、数据管理与页面内新增/详情按钮按 [入口用途与嵌入页面](references/nav-shell-patterns.md#入口用途与嵌入页面) 分别处理。用 `URL` / `URLSearchParams` 保留 `corpid`、`locale` 和业务参数。

## UI 和验收

- 导航表达应用身份、业务层级和当前位置；选中态清晰，图标使用 `lucide-react` 或 `@ant-design/icons`，不用 emoji、字母占位或 CSS 拼图标。
- 视觉对照 `design.md` 和用户参考检查，尤其是浮导的容器比例、留白、位置与内容关系。导航消费应用主题 token，不另注一套全局主题。
- 导航选中态已标明当前页时，内容区从业务开始；独立页头只补充对象、任务说明或操作，避免重复菜单标题。
- 侧栏已验证折叠、恢复宽度、拖拽上下限和内容联动；顶部窄屏可展开菜单，Dock 不遮内容和主要操作。
- 按范围验收：应用级自定义导航核验应用 `hideAppNav` 与各页 `isRenderNav=false`；仅前台菜单核验该页独立展示，并确认后台应用导航仍可用。配置均需持久化并回读；菜单可见性、选中态、内容与路由一致，深链、刷新及前进后退正常。
- 逐项点击应用内导航，确认导航壳、当前选中项和主内容同时正确；切换后还能返回工作台。不能只验证目标页面打开成功。
- 完整检查见 [验证清单](references/nav-shell-patterns.md#验证)。本地编译后按 `yida-publish-page` 发布并检查实际页面，编译通过不等于视觉验收通过。
