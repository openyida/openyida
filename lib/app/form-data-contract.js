'use strict';

const { normalizeSchemaFields, createSchemaHash } = require('./schema-field-resolution');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = new Set(['TextField', 'TextareaField', 'RadioField', 'SelectField']);
const numbers = new Set(['NumberField', 'RateField', 'DateField']);
const sets = new Set(['CheckboxField', 'MultiSelectField', 'EmployeeField', 'DepartmentSelectField']);
const files = new Set(['ImageField', 'AttachmentField']);
const numericText = value => typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim());

function buildWriteContract(schema) {
  const fields = normalizeSchemaFields(schema);
  const props = Object.create(null);
  const visit = node => {
    if (!object(node)) {return;}
    if (node.props?.fieldId) {props[node.props.fieldId] = node.props;}
    if (Array.isArray(node.children)) {node.children.forEach(visit);}
  };
  for (const page of Array.isArray(schema?.content?.pages) ? schema.content.pages : []) {
    if (Array.isArray(page.componentsTree)) {page.componentsTree.forEach(visit);}
  }
  return { fields, props, schemaHash: createSchemaHash(schema) };
}

function arrayValue(value, reading) {
  if (reading) {
    // Association projections can contain two JSON string envelopes.
    for (let i = 0; i < 2 && typeof value === 'string'; i++) {
      try {value = JSON.parse(value);} catch {return null;}
    }
  }
  if (reading && (value === null || value === '')) {return [];}
  return Array.isArray(value) ? value : null;
}

function canonical(field, value, reading = false) {
  const type = field.componentType;
  const supported = strings.has(type) || numbers.has(type) || sets.has(type) || files.has(type)
    || ['CitySelectField', 'CascadeDateField', 'AssociationFormField'].includes(type);
  if (!supported) {return { ok: false, reason: 'UNSUPPORTED_COMPONENT' };}
  if (value === null || reading && value === '') {
    return { ok: true, value: strings.has(type) || numbers.has(type) ? null : [] };
  }
  if (strings.has(type)) {
    return typeof value === 'string' ? { ok: true, value: value || null } : { ok: false };
  }
  if (numbers.has(type)) {
    const number = reading && numericText(value) ? Number(value) : value;
    return typeof number === 'number' && Number.isFinite(number) ? { ok: true, value: number } : { ok: false };
  }
  const list = arrayValue(value, reading);
  if (!list) {return { ok: false };}
  if (sets.has(type) || type === 'CitySelectField') {
    if (!list.every(item => typeof item === 'string' && item.length > 0
      || ['DepartmentSelectField', 'CitySelectField'].includes(type) && typeof item === 'number' && Number.isFinite(item))) {
      return { ok: false };
    }
    const ids = list.map(String);
    if (sets.has(type) && new Set(ids).size !== ids.length) {return { ok: false, reason: 'DUPLICATE_SELECTION' };}
    return { ok: true, value: sets.has(type) ? ids.sort() : ids };
  }
  if (type === 'CascadeDateField') {
    const endpoints = reading ? list.map(item => item === null ? '' : numericText(item) ? Number(item) : item) : list;
    return endpoints.length === 2 && endpoints.every(item => item === '' || typeof item === 'number' && Number.isFinite(item))
      ? { ok: true, value: endpoints } : { ok: false };
  }
  if (type === 'AssociationFormField') {
    const keys = reading ? ['instanceId'] : ['appType', 'formUuid', 'formType', 'instanceId', 'title'];
    return list.every(item => object(item) && keys.every(key => typeof item[key] === 'string' && item[key].trim()))
      ? { ok: true, value: list.map(item => item.instanceId).sort() } : { ok: false };
  }
  const identities = list.map(item => object(item)
    ? item.fileId || item.id || item.downloadUrl || item.url : null);
  return identities.every(id => typeof id === 'string' && id.length > 0)
    ? { ok: true, value: identities.slice().sort() } : { ok: false };
}

