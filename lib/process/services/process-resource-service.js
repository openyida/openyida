'use strict';

const { isDeepStrictEqual } = require('util');
const {
  compileProcessDefinition,
  validateManagedNodeBindings,
} = require('./process-compiler');
const { projectProcessManaged, readProcessDefinition } = require('./process-reader');
const { readFormMode } = require('../../app/services/form-mode-service');
const {
  newDraftProcess,
  publishProcessById,
  queryProcessVersions,
  saveProcessById,
} = require('./process-service');
const { hasRemoteDispatchBoundary } = require('../../schema/remote-dispatch-boundary');
const { isTokenAuthRef } = require('../../core/yida-client');

const VERSION_PAGE_SIZE = 10;
const MAX_VERSION_ROWS = 1000;
const VERSION_STATUSES = new Set(['PUBLISHED', 'SAVED', 'INVALID']);

class ProcessResourceServiceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ProcessResourceServiceError';
    this.code = code;
    this.details = details;
  }
}

async function readProcessVersionSnapshot(context, input) {
  if (!isNonEmptyString(input && input.appType) || !isNonEmptyString(input && input.processCode)) {
    throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
  }
  const query = resolveService(context, 'queryProcessVersions', queryProcessVersions);
  const rows = [];
  let totalCount;
  let totalPages = 1;

  // The API is ordered by modification time; only status identifies the active version.
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    let result;
    try {
      assertRemoteDispatchBoundary(context, 'before');
      const queryOptions = { pageIndex, pageSize: VERSION_PAGE_SIZE };
      if (query === queryProcessVersions) {
        queryOptions.oneShot = true;
      }
      result = await query(
        resolveAuthRef(context),
        input.appType,
        input.processCode,
        '',
        queryOptions
      );
      assertRemoteDispatchBoundary(context, 'after');
    } catch (error) {
      rethrowApplyBoundaryFailure(error);
      throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
    }
    const content = result && result.success === true && result.content;
    const currentPage = normalizeCount(content && content.currentPage);
    const responseTotalCount = normalizeCount(content && content.totalCount);
    const pageRows = content && content.data;
    if (
      !Array.isArray(pageRows) ||
      currentPage !== pageIndex ||
      responseTotalCount === null ||
      responseTotalCount < 1 ||
      responseTotalCount > MAX_VERSION_ROWS ||
      pageRows.length === 0 ||
      pageRows.length > VERSION_PAGE_SIZE
    ) {
      throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
    }
    if (pageIndex === 1) {
      totalCount = responseTotalCount;
      totalPages = Math.ceil(totalCount / VERSION_PAGE_SIZE);
    } else if (responseTotalCount !== totalCount) {
      throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
    }
    rows.push(...pageRows);
  }

  if (rows.length !== totalCount) {
    throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
  }

  const normalizedRows = rows.map(row => normalizeVersionRow(row, input.processCode));
  if (normalizedRows.some(row => row === null)) {
    throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
  }
  const processIds = new Set();
  const versions = new Set();
  for (const row of normalizedRows) {
    if (processIds.has(row.processId) || versions.has(row.processVersion)) {
      throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
    }
    processIds.add(row.processId);
    versions.add(row.processVersion);
  }
  normalizedRows.sort(compareVersionRows);
  const published = normalizedRows.filter(row => row.status === 'PUBLISHED');
  if (published.length !== 1) {
    throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
  }
  return {
    active: published[0],
    drafts: normalizedRows.filter(row => row.status === 'SAVED'),
    rows: normalizedRows,
  };
}

async function prepareProcessResource(context, input) {
  assertProcessWriteReady(context);
  const recovery = input && input.recovery && input.recovery.stageCheckpoint;
  if (recovery && !hasCompleteCheckpointIdentity(recovery, input)) {
    throw resourceError('PROCESS_RESOURCE_RECONCILIATION_REQUIRED', 'checkpoint_validate');
  }
  const identity = recovery
    ? identityFromCheckpoint(recovery, input)
    : await resolveNextProcessIdentity(context, input);
  const existingBindings = recovery && recovery.nodeBindings || input.existingBindings || {};
  let compiled;
  try {
    compiled = compileProcessDefinition(input.desired, {
      appType: identity.appType,
      baseUrl: input.baseUrl,
      existingBindings,
      formUuid: identity.formUuid,
      processCode: identity.processCode,
    });
  } catch {
    throw resourceError('PROCESS_RESOURCE_COMPILE_FAILED', 'compile');
  }
  return {
    ...identity,
    compiled,
  };
}

