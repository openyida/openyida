'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { switchOrganization } = require('../lib/auth/org');
const {
  getUserProfileFilePath,
  loadTokenSession,
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
