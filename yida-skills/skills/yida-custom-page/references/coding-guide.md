# 宜搭自定义页面编码指南

> **以下规范是编写宜搭自定义页面代码的核心约束，必须严格遵守。**

## 运行环境与约束

宜搭自定义页面的 JSX 组件本质上是 **React 类组件中的 render 方法**，而非独立的 React 组件。因此存在以下关键约束：

| 约束 | 说明 |
| --- | --- |
| **React 版本** | 宜搭运行时是 **React 16 类组件模型**。原生页面禁止 Hooks；OpenYida `.oyd.jsx` authoring 模式可有限使用 `useState` 与 `useEffect(..., [])`，发布前会降级 |
| **单文件** | 所有代码写在一个文件中（推荐 `project/pages/src/<页面名>.oyd.jsx`）|
| **三方包引入** | 禁止使用 `import/require` 语法，如需使用第三方库，必须通过 `this.utils.loadScript` 加载 CDN 脚本，参考 [yida-api.md](../../../references/yida-api.md) 的「工具类 API」章节。Tailwind 属于默认视觉层，按下方「Tailwind 引入规范」处理 |
| **内置 lodash** | 宜搭页面运行时已全局加载 **lodash 4.6.1**（`window._`），可直接使用 `_.get`、`_.groupBy`、`_.cloneDeep` 等，无需 `loadScript`。详见下方「内置 lodash 使用指引」 |
| **函数导出格式** | 原生写法使用 `export function xxx() {}`；现代 authoring 写法使用 `export default function Page()`，由 OpenYida 编译为原生导出函数 |
| **生命周期名称** | 只允许 `didMount` / `didUnmount`，大小写敏感；不要写 `didmount`、`componentDidMount`、`componentWillUnmount` |
| **样式** | 默认使用 Tailwind utility `className` 组织视觉层；关键尺寸、容器兜底和 Tailwind 加载失败兜底可继续使用 `style` 对象。禁止 `import` CSS、CSS Modules 或构建期样式能力 |
| **`this` 上下文** | 所有导出函数中的 `this` 指向宜搭页面的 React 类实例 |
| **按钮交互** | 可见 `<button>` 必须有 `onClick`/`onMouseDown`/`onKeyDown` 或明确 `disabled`；静态标签、状态徽标、截图标记用 `span`/`div` |
| **JSX 文案** | 中文业务文案只能写成纯文本 `所有级别` 或带引号字符串 `{'所有级别'}`；花括号里只放真实变量/表达式，不写 `{所有级别}` 这类裸中文表达式 |
| **禁止使用 `this.setState` 管理业务状态** | `this.setState` 已被覆盖，仅用于 `forceUpdate`（通过更新 `timestamp`） |
| **JavaScript 版本** | 使用 ES2015 (ES6) 语法，不能高于 ES2015 版本。**注意**：即使是 ES6 语法，部分特性也会导致静默失败，详见下方「JS 引擎兼容性限制」 |
| **必须定义页面入口** | 原生写法必须定义 `renderJsx`；`.oyd.jsx` authoring 写法必须定义 `export default function Page()` |

---

## Tailwind 引入规范

自定义页面没有本地构建链路，不能像普通 React 项目一样 `import './tailwind.css'`。默认使用 Tailwind utility className 组织视觉层；运行时脚本只能来自已验证的 `g.alicdn.com` 或企业自托管地址。不要默认写 `cdn.tailwindcss.com`、`jsdelivr`、`unpkg` 等海外 CDN，避免客户网络慢或不可达。

### 推荐策略

| 方式 | 适用场景 | 约束 |
| --- | --- | --- |
| 页面内 `loadScript` 固定版本 | 默认生成、自定义页面快速交付 | 默认使用已验证的 `g.alicdn.com` 地址；加载失败必须有基础样式兜底 |
| OpenYida npm 包内置/托管资产 | 私有化、生产稳定性、企业内网 | npm 包里的文件不能被宜搭页面直接 `import`，需要 CLI 嵌入 CSS、上传 CDN，或发布到可公网/内网访问的固定 URL |

### 运行时代码模板

