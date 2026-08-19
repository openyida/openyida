'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const {
  getAccessToken,
  normalizeTokenResponse,
  tokenLogin,
  tokenLogout,
  tokenRefresh,
  tokenStatus,
} = require('../lib/auth/token-auth');
const {
  getBusinessContextFilePath,
  getUserProfileFilePath,
  getTokenFilePath,
  listUserAuthProfiles,
  loadTokenSession,
  saveTokenSession,
} = require('../lib/auth/token-store');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

describe('token-auth', () => {
  let tmpDir;
  let authDir;
  let originalAuthDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-auth-'));
    authDir = path.join(tmpDir, 'user-auth');
    originalAuthDir = process.env.OPENYIDA_AUTH_DIR;
    process.env.OPENYIDA_AUTH_DIR = authDir;
  });

  afterEach(() => {
    if (originalAuthDir === undefined) {
      delete process.env.OPENYIDA_AUTH_DIR;
    } else {
      process.env.OPENYIDA_AUTH_DIR = originalAuthDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('本地 access token 即使过期也优先返回，等待业务接口判定', async () => {
    saveTokenSession({
      access_token: 'expired-local-access-token',
      expires_at: Date.now() - 1000,
      base_url: 'https://www.aliwork.com',
    }, { projectRoot: tmpDir, authDir });

    await expect(getAccessToken({
      projectRoot: tmpDir,
      authDir,
      env: {
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_ACCESS_TOKEN_EXPIRES_IN: '1800',
      },
    })).resolves.toBe('expired-local-access-token');
    expect(tokenStatus({ projectRoot: tmpDir })).toMatchObject({
      ok: true,
      status: 'ok',
      can_auto_use: true,
    });
  });

  test('normalizes corp name aliases from token responses', () => {
    expect(normalizeTokenResponse({
      content: {
        status: 'ok',
        accessToken: 'access-token',
        corpId: 'corp-a',
        corpName: '组织 A',
      },
    }, 'https://www.aliwork.com', 'openyida-cli')).toMatchObject({
      access_token: 'access-token',
      corp_id: 'corp-a',
      corp_name: '组织 A',
    });

    expect(normalizeTokenResponse({
      data: {
        access_token: 'access-token',
        corp_id: 'corp-b',
        name: '组织 B',
      },
    }, 'https://www.aliwork.com', 'openyida-cli')).toMatchObject({
      corp_id: 'corp-b',
      corp_name: '组织 B',
    });
  });

  test('host-injected token mode reports env access token status without local token file', () => {
    const status = tokenStatus({
      projectRoot: tmpDir,
      authDir,
      env: {
        YIDA_AUTH_ENABLED: 'true',
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        OPENYIDA_TOKEN_CORP_NAME: '环境组织',
        OPENYIDA_TOKEN_USER_ID: 'user-env',
      },
    });

    expect(status).toMatchObject({
      ok: true,
      auth_mode: 'token',
      auth_source: 'env',
      auth_store: 'host_injected',
      persistence_scope: 'host',
      status: 'ok',
      can_auto_use: true,
      corp_id: 'corp-env',
      corp_name: '环境组织',
      user_id: 'user-env',
    });
    expect(status.access_token).toBe('env-...');
    expect(status).not.toHaveProperty('token_file');
  });

  test('host-injected token login returns already logged in without OAuth', async () => {
    const result = await tokenLogin({
      projectRoot: tmpDir,
      authDir,
      noBrowser: true,
      quiet: true,
      timeoutMs: 1,
      env: {
        YIDA_AUTH_ENABLED: 'true',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_TOKEN_CLIENT_ID: 'openyida-cli',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        OPENYIDA_TOKEN_USER_ID: 'user-env',
        OPENYIDA_ENDPOINT: 'https://env-token.example.com',
      },
    });

    expect(result).toMatchObject({
      ok: true,
      auth_mode: 'token',
      auth_source: 'env',
      auth_store: 'host_injected',
      persistence_scope: 'host',
      status: 'ok',
      can_auto_use: true,
      already_logged_in: true,
      login_action: 'noop',
      previous_status: 'refresh_required',
      corp_id: 'corp-env',
      user_id: 'user-env',
    });
    expect(fs.existsSync(getTokenFilePath({ projectRoot: tmpDir, authDir }))).toBe(false);
  });

  test('OPENYIDA_AUTH_MODE=token refresh token login skips OAuth without YIDA_AUTH_ENABLED', async () => {
    const result = await tokenLogin({
      projectRoot: tmpDir,
      authDir,
      noBrowser: true,
      quiet: true,
      timeoutMs: 1,
      env: {
        OPENYIDA_AUTH_MODE: 'token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_TOKEN_CLIENT_ID: 'openyida-cli',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        OPENYIDA_TOKEN_USER_ID: 'user-env',
        OPENYIDA_ENDPOINT: 'https://env-token.example.com',
      },
    });

    expect(result).toMatchObject({
      ok: true,
      auth_mode: 'token',
      auth_source: 'env',
      auth_store: 'host_injected',
      persistence_scope: 'host',
      status: 'ok',
      can_auto_use: true,
      already_logged_in: true,
      login_action: 'noop',
      previous_status: 'refresh_required',
      corp_id: 'corp-env',
      user_id: 'user-env',
    });
    expect(fs.existsSync(getTokenFilePath({ projectRoot: tmpDir, authDir }))).toBe(false);
  });

  test('status exposes safe candidates when multiple profiles require selection', () => {
    const firstProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-status-a-'));
    const secondProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-status-b-'));
    const newProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-status-new-'));
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

      const status = tokenStatus({ projectRoot: newProject, authDir });

      expect(status).toMatchObject({
        ok: false,
        status: 'profile_required',
        candidate_count: 2,
        next_step: expect.stringContaining('openyida auth profiles'),
        next_step_commands: [
          'openyida auth profiles',
          'openyida auth profile switch <auth_profile>',
        ],
      });
      expect(status.candidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ corp_id: 'corp-a', corp_name: '组织 A', user_id: 'user-a' }),
        expect.objectContaining({ corp_id: 'corp-b', corp_name: '组织 B', user_id: 'user-b' }),
      ]));
      expect(status.candidates.every((candidate) => {
        return !Object.prototype.hasOwnProperty.call(candidate, 'access_token') &&
          !Object.prototype.hasOwnProperty.call(candidate, 'refresh_token') &&
          !Object.prototype.hasOwnProperty.call(candidate, 'raw');
      })).toBe(true);
    } finally {
      fs.rmSync(firstProject, { recursive: true, force: true });
      fs.rmSync(secondProject, { recursive: true, force: true });
      fs.rmSync(newProject, { recursive: true, force: true });
    }
  });

  test('host-injected token mode reports env_token_missing when host provides no token', () => {
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
    }, { projectRoot: tmpDir, authDir });

    const status = tokenStatus({
      projectRoot: tmpDir,
      authDir,
      env: {
        YIDA_AUTH_ENABLED: 'true',
      },
    });

    expect(status).toMatchObject({
      ok: false,
      auth_mode: 'token',
      auth_source: 'env',
      status: 'not_logged_in',
      can_auto_use: false,
      failure_reason: 'env_token_missing',
      next_step: expect.stringContaining('Ask the host runtime to inject'),
    });
    expect(status).not.toHaveProperty('token_file');
  });

  test('default logout only unbinds the current project and keeps shared user profiles', async () => {
    const loginProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-login-project-'));
    const secondProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-second-project-'));
    const newProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-new-project-'));
    try {
      const saved = saveTokenSession({
        access_token: 'profile-access-token',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-profile',
        user_id: 'user-profile',
      }, { projectRoot: loginProject, authDir });
      const second = saveTokenSession({
        access_token: 'second-profile-access-token',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-second',
        user_id: 'user-second',
      }, { projectRoot: secondProject, authDir });

      const result = await tokenLogout({ projectRoot: newProject, authDir });
      expect(result).toMatchObject({
        ok: true,
        status: 'project_unbound',
        deleted_profile_count: 0,
        project_unbound: true,
      });
      expect(loadTokenSession({ projectRoot: newProject, authDir })).toBe(null);
      expect(fs.existsSync(getUserProfileFilePath(saved.auth_profile, { authDir }))).toBe(true);
      expect(loadTokenSession({ projectRoot: loginProject, authDir })).toMatchObject({
        auth_profile: saved.auth_profile,
        corp_id: 'corp-profile',
      });
      expect(fs.existsSync(getUserProfileFilePath(second.auth_profile, { authDir }))).toBe(true);
    } finally {
      fs.rmSync(loginProject, { recursive: true, force: true });
      fs.rmSync(secondProject, { recursive: true, force: true });
      fs.rmSync(newProject, { recursive: true, force: true });
    }
  });

  test('logout deletes a shared user profile only when --profile is explicit', async () => {
    const loginProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-login-project-'));
    const newProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-new-project-'));
    try {
      const saved = saveTokenSession({
        access_token: 'profile-access-token',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-profile',
        user_id: 'user-profile',
      }, { projectRoot: loginProject, authDir });

      const result = await tokenLogout({
        projectRoot: newProject,
        authDir,
        authProfile: saved.auth_profile,
      });

      expect(result).toMatchObject({
        ok: true,
        status: 'logged_out',
        auth_profile: saved.auth_profile,
        deleted_profile_count: 1,
        project_unbound: true,
      });
      expect(fs.existsSync(getUserProfileFilePath(saved.auth_profile, { authDir }))).toBe(false);
      expect(loadTokenSession({ projectRoot: newProject, authDir })).toBe(null);
    } finally {
      fs.rmSync(loginProject, { recursive: true, force: true });
      fs.rmSync(newProject, { recursive: true, force: true });
    }
  });

  test('logout --all deletes shared user profiles outside host-injected token mode', async () => {
    const firstProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-login-a-'));
    const secondProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-login-b-'));
    try {
      saveTokenSession({
        access_token: 'profile-access-a',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-a',
        user_id: 'user-a',
      }, { projectRoot: firstProject, authDir });
      saveTokenSession({
        access_token: 'profile-access-b',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-b',
        user_id: 'user-b',
      }, { projectRoot: secondProject, authDir });

      const result = await tokenLogout({
        projectRoot: tmpDir,
        authDir,
        allProfiles: true,
      });

      expect(result).toMatchObject({
        ok: true,
        status: 'logged_out',
        deleted_profile_count: 2,
        project_unbound: true,
      });
      expect(listUserAuthProfiles({ authDir })).toHaveLength(0);
      expect(loadTokenSession({ projectRoot: tmpDir, authDir })).toBe(null);
    } finally {
      fs.rmSync(firstProject, { recursive: true, force: true });
      fs.rmSync(secondProject, { recursive: true, force: true });
    }
  });

  test('host-injected token logout never deletes local user profiles', async () => {
    const loginProject = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-login-project-'));
    try {
      const saved = saveTokenSession({
        access_token: 'profile-access-token',
        base_url: 'https://www.aliwork.com',
        client_id: 'openyida-cli',
        corp_id: 'corp-profile',
        user_id: 'user-profile',
      }, { projectRoot: loginProject, authDir });

      const result = await tokenLogout({
        projectRoot: tmpDir,
        authDir,
        authProfile: saved.auth_profile,
        allProfiles: true,
        env: {
          YIDA_AUTH_ENABLED: 'true',
        },
      });

      expect(result).toMatchObject({
        ok: true,
        status: 'host_injected_noop',
        auth_store: 'host_injected',
      });
      expect(fs.existsSync(getUserProfileFilePath(saved.auth_profile, { authDir }))).toBe(true);
    } finally {
      fs.rmSync(loginProject, { recursive: true, force: true });
    }
  });

  test('本地缺少 refresh token 时使用环境变量刷新并把新 session 落盘', async () => {
    let refreshBody;
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        refreshBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          content: {
            status: 'ok',
            accessToken: 'new-local-access-token',
            refreshToken: 'new-local-refresh-token',
            expiresIn: 1800,
          },
        }));
      });
    });
    const port = await listen(server);

    try {
      saveTokenSession({
        access_token: 'expired-access-token',
        expires_at: Date.now() - 1000,
        base_url: 'https://legacy-corp.example.com',
        client_id: 'suite9xvlxxerybljwheo',
        corp_id: 'corp-local',
        user_id: 'user-local',
      }, { projectRoot: tmpDir, authDir });

      const refreshed = await tokenRefresh({
        projectRoot: tmpDir,
        authDir,
        endpoint: `http://127.0.0.1:${port}`,
        env: {
          OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        },
      });
      expect(refreshBody.refreshToken).toBe('env-refresh-token');
      expect(refreshed.access_token).toBe('new-local-access-token');
      expect(refreshed.auth_store).toBe('user');

      expect(fs.existsSync(getTokenFilePath({ projectRoot: tmpDir }))).toBe(false);
      const saved = JSON.parse(fs.readFileSync(
        getUserProfileFilePath(refreshed.auth_profile, { projectRoot: tmpDir, authDir }),
        'utf8'
      ));
      expect(saved.access_token).toBe('new-local-access-token');
      expect(saved.refresh_token).toBe('new-local-refresh-token');
      expect(saved.base_url).toBe('https://legacy-corp.example.com');
      expect(saved.corp_id).toBe('corp-local');
      expect(saved.user_id).toBe('user-local');
    } finally {
      await closeServer(server);
    }
  });

  test('只有环境 refresh token 时首次获取 access token 会刷新落盘', async () => {
    const previousEnv = {
      access: process.env.OPENYIDA_ACCESS_TOKEN,
      refresh: process.env.OPENYIDA_REFRESH_TOKEN,
      endpoint: process.env.OPENYIDA_ENDPOINT,
      corpId: process.env.OPENYIDA_TOKEN_CORP_ID,
      userId: process.env.OPENYIDA_TOKEN_USER_ID,
    };
    const seenAccessTokens = [];
    const refreshTokensUsed = [];
    let refreshRequestCount = 0;
    const server = http.createServer((req, res) => {
      if (req.url === '/openapi/cli/v1/auth/refresh') {
        refreshRequestCount += 1;
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          refreshTokensUsed.push(
            JSON.parse(Buffer.concat(chunks).toString('utf8')).refreshToken
          );
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            content: {
              status: 'ok',
              accessToken: 'refreshed-access-token',
              refreshToken: 'refreshed-refresh-token',
              expiresIn: 1800,
              base_url: 'https://corp.example.com',
            },
          }));
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    const port = await listen(server);

    try {
      delete process.env.OPENYIDA_ACCESS_TOKEN;
      process.env.OPENYIDA_REFRESH_TOKEN = 'sandbox-refresh-token';
      process.env.OPENYIDA_ENDPOINT = `http://127.0.0.1:${port}`;
      process.env.OPENYIDA_TOKEN_CORP_ID = 'corp-env';
      process.env.OPENYIDA_TOKEN_USER_ID = 'user-env';

      const firstToken = await getAccessToken({ projectRoot: tmpDir });
      seenAccessTokens.push(firstToken);
      const secondToken = await getAccessToken({ projectRoot: tmpDir });
      seenAccessTokens.push(secondToken);
      await tokenRefresh({ projectRoot: tmpDir });

      expect(seenAccessTokens).toEqual([
        'refreshed-access-token',
        'refreshed-access-token',
      ]);
      expect(refreshTokensUsed).toEqual([
        'sandbox-refresh-token',
        'refreshed-refresh-token',
      ]);
      expect(refreshRequestCount).toBe(2);

      const session = loadTokenSession({ projectRoot: tmpDir, authDir });
      const saved = JSON.parse(fs.readFileSync(
        getUserProfileFilePath(session.auth_profile, { projectRoot: tmpDir, authDir }),
        'utf8'
      ));
      expect(fs.existsSync(getTokenFilePath({ projectRoot: tmpDir }))).toBe(false);
      expect(saved.access_token).toBe('refreshed-access-token');
      expect(saved.refresh_token).toBe('refreshed-refresh-token');
      expect(saved.base_url).toBe('https://corp.example.com');
      expect(saved.corp_id).toBe('corp-env');
      expect(saved.user_id).toBe('user-env');
    } finally {
      await closeServer(server);
      const restore = (name, value) => {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      };
      restore('OPENYIDA_ACCESS_TOKEN', previousEnv.access);
      restore('OPENYIDA_REFRESH_TOKEN', previousEnv.refresh);
      restore('OPENYIDA_ENDPOINT', previousEnv.endpoint);
      restore('OPENYIDA_TOKEN_CORP_ID', previousEnv.corpId);
      restore('OPENYIDA_TOKEN_USER_ID', previousEnv.userId);
    }
  });

  test('host-injected token refresh caches only the returned business base_url', async () => {
    let refreshBody;
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        refreshBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          content: {
            status: 'ok',
            accessToken: 'new-env-access-token',
            refreshToken: 'new-env-refresh-token',
            expiresIn: 1800,
            base_url: 'https://customer.example.com/path',
            corp_id: 'corp-env',
            corp_name: '环境组织',
          },
        }));
      });
    });
    const port = await listen(server);
    const env = {
      YIDA_AUTH_ENABLED: 'true',
      OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      OPENYIDA_ENDPOINT: `http://127.0.0.1:${port}`,
      OPENYIDA_TOKEN_CORP_ID: 'corp-env',
    };

    try {
      const refreshed = await tokenRefresh({
        projectRoot: tmpDir,
        authDir,
        endpoint: `http://127.0.0.1:${port}`,
        env,
      });

      expect(refreshBody.refreshToken).toBe('env-refresh-token');
      expect(refreshed).toMatchObject({
        auth_source: 'env',
        access_token: 'new-env-access-token',
        refresh_token: 'new-env-refresh-token',
        corp_name: '环境组织',
      });
      expect(env.OPENYIDA_ACCESS_TOKEN).toBe('new-env-access-token');
      expect(env.OPENYIDA_REFRESH_TOKEN).toBe('new-env-refresh-token');
      expect(fs.existsSync(getTokenFilePath({ projectRoot: tmpDir }))).toBe(false);
      const contextFile = getBusinessContextFilePath({ projectRoot: tmpDir });
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      expect(context).toMatchObject({
        version: 1,
        corp_id: 'corp-env',
        corp_name: '环境组织',
        base_url: 'https://customer.example.com',
      });
      expect(context).not.toHaveProperty('access_token');
      expect(context).not.toHaveProperty('refresh_token');
      expect(loadTokenSession({
        projectRoot: tmpDir,
        authDir,
        env: {
          YIDA_AUTH_ENABLED: 'true',
          OPENYIDA_REFRESH_TOKEN: 'next-process-refresh-token',
          OPENYIDA_ENDPOINT: `http://127.0.0.1:${port}`,
          OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        },
      }).base_url).toBe('https://customer.example.com');
    } finally {
      await closeServer(server);
    }
  });
});
