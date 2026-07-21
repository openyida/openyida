'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { schemaError } = require('./errors');
const { stableStringify } = require('./normalize-manifest');
const { createDefaultRegistry, isStagedAdapter } = require('./resource-registry');
const {
  createEmptyState,
  createEnvironmentIdentity,
  hashStable,
  getResourceState,
  upsertResourceState,
} = require('./state-store');

const APPLY_JOURNAL_KIND = 'openyida_schema_apply_operations';
const APPLY_STORE_CONTRACT_VERSION = 1;
const APPLY_LOCK_KIND = 'openyida_schema_apply_lock';
const APPLY_LOCK_CONTRACT_VERSION = 1;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ATOMIC_NONCE_PATTERN = /^[a-f0-9]{24}$/;
const OWNER_TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const OPERATION_STATUSES = new Set(['pending', 'completed', 'uncertain']);
const OPERATION_TYPES = new Set(['create', 'update', 'stateRepair']);
const APPLY_LOCK_HANDLES = new WeakMap();

function resolveApplyPaths(statePath) {
  const directory = path.dirname(statePath);
  return {
    lockPath: path.join(directory, 'apply.lock'),
    journalPath: path.join(directory, 'apply-operations.v1.json'),
  };
}

function resolveSafeApplyStatePath(statePath, workspaceRoot, options = {}) {
  const root = path.resolve(workspaceRoot || process.cwd());
  const target = path.isAbsolute(statePath)
    ? path.resolve(statePath)
    : path.resolve(root, statePath);
  assertSafeApplyPath(target, root, options);
  return target;
}

function resolveSafeApplyPaths(statePath, workspaceRoot, options = {}) {
  const root = path.resolve(workspaceRoot || process.cwd());
  const safeStatePath = resolveSafeApplyStatePath(statePath, root, options);
  const rawPaths = options.paths || resolveApplyPaths(safeStatePath);
  const paths = {};
  for (const key of ['lockPath', 'journalPath']) {
    if (typeof rawPaths[key] !== 'string' || !rawPaths[key]) {
      throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply path is invalid.');
    }
    paths[key] = path.isAbsolute(rawPaths[key])
      ? path.resolve(rawPaths[key])
      : path.resolve(root, rawPaths[key]);
    assertSafeApplyPath(paths[key], root, options);
  }
  return { statePath: safeStatePath, paths };
}

function assertSafeApplyPath(targetPath, workspaceRoot, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const root = path.resolve(workspaceRoot || process.cwd());
  const target = path.resolve(targetPath);
  if (target === root || !target.startsWith(root + path.sep)) {
    throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply path must stay inside the workspace.');
  }

  const relativeSegments = path.relative(root, target).split(path.sep);
  let current = root;
  for (const segment of relativeSegments) {
    current = path.join(current, segment);
    let exists;
    try {
      exists = fsImpl.existsSync(current);
    } catch (error) {
      throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply state path could not be verified.');
    }
    if (!exists) {
      break;
    }
    let stat;
    try {
      stat = fsImpl.lstatSync(current);
    } catch (error) {
      throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply state path could not be verified.');
    }
    if (stat.isSymbolicLink()) {
      throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply path must not traverse symbolic links.');
    }
  }
  return true;
}

function acquireApplyLock(lockPath, options = {}) {
  const owner = createLockOwner(options);
  assertSafeApplyPathIfConfigured(lockPath, options);
  const authority = createApplyLockAuthority(lockPath, options);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fileIdentity = createOwnershipFile(lockPath, owner, options);
      assertApplyLockAuthorityCurrent(authority, options.fsImpl || fs);
      return createLockHandle(lockPath, owner, options, fileIdentity, authority);
    } catch (error) {
      if (!error || error.code !== 'EEXIST') {
        if (error && error.code === 'SCHEMA_APPLY_PATH_UNSAFE') {
          throw error;
        }
        throw schemaError('SCHEMA_APPLY_LOCK_FAILED', 'Schema apply lock could not be acquired.');
      }
    }

    let reclaimed;
    try {
      reclaimed = reclaimStaleLock(lockPath, options);
    } catch (error) {
      if (error && error.code === 'SCHEMA_APPLY_PATH_UNSAFE') {
        throw error;
      }
      throw schemaError('SCHEMA_APPLY_LOCK_FAILED', 'Schema apply stale lock could not be checked.');
    }
    if (!reclaimed) {
      throw schemaError('SCHEMA_APPLY_LOCKED', 'Another schema apply holds the state lock.');
    }
  }

  throw schemaError('SCHEMA_APPLY_LOCKED', 'Another schema apply holds the state lock.');
}

