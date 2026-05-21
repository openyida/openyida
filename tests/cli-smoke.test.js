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
    QODERCLI_INTEGRATION_MODE: '',
    CODEX_SHELL: '',
    CODEX_CI: '',
    CODEX_THREAD_ID: '',
    CODEX_HOME: '',
    CLAUDE_CODE: '',
    CLAUDE_CODE_ENTRYPOINT: '',
    OPENCODE: '',
    CURSOR_TRACE_ID: '',
    VSCODE_GIT_ASKPASS_NODE: '',
    AGENT_WORK_ROOT: '',
    OPENYIDA_AGENT_MODE: '',
    __CFBundleIdentifier: '',
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
    expect(output).toContain('login [--qr|--agent-qr|--codex|--browser] [--env <name>|--intl|--overseas|--global|--yidaapps] [--corp-id <corpId>]');
    expect(output).toContain('corp-efficiency');
    expect(output).toContain('create-form');
    expect(output).toContain('list-forms');
    expect(output).toContain('connector');
    expect(output).toContain('corp-manager');
    expect(output).toContain('agent-center');
    expect(output).toContain('dws');
    expect(output).toContain('dingtalk-link');
    expect(output).toContain('a2a <serve|agent-card> [options]');
    expect(output).toContain('sample [--list]');
    expect(output).toContain('generate-page <template>');
    expect(output).toContain('build-page <sourceFile>');
    expect(output).toContain('check-page <src>');
    expect(output).toContain('compile <src>');
  });

  test('create-app --help renders usage without requiring login', () => {
    const result = runAny(['create-app', '--help']);
    const output = result.output;
    expect(result.status).toBe(0);
    expect(output).toContain('create-app');
    expect(output).toContain('--name');
    expect(output).toContain('--theme');
    expect(output).not.toContain('读取登录态');
  });

  test('app-list --help renders usage without requiring login', () => {
    const result = runAny(['app-list', '--help']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('openyida app-list');
    expect(result.output).not.toContain('读取登录态');
  });

  test('externalize-form --help renders usage without requiring login', () => {
    const result = runAny(['externalize-form', '--help']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('openyida externalize-form');
    expect(result.output).not.toContain('读取登录态');
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
    expect(commands).toContain('corp-efficiency');
    expect(commands).toContain('nav-group');
    expect(commands).toContain('create-form.create');
    expect(commands).toContain('create-form.patch');
    expect(commands).toContain('create-form.rule');
    expect(commands).toContain('create-form.bind-datasource');
    expect(commands).toContain('list-forms');
    expect(commands).toContain('build-page');
    expect(commands).toContain('connector.smart-create');
    expect(commands).toContain('corp-manager');
    expect(commands).toContain('agent-center');
    expect(commands).toContain('dingtalk-link');
    expect(commands).toContain('externalize-form');
    expect(commands).toContain('commands');
    expect(commands).toContain('a2a');
    expect(commands).toContain('ai');
    expect(parsed.commands.find(entry => entry.id === 'a2a')).toMatchObject({
      usage: 'openyida a2a <serve|agent-card> [options]',
      output: 'text|json',
      requires_login: false,
    });
    expect(parsed.commands.find(entry => entry.id === 'commands')).toMatchObject({
      usage: 'openyida commands [--json]',
      output: 'json',
      requires_login: false,
    });
    expect(parsed.commands.find(entry => entry.id === 'dingtalk-link')).toMatchObject({
      usage: 'openyida dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]',
      output: 'text|json',
      requires_login: false,
    });
    expect(parsed.commands.find(entry => entry.id === 'ai')).toMatchObject({
      usage: 'openyida ai <text|image> [options]',
      output: 'text|json',
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'externalize-form')).toMatchObject({
      usage: 'openyida externalize-form <appType> <formUuid> [--schema-file file]',
      output: 'json|markdown',
      requires_login: true,
    });
  });

  test('a2a agent-card renders a valid Agent Card without requiring login', () => {
    const output = runOk(['a2a', 'agent-card']);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      protocolVersion: '1.0',
      name: 'OpenYida Local Adapter',
      capabilities: {
        streaming: false,
        pushNotifications: false,
      },
    });
    expect(parsed.skills.map(skill => skill.id)).toContain('openyida.command_manifest');
  });

  test('sample --list renders available templates without network access', () => {
    const output = runOk(['sample', '--list']);
    expect(output).toContain('yida-custom-page');
    expect(output).toContain('product-homepage');
    expect(output).toContain('todo-mvc');
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

  test('global environment flags apply to non-login commands', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['env', '--json', '--yidaapps'], {
        CODEX_SHELL: '1',
      }, workspace);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('login.diagnostics.currentEnv', 'intl');
      expect(parsed.login.diagnostics.configuredCookieFile).toContain('cookies-intl.json');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('env list routes to multi-environment management command', () => {
    const output = runOk(['env', 'list']);
    expect(output).toContain('public');
    expect(output).toContain('https://www.aliwork.com');
    expect(output).toContain('https://www.yidaapps.com');
    expect(output).toContain('alibaba');
    expect(output).toContain('https://yida-group.alibaba-inc.com');
  });

  test('env unknown subcommand fails instead of rendering detection output', () => {
    const result = runAny(['env', 'missing-subcommand']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('未知的 env 子命令');
  });

  test('login falls back to QR handoff in Codex environment when CDP is unavailable', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_DISABLE_CDP_LOGIN: '1',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_url).toContain('https://login.example.test/qr');
      expect(parsed.qr_image_file).toContain('test-session.png');
      expect(parsed.qr_image_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.qr_image_markdown).toContain('test-session.png');
      expect(parsed.agent_response_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.agent_response_markdown).toContain('poll_command:');
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login falls back to QR handoff in Qoder environment when CDP is unavailable', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login'], {
        QODER_IDE: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_DISABLE_CDP_LOGIN: '1',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_url).toContain('https://login.example.test/qr');
      expect(parsed.qr_image_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.agent_response_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login falls back to QR handoff in Claude Code environment when CDP is unavailable', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login'], {
        CLAUDE_CODE: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_DISABLE_CDP_LOGIN: '1',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_image_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.agent_response_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login falls back to QR handoff in OpenCode environment when CDP is unavailable', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login'], {
        OPENCODE: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_DISABLE_CDP_LOGIN: '1',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_image_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.agent_response_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
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
        handoff_type: 'browser',
        browser: 'codex',
        login_url: 'https://example.test/workPlatform',
        can_auto_use: false,
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login --agent-qr returns QR handoff', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login', '--agent-qr'], {
        CODEX_SHELL: '1',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_url).toContain('https://login.example.test/qr');
      expect(parsed.qr_image_file).toContain('test-session.png');
      expect(parsed.qr_image_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.agent_response_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login --agent-qr keeps explicit corpId in QR poll command', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login', '--agent-qr', '--corp-id', 'ding-main'], {
        CODEX_SHELL: '1',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
      expect(parsed.poll_command).toMatch(/--corp-id ['"]ding-main['"]/);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login --agent-qr bypasses cached credentials for forced re-login', () => {
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
      const output = runOkWithEnv(['login', '--agent-qr'], {
        CODEX_SHELL: '1',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_url).toContain('https://login.example.test/qr');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login falls back to QR handoff in Wukong environment when CDP is unavailable', () => {
    const wukong = createWukongWorkRoot();
    try {
      const output = runOkWithEnv(['login'], {
        AGENT_WORK_ROOT: wukong.agentWorkRoot,
        OPENYIDA_ENV: 'public',
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
        OPENYIDA_DISABLE_CDP_LOGIN: '1',
        OPENYIDA_DISABLE_PLAYWRIGHT_LOGIN: '1',
        OPENYIDA_CODEX_QR_FAKE: '1',
      }, wukong.projectDir);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_qr_scan',
        handoff_type: 'qr',
        can_auto_use: false,
      });
      expect(parsed.qr_url).toContain('https://login.example.test/qr');
      expect(parsed.qr_image_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.agent_response_markdown).toContain('![OpenYida login QR code](');
      expect(parsed.poll_command).toContain('openyida login --agent-poll');
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

  test('login --qoder explicitly returns Qoder browser handoff', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login', '--qoder'], {
        OPENYIDA_LOGIN_URL: 'https://example.test/workPlatform',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        status: 'need_codex_browser_login',
        handoff_type: 'browser',
        browser: 'qoder',
        login_url: 'https://example.test/workPlatform',
        can_auto_use: false,
      });
      expect(parsed.message).toContain('Qoder');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
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
      { args: ['corp-manager', 'list'], expected: 'corp-manager' },
      { args: ['agent-center', 'cancel'], expected: 'agent-center' },
    ];

    for (const item of cases) {
      const result = runAny(item.args);
      expect(result.status).toBe(1);
      expect(result.output).toContain(item.expected);
    }
  });

  test('publish keeps source-first CLI order through the router', () => {
    const sourceFile = 'pages/src/missing-publish-source.oyd.jsx';
    const result = runAny(['publish', sourceFile, 'APP_XXX', 'FORM-XXX', '--no-open']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('missing-publish-source.oyd.jsx');
    expect(result.output).not.toContain(path.join(ROOT, 'FORM-XXX'));
  });
});