```javascript
// 已验证的 g.alicdn.com 地址；私有化/内网环境可替换为企业自托管地址
var TAILWIND_CDN = 'https://g.alicdn.com/code/lib/tailwindcss-browser/0.0.0-insiders.fed6c6a/index.global.min.js';

export function ensureTailwind() {
  var self = this;

  if (window.__openyidaTailwindReady) {
    return Promise.resolve();
  }
  if (window.__openyidaTailwindLoading) {
    return window.__openyidaTailwindLoading;
  }

  if (!TAILWIND_CDN) {
    self.injectTailwindFallback();
    return Promise.resolve();
  }

  self.injectTailwindSource();

  window.__openyidaTailwindLoading = self.utils.loadScript(TAILWIND_CDN)
    .then(function() {
      window.__openyidaTailwindReady = true;
      self.forceUpdate();
    })
    .catch(function() {
      window.__openyidaTailwindFailed = true;
      self.injectTailwindFallback();
      self.forceUpdate();
    });

  return window.__openyidaTailwindLoading;
}

export function injectNativeControlReset() {
  var style = document.getElementById('openyida-native-control-reset');
  if (!style) {
    style = document.createElement('style');
    style.id = 'openyida-native-control-reset';
    document.head.appendChild(style);
  }

  style.innerHTML = [
    '.oyd-page{--oyd-control-border:#D0D5DD;--oyd-control-hover:var(--color-brand1-4,#8BB8FF);--oyd-control-focus:var(--color-brand1-6,#2F6FED);--oyd-control-focus-ring:rgba(47,111,237,.14);--oyd-control-selected-bg:rgba(47,111,237,.08);--oyd-control-info-bg:rgba(47,111,237,.08);}',
    '.oyd-page input,.oyd-page textarea,.oyd-page select,.oyd-page .oyd-input,.oyd-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;color:#1D2939;outline:none!important;box-shadow:none;}',
    '.oyd-page input,.oyd-page textarea,.oyd-page select,.oyd-page .oyd-input{border:1px solid var(--oyd-control-border);border-radius:6px;background:#fff;}',
    '.oyd-page input:hover,.oyd-page textarea:hover,.oyd-page select:hover,.oyd-page .oyd-input:hover,.oyd-page .oyd-select-trigger:hover{border-color:var(--oyd-control-hover)!important;}',
    '.oyd-page input:focus,.oyd-page textarea:focus,.oyd-page select:focus,.oyd-page .oyd-input:focus,.oyd-page .oyd-select-trigger:focus{border-color:var(--oyd-control-focus)!important;outline:none!important;box-shadow:0 0 0 3px var(--oyd-control-focus-ring)!important;}',
    '.oyd-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--oyd-control-focus)!important;box-shadow:0 0 0 3px var(--oyd-control-focus-ring)!important;}',
    '.oyd-page .oyd-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.oyd-page .oyd-select-trigger-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.oyd-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#667085;transition:transform .16s ease,color .16s ease;flex:0 0 14px;display:block;}',
    '.oyd-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--oyd-control-focus);}',
    '.oyd-page .oyd-select-option{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.oyd-page .oyd-select-check{width:14px!important;height:14px!important;color:var(--oyd-control-focus);flex:0 0 14px;display:block;}',
  ].join('');
}

export function injectTailwindSource() {
  if (document.getElementById('openyida-tailwind-source')) {
    return;
  }

  var style = document.createElement('style');
  style.id = 'openyida-tailwind-source';
  style.type = 'text/tailwindcss';
  style.innerHTML = [
    '@import "tailwindcss/theme";',
    '@import "tailwindcss/preflight";',
    '@import "tailwindcss/utilities";',
    '@theme { --color-brand: var(--color-brand1-6, #2F6FED); }',  // 跟随 App 主题，缺失时兜底
  ].join('\n');
  document.head.appendChild(style);
}

export function injectTailwindFallback() {
  if (document.getElementById('openyida-tailwind-fallback')) {
    return;
  }

  var style = document.createElement('style');
  style.id = 'openyida-tailwind-fallback';
  style.innerHTML = [
    '.oyd-btn,.oyd-input,.oyd-select-trigger,.oyd-select-option{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;}',
    '.oyd-btn{height:36px;border-radius:6px;border:1px solid #D0D5DD;background:#fff;padding:0 12px;font-size:14px;cursor:pointer;}',
    '.oyd-btn-primary{background:var(--color-brand1-6,#2F6FED);border-color:var(--color-brand1-6,#2F6FED);color:#fff;}',
    '.oyd-input{border:1px solid #D0D5DD;border-radius:6px;background:#fff;box-shadow:none;}',
    '.oyd-select-trigger{height:38px;border-radius:6px;border:1px solid #D0D5DD;background:#fff;padding:0 10px 0 12px;font-size:14px;text-align:left;box-shadow:none;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1D2939;}',
    '.oyd-select-trigger-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.oyd-select-arrow{width:14px!important;height:14px!important;color:#667085;transition:transform .16s ease,color .16s ease;flex:0 0 14px;display:block;}',
    '.oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--color-brand1-6,#2F6FED);}',
    '.oyd-select-menu{position:absolute;z-index:30;margin-top:6px;width:100%;padding:6px;border:1px solid #E4E7EC;border-radius:10px;background:#fff;box-shadow:0 16px 32px rgba(16,24,40,.14);}',
    '.oyd-select-option{width:100%;min-height:36px;border:0;border-radius:8px;background:#fff;padding:0 10px;text-align:left;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1D2939;}',
    '.oyd-select-option-active{background:var(--oyd-control-selected-bg,#EFF6FF);color:var(--color-brand1-6,#1D4ED8);font-weight:600;}',
    '.oyd-select-check{width:14px!important;height:14px!important;color:var(--color-brand1-6,#1D4ED8);flex:0 0 14px;display:block;}',
  ].join('');
  document.head.appendChild(style);
}

export function didMount() {
  this.injectNativeControlReset();
  this.ensureTailwind();
  this.loadData();
}
```

