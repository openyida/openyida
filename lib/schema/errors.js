'use strict';

const VALIDATION_KIND = 'openyida_schema_validation';
const PLAN_KIND = 'openyida_schema_plan';
const APPLY_KIND = 'openyida_schema_apply';
const CONTRACT_VERSION = 1;
const TRUSTED_SCHEMA_ERROR = Symbol('openyida.schema.trustedError');

const PLAN_RESOURCE_TYPES = new Set([
  'app',
  'automation',
  'form',
  'page',
  'process',
  'report',
]);

const PLAN_MANIFEST_PATH_CODES = new Set([
  'SCHEMA_DUPLICATE_KEY',
  'SCHEMA_FIELD_PROPERTY_INVALID',
  'SCHEMA_FIELD_TYPE_UNSUPPORTED',
  'SCHEMA_FORM_FIELDS_REQUIRED',
  'SCHEMA_INVALID_ARGUMENTS',
  'SCHEMA_INVALID_KEY',
  'SCHEMA_INVALID_KIND',
  'SCHEMA_INVALID_REFERENCE',
  'SCHEMA_MANIFEST_LIMIT_INVALID',
  'SCHEMA_MANIFEST_SCHEMA_INVALID',
  'SCHEMA_MANIFEST_COLLECTION_LIMIT_EXCEEDED',
  'SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED',
  'SCHEMA_MANIFEST_NODE_LIMIT_EXCEEDED',
  'SCHEMA_MANIFEST_PATH_UNSAFE',
  'SCHEMA_MANIFEST_STRING_LIMIT_EXCEEDED',
  'SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED',
  'SCHEMA_MANIFEST_TOO_LARGE',
  'SCHEMA_PROCESS_FORM_MODE_REQUIRED',
  'SCHEMA_PROCESS_NODE_PROPERTY_INVALID',
  'SCHEMA_PROCESS_NODE_TYPE_UNSUPPORTED',
  'SCHEMA_REFERENCE_NOT_FOUND',
  'SCHEMA_RESOURCE_TYPE_UNSUPPORTED',
  'SCHEMA_UNKNOWN_PROPERTY',
  'SCHEMA_UNSUPPORTED_VERSION',
]);

