'use strict';

const { CliError } = require('./cli-error');

function joinMessage(lines) {
  return lines.filter(Boolean).join('\n');
}

function throwUsage(usage, example, options = {}) {
  throw new CliError(joinMessage([usage, example]), {
    code: options.code || 'CLI_INVALID_ARGUMENTS',
    exitCode: options.exitCode || 1,
    usage: example,
    details: options.details,
  });
}

function throwCommandError(message, options = {}) {
  throw new CliError(message, {
    code: options.code || 'CLI_COMMAND_FAILED',
    exitCode: options.exitCode || 1,
    details: options.details,
    usage: options.usage,
  });
}

function throwStatus(message, exitCode, options = {}) {
  throwCommandError(message, {
    ...options,
    exitCode,
  });
}

module.exports = {
  throwUsage,
  throwCommandError,
  throwStatus,
};
