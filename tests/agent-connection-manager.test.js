'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/agent/runtime-package', () => ({
  PROTOCOL_VERSION: 1,
  resolveRuntime: jest.fn(() => ({ executable: '/signed/runtime' })),
}));
jest.mock('../lib/agent/frozen-bundle', () => ({
  materializeBundle: jest.fn((runtime, config) => ({ runtime, config })),
}));
jest.mock('../lib/agent/stdio', () => ({
  launchRuntime: jest.fn(async () => {}),
}));
jest.mock('../lib/agent/connection-store', () => ({
  prepareConnection: jest.fn(),
  listConnections: jest.fn(() => [
    { installationId: 'installation-one', stateDir: '/state/org-a', endpoint: 'https://agent.test', endpointId: 'prod', connectionId: 'connection-a' },
    { installationId: 'installation-one', stateDir: '/state/org-b', endpoint: 'https://agent.test', endpointId: 'prod', connectionId: 'connection-b' },
  ]),
}));

const { EventEmitter } = require('events');
const { run } = require('../lib/agent/cmd');
const { launchRuntime } = require('../lib/agent/stdio');
const { materializeBundle } = require('../lib/agent/frozen-bundle');

describe('multi-Connection foreground supervisor', () => {
  let root;
  let providerDir;
  let signals;

  beforeEach(() => {
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-manager-'));
    providerDir = path.join(root, 'providers');
    fs.mkdirSync(providerDir);
    fs.writeFileSync(path.join(providerDir, 'qoder'), '#!/bin/sh\n', { mode: 0o700 });
    signals = new EventEmitter();
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('agent run restores every organization Connection with one shared installation', async () => {
    await run([
      'run', '--state-dir', root, '--provider', 'qoder',
      '--provider-path', path.join(providerDir, 'qoder'),
    ], { env: { PATH: providerDir, HOME: root }, signals, stdout: { write() {} } });
    expect(materializeBundle).toHaveBeenCalledTimes(2);
    expect(launchRuntime).toHaveBeenCalledTimes(2);
    expect(launchRuntime.mock.calls.map(([, config]) => ({
      stateDir: config.stateDir,
      installationId: config.installationId,
      endpointId: config.endpointId,
      providers: config.providers.map(item => item.provider),
    }))).toEqual([
      { stateDir: '/state/org-a', installationId: 'installation-one', endpointId: 'prod', providers: ['qoder'] },
      { stateDir: '/state/org-b', installationId: 'installation-one', endpointId: 'prod', providers: ['qoder'] },
    ]);
    expect(signals.listenerCount('SIGINT')).toBe(0);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
  });

  test('all synchronous bundles are prepared before any Runtime starts waiting for stdin', async () => {
    const actions = [];
    materializeBundle.mockImplementationOnce((runtime, config) => {
      actions.push('prepare-a');
      return { runtime, config };
    }).mockImplementationOnce((runtime, config) => {
      actions.push('prepare-b');
      return { runtime, config };
    });
    launchRuntime.mockImplementationOnce(async () => { actions.push('launch-a'); })
      .mockImplementationOnce(async () => { actions.push('launch-b'); });
    await run([
      'run', '--state-dir', root, '--provider', 'qoder',
      '--provider-path', path.join(providerDir, 'qoder'),
    ], { env: { PATH: providerDir, HOME: root }, signals, stdout: { write() {} } });
    expect(actions).toEqual(['prepare-a', 'prepare-b', 'launch-a', 'launch-b']);
  });

  test('a bundle preparation failure starts no Runtime and leaves no signal listeners', async () => {
    materializeBundle.mockImplementationOnce((runtime, config) => ({ runtime, config }))
      .mockImplementationOnce(() => { throw Object.assign(new Error('bundle invalid'), { code: 'AGENT_BUNDLE_INVALID' }); });
    await expect(run([
      'run', '--state-dir', root, '--provider', 'qoder',
      '--provider-path', path.join(providerDir, 'qoder'),
    ], { env: { PATH: providerDir, HOME: root }, signals, stdout: { write() {} } }))
      .rejects.toMatchObject({ code: 'AGENT_BUNDLE_INVALID' });
    expect(launchRuntime).not.toHaveBeenCalled();
    expect(signals.listenerCount('SIGINT')).toBe(0);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
  });

  test('one failed organization Connection does not stop another running Connection', async () => {
    let finishHealthy;
    const healthy = new Promise(resolve => {finishHealthy = resolve;});
    launchRuntime
      .mockRejectedValueOnce(Object.assign(new Error('refresh conflict'), {code: 'CONTROL_HTTP_FAILED'}))
      .mockReturnValueOnce(healthy);

    let settled = false;
    const supervised = run([
      'run', '--state-dir', root, '--provider', 'qoder',
      '--provider-path', path.join(providerDir, 'qoder'),
    ], {
      env: {PATH: providerDir, HOME: root}, signals, stdout: {write() {}},
    }).then(() => {settled = true;});
    await new Promise(resolve => setImmediate(resolve));

    expect(settled).toBe(false);
    expect(signals.listenerCount('SIGTERM')).toBe(1);
    finishHealthy();
    await supervised;
    expect(signals.listenerCount('SIGINT')).toBe(0);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
  });

  test('read-only status enumerates Connections without materializing execution bundles', async () => {
    await run(['status', '--state-dir', root], { env: {}, signals, stdout: { write() {} } });
    expect(materializeBundle).not.toHaveBeenCalled();
    expect(launchRuntime).toHaveBeenCalledTimes(2);
    expect(launchRuntime.mock.calls.map(([, config]) => config.command)).toEqual(['status', 'status']);
  });

  test('diagnostics aggregates every organization Connection and preserves only correlation IDs', async () => {
    launchRuntime.mockImplementation(async (_runtime, config, options) => {
      options.stdout.write(JSON.stringify({
        type: 'diagnostic', diagnosticId: config.diagnosticId,
        findings: [{ severity: 'warning', code: 'SESSION_NOT_SEEN_LOCALLY' }],
      }));
    });
    const stdout = { write: jest.fn() };
    await run([
      'diagnose', '--session',
      'https://pre-yida.example/APP_TEST/admin/?sessionId=local_fixture&ignored=secret',
      '--state-dir', root, '--json',
    ], { env: { PATH: providerDir }, signals, stdout });
    const result = JSON.parse(stdout.write.mock.calls.at(-1)[0]);
    expect(result).toMatchObject({
      type: 'diagnostic', phase: 'session', sessionId: 'local_fixture', appType: 'APP_TEST',
    });
    expect(result.connections).toHaveLength(2);
    expect(result.connections.every((item) => item.diagnosticId === result.diagnosticId)).toBe(true);
    expect(result.findings).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('ignored');
    expect(materializeBundle).not.toHaveBeenCalled();
  });

  test('multi-organization supervisor permits more than ten Connection listeners', async () => {
    const connectionStore = require('../lib/agent/connection-store');
    connectionStore.listConnections.mockReturnValue(Array.from({ length: 12 }, (_, index) => ({
      installationId: 'installation-one',
      stateDir: `/state/org-${index}`,
      endpoint: 'https://agent.test',
      endpointId: 'prod',
      connectionId: `connection-${index}`,
    })));
    launchRuntime.mockImplementation(async (_runtime, _config, launchOptions) => {
      expect(launchOptions.signals.getMaxListeners()).toBe(0);
    });

    await run(['status', '--state-dir', root], { env: {}, signals, stdout: { write() {} } });
    expect(launchRuntime).toHaveBeenCalledTimes(12);
  });

  test('connection diagnosis finds failed enrollment even without a paired Connection', async () => {
    require('../lib/agent/connection-store').listConnections.mockReturnValueOnce([]);
    const logs = path.join(root, 'logs');
    fs.mkdirSync(logs);
    fs.writeFileSync(path.join(logs, 'openyida-local-agent-runtime-20260915T000000Z-200.0.jsonl'), JSON.stringify({
      schema: 'openyida.local_agent.diagnostic.v1', event: 'runtime_failed', timestamp: new Date().toISOString(),
      errorCode: 'DEVICE_CREDENTIAL_RESPONSE_INVALID', credentialReason: 'access_expired', accessRemainingSeconds: -2,
      accessToken: 'private-token', phase: 'connect',
    }));
    launchRuntime.mockImplementation(async (_runtime, config, options) => {
      options.stdout.write(JSON.stringify({type: 'diagnostic', diagnosticId: config.diagnosticId,
        findings: [{code: 'DEVICE_NOT_PAIRED', severity: 'error'}]}));
    });
    const stdout = { write: jest.fn() };
    await run(['diagnose', '--state-dir', root, '--json'], {env: {PATH: providerDir}, signals, stdout});
    const result = JSON.parse(stdout.write.mock.calls.at(-1)[0]);
    expect(result.recentConnectionFailures).toEqual([expect.objectContaining({historical: true, credentialReason: 'access_expired', accessRemainingSeconds: -2})]);
    expect(result.findings).toContainEqual(expect.objectContaining({code: 'RECENT_DEVICE_CREDENTIAL_REJECTION', historical: true}));
    expect(JSON.stringify(result)).not.toContain('private-token');
    expect(materializeBundle).not.toHaveBeenCalled();
  });
});
