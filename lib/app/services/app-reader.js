'use strict';

const { createAuthRef, createYidaClient } = require('../../core/yida-client');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
} = require('../../schema/remote-dispatch-boundary');

function resolveAuthRef(context) {
  return context && context.authRef ? context.authRef : context;
}

function createAppReaderError(message, code, details) {
  const error = new Error(message);
  error.code = code || 'APP_READ_FAILED';
  if (details) {
    error.details = details;
  }
  return error;
}

async function readApp(context, input) {
  const appType = input && input.appType;
  if (!appType) {
    throw createAppReaderError('appType is required', 'APP_READ_INVALID_ARGUMENTS');
  }

  const authRef = resolveAuthRef(context) || createAuthRef();
  const result = await fetchAppDetail(authRef, appType, context);
  const app = normalizeAppDetail(result, appType);

  return {
    appType,
    appName: app.appName || app.name || '',
    systemLink: app.systemLink || '',
  };
}

function fetchAppDetail(authRef, appType, context) {
  const client = createYidaClient({ authRef });
  const method = hasRemoteDispatchBoundary(context) ? 'getOnce' : 'get';
  return dispatchRemotePrimitive(context, () => client[method](`/${appType}/query/app/getAppIncludingAecpInfo.json`, (ref) => ({
    _api: 'nattyFetch',
    _mock: 'false',
    appKey: appType,
    _csrf_token: ref.csrfToken,
    _stamp: Date.now(),
  })));
}

function normalizeAppDetail(result, appType) {
  if (result && result.success && result.content && typeof result.content === 'object') {
    return result.content;
  }
  if (result && (result.__needLogin || result.__csrfExpired)) {
    throw createAppReaderError('login required', 'APP_READ_AUTH_REQUIRED');
  }
  if (isAppDetailMissing(result)) {
    throw createAppReaderError('app not found', 'APP_READ_NOT_FOUND', { appType });
  }
  throw createAppReaderError(result && result.errorMsg || 'app detail request failed', 'APP_READ_FAILED', { appType });
}

function isAppDetailMissing(result) {
  if (!result) {
    return false;
  }
  const statusCode = Number(result.__httpStatus || result.statusCode || result.status || 0);
  const errorCode = String(result.errorCode || result.code || '').toUpperCase();
  const message = String(result.errorMsg || result.message || result.throwable || '').toLowerCase();
  return (
    statusCode === 404 ||
    errorCode === '404' ||
    errorCode.includes('NOT_FOUND') ||
    message.includes('not found') ||
    message.includes('不存在') ||
    message.includes('不存在该应用') ||
    message.includes('应用不存在')
  );
}

module.exports = {
  readApp,
  fetchAppDetail,
};
