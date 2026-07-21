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
  hasDesktopEnvironment,
  resolveWukongWorkspaceRoot,
  httpPost,
  httpPostJson,
  httpGet,
} = require('../lib/core/utils');

jest.mock('../lib/auth/token-auth', () => ({
  getAccessToken: jest.fn(() => 'test-access-token'),
}));

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

  test('macOS 和 Windows 默认视为有桌面，强制 terminal QR 时除外', () => {
    expect(hasDesktopEnvironment({}, 'darwin')).toBe(true);
    expect(hasDesktopEnvironment({}, 'win32')).toBe(true);
    expect(hasDesktopEnvironment({ OPENYIDA_FORCE_TERMINAL_QR: '1' }, 'darwin')).toBe(false);
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
    const tokenRefresh = jest.fn().mockResolvedValue({
      access_token: 'new-access-token',
      refresh_token: 'refresh-token',
      base_url: 'https://www.aliwork.com',
    });
    const loadTokenSession = jest.fn().mockReturnValue({
      access_token: 'new-access-token',
      refresh_token: 'refresh-token',
      base_url: 'https://www.aliwork.com',
      corp_id: 'ding-corp',
      user_id: 'user-1',
    });
    const isRefreshAuthRequired = jest.fn(() => false);
    jest.doMock('../lib/auth/token-auth', () => ({ tokenRefresh, isRefreshAuthRequired }));
    jest.doMock('../lib/auth/token-store', () => ({ loadTokenSession }));
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
      base_url: 'https://www.aliwork.com',
      corp_id: 'ding-corp',
      user_id: 'user-1',
    });
    expect(result).toEqual({ success: true, content: { ok: true } });
    jest.dontMock('../lib/auth/token-auth');
    jest.dontMock('../lib/auth/token-store');
    jest.resetModules();
  });
});

// ── loadCookieData ────────────────────────────────────────────────────

describe('loadCookieData', () => {
  let tmpDir;
  let cookieFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-cookie-utils-'));
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    cookieFile = path.join(cacheDir, 'cookies.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('读取数组格式的 cookies.json', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'token123' },
      { name: 'tianshu_corp_user', value: 'corpA_user1' },
    ];
    fs.writeFileSync(cookieFile, JSON.stringify(cookies), 'utf-8');

    const result = loadCookieData(tmpDir);
    expect(result).not.toBeNull();
    expect(result.csrf_token).toBe('token123');
    expect(result.corp_id).toBe('corpA');
    expect(result.user_id).toBe('user1');
    expect(result.base_url).toBe('https://www.aliwork.com');
  });

  test('读取对象格式的 cookies.json（含 base_url）', () => {
    const data = {
      cookies: [{ name: 'tianshu_csrf_token', value: 'mytoken' }],
      base_url: 'https://custom.aliwork.com',
    };
    fs.writeFileSync(cookieFile, JSON.stringify(data), 'utf-8');

    const result = loadCookieData(tmpDir);
    expect(result.csrf_token).toBe('mytoken');
    expect(result.base_url).toBe('https://custom.aliwork.com');
  });

  test('仓库外 projectRoot 缺少缓存时读取全局 OpenYida 缓存', () => {
    const originalCacheDir = process.env.OPENYIDA_CACHE_DIR;
    const globalCacheDir = path.join(tmpDir, 'global-openyida-cache');
    const outsideRoot = path.join(tmpDir, 'outside-workspace');
    const data = {
      cookies: [
        { name: 'tianshu_csrf_token', value: 'global-token' },
        { name: 'tianshu_corp_user', value: 'corpGlobal_userGlobal' },
      ],
      base_url: 'https://global.aliwork.com',
    };
    process.env.OPENYIDA_CACHE_DIR = globalCacheDir;
    fs.mkdirSync(globalCacheDir, { recursive: true });
    fs.writeFileSync(path.join(globalCacheDir, 'cookies-public.json'), JSON.stringify(data), 'utf-8');

    try {
      const result = loadCookieData(outsideRoot);
      expect(result).not.toBeNull();
      expect(result.csrf_token).toBe('global-token');
      expect(result.corp_id).toBe('corpGlobal');
      expect(result.user_id).toBe('userGlobal');
      expect(result.base_url).toBe('https://global.aliwork.com');
    } finally {
      if (originalCacheDir === undefined) {
        delete process.env.OPENYIDA_CACHE_DIR;
      } else {
        process.env.OPENYIDA_CACHE_DIR = originalCacheDir;
      }
    }
  });

  test('读取云版注入格式时使用顶层 csrf/corp/user 字段', () => {
    const data = {
      cookies: [{ name: 'sid', value: 'cookie-only' }],
      csrf_token: 'top-level-token',
      corp_id: 'corp-top',
      user_id: 'user-top',
      base_url: 'https://www.aliwork.com',
    };
    fs.writeFileSync(cookieFile, JSON.stringify(data), 'utf-8');

    const result = loadCookieData(tmpDir);
    expect(result.csrf_token).toBe('top-level-token');
    expect(result.corp_id).toBe('corp-top');
    expect(result.user_id).toBe('user-top');
    expect(result.cookies).toContainEqual({ name: 'tianshu_csrf_token', value: 'top-level-token' });
  });

  test('文件不存在时返回 null', () => {
    fs.rmSync(cookieFile, { force: true });
    const result = loadCookieData(tmpDir);
    expect(result).toBeNull();
  });

  test('文件内容为空时返回 null', () => {
    fs.writeFileSync(cookieFile, '', 'utf-8');
    const result = loadCookieData(tmpDir);
    expect(result).toBeNull();
  });

  test('文件内容为非法 JSON 时返回 null', () => {
    fs.writeFileSync(cookieFile, 'not-json', 'utf-8');
    const result = loadCookieData(tmpDir);
    expect(result).toBeNull();
  });
});

