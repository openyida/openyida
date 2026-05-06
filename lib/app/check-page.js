'use strict';

const fs = require('fs');
const path = require('path');
const { lintYidaSource, printLintResult } = require('./page-linter');
const { t } = require('../core/i18n');
const { warn, error } = require('../core/chalk');

function parseArgs(args) {
  return {
    json: args.includes('--json'),
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
  const lintResult = lintYidaSource(sourceCode, sourcePath);
  const ok = lintResult.errors.length === 0;

  if (options.json) {
    console.log(JSON.stringify({ ok, ...lintResult }, null, 2));
  } else {
    printLintResult(lintResult);
  }

  if (!ok) {
    process.exit(1);
  }
}

module.exports = { run, parseArgs };
