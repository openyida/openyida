'use strict';

const fs = require('fs');
const path = require('path');
const { lintYidaSource, printLintResult } = require('./page-linter');
const { buildPageSource, isAuthoringPath } = require('./page-compat');
const { t } = require('../core/i18n');
const { warn, error, hint } = require('../core/chalk');

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
    warn(t('cli.check_page_usage'));
    warn(t('cli.check_page_example'));
    process.exit(1);
  }

  const sourcePath = path.resolve(options.sourceFile);
  if (!fs.existsSync(sourcePath)) {
    error(t('publish.source_not_found', sourcePath));
  }

  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
  const shouldBuild = options.compat || isAuthoringPath(sourcePath);
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
    process.exit(1);
  }
}

module.exports = { run, parseArgs };
