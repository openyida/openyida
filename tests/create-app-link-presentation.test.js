'use strict';

jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(), httpPost: jest.fn(), detectRuntimeCapabilities: jest.fn(),
  requestWithAutoLogin: jest.fn((fn, auth) => fn(auth)),
}));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn() }));

const fs = require('fs');
const utils = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');
const { run } = require('../lib/app/create-app');
const { buildCreatedAppLinkPresentation } = require('../lib/app/application-entry-urls');
const originalQuiet = process.env.YIDA_QUIET;

beforeEach(() => {
  jest.clearAllMocks();
  // bin/yida.js consumes global --quiet before calling the command handler.
  process.env.YIDA_QUIET = '1';
  createAuthRef.mockReturnValue({ baseUrl: 'https://tenant.aliwork.com', corpId: 'corp-test' });
  utils.httpPost.mockImplementation(async (_base, url) => ({
    success: true, content: url === '/query/app/registerApp.json' ? 'APP_NEW' : {},
  }));
  utils.httpGet.mockResolvedValue({ success: true, content: {
    appType: 'APP_NEW', corpId: 'corp-test', appThemeEnable: 'y', appThemeMode: 'modern',
  } });
  utils.detectRuntimeCapabilities.mockReturnValue({ tool: 'qwenwork', subtype: 'qwenwork_web' });
  jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalQuiet === undefined) { delete process.env.YIDA_QUIET; }
  else { process.env.YIDA_QUIET = originalQuiet; }
});

test.each([
  ['qwenwork_web', 'show_link'],
  ['qwenwork_desktop', 'artifact_show_link'],
  [null, null],
])('quiet/no-open creation keeps a pending host action for %s', async (subtype, preferredTool) => {
  utils.detectRuntimeCapabilities.mockReturnValue({ tool: 'qwenwork', subtype });
  await run(['--name', '客户管理', '--no-open']);
  const result = JSON.parse(console.log.mock.calls.find(([value]) => value.startsWith('{'))[0]);
  expect(result).toMatchObject({ success: true, appType: 'APP_NEW', linkPresentation: {
    status: 'pending', timing: 'before_final_reply', preferredTool,
    toolAvailability: 'check_host_tool_inventory',
    url: result.adminUrl, title: '客户管理', maxCallsPerTurn: 1,
    completionGate: { evidence: 'actual_host_tool_result_for_selected_url_in_current_turn', enforcement_owner: 'host_agent' },
  } });
  expect(result.linkPresentation.url).toBe('https://tenant.aliwork.com/APP_NEW/admin');
  expect(result).not.toHaveProperty('browser_handoff');
  expect(utils.httpPost.mock.calls.filter(call => call[1] === '/query/app/registerApp.json')).toHaveLength(1);
});

test('other hosts retain URL output without a QwenWork presentation action', async () => {
  utils.detectRuntimeCapabilities.mockReturnValue({ tool: 'codex', subtype: 'codex' });
  await run(['--name', '客户管理', '--no-open']);
  const result = JSON.parse(console.log.mock.calls.find(([value]) => value.startsWith('{'))[0]);
  expect(result.adminUrl).toBe('https://tenant.aliwork.com/APP_NEW/admin');
  expect(result).not.toHaveProperty('linkPresentation');
});

test('creation followed by failed readback preserves the pending action and never recreates', async () => {
  utils.httpGet.mockRejectedValue(new Error('readback timed out'));
  await expect(run(['客户管理', '--no-open'])).rejects.toMatchObject({
    code: 'APP_CREATED_THEME_UNVERIFIED', details: {
      appCreated: true, appType: 'APP_NEW', retryCreate: false,
      adminUrl: 'https://tenant.aliwork.com/APP_NEW/admin',
      linkPresentation: { status: 'pending', url: 'https://tenant.aliwork.com/APP_NEW/admin', preferredTool: 'show_link' },
    },
  });
  expect(utils.httpPost.mock.calls.filter(call => call[1] === '/query/app/registerApp.json')).toHaveLength(1);
  expect(console.log).not.toHaveBeenCalled();
});

test('rejected creation does not return a pending action for a nonexistent app', async () => {
  utils.httpPost.mockResolvedValue({ success: false, errorMsg: 'permission denied' });
  await expect(run(['客户管理', '--no-open'])).rejects.toThrow();
  expect(console.log.mock.calls.map(([value]) => JSON.parse(value)))
    .toEqual([{ success: false, error: 'permission denied' }]);
  expect(utils.httpGet).not.toHaveBeenCalled();
});

test.each([
  {},
  { adminUrl: 'https://tenant.aliwork.com/OTHER/admin', appType: 'APP_NEW' },
  { adminUrl: 'https://tenant.aliwork.com/APP_NEW/workbench', appType: 'APP_NEW' },
  { adminUrl: 'javascript:alert(1)', appType: 'APP_NEW' },
])('never guesses or presents an ineligible creation URL: %j', entry => {
  expect(buildCreatedAppLinkPresentation(entry, { tool: 'qwenwork' })).toBeNull();
});

test('preserves the exact supplied URL and does not claim tool availability or rendering', () => {
  const url = 'https://tenant.aliwork.com/APP_NEW/admin?tenant=current#start';
  const action = buildCreatedAppLinkPresentation({ appType: 'APP_NEW', adminUrl: url }, { tool: 'qwenwork' });
  expect(action.url).toBe(url);
  expect(action.status).toBe('pending');
  expect(action.toolAvailability).toBe('check_host_tool_inventory');
});
