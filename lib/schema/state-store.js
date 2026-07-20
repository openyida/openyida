'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { schemaError } = require('./errors');
const { createDefaultRegistry } = require('./resource-registry');
const { compareCodePoints } = require('./sort');
const { canonicalizeKey, stableStringify } = require('./normalize-manifest');

const STATE_KIND = 'openyida_resource_state';
const STATE_CONTRACT_VERSION = 1;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ATOMIC_NONCE_PATTERN = /^[a-f0-9]{24}$/;
const ENVIRONMENT_SCOPE_TOKEN = 'openyida-schema-unscoped-internal';

const SENSITIVE_STATE_KEY_CANONICALS = new Set([
  'apikey',
  'authorization',
  'clientsecret',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'csrf',
  'csrftoken',
  'header',
  'headers',
  'internalpath',
  'internalurl',
  'password',
  'refreshtoken',
  'secret',
  'token',
]);

const REAL_ID_KEY_CANONICALS = new Set([
  'apptype',
  'fieldid',
  'formuuid',
  'nodeid',
  'processcode',
  'processid',
  'processversion',
]);

function resolveDefaultStatePath(cwd) {
  return path.join(cwd || process.cwd(), '.cache', 'openyida', 'state.v1.json');
}

function createSha256(value) {
  return 'sha256:' + crypto
    .createHash('sha256')
    .update(String(value === undefined || value === null ? '' : value))
    .digest('hex');
}

function hashStable(value) {
  return createSha256(stableStringify(value));
}

function createEnvironmentIdentity(input = {}, options = {}) {
  if (input && input.environmentKey && input.corpIdHash) {
    assertHash(input.environmentKey, 'environmentKey', '/environment/environmentKey');
    assertHash(input.corpIdHash, 'corpIdHash', '/environment/corpIdHash');
    return {
      environmentKey: input.environmentKey,
      corpIdHash: input.corpIdHash,
    };
  }

  if (options.allowUnscopedEnvironment === true) {
    return {
      environmentKey: createSha256(`${ENVIRONMENT_SCOPE_TOKEN}:environment`),
      corpIdHash: createSha256(`${ENVIRONMENT_SCOPE_TOKEN}:corp`),
    };
  }

  const endpoint = input && (input.endpoint !== undefined ? input.endpoint : input.baseUrl);
  const corpId = input && input.corpId;
  if (!hasNonEmptyString(endpoint) || !hasNonEmptyString(corpId)) {
    throw schemaError('SCHEMA_STATE_ENVIRONMENT_REQUIRED', 'State operations require endpoint/environmentKey and corpId/corpIdHash.', {
      path: '/environment',
    });
  }

  return {
    environmentKey: createSha256(normalizeEndpoint(endpoint)),
    corpIdHash: createSha256(corpId),
  };
}

function createEmptyState(environmentInput, options = {}) {
  const environment = createEnvironmentIdentity(environmentInput, options);
  const state = {
    kind: STATE_KIND,
    contractVersion: STATE_CONTRACT_VERSION,
    revision: 0,
    environment,
    resources: {},
  };
  if (options.manifestHash !== undefined) {
    assertHash(options.manifestHash, 'manifestHash', '/manifestHash');
    state.manifestHash = options.manifestHash;
  }
  validateStateShape(state, {
    registry: options.registry,
  });
  return state;
}

function readState(statePath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const environment = createEnvironmentIdentity(options.environment, options);

  let exists;
  try {
    exists = fsImpl.existsSync(statePath);
  } catch (error) {
    throw schemaError('SCHEMA_STATE_READ_FAILED', 'State file could not be read.', {
      details: { operation: 'exists' },
    });
  }

  if (!exists) {
    return createEmptyState(environment, {
      manifestHash: options.manifestHash,
      registry: options.registry,
    });
  }

  let raw;
  try {
    raw = fsImpl.readFileSync(statePath, 'utf8');
  } catch (error) {
    throw schemaError('SCHEMA_STATE_READ_FAILED', 'State file could not be read.', {
      details: { operation: 'read' },
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State file is not valid JSON.', {
      details: { reason: 'invalid_json' },
    });
  }

  validateState(parsed, {
    environment,
    registry: options.registry,
  });
  return parsed;
}

