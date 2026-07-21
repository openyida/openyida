'use strict';

const { loadManifest } = require('./manifest-loader');
const { normalizeManifest } = require('./normalize-manifest');
const {
  APPLY_KIND,
  isTrustedSchemaError,
  schemaError,
  toApplyFailurePayload,
  toFailurePayload,
  toPlanFailurePayload,
  toSuccessPayload,
} = require('./errors');
const { applySchema } = require('./applier');
const { readObservedResources } = require('./remote-reader');
const { createDefaultRegistry } = require('./resource-registry');
const { readState } = require('./state-store');
const {
  PLAN_KIND,
  createPlan,
  selectObservableResources,
} = require('./planner');
const { isServerRevisionConflict } = require('./server-revision');
const {
  extractInfoFromCookies,
  loadCookieData,
  resolveBaseUrl,
} = require('../core/utils');

const RECONCILIATION_CHOICES = Object.freeze([
  'inspect_remote_state',
  'provide_explicit_recovery_input',
  'stop',
]);
const MANAGED_DECISION_CHOICES = Object.freeze([
  'keep_remote',
  'update_manifest',
  'stop',
]);
const SECURITY_FAILURE_CODES = new Set([
  'SCHEMA_APPLY_LOCKED',
  'SCHEMA_APPLY_LOCK_FAILED',
  'SCHEMA_APPLY_LOCK_LOST',
  'SCHEMA_APPLY_PATH_UNSAFE',
  'SCHEMA_FORBIDDEN_FIELD',
  'SCHEMA_MANIFEST_PATH_UNSAFE',
  'SCHEMA_PAGE_SOURCE_PATH_UNSAFE',
  'SCHEMA_PLAN_STATE_INTEGRITY_FAILED',
  'SCHEMA_STATE_ENVIRONMENT_MISMATCH',
  'SCHEMA_STATE_FORBIDDEN_FIELD',
]);
const VALIDATION_FAILURE_CODES = new Set([
  'SCHEMA_APPLY_JOURNAL_INVALID',
  'SCHEMA_DUPLICATE_KEY',
  'SCHEMA_INVALID',
  'SCHEMA_INVALID_ARGUMENTS',
  'SCHEMA_INVALID_KEY',
  'SCHEMA_INVALID_KIND',
  'SCHEMA_INVALID_REFERENCE',
  'SCHEMA_PAGE_FOUNDATION_INITIAL_PROFILE_INVALID',
  'SCHEMA_PAGE_FOUNDATION_OBSERVED_IDENTITY_INVALID',
  'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
  'SCHEMA_PAGE_FOUNDATION_SHELL_PROFILE_INVALID',
  'SCHEMA_PAGE_FOUNDATION_TRANSITION_INVALID',
  'SCHEMA_PAGE_SOURCE_INVALID',
  'SCHEMA_PROCESS_NODE_PROPERTY_INVALID',
  'SCHEMA_STATE_INVALID',
  'SCHEMA_UNKNOWN_PROPERTY',
]);
const VALIDATION_FAILURE_PREFIXES = Object.freeze([
  'SCHEMA_DEPENDENCY_',
  'SCHEMA_FIELD_',
  'SCHEMA_MANIFEST_',
  'SCHEMA_REFERENCE_',
]);

function parseArgs(args) {
  const [subCommand, ...rest] = args;
  if (!subCommand || subCommand === '--help' || subCommand === '-h') {
    return { help: true };
  }
  if (subCommand === 'validate') {
    return parseValidateArgs(rest);
  }
  if (subCommand === 'plan') {
    return parsePlanArgs(rest);
  }
  if (subCommand === 'apply') {
    return parseApplyArgs(rest);
  }

  throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Supported schema commands are "validate", "plan", and "apply".');
}

function parseValidateArgs(rest) {
  const flags = new Set();
  const positional = [];
  for (const arg of rest) {
    if (arg.startsWith('--')) {
      if (arg !== '--json' && arg !== '--quiet') {
        throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Unknown schema validate option.', {
          details: { option: arg },
        });
      }
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Usage: openyida schema validate <manifest> --json --quiet.');
  }

  return {
    subCommand: 'validate',
    manifestPath: positional[0],
    json: flags.has('--json'),
    quiet: flags.has('--quiet'),
  };
}

