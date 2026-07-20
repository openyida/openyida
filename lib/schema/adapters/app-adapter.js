'use strict';

const { validateSemanticKey } = require('./keys');
const { schemaError } = require('../errors');
const { createRemoteMissingError } = require('../remote-missing');
const { readApp } = require('../../app/services/app-reader');
const { createAppResource, updateAppResource } = require('../../app/services/app-service');
const { isDeepStrictEqual } = require('util');

const appAdapter = {
  resourceType: 'app',
  adapterVersion: 1,
  validate(entry) {
    const app = entry.definition;
    validateSemanticKey(app.key, '/app/key');
  },

  normalize(entry) {
    this.validate(entry);
    const app = entry.definition;

    const desired = {
      key: app.key,
      name: app.name,
    };

    return {
      resourceType: 'app',
      key: app.key,
      desired,
      dependsOn: [],
      dependencySources: {},
    };
  },

  async readObserved(binding, context = {}) {
    const normalized = normalizeAppBindings(binding);
    if (!normalized.appType) {
      throw schemaError('SCHEMA_OBSERVED_BINDING_MISSING', 'App observed read requires appType binding.', {
        details: { resourceType: 'app' },
      });
    }
    const reader = context.services && context.services.readApp || readApp;
    try {
      return await reader(context, { appType: normalized.appType });
    } catch (error) {
      if (error && error.code === 'APP_READ_NOT_FOUND') {
        throw createRemoteMissingError();
      }
      throw error;
    }
  },

  projectObserved(observed, binding, context = {}) {
    const normalized = normalizeAppBindings(binding);
    const resource = context.resource || {};
    const desired = resource.desired || {};
    const managed = {
      key: desired.key || resource.key,
    };
    const name = normalizeObservedAppName(observed && (observed.appName || observed.name));
    if (name) {
      managed.name = name;
    }
    return {
      managed,
      bindings: {
        appType: normalized.appType,
      },
    };
  },

  async create(desired, context = {}) {
    const creator = context.services && context.services.createAppResource || createAppResource;
    const result = await creator(context, {
      appName: desired.name,
      description: desired.name,
      contentLocale: context.contentLocale,
    });
    if (typeof context.checkpointCreateIdentity === 'function') {
      await context.checkpointCreateIdentity(result);
    }
    return result;
  },

  async resumeCreate(desired, createIdentity, context = {}) {
    const bindings = normalizeAppBindings(createIdentity);
    return { appType: bindings.appType };
  },

  async update(desired, observed, binding, context = {}) {
    const normalized = normalizeAppBindings(binding);
    const updater = context.services && context.services.updateAppResource || updateAppResource;
    return updater(context, {
      appType: normalized.appType,
      name: desired.name,
    });
  },

  buildBindings(result, context = {}) {
    const existing = normalizeAppBindings(context.stateResource);
    const appType = result && result.appType || existing.appType;
    if (!appType) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'App operation did not produce app bindings.', {
        details: { resourceType: 'app' },
      });
    }
    return { appType };
  },

  projectOperationResult(_result, stateResource, context = {}) {
    if (context.operation !== 'create') {
      return null;
    }
    const bindings = normalizeAppBindings(stateResource);
    if (!bindings.appType) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'App operation did not produce app bindings.', {
        details: { resourceType: 'app' },
      });
    }
    return {
      managed: cloneManagedApp(context.resource && context.resource.desired),
      bindings: {
        appType: bindings.appType,
      },
    };
  },

  verify(projection, context = {}) {
    if (!projection || !isDeepStrictEqual(projection.managed, context.resource && context.resource.desired)) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'App observed projection does not match desired managed state.', {
        details: {
          resourceType: 'app',
          key: context.resource && context.resource.key,
        },
      });
    }
    return projection;
  },

  validateStateResource(entry) {
    const state = entry.state || {};
    assertAllowedKeys(state.bindings, ['appType'], `${entry.path}/bindings`);
    if (!state.bindings.appType || typeof state.bindings.appType !== 'string') {
      throw schemaError('SCHEMA_STATE_INVALID', 'App state bindings must include appType.', {
        path: `${entry.path}/bindings/appType`,
      });
    }
    if (state.lastApplied !== undefined) {
      validateManagedApp(state.lastApplied, `${entry.path}/lastApplied`);
    }
  },
};

function normalizeAppBindings(binding) {
  const source = binding && binding.bindings ? binding.bindings : binding || {};
  return {
    appType: source.appType || '',
  };
}

function normalizeObservedAppName(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.zh_CN || value.en_US || Object.keys(value).sort().map(key => value[key]).find(Boolean) || '';
  }
  return value ? String(value) : '';
}

function cloneManagedApp(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function validateManagedApp(value, pointer) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'App lastApplied must be a compact managed object.', {
      path: pointer,
    });
  }
  assertAllowedKeys(value, ['key', 'name'], pointer);
  if (typeof value.key !== 'string' || !value.key) {
    throw schemaError('SCHEMA_STATE_INVALID', 'App lastApplied must include key.', {
      path: `${pointer}/key`,
    });
  }
  if (typeof value.name !== 'string' || !value.name) {
    throw schemaError('SCHEMA_STATE_INVALID', 'App lastApplied must include name.', {
      path: `${pointer}/name`,
    });
  }
}

function assertAllowedKeys(value, allowedKeys, pointer) {
  const allowed = new Set(allowedKeys);
  Object.keys(value || {}).forEach((key) => {
    if (!allowed.has(key)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'State contains an unknown property.', {
        path: `${pointer}/${escapePointer(key)}`,
        details: { property: key },
      });
    }
  });
}

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

module.exports = {
  appAdapter,
};
