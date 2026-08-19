'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TOKEN_FILE_PREFIX = 'auth-token';
const BUSINESS_CONTEXT_FILE_PREFIX = 'auth-token-business-context';
const AUTH_PROFILE_POINTER_FILE_PREFIX = 'auth-profile';
const BUSINESS_CONTEXT_VERSION = 1;
const AUTH_PROFILE_VERSION = 1;
const AUTH_PROFILE_KEY_FIELDS = ['base_url', 'client_id', 'corp_id', 'user_id'];

function sanitizeEnvName(envName) {
  return String(envName || 'public').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sanitizeProfileName(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function expandHome(value, homedir = os.homedir()) {
  const raw = String(value || '').trim();
  if (!raw) {
    return raw;
  }
  if (raw === '~') {
    return homedir;
  }
  if (raw.startsWith('~/') || raw.startsWith(`~${path.sep}`)) {
    return path.join(homedir, raw.slice(2));
  }
  return raw;
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

function getAuthProfilePointerFilePath(options = {}) {
  const root = resolveProjectRoot(options);
  const envName = resolveEnvName(options);
  return path.join(
    root,
    '.cache',
    'openyida',
    `${AUTH_PROFILE_POINTER_FILE_PREFIX}-${envName}.json`
  );
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

function firstNonEmptyString(...values) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function normalizeCorpName(value = {}) {
  if (!value || typeof value !== 'object') {
    return firstNonEmptyString(value);
  }
  return firstNonEmptyString(value.corp_name, value.corpName, value.name);
}

function resolveUserAuthDir(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const homedir = options.homedir || os.homedir();
  const explicit = options.authDir || env.OPENYIDA_AUTH_DIR;
  if (explicit) {
    return path.resolve(expandHome(explicit, homedir));
  }
  if (platform === 'win32') {
    const baseDir = env.APPDATA || env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Roaming');
    return path.join(baseDir, 'OpenYida', 'auth');
  }
  return path.join(homedir, '.openyida', 'auth');
}

function getUserProfilesDir(options = {}) {
  return path.join(resolveUserAuthDir(options), 'profiles');
}

function getUserProfileFilePath(authProfile, options = {}) {
  if (!authProfile) {
    return null;
  }
  return path.join(getUserProfilesDir(options), `${sanitizeProfileName(authProfile)}.json`);
}

function findNearestExistingParent(targetPath) {
  let current = path.resolve(targetPath);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
}

function isPathWritable(targetPath) {
  try {
    const stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
    if (stat && !stat.isDirectory()) {
      return false;
    }
    const probePath = stat ? targetPath : findNearestExistingParent(targetPath);
    fs.accessSync(probePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getUserAuthStoreWritable(options = {}) {
  return isPathWritable(resolveUserAuthDir(options));
}

function writeJsonFileAtomic(filePath, payload) {
  const tempFile = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), { mode: 0o600 });
    fs.renameSync(tempFile, filePath);
    try {
      fs.chmodSync(filePath, 0o600);
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
}

function normalizeBusinessContext(value = {}) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const corpId = String(value.corp_id || value.corpId || '').trim();
  const corpName = normalizeCorpName(value);
  const baseUrl = normalizeBaseUrl(value.base_url || value.baseUrl);
  if (!corpId || !baseUrl) {
    return null;
  }
  const normalized = {
    version: BUSINESS_CONTEXT_VERSION,
    corp_id: corpId,
    base_url: baseUrl,
    updated_at: value.updated_at || value.updatedAt || new Date().toISOString(),
  };
  if (corpName) {
    normalized.corp_name = corpName;
  }
  return normalized;
}

function saveBusinessContext(value, options = {}) {
  const normalized = normalizeBusinessContext(value);
  if (!normalized) {
    return null;
  }

  writeJsonFileAtomic(getBusinessContextFilePath(options), normalized);
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
    corp_name: normalizeCorpName(session),
    user_id: session.user_id || session.userId,
    user_name: session.user_name || session.userName,
    open_user_id: session.open_user_id || session.openUserId,
    scope: session.scope,
    last_used_at: session.last_used_at || session.lastUsedAt || session.updated_at || session.updatedAt,
    auth_source: session.auth_source || session.authSource,
    auth_store: session.auth_store || session.authStore,
    auth_profile: session.auth_profile || session.authProfile,
    persistence_scope: session.persistence_scope || session.persistenceScope,
    user_auth_store_writable: typeof session.user_auth_store_writable === 'boolean'
      ? session.user_auth_store_writable
      : session.userAuthStoreWritable,
    warning: session.warning,
    raw: session.raw,
  };

  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === undefined || normalized[key] === null || normalized[key] === '') {
      delete normalized[key];
    }
  });
  return normalized;
}

function buildAuthProfileIdentity(session = {}) {
  const normalized = normalizeTokenSession(session);
  const identity = {
    base_url: normalized.base_url,
    client_id: normalized.client_id,
    corp_id: normalized.corp_id,
    user_id: normalized.user_id,
  };
  if (AUTH_PROFILE_KEY_FIELDS.some((key) => !identity[key])) {
    return null;
  }
  return identity;
}

function buildAuthProfileKey(identity) {
  const payload = AUTH_PROFILE_KEY_FIELDS.reduce((result, key) => {
    result[key] = identity[key];
    return result;
  }, {});
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 32);
}

