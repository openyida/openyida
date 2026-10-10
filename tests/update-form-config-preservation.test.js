
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

test('a navigation write preserves default title mode and sparse settings without inserting defaults', async () => {
  const { command, httpPost } = fixture({ success: true, content: {
    customTitle: 'n', isRenderNav: true, displayTitle: '${legao_creator}',
    detailTheme: 'theme', showNav: 'n', showDelete: 'y',
    serialSwitch: null, pushTask: null, defaultOrder: null, showPrint: null,
    consultPerson: '', defaultManager: 'n', submissionRule: 'RESUBMIT',
    manageCustomActionInfo: [],
  } });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await command.run(['APP_X', 'FORM_X', 'false', 'Test']);
  const payload = querystring.parse(httpPost.mock.calls[1][2]);
  expect(payload).toMatchObject({ customTitle: 'n', isRenderNav: 'false',
    displayTitle: '${legao_creator}', detailTheme: 'theme', showNav: 'n',
    showDelete: 'y', consultPerson: '', defaultManager: 'n',
    submissionRule: 'RESUBMIT', manageCustomActionInfo: '[]' });
  for (const absent of ['serialSwitch', 'pushTask', 'defaultOrder', 'showPrint', 'previewConfig']) {
    expect(payload).not.toHaveProperty(absent);
  }
});

test('preserves custom title, serial number settings and navigation in keep mode', async () => {
  const { command, httpPost } = fixture({ success: true, content: {
    customTitle: 'y', displayTitle: 'Custom', isRenderNav: false,
    serialSwitch: 'y', serialExpression: 'expression', serialPrefix: 'prefix',
    serialDateFormat: 'yyyyMMdd', serialInfo: { serialPreSplit: '-' },
    relateFormUuid: 'FORM_RELATED', manageCustomConfigInfo: { enabled: false },
  } });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await command.run(['APP_X', 'FORM_X', 'keep', 'Test']);
  expect(querystring.parse(httpPost.mock.calls[1][2])).toMatchObject({
    customTitle: 'y', displayTitle: 'Custom', isRenderNav: 'false',
    serialSwitch: 'y', serialExpression: 'expression', serialPrefix: 'prefix',
    serialDateFormat: 'yyyyMMdd', serialInfo: '{"serialPreSplit":"-"}',
    relateUuid: 'FORM_RELATED', manageCustomConfigInfo: '{"enabled":false}',
  });
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
