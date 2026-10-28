'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertIndependentLocalAgent, parseArgs, execute } = require('../lib/solution-template/solution-template');

const cli = path.resolve(__dirname, '../bin/yida.js');
const binding = JSON.stringify({
  kind: 'openyida_app_context', version: 1, source: 'yida_agent_bound_app',
  sessionId: 'template-session', appType: 'APP_BOUND', allowCreateApp: false,
});
const managedEnv = {
  OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND',
  OPENYIDA_AGENT_CORP_ID: 'corp', OPENYIDA_AGENT_USER_ID: 'user',
  OPENYIDA_AGENT_RUN_ID: 'run', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt',
  OPENYIDA_AGENT_BASE_URL: 'https://tenant.example.test', OPENYIDA_AGENT_TASK_GRANT: 'g'.repeat(48),
};
const cases = [
  ['search', '--query', '合同'], ['detail', 'TPL_TEST'],
  ['prepare', 'TPL_TEST', '--name', '合同管理'], ['ai-build', 'TPL_TEST'],
  ['enable', 'TPL_TEST', '--name', '合同管理'], ['status', 'st-12345678'],
];
let root;
let originalEnv;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'template-runtime-'));
  originalEnv = process.env;
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

function check(env, platform = 'linux') {
  return assertIndependentLocalAgent({ env, platform, cwd: root, projectRoot: root });
}

function invoke(args, extraEnv = {}, target = cli) {
  return spawnSync(process.execPath, [target, ...args], {
    cwd: root, encoding: 'utf8', timeout: 15000,
    env: {
      PATH: originalEnv.PATH || '', SystemRoot: originalEnv.SystemRoot || '',
      OPENYIDA_SKIP_UPDATE_CHECK: '1', OPENYIDA_LANG: 'en',
      OPENYIDA_AUTH_DIR: path.join(root, 'auth'), ...extraEnv,
    },
  });
}

test.each([
  [{ CODEX_THREAD_ID: 'local-task' }, 'linux'],
  [{ CLAUDE_CODE: '1' }, 'linux'],
  [{ OPENCODE_CLIENT: 'cli' }, 'linux'],
  [{ CURSOR_TRACE_ID: 'local-task' }, 'win32'],
  [{ QODER_IDE: '1' }, 'linux'],
  [{ QODER_WORK_INTEGRATION_PRODUCT: 'qwenwork' }, 'darwin'],
  [{ __CFBundleIdentifier: 'com.qoder.work' }, 'darwin'],
])('recognizes an independent local agent without requiring a desktop: %j on %s', (env, platform) => {
  expect(() => check(env, platform)).not.toThrow();
});

test.each([
  { OPENYIDA_APP_CONTEXT_JSON: binding, CODEX_THREAD_ID: 'inherited-local-signal' },
  { OPENYIDA_APP_CONTEXT_JSON: '{invalid', CLAUDE_CODE: '1' },
  { OPENYIDA_APP_CONTEXT_JSON: '', CLAUDE_CODE: '1' },
  { OPENYIDA_MANAGED_RUN: '1', CODEX_THREAD_ID: 'local-task' },
  { QWENWORK_SANDBOX_ID: 'web', CODEX_HOME: '/inherited/codex' },
  { MULERUN_CHAT_ID: 'hosted-task' },
  { OPENYIDA_AUTH_MODE: 'token', OPENYIDA_REFRESH_TOKEN: 'not-a-real-token' },
  {},
])('cloud/bound/managed/unknown context is rejected before work: %j', env => {
  expect(() => check(env)).toThrow(expect.objectContaining({
    code: 'SOLUTION_TEMPLATE_LOCAL_AGENT_REQUIRED',
    details: expect.objectContaining({ mutationPerformed: false, sideEffectState: 'not_started' }),
  }));
});

test('a desktop hint or platform alone is not proof of an independent agent', () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    expect(() => check({ OPENYIDA_ASSUME_DESKTOP: '1' }, platform)).toThrow();
  }
});

test.each(['.cache/openyida/app-context.json', 'project/.cache/openyida/app-context.json',
  '.resources/template-reference.md', 'project/.resources/template-reference.md'])(
  'persisted cloud context cannot become a local workflow when environment variables are missing: %s', file => {
    const filename = path.join(root, file);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, file.endsWith('.md') ? '# Server template PRD' : binding);
    expect(() => check({ CLAUDE_CODE: '1' })).toThrow(expect.objectContaining({
      details: expect.objectContaining({ reason: 'bound_workspace' }),
    }));
    expect(fs.readFileSync(filename, 'utf8')).toBe(file.endsWith('.md') ? '# Server template PRD' : binding);
  });