function attachAuthStoreMetadata(session, metadata = {}) {
  return normalizeTokenSession({
    ...session,
    ...metadata,
  });
}

function toAuthProfileCandidate(session = {}) {
  const normalized = normalizeTokenSession(session);
  const candidate = {
    auth_profile: normalized.auth_profile,
    corp_id: normalized.corp_id,
    corp_name: normalized.corp_name,
    user_id: normalized.user_id,
    user_name: normalized.user_name,
    base_url: normalized.base_url,
    client_id: normalized.client_id,
    auth_source: normalized.auth_source,
    auth_store: normalized.auth_store,
    persistence_scope: normalized.persistence_scope,
    last_used_at: normalized.last_used_at,
  };
  Object.keys(candidate).forEach((key) => {
    if (candidate[key] === undefined || candidate[key] === null || candidate[key] === '') {
      delete candidate[key];
    }
  });
  return candidate;
}

function buildAuthProfileNextStep(status) {
  if (status === 'profile_required') {
    return {
      next_step: 'Multiple auth profiles are available. Run openyida auth profiles, then run openyida auth profile switch <auth_profile> with the exact profile id. For one command, pass --profile <auth_profile>.',
      next_step_commands: [
        'openyida auth profiles',
        'openyida auth profile switch <auth_profile>',
      ],
    };
  }
  if (status === 'profile_not_found') {
    return {
      next_step: 'No matching auth profile was found. Run openyida auth profiles to inspect existing profiles, or run openyida login to add a new profile.',
      next_step_commands: [
        'openyida auth profiles',
        'openyida login',
      ],
    };
  }
  return {
    next_step: 'Run openyida login to add an auth profile.',
    next_step_commands: [
      'openyida login',
    ],
  };
}

function getAuthProfileSelector(options = {}) {
  const env = options.env || process.env;
  return {
    authProfile: sanitizeProfileName(
      options.authProfile ||
      options.profile ||
      env.OPENYIDA_AUTH_PROFILE ||
      ''
    ),
    corpId: String(options.corpId || env.OPENYIDA_AUTH_CORP_ID || '').trim(),
    userId: String(options.userId || env.OPENYIDA_AUTH_USER_ID || '').trim(),
  };
}

function sessionMatchesSelector(session, selector, options = {}) {
  if (!session) {
    return false;
  }
  const allowMissingIdentity = options.allowMissingIdentity === true;
  const expectedCorpId = selector && selector.corpId;
  const expectedUserId = selector && selector.userId;
  if (expectedCorpId) {
    if (!session.corp_id) {
      return allowMissingIdentity;
    }
    if (session.corp_id !== expectedCorpId) {
      return false;
    }
  }
  if (expectedUserId) {
    if (!session.user_id) {
      return allowMissingIdentity;
    }
    if (session.user_id !== expectedUserId) {
      return false;
    }
  }
  return true;
}

