'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

// 测试目标模块
const {
  resolveBaseUrl,
  isLoginExpired,
  loadAuthData,
  loadCookieData,
  detectActiveTool,
  detectRuntimeCapabilities,
  hasDesktopEnvironment,
  resolveWukongWorkspaceRoot,
  httpPost,
  httpPostJson,
  httpGet,
} = require('../lib/core/utils');
const { buildBrowserHandoff } = require('../lib/core/browser-handoff');

jest.mock('../lib/auth/token-auth', () => ({
  getAccessToken: jest.fn(() => 'test-access-token'),
}));

const LEGACY_COOKIE_ENV = 'OPENYIDA_COOKIE_B64';

// ── hasDesktopEnvironment ─────────────────────────────────────────────

describe('hasDesktopEnvironment', () => {
  test('CI 环境视为无桌面，除非显式声明有桌面', () => {
    expect(hasDesktopEnvironment({ CI: '1', DISPLAY: ':0' }, 'linux')).toBe(false);
    expect(hasDesktopEnvironment({ CI: '1', OPENYIDA_ASSUME_DESKTOP: '1' }, 'linux')).toBe(true);
  });

  test('Linux 需要图形会话信号才视为有桌面', () => {
    expect(hasDesktopEnvironment({}, 'linux')).toBe(false);
    expect(hasDesktopEnvironment({ DISPLAY: ':0' }, 'linux')).toBe(true);
    expect(hasDesktopEnvironment({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux')).toBe(true);
    expect(hasDesktopEnvironment({ XDG_SESSION_TYPE: 'wayland' }, 'linux')).toBe(true);
  });

  test('macOS 和 Windows 默认视为有桌面', () => {
    expect(hasDesktopEnvironment({}, 'darwin')).toBe(true);
    expect(hasDesktopEnvironment({}, 'win32')).toBe(true);
  });
});

// ── resolveBaseUrl ────────────────────────────────────────────────────

describe('resolveBaseUrl', () => {
  test('从 authData 中读取 base_url 并去除末尾斜杠', () => {
    const authData = { base_url: 'https://www.aliwork.com/' };
    expect(resolveBaseUrl(authData)).toBe('https://www.aliwork.com');
  });

  test('base_url 无末尾斜杠时原样返回', () => {
    const authData = { base_url: 'https://www.aliwork.com' };
    expect(resolveBaseUrl(authData)).toBe('https://www.aliwork.com');
  });

  test('authData 为 null 时返回默认值', () => {
    expect(resolveBaseUrl(null)).toBe('https://www.aliwork.com');
  });

  test('authData 无 base_url 时返回默认值', () => {
    expect(resolveBaseUrl({})).toBe('https://www.aliwork.com');
  });

  test('支持自定义默认值', () => {
    expect(resolveBaseUrl(null, 'https://custom.example.com')).toBe('https://custom.example.com');
  });

  test('去除多个末尾斜杠', () => {
    const authData = { base_url: 'https://www.aliwork.com///' };
    expect(resolveBaseUrl(authData)).toBe('https://www.aliwork.com');
  });

  test('登录缓存中的实际 base_url 优先于内置非默认环境域名', () => {
    const originalEnv = process.env.OPENYIDA_ENV;
    const originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    process.env.OPENYIDA_ENV = 'alibaba';
    delete process.env.OPENYIDA_ENDPOINT;

    try {
      const authData = { base_url: 'https://yida-aliyun.alibaba-inc.com/home' };
      expect(resolveBaseUrl(authData)).toBe('https://yida-aliyun.alibaba-inc.com');
    } finally {
      if (originalEnv === undefined) {
        delete process.env.OPENYIDA_ENV;
      } else {
        process.env.OPENYIDA_ENV = originalEnv;
      }
      if (originalEndpoint === undefined) {
        delete process.env.OPENYIDA_ENDPOINT;
      } else {
        process.env.OPENYIDA_ENDPOINT = originalEndpoint;
      }
    }
  });

  test('鉴权服务返回的业务 base_url 优先于 OPENYIDA_ENDPOINT', () => {
    const originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    process.env.OPENYIDA_ENDPOINT = 'https://www.aliwork.com';

    try {
      expect(resolveBaseUrl({
        base_url: 'https://customer.example.com/path',
      })).toBe('https://customer.example.com');
    } finally {
      if (originalEndpoint === undefined) {
        delete process.env.OPENYIDA_ENDPOINT;
      } else {
        process.env.OPENYIDA_ENDPOINT = originalEndpoint;
      }
    }
  });
});

// ── isLoginExpired ────────────────────────────────────────────────────

describe('isLoginExpired', () => {
  test('errorCode 307 时返回 true', () => {
    expect(isLoginExpired({ success: false, errorCode: '307' })).toBe(true);
  });

  test('errorCode 302 时返回 true', () => {
    expect(isLoginExpired({ success: false, errorCode: '302' })).toBe(true);
  });

  test('HTTP auth errorCode 时返回 true', () => {
    expect(isLoginExpired({ success: false, errorCode: '401' })).toBe(true);
    expect(isLoginExpired({ success: false, errorCode: '403' })).toBe(true);
  });

  test('not_logged_in 状态或错误码时返回 true', () => {
    expect(isLoginExpired({ status: 'not_logged_in' })).toBe(true);
    expect(isLoginExpired({ success: false, errorCode: 'not_logged_in' })).toBe(true);
  });

  test('invalid_access_token 状态会被识别为 access token 失效', () => {
    expect(isLoginExpired({ status: 'invalid_access_token' })).toBe(true);
    expect(isLoginExpired({
      success: true,
      content: {
        status: 'invalid_access_token',
        message: 'Authorization Bearer token is invalid or expired',
      },
    })).toBe(true);
  });

  test('success 为 true 时返回 false', () => {
    expect(isLoginExpired({ success: true, errorCode: '307' })).toBe(false);
  });

  test('errorCode 不匹配时返回 false', () => {
    expect(isLoginExpired({ success: false, errorCode: '500' })).toBe(false);
  });

  test('null 时返回 falsy', () => {
    expect(isLoginExpired(null)).toBeFalsy();
  });

  test('content 为 null 时返回 false', () => {
    expect(isLoginExpired({ success: true, content: null })).toBe(false);
  });

  test('空对象时返回 false', () => {
    expect(isLoginExpired({})).toBe(false);
  });
});

// ── HTTP redirect login detection ────────────────────────────────────

describe('http redirect login detection', () => {
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

  test('httpPost 将 302 跳转识别为需要重新登录', async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', '/login.html');
      res.end('LOGIN FAILED');
    });
    const port = await listen(server);

    try {
      const result = await httpPost(`http://127.0.0.1:${port}`, '/bad', '', { silentStatus: true });

      expect(result).toMatchObject({
        __needLogin: true,
        __httpStatus: 302,
        __location: '/login.html',
      });
    } finally {
      await closeServer(server);
    }
  });

  test('httpPost 为 200 空响应非 JSON 保留结构化元数据', async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.end('');
    });
    const port = await listen(server);

    try {
      const result = await httpPost(`http://127.0.0.1:${port}`, '/empty', '', { silentStatus: true });

      expect(result).toMatchObject({
        success: false,
        __httpStatus: 200,
        __nonJsonResponse: true,
        __emptyBody: true,
      });
      expect(result.errorMsg).toMatch(/^HTTP 200:/);
    } finally {
      await closeServer(server);
    }
  });

  test('httpPost ignores legacy cookie arrays and sends bearer auth only', async () => {
    let capturedHeaders = null;
    const server = http.createServer((req, res) => {
      capturedHeaders = req.headers;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    });
    const port = await listen(server);

    try {
      const result = await httpPost(
        `http://127.0.0.1:${port}`,
        '/legacy-cookie-arg',
        'a=1',
        [{ name: 'session', value: 'private' }],
        { silentStatus: true, csrfToken: 'legacy-csrf' }
      );

      expect(result).toEqual({ success: true });
      expect(capturedHeaders.authorization).toBe('Bearer test-access-token');
      expect(capturedHeaders.cookie).toBeUndefined();
      expect(capturedHeaders.global_csrf_token).toBeUndefined();
    } finally {
      await closeServer(server);
    }
  });

  test('httpGet 将 307 跳转识别为需要重新登录', async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 307;
      res.setHeader('Location', '/workPlatform');
      res.end('LOGIN FAILED');
    });
    const port = await listen(server);

    try {
      const result = await httpGet(`http://127.0.0.1:${port}`, '/bad', { a: 1 }, { silentStatus: true });

      expect(result).toMatchObject({
        __needLogin: true,
        __httpStatus: 307,
        __location: '/workPlatform',
      });
    } finally {
      await closeServer(server);
    }
  });

  test('httpGet 将 401 识别为需要重新登录', async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 401;
      res.end('Unauthorized');
    });
    const port = await listen(server);

    try {
      const result = await httpGet(`http://127.0.0.1:${port}`, '/bad', { a: 1 }, { silentStatus: true });

      expect(result).toMatchObject({
        __needLogin: true,
        __httpStatus: 401,
      });
    } finally {
      await closeServer(server);
    }
  });

  test('httpPostJson 将 403 识别为需要重新登录', async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 403;
      res.end(JSON.stringify({ success: false, errorCode: '403' }));
    });
    const port = await listen(server);

    try {
      const result = await httpPostJson(`http://127.0.0.1:${port}`, '/bad', {}, { silentStatus: true });

      expect(result).toMatchObject({
        __needLogin: true,
        __httpStatus: 403,
      });
    } finally {
      await closeServer(server);
    }
  });
});

