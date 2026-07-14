'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/app/form-navigation', () => ({
  fetchFormPageList: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { fetchFormPageList } = require('../lib/app/form-navigation');
const { run, fetchFormSchema } = require('../lib/app/export-app');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
  csrf_token: 'tok123',
};

let logSpy;
let errorSpy;

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('export-app', () => {
  test('exports form schemas into a portable JSON file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-export-app-'));
    const outputPath = path.join(tmpDir, 'yida-export.json');
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM_A', formName: '客户表', formType: 'receipt', pathName: 'customer' },
      { formUuid: 'PAGE_B', formName: '看板', formType: 'display', pathName: 'dashboard' },
    ]);
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: { schema: 'A' } })
      .mockResolvedValueOnce({ success: true, content: { schema: 'B' } });

    try {
      const result = await run(['APP_XXX', outputPath]);
      const exported = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

      expect(fetchFormPageList).toHaveBeenCalledWith('APP_XXX', expect.objectContaining({
        csrfToken: 'tok123',
        baseUrl: 'https://www.aliwork.com',
      }));
      expect(utils.httpGet).toHaveBeenCalledTimes(2);
      expect(utils.httpGet.mock.calls[0][1]).toBe('/alibaba/web/APP_XXX/_view/query/formdesign/getFormSchema.json');
      expect(utils.httpGet.mock.calls[0][2]).toEqual({ formUuid: 'FORM_A', schemaVersion: 'V5' });
      expect(exported).toMatchObject({
        version: '1.0',
        sourceAppType: 'APP_XXX',
        baseUrl: 'https://www.aliwork.com',
        forms: [
          { formUuid: 'FORM_A', name: '客户表', formType: 'receipt' },
          { formUuid: 'PAGE_B', name: '看板', formType: 'display' },
        ],
      });
      expect(result).toEqual({
        success: true,
        appType: 'APP_XXX',
        outputPath,
        totalForms: 2,
        successCount: 2,
        failCount: 0,
      });
      expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('fetchFormSchema returns null for failed schema responses', async () => {
    utils.httpGet.mockResolvedValue({
      success: false,
      errorMsg: 'not found',
    });

    const result = await fetchFormSchema('APP_XXX', 'FORM_MISSING', {
      csrfToken: 'tok123',
      baseUrl: 'https://www.aliwork.com',
    });

    expect(result).toBeNull();
  });

  test('reports missing arguments as CliError instead of exiting', async () => {
    await expect(run([])).rejects.toMatchObject({
      isCliError: true,
      code: 'EXPORT_INVALID_ARGUMENTS',
    });
  });

  test('reports empty apps as CliError instead of exiting', async () => {
    fetchFormPageList.mockResolvedValue([]);

    await expect(run(['APP_EMPTY', path.join(os.tmpdir(), 'unused-export.json')])).rejects.toMatchObject({
      isCliError: true,
      code: 'EXPORT_NO_FORMS',
    });
  });
});
