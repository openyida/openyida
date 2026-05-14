'use strict';

const path = require('path');

const {
  buildDashboardSource,
  buildDashboardSkillSource,
  buildBusinessDashboardSource,
  buildResultApp,
  collectFields,
  findValueByKeys,
  getFullConfig,
  parseStages,
  run,
} = require('../scripts/e2e-real/full-runner');

describe('full real E2E runner', () => {
  test('defaults to the broad real-environment stage set', () => {
    const config = getFullConfig({
      OPENYIDA_E2E: '1',
      OPENYIDA_E2E_PREFIX: 'OY_E2E_FULL',
    });

    expect(config.enabled).toBe(true);
    expect(config.stages).toContain('app');
    expect(config.stages).toContain('data');
    expect(config.stages).toContain('report');
    expect(config.stages).toContain('dashboard');
    expect(config.stages).toContain('connector-local');
  });

  test('parses explicit stage lists', () => {
    expect(parseStages('auth,app,data')).toEqual(['auth', 'app', 'data']);
    expect(parseStages('default')).toContain('form');
    expect(parseStages('all')).toContain('import');
    expect(parseStages('all')).toContain('ai');
  });

  test('collects Yida field metadata from schema trees', () => {
    const fields = collectFields({
      componentName: 'FormContainer',
      children: [
        {
          componentName: 'TextField',
          props: { fieldId: 'textField_abc', label: { zh_CN: 'Name' } },
        },
        {
          componentName: 'SelectField',
          props: { fieldId: 'selectField_status', label: { zh_CN: 'Status' } },
        },
      ],
    });

    expect(fields).toEqual([
      {
        label: 'Name',
        componentName: 'TextField',
        fieldId: 'textField_abc',
        reportFieldCode: 'textField_abc',
      },
      {
        label: 'Status',
        componentName: 'SelectField',
        fieldId: 'selectField_status',
        reportFieldCode: 'selectField_status_value',
      },
    ]);
  });

  test('finds instance identifiers in nested API payloads', () => {
    expect(findValueByKeys({ content: { formInstId: 'FORM-INST-1' } }, ['formInstId'])).toBe('FORM-INST-1');
  });

  test('runs a selected full-stage chain with mocked CLI calls', () => {
    const calls = [];
    const registry = { resources: [], commands: [] };
    const config = {
      enabled: true,
      prefix: 'OY_E2E_FULL',
      appName: 'OY_E2E_FULL_App',
      formName: 'OY_E2E_FULL_Form',
      pageName: 'OY_E2E_FULL_Page',
      updateAppName: 'OY_E2E_FULL_App_Renamed',
      resultAppName: 'OY_E2E_FULL_PASSED',
      importAppName: 'OY_E2E_FULL_Imported',
      fieldsFile: path.join(__dirname, '..', 'scripts', 'e2e-real', 'fixtures', 'form-fields.json'),
      pageSource: path.join(__dirname, '..', 'project', 'pages', 'src', 'demo-compat-smoke.oyd.jsx'),
      registryDir: '/tmp/openyida-e2e-full-test',
      corpId: 'ding-test-corp',
      stages: ['auth', 'app', 'form', 'page', 'data', 'report', 'dashboard', 'batch', 'connector-local'],
    };

    const schema = {
      success: true,
      content: {
        pages: [
          {
            componentsTree: [
              {
                children: [
                  { componentName: 'TextField', props: { fieldId: 'textField_1', label: { zh_CN: 'E2E Text' } } },
                  { componentName: 'NumberField', props: { fieldId: 'numberField_1', label: { zh_CN: 'E2E Number' } } },
                  { componentName: 'SelectField', props: { fieldId: 'selectField_1', label: { zh_CN: 'E2E Status' } } },
                ],
              },
            ],
          },
        ],
      },
    };

    run({
      env: { OPENYIDA_E2E: '1' },
      config,
      writeCookieCache: () => {},
      createRegistry: () => ({ registry, registryPath: '/tmp/openyida-e2e-full-test/OY_E2E_FULL.json' }),
      writeRegistry: () => {},
      addResource: (currentRegistry, registryPath, resource) => {
        currentRegistry.resources.push(resource);
      },
      writeJson: (filePath) => filePath,
      writeText: (filePath) => filePath,
      runCli: (args) => {
        calls.push(args);
        const command = args[0];
        const sub = args[1];
        if (command === 'create-app') {return { json: { success: true, appType: 'APP_FULL' } };}
        if (command === 'create-form' && sub === 'create') {return { json: { success: true, formUuid: 'FORM-FULL' } };}
        if (command === 'get-schema') {return { json: schema };}
        if (command === 'create-page') {return { json: { success: true, pageId: 'PAGE-FULL' } };}
        if (command === 'create-report') {return { json: { success: true, reportId: 'REPORT-FULL' } };}
        if (command === 'data' && sub === 'create') {return { json: { success: true, content: { formInstId: 'INST-FULL' } } };}
        return { json: { success: true, status: 'ok' } };
      },
    });

    expect(calls).toContainEqual(['org', 'switch', '--corp-id', 'ding-test-corp', '--quiet']);
    expect(calls).toContainEqual(['update-app', 'APP_FULL', '--name', 'OY_E2E_FULL_App_Renamed', '--quiet']);
    expect(calls.some((args) => args[0] === 'create-page' && args[2] === 'OY_E2E_FULL_Dashboard')).toBe(true);
    expect(calls.some((args) => args[0] === 'create-page' && args[2] === 'OY_E2E_FULL_DashboardSkill')).toBe(true);
    expect(calls.some((args) => args[0] === 'create-page' && args[2] === 'OY_E2E_FULL_BusinessDashboard')).toBe(true);
    expect(calls.some((args) => args[0] === 'check-page' && String(args[1]).includes('business-dashboard.oyd.jsx'))).toBe(true);
    expect(calls.some((args) => args[0] === 'publish' && String(args[1]).includes('business-dashboard.oyd.jsx') && args[2] === 'APP_FULL' && args[3] === 'PAGE-FULL' && args.includes('--health-check'))).toBe(true);
    expect(calls.some((args) => args[0] === 'publish' && args[2] === 'APP_FULL' && args[3] === 'PAGE-FULL')).toBe(true);
    expect(calls).toContainEqual(['update-app', 'APP_FULL', '--name', 'OY_E2E_FULL_PASSED', '--quiet']);
    expect(calls).toContainEqual(['data', 'get', 'form', 'APP_FULL', '--inst-id', 'INST-FULL', '--quiet']);
    expect(calls.some((args) => args[0] === 'connector' && args[1] === 'parse-api')).toBe(true);
    expect(registry.status).toBe('passed');
    expect(registry.resultApp).toMatchObject({
      appType: 'APP_FULL',
      name: 'OY_E2E_FULL_PASSED',
      businessDashboardFormUuid: 'PAGE-FULL',
      businessDashboardUrl: 'https://www.aliwork.com/APP_FULL/custom/PAGE-FULL?isRenderNav=false',
      businessDashboardShareUrl: 'https://www.aliwork.com/o/oy_e2e_full-business-dashboard',
    });
    expect(registry.businessDashboard).toMatchObject({
      appType: 'APP_FULL',
      pageId: 'PAGE-FULL',
      url: 'https://www.aliwork.com/APP_FULL/custom/PAGE-FULL?isRenderNav=false',
      sharePath: '/o/oy_e2e_full-business-dashboard',
    });
  });

  test('builds a human-inspectable result app summary', () => {
    const resultApp = buildResultApp({
      appType: 'APP_RESULT',
      formUuid: 'FORM-1',
      pageId: 'PAGE-1',
      dashboardPageId: 'DASHBOARD-1',
      businessDashboardPageId: 'BUSINESS-DASHBOARD-1',
      businessDashboardFormUuid: 'BUSINESS-DASHBOARD-1',
      businessDashboardSharePath: '/o/business-dashboard',
      reportId: 'REPORT-1',
    }, 'OY_E2E_RESULT_PASSED');

    expect(resultApp).toEqual({
      appType: 'APP_RESULT',
      name: 'OY_E2E_RESULT_PASSED',
      adminUrl: 'https://www.aliwork.com/APP_RESULT/admin',
      workbenchUrl: 'https://www.aliwork.com/APP_RESULT/workbench',
      formUrl: 'https://www.aliwork.com/APP_RESULT/workbench/FORM-1',
      pageUrl: 'https://www.aliwork.com/APP_RESULT/custom/DASHBOARD-1?isRenderNav=false',
      businessDashboardFormUuid: 'BUSINESS-DASHBOARD-1',
      businessDashboardUrl: 'https://www.aliwork.com/APP_RESULT/custom/BUSINESS-DASHBOARD-1?isRenderNav=false',
      businessDashboardShareUrl: 'https://www.aliwork.com/o/business-dashboard',
      reportUrl: 'https://www.aliwork.com/APP_RESULT/workbench/REPORT-1',
    });
  });

  test('builds a dashboard page source with coverage and resources', () => {
    const source = buildDashboardSource(
      { prefix: 'OY_E2E_SOURCE', resultAppName: 'OY_E2E_SOURCE_PASSED' },
      {
        appType: 'APP_SOURCE',
        formUuid: 'FORM-SOURCE',
        pageId: 'PAGE-SOURCE',
        reportId: 'REPORT-SOURCE',
      },
    );

    expect(source).toContain('Full E2E Dashboard');
    expect(source).toContain('OPENYIDA REAL ENVIRONMENT E2E');
    expect(source).toContain('APP_SOURCE');
    expect(source).toContain('REPORT-SOURCE');
  });

  test('builds a dashboard skill verification page source', () => {
    const source = buildDashboardSkillSource(
      { prefix: 'OY_E2E_DASH', resultAppName: 'OY_E2E_DASH_PASSED' },
      { formUuid: 'FORM-DASH', reportId: 'REPORT-DASH' },
    );

    expect(source).toContain('OpenYida Dashboard Skill E2E');
    expect(source).toContain('YIDA DASHBOARD SKILL');
    expect(source).toContain('sl-no-capture');
    expect(source).toContain('FORM-DASH');
    expect(source).toContain('REPORT-DASH');
    expect(source).not.toContain('onMouseEnter');
    expect(source).not.toContain('onMouseLeave');
  });

  test('builds a real business dashboard acceptance page source', () => {
    const source = buildBusinessDashboardSource(
      { prefix: 'OY_E2E_BIZ', resultAppName: 'OY_E2E_BIZ_PASSED' },
      {
        appType: 'APP-BIZ',
        formUuid: 'FORM-BIZ',
        reportId: 'REPORT-BIZ',
      },
    );

    expect(source).toContain('全球业务经营驾驶舱');
    expect(source).toContain('BUSINESS DASHBOARD ACCEPTANCE');
    expect(source).toContain('区域营收贡献');
    expect(source).toContain('风险水位与行动闭环');
    expect(source).toContain('saveFormData → 集成自动化 → 待办2.0');
    expect(source).toContain('sl-no-capture');
    expect(source).toContain('APP-BIZ');
    expect(source).toContain('FORM-BIZ');
    expect(source).toContain('REPORT-BIZ');
    expect(source).not.toContain('OpenYida Dashboard Skill E2E');
    expect(source).not.toContain('onMouseEnter');
    expect(source).not.toContain('onMouseLeave');
  });

  test('default full stages include skill coverage gate', () => {
    const config = getFullConfig({ OPENYIDA_E2E: '1' });
    expect(config.stages).toContain('skill-coverage');
  });
});
