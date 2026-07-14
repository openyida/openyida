'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const getPageConfig = require('../lib/page-config/get-page-config');
const saveShareConfig = require('../lib/page-config/save-share-config');
const verifyShortUrl = require('../lib/page-config/verify-short-url');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
  csrf_token: 'tok123',
};

let logSpy;
let errorSpy;

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

function getLoggedJson() {
  return JSON.parse(logSpy.mock.calls[0][0]);
}

function expectCliError(error, code, message) {
  expect(error).toBeTruthy();
  expect(error.isCliError).toBe(true);
  expect(error.code).toBe(code);
  if (message) {
    expect(error.message).toContain(message);
  }
}

describe('get-page-config', () => {
  test('queries share config through yida-client and prints normalized JSON', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
      content: {
        isOpen: 'y',
        openUrl: '/o/public-page',
        shareUrl: '/s/internal-page',
      },
    });

    const result = await getPageConfig.run(['APP_XXX', 'FORM_XXX']);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/getShareConfig.json');
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      _api: 'Share.getShareConfig',
      _csrf_token: 'tok123',
      formUuid: 'FORM_XXX',
    });
    expect(result).toEqual({
      isOpen: true,
      openUrl: '/o/public-page',
      shareUrl: '/s/internal-page',
    });
    expect(getLoggedJson()).toEqual(result);
  });

  test('reports missing arguments as CliError instead of exiting', async () => {
    await expect(getPageConfig.run([])).rejects.toMatchObject({
      isCliError: true,
      code: 'PAGE_CONFIG_INVALID_ARGUMENTS',
    });
  });
});

describe('verify-short-url', () => {
  test('checks public open URL availability through yida-client', async () => {
    utils.httpGet.mockResolvedValue({
      success: true,
      content: true,
    });

    const result = await verifyShortUrl.run(['APP_XXX', 'FORM_XXX', '/o/new-page']);

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/verifyShortUrl.json');
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      _api: 'App.verifyShortUrlForm',
      _csrf_token: 'tok123',
      formUuid: 'FORM_XXX',
      openUrl: '/o/new-page',
    });
    expect(result).toMatchObject({
      available: true,
      url: '/o/new-page',
      urlType: 'open',
    });
    expect(getLoggedJson()).toEqual(result);
  });

  test('keeps taken URL as a normal JSON result', async () => {
    utils.httpGet.mockResolvedValue({
      success: false,
      errorMsg: '短链已存在',
      errorCode: 'DUPLICATE',
    });

    const result = await verifyShortUrl.run(['APP_XXX', 'FORM_XXX', '/s/existing-page']);

    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      shareUrl: '/s/existing-page',
    });
    expect(result).toEqual({
      available: false,
      url: '/s/existing-page',
      urlType: 'share',
      message: '短链已存在',
      errorCode: 'DUPLICATE',
    });
  });

  test('rejects invalid URL format without network work', async () => {
    let error;
    try {
      await verifyShortUrl.run(['APP_XXX', 'FORM_XXX', 'bad-url']);
    } catch (err) {
      error = err;
    }

    expectCliError(error, 'VERIFY_SHORT_URL_INVALID_ARGUMENTS', 'bad-url');
    expect(utils.httpGet).not.toHaveBeenCalled();
  });
});

describe('save-share-config', () => {
  test('saves public open URL config through yida-client', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
    });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'y', 'n']);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/saveShareConfig.json');
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body).toMatchObject({
      _api: 'Share.saveShareConfig',
      _csrf_token: 'tok123',
      formUuid: 'FORM_XXX',
      openUrl: '/o/public-page',
      isOpen: 'y',
    });
    expect(JSON.parse(body.openPageAuthConfig)).toEqual({
      openAuth: 'n',
      authSources: [],
    });
    expect(result).toEqual({
      success: true,
      openUrl: '/o/public-page',
      isOpen: true,
      message: expect.any(String),
    });
    expect(getLoggedJson()).toEqual(result);
  });

  test('sends organization share URLs as shareUrl', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
    });

    await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/s/internal-page', 'y']);

    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body).toMatchObject({
      shareUrl: '/s/internal-page',
    });
    expect(body.openUrl).toBeUndefined();
  });

  test('keeps save API business failure as a normal JSON result', async () => {
    utils.httpPost.mockResolvedValue({
      success: false,
      errorMsg: '保存失败',
      errorCode: 'SAVE_FAILED',
    });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'y']);

    expect(result).toEqual({
      success: false,
      message: '保存失败',
      errorCode: 'SAVE_FAILED',
    });
  });

  test('rejects invalid open flag without network work', async () => {
    let error;
    try {
      await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'maybe']);
    } catch (err) {
      error = err;
    }

    expectCliError(error, 'SAVE_SHARE_CONFIG_INVALID_ARGUMENTS', 'maybe');
    expect(utils.httpPost).not.toHaveBeenCalled();
  });
});
