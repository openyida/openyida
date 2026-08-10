# Code Canvas 应用内导航与快捷入口

自定义页面里的快捷入口先判定目标类型，再选择跳转方式。目标是应用内页面时，用户应感觉是在宜搭应用导航内切换，而不是弹出一个脱离左侧导航的新页面。

## 运行态事实

- 宜搭应用壳根据 `navUuid/formUuid` 和 `workbench` 路径维护选中态；同应用页面应进入 `/{appType}/workbench/{formUuid}` 或对应壳层路由。
- `openPage` / `window.open` 更适合外部链接、新标签、钉钉链接、文件预览等场景；同应用页面默认在当前应用壳内切换。
- 页面隐藏应用导航后，页面内自绘导航壳接管跨视图切换；导航可见时使用平台导航承载同级页面切换。

## 设计优先级

同应用内页面优先在平台应用导航内切换。用户要求“加快捷入口/常用入口”时，先把目标页面归入应用导航或导航分组；自定义页内容区聚焦当前页操作和跨资源入口。

自定义页内容区的快捷入口优先承载当前页动作、表单新建/查看、外部链接和跨应用资源。只有用户显式要求隐藏平台导航、页面内门户壳或自绘导航时，同应用页面切换才进入页面内导航壳。

## 目标分类

| 目标 | 推荐配置 | 跳转方式 |
| --- | --- | --- |
| 当前应用内自定义页、表单列表页、工作台页 | `targetType: "page"`，保留 `appType/formUuid/navUuid` | 同页进入 `/{appType}/workbench/{formUuid}`，让应用导航更新选中态 |
| 当前应用首页 | `targetType: "app"`，保留 `appType` | 同页进入 `/{appType}/workbench` |
| 当前应用提交页 | `targetType: "submission"`，保留目标表单 | 使用 `FormOpenContainer`；桌面端右侧抽屉，移动端全屏抽屉 |
| 当前应用详情页 | `targetType: "detail"`，保留目标表单和实例 ID | 使用 `FormOpenContainer`；桌面端右侧抽屉，移动端全屏抽屉 |
| 当前应用数据管理页 | `targetType: "management"`，保留目标表单和 `corpId` | 使用 `FormOpenContainer`；URL 为 `/{appType}/workbench/{formUuid}?hideLeftNav=true&corpid={corpId}`，隐藏平台左侧导航 |
| 跨应用页面 | `targetType: "page"`，保留目标 `appType` | 默认同页进入目标应用工作台；用户要求保留当前页时才新开 |
| 外部 URL、钉钉 OA、第三方系统 | `targetType: "url"` | 使用 `openPage` / 新窗口 / 钉钉打开能力 |

保留 `linkType: "page" | "app" | "url"` 这类语义配置；只有 `url` 类型写普通链接。

## PRD 入口字段

工作台、门户首页和管理首页含快捷入口时，在 PRD 当前页面章节中写结构化入口。page-spec 只引用该章节，不复制入口内容：

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
      "title": "客户数据管理",
      "targetType": "management",
      "appType": "APP_xxx",
      "formUuid": "FORM_xxx",
      "corpId": "ding_xxx",
      "openMode": "responsive-drawer"
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

## 标准 FormOpenContainer

自定义页面内凡是点击按钮去新增、提交、查看表单详情或打开数据管理页，统一使用同一个 `FormOpenContainer`。按钮事件只调用 `openForm(request)`；外部 URL 才使用新标签。桌面端使用右侧抽屉，移动端使用全屏抽屉，关闭抽屉后刷新当前页。

只有用户明确要求整页或新标签打开表单时，才允许改用页面跳转，并在源码中声明 `@openyida-form-open-mode page` 或 `@openyida-form-open-mode new-tab`。

新建 Canvas 页面使用 `canvas.canvas.jsx` 内置的 antd `Drawer`、URL 构造、实例 ID 校验和主题同步。下面示例只用于维护旧源码、普通 JSX 页面或排查历史页面；父页面 CSS 变量不会自动继承到提交页/详情页 iframe。

```jsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Drawer } from 'antd';

function appendQuery(url, params) {
  const joiner = url.indexOf('?') === -1 ? '?' : '&';
  const query = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '').map((key) => (
    encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
  )).join('&');
  return query ? url + joiner + query : url;
}

function buildYidaFormUrl(request, currentAppType) {
  const appType = request.appType || currentAppType;
  if (request.type === 'submission') {
    return appendQuery(`/${appType}/submission/${request.formUuid}`, { iframe: true, isRenderNav: false });
  }
  if (request.type === 'detail') {
    if (!request.formInstId) {
      return '';
    }
    return appendQuery(`/${appType}/formDetail/${request.formUuid}`, {
      formInstId: request.formInstId,
      iframe: true,
      'navConfig.layout': 1180,
      isRenderNav: false,
    });
  }
  if (request.type === 'management') {
    if (!request.corpId) {
      return '';
    }
    return appendQuery(`/${appType}/workbench/${request.formUuid}`, {
      hideLeftNav: true,
      corpid: request.corpId,
    });
  }
  return request.url || '';
}

const FORM_OPEN_DRAWER_WIDTH = 'min(720px, 100vw)';

function FormOpenContainer({ request, currentAppType, themeTokens, onClose, onAfterClose }) {
  const iframeRef = useRef(null);
  const iframeSrc = useMemo(() => request ? buildYidaFormUrl(request, currentAppType) : '', [request, currentAppType]);
  const syncThemeToIframe = useCallback(() => {
    installYidaGlobalThemeIntoFrame(themeTokens, iframeRef.current);
  }, [themeTokens]);

  return (
    <Drawer
      title={request && request.title ? request.title : '表单'}
      open={!!request}
      width={FORM_OPEN_DRAWER_WIDTH}
      destroyOnClose
      onClose={() => {
        onClose();
        if (typeof onAfterClose === 'function') onAfterClose();
      }}
      bodyStyle={{ padding: 0, overflow: 'hidden' }}
    >
      {iframeSrc ? (
        <iframe
          ref={iframeRef}
          title={request && request.title ? request.title : '表单'}
          src={iframeSrc}
          onLoad={syncThemeToIframe}
          style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 56px)', border: 0, display: 'block' }}
        />
      ) : null}
    </Drawer>
  );
}

function useYidaFormOpen(currentAppType, refreshData, themeTokens) {
  const [formRequest, setFormRequest] = useState(null);
  function openForm(request) {
    if (request && request.type === 'detail' && !request.formInstId) {
      return;
    }
    const href = buildYidaFormUrl(request, currentAppType);
    if (!href) {
      return;
    }
    setFormRequest(request);
  }
  const container = (
    <FormOpenContainer
      request={formRequest}
      currentAppType={currentAppType}
      themeTokens={themeTokens}
      onClose={() => setFormRequest(null)}
      onAfterClose={refreshData}
    />
  );
  return { openForm, formOpenContainer: container };
}

function ExampleToolbar({ appType, customerFormUuid, selectedCustomer, reload }) {
  const { openForm, formOpenContainer } = useYidaFormOpen(appType, reload, CUSTOM_THEME_TOKENS);
  const selectedFormInstId = selectedCustomer && selectedCustomer.formInstId;
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
      <Button onClick={() => openForm({ type: 'management', title: '客户数据管理', formUuid: customerFormUuid, corpId: CURRENT_CORP_ID })}>
        数据管理
      </Button>
      {formOpenContainer}
    </>
  );
}
```

如果项目没有使用 antd Drawer，可以用自绘 fixed 右侧面板，但组件名、状态结构和 URL 构造仍沿用 `FormOpenContainer / useYidaFormOpen / buildYidaFormUrl`。

## Canvas 点击骨架

Canvas 自绘快捷入口时，表单提交、详情和数据管理入口沿用 `useYidaFormOpen` 返回的 `openForm`。应用内页面用同页跳转，外部链接才新开；这三类表单入口在所有设备都进入抽屉。提交和详情 URL 默认追加 `iframe=true` 和 `isRenderNav=false`，详情页还必须包含真实 `formInstId` 和 `navConfig.layout=1180`；数据管理 URL 必须追加 `hideLeftNav=true` 和真实 `corpid`：

