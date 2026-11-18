'use strict';

jest.mock('../lib/core/yida-client', () => {
  const actual = jest.requireActual('../lib/core/yida-client');
  return { ...actual, createYidaClient: jest.fn() };
});
jest.mock('../lib/app/get-form-config', () => ({ fetchFormSchemaInfo: jest.fn() }));

const { createYidaClient } = require('../lib/core/yida-client');
const { fetchFormSchemaInfo } = require('../lib/app/get-form-config');
const { run, parse } = require('../lib/app/datav');

const app = 'APP_TEST';
const form = 'DATAV-SCREEN';
let client;
let output;

beforeEach(() => {
  jest.clearAllMocks();
  client = { getAuthRef: () => ({ baseUrl: 'https://example.test', authMode: 'token' }),
    get: jest.fn().mockResolvedValue({ success: true, content: 37 }),
    postFormOnce: jest.fn().mockResolvedValue({ success: true, content: form }) };
  createYidaClient.mockReturnValue(client);
  fetchFormSchemaInfo.mockResolvedValue({ success: true, content: {
    formUuid: form, appType: app, formType: 'datav', title: { zh_CN: 'Existing', ja_JP: '保持' },
  } });
  output = jest.spyOn(console, 'log').mockImplementation(() => true);
});

afterEach(() => {jest.restoreAllMocks();});

function receipt() {return JSON.parse(output.mock.calls.at(-1)[0]);}

test('creation matches the platform template payload and verifies async readiness', async () => {
  await run(['create', app, 'Operations', '--template', '123', '--locale', 'en_US', '--json']);
  const [path, body] = client.postFormOnce.mock.calls[0];
  expect(path).toBe('/alibaba/web/APP_TEST/query/datavscreen/createDatavScreenInfo.json');
  const payload = body({ csrfToken: 'csrf' });
  expect(payload).toMatchObject({ formType: 'datav', templateUuid: '123', _csrf_token: 'csrf' });
  expect(JSON.parse(payload.title)).toMatchObject({ zh_CN: 'Operations', en_US: 'Operations' });
  expect(client.get).toHaveBeenCalledWith('/alibaba/web/APP_TEST/query/datavscreen/getCreateDatavResult.json', { formUuid: form });
  expect(receipt()).toMatchObject({ created: true, readbackVerified: true, state: 'ready', datavId: 37 });
});

