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

jest.mock('../lib/core/i18n', () => {
  const i18n = jest.requireActual('../lib/core/i18n');
  i18n.setLanguage('zh');
  return { t: i18n.t };
});

const utils = require('../lib/core/utils');
const {
  buildSubAdminConfig,
  listAdmins,
  searchUsers,
  saveAdmin,
  getAddressBookVisible,
  saveAddressBookVisible,
} = require('../lib/corp-manager/api');
const { run, sameStringSet } = require('../lib/corp-manager/corp-manager');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.httpGet.mockReset();
  utils.httpPost.mockReset();
  utils.loadAuthData.mockReturnValue(mockAuthData);
});

describe('corp-manager api', () => {
  test('sub-admin scope comparison uses set semantics', () => {
    expect(sameStringSet(['dept-2', 'dept-1', 'dept-1'], ['dept-1', 'dept-2'])).toBe(true);
    expect(sameStringSet(['appManage'], ['bulletinBoard'])).toBe(false);
  });

  test('searchUsers normalizes same-name employees and supports department filtering', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        values: [
          {
            id: 'u1',
            name: '余浩',
            deptDesc: '宜搭体验中心组织',
            depts: [{ id: 'd1', deptPathName: '宜搭体验中心组织' }],
          },
          {
            id: 'u2',
            name: '余浩',
            deptDesc: '宜搭,钉钉官方同学',
            depts: [{ id: '848712658', deptPathName: '宜搭,钉钉官方同学' }],
          },
        ],
      },
    });

    const result = await searchUsers({ keyword: '余浩', dept: '钉钉官方同学' });

    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/query/userservice/searchUsersOrDepts.json',
      expect.objectContaining({ key: '余浩', option: 'employee' }),
    );
    expect(result.users).toEqual([
      expect.objectContaining({
        userId: 'u2',
        userName: '余浩',
        departmentNamePath: '宜搭,钉钉官方同学',
        departmentIds: ['848712658'],
      }),
    ]);
  });

  test('listAdmins maps role aliases and normalizes admin rows', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: {
        currentPage: 1,
        totalCount: 1,
        values: [{
          userId: 'u1',
          userName: { zh_CN: '余浩' },
          departmentNamePath: '钉钉官方同学',
          roleType: 'applicationCreateRole',
        }],
      },
    });

    const result = await listAdmins({ role: 'app', userId: 'u1' });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(body).toMatchObject({
      roleType: 'applicationCreateRole',
      adminWorkNos: 'u1',
    });
    expect(result.admins[0]).toMatchObject({
      userId: 'u1',
      userName: '余浩',
      roleLabel: '应用管理员',
    });
  });

  test('saveAdmin sends sub-admin deptList as id strings', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    const result = await saveAdmin({
      role: 'sub',
      userId: '014734242419657712',
      deptIds: ['848712658'],
      scenes: ['appManage', 'bulletinBoard'],
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    const config = JSON.parse(body.config);

    expect(result).toMatchObject({
      success: true,
      roleType: 'subCorpAdminRole',
      userId: '014734242419657712',
    });
    expect(config).toEqual({
      deptList: ['848712658'],
      scene: ['appManage', 'bulletinBoard'],
    });
  });

  test('buildSubAdminConfig requires department ids', () => {
    expect(() => buildSubAdminConfig({ deptIds: [] })).toThrow('--dept-ids');
  });

  test('address book set preserves omitted visibility flags', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: { isAllVisible: 'n', isAdminVisible: 'n' },
      })
      .mockResolvedValueOnce({
        success: true,
        content: { isAllVisible: 'n', isAdminVisible: 'y' },
      });
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    const result = await saveAddressBookVisible({ adminVisible: 'y' });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(body).toMatchObject({
      isAllVisible: 'n',
      isAdminVisible: 'y',
    });
    expect(result).toMatchObject({
      isAllVisible: 'n',
      isAdminVisible: 'y',
      before: { isAllVisible: 'n', isAdminVisible: 'n' },
      after: { isAllVisible: 'n', isAdminVisible: 'y' },
    });
  });

  test('address book set fails when readback differs from the requested values', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: { isAllVisible: 'n', isAdminVisible: 'n' },
      })
      .mockResolvedValueOnce({
        success: true,
        content: { isAllVisible: 'n', isAdminVisible: 'n' },
      });
    utils.httpPost.mockResolvedValueOnce({ success: true, content: {} });

    await expect(saveAddressBookVisible({ adminVisible: 'y' })).rejects.toThrow('验证失败');
  });

  test('getAddressBookVisible normalizes empty response defaults', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: true, content: {} });

    await expect(getAddressBookVisible()).resolves.toMatchObject({
      isAllVisible: 'n',
      isAdminVisible: 'n',
    });
  });

  test('corp-manager add queries before and verifies the saved role', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: { currentPage: 1, totalCount: 0, values: [] },
      })
      .mockResolvedValueOnce({ success: true, content: {} })
      .mockResolvedValueOnce({
        success: true,
        content: {
          currentPage: 1,
          totalCount: 1,
          values: [{ userId: 'u1', roleType: 'applicationCreateRole' }],
        },
      });

    try {
      await run(['add', 'app', '--user', 'u1']);
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output).toMatchObject({
        success: true,
        userId: 'u1',
        before: { totalCount: 0 },
        after: {
          totalCount: 1,
          admins: [{ userId: 'u1' }],
        },
      });
      expect(utils.httpPost).toHaveBeenCalledTimes(3);
    } finally {
      logSpy.mockRestore();
    }
  });

  test('corp-manager sub add fails closed when department or scene readback differs', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: { currentPage: 1, totalCount: 0, values: [] },
      })
      .mockResolvedValueOnce({ success: true, content: {} })
      .mockResolvedValueOnce({
        success: true,
        content: {
          currentPage: 1,
          totalCount: 1,
          values: [{
            userId: 'u1',
            roleType: 'subCorpAdminRole',
            manageDeptIds: ['dept-other'],
            manageScene: ['appManage'],
          }],
        },
      });

    try {
      await expect(run([
        'add',
        'sub',
        '--user',
        'u1',
        '--dept-ids',
        'dept-1,dept-2',
        '--scenes',
        'bulletinBoard,appManage',
      ])).rejects.toThrow('范围验证失败');
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
