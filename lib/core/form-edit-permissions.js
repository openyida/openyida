'use strict';

const { CliError } = require('./cli-error');
const { t } = require('./i18n');

const BEHAVIORS = new Set(['NORMAL', 'READONLY', 'DISABLED', 'HIDDEN']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function stop(code, key, target, details = {}) {
  const stage = details.stage || 'preflight';
  throw new CliError(t(`query_data.${key}`, (details.fields || []).map(field => field.path).join(', ')), {
    code,
    details: {
      target, stage, retryable: false,
      ...(stage === 'preflight' ? { mutationPerformed: false, retrySafe: true, sideEffectState: 'not_started',
        nextStep: key === 'form_update_forbidden' ? 'request_edit_permission' : 'use_native_form_editor' }
        : { retrySafe: false, sideEffectState: 'unknown', nextStep: 'read_back_before_retry' }), ...details,
    },
  });
}

function unverified(target, reason) {
  stop('DATA_FORM_EDIT_CONTEXT_UNVERIFIED', 'edit_context_unverified', target, { reason });
}

function readContent(response, target) {
  assertFormUpdatePermissionResponse(response, target);
  if (!response || response.success !== true || !response.content) {
    unverified(target, 'permission_read_failed');
  }
  let content = response.content;
  try { if (typeof content === 'string') { content = JSON.parse(content); } } catch {
    unverified(target, 'permission_response_invalid');
  }
  if (!isObject(content)) { unverified(target, 'permission_response_invalid'); }
  return content;
}

function assertFormUpdatePermissionResponse(response, target, stage = 'preflight') {
  if (!response || response.success !== false || response.__needLogin) { return; }
  const message = String(response.errorMsg || '').trim().replace(/[。.!！]+$/, '');
  const denied = String(response.errorCode) === '403'
    || /^(没有权限|无权限|无访问权限|您无更改该数据的权限|no permission|permission denied|forbidden)$/i.test(message);
  if (!denied) { return; }
  stop('DATA_FORM_UPDATE_FORBIDDEN', 'form_update_forbidden', target, {
    stage,
    causeCode: response.errorCode, causeMessage: response.errorMsg,
    ...(response.traceId ? { traceId: response.traceId } : {}),
  });
}

function hasDynamicBehavior(props) {
  return ['itemBehavior', 'fieldBehavior'].some(key => {
    const value = props[key];
    return value !== undefined && value !== null && value !== false && value !== '';
  });
}

function restrictedFlag(value) {
  return value !== undefined && value !== false && value !== null;
}

function effectiveBehavior(node, entry, isField) {
  const props = node.props || {};
  if (node.condition === false) { return 'HIDDEN'; }
  if (node.condition !== undefined && node.condition !== true) { return 'UNVERIFIED'; }
  if (hasDynamicBehavior(props)) { return 'UNVERIFIED'; }
  // Follow yc-utils getPageEditMode: hidden/disabled override NORMAL.
  // Do not use entry.readOnly: the native API also sets it on NORMAL fields.
  if ((entry && restrictedFlag(entry.hidden)) || restrictedFlag(props.hidden)) { return 'HIDDEN'; }
  if ((entry && restrictedFlag(entry.disabled)) || restrictedFlag(props.disabled)) { return 'DISABLED'; }
  const behavior = entry ? entry.fieldBehavior : props.behavior;
  if (behavior === undefined && !isField) { return null; } // neutral layout container
  if (isField && !entry) { return 'UNVERIFIED'; }
  return BEHAVIORS.has(behavior) ? behavior : 'UNVERIFIED';
}

/** Build an instance-scoped whitelist, never a union of administrator permission groups. */
function readEditableFields(response, target) {
  const schema = readContent(response, target);
  const pages = Array.isArray(schema.pages) ? schema.pages.filter(page => page.id === target.formUuid) : [];
  if (pages.length !== 1 || (schema.formUuid && schema.formUuid !== target.formUuid)) {
    unverified(target, 'schema_target_mismatch');
  }
  const candidates = Array.isArray(schema.instanceData) ? schema.instanceData : [schema.instanceData];
  const instances = candidates.filter(instance => instance && instance.id === target.formUuid);
  if (instances.length !== 1) { unverified(target, 'instance_context_mismatch'); }
  const instance = instances[0];
  if (instance.formInstId && instance.formInstId !== target.formInstId) {
    unverified(target, 'instance_target_mismatch');
  }
  const behaviors = instance.flowData && instance.flowData.behaviors;
  if (!Array.isArray(behaviors) || !behaviors.length) { unverified(target, 'field_behaviors_missing'); }
  const byId = new Map();
  behaviors.forEach(entry => {
    if (!isObject(entry) || typeof entry.fieldId !== 'string' || !entry.fieldId || byId.has(entry.fieldId)) {
      unverified(target, 'field_behaviors_ambiguous');
    }
    byId.set(entry.fieldId, entry);
  });

  const fields = new Map();
  const seen = new Set();
  function visit(nodes, ancestors = [], tables = []) {
    if (!Array.isArray(nodes)) { unverified(target, 'component_tree_invalid'); }
    nodes.forEach(node => {
      if (!isObject(node) || (node.props !== undefined && !isObject(node.props))) {
        unverified(target, 'component_tree_invalid');
      }
      const props = node.props || {};
      const fieldId = props.fieldId || node.fieldId;
      const isField = /Field$/.test(node.componentName || '');
      const entry = byId.get(fieldId);
      if (fieldId) {
        if (seen.has(fieldId)) { unverified(target, 'component_id_ambiguous'); }
        seen.add(fieldId);
      }
      if (entry && entry.componentName && entry.componentName !== node.componentName) {
        unverified(target, 'component_type_mismatch');
      }
      if (entry && entry.parentFieldId && entry.parentFieldId !== tables[tables.length - 1]) {
        unverified(target, 'component_parent_mismatch');
      }
      const behavior = effectiveBehavior(node, entry, isField);
      const restrictions = [...ancestors];
      if (behavior && behavior !== 'NORMAL') { restrictions.push({ fieldId, behavior }); }
      if (isField && fieldId) {
        fields.set(fieldId, {
          fieldId, componentName: node.componentName, behavior, restrictions,
          parentTable: tables[tables.length - 1] || null, tables,
          restrictedTableOperations: ['addButtonBehavior', 'delButtonBehavior']
            .some(key => props[key] && props[key] !== 'NORMAL'),
        });
      }
      if (node.children !== undefined && node.children !== null) {
        // yc-utils propagates hidden/disabled containers and readonly tables;
        // READONLY on a plain layout does not override a NORMAL child field.
        const inherited = !isField && behavior === 'READONLY' ? ancestors : restrictions;
        visit(node.children, inherited, node.componentName === 'TableField' && fieldId ? [...tables, fieldId] : tables);
      }
    });
  }
  visit(pages[0].componentsTree || pages[0].layout);
  if (!fields.size) { unverified(target, 'fields_missing'); }
  return fields;
}

function assertEditablePatch(data, fields, target) {
  if (!isObject(data) || !Object.keys(data).length) { unverified(target, 'invalid_field_patch'); }
  const rejected = [];
  let permissionDenied = false;
  const denied = field => field && (['READONLY', 'HIDDEN', 'DISABLED'].includes(field.behavior)
    || field.restrictions.some(item => ['READONLY', 'HIDDEN', 'DISABLED'].includes(item.behavior)));
  function reject(path, reason, field) {
    rejected.push({ path: path.join('.'), reason, behavior: field && field.behavior });
    if (denied(field)) { permissionDenied = true; }
  }
  function visit(values, parentTable = null, path = []) {
    Object.entries(values).forEach(([fieldId, value]) => {
      const fieldPath = [...path, fieldId];
      const field = fields.get(fieldId);
      if (!field || field.parentTable !== parentTable) {
        reject(fieldPath, 'unknown_or_misplaced_field', field); return;
      }
      if (field.behavior !== 'NORMAL' || field.restrictions.length) {
        reject(fieldPath, 'field_not_editable', field); return;
      }
      if (field.componentName !== 'TableField') { return; }
      if (field.restrictedTableOperations) {
        reject(fieldPath, 'subform_operations_not_editable', field); return;
      }
      // v1 replaces a table value. Even omitted readonly columns can be changed by
      // row deletion/replacement, so every descendant must be provably editable.
      const columns = [...fields.values()].filter(column => column.tables.includes(fieldId));
      if (!columns.length || columns.some(column => column.behavior !== 'NORMAL' || column.restrictions.length)) {
        if (columns.some(denied)) { permissionDenied = true; }
        reject(fieldPath, 'subform_replacement_not_editable', field); return;
      }
      if (!Array.isArray(value)) { reject(fieldPath, 'subform_rows_invalid', field); return; }
      value.forEach((row, index) => {
        if (!isObject(row)) { reject([...fieldPath, index], 'subform_row_invalid', field); return; }
        visit(row, fieldId, [...fieldPath, index]);
      });
    });
  }
  visit(data);
  if (rejected.length) {
    stop('DATA_FORM_FIELDS_NOT_EDITABLE', permissionDenied ? 'form_update_forbidden' : 'fields_not_editable',
      target, { fields: rejected });
  }
}

/** Read native edit context with the same authRef immediately before the mutation. */
async function assertFormUpdatePermissions({ get, appType, formUuid, formInstId, data }) {
  const target = { appType, formUuid, formInstId };
  const params = { formUuid, formInstId };
  let operationResponse;
  let schemaResponse;
  try {
    operationResponse = await get(`/dingtalk/web/${appType}/query/formdata/queryOperatePermission.json`, params);
    const operations = readContent(operationResponse, target);
    if (operations.OPERATE_EDIT !== 'y' && operations.OPERATE_EDIT_AFTER_PROCESS !== 'y') {
      stop('DATA_FORM_UPDATE_FORBIDDEN', 'form_update_forbidden', target);
    }
    schemaResponse = await get(`/dingtalk/web/${appType}/query/formdata/getFormEditSchema.json`, params);
  } catch (error) {
    if (error instanceof CliError) { throw error; }
    unverified(target, 'edit_context_read_failed');
  }
  assertEditablePatch(data, readEditableFields(schemaResponse, target), target);
}

module.exports = { assertFormUpdatePermissions, assertFormUpdatePermissionResponse };