function createLockOwner(options = {}) {
  const pid = options.processId === undefined ? process.pid : options.processId;
  const ownerToken = options.ownerToken || crypto.randomBytes(16).toString('hex');
  if (!Number.isInteger(pid) || pid <= 0 || !OWNER_TOKEN_PATTERN.test(ownerToken)) {
    throw schemaError('SCHEMA_APPLY_LOCK_FAILED', 'Schema apply lock owner is invalid.');
  }
  return Object.freeze({
    kind: APPLY_LOCK_KIND,
    contractVersion: APPLY_LOCK_CONTRACT_VERSION,
    ownerToken,
    pid,
  });
}

function createOwnershipFile(lockPath, owner, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const directory = path.dirname(lockPath);
  let fd;
  let fileIdentity;
  let created = false;
  try {
    assertSafeApplyPathIfConfigured(lockPath, options);
    fsImpl.mkdirSync(directory, { recursive: true, mode: 0o700 });
    assertSafeApplyPathIfConfigured(lockPath, options);
    fd = fsImpl.openSync(lockPath, 'wx', 0o600);
    created = true;
    if (typeof fsImpl.fstatSync === 'function') {
      fileIdentity = fsImpl.fstatSync(fd);
    }
    fsImpl.writeFileSync(fd, stableStringify(owner) + '\n', 'utf8');
    if (typeof fsImpl.fsyncSync === 'function') {
      fsImpl.fsyncSync(fd);
    }
    if (typeof fsImpl.fstatSync === 'function') {
      fileIdentity = fsImpl.fstatSync(fd);
    }
    fsImpl.closeSync(fd);
    fd = undefined;
    const finalIdentity = fsImpl.lstatSync(lockPath);
    if (!sameFileIdentityOrDefaultWindowsStatMatch(finalIdentity, fileIdentity, fsImpl)) {
      throw new Error('lock file generation changed');
    }
    return captureOwnershipFileIdentity(finalIdentity, fsImpl);
  } catch (error) {
    if (fd !== undefined) {
      try {
        fsImpl.closeSync(fd);
      } catch (closeError) {
        // Best effort close.
      }
    }
    if (created) {
      cleanupCreatedOwnershipFile(lockPath, fileIdentity, fsImpl);
    }
    throw error;
  }
}

function cleanupCreatedOwnershipFile(lockPath, fileIdentity, fsImpl) {
  try {
    const current = fsImpl.lstatSync(lockPath);
    if (fileIdentity && sameFileIdentityOrDefaultWindowsStatMatch(current, fileIdentity, fsImpl)) {
      fsImpl.unlinkSync(lockPath);
    }
  } catch (error) {
    // Best effort cleanup; ownership identity prevents deleting a replacement lock.
  }
}

function createLockHandle(lockPath, owner, options = {}, fileIdentity, authority = null) {
  const fsImpl = options.fsImpl || fs;
  const handleOptions = Object.freeze({ ...options, fsImpl });
  const handle = Object.freeze({
    assertOwned() {
      return assertApplyLockHandleOwned(handle);
    },
    release() {
      return releaseApplyLockHandle(handle);
    },
  });
  APPLY_LOCK_HANDLES.set(handle, {
    authority,
    fileIdentity,
    fsImpl,
    lockPath: path.resolve(lockPath),
    options: handleOptions,
    owner,
    released: false,
  });
  return handle;
}

function assertApplyLockHandleOwned(handle, expectedContext) {
  const state = handle && APPLY_LOCK_HANDLES.get(handle);
  if (!state || state.released) {
    throw schemaError('SCHEMA_APPLY_LOCK_LOST', 'Schema apply lock ownership was lost.');
  }
  try {
    assertSafeApplyPathIfConfigured(state.lockPath, state.options);
    assertApplyLockAuthorityCurrent(state.authority, state.fsImpl);
    assertExpectedApplyLockContext(state, expectedContext);
    assertCurrentLockFileIdentity(state);
    if (!ownersMatch(readLockOwner(state.lockPath, state.fsImpl), state.owner)) {
      throw new Error('lock ownership changed');
    }
    assertCurrentLockFileIdentity(state);
  } catch (error) {
    throw schemaError('SCHEMA_APPLY_LOCK_LOST', 'Schema apply lock ownership was lost.');
  }
  return true;
}

