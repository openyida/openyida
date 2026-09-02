'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  REPORT_E2E_CASES,
  probeReportE2EPackages,
  run,
} = require('../scripts/e2e-real/report/runner');

function component(componentName, cid, fieldId, dataSetKey, filterKeys = []) {
  return { componentName, cid, fieldId, dataSetKeys: [dataSetKey], filterKeys, cubeCodes: ['FORM_1'] };
}

function createHarness(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-report-e2e-'));
  const runId = 'OY_REPORT_TEST_20260827000000000_a1b2c3';
  const marker = `${runId}__marker`;
  const runtimeExpected = {
    markerPath: ['fixture', 'marker'],
    markerValue: marker,
    aggregate: { sum: 30, count: 2 },
    filter: { before: 'all', after: 'east' },
  };
  const uiExpected = { marker };
  const config = {
    enabled: true,
    runId,
    marker,
    corpId: 'corp-1',
    appType: 'APP_1',
    reportTitle: `${runId}__report`,
    charts: [{ type: 'bar', cubeCode: 'FORM_1' }],
    appendCharts: [{ type: 'line', cubeCode: 'FORM_1' }],
    filters: [{ cubeCode: 'FORM_1', linkTo: [0] }],
    packages: ['platform', 'runtime', 'ui'],
    expected: { runtime: runtimeExpected, ui: uiExpected },
    registryDir: root,
    ...overrides.config,
  };
  const calls = { prepare: 0, create: 0, inspect: 0, append: 0, runtime: 0, ui: 0, cleanup: 0 };
  const afterCreate = {
    reportId: 'REPORT_1',
    reportTitle: config.reportTitle,
    marker,
    appType: config.appType,
    corpId: config.corpId,
    identityCandidates: [{
      reportId: 'REPORT_1',
      reportTitle: config.reportTitle,
      marker,
      appType: config.appType,
      corpId: config.corpId,
    }],
    revision: 10,
    components: [component('YoushuGroupedBarChart', 'cid_bar', 'field_bar', 'chartData', ['filter_1'])],
    layout: [{ i: 'field_bar', x: 0, y: 0, w: 3, h: 22 }],
  };
  const afterAppend = {
    reportId: 'REPORT_1',
    revision: 11,
    components: [
      ...afterCreate.components,
      component('YoushuLineChart', 'cid_line', 'field_line', 'chartData'),
    ],
    layout: [
      ...afterCreate.layout,
      { i: 'field_line', x: 3, y: 0, w: 3, h: 22 },
    ],
  };
  const options = {
    config,
    workDir: path.join(root, runId),
    prepare: async () => {
      calls.prepare += 1;
      return {
        authorized: true,
        ownership: {
          owned: true,
          runId,
          marker,
          corpId: config.corpId,
          appType: config.appType,
          remoteWritesAllowed: true,
        },
        baseline: {
          existingReportIds: ['REPORT_EXISTING'],
          reportIdentities: [{
            reportId: 'REPORT_EXISTING',
            reportTitle: 'existing-report',
            marker: null,
            appType: config.appType,
            corpId: config.corpId,
          }],
          appType: config.appType,
        },
        runtimeFixture: runtimeExpected,
      };
    },
    createReport: async () => {
      calls.create += 1;
      return {
        reportId: 'REPORT_1',
        appType: config.appType,
        corpId: config.corpId,
        marker,
        reportTitle: config.reportTitle,
        url: 'https://example.test/report',
      };
    },
    inspectReport: async () => {
      calls.inspect += 1;
      return calls.inspect === 1 ? afterCreate : afterAppend;
    },
    appendChart: async () => {
      calls.append += 1;
      return { success: true, reportId: 'REPORT_1' };
    },
    queryRuntime: async () => {
      calls.runtime += 1;
      return {
        expected: runtimeExpected,
        observed: {
          rows: [
            { fixture: { marker }, amount: 10 },
            { fixture: { marker }, amount: 20 },
          ],
          aggregate: { sum: 30, count: 2 },
          filter: { before: 'all', after: 'east' },
        },
      };
    },
    verifyUi: async () => {
      calls.ui += 1;
      return {
        expected: uiExpected,
        observed: {
          visible: true,
          markers: [marker],
          blankPage: false,
          permissionDenied: false,
          consoleErrors: [],
          runtimeErrors: [],
          screenshot: { path: '/tmp/report.png', auxiliary: true },
        },
      };
    },
    cleanupReport: async () => {
      calls.cleanup += 1;
      return {
        status: 'passed',
        deleted: true,
        exactIdentity: true,
        observed: { reportAbsent: true },
      };
    },
    ...overrides.options,
  };
  return {
    afterAppend,
    afterCreate,
    calls,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    config,
    marker,
    options,
    runtimeExpected,
  };
}

