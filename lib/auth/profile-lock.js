'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CliError } = require('../core/cli-error');
const { resolveUserAuthDir } = require('./token-store');

const active = new Map();

function lockError() {
  return new CliError('auth profile is busy or its lock cannot be verified; retry after the active auth operation finishes', { code: 'AUTH_PROFILE_LOCKED' });
}

function ownerAt(lockPath) {
  try {
    const stat = fs.lstatSync(lockPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {return null;}
    const owner = JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
    return Number.isSafeInteger(owner.pid) && owner.pid > 0 && /^[a-f0-9]{32}$/.test(owner.nonce) ? owner : null;
  } catch {return null;}
}

function isAlive(pid) {
  try {process.kill(pid, 0); return true;} catch (error) {return error.code !== 'ESRCH';}
}

// Reapers serialize independently, then re-read the owner. A live or
// unverifiable lock is never stolen, even if old; PID reuse fails closed.
function reapDeadOwner(lockPath) {
  const reapPath = `${lockPath}.reaping`;
  try {fs.mkdirSync(reapPath, { mode: 0o700 });} catch {return;}
  try {
    const owner = ownerAt(lockPath);
    if (!owner || isAlive(owner.pid)) {return;}
    const retired = `${lockPath}.retired-${owner.nonce}`;
    fs.renameSync(lockPath, retired);
    fs.rmSync(retired, { recursive: true, force: true });
  } catch {
    // A racing release is harmless. Unknown ownership stays locked.
  } finally {
    fs.rmdirSync(reapPath);
  }
}

async function acquire(lockPath, options) {
  const timeoutMs = options.authLockTimeoutMs ?? 10000;
  const started = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const parent = path.dirname(lockPath);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {throw lockError();}
  for (;;) {
    try {
      if (fs.existsSync(`${lockPath}.reaping`)) {throw lockError();}
      fs.mkdirSync(lockPath, { mode: 0o700 });
      fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, nonce }), { mode: 0o600, flag: 'wx' });
      return () => {
        if (ownerAt(lockPath)?.nonce === nonce) {fs.rmSync(lockPath, { recursive: true, force: true });}
      };
    } catch (error) {
      if (error.code !== 'EEXIST' && error.code !== 'AUTH_PROFILE_LOCKED') {throw error;}
      reapDeadOwner(lockPath);
      if (Date.now() - started >= timeoutMs) {throw lockError();}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
}

function profileLockPath(profileId, options = {}) {
  const key = crypto.createHash('sha256').update(String(profileId)).digest('hex');
  return path.join(resolveUserAuthDir(options), '.locks', key);
}

function withProfileLock(profileId, options, operation) {
  const lockPath = profileLockPath(profileId, options);
  const previous = active.get(lockPath) || Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    const release = await acquire(lockPath, options);
    try {return await operation();} finally {release();}
  });
  active.set(lockPath, current);
  return current.finally(() => {
    if (active.get(lockPath) === current) {active.delete(lockPath);}
  });
}

module.exports = { withProfileLock, profileLockPath };
