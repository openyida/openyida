'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { run } = require('../lib/core/sample');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-data-source.jsx'), 'utf8');
const binding = { mode: 'form', appType: 'APP_TEST', formUuid: 'FORM-TEST' };
const row = { formInstId: 'FINST-1', formData: { numberField_total: 0, textField_name: '' } };
let context, bridge, browser, states, refs, previousDeps, cleanup, stateIndex, refIndex;
const flush = async () => { for (let i = 0; i < 8; i++) {await Promise.resolve();} };

beforeEach(() => {
  jest.useFakeTimers();
  bridge = { searchFormDatas: jest.fn().mockResolvedValue({ content: { data: [row], totalCount: '1' }, success: true }) };
  browser = { location: { origin: 'https://tenant.example' }, __OPENYIDA_YIDA_API__: bridge };
  browser.parent = browser;
  states = []; refs = []; previousDeps = undefined; cleanup = undefined;
  context = { window: browser, setTimeout, clearTimeout, Date, React: {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) {states[index] = typeof initial === 'function' ? initial() : initial;}
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = refIndex++; return refs[index] || (refs[index] = { current: initial }); },
    useEffect(effect, deps) {
      if (!previousDeps || deps.some((value, index) => value !== previousDeps[index])) {
        if (cleanup) {cleanup();}
        previousDeps = deps; cleanup = effect();
      }
    },
    useCallback(fn) { return fn; },
  } };
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
});
afterEach(() => { if (cleanup) {cleanup();} jest.useRealTimers(); });
function render(config = binding, request = {}) {
  stateIndex = 0; refIndex = 0;
  return context.useCanvasFormData(config, request);
}

test.each([
  rows => rows, rows => ({ data: rows }), rows => ({ content: { result: { data: rows } } }),
  rows => ({ result: { records: rows } }), rows => ({ content: { values: rows } }),
])('parses supported wrappers without replacing business values or inventing totals', wrap => {
  const result = context.normalizeCanvasFormPage(wrap([row]));
  expect(result.rows[0]).toBe(row);
  expect(result.rows[0].formData.numberField_total).toBe(0);
  expect(result.totalCount).toBeNull();
});

test('distinguishes legal empty pages, zero totals and out-of-range pages', () => {
  expect(context.normalizeCanvasFormPage({ data: [], totalCount: 0 })).toMatchObject({ rows: [], totalCount: 0 });
  expect(context.normalizeCanvasFormPage({ data: [], totalCount: 10 }, 2, 50)).toMatchObject({ rows: [], totalCount: 10 });
  expect(() => context.normalizeCanvasFormPage({ data: [], totalCount: 10 })).toThrow('DATA_ROWS_MISSING');
});

test.each([
  [{ success: false, data: [] }, 'DATA_QUERY_FAILED'],
  [{ content: { success: false, data: [] } }, 'DATA_QUERY_FAILED'],
  [{ totalCount: 0 }, 'DATA_RESPONSE_UNRECOGNIZED'],
  [{ data: [], list: [row] }, 'DATA_RESPONSE_UNRECOGNIZED'],
  [{ data: [], totalCount: '', total: 0 }, 'DATA_TOTAL_INVALID'],
  [{ data: [], totalCount: -1 }, 'DATA_TOTAL_INVALID'],
  [{ data: [], totalCount: 0, content: { totalCount: 2 } }, 'DATA_RESPONSE_UNRECOGNIZED'],
  [{ data: [null] }, 'DATA_ROWS_INVALID'],
  [{ data: [row], totalCount: 0 }, 'DATA_ROWS_MISSING'],
])('does not turn failed or unrecognized responses into successful empty data: %j', (payload, code) => {
  expect(() => context.normalizeCanvasFormPage(payload)).toThrow(code);
});

test('sends only scoped form query parameters and rejects invalid paging before requests', async () => {
  await context.queryCanvasFormPage(binding, { pageSize: 100, currentPage: 1, query: [], appType: 'APP_OTHER' });
  expect(bridge.searchFormDatas).toHaveBeenCalledWith({ appType: 'APP_TEST', formUuid: 'FORM-TEST',
    currentPage: 1, pageSize: 100, searchFieldJson: '[]', dynamicOrder: '' });
  await context.queryCanvasFormPage(binding);
  expect(bridge.searchFormDatas).toHaveBeenLastCalledWith(expect.objectContaining({ currentPage: 1, pageSize: 50 }));
  bridge.searchFormDatas.mockClear();
  for (const pageSize of [0, 101, '50']) {
    await expect(context.queryCanvasFormPage(binding, { pageSize })).rejects.toMatchObject({ code: 'DATA_BINDING_INVALID' });
  }
  await expect(context.queryCanvasFormPage(null)).rejects.toMatchObject({ code: 'DATA_BINDING_INVALID' });
  expect(bridge.searchFormDatas).not.toHaveBeenCalled();
});

