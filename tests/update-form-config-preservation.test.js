
'use strict';

const querystring = require('querystring');

function fixture(readResponse, writeResponse = { success: true }) {
  jest.resetModules();
  const httpPost = jest.fn()
    .mockResolvedValueOnce(readResponse)
    .mockResolvedValueOnce(writeResponse);
  jest.doMock('../lib/core/utils', () => ({
    loadAuthData: () => ({ auth_mode: 'token', auth_source: 'test' }),
    triggerLogin: jest.fn(),
    resolveBaseUrl: () => 'https://example.test',
    httpPost,
    requestWithAutoLogin: (request, authRef) => request({ ...authRef, csrfToken: 'csrf' }),
  }));
  jest.doMock('../lib/core/chalk', () => Object.fromEntries(
    ['banner', 'step', 'label', 'success', 'fail', 'warn', 'info', 'error', 'result', 'usage'].map((name) => [name, jest.fn()])
  ));
  return { command: require('../lib/app/update-form-config'), httpPost };
}

afterEach(() => jest.restoreAllMocks());

test('a navigation write rejects sparse settings rather than omitting null values', async () => {
  const { command, httpPost } = fixture({ success: true, content: {
    title: { zh_CN: 'Original' },
    customTitle: 'n', isRenderNav: true, displayTitle: '${legao_creator}',
    detailTheme: 'theme', showNav: 'n', showDelete: 'y',
    serialSwitch: null, pushTask: null, defaultOrder: null, showPrint: null,
    consultPerson: '', defaultManager: 'n', submissionRule: 'RESUBMIT',
    manageCustomActionInfo: [],
  } });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await expect(command.run(['APP_X', 'FORM_X', 'false', 'Test']))
    .rejects.toMatchObject({ code: 'CONFIG_PRESERVATION_UNSUPPORTED' });
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test('preserves custom title, serial number settings and navigation in keep mode', async () => {
  const { command, httpPost } = fixture({ success: true, content: {
    title: { zh_CN: 'Original' },
    customTitle: 'y', displayTitle: 'Custom', isRenderNav: false,
    serialSwitch: 'y', serialExpression: 'expression', serialPrefix: 'prefix',
    serialDateFormat: 'yyyyMMdd', serialInfo: { serialPreSplit: '-' },
    relateFormUuid: 'FORM_RELATED', manageCustomConfigInfo: { enabled: false },
  } });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await command.run(['APP_X', 'FORM_X', 'keep', 'Test', '--locale', 'zh_CN']);
  expect(httpPost).toHaveBeenCalledTimes(2);
  expect(httpPost.mock.calls[1][1]).toContain('/updateFormTitle.json');
  const payload = querystring.parse(httpPost.mock.calls[1][2]);
  expect(JSON.parse(payload.title)).toEqual({ zh_CN: 'Test' });
  expect(payload).not.toHaveProperty('isRenderNav');
  expect(payload).not.toHaveProperty('customTitle');
  expect(payload).not.toHaveProperty('serialSwitch');
  expect(payload).not.toHaveProperty('manageCustomConfigInfo');
});

test.each([null, { success: false }, { __needLogin: true }, { __csrfExpired: true },
  { success: true }, { success: true, content: {} }, { success: true, content: [] }])(
  'never writes when the current configuration cannot be read (%j)', async (response) => {
    const { command, httpPost } = fixture(response);
    await expect(command.run(['APP_X', 'FORM_X', 'false', 'Test']))
      .rejects.toMatchObject({ code: 'CONFIG_READ_FAILED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
  }
);

test.each([undefined, null, 'unknown'])('keep rejects ambiguous navigation state (%j)', async (isRenderNav) => {
  const { command, httpPost } = fixture({ success: true, content: { customTitle: 'n', isRenderNav } });
  await expect(command.run(['APP_X', 'FORM_X', 'keep', 'Test']))
    .rejects.toMatchObject({ code: 'CONFIG_READ_FAILED' });
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test.each([
  [{ renderNav: false }, 'false'],
  [{ renderNav: 'true' }, 'true'],
  [{ renderNav: false, isRenderNav: true }, 'false'],
  [{ renderNav: true, isRenderNav: false }, 'true'],
  [{ isRenderNav: 'false' }, 'false'],
])('keep uses persisted navigation and omits navigation from a title-only write (%j)', async (config, expected) => {
  const { command, httpPost } = fixture({ success: true, content: { ...config, title: { zh_CN: 'Original' } } });
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await command.run(['APP_X', 'FORM_X', 'keep', 'Test']);
  const payload = querystring.parse(httpPost.mock.calls[1][2]);
  expect(payload).not.toHaveProperty('isRenderNav');
  expect(payload).not.toHaveProperty('renderNav');
  expect(JSON.parse(log.mock.calls.at(-1)[0]).isRenderNav).toBe(expected === 'true');
  expect(httpPost).toHaveBeenCalledTimes(2);
});

test.each([null, 'unknown', undefined])('keep does not fall back from a present invalid renderNav (%j)', async renderNav => {
  const { command, httpPost } = fixture({ success: true, content: { renderNav, isRenderNav: false } });
  await expect(command.run(['APP_X', 'FORM_X', 'keep', 'Test']))
    .rejects.toMatchObject({ code: 'CONFIG_READ_FAILED' });
  expect(httpPost).toHaveBeenCalledTimes(1);
});
