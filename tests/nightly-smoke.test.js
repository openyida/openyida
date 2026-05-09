'use strict';

const {
  decodeCookieData,
  getSmokeConfig,
  run,
} = require('../scripts/nightly-smoke');

function encodeCookieData(cookieData) {
  return Buffer.from(JSON.stringify(cookieData), 'utf8').toString('base64');
}

describe('nightly real-environment smoke script', () => {
  test('accepts page-only smoke config for custom display pages', () => {
    const env = {
      OPENYIDA_SMOKE_COOKIES_BASE64: encodeCookieData({ cookies: [{ name: 'sid', value: '1' }] }),
      OPENYIDA_SMOKE_APP_TYPE: 'APP_SMOKE',
      OPENYIDA_SMOKE_PAGE_UUID: 'FORM-PAGE',
      OPENYIDA_SMOKE_PAGE_SOURCE: 'project/pages/src/demo-compat-smoke.oyd.jsx',
    };

    expect(getSmokeConfig(env)).toEqual({
      missing: [],
      appType: 'APP_SMOKE',
      formUuid: undefined,
      pageUuid: 'FORM-PAGE',
      pageSource: 'project/pages/src/demo-compat-smoke.oyd.jsx',
    });
  });

  test('runs page smoke without form data query when only page uuid is configured', () => {
    const calls = [];
    const env = {
      OPENYIDA_SMOKE_COOKIES_BASE64: encodeCookieData({ cookies: [{ name: 'sid', value: '1' }] }),
      OPENYIDA_SMOKE_APP_TYPE: 'APP_SMOKE',
      OPENYIDA_SMOKE_PAGE_UUID: 'FORM-PAGE',
      OPENYIDA_SMOKE_PAGE_SOURCE: 'project/pages/src/demo-compat-smoke.oyd.jsx',
    };

    run({
      env,
      writeCookieCache: () => {},
      runCli: (args) => calls.push(args),
    });

    expect(calls).toEqual([
      ['login', '--check-only'],
      ['app-list', '--size', '1'],
      ['get-schema', 'APP_SMOKE', 'FORM-PAGE'],
      ['publish', 'project/pages/src/demo-compat-smoke.oyd.jsx', 'APP_SMOKE', 'FORM-PAGE', '--health-check', '--no-open'],
    ]);
  });

  test('keeps legacy form smoke checks when form uuid is configured', () => {
    const calls = [];
    const env = {
      OPENYIDA_SMOKE_COOKIES_BASE64: encodeCookieData({ cookies: [{ name: 'sid', value: '1' }] }),
      OPENYIDA_SMOKE_APP_TYPE: 'APP_SMOKE',
      OPENYIDA_SMOKE_FORM_UUID: 'FORM-DATA',
    };

    run({
      env,
      writeCookieCache: () => {},
      runCli: (args) => calls.push(args),
    });

    expect(calls).toEqual([
      ['login', '--check-only'],
      ['app-list', '--size', '1'],
      ['get-schema', 'APP_SMOKE', 'FORM-DATA'],
      ['data', 'query', 'form', 'APP_SMOKE', 'FORM-DATA', '--size', '1'],
    ]);
  });

  test('decodes cookie data and applies smoke base url override', () => {
    const cookieData = decodeCookieData({
      OPENYIDA_SMOKE_COOKIES_BASE64: encodeCookieData([{ name: 'sid', value: '1' }]),
      OPENYIDA_SMOKE_BASE_URL: 'https://example.test',
    });

    expect(cookieData).toEqual({
      cookies: [{ name: 'sid', value: '1' }],
      base_url: 'https://example.test',
    });
  });
});