test('unreadable context checks fail closed', () => {
  const existsSync = fs.existsSync;
  jest.spyOn(fs, 'existsSync').mockImplementation(file => {
    if (String(file).startsWith(root)) { throw new Error('EACCES'); }
    return existsSync(file);
  });
  expect(() => check({ CLAUDE_CODE: '1' })).toThrow(expect.objectContaining({
    details: expect.objectContaining({ reason: 'workspace_context_unreadable' }),
  }));
});

test.each(cases)('direct module %s refuses cloud execution without API or receipt activity', async (...args) => {
  process.env = { ...originalEnv, OPENYIDA_APP_CONTEXT_JSON: binding };
  const client = { getAuthRef: jest.fn(), get: jest.fn(), postFormOnce: jest.fn() };
  await expect(execute(parseArgs(args), { root, client })).rejects.toMatchObject({
    code: 'SOLUTION_TEMPLATE_LOCAL_AGENT_REQUIRED', details: { reason: 'cloud_bound_context' },
  });
  expect(client.getAuthRef).not.toHaveBeenCalled();
  expect(client.get).not.toHaveBeenCalled();
  expect(client.postFormOnce).not.toHaveBeenCalled();
  expect(fs.readdirSync(root)).toEqual([]);
});

test('runtime rejection precedes auth creation even without an injected client', async () => {
  process.env = { OPENYIDA_APP_CONTEXT_JSON: binding };
  await expect(execute(parseArgs(['ai-build', 'TPL_TEST']), { root }))
    .rejects.toMatchObject({ code: 'SOLUTION_TEMPLATE_LOCAL_AGENT_REQUIRED' });
  expect(fs.readdirSync(root)).toEqual([]);
});

test.each(cases)('real CLI %s rejects cloud commands before global flags, auth and local writes', (...args) => {
  const result = invoke(['solution-template', ...args, '--json', '--corp-id', 'different-corp'], {
    OPENYIDA_APP_CONTEXT_JSON: binding, CLAUDE_CODE: '1',
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(JSON.parse(result.stderr)).toMatchObject({
    errorCode: 'SOLUTION_TEMPLATE_LOCAL_AGENT_REQUIRED', mutationPerformed: false,
    details: { reason: 'cloud_bound_context' },
  });
  expect(fs.readdirSync(root)).toEqual([]);
});

test('real CLI blocks unknown and managed local execution without a bypass flag', () => {
  for (const [env, errorCode] of [
    [{}, 'SOLUTION_TEMPLATE_LOCAL_AGENT_REQUIRED'],
    [managedEnv, 'MANAGED_COMMAND_UNSUPPORTED'],
    [{ OPENYIDA_MANAGED_RUN: '1' }, 'MANAGED_CONTEXT_INVALID'],
  ]) {
    const result = invoke(['solution-template', 'search', '--json'], env);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr).errorCode).toBe(errorCode);
  }
  const help = invoke(['solution-template', '--help', '--json'], managedEnv);
  expect(help.status).toBe(0);
  expect(JSON.parse(help.stdout).commands[0].id).toBe('solution-template');
  expect(() => parseArgs(['search', '--allow-cloud'])).toThrow();
});

test('cloud help and unrelated CLI discovery remain available', () => {
  const env = { OPENYIDA_APP_CONTEXT_JSON: binding };
  const help = invoke(['solution-template', '--help'], env);
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('independent local agents');
  const discovery = invoke(['commands', '--json'], env);
  expect(discovery.status).toBe(0);
  const ids = JSON.parse(discovery.stdout).commands.map(item => item.id);
  for (const id of ['create-app', 'create-form.create', 'publish']) { expect(ids).toContain(id); }
  const version = invoke(['--version'], env);
  expect(version.status).toBe(0);
  expect(version.stdout.trim()).toBe(require('../package.json').version);
});

test('compatibility runner cannot bypass the module-level cloud check', () => {
  const result = invoke(['ai-build', 'TPL_TEST', '--json'], { OPENYIDA_APP_CONTEXT_JSON: binding },
    path.resolve(__dirname, '../scripts/solution-center-runner.js'));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('independent local agent');
  expect(fs.readdirSync(root)).toEqual([]);
});