### 生成约束

1. Tailwind URL 必须写成常量，只能填写已验证的 `g.alicdn.com`、企业 OSS/CDN 或 OpenYida 托管地址。
2. 禁止默认写海外 CDN；如果目标环境不能访问默认 `g.alicdn.com` 地址，替换为企业自托管地址，或保留空字符串并依赖 fallback 样式。
3. 使用 `@tailwindcss/browser` 时，通过 `style[type="text/tailwindcss"]` 默认导入 `tailwindcss/theme`、`tailwindcss/preflight` 和 `tailwindcss/utilities`。自定义页面可以接受 reset，但仍必须注入 native control reset，兜住 input/textarea/select/自定义下拉的 focus 边框、font-weight、appearance 和 shadow；只有用户明确要求运行页面完全隔离时才关闭 preflight，并必须手动重置按钮/输入框/下拉样式。
4. `className` 使用完整静态类名字符串；不要拼 `bg-` + color 这类动态类名。
5. Tailwind 加载失败时仍要能看到可用页面：关键容器保留 `style` 兜底，通用按钮/输入框/下拉增加 `oyd-*` fallback class。
6. 用户可见的下拉、菜单、分段控件默认用 Tailwind 自定义组件；不要用原生 `<select>`。

---

## 内置 lodash 使用指引

宜搭页面运行时已全局加载 **lodash 4.6.1**（CDN: `https://g.alicdn.com/platform/c/lodash/4.6.1/lodash.min.js`），通过 `window._` 直接可用，**无需 `this.utils.loadScript` 加载**。

### 推荐使用场景

生成自定义页面代码时，遇到以下数据处理需求**优先使用 lodash**，不要手写实现：

| 需求 | lodash 写法 | 替代的手写写法 |
| --- | --- | --- |
| 按字段分组 | `_.groupBy(list, 'type')` | 手写 `reduce` + 对象累加 |
| 去重 | `_.uniq(arr)` / `_.uniqBy(arr, 'id')` | 手写 `filter` + `indexOf` |
| 安全取值 | `_.get(obj, 'a.b.c', defaultVal)` | 多层 `&&` 判断 |
| 安全赋值 | `_.set(obj, 'a.b.c', val)` | 逐层判断并创建对象 |
| 深拷贝 | `_.cloneDeep(obj)` | `JSON.parse(JSON.stringify(obj))` |
| 排序 | `_.sortBy(list, 'date')` | 手写 `sort` 比较函数 |
| 扁平化 | `_.flatten(arr)` / `_.flattenDeep(arr)` | 手写递归 concat |
| 对象 pick/omit | `_.pick(obj, ['a','b'])` / `_.omit(obj, ['c'])` | 手写循环复制 |
| 防抖/节流 | `_.debounce(fn, 300)` / `_.throttle(fn, 300)` | 手写 `setTimeout` 管理 |
| 按键索引 | `_.keyBy(list, 'id')` | 手写 `reduce` 构建 map |

### 注意事项

1. **版本是 4.6.1**，不是最新版，但常用 API 均已支持
2. **直接用 `_` 即可**，不需要声明 `var _ = window._`（已是全局变量）
3. 不要把 lodash 和「计算属性名」禁令搞混——`_.groupBy` 返回的对象用方括号**读取**属性是安全的，禁止的是**字面量**中的 `{ [key]: value }` 写法

```javascript
// ✅ 正确：lodash groupBy + 方括号读取
var grouped = _.groupBy(orders, 'status');
var pendingOrders = grouped['待审批'] || [];

// ✅ 正确：安全取值，避免层层 && 判断
var city = _.get(record, 'formData.addressField.city', '未知');

// ✅ 正确：深拷贝替代 JSON.parse(JSON.stringify(...))
var snapshot = _.cloneDeep(_customState);
```

---

## ⚠️ JS 引擎兼容性限制（静默失败，极难排查）

宜搭自定义页面的 JS 引擎存在以下已知兼容性问题，**所有问题均无控制台报错**，必须严格规避：

