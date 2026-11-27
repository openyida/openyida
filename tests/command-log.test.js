'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile, spawnSync } = require('child_process');
const { promisify } = require('util');
const { appendCommandLog, readCommandLog } = require('../lib/feedback/command-log');
const { runWithCommandContext, getCommandContextHeaders, trackCommand, observeCommandResponse, observeCommandNetworkError } = require('../lib/core/command-context');

let root;
let options;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-command-log-'));
  options = { cwd: root, directory: path.join(root, 'journal'), sessionId: 'private-session' };
});
afterEach(() => {jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true });});

function entry(i = 0) {
  return { timestamp: new Date(1700000000000 + i).toISOString(), command: 'create-app', commandExecutionId: randomUUID(), durationMs: 27, exitCode: 0 };
}

test('reuses request ID, keeps native envelope metadata, never persists input or exception text', async () => {
  jest.spyOn(os, 'homedir').mockReturnValue(root);
  const url = new URL('https://www.aliwork.com');
  let requestId;
  const trace = '0123456789abcdef0123456789abcdef';
  await expect(trackCommand('create-app', () => runWithCommandContext(() => {
    requestId = getCommandContextHeaders(url)['X-OpenYida-Command-Id'];
    observeCommandResponse(url, trace, 200, { success: false, errorCode: 'TIANSHU_12345', exceptionClass: 'java.lang.IllegalStateException', throwable: 'customer-secret-content' });
    throw new Error('customer-secret-message');
  }))).rejects.toThrow('customer-secret-message');
  expect(readCommandLog({ since: 0 })).toEqual([expect.objectContaining({ commandExecutionId: requestId, traceId: trace,
    errorCode: 'TIANSHU_12345', errorType: 'java.lang.IllegalStateException', status: 'error' })]);
  const raw = fs.readFileSync(path.join(root, '.openyida/feedback/command-history/commands.log'), 'utf8');
  expect(raw).not.toMatch(/customer-secret|www\.aliwork\.com|java\.lang\.IllegalStateException:/);
});

test('filters by cwd, session and time and rejects unknown command names and fields', () => {
  const subdir = fs.mkdtempSync(path.join(root, 'other-'));
  const first = entry(1);
  appendCommandLog(first, options);
  appendCommandLog(entry(2), { ...options, cwd: subdir });
  appendCommandLog(entry(3), { ...options, sessionId: 'different-session' });
  const last = entry(4);
  appendCommandLog({ ...last, response: 'customer-secret', argv: ['customer-secret'] }, options);
  appendCommandLog({ ...entry(5), command: 'customer-secret' }, options);
  appendCommandLog({ ...entry(6), command: 'feedback' }, options);
  expect(readCommandLog(options).map(e => e.commandExecutionId)).toEqual([first.commandExecutionId, last.commandExecutionId]);
  expect(readCommandLog({ ...options, since: Date.parse(last.timestamp), until: Date.parse(last.timestamp) })).toHaveLength(1);
  const raw = fs.readFileSync(path.join(options.directory, 'commands.log'), 'utf8');
  expect(raw).not.toMatch(/customer-secret|private-session|different-session|openyida-command-log-/);
});

test('overwrites by aggregate bytes across scopes and preserves recent complete records', () => {
  const first = entry(0);
  appendCommandLog(first, options);
  let last;
  for (let i = 1; i < 2900; i++) {
    last = entry(i);
    appendCommandLog(last, { ...options, sessionId: i % 2 ? 'other' : null });
  }
  const records = [...readCommandLog({ ...options, sessionId: null, since: 0 }), ...readCommandLog({ ...options, sessionId: 'other' })].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const file = path.join(options.directory, 'commands.log');
  expect(fs.statSync(file).size).toBeLessThanOrEqual(512 * 1024);
  expect(fs.statSync(file).size).toBeGreaterThan(511 * 1024);
  if (process.platform !== 'win32') {expect(fs.statSync(file).mode & 0o077).toBe(0);}
  expect(records[0].timestamp > first.timestamp).toBe(true);
  expect(records[records.length - 1].commandExecutionId).toBe(last.commandExecutionId);
  expect(records).toHaveLength(1 + (Date.parse(last.timestamp) - Date.parse(records[0].timestamp)));
});

test('does not mix host sessions and unscoped history requires an explicit time or command ID', () => {
  const missingSession = { ...options, sessionId: null };
  const row = entry();
  appendCommandLog(row, missingSession);
  appendCommandLog(entry(1), options);
  expect(readCommandLog(missingSession)).toEqual([]);
  for (const since of [NaN, null, '2026-01-01', -Infinity]) {
    expect(readCommandLog({ ...missingSession, since })).toEqual([]);
  }
  expect(readCommandLog({ ...missingSession, since: 10, until: 2 })).toEqual([]);
  expect(readCommandLog({ ...missingSession, commandExecutionIds: ['anything'] })).toEqual([]);
  expect(readCommandLog({ ...missingSession, since: 0 })).toHaveLength(1);
  expect(readCommandLog({ ...missingSession, commandExecutionIds: [row.commandExecutionId] })).toHaveLength(1);
  expect(readCommandLog({ ...options, commandExecutionIds: [row.commandExecutionId] })).toEqual([]);
});

