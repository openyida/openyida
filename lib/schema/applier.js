'use strict';

const { schemaError } = require('./errors');
const { createPlan, hashManagedIdentity, selectObservableResources } = require('./planner');
const { resourceId } = require('./dependency-graph');
const { isSha256 } = require('./hash');
const { readObservedResources, hashObservedManaged, isRemoteMissingError } = require('./remote-reader');
const { createDefaultRegistry, isStagedAdapter } = require('./resource-registry');
const { compareCodePoints } = require('./sort');
const {
  getResourceState,
  hashStable,
  readState,
  upsertResourceState,
  writeStateAtomic,
} = require('./state-store');
const {
  acquireApplyLock,
  assertApplyLockHandleOwned,
  assertSafeApplyPath,
  createApplyJournal,
  createApplyOperationId,
  readApplyJournal,
  removeJournalOperation,
  resolveSafeApplyPaths,
  updateJournalOperation,
  writeApplyJournalAtomic,
} = require('./apply-store');
const { isServerRevisionConflict } = require('./server-revision');

const APPLY_KIND = 'openyida_schema_apply';
const APPLY_CONTRACT_VERSION = 1;
const FORM_POST_WRITE_READBACK_MAX_ATTEMPTS = 10;
const FORM_POST_WRITE_READBACK_DELAY_MS = 1000;
const BLOCKING_OPERATIONS = new Set(['conflict', 'unmanaged', 'orphan']);
const CREATE_IDENTITY_BOUNDARY_FAILURES = new WeakSet();
const POST_DISPATCH_LOCK_FAILURES = new WeakSet();
const MAX_SUPPRESSED_OPERATION_ERRORS = 10;

async function applySchema(input, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  const safePaths = resolveSafeApplyPaths(input.statePath, input.workspaceRoot, {
    fsImpl: options.fsImpl,
    paths: options.paths,
  });
  input = {
    ...input,
    statePath: safePaths.statePath,
  };
  const paths = safePaths.paths;
  const lock = acquireApplyLock(paths.lockPath, {
    fsImpl: options.fsImpl,
    workspaceRoot: input.workspaceRoot,
  });
  let applyResult;
  let primaryError;
  try {
    const desiredResult = await input.loadDesired();
    input = {
      ...input,
      manifestHash: desiredResult.manifestHash,
    };
    const desiredResources = desiredResult.normalized.resources.map(resource => ({
      ...resource,
      adapterVersion: resource.adapterVersion || registry.get(resource.resourceType).adapterVersion,
    }));
    assertApplyAdapters(desiredResources, registry, {
      ...createAdapterContext(input, options),
      workspaceRoot: input.workspaceRoot,
    });
    let state = readState(input.statePath, {
      environment: input.environment,
      fsImpl: options.fsImpl,
      manifestHash: desiredResult.manifestHash,
      registry,
    });
    let journal = readApplyJournal(paths.journalPath, {
      environment: input.environment,
      fsImpl: options.fsImpl,
      registry,
      workspaceRoot: input.workspaceRoot,
    });
    const reviewedJournalOperations = validateJournalBeforeObserved({
      desiredResources,
      input,
      journal,
      registry,
      state,
    });
    const deferredStagedOperations = getIncompleteStagedOperations(
      reviewedJournalOperations,
      registry
    );
    const deferredResourceIds = new Set(deferredStagedOperations.keys());
    let observed;
    if (deferredResourceIds.size > 0) {
      const reviewedRecovery = await readObservedForReviewedRecovery({
        deferredResourceIds,
        desiredResources,
        input,
        journal,
        paths,
        options,
        registry,
        state,
        lock,
      });
      observed = reviewedRecovery.observed;
      journal = reviewedRecovery.journal;
    } else {
      observed = await readInitialObserved(desiredResources, state, input, options, registry, lock);
    }
    let reviewedObservedIdentities = indexObservedReviewIdentities(observed.resources);
    let plan = createPlan({
      desiredResources,
      manifestHash: desiredResult.manifestHash,
      observedResources: observed.resources,
      state,
    }, { registry });

    const resumeFromReviewedJournal = plan.planId !== input.expectedPlanId && canResumeReviewedJournal(
      journal,
      input.expectedPlanId,
      desiredResult.manifestHash
    );
    if (plan.planId !== input.expectedPlanId && !resumeFromReviewedJournal) {
      throw schemaError('SCHEMA_APPLY_PLAN_STALE', 'Schema apply planId is stale.');
    }
    assertPlanExecutable(plan, { deferredResourceIds });
    const internalStagedRecoveryEvidence = await collectInternalStagedRecoveryEvidence({
      deferredStagedOperations,
      input,
      options,
      registry,
      state,
      lock,
    });
    const preparedJournal = await prepareJournalForPlan({
      desiredResources,
      desiredResult,
      input,
      journal,
      options,
      paths,
      plan,
      registry,
      state,
      internalStagedRecoveryEvidence,
      lock,
    });
    journal = preparedJournal.journal;
    state = preparedJournal.state;

    if (resumeFromReviewedJournal || preparedJournal.recoveredRemote) {
      const resumedObserved = await readInitialObserved(desiredResources, state, input, options, registry, lock);
      reviewedObservedIdentities = indexObservedReviewIdentities(resumedObserved.resources);
      plan = createPlan({
        desiredResources,
        manifestHash: desiredResult.manifestHash,
        observedResources: resumedObserved.resources,
        state,
      }, { registry });
      assertPlanExecutable(plan);
    }

    const resourcesById = new Map(desiredResources.map(resource => [resourceId(resource), resource]));
    const counts = { create: 0, update: 0, noop: 0, stateRepair: 0 };

    for (const change of plan.changes) {
      if (change.operation === 'noop' && !change.stateRepair) {
        counts.noop += 1;
        continue;
      }
      const resource = resourcesById.get(`${change.resourceType}:${change.key}`);
      if (!resource) {
        continue;
      }
      if (stateAlreadyCheckpointed(resource, state)) {
        counts.noop += 1;
        continue;
      }
      const result = await applyResourceChange({
        change,
        input,
        journal,
        lock,
        options,
        paths,
        registry,
        resource,
        reviewedObservedIdentities,
        state,
      });
      journal = result.journal;
      state = result.state;
      if (change.stateRepair) {
        counts.stateRepair += 1;
      } else {
        counts[change.operation] += 1;
      }
    }

    applyResult = {
      kind: APPLY_KIND,
      contractVersion: APPLY_CONTRACT_VERSION,
      success: true,
      planId: input.expectedPlanId,
      manifestHash: desiredResult.manifestHash,
      stateRevision: state.revision,
      counts,
    };
  } catch (error) {
    primaryError = error;
  }
  let releaseError;
  try {
    lock.release();
  } catch (error) {
    releaseError = error;
  }
  if (primaryError) {
    if (releaseError) {
      attachSuppressedLockReleaseError(primaryError, releaseError);
    }
    throw primaryError;
  }
  if (releaseError) {
    throw releaseError;
  }
  return applyResult;
}

