'use strict';

const { schemaError } = require('./errors');

const MANIFEST_INPUT_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxDepth: 80,
  maxNodes: 20000,
  maxCollectionItems: 1000,
  maxStringLength: 8192,
});

const MANIFEST_LIMIT_KEYS = Object.freeze(Object.keys(MANIFEST_INPUT_LIMITS));

function createManifestLimitState(options = {}) {
  return {
    limits: resolveManifestInputLimits(options),
    nodes: 0,
    seen: typeof WeakSet === 'function' ? new WeakSet() : null,
  };
}

function resolveManifestInputLimits(options = {}) {
  const overrides = options.limits;
  if (overrides === undefined) {
    return Object.assign({}, MANIFEST_INPUT_LIMITS);
  }
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throwInvalidLimit();
  }

  const result = {};
  const knownKeys = new Set(MANIFEST_LIMIT_KEYS);
  for (const key of Object.keys(overrides)) {
    if (!knownKeys.has(key)) {
      throwInvalidLimit();
    }
  }
  for (const key of MANIFEST_LIMIT_KEYS) {
    const defaultValue = MANIFEST_INPUT_LIMITS[key];
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) {
      result[key] = defaultValue;
      continue;
    }
    const override = overrides[key];
    if (!Number.isSafeInteger(override) || override <= 0) {
      throwInvalidLimit();
    }
    result[key] = Math.min(defaultValue, override);
  }
  return result;
}

function throwInvalidLimit() {
  throw schemaError('SCHEMA_MANIFEST_LIMIT_INVALID', 'Manifest input limit override is invalid.');
}

function assertManifestFileSize(byteLength, options = {}) {
  const limits = resolveManifestInputLimits(options);
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    throw schemaError('SCHEMA_MANIFEST_LOAD_FAILED', 'Unable to read manifest file.');
  }
  if (byteLength > limits.maxBytes) {
    throw schemaError('SCHEMA_MANIFEST_TOO_LARGE', 'Manifest file exceeds the maximum supported size.', {
      path: '/',
      details: {
        limit: limits.maxBytes,
      },
    });
  }
}

function assertManifestNode(state, pathSegments, depth) {
  if (depth > state.limits.maxDepth) {
    throw schemaError('SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED', 'Manifest JSON exceeds the maximum supported depth.', {
      path: formatJsonPointer(pathSegments),
      details: {
        limit: state.limits.maxDepth,
      },
    });
  }
  state.nodes += 1;
  if (state.nodes > state.limits.maxNodes) {
    throw schemaError('SCHEMA_MANIFEST_NODE_LIMIT_EXCEEDED', 'Manifest JSON exceeds the maximum supported node count.', {
      path: formatJsonPointer(pathSegments),
      details: {
        limit: state.limits.maxNodes,
      },
    });
  }
}

function assertManifestCollectionSize(state, size, pathSegments) {
  if (size > state.limits.maxCollectionItems) {
    throw schemaError('SCHEMA_MANIFEST_COLLECTION_LIMIT_EXCEEDED', 'Manifest JSON collection exceeds the maximum supported item count.', {
      path: formatJsonPointer(pathSegments),
      details: {
        limit: state.limits.maxCollectionItems,
      },
    });
  }
}

function assertManifestStringLength(state, value, pathSegments) {
  if (String(value).length > state.limits.maxStringLength) {
    throw schemaError('SCHEMA_MANIFEST_STRING_LIMIT_EXCEEDED', 'Manifest JSON string exceeds the maximum supported length.', {
      path: formatJsonPointer(pathSegments),
      details: {
        limit: state.limits.maxStringLength,
      },
    });
  }
}

function assertManifestObjectLimits(value, options = {}) {
  const state = createManifestLimitState(options);
  visit(value, state, [], 0);
}

function visit(value, state, pathSegments, depth) {
  assertManifestNode(state, pathSegments, depth);
  if (typeof value === 'string') {
    assertManifestStringLength(state, value, pathSegments);
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  if (state.seen) {
    if (state.seen.has(value)) {
      throw schemaError('SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED', 'Manifest JSON object graph must be acyclic.', {
        path: formatJsonPointer(pathSegments),
      });
    }
    state.seen.add(value);
  }
  if (Array.isArray(value)) {
    assertManifestCollectionSize(state, value.length, pathSegments);
    value.forEach((item, index) => visit(item, state, pathSegments.concat(String(index)), depth + 1));
    return;
  }
  if (!isPlainJsonObject(value)) {
    throw schemaError('SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED', 'Manifest JSON object graph must contain only plain objects and arrays.', {
      path: formatJsonPointer(pathSegments),
    });
  }
  const keys = Object.keys(value);
  assertManifestCollectionSize(state, keys.length, pathSegments);
  keys.forEach((key) => {
    assertManifestStringLength(state, key, pathSegments.concat(key));
    visit(value[key], state, pathSegments.concat(key), depth + 1);
  });
}

function isPlainJsonObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formatJsonPointer(segments) {
  if (!segments || segments.length === 0) {
    return '/';
  }
  return '/' + segments.map(segment => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

module.exports = {
  MANIFEST_INPUT_LIMITS,
  assertManifestCollectionSize,
  assertManifestFileSize,
  assertManifestNode,
  assertManifestObjectLimits,
  assertManifestStringLength,
  createManifestLimitState,
  formatJsonPointer,
  resolveManifestInputLimits,
};