function releaseApplyLockHandle(handle) {
  const state = handle && APPLY_LOCK_HANDLES.get(handle);
  if (!state || state.released) {
    return;
  }
  state.released = true;
  try {
    assertSafeApplyPathIfConfigured(state.lockPath, state.options);
    assertApplyLockAuthorityCurrent(state.authority, state.fsImpl);
    assertCurrentLockFileIdentity(state);
    if (!removeOwnedLock(state.lockPath, state.owner, state.fsImpl, state.fileIdentity)) {
      throw new Error('lock ownership changed');
    }
  } catch (error) {
    throw schemaError('SCHEMA_APPLY_LOCK_RELEASE_FAILED', 'Schema apply lock could not be released.');
  }
}

function reclaimStaleLock(lockPath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const existing = readLockOwner(lockPath, fsImpl);
  if (!existing || isLockOwnerAlive(existing, options)) {
    return false;
  }

  const reclaimPath = `${lockPath}.reclaim`;
  assertSafeApplyPathIfConfigured(reclaimPath, options);
  const guard = acquireReclaimGuard(reclaimPath, options);
  if (!guard) {
    return false;
  }
  try {
    const current = readLockOwner(lockPath, fsImpl);
    if (!ownersMatch(current, existing) || isLockOwnerAlive(current, options)) {
      return false;
    }
    return removeOwnedLock(lockPath, existing, fsImpl);
  } finally {
    guard.release();
  }
}

function acquireReclaimGuard(reclaimPath, options = {}) {
  const owner = createLockOwner(options);
  try {
    const fileIdentity = createOwnershipFile(reclaimPath, owner, options);
    return createLockHandle(reclaimPath, owner, options, fileIdentity);
  } catch (error) {
    if (!error || error.code !== 'EEXIST') {
      throw error;
    }
  }

  const fsImpl = options.fsImpl || fs;
  const existing = readLockOwner(reclaimPath, fsImpl);
  if (!existing || isLockOwnerAlive(existing, options) || !removeOwnedLock(reclaimPath, existing, fsImpl)) {
    return null;
  }
  try {
    const fileIdentity = createOwnershipFile(reclaimPath, owner, options);
    return createLockHandle(reclaimPath, owner, options, fileIdentity);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      return null;
    }
    throw error;
  }
}

function readLockOwner(lockPath, fsImpl) {
  let value;
  try {
    value = JSON.parse(fsImpl.readFileSync(lockPath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    return null;
  }
  return isValidLockOwner(value) ? value : null;
}

function isValidLockOwner(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'contractVersion,kind,ownerToken,pid') {
    return false;
  }
  return (
    value.kind === APPLY_LOCK_KIND &&
    value.contractVersion === APPLY_LOCK_CONTRACT_VERSION &&
    OWNER_TOKEN_PATTERN.test(value.ownerToken) &&
    Number.isInteger(value.pid) &&
    value.pid > 0
  );
}

function isLockOwnerAlive(owner, options = {}) {
  const check = options.isProcessAlive || defaultIsProcessAlive;
  try {
    return check(owner.pid) !== false;
  } catch (error) {
    return true;
  }
}

function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !error || error.code !== 'ESRCH';
  }
}

function removeOwnedLock(lockPath, owner, fsImpl, expectedIdentity) {
  if (expectedIdentity && !sameFileIdentityOrDefaultWindowsStatMatch(fsImpl.lstatSync(lockPath), expectedIdentity, fsImpl)) {
    return false;
  }
  const current = readLockOwner(lockPath, fsImpl);
  if (!ownersMatch(current, owner)) {
    return false;
  }
  if (expectedIdentity && !sameFileIdentityOrDefaultWindowsStatMatch(fsImpl.lstatSync(lockPath), expectedIdentity, fsImpl)) {
    return false;
  }
  fsImpl.unlinkSync(lockPath);
  return true;
}

function ownersMatch(left, right) {
  return !!(
    left && right &&
    left.kind === right.kind &&
    left.contractVersion === right.contractVersion &&
    left.ownerToken === right.ownerToken &&
    left.pid === right.pid
  );
}