function attachSuppressedLockReleaseError(primaryError, releaseError) {
  if (!primaryError || (typeof primaryError !== 'object' && typeof primaryError !== 'function')) {
    return;
  }
  const property = Object.prototype.hasOwnProperty.call(primaryError, 'cause')
    ? 'suppressedLockReleaseError'
    : 'cause';
  try {
    Object.defineProperty(primaryError, property, {
      configurable: true,
      enumerable: false,
      value: releaseError,
      writable: false,
    });
  } catch {
    // Preserve the primary apply error even when the error object cannot carry diagnostics.
  }
}

async function readInitialObserved(desiredResources, state, input, options, registry, lock) {
  const observable = selectObservableResources(desiredResources, state, { registry });
  return readObservedSubset(observable, state, input, options, registry, lock);
}

async function readObservedSubset(observable, state, input, options, registry, lock) {
  const reader = options.readObservedResources || readObservedResources;
  if (observable.length === 0) {
    return { missingResources: [], resources: [] };
  }
  assertApplyLockHandleOwned(lock);
  const result = await reader(observable, state, {
    assertDispatchBoundary: () => assertApplyLockHandleOwned(lock),
    context: {
      ...createAdapterContext(input, options, state),
      assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary({ lock }, phase),
    },
    registry,
    services: options.services,
  });
  assertApplyLockHandleOwned(lock);
  return result;
}

async function readObservedForReviewedRecovery(context) {
  const observable = selectObservableResources(context.desiredResources, context.state, {
    registry: context.registry,
  });
  const ordinary = observable.filter(resource => !context.deferredResourceIds.has(resourceId(resource)));
  const deferred = observable.filter(resource => context.deferredResourceIds.has(resourceId(resource)));
  const ordinaryObserved = await readObservedSubset(
    ordinary,
    context.state,
    context.input,
    context.options,
    context.registry,
    context.lock
  );
  const preliminaryPlan = createPlan({
    desiredResources: context.desiredResources,
    manifestHash: context.input.manifestHash,
    observedResources: ordinaryObserved.resources,
    state: context.state,
  }, { registry: context.registry });
  assertPlanExecutable(preliminaryPlan, {
    deferredResourceIds: context.deferredResourceIds,
  });

  const recoveredObserved = [];
  const recoveredMissing = [];
  let journal = context.journal;
  for (const resource of deferred) {
    try {
      const result = await readObservedSubset(
        [resource],
        context.state,
        context.input,
        context.options,
        context.registry,
        context.lock
      );
      recoveredObserved.push(...(result.resources || []));
      recoveredMissing.push(...(result.missingResources || []));
    } catch (error) {
      journal = recordDeferredRecoveryReadFailure(journal, resource, error, context);
      // Only the exact reviewed incomplete staged operation is deferred to reconciliation.
    }
  }
  return {
    observed: {
      missingResources: (ordinaryObserved.missingResources || []).concat(recoveredMissing),
      resources: (ordinaryObserved.resources || []).concat(recoveredObserved),
    },
    journal,
  };
}

function recordDeferredRecoveryReadFailure(journal, resource, error, context) {
  if (!journal || !journal.operations) {
    return journal;
  }
  const id = resourceId(resource);
  const operation = journal.operations[id];
  if (!operation) {
    return journal;
  }
  const suppressedErrors = Array.isArray(operation.suppressedErrors)
    ? operation.suppressedErrors.slice(-(MAX_SUPPRESSED_OPERATION_ERRORS - 1))
    : [];
  const nextOperation = {
    ...operation,
    suppressedErrors: suppressedErrors.concat(createDeferredRecoveryReadDiagnostic(resource, error)),
  };
  try {
    return persistJournalOperation(journal, nextOperation, context);
  } catch {
    try {
      return updateJournalOperation(journal, nextOperation, {
        environment: context.input.environment,
        registry: context.registry,
      });
    } catch {
      return journal;
    }
  }
}

function createDeferredRecoveryReadDiagnostic(resource, error) {
  const diagnostic = {
    code: 'SCHEMA_DEFERRED_RECOVERY_READ_FAILED',
    phase: 'deferred_recovery_observed_read',
    resourceType: resource.resourceType,
    key: resource.key,
  };
  const errorCode = safeErrorCode(error);
  if (errorCode) {
    diagnostic.errorCode = errorCode;
  }
  const adapterCode = safeAdapterCode(error);
  if (adapterCode) {
    diagnostic.adapterCode = adapterCode;
  }
  const errorName = safeErrorName(error);
  if (errorName) {
    diagnostic.errorName = errorName;
  }
  return diagnostic;
}

function safeErrorCode(error) {
  const code = error && error.code;
  return typeof code === 'string' && /^[A-Z0-9_:-]{1,120}$/.test(code) ? code : undefined;
}

function safeAdapterCode(error) {
  const code = error && error.details && error.details.adapterCode;
  return typeof code === 'string' && /^[A-Z0-9_:-]{1,120}$/.test(code) ? code : undefined;
}

function safeErrorName(error) {
  const name = (error && error.name) || (error && error.constructor && error.constructor.name);
  return typeof name === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(name) ? name : undefined;
}

function assertPlanExecutable(plan, options = {}) {
  const deferredResourceIds = options.deferredResourceIds || new Set();
  const blocking = plan.changes.filter(change => (
    BLOCKING_OPERATIONS.has(change.operation) &&
    !deferredResourceIds.has(`${change.resourceType}:${change.key}`)
  ));
  if (blocking.length > 0) {
    throw schemaError('SCHEMA_APPLY_BLOCKED', 'Schema apply plan contains blocked changes.', {
      details: {
        operation: blocking[0].operation,
        resourceType: blocking[0].resourceType,
        key: blocking[0].key,
      },
    });
  }
}

function validateJournalBeforeObserved(context) {
  if (!context.journal) {
    return new Map();
  }
  if (!journalMatchesReviewedInput(context.journal, context.input)) {
    if (!journalIsFullyCheckpointed(context.journal, context.state)) {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A previous schema apply requires reconciliation.');
    }
    return new Map();
  }
  return validateJournalOperationsAgainstDesired(
    context.journal,
    context.desiredResources
  );
}

function validateJournalOperationsAgainstDesired(journal, desiredResources) {
  const resourcesById = new Map(desiredResources.map(resource => [resourceId(resource), resource]));
  for (const id of Object.keys(journal.operations).sort(compareCodePoints)) {
    const operation = journal.operations[id];
    const resource = resourcesById.get(id);
    if (!resource || operation.desiredHash !== desiredHash(resource)) {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A previous schema apply requires reconciliation.');
    }
  }
  return new Map(Object.keys(journal.operations).sort(compareCodePoints).map(id => [
    id,
    {
      operation: journal.operations[id],
      resource: resourcesById.get(id),
    },
  ]));
}

function getIncompleteStagedOperations(reviewedJournalOperations, registry) {
  const result = new Map();
  for (const [id, entry] of reviewedJournalOperations.entries()) {
    const adapter = registry.get(entry.resource.resourceType);
    if (entry.operation.status !== 'completed' && isStagedRemoteOperation(entry.operation, adapter)) {
      result.set(id, entry);
    }
  }
  return result;
}

