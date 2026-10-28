'use strict';

const http = require('http');
const { createPermissionError } = require('../lib/core/permission-guidance');
const { shouldUseStructuredErrorOutput, toErrorPayload } = require('../lib/core/cli-error');
const { getLanguage, setLanguage } = require('../lib/core/i18n');
const { httpGet, httpPost, httpPostJson, httpPostMultipart, requestWithAutoLogin, requestNonIdempotentWithAuthPreflight } = require('../lib/core/utils');

const OPTIONS = { tool: 'qwenwork', baseUrl: 'https://tenant.example.test', httpStatus: 200 };
const USE_DENIED = '已升级宜搭,你未在授权范围内,因此无法使用,如要使用请联系管理员授权';
const CREATE_DENIED = '管理员暂未为您分配权限，请联系管理员授权';
const originalEnv = { ...process.env };
const originalLanguage = getLanguage();

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (/QWENWORK|QODER|MULE|AGENT_PLATFORM|__CFBundleIdentifier/.test(key)) { delete process.env[key]; }
  }
  process.env.OPENYIDA_AUTH_MODE = 'token';
  process.env.OPENYIDA_ACCESS_TOKEN = 'test-only-access';
  process.env.OPENYIDA_LANG = 'en';
  setLanguage('en');
});
afterEach(() => { process.env = { ...originalEnv }; setLanguage(originalLanguage); });

test('returns a clean same-origin permission link', () => {
  const error = createPermissionError({}, {
    ...OPTIONS, httpStatus: 302,
    location: '/defaultPage.html?type=noAppCreationAuth&corpid=ding-test&access_token=private&returnUrl=https://other.test#secret',
  });
  expect(toErrorPayload(error)).toMatchObject({
    success: false, errorCode: 'YIDA_APP_CREATE_PERMISSION_REQUIRED', retryable: false,
    nextAction: { type: 'open_url', url: 'https://tenant.example.test/defaultPage.html?type=noAppCreationAuth&corpid=ding-test' },
    details: { permissionType: 'create_app' },
  });
  expect(shouldUseStructuredErrorOutput(error, [])).toBe(true);
  expect(JSON.stringify(toErrorPayload(error))).not.toContain('private');
});

test.each([
  ['https://evil.test/defaultPage.html?type=unauth'],
  ['//evil.test/defaultPage.html?type=unauth'],
  ['/defaultPage.html?type=unauthSaaS'],
  ['/defaultPage.html?type=invite'],
  ['/defaultPage.html?type=unauth&type=noAppCreationAuth'],
  ['/another-page?type=noAppCreationAuth'],
  ['javascript:alert(1)'],
])('does not invent a permission link for redirect %s', location => {
  expect(createPermissionError({}, { ...OPTIONS, httpStatus: 302, location })).toBeNull();
});

test('recognizes the verified organization authorization error', () => {
  expect(createPermissionError({ success: false, errorCode: 'TIANSHU_000006', errorMsg: USE_DENIED }, OPTIONS))
    .toMatchObject({ code: 'YIDA_PLATFORM_ACCESS_REQUIRED', details: {
      permissionUrl: 'https://tenant.example.test/defaultPage.html?type=unauth', platformErrorCode: 'TIANSHU_000006',
    } });
});

test.each([
  ['unauth', '申请宜搭使用授权', '当前没有此组织的宜搭使用权限，可申请宜搭使用授权。'],
  ['noAppCreationAuth', '申请宜搭应用创建权限', '当前没有此组织的宜搭应用创建权限，可申请应用创建权限。'],
])('Chinese guidance for %s names the missing permission and returns its semantic link', (type, label, message) => {
  setLanguage('zh');
  const error = createPermissionError({ success: false, errorMsg: '原始平台错误' }, {
    ...OPTIONS, httpStatus: 302, location: `/defaultPage.html?type=${type}`,
  });
  const url = `${OPTIONS.baseUrl}/defaultPage.html?type=${type}`;
  const payload = toErrorPayload(error);
  expect(payload.errorMsg).toBe(message);
  expect(payload.nextAction).toEqual({ type: 'open_url', label, url });
  expect(payload.nextStep).toContain(`[${label}](${url})`);
  expect(payload.details).toMatchObject({ permissionLabel: label, permissionUrl: url, platformErrorMessage: '原始平台错误' });
});

