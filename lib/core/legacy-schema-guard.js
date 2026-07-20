'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('./cli-error');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on', 'schema-managed']);
const CONTEXT_FLAGS = new Set(['--schema-managed-context', '--resource-context', '--schema-context']);
const STATE_FLAGS = new Set(['--schema-state', '--schema-state-path']);

function extractLegacyGuardArgs(rawArgs = []) {
  const args = [];
  const guardOptions = {
    schemaManaged: false,
    contextInputs: [],
    statePaths: [],
  };

  for (let index = 0; index < rawArgs.length; index++) {
    const arg = rawArgs[index];
    if (arg === '--schema-managed') {
      guardOptions.schemaManaged = true;
      continue;
    }
    if (typeof arg === 'string' && arg.startsWith('--schema-managed=')) {
      guardOptions.schemaManaged = isTruthy(arg.slice('--schema-managed='.length));
      continue;
    }
    const inlineContext = readInlineValue(arg, CONTEXT_FLAGS);
    if (inlineContext !== null) {
      guardOptions.contextInputs.push(inlineContext);
      continue;
    }
    if (CONTEXT_FLAGS.has(arg)) {
      const value = rawArgs[index + 1];
      if (!value || String(value).startsWith('--')) {
        throw invalidGuardInput(`${arg} requires a JSON value or file path`);
      }
      guardOptions.contextInputs.push(value);
      index += 1;
      continue;
    }
    const inlineState = readInlineValue(arg, STATE_FLAGS);
    if (inlineState !== null) {
      guardOptions.statePaths.push(inlineState);
      continue;
    }
    if (STATE_FLAGS.has(arg)) {
      const value = rawArgs[index + 1];
      if (!value || String(value).startsWith('--')) {
        throw invalidGuardInput(`${arg} requires a state file path`);
      }
      guardOptions.statePaths.push(value);
      index += 1;
      continue;
    }
    args.push(arg);
  }

  return { args, guardOptions };
}

function assertLegacyDirectWriteAllowed(target = {}, options = {}) {
  const env = options.env || process.env;
  const fsImpl = options.fsImpl || fs;
  const cwd = options.cwd || process.cwd();
  const guardOptions = options.guardOptions || {};
  const contexts = collectContexts(guardOptions, env, fsImpl, cwd);
  const statePaths = collectStatePaths(guardOptions, env);
  const reasons = [];

  if (guardOptions.schemaManaged || isTruthy(env.OPENYIDA_SCHEMA_MANAGED)) {
    reasons.push({ source: 'explicit_schema_managed_flag' });
  }

  for (const context of contexts) {
    const managedReason = matchManagedContext(context, target);
    if (managedReason) {
      reasons.push(managedReason);
    }
  }

  for (const statePath of statePaths) {
    const stateReason = matchManagedStatePath(statePath, target, { fsImpl, cwd });
    if (stateReason) {
      reasons.push(stateReason);
    }
  }

  if (reasons.length > 0) {
    throw new CliError(
      `Refusing legacy direct ${target.command || 'write'} because the target is schema-managed. Use openyida schema validate -> schema plan -> schema apply.`,
      {
        code: 'LEGACY_SCHEMA_MANAGED_GUARD',
        details: sanitizeGuardDetails(target, reasons),
      }
    );
  }

  const conflict = findBoundResourceConflict(contexts, target);
  if (conflict) {
    throw new CliError(
      `Refusing legacy direct ${target.command || 'create'} because resource context already contains a bound ${conflict.resourceType}. Reuse the bound resource or set allowCreate=true explicitly.`,
      {
        code: 'LEGACY_RESOURCE_CONTEXT_CONFLICT',
        details: sanitizeGuardDetails(target, [conflict]),
      }
    );
  }
}

function collectContexts(guardOptions, env, fsImpl, cwd) {
  const inputs = [];
  if (env.OPENYIDA_RESOURCE_CONTEXT) {
    inputs.push(env.OPENYIDA_RESOURCE_CONTEXT);
  }
  if (env.OPENYIDA_SCHEMA_CONTEXT) {
    inputs.push(env.OPENYIDA_SCHEMA_CONTEXT);
  }
  if (env.OPENYIDA_SCHEMA_MANAGED_CONTEXT) {
    inputs.push(env.OPENYIDA_SCHEMA_MANAGED_CONTEXT);
  }
  if (Array.isArray(guardOptions.contextInputs)) {
    inputs.push(...guardOptions.contextInputs);
  }
  return inputs.map(input => parseContextInput(input, { fsImpl, cwd }));
}

