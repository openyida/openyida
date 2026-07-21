'use strict';

const { schemaError } = require('./errors');
const { createDefaultRegistry } = require('./resource-registry');
const { resourceId } = require('./dependency-graph');
const { isSha256 } = require('./hash');
const { compareCodePoints, sortStrings } = require('./sort');
const {
  createSha256,
  getResourceState,
  hashStable,
} = require('./state-store');
const { stableStringify } = require('./normalize-manifest');

const PLAN_KIND = 'openyida_schema_plan';
const PLAN_CONTRACT_VERSION = 1;

const OPERATIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  NOOP: 'noop',
  CONFLICT: 'conflict',
  UNMANAGED: 'unmanaged',
  ORPHAN: 'orphan',
});

const REASON_CODES = Object.freeze({
  NO_STATE_BINDING: 'NO_STATE_BINDING',
  DESIRED_CHANGED: 'DESIRED_CHANGED',
  ALREADY_MATCHES_DESIRED: 'ALREADY_MATCHES_DESIRED',
  STATE_REPAIR_REQUIRED: 'STATE_REPAIR_REQUIRED',
  REMOTE_DRIFT: 'REMOTE_DRIFT',
  DESIRED_AND_OBSERVED_CHANGED: 'DESIRED_AND_OBSERVED_CHANGED',
  FORM_MODE_CONVERSION: 'FORM_MODE_CONVERSION',
  MANAGED_FIELD_MISSING: 'MANAGED_FIELD_MISSING',
  FORM_MANAGED_FIELD_REMOVAL_UNSUPPORTED: 'FORM_MANAGED_FIELD_REMOVAL_UNSUPPORTED',
  FORM_FIELD_TYPE_CHANGE_UNSUPPORTED: 'FORM_FIELD_TYPE_CHANGE_UNSUPPORTED',
  FORM_OPTION_VALUE_CHANGE_UNSUPPORTED: 'FORM_OPTION_VALUE_CHANGE_UNSUPPORTED',
  FORM_ASSOCIATION_TARGET_CHANGE_UNSUPPORTED: 'FORM_ASSOCIATION_TARGET_CHANGE_UNSUPPORTED',
  REMOTE_DRAFT_EXISTS: 'REMOTE_DRAFT_EXISTS',
  REMOTE_IDENTITY_DRIFT: 'REMOTE_IDENTITY_DRIFT',
  STATE_LAST_APPLIED_MISSING: 'STATE_LAST_APPLIED_MISSING',
  MANIFEST_RESOURCE_REMOVED: 'MANIFEST_RESOURCE_REMOVED',
  REMOTE_RESOURCE_MISSING: 'REMOTE_RESOURCE_MISSING',
});

const COUNT_KEYS = [
  OPERATIONS.CREATE,
  OPERATIONS.UPDATE,
  OPERATIONS.NOOP,
  OPERATIONS.CONFLICT,
  OPERATIONS.UNMANAGED,
  OPERATIONS.ORPHAN,
];

function createPlan(input, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  const desiredResources = normalizeResourceList(input && input.desiredResources, { registry });
  const observedResources = normalizeObservedList(input && input.observedResources, { registry });
  const state = input && input.state || {};
  const manifestHash = input && input.manifestHash;
  const stateRevision = normalizeStateRevision(state.revision);
  const environmentKey = state.environment && state.environment.environmentKey || '';

  const desiredById = indexResources(desiredResources);
  const observedById = indexResources(observedResources);
  const stateById = indexStateResources(state);
  const allIds = sortStrings(new Set([
    ...desiredById.keys(),
    ...observedById.keys(),
    ...stateById.keys(),
  ]));

  validatePlannerState({
    desiredResources,
    registry,
    state,
  });

  const changesById = new Map();
  for (const id of allIds) {
    const desiredResource = desiredById.get(id);
    const stateResource = stateById.get(id);
    const observedResource = observedById.get(id);
    const change = classifyResource({
      desiredResource,
      id,
      observedResource,
      registry,
      stateResource,
    });
    if (change) {
      changesById.set(id, change);
    }
  }

  const sortedIds = topologicalSortIds(allIds, desiredById);
  const changes = sortedIds
    .map(id => changesById.get(id))
    .filter(Boolean);
  const counts = countChanges(changes);
  const planId = computePlanId({
    changes,
    desiredResources,
    environmentKey,
    manifestHash,
    observedResources,
    registry,
    state,
    stateRevision,
  });

  return {
    kind: PLAN_KIND,
    contractVersion: PLAN_CONTRACT_VERSION,
    success: true,
    planId,
    manifestHash,
    stateRevision,
    counts,
    changes,
  };
}

