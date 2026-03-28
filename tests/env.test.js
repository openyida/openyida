'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { detectEnvironment, detectLoginStatus } = require('../lib/core/env');

// ── detectEnvironment ─────────────────────────────────────────────────

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

  test('results 中最多只有一个 isActive 为 true 的工具', () => {
    const { results } = detectEnvironment();
    const activeCount = results.filter((item) => item.isActive).length;
    expect(activeCount).toBeLessThanOrEqual(1);
  });

  test('activeToolName 与 results 中 isActive 项一致', () => {
    const { activeToolName, results } = detectEnvironment();
    const activeItem = results.find((item) => item.isActive);
    if (activeItem) {
      expect(activeToolName).toBe(activeItem.displayName);
    } else {
      expect(activeToolName).toBeNull();
    }
  });

  test('悟空工具的 workspaceRoot 指向 .real/workspace/project', () => {
    const { results } = detectEnvironment();
    const wukong = results.find((item) => item.dirName === '.real');
    if (wukong) {
      expect(wukong.workspaceRoot).toContain(path.join('.real', 'workspace', 'project'));
    }
  });

  test('非悟空工具的 workspaceRoot 指向当前工作目录下的 project', () => {
    const { results } = detectEnvironment();
    const nonWukong = results.filter((item) => item.dirName !== '.real');
    const expectedRoot = path.join(process.cwd(), 'project');
    for (const item of nonWukong) {
      expect(item.workspaceRoot).toBe(expectedRoot);
    }
  });
});

// ── detectLoginStatus ─────────────────────────────────────────────────

describe('detectLoginStatus', () => {
  const tmpDir = path.join(os.tmpdir(), `yida-env-test-${Date.now()}`);
  const cacheDir = path.join(tmpDir, '.cache');
  const cookieFile = path.join(cacheDir, 'cookies.json');

  beforeEach(() => {
    fs.mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('未登录时返回 loggedIn: false 及 null 字段', () => {
    const result = detectLoginStatus(tmpDir);
    expect(result.loggedIn).toBe(false);
    expect(result.csrfToken).toBeNull();
    expect(result.corpId).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.baseUrl).toBeNull();
  });

  test('cookies.json 不存在时返回 loggedIn: false', () => {
    // cacheDir 存在但 cookies.json 不存在
    const result = detectLoginStatus(tmpDir);
    expect(result.loggedIn).toBe(false);
  });

  test('有效 cookies 时返回 loggedIn: true 及正确字段', () => {
    const cookieData = {
      cookies: [
        { name: 'tianshu_csrf_token', value: 'mytoken123' },
        { name: 'tianshu_corp_user', value: 'corpABC_user456' },
      ],
      base_url: 'https://www.aliwork.com',
    };
    fs.writeFileSync(cookieFile, JSON.stringify(cookieData), 'utf-8');

    const result = detectLoginStatus(tmpDir);
    expect(result.loggedIn).toBe(true);
    expect(result.csrfToken).toBe('mytoken123');
    expect(result.corpId).toBe('corpABC');
    expect(result.userId).toBe('user456');
    expect(result.baseUrl).toBe('https://www.aliwork.com');
  });

  test('有效 cookies 但无 base_url 时使用默认值', () => {
    const cookieData = {
      cookies: [
        { name: 'tianshu_csrf_token', value: 'tok' },
        { name: 'tianshu_corp_user', value: 'corp_user' },
      ],
    };
    fs.writeFileSync(cookieFile, JSON.stringify(cookieData), 'utf-8');

    const result = detectLoginStatus(tmpDir);
    expect(result.loggedIn).toBe(true);
    expect(result.baseUrl).toBe('https://www.aliwork.com');
  });

  test('cookies 中无 csrf_token 时 loggedIn 为 false', () => {
    const cookieData = {
      cookies: [
        { name: 'tianshu_corp_user', value: 'corp_user' },
      ],
    };
    fs.writeFileSync(cookieFile, JSON.stringify(cookieData), 'utf-8');

    const result = detectLoginStatus(tmpDir);
    expect(result.loggedIn).toBe(false);
    expect(result.csrfToken).toBeNull();
  });

  test('cookies 数组为空时 loggedIn 为 false', () => {
    const cookieData = { cookies: [] };
    fs.writeFileSync(cookieFile, JSON.stringify(cookieData), 'utf-8');

    const result = detectLoginStatus(tmpDir);
    expect(result.loggedIn).toBe(false);
  });

  test('自定义 base_url 末尾有斜杠时自动去除', () => {
    const cookieData = {
      cookies: [
        { name: 'tianshu_csrf_token', value: 'tok' },
      ],
      base_url: 'https://custom.aliwork.com/',
    };
    fs.writeFileSync(cookieFile, JSON.stringify(cookieData), 'utf-8');

    const result = detectLoginStatus(tmpDir);
    expect(result.baseUrl).toBe('https://custom.aliwork.com');
  });
});
