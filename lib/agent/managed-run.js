'use strict';

const { readManagedContext, managedError } = require('./managed-context');
const { resolveManagedAppCommand } = require('./managed-command-map');
const { resolveManagedPolicy } = require('../core/managed-policy');

const IDENTITY_OPTIONS = new Set([
  '--profile', '--auth-profile', '--corp-id', '--user-id', '--client-id', '--endpoint', '--base-url',
  '--env', '--public', '--intl', '--international', '--overseas', '--global', '--yidaapps', '--alibaba',
  '--access-token', '--refresh-token', '--token', '--auth-dir', '--app-type', '--appType', '--app_type',
  '--system-token-app', '--connector-system-token-app',
]);
const HELP_OPTIONS = new Set(['--help', '-h', '--json', '--quiet']);

function resolveManagedHelp(command, args = [], options = {}) {
  if (command === 'agent' && args.length === 2 && args[0] === 'ask-human' && ['--help', '-h'].includes(args[1])) {
    return [{ path: ['agent', 'ask-human'],
      usage: 'openyida agent ask-human --request-key <稳定业务键> --questions-file <相对路径> --json',
      description: '在宜搭云端发起的本地 Agent 任务中提交结构化问题并等待网页回答。' }];
  }
  const topLevel = command === '--help' || command === '-h';
  const helpFlags = [command, ...args].filter(arg => arg === '--help' || arg === '-h');
  if (helpFlags.length !== 1 || typeof command !== 'string') {return null;}
  const flags = args.filter(arg => HELP_OPTIONS.has(arg));
  if (new Set(flags).size !== flags.length || args.some(arg => arg.startsWith('-') && !HELP_OPTIONS.has(arg))) {return null;}
  const path = topLevel ? [] : [command, ...args.filter(arg => !HELP_OPTIONS.has(arg))];
  if (topLevel && args.some(arg => !HELP_OPTIONS.has(arg))) {return null;}
  const manifest = require('../core/command-manifest').buildCommandManifest(options);
  const entries = manifest.commands.filter(entry => path.length <= entry.path.length &&
    path.every((token, index) => /^[a-z][a-z0-9-]*$/.test(token) && token === entry.path[index]));
  return entries.length ? entries : null;
}

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
  if ([command, ...args].some(arg => arg === '--help' || arg === '-h')) {
    if (resolveManagedHelp(command, args)) {return context;}
    throw managedError('MANAGED_COMMAND_UNSUPPORTED', 'managed_command_unsupported');
  }
  if (['--version', '-v'].includes(command)) {return context;}
  const selected = resolveManagedPolicy(command, args);
  const unsupported = reason => {
    throw managedError('MANAGED_COMMAND_UNSUPPORTED', 'managed_command_unsupported', {
      ...(selected ? { commandId: selected.entry.id } : {}), reason,
    });
  };
  if (!selected) {unsupported('command_or_action_unknown');}
  const { policy, policyArgs } = selected;
  if (policy.scope === 'denied') {unsupported(policy.reason);}
  if (policy.scope === 'local') {
    if (policy.allowedFlags && (policyArgs.some(arg => !policy.allowedFlags.includes(arg)) ||
        new Set(policyArgs).size !== policyArgs.length || policy.requiredFlags?.some(flag => !policyArgs.includes(flag)))) {
      unsupported('arguments_outside_declared_scope');
    }
    return context;
  }
  if (policy.scope === 'selected_input') {
    let inputs;
    try {inputs = JSON.parse((options.env || process.env).OPENYIDA_AGENT_INPUT_REFS || '[]');} catch {inputs = null;}
    const selectedInput = Array.isArray(inputs) && inputs.some(input => input.type === policy.inputType && input[policy.inputField] === policyArgs[0]);
    if (!selectedInput || policyArgs.length > 2 || (policyArgs[1] !== undefined && policyArgs[1] !== '--json')) {
      unsupported('input_not_selected_or_arguments_invalid');
    }
    return context;
  }
  const entry = resolveManagedAppCommand(command, args);
  if (!entry) {unsupported('application_target_unresolved');}
  const appType = entry.appType === undefined ? args[entry.appPosition] : entry.appType;
  if (appType !== context.appType || (entry.appPosition !== undefined && args.slice(0, entry.appPosition).some(arg => arg.startsWith('-')))) {
    throw managedError('MANAGED_APP_MISMATCH', 'managed_app_mismatch');
  }
  return context;
}

module.exports = { assertManagedInvocation, resolveManagedHelp };
