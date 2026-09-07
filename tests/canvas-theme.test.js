'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { run } = require('../lib/core/sample');
const samples = [
  'openyida-scaffold/canvas-form-drawer.canvas.jsx',
  'yida-canvas-table-form/table-form-batch-submit.canvas.jsx',
  'yida-rechart/trend-combo.canvas.jsx',
];
const fragment = (file) => fs.readFileSync(path.join(__dirname, '../lib/samples', file), 'utf8')
  .match(/\/\/ @openyida-canvas-theme:start\n([\s\S]*?)\/\/ @openyida-canvas-theme:end/)[1];

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
  const context = {
    React: {
      useRef: (value) => ({ current: value === null ? root : value }),
      useState: (value) => { state = value; return [value, (update) => { state = update(state); }]; },
      useLayoutEffect: (effect) => { cleanup = effect(); },
    },
  };
  vm.createContext(context);
  vm.runInContext(fragment(samples[0]), context);
  return { context, root, values, probe, observed, listeners,
    notify: () => notify(), flush: () => pending(), cleanup: () => cleanup(), state: () => state };
}

test('standalone samples share the same theme implementation', () => {
  samples.forEach((sample) => expect(fragment(sample)).toBe(fragment(samples[0])));
});

test('reads component scope, preserves semantic defaults and rejects invalid colors', () => {
  const fixture = setup();
  fixture.values['--color-text1-4'] = 'invalid';
  const token = fixture.context.readCanvasTheme(fixture.root, { colorText: '#111', colorError: '#f00' });
  expect(token.colorPrimary).toBe('rgb(0, 128, 0)');
  expect(token.colorLink).toBe(token.colorPrimary);
  expect(token.colorText).toBe('#111');
  expect(token.colorError).toBe('#f00');
  expect(fixture.probe.remove).toHaveBeenCalled();
});

test('refreshes after late theme load and falls back after removal, then cleans up', () => {
  const fixture = setup();
  fixture.context.useCanvasTheme({ colorPrimary: '#1677ff' });
  expect(fixture.state().colorPrimary).toBe('rgb(0, 128, 0)');
  expect(fixture.observed).toEqual([fixture.root, fixture.root.parentElement, fixture.root.ownerDocument.head]);
  fixture.values['--color-brand1-6'] = 'rgb(255, 128, 0)';
  fixture.listeners.load();
  fixture.flush();
  expect(fixture.state().colorPrimary).toBe('rgb(255, 128, 0)');
  delete fixture.values['--color-brand1-6'];
  fixture.notify();
  fixture.flush();
  expect(fixture.state().colorPrimary).toBe('#1677ff');
  fixture.cleanup();
  expect(fixture.observed).toEqual([]);
  expect(fixture.listeners).toEqual({});
});

test('sample command extracts a reusable theme hook with React import', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-theme-'));
  try {
    const output = path.join(directory, 'theme.jsx');
    await run(['openyida-page-template', 'canvas-theme', '--output', output]);
    const source = fs.readFileSync(output, 'utf8');
    expect(source).toBe("import React from 'react';\n\n" + fragment(samples[0]));
    expect(source).not.toContain('function YidaComp');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
