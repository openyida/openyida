'use strict';

const { readManagedContext, managedError } = require('./managed-context');
const { resolveManagedAppCommand } = require('./managed-command-map');

const IDENTITY_OPTIONS = new Set([
  '--profile', '--auth-profile', '--corp-id', '--user-id', '--client-id', '--endpoint', '--base-url',
  '--env', '--public', '--intl', '--international', '--overseas', '--global', '--yidaapps', '--alibaba',
  '--access-token', '--refresh-token', '--token', '--auth-dir', '--app-type', '--appType', '--app_type',
  '--system-token-app', '--connector-system-token-app',
]);
const LOCAL_COMMANDS = new Set(['commands', 'agent-capabilities', 'compile', 'build-page', 'check-page', 'sample']);
const READ_ONLY_LOGIN_OPTIONS = new Set(['--check-only', '--json', '--quiet']);

function assertManagedInvocation(command, args = [], options = {}) {
  const context = readManagedContext(options.env || process.env);
  if (!context) {return null;}
  // Before global flags, auto-update, and command modules with side effects.
  const scopeOptions = command === 'check-prd-completeness'
    ? require('../app/check-prd-completeness').APP_TYPE_OPTIONS : [];
  if (args.some(value => {
    const option = String(value).split('=')[0];
    return IDENTITY_OPTIONS.has(option) && !scopeOptions.includes(option);
  })) {
    throw managedError('MANAGED_OVERRIDE_FORBIDDEN', 'managed_override_forbidden');
  }
  if (LOCAL_COMMANDS.has(command) || ['--version', '-v'].includes(command)) {return context;}
  // Batch form creation uses this local status-only preflight. Never admit
  // login, refresh, URL inference or identity-changing options through it.
  if (command === 'login' && args.includes('--check-only') &&
      args.every(arg => READ_ONLY_LOGIN_OPTIONS.has(arg)) && new Set(args).size === args.length) {return context;}
  if (command === 'auth' && args[0] === 'status') {return context;}
  if (command === 'env' && args.every(arg => ['--json', '--quiet'].includes(arg))) {return context;}
  if (command === 'create-form' && ['icons', 'list-icons', 'validate-fields'].includes(args[0])) {return context;}
  if (command === 'formula' && args[0] === 'evaluate') {return context;}

  let entry = resolveManagedAppCommand(command, args);
  if (command === 'publish') {
    // Legacy APP/FORM/source ordering is deliberately unsupported here.
    if (!args[0] || /^APP_/i.test(args[0]) || args[0].startsWith('-')) {
      throw managedError('MANAGED_COMMAND_UNSUPPORTED', 'managed_command_unsupported');
    }
    entry = { appPosition: 1 };
  }
  if (!entry) {
    // Never infer scope from a prompt, arbitrary JSON, batch script or URL.
    // Extend this audited list with tests when supporting another command.
    throw managedError('MANAGED_COMMAND_UNSUPPORTED', 'managed_command_unsupported');
  }
  const appType = entry.appType === undefined ? args[entry.appPosition] : entry.appType;
  if (appType !== context.appType || (entry.appPosition !== undefined && args.slice(0, entry.appPosition).some(arg => arg.startsWith('-')))) {
    throw managedError('MANAGED_APP_MISMATCH', 'managed_app_mismatch');
  }
  return context;
}

module.exports = { assertManagedInvocation };
