'use strict';

const { schemaError } = require('../errors');
const { createSchemaHash, normalizeLabel, normalizeSchemaFields } = require('../../app/schema-field-resolution');
const {
  ASSOCIATION_FORM_FIELD_TYPE,
  TABLE_FIELD_TYPE,
  isOptionFieldType,
  isSupportedFieldType,
  normalizeFieldType,
} = require('../../app/services/form-compiler');
const { readFormSchema } = require('../../app/services/form-schema-reader');
const {
  convertFormToProcess,
  readFormMode,
} = require('../../app/services/form-mode-service');
const {
  createFormResource,
  prepareFormResourceUpdate,
  resumeFormResource,
  updateFormResource,
} = require('../../app/services/form-service');
const { requireSchemaServerRevision } = require('../server-revision');
const { sortStrings } = require('../sort');
const { validateSemanticKey } = require('./keys');
const { isDeepStrictEqual } = require('util');

const FIELD_COPY_KEYS = [
  'label',
  'required',
];

const formAdapter = {
  resourceType: 'form',
  adapterVersion: 1,
  validate(entry) {
    const formKey = entry.key;
    const form = entry.definition;
    const pointer = `/forms/${escapePointer(formKey)}`;
    validateSemanticKey(formKey, pointer);
    if (!form.fields || typeof form.fields !== 'object' || Array.isArray(form.fields) || Object.keys(form.fields).length === 0) {
      throw schemaError('SCHEMA_FORM_FIELDS_REQUIRED', 'Manifest forms must contain at least one field.', {
        path: `${pointer}/fields`,
      });
    }
    validateFields(form.fields, `${pointer}/fields`);
  },

  normalize(entry, context) {
    this.validate(entry, context);
    const formKey = entry.key;
    const form = entry.definition;
    const pointer = `/forms/${escapePointer(formKey)}`;

    const dependencySources = {};
    const dependsOn = new Set([`app:${context.appKey}`]);
    dependencySources[`app:${context.appKey}`] = [{ kind: 'dependsOn', path: pointer }];

    for (let index = 0; index < (form.dependsOn || []).length; index++) {
      const dependency = form.dependsOn[index];
      const target = normalizeDependency(dependency, context);
      dependsOn.add(target);
      addDependencySource(dependencySources, target, {
        kind: 'dependsOn',
        path: `${pointer}/dependsOn/${index}`,
      });
    }

    const fieldPaths = new Set();
    const fields = normalizeFields(form.fields || {}, {
      formKey,
      pointerPath: `${pointer}/fields`,
      semanticPrefix: '',
      fieldPaths,
      context,
      dependsOn,
      dependencySources,
    });

    const desired = {
      title: form.title,
      fields,
    };
    if (form.mode !== undefined) {
      desired.mode = form.mode;
    }

    return {
      resourceType: 'form',
      key: formKey,
      desired,
      dependsOn: sortStrings(dependsOn),
      dependencySources,
    };
  },

  async readObserved(binding, context = {}) {
    const normalized = normalizeFormBindings(binding);
    const appType = normalized.appType || context.appType;
    if (!appType || !normalized.formUuid) {
      throw schemaError('SCHEMA_OBSERVED_BINDING_MISSING', 'Form observed read requires appType and formUuid bindings.', {
        details: { resourceType: 'form' },
      });
    }
    const input = {
      appType,
      formUuid: normalized.formUuid,
    };
    const reader = context.services && context.services.readFormSchema || readFormSchema;
    assertAdapterDispatchBoundary(context, 'before');
    const schemaResult = await reader(context, input);
    assertAdapterDispatchBoundary(context, 'after');
    if (!shouldObserveMode(binding, context.resource)) {
      return schemaResult;
    }
    const modeReader = context.services && context.services.readFormMode || readFormMode;
    assertAdapterDispatchBoundary(context, 'before');
    const modeObservation = await modeReader(context, input);
    assertAdapterDispatchBoundary(context, 'after');
    return { modeObservation, schemaResult };
  },

  projectObserved(observed, binding, context = {}) {
    const normalized = normalizeFormBindings(binding);
    const observedParts = splitFormObserved(observed);
    const schemaResult = normalizeSchemaResult(observedParts.schemaResult);
    assertReadableFormSchema(schemaResult);
    const desired = context.resource && context.resource.desired || context.desired || {};
    const projectionBasis = binding && binding.lastApplied || desired;
    const schemaFieldsById = buildSchemaFieldsById(normalizeSchemaFields(schemaResult));
    const componentsByFieldId = buildComponentsByFieldId(schemaResult);
    const usedFieldBindings = {};
    const managed = {};
    const title = extractObservedTitle(schemaResult);
    if (title) {
      managed.title = title;
    }
    if (shouldProjectMode(projectionBasis, desired)) {
      const modeObservation = observedParts.modeObservation;
      if (!modeObservation || !['receipt', 'process'].includes(modeObservation.mode)) {
        throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Observed form mode is missing or unsupported.', {
          details: { resourceType: 'form' },
        });
      }
      managed.mode = modeObservation.mode;
    }
    const formBindingIndex = buildFormBindingIndex(context.state);
    managed.fields = projectObservedFields(projectionBasis.fields || [], {
      componentsByFieldId,
      fieldBindings: normalized.fieldBindings,
      formBindingIndex,
      schemaFieldsById,
      usedFieldBindings,
      expectedParentFieldId: null,
    });

    const bindings = {
      appType: normalized.appType || context.appType || '',
      formUuid: normalized.formUuid,
      fieldBindings: usedFieldBindings,
    };
    const observedProcessCode = observedParts.modeObservation && observedParts.modeObservation.processCode;
    if (observedProcessCode || normalized.processCode) {
      bindings.processCode = observedProcessCode || normalized.processCode;
    }
    return {
      managed,
      remoteSchemaHash: createSchemaHash(schemaResult),
      bindings,
    };
  },

  prepareComparison(input) {
    const desired = input && input.desired || {};
    const lastApplied = input && input.lastApplied || {};
    const observed = input && input.observed || {};
    if (
      Object.prototype.hasOwnProperty.call(desired, 'mode') &&
      !Object.prototype.hasOwnProperty.call(lastApplied, 'mode') &&
      ['receipt', 'process'].includes(observed.mode)
    ) {
      return {
        lastApplied: Object.assign({}, clonePlain(lastApplied), { mode: observed.mode }),
      };
    }
    return { lastApplied };
  },

  classifyObservedConflict(input) {
    const lastAppliedFields = indexManagedFields(input && input.lastApplied && input.lastApplied.fields);
    const desiredFields = indexManagedFields(input && input.desired && input.desired.fields);
    const observedFields = indexManagedFields(input && input.observed && input.observed.fields);

    for (const semanticPath of sortStrings(lastAppliedFields.keys())) {
      const previous = lastAppliedFields.get(semanticPath);
      const desired = desiredFields.get(semanticPath);
      const observed = observedFields.get(semanticPath);
      if (!observed) {
        return 'MANAGED_FIELD_MISSING';
      }
      if (!desired) {
        return 'FORM_MANAGED_FIELD_REMOVAL_UNSUPPORTED';
      }
      if (desired.type !== previous.type || observed.type !== previous.type) {
        return 'FORM_FIELD_TYPE_CHANGE_UNSUPPORTED';
      }
      if (
        hasRemovedOptionValues(previous.options, desired.options) ||
        hasRemovedOptionValues(previous.options, observed.options)
      ) {
        return 'FORM_OPTION_VALUE_CHANGE_UNSUPPORTED';
      }
      if (
        previous.form !== undefined &&
        (desired.form !== previous.form || observed.form !== previous.form)
      ) {
        return 'FORM_ASSOCIATION_TARGET_CHANGE_UNSUPPORTED';
      }
    }
    return undefined;
  },

  classifyUpdate(input) {
    const desired = input && input.desired || {};
    const observed = input && input.observed || {};
    return desired.mode === 'process' && observed.mode === 'receipt'
      ? 'FORM_MODE_CONVERSION'
      : undefined;
  },

  prepareOperation(input, context = {}) {
    if (!input || input.operation !== 'update') {
      return undefined;
    }
    const service = context.services && context.services.prepareFormResourceUpdate || prepareFormResourceUpdate;
    try {
      const operationInput = buildFormOperationInput(input.resource, input.stateResource, input.observed, context);
      const currentMode = operationInput.currentMode;
      const desiredMode = operationInput.targetMode;
      if (currentMode === 'process' && desiredMode === 'receipt') {
        throw schemaError('SCHEMA_APPLY_DESTRUCTIVE_CHANGE_UNSUPPORTED', 'Process forms cannot be converted back to receipt forms.', {
          details: {
            resourceType: 'form',
            key: input.resource && input.resource.key,
            operation: 'remove',
          },
        });
      }
      const prepared = service(operationInput);
      prepared.modeConversion = currentMode === 'receipt' && desiredMode === 'process';
      return prepared;
    } catch (error) {
      if (
        error &&
        (
          error.code === 'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED' ||
          error.code === 'FORM_COMPILER_FIELD_BINDING_TYPE_MISMATCH'
        )
      ) {
        throw schemaError('SCHEMA_APPLY_DESTRUCTIVE_CHANGE_UNSUPPORTED', 'Managed field removal or type replacement is not supported.', {
          details: {
            resourceType: 'form',
            key: input.resource && input.resource.key,
            semanticPath: error.details && error.details.semanticPath,
            operation: error.details && error.details.operation || 'replace_type',
          },
        });
      }
      throw error;
    }
  },

  async create(desired, context = {}) {
    const creator = context.services && context.services.createFormResource || createFormResource;
    const input = buildFormOperationInput(context.resource, null, null, context);
    return creator(context, input);
  },

  async resumeCreate(desired, createIdentity, context = {}) {
    const bindings = normalizeFormBindings(createIdentity);
    const observed = await readResumeCreateObservedForResume(this, desired, bindings, {
      ...context,
      resource: context.resource,
    });
    try {
      const projection = this.projectObserved(observed, { bindings, lastApplied: desired }, {
        ...context,
        desired,
        resource: context.resource,
      });
      if (!isDeepStrictEqual(projection.managed, desired)) {
        throw schemaError('SCHEMA_APPLY_JIT_CONFLICT', 'Bound form already contains different managed content.', {
          details: { resourceType: 'form' },
        });
      }
      return formIdentityResult(bindings, observed);
    } catch (error) {
      if (!error || error.code !== 'SCHEMA_OBSERVED_STRUCTURE_MISMATCH') {
        throw error;
      }
    }
    const resume = context.services && context.services.resumeFormResource || resumeFormResource;
    const input = buildFormOperationInput(context.resource, bindings, observed, context);
    return resume(context, input);
  },

  projectOperationResult(result, stateResource, context = {}) {
    if (
      context.recovery !== 'createIdentity' ||
      !result ||
      !Object.prototype.hasOwnProperty.call(result, 'schemaResult') ||
      !operationResultHasRequiredModeEvidence(result.schemaResult, context)
    ) {
      return null;
    }
    return this.projectObserved(result.schemaResult, {
      bindings: stateResource && stateResource.bindings,
      lastApplied: context.resource && context.resource.desired,
    }, context);
  },

  async update(desired, observed, binding, context = {}) {
    const updater = context.services && context.services.updateFormResource || updateFormResource;
    const input = buildFormOperationInput(context.resource, context.stateResource || binding, observed, context);
    input.prepared = context.prepared;
    const result = await updater(context, input);
    if (context.prepared && context.prepared.modeConversion) {
      const converter = context.services && context.services.convertFormToProcess || convertFormToProcess;
      assertAdapterDispatchBoundary(context, 'before');
      await converter(context, {
        appType: input.appType,
        formUuid: input.formUuid,
      });
      assertAdapterDispatchBoundary(context, 'after');
    }
    return result;
  },

  buildBindings(result, context = {}) {
    const existing = normalizeFormBindings(context.stateResource);
    const fieldBindings = {};
    const usedFieldIds = new Set();
    const resultBindings = result && result.fieldBindings || {};
    const componentTypes = result && result.fieldBindingComponents || {};
    for (const semanticPath of sortStrings(Object.keys(resultBindings))) {
      const fieldId = resultBindings[semanticPath];
      if (usedFieldIds.has(fieldId)) {
        throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Form operation produced ambiguous field bindings.', {
          details: {
            resourceType: 'form',
            key: context.resource && context.resource.key,
            semanticPath,
          },
        });
      }
      usedFieldIds.add(fieldId);
      fieldBindings[semanticPath] = {
        fieldId,
        componentType: componentTypes[semanticPath] || '',
      };
    }
    const bindings = {
      appType: result && result.appType || existing.appType || resolveAppType(context.resource, context.state),
      formUuid: result && result.formUuid || existing.formUuid,
      fieldBindings,
    };
    if (context.identityCheckpoint === true) {
      if (!bindings.appType || !bindings.formUuid) {
        throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Form create identity is incomplete.', {
          details: { resourceType: 'form' },
        });
      }
      return bindings;
    }
    const processCode = result && result.processCode || existing.processCode;
    if (processCode) {
      bindings.processCode = processCode;
    }
    if (!bindings.appType || !bindings.formUuid || Object.keys(bindings.fieldBindings).length === 0) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Form operation did not produce complete bindings.', {
        details: {
          resourceType: 'form',
          key: context.resource && context.resource.key,
        },
      });
    }
    return bindings;
  },

  verify(projection, context = {}) {
    if (context.recovery === 'pending' && context.operation === 'update') {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Pending form update lacks durable pre-write Schema evidence.', {
        details: {
          resourceType: 'form',
          key: context.resource && context.resource.key,
        },
      });
    }
    if (!projection || !isDeepStrictEqual(projection.managed, context.resource && context.resource.desired)) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Form observed projection does not match desired managed state.', {
        details: {
          resourceType: 'form',
          key: context.resource && context.resource.key,
        },
      });
    }
    if (
      context.operation === 'update' &&
      context.recovery !== 'pending' &&
      !context.prepared &&
      !context.expectedRemoteSchemaHash
    ) {
      throw schemaError('SCHEMA_RECONCILIATION_REQUIRED', 'Form update verification lacks full-Schema evidence.', {
        details: {
          resourceType: 'form',
          key: context.resource && context.resource.key,
        },
      });
    }
    const expectedRemoteSchemaHash = context.prepared && context.prepared.schema
      ? createSchemaHash({ content: context.prepared.schema })
      : context.expectedRemoteSchemaHash;
    if (
      expectedRemoteSchemaHash &&
      projection.remoteSchemaHash !== expectedRemoteSchemaHash
    ) {
      throw schemaError('SCHEMA_APPLY_VERIFY_FAILED', 'Form post-write Schema contains an unexpected remote delta.', {
        details: {
          resourceType: 'form',
          key: context.resource && context.resource.key,
          property: 'remoteSchema',
        },
      });
    }
    return projection;
  },

  validateStateResource(entry) {
    validateFormStateResource(entry);
  },
};