function collectStatePaths(guardOptions, env) {
  const paths = [];
  if (env.OPENYIDA_SCHEMA_STATE) {
    paths.push(env.OPENYIDA_SCHEMA_STATE);
  }
  if (env.OPENYIDA_SCHEMA_STATE_PATH) {
    paths.push(env.OPENYIDA_SCHEMA_STATE_PATH);
  }
  if (Array.isArray(guardOptions.statePaths)) {
    paths.push(...guardOptions.statePaths);
  }
  return paths.filter(Boolean);
}

function parseContextInput(input, options = {}) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input;
  }
  const raw = String(input || '').trim();
  if (!raw) {
    throw invalidGuardInput('Resource context is empty');
  }
  const fsImpl = options.fsImpl || fs;
  const cwd = options.cwd || process.cwd();
  if (raw.startsWith('{') || raw.startsWith('[')) {
    return parseJson(raw, 'Resource context is not valid JSON');
  }
  const contextPath = path.resolve(cwd, raw);
  if (!fsImpl.existsSync(contextPath)) {
    throw invalidGuardInput(`Resource context file not found: ${raw}`);
  }
  return parseJson(fsImpl.readFileSync(contextPath, 'utf8'), `Resource context file is not valid JSON: ${raw}`);
}

function matchManagedContext(context, target) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return null;
  }
  if (isManagedMarker(context)) {
    return { source: 'schema_managed_context', resourceType: target.resourceType };
  }
  const candidates = collectContextResources(context, target.resourceType);
  for (const candidate of candidates) {
    if (isManagedMarker(candidate) && resourceMatchesTarget(candidate, target)) {
      return {
        source: 'schema_managed_context',
        resourceType: target.resourceType,
        key: candidate.key || candidate.name || candidate.source,
      };
    }
  }
  if (target.resourceType === 'process' && target.formUuid) {
    for (const candidate of collectContextResources(context, 'form')) {
      if (isManagedMarker(candidate) && resourceMatchesTarget(candidate, { resourceType: 'form', formUuid: target.formUuid })) {
        return {
          source: 'schema_managed_form_context',
          resourceType: 'form',
          key: candidate.key || candidate.name || candidate.source,
        };
      }
    }
  }
  if (target.resourceType !== 'app' && target.appType) {
    for (const candidate of collectContextResources(context, 'app')) {
      if (isManagedMarker(candidate) && resourceMatchesTarget(candidate, { resourceType: 'app', appType: target.appType })) {
        return {
          source: 'schema_managed_app_context',
          resourceType: 'app',
          key: candidate.key || candidate.name || candidate.source,
        };
      }
    }
  }
  return null;
}

function collectContextResources(context, resourceType) {
  const values = [];
  const direct = context[resourceType];
  if (direct) {
    values.push(direct);
  }
  if (resourceType === 'page' && context.pageContext) {
    values.push(context.pageContext);
  }
  if (resourceType === 'form' && context.formContext) {
    values.push(context.formContext);
  }
  if (Array.isArray(context.resources)) {
    values.push(...context.resources.filter(item => !item.resourceType || item.resourceType === resourceType));
  }
  return values.filter(item => item && typeof item === 'object' && !Array.isArray(item));
}

function matchManagedStatePath(statePath, target, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const cwd = options.cwd || process.cwd();
  const resolved = path.resolve(cwd, statePath);
  if (!fsImpl.existsSync(resolved)) {
    throw invalidGuardInput(`Schema state file not found: ${statePath}`);
  }
  const state = parseJson(fsImpl.readFileSync(resolved, 'utf8'), `Schema state file is not valid JSON: ${statePath}`);
  if (!state || state.kind !== 'openyida_resource_state' || !state.resources || typeof state.resources !== 'object') {
    throw invalidGuardInput(`Schema state file is not an OpenYida resource state: ${statePath}`);
  }
  const directMatch = matchStateResourceCollection(state.resources[target.resourceType], target);
  if (directMatch) {
    return { source: 'schema_state', statePath, resourceType: target.resourceType, key: directMatch.key };
  }
  if (target.resourceType === 'process' && target.formUuid) {
    const formMatch = matchStateResourceCollection(state.resources.form, { resourceType: 'form', formUuid: target.formUuid });
    if (formMatch) {
      return { source: 'schema_state_form', statePath, resourceType: 'form', key: formMatch.key };
    }
  }
  if (target.appType) {
    const appMatch = matchStateResourceCollection(state.resources.app, { resourceType: 'app', appType: target.appType });
    if (appMatch) {
      return { source: 'schema_state_app', statePath, resourceType: 'app', key: appMatch.key };
    }
  }
  return null;
}

