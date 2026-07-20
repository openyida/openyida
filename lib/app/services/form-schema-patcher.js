'use strict';

const { createFormServiceError } = require('./form-schema-reader');

const MANAGED_PROP_KEYS = Object.freeze([
  'associationForm',
  'dataSource',
  'defaultDataSource',
  'label',
  'required',
  'validation',
]);

function patchManagedFormSchema(currentSchemaResult, compiled, options = {}) {
  const schema = clonePlain(extractSchema(currentSchemaResult));
  const compiledSchema = compiled && compiled.schema || {};
  const currentContainer = findFirstComponent(schema, 'FormContainer');
  const compiledContainer = findFirstComponent(compiledSchema, 'FormContainer');
  if (!currentContainer || !compiledContainer) {
    throw createFormServiceError(
      'form Schema does not contain FormContainer',
      'FORM_SCHEMA_PATCH_INVALID'
    );
  }

  const existingBindings = normalizeFieldBindings(options.existingBindings);
  const desiredBindings = normalizeFieldBindings(compiled && compiled.fieldBindings);
  const removedSemanticPath = Object.keys(existingBindings).find(semanticPath => !desiredBindings[semanticPath]);
  if (removedSemanticPath) {
    throw createFormServiceError(
      'managed field removal is not supported',
      'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
      { semanticPath: removedSemanticPath, operation: 'remove' }
    );
  }

  const currentByFieldId = indexComponentsByFieldId(schema);
  const compiledByFieldId = indexComponentsByFieldId(compiledSchema);
  patchFormTitle(currentContainer, compiledContainer);

  for (const semanticPath of Object.keys(desiredBindings).sort(compareCodePoints)) {
    const fieldId = desiredBindings[semanticPath].fieldId;
    const desiredComponent = compiledByFieldId.get(fieldId);
    if (!desiredComponent) {
      throw createFormServiceError(
        'compiled field binding was not found in generated Schema',
        'FORM_SCHEMA_PATCH_INVALID',
        { semanticPath }
      );
    }

    const currentComponent = currentByFieldId.get(fieldId);
    if (currentComponent) {
      if (currentComponent.componentName !== desiredComponent.componentName) {
        throw createFormServiceError(
          'managed field type replacement is not supported',
          'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
          { semanticPath, operation: 'replace_type' }
        );
      }
      assertSafeManagedPropChanges(currentComponent, desiredComponent, semanticPath);
      patchManagedProps(currentComponent, desiredComponent);
      continue;
    }

    if (existingBindings[semanticPath]) {
      throw createFormServiceError(
        'managed field is missing from current Schema',
        'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
        { semanticPath, operation: 'managed_missing' }
      );
    }

    const parentPath = parentSemanticPath(semanticPath);
    const parent = parentPath
      ? currentByFieldId.get(desiredBindings[parentPath] && desiredBindings[parentPath].fieldId)
      : currentContainer;
    if (!parent) {
      throw createFormServiceError(
        'managed field parent was not found in current Schema',
        'FORM_SCHEMA_PATCH_INVALID',
        { semanticPath }
      );
    }
    if (!Array.isArray(parent.children)) {
      parent.children = [];
    }
    const added = clonePlain(desiredComponent);
    parent.children.push(added);
    indexComponentTree(added, currentByFieldId);
  }

  mergeComponentsMap(schema, compiledSchema);
  mergeComponentAliases(schema, compiledSchema, currentByFieldId);
  return schema;
}

function extractSchema(schemaResult) {
  let value = schemaResult && Object.prototype.hasOwnProperty.call(schemaResult, 'content')
    ? schemaResult.content
    : schemaResult;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (error) {
      throw createFormServiceError('form Schema content is not valid JSON', 'FORM_SCHEMA_PATCH_INVALID');
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createFormServiceError('form Schema content must be an object', 'FORM_SCHEMA_PATCH_INVALID');
  }
  return value;
}

function patchFormTitle(currentContainer, compiledContainer) {
  currentContainer.props = currentContainer.props || {};
  const compiledProps = compiledContainer.props || {};
  if (Object.prototype.hasOwnProperty.call(compiledProps, 'formLabel')) {
    currentContainer.props.formLabel = clonePlain(compiledProps.formLabel);
  }
}

function patchManagedProps(currentComponent, desiredComponent) {
  currentComponent.props = currentComponent.props || {};
  const desiredProps = desiredComponent.props || {};
  for (const key of MANAGED_PROP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(desiredProps, key)) {
      currentComponent.props[key] = clonePlain(desiredProps[key]);
    }
  }
}

function assertSafeManagedPropChanges(currentComponent, desiredComponent, semanticPath) {
  const currentProps = currentComponent.props || {};
  const desiredProps = desiredComponent.props || {};
  const currentOptionValues = extractOptionValues(currentProps);
  const desiredOptionValues = new Set(extractOptionValues(desiredProps));
  if (currentOptionValues.some(value => !desiredOptionValues.has(value))) {
    throw createFormServiceError(
      'managed option value deletion or rename is not supported',
      'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
      { semanticPath, operation: 'remove_option_value' }
    );
  }
  if (
    (currentProps.associationForm || desiredProps.associationForm) &&
    !sameAssociationTarget(currentProps.associationForm, desiredProps.associationForm)
  ) {
    throw createFormServiceError(
      'managed association target replacement is not supported',
      'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
      { semanticPath, operation: 'replace_association' }
    );
  }
}

