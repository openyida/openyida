'use strict';

jest.mock('../lib/connector/api', () => ({ getAuthRef: jest.fn(() => ({})), findConnectorById: jest.fn(), getConnectorDetail: jest.fn(), saveConnector: jest.fn(), createConnection: jest.fn() }));
const api = require('../lib/connector/api');
const { run } = require('../lib/connector/connector-create-connection');

describe('API Key account creation and explicit legacy repair', () => {
  let detail, log;
  const args = ['101', 'replacement', '--api-key', 'FAKE_PROBE', '--json'];
  beforeEach(() => {
    jest.clearAllMocks();
    detail = { id: 101, connectorName: 'Http_EXISTING', displayName: 'Probe', host: 'example.test', operations: '[{"id":"echo"}]',
      securitySchemes: JSON.stringify({ ApiKeyAuth: { name: 'Authorization', location: 'header' } }) };
    api.findConnectorById.mockResolvedValue(detail);
    api.getConnectorDetail.mockImplementation(async () => detail);
    api.saveConnector.mockResolvedValue({ readbackVerified: true });
    api.createConnection.mockResolvedValue({ id: 202, readbackVerified: true });
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  test('legacy configuration requires explicit repair before any write', async () => {
    await expect(run(args)).rejects.toMatchObject({ code: 'CONNECTOR_API_KEY_REPAIR_REQUIRED' });
    expect(api.saveConnector).not.toHaveBeenCalled();
    expect(api.createConnection).not.toHaveBeenCalled();
  });

  test('repair preserves operations and identity, then creates a replacement account without logging its key', async () => {
    const result = await run([...args, '--repair-api-key-scheme']);
    expect(api.saveConnector).toHaveBeenCalledWith(expect.objectContaining({ id: 101, operations: detail.operations, connectorName: 'Http_EXISTING' }), expect.any(Object));
    const account = api.createConnection.mock.calls[0][0];
    expect(JSON.parse(account.securityValue)).toEqual({ Authorization: 'FAKE_PROBE' });
    expect(JSON.parse(account.securitySchemes).ApiKeyAuth).toMatchObject({ type: 'apiKey', in: 'header', name: 'Authorization' });
    expect(api.saveConnector.mock.invocationCallOrder[0]).toBeLessThan(api.createConnection.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ schemeRepaired: true, existingAccountsUnchanged: true, connectionId: 202 });
    expect(JSON.stringify(log.mock.calls)).not.toContain('FAKE_PROBE');
  });

  test('repair readback failure prevents account creation', async () => {
    api.saveConnector.mockRejectedValue(new Error('readback mismatch'));
    await expect(run([...args, '--repair-api-key-scheme'])).rejects.toThrow('readback mismatch');
    expect(api.createConnection).not.toHaveBeenCalled();
  });

  test('complete Query configuration creates an account without updating the connector', async () => {
    detail.securitySchemes = JSON.stringify({ ApiKeyAuth: { name: 'api_key', type: 'apiKey', in: 'query', location: 'query' } });
    await run(args);
    expect(api.saveConnector).not.toHaveBeenCalled();
    expect(JSON.parse(api.createConnection.mock.calls[0][0].securityValue)).toEqual({ api_key: 'FAKE_PROBE' });
  });

  test.each([
    { location: 'header' },
    { name: 'Authorization', location: 'header', in: 'query' },
    { name: 'Authorization', location: 'cookie' },
  ])('invalid or conflicting configuration is not guessed during repair: %j', scheme => {
    detail.securitySchemes = JSON.stringify({ ApiKeyAuth: scheme });
    return expect(run([...args, '--repair-api-key-scheme'])).rejects.toMatchObject({ code: 'CONNECTOR_API_KEY_SCHEME_INVALID' });
  });
});
