'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildDashboardSource,
  buildDashboardSkillSource,
  buildBusinessDashboardSource,
  buildAcceptanceManifest,
  buildAcceptanceReport,
  buildOfficialProcessNodeFixture,
  buildProcessCreateDefinition,
  buildProcessRuleDefinition,
  buildResultApp,
  collectFields,
  getFullConfig,
  parseStages,
  requireVerifiedResourceId,
  run,
} = require('../scripts/e2e-real/full-runner');
const { generateAllScenarios } = require('../scripts/eval/process-contract/scenario-generator');

function buildProcessStageConfig(registryDir) {
  return {
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
    registryDir,
    stages: ['app', 'form', 'process'],
  };
}

function buildProcessStageSchema() {
  return {
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
}

function buildProcessStageHarness(tmpDir, registry, readbackMarker = marker => marker) {
  const calls = [];
  const scenario = generateAllScenarios().find((item) => item.id === 'serial-approval');
  let processMarker = null;
  return {
    calls,
    getProcessMarker: () => processMarker,
    options: {
      env: { OPENYIDA_E2E: '1' },
      config: buildProcessStageConfig(tmpDir),
      createRegistry: () => ({ registry, registryPath: path.join(tmpDir, 'OY_E2E_PROC.json') }),
      writeRegistry: () => {},
      addResource: (currentRegistry, registryPath, resource) => {
        currentRegistry.resources.push(resource);
      },
      writeJson: (filePath) => filePath,
      writeText: (filePath) => filePath,
      processApiAdapter: {
        readback: async () => ({
          rawProcessPayload: {
            success: true,
            content: JSON.stringify({
              ...scenario.fixture.viewJson,
              bindingForm: scenario.fixture.viewJson.bindingForm || 'FORM-PROC',
              formulaRules: scenario.fixture.viewJson.formulaRules || [],
              globalSetting: scenario.fixture.viewJson.globalSetting || {},
            }),
          },
          processId: 'PID-PROC',
          processVersion: 2,
        }),
      },
      runCli: (args) => {
        calls.push(args);
        const command = args[0];
        const sub = args[1];
        const resource = args[2];
        if (command === 'create-app') {return { json: { success: true, appType: 'APP_PROC' } };}
        if (command === 'create-form' && sub === 'create') {return { json: { success: true, formUuid: 'FORM-PROC' } };}
        if (command === 'get-schema') {return { json: buildProcessStageSchema() };}
        if (command === 'create-process') {
          const json = {
            success: true,
            processCode: 'TPROC-PROC',
            processId: 'PID-PROC',
            processVersion: 2,
            formUuid: 'FORM-PROC',
            appType: 'APP_PROC',
            url: 'https://www.aliwork.com/APP_PROC/workbench/FORM-PROC',
            verificationLevel: 'PLATFORM_VIEW_VERIFIED',
            platformViewVerified: true,
          };
          return { stdout: JSON.stringify(json), json };
        }
        if (command === 'data' && sub === 'create' && resource === 'form') {
          const dataIndex = args.indexOf('--data-json');
          const formData = JSON.parse(args[dataIndex + 1]);
          processMarker = formData.textField_1;
          return {
            json: {
              success: true,
              content: { processInstanceId: 'PROC-INST-FULL' },
              processInstanceId: 'PROC-INST-FULL',
              resource: { type: 'processInstance', id: 'PROC-INST-FULL' },
              idVerified: true,
            },
          };
        }
        if (command === 'data' && sub === 'get' && resource === 'process') {
          return {
            json: {
              success: true,
              content: { formData: { textField_1: readbackMarker(processMarker) } },
            },
          };
        }
        if (command === 'create-page') {return { json: { success: true, pageId: 'PAGE-PROC' } };}
        return { json: { success: true, status: 'ok' } };
      },
    },
  };
}

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

  test('requires the stable root-level resource contract instead of guessing nested identifiers', () => {
    expect(requireVerifiedResourceId({
      formInstId: 'FORM-INST-1',
      resource: { type: 'formInstance', id: 'FORM-INST-1' },
      idVerified: true,
    }, 'formInstance', 'formInstId')).toBe('FORM-INST-1');

    expect(() => requireVerifiedResourceId({
      content: { formInstId: 'FORM-INST-NESTED' },
    }, 'formInstance', 'formInstId')).toThrow('verified root-level formInstId');
  });

  test('runs a selected full-stage chain with mocked CLI calls', async () => {
    const calls = [];
    const registry = { resources: [], commands: [] };
    let receiptMarker = null;
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

    await run({
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
        if (command === 'data' && sub === 'create') {
          const dataIndex = args.indexOf('--data-json');
          const formData = JSON.parse(args[dataIndex + 1]);
          receiptMarker = formData.textField_1;
          return {
            json: {
              success: true,
              content: { formInstId: 'INST-FULL' },
              formInstId: 'INST-FULL',
              resource: { type: 'formInstance', id: 'INST-FULL' },
              idVerified: true,
            },
          };
        }
        if (command === 'data' && sub === 'get' && args[2] === 'form') {
          return {
            json: {
              success: true,
              content: { formData: { textField_1: receiptMarker } },
            },
          };
        }
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
    expect(receiptMarker).toBe('OY_E2E_FULL__receipt_data_contract');
    expect(registry.resources).toContainEqual(expect.objectContaining({
      runId: 'OY_E2E_FULL',
      owned: true,
      type: 'form-instance',
      exactId: 'INST-FULL',
      formInstId: 'INST-FULL',
      marker: receiptMarker,
    }));
    expect(registry.dataContracts.receipt).toMatchObject({
      marker: receiptMarker,
      resource: { type: 'formInstance', id: 'INST-FULL' },
      contract: { status: 'passed', idVerified: true },
      readback: { status: 'passed', markerVerified: true },
      residual: null,
    });
    expect(buildAcceptanceManifest(registry, '/tmp/full-registry.json').dataContracts.receipt)
      .toEqual(registry.dataContracts.receipt);
    expect(buildAcceptanceReport(registry, '/tmp/full-registry.json').dataContracts.receipt)
      .toEqual(registry.dataContracts.receipt);
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

  test('keeps an auth/app/form stage selection closed and records exact owned identities', async () => {
    const calls = [];
    const registry = { resources: [], commands: [] };
    const config = {
      enabled: true,
      prefix: 'OY_E2E_MINIMAL',
      appName: 'OY_E2E_MINIMAL_App',
      formName: 'OY_E2E_MINIMAL_Form',
      pageName: 'OY_E2E_MINIMAL_Page',
      updateAppName: 'OY_E2E_MINIMAL_App_Renamed',
      resultAppName: 'OY_E2E_MINIMAL_PASSED',
      importAppName: 'OY_E2E_MINIMAL_Imported',
      fieldsFile: path.join(__dirname, '..', 'scripts', 'e2e-real', 'fixtures', 'form-fields.json'),
      pageSource: path.join(__dirname, '..', 'project', 'pages', 'src', 'demo-compat-smoke.oyd.jsx'),
      registryDir: '/tmp/openyida-e2e-minimal-test',
      stages: ['auth', 'app', 'form'],
    };

    await run({
      env: { OPENYIDA_E2E: '1' },
      config,
      createRegistry: () => ({ registry, registryPath: '/tmp/openyida-e2e-minimal-test/OY_E2E_MINIMAL.json' }),
      writeRegistry: () => {},
      addResource: (currentRegistry, registryPath, resource) => {
        currentRegistry.resources.push(resource);
      },
      writeJson: (filePath) => filePath,
      writeText: (filePath) => filePath,
      runCli: (args) => {
        calls.push(args);
        if (args[0] === 'create-app') {
          return { json: { success: true, appType: 'APP-MINIMAL' } };
        }
        if (args[0] === 'create-form' && args[1] === 'create') {
          return { json: { success: true, formUuid: 'FORM-MINIMAL' } };
        }
        if (args[0] === 'get-schema') {
          return { json: { success: true, content: { pages: [] } } };
        }
        return { json: { success: true, status: 'ok' } };
      },
    });

    expect(calls.some((args) => args[0] === 'create-page')).toBe(false);
    expect(calls).not.toContainEqual([
      'update-app', 'APP-MINIMAL', '--name', 'OY_E2E_MINIMAL_PASSED', '--quiet',
    ]);
    expect(registry.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runId: 'OY_E2E_MINIMAL', owned: true, type: 'app', exactId: 'APP-MINIMAL',
      }),
      expect.objectContaining({
        runId: 'OY_E2E_MINIMAL', owned: true, type: 'form', exactId: 'FORM-MINIMAL',
      }),
    ]));
  });

  test('runs the opt-in process stage with mocked CLI calls', async () => {
    const registry = { resources: [], commands: [] };
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-full-process-'));
    const harness = buildProcessStageHarness(tmpDir, registry);
    try {
      await run(harness.options);

      expect(harness.calls.some((args) => args[0] === 'create-process' && args[1] === 'APP_PROC' && args[2] === '--formUuid' && args[3] === 'FORM-PROC')).toBe(true);
      expect(harness.calls.some((args) => args[0] === 'configure-process')).toBe(false);
      expect(harness.calls.some((args) => args[0] === 'data' && args[1] === 'create' && args[2] === 'form')).toBe(true);
      expect(harness.calls).toContainEqual([
        'data', 'get', 'process', 'APP_PROC', '--process-inst-id', 'PROC-INST-FULL', '--quiet',
      ]);
      expect(harness.getProcessMarker()).toBe('OY_E2E_PROC__process_data_contract');
      expect(registry.resources).toContainEqual(expect.objectContaining({
        owned: true,
        type: 'process',
        exactId: 'TPROC-PROC',
        appType: 'APP_PROC',
        formUuid: 'FORM-PROC',
        processCode: 'TPROC-PROC',
      }));
      expect(registry.resources).toContainEqual(expect.objectContaining({
        runId: 'OY_E2E_PROC',
        owned: true,
        type: 'process-instance',
        exactId: 'PROC-INST-FULL',
        processInstanceId: 'PROC-INST-FULL',
        marker: harness.getProcessMarker(),
      }));
      expect(registry.dataContracts.process).toMatchObject({
        marker: harness.getProcessMarker(),
        resource: { type: 'processInstance', id: 'PROC-INST-FULL' },
        contract: { status: 'passed', idVerified: true },
        readback: { status: 'passed', markerVerified: true },
        residual: null,
      });
      expect(registry.context).toMatchObject({
        processCode: 'TPROC-PROC',
        processId: 'PID-PROC',
        processVersion: 2,
      });
      expect(registry.stageResults.process).toMatchObject({
        status: 'cleanup_blocked',
        commands: ['process-mvp-create-publish', 'data-create-process-form', 'data-get-process'],
      });
      expect(buildAcceptanceManifest(registry, path.join(tmpDir, 'OY_E2E_PROC.json')).dataContracts.process)
        .toEqual(registry.dataContracts.process);
      expect(buildAcceptanceReport(registry, path.join(tmpDir, 'OY_E2E_PROC.json')).dataContracts.process)
        .toEqual(registry.dataContracts.process);
      expect(registry.status).toBe('cleanup_blocked');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('fails the process stage when independent process readback marker mismatches', async () => {
    const registry = { resources: [], commands: [] };
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-full-process-mismatch-'));
    const harness = buildProcessStageHarness(tmpDir, registry, marker => `${marker}__mismatch`);

    try {
      await expect(run(harness.options)).rejects.toThrow('process readback marker mismatch');
      expect(registry.dataContracts.process).toMatchObject({
        marker: 'OY_E2E_PROC__process_data_contract',
        contract: { status: 'passed', idVerified: true },
        readback: { status: 'failed', markerVerified: false },
        residual: { code: 'DATA_READBACK_MARKER_MISMATCH' },
      });
      expect(registry.status).toBe('failed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('marks process readback capability BLOCKED when the marker cannot be extracted', async () => {
    const registry = { resources: [], commands: [] };
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-full-process-blocked-'));
    const harness = buildProcessStageHarness(tmpDir, registry, () => undefined);

    try {
      await expect(run(harness.options)).rejects.toThrow('process readback capability BLOCKED');
      expect(registry.dataContracts.process).toMatchObject({
        contract: { status: 'passed', idVerified: true },
        readback: {
          status: 'blocked',
          capability: 'BLOCKED',
          markerVerified: false,
        },
        residual: { code: 'DATA_READBACK_MARKER_CAPABILITY_BLOCKED' },
      });
      expect(registry.status).toBe('failed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
    expect(source).not.toContain('✓');
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
