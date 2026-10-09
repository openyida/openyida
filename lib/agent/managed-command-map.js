'use strict';

const { resolveManagedPolicy } = require('../core/managed-policy');

// Compatibility adapter for receipts and application checks. Scope and mutation
// metadata come from the same manifest consumed by the invocation guard.
function resolveManagedAppCommand(command, args = []) {
  if (args.includes('--help') || args.includes('-h')) {return null;}
  const selected = resolveManagedPolicy(command, args);
  if (selected?.policy.scope !== 'app') {return null;}
  const policy = selected.policy;
  let target;
  if (policy.appParser === 'prd-completeness') {
    const { parseArgs } = require('../app/check-prd-completeness');
    try {
      const parsed = parseArgs(args, { strict: true });
      if (!parsed.prdPath || !parsed.appType) {return null;}
      target = { appType: parsed.appType };
    } catch {return null;}
  } else {
    if (policy.sourcePosition !== undefined && (!args[policy.sourcePosition] || /^APP_/i.test(args[policy.sourcePosition]) || args[policy.sourcePosition].startsWith('-'))) {return null;}
    target = { appPosition: policy.appPosition };
  }
  const mutation = policy.mutation;
  return { ...target, ...(mutation ? { operation: mutation.operation,
    ...(mutation.formUuidPosition !== undefined ? { formUuid: values => values[mutation.formUuidPosition] } : {}) } : {}) };
}

function classifyManagedMutation(command, args = []) {
  const entry = resolveManagedAppCommand(command, args);
  return entry?.operation
    ? { operation: entry.operation, ...(entry.formUuid ? { formUuid: entry.formUuid(args) } : {}) }
    : null;
}

module.exports = { resolveManagedAppCommand, classifyManagedMutation };
