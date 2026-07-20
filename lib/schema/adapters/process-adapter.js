'use strict';

const { isDeepStrictEqual } = require('util');
const { schemaError } = require('../errors');
const { validateSemanticKey } = require('./keys');
const { normalizeFormReference } = require('./form-adapter');
const { projectProcessManaged, readProcessDefinition } = require('../../process/services/process-reader');
const { validateManagedNodeBindings } = require('../../process/services/process-compiler');
const {
  applyProcessResource,
  prepareProcessResource,
  readProcessVersionSnapshot,
  reconcileProcessResource,
} = require('../../process/services/process-resource-service');
const {
  advanceProcessStagedCheckpoint,
  isProcessStageCheckpointRemoteComplete,
  validateProcessStageCheckpoint,
} = require('../../process/services/process-stage-checkpoint');
const { hashStable } = require('../state-store');
const { sortStrings } = require('../sort');

const PROCESS_NODE_TYPE = 'approval';
const PROCESS_APPROVER = 'originator';
const PROCESS_ADAPTER_VERSION = 1;

const processAdapter = {
  resourceType: 'process',
  adapterVersion: PROCESS_ADAPTER_VERSION,
  validate(entry, context = {}) {
    const processKey = entry.key;
    const definition = entry.definition;
    const pointer = `/processes/${escapePointer(processKey)}`;
    validateSemanticKey(processKey, pointer);

    const formReference = normalizeFormReference(definition.form, context);
    const formKey = formReference.slice('form:'.length);
    const form = context.manifest && context.manifest.forms && context.manifest.forms[formKey];
    if (form && form.mode !== 'process') {
      throw schemaError('SCHEMA_PROCESS_FORM_MODE_REQUIRED', 'Process resources require their form to declare mode "process".', {
        path: `${pointer}/form`,
        details: {
          key: processKey,
          resourceType: 'process',
        },
      });
    }

    const nodeKeys = new Set();
    definition.nodes.forEach((node, index) => {
      const nodePointer = `${pointer}/nodes/${index}`;
      validateSemanticKey(node.key, `${nodePointer}/key`);
      if (nodeKeys.has(node.key)) {
        throw schemaError('SCHEMA_DUPLICATE_KEY', 'Process node semantic keys must be unique within a process.', {
          path: `${nodePointer}/key`,
          details: { key: node.key },
        });
      }
      nodeKeys.add(node.key);
      if (node.type !== PROCESS_NODE_TYPE) {
        throw schemaError('SCHEMA_PROCESS_NODE_TYPE_UNSUPPORTED', 'Process node type is not supported by Manifest v1.', {
          path: `${nodePointer}/type`,
          details: { nodeType: node.type },
        });
      }
      if (node.approver !== PROCESS_APPROVER) {
        throw schemaError('SCHEMA_PROCESS_NODE_PROPERTY_INVALID', 'Process approval nodes currently require approver "originator".', {
          path: `${nodePointer}/approver`,
          details: { property: 'approver' },
        });
      }
    });
  },

  normalize(entry, context = {}) {
    this.validate(entry, context);
    const processKey = entry.key;
    const definition = entry.definition;
    const pointer = `/processes/${escapePointer(processKey)}`;
    const formReference = normalizeFormReference(definition.form, context);

    return {
      resourceType: 'process',
      key: processKey,
      desired: {
        form: formReference,
        nodes: definition.nodes.map(node => ({
          key: node.key,
          type: PROCESS_NODE_TYPE,
          name: node.name,
          approver: PROCESS_APPROVER,
        })),
      },
      dependsOn: [formReference],
      dependencySources: {
        [formReference]: [{
          kind: 'reference',
          path: `${pointer}/form`,
        }],
      },
    };
  },

  async readObserved(binding, context = {}) {
    const bindings = normalizeProcessBindings(binding);
    const versionSnapshot = await readProcessVersionSnapshot(context, bindings);
    if (!matchesProcessIdentity(versionSnapshot.active, bindings)) {
      return { versionSnapshot };
    }
    const reader = context.services && context.services.readProcessDefinition || readProcessDefinition;
    assertAdapterDispatchBoundary(context, 'before');
    const definitionResult = await reader(context, bindings);
    assertAdapterDispatchBoundary(context, 'after');
    return {
      definitionResult,
      versionSnapshot,
    };
  },

  projectObserved(observed, binding, context = {}) {
    const bindings = normalizeProcessBindings(binding);
    const desired = context.resource && context.resource.desired || context.desired;
    const versionObservation = projectVersionObservation(observed && observed.versionSnapshot, bindings);
    const managed = versionObservation.observedIdentityMatchesBindings
      ? projectProcessManaged(observed.definitionResult, {
        desired,
        formUuid: bindings.formUuid,
        nodeBindings: bindings.nodeBindings,
      })
      : clonePlain(binding && binding.lastApplied || {});
    return {
      bindings,
      managed,
      ...versionObservation,
    };
  },

  classifyObservedConflict(input) {
    const observed = input.observedResource || {};
    if (observed.observedIdentityMatchesBindings === false) {
      return 'REMOTE_IDENTITY_DRIFT';
    }
    if (
      observed.observedDraftCount > 0 &&
      input.desiredChanged === true &&
      input.observedMatchesDesired !== true
    ) {
      return 'REMOTE_DRAFT_EXISTS';
    }
    return undefined;
  },

  async prepareOperation(input, context = {}) {
    const operationInput = buildProcessOperationInput(
      input.resource,
      input.stateResource,
      context,
      input.recovery
    );
    const prepare = context.services && context.services.prepareProcessResource || prepareProcessResource;
    try {
      return await prepare(context, operationInput);
    } catch (error) {
      if (error && error.code === 'PROCESS_RESOURCE_RECONCILIATION_REQUIRED') {
        throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Process checkpoint evidence is incomplete.', {
          details: {
            operation: input.operation,
            resourceType: 'process',
            key: input.resource && input.resource.key,
          },
        });
      }
      if (error && (
        error.code === 'PROCESS_RESOURCE_VERSION_CONFLICT' ||
        error.code === 'PROCESS_RESOURCE_DRAFT_CONFLICT'
      )) {
        throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Current process version state no longer permits the reviewed write.', {
          details: {
            operation: input.operation,
            resourceType: 'process',
            key: input.resource && input.resource.key,
          },
        });
      }
      if (error && error.code === 'PROCESS_RESOURCE_COMPILE_FAILED') {
        throw schemaError('SCHEMA_PROCESS_COMPILE_FAILED', 'Process desired state could not be compiled.', {
          details: {
            resourceType: 'process',
            key: input.resource && input.resource.key,
          },
        });
      }
      throw schemaError('SCHEMA_REMOTE_READ_FAILED', 'Process version state could not be read.', {
        details: {
          resourceType: 'process',
          key: input.resource && input.resource.key,
        },
      });
    }
  },

  async create(desired, context = {}) {
    return runProcessWrite(context);
  },

  async update(desired, observed, binding, context = {}) {
    return runProcessWrite(context);
  },

  buildBindings(result, context = {}) {
    const checkpoint = context.stageCheckpoint || {};
    return requireCompleteProcessBindings({
      appType: result && result.appType,
      formUuid: result && result.formUuid,
      nodeBindings: result && result.nodeBindings || checkpoint.nodeBindings,
      processCode: result && result.processCode || checkpoint.processCode,
      processId: result && result.processId || checkpoint.processId,
      processVersion: result && result.processVersion !== undefined
        ? result.processVersion
        : checkpoint.processVersion,
    });
  },

  verify(projection, context = {}) {
    if (
      !projection ||
      projection.observedIdentityMatchesBindings !== true ||
      !isDeepStrictEqual(projection.managed, context.resource && context.resource.desired)
    ) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Process observed projection does not match desired managed state.', {
        details: {
          resourceType: 'process',
          key: context.resource && context.resource.key,
        },
      });
    }
    return projection;
  },

  async reconcileStaged(input, context = {}) {
    const operationInput = buildProcessOperationInput(
      input.resource,
      input.stateResource,
      context,
      { stageCheckpoint: input.stageCheckpoint }
    );
    const reconcile = context.services && context.services.reconcileProcessResource || reconcileProcessResource;
    return reconcile(context, {
      ...operationInput,
      operation: input.operation,
      resource: input.resource,
      stageCheckpoint: input.stageCheckpoint,
    });
  },

  advanceStagedCheckpoint(previous, event, input) {
    return advanceProcessStagedCheckpoint(previous, event, input);
  },

  isStagedCheckpointRemoteComplete(checkpoint, context = {}) {
    return isProcessStageCheckpointRemoteComplete(checkpoint, {
      desiredManagedHash: context.desiredManagedHash,
    });
  },

  validateStageCheckpoint(checkpoint, context = {}) {
    return validateProcessStageCheckpoint(checkpoint, context);
  },

  validateStateResource(entry) {
    validateProcessStateResource(entry);
  },
};

