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

jest.mock('../lib/core/i18n', () => {
  const i18n = jest.requireActual('../lib/core/i18n');
  i18n.setLanguage('zh');
  return { t: i18n.t };
});

const utils = require('../lib/core/utils');
const {
  run,
  buildDataPermit,
  validateDataPermission,
  validateMatrix,
} = require('../lib/permission/save-permission');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

const customFieldPermit = {
  fieldRange: 'CUSTOM',
  fieldStatus: [{
    label: '客户名称',
    fieldName: 'textField_a',
    componentName: 'TextField',
    value: 'FORM_FIELD_VIEW',
  }],
};

function listResult(packages) {
  return { success: true, content: { formPermit: packages } };
}

function packageFromLastWrite(packageUuid) {
  const call = utils.httpPost.mock.calls[utils.httpPost.mock.calls.length - 1];
  if (!call) {
    return null;
  }
  const permitPackage = { ...querystring.parse(call[2]) };
  if (packageUuid !== undefined) {
    permitPackage.packageUuid = packageUuid;
  }
  return permitPackage;
}

function mockCreateReadback(packageUuid) {
  utils.httpGet
    .mockResolvedValueOnce(listResult([]))
    .mockImplementation(async () => listResult([packageFromLastWrite(packageUuid)]));
}