test('only classifies the legacy creation error at the verified register endpoint', () => {
  const response = { success: false, errorCode: '000006', errorMsg: CREATE_DENIED };
  expect(createPermissionError(response, { ...OPTIONS, requestPath: '/query/app/registerApp.json' }))
    .toMatchObject({ code: 'YIDA_APP_CREATE_PERMISSION_REQUIRED' });
  const unknown = createPermissionError(response, { ...OPTIONS, requestPath: '/query/form/update.json' });
  expect(unknown).toMatchObject({ code: 'YIDA_PERMISSION_REQUIRED', message: CREATE_DENIED });
  expect(unknown.details).not.toHaveProperty('nextAction');
  expect(unknown.details).not.toHaveProperty('permissionUrl');
});

test.each([
  { success: false, errorCode: '000006', errorMsg: 'Other permission denied' },
  { success: false, errorCode: '403' },
])('preserves unclassified permission errors without choosing a page', response => {
  const error = createPermissionError(response, OPTIONS);
  expect(error).toMatchObject({ code: 'YIDA_PERMISSION_REQUIRED', details: { platformErrorCode: response.errorCode } });
  expect(error.details).not.toHaveProperty('permissionUrl');
});

test.each(['codex', 'qoder', 'qoderwork', undefined])('keeps existing behavior in %s', tool => {
  expect(createPermissionError({ success: false, errorCode: '000006', errorMsg: USE_DENIED }, { ...OPTIONS, tool })).toBeNull();
});

test.each([
  [{ status: 'invalid_access_token' }, 403],
  [{ errorMsg: 'access token is invalid or expired' }, 403],
  [{ success: false, errorCode: 'expired_access_token' }, 200],
  [{}, 401],
  [{ success: true, content: { errorCode: '000006' } }, 200],
])('leaves credential failures and successful responses to existing handlers', (response, httpStatus) => {
  expect(createPermissionError(response, { ...OPTIONS, httpStatus })).toBeNull();
});

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

const transports = {
  get: base => httpGet(base, '/query/app/registerApp.json', null, { silentStatus: true }),
  form: base => httpPost(base, '/query/app/registerApp.json', '', { silentStatus: true }),
  json: base => httpPostJson(base, '/query/app/registerApp.json', {}, { silentStatus: true }),
  multipart: base => httpPostMultipart(base, '/query/app/registerApp.json', {}, {}, { silentStatus: true }),
};

test.each(Object.keys(transports))('%s stops at a permission redirect without refreshing or replaying', async transport => {
  process.env.QWENWORK_INTEGRATION_MODE = '1';
  let calls = 0;
  await withServer((_req, res) => {
    calls++;
    res.writeHead(302, { Location: '/defaultPage.html?type=unauth' });
    res.end();
  }, async base => {
    await expect(requestWithAutoLogin(() => transports[transport](base), { baseUrl: base }))
      .rejects.toMatchObject({ code: 'YIDA_PLATFORM_ACCESS_REQUIRED', details: {
        permissionUrl: `${base}/defaultPage.html?type=unauth`,
      } });
  });
  expect(calls).toBe(1);
});

test.each([false, true])('real HTTP preserves non-Qwen behavior; qwen=%s', async qwen => {
  if (qwen) { process.env.QWENWORK = '1'; }
  await withServer((_req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, errorCode: '000006', errorMsg: CREATE_DENIED }));
  }, async base => {
    if (qwen) {
      await expect(transports.form(base)).rejects.toMatchObject({ code: 'YIDA_APP_CREATE_PERMISSION_REQUIRED' });
    } else {
      await expect(transports.form(base)).resolves.toMatchObject({ __needLogin: true, __httpStatus: 403 });
    }
  });
});

test('a denied read-only preflight stops the subsequent non-idempotent write', async () => {
  process.env.QWENWORK = '1';
  const write = jest.fn();
  await withServer((_req, res) => {
    res.writeHead(302, { Location: '/defaultPage.html?type=unauth' }); res.end();
  }, async base => {
    await expect(requestNonIdempotentWithAuthPreflight(write, () => transports.get(base), { baseUrl: base }))
      .rejects.toMatchObject({ code: 'YIDA_PLATFORM_ACCESS_REQUIRED' });
  });
  expect(write).not.toHaveBeenCalled();
});
