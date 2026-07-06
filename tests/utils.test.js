'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

// 测试目标模块
const {
  extractInfoFromCookies,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  loadCookieData,
  detectActiveTool,
  hasDesktopEnvironment,
  resolveWukongWorkspaceRoot,
  httpPost,
  httpGet,
} = require('../lib/core/utils');

// ── extractInfoFromCookies ────────────────────────────────────────────

describe('extractInfoFromCookies', () => {
  test('正常提取 csrfToken、corpId、userId', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'abc123' },
      { name: 'tianshu_corp_user', value: 'dingCorpId_userId999' },
    ];
    const result = extractInfoFromCookies(cookies);
    expect(result.csrfToken).toBe('abc123');
    expect(result.corpId).toBe('dingCorpId');
    expect(result.userId).toBe('userId999');
  });

  test('corpId 中包含多个下划线时，以最后一个为分隔符', () => {
    const cookies = [
      { name: 'tianshu_corp_user', value: 'corp_with_underscores_userId' },
    ];
    const result = extractInfoFromCookies(cookies);
    expect(result.corpId).toBe('corp_with_underscores');
    expect(result.userId).toBe('userId');
  });

  test('缺少 csrf_token 时返回 null', () => {
    const cookies = [
      { name: 'tianshu_corp_user', value: 'corpId_userId' },
    ];
    const result = extractInfoFromCookies(cookies);
    expect(result.csrfToken).toBeNull();
    expect(result.corpId).toBe('corpId');
  });

  test('兼容云版注入的 csrf/corp/user cookie 名称', () => {
    const cookies = [
      { name: 'china_csrf_token', value: 'china-token' },
      { name: 'corpId', value: 'corp-cloud' },
      { name: 'staffId', value: 'user-cloud' },
    ];
    const result = extractInfoFromCookies(cookies);
    expect(result.csrfToken).toBe('china-token');
    expect(result.corpId).toBe('corp-cloud');
    expect(result.userId).toBe('user-cloud');
  });

  test('空数组时全部返回 null', () => {
    const result = extractInfoFromCookies([]);
    expect(result.csrfToken).toBeNull();
    expect(result.corpId).toBeNull();
    expect(result.userId).toBeNull();
  });

  test('tianshu_corp_user 无下划线时 corpId 和 userId 均为 null', () => {
    const cookies = [
      { name: 'tianshu_corp_user', value: 'nounderscore' },
    ];
    const result = extractInfoFromCookies(cookies);
    expect(result.corpId).toBeNull();
    expect(result.userId).toBeNull();
  });
});

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
  test('从 cookieData 中读取 base_url 并去除末尾斜杠', () => {
    const cookieData = { base_url: 'https://www.aliwork.com/' };
    expect(resolveBaseUrl(cookieData)).toBe('https://www.aliwork.com');
  });

  test('base_url 无末尾斜杠时原样返回', () => {
    const cookieData = { base_url: 'https://www.aliwork.com' };
    expect(resolveBaseUrl(cookieData)).toBe('https://www.aliwork.com');
  });

  test('cookieData 为 null 时返回默认值', () => {
    expect(resolveBaseUrl(null)).toBe('https://www.aliwork.com');
  });

  test('cookieData 无 base_url 时返回默认值', () => {
    expect(resolveBaseUrl({})).toBe('https://www.aliwork.com');
  });

  test('支持自定义默认值', () => {
    expect(resolveBaseUrl(null, 'https://custom.example.com')).toBe('https://custom.example.com');
  });

  test('去除多个末尾斜杠', () => {
    const cookieData = { base_url: 'https://www.aliwork.com///' };
    expect(resolveBaseUrl(cookieData)).toBe('https://www.aliwork.com');
  });

  test('登录缓存中的实际 base_url 优先于内置非默认环境域名', () => {
    const originalEnv = process.env.OPENYIDA_ENV;
    const originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    process.env.OPENYIDA_ENV = 'alibaba';
    delete process.env.OPENYIDA_ENDPOINT;

    try {
      const cookieData = { base_url: 'https://yida-aliyun.alibaba-inc.com/home' };
      expect(resolveBaseUrl(cookieData)).toBe('https://yida-aliyun.alibaba-inc.com');
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

  test('success 为 true 时返回 false', () => {
    expect(isLoginExpired({ success: true, errorCode: '307' })).toBe(false);
  });

  test('errorCode 不匹配时返回 false', () => {
    expect(isLoginExpired({ success: false, errorCode: '500' })).toBe(false);
  });

  test('null 时返回 falsy', () => {
    expect(isLoginExpired(null)).toBeFalsy();
  });

  test('空对象时返回 false', () => {
    expect(isLoginExpired({})).toBe(false);
  });
});

// ── isCsrfTokenExpired ────────────────────────────────────────────────

describe('isCsrfTokenExpired', () => {
  test('errorCode TIANSHU_000030 时返回 true', () => {
    expect(isCsrfTokenExpired({ success: false, errorCode: 'TIANSHU_000030' })).toBe(true);
  });

  test('success 为 true 时返回 false', () => {
    expect(isCsrfTokenExpired({ success: true, errorCode: 'TIANSHU_000030' })).toBe(false);
  });

  test('errorCode 不匹配时返回 false', () => {
    expect(isCsrfTokenExpired({ success: false, errorCode: 'OTHER_CODE' })).toBe(false);
  });

  test('null 时返回 falsy', () => {
    expect(isCsrfTokenExpired(null)).toBeFalsy();
  });
});

// ── HTTP redirect login detection ────────────────────────────────────

describe('http redirect login detection', () => {
  function listen(server) {
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
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
      const result = await httpPost(`http://127.0.0.1:${port}`, '/bad', '', [
        { name: 'tianshu_csrf_token', value: 'tok' },
      ], { silentStatus: true });

      expect(result).toMatchObject({
        __needLogin: true,
        __httpStatus: 302,
        __location: '/login.html',
      });
    } finally {
      server.close();
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
      const result = await httpGet(`http://127.0.0.1:${port}`, '/bad', { a: 1 }, [
        { name: 'tianshu_csrf_token', value: 'tok' },
      ], { silentStatus: true });

      expect(result).toMatchObject({
        __needLogin: true,
        __httpStatus: 307,
        __location: '/workPlatform',
      });
    } finally {
      server.close();
    }
  });
});

