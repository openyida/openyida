'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const { schemaError } = require('./errors');
const { hashStable } = require('./state-store');
const {
  buildDefaultPageDataSource,
  buildNativePageSchemaContent,
  extractPageDataSource,
  mergePageDataSource,
} = require('../app/services/native-page-schema-builder');
const {
  buildCanvasPageSchemaContent,
} = require('../app/services/canvas-page-schema-builder');
const {
  NATIVE_PAGE_PROFILE,
  isCompiledNativePage,
} = require('../app/services/native-page-compiler');
const {
  CANVAS_PAGE_PROFILE,
  isCompiledCanvasPage,
} = require('../app/services/canvas-page-compiler');
const {
  projectCanvasPageSchema,
} = require('./page-canvas-foundation');
const {
  computeNativePageShellFingerprint,
  createNativePageShellProfile,
  projectNativePageSchema,
} = require('./page-foundation');

const DISPLAY_FORM_TYPE = 'display';
const INITIAL_PROFILE_CONTRACT_VERSION = 1;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PROFILE_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const INITIAL_PROFILES = new WeakSet();
const INITIAL_ROOT_KEYS = Object.freeze(['gmtModified', 'i18nData', 'pages', 'status']);
const INITIAL_PAGE_KEYS = Object.freeze(['componentsTree']);
const INITIAL_TREE_KEYS = Object.freeze(['dataSource']);
const INITIAL_DATA_SOURCE_KEYS = Object.freeze([
  'globalConfig',
  'list',
  'offline',
  'online',
  'sync',
]);

function createDataSourceOnlyShellProfile(input = {}) {
  const profileId = normalizeProfileId(input.profileId);
  const fingerprint = normalizeHash(
    input.fingerprint,
    'SCHEMA_PAGE_FOUNDATION_INITIAL_PROFILE_INVALID'
  );
  const profile = Object.freeze({
    contractVersion: INITIAL_PROFILE_CONTRACT_VERSION,
    fingerprint,
    profileId,
  });
  INITIAL_PROFILES.add(profile);
  return profile;
}

function computeDataSourceOnlyShellFingerprint(schemaInput) {
  const schema = normalizeSchema(schemaInput);
  inspectDataSourceOnlyShell(schema, 'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID');
  return hashStable(normalizeInitialFingerprint(schema));
}

function projectDataSourceOnlyShell(input = {}) {
  const observedIdentity = normalizeObservedIdentity(input);
  const shellProfile = requireInitialProfile(input.shellProfile);
  const schema = normalizeSchema(input.schema);
  const structure = inspectDataSourceOnlyShell(schema, 'SCHEMA_PAGE_FOUNDATION_CONFLICT');
  const fingerprint = hashStable(normalizeInitialFingerprint(schema));
  if (fingerprint !== shellProfile.fingerprint) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Initial page Schema does not match the approved data-source shell profile.'
    );
  }
  const managed = {
    formType: observedIdentity.formType,
    profile: NATIVE_PAGE_PROFILE,
    title: observedIdentity.title,
  };
  return {
    classification: 'PAGE_CREATED',
    dataSourceHash: hashStable(structure.dataSource),
    managed,
    managedHash: hashStable(managed),
    remoteSchemaHash: hashInitialRemoteSchema(schema),
  };
}

