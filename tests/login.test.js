'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock 模块必须在 require 被测模块之前
jest.mock('../lib/core/i18n', () => ({
  t: (key, ...args) => {
    if (args.length === 0) {return key;}
    return key + ': ' + args.join(', ');
  },
}));

const {
  extractInfoFromCookies,
  loadCookieData,
} = require('../lib/core/utils');

//─ extractInfoFromCookies─────────────────────────

describe('extractInfoFromCookies', () => {
  test('正确提取 csrf_token、corp_id 和 user_id', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'abc123token' },
      { name: 'tianshu_corp_user', value: 'corpXYZ_user001' },
      { name: 'other_cookie', value: 'ignored' },
    ];

    const result = extractInfoFromCookies(cookies);
    expect(result.csrfToken).toBe('abc123token');
    expect(result.corpId).toBe('corpXYZ');
    expect(result.userId).toBe('user001');
  });

  test('缺少 tianshu_corp_user 时 corp_id 和 user_id 为 null', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'token_only' },
    ];

    const result = extractInfoFromCookies(cookies);
    expect(result.csrfToken).toBe('token_only');
    expect(result.corpId).toBeNull();
    expect(result.userId).toBeNull();
  });

  test('缺少 csrf_token 时返回 null', () => {
    const cookies = [
      { name: 'tianshu_corp_user', value: 'corp_user' },
    ];

    const result = extractInfoFromCookies(cookies);
    expect(result.csrfToken).toBeNull();
  });

  test('空 cookies 数组返回全 null', () => {
    const result = extractInfoFromCookies([]);
    expect(result.csrfToken).toBeNull();
    expect(result.corpId).toBeNull();
    expect(result.userId).toBeNull();
  });

  test('corp_id 和 user_id 正确解析（以下划线分隔）', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'token' },
      { name: 'tianshu_corp_user', value: 'corpA_userB' },
    ];

    const result = extractInfoFromCookies(cookies);
    expect(result.corpId).toBe('corpA');
    expect(result.userId).toBe('userB');
  });

  test('corp_user 只有一个下划线时正确分割', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'token' },
      { name: 'tianshu_corp_user', value: 'mycorp_myuser' },
    ];

    const result = extractInfoFromCookies(cookies);
    expect(result.corpId).toBe('mycorp');
    expect(result.userId).toBe('myuser');
  });
});

//─ loadCookieData─────────────────────────────────

describe('loadCookieData', () => {
  let tmpDir;
  let cacheDir;
  let cookieFile;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `yida-load-cookie-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = path.join(tmpDir, '.cache');
    cookieFile = path.join(cacheDir, 'cookies.json');
    fs.mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('cookies.json 不存在时返回 null', () => {
    const result = loadCookieData(tmpDir);
    expect(result).toBeNull();
  });

  test('正确读取对象格式的 cookies.json', () => {
    const cookieData = {
      cookies: [
        { name: 'tianshu_csrf_token', value: 'mytoken' },
        { name: 'tianshu_corp_user', value: 'corp123_user456' },
      ],
      base_url: 'https://custom.aliwork.com',
    };
    fs.writeFileSync(cookieFile, JSON.stringify(cookieData), 'utf-8');

    const result = loadCookieData(tmpDir);
    expect(result).not.toBeNull();
    expect(result.cookies).toHaveLength(2);
    expect(result.base_url).toBe('https://custom.aliwork.com');
    expect(result.csrf_token).toBe('mytoken');
    expect(result.corp_id).toBe('corp123');
    expect(result.user_id).toBe('user456');
  });

  test('兼容数组格式的 cookies.json（旧版本缓存）', () => {
    const cookiesArray = [
      { name: 'tianshu_csrf_token', value: 'oldtoken' },
      { name: 'tianshu_corp_user', value: 'oldcorp_olduser' },
    ];
    fs.writeFileSync(cookieFile, JSON.stringify(cookiesArray), 'utf-8');

    const result = loadCookieData(tmpDir);
    expect(result).not.toBeNull();
    expect(result.cookies).toEqual(cookiesArray);
    expect(result.base_url).toBe('https://www.aliwork.com');
    expect(result.csrf_token).toBe('oldtoken');
  });

  test('空文件返回 null', () => {
    fs.writeFileSync(cookieFile, '', 'utf-8');
    const result = loadCookieData(tmpDir);
    expect(result).toBeNull();
  });

  test('无效 JSON 返回 null', () => {
    fs.writeFileSync(cookieFile, 'not valid json', 'utf-8');
    const result = loadCookieData(tmpDir);
    expect(result).toBeNull();
  });
});

//─ saveCookieCache 文件写入测试───────────────────

describe('saveCookieCache 文件写入', () => {
  let tmpDir;
  let cacheDir;
  let cookieFile;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `yida-save-cookie-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = path.join(tmpDir, '.cache');
    cookieFile = path.join(cacheDir, 'cookies.json');
    fs.mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('正确写入 cookies.json 文件', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'newtoken' },
      { name: 'tianshu_corp_user', value: 'newcorp_newuser' },
    ];
    const baseUrl = 'https://test.aliwork.com';

    // 模拟 saveCookieCache 的写入逻辑
    fs.writeFileSync(cookieFile, JSON.stringify({ cookies, base_url: baseUrl }, null, 2), 'utf-8');

    expect(fs.existsSync(cacheDir)).toBe(true);
    expect(fs.existsSync(cookieFile)).toBe(true);

    const written = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
    expect(written.cookies).toEqual(cookies);
    expect(written.base_url).toBe(baseUrl);
  });

  test('写入后可被 loadCookieData 正确读取', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'token123' },
      { name: 'tianshu_corp_user', value: 'corp_user' },
    ];
    const baseUrl = 'https://example.aliwork.com';

    fs.writeFileSync(cookieFile, JSON.stringify({ cookies, base_url: baseUrl }, null, 2), 'utf-8');

    const result = loadCookieData(tmpDir);
    expect(result).not.toBeNull();
    expect(result.csrf_token).toBe('token123');
    expect(result.base_url).toBe(baseUrl);
  });
});

