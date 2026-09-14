'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RETIRED_ENDPOINT = 'query/formdesign/updateFormConfig.json';

function listJavaScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJavaScriptFiles(absolutePath);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });
}

describe('retired updateFormConfig endpoint', () => {
  test('has no production callers', () => {
    const offenders = listJavaScriptFiles(path.join(ROOT, 'lib'))
      .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes(RETIRED_ENDPOINT))
      .map((filePath) => path.relative(ROOT, filePath));

    expect(offenders).toEqual([]);
  });

  test('is absent from API guidance', () => {
    const apiReference = fs.readFileSync(path.join(ROOT, 'yida-skills', 'references', 'yida-api.md'), 'utf8');

    expect(apiReference).not.toContain(RETIRED_ENDPOINT);
  });

  test('keeps the independent form schema info configuration command', () => {
    const commandSource = fs.readFileSync(path.join(ROOT, 'lib', 'app', 'update-form-config.js'), 'utf8');

    expect(commandSource).toContain('updateFormSchemaInfo.json');
    expect(commandSource).not.toContain(RETIRED_ENDPOINT);
  });

  test('exports an awaitable command instead of starting work as a require side effect', () => {
    const command = require('../lib/app/update-form-config');

    expect(command.parseArgs(['APP_X', 'FORM_X', 'keep', '客户'])).toMatchObject({
      appType: 'APP_X', formUuid: 'FORM_X', isRenderNav: 'keep', title: '客户',
    });
    expect(typeof command.run).toBe('function');
    expect(fs.readFileSync(path.join(ROOT, 'bin', 'yida.js'), 'utf8')).toContain('await runUpdateFormConfig(args)');
  });

  test('the awaitable command rejects an API-level write failure', async () => {
    jest.resetModules();
    const httpPost = jest.fn()
      .mockResolvedValueOnce({ success: true, content: { isRenderNav: 'true' } })
      .mockResolvedValueOnce({ success: false, errorMsg: 'rejected', errorCode: 'WRITE_REJECTED' });
    jest.doMock('../lib/core/utils', () => ({
      loadAuthData: () => ({ auth_mode: 'token', auth_source: 'test', corp_id: 'corp', user_id: 'user' }),
      triggerLogin: jest.fn(),
      resolveBaseUrl: () => 'https://example.test',
      httpPost,
      requestWithAutoLogin: (request, authRef) => request({ ...authRef, csrfToken: 'csrf' }),
    }));
    jest.doMock('../lib/core/i18n', () => ({ t: (key) => key }));
    jest.doMock('../lib/core/yida-i18n', () => ({
      buildYidaTitleI18n: (title) => ({ zh_CN: title }),
      normalizeYidaLocale: (locale) => locale,
      resolveContentLocale: () => 'zh_CN',
    }));
    jest.doMock('../lib/core/chalk', () => Object.fromEntries(
      ['banner', 'step', 'label', 'success', 'fail', 'warn', 'info', 'error', 'result', 'usage'].map((name) => [name, jest.fn()])
    ));
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const { run } = require('../lib/app/update-form-config');
      await expect(run(['APP_X', 'FORM_X', 'keep', '客户'])).rejects.toMatchObject({ code: 'WRITE_REJECTED' });
      expect(httpPost).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });
});
