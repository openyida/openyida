'use strict';

const { isDeepStrictEqual } = require('node:util');
const { CliError } = require('./cli-error');
const { t } = require('./i18n');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const emptyDate = value => value === null || value === undefined;

/** Read native component values without treating an unreadable inventory as empty. */
function readComponents(value) {
  try { if (typeof value === 'string') { value = JSON.parse(value); } } catch { return null; }
  if (!Array.isArray(value) || !value.length) { return null; }
  const fields = new Map();
  for (const component of value) {
    if (!object(component) || typeof component.fieldId !== 'string' || !component.fieldId
      || fields.has(component.fieldId) || typeof component.componentName !== 'string'
      || !object(component.fieldData)) { return null; }
    fields.set(component.fieldId, component);
  }
  return fields;
}

/** Locate validation rules in the already authorized native edit schema. */
function fieldProps(schema, fieldId) {
  const matches = [];
  const visit = nodes => {
    for (const node of nodes || []) {
      if (node.props?.fieldId === fieldId || node.fieldId === fieldId) { matches.push(node.props || {}); }
      if (Array.isArray(node.children)) { visit(node.children); }
    }
  };
  for (const page of schema?.pages || []) { visit(page.componentsTree || page.layout); }
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Clear explicitly supplied top-level dates through the native partial edit contract.
 * Ordinary updates keep their existing transport. Date clearing is a separate,
 * single-write operation: no global ignoreEmpty=n, version upgrade or automatic replay.
 */
async function clearFormDates({ data, record, editContext, target, upgradeRequested, get, post, isSuccessfulResponse }) {
  if (!object(data) || !Object.values(data).some(value => value === null || Array.isArray(value))) { return null; }
  const components = readComponents(record.instValue);
  const fields = Object.keys(data).filter(fieldId => data[fieldId] === null
    && (editContext?.fields?.get(fieldId)?.componentName === 'DateField'
      || components?.get(fieldId)?.componentName === 'DateField'));
  // A date inside a table needs row-level semantics; do not silently ignore its null.
  const nestedDateClear = (values, parentTable = null) => Object.entries(values).some(([id, value]) => {
    const field = editContext?.fields?.get(id);
    if (!field || field.parentTable !== parentTable) { return false; }
    if (field.componentName === 'DateField' && value === null) { return parentTable !== null; }
    return field.componentName === 'TableField' && Array.isArray(value)
      && value.some(row => object(row) && nestedDateClear(row, id));
  });
  const nested = nestedDateClear(data);
  if (!fields.length && !nested) { return null; }

  const preflight = reason => {
    throw new CliError(t('data_clear.preflight_failed'), {
      code: 'DATA_DATE_CLEAR_PREFLIGHT_FAILED',
      details: { target, fields, reason, retrySafe: true, mutationPerformed: false,
        sideEffectState: 'none', nextStep: 'clear_top_level_dates_separately_or_use_native_editor' },
    });
  };
  if (nested) { preflight('subform_date_clear_unsupported'); }
  if (upgradeRequested) { preflight('version_upgrade_not_supported'); }
  if (fields.length !== Object.keys(data).length) { preflight('mixed_patch_unsupported'); }
  if (!components || !/^\d+$/.test(String(record.version))
    || !/^\d+$/.test(String(record.gmtModified))) { preflight('instance_snapshot_unverified'); }
  const patch = fields.map(fieldId => {
    const component = components.get(fieldId);
    const field = editContext?.fields?.get(fieldId);
    const props = fieldProps(editContext?.schema, fieldId);
    if (!component || component.componentName !== 'DateField' || !field || field.componentName !== 'DateField' || field.parentTable !== null
      || !props) { preflight('historical_date_field_unverified'); }
    if (props.required !== undefined && props.required !== false
      || props.validation !== undefined && !Array.isArray(props.validation)
      || props.validation?.some(rule => !object(rule) || rule.type === 'required')) {
      preflight('required_or_dynamic_validation');
    }
    // Match native form submission: remove any stale display text from this date.
    return { ...component, fieldData: { value: null } };
  });

  const failure = (code, key, details = {}) => {
    throw new CliError(t(key), {
      code,
      details: { target, fields, partial: { formInstId: target.formInstId },
        retrySafe: false, readbackVerified: false, readbackAllowed: true,
        sideEffectState: 'unknown', nextStep: 'readback_existing_instance_do_not_repeat_write', ...details },
    });
  };
  let result;
  try {
    result = await post(`/dingtalk/web/${target.appType}/query/formdata/editFormData.json`, {
      formUuid: target.formUuid, formInstId: target.formInstId,
      version: String(record.version), gmtModified: String(record.gmtModified), value: JSON.stringify(patch),
    });
  } catch (error) {
    failure('DATA_DATE_CLEAR_WRITE_UNVERIFIED', 'data_clear.write_unverified', {
      ...(error.code ? { causeCode: error.code } : {}),
    });
  }
  // Preserve failed writes for read-only reconciliation; never fall back to v1.
  if (!isSuccessfulResponse(result)) {
    failure('DATA_DATE_CLEAR_WRITE_UNVERIFIED', 'data_clear.write_unverified', {
      ...(result?.errorCode !== undefined ? { causeCode: result.errorCode } : {}),
    });
  }
  const committed = { mutationAccepted: true, sideEffectState: 'committed' };
  let response;
  try {
    response = await get(`/dingtalk/web/${target.appType}/v1/form/getFormDataById.json`, {
      formInstId: target.formInstId, formUuid: target.formUuid,
    });
  } catch { failure('DATA_DATE_CLEAR_READBACK_UNVERIFIED', 'data_verify.readback_failed', committed); }
  const after = isSuccessfulResponse(response) ? (own(response, 'content') ? response.content : response) : null;
  const formIds = [after?.formUuid, after?.modelUuid].filter(value => value !== undefined && value !== null && value !== '');
  const afterComponents = readComponents(after?.instValue);
  if (!after || !formIds.length || formIds.some(id => id !== target.formUuid)
    || String(after.formInstId || after.id || '') !== target.formInstId
    || after.appType !== undefined && after.appType !== target.appType || !afterComponents) {
    failure('DATA_DATE_CLEAR_READBACK_UNVERIFIED', 'data_verify.readback_failed', committed);
  }
  const issues = [];
  if (String(after.version) !== String(record.version)) { issues.push({ path: '$.version', code: 'READBACK_VERSION_MISMATCH' }); }
  let projection = after.formData;
  try { if (typeof projection === 'string') { projection = JSON.parse(projection); } } catch { projection = null; }
  for (const fieldId of fields) {
    const date = afterComponents.get(fieldId);
    if (!date || date.componentName !== 'DateField' || !emptyDate(date.fieldData.value)
      || object(projection) && own(projection, fieldId) && !emptyDate(projection[fieldId]) && projection[fieldId] !== '') {
      issues.push({ fieldId, code: 'READBACK_DATE_NOT_EMPTY' });
    }
  }
  // Compare only returned native fields. Missing/hidden values are never invented.
  const preservedFields = [];
  const allIds = new Set([...components.keys(), ...afterComponents.keys()]);
  for (const fieldId of allIds) {
    if (fields.includes(fieldId)) { continue; }
    const beforeValue = components.get(fieldId);
    const afterValue = afterComponents.get(fieldId);
    if (!beforeValue || !afterValue || beforeValue.componentName !== afterValue.componentName
      || !isDeepStrictEqual(beforeValue.fieldData, afterValue.fieldData)) {
      issues.push({ fieldId, code: 'READBACK_UNTOUCHED_FIELD_CHANGED' });
    } else { preservedFields.push(fieldId); }
  }
  if (issues.length) { failure('DATA_DATE_CLEAR_READBACK_MISMATCH', 'data_clear.readback_mismatch', { ...committed, issues }); }
  return { ...result, formInstId: target.formInstId, readbackVerified: true,
    verification: { scope: 'returned_native_fields', verifiedFields: fields, preservedFields,
      instanceVersion: after.version, expectedVersion: String(record.version) } };
}

module.exports = { clearFormDates };
