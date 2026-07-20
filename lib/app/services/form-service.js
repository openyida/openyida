'use strict';

const querystring = require('querystring');
const { httpPost, requestWithAutoLogin } = require('../../core/utils');
const { normalizeFormulaFieldRefs } = require('../../formula/evaluate');
const { compileFormDefinition, i18n } = require('./form-compiler');
const { readFormSchema, createFormServiceError } = require('./form-schema-reader');
const { verifyFieldBindings } = require('./field-bindings');
const { patchManagedFormSchema } = require('./form-schema-patcher');
const {
  createServerRevisionConflict,
  isSaveFormSchemaRevisionConflict,
  requireSchemaServerRevision,
} = require('../../schema/server-revision');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
} = require('../../schema/remote-dispatch-boundary');
const { isTokenAuthRef } = require('../../core/yida-client');

function resolveAuthRef(context) {
  return context && context.authRef ? context.authRef : context;
}

function buildFormDesignApiPath(appType, apiName, options = {}) {
  const { prefix = '', namespace = 'dingtalk', addTimestamp = false } = options;
  const prefixPath = prefix ? `/${prefix}` : '';
  const timestamp = addTimestamp ? `?_stamp=${Date.now()}` : '';
  return `/${namespace}/web/${appType}${prefixPath}/query/formdesign/${apiName}.json${timestamp}`;
}

function postFormDesign(auth, appType, apiName, params, options, request = httpPost) {
  const postData = querystring.stringify(
    Object.assign({ _csrf_token: auth.csrfToken }, params)
  );
  const formUuid = params && params.formUuid;
  const referer = formUuid
    ? `${auth.baseUrl}/alibaba/web/${params.appType || appType || ''}/design/pageDesigner?formUuid=${formUuid}`
    : auth.baseUrl + '/';
  return request(
    auth.baseUrl,
    buildFormDesignApiPath(appType, apiName, options),
    postData,
    auth.cookies,
    { referer }
  );
}

function sanitizeServiceResult(result) {
  if (!result || typeof result !== 'object') {
    return result || null;
  }
  const sanitized = {};
  ['success', 'errorMsg', 'errorCode', 'code', 'message', '__httpStatus', '__nonJsonResponse', '__emptyBody'].forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      sanitized[key] = result[key];
    }
  });
  return sanitized;
}

function assertSuccess(result, code, details) {
  if (result && result.success !== false && !result.__needLogin && !result.__csrfExpired) {
    return result;
  }
  const message = result ? result.errorMsg || 'request failed' : 'request failed';
  throw createFormServiceError(message, code, Object.assign({ result: sanitizeServiceResult(result) }, details));
}

function assertConfigSuccess(result, details) {
  if (result && result.success) {
    return result;
  }
  if (isAcceptedNonJsonConfigResponse(result)) {
    return {
      success: true,
      acceptedNonJsonResponse: true,
      acceptedEmptyResponse: result.__emptyBody === true,
    };
  }
  const message = result ? result.errorMsg || 'config update failed' : 'config update failed';
  throw createFormServiceError(message, 'FORM_CONFIG_UPDATE_FAILED', Object.assign({
    result: sanitizeServiceResult(result),
  }, details));
}

function isAcceptedNonJsonConfigResponse(result) {
  return !!(
    result &&
    result.success === false &&
    result.__httpStatus === 200 &&
    result.__nonJsonResponse === true &&
    !result.__needLogin &&
    !result.__csrfExpired &&
    result.errorCode === undefined &&
    result.code === undefined
  );
}

function assertFieldBindingVerification(verification, details) {
  const missing = verification && Array.isArray(verification.missing) ? verification.missing : [];
  const mismatched = verification && Array.isArray(verification.mismatched) ? verification.mismatched : [];
  if (missing.length === 0 && mismatched.length === 0) {
    return verification;
  }
  throw createFormServiceError('field binding verification failed', 'FORM_FIELD_BINDING_VERIFICATION_FAILED', Object.assign({
    missing,
    mismatched,
  }, details));
}

function normalizeTitlePayload(input) {
  if (input.titleI18n && typeof input.titleI18n === 'object') {
    return JSON.stringify(input.titleI18n);
  }
  const definition = input.definition && typeof input.definition === 'object' ? input.definition : {};
  const title = input.formTitle || input.title || definition.title || '';
  return JSON.stringify(i18n(title));
}