function parsePlanArgs(rest) {
  const flags = new Set();
  const positional = [];
  let statePath;

  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === '--state') {
      statePath = rest[index + 1];
      index += 1;
      if (!statePath || statePath.startsWith('--')) {
        throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Usage: openyida schema plan <manifest> --state <path> --json --quiet.');
      }
    } else if (arg.startsWith('--')) {
      if (arg !== '--json' && arg !== '--quiet') {
        throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Unknown schema plan option.', {
          details: { option: arg },
        });
      }
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1 || !statePath) {
    throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Usage: openyida schema plan <manifest> --state <path> --json --quiet.');
  }

  return {
    subCommand: 'plan',
    manifestPath: positional[0],
    statePath,
    json: flags.has('--json'),
    quiet: flags.has('--quiet'),
  };
}

function parseApplyArgs(rest) {
  const flags = new Set();
  const positional = [];
  let statePath;
  let planId;

  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === '--state' || arg === '--plan-id') {
      const value = rest[index + 1];
      index += 1;
      if (!value || value.startsWith('--')) {
        throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Usage: openyida schema apply <manifest> --state <path> --plan-id <planId> --json --quiet.');
      }
      if (arg === '--state') {
        statePath = value;
      } else {
        planId = value;
      }
    } else if (arg.startsWith('--')) {
      if (arg !== '--json' && arg !== '--quiet') {
        throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Unknown schema apply option.', {
          details: { option: arg },
        });
      }
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }

  if (
    positional.length !== 1 ||
    !statePath ||
    !/^sha256:[a-f0-9]{64}$/.test(planId || '')
  ) {
    throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Usage: openyida schema apply <manifest> --state <path> --plan-id <planId> --json --quiet.');
  }

  return {
    subCommand: 'apply',
    manifestPath: positional[0],
    statePath,
    planId,
    json: flags.has('--json'),
    quiet: flags.has('--quiet'),
  };
}

async function run(args = [], io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const setExitCode = io.setExitCode !== false;

  let options;
  try {
    options = parseArgs(args);
    if (options.help) {
      stdout.write('Usage: openyida schema <validate|plan|apply> <manifest> [--state <path>] [--plan-id <planId>] --json --quiet\n');
      return undefined;
    }

    if (options.subCommand === 'apply') {
      const payload = await runApply(options, io);
      stdout.write(JSON.stringify(payload) + '\n');
      return payload;
    }

    if (options.subCommand === 'plan') {
      const payload = await runPlan(options, io);
      stdout.write(JSON.stringify(payload) + '\n');
      return payload;
    }

    const manifestOptions = createManifestLoadOptions(io);
    const manifest = loadManifest(options.manifestPath, manifestOptions);
    const result = normalizeManifest(manifest, manifestOptions);
    const payload = toSuccessPayload(result);
    stdout.write(JSON.stringify(payload) + '\n');
    return payload;
  } catch (error) {
    const payloadKind = inferPayloadKind(args, options);
    let payload = payloadKind === APPLY_KIND
      ? toApplyFailurePayload(error)
      : payloadKind === PLAN_KIND
        ? toPlanFailurePayload(error)
        : toFailurePayload(error);
    if (payloadKind === APPLY_KIND && shouldAutomaticallyReplan(error) && options) {
      payload = await attachAutomaticReplan(payload, error, options, io);
    } else {
      payload = attachFailureAction(payload, error);
    }
    const quiet = args.includes('--quiet') || process.argv.includes('--quiet') || (options && options.quiet);
    stdout.write(JSON.stringify(payload) + '\n');
    if (setExitCode) {
      process.exitCode = 1;
    }
    if (!quiet && stderr && stderr.write) {
      stderr.write(`${payload.error.code}: ${payload.error.message}\n`);
    }
    return payload;
  }
}

