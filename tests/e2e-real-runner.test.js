'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  extractJsonObjects,
  getConfig,
  parseLastJson,
  run,
} = require('../scripts/e2e-real/runner');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');

describe('real E2E runner', () => {
  test('stays opt-in by default', () => {
    const config = getConfig({}, new Date('2026-05-11T00:00:00Z'));

    expect(config.enabled).toBe(false);
    expect(config.missing).toEqual(['OPENYIDA_E2E=1']);
    expect(config.prefix).toBe('OY_E2E_20260511000000');
  });

  test('default Canvas fixture exists and compiles without project templates', () => {
    const config = getConfig({}, new Date('2026-05-11T00:00:00Z'));
    const source = fs.readFileSync(config.pageSource, 'utf8');

    expect(config.pageSource).toBe(path.join(__dirname, '..', 'scripts', 'e2e-real', 'fixtures', 'page.canvas.jsx'));
    expect(() => compileCanvasLocal(source, { sourcePath: config.pageSource })).not.toThrow();
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
    const pageSource = getConfig({}).pageSource;
    const config = {
      enabled: true,
      missing: [],
      prefix: 'OY_E2E_TEST',
      appName: 'OY_E2E_TEST_App',
      formName: 'OY_E2E_TEST_Form',
      pageName: 'OY_E2E_TEST_Page',
      fieldsFile: path.join(__dirname, '..', 'scripts', 'e2e-real', 'fixtures', 'form-fields.json'),
      pageSource,
      registryDir: '/tmp/openyida-e2e-test',
      corpId: 'ding-test-corp',
      skipPublish: false,
    };

    const result = run({
      env: { OPENYIDA_E2E: '1' },
      config,
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

  test('rejects an invalid Canvas fixture before running any CLI command', () => {
    const calls = [];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-e2e-invalid-page-'));
    const pageSource = path.join(tmpDir, 'invalid.canvas.jsx');
    fs.writeFileSync(pageSource, 'export default function YidaComp( {');
    const config = {
      ...getConfig({ OPENYIDA_E2E: '1' }),
      pageSource,
    };

    expect(() => run({
      config,
      runCli: (args) => {
        calls.push(args);
        return { stdout: '{}', json: {} };
      },
    })).toThrow(/E2E page source is not compilable/);
    expect(calls).toEqual([]);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
