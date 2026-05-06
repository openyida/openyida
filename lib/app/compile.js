'use strict';

const fs = require('fs');
const path = require('path');
const { compileSource } = require('./page-compiler');
const { runLintCheck } = require('./page-linter');
const { t } = require('../core/i18n');
const { warn, error, info, step } = require('../core/chalk');

/**
 * compile 命令：只编译自定义页面源码，不发布到宜搭。
 * @param {string[]} args
 */
async function run(args) {
  if (!args || args.length < 1) {
    warn(t('cli.compile_usage'));
    warn(t('cli.compile_example'));
    process.exit(1);
  }

  const skipLint = args.includes('--skip-lint');
  const filteredArgs = args.filter(arg => arg !== '--skip-lint');
  const sourcePath = path.resolve(filteredArgs[0]);
  if (!fs.existsSync(sourcePath)) {
    error(t('publish.source_not_found', sourcePath));
  }

  if (!skipLint) {
    step(0, t('publish.step_lint'));
    const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
    const lintPassed = runLintCheck(sourceCode, sourcePath);
    if (!lintPassed) {
      process.exit(1);
    }
  } else {
    info(t('publish.lint_skipped'));
  }

  compileSource(sourcePath);
}

module.exports = { run };
