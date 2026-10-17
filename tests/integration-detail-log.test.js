'use strict';

jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn(() => ({ baseUrl: 'https://example.com' })) }));
jest.mock('../lib/integration/integration-api', () => ({ listLogicflowDetailLogs: jest.fn() }));

const { listLogicflowDetailLogs } = require('../lib/integration/integration-api');
const { MAX_PAGES, MAX_RECORDS, parseArgs, fetchAll, run } = require('../lib/integration/integration-detail-log');

describe('integration detail-log', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('requires explicit JSON mode for full parameter values', () => {
    expect(() => parseArgs(['APP_TEST', 'run-1', '--include-params'])).toThrow();
    expect(() => parseArgs(['APP_TEST'])).toThrow();
    expect(() => parseArgs(['APP_TEST', 'run-1', '--unexpected'])).toThrow();
  });

  test('uses totalCount to fetch all pages even when hasMore is false', async () => {
    listLogicflowDetailLogs
      .mockResolvedValueOnce({ currentPage: 1, totalCount: 101, hasMore: false, data: Array.from({ length: 100 }, (_, i) => ({ name: `node-${i}` })) })
      .mockResolvedValueOnce({ currentPage: 2, totalCount: 101, hasMore: false, data: [{ name: 'last' }] });
    const result = await fetchAll({}, 'APP_TEST', 'run-1');
    expect(result.nodes).toHaveLength(101);
    expect(listLogicflowDetailLogs).toHaveBeenNthCalledWith(2, {}, {
      appType: 'APP_TEST', procInstId: 'run-1', pageIndex: 2, pageSize: 100,
    });
  });

  test('does not print partial results when a later page is empty', async () => {
    listLogicflowDetailLogs
      .mockResolvedValueOnce({ currentPage: 1, totalCount: 101, data: Array.from({ length: 100 }, () => ({})) })
      .mockResolvedValueOnce({ currentPage: 2, totalCount: 101, data: [] });
    await expect(fetchAll({}, 'APP_TEST', 'run-1')).rejects.toMatchObject({ code: 'INTEGRATION_DETAIL_LOG_PAGINATION_FAILED' });
  });

  test('default modes omit values; explicit mode includes business values and fully masks secrets', async () => {
    const node = { name: 'retrieve', activityKey: 'DATA_RETRIEVE', elapsedTime: 7,
      inputParams: { systemToken: 'secret-value', query: 'safe-query' },
      outputParams: { result: { id: 1, credentials: [{ Authorization: 'Bearer long-secret-value', Cookie: 'session-cookie-value', password: 'p' }] } } };
    const original = JSON.parse(JSON.stringify(node));
    listLogicflowDetailLogs.mockResolvedValue({ currentPage: 1, totalCount: 1, data: [node] });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await run(['APP_TEST', 'run-1']);
      expect(log.mock.calls.flat().join('\n')).not.toContain('secret-value');
      log.mockClear();
      await run(['APP_TEST', 'run-1', '--json']);
      const safe = JSON.parse(log.mock.calls[0][0]);
      expect(safe.nodes[0].inputKeys).toEqual(['systemToken', 'query']);
      expect(safe.nodes[0]).not.toHaveProperty('inputParams');
      log.mockClear();
      await run(['APP_TEST', 'run-1', '--json', '--include-params']);
      expect(JSON.parse(log.mock.calls[0][0]).nodes[0]).toMatchObject({
        inputParams: { systemToken: '***', query: 'safe-query' },
        outputParams: { result: { id: 1, credentials: [{ Authorization: '***', Cookie: '***', password: '***' }] } },
      });
      expect(log.mock.calls.flat().join('\n')).not.toMatch(/secret-value|session-cookie-value/);
      expect(node).toEqual(original);
    } finally { log.mockRestore(); }
  });

  test.each([MAX_RECORDS + 1, Number.MAX_SAFE_INTEGER])('rejects totalCount %s after one request without printing partial results', async (totalCount) => {
    listLogicflowDetailLogs.mockResolvedValue({ currentPage: 1, totalCount, data: [{ name: 'first' }] });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(run(['APP_TEST', 'run-1', '--json'])).rejects.toMatchObject({ code: 'INTEGRATION_DETAIL_LOG_PAGINATION_LIMIT' });
      expect(listLogicflowDetailLogs).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  test('allows the full record count to complete on the final permitted page', async () => {
    listLogicflowDetailLogs.mockImplementation(async (_authRef, { pageIndex, pageSize }) => ({
      currentPage: pageIndex, totalCount: MAX_RECORDS,
      data: Array.from({ length: pageSize }, () => ({ name: 'node' })),
    }));
    const result = await fetchAll({}, 'APP_TEST', 'run-1');
    expect(result.nodes).toHaveLength(MAX_RECORDS);
    expect(listLogicflowDetailLogs).toHaveBeenCalledTimes(MAX_PAGES);
  });

  test('stops sparse responses at the page limit without requesting page 101 or printing partial results', async () => {
    listLogicflowDetailLogs.mockImplementation(async (_authRef, { pageIndex }) => ({
      currentPage: pageIndex, totalCount: MAX_PAGES + 1, data: [{ name: 'node' }],
    }));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(run(['APP_TEST', 'run-1'])).rejects.toMatchObject({ code: 'INTEGRATION_DETAIL_LOG_PAGINATION_LIMIT' });
      expect(listLogicflowDetailLogs).toHaveBeenCalledTimes(MAX_PAGES);
      expect(listLogicflowDetailLogs.mock.calls.at(-1)[1].pageIndex).toBe(MAX_PAGES);
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  test('reports zero nodes without claiming the ID is invalid', async () => {
    listLogicflowDetailLogs.mockResolvedValue({ currentPage: 1, totalCount: 0, data: [] });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await run(['APP_TEST', 'run-1', '--json']);
      expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ totalCount: 0, nodes: [] });
    } finally { log.mockRestore(); }
  });
});
