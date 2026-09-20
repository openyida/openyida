# YidaCodeCanvas 应用内导航与快捷入口

作用范围先按 PRD 判断：独立前台的 pageSpecHandoff.navigation 只控制当前入口，配合 standalone 页面配置；后台应用导航继续保留。下文自绘应用级导航与全局隐藏规则，仅适用于整个应用采用 custom。页面内普通表单提交和详情入口必须接入下方标准 iframe 抽屉；全码前台也遵守，不自行实现另一套填写与提交逻辑。

自定义页面里的快捷入口先判定目标类型，再选择跳转方式。目标是应用内页面时，用户应感觉是在宜搭应用导航内切换，而不是弹出一个脱离左侧导航的新页面，也不是在当前自定义页面中额外生成一套侧边导航或顶部应用导航。

## 运行态事实

- `isRenderNav=false` 表示导航展示配置，不证明当前页面位于 iframe。不要仅凭该参数修改 `window.top.location`；嵌入方式、跨域和宿主能力需分别验证。
- 宜搭应用壳根据 `navUuid/formUuid` 和 `workbench` 路径维护选中态；同应用页面应进入 `/{appType}/workbench/{formUuid}` 或对应壳层路由。
- 发布层会把根级工具注册到 `window.__OPENYIDA_UTILS__`；可用时优先通过 `window.__OPENYIDA_UTILS__.router.push` 做应用内跳转，通过 `window.__OPENYIDA_UTILS__.openPage` 打开外部链接或新窗口场景。
- `openPage` / `window.open` 更适合外部链接、新标签、钉钉链接、文件预览等场景；同应用页面默认在当前应用壳内切换。
- 页面隐藏应用导航后，页面内自绘导航壳接管跨视图切换；导航可见时使用平台导航承载同级页面切换。
- 自绘应用导航按 PRD 安排数量、顺序、分组和任务入口，通常工作台在首位；当前用户的 `getAccessableNavs.json` 结果只用于过滤不可见入口。数据片段和接入规则见 [导航数据来源](../../yida-nav-shell/references/nav-shell-patterns.md#导航数据来源)。

## 平台导航下的管理页面

业务管理端默认由平台菜单负责跨模块切换，自定义页面只实现业务内容。`entryRecommendation.entries[].menu` 是平台菜单与默认任务的规划，不是要求把整份菜单再渲染进工作台。选择自定义页面只改变内容实现方式，不改变导航归属。

- `entryMode=platform-shell`：保留平台导航，直接实现概览、提醒、列表、筛选和业务操作，不添加品牌顶栏、应用侧栏或覆盖多个管理模块的 Tabs；不要为了容纳重复菜单而改成独立页或隐藏平台导航。
- 合理的页内切换属于同一任务，例如预约页的“全部 / 待处理 / 已完成”、商品页的“在售 / 下架”。即便使用 React 状态切换，“商品管理 / 资讯管理 / 预约管理”仍是跨模块菜单，不能借页内 Tab 重复平台导航。
- 概览里的“处理这条预约”“查看低库存商品”等上下文动作可以保留，使用真实资源和应用路由；不要把平台的全部模块再复制成固定菜单或快捷入口区。
- standalone 只表示独立展示，不自动要求菜单；未规划页面菜单且应用保留平台导航时只实现业务内容，显式 none 同样不创建菜单。
- 只有确认采用应用级自绘导航或独立前台菜单时才使用导航壳。保留筛选、分页、草稿状态本身不是自绘应用导航的理由；这些状态由业务组件管理。

Plan 输出的 `pages[].navigationPolicy` 明确菜单归属、页面布局和本地切换范围，派发页面任务时与 `pageSpecHandoff` 一并传递，不将它塞进严格的 page-spec 输入。Fast 在 PRD/design.md 记录同样的边界。缺少该字段的旧计划，根据应用导航决策、当前页配置和实际管理链接判断；不能单凭 URL 或页面名称推断导航是否可见。

验收要从真实管理端链接打开：平台菜单与页面内容区合起来只出现一套跨模块导航。若两层菜单重复，修改页面源码中的重复菜单，保留平台导航、业务组件、数据与权限；编译通过不能替代这项页面验收。

## 先建立动作与目标清单

跨页按钮、导航菜单、卡片链接、返回首页共用一份目标映射。编码前为每个动作记录：业务名称、targetType、真实 appType、目标 formUuid/navUuid、必要参数、打开方式；资源来源是创建/查询结果及回读，不从页面名称猜 ID。详情按钮另外记录真实 formInstId 的行数据来源。无目标或无权限时禁用并说明原因，不用空地址或占位链接。

| 动作目标 | targetType | 接入方式 |
| --- | --- | --- |
| 本页房型 Tab、筛选、多个本地视图 | local | viewKey + selectView，更新状态或 hash |
| 独立前台首页、客房、预订自定义页 | custom | `/{appType}/custom/{formUuid}`，utils 路由 URL 模式 |
| 保留平台应用壳的管理页面 | page | `/{appType}/workbench/{navUuid或formUuid}` |
| 应用工作台 | app | `/{appType}/workbench` |
| 原生提交或详情入口 | submission / detail | 交给 useYidaFormOpen；详情必须带 formInstId |
| 外部网站 | url | 已验证的完整 HTTP(S) 地址，按外链打开 |

先提取可复用片段并整体合并到当前文件；保留现有页面业务实现：

```bash
openyida sample openyida-page-template canvas-navigation --output .cache/samples/canvas-navigation.jsx
```

`buildCanvasPageUrl(entry, context)` 生成链接，`navigateCanvasPage(entry, context)` 执行动作。context 的 appType 与必要时的 platformOrigin 来自实际资源；浏览器正常平台页面默认使用当前 origin，非平台或 opaque 嵌入时显式提供已核实的 origin，不猜域名，也不强行读取顶层窗口。表单动作接入已有 openForm；本页视图接入 selectView。跨应用目标在 entry.appType 中显式声明。

```jsx
// APP_TYPE 与 ROOM_PAGE_ID 必须来自本项目资源映射。
const roomEntry = { targetType: 'custom', formUuid: ROOM_PAGE_ID };
const navigationContext = { appType: APP_TYPE };
// 放进业务组件；href 与普通左键点击共用同一目标，保留修饰键和新标签行为。
<a href={buildCanvasPageUrl(roomEntry, navigationContext)} onClick={event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCanvasPage(roomEntry, navigationContext);
}}>查看客房</a>
```

应用内 HTTP 路径均保留 `/{appType}` 前缀。`/custom/...`、`/workbench/...`、`/submission/...`、`/formDetail/...` 是缺少应用身份的地址，换成绝对域名也不能修复缺失的 appType。纯页面 ID 的 `router.push('FORM-...', params)` 属于平台路由模式，与完整 URL 模式区分。桥不可用时片段在当前窗口打开完整地址；确需离开嵌入容器时先验证宿主约定，不将 `window.top` 作为默认 fallback。

编译/发布会在可静态确定的 href、浏览器导航与 router/openPage 目标中检查缺失前缀，报 `OPENYIDA_CANVAS_PATH_MISSING_APP_TYPE`。字符串片段、注释和动态地址不等于完整目的地，不做全局字符串拦截。该检查不能证明页面 ID 属于正确应用或用户有权限；发布验收仍需逐个点击主动作、返回链接和菜单，核对真实地址、query/hash、目标用途及浏览器返回。

## 管理员返回业务工作台

当前访问者具有应用管理权限时，可在独立前台页头操作区展示次级按钮“业务工作台”。沿用当前主题，不作为普通访客菜单，不跳应用设计器、应用设置或开发后台。先从 PRD 的管理端入口及资源回读确定真实业务管理页，不把当前前台页或任意第一个菜单当作工作台。

```bash
openyida sample openyida-page-template canvas-admin-entry --output .cache/samples/canvas-admin-entry.jsx
```

片段包含统一跳转 helper、身份判断、hook 与按钮。整体合并，已有 `canvas-navigation` 或 React/Button import 时去重；按钮放在已接入的 CanvasThemeProvider 子树内：

```jsx
<CanvasAdminWorkbenchButton
  appType={APP_TYPE}
  workbenchFormUuid={MANAGEMENT_PAGE_ID}
  params={{ corpid: CORP_ID }}
/>
```

这些常量必须来自真实应用和资源映射；没有 corpid 需求时省略 params。指定管理视图可传 viewUuid。默认使用 `/{appType}/workbench/{workbenchFormUuid}`，不继承前台的 isRenderNav/iframe/hideLeftNav/navConfig.layout 参数。只有已验证应用默认工作台落点正确时才省略页面 ID 并显式传 `useDefaultWorkbench`；默认工作台可能回到前台首页。整个应用采用自绘管理壳时，应选择实际承载该业务壳的页面，并验证其入口，不能靠按钮擅自开启或隐藏应用导航。

身份来自当前页面服务端注入的 `window.loginUser.isAppAdmin`，同时核对当前窗口的 `window.g_config.appType` / `window.pageConfig.appType` 与目标 appType 一致、userId 非空。访问态可能只提供 pageConfig；至少有一个非空应用标识，存在两个时必须全部一致，冲突仍按未知处理。只把 `"y"` 或布尔 true 视为允许；`"n"`/false 拒绝，其余未知。禁止 `Boolean(isAppAdmin)` 或 `if (isAppAdmin)`，因为 `"n"` 是真值。没有上下文、应用不匹配、匿名访问时隐藏，不读取父窗口另一应用的角色，不写死管理员名单，也不使用 CLI 操作者身份或 token 判断访问者。

这个标识采用平台的 `isSuperOrAppManager` 口径，可能覆盖超级管理员、应用主管理员、数据管理员、开发成员及平台授权角色；它不等价于仅 MAIN，也不等价于某业务角色。若需求限定“仅主管理员”或“业务运营人员”，需另接已验证的当前访问者角色/权限服务，不通过姓名、菜单可见性或复制 CLI 管理员列表代替。

按钮初始隐藏，读取上下文后显示；切换应用时旧状态不复用，回到页面时重读上下文，点击前再次读取。这里读取的是服务端页面上下文快照，刷新事件不会主动向权限服务查询最新授权；账号或权限已变化时需刷新页面，平台页面与数据接口始终承担真实授权。按钮显隐不授予任何业务权限。

双入口应用保留 `hideAppNav=n`，只让独立前台按既定页面配置隐藏导航。验证管理员能进入指定业务工作台、普通访问者及匿名访问者不显示按钮、缺少上下文不会闪现、目标保留平台导航和业务参数。公开页与嵌入页缺少登录上下文时保持隐藏；不要为显示按钮而发起管理员名单查询或修改权限。

## 导航决策

页内筛选、分页、详情往返与草稿按[状态恢复规则](view-state-recovery.md)设计。无现有路由且无未保存编辑拦截需求时可提取 `canvas-view-state`，不要在点击处理里零散保存状态。管理员入口只负责展示和跳转，业务写操作须加载 `yida-canvas-data-binding` 并核对其业务动作权限清单。

| 用户说法 | 怎么理解 | 怎么做 |
| --- | --- | --- |
| “加侧边导航 / 顶部导航 / 导航壳 / 自绘应用导航” | 自定义页要承担应用级导航 | 进入 `yida-nav-shell`，并执行 `openyida update-app <appType> --hide-app-nav` |
| “隐藏应用导航” | 应用基础设置隐藏导航 | 执行 `update-app --hide-app-nav`；需要自绘导航时再进 `yida-nav-shell` |
| “隐藏页面导航 / 全屏 / 无导航 / isRenderNav=false” | 页面级导航隐藏 | 走 `yida-page-config`，不自动隐藏应用导航 |
| “页面内 tab / 分段 / 内容区局部导航” | 当前页面内部切换 | 保留平台应用导航，不进入 `yida-nav-shell` |
| “工作台 / 门户 / 看板 / 首页” | 页面类型或入口，不是隐藏导航信号 | 默认保留平台应用导航 |

## 设计优先级

同应用内页面优先在平台应用导航内切换。用户要求“加快捷入口/常用入口”时，先把目标页面归入应用导航或导航分组；自定义页内容区聚焦当前页操作和跨资源入口。

自定义页内容区的快捷入口优先承载当前页动作、表单新建/查看、外部链接和跨应用资源。只有用户显式要求隐藏应用导航、页面内门户壳或自绘应用级导航时，同应用页面切换才进入页面内导航壳。

不要做三件事：

- 不要因为“快捷入口多”就在自定义页里做一套应用级侧边导航。
- 不要用 `isRenderNav=false` 隐藏自定义页的应用导航。
- 不要让平台应用导航和自绘应用级导航同时出现。

## 目标分类

导航选中态已标明当前页面时，内容区直接进入表单、列表或业务区块。独立页头仅用于补充对象名称、任务说明或操作；iframe 的可访问 `title` 与业务分区标题保留。移除与菜单同名的页头后，一并回收标题间距和高度预留。

同一表单的 `workbench/{formUuid}` 是包含管理视图的入口，`submission/{formUuid}` 是直接填写的提交入口。`hideLeftNav=true` 不会改变 workbench 的用途；`corpid` 等原有参数通过 URL 构造函数保留。

先依据入口的主任务选择落点：报名、申请、预约、反馈等面向填写人的入口优先显示原生提交页；查询记录、审核、维护等面向管理人的入口显示数据管理页。自定义导航中的“活动报名”直接在内容区嵌入提交页；页面内“新增/报名”按钮使用下方抽屉。两种用途可以关联同一表单，分别用业务名称表达。

| 目标 | 推荐配置 | 跳转方式 |
| --- | --- | --- |
| 当前应用内自定义页、表单列表页、工作台页 | `targetType: "page"`，保留 `appType/formUuid/navUuid` | 同页进入 `/{appType}/workbench/{formUuid}`，让应用导航更新选中态 |
| 当前应用首页 | `targetType: "app"`，保留 `appType` | 同页进入 `/{appType}/workbench` |
| 当前应用提交页 | `targetType: "submission"`，保留目标表单 | 使用 `FormOpenContainer`；PC 端右侧抽屉内嵌 `?isRenderNav=false` 的提交页 iframe；移动端整页或新页打开隐藏导航提交页 |
| 当前应用详情页 | `targetType: "detail"`，保留目标表单和实例 ID | 使用 `FormOpenContainer`；PC 端右侧抽屉内嵌详情页 iframe；移动端整页或新页打开隐藏导航详情页 |
| 跨应用页面 | `targetType: "page"`，保留目标 `appType` | 默认同页进入目标应用工作台；用户要求保留当前页时才新开 |
| 外部 URL、钉钉 OA、第三方系统 | `targetType: "url"` | 使用 `openPage` / 新窗口 / 钉钉打开能力 |

保留 `linkType: "page" | "app" | "url"` 这类语义配置；只有 `url` 类型写普通链接。

`submission` 和 `detail` 的 `isRenderNav=false` 只用于原生表单页/详情页隐藏页面导航，不表示自定义页隐藏应用导航。

## Page Spec 建议字段

工作台、门户首页和管理首页含快捷入口时，在 `page-spec.json` 中写结构化入口，方便生成器和后续 patch 保留语义：

```json
{
  "quickEntries": [
    {
      "title": "客户列表",
      "targetType": "page",
      "appType": "APP_xxx",
      "formUuid": "FORM_xxx",
      "openMode": "shell"
    },
    {
      "title": "新增客户",
      "targetType": "submission",
      "appType": "APP_xxx",
      "formUuid": "FORM_xxx",
      "openMode": "responsive-drawer",
      "hideNav": true
    },
    {
      "title": "外部帮助",
      "targetType": "url",
      "url": "https://example.com",
      "openMode": "new-tab"
    }
  ]
}
```

## 按需接入自定义导航

PRD 确定使用自定义导航时，按 `design.md` 编写导航 UI，先参考 [导航壳形态目录](../../yida-nav-shell/references/nav-shell-patterns.md) 的场景、布局骨架和小段代码，再按业务设计手写外观或迭代已有导航。顶部按连续展示页或业务工作区决定叠加/占位和背景范围，侧导必须支持折叠与拖拽调宽。菜单数据、可见性过滤、当前页和跳转按目录中的协议接入，样式消费应用导航 token；不以选择 CLI 导航模板作为起点。页内切换和跨任务往返均遵循 [页面与导航连续性](../../yida-design/references/page-continuity.md)。

## 标准 FormOpenContainer

页面内操作按钮去新增、提交或查看表单详情时，必须使用 CLI 提供的 `FormOpenContainer` 模板，不凭描述重写同名组件。按钮事件调用 `openForm(request)`，页面 JSX 渲染 hook 返回的 `formOpenContainer`；只有定义没有挂载，不算接入。新标签只用于外部 URL 或用户主动点击抽屉标题栏的新窗口操作。PC 端容器表现为右侧抽屉 + iframe，移动端由模板打开原生表单页，关闭抽屉后触发当前页刷新。已明确的应用级办理导航可在主内容区嵌入原生提交页，导航选中态与当前任务一致。

YidaCodeCanvas 推荐使用 antd `Drawer`。`FormOpenContainer` 只负责打开原生提交页或详情页。通用 `CanvasDrawer` 提供标题栏、全屏/退出全屏、关闭和 `extra` 操作区，表单容器额外提供新窗口打开。普通业务内容容器保持透明，跟随抽屉外壳背景。

抽屉 header 的工具操作统一使用图标按钮：新窗口打开用 `ExternalLink`，全屏/退出全屏用 `Maximize2` / `Minimize2`，关闭用 `X`。表单抽屉三个操作必须齐全，不得替换为“在新窗口打开”“关闭”等可见文字链接，也不得省略全屏。每个按钮提供对应的 `title`、`aria-label` 和可见键盘焦点；全屏按钮同时更新图标、提示和 `aria-pressed`。按钮默认使用中性色，hover、focus 跟随主题。发布前逐一验证三个按钮的实际行为，不以按钮已渲染代替验收。

抽屉外壳默认使用 `var(--pod-shell-theme-bg-color, var(--color-white, #fff))`，标题栏与正文容器透明承接同一底色，不使用 `--pod-card-bg-color` 铺满抽屉。CanvasThemeProvider 同步设置 antd Drawer 的组件级背景；其他卡片、弹窗保留各自表面。只有明确的设计覆盖才传 CanvasDrawer.background 或 openForm 的 background，不主动生成卡片色覆盖。iframe 内页面继续使用平台主题。

提交页和详情页统一由 `FormOpenContainer` 使用 `contentMode="iframe"`：iframe 直接填满标题栏下方的剩余空间，外层不加 `oy-drawer-card`、卡片底色、圆角或 padding，也不设置外层滚动。`oy-drawer-frame` 仅负责尺寸定位和裁切；滚动由 iframe 内页面负责。不要恢复 `calc(100vh - 56px)` 等猜测高度的兜底。

标题栏高度使用 `--pod-nav-platform-header-height`，默认 48px。标题字号、字重对齐页面标题，分别使用 `--pod-page-title-font-size`（默认 16px）和 `--pod-page-title-font-weight`（默认 500）；antd 标题元素继承这两个值。这里不使用通用 `--drawer-title-font-size`，避免主题中的大号抽屉标题使表单容器过于突出。

旧页面复制过的抽屉实现不会随 CLI 升级自动改变；需重新提取片段并替换旧实现，编译、发布后才生效。

### MUST：接入标准抽屉

```bash
openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx
```

含页面内表单新建、提交或详情入口的 Canvas 页面，**MUST** 先执行上面的命令拉取当前模板，不得跳过后凭记忆手写。CLI 从整页脚手架提取同一份抽屉实现。整体合并 `CanvasDrawer`、`FormOpenContainer`、`useYidaFormOpen` 及其 import、辅助函数；CodeCanvas 不支持相对路径模块导入。表单入口使用 `useYidaFormOpen(appType, reload)` 并渲染其 `formOpenContainer`；普通业务内容可直接放进 `CanvasDrawer` 的 children，用 `open/title/onClose` 控制。已有同名函数时更新原实现，保持一份定义。禁止自绘 fixed 遮罩 + iframe 抽屉壳，也禁止仅补 `.openyida-form-drawer` 类名冒充模板接入。页面其余内容按设计编写；保留 flex 剩余空间布局和 `minHeight: 0`，不要添加视口高度兜底。

### 接入示例

合并片段后，页面只需接入按钮和返回的容器。`openForm` 可传 `params` 保留 `corpid`、来源和预填参数；容器固定的导航参数和真实详情实例 ID 优先，避免被业务参数覆盖：

```jsx
import { Button } from 'antd';

function ExampleToolbar({ appType, customerFormUuid, selectedCustomer, reload }) {
  const { openForm, formOpenContainer } = useYidaFormOpen(appType, reload);
  const selectedFormInstId = getYidaFormInstId(selectedCustomer);
  return (
    <>
      <Button type="primary" onClick={() => openForm({ type: 'submission', title: '新增客户', formUuid: customerFormUuid })}>
        新增客户
      </Button>
      <Button
        onClick={() => openForm({ type: 'detail', title: '客户详情', formUuid: customerFormUuid, formInstId: selectedFormInstId })}
        disabled={!selectedFormInstId}
      >
        查看详情
      </Button>
      {formOpenContainer}
    </>
  );
}
```

已有页面的表单入口也按标准片段接入，保留业务数据、刷新回调和权限校验；不另写缺少交互能力的抽屉外壳。

## Canvas 点击骨架

Canvas 自绘快捷入口时，表单提交和详情入口沿用 `useYidaFormOpen` 返回的 `openForm`。应用内页面用同页跳转，外部链接才新开；提交页在 PC 端进入抽屉，移动端才整页或新页打开，提交页 URL 默认追加 `isRenderNav=false`；详情页 URL 必须包含真实 `formInstId`，并默认追加 `navConfig.layout=1180` 和 `isRenderNav=false`：

合并 `canvas-navigation` 片段后，只适配业务数据，不另写一套路径拼接：

```js
function openEntry(entry, currentAppType, runtime) {
  const target = entry.targetType === 'detail'
    ? { ...entry, formInstId: getYidaFormInstId(entry.row) || entry.formInstId }
    : entry;
  return navigateCanvasPage(target, {
    appType: currentAppType,
    openForm: runtime.openForm,
    selectView: runtime.selectView,
    utils: window.__OPENYIDA_UTILS__,
  });
}
```


`getYidaFormInstId` 复用 CLI 抽屉片段中的同名 helper。复制或重命名 helper 时必须连同声明和全部调用点一起修改，不能只生成 `getInstId(...)` 等新调用名。

验收时检查抽屉 `iframeSrc` 或移动端打开地址包含 `isRenderNav=false`；详情页还必须包含真实 `formInstId`。如果目标表单已另有 query 参数，必须用统一 URL 构造函数合并为 `&isRenderNav=false`，不要丢掉 `corpid`、来源页或业务参数。

详情入口使用模板的 `getYidaFormInstId(row)` 解析 `searchFormDatas` 返回行，取值顺序为 `row.formInstId || row.formInstanceId || row.instanceId || row.id`。有实例 ID 时启用详情按钮；缺少时禁用按钮，并提示“未找到数据实例”。

路由参数使用 `push(path, params, newTab, isUrl)`：页面 ID 或应用内路由使用 `push('FORM-xxx', params)`；带应用前缀的完整地址使用 `push(href, params, false, true)`。发布层桥接会在省略 `isUrl` 时为 `/APP_...`、HTTP(S) 和协议相对地址启用 URL 模式；显式传入的模式保持原样，尤其不会纠正显式 `isUrl=false`；新代码仍明确传 `true`，详见 [路由模式与数据桥兜底](../../yida-nav-shell/references/nav-shell-patterns.md#路由模式与数据桥兜底)。桥不可用时使用 `window.location.href = href` 在当前窗口打开。

PC 抽屉内的 iframe 高度随内容区拉满，提交页和详情页默认使用半屏宽度 `50vw`。左边缘支持拖拽调宽，最小 480px（窄视口放宽到半屏），最大为视口的 90%；拖动时捕获指针并暂停 iframe 的鼠标响应，结束后恢复。双击边缘恢复半屏，聚焦边缘后可用左右方向键调宽。点击全屏展开到 `100vw`，退出全屏或关闭后重新打开保留已调整的宽度；窗口缩小时重新限制宽度。

提交成功或查看结束后的刷新可以先用抽屉关闭事件触发列表 reload，若平台 postMessage 事件已验证，再接入精确的提交完成回调。移动端直接进入原生表单页。

## PortalQuickEntry / QuickAccessCard 边界

- 使用可配置的门户组件时，优先保留 `linkType/page/app/url` 语义和 router 参数，应用内页面保留页面类型与路由参数。
- 如果当前运行态的 `PortalQuickEntry` 只能消费静态 `url` 且点击固定 `window.open`，应用内页面入口改用 Canvas 自绘入口卡片，原生组件只作为展示增强或外链入口。
- `QuickAccessCard` / `RecentlyUsedCard` 是应用列表容器，适合“最近/常用应用”；业务页内的“新增客户、客户列表、跟进记录”这类入口用自绘卡片更可控。

## 验收

- 从实际工作台点击每类页面入口，核对最终地址仅包含一层应用路径、目标页面正常显示、平台导航选中态同步；包含 query 或 hash 时确认业务参数保留。
- 点击同应用页面入口后，没有新浏览器标签或新钉钉窗口。
- 点击 PC 端「新建 / 提交表单 / 查看详情」后，在当前自定义页侧边抽屉打开原生表单页，不直接弹新标签。
- 点击移动端「新建 / 提交表单」后，可以整页或新页进入原生提交页。
- 点击移动端「查看详情」后，可以整页或新页进入原生详情页。
- URL 进入 `/{appType}/workbench/{formUuid}` 或对应平台同页路径。
- 应用左侧/顶部导航能跟随目标页面选中；若导航隐藏，则页面内导航壳有明确选中态。
- 外部 URL、钉钉 OA、文件预览等仍按新窗口或端内打开能力处理。