// ── loadAuthData ──────────────────────────────────────────────────────

describe('loadAuthData', () => {
  let tmpDir;
  let originalAuthEnabled;
  let originalCookieB64;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-utils-'));
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

  test('读取 token session 并返回 authRef 可用结构', () => {
    const { saveTokenSession } = require('../lib/auth/token-store');
    saveTokenSession({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: Date.now() + 600000,
      base_url: 'https://www.aliwork.com',
      corp_id: 'corpA',
      user_id: 'user1',
    }, { projectRoot: tmpDir });

    const result = loadAuthData(tmpDir);
    expect(result).toMatchObject({
      corp_id: 'corpA',
      user_id: 'user1',
      base_url: 'https://www.aliwork.com',
      auth_source: 'token',
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

  test('YIDA_AUTH_ENABLED=true 时读取 OPENYIDA_COOKIE_B64 注入 Cookie', () => {
    process.env.YIDA_AUTH_ENABLED = 'true';
    process.env.OPENYIDA_COOKIE_B64 = Buffer.from(
      'tianshu_csrf_token=legacy-csrf; tianshu_corp_user=corpLegacy_userLegacy',
      'utf8'
    ).toString('base64');

    expect(loadAuthData(tmpDir)).toMatchObject({
      auth_mode: 'cookie',
      auth_source: 'env',
      csrf_token: 'legacy-csrf',
      corp_id: 'corpLegacy',
      user_id: 'userLegacy',
    });
  });

  test('YIDA_AUTH_ENABLED=true 时不再读取旧 cookies.json 文件', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
      { name: 'tianshu_csrf_token', value: 'legacy-csrf' },
      { name: 'tianshu_corp_user', value: 'corpLegacy_userLegacy' },
    ]), 'utf-8');
    process.env.YIDA_AUTH_ENABLED = 'true';
    delete process.env.OPENYIDA_COOKIE_B64;

    expect(loadAuthData(tmpDir)).toBeNull();
  });

  test('YIDA_AUTH_ENABLED=true 且 OPENYIDA_COOKIE_B64 非法时不回退 cookies.json', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
      { name: 'tianshu_csrf_token', value: 'legacy-csrf' },
      { name: 'tianshu_corp_user', value: 'corpLegacy_userLegacy' },
    ]), 'utf-8');
    process.env.YIDA_AUTH_ENABLED = 'true';
    process.env.OPENYIDA_COOKIE_B64 = 'not-base64';

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
    delete process.env.VSCODE_GIT_ASKPASS_NODE;
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
});
