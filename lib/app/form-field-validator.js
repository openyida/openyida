'use strict';

const FIELD_TYPE_ALIAS = Object.freeze({
  TextAreaField: 'TextareaField',
  Textareafield: 'TextareaField',
  textareaField: 'TextareaField',
  textAreaField: 'TextareaField',
  Textfield: 'TextField',
  textfield: 'TextField',
  Numberfield: 'NumberField',
  numberfield: 'NumberField',
  Selectfield: 'SelectField',
  selectfield: 'SelectField',
  Radiofield: 'RadioField',
  radiofield: 'RadioField',
  Checkboxfield: 'CheckboxField',
  checkboxfield: 'CheckboxField',
  Datefield: 'DateField',
  datefield: 'DateField',
  Tablefield: 'TableField',
  tablefield: 'TableField',
  Ratefield: 'RateField',
  ratefield: 'RateField',
  Imagefield: 'ImageField',
  imagefield: 'ImageField',
  Attachmentfield: 'AttachmentField',
  attachmentfield: 'AttachmentField',
  Employeefield: 'EmployeeField',
  employeefield: 'EmployeeField',
  MultiSelectfield: 'MultiSelectField',
  Multiselectfield: 'MultiSelectField',
  multiselectfield: 'MultiSelectField',
  SerialNumberfield: 'SerialNumberField',
  Serialnumberfield: 'SerialNumberField',
  serialnumberfield: 'SerialNumberField',
});

const PRESENTATION_TYPE_ALIAS = Object.freeze({
  Divider: 'Divider',
  divider: 'Divider',
  ColumnsLayout: 'ColumnContainer',
  columnsLayout: 'ColumnContainer',
  ColumnContainer: 'ColumnContainer',
  columnContainer: 'ColumnContainer',
  Column: 'Column',
  column: 'Column',
  GroupContainer: 'GroupContainer',
  groupContainer: 'GroupContainer',
  PageSection: 'PageSection',
  pageSection: 'PageSection',
});

const BUSINESS_FIELD_TYPES = Object.freeze([
  'TextField',
  'TextareaField',
  'RadioField',
  'SelectField',
  'CheckboxField',
  'MultiSelectField',
  'NumberField',
  'RateField',
  'DateField',
  'CascadeDateField',
  'EmployeeField',
  'DepartmentSelectField',
  'CountrySelectField',
  'AddressField',
  'AttachmentField',
  'ImageField',
  'TableField',
  'AssociationFormField',
  'SerialNumberField',
]);

const PRESENTATION_FIELD_TYPES = Object.freeze([
  'Divider',
  'ColumnContainer',
  'Column',
  'GroupContainer',
  'PageSection',
]);

const OPTION_FIELD_TYPES = Object.freeze([
  'SelectField',
  'RadioField',
  'CheckboxField',
  'MultiSelectField',
]);

