'use strict';

const {
  createServerRevisionConflict,
  getSchemaServerRevision,
  isSaveFormSchemaRevisionConflict,
  isServerRevisionConflict,
  requireSchemaServerRevision,
} = require('../lib/schema/server-revision');

describe('saveFormSchema server revision contract', () => {
  test.each([
    [{ content: { gmtModified: 0 } }, 0],
    [{ content: JSON.stringify({ gmtModified: 100 }) }, 100],
    [{ gmtModified: 1.5 }, 1.5],
  ])('accepts a finite non-negative revision', (input, expected) => {
    expect(getSchemaServerRevision(input)).toBe(expected);
    expect(requireSchemaServerRevision(input)).toBe(expected);
  });

  test.each([
    undefined,
    null,
    {},
    { content: {} },
    { content: { gmtModified: -1 } },
    { content: { gmtModified: Infinity } },
    { content: { gmtModified: '100' } },
    { content: '{bad json' },
  ])('rejects a missing or invalid revision', (input) => {
    expect(getSchemaServerRevision(input)).toBeUndefined();
    expect(() => requireSchemaServerRevision(input)).toThrow(expect.objectContaining({
      code: 'SCHEMA_REMOTE_READ_FAILED',
    }));
  });

  test('recognizes only the confirmed structured stale response', () => {
    expect(isSaveFormSchemaRevisionConflict({
      success: false,
      errorCode: '500',
      errorMsg: '页面已变更，请更新后再修改并重新保存',
    })).toBe(true);
    expect(isSaveFormSchemaRevisionConflict({
      success: false,
      errorCode: '500',
      errorMsg: 'generic failure',
    })).toBe(false);
    expect(isSaveFormSchemaRevisionConflict({
      success: false,
      errorCode: '404',
      errorMsg: '页面已变更，请更新后再修改并重新保存',
    })).toBe(false);
  });

  test('keeps deterministic conflict provenance private to the controlled factory', () => {
    const branded = createServerRevisionConflict('page');
    const forged = Object.assign(new Error('forged'), { code: 'SCHEMA_APPLY_JIT_CONFLICT' });
    expect(isServerRevisionConflict(branded)).toBe(true);
    expect(isServerRevisionConflict(forged)).toBe(false);
  });
});