### 1. 禁止使用 ES6 计算属性名 `{ [key]: value }` — 阻塞

使用计算属性名会导致**整个模块加载失败**，`didMount` 不执行，页面空白，控制台无任何错误信息。
`openyida check-page` 会以 `computed-property` error 阻塞，编译/发布前必须改掉。

```javascript
// ❌ 严禁：计算属性名，导致模块加载失败
var obj = { [fieldId]: value };
searchFieldJson: JSON.stringify({ [FIELDS.department]: '研发部' });
this.setCustomState({ [key]: value });

// ✅ 正确：ES5 写法
var obj = {};
obj[fieldId] = value;

// ✅ 正确：searchFieldJson 中也必须用 ES5 写法
var searchCondition = {};
searchCondition[FIELDS.department] = '研发部';
searchCondition[FIELDS.status] = '待审批';
searchFieldJson: JSON.stringify(searchCondition);

// ✅ 正确：动态 setCustomState 先构造对象
var nextState = {};
nextState[key] = value;
this.setCustomState(nextState);
```

### 2. 禁止在 `.then()` 回调中使用 `String.padStart()` — 严重

在 `.then()` 回调中调用含 `padStart()` 的函数，回调会在该行**静默中断**，后续代码均不执行，控制台无报错。

```javascript
// ❌ 严禁：padStart 在 .then() 回调中静默中断
.then(function(res) {
  var month = String(date.getMonth() + 1).padStart(2, '0');  // 此行之后代码不执行
  self.processData(res);  // 永远不会执行
});

// ✅ 正确：用三元运算符替代 padStart
.then(function(res) {
  var month = date.getMonth() + 1;
  var monthStr = month < 10 ? '0' + month : '' + month;
  self.processData(res);
});
```

> **自检规则**：生成代码时，检查所有动态对象构造和 `.then(function(res) { ... })` 回调，确保：① 无计算属性名；② 无 `padStart`/`padEnd`。特别注意 `setCustomState({ [key]: value })` 和 `JSON.stringify({ [FIELDS.xxx]: value })` 两种写法。建议将复杂的回调逻辑提取到独立的 `export function` 中，保持回调简洁。

---

## 文件结构

**一个完整的宜搭自定义页面源文件必须包含：**
- `_customState` 变量
- getCustomState 函数
- setCustomState 函数
- forceUpdate 函数
- didMount 函数
- didUnmount 函数
- renderJsx 函数

OpenYida 编译器会在发布前为极简页面补齐缺失的空 `didMount` / `didUnmount` 和基础状态函数，避免 Schema 中 actionRef 找不到函数；但交付给 AI/IDE 的源码仍必须按下面结构生成，便于人审、二次修改和 `check-page` 精准定位问题。

```jsx
// ── 状态管理 ──────────────────────────────────────────
var _customState = {
  // 在此定义所有业务状态的初始值
};

export function getCustomState(key) { /* 传 key 返回单值，不传返回浅拷贝 */ }
export function setCustomState(newState) { /* 合并更新 + this.forceUpdate() */ }
export function forceUpdate() { this.setState({ timestamp: new Date().getTime() }); }

// ── 生命周期 ──────────────────────────────────────────
export function didMount() { /* 初始化数据、启动定时器 */ }
export function didUnmount() { /* 清理定时器、解绑事件 */ }

// ── 业务方法（必须用 export function）─────────────────
export function loadData() { /* this.utils.yida.searchFormDatas(...) */ }

// ── 渲染（页面入口）──────────────────────────────────
export function renderJsx() {
  var self = this;
  var timestamp = this.state && this.state.timestamp;
  return (
    <div>
      {/* 必须保留：触发 forceUpdate 重渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>
      {/* 页面内容 */}
    </div>
  );
}
```

> 完整页面实现按本指南的文件结构、状态管理、生命周期和 API 调用规则编写。
> 原生 `renderJsx` 的每个 `return` 分支都必须包含隐藏 timestamp 节点；`.oyd.jsx` 兼容构建会自动补齐，但手写模板时仍建议显式保留。

---

## 状态管理使用方式

```javascript
// 获取全部状态（返回浅拷贝）
const state = this.getCustomState();

// 获取单个状态值
const count = this.getCustomState('count');

// 设置状态并自动触发重新渲染
this.setCustomState({ count: count + 1, loading: true });

// 仅触发重新渲染（不修改状态）
this.forceUpdate();
```

### ⚠️ 读状态只能用 `getCustomState()`，禁止读 `this.state.<业务字段>`（静默空壳页）

业务态由 `setCustomState()` 写入 `_customState`；`this.state` 里**只有** `forceUpdate()` 写的 `{ timestamp }`。因此 `this.state.<业务字段>` 恒为 `undefined`，页面无任何报错，却渲染成"数据全为占位符、图表全空"的空壳页——极难排查。

