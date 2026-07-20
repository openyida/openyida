'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  getAppPermission,
  saveRoleManagers,
  updateRoleManagers,
  normalizeRole,
  run,
} = require('../lib/app-permission/app-permission');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
});

describe('app-permission api', () => {
  test('getAppPermission normalizes app-level admin roles', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_1',
        appName: { zh_CN: '测试应用', en_US: 'Test App' },
        managerIdList: 'u1',
        managers: [{ userId: 'u1', name: '主管理员' }],
        dataManagerUserIdList: 'u2,u3',
        dataManagers: [{ userId: 'u2', displayName: '数据管理员' }],
        devManagers: [{ emplId: 'u4', defaultName: '开发成员' }],
        adminType: 'MAIN',
      },
    });

    const result = await getAppPermission('APP_1');

    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/APP_1/query/app/getAppIncludingAecpInfo.json',
      expect.objectContaining({ appKey: 'APP_1' }),
    );
    expect(result).toMatchObject({
      success: true,
      appType: 'APP_1',
      appName: '测试应用',
      currentUserAdminType: 'MAIN',
      roles: {
        main: { roleType: 'MAIN', userIds: ['u1'] },
        data: { roleType: 'DATA', userIds: ['u2', 'u3'] },
        dev: { roleType: 'DEV', userIds: ['u4'] },
      },
    });
  });

  test('saveRoleManagers maps role aliases and de-duplicates users', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: true });

    const result = await saveRoleManagers({
      appType: 'APP_1',
      role: 'developer',
      userIds: ['u1', 'u1', 'u2'],
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(utils.httpPost).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/APP_1/query/app/updateAppAdmin.json',
      expect.any(String),
    );
    expect(body).toMatchObject({
      adminType: 'DEV',
      managers: 'u1,u2',
    });
    expect(result).toMatchObject({
      success: true,
      role: 'dev',
      roleType: 'DEV',
      userIds: ['u1', 'u2'],
    });
  });

  test('updateRoleManagers add preserves existing users', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_1',
        dataManagerUserIdList: 'u1',
        dataManagers: [{ userId: 'u1', name: '已有成员' }],
      },
    });
    utils.httpPost.mockResolvedValueOnce({ success: true, content: true });

    const result = await updateRoleManagers({
      action: 'add',
      appType: 'APP_1',
      role: 'data',
      userIds: ['u2'],
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(body).toMatchObject({
      adminType: 'DATA',
      managers: 'u1,u2',
    });
    expect(result).toMatchObject({
      action: 'add',
      previousUserIds: ['u1'],
      userIds: ['u1', 'u2'],
    });
  });

  test('removing the last main admin is rejected', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        appType: 'APP_1',
        managerIdList: 'u1',
        managers: [{ userId: 'u1', name: '主管理员' }],
      },
    });

    await expect(updateRoleManagers({
      action: 'remove',
      appType: 'APP_1',
      role: 'main',
      userIds: ['u1'],
    })).rejects.toThrow('应用主管理员不能为空');

    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('normalizeRole rejects unknown roles', () => {
    expect(() => normalizeRole('platform')).toThrow('无效角色');
  });

  test('run reports usage errors without exiting the process', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    await expect(run(['set', 'APP_1', 'data'])).rejects.toMatchObject({
      isCliError: true,
      code: 'APP_PERMISSION_USAGE',
    });
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