function saveAuthProfilePointer(session, options = {}) {
  const normalized = normalizeTokenSession(session);
  if (!normalized.auth_profile) {
    return null;
  }
  const pointer = {
    version: AUTH_PROFILE_VERSION,
    auth_profile: normalized.auth_profile,
    auth_store: 'user',
    base_url: normalized.base_url,
    client_id: normalized.client_id,
    corp_id: normalized.corp_id,
    corp_name: normalized.corp_name,
    user_id: normalized.user_id,
    user_name: normalized.user_name,
    open_user_id: normalized.open_user_id,
    updated_at: new Date().toISOString(),
  };
  Object.keys(pointer).forEach((key) => {
    if (pointer[key] === undefined || pointer[key] === null || pointer[key] === '') {
      delete pointer[key];
    }
  });
  writeJsonFileAtomic(getAuthProfilePointerFilePath(options), pointer);
  return pointer;
}

function loadAuthProfilePointer(options = {}) {
  const pointerFile = getAuthProfilePointerFilePath(options);
  if (!fs.existsSync(pointerFile)) {
    return null;
  }
  try {
    const pointer = JSON.parse(fs.readFileSync(pointerFile, 'utf8'));
    if (!pointer || typeof pointer !== 'object' || !pointer.auth_profile) {
      return null;
    }
    return pointer;
  } catch {
    return null;
  }
}

function clearAuthProfilePointer(options = {}) {
  try {
    const pointerFile = getAuthProfilePointerFilePath(options);
    if (fs.existsSync(pointerFile)) {
      fs.unlinkSync(pointerFile);
    }
  } catch {
    // Pointer cleanup should remain idempotent.
  }
}

function deleteUserAuthProfile(authProfile, options = {}) {
  const normalizedAuthProfile = sanitizeProfileName(authProfile);
  if (!normalizedAuthProfile) {
    return false;
  }

  let deleted = false;
  try {
    const profileFile = getUserProfileFilePath(normalizedAuthProfile, options);
    if (profileFile && fs.existsSync(profileFile)) {
      fs.unlinkSync(profileFile);
      deleted = true;
    }
  } catch {
    // Logout should remain idempotent.
  }

  const pointer = loadAuthProfilePointer(options);
  if (pointer && pointer.auth_profile === normalizedAuthProfile) {
    clearAuthProfilePointer(options);
  }
  return deleted;
}

function clearAllUserAuthProfiles(options = {}) {
  const profiles = listUserAuthProfiles(options);
  profiles.forEach((profile) => {
    deleteUserAuthProfile(profile.auth_profile, options);
  });
  clearAuthProfilePointer(options);
  return profiles;
}

function clearProjectLegacyTokenSession(options = {}) {
  const tokenFile = getTokenFilePath(options);
  try {
    if (fs.existsSync(tokenFile)) {
      fs.unlinkSync(tokenFile);
    }
  } catch {
    // Logout should remain idempotent.
  }
}

function saveProjectLegacyTokenSession(session, options = {}) {
  const tokenFile = getTokenFilePath(options);
  const normalized = normalizeTokenSession(session);
  writeJsonFileAtomic(tokenFile, normalized);
  return attachAuthStoreMetadata(normalized, {
    auth_source: 'project_legacy',
    auth_store: 'project_cache',
    persistence_scope: 'project',
    user_auth_store_writable: getUserAuthStoreWritable(options),
  });
}

