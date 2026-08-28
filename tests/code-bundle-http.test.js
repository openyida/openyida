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
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: {
          location: 'https://bundle.oss.example.test/code-bundle/runtime.js?token=short-lived',
        },
      }))
      .mockResolvedValueOnce(new Response('runtime', {
        status: 200,
        headers: { 'content-length': '7' },
      }));

    const response = await httpGetRedirectText(
      'https://yida.example.test',
      '/alibaba/web/APP_XXX/query/codeBundle/download.json',
      { formUuid: 'FORM_XXX', bundleId: 'a'.repeat(64), artifact: 'runtime' },
      { silentStatus: true, maxBytes: 7 }
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
  });
});
