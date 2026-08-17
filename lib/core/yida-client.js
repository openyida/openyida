'use strict';

const querystring = require('querystring');
const {
  loadAuthData,
  triggerLogin,
  resolveBaseUrl,
  httpPost,
  httpPostJson,
  httpGet,
  requestWithAutoLogin,
} = require('./utils');

function buildCommonParams(auth, extra = {}) {
  return {
    _api: 'nattyFetch',
    _mock: 'false',
    _csrf_token: auth && auth.csrfToken,
    _locale_time_zone_offset: '28800000',
    _stamp: Date.now(),
    ...extra,
  };
}

function unwrapYidaResponse(response, options = {}) {
  const { action = 'request', loginMessage, failMessage } = options;
  if (response && (response.__needLogin || response.__csrfExpired)) {
    throw new Error(loginMessage || 'Login state is invalid. Please run openyida login again.');
  }
  if (!response || response.success === false) {
    const detail = response && (response.errorMsg || response.message);
    throw new Error(detail || failMessage || `${action} failed`);
  }
  // 部分宜搭接口成功时不返回 content 字段（也可能不返回 success），
  // 沿用项目中的兵底约定（content 缺失时回退为整个响应），避免静默返回 undefined。
  return response.content !== undefined ? response.content : response;
}

function isUsableAuthData(authData) {
  if (!authData) {
    return false;
  }
  return authData.auth_mode === 'token' ||
    authData.authMode === 'token' ||
    authData.auth_source === 'token' ||
    authData.authSource === 'token';
}

function createAuthRef(authData) {
  const cachedAuthData = authData || loadAuthData();
  const loadedAuthData = isUsableAuthData(cachedAuthData)
    ? cachedAuthData
    : triggerLogin();
  const safeAuthData = loadedAuthData || {};

  const authRef = {
    baseUrl: resolveBaseUrl(safeAuthData),
    authData: safeAuthData,
    authMode: safeAuthData.auth_mode || safeAuthData.authMode || '',
    authSource: safeAuthData.auth_source || safeAuthData.authSource || '',
    authStore: safeAuthData.auth_store || safeAuthData.authStore || '',
    authProfile: safeAuthData.auth_profile || safeAuthData.authProfile || '',
    persistenceScope: safeAuthData.persistence_scope || safeAuthData.persistenceScope || '',
    userAuthStoreWritable: safeAuthData.user_auth_store_writable,
    corpId: safeAuthData.corp_id || '',
    corpName: safeAuthData.corp_name || '',
    userId: safeAuthData.user_id || '',
  };
  return authRef;
}

function isTokenAuthRef(authRef) {
  const authData = authRef && (authRef.authData || {});
  const authMode = authRef && (
    authRef.authMode ||
    authRef.auth_mode ||
    authData.auth_mode ||
    authData.authMode
  );
  const authSource = authRef && (
    authRef.authSource ||
    authRef.auth_source ||
    authData.auth_source ||
    authData.authSource
  );
  return authMode === 'token' || authSource === 'token';
}

function isAuthRefReady(authRef) {
  if (!authRef) {
    return false;
  }
  return isTokenAuthRef(authRef) &&
    typeof authRef.baseUrl === 'string' &&
    authRef.baseUrl.length > 0;
}

class YidaClient {
  constructor(options = {}) {
    this.authRef = options.authRef || createAuthRef(options.authData);
  }

  getAuthRef() {
    return this.authRef;
  }

  async get(requestPath, queryParams, options) {
    return requestWithAutoLogin(
      (ref) => {
        const resolvedRequestPath = typeof requestPath === 'function'
          ? requestPath(ref)
          : requestPath;
        const resolvedQueryParams = typeof queryParams === 'function'
          ? queryParams(ref)
          : queryParams;
        if (options === undefined) {
          return httpGet(ref.baseUrl, resolvedRequestPath, resolvedQueryParams || null);
        }
        return httpGet(ref.baseUrl, resolvedRequestPath, resolvedQueryParams || null, options);
      },
      this.authRef
    );
  }

