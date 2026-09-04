'use strict';

jest.mock('../lib/auth/token-auth', () => ({
  getAccessToken: jest.fn(() => 'test-access-token'),
}));

const {
  httpGetCodeBundleText,
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

  test.each([
    ['source', 'source', 'text/plain'],
    ['runtime', 'runtime', 'application/javascript'],
  ])('downloads %s directly from Tianshu', async (artifact, content, contentType) => {
    const metadata = {};
    global.fetch = jest.fn().mockResolvedValue(new Response(content, {
      status: 200,
      headers: {
        'content-length': String(Buffer.byteLength(content)),
        'content-type': `${contentType}; charset=UTF-8`,
        'eagleeye-traceid': 'trace-tianshu',
        'x-request-id': 'request-tianshu',
      },
    }));

    const response = await httpGetCodeBundleText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact },
      {
        silentStatus: true,
        maxBytes: Buffer.byteLength(content),
        expectedContentTypes: [contentType],
        onResponseMetadata: value => Object.assign(metadata, value),
      }
    );

    expect(response).toBe(content);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = global.fetch.mock.calls[0];
    expect(requestUrl.searchParams.get('artifact')).toBe(artifact);
    expect(requestOptions.redirect).toBe('manual');
    expect(requestOptions.headers.Authorization).toBe('Bearer test-access-token');
    expect(metadata).toMatchObject({
      baseUrl: 'https://yida.example.test',
      finalHost: 'yida.example.test',
      status: 200,
      contentType,
      eagleeyeTraceId: 'trace-tianshu',
      requestId: 'request-tianshu',
    });
  });

  test('rejects unexpected redirects without following them', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: {
        location: 'https://unexpected.example.test/runtime.js',
        'eagleeye-traceid': 'trace-redirect',
      },
    }));

    await expect(httpGetCodeBundleText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      { silentStatus: true, expectedContentTypes: ['application/javascript'] }
    )).rejects.toMatchObject({
      code: 'CODE_BUNDLE_DOWNLOAD_HTTP_ERROR',
      details: expect.objectContaining({
        finalHost: 'yida.example.test',
        status: 302,
      }),
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('classifies a 200 HTML error page before integrity verification', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<!doctype html><title>route error</title>', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'eagleeye-traceid': 'trace-html',
      },
    }));

    await expect(httpGetCodeBundleText(
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

    await expect(httpGetCodeBundleText(
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
  ])('classifies Tianshu HTTP %s responses', async (status, code) => {
    global.fetch = jest.fn().mockResolvedValue(new Response('request failed', {
      status,
      headers: {
        'content-type': 'text/plain',
        'eagleeye-traceid': 'trace-tianshu',
        'x-request-id': `request-${status}`,
      },
    }));

    await expect(httpGetCodeBundleText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      { silentStatus: true, expectedContentTypes: ['application/javascript'] }
    )).rejects.toMatchObject({
      code,
      details: expect.objectContaining({
        baseUrl: 'https://yida.example.test',
        finalHost: 'yida.example.test',
        status,
        eagleeyeTraceId: 'trace-tianshu',
        requestId: `request-${status}`,
      }),
    });
  });

  test('rejects an unexpected success Content-Type before returning text', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('runtime', {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
    }));

    await expect(httpGetCodeBundleText(
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