test('preserves native failure on an exit-zero command while discarding the throwable body and token-like codes', async () => {
  jest.spyOn(os, 'homedir').mockReturnValue(root);
  const url = new URL('https://www.aliwork.com');
  for (const throwable of ['java.lang.IllegalArgumentException: customer-secret-data\n\tat private.place.SecretRecord', { name: 'TypeError', message: 'customer-secret-data' }]) {
    await trackCommand('create-app', () => runWithCommandContext(() => {
      observeCommandResponse(url, undefined, 200, { success: false, errorCode: 'ghp_abcdefghijklmnopqrstuvwxyz123456', throwable });
    }));
  }
  const rows = readCommandLog({ since: 0 });
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(r => r.errorType))).toEqual(new Set(['java.lang.IllegalArgumentException', 'TypeError']));
  for (const row of rows) {
    expect(row).toMatchObject({ exitCode: 0, status: 'success', nativeErrorObserved: true });
    expect(row.errorCode).toBeUndefined();
  }
  expect(JSON.stringify(rows)).not.toMatch(/customer-secret|ghp_|private\.place/);
});

test('retains a native network error if its caller wraps it, without copying hostname or message', async () => {
  jest.spyOn(os, 'homedir').mockReturnValue(root);
  await expect(trackCommand('create-app', () => runWithCommandContext(() => {
    observeCommandNetworkError(new URL('https://www.aliwork.com'), Object.assign(new Error('private host'), { code: 'ECONNRESET' }));
    throw new Error('wrapped');
  }))).rejects.toThrow('wrapped');
  expect(readCommandLog({ since: 0 })).toEqual([expect.objectContaining({ errorCode: 'ECONNRESET', nativeErrorObserved: true, status: 'error' })]);
});

test('retains the record after a transient Windows sharing violation and repeated lock contention', () => {
  const rename = fs.renameSync;
  let attempts = 0;
  jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (path.basename(to) === '.writer' && ++attempts <= 14) {
      throw Object.assign(new Error('busy'), { code: attempts === 1 ? 'EBUSY' : 'EPERM' });
    }
    return rename(from, to);
  });
  const unlink = fs.unlinkSync;
  let busyOnRelease = true;
  jest.spyOn(fs, 'unlinkSync').mockImplementation(target => {
    if (busyOnRelease && path.basename(path.dirname(target)) === '.writer') {
      busyOnRelease = false;
      throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    }
    return unlink(target);
  });
  const row = entry();
  appendCommandLog(row, options);
  expect(readCommandLog(options).map(record => record.commandExecutionId)).toEqual([row.commandExecutionId]);
  expect(fs.readdirSync(options.directory)).toEqual(['commands.log']);
});

test('concurrent processes share one intact journal and recover a dead writer', async () => {
  fs.mkdirSync(options.directory, { mode: 0o700 });
  const lock = path.join(options.directory, '.writer');
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, '2147483647-' + randomUUID()), '');
  const script = `
    const { appendCommandLog } = require(process.argv[1]);
    const options = JSON.parse(process.argv[2]);
    for (let i = 0; i < 5; i++) {
      appendCommandLog({ command: 'create-app', timestamp: new Date().toISOString(), durationMs: i,
        commandExecutionId: require('crypto').randomUUID(), exitCode: 0 }, options);
    }`;
  await Promise.all(Array.from({ length: 8 }, () => promisify(execFile)(process.execPath,
    ['-e', script, require.resolve('../lib/feedback/command-log'), JSON.stringify(options)])));
  const rows = readCommandLog(options);
  expect(new Set(rows.map(row => row.commandExecutionId)).size).toBe(40);
  expect(fs.readdirSync(options.directory)).toEqual(['commands.log']);
});

test('direct process.exit records its real code without recording stdout, and filesystem errors stay best effort', () => {
  const script = `
    require('os').homedir = () => process.argv[1];
    const { trackCommand } = require(process.argv[2]);
    trackCommand('create-app', () => { console.log('private-output'); process.exit(7); });`;
  const child = spawnSync(process.execPath, ['-e', script, root, require.resolve('../lib/core/command-context')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, OPENYIDA_MANAGED_RUN: '0' },
  });
  expect(child.status).toBe(7);
  expect(child.stdout.trim()).toBe('private-output');
  const directory = path.join(root, '.openyida/feedback/command-history');
  expect(readCommandLog({ cwd: root, directory, since: 0 })).toEqual([expect.objectContaining({ exitCode: 7, status: 'error', command: 'create-app' })]);
  const invalidDirectory = path.join(root, 'blocked');
  fs.writeFileSync(invalidDirectory, '');
  expect(() => appendCommandLog(entry(), { ...options, directory: invalidDirectory })).not.toThrow();
  expect(readCommandLog({ ...options, directory: invalidDirectory })).toEqual([]);
});