function assertProcessWriteReady(context) {
  if (!hasRemoteDispatchBoundary(context) || hasInjectedProcessWriter(context)) {
    return;
  }
  const authRef = resolveAuthRef(context);
  if (!authRef || typeof authRef.baseUrl !== 'string' || !authRef.baseUrl) {
    throw resourceError('PROCESS_RESOURCE_WRITE_PRECHECK_FAILED', 'write_precheck');
  }
  if (isTokenAuthRef(authRef)) {
    return;
  }
  if (
    typeof authRef.csrfToken !== 'string' || !authRef.csrfToken ||
    !Array.isArray(authRef.cookies)
  ) {
    throw resourceError('PROCESS_RESOURCE_WRITE_PRECHECK_FAILED', 'write_precheck');
  }
}

function hasInjectedProcessWriter(context) {
  const services = context && context.services || {};
  return ['newDraftProcess', 'saveProcessById', 'publishProcessById'].every(name => (
    typeof services[name] === 'function'
  ));
}

async function applyProcessResource(context, input) {
  const prepared = input && input.prepared;
  const checkpoint = input && input.recovery && input.recovery.stageCheckpoint;
  if (!prepared || !prepared.compiled || typeof context.checkpointStage !== 'function') {
    throw resourceError('PROCESS_RESOURCE_WRITE_FAILED', 'prepare');
  }

  let processId = checkpoint && checkpoint.processId;
  const processVersion = checkpoint && checkpoint.processVersion !== undefined
    ? checkpoint.processVersion
    : prepared.processVersion;
  let stage = checkpoint && checkpoint.stage;

  if (!stage) {
    const createDraft = resolveService(context, 'newDraftProcess', newDraftProcess);
    let result;
    try {
      assertRemoteDispatchBoundary(context, 'before');
      const oneShotOptions = createDraft === newDraftProcess ? [{ oneShot: true }] : [];
      result = await createDraft(
        resolveAuthRef(context),
        prepared.appType,
        prepared.processCode,
        prepared.formUuid,
        prepared.baseProcessId,
        processVersion,
        ...oneShotOptions
      );
      assertRemoteDispatchBoundary(context, 'after');
    } catch (error) {
      rethrowApplyBoundaryFailure(error);
      throw resourceError('PROCESS_RESOURCE_DRAFT_FAILED', 'draft_created');
    }
    processId = extractDraftProcessId(result);
    if (!processId) {
      throw resourceError('PROCESS_RESOURCE_DRAFT_FAILED', 'draft_created');
    }
    context.checkpointStage('draft_created', {
      nodeBindings: prepared.compiled.nodeBindings,
      processCode: prepared.processCode,
      processId,
      processVersion,
    });
    stage = 'draft_created';
  }

  if (stage === 'draft_created') {
    const save = resolveService(context, 'saveProcessById', saveProcessById);
    let result;
    try {
      assertRemoteDispatchBoundary(context, 'before');
      const oneShotOptions = save === saveProcessById ? [{ oneShot: true }] : [];
      result = await save(
        resolveAuthRef(context),
        prepared.appType,
        prepared.formUuid,
        prepared.processCode,
        processId,
        processVersion,
        JSON.stringify(prepared.compiled.processJson),
        JSON.stringify(prepared.compiled.viewJson),
        ...oneShotOptions
      );
      assertRemoteDispatchBoundary(context, 'after');
    } catch (error) {
      rethrowApplyBoundaryFailure(error);
      throw resourceError('PROCESS_RESOURCE_SAVE_FAILED', 'saved');
    }
    assertWriteSuccess(result, 'PROCESS_RESOURCE_SAVE_FAILED', 'saved');
    context.checkpointStage('saved', {});
    stage = 'saved';
  }

  if (stage === 'saved') {
    const publish = resolveService(context, 'publishProcessById', publishProcessById);
    let result;
    try {
      assertRemoteDispatchBoundary(context, 'before');
      const oneShotOptions = publish === publishProcessById ? [{ oneShot: true }] : [];
      result = await publish(
        resolveAuthRef(context),
        prepared.appType,
        prepared.formUuid,
        prepared.processCode,
        processId,
        processVersion,
        ...oneShotOptions
      );
      assertRemoteDispatchBoundary(context, 'after');
    } catch (error) {
      rethrowApplyBoundaryFailure(error);
      throw resourceError('PROCESS_RESOURCE_PUBLISH_FAILED', 'published');
    }
    assertWriteSuccess(result, 'PROCESS_RESOURCE_PUBLISH_FAILED', 'published');
    context.checkpointStage('published', {});
  }

  return {
    appType: prepared.appType,
    formUuid: prepared.formUuid,
    nodeBindings: prepared.compiled.nodeBindings,
    processCode: prepared.processCode,
    processId,
    processVersion,
  };
}