function writeStateAtomic(statePath, state, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const environment = createEnvironmentIdentity(options.environment, options);
  const nextState = prepareStateForWrite(state, {
    environment,
    incrementRevision: options.incrementRevision,
    registry: options.registry,
  });
  const dir = path.dirname(statePath);
  const data = stableStringify(nextState) + '\n';
  let fd;
  let tmpPath;
  let tempCreated = false;

  try {
    tmpPath = createAtomicTempPath(statePath, options);
    fsImpl.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fd = fsImpl.openSync(tmpPath, 'wx', 0o600);
    tempCreated = true;
    fsImpl.writeFileSync(fd, data, 'utf8');
    if (typeof fsImpl.fsyncSync === 'function') {
      fsImpl.fsyncSync(fd);
    }
    fsImpl.closeSync(fd);
    fd = undefined;
    fsImpl.renameSync(tmpPath, statePath);
    fsyncDirectoryBestEffort(fsImpl, dir);
    return nextState;
  } catch (error) {
    if (fd !== undefined) {
      try {
        fsImpl.closeSync(fd);
      } catch (closeError) {
        // Best effort cleanup.
      }
    }
    try {
      if (tempCreated && tmpPath && fsImpl.existsSync(tmpPath)) {
        fsImpl.unlinkSync(tmpPath);
      }
    } catch (unlinkError) {
      // Best effort cleanup.
    }
    throw schemaError('SCHEMA_STATE_WRITE_FAILED', 'State file could not be written atomically.', {
      details: { operation: 'atomic_write' },
    });
  }
}

function createAtomicTempPath(targetPath, options = {}) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const pid = options.atomicProcessId === undefined ? process.pid : options.atomicProcessId;
  const now = options.atomicNow === undefined ? Date.now() : options.atomicNow;
  const nonce = options.atomicNonce || crypto.randomBytes(12).toString('hex');
  if (
    !Number.isInteger(pid) || pid <= 0 ||
    !Number.isSafeInteger(now) || now < 0 ||
    !ATOMIC_NONCE_PATTERN.test(nonce)
  ) {
    throw new Error('invalid atomic temp identity');
  }
  return path.join(dir, `.${base}.${pid}.${now}.${nonce}.tmp`);
}

function prepareStateForWrite(state, options = {}) {
  const nextState = clonePlain(state);
  validateState(nextState, {
    environment: options.environment,
    registry: options.registry,
  });
  nextState.revision += options.incrementRevision === false ? 0 : 1;
  validateState(nextState, {
    environment: options.environment,
    registry: options.registry,
  });
  return nextState;
}

function validateState(state, options = {}) {
  const environment = options.environment
    ? createEnvironmentIdentity(options.environment, options)
    : createEnvironmentIdentity(options.environmentInput, options);
  validateStateShape(state, {
    registry: options.registry,
  });
  assertEnvironmentMatches(state.environment, environment);
}

function validateStateShape(state, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State file must be a JSON object.');
  }
  validateForbiddenStateKeys(state);
  assertAllowedKeys(state, ['kind', 'contractVersion', 'revision', 'environment', 'manifestHash', 'resources'], '/');

  if (state.kind !== STATE_KIND) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State kind must be "openyida_resource_state".', {
      path: '/kind',
    });
  }
  if (state.contractVersion !== STATE_CONTRACT_VERSION) {
    throw schemaError('SCHEMA_STATE_VERSION_UNSUPPORTED', 'State contractVersion is not supported.', {
      path: '/contractVersion',
      details: { contractVersion: state.contractVersion },
    });
  }
  if (!Number.isInteger(state.revision) || state.revision < 0) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State revision must be a non-negative integer.', {
      path: '/revision',
    });
  }
  validateEnvironmentShape(state.environment);
  if (state.manifestHash !== undefined) {
    assertHash(state.manifestHash, 'manifestHash', '/manifestHash');
  }
  validateResourcesShape(state.resources, registry);
}

function upsertResourceState(state, resourceState, options = {}) {
  const nextState = clonePlain(state);
  validateStateShape(nextState, { registry: options.registry });

  const resourceType = resourceState && resourceState.resourceType;
  const key = resourceState && resourceState.key;
  if (!resourceType || !key) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Resource state must include resourceType and key.');
  }
  if (!nextState.resources[resourceType]) {
    nextState.resources[resourceType] = {};
  }
  nextState.resources[resourceType][key] = buildPersistedResourceState(resourceState);
  validateStateShape(nextState, { registry: options.registry });
  return nextState;
}