const PLAN_SAFE_MESSAGES = Object.freeze({
  SCHEMA_DEPENDENCY_CYCLE: 'Schema plan failed because the manifest dependency graph contains a cycle.',
  SCHEMA_DEPENDENCY_NOT_FOUND: 'Schema plan failed because a dependency target does not exist.',
  SCHEMA_DUPLICATE_KEY: 'Schema plan failed because a semantic key is duplicated.',
  SCHEMA_FIELD_PROPERTY_INVALID: 'Schema plan failed because a field property is invalid.',
  SCHEMA_FIELD_TYPE_UNSUPPORTED: 'Schema plan failed because a field type is unsupported.',
  SCHEMA_FORBIDDEN_FIELD: 'Schema plan failed because the manifest contains a forbidden field.',
  SCHEMA_FORM_FIELDS_REQUIRED: 'Schema plan failed because a form has no fields.',
  SCHEMA_INVALID_ARGUMENTS: 'Schema plan arguments are invalid.',
  SCHEMA_INVALID_KIND: 'Schema plan failed because the manifest kind is invalid.',
  SCHEMA_INVALID_KEY: 'Schema plan failed because a semantic key is invalid.',
  SCHEMA_INVALID_REFERENCE: 'Schema plan failed because a resource reference is invalid.',
  SCHEMA_MANIFEST_LOAD_FAILED: 'Schema plan failed because the manifest could not be read.',
  SCHEMA_MANIFEST_LIMIT_INVALID: 'Schema plan failed because the manifest input limit configuration is invalid.',
  SCHEMA_MANIFEST_PARSE_FAILED: 'Schema plan failed because the manifest JSON is invalid.',
  SCHEMA_MANIFEST_PATH_UNSAFE: 'Schema plan failed because the manifest path is outside the workspace trust root.',
  SCHEMA_MANIFEST_COLLECTION_LIMIT_EXCEEDED: 'Schema plan failed because the manifest JSON collection limit was exceeded.',
  SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED: 'Schema plan failed because the manifest JSON depth limit was exceeded.',
  SCHEMA_MANIFEST_NODE_LIMIT_EXCEEDED: 'Schema plan failed because the manifest JSON node limit was exceeded.',
  SCHEMA_MANIFEST_SCHEMA_INVALID: 'Schema plan failed because the manifest schema is invalid.',
  SCHEMA_MANIFEST_STRING_LIMIT_EXCEEDED: 'Schema plan failed because the manifest JSON string limit was exceeded.',
  SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED: 'Schema plan failed because the manifest JSON structure is unsupported.',
  SCHEMA_MANIFEST_TOO_LARGE: 'Schema plan failed because the manifest file is too large.',
  SCHEMA_OBSERVED_BINDING_MISSING: 'Schema plan failed because an observed binding is missing.',
  SCHEMA_OBSERVED_REFERENCE_AMBIGUOUS: 'Schema plan failed because an observed reference is ambiguous.',
  SCHEMA_OBSERVED_REFERENCE_MISSING: 'Schema plan failed because an observed reference is missing.',
  SCHEMA_OBSERVED_STRUCTURE_MISMATCH: 'Schema plan failed because observed structure does not match managed state.',
  SCHEMA_PLAN_STATE_INTEGRITY_FAILED: 'Schema plan failed because state integrity verification failed.',
  SCHEMA_PROCESS_FORM_MODE_REQUIRED: 'Schema plan failed because a process form does not declare process mode.',
  SCHEMA_PROCESS_COMPILE_FAILED: 'Schema plan failed because a process resource could not be compiled.',
  SCHEMA_PROCESS_NODE_PROPERTY_INVALID: 'Schema plan failed because a process node property is invalid.',
  SCHEMA_PROCESS_NODE_TYPE_UNSUPPORTED: 'Schema plan failed because a process node type is unsupported.',
  SCHEMA_REFERENCE_NOT_FOUND: 'Schema plan failed because a referenced resource does not exist.',
  SCHEMA_REMOTE_PROJECT_FAILED: 'Schema plan failed because remote observed projection failed.',
  SCHEMA_REMOTE_READ_FAILED: 'Schema plan failed because remote observed read failed.',
  SCHEMA_REMOTE_RESOURCE_MISSING: 'Schema plan detected that a bound remote resource is missing.',
  SCHEMA_RESOURCE_TYPE_UNSUPPORTED: 'Schema plan failed because a resource type is unsupported.',
  SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED: 'Schema plan failed because state adapterVersion is unsupported.',
  SCHEMA_STATE_ENVIRONMENT_MISMATCH: 'Schema plan failed because state belongs to a different environment.',
  SCHEMA_STATE_ENVIRONMENT_REQUIRED: 'Schema plan requires environment identity.',
  SCHEMA_STATE_FORBIDDEN_FIELD: 'Schema plan failed because state contains forbidden data.',
  SCHEMA_STATE_INVALID: 'Schema plan failed because state is invalid.',
  SCHEMA_STATE_READ_FAILED: 'Schema plan failed because state could not be read.',
  SCHEMA_STATE_RESOURCE_BINDING_MISSING: 'Schema plan failed because state bindings are missing.',
  SCHEMA_STATE_VERSION_UNSUPPORTED: 'Schema plan failed because state contractVersion is unsupported.',
  SCHEMA_STATE_WRITE_FAILED: 'Schema plan failed because state could not be written.',
  SCHEMA_UNKNOWN_PROPERTY: 'Schema plan failed because an unknown property was found.',
  SCHEMA_UNSUPPORTED_VERSION: 'Schema plan failed because manifest schemaVersion is unsupported.',
});

