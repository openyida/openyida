'use strict';

jest.mock('../scripts/e2e-real/full-runner', () => ({
  run: jest.fn(async () => ({ skipped: true })),
}));

describe('eval runner', () => {
  test('runE2e waits for async full runner result', async () => {
    const { runE2e } = require('../scripts/eval/runner');

    await expect(runE2e({})).resolves.toEqual({ skipped: true });
  });
});
