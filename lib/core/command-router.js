'use strict';

const { CliError } = require('./cli-error');

function createCommandContext(options) {
  return {
    command: options.command,
    args: options.args,
    version: options.version,
    t: options.t,
  };
}

function throwCliUsage(...lines) {
  throw new CliError(lines.filter(Boolean).join('\n'), {
    code: 'INVALID_ARGUMENTS',
  });
}

function throwNeedLogin(message) {
  throw new CliError(message, {
    code: 'NEED_LOGIN',
  });
}

module.exports = {
  createCommandContext,
  throwCliUsage,
  throwNeedLogin,
};
