'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const utils = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const { getAccessToken, tokenLogout, tokenStatus } = require('../lib/auth/token-auth');
const { switchAuthProfile } = require('../lib/auth/profile');
const { getAuthProfilePointerFilePath, loadAuthProfilePointer, saveProjectLegacyTokenSession, saveTokenSession } = require('../lib/auth/token-store');

describe('authentication across project initialization', () => {
  let temporary;
  let workspace;
  let authDir;
  let originalAuthDir;
  let first;
  let second;
  let runtimeEnv;

  beforeEach(() => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-auth-init-'));
    workspace = path.join(temporary, 'workspace');
    authDir = path.join(temporary, 'auth');
    fs.mkdirSync(workspace);
    originalAuthDir = process.env.OPENYIDA_AUTH_DIR;
    process.env.OPENYIDA_AUTH_DIR = authDir;
    runtimeEnv = { QWENWORK: '1' };
    const detectRuntime = utils.detectRuntimeCapabilities;
    jest.spyOn(utils, 'detectRuntimeCapabilities').mockImplementation((options = {}) => detectRuntime({
      ...options, env: runtimeEnv,
    }));
    jest.spyOn(process, 'cwd').mockReturnValue(workspace);
    const session = (id) => ({
      access_token: `synthetic-access-${id}`,
      refresh_token: `synthetic-refresh-${id}`,
      base_url: 'https://example.invalid',
      client_id: 'test-cli',
      corp_id: `corp-${id}`,
      user_id: 'test-user',
    });
    first = saveTokenSession(session('a'), { projectRoot: workspace, authDir });
    second = saveTokenSession(session('b'), { projectRoot: path.join(temporary, 'other'), authDir });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAuthDir === undefined) {delete process.env.OPENYIDA_AUTH_DIR;}
    else {process.env.OPENYIDA_AUTH_DIR = originalAuthDir;}
    fs.rmSync(temporary, { recursive: true, force: true });
  });

  test.each([
    ['directory', false], ['config', false], ['config', true],
  ])('keeps the selected organization after creating project %s (declared workspace: %s)', async (stage, declared) => {
    if (declared) {runtimeEnv.QWENWORK_WORKSPACE_DIR = workspace;}
    expect(tokenStatus()).toMatchObject({ status: 'ok', auth_profile: first.auth_profile });
    fs.mkdirSync(path.join(workspace, 'project', 'pages', 'src'), { recursive: true });
    if (stage === 'config') {fs.writeFileSync(path.join(workspace, 'project', 'config.json'), '{}');}
    expect(utils.findProjectRoot()).toBe(path.join(workspace, 'project'));
    expect(tokenStatus()).toMatchObject({ status: 'ok', auth_profile: first.auth_profile });
    expect(createAuthRef()).toMatchObject({ authProfile: first.auth_profile, corpId: 'corp-a' });
    await expect(getAccessToken()).resolves.toBe('synthetic-access-a');
  });

  test('does not replace a child legacy session with the workspace organization', () => {
    const child = path.join(workspace, 'project');
    fs.mkdirSync(child);
    saveProjectLegacyTokenSession({
      access_token: 'legacy-child-access', base_url: 'https://example.invalid', corp_id: 'legacy-child',
    }, { projectRoot: child, authDir });
    expect(tokenStatus()).toMatchObject({ status: 'ok', corp_id: 'legacy-child' });
  });

  test('separate CLI processes reuse the initial organization after page authoring', () => {
    const cli = path.resolve(__dirname, '../bin/yida.js');
    const run = (args, cwd = workspace) => spawnSync(process.execPath, [cli, ...args], {
      cwd, encoding: 'utf8', timeout: 15000,
      env: {
        PATH: process.env.PATH, QWENWORK: '1', OPENYIDA_AUTH_DIR: authDir,
        OPENYIDA_SKIP_UPDATE_CHECK: '1', OPENYIDA_LANG: 'en', NO_COLOR: '1',
      },
    });
    expect(run(['auth', 'profile', 'switch', first.auth_profile]).status).toBe(0);
    const child = path.join(workspace, 'project');
    fs.mkdirSync(path.join(child, 'pages', 'src'), { recursive: true });
    fs.writeFileSync(path.join(child, 'config.json'), '{}');
    for (const cwd of [workspace, child]) {
      const checked = run(['auth', 'status', '--json'], cwd);
      expect(checked.status).toBe(0);
      expect(JSON.parse(checked.stdout)).toMatchObject({ status: 'ok', auth_profile: first.auth_profile });
    }
    const detached = run(['auth', 'logout'], child);
    expect(detached.status).toBe(0);
    const blocked = run(['create-page', 'APP_TEST', 'Test', '--json'], child);
    expect(blocked.status).toBe(1);
    const errorJson = blocked.stderr.match(/\{\s*"success"[\s\S]*\}\s*$/);
    expect(errorJson).not.toBeNull();
    expect(JSON.parse(errorJson[0])).toMatchObject({ errorCode: 'AUTH_PROFILE_REQUIRED' });
    expect(blocked.stderr).not.toContain('openyida login');
  });

  test('a child selection takes precedence and logout does not restore the workspace selection', async () => {
    const child = path.join(workspace, 'project');
    fs.mkdirSync(child);
    switchAuthProfile(second.auth_profile, { projectRoot: child, authDir });
    expect(tokenStatus()).toMatchObject({ status: 'ok', auth_profile: second.auth_profile });
    await tokenLogout({ projectRoot: child, authDir });
    await tokenLogout({ projectRoot: child, authDir });
    expect(tokenStatus()).toMatchObject({ status: 'profile_required', can_auto_use: false });
    expect(loadAuthProfilePointer({ projectRoot: workspace })).toMatchObject({ auth_profile: first.auth_profile });
    switchAuthProfile(first.auth_profile, { projectRoot: child, authDir });
    expect(tokenStatus()).toMatchObject({ status: 'ok', auth_profile: first.auth_profile });
  });

  test.each(['sibling', 'configured-parent', 'symlink'])('does not inherit a selection across the %s boundary', (boundary) => {
    let child = path.join(workspace, 'project');
    if (boundary === 'sibling') {child = path.join(temporary, 'independent');}
    if (boundary === 'configured-parent') {fs.writeFileSync(path.join(workspace, 'config.json'), '{}');}
    if (boundary === 'symlink') {
      const target = path.join(temporary, 'independent');
      fs.mkdirSync(target);
      fs.symlinkSync(target, child, process.platform === 'win32' ? 'junction' : 'dir');
    } else {fs.mkdirSync(child);}
    expect(tokenStatus({ projectRoot: child, authDir })).toMatchObject({ status: 'profile_required', can_auto_use: false });
  });

  test('does not cross environments or override an invalid child pointer', () => {
    const child = path.join(workspace, 'project');
    fs.mkdirSync(child);
    expect(tokenStatus({ projectRoot: child, envName: 'intl', authDir })).toMatchObject({ status: 'profile_required' });
    const pointer = getAuthProfilePointerFilePath({ projectRoot: child });
    fs.mkdirSync(path.dirname(pointer), { recursive: true });
    fs.writeFileSync(pointer, '{broken');
    expect(tokenStatus()).toMatchObject({ status: 'profile_required' });
  });

  test('business auth reports organization selection instead of asking for another login', async () => {
    fs.unlinkSync(getAuthProfilePointerFilePath({ projectRoot: workspace }));
    expect(() => createAuthRef()).toThrow(expect.objectContaining({
      code: 'AUTH_PROFILE_REQUIRED',
      details: expect.objectContaining({ status: 'profile_required', candidate_count: 2 }),
    }));
    await expect(getAccessToken()).rejects.toMatchObject({ code: 'AUTH_PROFILE_REQUIRED' });
    try {createAuthRef();} catch (error) {
      expect(error.message).toContain('openyida auth profile switch');
      expect(error.message).not.toContain('openyida login');
      expect(JSON.stringify(error.details)).not.toContain('synthetic-access');
      expect(JSON.stringify(error.details)).not.toContain('synthetic-refresh');
    }
  });

  test('a missing explicit profile is distinguished from missing credentials', async () => {
    await expect(getAccessToken({ authProfile: 'missing-profile' })).rejects.toMatchObject({
      code: 'AUTH_PROFILE_NOT_FOUND', details: { status: 'profile_not_found', auth_profile: 'missing-profile' },
    });
    const previous = process.env.OPENYIDA_AUTH_PROFILE;
    try {
      process.env.OPENYIDA_AUTH_PROFILE = 'missing-profile';
      expect(() => createAuthRef()).toThrow(expect.objectContaining({ code: 'AUTH_PROFILE_NOT_FOUND' }));
    } finally {
      if (previous === undefined) {delete process.env.OPENYIDA_AUTH_PROFILE;}
      else {process.env.OPENYIDA_AUTH_PROFILE = previous;}
    }
  });
});
