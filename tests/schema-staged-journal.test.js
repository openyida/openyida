'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { applySchema } = require('../lib/schema/applier');
const { schemaError } = require('../lib/schema/errors');
const { createPlan } = require('../lib/schema/planner');
const { ResourceRegistry } = require('../lib/schema/resource-registry');
const {
  createEmptyState,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('../lib/schema/state-store');
const {
  advanceProcessStageCheckpoint,
  advanceProcessStagedCheckpoint,
  isProcessStageCheckpointRemoteComplete,
  validateProcessStageCheckpoint,
} = require('../lib/process/services/process-stage-checkpoint');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-staged-apply-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function environment() {
  return {
    endpoint: 'https://example.test',
    corpId: 'corp-staged-apply',
  };
}

function statePath() {
  return path.join(tempDir, 'state.v1.json');
}

function resource(name = 'Approval flow', key = 'approvalFlow') {
  return {
    resourceType: 'process',
    key,
    adapterVersion: 1,
    desired: { name },
    dependsOn: [],
  };
}

function createStagedHarness(options = {}) {
  const calls = [];
  const stateVisibility = [];
  const remote = {
    bindings: null,
    managed: null,
    stage: null,
  };
  let failAfterStage = options.failAfterStage;
  let failReadOnce = options.failReadOnce === true;
  let failingReadCode = options.failingReadCode;
  let failingReadStages = new Set(options.failingReadStages || []);
  let reconciliation = options.reconciliation || 'unresolved';
  let remoteDispatches = 0;

  const adapter = {
    resourceType: 'process',
    adapterVersion: 1,
    normalize(value) {
      return value;
    },
    validate() {},
    validateStateResource(input) {
      const bindings = input.state.bindings;
      assertAllowedKeys(bindings, ['processCode', 'processId', 'processVersion', 'nodeBindings']);
      if (input.state.lastApplied !== undefined) {
        assertAllowedKeys(input.state.lastApplied, ['name']);
      }
    },
    async create(desired, context) {
      calls.push(context.recovery ? 'create:resume' : 'create:fresh');
      return runStages(desired, context);
    },
    async update(desired, _observed, _stateResource, context) {
      calls.push(context.recovery ? 'update:resume' : 'update:fresh');
      return runStages(desired, context);
    },
    buildBindings(result) {
      return clonePlain(result);
    },
    async readObserved(stateResource) {
      calls.push('read');
      if (failingReadStages.has(remote.stage)) {
        const error = new Error('injected staged intermediate read failure');
        if (failingReadCode) {
          error.code = failingReadCode;
        }
        throw error;
      }
      if (failReadOnce) {
        failReadOnce = false;
        throw new Error('injected staged read failure');
      }
      if (!remote.bindings || remote.bindings.processId !== stateResource.bindings.processId) {
        throw new Error('fake remote resource is unavailable');
      }
      return clonePlain(remote);
    },
    projectObserved(raw, stateResource) {
      return {
        bindings: clonePlain(stateResource.bindings),
        managed: clonePlain(raw.managed),
      };
    },
    async verify(projection, context) {
      calls.push('verify');
      if (options.beforeVerify) {
        options.beforeVerify();
      }
      if (JSON.stringify(projection.managed) !== JSON.stringify(context.resource.desired)) {
        throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Fake staged verification failed.');
      }
    },
    async reconcileStaged(input) {
      calls.push(`reconcile:${input.stageCheckpoint && input.stageCheckpoint.stage || 'none'}`);
      if (
        (reconciliation === 'resume' || reconciliation === 'resumeThenFail') &&
        remote.stage === (input.stageCheckpoint && input.stageCheckpoint.stage)
      ) {
        if (reconciliation === 'resumeThenFail') {
          failAfterStage = 'published';
        }
        return { action: 'resume' };
      }
      if (reconciliation === 'complete' && remote.stage === 'published') {
        return { action: 'complete', result: clonePlain(remote.bindings) };
      }
      return null;
    },
    advanceStagedCheckpoint(previous, event, input) {
      return advanceProcessStagedCheckpoint(previous, event, input);
    },
    isStagedCheckpointRemoteComplete(checkpoint, input) {
      return isProcessStageCheckpointRemoteComplete(checkpoint, input);
    },
    validateStageCheckpoint(checkpoint, input) {
      return validateProcessStageCheckpoint(checkpoint, input);
    },
  };

  async function runStages(desired, context) {
    if (options.badSequence === true) {
      context.checkpointStage('saved', {});
    }
    if (options.invalidPartial) {
      context.checkpointStage('draft_created', options.invalidPartial);
    }

    const stages = ['draft_created', 'saved', 'published'];
    const recoveredStage = context.recovery && context.recovery.stageCheckpoint && context.recovery.stageCheckpoint.stage;
    const recoveredIndex = recoveredStage ? stages.indexOf(recoveredStage) : -1;
    for (let index = recoveredIndex + 1; index < stages.length; index++) {
      const stage = stages[index];
      if (options.beforeRemoteStage) {
        options.beforeRemoteStage(stage);
      }
      if (typeof context.assertRemoteDispatchBoundary === 'function') {
        context.assertRemoteDispatchBoundary('before');
      }
      remoteDispatches += 1;
      if (stage === 'draft_created') {
        remote.bindings = fakeBindings();
      }
      if (stage === 'saved') {
        remote.managed = clonePlain(desired);
      }
      remote.stage = stage;
      if (options.afterRemoteStage) {
        options.afterRemoteStage(stage);
      }
      if (typeof context.assertRemoteDispatchBoundary === 'function') {
        context.assertRemoteDispatchBoundary('after');
      }
      context.checkpointStage(stage, partialForStage(stage));
      calls.push(`checkpoint:${stage}`);
      if (options.afterCheckpoint) {
        options.afterCheckpoint(stage);
      }
      stateVisibility.push(fs.existsSync(statePath()));
      if (failAfterStage === stage) {
        failAfterStage = null;
        throw new Error('injected staged write failure');
      }
    }
    return clonePlain(remote.bindings);
  }

  return {
    adapter,
    calls,
    remote,
    getRemoteDispatches() {
      return remoteDispatches;
    },
    setReconciliation(value) {
      reconciliation = value;
    },
    setFailAfterStage(value) {
      failAfterStage = value;
    },
    setFailingReadStages(values) {
      failingReadStages = new Set(values || []);
    },
    setFailingReadCode(value) {
      failingReadCode = value;
    },
    stateVisibility,
  };
}

function fakeBindings() {
  return {
    processCode: 'PROCESS_CODE_RUNTIME_VALUE',
    processId: 'PROCESS_ID_RUNTIME_VALUE',
    processVersion: 0,
    nodeBindings: {
      approval: {
        nodeId: 'NODE_ID_RUNTIME_VALUE',
        componentName: 'ApprovalNode',
      },
    },
  };
}

function partialForStage(stage) {
  const bindings = fakeBindings();
  if (stage === 'draft_created') {
    return {
      processCode: bindings.processCode,
      processId: bindings.processId,
      processVersion: bindings.processVersion,
    };
  }
  if (stage === 'saved') {
    return { nodeBindings: bindings.nodeBindings };
  }
  return {};
}

function observedResource(desiredResource, managed) {
  return {
    resourceType: desiredResource.resourceType,
    key: desiredResource.key,
    adapterVersion: desiredResource.adapterVersion,
    managed: clonePlain(managed),
  };
}

function createTestContext(harness, options = {}) {
  const registry = new ResourceRegistry().register(harness.adapter);
  const desiredResources = options.desiredResources || [options.desiredResource || resource()];
  const manifestHash = hashStable({ resources: desiredResources });
  const state = options.state || createEmptyState(environment(), { manifestHash, registry });
  const plan = createPlan({
    desiredResources,
    manifestHash,
    observedResources: options.observedResources || [],
    state,
  }, { registry });
  return {
    input: {
      environment: environment(),
      expectedPlanId: plan.planId,
      loadDesired: async () => ({
        manifestHash,
        normalized: { resources: desiredResources },
      }),
      statePath: statePath(),
      workspaceRoot: tempDir,
    },
    options: { registry },
    plan,
    registry,
  };
}

async function runApply(harness, overrides = {}) {
  const context = createTestContext(harness);
  return applySchema(context.input, { ...context.options, ...overrides });
}

describe('generic staged apply journal and reconciliation', () => {
  test('checkpoints fixed stages before one final State checkpoint', async () => {
    const harness = createStagedHarness();

    const result = await runApply(harness);

    expect(result).toMatchObject({
      success: true,
      counts: { create: 1, update: 0, noop: 0, stateRepair: 0 },
      stateRevision: 1,
    });
    expect(harness.calls).toEqual([
      'create:fresh',
      'checkpoint:draft_created',
      'checkpoint:saved',
      'checkpoint:published',
      'read',
      'verify',
    ]);
    expect(harness.stateVisibility).toEqual([false, false, false]);

    const journal = readJournal();
    expect(journal.operations['process:approvalFlow']).toMatchObject({
      status: 'completed',
      stageCheckpoint: {
        stage: 'completed',
        processVersion: 0,
        nodeBindings: {
          approval: { componentName: 'ApprovalNode' },
        },
      },
    });
    expect(journal.operations['process:approvalFlow'].stageCheckpoint).toHaveProperty('desiredManagedHash');
    expect(journal.operations['process:approvalFlow'].stageCheckpoint).toHaveProperty('observedManagedHash');
    const persisted = readState(statePath(), {
      environment: environment(),
      registry: createTestContext(harness).registry,
    });
    expect(persisted.resources.process.approvalFlow.bindings.processVersion).toBe(0);
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);
  });

  test('uses reconciliation evidence once and resumes after the latest saved stage', async () => {
    const harness = createStagedHarness({
      failAfterStage: 'saved',
      reconciliation: 'resume',
    });

    const result = await runApply(harness);

    expect(result.success).toBe(true);
    expect(harness.calls).toEqual([
      'create:fresh',
      'checkpoint:draft_created',
      'checkpoint:saved',
      'reconcile:saved',
      'create:resume',
      'checkpoint:published',
      'read',
      'verify',
    ]);
    expect(harness.calls.filter(call => call === 'checkpoint:draft_created')).toHaveLength(1);
    expect(harness.calls.filter(call => call === 'checkpoint:saved')).toHaveLength(1);
  });

  test('does not enter a second reconciliation loop when a resumed write fails', async () => {
    const harness = createStagedHarness({
      failAfterStage: 'saved',
      reconciliation: 'resumeThenFail',
    });

    await expect(runApply(harness)).rejects.toMatchObject({
      code: 'SCHEMA_RECONCILIATION_REQUIRED',
    });

    expect(harness.calls.filter(call => call.startsWith('reconcile:'))).toEqual(['reconcile:saved']);
    expect(harness.calls.filter(call => call.startsWith('create:'))).toEqual([
      'create:fresh',
      'create:resume',
    ]);
    expect(readJournal().operations['process:approvalFlow']).toMatchObject({
      status: 'uncertain',
      stageCheckpoint: { stage: 'published' },
    });
    expect(fs.existsSync(statePath())).toBe(false);
  });

  test('keeps the latest stage and refuses a blind retry when evidence is insufficient', async () => {
    const harness = createStagedHarness({ failAfterStage: 'draft_created' });

    await expect(runApply(harness)).rejects.toMatchObject({
      code: 'SCHEMA_RECONCILIATION_REQUIRED',
    });

    expect(harness.calls).toEqual([
      'create:fresh',
      'checkpoint:draft_created',
      'reconcile:draft_created',
    ]);
    const operation = readJournal().operations['process:approvalFlow'];
    expect(operation.status).toBe('uncertain');
    expect(operation.stageCheckpoint.stage).toBe('draft_created');
    expect(fs.existsSync(statePath())).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);
  });

  test.each([
    ['after a remote stage returns', 'afterRemoteStage', 1, undefined, 'SCHEMA_RECONCILIATION_REQUIRED'],
    ['after a durable stage checkpoint', 'afterCheckpoint', 1, 'draft_created', 'SCHEMA_APPLY_LOCK_LOST'],
    ['before final State checkpoint', 'beforeVerify', 3, 'published', 'SCHEMA_APPLY_LOCK_LOST'],
  ])('staged lock generation replacement %s stops subsequent work', async (_label, hook, dispatches, stage, expectedCode) => {
    let replaced = false;
    const harness = createStagedHarness({
      [hook](currentStage) {
        if (replaced || currentStage && currentStage !== 'draft_created') {
          return;
        }
        replaced = true;
        replaceStagedLockGeneration();
      },
    });

    await expect(runApply(harness)).rejects.toMatchObject({ code: expectedCode });

    expect(harness.getRemoteDispatches()).toBe(dispatches);
    expect(fs.existsSync(statePath())).toBe(false);
    const operation = readJournal().operations['process:approvalFlow'];
    expect(operation.status).not.toBe('completed');
    if (stage) {
      expect(operation.stageCheckpoint.stage).toBe(stage);
    }
  });

  test('validates reviewed journal desired hashes before observed reads or reconciliation', async () => {
    const harness = createStagedHarness({ failAfterStage: 'draft_created' });
    const context = createTestContext(harness);
    await expect(applySchema(context.input, context.options)).rejects.toMatchObject({
      code: 'SCHEMA_RECONCILIATION_REQUIRED',
    });
    const journalPath = path.join(tempDir, 'apply-operations.v1.json');
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    journal.operations['process:approvalFlow'].desiredHash = hashStable({ mismatched: true });
    fs.writeFileSync(journalPath, JSON.stringify(journal) + '\n', 'utf8');
    harness.calls.length = 0;

    await expect(applySchema(context.input, context.options)).rejects.toMatchObject({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    });

    expect(harness.calls).toEqual([]);
    expect(fs.existsSync(statePath())).toBe(false);
  });

  test('rejects a draft_created operation identity replacement before reconciliation I/O', async () => {
    const harness = createStagedHarness({ failAfterStage: 'draft_created' });
    const context = createTestContext(harness);
    await expect(applySchema(context.input, context.options)).rejects.toMatchObject({
      code: 'SCHEMA_RECONCILIATION_REQUIRED',
    });
    const journalPath = path.join(tempDir, 'apply-operations.v1.json');
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    journal.operations['process:approvalFlow'].operationId = hashStable({ replaced: true });
    fs.writeFileSync(journalPath, JSON.stringify(journal) + '\n', 'utf8');
    harness.calls.length = 0;

    await expect(applySchema(context.input, context.options)).rejects.toMatchObject({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    });

    expect(harness.calls).toEqual([]);
    expect(fs.existsSync(statePath())).toBe(false);
  });

  test('recovers an uncertain journal only after complete evidence on a later apply', async () => {
    const harness = createStagedHarness({ failAfterStage: 'draft_created' });
    const context = createTestContext(harness);

    await expect(applySchema(context.input, context.options)).rejects.toMatchObject({
      code: 'SCHEMA_RECONCILIATION_REQUIRED',
    });
    harness.remote.managed = resource().desired;
    harness.remote.stage = 'published';
    harness.setReconciliation('complete');
    harness.calls.length = 0;

    const recovered = await applySchema(context.input, context.options);

    expect(recovered.success).toBe(true);
    expect(harness.calls[0]).toBe('reconcile:draft_created');
    expect(harness.calls.filter(call => call.startsWith('create:'))).toEqual([]);
    expect(readJournal().operations['process:approvalFlow'].status).toBe('completed');
    expect(fs.existsSync(statePath())).toBe(true);
  });

  test('reaches reconciliation when ordinary observed read fails for an interrupted staged update', async () => {
    const harness = createStagedHarness();
    const initialContext = createTestContext(harness);
    await applySchema(initialContext.input, initialContext.options);
    const previousState = readState(statePath(), {
      environment: environment(),
      registry: initialContext.registry,
    });
    const updatedResource = resource('Updated approval flow');
    const updateContext = createTestContext(harness, {
      desiredResource: updatedResource,
      observedResources: [{
        resourceType: 'process',
        key: 'approvalFlow',
        adapterVersion: 1,
        managed: clonePlain(harness.remote.managed),
      }],
      state: previousState,
    });
    harness.setFailAfterStage('draft_created');
    harness.calls.length = 0;

    await expect(applySchema(updateContext.input, updateContext.options)).rejects.toMatchObject({
      code: 'SCHEMA_RECONCILIATION_REQUIRED',
    });
    harness.setFailingReadStages(['draft_created']);
    harness.setFailingReadCode('FORM_SCHEMA_READ_FAILED');
    harness.setReconciliation('resume');
    harness.calls.length = 0;

    const recovered = await applySchema(updateContext.input, updateContext.options);

    expect(recovered.success).toBe(true);
    expect(harness.calls.slice(0, 3)).toEqual([
      'read',
      'reconcile:draft_created',
      'update:resume',
    ]);
    expect(harness.calls.indexOf('reconcile:draft_created')).toBeLessThan(
      harness.calls.indexOf('update:resume')
    );
    const recoveredJournal = readJournal();
    expect(recoveredJournal.operations['process:approvalFlow'].suppressedErrors).toEqual([
      expect.objectContaining({
        code: 'SCHEMA_DEFERRED_RECOVERY_READ_FAILED',
        adapterCode: 'FORM_SCHEMA_READ_FAILED',
        errorCode: 'SCHEMA_REMOTE_READ_FAILED',
        errorName: 'SchemaValidationError',
        phase: 'deferred_recovery_observed_read',
        resourceType: 'process',
        key: 'approvalFlow',
      }),
    ]);
    expect(JSON.stringify(recoveredJournal)).not.toContain('injected staged intermediate read failure');
    const recoveredState = readState(statePath(), {
      environment: environment(),
      registry: updateContext.registry,
    });
    expect(recoveredState.resources.process.approvalFlow.lastApplied).toEqual(updatedResource.desired);
  });

  test('blocks unrelated drift before staged reconciliation or resumed writes', async () => {
    const harness = createStagedHarness();
    const initialContext = createTestContext(harness);
    await applySchema(initialContext.input, initialContext.options);
    const auditResource = resource('Audit flow', 'auditFlow');
    let state = readState(statePath(), {
      environment: environment(),
      registry: initialContext.registry,
    });
    state = upsertResourceState(state, {
      resourceType: auditResource.resourceType,
      key: auditResource.key,
      adapterVersion: 1,
      bindings: fakeBindings(),
      lastApplied: auditResource.desired,
      lastAppliedHash: hashStable(auditResource.desired),
      observedManagedHash: hashStable(auditResource.desired),
    }, { registry: initialContext.registry });
    state = writeStateAtomic(statePath(), state, {
      environment: environment(),
      registry: initialContext.registry,
    });
    const updatedResource = resource('Updated approval flow');
    const updateContext = createTestContext(harness, {
      desiredResources: [updatedResource, auditResource],
      observedResources: [
        observedResource(updatedResource, harness.remote.managed),
        observedResource(auditResource, auditResource.desired),
      ],
      state,
    });
    const stableReader = jest.fn(async resources => ({
      missingResources: [],
      resources: resources.map(item => observedResource(
        item,
        item.key === auditResource.key ? auditResource.desired : harness.remote.managed
      )),
    }));
    harness.setFailAfterStage('draft_created');

    await expect(applySchema(updateContext.input, {
      ...updateContext.options,
      readObservedResources: stableReader,
    })).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    const journalBeforeRetry = fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8');
    const stateBeforeRetry = fs.readFileSync(statePath(), 'utf8');
    harness.calls.length = 0;
    const driftReader = jest.fn(async resources => ({
      missingResources: [],
      resources: resources.map(item => observedResource(item, {
        name: item.key === auditResource.key ? 'External audit drift' : item.desired.name,
      })),
    }));

    await expect(applySchema(updateContext.input, {
      ...updateContext.options,
      readObservedResources: driftReader,
    })).rejects.toMatchObject({ code: 'SCHEMA_APPLY_BLOCKED' });

    expect(driftReader).toHaveBeenCalledTimes(1);
    expect(driftReader.mock.calls[0][0].map(item => item.key)).toEqual(['auditFlow']);
    expect(harness.calls).toEqual([]);
    expect(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8')).toBe(journalBeforeRetry);
    expect(fs.readFileSync(statePath(), 'utf8')).toBe(stateBeforeRetry);
  });

  test('keeps a completed journal when the final State checkpoint fails', async () => {
    const harness = createStagedHarness();
    let failStateRename = true;
    const fsImpl = {
      ...fs,
      renameSync(from, to) {
        if (failStateRename && to === statePath()) {
          failStateRename = false;
          const error = new Error('injected state rename failure');
          error.code = 'EACCES';
          throw error;
        }
        return fs.renameSync(from, to);
      },
    };

    await expect(runApply(harness, { fsImpl })).rejects.toMatchObject({
      code: 'SCHEMA_STATE_WRITE_FAILED',
    });
    expect(readJournal().operations['process:approvalFlow'].status).toBe('completed');
    expect(fs.existsSync(statePath())).toBe(false);
    const createsBeforeRecovery = harness.calls.filter(call => call.startsWith('create:')).length;

    const recovered = await runApply(harness);

    expect(recovered.success).toBe(true);
    expect(harness.calls.filter(call => call.startsWith('create:'))).toHaveLength(createsBeforeRecovery);
    expect(fs.existsSync(statePath())).toBe(true);
  });

  test('keeps completed evidence when State fails after readback reconciliation', async () => {
    const harness = createStagedHarness({
      failReadOnce: true,
      reconciliation: 'complete',
    });
    let failStateRename = true;
    const fsImpl = {
      ...fs,
      renameSync(from, to) {
        if (failStateRename && to === statePath()) {
          failStateRename = false;
          const error = new Error('injected reconciled state rename failure');
          error.code = 'EACCES';
          throw error;
        }
        return fs.renameSync(from, to);
      },
    };

    await expect(runApply(harness, { fsImpl })).rejects.toMatchObject({
      code: 'SCHEMA_STATE_WRITE_FAILED',
    });

    expect(harness.calls).toContain('reconcile:published');
    expect(readJournal().operations['process:approvalFlow']).toMatchObject({
      status: 'completed',
      stageCheckpoint: { stage: 'completed' },
    });
    expect(fs.existsSync(statePath())).toBe(false);
  });

  test('rejects an adapter stage skip before State is written', async () => {
    const harness = createStagedHarness({ badSequence: true });

    await expect(runApply(harness)).rejects.toMatchObject({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    });

    expect(harness.calls).toEqual(['create:fresh']);
    expect(fs.existsSync(statePath())).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);
  });

  test.each([
    ['full definition', { processJson: { content: 'PROCESS_JSON_SECRET' } }, 'PROCESS_JSON_SECRET'],
    ['credential', { token: 'TOKEN_RUNTIME_SECRET' }, 'TOKEN_RUNTIME_SECRET'],
    ['nested binding field', {
      nodeBindings: {
        approval: {
          nodeId: 'NODE_ID_RUNTIME_VALUE',
          componentName: 'ApprovalNode',
          header: 'HEADER_RUNTIME_SECRET',
        },
      },
    }, 'HEADER_RUNTIME_SECRET'],
  ])('rejects %s from a partial checkpoint without persisting its value', async (_label, partial, secret) => {
    const harness = createStagedHarness({ invalidPartial: partial });

    await expect(runApply(harness)).rejects.toMatchObject({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    });

    const rawJournal = fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8');
    expect(rawJournal).not.toContain(secret);
    expect(fs.existsSync(statePath())).toBe(false);
  });

  test('rejects staged methods on a non-process adapter', () => {
    expect(() => new ResourceRegistry().register({
      resourceType: 'invalidStaged',
      adapterVersion: 1,
      normalize(value) { return value; },
      validate() {},
      reconcileStaged() {},
      advanceStagedCheckpoint() {},
      isStagedCheckpointRemoteComplete() {},
      validateStageCheckpoint() {},
    })).toThrow('Resource adapter staged methods are reserved for process: invalidStaged');
  });

  test('requires the complete staged method contract for process', () => {
    expect(() => new ResourceRegistry().register({
      resourceType: 'process',
      adapterVersion: 1,
      normalize(value) { return value; },
      validate() {},
      reconcileStaged() {},
    })).toThrow('Process staged adapter must implement the complete staged method contract: process');
  });

  test('keeps process checkpoint fields and stages out of the generic core', () => {
    const genericSource = [
      fs.readFileSync(path.join(__dirname, '../lib/schema/applier.js'), 'utf8'),
      fs.readFileSync(path.join(__dirname, '../lib/schema/apply-store.js'), 'utf8'),
    ].join('\n');

    expect(genericSource).not.toMatch(/stageCheckpoint\.(?:stage|processCode|processId|processVersion|nodeBindings)/);
    expect(genericSource).not.toContain('draft_created');
    expect(genericSource).not.toContain('readback_verified');
    expect(genericSource).not.toContain('stagedReconciliationDecisions');
  });

  test.each(['readObserved', 'projectObserved'])(
    'rejects a staged apply adapter missing %s before writes or checkpoints',
    async (method) => {
      const harness = createStagedHarness();
      delete harness.adapter[method];
      const context = createTestContext(harness);

      await expect(applySchema(context.input, context.options)).rejects.toMatchObject({
        code: 'SCHEMA_RESOURCE_TYPE_UNSUPPORTED',
      });

      expect(harness.calls).toEqual([]);
      expect(fs.existsSync(statePath())).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'apply-operations.v1.json'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'generated', 'bindings.v1.json'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'apply.lock'))).toBe(false);
    }
  );

  test('does not allow a later stage to replace an established identity binding', () => {
    const desiredManagedHash = hashStable({ managed: 'identity' });
    const draft = advanceProcessStageCheckpoint(undefined, 'draft_created', {
      processId: 'PROCESS_ID_FIRST',
      processVersion: 0,
    }, { desiredManagedHash });

    expect(() => advanceProcessStageCheckpoint(draft, 'saved', {
      processId: 'PROCESS_ID_REPLACEMENT',
    }, { desiredManagedHash })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    }));
  });
});

function readJournal() {
  return JSON.parse(fs.readFileSync(path.join(tempDir, 'apply-operations.v1.json'), 'utf8'));
}

function assertAllowedKeys(value, allowedKeys) {
  const allowed = new Set(allowedKeys);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Fake staged state entry is invalid.');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Fake staged state entry is invalid.');
    }
  }
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function replaceStagedLockGeneration() {
  const lockPath = path.join(tempDir, 'apply.lock');
  const displacedPath = `${lockPath}.displaced`;
  const owner = fs.readFileSync(lockPath, 'utf8');
  fs.renameSync(lockPath, displacedPath);
  fs.writeFileSync(lockPath, owner, { mode: 0o600 });
}
