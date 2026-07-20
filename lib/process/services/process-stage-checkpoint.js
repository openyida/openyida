'use strict';

const { schemaError } = require('../../schema/errors');

const PROCESS_STAGES = Object.freeze([
  'draft_created',
  'saved',
  'published',
  'readback_verified',
  'completed',
]);
const ADAPTER_CHECKPOINT_STAGES = new Set(PROCESS_STAGES.slice(0, 3));
const STAGE_CHECKPOINT_KEYS = new Set([
  'stage',
  'processCode',
  'processId',
  'processVersion',
  'nodeBindings',
  'desiredManagedHash',
  'observedManagedHash',
]);
const ADAPTER_PARTIAL_KEYS = new Set([
  'processCode',
  'processId',
  'processVersion',
  'nodeBindings',
]);
const NODE_BINDING_KEYS = new Set(['nodeId', 'componentName']);
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SEMANTIC_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function validateProcessStageCheckpoint(checkpoint, options = {}) {
  assertObject(checkpoint);
  assertAllowedKeys(checkpoint, STAGE_CHECKPOINT_KEYS);
  if (!PROCESS_STAGES.includes(checkpoint.stage)) {
    invalidCheckpoint();
  }
  assertHash(checkpoint.desiredManagedHash);
  if (options.desiredManagedHash !== undefined && checkpoint.desiredManagedHash !== options.desiredManagedHash) {
    invalidCheckpoint();
  }
  if (stageIndex(checkpoint.stage) >= stageIndex('readback_verified')) {
    assertHash(checkpoint.observedManagedHash);
  } else if (checkpoint.observedManagedHash !== undefined) {
    invalidCheckpoint();
  }
  for (const property of ['processCode', 'processId']) {
    if (checkpoint[property] !== undefined && !isNonEmptyString(checkpoint[property])) {
      invalidCheckpoint();
    }
  }
  if (
    checkpoint.processVersion !== undefined &&
    (!Number.isInteger(checkpoint.processVersion) || checkpoint.processVersion < 0)
  ) {
    invalidCheckpoint();
  }
  if (checkpoint.nodeBindings !== undefined) {
    validateNodeBindings(checkpoint.nodeBindings);
  }
  if (options.operation === 'stateRepair') {
    invalidCheckpoint();
  }
  if (checkpoint.stage === 'completed' && options.operationStatus !== undefined && options.operationStatus !== 'completed') {
    invalidCheckpoint();
  }
  if (options.operationStatus === 'completed' && checkpoint.stage !== 'completed') {
    invalidCheckpoint();
  }
  return checkpoint;
}

function advanceProcessStagedCheckpoint(previous, event, input = {}) {
  assertObject(input);
  if (event === 'adapterCheckpoint') {
    assertAllowedKeys(input, new Set(['desiredManagedHash', 'partial', 'stage']));
    assertAdapterCheckpointStage(input.stage);
    return advanceProcessStageCheckpoint(previous, input.stage, input.partial || {}, {
      desiredManagedHash: input.desiredManagedHash,
    });
  }
  if (event === 'reconciledRemoteComplete') {
    assertAllowedKeys(input, new Set(['desiredManagedHash']));
    let checkpoint = previous;
    let index = checkpoint ? stageIndex(checkpoint.stage) : -1;
    const publishedIndex = stageIndex('published');
    while (index < publishedIndex) {
      index += 1;
      checkpoint = advanceProcessStageCheckpoint(checkpoint, PROCESS_STAGES[index], {}, {
        desiredManagedHash: input.desiredManagedHash,
      });
    }
    return checkpoint;
  }
  if (event === 'readbackVerified') {
    assertAllowedKeys(input, new Set(['desiredManagedHash', 'observedManagedHash']));
    if (previous && previous.stage === 'readback_verified') {
      validateProcessStageCheckpoint(previous, { desiredManagedHash: input.desiredManagedHash });
      if (previous.observedManagedHash !== input.observedManagedHash) {
        invalidCheckpoint();
      }
      return clonePlain(previous);
    }
    return advanceProcessStageCheckpoint(previous, 'readback_verified', {}, input);
  }
  if (event === 'completed') {
    assertAllowedKeys(input, new Set(['desiredManagedHash']));
    return advanceProcessStageCheckpoint(previous, 'completed', {}, {
      desiredManagedHash: input.desiredManagedHash,
    });
  }
  invalidCheckpoint();
}

