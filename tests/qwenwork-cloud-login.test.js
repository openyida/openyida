'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { ensureQwenWorkLogin } = require('../lib/auth/qwenwork-login');
const { loadTokenSession } = require('../lib/auth/token-store');
const AGENT = 'fixture-cloud-agent-secret';
const YIDA = 'fixture-yida-secret';
const USER = 'fixture-qwen-user';
const CORP = 'ding0123456789abcdef0123456789abcdef';
const ODS = 'yida0123456789abcdef0123456789abcdef';
const REFRESH = 'fixture-yida-private-refresh';
const QWEN = [ { alg: 'HS256' }, { sub: USER, user_id: USER, biz_org_id: 'qwen-org', exp: Math.floor(Date.now() / 1000) + 3600 } ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.signature';
function session() { return { status: 'ok', auth_mode: 'token', can_auto_use: true, token_type: 'Bearer', credential_source: 'qwenwork_cloud', access_token: YIDA, expires_in: 300, corp_id: CORP, user_id: 'yida-user' }; }
function status() { return { status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: CORP, user_id: 'yida-user' }; }
function environment(root, base) { return { QWENWORK_SANDBOX_ID: 'sandbox-fixture', QWENWORK_AGENT_TOKEN: AGENT, QWENWORK_GATEWAY_URL: base, QWENWORK_USER_ID: USER, OPENYIDA_ENDPOINT: base, OPENYIDA_AUTH_DIR: path.join(root, 'auth') }; }
function run(args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../bin/yida.js'), ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', v => { stdout += v; }); child.stderr.on('data', v => { stderr += v; });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('千问办公网页态云端免登', () => {
  let root; let options; let state; let fetch; let original;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwenwork-cloud-login-'));
    options = { projectRoot: root, env: environment(root, 'https://gateway.example.test'), endpoint: 'https://yida.example.test' };
    state = { response: session(), yidaStatus: 200, status: 200 };
    original = globalThis.fetch;
    fetch = jest.fn(async (url, init) => {
      const p = new URL(url).pathname;
      if (p === '/openapi/cli/v1/auth/qwenwork/token') {
        if (state.throwRequest) { throw new Error(AGENT + QWEN); }
        if (state.hang) { return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error(QWEN)), { once: true })); }
        return Response.json(state.response, { status: state.yidaStatus });
      }
      if (p === '/openapi/cli/v1/auth/status') { return Response.json({ ...status(), ...(state.identity || {}) }, { status: state.status }); }
      throw new Error('unexpected request');
    });
    globalThis.fetch = fetch;
  });
  afterEach(() => { globalThis.fetch = original; fs.rmSync(root, { recursive: true, force: true }); });
  test('兑换当前千问身份并校验宜搭身份后只保存宜搭会话', async () => {
    const oauth = jest.fn();
    expect(await ensureQwenWorkLogin(options, { login: oauth })).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    expect(oauth).not.toHaveBeenCalled();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://yida.example.test/openapi/cli/v1/auth/qwenwork/token', 'https://yida.example.test/openapi/cli/v1/auth/status',
    ]);
    expect(fetch.mock.calls[0][1].headers.authorization).toBe(`Bearer ${AGENT}`);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${AGENT}` }, body: JSON.stringify({ gateway_url: 'https://gateway.example.test' }) });
    expect(loadTokenSession(options)).toMatchObject({ access_token: YIDA, credential_source: 'qwenwork_cloud', base_url: 'https://yida.example.test', corp_id: CORP, user_id: 'yida-user' });
    const read = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? read(path.join(directory, e.name)) : [fs.readFileSync(path.join(directory, e.name), 'utf8')]);
    const stored = read(root).join('');
    expect(stored).not.toContain(AGENT); expect(stored).not.toContain(QWEN);
  });
  test.each(['organization-user', 'personal-user'])('ODS identity %s is preserved with both tokens and no ding_uid', async userId => {
    Object.assign(state.response, { identity_type: 'ORGANIZATION', organization_type: 'QWENWORK', corp_id: ODS, user_id: userId, refresh_token: REFRESH, refresh_token_expires_in: 2592000,
      client_id: 'suite9xvlxxerybljwheo', user_name: 'ODS user' });
    state.identity = { corp_id: ODS, user_id: userId };
    await expect(ensureQwenWorkLogin(options)).resolves.toMatchObject({ ok: true });
    expect(loadTokenSession(options)).toMatchObject({ corp_id: ODS, user_id: userId, refresh_token: REFRESH, user_name: 'ODS user' });
    expect(loadTokenSession(options)).not.toHaveProperty('ding_uid');
  });
  test('reusing an ODS profile never sends the local tenant as an upstream DingTalk selector', async () => {
    Object.assign(state.response, { corp_id: ODS, refresh_token: REFRESH }); state.identity = { corp_id: ODS };
    await ensureQwenWorkLogin(options);
    const saved = loadTokenSession(options);
    await expect(ensureQwenWorkLogin({ ...options, authProfile: saved.auth_profile })).resolves.toMatchObject({ ok: true });
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ gateway_url: 'https://gateway.example.test' });
    expect(loadTokenSession(options)).toMatchObject({ corp_id: ODS, user_id: saved.user_id });
    state.response.corp_id = 'yidaffffffffffffffffffffffffffffffff';
    await expect(ensureQwenWorkLogin({ ...options, corpId: ODS })).rejects.toMatchObject({
      code: 'QWENWORK_CLOUD_RESPONSE_INVALID', details: { reason: 'corp_id_mismatch' },
    });
    expect(loadTokenSession(options).corp_id).toBe(ODS);
  });
  test.each(['yida', 'yida123', 'yida' + 'g'.repeat(32), 'yida' + '0'.repeat(33), ODS + ' '])('malformed ODS tenant is still rejected: %s', async corpId => {
    state.response.corp_id = corpId;
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ details: { reason: 'corp_id', status_code: 200 } });
    expect(loadTokenSession(options)).toBeNull();
  });
  test.each(['', 'bad token', AGENT, 123])('invalid refresh token cannot be persisted: %s', async token => {
    state.response.refresh_token = token;
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ details: { reason: 'refresh_token' } });
    expect(loadTokenSession(options)).toBeNull();
  });
  test('diagnostic fields cannot echo an opaque token or the host credential', async () => {
    const opaque = 'a'.repeat(64);
    options.env.QWENWORK_AGENT_TOKEN = 'b61957b6-d679-4d93-aa71-33c1ea82797c';
    state.response = { status: opaque, stage: opaque, exchange_id: options.env.QWENWORK_AGENT_TOKEN };
    let error; try { await ensureQwenWorkLogin(options); } catch (e) { error = e; }
    expect(error).toMatchObject({ details: { stage: 'yida_exchange', status_code: 200 } });
    expect(JSON.stringify(error)).not.toContain(opaque);
    expect(JSON.stringify(error)).not.toContain(options.env.QWENWORK_AGENT_TOKEN);
  });
  test.each([200, 403])('exchange failure keeps safe diagnostics for HTTP %s', async http => {
    state.yidaStatus = http;
    const exchangeId = 'b61957b6-d679-4d93-aa71-33c1ea82797c';
    state.response = { status: 'qwen_identity_unmapped', stage: 'qwen_verify', exchange_id: exchangeId,
      access_token: AGENT, refresh_token: REFRESH, message: QWEN, unexpected: YIDA };
    let error; try { await ensureQwenWorkLogin(options); } catch (e) { error = e; }
    expect(error).toMatchObject({ details: { status: 'qwen_identity_unmapped', stage: 'qwen_verify', exchange_id: exchangeId, status_code: http } });
    for (const secret of [AGENT, REFRESH, QWEN, YIDA]) { expect(JSON.stringify(error)).not.toContain(secret); }
    expect(loadTokenSession(options)).toBeNull();
  });
  test.each([{ tool: 'codex', subtype: 'qwenwork_web' }, { tool: 'qwenwork', subtype: 'qwenwork_desktop' }, { tool: 'qwenwork' }, {}])('非网页运行态保留原 OAuth 路径：%j', async runtime => {
    const oauth = jest.fn(async () => ({ access_token: YIDA, base_url: options.endpoint, corp_id: CORP, user_id: 'yida-user' }));
    expect(await ensureQwenWorkLogin({ ...options, runtime }, { login: oauth })).toMatchObject({ ok: true });
    expect(oauth).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/openapi/cli/v1/auth/status');
  });
  test('缺少宿主凭据时停止，不触发 OAuth', async () => {
    delete options.env.QWENWORK_AGENT_TOKEN; const oauth = jest.fn();
    await expect(ensureQwenWorkLogin(options, { login: oauth })).rejects.toMatchObject({ code: 'QWENWORK_CREDENTIAL_MISSING' });
    expect(fetch).not.toHaveBeenCalled(); expect(oauth).not.toHaveBeenCalled();
  });
  test('预检只检查登录态，不兑换凭据、不打开浏览器', async () => {
    expect(await ensureQwenWorkLogin({ ...options, checkOnly: true })).toMatchObject({ ok: false, status: 'not_logged_in' });
    expect(fetch).not.toHaveBeenCalled();
  });
  test('客户端不从千问环境身份字段推导宜搭身份', async () => {
    options.env.QWENWORK_USER_ID = 'different-user';
    expect(await ensureQwenWorkLogin(options)).toMatchObject({ ok: true });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ gateway_url: 'https://gateway.example.test' });
  });
  test('上游拒绝个人身份时不保存会话、不尝试其他身份接口', async () => {
    state.yidaStatus = 403; const oauth = jest.fn();
    await expect(ensureQwenWorkLogin(options, { login: oauth })).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_HTTP_ERROR' });
    expect(loadTokenSession(options)).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1); expect(oauth).not.toHaveBeenCalled();
  });
  test.each(['http://gateway.example.test', 'https://name:secret@gateway.example.test', 'https://gateway.example.test/path', 'https://gateway.example.test?token=secret', 'https://gateway.example.test#fragment'])('不接受非纯 HTTPS 网关 origin：%s', async gateway => {
    options.env.QWENWORK_GATEWAY_URL = gateway;
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_ENDPOINT_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });
  test.each(['a b', 'a' + String.fromCharCode(10) + 'b', 'a'.repeat(4097)])('非法 Agent Token 在请求前拒绝：%s', async token => {
    options.env.QWENWORK_AGENT_TOKEN = token;
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_CREDENTIAL_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });
  test('兼容旧沙箱环境变量且不调用 exchange', async () => {
    delete options.env.QWENWORK_AGENT_TOKEN; delete options.env.QWENWORK_GATEWAY_URL;
    options.env.MULE_AGENT_TOKEN = AGENT; options.env.MULE_GATEWAY_URL = 'https://legacy.example.test';
    expect(await ensureQwenWorkLogin(options)).toMatchObject({ ok: true });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ gateway_url: 'https://legacy.example.test' });
  });
  test.each([302, 400, 401, 403, 429, 503])('HTTP %s 保留固定错误和状态码，不泄露上游正文、不回退 OAuth', async http => {
    state.yidaStatus = http; state.response = { error: AGENT + QWEN + YIDA }; const oauth = jest.fn();
    let error; try { await ensureQwenWorkLogin(options, { login: oauth }); } catch (e) { error = e; }
    expect(error).toMatchObject({ code: 'QWENWORK_CLOUD_HTTP_ERROR', details: { status_code: http } });
    expect(String(error) + JSON.stringify(error)).not.toContain(AGENT);
    expect(String(error) + JSON.stringify(error)).not.toContain(QWEN);
    expect(loadTokenSession(options)).toBeNull(); expect(oauth).not.toHaveBeenCalled();
  });
  test.each([
    { credential_source: 'qwenwork_desktop' }, { expires_in: 0 }, { expires_in: 1801 },
    { user_id: '' }, { corp_id: 'qwen-org' }, { access_token: AGENT }, { exchange_ticket: 'unexpected' },

  ])('拒绝非法或跨环境签发结果：%j', async fields => {
    Object.assign(state.response, fields);
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_RESPONSE_INVALID' });
    expect(loadTokenSession(options)).toBeNull();
  });
  test.each(['refresh_token', 'refreshToken'])('服务端返回 %s 不影响云端免登', async name => {
    state.response[name] = 'fixture-yida-refresh';
    await expect(ensureQwenWorkLogin(options)).resolves.toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(loadTokenSession(options)).toMatchObject({ access_token: YIDA, refresh_token: 'fixture-yida-refresh', credential_source: 'qwenwork_cloud' });
  });
  test.each(['https://pre-yida.mulerun.cn', 'https://group.example.test'])('信任宜搭签发的业务域名并在该域名校验与保存会话：%s', async base => {
    Object.assign(state.response, { base_url: base, corp_id: 'dingd8e1123006514592' });
    state.identity = { corp_id: 'dingd8e1123006514592' };
    await expect(ensureQwenWorkLogin(options)).resolves.toMatchObject({ ok: true });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://yida.example.test/openapi/cli/v1/auth/qwenwork/token', `${base}/openapi/cli/v1/auth/status`,
    ]);
    expect(loadTokenSession(options)).toMatchObject({ base_url: base, corp_id: 'dingd8e1123006514592' });
  });
  test.each(['http://untrusted.test', 'https://name:secret@host.test', 'https://host.test/path', 'https://host.test?token=secret', '', null])('拒绝非纯 HTTPS 的业务域名：%s', async base => {
    state.response.base_url = base;
    await expect(ensureQwenWorkLogin(options)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1); expect(loadTokenSession(options)).toBeNull();
  });
  test('显式组织选择由宜搭校验，客户端也拒绝返回不同组织', async () => {
    options.corpId = 'dingffffffffffffffffffffffffffffffff';
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_RESPONSE_INVALID' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ gateway_url: 'https://gateway.example.test', corp_id: options.corpId });
  });
  test('显式用户选择不能被云端账号静默替换', async () => {
    options.userId = 'another-yida-user';
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_RESPONSE_INVALID' });
    expect(loadTokenSession(options)).toBeNull();
  });
  test('指定不存在的 profile 时不兑换其他身份', async () => {
    options.authProfile = 'missing-profile';
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'AUTH_PROFILE_REQUIRED' });
    expect(fetch).not.toHaveBeenCalled();
  });
  test('最终身份校验失败时不保存会话', async () => {
    state.status = 403;
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_LOGIN_CHECK_FAILED' });
    expect(loadTokenSession(options)).toBeNull();
  });
  test('异常消息不回显凭据', async () => {
    state.throwRequest = true;
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_REQUEST_FAILED' });
  });
  test('签发超时即停止，不自动重试', async () => {
    state.hang = true;
    await expect(ensureQwenWorkLogin({ ...options, timeoutMs: 10 })).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_REQUEST_TIMED_OUT' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test('响应超过限制时停止且不落盘', async () => {
    state.response.extra = 'a'.repeat(65536);
    await expect(ensureQwenWorkLogin(options)).rejects.toMatchObject({ code: 'QWENWORK_CLOUD_RESPONSE_INVALID' });
    expect(loadTokenSession(options)).toBeNull();
  });
  test('网页态注入的宜搭 Token 被拒绝时仍不回退 OAuth', async () => {
    options.env.OPENYIDA_ACCESS_TOKEN = YIDA; options.env.OPENYIDA_ENDPOINT = options.endpoint;
    options.env.OPENYIDA_TOKEN_CORP_ID = CORP; options.env.OPENYIDA_TOKEN_USER_ID = 'yida-user';
    state.status = 401; const oauth = jest.fn();
    await expect(ensureQwenWorkLogin(options, { login: oauth })).rejects.toMatchObject({ code: 'QWENWORK_LOGIN_FAILED' });
    expect(oauth).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  test.each(['token', ''])('已注入宜搭 Token 的模式继续使用原路径：%s', async mode => {
    options.env.OPENYIDA_AUTH_MODE = mode; options.env.OPENYIDA_ACCESS_TOKEN = YIDA; options.env.OPENYIDA_ENDPOINT = options.endpoint;
    options.env.OPENYIDA_TOKEN_CORP_ID = CORP; options.env.OPENYIDA_TOKEN_USER_ID = 'yida-user';
    options.env.OPENYIDA_ACCESS_TOKEN_EXPIRES_IN = '300';
    expect(await ensureQwenWorkLogin(options)).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/openapi/cli/v1/auth/status');
  });
});

describe('真实 CLI 子进程消费网页沙箱凭据', () => {
  let root; let server; let base; let env; let calls; let issuedSession; let expireAccess;
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwenwork-cloud-cli-')); calls = []; issuedSession = session(); expireAccess = false;
    const fixture = path.join(__dirname, 'fixtures/qwenwork-desktop-tls');
    server = https.createServer({ key: fs.readFileSync(path.join(fixture, 'key.pem')), cert: fs.readFileSync(path.join(fixture, 'cert.pem')) }, (req, res) => {
      calls.push(req.url); res.setHeader('Content-Type', 'application/json');
      if (req.url === '/openapi/cli/v1/auth/qwenwork/token') {
        let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
          if (req.headers.authorization !== `Bearer ${AGENT}` || JSON.parse(body).gateway_url !== base) { res.writeHead(400).end('{}'); }
          else { res.end(JSON.stringify(issuedSession)); }
        });
      }
      else if (req.url === '/openapi/cli/v1/auth/refresh') {
        let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
          const request = JSON.parse(body);
          if (request.refreshToken !== REFRESH || request.clientId !== 'suite9xvlxxerybljwheo') { res.writeHead(401).end('{}'); return; }
          issuedSession = { ...issuedSession, access_token: 'fixture-rotated-access', refresh_token: 'fixture-rotated-refresh' };
          res.end(JSON.stringify(issuedSession));
        });
      }
      else if (expireAccess && req.headers.authorization !== `Bearer ${issuedSession.access_token === YIDA ? 'fixture-rotated-access' : issuedSession.access_token}`) {
        res.writeHead(401).end(JSON.stringify({ status: 'invalid_access_token' }));
      }
      else if (req.url === '/openapi/cli/v1/auth/status') { res.end(JSON.stringify({ ...status(), corp_id: issuedSession.corp_id, user_id: issuedSession.user_id, identity_type: issuedSession.identity_type, organization_type: issuedSession.organization_type })); }
      else if (req.url.startsWith('/query/exclusive/queryCorpAppConfig.json')) { res.end(JSON.stringify({ success: true, content: {} })); }
      else if (req.url === '/query/app/registerApp.json') {
        let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
          if (req.headers.authorization !== `Bearer ${issuedSession.access_token}` || !body) { res.writeHead(400).end('{}'); return; }
          res.end(JSON.stringify({ success: true, content: 'APP_ODS_TEST' }));
        });
      }
      else { res.writeHead(404).end('{}'); }
    });
    const port = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
    base = `https://127.0.0.1:${port}`;
    env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('OPENYIDA_') && !k.startsWith('QWENWORK_') && !k.startsWith('MULE_') && k !== 'AGENT_TOKEN'));
    Object.assign(env, environment(root, base), { CI: '1', OPENYIDA_SKIP_UPDATE_CHECK: '1', NODE_EXTRA_CA_CERTS: path.join(fixture, 'cert.pem') });
  });
  afterEach(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); fs.rmSync(root, { recursive: true, force: true }); });
  test.each([['login'], ['login', '--qwenwork'], ['auth', 'login']].map(args => [args]))('%j 都走云端免登，并供新进程复用', async args => {
    const result = await run([...args, '--json'], root, env);
    expect(result).toMatchObject({ code: 0 });
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    for (const secret of [AGENT, QWEN, YIDA]) { expect(result.stdout + result.stderr).not.toContain(secret); }
    expect(calls).toEqual(['/openapi/cli/v1/auth/qwenwork/token', '/openapi/cli/v1/auth/status']);
    const next = await run(['auth', 'status', '--json'], root, env);
    expect(next.code).toBe(0); expect(JSON.parse(next.stdout)).toMatchObject({ can_auto_use: true });
  });
  test('真实 CLI 按返回域名校验，持久化后新进程继续访问同一业务域名', async () => {
    const targetCalls = []; const fixture = path.join(__dirname, 'fixtures/qwenwork-desktop-tls');
    const group = 'dingd8e1123006514592';
    const target = https.createServer({ key: fs.readFileSync(path.join(fixture, 'key.pem')), cert: fs.readFileSync(path.join(fixture, 'cert.pem')) }, (req, res) => {
      targetCalls.push(req.url); res.setHeader('Content-Type', 'application/json');
      if (req.url === '/openapi/cli/v1/auth/status' && req.headers.authorization === `Bearer ${YIDA}`) {
        res.end(JSON.stringify({ ...status(), corp_id: group }));
      } else { res.writeHead(401).end('{}'); }
    });
    await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
    const targetBase = `https://127.0.0.1:${target.address().port}`;
    issuedSession = { ...session(), base_url: targetBase, corp_id: group };
    try {
      const login = await run(['login', '--json'], root, env); expect(login.code).toBe(0);
      const next = await run(['login', '--check-only', '--json'], root, env); expect(next.code).toBe(0);
      expect(JSON.parse(next.stdout)).toMatchObject({ ok: true, can_auto_use: true });
      expect(calls).toEqual(['/openapi/cli/v1/auth/qwenwork/token']);
      expect(targetCalls).toEqual(['/openapi/cli/v1/auth/status', '/openapi/cli/v1/auth/status']);
      expect(loadTokenSession({ projectRoot: root, env })).toMatchObject({ base_url: targetBase, corp_id: group });
      for (const secret of [AGENT, QWEN, YIDA]) { expect(login.stdout + login.stderr + next.stdout + next.stderr).not.toContain(secret); }
    } finally { await new Promise(resolve => { target.close(resolve); target.closeAllConnections(); }); }
  });
  test.each([
    { identity_type: 'PERSONAL' },
    { identity_type: 'ORGANIZATION', organization_type: 'QWENWORK' },
  ])('ODS login, profile reuse, refresh and create-app run across CLI processes: %j', async classification => {
    issuedSession = { ...session(), ...classification, corp_id: ODS, refresh_token: REFRESH, client_id: 'suite9xvlxxerybljwheo' };
    const options = { projectRoot: root, env };
    const login = await run(['login', '--json'], root, env); expect(login.code).toBe(0);
    expect(JSON.parse(login.stdout)).toMatchObject(classification);
    const initial = loadTokenSession(options);
    expect(initial).toMatchObject({ ...classification, corp_id: ODS, refresh_token: REFRESH });
    const reuse = await run(['login', '--profile', initial.auth_profile, '--json'], root, env);
    expect(reuse.code).toBe(0); expect(JSON.parse(reuse.stdout)).toMatchObject(classification);
    const authStatus = await run(['auth', 'status', '--json'], root, env);
    expect(authStatus.code).toBe(0); expect(JSON.parse(authStatus.stdout)).toMatchObject(classification);
    expireAccess = true;
    const created = await run(['create-app', '--name', 'ODS regression app', '--open', 'false'], root, env);
    expect(created.code).toBe(0);
    expect(created.stdout).toContain('APP_ODS_TEST'); expect(created.stdout).toContain(ODS);
    expect(calls).toContain('/openapi/cli/v1/auth/refresh'); expect(calls).toContain('/query/app/registerApp.json');
    expect(loadTokenSession(options)).toMatchObject({ ...classification, corp_id: ODS, access_token: 'fixture-rotated-access', refresh_token: 'fixture-rotated-refresh' });
    for (const secret of [AGENT, REFRESH, YIDA, 'fixture-rotated-access', 'fixture-rotated-refresh']) {
      expect(login.stdout + login.stderr + reuse.stdout + reuse.stderr + created.stdout + created.stderr).not.toContain(secret);
    }
  });
  test('ODS login --json preserves noncredential exchange diagnostics', async () => {
    issuedSession = { status: 'qwen_identity_unmapped', stage: 'qwen_verify', exchange_id: 'b61957b6-d679-4d93-aa71-33c1ea82797c', message: AGENT + REFRESH };
    const result = await run(['login', '--json'], root, env);
    expect(result.code).not.toBe(0);
    const text = (result.stdout + result.stderr).trim();
    expect(text).toContain('qwen_verify'); expect(text).toContain('b61957b6-d679-4d93-aa71-33c1ea82797c');
    expect(text).toContain('status_code'); expect(text).not.toContain(AGENT); expect(text).not.toContain(REFRESH);
  });
  test('能力快照选择云端免登且无浏览器要求', async () => {
    const result = await run(['agent-capabilities', '--summary-json'], root, env);
    const snapshot = JSON.parse(result.stdout);
    expect(snapshot.builder_path.auth.auth_runtime).toBe('qwenwork_cloud_exchange');
    expect(snapshot.builder_path.interactive_login).toMatchObject({ mode: 'cloud_token', browser_owner: 'none', invocation: { required_runtime: { tool: 'qwenwork', subtype: 'qwenwork_web' } } });
    expect(calls).toEqual([]);
  });
});