function sameFileIdentity(left, right) {
  return !!(
    hasReliableIdentity(left) &&
    hasReliableIdentity(right) &&
    left.dev === right.dev &&
    left.ino === right.ino
  );
}

function sameFileIdentityOrDefaultWindowsStatMatch(left, right, fsImpl) {
  if (sameFileIdentity(left, right)) {
    return true;
  }
  if (!isDefaultWindowsFs(fsImpl)) {
    return false;
  }
  return sameRegularFileStatFingerprint(left, right);
}

function sameRegularFileStatFingerprint(left, right) {
  return !!(
    left && right &&
    statLooksLikeRegularFile(left) &&
    statLooksLikeRegularFile(right) &&
    left.size === right.size &&
    sameStatTime(left.mtimeMs, right.mtimeMs) &&
    sameStatTime(left.ctimeMs, right.ctimeMs) &&
    sameStatTime(left.birthtimeMs, right.birthtimeMs)
  );
}

function statLooksLikeRegularFile(stat) {
  return typeof stat.isFile !== 'function' || stat.isFile();
}

function sameStatTime(left, right) {
  if (typeof left !== 'number' || typeof right !== 'number') {
    return left === right;
  }
  return Math.abs(left - right) <= 1;
}

function isDefaultWindowsFs(fsImpl) {
  if (process.platform !== 'win32') {
    return false;
  }
  return fsImpl === fs || !!(
    fsImpl &&
    fsImpl.lstatSync === fs.lstatSync &&
    fsImpl.fstatSync === fs.fstatSync &&
    fsImpl.realpathSync === fs.realpathSync
  );
}

function createApplyLockAuthority(lockPath, options) {
  if (!options.workspaceRoot) {
    return null;
  }
  const fsImpl = options.fsImpl || fs;
  const workspaceRoot = path.resolve(options.workspaceRoot);
  let before;
  let after;
  let beforeIdentity;
  let afterIdentity;
  try {
    before = fsImpl.lstatSync(workspaceRoot);
    if (
      before.isSymbolicLink() ||
      !before.isDirectory()
    ) {
      throw new Error('workspace generation is unsafe');
    }
    beforeIdentity = captureWorkspaceIdentity(before, resolveRealPath(fsImpl, workspaceRoot), fsImpl);
    after = fsImpl.lstatSync(workspaceRoot);
    afterIdentity = captureWorkspaceIdentity(after, resolveRealPath(fsImpl, workspaceRoot), fsImpl);
    if (
      after.isSymbolicLink() ||
      !after.isDirectory() ||
      !sameWorkspaceIdentity(after, beforeIdentity, fsImpl) ||
      afterIdentity.fingerprint !== beforeIdentity.fingerprint
    ) {
      throw new Error('workspace generation changed');
    }
  } catch (error) {
    throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply workspace could not be verified.');
  }
  const normalizedLockPath = path.resolve(lockPath);
  let statePath = null;
  if (options.statePath !== undefined) {
    statePath = resolveSafeApplyStatePath(options.statePath, workspaceRoot, { fsImpl });
    if (path.resolve(resolveApplyPaths(statePath).lockPath) !== normalizedLockPath) {
      throw schemaError('SCHEMA_APPLY_PATH_UNSAFE', 'Schema apply lock path is not canonical.');
    }
  }
  return Object.freeze({
    lockPath: normalizedLockPath,
    statePath,
    workspaceIdentity: afterIdentity,
    workspaceIdentityHash: createWorkspaceIdentityHash(afterIdentity),
    workspaceRoot,
  });
}

function assertApplyLockAuthorityCurrent(authority, fsImpl) {
  if (!authority) {
    return;
  }
  const current = fsImpl.lstatSync(authority.workspaceRoot);
  const currentIdentity = captureWorkspaceIdentity(current, resolveRealPath(fsImpl, authority.workspaceRoot), fsImpl);
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    !sameWorkspaceIdentity(current, authority.workspaceIdentity, fsImpl) ||
    currentIdentity.fingerprint !== authority.workspaceIdentity.fingerprint
  ) {
    throw new Error('workspace generation changed');
  }
}

function assertExpectedApplyLockContext(state, expected) {
  if (expected === undefined) {
    return;
  }
  const authority = state.authority;
  if (
    !isStrictLockContext(expected) ||
    !authority ||
    authority.lockPath !== path.resolve(expected.lockPath) ||
    authority.statePath !== path.resolve(expected.statePath) ||
    authority.workspaceRoot !== path.resolve(expected.workspaceRoot) ||
    authority.workspaceIdentityHash !== expected.workspaceGenerationHash
  ) {
    throw new Error('lock authority context changed');
  }
}

