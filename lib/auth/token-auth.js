'use strict';

const http = require('http');
const https = require('https');

const {
  DINGTALK_OAUTH_CLIENT_ID,
  DINGTALK_LOGIN_ORIGIN,
  DINGTALK_INTL_LOGIN_ORIGIN,
  getCurrentEnvConfig,
  normalizeBaseUrl,
} = require('../core/env-manager');
const { runDingtalkLoopback } = require('./oauth-loopback');
const {
  clearTokenSession,
  isAccessTokenUsable,
  loadTokenSession,
  maskToken,
  saveTokenSession,
} = require('./token-store');

const DEFAULT_AUTH_PATH_PREFIX = '/openapi/cli/v1/auth';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function appendPath(baseUrl, path) {
  return `${stripTrailingSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

function getArgEndpoint(options = {}) {
  return options.endpoint ||
    null;
}

function resolveTokenBaseUrl(options = {}) {
  const explicitEndpoint = getArgEndpoint(options);
  if (explicitEndpoint) {
    const baseUrl = normalizeBaseUrl(explicitEndpoint, null);
    if (!baseUrl) {
      throw new Error('invalid base_url: pass a valid --endpoint value');
    }
    return baseUrl;
  }

  const { config } = getCurrentEnvConfig(options.projectRoot);
  const baseUrl = normalizeBaseUrl(process.env.OPENYIDA_ENDPOINT || config.baseUrl, null);
  if (!baseUrl) {
    throw new Error('missing base_url: pass --endpoint or set OPENYIDA_ENDPOINT');
  }
  return baseUrl;
}

function resolveDingtalkLoginOrigin(options = {}) {
  if (options.loginOrigin) {
    return options.loginOrigin;
  }
  try {
    const { config } = getCurrentEnvConfig(options.projectRoot);
    const baseUrl = normalizeBaseUrl(config.baseUrl, '');
    if (baseUrl && baseUrl.includes('yidaapps.com')) {
      return DINGTALK_INTL_LOGIN_ORIGIN;
    }
  } catch {
    // Fall back to domestic DingTalk login.
  }
  return DINGTALK_LOGIN_ORIGIN;
}

function requestJson(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const data = body === undefined || body === null ? null : Buffer.from(JSON.stringify(body));
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const request = transport.request({
      method,
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers: {
        accept: 'application/json',
        ...headers,
        ...(data ? {
          'content-type': 'application/json',
          'content-length': data.length,
        } : {}),
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let payload = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { raw: text };
          }
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const location = response.headers && response.headers.location;
          const message = payload && payload.message
            ? payload.message
            : `http_${response.statusCode}${location ? `: ${location}` : ''}`;
          const error = new Error(message);
          error.statusCode = response.statusCode;
          error.payload = payload;
          error.headers = response.headers;
          error.location = location;
          reject(error);
          return;
        }
        resolve(payload || {});
      });
    });

    request.on('error', reject);
    if (data) {
      request.write(data);
    }
    request.end();
  });
}

function sanitizeRawTokenResponse(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }
  const clone = Array.isArray(response) ? [...response] : { ...response };
  delete clone.ai_app_user_auth_token;
  delete clone.aiAppUserAuthToken;
  delete clone.tianshu_csrf_token;
  delete clone.tianshuCsrfToken;
  delete clone.csrf_token;
  delete clone.csrfToken;
  delete clone.access_token;
  delete clone.accessToken;
  delete clone.refresh_token;
  delete clone.refreshToken;
  if (clone.data && typeof clone.data === 'object') {
    clone.data = sanitizeRawTokenResponse(clone.data);
  }
  if (clone.content && typeof clone.content === 'object') {
    clone.content = sanitizeRawTokenResponse(clone.content);
  }
  return clone;
}

function getTokenPayload(response) {
  if (!response || typeof response !== 'object') {
    return response || {};
  }
  return response.data || response.content || response;
}

function normalizeTokenResponse(response, baseUrl, clientId) {
  const data = getTokenPayload(response);
  return {
    auth_mode: 'token',
    status: data.status || 'ok',
    can_auto_use: true,
    message: data.message || data.errorMsg || response.errorMsg,
    token_type: data.token_type || data.tokenType || 'Bearer',
    access_token: data.access_token || data.accessToken,
    refresh_token: data.refresh_token || data.refreshToken,
    expires_in: data.expires_in || data.expiresIn,
    expires_at: data.expires_at || data.expiresAt,
    base_url: baseUrl,
    client_id: data.client_id || data.clientId || clientId,
    corp_id: data.corp_id || data.corpId,
    user_id: data.user_id || data.userId,
    user_name: data.user_name || data.userName,
    open_user_id: data.open_user_id || data.openUserId,
    scope: data.scope,
    raw: sanitizeRawTokenResponse(response),
  };
}

function requireOkResponse(response) {
  const data = getTokenPayload(response);
  const status = data.status || data.code || response.status || response.code;
  if (typeof status === 'string' && status.startsWith('need_')) {
    return;
  }
  if (status && status !== 'ok' && status !== 'success' && status !== true && status !== 200) {
    const error = new Error(data.message || data.error || response.message || response.error || String(status));
    error.payload = response;
    throw error;
  }
  if (response && response.success === false) {
    const error = new Error(response.errorMsg || response.message || 'request_failed');
    error.payload = response;
    throw error;
  }
}

async function tokenLogin(options = {}) {
  const baseUrl = resolveTokenBaseUrl(options);
  const authBaseUrl = appendPath(baseUrl, DEFAULT_AUTH_PATH_PREFIX);
  const clientId = options.clientId || process.env.OPENYIDA_DINGTALK_CLIENT_ID || DINGTALK_OAUTH_CLIENT_ID;
  const callback = await runDingtalkLoopback({
    clientId,
    loginOrigin: resolveDingtalkLoginOrigin(options),
    scope: options.scope || process.env.OPENYIDA_DINGTALK_SCOPE || 'openid corpid',
    prompt: options.prompt,
    port: options.port,
    quiet: options.quiet,
    timeoutMs: options.timeoutMs,
  });

  const response = await requestJson('POST', appendPath(authBaseUrl, '/dingtalk/token'), {
    code: callback.code,
    authCode: callback.authCode,
    redirectUri: callback.redirectUri,
    state: callback.state,
    clientId,
  });
  requireOkResponse(response);

  const normalized = normalizeTokenResponse(response, baseUrl, clientId);
  if (!normalized.access_token) {
    return {
      ...normalized,
      ok: false,
      status: 'token_not_issued',
      can_auto_use: false,
      message: 'auth service did not return access_token',
    };
  }
  return saveTokenSession(normalized, options);
}

function tokenStatus(options = {}) {
  const session = loadTokenSession(options);
  if (!session || !session.access_token) {
    return {
      ok: false,
      auth_mode: 'token',
      status: 'not_logged_in',
      can_auto_use: false,
      token_file: require('./token-store').getTokenFilePath(options),
    };
  }
  const usable = isAccessTokenUsable(session);
  return {
    ok: usable,
    auth_mode: 'token',
    status: usable ? 'ok' : 'expired',
    can_auto_use: usable,
    token_type: session.token_type,
    access_token: maskToken(session.access_token),
    refresh_token: maskToken(session.refresh_token),
    expires_at: session.expires_at ? new Date(session.expires_at).toISOString() : undefined,
    base_url: session.base_url,
    corp_id: session.corp_id,
    user_id: session.user_id,
    user_name: session.user_name,
  };
}

async function tokenRefresh(options = {}) {
  const session = loadTokenSession(options);
  if (!session || !session.refresh_token) {
    return {
      ok: false,
      auth_mode: 'token',
      status: 'missing_refresh_token',
      can_auto_use: false,
    };
  }

  const baseUrl = normalizeBaseUrl(options.endpoint || options.baseUrl || session.base_url, null) ||
    resolveTokenBaseUrl(options);
  const authBaseUrl = appendPath(baseUrl, DEFAULT_AUTH_PATH_PREFIX);
  const clientId = options.clientId || session.client_id || DINGTALK_OAUTH_CLIENT_ID;
  const response = await requestJson('POST', appendPath(authBaseUrl, '/refresh'), {
    refreshToken: session.refresh_token,
    clientId,
  });
  requireOkResponse(response);
  const data = getTokenPayload(response);
  const normalized = normalizeTokenResponse({
    ...data,
    corp_id: data.corp_id || data.corpId || session.corp_id,
    user_id: data.user_id || data.userId || session.user_id,
    user_name: data.user_name || data.userName || session.user_name,
    refresh_token: data.refresh_token || data.refreshToken || session.refresh_token,
  }, baseUrl, clientId);
  if (!normalized.access_token) {
    return {
      ...normalized,
      ok: false,
      status: 'token_not_issued',
      can_auto_use: false,
      message: normalized.message || 'auth service did not return access_token',
    };
  }
  return saveTokenSession(normalized, options);
}

async function tokenLogout(options = {}) {
  const session = loadTokenSession(options);
  if (session && session.refresh_token && session.base_url) {
    try {
      await requestJson('POST', appendPath(appendPath(session.base_url, DEFAULT_AUTH_PATH_PREFIX), '/logout'), {
        refreshToken: session.refresh_token,
      }, session.access_token ? {
        authorization: `${session.token_type || 'Bearer'} ${session.access_token}`,
      } : {});
    } catch {
      // Local logout should still clear the credential cache.
    }
  }
  clearTokenSession(options);
  return {
    ok: true,
    auth_mode: 'token',
    status: 'logged_out',
    can_auto_use: false,
  };
}

async function getAccessToken(options = {}) {
  let session = loadTokenSession(options);
  if (isAccessTokenUsable(session, options.skewMs)) {
    return session.access_token;
  }
  if (session && session.refresh_token) {
    session = await tokenRefresh(options);
    return session.access_token;
  }
  throw new Error('not_logged_in');
}

module.exports = {
  tokenLogin,
  tokenStatus,
  tokenRefresh,
  tokenLogout,
  getAccessToken,
  requestJson,
  resolveTokenBaseUrl,
};
