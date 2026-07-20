'use strict';

const fs = require('fs');
const path = require('path');
const { schemaError } = require('./errors');
const {
  assertManifestCollectionSize,
  assertManifestFileSize,
  assertManifestNode,
  assertManifestStringLength,
  createManifestLimitState,
  formatJsonPointer,
  resolveManifestInputLimits,
} = require('./manifest-limits');

function loadManifest(manifestPath, options = {}) {
  if (!manifestPath || typeof manifestPath !== 'string') {
    throw schemaError('SCHEMA_INVALID_ARGUMENTS', 'Manifest path is required.');
  }

  const resolved = resolveManifestPath(manifestPath, options);
  const raw = readManifestFileBounded(resolved.realPath, options);

  detectDuplicateJsonKeys(raw, options);

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw schemaError('SCHEMA_MANIFEST_PARSE_FAILED', 'Manifest file must be valid JSON.', {
      details: {
        reason: error && error.message ? String(error.message).split('\n')[0] : 'Invalid JSON',
      },
    });
  }
}

function readManifestFileBounded(filePath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const limits = resolveManifestInputLimits(options);
  const readLimit = limits.maxBytes + 1;
  const flags = resolveOpenFlags(fsImpl);
  let fd;
  try {
    fd = fsImpl.openSync(filePath, flags);
    const stat = fsImpl.fstatSync(fd);
    if (!stat || typeof stat.isFile !== 'function' || !stat.isFile()) {
      throw schemaError('SCHEMA_MANIFEST_LOAD_FAILED', 'Unable to read manifest file.');
    }
    assertManifestFileSize(stat.size, { limits });

    const buffer = Buffer.alloc(readLimit);
    let totalRead = 0;
    while (totalRead < readLimit) {
      const bytesRead = fsImpl.readSync(fd, buffer, totalRead, readLimit - totalRead, null);
      if (bytesRead === 0) {
        break;
      }
      totalRead += bytesRead;
      if (totalRead > limits.maxBytes) {
        throw schemaError('SCHEMA_MANIFEST_TOO_LARGE', 'Manifest file exceeds the maximum supported size.', {
          path: '/',
          details: { limit: limits.maxBytes },
        });
      }
    }
    return buffer.toString('utf8', 0, totalRead);
  } catch (error) {
    if (error && error.code && String(error.code).startsWith('SCHEMA_')) {
      throw error;
    }
    throw schemaError('SCHEMA_MANIFEST_LOAD_FAILED', 'Unable to read manifest file.');
  } finally {
    if (fd !== undefined) {
      try {
        fsImpl.closeSync(fd);
      } catch {
        // Best effort close: keep the original read/validation error stable.
      }
    }
  }
}

function resolveOpenFlags(fsImpl) {
  const constants = fsImpl.constants || fs.constants || {};
  const readOnly = constants.O_RDONLY !== undefined ? constants.O_RDONLY : 'r';
  if (typeof readOnly === 'number' && typeof constants.O_NOFOLLOW === 'number') {
    return readOnly | constants.O_NOFOLLOW;
  }
  return readOnly;
}

function resolveManifestPath(manifestPath, options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || options.projectRoot || process.cwd());
  let rootRealPath;
  try {
    rootRealPath = fs.realpathSync(workspaceRoot);
  } catch {
    throw schemaError('SCHEMA_MANIFEST_PATH_UNSAFE', 'Manifest path must stay inside the workspace trust root.', {
      path: '/',
    });
  }

  const absolutePath = path.isAbsolute(manifestPath)
    ? path.resolve(manifestPath)
    : path.resolve(rootRealPath, manifestPath);
  const lexicallyInside = isPathInside(rootRealPath, absolutePath) ||
    (path.isAbsolute(manifestPath) && isPathInside(workspaceRoot, absolutePath));

  let realPath;
  try {
    realPath = fs.realpathSync(absolutePath);
  } catch {
    if (!lexicallyInside) {
      throw schemaError('SCHEMA_MANIFEST_PATH_UNSAFE', 'Manifest path must stay inside the workspace trust root.', {
        path: '/',
      });
    }
    throw schemaError('SCHEMA_MANIFEST_LOAD_FAILED', 'Unable to read manifest file.');
  }
  if (!isPathInside(rootRealPath, realPath)) {
    throw schemaError('SCHEMA_MANIFEST_PATH_UNSAFE', 'Manifest path must stay inside the workspace trust root.', {
      path: '/',
    });
  }

  return {
    realPath,
    rootRealPath,
  };
}