// ── requestWithAutoLogin ──────────────────────────────────────────────

describe('requestWithAutoLogin', () => {
  test('登录失效且 refresh 请求失败时不回退到登录引导', async () => {
    jest.resetModules();
    const tokenRefresh = jest.fn(() => {
      throw new Error('refresh failed');
    });
    const isRefreshAuthRequired = jest.fn(() => false);
    jest.doMock('../lib/auth/token-auth', () => ({ tokenRefresh, isRefreshAuthRequired }));
    const utils = require('../lib/core/utils');
    const requestFn = jest.fn().mockResolvedValueOnce({ __needLogin: true });

    const result = await utils.requestWithAutoLogin(requestFn, {
      baseUrl: 'https://www.aliwork.com',
      authMode: 'token',
      authSource: 'token',
    });

    expect(tokenRefresh).toHaveBeenCalledTimes(1);
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      errorCode: 'TOKEN_REFRESH_FAILED',
    });
    jest.dontMock('../lib/auth/token-auth');
    jest.resetModules();
  });

  test('登录失效且 refresh token 无效时才提示重新登录', async () => {
    jest.resetModules();
    const tokenRefresh = jest.fn().mockResolvedValue({
      ok: false,
      auth_mode: 'token',
      status: 'invalid_refresh_token',
      can_auto_use: false,
    });
    const isRefreshAuthRequired = jest.fn((value) => value && value.status === 'invalid_refresh_token');
    jest.doMock('../lib/auth/token-auth', () => ({ tokenRefresh, isRefreshAuthRequired }));
    const utils = require('../lib/core/utils');
    const requestFn = jest.fn().mockResolvedValueOnce({ __needLogin: true });

    const result = await utils.requestWithAutoLogin(requestFn, {
      baseUrl: 'https://www.aliwork.com',
      authMode: 'token',
      authSource: 'token',
    });

    expect(tokenRefresh).toHaveBeenCalledTimes(1);
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      __needLogin: true,
      errorCode: 'TOKEN_AUTH_REQUIRED',
    });
    jest.dontMock('../lib/auth/token-auth');
    jest.resetModules();
  });

  test('登录失效且 refresh 成功时刷新 token 并重试原请求', async () => {
    jest.resetModules();
    const originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    process.env.OPENYIDA_ENDPOINT = 'https://www.aliwork.com';
    try {
      const tokenRefresh = jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        base_url: 'https://customer.example.com',
        corp_id: 'ding-corp',
        corp_name: '钉钉组织',
        user_id: 'user-1',
      });
      const isRefreshAuthRequired = jest.fn(() => false);
      jest.doMock('../lib/auth/token-auth', () => ({ tokenRefresh, isRefreshAuthRequired }));
      const utils = require('../lib/core/utils');
      const requestFn = jest.fn()
        .mockResolvedValueOnce({ __needLogin: true })
        .mockResolvedValueOnce({ success: true, content: { ok: true } });
      const authRef = {
        baseUrl: 'https://www.aliwork.com',
        authData: {
          auth_mode: 'token',
          auth_source: 'token',
          base_url: 'https://www.aliwork.com',
          client_id: 'suite9xvlxxerybljwheo',
        },
        authMode: 'token',
        authSource: 'token',
      };

      const result = await utils.requestWithAutoLogin(requestFn, authRef);

      expect(tokenRefresh).toHaveBeenCalledWith(expect.objectContaining({
        baseUrl: 'https://www.aliwork.com',
        clientId: 'suite9xvlxxerybljwheo',
      }));
      expect(requestFn).toHaveBeenCalledTimes(2);
      expect(authRef.authData).toMatchObject({
        auth_mode: 'token',
        base_url: 'https://customer.example.com',
        corp_id: 'ding-corp',
        corp_name: '钉钉组织',
        user_id: 'user-1',
      });
      expect(authRef.corpName).toBe('钉钉组织');
      expect(authRef.baseUrl).toBe('https://customer.example.com');
      expect(result).toEqual({ success: true, content: { ok: true } });
    } finally {
      if (originalEndpoint === undefined) {
        delete process.env.OPENYIDA_ENDPOINT;
      } else {
        process.env.OPENYIDA_ENDPOINT = originalEndpoint;
      }
      jest.dontMock('../lib/auth/token-auth');
      jest.resetModules();
    }
  });
});

