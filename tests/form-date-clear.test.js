'use strict';

jest.mock('../lib/core/utils', () => ({ loadAuthData: jest.fn(), resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(), httpPost: jest.fn(), triggerLogin: jest.fn(), requestWithAutoLogin: jest.fn() }));
jest.mock('../lib/app/services/form-mode-service', () => ({ readFormMode: jest.fn() }));
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn() }));

const { run } = require('../lib/core/query-data');
const utils = require('../lib/core/utils');
const clone = value => JSON.parse(JSON.stringify(value));
const dateId = 'dateField_due';
const flags = ['--expect-form-name', '日期测试', '--expect-form-type', 'receipt', '--json'];
let record, schema, log, afterWrite, transformAfter;
const field = (componentName, fieldId, props = {}) => ({ componentName, props: { fieldId, validation: [], ...props } });
const update = (data = { [dateId]: null }, extra = []) => run(['update', 'form', 'APP_TEST',
  '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-OLD', '--data-json', JSON.stringify(data), ...flags, ...extra]);

beforeEach(() => {
  jest.clearAllMocks();
  afterWrite = false;
  transformAfter = value => value;
  record = { formInstId: 'FINST-OLD', modelUuid: 'FORM-TEST', version: 3, gmtModified: 123,
    formData: { [dateId]: 1700000000000, textField_keep: '保留', numberField_zero: 0 },
    instValue: [
      { componentName: 'DateField', fieldId: dateId, fieldData: { value: 1700000000000, text: '旧日期' } },
      { componentName: 'TextField', fieldId: 'textField_keep', fieldData: { value: '保留' } },
      { componentName: 'NumberField', fieldId: 'numberField_zero', fieldData: { value: 0 } },
    ] };
  // The currently published schema is newer; clearing must retain instance version 3.
  schema = { version: 9, pages: [{ id: 'FORM-TEST', componentsTree: [
    field('DateField', dateId), field('TextField', 'textField_keep'), field('NumberField', 'numberField_zero'),
  ], componentAlias: { items: [{ fieldId: dateId, alias: 'due' }] } }],
  instanceData: [{ id: 'FORM-TEST', formInstId: 'FINST-OLD', flowData: { behaviors: [
    { fieldId: dateId, fieldBehavior: 'NORMAL' }, { fieldId: 'textField_keep', fieldBehavior: 'READONLY' },
    { fieldId: 'numberField_zero', fieldBehavior: 'NORMAL' },
  ] } }] };
  utils.loadAuthData.mockReturnValue({ auth_mode: 'token', auth_source: 'token', corp_id: 'ding-test',
    user_id: 'test-user', base_url: 'https://www.aliwork.com' });
  utils.requestWithAutoLogin.mockImplementation((fn, auth) => fn(auth));
  require('../lib/app/services/form-mode-service').readFormMode.mockResolvedValue({ mode: 'receipt' });
  require('../lib/app/form-navigation').fetchFormPageList.mockResolvedValue([
    { formUuid: 'FORM-TEST', formName: '日期测试', formType: 'receipt' },
  ]);
  utils.httpGet.mockImplementation(async (_base, url) => {
    if (url.includes('queryOperatePermission')) { return { success: true, content: { OPERATE_EDIT: 'y' } }; }
    if (url.includes('getFormEditSchema') || url.includes('getFormSchema.json')) { return { success: true, content: clone(schema) }; }
    if (url.includes('getFormDataById')) {
      const value = clone(record);
      if (afterWrite) {
        value.instValue[0].fieldData = {}; // Native serialization can omit the null property.
        delete value.formData[dateId];
        return { success: true, content: transformAfter(value) };
      }
      value.instValue = JSON.stringify(value.instValue);
      return { success: true, content: value };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
  utils.httpPost.mockImplementation(async () => { afterWrite = true; return { success: true, content: 'FINST-OLD' }; });
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

test.each([[], ['--verify-write'], ['--use-latest-version', 'n']].map(extra => [extra]))('clear is a single partial write with mandatory readback: %j', async extra => {
  await update(undefined, extra);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  const [, url, encoded] = utils.httpPost.mock.calls[0];
  expect(url).toBe('/dingtalk/web/APP_TEST/query/formdata/editFormData.json');
  const body = new URLSearchParams(encoded);
  expect(body.get('version')).toBe('3');
  expect(body.get('gmtModified')).toBe('123');
  expect(body.get('formUuid')).toBe('FORM-TEST');
  expect(body.has('ignoreEmpty')).toBe(false);
  expect(body.has('updateFormDataJson')).toBe(false);
  expect(JSON.parse(body.get('value'))).toEqual([
    { componentName: 'DateField', fieldId: dateId, fieldData: { value: null } },
  ]);
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormDataById'))).toHaveLength(2);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ success: true, formInstId: 'FINST-OLD', readbackVerified: true,
    verification: { scope: 'returned_native_fields', verifiedFields: [dateId],
      preservedFields: ['textField_keep', 'numberField_zero'], instanceVersion: 3, expectedVersion: '3' } });
});

test('configured aliases resolve before date clearing and never become native field IDs', async () => {
  await update({ due: null }, ['--resolve-aliases']);
  expect(JSON.parse(new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('value'))[0].fieldId).toBe(dateId);
});

test('zero is a stored date value and can be explicitly cleared', async () => {
  record.instValue[0].fieldData.value = 0;
  record.formData[dateId] = 0;
  await update();
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0][0]).readbackVerified).toBe(true);
});

