'use strict';

const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');
const { default: babelTransform } = require('../core/babel-transform');
const { findProjectRoot } = require('../core/utils');
const { t } = require('../core/i18n');
const { info, success, error } = require('../core/chalk');

/**
 * 编译宜搭自定义页面 JSX/JS 源码。
 * @param {string} sourcePath
 * @returns {{ sourceCode: string, compiledCode: string, compiledPath: string }}
 */
function compileSource(sourcePath) {
  const sourceFileName = path.basename(sourcePath);
  const parsedPath = path.parse(sourcePath);
  const compiledFileName = `${parsedPath.name}.js`;
  const compiledPath = path.join(findProjectRoot(), 'pages', 'dist', compiledFileName);

  info(t('publish.reading_source', sourceFileName));
  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');

  info(t('publish.compiling', sourceFileName));
  const babelResult = babelTransform(sourceCode, {}, false, { RE_VERSION: '7.4.0' });
  if (babelResult.error instanceof Error) {
    const err = babelResult.error;
    let errorMsg = t('publish.compile_failed', err.message);
    if (err.loc) {
      errorMsg += t('publish.compile_location', err.loc.line, err.loc.column);
    }
    if (err.code) {
      errorMsg += t('publish.compile_error_code', err.code);
    }
    error(errorMsg);
  }

  info(t('publish.minifying', compiledFileName));
  const uglifyResult = UglifyJS.minify(babelResult.compiled);
  if (uglifyResult.error) {
    error(t('publish.minify_failed', uglifyResult.error.message || String(uglifyResult.error)));
  }

  const outputDir = path.dirname(compiledPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(compiledPath, uglifyResult.code, 'utf-8');
  success(t('publish.compile_done', compiledPath));

  return { sourceCode, compiledCode: uglifyResult.code, compiledPath };
}

module.exports = { compileSource };
