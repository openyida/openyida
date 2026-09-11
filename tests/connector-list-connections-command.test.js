'use strict';

jest.mock('../lib/connector/api', () => ({
  getAuthRef: jest.fn(() => ({ authMode: 'token' })),
  printTable: jest.fn(),
  findConnectorById: jest.fn(async () => ({
    id: 910244,
    displayName: '钉钉日程',
    connectorName: 'Http_calendar',
  })),
  listConnections: jest.fn(async () => ([{
    id: 7,
    connectionName: '钉钉日程账号',
    status: 'ACTIVE',
  }])),
}));

const { run } = require('../lib/connector/connector-list-connections');

describe('connector list-connections machine-readable output', () => {
  test('--json writes exactly one parseable payload without progress text', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await run(['910244', '--json']);
      expect(result).toMatchObject({ success: true, connectorId: '910244' });
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(log.mock.calls[0][0])).toEqual(result);
    } finally {
      log.mockRestore();
    }
  });
});