test('multiple existing top-level dates can be cleared in one native patch', async () => {
  schema.pages[0].componentsTree.push(field('DateField', 'dateField_second'));
  schema.instanceData[0].flowData.behaviors.push({ fieldId: 'dateField_second', fieldBehavior: 'NORMAL' });
  record.instValue.push({ componentName: 'DateField', fieldId: 'dateField_second', fieldData: { value: 1700000000000 } });
  transformAfter = value => { value.instValue[3].fieldData = { value: null }; return value; };
  await update({ [dateId]: null, dateField_second: null });
  const patch = JSON.parse(new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('value'));
  expect(patch.map(item => [item.fieldId, item.fieldData.value])).toEqual([[dateId, null], ['dateField_second', null]]);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('a readback for another record cannot verify this mutation', async () => {
  transformAfter = value => ({ ...value, formInstId: 'FINST-OTHER' });
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_READBACK_UNVERIFIED',
    details: { mutationAccepted: true, partial: { formInstId: 'FINST-OLD' } } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each([
  ['missing version', () => { delete record.version; }],
  ['missing modification time', () => { delete record.gmtModified; }],
  ['unreadable components', () => { record.instValue = 'broken'; }],
  ['missing historical date', () => { record.instValue.shift(); }],
  ['duplicate components', () => { record.instValue.push(clone(record.instValue[0])); }],
  ['historical type mismatch', () => { record.instValue[0].componentName = 'TextField'; }],
  ['editable type mismatch', () => { schema.pages[0].componentsTree[0].componentName = 'TextField'; }],
  ['required date', () => { schema.pages[0].componentsTree[0].props.validation = [{ type: 'required' }]; }],
  ['dynamic validation', () => { schema.pages[0].componentsTree[0].props.validation = '{{rules}}'; }],
])('%s stops before any write', async (_name, change) => {
  change();
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_PREFLIGHT_FAILED',
    details: { mutationPerformed: false, sideEffectState: 'none', retrySafe: true } });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test.each(['READONLY', 'HIDDEN', 'DISABLED'])('%s date retains the existing permission gate', async behavior => {
  schema.instanceData[0].flowData.behaviors[0].fieldBehavior = behavior;
  await expect(update()).rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('mixed patches do not clear or partially update anything', async () => {
  await expect(update({ [dateId]: null, numberField_zero: 10 })).rejects.toMatchObject({
    code: 'DATA_DATE_CLEAR_PREFLIGHT_FAILED', details: { reason: 'mixed_patch_unsupported' },
  });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('clearing cannot silently become a version upgrade', async () => {
  await expect(update(undefined, ['--use-latest-version', 'y'])).rejects.toMatchObject({
    code: 'DATA_DATE_CLEAR_PREFLIGHT_FAILED', details: { reason: 'version_upgrade_not_supported' },
  });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('subform date null is rejected instead of silently ignored', async () => {
  const child = field('DateField', 'dateField_child');
  schema.pages[0].componentsTree.push({ ...field('TableField', 'tableField_lines'), children: [child] });
  schema.instanceData[0].flowData.behaviors.push({ fieldId: 'tableField_lines', fieldBehavior: 'NORMAL' },
    { fieldId: 'dateField_child', fieldBehavior: 'NORMAL' });
  await expect(update({ tableField_lines: [{ dateField_child: null }] })).rejects.toMatchObject({
    code: 'DATA_DATE_CLEAR_PREFLIGHT_FAILED', details: { reason: 'subform_date_clear_unsupported' },
  });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test.each([
  ['date persisted', value => { value.instValue[0].fieldData.value = 1700000000000; }, 'READBACK_DATE_NOT_EMPTY'],
  ['projection contradicts empty native date', value => { value.formData[dateId] = 1700000000000; }, 'READBACK_DATE_NOT_EMPTY'],
  ['date missing', value => { value.instValue.shift(); }, 'READBACK_DATE_NOT_EMPTY'],
  ['version changed', value => { value.version = 9; }, 'READBACK_VERSION_MISMATCH'],
  ['other field changed', value => { value.instValue[1].fieldData.value = 'changed'; }, 'READBACK_UNTOUCHED_FIELD_CHANGED'],
  ['zero lost', value => { value.instValue[2].fieldData.value = null; }, 'READBACK_UNTOUCHED_FIELD_CHANGED'],
  ['other field missing', value => { value.instValue.pop(); }, 'READBACK_UNTOUCHED_FIELD_CHANGED'],
])('%s reports committed mismatch without another POST', async (_name, change, code) => {
  transformAfter = value => { change(value); return value; };
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_READBACK_MISMATCH', details: {
    mutationAccepted: true, retrySafe: false, partial: { formInstId: 'FINST-OLD' }, issues: expect.arrayContaining([expect.objectContaining({ code })]),
  } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('unreadable readback preserves the accepted record and forbids replay', async () => {
  transformAfter = value => ({ ...value, instValue: null });
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_READBACK_UNVERIFIED',
    details: { mutationAccepted: true, retrySafe: false, readbackAllowed: true, partial: { formInstId: 'FINST-OLD' } } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('a readback business error cannot be verified from a success flag alone', async () => {
  const get = utils.httpGet.getMockImplementation();
  utils.httpGet.mockImplementation(async (...args) => {
    const response = await get(...args);
    return afterWrite && args[1].includes('getFormDataById') ? { ...response, errorCode: '500' } : response;
  });
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_READBACK_UNVERIFIED' });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each([{ success: false, errorCode: '200007' }, { success: true, errorCode: '500' }])('business failure never falls back: %j', async response => {
  utils.httpPost.mockResolvedValue(response);
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_WRITE_UNVERIFIED', details: {
    retrySafe: false, sideEffectState: 'unknown', partial: { formInstId: 'FINST-OLD' },
  } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('transport failure cannot replay the clear through the old endpoint', async () => {
  utils.httpPost.mockRejectedValue(new Error('timeout'));
  await expect(update()).rejects.toMatchObject({ code: 'DATA_DATE_CLEAR_WRITE_UNVERIFIED',
    details: { retrySafe: false, readbackAllowed: true } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('ordinary nonempty updates keep the public API transport', async () => {
  await update({ numberField_zero: 1 });
  expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_TEST/v1/form/updateFormData.json');
});
