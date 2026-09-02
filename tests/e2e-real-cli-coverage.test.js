'use strict';

const { defineTestCases } = require('../scripts/e2e-real/cli-coverage');

describe('real CLI coverage definitions', () => {
  test('aggregate list runs only after an appType exists and validates the JSON array contract', () => {
    const cases = defineTestCases();
    expect(cases.phase1_readonly.find((item) => item.name === 'aggregate-table list')).toBeUndefined();

    const aggregate = cases.phase2_mutating.find((item) => item.name === 'aggregate-table list');
    expect(aggregate.args({})).toBeNull();
    expect(aggregate.args({ appType: 'APP-1' })).toEqual([
      'aggregate-table', 'list', 'APP-1', '--json',
    ]);
    expect(aggregate.validate({ status: 0, stdout: '[]' }).pass).toBe(true);
    expect(aggregate.validate({ status: 0, stdout: '{}' }).pass).toBe(false);
  });
});
