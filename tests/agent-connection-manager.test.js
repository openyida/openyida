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
    await run(['run', '--state-dir', root], { env: { PATH: providerDir }, signals, stdout: { write() {} } });
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
});
