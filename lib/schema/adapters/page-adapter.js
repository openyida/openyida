'use strict';

const { isDeepStrictEqual } = require('util');
const { schemaError } = require('../errors');
const { getResourceState } = require('../state-store');
const { sortStrings } = require('../sort');
const { requireSchemaServerRevision } = require('../server-revision');
const { validateSemanticKey } = require('./keys');
const { loadPageSource } = require('../page-source-loader');
const {
  NATIVE_PAGE_PROFILE,
  compileNativePageSource,
} = require('../../app/services/native-page-compiler');
const {
  CANVAS_PAGE_PROFILE,
  compileCanvasPageSource,
} = require('../../app/services/canvas-page-compiler');
const {
  buildNativePageSchemaPatch,
  computeNativePageShellFingerprint,
  createNativePageShellProfile,
  projectNativePageSchema,
} = require('../page-foundation');
const {
  buildCanvasPageSchemaPatch,
  projectCanvasPageSchema,
} = require('../page-canvas-foundation');
const {
  buildDataSourceOnlyCanvasPagePatch,
  buildDataSourceOnlyNativePagePatch,
  createDataSourceOnlyShellProfile,
  projectDataSourceOnlyShell,
} = require('../page-data-source-builder');
const {
  assertPageWriteReady,
  createPageShellOnce,
  readPageResource,
  savePageSchemaOnce,
} = require('../../app/services/page-resource-service');

const DISPLAY_FORM_TYPE = 'display';
const PRODUCTION_INITIAL_PROFILE = createDataSourceOnlyShellProfile({
  profileId: 'sac-09b-native-display-shell-v1',
  fingerprint: 'sha256:2e114df34ba29f7a1c7fc7f27a8019db63ba2359c5dd667c64212f902f466f36',
});

