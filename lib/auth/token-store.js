'use strict';

const fs = require('fs');
const path = require('path');

const TOKEN_FILE_PREFIX = 'auth-token';
const BUSINESS_CONTEXT_FILE_PREFIX = 'auth-token-business-context';
const BUSINESS_CONTEXT_VERSION = 1;

function sanitizeEnvName(envName) {
  return String(envName || 'public').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveProjectRoot(options = {}) {
  if (options.projectRoot) {
    return options.projectRoot;
  }
  const { findProjectRoot } = require('../core/utils');
  return findProjectRoot();
}

function resolveEnvName(options = {}) {
  if (options.envName) {
    return sanitizeEnvName(options.envName);
  }
  try {
    const { getCurrentEnvConfig, resolveEnvNameAlias } = require('../core/env-manager');
    const { name } = getCurrentEnvConfig(resolveProjectRoot(options));
    return sanitizeEnvName(resolveEnvNameAlias(name || process.env.OPENYIDA_ENV || 'public'));
  } catch {
    return sanitizeEnvName(process.env.OPENYIDA_ENV || 'public');
  }
}

function getTokenFilePath(options = {}) {
  const root = resolveProjectRoot(options);
  const envName = resolveEnvName(options);
  return path.join(root, '.cache', `${TOKEN_FILE_PREFIX}-${envName}.json`);
}

function getBusinessContextFilePath(options = {}) {
  const root = resolveProjectRoot(options);
  const envName = resolveEnvName(options);
  return path.join(
    root,
    '.cache',
    'openyida',
    `${BUSINESS_CONTEXT_FILE_PREFIX}-${envName}.json`
  );
}

function normalizeBaseUrl(value) {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(String(value));
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      return undefined;
    }
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

function normalizeBusinessContext(value = {}) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const corpId = String(value.corp_id || value.corpId || '').trim();
  const baseUrl = normalizeBaseUrl(value.base_url || value.baseUrl);
  if (!corpId || !baseUrl) {
    return null;
  }
  return {
    version: BUSINESS_CONTEXT_VERSION,
    corp_id: corpId,
    base_url: baseUrl,
    updated_at: value.updated_at || value.updatedAt || new Date().toISOString(),
  };
}

