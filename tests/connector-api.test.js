'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  httpPostJson: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  createConnection,
  listConnections,
  saveConnector,
  testConnector,
} = require('../lib/connector/api');
const { buildConnectorDesc } = require('../lib/connector/api');
const { buildSecuritySchemes, parseBaseUrl } = require('../lib/connector/connector-create');

const authRef = {
  baseUrl: 'https://www.aliwork.com',
  authMode: 'token',
  authSource: 'token',
  userId: 'sensitive-user-id',
  authData: {
    auth_mode: 'token',
    auth_source: 'token',
    user_id: 'sensitive-user-id',
  },
};

function buildConnectorParams(overrides = {}) {
  return {
    operations: JSON.stringify([{
      id: 'operation-ping',
      operationId: 'ping',
      summary: 'Ping',
      method: 'get',
      url: 'v1/ping',
    }]),
    displayName: 'E2E Connector',
    iconUrl: 'chaxun%%#FFA200',
    connectorDesc: 'owned by test',
    host: 'api.example.com',
    baseUrl: '/',
    scheme: 'https',
    tongxunluTemplateId: '',
    faasTemplateId: '0',
    securitySchemes: '{}',
    connectorMode: '5',
    connectorName: 'Http_owned',
    category: 'http',
    ...overrides,
  };
}

describe('connector frontend API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue(authRef.authData);
  });

  test('save sends once and verifies the exact connector detail readback', async () => {
    const params = buildConnectorParams();
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { id: 101, connectorName: params.connectorName },
    });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { content: { ...params, id: 101, templateId: '0' } },
    });

    const result = await saveConnector(params, authRef);

    expect(result).toMatchObject({
      connectorId: 101,
      connectorName: params.connectorName,
      readbackVerified: true,
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[0][1]).toContain('getConnectorDetail.json');
  });

  test('save accepts the platform empty FAAS sentinel for a plain HTTP connector', async () => {
    const params = buildConnectorParams();
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { id: 101, connectorName: params.connectorName },
    });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { content: { ...params, faasTemplateId: '', id: 101 } },
    });

    await expect(saveConnector(params, authRef)).resolves.toMatchObject({
      connectorId: 101,
      readbackVerified: true,
    });
  });

  test('save still fails closed when a semantic connector field changes', async () => {
    const params = buildConnectorParams();
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { id: 101, connectorName: params.connectorName },
    });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { content: { ...params, host: 'different.example.com', id: 101 } },
    });

    await expect(saveConnector(params, authRef)).rejects.toMatchObject({
      code: 'CONNECTOR_READBACK_MISMATCH',
    });
  });

  test('save fails closed when success omits both id and connectorName', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: {} });

    await expect(saveConnector(buildConnectorParams(), authRef)).rejects.toMatchObject({
      code: 'CONNECTOR_WRITE_IDENTITY_MISSING',
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).not.toHaveBeenCalled();
  });

  test('listConnections follows the frontend POST pagination contract', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { data: [{ id: 7 }], totalCount: 1 },
    });

    await expect(listConnections('Http_owned', authRef)).resolves.toEqual([{ id: 7 }]);

    expect(utils.httpPost.mock.calls[0][1]).toContain('/query/connection/listConnection.json');
    expect(utils.httpPost.mock.calls[0][2]).toContain('pageSize=100');
    expect(utils.httpPost.mock.calls[0][2]).toContain('pageNumber=1');
  });

  test('connection creation writes once and recovers the exact owned account by readback', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { data: [], totalCount: 0 } })
      .mockResolvedValueOnce({ success: true, content: { id: 7 } })
      .mockResolvedValueOnce({
        success: true,
        content: { data: [{ id: 7, connectionName: 'Owned Account' }] },
      });

    await expect(createConnection({
      connectionName: 'Owned Account',
      securityValue: JSON.stringify({ token: 'synthetic-secret' }),
      connectorName: 'Http_owned',
      securitySchemes: JSON.stringify({ ApiKeyAuth: { name: 'X-API-Key' } }),
      authType: 3,
    }, authRef)).resolves.toMatchObject({
      id: 7,
      connectionName: 'Owned Account',
      readbackVerified: true,
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(3);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(2);
  });

  test('test action uses the frontend JSON testOperation request exactly once', async () => {
    utils.httpPostJson.mockResolvedValue({ statusLine: 'HTTP/1.1 200 OK', content: '{"ok":true}' });

    const result = await testConnector({
      connector: buildConnectorParams(),
      operation: { method: 'post', url: 'v1/ping' },
      header: { 'X-Trace': 'owned' },
      query: { q: '1' },
      path: {},
      body: { hello: 'world' },
      authId: '7',
    }, authRef);

    expect(result.statusLine).toContain('200 OK');
    expect(utils.httpPostJson).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      expect.stringContaining('/query/newconnector/testOperation.json'),
      {
        url: 'https://api.example.com/v1/ping',
        connection: '7',
        method: 'post',
        path: {},
        query: { q: '1' },
        header: { 'X-Trace': 'owned' },
        connectorMode: 5,
        body: { hello: 'world' },
      },
      {}
    );
    expect(utils.httpPostJson).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('test action omits connection for a no-auth connector like the frontend', async () => {
    utils.httpPostJson.mockResolvedValue({ statusLine: 'HTTP/1.1 200 OK', content: '{"ok":true}' });

    await testConnector({
      connector: buildConnectorParams(),
      operation: { method: 'get', url: 'v1/ping' },
      header: {},
      query: { runId: 'owned' },
      path: {},
      body: {},
      authId: '',
    }, authRef);

    expect(utils.httpPostJson.mock.calls[0][2]).not.toHaveProperty('connection');
    expect(utils.httpPostJson.mock.calls[0][2].connectorMode).toBe(5);
  });

  test('connector metadata and auth definitions do not persist raw identity or credentials', () => {
    const description = buildConnectorDesc(
      'safe description',
      'old\n---\n👤 创建人: legacy-sensitive-id',
      authRef,
      []
    );
    expect(description).not.toContain('sensitive-user-id');
    expect(description).not.toContain('legacy-sensitive-id');

    const basic = JSON.parse(buildSecuritySchemes({
      authType: 'BASIC',
      username: 'actual-user',
      password: 'actual-password',
    }));
    expect(JSON.stringify(basic)).not.toContain('actual-user');
    expect(JSON.stringify(basic)).not.toContain('actual-password');
    expect(basic.BasicAuth).toEqual({
      username: '用户名',
      password: '密码',
      type: 'http',
      scheme: 'basic',
    });
  });

  test('base URL parsing preserves the frontend connector base path', () => {
    expect(parseBaseUrl('https://api.example.com/open/v1/')).toEqual({
      scheme: 'https',
      host: 'api.example.com',
      basePath: '/open/v1/',
    });
  });
});
