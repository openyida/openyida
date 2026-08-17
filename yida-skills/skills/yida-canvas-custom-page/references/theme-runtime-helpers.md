# Yida Global Theme Runtime Helpers

本文件提供自定义主题 token 的复制型 helper。它不是设计事实源，不生成配色，也不解释视觉 DNA；调用方必须先从 `yida-design` 输出的 `design.md` 读取 `tokens`，再把同一份 token 交给本 helper。页面需要自定义色盘、`style#yida-global-theme`、隐藏导航沉浸页，或页面在 iframe 中承载原生表单时，优先复制对应 helper 到页面源码，不要临场重写。

## 推荐策略

- YidaCodeCanvas 和平台 JSX 组件页面都使用复制型 helper。页面源码发布后应自包含，不依赖本仓库运行时文件。
- 只有平台预置主题 key 才传给 `create-app/update-app --theme`；任意自定义色盘都走 `style#yida-global-theme` 或 scoped CSS vars。
- 注入目标必须包含当前窗口文档、同源可访问的所有父级窗口文档，以及 `FormOpenContainer` 打开的同源子 iframe 文档。跨域窗口会抛异常，必须静默降级。
- 样式 id 固定为 `yida-global-theme`；重复执行时更新内容，不插入多个 style。
- tokens 必须来自当前项目 `design.md`；若 design.md 声明移动端支持色阶，`--color-brand-1` ~ `--color-brand-4` 必须和 `--color-brand1-*` 一起注入。

## YidaCodeCanvas Helper

复制到 `.canvas.jsx` 的常量和组件定义附近，在根组件中调用：

```jsx
function collectYidaThemeDocuments(startWindow) {
  var docs = [];
  var cursor = startWindow || (typeof window !== 'undefined' ? window : null);
  while (cursor) {
    try {
      if (cursor.document && docs.indexOf(cursor.document) === -1) {
        docs.push(cursor.document);
      }
      if (!cursor.parent || cursor.parent === cursor) {
        break;
      }
      cursor = cursor.parent;
    } catch (e) {
      break;
    }
  }
  return docs;
}

function buildYidaGlobalThemeCss(tokens) {
  var safeTokens = tokens || {};
  var lines = Object.keys(safeTokens)
    .filter(function (key) { return /^--[a-zA-Z0-9-_]+$/.test(key); })
    .map(function (key) { return '  ' + key + ': ' + safeTokens[key] + ';'; });
  if (!lines.length) { return ''; }
  return ':root, [data-yida-theme-root] {\n' + lines.join('\n') + '\n}';
}

function installYidaGlobalTheme(tokens, startWindow) {
  var cssText = buildYidaGlobalThemeCss(tokens);
  if (!cssText) { return; }
  collectYidaThemeDocuments(startWindow).forEach(function (doc) {
    if (!doc || !doc.head) { return; }
    var style = doc.getElementById('yida-global-theme');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'yida-global-theme';
      doc.head.insertBefore(style, doc.head.firstChild);
    }
    if (style.innerHTML !== cssText) {
      style.innerHTML = cssText;
    }
  });
}

function installYidaGlobalThemeIntoFrame(tokens, iframeElement) {
  try {
    if (!iframeElement || !iframeElement.contentWindow) { return; }
    installYidaGlobalTheme(tokens, iframeElement.contentWindow);
  } catch (e) {}
}

function useYidaGlobalTheme(tokens) {
  React.useEffect(function () {
    installYidaGlobalTheme(tokens, window);
  }, [JSON.stringify(tokens || {})]);
}
```

使用示例：

```jsx
const CUSTOM_THEME_TOKENS = {
  '--color-brand1-6': '#0F766E',
  '--color-brand1-2': '#E6FFFB',
  '--color-brand1-9': '#134E4A',
  '--color-brand-1': 'rgba(15, 118, 110, 0.3)',
  '--color-brand-2': '#5EEAD4',
  '--color-brand-3': '#0F766E',
  '--color-brand-4': '#134E4A',
  '--color-group': '#0F766E,#2563EB,#F59E0B,#EF4444,#8B5CF6',
};

function YidaComp() {
  useYidaGlobalTheme(CUSTOM_THEME_TOKENS);
  return <div data-yida-theme-root className="oy-page-root">...</div>;
}
```

## Ordinary JSX Helper

复制到 `.oyd.jsx` / 平台 JSX 组件页面的 `didMount` 或等价初始化函数中，保持 ES5 写法：

```javascript
function collectYidaThemeDocuments(startWindow) {
  var docs = [];
  var cursor = startWindow || (typeof window !== 'undefined' ? window : null);
  while (cursor) {
    try {
      if (cursor.document && docs.indexOf(cursor.document) === -1) {
        docs.push(cursor.document);
      }
      if (!cursor.parent || cursor.parent === cursor) {
        break;
      }
      cursor = cursor.parent;
    } catch (e) {
      break;
    }
  }
  return docs;
}

function buildYidaGlobalThemeCss(tokens) {
  var safeTokens = tokens || {};
  var lines = [];
  Object.keys(safeTokens).forEach(function (key) {
    if (/^--[a-zA-Z0-9-_]+$/.test(key)) {
      lines.push('  ' + key + ': ' + safeTokens[key] + ';');
    }
  });
  if (!lines.length) { return ''; }
  return ':root, [data-yida-theme-root] {\n' + lines.join('\n') + '\n}';
}

function installYidaGlobalTheme(tokens, startWindow) {
  var cssText = buildYidaGlobalThemeCss(tokens);
  if (!cssText) { return; }
  collectYidaThemeDocuments(startWindow).forEach(function (doc) {
    if (!doc || !doc.head) { return; }
    var style = doc.getElementById('yida-global-theme');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'yida-global-theme';
      doc.head.insertBefore(style, doc.head.firstChild);
    }
    if (style.innerHTML !== cssText) {
      style.innerHTML = cssText;
    }
  });
}

function installYidaGlobalThemeIntoFrame(tokens, iframeElement) {
  try {
    if (!iframeElement || !iframeElement.contentWindow) { return; }
    installYidaGlobalTheme(tokens, iframeElement.contentWindow);
  } catch (e) {}
}
```

使用示例：

```javascript
var CUSTOM_THEME_TOKENS = {
  '--color-brand1-6': '#0F766E',
  '--color-brand1-2': '#E6FFFB',
  '--color-brand1-9': '#134E4A',
  '--color-brand-1': 'rgba(15, 118, 110, 0.3)',
  '--color-brand-2': '#5EEAD4',
  '--color-brand-3': '#0F766E',
  '--color-brand-4': '#134E4A',
  '--color-group': '#0F766E,#2563EB,#F59E0B,#EF4444,#8B5CF6'
};

didMount: function () {
  installYidaGlobalTheme(CUSTOM_THEME_TOKENS, window);
}
```

根节点建议加 `data-yida-theme-root="true"`，方便当前页面 scoped token 和父级窗口 token 同时命中。PC 端用 `FormOpenContainer` 抽屉 iframe 打开提交页或详情页时，必须在 iframe `onload` 后调用 `installYidaGlobalThemeIntoFrame(CUSTOM_THEME_TOKENS, iframeElement)`；父页面 CSS 变量不会自动继承到子 iframe 文档。
