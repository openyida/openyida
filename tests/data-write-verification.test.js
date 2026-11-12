'use strict';

jest.mock('../lib/core/utils', () => ({ loadAuthData: jest.fn(), resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(), httpPost: jest.fn(), triggerLogin: jest.fn(), requestWithAutoLogin: jest.fn() }));
jest.mock('../lib/app/services/form-mode-service', () => ({ readFormMode: jest.fn() }));
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn() }));
jest.mock('../lib/core/form-edit-permissions', () => ({ assertFormUpdatePermissions: jest.fn(), assertFormUpdatePermissionResponse: jest.fn() }));

const { run } = require('../lib/core/query-data');
const { CliError } = require('../lib/core/cli-error');
const utils = require('../lib/core/utils');
const permissions = require('../lib/core/form-edit-permissions');
let schema, record, log;
const flags = ['--expect-form-name', '验证表单', '--expect-form-type', 'receipt', '--verify-write'];
const create = (data, extra = []) => run(['create', 'form', 'APP_TEST', 'FORM-TEST', '--data-json', JSON.stringify(data), ...flags, ...extra]);
const update = data => run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW', '--data-json', JSON.stringify(data), ...flags]);

beforeEach(() => {
  jest.clearAllMocks();
  schema = { success: true, content: { pages: [{ componentsTree: [
    { componentName: 'TextField', props: { fieldId: 'textField_name', label: '客户名称' } },
    { componentName: 'NumberField', props: { fieldId: 'numberField_total', label: '金额' } },
  ], componentAlias: { items: [{ fieldId: 'textField_name', alias: 'name' }] } }] } };
  record = { formInstId: 'FINST-NEW', modelUuid: 'FORM-TEST', gmtModified: 123,
    formData: { textField_name: 'A', numberField_total: '0' } };
  utils.loadAuthData.mockReturnValue({ auth_mode: 'token', auth_source: 'token', corp_id: 'ding-test', user_id: 'test-user', base_url: 'https://www.aliwork.com' });
  utils.requestWithAutoLogin.mockImplementation((fn, auth) => fn(auth));
  utils.httpGet.mockImplementation(async (_base, url) => url.includes('getFormSchema.json') ? schema : { success: true, content: record });
  utils.httpPost.mockResolvedValue({ success: true, content: 'FINST-NEW' });
  require('../lib/app/services/form-mode-service').readFormMode.mockResolvedValue({ mode: 'receipt' });
  require('../lib/app/form-navigation').fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-TEST', formName: '验证表单', formType: 'receipt' }]);
  permissions.assertFormUpdatePermissions.mockResolvedValue(undefined);
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

test('first ordinary record is written once and verified by submitted field values', async () => {
  await create({ textField_name: 'A', numberField_total: 0 });
  const result = JSON.parse(log.mock.calls[0][0]);
  expect(result).toMatchObject({ success: true, formInstId: 'FINST-NEW', idVerified: true, readbackVerified: true,
    verification: { formInstId: 'FINST-NEW', verifiedFields: ['textField_name', 'numberField_total'] } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormDataById'))).toHaveLength(1);
});

test.each(['create', 'update'])('%s normalizes scoped child associations and verifies their projected values', async operation => {
  const ref = { appType: 'APP_REMOTE', formUuid: 'FORM-REMOTE', formType: 'receipt', instanceId: 'FINST-REMOTE', title: '客户' };
  schema.content.pages[0].componentsTree.push({ componentName: 'TableField', props: { fieldId: 'lines' }, children: [
    { componentName: 'AssociationFormField', props: { fieldId: 'customer', multiple: false, associationForm: ref } },
  ] });
  record.formData = { lines: JSON.stringify([{ customer_id: JSON.stringify(JSON.stringify([ref])) }, {}]) };
  record.instValue = JSON.stringify([{ componentName: 'TableField', fieldId: 'lines', fieldData: { value: [
    [{ componentName: 'AssociationFormField', fieldId: 'customer', rowId: 'ROW-1', fieldData: { value: [ref] } }],
    [{ componentName: 'AssociationFormField', fieldId: 'customer', rowId: 'ROW-2', fieldData: { value: [] } }],
  ] } }]);
  await (operation === 'create' ? create : update)({ lines: [{ customer: [ref] }, { customer: [] }] });
  const params = new URLSearchParams(utils.httpPost.mock.calls[0][2]);
  expect(JSON.parse(params.get(operation === 'create' ? 'formDataJson' : 'updateFormDataJson'))).toEqual({
    lines: [{ customer: [{ ...ref, subTitle: '' }] }, { customer: [] }],
  });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormSchema'))).toHaveLength(1);
  // Updates retain the existing pre-write target read plus the post-write verification.
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormDataById'))).toHaveLength(operation === 'create' ? 1 : 2);
});

test('unknown business labels fail before mutation and return real field candidates', async () => {
  await expect(create({ 客户名称: 'A', numberField_total: '0' })).rejects.toMatchObject({
    code: 'DATA_WRITE_PREFLIGHT_FAILED', details: { sideEffectState: 'none', issues: [
      { code: 'UNKNOWN_FIELD', candidates: [{ fieldId: 'textField_name', label: '客户名称' }] },
      { code: 'INVALID_VALUE_TYPE', fieldId: 'numberField_total' },
    ] },
  });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('canonical field IDs are not reinterpreted as aliases after the scoped compiler', async () => {
  schema.content.pages[0].componentsTree.push({ componentName: 'TextField', props: { fieldId: 'textField_other', label: '其他' } });
  schema.content.pages[0].componentAlias.items.push({ fieldId: 'textField_other', alias: 'textField_name' });
  await create({ textField_name: 'A' }, ['--resolve-aliases']);
  const payload = new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('formDataJson');
  expect(JSON.parse(payload)).toEqual({ textField_name: 'A' });
});

test('configured aliases remain available when explicitly requested', async () => {
  await create({ name: 'A' }, ['--resolve-aliases']);
  expect(JSON.parse(new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('formDataJson'))).toEqual({ textField_name: 'A' });
});

test.each([{}, { textField_name: '' }])('detects silent business-data loss and preserves the accepted instance: %j', async data => {
  record.formData = data;
  await expect(create({ textField_name: 'never-leak' })).rejects.toMatchObject({ code: 'DATA_WRITE_READBACK_MISMATCH', details: {
    mutationAccepted: true, readbackVerified: false, retrySafe: false, sideEffectState: 'committed', partial: { formInstId: 'FINST-NEW' },
  } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('readback timeout does not retry a known accepted mutation', async () => {
  utils.httpGet.mockImplementation(async (_base, url) => {
    if (url.includes('getFormSchema')) {return schema;}
    throw new Error('readback timeout');
  });
  await expect(create({ textField_name: 'A' })).rejects.toMatchObject({ code: 'DATA_WRITE_READBACK_UNVERIFIED',
    details: { mutationAccepted: true, retrySafe: false, target: { formInstId: 'FINST-NEW' } } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each([
  { formUuid: 'FORM-OTHER', formInstId: 'FINST-NEW' },
  { modelUuid: 'FORM-TEST', formInstId: 'FINST-OTHER' },
  { modelUuid: 'FORM-TEST', formUuid: 'FORM-OTHER', formInstId: 'FINST-NEW' },
])('does not verify another instance or contradictory form identity: %j', async identity => {
  record = { ...identity, formData: { textField_name: 'A' } };
  await expect(create({ textField_name: 'A' })).rejects.toMatchObject({ code: 'DATA_WRITE_READBACK_UNVERIFIED' });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('conflicting successful-create IDs are retained for reconciliation instead of guessed', async () => {
  utils.httpPost.mockResolvedValue({ success: true, formInstId: 'FINST-A', content: { formInstId: 'FINST-B' } });
  await expect(create({ textField_name: 'A' })).rejects.toMatchObject({ code: 'DATA_WRITE_READBACK_UNVERIFIED',
    details: { partial: { candidateIds: ['FINST-A', 'FINST-B'] }, mutationAccepted: true, retrySafe: false } });
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormDataById'))).toHaveLength(0);
});

test('updates retain native permission gates and verify only the submitted changes', async () => {
  await update({ textField_name: 'A' });
  expect(permissions.assertFormUpdatePermissions).toHaveBeenCalledTimes(1);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ readbackVerified: true, formInstId: 'FINST-NEW' });
});

test.each([undefined, 'n'])('historical new fields require an explicit upgrade choice (%s) before writing', async choice => {
  record.version = 1;
  record.formData = { textField_name: 'A' };
  record.instValue = JSON.stringify([{ fieldId: 'textField_name', componentName: 'TextField' }]);
  const extra = choice ? ['--use-latest-version', choice] : [];
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"numberField_total":5}', ...flags, ...extra]))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_CHOICE_REQUIRED', details: { sideEffectState: 'none' } });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('an existing empty field is not inferred as new from missing formData alone', async () => {
  record.formData = {};
  record.instValue = JSON.stringify([{ fieldId: 'textField_name', componentName: 'TextField' }]);
  utils.httpPost.mockImplementation(async () => { record.formData = { textField_name: 'A' }; return { success: true }; });
  await update({ textField_name: 'A' });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

function historicalSubform(rows = [[
  { componentName: 'TextField', fieldId: 'oldText', fieldData: {} },
  { componentName: 'NumberField', fieldId: 'oldNumber', fieldData: { value: '3' } },
]]) {
  schema.content.pages[0].componentsTree.push({ componentName: 'TableField', props: { fieldId: 'lines' }, children: [
    { componentName: 'TextField', props: { fieldId: 'oldText' } },
    { componentName: 'NumberField', props: { fieldId: 'oldNumber' } },
    { componentName: 'NumberField', props: { fieldId: 'newNumber' } },
  ] });
  record.version = 1;
  record.formData = { lines: rows.length ? JSON.stringify([{ oldNumber: '3' }]) : '[]' };
  record.instValue = JSON.stringify([{ componentName: 'TableField', fieldId: 'lines', fieldData: { value: rows } }]);
  permissions.assertFormUpdatePermissions.mockResolvedValue({ schema: { version: 2 },
    fields: new Map([['lines', { componentName: 'TableField' }]]) });
}

test.each([undefined, 'n'])('new historical subform leaves require upgrade choice (%s) before a write', async choice => {
  historicalSubform();
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"lines":[{"oldNumber":3,"newNumber":5}]}', ...flags,
    ...(choice ? ['--use-latest-version', choice] : [])]))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_CHOICE_REQUIRED', details: { fields: ['lines[0].newNumber'], sideEffectState: 'none' } });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('subform choice protection also runs without optional write verification', async () => {
  historicalSubform();
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"lines":[{"newNumber":5}]}', ...flags.filter(flag => flag !== '--verify-write')]))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_CHOICE_REQUIRED' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('an old empty subform leaf remains writable from its component inventory', async () => {
  historicalSubform();
  await run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"lines":[{"oldText":"filled","oldNumber":3}]}', ...flags.filter(flag => flag !== '--verify-write')]);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each([[], [null], [[]]].map(rows => [rows]))('unreadable or empty old subform inventory %j cannot authorize new leaves', async rows => {
  historicalSubform(rows);
  await expect(update({ lines: [{ newNumber: 5 }] }))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_CHOICE_UNVERIFIED', details: { sideEffectState: 'none' } });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('an empty subform at the confirmed current version can accept its existing schema fields', async () => {
  historicalSubform([]);
  record.version = 2;
  await run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"lines":[{"oldNumber":3}]}', ...flags.filter(flag => flag !== '--verify-write')]);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each([1, 2])('omitted empty table inventory uses the native version (%s) without guessing it is new', async version => {
  historicalSubform([]);
  record.version = version;
  record.formData = { textField_name: 'A' };
  record.instValue = JSON.stringify([{ componentName: 'TextField', fieldId: 'textField_name' }]);
  const result = run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"lines":[{"oldNumber":3}]}', ...flags.filter(flag => flag !== '--verify-write')]);
  if (version === 1) {
    await expect(result).rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_CHOICE_UNVERIFIED' });
    expect(utils.httpPost).not.toHaveBeenCalled();
  } else {
    await result;
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  }
});

test('native field permission failures take precedence over a version upgrade suggestion', async () => {
  record.formData = { textField_name: 'A' };
  record.instValue = JSON.stringify([{ fieldId: 'textField_name' }]);
  permissions.assertFormUpdatePermissions.mockRejectedValueOnce(new CliError('readonly', { code: 'READONLY' }));
  await expect(update({ numberField_total: 5 })).rejects.toMatchObject({ code: 'READONLY' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test.each(['Y', 'true', 'false', 'yes'])('invalid upgrade choices are rejected before writing: %s', choice => {
  return expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', ...flags, '--use-latest-version', choice]))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_CHOICE_INVALID' });
});

function withPublishedVersion(version) {
  const original = utils.httpGet.getMockImplementation();
  utils.httpGet.mockImplementation((base, url, ...rest) => url.includes('getFormSchemaInfo.json')
    ? { success: true, content: { version } } : original(base, url, ...rest));
  permissions.assertFormUpdatePermissions.mockResolvedValue({ schema: { version }, fields: new Map([
    ['textField_name', { componentName: 'TextField' }], ['numberField_total', { componentName: 'NumberField' }],
  ]) });
}

test('upgrade always verifies fields and published version, even without --verify-write', async () => {
  withPublishedVersion(2);
  record.version = 1;
  utils.httpPost.mockImplementation(async () => { record.version = 2; return { success: true }; });
  await run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', '--expect-form-name', '验证表单', '--expect-form-type', 'receipt',
    '--use-latest-version', 'y']);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ readbackVerified: true,
    verification: { expectedVersion: '2', instanceVersion: 2 } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(utils.httpPost.mock.calls[0][1]).toContain('/query/formdata/editFormDataByDataMap.json');
  const params = new URLSearchParams(utils.httpPost.mock.calls[0][2]);
  expect(params.get('version')).toBe('2');
  expect(params.get('gmtModified')).toBe('123');
  expect(params.get('formUuid')).toBe('FORM-TEST');
  expect(JSON.parse(params.get('dataMap'))).toEqual({ textField_name: 'A' });
  expect(params.has('useLatestVersion')).toBe(false);
  expect(params.has('updateFormDataJson')).toBe(false);
});

test.each(['edit_version', 'timestamp', 'type'])('unverified upgrade context (%s) sends no write', async reason => {
  withPublishedVersion(2);
  if (reason === 'timestamp') { delete record.gmtModified; }
  if (reason === 'edit_version') {
    permissions.assertFormUpdatePermissions.mockResolvedValue({ schema: { version: 1 }, fields: new Map() });
  }
  if (reason === 'type') {
    permissions.assertFormUpdatePermissions.mockResolvedValue({ schema: { version: 2 },
      fields: new Map([['textField_name', { componentName: 'NumberField' }]]) });
  }
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', ...flags, '--use-latest-version', 'y']))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_VERSION_UNVERIFIED' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('upgrade rejects null clears before the native converter can omit them', async () => {
  withPublishedVersion(2);
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":null}', ...flags, '--use-latest-version', 'y']))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_NULL_UNSUPPORTED', details: { fields: ['textField_name'] } });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('native edit conflicts do not fall back to the legacy endpoint or replay', async () => {
  withPublishedVersion(2);
  utils.httpPost.mockResolvedValue({ success: false, errorCode: '500', errorMsg: '实例数据已修改，请刷新当前页面' });
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', ...flags, '--use-latest-version', 'y']))
    .rejects.toMatchObject({ code: 'DATA_API_ERROR', details: { errorCode: '500', retrySafe: false,
      partial: { formInstId: 'FINST-NEW' }, target: { formInstId: 'FINST-NEW' } } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(utils.httpPost.mock.calls[0][1]).toContain('/query/formdata/editFormDataByDataMap.json');
});

test('a lost native upgrade response preserves the existing ID and requires readback without replay', async () => {
  withPublishedVersion(2);
  utils.httpPost.mockRejectedValue(Object.assign(new Error('response lost'), { code: 'ECONNRESET' }));
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', ...flags, '--use-latest-version', 'y']))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_WRITE_UNVERIFIED', details: {
      causeCode: 'ECONNRESET', partial: { formInstId: 'FINST-NEW' }, retrySafe: false,
      sideEffectState: 'unknown', readbackAllowed: true,
    } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('an accepted upgrade that retains the old instance version fails without replaying the write', async () => {
  withPublishedVersion(2); record.version = 1;
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', ...flags, '--use-latest-version', 'y']))
    .rejects.toMatchObject({ code: 'DATA_WRITE_READBACK_MISMATCH', details: { mutationAccepted: true, retrySafe: false,
      issues: [{ code: 'READBACK_VERSION_MISMATCH', expectedVersion: '2', actualVersion: 1 }] } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('upgrade with an unreadable published version stops before mutation', async () => {
  withPublishedVersion(undefined);
  await expect(run(['update', 'form', 'APP_TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-NEW',
    '--data-json', '{"textField_name":"A"}', ...flags, '--use-latest-version', 'y']))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPGRADE_VERSION_UNVERIFIED' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('read-only native editor behavior still stops a verified update before mutation', async () => {
  permissions.assertFormUpdatePermissions.mockRejectedValueOnce(new CliError('readonly', { code: 'READONLY' }));
  await expect(update({ textField_name: 'A' })).rejects.toMatchObject({ code: 'READONLY' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test.each([
  ['query', 'form', 'APP_TEST', 'FORM-TEST', '--verify-write'],
  ['create', 'process', 'APP_TEST', 'FORM-TEST', '--verify-write'],
  ['create', 'form', 'APP_TEST', 'FORM-TEST', '--verify-write=false'],
])('rejects misplaced verification flags before authentication: %j', async (...args) => {
  await expect(run(args)).rejects.toMatchObject({ code: 'DATA_VERIFY_WRITE_UNSUPPORTED' });
  expect(utils.loadAuthData).not.toHaveBeenCalled();
  expect(utils.httpPost).not.toHaveBeenCalled();
});
