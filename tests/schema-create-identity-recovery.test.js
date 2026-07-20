'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { applySchema } = require('../lib/schema/applier');
const {
  createApplyJournal,
  readApplyJournal,
  resolveApplyPaths,
  updateJournalOperation,
  writeApplyJournalAtomic,
} = require('../lib/schema/apply-store');
const { createPlan, hashManagedIdentity } = require('../lib/schema/planner');
const { ResourceRegistry } = require('../lib/schema/resource-registry');
const {
  createEmptyState,
  hashStable,
  readState,
  writeStateAtomic,
} = require('../lib/schema/state-store');
const { createServerRevisionConflict } = require('../lib/schema/server-revision');

describe('generic create identity checkpoint and recovery', () => {
  let behavior;
  let desiredResult;
  let environment;
  let registry;
  let remote;
  let statePath;
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-create-identity-'));
    statePath = path.join(workspace, '.cache', 'openyida', 'state.v1.json');
    environment = { endpoint: 'https://example.test', corpId: 'corp-test' };
    behavior = {
      createCalls: 0,
      resumeCalls: 0,
      throwBeforeIdentity: false,
      throwAfterIdentity: false,
      throwOnResume: false,
      throwStaleOnResume: false,
      checkpointTwice: false,
      beforeCheckpoint: null,
      invalidIdentity: false,
      lateCheckpoint: null,
      expectedJournalRaw: null,
      beforeDispatch: null,
      afterCreateDispatch: null,
      afterResumeDispatch: null,
      beforeVerify: null,
    };
    remote = new Map();
    registry = new ResourceRegistry().register(createAdapter(behavior, remote));
    desiredResult = makeDesiredResult();
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test('checkpoints identity once and commits State only after exact readback', async () => {
    const result = await runApply();

    expect(result.success).toBe(true);
    expect(behavior.createCalls).toBe(1);
    expect(behavior.resumeCalls).toBe(0);
    expect(readState(statePath, { environment, registry }).resources.synthetic.item).toMatchObject({
      bindings: { remoteId: 'remote-item' },
      lastApplied: { value: 'desired' },
    });
    expect(readApplyJournal(resolveApplyPaths(statePath).journalPath, {
      environment,
      registry,
      workspaceRoot: workspace,
    }).operations['synthetic:item']).toMatchObject({
      status: 'completed',
      createIdentity: { bindings: { remoteId: 'remote-item' } },
    });
  });

  test('double checkpoint is rejected and leaves durable uncertain identity', async () => {
    behavior.checkpointTwice = true;

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    expect(behavior.createCalls).toBe(1);
    expect(readOperation()).toMatchObject({
      status: 'uncertain',
      createIdentity: { bindings: { remoteId: 'remote-item' } },
    });
    expect(fs.existsSync(statePath)).toBe(false);
  });

  test('invalid adapter binding checkpoint is rejected locally', async () => {
    behavior.invalidIdentity = true;

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    expect(readOperation()).toMatchObject({ status: 'uncertain' });
    expect(readOperation().createIdentity).toBeUndefined();
    expect(remote.size).toBe(0);
  });

  test.each([
    ['State revision drift', () => {
      writeStateAtomic(statePath, createEmptyState(environment, {
        manifestHash: desiredResult.manifestHash,
        registry,
      }), { environment, fsImpl: fs, registry });
      rememberCurrentJournal();
    }, 'SCHEMA_RECONCILIATION_REQUIRED'],
    ['reviewed plan drift', () => {
      const journalPath = resolveApplyPaths(statePath).journalPath;
      const journal = readApplyJournal(journalPath, { environment, registry, workspaceRoot: workspace });
      journal.planId = hashStable({ stale: 'plan' });
      fs.writeFileSync(journalPath, `${JSON.stringify(journal)}\n`, 'utf8');
      rememberCurrentJournal();
    }, 'SCHEMA_RECONCILIATION_REQUIRED'],
    ['environment drift', () => {
      const journalPath = resolveApplyPaths(statePath).journalPath;
      const journal = readApplyJournal(journalPath, { environment, registry, workspaceRoot: workspace });
      const otherEnvironment = { endpoint: 'https://other.test', corpId: 'other-corp' };
      journal.environment = createEmptyState(otherEnvironment, { registry }).environment;
      fs.writeFileSync(journalPath, `${JSON.stringify(journal)}\n`, 'utf8');
      rememberCurrentJournal();
    }, 'SCHEMA_RECONCILIATION_REQUIRED'],
    ['apply lock loss', () => {
      rememberCurrentJournal();
      fs.unlinkSync(resolveApplyPaths(statePath).lockPath);
    }, 'SCHEMA_RECONCILIATION_REQUIRED'],
  ])('%s blocks identity persistence and remote continuation', async (label, mutate, expectedCode) => {
    behavior.beforeCheckpoint = mutate;

    await expect(runApply()).rejects.toMatchObject({ code: expectedCode });

    expect(label).toBeTruthy();
    expect(remote.size).toBe(0);
    expect(fs.readFileSync(resolveApplyPaths(statePath).journalPath, 'utf8')).toBe(
      behavior.expectedJournalRaw
    );
  });

  test('late checkpoint cannot be rearmed after adapter create settles', async () => {
    await runApply();

    expect(() => behavior.lateCheckpoint({ remoteId: 'late' })).toThrow(expect.objectContaining({
      code: 'SCHEMA_APPLY_JOURNAL_INVALID',
    }));
  });

  test.each([
    ['before remote dispatch', 'beforeDispatch', 0, 'SCHEMA_APPLY_LOCK_LOST'],
    ['after remote dispatch', 'afterCreateDispatch', 1, 'SCHEMA_RECONCILIATION_REQUIRED'],
    ['before completed journal and State', 'beforeVerify', 1, 'SCHEMA_APPLY_LOCK_LOST'],
  ])('lock generation replacement %s blocks completion and later writes', async (_label, hook, expectedCreates, expectedCode) => {
    behavior[hook] = () => replaceLockGeneration(statePath);

    let caught;
    try {
      await runApply();
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: expectedCode });
    if (hook === 'afterCreateDispatch') {
      expect(caught.cause).toMatchObject({ code: 'SCHEMA_APPLY_LOCK_RELEASE_FAILED' });
    }

    expect(behavior.createCalls).toBe(expectedCreates);
    expect(fs.existsSync(statePath)).toBe(false);
    const journal = readApplyJournal(resolveApplyPaths(statePath).journalPath, {
      environment,
      registry,
      workspaceRoot: workspace,
    });
    const operation = journal && journal.operations['synthetic:item'];
    expect(operation && operation.status).not.toBe('completed');
    expect(behavior.resumeCalls).toBe(0);
  });

  test('create failure before identity is uncertain and never recreated', async () => {
    behavior.throwBeforeIdentity = true;
    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });
    expect(readOperation()).toMatchObject({ status: 'uncertain' });
    expect(readOperation().createIdentity).toBeUndefined();

    behavior.throwBeforeIdentity = false;
    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });
    expect(behavior.createCalls).toBe(1);
  });

  test('create failure after identity is uncertain and later resumes without recreating', async () => {
    behavior.throwAfterIdentity = true;

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });
    expect(readOperation()).toMatchObject({
      status: 'uncertain',
      createIdentity: { bindings: { remoteId: 'remote-item' } },
    });

    behavior.throwAfterIdentity = false;
    const result = await runApply();

    expect(result.success).toBe(true);
    expect(behavior.createCalls).toBe(1);
    expect(behavior.resumeCalls).toBe(1);
    expect(readOperation().status).toBe('completed');
  });

  test('pending identity resumes by exact binding without recreating', async () => {
    writePendingIdentityJournal();

    const result = await runApply();

    expect(result.success).toBe(true);
    expect(behavior.createCalls).toBe(0);
    expect(behavior.resumeCalls).toBe(1);
    expect(remote.get('remote-item')).toEqual({ value: 'desired' });
    expect(readOperation().status).toBe('completed');
  });

  test('resume lock generation loss after dispatch preserves pending identity and zero State progress', async () => {
    writePendingIdentityJournal();
    behavior.afterResumeDispatch = () => replaceLockGeneration(statePath);

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });

    expect(behavior.createCalls).toBe(0);
    expect(behavior.resumeCalls).toBe(1);
    expect(readOperation()).toMatchObject({
      status: 'pending',
      createIdentity: { bindings: { remoteId: 'remote-item' } },
    });
    expect(fs.existsSync(statePath)).toBe(false);
  });

  test('resume failure stays exact-retryable and a later invocation resumes without create', async () => {
    writePendingIdentityJournal();
    behavior.throwOnResume = true;

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_RECONCILIATION_REQUIRED' });
    expect(behavior.resumeCalls).toBe(1);
    expect(readOperation().status).toBe('uncertain');

    behavior.throwOnResume = false;
    const result = await runApply();

    expect(result.success).toBe(true);
    expect(behavior.createCalls).toBe(0);
    expect(behavior.resumeCalls).toBe(2);
    expect(readOperation().status).toBe('completed');
  });

  test('resume stale CAS preserves pending identity without uncertain or State progress', async () => {
    writePendingIdentityJournal();
    const journalPath = resolveApplyPaths(statePath).journalPath;
    const before = fs.readFileSync(journalPath, 'utf8');
    behavior.throwStaleOnResume = true;

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_APPLY_JIT_CONFLICT' });

    expect(behavior.createCalls).toBe(0);
    expect(behavior.resumeCalls).toBe(1);
    expect(readOperation()).toMatchObject({
      status: 'pending',
      createIdentity: { bindings: { remoteId: 'remote-item' } },
    });
    expect(fs.readFileSync(journalPath, 'utf8')).toBe(before);
    expect(fs.existsSync(statePath)).toBe(false);

    await expect(runApply()).rejects.toMatchObject({ code: 'SCHEMA_APPLY_JIT_CONFLICT' });
    expect(behavior.resumeCalls).toBe(2);
    expect(fs.readFileSync(journalPath, 'utf8')).toBe(before);
  });

  test('completed remote checkpoint reconciles State without create or resume', async () => {
    remote.set('remote-item', { value: 'desired' });
    writeCompletedJournalWithoutState();

    const result = await runApply();

    expect(result.success).toBe(true);
    expect(behavior.createCalls).toBe(0);
    expect(behavior.resumeCalls).toBe(0);
    expect(readState(statePath, { environment, registry }).resources.synthetic.item).toBeDefined();
  });

  function makeDesiredResult() {
    const resource = {
      resourceType: 'synthetic',
      key: 'item',
      desired: { value: 'desired' },
      dependsOn: [],
    };
    return {
      manifestHash: hashStable({ manifest: 'synthetic-create-identity' }),
      normalized: { resources: [resource] },
    };
  }

  function currentPlan() {
    return createPlan({
      desiredResources: desiredResult.normalized.resources,
      manifestHash: desiredResult.manifestHash,
      observedResources: [],
      state: createEmptyState(environment, {
        manifestHash: desiredResult.manifestHash,
        registry,
      }),
    }, { registry });
  }

  function runApply() {
    return applySchema({
      environment,
      expectedPlanId: currentPlan().planId,
      loadDesired: async () => desiredResult,
      statePath,
      workspaceRoot: workspace,
    }, { fsImpl: fs, registry });
  }

  function writePendingIdentityJournal() {
    writeOperation({
      status: 'pending',
      createIdentity: { bindings: { remoteId: 'remote-item' } },
    });
  }

  function writeCompletedJournalWithoutState() {
    const checkpoint = {
      adapterVersion: 1,
      bindings: { remoteId: 'remote-item' },
      lastApplied: { value: 'desired' },
      lastAppliedHash: hashStable({ value: 'desired' }),
      observedManagedHash: hashManagedIdentity({
        adapterVersion: 1,
        key: 'item',
        managed: { value: 'desired' },
        resourceType: 'synthetic',
      }),
    };
    writeOperation({ status: 'completed', checkpoint });
  }

  function writeOperation(extra) {
    const plan = currentPlan();
    let journal = createApplyJournal({
      environment,
      manifestHash: desiredResult.manifestHash,
      planId: plan.planId,
      registry,
    });
    const operation = {
      operationId: hashStable({
        contractVersion: 1,
        planId: plan.planId,
        resourceType: 'synthetic',
        key: 'item',
        operation: 'create',
      }),
      resourceType: 'synthetic',
      key: 'item',
      operation: 'create',
      adapterVersion: 1,
      desiredHash: hashManagedIdentity({
        adapterVersion: 1,
        key: 'item',
        managed: { value: 'desired' },
        resourceType: 'synthetic',
      }),
      stateRevision: 0,
      ...extra,
    };
    journal = updateJournalOperation(journal, operation, { environment, registry });
    writeApplyJournalAtomic(resolveApplyPaths(statePath).journalPath, journal, {
      environment,
      fsImpl: fs,
      registry,
      workspaceRoot: workspace,
    });
  }

  function readOperation() {
    return readApplyJournal(resolveApplyPaths(statePath).journalPath, {
      environment,
      fsImpl: fs,
      registry,
      workspaceRoot: workspace,
    }).operations['synthetic:item'];
  }

  function rememberCurrentJournal() {
    behavior.expectedJournalRaw = fs.readFileSync(resolveApplyPaths(statePath).journalPath, 'utf8');
  }
});

