'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(() => ({ base_url: 'https://example.com', auth_mode: 'token',
    auth_source: 'token', corp_id: 'corp-1', user_id: 'ordinary-user' })),
  resolveBaseUrl: jest.fn(() => 'https://example.com'), triggerLogin: jest.fn(),
  httpGet: jest.fn(), httpPost: jest.fn(), requestWithAutoLogin: jest.fn(fn => fn({ baseUrl: 'https://example.com' })),
}));
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn(async () => [
  { formUuid: 'FORM-TEST', formName: '测试表单', formType: 'receipt' },
]) }));

const utils = require('../lib/core/utils');
const { setLanguage } = require('../lib/core/i18n');
const { run } = require('../lib/core/query-data');
const { toErrorPayload, shouldUseStructuredErrorOutput } = require('../lib/core/cli-error');

const message = '您无更改该数据的权限';
const args = ['update', 'form', 'APP-TEST', '--form-uuid', 'FORM-TEST', '--inst-id', 'FINST-TEST',
  '--expect-form-name', '测试表单', '--expect-form-type', 'receipt', '--data-json', '{"textField_marker":"changed"}'];

function editSchema(behavior) {
  return { success: true, content: {
    pages: [{ id: 'FORM-TEST', componentsTree: [
      { componentName: 'TextField', props: { fieldId: 'textField_marker' } },
    ] }],
    instanceData: { id: 'FORM-TEST', flowData: { behaviors: [
      { fieldId: 'textField_marker', componentName: 'TextField', fieldBehavior: behavior },
    ] } },
  } };
}

function requests({ behavior = 'NORMAL', record, operations, refusalAt } = {}) {
  const denied = { success: false, errorCode: '500', errorMsg: '没有权限', traceId: 'trace-denied' };
  utils.httpGet.mockImplementation(async (_base, path) => {
    if (path.endsWith(refusalAt || '/never')) { return denied; }
    if (path.endsWith('getFormDataById.json')) {
      return { success: true, content: record === undefined ? { formInstId: 'FINST-TEST', modelUuid: 'FORM-TEST' } : record };
    }
    if (path.endsWith('queryOperatePermission.json')) { return { success: true, content: operations || { OPERATE_EDIT: 'y' } }; }
    return editSchema(behavior);
  });
  utils.httpPost.mockResolvedValue(denied);
}

beforeEach(() => {
  jest.clearAllMocks();
  setLanguage('zh');
});

test.each(['READONLY', 'HIDDEN', 'DISABLED'])(
  '%s field directly returns the requested permission message and makes zero writes', async behavior => {
    requests({ behavior });
    const error = await run(args).catch(value => value);
    expect(toErrorPayload(error)).toMatchObject({ success: false, errorCode: 'DATA_FORM_FIELDS_NOT_EDITABLE',
      errorMsg: message, mutationPerformed: false, nextStep: 'request_edit_permission',
      details: { fields: [{ path: 'textField_marker', reason: 'field_not_editable', behavior }] } });
    expect(shouldUseStructuredErrorOutput(error)).toBe(true);
    expect(error.usage).toBeUndefined();
    expect(utils.httpPost).not.toHaveBeenCalled();
  }
);

test('a record without edit permission returns the same message', async () => {
  requests({ operations: { OPERATE_EDIT: 'n' } });
  await expect(run(args)).rejects.toMatchObject({ code: 'DATA_FORM_UPDATE_FORBIDDEN', message });
  expect(utils.httpPost).not.toHaveBeenCalled();
});

test.each(['getFormDataById.json', 'queryOperatePermission.json', 'getFormEditSchema.json'])(
  'an explicit upstream permission refusal at %s is not reported as a target mismatch', async refusalAt => {
    requests({ refusalAt });
    const error = await run(args).catch(value => value);
    expect(toErrorPayload(error)).toMatchObject({ errorCode: 'DATA_FORM_UPDATE_FORBIDDEN', errorMsg: message,
      stage: 'preflight', mutationPerformed: false, details: { causeCode: '500', traceId: 'trace-denied' } });
    expect(shouldUseStructuredErrorOutput(error)).toBe(true);
    expect(utils.httpPost).not.toHaveBeenCalled();
  }
);

test('a write rejected after preflight keeps its trace and is never retried', async () => {
  requests();
  const error = await run(args).catch(value => value);
  expect(toErrorPayload(error)).toMatchObject({ errorCode: 'DATA_FORM_UPDATE_FORBIDDEN', errorMsg: message,
    stage: 'write', retrySafe: false, sideEffectState: 'unknown', nextStep: 'read_back_before_retry',
    details: { traceId: 'trace-denied' } });
  expect(toErrorPayload(error)).not.toHaveProperty('mutationPerformed');
  expect(shouldUseStructuredErrorOutput(error)).toBe(true);
  expect(utils.httpPost).toHaveBeenCalledTimes(1);
});

test.each([null, { formInstId: 'FINST-TEST', modelUuid: 'FORM-OTHER' }])(
  'an absent or mismatched record remains a target error: %j', async record => {
    requests({ record });
    const error = await run(args).catch(value => value);
    expect(error.code).toBe('DATA_INSTANCE_TARGET_MISMATCH');
    expect(error.message).not.toBe(message);
    expect(utils.httpPost).not.toHaveBeenCalled();
  }
);

test('a dynamically unverifiable field is not reported as a confirmed permission denial', async () => {
  requests({ behavior: 'INVALID' });
  const error = await run(args).catch(value => value);
  expect(error.code).toBe('DATA_FORM_FIELDS_NOT_EDITABLE');
  expect(error.message).not.toBe(message);
  expect(utils.httpPost).not.toHaveBeenCalled();
});
