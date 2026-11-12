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

  test('fully masks connector credential blobs, AppKeys and permission-application links', () => {
    expect(redactSensitive({ securityValue: '{"custom-header":"fake-secret"}', appKey: 'fake-application-key' }))
      .toEqual({ securityValue: '***', appKey: '***' });
    expect(redactString('{"appKey":"fake-key","appSecret":"fake-secret"}'))
      .toBe('{"appKey":"***","appSecret":"***"}');
    expect(redactString('Missing [Contact.Org.Read]: https://open-dev.dingtalk.com/appscope/apply?content=fake-key%23Contact.Org.Read'))
      .toBe('Missing [Contact.Org.Read]: https://open-dev.dingtalk.com/appscope/apply?content=***');
    expect(redactSensitive({ jsapiTicket: 'fake-ticket', expireIn: 7200 }))
      .toEqual({ jsapiTicket: '***', expireIn: 7200 });
    expect(redactString('{"jsapiTicket":"fake-ticket","expireIn":7200}'))
      .toBe('{"jsapiTicket":"***","expireIn":7200}');
    const nested = JSON.stringify({ content: JSON.stringify({ jsapiTicket: 'nested-fake-ticket', expireIn: 7200 }),
      securityValue: JSON.stringify({ customHeader: 'nested-fake-value' }) });
    const masked = JSON.parse(redactString(nested));
    expect(masked.securityValue).toBe('***');
    expect(JSON.parse(masked.content)).toEqual({ jsapiTicket: '***', expireIn: 7200 });
    expect(redactString('jsapiTicket=query-fake-ticket&expireIn=7200')).toBe('jsapiTicket=***&expireIn=7200');
    const schema = '{"properties":{"appKey":{"type":"string"}},"name":"safe"}';
    expect(redactString(schema)).toBe(schema);
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
