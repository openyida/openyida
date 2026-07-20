'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const { schemaError } = require('./errors');
const { hashStable } = require('./state-store');
const {
  NATIVE_PAGE_PROFILE,
  isCompiledNativePage,
} = require('../app/services/native-page-compiler');

const DISPLAY_FORM_TYPE = 'display';
const SHELL_PROFILE_CONTRACT_VERSION = 1;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SHELL_PROFILE_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const SHELL_PROFILES = new WeakSet();
const COMPONENT_ORDER_KEYS = new Set(['children', 'componentsMap', 'componentsTree']);
const SHELL_NEUTRAL_TIME_KEYS = new Set([
  'createtime',
  'createdat',
  'gmtcreate',
  'gmtmodified',
  'modifiedtime',
  'timestamp',
  'updatedat',
]);

function createNativePageShellProfile(input = {}) {
  const profileId = typeof input.profileId === 'string' ? input.profileId.trim() : '';
  const fingerprint = typeof input.fingerprint === 'string' ? input.fingerprint.trim() : '';
  if (
    !SHELL_PROFILE_ID_PATTERN.test(profileId) ||
    !HASH_PATTERN.test(fingerprint)
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SHELL_PROFILE_INVALID',
      'Native page shell profile is invalid.'
    );
  }
  const profile = Object.freeze({
    contractVersion: SHELL_PROFILE_CONTRACT_VERSION,
    fingerprint,
    profileId,
  });
  SHELL_PROFILES.add(profile);
  return profile;
}

function computeNativePageShellFingerprint(schemaInput) {
  const schema = normalizeSchema(schemaInput);
  inspectNativeStructure(schema);
  inspectActions(schema.actions);
  return computeShellFingerprint(schema);
}

function projectNativePageSchema(input = {}) {
  return projectNativePageSchemaInternal(input, true);
}

function projectNativePageSchemaInternal(input, enforceShellProfile) {
  const observedIdentity = normalizeObservedIdentity(input);
  if (observedIdentity.formType !== DISPLAY_FORM_TYPE) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED',
      'Observed page is not a display resource.'
    );
  }
  const shellProfile = requireShellProfile(input.shellProfile);
  const schema = normalizeSchema(input.schema);
  const structure = inspectNativeStructure(schema);
  const actions = inspectActions(schema.actions);
  const shellProfileMatches = computeShellFingerprint(schema) === shellProfile.fingerprint;
  if (enforceShellProfile && !shellProfileMatches) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Remote page Schema does not match the approved initial shell profile.'
    );
  }
  const managed = {
    formType: observedIdentity.formType,
    profile: NATIVE_PAGE_PROFILE,
    title: observedIdentity.title,
  };
  let classification = 'PAGE_CREATED';
  if (actions.saved) {
    classification = 'SCHEMA_SAVED';
    managed.sourceHash = hashStableText(actions.source);
    managed.compiledHash = hashStableText(actions.compiled);
  }
  return {
    classification,
    managed,
    managedHash: hashStable(managed),
    remoteSchemaHash: hashRemoteSchema(schema),
    shellProfileMatches,
    structure: {
      jsxComponentCount: structure.jsxComponents.length,
      pageComponentCount: structure.pageComponents.length,
    },
  };
}

