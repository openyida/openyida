'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { run, detectEnvironment, detectLoginStatus, buildEnvironmentSnapshot } = require('../lib/core/env');
const { saveTokenSession } = require('../lib/auth/token-store');

describe('detectEnvironment', () => {
  test('返回对象包含 activeToolName、activeProjectRoot、results 字段', () => {
    const result = detectEnvironment();
    expect(result).toHaveProperty('activeToolName');
    expect(result).toHaveProperty('activeProjectRoot');
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  test('results 中每项包含必要字段', () => {
    const { results } = detectEnvironment();
    for (const item of results) {
      expect(item).toHaveProperty('displayName');
      expect(item).toHaveProperty('dirName');
      expect(item).toHaveProperty('isActive');
      expect(item).toHaveProperty('hasProject');
      expect(item).toHaveProperty('workspaceRoot');
      expect(typeof item.isActive).toBe('boolean');
      expect(typeof item.hasProject).toBe('boolean');
    }
  });
});

describe('detectLoginStatus', () => {
  let tmpDir;
  let originalAuthEnabled;
  let originalCookieB64;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-env-token-'));
    originalAuthEnabled = process.env.YIDA_AUTH_ENABLED;
    originalCookieB64 = process.env.OPENYIDA_COOKIE_B64;
    delete process.env.YIDA_AUTH_ENABLED;
    delete process.env.OPENYIDA_COOKIE_B64;
  });

  afterEach(() => {
    if (originalAuthEnabled === undefined) {
      delete process.env.YIDA_AUTH_ENABLED;
    } else {
      process.env.YIDA_AUTH_ENABLED = originalAuthEnabled;
    }
    if (originalCookieB64 === undefined) {
      delete process.env.OPENYIDA_COOKIE_B64;
    } else {
      process.env.OPENYIDA_COOKIE_B64 = originalCookieB64;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('未登录时返回 token 模式的未登录状态', () => {
    const result = detectLoginStatus(tmpDir);
    expect(result).toMatchObject({
      loggedIn: false,
      canAutoUse: false,
      corpId: null,
      userId: null,
      baseUrl: null,
      authSource: 'token',
      authMode: 'token',
    });
    expect(result.diagnostics).toMatchObject({
      currentEnv: 'public',
      tokenFileFound: false,
      tokenFound: false,
    });
  });

  test('有效 token session 时返回 loggedIn: true 及用户字段', () => {
    saveTokenSession({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: Date.now() + 600000,
      base_url: 'https://www.aliwork.com',
      corp_id: 'corpABC',
      user_id: 'user456',
    }, { projectRoot: tmpDir });

    const result = detectLoginStatus(tmpDir);
    expect(result).toMatchObject({
      loggedIn: true,
      canAutoUse: true,
      corpId: 'corpABC',
      userId: 'user456',
      baseUrl: 'https://www.aliwork.com',
      authSource: 'token',
      authMode: 'token',
    });
    expect(result.diagnostics.tokenFileFound).toBe(true);
    expect(result.diagnostics.tokenFound).toBe(true);
  });

  test('YIDA_AUTH_ENABLED=true 时返回 cookie 兼容登录状态', () => {
    process.env.YIDA_AUTH_ENABLED = 'true';
    process.env.OPENYIDA_COOKIE_B64 = Buffer.from(
      'tianshu_csrf_token=legacy-csrf; tianshu_corp_user=corpCookie_userCookie',
      'utf8'
    ).toString('base64');

    const result = detectLoginStatus(tmpDir);
    expect(result).toMatchObject({
      loggedIn: true,
      canAutoUse: true,
      corpId: 'corpCookie',
      userId: 'userCookie',
      authSource: 'env',
      authMode: 'cookie',
    });
    expect(result.diagnostics).toMatchObject({
      authMode: 'cookie',
      cookieFound: true,
      csrfFound: true,
      tokenFound: false,
    });
  });
});

describe('run', () => {
  let originalAuthEnabled;
  let originalCookieB64;

  beforeEach(() => {
    originalAuthEnabled = process.env.YIDA_AUTH_ENABLED;
    originalCookieB64 = process.env.OPENYIDA_COOKIE_B64;
    delete process.env.YIDA_AUTH_ENABLED;
    delete process.env.OPENYIDA_COOKIE_B64;
  });

  afterEach(() => {
    if (originalAuthEnabled === undefined) {
      delete process.env.YIDA_AUTH_ENABLED;
    } else {
      process.env.YIDA_AUTH_ENABLED = originalAuthEnabled;
    }
    if (originalCookieB64 === undefined) {
      delete process.env.OPENYIDA_COOKIE_B64;
    } else {
      process.env.OPENYIDA_COOKIE_B64 = originalCookieB64;
    }
  });

  test('--json 输出机器可读环境快照', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let output;

    try {
      run(['--json']);
      output = consoleLogSpy.mock.calls.map((call) => call.join('')).join('');
    } finally {
      consoleLogSpy.mockRestore();
    }

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('ok', true);
    expect(parsed).toHaveProperty('system.node');
    expect(parsed).toHaveProperty('active.projectRoot');
    expect(parsed).toHaveProperty('login.authMode', 'token');
    expect(parsed).not.toHaveProperty('login.csrfToken');
    expect(parsed).not.toHaveProperty('login.cookiesCount');
  });

  test('buildEnvironmentSnapshot 不返回 token 明文', () => {
    const snapshot = buildEnvironmentSnapshot();
    const serialized = JSON.stringify(snapshot);
    expect(snapshot).toHaveProperty('login.authMode', 'token');
    expect(serialized).not.toContain('access-token');
    expect(serialized).not.toContain('refresh-token');
  });
});