function assertAdapterDispatchBoundary(context, phase) {
  if (typeof context.assertRemoteDispatchBoundary === 'function') {
    context.assertRemoteDispatchBoundary(phase);
  }
}

async function readResumeCreateObserved(adapter, bindings, context) {
  const retry = normalizeFormResumeReadbackRetry(context && context.formPostWriteReadbackRetry);
  let lastError;
  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      return await adapter.readObserved({ bindings }, context);
    } catch (error) {
      if (!isRetryableFormResumeReadbackError(error) || attempt === retry.maxAttempts) {
        throw error;
      }
      lastError = error;
      await waitForFormResumeReadback(retry.delayMs);
    }
  }
  throw lastError;
}

async function readResumeCreateObservedForResume(adapter, desired, bindings, context) {
  try {
    return await readResumeCreateObserved(adapter, bindings, context);
  } catch (error) {
    if (!shouldFallbackReceiptResumeModeRead(error, desired)) {
      throw error;
    }
    const schemaOnlyObserved = await readResumeCreateObserved(adapter, bindings, {
      ...context,
      resource: omitDesiredMode(context && context.resource),
    });
    return {
      schemaResult: schemaOnlyObserved,
      modeObservation: { mode: 'receipt' },
    };
  }
}

function shouldFallbackReceiptResumeModeRead(error, desired) {
  return !!(
    error &&
    error.code === 'FORM_MODE_READ_FAILED' &&
    desired &&
    desired.mode === 'receipt' &&
    !isAuthCsrfOrPermissionReadFailure(error)
  );
}

