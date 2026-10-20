#!/usr/bin/env node
/**
 * Compatibility entry for the former hard-coded Solution Center demo runner.
 *
 * The implementation now delegates to the packaged, tenant-aware command so
 * it cannot silently create a parallel app from a fixed business form.
 */

'use strict';

const { run } = require('../lib/solution-template/solution-template');

const args = process.argv.slice(2);

if (args.includes('--execute') || args.includes('--dry-run') || args.includes('--inst-id') || args.includes('--limit')) {
  process.stderr.write([
    'The legacy form-backed runner has been retired.',
    'Use: openyida solution-template search --query <text> --json',
    'Then inspect one template and explicitly choose:',
    '  openyida solution-template ai-build <TPL_...> --json',
    '  openyida solution-template enable <TPL_...> --name <appName> [--with-data y|n] --json',
    'An uncertain enable must be checked with solution-template status before any retry.',
    '',
  ].join('\n'));
  process.exitCode = 2;
} else {
  run(args).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