async function collectInternalStagedRecoveryEvidence(context) {
  const evidence = new Map();
  for (const [id, entry] of context.deferredStagedOperations.entries()) {
    const adapter = context.registry.get(entry.resource.resourceType);
    const stateResource = getResourceState(
      context.state,
      entry.resource.resourceType,
      entry.resource.key
    );
    const adapterContext = {
      ...createAdapterContext(context.input, context.options, context.state),
      resource: entry.resource,
      stateResource,
    };
    const decision = await collectAdapterRecoveryEvidence(
      adapter,
      entry.operation,
      adapterContext,
      context
    );
    evidence.set(id, decision);
  }
  return evidence;
}

function journalMatchesReviewedInput(journal, input) {
  return !!(
    journal &&
    journal.planId === input.expectedPlanId &&
    journal.manifestHash === input.manifestHash
  );
}

async function prepareJournalForPlan(context) {
  let journal = context.journal;
  let state = context.state;
  let recoveredRemote = false;
  if (journal && (journal.planId !== context.input.expectedPlanId || journal.manifestHash !== context.desiredResult.manifestHash)) {
    if (!journalIsFullyCheckpointed(journal, state)) {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A previous schema apply requires reconciliation.');
    }
    journal = null;
  }

  if (!journal) {
    journal = createApplyJournal({
      environment: context.input.environment,
      manifestHash: context.desiredResult.manifestHash,
      planId: context.plan.planId,
      registry: context.registry,
    });
    assertApplyLockHandleOwned(context.lock);
    writeApplyJournalAtomic(context.paths.journalPath, journal, {
      environment: context.input.environment,
      fsImpl: context.options.fsImpl,
      registry: context.registry,
      workspaceRoot: context.input.workspaceRoot,
    });
    assertApplyLockHandleOwned(context.lock);
    return { journal, recoveredRemote, state };
  }

  const resourcesById = validateJournalOperationsAgainstDesired(journal, context.desiredResources);
  for (const id of Object.keys(journal.operations).sort(compareCodePoints)) {
    const operation = journal.operations[id];
    const resource = resourcesById.get(id).resource;
    const adapter = context.registry.get(resource.resourceType);
    if (isStagedRemoteOperation(operation, adapter) && operation.status !== 'completed') {
      if (!context.internalStagedRecoveryEvidence.has(id)) {
        throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A staged schema operation requires reconciliation evidence.');
      }
      context.journal = journal;
      const recovered = await reconcileStagedOperation(
        operation,
        resource,
        state,
        context,
        context.internalStagedRecoveryEvidence.get(id)
      );
      journal = recovered.journal;
      state = recovered.state;
      recoveredRemote = true;
      continue;
    }
    if (operation.status === 'uncertain' && isResumableCreateIdentityOperation(operation, adapter)) {
      context.journal = journal;
      const recovered = await resumeCreateIdentityOperation(operation, resource, state, context);
      journal = recovered.journal;
      state = recovered.state;
      recoveredRemote = recoveredRemote || recovered.remoteWork === true;
      continue;
    }
    if (operation.status === 'uncertain') {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A previous schema apply requires reconciliation.');
    }
    if (operation.status === 'completed') {
      if (!stateMatchesCheckpoint(state, operation)) {
        const recovered = await recoverCompletedOperation(operation, resource, state, context);
        state = recovered.state;
      }
      continue;
    }
    if (operation.status === 'pending') {
      context.journal = journal;
      const recovered = isResumableCreateIdentityOperation(operation, adapter)
        ? await resumeCreateIdentityOperation(operation, resource, state, context)
        : await reconcilePendingOperation(operation, resource, state, context);
      journal = recovered.journal;
      state = recovered.state;
      recoveredRemote = recoveredRemote || recovered.remoteWork === true;
    }
  }
  return { journal, recoveredRemote, state };
}

function isResumableCreateIdentityOperation(operation, adapter) {
  return !!(
    operation &&
    operation.operation === 'create' &&
    operation.createIdentity !== undefined &&
    adapter &&
    typeof adapter.resumeCreate === 'function'
  );
}

function canResumeReviewedJournal(journal, expectedPlanId, manifestHash) {
  if (!journal || journal.planId !== expectedPlanId || journal.manifestHash !== manifestHash) {
    return false;
  }
  const operations = Object.values(journal.operations || {});
  return operations.length > 0;
}

async function recoverCompletedOperation(operation, resource, state, context) {
  const stateResource = operation.checkpoint;
  const observed = await readAndProjectResource(
    resource,
    stateResource,
    state,
    context.input,
    context.options,
    context.registry,
    context.lock
  );
  const adapter = context.registry.get(resource.resourceType);
  await adapter.verify(observed.projection, {
    ...createAdapterContext(context.input, context.options, state),
    resource,
    recovery: 'completed',
    operation: operation.operation,
    expectedRemoteSchemaHash: stateResource.remoteSchemaHash,
    stateResource,
  });
  return checkpointState(resource, observed.projection, state, context);
}

async function reconcilePendingOperation(operation, resource, state, context) {
  const stateResource = getResourceState(state, resource.resourceType, resource.key);
  if (!stateResource) {
    const uncertain = { ...operation, status: 'uncertain' };
    persistJournalOperation(context.journal, uncertain, context);
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A pending create operation cannot be identified without bindings.');
  }

  let observed;
  try {
    observed = await readAndProjectResource(
      resource,
      stateResource,
      state,
      context.input,
      context.options,
      context.registry,
      context.lock
    );
    const adapter = context.registry.get(resource.resourceType);
    await adapter.verify(observed.projection, {
      ...createAdapterContext(context.input, context.options, state),
      operation: operation.operation,
      recovery: 'pending',
      resource,
      stateResource,
    });
  } catch (error) {
    const uncertain = { ...operation, status: 'uncertain' };
    persistJournalOperation(context.journal, uncertain, context);
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A pending schema operation could not be reconciled.');
  }

  const checkpoint = buildCheckpoint(resource, observed.projection);
  const completed = { ...operation, status: 'completed', checkpoint };
  const journal = persistJournalOperation(context.journal, completed, context);
  const checkpointed = checkpointState(resource, observed.projection, state, context);
  return { journal, state: checkpointed.state };
}

async function resumeCreateIdentityOperation(operation, resource, state, context) {
  const adapter = context.registry.get(resource.resourceType);
  if (
    typeof adapter.resumeCreate !== 'function' ||
    getResourceState(state, resource.resourceType, resource.key)
  ) {
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'A create operation cannot be resumed safely.');
  }
  const journal = assertCreateOperationCurrent(operation, context.journal, state, context);
  const adapterContext = {
    ...createAdapterContext(context.input, context.options, state),
    resource,
    stateResource: null,
  };
  const prepared = await prepareAdapterOperation(adapter, {
    operation: 'create',
    resource,
    stateResource: null,
    recovery: { createIdentity: clonePlain(operation.createIdentity) },
  }, adapterContext, context);

  let result;
  try {
    assertCreateOperationCurrent(operation, journal, state, context);
    assertRemoteDispatchBoundary(context, 'before');
    result = await adapter.resumeCreate(
      resource.desired,
      clonePlain(operation.createIdentity),
      {
        ...adapterContext,
        assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary(context, phase),
        operationId: operation.operationId,
        prepared,
        recovery: 'createIdentity',
      }
    );
    assertRemoteDispatchBoundary(context, 'after');
  } catch (error) {
    rethrowApplyLockBoundaryFailure(error);
    if (isServerRevisionConflict(error)) {
      throw error;
    }
    const uncertain = { ...operation, status: 'uncertain' };
    persistJournalOperation(journal, uncertain, context);
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Schema create resume result is uncertain.');
  }

  const finalized = await finalizeOrdinaryResult({
    adapter,
    adapterContext: { ...adapterContext, recovery: 'createIdentity' },
    context: { ...context, journal, resource, state },
    journal,
    operation: 'create',
    operationRecord: operation,
    prepared,
    result,
  });
  return { ...finalized, remoteWork: finalized.usedOperationResultProjection !== true };
}

