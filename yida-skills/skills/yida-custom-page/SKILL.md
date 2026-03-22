---
name: yida-custom-page
description: 宜搭自定义页面开发技能，包含宜搭表单 JS API 调用（增删改查/流程/工具类共 27 个）、React 16 JSX 组件开发规范、状态管理模式与编码约束。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - low-code
    - react
    - custom-page
---

# 宜搭自定义页面开发技能

## 概述

本技能提供在阿里宜搭低代码平台上开发**自定义页面**的完整能力，涵盖从编码到部署的全流程：

| 能力 | 说明 |
| --- | --- |
| **表单数据操作** | 通过宜搭前端 JS API（`this.utils.yida.*`）对表单数据进行增删改查 |
| **JSX 组件开发** | 编写 React 16 兼容的 JSX 代码，实现个性化定制页面 |
| **AI 能力集成** | 调用大模型 AI 接口（`/query/intelligent/txtFromAI.json`）实现智能文本生成 |
| **自动编译部署** | 通过工具链将源码编译、压缩，并自动合并到宜搭 Schema 中保存 |

## 何时使用

当以下场景发生时使用此技能：
- 用户需要开发自定义展示页面（非表单）
- 用户需要实现复杂的页面交互逻辑
- 用户需要调用宜搭 JS API 进行数据操作
- 已有自定义页面，需要编写或修改 JSX 代码

---

## 设计规范

> 宜搭自定义页面**只能使用内联 style 对象**，不能使用 CSS 文件、Tailwind、shadcn/ui 等外部样式方案。以下规范已针对此约束做了适配，直接用 JS 对象定义样式即可。

### 设计哲学

参考 `frontend-design`、`elegant-design`、`design-systems` 等业界主流设计 skill 的核心原则，结合宜搭约束，遵循以下优先级：

1. **清晰优于聪明**：用户永远不应该困惑下一步做什么
2. **一致优于新奇**：相同场景使用相同的视觉模式
3. **移动优先**：用 `this.utils.isMobile()` 判断设备，响应式适配
4. **有意图的留白**：充足的间距比堆砌元素更专业
5. **避免 AI 平庸美学**：不要千篇一律的灰白配色 + 无衬线字体 + 圆角卡片

---

### 色彩系统

在 `renderJsx` 顶部定义语义色彩对象，全页复用：

> **主色说明**：宜搭平台已内置品牌色 CSS 变量，主色相关 token 直接使用平台变量，无需硬编码色值，可随平台主题自动适配。

```javascript
export function renderJsx() {
  var colors = {
    primary:      'var(--color-brand1-6)',  // 主色（品牌蓝），用于主操作按钮、链接、选中态高亮
    primaryHover: 'var(--color-brand1-1)',  // 主色悬停态，鼠标 hover 时的按钮/链接颜色
    hover:        'var(--color-brand1-9)',  // 通用悬停背景色，用于列表行 hover、菜单项 hover
    active:       'var(--color-brand1-9)',  // 通用激活/按下态，点击时的视觉反馈
    disabled:     'var(--color-brand1-8)',  // 禁用态颜色，用于不可操作的按钮、控件
    primaryLight: 'var(--color-brand1-2)',  // 主色浅背景，用于选中行底色、标签高亮背景    

    // 语义色
    success:        '#52C41A',
    successLight:   '#F6FFED',
    warning:        '#FAAD14',
    warningLight:   '#FFFBE6',
    error:          '#FF4D4F',
    errorLight:     '#FFF2F0',
    info:           '#1677FF',
    infoLight:      '#E6F4FF',

    // 中性色（从深到浅）
    text:           '#1D2129',  // 主文字
    textSecondary:  '#4E5969',  // 次要文字
    textTertiary:   '#86909C',  // 辅助文字、placeholder
    textDisabled:   '#C9CDD4',  // 禁用状态
    border:         '#E5E6EB',  // 边框
    borderLight:    '#F2F3F5',  // 浅边框、分割线
    bg:             '#F7F8FA',  // 页面背景
    bgCard:         '#FFFFFF',  // 卡片背景
  };
  // ...
}
```

> 色彩选取参考阿里 Arco Design 色板，与宜搭平台视觉风格保持一致。

---

### 圆角系统

| 值 | 使用场景 |
|----|---------|
| `6px`  | 小型 Badge、标签 |
| `8px`  | 输入框、开关控件、小头像（< 32px） |
| `12px` | 下拉菜单背景、小型卡片、菜单项、中头像（32px–48px） |
| `16px` | 下拉菜单容器、Tooltip、大头像（> 48px） |
| `24px` | 主要卡片、对话框、按钮、容器区域（强制统一） |

