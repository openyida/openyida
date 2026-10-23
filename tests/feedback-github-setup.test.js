'use strict';

const fs = require('fs');
const path = require('path');
const { execute, parseArgs, run } = require('../lib/feedback/github');
const { flattenCommandManifest } = require('../lib/core/command-manifest');
const { shouldSkipAutoUpdateCommand } = require('../lib/core/update');

const missing = { status: null, error: { code: 'ENOENT' }, stderr: 'private-token' };
const version = { status: 0, stdout: 'gh version 2.80.0 (2026-01-01)\nprivate-token' };
let state, spawn;
beforeEach(() => {
  state = { gh: missing, manager: { status: 0 }, account: { status: 4 }, install: { status: 0 }, afterInstall: version };
  spawn = jest.fn((binary, args) => {
    if (binary === 'gh' && args[0] === '--version') { return state.gh; }
    if (binary === 'gh' && args[0] === 'api') { return state.account; }
    if (args[0] === '--version') { return state.manager; }
    if (args[0] === 'install') { state.gh = state.afterInstall; return state.install; }
    throw new Error('Unexpected command');
  });
});
const setup = (flags = [], platform = 'darwin') => execute(parseArgs(['setup', ...flags]), { spawnSyncFn: spawn, env: {}, platform });
const installs = () => spawn.mock.calls.filter(([, args]) => args[0] === 'install');

test.each(['darwin', 'linux', 'win32'])('read-only setup on %s returns a plan without any installation or login', platform => {
  const result = setup(['--json'], platform);
  expect(result).toMatchObject({ tool: { state: 'missing' }, ready: false, nextStep: 'confirm_install',
    installation: { attempted: false, plan: { available: true, requiresConsent: true } },
    authorization: { performed: false, requiresSeparateConsent: true, command: null }, submissionPerformed: false });
  expect(installs()).toHaveLength(0);
  expect(spawn.mock.calls.every(([, args]) => args[0] === '--version')).toBe(true);
  expect(JSON.stringify(result)).not.toContain('private-token');
});

test.each([
  ['--install'], ['--confirm'], ['--install', '--confirm', '--confirm'], ['--yes'], ['--login'],
  ['--install', '--confirm', '--repo', 'other/repo'], ['--install', '--install', '--confirm'],
])('invalid or unconfirmed setup %j fails before subprocess access', (...flags) => {
  expect(() => setup(flags)).toThrow();
  expect(spawn).not.toHaveBeenCalled();
});

test('direct execution cannot bypass confirmation and install is setup-only', () => {
  expect(() => run(['setup', '--install'])).toThrow();
  expect(() => execute({ action: 'setup', install: true }, { spawnSyncFn: spawn, env: {} })).toThrow();
  for (const action of ['star', 'fork', 'status']) {
    expect(() => parseArgs([action, '--install', '--confirm'])).toThrow();
  }
  expect(spawn).not.toHaveBeenCalled();
});

test.each(['darwin', 'linux', 'win32'])('confirmed installation on %s uses a fixed manager command and verifies gh', platform => {
  const result = setup(['--install', '--confirm'], platform);
  expect(result).toMatchObject({ success: true, tool: { state: 'available', version: '2.80.0' },
    installation: { attempted: true, state: 'verified' }, account: { state: 'login_required' }, nextStep: 'browser_login' });
  expect(installs()).toHaveLength(1);
  const [binary, args] = installs()[0];
  expect(binary).toBe(platform === 'win32' ? 'winget' : 'brew');
  expect(args).toEqual(platform === 'win32'
    ? ['install', '--id', 'GitHub.cli', '--exact', '--source', 'winget', '--no-upgrade', '--disable-interactivity', '--accept-source-agreements', '--accept-package-agreements']
    : ['install', 'homebrew/core/gh']);
  expect(result.authorization.command).toBe('gh auth login --hostname github.com --web --skip-ssh-key');
  for (const [, , options] of spawn.mock.calls) {
    expect(options).toMatchObject({ shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_INSTALL_CLEANUP: '1',
        HOMEBREW_NO_INSTALL_UPGRADE: '1', HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: '1', HOMEBREW_NO_SUDO: '1' } });
  }
  expect(spawn.mock.calls.filter(([binary]) => binary === 'gh').map(([, args]) => args[0])).toEqual(['--version', '--version', 'api']);
  expect(installs()[0][2].env.HOMEBREW_NO_ASK).toBe('1');
});

test.each([[[]], [['--install', '--confirm']]])('already available gh is reused without upgrade; account verification is not write permission', flags => {
  state.gh = version;
  state.account = { status: 0, stdout: JSON.stringify({ login: 'contributor', type: 'User', email: 'private-token' }) };
  const result = setup(flags);
  expect(result).toMatchObject({ ready: true, account: { state: 'verified', login: 'contributor' }, nextStep: 'ready',
    publicConfirmationRequired: true, submissionPerformed: false, installation: { attempted: false }, authorization: { command: null } });
  expect(installs()).toHaveLength(0);
  expect(JSON.stringify(result)).not.toContain('private-token');
  expect(spawn.mock.calls.map(([binary]) => binary)).toEqual(['gh', 'gh']);
  expect(spawn.mock.calls[1][1]).toEqual(['api', '--hostname', 'github.com', '--method', 'GET', 'user']);
});

test.each([
  { status: null, error: { code: 'EACCES' } }, { status: null, error: { code: 'ETIMEDOUT' } },
  { status: 1 }, { status: 0, stdout: 'different tool' },
])('unexecutable or unverifiable gh is not treated as missing: %j', result => {
  state.gh = { ...result, stderr: 'private-token' };
  expect(setup(['--install', '--confirm'])).toMatchObject({ success: false, tool: { state: 'unverified' }, nextStep: 'check_execution' });
  expect(spawn).toHaveBeenCalledTimes(1);
});

