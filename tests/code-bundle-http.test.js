'use strict';

jest.mock('../lib/auth/token-auth', () => ({
  getAccessToken: jest.fn(() => 'test-access-token'),
}));

const {
  httpGetRedirectText,
  httpPostMultipart,
} = require('../lib/core/utils');

describe('CodeBundle HTTP transport', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('posts fields and source/runtime as multipart form data', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      content: { storageMode: 'CODE_BUNDLE' },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await httpPostMultipart(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/save.json',
      { formUuid: 'FORM_XXX', canvasNodeId: 'canvas-1' },
      {
        source: { content: 'source', fileName: 'source.jsx', contentType: 'text/plain' },
        runtime: { content: 'runtime', fileName: 'runtime.js', contentType: 'application/javascript' },
      },
      { silentStatus: true }
    );

    expect(response).toMatchObject({ success: true, content: { storageMode: 'CODE_BUNDLE' } });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = global.fetch.mock.calls[0];
    expect(requestUrl.toString()).toBe('https://yida.example.test/alibaba/web/APP_XXX/query/codeBundle/save.json');
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.headers.Authorization).toBe('Bearer test-access-token');
    expect(requestOptions.body.get('formUuid')).toBe('FORM_XXX');
    expect(requestOptions.body.get('canvasNodeId')).toBe('canvas-1');
    await expect(requestOptions.body.get('source').text()).resolves.toBe('source');
    await expect(requestOptions.body.get('runtime').text()).resolves.toBe('runtime');
  });

  test('follows the OSS redirect without forwarding first-party authentication headers', async () => {
    const metadata = {};
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: {
          location: 'https://bundle.oss.example.test/code-bundle/runtime.js?token=short-lived',
          'eagleeye-traceid': 'trace-first-party',
        },
      }))
      .mockResolvedValueOnce(new Response('runtime', {
        status: 200,
        headers: {
          'content-length': '7',
          'content-type': 'application/javascript; charset=UTF-8',
          'x-oss-request-id': 'oss-request-1',
        },
      }));

    const response = await httpGetRedirectText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      {
        silentStatus: true,
        maxBytes: 7,
        expectedContentTypes: ['application/javascript'],
        onResponseMetadata: value => Object.assign(metadata, value),
      }
    );

    expect(response).toBe('runtime');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstHeaders = global.fetch.mock.calls[0][1].headers;
    const ossHeaders = global.fetch.mock.calls[1][1].headers;
    expect(firstHeaders.Authorization).toBe('Bearer test-access-token');
    expect(ossHeaders.Authorization).toBeUndefined();
    expect(ossHeaders.Origin).toBeUndefined();
    expect(ossHeaders.Referer).toBeUndefined();
    expect(ossHeaders['x-requested-with']).toBeUndefined();
    expect(metadata).toMatchObject({
      baseUrl: 'https://yida.example.test',
      finalHost: 'bundle.oss.example.test',
      status: 200,
      contentType: 'application/javascript',
      eagleeyeTraceId: 'trace-first-party',
      requestId: 'oss-request-1',
    });
  });

  test('classifies a 200 HTML error page before integrity verification', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<!doctype html><title>route error</title>', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'eagleeye-traceid': 'trace-html',
      },
    }));

    await expect(httpGetRedirectText(
      'https://wrong-env.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'source' },
      { silentStatus: true, expectedContentTypes: ['text/plain'] }
    )).rejects.toMatchObject({
      code: 'CODE_BUNDLE_DOWNLOAD_HTML_RESPONSE',
      message: expect.stringContaining('eagleeyeTraceId=trace-html'),
      details: expect.objectContaining({
        baseUrl: 'https://wrong-env.example.test',
        finalHost: 'wrong-env.example.test',
        status: 200,
        contentType: 'text/html',
      }),
    });
  });

  test('classifies a 200 JSON service error before integrity verification', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      errorCode: '500',
      errorMsg: 'route not found',
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'eagleeye-traceid': 'trace-json',
      },
    }));

    await expect(httpGetRedirectText(
      'https://wrong-env.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      { silentStatus: true, expectedContentTypes: ['application/javascript'] }
    )).rejects.toMatchObject({
      code: 'CODE_BUNDLE_DOWNLOAD_JSON_RESPONSE',
      message: expect.stringContaining('route not found'),
      details: expect.objectContaining({
        status: 200,
        contentType: 'application/json',
        eagleeyeTraceId: 'trace-json',
      }),
    });
  });

  test.each([
    [403, 'CODE_BUNDLE_DOWNLOAD_FORBIDDEN'],
    [404, 'CODE_BUNDLE_DOWNLOAD_NOT_FOUND'],
  ])('classifies OSS HTTP %s responses', async (status, code) => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: {
          location: 'https://bundle.oss.example.test/code-bundle/runtime.js?token=short-lived',
          'eagleeye-traceid': 'trace-first-party',
        },
      }))
      .mockResolvedValueOnce(new Response('<Error><Code>AccessDenied</Code></Error>', {
        status,
        headers: {
          'content-type': 'application/xml',
          'x-oss-request-id': `oss-request-${status}`,
        },
      }));

    await expect(httpGetRedirectText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      { silentStatus: true, expectedContentTypes: ['application/javascript'] }
    )).rejects.toMatchObject({
      code,
      details: expect.objectContaining({
        baseUrl: 'https://yida.example.test',
        finalHost: 'bundle.oss.example.test',
        status,
        eagleeyeTraceId: 'trace-first-party',
        requestId: `oss-request-${status}`,
      }),
    });
  });

  test('rejects an unexpected success Content-Type before returning text', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('runtime', {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
    }));

    await expect(httpGetRedirectText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      { silentStatus: true, expectedContentTypes: ['application/javascript'] }
    )).rejects.toMatchObject({
      code: 'CODE_BUNDLE_DOWNLOAD_UNEXPECTED_CONTENT_TYPE',
      details: expect.objectContaining({
        status: 200,
        contentType: 'application/octet-stream',
      }),
    });
  });
});
