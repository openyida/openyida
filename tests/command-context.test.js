'use strict';

const https = require('https');
const { EventEmitter } = require('events');
const { Readable } = require('stream');

jest.mock('../lib/auth/token-auth', () => ({
  getAccessToken: jest.fn(() => 'test-token'),
  tokenRefresh: jest.fn(async () => ({
    ok: true,
    access_token: 'refreshed-test-token',
    base_url: 'https://www.aliwork.com',
  })),
  isRefreshAuthRequired: jest.fn(() => false),
}));

const { tokenRefresh } = require('../lib/auth/token-auth');
const builderAiSource = require('../lib/app/builder-ai-source');
const { runWithCommandContext, getCommandContextHeaders } = require('../lib/core/command-context');
const { httpGet, httpPost, httpPostJson, httpPostMultipart, httpGetCodeBundleText,
  requestWithAutoLogin } = require('../lib/core/utils');

const YIDA_ORIGIN = 'https://www.aliwork.com';
const SOURCE = 'X-OpenYida-Agent-Source';
const ID = 'X-OpenYida-Command-Id';
const STARTED_AT = 'X-OpenYida-Command-Started-At-Ms';
const silent = { silentStatus: true };

function mockRequest(statusCodes) {
  return jest.spyOn(https, 'request').mockImplementation((_options, receive) => {
    const request = new EventEmitter();
    request.write = jest.fn();
    request.end = () => {
      const response = Readable.from([Buffer.from('{"success":true}')]);
      response.statusCode = statusCodes.shift() ?? 200;
      response.headers = {};
      receive(response);
    };
    return request;
  });
}

afterEach(() => jest.restoreAllMocks());

test('shares command headers across retries, parallel requests and all common transports', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, OPENYIDA_MANAGED_RUN: '0' });
  const resolveSource = jest.spyOn(builderAiSource, 'resolveBuilderAiSource').mockReturnValue('codex');
  const request = mockRequest([401, 200]);
  const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (_url, options) =>
    options.method === 'POST'
      ? new Response('{"success":true}')
      : new Response('source', { headers: { 'content-type': 'text/plain' } }));
  const before = Date.now();

  await runWithCommandContext(async () => {
    await expect(requestWithAutoLogin(
      ref => httpGet(ref.baseUrl, '/read', null, silent), { baseUrl: YIDA_ORIGIN }
    )).resolves.toMatchObject({ success: true });
    await Promise.all([
      httpPost(YIDA_ORIGIN, '/form', 'value=1', silent),
      httpPostJson(YIDA_ORIGIN, '/json', { value: 1 }, silent),
      httpPostMultipart(YIDA_ORIGIN, '/upload', {}, {}, silent),
      httpGetCodeBundleText(YIDA_ORIGIN, '/bundle', {}, silent),
    ]);
  });

  expect(tokenRefresh).toHaveBeenCalledTimes(1);
  expect(resolveSource).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(4);
  expect(fetch).toHaveBeenCalledTimes(2);
  const [first] = request.mock.calls[0];
  const { [ID]: commandId, [STARTED_AT]: startedAt } = first.headers;
  expect(commandId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  expect(startedAt).toMatch(/^[0-9]{13}$/);
  expect(Number(startedAt)).toBeGreaterThanOrEqual(before);
  expect(Number(startedAt)).toBeLessThanOrEqual(Date.now());
  const calls = [
    ...request.mock.calls.map(([options]) => options),
    ...fetch.mock.calls.map(([, options]) => options),
  ];
  for (const call of calls) {
    expect(call.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      [SOURCE]: 'codex',
      [ID]: commandId,
      [STARTED_AT]: startedAt,
    });
  }

  const next = await runWithCommandContext(async () =>
    getCommandContextHeaders(new URL(YIDA_ORIGIN)));
  expect(next[ID]).toBeDefined();
  expect(next[ID]).not.toBe(commandId);
  expect(getCommandContextHeaders(new URL(YIDA_ORIGIN))).toEqual({});
});

test('checks the final request origin and does not forward headers through redirects', async () => {
  const request = mockRequest([]);
  const fetch = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(new Response('{"success":true}'))
    .mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'https://external.example.test/asset.js' },
    }));

  await runWithCommandContext(async () => {
    await httpGet('https://www.aliwork.com.external.example.test', '/read', null, silent);
    await httpPostMultipart(YIDA_ORIGIN, '//external.example.test/upload', {}, {}, silent);
    await expect(httpGetCodeBundleText(YIDA_ORIGIN, '/bundle', {}, silent))
      .rejects.toMatchObject({ code: 'CODE_BUNDLE_DOWNLOAD_HTTP_ERROR' });
    expect(getCommandContextHeaders(new URL('http://www.aliwork.com'))).toEqual({});
    expect(getCommandContextHeaders(new URL('https://www.aliwork.com:8443'))).toEqual({});
  });

  expect(request.mock.calls[0][0].headers).not.toHaveProperty(ID);
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty(ID);
  expect(fetch.mock.calls[1][1].headers).toHaveProperty(ID);
  expect(fetch.mock.calls[1][1].redirect).toBe('manual');
  expect(fetch).toHaveBeenCalledTimes(2);
});
