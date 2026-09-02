'use strict';

const { t } = require('../core/i18n');
const { safeJsonStringify } = require('../core/redact');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { updateConnectorAction } = require('./connector-action-update');

function usage() {
  return t('connector_update_action.usage');
}

function readFlagValue(args, index) {
  const value = args[index + 1];
  if (value === undefined || value === '' || String(value).startsWith('--')) {
    throwUsage(t('connector_update_action.invalid_arguments'), usage(), {
      code: 'CONNECTOR_UPDATE_ACTION_INVALID_ARGUMENTS',
    });
  }
  return value;
}

function parseArgs(args = []) {
  const options = { confirm: false, json: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case '--connector-id':
        options.connectorId = readFlagValue(args, index);
        index += 1;
        break;
      case '--action':
        options.operationId = readFlagValue(args, index);
        index += 1;
        break;
      case '--query-json':
        options.queryJson = readFlagValue(args, index);
        index += 1;
        break;
      case '--confirm':
        options.confirm = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throwUsage(t('connector_update_action.invalid_arguments'), usage(), {
          code: 'CONNECTOR_UPDATE_ACTION_INVALID_ARGUMENTS',
        });
    }
  }
  return options;
}

function parseQueryPatch(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throwUsage(t('connector_update_action.query_json_invalid'), usage(), {
      code: 'CONNECTOR_UPDATE_ACTION_QUERY_JSON_INVALID',
    });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
    throwUsage(t('connector_update_action.query_json_invalid'), usage(), {
      code: 'CONNECTOR_UPDATE_ACTION_QUERY_JSON_INVALID',
    });
  }
  return parsed;
}

async function run(args, dependencies) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage());
    return { success: true, help: true };
  }
  if (!options.connectorId || !options.operationId || !options.queryJson || !options.confirm) {
    throwUsage(t('connector_update_action.invalid_arguments'), usage(), {
      code: 'CONNECTOR_UPDATE_ACTION_INVALID_ARGUMENTS',
    });
  }
  const queryPatch = parseQueryPatch(options.queryJson);
  let result;
  try {
    result = await updateConnectorAction({
      connectorId: options.connectorId,
      operationId: options.operationId,
      queryPatch,
    }, dependencies);
  } catch (error) {
    throwCommandError(error.message, {
      code: error.code || 'CONNECTOR_UPDATE_ACTION_FAILED',
      details: {
        outcome: error.outcome,
        writeAttempted: error.writeAttempted === true,
      },
    });
  }
  if (options.json) {
    console.log(safeJsonStringify(result, 0));
  } else {
    console.log(t('connector_update_action.success', result.operationId, result.actionCount));
  }
  return result;
}

module.exports = {
  parseArgs,
  parseQueryPatch,
  run,
};
