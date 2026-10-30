'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  exchangeQwenWorkAgentToken,
  getQwenWorkUserInfo,
  getQwenWorkIdentity,
} = require('../lib/auth/qwenwork-client');

const AGENT = 'test-cloud-agent-private-value';
const USER_ID = 'test-qwenwork-user';
const ORG_ID = 'test-qwenwork-org';

function jwt(extra = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({
    sub: USER_ID, user_id: USER_ID, biz_org_id: ORG_ID,
    exp: Math.floor(Date.now() / 1000) + 3600, ...extra,
  })}.test-signature`;
}

function runCli(args, env, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../bin/yida.js'), ...args], {
      cwd,
      env: {
        ...process.env,
        QWENWORK_AGENT_TOKEN: '', MULE_AGENT_TOKEN: '', AGENT_TOKEN: '',
        QWENWORK_GATEWAY_URL: '', MULE_GATEWAY_URL: '',
        QWENWORK_USER_ID: '', MULE_USER_ID: '',
        CI: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1', OPENYIDA_LANG: 'en',
        OPENYIDA_AUTH_DIR: path.join(cwd, 'auth'),
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('QwenWork cloud identity', () => {
  let server;
  let baseUrl;
  let env;
  let state;
  let calls;
  let tempDir;
  let timers;

  beforeEach(async () => {
    calls = [];
    timers = [];
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-qwen-auth-'));
    state = {
      token: jwt(),
      exchangeStatus: 200,
      userStatus: 200,
      user: { user_id: USER_ID, nickname: 'Test User', email: 'person@example.com',
        is_biz: true, biz: { org_id: ORG_ID, org_name: 'Test Organization' } },
    };
    server = http.createServer((req, res) => {
      calls.push({ method: req.method, url: req.url, auth: req.headers.authorization });
      const exchange = req.url === '/api/agent-gw/token/exchange';
      const send = () => {
        if (res.destroyed) {
          return;
        }
        const status = exchange ? state.exchangeStatus : state.userStatus;
        res.writeHead(status, { 'content-type': 'application/json', ...(state.location ? { location: state.location } : {}) });
        if (state.raw !== undefined) {
          res.end(state.raw);
          return;
        }
        res.end(JSON.stringify(exchange
          ? (state.exchangeBody || { token: state.token, scope: 'user:read barn:write', ttl: 21600 })
          : (state.userBody || { code: 'ok', data: state.user })));
      };
      if (state.delay) {
        timers.push(setTimeout(send, state.delay));
      } else {
        send();
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    env = { QWENWORK_AGENT_TOKEN: AGENT, QWENWORK_GATEWAY_URL: baseUrl, QWENWORK_USER_ID: USER_ID };
  });

  afterEach(async () => {
    timers.forEach(clearTimeout);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('exchanges the Agent credential and queries the same-origin identity without persistence', async () => {
    const result = await getQwenWorkIdentity({ env });
    expect(result).toMatchObject({
      credential_source: 'QWENWORK_AGENT_TOKEN', base_url: baseUrl,
      scope: 'user:read barn:write', expires_in: 21600,
      profile: { user_id: USER_ID, biz: { org_id: ORG_ID } },
    });
    expect(result).not.toHaveProperty('access_token');
    expect(calls).toEqual([
      { method: 'POST', url: '/api/agent-gw/token/exchange', auth: `Bearer ${AGENT}` },
      { method: 'GET', url: '/user/info', auth: `Bearer ${state.token}` },
    ]);
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  test('exposes reusable exchange and user-info APIs for the later YiDA adapter', async () => {
    const credential = await exchangeQwenWorkAgentToken({ env });
    expect(credential.access_token).toBe(state.token);
    await expect(getQwenWorkUserInfo(credential, { env })).resolves.toEqual(state.user);
  });

  test.each(['MULE_AGENT_TOKEN', 'AGENT_TOKEN'])('supports legacy %s without treating QWENWORK_TOKEN as a user credential', async name => {
    const legacyEnv = { [name]: AGENT, MULE_GATEWAY_URL: baseUrl, MULE_USER_ID: USER_ID };
    await expect(getQwenWorkIdentity({ env: legacyEnv })).resolves.toMatchObject({ credential_source: name });
    await expect(exchangeQwenWorkAgentToken({ env: { QWENWORK_TOKEN: AGENT } }))
      .rejects.toMatchObject({ code: 'QWENWORK_CREDENTIAL_MISSING' });
  });

  test('prefers canonical injected variables', async () => {
    await getQwenWorkIdentity({ env: { ...env, MULE_AGENT_TOKEN: 'stale-value', MULE_GATEWAY_URL: 'https://invalid.example' } });
    expect(calls[0].auth).toBe(`Bearer ${AGENT}`);
  });

  test('missing gateway and unsafe origins fail before transmitting credentials', async () => {
    await expect(exchangeQwenWorkAgentToken({ env: { QWENWORK_AGENT_TOKEN: AGENT } }))
      .rejects.toMatchObject({ code: 'QWENWORK_GATEWAY_MISSING' });
    for (const gateway of ['http://invalid.example', 'https://name:password@invalid.example', `https://invalid.example/?token=${AGENT}`]) {
      await expect(exchangeQwenWorkAgentToken({ env: { ...env, QWENWORK_GATEWAY_URL: gateway } }))
        .rejects.toMatchObject({ code: 'QWENWORK_INVALID_GATEWAY' });
    }
    expect(calls).toEqual([]);
  });

  test.each([401, 403, 500])('exchange HTTP %s stops the chain without leaking response credentials', async status => {
    state.exchangeStatus = status;
    state.exchangeBody = { message: AGENT, token: state.token };
    let caught;
    try { await getQwenWorkIdentity({ env }); } catch (error) { caught = error; }
    expect(caught).toMatchObject({ code: 'QWENWORK_HTTP_ERROR', details: { stage: 'exchange', status_code: status } });
    expect(JSON.stringify(caught)).not.toContain(AGENT);
    expect(JSON.stringify(caught)).not.toContain(state.token);
    expect(calls).toHaveLength(1);
  });

  test('does not follow redirects with the credential', async () => {
    state.exchangeStatus = 302;
    state.location = '/credential-collector';
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_HTTP_ERROR', details: { status_code: 302 } });
    expect(calls).toHaveLength(1);
  });

  test.each([
    { token: '', scope: 'user:read', ttl: 3600 },
    { token: 'Bearer\nsecret', scope: 'user:read', ttl: 3600 },
    { token: 'value', scope: 'user:read', ttl: -1 },
    { code: 'denied', token: 'value', scope: 'user:read', ttl: 3600 },
  ])('rejects incomplete or failed exchange responses', async body => {
    state.exchangeBody = body;
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_INVALID_RESPONSE' });
    expect(calls).toHaveLength(1);
  });

  test('rejects an already expired exchanged JWT before querying identity', async () => {
    state.token = jwt({ exp: 1 });
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_TOKEN_EXPIRED' });
    expect(calls).toHaveLength(1);
  });

  test('rejects a user-info authentication error or missing identity', async () => {
    state.userStatus = 401;
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_HTTP_ERROR', details: { stage: 'user_info' } });
    state.userStatus = 200;
    state.userBody = { code: 'ok', data: {} };
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_INVALID_RESPONSE' });
  });

  test.each(['environment', 'subject', 'organization'])('rejects mismatched %s identity', async mismatch => {
    if (mismatch === 'environment') { env.QWENWORK_USER_ID = 'other-user'; }
    if (mismatch === 'subject') { state.token = jwt({ sub: 'other-user' }); }
    if (mismatch === 'organization') { state.user.biz.org_id = 'other-org'; }
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_IDENTITY_MISMATCH' });
  });

  test('bounds request duration and response size and rejects non-JSON responses', async () => {
    state.delay = 100;
    await expect(getQwenWorkIdentity({ env, timeoutMs: 10 })).rejects.toMatchObject({ code: 'QWENWORK_TIMEOUT' });
    state.delay = 0;
    state.raw = 'x'.repeat(1024 * 1024 + 1);
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_RESPONSE_TOO_LARGE' });
    state.raw = '<html>not JSON</html>';
    await expect(getQwenWorkIdentity({ env })).rejects.toMatchObject({ code: 'QWENWORK_INVALID_RESPONSE' });
  });

  test('CLI queries identity without YiDA login, hides tokens and does not create a profile', async () => {
    state.user.access_token = state.token;
    const result = await runCli(['auth', 'qwenwork', 'user-info', '--json'], env, tempDir);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true, provider: 'qwenwork', yida_session_created: false,
      user: { user_id: USER_ID, is_biz: true, biz_org_id: ORG_ID, email: 'p***@example.com' },
    });
    expect(result.stdout).not.toContain(AGENT);
    expect(result.stdout).not.toContain(state.token);
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  test('CLI errors never echo upstream secrets and invalid arguments make no request', async () => {
    state.exchangeStatus = 401;
    state.exchangeBody = { message: AGENT, token: state.token };
    const result = await runCli(['auth', 'qwenwork', 'user-info', '--json'], env, tempDir);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ errorCode: 'QWENWORK_HTTP_ERROR', stage: 'exchange' });
    expect(result.stderr).not.toContain(AGENT);
    expect(result.stderr).not.toContain(state.token);
    const previousCount = calls.length;
    const badArgs = await runCli(['auth', 'qwenwork', 'user-info', '--token', AGENT, '--json'], env, tempDir);
    expect(badArgs.code).toBe(2);
    expect(badArgs.stderr).not.toContain(AGENT);
    expect(calls).toHaveLength(previousCount);
  });

  test('CLI help requires no cloud credentials and makes no authentication request', async () => {
    const result = await runCli(['auth', 'qwenwork', '--help'], {}, tempDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('openyida auth qwenwork user-info [--json]');
    expect(calls).toEqual([]);
  });

  test('managed YiDA tasks cannot exchange a separate QwenWork identity', async () => {
    const result = await runCli(['auth', 'qwenwork', 'user-info', '--json'], {
      ...env,
      OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND',
      OPENYIDA_AGENT_CORP_ID: 'test-corp', OPENYIDA_AGENT_USER_ID: 'test-user',
      OPENYIDA_AGENT_RUN_ID: 'test-run', OPENYIDA_AGENT_ATTEMPT_ID: 'test-attempt',
      OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test',
      OPENYIDA_AGENT_TASK_GRANT: 'test-grant-private-value',
    }, tempDir);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ errorCode: 'MANAGED_COMMAND_UNSUPPORTED' });
    expect(result.stderr).not.toContain(AGENT);
    expect(calls).toEqual([]);
  });
});
