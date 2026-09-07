'use strict';

const { createReportQueryProtocol } = require('../lib/report/query-protocol');
const { assessAnalysisDataVolume } = require('../lib/report/analysis-policy');
const protocol = createReportQueryProtocol();

describe('report async protocol', () => {
  afterEach(() => jest.useRealTimers());

  test('waits for the final result and never resubmits the initial query', async () => {
    jest.useFakeTimers();
    const request = jest.fn()
      .mockResolvedValueOnce({ success: true, content: { continuePolling: true, traceId: 'first' } })
      .mockResolvedValueOnce({ success: true, content: { continuePolling: true, traceId: 'next' } })
      .mockResolvedValueOnce({ success: true, content: { data: [{ amount: 420 }], meta: [{ alias: 'amount' }], totalCount: 1 } });
    const pending = protocol.query(request, { cid: 'real-component' });
    await jest.advanceTimersByTimeAsync(6000);
    await expect(pending).resolves.toMatchObject({ rows: [{ amount: 420 }], totalCount: 1 });
    expect(request.mock.calls.map(call => [call[0], call[1]])).toEqual([
      ['getDataAsync', { cid: 'real-component' }], ['getCacheData', { traceId: 'first' }], ['getCacheData', { traceId: 'next' }],
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('bounds a hung initial request with the overall deadline', async () => {
    jest.useFakeTimers();
    const pending = protocol.query(() => new Promise(() => {}), {}, { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'REPORT_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  test('cancellation stops cache polling', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const request = jest.fn().mockResolvedValue({ content: { continuePolling: true, traceId: 'trace' } });
    const pending = protocol.query(request, {}, { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'REPORT_ABORTED' });
    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    await jest.advanceTimersByTimeAsync(10000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([
    [{ content: { continuePolling: true } }, 'REPORT_TRACE_ID_MISSING'],
    [{ success: false, errorCode: 'NO_PERMISSION', errorMsg: 'denied' }, 'NO_PERMISSION'],
    [{ success: true, content: { unknown: [] } }, 'REPORT_ROWS_MISSING'],
    [{ content: { data: [[1, 2]], meta: [{ alias: 'x' }] } }, 'REPORT_META_INVALID'],
    [{ content: { data: [], totalCount: 'bad' } }, 'REPORT_TOTAL_INVALID'],
    [{ content: [] }, 'REPORT_ROWS_MISSING'],
    [[], 'REPORT_INVALID_RESPONSE'],
  ])('rejects failed or unrecognizable responses %#', (value, code) => {
    expect(() => protocol.result(value)).toThrow(expect.objectContaining({ code }));
  });

  test('supports valid empty results, metadata rows and unknown totals', () => {
    expect(protocol.result({ content: { data: [] } })).toMatchObject({ rows: [], totalCount: null });
    expect(protocol.result({ content: null })).toMatchObject({ rows: [], totalCount: 0 });
    expect(protocol.result({ content: { data: [[12]], meta: [{ alias: 'sum' }] } })).toMatchObject({ rows: [{ sum: 12 }] });
  });

  test('a positive total with missing rows is an error unless the offset is beyond the last page', async () => {
    const request = async () => ({ content: { data: [], totalCount: 5 } });
    await expect(protocol.query(request, { queryContext: '{"paging":{"start":0}}' })).rejects.toMatchObject({ code: 'REPORT_EMPTY_RESULT_MISMATCH' });
    await expect(protocol.query(request, { queryContext: '{"paging":{"start":10}}' })).resolves.toMatchObject({ rows: [], totalCount: 5 });
  });

  test('extracts actual datasets across multiple pages and roots', () => {
    const node = (id, dataSetKey) => ({ id, componentName: 'YoushuTable', props: { dataSetModelMap: { [dataSetKey]: {} } } });
    const schema = { pages: [{ componentsTree: [node('a', 'customOne'), node('b', 'customTwo')] }, { componentsTree: [node('c', 'customThree')] }] };
    expect(protocol.bindings({ content: { schemaBody: JSON.stringify(schema) } }, 'report').map(target => target.dataSetKey))
      .toEqual(['customOne', 'customTwo', 'customThree']);
  });

  test('resolves the exact report from nested navigation and rejects cross-app references', () => {
    expect(protocol.findNavigation({ content: [{ children: [{ formUuid: 'r', topicId: 22 }] }] }, 'APP_A', 'r')).toBe('22');
    expect(() => protocol.findNavigation({ content: [{ formUuid: 'r', topicId: 22, appType: 'APP_B' }] }, 'APP_A', 'r'))
      .toThrow(expect.objectContaining({ code: 'REPORT_APP_MISMATCH' }));
  });

  test('filters use only configured filter keys and cannot override the report identity', () => {
    const target = { prdId: 't', reportId: 'r', cid: 'c', className: 'YoushuTable', dataSetKey: 'custom', filterKeys: ['f'] };
    const params = protocol.parameters(target, { filters: { f: ['department-a'] }, prdId: 'wrong', component: 'unsafe' });
    expect(params).toMatchObject({ prdId: 't', draft: 'false' });
    expect(params).not.toHaveProperty('component');
    expect(JSON.parse(params.queryContext).filterValueMap).toEqual({ f: ['department-a'] });
    expect(() => protocol.parameters(target, { filters: { unknown: [1] } })).toThrow('REPORT_FILTER_INVALID');
    expect(() => protocol.parameters(target, { filters: { f: 'department-a' } })).toThrow('REPORT_FILTER_INVALID');
  });

  test('retains native default ordering and rejects unsupported variable filters', () => {
    const definition = { componentsTree: [{ componentName: 'YoushuTable', id: 'c', props: { dataSetModelMap: { table: {
      dataViewQueryModel: { orderByList: [{ alias: 'amount', orderType: 'DESC' }, { alias: 'name', orderType: 'ASC' }] },
    } } } }] };
    const target = { ...protocol.bindings(definition, 'r')[0], prdId: 't' };
    const context = JSON.parse(protocol.parameters(target, { orderByList: [{ alias: 'amount', orderType: 'ASC' }] }).queryContext);
    expect(context.orderByList).toEqual([{ alias: 'amount', orderType: 'ASC' }, { alias: 'name', orderType: 'ASC' }]);
    definition.componentsTree[0].props.dataSetModelMap.table.filterList = [{ filterType: 'variable', variableName: 'region' }];
    expect(() => protocol.parameters({ ...protocol.bindings(definition, 'r')[0], prdId: 't' })).toThrow('REPORT_VARIABLES_UNSUPPORTED');
  });
});

describe('Canvas analysis decision threshold', () => {
  test.each([[1999, false], [2000, false], [2001, true], ['30000', true], [null, false], ['', false]])('%s records requires decision: %s', (count, requiresUserDecision) => {
    expect(assessAnalysisDataVolume({ content: { data: [], totalCount: count } })).toMatchObject({ requiresUserDecision });
  });
  test('never estimates a total from the loaded page', () => {
    expect(assessAnalysisDataVolume({ data: new Array(3000) })).toMatchObject({ totalCount: null, countStatus: 'unknown', nextAction: 'verify_count_or_ask_expected_volume' });
  });
});
