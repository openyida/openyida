'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../lib/agent/runtime-package', () => ({ PROTOCOL_VERSION: 1, resolveRuntime: jest.fn(() => ({ executable: '/runtime' })) }));
jest.mock('../lib/agent/frozen-bundle', () => ({ materializeBundle: jest.fn((runtime, config) => ({ runtime, config })) }));
jest.mock('../lib/agent/connection-store', () => ({ prepareConnection: jest.fn(root => ({ stateDir: root, installationId: 'fixture' })), listConnections: jest.fn(() => []) }));
jest.mock('../lib/agent/stdio', () => ({ ...jest.requireActual('../lib/agent/stdio'), launchRuntime: jest.fn(async () => {}) }));
const { run } = require('../lib/agent/cmd');
const { prepareConnection } = require('../lib/agent/connection-store');
const { resolveRuntime } = require('../lib/agent/runtime-package');
const { launchRuntime } = require('../lib/agent/stdio');

describe('connect owns the pre-enrollment check', () => {
  let root, stdout, stderr;
  beforeEach(() => {
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-preflight-'));
    stdout = { write: jest.fn() }; stderr = { write: jest.fn() };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  function args(command = 'connect') {
    return [command, '--json', '--provider', 'qoder', '--provider-path', path.join(root, 'qodercli.exe'),
      '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test', '--state-dir', root];
  }
  test('failed checks never prepare enrollment, resolve Runtime or expose the ticket', async () => {
    const ticket = 'private-ticket-' + 'x'.repeat(40);
    await expect(run([...args(), '--enroll', ticket], { stdout, stderr, probe: async () => ({ status: 'launch_failed' }) }))
      .rejects.toMatchObject({ code: 'AGENT_PREFLIGHT_BLOCKED' });
    expect(prepareConnection).not.toHaveBeenCalled(); expect(resolveRuntime).not.toHaveBeenCalled();
    expect(launchRuntime).not.toHaveBeenCalled();
    expect(JSON.stringify(stdout.write.mock.calls)).not.toContain(ticket);
  });
  test('success continues with the checked executable through connect and run', async () => {
    await run(args(), { stdout, stderr, probe: async () => ({ status: 'passed' }) });
    expect(prepareConnection).toHaveBeenCalledTimes(1);
    expect(launchRuntime.mock.calls.map(call => call[1].command)).toEqual(['connect', 'run']);
    expect(launchRuntime.mock.calls[0][1].providers[0].executable).toBe(path.join(root, 'qodercli.exe'));
  });
  test('doctor uses the same classification without starting or enrolling a Runtime', async () => {
    await run(args('doctor'), { stdout, stderr, probe: async (_exe, flags) => flags[0] === '--list-models'
      ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' } });
    expect(JSON.parse(stdout.write.mock.calls[0][0])).toMatchObject({ type: 'doctor', providerReady: false,
      providers: [{ status: 'login_required', remediation: { requiresUserInteraction: true } }] });
    expect(launchRuntime).not.toHaveBeenCalled(); expect(prepareConnection).not.toHaveBeenCalled();
  });
  test('without a type, one usable provider connects and unavailable providers are excluded', async () => {
    const bin = path.join(root, '.local', 'bin'); fs.mkdirSync(bin, { recursive: true });
    const ext = process.platform === 'win32' ? '.exe' : '';
    for (const name of ['qodercli', 'codex']) { fs.writeFileSync(path.join(bin, name + ext), 'fixture', { mode: 0o700 }); }
    await run(['connect', '--json', '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test', '--state-dir', root], {
      stdout, stderr, homedir: root, env: { PATH: '', HOME: root },
      probe: async (_exe, flags) => flags[0] === '--list-models' ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' },
    });
    expect(launchRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual(['codex']);
    expect(launchRuntime).toHaveBeenCalledTimes(2);
  });
  test('provider-only never connects another available type', async () => {
    const bin = path.join(root, '.local', 'bin'); fs.mkdirSync(bin, { recursive: true });
    const ext = process.platform === 'win32' ? '.exe' : '';
    for (const name of ['qodercli', 'codex']) { fs.writeFileSync(path.join(bin, name + ext), 'fixture', { mode: 0o700 }); }
    await expect(run(['connect', '--json', '--provider', 'qoder', '--state-dir', root], {
      stdout, stderr, homedir: root, env: { PATH: '', HOME: root },
      probe: async (_exe, flags) => flags[0] === '--list-models' ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' },
    })).rejects.toMatchObject({ code: 'AGENT_PREFLIGHT_BLOCKED' });
    expect(launchRuntime).not.toHaveBeenCalled();
  });
  test('malformed explicit selection is rejected before invoking a CLI', async () => {
    const execute = jest.fn();
    await expect(run(['connect', '--provider', 'unsupported'], { probe: execute })).rejects.toMatchObject({ code: 'AGENT_PROVIDER_OPTIONS_INVALID' });
    expect(execute).not.toHaveBeenCalled();
  });
});