function assertAdapterDispatchBoundary(context, phase) {
  if (typeof context.assertRemoteDispatchBoundary === 'function') {
    context.assertRemoteDispatchBoundary(phase);
  }
}

function runProcessWrite(context) {
  const writer = context.services && context.services.applyProcessResource || applyProcessResource;
  return writer({
    ...context,
    checkpointStage: context.checkpointStage,
  }, {
    prepared: context.prepared,
    recovery: context.recovery,
  });
}

function projectVersionObservation(snapshot, bindings) {
  if (!snapshot || !snapshot.active || !Array.isArray(snapshot.drafts)) {
    throw schemaError('SCHEMA_REMOTE_PROJECT_FAILED', 'Process version observation is invalid.', {
      details: { resourceType: 'process' },
    });
  }
  const activeIdentity = {
    processId: snapshot.active.processId,
    processVersion: snapshot.active.processVersion,
  };
  const draftIdentities = snapshot.drafts.map(row => ({
    processId: row.processId,
    processVersion: row.processVersion,
  }));
  return {
    observedDraftCount: draftIdentities.length,
    observedDraftHash: hashStable({
      adapterVersion: PROCESS_ADAPTER_VERSION,
      identities: draftIdentities,
      resourceType: 'process',
    }),
    observedIdentityHash: hashStable({
      adapterVersion: PROCESS_ADAPTER_VERSION,
      identity: activeIdentity,
      resourceType: 'process',
    }),
    observedIdentityMatchesBindings: matchesProcessIdentity(snapshot.active, bindings),
  };
}

