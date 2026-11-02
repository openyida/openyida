'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { COMMAND_GROUPS, buildCommandManifest, flattenCommandManifest } = require('../lib/core/command-manifest');
const { resolveManagedPolicy, validateManagedPolicy } = require('../lib/core/managed-policy');
const { assertManagedInvocation } = require('../lib/agent/managed-run');
const { classifyManagedMutation } = require('../lib/agent/managed-command-map');

const env = {
  OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND',
  OPENYIDA_AGENT_CORP_ID: 'test-corp', OPENYIDA_AGENT_USER_ID: 'test-user',
  OPENYIDA_AGENT_RUN_ID: 'test-run', OPENYIDA_AGENT_ATTEMPT_ID: 'test-attempt',
  OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test', OPENYIDA_AGENT_TASK_GRANT: 'test_' + 'g'.repeat(48),
};
const run = (command, args) => assertManagedInvocation(command, args, { env });

test('every canonical entry exposes a serializable managed policy', () => {
  expect(buildCommandManifest().managed_run_schema.version).toBe(1);
  for (const entry of flattenCommandManifest()) {expect(() => validateManagedPolicy(entry.managedRun, entry.id)).not.toThrow();}
  for (const entry of buildCommandManifest().commands) {
    expect(JSON.parse(JSON.stringify(entry.managed_run))).toEqual(entry.managed_run);
    expect(entry.managed_run.scope).toBeDefined();
  }
});

test.each([
  undefined, {}, { scope: 'unknown' }, { scope: 'denied' },
  { scope: 'app' }, { scope: 'app', appPosition: -1 }, { scope: 'app', appPosition: 0, appParser: 'prd-completeness' },
  { scope: 'actions', actions: {} }, { scope: 'actions', actions: { fake: { scope: 'app' } } },
  { scope: 'local', mutation: { operation: 'write' } },
  { scope: 'local', allowedFlags: ['--json'], requiredFlags: ['--login'] },
  { scope: 'local', unexpected: true },
].map(value => [value]))('invalid or incomplete policy fails validation: %j', value => {
  expect(() => validateManagedPolicy(value, 'future-command')).toThrow(/Invalid managedRun/);
});

test('new command metadata drives guard and receipts without another allow list', () => {
  const entries = COMMAND_GROUPS[0].commands;
  const originalLength = entries.length;
  entries.push({ id: 'future.plan', path: ['future', 'plan'], managedRun: { scope: 'local' } });
  entries.push({ id: 'future.save', path: ['future', 'save'], managedRun: {
    scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 },
  } });
  try {
    expect(run('future', ['plan', 'input.json'])).not.toBeNull();
    expect(run('future', ['save', 'APP_BOUND', 'FORM-new'])).not.toBeNull();
    expect(classifyManagedMutation('future', ['save', 'APP_BOUND', 'FORM-new']))
      .toEqual({ operation: 'update_form', formUuid: 'FORM-new' });
    expect(() => run('future', ['save', 'APP_OTHER', 'FORM-new']))
      .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
    expect(() => run('future', ['delete'])).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
  } finally {entries.splice(originalLength);}
});

test.each(['catalog', 'init', 'preview', 'materialize', 'patch'])('Plan %s is admitted without a cloud mutation receipt', action => {
  expect(run('design-plan', [action, 'test.json'])).toMatchObject({ appType: 'APP_BOUND' });
  expect(classifyManagedMutation('design-plan', [action, 'test.json'])).toBeNull();
});

test.each([
  ['design-plan', ['future-action']], ['auth', ['login']], ['auth', ['status', 'login']],
  ['env', ['switch', 'prod']], ['login', ['--check-only', '--refresh']], ['agent', ['disconnect']],
  ['nav-group', ['unknown', 'APP_BOUND']],
  ['nav-group', ['toString', 'APP_BOUND']], ['auth', ['constructor']],
  ['connector', ['delete', 'any']], ['update', []], ['export', ['APP_BOUND']],
])('identity, unaudited actions and unknown arguments remain blocked: %s %j', (command, args) => {
  expect(() => run(command, args)).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
});

