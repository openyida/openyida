'use strict';

function normalizeSourceFormType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'process' || normalized === 'process_form') {
    return 'process';
  }
  if (normalized === 'form' || normalized === 'receipt' || normalized === 'normal' || normalized === 'normal_form') {
    return 'receipt';
  }
  return '';
}

function isGetSelfNode(node = {}) {
  return node.type === 'getSelf' || node.getSelf;
}

function resolveSourceFormUuid(node = {}, context = {}) {
  return node.formUuid || node.sourceId || (isGetSelfNode(node) ? context.formUuid : '');
}

function resolveContextSourceForm(node = {}, context = {}) {
  const formUuid = resolveSourceFormUuid(node, context);
  if (!formUuid) {
    return null;
  }
  const forms = context.dataSourceFormsByUuid;
  if (forms instanceof Map) {
    return forms.get(String(formUuid)) || forms.get(formUuid) || null;
  }
  if (forms && typeof forms === 'object') {
    return forms[String(formUuid)] || null;
  }
  if (context.dataSourceForm && String(context.dataSourceForm.formUuid) === String(formUuid)) {
    return context.dataSourceForm;
  }
  return null;
}

function resolveDataSourceFormType(node = {}, context = {}) {
  const explicitType = normalizeSourceFormType(
    node.formType || node.sourceFormType || node.originalType,
  );
  if (explicitType) {
    return explicitType;
  }

  const sourceForm = resolveContextSourceForm(node, context);
  const sourceType = normalizeSourceFormType(sourceForm && sourceForm.formType);
  if (sourceType) {
    return sourceType;
  }

  return normalizeSourceFormType(context.defaultFormType);
}

function resolveDataSourceFormName(node = {}, context = {}) {
  const sourceForm = resolveContextSourceForm(node, context);
  if (sourceForm && sourceForm.formName) {
    return String(sourceForm.formName);
  }
  const explicitName = node.formName || node.sourceFormName || node.dataFormName;
  if (explicitName) {
    return String(explicitName);
  }
  return context.defaultFormName ? String(context.defaultFormName) : '';
}

function resolveDataOriginalType(sourceFormType) {
  return normalizeSourceFormType(sourceFormType) === 'process' ? 'process_form' : 'form';
}

function resolveDataFormItemType(sourceFormType) {
  return normalizeSourceFormType(sourceFormType) === 'process' ? 'process' : 'receipt';
}

function isSubTableOriginalType(value) {
  return String(value || '').trim().toLowerCase() === 'sub_table';
}

function resolveDataQueryField(node = {}, sourceFormType) {
  if (node.queryField) {
    return toRuntimeDataQueryField(node.queryField, sourceFormType);
  }
  if (isGetSelfNode(node)) {
    return normalizeSourceFormType(sourceFormType) === 'process' ? 'pid' : 'form_inst_id';
  }
  return '';
}

function toRuntimeDataQueryField(fieldId, sourceFormType) {
  if (normalizeSourceFormType(sourceFormType) === 'process' && fieldId === 'proc_inst_id') {
    return 'pid';
  }
  return fieldId;
}

function toDesignerDataQueryField(fieldId, sourceFormType) {
  if (normalizeSourceFormType(sourceFormType) === 'process' && fieldId === 'pid') {
    return 'proc_inst_id';
  }
  return fieldId;
}

function normalizeDataQueryFieldName(fieldId, sourceFormType, fieldName) {
  const isProcessInstanceField = fieldId === 'pid' || fieldId === 'proc_inst_id';
  if (normalizeSourceFormType(sourceFormType) === 'process' && isProcessInstanceField) {
    return resolveDataQueryFieldName(sourceFormType);
  }
  return fieldName;
}

function resolveDesignerDataQueryField(node = {}, sourceFormType) {
  return toDesignerDataQueryField(resolveDataQueryField(node, sourceFormType), sourceFormType);
}

function resolveDataQueryFieldName(sourceFormType) {
  return normalizeSourceFormType(sourceFormType) === 'process' ? '流程实例ID' : '表单实例ID';
}

module.exports = {
  normalizeSourceFormType,
  isGetSelfNode,
  resolveSourceFormUuid,
  resolveDataSourceFormName,
  resolveDataSourceFormType,
  resolveDataOriginalType,
  resolveDataFormItemType,
  isSubTableOriginalType,
  resolveDataQueryField,
  toRuntimeDataQueryField,
  toDesignerDataQueryField,
  normalizeDataQueryFieldName,
  resolveDesignerDataQueryField,
  resolveDataQueryFieldName,
};