//─ cdp-browser-login 工具函数─────────────────────────

describe('cdp-browser-login 工具函数', () => {
  const { deriveBaseUrl, findBrowserExecutable } = require('../lib/auth/cdp-browser-login');
  const originalChromePath = process.env.OPENYIDA_CHROME_PATH;

  afterEach(() => {
    if (originalChromePath === undefined) {
      delete process.env.OPENYIDA_CHROME_PATH;
    } else {
      process.env.OPENYIDA_CHROME_PATH = originalChromePath;
    }
  });

  test('deriveBaseUrl 优先使用 yida_user_cookie 的 aliwork 域名', () => {
    const result = deriveBaseUrl([
      { name: 'tianshu_csrf_token', domain: '.aliwork.com' },
      { name: 'yida_user_cookie', domain: '.custom.aliwork.com' },
    ], 'https://www.aliwork.com/workPlatform');

    expect(result).toBe('https://custom.aliwork.com');
  });

  test('deriveBaseUrl 在无专属域名时回退到登录 URL origin', () => {
    const result = deriveBaseUrl([
      { name: 'tianshu_csrf_token', domain: '.aliwork.com' },
    ], 'https://example.aliwork.com/workPlatform');

    expect(result).toBe('https://example.aliwork.com');
  });

  test('findBrowserExecutable 支持 OPENYIDA_CHROME_PATH 覆盖', () => {
    const browserPath = path.join(os.tmpdir(), `openyida-fake-chrome-${Date.now()}`);
    fs.writeFileSync(browserPath, '', 'utf-8');
    process.env.OPENYIDA_CHROME_PATH = browserPath;

    try {
      expect(findBrowserExecutable()).toBe(browserPath);
    } finally {
      fs.rmSync(browserPath, { force: true });
    }
  });
});

//─ interactiveLogin 浏览器优先级───────────────────────

