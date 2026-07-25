'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');
const { schemaError } = require('../../core/structured-error');

const PAGE_SOURCE_MAX_BYTES = 2 * 1024 * 1024;
const TRUSTED_SOURCES = new WeakSet();
const NATIVE_SOURCE_PATTERN = /\.(?:oyd|openyida)\.jsx$|\.jsx?$|\.js$/i;
const CANVAS_SOURCE_PATTERN = /\.canvas\.(?:jsx?|tsx?)$/i;
const NATIVE_PAGE_PROFILE = 'native/default';
const CANVAS_PAGE_PROFILE = 'canvas/default';

function loadPageSource(sourcePath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const maxBytes = options.maxBytes === undefined ? PAGE_SOURCE_MAX_BYTES : options.maxBytes;
  assertLoadInput(sourcePath, maxBytes);

  const rootPath = path.resolve(options.workspaceRoot || process.cwd());
  const rootRealPath = resolveRealPath(fsImpl, rootPath, 'SCHEMA_PAGE_SOURCE_PATH_UNSAFE');
  const absolutePath = path.resolve(rootRealPath, sourcePath);
  if (!isPathInside(rootRealPath, absolutePath)) {
    sourceError('SCHEMA_PAGE_SOURCE_PATH_UNSAFE', 'Page source must stay inside the workspace trust root.');
  }
  assertNoSymlinkSegments(fsImpl, rootRealPath, absolutePath);

  const initialRealPath = resolveRealPath(fsImpl, absolutePath, 'SCHEMA_PAGE_SOURCE_READ_FAILED');
  if (!isPathInside(rootRealPath, initialRealPath)) {
    sourceError('SCHEMA_PAGE_SOURCE_PATH_UNSAFE', 'Page source must stay inside the workspace trust root.');
  }
  const relativePath = normalizeRelativePath(path.relative(rootRealPath, initialRealPath));
  const profile = resolvePageSourceProfile(relativePath);

  let initialPathStat;
  try {
    initialPathStat = fsImpl.lstatSync(absolutePath);
  } catch (error) {
    sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source could not be read.');
  }
  if (initialPathStat.isSymbolicLink()) {
    sourceError('SCHEMA_PAGE_SOURCE_PATH_UNSAFE', 'Page source must not be a symbolic link.');
  }
  if (!initialPathStat.isFile()) {
    sourceError('SCHEMA_PAGE_SOURCE_INVALID', 'Page source must be a regular file.');
  }

  let fd;
  try {
    fd = fsImpl.openSync(absolutePath, resolveOpenFlags(fsImpl));
    const before = fsImpl.fstatSync(fd);
    if (!before || typeof before.isFile !== 'function' || !before.isFile()) {
      sourceError('SCHEMA_PAGE_SOURCE_INVALID', 'Page source must be a regular file.');
    }
    if (!sameFileIdentityOrDefaultWindowsStatMatch(initialPathStat, before, fsImpl)) {
      sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source changed while it was being opened.');
    }
    assertPageSourceSize(before.size, maxBytes);

    const buffer = readBounded(fsImpl, fd, maxBytes);
    const after = fsImpl.fstatSync(fd);
    if (
      !sameFileIdentityOrDefaultWindowsStatMatch(before, after, fsImpl) ||
      after.size !== before.size ||
      buffer.length !== after.size
    ) {
      sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source changed while it was being read.');
    }
    assertPageSourceSize(after.size, maxBytes);
    verifyPathAfterRead(fsImpl, rootRealPath, absolutePath, initialRealPath, after);

    const source = decodeUtf8(buffer);
    assertSafeText(source);
    const record = Object.freeze({
      byteLength: buffer.length,
      profile,
      relativePath,
      source,
      sourceHash: createSha256(source),
    });
    TRUSTED_SOURCES.add(record);
    return record;
  } catch (error) {
    if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
      throw error;
    }
    sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source could not be read.');
  } finally {
    if (fd !== undefined) {
      try {
        fsImpl.closeSync(fd);
      } catch (error) {
        // Preserve the original result or stable read error.
      }
    }
  }
}

function assertLoadInput(sourcePath, maxBytes) {
  if (
    typeof sourcePath !== 'string' ||
    !sourcePath ||
    sourcePath.includes('\0') ||
    path.isAbsolute(sourcePath) ||
    path.win32.isAbsolute(sourcePath) ||
    sourcePath.split(/[\\/]+/).includes('..')
  ) {
    sourceError('SCHEMA_PAGE_SOURCE_PATH_UNSAFE', 'Page source path must be workspace-relative.');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > PAGE_SOURCE_MAX_BYTES) {
    sourceError('SCHEMA_PAGE_SOURCE_INVALID', 'Page source size limit is invalid.');
  }
}

function resolvePageSourceProfile(relativePath) {
  if (CANVAS_SOURCE_PATTERN.test(relativePath)) {
    return CANVAS_PAGE_PROFILE;
  }
  if (NATIVE_SOURCE_PATTERN.test(relativePath)) {
    return NATIVE_PAGE_PROFILE;
  }
  sourceError('SCHEMA_PAGE_SOURCE_PROFILE_UNSUPPORTED', 'Page source must use a supported page source profile.');
}

