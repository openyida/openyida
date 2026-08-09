'use strict';

const vm = require('vm');
const { buildCanvasRuntimeSource } = require('../lib/app/runtime/canvas-runtime');
const {
  CANVAS_YIDA_API_METHODS,
  CANVAS_YIDA_QUERY_METHODS,
} = require('../lib/app/runtime/canvas-yida-api-methods');

function createDocument() {
  const nodes = {};
  return {
    head: {
      appendChild(node) {
        nodes[node.id] = node;
      },
    },
    createElement() {
      return { id: '', textContent: '' };
    },
    getElementById(id) {
      return nodes[id] || null;
    },
  };
}

function loadRuntime() {
  const window = { document: createDocument() };
  window.parent = window;
  window.top = window;
  const context = vm.createContext({ Error, JSON, Object, Promise, window });
  vm.runInContext(buildCanvasRuntimeSource(), context);
  return { context, window };
}

describe('Canvas unified runtime', () => {
  test('uses one 13-method manifest and normalizes only query methods', async () => {
    expect(CANVAS_YIDA_API_METHODS).toHaveLength(13);
    expect(CANVAS_YIDA_QUERY_METHODS).toEqual([
      'searchFormDatas',
      'searchFormDataIds',
      'getProcessInstances',
      'getProcessInstanceIds',
    ]);
    const calls = {};
    const yida = {};
    CANVAS_YIDA_API_METHODS.forEach(function (methodName) {
      yida[methodName] = jest.fn(function (params) {
        calls[methodName] = params;
        return { success: true };
      });
    });
    const { context } = loadRuntime();
    const runtime = context.openyidaInstallRuntime.call({ utils: { yida } });

    await runtime.yida.saveFormData({ formUuid: 'FORM_X' });
    await runtime.yida.searchFormDatas({ query: { status: 'open' } });

    expect(calls.saveFormData).toEqual({ formUuid: 'FORM_X' });
    expect(calls.saveFormData).not.toHaveProperty('searchFieldJson');
    expect(calls.searchFormDatas).toEqual({ searchFieldJson: '{"status":"open"}' });
  });

  test('reuses runtime and style nodes and returns stable errors', async () => {
    const { context, window } = loadRuntime();
    const first = context.openyidaInstallRuntime.call({ utils: { yida: {} } });
    const second = context.openyidaInstallRuntime.call({ utils: { yida: {} } });

    expect(second).toBe(first);
    expect(window.__OPENYIDA_RUNTIME__).toBe(first);
    expect(window.openyidaYidaApi).toBe(first.yida);

    first.theme.install({ tokens: { '--color-brand1-6': '#2563eb' } });
    const style = window.document.getElementById('yida-global-theme');
    first.theme.refresh();
    expect(window.document.getElementById('yida-global-theme')).toBe(style);

    await expect(first.yida.saveFormData({})).rejects.toMatchObject({
      code: 'OPENYIDA_YIDA_API_UNAVAILABLE',
      evidence: { methodName: 'saveFormData' },
      retryable: true,
      repairType: 'runtime',
    });
  });
});
