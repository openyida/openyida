'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const { t } = require('../core/i18n');
const api = require('./api');

const REQUIRED_CONNECTOR_FIELDS = Object.freeze([
  'displayName',
  'iconUrl',
  'connectorDesc',
  'host',
  'baseUrl',
  'scheme',
  'tongxunluTemplateId',
  'securitySchemes',
  'connectorMode',
  'connectorName',
  'category',
]);

function actionError(code, messageKey, ...args) {
  const error = new Error(t(messageKey, ...args));
  error.code = code;
  return error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

function parseOperationCollection(rawOperations) {
  if (rawOperations === undefined || rawOperations === null || rawOperations === '') {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }
  let operations;
  try {
    operations = typeof rawOperations === 'string' ? JSON.parse(rawOperations) : rawOperations;
  } catch {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }
  if (!Array.isArray(operations) || operations.length === 0) {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }

  const operationIds = new Set();
  const stableIds = new Set();
  for (const operation of operations) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation) ||
        !String(operation.operationId || '').trim() || !String(operation.id || '').trim()) {
      throw actionError(
        'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
        'connector_action_update.preflight_incomplete'
      );
    }
    const operationId = String(operation.operationId);
    const stableId = String(operation.id);
    if (operationIds.has(operationId) || stableIds.has(stableId)) {
      throw actionError(
        'CONNECTOR_OPERATION_ID_DUPLICATE',
        'connector_action_update.operation_id_duplicate',
        operationId
      );
    }
    operationIds.add(operationId);
    stableIds.add(stableId);
  }
  return operations;
}

function projectStableConnector(detail) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail) ||
      !hasOwn(detail, 'id') || detail.id === undefined || detail.id === null || detail.id === '') {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }
  for (const field of REQUIRED_CONNECTOR_FIELDS) {
    if (!hasOwn(detail, field) || detail[field] === undefined || detail[field] === null) {
      throw actionError(
        'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
        'connector_action_update.preflight_incomplete'
      );
    }
  }
  const hasFaas = hasOwn(detail, 'faasTemplateId') && detail.faasTemplateId !== undefined && detail.faasTemplateId !== null;
  const hasTemplate = hasOwn(detail, 'templateId') && detail.templateId !== undefined && detail.templateId !== null;
  if (!hasFaas && !hasTemplate) {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }
  try {
    const schemes = typeof detail.securitySchemes === 'string'
      ? JSON.parse(detail.securitySchemes)
      : detail.securitySchemes;
    if (!schemes || typeof schemes !== 'object' || Array.isArray(schemes)) {throw new Error('invalid');}
  } catch {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }

  return {
    id: String(detail.id),
    displayName: detail.displayName,
    iconUrl: detail.iconUrl,
    connectorDesc: detail.connectorDesc,
    host: detail.host,
    baseUrl: detail.baseUrl,
    scheme: detail.scheme,
    tongxunluTemplateId: detail.tongxunluTemplateId,
    faasTemplateId: hasFaas ? detail.faasTemplateId : detail.templateId,
    securitySchemes: detail.securitySchemes,
    connectorMode: String(detail.connectorMode),
    connectorName: detail.connectorName,
    category: detail.category,
  };
}

function createActionSnapshot(detail) {
  const connector = projectStableConnector(detail);
  const operations = parseOperationCollection(detail.operations);
  return {
    connector,
    connectorFingerprint: sha256(JSON.stringify(connector)),
    operations,
    operationIds: operations.map(operation => operation.operationId),
    stableIds: operations.map(operation => operation.id),
  };
}

function validatePatch(queryPatch) {
  if (!queryPatch || typeof queryPatch !== 'object' || Array.isArray(queryPatch) ||
      Object.keys(queryPatch).length === 0) {
    throw actionError(
      'CONNECTOR_ACTION_QUERY_INVALID',
      'connector_action_update.query_invalid'
    );
  }
  for (const [name, value] of Object.entries(queryPatch)) {
    if (!String(name).trim() || value === undefined || value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (typeof value === 'object')) {
      throw actionError(
        'CONNECTOR_ACTION_QUERY_INVALID',
        'connector_action_update.query_invalid'
      );
    }
  }
}

