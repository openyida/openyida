'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { loadTokenSession } = require('../lib/auth/token-store');
const FIXTURE = path.join(__dirname, 'fixtures/qwenwork-desktop-tls');
const CLI = path.join(__dirname, '../bin/yida.js');
const ACCESS = 'fixture-private-access';
const REFRESH = 'fixture-private-refresh';
let activeInvocation;
function callbackRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
}
function startCli(args, options) {
  const child = spawn(process.execPath, [CLI, ...args], { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = ''; let publish; let fail;
  const ready = new Promise((resolve, reject) => { publish = resolve; fail = reject; });
  // 若测试先在等待退出码，仍然接住提前退出产生的链接等待错误。
  ready.catch(() => {});
  const done = new Promise(resolve => {
    const timer = setTimeout(() => { child.kill(); fail(new Error('OAuth URL was not emitted')); }, 6000);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => {
      stderr += data;
      const match = stderr.match(/Open this URL to login:\s*(https?:\/\/\S+)/);
      if (match) { publish(match[1]); }
    });
    child.once('error', error => { clearTimeout(timer); fail(error); resolve({ code: 1, stdout, stderr }); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      fail(new Error('CLI exited before OAuth authorization'));
      resolve({ code, signal, stdout, stderr });
    });
  });
  activeInvocation = { child, ready, done };
  return activeInvocation;
}

describe('千问办公公开登录复用前台 OAuth 生命周期', () => {
  let directory; let env; let server; let baseUrl; let authUrl;
  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-oauth-link-'));
    authUrl = null;
    server = https.createServer({ key: fs.readFileSync(path.join(FIXTURE, 'key.pem')), cert: fs.readFileSync(path.join(FIXTURE, 'cert.pem')) }, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/openapi/cli/v1/auth/dingtalk/token') {
        let body = ''; req.on('data', data => { body += data; });
        req.on('end', () => {
          const input = JSON.parse(body);
          if (input.code !== 'fixture-code' || input.state !== new URL(authUrl).searchParams.get('state')) {
            res.writeHead(401).end('{}'); return;
          }
          res.end(JSON.stringify({ status: 'ok', access_token: ACCESS, refresh_token: REFRESH, expires_in: 1800,
            client_id: 'suite9xvlxxerybljwheo', corp_id: 'fixture-corp', user_id: 'fixture-user', base_url: baseUrl }));
        }); return;
      }
      if (req.url === '/openapi/cli/v1/auth/status' && req.headers.authorization === `Bearer ${ACCESS}`) {
        res.end(JSON.stringify({ status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: 'fixture-corp', user_id: 'fixture-user' })); return;
      }
      res.writeHead(401).end('{}');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `https://127.0.0.1:${server.address().port}`;
    env = { ...process.env, OPENYIDA_AUTH_DIR: path.join(directory, 'auth'), OPENYIDA_ENDPOINT: baseUrl,
      OPENYIDA_ENV: 'public', OPENYIDA_AUTH_MODE: '', OPENYIDA_ACCESS_TOKEN: '', OPENYIDA_REFRESH_TOKEN: '',
      OPENYIDA_AUTH_PROFILE: '', OPENYIDA_AUTH_CORP_ID: '', OPENYIDA_AUTH_USER_ID: '', OPENYIDA_SKIP_UPDATE_CHECK: '1',
      OPENYIDA_NO_BROWSER: '', OPENYIDA_OAUTH_TIMEOUT_MS: '15000', NODE_EXTRA_CA_CERTS: path.join(FIXTURE, 'cert.pem'), CI: '1' };
  });
  afterEach(async () => {
    if (activeInvocation) {
      if (activeInvocation.child.exitCode === null) { activeInvocation.child.kill(); }
      await activeInvocation.done; activeInvocation = null;
    }
    if (authUrl) {
      const callback = new URL(new URL(authUrl).searchParams.get('redirect_uri'));
      callback.searchParams.set('state', 'invalid-cleanup-state');
      await callbackRequest(callback).catch(() => {});
    }
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  test('CLI 保持运行，用户授权、保存并回查登录态后才返回成功', async () => {
    const invocation = startCli(['login', '--qwenwork', '--json', '--no-browser'], { cwd: directory, env });
    authUrl = await invocation.ready;
    expect(invocation.child.exitCode).toBeNull();
    expect(loadTokenSession({ projectRoot: directory, env })).toBeNull();
    const callback = new URL(new URL(authUrl).searchParams.get('redirect_uri'));
    callback.searchParams.set('state', new URL(authUrl).searchParams.get('state'));
    callback.searchParams.set('code', 'fixture-code');
    expect(await callbackRequest(callback)).toBe(200);
    const result = await invocation.done;
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    expect(result.stdout + result.stderr).not.toMatch(new RegExp(`${ACCESS}|${REFRESH}|fixture-corp|fixture-user`));
    expect(loadTokenSession({ projectRoot: directory, env })).toMatchObject({ access_token: ACCESS, refresh_token: REFRESH });
  });
  test('前台命令被终止后回调端口一并关闭，不遗留后台监听', async () => {
    const invocation = startCli(['login', '--qwenwork', '--json', '--no-browser'], { cwd: directory, env });
    authUrl = await invocation.ready;
    expect(invocation.child.exitCode).toBeNull();
    invocation.child.kill();
    await invocation.done;
    const callback = new URL(new URL(authUrl).searchParams.get('redirect_uri'));
    callback.searchParams.set('state', new URL(authUrl).searchParams.get('state'));
    callback.searchParams.set('code', 'fixture-code');
    await expect(callbackRequest(callback)).rejects.toHaveProperty('code');
    expect(loadTokenSession({ projectRoot: directory, env })).toBeNull();
  });
});