function operationResultHasRequiredModeEvidence(observed, context = {}) {
  const desired = context.resource && context.resource.desired || {};
  if (!Object.prototype.hasOwnProperty.call(desired, 'mode')) {
    return true;
  }
  const modeObservation = splitFormObserved(observed).modeObservation;
  if (!modeObservation || modeObservation.mode !== desired.mode) {
    return false;
  }
  return desired.mode !== 'process' ||
    (typeof modeObservation.processCode === 'string' && modeObservation.processCode.length > 0);
}

function omitDesiredMode(resource) {
  if (!resource || !resource.desired || !Object.prototype.hasOwnProperty.call(resource.desired, 'mode')) {
    return resource;
  }
  const desired = { ...resource.desired };
  delete desired.mode;
  return { ...resource, desired };
}

function normalizeFormResumeReadbackRetry(config = {}) {
  return {
    maxAttempts: Number.isInteger(config.maxAttempts) && config.maxAttempts > 0
      ? config.maxAttempts
      : 1,
    delayMs: Number.isInteger(config.delayMs) && config.delayMs >= 0
      ? config.delayMs
      : 0,
  };
}

function isRetryableFormResumeReadbackError(error) {
  if (!error || isAuthCsrfOrPermissionReadFailure(error)) {
    return false;
  }
  return error.code === 'FORM_SCHEMA_READ_FAILED' ||
    error.code === 'FORM_MODE_READ_FAILED' ||
    error.code === 'SCHEMA_REMOTE_READ_FAILED' ||
    error.code === 'SCHEMA_REMOTE_RESOURCE_MISSING';
}

