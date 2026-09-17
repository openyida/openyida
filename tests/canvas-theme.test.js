'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { run } = require('../lib/core/sample');
const { buildApplicationProvider, assembleApplicationTheme, run: buildTheme } = require('../yida-skills/skills/yida-canvas-custom-page/scripts/build-canvas-theme');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const samples = [
  'openyida-scaffold/canvas-form-drawer.canvas.jsx',
  'yida-canvas-table-form/table-form-batch-submit.canvas.jsx',
  'yida-rechart/trend-combo.canvas.jsx',
];
const provider = buildApplicationProvider();
const runtime = compileCanvasLocal(provider + '\nfunction YidaComp() { return <CanvasThemeProvider />; }').runtimeCode;

function setup() {
  const values = { '--color-brand1-6': 'rgb(0, 128, 0)' };
  const listeners = {};
  const observed = [];
  let notify;
  let pending;
  let cleanup;
  let state;
  const root = { parentElement: { parentElement: null }, appendChild: jest.fn() };
  const probe = { style: {}, remove: jest.fn() };
  const view = {
    CSS: { supports: (_property, value) => value !== 'invalid' },
    getComputedStyle: (element) => element === root
      ? { getPropertyValue: (name) => values[name] || '' }
      : { color: probe.style.color },
    MutationObserver: class {
      constructor(callback) { notify = callback; }
      observe(node) { observed.push(node); }
      disconnect() { observed.length = 0; }
    },
    requestAnimationFrame: (callback) => { pending = callback; return 1; },
    cancelAnimationFrame: () => { pending = undefined; },
    addEventListener: (name, callback) => { listeners[name] = callback; },
    removeEventListener: (name) => { delete listeners[name]; },
  };
  root.ownerDocument = {
    defaultView: view, head: {}, createElement: () => probe,
    addEventListener: view.addEventListener, removeEventListener: view.removeEventListener,
  };
  const context = { window: { antd: {},
    React: {
      createContext: () => ({}),
      createElement: (type, props, ...children) => ({ type, props, children }),
      useMemo: (factory) => factory(),
      useRef: (value) => ({ current: value === null ? root : value }),
      useState: (value) => { state = value; return [value, (update) => { state = update(state); }]; },
      useLayoutEffect: (effect) => { cleanup = effect(); },
    },
  } };
  vm.createContext(context);
  vm.runInContext(runtime, context);
  return { context, root, values, probe, observed, listeners,
    notify: () => notify(), flush: () => pending(), cleanup: () => cleanup(), state: () => state };
}

