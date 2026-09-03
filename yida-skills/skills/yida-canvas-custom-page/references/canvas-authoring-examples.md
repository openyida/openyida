# 自定义页面编写示例 / 脚手架

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

`recharts` 在可用资源清单内。标准 `import` 即可，CLI 本地编译会把它计入 `importedModules`。图表容器给定高度，保证首屏可渲染。图表颜色是 JS 传给库的字符串，用 `readBrandColor` 读取当前应用主题 token；用户明确要求应用主题风格时才跟随运行态应用主题（见 [canvas-style-implementation-guide.md](canvas-style-implementation-guide.md)）。

```jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// 读当前品牌色 token（跑在真 window，getComputedStyle 可直接解析），缺失时退`podBlue` 应用主题 主色
function readBrandColor(level, fallback) {
  try {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return v || fallback;
  } catch (e) { return fallback; }
}

function YidaComp(props) {
  var brand = readBrandColor(6, '#6b7cab');
  var data = [
    { name: '1月', value: 120 },
    { name: '2月', value: 200 },
    { name: '3月', value: 150 },
    { name: '4月', value: 320 },
  ];

  return (
    <div style={{ width: '100%', height: 300, padding: 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={brand} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default YidaComp;
```

## 4. 数据拉取组件（接数据桥）

结合 [data-bridge-guide.md](data-bridge-guide.md) 的 `useYidaFetch`：同源 `fetch` + `credentials: 'include'` + AbortController 清理。此处只演示消费侧结构。

```jsx
import React, { useEffect, useRef, useState } from 'react';

function YidaComp(props) {
  var st = React.useState({ loading: true, rows: [], error: null });
  var state = st[0];
  var setState = st[1];
  var abortRef = React.useRef(null);

  React.useEffect(function () {
    var controller = new AbortController();
    abortRef.current = controller;

    fetch('/your-connector-proxy/searchFormDatas', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appType: props.appType, formUuid: props.formUuid, pageSize: 50 }),
      signal: controller.signal,
    })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
      .then(function (json) {
        var rows = (json && json.result && json.result.data) || [];
        setState({ loading: false, rows: rows, error: null });
      })
      .catch(function (e) {
        if (e.name === 'AbortError') { return; }
        setState({ loading: false, rows: [], error: e.message });
      });

    return function () { controller.abort(); };
  }, [props.appType, props.formUuid]);

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
- 主色：antd 走 `ConfigProvider.colorPrimary`、Tailwind 走 `var(--color-brand1-*)`、图表走 `readBrandColor`，无散落的 `#1677ff` / `bg-blue-500`（见 [canvas-style-implementation-guide.md](canvas-style-implementation-guide.md)）。
- 原生字段组件（`EmployeeField` 等）：先按 [employeefield-verification.md](employeefield-verification.md) 最小验证，缺证据就降级。
