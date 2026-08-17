# YidaCodeCanvas 原生组件桥

YidaCodeCanvas 接入平台运行态组件时，统一使用运行时桥接。覆盖门户组件、数据管理视图、成员、部门、附件上传和图片上传。

## 核心策略

YidaCodeCanvas 里的平台运行态组件按“先探测、可用增强、fallback 保底”的方式接入。字段、门户、数据管理视图等运行态组件统一从页面 `window.Deep` / `window.DeepYida` / `window.YidaNativeComponents` 查找；页面源码只 `import` YidaCodeCanvas 可用资源清单内的通用前端包。

运行时桥接步骤：

1. 从 `window.Deep`、`window.DeepYida` 探测组件；若环境已有 `window.YidaNativeComponents`，作为可用主题读取。
2. 找到组件后渲染原生组件。
3. 找不到时渲染 Canvas 自绘 fallback。
4. 对成员、部门、文件值做统一归一化，再进入页面状态和提交 payload。

需要验证运行态组件时，按本文件规则编写探测页和业务页。探测页只验证组件是否存在、props 是否稳定、fallback 是否生效，不作为业务页面设计依据。

## 组件查找顺序

推荐封装 `findYidaComponent(name)`，按以下顺序查找：

| 来源 | 说明 |
| --- | --- |
| `window.Deep[name]` | `window.Deep` 上的基础字段/组件 |
| `window.DeepYida.default` 或 bundle 数组 | `window.DeepYida` 上的运行态组件集合，按 `displayName` 匹配 |
| `window.YidaNativeComponents[name]` | 可选可用主题；存在时读取，不作为前置条件 |

业务代码统一走桥接函数读取运行态组件，便于隔离不同运行态差异。

桥接函数只返回可被 React 渲染的组件：函数组件、class 组件、带 `render()` 的对象，或运行态包装对象里的 `component` / `Component` / `default` 字段。`window.DeepYida` 数组里只带 `displayName/name` 的描述对象不能直接作为 JSX 组件渲染，必须判为不可用并走 fallback；否则生产环境会出现 `Minified React error #130`。

## 门户组件接入规则

### TopBanner / QuickEntry

需要门户 Banner 或快捷入口时，优先探测：

- `PortalTopBanner`
- `PortalQuickEntry`

这两个组件偏展示型，最适合作为第一批增强能力。找不到时用自绘 Banner 和入口卡片兜底。

推荐用法：

- Banner 只传 `mainTitle`、`subTitle`、`bannerHeight`、`textPosition` 等稳定展示 props。
- QuickEntry 只传静态 `content`、`titleConfig`、`themeConfig`。
- 点击跳转由 Canvas 自己控制，目标 URL 和打开方式写在页面代码里。

### QuickAccessCard / RecentlyUsedCard（`theme` 必传）

这两个是**容器型组件**，会在运行态自行拉取应用列表并渲染卡片。`theme` 是必传运行参数；页面始终传入 `theme="row-white"` 或 `theme="column"`。

必传 / 建议 props：

| prop | 必要性 | 说明 |
| --- | --- | --- |
| `theme` | **必传** | 字符串。含 `column` → 纵向排布，否则横向。推荐 `'row-white'`（横排）或 `'column'` |
| `maxItems` | 建议 | 展示数量上限，缺省 8 |
| `showAppDescription` | 可选 | 是否显示应用描述 |
| `containerPrefix` | 可选 | 容器 className 前缀 |
| `enableQuickAccess` | 可选 | `RecentlyUsedCard` 用：是否允许将应用加入快捷访问 |
| `enableCancelAccess` | 可选 | `QuickAccessCard` 用：是否允许取消快捷访问 |

使用要求：

- **始终传 `theme`**（如 `'row-white'`）。
- 列表数据由组件自取（依赖当前登录用户 + 门户接口），Canvas 提供容器 props、布局和 fallback。
- 组件缺失或无门户接口权限时，渲染 Canvas 自绘应用入口卡片。

> 页面侧遵守必传 props 约束并做好局部降级：`theme` 有值，组件缺失或运行态不兼容时展示 Canvas fallback。

### DataCard 使用边界

数据卡片采用 Canvas 自绘卡片 + `fetch`/连接器/`yida-report` 取数。`DataCard` 需要完整门户数据卡片上下文，只有目标运行态确认该上下文可用时才接入。

页面只需要「门户风格」时，使用 Canvas 自绘卡片并通过 fetch/连接器取数据；需要复用宜搭门户内置的快捷/最近应用卡片时，按上面方式启用 `QuickAccessCard` / `RecentlyUsedCard`。

## 数据管理视图接入规则

需要在自定义页面中嵌入门户里那块「数据管理视图」时，优先探测 `DataManageViews`，并把它当作黑盒组件使用。页面侧只传稳定的 `form` 配置，不自行构造底层数据管理 props。

适用场景：

- 页面需要使用门户组件（快捷入口 `QuickAccessCard`、最近使用应用卡片 `RecentlyUsedCard`、数据管理视图 `DataManageViews` 等），让自定义页直接复用门户里的对应组件。
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

Smoke 页验证方式：编写最小 YidaCodeCanvas 探测页，只包含组件查找、props 传入、错误边界和 fallback。

发布后在 URL 追加目标表单：

```text
?formUuid=FORM_xxx&formLabel=客户信息
```

使用要求：

- 先拿到 `form.value/formUuid`，再渲染 `DataManageViews`。
- 组件依赖页面运行环境的登录态、权限、CSRF 和平台数据管理样式；组件缺失或权限不足时保留 Canvas fallback。
- `DataManageViews` 会自动过滤 `viewType === 'form'` 的视图，并关闭导入、导出、批量操作等门户不需要的能力；页面侧统一使用它渲染门户数据管理视图。
- 只需要展示少量业务数据时，用 Canvas 自绘表格 + HTTP 数据桥 / 连接器 / `openyida data`；需要复用门户数据管理视图时使用 `DataManageViews`。

## 成员组件接入规则

需要成员选择时，优先探测 `EmployeeField`。它属于平台运行态组件，先验证可用性，再接入业务页面。

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

## 部门组件接入规则

需要部门选择时，优先探测 `DepartmentSelectField`。该组件依赖页面运行环境的通讯录能力、搜索接口和权限上下文，先完成 smoke 验证再接入业务页面。

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

## 上传组件接入规则

需要上传时，优先探测：

- `AttachmentField`
- `ImageField`

上传组件依赖 OSS 签名、上传权限、页面配置、文件预览扩展点和移动端环境，是最需要验证的能力。

使用要求：

- 原生上传作为增强能力；组件缺失或上传失败时，fallback 到链接录入或业务连接器上传。
- Cookie、CSRF、OSS key 或内部上传密钥由平台、连接器或后端服务管理，Canvas 只消费安全返回结果。
- 提交数据只使用归一化后的文件数组，`raw` 仅用于检查。

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

## Fallback 稳定基线

满足任一条件时直接渲染 Canvas fallback，保证页面主流程可用：

- 运行态找不到目标组件。
- 未指定数据管理视图的 `form.value/formUuid`。
- 组件 CSS 尚未加载到可交互状态。
- 成员或部门弹层打不开。
- 上传组件尚未完成 OSS 签名或上传权限校验。
- 移动端组件形态与 PC 不一致且未适配。

Canvas 自绘 fallback 是页面稳定基线；原生组件是增强体验。