function matchesProcessIdentity(identity, bindings) {
  return !!(
    identity &&
    identity.processId === bindings.processId &&
    identity.processVersion === bindings.processVersion
  );
}

function buildProcessOperationInput(resource, stateResource, context, recovery) {
  const formKey = resource && resource.desired && String(resource.desired.form).slice('form:'.length);
  const formState = context.state && context.state.resources && context.state.resources.form && context.state.resources.form[formKey];
  const formBindings = formState && formState.bindings || {};
  if (!isNonEmptyString(formBindings.appType) || !isNonEmptyString(formBindings.formUuid) || !isNonEmptyString(formBindings.processCode)) {
    throw schemaError('SCHEMA_STATE_RESOURCE_BINDING_MISSING', 'Process form dependency bindings are incomplete.', {
      details: { resourceType: 'form', key: formKey },
    });
  }
  const stageCheckpoint = recovery && recovery.stageCheckpoint;
  if (stageCheckpoint && stageCheckpoint.processCode !== formBindings.processCode) {
    throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Process checkpoint no longer matches its form dependency.', {
      details: {
        operation: 'reconcile',
        resourceType: 'process',
        key: resource && resource.key,
      },
    });
  }
  const stateBindings = stateResource ? normalizeProcessBindings(stateResource) : null;
  if (stateBindings && (
    stateBindings.appType !== formBindings.appType ||
    stateBindings.formUuid !== formBindings.formUuid ||
    stateBindings.processCode !== formBindings.processCode
  )) {
    throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Process bindings no longer match the form dependency.', {
      details: {
        operation: 'update',
        resourceType: 'process',
        key: resource && resource.key,
      },
    });
  }
  return {
    appType: formBindings.appType,
    baseUrl: context.authRef && context.authRef.baseUrl || context.environment && context.environment.endpoint,
    desired: resource.desired,
    existingBindings: stateBindings && stateBindings.nodeBindings || {},
    formUuid: formBindings.formUuid,
    processCode: formBindings.processCode,
    recovery,
    stateBindings,
  };
}

function normalizeProcessBindings(binding) {
  const source = binding && binding.bindings ? binding.bindings : binding || {};
  return {
    appType: source.appType,
    formUuid: source.formUuid,
    nodeBindings: cloneNodeBindings(source.nodeBindings || {}),
    processCode: source.processCode,
    processId: source.processId,
    processVersion: source.processVersion,
  };
}

