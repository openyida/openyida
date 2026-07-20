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
    OPENYIDA_AGENT_MODE: '',
    OPENYIDA_ASSUME_DESKTOP: '',
    OPENYIDA_FORCE_TERMINAL_QR: '',
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
    expect(output).toContain('login [target-url] [--env <name>|--intl|--overseas|--global|--yidaapps|--alibaba] [--client-id <clientId>] [--endpoint <url>]');
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

  test('er --help renders usage without requiring login', () => {
    const result = runAny(['er', '--help']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('openyida er');
    expect(result.output).not.toContain('读取登录态');
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
    expect(parsed.summary).toMatchObject({
      command_count: parsed.commands.length,
      group_count: parsed.groups.length,
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
      'connector.delete',
      'connector.delete-action',
    ]);
    expect(parsed.summary.core_workflows.full_app_fast_build).toMatchObject({
      mode: 'fast_build',
      default_page_skill_id: 'yida-canvas-custom-page',
      ordinary_jsx_skill_id: 'yida-custom-page',
      required_command_ids: expect.arrayContaining([
        'agent-capabilities',
        'create-app',
        'create-form.create',
        'create-page',
        'publish',
      ]),
      do_not_default_skill_ids: expect.arrayContaining([
        'yida-page-uiux',
        'yida-data-source-connectors',
        'yida-data-management',
        'yida-nav-group',
      ]),
      recommended_read_commands: expect.arrayContaining([
        expect.stringContaining('--summary-json'),
      ]),
      default_data_contract: expect.stringContaining('this.dataSourceMap'),
    });
    expect(commands).toContain('env');
    expect(commands).not.toContain('env-management');
    expect(commands).toContain('login');
    expect(commands).toContain('org');
    expect(commands).toContain('corp-efficiency');
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
    expect(commandById['generate-page'].side_effect).toMatchObject({
      kind: 'local_write',
      mutates_yida: false,
      mutates_local: true,
    });
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
          full_app_fast_build: {
            required_command_ids: ['agent-capabilities'],
            mode: 'fast_build',
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
          full_app_fast_build: {
            mode: 'fast_build',
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
    expect(parsed.commands.allow_command_ids).toContain('create-app');
    expect(parsed.commands.ask_command_ids).toEqual([
      'connector.delete',
      'connector.delete-action',
    ]);
    expect(parsed.commands.read_only_command_ids).toContain('agent-capabilities');
    expect(parsed.commands.core_workflows.full_app_fast_build).toMatchObject({
      mode: 'fast_build',
      default_page_skill_id: 'yida-canvas-custom-page',
      ordinary_jsx_skill_id: 'yida-custom-page',
      required_command_ids: expect.arrayContaining([
        'create-app',
        'create-form.create',
        'create-page',
        'publish',
      ]),
      do_not_default_skill_ids: expect.arrayContaining([
        'yida-page-uiux',
        'yida-data-source-connectors',
        'yida-data-management',
        'yida-nav-group',
      ]),
      recommended_read_commands: expect.arrayContaining([
        expect.stringContaining('--summary-json'),
      ]),
      default_data_contract: expect.stringContaining('this.dataSourceMap'),
    });
    expect(parsed.recommended.default_full_app_workflow).toMatchObject({
      mode: 'fast_build',
      completion_contract: expect.stringContaining('Create app'),
    });
    expect(parsed.recommended.preflight_command).toBe('openyida agent-capabilities --summary-json');
    expect(parsed.recommended.full_capabilities_command).toBe('openyida agent-capabilities --json');
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
    expect(parsed.command_manifest.summary.command_count).toBe(parsed.command_manifest.commands.length);
    expect(parsed.login).toHaveProperty('status');
    expect(parsed.login).not.toHaveProperty('cookies');
    expect(parsed.login).not.toHaveProperty('csrf_token');
    expect(parsed.sideEffects.read_only_preflight).toContain('openyida agent-capabilities --summary-json');
    expect(parsed.sideEffects.read_only_preflight).not.toContain('openyida agent-capabilities --json');
    expect(parsed.sideEffects.completion_contracts.full_app).toContain('creating the app');
    expect(parsed.sideEffects.fast_build_data_contract).toContain('this.dataSourceMap');
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
    expect(commandById['generate-page'].side_effect).toMatchObject({
      kind: 'local_write',
      mutates_yida: false,
      mutates_local: true,
    });
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
      read_actions: ['status'],
      mutating_actions: ['login', 'refresh', 'logout'],
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
    expect(JSON.parse(result.output)).toMatchObject({
      success: false,
      errorCode: 'INVALID_ARGUMENTS',
      errorMsg: expect.stringContaining('未知命令'),
    });
  });

  test('publish keeps source-first CLI order through the router', () => {
    const sourceFile = 'pages/src/missing-publish-source.oyd.jsx';
    const result = runAny(['publish', sourceFile, 'APP_XXX', 'FORM-XXX', '--no-open']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('missing-publish-source.oyd.jsx');
    expect(result.output).not.toContain(path.join(ROOT, 'FORM-XXX'));
  });
});