function isAuthCsrfOrPermissionReadFailure(error) {
  const result = error &&
    error.details &&
    error.details.result;
  if (!result) {
    return false;
  }
  if (result.__needLogin || result.__csrfExpired) {
    return true;
  }
  if (result.__httpStatus === 401 || result.__httpStatus === 403) {
    return true;
  }
  const code = String(result.errorCode || result.code || '').toUpperCase();
  if (code === '401' || code === '403' || code.includes('FORBIDDEN') || code.includes('PERMISSION')) {
    return true;
  }
  const message = String(result.errorMsg || result.message || error.message || '').toLowerCase();
  return /forbidden|permission|unauthori[sz]ed|access denied|无权限|权限不足|未授权/.test(message);
}

function waitForFormResumeReadback(delayMs) {
  if (delayMs === 0) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function validateFields(fields, pointerPath) {
  for (const fieldKey of Object.keys(fields)) {
    const pointer = `${pointerPath}/${escapePointer(fieldKey)}`;
    validateSemanticKey(fieldKey, pointer);
    const field = fields[fieldKey];
    const fieldType = normalizeFieldType(field && field.type);
    if (!isSupportedFieldType(fieldType)) {
      throw schemaError('SCHEMA_FIELD_TYPE_UNSUPPORTED', 'Field type is not supported by the SAC-01 form compiler.', {
        path: `${pointer}/type`,
        details: { fieldType: field && field.type },
      });
    }

    if (field.children !== undefined && fieldType !== TABLE_FIELD_TYPE) {
      throw schemaError('SCHEMA_FIELD_PROPERTY_INVALID', 'children is only supported on TableField.', {
        path: `${pointer}/children`,
        details: { property: 'children', fieldType },
      });
    }
    if (field.form !== undefined && fieldType !== ASSOCIATION_FORM_FIELD_TYPE) {
      throw schemaError('SCHEMA_FIELD_PROPERTY_INVALID', 'form is only supported on AssociationFormField.', {
        path: `${pointer}/form`,
        details: { property: 'form', fieldType },
      });
    }
    if (field.options !== undefined && !isOptionFieldType(fieldType)) {
      throw schemaError('SCHEMA_FIELD_PROPERTY_INVALID', 'options is only supported on option fields.', {
        path: `${pointer}/options`,
        details: { property: 'options', fieldType },
      });
    }
    if (field.options !== undefined && isOptionFieldType(fieldType)) {
      validateOptionValues(field.options, `${pointer}/options`);
    }
    if (field.children !== undefined) {
      validateFields(field.children, `${pointer}/children`);
    }
  }
}

function validateOptionValues(options, pointer) {
  if (!Array.isArray(options)) {
    return;
  }
  options.forEach((option, index) => {
    const optionPointer = `${pointer}/${index}`;
    if (option && typeof option === 'object' && !Array.isArray(option)) {
      assertNonBlankOptionValue(option.label, `${optionPointer}/label`);
      assertNonBlankOptionValue(option.value, `${optionPointer}/value`);
      return;
    }
    assertNonBlankOptionValue(option, optionPointer);
  });
}

function assertNonBlankOptionValue(value, pointer) {
  if (String(value).trim() === '') {
    throw schemaError('SCHEMA_FIELD_PROPERTY_INVALID', 'Option label and value must not be blank.', {
      path: pointer,
      details: { property: 'options' },
    });
  }
}

function normalizeFields(fields, context) {
  return sortStrings(Object.keys(fields)).map(fieldKey => {
    const pointer = `${context.pointerPath}/${escapePointer(fieldKey)}`;
    validateSemanticKey(fieldKey, pointer);

    const semanticPath = context.semanticPrefix ? `${context.semanticPrefix}.${fieldKey}` : fieldKey;
    if (context.fieldPaths.has(semanticPath)) {
      throw schemaError('SCHEMA_DUPLICATE_KEY', 'Field semantic paths must be unique within a form.', {
        path: pointer,
        details: { semanticPath },
      });
    }
    context.fieldPaths.add(semanticPath);

    const field = fields[fieldKey];
    const fieldType = normalizeFieldType(field.type);
    const desired = {
      key: fieldKey,
      semanticPath,
      type: fieldType,
    };
    for (const copyKey of FIELD_COPY_KEYS) {
      if (field[copyKey] !== undefined) {
        desired[copyKey] = clonePlain(field[copyKey]);
      }
    }
    if (field.options !== undefined) {
      desired.options = normalizeManagedOptions(field.options);
    }

    if (field.form) {
      const target = normalizeFormReference(field.form, context.context);
      desired.form = target;
      context.dependsOn.add(target);
      addDependencySource(context.dependencySources, target, {
        kind: 'reference',
        path: `${pointer}/form`,
      });
    }

    for (let index = 0; index < (field.dependsOn || []).length; index++) {
      const dependency = field.dependsOn[index];
      const target = normalizeDependency(dependency, context.context);
      context.dependsOn.add(target);
      addDependencySource(context.dependencySources, target, {
        kind: 'dependsOn',
        path: `${pointer}/dependsOn/${index}`,
      });
    }

    if (field.children) {
      desired.children = normalizeFields(field.children, {
        ...context,
        pointerPath: `${pointer}/children`,
        semanticPrefix: semanticPath,
      });
    }

    return desired;
  });
}

function normalizeDependency(value, context) {
  if (String(value).includes(':')) {
    const [resourceType, key, extra] = String(value).split(':');
    if (!resourceType || !key || extra !== undefined) {
      throw schemaError('SCHEMA_INVALID_REFERENCE', 'Resource references must use "resourceType:key" or a form key.', {
        details: { resourceType },
      });
    }
    assertRegisteredResourceType(resourceType, context);
    validateSemanticKey(resourceType, undefined);
    validateSemanticKey(key, undefined);
    return `${resourceType}:${key}`;
  }
  validateSemanticKey(value, undefined);
  return `form:${value}`;
}

function normalizeFormReference(value, context) {
  if (String(value).includes(':')) {
    const [resourceType, key, extra] = String(value).split(':');
    if (!resourceType || !key || extra !== undefined) {
      throw schemaError('SCHEMA_INVALID_REFERENCE', 'Association form references must use a form key or "form:key".', {
        details: { resourceType },
      });
    }
    assertRegisteredResourceType(resourceType, context);
    if (resourceType !== 'form') {
      throw schemaError('SCHEMA_INVALID_REFERENCE', 'Association form references must target a form resource.', {
        details: { resourceType },
      });
    }
    validateSemanticKey(key, undefined);
    return `form:${key}`;
  }
  validateSemanticKey(value, undefined);
  return `form:${value}`;
}

function assertRegisteredResourceType(resourceType, context) {
  if (!context || !context.registry) {
    return;
  }
  context.registry.get(resourceType);
}

function addDependencySource(sources, target, source) {
  if (!sources[target]) {
    sources[target] = [];
  }
  sources[target].push(source);
}

function clonePlain(value) {
  if (value === undefined || value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeSchemaResult(schemaResult) {
  let content = schemaResult && Object.prototype.hasOwnProperty.call(schemaResult, 'content')
    ? schemaResult.content
    : schemaResult;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (error) {
      throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Observed form Schema content is invalid.', {
        details: { resourceType: 'form' },
      });
    }
  }
  return { content };
}

