'use strict';

const crypto = require('crypto');
const { compileCanvasLocal } = require('../canvas-compile');
const { assertNoEmojiInText } = require('../../core/no-emoji-guard');
const { schemaError } = require('../../core/structured-error');
const { isLoadedPageSource } = require('./page-source-loader');

const CANVAS_PAGE_PROFILE = 'canvas/default';
const COMPILED_CANVAS_PAGES = new WeakSet();

function compileCanvasPageSource(loadedSource) {
  if (!isLoadedPageSource(loadedSource)) {
    compilerError('SCHEMA_PAGE_SOURCE_INVALID', 'Canvas page compiler requires a trusted page source.');
  }
  if (typeof loadedSource.source !== 'string' || loadedSource.source.trim() === '') {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Canvas page source did not pass local validation.', {
      stage: 'canvas',
    });
  }
  try {
    assertNoEmojiInText(loadedSource.source, {
      artifact: loadedSource.relativePath || 'Schema Canvas page source',
      code: 'SCHEMA_PAGE_SOURCE_EMOJI_FORBIDDEN',
    });
  } catch (error) {
    compilerError('SCHEMA_PAGE_SOURCE_EMOJI_FORBIDDEN', error.message, {
      stage: 'emoji',
      issues: error.details && error.details.issues,
    });
  }

  let canvasResult;
  try {
    canvasResult = compileCanvasLocal(loadedSource.source, {
      sourcePath: loadedSource.relativePath,
    });
  } catch (error) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Canvas page source could not be compiled.', {
      stage: 'canvas',
    });
  }

  if (
    !canvasResult ||
    typeof canvasResult.runtimeCode !== 'string' ||
    !canvasResult.runtimeCode ||
    !/\bYidaComp\b/.test(canvasResult.runtimeCode) ||
    typeof canvasResult.importedModules !== 'string' ||
    !isJsonArrayString(canvasResult.importedModules)
  ) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Canvas page output did not match the runtime contract.', {
      stage: 'canvas',
    });
  }

  const result = Object.freeze({
    compiledHash: createCanvasCompiledHash(
      canvasResult.runtimeCode,
      canvasResult.importedModules
    ),
    importedModules: canvasResult.importedModules,
    inputHash: loadedSource.sourceHash,
    profile: CANVAS_PAGE_PROFILE,
    runtimeCode: canvasResult.runtimeCode,
    source: loadedSource.source,
    sourceHash: createSha256(loadedSource.source),
  });
  COMPILED_CANVAS_PAGES.add(result);
  return result;
}

function isCompiledCanvasPage(value) {
  return !!(value && typeof value === 'object' && COMPILED_CANVAS_PAGES.has(value));
}

function createCanvasCompiledHash(runtimeCode, importedModules) {
  return createSha256(JSON.stringify({
    importedModules: String(importedModules || ''),
    runtimeCode: String(runtimeCode || ''),
  }));
}

function isJsonArrayString(value) {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

function createSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function compilerError(code, message, details) {
  throw schemaError(code, message, details ? { details } : undefined);
}

module.exports = {
  CANVAS_PAGE_PROFILE,
  compileCanvasPageSource,
  createCanvasCompiledHash,
  isCompiledCanvasPage,
};
