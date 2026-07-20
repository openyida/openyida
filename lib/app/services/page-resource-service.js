'use strict';

const querystring = require('querystring');
const { schemaError } = require('../../schema/errors');
const { normalizeFormNavigationNode } = require('../form-navigation');
const { buildYidaI18n } = require('../../core/yida-i18n');
const { httpGet, httpPost } = require('../../core/utils');
const { isTokenAuthRef } = require('../../core/yida-client');
const {
  createServerRevisionConflict,
  isSaveFormSchemaRevisionConflict,
  requireSchemaServerRevision,
} = require('../../schema/server-revision');
const { dispatchRemotePrimitive } = require('../../schema/remote-dispatch-boundary');

function assertPageWriteReady(context = {}) {
  const auth = resolveAuth(context);
  if (!auth || typeof auth.baseUrl !== 'string' || !auth.baseUrl) {
    pageServiceError('SCHEMA_PAGE_WRITE_PRECHECK_FAILED', 'Page write authentication is not ready.');
  }
  if (isTokenAuthRef(auth)) {
    return true;
  }
  if (!auth.cookies || typeof auth.csrfToken !== 'string' || !auth.csrfToken) {
    pageServiceError('SCHEMA_PAGE_WRITE_PRECHECK_FAILED', 'Page write authentication is not ready.');
  }
  return true;
}

async function createPageShellOnce(context, input = {}) {
  const auth = requireWriteAuth(context);
  const request = resolveService(context, 'httpPost', httpPost);
  const result = await dispatchRemotePrimitive(context, () => request(
    auth.baseUrl,
    `/dingtalk/web/${input.appType}/query/formdesign/saveFormSchemaInfo.json`,
    querystring.stringify({
      _csrf_token: auth.csrfToken,
      formType: 'display',
      title: JSON.stringify(buildYidaI18n(input.title, {
        en_US: input.title,
        ja_JP: input.title,
      })),
    }),
    auth.cookies
  ));
  if (!result || result.success !== true || result.__needLogin || result.__csrfExpired) {
    pageServiceError('SCHEMA_PAGE_CREATE_FAILED', 'Page create request did not return a confirmed identity.');
  }
  const formUuid = result.content && result.content.formUuid || result.content;
  if (typeof formUuid !== 'string' || !formUuid) {
    pageServiceError('SCHEMA_PAGE_CREATE_FAILED', 'Page create request did not return a confirmed identity.');
  }
  return { appType: input.appType, formUuid };
}

async function readPageResource(context, input = {}) {
  const auth = requireReadAuth(context);
  const request = resolveService(context, 'httpGet', httpGet);
  const schemaResult = await dispatchRemotePrimitive(context, () => request(
    auth.baseUrl,
    `/alibaba/web/${input.appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid: input.formUuid, schemaVersion: 'V5' },
    auth.cookies
  ));
  if (
    !schemaResult ||
    schemaResult.success === false ||
    schemaResult.__needLogin ||
    schemaResult.__csrfExpired ||
    !hasSchemaContent(schemaResult.content)
  ) {
    pageServiceError('SCHEMA_PAGE_READ_FAILED', 'Bound page Schema could not be read.');
  }

  const navigationResult = await dispatchRemotePrimitive(context, () => request(
    auth.baseUrl,
    `/dingtalk/web/${input.appType}/query/formnav/getFormNavigationListByOrder.json`,
    { _api: 'Nav.queryList', _mock: false },
    auth.cookies
  ));
  if (
    !navigationResult ||
    navigationResult.success === false ||
    navigationResult.__needLogin ||
    navigationResult.__csrfExpired ||
    !Array.isArray(navigationResult.content)
  ) {
    pageServiceError('SCHEMA_PAGE_READ_FAILED', 'Bound page identity could not be read.');
  }
  const matches = navigationResult.content
    .map(normalizeFormNavigationNode)
    .filter(Boolean)
    .filter(item => item.formUuid === input.formUuid);
  if (matches.length !== 1) {
    pageServiceError('SCHEMA_PAGE_READ_FAILED', 'Bound page identity is missing or ambiguous.');
  }
  return {
    appType: input.appType,
    formUuid: input.formUuid,
    observedFormType: matches[0].formType,
    observedTitle: matches[0].formName,
    schema: schemaResult.content,
    serverRevision: requireSchemaServerRevision(schemaResult, () => pageReadError()),
  };
}

async function savePageSchemaOnce(context, input = {}) {
  const auth = requireWriteAuth(context);
  const request = resolveService(context, 'httpPost', httpPost);
  const result = await dispatchRemotePrimitive(context, () => request(
    auth.baseUrl,
    `/alibaba/web/${input.appType}/_view/query/formdesign/saveFormSchema.json`,
    querystring.stringify({
      _csrf_token: auth.csrfToken,
      appType: input.appType,
      content: JSON.stringify(input.schema),
      formUuid: input.formUuid,
      gmtModified: requireSchemaServerRevision(
        { gmtModified: input.serverRevision },
        () => pageServiceError('SCHEMA_PAGE_WRITE_PRECHECK_FAILED', 'Page Schema revision is missing or invalid.')
      ),
      prefix: '_view',
      schemaVersion: 'V5',
    }),
    auth.cookies
  ));
  if (isSaveFormSchemaRevisionConflict(result)) {
    throw createServerRevisionConflict('page');
  }
  if (!result || result.success !== true || result.__needLogin || result.__csrfExpired) {
    pageServiceError('SCHEMA_PAGE_SAVE_FAILED', 'Page Schema save did not return an explicit success response.');
  }
  return { success: true };
}

function pageReadError() {
  return schemaError('SCHEMA_PAGE_READ_FAILED', 'Bound page Schema revision is missing or invalid.', {
    details: { resourceType: 'page' },
  });
}

function requireReadAuth(context) {
  const auth = resolveAuth(context);
  if (!auth || typeof auth.baseUrl !== 'string' || !auth.baseUrl) {
    pageServiceError('SCHEMA_PAGE_READ_PRECHECK_FAILED', 'Page read authentication is not ready.');
  }
  if (isTokenAuthRef(auth)) {
    return auth;
  }
  if (!auth.cookies) {
    pageServiceError('SCHEMA_PAGE_READ_PRECHECK_FAILED', 'Page read authentication is not ready.');
  }
  return auth;
}

function requireWriteAuth(context) {
  assertPageWriteReady(context);
  return resolveAuth(context);
}

function resolveAuth(context) {
  return context && context.authRef ? context.authRef : context;
}

function resolveService(context, name, fallback) {
  return context && context.services && context.services[name] || fallback;
}

function hasSchemaContent(value) {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return !!(value && typeof value === 'object' && !Array.isArray(value));
}

function pageServiceError(code, message) {
  throw schemaError(code, message, { details: { resourceType: 'page' } });
}

module.exports = Object.freeze({
  assertPageWriteReady,
  createPageShellOnce,
  readPageResource,
  savePageSchemaOnce,
});
