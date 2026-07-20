'use strict';

const { httpGet, requestWithAutoLogin } = require('../../core/utils');
const { requireSchemaServerRevision } = require('../../schema/server-revision');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
} = require('../../schema/remote-dispatch-boundary');

function resolveAuthRef(context) {
  return context && context.authRef ? context.authRef : context;
}

function createFormServiceError(message, code, details) {
  const error = new Error(message);
  error.code = code || 'FORM_SERVICE_FAILED';
  if (details) {
    error.details = details;
  }
  return error;
}

function assertSuccess(result, code, details) {
  if (result && result.success !== false && !result.__needLogin && !result.__csrfExpired) {
    return result;
  }
  const message = result ? result.errorMsg || 'request failed' : 'request failed';
  throw createFormServiceError(message, code, Object.assign({ result }, details));
}

async function readFormSchema(context, input) {
  const authRef = resolveAuthRef(context);
  const services = context && context.services || {};
  const requestWithAutoLoginImpl = services.requestWithAutoLogin || requestWithAutoLogin;
  const httpGetImpl = services.httpGet || httpGet;
  const appType = input && input.appType;
  const formUuid = input && input.formUuid;
  const send = auth => httpGetImpl(
    auth.baseUrl,
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid, schemaVersion: input && input.schemaVersion || 'V5' },
    auth.cookies
  );
  const result = hasRemoteDispatchBoundary(context)
    ? await dispatchRemotePrimitive(context, () => send(authRef))
    : await requestWithAutoLoginImpl(send, authRef);
  const schemaResult = assertSuccess(result, 'FORM_SCHEMA_READ_FAILED', { appType, formUuid });
  requireSchemaServerRevision(schemaResult, () => createFormServiceError(
    'remote Schema revision is missing or invalid',
    'FORM_SCHEMA_READ_FAILED',
    { appType, formUuid }
  ));
  return schemaResult;
}

module.exports = {
  readFormSchema,
  createFormServiceError,
};