const APPLY_SAFE_MESSAGES = Object.freeze({
  SCHEMA_APPLY_BLOCKED: 'Schema apply is blocked by a non-executable plan change.',
  SCHEMA_APPLY_DESTRUCTIVE_CHANGE_UNSUPPORTED: 'Schema apply does not support this destructive managed change.',
  SCHEMA_APPLY_JIT_CONFLICT: 'Schema apply stopped because the resource changed after planning.',
  SCHEMA_APPLY_JOURNAL_INVALID: 'Schema apply recovery journal is invalid.',
  SCHEMA_APPLY_JOURNAL_READ_FAILED: 'Schema apply recovery journal could not be read.',
  SCHEMA_APPLY_JOURNAL_WRITE_FAILED: 'Schema apply recovery journal could not be checkpointed.',
  SCHEMA_APPLY_LOCKED: 'Schema apply is already running for this state.',
  SCHEMA_APPLY_LOCK_FAILED: 'Schema apply could not acquire its state lock.',
  SCHEMA_APPLY_LOCK_RELEASE_FAILED: 'Schema apply could not release its state lock.',
  SCHEMA_APPLY_PATH_UNSAFE: 'Schema apply state path is outside the allowed workspace boundary.',
  SCHEMA_APPLY_PLAN_STALE: 'Schema apply stopped because the reviewed plan is stale.',
  SCHEMA_APPLY_VERIFY_FAILED: 'Schema apply post-write verification did not match desired state.',
  SCHEMA_INVALID_ARGUMENTS: 'Schema apply arguments are invalid.',
  SCHEMA_MANIFEST_LOAD_FAILED: 'Schema apply failed because the manifest could not be read.',
  SCHEMA_MANIFEST_LIMIT_INVALID: 'Schema apply failed because the manifest input limit configuration is invalid.',
  SCHEMA_MANIFEST_PARSE_FAILED: 'Schema apply failed because the manifest JSON is invalid.',
  SCHEMA_MANIFEST_PATH_UNSAFE: 'Schema apply failed because the manifest path is outside the workspace trust root.',
  SCHEMA_MANIFEST_COLLECTION_LIMIT_EXCEEDED: 'Schema apply failed because the manifest JSON collection limit was exceeded.',
  SCHEMA_MANIFEST_DEPTH_LIMIT_EXCEEDED: 'Schema apply failed because the manifest JSON depth limit was exceeded.',
  SCHEMA_MANIFEST_NODE_LIMIT_EXCEEDED: 'Schema apply failed because the manifest JSON node limit was exceeded.',
  SCHEMA_MANIFEST_STRING_LIMIT_EXCEEDED: 'Schema apply failed because the manifest JSON string limit was exceeded.',
  SCHEMA_MANIFEST_STRUCTURE_UNSUPPORTED: 'Schema apply failed because the manifest JSON structure is unsupported.',
  SCHEMA_MANIFEST_TOO_LARGE: 'Schema apply failed because the manifest file is too large.',
  SCHEMA_PROCESS_COMPILE_FAILED: 'Schema apply failed because a process resource could not be compiled.',
  SCHEMA_REMOTE_PROJECT_FAILED: 'Schema apply failed because remote observed projection failed.',
  SCHEMA_REMOTE_READ_FAILED: 'Schema apply failed because remote observed read failed.',
  SCHEMA_RECONCILIATION_REQUIRED: 'Schema apply stopped because remote reconciliation is required.',
  SCHEMA_RESOURCE_TYPE_UNSUPPORTED: 'Schema apply failed because a resource type is unsupported.',
  SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED: 'Schema apply failed because state adapterVersion is unsupported.',
  SCHEMA_STATE_ENVIRONMENT_MISMATCH: 'Schema apply failed because state belongs to a different environment.',
  SCHEMA_STATE_ENVIRONMENT_REQUIRED: 'Schema apply requires environment identity.',
  SCHEMA_STATE_INVALID: 'Schema apply failed because state is invalid.',
  SCHEMA_STATE_READ_FAILED: 'Schema apply failed because state could not be read.',
  SCHEMA_STATE_RESOURCE_BINDING_MISSING: 'Schema apply failed because required state bindings are missing.',
  SCHEMA_STATE_VERSION_UNSUPPORTED: 'Schema apply failed because state contractVersion is unsupported.',
  SCHEMA_STATE_WRITE_FAILED: 'Schema apply could not checkpoint state.',
});

