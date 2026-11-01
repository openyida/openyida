'use strict';

const querystring = require('querystring');

const TITLE = {
  type: 'i18n', zh_CN: '原中文', en_US: 'Original English', ja_JP: '元の名前',
  pureEn_US: 'English fallback', key: 'title-key', envLocale: null,
  extra: { enabled: false, revision: 0 },
};

// Complete supported configuration, including explicit empty and false values.
const CONFIG = {
  title: TITLE, renderNav: true,
  relateUuid: '', icon: '', pageType: 'web,mobile', showNav: 'n', isInner: 'y', url: '', isNew: 'n',
  showRemark: 'y', showDelete: 'n', showDetail: 'y', showOperationLog: 'y',
  showTerminate: 'n', showStash: 'y', isAgent: 'n', showAgent: 'y', customTitle: 'n',
  displayTitle: '${legao_creator}', displayType: 'RE', consultTitle: '', consultPerson: '',
  defaultManager: 'n', submissionRule: 'RESUBMIT', defaultOrder: 'cd', needReportLine: false,
  serialSwitch: 'n', serialExpression: '', serialPrefix: '', serialDateFormat: '',
  serialSuffix: '', serialTimeZone: '', serialClean: 0, serialCleanList: [],
  serialInfo: { enabled: false, count: 0, value: '', missing: null }, formulaType: 'n', pushTask: 'n', redirectConfig: '',
  showPrint: 'n', showAdd: false, showImport: false, showExport: false, showDingGroup: 'n',
  showCopyData: false, reStart: 'n', previewConfig: 'n', isEncrypt: 'n',
  detailTheme: '', openGroupMsg: false, procInstShowJoinGroup: false, reStartLatest: false,
  approvalRedirect: '', manageCustomActionInfo: [], manageCustomConfigInfo: { enabled: false },
};

function fixture(config = CONFIG, { readResponse = { success: true, content: config }, writeResponse = { success: true } } = {}) {
  jest.resetModules();
  const httpPost = jest.fn().mockResolvedValueOnce(readResponse).mockResolvedValueOnce(writeResponse);
  jest.doMock('../lib/core/utils', () => ({
    loadAuthData: () => ({ auth_mode: 'token' }), triggerLogin: jest.fn(),
    resolveBaseUrl: () => 'https://example.test', httpPost,
    requestWithAutoLogin: (fn, ref) => fn({ ...ref, csrfToken: 'csrf' }),
  }));
  jest.doMock('../lib/core/chalk', () => Object.fromEntries(
    ['banner', 'step', 'label', 'success', 'fail', 'warn', 'info', 'error', 'result', 'usage'].map(key => [key, jest.fn()])
  ));
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  return { command: require('../lib/app/update-form-config'), httpPost, log };
}

afterEach(() => jest.restoreAllMocks());

test.each([['zh_CN', 'zh_CN'], ['en-US', 'en_US'], ['ja', 'ja_JP']])(
  'rename merges only normalized locale %s through the existing narrow endpoint', async (locale, normalized) => {
    const before = { title: TITLE, renderNav: false, serialSwitch: null, pushTask: null };
    const { command, httpPost } = fixture(before);
    await command.run(['APP_X', 'FORM_X', 'keep', 'New title', '--locale', locale]);
    expect(httpPost).toHaveBeenCalledTimes(2);
    const [baseUrl, endpoint, body] = httpPost.mock.calls[1];
    expect(baseUrl).toBe('https://example.test');
    expect(endpoint).toBe('/dingtalk/web/APP_X/query/formdesign/updateFormTitle.json');
    expect(querystring.parse(body)).toEqual({
      _api: 'Form.updateTitle', _csrf_token: 'csrf', _locale_time_zone_offset: '28800000',
      formUuid: 'FORM_X', title: JSON.stringify({ ...TITLE, [normalized]: 'New title' }),
    });
    expect(before.title).toEqual(TITLE);
  }
);

test.each(['keep', 'true'])('same title and navigation (%s) issue only the read even with unsafe config', async nav => {
  const { command, httpPost, log } = fixture({ title: JSON.stringify(TITLE), renderNav: true, serialSwitch: null });
  await command.run(['APP_X', 'FORM_X', nav, TITLE.zh_CN, '--locale', 'zh_CN']);
  expect(httpPost).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls.at(-1)[0])).toMatchObject({ success: true, changed: false, mutationPerformed: false });
});

