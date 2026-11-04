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

test.each([0, 1, 2])('decodes association arrays with %i JSON envelopes without changing the source', depth => {
  const records = [
    { instanceId: 'FINST-B', title: '恒川精密制造股份有限公司' },
    { instanceId: 'FINST-A', title: '青禾商贸有限公司' },
  ];
  let value = records;
  for (let i = 0; i < depth; i++) {value = JSON.stringify(value);}
  const before = JSON.stringify(value);
  expect(context.parseCanvasAssociationValue(value)).toEqual(records);
  expect(JSON.stringify(value)).toBe(before);
});

test.each([undefined, null, '', [], '[]', '"[]"', 'null', '"null"', '""', '"\\"\\""'])('accepts empty association values: %j', value => {
  expect(context.parseCanvasAssociationValue(value)).toEqual([]);
});

test.each([
  '客户名不能当关联对象', '[broken', '{}', '["FINST-A"]', '[null]',
  [{ title: '缺少实例 ID' }], [{ instanceId: '' }],
  JSON.stringify(JSON.stringify(JSON.stringify([{ instanceId: 'FINST-A', title: '客户' }]))),
])('reports malformed associations rather than displaying JSON or declaring no association: %j', value => {
  expect(() => context.parseCanvasAssociationValue(value)).toThrow('DATA_ASSOCIATION_INVALID');
});

test('form page normalization preserves ordinary JSON-looking text and raw association values', () => {
  const formData = { textField_note: '"[{\\"title\\":\\"普通文本\\"}]"',
    associationFormField_customer_id: JSON.stringify(JSON.stringify([{ instanceId: 'FINST-A', title: '客户' }])) };
  const result = context.normalizeCanvasFormPage({ data: [{ formData }] });
  expect(result.rows[0].formData).toBe(formData);
  expect(result.rows[0].formData.textField_note).toBe(formData.textField_note);
  expect(typeof result.rows[0].formData.associationFormField_customer_id).toBe('string');
});

describe('complete association reader', () => {
  const field = 'associationFormField_customer';
  const items = [{ appType: 'APP_TEST', formUuid: 'FORM-CUSTOMER', formType: 'receipt',
    instanceId: 'FINST-A', title: '客户甲' }, { instanceId: 'FINST-B', title: '客户乙' }];
  test('reads subform rows directly, preserving cross-app and process metadata', () => {
    const refs = [{ ...items[0], appType: 'APP_REMOTE', formType: 'process', title: '已完成审批', value: 'FINST-A' }];
    expect(context.readCanvasAssociation({ [field + '_id']: JSON.stringify(refs) }, field))
      .toMatchObject({ status: 'ready', titles: ['已完成审批'], items: refs });
    expect(bridge.searchFormDatas).not.toHaveBeenCalled();
  });
  test.each([
    [items[0], { ...items[0], title: '重复旧标题' }],
    [{ ...items[0], appType: null }], [{ ...items[0], formUuid: {} }], [{ ...items[0], formType: '' }],
  ].map(value => [value]))('rejects duplicate selections or malformed target metadata: %j', value => {
    expect(context.readCanvasAssociation({ [field]: value }, field))
      .toMatchObject({ status: 'error', titles: [], error: { code: 'DATA_ASSOCIATION_INVALID' } });
  });
  test.each([0, 1, 2])('reads %i envelopes from the platform projection without changing the row', depth => {
    let value = items;
    for (let i = 0; i < depth; i++) {value = JSON.stringify(value);}
    const input = { formData: { [`${field}_id`]: value, textField_note: '[ordinary text]' } };
    const before = JSON.stringify(input);
    expect(context.readCanvasAssociation(input, field)).toMatchObject({ status: 'ready',
      items, titles: ['客户甲', '客户乙'], instanceIds: ['FINST-A', 'FINST-B'], error: null });
    expect(JSON.stringify(input)).toBe(before);
    expect(bridge.searchFormDatas).not.toHaveBeenCalled();
  });
  test.each([null, '', [], '[]', '"[]"'])('explicit clear %j overrides a stale projection and instValue', value => {
    expect(context.readCanvasAssociation({ formData: { [field]: value, [`${field}_id`]: items },
      instValue: JSON.stringify([{ fieldId: field, fieldData: { value: items } }]) }, field))
      .toMatchObject({ status: 'empty', titles: [], instanceIds: [], error: null });
  });
  test.each([value => value, JSON.stringify])('uses instValue only when both formData fields are absent', wrap => {
    const result = context.readCanvasAssociation({ formData: {}, instValue: wrap([
      { fieldId: 'other', fieldData: { value: 'ignored' } }, { fieldId: field, fieldData: { value: items } },
    ]) }, field);
    expect(result).toMatchObject({ status: 'ready', titles: ['客户甲', '客户乙'] });
  });
  test.each([
    { formData: {} }, { formData: {}, instValue: [] },
    { formData: {}, instValue: [{ fieldId: field, fieldData: {} }] },
  ])('missing/hidden values are unavailable, not a verified empty association', input => {
    expect(context.readCanvasAssociation(input, field)).toMatchObject({ status: 'error',
      error: { code: 'DATA_ASSOCIATION_UNAVAILABLE', fieldId: field } });
  });
  test.each([
    { formData: { [field]: '[broken', [`${field}_id`]: items } },
    { formData: { [`${field}_id`]: '[broken' }, instValue: [{ fieldId: field, fieldData: { value: items } }] },
    { formData: {}, instValue: '[broken' }, { formData: {}, instValue: '{}' },
    { formData: {}, instValue: [{ fieldId: field, fieldData: { value: items } }, { fieldId: field, fieldData: { value: [] } }] },
    { formData: { [field]: [{}] } }, { formData: 'not an object' },
  ])('preserves an invalid source as an error rather than replacing it with a successful fallback', input => {
    expect(context.readCanvasAssociation(input, field)).toMatchObject({ status: 'error',
      titles: [], error: { code: 'DATA_ASSOCIATION_INVALID' } });
  });
  test('resolves names from already loaded records and never displays IDs or objects as titles', () => {
    const input = { formData: { [field]: [{ instanceId: 'FINST-A' }, { instanceId: 'FINST-B', title: { zh_CN: '对象' } }] } };
    expect(context.readCanvasAssociation(input, field)).toMatchObject({ status: 'error',
      instanceIds: ['FINST-A', 'FINST-B'], error: { code: 'DATA_ASSOCIATION_TITLE_UNAVAILABLE' } });
    expect(context.readCanvasAssociation(input, field, { 'FINST-A': '真实客户甲', 'FINST-B': '真实客户乙' }))
      .toMatchObject({ status: 'ready', titles: ['真实客户甲', '真实客户乙'], error: null });
    expect(bridge.searchFormDatas).not.toHaveBeenCalled();
  });
  test('uses only own dictionary entries, and keeps zero-like names and association order', () => {
    const names = Object.create({ 'FINST-A': '继承的名称' });
    names['FINST-B'] = '0';
    expect(context.readCanvasAssociation({ formData: { [field]: items } }, field, names))
      .toMatchObject({ status: 'ready', titles: ['客户甲', '0'], instanceIds: ['FINST-A', 'FINST-B'] });
  });
  test.each([null, '', 0, { zh_CN: '未解析的名称' }])('does not conceal an explicitly unavailable current name behind an old title: %j', name => {
    expect(context.readCanvasAssociation({ formData: { [field]: items } }, field, { 'FINST-A': name }))
      .toMatchObject({ status: 'error', titles: [], error: { code: 'DATA_ASSOCIATION_TITLE_UNAVAILABLE' } });
  });
});

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
