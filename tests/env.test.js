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
  let originalAccessToken;
  let originalEndpoint;
  let originalCorpId;
  let originalUserId;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-env-token-'));
    originalAuthEnabled = process.env.YIDA_AUTH_ENABLED;
    originalAccessToken = process.env.OPENYIDA_ACCESS_TOKEN;
    originalEndpoint = process.env.OPENYIDA_ENDPOINT;
    originalCorpId = process.env.OPENYIDA_TOKEN_CORP_ID;
    originalUserId = process.env.OPENYIDA_TOKEN_USER_ID;
    delete process.env.YIDA_AUTH_ENABLED;
    delete process.env.OPENYIDA_ACCESS_TOKEN;
    delete process.env.OPENYIDA_ENDPOINT;
    delete process.env.OPENYIDA_TOKEN_CORP_ID;
    delete process.env.OPENYIDA_TOKEN_USER_ID;
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
    restore('OPENYIDA_ACCESS_TOKEN', originalAccessToken);
    restore('OPENYIDA_ENDPOINT', originalEndpoint);
    restore('OPENYIDA_TOKEN_CORP_ID', originalCorpId);
    restore('OPENYIDA_TOKEN_USER_ID', originalUserId);
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
      authSource: 'local',
      authMode: 'token',
    });
    expect(result.diagnostics.tokenFileFound).toBe(true);
    expect(result.diagnostics.tokenFound).toBe(true);
  });

  test('YIDA_AUTH_ENABLED=true 时返回宿主注入 token 状态', () => {
    process.env.YIDA_AUTH_ENABLED = 'true';
    process.env.OPENYIDA_ACCESS_TOKEN = 'env-access-token';
    process.env.OPENYIDA_ENDPOINT = 'https://env-token.example.com';
    process.env.OPENYIDA_TOKEN_CORP_ID = 'corpEnv';
    process.env.OPENYIDA_TOKEN_USER_ID = 'userEnv';

    const result = detectLoginStatus(tmpDir);
    expect(result).toMatchObject({
      loggedIn: true,
      canAutoUse: true,
      corpId: 'corpEnv',
      userId: 'userEnv',
      authSource: 'env',
      authMode: 'token',
    });
    expect(result.diagnostics).toMatchObject({
      authMode: 'token',
      authSource: 'env',
      tokenFound: true,
    });
  });
});

describe('run', () => {
  let originalAuthEnabled;

  beforeEach(() => {
    originalAuthEnabled = process.env.YIDA_AUTH_ENABLED;
    delete process.env.YIDA_AUTH_ENABLED;
  });

  afterEach(() => {
    if (originalAuthEnabled === undefined) {
      delete process.env.YIDA_AUTH_ENABLED;
    } else {
      process.env.YIDA_AUTH_ENABLED = originalAuthEnabled;
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
