'use strict';

const { normalizeSchemaFields, createSchemaHash } = require('./schema-field-resolution');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { readCanvasSubformRows } = require('./subform-readback');

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = new Set(['TextField', 'TextareaField', 'RadioField', 'SelectField']);
const numbers = new Set(['NumberField', 'RateField', 'DateField']);
const sets = new Set(['CheckboxField', 'MultiSelectField', 'EmployeeField', 'DepartmentSelectField']);
const files = new Set(['ImageField', 'AttachmentField']);
const numericText = value => typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim());

function supportsWriteComponent(type, props = {}) {
  if (type === 'AddressField') {
    return (props.addressType === undefined || props.addressType === 'ADDRESS')
      && (props.countryMode === undefined || props.countryMode === 'default');
  }
  return strings.has(type) || numbers.has(type) || sets.has(type) || files.has(type)
    || ['TableField', 'CitySelectField', 'CascadeDateField', 'AssociationFormField', 'CountrySelectField'].includes(type);
}

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
    for (let i = 0; i < 2 && typeof value === 'string' && value !== ''; i++) {
      try {value = JSON.parse(value);} catch {return null;}
    }
  }
  if (reading && (value === null || value === '')) {return [];}
  return Array.isArray(value) ? value : null;
}

// Writes use native arrays; read projections may omit target metadata, but must
// never contradict it when it is present. Shared by verified and legacy writes.
function associationValueIssue(value, props = {}, reading = false) {
  if (!Array.isArray(value)) {return { reason: 'value_must_be_array', index: null };}
  if (props.multiple === false && value.length > 1) {return { reason: 'single_selection_required', index: null };}
  const seen = new Set();
  const keys = reading ? ['instanceId'] : ['appType', 'formUuid', 'formType', 'instanceId', 'title'];
  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    if (!object(item)) {return { reason: 'item_must_be_object', index };}
    const missingFields = keys.filter(key => typeof item[key] !== 'string' || !item[key].trim());
    if (missingFields.length) {return { reason: 'required_fields_missing', index, missingFields };}
    for (const key of ['appType', 'formUuid', 'formType']) {
      if (own(item, key) && (typeof item[key] !== 'string' || !item[key].trim())) {
        return { reason: 'invalid_target_metadata', index };
      }
      const target = props.associationForm?.[key];
      if (typeof target === 'string' && target.trim() && own(item, key) && item[key] !== target) {
        return { reason: 'association_target_mismatch', index };
      }
    }
    if (!reading && item.subTitle !== undefined && typeof item.subTitle !== 'string') {
      return { reason: 'subtitle_must_be_string', index };
    }
    if (seen.has(item.instanceId)) {return { reason: 'duplicate_selection', index };}
    seen.add(item.instanceId);
  }
  return null;
}