function selectObservableResources(desiredResources, state, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  validatePlannerState({
    desiredResources,
    registry,
    state,
  });
  return normalizeResourceList(desiredResources, { registry }).filter((resource) => {
    const stateResource = getResourceState(state, resource.resourceType, resource.key);
    return !!(stateResource && hasTrustedLastApplied(stateResource));
  });
}

function validatePlannerState(input) {
  const registry = input.registry || createDefaultRegistry();
  const desiredResources = normalizeResourceList(input.desiredResources, { registry });
  const state = input.state || {};
  const desiredById = indexResources(desiredResources);
  const stateById = indexStateResources(state);

  for (const [id, entry] of stateById.entries()) {
    assertAdapterVersion(entry.resourceType, entry.key, entry.stateResource, registry);
    if (entry.stateResource.lastApplied !== undefined && entry.stateResource.lastAppliedHash !== undefined) {
      assertLastAppliedHash(entry.resourceType, entry.key, entry.stateResource);
    }
    const desiredResource = desiredById.get(id);
    if (desiredResource) {
      assertAdapterVersion(desiredResource.resourceType, desiredResource.key, entry.stateResource, registry);
    }
  }
}

function classifyResource(input) {
  const desiredResource = input.desiredResource;
  const stateEntry = input.stateResource;
  const observedResource = input.observedResource;

  if (!desiredResource && stateEntry) {
    return createChange({
      id: input.id,
      operation: OPERATIONS.ORPHAN,
      reasonCode: REASON_CODES.MANIFEST_RESOURCE_REMOVED,
      risk: 'medium',
    });
  }

  if (!desiredResource) {
    return null;
  }

  if (!stateEntry) {
    return createChange({
      id: input.id,
      operation: OPERATIONS.CREATE,
      reasonCode: REASON_CODES.NO_STATE_BINDING,
      risk: 'medium',
    });
  }

  assertAdapterVersion(desiredResource.resourceType, desiredResource.key, stateEntry.stateResource, input.registry);
  const trustedLastApplied = getTrustedLastApplied(desiredResource, stateEntry.stateResource);
  if (!trustedLastApplied) {
    return createChange({
      id: input.id,
      operation: OPERATIONS.UNMANAGED,
      reasonCode: REASON_CODES.STATE_LAST_APPLIED_MISSING,
      risk: 'high',
    });
  }

  if (!observedResource) {
    return createChange({
      id: input.id,
      operation: OPERATIONS.CONFLICT,
      reasonCode: REASON_CODES.REMOTE_RESOURCE_MISSING,
      risk: 'high',
    });
  }

  const desiredHash = hashManagedIdentity({
    adapterVersion: desiredResource.adapterVersion,
    managed: desiredResource.desired || {},
    resourceType: desiredResource.resourceType,
    key: desiredResource.key,
  });
  const lastAppliedHash = trustedLastApplied.identityHash;
  const observedHash = hashManagedIdentity({
    adapterVersion: observedResource.adapterVersion,
    managed: observedResource.managed || {},
    resourceType: observedResource.resourceType,
    key: observedResource.key,
  });
  const adapter = input.registry.get(desiredResource.resourceType);
  const comparisonLastApplied = prepareComparisonLastApplied(adapter, {
    desired: desiredResource.desired || {},
    lastApplied: trustedLastApplied.managed,
    observed: observedResource.managed || {},
  });
  const comparisonLastAppliedHash = hashManagedIdentity({
    adapterVersion: desiredResource.adapterVersion,
    managed: comparisonLastApplied,
    resourceType: desiredResource.resourceType,
    key: desiredResource.key,
  });
  const observedConflictReason = classifyObservedConflict(adapter, {
    desired: desiredResource.desired || {},
    desiredChanged: desiredHash !== comparisonLastAppliedHash,
    lastApplied: trustedLastApplied.managed,
    observed: observedResource.managed || {},
    observedMatchesDesired: observedHash === desiredHash,
    observedResource,
  });

  if (observedConflictReason) {
    return createChange({
      id: input.id,
      operation: OPERATIONS.CONFLICT,
      reasonCode: observedConflictReason,
      risk: 'high',
    });
  }

  if (observedHash === desiredHash) {
    const stateRepair = lastAppliedHash !== desiredHash;
    return createChange({
      id: input.id,
      operation: OPERATIONS.NOOP,
      reasonCode: stateRepair
        ? REASON_CODES.STATE_REPAIR_REQUIRED
        : REASON_CODES.ALREADY_MATCHES_DESIRED,
      risk: 'low',
      stateRepair,
    });
  }

  if (observedHash === comparisonLastAppliedHash && desiredHash !== comparisonLastAppliedHash) {
    const reasonCode = classifyUpdateReason(adapter, {
      desired: desiredResource.desired || {},
      lastApplied: trustedLastApplied.managed,
      observed: observedResource.managed || {},
    });
    return createChange({
      id: input.id,
      operation: OPERATIONS.UPDATE,
      reasonCode,
      risk: 'low',
    });
  }

  if (desiredHash === comparisonLastAppliedHash && observedHash !== comparisonLastAppliedHash) {
    return createChange({
      id: input.id,
      operation: OPERATIONS.CONFLICT,
      reasonCode: REASON_CODES.REMOTE_DRIFT,
      risk: 'high',
    });
  }

  return createChange({
    id: input.id,
    operation: OPERATIONS.CONFLICT,
    reasonCode: REASON_CODES.DESIRED_AND_OBSERVED_CHANGED,
    risk: 'high',
  });
}

