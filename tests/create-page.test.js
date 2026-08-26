'use strict';

const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const { buildPageInfoPostData, parseArgs } = require('../lib/app/create-page');
const { buildApiPath } = require('../lib/app/create-form/api-path');

const sourceCode = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'app', 'create-page.js'),
  'utf8'
);

describe('create-page locale handling', () => {
  test('uses a read-only auth preflight before the one-shot create request', () => {
    expect(sourceCode).toContain('requestNonIdempotentWithAuthPreflight');
    expect(sourceCode).toContain("buildApiPath(appType, 'getFormNavigationListByOrder', { queryModule: 'formnav' })");
  });

  test('buildApiPath supports the existing formnav query family', () => {
    expect(buildApiPath('APP_X', 'getFormNavigationListByOrder', { queryModule: 'formnav' }))
      .toBe('/dingtalk/web/APP_X/query/formnav/getFormNavigationListByOrder.json');
  });

  test('parseArgs accepts content locale flags', () => {
    expect(parseArgs(['APP_X', '経営ダッシュボード', '--mode', 'dashboard', '--locale', 'ja'])).toMatchObject({
      appType: 'APP_X',
      pageName: '経営ダッシュボード',
      mode: 'dashboard',
      locale: 'ja',
      hideNav: false,
    });
  });

  test('parseArgs keeps navigation visible unless hidden explicitly', () => {
    expect(parseArgs(['APP_X', '经营看板', '--mode', 'dashboard'])).toMatchObject({
      mode: 'dashboard',
      hideNav: false,
    });
    expect(parseArgs(['APP_X', '经营看板', '--mode', 'dashboard', '--hide-nav'])).toMatchObject({
      mode: 'dashboard',
      hideNav: true,
    });
    expect(parseArgs(['APP_X', '经营看板', '--render-nav', 'false'])).toMatchObject({
      hideNav: true,
    });
    expect(parseArgs(['APP_X', '经营看板', '--isRenderNav=true'])).toMatchObject({
      hideNav: false,
    });
  });

  test('buildPageInfoPostData fills Japanese title instead of null', () => {
    const parsed = querystring.parse(buildPageInfoPostData('FORM_X', '経営ダッシュボード', false));
    const title = JSON.parse(parsed.title);

    expect(title).toMatchObject({
      type: 'i18n',
      zh_CN: '経営ダッシュボード',
      en_US: '経営ダッシュボード',
      pureEn_US: '経営ダッシュボード',
      ja_JP: '経営ダッシュボード',
    });
  });
});

describe('create-page non-idempotent auth handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/yida-client');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('preflights with GET and sends the create POST once', async () => {
    jest.resetModules();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const authRef = {
      baseUrl: 'https://example.test',
      csrfToken: 'csrf',
    };
    const httpGet = jest.fn().mockResolvedValue({ success: true, content: [] });
    const httpPost = jest.fn().mockResolvedValue({
      success: true,
      content: { formUuid: 'FORM_PAGE' },
    });
    const requestNonIdempotentWithAuthPreflight = jest.fn(
      async (requestFn, preflightFn, ref) => {
        const preflight = await preflightFn(ref);
        if (!preflight || preflight.success === false) {
          return preflight;
        }
        return requestFn(ref);
      }
    );
    jest.doMock('../lib/core/utils', () => ({
      httpGet,
      httpPost,
      requestWithAutoLogin: jest.fn((requestFn, ref) => requestFn(ref)),
      requestNonIdempotentWithAuthPreflight,
    }));
    jest.doMock('../lib/core/yida-client', () => ({
      createAuthRef: jest.fn(() => authRef),
    }));
    jest.doMock('../lib/core/chalk', () => ({
      c: { cyan: '', reset: '' },
      banner: jest.fn(),
      step: jest.fn(),
      label: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      result: jest.fn(),
    }));

    const isolatedCreatePage = require('../lib/app/create-page');
    await isolatedCreatePage.run(['APP_TEST', '工作台', '--no-open']);

    expect(requestNonIdempotentWithAuthPreflight).toHaveBeenCalledTimes(1);
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(httpGet.mock.calls[0][1]).toContain('getFormNavigationListByOrder.json');
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpPost.mock.calls[0][1]).toContain('saveFormSchemaInfo.json');
    expect(JSON.parse(consoleSpy.mock.calls[0][0])).toMatchObject({
      success: true,
      pageId: 'FORM_PAGE',
      appType: 'APP_TEST',
    });
  });
});
