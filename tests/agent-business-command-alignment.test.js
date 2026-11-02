'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { assertManagedInvocation } = require('../lib/agent/managed-run');
const { classifyManagedMutation } = require('../lib/agent/managed-command-map');
const { beginManagedMutationCapture } = require('../lib/agent/mutation-receipt');
const { validateManagedPolicy } = require('../lib/core/managed-policy');
const { buildAssetTasks } = require('../lib/asset/asset-plan');

const env = {
  OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND',
  OPENYIDA_AGENT_CORP_ID: 'test-corp', OPENYIDA_AGENT_USER_ID: 'test-user',
  OPENYIDA_AGENT_RUN_ID: 'test-run', OPENYIDA_AGENT_ATTEMPT_ID: 'test-attempt',
  OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test',
  OPENYIDA_AGENT_TASK_GRANT: 'task_' + 'g'.repeat(48),
};
const invoke = (command, args) => assertManagedInvocation(command, args, { env });

const writes = [
  ['data', ['create', 'form', 'APP_BOUND', 'FORM_target'], 'create_form_data'],
  ['data', ['update', 'form', 'APP_BOUND', '--form-uuid', 'FORM_target', '--inst-id', 'FINST_target'], 'update_form_data'],
  ['data', ['delete', 'form', 'APP_BOUND', 'FORM_target', '--inst-id', 'FINST_target', '--confirm'], 'delete_form_data'],
  ['data', ['create', 'process', 'APP_BOUND', 'FORM_target', '--process-code', 'PROC_target'], 'create_form_data'],
  ['data', ['update', 'process', 'APP_BOUND', '--form-uuid', 'FORM_target', '--process-inst-id', 'PINST_target'], 'update_form_data'],
  ['data', ['execute', 'task', 'APP_BOUND', '--form-uuid', 'FORM_target', '--task-id', 'TASK_target'], 'execute_task'],
  ['data', ['transfer', 'task', 'APP_BOUND', '--form-uuid', 'FORM_target', '--process-inst-id', 'PINST_target', '--to-user-id', 'USER_target'], 'execute_task'],
  ['append-chart', ['APP_BOUND', 'REPORT_target', 'charts.json', '--json'], 'update_report'],
];

test.each([
  ['query', 'process', 'APP_BOUND', 'FORM_target'],
  ['get', 'process', 'APP_BOUND', '--process-inst-id', 'PINST_target'],
  ['query', 'operation-records', 'APP_BOUND', '--process-inst-id', 'PINST_target'],
  ['query', 'tasks', 'APP_BOUND', '--type', 'todo'],
  ['query', 'process-tasks', 'APP_BOUND', '--process-inst-id', 'PINST_target'],
])('skill workflow read %j is admitted, app-bound, and creates no mutation', (...args) => {
  expect(invoke('data', args)).toMatchObject({ appType: 'APP_BOUND' });
  expect(classifyManagedMutation('data', args)).toBeNull();
  expect(() => invoke('data', args.map(value => value === 'APP_BOUND' ? 'APP_OTHER' : value)))
    .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
});

test.each(writes)('%s %j emits the host operation %s only after success', (command, args, operation) => {
  expect(invoke(command, args)).toMatchObject({ appType: 'APP_BOUND' });
  expect(() => invoke(command, args.map(value => value === 'APP_BOUND' ? 'APP_OTHER' : value)))
    .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
  expect(() => invoke(command, [...args, '--base-url', 'https://other.example.test']))
    .toThrow(expect.objectContaining({ code: 'MANAGED_OVERRIDE_FORBIDDEN' }));
  const consoleObject = { log() {} };
  const capture = beginManagedMutationCapture({ command, args, env, consoleObject, eventId: 'business-write' });
  consoleObject.log(JSON.stringify(command === 'append-chart'
    ? { success: true, reportId: 'REPORT_target', readbackVerified: true }
    : { success: true, result: 'INSTANCE_target' }));
  expect(capture.commit()).toMatchObject({ operation, status: 'succeeded', appType: 'APP_BOUND',
    formUuid: command === 'append-chart' ? 'REPORT_target' : 'FORM_target' });
  if (command === 'append-chart') {
    expect(classifyManagedMutation(command, args)).toEqual({ operation: 'update_report', formUuid: 'REPORT_target' });
  }
  const failed = beginManagedMutationCapture({ command, args, env, consoleObject, eventId: 'failed-write' });
  consoleObject.log(JSON.stringify({ success: false }));
  expect(failed.commit()).toBeNull();
});