async function reconcileStagedOperation(operation, resource, state, context, decision) {
  const adapter = context.registry.get(resource.resourceType);
  const stateResource = getResourceState(state, resource.resourceType, resource.key);
  const operationContext = { ...context, resource, state };
  const adapterContext = {
    ...createAdapterContext(context.input, context.options, state),
    resource,
    stateResource,
  };
  const controller = createStageController(operation, context.journal, operationContext, adapter);
  controller.markPending();
  const prepared = await prepareAdapterOperation(adapter, {
    operation: operation.operation,
    resource,
    stateResource,
    recovery: { stageCheckpoint: controller.getStageCheckpoint() },
  }, adapterContext, operationContext);

  if (decision.action === 'complete') {
    controller.advanceReconciledRemoteComplete();
    return finalizeStagedWithRecovery({
      adapter,
      adapterContext,
      context: operationContext,
      controller,
      result: decision.result,
      allowReconciliation: false,
    });
  }

  return executeStagedWrite({
    adapter,
    adapterContext,
    context: operationContext,
    controller,
    currentStateResource: stateResource,
    jitObserved: undefined,
    operation: operation.operation,
    prepared,
    allowReconciliation: false,
    recovery: true,
  });
}

async function executeStagedWrite(runtime) {
  let result;
  try {
    const writeContext = {
      ...runtime.adapterContext,
      assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary(runtime.context, phase),
      checkpointStage: runtime.controller.checkpointAdapterStage,
      prepared: runtime.prepared,
    };
    if (runtime.recovery) {
      writeContext.recovery = {
        stageCheckpoint: runtime.controller.getStageCheckpoint(),
      };
    }
    assertRemoteDispatchBoundary(runtime.context, 'before');
    result = runtime.operation === 'create'
      ? await runtime.adapter.create(runtime.context.resource.desired, writeContext)
      : await runtime.adapter.update(
        runtime.context.resource.desired,
        runtime.jitObserved && runtime.jitObserved.raw,
        runtime.currentStateResource,
        writeContext
      );
    assertRemoteDispatchBoundary(runtime.context, 'after');
  } catch (error) {
    rethrowApplyLockBoundaryFailure(error);
    runtime.controller.markUncertain();
    if (error && error.code === 'SCHEMA_APPLY_JOURNAL_INVALID') {
      throw error;
    }
    if (!runtime.allowReconciliation) {
      reconciliationRequired();
    }
    const decision = await collectAdapterRecoveryEvidence(
      runtime.adapter,
      runtime.controller.getOperation(),
      runtime.adapterContext,
      runtime.context
    );
    return continueAfterStagedReconciliation(runtime, decision);
  }

  if (!runtime.controller.isRemoteComplete()) {
    runtime.controller.markUncertain();
    if (!runtime.allowReconciliation) {
      reconciliationRequired();
    }
    const decision = await collectAdapterRecoveryEvidence(
      runtime.adapter,
      runtime.controller.getOperation(),
      runtime.adapterContext,
      runtime.context
    );
    return continueAfterStagedReconciliation(runtime, decision);
  }

  return finalizeStagedWithRecovery({
    adapter: runtime.adapter,
    adapterContext: runtime.adapterContext,
    context: runtime.context,
    controller: runtime.controller,
    result,
    allowReconciliation: runtime.allowReconciliation,
  });
}

async function continueAfterStagedReconciliation(runtime, decision) {
  runtime.controller.markPending();
  if (decision.action === 'complete') {
    runtime.controller.advanceReconciledRemoteComplete();
    return finalizeStagedWithRecovery({
      adapter: runtime.adapter,
      adapterContext: runtime.adapterContext,
      context: runtime.context,
      controller: runtime.controller,
      result: decision.result,
      allowReconciliation: false,
    });
  }
  return executeStagedWrite({
    ...runtime,
    allowReconciliation: false,
    recovery: true,
  });
}

async function finalizeStagedWithRecovery(runtime) {
  try {
    return await finalizeStagedResult(runtime);
  } catch (error) {
    rethrowApplyLockBoundaryFailure(error);
    if (runtime.controller.isCompleted()) {
      throw error;
    }
    runtime.controller.markUncertain();
    if (
      error &&
      (error.code === 'SCHEMA_APPLY_VERIFY_FAILED' || error.code === 'SCHEMA_APPLY_JOURNAL_INVALID')
    ) {
      throw error;
    }
    if (!runtime.allowReconciliation) {
      reconciliationRequired();
    }
    const decision = await collectAdapterRecoveryEvidence(
      runtime.adapter,
      runtime.controller.getOperation(),
      runtime.adapterContext,
      runtime.context
    );
    if (decision.action !== 'complete') {
      reconciliationRequired();
    }
    runtime.controller.markPending();
    runtime.controller.advanceReconciledRemoteComplete();
    try {
      return await finalizeStagedResult({
        ...runtime,
        result: decision.result,
        allowReconciliation: false,
      });
    } catch (retryError) {
      rethrowApplyLockBoundaryFailure(retryError);
      if (runtime.controller.isCompleted()) {
        throw retryError;
      }
      runtime.controller.markUncertain();
      if (
        retryError &&
        (retryError.code === 'SCHEMA_APPLY_VERIFY_FAILED' || retryError.code === 'SCHEMA_APPLY_JOURNAL_INVALID')
      ) {
        throw retryError;
      }
      reconciliationRequired();
    }
  }
}

async function finalizeStagedResult(runtime) {
  const proposedBindings = runtime.adapter.buildBindings(runtime.result, {
    ...runtime.adapterContext,
    stageCheckpoint: runtime.controller.getStageCheckpoint(),
  });
  const proposedStateResource = {
    adapterVersion: runtime.adapter.adapterVersion,
    bindings: proposedBindings,
  };
  const postRead = await readAndProjectResource(
    runtime.context.resource,
    proposedStateResource,
    runtime.context.state,
    runtime.context.input,
    runtime.context.options,
    runtime.context.registry,
    runtime.context.lock
  );
  await runtime.adapter.verify(postRead.projection, {
    ...runtime.adapterContext,
    stateResource: proposedStateResource,
  });

  runtime.controller.recordReadback(postRead.projection.observedManagedHash);
  const checkpoint = buildCheckpoint(runtime.context.resource, postRead.projection);
  runtime.controller.complete(checkpoint);
  const checkpointed = checkpointState(
    runtime.context.resource,
    postRead.projection,
    runtime.context.state,
    runtime.context
  );
  return {
    journal: runtime.controller.getJournal(),
    state: checkpointed.state,
  };
}

