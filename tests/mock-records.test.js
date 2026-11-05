'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../lib/core/yida-client', () => ({ createYidaClient: jest.fn() }));
const { createYidaClient } = require('../lib/core/yida-client');
const { validateArguments, mockRecords } = require('../lib/core/mock-records');
const { createPermissionError } = require('../lib/core/permission-guidance');

const target = ['APP_SAMPLE', 'FORM-SAMPLE'];
const session = { baseUrl: 'https://www.aliwork.com', corpId: 'corp-example', userId: 'user-example' };
const rows = [1, 2, 3].map(index => ({ clientRecordId: `seed-${index}`, data: { textField_name: `客户 ${index}` } }));
const requestId = 'request-example-001';

function result(status = 'COMPLETED', states = ['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED']) {
  return { success: true, content: { requestId, status,
    results: states.map((state, index) => ({ clientRecordId: `seed-${index + 1}`, status: state,
      ...(state === 'SUCCEEDED' ? { formInstId: `FINST_${index}` } : {}) })),
    createdCount: states.filter(state => state === 'SUCCEEDED').length,
    failedCount: states.filter(state => state === 'FAILED').length,
    unknownCount: states.filter(state => state === 'UNKNOWN').length,
    notStartedCount: states.filter(state => state === 'NOT_STARTED').length,
  } };
}

function rejected(code = 'AI_RATE_LIMITED') {
  return { success: false, errorCode: code, errorMsg: 'untrusted platform error', content: {
    requestId, status: 'REJECTED', error: { code, retryable: code === 'AI_RATE_LIMITED',
      sideEffectState: 'NONE', retryAfterSeconds: 2, message: '当前请求已被拒绝', nextAction: 'INSPECT_REQUEST' },
  } };
}

