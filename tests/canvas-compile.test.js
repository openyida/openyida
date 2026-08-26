'use strict';

const fs = require('fs');
const path = require('path');

const {
  compileCanvas,
  compileCanvasLocal,
  extractImportedModules,
  resolveWindowAlias,
} = require('../lib/app/canvas-compile');
const {
  buildCanvasPageSchemaObject,
} = require('../lib/app/services/canvas-page-schema-builder');

/**
 * 模拟 YidaCodeCanvas 运行时装配：
 * 把 runtimeCode 包进 `new Function`，注入 window 桩，取回 YidaComp。
 */
function assembleRuntime(runtimeCode, stubWindow) {
  const wrapped =
    'return function(iframeWindow, parentWindow){ const window = iframeWindow; ' +
    runtimeCode +
    ' return YidaComp; }';
  // eslint-disable-next-line no-new-func
  const factory = new Function(wrapped)();
  return factory(stubWindow, stubWindow);
}

function expectCanvasEntry(runtimeCode) {
  expect(runtimeCode).toMatch(
    /\b(?:function|class)\s+YidaComp\b|\b(?:var|let|const)\s+YidaComp\b|YidaComp\s*=/
  );
}

function stubReactWindow(extra) {
  const calls = [];
  const React = {
    createElement: (type, props, ...children) => {
      const name = typeof type === 'function' ? type.name || 'anon' : String(type);
      const node = { type: name, props: props || {}, children };
      calls.push(node);
      return node;
    },
    Fragment: 'Fragment',
    useState: (v) => [v, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    __esModule: false,
  };
  return Object.assign({ React, __calls: calls }, extra || {});
}

class StubReactComponent {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }

  setState(nextState) {
    this.state = Object.assign(
      {},
      this.state,
      typeof nextState === 'function' ? nextState(this.state, this.props) : nextState
    );
  }
}

function stubCanvasTemplateWindow() {
  const React = {
    Component: StubReactComponent,
    createElement: (type, props, ...children) => ({
      type: typeof type === 'function' ? type.name || 'anon' : String(type),
      props: props || {},
      children,
    }),
    Fragment: 'Fragment',
    useMemo: (fn) => fn(),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
  };
  const Typography = { Title: 'Title', Text: 'Text', Paragraph: 'Paragraph' };
  const antd = {
    ConfigProvider: 'ConfigProvider',
    Button: 'Button',
    Input: Object.assign('Input', { Search: 'Input.Search' }),
    Select: 'Select',
    Table: 'Table',
    Tag: 'Tag',
    Typography,
    Card: 'Card',
    Space: 'Space',
    Progress: 'Progress',
    Segmented: 'Segmented',
  };
  const chartNames = [
    'AreaChart',
    'Area',
    'BarChart',
    'Bar',
    'RadarChart',
    'Radar',
    'PolarGrid',
    'PolarAngleAxis',
    'CartesianGrid',
    'LineChart',
    'Line',
    'ResponsiveContainer',
    'Tooltip',
    'XAxis',
    'YAxis',
  ];
  const Recharts = Object.fromEntries(chartNames.map((name) => [name, name]));
  const ahooks = { useMemoizedFn: (fn) => fn };
  const localStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  return {
    React,
    antd,
    Recharts,
    ahooks,
    localStorage,
    document: {
      body: {},
      documentElement: {},
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };
}

test('does not block rich display pages with few content blocks', () => {
  const source = `
/**
 * @openyida-scene workbench
 * @openyida-content-blocks 状态摘要,快捷入口,最近订单,空态提示
 */
import React from 'react';

export default function YidaComp() {
  return <div>工作台</div>;
}
`;

  const result = compileCanvasLocal(source, { sourcePath: '/tmp/workbench.canvas.jsx' });
  expect(result.runtimeCode).toContain('YidaComp');
});

test('allows rich display pages with enough content blocks', () => {
  const source = `
/**
 * @openyida-scene workbench
 * @openyida-content-blocks 上下文标题,范围筛选,状态摘要,风险提醒,主操作条,待处理队列,最近记录,协作动态,业务洞察,右侧上下文
 */
import React from 'react';

export default function YidaComp() {
  return <div>工作台</div>;
}
`;

  const result = compileCanvasLocal(source, { sourcePath: '/tmp/workbench.canvas.jsx' });
  expect(result.runtimeCode).toContain('YidaComp');
});

function renderCanvasRuntime(runtimeCode, stubWindow) {
  const wrapped = `${runtimeCode}\nreturn typeof YidaComp !== "undefined" ? YidaComp : (typeof exports !== "undefined" && exports.default);`;
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', wrapped);
  const Comp = factory(stubWindow);
  if (typeof Comp !== 'function') {
    throw new Error('YidaComp is not a function');
  }
  return Comp({});
}

function collectVisibleStrings(node, result = [], insideStyle = false) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return result;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    if (!insideStyle) {
      result.push(String(node));
    }
    return result;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectVisibleStrings(item, result, insideStyle));
    return result;
  }
  if (typeof node === 'object') {
    const nextInsideStyle = insideStyle || node.type === 'style';
    collectVisibleStrings(node.children || [], result, nextInsideStyle);
  }
  return result;
}

