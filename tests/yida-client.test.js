'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://example.yida.test'),
  httpPost: jest.fn(),
  httpPostJson: jest.fn(),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const { createAuthRef, createYidaClient } = require('../lib/core/yida-client');

describe('yida-client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue({
      csrf_token: 'csrf123',
      base_url: 'https://example.yida.test',
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      user_id: 'user-1',
    });
    utils.httpGet.mockResolvedValue({ success: true, method: 'get' });
    utils.httpPost.mockResolvedValue({ success: true, method: 'post' });
    utils.httpPostJson.mockResolvedValue({ success: true, method: 'post-json' });
  });

  test('creates auth refs from cached login state', () => {
    const authRef = createAuthRef();

    expect(authRef).toMatchObject({
      csrfToken: 'csrf123',
      baseUrl: 'https://example.yida.test',
      authMode: 'token',
      authSource: 'token',
      corpId: 'corp-1',
      userId: 'user-1',
    });
    expect(authRef).not.toHaveProperty('cookies');
    expect(authRef).not.toHaveProperty('cookieData');
    expect(utils.triggerLogin).not.toHaveBeenCalled();
  });

  test('falls back to login when cache is missing', () => {
    utils.loadAuthData.mockReturnValue(null);
    utils.triggerLogin.mockReturnValue({
      csrf_token: 'fresh',
      auth_mode: 'token',
      auth_source: 'token',
    });

    const authRef = createAuthRef();

    expect(authRef.csrfToken).toBe('fresh');
    expect(utils.triggerLogin).toHaveBeenCalledTimes(1);
  });

  test('wraps GET requests with auto-login handling', async () => {
    const client = createYidaClient();
    const result = await client.get('/query/path.json', { page: 1 });

    expect(result).toEqual({ success: true, method: 'get' });
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://example.yida.test',
      '/query/path.json',
      { page: 1 }
    );
  });

  test('encodes POST form body and wraps it with auto-login handling', async () => {
    const client = createYidaClient();
    const result = await client.postForm('/save/path.json', { name: 'Ada Lovelace' });

    expect(result).toEqual({ success: true, method: 'post' });
    expect(utils.httpPost).toHaveBeenCalledWith(
      'https://example.yida.test',
      '/save/path.json',
      'name=Ada%20Lovelace'
    );
  });

  test('can build request params from the current auth ref', async () => {
    const client = createYidaClient();
    await client.postForm('/save/path.json', auth => ({ _csrf_token: auth.csrfToken, name: 'Ada' }));

    expect(utils.httpPost.mock.calls[0][2]).toBe('_csrf_token=csrf123&name=Ada');
  });

  test('posts JSON bodies with auth-aware paths and referers', async () => {
    const client = createYidaClient();
    const result = await client.postJson(
      auth => `/save/path.json?_csrf_token=${auth.csrfToken}`,
      { name: 'Ada Lovelace' },
      auth => ({ referer: `${auth.baseUrl}/settings` })
    );

    expect(result).toEqual({ success: true, method: 'post-json' });
    expect(utils.httpPostJson).toHaveBeenCalledWith(
      'https://example.yida.test',
      '/save/path.json?_csrf_token=csrf123',
      { name: 'Ada Lovelace' },
      { csrfToken: 'csrf123', referer: 'https://example.yida.test/settings' }
    );
  });
});
