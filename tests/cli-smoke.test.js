'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { version } = require('../package.json');
const { buildCommandManifestDigest } = require('../lib/core/agent-capabilities');

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
    QODER_WORK_INTEGRATION_PRODUCT: '',
    QODERCN_CONFIG_DIR: '',
    QODER_CONFIG_DIR: '',
    QODER_WORKER_CWD: '',
    CODEX_SHELL: '',
    CODEX_CI: '',
    CODEX_THREAD_ID: '',
    CODEX_HOME: '',
    CLAUDE_CODE: '',
    CLAUDE_CODE_ENTRYPOINT: '',
    OPENCODE: '',
    OPENCODE_CLIENT: '',
    CURSOR_TRACE_ID: '',
    VSCODE_GIT_ASKPASS_NODE: '',
    AGENT_WORK_ROOT: '',
    MULERUN_CHAT_ID: '',
    MULE_DATA_DIR: '',
    MULE_WORKSPACE_DIR: '',
    MULE_SANDBOX_ID: '',
    OPENYIDA_AGENT_MODE: '',
    OPENYIDA_ASSUME_DESKTOP: '',
    QWENWORK: '',
    QWENWORK_INTEGRATION_MODE: '',
    QWENWORKCN_INTEGRATION_MODE: '',
    QWENWORK_CLIENT: '',
    QWENWORK_WORKSPACE_DIR: '',
    QWENWORK_SANDBOX_ID: '',
    QWENWORK_PREVIEW_URL: '',
    QWENWORK_VNC_URL: '',
    AGENT_PLATFORM: '',
    YIDA_AUTH_ENABLED: '',
    OPENYIDA_ACCESS_TOKEN: '',
    OPENYIDA_REFRESH_TOKEN: '',
    OPENYIDA_TOKEN_CLIENT_ID: '',
    OPENYIDA_TOKEN_CORP_ID: '',
    OPENYIDA_TOKEN_USER_ID: '',
    OPENYIDA_ENDPOINT: '',
    OPENYIDA_NO_BROWSER: '',
    OPENYIDA_OAUTH_TIMEOUT_MS: '',
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

function runAnyWithEnv(args, extraEnv, cwd = ROOT, options = {}) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...cliEnv(), ...extraEnv },
    encoding: 'utf8',
    timeout: options.timeout || 10000,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output,
    jsonOutput: output
      .replace(/^\(node:\d+\) ExperimentalWarning:.*\n?/gm, '')
      .replace(/^\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\n?/gm, ''),
  };
}

function createCodexWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-codex-login-'));
  const projectDir = path.join(workspace, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'config.json'), '{}', 'utf8');
  return workspace;
}

function writeIgnoredLegacyCookieCache(workspace) {
  const cacheDir = path.join(workspace, 'project', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'cookies.json'), JSON.stringify([
    { name: 'tianshu_csrf_token', value: 'file-csrf' },
    { name: 'tianshu_corp_user', value: 'corpFile_userFile' },
  ]), 'utf8');
}

function runAny(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    env: cliEnv(),
    encoding: 'utf8',
    timeout: 10000,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output,
    jsonOutput: output
      .replace(/^\(node:\d+\) ExperimentalWarning:.*\n?/gm, '')
      .replace(/^\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\n?/gm, ''),
  };
}

function readManifestCommand(commandId) {
  const manifest = JSON.parse(runOk(['commands', '--json']));
  return manifest.commands.find(entry => entry.id === commandId);
}

function resolveManifestCommand(commands, args) {
  return commands
    .filter(entry => entry.path.every((token, index) => args[index] === token))
    .sort((left, right) => right.path.length - left.path.length)[0] || null;
}

function actionMatches(restArgs, action) {
  if (action === 'default') {
    return restArgs.length === 0;
  }
  const tokens = String(action).split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token, index) => restArgs[index] === token);
}

function patternMatches(restArgs, pattern) {
  if (!pattern || typeof pattern !== 'object') {
    return false;
  }
  if (pattern.type === 'argv_contains_any') {
    const text = restArgs.join(' ').toLowerCase();
    return (pattern.values || []).some(value => text.includes(String(value).toLowerCase()));
  }
  if (pattern.type === 'option_value_excludes_any') {
    const optionIndex = restArgs.indexOf(pattern.option);
    if (optionIndex === -1 || !restArgs[optionIndex + 1]) {
      return false;
    }
    const value = String(restArgs[optionIndex + 1]).toLowerCase();
    return !(pattern.values || []).some(item => value.includes(String(item).toLowerCase()));
  }
  return false;
}

function classifyManifestInvocation(commands, args) {
  const entry = resolveManifestCommand(commands, args);
  if (!entry) {
    return { entry: null, decision: 'ask' };
  }
  const permission = entry.permission || {};
  if (!permission.action_dependent) {
    return { entry, decision: permission.mode };
  }
  const restArgs = args.slice(entry.path.length);
  if ((permission.ask_actions || []).some(action => actionMatches(restArgs, action))) {
    return { entry, decision: 'ask' };
  }
  if ((permission.ask_patterns || []).some(pattern => patternMatches(restArgs, pattern))) {
    return { entry, decision: 'ask' };
  }
  if ((permission.preauthorized_actions || []).some(action => actionMatches(restArgs, action))) {
    return { entry, decision: 'allow' };
  }
  if ((permission.preauthorized_patterns || []).some(pattern => patternMatches(restArgs, pattern))) {
    return { entry, decision: 'allow' };
  }
  if ((permission.read_actions || []).some(action => actionMatches(restArgs, action))) {
    return { entry, decision: 'allow' };
  }
  return { entry, decision: permission.unknown_action_mode || permission.mode };
}

