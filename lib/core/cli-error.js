'use strict';

const { redactSensitive } = require('./redact');

class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CliError';
    this.code = options.code || 'CLI_ERROR';
    this.exitCode = options.exitCode || 1;
    this.details = options.details;
    this.usage = options.usage;
    this.isCliError = true;
  }
}

function isCliError(error) {
  return !!(error && error.isCliError);
}

function toErrorPayload(error) {
  const payload = {
    success: false,
    errorCode: isCliError(error) ? error.code : 'UNEXPECTED_ERROR',
    errorMsg: error && error.message ? error.message : String(error),
  };

  if (isCliError(error) && error.details !== undefined) {
    const details = redactSensitive(error.details);
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      if (details.stage) {
        payload.stage = details.stage;
      }
      if (Array.isArray(details.completedStages)) {
        payload.completedStages = details.completedStages.slice();
      }
      if (details.nextStep) {
        payload.nextStep = details.nextStep;
      }
      [
        'partial',
        'residual',
        'retryable',
        'retrySafe',
        'sideEffectState',
        'readbackAllowed',
        'recommendedRecovery',
        'nextAction',
        'target',
        'deleted',
        'alreadyAbsent',
        'mutationAccepted',
        'mutationPerformed',
        'changed',
        'alreadyApplied',
        'recoveredByReadback',
        'readbackVerified',
        'status',
      ].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(details, key)) {
          payload[key] = details[key];
        }
      });
    }
    payload.details = details;
  }

  return payload;
}

function shouldUseStructuredErrorOutput(error, args = []) {
  if (!isCliError(error)) {return false;}
  if (Array.isArray(args) && args.includes('--json')) {return true;}
  const details = error.details;
  const ownedPartial = !!(
    details
    && typeof details === 'object'
    && !Array.isArray(details)
    && details.partial === true
    && details.residual
    && typeof details.residual === 'object'
    && details.retrySafe === false
  );
  const mutationOutcomeUnknown = !!(
    details
    && typeof details === 'object'
    && !Array.isArray(details)
    && details.target
    && typeof details.target === 'object'
    && details.retrySafe === false
    && details.sideEffectState === 'unknown'
  );
  const navigationOrderFailure = /^NAV_ORDER_/.test(error.code || '');
  return ownedPartial || mutationOutcomeUnknown || navigationOrderFailure;
}

module.exports = {
  CliError,
  isCliError,
  shouldUseStructuredErrorOutput,
  toErrorPayload,
};
