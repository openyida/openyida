'use strict';

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/core/i18n', () => ({
  t: jest.fn((key, ...args) => args.length ? `${key}: ${args.join(', ')}` : key),
}));

const utils = require('../lib/core/utils');
const { run } = require('../lib/permission/get-permission');

const mockCookieData = {
  csrf_token: 'csrf',
  cookies: [{ name: 'tianshu_csrf_token', value: 'csrf' }],
};

describe('get-permission command regression', () => {
  let mockLog;
  let mockError;
  let mockStderrWrite;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadCookieData.mockReturnValue(mockCookieData);
    utils.requestWithAutoLogin.mockResolvedValue({ success: true, content: { formPermit: [] } });
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockStderrWrite.mockRestore();
  });

  test('successful query formats permission package payloads', async () => {
    utils.requestWithAutoLogin.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [
          {
            packageUuid: 'pkg-1',
            packageName: { zh_CN: '管理员' },
            description: { zh_CN: '管理权限' },
            packageType: 'FORM_PACKAGE_VIEW',
            roleMembers: [{ roleType: 'USER', label: 'Ada', roleValue: 'u1' }],
            dataPermit: '{"scope":"all"}',
            operatePermit: { submit: true },
            fieldPermit: 'not-json',
          },
        ],
      },
    });

    await run(['APP-1', 'FORM-1']);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      totalPackages: 1,
      message: '权限配置查询成功',
    });
    expect(output.permissions[0]).toMatchObject({
      packageUuid: 'pkg-1',
      packageName: '管理员',
      description: '管理权限',
      dataPermit: { scope: 'all' },
      operatePermit: { submit: true },
      fieldPermit: {},
    });
  });

  test('missing login cache triggers login before requestWithAutoLogin', async () => {
    utils.loadCookieData.mockReturnValueOnce(null);
    utils.triggerLogin.mockReturnValueOnce(mockCookieData);

    await run(['APP-1', 'FORM-1']);

    expect(utils.triggerLogin).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
  });

  test('API failure prints structured JSON and exits with code 1', async () => {
    utils.requestWithAutoLogin.mockResolvedValueOnce({
      success: false,
      errorMsg: 'permission denied',
      errorCode: '403',
    });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)');
    });

    await expect(run(['APP-1', 'FORM-1'])).rejects.toThrow('process.exit(1)');

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toEqual({
      success: false,
      message: 'permission denied',
      errorCode: '403',
    });
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
