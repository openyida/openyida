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
    QODER_PRODUCT_ID: '',
    QODER_SESSION_TYPE: '',
    QODER_CLI: '',
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
    stdio: 'pipe',
    timeout: 10000,
  });
}

function runOkWithEnv(args, extraEnv, cwd = ROOT) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...cliEnv(), ...extraEnv },
    encoding: 'utf8',
    stdio: 'pipe',
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
    expect(output).toContain('integration update <appType>');
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
    expect(output).not.toContain('--theme');
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
      { args: ['copy', '--help'], text: 'openyida copy' },
      { args: ['copy', '-h'], text: 'openyida copy' },
    ];

    for (const item of cases) {
      const result = runAny(item.args);
      expect(result.status).toBe(0);
      expect(result.output).toContain(item.text);
      expect(result.output).not.toContain('读取登录态');
    }
  });

  test('agent capability auth profile recommendations are accepted by the CLI parser', () => {
    const profiles = runAny(['auth', 'profiles']);
    expect(profiles.status).toBe(0);
    expect(() => JSON.parse(profiles.stdout)).not.toThrow();
    const legacyList = runAny(['auth', 'profile', 'list', '--json']);
    expect(legacyList.status).toBe(0);
    expect(JSON.parse(legacyList.stdout)).toEqual(JSON.parse(profiles.stdout));

    const switchResult = runAny(['auth', 'profile', 'switch', '__missing_profile__', '--json']);
    expect(switchResult.status).toBe(1);
    expect(JSON.parse(switchResult.stderr)).toMatchObject({
      success: false,
      errorCode: 'AUTH_PROFILE_NOT_FOUND',
    });
  });

  test('process and data command metadata matches output and documented input modes', () => {
    const { commands } = JSON.parse(runOk(['commands', '--json']));
    const process = commands.find(item => item.id === 'create-process');
    const data = commands.find(item => item.id === 'data');
    expect(process.output).toBe('json');
    expect(data.output).toBe('json');
    expect(process.notes.join(' ')).toContain('formMode=create|reuse');
    expect(process.notes.join(' ')).toContain('formTitle、fieldCount 为 null');
    expect(data.notes.join(' ')).toContain('CascadeDateField 传毫秒时间戳数组');
    const help = runOk(['create-process', '--help']);
    expect(help).toContain('<formTitle> <fieldsJsonFile> <processDefinitionFile> [--replace]');
    expect(help).toContain('--formUuid <formUuid> <processDefinitionFile> [--replace]');
    expect(help).toContain(process.notes[0]);
    expect(runOk(['data', 'create', '--help'])).toContain(data.notes[0]);
    const englishHelp = runOkWithEnv(['create-process', '--help'], { OPENYIDA_LANG: 'en' });
    expect(englishHelp).toContain('formTitle and fieldCount are null');
    expect(runOkWithEnv(['data', '--help'], { OPENYIDA_LANG: 'en' })).toContain('CascadeDateField uses an array');
    const { parseArgs } = require('../lib/process/create-process');
    expect(parseArgs(['APP', '审批表', 'fields.json', 'process.json', '--replace'])).toMatchObject({
      appType: 'APP', formTitle: '审批表', fieldsJsonFile: 'fields.json', processDefinitionFile: 'process.json', existingFormUuid: null, replace: true,
    });
    expect(parseArgs(['APP', '--formUuid', 'FORM', 'process.json', '--replace'])).toMatchObject({
      appType: 'APP', formTitle: null, fieldsJsonFile: null, processDefinitionFile: 'process.json', existingFormUuid: 'FORM', replace: true,
    });
  });

  test('process CLI identifies incorrect arguments before login in JSON output', () => {
    const result = runAnyWithEnv(['create-process', 'APP', '--formUuid', '--replace', '--json'], {});
    expect(result.status).not.toBe(0);
    const output = JSON.parse(result.stderr);
    expect(output).toMatchObject({ success: false, errorCode: 'CREATE_PROCESS_INVALID_ARGUMENTS', details: { argument: '--formUuid', reason: 'missing_value' } });
  });

  test('CRM Pro command help probes exit successfully without requiring login', () => {
    const probes = [
      { args: ['get-schema', '--help'], text: 'openyida get-schema' },
      { args: ['query-data', '--help'], text: 'openyida data' },
      { args: ['data-manage', '--help'], text: 'openyida data' },
      { args: ['data', '--help'], text: 'openyida data' },
      { args: ['data', 'create', '--help'], text: 'openyida data' },
      { args: ['report', '--help'], text: 'openyida report inspect' },
      { args: ['create-process', '--help'], text: 'openyida create-process' },
      { args: ['configure-process', '--help'], text: 'nodes[].actions.normalActions/appendActions' },
      { args: ['configure-process', '-h'], text: 'openyida configure-process' },
      { args: ['create-report', '--help'], text: 'openyida create-report' },
      { args: ['append-chart', '--help'], text: 'openyida append-chart' },
      { args: ['append-chart', '-h'], text: 'openyida append-chart' },
      { args: ['save-share-config', '--help'], text: 'openyida save-share-config' },
      { args: ['verify-short-url', '--help'], text: 'openyida verify-short-url' },
      { args: ['integration-create', '--help'], text: 'openyida integration create' },
      { args: ['save-permission', '--help'], text: 'openyida save-permission' },
      { args: ['get-permission', '--help'], text: 'openyida get-permission' },
    ];

    for (const probe of probes) {
      const result = runAny(probe.args);
      expect(result.status).toBe(0);
      expect(result.output).toContain(probe.text);
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
    expect(result.output).toContain('--device');
    expect(result.output).toContain('--env-hint');
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

  test('planning and sample commands expose every documented option and permission', () => {
    const manifest = JSON.parse(runOk(['commands', '--json']));
    const entries = Object.fromEntries(manifest.commands.map(entry => [entry.id, entry]));
    for (const id of ['design-plan.init', 'design-plan.preview', 'design-plan.materialize', 'design-plan.patch', 'create-form.batch', 'sample']) {
      const entry = entries[id];
      expect(entry).toBeDefined();
      const documented = [...new Set(entry.usage.match(/--[a-z][a-z-]*/g))].sort();
      const registered = entry.args.filter(arg => arg.source === 'option').flatMap(arg => arg.builder_options).sort();
      expect({ id, options: registered }).toEqual({ id, options: documented });
      expect(entry.permission).toMatchObject({ mode: 'allow', effect: 'write' });
      expect(entry.side_effect.kind).toBe(id === 'create-form.batch' ? 'remote_write' : 'local_write');
    }
    expect(entries['create-form.batch'].side_effect.mutates_local).toBe(true);
    expect(entries['design-plan.patch'].args.find(arg => arg.name === 'set')).toMatchObject({ required: true, repeatable: true });
    expect(entries.sample.args.find(arg => arg.name === 'var')).toMatchObject({ repeatable: true });
    expect(entries['create-form.batch'].args.find(arg => arg.name === 'concurrency')).toMatchObject({ type: 'integer', default: 3 });
  });

  test('page commands expose navigation recovery and form drawer validation contracts', () => {
    const { commands } = JSON.parse(runOk(['commands', '--json']));
    const page = commands.find(item => item.id === 'create-page');
    const check = commands.find(item => item.id === 'check-page');
    const help = runAny(['create-page', '--help']).output;
    for (const flag of page.usage.match(/--[a-z][a-z-]*/g)) {
      expect(help).toContain(flag);
    }
    expect(page.notes.join(' ')).toContain('CREATE_PAGE_NAVIGATION_NOT_VERIFIED');
    expect(page.notes.join(' ')).toContain('pageCreated=true');
    expect(page.notes.join(' ')).toContain('Never repeat create-page');
    expect(check.requires_login).toBe(false);
    const { parseArgs } = require('../lib/app/check-page');
    for (const option of check.args.find(arg => arg.name === 'compat').builder_options) {
      expect(parseArgs(['example.canvas.jsx', option, '--json'])).toEqual({ sourceFile: 'example.canvas.jsx', compat: true, json: true });
    }
    for (const id of ['sample', 'check-page', 'compile', 'publish']) {
      expect(commands.find(item => item.id === id).notes.join(' ')).toContain('form-open-container');
    }
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
        suggested_usage: 'openyida app-list [--type managed|created] [--page N] [--size N]',
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
      'integration.update',
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
      orchestrator_skill_id: 'yida-app',
      default_page_skill_id: 'yida-canvas-custom-page',
      default_ui_guidance_skill_id: 'yida-design',
      requirement_analysis_skill_id: 'yida-requirement-analysis',
      requirement_brief_path: '.cache/openyida/<project>/requirement-brief.json',
      artifact_generation: {
        mode: 'parallel',
        tasks: [
          { skill_id: 'yida-prd', output_path: 'prd/<project>/prd.md' },
          { skill_id: 'yida-design', output_path: 'prd/<project>/design.md' },
        ],
        join_owner_skill_id: 'yida-app',
      },
      ordinary_jsx_skill_id: 'yida-custom-page',
      required_command_ids: expect.arrayContaining([
        'agent-capabilities',
        'create-app',
        'create-form.create',
        'create-process',
        'create-page',
        'publish',
      ]),
      do_not_default_skill_ids: expect.arrayContaining([
        'yida-data-source-connectors',
      ]),
      product_design_policy: expect.stringContaining('Prepare business and base visuals concurrently'),
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
    expect(parsed.summary.core_workflows.full_app_build.default_nav_order_policy).toContain('without creating a homepage or putting a frontend page first');
    expect(parsed.summary.core_workflows.full_app_build.do_not_default_skill_ids).not.toContain('yida-design');
    expect(parsed.summary.core_workflows.full_app_build.do_not_default_skill_ids).not.toContain('yida-data-management');
    expect(parsed.summary.core_workflows.full_app_build.ui_guidance_policy).toContain('Core normal forms default to 1-3 business sample records');
    expect(parsed.summary.core_workflows.full_app_build.optional_after_done_command_ids).not.toContain('data');
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
    expect(commands).toContain('integration.update');
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
    expect(parsed.commands.find(entry => entry.id === 'integration.update')).toMatchObject({
      usage: 'openyida integration update <appType> <formUuid> <processCode> --spec <desired-spec.json> [--publish]',
      output: 'json',
      requires_login: false,
      side_effect: { kind: 'local_write', mutates_yida: false, mutates_local: true },
      permission: { mode: 'allow', effect: 'write' },
    });
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
        expect.objectContaining({
          name: 'layout',
          source: 'option',
          builder_options: ['--layout'],
          default: 'single',
          values: ['single', 'double', 'card', 'section'],
        }),
        expect.objectContaining({
          name: 'theme',
          source: 'option',
          builder_options: ['--theme'],
          default: 'default',
          values: ['default', 'compact', 'comfortable'],
        }),
        expect.objectContaining({
          name: 'labelAlign',
          source: 'option',
          builder_options: ['--label-align'],
          default: 'top',
          values: ['top', 'left', 'right'],
        }),
        expect.objectContaining({
          name: 'icon',
          source: 'option',
          required: false,
          builder_options: ['--icon'],
          default: 'auto',
          value_catalog_command_id: 'create-form.icons',
        }),
        expect.objectContaining({
          name: 'contentLocale',
          source: 'option',
          builder_options: ['--locale', '--content-locale', '--lang'],
          values: ['zh_CN', 'en_US', 'ja_JP'],
        }),
        expect.objectContaining({ name: 'open', source: 'option', builder_options: ['--open'] }),
        expect.objectContaining({ name: 'noOpen', source: 'option', builder_options: ['--no-open'] }),
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
    expect(commandById['create-form.icons']).toMatchObject({
      path: ['create-form', 'icons'],
      requires_login: false,
      output: 'json',
      args: [
        expect.objectContaining({
          name: 'json',
          type: 'boolean',
          source: 'option',
          builder_options: ['--json'],
        }),
      ],
      canonical: {
        command_id: 'create-form.icons',
        path: ['create-form', 'icons'],
        argv_template: ['create-form', 'icons', '[--json]'],
        display: 'openyida create-form icons [--json]',
      },
    });
    expect(commandById['generate-page']).toBeUndefined();
    expect(commandById['dws.contact-user-search'].side_effect).toMatchObject({
      kind: 'remote_read',
      mutates_yida: false,
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

  test('commands validate recognizes every manifest-declared create-form option', () => {
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
      '--layout',
      'section',
      '--theme',
      'comfortable',
      '--label-align',
      'right',
      '--icon',
      'name-card',
      '--locale',
      'en_US',
      '--no-open',
    ]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      ok: true,
      command_id: 'create-form.create',
      params: {
        appType: 'APP_xxx',
        formTitle: '访客登记',
        fieldsJsonFile: '.cache/openyida/visitor/fields.json',
        layout: 'section',
        theme: 'comfortable',
        labelAlign: 'right',
        icon: 'name-card',
        contentLocale: 'en_US',
        noOpen: true,
      },
      display: 'openyida create-form create APP_xxx "访客登记" .cache/openyida/visitor/fields.json --layout section --theme comfortable --label-align right --icon name-card --locale en_US --no-open',
    });
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

  test('commands build renders every manifest-declared create-form option', () => {
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
      '--layout',
      'card',
      '--theme',
      'compact',
      '--label-align',
      'left',
      '--icon',
      'name-card',
      '--locale',
      'ja_JP',
      '--open',
      '--json',
    ]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      ok: true,
      command_id: 'create-form.create',
      argv: [
        'create-form',
        'create',
        'APP_xxx',
        '访客登记',
        '.cache/openyida/visitor/fields.json',
        '--layout',
        'card',
        '--theme',
        'compact',
        '--label-align',
        'left',
        '--icon',
        'name-card',
        '--locale',
        'ja_JP',
        '--open',
      ],
      params: {
        layout: 'card',
        theme: 'compact',
        labelAlign: 'left',
        icon: 'name-card',
        contentLocale: 'ja_JP',
        open: true,
      },
    });
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
      full_app_artifact_route: {
        orchestrator_skill_id: 'yida-app',
        requirement_analysis_skill_id: 'yida-requirement-analysis',
        requirement_brief_path: '.cache/openyida/<project>/requirement-brief.json',
        artifact_generation: {
          mode: 'parallel',
          tasks: [
            { skill_id: 'yida-prd', output_path: 'prd/<project>/prd.md' },
            { skill_id: 'yida-design', output_path: 'prd/<project>/design.md' },
          ],
          join_owner_skill_id: 'yida-app',
        },
      },
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
            'create-form.icons',
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
      orchestrator_skill_id: 'yida-app',
      default_page_skill_id: 'yida-canvas-custom-page',
      default_ui_guidance_skill_id: 'yida-design',
      requirement_analysis_skill_id: 'yida-requirement-analysis',
      requirement_brief_path: '.cache/openyida/<project>/requirement-brief.json',
      artifact_generation: {
        mode: 'parallel',
        tasks: [
          { skill_id: 'yida-prd', output_path: 'prd/<project>/prd.md' },
          { skill_id: 'yida-design', output_path: 'prd/<project>/design.md' },
        ],
        join_owner_skill_id: 'yida-app',
      },
      ordinary_jsx_skill_id: 'yida-custom-page',
      required_command_ids: expect.arrayContaining([
        'create-app',
        'create-form.create',
        'create-process',
        'create-page',
        'publish',
      ]),
      do_not_default_skill_ids: expect.arrayContaining([
        'yida-data-source-connectors',
      ]),
      product_design_policy: expect.stringContaining('Prepare business and base visuals concurrently'),
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
    expect(parsed.commands.core_workflows.full_app_build.default_nav_order_policy).toContain('without creating a homepage or putting a frontend page first');
    expect(parsed.commands.core_workflows.full_app_build.do_not_default_skill_ids).not.toContain('yida-design');
    expect(parsed.commands.core_workflows.full_app_build.do_not_default_skill_ids).not.toContain('yida-data-management');
    expect(parsed.commands.core_workflows.full_app_build.ui_guidance_policy).toContain('Core normal forms default to 1-3 business sample records');
    expect(parsed.commands.core_workflows.full_app_build.optional_after_done_command_ids).not.toContain('data');
    expect(parsed.recommended.default_full_app_workflow).toMatchObject({
      mode: 'unified_build',
      completion_contract: expect.stringContaining('create or reuse app'),
    });
    expect(parsed.recommended.default_full_app_workflow.completion_contract).toContain('one named application entry group');
    expect(parsed.recommended.default_full_app_workflow.application_entry_policy).toEqual({
      delivery_unit: 'single_application_entry_group',
      persistence: {
        command_ids: ['app-entry.get', 'app-entry.set'],
        policy: expect.stringContaining('Conflicts require reread and review'),
      },
      workbench: {
        include: 'when_workspace_in_scope',
        url: '{base_url}/{appType}/workbench',
        task_url: '{base_url}/{appType}/workbench/{formUuid}',
        view_parameter: 'viewUuid',
        selection: 'one verified planned management default; use real resource/view IDs; no homepage required',
      },
      custom: {
        include: 'when_entry_mode_standalone_and_is_render_nav_false_readback',
        url: '{base_url}/{appType}/custom/{formUuid}',
      },
      admin: {
        include: 'default_for_complete_application',
        url: '{base_url}/{appType}/admin',
      },
      internal_artifacts: 'never_user_visible',
      business_resources: 'summary_only_unless_explicit_verified_manifest_requested',
    });
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
      'data',
      'nav-group',
      'get-permission',
      'save-permission',
      'create-app',
      'create-form.create',
      'create-form.icons',
      'create-page',
      'publish',
    ]));
    const builderCommands = new Map(parsed.builder_path.command_contract.canonical_builder_commands
      .map(entry => [entry.id, entry]));
    expect(builderCommands.get('create-form.create').args).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'icon', source: 'option', builder_options: ['--icon'] }),
    ]));
    expect(builderCommands.get('create-form.icons')).toMatchObject({
      usage: 'openyida create-form icons [--json]',
      args: [expect.objectContaining({ name: 'json', source: 'option' })],
    });
    expect(builderCommands.get('data').examples[0]).toContain('1787932800000');
    expect(builderCommands.get('nav-group').examples).toContain('openyida nav-group move APP_XXX FORM_XXX --to NAV_XXX');
    expect(builderCommands.get('save-permission').examples[0]).toContain('get-permission APP_XXX FORM_XXX');
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
    expect(parsed.sideEffects.completion_contracts.full_app).toContain('one named application entry group');
    expect(parsed.sideEffects.completion_contracts.full_app).toContain('do not deliver one artifact or link card per resource');
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
      read_actions: ['status', 'profiles', 'profile list'],
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
    expect(output).toContain('openyida-page-template');
    expect(output).toContain('openyida sample yida-design app-theme');
    expect(output).not.toContain('openyida-scaffold');
    expect(output).toContain('table-form-batch-submit');
    expect(output).toContain('canvas-form-drawer');
    expect(output).toContain('form-fields');
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
    expect(listApps.output).toContain('建议命令: openyida app-list [--type managed|created] [--page N] [--size N]');
    expect(listApps.output).toContain('`list-apps` 不是 OpenYida 命令；请使用 `app-list` 查询应用。');
    expect(listApps.output).not.toContain('is not an OpenYida command');

    const getApp = runAny(['get-app', '--json']);
    expect(getApp.status).toBe(1);
    const parsed = JSON.parse(getApp.jsonOutput);
    expect(parsed.errorMsg).toContain('openyida app-list [--type managed|created] [--page N] [--size N]');
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
    expect(nearest.output).toContain('建议命令: openyida app-list [--type managed|created] [--page N] [--size N]');
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

  test('Canvas compile and publish enforce form drawers even with skip-lint and force', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-form-drawer-contract-'));
    try {
      const source = 'workbench.canvas.jsx';
      fs.writeFileSync(path.join(workspace, source), `
        import React from 'react';
        export default function Page() {
          return <button onClick={() => window.open('/APP_TEST/submission/FORM_TEST', '_blank')}>新增</button>;
        }
      `);
      for (const args of [
        ['compile', source, '--skip-lint', '--json'],
        ['publish', source, 'APP_TEST', 'FORM_TEST', '--skip-lint', '--force', '--no-open', '--json'],
      ]) {
        const result = runAnyWithEnv(args, {}, workspace);
        expect(result.status).toBe(1);
        expect(JSON.parse(result.jsonOutput)).toMatchObject({
          success: false,
          errorCode: 'OPENYIDA_CANVAS_FORM_OPEN_CONTAINER_REQUIRED',
        });
        expect(result.output).toContain('form-open-container');
        expect(result.output).not.toContain('读取登录态');
      }
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


test('Plan and navigation commands are discoverable with their existing permission metadata', () => {
  const manifest = JSON.parse(runOk(['commands', '--json']));
  const summary = JSON.parse(runOk(['agent-capabilities', '--summary-json']));
  const commands = new Map(manifest.commands.map(command => [command.id, command]));
  const local = ['design-plan.init', 'design-plan.preview', 'design-plan.materialize', 'design-plan.patch', 'sample'];
  const remote = ['update-app', 'update-form-config', 'get-form-config'];
  for (const id of [...local, ...remote]) {
    expect(commands.get(id).permission.mode).toBe('allow');
    expect(summary.builder_path.command_contract.canonical_builder_command_ids).toContain(id);
  }
  for (const id of local) {
    expect(commands.get(id)).toMatchObject({ requires_login: false, side_effect: { kind: 'local_write', mutates_yida: false } });
  }
  for (const id of remote) {expect(commands.get(id).requires_login).toBe(true);}
  expect(commands.get('sample').usage).toContain('--design-file');
  expect(commands.get('sample').notes.join(' ')).toContain('CanvasThemeProvider');
  expect(commands.get('sample').notes.join(' ')).toContain('openyida-page-template canvas-theme');
  expect(commands.get('update-form-config').usage).toContain('<true|false|keep>');
  expect(commands.get('update-app').usage).toContain('[--layout side|top|l_shape]');
  expect(commands.get('update-app').usage).toContain('[--hide-app-nav|--show-app-nav]');
  expect(commands.get('update-app').usage).not.toContain('--nav-type');
  expect(commands.get('design-plan.init').notes.join(' ')).toContain('There is no navigation-tone argument');
  expect(commands.get('design-plan.materialize').notes.join(' ')).toContain('does not synthesize a light/dark replacement palette');
  expect(commands.get('design-plan.patch').notes.join(' ')).toContain('derived and cannot be patched');
  const navThemeArg = commands.get('update-app').args.find(arg => arg.name === 'navTheme');
  expect(navThemeArg.description).toContain('no implicit light default');
  expect(summary.full_app_artifact_route.plan_command_ids).toEqual(['design-plan.catalog', ...local.slice(0, 4)]);
  expect(commands.get('design-plan.catalog')).toMatchObject({ requires_login: false, permission: { mode: 'allow' }, side_effect: { kind: 'local_read', mutates_yida: false, mutates_local: false } });
  expect(summary.builder_path.command_contract.canonical_builder_command_ids).toContain('design-plan.catalog');
  expect(summary.full_app_artifact_route.navigation_command_ids.custom).toEqual(remote);
  expect(summary.full_app_artifact_route.navigation_policy.toLowerCase()).toContain('before prd planning');
});

test('command and agent navigation policies align with AI intake decisions', () => {
  const manifest = JSON.parse(runOk(['commands', '--json']));
  const summary = JSON.parse(runOk(['agent-capabilities', '--summary-json']));
  const capabilities = JSON.parse(runOk(['agent-capabilities', '--json']));
  const brief = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/navigation-decision.md'), 'utf8');
  expect(brief).toContain('# 平台导航与自定义导航决策');
  expect(brief).not.toContain('| 导航归属 |');
  expect(brief).not.toContain('你希望应用使用哪种导航菜单');
  expect(brief).toContain('ai_default');
  expect(brief).toContain('`user_selected`');

  const workflow = manifest.summary.core_workflows.full_app_build;
  for (const route of [workflow, summary.full_app_artifact_route, capabilities.commands.core_workflows.full_app_build]) {
    expect(route.form_entry_policy).toEqual(workflow.form_entry_policy);
    expect(route.divider_style_contract).toEqual(workflow.divider_style_contract);
    expect(route.divider_style_contract.supported_types).toEqual(require('../lib/app/form-field-validator').DIVIDER_TYPES);
    expect(route.divider_style_contract.supported_types).toHaveLength(23);
    expect(route.divider_style_contract.supported_types).not.toContain('none');
    expect(route.divider_style_contract.fallback).toBe('bold-with-thin');
    expect(route.form_entry_policy.sample_command).toBe('openyida sample openyida-page-template form-open-container --output .cache/samples/form-open-container.jsx');
    expect(route.navigation_policy).toBe(workflow.navigation_policy);
    expect(route.entry_navigation_contract).toEqual(workflow.entry_navigation_contract);
    expect(route.application_entry_policy).toEqual(workflow.application_entry_policy);
    expect(route.default_nav_order_policy).toBe(workflow.default_nav_order_policy);
    expect(route.final_link_policy).toBe(workflow.final_link_policy);
    expect(route.final_link_policy).toContain('terminal delivery artifact description');
    expect(route.final_link_policy).toContain('when no delivery tool is available');
    expect(route.navigation_policy).toContain('Before PRD planning in Fast and Plan, the agent determines navigation ownership and layout from business context');
    expect(route.navigation_policy).toContain('Preserve explicit user requirements and existing navigation');
    expect(route.navigation_policy).toContain('ai_default for agent ownership decisions');
    expect(route.navigation_policy).toContain('Include navigation in the overall Plan confirmation');
    expect(route.navigation_policy).toContain('Configure a custom frontend menu at page scope');
    expect(route.navigation_policy).toContain('Choose backend native or coding pages by task efficiency');
    expect(route.navigation_policy).toContain('Backend coding pages in platform-shell are content-only');
    expect(route.entry_navigation_contract.page_navigation_policy).toMatchObject({
      platform_shell: { applicationMenuOwner: 'platform', renderApplicationMenu: false },
      no_menu: { applicationMenuOwner: 'none', renderApplicationMenu: false },
      discussion: { fast: expect.stringContaining('no additional navigation approval gate') },
    });
    expect(route.entry_navigation_contract.runtime.applies_to).toContain('Confirmed page-owned application menus only');

    expect(route.navigation_policy).toContain('Persistent filters/state alone do not justify custom application navigation');
    expect(route.navigation_policy).toContain('Navigation tone is derived from the final selected theme template');
    expect(route.navigation_policy).toContain('never guessed from the business brief or implicitly defaulted to light');
    expect(route.navigation_policy).toContain('Custom top navigation defaults to edge-to-edge, not floating');
    expect(route.navigation_policy).toContain('start transparent, add a surface on scroll, restore transparency at the top');
    expect(route.navigation_policy).toContain('floating requires an explicit design');
    expect(route.navigation_policy).not.toContain('offer exactly two');
    expect(route.design_mode_policy).toBe(workflow.design_mode_policy);
    expect(route.design_mode_policy).toContain('Fast and Plan share one three-direction visual generation rule');
    expect(route.design_mode_policy).toContain('generate exactly three directions and use ask_human');
    expect(route.design_mode_policy).not.toContain('Confirm unresolved navigation');
    expect(route.product_design_policy).toBe(workflow.product_design_policy);
    expect(route.product_design_policy).toContain('Fast, Plan and single-page design share yida-design/templates/design-themes');
    expect(route.product_design_policy).toContain('plus scoped custom-page variables');
    expect(route.product_design_policy).toContain('Each selected template is the authority for navTheme, its six navigation color tokens, and its selected-item shadow token');
    expect(route.product_design_policy).toContain('preserves mode-independent navigation appearance tokens');
    expect(route.product_design_policy).toContain('never synthesizes a replacement navigation palette');
  }
  expect(workflow.default_nav_order_policy).toContain('preserves platform navigation for the management workspace');
  expect(workflow.entry_navigation_contract).toMatchObject({
    plan_path: 'execution.entryRecommendation',
    modes: ['unified', 'service-management', 'frontend-only', 'backend-only'],
    local_menu_binding: expect.stringContaining('management/workspace'),
    leaf_access_required: expect.stringContaining('Every leaf menu'),
    runtime: {
      modes: ['local', 'platform', 'independent'], default_mode: 'platform', builtin_permission_adapter: false,
      local_policy: expect.stringContaining('no platform navigation request'),
      platform_policy: expect.stringContaining('Every leaf binds formUuid/navUuid'),
      layout_policy: expect.stringContaining('layout=document with natural height'),
    },
  });
  expect(workflow.application_entry_policy.workbench).toMatchObject({
    task_url: '{base_url}/{appType}/workbench/{formUuid}', view_parameter: 'viewUuid',
  });
  for (const policy of [workflow.ui_guidance_policy, capabilities.commands.core_workflows.full_app_build.ui_guidance_policy]) {
    expect(policy).toContain('alongside page layout and interaction work');
    expect(policy).toContain('image binding and acceptance');
    expect(policy).not.toContain('before that page is implemented');
  }
  expect(workflow.completion_contract).toContain('delivery artifact description');
  expect(workflow.completion_contract).toContain('when no delivery tool is available');
  expect(workflow.completion_contract).toContain('frontend-only delivery includes its verified frontend entry and developer admin URL');
  expect(capabilities.recommended.default_full_app_workflow.completion_contract).toBe(workflow.completion_contract);
});

test('plain user-facing guidance is available from manifest and both agent capability formats', () => {
  const manifest = JSON.parse(runOk(['commands', '--json']));
  const summary = JSON.parse(runOk(['agent-capabilities', '--summary-json']));
  const capabilities = JSON.parse(runOk(['agent-capabilities', '--json']));
  const policy = manifest.summary.core_workflows.full_app_build.user_visible_expression_policy;
  expect(policy).toMatchObject({
    audience: 'nontechnical_user',
    wording: expect.stringContaining('everyday language'),
    failures: expect.stringContaining('pending verification'),
    diagnostics: expect.stringContaining('exact technical fields and error codes'),
    todo: {
      templates: 'yida-skills/skills/yida-design/references/ask-human-interaction-contract.md#步骤列表与进度',
      titles: expect.stringContaining('separate items'),
      scope: expect.stringContaining('agreed scope'),
      updates: expect.stringContaining('retain completed items'),
      details: expect.stringContaining('timings internally'),
    },
  });
  expect(summary.full_app_artifact_route.user_visible_expression_policy).toEqual(policy);
  expect(capabilities.commands.core_workflows.full_app_build.user_visible_expression_policy).toEqual(policy);
  expect(capabilities.recommended.default_full_app_workflow.user_visible_expression_policy).toEqual(policy);
  expect(fs.existsSync(path.join(ROOT, policy.reference))).toBe(true);
  const visual = manifest.summary.core_workflows.full_app_build.visual_decision_policy;
  expect(visual).toEqual(require('../lib/design-plan/visual-policy').getVisualDecisionPolicy());
  expect(summary.full_app_artifact_route.visual_decision_policy).toEqual(visual);
  expect(capabilities.commands.core_workflows.full_app_build.visual_decision_policy).toEqual(visual);
  expect(capabilities.recommended.default_full_app_workflow.visual_decision_policy).toEqual(visual);
  expect(visual.applicationStyle.navigationShape).toMatchObject({
    inputs: ['radius', 'normal_hover_selected_borders', 'selected_shadow', 'item_height', 'padding', 'gap', 'shell_spacing'],
    authoring: { fast: 'design.md tokens.application-global.appearance.navigation', plan: 'visualStyle.tokens' },
    verification: expect.arrayContaining(['native_data_management', 'custom_page', 'submission', 'record_detail']),
  });
  const [navigationReference, navigationAnchor] = visual.applicationStyle.navigationShape.reference.split('#');
  expect(fs.readFileSync(path.join(ROOT, navigationReference), 'utf8')).toContain(`### ${navigationAnchor}`);
  expect(fs.existsSync(path.join(ROOT, visual.reference.split('#')[0]))).toBe(true);
  expect(visual.reference).toBe('yida-skills/skills/yida-design/references/theme-selection.md#设计方向比较');
  expect(fs.readFileSync(path.join(ROOT, visual.reference.split('#')[0]), 'utf8')).toContain('## 设计方向比较');
  expect(visual.nativeFormLayout).toMatchObject({
    model: 'component_based_native_form_layout',
    regions: ['top', 'left', 'main', 'right', 'between_fields'],
    components: ['tabs', 'button_groups', 'images', 'graphics', 'status_blocks', 'dividers', 'columns', 'fields'],
  });
  expect(visual.nativeFormLayout.rules).toContain('preserve_existing_component_tree');
  expect(visual.nativeFormLayout.rules).toContain('use_divider_for_business_groups');
  expect(visual.nativeFormLayout.forbidden).toEqual(['generic_filler_copy', 'random_layout_rotation']);
});

test('asset fallback and completion policies are shared by the CLI, manifest and agent summary', () => {
  const sources = JSON.parse(runOk(['asset', 'sources', '--json']));
  const manifest = JSON.parse(runOk(['commands', '--json']));
  const summary = JSON.parse(runOk(['agent-capabilities', '--summary-json']));
  const policy = sources.guidance.failurePolicy;
  expect(policy).toMatchObject({
    attemptsPerCandidate: 1,
    sourceUnavailable: 'switch_source_for_remaining_slots',
    candidateFailed: 'replace_input',
    exhausted: 'planned_optional_layout_or_required_gap',
  });
  expect(manifest.summary.core_workflows.full_app_build.optional_asset_branch.failure_policy).toEqual(policy);
  expect(summary.full_app_artifact_route.optional_asset_branch.failure_policy).toEqual(policy);
  const collection = sources.guidance.collectionPolicy;
  const scheduling = sources.guidance.schedulingPolicy;
  expect(scheduling).toMatchObject({ searchConcurrency: 4, searchUnit: 'slot', resultWriter: 'one_per_page',
    dispatchMode: 'host_capability_adaptive', afterDispatch: 'continue_resource_and_page_work',
    resumeRunning: 'attach_existing_host_task', waitAt: 'own_page_image_binding_and_acceptance',
    waitPolicy: 'own_page_only_after_independent_work',
    timeBudget: { owner: 'host_agent', requestTimeoutMs: 30000, pageDeadlineMs: 180000, startsAt: 'first_search_dispatch', resume: 'keep_original_deadline' },
  });
  expect(scheduling.runAlongside).toEqual(expect.arrayContaining(['page_creation', 'image_page_layout', 'page_data_binding', 'page_interactions']));
  expect(manifest.summary.core_workflows.full_app_build.optional_asset_branch.scheduling_policy).toEqual(scheduling);
  expect(summary.full_app_artifact_route.optional_asset_branch.scheduling_policy).toEqual(scheduling);
  expect(collection).toMatchObject({ maxRoundsPerPage: 2, imagesPerSlot: 1, candidatesPerSlotPerRound: 1, secondRound: 'failed_required_slots_only', roundOwner: 'host_agent' });
  expect(manifest.summary.core_workflows.full_app_build.optional_asset_branch.collection_policy).toEqual(collection);
  expect(summary.full_app_artifact_route.optional_asset_branch.collection_policy).toEqual(collection);
  expect(manifest.commands.find(command => command.id === 'asset').args).toContainEqual(expect.objectContaining({ name: 'pageId', builder_options: ['--page-id'] }));
  const completion = sources.guidance.completionPolicy;
  expect(completion).toMatchObject({ resultSource: 'asset-manifests/<pageId>.json', planApproval: 'reuse_existing_approval', nextStep: 'continue_ready_pages' });
  expect(manifest.summary.core_workflows.full_app_build.optional_asset_branch.completion_policy).toEqual(completion);
  expect(summary.full_app_artifact_route.optional_asset_branch.completion_policy).toEqual(completion);
});

test('Plan CLI preserves workspace navigation while materializing and patching a frontend menu', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-entry-cli-'));
  try {
    const input = path.join(dir, 'build-plan.json');
    const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/design-plan.json'), 'utf8'));
    plan.execution = { appConfig: { navigationType: 'platform-side' } };
    const frontend = JSON.parse(JSON.stringify(plan.pages.customPageDetails[0]));
    frontend.pageId = frontend.sceneKey = 'employee-entry';
    frontend.name = '员工办事入口';
    frontend.pageSpecHandoff = {
      entryMode: 'standalone', navigation: { type: 'custom', variant: 'top', reason: '员工办理个人事项' },
    };
    plan.pages.customPageDetails.push(frontend);
    plan.visualStyle.forUser.pageApplications.push({
      ...plan.visualStyle.forUser.pageApplications[0], pageId: frontend.pageId, pageName: frontend.name,
      firstScreenFocus: '员工自己的待办入口位于顶部，待处理状态紧邻入口名称。',
      layout: '顶部为单层办理入口，下方个人记录占满内容宽度；各区按内容自然增高。',
      responsive: '720px以下入口单列排列，个人记录保持在入口下方，表格允许横向滚动。',
      acceptanceChecks: ['平台导航保持可见，独立入口仅隐藏本页导航；个人待办与记录范围保持一致。'],
    });
    fs.writeFileSync(input, JSON.stringify(plan));
    runOk(['design-plan', 'materialize', input, '--json']);
    const handoff = () => JSON.parse(fs.readFileSync(path.join(dir, 'prd.md'), 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
    expect(handoff().appConfig).toMatchObject({ navigationType: 'platform-side', hideAppNav: 'n' });
    expect(handoff().pageNavigation).toEqual([{ name: frontend.name, type: 'display-page', isRenderNav: false }]);
    expect(handoff().pages[0].pageSpecHandoff.entryMode).toBe('platform-shell');
    const menu = { type: 'none', reason: '单步办理' };
    runOk(['design-plan', 'patch', input, '--set', 'pages.customPageDetails[1].pageSpecHandoff.navigation=' + JSON.stringify(menu), '--materialize', '--json']);
    expect(handoff().pages[1].pageSpecHandoff.navigation).toEqual(menu);
    expect(handoff().appConfig.hideAppNav).toBe('n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Plan CLI and design-file sample work locally without a login', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-plan-cli-'));
  try {
    const input = path.join(dir, 'build-plan.json');
    fs.copyFileSync(path.join(ROOT, 'tests/fixtures/design-plan.json'), input);
    const check = JSON.parse(runOk(['design-plan', 'materialize', input, '--check', '--json']));
    expect(check.checked).toBe(true);
    expect(fs.existsSync(path.join(dir, 'design.md'))).toBe(false);
    runOk(['design-plan', 'materialize', input, '--json']);
    const { readDesignTokens } = require('../lib/app/theme-from-design');
    const { parseDesignDocument } = require('../lib/design/document');
    const contract = require('../yida-skills/skills/yida-design/templates/design-themes/basic-tokens.json');
    const design = fs.readFileSync(path.join(dir, 'design.md'), 'utf8');
    const tokens = readDesignTokens(design);
    const activeTone = parseDesignDocument(design).metadata.themeProfile.navTheme;
    const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'), 'utf8');
    const platformNavigationTokens = new Set([...template.matchAll(/(--pod-(?:nav-|shell-|page-header-)[\w-]+)\s*:/g)]
      .map(match => match[1]));
    expect(Object.keys(tokens)).toEqual(expect.arrayContaining(Object.values(contract.groups).flat()));
    expect(Object.keys(tokens).filter(name => !Object.values(contract.groups).flat().includes(name))
      .every(name => name.startsWith('--oyd-') || platformNavigationTokens.has(name))).toBe(true);
    expect(platformNavigationTokens.has('--pod-nav-unknown-token')).toBe(false);
    for (const [name, value] of Object.entries(contract.fixedValues)) {
      expect(tokens[name]).toBe(value);
    }
    const selectedShadow = 'inset 0 -3px 0 var(--color-brand1-6)';
    const result = JSON.parse(runOk(['design-plan', 'patch', input,
      '--set', 'execution.appConfig.navigationType=custom',
      '--set', 'visualStyle.tokens.--pod-card-border-radius=16px',
      '--set', `visualStyle.tokens.--pod-nav-menu-item-selected-shadow=${selectedShadow}`,
      '--materialize', '--output-dir', dir, '--json']));
    expect(result.changed).toBe(true);
    const cssPath = path.join(dir, 'app-theme.css');
    runOk(['sample', 'yida-design', 'app-theme', '--design-file', path.join(dir, 'design.md'), '--output', cssPath]);
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toContain('--pod-card-border-radius: 16px');
    const patchedDesign = fs.readFileSync(path.join(dir, 'design.md'), 'utf8');
    expect(readDesignTokens(patchedDesign)['--pod-nav-menu-item-selected-shadow']).toBe(selectedShadow);
    expect(patchedDesign).toContain(`| 选中项阴影 | --pod-nav-menu-item-selected-shadow | ${selectedShadow} |`);
    expect(css).toContain(`--pod-nav-menu-item-selected-shadow: ${selectedShadow};`);
    const scope = (source, tone) => source.match(new RegExp(`\\.pod-premium\\.nav-${tone}\\s*\\{([^}]+)\\}`))[1];
    for (const tone of ['light', 'dark', 'white', 'gray']) {
      const background = tone === activeTone ? tokens['--pod-shell-theme-bg-color']
        : scope(template, tone).match(/--pod-shell-theme-bg-color:\s*([^;]+);/)[1];
      const block = scope(css, tone);
      expect(block).toContain(`--pod-shell-theme-bg-color: ${background};`);
      if (tone !== activeTone) {
        const defaults = scope(template, tone);
        const originalNames = new Set([...defaults.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
        const existing = block.replace(/^[ \t]*(--[\w-]+)\s*:[^;]+;\n/gm,
          (line, name) => originalNames.has(name) ? line : '');
        expect(existing).toBe(defaults);
        const rootDefaults = Object.assign({}, ...[...template.matchAll(/^:root\s*\{([^}]+)\}/gm)]
          .map(match => Object.fromEntries([...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
            .map(([, name, value]) => [name, value.trim()]))));
        for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
          if (!originalNames.has(name)) {
            expect(platformNavigationTokens.has(name)).toBe(true);
            expect(value.trim()).toBe(rootDefaults[name]);
          }
        }
      }
    }
  } finally {fs.rmSync(dir, { recursive: true, force: true });}
});


test('form recovery command contracts expose bounded recovery and compatible URLs', () => {
  const manifest = JSON.parse(runOk(['commands', '--json']));
  const batch = manifest.commands.find(item => item.id === 'create-form.batch');
  const resume = manifest.commands.find(item => item.id === 'create-form.resume');
  expect(batch.notes.join(' ')).toContain('rerun_unchanged_plan');
  expect(batch.notes.join(' ')).toContain('inspect_unknown_write_then_reconcile');
  expect(batch.notes.join(' ')).toContain('url remains the compatible form entry');
  expect(resume.notes.join(' ')).toContain('retry missing compatible fields once');
  expect(resume.usage).toContain('create-form resume <appType> <formUuid> <fieldsJsonOrFile> [--json]');
});

test('QwenWork declares Bash background separately from synchronous Agent in both CLI capability formats', () => {
  for (const format of ['--summary-json', '--json']) {
    const result = JSON.parse(runOkWithEnv(['agent-capabilities', format], {
      QWENWORK: '1', OPENYIDA_AGENT_BACKGROUND_AGENT: '0', OPENYIDA_AGENT_BACKGROUND_SHELL: '1',
    }));
    expect(result.asset_capabilities).toMatchObject({
      background_agent: { available: false, source: 'environment_declaration' },
      background_shell: { available: true, source: 'environment_declaration' },
      execution: { selected_mode: 'background_shell', shell: { foregroundWork: expect.arrayContaining(['visual_image_review']) } },
    });
  }
});
