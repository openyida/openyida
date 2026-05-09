'use strict';

const fs = require('fs');
const path = require('path');
const { buildPageFile } = require('./page-compat');
const { printLintResult } = require('./page-linter');
const { warn, error, success, result, label, hint } = require('../core/chalk');
const { t } = require('../core/i18n');

function parseArgs(args) {
  const options = {
    sourceFile: '',
    output: '',
    write: false,
    json: false,
    modern: false,
  };

  for (let index = 0; index < (args || []).length; index++) {
    const arg = args[index];
    if (arg === '--output' && args[index + 1]) {
      options.output = args[++index];
      continue;
    }
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--modern' || arg === '--compat') {
      options.modern = true;
      continue;
    }
    if (!arg.startsWith('--') && !options.sourceFile) {
      options.sourceFile = arg;
    }
  }

  return options;
}

async function run(args) {
  const options = parseArgs(args || []);
  if (!options.sourceFile) {
    warn(t('cli.build_page_usage'));
    warn(t('cli.build_page_example'));
    process.exit(1);
  }

  const sourcePath = path.resolve(options.sourceFile);
  if (!fs.existsSync(sourcePath)) {
    error(t('publish.source_not_found', sourcePath));
  }

  const buildResult = buildPageFile(sourcePath, {
    output: options.output,
    write: options.write,
    modern: options.modern,
  });

  if (options.json) {
    console.log(JSON.stringify({
      ok: buildResult.ok,
      mode: buildResult.mode,
      sourcePath: buildResult.sourcePath,
      outputPath: buildResult.outputPath,
      fixes: buildResult.fixes,
      errors: buildResult.errors,
      lint: buildResult.lint,
    }, null, 2));
  } else {
    label('Source', buildResult.sourcePath);
    if (buildResult.outputPath) {
      label('Output', buildResult.outputPath);
    }
    buildResult.fixes.forEach((fix) => {
      hint(`  ${fix.rule}: ${fix.message}`);
    });
    buildResult.errors.forEach((issue) => {
      warn(`  ${issue.code}: ${issue.message}`);
    });
    if (buildResult.errors.length === 0) {
      printLintResult(buildResult.lint);
    }
  }

  if (!buildResult.ok) {
    process.exit(1);
  }

  if (!options.json) {
    success(t('build_page.success'));
    result(true, t('build_page.done'), [
      ['Output', buildResult.outputPath],
      ['Mode', buildResult.mode],
    ]);
  }
}

module.exports = {
  run,
  parseArgs,
};
