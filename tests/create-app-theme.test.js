'use strict';

jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(), httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, auth) => fn(auth)),
}));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn() }));
jest.mock('../lib/core/browser-handoff', () => ({
  parseOpenOption: args => ({ args, mode: 'never' }), withBrowserHandoff: value => value,
}));

const fs = require('fs');
const { httpGet, httpPost, requestWithAutoLogin } = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const { run } = require('../lib/app/create-app');
const { resolveAppThemeState } = require('../lib/app/app-theme-state');
const auth = { baseUrl: 'https://example.com', corpId: 'dingTEST', userId: 'user-1', csrfToken: 'fixture' };
const app = { appType: 'APP_TEST', corpId: auth.corpId, agentAppType: 'qwenwork',
  config: { CREATED_WITH_MODERN_THEME: 'y' } };

beforeEach(() => {
  jest.clearAllMocks();
  createAuthRef.mockReturnValue({ ...auth });
  requestWithAutoLogin.mockImplementation((fn, current) => fn(current));
  httpPost.mockImplementation(async (_base, url) => ({ success: true,
    content: url === '/query/app/registerApp.json' ? 'APP_TEST' : {} }));
  httpGet.mockResolvedValue({ success: true, content: app });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  jest.spyOn(fs, 'existsSync').mockReturnValue(false);
});
afterEach(() => jest.restoreAllMocks());

test.each(['qwenwork', 'local', 'cloud', 'web_local'])('creation verifies modern server configuration for %s', async agentAppType => {
  httpGet.mockResolvedValue({ success: true, content: { ...app, agentAppType } });
  await run(['Test app']);
  const creation = httpPost.mock.calls.find(call => call[1] === '/query/app/registerApp.json');
  expect(new URLSearchParams(creation[2]).get('createWithModernTheme')).toBe('y');
  const result = JSON.parse(console.log.mock.calls.find(([value]) => typeof value === 'string' && value.startsWith('{'))[0]);
  expect(result).toMatchObject({ success: true, appType: 'APP_TEST', themeVerification: {
    appThemeMode: 'modern', verified: true, scope: 'configuration_readback', runtimeVerified: false,
  } });
  expect(httpGet.mock.calls[0][1]).toBe('/APP_TEST/query/app/getAppIncludingAecpInfo.json');
});

test.each([
  { ...app, config: {} },
  { ...app, appThemeMode: 'legacy' },
  { ...app, appThemeEnable: 'n' },
  { ...app, corpId: 'other-org' },
  { ...app, appType: 'APP_OTHER' },
])('a created app with unverified theme/identity is not reported as success or recreated: %j', async content => {
  httpGet.mockResolvedValue({ success: true, content });
  await expect(run(['Test app'])).rejects.toMatchObject({ code: 'APP_CREATED_THEME_UNVERIFIED',
    details: { appCreated: true, appType: 'APP_TEST', retryCreate: false } });
  expect(httpPost.mock.calls.filter(call => call[1] === '/query/app/registerApp.json')).toHaveLength(1);
  expect(console.log.mock.calls.some(([value]) => typeof value === 'string' && value.includes('"success":true'))).toBe(false);
});

test('readback failure preserves the created app ID and never retries the write', async () => {
  httpGet.mockRejectedValue(new Error('request timed out'));
  await expect(run(['Test app'])).rejects.toMatchObject({ code: 'APP_CREATED_THEME_UNVERIFIED',
    details: { appCreated: true, appType: 'APP_TEST', retryCreate: false } });
  expect(httpPost.mock.calls.filter(call => call[1] === '/query/app/registerApp.json')).toHaveLength(1);
});

test('readback permission guidance keeps its actionable link and records the existing app', async () => {
  const { CliError } = require('../lib/core/cli-error');
  httpGet.mockRejectedValue(new CliError('Permission required', {
    code: 'YIDA_PLATFORM_ACCESS_REQUIRED', details: { permissionUrl: 'https://example.com/permission' },
  }));
  await expect(run(['Test app'])).rejects.toMatchObject({ code: 'YIDA_PLATFORM_ACCESS_REQUIRED', details: {
    appCreated: true, appType: 'APP_TEST', retryCreate: false, permissionUrl: 'https://example.com/permission',
  } });
});

test.each([
  [{ appThemeEnable: 'y', appThemeMode: 'modern', agentAppType: 'qwenwork' }, 'modern'],
  [app, 'modern'],
  [{ ...app, appThemeMode: 'legacy' }, 'legacy'],
  [{ ...app, appThemeEnable: 'n' }, 'legacy'],
  [{ ...app, config: { CREATED_WITH_MODERN_THEME: 'n' } }, 'legacy'],
  [{ ...app, appThemeMode: 'modern', config: {} }, 'unknown'],
  [{ ...app, agentAppType: 'none' }, 'unknown'],
  [{ ...app, appThemeEnable: true }, 'unknown'],
  [{ ...app, appThemeMode: false }, 'unknown'],
  [{ ...app, config: { CREATED_WITH_MODERN_THEME: true } }, 'unknown'],
])('server theme facts %j resolve to %s without relying on host or colour', (input, mode) => {
  expect(resolveAppThemeState({ ...input, colour: 'custom' }).mode).toBe(mode);
});


test('partial creation stays machine-readable without --json so the app ID is recoverable', async () => {
  const { shouldUseStructuredErrorOutput, toErrorPayload } = require('../lib/core/cli-error');
  httpGet.mockResolvedValue({ success: true, content: { ...app, config: {} } });
  let failure;
  try { await run(['Test app']); } catch (error) { failure = error; }
  expect(shouldUseStructuredErrorOutput(failure, ['create-app', 'Test app'])).toBe(true);
  expect(toErrorPayload(failure)).toMatchObject({ success: false, partial: true,
    retrySafe: false, residual: { appType: 'APP_TEST' }, details: { appCreated: true, retryCreate: false } });
});
