'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CANVAS_YIDA_API_BRIDGE_SOURCE } = require('../lib/app/services/canvas-page-schema-builder');
const guide = fs.readFileSync(path.join(__dirname,
  '../yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md'), 'utf8');
const helper = guide.slice(guide.indexOf('function getCanvasBridge('), guide.indexOf('\n\nfunction getCsrfToken('));
const origin = 'https://tenant.example';
function frame(parent, frameOrigin = origin) {
  const value = { location: { origin: frameOrigin } };
  value.parent = parent || value;
  value.top = parent ? parent.top || parent : value;
  return value;
}
function read(window, key = '__OPENYIDA_YIDA_API__', method = 'searchFormDatas') {
  return vm.runInNewContext(helper + '\ngetCanvasBridge(key, method)', { window, key, method });
}

test('a current-page bridge returns before inspecting a cross-origin parent or its identity', () => {
  const inspectParent = jest.fn(() => { throw new Error('SecurityError'); });
  const window = frame();
  Object.defineProperty(window, 'parent', { get: inspectParent });
  window.loginUser = { userId: 'current-page-user' };
  window.__OPENYIDA_YIDA_API__ = { searchFormDatas() {} };
  expect(read(window)).toBe(window.__OPENYIDA_YIDA_API__);
  expect(inspectParent).not.toHaveBeenCalled();
});

test.each([
  ['__OPENYIDA_YIDA_API__', 'searchFormDatas'],
  ['__OPENYIDA_CONNECTOR_API__', 'invoke'],
  ['__OPENYIDA_UTILS__', 'toast'],
])('bridge helper supports a nested same-origin frame for %s', (key, method) => {
  const parent = frame();
  const bridge = { [method]() {} };
  parent[key] = bridge;
  expect(read(frame(frame(parent)), key, method)).toBe(bridge);
});

test.each(['https://other.example', 'http://tenant.example', 'https://tenant.example:8443']) (
  'a different origin %s is rejected before reading bridge properties', otherOrigin => {
    const parent = frame(null, otherOrigin);
    const bridgeRead = jest.fn(() => ({ searchFormDatas() {} }));
    Object.defineProperty(parent, '__OPENYIDA_YIDA_API__', { get: bridgeRead });
    expect(read(frame(parent))).toBeNull();
    expect(bridgeRead).not.toHaveBeenCalled();
  });

test('a browser SecurityError stops at the cross-origin boundary without reading identity or bridge', () => {
  const accessed = [];
  const parent = new Proxy({}, { get(_value, key) {
    accessed.push(key);
    throw new Error('SecurityError');
  } });
  const window = frame();
  window.parent = parent;
  expect(read(window)).toBeNull();
  expect(accessed).toEqual(['location']);
});

test('missing bridges and opaque origins return unavailable', () => {
  expect(read(frame())).toBeNull();
  const parent = frame(null, 'null');
  parent.__OPENYIDA_YIDA_API__ = { searchFormDatas() {} };
  expect(read(frame(parent, 'null'))).toBeNull();
});

test('the published scaffold installs bridges only in accessible same-origin windows', () => {
  const accessed = [];
  const remote = new Proxy({}, {
    get(_value, key) { accessed.push(['get', key]); throw new Error('SecurityError'); },
    set(_value, key) { accessed.push(['set', key]); throw new Error('SecurityError'); },
  });
  const parent = frame();
  const window = frame(parent);
  window.top = remote;
  vm.runInNewContext(CANVAS_YIDA_API_BRIDGE_SOURCE + '\nopenyidaInstallYidaApiBridge.call({ utils: {} })', { window });
  expect(window.__OPENYIDA_YIDA_API__).toBe(parent.__OPENYIDA_YIDA_API__);
  expect(accessed).toEqual([['get', 'location']]);
});
