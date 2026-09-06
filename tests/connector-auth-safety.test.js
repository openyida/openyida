'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
}));

const {
  buildSecuritySchemes,
  parseArgs: parseCreateArgs,
} = require('../lib/connector/connector-create');
const {
  buildSecurityValue,
  collectInteractiveCredentials,
  parseArgs,
} = require('../lib/connector/connector-create-connection');

describe('connector DingAuth credential safety', () => {
  test('connector definition contains only the DingAuth scheme and never credentials', () => {
    expect(buildSecuritySchemes({
      authType: 'DINGTALK',
      appKey: 'must-not-persist',
      appSecret: 'must-not-persist',
    })).toBe('{"DingAuth":{}}');
  });

  test('connector creation rejects DingTalk credentials before any remote work', () => {
    let error;
    try {
      parseCreateArgs([
        '钉钉连接器',
        'api.dingtalk.com',
        '--auth',
        '钉钉开放平台验证',
        '--app-key',
        'unsafe-argv',
      ]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: 'CONNECTOR_CREDENTIALS_NOT_ACCEPTED_ON_CREATE',
      details: expect.objectContaining({ sideEffectState: 'none' }),
    });
  });

  test('interactive mode collects both values outside argv and builds the account payload', async () => {
    const values = ['ding-app-key', 'ding-app-secret'];
    const readSecret = jest.fn(async () => values.shift());
    const options = parseArgs(['910244', '生产账号', '--interactive', '--json']);
    const input = { isTTY: true, setRawMode: jest.fn() };

    const collected = await collectInteractiveCredentials(options, 'DingAuth', {
      readSecret,
      input,
      output: {},
    });

    expect(options).not.toHaveProperty('appKey');
    expect(options).not.toHaveProperty('appSecret');
    expect(readSecret).toHaveBeenCalledTimes(2);
    expect(buildSecurityValue(collected, 'DingAuth')).toBe(
      '{"appKey":"ding-app-key","appSecret":"ding-app-secret"}'
    );
  });

  test('interactive mode fails closed before mutation without a TTY', async () => {
    await expect(collectInteractiveCredentials(
      { interactive: true },
      'DingAuth',
      { input: { isTTY: false }, output: {} }
    )).rejects.toMatchObject({
      code: 'CONNECTOR_SECRET_INPUT_TTY_REQUIRED',
      details: {
        retrySafe: true,
        sideEffectState: 'none',
      },
    });
  });

  test('interactive mode rejects explicit DingTalk credential flags', async () => {
    await expect(collectInteractiveCredentials({
      interactive: true,
      appKey: 'unsafe-argv',
      appSecret: 'unsafe-argv',
    }, 'DingAuth')).rejects.toMatchObject({
      code: 'CONNECTOR_SECRET_INPUT_CONFLICT',
      details: { sideEffectState: 'none' },
    });
  });

  test('interactive mode is not silently applied to unrelated auth schemes', async () => {
    await expect(collectInteractiveCredentials({ interactive: true }, 'ApiKeyAuth'))
      .rejects.toMatchObject({ code: 'CONNECTOR_INTERACTIVE_AUTH_UNSUPPORTED' });
  });
});
