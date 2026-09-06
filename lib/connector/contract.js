'use strict';

const { isDeepStrictEqual } = require('util');
const { t } = require('../core/i18n');
const { CliError } = require('../core/cli-error');
const { redactString } = require('../core/redact');

const HTTP_CONNECTOR_MODE = 5;
const AUTH_TYPE_CODES = Object.freeze({
  NONE: 0,
  BasicAuth: 2,
  ApiKeyAuth: 3,
  DingAuth: 5,
  AliyunApiGateway: 6,
  DingTrustGW: 7,
});

function createContractError(code, message, details) {
  return new CliError(message, { code, details });
}

function valueShape(value) {
  if (value === null) { return 'null'; }
  if (Array.isArray(value)) { return 'array'; }
  return typeof value;
}

function safeKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { return []; }
  return Object.keys(value)
    .slice(0, 30)
    .map(key => redactString(String(key)).slice(0, 80))
    .sort();
}

function parseResponseContent(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) { return value; }
  if (typeof value !== 'string' || !value.trim().startsWith('{')) { return null; }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function describeTestResponse(raw) {
  const content = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.content : undefined;
  const parsedContent = parseResponseContent(content);
  return {
    responseShape: valueShape(raw),
    topLevelKeys: safeKeys(raw),
    contentShape: valueShape(content),
    contentKeys: safeKeys(parsedContent),
  };
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

function summarizeDifferenceValue(value) {
  if (value === undefined) { return '[missing]'; }
  if (value === null || typeof value === 'boolean' || typeof value === 'number') { return value; }
  if (typeof value === 'string') {
    return value.length <= 80 ? redactString(value) : `[string length=${value.length}]`;
  }
  if (Array.isArray(value)) { return `[array length=${value.length}]`; }
  return `[object keys=${Object.keys(value || {}).length}]`;
}

function findFirstDifference(expected, actual, path = '$') {
  if (isDeepStrictEqual(expected, actual)) { return null; }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return {
        path: `${path}.length`,
        expected: expected.length,
        actual: actual.length,
      };
    }
    for (let index = 0; index < expected.length; index++) {
      const difference = findFirstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) { return difference; }
    }
  } else if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();
    for (const key of keys) {
      const difference = findFirstDifference(expected[key], actual[key], `${path}.${key}`);
      if (difference) { return difference; }
    }
  }
  return {
    path,
    expected: summarizeDifferenceValue(expected),
    actual: summarizeDifferenceValue(actual),
  };
}

function assertConnectorReadback(expected, actual) {
  const expectedProjection = projectConnectorDefinition(expected);
  const actualProjection = projectConnectorDefinition(actual);
  if (!isDeepStrictEqual(actualProjection, expectedProjection)) {
    const connectorId = actual && (actual.id || actual.connectorId) || '';
    const connectorName = actualProjection.connectorName || expectedProjection.connectorName || '';
    throw new CliError(t('connector_contract.readback_mismatch'), {
      code: 'CONNECTOR_READBACK_MISMATCH',
      details: {
        partial: true,
        residual: {
          type: 'connector',
          connectorId: String(connectorId),
          connectorName,
          owned: 'unknown',
          state: 'created_or_updated_unverified',
        },
        retryable: false,
        retrySafe: false,
        sideEffectState: 'committed',
        readbackAllowed: true,
        readbackVerified: false,
        firstDifference: findFirstDifference(expectedProjection, actualProjection),
        nextStep: connectorId
          ? `openyida connector detail ${connectorId} --json`
          : 'openyida connector list --json',
      },
    });
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
      raw.errorMsg || raw.message || t('connector_contract.test_envelope_failed'),
      {
        ...describeTestResponse(raw),
        retrySafe: false,
        sideEffectState: 'unknown',
      }
    );
  }
  let canonical = raw;
  if (!isCanonicalTestResponse(canonical)) {
    if (raw && typeof raw === 'object' && raw.success === true && isCanonicalTestResponse(raw.content)) {
      canonical = raw.content;
    } else {
      throw createContractError(
        'CONNECTOR_TEST_RESPONSE_INVALID',
        t('connector_contract.test_response_invalid'),
        {
          ...describeTestResponse(raw),
          retrySafe: false,
          sideEffectState: 'unknown',
        }
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

  const businessContent = parseResponseContent(canonical.content);
  if (businessContent && Object.prototype.hasOwnProperty.call(businessContent, 'errcode')
    && String(businessContent.errcode) !== '0') {
    throw createContractError(
      'CONNECTOR_TEST_BUSINESS_FAILED',
      t('connector_contract.test_business_failed', String(businessContent.errcode)),
      {
        statusLine: canonical.statusLine,
        businessErrorCode: String(businessContent.errcode),
        businessErrorMessage: redactString(String(businessContent.errmsg || businessContent.message || '')).slice(0, 200),
        ...describeTestResponse(canonical),
        retrySafe: false,
        sideEffectState: 'unknown',
      }
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
  findFirstDifference,
  parseJsonValue,
  projectConnectorDefinition,
};