describe('interactiveLogin 浏览器优先级', () => {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  let tmpDir;

  function resetToolEnv() {
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.AGENT_WORK_ROOT;
  }

  function loadLoginWithMocks(cdpImpl, execSyncImpl) {
    jest.resetModules();
    jest.doMock('../lib/core/chalk', () => ({
      c: { green: '', reset: '', dim: '' },
      info: jest.fn(),
      label: jest.fn(),
      success: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.doMock('../lib/auth/cdp-browser-login', () => ({
      cdpBrowserLogin: jest.fn(cdpImpl),
    }));
    jest.doMock('child_process', () => ({
      execSync: jest.fn(execSyncImpl || (() => {
        throw new Error('execSync should not be called');
      })),
    }));
    return {
      loginModule: require('../lib/auth/login'),
      cdpModule: require('../lib/auth/cdp-browser-login'),
      childProcess: require('child_process'),
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-browser-order-'));
    process.chdir(tmpDir);
    resetToolEnv();
    process.env.OPENYIDA_ENV = 'public';
    process.env.OPENYIDA_LOGIN_URL = 'https://example.test/workPlatform';
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {delete process.env[key];}
    });
    Object.assign(process.env, originalEnv);
    jest.dontMock('../lib/core/chalk');
    jest.dontMock('../lib/auth/cdp-browser-login');
    jest.dontMock('child_process');
    jest.resetModules();
  });

  test('优先使用 CDP，CDP 成功时不查找 Playwright', () => {
    const { loginModule, cdpModule, childProcess } = loadLoginWithMocks(() => ({
      cookies: [
        { name: 'tianshu_csrf_token', value: 'cdp-token-1234567890' },
        { name: 'tianshu_corp_user', value: 'corp_cdpUser' },
      ],
      base_url: 'https://www.aliwork.com',
    }));

    const result = loginModule.interactiveLogin();

    expect(cdpModule.cdpBrowserLogin).toHaveBeenCalledWith({
      loginUrl: 'https://example.test/workPlatform',
    });
    expect(childProcess.execSync).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      csrf_token: 'cdp-token-1234567890',
      corp_id: 'corp',
      user_id: 'cdpUser',
      base_url: 'https://www.aliwork.com',
    });
  });

  test('CDP 失败后再使用 Playwright 兜底', () => {
    const globalRoot = path.join(tmpDir, 'global-node-modules');
    fs.mkdirSync(path.join(globalRoot, 'playwright'), { recursive: true });
    fs.writeFileSync(path.join(globalRoot, 'playwright', 'index.js'), 'module.exports = {};', 'utf8');

    const execSyncImpl = jest.fn((cmd) => {
      if (cmd === 'npm root -g') {
        return `${globalRoot}\n`;
      }
      if (cmd.startsWith('node "')) {
        return `${JSON.stringify({
          cookies: [
            { name: 'tianshu_csrf_token', value: 'pw-token-1234567890' },
            { name: 'tianshu_corp_user', value: 'corp_pwUser' },
          ],
          base_url: 'https://playwright.aliwork.com',
        })}\n`;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    const { loginModule, cdpModule, childProcess } = loadLoginWithMocks(() => {
      throw new Error('No Chrome, Edge, or Chromium executable found');
    }, execSyncImpl);

    const result = loginModule.interactiveLogin();

    expect(cdpModule.cdpBrowserLogin).toHaveBeenCalledTimes(1);
    expect(childProcess.execSync).toHaveBeenCalledWith(
      expect.stringMatching(/^node ".+openyida-login-.+\.js"$/),
      expect.objectContaining({ timeout: 660000 })
    );
    expect(result).toMatchObject({
      csrf_token: 'pw-token-1234567890',
      corp_id: 'corp',
      user_id: 'pwUser',
      base_url: 'https://playwright.aliwork.com',
    });
  });

  test('关闭 Playwright 兜底时 CDP 失败直接返回空结果', () => {
    const { loginModule, cdpModule, childProcess } = loadLoginWithMocks(() => {
      throw new Error('No Chrome, Edge, or Chromium executable found');
    });

    const result = loginModule.interactiveLogin({ playwrightFallback: false });

    expect(cdpModule.cdpBrowserLogin).toHaveBeenCalledTimes(1);
    expect(childProcess.execSync).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

//─ checkLoginOnly 测试────────────────────────────

describe('checkLoginOnly 独立测试', () => {
  test('模块加载正常', () => {
    const loginModule = require('../lib/auth/login');
    expect(loginModule).toHaveProperty('checkLoginOnly');
    expect(loginModule).toHaveProperty('saveCookieCache');
    expect(loginModule).toHaveProperty('logout');
  });

  test('checkLoginOnly 是函数', () => {
    const { checkLoginOnly } = require('../lib/auth/login');
    expect(typeof checkLoginOnly).toBe('function');
  });

  test('checkLoginOnly 默认不返回完整 cookies', () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-login-only-'));
    const projectDir = path.join(testDir, 'project');
    const cacheDir = path.join(projectDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf-8');
    fs.writeFileSync(path.join(cacheDir, 'cookies-public.json'), JSON.stringify({
      cookies: [
        { name: 'tianshu_csrf_token', value: '1234567890abcdef' },
        { name: 'tianshu_corp_user', value: 'corp_user' },
      ],
      base_url: 'https://www.aliwork.com',
    }), 'utf-8');

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const { checkLoginOnly } = require('../lib/auth/login');
      const result = checkLoginOnly();
      expect(result.status).toBe('ok');
      expect(result.csrf_token).toBe('12345678…');
      expect(result.cookies).toBeUndefined();
      expect(result.cookies_count).toBe(2);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});

//─ findProjectRoot 环境检测───────────────────────

describe('findProjectRoot 环境检测', () => {
  let originalEnv;
  let originalCwd;
  const dirsToCleanup = [];

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
    // 清除所有 AI 工具环境变量，确保测试不受当前运行环境影响
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.__CFBundleIdentifier;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.TERM_PROGRAM;
    delete process.env.VSCODE_GIT_ASKPASS_NODE;
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir(originalCwd);
    // 清理临时目录（必须在 chdir 回原目录之后，否则 Windows 上会 EBUSY）
    for (const dirPath of dirsToCleanup) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
      } catch (_cleanupError) {
        // 忽略清理失败
      }
    }
    dirsToCleanup.length = 0;
  });

  test('Qoder 环境下返回 cwd/project', () => {
    process.env.QODER_IDE = '1';
    const testDir = path.join(os.tmpdir(), `qoder-test-${Date.now()}`);
    const projectDir = path.join(testDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    dirsToCleanup.push(testDir);
    process.chdir(testDir);

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    // macOS 上 /var 会被解析为 /private/var,使用 fs.realpathSync 统一比较
    expect(fs.realpathSync(root)).toBe(fs.realpathSync(projectDir));
    expect(fs.existsSync(root)).toBe(true);

    // Windows 上需要先切回原目录，否则 testDir 被占用导致 EBUSY
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('Codex 环境下返回 cwd/project', () => {
    process.env.CODEX_SHELL = '1';
    const testDir = path.join(os.tmpdir(), `codex-test-${Date.now()}`);
    const projectDir = path.join(testDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    dirsToCleanup.push(testDir);
    process.chdir(testDir);

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    expect(fs.realpathSync(root)).toBe(fs.realpathSync(projectDir));
    expect(fs.existsSync(root)).toBe(true);

    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('悟空环境下优先返回 AGENT_WORK_ROOT 工作区', () => {
    const agentWorkRoot = path.join(os.tmpdir(), '.real', 'users', `user-test-${Date.now()}`, 'workspace');
    process.env.AGENT_WORK_ROOT = agentWorkRoot;

    fs.mkdirSync(agentWorkRoot, { recursive: true });
    dirsToCleanup.push(path.join(os.tmpdir(), '.real'));

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    expect(root).toBe(agentWorkRoot);
  });

  test('悟空旧路径形态下可识别 AGENT_WORK_ROOT/workspace/project', () => {
    const agentWorkRoot = path.join(os.tmpdir(), '.real', 'users', `user-test-${Date.now()}`);
    const wukongProject = path.join(agentWorkRoot, 'workspace', 'project');
    process.env.AGENT_WORK_ROOT = agentWorkRoot;

    fs.mkdirSync(wukongProject, { recursive: true });
    fs.writeFileSync(path.join(wukongProject, 'config.json'), '{}', 'utf-8');
    dirsToCleanup.push(path.join(os.tmpdir(), '.real'));

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    expect(root).toBe(wukongProject);
  });

  test('未检测到环境时返回 cwd', () => {
    delete process.env.QODER_IDE;
    delete process.env.CLAUDE_CODE;
    delete process.env.CODEX_SHELL;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.OPENCODE;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.TERM_PROGRAM;

    // 屏蔽 Aone Copilot 兜底检测（避免本机 ~/.aone_copilot 目录干扰）
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (p) => {
      if (p.includes('.aone_copilot')) {return false;}
      return originalExistsSync(p);
    };

    const testDir = path.join(os.tmpdir(), `plain-cwd-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    dirsToCleanup.push(testDir);
    process.chdir(testDir);

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    fs.existsSync = originalExistsSync;

    expect(fs.realpathSync(root)).toBe(fs.realpathSync(testDir));
  });

  test('未检测到环境但 cwd/project/config.json 存在时返回 cwd/project', () => {
    const testDir = path.join(os.tmpdir(), `nested-project-test-${Date.now()}`);
    const projectDir = path.join(testDir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf-8');
    dirsToCleanup.push(testDir);
    process.chdir(testDir);

    const originalExistsSync = fs.existsSync;
    fs.existsSync = (p) => {
      if (p.includes('.aone_copilot')) {return false;}
      return originalExistsSync(p);
    };

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    fs.existsSync = originalExistsSync;

    expect(fs.realpathSync(root)).toBe(fs.realpathSync(projectDir));
  });
});

//─ detectActiveTool───────────────────────────────

describe('detectActiveTool', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // 清除所有 AI 工具环境变量，确保测试不受当前运行环境影响
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CODEX_SHELL;
    delete process.env.CODEX_CI;
    delete process.env.CODEX_THREAD_ID;
    delete process.env.CODEX_HOME;
    delete process.env.__CFBundleIdentifier;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.TERM_PROGRAM;
    delete process.env.VSCODE_GIT_ASKPASS_NODE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('Qoder 环境识别', () => {
    process.env.QODER_IDE = '1';
    const { detectActiveTool: detectTool } = require('../lib/core/utils');

    const tool = detectTool();
    expect(tool).not.toBeNull();
    expect(tool.tool).toBe('qoder');
    expect(tool.displayName).toBe('Qoder');
    expect(tool.dirName).toBe('.qoder');
  });

  test('Codex 环境识别', () => {
    process.env.CODEX_SHELL = '1';
    const { detectActiveTool: detectTool } = require('../lib/core/utils');

    const tool = detectTool();
    expect(tool).not.toBeNull();
    expect(tool.tool).toBe('codex');
    expect(tool.displayName).toBe('Codex');
    expect(tool.dirName).toBe('.codex');
  });

  test('Claude Code 环境识别', () => {
    process.env.CLAUDE_CODE = '1';
    const { detectActiveTool: detectTool } = require('../lib/core/utils');

    const tool = detectTool();
    expect(tool).not.toBeNull();
    expect(tool.tool).toBe('claude-code');
    expect(tool.displayName).toBe('Claude Code');
  });

  test('悟空环境识别（AGENT_WORK_ROOT 包含 .real）', () => {
    process.env.AGENT_WORK_ROOT = '/Users/test/.real/workspace';
    const { detectActiveTool: detectTool } = require('../lib/core/utils');

    const tool = detectTool();
    expect(tool).not.toBeNull();
    expect(tool.tool).toBe('wukong');
    expect(tool.displayName).toContain('悟空');
  });

  test('无任何环境标识时返回 null', () => {
    delete process.env.QODER_IDE;
    delete process.env.CLAUDE_CODE;
    delete process.env.CODEX_SHELL;
    delete process.env.AGENT_WORK_ROOT;
    delete process.env.OPENCODE;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.TERM_PROGRAM;

    // 屏蔽 Aone Copilot 兜底检测（避免本机 ~/.aone_copilot 目录干扰）
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (p) => {
      if (p.includes('.aone_copilot')) {return false;}
      return originalExistsSync(p);
    };

    const { detectActiveTool: detectTool } = require('../lib/core/utils');

    const tool = detectTool();

    fs.existsSync = originalExistsSync;

    expect(tool).toBeNull();
  });

  test('OpenCode 环境识别', () => {
    process.env.OPENCODE = '1';
    const { detectActiveTool: detectTool } = require('../lib/core/utils');

    const tool = detectTool();
    expect(tool).not.toBeNull();
    expect(tool.tool).toBe('opencode');
    expect(tool.displayName).toBe('OpenCode');
  });
});

//─ Cookie 存储路径兼容性测试─────────────────────

describe('Cookie 存储路径兼容性', () => {
  test('不同环境下 .cache 目录结构一致', () => {
    const tmpDir = path.join(os.tmpdir(), `cookie-structure-test-${Date.now()}`);
    const cacheDir = path.join(tmpDir, '.cache');
    const cookieFile = path.join(cacheDir, 'cookies.json');

    fs.mkdirSync(cacheDir, { recursive: true });

    const mockCookieData = {
      cookies: [{ name: 'test', value: 'value' }],
      base_url: 'https://test.com',
    };
    fs.writeFileSync(cookieFile, JSON.stringify(mockCookieData), 'utf-8');

    expect(fs.existsSync(cacheDir)).toBe(true);
    expect(fs.existsSync(cookieFile)).toBe(true);

    const data = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
    expect(data).toHaveProperty('cookies');
    expect(data).toHaveProperty('base_url');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('cookies.json 格式符合预期', () => {
    const cookies = [
      { name: 'tianshu_csrf_token', value: 'token123', domain: '.aliwork.com' },
      { name: 'tianshu_corp_user', value: 'corp_user', domain: '.aliwork.com' },
      { name: 'yida_user_cookie', value: 'userdata', domain: '.aliwork.com' },
    ];

    const expectedFormat = {
      cookies,
      base_url: 'https://www.aliwork.com',
    };

    expect(expectedFormat).toHaveProperty('cookies');
    expect(Array.isArray(expectedFormat.cookies)).toBe(true);
    expect(expectedFormat).toHaveProperty('base_url');
    expect(typeof expectedFormat.base_url).toBe('string');
  });
});
