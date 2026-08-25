'use strict';

const { isDeepStrictEqual } = require('util');

function createContractError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseJsonValue(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw createContractError(
      'CONNECTOR_CONTRACT_JSON_INVALID',
      'Connector definition contains invalid JSON.'
    );
  }
}

function projectConnectorDefinition(value = {}) {
  return {
    operations: parseJsonValue(value.operations, []),
    displayName: value.displayName || '',
    iconUrl: value.iconUrl || '',
    connectorDesc: value.connectorDesc || '',
    host: value.host || '',
    baseUrl: value.baseUrl || '/',
    scheme: value.scheme || 'https',
    tongxunluTemplateId: String(value.tongxunluTemplateId || ''),
    // The frontend submits "0" for a non-FAAS HTTP connector, while the
    // platform readback normalizes the same sentinel to an empty string.
    faasTemplateId: String(value.faasTemplateId || value.templateId || '0'),
    securitySchemes: parseJsonValue(value.securitySchemes, {}),
    connectorMode: String(value.connectorMode || '5'),
    connectorName: value.connectorName || '',
    category: value.category || 'http',
  };
}

function assertConnectorReadback(expected, actual) {
  const expectedProjection = projectConnectorDefinition(expected);
  const actualProjection = projectConnectorDefinition(actual);
  if (!isDeepStrictEqual(actualProjection, expectedProjection)) {
    throw createContractError(
      'CONNECTOR_READBACK_MISMATCH',
      'Connector readback does not match the submitted definition.'
    );
  }
  return actualProjection;
}

function joinConnectorUrl(connector, operation) {
  const scheme = String(connector.scheme || 'https').replace(/:\/\/$/, '');
  const host = String(connector.host || '').replace(/^\/+|\/+$/g, '');
  const baseUrl = String(connector.baseUrl || '/').replace(/^\/+|\/+$/g, '');
  const operationUrl = String(operation.url || operation.path || '').replace(/^\/+/, '');
  const path = [baseUrl, operationUrl].filter(Boolean).join('/');
  return `${scheme}://${host}${path ? `/${path}` : ''}`;
}

function buildConnectorTestPayload(params) {
  const connector = params.connector || {};
  const operation = params.operation || {};
  const method = String(operation.method || 'get').toLowerCase();
  const payload = {
    url: joinConnectorUrl(connector, operation),
    method,
    path: params.path || {},
    query: params.query || {},
    header: params.header || {},
    connectorMode: Number(connector.connectorMode || 5),
  };
  const connection = params.authId || params.connection;
  // The frontend leaves `connection` undefined for NONE auth. Sending an
  // empty string makes the platform try to cast it to an integer.
  if (connection !== undefined && connection !== null && connection !== '') {
    payload.connection = connection;
  }
  if (method !== 'get' && method !== 'delete') {
    payload.body = params.body || {};
  }
  return payload;
}

module.exports = {
  assertConnectorReadback,
  buildConnectorTestPayload,
  parseJsonValue,
  projectConnectorDefinition,
};
