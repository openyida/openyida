'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

// 测试目标模块
const {
  extractInfoFromCookies,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  loadCookieData,
  detectActiveTool,
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
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
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

  test('OPENCODE 环境变量时检测为 OpenCode', () => {
    delete process.env.CLAUDE_CODE;
    process.env.OPENCODE = '1';
    const result = detectActiveTool();
    expect(result.tool).toBe('opencode');
  });

  test('QODER_IDE 环境变量时检测为 Qoder（优先级最高）', () => {
    process.env.QODER_IDE = '1';
    process.env.CLAUDE_CODE = '1';
    const result = detectActiveTool();
    expect(result.tool).toBe('qoder');
  });

  test('AGENT_WORK_ROOT 包含 .real 时检测为悟空', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.CURSOR_TRACE_ID;
    process.env.AGENT_WORK_ROOT = '/home/user/.real/workspace';
    const result = detectActiveTool();
    expect(result.tool).toBe('wukong');
    expect(result.workspaceRoot).toContain('project');
  });

  test('TERM_PROGRAM=vscode 且有 .aone_copilot 目录时检测为 Aone Copilot', () => {
    delete process.env.CLAUDE_CODE;
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
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
    delete process.env.OPENCODE;
    delete process.env.QODER_IDE;
    delete process.env.QODER_AGENT;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.AGENT_WORK_ROOT;
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
