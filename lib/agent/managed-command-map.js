'use strict';

// Single source of truth for Runtime-managed, app-scoped commands. `operation`
// is present only for successful writes that should notify the host to refresh.
// Commands without it remain admissible reads but never produce a receipt.
const DIRECT_COMMANDS = Object.freeze({
  'get-schema': { appPosition: 0 },
  'list-forms': { appPosition: 0 },
  'create-page': { appPosition: 0, operation: 'create_page' },
  'create-process': { appPosition: 0, operation: 'create_process' },
  'configure-process': { appPosition: 0, operation: 'update_process', formUuid: args => args[1] },
  'create-report': { appPosition: 0, operation: 'create_report' },
  'update-app': { appPosition: 0, operation: 'update_app_setting' },
  'get-form-config': { appPosition: 0 },
  'get-page-config': { appPosition: 0 },
  'verify-short-url': { appPosition: 0 },
  'update-form-config': { appPosition: 0, operation: 'update_form_config', formUuid: args => args[1] },
  'save-permission': { appPosition: 0, operation: 'update_form_permission', formUuid: args => args[1] },
  'save-share-config': { appPosition: 0, operation: 'update_share_config', formUuid: args => args[1] },
});

const ACTION_COMMANDS = Object.freeze({
  process: Object.freeze({
    appPosition: 1,
    actions: Object.freeze({ preview: {} }),
  }),
  integration: Object.freeze({
    appPosition: 1,
    actions: Object.freeze({
      list: {}, check: {},
      // The command currently reports an explicit capability blocker and does
      // not mutate a remote flow. Do not turn that probe into a write receipt.
      update: {},
      create: { operation: 'create_process' },
      enable: { operation: 'update_process', formUuid: args => args[2] },
      disable: { operation: 'update_process', formUuid: args => args[2] },
    }),
  }),
  report: Object.freeze({
    appPosition: 1,
    actions: Object.freeze({ inspect: {} }),
  }),
  'create-form': Object.freeze({
    appPosition: 1,
    actions: Object.freeze({
      create: { operation: 'create_form' },
      batch: { operation: 'create_form' },
      update: { operation: 'update_form', formUuid: args => args[2] },
      patch: { operation: 'update_form', formUuid: args => args[2] },
      rule: { operation: 'update_form', formUuid: args => args[2] },
      validation: { operation: 'update_form', formUuid: args => args[2] },
      'bind-datasource': { operation: 'update_form', formUuid: args => args[2] },
      'add-option': { operation: 'update_form', formUuid: args => args[2] },
    }),
  }),
  'nav-group': Object.freeze({
    appPosition: 1,
    actions: Object.freeze({
      list: {}, create: { operation: 'update_nav' }, rename: { operation: 'update_nav' },
      delete: { operation: 'update_nav' }, move: { operation: 'update_nav' },
      order: { operation: 'update_nav' }, 'auto-order': { operation: 'update_nav' },
      hide: { operation: 'update_nav' }, show: { operation: 'update_nav' },
    }),
  }),
  'app-permission': Object.freeze({
    appPosition: 1,
    actions: Object.freeze({
      get: {}, set: { operation: 'update_app_permission' },
      add: { operation: 'update_app_permission' }, remove: { operation: 'update_app_permission' },
    }),
  }),
  'ai-form-setting': Object.freeze({
    appPosition: 1,
    actions: Object.freeze({
      get: {}, fields: {}, models: {}, enable: { operation: 'update_form_config' },
      disable: { operation: 'update_form_config' }, save: { operation: 'update_form_config' },
    }),
  }),
  'aggregate-table': Object.freeze({
    appPosition: 1,
    actions: Object.freeze({
      list: {}, inspect: {}, preview: {}, status: {}, 'create-empty': { operation: 'create_report' },
      save: { operation: 'create_report' }, publish: { operation: 'create_report' },
    }),
  }),
});

function resolveManagedAppCommand(command, args = []) {
  if (args.includes('--help') || args.includes('-h')) {return null;}
  if (command === 'check-prd-completeness') {
    // Reuse the command parser, not a second app/flag interpretation. This is
    // an audited readback and deliberately has no Mutation operation.
    const { parseArgs } = require('../app/check-prd-completeness');
    try {
      const parsed = parseArgs(args, { strict: true });
      return parsed.prdPath && parsed.appType ? { appType: parsed.appType } : null;
    } catch {
      return null;
    }
  }
  if (command === 'publish') {
    return { appPosition: 1, operation: 'publish_page', formUuid: values => values[2] };
  }
  const direct = DIRECT_COMMANDS[command];
  if (direct) {return direct;}
  const family = ACTION_COMMANDS[command];
  return family?.actions[args[0]] ? { appPosition: family.appPosition, ...family.actions[args[0]] } : null;
}

function classifyManagedMutation(command, args = []) {
  const entry = resolveManagedAppCommand(command, args);
  return entry?.operation
    ? { operation: entry.operation, ...(entry.formUuid ? { formUuid: entry.formUuid(args) } : {}) }
    : null;
}

module.exports = { DIRECT_COMMANDS, ACTION_COMMANDS, resolveManagedAppCommand, classifyManagedMutation };
