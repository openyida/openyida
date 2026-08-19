'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  clearTokenSession,
  getAuthProfilePointerFilePath,
  getBusinessContextFilePath,
  getTokenFilePath,
  getUserProfileFilePath,
  isAccessTokenUsable,
  listUserAuthProfiles,
  loadBusinessContext,
  loadTokenSession,
  maskToken,
  normalizeCorpName,
  resolveTokenSession,
  saveBusinessContext,
  saveProjectLegacyTokenSession,
  saveTokenSession,
} = require('../lib/auth/token-store');

describe('token-store', () => {
  let projectRoot;
  let authDir;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-store-'));
    authDir = path.join(projectRoot, 'user-auth');
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('saves and loads token session per environment', () => {
    const options = { projectRoot, envName: 'alibaba' };
    const saved = saveTokenSession({
      access_token: 'access-token-value',
      refresh_token: 'refresh-token-value',
      expires_in: 1800,
      base_url: 'https://www.aliwork.com/openapi/cli/v1/auth',
      corp_id: 'corpA',
      user_id: 'userA',
    }, { ...options, authDir });

    expect(saved.auth_mode).toBe('token');
    expect(saved.expires_at).toBeGreaterThan(Date.now());
    expect(getTokenFilePath(options)).toContain('auth-token-alibaba.json');
    const raw = JSON.parse(fs.readFileSync(getTokenFilePath(options), 'utf8'));
    expect(raw.base_url).toBe('https://www.aliwork.com');
    expect(raw.token_endpoint).toBeUndefined();

    const loaded = loadTokenSession({ ...options, authDir });
    expect(loaded.access_token).toBe('access-token-value');
    expect(loaded.refresh_token).toBe('refresh-token-value');
    expect(loaded.base_url).toBe('https://www.aliwork.com');
    expect(loaded.corp_id).toBe('corpA');
    expect(loaded.auth_source).toBe('project_legacy');
    expect(loaded.auth_store).toBe('project_cache');
    expect(isAccessTokenUsable(loaded)).toBe(true);
  });

  test('clears token session idempotently', () => {
    const options = { projectRoot, envName: 'public', authDir };
    saveTokenSession({ access_token: 'token' }, options);
    clearTokenSession(options);
    clearTokenSession(options);
    expect(loadTokenSession(options)).toBe(null);
  });

  test('saves complete OAuth sessions to user auth profile and project pointer only', () => {
    const options = { projectRoot, envName: 'public', authDir };
    const saved = saveTokenSession({
      access_token: 'user-access-token',
      refresh_token: 'user-refresh-token',
      expires_in: 1800,
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-user',
      user_id: 'user-user',
      user_name: 'User',
    }, options);

    const pointerFile = getAuthProfilePointerFilePath(options);
    const profileFile = getUserProfileFilePath(saved.auth_profile, options);
    const pointer = JSON.parse(fs.readFileSync(pointerFile, 'utf8'));
    const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));

    expect(saved).toMatchObject({
      auth_source: 'user_profile',
      auth_store: 'user',
      persistence_scope: 'user',
      corp_id: 'corp-user',
      user_id: 'user-user',
    });
    expect(fs.existsSync(getTokenFilePath(options))).toBe(false);
    expect(pointer).toMatchObject({
      auth_profile: saved.auth_profile,
      auth_store: 'user',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-user',
      user_id: 'user-user',
    });
    expect(pointer).not.toHaveProperty('access_token');
    expect(pointer).not.toHaveProperty('refresh_token');
    expect(profile.access_token).toBe('user-access-token');
    expect(profile.refresh_token).toBe('user-refresh-token');

    const loaded = loadTokenSession(options);
    expect(loaded).toMatchObject({
      access_token: 'user-access-token',
      refresh_token: 'user-refresh-token',
      auth_source: 'user_profile',
      auth_store: 'user',
      auth_profile: saved.auth_profile,
    });
  });

  test('persists corp name metadata without changing auth profile identity', () => {
    const options = { projectRoot, envName: 'public', authDir };
    const first = saveTokenSession({
      access_token: 'first-access-token',
      refresh_token: 'first-refresh-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-user',
      corp_name: '钉钉组织',
      user_id: 'user-user',
    }, options);
    const second = saveTokenSession({
      access_token: 'second-access-token',
      refresh_token: 'second-refresh-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-user',
      corpName: '钉钉组织新版',
      user_id: 'user-user',
    }, options);

    const pointer = JSON.parse(fs.readFileSync(getAuthProfilePointerFilePath(options), 'utf8'));
    const profile = JSON.parse(fs.readFileSync(getUserProfileFilePath(second.auth_profile, options), 'utf8'));

    expect(normalizeCorpName({ name: '钉钉组织' })).toBe('钉钉组织');
    expect(second.auth_profile).toBe(first.auth_profile);
    expect(pointer).toMatchObject({
      auth_profile: second.auth_profile,
      corp_id: 'corp-user',
      corp_name: '钉钉组织新版',
    });
    expect(profile).toMatchObject({
      access_token: 'second-access-token',
      corp_id: 'corp-user',
      corp_name: '钉钉组织新版',
    });
  });

  test('keeps user profile when project auth pointer cannot be written', () => {
    const blockedProjectRoot = path.join(projectRoot, 'blocked-project');
    fs.writeFileSync(blockedProjectRoot, 'not a directory', 'utf8');
    const options = { projectRoot: blockedProjectRoot, envName: 'review', authDir };

    const saved = saveTokenSession({
      access_token: 'user-access-token',
      refresh_token: 'user-refresh-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-user',
      user_id: 'user-user',
    }, options);

    expect(saved).toMatchObject({
      auth_source: 'user_profile',
      auth_store: 'user',
      persistence_scope: 'user',
      user_auth_store_writable: true,
      corp_id: 'corp-user',
      user_id: 'user-user',
    });
    expect(saved.warning).toContain('project_auth_pointer_unavailable');
    expect(fs.existsSync(getUserProfileFilePath(saved.auth_profile, options))).toBe(true);
    expect(fs.existsSync(getAuthProfilePointerFilePath(options))).toBe(false);
    expect(fs.existsSync(getTokenFilePath(options))).toBe(false);

    expect(loadTokenSession(options)).toMatchObject({
      access_token: 'user-access-token',
      auth_source: 'user_profile',
      auth_store: 'user',
      persistence_scope: 'user',
    });
  });

  test('falls back to project legacy when the user auth dir cannot be written', () => {
    const authDirFile = path.join(projectRoot, 'not-a-directory');
    fs.writeFileSync(authDirFile, 'block directory creation', 'utf8');
    const options = { projectRoot, envName: 'public', authDir: authDirFile };

    const saved = saveTokenSession({
      access_token: 'legacy-access-token',
      refresh_token: 'legacy-refresh-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-fallback',
      user_id: 'user-fallback',
    }, options);

    expect(saved).toMatchObject({
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
      persistence_scope: 'project',
      user_auth_store_writable: false,
    });
    expect(saved.warning).toContain('user_auth_store_unavailable_project_legacy_fallback');
    expect(fs.existsSync(getTokenFilePath(options))).toBe(true);
    expect(loadTokenSession(options)).toMatchObject({
      access_token: 'legacy-access-token',
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
    });
  });

  test('current project legacy beats unrelated single user profile when no pointer or explicit selector', () => {
    const otherProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-profile-other-'));
    try {
      saveTokenSession({
        access_token: 'global-access-token',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-global',
        user_id: 'user-global',
      }, { projectRoot: otherProject, authDir });
      saveProjectLegacyTokenSession({
        access_token: 'legacy-access-token',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-legacy',
        user_id: 'user-legacy',
      }, { projectRoot, authDir });

      const loaded = loadTokenSession({ projectRoot, authDir });
      expect(loaded).toMatchObject({
        access_token: 'legacy-access-token',
        corp_id: 'corp-legacy',
        user_id: 'user-legacy',
        auth_source: 'project_legacy',
        auth_store: 'project_cache',
      });
    } finally {
      fs.rmSync(otherProject, { recursive: true, force: true });
    }
  });

  test('explicit corpId mismatch does not return project legacy', () => {
    saveProjectLegacyTokenSession({
      access_token: 'legacy-access-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-a',
      user_id: 'user-a',
    }, { projectRoot, authDir });

    expect(loadTokenSession({ projectRoot, authDir, corpId: 'corp-b' })).toBe(null);
    expect(resolveTokenSession({ projectRoot, authDir, corpId: 'corp-b' })).toMatchObject({
      session: null,
      status: 'profile_not_found',
    });
  });

  test('explicit corpId match can return project legacy', () => {
    saveProjectLegacyTokenSession({
      access_token: 'legacy-access-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-a',
      user_id: 'user-a',
    }, { projectRoot, authDir });

    expect(loadTokenSession({ projectRoot, authDir, corpId: 'corp-a' })).toMatchObject({
      access_token: 'legacy-access-token',
      corp_id: 'corp-a',
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
    });
  });

  test('explicit userId mismatch does not return project legacy', () => {
    saveProjectLegacyTokenSession({
      access_token: 'legacy-access-token',
      base_url: 'https://www.aliwork.com',
      client_id: 'openyida-cli',
      corp_id: 'corp-a',
      user_id: 'user-a',
    }, { projectRoot, authDir });

    expect(loadTokenSession({ projectRoot, authDir, userId: 'user-b' })).toBe(null);
  });

  test('explicit corpId constrains known env identity but allows env without corp identity', () => {
    expect(loadTokenSession({
      projectRoot,
      authDir,
      corpId: 'corp-b',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_TOKEN_CORP_ID: 'corp-a',
      },
    })).toBe(null);

    expect(loadTokenSession({
      projectRoot,
      authDir,
      corpId: 'corp-b',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
      },
    })).toMatchObject({
      access_token: 'env-access-token',
      auth_source: 'env',
    });
  });

  test('does not guess when multiple user profiles exist without project pointer', () => {
    const firstProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-profile-a-'));
    const secondProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-profile-b-'));
    const newProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-profile-new-'));
    try {
      saveTokenSession({
        access_token: 'access-a',
        refresh_token: 'refresh-a',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-a',
        corp_name: '组织 A',
        user_id: 'user-a',
      }, { projectRoot: firstProject, authDir });
      saveTokenSession({
        access_token: 'access-b',
        refresh_token: 'refresh-b',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-b',
        corp_name: '组织 B',
        user_id: 'user-b',
      }, { projectRoot: secondProject, authDir });

      expect(listUserAuthProfiles({ authDir })).toHaveLength(2);
      const ambiguous = resolveTokenSession({ projectRoot: newProject, authDir });
      expect(ambiguous).toMatchObject({
        session: null,
        status: 'profile_required',
        candidate_count: 2,
      });
      expect(ambiguous.candidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ corp_id: 'corp-a', corp_name: '组织 A', user_id: 'user-a' }),
        expect.objectContaining({ corp_id: 'corp-b', corp_name: '组织 B', user_id: 'user-b' }),
      ]));
      expect(ambiguous.candidates.every((candidate) => {
        return !Object.prototype.hasOwnProperty.call(candidate, 'access_token') &&
          !Object.prototype.hasOwnProperty.call(candidate, 'refresh_token') &&
          !Object.prototype.hasOwnProperty.call(candidate, 'raw');
      })).toBe(true);
      expect(loadTokenSession({ projectRoot: newProject, authDir })).toBe(null);

      const selected = loadTokenSession({
        projectRoot: newProject,
        authDir,
        corpId: 'corp-b',
      });
      expect(selected).toMatchObject({
        access_token: 'access-b',
        corp_id: 'corp-b',
        auth_source: 'user_profile',
      });
    } finally {
      fs.rmSync(firstProject, { recursive: true, force: true });
      fs.rmSync(secondProject, { recursive: true, force: true });
      fs.rmSync(newProject, { recursive: true, force: true });
    }
  });

  test('uses injected env access and refresh tokens when the local token file is absent', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_ENDPOINT: 'https://www.aliwork.com',
        OPENYIDA_TOKEN_CLIENT_ID: 'openyida-cli',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        OPENYIDA_TOKEN_CORP_NAME: '环境组织',
        OPENYIDA_TOKEN_USER_ID: 'user-env',
      },
    };

    const loaded = loadTokenSession(options);

    expect(loaded.access_token).toBe('env-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('env');
    expect(loaded.corp_id).toBe('corp-env');
    expect(loaded.corp_name).toBe('环境组织');
    expect(loaded.user_id).toBe('user-env');
  });

  test('env access token wins over a project legacy token file', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
      expires_in: 1800,
    }, options);

    const loaded = loadTokenSession(options);

    expect(loaded.access_token).toBe('env-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('env');
    expect(loaded.auth_store).toBe('env');
  });

  test('env token mode prefers project cache over stale env tokens', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
    }, options);

    const loaded = loadTokenSession(options);

    expect(loaded.access_token).toBe('local-access-token');
    expect(loaded.refresh_token).toBe('local-refresh-token');
    expect(loaded.auth_source).toBe('project_legacy');
    expect(loaded.auth_store).toBe('project_cache');
  });

  test('env token mode does not use project cache for another injected corp', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_TOKEN_CORP_ID: 'corp-b',
        OPENYIDA_TOKEN_USER_ID: 'user-b',
        OPENYIDA_ENDPOINT: 'https://www.aliwork.com',
      },
    };
    saveProjectLegacyTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
      corp_id: 'corp-a',
      user_id: 'user-a',
    }, options);

    const loaded = loadTokenSession(options);

    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.corp_id).toBe('corp-b');
    expect(loaded.user_id).toBe('user-b');
    expect(loaded.auth_source).toBe('env');
  });

  test('env token mode uses cached business base_url for the same corp', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_ENDPOINT: 'https://www.aliwork.com',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
      },
    };
    saveBusinessContext({
      corp_id: 'corp-env',
      corp_name: '缓存组织',
      base_url: 'https://customer.example.com/path',
    }, options);

    const loaded = loadTokenSession(options);
    const contextFile = getBusinessContextFilePath(options);
    const raw = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

    expect(loaded.base_url).toBe('https://customer.example.com');
    expect(loadBusinessContext(options)).toMatchObject({
      version: 1,
      corp_id: 'corp-env',
      corp_name: '缓存组织',
      base_url: 'https://customer.example.com',
    });
    expect(raw).not.toHaveProperty('access_token');
    expect(raw).not.toHaveProperty('refresh_token');
  });

  test('env token mode ignores cached business base_url for another corp', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_ENDPOINT: 'https://www.aliwork.com',
        OPENYIDA_TOKEN_CORP_ID: 'corp-current',
      },
    };
    saveBusinessContext({
      corp_id: 'corp-previous',
      base_url: 'https://previous-customer.example.com',
    }, options);

    expect(loadTokenSession(options).base_url).toBe('https://www.aliwork.com');
  });

  test('business context rejects non-http URLs and embedded credentials', () => {
    const options = { projectRoot, envName: 'public' };

    expect(saveBusinessContext({
      corp_id: 'corp-env',
      base_url: 'javascript:alert(1)',
    }, options)).toBeNull();
    expect(saveBusinessContext({
      corp_id: 'corp-env',
      base_url: 'https://user:password@customer.example.com',
    }, options)).toBeNull();
    expect(fs.existsSync(getBusinessContextFilePath(options))).toBe(false);
  });

  test('env token mode returns null when project cache and env token are missing', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
      },
    };
    saveProjectLegacyTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
      corp_id: 'corp-a',
    }, options);

    expect(loadTokenSession({
      ...options,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
        OPENYIDA_TOKEN_CORP_ID: 'corp-b',
      },
    })).toBeNull();
  });

  test('fills a missing local refresh token from env without replacing local access token', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      expires_at: Date.now() - 1000,
    }, options);

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBe('local-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('mixed');
    expect(loaded.auth_store).toBe('project_cache');
  });

  test('never fills a missing local access token from refresh-only env', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({ refresh_token: 'local-refresh-token' }, options);

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBeUndefined();
    expect(loaded.refresh_token).toBe('local-refresh-token');
    expect(loaded.auth_source).toBe('project_legacy');
  });

  test('falls back to env fields when the local token file cannot be parsed', () => {
    const options = {
      projectRoot,
      envName: 'public',
      authDir,
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    const tokenFile = getTokenFilePath(options);
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, '{not-json', 'utf8');

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBe('env-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('env');
  });

  test('masks token values', () => {
    expect(maskToken('1234567890abcdefg')).toBe('12345678...bcdefg');
    expect(maskToken('short')).toBe('shor...');
  });
});
