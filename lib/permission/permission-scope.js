'use strict';

const { randomUUID } = require('crypto');
const { createYidaClient } = require('../core/yida-client');
const { extractProcessFields } = require('../process/services/process-form-fields');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const FIELD_ACCESS = {
  view: 'FORM_FIELD_VIEW', edit: 'FORM_FILED_EDIT',
  hidden: 'FORM_FIELD_HIDDEN', encrypt: 'FORM_FIELD_ENCRYPT',
};

function invalid(reason, details = {}) {
  throw new CliError(t('permission_scope.invalid', reason), {
    code: 'PERMISSION_SCOPE_INVALID', details: { ...details, remoteWrites: 0 },
  });
}

function parseFieldAccess(values) {
  const changes = new Map();
  for (const value of values) {
    const match = /^([^:\s]+):(view|edit|hidden|encrypt)$/.exec(value);
    if (!match || changes.has(match[1])) { invalid('--field-access'); }
    changes.set(match[1], FIELD_ACCESS[match[2]]);
  }
  return changes;
}

async function readScopeFields(authRef, appType, formUuid) {
  const response = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`, { formUuid, schemaVersion: 'V5' }
  );
  return extractProcessFields(response).fields;
}

function ownerDataPermission(fieldId, fields) {
  const field = fields.find(item => item.fieldId === fieldId);
  if (!field || field.componentName !== 'EmployeeField' || field.parentFieldId) {
    throw new CliError(t('permission_scope.owner_invalid'), {
      code: 'PERMISSION_OWNER_FIELD_INVALID', details: { fieldId, remoteWrites: 0 },
    });
  }
  const groupId = `group-${randomUUID()}`;
  // DataPermissionConverter accepts contain + ${loginUser} for an EmployeeField.
  return {
    dataRange: 'FORMULA',
    formulaData: {
      condition: 'AND', ruleId: groupId,
      rules: [{
        id: fieldId, fieldId, componentType: 'EmployeeField', type: 'EmployeeField',
        name: field.label, label: field.label, op: 'contain',
        value: '${loginUser}', ruleValue: '${loginUser}', extValue: 'field', valueType: 'value',
        entityType: 'Default', filterType: 'bizField',
        ruleId: `item-${randomUUID()}`, parentId: groupId,
      }],
    },
  };
}

function patchFieldAccess(existing, changes, defaultAccess, fields) {
  const before = typeof existing === 'string' ? JSON.parse(existing) : existing || { fieldRange: 'FORM' };
  if (!['FORM', 'CUSTOM'].includes(before.fieldRange)) { invalid('fieldRange'); }
  if (before.fieldRange !== 'CUSTOM' && !defaultAccess) {
    throw new CliError(t('permission_scope.field_default_required'), {
      code: 'PERMISSION_FIELD_DEFAULT_REQUIRED', details: { remoteWrites: 0 },
    });
  }
  if (defaultAccess && !Object.prototype.hasOwnProperty.call(FIELD_ACCESS, defaultAccess)) { invalid('--field-default'); }
  if (before.fieldRange === 'CUSTOM' && defaultAccess) { invalid('--field-default conflicts with existing CUSTOM'); }
  const known = new Map(fields.map(field => [field.fieldId, field]));
  for (const id of changes.keys()) {
    if (!known.has(id)) { invalid('--field-access', { fieldId: id }); }
  }
  const list = before.fieldRange === 'CUSTOM' ? before.fieldStatus : fields.map(field => ({
    label: field.fieldId, fieldName: field.label || field.fieldId,
    componentName: field.componentName, value: FIELD_ACCESS[defaultAccess],
  }));
  assertFieldPermissionMapping({ fieldRange: 'CUSTOM', fieldStatus: list }, fields);
  const patched = list.map(item => ({ ...item }));
  for (const [id, value] of changes) {
    const field = known.get(id);
    const index = patched.findIndex(item => item.label === id);
    if (index < 0) {
      patched.push({ label: id, fieldName: field.label || id, componentName: field.componentName, value });
    } else { patched[index].value = value; }
  }
  for (const [id, value] of changes) {
    if (value !== FIELD_ACCESS.edit) { continue; }
    for (const parentId of known.get(id).fieldPath.slice(0, -1)) {
      if (!patched.some(item => item.label === parentId && item.value === FIELD_ACCESS.edit)) {
        invalid('editable subtable field requires editable parent', { fieldId: id, parentFieldId: parentId });
      }
    }
  }
  return { ...before, fieldRange: 'CUSTOM', fieldStatus: patched };
}

function assertFieldPermissionMapping(permit, fields = []) {
  if (permit.fieldRange !== 'CUSTOM') { return; }
  const list = permit.fieldStatus;
  if (!Array.isArray(list) || !list.length) { invalid('fieldStatus'); }
  const known = new Map(fields.map(field => [field.fieldId, field]));
  const seen = new Set();
  for (const item of list) {
    if (!item || ['label', 'fieldName', 'componentName'].some(key => typeof item[key] !== 'string' || !item[key].trim())
      || !Object.values(FIELD_ACCESS).includes(item.value) || seen.has(item.label)) { invalid('fieldStatus'); }
    seen.add(item.label);
    // Native fieldStatus uses label as the ID; fieldName is only display text.
    // Preserve unrelated layout/retired entries, but never silently migrate a reversed mapping.
    if (!known.has(item.label) && known.has(item.fieldName)) {
      invalid('fieldStatus.label must contain the field ID', { fieldId: item.fieldName });
    }
    if (known.has(item.label) && known.get(item.label).componentName !== item.componentName) {
      invalid('fieldStatus.componentName', { fieldId: item.label });
    }
  }
}

function isolationWarnings(packages, targetUuid) {
  return packages.filter(pkg => pkg.packageUuid !== targetUuid).map(pkg => ({
    packageUuid: pkg.packageUuid, packageName: pkg.packageName,
    roleData: pkg.roleData, dataPermit: pkg.dataPermit, fieldPermit: pkg.fieldPermit,
  }));
}

function permissionPreview(before, after, packages, ownerField) {
  const otherPackages = ownerField ? isolationWarnings(packages, before && before.packageUuid) : [];
  const decode = pkg => pkg && Object.fromEntries(['packageUuid', 'packageType', 'packageName',
    'roleData', 'dataPermit', 'operatePermit', 'fieldPermit'].filter(key => pkg[key] !== undefined)
    .map(key => [key, typeof pkg[key] === 'string' && /^[{[]/.test(pkg[key]) ? JSON.parse(pkg[key]) : pkg[key]]));
  return { success: true, dryRun: true, remoteWrites: 0, before: decode(before), after: decode(after),
    effectiveAccessVerified: false, otherPackagesToReview: otherPackages,
    notice: t('permission_scope.overlap_notice') };
}

module.exports = { FIELD_ACCESS, parseFieldAccess, readScopeFields, ownerDataPermission,
  patchFieldAccess, assertFieldPermissionMapping, isolationWarnings, permissionPreview };
