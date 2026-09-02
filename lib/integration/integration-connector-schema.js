'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { findConnectorById, findConnectorByName, getConnectorDetail } = require('../connector/api');
const { lookupConnectorPreset } = require('./connector-presets');

function connectorSchemaError(code, message, details) {
  return new CliError(message, { code, details: { ...details, remoteWrites: 0 } });
}

function parseOperations(value) {
  if (Array.isArray(value)) { return value; }
  if (typeof value !== 'string' || !value.trim()) { return null; }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function collectInputNames(inputs, prefix = '', result = new Set()) {
  for (const input of inputs || []) {
    if (!input || typeof input !== 'object' || !input.name) { continue; }
    const name = prefix ? `${prefix}.${input.name}` : input.name;
    result.add(name);
    result.add(input.name);
    collectInputNames(input.childList, name, result);
  }
  return result;
}

function validateConnectorAssignmentsAgainstSchema(assignments, inputs) {
  const knownNames = collectInputNames(inputs);
  for (const assignment of assignments || []) {
    if (!knownNames.has(assignment.column)) {
      throw connectorSchemaError(
        'INTEGRATION_CONNECTOR_INPUT_UNKNOWN',
        t('integration.connector_input_unknown', assignment.column),
        { column: assignment.column }
      );
    }
  }
}

async function resolveConnectorActionSchema(authRef, input, dependencies = {}) {
  const preset = lookupConnectorPreset(input.connectorId, input.actionId);
  if (preset) {
    return {
      ...preset,
      verificationLevel: 'FIXED_PROVEN_PRESET',
    };
  }

  const findConnector = dependencies.findConnectorById || findConnectorById;
  const findByName = dependencies.findConnectorByName || findConnectorByName;
  const readDetail = dependencies.getConnectorDetail || getConnectorDetail;
  let connector;
  try {
    connector = await findConnector(input.connectorId, authRef);
    if (!connector && typeof findByName === 'function') {
      connector = await findByName(input.connectorId, authRef);
    }
  } catch (error) {
    throw connectorSchemaError(
      'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED',
      t('integration.connector_schema_discovery_failed', error.message),
      { connectorId: input.connectorId, actionId: input.actionId }
    );
  }
  if (!connector) {
    throw connectorSchemaError(
      'INTEGRATION_CONNECTOR_NOT_FOUND',
      t('integration.connector_not_found', input.connectorId),
      { connectorId: input.connectorId, actionId: input.actionId }
    );
  }

  let detail;
  try {
    detail = await readDetail({
      id: connector.id || input.connectorId,
      connectorName: connector.connectorName,
      connectorMode: connector.connectorMode || input.connectorMode,
    }, authRef);
  } catch (error) {
    throw connectorSchemaError(
      'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED',
      t('integration.connector_schema_discovery_failed', error.message),
      { connectorId: input.connectorId, actionId: input.actionId }
    );
  }
  const operations = parseOperations(detail && detail.operations);
  if (!operations) {
    throw connectorSchemaError(
      'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED',
      t('integration.connector_schema_missing'),
      { connectorId: input.connectorId, actionId: input.actionId }
    );
  }
  const matches = operations.filter((operation) => (
    operation
      && String(operation.operationId || operation.id || operation.actionId) === String(input.actionId)
  ));
  if (matches.length !== 1) {
    throw connectorSchemaError(
      'INTEGRATION_CONNECTOR_ACTION_NOT_FOUND',
      t('integration.connector_action_not_found', input.actionId),
      { connectorId: input.connectorId, actionId: input.actionId, exactMatchCount: matches.length }
    );
  }
  const operation = matches[0];
  if (!Array.isArray(operation.inputs) || !Array.isArray(operation.outputs || [])) {
    throw connectorSchemaError(
      'INTEGRATION_CONNECTOR_SCHEMA_UNVERIFIED',
      t('integration.connector_action_schema_missing'),
      { connectorId: input.connectorId, actionId: input.actionId }
    );
  }
  return {
    inputs: operation.inputs,
    outputs: operation.outputs || [],
    description: operation.description || operation.summary || '',
    openDevSchemaType: operation.openDevSchemaType || 'normal',
    connectorName: connector.connectorName || '',
    verificationLevel: 'PLATFORM_READ_ONLY_DISCOVERY',
  };
}

module.exports = {
  parseOperations,
  resolveConnectorActionSchema,
  validateConnectorAssignmentsAgainstSchema,
};