describe('CLI offline smoke', () => {
  test('--version prints package version without requiring login', () => {
    expect(runOk(['--version']).trim()).toBe(version);
  });

  test('--help renders top-level command groups', () => {
    const output = runOk(['--help']);
    expect(output).toContain('OpenYida');
    expect(output).toContain('env [--json|setup|list|show|switch|add|remove] [options]');
    expect(output).toContain('login [target-url] [--env <name>|--intl|--overseas|--global|--yidaapps|--alibaba] [--client-id <clientId>] [--endpoint <url>] [--no-browser]');
    expect(output).toContain('org <list|switch> [--json] [--corp-id <corpId>]');
    expect(output).toContain('corp-efficiency');
    expect(output).toContain('create-form');
    expect(output).toContain('list-forms');
    expect(output).toContain('er <appType>');
    expect(output).toContain('aggregate-table');
    expect(output).toContain('ai-form-setting');
    expect(output).toContain('connector');
    expect(output).toContain('corp-manager');
    expect(output).toContain('agent-center');
    expect(output).toContain('dws');
    expect(output).toContain('dingtalk-link');
    expect(output).toContain('a2a <serve|agent-card> [options]');
    expect(output).toContain('sample [--list]');
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

  test('resource command --help probes exit successfully without requiring login', () => {
    const cases = [
      { args: ['create-form', '--help'], text: 'create-form create' },
      { args: ['create-page', '--help'], text: 'create-page' },
      { args: ['app-online', '--help'], text: 'openyida app-online' },
      { args: ['app-offline', '--help'], text: 'openyida app-offline' },
      { args: ['sample', '--help'], text: 'Code Templates' },
      { args: ['publish', '--help'], text: 'openyida publish' },
    ];

    for (const item of cases) {
      const result = runAny(item.args);
      expect(result.status).toBe(0);
      expect(result.output).toContain(item.text);
      expect(result.output).not.toContain('读取登录态');
    }
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

  test('er --help renders usage without requiring login', () => {
    const result = runAny(['er', '--help']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('openyida er');
    expect(result.output).not.toContain('读取登录态');
  });

  test('login --help renders usage without starting OAuth login', () => {
    const result = runAny(['login', '--help']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('openyida login');
    expect(result.output).toContain('OAuth loopback');
    expect(result.output).not.toContain('login.dingtalk.com/oauth2/auth');
    expect(result.output).not.toContain('not_logged_in');
  });

  test('auth login --help renders login usage without starting OAuth login', () => {
    const result = runAny(['auth', 'login', '--help']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('openyida login');
    expect(result.output).toContain('OAuth loopback');
    expect(result.output).not.toContain('login.dingtalk.com/oauth2/auth');
    expect(result.output).not.toContain('not_logged_in');
  });

  test('login --no-browser --quiet still prints the authorization URL to stderr', () => {
    const result = runAnyWithEnv(['login', '--no-browser', '--quiet'], {
      OPENYIDA_OAUTH_TIMEOUT_MS: '80',
    }, ROOT, { timeout: 5000 });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Open this URL to login:');
    expect(result.stderr).toContain('login.dingtalk.com/oauth2/auth');
    expect(result.stderr).not.toContain('Waiting for browser authorization');
    expect(result.stdout).not.toContain('login.dingtalk.com/oauth2/auth');
  });

  test('OPENYIDA_NO_BROWSER with quiet login still prints the authorization URL to stderr', () => {
    const result = runAnyWithEnv(['login', '--quiet'], {
      OPENYIDA_NO_BROWSER: '1',
      OPENYIDA_OAUTH_TIMEOUT_MS: '80',
    }, ROOT, { timeout: 5000 });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Open this URL to login:');
    expect(result.stderr).toContain('login.dingtalk.com/oauth2/auth');
    expect(result.stderr).not.toContain('Waiting for browser authorization');
    expect(result.stdout).not.toContain('login.dingtalk.com/oauth2/auth');
  });

  test('removed legacy login flags fail instead of falling through to OAuth', () => {
    const removedFlags = [
      '--qr',
      '--qr-code',
      '--agent-qr',
      '--codex-qr',
      '--agent-poll',
      '--codex-poll',
      '--browser',
      '--codex',
      '--qoder',
      '--wukong',
    ];

    for (const flag of removedFlags) {
      for (const argsList of [['login', flag], ['auth', 'login', flag]]) {
        const result = runAny(argsList);
        expect(result.status).toBe(1);
        expect(result.output).toContain(flag);
        expect(result.output).toContain('旧登录参数不再支持');
        expect(result.output).toContain('openyida login');
        expect(result.output).not.toContain('login.dingtalk.com/oauth2/auth');
      }
    }
  });

  test('removed legacy login flags support JSON error output', () => {
    const result = runAny(['login', '--browser', '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.jsonOutput)).toMatchObject({
      success: false,
      errorCode: 'INVALID_ARGUMENTS',
      errorMsg: expect.stringContaining('--browser'),
    });
  });

  test('commands --json renders machine-readable command manifest', () => {
    const output = runOk(['commands', '--json']);
    const parsed = JSON.parse(output);
    const commands = parsed.commands.map(entry => entry.id);
    const commandById = Object.fromEntries(parsed.commands.map(entry => [entry.id, entry]));

    expect(parsed).toHaveProperty('schema_version', 1);
    expect(parsed).toHaveProperty('name', 'openyida');
    expect(parsed).toHaveProperty('version', version);
    expect(parsed.side_effect_schema).toMatchObject({
      version: 1,
      kinds: {
        mixed: expect.stringContaining('Action-dependent command'),
      },
      fields: {
        action_dependent: expect.stringContaining('mixed commands'),
      },
    });
    expect(parsed.permission_schema).toMatchObject({
      version: 1,
      modes: {
        allow: expect.stringContaining('Allowed by the current OpenYida agent policy'),
        ask: expect.stringContaining('Requires user confirmation'),
      },
      effects: {
        read: expect.stringContaining('Reads'),
        unknown: expect.stringContaining('Action-dependent'),
      },
      fields: {
        preauthorized_actions: expect.stringContaining('pre-authorized'),
        preauthorized_patterns: expect.stringContaining('Structured argument matchers'),
        ask_patterns: expect.stringContaining('Structured argument matchers'),
        unknown_action_mode: expect.stringContaining('unrecognized actions'),
      },
    });
    expect(parsed.forbidden_alias_schema).toMatchObject({
      version: 1,
      matcher_types: {
        argv_prefix: expect.stringContaining('argv begins'),
        command_has_option: expect.stringContaining('option appears'),
      },
      agent_policy: expect.stringContaining('Deny forbidden aliases before asking'),
    });
    expect(parsed.forbidden_aliases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pattern: 'list-apps',
        matcher: { type: 'argv_prefix', tokens: ['list-apps'] },
        suggested_command_id: 'app-list',
        suggested_usage: 'openyida app-list [--size N]',
        message_key: 'cli.forbidden_alias_list_apps',
        message_args: ['list-apps', 'app-list'],
        message: '`list-apps` 不是 OpenYida 命令；请使用 `app-list` 查询应用。',
      }),
      expect.objectContaining({
        pattern: 'get-app',
        suggested_command_id: 'app-list',
        alternative_command_ids: ['get-schema', 'agent-capabilities'],
        message_key: 'cli.forbidden_alias_get_app',
      }),
      expect.objectContaining({
        pattern: 'create-app --json',
        matcher: { type: 'command_has_option', command: 'create-app', option: '--json' },
        suggested_command_id: 'create-app',
      }),
      expect.objectContaining({
        pattern: 'create-page --app-type',
        suggested_usage: expect.stringContaining('create-page <appType>'),
      }),
      expect.objectContaining({
        pattern: 'create-form <appType> --name <formTitle> --fields <fieldsJson>',
        matcher: { type: 'command_has_option', command: 'create-form', option: '--fields' },
        suggested_command_id: 'create-form.create',
        suggested_usage: 'openyida create-form create <appType> "<formTitle>" <fieldsJsonFile>',
      }),
      expect.objectContaining({
        pattern: 'get-schema --app-type',
        suggested_usage: expect.stringContaining('get-schema <appType>'),
      }),
      expect.objectContaining({
        pattern: 'get-schema --form-uuid',
        suggested_usage: expect.stringContaining('get-schema <appType>'),
      }),
    ]));
    expect(parsed.summary).toMatchObject({
      command_count: parsed.commands.length,
      group_count: parsed.groups.length,
      forbidden_alias_count: parsed.forbidden_aliases.length,
      forbidden_alias_patterns: expect.arrayContaining([
        'list-apps',
        'get-app',
        'create-app --json',
        'create-form <appType> --name <formTitle> --fields <fieldsJson>',
      ]),
    });
    expect(parsed.summary.side_effect_counts.remote_write).toBeGreaterThan(0);
    expect(parsed.summary.permission_mode_counts.allow).toBeGreaterThan(0);
    expect(parsed.summary.permission_mode_counts.ask).toBeGreaterThan(0);
    expect(parsed.summary.read_only_command_ids).toContain('agent-capabilities');
    expect(parsed.summary.mutating_command_ids).toContain('create-app');
    expect(new Set(parsed.commands.map(entry => entry.path.join(' '))).size).toBe(parsed.commands.length);
    expect(parsed.summary.allow_command_ids).toEqual(expect.arrayContaining([
      'agent-capabilities',
      'commands',
      'app-list',
      'create-app',
      'publish',
      'login',
      'connector.list',
      'integration.list',
      'integration.enable',
      'basic-info',
      'formula.evaluate',
    ]));
    expect(parsed.summary.ask_command_ids).toEqual([
      'app-offline',
      'connector.delete',
      'connector.delete-action',
    ]);
    expect(parsed.summary.core_workflows.full_app_build).toMatchObject({
      mode: 'unified_build',
      default_page_skill_id: 'yida-canvas-custom-page',
      default_ui_guidance_skill_id: 'yida-design',
      ordinary_jsx_skill_id: 'yida-custom-page',
      required_command_ids: expect.arrayContaining([
        'agent-capabilities',
        'create-app',
        'create-form.create',
        'create-process',
        'create-page',
        'publish',
        'nav-group',
      ]),
      do_not_default_skill_ids: expect.arrayContaining([
        'yida-data-source-connectors',
        'yida-data-management',
      ]),
      product_design_policy: expect.stringContaining('resource creation order, page implementation delivery order, navigation order'),
      ui_guidance_policy: expect.stringContaining('only design sources of truth'),
      default_nav_order_policy: expect.stringContaining('openyida nav-group order <appType> <items...>'),
      completion_contract: expect.stringContaining('PRD navigation order or lightweight fallback navigation order'),
      recommended_read_commands: expect.arrayContaining([
        expect.stringContaining('--summary-json'),
      ]),
      default_data_contract: expect.stringContaining('this.dataSourceMap'),
    });
    expect(parsed.summary.core_workflows.full_app_build.page_skill_policy)
      .toContain('existing .oyd.jsx/.oyb.jsx/renderJsx/platform Jsx component maintenance');
    expect(parsed.summary.core_workflows.full_app_build.page_skill_policy)
      .not.toContain('page strongly depends on this.$');
    expect(parsed.summary.core_workflows.full_app_build.page_skill_policy)
      .not.toContain('deep field two-way binding');
    expect(parsed.summary.core_workflows.full_app_build.ui_guidance_policy).toContain('prd.md + design.md');
    expect(parsed.summary.core_workflows.full_app_build.default_nav_order_policy).toContain('portal/home/workbench entry > business handling > data management > business analytics > system configuration');
    expect(parsed.summary.core_workflows.full_app_build.do_not_default_skill_ids).not.toContain('yida-design');
    expect(commands).toContain('env');
    expect(commands).not.toContain('env-management');
    expect(commands).toContain('login');
    expect(commands).toContain('org');
    expect(commands).toContain('corp-efficiency');
    expect(commands).toContain('app-online');
    expect(commands).toContain('app-offline');
    expect(commands).toContain('nav-group');
    expect(commands).toContain('create-form.create');
    expect(commands).toContain('create-form.patch');
    expect(commands).toContain('create-form.rule');
    expect(commands).toContain('create-form.validation');
    expect(commands).toContain('add-validation');
    expect(commands).toContain('create-form.bind-datasource');
    expect(commands).toContain('list-forms');
    expect(commands).toContain('er');
    expect(commands).toContain('aggregate-table');
    expect(commands).toContain('ai-form-setting');
    expect(commands).toContain('build-page');
    expect(commands).toContain('connector.smart-create');
    expect(commands).toContain('corp-manager');
    expect(commands).toContain('agent-center');
    expect(commands).toContain('integration.diagnose');
    expect(commands).toContain('dingtalk-link');
    expect(commands).toContain('export');
    expect(commands).toContain('externalize-form');
    expect(commands).toContain('db-seq-fix');
    expect(commands).toContain('commands');
    expect(commands).toContain('agent-capabilities');
    expect(commands).toContain('a2a');
    expect(commands).toContain('ai');
    expect(commands).toContain('batch');
    expect(commands).not.toContain('batch.file');
    expect(commands).not.toContain('batch.inline');
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
    expect(parsed.commands.find(entry => entry.id === 'agent-capabilities')).toMatchObject({
      usage: 'openyida agent-capabilities [--json] [--summary-json|--compact]',
      output: 'json',
      requires_login: false,
    });
    expect(parsed.commands.find(entry => entry.id === 'auth')).toMatchObject({
      usage: 'openyida auth <status|login|refresh|logout|profiles|profile switch>',
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
    expect(parsed.commands.find(entry => entry.id === 'app-online')).toMatchObject({
      usage: 'openyida app-online <appType> [--to-ding-app-center] [--show-app-center]',
      side_effect: { kind: 'remote_write', mutates_yida: true },
      permission: { mode: 'allow', effect: 'write' },
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'app-offline')).toMatchObject({
      usage: 'openyida app-offline <appType> [--to-ding-app-center] [--show-app-center]',
      side_effect: { kind: 'remote_write', mutates_yida: true },
      permission: { mode: 'ask', effect: 'destructive' },
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'integration.diagnose')).toMatchObject({
      usage: 'openyida integration diagnose (--text <text>|--file <path>|--rules) [--json]',
      output: 'text|json',
      requires_login: false,
    });
    expect(parsed.commands.find(entry => entry.id === 'integration.create').usage).toContain('--spec file.json');
    expect(parsed.commands.find(entry => entry.id === 'externalize-form')).toMatchObject({
      usage: 'openyida externalize-form <appType> <formUuid> [--schema-file file]',
      output: 'json|markdown',
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'aggregate-table')).toMatchObject({
      usage: 'openyida aggregate-table <list|create-empty|inspect|preview|save|publish|status> <appType> ...',
      output: 'json',
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'er')).toMatchObject({
      usage: 'openyida er <appType> [--format mermaid|json] [--output file] [--include-system] [--include-pages]',
      output: 'text|json',
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'ai-form-setting')).toMatchObject({
      usage: 'openyida ai-form-setting <get|fields|models|enable|disable|save> <appType> ...',
      output: 'json',
      requires_login: true,
    });
    expect(parsed.commands.find(entry => entry.id === 'env')).toMatchObject({
      usage: 'openyida env [--json|setup|list|show|switch|add|remove] [options]',
      output: 'text|json',
      requires_login: false,
    });
    expect(commandById['check-page'].side_effect).toMatchObject({
      kind: 'local_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById['create-form.create']).toMatchObject({
      path: ['create-form', 'create'],
      permission: {
        mode: 'allow',
        effect: 'write',
      },
      args: [
        expect.objectContaining({ name: 'appType', source: 'positional', required: true }),
        expect.objectContaining({ name: 'formTitle', source: 'positional', required: true }),
        expect.objectContaining({ name: 'fieldsJsonFile', source: 'positional', required: true }),
      ],
      canonical: {
        command_id: 'create-form.create',
        path: ['create-form', 'create'],
        argv_template: ['create-form', 'create', '<appType>', '<formTitle>', '<fieldsJsonFile>'],
        display: 'openyida create-form create <appType> "<formTitle>" <fieldsJsonFile>',
        builder: expect.stringContaining('commands build create-form.create'),
      },
      deprecated_patterns: [
        expect.objectContaining({
          id: 'deprecated.create-form.name-fields-options',
          code: 'CREATE_FORM_DEPRECATED_OPTION_SHAPE',
        }),
      ],
      repair_patterns: [
        expect.objectContaining({
          id: 'repair.create-form.name-fields-to-create',
        }),
      ],
      examples: expect.arrayContaining([
        expect.stringContaining('openyida create-form create APP_XXX'),
      ]),
    });
    expect(commandById['generate-page']).toBeUndefined();
    expect(commandById['dws.contact-user-search'].side_effect).toMatchObject({
      kind: 'remote_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById['form-detail-style.check']).toMatchObject({
      path: ['form-detail-style', 'check'],
      side_effect: {
        kind: 'remote_read',
        mutates_yida: false,
        mutates_local: false,
      },
      permission: {
        mode: 'allow',
        effect: 'read',
      },
    });
    expect(commandById['form-detail-style.apply'].side_effect).toMatchObject({
      kind: 'remote_write',
      mutates_yida: true,
      mutates_local: false,
    });
    expect(commandById['form-detail-style.remove'].side_effect).toMatchObject({
      kind: 'remote_write',
      mutates_yida: true,
      mutates_local: false,
    });
    expect(commandById['create-form.validate']).toBeUndefined();
    expect(commandById['create-form.validate-fields'].requires_login).toBe(false);
    expect(commandById['create-form.validate-fields'].side_effect).toMatchObject({
      kind: 'local_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById['create-form.validate-fields'].permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
    expect(commandById['create-form.validation'].side_effect).toMatchObject({
      kind: 'remote_write',
      mutates_yida: true,
      mutates_local: false,
    });
    expect(commandById['create-form.validation'].permission).toMatchObject({
      mode: 'allow',
      effect: 'write',
    });
    expect(commandById.ai.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: false,
      action_dependent: true,
      note: expect.stringContaining('Action-dependent command'),
    });
    expect(commandById['db-seq-fix'].side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: false,
      action_dependent: true,
      read_actions: ['default', '--dry-run'],
      mutating_actions: ['--fix'],
    });
    expect(commandById.batch.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: true,
      action_dependent: true,
    });
    expect(commandById['read-dingtalk-doc'].side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: false,
      mutates_local: true,
      read_actions: ['<docUrl>', '<docUrl> --json'],
      mutating_actions: ['<docUrl> --output <file>', '<docUrl> -o <file>'],
    });
    expect(commandById['read-dingtalk-doc'].permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      preauthorized_actions: [
        '<docUrl> --output <file>',
        '<docUrl> -o <file>',
      ],
      unknown_action_mode: 'ask',
    });
    expect(commandById.export.side_effect).toMatchObject({
      kind: 'local_write',
      mutates_yida: false,
      mutates_local: true,
    });
    expect(commandById.commands.permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
    expect(commandById['connector.list'].permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
    expect(commandById['connector.delete'].permission).toMatchObject({
      mode: 'ask',
      effect: 'destructive',
    });
    expect(commandById.login.permission).toMatchObject({
      mode: 'allow',
      effect: 'external',
    });
    expect(commandById['integration.enable'].permission).toMatchObject({
      mode: 'allow',
      effect: 'write',
    });
    expect(commandById['integration.disable'].permission).toMatchObject({
      mode: 'allow',
      effect: 'write',
    });
    expect(commandById['basic-info'].permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      read_actions: expect.arrayContaining(['overview', 'domain']),
      preauthorized_actions: ['domain set'],
      ask_actions: [],
      unknown_action_mode: 'ask',
    });
    expect(commandById['app-permission'].permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      read_actions: expect.arrayContaining(['get', 'search-user']),
      preauthorized_actions: ['set', 'add'],
      ask_actions: ['remove'],
      unknown_action_mode: 'ask',
    });
    expect(commandById['nav-group'].side_effect).toMatchObject({
      kind: 'mixed',
      mutating_actions: expect.arrayContaining(['order', 'auto-order']),
    });
    expect(commandById['nav-group'].permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      read_actions: ['list'],
      preauthorized_actions: expect.arrayContaining(['order', 'auto-order']),
      ask_actions: ['delete'],
      unknown_action_mode: 'ask',
    });
    expect(commandById.env.permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      read_actions: expect.arrayContaining(['default', '--json', 'list', 'show']),
      preauthorized_actions: ['setup', 'switch', 'add'],
      ask_actions: ['remove'],
      unknown_action_mode: 'ask',
    });
    expect(commandById.org.permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      read_actions: ['list'],
      preauthorized_actions: ['switch'],
      unknown_action_mode: 'ask',
    });
    expect(commandById.batch.permission).toMatchObject({
      mode: 'allow',
      effect: 'unknown',
      action_dependent: true,
      preauthorized_actions: [],
      ask_actions: [],
      preauthorized_patterns: [{
        type: 'option_value_excludes_any',
        option: '--commands',
        values: ['delete', 'remove'],
        description: expect.any(String),
      }],
      ask_patterns: [{
        type: 'argv_contains_any',
        values: ['delete', 'remove'],
        description: expect.any(String),
      }],
      unknown_action_mode: 'ask',
    });
    expect(commandById.export.permission).toMatchObject({
      mode: 'allow',
      effect: 'write',
    });
    expect(classifyManifestInvocation(parsed.commands, ['env', 'switch'])).toMatchObject({
      entry: { id: 'env' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['env', 'remove'])).toMatchObject({
      entry: { id: 'env' },
      decision: 'ask',
    });
    expect(classifyManifestInvocation(parsed.commands, ['db-seq-fix', '--fix'])).toMatchObject({
      entry: { id: 'db-seq-fix' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['doctor', '--fix'])).toMatchObject({
      entry: { id: 'doctor' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['agent-center', 'cancel'])).toMatchObject({
      entry: { id: 'agent-center' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['agent-center', 'archive'])).toMatchObject({
      entry: { id: 'agent-center' },
      decision: 'ask',
    });
    expect(classifyManifestInvocation(parsed.commands, ['export', 'APP_1', 'out.zip'])).toMatchObject({
      entry: { id: 'export' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['batch', '--commands', 'openyida app-list'])).toMatchObject({
      entry: { id: 'batch' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['batch', '--commands', 'openyida data delete form APP_1'])).toMatchObject({
      entry: { id: 'batch' },
      decision: 'ask',
    });
    expect(classifyManifestInvocation(parsed.commands, ['batch', 'commands.txt'])).toMatchObject({
      entry: { id: 'batch' },
      decision: 'ask',
    });
    expect(classifyManifestInvocation(parsed.commands, ['data', 'delete'])).toMatchObject({
      entry: { id: 'data' },
      decision: 'ask',
    });
    expect(classifyManifestInvocation(parsed.commands, ['app-permission', 'remove'])).toMatchObject({
      entry: { id: 'app-permission' },
      decision: 'ask',
    });
    expect(classifyManifestInvocation(parsed.commands, ['nav-group', 'auto-order', 'APP_1'])).toMatchObject({
      entry: { id: 'nav-group' },
      decision: 'allow',
    });
    expect(classifyManifestInvocation(parsed.commands, ['nav-group', 'delete', 'APP_1', 'NAV_1'])).toMatchObject({
      entry: { id: 'nav-group' },
      decision: 'ask',
    });
  });

  test('commands validate accepts canonical create-form create invocation', () => {
    const manifestEntry = readManifestCommand('create-form.create');
    const output = runOk([
      'commands',
      'validate',
      '--json',
      '--',
      'create-form',
      'create',
      'APP_xxx',
      '访客登记',
      '.cache/openyida/visitor/fields.json',
    ]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      ok: true,
      status: 'ok',
      command_id: 'create-form.create',
      matched_pattern: 'canonical.create-form.create',
      params: {
        appType: 'APP_xxx',
        formTitle: '访客登记',
        fieldsJsonFile: '.cache/openyida/visitor/fields.json',
      },
      path: manifestEntry.path,
      canonical: manifestEntry.canonical,
    });
  });

  test('commands validate rejects hallucinated create-form name fields shape', () => {
    const manifestEntry = readManifestCommand('create-form.create');
    const deprecatedPattern = manifestEntry.deprecated_patterns[0];
    const result = runAny([
      'commands',
      'validate',
      '--json',
      '--',
      'create-form',
      'APP_xxx',
      '--name',
      '访客登记',
      '--fields',
      '[{"type":"TextField","label":"姓名"}]',
    ]);
    const parsed = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(parsed).toMatchObject({
      ok: false,
      status: 'invalid',
      code: deprecatedPattern.code,
      command_id: 'create-form.create',
      canonical: manifestEntry.canonical,
      suggestion: {
        argv: ['create-form', 'create', 'APP_xxx', '访客登记', '<fieldsJsonFile>'],
        fields_inline_value_present: true,
      },
      pattern: {
        id: deprecatedPattern.id,
        code: deprecatedPattern.code,
        matcher: deprecatedPattern.matcher,
        received: {
          appType: 'APP_xxx',
          formTitle: '访客登记',
        },
      },
    });
  });

  test('commands validate preserves target argv after delimiter including --json', () => {
    const output = runOk([
      'commands',
      'validate',
      '--json',
      '--',
      'create-form',
      'create',
      'APP_xxx',
      '访客登记',
      '.cache/openyida/visitor/fields.json',
      '--json',
    ]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      ok: true,
      command_id: 'create-form.create',
    });
    expect(parsed.argv).toEqual([
      'create-form',
      'create',
      'APP_xxx',
      '访客登记',
      '.cache/openyida/visitor/fields.json',
      '--json',
    ]);
  });

  test('commands build renders canonical create-form argv without executing', () => {
    const manifestEntry = readManifestCommand('create-form.create');
    const output = runOk([
      'commands',
      'build',
      'create-form.create',
      '--app-type',
      'APP_xxx',
      '--form-title',
      '访客登记',
      '--fields-json-file',
      '.cache/openyida/visitor/fields.json',
      '--json',
    ]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      ok: true,
      status: 'ok',
      command_id: 'create-form.create',
      execute: false,
      argv: ['create-form', 'create', 'APP_xxx', '访客登记', '.cache/openyida/visitor/fields.json'],
      display: 'openyida create-form create APP_xxx "访客登记" .cache/openyida/visitor/fields.json',
      canonical: manifestEntry.canonical,
    });
    expect(parsed.argv.slice(0, manifestEntry.path.length)).toEqual(manifestEntry.path);
  });

  test('direct create-form hallucinated shape returns clean JSON error before execution', () => {
    const manifestEntry = readManifestCommand('create-form.create');
    const result = runAny([
      'create-form',
      'APP_xxx',
      '--name',
      '访客登记',
      '--fields',
      '[{"type":"TextField","label":"姓名"}]',
      '--json',
    ]);
    const parsed = JSON.parse(result.jsonOutput);

    expect(result.status).toBe(1);
    expect(parsed).toMatchObject({
      success: false,
      errorCode: 'CREATE_FORM_DEPRECATED_OPTION_SHAPE',
      details: {
        command_id: 'create-form.create',
        canonical: manifestEntry.canonical,
        suggestion: {
          argv: ['create-form', 'create', 'APP_xxx', '访客登记', '<fieldsJsonFile>'],
        },
      },
    });
  });

  test('agent-capabilities --summary-json renders compact preflight snapshot', () => {
    const output = runOk(['agent-capabilities', '--summary-json']);
    const parsed = JSON.parse(output);
    const compactAlias = JSON.parse(runOk(['agent-capabilities', '--json', '--compact']));
    const manifest = JSON.parse(runOk(['commands', '--json']));

    expect(compactAlias).toEqual(parsed);
    expect(parsed).toMatchObject({
      schema_version: 1,
      name: 'openyida-agent-capabilities-summary',
      version,
      login: {
        status: expect.any(String),
        can_auto_use: expect.any(Boolean),
      },
      workdir: expect.any(String),
      workdir_exists: expect.any(Boolean),
      cache_dir: expect.any(String),
      openyida_task_cache_dir: expect.any(String),
      command_manifest_digest_algorithm: 'sha256',
      command_count: manifest.summary.command_count,
      full_capabilities_command: 'openyida agent-capabilities --json',
      runtime: {
        tool: null,
        runtime: 'unknown',
        subtype: null,
        workspace_root: expect.any(String),
        workspace_root_source: 'cwd_project',
        browser_capabilities: {
          desktop_shell: false,
          agent_browser: false,
          browser_auto_open: false,
          playwright_required: false,
          playwright_policy: 'optional_fallback_only_do_not_install_by_default',
        },
      },
      builder_path: {
        schema_version: 1,
        runtime: {
          tool: null,
          runtime: 'unknown',
          workspace_root_source: 'cwd_project',
        },
        interactive_login: {
          mode: 'unsupported',
          browser_default: 'unsupported',
          browser_owner: 'none',
          recommended_command: null,
          agent_action: 'ask_user_for_browser_access',
          reason: 'no_desktop_shell_or_agent_browser_detected',
          suppress_flag: '--no-browser',
          suppress_env: 'OPENYIDA_NO_BROWSER',
          completion_signal: 'process_exit_and_final_json',
          playwright_required: false,
        },
        preflight: {
          recommended_command: 'openyida agent-capabilities --summary-json',
          run_once: true,
          additional_env_check_default: false,
          additional_login_check_default: false,
          trust_summary_json_as_builder_preflight: true,
        },
        environment_check_simplification: {
          minimal_probe_commands: [
            'which openyida',
            'openyida agent-capabilities --summary-json',
          ],
          skip_cookie_or_playwright_checks_default: true,
          default_app_list_policy: 'skip_when_bound_app_type_unique',
        },
        command_contract: {
          command_prefix: 'openyida',
          supported_command_count: manifest.commands.length,
          canonical_builder_command_ids: expect.arrayContaining([
            'agent-capabilities',
            'commands',
            'login',
            'logout',
            'auth',
            'app-list',
            'list-forms',
            'get-schema',
            'create-app',
            'create-form.create',
            'create-page',
            'publish',
          ]),
        },
        bound_context: {
          existing_app_type_policy: 'do_not_call_app_list_by_default',
        },
        resource_context_resolution: {
          if_bound_app_type_unique: {
            action: 'reuse_bound_app_type',
            command: null,
            skip_command_ids: ['app-list'],
          },
          full_contract_in: 'openyida agent-capabilities --json',
        },
        paths: {
          page_source_cli_path_policy: expect.stringContaining('pages/src/<file>'),
        },
      },
    });
    expect(parsed.command_manifest_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.cache_dir).toBe(path.join(parsed.workdir, '.cache'));
    expect(parsed.openyida_task_cache_dir).toBe(path.join(parsed.workdir, '.cache', 'openyida'));
    expect(parsed).not.toHaveProperty('system');
    expect(parsed).not.toHaveProperty('active');
    expect(parsed).not.toHaveProperty('recommended');
    expect(parsed).not.toHaveProperty('commands');
    expect(parsed).not.toHaveProperty('command_manifest');
    expect(parsed.login).not.toHaveProperty('diagnostics');
    expect(parsed.login).not.toHaveProperty('cookies');
    expect(parsed.login).not.toHaveProperty('csrf_token');
    expect(parsed.builder_path.environment_check_simplification).not.toHaveProperty('skip_default_command_patterns');
    expect(parsed.builder_path.command_contract).not.toHaveProperty('supported_command_ids');
    expect(parsed.builder_path.command_contract).not.toHaveProperty('canonical_builder_commands');
    expect(parsed.builder_path.command_contract).not.toHaveProperty('forbidden_aliases');
    expect(parsed.builder_path.auth).not.toHaveProperty('prohibited_legacy_checks');
    expect(parsed.builder_path.resource_context_resolution).not.toHaveProperty('app_name_search');
    expect(parsed.builder_path.paths).not.toHaveProperty('page_source_examples');
    expect(parsed.builder_path.command_contract).toMatchObject({
      forbidden_aliases_available_in: 'openyida commands --json',
      forbidden_alias_count: manifest.forbidden_aliases.length,
      unknown_command_policy: 'deny_with_manifest_suggestion_before_asking_user',
    });
    expect(parsed.builder_path.auth).toMatchObject({
      auth_runtime: 'token_oauth_session',
      cookie_auth_supported: false,
      cookie_check_required: false,
      playwright_cookie_check_required: false,
      qr_login_required: false,
    });
  });

  test('agent-capabilities summary detects QwenWork web before MuleRun fallback', () => {
    const workspace = createCodexWorkspace();
    try {
      const summary = JSON.parse(runOkWithEnv(['agent-capabilities', '--summary-json'], {
        QWENWORK: '1',
        AGENT_PLATFORM: 'qwenwork_base',
        QWENWORK_CLIENT: 'acp',
        QWENWORK_WORKSPACE_DIR: workspace,
        QWENWORK_SANDBOX_ID: 'sandbox-web',
        QWENWORK_PREVIEW_URL: 'https://preview.example.test',
        QWENWORK_VNC_URL: 'https://vnc.example.test',
        MULERUN_CHAT_ID: 'mule-chat',
        MULE_DATA_DIR: '/tmp/.mulerun',
        MULE_WORKSPACE_DIR: '/tmp/mule-workspace',
        CLAUDE_CODE: '1',
      }, workspace));

      expect(summary.workdir).toBe(path.join(workspace, 'project'));
      expect(summary.runtime).toMatchObject({
        tool: 'qwenwork',
        display_name: 'QwenWork（千问办公）',
        runtime: 'web_sandbox',
        subtype: 'qwenwork_web',
        workspace_root: path.join(workspace, 'project'),
        workspace_root_source: 'QWENWORK_WORKSPACE_DIR',
        browser_capabilities: {
          desktop_shell: false,
          agent_browser: true,
          browser_auto_open: false,
          playwright_required: false,
        },
      });
      expect(summary.builder_path.interactive_login).toMatchObject({
        mode: 'caller_open_url',
        browser_default: 'caller_open_url',
        browser_owner: 'agent_browser',
        recommended_command: 'openyida login --no-browser',
        agent_action: 'open_cli_printed_url_once_with_agent_browser',
        url_source: 'login_command_stderr',
        manual_user_open_fallback: 'only_when_agent_browser_tool_unavailable_or_failed',
        must_not_only_print_url_when_agent_browser_available: true,
        reason: 'web_sandbox_agent_browser_available',
        playwright_required: false,
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('agent-capabilities summary detects QwenWork desktop before Qoder fallback', () => {
    const workspace = createCodexWorkspace();
    const projectDir = path.join(workspace, 'project');
    try {
      const summary = JSON.parse(runOkWithEnv(['agent-capabilities', '--summary-json'], {
        QODER_IDE: '1',
        QODER_AGENT: '1',
        QODERCLI_INTEGRATION_MODE: 'qoder_work',
        QODER_WORK_INTEGRATION_PRODUCT: 'qwenworkcn',
        QODERCN_CONFIG_DIR: path.join(tempHome, '.qwenworkcn'),
        QODER_CONFIG_DIR: path.join(tempHome, '.qwenworkcn'),
        QODER_WORKER_CWD: projectDir,
        __CFBundleIdentifier: 'cn.qwenwork.desktop.mac',
        CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
      }, workspace));

      expect(summary.workdir).toBe(projectDir);
      expect(summary.runtime).toMatchObject({
        tool: 'qwenwork',
        display_name: 'QwenWork（千问办公）',
        runtime: 'desktop_shell',
        subtype: 'qwenwork_desktop',
        workspace_root: projectDir,
        workspace_root_source: 'QODER_WORKER_CWD',
        browser_capabilities: {
          desktop_shell: true,
          agent_browser: true,
          browser_auto_open: true,
          playwright_required: false,
        },
      });
      expect(summary.builder_path.interactive_login).toMatchObject({
        mode: 'cli_auto_open',
        browser_default: 'cli_auto_open',
        browser_owner: 'cli',
        recommended_command: 'openyida login',
        agent_action: 'wait_for_login_command',
        reason: 'desktop_shell_available',
        playwright_required: false,
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('agent-capabilities summary keeps desktop shell login on CLI auto-open', () => {
    const workspace = createCodexWorkspace();
    try {
      const summary = JSON.parse(runOkWithEnv(['agent-capabilities', '--summary-json'], {
        OPENYIDA_ASSUME_DESKTOP: '1',
      }, workspace));

      expect(summary.runtime).toMatchObject({
        tool: null,
        runtime: 'desktop_shell',
        browser_capabilities: {
          desktop_shell: true,
          agent_browser: false,
          browser_auto_open: true,
          playwright_required: false,
        },
      });
      expect(summary.builder_path.interactive_login).toMatchObject({
        mode: 'cli_auto_open',
        browser_owner: 'cli',
        recommended_command: 'openyida login',
        reason: 'desktop_shell_available',
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('agent-capabilities command manifest digest canonicalizes object keys', () => {
    const manifest = {
      schema_version: 1,
      command_prefix: 'openyida',
      summary: {
        command_count: 1,
        group_count: 1,
        side_effect_counts: {
          remote_write: 0,
          local_read: 1,
        },
        permission_mode_counts: {
          ask: 0,
          allow: 1,
        },
        core_workflows: {
          full_app_build: {
            required_command_ids: ['agent-capabilities'],
            mode: 'unified_build',
          },
        },
      },
      commands: [{
        id: 'agent-capabilities',
        usage: 'openyida agent-capabilities [--json] [--summary-json|--compact]',
        requires_login: false,
        output: 'json',
        side_effect: { kind: 'local_read' },
        permission: { mode: 'allow', effect: 'read' },
      }],
    };
    const reorderedManifest = {
      command_prefix: 'openyida',
      schema_version: 1,
      commands: [{
        permission: { effect: 'read', mode: 'allow' },
        side_effect: { kind: 'local_read' },
        output: 'json',
        requires_login: false,
        usage: 'openyida agent-capabilities [--json] [--summary-json|--compact]',
        id: 'agent-capabilities',
      }],
      summary: {
        core_workflows: {
          full_app_build: {
            mode: 'unified_build',
            required_command_ids: ['agent-capabilities'],
          },
        },
        permission_mode_counts: {
          allow: 1,
          ask: 0,
        },
        side_effect_counts: {
          local_read: 1,
          remote_write: 0,
        },
        group_count: 1,
        command_count: 1,
      },
    };

    expect(buildCommandManifestDigest(reorderedManifest)).toBe(buildCommandManifestDigest(manifest));
  });

  test('agent-capabilities --json renders one-shot agent snapshot', () => {
    const output = runOk(['agent-capabilities', '--json']);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      schema_version: 1,
      name: 'openyida-agent-capabilities',
      openyida: {
        version,
        command_prefix: 'openyida',
      },
      skills: {
        index_file: 'skills-index.json',
        entry: 'openyida',
      },
    });
    expect(parsed.commands).toMatchObject({
      count: parsed.command_manifest.commands.length,
      group_count: parsed.command_manifest.groups.length,
    });
    expect(parsed.commands.side_effect_counts.remote_write).toBeGreaterThan(0);
    expect(parsed.commands.permission_mode_counts.allow).toBeGreaterThan(0);
    expect(parsed.commands.permission_mode_counts.ask).toBeGreaterThan(0);
    expect(parsed.commands.allow_command_ids).toContain('agent-capabilities');
    expect(parsed.commands.allow_command_ids).toEqual(expect.arrayContaining([
      'login',
      'logout',
      'auth',
    ]));
    expect(parsed.commands.allow_command_ids).toContain('create-app');
    expect(parsed.commands.ask_command_ids).toEqual([
      'app-offline',
      'connector.delete',
      'connector.delete-action',
    ]);
    expect(parsed.commands.read_only_command_ids).toContain('agent-capabilities');
    expect(parsed.commands.core_workflows.full_app_build).toMatchObject({
      mode: 'unified_build',
      default_page_skill_id: 'yida-canvas-custom-page',
      default_ui_guidance_skill_id: 'yida-design',
      ordinary_jsx_skill_id: 'yida-custom-page',
      required_command_ids: expect.arrayContaining([
        'create-app',
        'create-form.create',
        'create-process',
        'create-page',
        'publish',
        'nav-group',
      ]),
      do_not_default_skill_ids: expect.arrayContaining([
        'yida-data-source-connectors',
        'yida-data-management',
      ]),
      product_design_policy: expect.stringContaining('resource creation order, page implementation delivery order, navigation order'),
      ui_guidance_policy: expect.stringContaining('only design sources of truth'),
      default_nav_order_policy: expect.stringContaining('openyida nav-group order <appType> <items...>'),
      completion_contract: expect.stringContaining('PRD navigation order or lightweight fallback navigation order'),
      recommended_read_commands: expect.arrayContaining([
        expect.stringContaining('--summary-json'),
      ]),
      default_data_contract: expect.stringContaining('this.dataSourceMap'),
    });
    expect(parsed.commands.core_workflows.full_app_build.page_skill_policy)
      .toContain('existing .oyd.jsx/.oyb.jsx/renderJsx/platform Jsx component maintenance');
    expect(parsed.commands.core_workflows.full_app_build.page_skill_policy)
      .not.toContain('page strongly depends on this.$');
    expect(parsed.commands.core_workflows.full_app_build.page_skill_policy)
      .not.toContain('deep field two-way binding');
    expect(parsed.commands.core_workflows.full_app_build.ui_guidance_policy).toContain('prd.md + design.md');
    expect(parsed.commands.core_workflows.full_app_build.default_nav_order_policy).toContain('portal/home/workbench entry > business handling > data management > business analytics > system configuration');
    expect(parsed.commands.core_workflows.full_app_build.do_not_default_skill_ids).not.toContain('yida-design');
    expect(parsed.recommended.default_full_app_workflow).toMatchObject({
      mode: 'unified_build',
      completion_contract: expect.stringContaining('create or reuse app'),
    });
    expect(parsed.recommended.default_full_app_workflow.completion_contract).toContain('Markdown table');
    expect(parsed.builder_path.bound_context).toMatchObject({
      existing_app_type_policy: 'do_not_call_app_list_by_default',
      skip_app_list_when: expect.arrayContaining([
        'appType is already provided by the user',
        'a bound app context is already available',
      ]),
    });
    expect(parsed.builder_path.resource_context_resolution).toMatchObject({
      if_bound_app_type_unique: {
        action: 'reuse_bound_app_type',
        command: null,
        skip_command_ids: ['app-list'],
      },
      app_name_search: {
        command_id: 'app-list',
      },
      app_forms_or_pages_lookup: {
        command_id: 'list-forms',
      },
      schema_or_field_lookup: {
        command_id: 'get-schema',
      },
    });
    expect(parsed.builder_path.environment_check_simplification).toMatchObject({
      minimal_probe_commands: [
        'which openyida',
        'openyida agent-capabilities --summary-json',
      ],
      skip_default_command_patterns: expect.arrayContaining([
        'openyida --help',
        'openyida env --json',
        'openyida login --check-only --json',
        'browser login',
        'qr login',
        'Playwright cookie inspection',
        'cookie cache inspection',
        'openyida app-list',
      ]),
      skip_help_discovery_default: true,
      skip_env_noise_default: true,
      skip_cookie_or_playwright_checks_default: true,
      default_app_list_policy: 'skip_when_bound_app_type_unique',
    });
    expect(parsed.builder_path.command_contract.canonical_builder_commands.map(entry => entry.id)).toEqual(expect.arrayContaining([
      'agent-capabilities',
      'commands',
      'login',
      'logout',
      'auth',
      'app-list',
      'list-forms',
      'get-schema',
      'create-app',
      'create-form.create',
      'create-page',
      'publish',
    ]));
    expect(parsed.recommended.preflight_command).toBe('openyida agent-capabilities --summary-json');
    expect(parsed.recommended.full_capabilities_command).toBe('openyida agent-capabilities --json');
    expect(parsed.recommended).not.toHaveProperty('builder_path');
    expect(parsed.builder_path.preflight.run_once).toBe(true);
    expect(parsed.command_manifest.side_effect_schema).toMatchObject({
      version: 1,
      kinds: {
        mixed: expect.stringContaining('Action-dependent command'),
      },
    });
    expect(parsed.command_manifest.permission_schema).toMatchObject({
      version: 1,
      modes: {
        allow: expect.stringContaining('Allowed by the current OpenYida agent policy'),
        ask: expect.stringContaining('Requires user confirmation'),
      },
    });
    expect(parsed.command_manifest.forbidden_aliases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pattern: 'list-apps',
        suggested_command_id: 'app-list',
      }),
    ]));
    expect(parsed.command_manifest.summary.command_count).toBe(parsed.command_manifest.commands.length);
    expect(parsed.login).toHaveProperty('status');
    expect(parsed.login).not.toHaveProperty('cookies');
    expect(parsed.login).not.toHaveProperty('csrf_token');
    expect(parsed.sideEffects.read_only_preflight).toContain('openyida agent-capabilities --summary-json');
    expect(parsed.sideEffects.read_only_preflight).not.toContain('openyida agent-capabilities --json');
    expect(parsed.sideEffects.completion_contracts.full_app).toContain('creating or reusing the app');
    expect(parsed.sideEffects.completion_contracts.full_app).toContain('Markdown table');
    expect(parsed.sideEffects.full_app_data_contract).toContain('this.dataSourceMap');
    const commandIds = parsed.command_manifest.commands.map(entry => entry.id);
    const commandById = Object.fromEntries(parsed.command_manifest.commands.map(entry => [entry.id, entry]));
    expect(commandIds).toContain('agent-capabilities');
    expect(commandById['create-app'].side_effect).toMatchObject({
      kind: 'remote_write',
      mutates_yida: true,
    });
    expect(commandById['create-app'].permission).toMatchObject({
      mode: 'allow',
      effect: 'write',
    });
    expect(commandById['app-list'].side_effect).toMatchObject({
      kind: 'remote_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById['app-list'].permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
    expect(commandById['formula.evaluate'].side_effect).toMatchObject({
      kind: 'local_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById['formula.evaluate'].permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
    expect(commandById['check-page'].side_effect).toMatchObject({
      kind: 'local_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById['generate-page']).toBeUndefined();
    expect(commandById['dws.contact-user-search'].side_effect).toMatchObject({
      kind: 'remote_read',
      mutates_yida: false,
      mutates_local: false,
    });
    expect(commandById.ai.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: false,
      action_dependent: true,
    });
    expect(commandById.batch.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: true,
      action_dependent: true,
    });
    expect(commandById.auth.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: false,
      mutates_local: true,
      read_actions: ['status', 'profiles'],
      mutating_actions: ['login', 'refresh', 'logout', 'profile switch'],
    });
    expect(commandById.org.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: false,
      mutates_local: true,
    });
    expect(commandById.doctor.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: false,
      mutates_local: true,
    });
    expect(commandById.feedback.side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: true,
    });
    expect(commandById['corp-efficiency'].side_effect).toMatchObject({
      kind: 'mixed',
      mutates_yida: true,
      mutates_local: false,
    });
    expect(commandById['connector.delete'].permission).toMatchObject({
      mode: 'ask',
      effect: 'destructive',
    });
    expect(commandById['integration.list'].permission).toMatchObject({
      mode: 'allow',
      effect: 'read',
    });
    expect(commandById['basic-info'].permission).toMatchObject({
      mode: 'allow',
      action_dependent: true,
      preauthorized_actions: ['domain set'],
      ask_actions: [],
      unknown_action_mode: 'ask',
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
    expect(output).toContain('Code Templates');
    expect(output).toContain('yida-chart');
    expect(output).toContain('yida-canvas-table-form');
    expect(output).toContain('table-form-batch-submit');
    expect(output).not.toContain('yida-custom-page');
    expect(output).not.toContain('yida-canvas-custom-page');
    expect(output).not.toContain('product-homepage');
    expect(output).not.toContain('todo-mvc');
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
    expect(parsed).toHaveProperty('login.diagnostics.tokenFileFound');
    expect(parsed).toHaveProperty('login.diagnostics.tokenFound');
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
      expect(parsed.login.diagnostics.currentEnv).toBe('intl');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login target URL infers Alibaba intranet environment for check-only', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv([
        'login',
        'https://yida-group.alibaba-inc.com/',
        '--check-only',
        '--json',
      ], {
        CODEX_SHELL: '1',
      }, workspace);
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('not_logged_in');
      expect(parsed.auth_mode).toBe('token');
      expect(parsed.token_file).toContain('auth-token-alibaba.json');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login target URL is inferred even when it follows check-only flags', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv([
        'login',
        '--check-only',
        '--json',
        'https://www.yidaapps.com/',
      ], {
        CODEX_SHELL: '1',
      }, workspace);
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('not_logged_in');
      expect(parsed.auth_mode).toBe('token');
      expect(parsed.token_file).toContain('auth-token-intl.json');
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

  test('copy --force initializes current directory when no AI tool is active', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-copy-force-'));
    try {
      const output = runOkWithEnv(['copy', '--force'], {}, workspace);
      expect(output).toContain('--force 模式');
      expect(fs.existsSync(path.join(workspace, 'config.json'))).toBe(true);
      expect(fs.existsSync(path.join(workspace, 'pages', 'src'))).toBe(true);
      expect(fs.existsSync(path.join(workspace, '.cache'))).toBe(false);
      expect(fs.existsSync(path.join(workspace, 'pages', 'build'))).toBe(false);
      expect(fs.existsSync(path.join(workspace, 'pages', 'dist'))).toBe(false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('login --check-only reports token status without legacy cookie handoff', () => {
    const workspace = createCodexWorkspace();
    try {
      const output = runOkWithEnv(['login', '--check-only'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
      }, workspace);
      const parsed = JSON.parse(output.trim());
      expect(parsed).toMatchObject({
        auth_mode: 'token',
        status: 'not_logged_in',
        can_auto_use: false,
      });
      expect(parsed).not.toHaveProperty('handoff_type');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('OPENYIDA_AUTH_MODE=token reports env token status and does not start OAuth login', () => {
    const workspace = createCodexWorkspace();
    const env = {
      CODEX_SHELL: '1',
      OPENYIDA_ENV: 'public',
      OPENYIDA_AUTH_MODE: 'token',
      OPENYIDA_ACCESS_TOKEN: 'env-access-token',
      OPENYIDA_TOKEN_CORP_ID: 'corpEnv',
      OPENYIDA_TOKEN_USER_ID: 'userEnv',
      OPENYIDA_ENDPOINT: 'https://env-token.example.com',
    };

    try {
      const checkOnly = JSON.parse(runOkWithEnv(['login', '--check-only', '--json'], env, workspace));
      expect(checkOnly).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        status: 'ok',
        can_auto_use: true,
        corp_id: 'corpEnv',
        user_id: 'userEnv',
      });
      expect(checkOnly).not.toHaveProperty('cookies');
      expect(checkOnly).not.toHaveProperty('csrf_token');

      const loginOutput = runOkWithEnv(['login', '--json'], env, workspace);
      expect(loginOutput).not.toContain('login.dingtalk.com/oauth2/auth');
      const login = JSON.parse(loginOutput);
      expect(login).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        auth_store: 'env',
        status: 'ok',
        can_auto_use: true,
      });
      expect(login).not.toHaveProperty('already_logged_in');
      expect(login).not.toHaveProperty('login_action');
      expect(login).not.toHaveProperty('previous_status');

      const authStatus = JSON.parse(runOkWithEnv(['auth', 'status', '--json'], env, workspace));
      expect(authStatus).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        status: 'ok',
        can_auto_use: true,
      });

      const refresh = JSON.parse(runOkWithEnv(['auth', 'refresh', '--json'], env, workspace));
      expect(refresh).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        status: 'missing_refresh_token',
        can_auto_use: false,
      });
      expect(refresh).not.toHaveProperty('access_token');
      expect(refresh).not.toHaveProperty('refresh_token');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('OPENYIDA_AUTH_MODE=token is visible in env and agent-capabilities preflight output', () => {
    const workspace = createCodexWorkspace();
    const env = {
      CODEX_SHELL: '1',
      OPENYIDA_ENV: 'public',
      OPENYIDA_AUTH_MODE: 'token',
      OPENYIDA_ACCESS_TOKEN: 'env-access-token',
      OPENYIDA_TOKEN_CORP_ID: 'corpEnv',
      OPENYIDA_TOKEN_USER_ID: 'userEnv',
      OPENYIDA_ENDPOINT: 'https://env-token.example.com',
    };

    try {
      const envSnapshot = JSON.parse(runOkWithEnv(['env', '--json'], env, workspace));
      expect(envSnapshot.login).toMatchObject({
        loggedIn: true,
        canAutoUse: true,
        authSource: 'env',
        authMode: 'token',
        corpId: 'corpEnv',
        userId: 'userEnv',
      });
      expect(envSnapshot.login).not.toHaveProperty('cookies');
      expect(envSnapshot.login).not.toHaveProperty('csrfToken');
      expect(envSnapshot.login.diagnostics).toMatchObject({
        authMode: 'token',
        authSource: 'env',
        tokenFound: true,
      });

      const summary = JSON.parse(runOkWithEnv(['agent-capabilities', '--summary-json'], env, workspace));
      expect(summary.login).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        auth_store: 'env',
        status: 'ok',
        can_auto_use: true,
      });
      expect(summary).not.toHaveProperty('precheck');
      expect(summary.builder_path.auth).toMatchObject({
        mode: 'token',
        source: 'env',
        store: 'env',
        can_auto_use: true,
        interactive_login_allowed: false,
        browser_session_auth_allowed: false,
        missing_token_action: 'STOP_AND_REQUEST_ENV_TOKEN',
      });
      expect(summary.builder_path.interactive_login).toMatchObject({
        mode: 'not_required',
        browser_default: 'not_required',
        browser_owner: 'none',
        recommended_command: null,
        agent_action: 'do_not_run_oauth_login',
        reason: 'env_token_bootstrap',
      });
      expect(summary.builder_path.preflight).toMatchObject({
        recommended_command: 'openyida agent-capabilities --summary-json',
        run_once: true,
        additional_env_check_default: false,
        additional_login_check_default: false,
        trust_summary_json_as_builder_preflight: true,
      });
      expect(summary.builder_path.environment_check_simplification).toMatchObject({
        can_skip_default_exploration_when_summary_ok: true,
        skip_login_check_only_default: true,
        skip_browser_login_default: true,
        skip_cookie_or_playwright_checks_default: true,
        stop_when_env_token_missing: false,
      });
      expect(JSON.stringify(summary)).not.toContain('host_injected');
      expect(JSON.stringify(summary)).not.toContain('host_token');
      expect(summary.builder_path.environment_check_simplification).not.toHaveProperty('skip_default_command_patterns');
      expect(summary.builder_path.bound_context.existing_app_type_policy).toBe('do_not_call_app_list_by_default');
      expect(JSON.stringify(summary)).not.toContain('login.dingtalk.com/oauth2/auth');
      expect(JSON.stringify(summary)).not.toContain('cookies.json');
      expect(summary.login).not.toHaveProperty('cookies');
      expect(summary.login).not.toHaveProperty('csrf_token');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('OPENYIDA_AUTH_MODE=token ignores legacy cookies.json when env token is missing', () => {
    const workspace = createCodexWorkspace();
    writeIgnoredLegacyCookieCache(workspace);
    try {
      const parsed = JSON.parse(runOkWithEnv(['login', '--check-only', '--json'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_AUTH_MODE: 'token',
      }, workspace));
      expect(parsed).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        status: 'not_logged_in',
        can_auto_use: false,
        failure_reason: 'env_token_missing',
      });
      expect(parsed).not.toHaveProperty('csrf_token');
      expect(parsed).not.toHaveProperty('cookies');

      const refresh = JSON.parse(runOkWithEnv(['auth', 'refresh', '--json'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_AUTH_MODE: 'token',
      }, workspace));
      expect(refresh).toMatchObject({
        auth_mode: 'token',
        status: 'missing_refresh_token',
        can_auto_use: false,
      });
      expect(refresh).not.toHaveProperty('access_token');
      expect(refresh).not.toHaveProperty('refresh_token');

      const summary = JSON.parse(runOkWithEnv(['agent-capabilities', '--summary-json'], {
        CODEX_SHELL: '1',
        OPENYIDA_ENV: 'public',
        OPENYIDA_AUTH_MODE: 'token',
      }, workspace));
      expect(summary.login).toMatchObject({
        auth_mode: 'token',
        auth_source: 'env',
        status: 'not_logged_in',
        can_auto_use: false,
      });
      expect(summary).not.toHaveProperty('precheck');
      expect(summary.builder_path.auth).toMatchObject({
        interactive_login_allowed: false,
        missing_token_action: 'STOP_AND_REQUEST_ENV_TOKEN',
      });
      expect(summary.builder_path.interactive_login).toMatchObject({
        mode: 'not_required',
        browser_owner: 'none',
        recommended_command: null,
        reason: 'env_token_bootstrap',
      });
      expect(summary.builder_path.environment_check_simplification).toMatchObject({
        can_skip_default_exploration_when_summary_ok: false,
        skip_login_check_only_default: false,
        skip_browser_login_default: true,
        skip_cookie_or_playwright_checks_default: true,
        stop_when_env_token_missing: true,
      });
      expect(JSON.stringify(summary)).not.toContain('host_injected');
      expect(JSON.stringify(summary)).not.toContain('host_token');
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
      { args: ['corp-manager', 'list'], expected: 'corp-manager' },
      { args: ['agent-center', 'cancel'], expected: 'agent-center' },
    ];

    for (const item of cases) {
      const result = runAny(item.args);
      expect(result.status).toBe(1);
      expect(result.output).toContain(item.expected);
    }
  });

  test('route-level failures support JSON error output', () => {
    const result = runAny(['unknown-command', '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.jsonOutput)).toMatchObject({
      success: false,
      errorCode: 'INVALID_ARGUMENTS',
      errorMsg: expect.stringContaining('未知命令'),
    });
  });

  test('forbidden alias unknown commands fail with manifest suggestions', () => {
    const listApps = runAny(['list-apps']);
    expect(listApps.status).toBe(1);
    expect(listApps.output).toContain('未知命令');
    expect(listApps.output).toContain('建议命令: openyida app-list [--size N]');
    expect(listApps.output).toContain('`list-apps` 不是 OpenYida 命令；请使用 `app-list` 查询应用。');
    expect(listApps.output).not.toContain('is not an OpenYida command');

    const getApp = runAny(['get-app', '--json']);
    expect(getApp.status).toBe(1);
    const parsed = JSON.parse(getApp.jsonOutput);
    expect(parsed.errorMsg).toContain('openyida app-list [--size N]');
    expect(parsed.errorMsg).toContain('`get-app` 含义不明确');
    expect(parsed.errorMsg).not.toContain('is ambiguous');
    expect(parsed.details.suggestion).toMatchObject({
      pattern: 'get-app',
      suggested_command_id: 'app-list',
      alternative_command_ids: ['get-schema', 'agent-capabilities'],
      message_key: 'cli.forbidden_alias_get_app',
      message_args: ['get-app', 'app-list', 'get-schema', 'agent-capabilities'],
    });

    const nearest = runAny(['app-lst']);
    expect(nearest.status).toBe(1);
    expect(nearest.output).toContain('建议命令: openyida app-list [--size N]');
    expect(nearest.output).toContain('未知 OpenYida 命令根「app-lst」。你是不是想用「app-list」？');
    expect(nearest.output).not.toContain('Unknown OpenYida command root');
  });

  test('publish keeps source-first CLI order through the router', () => {
    const sourceFile = 'pages/src/missing-publish-source.oyd.jsx';
    const result = runAny(['publish', sourceFile, 'APP_XXX', 'FORM-XXX', '--no-open']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('missing-publish-source.oyd.jsx');
    expect(result.output).not.toContain(path.join(ROOT, 'FORM-XXX'));
  });

  test('Canvas publish rejects emoji in source filenames before login', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-canvas-'));
    try {
      const sourcePath = path.join(workspace, 'pages', 'src', 'home-✅.canvas.jsx');
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, 'export default function Page() { return <div>ok</div>; }\n', 'utf8');

      const result = runAny(['publish', sourcePath, 'APP_TEST', 'FORM-TEST', '--no-open']);

      expect(result.status).toBe(1);
      expect(result.output).toMatch(/OPENYIDA_PAGE_FILENAME_EMOJI_FORBIDDEN|contains emoji/);
      expect(result.output).not.toContain('读取登录态');
      expect(result.output).not.toContain('Read login credentials');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('Canvas publish --json preserves emoji source error code and details before login', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-canvas-'));
    try {
      const sourcePath = path.join(workspace, 'pages', 'src', 'home.canvas.jsx');
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, [
        'import React from "react";',
        'export default function Page() {',
        '  return <div>Menu ☰</div>;',
        '}',
        '',
      ].join('\n'), 'utf8');

      const result = runAny(['publish', sourcePath, 'APP_TEST', 'FORM-TEST', '--no-open', '--json']);
      const parsed = JSON.parse(result.jsonOutput);

      expect(result.status).toBe(1);
      expect(parsed).toMatchObject({
        success: false,
        errorCode: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
        details: {
          stage: 'canvas_compile',
          sourcePath,
          artifact: sourcePath,
          issues: [
            expect.objectContaining({
              line: 3,
              column: expect.any(Number),
              emoji: '☰',
            }),
          ],
        },
      });
      expect(parsed.errorMsg).toContain('OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN');
      expect(parsed.details).not.toHaveProperty('causeCode');
      expect(parsed.details).not.toHaveProperty('causeDetails');
      expect(result.output).not.toContain('读取登录态');
      expect(result.output).not.toContain('Read login credentials');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test('Canvas publish non-json prints source emoji error code before login', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-publish-canvas-'));
    try {
      const sourcePath = path.join(workspace, 'pages', 'src', 'home.canvas.jsx');
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, [
        'import React from "react";',
        'export default function Page() {',
        '  return <div>Menu ☰</div>;',
        '}',
        '',
      ].join('\n'), 'utf8');

      const result = runAny(['publish', sourcePath, 'APP_TEST', 'FORM-TEST', '--no-open']);

      expect(result.status).toBe(1);
      expect(result.output).toContain('OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN');
      expect(result.output).toContain(`${sourcePath}:3:`);
      expect(result.output).toContain('Remove emoji');
      expect(result.output).not.toContain('读取登录态');
      expect(result.output).not.toContain('Read login credentials');
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
