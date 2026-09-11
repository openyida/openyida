'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  maybeAutoUpdate,
  installVersion,
  isNpmGlobalInstall,
  isManagedCloudRuntime,
  getAutoUpdateIntervalMs,
  shouldSkipAutoUpdateCommand,
} = require('../lib/core/update');

function createGlobalFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-update-test-'));
  const npmRoot = path.join(root, 'lib', 'node_modules');
  const packageRoot = path.join(npmRoot, 'openyida');
  const updateDir = path.join(root, 'home', '.openyida');
  fs.mkdirSync(packageRoot, { recursive: true });
  return { root, npmRoot, packageRoot, updateDir };
}

describe('auto update environment guards', () => {
  test.each([
    { OPENYIDA_MANAGED_RUNTIME: 'cloud' },
    { CI: '1' },
    { CODEX_CI: '1' },
    { QWENWORK_SANDBOX_ID: 'sandbox-1' },
    { QWENWORK_PREVIEW_URL: 'https://preview.example.test' },
    { QWENWORK: '1' },
    { AGENT_PLATFORM: 'QwenWork Web' },
    { QWENWORK_CLIENT: 'acp' },
    { QWENWORK_WORKSPACE_DIR: '/workspace' },
    { MULERUN_CHAT_ID: 'chat-1' },
    { MULE_DATA_DIR: '/tmp/mule' },
  ])('云端信号 %p 在任何更新副作用前短路', async (env) => {
    const fsImpl = {
      readFileSync: jest.fn(),
      mkdirSync: jest.fn(),
      openSync: jest.fn(),
    };
    const execFileSyncFn = jest.fn();
    const fetchLatestVersionFn = jest.fn();

    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0',
      command: 'app-list',
      args: [],
      env,
      fsImpl,
      execFileSyncFn,
      fetchLatestVersionFn,
    });

    expect(result).toMatchObject({ status: 'skipped', reason: 'environment' });
    expect(fsImpl.readFileSync).not.toHaveBeenCalled();
    expect(fsImpl.mkdirSync).not.toHaveBeenCalled();
    expect(fsImpl.openSync).not.toHaveBeenCalled();
    expect(execFileSyncFn).not.toHaveBeenCalled();
    expect(fetchLatestVersionFn).not.toHaveBeenCalled();
  });

  test.each([
    'OPENYIDA_NO_AUTO_UPDATE',
    'OPENYIDA_SKIP_UPDATE_CHECK',
    'NO_UPDATE_NOTIFIER',
  ])('%s 关闭自动更新且无副作用', async (name) => {
    const fsImpl = { readFileSync: jest.fn() };
    const execFileSyncFn = jest.fn();
    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0',
      command: 'app-list',
      args: [],
      env: { [name]: '1' },
      fsImpl,
      execFileSyncFn,
    });
    expect(result.reason).toBe('environment');
    expect(fsImpl.readFileSync).not.toHaveBeenCalled();
    expect(execFileSyncFn).not.toHaveBeenCalled();
  });

  test('本地 Codex/Claude/Qoder 信号本身不属于云端', () => {
    expect(isManagedCloudRuntime({ CODEX_SHELL: '1' })).toBe(false);
    expect(isManagedCloudRuntime({ CLAUDE_CODE: '1' })).toBe(false);
    expect(isManagedCloudRuntime({ QODER_AGENT: '1' })).toBe(false);
  });
});

