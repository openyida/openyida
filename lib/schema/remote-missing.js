'use strict';

const REMOTE_MISSING_BRAND = Symbol('openyida.schema.remoteMissing');

function createRemoteMissingError() {
  const error = new Error('Bound remote resource is missing.');
  error.code = 'SCHEMA_REMOTE_RESOURCE_MISSING';
  Object.defineProperty(error, REMOTE_MISSING_BRAND, {
    value: true,
  });
  return error;
}

function isRemoteMissingError(error) {
  return !!(error && error[REMOTE_MISSING_BRAND] === true);
}

module.exports = {
  createRemoteMissingError,
  isRemoteMissingError,
};
