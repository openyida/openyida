'use strict';

const { createYidaClient } = require('../../core/yida-client');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
} = require('../../core/remote-dispatch-boundary');

const MODE_READ_OPERATION = 'FormProcBinding.getBindingByFormUuid';
const MODE_CONVERSION_OPERATION = 'Nav.transformForm';

class FormModeServiceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'FormModeServiceError';
    this.code = code;
    this.details = details;
  }
}

function queryFormProcessBinding(authRef, appType, formUuid, options = {}) {
  const requestPath = '/' + appType + '/query/formProcBinding/getBindingByFormUuid.json';
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'getOnce' : 'get';
  return client[method](requestPath, auth => ({
    _api: 'nattyFetch',
    _mock: 'false',
    _csrf_token: auth.csrfToken,
    formUuid,
    _stamp: Date.now(),
  }));
}

function switchFormType(authRef, appType, formUuid, options = {}) {
  const requestPath = '/' + appType + '/query/formdesign/switchFormType.json'
    + '?_api=Nav.transformForm&_mock=false&_stamp=' + Date.now();
  const client = createYidaClient({ authRef });
  const method = options.oneShot === true ? 'postFormOnce' : 'postForm';
  return client[method](requestPath, auth => ({
    _csrf_token: auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    toFormType: 'process',
    formUuid,
  }));
}

async function readFormMode(context, input) {
  const authRef = context && context.authRef ? context.authRef : context;
  const appType = input && input.appType;
  const result = await dispatchRemotePrimitive(context, () => queryFormProcessBinding(
    authRef,
    appType,
    input && input.formUuid,
    { oneShot: hasRemoteDispatchBoundary(context) }
  ));
  const binding = normalizeFormProcessBinding(result, appType, input && input.formUuid);
  if (!binding) {
    throw modeError('FORM_MODE_READ_FAILED', MODE_READ_OPERATION, {
      result: sanitizeModeResult(result),
    });
  }
  if (binding.processCode) {
    const observed = {
      mode: 'process',
      processCode: binding.processCode,
    };
    if (binding.processId) {
      observed.processId = binding.processId;
    }
    return observed;
  }
  return { mode: 'receipt' };
}

async function convertFormToProcess(context, input) {
  const authRef = context && context.authRef ? context.authRef : context;
  const result = await dispatchRemotePrimitive(context, () => switchFormType(
    authRef,
    input && input.appType,
    input && input.formUuid,
    { oneShot: hasRemoteDispatchBoundary(context) }
  ));
  if (!result || result.success !== true) {
    throw modeError('FORM_MODE_CONVERSION_FAILED', MODE_CONVERSION_OPERATION);
  }
  return result;
}

async function getProcessCodeFromAppParam(authRef, appType, formUuid) {
  // Keep the legacy helper name for callers; the implementation now uses the exact form binding endpoint.
  return getProcessCodeFromFormBinding(authRef, appType, formUuid);
}

async function getProcessCodeFromFormBinding(authRef, appType, formUuid) {
  const result = await queryFormProcessBinding(authRef, appType, formUuid);
  const binding = normalizeFormProcessBinding(result, appType, formUuid);
  return binding && binding.processCode || null;
}

function normalizeFormProcessBinding(result, expectedAppType, expectedFormUuid) {
  const content = result && result.success === true && result.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return null;
  }
  if (
    isNonEmptyString(content.appType) &&
    content.appType !== expectedAppType
  ) {
    return null;
  }
  if (
    isNonEmptyString(content.formUuid) &&
    content.formUuid !== expectedFormUuid
  ) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(content, 'procCode')) {
    return { processCode: '' };
  }
  if (typeof content.procCode !== 'string') {
    return null;
  }
  const processId = normalizeIdentifier(content.procId);
  return {
    processCode: content.procCode.trim(),
    ...(processId ? { processId } : {}),
  };
}

function normalizeIdentifier(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return isNonEmptyString(value) ? value.trim() : null;
}

function modeError(code, operation, details = {}) {
  return new FormModeServiceError(code, 'Form mode operation failed.', {
    operation,
    ...details,
  });
}

function sanitizeModeResult(result) {
  if (!result || typeof result !== 'object') {
    return result || null;
  }
  const sanitized = {};
  [
    'success',
    'errorMsg',
    'errorCode',
    'code',
    'message',
    '__httpStatus',
    '__needLogin',
    '__csrfExpired',
    '__nonJsonResponse',
    '__emptyBody',
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      sanitized[key] = result[key];
    }
  });
  return sanitized;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

module.exports = {
  FormModeServiceError,
  MODE_CONVERSION_OPERATION,
  MODE_READ_OPERATION,
  convertFormToProcess,
  getProcessCodeFromAppParam,
  getProcessCodeFromFormBinding,
  queryFormProcessBinding,
  readFormMode,
  switchFormType,
};