function assertReadableFormSchema(schemaResult) {
  const content = schemaResult && schemaResult.content;
  if (
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    !Array.isArray(content.pages) ||
    !findFirstComponent(content, 'FormContainer')
  ) {
    throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Observed form Schema is incomplete or unsupported.', {
      details: { resourceType: 'form' },
    });
  }
}

function normalizeFormBindings(binding) {
  const source = binding && binding.bindings ? binding.bindings : binding || {};
  return {
    appType: source.appType || '',
    formUuid: source.formUuid || '',
    fieldBindings: normalizeObservedFieldBindings(source.fieldBindings || source.fields || {}),
    processCode: source.processCode || '',
  };
}

function shouldObserveMode(binding, resource) {
  const desired = resource && resource.desired || {};
  const lastApplied = binding && binding.lastApplied || {};
  return Object.prototype.hasOwnProperty.call(desired, 'mode') ||
    Object.prototype.hasOwnProperty.call(lastApplied, 'mode');
}

function shouldProjectMode(projectionBasis, desired) {
  return Object.prototype.hasOwnProperty.call(projectionBasis || {}, 'mode') ||
    Object.prototype.hasOwnProperty.call(desired || {}, 'mode');
}

function splitFormObserved(observed) {
  if (
    observed &&
    Object.prototype.hasOwnProperty.call(observed, 'schemaResult') &&
    Object.prototype.hasOwnProperty.call(observed, 'modeObservation')
  ) {
    return observed;
  }
  return { schemaResult: observed, modeObservation: undefined };
}

function normalizeObservedFieldBindings(fieldBindings) {
  const result = {};
  const usedFieldIds = new Set();
  sortStrings(Object.keys(fieldBindings || {})).forEach((semanticPath) => {
    const value = fieldBindings[semanticPath];
    const binding = typeof value === 'string'
      ? { fieldId: value }
      : Object.assign({}, value || {});
    const fieldId = String(binding.fieldId || binding.id || binding.value || '');
    if (fieldId && usedFieldIds.has(fieldId)) {
      throw schemaError('SCHEMA_OBSERVED_BINDING_AMBIGUOUS', 'Form field bindings contain a duplicate fieldId.', {
        details: { semanticPath },
      });
    }
    if (fieldId) {
      usedFieldIds.add(fieldId);
    }
    result[semanticPath] = { fieldId };
    if (binding.componentType || binding.componentName) {
      result[semanticPath].componentType = binding.componentType || binding.componentName;
    }
  });
  return result;
}

