'use strict';

class SchemaValidationError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'SchemaValidationError';
    this.code = code;
    if (options.path !== undefined) {
      this.path = options.path;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function schemaError(code, message, options = {}) {
  return new SchemaValidationError(code, message, options);
}

module.exports = {
  SchemaValidationError,
  schemaError,
};
