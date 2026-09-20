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
  test('every manifest parameter is accepted by the create-page parser', () => {
    const { flattenCommandManifest } = require('../lib/core/command-manifest');
    const entry = flattenCommandManifest().find(command => command.id === 'create-page');
    const cases = {
      mode: { value: 'dashboard', expected: { mode: 'dashboard' } },
      hideNav: { expected: { hideNav: true } },
      renderNav: { value: 'false', expected: { hideNav: true } },
      locale: { value: 'ja_JP', expected: { locale: 'ja_JP' } },
      open: { expected: { openMode: true } },
      noOpen: { expected: { openMode: false } },
    };
    expect(entry.args.filter(arg => arg.source === 'positional').map(arg => arg.name)).toEqual(['appType', 'pageName']);
    for (const arg of entry.args.filter(arg => arg.source === 'option')) {
      const scenario = cases[arg.name];
      expect(scenario).toBeDefined();
      for (const option of arg.builder_options) {
        const argv = ['APP_X', '工作台', option, ...(scenario.value ? [scenario.value] : [])];
        expect(parseArgs(argv)).toMatchObject({ appType: 'APP_X', pageName: '工作台', args: ['APP_X', '工作台'], ...scenario.expected });
      }
    }
    expect(parseArgs(['APP_X', '工作台', '--hide-nav', '--render-nav=true']).hideNav).toBe(false);
    expect(parseArgs(['APP_X', '工作台', '--render-nav=true', '--hide-nav']).hideNav).toBe(true);
  });

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

