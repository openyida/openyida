'use strict';

const fs = require('fs');
const path = require('path');
const { createReportQueryProtocol } = require('../lib/report/query-protocol');
const { createCanvasReportRuntime } = require('../lib/report/canvas-runtime');
const { buildCanvasPageSchemaObject } = require('../lib/app/services/canvas-page-schema-builder');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');

const binding = { mode: 'report', appType: 'APP_A', reportUuid: 'REPORT_A', cid: 'real-cid', componentClassName: 'YoushuTable', dataSetKey: 'customData' };
const schema = { id: 'REPORT_A', pages: [{ componentsTree: [{ componentName: 'YoushuTable', id: 'real-cid', props: { dataSetModelMap: { customData: { filterList: [{ filterKey: 'department' }] } } } }] }] };
const response = body => ({ ok: true, status: 200, json: async () => body });

function environment(queryHandler) {
  let topic = 'topic-current';
  const win = {
    location: { pathname: '/APP_A/workbench/CANVAS_A' },
    g_config: { _csrf_token: 'session-csrf' }, document: { cookie: '' },
    fetch: jest.fn(async (url, options) => {
      if (url.includes('getFormNavigationListByOrder')) {return response({ content: [{ formUuid: 'REPORT_A', topicId: topic }] });}
      if (url.includes('getPage.json')) {return response({ content: { schemaBody: JSON.stringify(schema) } });}
      return queryHandler(url, options);
    }),
  };
  return { win, setTopic: value => {topic = value;}, create: () => createCanvasReportRuntime(createReportQueryProtocol(), win).createBridge(binding) };
}

