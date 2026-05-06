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

function createWukongWorkRoot() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-wukong-login-'));
  const agentWorkRoot = path.join(base, '.real', 'users', 'user-test');
  const projectDir = path.join(agentWorkRoot, 'workspace', 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf8');
  return { base, agentWorkRoot, projectDir };
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
    expect(output).toContain('env [--json]');
    expect(output).toContain('login [--qr|--browser] [--corp-id <corpId>]');
    expect(output).toContain('create-form');
    expect(output).toContain('list-forms');
    expect(output).toContain('connector');
    expect(output).toContain('dws');
    expect(output).toContain('commands [--json]');
    expect(output).toContain('sample [--list]');
    expect(output).toContain('generate-page <template>');
    expect(output).toContain('check-page <src>');
    expect(output).toContain('compile <src>');
  });

  test('commands --json renders machine-readable command manifest', () => {
    const output = runOk(['commands', '--json']);
    const parsed = JSON.parse(output);
    const commands = parsed.commands.map(entry => entry.id);

    expect(parsed).toHaveProperty('schema_version', 1);
    expect(parsed).toHaveProperty('name', 'openyida');
    expect(parsed).toHaveProperty('version', version);
    expect(commands).toContain('env');
    expect(commands).toContain('login');
    expect(commands).toContain('create-form.create');
    expect(commands).toContain('list-forms');
    expect(commands).toContain('connector.smart-create');
    expect(commands).toContain('commands');
    expect(parsed.commands.find(entry => entry.id === 'commands')).toMatchObject({
      usage: 'openyida commands [--json]',
      output: 'json',
      requires_login: false,
    });
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

  test('env --json renders machine-readable environment status', () => {
    const output = runOk(['env', '--json']);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('ok', true);
    expect(parsed).toHaveProperty('system.node');
    expect(parsed).toHaveProperty('active.projectRoot');
    expect(parsed).toHaveProperty('active.projectRootExists');
    expect(parsed).toHaveProperty('active.hasConfig');
    expect(parsed).toHaveProperty('login.loggedIn');
    expect(parsed).toHaveProperty('login.diagnostics.cookieFileFound');
    expect(parsed).toHaveProperty('login.diagnostics.csrfTokenFound');
    expect(parsed).toHaveProperty('login.diagnostics.corpIdFound');
    expect(parsed).toHaveProperty('login.diagnostics.baseUrlFound');
  });

  test('env list routes to multi-environment management command', () => {
    const output = runOk(['env', 'list']);
    expect(output).toContain('public');
    expect(output).toContain('https://www.aliwork.com');
  });

  test('env unknown subcommand fails instead of rendering detection output', () => {
    const result = runAny(['env', 'missing-subcommand']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('未知的 env 子命令');
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

  test('login auto-selects Wukong browser handoff in Wukong environment', () => {
    const wukong = createWukongWorkRoot();
    try {
      const output = runOkWithEnv(['login'], {
        AGENT_WORK_ROOT: wukong.agentWorkRoot,
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, wukong.projectDir);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_codex_browser_login',
        handoff_type: 'browser',
        browser: 'wukong',
        login_url: 'https://example.test/workPlatform',
        can_auto_use: false,
      });
    } finally {
      fs.rmSync(wukong.base, { recursive: true, force: true });
    }
  });

  test('login uses cached CLI credentials before Wukong browser handoff', () => {
    const wukong = createWukongWorkRoot();
    const cacheDir = path.join(wukong.projectDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies-public.json'), JSON.stringify({
      cookies: [
        { name: 'tianshu_csrf_token', value: 'wukong-cached-token-1234567890' },
        { name: 'tianshu_corp_user', value: 'corp_wukongUser' },
      ],
      base_url: 'https://www.aliwork.com',
    }), 'utf8');

    try {
      const output = runOkWithEnv(['login'], {
        AGENT_WORK_ROOT: wukong.agentWorkRoot,
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, wukong.projectDir);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        ok: true,
        base_url: 'https://www.aliwork.com',
        corp_id: 'corp',
        user_id: 'wukongUser',
        cookies_count: 2,
      });
    } finally {
      fs.rmSync(wukong.base, { recursive: true, force: true });
    }
  });

  test('login --wukong explicitly returns Wukong browser handoff', () => {
    const wukong = createWukongWorkRoot();
    try {
      const output = runOkWithEnv(['login', '--wukong'], {
        AGENT_WORK_ROOT: wukong.agentWorkRoot,
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, wukong.projectDir);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_codex_browser_login',
        handoff_type: 'browser',
        browser: 'wukong',
        login_url: 'https://example.test/workPlatform',
        can_auto_use: false,
      });
    } finally {
      fs.rmSync(wukong.base, { recursive: true, force: true });
    }
  });

  test('login --check-only exposes Wukong read-only diagnostics', () => {
    const wukong = createWukongWorkRoot();
    const cacheDir = path.join(wukong.projectDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'cookies-public.json'), JSON.stringify({
      cookies: [
        { name: 'tianshu_csrf_token', value: 'wukong-check-token-1234567890' },
        { name: 'tianshu_corp_user', value: 'corp_wukongCheckUser' },
      ],
      base_url: 'https://www.aliwork.com',
    }), 'utf8');

    try {
      const output = runOkWithEnv(['login', '--check-only'], {
        AGENT_WORK_ROOT: wukong.agentWorkRoot,
        OPENYIDA_ENV: 'public',
      }, wukong.projectDir);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'ok',
        can_auto_use: true,
        corp_id: 'corp',
        user_id: 'wukongCheckUser',
      });
      expect(parsed).toHaveProperty('diagnostics.isWukong', true);
      expect(parsed).toHaveProperty('diagnostics.csrf_token_found', true);
      expect(parsed).toHaveProperty('diagnostics.corp_id_found', true);
      expect(parsed).toHaveProperty('diagnostics.base_url_found', true);
    } finally {
      fs.rmSync(wukong.base, { recursive: true, force: true });
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
