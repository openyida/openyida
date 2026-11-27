'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { mkdirPrivate } = require('../agent/private-directory');
const { COMMAND_GROUPS } = require('../core/command-manifest');
const { containsCredential } = require('./intake-evidence');

const LIMIT = 512 * 1024;
const HEADER = 8; // ASCII hex offset of the next write in the circular file.
const COMMANDS = new Set(COMMAND_GROUPS.flatMap(group => group.commands.map(entry => entry.command)));
const UUID = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const NATIVE_CODE = /^(?:[A-Za-z][A-Za-z0-9_.-]{0,79}|\d{1,12})$/;
const TOKEN = /^(?:sk[-_]|npm_|xox[baprs]-|eyJ[A-Za-z0-9_-]*\.)/i;
const TRACE = /^[0-9a-f]{16,64}$/i;
const EXCEPTION = /^(?:[a-zA-Z_$][\w$]*\.)*[a-zA-Z_$][\w$]*(?:Error|Exception|Throwable)$|^(?:Error|Exception|Throwable)$/;
const logDirectory = () => path.join(os.homedir(), '.openyida', 'feedback', 'command-history');
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 32);

function sessionHint() {
  return process.env.OPENYIDA_SESSION_ID || process.env.QODER_SESSION_ID ||
    process.env.CODEX_THREAD_ID || process.env.CLAUDE_CODE_SESSION_ID;
}

function allowedCommand(command) {
  return COMMANDS.has(command) && command !== 'feedback';
}

function safeRecord(value) {
  if (!value || !allowedCommand(value.command) || typeof value.commandExecutionId !== 'string' || !UUID.test(value.commandExecutionId) ||
      typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp)) ||
      !Number.isSafeInteger(value.durationMs) || value.durationMs < 0 ||
      !Number.isSafeInteger(value.exitCode)) {return null;}
  const { command, commandExecutionId, durationMs, exitCode } = value;
  const record = { timestamp: new Date(value.timestamp).toISOString(), command,
    commandExecutionId, durationMs, exitCode, status: exitCode === 0 ? 'success' : 'error' };
  if (typeof value.traceId === 'string' && TRACE.test(value.traceId)) {record.traceId = value.traceId;}
  if (value.nativeErrorObserved === true) {record.nativeErrorObserved = true;}
  if (exitCode !== 0 || record.nativeErrorObserved) {
    if (typeof value.errorCode === 'string' && NATIVE_CODE.test(value.errorCode) && !TOKEN.test(value.errorCode) && !containsCredential(value.errorCode)) {record.errorCode = value.errorCode;}
    if (typeof value.errorType === 'string' && value.errorType.length <= 128 && EXCEPTION.test(value.errorType) && !containsCredential(value.errorType)) {record.errorType = value.errorType;}
  }
  return record;
}

function privateDirectory(directory) {
  const stat = fs.lstatSync(directory);
  return stat.isDirectory() && (process.platform === 'win32' || (stat.mode & 0o077) === 0);
}

function openLog(directory, write) {
  const { O_CREAT, O_RDWR, O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
  const fd = fs.openSync(path.join(directory, 'commands.log'), (write ? O_CREAT | O_RDWR : O_RDONLY) | (O_NOFOLLOW || 0) | (O_NONBLOCK || 0), 0o600);
  const stat = fs.fstatSync(fd);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > LIMIT ||
      (process.platform !== 'win32' && (stat.mode & 0o077))) {
    fs.closeSync(fd);
    throw new Error('invalid command log');
  }
  return fd;
}

