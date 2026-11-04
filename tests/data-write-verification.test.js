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
  record = { formInstId: 'FINST-NEW', modelUuid: 'FORM-TEST', formData: { textField_name: 'A', numberField_total: '0' } };
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