function matchStateResourceCollection(collection, target) {
  if (!collection || typeof collection !== 'object') {
    return null;
  }
  for (const [key, entry] of Object.entries(collection)) {
    if (entry && typeof entry === 'object' && resourceMatchesTarget(entry.bindings || {}, target)) {
      return { key };
    }
  }
  return null;
}

function findBoundResourceConflict(contexts, target) {
  if (target.action !== 'create') {
    return null;
  }
  for (const context of contexts) {
    for (const resourceType of getCreateConflictResourceTypes(target)) {
      const candidates = collectContextResources(context, resourceType);
      for (const candidate of candidates) {
        if (candidate && candidate.allowCreate === false && hasBoundIdentity(candidate, resourceType)) {
          return {
            source: 'resource_context',
            resourceType,
          };
        }
      }
    }
  }
  return null;
}

function getCreateConflictResourceTypes(target) {
  if (target.resourceType === 'process') {
    return ['process', 'form'];
  }
  return [target.resourceType];
}

function hasBoundIdentity(resource, resourceType) {
  if (resourceType === 'app') {
    return hasNonEmptyString(resource.appType);
  }
  if (resourceType === 'page' || resourceType === 'form') {
    return hasNonEmptyString(resource.formUuid) || hasNonEmptyString(resource.pageId);
  }
  if (resourceType === 'process') {
    return hasNonEmptyString(resource.processCode) || hasNonEmptyString(resource.formUuid);
  }
  return false;
}

function resourceMatchesTarget(resource, target) {
  if (!resource || typeof resource !== 'object') {
    return false;
  }

  if (target.resourceType === 'app') {
    return hasNonEmptyString(target.appType) &&
      hasNonEmptyString(resource.appType) &&
      String(resource.appType) === String(target.appType);
  }

  if (target.resourceType === 'form' || target.resourceType === 'page') {
    const targetFormUuid = target.formUuid || target.pageId;
    const resourceFormUuid = resource.formUuid || resource.pageId;
    return hasNonEmptyString(targetFormUuid) &&
      hasNonEmptyString(resourceFormUuid) &&
      String(resourceFormUuid) === String(targetFormUuid);
  }

  if (target.resourceType === 'process') {
    if (hasNonEmptyString(target.processCode)) {
      return hasNonEmptyString(resource.processCode) &&
        String(resource.processCode) === String(target.processCode);
    }
    const targetFormUuid = target.formUuid || target.pageId;
    const resourceFormUuid = resource.formUuid || resource.pageId;
    return hasNonEmptyString(targetFormUuid) &&
      hasNonEmptyString(resourceFormUuid) &&
      String(resourceFormUuid) === String(targetFormUuid);
  }

  return false;
}

function isManagedMarker(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return value.schemaManaged === true ||
    value.managed === true ||
    value.executionPath === 'schema-managed' ||
    value.path === 'schema-managed' ||
    value.managedBy === 'schema' ||
    value.source === 'schema_state' ||
    value.source === 'schema_manifest' ||
    value.kind === 'openyida_schema_managed_context';
}

function readInlineValue(arg, names) {
  if (typeof arg !== 'string') {
    return null;
  }
  for (const name of names) {
    const prefix = `${name}=`;
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return null;
}

function parseJson(raw, message) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw invalidGuardInput(message);
  }
}

function invalidGuardInput(message) {
  return new CliError(message, {
    code: 'LEGACY_SCHEMA_GUARD_INVALID_CONTEXT',
  });
}

function isTruthy(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function sanitizeGuardDetails(target, reasons) {
  return {
    command: target.command,
    resourceType: target.resourceType,
    action: target.action,
    appType: target.appType,
    formUuid: target.formUuid,
    processCode: target.processCode,
    reasons,
  };
}

module.exports = {
  assertLegacyDirectWriteAllowed,
  extractLegacyGuardArgs,
  _private: {
    matchManagedContext,
    matchManagedStatePath,
    resourceMatchesTarget,
  },
};