---

### 字体规范

```javascript
var typography = {
  // 字号（遵循 4px 倍数）
  fontSize: {
    xs:   '12px',  // 辅助说明、标签
    sm:   '13px',  // 次要内容
    base: '14px',  // 正文（宜搭默认）
    md:   '15px',  // 略强调
    lg:   '16px',  // 小标题
    xl:   '18px',  // 标题
    xxl:  '20px',  // 大标题
    h1:   '24px',  // 页面主标题
  },
  // 字重
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  // 行高
  lineHeight: {
    tight:  1.4,
    normal: 1.6,
    loose:  1.8,
  },
};
```

---

### 间距系统

以 **8px** 为基准单位，所有间距取其倍数：

```javascript
var spacing = {
  xs:   '4px',   // 紧凑元素内间距
  sm:   '8px',   // 小间距
  md:   '12px',  // 中间距
  lg:   '16px',  // 常规间距（卡片 padding）
  xl:   '20px',
  xxl:  '24px',  // 区块间距
  xxxl: '32px',  // 大区块间距
  page: '16px',  // 页面左右 padding（移动端）
};
```

---

### 常用组件样式模板

#### 页面容器

```javascript
var styles = {
  page: {
    minHeight: '100vh',
    background: '#F7F8FA',
    padding: isMobile ? '12px' : '16px 24px',
    borderRadius: '0 !important',  // 清除宜搭默认圆角
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
    fontSize: '14px',
    color: '#1D2129',
    boxSizing: 'border-box',
  },
};
```

#### 卡片

```javascript
card: {
  background: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #E5E6EB',
  padding: isMobile ? '12px' : '16px',
  marginBottom: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
},
cardTitle: {
  fontSize: '15px',
  fontWeight: 600,
  color: '#1D2129',
  marginBottom: '12px',
  paddingBottom: '10px',
  borderBottom: '1px solid #F2F3F5',
},
```

#### 按钮

```javascript
// 主按钮
btnPrimary: {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  height: '32px',
  background: '#1677FF',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
},
// 次要按钮
btnDefault: {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  height: '32px',
  background: '#FFFFFF',
  color: '#1D2129',
  border: '1px solid #E5E6EB',
  borderRadius: '6px',
  fontSize: '14px',
  cursor: 'pointer',
  outline: 'none',
},
// 危险按钮
btnDanger: {
  background: '#FF4D4F',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  padding: '0 16px',
  height: '32px',
  cursor: 'pointer',
},
```

#### 输入框

```javascript
input: {
  width: '100%',
  height: '32px',
  padding: '0 12px',
  border: '1px solid #E5E6EB',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#1D2129',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
},
```

#### 标签/徽章

```javascript
// 状态标签
tag: function(type) {
  var colorMap = {
    success: { color: '#52C41A', bg: '#F6FFED', border: '#B7EB8F' },
    warning: { color: '#FAAD14', bg: '#FFFBE6', border: '#FFE58F' },
    error:   { color: '#FF4D4F', bg: '#FFF2F0', border: '#FFCCC7' },
    info:    { color: '#1677FF', bg: '#E6F4FF', border: '#91CAFF' },
    default: { color: '#4E5969', bg: '#F2F3F5', border: '#E5E6EB' },
  };
  var c = colorMap[type] || colorMap.default;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: c.color,
    background: c.bg,
    border: '1px solid ' + c.border,
  };
},
```

#### 数据列表行

```javascript
listItem: {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #F2F3F5',
},
listLabel: {
  width: '100px',
  flexShrink: 0,
  fontSize: '13px',
  color: '#86909C',
},
listValue: {
  flex: 1,
  fontSize: '14px',
  color: '#1D2129',
},
```

#### 空状态

```javascript
empty: {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 16px',
  color: '#C9CDD4',
  fontSize: '14px',
},
```

---

### 设计反模式（禁止）

> 参考 `frontend-design` skill 的 anti-patterns 清单，结合宜搭场景整理：