function updateDefaultCarriers(node, value) {
  let carriers = 0;
  if (hasOwn(node, 'value')) {
    node.value = value;
    carriers += 1;
  }
  if (hasOwn(node, 'defaultValue')) {
    node.defaultValue = value;
    carriers += 1;
  }
  if (node.queryDefaultValue && typeof node.queryDefaultValue === 'object' &&
      hasOwn(node.queryDefaultValue, 'defaultValue')) {
    node.queryDefaultValue.defaultValue = value;
    carriers += 1;
  }
  return carriers;
}

function defaultCarrierValues(node) {
  const values = [];
  if (hasOwn(node, 'value')) {values.push(node.value);}
  if (hasOwn(node, 'defaultValue')) {values.push(node.defaultValue);}
  if (node.queryDefaultValue && typeof node.queryDefaultValue === 'object' &&
      hasOwn(node.queryDefaultValue, 'defaultValue')) {
    values.push(node.queryDefaultValue.defaultValue);
  }
  return values;
}

function canonicalQueryValue(value) {
  return String(value);
}

function patchActionQuery(snapshot, operationId, queryPatch) {
  validatePatch(queryPatch);
  const targetId = String(operationId || '').trim();
  if (!targetId) {
    throw actionError(
      'CONNECTOR_ACTION_TARGET_NOT_UNIQUE',
      'connector_action_update.target_not_unique'
    );
  }
  const operations = JSON.parse(JSON.stringify(snapshot.operations));
  const matches = operations.filter(operation => operation.operationId === targetId);
  if (matches.length !== 1) {
    throw actionError(
      'CONNECTOR_ACTION_TARGET_NOT_UNIQUE',
      'connector_action_update.target_not_unique'
    );
  }
  const target = matches[0];
  const parameterQuery = target.parameters && Array.isArray(target.parameters.query)
    ? target.parameters.query
    : null;
  const queryInputs = Array.isArray(target.inputs)
    ? target.inputs.filter(input => input && (
      input.paramLocation === 'query' || String(input.name || '').toLowerCase() === 'query'
    ))
    : [];
  if (!parameterQuery || queryInputs.length !== 1 || !Array.isArray(queryInputs[0].childList)) {
    throw actionError(
      'CONNECTOR_ACTION_QUERY_SCHEMA_INCOMPLETE',
      'connector_action_update.query_schema_incomplete'
    );
  }

  let changedCount = 0;
  for (const [name, value] of Object.entries(queryPatch)) {
    const parameterMatches = parameterQuery.filter(parameter => parameter && parameter.name === name);
    const inputMatches = queryInputs[0].childList.filter(parameter => parameter && parameter.name === name);
    if (parameterMatches.length === 0 && inputMatches.length === 0) {
      throw actionError(
        'CONNECTOR_ACTION_QUERY_UNKNOWN',
        'connector_action_update.query_unknown',
        name
      );
    }
    const parameterCarriers = parameterMatches.length === 1
      ? defaultCarrierValues(parameterMatches[0])
      : [];
    const inputCarriers = inputMatches.length === 1
      ? defaultCarrierValues(inputMatches[0])
      : [];
    if (parameterMatches.length !== 1 || inputMatches.length !== 1 ||
        parameterCarriers.length === 0 || inputCarriers.length === 0) {
      throw actionError(
        'CONNECTOR_ACTION_QUERY_SCHEMA_INCOMPLETE',
        'connector_action_update.query_schema_incomplete'
      );
    }
    const canonicalNext = canonicalQueryValue(value);
    const carriers = [...parameterCarriers, ...inputCarriers];
    if (!carriers.every(current => canonicalQueryValue(current) === canonicalNext)) {
      updateDefaultCarriers(parameterMatches[0], value);
      updateDefaultCarriers(inputMatches[0], value);
      changedCount += 1;
    }
  }

  if (changedCount === 0) {
    throw actionError(
      'CONNECTOR_ACTION_NO_CHANGES',
      'connector_action_update.no_changes'
    );
  }

  return {
    ...snapshot,
    operations,
    changedOperationId: targetId,
    changedQuery: { ...queryPatch },
  };
}

function buildConnectorSaveParams(snapshot, operations) {
  const validatedOperations = parseOperationCollection(operations);
  return {
    ...snapshot.connector,
    operations: JSON.stringify(validatedOperations),
  };
}