async function collectAdapterRecoveryEvidence(adapter, operation, adapterContext, applyContext) {
  let decision;
  try {
    assertApplyLockHandleOwned(applyContext.lock);
    decision = await adapter.reconcileStaged({
      operation: clonePlain(operation),
      resource: adapterContext.resource,
      stageCheckpoint: clonePlain(operation.stageCheckpoint),
      stateResource: adapterContext.stateResource,
    }, {
      ...adapterContext,
      assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary(applyContext, phase),
    });
    assertApplyLockHandleOwned(applyContext.lock);
  } catch (error) {
    rethrowApplyLockBoundaryFailure(error);
    reconciliationRequired();
  }
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    reconciliationRequired();
  }
  const keys = Object.keys(decision).sort(compareCodePoints);
  if (decision.action === 'resume' && keys.join(',') === 'action') {
    return decision;
  }
  if (
    decision.action === 'complete' &&
    keys.join(',') === 'action,result' &&
    Object.prototype.hasOwnProperty.call(decision, 'result')
  ) {
    return decision;
  }
  reconciliationRequired();
}

function createStageController(initialOperation, initialJournal, context, adapter) {
  let operation = clonePlain(initialOperation);
  let journal = initialJournal;

  function persist(nextOperation) {
    const nextJournal = persistJournalOperation(journal, nextOperation, context);
    operation = nextOperation;
    journal = nextJournal;
  }

  function advance(event, input = {}) {
    const stageCheckpoint = adapter.advanceStagedCheckpoint(
      clonePlain(operation.stageCheckpoint),
      event,
      {
        ...input,
        desiredManagedHash: operation.desiredHash,
      }
    );
    adapter.validateStageCheckpoint(stageCheckpoint, {
      desiredManagedHash: operation.desiredHash,
    });
    if (hashStable(stageCheckpoint) === hashStable(operation.stageCheckpoint)) {
      return clonePlain(stageCheckpoint);
    }
    persist({ ...operation, stageCheckpoint });
    return clonePlain(stageCheckpoint);
  }

  return {
    checkpointAdapterStage(stage, partial = {}) {
      return advance('adapterCheckpoint', { partial, stage });
    },
    advanceReconciledRemoteComplete() {
      return advance('reconciledRemoteComplete');
    },
    complete(checkpoint) {
      const stageCheckpoint = adapter.advanceStagedCheckpoint(
        clonePlain(operation.stageCheckpoint),
        'completed',
        { desiredManagedHash: operation.desiredHash }
      );
      adapter.validateStageCheckpoint(stageCheckpoint, {
        desiredManagedHash: operation.desiredHash,
        operation: operation.operation,
        operationStatus: 'completed',
      });
      persist({
        ...operation,
        status: 'completed',
        checkpoint,
        stageCheckpoint,
      });
    },
    getJournal() {
      return journal;
    },
    getOperation() {
      return clonePlain(operation);
    },
    getStageCheckpoint() {
      return clonePlain(operation.stageCheckpoint);
    },
    isCompleted() {
      return operation.status === 'completed';
    },
    isRemoteComplete() {
      return adapter.isStagedCheckpointRemoteComplete(
        clonePlain(operation.stageCheckpoint),
        { desiredManagedHash: operation.desiredHash }
      );
    },
    markPending() {
      persist({ ...operation, status: 'pending' });
    },
    markUncertain() {
      persist({ ...operation, status: 'uncertain' });
    },
    recordReadback(observedManagedHash) {
      return advance('readbackVerified', { observedManagedHash });
    },
  };
}

function createCreateIdentityController(initialOperation, initialJournal, runtime) {
  let operation = clonePlain(initialOperation);
  let journal = initialJournal;
  let open = true;

  function checkpoint(result) {
    if (
      !open ||
      operation.operation !== 'create' ||
      operation.status !== 'pending' ||
      operation.createIdentity !== undefined
    ) {
      throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema create identity checkpoint is no longer available.');
    }
    let diskJournal;
    try {
      diskJournal = assertCreateOperationCurrent(
        operation,
        journal,
        runtime.context.state,
        runtime.context
      );
    } catch (error) {
      markCreateIdentityBoundaryFailure(error);
      throw error;
    }
    const bindings = runtime.adapter.buildBindings(result, {
      ...runtime.adapterContext,
      identityCheckpoint: true,
    });
    const nextOperation = {
      ...operation,
      createIdentity: { bindings: clonePlain(bindings) },
    };
    try {
      journal = persistJournalOperation(diskJournal, nextOperation, runtime.context);
    } catch (error) {
      markCreateIdentityBoundaryFailure(error);
      throw error;
    }
    operation = nextOperation;
    return clonePlain(operation.createIdentity);
  }

  return {
    checkpoint,
    close() {
      open = false;
    },
    getJournal() {
      return journal;
    },
    getOperation() {
      return clonePlain(operation);
    },
    hasCheckpoint() {
      return operation.createIdentity !== undefined;
    },
  };
}

function assertCreateOperationCurrent(operation, journal, state, context) {
  assertApplyLockHandleOwned(context.lock);
  if (
    !journal ||
    journal.planId !== context.input.expectedPlanId ||
    journal.manifestHash !== context.input.manifestHash ||
    operation.stateRevision !== state.revision
  ) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema create checkpoint context is stale.');
  }
  const diskState = readState(context.input.statePath, {
    environment: context.input.environment,
    fsImpl: context.options.fsImpl,
    manifestHash: context.input.manifestHash,
    registry: context.registry,
  });
  if (diskState.revision !== state.revision) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema create checkpoint State revision is stale.');
  }
  const diskJournal = readApplyJournal(context.paths.journalPath, {
    environment: context.input.environment,
    fsImpl: context.options.fsImpl,
    registry: context.registry,
    workspaceRoot: context.input.workspaceRoot,
  });
  const id = resourceId(operation);
  const diskOperation = diskJournal && diskJournal.operations && diskJournal.operations[id];
  if (
    !diskJournal ||
    diskJournal.planId !== journal.planId ||
    diskJournal.manifestHash !== journal.manifestHash ||
    !diskOperation ||
    hashStable(diskOperation) !== hashStable(operation)
  ) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema create checkpoint operation is stale.');
  }
  assertApplyLockHandleOwned(context.lock);
  return diskJournal;
}

function isStagedRemoteOperation(operation, adapter) {
  return isStagedAdapter(adapter) && (operation.operation === 'create' || operation.operation === 'update');
}

function reconciliationRequired() {
  throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Schema staged apply requires reconciliation.');
}

function assertRemoteDispatchBoundary(context, phase) {
  try {
    assertApplyLockHandleOwned(context.lock);
  } catch (error) {
    if (phase === 'after' && error && (typeof error === 'object' || typeof error === 'function')) {
      POST_DISPATCH_LOCK_FAILURES.add(error);
    }
    throw error;
  }
}

