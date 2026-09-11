'use strict';

const fs = require('fs');
const path = require('path');
const { buildCanvasPageSchemaObject } = require('../lib/app/services/canvas-page-schema-builder');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const source = fs.readFileSync(path.join(__dirname, '../lib/samples/yida-canvas-data-binding/report-data.canvas.jsx'), 'utf8');
const compiled = compileCanvasLocal(source);
const binding = { reportUuid: 'REPORT_A', cid: 'real-cid', dataSetKey: 'customData' };

function install(yida) {
  const win = { fetch: jest.fn() };
  const schema = buildCanvasPageSchemaObject(source, compiled.runtimeCode, compiled.importedModules, 'CANVAS_A');
  const exports = {};
  new Function('window', 'exports', schema.actions.module.compiled)(win, exports);
  exports.didMount.call({ utils: { yida } });
  return { win, schema, api: win.__OPENYIDA_YIDA_API__ };
}

function sharedBridge() {
  return {
    getState: jest.fn(() => ({ loading: false, rows: [], meta: null, totalCount: null, error: null })),
    subscribe: jest.fn(() => jest.fn()), refresh: jest.fn().mockResolvedValue({ rows: [] }),
    cancel: jest.fn(), dispose: jest.fn(),
  };
}

function mountSample(win) {
  const effects = [];
  const setters = [];
  win.React = {
    createElement: jest.fn(), useMemo: fn => fn(), useRef: value => ({ current: value }),
    useState: value => { const setter = jest.fn(); setters.push(setter); return [value, setter]; },
    useEffect: fn => effects.push(fn),
  };
  const Component = new Function('window', compiled.runtimeCode + '\nreturn YidaComp;')(win);
  Component();
  const cleanup = effects.map(fn => fn());
  return { setters, unmount: () => cleanup.reverse().forEach(fn => fn && fn()) };
}

afterEach(() => jest.useRealTimers());

describe('Canvas uses the host report APIs', () => {
  test('keeps synchronous bridge identity, subscription and lifecycle', () => {
    const bridge = sharedBridge();
    const host = { createReportDataBridge: jest.fn(() => bridge) };
    const { api, schema, win } = install(host);
    expect(api.createReportDataBridge(binding)).toBe(bridge);
    expect(api.invoke('createReportDataBridge', binding)).toBe(bridge);
    expect(host.createReportDataBridge).toHaveBeenCalledWith(binding);
    expect(host.createReportDataBridge.mock.contexts[0]).toBe(host);
    expect(api.availableMethods).toContain('createReportDataBridge');
    expect(api.apiGroups.report).toContain('queryReportData');
    expect(win.__OPENYIDA_UTILS__.yida).toBe(api);
    expect(schema.actions.module.compiled).not.toMatch(/__OPENYIDA_REPORT__|visualizationDataRpc|getCacheData/);
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('forwards query cancellation and timeout options without form normalization', async () => {
    const host = { queryReportData: jest.fn().mockResolvedValue({ rows: [1] }) };
    const { api } = install(host);
    const options = { signal: new AbortController().signal, timeoutMs: 5000 };
    await expect(api.queryReportData(binding, options)).resolves.toEqual({ rows: [1] });
    await api.invoke('queryReportData', binding, options);
    expect(host.queryReportData).toHaveBeenCalledWith(binding, options);
    expect(host.queryReportData.mock.calls[0][0]).toBe(binding);
  });

  test('reports missing host capabilities without creating a fallback client', async () => {
    const { api, win } = install({});
    expect(api.availableMethods).not.toContain('createReportDataBridge');
    expect(() => api.createReportDataBridge(binding)).toThrow('not available');
    await expect(api.queryReportData(binding)).rejects.toThrow('not available');
    const mounted = mountSample(win);
    const update = mounted.setters[1].mock.calls.at(-1)[0];
    expect(update({ rows: [] }).error.message).toContain('暂不支持报表查询');
    mounted.unmount();
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('the compiled sample subscribes, debounces shared refresh and disposes on unmount', async () => {
    jest.useFakeTimers();
    const bridge = sharedBridge();
    const { win } = install({ createReportDataBridge: () => bridge });
    const mounted = mountSample(win);
    expect(bridge.subscribe).toHaveBeenCalledTimes(1);
    expect(bridge.refresh).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(300);
    expect(bridge.refresh).toHaveBeenCalledWith({ filterValueMap: {}, paging: { start: 0, limit: 50 } });
    mounted.unmount();
    expect(bridge.subscribe.mock.results[0].value).toHaveBeenCalledTimes(1);
    expect(bridge.cancel).toHaveBeenCalled();
    expect(bridge.dispose).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(win.fetch).not.toHaveBeenCalled();
  });
});