❌ **禁止使用纯灰白 + 无边框的平淡布局**，至少加 `boxShadow` 或 `border` 区分层次  
❌ **禁止所有文字都用同一颜色**，主文字/次要文字/辅助文字应有明显区分  
❌ **禁止按钮没有视觉反馈**，hover/active 状态要有颜色变化  
❌ **禁止间距随意**，所有 margin/padding 必须是 4px 的倍数  
❌ **禁止卡片没有圆角**，统一使用 `borderRadius: '8px'`  
❌ **禁止忽略空状态**，列表/数据为空时必须有友好提示  
❌ **禁止忽略加载状态**，异步操作必须有 loading 反馈  
❌ **禁止移动端不适配**，所有页面必须用 `isMobile` 做响应式处理  

---

## 快速开始

### 前置条件

- Node.js 16+（用于 Babel 编译和发布）
- Python 3.12+ + `playwright`（用于登录态管理）
- 首次使用需安装依赖：

```bash
# openyida 已包含所有依赖，无需单独安装
pip install playwright && playwright install chromium
```

### 编译源码

```bash
node scripts/babel-transform/transform.js <源文件路径>
```

**编译流程**：

```
源文件(.js) → @ali/vu-babel-transform (Babel 转换) → UglifyJS (压缩) → <name>.compile.js
```

### 部署到宜搭

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

**部署流程**：

```
编译源码（Babel + UglifyJS） → 代码动态构建 Schema JSON（填入 source/compiled）
→ 调用 yida-login 获取登录态（Cookie 持久化） → 调用 saveFormSchema 接口保存
```

**参数说明**：

| 参数 | 说明 | 示例 |
| --- | --- | --- |
| `appType` | 应用 ID | `APP_XXX` |
| `formUuid` | 表单 ID | `FORM-XXX` |
| `源文件路径` | 源码文件路径 | `pages/src/xxx.js` |

> `baseUrl` 无需手动传入，`openyida` 会自动获取登录态并从中读取 `base_url`。

---

## 开发规范

> **以下规范是编写宜搭自定义页面代码的核心约束，必须严格遵守。**

### 运行环境与约束

宜搭自定义页面的 JSX 组件本质上是 **React 类组件中的 render 方法**，而非独立的 React 组件。因此存在以下关键约束：

| 约束 | 说明 |
| --- | --- |
| **React 版本** | 必须兼容 **React 16**，禁止使用 Hooks（`useState`、`useEffect` 等） |
| **单文件** | 所有代码写在一个文件中（如 `index.js`）|
| **三方包引入** | 禁止使用 `import/require` 语法，如需使用第三方库，必须通过 `this.utils.loadScript` 加载 CDN 脚本，参考 [yida-api.md](../../reference/yida-api.md) 的「工具类 API」章节。|
| **函数导出格式** | 使用 `export function xxx() {}` 格式导出函数 |
| **样式** | 所有 css 必须写在 renderJsx 的方法中，通过 style 的方式引入 |
| **`this` 上下文** | 所有导出函数中的 `this` 指向宜搭页面的 React 类实例 |
| **禁止使用 `this.setState` 管理业务状态** | `this.setState` 已被覆盖，仅用于 `forceUpdate`（通过更新 `timestamp`） |
| **JavaScript 版本** | 使用 ES2015 (ES6) 语法，不能高于 ES2015 版本 |
| **必须定义 renderJsx 函数** | renderJsx 是宜搭自定义页面核心渲染函数，也是入口函数，必须严格定义，不要改为其他名称 |

### 文件结构

**一个完整的宜搭自定义页面源文件必须包含：**
- `_customState` 变量
- getCustomState 函数
- setCustomState 函数
- forceUpdate 函数
- didMount 函数
- didUnmount 函数
- renderJsx 函数

> ⚠️ **关键约束：`renderJsx` 的每个 `return` 分支都必须包含 `<div style={{ display: 'none' }}>{this.state.timestamp}</div>`**，否则 `forceUpdate` 调用 `this.setState({ timestamp })` 后，React 无法检测到输出变化，`renderJsx` 不会被重新执行，页面将无法更新。这是宜搭渲染引擎触发重渲染的核心机制。

以下是一个完整自定义页面示例，包含状态管理、生命周期钩子、渲染函数

