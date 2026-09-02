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
const { run } = require('../lib/permission/save-permission');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

function packageFixture(overrides = {}) {
  return {
    packageUuid: 'pkg-1',
    packageType: 'FORM_PACKAGE_VIEW',
    packageName: { zh_CN: '默认组', en_US: 'Default', type: 'i18n' },
    description: { zh_CN: '默认组', en_US: 'Default', type: 'i18n' },
    roleMembers: [{ roleType: 'DEFAULT' }],
    roleData: '{"include":[{"roleType":"DEFAULT","roleValue":"ALL"}]}',
    dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
    operatePermit: '{"OPERATE_VIEW":"y"}',
    customButtonPermit: '[]',
    fieldPermit: '{"fieldRange":"FORM"}',
    viewData: '{"all":"y","viewUuids":[]}',
    ...overrides,
  };
}

function listResult(packages) {
  return { success: true, content: { formPermit: packages } };
}

describe('save-permission exact readback', () => {
  let logSpy;
  let errorSpy;
  let stderrSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.httpGet.mockReset();
    utils.httpPost.mockReset();
    utils.loadAuthData.mockReturnValue(mockAuthData);
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  test('selects and verifies an update by exact --package-uuid', async () => {
    const pkgA = packageFixture({ packageUuid: 'pkg-a', packageName: { zh_CN: '默认组 A' } });
    const pkgB = packageFixture({ packageUuid: 'pkg-b', packageName: { zh_CN: '默认组 B' } });
    const afterB = packageFixture({
      ...pkgB,
      dataPermit: '{"rule":[{"value":"y","type":"ORIGINATOR"}]}',
    });
    utils.httpGet
      .mockResolvedValueOnce(listResult([pkgA, pkgB]))
      .mockResolvedValueOnce(listResult([pkgA, afterB]));
    utils.httpPost.mockResolvedValueOnce({ success: true });

    const output = await run([
      'APP-1',
      'FORM-1',
      '--package-uuid',
      'pkg-b',
      '--data-permission',
      '{"dataRange":"SELF"}',
    ]);

    expect(querystring.parse(utils.httpPost.mock.calls[0][2]).packageUuid).toBe('pkg-b');
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-b',
      verification: { status: 'verified' },
    });
  });

  test('reports verify failure after one update write when target and preserved dimensions drift', async () => {
    const before = packageFixture();
    const after = packageFixture({
      dataPermit: '{"rule":[{"type":"ALL","value":"y"}]}',
      operatePermit: '{"OPERATE_EDIT":"y"}',
    });
    utils.httpGet
      .mockResolvedValueOnce(listResult([before]))
      .mockResolvedValueOnce(listResult([after]));
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await expect(run([
      'APP-1',
      'FORM-1',
      '--package-uuid',
      'pkg-1',
      '--data-permission',
      '{"dataRange":"SELF"}',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_VERIFY_FAILED',
      details: {
        packageUuid: 'pkg-1',
        status: 'failed',
        mismatches: expect.arrayContaining([
          expect.objectContaining({ dimension: 'dataPermit', kind: 'target' }),
          expect.objectContaining({ dimension: 'operatePermit', kind: 'preserved' }),
        ]),
      },
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('reports unknown without replay when an updated package is absent from readback', async () => {
    utils.httpGet
      .mockResolvedValueOnce(listResult([packageFixture()]))
      .mockResolvedValueOnce(listResult([]));
    utils.httpPost.mockResolvedValueOnce({ success: true });

    await expect(run([
      'APP-1',
      'FORM-1',
      '--package-uuid',
      'pkg-1',
      '--field-permission',
      '{"fieldRange":"FORM"}',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_PERMISSION_VERIFY_UNKNOWN',
      details: {
        packageUuid: 'pkg-1',
        status: 'unknown',
        reason: 'package_uuid_not_found_after_write',
      },
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('create uses response UUID for exact canonical readback', async () => {
    const created = packageFixture({
      packageUuid: 'pkg-new',
      packageName: { zh_CN: '新组', en_US: '新组', type: 'i18n' },
      description: { zh_CN: '新组', en_US: '新组', type: 'i18n' },
      roleMembers: [{ roleType: 'MANAGER' }],
      roleData: '{"include":[{"roleType":"MANAGER","roleValue":"appMainAdminRole,corpAdminRole"}]}',
    });
    utils.httpGet
      .mockResolvedValueOnce(listResult([]))
      .mockResolvedValueOnce(listResult([created]));
    utils.httpPost.mockResolvedValueOnce({ success: true, content: { packageUuid: 'pkg-new' } });

    const output = await run(['APP-1', 'FORM-1', '--create', '--name', '新组']);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-new',
      verification: { status: 'verified', identitySource: 'response' },
    });
  });

  test('create recovers a unique owned package when the response omits UUID', async () => {
    const created = packageFixture({
      packageUuid: 'pkg-recovered',
      packageName: { zh_CN: '唯一新组', en_US: '唯一新组', type: 'i18n' },
      description: { zh_CN: '唯一新组', en_US: '唯一新组', type: 'i18n' },
      roleMembers: [{ roleType: 'MANAGER' }],
      roleData: '{"include":[{"roleType":"MANAGER","roleValue":"appMainAdminRole,corpAdminRole"}]}',
    });
    utils.httpGet
      .mockResolvedValueOnce(listResult([]))
      .mockResolvedValueOnce(listResult([created]));
    utils.httpPost.mockResolvedValueOnce({ success: true, content: null });

    const output = await run(['APP-1', 'FORM-1', '--create', '--name', '唯一新组']);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      success: true,
      packageUuid: 'pkg-recovered',
      verification: { status: 'verified', identitySource: 'owned-readback' },
    });
  });

  test('create reports unknown when owned readback is ambiguous and does not replay', async () => {
    const created = packageFixture({
      packageName: { zh_CN: '冲突新组', en_US: '冲突新组', type: 'i18n' },
      description: { zh_CN: '冲突新组', en_US: '冲突新组', type: 'i18n' },
      roleMembers: [{ roleType: 'MANAGER' }],
      roleData: '{"include":[{"roleType":"MANAGER","roleValue":"appMainAdminRole,corpAdminRole"}]}',
    });
    utils.httpGet
      .mockResolvedValueOnce(listResult([]))
      .mockResolvedValueOnce(listResult([
        { ...created, packageUuid: 'pkg-new-a' },
        { ...created, packageUuid: 'pkg-new-b' },
      ]));
    utils.httpPost.mockResolvedValueOnce({ success: true, content: null });

    await expect(run(['APP-1', 'FORM-1', '--create', '--name', '冲突新组']))
      .rejects.toMatchObject({
        isCliError: true,
        code: 'SAVE_PERMISSION_VERIFY_UNKNOWN',
        details: {
          status: 'unknown',
          reason: 'owned_readback_ambiguous',
          candidateUuids: ['pkg-new-a', 'pkg-new-b'],
        },
      });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('safe pagination reaches the exact package beyond page one', async () => {
    const pageOne = Array.from({ length: 20 }, (_item, index) => packageFixture({
      packageUuid: `pkg-${index + 1}`,
      packageName: { zh_CN: `组 ${index + 1}` },
      roleMembers: [{ roleType: 'MANAGER' }],
      roleData: '{"include":[{"roleType":"MANAGER","roleValue":"appMainAdminRole"}]}',
    }));
    const target = packageFixture({ packageUuid: 'pkg-21', packageName: { zh_CN: '目标组' } });
    const afterTarget = packageFixture({
      ...target,
      fieldPermit: '{"fieldRange":"CUSTOM","fieldStatus":[{"componentName":"TextField","fieldName":"text_a","label":"名称","value":"FORM_FIELD_VIEW"}]}',
    });
    utils.httpGet
      .mockResolvedValueOnce(listResult(pageOne))
      .mockResolvedValueOnce(listResult([target]))
      .mockResolvedValueOnce(listResult(pageOne))
      .mockResolvedValueOnce(listResult([afterTarget]));
    utils.httpPost.mockResolvedValueOnce({ success: true });

    const output = await run([
      'APP-1',
      'FORM-1',
      '--package-uuid',
      'pkg-21',
      '--field-permission',
      '{"fieldRange":"CUSTOM","fieldStatus":[{"label":"名称","fieldName":"text_a","componentName":"TextField","value":"FORM_FIELD_VIEW"}]}',
    ]);

    expect(output).toMatchObject({ success: true, packageUuid: 'pkg-21' });
    expect(utils.httpGet).toHaveBeenCalledTimes(4);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[1][2]).toMatchObject({ pageIndex: '2' });
  });
});