// ── requestWithAutoLogin ──────────────────────────────────────────────

describe('requestWithAutoLogin', () => {
  function loadUtilsWithLoginMock(loginMock) {
    jest.resetModules();
    jest.doMock('../lib/core/i18n', () => ({
      t: (key, ...args) => (args.length ? `${key}: ${args.join(', ')}` : key),
    }));
    jest.doMock('../lib/core/chalk', () => ({
      warn: jest.fn(),
    }));
    jest.doMock('../lib/auth/login', () => loginMock);
    return require('../lib/core/utils');
  }

  afterEach(() => {
    jest.dontMock('../lib/core/i18n');
    jest.dontMock('../lib/core/chalk');
    jest.dontMock('../lib/auth/login');
    jest.resetModules();
  });

  test('登录失效时强制跳过缓存重新登录并重试一次', async () => {
    const newCookieData = {
      csrf_token: 'fresh-token',
      cookies: [{ name: 'tianshu_csrf_token', value: 'fresh-token' }],
      base_url: 'https://fresh.aliwork.com',
    };
    const ensureLogin = jest.fn(() => newCookieData);
    const utils = loadUtilsWithLoginMock({
      ensureLogin,
      refreshCsrfFromCache: jest.fn(),
    });

    const authRef = {
      csrfToken: 'old-token',
      cookies: [{ name: 'tianshu_csrf_token', value: 'old-token' }],
      baseUrl: 'https://www.aliwork.com',
    };
    const requestFn = jest.fn()
      .mockResolvedValueOnce({ __needLogin: true })
      .mockResolvedValueOnce({ success: true });

    const result = await utils.requestWithAutoLogin(requestFn, authRef);

    expect(ensureLogin).toHaveBeenCalledWith({ force: true });
    expect(requestFn).toHaveBeenCalledTimes(2);
    expect(authRef.csrfToken).toBe('fresh-token');
    expect(authRef.cookies).toBe(newCookieData.cookies);
    expect(authRef.baseUrl).toBe('https://fresh.aliwork.com');
    expect(result).toEqual({ success: true });
  });

  test('csrf 刷新失败时升级为强制重新登录', async () => {
    const newCookieData = {
      csrf_token: 'fresh-token',
      cookies: [{ name: 'tianshu_csrf_token', value: 'fresh-token' }],
      base_url: 'https://www.aliwork.com',
    };
    const ensureLogin = jest.fn(() => newCookieData);
    const refreshCsrfFromCache = jest.fn(() => null);
    const utils = loadUtilsWithLoginMock({
      ensureLogin,
      refreshCsrfFromCache,
    });
    const requestFn = jest.fn()
      .mockResolvedValueOnce({ __csrfExpired: true })
      .mockResolvedValueOnce({ success: true });

    const result = await utils.requestWithAutoLogin(requestFn, {
      csrfToken: 'old-token',
      cookies: [{ name: 'tianshu_csrf_token', value: 'old-token' }],
      baseUrl: 'https://www.aliwork.com',
    });

    expect(refreshCsrfFromCache).toHaveBeenCalledTimes(1);
    expect(ensureLogin).toHaveBeenCalledWith({ force: true });
    expect(requestFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  });

  test('强制重新登录失败时返回明确失败结果，不再用旧 Cookie 重试', async () => {
    const ensureLogin = jest.fn(() => null);
    const utils = loadUtilsWithLoginMock({
      ensureLogin,
      refreshCsrfFromCache: jest.fn(),
    });
    const requestFn = jest.fn().mockResolvedValueOnce({ __needLogin: true });

    const result = await utils.requestWithAutoLogin(requestFn, {
      csrfToken: 'old-token',
      cookies: [{ name: 'tianshu_csrf_token', value: 'old-token' }],
      baseUrl: 'https://www.aliwork.com',
    });

    expect(ensureLogin).toHaveBeenCalledWith({ force: true });
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      __needLogin: true,
    });
  });

  test('YIDA_AUTH_ENABLED=true 时登录失效不触发交互式重新登录', async () => {
    const originalYidaAuthEnabled = process.env.YIDA_AUTH_ENABLED;
    process.env.YIDA_AUTH_ENABLED = 'true';

    try {
      const ensureLogin = jest.fn(() => {
        throw new Error('should not call ensureLogin in injected auth mode');
      });
      const utils = loadUtilsWithLoginMock({
        ensureLogin,
        refreshCsrfFromCache: jest.fn(),
      });
      const requestFn = jest.fn().mockResolvedValueOnce({ __needLogin: true });

      const result = await utils.requestWithAutoLogin(requestFn, {
        csrfToken: 'old-token',
        cookies: [{ name: 'tianshu_csrf_token', value: 'old-token' }],
        baseUrl: 'https://www.aliwork.com',
      });

      expect(ensureLogin).not.toHaveBeenCalled();
      expect(requestFn).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        __needLogin: true,
        errorCode: 'INJECTED_AUTH_REQUIRED',
      });
      expect(result.errorMsg).toContain('not_logged_in');
    } finally {
      if (originalYidaAuthEnabled === undefined) {
        delete process.env.YIDA_AUTH_ENABLED;
      } else {
        process.env.YIDA_AUTH_ENABLED = originalYidaAuthEnabled;
      }
    }
  });
});

// ── loadCookieData ────────────────────────────────────────────────────

describe('loadCookieData', () => {
  const tmpDir = path.join(os.tmpdir(), `yida-test-${Date.now()}`);
  const cacheDir = path.join(tmpDir, '.cache');
  const cookieFile = path.join(cacheDir, 'cookies.json');

  beforeEach(() => {
    fs.mkdirSync(cacheDir, { recursive: true });
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
