'use strict';

const path = require('path');

const {
  buildDashboardSource,
  buildDashboardSkillSource,
  buildBusinessDashboardSource,
  buildOfficialProcessNodeFixture,
  buildProcessCreateDefinition,
  buildProcessRuleDefinition,
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

  test('runs the opt-in process stage with mocked CLI calls', () => {
    const calls = [];
    const registry = { resources: [], commands: [] };
    const config = {
      enabled: true,
      prefix: 'OY_E2E_PROC',
      appName: 'OY_E2E_PROC_App',
      formName: 'OY_E2E_PROC_Form',
      pageName: 'OY_E2E_PROC_Page',
      updateAppName: 'OY_E2E_PROC_App_Renamed',
      resultAppName: 'OY_E2E_PROC_PASSED',
      importAppName: 'OY_E2E_PROC_Imported',
      fieldsFile: path.join(__dirname, '..', 'scripts', 'e2e-real', 'fixtures', 'form-fields.json'),
      pageSource: path.join(__dirname, '..', 'project', 'pages', 'src', 'demo-compat-smoke.oyd.jsx'),
      registryDir: '/tmp/openyida-e2e-full-test',
      stages: ['app', 'form', 'process'],
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
                  { componentName: 'TextareaField', props: { fieldId: 'textareaField_1', label: { zh_CN: 'E2E Notes' } } },
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
      createRegistry: () => ({ registry, registryPath: '/tmp/openyida-e2e-full-test/OY_E2E_PROC.json' }),
      writeRegistry: () => {},
      addResource: (currentRegistry, registryPath, resource) => {
        currentRegistry.resources.push(resource);
      },
      writeJson: (filePath, value) => {
        if (filePath.includes('process-create-definition.json')) {
          expect(value.nodes.some((node) => node.type === 'operator')).toBe(true);
          expect(value.nodes.some((node) => node.type === 'parallel')).toBe(true);
        }
        if (filePath.includes('process-rule-definition.json')) {
          expect(value.nodes.some((node) => node.type === 'route')).toBe(true);
        }
        if (filePath.includes('process-official-node-fixture.json')) {
          expect(value.publishable).toBe(false);
          expect(value.nodes.some((node) => node.componentName === 'AINode')).toBe(true);
        }
        return filePath;
      },
      writeText: (filePath) => filePath,
      runCli: (args) => {
        calls.push(args);
        const command = args[0];
        const sub = args[1];
        if (command === 'create-app') {return { json: { success: true, appType: 'APP_PROC' } };}
        if (command === 'create-form' && sub === 'create') {return { json: { success: true, formUuid: 'FORM-PROC' } };}
        if (command === 'get-schema') {return { json: schema };}
        if (command === 'create-process') {return { json: { success: true, processCode: 'TPROC-PROC', formUuid: 'FORM-PROC', appType: 'APP_PROC', url: 'https://www.aliwork.com/APP_PROC/workbench/FORM-PROC' } };}
        if (command === 'configure-process') {return { json: { success: true, processCode: 'TPROC-PROC', processId: 'PID-PROC', processVersion: 2, formUuid: 'FORM-PROC', appType: 'APP_PROC' } };}
        if (command === 'create-page') {return { json: { success: true, pageId: 'PAGE-PROC' } };}
        return { json: { success: true, status: 'ok' } };
      },
    });

    expect(calls.some((args) => args[0] === 'create-process' && args[1] === 'APP_PROC' && args[2] === '--formUuid' && args[3] === 'FORM-PROC')).toBe(true);
    const configureProcessCall = calls.find((args) => args[0] === 'configure-process');
    expect(configureProcessCall).toBeTruthy();
    expect(configureProcessCall).toEqual(expect.arrayContaining(['configure-process', 'APP_PROC', 'FORM-PROC', 'TPROC-PROC', '--quiet']));
    expect(path.basename(configureProcessCall[3])).toBe('process-rule-definition.json');
    expect(registry.resources).toContainEqual(expect.objectContaining({
      type: 'process',
      appType: 'APP_PROC',
      formUuid: 'FORM-PROC',
      processCode: 'TPROC-PROC',
    }));
    expect(registry.context).toMatchObject({
      processCode: 'TPROC-PROC',
      processId: 'PID-PROC',
      processVersion: 2,
    });
    expect(registry.stageResults.process).toMatchObject({
      status: 'passed',
      commands: ['create-process', 'configure-process'],
    });
  });

  test('builds process definitions for the opt-in process stage', () => {
    const fields = [
      { label: 'E2E Text', componentName: 'TextField', fieldId: 'textField_1' },
      { label: 'E2E Number', componentName: 'NumberField', fieldId: 'numberField_1' },
      { label: 'E2E Status', componentName: 'SelectField', fieldId: 'selectField_1' },
      { label: 'E2E Notes', componentName: 'TextareaField', fieldId: 'textareaField_1' },
    ];

    const createDefinition = buildProcessCreateDefinition(fields);
    const ruleDefinition = buildProcessRuleDefinition(fields);
    const fixture = buildOfficialProcessNodeFixture({ formUuid: 'FORM-PROC' });

    expect(createDefinition.nodes.map((node) => node.type)).toEqual(['operator', 'parallel', 'carbon']);
    expect(ruleDefinition.nodes[1].type).toBe('route');
    expect(ruleDefinition.nodes[1].conditions[0].rules[0]).toMatchObject({
      fieldId: 'numberField_1',
      componentType: 'NumberField',
      op: 'GreaterThan',
    });
    expect(fixture.publishable).toBe(false);
    expect(fixture.nodes.some((node) => node.type === 'connector')).toBe(true);
    expect(fixture.nodes.some((node) => node.componentName === 'CycleContainer')).toBe(true);
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