test.each(['--profile=personal', '--endpoint=https://other.test', '--corp-id', '--token=secret'])('Plan cannot override identity using %s', flag => {
  expect(() => run('design-plan', ['catalog', flag])).toThrow(expect.objectContaining({ code: 'MANAGED_OVERRIDE_FORBIDDEN' }));
});

test('scope and mutation receipts consume the same app policy', () => {
  expect(resolveManagedPolicy('create-form', ['update', 'APP_BOUND', 'FORM-x', 'fields.json']).policy)
    .toMatchObject({ scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } });
  expect(classifyManagedMutation('create-form', ['update', 'APP_BOUND', 'FORM-x', 'fields.json']))
    .toEqual({ operation: 'update_form', formUuid: 'FORM-x' });
  expect(() => run('create-form', ['update', 'APP_OTHER', 'FORM-x', 'fields.json']))
    .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
  expect(run('create-form', ['list-icons'])).not.toBeNull();
});

test('native report configuration is app-bound with no dry-run mutation receipt', () => {
  const args = ['configure', 'APP_BOUND', 'REPORT_1', 'cid_1', '--hide-zero-values', 'true', '--json'];
  expect(run('report', args)).toMatchObject({ appType: 'APP_BOUND' });
  expect(classifyManagedMutation('report', args)).toEqual({ operation: 'update_report', formUuid: 'REPORT_1' });
  expect(classifyManagedMutation('report', [...args, '--dry-run'])).toBeNull();
  expect(() => run('report', ['configure', 'APP_OTHER', 'REPORT_1', 'cid_1', '--hide-zero-values', 'true']))
    .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
  expect(() => run('report', [...args, '--corp-id', 'other']))
    .toThrow(expect.objectContaining({ code: 'MANAGED_OVERRIDE_FORBIDDEN' }));
});

test('native form views stay in the bound app and classify only actual mutation actions', () => {
  for (const action of ['list', 'inspect', 'save', 'create', 'order']) {
    expect(run('form-view', [action, 'APP_BOUND', 'FORM-x', 'VIEW-x'])).toMatchObject({ appType: 'APP_BOUND' });
    expect(() => run('form-view', [action, 'APP_OTHER', 'FORM-x'])).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
    expect(classifyManagedMutation('form-view', [action, 'APP_BOUND', 'FORM-x'])).toEqual(
      ['list', 'inspect'].includes(action) ? null : { operation: 'update_form', formUuid: 'FORM-x' }
    );
  }
  expect(() => run('form-view', ['delete', 'APP_BOUND', 'FORM-x'])).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
});

test('native custom buttons stay within the bound app and classify only mutations', () => {
  for (const action of ['list', 'inspect', 'options', 'create', 'update', 'delete']) {
    expect(run('custom-button', [action, 'APP_BOUND', 'FORM-x', 'BUTTON-x'])).toMatchObject({ appType: 'APP_BOUND' });
    expect(() => run('custom-button', [action, 'APP_OTHER', 'FORM-x']))
      .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
    expect(classifyManagedMutation('custom-button', [action, 'APP_BOUND', 'FORM-x'])).toEqual(
      ['list', 'inspect', 'options'].includes(action) ? null : { operation: 'update_form', formUuid: 'FORM-x' }
    );
  }
  expect(() => run('custom-button', ['execute', 'APP_BOUND', 'FORM-x']))
    .toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
});

