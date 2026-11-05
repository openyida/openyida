'use strict';

const { normalizeSchemaFields } = require('../schema-field-resolution');
const Babel = require('../../core/babel');
const { buildWriteContract } = require('../form-data-contract');
const { CliError } = require('../../core/cli-error');
const { t } = require('../../core/i18n');

function invalidBinding(details) {
  throw new CliError(t('data_verify.binding_invalid'), { code: 'PAGE_DATA_BINDING_INVALID',
    details: { ...details, remoteWrites: 0, nextStep: 'bind_real_schema_fields_and_options' } });
}

/** Read JSON constants and aliases only; application code is never executed. */
function collectDeclaredBindings(source) {
  const ast = Babel.packages.parser.parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const traverse = Babel.packages.traverse.default;
  const unknown = Symbol('dynamic');
  function literal(at, seen = new Set(), selectedKeys) {
    if (!at?.node || seen.has(at.node) || seen.size > 40) {return unknown;}
    seen = new Set(seen).add(at.node);
    if (at.isStringLiteral() || at.isNumericLiteral() || at.isBooleanLiteral()) {return at.node.value;}
    if (at.isNullLiteral()) {return null;}
    if (at.isIdentifier()) {
      const binding = at.scope.getBinding(at.node.name);
      return binding?.constant && binding.path.isVariableDeclarator() && binding.path.parent.kind === 'const'
        ? literal(binding.path.get('init'), seen, selectedKeys) : unknown;
    }
    if (at.isMemberExpression()) {
      const object = literal(at.get('object'), seen);
      const key = at.node.computed ? literal(at.get('property'), seen) : at.node.property.name;
      return object && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key) ? object[key] : unknown;
    }
    if (at.isArrayExpression()) {
      const items = at.get('elements').map(item => literal(item, seen));
      return items.includes(unknown) ? unknown : items;
    }
    if (at.isObjectExpression()) {
      const result = Object.create(null);
      for (const item of at.get('properties')) {
        if (item.isSpreadElement()) {
          const spread = literal(item.get('argument'), seen, selectedKeys);
          if (!spread || typeof spread !== 'object' || Array.isArray(spread)) {return unknown;}
          Object.assign(result, spread);
        } else if (item.isObjectProperty()) {
          const key = item.node.computed ? literal(item.get('key'), seen) : item.node.key.name || item.node.key.value;
          if (selectedKeys && key !== unknown && !selectedKeys.includes(key)) {continue;}
          const value = literal(item.get('value'), seen);
          if (key === unknown || value === unknown) {return unknown;}
          result[key] = value;
        } else {return unknown;}
      }
      return result;
    }
    return unknown;
  }
  const bindings = [];
  traverse(ast, { ObjectExpression(at) {
    const mode = at.get('properties').find(item => item.isObjectProperty() && !item.node.computed && (item.node.key.name || item.node.key.value) === 'mode');
    const fields = at.get('properties').some(item => item.isObjectProperty() && !item.node.computed && (item.node.key.name || item.node.key.value) === 'fields');
    if (!mode || !fields || !['form', 'process'].includes(literal(mode.get('value')))) {return;}
    const value = literal(at, new Set(), ['mode', 'appType', 'formUuid', 'fields', 'optionValues']);
    if (value === unknown || typeof value.appType !== 'string' || typeof value.formUuid !== 'string'
      || !value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields)) {
      invalidBinding({ reason: 'declared_binding_requires_static_resource_and_fields', line: at.node.loc?.start.line });
    }
    bindings.push(value);
  } });
  return bindings;
}

async function verifyDeclaredBindings(source, readSchema) {
  const bindings = collectDeclaredBindings(source);
  const schemas = new Map();
  for (const binding of bindings) {
    const key = JSON.stringify([binding.appType, binding.formUuid]);
    if (!schemas.has(key)) {schemas.set(key, await readSchema(binding.appType, binding.formUuid));}
    const schema = schemas.get(key);
    if (schema?.success !== true) {invalidBinding({ formUuid: binding.formUuid, reason: 'schema_unavailable' });}
    const verification = verifyFieldBindings(schema, binding.fields);
    if (verification.missing.length || verification.mismatched.length) {
      invalidBinding({ formUuid: binding.formUuid, ...verification });
    }
    const contract = buildWriteContract(schema);
    for (const [semantic, values] of Object.entries(binding.optionValues || {})) {
      const fieldId = normalizeExpectedBinding(binding.fields[semantic]).fieldId;
      const options = contract.props[fieldId]?.dataSource;
      const allowed = Array.isArray(options) ? options.map(item => typeof item === 'object' && item ? item.value : item) : [];
      if (!fieldId || !Array.isArray(values) || values.some(value => !allowed.includes(value))) {
        invalidBinding({ formUuid: binding.formUuid, fieldId, reason: 'option_value_mismatch', values, allowed });
      }
    }
  }
  return { verifiedBindings: bindings.length, schemaReads: schemas.size };
}

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
  collectDeclaredBindings,
  verifyDeclaredBindings,
};
