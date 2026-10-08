'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../lib/agent/runtime-package', () => ({ PROTOCOL_VERSION: 1, resolveRuntime: jest.fn(() => ({ executable: '/runtime' })) }));
jest.mock('../lib/agent/frozen-bundle', () => ({ materializeBundle: jest.fn((runtime, config) => ({ runtime, config })) }));
jest.mock('../lib/agent/connection-store', () => ({ prepareConnection: jest.fn(root => ({ stateDir: root, installationId: 'fixture' })), listConnections: jest.fn(() => []) }));
jest.mock('../lib/agent/stdio', () => ({ ...jest.requireActual('../lib/agent/stdio'), launchRuntime: jest.fn(async () => {}), launchBackgroundRuntime: jest.fn(async () => ({ pid: 4242, logPath: '/fixture/agent-run.log' })) }));
const { run } = require('../lib/agent/cmd');
const { prepareConnection } = require('../lib/agent/connection-store');
const { resolveRuntime } = require('../lib/agent/runtime-package');
const { launchRuntime, launchBackgroundRuntime } = require('../lib/agent/stdio');

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
  test('success pairs in the foreground then hands the run to a background daemon', async () => {
    await run(args(), { stdout, stderr, probe: async () => ({ status: 'passed' }) });
    expect(prepareConnection).toHaveBeenCalledTimes(1);
    expect(launchRuntime.mock.calls.map(call => call[1].command)).toEqual(['connect']);
    expect(launchRuntime.mock.calls[0][1].providers[0].executable).toBe(path.join(root, 'qodercli.exe'));
    expect(launchBackgroundRuntime).toHaveBeenCalledTimes(1);
    expect(launchBackgroundRuntime.mock.calls[0][1].command).toBe('run');
    expect(launchBackgroundRuntime.mock.calls[0][1]).not.toHaveProperty('enrollmentToken');
  });
  test('doctor uses the same classification without starting or enrolling a Runtime', async () => {
    await run(args('doctor'), { stdout, stderr, probe: async (_exe, flags) => flags[0] === '--list-models'
      ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' } });
    expect(JSON.parse(stdout.write.mock.calls[0][0])).toMatchObject({ type: 'doctor', providerReady: false, readyForEnrollment: true,
      providers: [{ status: 'login_required', remediation: { requiresExplicitUserRequest: true, automaticActionAllowed: false } }] });
    expect(launchRuntime).not.toHaveBeenCalled(); expect(prepareConnection).not.toHaveBeenCalled();
  });
  test('connect and its background daemon retain a signed-out CLI alongside a usable CLI', async () => {
    const bin = path.join(root, '.local', 'bin'); fs.mkdirSync(bin, { recursive: true });
    const ext = '.exe';
    for (const name of ['qodercli', 'codex']) { fs.writeFileSync(path.join(bin, name + ext), 'fixture', { mode: 0o700 }); }
    await run(['connect', '--json', '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test', '--state-dir', root], {
      stdout, stderr, platform: 'win32', homedir: root,
      env: { PATH: '', Path: '', USERPROFILE: root, PATHEXT: '.EXE' },
      probe: async (_exe, flags) => flags[0] === '--list-models' ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' },
    });
    expect(launchRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual(['qoder', 'codex']);
    expect(launchRuntime).toHaveBeenCalledTimes(1);
    expect(launchBackgroundRuntime).toHaveBeenCalledTimes(1);
    expect(launchBackgroundRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual(['qoder', 'codex']);
  });
  test('provider-only never connects another available type', async () => {
    const bin = path.join(root, '.local', 'bin'); fs.mkdirSync(bin, { recursive: true });
    const ext = process.platform === 'win32' ? '.exe' : '';
    for (const name of ['qodercli', 'codex']) { fs.writeFileSync(path.join(bin, name + ext), 'fixture', { mode: 0o700 }); }
    await run(['connect', '--json', '--provider', 'qoder', '--state-dir', root,
      '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test'], {
      stdout, stderr, homedir: root, env: { PATH: '', HOME: root },
      probe: async (_exe, flags) => flags[0] === '--list-models' ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' },
    });
    expect(launchRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual(['qoder']);
    expect(launchBackgroundRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual(['qoder']);
  });
  test.each(['qoder', 'codex'])('a computer with only signed-out %s can enroll without executing login', async provider => {
    const execute = jest.fn(async (_exe, flags) => flags[0] === '--list-models' || flags[0] === 'login'
      ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' });
    const command = args(); command[command.indexOf('--provider') + 1] = provider;
    await run(command, { stdout, stderr, probe: execute });
    expect(prepareConnection).toHaveBeenCalledTimes(1);
    expect(launchBackgroundRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual([provider]);
    expect(JSON.parse(stdout.write.mock.calls[0][0])).toMatchObject({ ready: false, readyForEnrollment: true,
      providers: [{ status: 'login_required', usable: false, registrable: true }] });
    expect(execute.mock.calls.map(call => call[1])).toEqual(provider === 'qoder'
      ? [['--version'], ['--acp'], ['--list-models']]
      : [['--version'], ['app-server', '--listen', 'stdio://'], ['login', 'status']]);
  });
  test('run keeps a signed-out CLI in inventory when bringing a computer back online', async () => {
    const bin = path.join(root, '.local', 'bin'); fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'codex'), 'fixture', { mode: 0o700 });
    await run(['run', '--json', '--provider', 'codex', '--state-dir', root,
      '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test'], {
      stdout, stderr, disableConnectionManager: true, platform: 'linux', homedir: root, env: { PATH: '' },
      probe: async (_exe, flags) => flags[0] === 'login' ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' },
    });
    expect(launchRuntime.mock.calls[0][1].providers.map(p => p.provider)).toEqual(['codex']);
    expect(prepareConnection).not.toHaveBeenCalled();
  });
  test('malformed explicit selection is rejected before invoking a CLI', async () => {
    const execute = jest.fn();
    await expect(run(['connect', '--provider', 'unsupported'], { probe: execute })).rejects.toMatchObject({ code: 'AGENT_PROVIDER_OPTIONS_INVALID' });
    expect(execute).not.toHaveBeenCalled();
  });
});
