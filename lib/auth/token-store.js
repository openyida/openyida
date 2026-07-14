'use strict';

const fs = require('fs');
const path = require('path');

const TOKEN_FILE_PREFIX = 'auth-token';

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

function normalizeBaseUrl(value) {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(String(value)).origin.replace(/\/+$/, '');
  } catch {
    return undefined;
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

function loadTokenSession(options = {}) {
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
  loadTokenSession,
  saveTokenSession,
  clearTokenSession,
  normalizeTokenSession,
  isAccessTokenUsable,
  maskToken,
  resolveEnvName,
};
