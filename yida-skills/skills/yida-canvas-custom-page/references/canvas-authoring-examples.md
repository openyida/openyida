# 自定义页面编写示例

从零写使用 `YidaCodeCanvas` 组件实现的页面时，入口使用普通 React18 函数组件 `YidaComp`，源码导出或返回 `YidaComp` / `YidaComp.default`；`import` 使用可用资源清单内的包；副作用在 `useEffect` 里注册并返回 cleanup。

> 可用资源、import 写法与运行时加载方式见 [dependencies-and-cdn.md](dependencies-and-cdn.md)；读写宜搭数据见 [data-bridge-guide.md](data-bridge-guide.md)。

## 1. 最小可运行组件（入口 + 本地状态）

最小骨架：明确入口导出，用 `useState` 管本地状态，生命周期和事件都写在 React hooks 内。

```jsx
import React, { useState } from 'react';

function YidaComp(props) {
  var s = React.useState(0);
  var count = s[0];
  var setCount = s[1];

  return (
    <div style={{ padding: 16 }}>
      <p>当前计数：{count}</p>
      <button onClick={function () { setCount(count + 1); }}>加一</button>
    </div>
  );
}

export default YidaComp;
```

## 2. 带副作用清理（定时器 / 事件监听）

`useEffect` 注册的定时器、事件、图表实例，**必须**在返回的 cleanup 里销毁，否则重渲染 / 卸载会泄漏。

```jsx
import React, { useEffect, useState } from 'react';

function YidaComp(props) {
  var t = React.useState(0);
  var seconds = t[0];
  var setSeconds = t[1];

  React.useEffect(function () {
    var timer = setInterval(function () {
      setSeconds(function (prev) { return prev + 1; });
    }, 1000);
    function onResize() { /* 响应窗口变化 */ }
    window.addEventListener('resize', onResize);

    return function cleanup() {
      clearInterval(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <div style={{ padding: 16 }}>已运行 {seconds}s</div>;
}

export default YidaComp;
```

## 3. 可视化：recharts 图表

`recharts` 在可用资源清单内，使用标准 import。图表容器给定高度，品牌主序列默认跟随应用主题，不需要用户额外要求。完整示例统一维护在 [样式指南的图表章节](canvas-style-implementation-guide.md#图表--recharts用解析后的品牌色组)：业务图表使用 useCanvasThemeContext 读取解析色值，通过主题脚本装配后编译。不要重新添加只读 documentElement 的 helper。

## 4. 数据拉取组件（接数据桥）

结合 [data-bridge-guide.md](data-bridge-guide.md) 的连接器桥：页面只保存连接器资源 ID 和业务输入，鉴权留在平台连接器。此处只演示消费侧结构。

```jsx
import React, { useEffect, useState } from 'react';

function YidaComp(props) {
  var st = React.useState({ loading: true, rows: [], error: null });
  var state = st[0];
  var setState = st[1];
  React.useEffect(function () {
    var cancelled = false;
    var bridge = window.__OPENYIDA_CONNECTOR_API__;
    if (!bridge || typeof bridge.invoke !== 'function') {
      setState({ loading: false, rows: [], error: '连接器运行时桥不可用' });
      return undefined;
    }

    bridge.invoke({
      mode: 'connector',
      connectorName: props.connectorName,
      operationId: props.operationId,
      connectionId: props.connectionId,
    }, { path: {}, query: {}, header: {}, body: { pageSize: 50 } })
      .then(function (json) {
        if (cancelled) { return; }
        var rows = (json && json.result && json.result.data) || [];
        setState({ loading: false, rows: rows, error: null });
      })
      .catch(function (e) {
        if (cancelled) { return; }
        setState({ loading: false, rows: [], error: e.message });
      });

    return function () { cancelled = true; };
  }, [props.connectorName, props.operationId, props.connectionId]);

  if (state.loading) { return <div>加载中…</div>; }
  if (state.error) { return <div style={{ color: 'red' }}>加载失败：{state.error}</div>; }

  return (
    <ul style={{ padding: 16 }}>
      {state.rows.map(function (row) {
        return <li key={row.formInstanceId}>{row.title}</li>;
      })}
    </ul>
  );
}

export default YidaComp;
```

## 通用自查清单

- 入口：源码有 `export default YidaComp`（或返回组件函数），主组件已完成默认导出。
- 依赖：所有包依赖都用标准 `import`，并能出现在编译结果 `importedModules` 里；React、antd、Ant Design Icons、Recharts、ahooks 等不要直接从 `window.*` 解构。
- 文案：JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{'所有级别'}`；花括号里只放真实变量/表达式，不写 `{所有级别}` 这类裸中文表达式。
- 副作用：每个 `useEffect` 的定时器 / 监听 / 图表实例都有 cleanup。
- 数据：读写走同源 `fetch` + `credentials: 'include'`，无硬编码 Cookie / CSRF / appSecret。
- 主色：antd 走 CanvasThemeProvider、Tailwind 走 `var(--color-brand1-*)`、图表走 `useCanvasThemeContext`，无散落的 `#1677ff` / `bg-blue-500`（见 [canvas-style-implementation-guide.md](canvas-style-implementation-guide.md)）。
- 原生字段组件（`EmployeeField` 等）：先按 [employeefield-verification.md](employeefield-verification.md) 最小验证，缺证据就降级。