function findNodesByType(node, type, result = []) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return result;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => findNodesByType(item, type, result));
    return result;
  }
  if (typeof node === 'object') {
    if (node.type === type) {
      result.push(node);
    }
    findNodesByType(node.children || [], type, result);
  }
  return result;
}

function withCanvasGlobals(stubWindow, fn) {
  const previousGlobals = {
    document: global.document,
    getComputedStyle: global.getComputedStyle,
    fetch: global.fetch,
    URLSearchParams: global.URLSearchParams,
    AbortController: global.AbortController,
    localStorage: global.localStorage,
    window: global.window,
  };

  try {
    global.document = stubWindow.document;
    global.getComputedStyle = stubWindow.getComputedStyle;
    global.fetch = () => Promise.reject(new Error('fetch should not run in canvas render smoke'));
    global.URLSearchParams = URLSearchParams;
    global.AbortController = class {
      constructor() { this.signal = {}; }
      abort() {}
    };
    global.localStorage = stubWindow.localStorage;
    global.window = stubWindow;
    return fn();
  } finally {
    global.document = previousGlobals.document;
    global.getComputedStyle = previousGlobals.getComputedStyle;
    global.fetch = previousGlobals.fetch;
    global.URLSearchParams = previousGlobals.URLSearchParams;
    global.AbortController = previousGlobals.AbortController;
    global.localStorage = previousGlobals.localStorage;
    global.window = previousGlobals.window;
  }
}

describe('extractImportedModules', () => {
  test('collects bare package names, skips relative/absolute, dedups & sorts', () => {
    const code = `
      import React from 'react';
      import { Button } from 'antd';
      /* require('fs') and import('left-pad') in comments must not be counted */
      // require('path')
      import './local.css';
      import '/abs/thing';
      const d = require('d3');
      const lazy = import('recharts');
      import { Button as B2 } from 'antd';
    `;
    expect(extractImportedModules(code)).toEqual(['antd', 'd3', 'react', 'recharts']);
  });
});

describe('resolveWindowAlias', () => {
  test('maps known packages and sub-paths to window aliases', () => {
    expect(resolveWindowAlias('react')).toBe('React');
    expect(resolveWindowAlias('antd')).toBe('antd');
    expect(resolveWindowAlias('antd/es/button')).toBe('antd');
    expect(resolveWindowAlias('@ant-design/icons')).toBe('icons');
    expect(resolveWindowAlias('lucide-react')).toBe('DynamicIcon');
  });
  test('returns null for unknown packages', () => {
    expect(resolveWindowAlias('left-pad')).toBeNull();
  });
});