function normalizeManagedOptions(options) {
  return (Array.isArray(options) ? options : []).map((option) => {
    if (option && typeof option === 'object') {
      return {
        label: String(option.label !== undefined ? option.label : option.value),
        value: String(option.value !== undefined ? option.value : option.label),
      };
    }
    const value = String(option);
    return {
      label: value,
      value,
    };
  });
}

function projectObservedFields(fields, context) {
  return (Array.isArray(fields) ? fields : []).map((field) => {
    const semanticPath = field.semanticPath || field.key;
    const binding = context.fieldBindings[semanticPath];
    if (!binding || !binding.fieldId) {
      throw schemaError('SCHEMA_OBSERVED_BINDING_MISSING', 'Observed form projection requires fieldId bindings.', {
        details: { semanticPath },
      });
    }

    const schemaField = context.schemaFieldsById.get(binding.fieldId);
    if (!schemaField) {
      return null;
    }
    validateObservedParent(semanticPath, schemaField, context.expectedParentFieldId);

    const component = context.componentsByFieldId.get(binding.fieldId) || {};
    const props = component.props || {};
    const projected = {
      key: field.key,
      semanticPath,
      type: schemaField.componentType,
    };
    if (field.label !== undefined) {
      projected.label = normalizeLabel(props.label, schemaField.label);
    }
    if (field.required !== undefined) {
      projected.required = hasRequiredValidation(props);
    }
    if (field.options !== undefined) {
      projected.options = normalizeObservedOptions(props);
    }
    if (field.form !== undefined) {
      projected.form = resolveObservedAssociationForm(semanticPath, props.associationForm, context.formBindingIndex);
    }
    context.usedFieldBindings[semanticPath] = {
      fieldId: binding.fieldId,
      componentType: schemaField.componentType,
    };
    if (Array.isArray(field.children)) {
      projected.children = projectObservedFields(field.children, Object.assign({}, context, {
        expectedParentFieldId: binding.fieldId,
      }));
    }
    return projected;
  }).filter(Boolean);
}

function validateObservedParent(semanticPath, schemaField, expectedParentFieldId) {
  const actualParentFieldId = schemaField.parentFieldId || null;
  const expected = expectedParentFieldId || null;
  if (actualParentFieldId !== expected) {
    throw schemaError('SCHEMA_OBSERVED_STRUCTURE_MISMATCH', 'Observed field parent does not match the managed semantic path.', {
      details: {
        semanticPath,
        expectedParentBound: expected !== null,
        actualParentBound: actualParentFieldId !== null,
      },
    });
  }
}

