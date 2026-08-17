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
      base_url: 'https://example.yida.test',
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      corp_name: '组织 1',
      user_id: 'user-1',
    });
    utils.httpGet.mockResolvedValue({ success: true, method: 'get' });
    utils.httpPost.mockResolvedValue({ success: true, method: 'post' });
    utils.httpPostJson.mockResolvedValue({ success: true, method: 'post-json' });
  });

  test('creates auth refs from cached login state', () => {
    const authRef = createAuthRef();

    expect(authRef).toMatchObject({
      baseUrl: 'https://example.yida.test',
      authMode: 'token',
      authSource: 'token',
      corpId: 'corp-1',
      corpName: '组织 1',
      userId: 'user-1',
    });
    expect(authRef).not.toHaveProperty('cookies');
    expect(authRef).not.toHaveProperty('cookieData');
    expect(utils.triggerLogin).not.toHaveBeenCalled();
  });

  test('falls back to login when cache is missing', () => {
    utils.loadAuthData.mockReturnValue(null);
    utils.triggerLogin.mockReturnValue({
      auth_mode: 'token',
      auth_source: 'token',
    });

    const authRef = createAuthRef();

    expect(authRef.authMode).toBe('token');
    expect(utils.triggerLogin).toHaveBeenCalledTimes(1);
  });

  test('does not expose legacy cookie auth data as an auth ref', () => {
    utils.loadAuthData.mockReturnValue({
      base_url: 'https://legacy.example.test',
      auth_mode: 'cookie',
      auth_source: 'cookie',
      cookies: [{ name: 'session', value: 'private' }],
      csrf_token: 'csrf',
    });
    utils.triggerLogin.mockReturnValue({
      base_url: 'https://example.yida.test',
      auth_mode: 'token',
      auth_source: 'token',
    });

    const authRef = createAuthRef();

    expect(authRef).toMatchObject({
      baseUrl: 'https://example.yida.test',
      authMode: 'token',
      authSource: 'token',
    });
    expect(authRef).not.toHaveProperty('cookies');
    expect(authRef).not.toHaveProperty('cookieData');
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

  test('getOnce sends one read without auto-login replay', async () => {
    utils.httpGet.mockResolvedValue({ __needLogin: true });
    const client = createYidaClient();

    await expect(client.getOnce('/query/path.json', { page: 1 })).resolves.toEqual({ __needLogin: true });

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
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
    await client.postForm('/save/path.json', auth => ({ userId: auth.userId, name: 'Ada' }));

    expect(utils.httpPost.mock.calls[0][2]).toBe('userId=user-1&name=Ada');
  });

  test.each([
    ['login expiry', { __needLogin: true }],
    ['CSRF expiry', { __csrfExpired: true }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('postFormOnce sends exactly once on %s', async (label, response) => {
    utils.httpPost.mockResolvedValue(response);
    const client = createYidaClient();

    await expect(client.postFormOnce('/save/path.json', auth => ({
      _csrf_token: auth.csrfToken,
      name: 'Ada',
    }))).resolves.toEqual(response);

    expect(label).toBeTruthy();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('postFormOnce rejects missing write auth before transport', async () => {
    const client = createYidaClient({ authRef: {
      baseUrl: 'https://example.yida.test',
      authMode: 'cookie',
      authSource: 'cookie',
    } });

    await expect(client.postFormOnce('/save/path.json', {})).rejects.toMatchObject({
      code: 'YIDA_WRITE_AUTH_NOT_READY',
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('posts JSON bodies with auth-aware paths and referers', async () => {
    const client = createYidaClient();
    const result = await client.postJson(
      auth => `/save/path.json?userId=${auth.userId}`,
      { name: 'Ada Lovelace' },
      auth => ({ referer: `${auth.baseUrl}/settings` })
    );

    expect(result).toEqual({ success: true, method: 'post-json' });
    expect(utils.httpPostJson).toHaveBeenCalledWith(
      'https://example.yida.test',
      '/save/path.json?userId=user-1',
      { name: 'Ada Lovelace' },
      { referer: 'https://example.yida.test/settings' }
    );
  });
});
