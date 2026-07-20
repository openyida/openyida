# Code Canvas 原生组件桥接指南

本文说明在 Code Canvas 自定义页面中接入宜搭运行态组件的推荐做法，覆盖门户组件、数据管理视图、成员、部门、附件上传和图片上传。

## 核心策略

Code Canvas 源码通过运行时桥接接入 `@ali/deep`、`@ali/vc-deep-yida` 或 `@ali/yida-ui` 已挂载到宿主 `window` 的组件。当前 Code Canvas 依赖白名单只负责加载通用前端包，这类宜搭运行态组件应保持在宿主桥接层，而不是进入 `importedModules`。本方案不要求修改 `vc-deep-yida`，以当前宿主已经存在的 `window.Deep` / `window.DeepYida` 探测为主。

推荐方式是运行时桥接：

1. 从 `window.Deep`、`window.DeepYida` 探测组件；若环境已有 `window.YidaNativeComponents`，作为兼容入口读取。
2. 找到组件后渲染原生组件。
3. 找不到时渲染 Canvas 自绘 fallback。
4. 对成员、部门、文件值做统一归一化，再进入页面状态和提交 payload。

完整示例通过 sample 获取：

```bash
openyida sample yida-canvas-custom-page native-components-smoke --output project/pages/src/native-components-smoke.canvas.jsx
openyida sample yida-canvas-custom-page portal-native-components --output project/pages/src/portal-native-components.canvas.jsx
```

## 组件查找顺序

推荐封装 `findYidaComponent(name)`，按以下顺序查找：

| 来源 | 说明 |
| --- | --- |
| `window.Deep[name]` | `@ali/deep` 基础字段/组件全局 |
| `window.DeepYida.default` 或 bundle 数组 | `vc-deep-yida` 运行包组件集合，按 `displayName` 匹配 |
| `window.YidaNativeComponents[name]` | 可选兼容入口；存在时读取，不作为本方案前置条件 |

业务代码统一走桥接函数读取宿主组件，便于隔离不同运行态差异。

## 门户组件怎么用

### TopBanner / QuickEntry

需要门户 Banner 或快捷入口时，优先探测：

- `PortalTopBanner`
- `PortalQuickEntry`

这两个组件偏展示型，最适合作为第一批增强能力。找不到时用自绘 Banner 和入口卡片兜底。

推荐用法：

- Banner 只传 `mainTitle`、`subTitle`、`bannerHeight`、`textPosition` 等稳定展示 props。
- QuickEntry 只传静态 `content`、`titleConfig`、`themeConfig`。
- 点击跳转由 Canvas 自己控制，避免依赖门户上下文隐式行为。

### QuickAccessCard / RecentlyUsedCard（可用，但 `theme` 必传）

这两个是**容器型组件**：`componentDidMount` 时自己调用门户接口拉取应用列表（`QuickAccessCard` → 应用快捷入口，`RecentlyUsedCard` → 最近访问应用），再逐项渲染应用卡片。它们的 `renderItem` 内部执行 `this.props.theme.includes('column')` 决定卡片排布，而 **`theme` 在容器层没有默认值**——不传 `theme` 时，只要拉到的列表非空（真实登录态下几乎必然非空）就会抛 `Cannot read properties of undefined (reading 'includes')` 崩溃白屏。

必传 / 建议 props：

| prop | 必要性 | 说明 |
| --- | --- | --- |
| `theme` | **必传** | 字符串。含 `column` → 纵向排布，否则横向。传 `'row-white'`（横排，与组件内层默认一致）或 `'column'`；**切勿留空** |
| `maxItems` | 建议 | 展示数量上限，缺省 8 |
| `showAppDescription` | 可选 | 是否显示应用描述 |
| `containerPrefix` | 可选 | 容器 className 前缀 |
| `enableQuickAccess` | 可选 | `RecentlyUsedCard` 用：是否允许将应用加入快捷访问 |
| `enableCancelAccess` | 可选 | `QuickAccessCard` 用：是否允许取消快捷访问 |

