'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { run } = require('../lib/core/sample');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-view-state.jsx'), 'utf8');
const config = { namespace: 'registration', views: ['list', 'calendar'], filters: { status: ['all', 'pending', 'confirmed'] } };
const startUrl = 'https://tenant.aliwork.com/APP_current/custom/FORM-current?corpid=corp&registration.view=list&registration.page=4&registration.filter.status=pending#platform-anchor';
let context, rendered, cleanup, listeners, browser;

beforeEach(() => {
  listeners = {};
  browser = {
    location: { href: startUrl },
    history: { state: { platformKey: 'keep-me' } },
    addEventListener: jest.fn((name, fn) => { listeners[name] = fn; }),
    removeEventListener: jest.fn((name, fn) => { if (listeners[name] === fn) { delete listeners[name]; } }),
  };
  ['pushState', 'replaceState'].forEach(method => {
    browser.history[method] = jest.fn((_metadata, _title, href) => { browser.location.href = href; });
  });
  context = { URL, window: browser, React: {
    useState: initial => { rendered = initial(); return [rendered, value => { rendered = value; }]; },
    useEffect: effect => { cleanup = effect(); },
  } };
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
});

test('reload restores view, enum filters and page from the address', () => {
  const [state] = context.useCanvasViewState(config);
  expect(state).toEqual({ view: 'list', filters: { status: 'pending' }, page: 4 });
});

test.each(['-2', '0', '1.5', '100001', 'NaN', 'Infinity'])('rejects invalid page %s and unknown view/filter', page => {
  const state = context.readCanvasViewState(config, `https://tenant.aliwork.com/?registration.page=${page}&registration.view=admin&registration.filter.status=secret`);
  expect(state).toEqual({ view: 'list', filters: { status: 'all' }, page: 1 });
});

test('whitelist omits arbitrary fields and preserves other URL owners', () => {
  const href = context.buildCanvasViewStateUrl(config, startUrl, { view: 'calendar', filters: { status: 'confirmed', phone: 'private' }, page: 3, draft: 'private' });
  const url = new URL(href);
  expect(url.pathname).toBe('/APP_current/custom/FORM-current');
  expect(url.searchParams.get('corpid')).toBe('corp');
  expect(url.hash).toBe('#platform-anchor');
  expect(href).not.toContain('private');
  expect(context.readCanvasViewState(config, href)).toEqual({ view: 'calendar', filters: { status: 'confirmed' }, page: 3 });
});

test('changing filter or view resets pagination, preserving history metadata', () => {
  const [, update] = context.useCanvasViewState(config);
  const metadata = browser.history.state;
  update({ filters: { status: 'confirmed' }, page: 9 });
  expect(rendered).toEqual({ view: 'list', filters: { status: 'confirmed' }, page: 1 });
  expect(browser.history.pushState).toHaveBeenCalledWith(metadata, '', expect.stringContaining('corpid=corp'));
  expect(browser.history.pushState.mock.calls[0][0]).toBe(metadata);
  update({ page: 5 });
  update({ view: 'calendar' });
  expect(rendered.page).toBe(1);
});

test('same selections do not add history or reset pagination', () => {
  const [, update] = context.useCanvasViewState(config);
  update({ view: 'list' });
  update({ filters: { status: 'pending' } });
  update({ filters: { phone: 'private' } });
  expect(browser.history.pushState).not.toHaveBeenCalled();
  expect(rendered.page).toBe(4);
});

test('consecutive events use latest URL and replacement does not add a history entry', () => {
  const [, update] = context.useCanvasViewState(config);
  update({ filters: { status: 'confirmed' } });
  update({ page: 2 }, { replace: true });
  expect(rendered).toEqual({ view: 'list', filters: { status: 'confirmed' }, page: 2 });
  expect(browser.history.pushState).toHaveBeenCalledTimes(1);
  expect(browser.history.replaceState).toHaveBeenCalledTimes(1);
});

test('back, forward and cached page return restore state; unmount removes listeners', () => {
  const [, update] = context.useCanvasViewState(config);
  update({ view: 'calendar' });
  const nextUrl = browser.location.href;
  browser.location.href = startUrl;
  listeners.popstate();
  expect(rendered.page).toBe(4);
  expect(rendered.view).toBe('list');
  browser.location.href = nextUrl;
  listeners.popstate();
  expect(rendered.view).toBe('calendar');
  browser.location.href = startUrl;
  listeners.pageshow();
  expect(rendered.page).toBe(4);
  listeners.hashchange();
  cleanup();
  expect(Object.keys(listeners)).toHaveLength(0);
  expect(browser.removeEventListener).toHaveBeenCalledTimes(3);
});

test('CLI extracts the complete fragment and it compiles with a business entry', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-view-state-'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const file = path.join(dir, 'view-state.jsx');
    await run(['openyida-page-template', 'canvas-view-state', '--output', file]);
    const fragment = fs.readFileSync(file, 'utf8');
    expect(fragment).toBe(source);
    const entry = `\nconst VIEW_CONFIG = ${JSON.stringify(config)};\nfunction YidaComp() { const [state] = useCanvasViewState(VIEW_CONFIG); return <div>{state.view}</div>; }`;
    expect(() => compileCanvasLocal(fragment + entry)).not.toThrow();
  } finally {
    log.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