const pageAdapter = {
  resourceType: 'page',
  adapterVersion: 1,
  validate(entry) {
    const pointer = `/pages/${escapePointer(entry.key)}`;
    validateSemanticKey(entry.key, pointer);
    const definition = entry.definition || {};
    assertSafeTitle(definition.title, `${pointer}/title`);
    if (typeof definition.source !== 'string' || !definition.source) {
      throw schemaError('SCHEMA_PAGE_SOURCE_INVALID', 'Page source is required.', {
        path: `${pointer}/source`,
      });
    }
  },

  normalize(entry, context = {}) {
    this.validate(entry, context);
    const loaded = loadPageSource(entry.definition.source, {
      fsImpl: context.fsImpl,
      workspaceRoot: context.workspaceRoot,
    });
    const compiled = compileLoadedPageSource(loaded);
    const dependsOn = new Set([`app:${context.appKey}`]);
    for (const dependency of entry.definition.dependsOn || []) {
      dependsOn.add(normalizeDependency(dependency));
    }
    return {
      resourceType: 'page',
      key: entry.key,
      desired: {
        compiledHash: compiled.compiledHash,
        formType: DISPLAY_FORM_TYPE,
        profile: compiled.profile,
        sourceHash: compiled.sourceHash,
        title: entry.definition.title.trim(),
      },
      source: loaded.relativePath,
      dependsOn: sortStrings(dependsOn),
      dependencySources: {},
    };
  },

  preflightApply(resource, context = {}) {
    if (hasInjectedPageServices(context.services)) {
      return true;
    }
    return assertPageWriteReady(context);
  },

  async readObserved(binding, context = {}) {
    const normalized = normalizePageBindings(binding);
    if (!normalized.appType || !normalized.formUuid) {
      throw schemaError('SCHEMA_OBSERVED_BINDING_MISSING', 'Page observed read requires complete bindings.', {
        details: { resourceType: 'page' },
      });
    }
    const reader = context.services && context.services.readPageResource || readPageResource;
    return callWithDispatchBoundary(context, () => reader(context, normalized));
  },

  projectObserved(observed, binding) {
    const normalized = normalizePageBindings(binding);
    const raw = normalizePageObservation(observed, normalized);
    const projection = projectSavedPage(raw);
    return {
      bindings: normalized,
      managed: projection.managed,
      remoteSchemaHash: projection.remoteSchemaHash,
    };
  },

  classifyObservedConflict(input = {}) {
    const desired = input.desired || {};
    const lastApplied = input.lastApplied || {};
    const observed = input.observed || {};
    if (desired.title !== lastApplied.title) {
      return 'PAGE_TITLE_UPDATE_UNSUPPORTED';
    }
    if (
      observed.formType !== DISPLAY_FORM_TYPE ||
      observed.profile !== desired.profile ||
      !observed.sourceHash ||
      !observed.compiledHash
    ) {
      return 'PAGE_MANAGED_CONTENT_MISSING';
    }
    return undefined;
  },

  classifyUpdate() {
    return 'PAGE_SOURCE_CHANGED';
  },

  async prepareOperation(input, context = {}) {
    const compiled = compileResourceSource(input.resource, context);
    assertCompiledMatchesDesired(compiled, input.resource.desired);
    if (input.operation === 'create') {
      return { compiled };
    }
    const binding = normalizePageBindings(input.stateResource);
    const observed = normalizePageObservation(input.observed, binding);
    const patch = buildUpdatePatch({
      compiled,
      desired: input.resource.desired,
      observed,
    });
    return { compiled, patch };
  },

  async create(desired, context = {}) {
    const appType = resolveAppType(context.resource, context.state);
    const creator = context.services && context.services.createPageShellOnce || createPageShellOnce;
    const identity = await callWithDispatchBoundary(
      context,
      () => creator(context, { appType, title: desired.title })
    );
    if (typeof context.checkpointCreateIdentity !== 'function') {
      throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Page create identity checkpoint is unavailable.');
    }
    await context.checkpointCreateIdentity(identity);
    return continuePageCreate(desired, identity, context);
  },

  async resumeCreate(desired, createIdentity, context = {}) {
    return continuePageCreate(desired, createIdentity && createIdentity.bindings, context);
  },

  async update(desired, observed, binding, context = {}) {
    const normalized = normalizePageBindings(binding);
    const patch = context.prepared && context.prepared.patch;
    if (!patch || !patch.schema) {
      throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Page update lacks a JIT managed patch.');
    }
    const saver = context.services && context.services.savePageSchemaOnce || savePageSchemaOnce;
    await callWithDispatchBoundary(context, () => saver(context, {
      appType: normalized.appType,
      formUuid: normalized.formUuid,
      schema: patch.schema,
      serverRevision: normalizePageObservation(observed, normalized).serverRevision,
    }));
    return {
      ...normalized,
      preparedRemoteSchemaHash: patch.preparedRemoteSchemaHash,
    };
  },

  buildBindings(result, context = {}) {
    const existing = normalizePageBindings(context.stateResource);
    const bindings = {
      appType: result && result.appType || existing.appType,
      formUuid: result && result.formUuid || existing.formUuid,
    };
    if (!bindings.appType || !bindings.formUuid) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Page operation did not produce complete bindings.', {
        details: { resourceType: 'page' },
      });
    }
    return bindings;
  },

  verify(projection, context = {}) {
    if (!projection || !isDeepStrictEqual(projection.managed, context.resource && context.resource.desired)) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Page observed projection does not match desired managed state.', {
        details: { resourceType: 'page', key: context.resource && context.resource.key },
      });
    }
    const expected = context.operationResult && context.operationResult.preparedRemoteSchemaHash ||
      context.expectedRemoteSchemaHash;
    if (!expected || projection.remoteSchemaHash !== expected) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Page post-write Schema contains an unexpected remote delta.', {
        details: { resourceType: 'page', property: 'remoteSchema' },
      });
    }
    return projection;
  },

  validateStateResource(entry) {
    const state = entry.state || {};
    assertAllowedKeys(state.bindings, ['appType', 'formUuid'], `${entry.path}/bindings`);
    const bindings = normalizePageBindings(state);
    if (!bindings.appType || !bindings.formUuid) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Page state bindings must include appType and formUuid.', {
        path: `${entry.path}/bindings`,
      });
    }
    if (state.lastApplied !== undefined) {
      validateManagedPage(state.lastApplied, `${entry.path}/lastApplied`);
    }
  },
};

async function continuePageCreate(desired, bindingInput, context) {
  const binding = normalizePageBindings(bindingInput);
  const reader = context.services && context.services.readPageResource || readPageResource;
  const observed = normalizePageObservation(
    await callWithDispatchBoundary(context, () => reader(context, binding)),
    binding
  );
  const compiled = context.prepared && context.prepared.compiled;
  assertCompiledMatchesDesired(compiled, desired);

  const saved = tryProjectSavedPage(observed);
  if (saved) {
    if (!isDeepStrictEqual(saved.managed, desired)) {
      throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Bound page already contains different managed content.', {
        details: { resourceType: 'page' },
      });
    }
    return { ...binding, preparedRemoteSchemaHash: saved.remoteSchemaHash };
  }

  const patch = buildInitialPatch({
    compiled,
    context,
    binding,
    observed,
  });
  if (!isDeepStrictEqual(desired, {
    compiledHash: compiled.compiledHash,
    formType: DISPLAY_FORM_TYPE,
    profile: compiled.profile,
    sourceHash: compiled.sourceHash,
    title: observed.observedTitle,
  })) {
    throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Created page identity does not match desired managed state.', {
      details: { resourceType: 'page' },
    });
  }
  const saver = context.services && context.services.savePageSchemaOnce || savePageSchemaOnce;
  await callWithDispatchBoundary(context, () => saver(context, {
    appType: binding.appType,
    formUuid: binding.formUuid,
    schema: patch.schema,
    serverRevision: observed.serverRevision,
  }));
  return { ...binding, preparedRemoteSchemaHash: patch.preparedRemoteSchemaHash };
}