async function reconcileProcessResource(context, input) {
  const checkpoint = input && input.stageCheckpoint;
  if (!hasCompleteCheckpointIdentity(checkpoint, input)) {
    return null;
  }
  const resumesRemoteWrite = checkpoint.stage === 'draft_created' || checkpoint.stage === 'saved';
  if (resumesRemoteWrite && !hasWriteRecoveryProvenance(input, checkpoint)) {
    return null;
  }
  const bindings = identityFromCheckpoint(checkpoint, input);
  if (resumesRemoteWrite && !await hasCurrentFormProcessBinding(context, bindings)) {
    return null;
  }
  const reader = resolveService(context, 'readProcessDefinition', readProcessDefinition);
  let readResult;
  try {
    assertRemoteDispatchBoundary(context, 'before');
    readResult = await reader(context, bindings);
    assertRemoteDispatchBoundary(context, 'after');
  } catch (error) {
    rethrowApplyBoundaryFailure(error);
    return null;
  }

  if (checkpoint.stage === 'draft_created') {
    if (
      !readResult.definition ||
      readResult.definition.bindingForm !== bindings.formUuid ||
      await readExactVersionStatus(context, bindings) !== 'SAVED'
    ) {
      return null;
    }
    const schema = readResult && readResult.definition && readResult.definition.schema;
    if (!schema || !Array.isArray(schema.children)) {
      return null;
    }
    return containsBoundNode(schema.children, checkpoint.nodeBindings)
      ? null
      : { action: 'resume' };
  }

  let managed;
  try {
    managed = projectProcessManaged(readResult, {
      desired: input.resource.desired,
      formUuid: bindings.formUuid,
      nodeBindings: checkpoint.nodeBindings,
    });
  } catch {
    return null;
  }
  if (!isDeepStrictEqual(managed, input.resource.desired)) {
    return null;
  }
  if (checkpoint.stage === 'saved') {
    const status = await readExactVersionStatus(context, bindings);
    if (status === 'SAVED') {
      return { action: 'resume' };
    }
    if (status === 'PUBLISHED') {
      return completeDecision(bindings, checkpoint.nodeBindings);
    }
    return null;
  }
  if (['published', 'readback_verified', 'completed'].includes(checkpoint.stage)) {
    const status = await readExactVersionStatus(context, bindings);
    return status === 'PUBLISHED'
      ? completeDecision(bindings, checkpoint.nodeBindings)
      : null;
  }
  return null;
}

function hasWriteRecoveryProvenance(input, checkpoint) {
  const operation = input && input.operation;
  const resource = input && input.resource;
  return !!(
    operation &&
    resource &&
    operation.resourceType === 'process' &&
    operation.key === resource.key &&
    (operation.operation === 'create' || operation.operation === 'update') &&
    (operation.status === 'pending' || operation.status === 'uncertain') &&
    isNonEmptyString(operation.operationId) &&
    operation.desiredHash === checkpoint.desiredManagedHash &&
    isDeepStrictEqual(operation.stageCheckpoint, checkpoint)
  );
}

function assertRemoteDispatchBoundary(context, phase) {
  if (typeof context.assertRemoteDispatchBoundary === 'function') {
    context.assertRemoteDispatchBoundary(phase);
  }
}

function rethrowApplyBoundaryFailure(error) {
  if (error && error.code === 'SCHEMA_APPLY_LOCK_LOST') {
    throw error;
  }
}

async function readExactVersionStatus(context, bindings) {
  let snapshot;
  try {
    snapshot = await readProcessVersionSnapshot(context, bindings);
  } catch (error) {
    rethrowApplyBoundaryFailure(error);
    return null;
  }
  const match = snapshot.rows.find(row => (
    row.processId === bindings.processId &&
    row.processVersion === bindings.processVersion
  ));
  return match && (match.status === 'SAVED' || match.status === 'PUBLISHED')
    ? match.status
    : null;
}

async function hasCurrentFormProcessBinding(context, bindings) {
  const reader = resolveService(context, 'readFormMode', readFormMode);
  let observed;
  try {
    assertRemoteDispatchBoundary(context, 'before');
    observed = await reader(context, {
      appType: bindings.appType,
      formUuid: bindings.formUuid,
    });
    assertRemoteDispatchBoundary(context, 'after');
  } catch (error) {
    rethrowApplyBoundaryFailure(error);
    return false;
  }
  return !!(
    observed &&
    observed.mode === 'process' &&
    observed.processCode === bindings.processCode &&
    (!observed.processId || observed.processId === bindings.processId)
  );
}