async function runPlan(options, io) {
  const registry = io.registry || createDefaultRegistry();
  const runtime = createPlanRuntimeSnapshot(io);
  const manifestOptions = createManifestLoadOptions(io);
  const manifest = loadManifest(options.manifestPath, manifestOptions);
  const normalizedResult = normalizeManifest(manifest, {
    ...manifestOptions,
    fsImpl: io.fsImpl,
    registry,
  });
  const desiredResources = normalizedResult.normalized.resources;
  const state = io.state || readState(options.statePath, {
    environment: runtime.environment,
    fsImpl: io.fsImpl,
    manifestHash: normalizedResult.manifestHash,
    registry,
  });
  const observableResources = selectObservableResources(desiredResources, state, { registry });
  const observed = await resolveObservedResources(observableResources, state, {
    io,
    registry,
    runtime,
  });
  return attachPlanAction(createPlan({
    desiredResources,
    manifestHash: normalizedResult.manifestHash,
    observedResources: observed.resources,
    state,
  }, { registry }));
}

async function attachAutomaticReplan(payload, error, options, io) {
  let replanned;
  try {
    replanned = await runPlan({
      manifestPath: options.manifestPath,
      statePath: options.statePath,
      subCommand: 'plan',
    }, io);
  } catch (replanError) {
    const replanFailure = attachFailureAction(toPlanFailurePayload(replanError), replanError);
    return {
      ...payload,
      action: createAction(payload.error.code, 'automatic_replan_failed', {
        blockText: replanFailure.error.message,
        choices: replanFailure.action.choices,
        nextAction: replanFailure.action.nextAction,
      }),
      replan: replanFailure,
    };
  }

  const reviewedAction = replanned.action;
  return {
    ...payload,
    action: createAction(payload.error.code, 'stale_replanned', {
      blockText: payload.error.message,
      choices: reviewedAction && reviewedAction.choices,
      nextAction: reviewedAction && reviewedAction.nextAction || 'review_replanned_plan',
    }),
    replan: replanned,
  };
}

function shouldAutomaticallyReplan(error) {
  return !!(
    error &&
    (isFormOrPageServerRevisionConflict(error) || (
      error.code === 'SCHEMA_APPLY_PLAN_STALE' &&
      isTrustedSchemaError(error)
    ))
  );
}

function isFormOrPageServerRevisionConflict(error) {
  return isServerRevisionConflict(error) &&
    !!error.details &&
    (error.details.resourceType === 'form' || error.details.resourceType === 'page');
}

function attachPlanAction(plan) {
  const operations = new Set((plan.changes || []).map(change => change.operation));
  if (operations.has('conflict') || operations.has('unmanaged')) {
    return {
      ...plan,
      action: createAction('SCHEMA_APPLY_BLOCKED', 'managed_decision_required', {
        blockText: safeApplyBlockText('SCHEMA_APPLY_BLOCKED'),
        choices: MANAGED_DECISION_CHOICES,
        nextAction: 'ask_human',
      }),
    };
  }
  if (operations.has('orphan')) {
    return {
      ...plan,
      action: createAction('SCHEMA_APPLY_BLOCKED', 'orphan_blocked', {
        blockText: safeApplyBlockText('SCHEMA_APPLY_BLOCKED'),
        nextAction: 'resolve_orphan',
      }),
    };
  }
  return plan;
}

function attachFailureAction(payload, error) {
  return {
    ...payload,
    action: classifyFailureAction(payload, error),
  };
}