// ── loadCookieData ────────────────────────────────────────────────────

describe('loadCookieData', () => {
  test('不再读取本地或全局 Cookie 缓存作为登录态来源', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-cookie-utils-'));
    const originalCacheDir = process.env.OPENYIDA_CACHE_DIR;
    const cacheDir = path.join(tmpDir, '.cache');
    const globalCacheDir = path.join(tmpDir, 'global-openyida-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(globalCacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
      { name: 'tianshu_csrf_token', value: 'local-csrf' },
      { name: 'tianshu_corp_user', value: 'corpLocal_userLocal' },
    ]), 'utf-8');
    fs.writeFileSync(path.join(globalCacheDir, 'cookies-public.json'), JSON.stringify([
      { name: 'tianshu_csrf_token', value: 'global-csrf' },
    ]), 'utf-8');
    process.env.OPENYIDA_CACHE_DIR = globalCacheDir;

    try {
      expect(loadCookieData(tmpDir)).toBeNull();
    } finally {
      if (originalCacheDir === undefined) {
        delete process.env.OPENYIDA_CACHE_DIR;
      } else {
        process.env.OPENYIDA_CACHE_DIR = originalCacheDir;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ── loadAuthData ──────────────────────────────────────────────────────

describe('loadAuthData', () => {
  let tmpDir;
  let originalAuthEnabled;
  let originalAuthMode;
  let originalLegacyCookieEnv;
  let originalAccessToken;
  let originalRefreshToken;
  let originalEndpoint;
  let originalCorpId;
  let originalUserId;
  let originalAuthDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-utils-'));
    originalAuthEnabled = process.env.YIDA_AUTH_ENABLED;
    originalAuthMode = process.env.OPENYIDA_AUTH_MODE;
    originalLegacyCookieEnv = process.env[LEGACY_COOKIE_ENV];
    originalAccessToken = process.env.OPENYIDA_ACCESS_TOKEN;
    originalRefreshToken = process.env.OPENYIDA_REFRESH_TOKEN;
    originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    originalCorpId = process.env.OPENYIDA_TOKEN_CORP_ID;
    originalUserId = process.env.OPENYIDA_TOKEN_USER_ID;
    originalAuthDir = process.env.OPENYIDA_AUTH_DIR;
    delete process.env.YIDA_AUTH_ENABLED;
    delete process.env.OPENYIDA_AUTH_MODE;
    delete process.env[LEGACY_COOKIE_ENV];
    delete process.env.OPENYIDA_ACCESS_TOKEN;
    delete process.env.OPENYIDA_REFRESH_TOKEN;
    delete process.env.OPENYIDA_ENDPOINT;
    delete process.env.OPENYIDA_TOKEN_CORP_ID;
    delete process.env.OPENYIDA_TOKEN_USER_ID;
    process.env.OPENYIDA_AUTH_DIR = path.join(tmpDir, 'user-auth');
  });

  afterEach(() => {
    const restore = (name, value) => {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    };
    restore('YIDA_AUTH_ENABLED', originalAuthEnabled);
    restore('OPENYIDA_AUTH_MODE', originalAuthMode);
    restore(LEGACY_COOKIE_ENV, originalLegacyCookieEnv);
    restore('OPENYIDA_ACCESS_TOKEN', originalAccessToken);
    restore('OPENYIDA_REFRESH_TOKEN', originalRefreshToken);
    restore('OPENYIDA_ENDPOINT', originalEndpoint);
    restore('OPENYIDA_TOKEN_CORP_ID', originalCorpId);
    restore('OPENYIDA_TOKEN_USER_ID', originalUserId);
    restore('OPENYIDA_AUTH_DIR', originalAuthDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('读取 token session 并返回 authRef 可用结构', () => {
    const { saveTokenSession } = require('../lib/auth/token-store');
    saveTokenSession({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: Date.now() + 600000,
      base_url: 'https://www.aliwork.com',
      corp_id: 'corpA',
      corp_name: '组织 A',
      user_id: 'user1',
    }, { projectRoot: tmpDir });

    const result = loadAuthData(tmpDir);
    expect(result).toMatchObject({
      corp_id: 'corpA',
      corp_name: '组织 A',
      user_id: 'user1',
      base_url: 'https://www.aliwork.com',
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
      auth_mode: 'token',
    });
  });

  test('没有 token session 时返回 null，不读取旧 cookies.json', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
      { name: 'ai_app_user_auth_token', value: 'unsafe-cookie-token' },
    ]), 'utf-8');

    expect(loadAuthData(tmpDir)).toBeNull();
  });

  test('OPENYIDA_AUTH_MODE=token 时读取运行环境注入 token，忽略旧 cookie env', () => {
    process.env.OPENYIDA_AUTH_MODE = 'token';
    process.env.OPENYIDA_ACCESS_TOKEN = 'env-access-token';
    process.env.OPENYIDA_REFRESH_TOKEN = 'env-refresh-token';
    process.env.OPENYIDA_ENDPOINT = 'https://env-token.example.com';
    process.env.OPENYIDA_TOKEN_CORP_ID = 'corpEnv';
    process.env.OPENYIDA_TOKEN_USER_ID = 'userEnv';
    process.env[LEGACY_COOKIE_ENV] = Buffer.from(
      'tianshu_csrf_token=legacy-csrf; tianshu_corp_user=corpLegacy_userLegacy',
      'utf8'
    ).toString('base64');

    expect(loadAuthData(tmpDir)).toMatchObject({
      auth_mode: 'token',
      auth_source: 'env',
      corp_id: 'corpEnv',
      user_id: 'userEnv',
      base_url: 'https://env-token.example.com',
    });
  });

  test('OPENYIDA_AUTH_MODE=token 且运行环境缺 token 时不回退旧 cookies.json 文件', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
      { name: 'tianshu_csrf_token', value: 'legacy-csrf' },
      { name: 'tianshu_corp_user', value: 'corpLegacy_userLegacy' },
    ]), 'utf-8');
    process.env.OPENYIDA_AUTH_MODE = 'token';
    delete process.env[LEGACY_COOKIE_ENV];

    expect(loadAuthData(tmpDir)).toBeNull();
  });

  test('旧 cookie env 存在也不会让默认登录态进入 Cookie 模式', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
      { name: 'tianshu_csrf_token', value: 'legacy-csrf' },
      { name: 'tianshu_corp_user', value: 'corpLegacy_userLegacy' },
    ]), 'utf-8');
    process.env.OPENYIDA_AUTH_MODE = 'token';
    process.env[LEGACY_COOKIE_ENV] = 'not-base64';

    expect(loadAuthData(tmpDir)).toBeNull();
  });
});

