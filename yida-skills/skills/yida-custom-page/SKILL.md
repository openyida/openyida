---
name: yida-custom-page
description: 宜搭自定义页面 JSX 开发规范。React 16 类组件模式，宜搭 JS API 调用，状态管理与编码约束。不适用于：原生表单页面开发（无需 JSX），或发布页面（编写完成后需使用 yida-publish-page 发布）。
---

# 自定义页面开发

## 核心规则

### 致命规则（FATAL）

违反会导致页面崩溃或运行时报错：

1. **React 16 类组件**：禁止使用 Hooks（`useState`、`useEffect`），必须使用类组件模式
2. **export function 定义方法**：所有需要 `this` 的方法必须用 `export function` 定义，不得用箭头函数或函数表达式
3. **事件绑定箭头函数包裹**：`onClick={(e) => { this.handleClick(e) }}`，严禁 `onClick={this.handleClick}`
4. **.map()/.filter() 回调用箭头函数**：`.map((item) => ...)`，禁止 `.map(function(item) {...})`，否则回调内 `this` 丢失
5. **输入框非受控模式**：`<input>` 用 `defaultValue` + `onChange` 写入 `_customState`，禁止 `value` 受控模式
6. **禁止 import/require**：第三方库通过 `this.utils.loadScript` 加载 CDN 脚本
7. **字段 ID 必须通过 get-schema 获取**：执行 `openyida get-schema <appType> <formUuid>` 获取真实 fieldId，文件顶部定义 `FIELDS` 常量映射字段别名，禁止猜测或手写
8. **所有 API 调用必须 .catch()**：异常通过 `this.utils.toast({ title: message, type: 'error' })` 提示用户

### 重要规则（IMPORTANT）

影响代码质量和用户体验：

1. **代码生成前确认功能摘要**：详见 [编码指南 编注 0](references/coding-guide.md)
2. **pageSize ≤ 100**：分页接口 `searchFormDatas` 等的 `pageSize` 最大 100
3. **didUnmount 清理定时器**：在 `didUnmount` 中清理所有 `setInterval`/`setTimeout`，防止内存泄漏
4. **样式内联**：所有样式通过 JS 对象 + `style` 属性，渐变用 `background` 不用 `backgroundColor`
5. **DateField 时间戳格式**：日期字段值必须是时间戳（毫秒），不能是字符串
6. **forceUpdate 后延迟操作 DOM**：`forceUpdate()` 后 DOM 不会立即更新，需 `setTimeout` 延迟访问新 DOM 元素
7. **多端适配**：使用 `this.utils.isMobile()` 判断设备类型，适配 PC 和移动端
8. **输入法组合输入处理**：使用 `_isComposing` 标记配合 `compositionstart`/`compositionend` 事件，避免输入过程中触发提交
9. **iframe 嵌入表单 URL**：数据列表用 `workbench/{formUuid}?iframe=true`，禁止用 `formDetail`
10. **Tabs 显隐控制**：下拉值变更后自动回退到第一个可见 Tab，内容区用 `display: none` 保留 DOM

> 每条规则的代码示例、反模式和常见错误见 [编码指南](references/coding-guide.md)（编写代码前强制必读）。
> 表单类 JSX 控件、筛选栏、表格、成员/附件等组件写法见 [组件指南](references/component-jsx-guide.md)；未验证的平台组件能力不得编造。

## 适用场景

**正向触发**：
- 开发自定义展示页面（"自定义页面"、"JSX 页面"、"自定义组件"）
- 需要调用 `this.utils.yida.*` 读写表单数据
- 复杂交互逻辑（状态管理、事件处理、动态渲染）

**不适用（应使用其他技能）**：

| 场景 | 应使用技能 |
|------|-----------|
| 原生表单页面开发 | `yida-create-form-page` |
| 发布已编写的页面 | `yida-publish-page` |
| 批量表格录入 | `yida-table-form` |
| PPT 幻灯片 | `yida-ppt-slider` |

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 使用了 React Hooks | 改为类组件模式（React 16 不支持 Hooks） |
| 字段 ID 不确定 | 执行 `openyida get-schema` 获取真实 fieldId |
| `forceUpdate is not a function` | 检查 `this` 绑定，确认方法用 `export function` 定义 |
| API 调用无响应 | 确认 `.catch()` 错误处理，检查登录态 |
| 发布后页面空白 | 检查 `renderJsx` 是否正确导出，查看浏览器控制台 |

## 快速开始

以创建「员工信息查询页」为例，完整流程如下：

