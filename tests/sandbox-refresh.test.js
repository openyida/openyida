'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { getAccessToken, tokenRefresh } = require('../lib/auth/token-auth');
const { getBusinessContextFilePath, getSandboxTokenFilePath } = require('../lib/auth/token-store');
const { ensureQwenWorkLogin } = require('../lib/auth/qwenwork-login');
const { createYidaClient } = require('../lib/core/yida-client');
const { httpGet, httpPost, requestNonIdempotentWithAuthPreflight } = require('../lib/core/utils');

const OLD_ACCESS = 'fixture-old-access';
const OLD_REFRESH = 'fixture_private_refresh_token';
const NEW_ACCESS = 'fixture-new-access';
const NEW_REFRESH = 'fixture-new-refresh';
const REFRESH_PATH = '/openapi/cli/v1/auth/refresh';
const READ_PATHS = ['/form/list', '/process/binding'];

function reply(response, status, payload, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(payload));
}

function replyToken(response, accessToken = NEW_ACCESS) {
  reply(response, 200, {
    success: true,
    content: { accessToken, refreshToken: NEW_REFRESH },
  });
}

describe('cloud sandbox token refresh', () => {
  let projectRoot;
  let server;
  let refreshTokens;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-sandbox-refresh-'));
    refreshTokens = [];
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
      server = undefined;
    }
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  async function startServer({ onRead, onRefresh = replyToken, onRetry, accessToken = OLD_ACCESS }) {
    server = http.createServer((request, response) => {
      const requestPath = new URL(request.url, 'http://localhost').pathname;
      if (request.method !== 'POST' || requestPath !== REFRESH_PATH) {
        onRead(request, response, requestPath);
        return;
      }
      let body = '';
      request.setEncoding('utf8');
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        refreshTokens.push(JSON.parse(body).refreshToken);
        if (refreshTokens.length === 1) {
          onRefresh(response);
        } else if (onRetry) {
          onRetry(response);
        } else {
          reply(response, 400, { status: 'invalid_refresh_token' });
        }
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    jest.replaceProperty(process, 'env', {
      ...process.env,
      OPENYIDA_AGENT_TASK_GRANT: '',
      OPENYIDA_AUTH_DIR: path.join(projectRoot, 'auth'),
      OPENYIDA_AUTH_MODE: 'token',
      OPENYIDA_ENDPOINT: baseUrl,
      OPENYIDA_ENV: 'public',
      OPENYIDA_SANDBOX_BINDING_ID: 'fixture-sandbox-binding',
      OPENYIDA_ACCESS_TOKEN: accessToken,
      OPENYIDA_REFRESH_TOKEN: OLD_REFRESH,
      OPENYIDA_TOKEN_CORP_ID: 'fixture-corp',
      OPENYIDA_TOKEN_USER_ID: 'fixture-user',
    });
    const client = createYidaClient({ authRef: { baseUrl } });
    return (requestPath, query) => client.get(
      requestPath, query, { projectRoot, silentStatus: true, timeout: 3000 }
    );
  }

  test.each([
    { secondStatus: 401, refreshedAccess: NEW_ACCESS, lateChallenge: false },
    { secondStatus: 200, refreshedAccess: NEW_ACCESS, lateChallenge: true },
    { secondStatus: 401, refreshedAccess: OLD_ACCESS, lateChallenge: true },
  ])('coalesces parallel rejected reads (second HTTP $secondStatus, late challenge $lateChallenge, refreshed access $refreshedAccess)', async ({
    secondStatus, refreshedAccess, lateChallenge,
  }) => {
    const initialResponses = new Map();
    const observedHeaders = new Map(READ_PATHS.map(requestPath => [requestPath, []]));
    const rejectSecondRequest = () => {
      reply(initialResponses.get(READ_PATHS[1]), secondStatus, {
        success: false,
        errorCode: 'expired_access_token',
      });
    };
    const get = await startServer({
      onRefresh: response => replyToken(response, refreshedAccess),
      onRead(request, response, requestPath) {
        const headers = observedHeaders.get(requestPath);
        headers.push(request.headers.authorization);
        if (headers.length === 1) {
          initialResponses.set(requestPath, response);
          if (initialResponses.size === READ_PATHS.length) {
            reply(initialResponses.get(READ_PATHS[0]), 401, { errorCode: 'invalid_access_token' });
            if (!lateChallenge) {rejectSecondRequest();}
          }
          return;
        }
        if (lateChallenge && requestPath === READ_PATHS[0] && headers.length === 2) {
          // Both original requests used the old session, but the second rejects
          // it only after the first request has retried with the rotated session.
          rejectSecondRequest();
        }
        reply(response, 200, { success: true, content: requestPath });
      },
    });

    await expect(Promise.all(READ_PATHS.map(requestPath => get(requestPath))))
      .resolves.toEqual(READ_PATHS.map(requestPath => ({ success: true, content: requestPath })));
    expect(refreshTokens).toEqual([OLD_REFRESH]);
    for (const headers of observedHeaders.values()) {
      expect(headers).toEqual([`Bearer ${OLD_ACCESS}`, `Bearer ${refreshedAccess}`]);
    }
  });

  test('parallel callers without an access token use the same initial exchange', async () => {
    await startServer({
      accessToken: '',
      onRead: (_request, response) => reply(response, 404, {}),
    });

    await expect(Promise.all([getAccessToken({ projectRoot }), getAccessToken({ projectRoot })]))
      .resolves.toEqual([NEW_ACCESS, NEW_ACCESS]);
    expect(refreshTokens).toEqual([OLD_REFRESH]);
  });

  test.each([
    [200, 'invalid_refresh_token', 'TOKEN_AUTH_REQUIRED'],
    [400, 'invalid_refresh_token', 'TOKEN_AUTH_REQUIRED'],
    [503, 'service_unavailable', 'TOKEN_REFRESH_FAILED'],
  ])('keeps the rejected request and refresh status for a failed exchange (HTTP %i)', async (
    refreshHttpStatus, refreshErrorCode, errorCode
  ) => {
    const secret = 'fixture-private-upstream-diagnostic';
    let reads = 0;
    const get = await startServer({
      onRead: (_request, response) => {
        reads += 1;
        reply(response, 401, { message: secret }, { Location: `/private?value=${secret}` });
      },
      onRefresh: response => reply(response, refreshHttpStatus,
        { status: refreshErrorCode, errorCode: 'exchange_failed', message: secret },
        { 'X-Private-Diagnostic': secret }),
    });

    const result = await get('/form/list', { private: secret });
    expect(result).toMatchObject({
      success: false,
      errorCode,
      details: { requestPath: '/form/list', httpStatus: 401, refreshHttpStatus, refreshErrorCode },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(OLD_ACCESS);
    expect(JSON.stringify(result)).not.toContain(OLD_REFRESH);
    expect(refreshTokens).toEqual([OLD_REFRESH]);
    expect(reads).toBe(1);
  });

  test('explicit refresh errors keep the status without exposing the response', async () => {
    const secret = 'fixture-private-upstream-diagnostic';
    await startServer({
      onRead: (_request, response) => reply(response, 404, {}),
      onRefresh: response => reply(response, 503, { errorCode: 'service_unavailable', message: secret }),
    });
    const result = await tokenRefresh({ projectRoot }).catch(error => error);
    expect(result).toMatchObject({
      code: 'TOKEN_REFRESH_FAILED',
      message: expect.stringContaining('token_refresh_failed'),
      details: { refreshFailure: { refreshPath: REFRESH_PATH, refreshHttpStatus: 503, refreshErrorCode: 'service_unavailable' } },
    });
    expect(result.message).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test('rejects error codes that contain the refresh credential', async () => {
    const get = await startServer({
      onRead: (_request, response) => reply(response, 401, {}),
      onRefresh: response => reply(response, 503, { errorCode: OLD_REFRESH, error: OLD_REFRESH }),
    });
    const result = await get('/form/list');
    expect(result.details).toMatchObject({ refreshHttpStatus: 503 });
    expect(result.details).not.toHaveProperty('refreshErrorCode');
    expect(JSON.stringify(result)).not.toContain(OLD_REFRESH);
  });

  test.each(['corpId', 'userId'])('rejects a changed %s before updating the sandbox session', async identityField => {
    const get = await startServer({
      onRead: (_request, response) => reply(response, 401, {}),
      onRefresh: response => reply(response, 200, {
        status: 'ok', accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH,
        baseUrl: 'https://different.example.test', [identityField]: 'different-identity',
      }),
    });
    const result = await get('/form/list');
    expect(result).toMatchObject({
      errorCode: 'TOKEN_AUTH_REQUIRED',
      details: { httpStatus: 401, refreshHttpStatus: 200, refreshErrorCode: 'sandbox_identity_changed' },
    });
    expect(JSON.stringify(result)).not.toContain('different-identity');
    expect(fs.existsSync(getSandboxTokenFilePath({ projectRoot }))).toBe(false);
    expect(fs.existsSync(getBusinessContextFilePath({ projectRoot }))).toBe(false);
    expect(process.env.OPENYIDA_ACCESS_TOKEN).toBe(OLD_ACCESS);
    expect(process.env.OPENYIDA_REFRESH_TOKEN).toBe(OLD_REFRESH);
    expect(refreshTokens).toEqual([OLD_REFRESH]);
  });

  test('a failed refresh-only write preflight never attempts the write', async () => {
    const requests = [];
    await startServer({
      accessToken: '',
      onRead(request, response) {
        requests.push(request.method);
        reply(response, 200, { success: true });
      },
      onRefresh: response => reply(response, 503, { status: 'service_unavailable' }),
      onRetry: replyToken,
    });
    const options = { projectRoot, silentStatus: true };
    const authRef = { projectRoot, baseUrl: process.env.OPENYIDA_ENDPOINT, authMode: 'token' };
    await expect(requestNonIdempotentWithAuthPreflight(
      ref => httpPost(ref.baseUrl, '/create', '', options),
      ref => httpGet(ref.baseUrl, '/preflight', null, options),
      authRef
    )).rejects.toMatchObject({
      code: 'TOKEN_REFRESH_FAILED',
      details: { refreshFailure: { refreshPath: REFRESH_PATH, refreshHttpStatus: 503, refreshErrorCode: 'service_unavailable' } },
    });
    expect(refreshTokens).toEqual([OLD_REFRESH]);
    expect(requests).toEqual([]);
  });

  test.each(['refresh_timeout', 'refresh_interrupted'])('releases the lock after %s', async refreshErrorCode => {
    await startServer({
      onRead: (_request, response) => reply(response, 404, {}),
      onRefresh(response) {
        if (refreshErrorCode === 'refresh_timeout') {return;}
        response.writeHead(200, { 'Content-Length': '100' });
        response.write('{');
        setTimeout(() => response.destroy(), 10);
      },
    });
    const refresh = () => tokenRefresh({ projectRoot, timeoutMs: 250 }).catch(error => error);
    const [first, second] = await Promise.all([refresh(), refresh()]);
    expect(first.details.refreshFailure.refreshErrorCode).toBe(refreshErrorCode);
    expect(second).toMatchObject({ code: 'TOKEN_AUTH_REQUIRED' });
    expect(refreshTokens).toEqual([OLD_REFRESH, OLD_REFRESH]);
  });

  test('QwenWork env login retains its refresh failure code and safe diagnostics', async () => {
    await startServer({
      onRead: (_request, response) => reply(response, 401, {}),
      onRefresh: response => reply(response, 503, { errorCode: 'service_unavailable' }),
    });
    await expect(ensureQwenWorkLogin({
      projectRoot,
      runtime: { tool: 'qwenwork', subtype: 'qwenwork_web' },
    })).rejects.toMatchObject({
      code: 'QWENWORK_LOGIN_REFRESH_FAILED',
      details: {
        refreshFailure: { refreshPath: REFRESH_PATH, refreshHttpStatus: 503, refreshErrorCode: 'service_unavailable' },
      },
    });
  });
});