const PLAN_DETAIL_PROJECTORS = Object.freeze({
  SCHEMA_APPLY_BLOCKED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    operation: projectOperation,
    resourceType: projectResourceType,
  }),
  SCHEMA_APPLY_DESTRUCTIVE_CHANGE_UNSUPPORTED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    operation: projectOperation,
    resourceType: projectResourceType,
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_APPLY_JIT_CONFLICT: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    operation: projectOperation,
    resourceType: projectResourceType,
  }),
  SCHEMA_APPLY_VERIFY_FAILED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_FIELD_PROPERTY_INVALID: details => projectPlanDetailObject(details, {
    property: projectSafeName,
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_FIELD_TYPE_UNSUPPORTED: details => projectPlanDetailObject(details, {
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_INVALID_REFERENCE: details => projectPlanDetailObject(details, {
    resourceType: projectResourceType,
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_OBSERVED_BINDING_MISSING: details => projectPlanDetailObject(details, {
    resourceType: projectResourceType,
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_OBSERVED_REFERENCE_AMBIGUOUS: details => projectPlanDetailObject(details, {
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_OBSERVED_REFERENCE_MISSING: details => projectPlanDetailObject(details, {
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_OBSERVED_STRUCTURE_MISMATCH: details => projectPlanDetailObject(details, {
    actualParentBound: projectBoolean,
    expectedParentBound: projectBoolean,
    semanticPath: projectSemanticPath,
  }),
  SCHEMA_PLAN_STATE_INTEGRITY_FAILED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_PROCESS_COMPILE_FAILED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_REMOTE_PROJECT_FAILED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_REMOTE_READ_FAILED: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_REMOTE_RESOURCE_MISSING: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_RESOURCE_TYPE_UNSUPPORTED: details => projectPlanDetailObject(details, {
    resourceType: projectResourceType,
    section: projectSafeName,
  }),
  SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED: details => projectPlanDetailObject(details, {
    adapterVersion: projectAdapterVersion,
    key: projectSemanticKey,
    resourceType: projectResourceType,
    stateAdapterVersion: projectAdapterVersion,
  }),
  SCHEMA_STATE_RESOURCE_BINDING_MISSING: details => projectPlanDetailObject(details, {
    key: projectSemanticKey,
    resourceType: projectResourceType,
  }),
  SCHEMA_UNKNOWN_PROPERTY: details => projectPlanDetailObject(details, {
    property: projectSafeName,
  }),
});

class SchemaValidationError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'SchemaValidationError';
    this.code = code;
    this.path = options.path;
    this.details = sanitizeDetails(options.details);
    this.exitCode = options.exitCode || 1;
    this[TRUSTED_SCHEMA_ERROR] = options.trusted !== false;
  }
}

function sanitizeDetails(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDetails(item));
  }

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) {
      continue;
    }
    if (isSensitiveDetailKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeDetails(child);
    }
  }
  return result;
}

function isSensitiveDetailKey(key) {
  return /cookie|token|secret|authorization|credential|header|csrf|schema|internalPath/i.test(String(key));
}

function schemaError(code, message, options = {}) {
  return new SchemaValidationError(code, message, options);
}

function normalizeError(error) {
  if (error instanceof SchemaValidationError) {
    return error;
  }
  if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
    return new SchemaValidationError(error.code, error.message || 'Schema validation failed', {
      path: error.path,
      details: error.details,
      trusted: false,
    });
  }
  return new SchemaValidationError(
    'SCHEMA_INTERNAL_ERROR',
    'Schema validation failed because of an internal error.'
  );
}

function toFailurePayload(error, kind = VALIDATION_KIND, options = {}) {
  const normalized = normalizeError(error);
  const usePlanSanitizer = options.plan === true || kind === PLAN_KIND;
  const trustedPlanError = usePlanSanitizer && isTrustedSchemaError(normalized);
  const details = usePlanSanitizer
    ? trustedPlanError ? projectPlanDetails(normalized.code, normalized.details) : undefined
    : normalized.details;
  const path = usePlanSanitizer
    ? trustedPlanError ? projectPlanPath(normalized.code, normalized.path) : undefined
    : normalized.path;
  const payload = {
    kind,
    contractVersion: CONTRACT_VERSION,
    success: false,
    error: {
      code: normalized.code,
      message: usePlanSanitizer
        ? projectSafeErrorMessage(normalized.code, options.safeMessages, options.safeFallback)
        : normalized.message,
    },
  };
  if (path) {
    payload.error.path = path;
  }
  if (details !== undefined) {
    payload.error.details = details;
  }
  return payload;
}

function toPlanFailurePayload(error) {
  return toFailurePayload(error, PLAN_KIND, {
    plan: true,
    safeMessages: PLAN_SAFE_MESSAGES,
    safeFallback: 'Schema plan failed.',
  });
}

function toApplyFailurePayload(error) {
  return toFailurePayload(error, APPLY_KIND, {
    plan: true,
    safeMessages: APPLY_SAFE_MESSAGES,
    safeFallback: 'Schema apply failed.',
  });
}

function toSuccessPayload(result) {
  return {
    kind: VALIDATION_KIND,
    contractVersion: CONTRACT_VERSION,
    success: true,
    manifestHash: result.manifestHash,
    counts: {
      resources: result.counts.resources,
      dependencies: result.counts.dependencies,
    },
  };
}

function projectSafeErrorMessage(code, safeMessages, fallback) {
  return safeMessages && safeMessages[code] || fallback || 'Schema operation failed.';
}

function projectPlanDetails(code, details) {
  const projector = PLAN_DETAIL_PROJECTORS[code];
  return projector ? projector(details) : undefined;
}

function projectPlanDetailObject(details, projectors) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }
  const result = {};
  for (const [key, projector] of Object.entries(projectors)) {
    const projected = projector(details[key]);
    if (projected !== undefined) {
      result[key] = projected;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function projectPlanPath(code, path) {
  if (!PLAN_MANIFEST_PATH_CODES.has(code) || !isSafeManifestPointer(path)) {
    return undefined;
  }
  return path;
}

function projectAdapterVersion(value) {
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function projectBoolean(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function projectOperation(value) {
  return ['conflict', 'create', 'orphan', 'remove', 'replace_type', 'stateRepair', 'unmanaged', 'update'].includes(value)
    ? value
    : undefined;
}

function projectResourceType(value) {
  if (typeof value !== 'string' || !PLAN_RESOURCE_TYPES.has(value)) {
    return undefined;
  }
  return value;
}

function projectSafeName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
    return undefined;
  }
  return hasSensitiveSemanticToken(value) ? undefined : value;
}

function projectSemanticKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
    return undefined;
  }
  if (hasSensitiveSemanticToken(value) || looksLikeRemoteIdentifier(value)) {
    return undefined;
  }
  return value;
}

function projectSemanticPath(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const segments = value.split('.');
  if (segments.length === 0 || segments.some(segment => projectSemanticKey(segment) === undefined)) {
    return undefined;
  }
  return value;
}

function isSafeManifestPointer(path) {
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    return false;
  }
  const segments = path.split('/').slice(1).map(unescapePointerSegment);
  if (!['app', 'forms', 'kind', 'processes', 'schemaVersion'].includes(segments[0])) {
    return false;
  }
  return segments.every(segment => (
    segment === '' ||
    /^[A-Za-z0-9_~.-]+$/.test(segment) &&
    !hasSensitiveSemanticToken(segment) &&
    !looksLikeRemoteIdentifier(segment)
  ));
}

function hasSensitiveSemanticToken(value) {
  const normalized = String(value).replace(/[-_\s]/g, '').toLowerCase();
  return (
    normalized.includes('apikey') ||
    normalized.includes('authorization') ||
    normalized.includes('cookie') ||
    normalized.includes('credential') ||
    normalized.includes('csrf') ||
    normalized.includes('fieldid') ||
    normalized.includes('formuuid') ||
    normalized.includes('header') ||
    normalized.includes('internalpath') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token')
  );
}

function looksLikeRemoteIdentifier(value) {
  return (
    /^(APP|FORM|PROC|TPROC|LPROC)_[A-Za-z0-9_-]+$/.test(value) ||
    /^[a-z]+Field_[A-Za-z0-9_.-]+$/.test(value)
  );
}

function isTrustedSchemaError(error) {
  return error instanceof SchemaValidationError && error[TRUSTED_SCHEMA_ERROR] === true;
}

function unescapePointerSegment(segment) {
  return String(segment).replace(/~1/g, '/').replace(/~0/g, '~');
}

module.exports = {
  APPLY_KIND,
  CONTRACT_VERSION,
  PLAN_KIND,
  VALIDATION_KIND,
  SchemaValidationError,
  isTrustedSchemaError,
  schemaError,
  toApplyFailurePayload,
  toPlanFailurePayload,
  toFailurePayload,
  toSuccessPayload,
};
