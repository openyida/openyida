'use strict';

const {
  AUTH_TYPE_CODES,
  HTTP_CONNECTOR_MODE,
  buildConnectorTestPayload,
  canonicalizeConnectorTestResponse,
  connectorRequiresAuth,
} = require('../lib/connector/contract');
const { setLanguage } = require('../lib/core/i18n');

describe('connector shared contract', () => {
  test('centralizes the frontend HTTP mode and auth type codes', () => {
    expect(HTTP_CONNECTOR_MODE).toBe(5);
    expect(AUTH_TYPE_CODES).toMatchObject({
      NONE: 0,
      BasicAuth: 2,
      ApiKeyAuth: 3,
      DingAuth: 5,
      AliyunApiGateway: 6,
      DingTrustGW: 7,
    });
  });

  test('detects whether security schemes require an owned connection', () => {
    expect(connectorRequiresAuth('{}')).toBe(false);
    expect(connectorRequiresAuth(JSON.stringify({ NONE: {} }))).toBe(false);
    expect(connectorRequiresAuth(JSON.stringify({ ApiKeyAuth: { name: 'X-API-Key' } }))).toBe(true);
    expect(() => connectorRequiresAuth('{broken')).toThrow(expect.objectContaining({
      code: 'CONNECTOR_CONTRACT_JSON_INVALID',
    }));
  });

  test('builds the frontend request and uses the shared HTTP mode', () => {
    expect(buildConnectorTestPayload({
      connector: { scheme: 'https', host: 'echo.example.com', baseUrl: '/v1' },
      operation: { method: 'post', url: 'echo/{id}' },
      path: { id: '42' },
      query: { trace: 'owned' },
      header: { 'X-E2E': 'owned' },
      body: { ok: true },
      authId: '7',
    })).toEqual({
      url: 'https://echo.example.com/v1/echo/{id}',
      connection: '7',
      method: 'post',
      path: { id: '42' },
      query: { trace: 'owned' },
      header: { 'X-E2E': 'owned' },
      connectorMode: 5,
      body: { ok: true },
    });
  });

  test('accepts canonical frontend responses and proven success envelopes', () => {
    const canonical = {
      statusLine: 'HTTP/1.1 204 No Content',
      responseHeaders: { 'x-owned': 'yes' },
      content: '',
    };
    expect(canonicalizeConnectorTestResponse(canonical)).toEqual(canonical);
    expect(canonicalizeConnectorTestResponse({ success: true, content: canonical })).toEqual(canonical);
  });

  test('fails closed for unknown envelopes and non-2xx status lines', () => {
    expect(() => canonicalizeConnectorTestResponse({
      statusCode: 200,
      headers: {},
      body: '{"ok":true}',
    })).toThrow(expect.objectContaining({ code: 'CONNECTOR_TEST_RESPONSE_INVALID' }));
    expect(() => canonicalizeConnectorTestResponse({
      success: false,
      content: {
        statusLine: 'HTTP/1.1 200 OK',
        responseHeaders: {},
        content: '{"ok":true}',
      },
    })).toThrow(expect.objectContaining({ code: 'CONNECTOR_TEST_ENVELOPE_FAILED' }));
    expect(() => canonicalizeConnectorTestResponse({
      statusLine: 'HTTP/1.1 401 Unauthorized',
      responseHeaders: {},
      content: '{"message":"denied"}',
    })).toThrow(expect.objectContaining({ code: 'CONNECTOR_TEST_HTTP_FAILED' }));
  });

  test('localizes contract errors outside zh', () => {
    setLanguage('en');
    try {
      expect(() => canonicalizeConnectorTestResponse({ statusCode: 200 }))
        .toThrow('Connector test returned an unrecognized response contract.');
    } finally {
      setLanguage('zh');
    }
    expect(() => canonicalizeConnectorTestResponse({ statusCode: 200 }))
      .toThrow('连接器测试返回了无法识别的响应契约。');
  });
});