function isProcessStageCheckpointRemoteComplete(checkpoint, options = {}) {
  if (!checkpoint) {
    return false;
  }
  validateProcessStageCheckpoint(checkpoint, options);
  return stageIndex(checkpoint.stage) >= stageIndex('published');
}

function advanceProcessStageCheckpoint(previous, stage, partial = {}, options = {}) {
  if (previous !== undefined && previous !== null) {
    validateProcessStageCheckpoint(previous, {
      desiredManagedHash: options.desiredManagedHash,
    });
  }
  assertObject(partial);
  assertAllowedKeys(partial, ADAPTER_PARTIAL_KEYS);
  const expectedIndex = previous ? stageIndex(previous.stage) + 1 : 0;
  if (PROCESS_STAGES[expectedIndex] !== stage) {
    invalidCheckpoint();
  }

  const next = clonePlain(previous) || {};
  next.stage = stage;
  mergeIdentityProperty(next, partial, 'processCode');
  mergeIdentityProperty(next, partial, 'processId');
  mergeIdentityProperty(next, partial, 'processVersion');
  mergeNodeBindings(next, partial.nodeBindings);
  next.desiredManagedHash = options.desiredManagedHash;
  if (options.observedManagedHash !== undefined) {
    next.observedManagedHash = options.observedManagedHash;
  }
  return validateProcessStageCheckpoint(next, {
    desiredManagedHash: options.desiredManagedHash,
  });
}

function assertAdapterCheckpointStage(stage) {
  if (!ADAPTER_CHECKPOINT_STAGES.has(stage)) {
    invalidCheckpoint();
  }
}

function mergeIdentityProperty(target, source, property) {
  if (source[property] === undefined) {
    return;
  }
  if (target[property] !== undefined && target[property] !== source[property]) {
    invalidCheckpoint();
  }
  target[property] = source[property];
}

function mergeNodeBindings(target, incoming) {
  if (incoming === undefined) {
    return;
  }
  validateNodeBindings(incoming);
  const merged = Object.create(null);
  for (const [key, binding] of Object.entries(target.nodeBindings || {})) {
    merged[key] = clonePlain(binding);
  }
  for (const [key, binding] of Object.entries(incoming)) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      if (
        merged[key].nodeId !== binding.nodeId ||
        merged[key].componentName !== binding.componentName
      ) {
        invalidCheckpoint();
      }
      continue;
    }
    merged[key] = clonePlain(binding);
  }
  target.nodeBindings = merged;
}

function validateNodeBindings(value) {
  assertObject(value);
  for (const [key, binding] of Object.entries(value)) {
    if (!SEMANTIC_KEY_PATTERN.test(key)) {
      invalidCheckpoint();
    }
    assertObject(binding);
    assertAllowedKeys(binding, NODE_BINDING_KEYS);
    if (!isNonEmptyString(binding.nodeId) || !isNonEmptyString(binding.componentName)) {
      invalidCheckpoint();
    }
  }
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalidCheckpoint();
  }
}

function assertAllowedKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      invalidCheckpoint();
    }
  }
}

function assertHash(value) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    invalidCheckpoint();
  }
}

function stageIndex(stage) {
  return PROCESS_STAGES.indexOf(stage);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function invalidCheckpoint() {
  throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema staged apply checkpoint is invalid.');
}

module.exports = {
  advanceProcessStageCheckpoint,
  advanceProcessStagedCheckpoint,
  isProcessStageCheckpointRemoteComplete,
  validateProcessStageCheckpoint,
};
