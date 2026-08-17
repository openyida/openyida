# YidaCodeCanvas 应用内导航与快捷入口

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
| 当前应用提交页 | `targetType: "submission"`，保留目标表单 | 使用 `FormOpenContainer`；PC 端右侧抽屉内嵌 `?isRenderNav=false` 的提交页 iframe；移动端整页或新页打开隐藏导航提交页 |
| 当前应用详情页 | `targetType: "detail"`，保留目标表单和实例 ID | 使用 `FormOpenContainer`；PC 端右侧抽屉内嵌详情页 iframe；移动端整页或新页打开隐藏导航详情页 |
| 跨应用页面 | `targetType: "page"`，保留目标 `appType` | 默认同页进入目标应用工作台；用户要求保留当前页时才新开 |
| 外部 URL、钉钉 OA、第三方系统 | `targetType: "url"` | 使用 `openPage` / 新窗口 / 钉钉打开能力 |

保留 `linkType: "page" | "app" | "url"` 这类语义配置；只有 `url` 类型写普通链接。

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

## 标准 FormOpenContainer

自定义页面内凡是点击按钮去新增、提交或查看表单详情，统一封装成同一个 `FormOpenContainer`。按钮事件只调用 `openForm(request)`；外部 URL 才使用新标签。PC 端容器表现为右侧抽屉 + iframe，移动端直接进入原生表单页，关闭抽屉后触发当前页刷新。

YidaCodeCanvas 推荐使用 antd `Drawer`。复制本示例前，先把 [theme-runtime-helpers.md](theme-runtime-helpers.md) 中的 `installYidaGlobalThemeIntoFrame` 一并放到页面源码；父页面 CSS 变量不会自动继承到提交页/详情页 iframe。

```jsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Drawer } from 'antd';

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
}

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
    return appendQuery(`/${appType}/submission/${request.formUuid}`, { isRenderNav: false });
  }
  if (request.type === 'detail') {
    if (!request.formInstId) {
      return '';
    }
    return appendQuery(`/${appType}/formDetail/${request.formUuid}`, {
      formInstId: request.formInstId,
      'navConfig.layout': 1180,
      isRenderNav: false,
    });
  }
  return request.url || '';
}

const FORM_OPEN_DRAWER_WIDTH = '50vw';

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
    if (isMobileViewport()) {
      window.location.href = href;
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
  const selectedFormInstId = selectedCustomer && (selectedCustomer.formInstId || selectedCustomer.formInstanceId || selectedCustomer.instanceId || selectedCustomer.id);
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
function getYidaFormInstId(row) {
  return row && (row.formInstId || row.formInstanceId || row.instanceId || row.id);
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
  if (entry.targetType === 'url' || entry.openMode === 'new-tab') {
    window.open(href, '_blank');
    return;
  }
  window.location.href = href;
}
```

验收时检查抽屉 `iframeSrc` 或移动端打开地址包含 `isRenderNav=false`；详情页还必须包含真实 `formInstId`。如果目标表单已另有 query 参数，必须用统一 URL 构造函数合并为 `&isRenderNav=false`，不要丢掉 `corpid`、来源页或业务参数。

详情页实例 ID 以 `searchFormDatas` 返回行的 `row.formInstId` 为准，兼容兜底顺序只能写成 `row.formInstId || row.formInstanceId || row.instanceId || row.id`。缺少实例 ID 时禁用详情按钮或提示“未找到数据实例”，禁止打开 `formInstId=` 为空的详情页。

如果运行态明确向 Canvas 暴露了壳层 router / history API，可把同应用 `page/app` 的同页跳转替换成壳层 `push/replace`；没有明确 API 时，不猜内部对象，使用上面的工作台 URL。

PC 抽屉内的 iframe 高度随内容区拉满，提交页和详情页抽屉默认使用同一半屏宽度 `50vw`，占当前视口宽度的 50%；只有用户明确要求更窄/更宽，或页面需要主从分栏并给出具体验收时，才调整该宽度。提交成功或查看结束后的刷新可以先用抽屉关闭事件触发列表 reload，若平台 postMessage 事件已验证，再接入精确的提交完成回调。移动端不强塞抽屉，避免键盘和表单字段被压缩。

## PortalQuickEntry / QuickAccessCard 边界

- 使用可配置的门户组件时，优先保留 `linkType/page/app/url` 语义和 router 参数，应用内页面保留页面类型与路由参数。
- 如果当前运行态的 `PortalQuickEntry` 只能消费静态 `url` 且点击固定 `window.open`，应用内页面入口改用 Canvas 自绘入口卡片，原生组件只作为展示增强或外链入口。
- `QuickAccessCard` / `RecentlyUsedCard` 是应用列表容器，适合“最近/常用应用”；业务页内的“新增客户、客户列表、跟进记录”这类入口用自绘卡片更可控。

## 验收

- 点击同应用页面入口后，没有新浏览器标签或新钉钉窗口。
- 点击 PC 端「新建 / 提交表单 / 查看详情」后，在当前自定义页侧边抽屉打开原生表单页，不直接弹新标签。
- 点击移动端「新建 / 提交表单」后，可以整页或新页进入原生提交页。
- 点击移动端「查看详情」后，可以整页或新页进入原生详情页。
- URL 进入 `/{appType}/workbench/{formUuid}` 或对应平台同页路径。
- 应用左侧/顶部导航能跟随目标页面选中；若导航隐藏，则页面内导航壳有明确选中态。
- 外部 URL、钉钉 OA、文件预览等仍按新窗口或端内打开能力处理。
