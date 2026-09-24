'use strict';

jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn(() => ({ baseUrl: 'https://example.com' })) }));
jest.mock('../lib/integration/integration-api', () => ({ listLogicflowDetailLogs: jest.fn() }));

const { listLogicflowDetailLogs } = require('../lib/integration/integration-api');
const { parseArgs, fetchAll, run } = require('../lib/integration/integration-detail-log');

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

  test('default and --json modes omit values; explicit mode includes them', async () => {
    const node = { name: 'retrieve', activityKey: 'DATA_RETRIEVE', elapsedTime: 7,
      inputParams: { systemToken: 'secret-value' }, outputParams: { result: { id: 1 } } };
    listLogicflowDetailLogs.mockResolvedValue({ currentPage: 1, totalCount: 1, data: [node] });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await run(['APP_TEST', 'run-1']);
      expect(log.mock.calls.flat().join('\n')).not.toContain('secret-value');
      log.mockClear();
      await run(['APP_TEST', 'run-1', '--json']);
      const safe = JSON.parse(log.mock.calls[0][0]);
      expect(safe.nodes[0].inputKeys).toEqual(['systemToken']);
      expect(safe.nodes[0]).not.toHaveProperty('inputParams');
      log.mockClear();
      await run(['APP_TEST', 'run-1', '--json', '--include-params']);
      expect(JSON.parse(log.mock.calls[0][0]).nodes[0].inputParams.systemToken).toBe('secret-value');
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