function classifyObservedConflict(adapter, input) {
  if (typeof adapter.classifyObservedConflict !== 'function') {
    return undefined;
  }
  const reasonCode = adapter.classifyObservedConflict(input);
  if (reasonCode === undefined) {
    return undefined;
  }
  if (typeof reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(reasonCode)) {
    throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid observed conflict reasonCode.');
  }
  return reasonCode;
}

function prepareComparisonLastApplied(adapter, input) {
  if (typeof adapter.prepareComparison !== 'function') {
    return input.lastApplied;
  }
  const result = adapter.prepareComparison(input);
  if (!result || typeof result !== 'object' || Array.isArray(result) || !result.lastApplied) {
    throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid planner comparison.');
  }
  return result.lastApplied;
}

function classifyUpdateReason(adapter, input) {
  if (typeof adapter.classifyUpdate !== 'function') {
    return REASON_CODES.DESIRED_CHANGED;
  }
  const reasonCode = adapter.classifyUpdate(input);
  if (reasonCode === undefined) {
    return REASON_CODES.DESIRED_CHANGED;
  }
  if (typeof reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(reasonCode)) {
    throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid update reasonCode.');
  }
  return reasonCode;
}

function createChange(input) {
  const parsed = parseResourceId(input.id);
  const change = {
    operation: input.operation,
    resourceType: parsed.resourceType,
    key: parsed.key,
    risk: input.risk,
    reasonCode: input.reasonCode,
  };
  if (input.stateRepair === true) {
    change.stateRepair = true;
  }
  return change;
}

function assertAdapterVersion(resourceType, key, stateResource, registry) {
  const adapter = registry.get(resourceType);
  if (stateResource.adapterVersion !== adapter.adapterVersion) {
    throw schemaError('SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED', 'State resource adapterVersion is not supported by the current adapter.', {
      details: {
        resourceType,
        key,
        stateAdapterVersion: stateResource.adapterVersion,
        adapterVersion: adapter.adapterVersion,
      },
    });
  }
}

function getTrustedLastApplied(resource, stateResource) {
  if (!hasTrustedLastApplied(stateResource)) {
    return null;
  }
  assertLastAppliedHash(resource.resourceType, resource.key, stateResource);
  return {
    identityHash: hashManagedIdentity({
      adapterVersion: stateResource.adapterVersion,
      managed: stateResource.lastApplied,
      resourceType: resource.resourceType,
      key: resource.key,
    }),
    legacyHash: stateResource.lastAppliedHash,
    managed: stateResource.lastApplied,
  };
}

function hasTrustedLastApplied(stateResource) {
  return !!(
    stateResource &&
    stateResource.lastApplied &&
    stateResource.lastAppliedHash
  );
}

