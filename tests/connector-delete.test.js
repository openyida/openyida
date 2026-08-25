'use strict';

const fs = require('fs');
const path = require('path');

jest.mock('../lib/connector/api', () => ({
  findConnectorById: jest.fn(),
  getAuthRef: jest.fn(),
}));

const connectorApi = require('../lib/connector/api');
const connectorDelete = require('../lib/connector/connector-delete');
const actualConnectorApi = jest.requireActual('../lib/connector/api');

describe('connector delete safety boundary', () => {
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    connectorApi.getAuthRef.mockReturnValue({ authMode: 'token' });
    connectorApi.findConnectorById.mockResolvedValue({
      id: '910244',
      connectorName: 'Http_owned',
      displayName: 'Owned Connector',
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('without --force only prints the first warning and performs no API lookup', async () => {
    await connectorDelete.run(['910244']);

    expect(connectorApi.getAuthRef).not.toHaveBeenCalled();
    expect(connectorApi.findConnectorById).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('在平台删除连接器不可恢复');
    expect(output).toContain('CLI 不会执行删除');
  });

  test('--force only identifies the connector and directs the user to manual deletion', async () => {
    await connectorDelete.run(['910244', '--force']);

    expect(connectorApi.getAuthRef).toHaveBeenCalledTimes(1);
    expect(connectorApi.findConnectorById).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('CLI 未执行删除操作');
    expect(output).toContain('无法确定性证明');
    expect(output).toContain('customConnectorFactory');
    expect(output).not.toContain('连接器删除成功');
  });

  test('the connector API does not expose an unguarded delete mutation', () => {
    expect(actualConnectorApi.deleteConnector).toBeUndefined();
  });

  test('public docs and every locale describe connector delete as read-only guidance', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const docs = [
      ['README.md', 'Show manual deletion guidance (CLI does not delete)'],
      ['README_zhCN.md', '显示平台手工删除指引（CLI 不执行删除）'],
      ['yida-skills/skills/yida-connector/SKILL.md', 'CLI 不执行连接器删除'],
    ];
    for (const [relativePath, expected] of docs) {
      expect(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')).toContain(expected);
    }

    const localePaths = [
      'lib/core/locales/en.js',
      'lib/core/locales/zh.js',
      ...['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'vi', 'zh-HK']
        .map((locale) => `locales-extra/core/${locale}.js`),
    ];
    expect(localePaths).toHaveLength(12);
    for (const relativePath of localePaths) {
      const locale = require(path.join(repoRoot, relativePath));
      expect(locale.help.cmd_connector_delete).toContain('CLI');
      expect(locale.cli.help).toMatch(/connector delete <connector-id> \[--force\].*CLI/);
    }
  });
});
