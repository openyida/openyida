'use strict';

const { normalizeSchemaFields } = require('../schema-field-resolution');

function normalizeSchemaResult(schemaResult) {
  if (schemaResult && schemaResult.content) {
    return schemaResult;
  }
  return { content: schemaResult || {} };
}

function normalizeExpectedBinding(value) {
  if (typeof value === 'string') {
    return { fieldId: value };
  }
  if (value && typeof value === 'object') {
    const fieldId = value.fieldId || value.id || value.value || '';
    return Object.assign({}, value, { fieldId: String(fieldId || '') });
  }
  return { fieldId: '' };
}

function verifyFieldBindings(schemaResult, expectedBindings, options) {
  const expectedComponentTypes = options && options.expectedComponentTypes || {};
  const fields = normalizeSchemaFields(normalizeSchemaResult(schemaResult));
  const fieldsById = new Map();
  fields.forEach(function (field) {
    if (field.fieldId) {
      fieldsById.set(field.fieldId, field);
    }
  });

  const verification = {
    verified: [],
    missing: [],
    mismatched: [],
  };

  Object.keys(expectedBindings || {}).forEach(function (semanticPath) {
    const expected = normalizeExpectedBinding(expectedBindings[semanticPath]);
    const fieldId = expected.fieldId;
    const expectedComponentType = expected.componentType || expected.componentName || expectedComponentTypes[semanticPath] || '';

    if (!fieldId || !fieldsById.has(fieldId)) {
      verification.missing.push({ semanticPath, fieldId });
      return;
    }

    const actual = fieldsById.get(fieldId);
    if (expectedComponentType && actual.componentType !== expectedComponentType) {
      verification.mismatched.push({
        semanticPath,
        fieldId,
        expectedComponentType,
        actualComponentType: actual.componentType,
      });
      return;
    }

    verification.verified.push(semanticPath);
  });

  return verification;
}

module.exports = {
  verifyFieldBindings,
};
