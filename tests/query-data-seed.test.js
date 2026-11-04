'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/core/utils', () => ({ loadAuthData: jest.fn(), resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(), httpPost: jest.fn(), triggerLogin: jest.fn(), requestWithAutoLogin: jest.fn() }));
jest.mock('../lib/app/services/form-mode-service', () => ({ readFormMode: jest.fn() }));
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn() }));

const { run } = require('../lib/core/query-data');
const utils = require('../lib/core/utils');
const modes = require('../lib/app/services/form-mode-service');
const navigation = require('../lib/app/form-navigation');
let dir, source, log, schema, saved;
const invoke = (extra = []) => run(['seed', 'form', 'APP_TEST', 'FORM-TEST', '--expect-form-name', '客户', '--records-file', source, '--json', ...extra]);

beforeEach(() => {
  jest.clearAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-seed-cli-'));
  source = path.join(dir, 'records.json');
  fs.writeFileSync(source, JSON.stringify([{ textField_name: '远山科技', dateField_due: '2026-11-03' }, { textField_name: '青禾商贸' }]));
  saved = new Map();
  schema = { success: true, content: { pages: [{ componentsTree: [
    { componentName: 'TextField', props: { fieldId: 'textField_name', label: '客户名称' } },
    { componentName: 'TextField', props: { fieldId: 'textField_other' } },
    { componentName: 'DateField', props: { fieldId: 'dateField_due' } },
  ], componentAlias: { items: [
    { fieldId: 'textField_name', alias: 'name' },
    { fieldId: 'textField_other', alias: 'textField_name' },
  ] } }] } };
  utils.loadAuthData.mockReturnValue({ auth_mode: 'token', auth_source: 'token', corp_id: 'corp', user_id: 'user' });
  utils.requestWithAutoLogin.mockImplementation((fn, auth) => fn(auth));
  navigation.fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-TEST', formName: '客户', formType: 'receipt' }]);
  modes.readFormMode.mockResolvedValue({ mode: 'receipt' });
  utils.httpGet.mockImplementation(async (_base, url, params) => {
    if (url.includes('getFormSchema')) {return schema;}
    return { success: true, content: { formInstId: params.formInstId, modelUuid: 'FORM-TEST', formData: saved.get(params.formInstId) } };
  });
  utils.httpPost.mockImplementation(async (_base, _url, body) => {
    const params = new URLSearchParams(body);
    const id = `ID-${saved.size + 1}`;
    saved.set(id, JSON.parse(params.get('formDataJson')));
    return { success: true, content: id };
  });
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { log.mockRestore(); fs.rmSync(dir, { recursive: true, force: true }); });

test('public route reads schema once, converts dates, creates and verifies every ID', async () => {
  await invoke();
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ success: true, completed: 2,
    readbackVerified: true, formInstIds: ['ID-1', 'ID-2'] });
  expect(saved.get('ID-1')).toEqual({ textField_name: '远山科技', dateField_due: Date.parse('2026-11-03T00:00:00+08:00') });
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormSchema'))).toHaveLength(1);
  expect(utils.httpPost.mock.calls.every(call => call[1] === '/dingtalk/web/APP_TEST/v1/form/saveFormData.json')).toBe(true);
  expect(utils.httpGet.mock.calls.filter(call => call[1].includes('getFormDataById'))).toHaveLength(2);
  // Writes do not run through the auto-login/replay wrapper.
  expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(3);
});

test('does not reinterpret canonical IDs as aliases after schema compilation', async () => {
  await invoke(['--resolve-aliases']);
  expect(saved.get('ID-1').textField_name).toBe('远山科技');
  expect(saved.get('ID-1').textField_other).toBeUndefined();
});

test('explicit configured aliases work, display labels fail before writes', async () => {
  fs.writeFileSync(source, JSON.stringify([{ name: '远山科技' }]));
  await invoke(['--resolve-aliases']);
  expect(saved.get('ID-1')).toEqual({ textField_name: '远山科技' });
  fs.writeFileSync(source, JSON.stringify([{ 客户名称: 'A' }]));
  await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_PREFLIGHT_FAILED' });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each(['name', 'type', 'mode'])('rejects mismatched target %s before any write', async kind => {
  if (kind === 'name') {navigation.fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-TEST', formName: '其他', formType: 'receipt' }]);}
  if (kind === 'type') {navigation.fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-TEST', formName: '客户', formType: 'process' }]);}
  if (kind === 'mode') {modes.readFormMode.mockResolvedValue({ mode: 'process', processCode: 'PROC' });}
  await expect(invoke()).rejects.toMatchObject({ code: 'DATA_TARGET_IDENTITY_MISMATCH' });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('readback mismatch stops at first record and preserves its ID for read-only recovery', async () => {
  const originalGet = utils.httpGet.getMockImplementation();
  utils.httpGet.mockImplementation(async (...args) => args[1].includes('getFormSchema') ? schema
    : { success: true, content: { formInstId: args[2].formInstId, formUuid: 'FORM-TEST', formData: {} } });
  await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE', details: {
    failedIndex: 0, causeCode: 'DATA_WRITE_READBACK_MISMATCH', partial: {
      items: [expect.objectContaining({ formInstId: 'ID-1' }), expect.anything()],
    },
  } });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
  utils.httpGet.mockImplementation(originalGet);
  await invoke();
  expect(utils.httpPost).toHaveBeenCalledTimes(2);
  expect(JSON.parse(log.mock.calls[0][0]).formInstIds).toEqual(['ID-1', 'ID-2']);
});

test('successful response with conflicting IDs is preserved without choosing or retrying one', async () => {
  utils.httpPost.mockResolvedValue({ success: true, formInstId: 'ID-A', content: { formInstId: 'ID-B' } });
  await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE', details: {
    items: [expect.objectContaining({ candidateIds: ['ID-A', 'ID-B'] }), expect.anything()],
  } });
  await expect(invoke()).rejects.toMatchObject({ code: 'DATA_SEED_INCOMPLETE' });
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test('--check performs schema validation but never creates records or receipts', async () => {
  await invoke(['--check']);
  expect(utils.httpPost).not.toHaveBeenCalled();
  expect(fs.existsSync(`${source}.seed-receipt.json`)).toBe(false);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ checked: true, mutationPerformed: false, count: 2 });
});

test.each([
  ['--expect-form-type', 'process'], ['--timezone', 'Asia/Shanghai'], ['--check', 'false'], ['--records-file'],
])('invalid option %j fails before auth', async (...extra) => {
  await expect(invoke(extra)).rejects.toMatchObject({ isCliError: true });
  expect(utils.loadAuthData).not.toHaveBeenCalled();
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test('unknown seed resource stays unsupported', async () => {
  await expect(run(['seed', 'process', 'APP_TEST', 'FORM-TEST'])).rejects.toMatchObject({ code: 'DATA_COMMAND_UNSUPPORTED' });
  expect(utils.loadAuthData).not.toHaveBeenCalled();
});
