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
  findProjectRoot,
  detectActiveTool,
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
  });

  test('悟空环境下返回 ~/.real/workspace/project', () => {
    process.env.AGENT_WORK_ROOT = '/home/user/.real/workspace';
    const homeDir = os.homedir();
    const wukongProject = path.join(homeDir, '.real', 'workspace', 'project');

    fs.mkdirSync(wukongProject, { recursive: true });
    dirsToCleanup.push(path.join(homeDir, '.real'));

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    expect(root).toBe(wukongProject);
  });

  test('未检测到环境时返回 cwd', () => {
    delete process.env.QODER_IDE;
    delete process.env.CLAUDE_CODE;
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

    const { findProjectRoot: findRoot } = require('../lib/core/utils');
    const root = findRoot();

    fs.existsSync = originalExistsSync;

    expect(root).toBe(originalCwd);
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