describe('create-page hidden navigation readback', () => {
  let logSpy;
  let httpPost;

  function setup(configs, updateResponse = { success: true }) {
    jest.resetModules();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    httpPost = jest.fn(async (_base, url) => {
      if (url.endsWith('/saveFormSchemaInfo.json')) {
        return { success: true, content: { formUuid: 'FORM_PAGE' } };
      }
      if (url.endsWith('/updateFormSchemaInfo.json')) {return updateResponse;}
      if (url.endsWith('/getFormSchemaInfo.json')) {
        const config = configs.shift();
        if (config instanceof Error) {throw config;}
        return config;
      }
      throw new Error(`Unexpected API: ${url}`);
    });
    jest.doMock('../lib/core/utils', () => ({
      httpGet: jest.fn().mockResolvedValue({ success: true, content: [] }), httpPost,
      requestWithAutoLogin: jest.fn((fn, ref) => fn(ref)),
      requestNonIdempotentWithAuthPreflight: jest.fn(async (fn, preflight, ref) => {
        await preflight(ref);
        return fn(ref);
      }),
    }));
    jest.doMock('../lib/core/yida-client', () => ({
      createAuthRef: () => ({ baseUrl: 'https://example.test', csrfToken: 'csrf' }),
    }));
    jest.doMock('../lib/core/chalk', () => ({
      c: { cyan: '', reset: '' }, banner: jest.fn(), step: jest.fn(), label: jest.fn(),
      info: jest.fn(), warn: jest.fn(), success: jest.fn(), result: jest.fn(),
    }));
    return () => require('../lib/app/create-page').run(['APP_TEST', '预约前台', '--hide-nav', '--no-open']);
  }

  const configResponse = content => ({ success: true, content });
  const result = () => JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0]);
  const writes = () => httpPost.mock.calls.filter(call => call[1].endsWith('/updateFormSchemaInfo.json'));

  afterEach(() => {
    expect(httpPost.mock.calls.filter(call => call[1].endsWith('/saveFormSchemaInfo.json'))).toHaveLength(1);
    jest.restoreAllMocks();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/yida-client');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test.each([
    { renderNav: false }, { renderNav: 'false' }, { isRenderNav: false }, { isRenderNav: 'false' },
  ])('reports hidden only after reading persisted %j', async config => {
    await setup([configResponse({ renderNav: true }), configResponse(config)])();
    expect(writes()).toHaveLength(1);
    expect(result()).toMatchObject({
      success: true, pageCreated: true, hideNavRequested: true, hideNav: true, chromeless: true,
      navigationVerification: { verified: true, renderNav: false, attempts: 1 },
      url: 'https://example.test/APP_TEST/custom/FORM_PAGE?isRenderNav=false',
    });
  });

  test('repairs an acknowledged but ineffective write once, preserving the latest configuration', async () => {
    await setup([
      configResponse({ renderNav: true, showPrint: 'n', manageCustomActionInfo: [{ name: 'existing' }] }),
      configResponse({ renderNav: true, showPrint: 'y', submissionRule: 'ONCE' }),
      configResponse({ renderNav: false }),
    ])();
    expect(writes()).toHaveLength(2);
    expect(querystring.parse(writes()[0][2])).toMatchObject({
      formUuid: 'FORM_PAGE', isRenderNav: 'false', showPrint: 'n', manageCustomActionInfo: '[{"name":"existing"}]',
    });
    expect(querystring.parse(writes()[1][2])).toMatchObject({
      formUuid: 'FORM_PAGE', isRenderNav: 'false', showPrint: 'y', submissionRule: 'ONCE',
    });
    expect(result().navigationVerification).toMatchObject({ verified: true, attempts: 2 });
  });

  test.each([
    [{ renderNav: true }, false],
    [{ renderNav: 'true', isRenderNav: false }, false],
    [{ renderNav: true, isRenderNav: 'false' }, false],
    [{ renderNav: null, isRenderNav: false }, null],
    [{}, null],
    [{ renderNav: 'unknown' }, null],
  ])('fails honestly after bounded repair when readback is %j', async (config, hideNav) => {
    const run = setup([configResponse({ renderNav: true }), configResponse(config), configResponse(config)]);
    await expect(run()).rejects.toMatchObject({ code: 'CREATE_PAGE_NAVIGATION_NOT_VERIFIED', exitCode: 1 });
    expect(writes()).toHaveLength(2);
    expect(result()).toMatchObject({
      success: false, pageCreated: true, pageId: 'FORM_PAGE', hideNav, chromeless: false,
      navigationVerification: { verified: false, attempts: 2 },
      recovery: { command: 'update-form-config', args: ['APP_TEST', 'FORM_PAGE', 'false', '预约前台'] },
      url: 'https://example.test/APP_TEST/workbench/FORM_PAGE',
    });
    expect(result().browser_handoff).toBeUndefined();
  });

  test.each([
    new Error('network unavailable'),
    { success: false, errorMsg: 'read failed', content: { renderNav: false } },
    { success: true, __needLogin: true, content: { renderNav: false } },
  ])('retains the created page when verification cannot be read', async failure => {
    const run = setup([configResponse({ renderNav: true }), failure]);
    await expect(run()).rejects.toMatchObject({ code: 'CREATE_PAGE_NAVIGATION_NOT_VERIFIED' });
    expect(writes()).toHaveLength(1);
    expect(result()).toMatchObject({ pageCreated: true, pageId: 'FORM_PAGE', hideNav: null, chromeless: false });
  });

  test('does not overwrite configuration if the initial read fails', async () => {
    const run = setup([new Error('read failed')]);
    await expect(run()).rejects.toMatchObject({ code: 'CREATE_PAGE_NAVIGATION_NOT_VERIFIED' });
    expect(writes()).toHaveLength(0);
    expect(result()).toMatchObject({ pageCreated: true, hideNav: null, navigationVerification: { attempts: 0 } });
  });

  test('stops on a rejected write and reports the actual visible navigation', async () => {
    const run = setup([configResponse({ renderNav: true }), configResponse({ renderNav: true })], { success: false, errorMsg: 'permission denied' });
    await expect(run()).rejects.toMatchObject({ code: 'CREATE_PAGE_NAVIGATION_NOT_VERIFIED' });
    expect(writes()).toHaveLength(1);
    expect(result()).toMatchObject({ hideNav: false, dashboardConfigWarning: 'permission denied' });
  });
});