function rethrowApplyLockBoundaryFailure(error) {
  if (!error || error.code !== 'SCHEMA_APPLY_LOCK_LOST') {
    return;
  }
  if (POST_DISPATCH_LOCK_FAILURES.has(error)) {
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Schema remote write may have completed after apply lock loss.');
  }
  throw error;
}

async function prepareAdapterOperation(adapter, input, adapterContext, applyContext) {
  if (typeof adapter.prepareOperation !== 'function') {
    return undefined;
  }
  assertApplyLockHandleOwned(applyContext.lock);
  const prepared = await adapter.prepareOperation(input, {
    ...adapterContext,
    assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary(applyContext, phase),
  });
  assertApplyLockHandleOwned(applyContext.lock);
  return prepared;
}

async function applyResourceChange(context) {
  const adapter = context.registry.get(context.resource.resourceType);
  assertApplyAdapter(adapter);
  const currentStateResource = getResourceState(context.state, context.resource.resourceType, context.resource.key);
  const operation = context.change.stateRepair ? 'stateRepair' : context.change.operation;
  let jitObserved;

  if (operation === 'create') {
    if (currentStateResource) {
      throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Create candidate received a state binding before execution.', {
        details: {
          operation,
          resourceType: context.resource.resourceType,
          key: context.resource.key,
        },
      });
    }
  } else {
    jitObserved = await readAndProjectResource(
      context.resource,
      currentStateResource,
      context.state,
      context.input,
      context.options,
      context.registry,
      context.lock
    );
    assertJitClassification(
      context.resource,
      currentStateResource,
      jitObserved.projection,
      context.change,
      context.registry,
      context.reviewedObservedIdentities
    );
  }

  const adapterContext = {
    ...createAdapterContext(context.input, context.options, context.state),
    resource: context.resource,
    stateResource: currentStateResource,
  };
  const prepared = await prepareAdapterOperation(adapter, {
    operation,
    resource: context.resource,
    stateResource: currentStateResource,
    observed: jitObserved && jitObserved.raw,
  }, adapterContext, context);

  if (operation === 'stateRepair') {
    const checkpoint = buildCheckpoint(context.resource, jitObserved.projection);
    const operationRecord = createOperationRecord(
      context.resource,
      operation,
      'completed',
      context.input.expectedPlanId,
      checkpoint,
      context.state.revision
    );
    const journal = persistJournalOperation(context.journal, operationRecord, context);
    const checkpointed = checkpointState(
      context.resource,
      jitObserved.projection,
      context.state,
      context
    );
    return { journal, state: checkpointed.state };
  }

  let operationRecord = createOperationRecord(
    context.resource,
    operation,
    'pending',
    context.input.expectedPlanId,
    undefined,
    context.state.revision
  );
  let journal = persistJournalOperation(context.journal, operationRecord, context);
  if (isStagedRemoteOperation(operationRecord, adapter)) {
    const controller = createStageController(operationRecord, journal, context, adapter);
    return executeStagedWrite({
      adapter,
      adapterContext,
      context,
      controller,
      currentStateResource,
      jitObserved,
      operation,
      prepared,
      allowReconciliation: true,
      recovery: false,
    });
  }
  let result;
  const identityController = operation === 'create' && typeof adapter.resumeCreate === 'function'
    ? createCreateIdentityController(operationRecord, journal, {
      adapter,
      adapterContext,
      context,
    })
    : null;
  try {
    const writeContext = {
      ...adapterContext,
      assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary(context, phase),
      operationId: operationRecord.operationId,
      prepared,
    };
    if (identityController) {
      writeContext.checkpointCreateIdentity = identityController.checkpoint;
    }
    assertRemoteDispatchBoundary(context, 'before');
    result = operation === 'create'
      ? await adapter.create(context.resource.desired, writeContext)
      : await adapter.update(context.resource.desired, jitObserved.raw, currentStateResource, writeContext);
    assertRemoteDispatchBoundary(context, 'after');
    if (identityController && !identityController.hasCheckpoint()) {
      throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Resumable create did not checkpoint its remote identity.');
    }
  } catch (error) {
    if (identityController) {
      operationRecord = identityController.getOperation();
      journal = identityController.getJournal();
    }
    if (CREATE_IDENTITY_BOUNDARY_FAILURES.has(error)) {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Schema create identity checkpoint requires reconciliation.');
    }
    rethrowApplyLockBoundaryFailure(error);
    if (isServerRevisionConflict(error)) {
      if (!identityController) {
        journal = persistJournalOperationRemoval(journal, operationRecord, context);
      }
      throw error;
    }
    operationRecord = { ...operationRecord, status: 'uncertain' };
    persistJournalOperation(journal, operationRecord, context);
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Schema remote write result is uncertain.');
  } finally {
    if (identityController) {
      identityController.close();
    }
  }
  if (identityController) {
    operationRecord = identityController.getOperation();
    journal = identityController.getJournal();
  }
  return finalizeOrdinaryResult({
    adapter,
    adapterContext,
    context,
    journal,
    operation,
    operationRecord,
    prepared,
    result,
  });
}

function markCreateIdentityBoundaryFailure(error) {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    CREATE_IDENTITY_BOUNDARY_FAILURES.add(error);
  }
}

async function finalizeOrdinaryResult(runtime) {
  let projection;
  let usedOperationResultProjection = false;
  try {
    const proposedBindings = runtime.adapter.buildBindings(runtime.result, runtime.adapterContext);
    const proposedStateResource = {
      adapterVersion: runtime.adapter.adapterVersion,
      bindings: proposedBindings,
    };
    const verificationContext = {
      ...runtime.adapterContext,
      operation: runtime.operation,
      operationResult: runtime.result,
      prepared: runtime.prepared,
      stateResource: proposedStateResource,
    };
    projection = await projectOperationResult(runtime, proposedStateResource, verificationContext);
    if (!projection) {
      const postRead = await readPostWriteResource(runtime, proposedStateResource);
      projection = postRead.projection;
    } else {
      usedOperationResultProjection = true;
    }
    await runtime.adapter.verify(projection, verificationContext);
  } catch (error) {
    rethrowApplyLockBoundaryFailure(error);
    const uncertain = { ...runtime.operationRecord, status: 'uncertain' };
    persistJournalOperation(runtime.journal, uncertain, runtime.context);
    if (error && error.code === 'SCHEMA_APPLY_VERIFY_FAILED') {
      throw error;
    }
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Schema post-write verification is uncertain.');
  }

  const checkpoint = buildCheckpoint(runtime.context.resource, projection);
  const completed = { ...runtime.operationRecord, status: 'completed', checkpoint };
  const journal = persistJournalOperation(runtime.journal, completed, runtime.context);
  const checkpointed = checkpointState(
    runtime.context.resource,
    projection,
    runtime.context.state,
    runtime.context
  );
  return { journal, state: checkpointed.state, usedOperationResultProjection };
}