```js
function getYidaFormInstId(row) {
  return row && row.formInstId;
}

function buildYidaPath(entry, currentAppType) {
  const appType = entry.appType || currentAppType;
  if (entry.targetType === 'app') return `/${appType}/workbench`;
  if (entry.targetType === 'page') return `/${appType}/workbench/${entry.navUuid || entry.formUuid}`;
  if (entry.targetType === 'submission') {
    return `/${appType}/submission/${entry.formUuid}?iframe=true&isRenderNav=false`;
  }
  if (entry.targetType === 'detail') {
    if (!entry.formInstId) return '';
    return `/${appType}/formDetail/${entry.formUuid}?formInstId=${encodeURIComponent(entry.formInstId)}&iframe=true&navConfig.layout=1180&isRenderNav=false`;
  }
  if (entry.targetType === 'management') {
    if (!entry.corpId) return '';
    return `/${appType}/workbench/${entry.formUuid}?hideLeftNav=true&corpid=${encodeURIComponent(entry.corpId)}`;
  }
  return entry.url || '';
}

function openEntry(entry, currentAppType, runtime) {
  if (entry.targetType === 'submission' || entry.targetType === 'detail' || entry.targetType === 'management') {
    runtime.openForm({
      type: entry.targetType,
      title: entry.title || '表单',
      appType: entry.appType || currentAppType,
      formUuid: entry.formUuid,
      formInstId: getYidaFormInstId(entry.row) || entry.formInstId,
      corpId: entry.corpId,
    });
    return;
  }

  const href = buildYidaPath(entry, currentAppType);
  if (!href) return;
  if (entry.targetType === 'url' || entry.openMode === 'new-tab') {
    window.open(href, '_blank');
    return;
  }
  window.location.href = href;
}
```

验收提交和详情抽屉时，检查 `iframeSrc` 包含 `iframe=true` 和 `isRenderNav=false`；详情页还必须包含真实 `formInstId`。验收数据管理抽屉时，检查路径为 `/{appType}/workbench/{formUuid}`，并包含 `hideLeftNav=true` 和真实 `corpid`。如果目标表单已有 query 参数，必须用统一 URL 构造函数合并参数，不要丢掉 `corpid`、来源页或业务参数。

详情页实例 ID 只使用 `searchFormDatas` 返回行的 `row.formInstId`。缺少时禁用详情按钮或提示“未找到数据实例”；不要改用 `formInstanceId`、`instanceId` 或 `id`，也不要打开空 `formInstId` 的详情页。

如果运行态明确向 Canvas 暴露了壳层 router / history API，可把同应用 `page/app` 的同页跳转替换成壳层 `push/replace`；没有明确 API 时，不猜内部对象，使用上面的工作台 URL。

抽屉内的 iframe 高度随内容区拉满。默认宽度为 `min(720px, 100vw)`：桌面端显示侧边抽屉，移动端占满视口。提交成功或查看结束后，先在抽屉关闭事件中刷新列表；平台 postMessage 事件经过验证后，再接入精确的提交完成回调。

## PortalQuickEntry / QuickAccessCard 边界

- 使用可配置的门户组件时，优先保留 `linkType/page/app/url` 语义和 router 参数，应用内页面保留页面类型与路由参数。
- 如果当前运行态的 `PortalQuickEntry` 只能消费静态 `url` 且点击固定 `window.open`，应用内页面入口改用 Canvas 自绘入口卡片，原生组件只作为展示增强或外链入口。
- `QuickAccessCard` / `RecentlyUsedCard` 是应用列表容器，适合“最近/常用应用”；业务页内的“新增客户、客户列表、跟进记录”这类入口用自绘卡片更可控。

## 验收

- 点击同应用页面入口后，没有新浏览器标签或新钉钉窗口。
- 点击桌面端「新建 / 提交表单 / 查看详情」后，在当前自定义页侧边抽屉打开原生表单页。
- 点击移动端「新建 / 提交表单 / 查看详情」后，在当前自定义页全屏抽屉打开原生表单页。
- 点击「数据管理」后，在当前自定义页抽屉打开 `workbench/{formUuid}?hideLeftNav=true&corpid={corpId}`，抽屉内不显示平台左侧导航。
- 用户未明确要求时，不直接跳转、不打开新标签。
- URL 进入 `/{appType}/workbench/{formUuid}` 或对应平台同页路径。
- 应用左侧/顶部导航能跟随目标页面选中；若导航隐藏，则页面内导航壳有明确选中态。
- 外部 URL、钉钉 OA、文件预览等仍按新窗口或端内打开能力处理。