test('native cards and settings enforce the bound app with app-level mutation receipts', () => {
  for (const action of ['list', 'get', 'probe', 'create', 'save', 'publish', 'release-get', 'release-check', 'refs', 'release-save']) {
    expect(run('data-card', [action, 'APP_BOUND', 'CARD-x'])).toMatchObject({ appType: 'APP_BOUND' });
    expect(() => run('data-card', [action, 'APP_OTHER', 'CARD-x'])).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
    expect(classifyManagedMutation('data-card', [action, 'APP_BOUND', 'CARD-x'])).toEqual(
      ['list', 'get', 'probe', 'release-check', 'refs'].includes(action) ? null : { operation: 'update_app_setting' }
    );
  }
  expect(() => run('data-card', ['release-test', 'APP_BOUND', 'CARD-x', '--allow-send'])).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
  expect(() => run('data-card', ['delete', 'APP_BOUND', 'CARD-x'])).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
  expect(run('app-settings', ['APP_BOUND', '--section', 'theme'])).toMatchObject({ appType: 'APP_BOUND' });
  expect(() => run('app-settings', ['APP_OTHER'])).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
});

test('blocked command diagnostics name its declaration without logging arguments or grants', () => {
  let failure;
  try {run('auth', ['status', 'private-value']);} catch (error) {failure = error;}
  expect(failure.details).toMatchObject({ commandId: 'auth', reason: 'arguments_outside_declared_scope' });
  expect(JSON.stringify(failure)).not.toContain('private-value');
  expect(JSON.stringify(failure)).not.toContain(env.OPENYIDA_AGENT_TASK_GRANT);
});

test('unregistered commands have no executable policy', () => {
  expect(resolveManagedPolicy('not-registered', [])).toBeNull();
});

test('ordinary CLI still bypasses the managed guard', () => {
  expect(assertManagedInvocation('auth', ['login'], { env: {} })).toBeNull();
});

test('real CLI executes managed Plan catalog, initialization and artifact generation offline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-plan-'));
  const cli = path.join(__dirname, '../bin/yida.js');
  const invoke = args => JSON.parse(execFileSync(process.execPath, [cli, 'design-plan', ...args, '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 15000,
    env: { ...process.env, ...env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  }));
  try {
    const themes = invoke(['catalog']);
    expect(themes.themes.length).toBeGreaterThan(0);
    const themeId = themes.themes[0].themeId;
    const brief = path.join(dir, 'brief.json');
    fs.writeFileSync(brief, JSON.stringify({ projectName: 'managed-test', appName: '测试', businessGoals: ['记录'],
      intake: { firstBuild: true, sourceDetail: 'detailed', designMode: 'plan', confirmed: true }, openQuestions: [],
      resourceContext: { app: { appType: 'APP_BOUND' } },
      visualSelection: { themeId }, navigation: { type: 'platform-top', source: 'user_selected' },
      businessObjects: [], pageScenes: [],
    }));
    expect(invoke(['init', brief, '--theme-id', themeId]).output).toBeTruthy();
    const input = path.join(dir, 'complete-plan.json');
    fs.copyFileSync(path.join(__dirname, 'fixtures/design-plan.json'), input);
    const generated = invoke(['materialize', input, '--output-dir', path.join(dir, 'artifacts')]);
    expect(fs.existsSync(generated.outputs.html)).toBe(true);
    expect(fs.existsSync(generated.outputs.prd)).toBe(true);
    expect(invoke(['materialize', input, '--check']).checked).toBe(true);
  } finally {fs.rmSync(dir, { recursive: true, force: true });}
});


test.each([
  ['app-entry', ['get', 'APP_BOUND']],
  ['app-entry', ['set', 'APP_BOUND', 'FORM-entry']],
  ['upgrade-app-theme', ['APP_BOUND', '--explicit-request', '--prepare', '--output-dir', 'theme-preview']],
])('new app commands accept only the bound application: %s %j', (command, args) => {
  expect(run(command, args)).toMatchObject({ appType: 'APP_BOUND' });
  const crossAppArgs = args.map(arg => arg === 'APP_BOUND' ? 'APP_OTHER' : arg);
  expect(() => run(command, crossAppArgs)).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
});

