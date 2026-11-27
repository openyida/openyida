'use strict';

const { isDeepStrictEqual } = require('util');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { retrieveMode } = require('./integration-batch-data');
const { getFirstNonNullishOwnValue } = require('./integration-process-builder');

function invalid(node, reason) {
  throw new CliError(t('integration.data_delete_invalid', node.id || node.key || node.source || ''), {
    code: 'INTEGRATION_DATA_DELETE_INVALID',
    details: { reason, node: node.id || node.key, source: node.source, remoteWrites: 0 },
  });
}

function validateDeleteSource(node, source, sourceType, recursive) {
  if (Object.keys(node).some(key => !['id', 'key', 'type', 'componentName', 'name', 'description', 'source'].includes(key))) {
    invalid(node, 'UNSUPPORTED_DELETE_OPTION');
  }
  if (typeof node.source !== 'string' || !node.source.trim() || !source || sourceType !== 'dataRetrieve') {
    invalid(node, 'UPSTREAM_QUERY_REQUIRED');
  }
  if (recursive || source.getSelf || source.subSourceId || source.originalType && source.originalType !== 'form'
    || source.appType || source.sourceAppType || !(source.formUuid || source.sourceId)) {
    invalid(node, 'ORDINARY_FORM_QUERY_REQUIRED');
  }
  const conditions = source.conditions || source.dataConditions;
  const logic = source.logic || source.conditionLogic || 'AND';
  if (source.filterType && source.filterType !== 'condition'
    || !Array.isArray(conditions) || !conditions.length || !['AND', 'OR'].includes(String(logic).toUpperCase())) {
    invalid(node, 'NONEMPTY_FILTER_REQUIRED');
  }
  const mode = retrieveMode(source);
  const quantity = Number(source.quantity);
  if (mode === 'batch' && (!Number.isSafeInteger(quantity) || quantity < 1)
    || mode === 'single' && source.quantity !== undefined && quantity !== 1) {
    invalid(node, 'FINITE_QUERY_LIMIT_REQUIRED');
  }
  for (const condition of conditions) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) { invalid(node, 'INVALID_FILTER'); }
    const fieldId = condition.bFieldId || condition.fieldId || condition.id;
    const component = condition.componentType || 'TextField';
    const value = getFirstNonNullishOwnValue(condition, ['aFieldId', 'value', 'ruleValue']).value;
    const safeLiteral = component === 'TextField' ? typeof value === 'string' && value.trim()
      && !value.includes('${') && !value.includes('#{') : component === 'NumberField' && Number.isFinite(value);
    if (typeof fieldId !== 'string' || !fieldId.trim() || condition.valueType !== 'literal'
      || (condition.opCode || condition.op) !== 'Equal' || !safeLiteral) {
      invalid(node, 'TYPED_LITERAL_EQUALITY_REQUIRED');
    }
  }
}

function validateDeleteTarget(node, source, forms, schemas) {
  const formUuid = source.formUuid || source.sourceId;
  const form = forms.get(formUuid);
  if (form?.formType !== 'receipt' || form.metadataVerified !== true) {
    invalid(node, 'ORDINARY_FORM_IDENTITY_UNVERIFIED');
  }
  const schema = schemas.get(formUuid) || [];
  const nestedFields = new Set();
  function collectNested(nodes) {
    for (const child of nodes || []) {
      if (child?.props?.fieldId) { nestedFields.add(child.props.fieldId); }
      collectNested(child?.children);
    }
  }
  for (const field of schema.filter(field => field.componentName === 'TableField')) {
    collectNested(field.children);
    collectNested(field.props?.children);
  }
  for (const condition of source.conditions || source.dataConditions) {
    const fieldId = condition.bFieldId || condition.fieldId || condition.id;
    const matches = schema.filter(field => field.props?.fieldId === fieldId);
    if (matches.length !== 1 || nestedFields.has(fieldId)
      || matches[0].componentName !== (condition.componentType || 'TextField')) {
      invalid(node, 'FILTER_FIELD_NOT_IN_TARGET_SCHEMA');
    }
  }
}

function visitDeletes(nodes, visitor, inherited = new Map()) {
  if (!Array.isArray(nodes) || !nodes.length) { return; }
  const upstream = new Map(inherited);
  for (const node of nodes) {
    if (node?.componentName === 'DeleteDataNode') {
      visitor(node, upstream.get(node.props?.deleteData?.sourceId));
    }
    visitDeletes(node?.children, visitor, upstream);
    if (['GetSingleDataNode', 'GetBatchDataNode'].includes(node?.componentName)) {
      upstream.set(node.id, node);
    }
  }
}

function bindDeleteViewSources(view) {
  visitDeletes(view.schema.children, (node, source) => {
    if (!source) { invalid({ id: node.id }, 'DESIGNER_SOURCE_UNVERIFIED'); }
    node.props.deleteData.targetItem = {
      componentName: source.componentName, label: source.props.title || source.props.name,
      value: source.id, type: 'node', props: source.props.getData,
    };
  });
}

function projectDataDeletes(view) {
  const result = [];
  visitDeletes(view?.schema?.children, (node, source) => {
    const rule = node.props?.deleteData;
    const get = source?.props?.getData;
    result.push({
      id: node.id, type: rule?.type, sourceId: rule?.sourceId, targetItemId: rule?.targetItem?.value,
      targetItemType: rule?.targetItem?.type, subSourceId: rule?.subSourceId || '',
      sourceType: source?.componentName, appType: get?.appType, targetAppType: get?.targetItem?.appType,
      formUuid: get?.sourceId, originalType: get?.originalType, sourceSubId: get?.subSourceId || '',
      targetFormUuid: get?.targetItem?.formItem?.formUuid, targetFormType: get?.targetItem?.formItem?.formType,
      filterType: get?.filterType, quantity: Number(get?.quantity), sort: get?.sort,
      logic: get?.condition?.condition, conditionCode: get?.condition?.conditionCode,
      conditions: Array.isArray(get?.condition?.rules) ? get.condition.rules.map(item => ({
        id: item?.id, opCode: item?.opCode, componentType: item?.componentType,
        valueType: item?.valueType, value: item?.value, ruleValue: item?.ruleValue,
      })) : null,
    });
  });
  return result;
}

function verifyDataDeletes(view, expected) {
  if (!isDeepStrictEqual(projectDataDeletes(view), expected)) {
    throw new CliError(t('integration.data_delete_readback_mismatch'), {
      code: 'INTEGRATION_READBACK_DATA_DELETE_MISMATCH',
    });
  }
}

module.exports = { validateDeleteSource, validateDeleteTarget, bindDeleteViewSources, projectDataDeletes, verifyDataDeletes };