function extractOptionValues(props) {
  const options = Array.isArray(props && props.dataSource)
    ? props.dataSource
    : props && props.defaultDataSource && Array.isArray(props.defaultDataSource.options)
      ? props.defaultDataSource.options
      : [];
  return options.map((option) => {
    if (option && typeof option === 'object') {
      const value = option.value !== undefined
        ? option.value
        : option.text !== undefined
          ? option.text
          : option.label;
      return String(value === undefined ? '' : value);
    }
    return String(option);
  });
}

function sameAssociationTarget(left, right) {
  const normalize = value => ({
    appType: String(value && value.appType || ''),
    formUuid: String(value && value.formUuid || ''),
  });
  const leftTarget = normalize(left);
  const rightTarget = normalize(right);
  return leftTarget.appType === rightTarget.appType &&
    leftTarget.formUuid === rightTarget.formUuid;
}

function normalizeFieldBindings(bindings) {
  const source = bindings && bindings.fieldBindings || bindings && bindings.fields || bindings || {};
  const result = {};
  const usedFieldIds = new Set();
  for (const semanticPath of Object.keys(source)) {
    const value = source[semanticPath];
    const fieldId = typeof value === 'string'
      ? value
      : value && (value.fieldId || value.id || value.value);
    if (fieldId) {
      const normalizedFieldId = String(fieldId);
      if (usedFieldIds.has(normalizedFieldId)) {
        throw createFormServiceError(
          'field bindings contain a duplicate fieldId',
          'FORM_SCHEMA_PATCH_INVALID',
          { semanticPath }
        );
      }
      usedFieldIds.add(normalizedFieldId);
      result[semanticPath] = { fieldId: normalizedFieldId };
    }
  }
  return result;
}

function indexComponentsByFieldId(schema) {
  const result = new Map();
  visitSchemaComponents(schema, node => indexComponent(node, result));
  return result;
}

function indexComponentTree(node, index) {
  if (!node || typeof node !== 'object') {
    return;
  }
  indexComponent(node, index);
  if (Array.isArray(node.children)) {
    node.children.forEach(child => indexComponentTree(child, index));
  }
}

function indexComponent(node, index) {
  const fieldId = node && node.props && node.props.fieldId;
  if (!fieldId) {
    return;
  }
  const normalizedFieldId = String(fieldId);
  if (index.has(normalizedFieldId)) {
    throw createFormServiceError(
      'form Schema contains a duplicate fieldId',
      'FORM_SCHEMA_PATCH_INVALID'
    );
  }
  index.set(normalizedFieldId, node);
}

function findFirstComponent(schema, componentName) {
  let found = null;
  visitSchemaComponents(schema, (node) => {
    if (!found && node.componentName === componentName) {
      found = node;
    }
  });
  return found;
}

function visitSchemaComponents(schema, visitor) {
  const pages = schema && schema.pages;
  if (!Array.isArray(pages)) {
    return;
  }
  function visit(node) {
    if (!node || typeof node !== 'object') {
      return;
    }
    visitor(node);
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }
  pages.forEach((page) => {
    const roots = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
    roots.forEach(visit);
  });
}

function mergeComponentsMap(schema, compiledSchema) {
  const currentPage = schema && Array.isArray(schema.pages) && schema.pages[0];
  const compiledPage = compiledSchema && Array.isArray(compiledSchema.pages) && compiledSchema.pages[0];
  if (!currentPage || !compiledPage || !Array.isArray(compiledPage.componentsMap)) {
    return;
  }
  const current = Array.isArray(currentPage.componentsMap) ? currentPage.componentsMap : [];
  const names = new Set(current.map(item => item && item.componentName).filter(Boolean));
  for (const item of compiledPage.componentsMap) {
    if (item && item.componentName && !names.has(item.componentName)) {
      current.push(clonePlain(item));
      names.add(item.componentName);
    }
  }
  currentPage.componentsMap = current;
}

function mergeComponentAliases(schema, compiledSchema, currentByFieldId) {
  const currentPage = schema && Array.isArray(schema.pages) && schema.pages[0];
  const compiledPage = compiledSchema && Array.isArray(compiledSchema.pages) && compiledSchema.pages[0];
  const compiledItems = compiledPage && compiledPage.componentAlias && compiledPage.componentAlias.items;
  if (!currentPage || !Array.isArray(compiledItems)) {
    return;
  }
  const currentAlias = currentPage.componentAlias && typeof currentPage.componentAlias === 'object'
    ? currentPage.componentAlias
    : { items: [] };
  const items = Array.isArray(currentAlias.items) ? currentAlias.items : [];
  const fieldIds = new Set(items.map(item => item && item.fieldId).filter(Boolean));
  for (const item of compiledItems) {
    if (
      item &&
      item.fieldId &&
      currentByFieldId.has(String(item.fieldId)) &&
      !fieldIds.has(item.fieldId)
    ) {
      items.push(clonePlain(item));
      fieldIds.add(item.fieldId);
    }
  }
  currentAlias.items = items;
  currentPage.componentAlias = currentAlias;
}

function parentSemanticPath(semanticPath) {
  const separator = String(semanticPath).lastIndexOf('.');
  return separator === -1 ? '' : String(semanticPath).slice(0, separator);
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

module.exports = {
  MANAGED_PROP_KEYS,
  patchManagedFormSchema,
};
