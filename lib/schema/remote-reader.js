'use strict';

const { schemaError } = require('./errors');
const { isSha256 } = require('./hash');
const { isRemoteMissingError } = require('./remote-missing');
const { createDefaultRegistry } = require('./resource-registry');
const { compareResourceIds, getResourceState, hashStable } = require('./state-store');

async function readObservedResources(resources, state, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  const context = Object.assign({}, options.context || {}, {
    services: options.services || options.context && options.context.services || {},
    state,
  });
  const observedResources = [];
  const missingResources = [];

  for (const resource of sortResources(resources || [])) {
    const adapter = registry.get(resource.resourceType);
    assertObservedAdapter(adapter);
    const stateResource = getResourceState(state, resource.resourceType, resource.key);
    if (!stateResource) {
      throw schemaError('SCHEMA_STATE_RESOURCE_BINDING_MISSING', 'State does not contain bindings for resource.', {
        details: {
          resourceType: resource.resourceType,
          key: resource.key,
        },
      });
    }
    if (stateResource.adapterVersion !== adapter.adapterVersion) {
      throw schemaError('SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED', 'State resource adapterVersion is not supported by the current adapter.', {
        details: {
          resourceType: resource.resourceType,
          key: resource.key,
          stateAdapterVersion: stateResource.adapterVersion,
          adapterVersion: adapter.adapterVersion,
        },
      });
    }

    const adapterContext = Object.assign({}, context, {
      resource,
      stateResource,
    });
    assertDispatchBoundary(options);
    const observed = await readObservedWithStableError(adapter, stateResource, adapterContext, resource);
    assertDispatchBoundary(options);
    if (isRemoteMissingError(observed)) {
      missingResources.push({
        resourceType: resource.resourceType,
        key: resource.key,
      });
      continue;
    }
    const projection = projectObservedWithStableError(adapter, observed, stateResource, adapterContext, resource);
    const managed = projection.managed || {};
    const observedManagedHash = projection.observedManagedHash || hashObservedManaged({
      resourceType: resource.resourceType,
      key: resource.key,
      adapterVersion: adapter.adapterVersion,
      managed,
    });

    const observedResource = {
      resourceType: resource.resourceType,
      key: resource.key,
      adapterVersion: adapter.adapterVersion,
      managed,
      observedManagedHash,
      bindings: projection.bindings || stateResource.bindings || {},
    };
    if (projection.remoteSchemaHash !== undefined) {
      if (!isSha256(projection.remoteSchemaHash)) {
        throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid remote Schema hash.');
      }
      observedResource.remoteSchemaHash = projection.remoteSchemaHash;
    }
    copyPlannerObservation(projection, observedResource);
    observedResources.push(observedResource);
  }

  return {
    missingResources,
    resources: observedResources,
  };
}

function assertDispatchBoundary(options) {
  if (typeof options.assertDispatchBoundary === 'function') {
    options.assertDispatchBoundary();
  }
}

function copyPlannerObservation(projection, target) {
  for (const property of ['observedIdentityHash', 'observedDraftHash']) {
    if (projection[property] === undefined) {
      continue;
    }
    if (!isSha256(projection[property])) {
      throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid observed identity hash.');
    }
    target[property] = projection[property];
  }
  if (projection.observedIdentityMatchesBindings !== undefined) {
    if (typeof projection.observedIdentityMatchesBindings !== 'boolean') {
      throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid observed identity comparison.');
    }
    target.observedIdentityMatchesBindings = projection.observedIdentityMatchesBindings;
  }
  if (projection.observedDraftCount !== undefined) {
    if (!Number.isInteger(projection.observedDraftCount) || projection.observedDraftCount < 0) {
      throw schemaError('SCHEMA_INTERNAL_ERROR', 'Resource adapter returned an invalid observed draft count.');
    }
    target.observedDraftCount = projection.observedDraftCount;
  }
}

function hashObservedManaged(value) {
  return hashStable({
    contractVersion: 1,
    observed: value,
  });
}

function assertObservedAdapter(adapter) {
  if (
    !adapter ||
    typeof adapter.readObserved !== 'function' ||
    typeof adapter.projectObserved !== 'function'
  ) {
    throw schemaError('SCHEMA_RESOURCE_TYPE_UNSUPPORTED', 'Resource adapter does not support observed reads.', {
      details: { resourceType: adapter && adapter.resourceType },
    });
  }
}

async function readObservedWithStableError(adapter, stateResource, context, resource) {
  try {
    return await adapter.readObserved(stateResource, context);
  } catch (error) {
    if (isRemoteMissingError(error)) {
      return error;
    }
    if (error && error.code === 'SCHEMA_REMOTE_RESOURCE_MISSING') {
      throwRemoteReadFailed(resource);
    }
    if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
      throw error;
    }
    throwRemoteReadFailed(resource, error && error.code);
  }
}

function throwRemoteReadFailed(resource, adapterCode) {
  throw schemaError('SCHEMA_REMOTE_READ_FAILED', 'Remote observed read failed.', {
    details: {
      resourceType: resource.resourceType,
      key: resource.key,
      adapterCode,
    },
  });
}

function projectObservedWithStableError(adapter, observed, stateResource, context, resource) {
  try {
    return adapter.projectObserved(observed, stateResource, context);
  } catch (error) {
    if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
      throw error;
    }
    throw schemaError('SCHEMA_REMOTE_PROJECT_FAILED', 'Remote observed projection failed.', {
      details: {
        resourceType: resource.resourceType,
        key: resource.key,
        adapterCode: error && error.code,
      },
    });
  }
}

function sortResources(resources) {
  return resources.slice().sort(compareResourceIds);
}

module.exports = {
  hashObservedManaged,
  isRemoteMissingError,
  readObservedResources,
};
