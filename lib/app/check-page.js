'use strict';

const fs = require('fs');
const path = require('path');
const { lintYidaSource, printLintResult } = require('./page-linter');
const { buildPageSource, shouldBuildPageSource } = require('./page-compat');
const { warnLargePageSource } = require('./page-size-guard');
const { t } = require('../core/i18n');
const { warn, hint } = require('../core/chalk');
const { throwCommandError, throwUsage } = require('../core/command-errors');

function parseArgs(args) {
  return {
    json: args.includes('--json'),
    compat: args.includes('--compat') || args.includes('--modern'),
    sourceFile: args.find(arg => !arg.startsWith('--')),
  };
}

async function run(args) {
  const options = parseArgs(args || []);

  if (!options.sourceFile) {
    throwUsage(t('cli.check_page_usage'), t('cli.check_page_example'), {
      code: 'CHECK_PAGE_INVALID_ARGUMENTS',
    });
  }

  const sourcePath = path.resolve(options.sourceFile);
  if (!fs.existsSync(sourcePath)) {
    throwCommandError(t('publish.source_not_found', sourcePath), {
      code: 'CHECK_PAGE_SOURCE_NOT_FOUND',
      details: { sourcePath },
    });
  }

  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
  warnLargePageSource(sourceCode, sourcePath);
  const shouldBuild = shouldBuildPageSource(sourceCode, sourcePath, { modern: options.compat });
  const buildResult = shouldBuild
    ? buildPageSource(sourceCode, sourcePath, { modern: options.compat })
    : null;
  const lintResult = buildResult ? buildResult.lint : lintYidaSource(sourceCode, sourcePath);
  const buildErrors = buildResult && buildResult.errors ? buildResult.errors : [];
  const ok = buildErrors.length === 0 && lintResult.errors.length === 0;

  if (options.json) {
    console.log(JSON.stringify({
      ok,
      ...lintResult,
      build: buildResult ? {
        mode: buildResult.mode,
        fixes: buildResult.fixes,
        errors: buildResult.errors,
      } : null,
    }, null, 2));
  } else {
    if (buildResult) {
      buildResult.fixes.forEach((fix) => {
        hint(`  ${fix.rule}: ${fix.message}`);
      });
      buildErrors.forEach((issue) => {
        warn(`  ${issue.code}: ${issue.message}`);
      });
    }
    printLintResult(lintResult);
  }

  if (!ok) {
    throwCommandError(t('check_page.failed'), {
      code: 'CHECK_PAGE_FAILED',
      details: {
        errors: lintResult.errors,
        buildErrors,
      },
    });
  }
}

module.exports = { run, parseArgs };
