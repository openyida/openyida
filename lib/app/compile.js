'use strict';

const fs = require('fs');
const path = require('path');
const { compileSource } = require('./page-compiler');
const { runLintCheck } = require('./page-linter');
const { buildPageFile, shouldBuildPageSource } = require('./page-compat');
const { warnLargePageSource } = require('./page-size-guard');
const { t } = require('../core/i18n');
const { warn, info, step } = require('../core/chalk');
const { throwCommandError, throwUsage } = require('../core/command-errors');

/**
 * compile 命令：只编译自定义页面源码，不发布到宜搭。
 * @param {string[]} args
 */
async function run(args) {
  if (!args || args.length < 1) {
    throwUsage(t('cli.compile_usage'), t('cli.compile_example'), {
      code: 'COMPILE_INVALID_ARGUMENTS',
    });
  }

  const skipLint = args.includes('--skip-lint');
  const compat = args.includes('--compat') || args.includes('--modern');
  const filteredArgs = args.filter(arg => arg !== '--skip-lint' && arg !== '--compat' && arg !== '--modern');
  let sourcePath = path.resolve(filteredArgs[0]);
  if (!fs.existsSync(sourcePath)) {
    throwCommandError(t('publish.source_not_found', sourcePath), {
      code: 'COMPILE_SOURCE_NOT_FOUND',
      details: { sourcePath },
    });
  }

  const initialSourceCode = fs.readFileSync(sourcePath, 'utf-8');
  warnLargePageSource(initialSourceCode, sourcePath);
  if (shouldBuildPageSource(initialSourceCode, sourcePath, { modern: compat })) {
    info(t('build_page.preparing'));
    const buildResult = buildPageFile(sourcePath, { modern: compat, skipSizeWarning: true });
    if (!buildResult.ok) {
      buildResult.errors.forEach((issue) => warn(`${issue.code}: ${issue.message}`));
      throwCommandError(t('build_page.failed'), {
        code: 'COMPILE_BUILD_PAGE_FAILED',
        details: { errors: buildResult.errors },
      });
    }
    sourcePath = buildResult.outputPath;
    info(t('build_page.output', sourcePath));
  }

  if (!skipLint) {
    step(0, t('publish.step_lint'));
    const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
    const lintPassed = runLintCheck(sourceCode, sourcePath);
    if (!lintPassed) {
      throwCommandError(t('check_page.failed'), {
        code: 'COMPILE_LINT_FAILED',
        details: { sourcePath },
      });
    }
  } else {
    info(t('publish.lint_skipped'));
  }

  compileSource(sourcePath);
}

module.exports = { run };
