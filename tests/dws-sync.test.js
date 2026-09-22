'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable, PassThrough } = require('stream');
jest.mock('../lib/auth/token-auth', () => ({
  ...jest.requireActual('../lib/auth/token-auth'), requestJson: jest.fn(),
}));
const { requestJson } = require('../lib/auth/token-auth');
const { syncDws, readHandoff } = require('../lib/auth/dws-sync');
const { saveTokenSession, loadTokenSession, listUserAuthProfiles, getAuthProfilePointerFilePath } = require('../lib/auth/token-store');
const { DINGTALK_OAUTH_CLIENT_ID } = require('../lib/core/env-manager');

const origin = 'https://pre-yida-vpc.alibaba-inc.com';
const fakeSecret = 'fake-dws-access-secret-for-tests';
const input = (extra = {}) => Readable.from([JSON.stringify({
  accessToken: fakeSecret, corpId: 'corp-a', environment: 'pre', ...extra,
})]);
const issued = () => ({ status: 'ok', access_token: 'yida-access', refresh_token: 'yida-refresh',
  expires_in: 1800, corp_id: 'corp-a', user_id: 'user-a', client_id: DINGTALK_OAUTH_CLIENT_ID,
  credential_source: 'dws', environment: 'pre', session_id: '12345678-1234-1234-1234-123456789abc',
  session_expires_at: Math.floor(Date.now() / 1000) + 7200,
});