function classifyFailureAction(payload, _error) {
  const errorCode = payload.error.code;
  const blockText = payload.error.message;
  const operation = payload.error.details && payload.error.details.operation;

  if (errorCode === 'SCHEMA_RECONCILIATION_REQUIRED' || /UNCERTAIN/.test(errorCode)) {
    return createAction(errorCode, 'reconciliation_required', {
      blockText,
      choices: RECONCILIATION_CHOICES,
      nextAction: 'ask_human',
    });
  }
  if (
    errorCode === 'SCHEMA_STATE_RESOURCE_BINDING_MISSING' ||
    errorCode === 'SCHEMA_OBSERVED_BINDING_MISSING' ||
    errorCode === 'SCHEMA_OBSERVED_REFERENCE_AMBIGUOUS' ||
    errorCode === 'SCHEMA_OBSERVED_REFERENCE_MISSING' ||
    errorCode === 'SCHEMA_REMOTE_RESOURCE_MISSING'
  ) {
    return createAction(errorCode, 'managed_identity_decision_required', {
      blockText,
      choices: RECONCILIATION_CHOICES,
      nextAction: 'ask_human',
    });
  }
  if (
    errorCode === 'SCHEMA_APPLY_BLOCKED' &&
    (operation === 'conflict' || operation === 'unmanaged')
  ) {
    return createAction(errorCode, 'managed_decision_required', {
      blockText,
      choices: MANAGED_DECISION_CHOICES,
      nextAction: 'ask_human',
    });
  }
  if (errorCode === 'SCHEMA_APPLY_BLOCKED' && operation === 'orphan') {
    return createAction(errorCode, 'orphan_blocked', {
      blockText,
      nextAction: 'resolve_orphan',
    });
  }
  if (errorCode === 'SCHEMA_APPLY_JIT_CONFLICT') {
    return createAction(errorCode, 'jit_conflict', {
      blockText,
      nextAction: 'run_schema_plan',
    });
  }
  if (errorCode === 'SCHEMA_APPLY_PLAN_STALE') {
    return createAction(errorCode, 'stale_blocked', {
      blockText,
      nextAction: 'run_schema_plan',
    });
  }
  if (/UNSUPPORTED/.test(errorCode)) {
    return createAction(errorCode, 'unsupported', {
      blockText,
      nextAction: 'remove_unsupported_manifest_content',
    });
  }
  if (isSecurityFailure(errorCode)) {
    return createAction(errorCode, 'security_failure', {
      blockText,
      nextAction: 'fix_security_boundary',
    });
  }
  if (isValidationFailure(errorCode)) {
    return createAction(errorCode, 'validation_failure', {
      blockText,
      nextAction: 'fix_manifest',
    });
  }
  if (errorCode === 'SCHEMA_REMOTE_READ_FAILED' || errorCode === 'SCHEMA_REMOTE_PROJECT_FAILED') {
    return createAction(errorCode, 'remote_read_blocked', {
      blockText,
      nextAction: 'check_remote_read',
    });
  }
  return createAction(errorCode, 'blocked', {
    blockText,
    nextAction: 'stop',
  });
}

function createAction(errorCode, classification, options) {
  const action = {
    errorCode,
    classification,
    safeToRetry: false,
    nextAction: options.nextAction,
    blockText: options.blockText,
  };
  if (Array.isArray(options.choices) && options.choices.length > 0) {
    action.choices = options.choices.slice();
  }
  return action;
}

function safeApplyBlockText(code) {
  return toApplyFailurePayload(schemaError(code, 'Schema apply is blocked.')).error.message;
}

function isSecurityFailure(code) {
  return SECURITY_FAILURE_CODES.has(code);
}

function isValidationFailure(code) {
  return VALIDATION_FAILURE_CODES.has(code) || hasCodePrefix(code, VALIDATION_FAILURE_PREFIXES);
}

function hasCodePrefix(code, prefixes) {
  return prefixes.some(prefix => typeof code === 'string' && code.startsWith(prefix));
}

async function runApply(options, io) {
  const registry = io.registry || createDefaultRegistry();
  const runtime = createPlanRuntimeSnapshot(io);
  if (!runtime.authRef && !hasInjectedServices(io.services)) {
    throw schemaError('SCHEMA_STATE_ENVIRONMENT_REQUIRED', 'Schema apply requires environment identity and Yida auth context.', {
      path: '/environment',
    });
  }
  return applySchema({
    authRef: runtime.authRef,
    environment: runtime.environment,
    expectedPlanId: options.planId,
    loadDesired() {
      const manifestOptions = createManifestLoadOptions(io);
      const manifest = loadManifest(options.manifestPath, manifestOptions);
      return normalizeManifest(manifest, {
        ...manifestOptions,
        fsImpl: io.fsImpl,
        registry,
      });
    },
    statePath: options.statePath,
    workspaceRoot: io.projectRoot || process.cwd(),
  }, {
    fsImpl: io.fsImpl,
    paths: io.applyPaths,
    readObservedResources: io.readObservedResources,
    formPostWriteReadbackRetry: options.formPostWriteReadbackRetry ?? io.formPostWriteReadbackRetry,
    registry,
    services: io.services,
  });
}