test('a matching target locale is a no-op without filling missing translations or metadata', async () => {
  const { command, httpPost } = fixture({ title: { en_US: 'Same' }, renderNav: false });
  await command.run(['APP_X', 'FORM_X', 'false', 'Same', '--locale', 'en_US']);
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test('an explicit unchanged navigation also uses a title-only write', async () => {
  const { command, httpPost } = fixture({ title: JSON.stringify(TITLE), renderNav: true });
  await command.run(['APP_X', 'FORM_X', 'true', 'New', '--locale', 'zh_CN']);
  expect(httpPost).toHaveBeenCalledTimes(2);
  expect(httpPost.mock.calls[1][1]).toContain('/updateFormTitle.json');
});

test('a navigation change preserves all supported configuration and other title languages', async () => {
  const before = JSON.parse(JSON.stringify(CONFIG));
  const { command, httpPost } = fixture(before);
  await command.run(['APP_X', 'FORM_X', 'false', '新中文', '--locale', 'zh_CN']);
  expect(httpPost).toHaveBeenCalledTimes(2);
  expect(httpPost.mock.calls[1][1]).toBe('/dingtalk/web/APP_X/query/formdesign/updateFormSchemaInfo.json');
  const payload = querystring.parse(httpPost.mock.calls[1][2]);
  expect(JSON.parse(payload.title)).toEqual({ ...TITLE, zh_CN: '新中文' });
  expect(payload).toMatchObject({ _csrf_token: 'csrf', isRenderNav: 'false',
    needReportLine: 'n', showAdd: 'false', serialClean: '0', consultPerson: '',
    serialInfo: JSON.stringify(CONFIG.serialInfo), manageCustomActionInfo: '[]',
    manageCustomConfigInfo: '{"enabled":false}' });
  expect(payload).not.toHaveProperty('renderNav');
  const settings = { ...CONFIG };
  delete settings.title;
  delete settings.renderNav;
  expect(payload).toEqual(querystring.parse(querystring.stringify({
    ...settings, needReportLine: 'n', serialCleanList: '[]',
    serialInfo: JSON.stringify(CONFIG.serialInfo), manageCustomActionInfo: '[]',
    manageCustomConfigInfo: '{"enabled":false}',
    _api: 'Form.updateFormSchemaInfo', _csrf_token: 'csrf', _locale_time_zone_offset: '28800000',
    formUuid: 'FORM_X', title: JSON.stringify({ ...TITLE, zh_CN: '新中文' }), isRenderNav: 'false',
  })));
  expect(before).toEqual(CONFIG);
});

test('an unchanged title still saves an actual navigation change', async () => {
  const { command, httpPost } = fixture();
  await command.run(['APP_X', 'FORM_X', 'false', TITLE.zh_CN, '--locale', 'zh_CN']);
  expect(httpPost).toHaveBeenCalledTimes(2);
  const payload = querystring.parse(httpPost.mock.calls[1][2]);
  expect(payload.isRenderNav).toBe('false');
  expect(JSON.parse(payload.title)).toEqual(TITLE);
});

test.each([undefined, 'zh_CN'])('content locale uses existing environment resolution and explicit override (%s)', async locale => {
  jest.replaceProperty(process, 'env', { ...process.env, OPENYIDA_CONTENT_LOCALE: 'ja_JP' });
  const { command, httpPost } = fixture();
  await command.run(['APP_X', 'FORM_X', 'keep', 'New', ...(locale ? ['--locale', locale] : [])]);
  const payload = querystring.parse(httpPost.mock.calls[1][2]);
  expect(JSON.parse(payload.title)).toEqual({ ...TITLE, [locale || 'ja_JP']: 'New' });
});

test('transport read failures never reach a write', async () => {
  const { command, httpPost } = fixture();
  httpPost.mockReset().mockRejectedValue(new Error('read failed'));
  await expect(command.run(['APP_X', 'FORM_X', 'false', 'New', '--locale', 'zh_CN']))
    .rejects.toThrow('read failed');
  expect(httpPost).toHaveBeenCalledTimes(1);
});

test.each(['serialSwitch', 'pushTask', 'showPrint', 'customTitle', 'needReportLine', 'pageType', 'manageCustomConfigInfo'])(
  'rejects a null %s before a navigation write', async key => {
    const { command, httpPost } = fixture({ ...CONFIG, [key]: null });
    await expect(command.run(['APP_X', 'FORM_X', 'false', 'New', '--locale', 'zh_CN']))
      .rejects.toMatchObject({ code: 'CONFIG_PRESERVATION_UNSUPPORTED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
  }
);

test.each(['pageType', 'showNav', 'showRemark', 'serialSwitch', 'manageCustomConfigInfo'])(
  'rejects missing %s before a navigation write', async key => {
    const before = { ...CONFIG };
    delete before[key];
    const { command, httpPost } = fixture(before);
    await expect(command.run(['APP_X', 'FORM_X', 'false', 'New', '--locale', 'zh_CN']))
      .rejects.toMatchObject({ code: 'CONFIG_PRESERVATION_UNSUPPORTED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
  }
);

test.each([null, undefined, '', 'plain title', '{bad json', 'null', '[]', [], 0])(
  'rejects unreadable localized title %j without writing', async title => {
    const { command, httpPost } = fixture({ ...CONFIG, title });
    await expect(command.run(['APP_X', 'FORM_X', 'keep', 'New', '--locale', 'zh_CN']))
      .rejects.toMatchObject({ code: 'CONFIG_READ_FAILED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
  }
);

test.each(['keep', 'false'])('write failures reject without a fallback write (%s)', async nav => {
  const { command, httpPost } = fixture(CONFIG, { writeResponse: { success: false, errorCode: 'WRITE_REJECTED', errorMsg: 'rejected' } });
  await expect(command.run(['APP_X', 'FORM_X', nav, 'New', '--locale', 'zh_CN']))
    .rejects.toMatchObject({ code: 'WRITE_REJECTED' });
  expect(httpPost).toHaveBeenCalledTimes(2);
});

// FormDesignVoAdapter reads NEEDREPORTLINE as boolean; the write API stores y/n.
test.each([[true, 'y'], [false, 'n'], ['y', 'y'], ['n', 'n']])(
  'navigation updates round-trip reporting-line flag %j -> %s', async (value, expected) => {
    const { command, httpPost } = fixture({ ...CONFIG, needReportLine: value });
    await command.run(['APP_X', 'FORM_X', 'false', 'New', '--locale', 'zh_CN']);
    expect(httpPost).toHaveBeenCalledTimes(2);
    expect(querystring.parse(httpPost.mock.calls[1][2]).needReportLine).toBe(expected);
  }
);

test('navigation updates preserve the authoritative relateFormUuid alias', async () => {
  const before = { ...CONFIG, relateFormUuid: 'FORM_RELATED' };
  delete before.relateUuid;
  const { command, httpPost } = fixture(before);
  await command.run(['APP_X', 'FORM_X', 'false', 'New', '--locale', 'zh_CN']);
  expect(querystring.parse(httpPost.mock.calls[1][2]).relateUuid).toBe('FORM_RELATED');
});

test.each(['pageType', 'showNav', 'isNew', 'defaultManager'])(
  'rejects an empty defaulted %s before a navigation write', async key => {
    const { command, httpPost } = fixture({ ...CONFIG, [key]: '' });
    await expect(command.run(['APP_X', 'FORM_X', 'false', 'New', '--locale', 'zh_CN']))
      .rejects.toMatchObject({ code: 'CONFIG_PRESERVATION_UNSUPPORTED' });
    expect(httpPost).toHaveBeenCalledTimes(1);
  }
);

test.each([['keep', 'New', '--locale', 'unsupported'], ['keep', 'New', '--locale'], ['unknown', 'New']])(
  'invalid arguments fail without requests (%j)', async (...args) => {
    const { command, httpPost } = fixture();
    await expect(command.run(['APP_X', 'FORM_X', ...args])).rejects.toMatchObject({ code: 'CLI_INVALID_ARGUMENTS' });
    expect(httpPost).not.toHaveBeenCalled();
  }
);