function buildComponentsByFieldId(schemaResult) {
  const components = new Map();
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;

  function visit(node) {
    if (!node || typeof node !== 'object') {
      return;
    }
    const fieldId = node.props && node.props.fieldId;
    if (fieldId) {
      if (components.has(fieldId)) {
        throw schemaError('SCHEMA_OBSERVED_BINDING_AMBIGUOUS', 'Remote form Schema contains a duplicate fieldId.', {
          details: { resourceType: 'form' },
        });
      }
      components.set(fieldId, node);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }

  if (Array.isArray(pages)) {
    pages.forEach((page) => {
      const roots = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
      roots.forEach(visit);
    });
  }
  return components;
}

function buildSchemaFieldsById(fields) {
  const result = new Map();
  for (const field of fields || []) {
    if (!field.fieldId) {
      continue;
    }
    if (result.has(field.fieldId)) {
      throw schemaError('SCHEMA_OBSERVED_BINDING_AMBIGUOUS', 'Remote form Schema contains a duplicate fieldId.', {
        details: { resourceType: 'form' },
      });
    }
    result.set(field.fieldId, field);
  }
  return result;
}

function indexManagedFields(fields, result = new Map()) {
  for (const field of Array.isArray(fields) ? fields : []) {
    const semanticPath = field && (field.semanticPath || field.key);
    if (semanticPath) {
      result.set(semanticPath, field);
    }
    indexManagedFields(field && field.children, result);
  }
  return result;
}

function hasRemovedOptionValues(previousOptions, nextOptions) {
  if (!Array.isArray(previousOptions)) {
    return false;
  }
  const nextValues = new Set((Array.isArray(nextOptions) ? nextOptions : []).map(option => (
    String(option && typeof option === 'object' ? option.value : option)
  )));
  return previousOptions.some(option => (
    !nextValues.has(String(option && typeof option === 'object' ? option.value : option))
  ));
}

function buildFormBindingIndex(state) {
  const result = new Map();
  const forms = state && state.resources && state.resources.form || {};
  Object.keys(forms).forEach((formKey) => {
    const bindings = forms[formKey] && forms[formKey].bindings || {};
    const formUuid = bindings.formUuid || '';
    if (!formUuid) {
      return;
    }
    const appType = bindings.appType || '';
    const keys = [
      `${appType}:${formUuid}`,
      `:${formUuid}`,
    ];
    keys.forEach((lookupKey) => {
      const existing = result.get(lookupKey) || [];
      existing.push(formKey);
      result.set(lookupKey, existing);
    });
  });
  return result;
}

function resolveObservedAssociationForm(semanticPath, associationForm, formBindingIndex) {
  const formUuid = associationForm && associationForm.formUuid || '';
  const appType = associationForm && associationForm.appType || '';
  if (!formUuid) {
    throw schemaError('SCHEMA_OBSERVED_REFERENCE_MISSING', 'Association field observed formUuid is missing.', {
      details: { semanticPath },
    });
  }
  const candidates = formBindingIndex.get(`${appType}:${formUuid}`) || formBindingIndex.get(`:${formUuid}`) || [];
  const uniqueCandidates = sortStrings([...new Set(candidates)]);
  if (uniqueCandidates.length === 0) {
    throw schemaError('SCHEMA_OBSERVED_REFERENCE_MISSING', 'Association field target form is not bound in state.', {
      details: { semanticPath },
    });
  }
  if (uniqueCandidates.length > 1) {
    throw schemaError('SCHEMA_OBSERVED_REFERENCE_AMBIGUOUS', 'Association field target form binding is ambiguous.', {
      details: { semanticPath },
    });
  }
  return `form:${uniqueCandidates[0]}`;
}

function extractObservedTitle(schemaResult) {
  const content = schemaResult && schemaResult.content || {};
  const direct = normalizeLocalizedText(content.title || content.name || content.formName);
  if (direct) {
    return direct;
  }
  const container = findFirstComponent(content, 'FormContainer');
  return normalizeLocalizedText(container && container.props && container.props.formLabel);
}

function findFirstComponent(schema, componentName) {
  let found = null;
  function visit(node) {
    if (!node || typeof node !== 'object' || found) {
      return;
    }
    if (node.componentName === componentName) {
      found = node;
      return;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }
  const pages = schema && schema.pages;
  if (Array.isArray(pages)) {
    pages.forEach((page) => {
      const roots = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
      roots.forEach(visit);
    });
  }
  return found;
}

function buildFormOperationInput(resource, stateResource, observed, context) {
  const normalized = normalizeFormBindings(stateResource);
  const appType = normalized.appType || resolveAppType(resource, context.state);
  const observedParts = splitFormObserved(observed);
  const operationInput = {
    appType,
    currentMode: observedParts.modeObservation && observedParts.modeObservation.mode,
    formUuid: normalized.formUuid,
    formType: resource.desired.mode,
    definition: {
      title: resource.desired.title,
      fields: buildCompilerFields(resource.desired.fields || [], context.state),
    },
    existingBindings: normalized.fieldBindings,
    currentSchemaResult: observedParts.schemaResult,
    targetMode: resource.desired.mode,
  };
  if (observed !== undefined && observed !== null) {
    operationInput.serverRevision = requireSchemaServerRevision(
      observedParts.schemaResult,
      () => schemaError('SCHEMA_REMOTE_READ_FAILED', 'Observed form Schema revision is missing or invalid.', {
        details: { resourceType: 'form' },
      })
    );
  }
  return operationInput;
}

function buildCompilerFields(fields, state) {
  return (Array.isArray(fields) ? fields : []).map((field) => {
    const result = {
      key: field.key,
      type: field.type,
    };
    for (const key of ['label', 'required', 'options']) {
      if (field[key] !== undefined) {
        result[key] = clonePlain(field[key]);
      }
    }
    if (Array.isArray(field.children)) {
      result.children = buildCompilerFields(field.children, state);
    }
    if (field.form) {
      const targetKey = String(field.form).slice('form:'.length);
      const target = state && state.resources && state.resources.form && state.resources.form[targetKey];
      const bindings = target && target.bindings || {};
      if (!bindings.appType || !bindings.formUuid) {
        throw schemaError('SCHEMA_STATE_RESOURCE_BINDING_MISSING', 'Association target form bindings are missing.', {
          details: { resourceType: 'form', key: targetKey },
        });
      }
      result.associationForm = {
        appType: bindings.appType,
        formUuid: bindings.formUuid,
      };
    }
    return result;
  });
}

function formIdentityResult(bindings, schemaResult) {
  const fieldBindings = {};
  const fieldBindingComponents = {};
  for (const semanticPath of Object.keys(bindings.fieldBindings)) {
    const binding = bindings.fieldBindings[semanticPath];
    fieldBindings[semanticPath] = binding.fieldId;
    fieldBindingComponents[semanticPath] = binding.componentType || '';
  }
  return {
    appType: bindings.appType,
    formUuid: bindings.formUuid,
    fieldBindings,
    fieldBindingComponents,
    schemaResult,
  };
}

function resolveAppType(resource, state) {
  const appDependency = (resource && resource.dependsOn || []).find(value => String(value).startsWith('app:'));
  const appKey = appDependency && appDependency.slice('app:'.length);
  const appState = appKey && state && state.resources && state.resources.app && state.resources.app[appKey];
  const appType = appState && appState.bindings && appState.bindings.appType;
  if (!appType) {
    throw schemaError('SCHEMA_STATE_RESOURCE_BINDING_MISSING', 'Form app dependency binding is missing.', {
      details: { resourceType: 'app', key: appKey },
    });
  }
  return appType;
}

function normalizeLocalizedText(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.zh_CN || value.en_US || sortStrings(Object.keys(value)).map(key => value[key]).find(Boolean) || '';
  }
  return value === undefined || value === null ? '' : String(value);
}

function hasRequiredValidation(props) {
  if (props.required === true) {
    return true;
  }
  return Array.isArray(props.validation) && props.validation.some(rule => (
    rule && (rule.type === 'required' || rule.required === true)
  ));
}

function normalizeObservedOptions(props) {
  const options = Array.isArray(props.dataSource)
    ? props.dataSource
    : props.defaultDataSource && Array.isArray(props.defaultDataSource.options)
      ? props.defaultDataSource.options
      : [];
  return options.map((option) => {
    if (option && typeof option === 'object') {
      const value = String(option.value !== undefined ? option.value : normalizeLocalizedText(option.text));
      return {
        label: normalizeLocalizedText(option.text || option.label || value),
        value,
      };
    }
    const value = String(option);
    return { label: value, value };
  });
}

function validateFormStateResource(entry) {
  const state = entry.state || {};
  validateFormBindings(state.bindings, `${entry.path}/bindings`);
  if (state.lastApplied !== undefined) {
    validateManagedForm(state.lastApplied, `${entry.path}/lastApplied`);
    if (state.lastApplied.mode === 'process' && !state.bindings.processCode) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Process-mode form state requires processCode bindings.', {
        path: `${entry.path}/bindings/processCode`,
      });
    }
  }
}

