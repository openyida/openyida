'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/core/i18n', () => ({
  t: jest.fn((key, ...args) => args.length ? `${key}: ${args.join(', ')}` : key),
}));

const utils = require('../lib/core/utils');
const { run } = require('../lib/permission/get-permission');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

describe('get-permission command regression', () => {
  let mockLog;
  let mockError;
  let mockStderrWrite;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue(mockAuthData);
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
    utils.httpGet.mockResolvedValue({ success: true, content: { formPermit: [] } });
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
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [
          {
            packageUuid: 'pkg-1',
            packageName: { zh_CN: '管理员' },
            description: { zh_CN: '管理权限' },
            packageType: 'FORM_PACKAGE_VIEW',
            roleMembers: [{ roleType: 'MANAGER', label: 'Ada', roleValue: 'u1' }],
            roleData: '{"include":[{"roleType":"MANAGER","roleValue":"u1"}]}',
            dataPermit: '{"scope":"all"}',
            operatePermit: { submit: true },
            fieldPermit: 'not-json',
          },
        ],
      },
    });

    await run(['APP-1', 'FORM-1']);

    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/APP-1/permission/manage/listPermitPackages.json',
      expect.objectContaining({
        _api: 'Permission.getPermitGroupList',
        formUuid: 'FORM-1',
        appType: 'APP-1',
      })
    );
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      totalPackages: 1,
      query: {
        packageType: 'FORM_PACKAGE_VIEW',
        pageIndex: 1,
        pageSize: 20,
        returned: 1,
        mayHaveMore: false,
      },
      message: 'permission_list.query_success_message',
    });
    expect(output.permissions[0]).toMatchObject({
      packageUuid: 'pkg-1',
      packageName: '管理员',
      description: '管理权限',
      roleData: {
        include: [{ roleType: 'MANAGER', roleValue: 'u1' }],
      },
      dataPermit: { scope: 'all' },
      operatePermit: { submit: true },
      fieldPermit: {},
    });
  });

  test('safely paginates and filters by exact package UUID', async () => {
    const firstPage = Array.from({ length: 20 }, (_item, index) => ({
      packageUuid: `pkg-${index + 1}`,
      packageName: { zh_CN: `组 ${index + 1}` },
    }));
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { formPermit: firstPage } })
      .mockResolvedValueOnce({
        success: true,
        content: {
          formPermit: [{ packageUuid: 'pkg-21', packageName: { zh_CN: '目标组' } }],
        },
      });

    const output = await run(['APP-1', 'FORM-1', '--package-uuid', 'pkg-21']);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({ pageIndex: '2', pageSize: '20' });
    expect(output).toMatchObject({
      success: true,
      totalPackages: 1,
      query: {
        packageUuid: 'pkg-21',
        pagesFetched: 2,
        totalFetched: 21,
        complete: true,
      },
      permissions: [{ packageUuid: 'pkg-21', packageName: '目标组' }],
    });
  });

  test('missing login cache triggers login before requestWithAutoLogin', async () => {
    utils.loadAuthData.mockReturnValueOnce(null);
    utils.triggerLogin.mockReturnValueOnce(mockAuthData);

    await run(['APP-1', 'FORM-1']);

    expect(utils.triggerLogin).toHaveBeenCalledTimes(1);
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
  });

  test('API failure rejects with CliError', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: false,
      errorMsg: 'permission denied',
      errorCode: '403',
    });

    let error;
    try {
      await run(['APP-1', 'FORM-1']);
    } catch (err) {
      error = err;
    }
    expect(error).toBeTruthy();
    expect(error.isCliError).toBe(true);
    expect(error.code).toBe('GET_PERMISSION_FAILED');
    expect(error.message).toBe('permission denied');
    expect(mockLog).not.toHaveBeenCalled();
  });
});