使用要求：

- **一定要传 `theme`**（如 `'row-white'`），这是这两个组件能否在 Canvas 里正常渲染的分水岭。
- 列表数据由组件自取（依赖当前登录用户 + 门户接口），Canvas 既不需要、也无法通过 props 塞列表数据。
- 组件缺失或无门户接口权限时，回退 Canvas 自绘应用入口卡片。

> 崩溃根因核实自运行态 `@ali/vc-deep-yida` 异步 chunk（`QuickAccessCard` = chunk 53 / `RecentlyUsedCard` = chunk 52）：容器类 `renderItem` 里 `this.props.theme.includes('column')` 未做空值兜底，容器层 `theme` 亦无 `defaultProps`（仅内层展示组件默认 `'row-white'`，renderItem 绕过了它）。上游正确修复方向：容器补 `defaultProps.theme` 或改写为 `(theme||'').includes(...)`；页面侧无需改 `vc-deep-yida`，传 `theme` 即可。

### DataCard（暂不支持）

`DataCard` 依赖数据卡片配置、图表上下文和门户变量，在 Code Canvas 无门户宿主上下文下无法有效工作：裸渲染只会显示「请选择要嵌入的数据卡片」空占位，无法真正承载数据。**当前暂不支持在 Canvas 页面复用 `DataCard`**。需要数据卡片时，用 Canvas 自绘卡片 + `fetch`/连接器/`yida-report` 取数据。

如果页面只是要「门户风格」，优先用 Canvas 自绘卡片并通过 fetch/连接器取数据；只有确实需要复用宜搭门户内置的快捷/最近应用卡片时，再按上面方式启用 `QuickAccessCard` / `RecentlyUsedCard`。

## 数据管理视图怎么用

需要在自定义页面中嵌入门户里那块「数据管理视图」时，优先探测 `DataManageViews`。它来自 `@ali/vc-deep-yida` 的 `vc-data-manage-views`，门户中使用的就是这个组件；它只接收 `form` 配置，内部通过 `useFormInfo(form)` 请求 `getFormSchemaInfo.json`，再把 `multiViewInfos` 中非 `form` 类型的视图传给 `YidaFormManage` 渲染。`YidaFormManage` 是内部承载，不应作为门户数据管理视图的首选桥接入口。

适用场景：

- AI 宜搭 / Pod / 宜搭 AI 创建的应用，需要让自定义页复用门户数据管理视图。
- 页面需要保持与门户磁贴、左侧导航、数据管理页、权限与视图配置一致。
- 目标表单已经存在，页面能明确拿到表单 `formUuid`，并能构造 `form` 配置。

推荐最小 props：

| prop | 必要性 | 说明 |
| --- | --- | --- |
| `form` | **必传** | 选中的表单配置对象，结构见下方示例 |
| `form.appType` | **必传** | 当前应用 appType；可从页面 URL 或配置传入 |
| `form.value` | **必传** | 目标表单 formUuid |
| `form.label` | 建议 | 表单展示名 |
| `form.title` | 建议 | i18n 标题对象：`{ type: 'i18n', zh_CN, en_US }` |
| `innerHeight` | 可选 | 外层容器高度参考值，smoke 示例默认 600 |

推荐 props 示例：

```js
{
  form: {
    appType: 'APP_xxx',
    value: 'FORM_xxx',
    label: '客户信息',
    title: { type: 'i18n', zh_CN: '客户信息', en_US: 'Customer' }
  },
  innerHeight: 600
}
```

Smoke 页验证方式：

```bash
openyida sample yida-canvas-custom-page native-components-smoke --output project/pages/src/native-components-smoke.canvas.jsx
```

发布后在 URL 追加目标表单：

```text
?formUuid=FORM_xxx&formLabel=客户信息
```

使用要求：