describe('auto update policy', () => {
  const fixtures = [];

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test('默认 24 小时且支持秒级覆盖', () => {
    expect(getAutoUpdateIntervalMs({})).toBe(86400000);
    expect(getAutoUpdateIntervalMs({ OPENYIDA_AUTO_UPDATE_SECS: '60' })).toBe(60000);
    expect(getAutoUpdateIntervalMs({ OPENYIDA_AUTO_UPDATE_SECS: '0' })).toBe(0);
    expect(getAutoUpdateIntervalMs({ OPENYIDA_AUTO_UPDATE_SECS: '' })).toBe(86400000);
    expect(getAutoUpdateIntervalMs({ OPENYIDA_AUTO_UPDATE_SECS: '-1' })).toBe(86400000);
  });

  test.each([
    ['--help', []],
    ['commands', []],
    ['agent-capabilities', []],
    ['mcp', []],
    ['a2a', []],
    ['bridge', []],
    ['update', []],
    ['login', ['--check-only']],
  ])('元命令/长驻命令/机器输出跳过：%s %p', (command, args) => {
    expect(shouldSkipAutoUpdateCommand(command, args)).toBe(true);
  });

  test('--json 不跳过自动更新，更新日志仅由调用方写入 stderr', () => {
    expect(shouldSkipAutoUpdateCommand('app-list', ['--json'])).toBe(false);
  });

  test('缓存未过期时不调用 npm 或 registry', async () => {
    const fixture = createGlobalFixture();
    fixtures.push(fixture);
    fs.mkdirSync(fixture.updateDir, { recursive: true });
    fs.writeFileSync(path.join(fixture.updateDir, 'update-check.json'), JSON.stringify({ lastCheck: 9000 }));
    const execFileSyncFn = jest.fn();
    const fetchLatestVersionFn = jest.fn();

    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0',
      command: 'app-list',
      args: [],
      env: { OPENYIDA_AUTO_UPDATE_SECS: '10' },
      now: 10000,
      updateDir: fixture.updateDir,
      packageRoot: fixture.packageRoot,
      execFileSyncFn,
      fetchLatestVersionFn,
    });

    expect(result.reason).toBe('fresh');
    expect(execFileSyncFn).not.toHaveBeenCalled();
    expect(fetchLatestVersionFn).not.toHaveBeenCalled();
  });

  test('非 npm 全局安装不查询 registry、不安装', async () => {
    const fixture = createGlobalFixture();
    fixtures.push(fixture);
    const localPackage = path.join(fixture.root, 'project', 'node_modules', 'openyida');
    fs.mkdirSync(localPackage, { recursive: true });
    const fetchLatestVersionFn = jest.fn();
    const installVersionFn = jest.fn();

    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0',
      command: 'app-list',
      args: [],
      env: {},
      now: 10000,
      updateDir: fixture.updateDir,
      packageRoot: localPackage,
      execFileSyncFn: jest.fn(() => fixture.npmRoot),
      fetchLatestVersionFn,
      installVersionFn,
    });

    expect(result.reason).toBe('not-npm-global');
    expect(fetchLatestVersionFn).not.toHaveBeenCalled();
    expect(installVersionFn).not.toHaveBeenCalled();
  });

  test('npm 全局安装检测把自定义环境传给 npm 子进程', () => {
    const fixture = createGlobalFixture();
    fixtures.push(fixture);
    const execFileSyncFn = jest.fn(() => fixture.npmRoot);
    const env = { NPM_CONFIG_PREFIX: fixture.root };

    expect(isNpmGlobalInstall({
      packageRoot: fixture.packageRoot,
      execFileSyncFn,
      npmExecutable: '/opt/npm',
      platform: 'linux',
      env,
    })).toBe(true);
    expect(execFileSyncFn).toHaveBeenCalledWith(
      '/opt/npm',
      ['root', '-g'],
      expect.objectContaining({ env })
    );
  });

  test('发现新版时安装查询到的精确版本并以原 argv 重跑', async () => {
    const fixture = createGlobalFixture();
    fixtures.push(fixture);
    const installVersionFn = jest.fn();
    const spawnSyncFn = jest.fn(() => ({ status: 7 }));
    const stderr = { write: jest.fn() };
    const argv = ['/usr/bin/node', fixture.packageRoot + '/bin/yida.js', 'app-list', '--json'];

    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0-beta.1',
      command: 'app-list',
      args: ['--json'],
      argv,
      env: { OPENYIDA_AUTO_UPDATE_SECS: '0' },
      now: 10000,
      updateDir: fixture.updateDir,
      packageRoot: fixture.packageRoot,
      execFileSyncFn: jest.fn(() => fixture.npmRoot),
      fetchLatestVersionFn: jest.fn(async () => '1.0.0'),
      installVersionFn,
      spawnSyncFn,
      stderr,
    });

    expect(installVersionFn).toHaveBeenCalledWith('1.0.0', expect.objectContaining({ npmExecutable: 'npm' }));
    expect(spawnSyncFn).toHaveBeenCalledWith(process.execPath, argv.slice(1), expect.objectContaining({
      stdio: 'inherit',
      env: expect.objectContaining({ OPENYIDA_AUTO_UPDATE_REEXEC: '1' }),
    }));
    expect(result).toMatchObject({ status: 'reexecuted', reexecuted: true, exitCode: 7 });
    expect(fs.existsSync(path.join(fixture.updateDir, 'update.lock'))).toBe(false);
  });

  test('安装失败时不重跑并继续旧命令', async () => {
    const fixture = createGlobalFixture();
    fixtures.push(fixture);
    const spawnSyncFn = jest.fn();
    const error = new Error('permission denied');

    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0',
      command: 'app-list',
      args: [],
      env: { OPENYIDA_AUTO_UPDATE_SECS: '0' },
      now: 10000,
      updateDir: fixture.updateDir,
      packageRoot: fixture.packageRoot,
      execFileSyncFn: jest.fn(() => fixture.npmRoot),
      fetchLatestVersionFn: jest.fn(async () => '1.1.0'),
      installVersionFn: jest.fn(() => { throw error; }),
      spawnSyncFn,
      stderr: { write: jest.fn() },
    });

    expect(result).toMatchObject({ status: 'failed', error });
    expect(result.reexecuted).toBeUndefined();
    expect(spawnSyncFn).not.toHaveBeenCalled();
  });

  test('已有锁时立即跳过，不访问 registry', async () => {
    const fixture = createGlobalFixture();
    fixtures.push(fixture);
    fs.mkdirSync(fixture.updateDir, { recursive: true });
    fs.writeFileSync(path.join(fixture.updateDir, 'update.lock'), 'locked');
    fs.utimesSync(path.join(fixture.updateDir, 'update.lock'), new Date(10000), new Date(10000));
    const fetchLatestVersionFn = jest.fn();

    const result = await maybeAutoUpdate({
      currentVersion: '1.0.0',
      command: 'app-list',
      args: [],
      env: {},
      now: 10000,
      updateDir: fixture.updateDir,
      packageRoot: fixture.packageRoot,
      execFileSyncFn: jest.fn(() => fixture.npmRoot),
      fetchLatestVersionFn,
    });

    expect(result.reason).toBe('locked');
    expect(fetchLatestVersionFn).not.toHaveBeenCalled();
  });

  test('installVersion 使用参数数组安装精确版本', () => {
    const execFileSyncFn = jest.fn();
    installVersion('2026.8.27-beta.2', {
      execFileSyncFn,
      npmExecutable: '/opt/npm',
      platform: 'linux',
    });
    expect(execFileSyncFn).toHaveBeenCalledWith(
      '/opt/npm',
      ['install', '-g', 'openyida@2026.8.27-beta.2'],
      expect.objectContaining({ timeout: 120000 })
    );
  });

  test('Windows 通过 cmd.exe 调用 npm shim，版本仍作为独立参数', () => {
    const execFileSyncFn = jest.fn();
    installVersion('2026.8.27-1', {
      execFileSyncFn,
      npmExecutable: 'npm',
      platform: 'win32',
      env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    });
    expect(execFileSyncFn).toHaveBeenCalledWith(
      'C:\\Windows\\System32\\cmd.exe',
      ['/d', '/c', 'npm', 'install', '-g', 'openyida@2026.8.27-1'],
      expect.objectContaining({ timeout: 120000 })
    );
  });
});