async function createBlankForm(context, input) {
  const authRef = resolveAuthRef(context);
  const services = context && context.services || {};
  const request = services.httpPost || httpPost;
  const requestWithAutoLoginImpl = services.requestWithAutoLogin || requestWithAutoLogin;
  const appType = input && input.appType;
  const send = auth => postFormDesign(auth, appType, 'saveFormSchemaInfo', {
    formType: input && input.formType || 'receipt',
    title: normalizeTitlePayload(input || {}),
  }, undefined, request);
  const result = hasRemoteDispatchBoundary(context)
    ? await dispatchRemotePrimitive(context, () => send(requireSchemaWriteAuth(authRef, { appType })))
    : await requestWithAutoLoginImpl(send, authRef);
  assertSuccess(result, 'FORM_CREATE_BLANK_FAILED', { appType });
  const formUuid = result.content && result.content.formUuid || result.content;
  if (!formUuid) {
    throw createFormServiceError('missing formUuid in create blank form response', 'FORM_CREATE_BLANK_FAILED', {
      appType,
      result,
    });
  }
  return { formUuid, createResult: result };
}

async function saveFormSchema(context, input) {
  const authRef = resolveAuthRef(context);
  const appType = input && input.appType;
  const formUuid = input && input.formUuid;
  const schema = input && input.schema;
  const serverRevision = requireSchemaServerRevision(
    { gmtModified: input && input.serverRevision },
    () => createFormServiceError(
      'remote Schema revision is missing or invalid',
      'FORM_SAVE_SCHEMA_PRECHECK_FAILED',
      { appType, formUuid }
    )
  );
  const fixedFormulaRefs = input && input.normalizeFormulaRefs === false
    ? 0
    : normalizeFormulaFieldRefs(schema);
  requireSchemaWriteAuth(authRef, { appType, formUuid });
  const request = context && context.services && context.services.httpPost || httpPost;
  const result = await dispatchRemotePrimitive(context, () => postFormDesign(authRef, appType, 'saveFormSchema', {
    appType,
    formUuid,
    content: JSON.stringify(schema),
    schemaVersion: input && input.schemaVersion || 'V5',
    prefix: '_view',
    gmtModified: serverRevision,
  }, { prefix: '_view' }, request));
  if (isSaveFormSchemaRevisionConflict(result)) {
    throw createServerRevisionConflict('form');
  }
  assertSuccess(result, 'FORM_SAVE_SCHEMA_FAILED', { appType, formUuid });
  return { saveResult: result, fixedFormulaRefs };
}

function requireSchemaWriteAuth(authRef, details) {
  if (!authRef || typeof authRef.baseUrl !== 'string' || authRef.baseUrl.length === 0) {
    throw createFormServiceError(
      'Schema write authentication is not ready',
      'FORM_SAVE_SCHEMA_PRECHECK_FAILED',
      details
    );
  }
  if (isTokenAuthRef(authRef)) {
    return authRef;
  }
  if (
    typeof authRef.csrfToken !== 'string' ||
    authRef.csrfToken.length === 0 ||
    !Array.isArray(authRef.cookies)
  ) {
    throw createFormServiceError(
      'Schema write authentication is not ready',
      'FORM_SAVE_SCHEMA_PRECHECK_FAILED',
      details
    );
  }
  return authRef;
}

async function updateFormConfig(context, input) {
  const authRef = resolveAuthRef(context);
  const services = context && context.services || {};
  const request = services.httpPost || httpPost;
  const requestWithAutoLoginImpl = services.requestWithAutoLogin || requestWithAutoLogin;
  const appType = input && input.appType;
  const formUuid = input && input.formUuid;
  const version = input && input.version !== undefined ? input.version : 1;
  const value = input && input.value !== undefined ? input.value : 0;
  const send = function (auth) {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      formUuid,
      version,
      configType: 'MINI_RESOURCE',
      value,
    });
    return request(
      auth.baseUrl,
      buildFormDesignApiPath(appType, 'updateFormConfig'),
      postData,
      auth.cookies
    );
  };
  const result = hasRemoteDispatchBoundary(context)
    ? await dispatchRemotePrimitive(context, () => send(requireSchemaWriteAuth(authRef, { appType, formUuid })))
    : await requestWithAutoLoginImpl(send, authRef);
  let configResult = result;
  if (input && input.strict) {
    configResult = assertConfigSuccess(result, { appType, formUuid });
  }
  return { configResult };
}

