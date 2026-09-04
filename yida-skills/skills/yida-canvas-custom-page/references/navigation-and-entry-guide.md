# YidaCodeCanvas 应用内导航与快捷入口

自定义页面里的快捷入口先判定目标类型，再选择跳转方式。目标是应用内页面时，用户应感觉是在宜搭应用导航内切换，而不是弹出一个脱离左侧导航的新页面，也不是在当前自定义页面中额外生成一套侧边导航或顶部应用导航。

## 运行态事实

- 宜搭应用壳根据 `navUuid/formUuid` 和 `workbench` 路径维护选中态；同应用页面应进入 `/{appType}/workbench/{formUuid}` 或对应壳层路由。
- 发布层会把根级工具注册到 `window.__OPENYIDA_UTILS__`；可用时优先通过 `window.__OPENYIDA_UTILS__.router.push` 做应用内跳转，通过 `window.__OPENYIDA_UTILS__.openPage` 打开外部链接或新窗口场景。
- `openPage` / `window.open` 更适合外部链接、新标签、钉钉链接、文件预览等场景；同应用页面默认在当前应用壳内切换。
- 页面隐藏应用导航后，页面内自绘导航壳接管跨视图切换；导航可见时使用平台导航承载同级页面切换。
- 自绘应用导航按 PRD 安排数量、顺序、分组和任务入口，通常工作台在首位；当前用户的 `getAccessableNavs.json` 结果只用于过滤不可见入口。数据片段和接入规则见 [导航数据来源](../../yida-nav-shell/references/nav-shell-patterns.md#导航数据来源)。

## 导航决策

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

PRD 确定使用自定义导航时，按 [导航模板](../../yida-nav-shell/references/nav-shell-patterns.md) 通过 `openyida sample` 复制侧边、顶部、混合或悬浮组件。CLI 只输出所选布局；将片段合并到当前 Canvas 单文件，接入现有菜单与选中状态，保留业务内容和路由。样式直接消费应用导航 token，页内标签和表单抽屉分别按需复制。

## 标准 FormOpenContainer

页面内操作按钮去新增、提交或查看表单详情时，统一封装成同一个 `FormOpenContainer`。按钮事件只调用 `openForm(request)`；新标签只用于外部 URL 或用户主动点击抽屉标题栏的新窗口操作。PC 端容器表现为右侧抽屉 + iframe，移动端直接进入原生表单页，关闭抽屉后触发当前页刷新。应用级办理导航的提交页在主内容区嵌入，导航选中态与当前任务一致。

YidaCodeCanvas 推荐使用 antd `Drawer`。`FormOpenContainer` 只负责打开原生提交页或详情页。通用 `CanvasDrawer` 提供标题栏、全屏/退出全屏、关闭、内容卡片和 `extra` 操作区，表单容器额外提供新窗口打开。

模板已内置抽屉主题样式，背景默认使用 `--pod-shell-theme-bg-color`。自定义背景时传入 `CanvasDrawer.background`；表单入口通过 `openForm({ type: 'submission', formUuid, background: 'var(--pod-card-bg-color)' })` 设置。iframe 内页面使用平台主题。

### 给已有页面添加抽屉

```bash
openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx
```

CLI 从整页脚手架提取同一份抽屉实现。将片段中的 import 合并到现有 `.canvas.jsx`，再合并组件与辅助函数；CodeCanvas 不支持相对路径模块导入。表单入口使用 `useYidaFormOpen(appType, reload)` 并渲染其 `formOpenContainer`；普通业务内容可直接放进 `CanvasDrawer` 的 children，用 `open/title/onClose` 控制。已有同名函数时更新原实现，保持一份定义。整页新建仍使用 `canvas-form-drawer` 模板。

### 接入示例

合并片段后，页面只需接入按钮和返回的容器：

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

如果项目没有使用 antd Drawer，可以用自绘 fixed 右侧面板，但组件名、状态结构和 URL 构造仍沿用 `FormOpenContainer / useYidaFormOpen / buildYidaFormUrl`。

## Canvas 点击骨架

Canvas 自绘快捷入口时，表单提交和详情入口沿用 `useYidaFormOpen` 返回的 `openForm`。应用内页面用同页跳转，外部链接才新开；提交页在 PC 端进入抽屉，移动端才整页或新页打开，提交页 URL 默认追加 `isRenderNav=false`；详情页 URL 必须包含真实 `formInstId`，并默认追加 `navConfig.layout=1180` 和 `isRenderNav=false`：

```js
function getOpenYidaUtilsBridge() {
  var candidates = [];
  try { candidates.push(window.__OPENYIDA_UTILS__); } catch (err) {}
  try { candidates.push(window.parent && window.parent.__OPENYIDA_UTILS__); } catch (err) {}
  try {
    if (typeof parentWindow !== 'undefined') {
      candidates.push(parentWindow.__OPENYIDA_UTILS__);
    }
  } catch (err) {}
  return candidates.find(function (item) { return item && item.ready; }) || null;
}

function buildYidaPath(entry, currentAppType) {
  const appType = entry.appType || currentAppType;
  if (entry.targetType === 'app') return `/${appType}/workbench`;
  if (entry.targetType === 'page') return `/${appType}/workbench/${entry.navUuid || entry.formUuid}`;
  if (entry.targetType === 'submission') {
    return `/${appType}/submission/${entry.formUuid}?isRenderNav=false`;
  }
  if (entry.targetType === 'detail') {
    if (!entry.formInstId) return '';
    return `/${appType}/formDetail/${entry.formUuid}?formInstId=${encodeURIComponent(entry.formInstId)}&navConfig.layout=1180&isRenderNav=false`;
  }
  return entry.url || '';
}

function openEntry(entry, currentAppType, runtime) {
  if (entry.targetType === 'submission' || entry.targetType === 'detail') {
    runtime.openForm({
      type: entry.targetType,
      title: entry.title || '表单',
      appType: entry.appType || currentAppType,
      formUuid: entry.formUuid,
      formInstId: getYidaFormInstId(entry.row) || entry.formInstId,
    });
    return;
  }

  const href = buildYidaPath(entry, currentAppType);
  if (!href) return;
  const utilsBridge = getOpenYidaUtilsBridge();
  if (entry.targetType === 'url' || entry.openMode === 'new-tab') {
    if (utilsBridge && typeof utilsBridge.openPage === 'function') {
      utilsBridge.openPage({ url: href });
      return;
    }
    window.open(href, '_blank');
    return;
  }
  if (utilsBridge && utilsBridge.router && typeof utilsBridge.router.push === 'function') {
    utilsBridge.router.push(href, {}, false, true);
    return;
  }
  window.location.href = href;
}
```

`getYidaFormInstId` 复用 CLI 抽屉片段中的同名 helper。复制或重命名 helper 时必须连同声明和全部调用点一起修改，不能只生成 `getInstId(...)` 等新调用名。

验收时检查抽屉 `iframeSrc` 或移动端打开地址包含 `isRenderNav=false`；详情页还必须包含真实 `formInstId`。如果目标表单已另有 query 参数，必须用统一 URL 构造函数合并为 `&isRenderNav=false`，不要丢掉 `corpid`、来源页或业务参数。

详情入口使用模板的 `getYidaFormInstId(row)` 解析 `searchFormDatas` 返回行，取值顺序为 `row.formInstId || row.formInstanceId || row.instanceId || row.id`。有实例 ID 时启用详情按钮；缺少时禁用按钮，并提示“未找到数据实例”。

路由参数使用 `push(path, params, newTab, isUrl)`：页面 ID 或应用内路由使用 `push('FORM-xxx', params)`；带应用前缀的完整地址使用 `push(href, params, false, true)`。发布层桥接会在省略 `isUrl` 时为 `/APP_...`、HTTP(S) 和协议相对地址启用 URL 模式；显式传入的模式保持原样。桥不可用时使用 `window.location.href = href` 在当前窗口打开。

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
