'use strict';

const { createAuthRef, createYidaClient } = require('../../core/yida-client');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
} = require('../../schema/remote-dispatch-boundary');

const API_PATH = '/query/app/getAppList.json';
const DEFAULT_PAGE_SIZE = 20;

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
  const pageSize = input.pageSize || DEFAULT_PAGE_SIZE;
  const apps = await fetchAllApps(authRef, pageSize, context);
  const app = apps.find(item => item && item.appType === appType);
  if (!app) {
    throw createAppReaderError('app not found', 'APP_READ_NOT_FOUND', { appType });
  }

  return {
    appType: app.appType,
    appName: app.appName || app.name || '',
    systemLink: app.systemLink || '',
  };
}

async function fetchAllApps(authRef, pageSize, context) {
  const firstResult = await fetchAppListPage(authRef, 1, pageSize, context);
  assertAppListSuccess(firstResult);

  const content = firstResult.content || {};
  const allApps = Array.isArray(content.data) ? content.data.slice() : [];
  const totalCount = Number(content.totalCount || allApps.length || 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  for (let pageIndex = 2; pageIndex <= totalPages; pageIndex++) {
    const result = await fetchAppListPage(authRef, pageIndex, pageSize, context);
    assertAppListSuccess(result);
    if (result.content && Array.isArray(result.content.data)) {
      allApps.push(...result.content.data);
    }
  }

  return allApps;
}

function fetchAppListPage(authRef, pageIndex, pageSize, context) {
  const client = createYidaClient({ authRef });
  const method = hasRemoteDispatchBoundary(context) ? 'getOnce' : 'get';
  return dispatchRemotePrimitive(context, () => client[method](API_PATH, (ref) => ({
    _api: 'nattyFetch',
    _mock: 'false',
    pageIndex,
    pageSize,
    creator: ref.userId,
    _csrf_token: ref.csrfToken,
    _stamp: Date.now(),
  })));
}

function assertAppListSuccess(result) {
  if (result && result.success && result.content) {
    return;
  }
  if (result && (result.__needLogin || result.__csrfExpired)) {
    throw createAppReaderError('login required', 'APP_READ_AUTH_REQUIRED');
  }
  throw createAppReaderError(result && result.errorMsg || 'app list request failed', 'APP_READ_FAILED');
}

module.exports = {
  readApp,
};
