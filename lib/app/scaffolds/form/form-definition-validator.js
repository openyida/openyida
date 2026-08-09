'use strict';

const Ajv = require('ajv');
const definitionSchema = require('./form-definition.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(definitionSchema);

function validateFormDefinition(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return definition;
  }
  const candidate = Object.assign({ version: 1 }, definition);
  if (validate(candidate)) {
    return candidate;
  }
  const error = new Error('原生表单定义不符合 form-definition v1');
  error.code = 'FORM_DEFINITION_SCHEMA_INVALID';
  error.details = {
    errors: (validate.errors || []).map(function (item) {
      return {
        path: item.dataPath || item.instancePath || '',
        keyword: item.keyword,
        message: item.message,
        params: item.params,
      };
    }),
  };
  throw error;
}

module.exports = {
  definitionSchema,
  validateFormDefinition,
};
