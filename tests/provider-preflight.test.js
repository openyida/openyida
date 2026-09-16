'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { inventory, preflight, probe, probeCommand } = require('../lib/agent/provider-preflight');

describe('cross-platform provider preflight', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-preflight-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  function file(relative) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'fixture', { mode: 0o700 });
    return fs.realpathSync(target);
  }
  const passed = jest.fn(async () => ({ status: 'passed', output: 'Logged in' }));

  test.each(['win32', 'darwin', 'linux'])('%s finds a CLI outside PATH in user installation directories', platform => {
    const cli = file('.local/bin/qodercli' + (platform === 'win32' ? '.exe' : ''));
    expect(inventory({ PATH: '', HOME: root }, platform)[0].candidates).toContain(cli);
  });
  test('Windows desktop GUI is detected but never used as the CLI', async () => {
    file('Programs/Qoder/Qoder.exe');
    const result = await preflight({}, { env: { LOCALAPPDATA: root, PATH: path.join(root, 'Programs/Qoder') }, platform: 'win32', homedir: root, probe: passed });
    expect(result.providers[0]).toMatchObject({ desktopDetected: true, status: 'cli_not_found', usable: false,
      remediation: { action: 'INSTALL_OR_SELECT_CLI', requiresUserInteraction: false } });
  });
  test('Windows discovers versioned Codex desktop CLI and npm command shim', () => {
    const bundled = file('OpenAI/Codex/bin/version-one/codex.exe');
    expect(inventory({ LOCALAPPDATA: root }, 'win32', root)[1]).toMatchObject({ desktopDetected: true, candidates: [bundled] });
    const shim = file('npm/qodercli.cmd');
    expect(inventory({ APPDATA: root }, 'win32', root)[0].candidates).toContain(shim);
  });
  test('macOS detects desktop-only Qoder and Codex bundled CLI independently', () => {
    file('Applications/Qoder.app/Contents/MacOS/Qoder');
    const cli = file('Applications/Codex.app/Contents/Resources/codex');
    const result = inventory({ HOME: root, PATH: '' }, 'darwin');
    expect(result[0].desktopDetected).toBe(true);
    expect(result[1].candidates).toContain(cli);
  });
  test('Linux desktop launcher is only evidence of desktop installation', () => {
    file('.local/share/applications/qoder.desktop');
    expect(inventory({ HOME: root, PATH: '' }, 'linux')[0].desktopDetected).toBe(true);
  });
  test.each(['win32', 'darwin', 'linux'])('%s preserves explicit path and reports login required with shell-safe command', async platform => {
    const executable = path.join(root, "中文 user's folder/qodercli.exe");
    const probeFn = jest.fn(async (_exe, args) => args[0] === '--list-models'
      ? { status: 'probe_failed', output: 'Not logged in. private-provider-output' } : { status: 'passed' });
    const result = await preflight({ provider: 'qoder', providerPath: executable }, { platform, probe: probeFn });
    expect(result.ready).toBe(false);
    expect(result.providers[0]).toMatchObject({ status: 'login_required', protocolProbe: 'passed',
      remediation: { action: 'LOGIN', requiresUserInteraction: true, shell: platform === 'win32' ? 'powershell' : 'sh' } });
    expect(JSON.stringify(result)).not.toContain('private-provider-output');
    expect(probeFn.mock.calls.every(call => call[0] === executable)).toBe(true);
  });
  test.each(['launch_failed', 'probe_timeout', 'probe_failed'])('preserves %s instead of claiming not installed', async status => {
    const result = await preflight({ provider: 'codex', providerPath: '/fixture' }, { probe: async () => ({ status }) });
    expect(result.providers[0].status).toBe(status);
    expect(result.ready).toBe(false);
  });
  test('protocol failure is independent of login and does not start auth checks', async () => {
    const probeFn = jest.fn(async (_exe, args) => ({ status: args[0] === '--version' ? 'passed' : 'protocol_unsupported' }));
    const result = await preflight({ provider: 'codex', providerPath: '/fixture' }, { probe: probeFn });
    expect(result.providers[0].status).toBe('protocol_unsupported');
    expect(probeFn).toHaveBeenCalledTimes(2);
  });
  test('one usable Agent allows connection while another needs login', async () => {
    file('.local/bin/qodercli'); file('.local/bin/codex');
    const result = await preflight({}, { env: { PATH: '' }, homedir: root, platform: 'linux',
      probe: async (_exe, args) => args[0] === '--list-models' ? { status: 'probe_failed', output: 'Not logged in' } : { status: 'passed' } });
    expect(result.ready).toBe(true);
    expect(result.providers.find(p => p.provider === 'qoder').usable).toBe(false);
    expect(result.providers.find(p => p.provider === 'codex').status).toBe('ready');
  });

  test('provider-only checks only that type, even when another CLI is usable', async () => {
    file('.local/bin/codex');
    const execute = jest.fn(async () => ({ status: 'passed' }));
    const result = await preflight({ provider: 'qoder' }, { env: { PATH: '' }, platform: 'linux', homedir: root, probe: execute });
    expect(result.ready).toBe(false);
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0]).toMatchObject({ provider: 'qoder', status: 'cli_not_found' });
    expect(execute).not.toHaveBeenCalled();
  });
  test('provider-only automatically locates the selected executable', async () => {
    const cli = file('.local/bin/qodercli');
    file('.local/bin/codex');
    const execute = jest.fn(async () => ({ status: 'passed' }));
    const result = await preflight({ provider: 'qoder' }, { env: { PATH: '' }, platform: 'linux', homedir: root, probe: execute });
    expect(result.ready).toBe(true);
    expect(result.providers).toHaveLength(1);
    expect(execute.mock.calls.every(call => call[0] === cli)).toBe(true);
  });
  test('an invalid earlier installation does not hide a usable user CLI', async () => {
    const bad = file('.local/bin/qodercli'), good = file('.qoder/bin/qodercli');
    const result = await preflight({ provider: 'qoder' }, { env: { PATH: '' }, platform: 'linux', homedir: root,
      probe: async exe => ({ status: exe === bad ? 'launch_failed' : 'passed' }) });
    expect(result.providers[0]).toMatchObject({ executable: good, status: 'ready' });
  });
  test('Windows command shim really launches from a path with spaces and Chinese characters', async () => {
    if (process.platform !== 'win32') { return; }
    const cmd = file('中文 folder/qodercli.cmd');
    fs.writeFileSync(cmd, '@echo off\r\nexit /b 99\r\n');
    fs.writeFileSync(cmd.replace(/\.cmd$/, '.ps1'), "Write-Output 'fixture-version'\n");
    expect(await probe(cmd, ['--version'], null)).toMatchObject({ status: 'passed', output: expect.stringContaining('fixture-version') });
  });

  test('Windows npm shims use the same PowerShell sibling as Runtime without shell interpolation', () => {
    const cmd = file('中文 folder/qodercli.cmd');
    file('中文 folder/qodercli.ps1');
    const result = probeCommand(cmd, ['login', 'status'], 'win32', { SystemRoot: 'C:\\Windows' });
    expect(result.args).toEqual(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', cmd.replace(/\.cmd$/, '.ps1'), 'login', 'status']);
    expect(() => probeCommand(file('bare.cmd'), ['--version'], 'win32')).toThrow();
  });
  test('a successful CLI exit without an RPC response is not a protocol handshake', async () => {
    const result = await probe(process.execPath, ['-e', 'console.log("usage")'], 'qoder', { timeoutMs: 3000 });
    expect(result.status).toBe('protocol_unsupported');
  });
  test('interrupting a probe removes signal listeners and cannot allow connection', async () => {
    const { EventEmitter } = require('events');
    const signals = new EventEmitter();
    const result = probe(process.execPath, ['-e', 'setInterval(()=>{},1000)'], null, { signals });
    signals.emit('SIGINT');
    expect((await result).status).toBe('probe_cancelled');
    expect(signals.listenerCount('SIGTERM')).toBe(0);
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });
  test('a cancelled provider prevents continuation even when another provider passed', async () => {
    file('.local/bin/qodercli'); file('.local/bin/codex');
    const result = await preflight({}, { env: { PATH: '' }, platform: 'linux', homedir: root,
      probe: async exe => ({ status: exe.includes('qoder') ? 'probe_cancelled' : 'passed' }) });
    expect(result.ready).toBe(false);
  });
  test('real bounded process probe times out without a model call', async () => {
    const result = await probe(process.execPath, ['-e', 'setInterval(()=>{},1000)'], null, { timeoutMs: 200 });
    expect(result.status).toBe('probe_timeout');
  });
  test('real protocol probe accepts a valid response and stops the owned process', async () => {
    const code = 'process.stdin.once("data",()=>{console.log(JSON.stringify({id:1,result:{protocolVersion:1}}));});';
    const result = await probe(process.execPath, ['-e', code], 'qoder', { timeoutMs: 3000 });
    expect(result.status).toBe('passed');
  });
});