function requireCompleteProcessBindings(value) {
  const normalized = normalizeProcessBindings(value);
  if (
    !isNonEmptyString(normalized.appType) ||
    !isNonEmptyString(normalized.formUuid) ||
    !isNonEmptyString(normalized.processCode) ||
    !isNonEmptyString(normalized.processId) ||
    !Number.isInteger(normalized.processVersion) ||
    normalized.processVersion < 0 ||
    Object.keys(normalized.nodeBindings).length === 0
  ) {
    throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Process operation did not produce complete bindings.', {
      details: { resourceType: 'process' },
    });
  }
  return normalized;
}

function validateProcessStateResource(entry) {
  const state = entry.state || {};
  validateProcessBindings(state.bindings, `${entry.path}/bindings`);
  if (state.lastApplied !== undefined) {
    validateManagedProcess(state.lastApplied, `${entry.path}/lastApplied`);
    if (!validateManagedNodeBindings(state.lastApplied.nodes, state.bindings.nodeBindings)) {
      stateInvalid(`${entry.path}/bindings/nodeBindings`);
    }
  }
}

function validateProcessBindings(bindings, pointer) {
  assertObject(bindings, pointer);
  assertAllowedKeys(bindings, [
    'appType',
    'formUuid',
    'nodeBindings',
    'processCode',
    'processId',
    'processVersion',
  ], pointer);
  for (const property of ['appType', 'formUuid', 'processCode', 'processId']) {
    if (!isNonEmptyString(bindings[property])) {
      stateInvalid(`${pointer}/${property}`);
    }
  }
  if (!Number.isInteger(bindings.processVersion) || bindings.processVersion < 0) {
    stateInvalid(`${pointer}/processVersion`);
  }
  assertObject(bindings.nodeBindings, `${pointer}/nodeBindings`);
  if (Object.keys(bindings.nodeBindings).length === 0) {
    stateInvalid(`${pointer}/nodeBindings`);
  }
  const bindingKeys = sortStrings(Object.keys(bindings.nodeBindings));
  for (const key of bindingKeys) {
    validateSemanticKey(key, `${pointer}/nodeBindings/${escapePointer(key)}`);
  }
  const stateNodes = bindingKeys.map(key => ({ key, type: PROCESS_NODE_TYPE }));
  if (!validateManagedNodeBindings(stateNodes, bindings.nodeBindings)) {
    stateInvalid(`${pointer}/nodeBindings`);
  }
}

function validateManagedProcess(value, pointer) {
  assertObject(value, pointer);
  assertAllowedKeys(value, ['form', 'nodes'], pointer);
  if (!isNonEmptyString(value.form) || !value.form.startsWith('form:')) {
    stateInvalid(`${pointer}/form`);
  }
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
    stateInvalid(`${pointer}/nodes`);
  }
  value.nodes.forEach((node, index) => {
    const nodePointer = `${pointer}/nodes/${index}`;
    assertObject(node, nodePointer);
    assertAllowedKeys(node, ['key', 'type', 'name', 'approver'], nodePointer);
    validateSemanticKey(node.key, `${nodePointer}/key`);
    if (
      node.type !== PROCESS_NODE_TYPE ||
      node.approver !== PROCESS_APPROVER ||
      !isNonEmptyString(node.name)
    ) {
      stateInvalid(nodePointer);
    }
  });
}

function cloneNodeBindings(value) {
  const result = Object.create(null);
  for (const key of sortStrings(Object.keys(value || {}))) {
    const node = value[key] || {};
    result[key] = {
      nodeId: node.nodeId,
      componentName: node.componentName,
    };
  }
  return result;
}

function assertObject(value, pointer) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    stateInvalid(pointer);
  }
}

function assertAllowedKeys(value, allowedKeys, pointer) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) {
      stateInvalid(`${pointer}/${escapePointer(key)}`);
    }
  }
}

function stateInvalid(path) {
  throw schemaError('SCHEMA_STATE_INVALID', 'Process state resource is invalid.', { path });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

module.exports = {
  PROCESS_APPROVER,
  PROCESS_NODE_TYPE,
  processAdapter,
};