test('same-origin parent traversal stops before reading a foreign bridge', async () => {
  delete browser.__OPENYIDA_YIDA_API__;
  const parent = { location: browser.location, __OPENYIDA_YIDA_API__: bridge };
  parent.parent = parent;
  browser.parent = parent;
  await context.queryCanvasFormPage(binding);
  const readBridge = jest.fn(() => bridge);
  browser.parent = { location: { origin: 'https://other.example' } };
  Object.defineProperty(browser.parent, '__OPENYIDA_YIDA_API__', { get: readBridge });
  await expect(context.queryCanvasFormPage(binding)).rejects.toMatchObject({ code: 'DATA_BRIDGE_UNAVAILABLE' });
  expect(readBridge).not.toHaveBeenCalled();
});

test('refresh keeps previous rows, equal configurations do not requery, and failures release loading', async () => {
  render(); await flush();
  let result = render({ ...binding });
  expect(result).toMatchObject({ rows: [row], loading: false, refreshing: false, error: null });
  expect(bridge.searchFormDatas).toHaveBeenCalledTimes(1);
  bridge.searchFormDatas.mockRejectedValueOnce(new Error('private server detail'));
  result.refetch(); render();
  expect(states[1]).toMatchObject({ rows: [row], loading: false, refreshing: true });
  await flush(); result = render();
  expect(result).toMatchObject({ rows: [row], loading: false, refreshing: false, error: { code: 'DATA_QUERY_FAILED' } });
  expect(result.error.message).not.toContain('private');
});

test('changed sources discard previous rows and ignore earlier replies', async () => {
  let resolveOld;
  bridge.searchFormDatas.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(); await flush();
  const next = { ...binding, formUuid: 'FORM-NEXT' };
  render(next); await flush();
  expect(render(next)).toMatchObject({ rows: [row], loading: false });
  resolveOld({ data: [{ formInstId: 'FINST-OLD' }], totalCount: 1 }); await flush();
  expect(render(next).rows).toEqual([row]);
});

test('timeout restores state, late replies stay ignored, and explicit retry can succeed', async () => {
  let resolveLate;
  bridge.searchFormDatas.mockImplementationOnce(() => new Promise(resolve => { resolveLate = resolve; }));
  render(binding, { timeoutMs: 20 }); await flush();
  jest.advanceTimersByTime(20); await flush();
  expect(render(binding, { timeoutMs: 20 })).toMatchObject({ loading: false, error: { code: 'DATA_QUERY_TIMEOUT' } });
  resolveLate({ data: [row] }); await flush();
  let result = render(binding, { timeoutMs: 20 });
  expect(result.rows).toEqual([]);
  result.refetch(); render(binding, { timeoutMs: 20 }); await flush();
  result = render(binding, { timeoutMs: 20 });
  expect(result).toMatchObject({ rows: [row], loading: false, error: null });
});

test('unmount before dispatch performs no read or state update', async () => {
  render(); cleanup();
  const previous = states[1]; await flush();
  expect(bridge.searchFormDatas).not.toHaveBeenCalled();
  expect(states[1]).toBe(previous);
});

test('missing bridges remain actionable and do not silently become empty data', async () => {
  delete browser.__OPENYIDA_YIDA_API__;
  render(); await flush();
  expect(render()).toMatchObject({ loading: false, error: { code: 'DATA_BRIDGE_UNAVAILABLE' } });
});

test('sample extraction and composition compile as a Canvas page with existing UI', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-data-source-'));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const file = path.join(dir, 'data-source.jsx');
    await run(['openyida-page-template', 'canvas-data-source', '--output', file]);
    const fragment = fs.readFileSync(file, 'utf8');
    expect(fragment).toBe(source);
    const result = compileCanvasLocal(`${fragment}\nfunction YidaComp() { const data = useCanvasFormData(${JSON.stringify(binding)}); return <main>{data.error ? '读取失败，请重试' : data.rows.length}</main>; }`);
    expect(JSON.parse(result.importedModules)).toEqual(['react']);
  } finally {
    log.mockRestore(); error.mockRestore(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
