'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { withProfileLock, profileLockPath } = require('../lib/auth/profile-lock');
const { saveTokenSession, loadUserProfileFile, loadAuthProfilePointer, deleteUserAuthProfile } = require('../lib/auth/token-store');
const { tokenRefresh, tokenLogout } = require('../lib/auth/token-auth');

function deferred() {
  let resolve;
  const promise = new Promise(done => {resolve = done;});
  return { promise, resolve };
}

describe('profile-scoped auth refresh serialization', () => {
  let root;
  let options;
  let session;
  let calls;
  let respond;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-profile-lock-'));
    options = { projectRoot: root, authDir: path.join(root, 'auth'), envName: 'public', env: {}, endpoint: 'https://auth.example.test' };
    session = saveTokenSession({ client_id: 'cli', corp_id: 'corp-a', user_id: 'user-a', base_url: 'https://platform.example.test', access_token: 'access-old', refresh_token: 'refresh-old' }, options);
    options.authProfile = session.auth_profile;
    calls = [];
    respond = async () => ({ success: true, data: { accessToken: 'access-new', refreshToken: 'refresh-new' } });
    jest.spyOn(https, 'request').mockImplementation((requestOptions, callback) => {
      const request = new EventEmitter();
      let bytes = '';
      request.write = chunk => {bytes += chunk.toString();};
      request.end = () => {
        const call = { ...requestOptions, body: JSON.parse(bytes || '{}') };
        calls.push(call);
        Promise.resolve(respond(call)).then(payload => {
          const response = new EventEmitter();
          response.statusCode = 200;
          response.headers = {};
          callback(response);
          response.emit('data', Buffer.from(JSON.stringify(payload)));
          response.emit('end');
        }).catch(error => request.emit('error', error));
      };
      return request;
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('concurrent refreshes rotate once and never switch an unrelated current pointer', async () => {
    const current = saveTokenSession({ ...session, corp_id: 'corp-b', user_id: 'user-b', access_token: 'other-access' }, options);
    const gate = deferred();
    respond = async () => {await gate.promise; return { success: true, data: { accessToken: 'access-new', refreshToken: 'refresh-new' } };};
    const first = tokenRefresh(options);
    const second = tokenRefresh(options);
    gate.resolve();
    const results = await Promise.all([first, second]);
    expect(results.map(result => result.access_token)).toEqual(['access-new', 'access-new']);
    expect(calls).toHaveLength(1);
    expect(calls[0].body.refreshToken).toBe('refresh-old');
    expect(loadAuthProfilePointer(options).auth_profile).toBe(current.auth_profile);
  });
  test('logout waits for refresh, revokes the rotated token, and leaves no profile', async () => {
    const entered = deferred();
    const gate = deferred();
    respond = async call => {
      if (call.path.endsWith('/refresh')) {entered.resolve(); await gate.promise;}
      return { success: true, data: { accessToken: 'access-new', refreshToken: 'refresh-new' } };
    };
    const refreshing = tokenRefresh(options);
    await entered.promise;
    const logout = tokenLogout(options);
    gate.resolve();
    await refreshing;
    await expect(logout).resolves.toMatchObject({ status: 'logged_out', deleted_profile_count: 1 });
    expect(calls.map(call => call.path.split('/').pop())).toEqual(['refresh', 'logout']);
    expect(calls[1].body.refreshToken).toBe('refresh-new');
    expect(loadUserProfileFile(session.auth_profile, options)).toBeNull();
  });
  test.each(['delete', 'replace'])('a stale refresh cannot resurrect or overwrite a profile after %s', async action => {
    respond = async () => {
      if (action === 'delete') {deleteUserAuthProfile(session.auth_profile, options);}
      else {saveTokenSession({ ...session, access_token: 'new-login-access' }, options);}
      return { success: true, data: { accessToken: 'stale-result', refreshToken: 'stale-refresh' } };
    };
    await expect(tokenRefresh(options)).rejects.toThrow();
    const result = loadUserProfileFile(session.auth_profile, options);
    if (action === 'delete') {expect(result).toBeNull();}
    else {expect(result.access_token).toBe('new-login-access');}
  });
  test('refresh returning another identity fails before persistence', async () => {
    respond = async () => ({ success: true, data: { accessToken: 'wrong-user-access', corpId: 'corp-other' } });
    await expect(tokenRefresh(options)).rejects.toThrow();
    expect(loadUserProfileFile(session.auth_profile, options).access_token).toBe('access-old');
  });
  test('managed task grants never refresh or read an ordinary profile', async () => {
    const env = {
      OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND', OPENYIDA_AGENT_CORP_ID: 'corp-a', OPENYIDA_AGENT_USER_ID: 'user-a',
      OPENYIDA_AGENT_RUN_ID: 'run-a', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt-a', OPENYIDA_AGENT_BASE_URL: 'https://platform.example.test',
      OPENYIDA_AGENT_TASK_GRANT: 'task_' + 'g'.repeat(48), OPENYIDA_AUTH_MODE: 'token', OPENYIDA_ENDPOINT: 'https://wrong.example.test',
    };
    await expect(tokenRefresh({ ...options, env })).rejects.toThrow();
    expect(calls).toEqual([]);
    expect(loadUserProfileFile(session.auth_profile, options).access_token).toBe('access-old');
  });
  test('live lock cannot be stolen after a timeout', async () => {
    const lockPath = profileLockPath(session.auth_profile, options);
    fs.mkdirSync(lockPath, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, nonce: 'a'.repeat(32) }));
    const operation = jest.fn();
    await expect(withProfileLock(session.auth_profile, { ...options, authLockTimeoutMs: 25 }, operation)).rejects.toMatchObject({ code: 'AUTH_PROFILE_LOCKED' });
    expect(operation).not.toHaveBeenCalled();
    expect(fs.existsSync(lockPath)).toBe(true);
  });
  test('independent CLI processes respect the same lock', async () => {
    const source = `const {withProfileLock}=require(${JSON.stringify(require.resolve('../lib/auth/profile-lock'))}); withProfileLock('cross-process', ${JSON.stringify(options)}, async()=>{process.stdout.write('locked\\n'); await new Promise(resolve=>process.stdin.once('data', resolve));}).catch(()=>{process.exitCode=1;});`;
    const child = spawn(process.execPath, ['-e', source], { stdio: ['pipe', 'pipe', 'pipe'] });
    const closed = new Promise(resolve => child.once('close', resolve));
    try {
      await new Promise((resolve, reject) => {child.stdout.once('data', resolve); child.once('error', reject);});
      const operation = jest.fn();
      const waiting = withProfileLock('cross-process', options, operation);
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(operation).not.toHaveBeenCalled();
      child.stdin.end('release');
      await waiting;
      expect(operation).toHaveBeenCalledTimes(1);
      await expect(closed).resolves.toBe(0);
    } finally {child.kill();}
  });
});
