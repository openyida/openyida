'use strict';

const crypto = require('crypto');

function parseObject(value) {
  if (typeof value !== 'string') {
    return value && typeof value === 'object' ? value : null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function resolveContent(schemaResult) {
  if (!schemaResult) {return null;}
  return parseObject(schemaResult.content !== undefined ? schemaResult.content : schemaResult);
}

function labelText(label) {
  if (label === null || label === undefined) {return '';}
  if (typeof label === 'object') {
    return String(label.zh_CN || label.zh_HK || label.en_US || label.text || label.label || '');
  }
  return String(label);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function isPresent(value) {
  if (value === null || value === undefined || value === '') {return false;}
  if (Array.isArray(value)) {return value.length > 0;}
  if (typeof value === 'object') {return Object.keys(value).length > 0;}
  return true;
}

function hasFormulaSemantics(value) {
  if (!isPresent(value)) {return false;}
  if (typeof value === 'string') {return value.trim() !== '';}
  if (Array.isArray(value)) {return value.length > 0;}
  if (typeof value !== 'object') {return true;}
  if (['expression', 'source', 'value', 'formula'].some(key => isPresent(value[key]))) {
    return true;
  }
  if (Array.isArray(value.data) && value.data.length > 0) {return true;}
  if (value.event && typeof value.event === 'object') {
    return Object.values(value.event).some(events => Array.isArray(events) ? events.length > 0 : isPresent(events));
  }
  return false;
}

function extractFunctionNames(source) {
  const names = [];
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /exports\.([A-Za-z_$][\w$]*)\s*=\s*/g,
    /module\.exports\.([A-Za-z_$][\w$]*)\s*=\s*/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      names.push(match[1]);
    }
  }
  return unique(names);
}

function extractUrlParams(source) {
  const keys = [];
  const pattern = /urlParams(?:\.([A-Za-z_$][\w$]*)|\[['"]([^'"]+)['"]\])/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    keys.push(match[1] || match[2]);
  }
  return unique(keys);
}

function extractFieldMutations(source) {
  const mutations = [];
  const pattern = /this\.\$\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*(setValue|setBehavior|reset|validate|show|hide)\s*\(/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    mutations.push({ fieldId: match[1], operation: match[2] });
  }
  const seen = new Set();
  return mutations.filter((item) => {
    const key = `${item.fieldId}:${item.operation}`;
    if (seen.has(key)) {return false;}
    seen.add(key);
    return true;
  });
}

function bindingsFromValue(value, path, fieldId, requiresDesignerBinding) {
  if (!value || typeof value !== 'object') {return [];}
  const event = path[path.length - 1] || '';
  if (value.type === 'JSExpression' && Array.isArray(value.events)) {
    const expression = String(value.value || '');
    return value.events.filter(item => item && item.type === 'actionRef').map(item => {
      const actionName = item.name || item.id || '';
      return {
        event,
        actionName,
        fieldId: fieldId || '',
        bindingFormat: 'designerEventFlow',
        designerBindingFound: expression.includes('legaoBuiltin.execEventFlow') &&
          expression.includes('this.' + actionName),
      };
    });
  }
  if (value.type !== 'actionRef') {return [];}
  return [{
    event,
    actionName: value.name || value.id || '',
    fieldId: fieldId || '',
    bindingFormat: 'legacyActionRef',
    designerBindingFound: !requiresDesignerBinding,
  }];
}