async function saveFormSchemaAndConfig(context, input) {
  const saveResult = await saveFormSchema(context, input);
  const configResult = await updateFormConfig(context, Object.assign({}, input, { strict: true }));
  return Object.assign({}, saveResult, configResult);
}

async function createFormResource(context, input) {
  const blank = await callWithDispatchBoundary(context, () => createBlankForm(context, input));
  const compiled = compileFormDefinition(input.definition || input, Object.assign({}, input, {
    formUuid: blank.formUuid,
  }));
  if (typeof context.checkpointCreateIdentity === 'function') {
    await context.checkpointCreateIdentity({
      appType: input.appType,
      formUuid: blank.formUuid,
      fieldBindings: compiled.fieldBindings,
      fieldBindingComponents: compiled.fieldBindingComponents,
    });
  }
  return resumeFormResource(context, Object.assign({}, input, {
    compiled,
    createResult: blank.createResult,
    formUuid: blank.formUuid,
  }));
}

async function resumeFormResource(context, input) {
  const currentSchemaResult = input.currentSchemaResult || await callWithDispatchBoundary(
    context,
    () => readFormSchema(context, {
      appType: input.appType,
      formUuid: input.formUuid,
    })
  );
  const compiled = input.compiled || compileFormDefinition(input.definition || input, Object.assign({}, input, {
    formUuid: input.formUuid,
  }));
  const saveResult = await callWithDispatchBoundary(
    context,
    () => saveFormSchema(context, Object.assign({}, input, {
      schema: compiled.schema,
      serverRevision: requireSchemaServerRevision(currentSchemaResult),
    }))
  );
  const configResult = await callWithDispatchBoundary(
    context,
    () => updateFormConfig(context, Object.assign({}, input, { strict: true }))
  );
  const schemaResult = await callWithDispatchBoundary(context, () => readFormSchema(context, {
    appType: input.appType,
    formUuid: input.formUuid,
  }));
  const verification = verifyFieldBindings(schemaResult, compiled.fieldBindings, {
    expectedComponentTypes: compiled.fieldBindingComponents,
  });
  assertFieldBindingVerification(verification, {
    appType: input.appType,
    formUuid: input.formUuid,
  });

  return {
    appType: input.appType,
    formUuid: input.formUuid,
    schema: compiled.schema,
    fieldBindings: compiled.fieldBindings,
    fieldBindingComponents: compiled.fieldBindingComponents,
    verification,
    createResult: input.createResult,
    saveResult: saveResult.saveResult,
    configResult: configResult.configResult,
    schemaResult,
  };
}

function prepareFormResourceUpdate(input) {
  const compiled = compileFormDefinition(input.definition || input, Object.assign({}, input, {
    appType: input.appType,
    existingBindings: input.existingBindings,
    formUuid: input.formUuid,
  }));
  const schema = patchManagedFormSchema(input.currentSchemaResult, compiled, {
    existingBindings: input.existingBindings,
  });
  return { compiled, schema };
}

async function updateFormResource(context, input) {
  const prepared = input.prepared || prepareFormResourceUpdate(input);
  const saveResult = await callWithDispatchBoundary(context, () => saveFormSchema(context, Object.assign({}, input, {
    schema: prepared.schema,
    serverRevision: input.serverRevision,
  })));
  const configResult = await callWithDispatchBoundary(
    context,
    () => updateFormConfig(context, Object.assign({}, input, { strict: true }))
  );
  const schemaResult = await callWithDispatchBoundary(context, () => readFormSchema(context, {
    appType: input.appType,
    formUuid: input.formUuid,
  }));
  const verification = verifyFieldBindings(schemaResult, prepared.compiled.fieldBindings, {
    expectedComponentTypes: prepared.compiled.fieldBindingComponents,
  });
  assertFieldBindingVerification(verification, {
    appType: input.appType,
    formUuid: input.formUuid,
  });

  return {
    appType: input.appType,
    formUuid: input.formUuid,
    schema: prepared.schema,
    fieldBindings: prepared.compiled.fieldBindings,
    fieldBindingComponents: prepared.compiled.fieldBindingComponents,
    verification,
    saveResult: saveResult.saveResult,
    configResult: configResult.configResult,
    schemaResult,
  };
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

module.exports = {
  buildFormDesignApiPath,
  createBlankForm,
  saveFormSchema,
  updateFormConfig,
  saveFormSchemaAndConfig,
  createFormResource,
  resumeFormResource,
  prepareFormResourceUpdate,
  updateFormResource,
};