describe('compileCanvasLocal', () => {
  test('rejects unicode escape sequences that would decode to emoji', () => {
    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <div>{"\\u2705"}</div>;
      }
    `)).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
    }));

    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <div>{"\\u{1F4CA}"}</div>;
      }
    `)).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
    }));

    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <div>{"\\uD83D\\uDE80"}</div>;
      }
    `)).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
    }));
  });

  test('rejects emoji in source filenames', () => {
    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <div>ok</div>;
      }
    `, {
      sourcePath: 'pages/src/home-✅.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_FILENAME_EMOJI_FORBIDDEN',
    }));
  });

  test('rejects bare Chinese identifiers in JSX text expressions', () => {
    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <select><option value="">{所有级别}</option></select>;
      }
    `, {
      sourcePath: 'pages/src/filter.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_JSX_TEXT_IDENTIFIER',
      details: expect.objectContaining({
        line: 4,
        identifier: '所有级别',
      }),
    }));
  });

  test('allows plain JSX text and quoted Chinese string expressions in Canvas', () => {
    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <div>所有级别</div>;
      }
    `)).not.toThrow();

    expect(() => compileCanvasLocal(`
      import React from 'react';
      export default function Page() {
        return <div>{'所有级别'}</div>;
      }
    `)).not.toThrow();
  });

  test('rejects unsupported bare package binding imports before runtime', () => {
    const src = `
      import { useDataBinding } from 'some-package';
      export default function App() {
        const data = useDataBinding({});
        return <div>{data}</div>;
      }
    `;

    let error;
    try {
      compileCanvasLocal(src);
    } catch (compileError) {
      error = compileError;
    }

    expect(error).toBeTruthy();
    expect(error.message).toContain('some-package');
    expect(error.message).toContain('MODULE_ALIAS_MAP');
    expect(error.message).toContain('window.*');
    expect(error.message).toContain('OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS');
  });

  test('rejects manual package globals and requires import-based dependency tracking', () => {
    const badSource = `
      const { ConfigProvider, Button } = window.antd;
      export default function App() {
        return <ConfigProvider><Button>提交</Button></ConfigProvider>;
      }
    `;

    expect(() => compileCanvasLocal(badSource)).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_MANUAL_DEPENDENCY_GLOBAL',
      details: expect.objectContaining({
        globalName: 'antd',
        packageName: 'antd',
      }),
    }));

    const goodSource = `
      import React from 'react';
      import { ConfigProvider, Button } from 'antd';
      export default function App() {
        return <ConfigProvider><Button>提交</Button></ConfigProvider>;
      }
    `;
    const result = compileCanvasLocal(goodSource);
    expect(JSON.parse(result.importedModules)).toEqual(['antd', 'react']);
    expect(result.runtimeCode).toContain('window.antd');
  });

  test('rejects bare antd globals before publish', () => {
    const badSource = `
      const { Drawer, Button } = antd;
      export default function App() {
        return <Drawer open><Button>新增</Button></Drawer>;
      }
    `;

    expect(() => compileCanvasLocal(badSource, {
      sourcePath: 'pages/src/workbench.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_BARE_DEPENDENCY_GLOBAL',
      details: expect.objectContaining({
        line: 2,
        globalName: 'antd',
        packageName: 'antd',
      }),
    }));
  });

  test('rejects bare lucide-react globals before publish', () => {
    const badSource = `
      const { Search, Plus } = lucideReact;
      export default function App() {
        return <div><Search size={16} /><Plus size={16} /></div>;
      }
    `;

    expect(() => compileCanvasLocal(badSource, {
      sourcePath: 'pages/src/workbench.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_BARE_DEPENDENCY_GLOBAL',
      details: expect.objectContaining({
        line: 2,
        globalName: 'lucideReact',
        packageName: 'lucide-react',
      }),
    }));
  });

  test('rejects every unbound helper and ref identifier before publish', () => {
    const badSource = `
      import React from 'react';
      export default function App() {
        const row = { id: 'ROW-1' };
        return <div>{getInstId(row)}{loadedRef.current ? '已加载' : '加载中'}</div>;
      }
    `;

    let error;
    try {
      compileCanvasLocal(badSource, {
        sourcePath: 'pages/src/customer-management.canvas.jsx',
      });
    } catch (compileError) {
      error = compileError;
    }

    expect(error).toEqual(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_UNBOUND_IDENTIFIER',
      details: expect.objectContaining({
        sourcePath: 'pages/src/customer-management.canvas.jsx',
        issues: expect.arrayContaining([
          expect.objectContaining({ name: 'getInstId', line: 5 }),
          expect.objectContaining({ name: 'loadedRef', line: 5 }),
        ]),
      }),
    }));
    expect(error.message).toContain('getInstId');
    expect(error.message).toContain('loadedRef');
  });

  test('allows standard ECMAScript, browser, and Canvas wrapper globals', () => {
    const source = `
      import React from 'react';
      export default function App() {
        const query = new URLSearchParams({ page: '1' });
        const image = new Image();
        const audio = new Audio();
        const imageRef = new WeakRef(image);
        const modernWebApis = [URLPattern, navigation, cookieStore, scheduler, Temporal];
        const timer = setTimeout(function () { console.log(Math.max(1, 2)); }, 0);
        const idle = requestIdleCallback(function () { WebAssembly.validate(new Uint8Array()); });
        clearTimeout(timer);
        cancelIdleCallback(idle);
        if (document.hidden || !window || !parentWindow || !localStorage) {
          return <div>不可见</div>;
        }
        fetch('/health?' + query.toString());
        return <div>{audio && imageRef && modernWebApis.length ? '正常' : '异常'}</div>;
      }
    `;

    expect(() => compileCanvasLocal(source)).not.toThrow();
  });

  test('allows intentional non-standard runtime capabilities through window properties', () => {
    const source = `
      export default function App() {
        const hostApi = typeof window.customHostApi === 'undefined'
          ? null
          : window.customHostApi;
        return <div>{hostApi ? hostApi.getVersion() : '不支持'}</div>;
      }
    `;

    expect(() => compileCanvasLocal(source)).not.toThrow();
  });

  test('rejects an unknown bare runtime global even when probed with typeof', () => {
    const source = `
      export default function App() {
        return <div>{typeof customHostApi === 'undefined' ? '不支持' : customHostApi.getVersion()}</div>;
      }
    `;

    expect(() => compileCanvasLocal(source)).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_UNBOUND_IDENTIFIER',
      message: expect.stringContaining('window.<name>'),
      details: expect.objectContaining({
        issues: [expect.objectContaining({ name: 'customHostApi' })],
      }),
    }));
  });

  test('rejects Node-only globals that are unavailable in the Canvas browser runtime', () => {
    const source = `
      export default function App() {
        return <div>{process.env.NODE_ENV}{Buffer.from('x')}</div>;
      }
    `;

    expect(() => compileCanvasLocal(source)).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_UNBOUND_IDENTIFIER',
      details: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ name: 'process' }),
          expect.objectContaining({ name: 'Buffer' }),
        ]),
      }),
    }));
  });

  test('rejects desktop form submission/detail new-tab opens before publish', () => {
    const badSource = `
      import React from 'react';
      export default function App() {
        const submitUrl = '/APP_XXX/submission/FORM_XXX?isRenderNav=false';
        return <button onClick={() => window.open(submitUrl, '_blank')}>新增</button>;
      }
    `;

    expect(() => compileCanvasLocal(badSource, {
      sourcePath: 'pages/src/workbench.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_FORM_OPEN_CONTAINER_REQUIRED',
      details: expect.objectContaining({
        line: 5,
        callee: 'window.open',
      }),
    }));
  });

  test('allows mobile-only full-page form opens when desktop uses FormOpenContainer state', () => {
    const source = `
      import React, { useState } from 'react';
      export default function App() {
        const [formRequest, setFormRequest] = useState(null);
        function openForm() {
          const submitUrl = '/APP_XXX/submission/FORM_XXX?isRenderNav=false';
          if (isMobileViewport()) {
            window.location.href = submitUrl;
            return;
          }
          setFormRequest({ type: 'submission', iframeUrl: submitUrl });
        }
        return <button onClick={openForm}>{formRequest ? '打开中' : '新增'}</button>;
      }
      function isMobileViewport() {
        return window.matchMedia('(max-width: 767px)').matches;
      }
    `;

    expect(() => compileCanvasLocal(source)).not.toThrow();
  });

  test('rejects detail open requests without formInstId', () => {
    const badSource = `
      import React from 'react';
      export default function App() {
        function openDetail(row) {
          openForm({ type: 'detail', title: '订单详情', formUuid: 'FORM_XXX' });
        }
        return <button onClick={() => openDetail({})}>详情</button>;
      }
    `;

    expect(() => compileCanvasLocal(badSource, {
      sourcePath: 'pages/src/workbench.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_FORM_DETAIL_LINK_INVALID',
      details: expect.objectContaining({
        issueType: 'missing-formInstId',
      }),
    }));
  });

  test('rejects detail links that fallback formInstId to an empty string', () => {
    const badSource = `
      import React from 'react';
      export default function App() {
        function openDetail(row) {
          openForm({ type: 'detail', title: '订单详情', formUuid: 'FORM_XXX', formInstId: row.formInstId || '' });
        }
        return <button onClick={() => openDetail({})}>详情</button>;
      }
    `;

    expect(() => compileCanvasLocal(badSource, {
      sourcePath: 'pages/src/workbench.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_FORM_DETAIL_LINK_INVALID',
      details: expect.objectContaining({
        issueType: 'empty-formInstId-fallback',
      }),
    }));
  });

  test('rejects legacy instance id fallback chains that skip row.formInstId', () => {
    const badSource = `
      import React from 'react';
      export default function App() {
        function openDetail(row) {
          openForm({
            type: 'detail',
            title: '订单详情',
            formUuid: 'FORM_XXX',
            formInstId: row.formInstanceId || row.instanceId || row.id,
          });
        }
        return <button onClick={() => openDetail({})}>详情</button>;
      }
    `;

    expect(() => compileCanvasLocal(badSource, {
      sourcePath: 'pages/src/workbench.canvas.jsx',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_FORM_DETAIL_LINK_INVALID',
      details: expect.objectContaining({
        issueType: 'missing-primary-formInstId',
      }),
    }));
  });

  test('allows detail opens that resolve row.formInstId first and block missing ids', () => {
    const source = `
      import React, { useState } from 'react';
      export default function App() {
        const [formRequest, setFormRequest] = useState(null);
        function openDetail(row) {
          const formInstId = row && (row.formInstId || row.formInstanceId || row.instanceId || row.id);
          if (!formInstId) {
            return;
          }
          setFormRequest({ type: 'detail', title: '订单详情', formUuid: 'FORM_XXX', formInstId });
        }
        return <button onClick={() => openDetail({ formInstId: 'FINST_1' })}>{formRequest ? '打开中' : '详情'}</button>;
      }
    `;

    expect(() => compileCanvasLocal(source)).not.toThrow();
  });

  test('maps lucide-react named icons to LucideReact and DynamicIcon to its runtime global', () => {
    const src = `
      import React from 'react';
      import { Search, DynamicIcon } from 'lucide-react';
      export default function App() {
        return <div><Search /><DynamicIcon name="settings" /></div>;
      }
    `;

    const { runtimeCode, importedModules } = compileCanvasLocal(src);

    expect(JSON.parse(importedModules)).toEqual(['lucide-react', 'react']);
    expect(runtimeCode).toMatch(/window\.LucideReact/);
    expect(runtimeCode).toMatch(/window\.DynamicIcon/);
    expect(runtimeCode).not.toMatch(/Search\s*=\s*_[A-Za-z0-9$]*DynamicIcon\.Search/);

    function Search() { return 'search-node'; }
    function DynamicIcon() { return 'dynamic-node'; }
    const win = stubReactWindow({
      LucideReact: { Search },
      DynamicIcon,
    });
    const Comp = assembleRuntime(runtimeCode, win);
    const tree = Comp({});

    expect(tree.type).toBe('div');
    expect(tree.children[0].type).toBe('Search');
    expect(tree.children[1].type).toBe('DynamicIcon');
  });

  test('maps lucide-react namespace and default imports to the verified canvas globals', () => {
    const src = `
      import React from 'react';
      import DynamicIcon, * as Icons from 'lucide-react';
      export default function App() {
        return <section><Icons.RefreshCw /><DynamicIcon name="refresh-cw" /></section>;
      }
    `;

    const { runtimeCode, importedModules } = compileCanvasLocal(src);

    expect(JSON.parse(importedModules)).toEqual(['lucide-react', 'react']);
    expect(runtimeCode).toMatch(/window\.LucideReact/);
    expect(runtimeCode).toMatch(/window\.DynamicIcon/);

    function RefreshCw() { return 'refresh-node'; }
    function DynamicIcon() { return 'dynamic-node'; }
    const win = stubReactWindow({
      LucideReact: { RefreshCw },
      DynamicIcon,
    });
    const Comp = assembleRuntime(runtimeCode, win);
    const tree = Comp({});

    expect(tree.type).toBe('section');
    expect(tree.children[0].type).toBe('RefreshCw');
    expect(tree.children[1].type).toBe('DynamicIcon');
  });

  test('allows explicit legacy window fallback for runtime alias drift', () => {
    const oldValue = process.env.OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS;
    process.env.OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS = '1';
    try {
      const src = `
        import { FutureWidget } from 'future-runtime-package';
        export default function App() {
          return <FutureWidget />;
        }
      `;

      const { runtimeCode, importedModules } = compileCanvasLocal(src);

      expect(runtimeCode).toContain('window["future-runtime-package"]');
      expect(JSON.parse(importedModules)).toEqual(['future-runtime-package', 'react']);
    } finally {
      if (oldValue === undefined) {
        delete process.env.OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS;
      } else {
        process.env.OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS = oldValue;
      }
    }
  });

  test('does not redeclare const YidaComp when it is the default export', () => {
    const src = `
      const YidaComp = () => <div>ok</div>;
      export default YidaComp;
    `;

    const { runtimeCode } = compileCanvasLocal(src);

    expect(runtimeCode).toMatch(/const YidaComp\b/);
    expect(runtimeCode).not.toMatch(/var YidaComp\s*=\s*YidaComp/);

    const Comp = assembleRuntime(runtimeCode, stubReactWindow());
    expect(typeof Comp).toBe('function');
    expect(Comp({}).type).toBe('div');
  });

  test('does not redeclare let YidaComp when it is the default export', () => {
    const src = `
      let YidaComp = function Page() {
        return <section>let entry</section>;
      };
      export default YidaComp;
    `;

    const { runtimeCode } = compileCanvasLocal(src);

    expect(runtimeCode).toMatch(/let YidaComp\b/);
    expect(runtimeCode).not.toMatch(/var YidaComp\s*=\s*YidaComp/);

    const Comp = assembleRuntime(runtimeCode, stubReactWindow());
    expect(typeof Comp).toBe('function');
    expect(Comp({}).type).toBe('section');
  });

  test('does not redeclare class YidaComp when it is the default export', () => {
    const src = `
      class YidaComp {
        constructor(props) {
          this.props = props;
        }
        render() {
          return <main>{this.props.title}</main>;
        }
      }
      export default YidaComp;
    `;

    const { runtimeCode } = compileCanvasLocal(src);

    expect(runtimeCode).toMatch(/class YidaComp\b/);
    expect(runtimeCode).not.toMatch(/var YidaComp\s*=\s*YidaComp/);

    const Comp = assembleRuntime(runtimeCode, stubReactWindow());
    expect(typeof Comp).toBe('function');
    expect(new Comp({ title: 'class entry' }).render().type).toBe('main');
  });

  test('keeps function YidaComp default export parseable', () => {
    const src = `
      function YidaComp(props) {
        return <b>{props.name}</b>;
      }
      export default YidaComp;
    `;

    const { runtimeCode } = compileCanvasLocal(src);

    expect(runtimeCode).toMatch(/function YidaComp\b/);
    expect(runtimeCode).not.toMatch(/var YidaComp\s*=\s*YidaComp/);

    const Comp = assembleRuntime(runtimeCode, stubReactWindow());
    expect(Comp({ name: 'function entry' }).type).toBe('b');
  });

  test('still aliases non-YidaComp default exports to YidaComp', () => {
    const src = `
      const App = () => <i>app entry</i>;
      export default App;
    `;

    const { runtimeCode } = compileCanvasLocal(src);

    expect(runtimeCode).toMatch(/const App\b/);
    expect(runtimeCode).toMatch(/var YidaComp\s*=\s*App/);

    const Comp = assembleRuntime(runtimeCode, stubReactWindow());
    expect(Comp({}).type).toBe('i');
  });

  test('reports Canvas wrapper parse failures before publish/runtime', () => {
    const src = `
      const window = {};
      export default function App() {
        return <div>ok</div>;
      }
    `;

    let error;
    try {
      compileCanvasLocal(src, { sourcePath: 'pages/src/bad.canvas.jsx' });
    } catch (compileError) {
      error = compileError;
    }

    expect(error).toBeTruthy();
    expect(error.code).toBe('OPENYIDA_CANVAS_RUNTIME_PARSE_FAILED');
    expect(error.message).toContain('运行时装配校验');
    expect(error.message).toContain('window');
    expect(error.message).toContain('pages/src/bad.canvas.jsx');
  });

  test('produces new Function-compatible runtimeCode that yields a rendering YidaComp', () => {
    const src = `
      import React, { useState } from 'react';
      import { Button, Card } from 'antd';
      import './styles.css';
      export default function App(props) {
        const [n, setN] = useState(0);
        return (
          <Card title="hello">
            <Button onClick={() => setN(n + 1)}>{n}</Button>
          </Card>
        );
      }
    `;
    const { runtimeCode, importedModules } = compileCanvasLocal(src);

    // runtimeCode 不得再含 JSX 或 ESM 语法
    expect(runtimeCode).not.toMatch(/</); // 无 JSX 尖括号残留（createElement 后应无 <）
    expect(runtimeCode).not.toMatch(/\bimport\s/);
    expect(runtimeCode).not.toMatch(/\bexport\s/);
    // 依赖被改写为 window 别名
    expect(runtimeCode).toMatch(/window\.React/);
    expect(runtimeCode).toMatch(/window\.antd/);
    // 收敛出 YidaComp 绑定
    expectCanvasEntry(runtimeCode);

    // importedModules 是 JSON 数组字符串；副作用 CSS 不计入
    const mods = JSON.parse(importedModules);
    expect(mods).toEqual(expect.arrayContaining(['antd', 'react']));
    expect(mods).not.toContain('./styles.css');

    // 运行时装配后能拿到组件并渲染
    const win = stubReactWindow({
      antd: { Button: function Button() {}, Card: function Card() {} },
    });
    const Comp = assembleRuntime(runtimeCode, win);
    expect(typeof Comp).toBe('function');
    const tree = Comp({});
    expect(tree.type).toBe('Card');
    expect(tree.children[0].type).toBe('Button');
  });

  test('auto-injects React binding when source omits react import but uses JSX', () => {
    const src = `
      export default function Hello() {
        return <div className="x">hi</div>;
      }
    `;
    const { runtimeCode, importedModules } = compileCanvasLocal(src);
    expect(runtimeCode).toMatch(/window\.React/);
    expect(JSON.parse(importedModules)).toContain('react');
    const win = stubReactWindow();
    const Comp = assembleRuntime(runtimeCode, win);
    const tree = Comp({});
    expect(tree.type).toBe('div');
  });

  test('handles arrow-function default export and namespace import', () => {
    const src = `
      import * as d3 from 'd3';
      const Widget = (props) => <span>{d3.version}</span>;
      export default Widget;
    `;
    const { runtimeCode } = compileCanvasLocal(src);
    expect(runtimeCode).toMatch(/window\.d3/);
    const win = stubReactWindow({ d3: { version: '7.9.0' } });
    const Comp = assembleRuntime(runtimeCode, win);
    const tree = Comp({});
    expect(tree.type).toBe('span');
    expect(tree.children[0]).toBe('7.9.0');
  });

  test('strips TypeScript types', () => {
    const src = `
      import React from 'react';
      interface P { name: string }
      const C: React.FC<P> = (p: P) => <b>{p.name}</b>;
      export default C;
    `;
    const { runtimeCode } = compileCanvasLocal(src);
    expect(runtimeCode).not.toMatch(/interface\s/);
    expect(runtimeCode).not.toMatch(/:\s*P\b/);
    const win = stubReactWindow();
    const Comp = assembleRuntime(runtimeCode, win);
    expect(Comp({ name: 'z' }).type).toBe('b');
  });

  test('compiles the Canvas-first Recharts trend sample', () => {
    const templatePath = path.join(
      __dirname,
      '..',
      'lib',
      'samples',
      'yida-rechart',
      'trend-combo.canvas.jsx'
    );
    const src = fs.readFileSync(templatePath, 'utf8');
    const { runtimeCode, importedModules } = compileCanvasLocal(src, { sourcePath: templatePath });

    expect(JSON.parse(importedModules)).toEqual(['antd', 'react', 'recharts']);
    expect(runtimeCode).toMatch(/window\.Recharts/);
    expect(runtimeCode).toMatch(/window\.antd/);
    expectCanvasEntry(runtimeCode);
  });

  test('compiles the Canvas-first table form without a native page bridge', () => {
    const templatePath = path.join(
      __dirname,
      '..',
      'lib',
      'samples',
      'yida-canvas-table-form',
      'table-form-batch-submit.canvas.jsx'
    );
    const src = fs.readFileSync(templatePath, 'utf8');
    const { runtimeCode, importedModules } = compileCanvasLocal(src, { sourcePath: templatePath });

    expect(JSON.parse(importedModules)).toEqual(['antd', 'dayjs', 'react']);
    expect(runtimeCode).toMatch(/window\.dayjs/);
    expect(runtimeCode).toMatch(/window\.antd/);
    expect(runtimeCode).not.toMatch(/this\.utils\.yida/);
    expectCanvasEntry(runtimeCode);
  });

  test('Canvas page schema installs yida JS API bridge for iframe data access', () => {
    let nodeIndex = 0;
    const schema = buildCanvasPageSchemaObject(
      'function YidaComp() { return null; }',
      'var YidaComp = function YidaComp() { return null; };',
      '["react"]',
      'FORM_CANVAS',
      {
        nextNodeId: () => 'node_' + (++nodeIndex),
        nextSuffix: () => 'stable',
      }
    );

    const root = schema.pages[0].componentsTree[0];
    expect(root.lifeCycles.componentDidMount).toMatchObject({
      name: 'didMount',
      type: 'actionRef',
    });
    expect(schema.actions.module.source).toContain('openyidaInstallYidaApiBridge');
    expect(schema.actions.module.source).toContain('window.__OPENYIDA_YIDA_API__');
    expect(schema.actions.module.source).toContain('this.utils.yida');
    expect(schema.actions.module.source).toContain('searchFormDatas');
    expect(schema.actions.module.compiled).toContain('openyidaInstallYidaApiBridge');
    expect(schema.actions.module.compiled).toContain('exports.didMount = didMount');
  });

});

