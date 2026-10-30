'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(), resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(), httpPost: jest.fn(), triggerLogin: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, session) => fn(session)),
}));
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn() }));
jest.mock('../lib/app/services/form-mode-service', () => ({ readFormMode: jest.fn() }));

const { run } = require('../lib/core/query-data');
const utils = require('../lib/core/utils');
const navigation = require('../lib/app/form-navigation');
const formMode = require('../lib/app/services/form-mode-service');

const args = ['update', 'form', 'APP_TEST', '--inst-id', 'FINST-TEST', '--form-uuid', 'FORM-TEST',
  '--expect-form-name', 'TEST', '--expect-form-type', 'receipt'];

let editSchema;
let operations;
let log;
beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue({ auth_mode: 'token', corp_id: 'CORP-TEST', user_id: 'USER-TEST' });
  navigation.fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-TEST', formName: 'TEST', formType: 'receipt' }]);
  formMode.readFormMode.mockResolvedValue({ mode: 'receipt' });
  operations = { success: true, content: { OPERATE_EDIT: 'y' } };
  editSchema = { success: true, content: {
    pages: [{ id: 'FORM-TEST', componentAlias: { items: [
      { fieldId: 'dateField_due', alias: 'due' }, { fieldId: 'textField_marker', alias: 'marker' },
    ] }, componentsTree: [{ componentName: 'FormContainer', children: [
      { componentName: 'DateField', props: { fieldId: 'dateField_due' } },
      { componentName: 'TextField', props: { fieldId: 'textField_marker' } },
    ] }] }],
    instanceData: { id: 'FORM-TEST', flowData: { behaviors: [
      { fieldId: 'dateField_due', componentName: 'DateField', fieldBehavior: 'NORMAL', readOnly: true },
      { fieldId: 'textField_marker', componentName: 'TextField', fieldBehavior: 'READONLY' },
    ] } },
  } };
  utils.httpGet.mockImplementation(async (_base, requestPath) => {
    if (requestPath.endsWith('getFormDataById.json')) {
      return { success: true, content: { formUuid: 'FORM-TEST', formInstId: 'FINST-TEST' } };
    }
    if (requestPath.endsWith('queryOperatePermission.json')) { return operations; }
    if (requestPath.endsWith('getFormEditSchema.json') || requestPath.endsWith('getFormSchema.json')) { return editSchema; }
    throw new Error(`Unexpected read: ${requestPath}`);
  });
  utils.httpPost.mockResolvedValue({ success: true, content: null });
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

test('only an allowed update reaches the existing mutation once, after both native reads', async () => {
  await run([...args, '--data-json', '{"dateField_due":1793145600000}']);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_TEST/v1/form/updateFormData.json');
  expect(new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('updateFormDataJson')).toBe('{"dateField_due":1793145600000}');
  expect(utils.httpGet).toHaveBeenCalledTimes(3);
  expect(utils.httpGet.mock.invocationCallOrder[2]).toBeLessThan(utils.httpPost.mock.invocationCallOrder[0]);
});

test.each([
  '{"textField_marker":"changed"}',
  '{"dateField_due":123,"textField_marker":"changed"}',
  '{"unknownField":"changed"}',
])('no mutation is sent for a forbidden or mixed patch: %s', async json => {
  await expect(run([...args, '--data-json', json])).rejects.toMatchObject({
    code: 'DATA_FORM_FIELDS_NOT_EDITABLE', details: { mutationPerformed: false, sideEffectState: 'not_started' },
  });
  expect(utils.httpPost).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
});

test('aliases are translated before field permission checks', async () => {
  await run([...args, '--data-json', '{"due":123}', '--resolve-aliases']);
  expect(new URLSearchParams(utils.httpPost.mock.calls[0][2]).get('updateFormDataJson')).toBe('{"dateField_due":123}');
  utils.httpPost.mockClear();
  await expect(run([...args, '--data-json', '{"marker":"changed"}', '--resolve-aliases']))
    .rejects.toMatchObject({ code: 'DATA_FORM_FIELDS_NOT_EDITABLE' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('a record without edit permission stops before reading its edit schema', async () => {
  operations.content = { OPERATE_EDIT: 'n', OPERATE_EDIT_AFTER_PROCESS: 'n' };
  await expect(run([...args, '--data-json', '{"dateField_due":123}']))
    .rejects.toMatchObject({ code: 'DATA_FORM_UPDATE_FORBIDDEN' });
  expect(utils.httpPost).not.toHaveBeenCalled();
  expect(utils.httpGet).toHaveBeenCalledTimes(2);
});

test('a missing or failed edit context never falls back to the v1 write', async () => {
  editSchema = { success: false, errorCode: 'FORBIDDEN' };
  await expect(run([...args, '--data-json', '{"dateField_due":123}']))
    .rejects.toMatchObject({ code: 'DATA_FORM_EDIT_CONTEXT_UNVERIFIED' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('ordinary form creation retains its existing contract', async () => {
  utils.httpPost.mockResolvedValue({ success: true, content: 'FINST-NEW' });
  await run(['create', 'form', 'APP_TEST', 'FORM-TEST', '--expect-form-name', 'TEST',
    '--expect-form-type', 'receipt', '--data-json', '{"dateField_due":123}']);
  expect(utils.httpGet).not.toHaveBeenCalled();
  expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_TEST/v1/form/saveFormData.json');
});
