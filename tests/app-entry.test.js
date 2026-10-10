'use strict';

jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: jest.fn(() => ({ baseUrl: 'https://tenant.example.com' })),
  createYidaClient: jest.fn(),
  unwrapYidaResponse: jest.fn((response) => {
    if (response.success === false) { throw new Error(response.errorMsg); }
    return response.content;
  }),
}));
const { createAuthRef, createYidaClient } = require('../lib/core/yida-client');
jest.mock('../lib/app/form-navigation', () => ({ fetchFormPageList: jest.fn() }));
const { fetchFormPageList } = require('../lib/app/form-navigation');
const { run, parseArgs, normalizeUrl } = require('../lib/app/app-entry');
const origin = 'https://tenant.example.com';
const response = (accessEntries, revision = 'v1') => ({ success: true, content: { accessEntries, revision } });
let client;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  client = { get: jest.fn(), postForm: jest.fn().mockResolvedValue(response({})) };
  createYidaClient.mockReturnValue(client);
});
afterEach(() => jest.restoreAllMocks());

test.each([
  `${origin}/APP/custom/FORM`, `${origin}/APP/workbench`, `${origin}/APP/manage/FORM`,
  `${origin}/APP/workbench/FORM?viewUuid=VIEW&corpid=ding123&hideLeftNav=true#tab`,
  `${origin}/APP/workbench?corpid=ding123&locale=zh_CN`,
  `${origin}/APP/submission/FORM?processCode=PROC&noShowTopBottom=true`,
  `${origin}/o/public-alias`, `${origin}/o/public-alias/FORM-123`, `${origin}/s/app-alias`,
  'https://enterprise.example.com/o/public',
])('keeps complete runtime URL %s', (input) => {
  expect(normalizeUrl(input, 'APP')).toBe(input);
});
test.each([
  '', '/APP/custom/FORM', '//tenant.example.com/APP/custom/FORM',
  `${origin}/OTHER/custom/FORM`, `${origin}/APP/admin`, `${origin}/APP/custom/../admin`,
  `${origin}/APP/custom/%2e%2e`, `${origin}/APP/custom/FORM?token=secret`,
  `${origin}/APP/workbench/FORM?viewUuid=X&token=secret`, `${origin}/APP/custom/FORM#<script>`,
  `${origin}/APP/custom/FORM\\x`, `${origin}/APP/custom/FORM\nsecret`, `${origin}/APP/workbench?`, `${origin}/APP/workbench#`,
  `${origin}/s/alias/extra`, `${origin}/o/alias?formUuid=OTHER`, `${origin}/o/alias?corpid=a&corpid=b`,
  `${origin}/o/alias?hideLeftNav=invalid`, 'https://user:pass@tenant.example.com/o/alias',
  'javascript:alert(1)', 'ftp://tenant.example.com/o/alias',
])('rejects relative or unsafe address %s', (input) => {
  expect(() => normalizeUrl(input, 'APP')).toThrow();
});
test.each([
  ['set', 'APP'], ['get', '../APP'], ['set', 'APP', '--frontend'],
  ['set', 'APP', '--frontend', '--management'], ['get', 'APP', '--clear-frontend'],
  ['set', 'APP', '--frontend', '/APP/custom/F', '--clear-frontend'],
  ['set', 'APP', '--frontend', 'x', '--frontend-page', 'FORM-A'],
  ['set', 'APP', '--clear-frontend-page'], ['set', 'APP', '--management-page'],
])('rejects ambiguous arguments %j', (...args) => expect(() => parseArgs(args)).toThrow());
test('help does not require authentication', async () => {
  await run(['--help']);
  expect(createAuthRef).not.toHaveBeenCalled();
});
test.each([
  ['frontend', `${origin}/o/public-home`],
  ['management', `${origin}/APP/workbench`],
])('registers only %s for a new application without inventing the other entry', async (key, url) => {
  const entries = { [key]: { url } };
  client.get.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(entries, 'v2'));
  await run(['set', 'APP', `--${key}`, url]);
  expect(client.postForm).toHaveBeenCalledWith('/APP/query/app/saveAccessEntries.json', {
    accessEntries: JSON.stringify(entries), revision: 'v1',
  });
  expect(JSON.parse(console.log.mock.calls[0][0]).urls).toEqual({ [key]: url });
});
test('registers both entries only when both are explicitly supplied', async () => {
  const entries = {
    frontend: { url: `${origin}/o/public-home` },
    management: { url: `${origin}/APP/manage/FORM` },
  };
  client.get.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(entries, 'v2'));
  await run(['set', 'APP', '--frontend', entries.frontend.url, '--management', entries.management.url]);
  expect(JSON.parse(client.postForm.mock.calls[0][1].accessEntries)).toEqual(entries);
});
test('an application with no configured entries is returned without invented defaults', async () => {
  client.get.mockResolvedValue(response({}));
  await run(['get', 'APP']);
  expect(client.postForm).not.toHaveBeenCalled();
  expect(JSON.parse(console.log.mock.calls[0][0]).urls).toEqual({});
});
test('no entry arguments do not trigger authentication or network requests', async () => {
  await expect(run(['set', 'APP'])).rejects.toThrow();
  expect(createAuthRef).not.toHaveBeenCalled();
  expect(client.get).not.toHaveBeenCalled();
  expect(client.postForm).not.toHaveBeenCalled();
});
test('updates only the supplied entry and uses the read revision', async () => {
  const management = { url: `${origin}/APP/workbench` };
  client.get.mockResolvedValueOnce(response({ management })).mockResolvedValueOnce(response({
    management, frontend: { url: `${origin}/APP/custom/FORM` },
  }, 'v2'));
  const result = await run(['set', 'APP', '--frontend', `${origin}/APP/custom/FORM`, '--json']);
  expect(client.postForm).toHaveBeenCalledWith('/APP/query/app/saveAccessEntries.json', {
    accessEntries: JSON.stringify({ frontend: { url: `${origin}/APP/custom/FORM` } }), revision: 'v1',
  });
  expect(result.accessEntries.management).toEqual(management);
  expect(client.get).toHaveBeenCalledTimes(2);
});
test('clear is explicit and leaves other entries alone', async () => {
  client.get.mockResolvedValueOnce(response({ frontend: { url: `${origin}/APP/custom/F` } })).mockResolvedValueOnce(response({}, 'v2'));
  await run(['set', 'APP', '--clear-frontend']);
  expect(JSON.parse(client.postForm.mock.calls[0][1].accessEntries)).toEqual({ frontend: null });
});
test('conflict does not retry or overwrite', async () => {
  client.get.mockResolvedValue(response({}));
  client.postForm.mockResolvedValue({ success: false, errorMsg: 'conflict' });
  await expect(run(['set', 'APP', '--management', `${origin}/APP/workbench`])).rejects.toThrow('conflict');
  expect(client.postForm).toHaveBeenCalledTimes(1);
  expect(client.get).toHaveBeenCalledTimes(1);
});
test('missing revision prevents writes', async () => {
  client.get.mockResolvedValue(response({}, ''));
  await expect(run(['set', 'APP', '--management', `${origin}/APP/workbench`])).rejects.toThrow();
  expect(client.postForm).not.toHaveBeenCalled();
});
test('readback mismatch is not reported as success', async () => {
  client.get.mockResolvedValue(response({}));
  await expect(run(['set', 'APP', '--management', `${origin}/APP/workbench`])).rejects.toThrow();
  expect(console.log).not.toHaveBeenCalled();
});
test('get is read-only and returns resolved URLs', async () => {
  client.get.mockResolvedValue(response({ management: { url: `${origin}/APP/workbench` } }));
  await run(['get', 'APP']);
  expect(client.postForm).not.toHaveBeenCalled();
  expect(JSON.parse(console.log.mock.calls[0][0]).urls.management).toBe(`${origin}/APP/workbench`);
});