function buildNativePageSchemaPatch(input = {}) {
  const observedIdentity = normalizeObservedIdentity(input);
  const desiredIdentity = normalizeDesiredIdentity(input);
  assertIdentityMatches(observedIdentity, desiredIdentity);
  const compiledPage = requireCompiledPage(input.compiledPage);
  const schema = normalizeSchema(input.remoteSchema);
  const beforeProjection = projectNativePageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema,
    shellProfile: input.shellProfile,
  });
  if (
    input.expectedRemoteSchemaHash !== undefined &&
    input.expectedRemoteSchemaHash !== beforeProjection.remoteSchemaHash
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_CONFLICT', 'Remote page Schema changed before patching.');
  }

  const desiredManaged = buildDesiredManaged(desiredIdentity.title, compiledPage);
  if (beforeProjection.classification === 'SCHEMA_SAVED') {
    if (isDeepStrictEqual(beforeProjection.managed, desiredManaged)) {
      return {
        baselineRemoteSchemaHash: beforeProjection.remoteSchemaHash,
        managed: desiredManaged,
        managedHash: hashStable(desiredManaged),
        preparedRemoteSchemaHash: beforeProjection.remoteSchemaHash,
        schema,
        unmanagedHash: hashUnmanagedSchema(schema),
      };
    }
  }

  const beforeUnmanagedHash = hashUnmanagedSchema(schema);
  const patched = clonePlain(schema);
  if (patched.actions === undefined) {
    patched.actions = {};
  }
  assertPlainObject(patched.actions);
  if (patched.actions.module === undefined) {
    patched.actions.module = {};
  }
  assertPlainObject(patched.actions.module);
  patched.actions.module.source = compiledPage.source;
  patched.actions.module.compiled = compiledPage.compiled;

  const afterUnmanagedHash = hashUnmanagedSchema(patched);
  if (afterUnmanagedHash !== beforeUnmanagedHash) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page patch changed unmanaged Schema content.');
  }
  const afterProjection = projectNativePageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: patched,
    shellProfile: input.shellProfile,
  });
  if (!isDeepStrictEqual(afterProjection.managed, desiredManaged)) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page patch did not produce the desired managed content.');
  }

  return {
    baselineRemoteSchemaHash: beforeProjection.remoteSchemaHash,
    managed: desiredManaged,
    managedHash: afterProjection.managedHash,
    preparedRemoteSchemaHash: afterProjection.remoteSchemaHash,
    schema: patched,
    unmanagedHash: beforeUnmanagedHash,
  };
}

function compareNativePageWrite(input = {}) {
  const observedIdentity = normalizeObservedIdentity(input);
  const desiredIdentity = normalizeDesiredIdentity(input);
  assertIdentityMatches(observedIdentity, desiredIdentity);
  const compiledPage = requireCompiledPage(input.compiledPage);
  const beforeSchema = normalizeSchema(input.beforeSchema);
  const afterSchema = normalizeSchema(input.afterSchema);
  projectNativePageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: beforeSchema,
    shellProfile: input.shellProfile,
  });
  const afterProjection = projectNativePageSchemaInternal({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: afterSchema,
    shellProfile: input.shellProfile,
  }, false);
  const desiredManaged = buildDesiredManaged(desiredIdentity.title, compiledPage);
  const managedMatches = isDeepStrictEqual(afterProjection.managed, desiredManaged);
  const beforeUnmanagedHash = hashUnmanagedSchema(beforeSchema);
  const afterUnmanagedHash = hashUnmanagedSchema(afterSchema);
  const unmanagedPreserved = beforeUnmanagedHash === afterUnmanagedHash;
  return {
    managedMatches,
    projection: afterProjection,
    shellProfileMatches: afterProjection.shellProfileMatches,
    unexpectedDelta: !unmanagedPreserved,
    unmanagedPreserved,
  };
}

function buildDesiredManaged(title, compiledPage) {
  return {
    compiledHash: compiledPage.compiledHash,
    formType: DISPLAY_FORM_TYPE,
    profile: NATIVE_PAGE_PROFILE,
    sourceHash: compiledPage.sourceHash,
    title,
  };
}

function normalizeObservedIdentity(input) {
  const title = normalizeTitle(
    input.observedTitle,
    'SCHEMA_PAGE_FOUNDATION_OBSERVED_IDENTITY_INVALID',
    'Observed page title is invalid.'
  );
  const formType = normalizeFormType(
    input.observedFormType,
    'SCHEMA_PAGE_FOUNDATION_OBSERVED_IDENTITY_INVALID',
    'Observed page form type is invalid.'
  );
  return { formType, title };
}