function buildDataSourceOnlyNativePagePatch(input = {}) {
  const compiledPage = requireCompiledPage(input.compiledPage);
  const observedIdentity = normalizeObservedIdentity(input);
  const formUuid = normalizeBinding(input.formUuid);
  const operationId = normalizeHash(
    input.operationId,
    'SCHEMA_PAGE_FOUNDATION_TRANSITION_INVALID'
  );
  const desiredManaged = buildDesiredManaged(observedIdentity.title, compiledPage);
  if (
    input.expectedManagedHash !== undefined &&
    hashStable(desiredManaged) !== input.expectedManagedHash
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Desired managed page content changed before patch preparation.'
    );
  }

  const initialSchema = normalizeSchema(input.remoteSchema);
  const initialProjection = projectDataSourceOnlyShell({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: initialSchema,
    shellProfile: input.shellProfile,
  });
  if (
    input.expectedInitialRemoteSchemaHash !== undefined &&
    input.expectedInitialRemoteSchemaHash !== initialProjection.remoteSchemaHash
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Initial page Schema changed before the native page patch was prepared.'
    );
  }

  const initialDataSource = extractInitialDataSource(initialSchema);
  const generators = createDeterministicGenerators({
    compiledHash: compiledPage.compiledHash,
    operationId,
    sourceHash: compiledPage.sourceHash,
  });
  let preparedSchema;
  try {
    preparedSchema = JSON.parse(buildNativePageSchemaContent(
      compiledPage.source,
      compiledPage.compiled,
      formUuid,
      {
        existingDataSource: initialDataSource,
        nextNodeId: generators.nextNodeId,
        nextSuffix: generators.nextSuffix,
      }
    ));
  } catch (error) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Native page Schema could not be prepared.'
    );
  }

  const preparedDataSource = extractPageDataSource(preparedSchema);
  assertPreparedDataSourceContract(initialDataSource, preparedDataSource, formUuid);
  const savedShellProfile = createNativePageShellProfile({
    fingerprint: computeNativePageShellFingerprint(preparedSchema),
    profileId: 'sac-page-deterministic-native-v1',
  });
  const savedProjection = projectNativePageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: preparedSchema,
    shellProfile: savedShellProfile,
  });
  if (
    savedProjection.classification !== 'SCHEMA_SAVED' ||
    !isDeepStrictEqual(savedProjection.managed, desiredManaged)
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Prepared native page Schema does not match desired managed content.'
    );
  }

  return deepFreeze({
    initialDataSourceHash: hashStable(initialDataSource),
    initialManagedHash: initialProjection.managedHash,
    initialRemoteSchemaHash: initialProjection.remoteSchemaHash,
    managedHash: savedProjection.managedHash,
    preparedDataSourceHash: hashStable(preparedDataSource),
    preparedRemoteSchemaHash: savedProjection.remoteSchemaHash,
    schema: clonePlain(preparedSchema),
  });
}

function buildDataSourceOnlyCanvasPagePatch(input = {}) {
  const compiledPage = requireCompiledCanvas(input.compiledPage);
  const observedIdentity = normalizeObservedIdentity(input);
  const formUuid = normalizeBinding(input.formUuid);
  const operationId = normalizeHash(
    input.operationId,
    'SCHEMA_PAGE_FOUNDATION_TRANSITION_INVALID'
  );
  const desiredManaged = buildCanvasDesiredManaged(observedIdentity.title, compiledPage);
  if (
    input.expectedManagedHash !== undefined &&
    hashStable(desiredManaged) !== input.expectedManagedHash
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Desired managed Canvas page content changed before patch preparation.'
    );
  }

  const initialSchema = normalizeSchema(input.remoteSchema);
  const initialProjection = projectDataSourceOnlyShell({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: initialSchema,
    shellProfile: input.shellProfile,
  });
  if (
    input.expectedInitialRemoteSchemaHash !== undefined &&
    input.expectedInitialRemoteSchemaHash !== initialProjection.remoteSchemaHash
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_CONFLICT',
      'Initial page Schema changed before the Canvas page patch was prepared.'
    );
  }

  const generators = createDeterministicGenerators({
    compiledHash: compiledPage.compiledHash,
    operationId,
    sourceHash: compiledPage.sourceHash,
  });
  let preparedSchema;
  try {
    preparedSchema = JSON.parse(buildCanvasPageSchemaContent(
      compiledPage.source,
      compiledPage.runtimeCode,
      compiledPage.importedModules,
      formUuid,
      {
        nextNodeId: generators.nextNodeId,
        nextSuffix: generators.nextSuffix,
      }
    ));
  } catch (error) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Canvas page Schema could not be prepared.'
    );
  }

  const savedProjection = projectCanvasPageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: preparedSchema,
  });
  if (
    savedProjection.classification !== 'SCHEMA_SAVED' ||
    !isDeepStrictEqual(savedProjection.managed, desiredManaged)
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Prepared Canvas page Schema does not match desired managed content.'
    );
  }

  return deepFreeze({
    initialManagedHash: initialProjection.managedHash,
    initialRemoteSchemaHash: initialProjection.remoteSchemaHash,
    managedHash: savedProjection.managedHash,
    preparedRemoteSchemaHash: savedProjection.remoteSchemaHash,
    schema: clonePlain(preparedSchema),
  });
}