function saveUserTokenSession(session, options = {}) {
  const normalized = normalizeTokenSession(session);
  const identity = buildAuthProfileIdentity(normalized);
  if (!identity) {
    const error = new Error('auth_profile_identity_incomplete');
    error.code = 'AUTH_PROFILE_IDENTITY_INCOMPLETE';
    throw error;
  }

  const authProfile = buildAuthProfileKey(identity);
  const profileSession = normalizeTokenSession({
    ...normalized,
    auth_profile: authProfile,
    auth_source: 'user_profile',
    auth_store: 'user',
    persistence_scope: 'user',
    user_auth_store_writable: true,
  });
  const payload = {
    version: AUTH_PROFILE_VERSION,
    profile_key_fields: identity,
    updated_at: new Date().toISOString(),
    ...profileSession,
  };
  writeJsonFileAtomic(getUserProfileFilePath(authProfile, options), payload);
  let pointerWarning;
  try {
    saveAuthProfilePointer(profileSession, options);
  } catch (error) {
    pointerWarning = `project_auth_pointer_unavailable: ${error.message}`;
  }
  clearProjectLegacyTokenSession(options);
  if (pointerWarning) {
    return attachAuthStoreMetadata(profileSession, {
      warning: pointerWarning,
    });
  }
  return profileSession;
}

function saveTokenSession(session, options = {}) {
  const env = options.env || process.env;
  const normalized = normalizeTokenSession(session);
  if (isHostInjectedTokenMode(env) && normalized.auth_source === 'env') {
    return attachAuthStoreMetadata(normalized, {
      auth_source: 'env',
      auth_store: 'host_injected',
      persistence_scope: 'host',
      user_auth_store_writable: null,
    });
  }

  try {
    return saveUserTokenSession(normalized, options);
  } catch (userStoreError) {
    const warning = userStoreError && userStoreError.code === 'AUTH_PROFILE_IDENTITY_INCOMPLETE'
      ? 'auth_profile_identity_incomplete_project_legacy_fallback'
      : `user_auth_store_unavailable_project_legacy_fallback: ${userStoreError.message}`;
    try {
      return attachAuthStoreMetadata(saveProjectLegacyTokenSession(normalized, options), {
        warning,
      });
    } catch (legacyError) {
      return attachAuthStoreMetadata(normalized, {
        auth_source: 'process',
        auth_store: 'process',
        persistence_scope: 'process',
        user_auth_store_writable: getUserAuthStoreWritable(options),
        warning: `${warning}; project_legacy_store_unavailable: ${legacyError.message}`,
      });
    }
  }
}

function isHostInjectedTokenMode(env = process.env) {
  const authEnabled = String(env.YIDA_AUTH_ENABLED || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(authEnabled)) {
    return true;
  }
  const authMode = String(env.OPENYIDA_AUTH_MODE || '').trim().toLowerCase();
  if (authMode !== 'token') {
    return false;
  }
  return !!(
    String(env.OPENYIDA_ACCESS_TOKEN || '').trim() ||
    String(env.OPENYIDA_REFRESH_TOKEN || '').trim()
  );
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
    corp_name: env.OPENYIDA_TOKEN_CORP_NAME,
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
    return attachAuthStoreMetadata(JSON.parse(fs.readFileSync(tokenFile, 'utf8')), {
      auth_source: 'project_legacy',
      auth_store: 'project_cache',
      persistence_scope: 'project',
      user_auth_store_writable: getUserAuthStoreWritable(options),
    });
  } catch {
    return null;
  }
}

function loadUserProfileFile(authProfile, options = {}) {
  const profileFile = getUserProfileFilePath(authProfile, options);
  if (!profileFile || !fs.existsSync(profileFile)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
    return attachAuthStoreMetadata(parsed, {
      auth_profile: parsed.auth_profile || authProfile,
      auth_source: 'user_profile',
      auth_store: 'user',
      persistence_scope: 'user',
      user_auth_store_writable: getUserAuthStoreWritable(options),
    });
  } catch {
    return null;
  }
}

