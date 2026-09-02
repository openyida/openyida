'use strict';

let designerEventCounter = 0;

function actionRefs(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (value.type === 'JSExpression' && Array.isArray(value.events)) {
    return value.events.filter(function (event) {
      return event && event.type === 'actionRef' && (event.name || event.id);
    });
  }
  if (value.type === 'actionRef' && (value.name || value.id)) {
    return [value];
  }
  return [];
}

function actionRefName(value) {
  const refs = actionRefs(value);
  return refs.length > 0 ? String(refs[0].name || refs[0].id || '') : '';
}

function isDesignerEventBinding(value, actionName) {
  if (!value || value.type !== 'JSExpression' || !Array.isArray(value.events)) {
    return false;
  }
  const refs = actionRefs(value);
  if (!refs.some(function (event) {
    return String(event.name || event.id || '') === String(actionName || '');
  })) {
    return false;
  }
  const expression = String(value.value || '');
  return expression.includes('legaoBuiltin.execEventFlow') &&
    expression.includes('this.' + actionName);
}

function nextDesignerEventUuid() {
  designerEventCounter += 1;
  return String(Date.now()) + '_' + String(designerEventCounter);
}

function buildDesignerEventBinding(actionName, params, existingValue) {
  const existingRef = actionRefs(existingValue).find(function (event) {
    return String(event.name || event.id || '') === String(actionName || '');
  });
  return {
    type: 'JSExpression',
    value: 'this.utils.legaoBuiltin.execEventFlow.bind(this, [this.' + actionName + '])',
    events: [{
      name: actionName,
      id: actionName,
      params: params || {},
      type: 'actionRef',
      uuid: existingRef && existingRef.uuid || nextDesignerEventUuid(),
    }],
  };
}

function extractExportedActionFunctionNames(source) {
  const names = [];
  const pattern = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = pattern.exec(String(source || ''))) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names.sort();
}

function actionCatalogEntryNames(entry) {
  return [entry && entry.id, entry && entry.name]
    .filter(Boolean)
    .map(String);
}

function syncDesignerActionCatalog(actions) {
  const source = actions && actions.module && actions.module.source || '';
  const list = Array.isArray(actions.list) ? actions.list.slice() : [];
  const existingNames = new Set();
  list.forEach(function (entry) {
    actionCatalogEntryNames(entry).forEach(function (name) {
      existingNames.add(name);
    });
  });
  extractExportedActionFunctionNames(source).forEach(function (name) {
    if (!existingNames.has(name)) {
      list.push({ id: name, title: name });
      existingNames.add(name);
    }
  });
  actions.list = list;
  return actions.list;
}

function findFieldById(value, fieldId) {
  if (!value || !fieldId) {return null;}
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFieldById(item, fieldId);
      if (found) {return found;}
    }
    return null;
  }
  if (typeof value !== 'object') {return null;}
  if (String(value.fieldId || '') === String(fieldId) ||
    value.props && String(value.props.fieldId || '') === String(fieldId)) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findFieldById(child, fieldId);
    if (found) {return found;}
  }
  return null;
}

function inspectActionBinding(schema, expectation) {
  const fieldId = String(expectation.fieldId || '');
  const event = String(expectation.event || 'onChange');
  const actionName = String(expectation.actionName || '');
  const relatedEventId = String(expectation.relatedEventId || '');
  const field = findFieldById(schema && schema.pages || schema, fieldId);
  const eventValue = field && field.props && field.props[event];
  const actualActionName = actionRefName(eventValue);
  const designerBindingFound = isDesignerEventBinding(eventValue, actionName);
  const actions = schema && schema.actions || {};
  const entries = Array.isArray(actions.list) ? actions.list : [];
  const source = actions.module && typeof actions.module.source === 'string'
    ? actions.module.source
    : '';
  const functions = extractExportedActionFunctionNames(source);
  const entry = entries.find(function (item) {
    const itemNames = actionCatalogEntryNames(item);
    const itemEventId = String(item && item.relatedEventId || '');
    return itemNames.includes(actionName) && (!relatedEventId || !itemEventId || itemEventId === relatedEventId);
  });
  const bindingFound = actualActionName === actionName && designerBindingFound;
  const actionEntryFound = !!entry;
  const actionFunctionFound = functions.includes(actionName);
  const mismatches = [];
  if (!field) {mismatches.push('FIELD_NOT_FOUND');}
  if (!actualActionName) {mismatches.push('FIELD_EVENT_BINDING_MISSING');}
  else if (!designerBindingFound) {mismatches.push('DESIGNER_EVENT_BINDING_MISSING');}
  if (!actionEntryFound) {mismatches.push('ACTION_ENTRY_MISSING');}
  if (!actionFunctionFound) {mismatches.push('ACTION_FUNCTION_MISSING');}

  return {
    fieldId,
    event,
    actionName,
    relatedEventId,
    actualActionName,
    bindingFound,
    designerBindingFound,
    actionEntryFound,
    actionFunctionFound,
    verified: mismatches.length === 0,
    mismatches,
  };
}

function inspectActionBindings(schema, expectations) {
  const bindings = (expectations || []).map(function (expectation) {
    return inspectActionBinding(schema, expectation);
  });
  return {
    verified: bindings.every(function (binding) {return binding.verified;}),
    bindings,
  };
}

module.exports = {
  actionRefs,
  actionRefName,
  buildDesignerEventBinding,
  extractExportedActionFunctionNames,
  findFieldById,
  inspectActionBinding,
  inspectActionBindings,
  isDesignerEventBinding,
  syncDesignerActionCatalog,
};