function createManifestLoadOptions(io = {}) {
  const options = {
    workspaceRoot: io.projectRoot || process.cwd(),
  };
  if (io.fsImpl) {
    options.fsImpl = io.fsImpl;
  }
  if (io.manifestLimits) {
    options.limits = io.manifestLimits;
  }
  return options;
}

function hasInjectedServices(services) {
  return !!(services && Object.keys(services).length > 0);
}

async function resolveObservedResources(resources, state, context) {
  const io = context.io || {};
  const runtime = context.runtime || createPlanRuntimeSnapshot(io);
  if (io.observed) {
    return io.observed;
  }
  if (io.observedResources) {
    return { resources: io.observedResources };
  }
  if (typeof io.readObservedResources === 'function') {
    return io.readObservedResources(resources, state, {
      context: Object.assign({}, io.observedContext || {}, {
        authRef: runtime.authRef,
        environment: runtime.environment,
      }),
      registry: context.registry,
      services: io.services,
    });
  }
  if (!resources || resources.length === 0) {
    return { resources: [] };
  }
  const authRef = runtime.authRef;
  if (!authRef && !io.services) {
    throw schemaError('SCHEMA_STATE_ENVIRONMENT_REQUIRED', 'Schema plan requires environment identity and read-only Yida auth context.', {
      path: '/environment',
    });
  }
  return readObservedResources(resources, state, {
    context: Object.assign({}, io.observedContext || {}, {
      authRef,
      environment: runtime.environment,
    }),
    registry: context.registry,
    services: io.services,
  });
}

function createPlanRuntimeSnapshot(io) {
  const authRef = resolvePlanAuthRef(io);
  return {
    authRef,
    environment: resolvePlanEnvironment(io, authRef),
  };
}

function resolvePlanEnvironment(io, authRef) {
  if (io.environment) {
    return io.environment;
  }
  const cookieData = io.cookieData !== undefined
    ? io.cookieData
    : authRef && authRef.cookieData;
  const cookies = Array.isArray(cookieData && cookieData.cookies)
    ? cookieData.cookies
    : authRef && authRef.cookies || [];
  const cookieInfo = extractInfoFromCookies(cookies);
  return {
    endpoint: authRef && authRef.baseUrl || resolveBaseUrl(cookieData || {}),
    corpId: authRef && authRef.corpId || cookieData && (cookieData.corp_id || cookieData.corpId) || cookieInfo.corpId,
  };
}

function resolvePlanAuthRef(io) {
  if (io.authRef) {
    return io.authRef;
  }
  const cookieData = io.cookieData !== undefined
    ? io.cookieData
    : resolveCookieData(io);
  if (!cookieData || !Array.isArray(cookieData.cookies) || cookieData.cookies.length === 0) {
    return null;
  }
  const cookieInfo = extractInfoFromCookies(cookieData.cookies);
  return {
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
    cookies: cookieData.cookies,
    corpId: cookieData.corp_id || cookieData.corpId || cookieInfo.corpId || '',
    csrfToken: cookieData.csrf_token || cookieData.csrfToken || cookieData._csrf_token || cookieInfo.csrfToken || '',
    userId: cookieData.user_id || cookieData.userId || cookieData.staffId || cookieInfo.userId || '',
  };
}

function resolveCookieData(io) {
  const loader = typeof io.loadCookieData === 'function' ? io.loadCookieData : loadCookieData;
  return loader(io.projectRoot);
}

function inferPayloadKind(args, options) {
  if ((options && options.subCommand === 'apply') || args[0] === 'apply') {
    return APPLY_KIND;
  }
  if ((options && options.subCommand === 'plan') || args[0] === 'plan') {
    return PLAN_KIND;
  }
  return undefined;
}

module.exports = {
  parseArgs,
  run,
};