```bash
# Step 1：获取表单 Schema，确认字段 ID
openyida get-schema APP_XXX FORM-EMPLOYEE > .cache/employee-schema.json 2>&1

# Step 2：创建自定义页面
openyida create-page APP_XXX "员工信息查询"
# 输出：formUuid = FORM-QUERY001

# Step 3：生成/编写页面代码
# 优先使用 spec/blocks 生成高质量页面：openyida generate-page product-homepage --spec page.json --output project/pages/src/employee-query.jsx
# 需要手动参考模板时：openyida sample yida-custom-page custom-page-template
# 在 project/pages/src/employee-query.jsx 中编写

# Step 4：本地规范检查 + 编译校验（不发布）
openyida check-page project/pages/src/employee-query.jsx
openyida compile project/pages/src/employee-query.jsx

# Step 5：发布页面
openyida publish project/pages/src/employee-query.jsx APP_XXX FORM-QUERY001
```

预期输出：

```json
{
  "success": true,
  "pageUrl": "https://www.aliwork.com/APP_XXX/custom/FORM-QUERY001"
}
```

**关键说明**：
- **Step 1** 的 get-schema 输出包含所有字段的 fieldId，在代码中必须使用 `FIELDS` 常量映射这些 ID
  - get-schema 输出的 JSON 中，每个字段的 `fieldId`（如 `textField_k8j2n3m4`）即是代码中 `FIELDS` 常量应映射的值
- **Step 3** 的页面代码必须遵循 [编码指南](references/coding-guide.md) 的全部 19 条编码注意事项
- 优先通过 `openyida generate-page product-homepage --spec page.json --output pages/src/home.jsx --compile` 生成高质量页面骨架；生成器会写入 `.openyida-page.json` 结构化 manifest，后续改版优先改 spec/blocks 再重新生成 JSX
- 完整代码模板通过 `openyida sample yida-custom-page custom-page-template` 获取

## 开发规范

> 编写页面代码前**必须完整阅读** [编码指南](references/coding-guide.md)，包含文件结构模板、状态管理模式、生命周期钩子、全局变量及全部 19 条编码注意事项。
> 涉及输入控件、日期、选择、成员/部门、附件、表格或筛选栏时，同时阅读 [组件指南](references/component-jsx-guide.md)。

## 官方示例模板

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

     ```javascript
     // ❌ 错误③：在 .map(function(){}) 普通函数回调中使用箭头函数事件处理器，this 已在 function 回调里丢失，箭头函数捕获的 this 是 undefined！
     export function renderJsx() {
       return (
         <div>
         {quickBtns.map(function(btn, idx) {
           return (
             <button
               key={idx}
               onClick={(e) => { this.goToForm(btn.form); }}  // ❌ this 是 undefined，运行时报错
             >
               {btn.label}
             </button>
           );
         })}
       </div>
     );
   }

   // ✅ 正确：.map() 回调必须使用箭头函数，确保 this 正确捕获
   export function renderJsx() {
     return (
       <div>
         {quickBtns.map((btn, idx) => (
           <button
             key={idx}
             onClick={(e) => { this.goToForm(btn.form); }}  // ✅ 箭头函数回调 + 箭头函数事件处理器，this 正确
           >
             {btn.label}
           </button>
         ))}
       </div>
     );
   }
   ```

   > **补充自检项**：检查 `renderJsx` 中所有 `.map()`、`.filter()`、`.forEach()` 等数组方法的回调，确保全部使用**箭头函数**形式 `(item) => ...`，不存在任何 `.map(function(item) {...})` 的写法，否则回调内部的 `this` 会丢失。

3. **输入法组合输入处理**：使用 `_isComposing` 标记配合 `compositionstart` / `compositionend` 事件，正确处理中文输入法的组合输入状态，避免输入过程中触发提交
4. **定时器清理**：在 `didUnmount` 中必须清理所有通过 `setInterval` / `setTimeout` 创建的定时器，防止内存泄漏
5. **错误处理**：所有 API 调用（`this.utils.yida.*`、`fetch`）必须使用 `.catch()` 处理异常，并通过 `this.utils.toast({ title: message, type: 'error' })` 向用户展示错误提示
6. **样式方式**：所有样式通过 JavaScript 对象定义（内联样式），在 `renderJsx` 中通过 `style` 属性应用，不使用外部 CSS 文件。**注意**：CSS 渐变（`linear-gradient` 等）必须使用 `background` 属性，不能使用 `backgroundColor`（只接受纯色值），否则浏览器会忽略该值导致背景变白：
   ```javascript
   // ✅ 正确
   style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
   // ❌ 错误：backgroundColor 不支持渐变
   style={{ backgroundColor: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
   ```
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

16. **iframe 嵌入表单 URL 规范**：在自定义页面中通过 iframe 嵌入宜搭表单时，需使用正确的 URL 格式：

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

