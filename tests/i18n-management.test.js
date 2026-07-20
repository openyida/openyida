'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://customer.yidaapps.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  buildLanguageConfig,
  getOverview,
  normalizeI18nItem,
  normalizeLanguageTag,
  queryI18nItems,
  translateText,
  updateLanguageConfig,
  upsertI18nItem,
} = require('../lib/i18n-management/i18n-management');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
});

describe('i18n-management helpers', () => {
  test('normalizes built-in and extension language tags', () => {
    expect(normalizeLanguageTag('ja')).toBe('ja_JP');
    expect(normalizeLanguageTag('en-us')).toBe('en_US');
    expect(normalizeLanguageTag('es-419')).toBe('es_419');
    expect(normalizeLanguageTag('EXT_AR')).toBe('ext_ar');
  });

  test('buildLanguageConfig preserves existing names and includes default language', () => {
    const config = buildLanguageConfig({
      defaultLanguage: 'zh_CN',
      languageList: [
        { languageTag: 'zh_CN', languageName: '简体中文', enabled: true },
        { languageTag: 'en_US', languageName: 'English', enabled: false },
      ],
    }, {
      default: 'ja',
      languages: 'zh_CN,en_US',
    });

    expect(config).toMatchObject({
      defaultLanguage: 'ja_JP',
      languageList: [
        { languageTag: 'ja_JP', languageName: '日语', enabled: true },
        { languageTag: 'zh_CN', languageName: '简体中文', enabled: true },
        { languageTag: 'en_US', languageName: 'English', enabled: false },
      ],
    });
  });

  test('normalizeI18nItem accepts CLI-style locale options', () => {
    expect(normalizeI18nItem({
      i18nKey: 'welcome_title',
      zh_CN: '欢迎',
      en_US: 'Welcome',
      ja_JP: 'ようこそ',
    })).toEqual({
      i18nKey: 'welcome_title',
      i18nText: {
        zh_CN: '欢迎',
        en_US: 'Welcome',
        ja_JP: 'ようこそ',
      },
      textFormat: 'plain',
    });
  });
});

describe('i18n-management api', () => {
  test('getOverview reads app-specific ability and language config', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: true })
      .mockResolvedValueOnce({ success: true, content: { corpVersion: 'HYBRID_CLOUD' } })
      .mockResolvedValueOnce({
        success: true,
        content: {
          defaultLanguage: 'zh_CN',
          languageList: [{ languageTag: 'zh_CN', languageName: '简体中文', enabled: true }],
        },
      })
      .mockResolvedValueOnce({ success: true, content: true })
      .mockResolvedValueOnce({ success: true, content: { status: null } });

    const result = await getOverview('APP_1');

    expect(utils.httpGet.mock.calls.map(call => call[1])).toEqual([
      '/APP_1/query/commodity/checkI18nAbility.json',
      '/APP_1/query/commodity/i18nAbilityContext.json',
      '/APP_1/query/appI18n/getAppLanguageConfig.json',
      '/APP_1/query/appI18n/checkAppI18nUpgraded.json',
      '/APP_1/query/appI18n/checkAppTranslationStatus.json',
    ]);
    expect(result).toMatchObject({
      success: true,
      appType: 'APP_1',
      baseUrl: 'https://customer.yidaapps.com',
      ability: { enabled: true },
      upgraded: true,
    });
  });

  test('updateLanguageConfig posts serialized config', async () => {
    utils.httpPost.mockResolvedValueOnce({ success: true, content: true });

    const config = {
      defaultLanguage: 'en_US',
      languageList: [{ languageTag: 'en_US', languageName: 'English', enabled: true }],
    };
    const result = await updateLanguageConfig('APP_1', config);
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(utils.httpPost.mock.calls[0][1]).toBe('/APP_1/query/appI18n/updateAppLanguageConfig.json');
    expect(JSON.parse(body.config)).toEqual(config);
    expect(result).toMatchObject({ success: true, appType: 'APP_1', config });
  });

  test('upsertI18nItem checks ability, saves item, and optionally binds page', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: true })
      .mockResolvedValueOnce({ success: true, content: { corpVersion: 'HYBRID_CLOUD' } });
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: { id: 1 } })
      .mockResolvedValueOnce({ success: true, content: true });

    const result = await upsertI18nItem('APP_1', {
      i18nKey: 'page_title',
      zh_CN: '标题',
      en_US: 'Title',
      bind: 'FORM_1',
      targetType: 'page',
    });
    const saveBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
    const bindBody = querystring.parse(utils.httpPost.mock.calls[1][2]);

    expect(utils.httpPost.mock.calls[0][1]).toBe('/APP_1/query/appI18n/createOrUpdateI18nItem.json');
    expect(JSON.parse(saveBody.i18nText)).toEqual({ zh_CN: '标题', en_US: 'Title' });
    expect(utils.httpPost.mock.calls[1][1]).toBe('/APP_1/query/appI18n/addI18nBinding.json');
    expect(bindBody).toMatchObject({
      targetType: 'page',
      catalog1: 'FORM_1',
      i18nKeyList: 'page_title',
    });
    expect(result).toMatchObject({
      success: true,
      appType: 'APP_1',
      i18nKey: 'page_title',
      binding: { success: true, formUuid: 'FORM_1' },
    });
  });

  test('queryI18nItems uses binded item endpoint when formUuid exists', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: true, content: { data: [], totalCount: 0 } });

    await queryI18nItems('APP_1', { formUuid: 'FORM_1', targetType: 'page', page: 2, size: 50 });

    expect(utils.httpGet.mock.calls[0][1]).toBe('/APP_1/query/appI18n/getBinded18nItems.json');
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      catalog1: 'FORM_1',
      targetType: 'page',
      pageIndex: 2,
      pageSize: 50,
    });
  });

  test('translateText posts source and target language list', async () => {
    utils.httpGet
      .mockResolvedValueOnce({ success: true, content: true })
      .mockResolvedValueOnce({ success: true, content: {} });
    utils.httpPost.mockResolvedValueOnce({ success: true, content: { en_US: 'Welcome' } });

    const result = await translateText('APP_1', {
      text: '欢迎',
      source: 'zh',
      targets: 'en_US,ja',
    });
    const body = querystring.parse(utils.httpPost.mock.calls[0][2]);

    expect(utils.httpPost.mock.calls[0][1]).toBe('/APP_1/query/appI18n/translateMultiLang.json');
    expect(body).toMatchObject({
      sourceText: '欢迎',
      sourceLanguage: 'zh_CN',
      targetLanguageList: '["en_US","ja_JP"]',
    });
    expect(result).toMatchObject({
      success: true,
      translations: { en_US: 'Welcome' },
    });
  });
});