function assertLastAppliedHash(resourceType, key, stateResource) {
  const computed = hashStable(stateResource.lastApplied || {});
  if (computed !== stateResource.lastAppliedHash) {
    throw schemaError('SCHEMA_PLAN_STATE_INTEGRITY_FAILED', 'State lastAppliedHash does not match lastApplied content.', {
      details: {
        resourceType,
        key,
      },
    });
  }
}

function topologicalSortIds(ids, desiredById) {
  const idSet = new Set(ids);
  const indegree = new Map(ids.map(id => [id, 0]));
  const outgoing = new Map(ids.map(id => [id, []]));

  for (const [id, resource] of desiredById.entries()) {
    if (!idSet.has(id)) {
      continue;
    }
    for (const dependency of resource.dependsOn || []) {
      if (!idSet.has(dependency)) {
        continue;
      }
      indegree.set(id, (indegree.get(id) || 0) + 1);
      outgoing.get(dependency).push(id);
    }
  }

  for (const dependents of outgoing.values()) {
    dependents.sort(compareCodePoints);
  }

  const ready = sortStrings([...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id));
  const sorted = [];

  while (ready.length > 0) {
    const id = ready.shift();
    sorted.push(id);
    for (const dependent of outgoing.get(id) || []) {
      const nextCount = (indegree.get(dependent) || 0) - 1;
      indegree.set(dependent, nextCount);
      if (nextCount === 0) {
        insertSorted(ready, dependent);
      }
    }
  }

  if (sorted.length !== ids.length) {
    throw schemaError('SCHEMA_DEPENDENCY_CYCLE', 'Manifest resource dependencies must not contain cycles.', {
      details: {
        cycle: findRemainingCycle(ids, sorted, outgoing),
      },
    });
  }
  return sorted;
}

function findRemainingCycle(ids, sorted, outgoing) {
  const sortedSet = new Set(sorted);
  const remaining = new Set(ids.filter(id => !sortedSet.has(id)));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (!remaining.has(id) || visited.has(id)) {
      return null;
    }
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return stack.slice(start).concat(id);
    }

    visiting.add(id);
    stack.push(id);
    for (const dependent of outgoing.get(id) || []) {
      const cycle = visit(dependent);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const id of sortStrings(remaining)) {
    const cycle = visit(id);
    if (cycle) {
      return cycle;
    }
  }
  return sortStrings(remaining);
}

function insertSorted(values, nextValue) {
  const index = values.findIndex(value => compareCodePoints(nextValue, value) < 0);
  if (index === -1) {
    values.push(nextValue);
  } else {
    values.splice(index, 0, nextValue);
  }
}

function countChanges(changes) {
  const counts = {};
  COUNT_KEYS.forEach((key) => {
    counts[key] = 0;
  });
  changes.forEach((change) => {
    counts[change.operation] += 1;
  });
  return counts;
}

function computePlanId(input) {
  const desiredBasis = normalizeResourceList(input.desiredResources, { registry: input.registry }).map(resource => ({
    resourceType: resource.resourceType,
    key: resource.key,
    adapterVersion: resource.adapterVersion,
    desiredManagedHash: hashManagedIdentity({
      adapterVersion: resource.adapterVersion,
      managed: resource.desired || {},
      resourceType: resource.resourceType,
      key: resource.key,
    }),
  })).sort(compareResourceObjects);
  const stateBasis = normalizeStateBasis(input.state, input.registry);
  const observedBasis = normalizeObservedList(input.observedResources, { registry: input.registry }).map(resource => {
    const basis = {
      resourceType: resource.resourceType,
      key: resource.key,
      adapterVersion: resource.adapterVersion,
      observedManagedHash: hashManagedIdentity({
        adapterVersion: resource.adapterVersion,
        managed: resource.managed || {},
        resourceType: resource.resourceType,
        key: resource.key,
      }),
    };
    for (const property of [
      'observedDraftCount',
      'observedDraftHash',
      'observedIdentityHash',
      'observedIdentityMatchesBindings',
    ]) {
      if (resource[property] !== undefined) {
        basis[property] = resource[property];
      }
    }
    if (resource.remoteSchemaHash !== undefined) {
      basis.remoteSchemaHash = resource.remoteSchemaHash;
    }
    return basis;
  }).sort(compareResourceObjects);

  return createSha256(stableStringify({
    contractVersion: PLAN_CONTRACT_VERSION,
    changes: input.changes,
    desired: desiredBasis,
    environmentKey: input.environmentKey,
    manifestHash: input.manifestHash,
    observed: observedBasis,
    state: stateBasis,
    stateRevision: input.stateRevision,
  }));
}

