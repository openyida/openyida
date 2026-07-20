'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  SOURCE_BIN,
  SOURCE_SKILL_ROOT,
  assertNoSensitiveStdio,
  buildEnv,
  createLauncher,
  ensureWorkspace,
  crmManifest,
  isUnsupportedPayload,
  readSourceSkillEvidence,
  scenarioDefinitions,
} = require('../scripts/e2e-real/schema-source-runner');
const { version } = require('../package.json');
const SOURCE_RUNNER = path.join(__dirname, '..', 'scripts', 'e2e-real', 'schema-source-runner.js');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-source-runner-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('schema source e2e runner', () => {
  test('reads skills from the checkout yida-skills tree', () => {
    const evidence = readSourceSkillEvidence();

    expect(fs.realpathSync(path.join(__dirname, '..', evidence.root))).toBe(fs.realpathSync(SOURCE_SKILL_ROOT));
    expect(evidence.files.map((entry) => entry.file)).toEqual([
      'yida-skills/SKILL.md',
      'yida-skills/skills/yida-app/SKILL.md',
      'yida-skills/skills/yida-create-form-page/SKILL.md',
      'yida-skills/skills/yida-create-process/SKILL.md',
      'yida-skills/skills/yida-create-page/SKILL.md',
      'yida-skills/skills/yida-publish-page/SKILL.md',
      'yida-skills/skills/yida-report/SKILL.md',
      'yida-skills/skills/yida-integration/SKILL.md',
      'yida-skills/skills/yida-page-config/SKILL.md',
      'yida-skills/references/schema-as-code-phase1.md',
    ]);
    expect(evidence.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
  });

  test('creates a temp launcher that executes the checkout bin/yida.js', () => {
    const launcher = createLauncher(tempDir);
    const command = launcher.commandPath || launcher.launcherPath;
    const result = spawnSync(command, ['--version'], {
      cwd: tempDir,
      encoding: 'utf8',
      shell: process.platform === 'win32' && /\.cmd$/i.test(command),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(version);
    const trace = fs.readFileSync(launcher.tracePath, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(fs.realpathSync(trace[0].sourceBin)).toBe(fs.realpathSync(SOURCE_BIN));
    expect(trace[0].argv).toEqual(['--version']);
  });

  test('injects schema source auth through OPENYIDA_COOKIE_B64 instead of cookies.json', () => {
    ensureWorkspace(tempDir);
    const launcher = createLauncher(tempDir);
    const env = buildEnv(tempDir, launcher);

    expect(env).toMatchObject({
      YIDA_AUTH_ENABLED: 'true',
      OPENYIDA_BASE_URL: 'https://source-e2e.example.test',
    });
    expect(Buffer.from(env.OPENYIDA_COOKIE_B64, 'base64').toString('utf8')).toContain('tianshu_csrf_token=csrf-source-e2e');
    expect(fs.existsSync(path.join(tempDir, '.cache', 'cookies.json'))).toBe(false);
  });

  test('crm scenario matrix covers four-resource create, update, noop, and deferred boundaries', () => {
    const scenarios = scenarioDefinitions();
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'crm-build',
      'crm-rename-app',
      'crm-add-customer-level-field',
      'crm-customer-need-required',
      'crm-process',
      'crm-process-update',
      'crm-page',
      'crm-page-source-update',
      'crm-report',
      'crm-automation',
    ]);
    expect(scenarios.find((scenario) => scenario.id === 'crm-process').supported).toBe(true);
    expect(scenarios.find((scenario) => scenario.id === 'crm-page').supported).toBe(true);
    expect(scenarios.find((scenario) => scenario.id === 'crm-page-source-update').expectedPlan).toEqual({
      create: 0,
      update: 1,
      noop: 3,
      conflict: 0,
      unmanaged: 0,
      orphan: 0,
    });
    expect(scenarios.find((scenario) => scenario.id === 'crm-report').section).toBe('reports');
    expect(scenarios.find((scenario) => scenario.id === 'crm-automation').section).toBe('automations');
  });

  test('crm manifest models customer level and required need deltas', () => {
    const base = crmManifest();
    const level = crmManifest({ customerLevelField: true });
    const required = crmManifest({ customerLevelField: true, reasonRequired: true });

    expect(base.forms.customerProfile.fields.customerLevel).toBeUndefined();
    expect(level.forms.customerProfile.fields.customerLevel).toMatchObject({
      type: 'SelectField',
      label: '客户级别',
      options: ['A 类客户', 'B 类客户', 'C 类客户'],
    });
    expect(required.forms.customerProfile.fields.customerNeed.required).toBe(true);
  });

  test('process and page scenarios use stable semantic keys and workspace-relative source', () => {
    const scenarios = scenarioDefinitions();
    const process = scenarios.find((scenario) => scenario.id === 'crm-process').manifest;
    const page = scenarios.find((scenario) => scenario.id === 'crm-page').manifest;

    expect(process.forms.customerProfile.mode).toBe('process');
    expect(process.processes.customerApproval.nodes.map((node) => node.key)).toEqual([
      'salesReview',
      'managerApproval',
    ]);
    expect(page.pages.crmHome).toEqual({
      title: 'CRM 工作台',
      source: 'pages/crm-home.oyd.jsx',
    });
    expect(path.isAbsolute(page.pages.crmHome.source)).toBe(false);
  });

  test('recognizes unsupported compact payloads and rejects sensitive stdout', () => {
    expect(isUnsupportedPayload({
      success: false,
      error: {
        code: 'SCHEMA_RESOURCE_TYPE_UNSUPPORTED',
        path: '/reports',
      },
    }, 'reports')).toBe(true);
    expect(isUnsupportedPayload({
      success: false,
      error: {
        code: 'SCHEMA_UNKNOWN_PROPERTY',
        path: '/reports',
      },
    }, 'reports')).toBe(false);

    expect(() => assertNoSensitiveStdio('{"ok":true}', 'stdout')).not.toThrow();
    expect(() => assertNoSensitiveStdio('csrf-source-e2e', 'stdout')).toThrow(/leaked sensitive/);
    expect(() => assertNoSensitiveStdio('textField_secret123', 'stdout')).toThrow(/leaked sensitive/);
  });

  test('subprocess runner proves exact generic lifecycle, unsupported boundaries, and zero network attempts', () => {
    const resultDir = path.join(tempDir, 'results');
    const result = spawnSync(process.execPath, [SOURCE_RUNNER], {
      cwd: tempDir,
      env: {
        ...process.env,
        OPENYIDA_SCHEMA_SOURCE_E2E_RESULT_DIR: resultDir,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const protocol = JSON.parse(result.stdout.trim());
    expect(protocol.ok).toBe(true);
    const summary = JSON.parse(fs.readFileSync(path.join(resultDir, 'latest.json'), 'utf8'));
    expect(summary.status).toBe('passed');
    expect(summary.scenarios).toHaveLength(11);
    expect(summary.scenarios.filter(scenario => scenario.status === 'applied')).toHaveLength(8);
    expect(summary.scenarios.filter(scenario => scenario.status === 'unsupported')).toEqual([
      expect.objectContaining({ id: 'crm-report', phase: 'validate', errorPath: '/reports', sideEffectsUnchanged: true }),
      expect.objectContaining({ id: 'crm-automation', phase: 'validate', errorPath: '/automations', sideEffectsUnchanged: true }),
    ]);
    expect(summary.scenarios.filter(scenario => scenario.status === 'applied').every(
      scenario => (
        scenario.journal &&
        scenario.journal.allCompleted === true &&
        scenario.journal.bindingRelationshipsVerified === true
      )
    )).toBe(true);
    const processScenarios = summary.scenarios.filter(scenario => scenario.processDefinition);
    expect(processScenarios).toHaveLength(4);
    expect(processScenarios.every(scenario => (
      scenario.processDefinition.canonicalProcessHashVerified === true &&
      scenario.processDefinition.managedDefinitionMatchesSource === true &&
      scenario.processDefinition.ownershipMatchesState === true
    ))).toBe(true);
    expect(summary.state).toMatchObject({
      fieldBindingIdentitiesVerified: true,
      identitiesMatchRemote: true,
      processNodeBindingIdentitiesVerified: true,
      processVersion: 2,
      processHistoricalVersions: [0, 1],
      processFormBindingVerified: true,
      finalJournalOperations: 0,
      networkAttempts: 0,
    });
    expect(summary.state.bindingContractNegativeCases).toEqual({
      duplicateFieldId: true,
      duplicateProcessNodeId: true,
      wrongProcessNodeId: true,
    });
    expect(summary.state.exactWriteCalls).toEqual({
      'convert:form': 1,
      'create:app': 1,
      'create:form': 1,
      'create:page': 1,
      'create:process-draft': 2,
      'publish:process': 2,
      'save:page': 2,
      'save:process': 2,
      'update:app': 1,
      'update:form': 3,
    });
    expect(summary.processMockContracts).toMatchObject({
      invalidProcessJson: true,
      networkPrimitivesBlocked: true,
      processJsonWrongBinding: true,
      processJsonWrongCode: true,
      saveWrongVersion: true,
      undiciPurePrimitivesPreserved: true,
      viewJsonWrongBinding: true,
      wrongBase: true,
      wrongIdentity: true,
      wrongStatus: true,
    });
    expect(Object.values(summary.processMockContracts).every(Boolean)).toBe(true);
    expect(summary.cleanup.tempWorkspaceRemoved).toBe(true);
  });
});
