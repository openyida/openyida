'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const { schemaError } = require('./errors');
const { hashStable } = require('./state-store');
const {
  CANVAS_PAGE_PROFILE,
  createCanvasCompiledHash,
  isCompiledCanvasPage,
} = require('../app/services/canvas-page-compiler');

const DISPLAY_FORM_TYPE = 'display';
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

function projectCanvasPageSchema(input = {}) {
  const observedIdentity = normalizeObservedIdentity(input);
  if (observedIdentity.formType !== DISPLAY_FORM_TYPE) {
    foundationError(
      'SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED',
      'Observed page is not a display resource.'
    );
  }
  const schema = normalizeSchema(input.schema);
  const structure = inspectCanvasStructure(schema);
  const canvasProps = inspectCanvasProps(structure.canvasComponent);
  const managed = {
    compiledHash: createCanvasCompiledHash(canvasProps.runtimeCode, canvasProps.importedModules),
    formType: observedIdentity.formType,
    profile: CANVAS_PAGE_PROFILE,
    sourceHash: hashStableText(canvasProps.code),
    title: observedIdentity.title,
  };
  return {
    classification: 'SCHEMA_SAVED',
    managed,
    managedHash: hashStable(managed),
    remoteSchemaHash: hashRemoteSchema(schema),
    structure: {
      canvasComponentCount: structure.canvasComponents.length,
      pageComponentCount: structure.pageComponents.length,
    },
  };
}

function buildCanvasPageSchemaPatch(input = {}) {
  const observedIdentity = normalizeObservedIdentity(input);
  const desiredIdentity = normalizeDesiredIdentity(input);
  assertIdentityMatches(observedIdentity, desiredIdentity);
  const compiledPage = requireCompiledPage(input.compiledPage);
  const schema = normalizeSchema(input.remoteSchema);
  const beforeProjection = projectCanvasPageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema,
  });
  if (
    input.expectedRemoteSchemaHash !== undefined &&
    input.expectedRemoteSchemaHash !== beforeProjection.remoteSchemaHash
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_CONFLICT', 'Remote page Schema changed before patching.');
  }

  const desiredManaged = buildDesiredManaged(desiredIdentity.title, compiledPage);
  if (isDeepStrictEqual(beforeProjection.managed, desiredManaged)) {
    return {
      baselineRemoteSchemaHash: beforeProjection.remoteSchemaHash,
      managed: desiredManaged,
      managedHash: hashStable(desiredManaged),
      preparedRemoteSchemaHash: beforeProjection.remoteSchemaHash,
      schema,
      unmanagedHash: hashCanvasUnmanagedSchema(schema),
    };
  }

  const beforeUnmanagedHash = hashCanvasUnmanagedSchema(schema);
  const patched = clonePlain(schema);
  const structure = inspectCanvasStructure(patched);
  const canvasProps = requireCanvasProps(structure.canvasComponent);
  canvasProps.code = compiledPage.source;
  canvasProps.runtimeCode = compiledPage.runtimeCode;
  canvasProps.importedModules = compiledPage.importedModules;

  const afterUnmanagedHash = hashCanvasUnmanagedSchema(patched);
  if (afterUnmanagedHash !== beforeUnmanagedHash) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page patch changed unmanaged Schema content.');
  }
  const afterProjection = projectCanvasPageSchema({
    observedFormType: observedIdentity.formType,
    observedTitle: observedIdentity.title,
    schema: patched,
  });
  if (!isDeepStrictEqual(afterProjection.managed, desiredManaged)) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page patch did not produce the desired managed content.');
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

function buildDesiredManaged(title, compiledPage) {
  return {
    compiledHash: compiledPage.compiledHash,
    formType: DISPLAY_FORM_TYPE,
    profile: CANVAS_PAGE_PROFILE,
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
      foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page Schema content is empty.');
    }
    try {
      candidate = JSON.parse(candidate);
    } catch (error) {
      foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page Schema content is invalid.');
    }
  }
  assertPlainObject(candidate);
  return clonePlain(candidate);
}

function inspectCanvasStructure(schema) {
  if (
    schema.schemaType !== 'superform' ||
    typeof schema.schemaVersion !== 'string' ||
    !schema.schemaVersion.startsWith('5') ||
    !Array.isArray(schema.pages) ||
    schema.pages.length !== 1
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page Schema root is invalid.');
  }
  const page = schema.pages[0];
  assertPlainObject(page);
  if (!Array.isArray(page.componentsTree)) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page component tree is invalid.');
  }
  const components = collectComponents(page.componentsTree);
  if (components.some(component => component.componentName === 'Jsx')) {
    foundationError('SCHEMA_PAGE_FOUNDATION_PROFILE_UNSUPPORTED', 'Native page Schema is unsupported for canvas/default.');
  }
  const pageComponents = components.filter(component => component.componentName === 'Page');
  const canvasComponents = components.filter(component => component.componentName === 'YidaCodeCanvas');
  if (pageComponents.length !== 1 || canvasComponents.length !== 1) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page component structure is ambiguous.');
  }
  return {
    canvasComponent: canvasComponents[0],
    canvasComponents,
    pageComponents,
  };
}

function inspectCanvasProps(canvasComponent) {
  const props = requireCanvasProps(canvasComponent);
  const code = props.code;
  const runtimeCode = props.runtimeCode;
  const importedModules = props.importedModules;
  if (
    typeof code !== 'string' ||
    !code ||
    typeof runtimeCode !== 'string' ||
    !runtimeCode ||
    typeof importedModules !== 'string' ||
    !isJsonArrayString(importedModules)
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page managed props are incomplete.');
  }
  return { code, importedModules, runtimeCode };
}

function requireCanvasProps(canvasComponent) {
  assertPlainObject(canvasComponent);
  if (canvasComponent.props === undefined) {
    canvasComponent.props = {};
  }
  assertPlainObject(canvasComponent.props);
  return canvasComponent.props;
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

function hashCanvasUnmanagedSchema(schema) {
  const unmanaged = clonePlain(schema);
  stripManagedCanvasProps(unmanaged);
  return hashStable(normalizeShellFingerprintValue(unmanaged));
}

function stripManagedCanvasProps(schema) {
  let structure;
  try {
    structure = inspectCanvasStructure(schema);
  } catch (error) {
    return;
  }
  const props = requireCanvasProps(structure.canvasComponent);
  delete props.code;
  delete props.runtimeCode;
  delete props.importedModules;
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

function hashRemoteSchema(schema) {
  const normalized = clonePlain(schema);
  delete normalized.gmtModified;
  return hashStable(normalized);
}

function requireCompiledPage(value) {
  if (!isCompiledCanvasPage(value)) {
    foundationError('SCHEMA_PAGE_SOURCE_INVALID', 'Page patch requires trusted compiled Canvas source.');
  }
  return value;
}

function hashStableText(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function isJsonArrayString(value) {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

function assertPlainObject(value) {
  const prototype = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (prototype !== Object.prototype && prototype !== null)
  ) {
    foundationError('SCHEMA_PAGE_FOUNDATION_SCHEMA_INVALID', 'Canvas page Schema value must be a plain object.');
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
  buildCanvasPageSchemaPatch,
  projectCanvasPageSchema,
};