function inspectDataSourceOnlyShell(schema, code) {
  assertExactKeys(schema, INITIAL_ROOT_KEYS, code);
  if (
    !Number.isFinite(schema.gmtModified) ||
    schema.gmtModified < 0 ||
    !Array.isArray(schema.i18nData) ||
    schema.i18nData.length !== 0 ||
    schema.status !== 'ONLINE' ||
    !Array.isArray(schema.pages) ||
    schema.pages.length !== 1
  ) {
    foundationError(code, 'Initial page Schema root does not match the data-source shell contract.');
  }
  const page = schema.pages[0];
  assertPlainObject(page, code);
  assertExactKeys(page, INITIAL_PAGE_KEYS, code);
  if (!Array.isArray(page.componentsTree) || page.componentsTree.length !== 1) {
    foundationError(code, 'Initial page Schema must contain exactly one data-source tree entry.');
  }
  const root = page.componentsTree[0];
  assertPlainObject(root, code);
  assertExactKeys(root, INITIAL_TREE_KEYS, code);
  const dataSource = root.dataSource;
  assertPlainObject(dataSource, code);
  assertExactKeys(dataSource, INITIAL_DATA_SOURCE_KEYS, code);
  const expectedGlobalConfig = buildDefaultPageDataSource('FORM-FOUNDATION').globalConfig;
  if (
    !Array.isArray(dataSource.offline) ||
    dataSource.offline.length !== 0 ||
    !Array.isArray(dataSource.online) ||
    dataSource.online.length !== 0 ||
    !Array.isArray(dataSource.list) ||
    dataSource.list.length !== 0 ||
    dataSource.sync !== true ||
    !isDeepStrictEqual(dataSource.globalConfig, expectedGlobalConfig)
  ) {
    foundationError(code, 'Initial page data-source shell contains unsupported content.');
  }
  return { dataSource };
}

function normalizeInitialFingerprint(schema) {
  const normalized = clonePlain(schema);
  normalized.gmtModified = '<root-gmtModified>';
  return normalized;
}

function hashInitialRemoteSchema(schema) {
  const normalized = clonePlain(schema);
  delete normalized.gmtModified;
  return hashStable(normalized);
}

function extractInitialDataSource(schema) {
  return clonePlain(schema.pages[0].componentsTree[0].dataSource);
}

function assertPreparedDataSourceContract(initialDataSource, preparedDataSource, formUuid) {
  const expected = mergePageDataSource(
    initialDataSource,
    buildDefaultPageDataSource(formUuid)
  );
  if (!preparedDataSource || !isDeepStrictEqual(preparedDataSource, expected)) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Native page builder produced an unsupported data-source transition.'
    );
  }
}

function createDeterministicGenerators(input) {
  const seed = hashStable(input);
  return {
    nextNodeId: createDeterministicTokenFactory(seed, 'node_oc', 18),
    nextSuffix: createDeterministicTokenFactory(seed, '', 20),
  };
}