function assertNoSymlinkSegments(fsImpl, rootRealPath, absolutePath) {
  const relative = path.relative(rootRealPath, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    sourceError('SCHEMA_PAGE_SOURCE_PATH_UNSAFE', 'Page source must stay inside the workspace trust root.');
  }
  let current = rootRealPath;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fsImpl.lstatSync(current);
    } catch (error) {
      sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source could not be read.');
    }
    if (stat.isSymbolicLink()) {
      sourceError('SCHEMA_PAGE_SOURCE_PATH_UNSAFE', 'Page source path must not traverse symbolic links.');
    }
  }
}

function verifyPathAfterRead(fsImpl, rootRealPath, absolutePath, initialRealPath, fdStat) {
  assertNoSymlinkSegments(fsImpl, rootRealPath, absolutePath);
  const currentRealPath = resolveRealPath(fsImpl, absolutePath, 'SCHEMA_PAGE_SOURCE_READ_FAILED');
  if (
    currentRealPath !== initialRealPath ||
    !isPathInside(rootRealPath, currentRealPath)
  ) {
    sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source changed while it was being read.');
  }
  let currentPathStat;
  try {
    currentPathStat = fsImpl.lstatSync(absolutePath);
  } catch (error) {
    sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source changed while it was being read.');
  }
  if (
    currentPathStat.isSymbolicLink() ||
    !sameFileIdentityOrDefaultWindowsStatMatch(currentPathStat, fdStat, fsImpl)
  ) {
    sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source changed while it was being read.');
  }
}

function readBounded(fsImpl, fd, maxBytes) {
  const buffer = Buffer.alloc(maxBytes + 1);
  let totalRead = 0;
  while (totalRead < buffer.length) {
    const bytesRead = fsImpl.readSync(fd, buffer, totalRead, buffer.length - totalRead, null);
    if (bytesRead === 0) {
      break;
    }
    totalRead += bytesRead;
    if (totalRead > maxBytes) {
      sourceError('SCHEMA_PAGE_SOURCE_TOO_LARGE', 'Page source exceeds the maximum supported size.', {
        limit: maxBytes,
      });
    }
  }
  return buffer.subarray(0, totalRead);
}

function assertPageSourceSize(size, maxBytes) {
  if (!Number.isSafeInteger(size) || size < 0) {
    sourceError('SCHEMA_PAGE_SOURCE_READ_FAILED', 'Page source size is invalid.');
  }
  if (size > maxBytes) {
    sourceError('SCHEMA_PAGE_SOURCE_TOO_LARGE', 'Page source exceeds the maximum supported size.', {
      limit: maxBytes,
    });
  }
}

function decodeUtf8(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    sourceError('SCHEMA_PAGE_SOURCE_INVALID', 'Page source must be valid UTF-8 text.');
  }
}

function assertSafeText(source) {
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      sourceError('SCHEMA_PAGE_SOURCE_INVALID', 'Page source contains unsafe control text.');
    }
  }
}

function resolveOpenFlags(fsImpl) {
  const constants = fsImpl.constants || fs.constants;
  let flags = constants.O_RDONLY;
  if (typeof constants.O_NOFOLLOW === 'number') {
    flags |= constants.O_NOFOLLOW;
  }
  return flags;
}

function resolveRealPath(fsImpl, targetPath, errorCode) {
  try {
    return fsImpl.realpathSync(targetPath);
  } catch (error) {
    sourceError(errorCode, 'Page source path could not be verified.');
  }
}

function sameFileIdentity(left, right) {
  return !!(
    left && right &&
    isReliableFileIdentityValue(left.dev) &&
    isReliableFileIdentityValue(left.ino) &&
    isReliableFileIdentityValue(right.dev) &&
    isReliableFileIdentityValue(right.ino) &&
    left.dev === right.dev &&
    left.ino === right.ino
  );
}

function sameFileIdentityOrDefaultWindowsStatMatch(left, right, fsImpl) {
  if (sameFileIdentity(left, right)) {
    return true;
  }
  if (process.platform !== 'win32' || fsImpl !== fs) {
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

function isReliableFileIdentityValue(value) {
  return (
    (Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === 'bigint' && value >= 0n)
  );
}

function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join('/');
}

function createSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function isLoadedPageSource(value) {
  return !!(value && typeof value === 'object' && TRUSTED_SOURCES.has(value));
}

function sourceError(code, message, details) {
  throw schemaError(code, message, details ? { details } : undefined);
}

module.exports = {
  CANVAS_PAGE_PROFILE,
  CANVAS_SOURCE_PATTERN,
  NATIVE_PAGE_PROFILE,
  NATIVE_SOURCE_PATTERN,
  PAGE_SOURCE_MAX_BYTES,
  isLoadedPageSource,
  loadPageSource,
  resolvePageSourceProfile,
};