function listUserAuthProfiles(options = {}) {
  const profilesDir = getUserProfilesDir(options);
  if (!fs.existsSync(profilesDir)) {
    return [];
  }
  try {
    return fs.readdirSync(profilesDir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => loadUserProfileFile(path.basename(entry, '.json'), options))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function selectUserProfileSession(options = {}, selection = {}) {
  const selector = getAuthProfileSelector(options);
  const allowAutoSingleProfile = selection.allowAutoSingleProfile !== false;
  if (selector.authProfile) {
    const session = loadUserProfileFile(selector.authProfile, options);
    return session && sessionMatchesSelector(session, selector)
      ? { session, source: 'explicit_profile' }
      : {
        session: null,
        status: 'profile_not_found',
        auth_profile: selector.authProfile,
        ...buildAuthProfileNextStep('profile_not_found'),
      };
  }

  const pointer = loadAuthProfilePointer(options);
  if (pointer && pointer.auth_profile) {
    const session = loadUserProfileFile(pointer.auth_profile, options);
    if (session && sessionMatchesSelector(session, selector)) {
      return { session, source: 'project_pointer' };
    }
  }

  let candidates = listUserAuthProfiles(options);
  if (selector.corpId) {
    candidates = candidates.filter((candidate) => candidate.corp_id === selector.corpId);
  }
  if (selector.userId) {
    candidates = candidates.filter((candidate) => candidate.user_id === selector.userId);
  }
  if (candidates.length === 1) {
    if (selector.corpId || selector.userId || allowAutoSingleProfile) {
      return {
        session: candidates[0],
        source: selector.corpId || selector.userId ? 'explicit_context' : 'single_profile',
      };
    }
    return {
      session: null,
      status: 'not_found',
      ...buildAuthProfileNextStep('not_found'),
    };
  }
  if (candidates.length > 1) {
    return {
      session: null,
      status: 'profile_required',
      candidate_count: candidates.length,
      candidates: candidates.map(toAuthProfileCandidate),
      message: 'multiple auth profiles found; pass --corp-id, --profile, or OPENYIDA_AUTH_PROFILE',
      ...buildAuthProfileNextStep('profile_required'),
    };
  }
  const status = selector.corpId || selector.userId ? 'profile_not_found' : 'not_found';
  return {
    session: null,
    status,
    ...buildAuthProfileNextStep(status),
  };
}

function applyBusinessContextToEnvSession(envSession, options = {}) {
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
    corp_name: envSession.corp_name || businessContext.corp_name,
  });
}

