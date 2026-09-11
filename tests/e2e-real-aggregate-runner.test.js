'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertRevisionStage,
  buildCommandPlan,
  resolveConfig,
  run,
} = require('../scripts/e2e-real/aggregate/runner');

function buildEnv(overrides = {}) {
  return {
    OPENYIDA_E2E: '1',
    OPENYIDA_AGGREGATE_E2E: '1',
    OPENYIDA_AGGREGATE_E2E_RUN_ID: 'OY_AGG_RUN_001',
    OPENYIDA_AGGREGATE_E2E_OWNED_MARKER: 'OY_AGG_RUN_001__aggregate',
    OPENYIDA_AGGREGATE_E2E_CORP_ID: 'corp-1',
    OPENYIDA_AGGREGATE_E2E_APP_TYPE: 'APP-1',
    OPENYIDA_AGGREGATE_E2E_FORM_UUID: 'FORM-VIEW',
    OPENYIDA_AGGREGATE_E2E_DESIGN_FIXTURE: '/external/aggregate-design.json',
    OPENYIDA_AGGREGATE_STATUS_POLL_MS: '0',
    ...overrides,
  };
}

describe('aggregate domain real E2E runner', () => {
  let artifactRoot;

  beforeEach(() => {
    artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aggregate-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(artifactRoot, { recursive: true, force: true });
  });

  test('fails closed with zero writes until ownership and exact platform context are explicit', () => {
    const resolved = resolveConfig({
      OPENYIDA_E2E: '1',
      OPENYIDA_AGGREGATE_E2E: '1',
    });

    expect(resolved.missing).toEqual(expect.arrayContaining([
      'OPENYIDA_AGGREGATE_E2E_RUN_ID',
      'OPENYIDA_AGGREGATE_E2E_OWNED_MARKER',
      'OPENYIDA_AGGREGATE_E2E_CORP_ID',
      'OPENYIDA_AGGREGATE_E2E_APP_TYPE',
      'OPENYIDA_AGGREGATE_E2E_FORM_UUID',
      'OPENYIDA_AGGREGATE_E2E_DESIGN_FIXTURE',
    ]));
  });

  test('missing runId and owned marker returns zero writes without invoking the CLI', async () => {
    const runCli = jest.fn();
    const result = await run({
      env: buildEnv({
        OPENYIDA_AGGREGATE_E2E_RUN_ID: '',
        OPENYIDA_AGGREGATE_E2E_OWNED_MARKER: '',
      }),
      runCli,
    });

    expect(result).toMatchObject({ status: 'PLATFORM_PROBE_REQUIRED', remoteWrites: 0 });
    expect(runCli).not.toHaveBeenCalled();
  });

  test('plans inspect, preview, save, publish, and build without shared full-runner wiring', () => {
    const { config } = resolveConfig(buildEnv());
    const plan = buildCommandPlan(config);

    expect(plan.map((step) => step.stage)).toEqual([
      'auth', 'list', 'inspect', 'preview', 'save', 'publish', 'build',
    ]);
    expect(plan.find((step) => step.stage === 'inspect').args).toContain('APP-1');
    expect(plan.filter((step) => step.mutates).map((step) => step.stage)).toEqual(['save', 'publish']);
  });

  test('requires action-specific revision proof from write output', () => {
    expect(() => assertRevisionStage('save', {
      readbackVerified: true,
      revisionAxis: 'stashGmtModified',
      revisionSource: 'readback',
      revision: 12,
      readbackRevision: 12,
    }, 'stashGmtModified')).not.toThrow();

    expect(() => assertRevisionStage('save', {
      readbackVerified: true,
      revisionAxis: 'gmtModified',
      revisionSource: 'readback',
      revision: 12,
      readbackRevision: 12,
    }, 'stashGmtModified')).toThrow(/stashGmtModified/);
  });

  function createCliHarness(options = {}) {
    let statusCalls = 0;
    let inspectCalls = 0;
    let saveCalls = 0;
    let publishCalls = 0;
    const beforeConfig = {
      title: { zh_CN: 'OY_AGG_RUN_001__aggregate' },
      relationForms: [{ formUuid: 'SOURCE-1' }],
      relationships: [{
        relationId: 'REL-1',
        relationshipInfos: [{ id: 'field_name', name: '名称' }],
      }],
      aggregatedFields: [{ id: 'REL-1', name: '名称' }],
      auxFields: [],
      formulaFields: [{ id: 'metric_count', name: '数量', formula: 'COUNT(field_name)' }],
      validators: [],
      gmtModified: 10,
      stashGmtModified: 20,
      ...(options.beforeConfigOverride || {}),
    };
    const savedConfig = { ...beforeConfig, gmtModified: 10, stashGmtModified: 21 };
    const publishedConfig = { ...beforeConfig, gmtModified: 11, stashGmtModified: 21 };
    const changedConfig = {
      ...publishedConfig,
      formulaFields: [{ id: 'metric_count', name: '数量', formula: 'SUM(field_name)' }],
    };
    const calls = [];
    const runCli = (args) => {
      calls.push(args);
      if (args[0] === 'aggregate-table' && args[1] === 'list') {
        return { status: 0, json: [{
          aggregateTableId: 'FORM-VIEW',
          formUuid: 'FORM-VIEW',
          name: options.listName || 'OY_AGG_RUN_001__aggregate',
        }] };
      }
      if (args[0] === 'aggregate-table' && args[1] === 'inspect') {
        inspectCalls += 1;
        if (options.restorePreflightFails && inspectCalls === 3) {
          return { status: 1, stderr: 'unproven' };
        }
        let config = inspectCalls === 1
          ? beforeConfig
          : inspectCalls === 2
            ? savedConfig
            : publishedConfig;
        if (options.saveFailureInspect && inspectCalls === 2) {
          config = options.saveFailureInspect === 'changed'
            ? { ...changedConfig, gmtModified: 10, stashGmtModified: 21 }
            : options.saveFailureInspect;
        }
        if (options.publishFailureInspect && inspectCalls === 3) {
          config = options.publishFailureInspect === 'changed'
            ? changedConfig
            : options.publishFailureInspect;
        }
        if (options.concurrentRevision && inspectCalls === 3) {
          config = { ...publishedConfig, gmtModified: options.concurrentRevision };
        }
        if (inspectCalls >= 4) { config = beforeConfig; }
        return { status: 0, json: {
          aggregateTableId: 'FORM-VIEW',
          formUuid: 'FORM-VIEW',
          summary: {
            title: options.inspectName || 'OY_AGG_RUN_001__aggregate',
            counts: { relationForms: 1, relationships: 0, aggregatedFields: 0, auxFields: 0, formulaFields: 0, validators: 0 },
          },
          config,
        } };
      }
      if (args[0] === 'aggregate-table' && args[1] === 'save') {
        saveCalls += 1;
        if (options.onSave) { options.onSave(); }
        if (options.saveFailure === 'precondition') {
          return { status: 1, stderr: JSON.stringify({ errorCode: 'AGGREGATE_WRITE_PRECONDITION_FAILED' }) };
        }
        if (options.saveFailure === 'unknown') {
          return { status: 1, stderr: 'socket closed after request' };
        }
        return { status: 0, json: {
          readbackVerified: true,
          revisionAxis: 'stashGmtModified',
          revisionSource: 'readback',
          revision: 21,
          responseRevision: null,
          readbackRevision: 21,
        } };
      }
      if (args[0] === 'aggregate-table' && args[1] === 'publish') {
        publishCalls += 1;
        if (options.publishFailure === 'precondition') {
          return { status: 1, stderr: JSON.stringify({ errorCode: 'AGGREGATE_WRITE_PRECONDITION_FAILED' }) };
        }
        if (options.publishFailure === 'unknown') {
          return { status: 1, stdout: 'not-json' };
        }
        return { status: 0, json: publishCalls === 1 ? {
          readbackVerified: true,
          revisionAxis: 'gmtModified',
          revisionSource: 'readback',
          revision: 11,
          responseRevision: null,
          readbackRevision: 11,
        } : {
          readbackVerified: true,
          revisionAxis: 'gmtModified',
          revisionSource: 'readback',
          revision: 12,
          responseRevision: null,
          readbackRevision: 12,
        } };
      }
      if (args[0] === 'aggregate-table' && args[1] === 'status') {
        statusCalls += 1;
        return { status: 0, json: { status: statusCalls === 1 ? 'RUNNING' : 'SUCCESS' } };
      }
      return { status: 0, json: { success: true } };
    };
    return {
      beforeConfig,
      calls,
      getPublishCalls: () => publishCalls,
      getSaveCalls: () => saveCalls,
      getStatusCalls: () => statusCalls,
      runCli,
    };
  }

  test('requires runId ownership evidence and performs zero writes on exact-name mismatch', async () => {
    const harness = createCliHarness({ listName: 'someone-elses-aggregate' });
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      runCli: harness.runCli,
    });

    expect(result).toMatchObject({ status: 'PLATFORM_PROBE_REQUIRED', remoteWrites: 0 });
    expect(harness.calls.some((args) => ['save', 'publish'].includes(args[1]))).toBe(false);
  });

  test('performs zero writes when the baseline revision cannot support conditional restore', async () => {
    const harness = createCliHarness({ beforeConfigOverride: { gmtModified: null } });
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      runCli: harness.runCli,
    });

    expect(result).toMatchObject({
      status: 'PLATFORM_PROBE_REQUIRED',
      reason: 'baseline_revision_unproven',
      remoteWrites: 0,
    });
    expect(harness.calls.some((args) => ['save', 'publish'].includes(args[1]))).toBe(false);
  });

  test('persists redacted manifest and registry before save and never emits corpId', async () => {
    let filesAtSave = [];
    let manifestAtSave = null;
    const harness = createCliHarness({
      onSave: () => {
        const workDir = path.join(artifactRoot, 'OY_AGG_RUN_001');
        filesAtSave = fs.readdirSync(workDir);
        manifestAtSave = JSON.parse(fs.readFileSync(path.join(workDir, 'acceptance-manifest.json'), 'utf8'));
      },
    });
    let statusCalls = 0;
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      delay: async () => {},
      runCli: (args) => {
        const result = harness.runCli(args);
        if (args[1] === 'status') { statusCalls += 1; }
        return result;
      },
    });

    expect(filesAtSave).toEqual(expect.arrayContaining([
      'acceptance-manifest.json',
      'registry.json',
      'before-design.json',
    ]));
    expect(manifestAtSave).toMatchObject({
      status: 'save_attempted',
      executedWrites: [{ stage: 'save', status: 'attempted' }],
    });
    const artifactJson = filesAtSave.map((file) => fs.readFileSync(path.join(artifactRoot, 'OY_AGG_RUN_001', file), 'utf8')).join('\n');
    const manifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'OY_AGG_RUN_001', 'acceptance-manifest.json'), 'utf8'));
    const registry = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'OY_AGG_RUN_001', 'registry.json'), 'utf8'));
    const before = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'OY_AGG_RUN_001', 'before-design.json'), 'utf8'));
    expect(artifactJson).not.toContain('corp-1');
    expect(artifactJson).not.toContain('FORM-VIEW');
    expect(JSON.stringify(result)).not.toContain('corp-1');
    expect(manifest).toMatchObject({
      runId: 'OY_AGG_RUN_001',
      plannedWrites: ['save', 'publish', 'conditional_restore'],
      baseline: { canonicalHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      ownershipEvidence: { verified: true, runIdBoundMarker: true },
      resourceCounts: { relationForms: 1 },
    });
    expect(registry.resources[0]).toMatchObject({ runId: 'OY_AGG_RUN_001', owned: true, createdByRun: false });
    expect(before.designInfo).toEqual(harness.beforeConfig && expect.objectContaining({ relationForms: harness.beforeConfig.relationForms }));
    expect(result).toMatchObject({
      status: 'PLATFORM_PROBE_REQUIRED',
      remoteWrites: 3,
      runtime: { status: 'PLATFORM_PROBE_REQUIRED' },
      restore: { status: 'restored', remoteWrites: 1 },
    });
    expect(statusCalls).toBe(2);
  });

  test('blocks restore with zero restore writes when the live revision changed concurrently', async () => {
    const harness = createCliHarness({ concurrentRevision: 99 });
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      delay: async () => {},
      runCli: harness.runCli,
    });

    expect(result).toMatchObject({
      status: 'restore_blocked',
      remoteWrites: 2,
      restore: { status: 'restore_blocked', reason: 'concurrent_revision_change', remoteWrites: 0 },
    });
    expect(harness.getPublishCalls()).toBe(1);
  });

  test('returns structured restore_blocked with zero restore writes when preflight is unproven', async () => {
    const harness = createCliHarness({ restorePreflightFails: true });
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      delay: async () => {},
      runCli: harness.runCli,
    });

    expect(result).toMatchObject({
      status: 'restore_blocked',
      remoteWrites: 2,
      restore: { status: 'restore_blocked', reason: 'restore_preflight_unproven', remoteWrites: 0 },
    });
    expect(harness.getPublishCalls()).toBe(1);
  });

  test('successful conditional restore exactly matches the before canonical fingerprint', async () => {
    const harness = createCliHarness();
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      delay: async () => {},
      runCli: harness.runCli,
    });

    expect(result.restore).toMatchObject({
      status: 'restored',
      remoteWrites: 1,
      beforeFingerprint: result.restore.restoredFingerprint,
    });
    const saveCall = harness.calls.find((args) => args[1] === 'save');
    const initialPublishCall = harness.calls.find((args) => args[1] === 'publish' && args.includes('/external/aggregate-design.json'));
    expect(saveCall).toEqual(expect.arrayContaining(['--expected-revision', '20']));
    expect(initialPublishCall).toEqual(expect.arrayContaining(['--expected-revision', '10']));
    expect(harness.calls.filter((args) => args[1] === 'publish' && args.includes('--expected-revision'))[1])
      .toEqual(expect.arrayContaining(['--expected-revision', '11']));
  });

  test('stash concurrency after ownership is rejected before the initial save POST', async () => {
    const harness = createCliHarness({
      saveFailure: 'precondition',
      saveFailureInspect: { ...createCliHarness().beforeConfig, stashGmtModified: 99 },
    });
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      runCli: harness.runCli,
    });

    const saveCall = harness.calls.find((args) => args[1] === 'save');
    expect(saveCall).toEqual(expect.arrayContaining(['--expected-revision', '20']));
    expect(harness.getSaveCalls()).toBe(1);
    expect(harness.getPublishCalls()).toBe(0);
    expect(result).toMatchObject({
      remoteWrites: 0,
      operation: { failedStage: 'save', outcome: 'not_written_precondition_failed' },
    });
  });

  test('live concurrency after save is rejected before the initial publish POST', async () => {
    const harness = createCliHarness({
      publishFailure: 'precondition',
      publishFailureInspect: {
        ...createCliHarness().beforeConfig,
        gmtModified: 99,
        stashGmtModified: 21,
        formulaFields: [{ id: 'metric_count', name: '数量', formula: 'SUM(field_name)' }],
      },
    });
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      runCli: harness.runCli,
    });

    const publishCall = harness.calls.find((args) => args[1] === 'publish');
    expect(publishCall).toEqual(expect.arrayContaining(['--expected-revision', '10']));
    expect(harness.getSaveCalls()).toBe(1);
    expect(harness.getPublishCalls()).toBe(1);
    expect(result).toMatchObject({
      remoteWrites: 1,
      operation: { failedStage: 'publish', outcome: 'not_written_precondition_failed' },
      restore: { status: 'restore_blocked', remoteWrites: 0 },
    });
  });

  test.each([
    ['save', { saveFailure: 'unknown', saveFailureInspect: 'changed' }],
    ['publish', { publishFailure: 'unknown', publishFailureInspect: 'changed' }],
  ])('%s unknown outcome persists owned residual evidence without blind retry', async (stage, failureOptions) => {
    const harness = createCliHarness(failureOptions);
    const result = await run({
      env: buildEnv({ OPENYIDA_AGGREGATE_E2E_REGISTRY_DIR: artifactRoot }),
      readDesignFixture: () => ({}),
      runCli: harness.runCli,
    });
    const workDir = path.join(artifactRoot, 'OY_AGG_RUN_001');
    const manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'acceptance-manifest.json'), 'utf8'));
    const registry = JSON.parse(fs.readFileSync(path.join(workDir, 'registry.json'), 'utf8'));

    expect(result).toMatchObject({
      status: 'restore_blocked',
      remoteWrites: 'unknown',
      operation: { failedStage: stage, outcome: 'outcome_unknown' },
      restore: { status: 'restore_blocked', remoteWrites: 0 },
      residual: { status: 'owned_residual', owned: true },
    });
    expect(manifest).toMatchObject({
      status: 'restore_blocked',
      remoteWrites: 'unknown',
      executedWrites: expect.arrayContaining([
        { stage, status: 'outcome_unknown', errorCode: expect.stringMatching(/^AGGREGATE_E2E_/) },
      ]),
      residual: { status: 'owned_residual', owned: true },
    });
    expect(registry).toMatchObject({
      status: 'restore_blocked',
      remoteWrites: 'unknown',
      residual: { status: 'owned_residual', owned: true },
    });
    expect(harness.getSaveCalls()).toBe(1);
    expect(harness.getPublishCalls()).toBe(stage === 'publish' ? 1 : 0);
  });
});