test('named form target metadata is strict and never guesses missing or duplicate options', () => {
  for (const args of [
    ['update', 'form', 'APP_BOUND', '--inst-id', 'FINST_target'],
    ['update', 'form', 'APP_BOUND', '--form-uuid', '--json'],
    ['update', 'form', 'APP_BOUND', '--form-uuid', 'FORM_one', '--form-uuid', 'FORM_two'],
  ]) {
    expect(classifyManagedMutation('data', args)).toMatchObject({ operation: 'update_form_data' });
    expect(classifyManagedMutation('data', args).formUuid).toBeUndefined();
  }
  for (const mutation of [
    { operation: 'update_form_data', formUuidOption: 'form-uuid' },
    { operation: 'update_form_data', formUuidOption: '--form-uuid', formUuidPosition: 3 },
    { operation: 'update_form_data', formUuidOption: 123 },
  ]) {
    expect(() => validateManagedPolicy({ scope: 'app', appPosition: 2, mutation })).toThrow();
  }
});

test('undeclared workflow actions stay blocked and ordinary CLI remains unrestricted', () => {
  for (const args of [['delete', 'process', 'APP_BOUND'], ['query', 'future', 'APP_BOUND'], ['execute', 'future', 'APP_BOUND'], ['transfer', 'future', 'APP_BOUND']]) {
    expect(() => invoke('data', args)).toThrow(expect.objectContaining({ code: 'MANAGED_COMMAND_UNSUPPORTED' }));
    expect(assertManagedInvocation('data', args, { env: {} })).toBeNull();
  }
});

test('materialize CLI returns asset argv that can directly pass the managed guard', () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'managed-plan-assets-')));
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
    const pageId = plan.pages.customPageDetails[0].pageId;
    const strategy = { pages: [{ pageId, imageNeed: 'required', slots: [
      { slotId: 'hero', usage: 'hero', minSize: '1200x800' },
    ] }] };
    plan.visualStyle.forUser.assetStrategy = strategy;
    const input = path.join(dir, 'plan.json');
    fs.writeFileSync(input, JSON.stringify(plan));
    const output = execFileSync(process.execPath,
      [path.join(__dirname, '../bin/yida.js'), 'design-plan', 'materialize', input, '--json'],
      { env: { ...process.env, ...env, OPENYIDA_SKIP_UPDATE_CHECK: '1' }, encoding: 'utf8' });
    const task = JSON.parse(output).assetTasks[0];
    expect(task.resolve.appTypeRequired).toBe(true);
    expect(task.resolve.uploadArgs).toEqual([]);
    const [command, ...args] = task.resolve.argv;
    expect(args.filter(value => value === '--app-type')).toHaveLength(1);
    expect(invoke(command, args)).toMatchObject({ appType: 'APP_BOUND' });
    expect(() => invoke(command, args.map(value => value === 'APP_BOUND' ? 'APP_OTHER' : value)))
      .toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
    const ordinary = buildAssetTasks(strategy, dir, { env: {} })[0];
    expect(ordinary.resolve.appTypeRequired).toBe(false);
    expect(ordinary.resolve.argv).not.toContain('--app-type');
    expect(ordinary.resolve.uploadArgs).toEqual(['--app-type', '<appType>']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
