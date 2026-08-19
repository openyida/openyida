'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { switchOrganization } = require('../lib/auth/org');
const {
  getTokenFilePath,
  getUserProfileFilePath,
  loadTokenSession,
  saveProjectLegacyTokenSession,
  saveTokenSession,
} = require('../lib/auth/token-store');

function makeSession(corpId, userId, accessToken) {
  return {
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
    base_url: 'https://www.aliwork.com',
    client_id: 'openyida-cli',
    corp_id: corpId,
    corp_name: `组织 ${corpId}`,
    user_id: userId,
    user_name: `用户 ${userId}`,
  };
}

async function withProcessEnv(values, callback) {
  const previous = {};
  Object.keys(values).forEach((key) => {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  });
  try {
    return await callback();
  } finally {
    Object.keys(values).forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  }
}

describe('org switch auth profile behavior', () => {
  let rootDir;
  let projectRoot;
  let otherProjectRoot;
  let authDir;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-org-switch-'));
    projectRoot = path.join(rootDir, 'project-a');
    otherProjectRoot = path.join(rootDir, 'project-b');
    authDir = path.join(rootDir, 'user-auth');
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(otherProjectRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('switches to an existing user profile without deleting the previous shared profile', async () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const target = saveTokenSession(makeSession('corp-b', 'user-b', 'access-b'), {
      projectRoot: otherProjectRoot,
      authDir,
    });
    const tokenLogin = jest.fn(async () => {
      throw new Error('tokenLogin should not run when target profile already exists');
    });

    const result = await switchOrganization('corp-b', {
      projectRoot,
      authDir,
      tokenLogin,
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'switched',
      switch_source: 'existing_profile',
      previous_corp_id: 'corp-a',
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(tokenLogin).not.toHaveBeenCalled();
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
    expect(fs.existsSync(getUserProfileFilePath(target.auth_profile, { authDir }))).toBe(true);
  });

  test('switches to an explicit target profile and updates the current project pointer', async () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const target = saveTokenSession(makeSession('corp-b', 'user-b', 'access-b'), {
      projectRoot: otherProjectRoot,
      authDir,
    });
    const tokenLogin = jest.fn(async () => {
      throw new Error('tokenLogin should not run when explicit target profile exists');
    });

    const result = await switchOrganization('corp-b', {
      projectRoot,
      authDir,
      authProfile: target.auth_profile,
      tokenLogin,
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'switched',
      switch_source: 'existing_profile',
      previous_corp_id: 'corp-a',
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(tokenLogin).not.toHaveBeenCalled();
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
    expect(fs.existsSync(getUserProfileFilePath(target.auth_profile, { authDir }))).toBe(true);
  });

  test('ignores process env auth profile selector when reading current project state', async () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const target = saveTokenSession(makeSession('corp-b', 'user-b', 'access-b'), {
      projectRoot: otherProjectRoot,
      authDir,
    });
    const tokenLogin = jest.fn(async () => {
      throw new Error('tokenLogin should not run when env target profile exists');
    });

    const result = await withProcessEnv({
      OPENYIDA_AUTH_PROFILE: target.auth_profile,
      OPENYIDA_AUTH_CORP_ID: undefined,
      OPENYIDA_AUTH_USER_ID: undefined,
    }, () => switchOrganization('corp-b', {
      projectRoot,
      authDir,
      tokenLogin,
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'switched',
      switch_source: 'existing_profile',
      previous_corp_id: 'corp-a',
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(tokenLogin).not.toHaveBeenCalled();
    expect(loadTokenSession({ projectRoot, authDir, env: {} })).toMatchObject({
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
  });

  test('ignores process env auth corp selector when reading current project state', async () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const target = saveTokenSession(makeSession('corp-b', 'user-b', 'access-b'), {
      projectRoot: otherProjectRoot,
      authDir,
    });
    const tokenLogin = jest.fn(async () => {
      throw new Error('tokenLogin should not run when env target corp exists');
    });

    const result = await withProcessEnv({
      OPENYIDA_AUTH_PROFILE: undefined,
      OPENYIDA_AUTH_CORP_ID: 'corp-b',
      OPENYIDA_AUTH_USER_ID: undefined,
    }, () => switchOrganization('corp-b', {
      projectRoot,
      authDir,
      tokenLogin,
    }));

    expect(result).toMatchObject({
      ok: true,
      status: 'switched',
      switch_source: 'existing_profile',
      previous_corp_id: 'corp-a',
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(tokenLogin).not.toHaveBeenCalled();
    expect(loadTokenSession({ projectRoot, authDir, env: {} })).toMatchObject({
      auth_profile: target.auth_profile,
      corp_id: 'corp-b',
      user_id: 'user-b',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
  });

  test('restores the original project pointer when OAuth login returns a different organization', async () => {
    const previous = saveTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const tokenLogin = jest.fn(async (loginOptions) => {
      return saveTokenSession(makeSession('corp-c', 'user-c', 'access-c'), loginOptions);
    });

    await expect(switchOrganization('corp-b', {
      projectRoot,
      authDir,
      tokenLogin,
    })).rejects.toMatchObject({
      code: 'ORG_SWITCH_CORP_MISMATCH',
      targetCorpId: 'corp-b',
      actualCorpId: 'corp-c',
    });

    expect(tokenLogin).toHaveBeenCalledTimes(1);
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: previous.auth_profile,
      corp_id: 'corp-a',
      user_id: 'user-a',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
  });

  test('restores the original project legacy token when OAuth login returns a different organization', async () => {
    saveProjectLegacyTokenSession(makeSession('corp-a', 'user-a', 'access-a'), {
      projectRoot,
      authDir,
    });
    const tokenLogin = jest.fn(async (loginOptions) => {
      return saveTokenSession(makeSession('corp-c', 'user-c', 'access-c'), loginOptions);
    });

    await expect(switchOrganization('corp-b', {
      projectRoot,
      authDir,
      tokenLogin,
    })).rejects.toMatchObject({
      code: 'ORG_SWITCH_CORP_MISMATCH',
      targetCorpId: 'corp-b',
      actualCorpId: 'corp-c',
    });

    expect(tokenLogin).toHaveBeenCalledTimes(1);
    expect(tokenLogin.mock.calls[0][0].projectRoot).not.toBe(projectRoot);
    expect(tokenLogin.mock.calls[0][0].authDir).not.toBe(authDir);
    expect(fs.existsSync(getTokenFilePath({ projectRoot, authDir }))).toBe(true);
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      access_token: 'access-a',
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
      corp_id: 'corp-a',
      user_id: 'user-a',
    });
  });

  test('does not run OAuth or write local store in env token mode mismatch', async () => {
    const env = {
      OPENYIDA_AUTH_MODE: 'token',
      OPENYIDA_ACCESS_TOKEN: 'env-a',
      OPENYIDA_REFRESH_TOKEN: 'env-a-refresh',
      OPENYIDA_ENDPOINT: 'https://www.aliwork.com',
      OPENYIDA_TOKEN_CLIENT_ID: 'openyida-cli',
      OPENYIDA_TOKEN_CORP_ID: 'corp-a',
      OPENYIDA_TOKEN_USER_ID: 'user-a',
    };
    const tokenLogin = jest.fn(async (loginOptions) => {
      return saveTokenSession(makeSession('corp-b', 'user-b', 'oauth-b'), loginOptions);
    });

    await expect(switchOrganization('corp-b', {
      projectRoot,
      authDir,
      env,
      tokenLogin,
    })).rejects.toMatchObject({
      code: 'ORG_SWITCH_ENV_TOKEN_MISMATCH',
      status: 'env_token_mismatch',
      targetCorpId: 'corp-b',
      actualCorpId: 'corp-a',
      auth_store: 'env',
    });

    expect(tokenLogin).not.toHaveBeenCalled();
    expect(loadTokenSession({ projectRoot, authDir, env })).toMatchObject({
      access_token: 'env-a',
      auth_source: 'env',
      auth_store: 'env',
      corp_id: 'corp-a',
    });
    expect(loadTokenSession({ projectRoot, authDir, env: {} })).toBe(null);
    expect(fs.existsSync(getTokenFilePath({ projectRoot, authDir }))).toBe(false);
    expect(fs.existsSync(path.join(authDir, 'profiles'))).toBe(false);
  });

  test('does not guess when multiple target profiles exist for the requested organization', async () => {
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
    const tokenLogin = jest.fn(async () => {
      throw new Error('tokenLogin should not run for ambiguous target profiles');
    });

    await expect(switchOrganization('corp-b', {
      projectRoot,
      authDir,
      tokenLogin,
    })).rejects.toMatchObject({
      code: 'ORG_SWITCH_PROFILE_REQUIRED',
      targetCorpId: 'corp-b',
      candidateCount: 2,
    });

    expect(tokenLogin).not.toHaveBeenCalled();
    expect(loadTokenSession({ projectRoot, authDir })).toMatchObject({
      auth_profile: previous.auth_profile,
      corp_id: 'corp-a',
    });
    expect(fs.existsSync(getUserProfileFilePath(previous.auth_profile, { authDir }))).toBe(true);
  });
});
