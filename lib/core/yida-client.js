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

function isUsableAuthData(authData) {
  if (!authData) {
    return false;
  }
  if (authData.auth_mode === 'token' || authData.authMode === 'token') {
    return true;
  }
  return !!authData.csrf_token;
}

function createAuthRef(authData) {
  const cachedAuthData = authData || loadAuthData();
  const loadedAuthData = isUsableAuthData(cachedAuthData)
    ? cachedAuthData
    : triggerLogin();
  const safeAuthData = loadedAuthData || {};

  return {
    csrfToken: safeAuthData.csrf_token || '',
    baseUrl: resolveBaseUrl(safeAuthData),
    authData: safeAuthData,
    authMode: safeAuthData.auth_mode || safeAuthData.authMode || '',
    authSource: safeAuthData.auth_source || safeAuthData.authSource || '',
    corpId: safeAuthData.corp_id || '',
    userId: safeAuthData.user_id || '',
  };
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
  if (!authRef || !authRef.csrfToken) {
    return false;
  }
  if (isTokenAuthRef(authRef)) {
    return true;
  }
  return false;
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
        const requestOptions = Object.assign({ csrfToken: ref.csrfToken }, resolvedOptions || {});
        return httpPostJson(
          ref.baseUrl,
          resolvedRequestPath,
          resolvedBodyParams || {},
          requestOptions
        );
      },
      this.authRef
    );
  }
}

function createYidaClient(options = {}) {
  return new YidaClient(options);
}

module.exports = {
  YidaClient,
  createAuthRef,
  createYidaClient,
  isAuthRefReady,
  isTokenAuthRef,
};