async function callWithDispatchBoundary(context, callback) {
  if (typeof context.assertRemoteDispatchBoundary === 'function') {
    context.assertRemoteDispatchBoundary('before');
  }
  const result = await callback();
  if (typeof context.assertRemoteDispatchBoundary === 'function') {
    context.assertRemoteDispatchBoundary('after');
  }
  return result;
}

function projectSavedPage(observed) {
  const canvasProjection = tryProjectCanvasPage(observed);
  if (canvasProjection) {
    return canvasProjection;
  }
  const profile = createSavedProfile(observed.schema);
  const projection = projectNativePageSchema({
    observedFormType: observed.observedFormType,
    observedTitle: observed.observedTitle,
    schema: observed.schema,
    shellProfile: profile,
  });
  if (projection.classification !== 'SCHEMA_SAVED') {
    throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Bound page is not a saved native page.', {
      details: { resourceType: 'page' },
    });
  }
  return projection;
}

function tryProjectSavedPage(observed) {
  try {
    return projectSavedPage(observed);
  } catch (error) {
    if (error && [
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
    ].includes(error.code)) {
      return null;
    }
    throw error;
  }
}

function tryProjectCanvasPage(observed) {
  try {
    return projectCanvasPageSchema({
      observedFormType: observed.observedFormType,
      observedTitle: observed.observedTitle,
      schema: observed.schema,
    });
  } catch (error) {
    if (error && [
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED',
      'SCHEMA_OBSERVED_STRUCTURE_MISMATCH',
    ].includes(error.code)) {
      return null;
    }
    throw error;
  }
}

function createSavedProfile(schema) {
  return createNativePageShellProfile({
    profileId: 'sac-page-bound-native-v1',
    fingerprint: computeNativePageShellFingerprint(schema),
  });
}

function resolveInitialProfile(context) {
  return context.services && context.services.pageInitialShellProfile || PRODUCTION_INITIAL_PROFILE;
}

function compileResourceSource(resource, context) {
  if (!resource || typeof resource.source !== 'string') {
    throw schemaError('SCHEMA_PAGE_SOURCE_INVALID', 'Normalized page source is missing.');
  }
  return compileLoadedPageSource(loadPageSource(resource.source, {
    fsImpl: context.fsImpl,
    workspaceRoot: context.workspaceRoot || process.cwd(),
  }));
}

function assertCompiledMatchesDesired(compiled, desired) {
  if (
    !compiled ||
    compiled.profile !== desired.profile ||
    compiled.sourceHash !== desired.sourceHash ||
    compiled.compiledHash !== desired.compiledHash
  ) {
    throw schemaError('SCHEMA_APPLY_PLAN_STALE', 'Page source changed after the reviewed manifest.');
  }
}

function compileLoadedPageSource(loaded) {
  if (loaded && loaded.profile === CANVAS_PAGE_PROFILE) {
    return compileCanvasPageSource(loaded);
  }
  if (loaded && loaded.profile === NATIVE_PAGE_PROFILE) {
    return compileNativePageSource(loaded);
  }
  throw schemaError('SCHEMA_PAGE_SOURCE_PROFILE_UNSUPPORTED', 'Page source profile is unsupported.');
}

function buildUpdatePatch(input) {
  if (input.desired.profile === CANVAS_PAGE_PROFILE) {
    const currentProjection = projectCanvasPageSchema({
      observedFormType: input.observed.observedFormType,
      observedTitle: input.observed.observedTitle,
      schema: input.observed.schema,
    });
    return buildCanvasPageSchemaPatch({
      compiledPage: input.compiled,
      desiredFormType: DISPLAY_FORM_TYPE,
      desiredTitle: input.desired.title,
      expectedRemoteSchemaHash: currentProjection.remoteSchemaHash,
      observedFormType: input.observed.observedFormType,
      observedTitle: input.observed.observedTitle,
      remoteSchema: input.observed.schema,
    });
  }

  const profile = createSavedProfile(input.observed.schema);
  const currentProjection = projectNativePageSchema({
    observedFormType: input.observed.observedFormType,
    observedTitle: input.observed.observedTitle,
    schema: input.observed.schema,
    shellProfile: profile,
  });
  return buildNativePageSchemaPatch({
    compiledPage: input.compiled,
    desiredFormType: DISPLAY_FORM_TYPE,
    desiredTitle: input.desired.title,
    expectedRemoteSchemaHash: currentProjection.remoteSchemaHash,
    observedFormType: input.observed.observedFormType,
    observedTitle: input.observed.observedTitle,
    remoteSchema: input.observed.schema,
    shellProfile: profile,
  });
}

