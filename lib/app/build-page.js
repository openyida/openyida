'use strict';

const fs = require('fs');
const path = require('path');
const { buildPageFile } = require('./page-compat');
const { printLintResult } = require('./page-linter');
const { warn, success, result, label, hint } = require('../core/chalk');
const { t } = require('../core/i18n');
const { throwCommandError, throwUsage } = require('../core/command-errors');

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
    throwUsage(t('cli.build_page_usage'), t('cli.build_page_example'), {
      code: 'BUILD_PAGE_INVALID_ARGUMENTS',
    });
  }

  const sourcePath = path.resolve(options.sourceFile);
  if (!fs.existsSync(sourcePath)) {
    throwCommandError(t('publish.source_not_found', sourcePath), {
      code: 'BUILD_PAGE_SOURCE_NOT_FOUND',
      details: { sourcePath },
    });
  }

  const buildResult = buildPageFile(sourcePath, {
    output: options.output,
    write: options.write,
    modern: options.modern,
  });

  const throwBuildFailure = () => {
    const matchedPrimaryIssue = buildResult.errors.find(issue => issue.code === 'UNSUPPORTED_HOOK') || buildResult.errors[0];
    const primaryIssue = matchedPrimaryIssue ? JSON.parse(JSON.stringify(matchedPrimaryIssue)) : undefined;
    throwCommandError(t('build_page.failed'), {
      code: 'BUILD_PAGE_FAILED',
      details: {
        errors: buildResult.errors,
        primaryIssue,
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        sourceRepairable: buildResult.errors.length > 0,
        nextAction: {
          type: 'edit_source_then_recheck',
          commandId: 'check-page',
          args: { sourcePath },
        },
      },
    });
  };

  if (!buildResult.ok && options.json) {
    throwBuildFailure();
  }

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
    throwBuildFailure();
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
