'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  clearTokenSession,
  getTokenFilePath,
  isAccessTokenUsable,
  loadTokenSession,
  maskToken,
  saveTokenSession,
} = require('../lib/auth/token-store');

describe('token-store', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-token-store-'));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('saves and loads token session per environment', () => {
    const options = { projectRoot, envName: 'alibaba' };
    const saved = saveTokenSession({
      access_token: 'access-token-value',
      refresh_token: 'refresh-token-value',
      expires_in: 1800,
      base_url: 'https://www.aliwork.com/openapi/cli/v1/auth',
      corp_id: 'corpA',
      user_id: 'userA',
    }, options);

    expect(saved.auth_mode).toBe('token');
    expect(saved.expires_at).toBeGreaterThan(Date.now());
    expect(getTokenFilePath(options)).toContain('auth-token-alibaba.json');
    const raw = JSON.parse(fs.readFileSync(getTokenFilePath(options), 'utf8'));
    expect(raw.base_url).toBe('https://www.aliwork.com');
    expect(raw.token_endpoint).toBeUndefined();

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBe('access-token-value');
    expect(loaded.refresh_token).toBe('refresh-token-value');
    expect(loaded.base_url).toBe('https://www.aliwork.com');
    expect(loaded.corp_id).toBe('corpA');
    expect(isAccessTokenUsable(loaded)).toBe(true);
  });

  test('clears token session idempotently', () => {
    const options = { projectRoot, envName: 'public' };
    saveTokenSession({ access_token: 'token' }, options);
    clearTokenSession(options);
    clearTokenSession(options);
    expect(loadTokenSession(options)).toBe(null);
  });

  test('uses injected env access and refresh tokens when the local token file is absent', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
        OPENYIDA_ENDPOINT: 'https://www.aliwork.com',
        OPENYIDA_TOKEN_CLIENT_ID: 'openyida-cli',
        OPENYIDA_TOKEN_CORP_ID: 'corp-env',
        OPENYIDA_TOKEN_USER_ID: 'user-env',
      },
    };

    const loaded = loadTokenSession(options);

    expect(loaded.access_token).toBe('env-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('env');
    expect(loaded.corp_id).toBe('corp-env');
    expect(loaded.user_id).toBe('user-env');
  });

  test('does not fall back to env when a valid local token file exists', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
      expires_in: 1800,
    }, options);

    const loaded = loadTokenSession(options);

    expect(loaded.access_token).toBe('local-access-token');
    expect(loaded.refresh_token).toBe('local-refresh-token');
    expect(loaded.auth_source).toBe('local');
  });

  test('host-injected token mode ignores local token files', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        YIDA_AUTH_ENABLED: 'true',
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
    }, options);

    const loaded = loadTokenSession(options);

    expect(loaded.access_token).toBe('env-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('env');
  });

  test('host-injected token mode returns null when the host provides no token', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        YIDA_AUTH_ENABLED: 'true',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      refresh_token: 'local-refresh-token',
    }, options);

    expect(loadTokenSession(options)).toBeNull();
  });

  test('fills a missing local refresh token from env without replacing local access token', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({
      access_token: 'local-access-token',
      expires_at: Date.now() - 1000,
    }, options);

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBe('local-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('mixed');
  });

  test('never fills a missing local access token from env', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    saveTokenSession({ refresh_token: 'local-refresh-token' }, options);

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBeUndefined();
    expect(loaded.refresh_token).toBe('local-refresh-token');
    expect(loaded.auth_source).toBe('local');
  });

  test('falls back to env fields when the local token file cannot be parsed', () => {
    const options = {
      projectRoot,
      envName: 'public',
      env: {
        OPENYIDA_ACCESS_TOKEN: 'env-access-token',
        OPENYIDA_REFRESH_TOKEN: 'env-refresh-token',
      },
    };
    const tokenFile = getTokenFilePath(options);
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, '{not-json', 'utf8');

    const loaded = loadTokenSession(options);
    expect(loaded.access_token).toBe('env-access-token');
    expect(loaded.refresh_token).toBe('env-refresh-token');
    expect(loaded.auth_source).toBe('env');
  });

  test('masks token values', () => {
    expect(maskToken('1234567890abcdefg')).toBe('12345678...bcdefg');
    expect(maskToken('short')).toBe('shor...');
  });
});