function createDeterministicTokenFactory(seed, prefix, length) {
  let counter = 0;
  return function nextToken() {
    counter += 1;
    return prefix + crypto
      .createHash('sha256')
      .update(`${seed}:${prefix}:${counter}`)
      .digest('hex')
      .slice(0, length);
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

function buildCanvasDesiredManaged(title, compiledPage) {
  return {
    compiledHash: compiledPage.compiledHash,
    formType: DISPLAY_FORM_TYPE,
    profile: CANVAS_PAGE_PROFILE,
    sourceHash: compiledPage.sourceHash,
    title,
  };
}

function normalizeObservedIdentity(input) {
  const title = typeof input.observedTitle === 'string' ? input.observedTitle.trim() : '';
  const formType = typeof input.observedFormType === 'string'
    ? input.observedFormType.trim().toLowerCase()
    : '';
  if (
    !title ||
    title.length > 256 ||
    containsUnsafeText(title) ||
    formType !== DISPLAY_FORM_TYPE
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_OBSERVED_IDENTITY_INVALID',
      'Observed page identity is invalid.'
    );
  }
  return { formType, title };
}

function normalizeSchema(value) {
  let candidate = value;
  if (isPlainObject(candidate) && candidate.success === true) {
    if (!isPlainObject(candidate.content) || Object.keys(candidate.content).length === 0) {
      foundationError(
        'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
        'Page Schema read returned empty content.'
      );
    }
    candidate = candidate.content;
  } else if (isPlainObject(candidate) && candidate.success === false) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
      'Page Schema read was not successful.'
    );
  }
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch (error) {
      foundationError(
        'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID',
        'Page Schema content is invalid.'
      );
    }
  }
  assertPlainObject(candidate, 'SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID');
  return clonePlain(candidate);
}

function requireInitialProfile(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !INITIAL_PROFILES.has(value) ||
    value.contractVersion !== INITIAL_PROFILE_CONTRACT_VERSION
  ) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_INITIAL_PROFILE_REQUIRED',
      'An approved data-source-only shell profile is required.'
    );
  }
  return value;
}

function requireCompiledPage(value) {
  if (!isCompiledNativePage(value)) {
    foundationError(
      'SCHEMA_PAGE_SOURCE_INVALID',
      'Page builder requires trusted compiled native source.'
    );
  }
  return value;
}

function requireCompiledCanvas(value) {
  if (!isCompiledCanvasPage(value)) {
    foundationError(
      'SCHEMA_PAGE_SOURCE_INVALID',
      'Page builder requires trusted compiled Canvas source.'
    );
  }
  return value;
}

function normalizeProfileId(value) {
  const profileId = typeof value === 'string' ? value.trim() : '';
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_INITIAL_PROFILE_INVALID',
      'Data-source shell profile is invalid.'
    );
  }
  return profileId;
}

function normalizeHash(value, code) {
  const hash = typeof value === 'string' ? value.trim() : '';
  if (!HASH_PATTERN.test(hash)) {
    foundationError(code, 'Page foundation hash is invalid.');
  }
  return hash;
}

function normalizeBinding(value) {
  const binding = typeof value === 'string' ? value.trim() : '';
  if (!binding || binding.length > 256 || containsUnsafeText(binding)) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_TRANSITION_INVALID',
      'Page builder binding is invalid.'
    );
  }
  return binding;
}

function assertExactKeys(value, expected, code) {
  assertPlainObject(value, code);
  const keys = Object.keys(value).sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    foundationError(code, 'Page Schema contains unsupported structure.');
  }
}

function assertPlainObject(value, code) {
  if (!isPlainObject(value)) {
    foundationError(code, 'Page Schema value must be a plain object.');
  }
}

function isPlainObject(value) {
  const prototype = value && typeof value === 'object'
    ? Object.getPrototypeOf(value)
    : undefined;
  return !!(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (prototype === Object.prototype || prototype === null)
  );
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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function foundationError(code, message) {
  throw schemaError(code, message);
}

module.exports = Object.freeze({
  buildDataSourceOnlyCanvasPagePatch,
  buildDataSourceOnlyNativePagePatch,
  computeDataSourceOnlyShellFingerprint,
  createDataSourceOnlyShellProfile,
  projectDataSourceOnlyShell,
});
