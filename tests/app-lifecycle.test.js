'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const {
  buildRequestPath,
  changeAppLifecycle,
  parseArgs,
  run,
} = require('../lib/app/app-lifecycle');

const AUTH_REF = {
  baseUrl: 'https://www.aliwork.com',
  csrfToken: 'csrf-value',
  authMode: 'token',
  authSource: 'token',
};

beforeEach(() => {
  jest.clearAllMocks();
  createAuthRef.mockReturnValue(AUTH_REF);
});

describe('app lifecycle requests', () => {
  test('online builds App.goOnline URL and default form body', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: true });

    const output = await changeAppLifecycle('online', parseArgs(['APP_1']));
    const [baseUrl, requestPath, rawBody] = utils.httpPost.mock.calls[0];

    expect(baseUrl).toBe('https://www.aliwork.com');
    expect(requestPath).toMatch(/^\/dingtalk\/web\/APP_1\/query\/app\/onlineApp\.json\?_api=App\.goOnline&_mock=false&_stamp=\d+$/);
    expect(querystring.parse(rawBody)).toEqual({
      _csrf_token: 'csrf-value',
      _locale_time_zone_offset: '28800000',
      isToDingAppCenter: 'n',
      showAppCenter: 'n',
    });
    expect(utils.httpPost.mock.calls[0][3]).toBeUndefined();
    expect(output).toMatchObject({ success: true, action: 'online', appType: 'APP_1' });
  });

  test('offline builds App.goOffline URL and enables explicit app center flags', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: true });

    const params = parseArgs(['APP_2', '--to-ding-app-center', '--show-app-center']);
    const output = await changeAppLifecycle('offline', params);
    const requestPath = utils.httpPost.mock.calls[0][1];
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(requestPath).toMatch(/^\/dingtalk\/web\/APP_2\/query\/app\/offlineApp\.json\?_api=App\.goOffline&_mock=false&_stamp=\d+$/);
    expect(body).toMatchObject({
      isToDingAppCenter: 'y',
      showAppCenter: 'y',
    });
    expect(output).toMatchObject({
      action: 'offline',
      isToDingAppCenter: true,
      showAppCenter: true,
    });
  });

  test('failed or false-content response rejects with a CLI error', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
      content: false,
      errorCode: 'APP_STATE_REJECTED',
      errorMsg: 'operation rejected',
    });

    await expect(changeAppLifecycle('offline', parseArgs(['APP_3'])))
      .rejects.toMatchObject({
        isCliError: true,
        code: 'APP_OFFLINE_FAILED',
        message: 'operation rejected',
      });
  });

  test('missing appType and help never issue a remote request', async () => {
    await expect(run('online', [])).rejects.toMatchObject({
      isCliError: true,
      code: 'APP_LIFECYCLE_USAGE',
    });
    await expect(run('offline', ['--help'])).resolves.toMatchObject({ help: true });

    expect(createAuthRef).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('request path encodes appType and rejects unsupported actions', () => {
    expect(buildRequestPath('online', 'APP/unsafe', 123))
      .toBe('/dingtalk/web/APP%2Funsafe/query/app/onlineApp.json?_api=App.goOnline&_mock=false&_stamp=123');
    expect(() => buildRequestPath('delete', 'APP_1', 123)).toThrow('delete');
  });
});