// ── detectActiveTool ──────────────────────────────────────────────────

describe('detectActiveTool', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清除所有 AI 工具环境变量，确保测试不受当前运行环境影响
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_CODE_ENTRYPOINT;
    delete process.env.OPENCODE;
    delete process.env.OPENCODE_CLIENT;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.QODERCLI_INTEGRATION_MODE;
    delete process.env.QODER_WORK_INTEGRATION_PRODUCT;
    delete process.env.QODERCN_CONFIG_DIR;
    delete process.env.QODER_CONFIG_DIR;
    delete process.env.QODER_WORKER_CWD;
    delete process.env.QWENWORK;
    delete process.env.QWENWORK_INTEGRATION_MODE;
    delete process.env.QWENWORKCN_INTEGRATION_MODE;
    delete process.env.QWENWORK_CLIENT;
    delete process.env.QWENWORK_WORKSPACE_DIR;
    delete process.env.QWENWORK_SANDBOX_ID;
    delete process.env.QWENWORK_PREVIEW_URL;
    delete process.env.QWENWORK_VNC_URL;
    delete process.env.AGENT_PLATFORM;
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.__CFBundleIdentifier;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.MULERUN_CHAT_ID;
    delete process.env.MULE_DATA_DIR;
    delete process.env.MULE_WORKSPACE_DIR;
    delete process.env.MULE_SANDBOX_ID;
    delete process.env.TERM_PROGRAM;
    delete process.env.VSCODE_GIT_ASKPASS_NODE;
    delete process.env.OPENYIDA_NO_BROWSER_HANDOFF;
  });

  afterEach(() => {
    // 还原环境变量
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {delete process.env[key];}
    });
    Object.assign(process.env, originalEnv);
  });

  test('CLAUDE_CODE 环境变量时检测为 Claude Code', () => {
    process.env.CLAUDE_CODE = '1';
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe('claude-code');
    expect(result.displayName).toBe('Claude Code');
  });

  test('MULERUN_CHAT_ID 环境变量时检测为 MuleRun', () => {
    process.env.MULERUN_CHAT_ID = 'test-chat-id';
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe('mulerun');
    expect(result.displayName).toBe('MuleRun');
    expect(result.dirName).toBe('.mulerun');
  });

  test('MuleRun 优先级高于 Claude Code（MuleRun 设置了 CLAUDE_CODE 变量）', () => {
    process.env.MULERUN_CHAT_ID = 'test-chat-id';
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';
    process.env.CLAUDE_CODE = '1';
    const result = detectActiveTool();
    expect(result.tool).toBe('mulerun');
  });

  test('QwenWork web 强信号优先于 MuleRun 兼容变量', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'qwenwork-web-'));
    fs.mkdirSync(path.join(workspace, 'project'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'project', 'config.json'), '{}', 'utf8');
    try {
      process.env.QWENWORK = '1';
      process.env.AGENT_PLATFORM = 'qwenwork_base';
      process.env.QWENWORK_CLIENT = 'acp';
      process.env.QWENWORK_WORKSPACE_DIR = workspace;
      process.env.QWENWORK_SANDBOX_ID = 'sandbox-web';
      process.env.QWENWORK_PREVIEW_URL = 'https://preview.example.test';
      process.env.QWENWORK_VNC_URL = 'https://vnc.example.test';
      process.env.MULERUN_CHAT_ID = 'mule-chat';
      process.env.MULE_DATA_DIR = '/tmp/.mulerun';
      process.env.MULE_WORKSPACE_DIR = '/tmp/mule-workspace';
      process.env.CLAUDE_CODE = '1';

      const result = detectActiveTool();
      expect(result).toMatchObject({
        tool: 'qwenwork',
        dirName: '.qwenworkcn',
        runtime: 'web_sandbox',
        subtype: 'qwenwork_web',
        workspaceRoot: path.join(workspace, 'project'),
        workspaceRootSource: 'QWENWORK_WORKSPACE_DIR',
        capabilities: {
          desktop_shell: false,
          agent_browser: true,
          browser_auto_open: false,
          playwright_required: false,
        },
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('OPENCODE 环境变量时检测为 OpenCode', () => {
    delete process.env.CLAUDE_CODE;
    process.env.OPENCODE = '1';
    const result = detectActiveTool();
    expect(result.tool).toBe('opencode');
  });

  test('OPENCODE_CLIENT 环境变量时检测为 OpenCode', () => {
    delete process.env.CLAUDE_CODE;
    process.env.OPENCODE_CLIENT = 'cli';
    const result = detectActiveTool();
    expect(result.tool).toBe('opencode');
  });

  test('QODER_IDE 环境变量时检测为 Qoder（优先级最高）', () => {
    process.env.QODER_IDE = '1';
    process.env.CLAUDE_CODE = '1';
    process.env.CODEX_SHELL = '1';
    const result = detectActiveTool();
    expect(result.tool).toBe('qoder');
  });

  test('QWENWORKCN_INTEGRATION_MODE 环境变量时检测为 QwenWork', () => {
    process.env.QWENWORKCN_INTEGRATION_MODE = 'qwen_work';
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';
    process.env.CLAUDE_CODE = '1';
    const result = detectActiveTool();
    expect(result.tool).toBe('qwenwork');
    expect(result.displayName).toBe('QwenWork（千问办公）');
    expect(result.dirName).toBe('.qwenworkcn');
  });

  test('QwenWork desktop 强信号优先于 Qoder/QoderWork 兼容变量', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'qwenwork-desktop-'));
    fs.writeFileSync(path.join(workspace, 'config.json'), '{}', 'utf8');
    try {
      process.env.QODER_IDE = '1';
      process.env.QODER_AGENT = '1';
      process.env.QODERCLI_INTEGRATION_MODE = 'qoder_work';
      process.env.QODER_WORK_INTEGRATION_PRODUCT = 'qwenworkcn';
      process.env.__CFBundleIdentifier = 'cn.qwenwork.desktop.mac';
      process.env.QODERCN_CONFIG_DIR = path.join(os.homedir(), '.qwenworkcn');
      process.env.QODER_WORKER_CWD = workspace;
      process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts';

      const result = detectActiveTool();
      expect(result).toMatchObject({
        tool: 'qwenwork',
        displayName: 'QwenWork（千问办公）',
        dirName: '.qwenworkcn',
        runtime: 'desktop_shell',
        subtype: 'qwenwork_desktop',
        workspaceRoot: workspace,
        workspaceRootSource: 'QODER_WORKER_CWD',
        capabilities: {
          desktop_shell: true,
          agent_browser: true,
          browser_auto_open: true,
          playwright_required: false,
        },
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('QwenWork 和 QoderWork 环境默认附加浏览器 handoff', () => {
    process.env.QWENWORKCN_INTEGRATION_MODE = 'qwen_work';
    expect(buildBrowserHandoff('https://example.com/yida')).toMatchObject({
      status: 'open_url',
      handoff_type: 'browser',
    });

    delete process.env.QWENWORKCN_INTEGRATION_MODE;
    process.env.QODERCLI_INTEGRATION_MODE = 'qoder_work';
    expect(buildBrowserHandoff('https://example.com/yida')).toMatchObject({
      status: 'open_url',
      handoff_type: 'browser',
    });
  });

  test('CODEX_SHELL 环境变量时检测为 Codex', () => {
    process.env.CODEX_SHELL = '1';
    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe('codex');
    expect(result.displayName).toBe('Codex');
    expect(result.dirName).toBe('.codex');
  });

  test('AGENT_WORK_ROOT 包含 .real 时检测为悟空', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_CODE_ENTRYPOINT;
    delete process.env.OPENCODE;
    delete process.env.OPENCODE_CLIENT;
    delete process.env.QODER_IDE;
    delete process.env.QODERCLI_INTEGRATION_MODE;
    delete process.env.QWENWORK_INTEGRATION_MODE;
    delete process.env.QWENWORKCN_INTEGRATION_MODE;
    delete process.env.CODEX_SHELL;
    delete process.env.CURSOR_TRACE_ID;
    process.env.AGENT_WORK_ROOT = '/home/user/.real/workspace';
    const result = detectActiveTool();
    expect(result.tool).toBe('wukong');
    expect(result.workspaceRoot).toBe('/home/user/.real/workspace');
  });

  test('resolveWukongWorkspaceRoot 优先使用已有 config.json 的真实工作区', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wukong-root-'));
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'config.json'), '{}', 'utf8');

    try {
      expect(resolveWukongWorkspaceRoot(root)).toBe(workspace);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('TERM_PROGRAM=vscode 且有 .aone_copilot 目录时检测为 Aone Copilot', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_CODE_ENTRYPOINT;
    delete process.env.OPENCODE;
    delete process.env.OPENCODE_CLIENT;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.QODERCLI_INTEGRATION_MODE;
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.__CFBundleIdentifier;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
    process.env.TERM_PROGRAM = 'vscode';

    // 模拟 .aone_copilot 目录存在（CI 环境可能没有）
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (p) => {
      if (p.includes('.aone_copilot')) {return true;}
      return originalExistsSync(p);
    };

    const result = detectActiveTool();
    expect(result).not.toBeNull();
    expect(result.tool).toBe('aone-copilot');

    // 恢复 fs.existsSync
    fs.existsSync = originalExistsSync;
  });

  test('无任何 AI 工具环境变量时返回 null', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_CODE_ENTRYPOINT;
    delete process.env.OPENCODE;
    delete process.env.OPENCODE_CLIENT;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.QODERCLI_INTEGRATION_MODE;
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.__CFBundleIdentifier;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.MULERUN_CHAT_ID;
    delete process.env.MULE_DATA_DIR;
    delete process.env.TERM_PROGRAM;

    // 确保 .aone_copilot 目录不存在（避免干扰）
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (p) => {
      if (p.includes('.aone_copilot')) {return false;}
      return originalExistsSync(p);
    };

    const result = detectActiveTool();
    expect(result).toBeNull();

    // 恢复 fs.existsSync
    fs.existsSync = originalExistsSync;
  });

  test('detectRuntimeCapabilities 在无桌面且无 Agent 浏览器时显式标记无浏览器能力', () => {
    const result = detectRuntimeCapabilities({
      env: { CI: '1' },
      cwd: '/tmp/openyida-runtime',
      platform: 'linux',
      home: '/tmp/openyida-home',
    });

    expect(result).toMatchObject({
      tool: null,
      runtime: 'unknown',
      workspaceRoot: path.join('/tmp/openyida-runtime', 'project'),
      workspaceRootSource: 'cwd_project',
      capabilities: {
        desktop_shell: false,
        agent_browser: false,
        browser_auto_open: false,
        playwright_required: false,
      },
    });
  });
});
