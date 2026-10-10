'use strict';
const { buildCommandManifest } = require('../lib/core/command-manifest');
const commands = buildCommandManifest({ t: key => key, version: null }).commands;
const entry = id => commands.find(command => command.id === id);

test('materialize explicitly declares local inputs and does not permit unknown-outcome replay', () => {
  expect(entry('design-plan.materialize').result_reuse).toEqual({
    mode: 'local_input_dependent', inputs: ['buildPlan', 'businessFile', 'visualFile', 'preview'],
    onInputChange: 'rerun_after_known_success', writes: 'local_artifacts_only',
  });
});
test('process publication is not idempotent even with replace', () => {
  const contract = entry('configure-process').result_reuse;
  expect(contract.mode).toBe('non_replayable_write');
  expect(contract.onInputChange).toBe('read_back_and_confirm_new_update');
  expect(contract.reason).toContain('--replace is not an idempotency key');
});
test('report inspect revalidates live server data after an observed mutation', () => {
  expect(entry('report.inspect').result_reuse).toMatchObject({
    mode: 'read_only', invalidateAfter: 'observed_remote_mutation',
  });
  expect(entry('create-report').result_reuse).toBeUndefined();
});
