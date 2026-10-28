'use strict';

const { createPageNavigation } = require('../lib/navigation/page-navigation');
const { createTaskCenterNavigation } = require('../lib/task-center/navigation');
const { CANVAS_YIDA_API_BRIDGE_SOURCE } = require('../lib/app/services/canvas-page-schema-builder');
const vm = require('vm');

function host(ding = true) {
  return { location: { origin: 'https://tenant.aliwork.com', href: 'https://tenant.aliwork.com/APP_test/workbench' },
    navigator: { userAgent: ding ? 'DingTalk PC' : 'Chrome' }, open: jest.fn() };
}

test('normalizes legacy objects and sets one ddtab while preserving query and hash', () => {
  const nav = createPageNavigation(host(), jest.fn());
  const value = nav.normalize({ url: '/taskCenter.html?tab=notifyMe&ddtab=false&ddtab=true#anchor' });
  const url = new URL(value.url);
  expect(url.searchParams.getAll('ddtab')).toEqual(['true']);
  expect(url.searchParams.get('tab')).toBe('notifyMe');
  expect(url.hash).toBe('#anchor');
  for (const value of [{}, null, 9, 'javascript:alert(1)', 'https://user:pass@example.com/']) {
    expect(() => nav.normalize(value)).toThrow('PAGE_URL_INVALID');
  }
});

test('strict DingTalk open uses callback failure and never falls back', async () => {
  const win = host(), browser = jest.fn();
  win.dd = { biz: { util: { openLink: jest.fn(({ onFail }) => onFail({ errorCode: 3 })) } } };
  await expect(createPageNavigation(win, browser).open('/taskCenter.html', { mode: 'dingtalk' })).rejects.toHaveProperty('code', 'DINGTALK_OPEN_FAILED');
  expect(browser).not.toHaveBeenCalled();
  expect(win.open).not.toHaveBeenCalled();
  expect(win.dd.biz.util.openLink.mock.calls[0][0].url).toContain('ddtab=true');
});

test('handles successful, throwing and unavailable native APIs without browser fallback', async () => {
  const win = host(), browser = jest.fn(), nav = createPageNavigation(win, browser);
  await expect(nav.open('/a')).rejects.toHaveProperty('code', 'DINGTALK_API_UNAVAILABLE');
  win.dd = { biz: { util: { openLink: ({ onSuccess }) => onSuccess({ opened: true }) } } };
  await expect(nav.open({ url: '/a' })).resolves.toEqual({ opened: true });
  win.dd.biz.util.openLink = () => { throw new Error('not ready'); };
  await expect(nav.open('/a')).rejects.toHaveProperty('code', 'DINGTALK_OPEN_FAILED');
  delete win.dd;
  win.Ali = { pushWindow: jest.fn().mockResolvedValue('opened') };
  await expect(nav.open('/a')).resolves.toBe('opened');
  expect(win.Ali.pushWindow).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://tenant.aliwork.com/a?ddtab=true', onFail: expect.any(Function) }));
  win.Ali.pushWindow = ({ onFail }) => onFail(new Error('bridge failed'));
  await expect(nav.open('/a')).rejects.toHaveProperty('code', 'DINGTALK_OPEN_FAILED');
  expect(browser).not.toHaveBeenCalled();
});

test('ordinary browser opens locally even when native SDK stubs and a legacy helper exist', async () => {
  const win = host(false), legacy = jest.fn();
  win.dd = { biz: { util: { openLink: jest.fn() } } };
  const nav = createPageNavigation(win, legacy);
  await expect(nav.open({ url: '/a' })).resolves.toBeUndefined();
  expect(win.open).toHaveBeenCalledWith('https://tenant.aliwork.com/a', '_blank', 'noopener,noreferrer');
  expect(legacy).not.toHaveBeenCalled();
  expect(win.dd.biz.util.openLink).not.toHaveBeenCalled();
  await expect(nav.open('/a', { mode: 'dingtalk' })).rejects.toHaveProperty('code', 'DINGTALK_ENV_REQUIRED');
  expect(win.open).toHaveBeenCalledTimes(1);
});

test.each(['todo', 'created', 'done', 'cc'])('scope-aware native targets share the same four-kind mapping (%s)', kind => {
  const nav = createTaskCenterNavigation();
  const app = nav.target({ scope: 'app', appType: 'APP_test', kind, baseUrl: 'https://tenant.aliwork.com' });
  expect(new URL(app.pageUrl).pathname).toMatch(/^\/APP_test\/workbench\/NAV-SYSTEM-/);
  expect(app.mode).toBe('auto');
  expect(new URL(app.pageUrl).searchParams.has('ddtab')).toBe(false);
  const native = nav.target({ scope: 'app', appType: 'APP_test', kind, baseUrl: 'https://tenant.aliwork.com', mode: 'dingtalk' });
  expect(new URL(native.pageUrl).searchParams.get('ddtab')).toBe('true');
  const corp = nav.target({ scope: 'corp', kind, baseUrl: 'https://tenant.aliwork.com', mode: 'browser' });
  expect(new URL(corp.pageUrl).pathname).toBe('/taskCenter.html');
  expect(new URL(corp.pageUrl).searchParams.has('ddtab')).toBe(false);
  expect(() => nav.target({ kind, baseUrl: 'https://tenant.aliwork.com' })).toThrow('scope');
  expect(() => nav.target({ scope: 'corp', appType: 'APP_test', kind, baseUrl: 'https://tenant.aliwork.com' })).toThrow('appType');
});

