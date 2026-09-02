'use strict';

const { isDeepStrictEqual } = require('util');
const { t } = require('../core/i18n');

const HTTP_CONNECTOR_MODE = 5;
const AUTH_TYPE_CODES = Object.freeze({
  NONE: 0,
  BasicAuth: 2,
  ApiKeyAuth: 3,
  DingAuth: 5,
  AliyunApiGateway: 6,
  DingTrustGW: 7,
});

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
      t('connector_contract.invalid_json')
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
    connectorMode: String(value.connectorMode || HTTP_CONNECTOR_MODE),
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
      t('connector_contract.readback_mismatch')
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
    connectorMode: HTTP_CONNECTOR_MODE,
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

function connectorRequiresAuth(securitySchemes) {
  const schemes = parseJsonValue(securitySchemes, {});
  if (!schemes || typeof schemes !== 'object' || Array.isArray(schemes)) {
    throw createContractError(
      'CONNECTOR_SECURITY_SCHEMES_INVALID',
      t('connector_contract.security_schemes_invalid')
    );
  }
  return Object.keys(schemes).some(name => name !== 'NONE');
}

function isCanonicalTestResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return ['statusLine', 'responseHeaders', 'content']
    .every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function canonicalizeConnectorTestResponse(raw) {
  if (raw && typeof raw === 'object' && (raw.success === false || raw.hasError === true)) {
    throw createContractError(
      'CONNECTOR_TEST_ENVELOPE_FAILED',
      raw.errorMsg || raw.message || t('connector_contract.test_envelope_failed')
    );
  }
  let canonical = raw;
  if (!isCanonicalTestResponse(canonical)) {
    if (raw && typeof raw === 'object' && raw.success === true && isCanonicalTestResponse(raw.content)) {
      canonical = raw.content;
    } else {
      throw createContractError(
        'CONNECTOR_TEST_RESPONSE_INVALID',
        t('connector_contract.test_response_invalid')
      );
    }
  }

  const statusMatch = String(canonical.statusLine || '').match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/i);
  if (!statusMatch) {
    throw createContractError(
      'CONNECTOR_TEST_STATUS_INVALID',
      t('connector_contract.test_status_invalid')
    );
  }
  const statusCode = Number(statusMatch[1]);
  if (statusCode < 200 || statusCode >= 300) {
    throw createContractError(
      'CONNECTOR_TEST_HTTP_FAILED',
      t('connector_contract.test_http_failed', canonical.statusLine)
    );
  }

  return {
    statusLine: canonical.statusLine,
    responseHeaders: canonical.responseHeaders,
    content: canonical.content,
  };
}

module.exports = {
  AUTH_TYPE_CODES,
  HTTP_CONNECTOR_MODE,
  assertConnectorReadback,
  buildConnectorTestPayload,
  canonicalizeConnectorTestResponse,
  connectorRequiresAuth,
  parseJsonValue,
  projectConnectorDefinition,
};