function saveBusinessContext(value, options = {}) {
  const normalized = normalizeBusinessContext(value);
  if (!normalized) {
    return null;
  }

  const contextFile = getBusinessContextFilePath(options);
  const tempFile = `${contextFile}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  fs.mkdirSync(path.dirname(contextFile), { recursive: true });
  try {
    fs.writeFileSync(tempFile, JSON.stringify(normalized, null, 2), { mode: 0o600 });
    fs.renameSync(tempFile, contextFile);
    try {
      fs.chmodSync(contextFile, 0o600);
    } catch {
      // chmod is best-effort on non-POSIX filesystems.
    }
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Cleanup is best-effort.
    }
  }
  return normalized;
}

function loadBusinessContext(options = {}) {
  const contextFile = getBusinessContextFilePath(options);
  if (!fs.existsSync(contextFile)) {
    return null;
  }
  try {
    return normalizeBusinessContext(JSON.parse(fs.readFileSync(contextFile, 'utf8')));
  } catch {
    return null;
  }
}

function normalizeExpiresAt(session) {
  if (!session) {
    return undefined;
  }
  if (session.expires_at) {
    const value = typeof session.expires_at === 'number'
      ? session.expires_at
      : Date.parse(session.expires_at);
    return Number.isFinite(value) ? value : undefined;
  }
  if (session.expiresAt) {
    const value = typeof session.expiresAt === 'number'
      ? session.expiresAt
      : Date.parse(session.expiresAt);
    return Number.isFinite(value) ? value : undefined;
  }
  if (session.expires_in || session.expiresIn) {
    const seconds = Number(session.expires_in || session.expiresIn);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Date.now() + seconds * 1000;
    }
  }
  return undefined;
}

function normalizeTokenSession(session = {}) {
  const expiresAt = normalizeExpiresAt(session);
  const baseUrl = normalizeBaseUrl(
    session.base_url ||
    session.baseUrl ||
    session.token_endpoint ||
    session.tokenEndpoint
  );
  const normalized = {
    auth_mode: 'token',
    token_type: session.token_type || session.tokenType || 'Bearer',
    access_token: session.access_token || session.accessToken,
    refresh_token: session.refresh_token || session.refreshToken,
    expires_at: expiresAt,
    issued_at: session.issued_at || session.issuedAt || new Date().toISOString(),
    base_url: baseUrl,
    client_id: session.client_id || session.clientId,
    corp_id: session.corp_id || session.corpId,
    user_id: session.user_id || session.userId,
    user_name: session.user_name || session.userName,
    open_user_id: session.open_user_id || session.openUserId,
    scope: session.scope,
    auth_source: session.auth_source || session.authSource,
    raw: session.raw,
  };

  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === undefined || normalized[key] === null || normalized[key] === '') {
      delete normalized[key];
    }
  });
  return normalized;
}

function saveTokenSession(session, options = {}) {
  const tokenFile = getTokenFilePath(options);
  const normalized = normalizeTokenSession(session);
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  fs.writeFileSync(tokenFile, JSON.stringify(normalized, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(tokenFile, 0o600);
  } catch {
    // chmod is best-effort on non-POSIX filesystems.
  }
  return normalized;
}

function isHostInjectedTokenMode(env = process.env) {
  const authEnabled = String(env.YIDA_AUTH_ENABLED || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(authEnabled);
}

function loadEnvTokenSession(env = process.env) {
  const accessToken = String(env.OPENYIDA_ACCESS_TOKEN || '').trim();
  const refreshToken = String(env.OPENYIDA_REFRESH_TOKEN || '').trim();
  if (!accessToken && !refreshToken) {
    return null;
  }
  return normalizeTokenSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    base_url: env.OPENYIDA_ENDPOINT,
    client_id: env.OPENYIDA_TOKEN_CLIENT_ID,
    corp_id: env.OPENYIDA_TOKEN_CORP_ID,
    user_id: env.OPENYIDA_TOKEN_USER_ID,
    token_type: env.OPENYIDA_TOKEN_TYPE,
    expires_at: env.OPENYIDA_ACCESS_TOKEN_EXPIRES_AT,
    expires_in: env.OPENYIDA_ACCESS_TOKEN_EXPIRES_IN,
    auth_source: 'env',
  });
}

function loadLocalTokenSession(options = {}) {
  const tokenFile = getTokenFilePath(options);
  if (!fs.existsSync(tokenFile)) {
    return null;
  }
  try {
    return normalizeTokenSession(JSON.parse(fs.readFileSync(tokenFile, 'utf8')));
  } catch {
    return null;
  }
}

function loadTokenSession(options = {}) {
  const env = options.env || process.env;
  const envSession = loadEnvTokenSession(env);
  if (isHostInjectedTokenMode(env)) {
    if (!envSession || !envSession.corp_id) {
      return envSession;
    }
    const businessContext = loadBusinessContext(options);
    if (!businessContext || businessContext.corp_id !== envSession.corp_id) {
      return envSession;
    }
    return normalizeTokenSession({
      ...envSession,
      base_url: businessContext.base_url,
    });
  }

  const localSession = loadLocalTokenSession(options);
  if (!localSession && !envSession) {
    return null;
  }

  const localAccessToken = localSession && localSession.access_token;
  const localRefreshToken = localSession && localSession.refresh_token;
  const envAccessToken = envSession && envSession.access_token;
  const envRefreshToken = envSession && envSession.refresh_token;
  const usesLocal = Boolean(localAccessToken || localRefreshToken);
  const usesEnv = Boolean(
    (!localAccessToken && !localRefreshToken && envAccessToken) ||
    (!localRefreshToken && envRefreshToken)
  );

  return normalizeTokenSession({
    ...(envSession || {}),
    ...(localSession || {}),
    access_token: localAccessToken || (!localSession && envAccessToken),
    refresh_token: localRefreshToken || envRefreshToken,
    auth_source: usesLocal && usesEnv ? 'mixed' : (usesLocal ? 'local' : 'env'),
  });
}

function clearTokenSession(options = {}) {
  const tokenFile = getTokenFilePath(options);
  try {
    if (fs.existsSync(tokenFile)) {
      fs.unlinkSync(tokenFile);
    }
  } catch {
    // Logout should remain idempotent.
  }
}

function isAccessTokenUsable(session, skewMs = 60 * 1000) {
  if (!session || !session.access_token) {
    return false;
  }
  if (!session.expires_at) {
    return true;
  }
  return Number(session.expires_at) > Date.now() + skewMs;
}

function maskToken(token) {
  if (!token) {
    return undefined;
  }
  const value = String(token);
  if (value.length <= 16) {
    return `${value.slice(0, 4)}...`;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

module.exports = {
  getTokenFilePath,
  getBusinessContextFilePath,
  loadTokenSession,
  saveTokenSession,
  loadBusinessContext,
  saveBusinessContext,
  clearTokenSession,
  normalizeTokenSession,
  loadEnvTokenSession,
  loadLocalTokenSession,
  isHostInjectedTokenMode,
  isAccessTokenUsable,
  maskToken,
  resolveEnvName,
};