```jsx
// ============================================================
// 状态管理
// ============================================================

const _customState = {
  // 在此定义所有业务状态的初始值
  count: 0,
  loading: false,
};

/**
 * 获取状态
 * @param {string} [key] - 传入 key 返回单个值，不传返回全部状态的浅拷贝
 */
export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return { ..._customState };
}

/**
 * 设置状态（合并更新，自动触发重新渲染）
 * @param {Object} newState - 需要更新的状态键值对
 */
export function setCustomState(newState) {
  Object.keys(newState).forEach(function(key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

/**
 * 强制重新渲染（通过更新 timestamp 触发 React 重渲染）
 */
export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ============================================================
// 生命周期
// ============================================================

/**
 * 页面加载完成时调用
 * 用于：初始化数据、启动定时器、绑定事件等
 */
export function didMount() {
  // 初始化逻辑
}

/**
 * 页面卸载时调用
 * 用于：清理定时器、解绑事件、释放资源等
 */
export function didUnmount() {
  // 清理逻辑
}

export function handleSubmit(e) {
  this.setCustomState({ submitted: true });
  this.utils.toast({ title: '提交成功', type: 'success' });
}
// ============================================================
// 渲染
// ============================================================

/**
 * 页面渲染函数（等同于 React 类组件的 render 方法）
 * 注意：必须包含隐藏的 timestamp div 以支持 forceUpdate 机制
 */
export function renderJsx() {
  const { timestamp } = this.state;

  return (
    <div>
      {/* 必须保留：用于触发重新渲染 */}
      <div style={{ display: "none" }}>{timestamp}</div>

      {/* 页面内容写在这里 */}
      <div onClick={(e) => {this.handleSubmit(e)}>提交</div>
    </div>
  );
}
```

### 状态管理使用方式

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

### 生命周期钩子

| 钩子函数 | 触发时机 | 典型用途 |
| --- | --- | --- |
| `didMount()` | 页面 DOM 加载渲染完毕 | 初始化数据加载、启动定时器、绑定事件 |
| `didUnmount()` | 页面节点从 DOM 移除 | 清理 `setInterval` / `setTimeout`、解绑事件 |

### 全局变量

| 变量 | 类型 | 说明 |
| --- | --- | --- |
| `window.g_config._csrf_token` | `String` | CSRF Token，调用需认证的接口（如 AI 接口、Schema 保存）时必须携带 |
| `window.loginUser.userId` | `String` | 当前登录用户的工号 |
| `window.loginUser.userName` | `String` | 当前登录用户的姓名 |
| `this.state.urlParams` | `Object` | 页面 URL 中的查询参数 |

### 编码注意事项