test('keeps the verified enterprise URL even when the API authentication host differs', async () => {
  const url = 'https://enterprise.example.com/o/public?corpid=ding123#home';
  client.get.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ frontend: { url } }, 'v2'));
  await run(['set', 'APP', '--frontend', url]);
  expect(JSON.parse(client.postForm.mock.calls[0][1].accessEntries)).toEqual({ frontend: { url } });
  expect(JSON.parse(console.log.mock.calls[0][0]).urls.frontend).toBe(url);
});
test('rejects relative input before any request', async () => {
  await expect(run(['set', 'APP', '--frontend', '/APP/custom/FORM'])).rejects.toThrow();
  expect(client.get).not.toHaveBeenCalled();
  expect(client.postForm).not.toHaveBeenCalled();
});

test.each([
  `${origin}/APP/workbench/FORM-XYZ`,
  `${origin}/APP/workbench/FORM?corpid=ding123#tab`,
  `${origin}/APP/workbench`,
  `${origin}/APP/manage/FORM`,
])('preserves the exact management URL through write and readback: %s', url => {
  const entries = { management: { url } };
  client.get.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(entries, 'v2'));
  return run(['set', 'APP', '--management', url]).then(() => {
    expect(JSON.parse(client.postForm.mock.calls[0][1].accessEntries)).toEqual(entries);
    expect(fetchFormPageList).not.toHaveBeenCalled();
  });
});

test('--frontend-page builds the canonical custom URL for an online page', async () => {
  fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-A', pathName: 'store', formType: 'display' }]);
  const entries = { frontend: { url: `${origin}/APP/custom/FORM-A` } };
  client.get.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(entries, 'v2'));
  await run(['set', 'APP', '--frontend-page', 'FORM-A']);
  expect(fetchFormPageList).toHaveBeenCalledWith('APP', expect.any(Object));
  expect(JSON.parse(client.postForm.mock.calls[0][1].accessEntries)).toEqual(entries);
});

test('--frontend-page refuses an offline page before any write', async () => {
  fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-A', pathName: '', formType: 'display' }]);
  await expect(run(['set', 'APP', '--frontend-page', 'FORM-A'])).rejects.toThrow();
  expect(client.get).not.toHaveBeenCalled();
  expect(client.postForm).not.toHaveBeenCalled();
});

test('--frontend-page rejects a page from another application', async () => {
  fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-OTHER', pathName: 'x' }]);
  await expect(run(['set', 'APP', '--frontend-page', 'FORM-A'])).rejects.toThrow();
  expect(client.postForm).not.toHaveBeenCalled();
});

test('--management-page keeps the requested workbench page after verifying ownership', async () => {
  fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-A', pathName: '', formType: 'receipt' }]);
  const entries = { management: { url: `${origin}/APP/workbench/FORM-A` } };
  client.get.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(entries, 'v2'));
  await run(['set', 'APP', '--management-page', 'FORM-A']);
  expect(JSON.parse(client.postForm.mock.calls[0][1].accessEntries)).toEqual(entries);
});

test.each(['receipt', 'process', ''])('--frontend-page refuses non-display type %s before writing', async formType => {
  fetchFormPageList.mockResolvedValue([{ formUuid: 'FORM-A', pathName: 'online', formType }]);
  await expect(run(['set', 'APP', '--frontend-page', 'FORM-A'])).rejects.toThrow();
  expect(client.postForm).not.toHaveBeenCalled();
});