async function projectOperationResult(runtime, proposedStateResource, verificationContext) {
  if (!runtime.adapter || typeof runtime.adapter.projectOperationResult !== 'function') {
    return null;
  }
  const projection = await runtime.adapter.projectOperationResult(
    runtime.result,
    proposedStateResource,
    verificationContext
  );
  if (!projection) {
    return null;
  }
  return attachObservedManagedHash(
    runtime.context.resource,
    projection,
    runtime.adapter.adapterVersion
  );
}

async function readPostWriteResource(runtime, proposedStateResource) {
  const retry = postWriteReadbackRetry(runtime, proposedStateResource);
  if (!retry) {
    return readPostWriteResourceOnce(runtime, proposedStateResource);
  }

  let lastError;
  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      return await readPostWriteResourceOnce(runtime, proposedStateResource);
    } catch (error) {
      if (!retry.shouldRetry(error, runtime) || attempt === retry.maxAttempts) {
        throw error;
      }
      lastError = error;
      assertApplyLockHandleOwned(runtime.context.lock);
      await waitForPostWriteReadback(retry.delayMs);
      assertApplyLockHandleOwned(runtime.context.lock);
    }
  }
  throw lastError;
}

function readPostWriteResourceOnce(runtime, proposedStateResource) {
  return readAndProjectResource(
    runtime.context.resource,
    proposedStateResource,
    runtime.context.state,
    runtime.context.input,
    runtime.context.options,
    runtime.context.registry,
    runtime.context.lock
  );
}

function postWriteReadbackRetry(runtime, proposedStateResource) {
  if (shouldWaitForFormPostWriteReadback(runtime, proposedStateResource)) {
    return {
      ...formPostWriteReadbackRetryOptions(runtime.context.options),
      shouldRetry: isFormPostWriteReadbackReadFailure,
    };
  }
  return null;
}

function shouldWaitForFormPostWriteReadback(runtime, proposedStateResource) {
  const resource = runtime && runtime.context && runtime.context.resource;
  const bindings = proposedStateResource && proposedStateResource.bindings || {};
  return !!(
    runtime &&
    resource &&
    resource.resourceType === 'form' &&
    typeof bindings.appType === 'string' &&
    bindings.appType &&
    typeof bindings.formUuid === 'string' &&
    bindings.formUuid
  );
}

function isFormPostWriteReadbackReadFailure(error, runtime) {
  const resource = runtime && runtime.context && runtime.context.resource;
  return !!(
    error &&
    error.code === 'SCHEMA_REMOTE_READ_FAILED' &&
    error.details &&
    resource &&
    error.details.resourceType === 'form' &&
    error.details.key === resource.key
  );
}

function formPostWriteReadbackRetryOptions(options = {}) {
  const config = options.formPostWriteReadbackRetry || {};
  return {
    maxAttempts: positiveIntegerOrDefault(
      config.maxAttempts,
      FORM_POST_WRITE_READBACK_MAX_ATTEMPTS
    ),
    delayMs: nonNegativeIntegerOrDefault(
      config.delayMs,
      FORM_POST_WRITE_READBACK_DELAY_MS
    ),
  };
}

function positiveIntegerOrDefault(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeIntegerOrDefault(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function waitForPostWriteReadback(delayMs) {
  if (delayMs === 0) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function assertJitClassification(
  resource,
  stateResource,
  projection,
  originalChange,
  registry,
  reviewedObservedIdentities
) {
  const reviewedIdentity = reviewedObservedIdentities && reviewedObservedIdentities.get(resourceId(resource));
  const jitIdentity = createObservedReviewIdentity({
    resourceType: resource.resourceType,
    key: resource.key,
    adapterVersion: resource.adapterVersion,
    managed: projection.managed,
    observedManagedHash: projection.observedManagedHash,
    observedDraftCount: projection.observedDraftCount,
    observedDraftHash: projection.observedDraftHash,
    observedIdentityHash: projection.observedIdentityHash,
    observedIdentityMatchesBindings: projection.observedIdentityMatchesBindings,
    remoteSchemaHash: projection.remoteSchemaHash,
  });
  if (!reviewedIdentity || reviewedIdentity !== jitIdentity) {
    throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Resource changed after the reviewed plan.', {
      details: {
        resourceType: resource.resourceType,
        key: resource.key,
      },
    });
  }
  const isolatedState = {
    kind: 'openyida_resource_state',
    contractVersion: 1,
    revision: 0,
    environment: {
      environmentKey: hashStable('jit-environment'),
      corpIdHash: hashStable('jit-corp'),
    },
    resources: {
      [resource.resourceType]: {
        [resource.key]: stateResource,
      },
    },
  };
  const plan = createPlan({
    desiredResources: [resource],
    manifestHash: hashStable({ resource: resourceId(resource) }),
    observedResources: [{
      resourceType: resource.resourceType,
      key: resource.key,
      adapterVersion: resource.adapterVersion,
      managed: projection.managed,
      observedDraftCount: projection.observedDraftCount,
      observedDraftHash: projection.observedDraftHash,
      observedIdentityHash: projection.observedIdentityHash,
      observedIdentityMatchesBindings: projection.observedIdentityMatchesBindings,
      remoteSchemaHash: projection.remoteSchemaHash,
    }],
    state: isolatedState,
  }, { registry });
  const current = plan.changes[0];
  const matches = originalChange.stateRepair
    ? current && current.operation === 'noop' && current.stateRepair === true
    : current && current.operation === originalChange.operation;
  if (!matches) {
    throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Resource changed after the reviewed plan.', {
      details: {
        operation: current && current.operation,
        resourceType: resource.resourceType,
        key: resource.key,
      },
    });
  }
}

function indexObservedReviewIdentities(resources) {
  const result = new Map();
  for (const resource of Array.isArray(resources) ? resources : []) {
    result.set(resourceId(resource), createObservedReviewIdentity(resource));
  }
  return result;
}

function createObservedReviewIdentity(resource) {
  const observedManagedHash = resource.observedManagedHash || hashObservedManaged({
    resourceType: resource.resourceType,
    key: resource.key,
    adapterVersion: resource.adapterVersion,
    managed: resource.managed || {},
  });
  const identity = {
    adapterVersion: resource.adapterVersion,
    key: resource.key,
    observedManagedHash,
    resourceType: resource.resourceType,
  };
  if (resource.remoteSchemaHash !== undefined) {
    if (!isSha256(resource.remoteSchemaHash)) {
      throw schemaError('SCHEMA_INTERNAL_ERROR', 'Observed resource remoteSchemaHash must be a SHA-256 hash.');
    }
    identity.remoteSchemaHash = resource.remoteSchemaHash;
  }
  for (const property of [
    'observedDraftCount',
    'observedDraftHash',
    'observedIdentityHash',
    'observedIdentityMatchesBindings',
  ]) {
    if (resource[property] !== undefined) {
      identity[property] = resource[property];
    }
  }
  return hashStable(identity);
}

