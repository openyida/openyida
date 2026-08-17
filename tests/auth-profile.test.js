'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  listAuthProfiles,
  switchAuthProfile,
} = require('../lib/auth/profile');
const {
  getUserProfileFilePath,
  loadTokenSession,
  saveTokenSession,
} = require('../lib/auth/token-store');

function makeSession(corpId, userId, accessToken, corpName) {
  return {
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
    base_url: 'https://www.aliwork.com',
    client_id: 'openyida-cli',
    corp_id: corpId,
    corp_name: corpName || `组织 ${corpId}`,
    user_id: userId,
    user_name: `用户 ${userId}`,
  };
}

describe('auth profile management', () => {
  let rootDir;
  let projectRoot;
  let otherProjectRoot;
  let authDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-auth-profile-'));
    projectRoot = path.join(rootDir, 'project-a');
    otherProjectRoot = path.join(rootDir, 'project-b');
    authDir = path.join(rootDir, 'user-auth');
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(otherProjectRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('lists safe user auth profile metadata', () => {
    const saved = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a', '组织 A'), {
      projectRoot,
      authDir,
    });

    const result = listAuthProfiles({ projectRoot, authDir });

    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      auth_store: 'user',
      current_auth_profile: saved.auth_profile,
      count: 1,
      profiles: [
        expect.objectContaining({
          auth_profile: saved.auth_profile,
          corp_id: 'corp-a',
          corp_name: '组织 A',
          user_id: 'user-a',
          user_name: '用户 user-a',
          auth_store: 'user',
          is_current: true,
        }),
      ],
    });
    expect(result.profiles[0].last_used_at).toBeTruthy();
    expect(result.profiles[0]).not.toHaveProperty('access_token');
    expect(result.profiles[0]).not.toHaveProperty('refresh_token');
  });

  test('switches current project pointer to an existing profile by profile id', () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const target = saveTokenSession(makeSession('corp-b', 'user-b', 'access-b'), {
      projectRoot: otherProjectRoot,
      authDir,
    });

    const result = switchAuthProfile(target.auth_profile, { projectRoot, authDir });

    expect(result).toMatchObject({
      ok: true,
      status: 'switched',
      target_kind: 'auth_profile',
      previous_auth_profile: previous.auth_profile,
      previous_corp_id: 'corp-a',
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
    expect(fs.existsSync(getUserProfileFilePath(target.auth_profile, { authDir }))).toBe(true);
  });

  test('switches current project pointer to an existing unique profile by corpId', () => {
    saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const target = saveTokenSession(makeSession('corp-b', 'user-b', 'access-b'), {
      projectRoot: otherProjectRoot,
      authDir,
    });

    const result = switchAuthProfile('corp-b', { projectRoot, authDir });

    expect(result).toMatchObject({
      ok: true,
      status: 'switched',
      target_kind: 'corp_id',
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
    });
  });

  test('does not mutate the current pointer when target profile is missing', () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });

    try {
      switchAuthProfile('corp-missing', { projectRoot, authDir });
      throw new Error('switchAuthProfile should throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'AUTH_PROFILE_NOT_FOUND',
        details: {
          next_step: expect.stringContaining('openyida auth profiles'),
        },
      });
    }
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: previous.auth_profile,
      corp_id: 'corp-a',
    });
  });

  test('requires exact profile when corpId matches multiple profiles', () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    saveTokenSession(makeSession('corp-b', 'user-b1', 'access-b1'), {
      projectRoot: path.join(rootDir, 'project-b1'),
      authDir,
    });
    saveTokenSession(makeSession('corp-b', 'user-b2', 'access-b2'), {
      projectRoot: path.join(rootDir, 'project-b2'),
      authDir,
    });

    try {
      switchAuthProfile('corp-b', { projectRoot, authDir });
      throw new Error('switchAuthProfile should throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'AUTH_PROFILE_REQUIRED',
        details: {
          candidate_count: 2,
          next_step: expect.stringContaining('openyida auth profile switch <auth_profile>'),
        },
      });
    }
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: previous.auth_profile,
      corp_id: 'corp-a',
    });
  });

  test('host-injected token mode does not switch local profiles', () => {
    const saved = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });

    expect(() => switchAuthProfile(saved.auth_profile, {
      projectRoot,
      authDir,
      env: { YIDA_AUTH_ENABLED: 'true' },
    })).toThrow(/host-injected token mode/);
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: saved.auth_profile,
      corp_id: 'corp-a',
    });
  });
});