describe('save-permission command', () => {
  let mockLog;
  let mockError;
  let mockStderrWrite;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.httpGet.mockReset();
    utils.httpPost.mockReset();
    utils.httpGet.mockImplementation(async () => {
      const permitPackage = packageFromLastWrite();
      return listResult(permitPackage ? [permitPackage] : []);
    });
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
              roleData: '{"include":[{"roleType":"DEFAULT","roleValue":"ALL"}]}',
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
      JSON.stringify({ role: 'DEFAULT', ...customFieldPermit }),
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body).toMatchObject({
      formUuid: 'FORM-1',
      packageUuid: 'pkg-1',
      fieldPermit: JSON.stringify(customFieldPermit),
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
    mockCreateReadback('pkg-new');
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
      JSON.stringify(customFieldPermit),
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.packageUuid).toBeUndefined();
    expect(body).toMatchObject({
      formUuid: 'FORM-1',
      fieldPermit: JSON.stringify(customFieldPermit),
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

  test('creates an all-members group when --all-members is provided', async () => {
    mockCreateReadback('pkg-all');
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: 'pkg-all',
    });

    await run([
      'APP-1',
      'FORM-1',
      '--create',
      '--name',
      '全部人员看全部数据',
      '--all-members',
      '--data-permission',
      '{"dataRange":"ALL"}',
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.packageUuid).toBeUndefined();
    expect(body).toMatchObject({
      formUuid: 'FORM-1',
      dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
      operatePermit: '{"OPERATE_VIEW":"y"}',
      fieldPermit: '{"fieldRange":"FORM"}',
    });
    expect(JSON.parse(body.roleData)).toEqual({
      include: [{ roleType: 'DEFAULT', roleValue: 'ALL' }],
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-all',
      summary: {
        name: '全部人员看全部数据',
        dataPermission: '数据范围: ALL',
      },
      message: '权限组已新增',
    });
  });

  test('updates existing package to all-members when --all-members is provided', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          formPermit: [
            {
              packageUuid: 'pkg-1',
              packageName: { zh_CN: '默认组' },
              roleMembers: [{ roleType: 'DEFAULT' }],
              roleData: '{"include":[{"roleType":"DEFAULT","roleValue":"ALL"}]}',
              dataPermit: '{"rule":[{"type":"SELF","value":"y"}]}',
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
      '--all-members',
      '--data-permission',
      '{"dataRange":"ALL"}',
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body).toMatchObject({
      formUuid: 'FORM-1',
      packageUuid: 'pkg-1',
      dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
    });
    expect(JSON.parse(body.roleData)).toEqual({
      include: [{ roleType: 'DEFAULT', roleValue: 'ALL' }],
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      summary: {
        dataPermission: '数据范围: ALL',
      },
      message: '权限配置已保存',
    });
  });

  test('creates a manager+persons group when --members is provided', async () => {
    mockCreateReadback('pkg-persons');
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: 'pkg-persons',
    });

    await run([
      'APP-1',
      'FORM-1',
      '--create',
      '--name',
      '指定人员组',
      '--members',
      'user1,user2',
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(JSON.parse(body.roleData)).toEqual({
      include: [
        { roleType: 'MANAGER', roleValue: 'appMainAdminRole,corpAdminRole' },
        { roleType: 'PERSONS', roleValue: 'user1,user2' },
      ],
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-persons',
      summary: {
        name: '指定人员组',
        members: '成员: user1, user2',
      },
      message: '权限组已新增',
    });
  });

  test('creates a permission group with complex data-permit rules', async () => {
    mockCreateReadback('pkg-complex');
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: 'pkg-complex',
    });

    const complexDataPermission = {
      rule: [
        { type: 'ORIGINATOR', value: 'y' },
        { type: 'ORIGINATOR_DEPARTMENT', value: 'y' },
        { type: 'CUSTOM_DEPARTMENT', value: 'y' },
      ],
      customDepartmentData: {
        departmentIds: ['637215248'],
        drillDown: 'n',
      },
    };

    await run([
      'APP-1',
      'FORM-1',
      '--create',
      '--name',
      '复杂数据权限组',
      '--all-members',
      '--data-permission',
      JSON.stringify(complexDataPermission),
      '--action-permission',
      '{"operations":{"OPERATE_VIEW":true,"OPERATE_EDIT":true}}',
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.packageUuid).toBeUndefined();
    expect(JSON.parse(body.dataPermit)).toEqual(complexDataPermission);
    expect(JSON.parse(body.roleData)).toEqual({
      include: [{ roleType: 'DEFAULT', roleValue: 'ALL' }],
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-complex',
      summary: {
        name: '复杂数据权限组',
        dataPermission: '数据范围: 自定义规则（3 条）',
      },
      message: '权限组已新增',
    });
  });

  test('creates a permission group with matrix member', async () => {
    mockCreateReadback('pkg-matrix');
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: 'pkg-matrix',
    });

    await run([
      'APP-1',
      'FORM-1',
      '--create',
      '--name',
      '使用权限矩阵的权限组',
      '--matrix',
      '{"matrixId":"MATRIX-XNCVJYB60YW7L0HPY9HE","columnId":"column_1767839664612"}',
      '--data-permission',
      '{"rule":[{"type":"ORIGINATOR","value":"y"},{"type":"MATRIX","value":"y"}]}',
      '--action-permission',
      '{"operations":{"OPERATE_VIEW":true,"OPERATE_EDIT":true}}',
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.packageUuid).toBeUndefined();
    expect(JSON.parse(body.dataPermit)).toEqual({
      rule: [
        { type: 'ORIGINATOR', value: 'y' },
        { type: 'MATRIX', value: 'y' },
      ],
    });
    expect(JSON.parse(body.roleData)).toEqual({
      include: [{
        roleType: 'MATRIX',
        roleValue: [{ matrixId: 'MATRIX-XNCVJYB60YW7L0HPY9HE', columnId: 'column_1767839664612' }],
      }],
    });
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-matrix',
      summary: {
        name: '使用权限矩阵的权限组',
        members: '权限矩阵: MATRIX-XNCVJYB60YW7L0HPY9HE / column_1767839664612',
      },
      message: '权限组已新增',
    });
  });

  test('updates existing matrix package when --matrix is provided', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          formPermit: [
            {
              packageUuid: 'pkg-matrix-old',
              packageName: { zh_CN: '旧矩阵组' },
              roleMembers: [{ roleType: 'MATRIX' }],
              roleData: JSON.stringify({
                include: [{ roleType: 'MATRIX', roleValue: [{ matrixId: 'OLD', columnId: 'OLD' }] }],
              }),
              dataPermit: '{"rule":[{"type":"MATRIX","value":"y"}]}',
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
      '--matrix',
      '{"matrixId":"MATRIX-XNCVJYB60YW7L0HPY9HE","columnId":"column_1767839664612"}',
      '--data-permission',
      '{"rule":[{"type":"ORIGINATOR","value":"y"},{"type":"MATRIX","value":"y"}]}',
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.packageUuid).toBe('pkg-matrix-old');
    expect(JSON.parse(body.roleData)).toEqual({
      include: [{
        roleType: 'MATRIX',
        roleValue: [{ matrixId: 'MATRIX-XNCVJYB60YW7L0HPY9HE', columnId: 'column_1767839664612' }],
      }],
    });
    expect(JSON.parse(body.dataPermit)).toEqual({
      rule: [
        { type: 'ORIGINATOR', value: 'y' },
        { type: 'MATRIX', value: 'y' },
      ],
    });
  });

  test('rejects mixing --matrix with --members or --all-members', async () => {
    let error;
    try {
      await run([
        'APP-1',
        'FORM-1',
        '--create',
        '--name',
        '冲突组',
        '--matrix',
        '{"matrixId":"MATRIX-1","columnId":"col-1"}',
        '--members',
        'user1',
      ]);
    } catch (err) {
      error = err;
    }

    expect(error).toBeTruthy();
    expect(error.isCliError).toBe(true);
    expect(error.code).toBe('SAVE_PERMISSION_INVALID_ARGUMENTS');
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('rejects an unsupported target role before any network request', async () => {
    await expect(run([
      'APP-1',
      'FORM-1',
      '--data-permission',
      '{"role":"PERSONS","dataRange":"ALL"}',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
    });
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('writes nothing when a role matches multiple permission groups and lists candidates', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [
          {
            packageUuid: 'pkg-a',
            packageName: { zh_CN: '默认组 A' },
            roleMembers: [{ roleType: 'DEFAULT' }],
          },
          {
            packageUuid: 'pkg-b',
            packageName: { zh_CN: '默认组 B' },
            roleMembers: [{ roleType: 'DEFAULT' }],
          },
        ],
      },
    });

    let error;
    try {
      await run(['APP-1', 'FORM-1', '--data-permission', '{"dataRange":"ALL"}']);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_AMBIGUOUS_PACKAGE',
    });
    expect(error.message).toContain('默认组 A (pkg-a)');
    expect(error.message).toContain('默认组 B (pkg-b)');
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('writes nothing when a role matches no permission group and lists available groups', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [{
          packageUuid: 'pkg-default',
          packageName: { zh_CN: '默认组' },
          roleMembers: [{ roleType: 'DEFAULT' }],
        }],
      },
    });

    await expect(run([
      'APP-1',
      'FORM-1',
      '--data-permission',
      '{"role":"MANAGER","dataRange":"ALL"}',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_NO_MATCHING_PACKAGE',
      message: expect.stringContaining('默认组 (pkg-default)'),
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('continues to the next page before proving role uniqueness', async () => {
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: {
          formPermit: Array.from({ length: 20 }, (_item, index) => ({
            packageUuid: `pkg-${index + 1}`,
            packageName: { zh_CN: `权限组 ${index + 1}` },
            roleMembers: [{ roleType: index === 0 ? 'DEFAULT' : 'MANAGER' }],
            roleData: JSON.stringify({
              include: [{
                roleType: index === 0 ? 'DEFAULT' : 'MANAGER',
                roleValue: index === 0 ? 'ALL' : 'appMainAdminRole',
              }],
            }),
            dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
            operatePermit: '{"OPERATE_VIEW":"y"}',
            fieldPermit: '{"fieldRange":"FORM"}',
          })),
        },
      })
      .mockResolvedValueOnce(listResult([]));
    utils.httpPost.mockResolvedValueOnce({ success: true });

    const output = await run([
      'APP-1',
      'FORM-1',
      '--data-permission',
      '{"role":"DEFAULT","dataRange":"ALL"}',
    ]);

    expect(output).toMatchObject({ success: true, packageUuid: 'pkg-1' });
    expect(utils.httpGet).toHaveBeenCalledTimes(3);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({ pageIndex: '2' });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('blocks action replacement when the current package has unknown operation keys', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [{
          packageUuid: 'pkg-unknown-action',
          packageName: { zh_CN: '含新操作的权限组' },
          roleMembers: [{ roleType: 'DEFAULT' }],
          roleData: '{"include":[{"roleType":"DEFAULT","roleValue":"ALL"}]}',
          dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
          operatePermit: '{"OPERATE_VIEW":"y","OPERATE_FUTURE":"y"}',
          fieldPermit: '{"fieldRange":"FORM"}',
        }],
      },
    });

    await expect(run([
      'APP-1',
      'FORM-1',
      '--action-permission',
      '{"operations":{"OPERATE_VIEW":true}}',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_UNKNOWN_OPERATE_KEYS',
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('preserves unknown operation keys verbatim when another dimension changes', async () => {
    const roleData = '{"include":[{"roleType":"DEFAULT","roleValue":"ALL"}]}';
    const operatePermit = '{"OPERATE_VIEW":"y","OPERATE_FUTURE":"y"}';
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [{
          packageUuid: 'pkg-preserve-action',
          packageName: { zh_CN: '保留新操作' },
          roleMembers: [{ roleType: 'DEFAULT' }],
          roleData,
          dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
          operatePermit,
          fieldPermit: '{"fieldRange":"FORM"}',
        }],
      },
    });
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await run([
      'APP-1',
      'FORM-1',
      '--field-permission',
      '{"role":"DEFAULT","fieldRange":"FORM"}',
    ]);

    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(body.operatePermit).toBe(operatePermit);
    expect(body.roleData).toBe(roleData);
  });

  test.each([
    ['empty operation set', ['--action-permission', '{"operations":{}}'], '操作权限至少需要一个'],
    ['empty data range', ['--data-permission', '{"rule":[]}'], 'rule 不能为空'],
    [
      'custom department without ids',
      ['--data-permission', '{"rule":[{"type":"CUSTOM_DEPARTMENT","value":"y"}]}'],
      'departmentIds',
    ],
    [
      'formula without formulaData',
      ['--data-permission', '{"rule":[{"type":"FORMULA","value":"y"}]}'],
      'formulaData',
    ],
  ])('rejects %s before remote writes', async (_label, permissionArgs, message) => {
    await expect(run(['APP-1', 'FORM-1', ...permissionArgs])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_INVALID_ARGUMENTS',
      message: expect.stringContaining(message),
    });
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('requires explicit confirmation before all-members replaces composite roleData', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [{
          packageUuid: 'pkg-composite',
          packageName: { zh_CN: '复合成员组' },
          roleMembers: [{ roleType: 'DEFAULT' }],
          roleData: JSON.stringify({
            include: [
              { roleType: 'DEFAULT', roleValue: 'ALL' },
              { roleType: 'MANAGER', roleValue: 'appMainAdminRole' },
              { roleType: 'DEPARTMENT', roleValue: 'dept-1' },
            ],
          }),
          dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
          operatePermit: '{"OPERATE_VIEW":"y"}',
          fieldPermit: '{"fieldRange":"FORM"}',
        }],
      },
    });

    await expect(run(['APP-1', 'FORM-1', '--all-members'])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_MEMBER_REPLACE_CONFIRM_REQUIRED',
      message: expect.stringContaining('DEPARTMENT'),
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('replaces composite roleData only after explicit member confirmation', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [{
          packageUuid: 'pkg-composite',
          packageName: { zh_CN: '复合成员组' },
          roleMembers: [{ roleType: 'DEFAULT' }],
          roleData: JSON.stringify({
            include: [
              { roleType: 'DEFAULT', roleValue: 'ALL' },
              { roleType: 'MANAGER', roleValue: 'appMainAdminRole' },
            ],
          }),
          dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
          operatePermit: '{"OPERATE_VIEW":"y"}',
          fieldPermit: '{"fieldRange":"FORM"}',
        }],
      },
    });
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await run(['APP-1', 'FORM-1', '--all-members', '--confirm-member-replace']);

    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(JSON.parse(body.roleData)).toEqual({
      include: [{ roleType: 'DEFAULT', roleValue: 'ALL' }],
    });
  });

  test('members replacement preserves non-PERSONS role entries', async () => {
    const existingRoleData = {
      include: [
        { roleType: 'MANAGER', roleValue: 'appMainAdminRole' },
        { roleType: 'DEPARTMENT', roleValue: 'dept-1' },
        { roleType: 'ROLE', roleValue: 'role-1' },
        { roleType: 'PARAM', roleValue: 'param-1' },
        { roleType: 'PERSONS', roleValue: 'old-user' },
      ],
    };
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        formPermit: [{
          packageUuid: 'pkg-manager',
          packageName: { zh_CN: '管理员复合组' },
          roleMembers: [{ roleType: 'MANAGER' }],
          roleData: JSON.stringify(existingRoleData),
          dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
          operatePermit: '{"OPERATE_VIEW":"y"}',
          fieldPermit: '{"fieldRange":"FORM"}',
        }],
      },
    });
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await run([
      'APP-1',
      'FORM-1',
      '--members',
      'new-user',
      '--data-permission',
      '{"role":"MANAGER","dataRange":"ALL"}',
    ]);

    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(JSON.parse(body.roleData)).toEqual({
      include: [
        ...existingRoleData.include.slice(0, 4),
        { roleType: 'PERSONS', roleValue: 'new-user' },
      ],
    });
  });

  test('rejects matrix membership whose data permission omits MATRIX', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await expect(run([
      'APP-1',
      'FORM-1',
      '--create',
      '--name',
      '无矩阵数据范围',
      '--matrix',
      '{"matrixId":"MATRIX-1","columnId":"column-1"}',
      '--data-permission',
      '{"dataRange":"ALL"}',
    ])).rejects.toThrow('数据权限 rule 必须包含 MATRIX');
    expect(utils.httpPost).not.toHaveBeenCalled();
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

describe('buildDataPermit', () => {
  test('maps simple dataRange to single rule', () => {
    expect(JSON.parse(buildDataPermit({ dataRange: 'ALL' }))).toEqual({
      rule: [{ type: 'ALL', value: 'y' }],
    });
    expect(JSON.parse(buildDataPermit({ dataRange: 'SELF' }))).toEqual({
      rule: [{ type: 'ORIGINATOR', value: 'y' }],
    });
  });

  test('defaults to ALL when dataPermission is empty', () => {
    expect(JSON.parse(buildDataPermit(null))).toEqual({
      rule: [{ type: 'ALL', value: 'y' }],
    });
  });

  test('passes through complex permission payload with rule array', () => {
    const complex = {
      rule: [
        { type: 'ORIGINATOR', value: 'y' },
        { type: 'ORIGINATOR_DEPARTMENT', value: 'y' },
      ],
      customDepartmentData: {
        departmentIds: ['637215248'],
        drillDown: 'n',
      },
      formulaData: {
        condition: 'OR',
        rules: [],
      },
    };
    expect(JSON.parse(buildDataPermit(complex))).toEqual(complex);
  });

  test('removes target role from the persisted dataPermit payload', () => {
    expect(JSON.parse(buildDataPermit({
      role: 'MANAGER',
      rule: [{ type: 'ALL', value: 'y' }],
    }))).toEqual({
      rule: [{ type: 'ALL', value: 'y' }],
    });
  });

  test('keeps supporting data for simple custom department and formula ranges', () => {
    expect(JSON.parse(buildDataPermit({
      dataRange: 'CUSTOM_DEPARTMENT',
      customDepartmentData: { departmentIds: ['dept-1'] },
    }))).toEqual({
      rule: [{ type: 'CUSTOM_DEPARTMENT', value: 'y' }],
      customDepartmentData: { departmentIds: ['dept-1'] },
    });
    expect(JSON.parse(buildDataPermit({
      dataRange: 'FORMULA',
      formulaData: { condition: 'OR', rules: [] },
    }))).toEqual({
      rule: [{ type: 'FORMULA', value: 'y' }],
      formulaData: { condition: 'OR', rules: [] },
    });
  });
});

describe('validateDataPermission', () => {
  test('accepts the platform data types and rejects aliases inside raw rules', () => {
    expect(() => validateDataPermission({
      rule: [{ type: 'SUBORDINATE', value: 'y' }],
    })).not.toThrow();
    expect(() => validateDataPermission({
      rule: [{ type: 'SELF', value: 'y' }],
    })).toThrow('无效的 rule type');
  });

  test('requires supporting data for simple custom ranges', () => {
    expect(() => validateDataPermission({ dataRange: 'CUSTOM_DEPARTMENT' })).toThrow('departmentIds');
    expect(() => validateDataPermission({ dataRange: 'CUSTOM' })).toThrow('formulaData');
  });
});

describe('validateMatrix', () => {
  test('accepts valid matrix object', () => {
    expect(() => validateMatrix({ matrixId: 'MATRIX-1', columnId: 'col-1' })).not.toThrow();
  });

  test('rejects missing matrixId', () => {
    expect(() => validateMatrix({ columnId: 'col-1' })).toThrow('matrixId');
  });

  test('rejects missing columnId', () => {
    expect(() => validateMatrix({ matrixId: 'MATRIX-1' })).toThrow('columnId');
  });
});