function normalizeDesiredIdentity(input) {
  const title = normalizeTitle(
    input.desiredTitle,
    'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
    'Desired page title is invalid.'
  );
  const formType = input.desiredFormType === undefined
    ? DISPLAY_FORM_TYPE
    : normalizeFormType(
      input.desiredFormType,
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Desired page form type is invalid.'
    );
  if (formType !== DISPLAY_FORM_TYPE) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED',
      'Desired page must use the display resource type.'
    );
  }
  return { formType, title };
}

function normalizeTitle(value, code, message) {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title || title.length > 256 || containsUnsafeText(title)) {
    foundationError(code, message);
  }
  return title;
}

function normalizeFormType(value, code, message) {
  const formType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!formType || formType.length > 64 || containsUnsafeText(formType)) {
    foundationError(code, message);
  }
  return formType;
}

function assertIdentityMatches(observedIdentity, desiredIdentity) {
  if (
    observedIdentity.title !== desiredIdentity.title ||
    observedIdentity.formType !== desiredIdentity.formType
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Observed page identity does not match desired identity.'
    );
  }
}

function normalizeSchema(value) {
  let candidate = value;
  if (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    candidate.success === true &&
    Object.prototype.hasOwnProperty.call(candidate, 'content')
  ) {
    candidate = candidate.content;
  }
  if (typeof candidate === 'string') {
    if (!candidate.trim()) {
      foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page Schema content is empty.');
    }
    try {
      candidate = JSON.parse(candidate);
    } catch (error) {
      foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page Schema content is invalid.');
    }
  }
  assertPlainObject(candidate);
  return clonePlain(candidate);
}

function inspectNativeStructure(schema) {
  if (
    schema.schemaType !== 'superform' ||
    typeof schema.schemaVersion !== 'string' ||
    !schema.schemaVersion.startsWith('5') ||
    !Array.isArray(schema.pages) ||
    schema.pages.length !== 1
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page Schema root is invalid.');
  }
  const page = schema.pages[0];
  assertPlainObject(page);
  if (!Array.isArray(page.componentsTree)) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page component tree is invalid.');
  }
  const components = collectComponents(page.componentsTree);
  if (components.some(component => component.componentName === 'YidaCodeCanvas')) {
    foundationError('SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED', 'Canvas page Schema is unsupported.');
  }
  const pageComponents = components.filter(component => component.componentName === 'Page');
  const jsxComponents = components.filter(component => component.componentName === 'Jsx');
  if (pageComponents.length !== 1 || jsxComponents.length !== 1) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Native page component structure is ambiguous.');
  }
  return { jsxComponents, pageComponents };
}

function inspectActions(actions) {
  if (actions === undefined) {
    return { saved: false };
  }
  assertPlainObject(actions);
  if (actions.module === undefined) {
    return { saved: false };
  }
  assertPlainObject(actions.module);
  const source = actions.module.source;
  const compiled = actions.module.compiled;
  const hasSource = typeof source === 'string' && source.length > 0;
  const hasCompiled = typeof compiled === 'string' && compiled.length > 0;
  if (!hasSource && !hasCompiled) {
    return { saved: false };
  }
  if (!hasSource || !hasCompiled) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Native page actions are incomplete.');
  }
  return { compiled, saved: true, source };
}

function collectComponents(value, result = []) {
  if (!value || typeof value !== 'object') {
    return result;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectComponents(item, result);
    }
    return result;
  }
  if (typeof value.componentName === 'string') {
    result.push(value);
  }
  for (const key of Object.keys(value).sort()) {
    collectComponents(value[key], result);
  }
  return result;
}

function requireShellProfile(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !SHELL_PROFILES.has(value) ||
    value.contractVersion !== SHELL_PROFILE_CONTRACT_VERSION
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SHELL_PROFILE_REQUIRED',
      'An approved native page shell profile is required.'
    );
  }
  return value;
}

