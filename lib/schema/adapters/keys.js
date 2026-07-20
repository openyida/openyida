'use strict';

const { schemaError } = require('../errors');

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function validateSemanticKey(key, pointerPath) {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key) || key.includes('.')) {
    throw schemaError('SCHEMA_INVALID_KEY', 'Semantic keys must match /^[A-Za-z][A-Za-z0-9_]*$/ and must not contain dots.', {
      path: pointerPath,
      details: { key },
    });
  }
}

module.exports = {
  KEY_PATTERN,
  validateSemanticKey,
};
