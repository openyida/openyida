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
  if (authData.auth_mode === 'token' || authData.authMode === 'token') {
    return true;
  }
  const cookies = Array.isArray(authData.cookies) ? authData.cookies : [];
  const csrfToken = authData.csrf_token || authData.csrfToken || authData._csrf_token;
  return cookies.length > 0 && typeof csrfToken === 'string' && csrfToken.length > 0;
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
    corpId: safeAuthData.corp_id || '',
    userId: safeAuthData.user_id || '',
  };
  if (Array.isArray(safeAuthData.cookies)) {
    authRef.cookieData = safeAuthData;
    authRef.cookies = safeAuthData.cookies;
    authRef.csrfToken = safeAuthData.csrf_token || safeAuthData.csrfToken || safeAuthData._csrf_token || '';
  }
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

function isCookieAuthRef(authRef) {
  if (!authRef) {
    return false;
  }
  const authData = authRef.authData || authRef.cookieData || {};
  const authMode = authRef.authMode || authRef.auth_mode || authData.auth_mode || authData.authMode;
  const authSource = authRef.authSource || authRef.auth_source || authData.auth_source || authData.authSource;
  return (
    authMode === 'env' ||
    authMode === 'cookie' ||
    authSource === 'env' ||
    authSource === 'cookie' ||
    Array.isArray(authRef.cookies)
  );
}

function isAuthRefReady(authRef) {
  if (!authRef) {
    return false;
  }
  if (isTokenAuthRef(authRef)) {
    return true;
  }
  return (
    isCookieAuthRef(authRef) &&
    typeof authRef.baseUrl === 'string' &&
    authRef.baseUrl.length > 0 &&
    typeof authRef.csrfToken === 'string' &&
    authRef.csrfToken.length > 0 &&
    Array.isArray(authRef.cookies)
  );
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
      return httpGet(ref.baseUrl, resolvedRequestPath, resolvedQueryParams || null, ref.cookies);
    }
    return httpGet(ref.baseUrl, resolvedRequestPath, resolvedQueryParams || null, ref.cookies, options);
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
      return httpPost(ref.baseUrl, resolvedRequestPath, postData, ref.cookies);
    }
    return httpPost(ref.baseUrl, resolvedRequestPath, postData, ref.cookies, options);
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
  if (
    typeof authRef.csrfToken !== 'string' ||
    authRef.csrfToken.length === 0 ||
    !Array.isArray(authRef.cookies)
  ) {
    const error = new Error('Schema write authentication is not ready.');
    error.code = 'YIDA_WRITE_AUTH_NOT_READY';
    throw error;
  }
  return authRef;
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
  if (!Array.isArray(authRef.cookies)) {
    const error = new Error('Yida read authentication is not ready.');
    error.code = 'YIDA_READ_AUTH_NOT_READY';
    throw error;
  }
  return authRef;
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
  isCookieAuthRef,
  isTokenAuthRef,
  unwrapYidaResponse,
};