test('actual injected bridge uses the portable opener instead of the old platform utility', async () => {
  const win = host(), oldOpenPage = jest.fn(() => { throw new Error('old helper should not handle DingTalk'); });
  win.dd = { biz: { util: { openLink: jest.fn(({ onSuccess }) => onSuccess('native')) } } };
  const context = { window: win, URL, console, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(CANVAS_YIDA_API_BRIDGE_SOURCE, context);
  const bridge = context.openyidaCreateUtilsBridge({ utils: { openPage: oldOpenPage } }, {});
  await expect(bridge.openTaskCenter({ scope: 'app', appType: 'APP_test', kind: 'cc' })).resolves.toBe('native');
  expect(win.dd.biz.util.openLink.mock.calls[0][0].url).toBe('https://tenant.aliwork.com/APP_test/workbench/NAV-SYSTEM-NOTIFY-ME-UUID?showTodoTab=true&ddtab=true');
  await expect(bridge.invoke('openPage', { url: '/taskCenter.html' })).resolves.toBe('native');
  expect(oldOpenPage).not.toHaveBeenCalled();
  expect(bridge.availableMethods).toEqual(expect.arrayContaining(['openPage', 'taskCenterLink', 'openTaskCenter']));
});


test('explicit browser mode does not delegate back to a native-opening legacy helper', async () => {
  const win = host(), browser = jest.fn();
  await createPageNavigation(win, browser).open('/a', { mode: 'browser' });
  expect(win.open).toHaveBeenCalledWith('https://tenant.aliwork.com/a', '_blank', 'noopener,noreferrer');
  expect(browser).not.toHaveBeenCalled();
});

test('missing native callbacks time out without opening another window', async () => {
  jest.useFakeTimers();
  try {
    const win = host(), browser = jest.fn();
    win.dd = { biz: { util: { openLink: jest.fn() } } };
    const pending = createPageNavigation(win, browser).open('/a');
    const check = expect(pending).rejects.toHaveProperty('code', 'DINGTALK_OPEN_FAILED');
    jest.advanceTimersByTime(15000);
    await check;
    expect(browser).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

test('published count helper shares explicit scope, app-query filters and server totals', async () => {
  const win = host(false);
  win.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, content: { values: [], totalCount: 37 } }) });
  const context = { window: win, URL, URLSearchParams, console, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(CANVAS_YIDA_API_BRIDGE_SOURCE, context);
  const bridge = context.openyidaCreateUtilsBridge({}, {});
  for (const scope of ['app', 'corp']) {
    const options = { scope, kind: 'todo', filters: { keyword: '采购' } };
    if (scope === 'app') { options.appType = 'APP_test'; }
    await expect(bridge.taskCenterCount(options)).resolves.toMatchObject({ total: 37, available: true });
    const query = JSON.parse(new URL(win.fetch.mock.calls.at(-1)[0], win.location.origin).searchParams.get('query'));
    expect(new URL(win.fetch.mock.calls.at(-1)[0], win.location.origin).searchParams.get('taskQueryType')).toBe('1');
    expect(query).toMatchObject({ appKeys: scope === 'app' ? ['APP_test'] : [], page: 1, limit: 1, keyword: '采购' });
  }
  win.fetch.mockClear();
  for (const options of [{ kind: 'todo' }, { scope: 'corp', appType: 'APP_test', kind: 'todo' }, { scope: 'app', appType: 'APP_test', kind: 'todo', filters: { appKeys: [] } }]) {
    await expect(bridge.taskCenterCount(options)).rejects.toThrow();
  }
  expect(win.fetch).not.toHaveBeenCalled();
  expect(bridge.invoke('taskCenterLink', { scope: 'corp', kind: 'cc' }).pageUrl).toContain('tab=notifyMe');
  await expect(bridge.invoke('taskCenterCount', null)).rejects.toHaveProperty('code', 'TASK_FILTER_INVALID');
  win.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: false, errorCode: 'NO_PERMISSION' }) });
  await expect(bridge.taskCenterCount({ scope: 'corp', kind: 'todo' })).rejects.toThrow();
});

// Exercise the public injected helper with the same defaults used by custom cards.
test.each(['app', 'corp'])('default openTaskCenter stays in a browser for %s scope', async scope => {
  const win = host(false), oldOpenPage = jest.fn();
  win.dd = { biz: { util: { openLink: jest.fn() } } };
  const context = { window: win, URL, console, setTimeout, clearTimeout };
  vm.createContext(context); vm.runInContext(CANVAS_YIDA_API_BRIDGE_SOURCE, context);
  const bridge = context.openyidaCreateUtilsBridge({ utils: { openPage: oldOpenPage } }, {});
  const options = { scope, kind: 'todo', ...(scope === 'app' ? { appType: 'APP_test' } : {}) };
  await bridge.openTaskCenter(options);
  expect(win.open).toHaveBeenCalledWith(bridge.taskCenterLink(options).pageUrl, '_blank', 'noopener,noreferrer');
  expect(new URL(win.open.mock.calls[0][0]).searchParams.has('ddtab')).toBe(false);
  expect(win.dd.biz.util.openLink).not.toHaveBeenCalled();
  expect(oldOpenPage).not.toHaveBeenCalled();
});