test('theme preparation produces no cloud mutation receipt; app entry writes do', () => {
  expect(classifyManagedMutation('upgrade-app-theme', ['APP_BOUND', '--explicit-request', '--prepare'])).toBeNull();
  expect(classifyManagedMutation('app-entry', ['get', 'APP_BOUND'])).toBeNull();
  expect(classifyManagedMutation('app-entry', ['set', 'APP_BOUND', 'FORM-entry']))
    .toEqual({ operation: 'update_app_entry' });
});


test.each([
  ['create-form', ['resume', 'APP_BOUND', 'FORM-x', 'fields.json']],
  ['get-permission', ['APP_BOUND', 'FORM-x']],
  ['app-theme', ['snapshot', 'APP_BOUND', '--output-dir', 'backup']],
  ['app-theme', ['restore', 'APP_BOUND', '--confirm']],
  ['data', ['query', 'form', 'APP_BOUND', 'FORM-x']],
  ['data', ['create', 'form', 'APP_BOUND', 'FORM-x', 'data.json']],
  ['i18n', ['config', 'set', 'APP_BOUND']],
  ['i18n', ['overview', 'APP_BOUND']],
  ['asset', ['resolve', 'tasks.json', '--app-type', 'APP_BOUND']],
])('audited command binds every application target: %s %j', (command, args) => {
  expect(run(command, args)).toMatchObject({ appType: 'APP_BOUND' });
  expect(() => run(command, args.map(arg => arg === 'APP_BOUND' ? 'APP_OTHER' : arg)))
    .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
});

test('nested unknown actions and duplicate app options remain blocked', () => {
  expect(() => run('data', ['query', 'future', 'APP_BOUND'])).toThrow();
  expect(() => run('i18n', ['config', 'future', 'APP_BOUND'])).toThrow();
  expect(() => run('asset', ['resolve', 'tasks.json', '--app-type', 'APP_BOUND', '--app-type', 'APP_OTHER'])).toThrow();
  expect(() => run('asset', ['resolve', 'tasks.json'])).toThrow();
  expect(run('connector', ['parse-api', 'api.json'])).toBeTruthy();
  expect(classifyManagedMutation('upgrade-app-theme', ['APP_BOUND', '--confirm'])).toEqual({ operation: 'update_app' });
  expect(classifyManagedMutation('app-theme', ['restore', 'APP_BOUND', '--check'])).toBeNull();
  expect(classifyManagedMutation('create-form', ['batch', 'APP_BOUND', 'plan.json', '--check'])).toBeNull();
});


test('column emphasis flags remain local managed generation with no mutation receipt', () => {
  const args = ['generate', '--app', 'APP_BOUND', '--form', 'FORM-DEMO', '--style', 'rose',
    '--base-css', 'before.css', '--output', 'after.css', '--emphasize-field', 'textField_name',
    '--emphasize-field', 'numberField_amount', '--tag-field', 'selectField_status'];
  expect(run('data-manage-style', args)).toMatchObject({ appType: 'APP_BOUND' });
  expect(classifyManagedMutation('data-manage-style', args)).toBeNull();
});

test('data-management authoring guide is a read-only local managed action', () => {
  expect(run('data-manage-style', ['guide', '--json'])).toMatchObject({ appType: 'APP_BOUND' });
  expect(classifyManagedMutation('data-manage-style', ['guide', '--json'])).toBeNull();
  expect(() => run('data-manage-style', ['guide', '--output', 'out.css'])).toThrow();
});


test('managed feedback permits only offline report preparation, with no cloud mutation receipt', () => {
  expect(() => run('feedback', ['report', '--input', 'summary.json', '--output-dir', 'draft'])).not.toThrow();
  expect(classifyManagedMutation('feedback', ['report', '--input', 'summary.json', '--output-dir', 'draft'])).toBeNull();
  for (const action of ['setup', 'url', 'submit', 'github', 'future-action']) {
    expect(() => run('feedback', [action])).toThrow();
  }
});