test.each(samples)('sample %s assembles the maintained provider', (sample) => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/samples', sample), 'utf8');
  const assembled = assembleApplicationTheme(source);
  expect(assembled).toContain(buildApplicationProvider(false));
  expect(assembled).not.toContain('@canvas-application-theme');
  expect(assembled).not.toMatch(/function (?:useCanvasTheme|readCanvasTheme)\(/);
  expect(assembled.match(/function CanvasThemeProvider\(/g)).toHaveLength(1);
  expect(compileCanvasLocal(assembled).runtimeCode).toContain('CanvasThemeProvider');
});

test('assembly preserves ordinary sources and rejects duplicate markers', () => {
  expect(assembleApplicationTheme('const value = 1;')).toBe('const value = 1;');
  expect(() => assembleApplicationTheme('/* @canvas-application-theme *//* @canvas-application-theme */')).toThrow('exactly one');
});

test('reads component scope and omits invalid colors', () => {
  const fixture = setup();
  fixture.values['--color-text1-4'] = 'invalid';
  const token = fixture.context.resolveCanvasTheme(fixture.root);
  expect(token.colorPrimary).toBe('rgb(0, 128, 0)');
  expect(token.colorLink).toBe(token.colorPrimary);
  expect(token.colorText).toBeUndefined();
  expect(token.colorError).toBeUndefined();
  expect(fixture.probe.remove).toHaveBeenCalled();
});

test('refreshes after late theme load and clears removed tokens, then cleans up', () => {
  const fixture = setup();
  fixture.context.CanvasThemeProvider({});
  expect(fixture.state().token.colorPrimary).toBe('rgb(0, 128, 0)');
  expect(fixture.observed).toEqual([fixture.root, fixture.root.parentElement, fixture.root.ownerDocument.head]);
  fixture.values['--color-brand1-6'] = 'rgb(255, 128, 0)';
  fixture.listeners.load({ target: { tagName: 'LINK' } });
  fixture.flush();
  expect(fixture.state().token.colorPrimary).toBe('rgb(255, 128, 0)');
  delete fixture.values['--color-brand1-6'];
  fixture.notify();
  fixture.flush();
  expect(fixture.state()).toEqual({ token: {}, components: { Drawer: {} }, controls: null, status: 'missing' });
  fixture.cleanup();
  expect(fixture.observed).toEqual([]);
  expect(fixture.listeners).toEqual({});
});

test('link hover and pressed colors refresh with the application brand scale', () => {
  const fixture = setup();
  fixture.values['--color-brand1-5'] = 'rgb(20, 140, 20)';
  fixture.values['--color-brand1-9'] = 'rgb(0, 70, 0)';
  fixture.context.CanvasThemeProvider({});
  expect(fixture.state().token.colorLinkHover).toBe('rgb(20, 140, 20)');
  expect(fixture.state().token.colorLinkActive).toBe('rgb(0, 70, 0)');
  fixture.values['--color-brand1-5'] = 'rgb(240, 120, 20)';
  fixture.values['--color-brand1-9'] = 'rgb(150, 60, 0)';
  fixture.listeners['openyida:theme-change']();
  fixture.flush();
  expect(fixture.state().token.colorLinkHover).toBe('rgb(240, 120, 20)');
  expect(fixture.state().token.colorLinkActive).toBe('rgb(150, 60, 0)');
  fixture.cleanup();
});

test('sample command outputs the maintained provider in application mode', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-theme-'));
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const output = path.join(directory, 'theme.jsx');
    await run(['openyida-page-template', 'canvas-theme', '--output', output]);
    const source = fs.readFileSync(output, 'utf8');
    expect(source).toBe(provider);
    expect(source).not.toContain('#1677ff');
    expect(source).not.toContain('function YidaComp');
  } finally {
    errorSpy.mockRestore();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test('page and panel roles use their own platform token before the shared white fallback', () => {
  const fixture = setup();
  fixture.values['--color-white'] = 'rgb(250, 250, 250)';
  fixture.values['--pod-page-bg-color'] = 'rgb(240, 240, 240)';
  const token = fixture.context.resolveCanvasTheme(fixture.root);
  expect(token.colorBgLayout).toBe('rgb(240, 240, 240)');
  expect(token.colorBgContainer).toBe('rgb(250, 250, 250)');
  expect(token.colorBgElevated).toBe(token.colorBgContainer);
  fixture.values['--pod-card-bg-color'] = 'rgb(255, 255, 255)';
  expect(fixture.context.resolveCanvasTheme(fixture.root).colorBgContainer).toBe('rgb(255, 255, 255)');
});

test('theme parse errors clear stale colors and expose an error state', () => {
  const fixture = setup();
  fixture.context.CanvasThemeProvider({});
  fixture.root.ownerDocument.defaultView.CSS.supports = () => { throw new Error('invalid style'); };
  fixture.listeners['openyida:theme-change']();
  fixture.flush();
  expect(fixture.state()).toEqual({ token: {}, components: {}, controls: null, status: 'error' });
  fixture.cleanup();
});


test('Drawer uses the shell surface independently of cards and refreshes with the theme', () => {
  const fixture = setup();
  fixture.values['--color-white'] = 'rgb(255, 255, 255)';
  fixture.values['--pod-card-bg-color'] = 'rgb(230, 230, 230)';
  fixture.values['--pod-shell-theme-bg-color'] = 'rgb(240, 245, 250)';
  fixture.context.CanvasThemeProvider({});
  expect(fixture.state().components.Drawer.colorBgElevated).toBe('rgb(240, 245, 250)');
  expect(fixture.state().token.colorBgElevated).toBe('rgb(230, 230, 230)');
  expect(fixture.state().token.colorBgContainer).toBe('rgb(230, 230, 230)');
  fixture.values['--pod-shell-theme-bg-color'] = 'rgb(20, 25, 30)';
  fixture.listeners['openyida:theme-change']();
  fixture.flush();
  expect(fixture.state().components.Drawer.colorBgElevated).toBe('rgb(20, 25, 30)');
  delete fixture.values['--pod-shell-theme-bg-color'];
  fixture.notify();
  fixture.flush();
  expect(fixture.state().components.Drawer.colorBgElevated).toBe('rgb(255, 255, 255)');
  fixture.cleanup();
});

test.each([
  ['rgb(190, 132, 64)', 'rgb(255, 255, 255)', 'rgb(35, 30, 25)'],
  ['rgb(245, 205, 80)', 'rgb(255, 255, 255)', 'rgb(30, 30, 30)'],
  ['rgb(20, 80, 150)', 'rgb(255, 255, 255)', 'rgb(30, 30, 30)'],
  ['rgb(80, 160, 220)', 'rgb(25, 25, 25)', 'rgb(235, 235, 235)'],
])('control text contrasts with selected/normal/solid surfaces for %s', (primary, surface, text) => {
  const fixture = setup();
  const token = { colorPrimary: primary, colorBgContainer: surface, colorText: text, colorPrimaryHover: 'rgb(40, 40, 40)', colorPrimaryActive: 'rgb(10, 10, 10)' };
  const controls = fixture.context.resolveCanvasControls(token);
  for (const [fg, bg] of [[controls.text, surface], [controls.selectedColor, controls.selectedBg], [controls.primaryText, primary], [controls.primaryText, controls.primaryHover], [controls.primaryText, controls.primaryActive]]) {
    expect(fixture.context.canvasContrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  }
  const components = fixture.context.resolveCanvasControlComponents(token, controls);
  expect(components.Segmented.itemSelectedBg).not.toBe(primary);
  expect(components.Tabs.itemColor).toBe(controls.text);
  expect(components.Button.primaryColor).toBe(controls.primaryText);
  expect(components.Button.colorError).toBeUndefined();
  expect(components.Button.dangerColor).toBeUndefined();
});

test('control component defaults refresh and disappear when the theme is removed', () => {
  const fixture = setup();
  fixture.context.CanvasThemeProvider({});
  const before = fixture.state().components.Segmented.itemSelectedBg;
  fixture.values['--color-brand1-6'] = 'rgb(190, 132, 64)';
  fixture.listeners['openyida:theme-change'](); fixture.flush();
  expect(fixture.state().components.Segmented.itemSelectedBg).not.toBe(before);
  expect(fixture.state().controls.selectedColor).toBe(fixture.state().components.Segmented.itemSelectedColor);
  delete fixture.values['--color-brand1-6']; fixture.notify(); fixture.flush();
  expect(fixture.state().components.Segmented).toBeUndefined();
  fixture.cleanup();
});

test.each(['rgba(100, 100, 100, 0.5)', 'color(display-p3 1 0 0)', 'invalid'])('unknown or translucent color %s retains library defaults', primary => {
  const fixture = setup();
  const controls = fixture.context.resolveCanvasControls({ colorPrimary: primary });
  expect(controls).toBeNull();
  expect(fixture.context.resolveCanvasControlComponents({}, controls)).toEqual({});
});

test('contrast math and the gold filter default have independently known results', () => {
  const { context } = setup();
  expect(context.canvasContrast('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBe(21);
  expect(context.canvasContrast('rgb(100, 100, 100)', 'rgb(100, 100, 100)')).toBe(1);
  expect(context.canvasContrast('rgb(119, 119, 119)', 'rgb(255, 255, 255)')).toBeCloseTo(4.478, 3);
  const controls = context.resolveCanvasControls({ colorPrimary: 'rgb(190, 132, 64)', colorText: 'rgb(35, 30, 25)' });
  expect(controls.selectedBg).toBe('rgb(249, 243, 236)');
  expect(controls.selectedColor).toBe('rgb(35, 30, 25)');
  expect(controls.primaryText).toBe('rgb(35, 30, 25)');
});

test('generated theme preview contains controlled categories and compiles', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-controls-preview-'));
  try {
    const css = path.join(directory, 'theme.css'), output = path.join(directory, 'preview.canvas.jsx');
    fs.writeFileSync(css, ':root { --color-brand1-6: rgb(190, 132, 64); }');
    buildTheme(['--theme-file', css, '--output', output]);
    const source = fs.readFileSync(output, 'utf8');
    expect(source).toContain('<Segmented options={categories} value={category} onChange={setCategory}');
    expect(source).toContain('<Radio.Group value={category}');
    expect(source).toContain('<Tabs items=');
    expect(() => compileCanvasLocal(source)).not.toThrow();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
