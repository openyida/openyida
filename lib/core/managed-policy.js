'use strict';

// Serializable execution scope belongs to each canonical command definition.
// This module interprets that schema; it contains no command allow/deny list.
function validateManagedPolicy(policy, id = 'command') {
  const fail = message => { throw new Error(`Invalid managedRun policy for ${id}: ${message}`); };
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {fail('missing declaration');}
  if (!['local', 'app', 'selected_input', 'actions', 'denied'].includes(policy.scope)) {fail('unknown scope');}
  const fields = {
    local: ['scope', 'allowedFlags', 'requiredFlags'],
    app: ['scope', 'appPosition', 'appParser', 'sourcePosition', 'mutation'],
    selected_input: ['scope', 'inputType', 'inputField'],
    actions: ['scope', 'actions'], denied: ['scope', 'reason'],
  };
  if (Object.keys(policy).some(field => !fields[policy.scope].includes(field))) {fail('unknown field');}
  if (policy.scope === 'denied' && !/^[a-z][a-z_]+$/.test(policy.reason || '')) {fail('denied requires a reason');}
  if (policy.scope === 'actions') {
    if (!policy.actions || typeof policy.actions !== 'object' || Array.isArray(policy.actions) || !Object.keys(policy.actions).length) {fail('actions requires explicit child policies');}
    for (const [action, child] of Object.entries(policy.actions)) {
      if (!/^[a-z][a-z0-9-]*$/.test(action) || child?.scope === 'actions') {fail('invalid or nested action');}
      validateManagedPolicy(child, `${id}.${action}`);
    }
  }
  if (policy.scope === 'app') {
    if (policy.appParser !== undefined) {
      if (policy.appParser !== 'prd-completeness' || policy.appPosition !== undefined) {fail('invalid app parser');}
    } else if (!Number.isInteger(policy.appPosition) || policy.appPosition < 0) {fail('app requires target position or parser');}
    if (policy.sourcePosition !== undefined && (!Number.isInteger(policy.sourcePosition) || policy.sourcePosition < 0)) {fail('invalid source position');}
  }
  if (policy.scope === 'selected_input' && (!({ ding_doc: 'docUrl', tingji: 'taskUuid' })[policy.inputType] || ({ ding_doc: 'docUrl', tingji: 'taskUuid' })[policy.inputType] !== policy.inputField)) {fail('invalid selected input');}
  for (const field of ['allowedFlags', 'requiredFlags']) {
    if (policy[field] !== undefined && (!Array.isArray(policy[field]) || policy[field].some(flag => !/^--[a-z][a-z-]*$/.test(flag)) || new Set(policy[field]).size !== policy[field].length)) {fail(`invalid ${field}`);}
  }
  if (policy.requiredFlags?.some(flag => !policy.allowedFlags?.includes(flag))) {fail('required flag is not allowed');}
  if (policy.mutation !== undefined) {
    if (policy.scope !== 'app' || !policy.mutation || typeof policy.mutation !== 'object' || Object.keys(policy.mutation).some(key => !['operation', 'formUuidPosition'].includes(key)) || !/^[a-z][a-z_]+$/.test(policy.mutation.operation || '') ||
        (policy.mutation.formUuidPosition !== undefined && (!Number.isInteger(policy.mutation.formUuidPosition) || policy.mutation.formUuidPosition < 0))) {fail('invalid mutation');}
  }
  return policy;
}

function resolveManagedPolicy(command, args = [], entries) {
  const candidates = entries || require('./command-manifest').flattenCommandManifest();
  const argv = [command, ...args];
  const matches = candidates.flatMap(entry => [entry.path, ...(entry.aliases || []).map(alias => alias.split(/\s+/))]
    .filter(path => path.every((token, index) => token === argv[index]))
    .map(path => ({ entry, path })));
  const match = matches.sort((a, b) => b.path.length - a.path.length)[0];
  if (!match) {return null;}
  let policy = match.entry.managedRun;
  let policyArgs = args.slice(match.path.length - 1);
  if (policy?.scope === 'actions') {
    policy = Object.prototype.hasOwnProperty.call(policy.actions, policyArgs[0])
      ? policy.actions[policyArgs[0]] : undefined;
    policyArgs = policyArgs.slice(1);
  }
  if (!policy) {return null;}
  return { entry: match.entry, policy, policyArgs };
}

function managedPolicySchema() {
  return {
    version: 1,
    fields: {
      scope: 'Managed task execution scope: local, app, selected_input, actions or denied.',
      appPosition: 'Application target index in arguments after the root command, including subcommands.',
      appParser: 'Registered strict parser for non-positional application targets.',
      sourcePosition: 'Source file index in arguments after the root command.',
      mutation: 'Successful remote mutation receipt: operation and optional formUuidPosition.',
      actions: 'Explicit policies for subcommands; unknown actions are not admitted.',
      inputType: 'User-selected input reference type.',
      inputField: 'Reference field checked against task input grants.',
      allowedFlags: 'When present, only these distinct flag-only arguments are admitted.',
      requiredFlags: 'Flags required for a restricted local variant.',
      reason: 'Stable diagnostic reason for a denied declaration.',
    },
    boundary: 'Applies only to runtime-injected managed tasks. Does not replace tool approval or platform authorization.',
  };
}

module.exports = { validateManagedPolicy, resolveManagedPolicy, managedPolicySchema };