function computeShellFingerprint(schema) {
  const candidate = clonePlain(schema);
  stripManagedActionText(candidate);
  return hashStable(normalizeShellFingerprintValue(candidate));
}

function normalizeShellFingerprintValue(value, pathSegments = [], inheritedComponentName = '') {
  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => normalizeShellFingerprintValue(
      item,
      pathSegments.concat(String(index)),
      inheritedComponentName
    ));
    const collectionName = pathSegments[pathSegments.length - 1];
    if (
      COMPONENT_ORDER_KEYS.has(collectionName) &&
      normalized.every(item => (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof item.componentName === 'string'
      ))
    ) {
      normalized.sort(compareCanonicalValues);
    }
    return normalized;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const ownComponentName = typeof value.componentName === 'string'
    ? value.componentName
    : '';
  const componentName = ownComponentName || inheritedComponentName;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (isShellNeutralKey(value, key, pathSegments, ownComponentName, componentName)) {
      continue;
    }
    result[key] = normalizeShellFingerprintValue(
      value[key],
      pathSegments.concat(key),
      componentName
    );
  }
  return result;
}

function isShellNeutralKey(value, key, pathSegments, ownComponentName, componentName) {
  if (SHELL_NEUTRAL_TIME_KEYS.has(key.toLowerCase())) {
    return true;
  }
  if (key === 'id' && ownComponentName) {
    return true;
  }
  if (
    key === 'id' &&
    pathSegments.length === 2 &&
    pathSegments[0] === 'pages' &&
    /^\d+$/.test(pathSegments[1])
  ) {
    return true;
  }
  if (key === 'fieldId' && componentName === 'Jsx') {
    return true;
  }
  return (
    key === 'className' &&
    componentName === 'Page' &&
    typeof value[key] === 'string' &&
    /^page_[a-z0-9]+$/i.test(value[key])
  );
}

function compareCanonicalValues(left, right) {
  const leftValue = JSON.stringify(left);
  const rightValue = JSON.stringify(right);
  if (leftValue < rightValue) {
    return -1;
  }
  if (leftValue > rightValue) {
    return 1;
  }
  return 0;
}

function stripManagedActionText(schema) {
  if (
    !schema.actions ||
    typeof schema.actions !== 'object' ||
    Array.isArray(schema.actions) ||
    !schema.actions.module ||
    typeof schema.actions.module !== 'object' ||
    Array.isArray(schema.actions.module)
  ) {
    return;
  }
  delete schema.actions.module.source;
  delete schema.actions.module.compiled;
  if (Object.keys(schema.actions.module).length === 0) {
    delete schema.actions.module;
  }
  if (Object.keys(schema.actions).length === 0) {
    delete schema.actions;
  }
}

function hashUnmanagedSchema(schema) {
  const unmanaged = clonePlain(schema);
  stripManagedActionText(unmanaged);
  return hashStable(unmanaged);
}

function hashRemoteSchema(schema) {
  const normalized = clonePlain(schema);
  delete normalized.gmtModified;
  return hashStable(normalized);
}

function requireCompiledPage(value) {
  if (!isCompiledNativePage(value)) {
    foundationError('SCHEMA_PAGE_SOURCE_INVALID', 'Page patch requires trusted compiled native source.');
  }
  return value;
}

function hashStableText(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function assertPlainObject(value) {
  const prototype = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (prototype !== Object.prototype && prototype !== null)
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Page Schema value must be a plain object.');
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

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function foundationError(code, message) {
  throw schemaError(code, message);
}

module.exports = {
  DISPLAY_FORM_TYPE,
  buildNativePageSchemaPatch,
  compareNativePageWrite,
  computeNativePageShellFingerprint,
  createNativePageShellProfile,
  projectNativePageSchema,
};
