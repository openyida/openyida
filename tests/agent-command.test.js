'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { run, parseArgs, parseDiagnosticSession, buildLaunchConfig, discoverProvider, discoverProviders } = require('../lib/agent/cmd');
const { launchRuntime, runtimeEnvironment } = require('../lib/agent/stdio');
const { resolveRuntime } = require('../lib/agent/runtime-package');
const { maybeAutoUpdate, shouldSkipAutoUpdateCommand } = require('../lib/core/update');
const { removeFixture } = require('./helpers/agent-bundle-fixture');

describe('local agent thin launcher', () => {
  let root;
  let binary;
  let manifestPath;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-agent-command-'));
    binary = path.join(root, 'fake runtime');
    manifestPath = path.join(root, 'manifest.json');
    const source = `#!${process.execPath}\nlet input=''; process.stdin.on('data',c=>input+=c); process.stdin.on('end',()=>{const config=JSON.parse(input); console.log(JSON.stringify({type:config.command,config,argv:process.argv.slice(2),envKeys:Object.keys(process.env),providerHome:process.env.CODEX_HOME}));});\n`;
    fs.writeFileSync(binary, source, { mode: 0o700 });
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1, version: '0.1.0-test', protocolVersion: 1, platform: process.platform, arch: process.arch,
      binary: { file: path.basename(binary), sha256: crypto.createHash('sha256').update(source).digest('hex') },
    }));
  });
  afterEach(() => removeFixture(root));

  async function readBackgroundEvent(logPath, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const line = content.split('\n').find((entry) => entry.trim());
        if (line) { return JSON.parse(line); }
      } catch { /* file not written yet */ }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`background event not written to ${logPath}`);
  }

  test('accepts only audited flags and web enrollment is connect-only', () => {
    expect(parseArgs(['run', '--provider', 'qoder', '--provider-path', '/fixture/qoder'])).toMatchObject({ command: 'run', provider: 'qoder' });
    expect(parseArgs(['connect', '--enroll', 'enrollment.' + 't'.repeat(40)])).toMatchObject({ command: 'connect' });
    expect(() => parseArgs(['run', '--enroll', 'x'.repeat(40)])).toThrow(expect.objectContaining({ code: 'AGENT_INPUT_INVALID' }));
    expect(() => parseArgs(['run', '--profile', 'legacy'])).toThrow();
    expect(() => parseArgs(['identity-proof'])).toThrow();
  });

  test('diagnostics accepts a cloud session URL without retaining unrelated URL data', () => {
    expect(parseArgs(['diagnose', '--session', 'local_fixture', '--deep'])).toMatchObject({
      command: 'diagnose', diagnosticSession: 'local_fixture', diagnosticDeep: true,
    });
    expect(parseDiagnosticSession('https://pre-yida-vpc.alibaba-inc.com/APP_TEST/admin/?sessionId=local_fixture&agentId=builder')).toEqual({
      sessionId: 'local_fixture', appType: 'APP_TEST',
    });
    expect(() => parseDiagnosticSession('http://pre-yida.example/APP_TEST/admin/?sessionId=local_fixture')).toThrow(
      expect.objectContaining({ code: 'AGENT_DIAGNOSTIC_SESSION_INVALID' }),
    );
    expect(() => parseArgs(['run', '--deep'])).toThrow(expect.objectContaining({ code: 'AGENT_INPUT_INVALID' }));
  });

  test('launch config contains control identity but no ordinary profile', () => {
    const result = buildLaunchConfig({ command: 'run', endpoint: 'https://agent.example.test', endpointId: 'test', provider: 'qoder', providerPath: '/fixture/qoder' }, { homedir: root });
    expect(result).toMatchObject({ endpoint: 'https://agent.example.test', endpointId: 'test', providers: [{ profileId: 'openyida.qoder', provider: 'qoder', executable: '/fixture/qoder' }] });
    expect(result).not.toHaveProperty('profile');
  });

  test('rejects missing control identity and relative provider executable', () => {
    expect(() => buildLaunchConfig({ command: 'connect' }, { env: {} })).toThrow(expect.objectContaining({ code: 'AGENT_CONNECTION_OPTIONS_REQUIRED' }));
    expect(() => buildLaunchConfig({ command: 'doctor', provider: 'codex', providerPath: 'codex' })).toThrow(expect.objectContaining({ code: 'AGENT_PROVIDER_OPTIONS_INVALID' }));
  });

  test('discovers only known provider executables from PATH', () => {
    const providerDir = path.join(root, 'providers');
    fs.mkdirSync(providerDir);
    const qoder = path.join(providerDir, 'qoder');
    const codex = path.join(providerDir, 'codex');
    const opencode = path.join(providerDir, 'opencode');
    fs.writeFileSync(qoder, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    fs.writeFileSync(codex, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    fs.writeFileSync(opencode, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    const resolvedQoder = fs.realpathSync(qoder);
    expect(discoverProvider({ PATH: providerDir }, 'linux')).toEqual({ profileId: 'openyida.qoder', provider: 'qoder', executable: resolvedQoder });
    expect(discoverProviders({ PATH: providerDir }, 'linux').map((item) => item.provider)).toEqual(['qoder', 'codex', 'opencode']);
    expect(buildLaunchConfig({ command: 'run', endpoint: 'https://agent.example.test', endpointId: 'test' }, { homedir: root, env: { PATH: providerDir }, platform: 'linux' }))
      .toMatchObject({ providers: [
        { profileId: 'openyida.qoder', provider: 'qoder', executable: resolvedQoder },
        { profileId: 'openyida.codex', provider: 'codex' },
        { profileId: 'openyida.opencode', provider: 'opencode' },
      ] });
  });

  test('discovers Windows command shims from Path and PATHEXT', () => {
    const first = path.join(root, 'windows-a');
    const second = path.join(root, 'windows-b');
    fs.mkdirSync(first);
    fs.mkdirSync(second);
    fs.writeFileSync(path.join(second, 'codex.cmd'), '@echo off\r\n');
    expect(discoverProviders({ Path: `${first};${second}`, PATHEXT: '.EXE;.CMD' }, 'win32')).toContainEqual({
      profileId: 'openyida.codex', provider: 'codex', executable: fs.realpathSync(path.join(second, 'codex.cmd')),
    });
  });

  test('prefers qodercli over an earlier Qoder IDE executable', () => {
    const ideDir = path.join(root, 'qoder-ide');
    const cliDir = path.join(root, 'qoder-cli');
    fs.mkdirSync(ideDir);
    fs.mkdirSync(cliDir);
    fs.writeFileSync(path.join(ideDir, 'qoder'), 'IDE fixture', { mode: 0o700 });
    const cli = path.join(cliDir, 'qodercli');
    fs.writeFileSync(cli, 'CLI fixture', { mode: 0o700 });
    expect(discoverProviders({ PATH: `${ideDir}:${cliDir}` }, 'linux')).toEqual([
      { profileId: 'openyida.qoder', provider: 'qoder', executable: fs.realpathSync(cli) },
    ]);
  });

  test('doctor gives honest unavailable state without spawning', async () => {
    const stdout = { write: jest.fn() };
    const spawn = jest.fn();
    await run(['doctor', '--json'], { stdout, spawn, env: {}, homedir: root, platform: 'linux' });
    expect(JSON.parse(stdout.write.mock.calls[0][0])).toMatchObject({ type: 'doctor', ready: false, authKnown: false, runtime: { code: 'AGENT_RUNTIME_PLATFORM_UNSUPPORTED' } });
    expect(spawn).not.toHaveBeenCalled();
  });

  test('connect pairs in the foreground then keeps serving as a background daemon', async () => {
    const stdout = { write: jest.fn() };
    await run([
      'connect', '--endpoint', 'https://agent.example.test', '--endpoint-id', 'test',
      '--provider', 'qoder', '--provider-path', '/bin/sh',
      '--development-runtime', '--runtime-path', binary, '--runtime-manifest', manifestPath,
      '--state-dir', path.join(root, 'state'), '--enroll', `enrollment.${'t'.repeat(40)}`,
    ], { stdout, env: { PATH: process.env.PATH }, probe: async () => ({ status: 'passed' }) });
    const events = stdout.write.mock.calls.map(([value]) => JSON.parse(value));
    // The terminal returns immediately after pairing; the run goes to the background log.
    expect(events.map((event) => event.type)).toEqual(['connect', 'connected']);
    const connectEvent = events[0];
    const connectedEvent = events[1];
    const connectionDir = path.join(root, 'state', 'connections', 'enrollment');
    expect(connectEvent.config.installationId).toEqual(expect.any(String));
    expect(connectEvent.config.stateDir).toBe(connectionDir);
    expect(connectEvent.config.sessionStateDir).toBe(path.join(root, 'state', 'sessions'));
    expect(connectedEvent).toMatchObject({ type: 'connected', background: true, stateDir: connectionDir });
    expect(connectedEvent.logPath).toBe(path.join(connectionDir, 'logs', 'agent-run.log'));

    const runEvent = await readBackgroundEvent(connectedEvent.logPath);
    expect(runEvent.config.command).toBe('run');
    expect(runEvent.config.background).toBe(true);
    expect(runEvent.config).not.toHaveProperty('enrollmentToken');
    expect(runEvent.config).not.toHaveProperty('parentWatchFD');
    expect(runEvent.config).not.toHaveProperty('parentPID');
    expect(runEvent.config.installationId).toBe(connectEvent.config.installationId);
    expect(runEvent.config.stateDir).toBe(connectEvent.config.stateDir);
    expect(runEvent.config.sessionStateDir).toBe(connectEvent.config.sessionStateDir);
    expect(runEvent.config.providers).toEqual(connectEvent.config.providers);
  });

  test('logs surfaces the per-connection background daemon log without launching the runtime', async () => {
    const baseStateDir = path.join(root, 'state');
    const connectionDir = path.join(baseStateDir, 'connections', 'enrollment');
    const logsDir = path.join(connectionDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(baseStateDir, 0o700);
    fs.chmodSync(path.join(baseStateDir, 'connections'), 0o700);
    fs.chmodSync(connectionDir, 0o700);
    const installationId = crypto.randomUUID();
    fs.writeFileSync(path.join(baseStateDir, 'installation.json'), `${JSON.stringify({ schemaVersion: 1, installationId })}\n`, { mode: 0o600 });
    fs.writeFileSync(path.join(connectionDir, 'device.json'), `${JSON.stringify({
      installationId, endpoint: 'https://agent.example.test', endpointId: 'test',
      deviceId: 'device-fixture', credentialVersion: 1,
    })}\n`, { mode: 0o600 });
    const logPath = path.join(logsDir, 'agent-run.log');
    fs.writeFileSync(logPath, `${JSON.stringify({ type: 'run', config: { command: 'run', background: true } })}\n`, { mode: 0o600 });

    const stdout = { write: jest.fn() };
    const spawn = jest.fn();
    await run(['logs', '--state-dir', baseStateDir], { stdout, spawn, env: { PATH: process.env.PATH } });
    expect(spawn).not.toHaveBeenCalled();
    const header = JSON.parse(stdout.write.mock.calls[0][0]);
    expect(header).toMatchObject({ type: 'logs', connectionId: 'device-fixture', endpointId: 'test', logPath, available: true });
    const body = stdout.write.mock.calls.map(([value]) => value).join('');
    expect(body).toContain('"command":"run"');
  });


  test('runtime receives fixed argv without ambient credentials', async () => {
    const stdout = { write: jest.fn() };
    const signals = new EventEmitter();
    await run(['status', '--development-runtime', '--runtime-path', binary, '--runtime-manifest', manifestPath, '--state-dir', root], {
      stdout, signals, env: { PATH: process.env.PATH, OPENYIDA_ACCESS_TOKEN: 'private-access', OPENYIDA_REFRESH_TOKEN: 'private-refresh', OPENAI_API_KEY: 'private-provider' },
    });
    const event = JSON.parse(stdout.write.mock.calls[0][0]);
    expect(event.argv).toEqual(['status', '--stdio-config']);
    expect(event.config).toMatchObject({ protocolVersion: 1, command: 'status', stateDir: root });
    expect(event.envKeys).not.toContain('OPENYIDA_ACCESS_TOKEN');
    expect(event.envKeys).not.toContain('OPENAI_API_KEY');
    expect(signals.listenerCount('SIGINT')).toBe(0);
  });

  test('launch refuses oversized input before spawning', () => {
    const runtime = resolveRuntime({ developmentRuntime: true, runtimePath: binary, manifestPath });
    const spawn = jest.fn();
    expect(() => launchRuntime(runtime, { text: 'x'.repeat(65536) }, { spawn })).toThrow(expect.objectContaining({ code: 'AGENT_INPUT_INVALID' }));
    expect(spawn).not.toHaveBeenCalled();
  });

  test('records a bounded error code when the runtime reports a failure', async () => {
    const failingRuntime = path.join(root, 'failing-runtime');
    fs.writeFileSync(failingRuntime, `#!${process.execPath}\nconsole.log(JSON.stringify({type:'error',code:'RUNTIME_ACTION_FAILED',message:'unsafe upstream detail'}));\n`, { mode: 0o700 });
    const diagnostic = jest.fn();
    await expect(launchRuntime({ executable: failingRuntime }, { command: 'status', node: { packageRoot: root } }, {
      diagnostic, signals: new EventEmitter(), stdout: { write: jest.fn() },
    })).rejects.toMatchObject({ code: 'RUNTIME_ACTION_FAILED' });
    expect(diagnostic).toHaveBeenCalledWith('error', 'runtime_action_failed', {
      command: 'status', component: 'node', errorCode: 'RUNTIME_ACTION_FAILED', retryable: false,
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('unsafe upstream detail');
  });

  test('keeps provider home but strips API keys', async () => {
    const stdout = { write: jest.fn() };
    const providerHome = path.join(root, 'custom codex home');
    await run(['status', '--development-runtime', '--runtime-path', binary, '--runtime-manifest', manifestPath, '--state-dir', root], {
      stdout, env: { HOME: root, CODEX_HOME: providerHome, OPENAI_API_KEY: 'secret', CODEX_API_KEY: 'secret' },
    });
    const event = JSON.parse(stdout.write.mock.calls[0][0]);
    expect(event.providerHome).toBe(providerHome);
    expect(event.envKeys).not.toContain('OPENAI_API_KEY');
    expect(event.envKeys).not.toContain('CODEX_API_KEY');
    expect(runtimeEnvironment({ CODEX_HOME: providerHome }).CODEX_HOME).toBe(providerHome);
  });

  test('managed and agent commands never auto-update', async () => {
    const fetchLatestVersionFn = jest.fn();
    const result = await maybeAutoUpdate({ currentVersion: '1.0.0', command: 'create-app', env: { OPENYIDA_MANAGED_RUNTIME: 'local' }, fetchLatestVersionFn });
    expect(result).toMatchObject({ status: 'skipped', reason: 'environment' });
    expect(fetchLatestVersionFn).not.toHaveBeenCalled();
    expect(shouldSkipAutoUpdateCommand('agent', ['run'])).toBe(true);
    expect(runtimeEnvironment({ OPENYIDA_REFRESH_TOKEN: 'secret' })).toEqual({ PATH: path.dirname(process.execPath), OPENYIDA_NO_AUTO_UPDATE: '1', OPENYIDA_MANAGED_RUNTIME: 'local' });
  });
});