function isStrictLockContext(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length !== 0
  ) {
    return false;
  }
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'lockPath,statePath,workspaceGenerationHash,workspaceRoot') {
    return false;
  }
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => (
    descriptor.enumerable === true &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
    typeof descriptor.value === 'string'
  ));
}

function assertCurrentLockFileIdentity(state) {
  const current = state.fsImpl.lstatSync(state.lockPath);
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    !sameFileIdentityOrDefaultWindowsStatMatch(current, state.fileIdentity, state.fsImpl)
  ) {
    throw new Error('lock file generation changed');
  }
}

function captureFileIdentity(stat) {
  if (!hasReliableIdentity(stat)) {
    throw new Error('file identity is unavailable');
  }
  return Object.freeze({ dev: stat.dev, ino: stat.ino });
}

function captureOwnershipFileIdentity(stat, fsImpl) {
  if (isDefaultWindowsFs(fsImpl) && statLooksLikeRegularFile(stat)) {
    return Object.freeze({
      birthtimeMs: stat.birthtimeMs,
      ctimeMs: stat.ctimeMs,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      type: 'defaultWindowsFile',
    });
  }
  if (hasReliableIdentity(stat)) {
    return captureFileIdentity(stat);
  }
  throw new Error('file identity is unavailable');
}

function captureWorkspaceIdentity(stat, realPath, fsImpl) {
  if (isDefaultWindowsFs(fsImpl)) {
    const normalizedRealPath = normalizeRealPath(realPath);
    return Object.freeze({
      fingerprint: hashStable({
        realPath: normalizedRealPath,
        type: 'directory',
      }),
      realPath: normalizedRealPath,
      type: 'defaultWindowsDirectory',
    });
  }
  const fileIdentity = captureFileIdentity(stat);
  return Object.freeze({
    ...fileIdentity,
    fingerprint: createFileIdentityHash(fileIdentity),
    type: 'fileIdentity',
  });
}

function sameWorkspaceIdentity(stat, identity, fsImpl) {
  if (sameFileIdentity(stat, identity)) {
    return true;
  }
  if (
    !isDefaultWindowsFs(fsImpl) ||
    !identity ||
    identity.type !== 'defaultWindowsDirectory'
  ) {
    return false;
  }
  return (
    stat &&
    typeof stat.isDirectory === 'function' &&
    stat.isDirectory()
  );
}

function createWorkspaceIdentityHash(identity) {
  return identity.fingerprint;
}

function createFileIdentityHash(identity) {
  return hashStable({ dev: String(identity.dev), ino: String(identity.ino) });
}

function resolveRealPath(fsImpl, targetPath) {
  if (typeof fsImpl.realpathSync !== 'function') {
    return path.resolve(targetPath);
  }
  return fsImpl.realpathSync(targetPath);
}

function normalizeRealPath(realPath) {
  const normalized = path.resolve(realPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function hasReliableIdentity(stat) {
  return !!(
    stat &&
    isReliableIdentityValue(stat.dev) &&
    isReliableIdentityValue(stat.ino)
  );
}

function isReliableIdentityValue(value) {
  return (Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === 'bigint' && value >= 0n);
}

function assertSafeApplyPathIfConfigured(targetPath, options) {
  if (options.workspaceRoot) {
    assertSafeApplyPath(targetPath, options.workspaceRoot, options);
  }
}

function createApplyJournal(input) {
  const journal = {
    kind: APPLY_JOURNAL_KIND,
    contractVersion: APPLY_STORE_CONTRACT_VERSION,
    environment: createEnvironmentIdentity(input.environment),
    manifestHash: input.manifestHash,
    planId: input.planId,
    operations: {},
  };
  validateApplyJournal(journal, input);
  return journal;
}

function createApplyOperationId(input) {
  return hashStable({
    contractVersion: APPLY_STORE_CONTRACT_VERSION,
    planId: input.planId,
    resourceType: input.resourceType,
    key: input.key,
    operation: input.operation,
  });
}

function readApplyJournal(journalPath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  assertSafeApplyPathIfConfigured(journalPath, options);
  let exists;
  try {
    exists = fsImpl.existsSync(journalPath);
  } catch (error) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_READ_FAILED', 'Schema apply journal could not be read.');
  }
  if (!exists) {
    return null;
  }
  let raw;
  try {
    assertSafeApplyPathIfConfigured(journalPath, options);
    raw = fsImpl.readFileSync(journalPath, 'utf8');
  } catch (error) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_READ_FAILED', 'Schema apply journal could not be read.');
  }
  let journal;
  try {
    journal = JSON.parse(raw);
  } catch (error) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply journal is not valid JSON.');
  }
  validateApplyJournal(journal, options);
  return journal;
}

