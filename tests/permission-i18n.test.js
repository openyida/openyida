'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const originalOpenYidaLang = process.env.OPENYIDA_LANG;
const originalLang = process.env.LANG;
process.env.OPENYIDA_LANG = 'en-US';
process.env.LANG = 'zh_CN.UTF-8';

const utils = require('../lib/core/utils');
const { parseArgs: parseGetPermissionArgs } = require('../lib/permission/get-permission');
const { parseArgs: parseSavePermissionArgs } = require('../lib/permission/save-permission');
const {
  fetchAllPermitPackages,
  unwrapPermitPackagePage,
} = require('../lib/permission/permit-package-service');

afterAll(() => {
  if (originalOpenYidaLang === undefined) {
    delete process.env.OPENYIDA_LANG;
  } else {
    process.env.OPENYIDA_LANG = originalOpenYidaLang;
  }
  if (originalLang === undefined) {
    delete process.env.LANG;
  } else {
    process.env.LANG = originalLang;
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
});

test('unsupported permission arguments are localized by OPENYIDA_LANG instead of macOS LANG', () => {
  expect(() => parseGetPermissionArgs(['APP-1', 'FORM-1', '--bad'])).toThrow(
    'Unsupported argument: --bad'
  );
  expect(() => parseSavePermissionArgs(['APP-1', 'FORM-1', '--bad'])).toThrow(
    'Unsupported argument: --bad'
  );
});

test('get-permission accepts the common --json output flag', () => {
  expect(parseGetPermissionArgs(['APP-1', 'FORM-1', '--json'])).toEqual({
    appType: 'APP-1',
    formUuid: 'FORM-1',
    packageUuid: null,
  });
  expect(parseGetPermissionArgs([
    'APP-1', 'FORM-1', '--package-uuid', 'pkg-1', '--json',
  ])).toEqual({
    appType: 'APP-1',
    formUuid: 'FORM-1',
    packageUuid: 'pkg-1',
  });
});

test('permission-list response failures use semantic English messages', () => {
  expect(() => unwrapPermitPackagePage(null)).toThrow('Failed to query permission groups');
  expect(() => unwrapPermitPackagePage({ success: true, content: { formPermit: {} } })).toThrow(
    'Permission-group query returned an unrecognized list structure'
  );
});

test('duplicate UUID and bounded pagination failures are localized in English', async () => {
  utils.httpGet
    .mockResolvedValueOnce({ success: true, content: { formPermit: [{ packageUuid: 'pkg-1' }] } })
    .mockResolvedValueOnce({ success: true, content: { formPermit: [{ packageUuid: 'pkg-1' }] } });

  await expect(fetchAllPermitPackages('APP-1', 'FORM-1', {}, { pageSize: 1, maxPages: 2 }))
    .rejects.toThrow('Permission-group pagination repeated packageUuid=pkg-1');

  utils.httpGet.mockResolvedValueOnce({
    success: true,
    content: { formPermit: [{ packageUuid: 'pkg-2' }] },
  });
  await expect(fetchAllPermitPackages('APP-1', 'FORM-1', {}, { pageSize: 1, maxPages: 1 }))
    .rejects.toThrow('Permission-group query reached the safe pagination limit (1 pages)');
});
