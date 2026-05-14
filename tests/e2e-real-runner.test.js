'use strict';

const path = require('path');

const {
  decodeCookieData,
  extractJsonObjects,
  getConfig,
  parseLastJson,
  run,
} = require('../scripts/e2e-real/runner');

function encodeCookieData(cookieData) {
  return Buffer.from(JSON.stringify(cookieData), 'utf8').toString('base64');
}

describe('real E2E runner', () => {
  test('stays opt-in by default', () => {
    const config = getConfig({}, new Date('2026-05-11T00:00:00Z'));

    expect(config.enabled).toBe(false);
    expect(config.missing).toEqual(['OPENYIDA_E2E=1']);
    expect(config.prefix).toBe('OY_E2E_20260511000000');
  });

  test('decodes optional cookie payload and applies base url override', () => {
    const cookieData = decodeCookieData({
      cookiesBase64: encodeCookieData([{ name: 'sid', value: '1' }]),
      baseUrl: 'https://example.test',
    });

    expect(cookieData).toEqual({
      cookies: [{ name: 'sid', value: '1' }],
      base_url: 'https://example.test',
    });
  });

  test('extracts the last JSON object from decorated CLI output', () => {
    const output = [
      'banner {not json}',
      '{"success":true,"appType":"APP_OLD"}',
      'done',
      '{"success":true,"appType":"APP_NEW","nested":{"ok":true}}',
    ].join('\n');

    expect(extractJsonObjects(output)).toHaveLength(2);
    expect(parseLastJson(output)).toEqual({
      success: true,
      appType: 'APP_NEW',
      nested: { ok: true },
    });
  });

  test('runs the real E2E command chain and records resources', () => {
    const calls = [];
    const resources = [];
    const registry = { resources: [], commands: [] };
    const config = {
      enabled: true,
      missing: [],
      prefix: 'OY_E2E_TEST',
      appName: 'OY_E2E_TEST_App',
      formName: 'OY_E2E_TEST_Form',
      pageName: 'OY_E2E_TEST_Page',
      fieldsFile: path.join(__dirname, '..', 'scripts', 'e2e-real', 'fixtures', 'form-fields.json'),
      pageSource: path.join(__dirname, '..', 'project', 'pages', 'src', 'demo-compat-smoke.oyd.jsx'),
      registryDir: '/tmp/openyida-e2e-test',
      corpId: 'ding-test-corp',
      skipPublish: false,
    };

    const result = run({
      env: { OPENYIDA_E2E: '1' },
      config,
      writeCookieCache: () => {},
      createRegistry: () => ({ registry, registryPath: '/tmp/openyida-e2e-test/OY_E2E_TEST.json' }),
      writeRegistry: () => {},
      addResource: (currentRegistry, registryPath, resource) => {
        resources.push(resource);
        currentRegistry.resources.push(resource);
      },
      runCli: (args) => {
        calls.push(args);
        const command = args[0];
        if (command === 'login') {return { stdout: '{"status":"ok"}', json: { status: 'ok' } };}
        if (command === 'create-app') {return { stdout: '{"success":true,"appType":"APP_E2E"}', json: { success: true, appType: 'APP_E2E' } };}
        if (command === 'create-form') {return { stdout: '{"success":true,"formUuid":"FORM-E2E"}', json: { success: true, formUuid: 'FORM-E2E' } };}
        if (command === 'create-page') {return { stdout: '{"success":true,"pageId":"PAGE-E2E"}', json: { success: true, pageId: 'PAGE-E2E' } };}
        return { stdout: '{"success":true}', json: { success: true } };
      },
    });

    expect(result.skipped).toBe(false);
    expect(calls).toEqual([
      ['login', '--check-only', '--json', '--quiet'],
      ['org', 'switch', '--corp-id', 'ding-test-corp', '--quiet'],
      ['app-list', '--size', '1', '--quiet'],
      ['create-app', 'OY_E2E_TEST_App', '--desc', 'OpenYida real E2E disposable app', '--no-open', '--quiet'],
      ['create-form', 'create', 'APP_E2E', 'OY_E2E_TEST_Form', config.fieldsFile, '--no-open', '--quiet'],
      ['get-schema', 'APP_E2E', 'FORM-E2E', '--json', '--quiet'],
      ['data', 'query', 'form', 'APP_E2E', 'FORM-E2E', '--size', '1', '--quiet'],
      ['create-page', 'APP_E2E', 'OY_E2E_TEST_Page', '--mode', 'dashboard', '--no-open', '--quiet'],
      ['publish', config.pageSource, 'APP_E2E', 'PAGE-E2E', '--health-check', '--no-open', '--quiet'],
    ]);
    expect(resources.map((resource) => resource.type)).toEqual(['app', 'form', 'page']);
    expect(registry.status).toBe('passed');
  });
});