function createAdapter(behavior, remote) {
  return {
    resourceType: 'synthetic',
    adapterVersion: 1,
    normalize(value) { return value; },
    validate() {},
    async prepareOperation() {
      if (behavior.beforeDispatch) {
        await behavior.beforeDispatch();
      }
    },
    async readObserved(binding) {
      const remoteId = binding.bindings.remoteId;
      if (!remote.has(remoteId)) {
        throw new Error('remote missing');
      }
      return { remoteId, managed: remote.get(remoteId) };
    },
    projectObserved(observed) {
      return {
        bindings: { remoteId: observed.remoteId },
        managed: observed.managed,
      };
    },
    async create(desired, context) {
      behavior.createCalls += 1;
      if (behavior.throwBeforeIdentity) {
        throw new Error('create failed before identity');
      }
      if (behavior.beforeCheckpoint) {
        await behavior.beforeCheckpoint();
      }
      await context.checkpointCreateIdentity(behavior.invalidIdentity ? {} : { remoteId: 'remote-item' });
      behavior.lateCheckpoint = context.checkpointCreateIdentity;
      if (behavior.checkpointTwice) {
        await context.checkpointCreateIdentity({ remoteId: 'remote-item' });
      }
      if (behavior.throwAfterIdentity) {
        throw new Error('create failed after identity');
      }
      remote.set('remote-item', desired);
      if (behavior.afterCreateDispatch) {
        await behavior.afterCreateDispatch();
      }
      return { remoteId: 'remote-item' };
    },
    async resumeCreate(desired, identity) {
      behavior.resumeCalls += 1;
      if (behavior.throwStaleOnResume) {
        throw createServerRevisionConflict('synthetic');
      }
      if (behavior.throwOnResume) {
        throw new Error('resume failed');
      }
      const remoteId = identity.bindings.remoteId;
      remote.set(remoteId, desired);
      if (behavior.afterResumeDispatch) {
        await behavior.afterResumeDispatch();
      }
      return { remoteId };
    },
    async update(desired, observed, binding) {
      const remoteId = binding.bindings.remoteId;
      remote.set(remoteId, desired);
      return { remoteId };
    },
    buildBindings(result) {
      if (!result || typeof result.remoteId !== 'string' || !result.remoteId) {
        throw new Error('invalid binding');
      }
      return { remoteId: result.remoteId };
    },
    verify(projection, context) {
      if (behavior.beforeVerify) {
        behavior.beforeVerify();
      }
      if (!projection || JSON.stringify(projection.managed) !== JSON.stringify(context.resource.desired)) {
        throw new Error('verify failed');
      }
      return projection;
    },
    validateStateResource(entry) {
      const bindings = entry.state.bindings;
      if (Object.keys(bindings).join(',') !== 'remoteId' || typeof bindings.remoteId !== 'string') {
        throw new Error('invalid synthetic bindings');
      }
    },
  };
}

function replaceLockGeneration(targetStatePath) {
  const lockPath = resolveApplyPaths(targetStatePath).lockPath;
  const displacedPath = `${lockPath}.displaced`;
  const owner = fs.readFileSync(lockPath, 'utf8');
  fs.renameSync(lockPath, displacedPath);
  fs.writeFileSync(lockPath, owner, { mode: 0o600 });
}
