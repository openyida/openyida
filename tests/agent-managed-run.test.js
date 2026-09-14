'use strict';

const { assertManagedInvocation } = require('../lib/agent/managed-run');
const { readManagedContext } = require('../lib/agent/managed-context');
const { tokenStatus, tokenRefresh } = require('../lib/auth/token-auth');
const { resolveBearerAuthHeaders, loadAuthData } = require('../lib/core/utils');
const { isAutoUpdateDisabled } = require('../lib/core/update');

function context() {
  return {
    OPENYIDA_MANAGED_RUN: '1',
    OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND', OPENYIDA_AGENT_CORP_ID: 'corp-a', OPENYIDA_AGENT_USER_ID: 'user-a',
    OPENYIDA_AGENT_RUN_ID: 'run-a', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt-a',
    OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test', OPENYIDA_AGENT_TASK_GRANT: 'task_' + 'g'.repeat(48),
  };
}

describe('managed task-grant preflight', () => {
  test('ordinary CLI is not a managed run', () => {
    expect(readManagedContext({ OPENYIDA_MANAGED_RUNTIME: 'local' })).toBeNull();
    expect(assertManagedInvocation('create-app', ['name'], { env: {} })).toBeNull();
  });

  test.each([
    'OPENYIDA_AGENT_APP_TYPE', 'OPENYIDA_AGENT_CORP_ID', 'OPENYIDA_AGENT_USER_ID',
    'OPENYIDA_AGENT_RUN_ID', 'OPENYIDA_AGENT_ATTEMPT_ID', 'OPENYIDA_AGENT_BASE_URL', 'OPENYIDA_AGENT_TASK_GRANT',
  ])('fails closed with missing %s', key => {
    const env = context();
    delete env[key];
    expect(() => readManagedContext(env)).toThrow(expect.objectContaining({ code: 'MANAGED_CONTEXT_INVALID' }));
  });

  test.each([
    ['get-schema', ['APP_BOUND', 'FORM-a']], ['list-forms', ['APP_BOUND']],
    ['create-form', ['create', 'APP_BOUND', 'Title', 'fields.json']], ['create-form', ['batch', 'APP_BOUND', 'plan.json']],
    ['create-page', ['APP_BOUND', 'Title']], ['publish', ['src.js', 'APP_BOUND', 'FORM-a']],
    ['create-process', ['APP_BOUND', '采购审批']], ['create-report', ['APP_BOUND', '经营看板']],
    ['nav-group', ['list', 'APP_BOUND']], ['nav-group', ['move', 'APP_BOUND', 'FORM-a', '--to', 'NAV-a']],
    ['app-permission', ['get', 'APP_BOUND']], ['app-permission', ['add', 'APP_BOUND', 'dev']],
    ['ai-form-setting', ['get', 'APP_BOUND', 'FORM-a']], ['aggregate-table', ['list', 'APP_BOUND']],
    ['auth', ['status', '--json']], ['env', ['--json']], ['agent-capabilities', ['--json']],
    ['login', ['--check-only']], ['login', ['--check-only', '--json', '--quiet']],
  ])('accepts audited %s invocation', (command, args) => {
    expect(assertManagedInvocation(command, args, { env: context() })).toMatchObject({ appType: 'APP_BOUND', runId: 'run-a' });
  });

  test.each(['create-app', 'logout', 'org', 'agent', 'batch', 'import', 'connector', 'unknown-future-command', 'design-plan'])('rejects unsupported command %s', command => {
    expect(() => assertManagedInvocation(command, ['anything'], { env: context() })).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
  });

  test.each(['--env=other', '--intl', '--profile', '--endpoint=https://other.test', '--app-type', '--access-token'])('rejects override %s', flag => {
    expect(() => assertManagedInvocation('get-schema', ['APP_BOUND', 'FORM-a', flag], { env: context() })).toThrow(expect.objectContaining({ code: 'MANAGED_OVERRIDE_FORBIDDEN' }));
  });

  test('rejects mismatched application and ambiguous publish ordering', () => {
    expect(() => assertManagedInvocation('get-schema', ['APP_OTHER', 'FORM-a'], { env: context() })).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
    expect(() => assertManagedInvocation('publish', ['APP_OTHER', 'APP_BOUND', 'src.js'], { env: context() })).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
  });

  test('business HTTP uses only the task grant', async () => {
    const env = { ...context(), OPENYIDA_AGENT_FORM_UUID: 'FORM-A' };
    await expect(resolveBearerAuthHeaders({ env })).resolves.toEqual({ tokenAuth: true, headers: {
      Authorization: `Bearer ${env.OPENYIDA_AGENT_TASK_GRANT}`,
      'X-OpenYida-Local-Run-Id': 'run-a',
      'X-OpenYida-Local-Attempt-Id': 'attempt-a',
      'X-OpenYida-Local-App-Type': 'APP_BOUND',
    } });
    const original = process.env;
    process.env = { ...original, ...env };
    try {
      expect(loadAuthData()).toMatchObject({ auth_source: 'task_grant', base_url: env.OPENYIDA_AGENT_BASE_URL, corp_id: 'corp-a', user_id: 'user-a' });
    } finally {process.env = original;}
  });

  test('status is redacted and task grants cannot refresh', async () => {
    const status = tokenStatus({ env: context() });
    expect(status).toMatchObject({ ok: true, auth_source: 'task_grant', auth_store: 'runtime_memory', persistence_scope: 'attempt' });
    expect(JSON.stringify(status)).not.toContain(context().OPENYIDA_AGENT_TASK_GRANT);
    await expect(tokenRefresh({ env: context() })).rejects.toThrow();
  });

  test('managed updates are disabled', () => {
    expect(isAutoUpdateDisabled(context())).toBe(true);
  });
});