function writeApplyJournalAtomic(journalPath, journal, options = {}) {
  validateApplyJournal(journal, options);
  return writeJsonAtomic(journalPath, journal, {
    atomicNonce: options.atomicNonce,
    atomicNow: options.atomicNow,
    atomicProcessId: options.atomicProcessId,
    errorCode: 'SCHEMA_APPLY_JOURNAL_WRITE_FAILED',
    fsImpl: options.fsImpl,
    workspaceRoot: options.workspaceRoot,
  });
}

function updateJournalOperation(journal, operation, options = {}) {
  const next = clonePlain(journal);
  const id = `${operation.resourceType}:${operation.key}`;
  next.operations[id] = clonePlain(operation);
  validateApplyJournal(next, options);
  return next;
}

function removeJournalOperation(journal, operation, options = {}) {
  const next = clonePlain(journal);
  const id = `${operation.resourceType}:${operation.key}`;
  const current = next.operations[id];
  if (!current || current.operationId !== operation.operationId) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply journal operation changed before removal.');
  }
  delete next.operations[id];
  validateApplyJournal(next, options);
  return next;
}

function validateApplyJournal(journal, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  assertObject(journal, 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertAllowedKeys(journal, [
    'kind',
    'contractVersion',
    'environment',
    'manifestHash',
    'planId',
    'operations',
  ], 'SCHEMA_APPLY_JOURNAL_INVALID');
  if (journal.kind !== APPLY_JOURNAL_KIND || journal.contractVersion !== APPLY_STORE_CONTRACT_VERSION) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply journal contract is unsupported.');
  }
  const environment = createEnvironmentIdentity(journal.environment);
  if (options.environment) {
    const expected = createEnvironmentIdentity(options.environment);
    if (
      environment.environmentKey !== expected.environmentKey ||
      environment.corpIdHash !== expected.corpIdHash
    ) {
      throw schemaError('SCHEMA_STATE_ENVIRONMENT_MISMATCH', 'Schema apply journal belongs to a different environment.');
    }
  }
  assertHash(journal.manifestHash, 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertHash(journal.planId, 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertObject(journal.operations, 'SCHEMA_APPLY_JOURNAL_INVALID');

  for (const id of Object.keys(journal.operations)) {
    validateJournalOperation(id, journal.operations[id], {
      environment,
      planId: journal.planId,
      registry,
    });
  }
  return journal;
}

function validateJournalOperation(id, operation, options) {
  assertObject(operation, 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertAllowedKeys(operation, [
    'operationId',
    'resourceType',
    'key',
    'operation',
    'adapterVersion',
    'desiredHash',
    'status',
    'checkpoint',
    'createIdentity',
    'stateRevision',
    'stageCheckpoint',
    'suppressedErrors',
  ], 'SCHEMA_APPLY_JOURNAL_INVALID');
  if (`${operation.resourceType}:${operation.key}` !== id) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply journal operation key is inconsistent.');
  }
  assertHash(operation.operationId, 'SCHEMA_APPLY_JOURNAL_INVALID');
  if (operation.operationId !== createApplyOperationId({
    planId: options.planId,
    resourceType: operation.resourceType,
    key: operation.key,
    operation: operation.operation,
  })) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply journal operationId is inconsistent.');
  }
  assertHash(operation.desiredHash, 'SCHEMA_APPLY_JOURNAL_INVALID');
  if (!OPERATION_TYPES.has(operation.operation) || !OPERATION_STATUSES.has(operation.status)) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply journal operation status is invalid.');
  }
  const adapter = options.registry.get(operation.resourceType);
  if (operation.adapterVersion !== adapter.adapterVersion) {
    throw schemaError('SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED', 'Schema apply journal adapterVersion is unsupported.', {
      details: {
        resourceType: operation.resourceType,
        key: operation.key,
        stateAdapterVersion: operation.adapterVersion,
        adapterVersion: adapter.adapterVersion,
      },
    });
  }
  if (operation.status === 'completed' && !operation.checkpoint) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Completed schema apply operation requires a checkpoint.');
  }
  if (operation.stateRevision !== undefined && (
    !Number.isInteger(operation.stateRevision) || operation.stateRevision < 0
  )) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply operation State revision is invalid.');
  }
  if (operation.createIdentity !== undefined) {
    validateCreateIdentityCheckpoint(operation, adapter, options);
  }
  if (operation.stageCheckpoint !== undefined) {
    if (!isStagedAdapter(adapter) || operation.operation === 'stateRepair') {
      throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply staged checkpoint is not supported for this operation.');
    }
    adapter.validateStageCheckpoint(operation.stageCheckpoint, {
      desiredManagedHash: operation.desiredHash,
      operation: operation.operation,
      operationStatus: operation.status,
    });
  }
  if (
    operation.status === 'completed' &&
    operation.operation !== 'stateRepair' &&
    isStagedAdapter(adapter) &&
    operation.stageCheckpoint === undefined
  ) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Completed staged apply operation requires the completed stage.');
  }
  if (operation.checkpoint !== undefined) {
    validateOperationCheckpoint(operation, options);
  }
  if (operation.suppressedErrors !== undefined) {
    validateSuppressedErrors(operation.suppressedErrors);
  }
}

