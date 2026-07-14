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

  test('masks token values', () => {
    expect(maskToken('1234567890abcdefg')).toBe('12345678...bcdefg');
    expect(maskToken('short')).toBe('shor...');
  });
});