function removeLockEntry(remove, target) {
  for (let attempt = 0; ; attempt++) {
    try {remove(target); return;} catch (err) {
      if (attempt >= 4 || !['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {return;}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5 * (attempt + 1));
    }
  }
}

// Rename an already populated directory into place. A new owner is never an
// empty directory, so an overlapping stale-owner cleanup cannot remove it.
function withWriter(directory, operation) {
  const lock = path.join(directory, '.writer');
  const candidate = fs.mkdtempSync(path.join(directory, '.claim-'));
  const marker = process.pid + '-' + randomUUID();
  let owned = false;
  try {
    fs.writeFileSync(path.join(candidate, marker), '', { mode: 0o600, flag: 'wx' });
    const deadline = performance.now() + 1500;
    let delay = 4;
    for (;;) {
      try {fs.renameSync(candidate, lock); owned = true; break;} catch (err) {
        if (!['EEXIST', 'ENOTEMPTY', 'EACCES', 'EPERM', 'EBUSY'].includes(err.code)) {throw err;}
        if (performance.now() >= deadline) {return;}
      }
      try {
        const [owner] = fs.readdirSync(lock);
        if (!owner) {
          fs.rmdirSync(lock);
        } else if (/^\d+-[\da-f-]{36}$/.test(owner)) {
          try {process.kill(Number(owner.split('-')[0]), 0);} catch (err) {
            if (err.code === 'ESRCH') {
              fs.unlinkSync(path.join(lock, owner));
              fs.rmdirSync(lock);
            }
          }
        }
      } catch { /* A live writer or another contender owns the directory. */ }
      // Stagger contenders so a running writer can finish even on a busy Windows host.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay + Math.random() * delay);
      delay = Math.min(16, delay * 2);
    }
    operation();
  } finally {
    const target = owned ? lock : candidate;
    removeLockEntry(fs.unlinkSync, path.join(target, marker));
    removeLockEntry(fs.rmdirSync, target); // Never remove a new owner's non-empty directory.
  }
}

function appendCommandLog(value, { cwd = process.cwd(), sessionId = sessionHint(), directory = logDirectory() } = {}) {
  try {
    const record = safeRecord(value);
    if (!record) {return;}
    const scope = digest(fs.realpathSync(cwd));
    const line = Buffer.from('\n' + JSON.stringify({ scope, ...(sessionId && { session: digest(sessionId) }), ...record }) + '\n');
    mkdirPrivate(directory);
    if (!privateDirectory(directory)) {return;}
    withWriter(directory, () => {
      const fd = openLog(directory, true);
      try {
        const header = Buffer.alloc(HEADER);
        const size = fs.fstatSync(fd).size;
        const length = fs.readSync(fd, header, 0, HEADER, 0);
        let offset = length === HEADER ? parseInt(header.toString(), 16) : HEADER;
        if (!(offset >= HEADER && offset <= Math.max(HEADER, size))) {offset = HEADER;}
        if (offset + line.length > LIMIT) {
          if (size > offset) {fs.writeSync(fd, Buffer.alloc(size - offset, 10), 0, size - offset, offset);}
          offset = HEADER;
        }
        fs.writeSync(fd, line, 0, line.length, offset);
        fs.writeSync(fd, (offset + line.length).toString(16).padStart(HEADER, '0'), 0, 'ascii');
      } finally {fs.closeSync(fd);}
    });
  } catch { /* Diagnostics never change CLI output or the command result. */ }
}

function readCommandLog({ cwd = process.cwd(), since, until, sessionId = sessionHint(), commandExecutionIds, directory = logDirectory() } = {}) {
  try {
    if ((since !== undefined && !Number.isFinite(since)) || (until !== undefined && !Number.isFinite(until)) || since > until) {return [];}
    if (commandExecutionIds !== undefined && (!Array.isArray(commandExecutionIds) || !commandExecutionIds.length ||
        !commandExecutionIds.every(id => typeof id === 'string' && UUID.test(id)))) {return [];}
    const selected = commandExecutionIds && new Set(commandExecutionIds);
    if (!sessionId && since === undefined && until === undefined && !selected) {return [];}
    if (!privateDirectory(directory)) {return [];}
    const scope = digest(fs.realpathSync(cwd));
    const session = sessionId ? digest(sessionId) : undefined;
    const fd = openLog(directory, false);
    let bytes;
    try {
      bytes = Buffer.alloc(Math.min(fs.fstatSync(fd).size, LIMIT));
      bytes = bytes.subarray(0, fs.readSync(fd, bytes, 0, bytes.length, 0));
    } finally {fs.closeSync(fd);}
    const records = [];
    for (const line of bytes.subarray(HEADER).toString().split('\n')) {
      if (!line.startsWith('{')) {continue;}
      let row;
      try {row = JSON.parse(line);} catch {continue;} // Incomplete frame at the circular cursor.
      if (row.scope !== scope || row.session !== session || (selected && !selected.has(row.commandExecutionId))) {continue;}
      const record = safeRecord(row);
      if (record && Date.parse(record.timestamp) >= (since ?? -Infinity) && Date.parse(record.timestamp) <= (until ?? Infinity)) {records.push(record);}
    }
    return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } catch {return [];}
}

module.exports = { appendCommandLog, readCommandLog, allowedCommand };