test.each([missing, { status: 1 }, { status: null, error: { code: 'EACCES' } }])('missing or failed manager stays manual without bootstrap: %j', manager => {
  state.manager = manager;
  expect(setup(['--install', '--confirm'])).toMatchObject({ success: false, nextStep: 'manual_install', installation: { attempted: false } });
  expect(installs()).toHaveLength(0);
});

test('unsupported platforms offer official instructions without probing arbitrary managers', () => {
  expect(setup(['--install', '--confirm'], 'freebsd')).toMatchObject({ nextStep: 'manual_install', installation: { plan: { reason: 'unsupported_platform' } } });
  expect(spawn).toHaveBeenCalledTimes(1);
});

test.each([
  [{ status: 1 }, version], [{ status: null, error: { code: 'ETIMEDOUT' } }, missing],
  [{ status: 0 }, missing], [{ status: null, error: { code: 'ENOENT' } }, missing],
])('installation errors or missing PATH need readback, never automatic replay', (result, afterInstall) => {
  state.install = { ...result, stderr: 'private-token', stdout: 'private-token' }; state.afterInstall = afterInstall;
  const output = setup(['--install', '--confirm']);
  expect(output).toMatchObject({ success: false, installation: { attempted: true, state: 'unverified' }, nextStep: 'inspect_installation', inspectBeforeRetry: true });
  expect(installs()).toHaveLength(1);
  expect(JSON.stringify(output)).not.toContain('private-token');
});

test.each([
  { status: 1, stdout: '{"message":"private-token"}' }, { status: null, error: { code: 'ETIMEDOUT' } },
  { status: 0, stdout: 'invalid JSON' }, { status: 0, stdout: '{"type":"Organization","login":"org"}' },
  { status: 0, stdout: '{"type":"User","login":"bad/account"}' },
])('account errors remain unknown and never trigger installation or login: %j', account => {
  state.gh = version; state.account = { ...account, stderr: 'private-token' };
  const result = setup(['--install', '--confirm']);
  expect(result).toMatchObject({ ready: false, account: { state: 'unverified', login: null }, nextStep: 'check_account' });
  expect(installs()).toHaveLength(0);
  expect(JSON.stringify(result)).not.toContain('private-token');
});

test('thrown subprocess errors are sanitized', () => {
  spawn.mockImplementation(() => { throw new Error('private-token'); });
  const result = setup();
  expect(result.tool.state).toBe('unverified');
  expect(JSON.stringify(result)).not.toContain('private-token');
});

test('CLI installation failure throws a sanitized error instead of reporting success', () => {
  const childProcess = require('child_process');
  const spy = jest.spyOn(childProcess, 'spawnSync').mockImplementation(spawn);
  state.manager = missing;
  try {
    jest.isolateModules(() => {
      expect(() => require('../lib/feedback/github').run(['setup', '--install', '--confirm', '--json']))
        .toThrow(expect.objectContaining({ code: 'FEEDBACK_GITHUB_SETUP_FAILED',
          details: expect.objectContaining({ success: false, nextStep: 'manual_install', submissionPerformed: false }) }));
    });
  } finally { spy.mockRestore(); }
});

test('rechecking after user login only reads the account and does not mutate the original draft', () => {
  state.gh = version;
  expect(setup().nextStep).toBe('browser_login');
  state.account = { status: 0, stdout: '{"type":"User","login":"contributor"}' };
  expect(setup()).toMatchObject({ ready: true, submissionPerformed: false });
  expect(spawn.mock.calls.every(([binary, args]) => binary === 'gh' && ['--version', 'api'].includes(args[0]))).toBe(true);
});

test.each([false, true])('managed runs reject setup before every subprocess (install=%s)', install => {
  expect(() => execute({ action: 'setup', install, confirm: install }, { spawnSyncFn: spawn, env: { OPENYIDA_MANAGED_RUN: '1' } })).toThrow(expect.objectContaining({ code: 'FEEDBACK_GITHUB_MANAGED_DENIED' }));
  expect(spawn).not.toHaveBeenCalled();
});

test('manifest and automatic-update policy retain the conservative setup boundary without a top-level command', () => {
  const commands = flattenCommandManifest();
  const feedback = commands.find(command => command.name === 'feedback');
  expect(feedback.permission.ask_actions).toContain('github setup');
  expect(feedback.managedRun.actions).toEqual({ report: { scope: 'local' } });
  expect(commands.some(command => command.name === 'github')).toBe(false);
  expect(shouldSkipAutoUpdateCommand('feedback', ['github', 'setup', '--install', '--confirm'])).toBe(true);
});

test('all 12 locale packs provide non-fallback setup messages', () => {
  const locales = ['zh', 'en', 'zh-HK', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ar', 'hi', 'vi'];
  const keys = ['inspect_installation', 'check_execution', 'confirm_install', 'manual_install', 'ready', 'browser_login', 'check_account', 'consent', 'privacy'];
  for (const locale of locales) {
    const base = ['zh', 'en'].includes(locale) ? 'lib/core/locales' : 'locales-extra/core';
    const messages = require(`../${base}/${locale}`).feedback_github;
    for (const key of keys) { expect(messages[`setup_${key}`]).toEqual(expect.any(String)); }
    expect(messages.usage).toContain('setup');
  }
});

test('skill describes consent, safe fallback, browser authorization and original-report continuity', () => {
  const guide = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-feedback/references/github-setup.md'), 'utf8');
  for (const text of ['setup --json', '--install --confirm', '--skip-ssh-key', 'WinGet', 'Homebrew', 'incidentEnvironment', '个人 Fork', '公开确认', '明文', '不自动重试']) {
    expect(guide).toContain(text);
  }
});
