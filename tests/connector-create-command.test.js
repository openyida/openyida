'use strict';

const path = require('path');

jest.mock('../lib/connector/api', () => ({
  getAuthRef: jest.fn(() => ({ authMode: 'token' })),
  buildConnectorDesc: jest.fn(() => 'owned connector'),
  findConnectorById: jest.fn(),
  getConnectorDetail: jest.fn(),
  saveConnector: jest.fn(async () => ({ connectorId: 910244, readbackVerified: true })),
}));

const connectorApi = require('../lib/connector/api');
const { run } = require('../lib/connector/connector-create');

describe('connector create machine-readable result', () => {
  test('creates a DingAuth definition without credentials and returns its configuration URL', async () => {
    const operationsFile = path.resolve(
      __dirname,
      '..',
      'yida-skills/skills/yida-connector/examples/operations-device-alarm.json'
    );
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await run([
        '钉钉日程',
        'api.dingtalk.com',
        '--auth',
        '钉钉开放平台验证',
        '--operations',
        operationsFile,
        '--json',
      ]);

      expect(result).toMatchObject({
        success: true,
        connectorId: 910244,
        readbackVerified: true,
      });
      expect(result.detailUrl).toContain('customConnectorFactory/update?id=910244');
      expect(connectorApi.saveConnector.mock.calls[0][0].securitySchemes)
        .toBe('{"DingAuth":{}}');
      expect(JSON.stringify(connectorApi.saveConnector.mock.calls[0][0]))
        .not.toContain('appSecret');
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(log.mock.calls[0][0])).toEqual(result);
    } finally {
      log.mockRestore();
    }
  });
});
