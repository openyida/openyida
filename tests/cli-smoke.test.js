'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { version } = require('../package.json');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

let tempHome;

beforeAll(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-cli-smoke-'));
});

afterAll(() => {
  fs.rmSync(tempHome, { recursive: true, force: true });
});

function cliEnv() {
  return {
    ...process.env,
    HOME: tempHome,
    USERPROFILE: tempHome,
    OPENYIDA_LANG: 'zh',
    CI: '1',
    // 清除可能从父进程继承的 AI 工具环境变量，避免干扰测试
    QODER_IDE: '',
    QODER_AGENT: '',
  };
}

function runOk(args) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    env: cliEnv(),
    encoding: 'utf8',
    timeout: 10000,
  });
}

function runOkWithEnv(args, extraEnv, cwd = ROOT) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...cliEnv(), ...extraEnv },
    encoding: 'utf8',
    timeout: 10000,
  });
}

function createCodexWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-codex-login-'));
  const projectDir = path.join(workspace, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf8');
  return workspace;
}

function runAny(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    env: cliEnv(),
    encoding: 'utf8',
    timeout: 10000,
  });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

describe('CLI offline smoke', () => {
  test('--version prints package version without requiring login', () => {
    expect(runOk(['--version']).trim()).toBe(version);
  });

  test('--help renders top-level command groups', () => {
    const output = runOk(['--help']);
    expect(output).toContain('OpenYida');
    expect(output).toContain('login [--qr|--browser] [--corp-id <corpId>]');
    expect(output).toContain('create-form');
    expect(output).toContain('connector');
    expect(output).toContain('dws');
    expect(output).toContain('sample [--list]');
    expect(output).toContain('generate-page <template>');
    expect(output).toContain('check-page <src>');
    expect(output).toContain('compile <src>');
  });

  test('sample --list renders available templates without network access', () => {
    const output = runOk(['sample', '--list']);
    expect(output).toContain('yida-custom-page');
    expect(output).toContain('product-homepage');
  });

  test('connector --help renders subcommands without network access', () => {
    const output = runOk(['connector', '--help']);
    expect(output).toContain('openyida connector');
    expect(output).toContain('smart-create');
    expect(output).toContain('parse-api');
  });

  test('login auto-selects Codex browser handoff in Codex environment', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_codex_browser_login',
        browser: 'codex',
        login_url: 'https://example.test/workPlatform',
        can_auto_use: false,
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login uses cached CLI credentials before Codex browser handoff', () => {
    const workspace = createCodexWorkspace();
    const cacheDir = path.join(workspace, 'project', '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies-public.json'), JSON.stringify({
      cookies: [
        { name: 'tianshu_csrf_token', value: 'cached-token-1234567890' },
        { name: 'tianshu_corp_user', value: 'corp_cachedUser' },
      ],
      base_url: 'https://www.aliwork.com',
    }), 'utf8');

    try {
      const output = runOkWithEnv(['login'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        ok: true,
        base_url: 'https://www.aliwork.com',
        corp_id: 'corp',
        user_id: 'cachedUser',
        cookies_count: 2,
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login --codex explicitly returns Codex browser handoff', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login', '--codex'], {
        CODEX_SHELL: '1',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_codex_browser_login',
        browser: 'codex',
        login_url: 'https://example.test/workPlatform',
        can_auto_use: false,
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('missing required arguments fail fast before login or network work', () => {
    const cases = [
      { args: ['publish'], expected: 'openyida publish' },
      { args: ['compile'], expected: 'openyida compile' },
      { args: ['check-page'], expected: 'openyida check-page' },
      { args: ['get-page-config'], expected: 'get-page-config' },
      { args: ['process', 'preview'], expected: 'process preview' },
      { args: ['connector', 'missing-subcommand'], expected: 'connector' },
    ];

    for (const item of cases) {
      const result = runAny(item.args);
      expect(result.status).toBe(1);
      expect(result.output).toContain(item.expected);
    }
  });
});
