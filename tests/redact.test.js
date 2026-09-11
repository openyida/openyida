'use strict';

const {
  maskString,
  redactSensitive,
  redactString,
  safeJsonStringify,
} = require('../lib/core/redact');

describe('redact utilities', () => {
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