`this.state` 仅允许读两个运行时保留字段：`this.state.timestamp`（重渲染标记）和 `this.state.urlParams`（URL 参数）。其余一律走 `getCustomState()`。

```javascript
// ✅ 正确：业务态用 getCustomState 读
export function renderJsx() {
  var self = this;
  var state = this.getCustomState();          // 全部业务态
  var agg = state.agg;
  if (state.loading) { /* 渲染加载态 */ }
  return (
    <div>
      <div>{agg ? agg.totalGmv : '-'}</div>
      {/* timestamp 仍从 this.state 读，这是运行时保留字段 */}
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
    </div>
  );
}
export function renderCharts() {
  var agg = this.getCustomState('agg');        // ✅ 单值也用 getCustomState
  if (!agg) { return; }
}

// ❌ 错误：读 this.state 的业务字段，恒为 undefined → KPI 恒显示占位符、图表恒空、进不了 loading 分支
export function renderJsx() {
  var state = this.state || {};                // ❌ this.state 里没有业务态
  var agg = state.agg;                          // ❌ undefined
}
export function renderCharts() {
  var agg = this.state && this.state.agg;       // ❌ undefined，图表永不渲染
}
```

> **自检规则**：生成/审查页面时，`grep` 一遍 `this.state.` 与 `self.state.`；除 `timestamp`、`urlParams` 外，出现任何 `.state.<业务字段>` 都要改成 `getCustomState()`。

---

## 生命周期钩子

| 钩子函数 | 触发时机 | 典型用途 |
| --- | --- | --- |
| `didMount()` | 页面 DOM 加载渲染完毕 | 初始化数据加载、启动定时器、绑定事件 |
| `didUnmount()` | 页面节点从 DOM 移除 | 清理 `setInterval` / `setTimeout`、解绑事件 |

---

## 全局变量

| 变量 | 类型 | 说明 |
| --- | --- | --- |
| `window.g_config._csrf_token` | `String` | CSRF Token，调用需认证的接口（如 AI 接口、Schema 保存）时必须携带 |
| `window.loginUser.userId` | `String` | 当前登录用户的工号 |
| `window.loginUser.userName` | `String` | 当前登录用户的姓名 |
| `this.state.urlParams` | `Object` | 页面 URL 中的查询参数 |

---

## 编码注意事项

### 编注 0：代码生成前确认功能摘要

生成页面代码前，AI 必须先向用户展示以下内容并获得确认：

1. **功能摘要**：页面的核心功能列表（如"筛选 + 列表 + 详情跳转"）
2. **关键配置**：使用的 formUuid、FIELDS 映射、API 调用方式
3. **交互设计**：主要用户操作流程
4. **UI-only 范围**：页面美感提升/页面重构只调整颜色、布局、密度、间距、视觉层级、素材和图标表达时，现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态保持原样

确认后再开始编码，避免大量返工。

### 1. 自定义方法必须用 `export function` 定义

凡是需要在方法内部使用 `this`（包括 `this.utils.yida.*`、`this.setCustomState` 等）的自定义方法，**必须且只能**使用 `export function 方法名() {}` 的形式定义，调用时使用 `this.方法名()`。**禁止**使用 `const fn = () => {}`、`const fn = function() {}` 等形式定义需要访问 `this` 的方法，这些形式无法被宜搭运行时正确绑定 `this`：

```javascript
// ✅ 正确：export function + this.方法名() 调用
export function didMount() {
  this.loadStatistics();
}
export function loadStatistics() {
  this.utils.yida.searchFormDatas({ formUuid: 'FORM-XXX', pageSize: 10 });
}

// ❌ 错误①：缺少 export，无法被宜搭运行时识别，this 丢失
export function didMount() {
  loadStatistics();  // 直接调用，this 丢失
}
function loadStatistics() {
  this.utils.yida.searchFormDatas(...);  // 报错：this is undefined
}

// ❌ 错误②：箭头函数/函数表达式形式，缺少 export，无法被宜搭运行时绑定 this，禁止使用
const loadStatistics = () => {
  this.utils.yida.searchFormDatas(...);  // 报错：this is undefined
};
const loadStatistics = function() {
  this.utils.yida.searchFormDatas(...);  // 报错：this is undefined
};
```

### 2.【严格禁止】事件绑定必须使用箭头函数包裹

在 `renderJsx` 中绑定任何事件处理器（`onClick`、`onChange`、`onSubmit` 等）时，推荐先在函数顶部定义 `var self = this`，再使用箭头函数 `(e) => { self.方法名(e) }`。**严禁**直接写 `this.方法名` 或 `.bind(this)` 作为事件处理器，否则容易在宜搭运行时丢失上下文：

