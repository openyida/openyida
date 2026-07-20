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

jest.mock('../lib/core/i18n', () => ({
  t: jest.fn((key, ...args) => args.length ? `${key}: ${args.join(', ')}` : key),
}));

const utils = require('../lib/core/utils');
const { run } = require('../lib/permission/save-permission');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

describe('save-permission command', () => {
  let mockLog;
  let mockError;
  let mockStderrWrite;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue(mockAuthData);
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockStderrWrite.mockRestore();
  });

  test('updates field permissions without requiring data or action permissions', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          formPermit: [
            {
              packageUuid: 'pkg-1',
              packageName: { zh_CN: '默认组' },
              roleMembers: [{ roleType: 'DEFAULT' }],
              dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
              operatePermit: '{"OPERATE_VIEW":"y"}',
              fieldPermit: '{"fieldRange":"FORM"}',
            },
          ],
        },
      });
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await run([
      'APP-1',
      'FORM-1',
      '--field-permission',
      '{"role":"DEFAULT","fieldRange":"CUSTOM","fields":{"textField_a":"READONLY"}}',
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body).toMatchObject({
      formUuid: 'FORM-1',
      packageUuid: 'pkg-1',
      fieldPermit: '{"fieldRange":"CUSTOM","fields":{"textField_a":"READONLY"}}',
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      summary: {
        fieldPermission: '字段权限已更新',
      },
      message: '权限配置已保存',
    });
  });

  test('creates a permission group with custom fieldPermit payload', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: 'pkg-new',
    });

    await run([
      'APP-1',
      'FORM-1',
      '--create',
      '--name',
      '只读字段组',
      '--field-permission',
      '{"fieldRange":"CUSTOM","fields":{"textField_a":"READONLY"}}',
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.packageUuid).toBeUndefined();
    expect(body).toMatchObject({
      formUuid: 'FORM-1',
      fieldPermit: '{"fieldRange":"CUSTOM","fields":{"textField_a":"READONLY"}}',
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-new',
      summary: {
        name: '只读字段组',
        fieldPermission: '自定义 fieldPermit',
      },
      message: '权限组已新增',
    });
  });

  test('invalid JSON rejects with CliError instead of exiting', async () => {
    let error;
    try {
      await run(['APP-1', 'FORM-1', '--field-permission', 'not-json']);
    } catch (err) {
      error = err;
    }

    expect(error).toBeTruthy();
    expect(error.isCliError).toBe(true);
    expect(error.code).toBe('SAVE_PERMISSION_INVALID_ARGUMENTS');
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });
});