function mergeAddedOperations(snapshot, additions) {
  const validatedAdditions = parseOperationCollection(additions);
  const operationIds = new Set(snapshot.operationIds);
  const stableIds = new Set(snapshot.stableIds);
  for (const operation of validatedAdditions) {
    if (operationIds.has(operation.operationId) || stableIds.has(operation.id)) {
      throw actionError(
        'CONNECTOR_ACTION_ID_CONFLICT',
        'connector_action_update.operation_id_conflict',
        operation.operationId
      );
    }
  }
  return [...snapshot.operations, ...validatedAdditions];
}

function assertActionUpdateReadback(beforeSnapshot, expectedOperations, actualDetail) {
  let actual;
  try {
    actual = createActionSnapshot(actualDetail);
  } catch (error) {
    const mismatch = actionError(
      'CONNECTOR_ACTION_READBACK_MISMATCH',
      'connector_action_update.readback_mismatch'
    );
    mismatch.cause = error;
    throw mismatch;
  }
  const changed = expectedOperations
    .map((operation, index) => isDeepStrictEqual(operation, beforeSnapshot.operations[index]) ? null : operation.operationId)
    .filter(Boolean);
  const valid = actual.connectorFingerprint === beforeSnapshot.connectorFingerprint &&
    isDeepStrictEqual(actual.operations, expectedOperations) &&
    isDeepStrictEqual(actual.operationIds, beforeSnapshot.operationIds) &&
    isDeepStrictEqual(actual.stableIds, beforeSnapshot.stableIds) &&
    expectedOperations.length === beforeSnapshot.operations.length &&
    changed.length === 1;
  if (!valid) {
    throw actionError(
      'CONNECTOR_ACTION_READBACK_MISMATCH',
      'connector_action_update.readback_mismatch'
    );
  }
  return {
    verified: true,
    changedOperationId: changed[0],
    connectorFingerprint: actual.connectorFingerprint,
    actionCount: actual.operations.length,
  };
}

async function updateConnectorAction(options, dependencies = api) {
  const authRef = dependencies.getAuthRef();
  const connector = await dependencies.findConnectorById(options.connectorId, authRef);
  if (!connector || !connector.connectorName) {
    throw actionError(
      'CONNECTOR_ACTION_CONNECTOR_NOT_FOUND',
      'connector_action_update.connector_not_found'
    );
  }
  const rawDetail = await dependencies.getConnectorDetail({
    id: connector.id,
    connectorName: connector.connectorName,
    connectorMode: connector.connectorMode,
  }, authRef);
  const detail = { ...rawDetail, id: rawDetail.id === undefined ? connector.id : rawDetail.id };
  if (String(detail.id) !== String(options.connectorId) || detail.connectorName !== connector.connectorName) {
    throw actionError(
      'CONNECTOR_ACTION_PREFLIGHT_INCOMPLETE',
      'connector_action_update.preflight_incomplete'
    );
  }
  const before = createActionSnapshot(detail);
  const expected = patchActionQuery(before, options.operationId, options.queryPatch);
  const saveParams = buildConnectorSaveParams(before, expected.operations);

  let saveResult;
  try {
    saveResult = await dependencies.saveConnector(saveParams, authRef);
    const verification = assertActionUpdateReadback(before, expected.operations, saveResult && saveResult.detail);
    return {
      success: true,
      connectorId: String(options.connectorId),
      operationId: options.operationId,
      changedQuery: expected.changedQuery,
      beforeFingerprint: before.connectorFingerprint,
      afterFingerprint: verification.connectorFingerprint,
      actionCount: verification.actionCount,
      readbackVerified: true,
    };
  } catch (error) {
    if (error && (error.code === 'YIDA_WRITE_AUTH_NOT_READY' || error.code === 'CONNECTOR_WRITE_REJECTED')) {
      throw error;
    }
    const unknown = actionError(
      'CONNECTOR_ACTION_WRITE_OUTCOME_UNKNOWN',
      'connector_action_update.write_outcome_unknown'
    );
    unknown.writeAttempted = true;
    unknown.outcome = 'outcome_unknown';
    unknown.cause = error;
    throw unknown;
  }
}

module.exports = {
  assertActionUpdateReadback,
  buildConnectorSaveParams,
  createActionSnapshot,
  mergeAddedOperations,
  parseOperationCollection,
  patchActionQuery,
  updateConnectorAction,
};