describe('AI-friendly mock records', () => {
  let directory;
  let file;
  let options;
  let client;
  let output;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-mock-'));
    file = path.join(directory, 'records.json');
    fs.writeFileSync(file, JSON.stringify(rows));
    options = { records_file: file, expect_form_name: '客户', request_id: requestId };
    client = { postJsonOnce: jest.fn().mockResolvedValue(result()), get: jest.fn() };
    createYidaClient.mockReturnValue(client);
    output = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('three rows use one JSON POST and do not persist local state', async () => {
    await mockRecords(target, options, session);
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
    expect(client.postJsonOnce).toHaveBeenCalledWith('/dingtalk/web/APP_SAMPLE/query/aiTool/mockRecords.json',
      { requestId, formUuid: 'FORM-SAMPLE', expectedFormName: '客户', expectedFormType: 'receipt', records: rows },
      { timeout: 100000, silentStatus: true });
    expect(client.get).not.toHaveBeenCalled();
    expect(fs.readdirSync(directory)).toEqual(['records.json']);
    expect(JSON.parse(output.mock.calls[0][0]).content).toMatchObject({ requestId, readbackVerified: false, createdCount: 3 });
  });

  test('a default request ID is generated only for tracing and a second invocation is another write', async () => {
    delete options.request_id;
    client.postJsonOnce.mockImplementation(async (_requestPath, payload) => ({ ...result(), content: { ...result().content, requestId: payload.requestId } }));
    await mockRecords(target, options, session);
    await mockRecords(target, options, session);
    const ids = client.postJsonOnce.mock.calls.map(call => call[1].requestId);
    expect(ids[0]).toMatch(/^[a-f0-9-]{36}$/);
    expect(ids[0]).not.toBe(ids[1]);
    expect(client.postJsonOnce).toHaveBeenCalledTimes(2);
    expect(fs.readdirSync(directory)).toEqual(['records.json']);
  });

  test.each([
    ['timeout', () => Promise.reject(new Error('sensitive upstream details'))],
    ['login expired', () => Promise.resolve({ __needLogin: true })],
    ['legacy failure', () => Promise.resolve({ success: false, errorCode: '500', errorMsg: 'sensitive' })],
    ['double envelope', () => Promise.resolve({ success: true, content: result() })],
    ['count mismatch', () => Promise.resolve({ ...result(), content: { ...result().content, createdCount: 99 } })],
    ['wrong request', () => Promise.resolve({ ...result(), content: { ...result().content, requestId: 'unrelated' } })],
    ['success without request', () => Promise.resolve({ ...result(), content: { ...result().content, requestId: '' } })],
    ['rejection for another request', () => Promise.resolve({ ...rejected('AI_FIELD_INVALID'),
      content: { ...rejected('AI_FIELD_INVALID').content, requestId: 'unrelated' } })],
  ])('%s reports all unconfirmed rows as unknown without retrying or falling back', async (_label, response) => {
    client.postJsonOnce.mockImplementation(response);
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code: 'AI_MOCK_OUTCOME_UNKNOWN', details: {
      requestId, status: 'UNKNOWN', unknownCount: 3, createdCount: 0, retrySafe: false,
      sideEffectState: 'unknown', nextAction: 'VERIFY_DATA_DO_NOT_RESUBMIT',
    } });
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
    expect(client.get).not.toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
  });

  test.each([
    ['COMPLETED', ['SUCCEEDED', 'FAILED', 'NOT_STARTED'], 'AI_MOCK_PARTIAL'],
    ['UNKNOWN', ['SUCCEEDED', 'UNKNOWN', 'NOT_STARTED'], 'AI_MOCK_OUTCOME_UNKNOWN'],
    ['COMPLETED', ['FAILED', 'NOT_STARTED', 'NOT_STARTED'], 'AI_MOCK_FAILED'],
  ])('%s preserves known row results without treating protocol success as full creation', async (status, states, code) => {
    client.postJsonOnce.mockResolvedValue(result(status, states));
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code, details: {
      requestId, status, results: result(status, states).content.results,
    } });
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
    expect(output).not.toHaveBeenCalled();
  });

  test.each(['AI_RATE_LIMITED', 'AI_API_NOT_ENABLED'])('%s is reported without retries or fallback', async code => {
    client.postJsonOnce.mockResolvedValue(rejected(code));
    let error;
    try { await mockRecords(target, options, session); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code, details: { status: 'REJECTED', sideEffectState: 'none', retrySafe: false } });
    expect(error.message).toContain('当前请求已被拒绝');
    expect(JSON.stringify(error)).not.toContain('untrusted platform error');
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
    expect(client.get).not.toHaveBeenCalled();
  });

  test('the existing entry filter rate limit is a known rejection without any automatic retry', async () => {
    client.postJsonOnce.mockResolvedValue({ success: false, errorCode: 'TIANSHU_000071', content: {} });
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code: 'AI_RATE_LIMITED', details: {
      status: 'REJECTED', createdCount: 0, unknownCount: 0, notStartedCount: 3, sideEffectState: 'none',
    } });
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
  });

  test.each([
    [{ __needLogin: true, __httpStatus: 401 }, 'AI_UNAUTHORIZED'],
    [{ __needLogin: true, __httpStatus: 403 }, 'AI_FORBIDDEN'],
    [{ __csrfExpired: true }, 'AI_UNAUTHORIZED'],
  ])('known entry authentication rejection %# stays rejected without a retry', async (response, code) => {
    client.postJsonOnce.mockResolvedValue(response);
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code, details: {
      requestId, status: 'REJECTED', unknownCount: 0, notStartedCount: 3, sideEffectState: 'none',
      error: { nextAction: 'RESOLVE_PERMISSION' },
    } });
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
    expect(client.get).not.toHaveBeenCalled();
  });

  test('QwenWork permission guidance remains a friendly known rejection', async () => {
    const permission = createPermissionError({ success: false, errorCode: 'TIANSHU_000006' },
      { tool: 'qwenwork', httpStatus: 403, baseUrl: session.baseUrl });
    client.postJsonOnce.mockRejectedValue(permission);
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code: 'YIDA_PERMISSION_REQUIRED', details: {
      requestId, status: 'permission_required', batchStatus: 'REJECTED', sideEffectState: 'none', notStartedCount: 3,
    } });
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
  });

  test.each([null, undefined, ''])('typed pre-controller rejection accepts an absent request ID (%s) and retains safe field diagnostics', async missingRequestId => {
    const response = rejected('AI_FIELD_INVALID');
    response.content.requestId = missingRequestId;
    response.content.error.fieldErrors = [{ code: 'AI_FIELD_INVALID', retryable: false, sideEffectState: 'NONE',
      fieldId: 'numberField_n', fieldPath: 'records[0].data.numberField_n', rowIndex: 0, message: 'untrusted platform error' }];
    client.postJsonOnce.mockResolvedValue(response);
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code: 'AI_FIELD_INVALID', details: {
      requestId, status: 'REJECTED', notStartedCount: 3,
      error: { fieldErrors: [expect.objectContaining({ fieldId: 'numberField_n', rowIndex: 0 })] },
    } });
    expect(client.postJsonOnce).toHaveBeenCalledTimes(1);
  });

  test('alias preparation is shared by the complete batch', async () => {
    const prepare = jest.fn(async records => records);
    await mockRecords(target, options, session, prepare);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(rows);
  });

  test.each([[], [...rows, rows[0]], [{ clientRecordId: 'a', data: {} }], [rows[0], rows[0]],
    [{ clientRecordId: 'a', data: { numberField_n: 9007199254740992 } }],
    [{ clientRecordId: 'a', data: { textField_a: 'x'.repeat(17000) } }],
  ].map(records => [records]))('invalid records case %# is rejected without dispatching', async records => {
    fs.writeFileSync(file, JSON.stringify(records));
    await expect(mockRecords(target, options, session)).rejects.toMatchObject({ code: 'AI_INVALID_ARGUMENT' });
    expect(client.postJsonOnce).not.toHaveBeenCalled();
    expect(fs.readdirSync(directory)).toEqual(['records.json']);
  });

  test.each([
    { records_file: true, expect_form_name: '客户' },
    { records_file: 'records.json', expect_form_name: '客户', retry: true },
    { records_file: 'records.json', expect_form_name: '客户', operation_id: 'old-operation' },
    { records_file: 'records.json', expect_form_name: '客户', expect_form_type: 'process' },
    { records_file: 'records.json', expect_form_name: '客户', schema_version: '9007199254740992' },
    { records_file: 'records.json', expect_form_name: '客户', request_id: '../request' },
  ])('argument validation rejects unsupported or ambiguous values %j', invalidOptions => {
    expect(() => validateArguments(target, invalidOptions)).toThrow(expect.objectContaining({ code: 'AI_INVALID_ARGUMENT' }));
  });
});