function resolveTokenSession(options = {}) {
  const env = options.env || process.env;
  const selector = getAuthProfileSelector(options);
  const envSession = applyBusinessContextToEnvSession(loadEnvTokenSession(env), options);
  if (
    isHostInjectedTokenMode(env) &&
    envSession &&
    (envSession.access_token || envSession.refresh_token) &&
    sessionMatchesSelector(envSession, selector, { allowMissingIdentity: true })
  ) {
    return {
      session: attachAuthStoreMetadata(envSession, {
        auth_source: 'env',
        auth_store: 'host_injected',
        persistence_scope: 'host',
        user_auth_store_writable: null,
      }),
      status: 'ok',
    };
  }
  if (isHostInjectedTokenMode(env)) {
    return {
      session: null,
      status: 'env_token_missing',
      auth_source: 'env',
      auth_store: 'host_injected',
      persistence_scope: 'host',
      user_auth_store_writable: null,
    };
  }
  if (
    envSession &&
    envSession.access_token &&
    sessionMatchesSelector(envSession, selector, { allowMissingIdentity: true })
  ) {
    return {
      session: attachAuthStoreMetadata(envSession, {
        auth_source: 'env',
        auth_store: 'host_injected',
        persistence_scope: 'process',
        user_auth_store_writable: getUserAuthStoreWritable(options),
      }),
      status: 'ok',
    };
  }

  const userProfile = selectUserProfileSession(options, { allowAutoSingleProfile: false });
  if (userProfile.session) {
    if (
      !userProfile.session.refresh_token &&
      envSession &&
      envSession.refresh_token &&
      sessionMatchesSelector(envSession, selector, { allowMissingIdentity: true })
    ) {
      return {
        session: attachAuthStoreMetadata(userProfile.session, {
          refresh_token: envSession.refresh_token,
          auth_source: 'mixed',
        }),
        status: 'ok',
        profile_resolution: userProfile.source,
      };
    }
    return {
      session: userProfile.session,
      status: 'ok',
      profile_resolution: userProfile.source,
    };
  }

  const localSession = loadLocalTokenSession(options);
  if (
    localSession &&
    (localSession.access_token || localSession.refresh_token) &&
    sessionMatchesSelector(localSession, selector)
  ) {
    if (
      !localSession.refresh_token &&
      envSession &&
      envSession.refresh_token &&
      sessionMatchesSelector(envSession, selector, { allowMissingIdentity: true })
    ) {
      return {
        session: attachAuthStoreMetadata(localSession, {
          refresh_token: envSession.refresh_token,
          auth_source: 'mixed',
        }),
        status: 'ok',
      };
    }
    return {
      session: localSession,
      status: 'ok',
    };
  }
  const fallbackUserProfile = selectUserProfileSession(options);
  if (fallbackUserProfile.session) {
    if (
      !fallbackUserProfile.session.refresh_token &&
      envSession &&
      envSession.refresh_token &&
      sessionMatchesSelector(envSession, selector, { allowMissingIdentity: true })
    ) {
      return {
        session: attachAuthStoreMetadata(fallbackUserProfile.session, {
          refresh_token: envSession.refresh_token,
          auth_source: 'mixed',
        }),
        status: 'ok',
        profile_resolution: fallbackUserProfile.source,
      };
    }
    return {
      session: fallbackUserProfile.session,
      status: 'ok',
      profile_resolution: fallbackUserProfile.source,
    };
  }
  if (
    envSession &&
    envSession.refresh_token &&
    sessionMatchesSelector(envSession, selector, { allowMissingIdentity: true })
  ) {
    return {
      session: attachAuthStoreMetadata(envSession, {
        auth_source: 'env',
        auth_store: 'host_injected',
        persistence_scope: 'process',
        user_auth_store_writable: getUserAuthStoreWritable(options),
      }),
      status: 'ok',
    };
  }

  return {
    session: null,
    status: fallbackUserProfile.status || userProfile.status || 'not_found',
    auth_source: fallbackUserProfile.status === 'profile_required' ? 'user_profile' : undefined,
    auth_store: fallbackUserProfile.status === 'profile_required' ? 'user' : undefined,
    persistence_scope: fallbackUserProfile.status === 'profile_required' ? 'user' : undefined,
    user_auth_store_writable: getUserAuthStoreWritable(options),
    candidate_count: fallbackUserProfile.candidate_count,
    candidates: fallbackUserProfile.candidates || userProfile.candidates,
    message: fallbackUserProfile.message,
    auth_profile: fallbackUserProfile.auth_profile || userProfile.auth_profile,
    next_step: fallbackUserProfile.next_step || userProfile.next_step,
    next_step_commands: fallbackUserProfile.next_step_commands || userProfile.next_step_commands,
  };
}

function loadTokenSession(options = {}) {
  return resolveTokenSession(options).session;
}

function clearTokenSession(options = {}) {
  clearAuthProfilePointer(options);
  clearProjectLegacyTokenSession(options);
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
  getAuthProfilePointerFilePath,
  getUserProfileFilePath,
  resolveUserAuthDir,
  getUserAuthStoreWritable,
  listUserAuthProfiles,
  getBusinessContextFilePath,
  loadTokenSession,
  resolveTokenSession,
  saveTokenSession,
  loadBusinessContext,
  saveBusinessContext,
  loadAuthProfilePointer,
  saveAuthProfilePointer,
  clearAuthProfilePointer,
  deleteUserAuthProfile,
  clearAllUserAuthProfiles,
  clearTokenSession,
  clearProjectLegacyTokenSession,
  normalizeTokenSession,
  normalizeCorpName,
  loadUserProfileFile,
  loadEnvTokenSession,
  loadLocalTokenSession,
  saveProjectLegacyTokenSession,
  isHostInjectedTokenMode,
  isAccessTokenUsable,
  maskToken,
  resolveEnvName,
};