function canonical(field, value, reading = false, props = {}) {
  const type = field.componentType;
  const supported = supportsWriteComponent(type, props);
  if (!supported) {return { ok: false, reason: 'UNSUPPORTED_COMPONENT' };}
  if ((value === null && (type !== 'AssociationFormField' || reading)) || reading && value === '') {
    return { ok: true, value: strings.has(type) || numbers.has(type) ? null : [] };
  }
  if (strings.has(type)) {
    return typeof value === 'string' ? { ok: true, value: value || null } : { ok: false };
  }
  if (numbers.has(type)) {
    const number = reading && numericText(value) ? Number(value) : value;
    return typeof number === 'number' && Number.isFinite(number) ? { ok: true, value: number } : { ok: false };
  }
  if (type === 'AddressField') {
    if (reading) {
      for (let depth = 0; depth < 2 && typeof value === 'string'; depth++) {
        try {value = JSON.parse(value);} catch {return { ok: false };}
      }
    }
    if (!object(value) || !Array.isArray(value.regionIds) || value.regionIds.length < 1 || value.regionIds.length > 4
      || !value.regionIds.every(id => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
        || typeof id === 'string' && /^[1-9]\d*$/.test(id))
      || typeof value.address !== 'string' || !Array.isArray(value.regionText)
      || value.regionText.length !== value.regionIds.length
      || !value.regionText.every(text => object(text) && Object.entries(text).some(([key, label]) => key !== 'type' && typeof label === 'string' && label.trim()))) {
      return { ok: false };
    }
    return { ok: true, value: { regionIds: value.regionIds.map(String), address: value.address } };
  }
  const list = arrayValue(value, reading);
  if (!list) {return { ok: false };}
  if (type === 'CountrySelectField') {
    if (props.multiple !== true && list.length > 1) {return { ok: false, reason: 'SINGLE_SELECTION_REQUIRED' };}
    const ids = list.map(item => reading && typeof item === 'string' ? item
      : object(item) && (reading || object(item.text) && Object.entries(item.text)
        .some(([key, label]) => key !== 'type' && typeof label === 'string' && label.trim())) ? item.value : null);
    if (!ids.every(id => typeof id === 'string' && /^[A-Z]{2}$/.test(id))) {return { ok: false };}
    if (new Set(ids).size !== ids.length) {return { ok: false, reason: 'DUPLICATE_SELECTION' };}
    return { ok: true, value: ids.slice().sort() };
  }
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
    const issue = associationValueIssue(list, props, reading);
    return issue ? { ok: false, reason: issue.reason.toUpperCase() }
      : { ok: true, value: list.map(item => item.instanceId).sort() };
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
      const normalized = canonical(field, value, false, contract.props[field.fieldId]);
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

function compareWriteData(expected, actual, contract, instValue) {
  const issues = [];
  const compare = (wanted, observed, parent = null, prefix = '$', rawEntries) => {
    if (!object(observed)) {issues.push({ path: prefix, code: 'READBACK_DATA_UNAVAILABLE' }); return;}
    for (const [id, value] of Object.entries(wanted)) {
      const location = `${prefix}[${JSON.stringify(id)}]`;
      const field = contract.fields.find(item => item.fieldId === id && item.parentFieldId === parent);
      if (!field) {issues.push({ path: location, code: 'SCHEMA_FIELD_UNAVAILABLE' }); continue;}
      // Member/department base projections contain display names; their _id
      // projections carry identity. Association base values retain priority.
      const identityProjection = ['EmployeeField', 'DepartmentSelectField', 'CountrySelectField'].includes(field.componentType)
        && own(observed, `${id}_id`);
      const key = identityProjection || !own(observed, id) && field.componentType === 'AssociationFormField' ? `${id}_id` : id;
      let found = own(observed, key), readValue = observed[key];
      const emptyCollection = (sets.has(field.componentType) || files.has(field.componentType) || field.componentType === 'CountrySelectField')
        && Array.isArray(value) && value.length === 0;
      if (!found && (field.componentType === 'AssociationFormField' || emptyCollection)) {
        let entries = rawEntries;
        if (typeof entries === 'string') {try {entries = JSON.parse(entries);} catch {entries = null;}}
        const matches = Array.isArray(entries) ? entries.filter(entry => object(entry) && entry.fieldId === id) : [];
        if (matches.length === 1 && (matches[0].componentName === undefined || matches[0].componentName === 'AssociationFormField')
          && field.componentType === 'AssociationFormField' && object(matches[0].fieldData) && own(matches[0].fieldData, 'value')) {
          found = true; readValue = matches[0].fieldData.value;
        }
        const cell = matches.length === 1 ? matches[0] : null;
        if (emptyCollection && cell?.componentName === field.componentType && object(cell.fieldData)
          && (parent === null ? !cell.rowId : typeof cell.rowId === 'string' && cell.rowId.trim())
          && !['HIDDEN', 'INVISIBLE'].includes(contract.props[id]?.behavior)
          && !['HIDDEN', 'INVISIBLE'].includes(contract.props[parent]?.behavior)
          && !['_id', '_value', '_all'].some(suffix => own(observed, id + suffix))) {
          // This API retains the stored typed cell while null collection values
          // serialize as fieldData={}. Its hidden-field filter removes cells or
          // the whole raw snapshot. Row correspondence was checked above.
          if (own(cell.fieldData, 'value')) { found = true; readValue = cell.fieldData.value; }
          else if (Object.keys(cell.fieldData).length === 0) { found = true; readValue = []; }
        }
      }
      if (!found) {issues.push({ path: location, fieldId: id, code: 'READBACK_FIELD_MISSING' }); continue;}
      if (field.componentType === 'TableField') {
        const result = readCanvasSubformRows({ formData: observed, instValue: rawEntries }, id);
        const rows = result.status === 'error' ? null : result.rows;
        if (!rows || rows.length !== value.length) {issues.push({ path: location, fieldId: id, code: 'READBACK_ROW_COUNT_MISMATCH' }); continue;}
        value.forEach((row, index) => compare(row, rows[index], id, `${location}[${index}]`, rows[index].instValue));
        continue;
      }
      const props = contract.props[id];
      const before = canonical(field, value, false, props), after = canonical(field, readValue, true, props);
      let targetMismatch = false;
      if (field.componentType === 'AssociationFormField' && before.ok && after.ok) {
        const submitted = new Map(value.map(item => [item.instanceId, item]));
        targetMismatch = (arrayValue(readValue, true) || []).some(item => {
          const expected = submitted.get(item.instanceId);
          return expected && ['appType', 'formUuid', 'formType'].some(k => own(item, k) && item[k] !== expected[k]);
        });
      }
      if (!before.ok || !after.ok || targetMismatch || JSON.stringify(before.value) !== JSON.stringify(after.value)) {
        issues.push({ path: location, fieldId: id, code: 'READBACK_VALUE_MISMATCH' });
      }
    }
  };
  compare(expected, actual, null, '$', instValue);
  return issues;
}

module.exports = { buildWriteContract, prepareWriteData, compareWriteData, associationValueIssue, supportsWriteComponent };