```javascript
export function handleSubmit(e) {
  this.setCustomState({ submitted: true });
  this.utils.toast({ title: '提交成功', type: 'success' });
}

// ✅ 正确：renderJsx 顶部固定 self，箭头函数包裹
export function renderJsx() {
  var self = this;
  return <button onClick={(e) => { self.handleSubmit(e); }}>提交</button>;
}

// ❌ 错误①：直接传方法引用，this 丢失，运行时报错，绝对禁止！
export function renderJsx() {
  return <button onClick={this.handleSubmit}>提交</button>;
}

// ❌ 错误②：使用 .bind(this) 绑定，虽然能运行但不符合规范，禁止使用！
export function renderJsx() {
  return <button onClick={function() { this.handleSubmit(); }.bind(this)}>提交</button>;
}
```

> **生成代码时的自检清单**：检查 `renderJsx` 中所有 `onClick`、`onChange`、`onSubmit` 等事件属性，确保每一个都是 `(e) => { self.xxx(e) }` 形式，不存在任何 `onClick={this.xxx}` 或 `.bind(this)` 的写法。

### 3. 输入法组合输入处理

使用 `_isComposing` 标记配合 `compositionstart` / `compositionend` 事件，正确处理中文输入法的组合输入状态，避免输入过程中触发提交。

### 4. 定时器清理

在 `didUnmount` 中必须清理所有通过 `setInterval` / `setTimeout` 创建的定时器，防止内存泄漏。

### 5. 错误处理

所有 API 调用（`this.utils.yida.*`、`fetch`）必须使用 `.catch()` 处理异常，并通过 `this.utils.toast({ title: message, type: 'error' })` 向用户展示错误提示。

列表、工作台、看板页面不要让首屏只依赖线上接口成功。默认状态应提供空态或演示数据；接口失败、超时或返回结构异常时，必须把 `loading` 置回 `false` 并保留可操作页面，避免页面长期显示“加载中...”。

### 6. 样式方式

所有样式通过 JavaScript 对象定义（内联样式），在 `renderJsx` 中通过 `style` 属性应用，不使用外部 CSS 文件。平台 JSX 组件页面的样式实现适配和组件模板见 [平台 JSX 组件样式实现适配](design-system.md)。

### 7. 异步操作

可以使用 `async/await` 语法，Babel 编译会自动转换为 ES5 兼容代码。

### 8. pageSize 上限

调用 `searchFormDatas`、`searchFormDataIds`、`getProcessInstances`、`getProcessInstanceIds` 等分页接口时，`pageSize` 最大值为 **100**，超过会导致接口报错。禁止将 `pageSize` 设置为超过 100 的值，推荐使用 `10`～`100` 之间的合理值。

### 9. 输入框使用非受控组件

在宜搭环境中，`<input>` 的 `value` 属性绑定状态后会触发重渲染导致输入异常。**正确做法**：使用 `defaultValue`，在 `onChange` 中更新 `_customState` 而不调用 `setCustomState`：

```javascript
// ❌ 错误：受控组件，每次输入都触发重渲染导致无法输入
<input value={userAnswer} onChange={function(e) { this.setCustomState({ userAnswer: e.target.value }); }} />

// ✅ 正确：非受控组件，仅静默更新状态，不触发重渲染
<input id="my-input" defaultValue="" onChange={function(e) { _customState.userAnswer = e.target.value; }} />

// 需要清空时通过 DOM 操作
var inputEl = document.getElementById("my-input");
if (inputEl) { inputEl.value = ""; }
```

### 10. DateField 时间戳格式

保存日期字段时，值必须是 **时间戳（毫秒）**，不能是字符串：

```javascript
// ❌ 错误：字符串格式
dateField_xxx: '2024-01-15'

// ✅ 正确：时间戳格式
dateField_xxx: new Date().getTime()
```

### 11. 多端适配

宜搭自定义页面会在 PC 端和移动端同时展示，使用 `this.utils.isMobile()` 判断设备类型：

```javascript
const isMobile = this.utils.isMobile();
var styles = {
  container: { padding: isMobile ? '12px' : '16px', minHeight: '100vh' },
  card: { padding: isMobile ? '12px' : '16px', marginBottom: isMobile ? '8px' : '12px' },
};
```

### 12. 清除默认样式

宜搭自定义页面容器有默认 padding 和圆角，需要强制覆盖：

```javascript
var styles = {
  container: { padding: '0 16px', borderRadius: '0 !important', minHeight: '100vh' },
};
```

> 完整的响应式页面容器样式（含 isMobile 判断）见 [普通自定义页面样式实现适配](design-system.md) 的「页面容器」部分。

