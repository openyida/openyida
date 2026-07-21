'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { getAccessToken, tokenRefresh, tokenStatus } = require('../lib/auth/token-auth');
const { getTokenFilePath, saveTokenSession } = require('../lib/auth/token-store');

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

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-auth-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('本地 access token 即使过期也优先返回，等待业务接口判定', async () => {
    saveTokenSession({
      access_token: 'expired-local-access-token',
      expires_at: Date.now() - 1000,
      base_url: 'https://www.aliwork.com',
    }, { projectRoot: tmpDir });

    await expect(getAccessToken({
      projectRoot: tmpDir,
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
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

  test('host-injected token mode reports env access token status without local token file', () => {
    const status = tokenStatus({
      projectRoot: tmpDir,
      env: {
        YIDA_AUTH_ENABLED: 'true',
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        OPENYIDA_TOKEN_USER_ID: 'user-env',
      },
    });

    expect(status).toMatchObject({
      ok: true,
      auth_mode: 'token',
      auth_source: 'env',
      status: 'ok',
      can_auto_use: true,
      corp_id: 'corp-env',
      user_id: 'user-env',
    });
    expect(status.access_token).toBe('env-...');
    expect(status).not.toHaveProperty('token_file');
  });

  test('host-injected token mode reports env_token_missing when host provides no token', () => {
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
    }, { projectRoot: tmpDir });

    const status = tokenStatus({
      projectRoot: tmpDir,
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
    });
    expect(status).not.toHaveProperty('token_file');
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
      }, { projectRoot: tmpDir });

      const refreshed = await tokenRefresh({
        projectRoot: tmpDir,
        endpoint: `http://127.0.0.1:${port}`,
        env: {
          OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        },
      });
      expect(refreshBody.refreshToken).toBe('env-refresh-token');
      expect(refreshed.access_token).toBe('new-local-access-token');

      const saved = JSON.parse(fs.readFileSync(getTokenFilePath({ projectRoot: tmpDir }), 'utf8'));
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

      const saved = JSON.parse(fs.readFileSync(getTokenFilePath({ projectRoot: tmpDir }), 'utf8'));
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

  test('host-injected token refresh updates only the provided env object', async () => {
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
          },
        }));
      });
    });
    const port = await listen(server);
    const env = {
      YIDA_AUTH_ENABLED: 'true',
      OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      OPENYIDA_ENDPOINT: `http://127.0.0.1:${port}`,
    };

    try {
      const refreshed = await tokenRefresh({
        projectRoot: tmpDir,
        endpoint: `http://127.0.0.1:${port}`,
        env,
      });

      expect(refreshBody.refreshToken).toBe('env-refresh-token');
      expect(refreshed).toMatchObject({
        auth_source: 'env',
        access_token: 'new-env-access-token',
        refresh_token: 'new-env-refresh-token',
      });
      expect(env.OPENYIDA_ACCESS_TOKEN).toBe('new-env-access-token');
      expect(env.OPENYIDA_REFRESH_TOKEN).toBe('new-env-refresh-token');
      expect(fs.existsSync(getTokenFilePath({ projectRoot: tmpDir }))).toBe(false);
    } finally {
      await closeServer(server);
    }
  });
});
