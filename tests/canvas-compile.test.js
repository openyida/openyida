'use strict';

const fs = require('fs');
const path = require('path');

const {
  compileCanvas,
  compileCanvasLocal,
  extractImportedModules,
  resolveWindowAlias,
} = require('../lib/app/canvas-compile');

/**
 * 模拟 @ali/vc-deep-yida 的 YidaCodeCanvas 运行时装配（factory.tsx）：
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

function stubCanvasSampleWindow() {
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
    expect(runtimeCode).toMatch(/YidaComp\s*=/);

    // importedModules 是 JSON 数组字符串；副作用 CSS 不计入
    const mods = JSON.parse(importedModules);
    expect(mods).toEqual(expect.arrayContaining(['antd', 'react']));
    expect(mods).not.toContain('./styles.css');

    // 运行时契约：装配后能拿到组件并渲染
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

  test('compiles the recommended dashboard starter sample', () => {
    const samplePath = path.join(
      __dirname,
      '..',
      'lib',
      'samples',
      'yida-canvas-custom-page',
      'dashboard-starter.canvas.jsx'
    );
    const src = fs.readFileSync(samplePath, 'utf8');
    const { runtimeCode, importedModules } = compileCanvasLocal(src);
    const mods = JSON.parse(importedModules);

    expect(mods).toEqual(expect.arrayContaining([
      'ahooks',
      'antd',
      'react',
      'recharts',
    ]));
    expect(mods).not.toContain('lucide-react');
    expect(mods).not.toContain('fs');
    expect(runtimeCode).toMatch(/window\.antd/);
    expect(runtimeCode).toMatch(/window\.Recharts/);
    expect(runtimeCode).toMatch(/window\.ahooks/);
    expect(runtimeCode).toMatch(/YidaComp\s*=/);
    expect(runtimeCode).not.toMatch(/\bimport\s/);
    expect(runtimeCode).not.toMatch(/\bexport\s/);
  });

  test('compiles the portal native components bridge sample', () => {
    const samplePath = path.join(
      __dirname,
      '..',
      'lib',
      'samples',
      'yida-canvas-custom-page',
      'portal-native-components.canvas.jsx'
    );
    const src = fs.readFileSync(samplePath, 'utf8');
    const { runtimeCode, importedModules } = compileCanvasLocal(src);
    const mods = JSON.parse(importedModules);

    expect(mods).toEqual(['react']);
    expect(runtimeCode).toMatch(/window\.YidaNativeComponents/);
    expect(runtimeCode).toMatch(/window\.Deep/);
    expect(runtimeCode).toMatch(/window\.DeepYida/);
    expect(runtimeCode).toMatch(/YidaComp\s*=/);
    expect(runtimeCode).not.toMatch(/\bimport\s/);
    expect(runtimeCode).not.toMatch(/\bexport\s/);
    expect(runtimeCode).not.toMatch(/@ali\/deep/);
    expect(runtimeCode).not.toMatch(/@ali\/vc-deep-yida/);
  });

  test('compiles the native components smoke sample', () => {
    const samplePath = path.join(
      __dirname,
      '..',
      'lib',
      'samples',
      'yida-canvas-custom-page',
      'native-components-smoke.canvas.jsx'
    );
    const src = fs.readFileSync(samplePath, 'utf8');
    const { runtimeCode, importedModules } = compileCanvasLocal(src);
    const mods = JSON.parse(importedModules);

    expect(mods).toEqual(['react']);
    expect(runtimeCode).toMatch(/window\.Deep/);
    expect(runtimeCode).toMatch(/window\.DeepYida/);
    expect(runtimeCode).toMatch(/window\.YidaNativeComponents/);
    expect(runtimeCode).toMatch(/DataManageViews/);
    expect(runtimeCode).toMatch(/formUuid/);
    expect(runtimeCode).toMatch(/YidaComp\s*=/);
    expect(runtimeCode).not.toMatch(/\bimport\s/);
    expect(runtimeCode).not.toMatch(/\bexport\s/);
    expect(runtimeCode).not.toMatch(/@ali\/deep/);
    expect(runtimeCode).not.toMatch(/@ali\/vc-deep-yida/);
  });

  test('keeps the official homepage sample self-contained and photographic', () => {
    const samplePath = path.join(
      __dirname,
      '..',
      'lib',
      'samples',
      'yida-canvas-custom-page',
      'official-homepage.canvas.jsx'
    );
    const source = fs.readFileSync(samplePath, 'utf8');
    const embeddedPhotos = source.match(/data:image\/jpeg;base64/g) || [];
    const { runtimeCode, importedModules } = compileCanvasLocal(source);

    expect(embeddedPhotos.length).toBeGreaterThanOrEqual(3);
    expect(source).not.toContain('data:image/svg+xml');
    expect(source).toMatch(/oy-hero-photo/);
    expect(source).toMatch(/oy-blend-grid/);
    expect(source).toMatch(/oy-story-photo/);
    expect(source).toMatch(/oy-store-band/);
    expect(JSON.parse(importedModules)).toEqual(['antd', 'react']);
    expect(runtimeCode).not.toMatch(/window\.ahooks/);
    expect(runtimeCode).toMatch(/YidaComp\s*=/);
  });

  test('all Canvas samples are raw-publish safe', () => {
    const samplesDir = path.join(__dirname, '..', 'lib', 'samples', 'yida-canvas-custom-page');
    const sampleFiles = fs.readdirSync(samplesDir)
      .filter((name) => name.endsWith('.canvas.jsx'))
      .sort();

    expect(sampleFiles.length).toBeGreaterThan(0);

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
      for (const filename of sampleFiles) {
        const sourcePath = path.join(samplesDir, filename);
        const source = fs.readFileSync(sourcePath, 'utf8');

        expect(source).not.toContain("JSON.parse('{{");

        const { runtimeCode } = compileCanvasLocal(source);
        const stubWindow = stubCanvasSampleWindow();
        global.document = stubWindow.document;
        global.getComputedStyle = stubWindow.getComputedStyle;
        global.fetch = () => Promise.reject(new Error('fetch should not run in raw sample smoke'));
        global.URLSearchParams = URLSearchParams;
        global.AbortController = class {
          constructor() { this.signal = {}; }
          abort() {}
        };
        global.localStorage = stubWindow.localStorage;
        global.window = stubWindow;

        const rendered = renderCanvasRuntime(runtimeCode, stubWindow);
        expect(rendered).toBeTruthy();

        const visibleText = collectVisibleStrings(rendered).join('\n');
        expect(visibleText).not.toMatch(/\{\{(?!OPENYIDA_CANVAS_CONTROL_CSS)[A-Z0-9_]+\}\}/);
      }
    } finally {
      global.document = previousGlobals.document;
      global.getComputedStyle = previousGlobals.getComputedStyle;
      global.fetch = previousGlobals.fetch;
      global.URLSearchParams = previousGlobals.URLSearchParams;
      global.AbortController = previousGlobals.AbortController;
      global.localStorage = previousGlobals.localStorage;
      global.window = previousGlobals.window;
    }
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
    await expect(compileCanvas('   ')).rejects.toThrow(/源码为空/);
  });

  test('rejects with friendly message on invalid syntax', async () => {
    await expect(compileCanvas('export default function( {')).rejects.toThrow(/本地编译失败/);
  });
});