function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function detectDuplicateJsonKeys(source, options = {}) {
  let index = 0;
  const limitState = createManifestLimitState(options);

  function skipWhitespace() {
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }
  }

  function parseString(pathSegments) {
    let result = '';
    index += 1;
    while (index < source.length) {
      const char = source[index];
      if (char === '"') {
        index += 1;
        return result;
      }
      if (char === '\\') {
        index += 1;
        if (index >= source.length) {
          return result;
        }
        const escaped = source[index];
        if (escaped === 'u') {
          const hex = source.slice(index + 1, index + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += String.fromCharCode(parseInt(hex, 16));
            index += 5;
          } else {
            index += 1;
          }
          continue;
        }
        const escapeMap = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        result += Object.prototype.hasOwnProperty.call(escapeMap, escaped) ? escapeMap[escaped] : escaped;
        assertManifestStringLength(limitState, result, pathSegments);
        index += 1;
        continue;
      }
      result += char;
      assertManifestStringLength(limitState, result, pathSegments);
      index += 1;
    }
    return result;
  }

  function parseNumber() {
    const start = index;
    while (index < source.length && /[-+0-9.eE]/.test(source[index])) {
      index += 1;
    }
    if (index === start) {
      index += 1;
    }
  }

  function parseLiteral(value) {
    if (source.slice(index, index + value.length) === value) {
      index += value.length;
    } else {
      index += 1;
    }
  }

  function parseArray(pathSegments, depth) {
    index += 1;
    let itemIndex = 0;
    skipWhitespace();
    if (source[index] === ']') {
      index += 1;
      return;
    }
    while (index < source.length) {
      if (itemIndex + 1 > limitState.limits.maxCollectionItems) {
        assertManifestCollectionSize(limitState, itemIndex + 1, pathSegments);
      }
      parseValue(pathSegments.concat(String(itemIndex)), depth + 1);
      itemIndex += 1;
      skipWhitespace();
      if (source[index] === ',') {
        index += 1;
        continue;
      }
      if (source[index] === ']') {
        index += 1;
      }
      return;
    }
  }

  function parseObject(pathSegments, depth) {
    index += 1;
    const keys = new Set();
    skipWhitespace();
    if (source[index] === '}') {
      index += 1;
      return;
    }
    while (index < source.length) {
      skipWhitespace();
      if (source[index] !== '"') {
        return;
      }
      const key = parseString(pathSegments);
      assertManifestStringLength(limitState, key, pathSegments.concat(key));
      if (keys.has(key)) {
        throw schemaError('SCHEMA_DUPLICATE_KEY', 'Manifest contains duplicate JSON object keys.', {
          path: formatJsonPointer(pathSegments.concat(key)),
          details: { key },
        });
      }
      keys.add(key);
      assertManifestCollectionSize(limitState, keys.size, pathSegments);
      skipWhitespace();
      if (source[index] !== ':') {
        return;
      }
      index += 1;
      parseValue(pathSegments.concat(key), depth + 1);
      skipWhitespace();
      if (source[index] === ',') {
        index += 1;
        continue;
      }
      if (source[index] === '}') {
        index += 1;
      }
      return;
    }
  }

  function parseValue(pathSegments, depth) {
    skipWhitespace();
    assertManifestNode(limitState, pathSegments, depth);
    const char = source[index];
    if (char === '{') {
      parseObject(pathSegments, depth);
    } else if (char === '[') {
      parseArray(pathSegments, depth);
    } else if (char === '"') {
      parseString(pathSegments);
    } else if (char === 't') {
      parseLiteral('true');
    } else if (char === 'f') {
      parseLiteral('false');
    } else if (char === 'n') {
      parseLiteral('null');
    } else {
      parseNumber();
    }
  }

  parseValue([], 0);
}

module.exports = {
  detectDuplicateJsonKeys,
  isPathInside,
  loadManifest,
  readManifestFileBounded,
  resolveManifestPath,
};
