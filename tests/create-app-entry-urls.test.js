'use strict';

jest.mock('../lib/core/utils', () => ({ httpPost: jest.fn(), requestWithAutoLogin: jest.fn() }));
jest.mock('../lib/core/yida-client', () => ({ createAuthRef: jest.fn() }));
jest.mock('../lib/core/browser-handoff', () => ({
  parseOpenOption: args => ({ args, mode: 'never' }),
  withBrowserHandoff: result => result,
}));

const fs = require('fs');
const { run } = require('../lib/app/create-app');
const utils = require('../lib/core/utils');
const { createAuthRef } = require('../lib/core/yida-client');

afterEach(() => jest.restoreAllMocks());

test('create-app success emits adminUrl alongside compatible workbench fields', async () => {
  const auth = { baseUrl: 'https://tenant.aliwork.com', corpId: 'corp-test' };
  createAuthRef.mockReturnValue(auth);
  utils.httpPost.mockResolvedValue({ success: true, content: {} });
  utils.requestWithAutoLogin.mockResolvedValue({ success: true, content: 'APP_NEW' });
  // Keep the success path from updating a real PRD in an ancestor directory.
  jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const output = jest.spyOn(console, 'log').mockImplementation(() => {});
  await run(['--name', '测试应用']);
  const result = output.mock.calls.map(([value]) => {
    try { return JSON.parse(value); } catch { return null; }
  }).find(value => value && value.success === true);
  expect(result).toMatchObject({
    appType: 'APP_NEW',
    url: 'https://tenant.aliwork.com/APP_NEW/workbench',
    appUrl: 'https://tenant.aliwork.com/APP_NEW/workbench',
    workbenchUrl: 'https://tenant.aliwork.com/APP_NEW/workbench',
    adminUrl: 'https://tenant.aliwork.com/APP_NEW/admin',
  });
});