describe('compileCanvas (async wrapper)', () => {
  test('resolves with runtimeCode + importedModules', async () => {
    const out = await compileCanvas('export default () => <i>ok</i>;');
    expect(out).toHaveProperty('runtimeCode');
    expect(out).toHaveProperty('importedModules');
    expect(out.runtimeCode).toMatch(/YidaComp/);
  });

  test('rejects on empty source', async () => {
    await expect(compileCanvas('   ')).rejects.toMatchObject({
      code: 'OPENYIDA_CANVAS_COMPILE_EMPTY_SOURCE',
    });
  });

  test('rejects with friendly message on invalid syntax', async () => {
    await expect(compileCanvas('export default function( {')).rejects.toMatchObject({
      code: 'OPENYIDA_CANVAS_COMPILE_FAILED',
      message: expect.stringMatching(/本地编译失败/),
    });
  });

  test('preserves emoji CliError code and details from local compile', async () => {
    await expect(compileCanvas(`
      import React from 'react';
      export default function Page() {
        return <div>Menu ☰</div>;
      }
    `, {
      sourcePath: 'pages/src/emoji.canvas.jsx',
    })).rejects.toMatchObject({
      code: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
      details: {
        artifact: 'pages/src/emoji.canvas.jsx',
        issues: [
          expect.objectContaining({
            line: 4,
            column: expect.any(Number),
            emoji: '☰',
          }),
        ],
      },
    });
  });
});