1. **自定义方法必须用 `export function` 定义**：凡是需要在方法内部使用 `this`（包括 `this.utils.yida.*`、`this.setCustomState` 等）的自定义方法，**必须且只能**使用 `export function 方法名() {}` 的形式定义，调用时使用 `this.方法名()`。**禁止**使用 `const fn = () => {}`、`const fn = function() {}` 等形式定义需要访问 `this` 的方法，这些形式无法被宜搭运行时正确绑定 `this`：
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
2. **【严格禁止】事件绑定必须使用箭头函数包裹**：在 `renderJsx` 中绑定任何事件处理器（`onClick`、`onChange`、`onSubmit` 等）时，**必须且只能**使用箭头函数 `(e) => { this.方法名(e) }` 的形式，**严禁**直接写 `this.方法名` 作为事件处理器，否则 `this` 会丢失导致运行时报错：

   ```javascript
   export function handleSubmit(e) {
     this.setCustomState({ submitted: true });
     this.utils.toast({ title: '提交成功', type: 'success' });
   }

   // ✅ 正确：箭头函数包裹，this 正确捕获
   export function renderJsx() {
     return <button onClick={(e) => { this.handleSubmit(e); }}>提交</button>;
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

   > **生成代码时的自检清单**：检查 `renderJsx` 中所有 `onClick`、`onChange`、`onSubmit` 等事件属性，确保每一个都是 `(e) => { this.xxx(e) }` 形式，不存在任何 `onClick={this.xxx}` 的写法。

3. **输入法组合输入处理**：使用 `_isComposing` 标记配合 `compositionstart` / `compositionend` 事件，正确处理中文输入法的组合输入状态，避免输入过程中触发提交
4. **定时器清理**：在 `didUnmount` 中必须清理所有通过 `setInterval` / `setTimeout` 创建的定时器，防止内存泄漏
5. **错误处理**：所有 API 调用（`this.utils.yida.*`、`fetch`）必须使用 `.catch()` 处理异常，并通过 `this.utils.toast({ title: message, type: 'error' })` 向用户展示错误提示
6. **样式方式**：所有样式通过 JavaScript 对象定义（内联样式），在 `renderJsx` 中通过 `style` 属性应用，不使用外部 CSS 文件
7. **异步操作**：可以使用 `async/await` 语法，Babel 编译会自动转换为 ES5 兼容代码
8. **pageSize 上限**：调用 `searchFormDatas`、`searchFormDataIds`、`getProcessInstances`、`getProcessInstanceIds` 等分页接口时，`pageSize` 最大值为 **100**，超过会导致接口报错。禁止将 `pageSize` 设置为超过 100 的值，推荐使用 `10`～`100` 之间的合理值。
9. **输入框使用非受控组件**：在宜搭环境中，`<input>` 的 `value` 属性绑定状态后会触发重渲染导致输入异常。**正确做法**：使用 `defaultValue`，在 `onChange` 中更新 `_customState` 而不调用 `setCustomState`：
   ```javascript
   // ❌ 错误：受控组件，每次输入都触发重渲染导致无法输入
   <input value={userAnswer} onChange={function(e) { this.setCustomState({ userAnswer: e.target.value }); }} />

   // ✅ 正确：非受控组件，仅静默更新状态，不触发重渲染
   <input id="my-input" defaultValue="" onChange={function(e) { _customState.userAnswer = e.target.value; }} />

   // 需要清空时通过 DOM 操作
   var inputEl = document.getElementById("my-input");
   if (inputEl) { inputEl.value = ""; }
   ```

10. **DateField 时间戳格式**：保存日期字段时，值必须是 **时间戳（毫秒）**，不能是字符串：
    ```javascript
    // ❌ 错误：字符串格式
    dateField_xxx: '2024-01-15'

    // ✅ 正确：时间戳格式
    dateField_xxx: new Date().getTime()
    ```

11. **多端适配**：宜搭自定义页面会在 PC 端和移动端同时展示，使用 `this.utils.isMobile()` 判断设备类型：
    ```javascript
    const isMobile = this.utils.isMobile();
    var styles = {
      container: { padding: isMobile ? '12px' : '16px', minHeight: '100vh' },
      card: { padding: isMobile ? '12px' : '16px', marginBottom: isMobile ? '8px' : '12px' },
    };
    ```

12. **清除默认样式**：宜搭自定义页面容器有默认 padding 和圆角，需要强制覆盖：
    ```javascript
    var styles = {
      container: { padding: '0 16px', borderRadius: '0 !important', minHeight: '100vh' },
    };
    ```

13. **性能优化**：
    - 不要在每次 `onChange` 都调用 `setCustomState`，可直接写入 `_customState` 静默更新
    - 只在需要触发重渲染时才调用 `forceUpdate`
    - 在 `renderJsx` 顶部定义事件处理函数，避免每次渲染都创建新的内联函数

14. **调试技巧**：
    ```javascript
    // 打印当前状态到控制台
    console.log('当前状态:', _customState);

    // 弹窗提示（适合快速验证逻辑）
    this.utils.toast({ title: '调试信息', type: 'info' });
    ```

15. **iframe 嵌入表单 URL 规范**：在自定义页面中通过 iframe 嵌入宜搭表单时，需使用正确的 URL 格式：

    | 场景 | URL 格式 |
    |------|----------|
    | 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
    | 数据管理页（列表） | `{base_url}/{appType}/workbench/{formUuid}?iframe=true` |
    | 数据管理页（指定视图） | `{base_url}/{appType}/workbench/{formUuid}?viewUuid={viewUuid}&iframe=true` |

    ```javascript
    // ❌ 错误：formDetail 是表单详情页，不是数据列表
    const wrongUrl = `${baseUrl}/${appType}/formDetail/${formUuid}`;

    // ✅ 正确：workbench 是运行态数据管理页
    const listUrl = `${baseUrl}/${appType}/workbench/${formUuid}?iframe=true`;
    ```

    > `viewUuid` 可选，从宜搭「数据管理」→「报表视图」页面的 URL 中获取，不传则使用默认视图。

16. **下拉选项控制选项卡（Tabs）表格页显示/隐藏**：当页面中存在选项卡组件包含多个表格页，需要根据下拉选择框的值动态控制特定表格页的显示或隐藏时，使用状态驱动的条件渲染实现。

    **实现要点**：
    - 用 `_customState.selectedType` 记录下拉选中值，`onChange` 时调用 `setCustomState` 触发重渲染
    - 用 `_customState.activeTab` 记录当前激活的 Tab，切换时直接写入 `_customState` 并调用 `forceUpdate()`
    - 下拉值变更后，若当前激活的 Tab 被隐藏，自动回退到第一个可见 Tab，避免空白页面
    - Tab 内容区使用 `display: none` 而非条件渲染，保留 DOM 避免 iframe 重复加载
    - 所有 Tab 均被隐藏时展示兜底提示，提升用户体验

    完整示例代码见：[`examples/tabs-visibility-control.js`](./examples/tabs-visibility-control.js)

### 17. 字段 ID 语义化别名约定

宜搭表单字段 ID 通常是随机字符串（如 `textField_k8j2n3m4`），直接在代码中使用可读性差、维护困难。**推荐在文件顶部统一定义字段别名常量**，在代码中始终使用别名引用字段 ID。

**约定规范**：

```javascript
// ✅ 推荐：在文件顶部统一定义字段别名
// 字段 ID 来自 openyida get-schema 的输出，或 .cache/<项目名>-schema.json
var FIELDS = {
  userName: 'textField_k8j2n3m4',       // 姓名
  department: 'selectField_a3b9c1d2',    // 部门
  applyDate: 'dateField_x7y2z5w1',       // 申请日期
  amount: 'numberField_p4q8r3s6',        // 金额
  status: 'radioField_m1n5o9p3',         // 审批状态
  remark: 'textareaField_v2w6x1y4',      // 备注
};