function normalizeResourceList(resources, options = {}) {
  const registry = options.registry;
  return (Array.isArray(resources) ? resources : []).map(resource => ({
    resourceType: resource.resourceType,
    key: resource.key,
    adapterVersion: resource.adapterVersion || getAdapterVersion(registry, resource.resourceType),
    desired: resource.desired || {},
    dependsOn: Array.isArray(resource.dependsOn) ? sortStrings(resource.dependsOn) : [],
  }));
}

function normalizeObservedList(resources, options = {}) {
  const registry = options.registry;
  return (Array.isArray(resources) ? resources : []).map(resource => {
    const normalized = {
      resourceType: resource.resourceType,
      key: resource.key,
      adapterVersion: resource.adapterVersion || getAdapterVersion(registry, resource.resourceType),
      managed: resource.managed || {},
      observedManagedHash: resource.observedManagedHash,
    };
    if (resource.remoteSchemaHash !== undefined) {
      if (!isSha256(resource.remoteSchemaHash)) {
        throw schemaError('SCHEMA_INTERNAL_ERROR', 'Observed resource remoteSchemaHash must be a SHA-256 hash.');
      }
      normalized.remoteSchemaHash = resource.remoteSchemaHash;
    }
    for (const property of [
      'observedDraftCount',
      'observedDraftHash',
      'observedIdentityHash',
      'observedIdentityMatchesBindings',
    ]) {
      if (resource[property] !== undefined) {
        normalized[property] = resource[property];
      }
    }
    return normalized;
  });
}

function normalizeStateBasis(state, registry) {
  const entries = [];
  const resources = state && state.resources || {};
  for (const resourceType of sortStrings(Object.keys(resources))) {
    for (const key of sortStrings(Object.keys(resources[resourceType] || {}))) {
      const entry = resources[resourceType][key] || {};
      const basis = {
        resourceType,
        key,
        adapterVersion: entry.adapterVersion,
        hasBindings: !!entry.bindings,
        hasTrustedLastApplied: hasTrustedLastApplied(entry),
      };
      if (hasTrustedLastApplied(entry)) {
        basis.lastAppliedManagedHash = hashManagedIdentity({
          adapterVersion: entry.adapterVersion || getAdapterVersion(registry, resourceType),
          managed: entry.lastApplied || {},
          resourceType,
          key,
        });
      }
      entries.push(basis);
    }
  }
  return entries.sort(compareResourceObjects);
}

function hashManagedIdentity(input) {
  return hashStable({
    adapterVersion: input.adapterVersion,
    contractVersion: PLAN_CONTRACT_VERSION,
    key: input.key,
    managed: input.managed || {},
    resourceType: input.resourceType,
  });
}

function getAdapterVersion(registry, resourceType) {
  if (!registry) {
    return 1;
  }
  return registry.get(resourceType).adapterVersion;
}

function indexResources(resources) {
  const result = new Map();
  for (const resource of resources) {
    result.set(resourceId(resource), resource);
  }
  return result;
}

function indexStateResources(state) {
  const result = new Map();
  const resources = state && state.resources || {};
  for (const resourceType of sortStrings(Object.keys(resources))) {
    const resourceMap = resources[resourceType] || {};
    for (const key of sortStrings(Object.keys(resourceMap))) {
      result.set(`${resourceType}:${key}`, {
        resourceType,
        key,
        stateResource: resourceMap[key],
      });
    }
  }
  return result;
}

function compareResourceObjects(left, right) {
  return compareCodePoints(`${left.resourceType}:${left.key}`, `${right.resourceType}:${right.key}`);
}

function normalizeStateRevision(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseResourceId(id) {
  const separator = String(id).indexOf(':');
  return {
    resourceType: String(id).slice(0, separator),
    key: String(id).slice(separator + 1),
  };
}

module.exports = {
  OPERATIONS,
  PLAN_CONTRACT_VERSION,
  PLAN_KIND,
  REASON_CODES,
  createPlan,
  hashManagedIdentity,
  selectObservableResources,
  validatePlannerState,
};
