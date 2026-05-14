'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadCookieData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  buildSubAdminConfig,
  listAdmins,
  searchUsers,
  saveAdmin,
  getAddressBookVisible,
  saveAddressBookVisible,
} = require('../lib/corp-manager/api');

const mockCookieData = {
  csrf_token: 'csrf',
  cookies: [{ name: 'tianshu_csrf_token', value: 'csrf' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadCookieData.mockReturnValue(mockCookieData);
});

describe('corp-manager api', () => {
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
      mockCookieData.cookies,
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
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: { isAllVisible: 'n', isAdminVisible: 'n' },
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
    });
  });

  test('getAddressBookVisible normalizes empty response defaults', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: true, content: {} });

    await expect(getAddressBookVisible()).resolves.toMatchObject({
      isAllVisible: 'n',
      isAdminVisible: 'n',
    });
  });
});