async function readAndProjectResource(resource, stateResource, state, input, options, registry, lock) {
  if (!stateResource) {
    throw schemaError('SCHEMA_STATE_RESOURCE_BINDING_MISSING', 'State resource binding is missing.', {
      details: { resourceType: resource.resourceType, key: resource.key },
    });
  }
  const adapter = registry.get(resource.resourceType);
  const adapterContext = {
    ...createAdapterContext(input, options, state),
    assertRemoteDispatchBoundary: phase => assertRemoteDispatchBoundary({ lock }, phase),
    resource,
    stateResource,
  };
  let raw;
  try {
    assertApplyLockHandleOwned(lock);
    raw = await adapter.readObserved(stateResource, adapterContext);
    assertApplyLockHandleOwned(lock);
  } catch (error) {
    if (isRemoteMissingError(error)) {
      throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Bound remote resource is missing.', {
        details: { resourceType: resource.resourceType, key: resource.key },
      });
    }
    if (error && error.code === 'SCHEMA_REMOTE_RESOURCE_MISSING') {
      throw schemaError('SCHEMA_REMOTE_READ_FAILED', 'Remote observed read failed.', {
        details: { resourceType: resource.resourceType, key: resource.key },
      });
    }
    if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
      throw error;
    }
    throw schemaError('SCHEMA_REMOTE_READ_FAILED', 'Remote observed read failed.', {
      details: { resourceType: resource.resourceType, key: resource.key },
    });
  }
  let projection;
  try {
    projection = adapter.projectObserved(raw, stateResource, adapterContext);
  } catch (error) {
    if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
      throw error;
    }
    throw schemaError('SCHEMA_REMOTE_PROJECT_FAILED', 'Remote observed projection failed.', {
      details: { resourceType: resource.resourceType, key: resource.key },
    });
  }
  attachObservedManagedHash(resource, projection, adapter.adapterVersion);
  return { raw, projection };
}

function attachObservedManagedHash(resource, projection, adapterVersion) {
  projection.observedManagedHash = projection.observedManagedHash || hashObservedManaged({
    resourceType: resource.resourceType,
    key: resource.key,
    adapterVersion,
    managed: projection.managed || {},
  });
  return projection;
}

function checkpointState(resource, projection, state, context) {
  assertApplyLockHandleOwned(context.lock);
  const checkpoint = buildCheckpoint(resource, projection);
  let nextState = upsertResourceState(state, {
    resourceType: resource.resourceType,
    key: resource.key,
    ...checkpoint,
  }, { registry: context.registry });
  nextState.manifestHash = context.input.manifestHash || state.manifestHash;
  assertSafeApplyPath(context.input.statePath, context.input.workspaceRoot, {
    fsImpl: context.options.fsImpl,
  });
  assertApplyLockHandleOwned(context.lock);
  nextState = writeStateAtomic(context.input.statePath, nextState, {
    environment: context.input.environment,
    fsImpl: context.options.fsImpl,
    registry: context.registry,
  });
  assertApplyLockHandleOwned(context.lock);
  return { checkpoint, state: nextState };
}

function buildCheckpoint(resource, projection) {
  const checkpoint = {
    adapterVersion: resource.adapterVersion,
    bindings: clonePlain(projection.bindings || {}),
    lastAppliedHash: hashStable(resource.desired || {}),
    observedManagedHash: projection.observedManagedHash,
    lastApplied: clonePlain(resource.desired || {}),
  };
  if (projection.remoteSchemaHash) {
    checkpoint.remoteSchemaHash = projection.remoteSchemaHash;
  }
  return checkpoint;
}

function createOperationRecord(resource, operation, status, planId, checkpoint, stateRevision) {
  const record = {
    operationId: createApplyOperationId({
      planId,
      resourceType: resource.resourceType,
      key: resource.key,
      operation,
    }),
    resourceType: resource.resourceType,
    key: resource.key,
    operation,
    adapterVersion: resource.adapterVersion,
    desiredHash: desiredHash(resource),
    status,
  };
  if (stateRevision !== undefined) {
    record.stateRevision = stateRevision;
  }
  if (checkpoint) {
    record.checkpoint = checkpoint;
  }
  return record;
}

function persistJournalOperation(journal, operation, context) {
  assertApplyLockHandleOwned(context.lock);
  const next = updateJournalOperation(journal, operation, {
    environment: context.input.environment,
    registry: context.registry,
  });
  writeApplyJournalAtomic(context.paths.journalPath, next, {
    environment: context.input.environment,
    fsImpl: context.options.fsImpl,
    registry: context.registry,
    workspaceRoot: context.input.workspaceRoot,
  });
  assertApplyLockHandleOwned(context.lock);
  return next;
}

function persistJournalOperationRemoval(journal, operation, context) {
  assertApplyLockHandleOwned(context.lock);
  const next = removeJournalOperation(journal, operation, {
    environment: context.input.environment,
    registry: context.registry,
  });
  writeApplyJournalAtomic(context.paths.journalPath, next, {
    environment: context.input.environment,
    fsImpl: context.options.fsImpl,
    registry: context.registry,
    workspaceRoot: context.input.workspaceRoot,
  });
  assertApplyLockHandleOwned(context.lock);
  return next;
}

function stateMatchesCheckpoint(state, operation) {
  const entry = getResourceState(state, operation.resourceType, operation.key);
  return !!(
    entry &&
    operation.checkpoint &&
    entry.adapterVersion === operation.checkpoint.adapterVersion &&
    entry.lastAppliedHash === operation.checkpoint.lastAppliedHash
  );
}

function stateAlreadyCheckpointed(resource, state) {
  const entry = getResourceState(state, resource.resourceType, resource.key);
  return !!(
    entry &&
    entry.adapterVersion === resource.adapterVersion &&
    entry.lastAppliedHash === hashStable(resource.desired || {})
  );
}

function journalIsFullyCheckpointed(journal, state) {
  return Object.values(journal.operations || {}).every(operation => (
    operation.status === 'completed' && stateMatchesCheckpoint(state, operation)
  ));
}

function desiredHash(resource) {
  return hashManagedIdentity({
    adapterVersion: resource.adapterVersion,
    managed: resource.desired || {},
    resourceType: resource.resourceType,
    key: resource.key,
  });
}

function createAdapterContext(input, options, state) {
  return {
    authRef: input.authRef,
    environment: input.environment,
    formPostWriteReadbackRetry: formPostWriteReadbackRetryOptions(options),
    fsImpl: options.fsImpl,
    services: options.services || {},
    state,
    workspaceRoot: input.workspaceRoot,
  };
}

function assertApplyAdapter(adapter) {
  for (const method of [
    'readObserved',
    'projectObserved',
    'create',
    'update',
    'verify',
    'buildBindings',
  ]) {
    if (typeof adapter[method] !== 'function') {
      throw schemaError('SCHEMA_RESOURCE_TYPE_UNSUPPORTED', 'Resource adapter does not support schema apply.', {
        details: { resourceType: adapter.resourceType },
      });
    }
  }
}

function assertApplyAdapters(resources, registry, context = {}) {
  const entries = (resources || []).map(resource => ({
    adapter: registry.get(resource.resourceType),
    resource,
  }));
  for (const entry of entries) {
    assertApplyAdapter(entry.adapter);
  }
  for (const entry of entries) {
    if (typeof entry.adapter.preflightApply === 'function') {
      entry.adapter.preflightApply(entry.resource, context);
    }
  }
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = {
  APPLY_CONTRACT_VERSION,
  APPLY_KIND,
  applySchema,
};
