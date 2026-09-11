/* eslint-env jest */

const {
  dateVersion,
  nextVersion,
  parseArgs,
  parseDate,
} = require('../scripts/next-version');

describe('openyida release version generator', () => {
  test('uses the Asia/Shanghai calendar date', () => {
    expect(dateVersion(new Date('2026-09-07T16:30:00.000Z'))).toBe('2026.9.8');
  });

  test('starts a stable release at the bare date version', () => {
    expect(nextVersion('stable', '2026.9.8', ['v2026.9.8-beta.0'])).toBe('2026.9.8');
  });

  test('increments stable releases independently from beta releases', () => {
    expect(nextVersion('stable', '2026.9.8', [
      'v2026.9.8',
      'v2026.9.8-1',
      'v2026.9.8-2',
      'v2026.9.8-beta.7',
    ])).toBe('2026.9.8-3');
  });

  test('starts beta releases at zero and increments the highest beta', () => {
    expect(nextVersion('beta', '2026.9.8', ['v2026.9.8'])).toBe('2026.9.8-beta.0');
    expect(nextVersion('beta', '2026.9.8', [
      'v2026.9.8-beta.0',
      'v2026.9.8-beta.2',
      'v2026.9.8-1',
    ])).toBe('2026.9.8-beta.3');
  });

  test('supports a deterministic date override', () => {
    const args = parseArgs(['beta', '--date', '2026-09-08', '--remote', 'upstream']);
    expect(dateVersion(args.now)).toBe('2026.9.8');
    expect(args.remote).toBe('upstream');
    expect(() => parseDate('2026-02-30')).toThrow('无效日期');
  });

  test('rejects unknown channels', () => {
    expect(() => nextVersion('rc', '2026.9.8', [])).toThrow('仅支持 stable 或 beta');
  });
});