### 13. 性能优化

- 不要在每次 `onChange` 都调用 `setCustomState`，可直接写入 `_customState` 静默更新
- 只在需要触发重渲染时才调用 `forceUpdate`
- 在 `renderJsx` 顶部定义事件处理函数，避免每次渲染都创建新的内联函数

### 14. forceUpdate() 后的 DOM 渲染时序

`forceUpdate()` 调用 `this.setState()` 后，React 会在**下一个微任务**中重新渲染组件。这意味着 `forceUpdate()` 之后**同步代码中无法立即访问新渲染的 DOM 元素**。

**典型错误场景**：异步数据加载完成后设置 `loading=false` 并调用 `forceUpdate()`，然后立即尝试操作新出现的 DOM 元素（如 `document.getElementById('chart-container')`），此时 DOM 还未更新，返回 `null`。

```javascript
// ❌ 错误：forceUpdate 后立即操作新 DOM
_customState.loading = false;
self.forceUpdate();
var container = document.getElementById('my-chart');  // null！DOM 还没更新

// ✅ 正确：延迟一帧等待 React 完成 DOM 更新
_customState.loading = false;
self.forceUpdate();
setTimeout(function () {
  var container = document.getElementById('my-chart');  // 此时 DOM 已存在
  if (container) { /* 初始化图表等操作 */ }
}, 100);
```

> **适用场景**：ECharts 图表初始化、Canvas 绑定、第三方库挂载等需要操作 DOM 的场景。需要图表级渲染时序规则时，调用 `use_skill("yida-chart", "确认 ECharts 图表渲染时序")`。

### 15. 调试技巧

```javascript
// 打印当前状态到控制台
console.log('当前状态:', _customState);

// 弹窗提示（适合快速验证逻辑）
this.utils.toast({ title: '调试信息', type: 'info' });
```

### 16. iframe 嵌入表单 URL 规范

在自定义页面中通过 iframe 嵌入宜搭表单时，需使用正确的 URL 格式：

| 场景 | URL 格式 |
|------|----------|
| 表单提交页（默认隐藏导航） | `{base_url}/{appType}/submission/{formUuid}?isRenderNav=false` |
| 表单详情页（默认隐藏导航） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false` |
| 数据管理页（列表） | `{base_url}/{appType}/workbench/{formUuid}?iframe=true` |
| 数据管理页（指定视图） | `{base_url}/{appType}/workbench/{formUuid}?viewUuid={viewUuid}&iframe=true` |

```javascript
// ❌ 错误：formDetail 是表单详情页，不是数据列表
const wrongUrl = `${baseUrl}/${appType}/formDetail/${formUuid}`;

// ✅ 正确：workbench 是运行态数据管理页
const listUrl = `${baseUrl}/${appType}/workbench/${formUuid}?iframe=true`;
```

新增/提交/查看详情的入口不要在 PC 端直接 `window.open(submitUrl, '_blank')` 或 `window.open(detailUrl, '_blank')`。默认做法是统一封装 `FormOpenContainer`：PC 端打开右侧抽屉，抽屉默认半屏 `50vw`，抽屉内 iframe 指向隐藏导航提交页或详情页 URL；移动端空间有限，可以整页或新页打开原生表单页。提交成功或关闭后的刷新先绑定抽屉关闭事件重新查询列表；只有确认平台表单页会发送 postMessage 时，才接精确完成事件。

```javascript
// ✅ PC：FormOpenContainer 抽屉内嵌表单页；移动端：打开原生表单页
export function buildYidaFormUrl(type, appType, formUuid, formInstId) {
  if (type === 'detail') {
    if (!formInstId) {
      return '';
    }
    return '/' + appType + '/formDetail/' + formUuid + '?formInstId=' + encodeURIComponent(formInstId) + '&navConfig.layout=1180&isRenderNav=false';
  }
  return '/' + appType + '/submission/' + formUuid + '?isRenderNav=false';
}

export function openYidaForm(type, title, appType, formUuid, formInstId) {
  var url = this.buildYidaFormUrl(type, appType, formUuid, formInstId);
  if (!url) {
    this.utils.toast({ title: '未找到数据实例', type: 'warning' });
    return;
  }
  if (this.utils.isMobile()) {
    this.utils.openPage(url);
    return;
  }
  this.setCustomState({
    formOpenRequest: {
      type: type,
      title: title || '表单',
      iframeUrl: url,
      drawerWidth: '50vw',
    },
  });
  this.forceUpdate();
}

