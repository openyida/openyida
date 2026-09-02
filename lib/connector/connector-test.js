/**
 * connector test - 按前端 canonical contract 测试连接器动作。
 */

'use strict';

const { t } = require('../core/i18n');
const { redactString, safeJsonStringify } = require('../core/redact');
const {
  getAuthRef,
  findConnectorById,
  getConnectorDetail,
  listConnections,
  testConnector,
} = require('./api');
const { HTTP_CONNECTOR_MODE, connectorRequiresAuth } = require('./contract');

const PARAM_LOCATIONS = ['path', 'query', 'header', 'body'];

function commandError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function showUsage() {
  console.log(t('connector_test.usage'));
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h': options.help = true; break;
      case '--connector-id': options.connectorId = args[++i]; break;
      case '--action': options.actionId = args[++i]; break;
      case '--params': options.params = args[++i]; break;
      case '--path-json': options.pathJson = args[++i]; break;
      case '--query-json': options.queryJson = args[++i]; break;
      case '--header-json': options.headerJson = args[++i]; break;
      case '--body-json': options.bodyJson = args[++i]; break;
      case '--account-id': options.accountId = args[++i]; break;
      case '--json': options.json = true; break;
    }
  }
  return options;
}

function parseJsonObject(value, flagName, allowAny = false) {
  if (value === undefined) {return undefined;}
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw commandError('CONNECTOR_TEST_JSON_INVALID', t('connector_test.invalid_json', flagName, error.message));
  }
  if (!allowAny && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
    throw commandError('CONNECTOR_TEST_JSON_OBJECT_REQUIRED', t('connector_test.json_object_required', flagName));
  }
  return parsed;
}

function defaultParamValue(param) {
  if (Object.prototype.hasOwnProperty.call(param, 'value')) {return param.value;}
  if (Object.prototype.hasOwnProperty.call(param, 'defaultValue')) {return param.defaultValue;}
  return param.queryDefaultValue && param.queryDefaultValue.defaultValue !== undefined
    ? param.queryDefaultValue.defaultValue
    : '';
}

function buildDefaults(operation) {
  const params = { path: {}, query: {}, header: {}, body: {} };
  const definitions = operation.parameters && typeof operation.parameters === 'object'
    ? operation.parameters
    : {};
  for (const location of ['path', 'query', 'header']) {
    const entries = Array.isArray(definitions[location]) ? definitions[location] : [];
    for (const entry of entries) {
      if (entry && entry.name) {params[location][entry.name] = defaultParamValue(entry);}
    }
  }
  if (definitions.body && Object.prototype.hasOwnProperty.call(definitions.body, 'default')) {
    const bodyDefault = definitions.body.default;
    if (typeof bodyDefault === 'string') {
      try {params.body = JSON.parse(bodyDefault);} catch {params.body = bodyDefault;}
    } else {
      params.body = bodyDefault;
    }
  }
  return params;
}

function inferInputLocation(input) {
  if (PARAM_LOCATIONS.includes(input && input.paramLocation)) {return input.paramLocation;}
  const name = String(input && input.name || '').toLowerCase();
  return PARAM_LOCATIONS.find(location => name === location || name === `${location}s`) || null;
}

function collectSchemaLocations(operation) {
  const locations = new Map();
  function record(name, location) {
    if (!name || !PARAM_LOCATIONS.includes(location)) {return;}
    if (!locations.has(name)) {locations.set(name, new Set());}
    locations.get(name).add(location);
  }
  for (const input of Array.isArray(operation.inputs) ? operation.inputs : []) {
    const location = inferInputLocation(input);
    for (const child of Array.isArray(input.childList) ? input.childList : []) {
      record(child.name, child.paramLocation || location);
    }
  }
  const definitions = operation.parameters && typeof operation.parameters === 'object'
    ? operation.parameters
    : {};
  for (const location of ['path', 'query', 'header']) {
    for (const entry of Array.isArray(definitions[location]) ? definitions[location] : []) {
      record(entry && entry.name, location);
    }
  }
  return locations;
}

function mergeLocation(params, location, value) {
  if (value === undefined) {return;}
  if (location === 'body' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    params.body = value;
    return;
  }
  if (!params[location] || typeof params[location] !== 'object' || Array.isArray(params[location])) {
    params[location] = {};
  }
  Object.assign(params[location], value);
}