test('a pending create retains its identity and cannot be mistaken for a failed allocation', async () => {
  client.get.mockResolvedValue({ success: true, content: -1 });
  await expect(run(['create', app, 'Pending', '--wait-seconds', '0'])).rejects.toMatchObject({
    code: 'DATAV_CREATE_PENDING', details: { formUuid: form, created: true, retrySafe: false,
      recovery: ['datav', 'inspect', app, form, '--json'] },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('readback failure after creation retains the allocated resource for recovery', async () => {
  fetchFormSchemaInfo.mockRejectedValue(new Error('read unavailable'));
  await expect(run(['create', app, 'Created'])).rejects.toMatchObject({
    code: 'DATAV_CREATE_UNVERIFIED', details: { formUuid: form, created: true, sideEffectState: 'applied', retrySafe: false },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('uncertain writes are never automatically replayed', async () => {
  client.postFormOnce.mockRejectedValue(new Error('connection closed'));
  await expect(run(['create', app, 'Uncertain'])).rejects.toMatchObject({
    code: 'DATAV_WRITE_UNCERTAIN', details: { sideEffectState: 'unknown', retrySafe: false, recovery: ['list-forms', app] },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('missing created identity requires listing existing resources instead of creating again', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: {} });
  await expect(run(['create', app, 'Uncertain'])).rejects.toMatchObject({
    code: 'DATAV_CREATE_UNVERIFIED', details: { retrySafe: false, recovery: ['list-forms', app] },
  });
  expect(client.get).not.toHaveBeenCalled();
});

test('business failures preserve quota/entitlement errors without authorizing or retrying', async () => {
  client.postFormOnce.mockResolvedValue({ success: false, errorCode: '300110', errorMsg: 'Quota exceeded' });
  await expect(run(['create', app, 'Quota'])).rejects.toMatchObject({
    code: 'DATAV_REQUEST_FAILED', details: { platformErrorCode: '300110' },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(fetchFormSchemaInfo).not.toHaveBeenCalled();
});

test('an inner MVC ServiceResult failure is not treated as an accepted write', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: {
    success: false, content: null, result: null, errorCode: '300112', errorMsg: 'DataV refused the rename',
  } });
  await expect(run(['rename', app, form, 'Rejected'])).rejects.toMatchObject({
    code: 'DATAV_REQUEST_FAILED', details: { platformErrorCode: '300112' },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
  expect(fetchFormSchemaInfo).toHaveBeenCalledTimes(1);
});

test('a false result from the publish ServiceResult is not a successful publication', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: null, result: false });
  await expect(run(['publish', app, form, '--confirm'])).rejects.toMatchObject({ code: 'DATAV_WRITE_UNCERTAIN' });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test.each(['copy', 'rename', 'publish'])('rejects %s on a custom page before any write', async action => {
  fetchFormSchemaInfo.mockResolvedValue({ success: true, content: { formType: 'display' } });
  const args = [action, app, form];
  if (action !== 'publish') {args.push('Name');} else {args.push('--confirm');}
  await expect(run(args)).rejects.toMatchObject({ code: 'DATAV_TYPE_REQUIRED' });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('template pagination is read-only and does not return a false successful empty placeholder', async () => {
  const templates = { data: [{ templateId: 12 }], totalCount: 1 };
  client.get.mockResolvedValue({ success: true, content: templates });
  await run(['templates', app, '--page', '2', '--page-size', '5']);
  expect(client.get).toHaveBeenCalledWith('/alibaba/web/APP_TEST/datavtemplate/getTemplateList.json', { pageIndex: 2, pageSize: 5 });
  expect(receipt()).toMatchObject({ page: 2, pageSize: 5, templates });
  expect(client.postFormOnce).not.toHaveBeenCalled();
});

test('copy uses a verified source and returns the new resource identity', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: { formUuid: 'DATAV-COPY' } });
  fetchFormSchemaInfo.mockImplementation(async (ref, appType, formUuid) => ({ success: true, content: { formType: 'datav', formUuid } }));
  await run(['copy', app, form, 'Copy']);
  const [path, body] = client.postFormOnce.mock.calls[0];
  expect(path).toContain('/copyDatavScreen.json');
  expect(body({})).toMatchObject({ formUuid: form, appKey: app });
  expect(receipt()).toMatchObject({ formUuid: 'DATAV-COPY', created: true });
});

test('rename derives the DataV ID, preserves unrelated language titles and verifies the result', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: { success: true, content: null, result: true } });
  fetchFormSchemaInfo.mockResolvedValueOnce({ success: true, content: {
    formType: 'datav', title: { zh_CN: 'Existing', en_US: 'Old', ja_JP: '保持' },
  } }).mockResolvedValue({ success: true, content: {
    formType: 'datav', title: { zh_CN: 'Renamed', en_US: 'Renamed', ja_JP: '保持' },
  } });
  await run(['rename', app, form, 'Renamed', '--locale', 'en_US']);
  const [path, body] = client.postFormOnce.mock.calls[0];
  expect(path).toContain('/modifyScreen.json');
  expect(body({})).toMatchObject({ formUuid: form, datavId: 37 });
  expect(JSON.parse(body({}).screenTitle)).toEqual({ zh_CN: 'Renamed', en_US: 'Renamed', ja_JP: '保持' });
  expect(receipt().readbackVerified).toBe(true);
});

test('rename mismatch is reported as applied but unverified without a repair write', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: true });
  await expect(run(['rename', app, form, 'Renamed'])).rejects.toMatchObject({
    code: 'DATAV_READBACK_UNVERIFIED', details: { sideEffectState: 'applied', retrySafe: false },
  });
  expect(client.postFormOnce).toHaveBeenCalledTimes(1);
});

test('explicit publish enables the screen but does not claim preview validation or expose share credentials', async () => {
  client.postFormOnce.mockResolvedValue({ success: true, content: null, result: true });
  await run(['publish', app, form, '--confirm']);
  expect(client.postFormOnce.mock.calls[0][0]).toContain('/saveScreen.json');
  expect(receipt()).toMatchObject({ publishAccepted: true, enableRequested: true, layoutVerified: false, readbackVerified: false });
  expect(receipt().designerUrl).toBe('https://example.test/alibaba/web/APP_TEST/datav/vigoDesigner.html?formUuid=DATAV-SCREEN');
  expect(receipt().previewUrl).toBe('https://example.test/alibaba/web/APP_TEST/datav/preview.html?formUuid=DATAV-SCREEN');
});

test.each([
  ['create', app, 'Screen', '--template', 'abc'], ['create', app, 'Screen', '--wait-seconds', '61'],
  ['templates', app, '--page', '0'], ['publish', app, form, '--confirm', '--template', '1'], ['create', app, ' '],
  ['create', app, 'Screen', '--locale', 'xx'], ['rename', app, 'FORM-../bad', 'Name'],
])('rejects malformed options before authentication: %j', async (...args) => {
  expect(() => parse(args)).toThrow();
  await expect(run(args)).rejects.toThrow();
  expect(createYidaClient).not.toHaveBeenCalled();
});


test('managed mutations use the target app and preserve the screen identity for refresh', async () => {
  const { assertManagedInvocation } = require('../lib/agent/managed-run');
  const { beginManagedMutationCapture } = require('../lib/agent/mutation-receipt');
  const { resolveManagedPolicy } = require('../lib/core/managed-policy');
  expect(resolveManagedPolicy('datav', ['create', app, 'Name']).policy).toMatchObject({ scope: 'app', appPosition: 1 });
  const env = {
    OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: app,
    OPENYIDA_AGENT_CORP_ID: 'corp-a', OPENYIDA_AGENT_USER_ID: 'user-a',
    OPENYIDA_AGENT_RUN_ID: 'run-a', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt-a',
    OPENYIDA_AGENT_BASE_URL: 'https://example.test', OPENYIDA_AGENT_TASK_GRANT: 'task_' + 'g'.repeat(48),
  };
  expect(assertManagedInvocation('datav', ['create', app, 'Name'], { env })).toMatchObject({ appType: app });
  expect(() => assertManagedInvocation('datav', ['create', 'APP_OTHER', 'Name'], { env })).toThrow(expect.objectContaining({ code: 'MANAGED_APP_MISMATCH' }));
  const capture = beginManagedMutationCapture({ command: 'datav', args: ['create', app, 'Name'], eventId: 'datav-test',
    env: { OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: app } });
  await run(['create', app, 'Name']);
  expect(capture.commit()).toMatchObject({ operation: 'create_page', appType: app, formUuid: form, pageType: 'datav' });
});


test('publish requires confirmation before authentication or enabling a screen', async () => {
  await expect(run(['publish', app, form])).rejects.toMatchObject({ code: 'DATAV_PUBLISH_CONFIRM_REQUIRED' });
  expect(createYidaClient).not.toHaveBeenCalled();
});