export function closeYidaForm() {
  this.setCustomState({ formOpenRequest: null });
  this.loadData();
  this.forceUpdate();
}
```

`renderJsx` 中根据 `formOpenRequest` 渲染右侧抽屉和 `<iframe src={state.formOpenRequest.iframeUrl}>`；PC 抽屉宽度使用 `state.formOpenRequest.drawerWidth || '50vw'`，提交页和详情页默认一致。iframe 必须带 `ref` 或 DOM 查询句柄，并在 `onload` 后调用 `installYidaGlobalThemeIntoFrame(CUSTOM_THEME_TOKENS, iframeElement)`，把当前主题同步到同源提交页/详情页子文档。关闭抽屉时清空 `formOpenRequest` 并重新查询列表。不要假设平台提供 `openDrawer` 内置方法，也不要为提交和详情各写一套 drawer 状态。

> `viewUuid` 可选，从宜搭「数据管理」→「报表视图」页面的 URL 中获取，不传则使用默认视图。

### 16.1 自定义主题注入到 iframe 窗口

平台 JSX 组件页面需要自定义色盘、隐藏导航沉浸页或 iframe 中承载原生表单时，复制 `yida-canvas-custom-page/references/theme-runtime-helpers.md` 的 Ordinary JSX helper。该 helper 会向当前文档、同源可访问的所有父级窗口文档，以及 `FormOpenContainer` 打开的同源提交页/详情页子 iframe 文档注入 `style#yida-global-theme`；跨域窗口静默降级。不要只向当前页面 `document.head` 写 style，否则嵌套 iframe 时父级壳层和抽屉内表单可能读不到同一套 token。

### 17. 下拉选项控制选项卡（Tabs）表格页显示/隐藏

当页面中存在选项卡组件包含多个表格页，需要根据下拉选择框的值动态控制特定表格页的显示或隐藏时，使用状态驱动的条件渲染实现。

**实现要点**：
- 用 `_customState.selectedType` 记录下拉选中值，`onChange` 时调用 `setCustomState` 触发重渲染
- 用 `_customState.activeTab` 记录当前激活的 Tab，切换时直接写入 `_customState` 并调用 `forceUpdate()`
- 下拉值变更后，若当前激活的 Tab 被隐藏，自动回退到第一个可见 Tab，避免空白页面
- Tab 内容区使用 `display: none` 而非条件渲染，保留 DOM 避免 iframe 重复加载
- 所有 Tab 均被隐藏时展示兜底提示，提升用户体验

### 18. 字段 ID 语义化别名约定

宜搭表单字段 ID 通常是随机字符串（如 `textField_k8j2n3m4`），直接在代码中使用可读性差、维护困难。**推荐在文件顶部统一定义字段别名常量**，在代码中始终使用别名引用字段 ID。

**约定规范**：

```javascript
// ✅ 推荐：在文件顶部统一定义字段别名
// 字段 ID 来自 openyida get-schema 的输出，或 .cache/<项目名>-schema.json
var FIELDS = {
  userName: 'textField_k8j2n3m4',       // 姓名
  category: 'selectField_a3b9c1d2',      // 类别
  applyDate: 'dateField_x7y2z5w1',       // 申请日期
  amount: 'numberField_p4q8r3s6',        // 金额
  status: 'radioField_m1n5o9p3',         // 审批状态
  remark: 'textareaField_v2w6x1y4',      // 备注
};

// ✅ 使用别名引用字段，代码清晰易读
// 注意：必须用 ES5 写法构建对象，禁止使用计算属性名 { [key]: val }
var searchCondition = {};
searchCondition[FIELDS.department] = '研发部';
searchCondition[FIELDS.status] = '待审批';
this.utils.yida.searchFormDatas({
  formUuid: 'FORM-XXX',
  searchFieldJson: JSON.stringify(searchCondition),
  currentPage: 1,
  pageSize: 20,
});

// ✅ 构建提交数据时使用别名
var formDataJson = {};
formDataJson[FIELDS.userName] = _customState.inputName;
formDataJson[FIELDS.department] = _customState.selectedDept;
formDataJson[FIELDS.amount] = _customState.inputAmount;
```

**❌ 避免的写法**：

```javascript
// ❌ 直接在业务逻辑中散落字段 ID，难以维护
this.utils.yida.searchFormDatas({
  formUuid: 'FORM-XXX',
  searchFieldJson: JSON.stringify({
    selectField_a3b9c1d2: '研发部',   // 这是什么字段？
    radioField_m1n5o9p3: '待审批',    // 完全看不懂
  }),
});
```

**AI 生成代码时的规则**：
1. 获取表单 Schema 后，**必须先在文件顶部定义 `FIELDS` 常量**，将所有用到的字段 ID 映射为语义化名称
2. 后续所有代码中**禁止直接写字段 ID 字符串**，统一通过 `FIELDS.xxx` 引用
3. `FIELDS` 的 key 使用 camelCase 命名，与字段的中文含义对应
