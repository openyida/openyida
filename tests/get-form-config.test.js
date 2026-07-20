'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const getFormConfig = require('../lib/app/get-form-config');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
  csrf_token: 'tok123',
};

let logSpy;

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  jest.restoreAllMocks();
});

describe('get-form-config parseArgs', () => {
  test('parses appType, formUuid and defaults json to false', () => {
    expect(getFormConfig.parseArgs(['APP_X', 'FORM_Y'])).toEqual({
      appType: 'APP_X',
      formUuid: 'FORM_Y',
      json: false,
    });
  });

  test('recognizes --json flag regardless of position', () => {
    expect(getFormConfig.parseArgs(['APP_X', '--json', 'FORM_Y'])).toEqual({
      appType: 'APP_X',
      formUuid: 'FORM_Y',
      json: true,
    });
  });

  test('only captures the first non-flag arg as formUuid', () => {
    const parsed = getFormConfig.parseArgs(['APP_X', 'FORM_Y', 'EXTRA']);
    expect(parsed.formUuid).toBe('FORM_Y');
  });
});

describe('get-form-config extractTitle', () => {
  test('returns empty string when falsy', () => {
    expect(getFormConfig.extractTitle(null)).toBe('');
    expect(getFormConfig.extractTitle(undefined)).toBe('');
  });

  test('returns plain string as-is', () => {
    expect(getFormConfig.extractTitle('订单表')).toBe('订单表');
  });

  test('prefers zh_CN then en_US from i18n object', () => {
    expect(getFormConfig.extractTitle({ zh_CN: '订单', en_US: 'Order' })).toBe('订单');
    expect(getFormConfig.extractTitle({ en_US: 'Order' })).toBe('Order');
  });
});

describe('get-form-config fetchFormSchemaInfo', () => {
  test('posts Form.getFormSchemaInfo to the correct endpoint', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: {} });
    const authRef = { baseUrl: 'https://www.aliwork.com', csrfToken: 'tok123' };
    await getFormConfig.fetchFormSchemaInfo(authRef, 'APP_X', 'FORM_Y');

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const [baseUrl, requestPath, body] = utils.httpPost.mock.calls[0];
    expect(baseUrl).toBe('https://www.aliwork.com');
    expect(requestPath).toBe('/dingtalk/web/APP_X/query/formdesign/getFormSchemaInfo.json');
    const parsed = querystring.parse(body);
    expect(parsed._api).toBe('Form.getFormSchemaInfo');
    expect(parsed.formUuid).toBe('FORM_Y');
  });
});

describe('get-form-config run', () => {
  test('prints a summary with whitelisted fields by default', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
      content: {
        title: { zh_CN: '订单表', en_US: 'Order' },
        isRenderNav: 'false',
        submissionRule: 'RESUBMIT',
        secret: 'hidden',
      },
    });

    await getFormConfig.run(['APP_X', 'FORM_Y']);

    const payload = JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0]);
    expect(payload).toMatchObject({
      success: true,
      appType: 'APP_X',
      formUuid: 'FORM_Y',
      title: '订单表',
      isRenderNav: 'false',
      submissionRule: 'RESUBMIT',
    });
    expect(payload.secret).toBeUndefined();
  });

  test('prints the full config object when --json is passed', async () => {
    const content = { title: 'X', isRenderNav: 'true', secret: 'kept' };
    utils.httpPost.mockResolvedValue({ success: true, content });

    await getFormConfig.run(['APP_X', 'FORM_Y', '--json']);

    const payload = JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0]);
    expect(payload.success).toBe(true);
    expect(payload.config).toEqual(content);
  });

  test('reports failure and throws CliError when the API returns success:false', async () => {
    utils.httpPost.mockResolvedValue({ success: false, errorMsg: 'boom' });

    await expect(getFormConfig.run(['APP_X', 'FORM_Y'])).rejects.toThrow('boom');

    const payloads = logSpy.mock.calls
      .map((call) => {
        try {
          return JSON.parse(call[0]);
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean);
    const failurePayload = payloads.find((payload) => payload.success === false);
    expect(failurePayload).toBeDefined();
  });
});