17. **下拉选项控制选项卡（Tabs）表格页显示/隐藏**：当页面中存在选项卡组件包含多个表格页，需要根据下拉选择框的值动态控制特定表格页的显示或隐藏时，使用状态驱动的条件渲染实现。

    **实现要点**：
    - 用 `_customState.selectedType` 记录下拉选中值，`onChange` 时调用 `setCustomState` 触发重渲染
    - 用 `_customState.activeTab` 记录当前激活的 Tab，切换时直接写入 `_customState` 并调用 `forceUpdate()`
    - 下拉值变更后，若当前激活的 Tab 被隐藏，自动回退到第一个可见 Tab，避免空白页面
    - Tab 内容区使用 `display: none` 而非条件渲染，保留 DOM 避免 iframe 重复加载
    - 所有 Tab 均被隐藏时展示兜底提示，提升用户体验

    该场景按上述状态机规则实现即可；当前技能包不提供单独示例文件，避免尝试读取不存在的 `examples/tabs-visibility-control.js`。

18. 字段 ID 语义化别名约定

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
代码编写前，执行以下命令获取示例模板，再用 `read_file` 完整读取：

```bash
openyida sample yida-custom-page custom-page-template   # 完整页面模板（didMount/renderJsx/状态管理/API调用）
openyida sample yida-custom-page product-homepage       # 产品/项目首页轻量模板（支持 --var KEY=VALUE）
openyida sample yida-custom-page design-tokens          # 设计 token 参考（颜色/间距/字体规范）
openyida generate-page product-homepage --spec page.json --output pages/src/home.jsx --compile  # 基于 spec/blocks 生成首页并本地编译
openyida check-page pages/src/home.jsx --json          # 输出机器可读的规范检查结果
```

## 常见场景示例

- 自定义页面附件上传：见 [AttachmentField 上传指南](references/attachment-upload-guide.md)
- 对应最小代码示例：见 [attachment-upload.js](examples/attachment-upload.js)

## API 速查

### 表单数据（`this.utils.yida.<方法>(params)`）

| 方法 | 说明 | 必填参数 |
|------|------|----------|
| `saveFormData` | 新建实例 | `formUuid`, `appType`, `formDataJson` |
| `updateFormData` | 更新实例 | `formInstId`, `updateFormDataJson` |
| `deleteFormData` | 删除实例 | `formUuid` |
| `getFormDataById` | 查询详情 | `formInstId` |
| `searchFormDatas` | 搜索列表 | `formUuid` |
| `searchFormDataIds` | 搜索 ID 列表 | `formUuid` |

### 流程操作（`this.utils.yida.<方法>(params)`）

| 方法 | 说明 | 必填参数 |
|------|------|----------|
| `startProcessInstance` | 发起流程 | `formUuid`, `processCode`, `formDataJson` |
| `getProcessInstanceById` | 查询流程详情 | `processInstanceId` |
| `getProcessInstances` | 搜索流程列表 | — |

### 工具函数（`this.utils.<方法>()`）

| 方法 | 用途 |
|------|------|
| `toast` | 轻提示 |
| `dialog` | 对话框 |
| `formatter` | 日期/金额格式化 |
| `getLoginUserId` / `getLoginUserName` | 获取当前用户 |
| `isMobile` | 判断移动端 |
| `openPage` | 打开新页面 |
| `router.push` | 路由跳转 |
| `loadScript` | 动态加载脚本 |

> **上表为常用 API 速查，完整 API 列表见 [yida-api.md](../../references/yida-api.md)。使用前必须阅读完整参数文档，禁止猜测参数。**

### 大模型 AI 接口

以下接口用于调用大模型 AI 文本生成能力：

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `txtFromAI` | AI 文本生成 | `POST /query/intelligent/txtFromAI.json` |

**主要参数**：`_csrf_token`（CSRF 令牌）、`prompt`（提示词）、`skill`（技能类型，如 `ToText`）、`maxTokens`（最大返回 token 数）

> **使用前必须阅读 [model-api.md](../../references/model-api.md) 查询详细的参数，禁止猜测参数**。

## 参考文档

| 文档 | 覆盖范围 | 何时阅读 |
|------|---------|---------|
| **本技能文档** | | |
| [编码指南](references/coding-guide.md) | 文件结构模板、状态管理、生命周期、19 条编码规范 | 编写任何页面代码前必读 |
| [设计规范](references/design-system.md) | 色彩/圆角/字体/间距系统、7 类组件样式模板、8 条反模式 | 实现 UI 样式时必读 |
| [素材资源](references/assets-guide.md) | 图片/音乐/Icon 素材库、CDN 安全规范 | 需要引入图片、图标、音效时阅读 |
| **全局共享文档** | | |
| [宜搭 API](../../references/yida-api.md) | 表单/流程/工具 API 完整参数文档 | 调用 `this.utils.yida.*` 前必读 |
| [大模型 API](../../references/model-api.md) | AI 文本生成接口参数 | 调用 `txtFromAI` 前必读 |

## 注意事项

- 本技能不读写 memory，所有页面状态（`_customState`）仅在当前页面会话内有效，刷新页面后重置，不跨会话持久化
