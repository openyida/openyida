'use strict';

/* global jest */

const Babel = require('../../lib/core/babel');
const transformModulesCommonjs = require('@babel/plugin-transform-modules-commonjs');

// A small hook host exercises the shipped component's requests and view state.
function mount(source, bridge, fetch, options = {}) {
  let props = options.props || {};
  const component = options.component || 'TaskInboxSection';
  const slots = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  let tree;
  const cleanups = [];
  const React = {
    createContext: () => ({}),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = typeof initial === 'function' ? initial() : initial; }
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; dirty = true; }];
    },
    useRef(value) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = { current: value }; }
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) { slots[index] = { deps, value: factory() }; }
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.some((value, i) => value !== old[i])) {
        slots[index] = deps;
        effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
  };
  const antd = { Input: Object.assign(function Input() {}, { Search: 'Search' }), Typography: { Title: 'Title', Text: 'Text' }, Empty: 'Empty' };
  for (const name of ['ConfigProvider', 'Drawer', 'Alert', 'Button', 'Pagination', 'Space', 'Spin', 'Table', 'Tabs', 'Timeline', 'Select']) { antd[name] = name; }
  const window = { __OPENYIDA_YIDA_API__: bridge, fetch, loginUser: { userId: 'visitor' }, document: { hidden: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }, addEventListener: jest.fn(), removeEventListener: jest.fn(), setTimeout };
  const compiled = Babel.transform(source + '\nexport { ' + component + ' };', { presets: [Babel.presets.react], plugins: [transformModulesCommonjs] }).code;
  const module = { exports: {} };
  const requireModule = name => name === 'react' ? React : name === 'antd' ? antd : {};
  new Function('require', 'module', 'exports', 'window', compiled)(requireModule, module, module.exports, window);
  const render = () => {
    cursor = 0; dirty = false; effects = [];
    tree = module.exports[component](props);
    effects.forEach(effect => effect());
  };
  const nodes = type => {
    const result = [];
    function walk(value) {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== 'object') { return; }
      if (value.type === type || typeof value.type === 'function' && value.type.name === type) { result.push(value); }
      walk(value.props?.children);
    }
    walk(tree);
    return result;
  };
  render();
  return {
    nodes,
    updateProps(next) { props = { ...props, ...next }; render(); },
    async flush() {
      for (let i = 0; i < 8; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (dirty) { render(); }
      }
    },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    window,
  };
}

module.exports = { mount };