function getResourceState(state, resourceType, key) {
  return state &&
    state.resources &&
    state.resources[resourceType] &&
    state.resources[resourceType][key] || null;
}

function buildPersistedResourceState(resourceState) {
  const persisted = {
    adapterVersion: resourceState.adapterVersion,
    bindings: clonePlain(resourceState.bindings || {}),
  };
  if (resourceState.lastAppliedHash !== undefined) {
    assertHash(resourceState.lastAppliedHash, 'lastAppliedHash');
    persisted.lastAppliedHash = resourceState.lastAppliedHash;
  }
  if (resourceState.observedManagedHash !== undefined) {
    assertHash(resourceState.observedManagedHash, 'observedManagedHash');
    persisted.observedManagedHash = resourceState.observedManagedHash;
  }
  if (resourceState.remoteSchemaHash !== undefined) {
    assertHash(resourceState.remoteSchemaHash, 'remoteSchemaHash');
    persisted.remoteSchemaHash = resourceState.remoteSchemaHash;
  }
  if (resourceState.lastApplied !== undefined) {
    persisted.lastApplied = clonePlain(resourceState.lastApplied);
  }
  return persisted;
}

function validateResourcesShape(resources, registry) {
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State resources must be an object.', {
      path: '/resources',
    });
  }

  for (const resourceType of Object.keys(resources)) {
    const adapter = registry.get(resourceType);
    const resourceMap = resources[resourceType];
    const resourceMapPath = `/resources/${escapePointer(resourceType)}`;
    if (!resourceMap || typeof resourceMap !== 'object' || Array.isArray(resourceMap)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'State resource type entries must be objects.', {
        path: resourceMapPath,
      });
    }
    for (const key of Object.keys(resourceMap)) {
      validateResourceEntry(resourceMap[key], {
        adapter,
        key,
        path: `${resourceMapPath}/${escapePointer(key)}`,
        resourceType,
      });
    }
  }
}

function validateResourceEntry(entry, context) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State resource entry must be an object.', {
      path: context.path,
    });
  }
  assertAllowedKeys(entry, [
    'adapterVersion',
    'bindings',
    'lastAppliedHash',
    'observedManagedHash',
    'remoteSchemaHash',
    'lastApplied',
  ], context.path);

  if (!Number.isInteger(entry.adapterVersion) || entry.adapterVersion < 1) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State resource adapterVersion must be a supported integer.', {
      path: `${context.path}/adapterVersion`,
    });
  }
  if (entry.adapterVersion !== context.adapter.adapterVersion) {
    throw schemaError('SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED', 'State resource adapterVersion is not supported by the current adapter.', {
      path: `${context.path}/adapterVersion`,
      details: {
        resourceType: context.resourceType,
        key: context.key,
        stateAdapterVersion: entry.adapterVersion,
        adapterVersion: context.adapter.adapterVersion,
      },
    });
  }
  if (!entry.bindings || typeof entry.bindings !== 'object' || Array.isArray(entry.bindings)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State resource bindings must be an object.', {
      path: `${context.path}/bindings`,
    });
  }
  for (const hashKey of ['lastAppliedHash', 'observedManagedHash', 'remoteSchemaHash']) {
    if (entry[hashKey] !== undefined) {
      assertHash(entry[hashKey], hashKey, `${context.path}/${hashKey}`);
    }
  }
  if (entry.lastApplied !== undefined && (!entry.lastApplied || typeof entry.lastApplied !== 'object' || Array.isArray(entry.lastApplied))) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State lastApplied must be a compact managed object.', {
      path: `${context.path}/lastApplied`,
    });
  }
  if (typeof context.adapter.validateStateResource === 'function') {
    context.adapter.validateStateResource({
      key: context.key,
      resourceType: context.resourceType,
      state: entry,
      path: context.path,
    });
  }
}

function validateEnvironmentShape(environment) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'State environment must be an object.', {
      path: '/environment',
    });
  }
  assertAllowedKeys(environment, ['environmentKey', 'corpIdHash'], '/environment');
  assertHash(environment.environmentKey, 'environmentKey', '/environment/environmentKey');
  assertHash(environment.corpIdHash, 'corpIdHash', '/environment/corpIdHash');
}