describe('private DWS access-token sync', () => {
  let root;
  let options;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dws-sync-'));
    options = { projectRoot: root, authDir: path.join(root, 'auth'), endpoint: origin, env: {}, input: input() };
    requestJson.mockReset().mockResolvedValue(issued());
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('two task directories keep independent organization bindings in one profile store', async () => {
    const first = await syncDws(options);
    const other = { ...options, projectRoot: path.join(root, 'task-b'), input: input({ corpId: 'corp-b' }) };
    requestJson.mockResolvedValue({ ...issued(), corp_id: 'corp-b', user_id: 'user-b',
      session_id: '87654321-4321-4321-4321-cba987654321' });
    const second = await syncDws(other);
    expect(first.auth_profile).not.toBe(second.auth_profile);
    expect(loadTokenSession(options)).toMatchObject({ corp_id: 'corp-a', auth_profile: first.auth_profile });
    expect(loadTokenSession(other)).toMatchObject({ corp_id: 'corp-b', auth_profile: second.auth_profile });
    // A deliberate rebind in task A is visible to the task's next status check.
    await syncDws({ ...options, input: input({ corpId: 'corp-b' }) });
    expect(loadTokenSession(options).auth_profile).not.toBe(first.auth_profile);
    expect(loadTokenSession({ ...options, authProfile: first.auth_profile }).corp_id).toBe('corp-a');
    expect(loadTokenSession(other).corp_id).toBe('corp-b');
  });

  test('expired DWS sessions are not eligible for automatic use', async () => {
    await syncDws(options);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3 * 3600 * 1000);
    try {
      expect(require('../lib/auth/token-auth').tokenStatus(options)).toMatchObject({
        status: 'expired', can_auto_use: false, failure_reason: 'dws_session_expired' });
    } finally { now.mockRestore(); }
  });

  test('capability probe neither reads stdin nor exchanges credentials', async () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => {});
    const pipe = new PassThrough();
    try {
      const result = await require('../lib/auth/dws-sync').run(['--capabilities', '--json'], { ...options, input: pipe });
      expect(result).toEqual({ protocol_version: 1, private_stdin: true, independent_profile: true });
      expect(requestJson).not.toHaveBeenCalled();
      expect(fs.existsSync(options.authDir)).toBe(false);
    } finally { output.mockRestore(); pipe.destroy(); }
  });

  test('status preserves the exchanged environment across subsequent commands', async () => {
    await syncDws(options);
    const { tokenStatus } = require('../lib/auth/token-auth');
    const status = tokenStatus({ ...options, endpoint: undefined, env: {} });
    expect(status).toMatchObject({ base_url: origin, credential_source: 'dws', environment: 'pre',
      corp_id: 'corp-a', user_id: 'user-a', session_expires_at: expect.any(Number) });
    expect(require('../lib/core/utils').resolveBaseUrl(status)).toBe(origin);
    expect(JSON.stringify(status)).not.toContain(fakeSecret);
  });

  test('exchanges access through Authorization, persists YiDA only and isolates independent login', async () => {
    const original = saveTokenSession({ ...issued(), credential_source: undefined, session_id: undefined,
      access_token: 'independent', refresh_token: 'independent-refresh', base_url: origin }, options);
    const result = await syncDws(options);
    expect(result).toMatchObject({ ok: true, status: 'ready', corp_id: 'corp-a', user_id: 'user-a' });
    expect(requestJson).toHaveBeenCalledWith('POST', `${origin}/openapi/cli/v1/auth/dws/token`,
      { corpId: 'corp-a', environment: 'pre' }, { Authorization: `Bearer ${fakeSecret}` }, expect.any(Object));
    expect(result.auth_profile).not.toBe(original.auth_profile);
    expect(loadTokenSession(options)).toMatchObject({ access_token: 'yida-access', credential_source: 'dws', auth_base_url: origin });
    expect(listUserAuthProfiles(options)).toHaveLength(2);
    for (const name of fs.readdirSync(path.join(options.authDir, 'profiles'))) {
      expect(fs.readFileSync(path.join(options.authDir, 'profiles', name), 'utf8')).not.toContain(fakeSecret);
    }
    expect(JSON.stringify(result)).not.toMatch(/secret|yida-access|yida-refresh/);
  });

  test.each([
    { refresh_token: '' }, { client_id: 'dws-client' }, { environment: 'prod' }, { credential_source: 'oauth' },
    { corp_id: 'another-corp' }, { base_url: 'https://www.aliwork.com' },
    { session_expires_at: 1 },
  ])('rejects incomplete or mismatched exchange without switching: %j', async (change) => {
    const original = saveTokenSession({ ...issued(), base_url: origin, access_token: 'old' }, options);
    requestJson.mockResolvedValue({ ...issued(), ...change });
    await expect(syncDws(options)).rejects.toMatchObject({ code: 'DWS_SYNC_FAILED' });
    expect(loadTokenSession(options).auth_profile).toBe(original.auth_profile);
  });

  test('does not accept credentials or identity overrides from environment', async () => {
    await expect(syncDws({ ...options, env: { OPENYIDA_ACCESS_TOKEN: 'injected' } }))
      .rejects.toThrow('AUTH_OVERRIDE_CONFLICT');
    expect(requestJson).not.toHaveBeenCalled();
  });

  test('cannot report ready on profile write failure or expose echoed upstream credentials', async () => {
    fs.writeFileSync(options.authDir, 'not a directory');
    await expect(syncDws(options)).rejects.toThrow('PERSISTENCE_FAILED');
    expect(fs.existsSync(getAuthProfilePointerFilePath(options))).toBe(false);
    requestJson.mockRejectedValue(new Error(fakeSecret));
    await expect(syncDws({ ...options, input: input() })).rejects.toThrow('EXCHANGE_REQUEST_FAILED');
  });

  test('private pipe rejects arbitrary destinations, excessive input and a pipe that never closes', async () => {
    await expect(readHandoff(input({ endpoint: 'https://attacker.invalid' }))).rejects.toThrow('INVALID_HANDOFF');
    await expect(readHandoff(Readable.from(['x'.repeat(20000)]))).rejects.toThrow('HANDOFF_TOO_LARGE');
    const pipe = new PassThrough();
    await expect(readHandoff(pipe, 5)).rejects.toThrow('HANDOFF_TIMEOUT');
    pipe.destroy();
  });
});
