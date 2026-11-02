'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(() => ({ base_url: 'https://example.com', auth_mode: 'token',
    auth_source: 'token', corp_id: 'corp-1', user_id: 'admin-user' })),
  triggerLogin: jest.fn(), resolveBaseUrl: jest.fn(() => 'https://example.com'),
  httpGet: jest.fn(), httpPost: jest.fn(), requestWithAutoLogin: jest.fn(fn => fn({ baseUrl: 'https://example.com' })),
}));

const utils = require('../lib/core/utils');
const { run } = require('../lib/permission/save-permission');
const { run: getPermission } = require('../lib/permission/get-permission');
const { queryMatrixAvailability } = require('../lib/permission/matrix-availability');
const { patchFieldAccess, parseFieldAccess } = require('../lib/permission/permission-scope');

const fields = [
  { componentName: 'EmployeeField', props: { fieldId: 'employeeField_owner', label: '客户负责人' } },
  { componentName: 'NumberField', props: { fieldId: 'numberField_cost', label: '成本' } },
  { componentName: 'TextField', props: { fieldId: 'textField_name', label: '客户名称' } },
  { componentName: 'TableField', props: { fieldId: 'tableField_lines', label: '明细' }, children: [
    { componentName: 'EmployeeField', props: { fieldId: 'employeeField_nested', label: '明细负责人' } },
  ] },
];
const existing = {
  packageUuid: 'pkg-sales', packageType: 'FORM_PACKAGE_VIEW', packageName: { zh_CN: '销售' },
  roleData: JSON.stringify({ include: [{ roleType: 'ROLE', roleValue: 'ROLE-OLD' }],
    exclude: [{ roleType: 'PERSONS', roleValue: 'blocked-user' }] }),
  dataPermit: JSON.stringify({ rule: [{ type: 'ALL', value: 'y' }] }),
  operatePermit: JSON.stringify({ OPERATE_VIEW: 'y', OPERATE_EDIT: 'y' }),
  fieldPermit: JSON.stringify({ fieldRange: 'CUSTOM', marker: 'keep', fieldStatus: [
    { label: 'numberField_cost', fieldName: '成本', componentName: 'NumberField', value: 'FORM_FIELD_HIDDEN' },
    { label: 'textField_name', fieldName: '客户名称', componentName: 'TextField', value: 'FORM_FILED_EDIT' },
  ] }),
};