function buildTestParams(operation, options = {}) {
  const params = buildDefaults(operation);
  const flat = parseJsonObject(options.params, '--params');
  if (flat) {
    const schemaLocations = collectSchemaLocations(operation);
    for (const [name, value] of Object.entries(flat)) {
      const candidates = schemaLocations.get(name);
      if (!candidates || candidates.size === 0) {
        throw commandError('CONNECTOR_TEST_PARAM_UNKNOWN', t('connector_test.unknown_flat_param', name));
      }
      if (candidates.size !== 1) {
        throw commandError('CONNECTOR_TEST_PARAM_AMBIGUOUS', t('connector_test.ambiguous_flat_param', name));
      }
      const [location] = candidates;
      if (!params[location] || typeof params[location] !== 'object' || Array.isArray(params[location])) {
        params[location] = {};
      }
      params[location][name] = value;
    }
  }
  mergeLocation(params, 'path', parseJsonObject(options.pathJson, '--path-json'));
  mergeLocation(params, 'query', parseJsonObject(options.queryJson, '--query-json'));
  mergeLocation(params, 'header', parseJsonObject(options.headerJson, '--header-json'));
  mergeLocation(params, 'body', parseJsonObject(options.bodyJson, '--body-json', true));
  return params;
}

function connectionId(connection) {
  return connection && (connection.id || connection.connectionId);
}

function resolveOwnedConnection(options) {
  const accounts = Array.isArray(options.accounts) ? options.accounts : [];
  if (!options.accountId) {
    if (options.requiresAuth) {
      throw commandError('CONNECTOR_AUTH_ACCOUNT_REQUIRED', t('connector_test.auth_account_required'));
    }
    return null;
  }
  const owned = accounts.find(account => {
    const sameId = String(connectionId(account)) === String(options.accountId);
    const accountConnectorName = account.connectorName;
    return sameId && (!accountConnectorName || accountConnectorName === options.connectorName);
  });
  if (!owned) {
    throw commandError('CONNECTOR_AUTH_ACCOUNT_NOT_OWNED', t('connector_test.auth_account_not_owned', options.accountId));
  }
  return owned;
}

async function run(args) {
  const options = parseArgs(args || []);
  if (options.help || !options.connectorId || !options.actionId) {
    showUsage();
    if (options.help) {return;}
    throw commandError('CONNECTOR_TEST_ARGUMENT_REQUIRED', t('connector_test.arguments_required'));
  }
  const authRef = getAuthRef();
  const connector = await findConnectorById(options.connectorId, authRef);
  if (!connector) {
    throw commandError('CONNECTOR_NOT_FOUND', t('connector_test.connector_not_found', options.connectorId));
  }
  const detail = await getConnectorDetail({
    id: connector.id,
    connectorName: connector.connectorName,
    connectorMode: connector.connectorMode || HTTP_CONNECTOR_MODE,
  }, authRef);
  let operations;
  try {
    operations = typeof detail.operations === 'string' ? JSON.parse(detail.operations) : (detail.operations || []);
  } catch {
    throw commandError('CONNECTOR_OPERATIONS_INVALID', t('connector_test.operations_invalid'));
  }
  const operation = operations.find(op => op.operationId === options.actionId);
  if (!operation) {
    throw commandError('CONNECTOR_ACTION_NOT_FOUND', t('connector_test.action_not_found', options.actionId));
  }
  const requiresAuth = connectorRequiresAuth(detail.securitySchemes);
  const accounts = requiresAuth || options.accountId
    ? await listConnections(connector.connectorName, authRef)
    : [];
  const ownedConnection = resolveOwnedConnection({
    requiresAuth,
    accountId: options.accountId,
    accounts,
    connectorName: connector.connectorName,
  });
  const testParams = buildTestParams(operation, options);
  const response = await testConnector({
    connector: detail,
    operation,
    header: testParams.header,
    query: testParams.query,
    path: testParams.path,
    body: testParams.body,
    authId: ownedConnection ? connectionId(ownedConnection) : undefined,
  }, authRef);
  const result = { success: true, ...response };
  if (options.json) {
    console.log(safeJsonStringify(result, 0));
    return result;
  }
  console.log(t('connector_test.success'));
  console.log(`${t('connector_test.status_label')} ${response.statusLine}`);
  console.log(`\n${t('connector_test.headers_label')}`);
  console.log(safeJsonStringify(response.responseHeaders).substring(0, 1000));
  console.log(`\n${t('connector_test.content_label')}`);
  if (typeof response.content === 'string') {
    try {console.log(safeJsonStringify(JSON.parse(response.content)));}
    catch {console.log(redactString(response.content).substring(0, 2000));}
  } else {
    console.log(safeJsonStringify(response.content));
  }
  return result;
}

module.exports = { buildTestParams, parseArgs, resolveOwnedConnection, run };
