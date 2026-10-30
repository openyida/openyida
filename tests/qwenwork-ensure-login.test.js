'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path');
const { ensureQwenWorkLogin } = require('../lib/auth/qwenwork-login');
const { saveTokenSession } = require('../lib/auth/token-store');
describe('公开千问办公登录入口', () => {
  let root; let options;
  const session = { access_token: 'test-private-access', refresh_token: 'test-private-refresh', base_url: 'https://pre.example.test',
    client_id: 'suite9xvlxxerybljwheo', corp_id: 'test-corp', user_id: 'test-user', expires_at: Date.now() + 60000 };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwenwork-ensure-'));
    options = { projectRoot: root, env: { OPENYIDA_AUTH_DIR: path.join(root, 'auth'), OPENYIDA_AUTH_MODE: '', OPENYIDA_AUTH_PROFILE: '' }, endpoint: session.base_url,
      fetch: jest.fn(async () => Response.json({ status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: session.corp_id, user_id: session.user_id })) };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  test('没有登录态时等待普通 OAuth 完成并验证身份后才成功', async () => {
    const login = jest.fn(async () => session);
    expect(await ensureQwenWorkLogin(options, { login })).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    expect(login).toHaveBeenCalledTimes(1);
    expect(options.fetch).toHaveBeenCalledTimes(1);
  });
  test('只检查登录态时不触发 OAuth', async () => {
    const login = jest.fn();
    expect(await ensureQwenWorkLogin({ ...options, checkOnly: true }, { login })).toEqual({ ok: false, status: 'not_logged_in', can_auto_use: false });
    expect(login).not.toHaveBeenCalled();
  });
  test('云端环境注入模式缺少凭据时不转成本地 OAuth', async () => {
    const login = jest.fn();
    await expect(ensureQwenWorkLogin({ ...options, env: { ...options.env, OPENYIDA_AUTH_MODE: 'token' } }, { login })).rejects.toMatchObject({ code: 'QWENWORK_LOGIN_FAILED' });
    expect(login).not.toHaveBeenCalled();
  });
  test('已有有效登录态不刷新、不调用 OAuth', async () => {
    saveTokenSession(session, options);
    const login = jest.fn(); const refresh = jest.fn();
    expect((await ensureQwenWorkLogin(options, { login, refresh })).ok).toBe(true);
    expect(login).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
  test('网络异常直接报错，不弹浏览器', async () => {
    saveTokenSession(session, options); options.fetch.mockRejectedValue(new Error('test-private-access'));
    const login = jest.fn();
    await expect(ensureQwenWorkLogin(options, { login })).rejects.toMatchObject({ code: 'QWENWORK_LOGIN_CHECK_FAILED' });
    expect(login).not.toHaveBeenCalled();
  });
  test('刷新凭据明确失效时才回退 OAuth', async () => {
    saveTokenSession(session, options);
    options.fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const refresh = jest.fn(async () => ({ ok: false, status: 'invalid_refresh_token' }));
    const login = jest.fn(async () => session);
    expect(await ensureQwenWorkLogin(options, { refresh, login })).toEqual({ ok: true, status: 'ok', can_auto_use: true, identity_type: 'ORGANIZATION', organization_type: 'DINGTALK' });
    expect(refresh).toHaveBeenCalledTimes(1); expect(login).toHaveBeenCalledTimes(1);
  });
  test('服务端身份不一致不能静默接受或回退另一个账号', async () => {
    saveTokenSession(session, options);
    options.fetch.mockResolvedValue(Response.json({ status: 'ok', auth_mode: 'token', can_auto_use: true, corp_id: 'other', user_id: 'other' }));
    const login = jest.fn();
    await expect(ensureQwenWorkLogin(options, { login })).rejects.toMatchObject({ code: 'QWENWORK_LOGIN_IDENTITY_MISMATCH' });
    expect(login).not.toHaveBeenCalled();
  });
});