- **不要在未指定 `form.value/formUuid` 时试渲染**，否则可能触发无效数据管理视图接口请求。
- 组件依赖宿主运行态、登录态、权限、CSRF、`vc-deep-yida` 与 `yc-data-manage` 样式，找不到组件或权限不足时必须保留 Canvas fallback。
- `DataManageViews` 会自动过滤 `viewType === 'form'` 的视图，并关闭导入、导出、批量操作等门户不需要的能力；页面侧不要绕过它直接拼内部 `YidaFormManage` props。
- 如果只需要展示少量业务数据，用 Canvas 自绘表格 + `this.dataSourceMap`/连接器/`openyida data` 更稳；只有需要复用门户数据管理视图时使用 `DataManageViews`。

## 成员组件怎么用

需要成员选择时，优先探测 `EmployeeField`。在 `vc-deep-yida` 中，`EmployeeField` 是对 `@ali/deep.EmployeeField` 的包装，并默认支持部门选择。

使用要求：

- 记录一次真实 `onChange` 输出，按实际结构适配。
- 页面状态只保存归一化后的成员值。
- 找不到原生组件时，用 fallback 输入/搜索控件保存 `name`、`userId`、`workNo` 等已知字段。

推荐归一化结构：

```js
{
  userId: '',
  emplId: '',
  name: '',
  nickName: '',
  workNo: '',
  avatar: '',
  raw: {}
}
```

## 部门组件怎么用

需要部门选择时，优先探测 `DepartmentSelectField`。该组件依赖 `@ali/deep.SelectField`、`EmployeeSearch`、部门搜索接口和 CSRF 注入，因此要比成员组件更谨慎。

使用要求：

- 先在 smoke 页面确认弹层、搜索、单选、多选都可用。
- 无通讯录权限时展示可理解的权限提示。
- 找不到原生组件时，用 fallback 输入/搜索控件保存 `deptId` 和部门名称。

推荐归一化结构：

```js
{
  deptId: '',
  value: '',
  name: '',
  text: '',
  deptFullPath: '',
  raw: {}
}
```

## 上传组件怎么用

需要上传时，优先探测：

- `AttachmentField`
- `ImageField`

上传组件依赖 OSS 签名、上传权限、页面配置、文件预览扩展点和移动端环境，是最需要验证的能力。

使用要求：

- 原生上传只作为增强能力；找不到或失败时 fallback 到链接录入或业务连接器上传。
- Cookie、CSRF、OSS key 或内部上传密钥由平台、连接器或后端服务管理，Canvas 只消费安全返回结果。
- 提交数据只使用归一化后的文件数组，`raw` 仅用于调试。

推荐归一化结构：

```js
{
  name: '',
  url: '',
  downloadURL: '',
  imgURL: '',
  fileId: '',
  size: 0,
  type: '',
  raw: {}
}
```

## 验收清单

| 能力 | 验收点 |
| --- | --- |
| 组件探测 | 页面能输出可用/缺失组件列表，不因缺失白屏 |
| 门户 Banner | 原生或 fallback 都能渲染，移动端不溢出 |
| 快捷入口 | 静态入口渲染正常，点击行为可控 |
| 数据管理视图 | URL 传入 `formUuid` 后可加载目标表单数据管理视图，权限不足时不白屏 |
| 成员 | 搜索、选择、清空、单选/多选正常，`onChange` 结构已记录 |
| 部门 | 搜索、部门树/弹层、权限提示、单选/多选正常 |
| 附件/图片上传 | 选择、上传、删除、预览、失败提示正常 |
| 值归一化 | 提交 payload 不依赖 raw 原始对象 |
| fallback | 任何原生组件缺失时页面仍可完成核心流程 |

## 什么时候使用普通 Canvas fallback

以下情况应主动使用 fallback：

- 运行态找不到目标组件。
- 未指定数据管理视图的 `form.value/formUuid`。
- 组件 CSS 尚未加载到可交互状态。
- 成员或部门弹层打不开。
- 上传组件尚未完成 OSS 签名或上传权限校验。
- 移动端组件形态与 PC 不一致且未适配。

fallback 不是失败路径，而是 Canvas 页面的稳定基线；原生组件是增强体验。