function prepareWriteData(data, contract, resolveAliases = false) {
  const issues = [];
  if (!contract.fields.length) {issues.push({ path: '$', code: 'SCHEMA_FIELDS_UNAVAILABLE' });}
  const compile = (input, parent = null, prefix = '$') => {
    if (!object(input)) {issues.push({ path: prefix, code: 'EXPECTED_OBJECT' }); return {};}
    const available = contract.fields.filter(field => field.parentFieldId === parent);
    const output = Object.create(null);
    for (const [key, value] of Object.entries(input)) {
      const location = `${prefix}[${JSON.stringify(key)}]`;
      const exact = available.filter(field => field.fieldId === key);
      const matches = exact.length ? exact : resolveAliases ? available.filter(field => field.alias && field.alias === key) : [];
      if (matches.length !== 1) {
        const candidates = available.filter(field => field.label === key || field.localizedLabels.some(label => label.label === key));
        issues.push({ path: location, code: matches.length > 1 ? 'AMBIGUOUS_FIELD_REFERENCE' : 'UNKNOWN_FIELD',
          fieldRef: key, candidates: (matches.length ? matches : candidates).map(field => ({ fieldId: field.fieldId, label: field.label })) });
        continue;
      }
      const field = matches[0];
      if (own(output, field.fieldId)) {issues.push({ path: location, code: 'DUPLICATE_FIELD_REFERENCE', fieldId: field.fieldId }); continue;}
      if (field.componentType === 'TableField') {
        if (!Array.isArray(value)) {issues.push({ path: location, fieldId: field.fieldId, code: 'EXPECTED_ARRAY' }); continue;}
        output[field.fieldId] = value.map((row, index) => compile(row, field.fieldId, `${location}[${index}]`));
        continue;
      }
      const normalized = canonical(field, value);
      if (!normalized.ok) {
        issues.push({ path: location, fieldId: field.fieldId, componentType: field.componentType,
          code: normalized.reason || 'INVALID_VALUE_TYPE' });
      } else {
        const options = contract.props[field.fieldId]?.dataSource;
        if (['RadioField', 'SelectField', 'CheckboxField', 'MultiSelectField'].includes(field.componentType)
          && Array.isArray(options) && options.length && value !== null && value !== '') {
          const values = options.map(option => object(option) ? option.value : option);
          if (values.every(option => typeof option === 'string')
            && (Array.isArray(value) ? value : [value]).some(option => !values.includes(option))) {
            issues.push({ path: location, fieldId: field.fieldId, code: 'UNKNOWN_OPTION' });
          }
        }
      }
      output[field.fieldId] = value;
    }
    return output;
  };
  const compiled = compile(data);
  if (!Object.keys(compiled).length && !issues.length) {issues.push({ path: '$', code: 'EMPTY_WRITE_PAYLOAD' });}
  if (issues.length) {
    throw new CliError(t('data_verify.preflight_failed', String(issues.length)), {
      code: 'DATA_WRITE_PREFLIGHT_FAILED', details: { issues, schemaHash: contract.schemaHash,
        retryable: false, retrySafe: true, sideEffectState: 'none', nextStep: 'resolve_fields_and_repair_payload' },
    });
  }
  return compiled;
}

function compareWriteData(expected, actual, contract) {
  const issues = [];
  const compare = (wanted, observed, parent = null, prefix = '$') => {
    if (!object(observed)) {issues.push({ path: prefix, code: 'READBACK_DATA_UNAVAILABLE' }); return;}
    for (const [id, value] of Object.entries(wanted)) {
      const location = `${prefix}[${JSON.stringify(id)}]`;
      const field = contract.fields.find(item => item.fieldId === id && item.parentFieldId === parent);
      if (!field) {issues.push({ path: location, code: 'SCHEMA_FIELD_UNAVAILABLE' }); continue;}
      const key = !own(observed, id) && field.componentType === 'AssociationFormField' ? `${id}_id` : id;
      if (!own(observed, key)) {issues.push({ path: location, fieldId: id, code: 'READBACK_FIELD_MISSING' }); continue;}
      if (field.componentType === 'TableField') {
        const rows = arrayValue(observed[key], true);
        if (!rows || rows.length !== value.length) {issues.push({ path: location, fieldId: id, code: 'READBACK_ROW_COUNT_MISMATCH' }); continue;}
        value.forEach((row, index) => compare(row, rows[index], id, `${location}[${index}]`));
        continue;
      }
      const before = canonical(field, value), after = canonical(field, observed[key], true);
      if (!before.ok || !after.ok || JSON.stringify(before.value) !== JSON.stringify(after.value)) {
        issues.push({ path: location, fieldId: id, code: 'READBACK_VALUE_MISMATCH' });
      }
    }
  };
  compare(expected, actual);
  return issues;
}

module.exports = { buildWriteContract, prepareWriteData, compareWriteData };