  async getOnce(requestPath, queryParams, options) {
    const ref = requireReadAuth(this.authRef);
    const resolvedRequestPath = typeof requestPath === 'function'
      ? requestPath(ref)
      : requestPath;
    const resolvedQueryParams = typeof queryParams === 'function'
      ? queryParams(ref)
      : queryParams;
    if (options === undefined) {
      return httpGet(ref.baseUrl, resolvedRequestPath, resolvedQueryParams || null);
    }
    return httpGet(ref.baseUrl, resolvedRequestPath, resolvedQueryParams || null, options);
  }

  async postForm(requestPath, bodyParams, options) {
    return requestWithAutoLogin(
      (ref) => {
        const resolvedRequestPath = typeof requestPath === 'function'
          ? requestPath(ref)
          : requestPath;
        const resolvedBodyParams = typeof bodyParams === 'function'
          ? bodyParams(ref)
          : bodyParams;
        const postData = typeof resolvedBodyParams === 'string'
          ? resolvedBodyParams
          : querystring.stringify(resolvedBodyParams || {});
        if (options === undefined) {
          return httpPost(ref.baseUrl, resolvedRequestPath, postData);
        }
        return httpPost(ref.baseUrl, resolvedRequestPath, postData, options);
      },
      this.authRef
    );
  }

  async postFormOnce(requestPath, bodyParams, options) {
    const ref = requireOneShotAuth(this.authRef);
    const resolvedRequestPath = typeof requestPath === 'function'
      ? requestPath(ref)
      : requestPath;
    const resolvedBodyParams = typeof bodyParams === 'function'
      ? bodyParams(ref)
      : bodyParams;
    const postData = typeof resolvedBodyParams === 'string'
      ? resolvedBodyParams
      : querystring.stringify(resolvedBodyParams || {});
    if (options === undefined) {
      return httpPost(ref.baseUrl, resolvedRequestPath, postData);
    }
    return httpPost(ref.baseUrl, resolvedRequestPath, postData, options);
  }

  async postJson(requestPath, bodyParams, options) {
    return requestWithAutoLogin(
      (ref) => {
        const resolvedRequestPath = typeof requestPath === 'function'
          ? requestPath(ref)
          : requestPath;
        const resolvedBodyParams = typeof bodyParams === 'function'
          ? bodyParams(ref)
          : bodyParams;
        const resolvedOptions = typeof options === 'function'
          ? options(ref)
          : options;
        return httpPostJson(
          ref.baseUrl,
          resolvedRequestPath,
          resolvedBodyParams || {},
          resolvedOptions || {}
        );
      },
      this.authRef
    );
  }

  async getContent(requestPath, params = {}, options = {}) {
    const response = await this.get(
      requestPath,
      auth => buildCommonParams(auth, typeof params === 'function' ? params(auth) : params)
    );
    return unwrapYidaResponse(response, options);
  }

  async postFormContent(requestPath, params = {}, options = {}) {
    const response = await this.postForm(
      requestPath,
      auth => buildCommonParams(auth, typeof params === 'function' ? params(auth) : params)
    );
    return unwrapYidaResponse(response, options);
  }
}

function requireOneShotAuth(authRef) {
  if (!authRef || typeof authRef.baseUrl !== 'string' || authRef.baseUrl.length === 0) {
    const error = new Error('Schema write authentication is not ready.');
    error.code = 'YIDA_WRITE_AUTH_NOT_READY';
    throw error;
  }
  if (isTokenAuthRef(authRef)) {
    return authRef;
  }
  const error = new Error('Schema write authentication is not ready.');
  error.code = 'YIDA_WRITE_AUTH_NOT_READY';
  throw error;
}

function requireReadAuth(authRef) {
  if (!authRef || typeof authRef.baseUrl !== 'string' || authRef.baseUrl.length === 0) {
    const error = new Error('Yida read authentication is not ready.');
    error.code = 'YIDA_READ_AUTH_NOT_READY';
    throw error;
  }
  if (isTokenAuthRef(authRef)) {
    return authRef;
  }
  const error = new Error('Yida read authentication is not ready.');
  error.code = 'YIDA_READ_AUTH_NOT_READY';
  throw error;
}

function createYidaClient(options = {}) {
  return new YidaClient(options);
}

module.exports = {
  YidaClient,
  buildCommonParams,
  createAuthRef,
  createYidaClient,
  isAuthRefReady,
  isTokenAuthRef,
  unwrapYidaResponse,
};
