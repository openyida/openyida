'use strict';

const { beginManagedMutationCapture, classifyManagedMutation } = require('../lib/agent/mutation-receipt');
const { assertManagedInvocation } = require('../lib/agent/managed-run');

const managedEnvironment = () => ({
  OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_X',
  OPENYIDA_AGENT_CORP_ID: 'corp', OPENYIDA_AGENT_USER_ID: 'user',
  OPENYIDA_AGENT_RUN_ID: 'run', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt',
  OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test',
  OPENYIDA_AGENT_TASK_GRANT: 'task_' + 'g'.repeat(48),
});

describe('managed mutation receipt', () => {
  test.each([
    ['create-form', ['create', 'APP_X', '客户'], 'create_form'],
    ['create-form', ['rule', 'APP_X', 'FORM_RULE', 'rules.json'], 'update_form'],
    ['create-form', ['validation', 'APP_X', 'FORM_VALIDATION', 'rules.json'], 'update_form'],
    ['create-form', ['bind-datasource', 'APP_X', 'FORM_DATA', '客户', 'source.json'], 'update_form'],
    ['create-form', ['add-option', 'APP_X', 'FORM_OPTION', '级别', 'P0'], 'update_form'],
    ['create-page', ['APP_X', '首页'], 'create_page'],
    ['create-process', ['APP_X', '采购审批'], 'create_process'],
    ['create-report', ['APP_X', '经营看板'], 'create_report'],
    ['publish', ['page.jsx', 'APP_X', 'FORM_X'], 'publish_page'],
    ['update-form-config', ['APP_X', 'FORM_X', 'true', '客户'], 'update_form_config'],
    ['nav-group', ['move', 'APP_X', 'FORM_X', '--to', 'NAV_X'], 'update_nav'],
    ['app-permission', ['add', 'APP_X', 'dev'], 'update_app_permission'],
    ['save-permission', ['APP_X', 'FORM_X'], 'update_form_permission'],
    ['save-share-config', ['APP_X', 'FORM_X'], 'update_share_config'],
    ['nav-group', ['list', 'APP_X'], null],
    ['get-page-config', ['APP_X', 'FORM_X'], null],
    ['verify-short-url', ['APP_X', 'FORM_X', '/s/local-e2e'], null],
    ['report', ['inspect', 'APP_X', 'REPORT_X', '--json'], null],
    ['create-form', ['validate-fields', 'fields.json'], null],
  ])('%s %j maps only known writes', (command, args, operation) => {
    expect(classifyManagedMutation(command, args)?.operation || null).toBe(operation);
    if (operation) {
      expect(() => assertManagedInvocation(command, args, { env: managedEnvironment() })).not.toThrow();
    }
  });

  test('mixed read/write command families classify only actual mutations', () => {
    expect(() => assertManagedInvocation('report', ['inspect', 'APP_X', 'REPORT_X', '--json'],
      { env: managedEnvironment() })).not.toThrow();
    expect(() => assertManagedInvocation('report', ['inspect', 'APP_OTHER', 'REPORT_X', '--json'],
      { env: managedEnvironment() })).toThrow();
    expect(() => assertManagedInvocation('report', ['unknown-action', 'APP_X', 'REPORT_X'],
      { env: managedEnvironment() })).toThrow();
    expect(classifyManagedMutation('app-permission', ['get', 'APP_X'])).toBeNull();
    expect(classifyManagedMutation('app-permission', ['search-user', '张三'])).toBeNull();
    expect(classifyManagedMutation('i18n', ['overview', 'APP_X'])).toBeNull();
    expect(classifyManagedMutation('i18n', ['config', 'get', 'APP_X'])).toBeNull();
    expect(classifyManagedMutation('i18n', ['translate', 'APP_X'])).toBeNull();
    expect(classifyManagedMutation('i18n', ['config', 'set', 'APP_X'])).toBeNull();
    expect(classifyManagedMutation('i18n', ['translate-all', 'APP_X'])).toBeNull();
    expect(classifyManagedMutation('create-page', ['--help'])).toBeNull();
    expect(classifyManagedMutation('data', ['create', 'process', 'APP_X', 'FORM_X'])).toBeNull();
  });

  test.each(['get-page-config', 'verify-short-url'])('%s allows only the bound application without a receipt', command => {
    const args = ['APP_X', 'FORM_X', '/s/local-e2e'];
    expect(() => assertManagedInvocation(command, args, { env: managedEnvironment() })).not.toThrow();
    expect(() => assertManagedInvocation(command, ['APP_OTHER', ...args.slice(1)],
      { env: managedEnvironment() })).toThrow();
    const fakeConsole = { log() {} };
    const capture = beginManagedMutationCapture({ command, args, env: managedEnvironment(),
      consoleObject: fakeConsole, eventId: 'read-one' });
    fakeConsole.log(JSON.stringify({ success: true, formUuid: 'FORM_X' }));
    expect(capture.commit()).toBeNull();
  });

  test.each(['update', 'patch', 'rule', 'validation', 'bind-datasource', 'add-option'])(
    'create-form %s keeps the positional formUuid for a targeted host refresh',
    (action) => {
      expect(classifyManagedMutation('create-form', [action, 'APP_X', 'FORM_TARGET', 'input.json']))
        .toMatchObject({ operation: 'update_form', formUuid: 'FORM_TARGET' });
    }
  );

  test('reports only explicit successful business results without refresh policy or secrets', () => {
    const fakeConsole = { log: jest.fn() };
    const capture = beginManagedMutationCapture({ command: 'create-page', args: ['APP_X', 'Page'],
      env: managedEnvironment(), consoleObject: fakeConsole, eventId: 'command-one' });
    fakeConsole.log(JSON.stringify({ success: true, pageId: 'FORM_X', token: 'secret' }));
    expect(capture.commit()).toEqual({ schemaVersion: 'openyida.mutation.v1', eventId: 'command-one',
      source: 'openyida-cli', operation: 'create_page', status: 'succeeded', appType: 'APP_X', formUuid: 'FORM_X' });
    expect(fakeConsole.log).not.toBeUndefined();
  });

  test.each(['', '{"success":false}', 'ordinary output'])('no success inferred from process exit: %s', text => {
    const fakeConsole = { log() {} };
    const capture = beginManagedMutationCapture({ command: 'create-page', args: ['APP_X'],
      env: managedEnvironment(), consoleObject: fakeConsole, eventId: 'command-one' });
    fakeConsole.log(text);
    expect(capture.commit()).toBeNull();
  });

  test('uses the actual report command result for targeted report refresh', () => {
    const fakeConsole = { log: jest.fn() };
    const capture = beginManagedMutationCapture({ command: 'create-report', args: ['APP_X', '记录统计'],
      env: managedEnvironment(), consoleObject: fakeConsole, eventId: 'report-one' });
    fakeConsole.log(JSON.stringify({ success: true, reportId: 'REPORT_X', reportTitle: '记录统计',
      readbackVerified: true, runtimeQueryVerified: true, token: 'secret' }));
    expect(capture.commit()).toEqual({ schemaVersion: 'openyida.mutation.v1', eventId: 'report-one',
      source: 'openyida-cli', operation: 'create_report', status: 'succeeded', appType: 'APP_X',
      formUuid: 'REPORT_X', pageType: 'report', formName: '记录统计' });
  });

  test.each(['create-page', 'create-report'])('never uses an unsafe or unrelated report target: %s', command => {
    const fakeConsole = { log() {} };
    const capture = beginManagedMutationCapture({ command, args: ['APP_X'], env: managedEnvironment(),
      consoleObject: fakeConsole, eventId: 'report-one' });
    fakeConsole.log(JSON.stringify({ success: true, reportId: command === 'create-report' ? '../outside' : 'REPORT_OTHER' }));
    expect(capture.commit()).not.toHaveProperty('formUuid');
  });

  test('does not infer report metadata for aggregate-table writes sharing an operation', () => {
    const fakeConsole = { log() {} };
    const capture = beginManagedMutationCapture({ command: 'aggregate-table', args: ['save', 'APP_X'],
      env: managedEnvironment(), consoleObject: fakeConsole, eventId: 'aggregate-one' });
    fakeConsole.log(JSON.stringify({ success: true, reportId: 'REPORT_OTHER', reportTitle: 'Other' }));
    expect(capture.commit()).toEqual({ schemaVersion: 'openyida.mutation.v1', eventId: 'aggregate-one',
      source: 'openyida-cli', operation: 'create_report', status: 'succeeded', appType: 'APP_X' });
  });
});
