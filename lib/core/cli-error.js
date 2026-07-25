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
    }
    payload.details = details;
  }

  return payload;
}

module.exports = {
  CliError,
  isCliError,
  toErrorPayload,
};