function buildInitialPatch(input) {
  const shellProfile = resolveInitialProfile(input.context);
  const initialProjection = projectDataSourceOnlyShell({
    observedFormType: input.observed.observedFormType,
    observedTitle: input.observed.observedTitle,
    schema: input.observed.schema,
    shellProfile,
  });
  const baseInput = {
    compiledPage: input.compiled,
    expectedInitialRemoteSchemaHash: initialProjection.remoteSchemaHash,
    formUuid: input.binding.formUuid,
    observedFormType: input.observed.observedFormType,
    observedTitle: input.observed.observedTitle,
    operationId: input.context.operationId,
    remoteSchema: input.observed.schema,
    shellProfile,
  };
  if (input.compiled.profile === CANVAS_PAGE_PROFILE) {
    return buildDataSourceOnlyCanvasPagePatch(baseInput);
  }
  return buildDataSourceOnlyNativePagePatch(baseInput);
}

function normalizePageObservation(value, bindings) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError('SCHEMA_PAGE_READ_FAILED', 'Bound page observation is invalid.');
  }
  if (value.appType !== bindings.appType || value.formUuid !== bindings.formUuid) {
    throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Bound page observation identity changed.', {
      details: { resourceType: 'page' },
    });
  }
  return {
    appType: bindings.appType,
    formUuid: bindings.formUuid,
    observedFormType: value.observedFormType,
    observedTitle: value.observedTitle,
    schema: value.schema,
    serverRevision: requireSchemaServerRevision(
      value.schema,
      () => schemaError('SCHEMA_REMOTE_READ_FAILED', 'Observed page Schema revision is missing or invalid.', {
        details: { resourceType: 'page' },
      })
    ),
  };
}

function normalizePageBindings(value) {
  const source = value && value.bindings ? value.bindings : value || {};
  const appType = typeof source.appType === 'string' ? source.appType : '';
  const formUuid = typeof source.formUuid === 'string' ? source.formUuid : '';
  if ((appType && !formUuid) || (!appType && formUuid)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Page bindings must include appType and formUuid together.');
  }
  return { appType, formUuid };
}

function resolveAppType(resource, state) {
  for (const dependency of resource && resource.dependsOn || []) {
    if (!dependency.startsWith('app:')) {
      continue;
    }
    const app = getResourceState(state, 'app', dependency.slice(4));
    if (app && app.bindings && app.bindings.appType) {
      return app.bindings.appType;
    }
  }
  throw schemaError('SCHEMA_STATE_RESOURCE_BINDING_MISSING', 'Page dependency app binding is missing.', {
    details: { resourceType: 'page' },
  });
}

function normalizeDependency(value) {
  const match = typeof value === 'string' && /^(app|form|page|process):([A-Za-z][A-Za-z0-9_]*)$/.exec(value);
  if (!match) {
    throw schemaError('SCHEMA_DEPENDENCY_NOT_FOUND', 'Page dependency must use a supported semantic resource ID.');
  }
  return `${match[1]}:${match[2]}`;
}

function validateManagedPage(value, pointer) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Page lastApplied must be a compact managed object.', { path: pointer });
  }
  assertAllowedKeys(value, ['compiledHash', 'formType', 'profile', 'sourceHash', 'title'], pointer);
  if (
    value.formType !== DISPLAY_FORM_TYPE ||
    ![NATIVE_PAGE_PROFILE, CANVAS_PAGE_PROFILE].includes(value.profile) ||
    !isHash(value.sourceHash) ||
    !isHash(value.compiledHash)
  ) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Page lastApplied managed content is invalid.', { path: pointer });
  }
  assertSafeTitle(value.title, `${pointer}/title`);
}

function assertSafeTitle(value, pointer) {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title || title.length > 256 || containsUnsafeText(title)) {
    throw schemaError('SCHEMA_MANIFEST_SCHEMA_INVALID', 'Page title is invalid.', { path: pointer });
  }
}

function containsUnsafeText(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      return true;
    }
  }
  return false;
}

function assertAllowedKeys(value, keys, pointer) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'State contains an unknown property.', {
        path: `${pointer}/${escapePointer(key)}`,
      });
    }
  }
}

function hasInjectedPageServices(services = {}) {
  return ['createPageShellOnce', 'readPageResource', 'savePageSchemaOnce']
    .every(name => typeof services[name] === 'function');
}

function isHash(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

module.exports = { pageAdapter };