// ✅ 使用别名引用字段，代码清晰易读
this.utils.yida.searchFormDatas({
  formUuid: 'FORM-XXX',
  searchFieldJson: JSON.stringify({
    [FIELDS.department]: '研发部',
    [FIELDS.status]: '待审批',
  }),
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

---

## API 参考

### 表单数据操作

通过 `this.utils.yida.<方法名>(params)` 调用，所有接口返回 Promise。

| 方法 | 说明 | 必填参数 |
| --- | --- | --- |
| `saveFormData` | 新建表单实例 | `formUuid`, `appType`, `formDataJson` |
| `updateFormData` | 更新表单实例 | `formInstId`, `updateFormDataJson` |
| `deleteFormData` | 删除表单实例 | `formUuid` |
| `getFormDataById` | 根据实例 ID 查询详情 | `formInstId` |
| `searchFormDatas` | 按条件搜索表单实例详情列表 | `formUuid` |
| `searchFormDataIds` | 按条件搜索表单实例 ID 列表 | `formUuid` |
| `getFormComponentDefinationList` | 获取表单定义 | `formUuid` |

完整参数说明和调用示例请参考 [yida-api.md](../../reference/yida-api.md) 的「表单数据操作」章节。

### 流程操作

| 方法 | 说明 | 必填参数 |
| --- | --- | --- |
| `startProcessInstance` | 发起流程 | `formUuid`, `processCode`, `formDataJson` |
| `updateProcessInstance` | 更新流程实例 | `processInstanceId`, `updateFormDataJson` |
| `deleteProcessInstance` | 删除流程实例 | `processInstanceId` |
| `getProcessInstanceById` | 根据实例 ID 查询流程详情 | `processInstanceId` |
| `getProcessInstances` | 按条件搜索流程实例详情列表 | — |
| `getProcessInstanceIds` | 按条件搜索流程实例 ID 列表 | — |

### 表单设计类 API

以下接口用于表单页面的创建和配置，通过 HTTP 请求调用：

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `saveFormSchemaInfo` | 创建空白表单 | `POST /dingtalk/web/{appType}/query/formdesign/saveFormSchemaInfo.json` |
| `getFormSchema` | 获取表单 Schema | `GET /alibaba/web/{appType}/_view/query/formdesign/getFormSchema.json` |
| `saveFormSchema` | 保存表单 Schema | `POST /dingtalk/web/{appType}/_view/query/formdesign/saveFormSchema.json` |
| `updateFormConfig` | 更新表单配置 | `POST /dingtalk/web/{appType}/query/formdesign/updateFormConfig.json` |

完整参数说明请参考 [yida-api.md](../../reference/yida-api.md) 的「表单设计类 API」章节。

### 大模型 AI 接口

以下接口用于调用大模型 AI 文本生成能力：

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `txtFromAI` | AI 文本生成 | `POST /query/intelligent/txtFromAI.json` |

**主要参数**：`_csrf_token`（CSRF 令牌）、`prompt`（提示词）、`skill`（技能类型，如 `ToText`）、`maxTokens`（最大返回 token 数）

完整参数说明和示例请参考 [model-api.md](../../reference/model-api.md)。

---

### 工具类 API 速查

以下工具函数通过 `this.utils.<方法名>()` 调用，无需 `yida` 命名空间：

| 方法 | 用途 | 典型场景 |
| --- | --- | --- |
| `toast` | 轻提示 | 操作成功/失败提示、loading 状态 |
| `dialog` | 对话框 | 确认操作、复杂内容展示 |
| `formatter` | 格式化 | 日期、金额、手机号格式化 |
| `getDateTimeRange` | 获取时间范围 | 按日/月/周筛选数据 |
| `getLoginUserId` / `getLoginUserName` | 获取当前用户 | 记录操作人、数据权限控制 |
| `getLocale` | 获取语言环境 | 多语言适配 |
| `isMobile` | 判断移动端 | 响应式布局适配 |
| `isSubmissionPage` | 判断是否提交页面 | 页面逻辑区分 |
| `isViewPage` | 判断是否查看页面 | 页面逻辑区分 |
| `openPage` | 打开新页面 | 页面跳转、外链打开 |
| `router.push` | 页面路由跳转工具 | 页面路由跳转、避免新开页面 |
| `previewImage` | 图片预览 | 图片查看、多图轮播 |
| `loadScript` | 动态加载脚本 | 引入第三方库（如二维码生成） |

完整参数说明和示例请参考 [yida-api.md](../../reference/yida-api.md) 的「工具类 API」章节。

## 工具链

| Skill | 说明 | 用法 |
| --- | --- | --- |
| **yida-login** | 登录态管理（Cookie 持久化 + 扫码登录） | `openyida login` |
| **yida-publish-page** | 编译源码 + 构建 Schema + 发布到宜搭 | `openyida publish <源文件路径> <appType> <formUuid>` |
| **yida-page-config** | 页面配置（URL 验证、公开访问/分享配置） | 详见 `yida-page-config` 技能文档 |

### 编译 + 发布（一键完成）

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

**处理流程**：
1. 通过 `@ali/vu-babel-transform` 将 JSX 转换为 ES5 + UglifyJS 压缩
2. 通过代码动态构建完整的 Schema JSON，将 `source` 和 `compiled` 填入 `actions.module`
3. 调用 `yida-login` 获取登录态（Cookie 持久化，首次需扫码登录）
4. 通过 HTTP POST 调用 `saveFormSchema` 接口保存 Schema

### 仅编译（不发布）

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

输入 JSX 源文件，输出编译压缩后的 `<name>.compile.js`（与源文件同目录）。

---
## 素材资源指南

在自定义页面开发中，经常需要使用图片、音乐/音效、Icon 等素材资源。以下是推荐的素材获取方案，确保素材来源稳定、合规、风格一致。

### 图片素材

| 素材库 | API | 授权方式 | 推荐场景 |
| --- | --- | --- | --- |
| [Unsplash](https://unsplash.com) | ✅ | 免费商用，无需署名 | 高质量背景图、Banner、配图 |
| [Pexels](https://pexels.com) | ✅ | 免费商用，无需署名 | 人物、场景、商务类配图 |
| [Pixabay](https://pixabay.com) | ✅ | 免费商用，无需署名 | 插画、矢量图、通用配图 |
| [Lorem Picsum](https://picsum.photos) | ✅ | 免费 | 开发阶段占位图 |
| [Wikimedia Commons](https://commons.wikimedia.org) | ⚠️ | 授权类型多样，需按条目核对 | 知识类/历史类配图 |

### 音乐/音效素材

| 素材库 | 授权方式 | 署名要求 | 推荐场景 |
| --- | --- | --- | --- |
| [Pixabay Music](https://pixabay.com/music/) | 免费商用 | 无需 | 背景音乐、氛围音效 |
| [Mixkit](https://mixkit.co/free-sound-effects/) | 免费商用 | 无需 | 短音效、UI 交互音 |
| [Freesound](https://freesound.org) | CC0 / CC BY | ⚠️ 部分需署名 | 按钮音效、提示音、环境音 |
| [Incompetech](https://incompetech.com/music/) | CC BY 4.0 | ⚠️ 需署名 Kevin MacLeod | 游戏、活动页背景音乐 |
| [Free Music Archive](https://freemusicarchive.org) | 多种 CC | ⚠️ 需按条目核对 | 曲库大，适合按分类批量拉取 |

- 优先使用 Pixabay Music 和 Mixkit（无署名要求）
- 使用 CC BY 素材时，需在页面底部添加署名，格式：`Music: "曲名" by 作者 — Licensed under CC BY 4.0`
- 音频文件建议上传到 CDN，移动端使用压缩后的 MP3 格式

### Icon 素材

> 优先使用 `this.utils.loadStyleSheet(url)` 加载 CSS 图标库，详见 [yida-api.md](../../reference/yida-api.md) 的「loadStyleSheet」章节。

| 图标库 | 授权方式 | 推荐场景 |
| --- | --- | --- |
| [iconfont（阿里）](https://www.iconfont.cn) | 免费 | **首选**，国内访问最稳定，支持自定义图标集 |
| [Remix Icon](https://remixicon.com) | Apache 2.0 | 开源免费，风格现代，无需注册 |
| [Font Awesome](https://fontawesome.com) | MIT（免费版） | 覆盖面广，通用 UI 图标 |
| [Material Icons](https://fonts.google.com/icons) | Apache 2.0 | 数量大，适合中后台工具类产品 |
| [Bootstrap Icons](https://icons.getbootstrap.com) | MIT | 轻量，SVG 为主 |
| [Heroicons](https://heroicons.com) | MIT | 线性/实心两套，现代极简风 |

**SVG 内联**（少量图标，无外部依赖）：

```javascript
function renderIcon(iconPath, size, color) {
  return (
    <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2">
      <path d={iconPath} />
    </svg>
  );
}
```

### 素材使用通用建议

**稳定性**
- 生产环境的图片/音频应上传到自有 CDN，避免第三方外链失效
- 图片/音频优先使用有官方 API 的站点（Unsplash / Pexels / Pixabay / Freesound），避免爬虫方式
- 同一关键词可并行查 2-3 个库，失败自动切换；对外链下载做本地缓存

**合规性**
- 优先使用无署名要求的素材库（Unsplash、Pexels、Pixabay、Mixkit）
- 使用 CC BY 素材时必须添加署名，至少记录以下字段：`source`（来源站点）、`author`（作者）、`license`（许可证类型）、`requiredAttribution`（是否需要署名）、`sourceUrl`（原始链接）
- Wikimedia Commons / Freesound / FMA 等站点授权类型多样，务必按条目核对 License

**一致性**
- 同一项目中统一使用一个图标库，避免混用多个图标库导致风格不一致
- 准备「语义→图标名」映射表（如 `search → ri-search-line`、`settings → ri-settings-3-line`），避免随机挑选

**性能**
- 图片使用合适尺寸（避免加载 4K 大图）；音频使用压缩后的 MP3 格式
- 图标优先使用 CDN 字体方案（iconfont / Remix Icon），少量图标可用 SVG 内联

> ⚠️ **安全风险警告：禁止引用未知或不可信的 CDN 地址**
>
> 引用来源不明的第三方 CDN 链接（如随意从搜索结果或论坛复制的 JS/CSS 链接）存在严重安全隐患：
>
> - **网络劫持风险**：不可信 CDN 可能被中间人攻击，注入恶意脚本，导致用户数据泄露或页面被篡改
> - **供应链攻击**：第三方 CDN 资源随时可能被替换为恶意内容，且难以察觉（2024年曾发生木马化 jQuery 通过知名免费 CDN 传播的真实案例）
> - **服务不稳定**：免费 CDN 可能随时宕机或 SSL 证书过期，导致页面资源加载失败
>
> **安全规范：**
> - ✅ 仅使用以下经过验证的可信 CDN：
>   - `cdnjs.cloudflare.com` — Cloudflare 官方维护，支持 SRI 完整性校验，国内可访问，**首选**
>   - `unpkg.com` — npm 官方镜像，适合加载 npm 包资源，国内可访问
>   - 阿里云 CDN（`alicdn.com`）— 国内访问最稳定，适合生产环境
> - ✅ 引用第三方 CDN 资源时，建议添加 `integrity` 属性（SRI 校验），防止资源被篡改
> - ❌ **禁止使用 `cdn.jsdelivr.net`**：2024年发生过木马化 jQuery 供应链攻击事件，且有 SSL 证书过期记录，存在安全风险
> - ❌ **禁止使用 `fonts.googleapis.com`**：国内大陆无法访问，字体资源需下载到本地后上传自有 CDN
> - ❌ 禁止引用来源不明的 CDN 地址，即使该链接当前可以正常访问
> - ❌ 禁止直接使用从搜索引擎、论坛、博客中复制的 CDN 链接，需先核实来源

---