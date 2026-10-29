'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const { loginQwenWork, TICKET_ENV, TICKET_CONTEXT_ENV } = require('../lib/auth/qwenwork-desktop');
const { loadTokenSession } = require('../lib/auth/token-store');

const TOKEN = 'test-yida-private-credential';
const REFRESH = 'test-yida-private-refresh';
const ROTATED_TOKEN = 'test-yida-rotated-credential';
const ROTATED_REFRESH = 'test-yida-rotated-refresh';
const TICKET = 'test-one-time-exchange-ticket';
const FIXTURE = path.join(__dirname, 'fixtures/qwenwork-desktop-tls');
function listen(server) { return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port))); }
function close(server) { return new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
function run(args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('千问办公专用命令消费一次性票据', () => {
  let directory; let baseUrl; let server; let env; let credential; let context; let requests; let consumed; let expireAccess;
  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ticket-login-'));
    requests = []; consumed = false; expireAccess = false;
    server = https.createServer({ key: fs.readFileSync(path.join(FIXTURE, 'key.pem')), cert: fs.readFileSync(path.join(FIXTURE, 'cert.pem')) }, (req, res) => {
      requests.push({ path: req.url, method: req.method, authorization: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/openapi/cli/v1/auth/qwenwork/desktop/consume') {
        let body = ''; req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          if (req.method !== 'POST' || req.headers.authorization !== `Bearer ${TICKET}` || body !== '{}' || consumed) {
            res.writeHead(401).end(JSON.stringify({ status: 'invalid_exchange_ticket' })); return;
          }
          // 仅模拟服务端原子消费；真实跨实例原子性由后端专项测试和 PRE 验收证明。
          consumed = true;
          res.end(JSON.stringify(credential));
        }); return;
      }
      if (req.url === '/openapi/cli/v1/auth/refresh') {
        let body = ''; req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const value = JSON.parse(body);
          if (value.refreshToken !== REFRESH || value.clientId !== 'suite9xvlxxerybljwheo') {
            res.end(JSON.stringify({ status: 'invalid_refresh_token' })); return;
          }
          res.end(JSON.stringify({ ...credential, access_token: ROTATED_TOKEN, refresh_token: ROTATED_REFRESH, expires_in: 1800 }));
        }); return;
      }
      const acceptedAccess = req.headers.authorization === `Bearer ${ROTATED_TOKEN}` ||
        (!expireAccess && req.headers.authorization === `Bearer ${TOKEN}`);
      if (req.url === '/openapi/cli/v1/auth/status' && acceptedAccess) {
        res.end(JSON.stringify({ status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: 'test-corp', user_id: 'test-user' })); return;
      }
      res.writeHead(401).end(JSON.stringify({ status: 'invalid_access_token' }));
    });
    baseUrl = `https://127.0.0.1:${await listen(server)}`;
    credential = { status: 'ok', auth_mode: 'token', can_auto_use: true, token_type: 'Bearer', access_token: TOKEN,
      credential_source: 'qwenwork_desktop', refresh_token: REFRESH, refresh_token_expires_in: 2592000, client_id: 'suite9xvlxxerybljwheo', exchange_id: 'test-exchange', expires_in: 1740, corp_id: 'test-corp', user_id: 'test-user' };
    context = { expires_at: Date.now() + 300000, base_url: baseUrl, corp_id: 'test-corp', user_id: 'test-user', exchange_id: 'test-exchange' };
    env = { ...process.env, OPENYIDA_AUTH_DIR: path.join(directory, 'auth'), OPENYIDA_ENV: 'public',
      OPENYIDA_ENDPOINT: '', OPENYIDA_AUTH_MODE: '', OPENYIDA_ACCESS_TOKEN: '', OPENYIDA_REFRESH_TOKEN: '',
      OPENYIDA_AUTH_PROFILE: '', OPENYIDA_AUTH_CORP_ID: '', OPENYIDA_AUTH_USER_ID: '',
      OPENYIDA_SKIP_UPDATE_CHECK: '1', OPENYIDA_LANG: 'en', CI: '1',
      NODE_EXTRA_CA_CERTS: path.join(FIXTURE, 'cert.pem'), [TICKET_ENV]: TICKET, [TICKET_CONTEXT_ENV]: JSON.stringify(context),
    };
  });
  afterEach(async () => { await close(server); fs.rmSync(directory, { recursive: true, force: true }); });
  const cli = args => [path.join(__dirname, '../bin/yida.js'), ...args];
  function options(fetch) { return { projectRoot: directory, env, fetch }; }
  function fakeFetch(extra = {}) {
    return jest.fn(async url => Response.json(String(url).endsWith('/consume') ? { ...credential, ...extra } : { status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: 'test-corp', user_id: 'test-user' }));
  }
  test.each([
    { identity_type: 'PERSONAL' },
    { identity_type: 'ORGANIZATION', organization_type: 'QWENWORK' },
    { identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' },
  ])('desktop consumes and saves server classification without ding_uid: %j', async classification => {
    const corpId = classification.organization_type === 'DINGTALK' ? 'ding0123456789abcdef0123456789abcdef' : 'yida0123456789abcdef0123456789abcdef';
    context.corp_id = corpId; env[TICKET_CONTEXT_ENV] = JSON.stringify(context);
    Object.assign(credential, classification, { corp_id: corpId });
    const fetch = jest.fn(async url => Response.json(String(url).endsWith('/consume') ? credential : {
      status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: corpId, user_id: 'test-user', ...classification,
    }));
    await expect(loginQwenWork(options(fetch))).resolves.toMatchObject({ ok: true, ...classification });
    expect(loadTokenSession(options())).toMatchObject({ ...classification, corp_id: corpId, refresh_token: REFRESH });
    expect(loadTokenSession(options())).not.toHaveProperty('ding_uid');
  });
  test('真实专用 CLI 在沙箱侧 HTTPS 消费并持久化，新进程不注入仍访问原 origin', async () => {
    const login = await run(cli(['login-qwenwork', '--json']), directory, env);
    expect(login.code).toBe(0);
    expect(JSON.parse(login.stdout.trim())).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK', next_action: 'continue_business_operation_silently', user_visible: false });
    for (const detail of [baseUrl, 'test-corp', 'test-user', 'expires_at', 'auth_profile']) { expect(login.stdout + login.stderr).not.toContain(detail); }
    expect(login.stdout + login.stderr).not.toContain(TOKEN); expect(login.stdout + login.stderr).not.toContain(TICKET);
    const nextEnv = { ...env }; delete nextEnv[TICKET_ENV]; delete nextEnv[TICKET_CONTEXT_ENV];
    const script = `const { loadAuthData, httpGet } = require(${JSON.stringify(path.join(__dirname, '../lib/core/utils'))}); (async () => { const auth = loadAuthData(); const result = await httpGet(auth.base_url, '/openapi/cli/v1/auth/status', {}, { silentStatus: true }); console.log(JSON.stringify({ base_url: auth.base_url, result })); })().catch(() => process.exit(1));`;
    const next = await run(['-e', script], directory, nextEnv);
    expect(next.code).toBe(0);
    expect(JSON.parse(next.stdout.trim())).toMatchObject({ base_url: baseUrl, result: { status: 'ok', corp_id: 'test-corp', user_id: 'test-user' } });
    expect(requests).toEqual([
      { path: '/openapi/cli/v1/auth/qwenwork/desktop/consume', method: 'POST', authorization: `Bearer ${TICKET}` },
      { path: '/openapi/cli/v1/auth/status', method: 'GET', authorization: `Bearer ${TOKEN}` },
      { path: '/openapi/cli/v1/auth/status', method: 'GET', authorization: `Bearer ${TOKEN}` },
    ]);
    expect(next.stdout + next.stderr).not.toContain(TOKEN);
    const restored = loadTokenSession({ ...options(), env: nextEnv });
    expect(restored).toMatchObject({ base_url: baseUrl, credential_source: 'qwenwork_desktop', refresh_token: REFRESH });
    expect(restored.expires_at).toBeLessThanOrEqual(Date.now() + 1740000);
    for (const file of fs.readdirSync(path.join(directory, 'auth/profiles'))) {
      expect(fs.readFileSync(path.join(directory, 'auth/profiles', file), 'utf8')).not.toContain(TICKET);
    }
  });
  test('真实桌面 CLI 在原 origin 消费票据，后续校验、新进程和刷新使用返回业务域名', async () => {
    const targetCalls = [];
    const target = https.createServer({ key: fs.readFileSync(path.join(FIXTURE, 'key.pem')), cert: fs.readFileSync(path.join(FIXTURE, 'cert.pem')) }, (req, res) => {
      targetCalls.push({ path: req.url, authorization: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/openapi/cli/v1/auth/refresh') {
        let body='';req.on('data',chunk=>{body+=chunk;});req.on('end',()=>{
          if (JSON.parse(body).refreshToken !== REFRESH) { res.writeHead(401).end('{}'); return; }
          res.end(JSON.stringify({ ...credential, access_token: ROTATED_TOKEN, refresh_token: ROTATED_REFRESH, expires_in: 1800 }));
        });return;
      }
      if (req.url === '/openapi/cli/v1/auth/status' && (req.headers.authorization === `Bearer ${ROTATED_TOKEN}` || (!expireAccess && req.headers.authorization === `Bearer ${TOKEN}`))) {
        res.end(JSON.stringify({ status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: 'test-corp', user_id: 'test-user' }));return;
      }
      res.writeHead(401).end('{}');
    });
    const targetBase = `https://127.0.0.1:${await listen(target)}`; credential.base_url = targetBase;
    try {
      const login = await run(cli(['login-qwenwork', '--json']), directory, env); expect(login.code).toBe(0);
      expect(requests.map(value=>value.path)).toEqual(['/openapi/cli/v1/auth/qwenwork/desktop/consume']);
      expect(loadTokenSession(options())).toMatchObject({ base_url: targetBase });
      expireAccess = true; const nextEnv={ ...env };delete nextEnv[TICKET_ENV];delete nextEnv[TICKET_CONTEXT_ENV];
      const checked=await run(cli(['login', '--qwenwork', '--json']),directory,nextEnv);expect(checked.code).toBe(0);
      expect(targetCalls.map(value=>value.path)).toEqual(['/openapi/cli/v1/auth/status','/openapi/cli/v1/auth/status','/openapi/cli/v1/auth/refresh','/openapi/cli/v1/auth/status']);
      expect(loadTokenSession({ ...options(),env:nextEnv })).toMatchObject({ base_url: targetBase,access_token:ROTATED_TOKEN });
      for(const secret of [TOKEN,REFRESH,ROTATED_TOKEN,ROTATED_REFRESH,TICKET]) { expect(login.stdout+login.stderr+checked.stdout+checked.stderr).not.toContain(secret); }
    } finally { await close(target); }
  });
  test.each(['http://host.test','https://name:secret@host.test','https://host.test/path','https://host.test?secret=x','',null])('消费响应中的非法业务域名不发校验请求、不落盘：%s', async base => {
    const fetch=fakeFetch({ base_url:base });await expect(loginQwenWork(options(fetch))).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);expect(loadTokenSession(options())).toBeNull();
  });
  test('新进程遇到失效 access_token 自动刷新并轮换双 Token，无需再次桌面换票', async () => {
    expect((await run(cli(['login-qwenwork', '--json']), directory, env)).code).toBe(0);
    expireAccess = true;
    const nextEnv = { ...env }; delete nextEnv[TICKET_ENV]; delete nextEnv[TICKET_CONTEXT_ENV];
    const script = `const { loadAuthData, httpGet, requestWithAutoLogin } = require(${JSON.stringify(path.join(__dirname, '../lib/core/utils'))}); (async () => { const auth = loadAuthData(); const ref = { baseUrl: auth.base_url, authData: auth }; const result = await requestWithAutoLogin(current => httpGet(current.baseUrl, '/openapi/cli/v1/auth/status', {}, { silentStatus: true }), ref); console.log(JSON.stringify({ ok: result.status === 'ok' })); })().catch(() => process.exit(1));`;
    const next = await run(['-e', script], directory, nextEnv);
    expect(next.code).toBe(0); expect(JSON.parse(next.stdout.trim())).toEqual({ ok: true });
    expect(requests.filter(value => value.path.endsWith('/consume'))).toHaveLength(1);
    expect(requests.filter(value => value.path.endsWith('/refresh'))).toHaveLength(1);
    expect(requests.at(-1).authorization).toBe(`Bearer ${ROTATED_TOKEN}`);
    expect(loadTokenSession({ ...options(), env: nextEnv })).toMatchObject({
      base_url: baseUrl, access_token: ROTATED_TOKEN, refresh_token: ROTATED_REFRESH, credential_source: 'qwenwork_desktop',
    });
    for (const secret of [TOKEN, REFRESH, ROTATED_TOKEN, ROTATED_REFRESH, TICKET]) {
      expect(next.stdout + next.stderr).not.toContain(secret);
    }
  });
  test.each([{ args: [] }, { args: ['--quiet'] }, { args: ['--json', '--quiet'] }])('普通或静默调用成功后无任何输出：%j', async ({ args }) => {
    const result = await run(cli(['login-qwenwork', ...args]), directory, env);
    expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(loadTokenSession(options())).toMatchObject({ base_url: baseUrl, credential_source: 'qwenwork_desktop' });
  });
  test('帮助返回独立调用契约且不消费票据', async () => {
    const result = await run(cli(['login-qwenwork', '--help', '--json']), directory, env);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).invocation).toMatchObject({ execution: 'command', preserve_command_verbatim: true, success_next_step: 'continue_business_operation_silently', failure_next_step: 'follow_returned_invocation_guidance' });
    expect(requests).toHaveLength(0); expect(loadTokenSession(options())).toBeNull();
  });
  test('缺票据错误返回推荐调用和内部处理指引', async () => {
    delete env[TICKET_ENV]; delete env[TICKET_CONTEXT_ENV];
    const result = await run(cli(['login-qwenwork', '--json']), directory, env);
    expect(result.code).not.toBe(0);
    const payload = JSON.parse(result.stderr);
    expect(payload.details.invocation).toMatchObject({ command: 'openyida login --qwenwork --json', preserve_command_verbatim: true, output_visibility: 'internal', failure_next_step: 'follow_returned_invocation_guidance' });
    for (const value of [TOKEN, TICKET, 'test-corp', 'test-user']) { expect(result.stdout + result.stderr).not.toContain(value); }
    expect(requests).toHaveLength(0);
  });
  test('专用入口不经过可能重启命令的自更新链路', async () => {
    const preload = path.join(directory, 'forbid-update.cjs');
    const updateModule = require.resolve('../lib/core/update');
    fs.writeFileSync(preload, `require.cache[${JSON.stringify(updateModule)}] = { id: ${JSON.stringify(updateModule)}, filename: ${JSON.stringify(updateModule)}, loaded: true, exports: { maybeAutoUpdate() { throw new Error('UPDATE_MUST_NOT_RUN'); } } };`);
    const result = await run(['--require', preload, ...cli(['login-qwenwork', '--json'])], directory, { ...env, OPENYIDA_SKIP_UPDATE_CHECK: '0' });
    expect(result.code).toBe(0); expect(JSON.parse(result.stdout.trim()).ok).toBe(true);
    expect(requests.filter(request => request.path.endsWith('/consume'))).toHaveLength(1);
  });
  test('并发启动两个真实 CLI 消费同一票据，最多一个成功', async () => {
    const results = await Promise.all([run(cli(['login-qwenwork', '--json']), directory, env), run(cli(['login-qwenwork', '--json']), directory, env)]);
    expect(results.filter(result => result.code === 0)).toHaveLength(1);
    expect(requests.filter(request => request.path.endsWith('/consume'))).toHaveLength(2);
    expect(requests.filter(request => request.path.endsWith('/status'))).toHaveLength(1);
    for (const result of results) { expect(result.stdout + result.stderr).not.toContain(TOKEN); expect(result.stdout + result.stderr).not.toContain(TICKET); }
  });
  test('不存在的票据经消费接口拒绝，不重试或保存登录态', async () => {
    env[TICKET_ENV] = 'unknown-synthetic-ticket';
    const result = await run(cli(['login-qwenwork', '--json']), directory, env);
    expect(result.code).not.toBe(0); expect(requests).toHaveLength(1); expect(loadTokenSession(options())).toBeNull();
  });
  test('已消费票据重放失败，不重试、不回退直接凭据', async () => {
    consumed = true;
    const result = await run(cli(['login-qwenwork', '--json']), directory, env);
    expect(result.code).not.toBe(0); expect(requests).toHaveLength(1); expect(loadTokenSession(options())).toBeNull();
  });
  test.each([{ expires_in: 0 }, { corp_id: 'other' }, { token_type: 'exchange_ticket' }, { access_token: '' }, { refresh_token: '' }, { refresh_token: 'invalid whitespace' }, { refresh_token_expires_in: 0 }, { refresh_token: undefined }, { exchange_id: 'other' }])('非法消费响应不落盘：%j', async extra => {
    await expect(loginQwenWork(options(fakeFetch(extra)))).rejects.toThrow(); expect(loadTokenSession(options())).toBeNull();
  });
  test('公开命令只检查真实登录态，不消费任何注入票据', async () => {
    const result = await run(cli(['login', '--qwenwork', '--check-only', '--json']), directory, env);
    expect(result.code).toBe(1); expect(JSON.parse(result.stdout)).toEqual({ ok: false, status: 'not_logged_in', can_auto_use: false });
    expect(requests).toHaveLength(0);
  });
  test('内部参数换票后，公开命令在无票据的新进程检查成功并刷新失效凭据', async () => {
    const clean = { ...env }; delete clean[TICKET_ENV]; delete clean[TICKET_CONTEXT_ENV];
    const internal = await run(cli(['login-qwenwork', '--exchange-ticket', TICKET, '--ticket-context', JSON.stringify(context), '--json']), directory, clean);
    expect(internal.code).toBe(0);
    for (const expired of [false, true]) {
      expireAccess = expired;
      const checked = await run(cli(['login', '--qwenwork', '--json']), directory, clean);
      expect(checked.code).toBe(0); expect(JSON.parse(checked.stdout)).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
      for (const secret of [TOKEN, REFRESH, TICKET, ROTATED_TOKEN, ROTATED_REFRESH, 'test-corp', 'test-user']) {
        expect(checked.stdout + checked.stderr).not.toContain(secret);
      }
    }
    expect(requests.filter(request => request.path.endsWith('/consume'))).toHaveLength(1);
    expect(requests.filter(request => request.path.endsWith('/refresh'))).toHaveLength(1);
  });
  test('专用命令拒绝普通 login 的选项', async () => {
    const result = await run(cli(['login-qwenwork', '--no-browser', '--json']), directory, env);
    expect(result.code).toBe(2); expect(requests).toHaveLength(0);
  });
  test('缺票据时失败，旧凭据通道不能替代票据', async () => {
    delete env[TICKET_ENV]; env.OPENYIDA_QWENWORK_HANDOFF_TOKEN = JSON.stringify({ access_token: TOKEN });
    await expect(loginQwenWork(options(fakeFetch()))).rejects.toMatchObject({ code: 'QWENWORK_DESKTOP_TICKET_MISSING_OR_INVALID' });
  });
  test('过期票据不发起消费请求', async () => {
    env[TICKET_CONTEXT_ENV] = JSON.stringify({ ...context, expires_at: Date.now() - 1 });
    const fetch = fakeFetch(); await expect(loginQwenWork(options(fetch))).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
  test('失败响应和网络异常不回显票据或真实 token', async () => {
    await expect(loginQwenWork(options(async () => { throw new Error(`${TOKEN} ${TICKET}`); }))).rejects.toMatchObject({ code: 'QWENWORK_DESKTOP_REQUEST_FAILED' });
    expect(loadTokenSession(options())).toBeNull();
  });
  test('消费存储不可用时失败关闭，不重试或改用其他登录模式', async () => {
    const fetch = jest.fn(async () => new Response(TOKEN, { status: 503 }));
    await expect(loginQwenWork(options(fetch))).rejects.toMatchObject({ code: 'QWENWORK_DESKTOP_REQUEST_REJECTED' });
    expect(fetch).toHaveBeenCalledTimes(1); expect(loadTokenSession(options())).toBeNull();
  });
  test('endpoint 不匹配时不把票据发送到其他 origin', async () => {
    const fetch = fakeFetch(); await expect(loginQwenWork({ ...options(fetch), endpoint: 'https://other.example' })).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
});