function validateSuppressedErrors(errors) {
  if (!Array.isArray(errors) || errors.length > 10) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply operation suppressed errors are invalid.');
  }
  for (const item of errors) {
    assertObject(item, 'SCHEMA_APPLY_JOURNAL_INVALID');
    assertAllowedKeys(item, [
      'code',
      'phase',
      'resourceType',
      'key',
      'errorCode',
      'adapterCode',
      'errorName',
    ], 'SCHEMA_APPLY_JOURNAL_INVALID');
    assertDiagnosticString(item.code, 120);
    assertDiagnosticString(item.phase, 120);
    assertDiagnosticString(item.resourceType, 80);
    assertDiagnosticString(item.key, 200);
    if (item.errorCode !== undefined) {
      assertDiagnosticCodeString(item.errorCode, 120);
    }
    if (item.adapterCode !== undefined) {
      assertDiagnosticCodeString(item.adapterCode, 120);
    }
    if (item.errorName !== undefined) {
      assertDiagnosticString(item.errorName, 80);
    }
  }
}

function assertDiagnosticString(value, maxLength) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply diagnostic string is invalid.');
  }
}

function assertDiagnosticCodeString(value, maxLength) {
  assertDiagnosticString(value, maxLength);
  if (!/^[A-Z0-9_:-]+$/.test(value)) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply diagnostic code is invalid.');
  }
}

