'use strict';

const { t } = require('../../../lib/core/i18n');

const CASES = [
  {
    id: 'integration-data-create',
    nodeType: 'dataCreate',
    mutation: 'submit owned source record once, then update the same source marker once',
    requiredReadbacks: ['target-form exact marker query', 'source update no-extra-create query'],
    expectedObservation: { createdCount: 1, mappedFieldsExact: true, sourceUpdateCreatedCount: 0 },
    errorCode: 'INTEGRATION_RUNTIME_DATA_CREATE_MISMATCH',
  },
  {
    id: 'integration-data-retrieve',
    nodeType: 'dataRetrieve',
    mutation: 'submit an owned trigger that must select exactly one owned lookup record',
    requiredReadbacks: ['owned lookup record marker', 'downstream selected marker'],
    expectedObservation: { matchedCount: 1, selectedMarkerExact: true, downstreamMarkerExact: true },
    errorCode: 'INTEGRATION_RUNTIME_DATA_RETRIEVE_MISMATCH',
  },
  {
    id: 'integration-data-update',
    nodeType: 'dataUpdate',
    mutation: 'submit an owned trigger against one fingerprinted target and one non-target control',
    requiredReadbacks: ['target before fingerprint', 'target after fingerprint', 'non-target after fingerprint'],
    expectedObservation: { updatedCount: 1, targetFingerprintChanged: true, nonTargetFingerprintChanged: false },
    errorCode: 'INTEGRATION_RUNTIME_DATA_UPDATE_MISMATCH',
  },
  {
    id: 'integration-route',
    nodeType: 'route',
    mutation: 'submit one matching and one default-branch owned trigger',
    requiredReadbacks: ['matching branch marker', 'default branch marker'],
    expectedObservation: { matchBranchCount: 1, defaultBranchCount: 1, crossBranchLeakCount: 0 },
    errorCode: 'INTEGRATION_RUNTIME_ROUTE_MISMATCH',
  },
  {
    id: 'integration-send-message',
    nodeType: 'sendMessage',
    mutation: 'submit one correlation-marked trigger for an exact owned recipient set',
    requiredReadbacks: ['delivery correlation marker', 'exact recipient projection'],
    expectedObservation: { deliveryCount: 1, recipientSetExact: true, correlationMarkerObserved: true },
    errorCode: 'INTEGRATION_RUNTIME_MESSAGE_MISMATCH',
  },
  {
    id: 'integration-connector',
    nodeType: 'connector',
    mutation: 'submit one correlation-marked trigger to an owned receiver using the discovered action schema',
    requiredReadbacks: ['owned receiver request marker', 'connector response marker', 'runtime success log'],
    expectedObservation: { callCount: 1, requestSchemaExact: true, responseMarkerObserved: true },
    errorCode: 'INTEGRATION_RUNTIME_CONNECTOR_MISMATCH',
  },
  {
    id: 'integration-initiate-approval',
    nodeType: 'initiateApproval',
    mutation: 'submit one owned trigger with an exact initiator and assignment marker',
    requiredReadbacks: ['owned process instance marker', 'initiator projection', 'assignment projection'],
    expectedObservation: { processInstanceCount: 1, initiatorExact: true, assignmentsExact: true },
    errorCode: 'INTEGRATION_RUNTIME_APPROVAL_MISMATCH',
  },
];

const RUNTIME_CASES = Object.freeze(CASES.map((item) => Object.freeze(item)));

function getRuntimeCase(caseId) {
  return RUNTIME_CASES.find((item) => item.id === caseId) || null;
}

function verifyRuntimeObservation(caseId, observation) {
  const runtimeCase = getRuntimeCase(caseId);
  if (!runtimeCase) {
    const error = new Error(t('integration.runtime_case_unknown', caseId));
    error.code = 'INTEGRATION_RUNTIME_CASE_UNKNOWN';
    throw error;
  }
  const errors = [];
  for (const [key, expected] of Object.entries(runtimeCase.expectedObservation)) {
    const actual = observation && observation[key];
    if (actual !== expected) {
      errors.push({
        code: runtimeCase.errorCode,
        path: `$.${key}`,
        expected,
        actual,
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    verificationLevel: errors.length === 0 ? 'REAL_RUNTIME_OBSERVED' : 'RUNTIME_MISMATCH',
  };
}

module.exports = {
  RUNTIME_CASES,
  getRuntimeCase,
  verifyRuntimeObservation,
};