function buildSemanticAnalysis(appType, formUuid, schemaResult, fieldSummary = []) {
  const content = resolveContent(schemaResult) || {};
  const actionModule = content.actions && content.actions.module || {};
  const source = typeof actionModule.source === 'string' ? actionModule.source : '';
  const compiled = typeof actionModule.compiled === 'string' ? actionModule.compiled : '';
  const fieldBehaviors = [];
  const bindings = [];
  let associationRuleCount = 0;

  function visit(value, path = [], parentFieldId = '', parentRequiresDesignerBinding = false) {
    if (!value) {return;}
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(
        item,
        path.concat(index),
        parentFieldId,
        parentRequiresDesignerBinding
      ));
      return;
    }
    if (typeof value !== 'object') {return;}

    const props = value.props || {};
    const fieldId = props.fieldId ? String(props.fieldId) : parentFieldId;
    const requiresDesignerBinding = props.fieldId && /Field$/.test(String(value.componentName || ''))
      ? true
      : parentRequiresDesignerBinding;
    const valueBindings = bindingsFromValue(value, path, fieldId, requiresDesignerBinding);
    if (valueBindings.length > 0) {
      bindings.push(...valueBindings);
      return;
    }

    if (Array.isArray(props.associationRules)) {
      associationRuleCount += props.associationRules.length;
    }
    if (props.fieldId) {
      const validation = Array.isArray(props.validation) ? props.validation : [];
      const validationTypes = unique(validation.map(rule => rule && (rule.type || rule.name || (rule.required ? 'required' : ''))));
      const behavior = props.behavior && props.behavior !== 'NORMAL' ? String(props.behavior) : '';
      const formula = hasFormulaSemantics(props.formula)
        || hasFormulaSemantics(props.defaultDataSource && props.defaultDataSource.formula);
      const dataSourceUrl = props.remoteDataSource && props.remoteDataSource.url
        || props.dataSource && !Array.isArray(props.dataSource) && props.dataSource.url
        || props.dataSource && props.dataSource.searchConfig && props.dataSource.searchConfig.url
        || '';
      const hasDataSourceBinding = !!(
        props.remoteDataSource
        || dataSourceUrl
        || props.dataSourceLinkage
        || (props.dataSourceType && props.dataSourceType !== 'custom')
      );
      const association = props.associationForm || props.associationFormConfig || null;
      if (behavior || validationTypes.length || formula || hasDataSourceBinding || association) {
        fieldBehaviors.push({
          fieldId: String(props.fieldId),
          label: labelText(props.label),
          componentName: value.componentName || '',
          ...(behavior ? { behavior } : {}),
          ...(validationTypes.length ? { validationTypes } : {}),
          ...(formula ? { hasFormulaOrLinkage: true } : {}),
          ...(hasDataSourceBinding ? {
            dataSource: {
              type: props.dataSourceType || (props.remoteDataSource ? 'remote' : 'linked'),
              hasUrl: !!dataSourceUrl,
            },
          } : {}),
          ...(association ? {
            association: {
              formUuid: association.formUuid || association.targetFormUuid || association.formId || '',
              hasBackfill: !!(association.backfill || association.backfillRules || association.fillRules),
            },
          } : {}),
        });
      }
    }

    Object.keys(value).forEach((key) => {
      if (key !== 'source' && key !== 'compiled') {
        visit(value[key], path.concat(key), fieldId, requiresDesignerBinding);
      }
    });
  }

  visit(content.pages || []);

  const actionList = content.actions && Array.isArray(content.actions.list)
    ? content.actions.list
    : [];
  const actionEntries = actionList.map(item => ({
    id: item.id || item.name || '',
    name: item.name || item.title || item.id || '',
    type: item.type || '',
    relatedEventId: item.relatedEventId || '',
  }));
  const actionFunctions = extractFunctionNames(source);
  const verifiedBindings = bindings.map(binding => {
    const actionFunctionFound = actionFunctions.includes(binding.actionName);
    const actionEntryFound = actionEntries.some(entry => entry.id === binding.actionName || entry.name === binding.actionName);
    return Object.assign({}, binding, {
      actionFunctionFound,
      actionEntryFound,
      verified: actionFunctionFound && actionEntryFound && binding.designerBindingFound,
    });
  });
  const mutationFields = unique(extractFieldMutations(source).map(item => item.fieldId));

  return {
    kind: 'yida_schema_semantic_analysis',
    contractVersion: 1,
    resource: {
      appType,
      formUuid,
      schemaHash: `sha256:${crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')}`,
    },
    fieldCount: fieldSummary.length,
    fields: fieldSummary,
    semantics: {
      actions: {
        sourceBytes: Buffer.byteLength(source, 'utf8'),
        compiledBytes: Buffer.byteLength(compiled, 'utf8'),
        functions: actionFunctions,
        entries: actionEntries,
        bindings: verifiedBindings,
        urlParams: extractUrlParams(source),
        fieldMutations: extractFieldMutations(source),
        referencedMutationFields: mutationFields,
      },
      fieldBehaviors,
      associationRuleCount,
    },
  };
}

module.exports = {
  buildSemanticAnalysis,
  extractFieldMutations,
  extractFunctionNames,
  extractUrlParams,
};