describe('permission owner/role/field shorthand and matrix availability', () => {
  let packages;
  let feature;
  let outputSpy;
  let errorSpy;
  beforeEach(() => {
    process.env.YIDA_QUIET = '1';
    jest.clearAllMocks();
    packages = [];
    feature = { success: true, content: true };
    outputSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    utils.httpGet.mockImplementation(async (_base, url) => {
      if (url.includes('/query/feature/')) { return feature; }
      if (url.includes('getFormSchema')) {
        return { success: true, content: { pages: [{ componentsTree: fields }] } };
      }
      return { success: true, content: { formPermit: packages } };
    });
    utils.httpPost.mockImplementation(async (_base, _url, body) => {
      const written = { ...querystring.parse(body), packageUuid: querystring.parse(body).packageUuid || 'pkg-created' };
      packages = packages.filter(pkg => pkg.packageUuid !== written.packageUuid).concat(written);
      return { success: true, content: written.packageUuid };
    });
  });
  afterEach(() => {
    delete process.env.YIDA_QUIET;
    outputSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('previews owner isolation and role-specific fields with zero writes and no OA check', async () => {
    packages = [existing];
    const result = await run(['APP-X', 'FORM-X', '--create', '--name', '销售负责人',
      '--roles', 'ROLE-SALES', '--owner-field', 'employeeField_owner',
      '--field-default', 'view', '--field-access', 'numberField_cost:hidden', '--dry-run']);
    expect(utils.httpPost).not.toHaveBeenCalled();
    expect(result).toMatchObject({ dryRun: true, remoteWrites: 0, effectiveAccessVerified: false });
    expect(result.after.roleData.include).toEqual([{ roleType: 'ROLE', roleValue: 'ROLE-SALES' }]);
    expect(result.after.dataPermit.rule).toEqual([{ type: 'FORMULA', value: 'y' }]);
    expect(result.after.dataPermit.formulaData.rules[0]).toMatchObject({
      fieldId: 'employeeField_owner', componentType: 'EmployeeField', op: 'contain',
      value: '${loginUser}', ruleValue: '${loginUser}', extValue: 'field', valueType: 'value',
    });
    expect(result.after.fieldPermit.fieldStatus.find(f => f.label === 'numberField_cost').value).toBe('FORM_FIELD_HIDDEN');
    expect(result.after.fieldPermit.fieldStatus.find(f => f.label === 'textField_name').value).toBe('FORM_FIELD_VIEW');
    expect(result.otherPackagesToReview).toHaveLength(1);
    expect(utils.httpGet.mock.calls.some(call => call[1].includes('/query/feature/'))).toBe(false);
  });

  test('creates and reads back an ordinary role group with dynamic current-user isolation', async () => {
    const result = await run(['APP-X', 'FORM-X', '--create', '--name', '销售',
      '--roles', 'ROLE-SALES', '--owner-field', 'employeeField_owner']);
    expect(result.verification.status).toBe('verified');
    expect(result.summary.members).toContain('ROLE-SALES');
    expect(result.effectiveAccessVerified).toBe(false);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(JSON.parse(packages[0].dataPermit).formulaData.rules[0].value).toBe('${loginUser}');
  });

  test('does not rewrite a platform DTO when member extensions cannot be converted without loss', async () => {
    const legacy = { ...existing, packageType: '', roleMembers: [
      { roleType: 'ROLE', roleValue: [{ key: 'ROLE-SALES', label: '角色', ext: '{"unknownRule":true}' }] },
    ] };
    delete legacy.roleData;
    packages = [legacy];
    await expect(run(['APP-X', 'FORM-X', '--package-uuid', 'pkg-sales',
      '--field-access', 'numberField_cost:view'])).rejects.toMatchObject({
      code: 'SAVE_PERMISSION_BEFORE_UNKNOWN',
      details: { reason: 'member_exclusions_not_readable', remoteWrites: 0 },
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('patches one field without changing other fields, members or operations', async () => {
    packages = [existing];
    const result = await run(['APP-X', 'FORM-X', '--package-uuid', 'pkg-sales',
      '--field-access', 'numberField_cost:view']);
    expect(result.verification.targetDimensions).toEqual(['fieldPermit']);
    expect(result.effectiveAccessVerified).toBe(false);
    const updated = packages[0];
    expect(updated.roleData).toBe(existing.roleData);
    expect(updated.dataPermit).toBe(existing.dataPermit);
    expect(updated.operatePermit).toBe(existing.operatePermit);
    expect(JSON.parse(updated.fieldPermit)).toMatchObject({ marker: 'keep', fieldStatus: [
      { label: 'numberField_cost', value: 'FORM_FIELD_VIEW' },
      { label: 'textField_name', value: 'FORM_FILED_EDIT' },
    ] });
  });

  test('creates native field IDs in label and saves only the requested editable field', async () => {
    const result = await run(['APP-X', 'FORM-X', '--create', '--name', '仅日期可编辑',
      '--field-default', 'view', '--field-access', 'textField_name:edit']);
    expect(result.effectiveAccessVerified).toBe(false);
    const status = JSON.parse(packages[0].fieldPermit).fieldStatus;
    expect(status).toHaveLength(5);
    expect(status.find(item => item.label === 'textField_name')).toEqual({
      label: 'textField_name', fieldName: '客户名称', componentName: 'TextField', value: 'FORM_FILED_EDIT',
    });
    // Model the native lookup by label, rather than just echoing the submitted object.
    const nativePermissions = new Map(status.map(item => [item.label, item.value]));
    expect(nativePermissions.get('numberField_cost')).toBe('FORM_FIELD_VIEW');
    expect(nativePermissions.get('textField_name')).toBe('FORM_FILED_EDIT');
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('adds a missing field by its ID while preserving unrelated native entries', async () => {
    const permit = JSON.parse(existing.fieldPermit);
    permit.fieldStatus.push({ label: 'block_1', fieldName: '布局', componentName: 'Block',
      value: 'FORM_FIELD_HIDDEN', extension: { keep: true } });
    packages = [{ ...existing, fieldPermit: JSON.stringify(permit) }];
    await run(['APP-X', 'FORM-X', '--package-uuid', 'pkg-sales', '--field-access', 'employeeField_owner:view']);
    const after = JSON.parse(packages[0].fieldPermit);
    expect(after.fieldStatus.slice(0, 3)).toEqual(permit.fieldStatus);
    expect(after.fieldStatus[3]).toEqual({ label: 'employeeField_owner', fieldName: '客户负责人',
      componentName: 'EmployeeField', value: 'FORM_FIELD_VIEW' });
  });

  test.each(['numberField_cost:view', 'employeeField_owner:view'])(
    'stops before writes for reversed legacy mappings instead of migrating unrelated permissions: %s', async change => {
      const permit = JSON.parse(existing.fieldPermit);
      permit.fieldStatus = permit.fieldStatus.map(item => ({ ...item, label: item.fieldName, fieldName: item.label }));
      packages = [{ ...existing, fieldPermit: JSON.stringify(permit) }];
      await expect(run(['APP-X', 'FORM-X', '--package-uuid', 'pkg-sales', '--field-access', change]))
        .rejects.toMatchObject({ code: 'PERMISSION_SCOPE_INVALID', details: { remoteWrites: 0 } });
      expect(utils.httpPost).not.toHaveBeenCalled();
    });

  test('checks subtable parents by native field ID and accepts both requested edits', async () => {
    await run(['APP-X', 'FORM-X', '--create', '--name', '明细', '--field-default', 'view',
      '--field-access', 'employeeField_nested:edit', '--field-access', 'tableField_lines:edit']);
    const status = JSON.parse(packages[0].fieldPermit).fieldStatus;
    expect(status.filter(item => item.value === 'FORM_FILED_EDIT').map(item => item.label))
      .toEqual(['tableField_lines', 'employeeField_nested']);
  });

  test('matches identical display names by field ID without merging their permissions', async () => {
    const permit = JSON.parse(existing.fieldPermit);
    permit.fieldStatus.forEach(item => { item.fieldName = '同名字段'; });
    packages = [{ ...existing, fieldPermit: JSON.stringify(permit) }];
    await run(['APP-X', 'FORM-X', '--package-uuid', 'pkg-sales', '--field-access', 'numberField_cost:view']);
    expect(JSON.parse(packages[0].fieldPermit).fieldStatus).toEqual([
      { ...permit.fieldStatus[0], value: 'FORM_FIELD_VIEW' }, permit.fieldStatus[1],
    ]);
  });

  test.each(['reversed', 'duplicate ID', 'wrong component'])(
    'rejects invalid full field-permission JSON with zero writes: %s', async invalidCase => {
      const permit = JSON.parse(existing.fieldPermit);
      if (invalidCase === 'reversed') {
        permit.fieldStatus[0] = { ...permit.fieldStatus[0], label: '成本', fieldName: 'numberField_cost' };
      } else if (invalidCase === 'duplicate ID') {
        permit.fieldStatus.push({ ...permit.fieldStatus[0], value: 'FORM_FILED_EDIT' });
      } else { permit.fieldStatus[0].componentName = 'TextField'; }
      await expect(run(['APP-X', 'FORM-X', '--create', '--name', '错误映射',
        '--field-permission', JSON.stringify(permit)])).rejects.toThrow();
      expect(utils.httpPost).not.toHaveBeenCalled();
    });

  test('previews role replacements, preserves exclusions and requires confirmation to save', async () => {
    packages = [existing];
    const args = ['APP-X', 'FORM-X', '--package-uuid', 'pkg-sales', '--roles', 'ROLE-NEW'];
    const preview = await run([...args, '--dry-run']);
    expect(preview.after.roleData.exclude).toEqual(JSON.parse(existing.roleData).exclude);
    await expect(run(args)).rejects.toMatchObject({ code: 'SAVE_PERMISSION_MEMBER_REPLACE_CONFIRM_REQUIRED' });
    expect(utils.httpPost).not.toHaveBeenCalled();
    await run([...args, '--confirm-member-replace']);
    expect(JSON.parse(packages[0].roleData)).toEqual(preview.after.roleData);
  });

  test.each(['missing', 'textField_name', 'employeeField_nested'])(
    'rejects invalid owner field %s before any write', async owner => {
      await expect(run(['APP-X', 'FORM-X', '--create', '--name', '销售', '--owner-field', owner]))
        .rejects.toMatchObject({ code: 'PERMISSION_OWNER_FIELD_INVALID' });
      expect(utils.httpPost).not.toHaveBeenCalled();
    });

  test.each([
    ['--field-access', 'missing:hidden', '--field-default', 'view'],
    ['--field-access', 'numberField_cost:edit'],
    ['--field-access', 'employeeField_nested:edit', '--field-default', 'view'],
  ])('does not infer unknown fields or replace form-dependent defaults: %j', async (...flags) => {
    await expect(run(['APP-X', 'FORM-X', '--create', '--name', '销售', ...flags])).rejects.toThrow();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test.each([
    ['--roles', 'A,,B'], ['--roles', 'A,A'],
    ['--roles', 'A', '--all-members'],
    ['--owner-field', 'employeeField_owner', '--data-permission', '{"dataRange":"ALL"}'],
    ['--field-access', 'numberField_cost:EDIT'],
    ['--field-access', 'numberField_cost:view', '--field-access', 'numberField_cost:hidden'],
  ])('rejects conflicting or ambiguous shorthand before reads: %j', async (...flags) => {
    await expect(run(['APP-X', 'FORM-X', '--create', '--name', '销售', ...flags])).rejects.toThrow();
    expect(utils.httpGet).not.toHaveBeenCalled();
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('queries management at corp scope and usage at app scope without claiming purchase', async () => {
    const result = await queryMatrixAvailability({}, 'APP-X');
    expect(result).toMatchObject({ management: { status: 'available' }, usage: { status: 'available' }, purchaseVerified: false });
    expect(utils.httpGet.mock.calls.map(call => [call[1], call[2]])).toEqual([
      ['/query/feature/get.json', { featureKey: 'matrixManageEntry', dimension: 'corp' }],
      ['/APP-X/query/feature/get.json', { featureKey: 'matrixAbility', dimension: 'app' }],
    ]);
  });

  test('returns matrix guidance in a read-only permission query', async () => {
    feature = { success: true, content: false };
    const result = await getPermission(['APP-X', 'FORM-X', '--check-matrix', '--json']);
    expect(result.matrixAvailability).toMatchObject({ usage: { status: 'unavailable' }, purchaseVerified: false });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test.each([
    [{ success: true, content: false }, 'PERMISSION_MATRIX_UNAVAILABLE'],
    [{ success: false, errorCode: 'DENIED', errorMsg: 'account denied' }, 'PERMISSION_MATRIX_UNKNOWN'],
    [{ success: true, content: 'true' }, 'PERMISSION_MATRIX_UNKNOWN'],
  ])('stops matrix writes for unavailable or unknown preflight %j', async (response, code) => {
    feature = response;
    await expect(run(['APP-X', 'FORM-X', '--create', '--name', '矩阵', '--matrix',
      '{"matrixId":"MATRIX-1","columnId":"column_1"}', '--data-permission', '{"dataRange":"MATRIX"}']))
      .rejects.toMatchObject({ code, details: { remoteWrites: 0 } });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('still preserves a business API refusal after successful matrix preflight', async () => {
    utils.httpPost.mockResolvedValue({ success: false, errorCode: '000006', errorMsg: '账号无管理权限' });
    await expect(run(['APP-X', 'FORM-X', '--create', '--name', '矩阵', '--matrix',
      '{"matrixId":"MATRIX-1","columnId":"column_1"}', '--data-permission', '{"dataRange":"MATRIX"}']))
      .rejects.toMatchObject({ code: 'SAVE_PERMISSION_CREATE_FAILED', message: '账号无管理权限' });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('does not reinterpret existing custom field defaults', () => {
    expect(() => patchFieldAccess(JSON.parse(existing.fieldPermit), parseFieldAccess(['numberField_cost:view']),
      'edit', [])).toThrow();
  });
});
