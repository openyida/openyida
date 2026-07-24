'use strict';

const crypto = require('crypto');
const UglifyJS = require('uglify-js');
const { default: babelTransform } = require('../../core/babel-transform');
const { buildPageSource } = require('../page-compat');
const { assertNoEmojiInText } = require('../../core/no-emoji-guard');
const { schemaError } = require('../../schema/errors');
const { isLoadedPageSource } = require('../../schema/page-source-loader');

const NATIVE_PAGE_PROFILE = 'native/default';
const COMPILED_PAGES = new WeakSet();

function compileNativePageSource(loadedSource) {
  if (!isLoadedPageSource(loadedSource)) {
    compilerError('SCHEMA_PAGE_SOURCE_INVALID', 'Native page compiler requires a trusted page source.');
  }

  let buildResult;
  try {
    buildResult = buildPageSource(
      loadedSource.source,
      loadedSource.relativePath,
      { modern: /\.oyd\.jsx$|\.openyida\.jsx$/i.test(loadedSource.relativePath) }
    );
  } catch (error) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Native page source could not be normalized.', {
      stage: 'normalize',
    });
  }
  if (!buildResult || buildResult.ok !== true || typeof buildResult.code !== 'string' || !buildResult.code) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Native page source did not pass local validation.', {
      stage: 'normalize',
    });
  }
  try {
    assertNoEmojiInText(buildResult.code, {
      artifact: loadedSource.relativePath || 'Schema native page source',
      code: 'SCHEMA_PAGE_SOURCE_EMOJI_FORBIDDEN',
    });
  } catch (error) {
    compilerError('SCHEMA_PAGE_SOURCE_EMOJI_FORBIDDEN', error.message, {
      stage: 'emoji',
      issues: error.details && error.details.issues,
    });
  }

  let babelResult;
  try {
    babelResult = babelTransform(buildResult.code, {}, false, { RE_VERSION: '7.4.0' });
  } catch (error) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Native page source could not be compiled.', {
      stage: 'babel',
    });
  }
  if (!babelResult || babelResult.error instanceof Error || typeof babelResult.compiled !== 'string') {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Native page source could not be compiled.', {
      stage: 'babel',
    });
  }

  let minified;
  try {
    minified = UglifyJS.minify(babelResult.compiled);
  } catch (error) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Native page output could not be minified.', {
      stage: 'minify',
    });
  }
  if (!minified || minified.error || typeof minified.code !== 'string' || !minified.code) {
    compilerError('SCHEMA_PAGE_SOURCE_COMPILE_FAILED', 'Native page output could not be minified.', {
      stage: 'minify',
    });
  }

  const result = Object.freeze({
    compiled: minified.code,
    compiledHash: createSha256(minified.code),
    inputHash: loadedSource.sourceHash,
    profile: NATIVE_PAGE_PROFILE,
    source: buildResult.code,
    sourceHash: createSha256(buildResult.code),
  });
  COMPILED_PAGES.add(result);
  return result;
}

function isCompiledNativePage(value) {
  return !!(value && typeof value === 'object' && COMPILED_PAGES.has(value));
}

function createSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function compilerError(code, message, details) {
  throw schemaError(code, message, details ? { details } : undefined);
}

module.exports = {
  NATIVE_PAGE_PROFILE,
  compileNativePageSource,
  isCompiledNativePage,
};
