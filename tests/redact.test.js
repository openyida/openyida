'use strict';

const {
  maskString,
  redactSensitive,
  redactString,
  safeJsonStringify,
} = require('../lib/core/redact');

describe('redact utilities', () => {
  test('fullMask removes long and short secrets recursively without mutating input', () => {
    const input = {
      systemToken: 'a-long-system-token-value',
      nested: [{ Authorization: 'Bearer a-long-access-token', cookie: 'short', password: 'p', count: 7 }],
      credentials: { api_key: { value: 'hidden' } },
      name: 'safe',
    };
    const original = JSON.parse(JSON.stringify(input));
    expect(redactSensitive(input, { fullMask: true })).toEqual({
      systemToken: '***',
      nested: [{ Authorization: '***', cookie: '***', password: '***', count: 7 }],
      credentials: { api_key: '***' },
      name: 'safe',
    });
    expect(input).toEqual(original);
    expect(redactSensitive(input).systemToken).toBe('a-lo***alue');
  });

  test('masks sensitive keys recursively', () => {
    const input = {
      Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz',
      nested: {
        csrf_token: 'csrf-token-value',
        systemToken: 'system-token-value',
        publicName: 'Ada',
      },
    };

    expect(redactSensitive(input)).toEqual({
      Authorization: 'Bear***wxyz',
      nested: {
        csrf_token: 'csrf***alue',
        systemToken: 'syst***alue',
        publicName: 'Ada',
      },
    });
  });

  test('redacts secrets, emails, and phone numbers inside strings', () => {
    const text = 'Authorization: Bearer abc123 token=secret systemToken=owned-secret user ada@example.com phone 13812345678';

    expect(redactString(text)).toBe(
      'Authorization: Bearer *** token=*** systemToken=*** user a***@example.com phone 138****5678'
    );
  });

  test('redacts systemToken in serialized JSON strings', () => {
    expect(redactString('{"systemToken":"owned-secret","name":"safe"}'))
      .toBe('{"systemToken":"***","name":"safe"}');
  });

  test('handles circular references for JSON output', () => {
    const input = { name: 'Ada' };
    input.self = input;

    expect(safeJsonStringify(input)).toContain('"self": "[Circular]"');
  });

  test('masks short values completely', () => {
    expect(maskString('abc')).toBe('***');
  });
});


test('shared diagnostics remain complete and redacted in every output location', () => {
  const shared = { path: '/tmp/missing.png', accessToken: 'sensitive-access-token-value' };
  const input = { asset: { details: shared }, gaps: [{ details: shared }] };
  const output = JSON.parse(safeJsonStringify(input));
  expect(output.asset.details).toEqual(output.gaps[0].details);
  expect(output.asset.details.path).toBe('/tmp/missing.png');
  expect(output.asset.details.accessToken).not.toBe(shared.accessToken);
  expect(safeJsonStringify(input)).not.toContain('[Circular]');
  const cycle = [];
  cycle.push(cycle);
  expect(JSON.parse(safeJsonStringify(cycle))).toEqual(['[Circular]']);
});