describe('Canvas native report integration', () => {
  afterEach(() => jest.useRealTimers());

  test('uses same-origin form POSTs and re-resolves topic on refresh', async () => {
    const env = environment(async () => response({ content: { data: [{ amount: 30 }], totalCount: 1 } }));
    const bridge = env.create();
    const query = { filters: { department: ['研发'] } };
    const first = bridge.refresh(query);
    expect(bridge.refresh(query)).toBe(first);
    await first;
    env.setTopic('topic-new');
    await bridge.refresh(query);
    const requests = env.win.fetch.mock.calls.filter(([url]) => url.includes('getDataAsync'));
    expect(requests).toHaveLength(2);
    expect(new URLSearchParams(requests[1][1].body).get('prdId')).toBe('topic-new');
    expect(new URLSearchParams(requests[1][1].body).get('pageId')).toBe('REPORT_A');
    env.win.fetch.mock.calls.forEach(([url, options]) => {
      expect(url).toMatch(/^\/(?:alibaba|dingtalk)\/web\/APP_A\//);
      const navigation = url.includes('getFormNavigationListByOrder');
      expect(options).toMatchObject({ method: navigation ? 'GET' : 'POST', credentials: 'include', headers: { global_csrf_token: 'session-csrf', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
      expect(new URLSearchParams(navigation ? url.split('?')[1] : options.body).get('_csrf_token')).toBe('session-csrf');
    });
    bridge.dispose();
  });

  test('retains old data on refresh failure, clears it only for a successful empty result', async () => {
    const handler = jest.fn()
      .mockResolvedValueOnce(response({ content: { data: [{ sum: 80 }], totalCount: 1 } }))
      .mockResolvedValueOnce(response({ success: false, errorCode: 'NO_PERMISSION', errorMsg: 'no permission' }))
      .mockResolvedValueOnce(response({ content: { data: [], totalCount: 0 } }));
    const bridge = environment(handler).create();
    await bridge.refresh();
    const timestamp = bridge.getSnapshot().lastUpdatedAt;
    const refresh = bridge.refresh();
    expect(bridge.getSnapshot()).toMatchObject({ loading: true, rows: [{ sum: 80 }] });
    await expect(refresh).rejects.toMatchObject({ code: 'NO_PERMISSION' });
    expect(bridge.getSnapshot()).toMatchObject({ rows: [{ sum: 80 }], lastUpdatedAt: timestamp, error: { message: 'no permission' } });
    await bridge.refresh();
    expect(bridge.getSnapshot()).toMatchObject({ rows: [], totalCount: 0, error: null });
    bridge.dispose();
  });

  test('changing filters aborts old work and prevents late data replacing new data', async () => {
    let finishOld;
    let startedOld;
    const oldStarted = new Promise(resolve => {startedOld = resolve;});
    const env = environment(async (url, options) => {
      const filters = JSON.parse(new URLSearchParams(options.body).get('queryContext')).filterValueMap;
      if (filters.department[0] === 'old') {
        startedOld();
        return new Promise(resolve => {finishOld = resolve;});
      }
      return response({ content: { data: [{ sum: 2 }] } });
    });
    const bridge = env.create();
    const old = bridge.refresh({ filters: { department: ['old'] } });
    const assertion = expect(old).rejects.toMatchObject({ code: 'REPORT_ABORTED' });
    await oldStarted;
    await bridge.refresh({ filters: { department: ['new'] } });
    finishOld(response({ content: { data: [{ sum: 1 }] } }));
    await assertion;
    expect(bridge.getSnapshot().rows).toEqual([{ sum: 2 }]);
    bridge.dispose();
  });

  test('rejects cross-app bindings before any request', () => {
    const env = environment(jest.fn());
    const runtime = createCanvasReportRuntime(createReportQueryProtocol(), env.win);
    expect(() => runtime.createBridge({ ...binding, appType: 'APP_B' })).toThrow('REPORT_APP_MISMATCH');
    expect(env.win.fetch).not.toHaveBeenCalled();
  });

  test('an HTTP permission failure becomes a visible error state', async () => {
    const bridge = environment(async () => ({ ok: false, status: 403 })).create();
    await expect(bridge.refresh()).rejects.toMatchObject({ code: 'REPORT_HTTP_403' });
    expect(bridge.getSnapshot()).toMatchObject({ loading: false, error: { code: 'REPORT_HTTP_403' }, lastUpdatedAt: null });
    bridge.dispose();
  });

  test('the Canvas client polls for the same query result', async () => {
    jest.useFakeTimers();
    const handler = jest.fn()
      .mockResolvedValueOnce(response({ content: { continuePolling: true, traceId: 'async-id' } }))
      .mockResolvedValueOnce(response({ content: { data: [{ sum: 18 }], totalCount: 1 } }));
    const env = environment(handler);
    const bridge = env.create();
    const pending = bridge.refresh();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toMatchObject({ rows: [{ sum: 18 }], error: null });
    expect(handler.mock.calls[1][0]).toContain('/getCacheData.json');
    expect(new URLSearchParams(handler.mock.calls[1][1].body).get('traceId')).toBe('async-id');
    bridge.dispose();
  });

  test('disposal cancels a hung schema request promptly', async () => {
    const env = environment(jest.fn());
    env.win.fetch = jest.fn(() => new Promise(() => {}));
    const bridge = env.create();
    const promise = bridge.refresh();
    const assertion = expect(promise).rejects.toMatchObject({ code: 'REPORT_ABORTED' });
    bridge.dispose();
    await assertion;
  });

  test('the distributed sample compiles and gets an executable report runtime in its page Schema', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../lib/samples/yida-canvas-data-binding/report-data.canvas.jsx'), 'utf8');
    const compiled = compileCanvasLocal(source);
    const published = buildCanvasPageSchemaObject(source, compiled.runtimeCode, compiled.importedModules, 'CANVAS_A');
    const env = environment(async () => response({ content: { data: [{ sum: 10 }] } }));
    new Function('window', 'exports', published.actions.module.compiled)(env.win, {});
    const bridge = env.win.__OPENYIDA_REPORT__.createBridge(binding);
    await expect(bridge.refresh()).resolves.toMatchObject({ rows: [{ sum: 10 }] });
    bridge.dispose();
    const plain = buildCanvasPageSchemaObject('plain Canvas', 'code', '[]', 'CANVAS_B');
    expect(plain.actions.module.source).not.toContain('__OPENYIDA_REPORT__');
  });
});