function containsBoundNode(children, nodeBindings) {
  const boundIds = new Set(Object.values(nodeBindings || {}).map(binding => binding && binding.nodeId).filter(Boolean));
  return children.some(node => node && boundIds.has(node.id));
}

function completeDecision(bindings, nodeBindings) {
  return {
    action: 'complete',
    result: {
      ...bindings,
      nodeBindings: clonePlain(nodeBindings),
    },
  };
}

async function resolveNextProcessIdentity(context, input) {
  let snapshot;
  try {
    snapshot = await readProcessVersionSnapshot(context, input);
  } catch (error) {
    rethrowApplyBoundaryFailure(error);
    throw resourceError('PROCESS_RESOURCE_VERSION_READ_FAILED', 'version_read');
  }
  if (snapshot.drafts.length > 0) {
    throw resourceError('PROCESS_RESOURCE_DRAFT_CONFLICT', 'version_compare');
  }
  if (input.stateBindings && (
    normalizeIdentifier(input.stateBindings.processId) !== snapshot.active.processId ||
    normalizeVersion(input.stateBindings.processVersion) !== snapshot.active.processVersion
  )) {
    throw resourceError('PROCESS_RESOURCE_VERSION_CONFLICT', 'version_compare');
  }
  const nextVersion = snapshot.rows.reduce(
    (maximum, row) => Math.max(maximum, row.processVersion),
    -1
  ) + 1;
  return {
    appType: input.appType,
    baseProcessId: snapshot.active.processId,
    formUuid: input.formUuid,
    processCode: input.processCode,
    processVersion: nextVersion,
  };
}

function identityFromCheckpoint(checkpoint, input) {
  return {
    appType: input && input.appType,
    formUuid: input && input.formUuid,
    processCode: checkpoint.processCode,
    processId: checkpoint.processId,
    processVersion: checkpoint.processVersion,
  };
}

function hasCompleteCheckpointIdentity(checkpoint, input) {
  const desired = input && input.desired || input && input.resource && input.resource.desired;
  return !!(
    checkpoint &&
    isNonEmptyString(input && input.appType) &&
    isNonEmptyString(input && input.formUuid) &&
    isNonEmptyString(checkpoint.processCode) &&
    checkpoint.processCode === input.processCode &&
    isNonEmptyString(checkpoint.processId) &&
    Number.isInteger(checkpoint.processVersion) &&
    checkpoint.processVersion >= 0 &&
    validateManagedNodeBindings(desired && desired.nodes, checkpoint.nodeBindings)
  );
}

function extractDraftProcessId(result) {
  if (!result || result.success !== true) {
    return null;
  }
  const content = result.content;
  const value = content && typeof content === 'object' ? content.processId : content;
  return normalizeIdentifier(value);
}

function assertWriteSuccess(result, code, operation) {
  if (!result || result.success !== true) {
    throw resourceError(code, operation);
  }
}

function normalizeIdentifier(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return isNonEmptyString(value) ? value : null;
}

function normalizeVersion(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function normalizeCount(value) {
  const normalized = normalizeVersion(value);
  return normalized === null ? null : normalized;
}

function normalizeVersionRow(row, processCode) {
  const processId = normalizeIdentifier(row && row.id);
  const processVersion = normalizeVersion(row && row.version);
  const status = row && row.status;
  if (
    !processId ||
    processVersion === null ||
    !VERSION_STATUSES.has(status) ||
    row.code !== processCode
  ) {
    return null;
  }
  return { processId, processVersion, status };
}

function compareVersionRows(left, right) {
  if (left.processVersion !== right.processVersion) {
    return left.processVersion - right.processVersion;
  }
  return left.processId < right.processId ? -1 : left.processId > right.processId ? 1 : 0;
}

function resolveService(context, name, fallback) {
  return context && context.services && context.services[name] || fallback;
}

function resolveAuthRef(context) {
  return context && context.authRef ? context.authRef : context;
}

function resourceError(code, operation) {
  return new ProcessResourceServiceError(code, 'Process resource operation failed.', { operation });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = {
  ProcessResourceServiceError,
  applyProcessResource,
  prepareProcessResource,
  readProcessVersionSnapshot,
  reconcileProcessResource,
};