describe('report domain E2E runner', () => {
  test('declares deterministic platform, runtime, and UI packages without shared full-runner wiring', () => {
    expect(REPORT_E2E_CASES.map(testCase => testCase.id)).toEqual([
      'platform-create-append-inspect',
      'runtime-binding-query',
      'ui-report-render',
    ]);
  });

  test('probe reports exact missing gates per package', () => {
    expect(probeReportE2EPackages({ env: {}, hasPlaywright: false })).toEqual({
      enabled: false,
      packages: {
        platform: { ready: false, missing: ['OPENYIDA_E2E=1', 'OPENYIDA_E2E_REPORT=1'] },
        runtime: { ready: false, missing: ['OPENYIDA_E2E=1', 'OPENYIDA_E2E_REPORT=1', 'OPENYIDA_E2E_REPORT_RUNTIME=1'] },
        ui: { ready: false, missing: ['OPENYIDA_E2E=1', 'OPENYIDA_E2E_REPORT=1', 'OPENYIDA_E2E_REPORT_UI=1', 'playwright'] },
      },
    });
  });

  test.each([
    ['missing runId', { runId: '' }],
    ['unowned preflight', null],
  ])('%s fails closed with zero remote writes', async (_label, configPatch) => {
    const harness = createHarness(configPatch ? { config: configPatch } : {
      options: { prepare: async () => ({ authorized: true, ownership: { owned: false } }) },
    });
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: expect.stringMatching(/^REPORT_E2E_/),
      });
      expect(harness.calls.create).toBe(0);
      expect(harness.calls.append).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test('missing runtime markerPath fails closed before remote writes', async () => {
    const harness = createHarness();
    delete harness.config.expected.runtime.markerPath;
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: 'REPORT_E2E_CONFIG_INVALID',
      });
      expect(harness.calls.create).toBe(0);
      expect(harness.calls.append).toBe(0);
      expect(harness.calls.cleanup).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test('persists redacted manifest and registry with baseline hash before create callback', async () => {
    const harness = createHarness();
    let preWrite;
    harness.options.createReport = async () => {
      harness.calls.create += 1;
      const manifestPath = path.join(harness.options.workDir, 'acceptance-manifest.json');
      const registryPath = path.join(harness.options.workDir, 'registry.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(registryPath)).toBe(true);
      preWrite = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(preWrite).toMatchObject({
        runId: harness.config.runId,
        status: 'running',
        writeState: 'pre_write',
        ownership: { status: 'passed' },
        remoteWrites: { attempted: 1, succeeded: 0 },
        baseline: {
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          existingReportIds: ['REPORT_EXISTING'],
          reportIdentities: [expect.objectContaining({
            reportId: 'REPORT_EXISTING',
            reportTitle: 'existing-report',
          })],
        },
      });
      expect(JSON.stringify(preWrite)).not.toContain('access_token');
      return {
        reportId: 'REPORT_1',
        appType: harness.config.appType,
        corpId: harness.config.corpId,
        marker: harness.marker,
        reportTitle: harness.config.reportTitle,
        url: 'https://example.test/report',
      };
    };
    try {
      await expect(run(harness.options)).resolves.toMatchObject({ status: 'passed' });
      expect(preWrite).toBeDefined();
    } finally {
      harness.cleanup();
    }
  });

  test('persists create response as unowned candidate before platform identity readback', async () => {
    const harness = createHarness();
    let candidateCheckpoint;
    harness.options.inspectReport = async () => {
      harness.calls.inspect += 1;
      if (harness.calls.inspect === 1) {
        candidateCheckpoint = JSON.parse(fs.readFileSync(
          path.join(harness.options.workDir, 'acceptance-manifest.json'),
          'utf8'
        ));
        return harness.afterCreate;
      }
      return harness.afterAppend;
    };
    try {
      await expect(run(harness.options)).resolves.toMatchObject({ status: 'passed' });
      expect(candidateCheckpoint).toMatchObject({
        writeState: 'candidate_readback_pending',
        candidate: {
          reportId: 'REPORT_1',
          owned: false,
          verificationStatus: 'candidate',
        },
        exactIdentity: null,
        resources: [],
      });
    } finally {
      harness.cleanup();
    }
  });

  test('requires strong platform/runtime/UI evidence and owned cleanup before passed', async () => {
    const harness = createHarness();
    try {
      const result = await run(harness.options);
      expect(result).toMatchObject({
        status: 'passed',
        cases: [
          { id: 'platform-create-append-inspect', status: 'passed' },
          { id: 'runtime-binding-query', status: 'passed' },
          { id: 'ui-report-render', status: 'passed' },
        ],
        cleanup: { status: 'passed', exactIdentity: true },
        residual: [],
      });
      expect(harness.calls).toMatchObject({ prepare: 1, create: 1, inspect: 2, append: 1, runtime: 1, ui: 1, cleanup: 1 });
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(manifest.platform).toMatchObject({
        create: { componentCount: 1, layoutNonOverlapping: true },
        append: { componentCount: 2, originalComponentsPreserved: true, layoutNonOverlapping: true },
      });
    } finally {
      harness.cleanup();
    }
  });

  test('keeps corpId in memory for ownership and cleanup but removes it from all serialized evidence', async () => {
    const corpId = 'corp-secret-UNIQUE-20260828';
    const corpIdFingerprint = crypto.createHash('sha256').update(corpId).digest('hex');
    const harness = createHarness({ config: { corpId } });
    let cleanupInput;
    harness.options.prepare = async () => ({
      authorized: true,
      ownership: {
        owned: true,
        runId: harness.config.runId,
        marker: harness.marker,
        corpId,
        appType: harness.config.appType,
        remoteWritesAllowed: true,
      },
      baseline: {
        existingReportIds: ['REPORT_EXISTING'],
        reportIdentities: [{
          reportId: 'REPORT_EXISTING',
          reportTitle: `existing-${corpId}`,
          marker: null,
          appType: harness.config.appType,
          corpId,
        }],
      },
      runtimeFixture: harness.runtimeExpected,
    });
    harness.options.createReport = async () => ({
      reportId: 'REPORT_1',
      appType: harness.config.appType,
      corpId,
      marker: harness.marker,
      reportTitle: harness.config.reportTitle,
      url: `https://example.test/${corpId}/report`,
    });
    harness.options.cleanupReport = async (input) => {
      cleanupInput = input;
      throw Object.assign(new Error(`cleanup failed for ${corpId}`), {
        code: 'CLEANUP_FAILED',
      });
    };
    try {
      const result = await run(harness.options);
      const registry = JSON.parse(fs.readFileSync(result.registryPath, 'utf8'));
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
      expect(cleanupInput).toMatchObject({
        corpId,
        exactIdentity: { corpId },
      });
      expect(registry.exactIdentity).toMatchObject({
        corpIdMatched: true,
        corpIdFingerprint,
      });
      expect(registry.baseline.reportIdentities[0]).toMatchObject({
        corpIdMatched: true,
        corpIdFingerprint,
      });
      expect(registry.resources[0].exactIdentity).toMatchObject({
        corpIdMatched: true,
        corpIdFingerprint,
      });
      expect(manifest.exactIdentity).toMatchObject({
        corpIdMatched: true,
        corpIdFingerprint,
      });
      expect(registry.candidate.url).toContain(corpIdFingerprint);
      expect(registry.cleanup.error.message).toContain(corpIdFingerprint);
      expect(result).toMatchObject({
        status: 'cleanup_blocked',
        residual: [expect.objectContaining({ owned: true, cleanupAttempted: true })],
      });
      expect(JSON.stringify(registry)).not.toContain(corpId);
      expect(JSON.stringify(manifest)).not.toContain(corpId);
      expect(JSON.stringify(result)).not.toContain(corpId);
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['inspect reportId differs from create candidate', (harness, after) => { after.reportId = 'REPORT_OTHER'; }],
    ['inspect title differs from the run-owned title', (harness, after) => { after.reportTitle = `${harness.config.reportTitle}_other`; }],
    ['inspect marker differs from the exact run marker', (harness, after) => { after.marker = `${harness.marker}_other`; }],
    ['candidate reportId already exists in baseline', (harness) => {
      harness.options.prepare = async () => ({
        authorized: true,
        ownership: {
          owned: true,
          runId: harness.config.runId,
          marker: harness.marker,
          corpId: harness.config.corpId,
          appType: harness.config.appType,
          remoteWritesAllowed: true,
        },
        baseline: {
          existingReportIds: ['REPORT_1'],
          reportIdentities: [{ reportId: 'REPORT_1', reportTitle: 'existing-report' }],
          appType: harness.config.appType,
        },
        runtimeFixture: harness.runtimeExpected,
      });
    }],
    ['platform list returns multiple matching candidates', (harness, after) => {
      after.identityCandidates.push({
        reportId: 'REPORT_2',
        reportTitle: harness.config.reportTitle,
        marker: harness.marker,
        appType: harness.config.appType,
        corpId: harness.config.corpId,
      });
    }],
  ])('does not cleanup an unverified create candidate: %s', async (_label, mutate) => {
    const harness = createHarness();
    const after = structuredClone(harness.afterCreate);
    mutate(harness, after);
    harness.options.inspectReport = async () => {
      harness.calls.inspect += 1;
      return after;
    };
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: 'REPORT_E2E_CREATED_IDENTITY_UNVERIFIED',
        reportResult: {
          status: 'cleanup_blocked',
          cleanup: { status: 'cleanup_blocked' },
          residual: [expect.objectContaining({
            reportId: 'REPORT_1',
            runId: harness.config.runId,
            owned: false,
            cleanupAttempted: false,
          })],
        },
      });
      expect(harness.calls.cleanup).toBe(0);
      expect(harness.calls.append).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test('ignores non-chart Youshu filter components while verifying chart counts', async () => {
    const harness = createHarness();
    harness.config.filters = [{ cubeCode: 'FORM_1' }];
    harness.afterCreate.components[0].dataSetKeys.unshift('aaaExtra');
    harness.afterAppend.components[0].dataSetKeys.unshift('aaaExtra');
    harness.afterAppend.components[1].dataSetKeys.unshift('aaaExtra');
    const filterComponent = component('YoushuSelectFilter', 'cid_filter', 'field_filter', 'filterData');
    harness.afterCreate.components.push(filterComponent);
    harness.afterAppend.components.splice(1, 0, filterComponent);
    try {
      await expect(run(harness.options)).resolves.toMatchObject({
        status: 'passed',
        platform: {
          create: { componentCount: 1 },
          append: { componentCount: 2 },
        },
      });
    } finally {
      harness.cleanup();
    }
  });

  test('persists owned cleanup pre-write disposition before delete callback', async () => {
    const harness = createHarness();
    let cleanupCheckpoint;
    harness.options.cleanupReport = async () => {
      cleanupCheckpoint = JSON.parse(fs.readFileSync(
        path.join(harness.options.workDir, 'acceptance-manifest.json'),
        'utf8'
      ));
      return { status: 'passed', deleted: true, exactIdentity: true, observed: { reportAbsent: true } };
    };
    try {
      await expect(run(harness.options)).resolves.toMatchObject({ status: 'passed' });
      expect(cleanupCheckpoint).toMatchObject({
        cleanup: { status: 'pre_write', exactIdentity: true },
        remoteWrites: { attempted: 3, succeeded: 2 },
      });
    } finally {
      harness.cleanup();
    }
  });

  test('append failure still records exact residual when owned cleanup is blocked', async () => {
    const harness = createHarness({
      options: {
        appendChart: async () => { throw Object.assign(new Error('append failed'), { code: 'APPEND_FAILED' }); },
        cleanupReport: async () => ({ status: 'cleanup_blocked', deleted: false, exactIdentity: false }),
      },
    });
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: 'APPEND_FAILED',
        reportResult: {
          status: 'cleanup_blocked',
          residual: [expect.objectContaining({ reportId: 'REPORT_1', runId: harness.config.runId, owned: true })],
        },
      });
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['overlapping layout', after => { after.layout[1].x = 0; }],
    ['missing original component', after => { after.components.shift(); after.layout.shift(); }],
    ['missing filter linkage', after => { after.components[0].filterKeys = []; }],
    ['missing cid', after => { after.components[1].cid = null; }],
  ])('rejects weak platform evidence: %s', async (_label, mutate) => {
    const harness = createHarness();
    const after = structuredClone(harness.afterAppend);
    mutate(after);
    harness.options.inspectReport = async () => {
      harness.calls.inspect += 1;
      return harness.calls.inspect === 1 ? harness.afterCreate : after;
    };
    try {
      await expect(run(harness.options)).rejects.toMatchObject({
        code: expect.stringMatching(/^REPORT_(?:E2E|LAYOUT)_/),
      });
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['empty rows', result => { result.observed.rows = []; }],
    ['marker prefix', (result, harness) => { result.observed.rows = [{ fixture: { marker: `${harness.marker}_suffix` } }]; }],
    ['marker suffix', (result, harness) => { result.observed.rows = [{ fixture: { marker: `prefix_${harness.marker}` } }]; }],
    ['marker only in another field', (result, harness) => { result.observed.rows = [{ fixture: { marker: 'other-run' }, otherField: harness.marker }]; }],
    ['marker path missing', (result, harness) => { result.observed.rows = [{ message: harness.marker }]; }],
    ['wrong aggregate', result => { result.observed.aggregate.sum = 29; }],
    ['unchanged filter', result => { result.observed.filter.after = 'all'; }],
  ])('rejects weak runtime evidence: %s', async (_label, mutate) => {
    const harness = createHarness();
    harness.options.queryRuntime = async () => {
      const result = {
        expected: structuredClone(harness.runtimeExpected),
        observed: {
          rows: [{ fixture: { marker: harness.marker } }],
          aggregate: { sum: 30, count: 2 },
          filter: { before: 'all', after: 'east' },
        },
      };
      mutate(result, harness);
      return result;
    };
    try {
      await expect(run(harness.options)).rejects.toMatchObject({ code: 'REPORT_E2E_RUNTIME_INVALID' });
    } finally {
      harness.cleanup();
    }
  });

  test.each([
    ['console error', observed => { observed.consoleErrors.push('boom'); }],
    ['runtime error', observed => { observed.runtimeErrors.push('boom'); }],
    ['missing marker', observed => { observed.markers = []; }],
    ['blank page', observed => { observed.blankPage = true; }],
    ['permission page', observed => { observed.permissionDenied = true; }],
  ])('rejects weak UI evidence: %s', async (_label, mutate) => {
    const harness = createHarness();
    harness.options.verifyUi = async () => {
      const observed = {
        visible: true,
        markers: [harness.marker],
        blankPage: false,
        permissionDenied: false,
        consoleErrors: [],
        runtimeErrors: [],
      };
      mutate(observed);
      return { expected: { marker: harness.marker }, observed };
    };
    try {
      await expect(run(harness.options)).rejects.toMatchObject({ code: 'REPORT_E2E_UI_INVALID' });
    } finally {
      harness.cleanup();
    }
  });

  test('OPENYIDA_LANG overrides system LANG and system LANG selects its locale', () => {
    const root = path.resolve(__dirname, '..');
    const script = "const { assertReportLayout } = require('./lib/report/layout'); try { assertReportLayout([{i:'x',x:0,y:0,w:7,h:1}]); } catch (e) { process.stdout.write(e.message); }";
    const english = spawnSync(process.execPath, ['-e', script], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, OPENYIDA_LANG: 'en-US', LANG: 'zh_CN.UTF-8', LC_ALL: '' },
    });
    const german = spawnSync(process.execPath, ['-e', script], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, OPENYIDA_LANG: '', LANG: 'de_DE.UTF-8', LC_ALL: '' },
    });
    expect(english.stdout).toContain('positive integer');
    expect(english.stdout).not.toContain('正整数');
    expect(german.stdout).toContain('positive ganze Zahl');

    const inspect = spawnSync(process.execPath, ['bin/yida.js', 'report', 'inspect', '--json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, OPENYIDA_LANG: 'en-US', LANG: 'de_DE.UTF-8', LC_ALL: '' },
    });
    const inspectOutput = JSON.parse((inspect.stdout || inspect.stderr).trim());
    expect(inspect.status).toBe(1);
    expect(inspectOutput.errorMsg).toContain('Usage: openyida report inspect');
  });
});
