'use strict';

const {
  assertNoExplicitSystemToken,
  assertTrustedYidaSystemTokenTarget,
  collectSystemTokenLocations,
  resolveYidaSystemToken,
} = require('../lib/connector/yida-system-token');

function yidaOperation(overrides = {}) {
  return {
    operationId: 'searchFormDatasV2',
    method: 'post',
    url: 'v2.0/yida/forms/instances/search',
    inputs: [{
      name: 'Body',
      paramLocation: 'body',
      childList: [
        { name: 'appType', paramLocation: 'body' },
        { name: 'systemToken', paramLocation: 'body' },
      ],
    }],
    ...overrides,
  };
}

describe('Yida systemToken safety contract', () => {
  test('recognizes only the declared body location', () => {
    expect(collectSystemTokenLocations(yidaOperation())).toEqual(['body']);
    expect(assertTrustedYidaSystemTokenTarget({
      scheme: 'https',
      host: 'api.dingtalk.com',
    }, yidaOperation())).toMatchObject({
      host: 'api.dingtalk.com',
      operationPath: '/v2.0/yida/forms/instances/search',
    });
  });

  test('combines connector baseUrl and operation path for trust validation', () => {
    expect(assertTrustedYidaSystemTokenTarget({
      scheme: 'https', host: 'api.dingtalk.com', baseUrl: '/v1.0/yida',
    }, yidaOperation({ url: '/forms/instances' })).operationPath)
      .toBe('/v1.0/yida/forms/instances');
  });

  test('rejects untrusted hosts and non-body token parameters', () => {
    expect(() => assertTrustedYidaSystemTokenTarget({
      scheme: 'https', host: 'example.com',
    }, yidaOperation())).toThrow(expect.objectContaining({
      code: 'YIDA_SYSTEM_TOKEN_TARGET_UNTRUSTED',
    }));
    expect(() => assertTrustedYidaSystemTokenTarget({
      scheme: 'https', host: 'api.dingtalk.com',
    }, yidaOperation({
      inputs: [{ name: 'Query', paramLocation: 'query', childList: [{ name: 'systemToken' }] }],
    }))).toThrow(expect.objectContaining({
      code: 'YIDA_SYSTEM_TOKEN_BODY_INPUT_REQUIRED',
    }));
  });

  test('rejects explicit token values including serialized body defaults', () => {
    expect(() => assertNoExplicitSystemToken({ body: { systemToken: 'owned-secret' } }))
      .toThrow(expect.objectContaining({ code: 'YIDA_SYSTEM_TOKEN_EXPLICIT_VALUE_FORBIDDEN' }));
    expect(() => assertNoExplicitSystemToken({ defaultValue: '{"systemToken":"owned-secret"}' }))
      .toThrow(expect.objectContaining({ code: 'YIDA_SYSTEM_TOKEN_EXPLICIT_VALUE_FORBIDDEN' }));
    expect(() => assertNoExplicitSystemToken({ name: 'systemToken', defaultValue: 'owned-secret' }))
      .toThrow(expect.objectContaining({ code: 'YIDA_SYSTEM_TOKEN_EXPLICIT_VALUE_FORBIDDEN' }));
    expect(() => assertNoExplicitSystemToken({ body: { systemToken: '' } })).not.toThrow();
  });

  test('reads a token through the provided authenticated client without exposing it in errors', async () => {
    const client = {
      postForm: jest.fn().mockResolvedValue({ success: true, content: 'owned-secret' }),
      get: jest.fn(),
    };
    await expect(resolveYidaSystemToken({}, 'APP_TARGET', { client }))
      .resolves.toBe('owned-secret');
    expect(client.postForm).toHaveBeenCalledWith(
      expect.stringMatching(/\/dingtalk\/web\/APP_TARGET\/query\/app\/getSystemToken\.json/),
      { _locale_time_zone_offset: '28800000' },
      { silentStatus: true }
    );

    const deniedClient = {
      postForm: jest.fn().mockResolvedValue({
        success: false,
        errorCode: 'NO_PERMISSION',
        errorMsg: 'owned-secret',
      }),
      get: jest.fn(),
    };
    await expect(resolveYidaSystemToken({}, 'APP_TARGET', { client: deniedClient }))
      .rejects.toMatchObject({
        code: 'YIDA_SYSTEM_TOKEN_READ_FAILED',
        message: expect.not.stringContaining('owned-secret'),
      });
  });

  test('classifies an inaccessible app without treating the whole login as expired', async () => {
    const client = {
      postForm: jest.fn().mockResolvedValue({ __needLogin: true }),
      get: jest.fn()
        .mockResolvedValueOnce({ __needLogin: true })
        .mockResolvedValueOnce({ success: true, content: { data: [] } }),
    };
    await expect(resolveYidaSystemToken({ userId: 'USER_1' }, 'APP_TARGET', { client }))
      .rejects.toMatchObject({
        code: 'YIDA_SYSTEM_TOKEN_APP_INACCESSIBLE',
        details: expect.objectContaining({
          remoteWrites: 0,
          retrySafe: true,
          sideEffectState: 'none',
        }),
      });
  });

  test('distinguishes missing systemToken permission from an invalid login', async () => {
    const permissionClient = {
      postForm: jest.fn().mockResolvedValue({ __needLogin: true }),
      get: jest.fn().mockResolvedValue({ success: true, content: {} }),
    };
    await expect(resolveYidaSystemToken({}, 'APP_TARGET', { client: permissionClient }))
      .rejects.toMatchObject({ code: 'YIDA_SYSTEM_TOKEN_PERMISSION_DENIED' });

    const loginClient = {
      postForm: jest.fn().mockResolvedValue({ __needLogin: true }),
      get: jest.fn().mockResolvedValue({ __needLogin: true }),
    };
    await expect(resolveYidaSystemToken({}, 'APP_TARGET', { client: loginClient }))
      .rejects.toMatchObject({ code: 'YIDA_SYSTEM_TOKEN_AUTH_REQUIRED' });
  });
});
