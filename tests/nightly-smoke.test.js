'use strict';

const {
  getSmokeConfig,
  run,
} = require('../scripts/nightly-smoke');

describe('nightly real-environment smoke script', () => {
  test('accepts page-only smoke config for custom display pages', () => {
    const env = {
      OPENYIDA_SMOKE_APP_TYPE: 'APP_SMOKE',
      OPENYIDA_SMOKE_PAGE_UUID: 'FORM-PAGE',
      OPENYIDA_SMOKE_PAGE_SOURCE: 'project/pages/src/demo-compat-smoke.oyd.jsx',
      OPENYIDA_SMOKE_BASE_URL: 'https://example.test',
    };

    expect(getSmokeConfig(env)).toEqual({
      missing: [],
      appType: 'APP_SMOKE',
      formUuid: undefined,
      pageUuid: 'FORM-PAGE',
      pageSource: 'project/pages/src/demo-compat-smoke.oyd.jsx',
      baseUrl: 'https://example.test',
    });
  });

  test('runs page smoke without form data query when only page uuid is configured', () => {
    const calls = [];
    const seenEndpoints = [];
    const env = {
      OPENYIDA_SMOKE_APP_TYPE: 'APP_SMOKE',
      OPENYIDA_SMOKE_PAGE_UUID: 'FORM-PAGE',
      OPENYIDA_SMOKE_PAGE_SOURCE: 'project/pages/src/demo-compat-smoke.oyd.jsx',
      OPENYIDA_SMOKE_BASE_URL: 'https://example.test',
    };

    run({
      env,
      runCli: (args, cliEnv) => {
        calls.push(args);
        seenEndpoints.push(cliEnv.OPENYIDA_ENDPOINT);
      },
    });

    expect(calls).toEqual([
      ['login', '--check-only'],
      ['app-list', '--size', '1'],
      ['get-schema', 'APP_SMOKE', 'FORM-PAGE'],
      ['publish', 'project/pages/src/demo-compat-smoke.oyd.jsx', 'APP_SMOKE', 'FORM-PAGE', '--health-check', '--no-open'],
    ]);
    expect(seenEndpoints.every(endpoint => endpoint === 'https://example.test')).toBe(true);
  });

  test('keeps legacy form smoke checks when form uuid is configured', () => {
    const calls = [];
    const env = {
      OPENYIDA_SMOKE_APP_TYPE: 'APP_SMOKE',
      OPENYIDA_SMOKE_FORM_UUID: 'FORM-DATA',
    };

    run({
      env,
      runCli: (args) => calls.push(args),
    });

    expect(calls).toEqual([
      ['login', '--check-only'],
      ['app-list', '--size', '1'],
      ['get-schema', 'APP_SMOKE', 'FORM-DATA'],
      ['data', 'query', 'form', 'APP_SMOKE', 'FORM-DATA', '--size', '1'],
    ]);
  });
});
