'use strict';

jest.mock('../lib/connector/api', () => ({ getAuthRef: jest.fn(() => ({ authMode: 'token' })),
  findConnectorById: jest.fn(), listAllConnections: jest.fn(), getConnectorDetail: jest.fn(), connectorPostOnce: jest.fn() }));
const api = require('../lib/connector/api');
const { runAction: run, runConnection: runCommand } = require('../lib/connector/connector-create-connection');
let row, log;
const tty = { isTTY: true, setRawMode: jest.fn() };
const auth = { interactive: true, input: tty, output: {}, readSecret: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  row = { id: 22, connectorName: 'Http_owned', connectionName: 'owned', authType: 5, status: 1,
    securitySchemes: '{"DingAuth":{}}',
    securityValue: '{"arbitraryHeader":"must-not-print","appSecret":"must-not-print"}' };
  api.findConnectorById.mockResolvedValue({ id: 11, connectorName: 'Http_owned' });
  api.listAllConnections.mockImplementation(async () => [{ ...row }]);
  api.getConnectorDetail.mockResolvedValue({ securitySchemes: '{"DingAuth":{}}' });
  api.connectorPostOnce.mockImplementation(async (_path, params) => {
    // The native update mapper changes credentials/name, not authentication type.
    row.connectionName = params.connectionName;
    return { success: true, content: 22 };
  });
  auth.readSecret.mockReset().mockResolvedValueOnce('fake-key').mockResolvedValueOnce('fake-secret');
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

test('unknown account operations reject before auth while detail dispatches through the CLI entry', async () => {
  await expect(runCommand(['delete', '11', '22'])).rejects.toMatchObject({ code: 'CLI_INVALID_ARGUMENTS' });
  expect(api.getAuthRef).not.toHaveBeenCalled();
  await expect(runCommand(['detail', '11', '22', '--json'])).resolves.toMatchObject({ connectionId: '22' });
});

test('detail exposes only account metadata and no credentials or fragments', async () => {
  const result = await run(['11', '22', '--json'], 'detail');
  expect(result).toEqual({ success: true, connectorId: '11', connectionId: '22', connectionName: 'owned',
    connectorName: 'Http_owned', typeCode: 5, status: 1, source: 'connection_list', credentialValuesIncluded: false });
  expect(log.mock.calls.flat().join('')).not.toMatch(/securityValue|must-not-print|appSecret/);
  expect(api.connectorPostOnce).not.toHaveBeenCalled();
});

test.each([[], [{ id: 22, connectorName: 'Http_other' }], [{ id: 22, connectorName: 'Http_owned' }, { id: 22, connectorName: 'Http_owned' }]].map(rows => [rows]))(
  'rejects missing, foreign or ambiguous accounts before a write', async rows => {
    api.listAllConnections.mockResolvedValue(rows);
    await expect(run(['11', '22'], 'update')).rejects.toMatchObject({ code: 'CONNECTOR_CONNECTION_TARGET_INVALID' });
    expect(api.connectorPostOnce).not.toHaveBeenCalled();
  });

test('update defaults to a concrete preview without prompting for secrets', async () => {
  const result = await run(['11', '22', '--name', 'new'], 'update', auth);
  expect(result).toMatchObject({ dryRun: true, mutationPerformed: false, requiresConfirm: true,
    requestedConnectionName: 'new', connectionId: '22' });
  expect(auth.readSecret).not.toHaveBeenCalled();
  expect(api.connectorPostOnce).not.toHaveBeenCalled();
});

test('explicit credential replacement keeps matching DingAuth type and verifies only metadata', async () => {
  const result = await run(['11', '22', '--name', 'new', '--confirm', '--interactive'], 'update', auth);
  expect(api.connectorPostOnce).toHaveBeenCalledTimes(1);
  expect(api.connectorPostOnce.mock.calls[0][1]).toEqual({ id: '22', connectorName: 'Http_owned', connectionName: 'new',
    securityValue: '{"appKey":"fake-key","appSecret":"fake-secret"}' });
  expect(result).toMatchObject({ typeCode: 5, connectionName: 'new', metadataReadbackVerified: true,
    credentialsVerified: false, credentialValuesIncluded: false });
  expect(log.mock.calls.flat().join('')).not.toMatch(/fake-key|fake-secret|must-not-print/);
});

test.each([4, null, undefined])('mismatched or missing account type %s rejects before reading new credentials', async type => {
  row.authType = type;
  await expect(run(['11', '22', '--confirm', '--interactive'], 'update', auth))
    .rejects.toMatchObject({ code: 'CONNECTOR_CONNECTION_AUTH_TYPE_MISMATCH', details: {
      connectionId: '22', expectedTypeCode: 5, actualTypeCode: type ?? null, sideEffectState: 'none',
    } });
  expect(auth.readSecret).not.toHaveBeenCalled();
  expect(api.connectorPostOnce).not.toHaveBeenCalled();
});

test.each(['{"ApiKeyAuth":{}}', null, undefined, 'unreadable'])(
  'an incompatible or unreadable saved scheme %s prevents credential replacement', async scheme => {
    row.securitySchemes = scheme;
    await expect(run(['11', '22', '--confirm', '--interactive'], 'update', auth))
      .rejects.toMatchObject({ code: 'CONNECTOR_CONNECTION_AUTH_SCHEME_MISMATCH', details: { sideEffectState: 'none' } });
    expect(auth.readSecret).not.toHaveBeenCalled();
    expect(api.connectorPostOnce).not.toHaveBeenCalled();
  });

test('a saved account scheme changed during hidden input prevents the mutation', async () => {
  auth.readSecret.mockReset().mockImplementation(async () => { row.securitySchemes = '{"ApiKeyAuth":{}}'; return 'fake'; });
  await expect(run(['11', '22', '--confirm', '--interactive'], 'update', auth))
    .rejects.toMatchObject({ code: 'CONNECTOR_CONNECTION_CHANGED' });
  expect(api.connectorPostOnce).not.toHaveBeenCalled();
});

test.each([
  { input: { isTTY: false } },
  { readSecret: jest.fn(async () => '') },
])('invalid or empty hidden input prevents writes', async override => {
  await expect(run(['11', '22', '--confirm', '--interactive'], 'update', { ...auth, ...override }))
    .rejects.toMatchObject({ details: { sideEffectState: 'none' } });
  expect(api.connectorPostOnce).not.toHaveBeenCalled();
});

test('a changed account during hidden input prevents the mutation', async () => {
  auth.readSecret.mockReset().mockImplementation(async () => { row.connectionName = 'another editor'; return 'fake'; });
  await expect(run(['11', '22', '--confirm', '--interactive'], 'update', auth))
    .rejects.toMatchObject({ code: 'CONNECTOR_CONNECTION_CHANGED' });
  expect(api.connectorPostOnce).not.toHaveBeenCalled();
});

test.each(['network', 'envelope', 'readback'])('unknown %s result preserves account identity and never replays', async failure => {
  if (failure === 'network') { api.connectorPostOnce.mockRejectedValue(new Error('raw secret must-not-print')); }
  if (failure === 'envelope') { api.connectorPostOnce.mockResolvedValue({ success: false, errorMsg: 'must-not-print' }); }
  if (failure === 'readback') { api.connectorPostOnce.mockResolvedValue({ success: true, content: 22 }); }
  await expect(run(['11', '22', '--name', 'new', '--confirm', '--interactive'], 'update', auth))
    .rejects.toMatchObject({ code: 'CONNECTOR_CONNECTION_UPDATE_UNVERIFIED', details: {
      partial: { connectionId: '22' }, retrySafe: false, sideEffectState: 'unknown',
    } });
  expect(api.connectorPostOnce).toHaveBeenCalledTimes(1);
  expect(log).not.toHaveBeenCalled();
});

test.each([['11', '22', '--app-secret', 'forbidden'], ['11'], ['11', '22', '33']].map(args => [args]))(
  'rejects unsupported arguments before reading auth: %j', async args => {
    await expect(run(args, 'update', auth)).rejects.toMatchObject({ code: 'CLI_INVALID_ARGUMENTS' });
    expect(api.getAuthRef).not.toHaveBeenCalled();
  });
