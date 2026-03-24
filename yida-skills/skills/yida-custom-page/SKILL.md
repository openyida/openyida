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

> 完整的设计规范（色彩系统、圆角、字体、间距、组件样式、反模式等），详见 [`reference/design-system.md`](reference/design-system.md)。
> **编写自定义页面前建议先阅读设计规范。**

### 核心设计原则速查

| 要素 | 规范 |
|------|------|
| **页面背景** | `#f5f5f5`（浅灰），避免纯白 |
| **卡片** | 白底 + `border-radius: 8px` + `box-shadow: 0 1px 4px rgba(0,0,0,0.08)` |
| **主色** | `#1677FF`（宜搭蓝） |
| **字体** | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| **间距** | 基础单位 `8px`，常用 `8/12/16/20/24/32px` |
| **禁止** | 外部 CSS、React Hooks、class 组件、内联 `<style>` 标签 |



## ⚠️ JSX 编译错误自查清单（发布前必读）

> **遇到 JSX 编译错误时，按以下顺序逐项排查**，90% 的编译错误都由以下原因引起：

### 🔴 第 1 优先级：禁止使用的语法（绝对红线）

| 语法 | 错误代码 | 正确代码 | 说明 |
|------|---------|---------|------|
| ❌ 类属性声明 | `class App { state = {} }` | 必须使用 `_customState` 全局变量 | Babel 编译不过 |
| ❌ Class Fields 语法 | `count = 0` | `var count = 0` | React 16 不支持 |
| ❌ `import` 语句 | `import React from 'react'` | 禁止使用 import | 三方包引入需用 `loadScript` |
| ❌ `export default` | `export default function` | 使用 `export function` | export default 编译后无法正确挂载 |
| ❌ Optional Chaining | `obj?.prop` | `obj && obj.prop` | 部分版本 Babel 不支持 |
| ❌ Nullish Coalescing | `a ?? b` | `a !== null ? a : b` | 同上 |
| ❌ 装饰器语法 | `@decorator class X` | 禁止使用装饰器 | 需要额外 Babel 插件 |

### 🟡 第 2 优先级：极易出错的地方

#### 2.1 事件绑定（最容易出错）

```javascript
// ❌ 错误：直接传方法引用，this 丢失
<button onClick={this.handleClick}>点击</button>

// ❌ 错误：使用 .bind()，不符合规范
<button onClick={function() { this.handleClick(); }.bind(this)}>点击</button>

// ✅ 正确：箭头函数包裹
<button onClick={(e) => { this.handleClick(e); }}>点击</button>

// ✅ 正确：如果是简单调用（仅修改状态）
<button onClick={() => { this.setCustomState({ count: 1 }); }}>点击</button>
```

#### 2.2 JSX 中的 style 属性

```javascript
// ❌ 错误：CSS 属性名使用 kebab-case
<div style={{ "background-color": "red" }}></div>

// ❌ 错误：数字值未加引号
<div style={{ width: 100 }}></div>  // 会变成 "100px" 但某些情况有问题

// ✅ 正确：JS 写法（camelCase + 字符串值）
<div style={{ backgroundColor: 'red', width: '100%' }}></div>

// ✅ 正确：带单位用字符串
<div style={{ padding: '12px', marginTop: '8px' }}></div>
```

#### 2.3 箭头函数 vs 普通函数

```javascript
// ❌ 错误：在需要 this 的地方用箭头函数
const handleClick = () => {
  this.utils.toast({ title: 'hi' });  // this 丢失
};

// ✅ 正确：需要 this 的方法必须用 export function
export function handleClick() {
  this.utils.toast({ title: 'hi' });
}
```

### 🟢 第 3 优先级：常见小问题

#### 3.1 标签必须闭合

```javascript
// ❌ 错误：自闭合标签缺少斜线
<input type="text">
<br>

// ✅ 正确
<input type="text" />
<br />
```

#### 3.2 className 而非 class

```javascript
// ❌ 错误
<div class="container">...</div>

// ✅ 正确
<div className="container">...</div>
```

#### 3.3 注释语法

```javascript
// ✅ JSX 内只能使用这种注释
<div>
  {/* 这是注释 */}
  <span>内容</span>
</div>

// ❌ 不要用 HTML 注释（可能编译出错）
// <div>...</div>
```

#### 3.4 三元表达式陷阱

```javascript
// ❌ 错误：三元表达式返回 null/undefined 可能导致白屏
{condition && null}  // 某些情况下编译有问题

// ✅ 正确：确保返回有效 JSX
{condition && <div>内容</div>}

// ✅ 更好：显式处理
{condition ? <div>内容</div> : <span />}
```

### 📋 快速验证脚本

发布前可以用以下命令预检查源码语法：

```bash
# 仅编译不发布，检查是否有语法错误
node -e "
const fs = require('fs');
const babel = require('@babel/standalone');
const source = fs.readFileSync('pages/src/demo.js', 'utf-8');
try {
  babel.transform(source, { presets: ['react', ['env', { targets: { browsers: ['ie >= 11'] } }] ] });
  console.log('✅ 语法检查通过');
} catch(e) {
  console.error('❌ 编译错误:', e.message);
  if (e.loc) console.error('位置:', e.loc.line + '行', e.loc.column + '列');
  process.exit(1);
}
"
```

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
# 方式 1：使用 openyida 命令（推荐，自动处理编译+发布）
openyida publish <源文件路径> <appType> <formUuid>

# 方式 2：仅编译不发布
node -e "
const babelTransform = require('./lib/core/babel-transform').default;
const fs = require('fs');
const source = fs.readFileSync('pages/src/demo.js', 'utf-8');
const result = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
if (result.error) {
  console.error('编译失败:', result.error.message);
  process.exit(1);
}
fs.writeFileSync('pages/dist/demo.js', result.compiled, 'utf-8');
console.log('编译成功');
"
```

**编译流程**：

```
源文件(.js) → @babel/standalone (Babel 转换) → UglifyJS (压缩) → <name>.js
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

14. **⚠️ `forceUpdate()` 后的 DOM 渲染时序**：

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

    > **适用场景**：ECharts 图表初始化、Canvas 绑定、第三方库挂载等需要操作 DOM 的场景。详见 `yida-chart` 技能的「图表渲染时序」章节。

15. **调试技巧**：
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

## API 参考与素材资源

> 完整的 API 参考（宜搭 SDK 接口、HTTP 请求、页面跳转等）、工具链说明和素材资源指南，详见 [`reference/custom-page-api.md`](reference/custom-page-api.md)。

### 常用 API 速查

| API | 用途 |
|-----|------|
| `this.utils.yida.searchFormDatas(params)` | 查询表单数据列表 |
| `this.utils.yida.getFormDataById(params)` | 获取单条数据详情 |
| `this.utils.yida.saveFormData(params)` | 新增表单数据 |
| `this.utils.yida.updateFormData(params)` | 更新表单数据 |
| `this.utils.yida.deleteFormData(params)` | 删除表单数据 |
| `this.utils.toast({ title, type })` | 显示提示消息 |
| `this.utils.dialog({ ... })` | 显示对话框 |
| `this.utils.isMobile()` | 判断是否移动端 |
| `this.utils.loadScript(url)` | 动态加载外部 JS |