function validateFormBindings(bindings, pointer) {
  assertAllowedKeys(bindings, ['appType', 'formUuid', 'fieldBindings', 'processCode'], pointer);
  if (!bindings.appType || typeof bindings.appType !== 'string') {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form state bindings must include appType.', {
      path: `${pointer}/appType`,
    });
  }
  if (!bindings.formUuid || typeof bindings.formUuid !== 'string') {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form state bindings must include formUuid.', {
      path: `${pointer}/formUuid`,
    });
  }
  if (!bindings.fieldBindings || typeof bindings.fieldBindings !== 'object' || Array.isArray(bindings.fieldBindings)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form state fieldBindings must be an object.', {
      path: `${pointer}/fieldBindings`,
    });
  }
  if (bindings.processCode !== undefined && (typeof bindings.processCode !== 'string' || !bindings.processCode)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form state processCode must be a non-empty string.', {
      path: `${pointer}/processCode`,
    });
  }
  const usedFieldIds = new Set();
  Object.keys(bindings.fieldBindings).forEach((semanticPath) => {
    const fieldBinding = bindings.fieldBindings[semanticPath];
    const fieldPointer = `${pointer}/fieldBindings/${escapePointer(semanticPath)}`;
    if (!fieldBinding || typeof fieldBinding !== 'object' || Array.isArray(fieldBinding)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Form field binding must be an object.', {
        path: fieldPointer,
      });
    }
    assertAllowedKeys(fieldBinding, ['fieldId', 'componentType'], fieldPointer);
    if (!fieldBinding.fieldId || typeof fieldBinding.fieldId !== 'string') {
      throw schemaError('SCHEMA_STATE_INVALID', 'Form field binding must include fieldId.', {
        path: `${fieldPointer}/fieldId`,
      });
    }
    if (usedFieldIds.has(fieldBinding.fieldId)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Form state fieldBindings must map to unique fieldId values.', {
        path: `${fieldPointer}/fieldId`,
      });
    }
    usedFieldIds.add(fieldBinding.fieldId);
    if (fieldBinding.componentType !== undefined && typeof fieldBinding.componentType !== 'string') {
      throw schemaError('SCHEMA_STATE_INVALID', 'Form field binding componentType must be a string.', {
        path: `${fieldPointer}/componentType`,
      });
    }
  });
}

function validateManagedForm(value, pointer) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form lastApplied must be a compact managed object.', {
      path: pointer,
    });
  }
  assertAllowedKeys(value, ['title', 'fields', 'mode'], pointer);
  if (typeof value.title !== 'string' || !value.title) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form lastApplied must include title.', {
      path: `${pointer}/title`,
    });
  }
  if (!Array.isArray(value.fields)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form lastApplied fields must be an array.', {
      path: `${pointer}/fields`,
    });
  }
  if (value.mode !== undefined && !['receipt', 'process'].includes(value.mode)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Form lastApplied mode must be receipt or process.', {
      path: `${pointer}/mode`,
    });
  }
  value.fields.forEach((field, index) => validateManagedField(field, `${pointer}/fields/${index}`));
}

function validateManagedField(field, pointer) {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Managed field must be an object.', {
      path: pointer,
    });
  }
  assertAllowedKeys(field, ['key', 'semanticPath', 'type', 'label', 'required', 'options', 'form', 'children'], pointer);
  ['key', 'semanticPath', 'type', 'label'].forEach((property) => {
    if (typeof field[property] !== 'string' || !field[property]) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Managed field is missing a required string property.', {
        path: `${pointer}/${property}`,
        details: { property },
      });
    }
  });
  if (field.required !== undefined && typeof field.required !== 'boolean') {
    throw schemaError('SCHEMA_STATE_INVALID', 'Managed field required must be boolean.', {
      path: `${pointer}/required`,
    });
  }
  if (field.form !== undefined && (typeof field.form !== 'string' || !field.form.startsWith('form:'))) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Managed association form reference must be canonical.', {
      path: `${pointer}/form`,
    });
  }
  if (field.options !== undefined) {
    validateManagedOptions(field.options, `${pointer}/options`);
  }
  if (field.children !== undefined) {
    if (!Array.isArray(field.children)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Managed field children must be an array.', {
        path: `${pointer}/children`,
      });
    }
    field.children.forEach((child, index) => validateManagedField(child, `${pointer}/children/${index}`));
  }
}

function validateManagedOptions(options, pointer) {
  if (!Array.isArray(options)) {
    throw schemaError('SCHEMA_STATE_INVALID', 'Managed field options must be an array.', {
      path: pointer,
    });
  }
  options.forEach((option, index) => {
    const optionPointer = `${pointer}/${index}`;
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      throw schemaError('SCHEMA_STATE_INVALID', 'Managed option must be an object.', {
        path: optionPointer,
      });
    }
    assertAllowedKeys(option, ['label', 'value'], optionPointer);
    if (typeof option.label !== 'string' || typeof option.value !== 'string') {
      throw schemaError('SCHEMA_STATE_INVALID', 'Managed option label and value must be strings.', {
        path: optionPointer,
      });
    }
  });
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
  formAdapter,
  normalizeDependency,
  normalizeFormReference,
  normalizeManagedOptions,
};