const READABLE_I18N_LABEL_KEYS = Object.freeze([
  'zh_CN',
  'en_US',
  'ja_JP',
  'zh_TW',
  'zh_HK',
  'pureEn_US',
  'name',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function describeActual(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function readDefinitionType(field) {
  if (!isPlainObject(field)) {
    return '';
  }
  if (field.type !== undefined && field.type !== null && field.type !== '') {
    return String(field.type).trim();
  }
  if (field.componentName !== undefined && field.componentName !== null && field.componentName !== '') {
    return String(field.componentName).trim();
  }
  if (field.componentType !== undefined && field.componentType !== null && field.componentType !== '') {
    return String(field.componentType).trim();
  }
  return '';
}

function normalizeDefinitionType(field) {
  const rawType = readDefinitionType(field);
  if (!rawType) {
    return '';
  }
  return PRESENTATION_TYPE_ALIAS[rawType] || FIELD_TYPE_ALIAS[rawType] || rawType;
}

function isBusinessFieldType(type) {
  return BUSINESS_FIELD_TYPES.indexOf(type) !== -1;
}

function isPresentationFieldType(type) {
  return PRESENTATION_FIELD_TYPES.indexOf(type) !== -1;
}

function hasNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyI18nObject(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  return READABLE_I18N_LABEL_KEYS.some(function (key) {
    return hasNonEmptyText(value[key]);
  });
}

function hasFieldLabel(value) {
  return hasNonEmptyText(value) || hasNonEmptyI18nObject(value);
}

function hasFixedOptionSource(field) {
  return Array.isArray(field.dataSource) && field.dataSource.length > 0;
}

function hasLegacyOptionSource(field) {
  return Array.isArray(field.options) && field.options.length > 0;
}

function hasRemoteOptionSource(field) {
  return !!(
    field.remoteDataSource ||
    field.searchDataSource ||
    field.dataSourceConfig ||
    field.dataSourceUrl ||
    field.searchConfig
  );
}

function hasAssociationForm(field) {
  return isPlainObject(field.associationForm) && hasNonEmptyText(field.associationForm.formUuid);
}

function createDiagnostic(code, path, expected, actual, message, suggestion) {
  return {
    code,
    path,
    expected,
    actual,
    message,
    suggestion,
  };
}

function pushDiagnostic(diagnostics, code, path, expected, actual, message, suggestion) {
  diagnostics.push(createDiagnostic(code, path, expected, actual, message, suggestion));
}

function validateChildrenPropertyShape(field, path, diagnostics, expectedDescription) {
  if (field.children === undefined || field.children === null) {
    return true;
  }
  if (!Array.isArray(field.children)) {
    pushDiagnostic(
      diagnostics,
      'INVALID_CHILDREN_SHAPE',
      path + '.children',
      expectedDescription,
      describeActual(field.children),
      'children must be an array with the expected depth for this component.',
      'Rewrite children to match the component-specific shape before creating or updating the form.'
    );
    return false;
  }
  return true;
}

function validateDivider(field, path, diagnostics) {
  if (
    field.title !== undefined &&
    typeof field.title !== 'string' &&
    !isPlainObject(field.title)
  ) {
    pushDiagnostic(
      diagnostics,
      'INVALID_DIVIDER_TITLE',
      path + '.title',
      'string or i18n object',
      describeActual(field.title),
      'Divider.title must be a string or an i18n object when provided.',
      'Use a plain string title or omit title.'
    );
  }
  if (field.dividerType !== undefined && typeof field.dividerType !== 'string') {
    pushDiagnostic(
      diagnostics,
      'INVALID_DIVIDER_TYPE',
      path + '.dividerType',
      'string',
      describeActual(field.dividerType),
      'Divider.dividerType must be a string when provided.',
      'Use a supported divider style string or omit dividerType.'
    );
  }
}

function validateFieldDefinition(field, path, diagnostics, options) {
  const validationOptions = options || {};

  if (!isPlainObject(field)) {
    pushDiagnostic(
      diagnostics,
      'INVALID_FIELD_DEFINITION',
      path,
      'object',
      describeActual(field),
      'Field definition must be an object.',
      'Replace this item with an object such as {"type":"TextField","label":"Name"}.'
    );
    return;
  }

  const type = normalizeDefinitionType(field);
  if (!type) {
    pushDiagnostic(
      diagnostics,
      'FIELD_TYPE_MISSING',
      path + '.type',
      'non-empty supported field type',
      'missing',
      'Field definition must include type, componentName, or componentType.',
      'Add a supported type such as TextField, SelectField, TableField, or ColumnContainer.'
    );
    return;
  }

  if (!isBusinessFieldType(type) && !isPresentationFieldType(type)) {
    pushDiagnostic(
      diagnostics,
      'UNSUPPORTED_FIELD_TYPE',
      path + '.type',
      BUSINESS_FIELD_TYPES.concat(PRESENTATION_FIELD_TYPES).join(', '),
      type,
      'Field type is not supported by openyida create-form.',
      'Use one of the supported field types, or add CLI support before using this type.'
    );
    return;
  }

  if (validationOptions.insideTable && type === 'TableField') {
    pushDiagnostic(
      diagnostics,
      'NESTED_TABLE_FIELD_UNSUPPORTED',
      path,
      'non-TableField child',
      'TableField',
      'TableField.children cannot contain another TableField.',
      'Move the nested table to the top level or flatten the subtable fields.'
    );
    return;
  }

  if (validationOptions.insideTable && isPresentationFieldType(type)) {
    pushDiagnostic(
      diagnostics,
      'TABLE_CHILD_PRESENTATION_UNSUPPORTED',
      path,
      'business field object',
      type,
      'TableField.children cannot contain presentation components.',
      'Use business fields only inside TableField.children.'
    );
    return;
  }

  if (type === 'Column') {
    if (!validationOptions.allowColumn) {
      pushDiagnostic(
        diagnostics,
        'COLUMN_OUTSIDE_COLUMN_CONTAINER',
        path,
        'Column object inside ColumnContainer.children',
        'Column',
        'Column can only be used as a ColumnContainer.children Column object.',
        'Move this Column object under ColumnContainer.children, or replace it with a normal field definition.'
      );
      return;
    }
    validateColumnObject(field, path, diagnostics);
    return;
  }

  if (isBusinessFieldType(type) && !hasFieldLabel(field.label)) {
    pushDiagnostic(
      diagnostics,
      'BUSINESS_FIELD_LABEL_MISSING',
      path + '.label',
      'non-empty string or i18n object',
      field.label === undefined ? 'missing' : describeActual(field.label),
      'Business field definitions must include a non-empty label.',
      'Add a label that users will see on the form, such as "Name" or {"zh_CN":"姓名","en_US":"Name"}.'
    );
  }

  if (type === 'Divider') {
    validateDivider(field, path, diagnostics);
    return;
  }

  if (type === 'ColumnContainer') {
    validateColumnContainer(field, path, diagnostics);
    return;
  }

  if (type === 'GroupContainer' || type === 'PageSection') {
    validateOneDimensionalChildren(field, path, diagnostics, type);
    return;
  }

  if (type === 'TableField') {
    validateTableField(field, path, diagnostics);
  }

  if (
    OPTION_FIELD_TYPES.indexOf(type) !== -1 &&
    !hasFixedOptionSource(field) &&
    !hasLegacyOptionSource(field) &&
    !hasRemoteOptionSource(field)
  ) {
    pushDiagnostic(
      diagnostics,
      'OPTION_FIELD_DATASOURCE_MISSING',
      path + '.dataSource',
      'non-empty dataSource/options array or remote data source config',
      'missing',
      type + ' must define fixed options or a remote data source.',
      'Provide dataSource (preferred), options, remoteDataSource, dataSourceConfig, dataSourceUrl, or searchConfig.'
    );
  }

  if (type === 'AssociationFormField' && !hasAssociationForm(field)) {
    pushDiagnostic(
      diagnostics,
      'ASSOCIATION_FORM_MISSING',
      path + '.associationForm',
      'object with non-empty formUuid',
      field.associationForm === undefined ? 'missing' : describeActual(field.associationForm),
      'AssociationFormField must include associationForm.formUuid.',
      'Set associationForm to the target form metadata before creating or updating the form.'
    );
  }

  if (
    (type === 'EmployeeField' || type === 'DepartmentSelectField') &&
    field.multiple !== undefined &&
    typeof field.multiple !== 'boolean'
  ) {
    pushDiagnostic(
      diagnostics,
      'INVALID_MULTIPLE_TYPE',
      path + '.multiple',
      'boolean',
      describeActual(field.multiple),
      type + '.multiple must be a boolean when provided.',
      'Use true or false instead of strings or numbers.'
    );
  }
}

function validateColumnObject(field, path, diagnostics) {
  if (!validateChildrenPropertyShape(field, path, diagnostics, 'FieldDefinition[]')) {
    return;
  }
  if (field.children === undefined || field.children === null) {
    return;
  }
  field.children.forEach(function (child, childIndex) {
    const childPath = path + '.children[' + childIndex + ']';
    if (Array.isArray(child)) {
      pushDiagnostic(
        diagnostics,
        'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
        childPath,
        'FieldDefinition object',
        'array',
        'Column.children must be a one-dimensional field array.',
        'Remove the extra array nesting so Column.children is FieldDefinition[].'
      );
      return;
    }
    validateFieldDefinition(child, childPath, diagnostics);
  });
}

function validateColumnContainer(field, path, diagnostics) {
  if (!validateChildrenPropertyShape(field, path, diagnostics, 'FieldDefinition[][] or Column[]')) {
    return;
  }
  if (field.children === undefined || field.children === null) {
    return;
  }
  field.children.forEach(function (columnChildren, columnIndex) {
    const columnPath = path + '.children[' + columnIndex + ']';
    if (isPlainObject(columnChildren) && normalizeDefinitionType(columnChildren) === 'Column') {
      validateFieldDefinition(columnChildren, columnPath, diagnostics, { allowColumn: true });
      return;
    }
    if (!Array.isArray(columnChildren)) {
      pushDiagnostic(
        diagnostics,
        'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
        columnPath,
        'array of FieldDefinition objects or Column object',
        describeActual(columnChildren),
        'ColumnContainer.children must contain two-dimensional field arrays or Column objects.',
        'Use children: [[fieldA], [fieldB]] or children: [{ type: "Column", children: [fieldA] }].'
      );
      return;
    }
    columnChildren.forEach(function (child, childIndex) {
      const childPath = columnPath + '[' + childIndex + ']';
      if (Array.isArray(child)) {
        pushDiagnostic(
          diagnostics,
          'INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
          childPath,
          'FieldDefinition object',
          'array',
          'ColumnContainer.children must be exactly two levels deep.',
          'Remove the extra array nesting so children is FieldDefinition[][].'
        );
        return;
      }
      validateFieldDefinition(child, childPath, diagnostics);
    });
  });
}

function validateOneDimensionalChildren(field, path, diagnostics, type) {
  if (!validateChildrenPropertyShape(field, path, diagnostics, 'FieldDefinition[]')) {
    return;
  }
  if (field.children === undefined || field.children === null) {
    return;
  }
  field.children.forEach(function (child, childIndex) {
    const childPath = path + '.children[' + childIndex + ']';
    if (Array.isArray(child)) {
      pushDiagnostic(
        diagnostics,
        'INVALID_' + type.toUpperCase() + '_CHILDREN_DEPTH',
        childPath,
        'FieldDefinition object',
        'array',
        type + '.children must be a one-dimensional field array.',
        'Remove extra array nesting from ' + type + '.children.'
      );
      return;
    }
    validateFieldDefinition(child, childPath, diagnostics);
  });
}

function validateTableField(field, path, diagnostics) {
  if (!validateChildrenPropertyShape(field, path, diagnostics, 'FieldDefinition[]')) {
    return;
  }
  if (field.children === undefined || field.children === null) {
    return;
  }
  field.children.forEach(function (child, childIndex) {
    const childPath = path + '.children[' + childIndex + ']';
    if (Array.isArray(child)) {
      pushDiagnostic(
        diagnostics,
        'INVALID_TABLE_FIELD_CHILDREN_DEPTH',
        childPath,
        'FieldDefinition object',
        'array',
        'TableField.children must be a one-dimensional field array.',
        'Remove extra array nesting from TableField.children.'
      );
      return;
    }
    validateFieldDefinition(child, childPath, diagnostics, { insideTable: true });
  });
}

function validateFormFieldDefinitions(fields, options) {
  const validationOptions = options || {};
  const rootPath = validationOptions.rootPath || 'fields';
  const diagnostics = [];

  if (!Array.isArray(fields)) {
    pushDiagnostic(
      diagnostics,
      'INVALID_FIELDS_ROOT',
      rootPath,
      'FieldDefinition[]',
      describeActual(fields),
      'Field definitions root must be an array.',
      'Use an array of field definitions or an object with a fields array.'
    );
    return diagnostics;
  }

  fields.forEach(function (field, index) {
    validateFieldDefinition(field, rootPath + '[' + index + ']', diagnostics);
  });

  return diagnostics;
}

module.exports = {
  validateFormFieldDefinitions,
  normalizeDefinitionType,
  BUSINESS_FIELD_TYPES,
  PRESENTATION_FIELD_TYPES,
};
