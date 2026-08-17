'use strict';

const querystring = require('querystring');
const { __test__ } = require('../lib/app/import-app');

describe('import-app helpers', () => {
  test('preserves page/report formType when creating imported placeholders', () => {
    expect(__test__.normalizeImportFormType('display')).toBe('display');
    expect(__test__.normalizeImportFormType('report')).toBe('report');
    expect(__test__.normalizeImportFormType('receipt')).toBe('receipt');
    expect(__test__.normalizeImportFormType('form')).toBe('receipt');
    expect(__test__.normalizeImportFormType('')).toBe('receipt');

    const displayPayload = querystring.parse(
      __test__.buildCreateFormPostData('Imported Page', 'display')
    );
    const reportPayload = querystring.parse(
      __test__.buildCreateFormPostData('Imported Report', 'report')
    );

    expect(displayPayload.formType).toBe('display');
    expect(reportPayload.formType).toBe('report');
    expect(displayPayload).not.toHaveProperty('_csrf_token');
    expect(JSON.parse(displayPayload.title).zh_CN).toBe('Imported Page');
  });

  test.each([
    ['login expiry', { __needLogin: true }],
    ['CSRF expiry', { __csrfExpired: true }],
    ['redirect', { __needLogin: true, __httpStatus: 302 }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('import Schema save sends exactly once on %s', async (label, response) => {
    jest.resetModules();
    const httpPost = jest.fn().mockResolvedValue(response);
    const requestWithAutoLogin = jest.fn((requestFn, authRef) => requestFn(authRef));
    jest.doMock('../lib/core/utils', () => ({
      triggerLogin: jest.fn(),
      resolveBaseUrl: jest.fn(() => 'https://example.test'),
      httpGet: jest.fn(),
      httpPost,
      requestWithAutoLogin,
    }));
    const isolated = require('../lib/app/import-app').__test__;

    await expect(isolated.saveFormSchema(
      'APP_XXX',
      'FORM_XXX',
      { pages: [] },
      { baseUrl: 'https://example.test', csrfToken: 'csrf', authMode: 'token', authSource: 'token' },
      'receipt',
      100
    )).resolves.toEqual(response);

    expect(label).toBeTruthy();
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(requestWithAutoLogin).not.toHaveBeenCalled();
    jest.dontMock('../lib/core/utils');
    jest.resetModules();
  });

  test('import Schema save rejects missing auth or revision before transport', async () => {
    jest.resetModules();
    const httpPost = jest.fn();
    jest.doMock('../lib/core/utils', () => ({
      triggerLogin: jest.fn(),
      resolveBaseUrl: jest.fn(() => 'https://example.test'),
      httpGet: jest.fn(),
      httpPost,
      requestWithAutoLogin: jest.fn(),
    }));
    const isolated = require('../lib/app/import-app').__test__;

    await expect(isolated.saveFormSchema(
      'APP_XXX',
      'FORM_XXX',
      { pages: [] },
      { baseUrl: 'https://example.test', authMode: 'cookie', authSource: 'cookie' },
      'receipt',
      100
    )).rejects.toMatchObject({ code: 'IMPORT_SCHEMA_WRITE_PRECHECK_FAILED' });
    await expect(isolated.saveFormSchema(
      'APP_XXX',
      'FORM_XXX',
      { pages: [] },
      { baseUrl: 'https://example.test', csrfToken: 'csrf', authMode: 'token', authSource: 'token' },
      'receipt'
    )).rejects.toMatchObject({ code: 'SCHEMA_REMOTE_READ_FAILED' });

    expect(httpPost).not.toHaveBeenCalled();
    jest.dontMock('../lib/core/utils');
    jest.resetModules();
  });

  test('adapts app and form identifiers inside exported schema content', () => {
    const schema = {
      pages: [{ id: 'FORM-OLD', props: { appType: 'APP_OLD' } }],
      actions: { source: 'APP_OLD/FORM-OLD' },
    };

    expect(__test__.adaptSchemaIdentifiers(schema, 'APP_OLD', 'APP_NEW', 'FORM-OLD', 'FORM-NEW')).toEqual({
      pages: [{ id: 'FORM-NEW', props: { appType: 'APP_NEW' } }],
      actions: { source: 'APP_NEW/FORM-NEW' },
    });
  });

  test('does not corrupt plain text that merely contains the old identifier as a substring', () => {
    const schema = {
      pages: [{ id: 'FORM-OLD', props: { appType: 'APP_OLD' } }],
      fields: [
        // label / value 中包含旧标识符子串，但属于更长的字符串，不应被替换
        { label: 'APP_OLDER backup note', value: 'see FORM-OLD-archive for details' },
      ],
    };

    const result = __test__.adaptSchemaIdentifiers(schema, 'APP_OLD', 'APP_NEW', 'FORM-OLD', 'FORM-NEW');

    expect(result.pages[0].id).toBe('FORM-NEW');
    expect(result.pages[0].props.appType).toBe('APP_NEW');
    // 关键：被更长标识符包裹的子串保持原样，不被误替换
    expect(result.fields[0].label).toBe('APP_OLDER backup note');
    expect(result.fields[0].value).toBe('see FORM-OLD-archive for details');
  });
});
