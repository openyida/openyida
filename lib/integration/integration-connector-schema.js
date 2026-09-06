'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { findConnectorById, findConnectorByName, getConnectorDetail } = require('../connector/api');
const {
  lookupConnectorPreset,
  buildConnectorInputIndex,
  resolveConnectorAssignmentTarget,
} = require('./connector-presets');

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

function hasUsableValue(value) {
  if (value === undefined || value === null) { return false; }
  if (typeof value === 'string') { return value.trim() !== ''; }
  if (Array.isArray(value)) { return value.length > 0; }
  if (typeof value === 'object') { return Object.keys(value).length > 0; }
  return true;
}

function hasDeclaredDefault(input) {
  if (hasUsableValue(input && input.defaultValue)) { return true; }
  return hasUsableValue(input && input.queryDefaultValue && input.queryDefaultValue.defaultValue);
}

function isRequiredInput(input) {
  return input && (input.required === true || String(input.required).toLowerCase() === 'true');
}

function validateConnectorAssignmentsAgainstSchema(assignments, inputs, options = {}) {
  const inputIndex = buildConnectorInputIndex(inputs);
  const consumedPaths = new Map();
  for (const assignment of assignments || []) {
    const resolved = resolveConnectorAssignmentTarget(assignment && assignment.column, inputIndex);
    if (resolved.state === 'unknown') {
      throw connectorSchemaError(
        'INTEGRATION_CONNECTOR_INPUT_UNKNOWN',
        t('integration.connector_input_unknown', resolved.column),
        { column: resolved.column }
      );
    }
    if (resolved.state === 'ambiguous') {
      throw connectorSchemaError(
        'INTEGRATION_CONNECTOR_INPUT_AMBIGUOUS',
        t('integration.connector_input_ambiguous', resolved.column),
        { column: resolved.column, candidates: resolved.candidates }
      );
    }
    const path = resolved.descriptor.path;
    if (consumedPaths.has(path)) {
      throw connectorSchemaError(
        'INTEGRATION_CONNECTOR_ASSIGNMENT_DUPLICATE',
        t('integration.connector_assignment_duplicate', path),
        { path, assignmentState: 'duplicate' }
      );
    }
    if (isRequiredInput(resolved.descriptor.input) && !hasUsableValue(assignment.value)) {
      throw connectorSchemaError(
        'INTEGRATION_CONNECTOR_ASSIGNMENT_VALUE_REQUIRED',
        t('integration.connector_assignment_value_required', path),
        { path, assignmentState: 'empty' }
      );
    }
    consumedPaths.set(path, assignment);
  }

  if (options.requireRequired !== false) {
    for (const descriptor of inputIndex.leaves) {
      if (isRequiredInput(descriptor.input)
        && !hasDeclaredDefault(descriptor.input)
        && !consumedPaths.has(descriptor.path)) {
        throw connectorSchemaError(
          'INTEGRATION_CONNECTOR_REQUIRED_INPUT_MISSING',
          t('integration.connector_required_input_missing', descriptor.path),
          {
            path: descriptor.path,
            paramLocation: descriptor.location,
            required: true,
            assignmentState: 'missing',
          }
        );
      }
    }
  }
  return {
    assignmentCount: (assignments || []).length,
    consumedCount: consumedPaths.size,
  };
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
    operation,
    connectorTarget: {
      scheme: detail.scheme || connector.scheme || 'https',
      host: detail.host || connector.host || '',
      baseUrl: detail.baseUrl || connector.baseUrl || '/',
    },
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
