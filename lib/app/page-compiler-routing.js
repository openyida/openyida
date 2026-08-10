'use strict';

const { CliError } = require('../core/cli-error');

const PAGE_COMPILER_MODE_CANVAS = 'canvas';
const PAGE_COMPILER_MODE_NATIVE = 'native';
const CANVAS_PAGE_PROFILE = 'canvas/default';
const NATIVE_PAGE_PROFILE = 'native/default';
const CANVAS_SOURCE_PATTERN = /\.canvas\.(?:jsx?|tsx?)$/i;
const NATIVE_SOURCE_PATTERN = /\.(?:oyd|openyida)\.jsx$|\.jsx?$|\.js$/i;

function isCanvasSourcePath(sourcePath) {
  return CANVAS_SOURCE_PATTERN.test(String(sourcePath || ''));
}

function resolvePageCompilerMode(sourcePath, options = {}) {
  if (options.forceCanvas === true) {
    return PAGE_COMPILER_MODE_CANVAS;
  }
  return isCanvasSourcePath(sourcePath)
    ? PAGE_COMPILER_MODE_CANVAS
    : PAGE_COMPILER_MODE_NATIVE;
}

function assertPageCompilerMode(sourcePath, compilerMode, options = {}) {
  const requiredMode = resolvePageCompilerMode(sourcePath, options);
  if (requiredMode === compilerMode) {
    return requiredMode;
  }
  throw new CliError(
    `页面编译器选择错误：${sourcePath} 必须使用 ${requiredMode} 编译器，不能使用 ${compilerMode} 编译器。`
      + '请直接执行 openyida check-page、openyida compile 或 openyida publish，CLI 会按文件后缀自动选择。',
    {
      code: 'OPENYIDA_PAGE_COMPILER_MISMATCH',
      details: {
        stage: 'compiler_routing',
        sourcePath: String(sourcePath || ''),
        expectedMode: requiredMode,
        actualMode: compilerMode,
      },
    }
  );
}

module.exports = {
  CANVAS_PAGE_PROFILE,
  CANVAS_SOURCE_PATTERN,
  NATIVE_PAGE_PROFILE,
  NATIVE_SOURCE_PATTERN,
  PAGE_COMPILER_MODE_CANVAS,
  PAGE_COMPILER_MODE_NATIVE,
  assertPageCompilerMode,
  isCanvasSourcePath,
  resolvePageCompilerMode,
};