function validateForbiddenStateKeys(value, pathSegments = []) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateForbiddenStateKeys(item, pathSegments.concat(String(index))));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const canonical = canonicalizeKey(key);
    if (SENSITIVE_STATE_KEY_CANONICALS.has(canonical) || isForbiddenRealIdLocation(pathSegments, key, canonical)) {
      throw schemaError('SCHEMA_STATE_FORBIDDEN_FIELD', 'State must not contain credentials, internal paths, or remote IDs outside adapter bindings.', {
        path: formatJsonPointer(pathSegments.concat(key)),
        details: { key },
      });
    }
    validateForbiddenStateKeys(child, pathSegments.concat(key));
  }
}

function isForbiddenRealIdLocation(pathSegments, key, canonical) {
  if (!REAL_ID_KEY_CANONICALS.has(canonical)) {
    return false;
  }
  const segments = pathSegments.concat(key);
  if (segments.length < 5 || segments[0] !== 'resources') {
    return true;
  }
  const resourceType = segments[1];
  if (canonical === 'apptype') {
    return !(
      segments.length === 5 &&
      segments[3] === 'bindings' &&
      segments[4] === key &&
      (resourceType === 'app' || resourceType === 'form' || resourceType === 'page' || resourceType === 'process')
    );
  }
  if (canonical === 'formuuid') {
    return !(
      segments.length === 5 &&
      (resourceType === 'form' || resourceType === 'page' || resourceType === 'process') &&
      segments[3] === 'bindings' &&
      segments[4] === key
    );
  }
  if (canonical === 'fieldid') {
    return !(segments.length === 7 && resourceType === 'form' && segments[3] === 'bindings' && segments[4] === 'fieldBindings' && segments[6] === key);
  }
  if (canonical === 'processcode') {
    return !(
      segments.length === 5 &&
      segments[3] === 'bindings' &&
      segments[4] === key
    );
  }
  if (canonical === 'processid' || canonical === 'processversion') {
    return !(segments.length === 5 && segments[3] === 'bindings' && segments[4] === key);
  }
  if (canonical === 'nodeid') {
    return !(
      segments.length === 7 &&
      segments[3] === 'bindings' &&
      segments[4] === 'nodeBindings' &&
      segments[6] === key
    );
  }
  return true;
}

function assertEnvironmentMatches(actual, expected) {
  if (
    actual.environmentKey !== expected.environmentKey ||
    actual.corpIdHash !== expected.corpIdHash
  ) {
    throw schemaError('SCHEMA_STATE_ENVIRONMENT_MISMATCH', 'State belongs to a different environment.', {
      path: '/environment',
      details: {
        environmentKey: actual.environmentKey,
        corpIdHash: actual.corpIdHash,
      },
    });
  }
}

function assertAllowedKeys(value, allowedKeys, pointer) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'State contains an unknown property.', {
        path: pointer === '/' ? `/${escapePointer(key)}` : `${pointer}/${escapePointer(key)}`,
        details: { property: key },
      });
    }
  }
}

function assertHash(value, name, pointer) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw schemaError('SCHEMA_STATE_INVALID', `${name} must be a sha256 hash.`, {
      path: pointer,
      details: { field: name },
    });
  }
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || '').trim().replace(/\/+$/, '').toLowerCase();
}

function fsyncDirectoryBestEffort(fsImpl, dir) {
  if (typeof fsImpl.openSync !== 'function' || typeof fsImpl.fsyncSync !== 'function') {
    return;
  }
  let dirFd;
  try {
    dirFd = fsImpl.openSync(dir, 'r');
    fsImpl.fsyncSync(dirFd);
  } catch (error) {
    // Directory fsync is not portable across all filesystems.
  } finally {
    if (dirFd !== undefined) {
      try {
        fsImpl.closeSync(dirFd);
      } catch (closeError) {
        // Best effort cleanup.
      }
    }
  }
}

function clonePlain(value) {
  if (value === undefined || value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function formatJsonPointer(segments) {
  if (!segments || segments.length === 0) {
    return '/';
  }
  return '/' + segments.map(escapePointer).join('/');
}

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function compareResourceIds(left, right) {
  return compareCodePoints(`${left.resourceType}:${left.key}`, `${right.resourceType}:${right.key}`);
}

module.exports = {
  STATE_KIND,
  STATE_CONTRACT_VERSION,
  compareResourceIds,
  createEmptyState,
  createEnvironmentIdentity,
  createSha256,
  getResourceState,
  hashStable,
  readState,
  resolveDefaultStatePath,
  upsertResourceState,
  validateState,
  writeStateAtomic,
};