function validateCreateIdentityCheckpoint(operation, adapter, options) {
  if (
    operation.operation !== 'create' ||
    operation.stateRevision === undefined ||
    typeof adapter.resumeCreate !== 'function'
  ) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema create identity checkpoint is not supported.');
  }
  const identity = operation.createIdentity;
  assertObject(identity, 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertAllowedKeys(identity, ['bindings'], 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertObject(identity.bindings, 'SCHEMA_APPLY_JOURNAL_INVALID');
  try {
    let state = createEmptyState(options.environment, { registry: options.registry });
    state = upsertResourceState(state, {
      resourceType: operation.resourceType,
      key: operation.key,
      adapterVersion: operation.adapterVersion,
      bindings: identity.bindings,
    }, { registry: options.registry });
    if (!getResourceState(state, operation.resourceType, operation.key)) {
      throw new Error('identity checkpoint missing');
    }
  } catch (error) {
    if (error && error.code === 'SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED') {
      throw error;
    }
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema create identity checkpoint is invalid.');
  }
}

function validateOperationCheckpoint(operation, options) {
  const checkpoint = operation.checkpoint;
  assertObject(checkpoint, 'SCHEMA_APPLY_JOURNAL_INVALID');
  assertAllowedKeys(checkpoint, [
    'adapterVersion',
    'bindings',
    'lastAppliedHash',
    'observedManagedHash',
    'remoteSchemaHash',
    'lastApplied',
  ], 'SCHEMA_APPLY_JOURNAL_INVALID');
  let state;
  try {
    state = createEmptyState(options.environment, { registry: options.registry });
    state = upsertResourceState(state, {
      resourceType: operation.resourceType,
      key: operation.key,
      ...checkpoint,
    }, { registry: options.registry });
  } catch (error) {
    if (error && error.code === 'SCHEMA_STATE_ADAPTER_VERSION_UNSUPPORTED') {
      throw error;
    }
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply checkpoint is invalid.');
  }
  if (!getResourceState(state, operation.resourceType, operation.key)) {
    throw schemaError('SCHEMA_APPLY_JOURNAL_INVALID', 'Schema apply checkpoint could not be validated.');
  }
}

function writeJsonAtomic(targetPath, value, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const directory = path.dirname(targetPath);
  let fd;
  let tmpPath;
  let tempCreated = false;
  try {
    tmpPath = createAtomicTempPath(targetPath, options);
    assertSafeApplyPathIfConfigured(targetPath, options);
    fsImpl.mkdirSync(directory, { recursive: true, mode: 0o700 });
    assertSafeApplyPathIfConfigured(targetPath, options);
    fd = fsImpl.openSync(tmpPath, 'wx', 0o600);
    tempCreated = true;
    fsImpl.writeFileSync(fd, stableStringify(value) + '\n', 'utf8');
    if (typeof fsImpl.fsyncSync === 'function') {
      fsImpl.fsyncSync(fd);
    }
    fsImpl.closeSync(fd);
    fd = undefined;
    fsImpl.renameSync(tmpPath, targetPath);
    fsyncDirectoryBestEffort(fsImpl, directory);
    return value;
  } catch (error) {
    if (fd !== undefined) {
      try {
        fsImpl.closeSync(fd);
      } catch (closeError) {
        // Best effort close.
      }
    }
    try {
      if (tempCreated && tmpPath && fsImpl.existsSync(tmpPath)) {
        fsImpl.unlinkSync(tmpPath);
      }
    } catch (unlinkError) {
      // Best effort cleanup.
    }
    if (error && error.code === 'SCHEMA_APPLY_PATH_UNSAFE') {
      throw error;
    }
    throw schemaError(options.errorCode, 'Schema apply file could not be written atomically.');
  }
}

function createAtomicTempPath(targetPath, options = {}) {
  const directory = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const pid = options.atomicProcessId === undefined ? process.pid : options.atomicProcessId;
  const now = options.atomicNow === undefined ? Date.now() : options.atomicNow;
  const nonce = options.atomicNonce || crypto.randomBytes(12).toString('hex');
  if (
    !Number.isInteger(pid) || pid <= 0 ||
    !Number.isSafeInteger(now) || now < 0 ||
    !ATOMIC_NONCE_PATTERN.test(nonce)
  ) {
    throw new Error('invalid atomic temp identity');
  }
  return path.join(directory, `.${base}.${pid}.${now}.${nonce}.tmp`);
}

function fsyncDirectoryBestEffort(fsImpl, directory) {
  if (typeof fsImpl.openSync !== 'function' || typeof fsImpl.fsyncSync !== 'function') {
    return;
  }
  let fd;
  try {
    fd = fsImpl.openSync(directory, 'r');
    fsImpl.fsyncSync(fd);
  } catch (error) {
    // Directory fsync is not portable.
  } finally {
    if (fd !== undefined) {
      try {
        fsImpl.closeSync(fd);
      } catch (closeError) {
        // Best effort close.
      }
    }
  }
}

function assertObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw schemaError(code, 'Schema apply store value must be an object.');
  }
}

function assertAllowedKeys(value, allowedKeys, code) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) {
      throw schemaError(code, 'Schema apply store contains an unknown property.');
    }
  }
}

function assertHash(value, code) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw schemaError(code, 'Schema apply store hash is invalid.');
  }
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = Object.freeze({
  APPLY_JOURNAL_KIND,
  APPLY_STORE_CONTRACT_VERSION,
  acquireApplyLock,
  assertApplyLockHandleOwned,
  assertSafeApplyPath,
  createApplyJournal,
  createApplyOperationId,
  readApplyJournal,
  removeJournalOperation,
  resolveApplyPaths,
  resolveSafeApplyPaths,
  resolveSafeApplyStatePath,
  updateJournalOperation,
  validateApplyJournal,
  writeApplyJournalAtomic,
});
