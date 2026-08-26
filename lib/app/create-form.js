#!/usr/bin/env node
/**
 * create-form-page.js - 宜搭表单页面创建 & 更新工具
 *
 * 支持两种模式：
 *
 * 1. create 模式 - 创建新表单页面：
 *   node create-form-page.js create <appType> <formTitle> <fieldsJsonFile>
 *
 * 2. update 模式 - 更新已有表单页面：
 *   node create-form-page.js update <appType> <formUuid> <changesJsonOrFile>
 *
 * create 模式参数：
 *   appType        - 应用 ID（必填），如 APP_XXX
 *   formTitle      - 表单名称（必填）
 *   fieldsJsonFile - 字段定义 JSON 文件路径（必填）
 *
 * update 模式参数：
 *   appType          - 应用 ID（必填）
 *   formUuid         - 表单 UUID（必填），如 FORM-XXX
 *   changesJsonOrFile - 修改定义，支持 JSON 字符串（以 [ 开头）或 JSON 文件路径
 *
 * 字段定义 JSON 格式（create 模式）：
 *   [
 *     { "type": "TextField", "label": "姓名", "required": true },
 *     { "type": "SelectField", "label": "部门", "options": ["技术部", "产品部"] },
 *     { "type": "DateField", "label": "入职日期" },
 *     { "type": "TableField", "label": "费用明细", "children": [
 *       { "type": "TextField", "label": "项目" },
 *       { "type": "NumberField", "label": "金额" }
 *     ]}
 *   ]
 *
 * 修改定义 JSON 格式（update 模式）：
 *   [
 *     { "action": "add", "field": { "type": "TextField", "label": "备注" } },
 *     { "action": "add", "field": { "type": "SelectField", "label": "部门", "options": ["技术部", "产品部"] }, "after": "姓名" },
 *     { "action": "delete", "label": "备注" },
 *     { "action": "update", "label": "年龄", "changes": { "required": true, "placeholder": "请输入年龄" } }
 *   ]
 *
 * 支持的字段类型：
 *   TextField, TextareaField, RadioField, SelectField, CheckboxField,
 *   MultiSelectField, NumberField, RateField, DateField, CascadeDateField,
 *   EmployeeField, DepartmentSelectField, CountrySelectField, AddressField,
 *   AttachmentField, ImageField, TableField, AssociationFormField, SerialNumberField
 *
 * 前置条件：
 *   项目根目录下需存在有效 token session（由 openyida login 生成）。
 *   创建前会用只读请求刷新登录态；创建 POST 不会在 302 后自动重放。
 *
 * 示例：
 *   # 创建表单
 *   node .claude/skills/yida-create-form-page/scripts/create-form-page.js create "APP_xxx" "员工信息登记" fields.json
 *   # 更新表单
 *   node .claude/skills/yida-create-form-page/scripts/create-form-page.js update "APP_XXX" "FORM-YYY" '[{"action":"add","field":{"type":"TextField","label":"备注"}}]'
 */

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  httpPost,
  httpGet,
  requestWithAutoLogin,
  requestNonIdempotentWithAuthPreflight,
} = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { safeParseJson } = require('../core/safe-json');
const {
  assertNoEmojiInArtifactName,
  assertNoEmojiInValue,
} = require('../core/no-emoji-guard');
const { buildYidaI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint, listItem } = require('../core/chalk');
const { parseOpenOption: parseBrowserOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { default: babelTransform } = require('../core/babel-transform');
const { normalizeFormulaFieldRefs } = require('../formula/evaluate');
const { createParseArgs } = require('./create-form/args');
const { createDefinitionReaders } = require('./create-form/definition-reader');
const { dispatchCreateFormCommand } = require('./create-form/commands');
const { buildApiPath } = require('./create-form/api-path');
const { deepMerge, splitJsonPointer } = require('./create-form/schema-patch');
const { ensureYidaGlobalThemeAction } = require('./form-theme-action');
const { FORM_RULES_BLOCK_END, FORM_RULES_BLOCK_START } = require('./create-form/rule-builder');
const { SMART_VALIDATION_BLOCK_END, SMART_VALIDATION_BLOCK_START } = require('./create-form/validation-builder');
const { createFieldNormalizers } = require('./create-form/field-normalizers');
const {
  readCss: readFormDetailCss,
  upsertFormDetailCss,
} = require('./form-detail-style');
const {
  validateFormFieldDefinitions: collectFormFieldValidationDiagnostics,
} = require('./form-field-validator');

function parseOpenOption(inputArgs) {
  const openOption = parseBrowserOpenOption(inputArgs);
  return Object.assign({}, openOption);
}

// ── 选项类字段类型 ───────────────────────────────────
const OPTION_FIELD_TYPES = ['RadioField', 'SelectField', 'CheckboxField', 'MultiSelectField'];
const FIELD_RESOLUTION_CANDIDATE_LIMIT = 8;
const DEFAULT_FORM_DETAIL_STYLE_PRESET = 'clean-card';

function throwCreateFormError(message, code, details) {
  throw createCreateFormError(message, code, details);
}

function createCreateFormError(message, code, details) {
  return new CliError(message, {
    code: code || 'CREATE_FORM_FAILED',
    details,
  });
}

const parseArgs = createParseArgs({
  parseOpenOption,
  normalizeYidaLocale,
  usage,
  hint,
  error,
  t,
  throwCreateFormError,
});

const {
  readFieldsDefinition,
  readChangesDefinition,
  readPatchDefinition,
  readRuleDefinition,
  readValidationDefinition,
  readDataSourceDefinition,
} = createDefinitionReaders({
  fs,
  path,
  safeParseJson,
  error,
  t,
});

// ── 自增 ID 计数器 ───────────────────────────────────
let nodeIdCounter = 1;

function nextNodeId() {
  return 'node_oc' + Date.now().toString(36) + (nodeIdCounter++).toString(36);
}

let _fieldIdCounter = 0;

function generateFieldId(componentName) {
  const prefix = componentName.charAt(0).toLowerCase() + componentName.slice(1);
  // 使用时间戳 + 递增计数器 + 随机数，确保唯一性
  _fieldIdCounter++;
  const timePart = Date.now().toString(36).slice(-4);
  const counterPart = _fieldIdCounter.toString(36);
  const randomPart = Math.random().toString(36).substring(2, 6);
  const suffix = timePart + counterPart + randomPart;
  return prefix + '_' + suffix;
}

// ── i18n 辅助 ────────────────────────────────────────

function i18n(text, enText, jaText) {
  return buildYidaI18n(text, {
    en_US: enText || text,
    ja_JP: jaText || text,
  });
}

// ── 默认占位符 ───────────────────────────────────────

const PLACEHOLDER_INPUT = i18n('请输入', 'Please enter', '入力してください');
const PLACEHOLDER_SELECT = i18n('请选择', 'Please select', '選択してください');

// ── 字段选项 / 校验归一化 ─────────────────────────────
// 具体实现见 create-form/field-normalizers.js（工厂注入 i18n / deepMerge / toDesignerValidationRule）
const {
  buildOptionDataSource,
  applySelectDataSourceConfig,
  normalizeValidationType,
  defaultValidationMessage,
  isNativeFieldValidationRule,
  dedupeValidationRules,
  collectInputValidationRules,
  normalizeFieldValidationRules,
} = createFieldNormalizers({ i18n, deepMerge, toDesignerValidationRule });

// ── 字段类型名容错映射 ───────────────────────────────
// 宜搭后端枚举对大小写敏感，此映射自动纠正常见的拼写差异
const FIELD_TYPE_ALIAS = {
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
};

const SUPPORTED_BUSINESS_FIELD_TYPES = [
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
];

const FORM_PRESENTATION_TYPE_ALIAS = {
  Divider: 'Divider',
  divider: 'Divider',
  ColumnsLayout: 'ColumnsLayout',
  columnsLayout: 'ColumnsLayout',
  ColumnContainer: 'ColumnsLayout',
  columnContainer: 'ColumnsLayout',
  Column: 'Column',
  column: 'Column',
  GroupContainer: 'PageSection',
  groupContainer: 'PageSection',
  PageSection: 'PageSection',
  pageSection: 'PageSection',
};

const FORM_PRESENTATION_COMPONENTS = ['Divider', 'ColumnsLayout', 'Column', 'PageSection'];
const DIVIDER_TYPE_PRIORITY = [
  'bold-with-thin',
  'double-color-trapezoid',
  'left-dot-title',
  'solid',
  'dashed',
  'thick',
  'dotted',
];
const DEFAULT_DIVIDER_TYPE = DIVIDER_TYPE_PRIORITY[0];
const LEGACY_STRONG_DIVIDER_TYPE = 'multi-parallelograms-end';
const ALLOWED_DIVIDER_TYPES = new Set([
  ...DIVIDER_TYPE_PRIORITY,
  LEGACY_STRONG_DIVIDER_TYPE,
]);

const COMPONENT_ALIAS_META = Symbol('openyida.componentAlias');

function normalizeComponentAlias(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  const rawAlias = field.componentAlias !== undefined
    ? field.componentAlias
    : field.component_alias !== undefined
      ? field.component_alias
      : field.alias;
  if (rawAlias === undefined || rawAlias === null || rawAlias === false) {
    return '';
  }
  if (typeof rawAlias === 'object') {
    return String(rawAlias.alias || rawAlias.name || '').trim();
  }
  return String(rawAlias).trim();
}

function readFormDefinitionType(field) {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
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

function normalizeFormDefinitionType(field) {
  const rawType = readFormDefinitionType(field);
  if (!rawType) {
    return '';
  }
  return FORM_PRESENTATION_TYPE_ALIAS[rawType] || FIELD_TYPE_ALIAS[rawType] || rawType;
}

function isFormPresentationComponent(componentName) {
  return FORM_PRESENTATION_COMPONENTS.indexOf(componentName) !== -1;
}

function isFormPresentationDefinition(field) {
  return isFormPresentationComponent(normalizeFormDefinitionType(field));
}

function isSupportedBusinessFieldType(componentName) {
  return SUPPORTED_BUSINESS_FIELD_TYPES.indexOf(componentName) !== -1;
}

function getDefinitionDisplayName(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  return field.label || field.title || readFormDefinitionType(field) || '';
}

function buildInvalidFieldDefinitionDetails(field, fieldPath, extra) {
  const details = Object.assign({
    path: fieldPath || 'fields',
    label: field && typeof field === 'object' ? field.label : undefined,
    title: field && typeof field === 'object' ? field.title : undefined,
    type: readFormDefinitionType(field),
  }, extra || {});
  Object.keys(details).forEach(function (key) {
    if (details[key] === undefined || details[key] === '') {
      delete details[key];
    }
  });
  return details;
}

function throwInvalidFieldDefinition(message, code, field, fieldPath, extra) {
  throwCreateFormError(
    message,
    code || 'CREATE_FORM_INVALID_FIELD_DEFINITION',
    buildInvalidFieldDefinitionDetails(field, fieldPath, extra)
  );
}

function getValueAtDiagnosticPath(root, diagnosticPath, rootPath) {
  const normalizedRootPath = rootPath || 'fields';
  if (!diagnosticPath || diagnosticPath.indexOf(normalizedRootPath) !== 0) {
    return undefined;
  }
  const relativePath = diagnosticPath.slice(normalizedRootPath.length);
  const tokens = [];
  const pattern = /\[(\d+)\]|\.([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = pattern.exec(relativePath)) !== null) {
    tokens.push(match[1] !== undefined ? Number(match[1]) : match[2]);
  }
  let current = root;
  for (let index = 0; index < tokens.length; index++) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[tokens[index]];
  }
  return current;
}

function findDiagnosticField(fields, diagnosticPath, rootPath) {
  let currentPath = diagnosticPath || rootPath || 'fields';
  while (currentPath && currentPath !== (rootPath || 'fields')) {
    const value = getValueAtDiagnosticPath(fields, currentPath, rootPath);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    const dotIndex = currentPath.lastIndexOf('.');
    const bracketIndex = currentPath.lastIndexOf('[');
    const cutIndex = Math.max(dotIndex, bracketIndex);
    if (cutIndex <= 0) {
      break;
    }
    currentPath = currentPath.slice(0, cutIndex);
  }
  return undefined;
}

function mapFieldValidationCode(code) {
  const cliErrorCodesByValidationCode = {
    FIELD_TYPE_MISSING: 'CREATE_FORM_FIELD_TYPE_MISSING',
    INVALID_FIELD_DEFINITION: 'CREATE_FORM_INVALID_FIELD_DEFINITION',
    INVALID_FIELDS_ROOT: 'CREATE_FORM_INVALID_FIELD_DEFINITION',
    UNSUPPORTED_FIELD_TYPE: 'CREATE_FORM_UNSUPPORTED_FIELD_TYPE',
    COLUMN_OUTSIDE_COLUMN_CONTAINER: 'CREATE_FORM_COLUMN_OUTSIDE_COLUMNS_LAYOUT',
    ASSOCIATION_FORM_MISSING: 'CREATE_FORM_ASSOCIATION_FORM_UUID_MISSING',
    TABLE_CHILD_PRESENTATION_UNSUPPORTED: 'CREATE_FORM_TABLE_CHILD_PRESENTATION_UNSUPPORTED',
    INVALID_TABLE_FIELD_CHILDREN_DEPTH: 'CREATE_FORM_INVALID_TABLE_CHILDREN',
    INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH: 'CREATE_FORM_INVALID_COLUMN_CONTAINER_CHILDREN_DEPTH',
    INVALID_CHILDREN_SHAPE: 'CREATE_FORM_INVALID_CONTAINER_CHILDREN',
    NESTED_TABLE_FIELD_UNSUPPORTED: 'CREATE_FORM_NESTED_TABLE_FIELD_UNSUPPORTED',
    OPTION_FIELD_DATASOURCE_MISSING: 'CREATE_FORM_OPTION_FIELD_DATASOURCE_MISSING',
    BUSINESS_FIELD_LABEL_MISSING: 'CREATE_FORM_BUSINESS_FIELD_LABEL_MISSING',
    INVALID_MULTIPLE_TYPE: 'CREATE_FORM_INVALID_MULTIPLE_TYPE',
    INVALID_DIVIDER_TITLE: 'CREATE_FORM_INVALID_DIVIDER_TITLE',
    INVALID_DIVIDER_TYPE: 'CREATE_FORM_INVALID_DIVIDER_TYPE',
  };
  return cliErrorCodesByValidationCode[code] || 'CREATE_FORM_FIELD_JSON_INVALID';
}

function normalizeDiagnosticDetailPath(diagnostic) {
  if (!diagnostic || !diagnostic.path) {
    return 'fields';
  }
  if (diagnostic.code === 'FIELD_TYPE_MISSING' && diagnostic.path.endsWith('.type')) {
    return diagnostic.path.slice(0, -'.type'.length);
  }
  if (diagnostic.code === 'ASSOCIATION_FORM_MISSING' && diagnostic.path.endsWith('.associationForm')) {
    return diagnostic.path.slice(0, -'.associationForm'.length);
  }
  return diagnostic.path;
}

function validateFormFieldDefinitions(fields, rootPath) {
  const diagnostics = collectFormFieldValidationDiagnostics(fields, {
    rootPath: rootPath || 'fields',
  });
  throwFieldValidationDiagnostics(fields, diagnostics, rootPath || 'fields');
}

function throwFieldValidationDiagnostics(fields, diagnostics, rootPath) {
  if (diagnostics.length === 0) {
    return;
  }

  const first = diagnostics[0];
  const detailPath = normalizeDiagnosticDetailPath(first);
  const field = findDiagnosticField(fields, detailPath, rootPath || 'fields');
  const details = buildInvalidFieldDefinitionDetails(field, detailPath, {
    diagnostics,
    expected: first.expected,
    actual: first.actual,
    suggestion: first.suggestion,
  });
  throwCreateFormError(
    first.message,
    mapFieldValidationCode(first.code),
    details
  );
}

function collectSingleFieldValidationDiagnostics(field, rootPath) {
  const internalRootPath = '__field';
  const diagnostics = collectFormFieldValidationDiagnostics([field], {
    rootPath: internalRootPath,
  });
  return diagnostics.map(function (diagnostic) {
    return Object.assign({}, diagnostic, {
      path: diagnostic.path.replace(internalRootPath + '[0]', rootPath),
    });
  });
}

function validateSingleFieldDefinition(field, rootPath) {
  const diagnostics = collectSingleFieldValidationDiagnostics(field, rootPath);
  throwFieldValidationDiagnostics(field, diagnostics, rootPath);
}

function validateChangeFieldDefinitions(changes) {
  if (!Array.isArray(changes)) {
    return;
  }
  changes.forEach(function (change, changeIndex) {
    if (change && change.action === 'add') {
      validateSingleFieldDefinition(change.field, 'changes[' + changeIndex + '].field');
    }
  });
}

function normalizeI18nValue(value, fallback) {
  if (value && typeof value === 'object') {
    return value;
  }
  const text = value !== undefined && value !== null ? String(value) : String(fallback || '');
  return i18n(text, text, text);
}

function normalizeStyleChoice(value, fallback) {
  if (value && typeof value === 'object') {
    return value;
  }
  return { value: value || fallback };
}

function buildSchemaNode(componentName, props, children, options) {
  const node = {
    componentName: componentName,
    id: nextNodeId(),
    props: props || {},
    condition: true,
    hidden: false,
    title: '',
    isLocked: false,
    conditionGroup: '',
  };
  const nodeOptions = options || {};
  if (nodeOptions.fieldId) {
    node.fieldId = nodeOptions.fieldId;
  }
  if (children !== undefined) {
    node.children = children;
  }
  return node;
}

function mergeExtraProps(props, field) {
  if (field && field.props && typeof field.props === 'object' && !Array.isArray(field.props)) {
    deepMerge(props, field.props);
  }
  return props;
}

function normalizeDividerType(type) {
  if (type === undefined || type === null || type === '') {
    return DEFAULT_DIVIDER_TYPE;
  }
  const normalized = String(type).trim();
  return ALLOWED_DIVIDER_TYPES.has(normalized) ? normalized : DEFAULT_DIVIDER_TYPE;
}

function buildDividerComponent(field) {
  const fieldId = field.fieldId || field.id || generateFieldId('Divider');
  const props = mergeExtraProps({
    fieldId,
    behavior: field.behavior || 'NORMAL',
    visibility: field.visibility || ['PC', 'MOBILE'],
    showTitle: field.showTitle !== undefined ? !!field.showTitle : true,
    title: normalizeI18nValue(field.title !== undefined ? field.title : field.label, '标题'),
    description: normalizeI18nValue(field.description, ''),
    tips: normalizeI18nValue(field.tips, ''),
    type: DEFAULT_DIVIDER_TYPE,
    colorType: field.colorType || 'theme',
    backgroundColor: field.backgroundColor || '#0089ff',
    titleColor: field.titleColor || '#171a1d',
    secondaryColor: field.secondaryColor || '#cce5ff',
  }, field);

  const dividerType = field.dividerType || field.dividerStyle || field.styleType || field.typeStyle || props.type;
  props.type = normalizeDividerType(dividerType);

  if (field.newIcon !== undefined) {
    props.newIcon = field.newIcon;
  }

  return buildSchemaNode('Divider', props, undefined, { fieldId: props.fieldId || fieldId });
}

function buildPageSectionComponent(field) {
  const fieldId = field.fieldId || field.id || generateFieldId('PageSection');
  const props = mergeExtraProps({
    fieldId,
    behavior: field.behavior || 'NORMAL',
    visibility: field.visibility || ['PC', 'MOBILE'],
    showHeader: field.showHeader !== undefined ? !!field.showHeader : true,
    title: normalizeI18nValue(field.title !== undefined ? field.title : field.label, '分组'),
    tooltip: normalizeI18nValue(field.tooltip || field.tips, ''),
    showHeadDivider: field.showHeadDivider !== undefined ? !!field.showHeadDivider : true,
    sectionHeaderStyle: field.sectionHeaderStyle || 'origin',
    sectionHeaderBgColor: field.sectionHeaderBgColor || '#0089ff',
    sectionHeaderTitleColor: field.sectionHeaderTitleColor || '#171A1D',
    pcStyle: normalizeStyleChoice(field.pcStyle, 'origin'),
    showBorder: !!field.showBorder,
    withMargin: !!field.withMargin,
    withPadding: field.withPadding !== undefined ? !!field.withPadding : true,
    mobileStyle: normalizeStyleChoice(field.mobileStyle, 'origin'),
    showBorderMobile: !!field.showBorderMobile,
    withMarginMobile: !!field.withMarginMobile,
    withPaddingMobile: !!field.withPaddingMobile,
  }, field);

  if (field.newIcon !== undefined) {
    props.newIcon = field.newIcon;
  }

  return buildSchemaNode(
    'PageSection',
    props,
    buildFormNodeComponents(field.children || []),
    { fieldId: props.fieldId || fieldId }
  );
}

function countLayoutColumns(layout) {
  const parts = String(layout || '12').split(':').filter(Boolean);
  return parts.length || 1;
}

function buildColumnComponent(columnDefinition) {
  if (columnDefinition && typeof columnDefinition === 'object' && !Array.isArray(columnDefinition) &&
      normalizeFormDefinitionType(columnDefinition) === 'Column') {
    return buildSchemaNode(
      'Column',
      mergeExtraProps(Object.assign({}, columnDefinition.columnProps || {}), columnDefinition),
      buildFormNodeComponents(columnDefinition.children || [])
    );
  }

  if (Array.isArray(columnDefinition)) {
    return buildSchemaNode('Column', {}, buildFormNodeComponents(columnDefinition));
  }

  if (columnDefinition && typeof columnDefinition === 'object') {
    return buildSchemaNode('Column', {}, [buildFormNodeComponent(columnDefinition)]);
  }

  return buildSchemaNode('Column', {}, []);
}

function buildColumnsLayoutComponent(field) {
  const fieldId = field.fieldId || field.id || generateFieldId('ColumnsLayout');
  const layout = field.layout || '6:6';
  const props = mergeExtraProps({
    fieldId,
    layout,
    columnGap: field.columnGap !== undefined ? field.columnGap : '16px',
    rowGap: field.rowGap !== undefined ? field.rowGap : '16px',
    display: field.display || 'VERTICAL',
    mobileRowGap: field.mobileRowGap !== undefined ? field.mobileRowGap : '0px',
    visibility: field.visibility || ['PC', 'MOBILE'],
  }, field);

  const rawChildren = Array.isArray(field.children) ? field.children : [];
  const children = rawChildren.map(buildColumnComponent);
  while (children.length < countLayoutColumns(props.layout)) {
    children.push(buildSchemaNode('Column', {}, []));
  }

  return buildSchemaNode('ColumnsLayout', props, children, { fieldId: props.fieldId || fieldId });
}

function buildFormNodeComponent(field) {
  const componentName = normalizeFormDefinitionType(field);
  if (componentName === 'Divider') {
    return buildDividerComponent(field);
  }
  if (componentName === 'PageSection') {
    return buildPageSectionComponent(field);
  }
  if (componentName === 'ColumnsLayout') {
    return buildColumnsLayoutComponent(field);
  }
  if (componentName === 'Column') {
    return buildColumnComponent(field);
  }
  return buildFieldComponent(field);
}

function buildFormNodeComponents(fields) {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields.map(buildFormNodeComponent);
}

// ── 生成字段组件 ─────────────────────────────────────

function buildFieldComponent(field) {
  const componentName = normalizeFormDefinitionType(field);
  if (!isSupportedBusinessFieldType(componentName)) {
    throwInvalidFieldDefinition(
      componentName ? '不支持的字段类型: ' + componentName : '字段定义缺少 type/componentName/componentType',
      componentName ? 'CREATE_FORM_UNSUPPORTED_FIELD_TYPE' : 'CREATE_FORM_FIELD_TYPE_MISSING',
      field,
      'field',
      { componentName }
    );
  }
  const fieldId = generateFieldId(componentName);
  const nodeId = nextNodeId();

  // 基础 validation
  const validation = normalizeFieldValidationRules(field);

  // 基础 props（所有字段通用）
  const props = {
    __useMediator: 'value',
    fieldId: fieldId,
    label: i18n(field.label, componentName),
    __category__: 'form',
    behavior: 'NORMAL',
    visibility: ['PC', 'MOBILE'],
    dataEntryMode: false,
    validation: validation,
    labelAlign: 'top',
    labelTextAlign: 'left',
    labelColSpan: 4,
    size: 'medium',
    submittable: 'ALWAYS',
  };

  // 文本类字段
  if (componentName === 'TextField' || componentName === 'TextareaField') {
    props.hasClear = true;
    props.placeholder = field.placeholder ? i18n(field.placeholder) : PLACEHOLDER_INPUT;
    props.valueType = 'custom';
    props.validationType = 'text';
    props.value = i18n('', '');
    props.hasLimitHint = false;
    props.maxLength = 200;
    props.rows = 4;
    props.linkage = '';
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.autoHeight = false;
    props.scanCode = { enabled: false, type: 'all', editable: true };
    props.complexValue = {
      complexType: 'custom',
      formula: '',
      value: i18n('', '', ''),
    };
    props.variable = '';
    props.formula = '';
    props.isCustomStore = true;

    // TextareaField 特有属性
    if (componentName === 'TextareaField') {
      props.htmlType = 'textarea';
      props.showEmptyRows = false;
    }
  }

  // 数字字段
  if (componentName === 'NumberField') {
    props.hasClear = true;
    props.placeholder = field.placeholder ? i18n(field.placeholder) : i18n('请输入数字', 'Please enter a number', '数値を入力してください');
    props.valueType = 'custom';
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.linkage = '';
    props.precision = 0;
    props.step = 1;
    props.thousandsSeparators = false;
    props.innerAfter = field.innerAfter || '';
    props.value = '';
    props.labelColOffset = 0;
    props.wrapperColSpan = 0;
    props.wrapperColOffset = 0;
    props.complexValue = {
      complexType: 'custom',
      formula: '',
      value: '',
    };
    props.variable = '';
    props.formula = '';
    props.isCustomStore = true;
  }

  // 评分字段
  if (componentName === 'RateField') {
    props.count = 5;
    props.allowHalf = false;
    props.showGrade = false;
    props.__gridSpan = 1;
    props.tips = i18n('', '');
  }

  // 日期字段
  if (componentName === 'DateField') {
    props.placeholder = field.placeholder ? i18n(field.placeholder) : PLACEHOLDER_SELECT;
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.linkage = '';
    props.format = field.format || 'YYYY-MM-DD';
    props.hasClear = true;
    props.disabledDate = { type: 'none' };
    props.valueType = 'custom';
    props.value = '';
    props.formula = '';
    props.variable = '';
    props.resetTime = false;
    props.complexValue = {
      complexType: 'custom',
      value: '',
      formula: '',
    };
  }

  // 级联日期字段
  if (componentName === 'CascadeDateField') {
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.format = field.format || 'YYYY-MM-DD';
    props.hasClear = true;
    props.resetTime = false;
    props.disabledDate = false;
  }

  // 选项类字段（RadioField、SelectField、CheckboxField、MultiSelectField）
  if (OPTION_FIELD_TYPES.indexOf(componentName) !== -1) {
    const rawDataSource = field.dataSource || field.options;
    let dataSource;
    if (Array.isArray(rawDataSource) && rawDataSource.length > 0) {
      if (typeof rawDataSource[0] === 'string') {
        dataSource = buildOptionDataSource(rawDataSource);
      } else if (typeof rawDataSource[0] === 'object' && rawDataSource[0].value !== undefined) {
        dataSource = rawDataSource.map(function (item, idx) {
          return {
            text: item.text || i18n(String(item.value), String(item.value), String(item.value)),
            value: item.value,
            sid: item.sid || 'serial_' + Date.now().toString(36) + idx,
            disable: item.disable || false,
            defaultChecked: item.defaultChecked || false,
          };
        });
      } else {
        dataSource = buildOptionDataSource(['选项一', '选项二', '选项三']);
      }
    } else {
      dataSource = buildOptionDataSource(['选项一', '选项二', '选项三']);
    }

    props.dataSource = dataSource;
    props.dataSourceType = 'custom';
    props.defaultDataSource = {
      customStashOptions: [],
      complexType: 'custom',
      options: dataSource,
      formula: { data: [], event: { 'onPageReady,onChange': [] } },
      url: '',
      searchConfig: { afterFetch: '', type: 'JSONP', beforeFetch: '', url: '' },
    };
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.linkage = '';

    if (componentName === 'RadioField' || componentName === 'CheckboxField') {
      props.value = '';
      props.valueType = 'custom';
      props.complexValue = { complexType: 'custom', formula: '', value: '' };
      props.variable = '';
      props.formula = '';
    }

    if (componentName === 'SelectField' || componentName === 'MultiSelectField') {
      props.hasClear = true;
      props.showSearch = true;
      props.autoWidth = true;
      props.placeholder = field.placeholder ? i18n(field.placeholder) : PLACEHOLDER_SELECT;
      props.value = '';
      props.valueType = 'custom';
      props.reusePrivilege = false;
      props.isUseDataSourceColor = false;
      props.dataSourceLinkage = '';
      props.filterLocal = true;
      props.notFoundContent = i18n('无数据', 'No data', 'データがありません');
      props.searchConfig = {
        dataType: 'jsonp',
        url: '',
        beforeFetch: 'function willFetch(params) {\n  return params;\n}',
        afterFetch: 'function didFetch(content) {\n  return content;\n}',
      };
      props.complexValue = { complexType: 'custom', formula: '', value: '' };
      props.variable = '';
      props.formula = '';
    }

    if (componentName === 'SelectField') {
      props.mode = 'single';
    } else if (componentName === 'MultiSelectField') {
      props.mode = 'multiple';
    }

    if (field.remoteDataSource || field.searchDataSource || field.dataSourceConfig || field.dataSourceUrl || field.searchConfig) {
      applySelectDataSourceConfig(props, field.remoteDataSource || field.searchDataSource || field.dataSourceConfig || {
        url: field.dataSourceUrl,
        searchConfig: field.searchConfig,
        dataType: field.dataType,
        beforeFetch: field.beforeFetch,
        afterFetch: field.afterFetch,
        queryParam: field.queryParam,
        listPath: field.listPath,
        labelField: field.labelField,
        valueField: field.valueField,
        options: rawDataSource,
        dataSourceType: field.dataSourceType,
        filterLocal: field.filterLocal,
        showSearch: field.showSearch,
      });
    }
  }

  // 成员字段
  if (componentName === 'EmployeeField') {
    props.placeholder = PLACEHOLDER_SELECT;
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.multiple = field.multiple || false;
    props.hasClear = true;
    props.userRangeType = 'ALL';
    props.roleRange = [];
    props.userRange = [];
    props.showEmpIdType = 'NAME';
    props.startWithDepartmentId = 'SELF';
    props.renderLinkForView = true;
    props.showEmplId = false;
    props.closeOnSelect = false;
    props.useAliworkUrl = false;
    props.linkage = '';

    props.valueType = 'variable';
    props.complexValue = {
      complexType: 'formula',
      formula: 'USER()',
      value: [],
    };
    props.variable = { type: 'user' };
    props.formula = '';
    props.value = [];
  }

  // 部门字段
  if (componentName === 'DepartmentSelectField') {
    props.placeholder = i18n('请输入关键字进行搜索', 'Please enter keyword', 'キーワードを入力してください');
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.multiple = field.multiple || false;
    props.valueType = 'custom';
    props.value = [];
    props.deptRangeType = 'ALL';
    props.deptRange = [];
    props.mode = 'single';
    props.hasClear = true;
    props.dataSource = {
      searchConfig: {
        dataType: 'json',
        url: '/query/deptService/searchDepts.json',
        beforeFetch: 'function willFetch(data) {\n  data.key = data.key || data.q || "";\n  return data;\n}',
        afterFetch: 'function didFetch(content) {\n  var data = [];\n  if (content && content.values) {\n    content.values.forEach(function (item) {\n      data.push({ value: item.emplId, text: item.name, deptFullPath: item.deptFullPath });\n    });\n  }\n  return data;\n}',
      },
    };
    props.complexValue = {
      complexType: 'custom',
      value: [],
      formula: '',
    };
    props.variable = '';
    props.formula = '';
    props.linkage = '';
    props.isShowDeptFullName = false;
    props.hasSelectAll = false;
  }

  // 国家字段
  if (componentName === 'CountrySelectField') {
    props.placeholder = PLACEHOLDER_SELECT;
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.multiple = field.multiple || false;
    props.value = [];
    props.mode = 'single';
    props.hasClear = true;
    props.showSearch = true;
    props.hasSelectAll = false;
  }

  // 地址字段
  if (componentName === 'AddressField') {
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.placeholder = field.placeholder ? i18n(field.placeholder) : PLACEHOLDER_SELECT;
    props.countryMode = 'default';
    props.countryScope = 1;
    props.addressType = 'ADDRESS';
    props.subLabel = i18n('详细地址', 'Detailed Address', '詳細住所');
    props.detailPlaceholder = i18n('请输入详细地址', 'Please input detailed address', '詳細住所を入力してください');
    props.hasClear = true;
    props.enableLocation = true;
    props.value = {};
    props.optionAutoWidth = true;
    props.showCountry = false;
  }

  // 附件字段
  if (componentName === 'AttachmentField') {
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.valueType = 'custom';
    props.value = '';
    props.complexValue = {
      complexType: 'custom',
      value: '',
      formula: '',
    };
    props.type = 'normal';
    props.listType = 'text';
    props.buttonText = i18n('上传文件', 'Upload file', 'ファイルをアップロード');
    props.buttonSize = 'medium';
    props.buttonType = 'normal';
    props.multiple = true;
    props.method = 'post';
    props.limit = 9;
    props.maxFileSize = 100;
    props.autoUpload = true;
    props.accept = '';
    props.formula = '';
    props.linkage = '';
    props.variable = '';
    props.onlineEdit = false;
    props.withCredentials = false;
  }

  // 图片上传字段
  if (componentName === 'ImageField') {
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.valueType = 'custom';
    props.value = '';
    props.complexValue = {
      complexType: 'custom',
      value: '',
      formula: '',
    };
    props.aiRecognitionConfig = {};
    props.type = 'normal';
    props.normalListType = 'image';
    props.cardListType = 'card';
    props.listType = 'image';
    props.buttonText = i18n('图片上传', 'Upload image', '画像をアップロード');
    props.buttonSize = 'medium';
    props.buttonType = 'normal';
    props.enableCameraDate = true;
    props.enableCameraLocation = true;
    props.saveCameraImageToLocal = true;
    props.multiple = true;
    props.method = 'post';
    props.limit = 9;
    props.maxFileSize = 50;
    props.autoUpload = true;
    props.accept = 'image/*';
    props.formula = '';
    props.linkage = '';
    props.variable = '';
    props.aiRecognitionSwitch = false;
    props.onlyCameraUpload = false;
    props.enableCameraWatermark = false;
    props.enableCameraCompression = false;
  }

  // 子表字段
  if (componentName === 'TableField') {
    props.__gridSpan = 1;
    props.linkage = '';
    props.tips = i18n('', '');
    props.showIndex = true;
    props.copyButtonText = i18n('复制', 'Copy', 'コピー');
    props.addButtonBehavior = 'NORMAL';
    props.pageSize = 20;
    props.addButtonText = i18n('新增一项', 'Add item', '項目を追加');
    props.enableExport = true;
    props.addButtonPosition = 'bottom';
    props.actionsColumnWidth = 70;
    props.theme = 'split';
    props.delButtonText = i18n('删除', 'Remove', '削除');
    props.useCustomColumnsWidth = false;
    props.showSortable = false;
    props.moveUp = i18n('上移', 'Up', '上へ');
    props.maxItems = 500;
    props.tableLayout = 'fixed';
    props.showActions = true;
    props.indexName = i18n('项目', 'Line', '項目');
    props.showCopyAction = false;
    props.showDelAction = true;
    props.showTableHead = true;
    props.moveDown = i18n('下移', 'Down', '下へ');
    props.pcFreezeColumnStartCounts = '0';
    props.layout = 'TABLE';
    props.showDeleteConfirm = true;
    props.minItems = 1;
    props.enableImport = true;
    props.defaultCollapseStatus = true;
    props.isFreezeOperateColumn = true;
    props.actions = [];
    props.complexValue = { complexType: 'custom', formula: '' };
    props.valueType = 'custom';
    props.__designerDevice = 'pc';
    props.mobileLayout = 'TILED';
    props.mobileFreezeColumnStartCounts = '0';
    props.enableBatchDelete = false;
    props.filterEmptyRowData = false;
    props.enableSummary = false;
  }

  // 关联表单字段
  if (componentName === 'AssociationFormField') {
    const assocConfig = field.associationForm || {};

    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.placeholder = PLACEHOLDER_SELECT;
    props.notFoundContent = i18n('无数据', 'No data', 'データがありません');
    props.hasClear = true;
    props.multiple = field.multiple || false;
    props.dataEntryMode = false;
    props.submittable = 'ALWAYS';
    props.isCustomStore = true;
    props.isShowSearchBar = true;
    props.validateFilter = false;
    props.__useMediator = 'value';

    // 关联表单核心配置
    props.associationForm = {
      formType: 'receipt',
      formUuid: assocConfig.formUuid || '',
      appType: assocConfig.appType || '',
      appName: assocConfig.appName || '',
      formTitle: assocConfig.formTitle || '',
      mainFieldId: assocConfig.mainFieldId || '',
      mainFieldLabel: assocConfig.mainFieldLabel
        ? i18n(assocConfig.mainFieldLabel)
        : i18n('', ''),
      mainComponentName: assocConfig.mainComponentName || 'TextField',
      tableShowType: assocConfig.tableShowType || 'all',
      customTableFields: assocConfig.customTableFields || [],
      subFieldId: assocConfig.subFieldId || '',
      subComponentName: assocConfig.subComponentName || '',
      linkageFields: assocConfig.linkageFields || [],
    };

    // 数据过滤规则（条件筛选）
    const hasFilterRules = assocConfig.dataFilterRules &&
                         assocConfig.dataFilterRules.rules &&
                         assocConfig.dataFilterRules.rules.length > 0;
    props.dataFilterRules = hasFilterRules ? assocConfig.dataFilterRules : {
      condition: 'AND',
      rules: [],
      ruleId: 'group-' + Date.now().toString(36),
      instanceFieldId: '',
      version: 'v2',
    };
    props.supportDataFilter = hasFilterRules;

    // 数据回填规则（选中后自动填充本表单字段）
    // 规范化每条规则，补充 source/target/sourceType/targetType 字段（宜搭回填必须）
    const hasFillingRules = assocConfig.dataFillingRules &&
                          ((assocConfig.dataFillingRules.mainRules && assocConfig.dataFillingRules.mainRules.length > 0) ||
                           (assocConfig.dataFillingRules.tableRules && assocConfig.dataFillingRules.tableRules.length > 0));
    props.dataFillingRules = hasFillingRules ? normalizeFillingRules(assocConfig.dataFillingRules) : {
      mainRules: [],
      tableRules: [],
      version: 'v2',
    };
    props.supportDataFilling = hasFillingRules;

    // 排序配置
    props.orderEnable = !!(assocConfig.orderConfig && assocConfig.orderConfig.length > 0);
    props.orderConfig = assocConfig.orderConfig || [];
  }

  // 流水号字段
  if (componentName === 'SerialNumberField') {
    props.__gridSpan = 1;
    props.tips = i18n('', '');
    props.dataEntryMode = false;
    props.submittable = 'DEFAULT';
    // 流水号字段固定为空校验规则，不支持 required
    props.validation = [];

    // 默认流水号规则：前缀 + 自动递增数字
    const defaultSerialNumberRule = [
      {
        __hide_delete__: false,
        ruleType: 'character',
        content: 'serial',
        formField: '',
        dateFormat: 'yyyyMMdd',
        timeZone: '+8',
        digitCount: 4,
        isFixed: true,
        isFixedTips: '',
        resetPeriod: 'noClean',
        resetPeriodTips: '',
        initialValue: 1,
        __sid: 'item_' + Date.now().toString(36) + '1',
        __sid__: 'serial_' + Date.now().toString(36) + '1'
      },
      {
        __hide_delete__: true,
        ruleType: 'autoCount',
        content: '',
        formField: '',
        dateFormat: 'yyyyMMdd',
        timeZone: '+8',
        digitCount: 5,
        isFixed: true,
        isFixedTips: '',
        resetPeriod: 'noClean',
        resetPeriodTips: '',
        initialValue: 1,
        __sid: 'item_' + Date.now().toString(36) + '2',
        __sid__: 'serial_' + Date.now().toString(36) + '2'
      }
    ];

    props.serialNumberRule = field.serialNumberRule || defaultSerialNumberRule;
    props.serialNumPreview = 'serial00001';
    props.serialNumReset = 1;
    props.syncSerialConfig = false;

    // formula 字段需要在 buildFormSchema 中设置，因为需要 corpId 和 formUuid
    // 这里先设置为空对象，后续会被替换
    props.formula = {};
  }

  // ── 通用属性覆盖（字段定义中显式传入的属性优先级最高）──────────

  // behavior：NORMAL / READONLY / HIDDEN
  if (field.behavior !== undefined) {
    props.behavior = field.behavior;
  }

  // visibility：控制在哪些端显示，如 ["PC", "MOBILE"] / ["PC"] / ["MOBILE"]
  if (field.visibility !== undefined) {
    props.visibility = field.visibility;
  }

  // labelAlign：标签对齐方式，top / left / right
  if (field.labelAlign !== undefined) {
    props.labelAlign = field.labelAlign;
  }

  // placeholder：占位提示文本（部分字段类型已在上方按类型设置，这里统一覆盖）
  if (field.placeholder !== undefined) {
    props.placeholder = i18n(field.placeholder);
  }

  const component = {
    componentName: componentName,
    id: nodeId,
    fieldId: fieldId,
    props: props,
    condition: true,
    hidden: false,
    title: '',
    isLocked: false,
    conditionGroup: '',
  };

  const componentAlias = normalizeComponentAlias(field);
  if (componentAlias) {
    component[COMPONENT_ALIAS_META] = componentAlias;
  }

  // TableField：递归处理子字段
  if (componentName === 'TableField' && field.children) {
    component.children = field.children.map(function (childField) {
      return buildFieldComponent(childField);
    });
  }

  return component;
}

// ── 收集使用到的组件名称 ─────────────────────────────

function collectComponentNames(fields) {
  const names = new Set(['Page', 'RootHeader', 'RootContent', 'RootFooter', 'FooterYida', 'FormContainer']);

  function visit(field) {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      return;
    }
    const componentName = normalizeFormDefinitionType(field);
    if (componentName) {
      names.add(componentName);
    }
    if (componentName === 'ColumnsLayout') {
      names.add('Column');
    }
    if (Array.isArray(field.children)) {
      field.children.forEach(function (child) {
        if (Array.isArray(child)) {
          child.forEach(visit);
        } else {
          visit(child);
        }
      });
    }
  }

  fields.forEach(visit);
  return Array.from(names);
}

// ── 生成 componentsMap ───────────────────────────────

function buildComponentsMap(componentNames) {
  return componentNames.map(function (name) {
    return {
      package: '@ali/vc-deep-yida',
      version: '1.5.169',
      componentName: name,
    };
  });
}

function applyDefaultFormDetailStyle(schema) {
  return upsertFormDetailCss(schema, readFormDetailCss({ preset: DEFAULT_FORM_DETAIL_STYLE_PRESET }));
}

function buildComponentAliasItems(components) {
  const items = [];
  const usedAliases = Object.create(null);

  function visit(component) {
    if (!component || typeof component !== 'object') {
      return;
    }
    const fieldId = component.fieldId || (component.props && component.props.fieldId);
    const alias = component[COMPONENT_ALIAS_META];
    if (fieldId && alias) {
      let finalAlias = alias;
      if (usedAliases[finalAlias] && usedAliases[finalAlias] !== fieldId) {
        finalAlias = finalAlias + '_' + fieldId;
      }
      usedAliases[finalAlias] = fieldId;
      items.push({ fieldId, alias: finalAlias });
    }
    if (Array.isArray(component.children)) {
      component.children.forEach(visit);
    }
  }

  (components || []).forEach(visit);
  return items;
}

// ── 从 fieldId 前缀推断组件类型 ─────────────────────
// 例如：serialNumberField_xxx → SerialNumberField，textField_xxx → TextField

function inferComponentNameFromFieldId(fieldId) {
  if (!fieldId || typeof fieldId !== 'string') {return '';}
  // fieldId 格式：camelCaseComponentName_xxxxxxxx
  const underscoreIndex = fieldId.lastIndexOf('_');
  if (underscoreIndex === -1) {return '';}
  const prefix = fieldId.slice(0, underscoreIndex);
  // 将首字母大写，还原为 PascalCase 组件名
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

// ── 规范化单条回填规则，补充 source/target/sourceType/targetType ──
// 宜搭要求 mainRules 和 tableRules 中的每条规则同时包含：
//   sourceFieldId、targetFieldId（旧格式）
//   source（同 sourceFieldId）、target（同 targetFieldId）
//   sourceType（源字段组件类型）、targetType（目标字段组件类型）

function normalizeFillingRule(rule) {
  // 兼容两种格式：旧格式用 sourceFieldId/targetFieldId，新格式用 source/target
  const sourceId = rule.sourceFieldId || rule.source || '';
  const targetId = rule.targetFieldId || rule.target || '';
  const sourceType = rule.sourceType || inferComponentNameFromFieldId(sourceId);
  const targetType = rule.targetType || inferComponentNameFromFieldId(targetId);

  return {
    sourceFieldId: sourceId,
    targetFieldId: targetId,
    source: sourceId,
    sourceType: sourceType,
    target: targetId,
    targetType: targetType,
  };
}

// ── 规范化整个 dataFillingRules 对象 ─────────────────

function normalizeFillingRules(fillingRules) {
  if (!fillingRules) {return fillingRules;}
  const normalized = Object.assign({}, fillingRules);

  if (Array.isArray(normalized.mainRules)) {
    normalized.mainRules = normalized.mainRules.map(normalizeFillingRule);
  }

  if (Array.isArray(normalized.tableRules)) {
    normalized.tableRules = normalized.tableRules.map(function (tableRule) {
      const normalizedTableRule = Object.assign({}, tableRule);
      if (Array.isArray(normalizedTableRule.rules)) {
        normalizedTableRule.rules = normalizedTableRule.rules.map(normalizeFillingRule);
      }
      return normalizedTableRule;
    });
  }

  return normalized;
}

// ── 解析 @label:字段名 语法，将其替换为对应字段的真实 fieldId ──

function resolveFieldIdReferences(fieldComponents) {
  // 构建 label → fieldId 的映射表
  const labelToFieldId = {};
  collectFieldDescriptors(fieldComponents).forEach(function (descriptor) {
    const component = descriptor.field;
    const labelText = extractLabelText(component);
    if (labelText && component.props && component.props.fieldId) {
      labelToFieldId[labelText] = component.props.fieldId;
    }
  });

  // 遍历所有 AssociationFormField，解析回填规则中的 @label:xxx 引用
  collectFieldDescriptors(fieldComponents).forEach(function (descriptor) {
    const component = descriptor.field;
    if (component.componentName !== 'AssociationFormField') {return;}
    const fillingRules = component.props.dataFillingRules;
    if (!fillingRules) {return;}

    /**
     * 解析普通规则（mainRules 或 tableRules 中的 rules 数组）
     * 支持格式: [{source, target, sourceType, targetType}, ...]
     */
    function resolveRules(rules) {
      if (!Array.isArray(rules)) {return;}
      rules.forEach(function (rule) {
        // 解析 target 中的 @label:xxx 引用
        if (rule.target && typeof rule.target === 'string' && rule.target.startsWith('@label:')) {
          const targetLabel = rule.target.slice(7);
          const resolvedId = labelToFieldId[targetLabel];
          if (resolvedId) {
            info(t('create_form.filling_rule_resolved', targetLabel, resolvedId));
            rule.target = resolvedId;
          } else {
            warn(t('create_form.filling_rule_failed', targetLabel));
          }
        }
        // 解析 source 中的 @label:xxx 引用
        if (rule.source && typeof rule.source === 'string' && rule.source.startsWith('@label:')) {
          const sourceLabel = rule.source.slice(7);
          const resolvedSourceId = labelToFieldId[sourceLabel];
          if (resolvedSourceId) {
            info(t('create_form.filling_rule_resolved', sourceLabel, resolvedSourceId));
            rule.source = resolvedSourceId;
          } else {
            warn(t('create_form.filling_rule_failed', sourceLabel));
          }
        }
      });
    }

    /**
     * 解析子表填充子表规则（tableRules）
     * 支持格式: [{tableId, rules: [{source, target, sourceType, targetType}], filters}, ...]
     */
    function resolveTableRules(tableRules) {
      if (!Array.isArray(tableRules)) {return;}
      tableRules.forEach(function (tableRule, tableIndex) {
        if (!tableRule.rules || !Array.isArray(tableRule.rules)) {return;}

        info(t('create_form.table_filling_rule', tableIndex + 1, tableRule.tableId));

        tableRule.rules.forEach(function (rule, ruleIndex) {
          if (rule.target && typeof rule.target === 'string' && rule.target.startsWith('@label:')) {
            const targetLabel = rule.target.slice(7);
            const resolvedId = labelToFieldId[targetLabel];
            if (resolvedId) {
              info(t('create_form.table_rule_resolved', ruleIndex + 1, targetLabel, resolvedId));
              rule.target = resolvedId;
            } else {
              warn(t('create_form.table_rule_failed', targetLabel));
            }
          }
        });
      });
    }

    // 解析主表回填规则
    if (fillingRules.mainRules) {
      resolveRules(fillingRules.mainRules);
    }

    // 解析子表回填规则（支持子表填充子表）
    if (fillingRules.tableRules) {
      resolveTableRules(fillingRules.tableRules);
    }

    // 解析完 @label 后，规范化规则（补充 source/target/sourceType/targetType）
    component.props.dataFillingRules = normalizeFillingRules(fillingRules);

    // 解析后重新判断是否有有效回填规则
    const hasMainRules = fillingRules.mainRules && fillingRules.mainRules.length > 0;
    const hasTableRules = fillingRules.tableRules && fillingRules.tableRules.some(function (tr) {
      return tr.rules && tr.rules.length > 0;
    });
    component.props.supportDataFilling = hasMainRules || hasTableRules;
  });
}

// ── 布局配置映射 ─────────────────────────────────────

/**
 * 获取布局配置
 * @param {string} layout - 布局类型：single/double/card/section
 * @returns {object} 布局配置对象 { columns, formLayout, groupFields }
 */
function getLayoutConfig(layout) {
  const layoutMap = {
    single: { columns: 1, formLayout: 'default', groupFields: false },
    '1': { columns: 1, formLayout: 'default', groupFields: false },
    double: { columns: 2, formLayout: 'default', groupFields: false },
    '2': { columns: 2, formLayout: 'default', groupFields: false },
    card: { columns: 1, formLayout: 'card', groupFields: true },
    section: { columns: 1, formLayout: 'section', groupFields: true },
  };
  return layoutMap[layout] || layoutMap.single;
}

/**
 * 获取主题样式配置
 * @param {string} theme - 主题类型：default/compact/comfortable
 * @param {string} labelAlign - 标签对齐：top/left/right
 * @returns {object} 样式配置对象
 */
function getThemeConfig(theme, labelAlign) {
  const baseConfig = {
    labelAlignPc: labelAlign || 'top',
    labelWidthPc: labelAlign === 'left' || labelAlign === 'right' ? '130px' : 'auto',
    labelWeightPc: 'normal',
    contentMargin: '20',
    contentPadding: '20',
    fieldSpacing: 'medium',
  };

  const themeMap = {
    default: {
      ...baseConfig,
      contentMargin: '20',
      contentPadding: '20',
    },
    compact: {
      ...baseConfig,
      contentMargin: '12',
      contentPadding: '12',
      fieldSpacing: 'small',
    },
    comfortable: {
      ...baseConfig,
      contentMargin: '32',
      contentPadding: '32',
      fieldSpacing: 'large',
    },
  };

  return themeMap[theme] || themeMap.default;
}

// ── 按 group 分组字段 ─────────────────────────────────

/**
 * 将字段按 group 属性分组
 * @param {Array} fields - 字段定义数组
 * @returns {Array} 分组后的字段数组，每个元素是 { groupName, fields }
 */
function groupFieldsByGroup(fields) {
  const groups = [];
  const groupMap = new Map();

  fields.forEach((field) => {
    const groupName = field.group || '基本信息';
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName).push(field);
  });

  groupMap.forEach((groupFields, groupName) => {
    groups.push({ groupName, fields: groupFields });
  });

  return groups;
}

// ── 构建分组字段组件 ─────────────────────────────────

/**
 * 构建分组/卡片布局的字段组件
 * @param {Array} fields - 字段定义数组
 * @param {string} formLayout - 布局类型：card/section
 * @returns {Array} 分组后的组件数组
 */
function buildGroupedFieldComponents(fields, formLayout) {
  const groups = groupFieldsByGroup(fields);

  return groups.map((group, groupIndex) => {
    // 构建分组内的字段组件
    const groupFieldComponents = buildFormNodeComponents(group.fields);

    if (formLayout === 'card') {
      // 卡片式布局：每个分组是一个卡片容器
      return {
        componentName: 'CardContainer',
        id: nextNodeId(),
        props: {
          title: i18n(group.groupName, group.groupName),
          collapsible: true,
          defaultCollapsed: false,
          showTitle: true,
          cardStyle: 'default',
          headerStyle: 'default',
          __gridSpan: 1,
        },
        condition: true,
        hidden: false,
        title: '',
        isLocked: false,
        conditionGroup: '',
        children: groupFieldComponents,
      };
    } else {
      // 分组式布局：每个分组是一个区块
      return {
        componentName: 'SectionContainer',
        id: nextNodeId(),
        props: {
          title: i18n(group.groupName, group.groupName),
          collapsible: true,
          defaultCollapsed: false,
          showTitle: true,
          sectionStyle: 'default',
          divider: groupIndex > 0, // 第一个分组不显示分隔线
          __gridSpan: 1,
        },
        condition: true,
        hidden: false,
        title: '',
        isLocked: false,
        conditionGroup: '',
        children: groupFieldComponents,
      };
    }
  });
}

// ── 生成表单 Schema ──────────────────────────────────

function buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign) {
  // 解析布局配置
  const layoutConfig = getLayoutConfig(layout || 'single');
  const columns = layoutConfig.columns;

  // 解析主题配置
  const themeConfig = getThemeConfig(theme || 'default', labelAlign || 'top');
  const fieldComponents = buildFormNodeComponents(fields);
  const formContainerChildren = layoutConfig.groupFields
    ? buildGroupedFieldComponents(fields, layoutConfig.formLayout)
    : fieldComponents;

  // 为 SerialNumberField 设置 formula（需要 corpId、appType 和 formUuid）
  fillSerialNumberFormulas(formContainerChildren, corpId, appType, formUuid);

  // 解析 @label:字段名 引用（必须在所有字段构建完成后执行）
  resolveFieldIdReferences(formContainerChildren);
  const componentAliasItems = buildComponentAliasItems(formContainerChildren);

  const componentNames = collectComponentNames(fields);

  // 构造函数代码（与模板完全一致）
  const constructorCode = "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";

  // actions 模块代码（与模板一致的默认空实现）
  const actionsCompiled = '"use strict";\n\nexports.__esModule = true;\nexports.didMount = didMount;\nfunction didMount() {\n  console.log("\\u300C\\u9875\\u9762 JS\\u300D\\uFF1A\\u5F53\\u524D\\u9875\\u9762\\u5730\\u5740 " + location.href);\n}\n';
  const actionsSource = 'export function didMount() {\n  console.log(`「页面 JS」：当前页面地址 ${location.href}`);\n}';

  // Page 组件树（FormContainer 外层结构与模板保持一致，仅 id 随机生成）
  const pageComponentsTree = [
    {
      componentName: 'Page',
      id: nextNodeId(),
      props: {
        contentBgColor: 'white',
        pageStyle: { backgroundColor: '#f2f3f5' },
        contentMargin: '20',
        contentPadding: '20',
        showTitle: false,
        contentPaddingMobile: '0',
        templateVersion: '1.0.0',
        contentMarginMobile: '0',
        className: 'page_' + Date.now().toString(36),
        contentBgColorMobile: 'white',
        titleName: i18n('标题名称', 'title', 'タイトル'),
        titleDesc: i18n('标题描述', 'description', '説明'),
        titleColor: 'light',
        titleBg: 'https://img.alicdn.com/imgextra/i2/O1CN0143ATPP1wIa9TrVvzN_!!6000000006285-2-tps-3360-400.png_.webp',
        backgroundColorCustom: '#f1f2f3',
        sizePc: themeConfig.fieldSpacing === 'small' ? 'small' : themeConfig.fieldSpacing === 'large' ? 'large' : 'medium',
        labelAlignPc: themeConfig.labelAlignPc,
        labelWidthPc: themeConfig.labelWidthPc,
        labelWeightPc: themeConfig.labelWeightPc,
        labelAlignMobile: labelAlign || 'top',
        labelWidthMobile: labelAlign === 'left' || labelAlign === 'right' ? '80px' : 'auto',
        labelWeightMobile: 'normal',
      },
      condition: true,
      css: 'body{background-color:#f2f3f5}',
      methods: {
        __initMethods__: {
          type: 'js',
          source: 'function (exports, module) { /*set actions code here*/ }',
          compiled: 'function (exports, module) { /*set actions code here*/ }',
        },
      },
      dataSource: {
        offline: [],
        globalConfig: {
          fit: {
            compiled: "'use strict';\n\nvar __preParser__ = function fit(response) {\n  var content = response.content !== undefined ? response.content : response;\n  var error = {\n    message: response.errorMsg || response.errors && response.errors[0] && response.errors[0].msg || response.content || '远程数据源请求出错，success is false'\n  };\n  var success = true;\n  if (response.success !== undefined) {\n    success = response.success;\n  } else if (response.hasError !== undefined) {\n    success = !response.hasError;\n  }\n  return {\n    content: content,\n    success: success,\n    error: error\n  };\n};",
            source: "function fit(response) {\r\n  const content = (response.content !== undefined) ? response.content : response;\r\n  const error = {\r\n    message: response.errorMsg ||\r\n      (response.errors && response.errors[0] && response.errors[0].msg) ||\r\n      response.content || '远程数据源请求出错，success is false',\r\n  };\r\n  let success = true;\r\n  if (response.success !== undefined) {\r\n    success = response.success;\r\n  } else if (response.hasError !== undefined) {\r\n    success = !response.hasError;\r\n  }\r\n  return {\r\n    content,\r\n    success,\r\n    error,\r\n  };\r\n}",
            type: 'js',
            error: {},
          },
        },
        online: [],
        list: [],
        sync: true,
      },
      lifeCycles: {
        constructor: {
          type: 'js',
          compiled: constructorCode,
          source: constructorCode,
        },
        componentDidMount: { name: 'didMount', id: 'didMount', params: {}, type: 'actionRef' },
      },
      hidden: false,
      title: '',
      isLocked: false,
      conditionGroup: '',
      children: [
        {
          componentName: 'RootHeader',
          id: nextNodeId(),
          props: {},
          condition: true,
          hidden: false,
          title: '',
          isLocked: false,
          conditionGroup: '',
        },
        {
          componentName: 'RootContent',
          id: nextNodeId(),
          props: {},
          condition: true,
          hidden: false,
          title: '',
          isLocked: false,
          conditionGroup: '',
          children: [
            {
              componentName: 'FormContainer',
              id: nextNodeId(),
              props: {
                formLabel: i18n(formTitle, formTitle),
                formLabelVisible: true,
                columns: columns,
                labelAlign: labelAlign || 'top',
                submitText: i18n('提交', 'Submit', '送信'),
                stageText: i18n('暂存', 'Save draft', '下書き保存'),
                submitAndNewText: i18n('提交并继续', 'Submit and New', '送信して続ける'),
                fieldId: 'formContainer_' + Date.now().toString(36) + 'a',
                aiFormConfig: { systemPrompt: '', model: 'qwen' },
                beforeSubmit: false,
                afterSubmit: false,
                onProcessActionValidate: false,
                afterFormDataInit: false,
              },
              condition: true,
              hidden: false,
              title: '',
              isLocked: false,
              conditionGroup: '',
              children: formContainerChildren,
            },
          ],
        },
        {
          componentName: 'RootFooter',
          id: nextNodeId(),
          props: {},
          condition: true,
          hidden: false,
          title: '',
          isLocked: false,
          conditionGroup: '',
          children: [
            {
              componentName: 'FooterYida',
              id: nextNodeId(),
              props: {},
              condition: true,
              hidden: false,
              title: '',
              isLocked: false,
              conditionGroup: '',
            },
          ],
        },
      ],
    },
  ];

  // 页面 Schema（与模板结构一致）- utils 放在 pages[0] 内
  const pageSchema = {
    utils: [
      {
        name: 'legaoBuiltin',
        type: 'npm',
        content: {
          package: '@ali/vu-legao-builtin',
          version: '3.0.0',
          exportName: 'legaoBuiltin',
        },
      },
      {
        name: 'yidaPlugin',
        type: 'npm',
        content: {
          package: '@ali/vu-yida-plugin',
          version: '1.1.0',
          exportName: 'yidaPlugin',
        },
      },
    ],
    componentsMap: buildComponentsMap(componentNames),
    componentsTree: pageComponentsTree,
    componentAlias: {
      items: componentAliasItems,
    },
    id: formUuid,
    connectComponent: [],
  };

  // 顶层 Schema（与模板结构完全一致）- actions 和 config 与 pages 平级
  const schema = {
    schemaType: 'superform',
    schemaVersion: '5.0',
    pages: [pageSchema],
    actions: {
      module: {
        compiled: actionsCompiled,
        source: actionsSource,
      },
      type: 'FUNCTION',
      list: [
        {
          id: nextNodeId(),
          type: 'lifeCycleEvent',
          name: 'didMount',
          relatedEventId: 'lifecycle:didMount',
          params: {},
        },
      ],
    },
    config: {
      connectComponent: [],
    },
  };
  applyDefaultFormDetailStyle(schema);
  return schema;
}

// ── 发送 GET 请求（支持 302 自动重登录） ─────────────

function sendGetRequest(baseUrl, requestPath, queryParams) {
  return httpGet(baseUrl, requestPath, queryParams);
}

// ── 空白表单 Schema 模板（update 模式） ─────────────

function buildEmptyFormSchema() {
  const constructorCode = "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";
  const actionsCompiled = '"use strict";\n\nexports.__esModule = true;\nexports.didMount = didMount;\nfunction didMount() {\n  console.log("\\u300C\\u9875\\u9762 JS\\u300D\\uFF1A\\u5F53\\u524D\\u9875\\u9762\\u5730\\u5740 " + location.href);\n}\n';
  const actionsSource = 'export function didMount() {\n  console.log(`「页面 JS」：当前页面地址 ${location.href}`);\n}';

  return {
    schemaType: 'superform',
    schemaVersion: '5.0',
    actions: {
      module: { compiled: actionsCompiled, source: actionsSource },
      type: 'FUNCTION',
      list: [{ id: nextNodeId(), type: 'lifeCycleEvent', name: 'didMount', relatedEventId: 'lifecycle:didMount', params: {} }],
    },
    pages: [{
      utils: [
        { name: 'legaoBuiltin', type: 'npm', content: { package: '@ali/vu-legao-builtin', version: '3.0.0', exportName: 'legaoBuiltin' } },
        { name: 'yidaPlugin', type: 'npm', content: { package: '@ali/vu-yida-plugin', version: '1.1.0', exportName: 'yidaPlugin' } },
      ],
      componentsTree: [
        {
          componentName: 'Page',
          id: nextNodeId(),
          props: {
            contentBgColor: 'white',
            pageStyle: { backgroundColor: '#f2f3f5' },
            contentMargin: '20',
            contentPadding: '20',
            showTitle: false,
            contentPaddingMobile: '0',
            templateVersion: '1.0.0',
            contentMarginMobile: '0',
            className: 'page_' + Date.now().toString(36),
            contentBgColorMobile: 'white',
          },
          condition: true,
          css: 'body{background-color:#f2f3f5}',
          methods: {
            __initMethods__: {
              type: 'js',
              source: 'function (exports, module) { /*set actions code here*/ }',
              compiled: 'function (exports, module) { /*set actions code here*/ }',
            },
          },
          dataSource: { offline: [], globalConfig: {}, online: [], list: [], sync: true },
          lifeCycles: {
            constructor: { type: 'js', compiled: constructorCode, source: constructorCode },
            componentDidMount: { name: 'didMount', id: 'didMount', params: {}, type: 'actionRef' },
          },
          hidden: false,
          title: '',
          isLocked: false,
          conditionGroup: '',
          children: [
            { componentName: 'RootHeader', id: nextNodeId(), props: {}, condition: true, hidden: false, title: '', isLocked: false, conditionGroup: '' },
            {
              componentName: 'RootContent',
              id: nextNodeId(),
              props: {},
              condition: true,
              hidden: false,
              title: '',
              isLocked: false,
              conditionGroup: '',
              children: [
                {
                  componentName: 'FormContainer',
                  id: nextNodeId(),
                  props: {
                    beforeSubmit: false,
                    'submitProps.text': i18n('提交', 'Submit', '送信'),
                    submitText: i18n('提交', 'Submit', '送信'),
                    submitProps: { text: i18n('提交', 'Submit', '送信') },
                    labelAlign: 'top',
                    columns: 1,
                    afterSubmit: false,
                    fieldId: 'formContainer_' + Date.now().toString(36) + 'b',
                    stageText: i18n('暂存', 'Save draft', '下書き保存'),
                    submitAndNewText: i18n('提交并继续', 'Submit and New', '送信して続ける'),
                    onProcessActionValidate: false,
                    afterFormDataInit: false,
                  },
                  condition: true,
                  hidden: false,
                  title: '',
                  isLocked: false,
                  conditionGroup: '',
                  children: [],
                },
              ],
            },
            {
              componentName: 'RootFooter',
              id: nextNodeId(),
              props: {},
              condition: true,
              hidden: false,
              title: '',
              isLocked: false,
              conditionGroup: '',
              children: [
                { componentName: 'FooterYida', id: nextNodeId(), props: {}, condition: true, hidden: false, title: '', isLocked: false, conditionGroup: '' },
              ],
            },
          ],
        },
      ],
      componentsMap: [
        { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootHeader' },
        { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'FormContainer' },
        { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootContent' },
        { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'FooterYida' },
        { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootFooter' },
        { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'Page' },
      ],
    },
    ],
  };
}

// ── Schema 字段操作辅助函数（update 模式） ──────────

function extractLabelText(component) {
  if (!component || !component.props || (!component.props.label && !component.props.title)) {
    return '';
  }
  const label = component.props.label || component.props.title;
  if (typeof label === 'string') {
    return label;
  }
  return label.zh_CN || label.ja_JP || label.en_US || label.pureEn_US || '';
}

function buildComponentAliasMaps(page) {
  const aliasByFieldId = {};
  const fieldIdByAlias = {};
  const items = page &&
    page.componentAlias &&
    Array.isArray(page.componentAlias.items)
    ? page.componentAlias.items
    : [];
  items.forEach(function (item) {
    const fieldId = item && item.fieldId ? String(item.fieldId).trim() : '';
    const alias = item && item.alias ? String(item.alias).trim() : '';
    if (!fieldId || !alias) {
      return;
    }
    aliasByFieldId[fieldId] = alias;
    fieldIdByAlias[alias] = fieldId;
  });
  return { aliasByFieldId, fieldIdByAlias };
}

function findFormContainer(node) {
  if (node.componentName === 'FormContainer') {
    return node;
  }
  if (node.children && Array.isArray(node.children)) {
    for (let childIndex = 0; childIndex < node.children.length; childIndex++) {
      const found = findFormContainer(node.children[childIndex]);
      if (found) {return found;}
    }
  }
  return null;
}

function findFieldIndexByLabel(fields, label) {
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
    if (extractLabelText(fields[fieldIndex]) === label) {
      return fieldIndex;
    }
  }
  return -1;
}

function findFieldByLabelDeep(fields, label) {
  if (!Array.isArray(fields)) {
    return null;
  }
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
    const field = fields[fieldIndex];
    if (extractLabelText(field) === label) {
      return {
        field,
        fields,
        index: fieldIndex,
      };
    }
    const found = findFieldByLabelDeep(field.children, label);
    if (found) {
      return found;
    }
  }
  return null;
}

function getFieldIdFromComponent(component) {
  const props = component && component.props || {};
  return component && component.fieldId || props.fieldId || '';
}

function compactTableAncestorEvidence(component, path) {
  const labelText = extractLabelText(component) || (Array.isArray(path) && path.length > 0 ? path[path.length - 1] : '');
  const evidence = {
    label: labelText,
    fieldId: getFieldIdFromComponent(component),
    componentName: component && component.componentName || '',
  };
  if (Array.isArray(path) && path.length > 0) {
    evidence.path = path;
  }
  Object.keys(evidence).forEach(function (key) {
    if (evidence[key] === '' || evidence[key] === undefined || evidence[key] === null) {
      delete evidence[key];
    }
  });
  return evidence;
}

function buildFieldEvidence(component, tableAncestors, path) {
  const ancestors = Array.isArray(tableAncestors) ? tableAncestors : [];
  const labelText = extractLabelText(component);
  const evidence = {
    label: labelText,
    fieldId: getFieldIdFromComponent(component),
    componentName: component && component.componentName || '',
  };
  let evidencePath = Array.isArray(path) ? path.slice() : [];
  if (ancestors.length > 0 && evidencePath.length > 0) {
    const ancestorPath = ancestors[ancestors.length - 1].path || ancestors.map(function (item) { return item.label; }).filter(Boolean);
    const hasAncestorPrefix = ancestorPath.length > 0 && ancestorPath.every(function (part, index) {
      return evidencePath[index] === part;
    });
    if (!hasAncestorPrefix) {
      evidencePath = ancestorPath.concat(evidencePath);
    }
  }
  if (evidencePath.length > 0) {
    evidence.path = evidencePath;
  }
  if (ancestors.length > 0) {
    const parent = ancestors[ancestors.length - 1];
    evidence.parentLabel = parent.label;
    evidence.parentFieldId = parent.fieldId;
    evidence.labelPath = ancestors.map(function (item) { return item.label; }).filter(Boolean).concat(labelText);
    evidence.tableAncestors = ancestors.map(function (item) {
      return compactTableAncestorEvidence(item, item.path);
    });
  }
  Object.keys(evidence).forEach(function (key) {
    if (evidence[key] === '' || evidence[key] === undefined || evidence[key] === null) {
      delete evidence[key];
    }
  });
  return evidence;
}

function collectFieldReferences(fields, options) {
  const refs = [];
  const settings = options || {};

  function visit(items, ancestors, pathLabels) {
    if (!Array.isArray(items)) {
      return;
    }
    items.forEach(function (field, fieldIndex) {
      const labelText = extractLabelText(field);
      const nextPath = labelText ? pathLabels.concat(labelText) : pathLabels.slice();
      const evidence = buildFieldEvidence(field, ancestors, nextPath);
      const includePresentation = settings.includePresentation === true || !isFormPresentationComponent(field && field.componentName);
      if (includePresentation && (evidence.label || evidence.fieldId)) {
        refs.push({
          field,
          fields: items,
          index: fieldIndex,
          evidence,
          label: evidence.label || '',
          fieldId: evidence.fieldId || '',
          componentName: evidence.componentName || '',
          tableAncestors: ancestors,
          path: nextPath,
        });
      }
      const nextAncestors = field && field.componentName === 'TableField'
        ? ancestors.concat(compactTableAncestorEvidence(field, nextPath))
        : ancestors;
      visit(field && field.children, nextAncestors, nextPath);
    });
  }

  visit(fields, [], []);
  return refs;
}

function collectFieldMatchesByLabelDeep(fields, label, tableAncestors, matches) {
  const result = matches || [];
  const ancestors = Array.isArray(tableAncestors) ? tableAncestors : [];
  if (!Array.isArray(fields)) {
    return result;
  }
  fields.forEach(function (field, fieldIndex) {
    const labelText = extractLabelText(field);
    if (labelText === label) {
      result.push({
        field,
        fields,
        index: fieldIndex,
        evidence: buildFieldEvidence(field, ancestors),
      });
    }
    const nextAncestors = field && field.componentName === 'TableField'
      ? ancestors.concat(compactTableAncestorEvidence(field))
      : ancestors;
    collectFieldMatchesByLabelDeep(field && field.children, label, nextAncestors, result);
  });
  return result;
}

function collectFieldCandidates(fields, tableAncestors, query) {
  const candidates = [];
  const normalizedQuery = query ? String(query).trim() : '';
  const ancestorContext = Array.isArray(tableAncestors) ? tableAncestors : [];
  const refs = collectFieldReferences(fields, { includePresentation: true }).map(function (ref) {
    if (ancestorContext.length === 0) {
      return ref;
    }
    return Object.assign({}, ref, {
      evidence: buildFieldEvidence(ref.field, ancestorContext, ref.path),
    });
  });
  function pushMatches(filterByQuery) {
    refs.forEach(function (ref) {
      if (candidates.length >= FIELD_RESOLUTION_CANDIDATE_LIMIT) {
        return;
      }
      const evidenceLabel = ref.evidence.label || '';
      const evidenceFieldId = ref.evidence.fieldId || '';
      if (
        !filterByQuery ||
        !normalizedQuery ||
        evidenceLabel.indexOf(normalizedQuery) !== -1 ||
        normalizedQuery.indexOf(evidenceLabel) !== -1 ||
        evidenceFieldId.indexOf(normalizedQuery) !== -1 ||
        normalizedQuery.indexOf(evidenceFieldId) !== -1
      ) {
        candidates.push(ref.evidence);
      }
    });
  }
  pushMatches(true);
  if (candidates.length > 0 || !normalizedQuery) {
    return candidates;
  }
  pushMatches(false);
  return candidates;
}

function isFieldReferenceObject(value) {
  return !!(value && typeof value === 'object' && !Array.isArray(value));
}

function stringFieldReference(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function parseFieldReferenceInput(input) {
  if (!isFieldReferenceObject(input)) {
    return { ref: stringFieldReference(input), label: '', fieldId: '', tableLabel: '' };
  }

  const nestedKeys = ['ref', 'field', 'source', 'target', 'name'];
  let nested = null;
  let ref = '';
  for (let index = 0; index < nestedKeys.length; index++) {
    const key = nestedKeys[index];
    const value = input[key];
    if (isFieldReferenceObject(value)) {
      nested = parseFieldReferenceInput(value);
      break;
    }
    if (!ref) {
      ref = stringFieldReference(value);
    }
  }

  const label = stringFieldReference(input.label) || nested && nested.label || '';
  const fieldId = stringFieldReference(input.fieldId) || nested && nested.fieldId || '';
  const tableLabel = stringFieldReference(input.tableLabel || input.table || input.tableName) || nested && nested.tableLabel || '';
  const nestedRef = nested && nested.ref || '';
  return {
    ref: ref || nestedRef,
    label,
    fieldId,
    tableLabel,
  };
}

function withDefaultFieldReferenceContext(fieldRef, context) {
  const defaultTableLabel = context && context.tableLabel ? String(context.tableLabel) : '';
  if (!defaultTableLabel || fieldRef === undefined || fieldRef === null || fieldRef === '') {
    return fieldRef;
  }
  if (isFieldReferenceObject(fieldRef)) {
    const parsed = parseFieldReferenceInput(fieldRef);
    if (parsed.tableLabel) {
      return fieldRef;
    }
    return Object.assign({}, fieldRef, { tableLabel: defaultTableLabel });
  }
  return { ref: fieldRef, tableLabel: defaultTableLabel };
}

function applyDefaultFieldReferenceContextToCondition(condition, context) {
  if (!condition || typeof condition !== 'object') {
    return condition;
  }
  const nextCondition = Object.assign({}, condition);
  if (nextCondition.field) {
    nextCondition.field = withDefaultFieldReferenceContext(nextCondition.field, context);
  }
  if (nextCondition.source) {
    nextCondition.source = withDefaultFieldReferenceContext(nextCondition.source, context);
  }
  return nextCondition;
}

function createFieldResolutionDiagnostic(code, target, candidates) {
  const refTarget = parseFieldReferenceInput(target);
  const diagnostic = { code };
  if (refTarget.label) {
    diagnostic.label = refTarget.label;
  }
  if (refTarget.fieldId) {
    diagnostic.fieldId = refTarget.fieldId;
  }
  if (refTarget.tableLabel) {
    diagnostic.tableLabel = refTarget.tableLabel;
  }
  if (refTarget.ref && !diagnostic.label && !diagnostic.fieldId) {
    diagnostic.label = refTarget.ref;
  }
  diagnostic.candidates = (candidates || []).slice(0, FIELD_RESOLUTION_CANDIDATE_LIMIT);
  return diagnostic;
}

function resolveFieldReference(fields, input, options) {
  const settings = options || {};
  const target = parseFieldReferenceInput(input);
  const fieldIdByAlias = settings.fieldIdByAlias || {};
  const includePresentation = settings.includePresentation === true;
  const searchRoot = Array.isArray(fields) ? fields : [];

  function refsIn(items) {
    return collectFieldReferences(items, { includePresentation });
  }

  let searchFields = searchRoot;
  let tableEvidence = null;
  if (target.tableLabel) {
    const tableMatches = refsIn(searchRoot).filter(function (ref) {
      return ref.label === target.tableLabel;
    });
    const tableOnlyMatches = tableMatches.filter(function (ref) {
      return ref.componentName === 'TableField';
    });
    if (tableOnlyMatches.length === 0) {
      return {
        ok: false,
        diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_TABLE_NOT_FOUND', target, collectFieldCandidates(searchRoot, [], target.tableLabel)),
      };
    }
    if (tableOnlyMatches.length > 1) {
      return {
        ok: false,
        diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_TABLE_AMBIGUOUS', target, tableOnlyMatches.map(function (ref) { return ref.evidence; })),
      };
    }
    tableEvidence = tableOnlyMatches[0].evidence;
    if (!Array.isArray(tableOnlyMatches[0].field.children)) {
      return {
        ok: false,
        diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_TARGET_NOT_TABLE', target, [tableEvidence]),
      };
    }
    searchFields = tableOnlyMatches[0].field.children;
  }

  const refs = refsIn(searchFields);
  const effectiveFieldId = target.fieldId || (target.ref && fieldIdByAlias[target.ref]) || '';
  if (effectiveFieldId) {
    const fieldIdMatches = refs.filter(function (ref) {
      return ref.fieldId === effectiveFieldId || getFieldIdFromComponent(ref.field) === effectiveFieldId;
    });
    if (fieldIdMatches.length === 1) {
      return { ok: true, match: fieldIdMatches[0], resolved: fieldIdMatches[0].evidence };
    }
    if (fieldIdMatches.length > 1) {
      return {
        ok: false,
        diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_FIELD_AMBIGUOUS', target, fieldIdMatches.map(function (ref) { return ref.evidence; })),
      };
    }
    if (target.fieldId) {
      return {
        ok: false,
        diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_FIELD_ID_NOT_FOUND', target, collectFieldCandidates(searchFields, tableEvidence ? [tableEvidence] : [], target.fieldId)),
      };
    }
  }

  if (target.ref) {
    const fieldIdMatches = refs.filter(function (ref) {
      return ref.fieldId === target.ref || getFieldIdFromComponent(ref.field) === target.ref;
    });
    if (fieldIdMatches.length === 1) {
      return { ok: true, match: fieldIdMatches[0], resolved: fieldIdMatches[0].evidence };
    }
    if (fieldIdMatches.length > 1) {
      return {
        ok: false,
        diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_FIELD_AMBIGUOUS', target, fieldIdMatches.map(function (ref) { return ref.evidence; })),
      };
    }
  }

  const label = target.label || target.ref;
  if (!label) {
    return {
      ok: false,
      diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_FIELD_REF_MISSING', target, collectFieldCandidates(searchFields, tableEvidence ? [tableEvidence] : [], '')),
    };
  }

  const labelMatches = refs.filter(function (ref) {
    return ref.label === label;
  });
  if (labelMatches.length === 1) {
    return { ok: true, match: labelMatches[0], resolved: labelMatches[0].evidence };
  }
  if (labelMatches.length > 1) {
    return {
      ok: false,
      diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_FIELD_AMBIGUOUS', target, labelMatches.map(function (ref) { return ref.evidence; })),
    };
  }

  return {
    ok: false,
    diagnostic: createFieldResolutionDiagnostic('CREATE_FORM_FIELD_NOT_FOUND', target, collectFieldCandidates(searchFields, tableEvidence ? [tableEvidence] : [], label)),
  };
}

function requireResolvedField(fields, input, options) {
  const resolution = resolveFieldReference(fields, input, options);
  if (resolution.ok) {
    return resolution;
  }
  const err = createCreateFormError(t('create_form.field_resolution_failed'), 'CREATE_FORM_FIELD_RESOLUTION_FAILED', {
    diagnostics: [resolution.diagnostic],
  });
  err.diagnostics = [resolution.diagnostic];
  throw err;
}

function outputFieldResolutionFailure(appType, formUuid, diagnostics) {
  const fieldDiagnostics = Array.isArray(diagnostics) ? diagnostics : [];
  fail(t('create_form.field_resolution_failed'));
  console.log(JSON.stringify({
    success: false,
    error: 'CREATE_FORM_FIELD_RESOLUTION_FAILED',
    formUuid,
    appType,
    diagnostics: fieldDiagnostics,
  }));
  throwCreateFormError(t('create_form.field_resolution_failed'), 'CREATE_FORM_FIELD_RESOLUTION_FAILED', {
    appType,
    formUuid,
    diagnostics: fieldDiagnostics,
  });
}

function normalizeFieldResolutionApplyError(errorValue) {
  if (errorValue && errorValue.code === 'CREATE_FORM_FIELD_RESOLUTION_FAILED') {
    return errorValue;
  }
  return null;
}

function getFieldEvidenceFromLookup(fieldLookup, fieldId) {
  const descriptor = fieldLookup && fieldLookup.byFieldId && fieldLookup.byFieldId[fieldId];
  return descriptor && descriptor.evidence ? descriptor.evidence : null;
}

function buildRuleResolvedEvidence(rule, fieldLookup) {
  const resolved = {};
  if (rule.sourceFieldId) {
    resolved.source = getFieldEvidenceFromLookup(fieldLookup, rule.sourceFieldId);
  }
  if (rule.condition && rule.condition.fieldId) {
    resolved.condition = getFieldEvidenceFromLookup(fieldLookup, rule.condition.fieldId);
  }
  if (rule.targetFieldId) {
    resolved.target = getFieldEvidenceFromLookup(fieldLookup, rule.targetFieldId);
  }
  if (Array.isArray(rule.targetFieldIds)) {
    resolved.targets = rule.targetFieldIds.map(function (fieldId) {
      return getFieldEvidenceFromLookup(fieldLookup, fieldId);
    }).filter(Boolean);
  }
  if (rule.fromFieldId) {
    resolved.from = getFieldEvidenceFromLookup(fieldLookup, rule.fromFieldId);
  }
  Object.keys(resolved).forEach(function (key) {
    if (!resolved[key] || (Array.isArray(resolved[key]) && resolved[key].length === 0)) {
      delete resolved[key];
    }
  });
  return resolved;
}

function compactEvidenceValue(value, depth) {
  const currentDepth = depth || 0;
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > 120 ? value.slice(0, 117) + '...' : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map(function (item) {
      return compactEvidenceValue(item, currentDepth + 1);
    });
  }
  if (typeof value === 'object') {
    if (value.zh_CN || value.en_US || value.ja_JP || value.pureEn_US) {
      return value.zh_CN || value.en_US || value.ja_JP || value.pureEn_US;
    }
    if (currentDepth >= 2) {
      return '[object]';
    }
    const result = {};
    Object.keys(value).sort().slice(0, 8).forEach(function (key) {
      result[key] = compactEvidenceValue(value[key], currentDepth + 1);
    });
    return result;
  }
  return String(value);
}

function summarizeUpdatedProps(component, changes) {
  const props = component && component.props || {};
  const updatedProps = {};
  Object.keys(changes || {}).sort().forEach(function (key) {
    if (key === 'required') {
      updatedProps.required = (props.validation || []).some(function (rule) {
        return rule && rule.type === 'required';
      });
      return;
    }
    if (key === 'label' || key === 'title') {
      updatedProps[key] = extractLabelText(component);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      updatedProps[key] = compactEvidenceValue(props[key]);
      return;
    }
    updatedProps[key] = compactEvidenceValue(changes[key]);
  });
  return updatedProps;
}

function pushResolutionDiagnostic(diagnostics, diagnostic) {
  diagnostics.push(diagnostic);
}

function findFieldByIdOrLabelDeep(fields, identifier) {
  if (!Array.isArray(fields) || !identifier) {
    return null;
  }
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
    const field = fields[fieldIndex];
    const props = field.props || {};
    if (props.fieldId === identifier || field.fieldId === identifier || extractLabelText(field) === identifier) {
      return {
        field,
        fields,
        index: fieldIndex,
      };
    }
    const found = findFieldByIdOrLabelDeep(field.children, identifier);
    if (found) {
      return found;
    }
  }
  return null;
}

function resolveJsonPointerParent(target, pointer) {
  const segments = splitJsonPointer(pointer);
  if (segments.length === 0) {
    throw new Error('不能直接替换 Schema 根对象，请使用具体 path');
  }
  let current = target;
  for (let index = 0; index < segments.length - 1; index++) {
    const key = segments[index];
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new Error('路径不存在: ' + pointer);
    }
    if (Array.isArray(current)) {
      const arrayIndex = Number.parseInt(key, 10);
      if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || arrayIndex >= current.length) {
        throw new Error('数组下标无效: ' + key + ' in ' + pointer);
      }
      current = current[arrayIndex];
    } else {
      if (!(key in current)) {
        throw new Error('路径不存在: ' + pointer);
      }
      current = current[key];
    }
  }
  return { parent: current, key: segments[segments.length - 1] };
}

function applyJsonPointerOperation(schema, operation) {
  const op = operation.op || operation.action;
  const { parent, key } = resolveJsonPointerParent(schema, operation.path);

  if (Array.isArray(parent)) {
    if (op === 'add' && key === '-') {
      parent.push(operation.value);
      return;
    }
    const arrayIndex = Number.parseInt(key, 10);
    if (!Number.isInteger(arrayIndex) || arrayIndex < 0 || arrayIndex > parent.length) {
      throw new Error('数组下标无效: ' + key + ' in ' + operation.path);
    }
    if (op === 'remove') {
      parent.splice(arrayIndex, 1);
    } else if (op === 'add') {
      parent.splice(arrayIndex, 0, operation.value);
    } else if (op === 'replace') {
      if (arrayIndex >= parent.length) {
        throw new Error('replace 目标不存在: ' + operation.path);
      }
      parent[arrayIndex] = operation.value;
    } else {
      throw new Error('不支持的 JSON patch op: ' + op);
    }
    return;
  }

  if (op === 'remove') {
    delete parent[key];
  } else if (op === 'add' || op === 'replace') {
    parent[key] = operation.value;
  } else {
    throw new Error('不支持的 JSON patch op: ' + op);
  }
}

function ensureActionModule(schema) {
  if (!schema.actions || typeof schema.actions !== 'object') {
    schema.actions = { type: 'FUNCTION', list: [], module: {} };
  }
  if (!schema.actions.module || typeof schema.actions.module !== 'object') {
    schema.actions.module = {};
  }
  if (!Array.isArray(schema.actions.list)) {
    schema.actions.list = [];
  }
  return schema.actions;
}

function compileActionSource(source) {
  const compiledResult = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
  if (compiledResult.error instanceof Error) {
    throw new Error('动作源码编译失败: ' + compiledResult.error.message);
  }
  return compiledResult.compiled;
}

function readOptionalSource(operation, key, fileKey) {
  if (operation[fileKey]) {
    const sourcePath = path.resolve(operation[fileKey]);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(fileKey + ' 文件不存在: ' + sourcePath);
    }
    return fs.readFileSync(sourcePath, 'utf-8');
  }
  return operation[key];
}

function applySchemaPatchOperations(schema, operations) {
  if (!schema.pages || !Array.isArray(schema.pages) || schema.pages.length === 0) {
    throw new Error('Schema 为空，无法应用补丁');
  }
  const root = schema.pages[0].componentsTree && schema.pages[0].componentsTree[0];
  const formContainer = root ? findFormContainer(root) : null;
  const applied = [];

  operations.forEach(function (operation, index) {
    const action = operation.action || operation.op;
    if (!action) {
      throw new Error('补丁[' + index + '] 缺少 action/op');
    }

    if (['add', 'replace', 'remove'].includes(action)) {
      applyJsonPointerOperation(schema, operation);
      applied.push({ action, path: operation.path });
      return;
    }

    if (action === 'merge') {
      if (!operation.path || !operation.value || typeof operation.value !== 'object') {
        throw new Error('merge 操作必须提供 path 和对象 value');
      }
      const target = splitJsonPointer(operation.path).reduce(function (current, key) {
        if (current === null || current === undefined || typeof current !== 'object' || !(key in current)) {
          throw new Error('路径不存在: ' + operation.path);
        }
        return current[key];
      }, schema);
      if (!target || typeof target !== 'object' || Array.isArray(target)) {
        throw new Error('merge 目标必须是对象: ' + operation.path);
      }
      deepMerge(target, operation.value);
      applied.push({ action: 'merge', path: operation.path });
      return;
    }

    if (action === 'field-props') {
      if (!formContainer || !formContainer.children) {
        throw new Error('未找到 FormContainer');
      }
      const fieldKey = operation.fieldId || operation.field || operation.label;
      const found = findFieldByIdOrLabelDeep(formContainer.children, fieldKey);
      if (!found) {
        throw new Error('未找到字段: ' + fieldKey);
      }
      found.field.props = found.field.props || {};
      deepMerge(found.field.props, operation.props || {});
      applied.push({
        action: 'field-props',
        field: fieldKey,
        fieldId: found.field.props.fieldId || '',
        componentName: found.field.componentName,
      });
      return;
    }

    if (action === 'form-props') {
      if (!formContainer) {
        throw new Error('未找到 FormContainer');
      }
      formContainer.props = formContainer.props || {};
      deepMerge(formContainer.props, operation.props || {});
      applied.push({ action: 'form-props', keys: Object.keys(operation.props || {}) });
      return;
    }

    if (action === 'actions-module') {
      const actions = ensureActionModule(schema);
      const source = readOptionalSource(operation, 'source', 'sourceFile');
      const compiled = readOptionalSource(operation, 'compiled', 'compiledFile')
        || (source ? compileActionSource(source) : undefined);
      if (source !== undefined) {
        actions.module.source = source;
      }
      if (compiled !== undefined) {
        actions.module.compiled = compiled;
      }
      actions.type = actions.type || 'FUNCTION';
      applied.push({ action: 'actions-module', source: source !== undefined, compiled: compiled !== undefined });
      return;
    }

    if (['bind-datasource', 'data-source', 'datasource', 'select-datasource'].includes(String(action).toLowerCase())) {
      if (!formContainer || !formContainer.children) {
        throw new Error('未找到 FormContainer');
      }
      const fieldKey = operation.fieldId || operation.field || operation.label;
      const found = findFieldByIdOrLabelDeep(formContainer.children, fieldKey);
      if (!found) {
        throw new Error('未找到字段: ' + fieldKey);
      }
      if (OPTION_FIELD_TYPES.indexOf(found.field.componentName) === -1) {
        throw new Error('字段不是选项类字段，无法绑定数据源: ' + fieldKey);
      }
      found.field.props = found.field.props || {};
      const normalized = applySelectDataSourceConfig(
        found.field.props,
        operation.config || operation.remoteDataSource || operation.searchDataSource || operation.dataSourceConfig || operation
      );
      applied.push({
        action: 'bind-datasource',
        field: fieldKey,
        fieldId: found.field.props.fieldId || '',
        componentName: found.field.componentName,
        url: normalized.url,
        optionCount: normalized.options.length,
      });
      return;
    }

    if (action === 'bind-field-action') {
      if (!formContainer || !formContainer.children) {
        throw new Error('未找到 FormContainer');
      }
      const fieldKey = operation.fieldId || operation.field || operation.label;
      const eventName = operation.event || 'onChange';
      const actionName = operation.name || operation.actionName;
      if (!actionName) {
        throw new Error('bind-field-action 必须提供 name/actionName');
      }
      const found = findFieldByIdOrLabelDeep(formContainer.children, fieldKey);
      if (!found) {
        throw new Error('未找到字段: ' + fieldKey);
      }
      found.field.props = found.field.props || {};
      found.field.props[eventName] = {
        name: actionName,
        id: actionName,
        params: operation.params || {},
        type: 'actionRef',
      };

      const actions = ensureActionModule(schema);
      const relatedEventId = operation.relatedEventId || (found.field.id + ':' + eventName);
      const existing = actions.list.find(function (item) {
        return item.relatedEventId === relatedEventId && item.id === actionName;
      });
      if (!existing) {
        actions.list.push({
          relatedEventId,
          name: actionName,
          id: actionName,
          type: 'componentEvent',
          params: operation.params || {},
        });
      }
      applied.push({ action: 'bind-field-action', field: fieldKey, event: eventName, actionName });
      return;
    }

    throw new Error('不支持的补丁 action: ' + action);
  });

  return applied;
}

// ── 表单联动规则（rule 模式） ─────────────────────────

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normalizeBehaviorValue(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = String(value).trim();
  const behaviorMap = {
    show: 'NORMAL',
    visible: 'NORMAL',
    normal: 'NORMAL',
    edit: 'NORMAL',
    editable: 'NORMAL',
    hide: 'HIDDEN',
    hidden: 'HIDDEN',
    readonly: 'READONLY',
    readOnly: 'READONLY',
    'read-only': 'READONLY',
    disabled: 'DISABLED',
    NORMAL: 'NORMAL',
    HIDDEN: 'HIDDEN',
    READONLY: 'READONLY',
    DISABLED: 'DISABLED',
  };
  return behaviorMap[normalized] || behaviorMap[normalized.toLowerCase()] || normalized.toUpperCase();
}

function normalizeConditionOperator(operator, condition) {
  if (condition) {
    if (condition.empty === true) {return 'empty';}
    if (condition.notEmpty === true || condition.required === true) {return 'notEmpty';}
    if (condition.equals !== undefined) {return 'eq';}
    if (condition.notEquals !== undefined) {return 'ne';}
    if (condition.values !== undefined) {return 'in';}
  }
  const normalized = String(operator || 'eq').trim();
  const operatorMap = {
    '=': 'eq',
    '==': 'eq',
    '===': 'eq',
    eq: 'eq',
    equals: 'eq',
    is: 'eq',
    '!=': 'ne',
    '!==': 'ne',
    ne: 'ne',
    notEquals: 'ne',
    not: 'ne',
    in: 'in',
    notIn: 'notIn',
    contains: 'contains',
    notContains: 'notContains',
    empty: 'empty',
    isEmpty: 'empty',
    notEmpty: 'notEmpty',
    gt: 'gt',
    '>': 'gt',
    gte: 'gte',
    '>=': 'gte',
    lt: 'lt',
    '<': 'lt',
    lte: 'lte',
    '<=': 'lte',
  };
  return operatorMap[normalized] || operatorMap[normalized.toLowerCase()] || normalized;
}

function collectFieldDescriptors(fields, output, aliasByFieldId) {
  const descriptors = output || [];
  collectFieldReferences(fields).forEach(function (ref) {
    if (ref.fieldId) {
      descriptors.push({
        fieldId: ref.fieldId,
        alias: aliasByFieldId && aliasByFieldId[ref.fieldId] || '',
        label: ref.label,
        componentName: ref.componentName,
        nodeId: ref.field && ref.field.id || '',
        field: ref.field,
        evidence: ref.evidence,
        path: ref.path,
        tableAncestors: ref.evidence.tableAncestors || [],
      });
    }
  });
  return descriptors;
}

function buildFieldLookup(fields, page) {
  const aliasMaps = buildComponentAliasMaps(page);
  const descriptors = collectFieldDescriptors(fields, [], aliasMaps.aliasByFieldId);
  const byRef = {};
  const byFieldId = {};
  descriptors.forEach(function (descriptor) {
    byFieldId[descriptor.fieldId] = descriptor;
    byRef[descriptor.fieldId] = descriptor;
    if (descriptor.alias) {
      byRef[descriptor.alias] = descriptor;
    }
    if (descriptor.label) {
      byRef[descriptor.label] = descriptor;
    }
  });
  return { fields, descriptors, byRef, byFieldId, aliasByFieldId: aliasMaps.aliasByFieldId, fieldIdByAlias: aliasMaps.fieldIdByAlias };
}

function resolveRuleField(fieldLookup, fieldRef, role) {
  const targetInput = fieldRef && typeof fieldRef === 'object'
    ? fieldRef
    : { ref: fieldRef };
  const hasReference = !!(targetInput.ref || targetInput.fieldId || targetInput.label || targetInput.field || targetInput.source || targetInput.target || targetInput.name);
  if (!hasReference) {
    throw new Error(role + ' 缺少字段引用');
  }
  const resolution = resolveFieldReference(fieldLookup.fields, targetInput, {
    fieldIdByAlias: fieldLookup.fieldIdByAlias,
  });
  if (!resolution.ok) {
    const diagnostic = Object.assign({ role }, resolution.diagnostic);
    const err = createCreateFormError(t('create_form.field_resolution_failed'), 'CREATE_FORM_FIELD_RESOLUTION_FAILED', {
      diagnostics: [diagnostic],
    });
    err.diagnostics = [diagnostic];
    throw err;
  }
  return fieldLookup.byFieldId[resolution.match.fieldId] || {
    fieldId: resolution.match.fieldId,
    alias: fieldLookup.aliasByFieldId[resolution.match.fieldId] || '',
    label: resolution.match.label,
    componentName: resolution.match.componentName,
    nodeId: resolution.match.field && resolution.match.field.id || '',
    field: resolution.match.field,
    evidence: resolution.resolved,
    path: resolution.match.path,
    tableAncestors: resolution.resolved.tableAncestors || [],
  };
}

function extractCondition(rule, fallbackFieldRef, fallbackValue) {
  const rawWhen = rule.when && typeof rule.when === 'object' ? Object.assign({}, rule.when) : {};
  const condition = rawWhen;
  condition.field = condition.field || condition.source || fallbackFieldRef;

  if (rule.operator !== undefined && condition.operator === undefined) {
    condition.operator = rule.operator;
  }
  if (rule.op !== undefined && condition.op === undefined) {
    condition.op = rule.op;
  }
  if (rule.equals !== undefined && condition.equals === undefined) {
    condition.equals = rule.equals;
  }
  if (rule.notEquals !== undefined && condition.notEquals === undefined) {
    condition.notEquals = rule.notEquals;
  }
  if (rule.values !== undefined && condition.values === undefined) {
    condition.values = rule.values;
  }
  if (fallbackValue !== undefined && condition.value === undefined && condition.equals === undefined && condition.values === undefined) {
    condition.value = fallbackValue;
  }
  return condition;
}

function normalizeRuntimeCondition(fieldLookup, condition, role) {
  if (!condition || !condition.field) {
    return { operator: 'always' };
  }
  const fieldDescriptor = resolveRuleField(fieldLookup, condition, role || '条件字段');
  const operator = normalizeConditionOperator(condition.operator || condition.op, condition);
  const normalized = {
    fieldId: fieldDescriptor.fieldId,
    operator,
  };
  if (condition.equals !== undefined) {
    normalized.value = condition.equals;
  } else if (condition.notEquals !== undefined) {
    normalized.value = condition.notEquals;
  } else if (condition.values !== undefined) {
    normalized.values = Array.isArray(condition.values) ? condition.values : [condition.values];
  } else if (condition.value !== undefined) {
    normalized.value = condition.value;
  }
  return normalized;
}

function normalizeTemplateFields(fieldLookup, template) {
  const fields = {};
  if (!template || typeof template !== 'string') {
    return fields;
  }
  const pattern = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match;
  while ((match = pattern.exec(template))) {
    const ref = match[1].trim();
    const descriptor = resolveRuleField(fieldLookup, ref, '模板字段');
    fields[ref] = descriptor.fieldId;
  }
  return fields;
}

function normalizeVisibilityRule(fieldLookup, rule, index) {
  const fieldContext = { tableLabel: rule.tableLabel || rule.table || rule.tableName || '' };
  const fallbackFieldRef = withDefaultFieldReferenceContext(rule.source || rule.field || rule.on, fieldContext);
  const condition = normalizeRuntimeCondition(
    fieldLookup,
    applyDefaultFieldReferenceContextToCondition(extractCondition(rule, fallbackFieldRef, rule.equals), fieldContext),
    '条件字段'
  );
  if (condition.operator === 'always') {
    throw new Error('显隐规则[' + (index + 1) + '] 必须提供 source/when.field');
  }

  const targetRefs = [];
  if (Array.isArray(rule.targets)) {
    targetRefs.push(...rule.targets.map(function (targetRef) {
      return withDefaultFieldReferenceContext(targetRef, fieldContext);
    }));
  } else if (rule.target) {
    targetRefs.push(withDefaultFieldReferenceContext(rule.target, fieldContext));
  }
  if (rule.then && typeof rule.then === 'object' && rule.then.field) {
    targetRefs.push(withDefaultFieldReferenceContext(rule.then.field, {
      tableLabel: rule.then.tableLabel || rule.then.table || rule.then.tableName || fieldContext.tableLabel,
    }));
  }
  if (targetRefs.length === 0) {
    throw new Error('显隐规则[' + (index + 1) + '] 必须提供 target/targets');
  }

  const targetFields = targetRefs.map(function (targetRef) {
    return resolveRuleField(fieldLookup, targetRef, '目标字段');
  });

  const thenBehavior = normalizeBehaviorValue(
    rule.behavior !== undefined ? rule.behavior :
      rule.thenBehavior !== undefined ? rule.thenBehavior :
        rule.then && rule.then.behavior !== undefined ? rule.then.behavior :
          rule.show === false ? 'HIDDEN' : 'NORMAL',
    'NORMAL'
  );

  let elseBehavior;
  if (rule.otherwise === false || rule.else === false || rule.elseBehavior === false) {
    elseBehavior = null;
  } else {
    elseBehavior = normalizeBehaviorValue(
      rule.elseBehavior !== undefined ? rule.elseBehavior :
        rule.otherwise && rule.otherwise.behavior !== undefined ? rule.otherwise.behavior :
          rule.else && rule.else.behavior !== undefined ? rule.else.behavior :
            thenBehavior === 'HIDDEN' ? 'NORMAL' : 'HIDDEN',
      thenBehavior === 'HIDDEN' ? 'NORMAL' : 'HIDDEN'
    );
  }

  return {
    id: rule.id || 'visibility_' + (index + 1),
    type: 'visibility',
    sourceFieldId: condition.fieldId,
    condition,
    targetFieldIds: targetFields.map(function (field) { return field.fieldId; }),
    behavior: thenBehavior,
    elseBehavior,
  };
}

function normalizeSetValueRule(fieldLookup, rule, index) {
  const fieldContext = { tableLabel: rule.tableLabel || rule.table || rule.tableName || '' };
  const conditionSource = rule.when && typeof rule.when === 'object' ? rule.when.field || rule.when.source : '';
  const sourceRef = withDefaultFieldReferenceContext(rule.on || rule.source || conditionSource || rule.field || rule.from, fieldContext);
  const hasExplicitCondition = !!rule.when ||
    hasOwn(rule, 'operator') ||
    hasOwn(rule, 'op') ||
    hasOwn(rule, 'equals') ||
    hasOwn(rule, 'notEquals') ||
    hasOwn(rule, 'values') ||
    hasOwn(rule, 'empty') ||
    hasOwn(rule, 'notEmpty');
  const condition = hasExplicitCondition
    ? normalizeRuntimeCondition(fieldLookup, applyDefaultFieldReferenceContextToCondition(extractCondition(rule, sourceRef), fieldContext), '条件字段')
    : { operator: 'always' };
  const targetDescriptor = resolveRuleField(fieldLookup, withDefaultFieldReferenceContext(rule.target || rule.fieldId, fieldContext), '目标字段');

  const normalized = {
    id: rule.id || 'set_value_' + (index + 1),
    type: 'setValue',
    sourceFieldId: sourceRef ? resolveRuleField(fieldLookup, sourceRef, '触发字段').fieldId : condition.fieldId || '',
    condition,
    targetFieldId: targetDescriptor.fieldId,
    triggerChange: rule.triggerChange === true,
  };

  if (hasOwn(rule, 'value')) {
    normalized.value = rule.value;
  } else if (rule.template !== undefined) {
    normalized.template = String(rule.template);
    normalized.templateFields = normalizeTemplateFields(fieldLookup, normalized.template);
  } else if (rule.expression !== undefined || rule.formula !== undefined) {
    normalized.expression = String(rule.expression !== undefined ? rule.expression : rule.formula);
  } else if (rule.from) {
    normalized.fromFieldId = resolveRuleField(fieldLookup, withDefaultFieldReferenceContext(rule.from, fieldContext), '来源字段').fieldId;
  } else if (normalized.sourceFieldId) {
    normalized.fromFieldId = normalized.sourceFieldId;
  } else {
    throw new Error('赋值规则[' + (index + 1) + '] 必须提供 value/template/expression/from/source');
  }

  if (hasOwn(rule, 'elseValue')) {
    normalized.elseValue = rule.elseValue;
  }

  return normalized;
}

function normalizeFormRules(formContainer, rules, page) {
  if (!formContainer || !Array.isArray(formContainer.children)) {
    throw new Error('未找到 FormContainer');
  }
  const fieldLookup = buildFieldLookup(formContainer.children, page);
  const normalizedRules = rules.map(function (rule, index) {
    const type = String(rule.type || rule.action || '').trim();
    const normalizedType = type.toLowerCase();
    if (['visibility', 'behavior', 'show-hide', 'showhide', 'visible'].includes(normalizedType)) {
      return normalizeVisibilityRule(fieldLookup, rule, index);
    }
    if (['set-value', 'setvalue', 'assign', 'assignment', 'auto-fill', 'autofill', 'copy-value', 'copyvalue'].includes(normalizedType)) {
      return normalizeSetValueRule(fieldLookup, rule, index);
    }
    throw new Error('规则[' + (index + 1) + '] 类型不支持: ' + (type || '(empty)'));
  });

  const fieldMap = {};
  fieldLookup.descriptors.forEach(function (descriptor) {
    fieldMap[descriptor.fieldId] = descriptor.fieldId;
    if (descriptor.alias) {
      fieldMap[descriptor.alias] = descriptor.fieldId;
    }
    if (descriptor.label) {
      fieldMap[descriptor.label] = descriptor.fieldId;
    }
  });

  return {
    rules: normalizedRules,
    fieldLookup,
    fieldMap,
  };
}

function sanitizeActionName(value) {
  const sanitized = String(value || '')
    .replace(/[^A-Za-z0-9_$]/g, '_')
    .replace(/^[^A-Za-z_$]+/, '');
  return sanitized || 'field';
}

function isValidActionIdentifier(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || ''));
}

function upsertGeneratedSourceBlockWithBounds(existingSource, generatedSource, blockStart, blockEnd) {
  const source = existingSource || '';
  const startIndex = source.indexOf(blockStart);
  const endIndex = source.indexOf(blockEnd);
  const cleanSource = startIndex !== -1 && endIndex !== -1 && endIndex > startIndex
    ? source.slice(0, startIndex).trimEnd() + source.slice(endIndex + blockEnd.length)
    : source;
  return cleanSource.trimEnd() + '\n\n' + blockStart + '\n' + generatedSource.trim() + '\n' + blockEnd + '\n';
}

function removeGeneratedSourceBlockWithBounds(existingSource, blockStart, blockEnd) {
  const source = existingSource || '';
  const startIndex = source.indexOf(blockStart);
  const endIndex = source.indexOf(blockEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return source;
  }
  return (source.slice(0, startIndex).trimEnd() + source.slice(endIndex + blockEnd.length)).trim();
}

function upsertGeneratedSourceBlock(existingSource, generatedSource) {
  return upsertGeneratedSourceBlockWithBounds(
    existingSource,
    generatedSource,
    FORM_RULES_BLOCK_START,
    FORM_RULES_BLOCK_END
  );
}

function upsertActionListEntry(actions, entry) {
  actions.list = (actions.list || []).filter(function (item) {
    return !(item.id === entry.id && item.relatedEventId === entry.relatedEventId);
  });
  actions.list.push(entry);
}

function buildFormRulesActionSource(rules, fieldMap, bindings) {
  const rulesJson = JSON.stringify(rules, null, 2);
  const fieldMapJson = JSON.stringify(fieldMap, null, 2);
  const wrapperSource = bindings.map(function (binding) {
    const previousCall = binding.previousActionName && isValidActionIdentifier(binding.previousActionName)
      ? '  if (typeof ' + binding.previousActionName + ' === "function") {\n    ' + binding.previousActionName + '.call(this, event);\n  }\n'
      : '';
    return 'export function ' + binding.wrapperName + '(event) {\n' +
      '  event = event || {};\n' +
      '  event.__openyidaSourceFieldId = "' + binding.fieldId + '";\n' +
      previousCall +
      '  return openyidaApplyRules.call(this, event);\n' +
      '}';
  }).join('\n\n');

  return `
var OPENYIDA_RULES = ${rulesJson};
var OPENYIDA_RULE_FIELD_MAP = ${fieldMapJson};

function openyidaRuleGetComponent(ctx, fieldId) {
  if (!fieldId) { return null; }
  if (ctx && typeof ctx.$ === 'function') {
    return ctx.$(fieldId);
  }
  if (typeof $ === 'function') {
    return $(fieldId);
  }
  return null;
}

function openyidaRuleGetValue(ctx, fieldId, event) {
  if (event && event.__openyidaSourceFieldId === fieldId && event.value !== undefined) {
    return event.value;
  }
  var component = openyidaRuleGetComponent(ctx, fieldId);
  if (!component) { return undefined; }
  if (typeof component.getValue === 'function') {
    return component.getValue();
  }
  if (typeof component.get === 'function') {
    return component.get('value');
  }
  return undefined;
}

function openyidaRuleSetValue(ctx, fieldId, value, triggerChange) {
  var component = openyidaRuleGetComponent(ctx, fieldId);
  if (!component) { return; }
  if (typeof component.setValue === 'function') {
    component.setValue(value, { triggerChange: triggerChange === true });
    return;
  }
  if (typeof component.set === 'function') {
    component.set('value', value);
  }
}

function openyidaRuleSetBehavior(ctx, fieldId, behavior) {
  var component = openyidaRuleGetComponent(ctx, fieldId);
  if (!component) { return; }
  if (typeof component.setBehavior === 'function') {
    component.setBehavior(behavior);
    return;
  }
  if (typeof component.set === 'function') {
    component.set('behavior', behavior);
  }
}

function openyidaRuleIsEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function openyidaRuleMatch(value, condition) {
  if (!condition || condition.operator === 'always') { return true; }
  var operator = condition.operator || 'eq';
  if (operator === 'empty') { return openyidaRuleIsEmpty(value); }
  if (operator === 'notEmpty') { return !openyidaRuleIsEmpty(value); }
  if (operator === 'in') {
    return (condition.values || []).indexOf(value) !== -1;
  }
  if (operator === 'notIn') {
    return (condition.values || []).indexOf(value) === -1;
  }
  if (operator === 'contains') {
    return Array.isArray(value) ? value.indexOf(condition.value) !== -1 : String(value || '').indexOf(String(condition.value)) !== -1;
  }
  if (operator === 'notContains') {
    return Array.isArray(value) ? value.indexOf(condition.value) === -1 : String(value || '').indexOf(String(condition.value)) === -1;
  }
  if (operator === 'ne') { return value !== condition.value; }
  if (operator === 'gt') { return Number(value) > Number(condition.value); }
  if (operator === 'gte') { return Number(value) >= Number(condition.value); }
  if (operator === 'lt') { return Number(value) < Number(condition.value); }
  if (operator === 'lte') { return Number(value) <= Number(condition.value); }
  return value === condition.value;
}

function openyidaRuleCollectFields(ctx, event) {
  var fields = {};
  Object.keys(OPENYIDA_RULE_FIELD_MAP).forEach(function(key) {
    fields[key] = openyidaRuleGetValue(ctx, OPENYIDA_RULE_FIELD_MAP[key], event);
  });
  return fields;
}

function openyidaRuleResolveValue(ctx, rule, sourceValue, event) {
  if (Object.prototype.hasOwnProperty.call(rule, 'value')) {
    return rule.value;
  }
  if (rule.fromFieldId) {
    return openyidaRuleGetValue(ctx, rule.fromFieldId, event);
  }
  if (rule.template) {
    return rule.template.replace(/\\{\\{\\s*([^}]+?)\\s*\\}\\}/g, function(match, ref) {
      var fieldId = rule.templateFields && rule.templateFields[ref.trim()];
      var value = fieldId === rule.sourceFieldId && sourceValue !== undefined
        ? sourceValue
        : (fieldId ? openyidaRuleGetValue(ctx, fieldId, event) : '');
      return value === undefined || value === null ? '' : String(value);
    });
  }
  if (rule.expression) {
    var fields = openyidaRuleCollectFields(ctx, event);
    return (new Function('value', 'fields', 'event', 'ctx', 'return (' + rule.expression + ');'))(sourceValue, fields, event || {}, ctx);
  }
  return sourceValue;
}

export function openyidaApplyRules(event) {
  event = event || {};
  var ctx = this;
  OPENYIDA_RULES.forEach(function(rule) {
    var conditionValue = rule.condition && rule.condition.fieldId
      ? openyidaRuleGetValue(ctx, rule.condition.fieldId, event)
      : undefined;
    var matched = openyidaRuleMatch(conditionValue, rule.condition);

    if (rule.type === 'visibility') {
      var behavior = matched ? rule.behavior : rule.elseBehavior;
      if (!behavior) { return; }
      (rule.targetFieldIds || []).forEach(function(fieldId) {
        openyidaRuleSetBehavior(ctx, fieldId, behavior);
      });
      return;
    }

    if (rule.type === 'setValue') {
      if (!matched && !Object.prototype.hasOwnProperty.call(rule, 'elseValue')) {
        return;
      }
      var sourceValue = rule.sourceFieldId ? openyidaRuleGetValue(ctx, rule.sourceFieldId, event) : conditionValue;
      var nextValue = matched ? openyidaRuleResolveValue(ctx, rule, sourceValue, event) : rule.elseValue;
      openyidaRuleSetValue(ctx, rule.targetFieldId, nextValue, rule.triggerChange);
    }
  });
}

export function openyidaRulesDidMount(event) {
  if (typeof didMount === 'function') {
    didMount.call(this, event);
  }
  return openyidaApplyRules.call(this, event || {});
}

${wrapperSource}
`;
}

function applyFormRules(schema, rawRules) {
  if (!schema.pages || !Array.isArray(schema.pages) || schema.pages.length === 0) {
    throw new Error('Schema 为空，无法配置规则');
  }
  const root = schema.pages[0].componentsTree && schema.pages[0].componentsTree[0];
  const formContainer = root ? findFormContainer(root) : null;
  const normalized = normalizeFormRules(formContainer, rawRules, schema.pages[0]);
  const actions = ensureActionModule(schema);

  const sourceFieldIds = new Set();
  normalized.rules.forEach(function (rule) {
    if (rule.sourceFieldId) {
      sourceFieldIds.add(rule.sourceFieldId);
    }
    if (rule.condition && rule.condition.fieldId) {
      sourceFieldIds.add(rule.condition.fieldId);
    }
  });

  const bindings = [];
  sourceFieldIds.forEach(function (fieldId) {
    const found = findFieldByIdOrLabelDeep(formContainer.children, fieldId);
    if (!found) {
      return;
    }
    found.field.props = found.field.props || {};
    const eventName = 'onChange';
    const existingAction = found.field.props[eventName];
    const previousActionName = existingAction &&
      existingAction.type === 'actionRef' &&
      existingAction.name &&
      !String(existingAction.name).startsWith('openyidaRuleChange_')
      ? String(existingAction.name)
      : '';
    const wrapperName = 'openyidaRuleChange_' + sanitizeActionName(fieldId);
    const relatedEventId = (found.field.id || fieldId) + ':' + eventName;

    found.field.props[eventName] = {
      name: wrapperName,
      id: wrapperName,
      params: {},
      type: 'actionRef',
    };

    actions.list = actions.list.filter(function (item) {
      return !(item.relatedEventId === relatedEventId && String(item.id || '').startsWith('openyidaRuleChange_'));
    });
    upsertActionListEntry(actions, {
      relatedEventId,
      name: wrapperName,
      id: wrapperName,
      type: 'componentEvent',
      params: {},
    });

    bindings.push({
      fieldId,
      eventName,
      wrapperName,
      previousActionName,
      relatedEventId,
      label: extractLabelText(found.field),
    });
  });

  if (root) {
    root.lifeCycles = root.lifeCycles || {};
    root.lifeCycles.componentDidMount = {
      name: 'openyidaRulesDidMount',
      id: 'openyidaRulesDidMount',
      params: {},
      type: 'actionRef',
    };
    upsertActionListEntry(actions, {
      id: 'openyidaRulesDidMount',
      name: 'openyidaRulesDidMount',
      relatedEventId: 'lifecycle:didMount',
      type: 'lifeCycleEvent',
      params: {},
    });
  }

  formContainer.props = formContainer.props || {};
  formContainer.props.afterFormDataInit = {
    name: 'openyidaApplyRules',
    id: 'openyidaApplyRules',
    params: {},
    type: 'actionRef',
  };
  upsertActionListEntry(actions, {
    id: 'openyidaApplyRules',
    name: 'openyidaApplyRules',
    relatedEventId: (formContainer.id || 'FormContainer') + ':afterFormDataInit',
    type: 'componentEvent',
    params: {},
  });

  const generatedSource = buildFormRulesActionSource(normalized.rules, normalized.fieldMap, bindings);
  actions.module.source = upsertGeneratedSourceBlock(actions.module.source || '', generatedSource);
  actions.module.compiled = compileActionSource(actions.module.source);
  actions.type = actions.type || 'FUNCTION';

  return {
    rules: normalized.rules,
    bindings,
    fieldLookup: normalized.fieldLookup,
  };
}

// ── 表单智能校验（validation 模式 / add-validation）──────────────────

function normalizeSmartValidationCondition(fieldLookup, condition) {
  if (!condition || typeof condition !== 'object') {
    return null;
  }
  return normalizeRuntimeCondition(fieldLookup, condition, '条件字段');
}

function resolveSmartRuleField(fieldLookup, rule, role) {
  return resolveRuleField(fieldLookup, rule, role || '校验字段');
}

function normalizeSmartValidationRule(fieldLookup, rule, index) {
  if (!rule || typeof rule !== 'object') {
    throw new Error('校验规则[' + (index + 1) + '] 必须是对象');
  }

  let type = normalizeValidationType(rule.type || rule.validator || rule.kind || (rule.pattern ? 'regex' : ''));
  if (type === 'required' && rule.when) {
    type = 'conditionalRequired';
  }
  if (!type) {
    throw new Error('校验规则[' + (index + 1) + '] 缺少 type');
  }

  if (type === 'compare') {
    const leftRef = rule.fieldId || rule.field || rule.source || rule.left || rule.start;
    const rightRef = rule.targetFieldId || rule.target || rule.compareTo || rule.compare_to || rule.otherField || rule.other_field || rule.right || rule.end;
    const left = resolveRuleField(fieldLookup, leftRef, '比较字段');
    const right = resolveRuleField(fieldLookup, rightRef, '被比较字段');
    return {
      id: rule.id || 'validation_' + (index + 1),
      type,
      fieldId: left.fieldId,
      fieldLabel: left.label,
      targetFieldId: right.fieldId,
      targetLabel: right.label,
      operator: rule.operator || rule.op || rule.compare || '<=',
      message: rule.message || rule.errorMessage || defaultValidationMessage(type),
    };
  }

  if (type === 'conditionalRequired') {
    const target = resolveSmartRuleField(fieldLookup, rule, '必填字段');
    const when = rule.when || rule.condition || {};
    const condition = normalizeSmartValidationCondition(fieldLookup, when);
    if (!condition || condition.operator === 'always') {
      throw new Error('条件必填规则[' + (index + 1) + '] 必须提供 when.field');
    }
    return {
      id: rule.id || 'validation_' + (index + 1),
      type,
      fieldId: target.fieldId,
      fieldLabel: target.label,
      condition,
      message: rule.message || rule.errorMessage || defaultValidationMessage(type),
    };
  }

  const field = resolveSmartRuleField(fieldLookup, rule, '校验字段');
  const normalized = {
    id: rule.id || 'validation_' + (index + 1),
    type,
    fieldId: field.fieldId,
    fieldLabel: field.label,
    componentName: field.componentName,
    message: rule.message || rule.errorMessage || rule.tips || defaultValidationMessage(type),
  };

  if (rule.pattern !== undefined || rule.regex !== undefined) {
    normalized.pattern = String(rule.pattern !== undefined ? rule.pattern : rule.regex);
  }
  if (Array.isArray(rule.domainWhitelist)) {
    normalized.domainWhitelist = rule.domainWhitelist;
  } else if (rule.domain_whitelist) {
    normalized.domainWhitelist = String(rule.domain_whitelist).split(',').map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }
  if (rule.region !== undefined) {
    normalized.region = rule.region;
  }
  if (rule.expression !== undefined || rule.formula !== undefined || rule.source !== undefined) {
    normalized.expression = String(rule.expression !== undefined ? rule.expression : rule.formula !== undefined ? rule.formula : rule.source);
  }
  if (rule.api || rule.url || rule.endpoint) {
    normalized.api = rule.api || rule.url || rule.endpoint;
    normalized.method = rule.method || 'POST';
    normalized.headers = rule.headers || {};
    normalized.body = rule.body;
    normalized.validPath = rule.validPath || rule.valid_path || '';
  }
  if (type === 'async' && !normalized.api) {
    throw new Error('异步校验规则[' + (index + 1) + '] 必须提供 api/url/endpoint');
  }
  if (rule.when || rule.condition) {
    normalized.condition = normalizeSmartValidationCondition(fieldLookup, rule.when || rule.condition);
  }

  return normalized;
}

function normalizeSmartValidationRules(formContainer, rawRules, page) {
  if (!formContainer || !Array.isArray(formContainer.children)) {
    throw new Error('未找到 FormContainer');
  }
  const fieldLookup = buildFieldLookup(formContainer.children, page);
  const normalizedRules = rawRules.map(function (rule, index) {
    return normalizeSmartValidationRule(fieldLookup, rule, index);
  });

  const fieldMap = {};
  fieldLookup.descriptors.forEach(function (descriptor) {
    fieldMap[descriptor.fieldId] = descriptor.fieldId;
    if (descriptor.alias) {
      fieldMap[descriptor.alias] = descriptor.fieldId;
    }
    if (descriptor.label) {
      fieldMap[descriptor.label] = descriptor.fieldId;
    }
  });

  return {
    rules: normalizedRules,
    fieldLookup,
    fieldMap,
  };
}

function toDesignerValidationRule(rule) {
  if (!rule) {
    return null;
  }

  if (rule.type === 'regex') {
    return {
      type: 'customValidate',
      param: buildCustomValidateExpressionParam(rule),
      message: rule.message,
    };
  }

  if (isAdvancedValidationRule(rule)) {
    return {
      type: 'customValidate',
      param: buildCustomValidateExpressionParam(rule),
      message: rule.message,
    };
  }

  if (!isNativeFieldValidationRule(rule)) {
    return null;
  }
  if (rule.type === 'customValidate' && !rule.param) {
    return null;
  }

  const designerRule = {
    type: rule.type,
    message: rule.message,
  };
  ['param', 'minLength', 'maxLength', 'minValue', 'maxValue'].forEach(function (key) {
    if (rule[key] !== undefined) {
      designerRule[key] = key === 'param' && rule.type === 'customValidate'
        ? normalizeCustomValidateParam(rule[key])
        : rule[key];
    }
  });
  return designerRule;
}

function isAdvancedValidationRule(rule) {
  if (!rule || isNativeFieldValidationRule(rule)) {
    return false;
  }
  return ['bankCard', 'unifiedSocialCreditCode', 'email', 'compare', 'conditionalRequired', 'custom', 'async'].indexOf(rule.type) !== -1;
}

function resetGeneratedTextFieldValidationType(field) {
  if (!field || field.componentName !== 'TextField' || !field.props) {
    return;
  }
  if (['mobile', 'email', 'url', 'chineseID'].indexOf(field.props.validationType) !== -1) {
    field.props.validationType = 'text';
  }
}

function cleanupLegacyGeneratedValidationRules(validation, designerRule) {
  const rules = Array.isArray(validation) ? validation : [];
  if (designerRule && designerRule.type === 'mobile') {
    return rules.filter(function (rule) {
      return !rule || rule.type !== 'phone';
    });
  }
  return rules;
}

function jsString(value) {
  return JSON.stringify(value === undefined ? '' : value);
}

function compileCustomValidateSource(source) {
  const funcSource = String(source || 'function validateRule(value) { return true; }').trim();
  return 'function main(){\n    \n    "use strict";\n\nvar __compiledFunc__ = '
      + funcSource
      + ';\n    return __compiledFunc__.apply(this, arguments);\n  }';
}

function normalizeCustomValidateParam(param) {
  if (param && typeof param === 'object' && param.type === 'js') {
    const source = param.source || 'function validateRule(value) { return true; }';
    return {
      compiled: param.compiled || compileCustomValidateSource(source),
      source: source,
      type: 'js',
      error: param.error || {},
    };
  }
  let funcSource = typeof param === 'string' ? param
    : (param && typeof param === 'object' && param.type === 'JSExpression') ? String(param.value || '')
      : String(param || '');
  if (!funcSource || !/function/.test(funcSource)) {
    funcSource = 'function validateRule(value) { return true; }';
  }
  return {
    compiled: compileCustomValidateSource(funcSource),
    source: funcSource,
    type: 'js',
    error: {},
  };
}

function buildCustomValidateExpressionParam(rule) {
  return normalizeCustomValidateParam(buildCustomValidateParam(rule));
}

function buildCustomValidateParam(rule) {
  if (rule.type === 'customValidate' && rule.param) {
    if (typeof rule.param === 'object' && rule.param.type === 'js') {
      return rule.param;
    }
    return typeof rule.param === 'object' && rule.param.type === 'JSExpression'
      ? String(rule.param.value || '')
      : String(rule.param);
  }

  const fieldId = jsString(rule.fieldId);
  const targetFieldId = jsString(rule.targetFieldId || '');
  const operator = jsString(rule.operator || '<=');
  const pattern = jsString(rule.pattern || '');
  const expression = jsString(rule.expression || 'true');
  const condition = JSON.stringify(rule.condition || null);
  const domainWhitelist = JSON.stringify(rule.domainWhitelist || []);
  const api = jsString(rule.api || '');
  const method = jsString(rule.method || 'POST');
  const headers = JSON.stringify(rule.headers || {});
  const body = JSON.stringify(rule.body === undefined ? null : rule.body);
  const validPath = jsString(rule.validPath || '');

  return `function validateRule(value, currentRule) {
  var FIELD_ID = ${fieldId};
  var TARGET_FIELD_ID = ${targetFieldId};
  var OPERATOR = ${operator};
  var PATTERN = ${pattern};
  var EXPRESSION = ${expression};
  var CONDITION = ${condition};
  var DOMAIN_WHITELIST = ${domainWhitelist};
  var API = ${api};
  var METHOD = ${method};
  var HEADERS = ${headers};
  var BODY = ${body};
  var VALID_PATH = ${validPath};
  var self = this;
  var state = currentRule && currentRule.values || {};
  var ctx = currentRule || {};

  function isEmpty(input) {
    return input === undefined || input === null || input === '' || (Array.isArray(input) && input.length === 0);
  }

  function text(input) {
    if (input === undefined || input === null) { return ''; }
    if (Array.isArray(input)) { return input.join(','); }
    if (typeof input === 'object') {
      if (input.value !== undefined) { return String(input.value).trim(); }
      if (input.label !== undefined) { return String(input.label).trim(); }
      try { return JSON.stringify(input); } catch (err) { return String(input); }
    }
    return String(input).trim();
  }

  function getFieldValue(id) {
    if (!id) { return undefined; }
    try {
      if (ctx && ctx.store && typeof ctx.store.get === 'function') {
        var model = ctx.store.get(id);
        if (model) {
          if (typeof model.getVal === 'function') { return model.getVal(); }
          if (typeof model.getValue === 'function') { return model.getValue(); }
          if (typeof model.get === 'function') { return model.get('value'); }
        }
      }
    } catch (err) {}
    try {
      if (self && typeof self.$ === 'function') {
        var component = self.$(id);
        if (component) {
          if (typeof component.getValue === 'function') { return component.getValue(); }
          if (typeof component.get === 'function') { return component.get('value'); }
        }
      }
    } catch (err) {}
    try {
      if (typeof $ === 'function') {
        var globalComponent = $(id);
        if (globalComponent) {
          if (typeof globalComponent.getValue === 'function') { return globalComponent.getValue(); }
          if (typeof globalComponent.get === 'function') { return globalComponent.get('value'); }
        }
      }
    } catch (err) {}
    if (state && Object.prototype.hasOwnProperty.call(state, id)) { return state[id]; }
    return undefined;
  }

  function comparable(input) {
    if (input instanceof Date) { return input.getTime(); }
    if (typeof input === 'number') { return input; }
    var source = text(input);
    if (/^\\d{13}$/.test(source)) { return Number(source); }
    var parsedDate = Date.parse(source);
    if (!isNaN(parsedDate)) { return parsedDate; }
    var parsedNumber = Number(source);
    return isNaN(parsedNumber) ? source : parsedNumber;
  }

  function match(input, condition) {
    if (!condition || condition.operator === 'always') { return true; }
    var conditionValue = condition.value;
    var op = condition.operator || 'eq';
    if (op === 'empty') { return isEmpty(input); }
    if (op === 'notEmpty') { return !isEmpty(input); }
    if (op === 'in') { return (condition.values || []).indexOf(input) !== -1 || (condition.values || []).indexOf(text(input)) !== -1; }
    if (op === 'notIn') { return (condition.values || []).indexOf(input) === -1 && (condition.values || []).indexOf(text(input)) === -1; }
    if (op === 'contains') { return Array.isArray(input) ? input.indexOf(conditionValue) !== -1 : text(input).indexOf(String(conditionValue)) !== -1; }
    if (op === 'notContains') { return Array.isArray(input) ? input.indexOf(conditionValue) === -1 : text(input).indexOf(String(conditionValue)) === -1; }
    if (op === 'ne') { return input !== conditionValue && text(input) !== String(conditionValue); }
    if (op === 'gt') { return Number(input) > Number(conditionValue); }
    if (op === 'gte') { return Number(input) >= Number(conditionValue); }
    if (op === 'lt') { return Number(input) < Number(conditionValue); }
    if (op === 'lte') { return Number(input) <= Number(conditionValue); }
    return input === conditionValue || text(input) === String(conditionValue);
  }

  function luhn(input) {
    var digits = text(input).replace(/\\s+/g, '');
    if (!/^\\d{12,19}$/.test(digits)) { return false; }
    var sum = 0;
    var shouldDouble = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var digit = Number(digits.charAt(i));
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) { digit -= 9; }
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function idCard(input) {
    var valueText = text(input).toUpperCase();
    if (!/^\\d{17}[\\dX]$/.test(valueText)) { return false; }
    var year = Number(valueText.slice(6, 10));
    var month = Number(valueText.slice(10, 12));
    var day = Number(valueText.slice(12, 14));
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) { return false; }
    var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    var checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    var sum = 0;
    for (var index = 0; index < 17; index++) {
      sum += Number(valueText.charAt(index)) * weights[index];
    }
    return checks[sum % 11] === valueText.charAt(17);
  }

  function uscc(input) {
    var valueText = text(input).toUpperCase();
    var chars = '0123456789ABCDEFGHJKLMNPQRTUWXY';
    if (!/^[0-9ABCDEFGHJKLMNPQRTUWXY]{18}$/.test(valueText)) { return false; }
    var weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
    var sum = 0;
    for (var index = 0; index < 17; index++) {
      var charIndex = chars.indexOf(valueText.charAt(index));
      if (charIndex === -1) { return false; }
      sum += charIndex * weights[index];
    }
    return chars.charAt((31 - (sum % 31)) % 31) === valueText.charAt(17);
  }

  if (CONDITION) {
    var conditionValue = getFieldValue(CONDITION.fieldId);
    if (!match(conditionValue, CONDITION)) { return true; }
  }
  if (${jsString(rule.type)} !== 'required' && ${jsString(rule.type)} !== 'conditionalRequired' && isEmpty(value)) {
    return true;
  }
  if (${jsString(rule.type)} === 'regex') { return new RegExp(PATTERN).test(text(value)); }
  if (${jsString(rule.type)} === 'idCard' || ${jsString(rule.type)} === 'chineseID') { return idCard(value); }
  if (${jsString(rule.type)} === 'bankCard') { return luhn(value); }
  if (${jsString(rule.type)} === 'unifiedSocialCreditCode') { return uscc(value); }
  if (${jsString(rule.type)} === 'email') {
    var email = text(value);
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { return false; }
    if (DOMAIN_WHITELIST.length) {
      return DOMAIN_WHITELIST.indexOf(email.split('@').pop()) !== -1;
    }
    return true;
  }
  if (${jsString(rule.type)} === 'compare') {
    var targetValue = getFieldValue(TARGET_FIELD_ID);
    if (isEmpty(value) || isEmpty(targetValue)) { return true; }
    var left = comparable(value);
    var right = comparable(targetValue);
    if (OPERATOR === '<' || OPERATOR === 'lt') { return left < right; }
    if (OPERATOR === '<=' || OPERATOR === 'lte') { return left <= right; }
    if (OPERATOR === '>' || OPERATOR === 'gt') { return left > right; }
    if (OPERATOR === '>=' || OPERATOR === 'gte') { return left >= right; }
    if (OPERATOR === '!=' || OPERATOR === '!==' || OPERATOR === 'ne') { return left !== right; }
    return left === right;
  }
  if (${jsString(rule.type)} === 'conditionalRequired') { return !isEmpty(value); }
  if (${jsString(rule.type)} === 'custom') {
    var fields = {};
    if (FIELD_ID) { fields[FIELD_ID] = value; }
    try {
      var result = (new Function('value', 'fields', 'state', 'ctx', 'getFieldValue', 'return (' + EXPRESSION + ');'))(value, fields, state || {}, ctx || {}, getFieldValue);
      return result === true || (result && result.valid === true);
    } catch (err) {
      return false;
    }
  }
  if (${jsString(rule.type)} === 'async') {
    if (!API) { return true; }
    var payload = BODY || { fieldId: FIELD_ID, value: value };
    return fetch(API, {
      method: METHOD || 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, HEADERS || {}),
      body: String(METHOD || 'POST').toUpperCase() === 'GET' ? undefined : JSON.stringify(payload)
    }).then(function(response) {
      return response.json();
    }).then(function(data) {
      if (VALID_PATH) {
        var current = data;
        String(VALID_PATH).split('.').forEach(function(part) {
          current = current && current[part];
        });
        return current !== false;
      }
      return data.valid !== false && data.success !== false && !data.error;
    }).catch(function() {
      return false;
    });
  }
  return true;
}`;
}

function smartValidationSignature(rule) {
  return [
    rule && rule.type,
    rule && rule.fieldId,
    rule && rule.targetFieldId,
    rule && rule.operator,
    rule && rule.pattern,
    rule && rule.api,
    rule && rule.expression,
    rule && rule.condition ? JSON.stringify(rule.condition) : '',
  ].map(function (value) {
    return value === undefined ? '' : String(value);
  }).join('|');
}

function dedupeSmartValidationRules(rules) {
  const seen = new Set();
  return (rules || []).filter(function (rule) {
    const signature = smartValidationSignature(rule);
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

function actionListHasName(actions, name) {
  return !!(actions && Array.isArray(actions.list) && actions.list.some(function (item) {
    return item && (item.name === name || item.id === name);
  }));
}

function removeGeneratedActionListEntries(actions, names) {
  if (!actions || !Array.isArray(actions.list)) {
    return 0;
  }
  const nameSet = new Set(names);
  const beforeCount = actions.list.length;
  actions.list = actions.list.filter(function (item) {
    return !item || (!nameSet.has(item.id) && !nameSet.has(item.name));
  });
  return beforeCount - actions.list.length;
}

function cleanupLegacySmartValidationArtifacts(schema, root, formContainer) {
  const cleanup = {
    removedMetadata: false,
    removedBeforeSubmit: false,
    restoredDidMount: false,
    removedActions: 0,
    removedActionSource: false,
  };

  if (formContainer && formContainer.props && formContainer.props.openyidaSmartValidations !== undefined) {
    delete formContainer.props.openyidaSmartValidations;
    cleanup.removedMetadata = true;
  }

  if (
    formContainer &&
    formContainer.props &&
    formContainer.props.beforeSubmit &&
    formContainer.props.beforeSubmit.type === 'actionRef' &&
    formContainer.props.beforeSubmit.name === 'openyidaSmartValidateBeforeSubmit'
  ) {
    delete formContainer.props.beforeSubmit;
    cleanup.removedBeforeSubmit = true;
  }

  const actions = schema.actions;
  if (
    root &&
    root.lifeCycles &&
    root.lifeCycles.componentDidMount &&
    root.lifeCycles.componentDidMount.type === 'actionRef' &&
    root.lifeCycles.componentDidMount.name === 'openyidaSmartValidationDidMount'
  ) {
    if (actionListHasName(actions, 'didMount')) {
      root.lifeCycles.componentDidMount = {
        name: 'didMount',
        id: 'didMount',
        params: {},
        type: 'actionRef',
      };
    } else {
      delete root.lifeCycles.componentDidMount;
    }
    cleanup.restoredDidMount = true;
  }

  cleanup.removedActions = removeGeneratedActionListEntries(actions, [
    'openyidaSmartValidationDidMount',
    'openyidaSmartValidateBeforeSubmit',
  ]);

  if (actions && actions.module && typeof actions.module.source === 'string') {
    const nextSource = removeGeneratedSourceBlockWithBounds(
      actions.module.source,
      SMART_VALIDATION_BLOCK_START,
      SMART_VALIDATION_BLOCK_END
    );
    if (nextSource !== actions.module.source) {
      actions.module.source = nextSource;
      actions.module.compiled = nextSource ? compileActionSource(nextSource) : '';
      cleanup.removedActionSource = true;
    }
  }

  return cleanup;
}

function applySmartValidations(schema, rawRules) {
  if (!schema.pages || !Array.isArray(schema.pages) || schema.pages.length === 0) {
    throw new Error('Schema 为空，无法配置智能校验');
  }
  const root = schema.pages[0].componentsTree && schema.pages[0].componentsTree[0];
  const formContainer = root ? findFormContainer(root) : null;
  const normalized = normalizeSmartValidationRules(formContainer, rawRules || [], schema.pages[0]);
  normalized.rules = dedupeSmartValidationRules(normalized.rules);
  const cleanup = cleanupLegacySmartValidationArtifacts(schema, root, formContainer);
  const appliedRules = [];
  const skippedRules = [];

  normalized.rules.forEach(function (rule) {
    const designerRule = toDesignerValidationRule(rule);
    if (!designerRule) {
      skippedRules.push(rule);
      return;
    }
    const found = findFieldByIdOrLabelDeep(formContainer.children, rule.fieldId);
    if (!found || !found.field) {
      skippedRules.push(rule);
      return;
    }
    found.field.props = found.field.props || {};
    resetGeneratedTextFieldValidationType(found.field);
    const existingValidation = cleanupLegacyGeneratedValidationRules(found.field.props.validation, designerRule);
    found.field.props.validation = dedupeValidationRules(existingValidation.concat([designerRule]));
    appliedRules.push(Object.assign({}, rule, {
      designerValidationType: designerRule.type,
      resolved: getFieldEvidenceFromLookup(normalized.fieldLookup, rule.fieldId),
      targetResolved: rule.targetFieldId ? getFieldEvidenceFromLookup(normalized.fieldLookup, rule.targetFieldId) : undefined,
    }));
  });

  return {
    rules: normalized.rules,
    appliedRules,
    skippedRules,
    cleanup,
    fieldLookup: normalized.fieldLookup,
  };
}

function collectSmartValidationRulesFromFields(fields, output) {
  const rules = output || [];
  (fields || []).forEach(function (field) {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      return;
    }
    if (!isFormPresentationDefinition(field)) {
      const fieldRules = collectInputValidationRules(field, { includeAdvanced: true });
      const fieldLabel = field.label;
      fieldRules.forEach(function (rule) {
        if (rule.type === 'required' && !field.required && !field.validation && !field.validations) {
          return;
        }
        rules.push(Object.assign({ field: fieldLabel }, rule));
      });
    }
    if (Array.isArray(field.children)) {
      field.children.forEach(function (child) {
        collectSmartValidationRulesFromFields(Array.isArray(child) ? child : [child], rules);
      });
    }
  });
  return rules;
}

function applyFieldChanges(component, changes) {
  const props = component.props || {};
  component.props = props;

  // 需要特殊处理的属性 key 集合（不走通用透传）
  const specialKeys = ['label', 'required', 'validation', 'validations', 'pattern', 'regex', 'placeholder', 'options', 'dataSource', 'associationForm',
    'linkageFields', 'mainFieldId', 'mainComponentName', 'mainFieldLabel',
    'subFieldId', 'subComponentName', 'dataFillingRules',
    'remoteDataSource', 'searchDataSource', 'dataSourceConfig', 'dataSourceUrl',
    'searchConfig', 'dataType', 'beforeFetch', 'afterFetch', 'queryParam',
    'listPath', 'labelField', 'valueField', 'filterLocal', 'showSearch',
    'dataSourceType', 'notFoundContent', 'title', 'description', 'tips', 'tooltip'];

  // ── 特殊处理：label（需要 i18n 包装）
  if (changes.label !== undefined) {
    if (isFormPresentationComponent(component.componentName)) {
      props.title = i18n(changes.label, component.componentName);
    } else {
      props.label = i18n(changes.label, component.componentName);
    }
  }

  if (changes.title !== undefined && isFormPresentationComponent(component.componentName)) {
    props.title = i18n(changes.title, component.componentName);
  }

  if (changes.description !== undefined && component.componentName === 'Divider') {
    props.description = i18n(changes.description);
  }

  if (changes.tips !== undefined && component.componentName === 'Divider') {
    props.tips = i18n(changes.tips);
  }

  if (changes.tooltip !== undefined && component.componentName === 'PageSection') {
    props.tooltip = i18n(changes.tooltip);
  }

  // ── 特殊处理：required（操作 validation 数组）
  if (changes.required !== undefined && !isFormPresentationComponent(component.componentName)) {
    if (changes.required) {
      const hasRequired = (props.validation || []).some(function (rule) {
        return rule.type === 'required';
      });
      if (!hasRequired) {
        props.validation = props.validation || [];
        props.validation.push({ type: 'required' });
      }
    } else {
      props.validation = (props.validation || []).filter(function (rule) {
        return rule.type !== 'required';
      });
    }
  }

  // ── 特殊处理：validation / pattern（规范化后写入字段校验配置）
  if ((changes.validation !== undefined || changes.validations !== undefined) && !isFormPresentationComponent(component.componentName)) {
    props.validation = normalizeFieldValidationRules({
      required: changes.required,
      validation: changes.validation !== undefined ? changes.validation : changes.validations,
    });
  }

  if ((changes.pattern !== undefined || changes.regex !== undefined) && !isFormPresentationComponent(component.componentName)) {
    props.validation = dedupeValidationRules((props.validation || []).concat(normalizeFieldValidationRules({
      pattern: changes.pattern !== undefined ? changes.pattern : changes.regex,
      message: changes.message,
    })));
  }

  // ── 特殊处理：placeholder（需要 i18n 包装）
  if (changes.placeholder !== undefined && !isFormPresentationComponent(component.componentName)) {
    props.placeholder = i18n(changes.placeholder);
  }

  // ── 特殊处理：dataSource（选项类字段直接更新 dataSource）
  if (changes.dataSource !== undefined && OPTION_FIELD_TYPES.indexOf(component.componentName) !== -1) {
    const newDataSource = changes.dataSource;
    props.dataSource = newDataSource;
    if (props.defaultDataSource) {
      props.defaultDataSource.options = newDataSource;
    }
  }

  // ── 特殊处理：选项类字段绑定远程搜索数据源
  if (
    OPTION_FIELD_TYPES.indexOf(component.componentName) !== -1 &&
    (changes.remoteDataSource || changes.searchDataSource || changes.dataSourceConfig || changes.dataSourceUrl || changes.searchConfig)
  ) {
    applySelectDataSourceConfig(props, changes.remoteDataSource || changes.searchDataSource || changes.dataSourceConfig || {
      url: changes.dataSourceUrl,
      searchConfig: changes.searchConfig,
      dataType: changes.dataType,
      beforeFetch: changes.beforeFetch,
      afterFetch: changes.afterFetch,
      queryParam: changes.queryParam,
      listPath: changes.listPath,
      labelField: changes.labelField,
      valueField: changes.valueField,
      options: changes.options || changes.dataSource,
      dataSourceType: changes.dataSourceType,
      filterLocal: changes.filterLocal,
      showSearch: changes.showSearch,
      notFoundContent: changes.notFoundContent,
    });
  }

  // ── 特殊处理：AssociationFormField 的 associationForm 内部属性
  if (component.componentName === 'AssociationFormField') {
    if (!props.associationForm) {
      props.associationForm = {};
    }
    if (changes.linkageFields !== undefined) {
      props.associationForm.linkageFields = changes.linkageFields;
    }
    if (changes.mainFieldId !== undefined) {
      props.associationForm.mainFieldId = changes.mainFieldId;
    }
    if (changes.mainComponentName !== undefined) {
      props.associationForm.mainComponentName = changes.mainComponentName;
    }
    if (changes.mainFieldLabel !== undefined) {
      props.associationForm.mainFieldLabel = i18n(changes.mainFieldLabel);
    }
    if (changes.subFieldId !== undefined) {
      props.associationForm.subFieldId = changes.subFieldId;
    }
    if (changes.subComponentName !== undefined) {
      props.associationForm.subComponentName = changes.subComponentName;
    }
    // dataFillingRules：直接替换整个回填规则对象，并同步更新 supportDataFilling
    // 同时规范化每条规则，补充 source/target/sourceType/targetType 字段
    if (changes.dataFillingRules !== undefined) {
      props.dataFillingRules = normalizeFillingRules(changes.dataFillingRules);
      const hasMainRules = changes.dataFillingRules.mainRules && changes.dataFillingRules.mainRules.length > 0;
      const hasTableRules = changes.dataFillingRules.tableRules && changes.dataFillingRules.tableRules.some(function (tr) {
        return tr.rules && tr.rules.length > 0;
      });
      props.supportDataFilling = hasMainRules || hasTableRules;
    }
  }

  // ── 通用透传：将 changes 中所有未被特殊处理的属性直接写入 props
  // 新增属性支持时无需修改此函数，直接在 changes 中传入对应 key 即可
  Object.keys(changes).forEach(function (key) {
    if (specialKeys.indexOf(key) === -1 && changes[key] !== undefined) {
      props[key] = changes[key];
    }
  });
}

function ensureComponentsMap(schema, componentName) {
  if (!schema.pages || schema.pages.length === 0) { return; }
  const pageSchema = schema.pages[0];
  const existingNames = pageSchema.componentsMap.map(function (entry) {
    return entry.componentName;
  });
  if (existingNames.indexOf(componentName) === -1) {
    pageSchema.componentsMap.push({
      package: '@ali/vc-deep-yida',
      version: '1.5.169',
      componentName: componentName,
    });
  }
}

function ensureComponentsMapForComponent(schema, component) {
  if (!component || typeof component !== 'object') { return; }
  ensureComponentsMap(schema, component.componentName);
  if (Array.isArray(component.children)) {
    component.children.forEach(function (child) {
      ensureComponentsMapForComponent(schema, child);
    });
  }
}

function countDataFieldDefinitions(fields) {
  let count = 0;
  (fields || []).forEach(function (field) {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      return;
    }
    const componentName = normalizeFormDefinitionType(field);
    if (isSupportedBusinessFieldType(componentName)) {
      count++;
    }
    if (Array.isArray(field.children)) {
      field.children.forEach(function (child) {
        count += countDataFieldDefinitions(Array.isArray(child) ? child : [child]);
      });
    }
  });
  return count;
}

// ── 应用修改操作（update 模式） ─────────────────────

function applyChangesToSchema(schema, changes, options) {
  const verbose = Boolean(options && options.verbose);
  const componentsTree = schema.pages[0].componentsTree;
  if (!componentsTree || componentsTree.length === 0) {
    error(t('create_form.no_components_tree'));
  }

  const formContainer = findFormContainer(componentsTree[0]);
  if (!formContainer) {
    error(t('create_form.no_form_container'));
  }

  const formFields = formContainer.children || [];
  const appliedChanges = [];
  const diagnostics = [];

  changes.forEach(function (change, changeIndex) {
    const actionDesc = t('create_form.action_label', changeIndex + 1, change.action);

    if (change.action === 'add') {
      if (!change.field || !normalizeFormDefinitionType(change.field) || (!change.field.label && !change.field.title && !isFormPresentationDefinition(change.field))) {
        if (verbose) { warn(actionDesc + t('create_form.add_missing_field')); }
        return;
      }

      validateFormFieldDefinitions([change.field], 'changes[' + changeIndex + '].field');
      const newComponent = buildFormNodeComponent(change.field);
      ensureComponentsMapForComponent(schema, newComponent);
      const displayName = getDefinitionDisplayName(change.field);
      const componentName = normalizeFormDefinitionType(change.field);

      if (change.after) {
        const afterResult = findFieldByLabelDeep(formFields, change.after);
        if (afterResult) {
          afterResult.fields.splice(afterResult.index + 1, 0, newComponent);
          if (verbose) { success(actionDesc + t('create_form.add_after_ok', change.after, displayName, componentName)); }
        } else {
          formFields.push(newComponent);
          if (verbose) { warn(actionDesc + t('create_form.add_after_not_found', change.after, displayName)); }
        }
      } else if (change.before) {
        const beforeResult = findFieldByLabelDeep(formFields, change.before);
        if (beforeResult) {
          beforeResult.fields.splice(beforeResult.index, 0, newComponent);
          if (verbose) { success(actionDesc + t('create_form.add_before_ok', change.before, displayName, componentName)); }
        } else {
          formFields.push(newComponent);
          if (verbose) { warn(actionDesc + t('create_form.add_before_not_found', change.before, displayName)); }
        }
      } else {
        formFields.push(newComponent);
        if (verbose) { success(actionDesc + t('create_form.add_ok', displayName, componentName)); }
      }

      appliedChanges.push({ action: 'add', label: displayName, type: componentName, resolved: buildFieldEvidence(newComponent, []) });

    } else if (change.action === 'delete') {
      const deleteTarget = {
        ref: change.field,
        label: change.label,
        fieldId: change.fieldId,
        tableLabel: change.tableLabel,
      };
      if (!deleteTarget.label && !deleteTarget.fieldId && !deleteTarget.ref) {
        if (verbose) { warn(actionDesc + t('create_form.delete_missing_label')); }
        return;
      }

      const deleteResolution = resolveFieldReference(formFields, deleteTarget, { includePresentation: true });
      if (deleteResolution.ok) {
        const deleteResult = deleteResolution.match;
        deleteResult.fields.splice(deleteResult.index, 1);
        if (verbose) { success(actionDesc + t('create_form.delete_ok', change.label || deleteResolution.resolved.label || change.fieldId)); }
        appliedChanges.push({
          action: 'delete',
          label: change.label || deleteResolution.resolved.label,
          fieldId: change.fieldId || deleteResolution.resolved.fieldId,
          tableLabel: change.tableLabel || null,
          resolved: deleteResolution.resolved,
        });
      } else {
        if (verbose) { warn(actionDesc + t('create_form.delete_not_found', change.label || change.fieldId || change.field)); }
        pushResolutionDiagnostic(diagnostics, Object.assign({ action: 'delete' }, deleteResolution.diagnostic));
      }

    } else if (change.action === 'update') {
      const updateTarget = {
        ref: change.field,
        label: change.label,
        fieldId: change.fieldId,
        tableLabel: change.tableLabel,
      };
      if (!updateTarget.label && !updateTarget.fieldId && !updateTarget.ref) {
        if (verbose) { warn(actionDesc + t('create_form.update_missing_label')); }
        return;
      }
      if (!change.changes || Object.keys(change.changes).length === 0) {
        if (verbose) { warn(actionDesc + t('create_form.update_missing_changes')); }
        return;
      }

      const locationDesc = change.tableLabel ? t('create_form.in_table', change.tableLabel) : '';
      const updateResolution = resolveFieldReference(formFields, updateTarget, { includePresentation: true });
      if (updateResolution.ok) {
        const updateResult = updateResolution.match;
        applyFieldChanges(updateResult.field, change.changes);
        const changedProps = Object.keys(change.changes).join(', ');
        const targetLabel = change.label || updateResolution.resolved.label || change.fieldId || change.field;
        if (verbose) { success(actionDesc + t('create_form.update_ok', locationDesc, targetLabel, changedProps)); }
        appliedChanges.push({
          action: 'update',
          label: change.label || updateResolution.resolved.label,
          fieldId: change.fieldId || updateResolution.resolved.fieldId,
          tableLabel: change.tableLabel || null,
          changedProps: changedProps,
          resolved: updateResolution.resolved,
          updatedProps: summarizeUpdatedProps(updateResult.field, change.changes),
        });
      } else {
        if (verbose) { warn(actionDesc + t('create_form.update_not_found', locationDesc, change.label || change.fieldId || change.field)); }
        pushResolutionDiagnostic(diagnostics, Object.assign({ action: 'update' }, updateResolution.diagnostic));
      }

    } else {
      if (verbose) { warn(actionDesc + t('create_form.unknown_action', change.action)); }
      pushResolutionDiagnostic(diagnostics, {
        action: change.action,
        code: 'CREATE_FORM_UNKNOWN_ACTION',
      });
    }
  });

  // 遍历所有字段，确保顶层 fieldId 存在（宜搭回填引擎依赖顶层 fieldId）
  function ensureTopLevelFieldId(comps) {
    comps.forEach(function (comp) {
      if (!comp.fieldId && comp.props && comp.props.fieldId) {
        comp.fieldId = comp.props.fieldId;
      }
      if (comp.children && Array.isArray(comp.children)) {
        ensureTopLevelFieldId(comp.children);
      }
    });
  }
  ensureTopLevelFieldId(formFields);

  // 解析 @label:xxx 引用并规范化回填规则
  resolveFieldIdReferences(formFields);

  formContainer.children = formFields;
  appliedChanges.diagnostics = diagnostics;
  return appliedChanges;
}

// ── 发送 POST 请求（支持 302 自动重登录） ────────────

function sendPostRequest(baseUrl, requestPath, extraParams, formUuid, authRef) {
  const authParams = authRef && authRef.csrfToken ? { _csrf_token: authRef.csrfToken } : {};
  const postData = querystring.stringify(Object.assign(authParams, extraParams));
  const referer = formUuid
    ? `${baseUrl}/alibaba/web/${extraParams.appType || ''}/design/pageDesigner?formUuid=${formUuid}`
    : baseUrl + '/';
  return httpPost(baseUrl, requestPath, postData, { referer });
}

function sendCreateFormRequest(authRef, appType, formTitle) {
  return requestNonIdempotentWithAuthPreflight(
    function (auth) {
      return sendPostRequest(
        auth.baseUrl,
        buildApiPath(appType, 'saveFormSchemaInfo'),
        { formType: 'receipt', title: JSON.stringify(i18n(formTitle)) },
        undefined,
        auth
      );
    },
    function (auth) {
      return sendGetRequest(
        auth.baseUrl,
        buildApiPath(appType, 'getFormNavigationListByOrder', { queryModule: 'formnav' }),
        { _api: 'Nav.queryList', _mock: false }
      );
    },
    authRef
  );
}

// ── 发送 updateFormConfig 请求 ───────────────────────

function sendUpdateConfigRequest(baseUrl, appType, formUuid, version, value, authRef) {
  const authParams = authRef && authRef.csrfToken ? { _csrf_token: authRef.csrfToken } : {};
  const postData = querystring.stringify(Object.assign(authParams, {
    formUuid: formUuid,
    version: version,
    configType: 'MINI_RESOURCE',
    value: value,
  }));
  return httpPost(
    baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/updateFormConfig.json`,
    postData
  );
}

// ── 登录态辅助：从 authData 中提取 corpId ──────────

function resolveCorpId(authData) {
  if (authData && authData.corp_id) {return authData.corp_id;}
  return '';
}

function extractSchemaServerRevision(schemaResult) {
  const content = schemaResult && schemaResult.content && typeof schemaResult.content === 'object'
    ? schemaResult.content
    : null;
  const candidates = [
    schemaResult && schemaResult.gmtModified,
    schemaResult && schemaResult.serverRevision,
    content && content.gmtModified,
    content && content.serverRevision,
    content && content.version,
    schemaResult && schemaResult.version,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
      return candidate;
    }
  }
  return undefined;
}

function requireSchemaServerRevision(serverRevision, details) {
  if (serverRevision === undefined || serverRevision === null || String(serverRevision).trim() === '') {
    throwCreateFormError('Missing form schema server revision from exact readback.', 'CREATE_FORM_SCHEMA_REVISION_INVALID', details);
  }
  return serverRevision;
}

function sanitizeFailureResult(result) {
  if (!result || typeof result !== 'object') {
    return result || null;
  }
  const sanitized = {};
  ['success', 'errorMsg', 'errorCode', 'code', 'message', '__httpStatus', '__needLogin', '__csrfExpired'].forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      sanitized[key] = result[key];
    }
  });
  return sanitized;
}

function getUpdateFormConfigRetryDelays() {
  const rawDelays = process.env.OPENYIDA_UPDATE_FORM_CONFIG_RETRY_DELAYS_MS;
  if (rawDelays === undefined) {
    return [500, 1000];
  }
  return String(rawDelays)
    .split(',')
    .map(function (part) { return Number(part.trim()); })
    .filter(function (delay) { return Number.isFinite(delay) && delay >= 0; });
}

function waitForUpdateFormConfigRetry(delayMs) {
  if (!delayMs) {
    return Promise.resolve();
  }
  return new Promise(function (resolve) {
    setTimeout(resolve, delayMs);
  });
}

function getUpdateFormConfigErrorText(result) {
  if (!result || typeof result !== 'object') {
    return '';
  }
  return [
    result.errorMsg,
    result.message,
    result.error,
    result.errorCode,
    result.code,
  ]
    .filter(function (part) { return part !== undefined && part !== null; })
    .map(function (part) { return String(part); })
    .join(' ');
}

function getUpdateFormConfigWarningMessage(result) {
  if (!result || typeof result !== 'object') {
    return t('common.request_failed');
  }
  return result.errorMsg || result.message || result.error || result.errorCode || result.code || t('common.unknown_error');
}

function buildPostSaveConfigWarningPayload(configResult) {
  return {
    stage: 'updateFormConfig',
    schemaSaved: true,
    configWarning: getUpdateFormConfigWarningMessage(configResult),
    configResult: sanitizeFailureResult(configResult),
  };
}

function warnPostSaveUpdateConfigFailure(configResult) {
  const warningPayload = buildPostSaveConfigWarningPayload(configResult);
  warn(t('create_form.config_failed', warningPayload.configWarning));
  hint(t('create_form.schema_ok_config_failed'));
  return warningPayload;
}

function isRetryablePostSaveUpdateConfigResult(result) {
  if (!result || result.success || result.__needLogin || result.__csrfExpired) {
    return false;
  }
  const status = Number(result.__httpStatus || result.status || result.statusCode);
  if (status === 400 || status === 401 || status === 403 || status >= 500) {
    return false;
  }
  const text = getUpdateFormConfigErrorText(result);
  const lowerText = text.toLowerCase();
  const normalizedText = lowerText.replace(/[\s_-]/g, '');
  if (/csrf|auth|login|permission|forbidden|unauthori[sz]ed|invalid|param|权限|登录|认证|授权|参数/.test(lowerText)) {
    return false;
  }
  if (text.indexOf('表单') !== -1 && text.indexOf('不存在') !== -1) {
    return true;
  }
  if (text.indexOf('表单') !== -1 && text.indexOf('未找到') !== -1) {
    return true;
  }
  if (
    normalizedText.indexOf('formnotfound') !== -1 ||
    normalizedText.indexOf('formnotexist') !== -1 ||
    normalizedText.indexOf('formdoesnotexist') !== -1
  ) {
    return true;
  }
  return lowerText.indexOf('not found') !== -1 && /form|formuuid|form uuid/.test(lowerText);
}

async function sendPostSaveUpdateConfigRequest(authRef, appType, formUuid, version) {
  const retryDelays = getUpdateFormConfigRetryDelays();
  for (let attemptIndex = 0; attemptIndex <= retryDelays.length; attemptIndex += 1) {
    let configResult;
    try {
      configResult = await requestWithAutoLogin(function (auth) {
        return sendUpdateConfigRequest(auth.baseUrl, appType, formUuid, version || 1, 0, auth);
      }, authRef);
    } catch (err) {
      return {
        success: false,
        errorMsg: err && err.message ? err.message : String(err || 'request failed'),
        errorCode: err && err.code ? err.code : 'CREATE_FORM_UPDATE_CONFIG_FAILED',
      };
    }
    if (configResult && configResult.success) {
      return configResult;
    }
    if (attemptIndex >= retryDelays.length || !isRetryablePostSaveUpdateConfigResult(configResult)) {
      return configResult;
    }
    await waitForUpdateFormConfigRetry(retryDelays[attemptIndex]);
  }
  return {
    success: false,
    errorMsg: t('common.request_failed'),
    errorCode: 'CREATE_FORM_UPDATE_CONFIG_FAILED',
  };
}

function buildCreateFormPostCreateFailurePayload(context) {
  const errorObject = context && context.error;
  const payload = {
    success: false,
    appType: context.appType,
    formTitle: context.formTitle,
    formUuid: context.formUuid,
    stage: context.stage || 'postCreate',
    error: errorObject && errorObject.message ? errorObject.message : String(errorObject || 'request failed'),
    errorCode: errorObject && errorObject.code ? errorObject.code : (context.errorCode || 'CREATE_FORM_POST_CREATE_FAILED'),
    retryAdvice: t('create_form.create_post_failure_retry_advice', context.appType, context.formTitle),
  };
  if (context.fieldCount !== undefined) {
    payload.fieldCount = context.fieldCount;
  }
  return payload;
}

function emitCreateFormPostCreateFailure(context) {
  const errorObject = context && context.error;
  if (errorObject && errorObject.__openyidaPostCreateFailureEmitted) {
    return;
  }
  console.log(JSON.stringify(buildCreateFormPostCreateFailurePayload(context)));
  if (errorObject && typeof errorObject === 'object') {
    errorObject.__openyidaPostCreateFailureEmitted = true;
  }
}

function assertNoEmojiInFormDefinition(formTitle, fields, validations, artifact) {
  assertNoEmojiInValue({
    formTitle,
    fields,
    validations,
  }, {
    artifact: artifact || 'create-form input',
    code: 'OPENYIDA_FORM_DEFINITION_EMOJI_FORBIDDEN',
  });
}

function assertNoEmojiInDefinitionFileName(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('{') || raw.startsWith('[')) {
    return;
  }
  assertNoEmojiInArtifactName(raw, {
    code: 'OPENYIDA_FORM_DEFINITION_FILENAME_EMOJI_FORBIDDEN',
  });
}

// ── 保存 Schema 并更新表单配置（create/update 共用）──
//
// 封装了 saveFormSchema + updateFormConfig 两步，以及各自的 302 自动重登录重试。
// create-form 语义：saveFormSchema 成功后，updateFormConfig 只是后置配置通知。
// 返回 { saveResult, configResult }。

async function saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, stepOffset, failureContext) {
  const saveStep = stepOffset || 4;
  const configStep = saveStep + 1;

  const fixedRefs = normalizeFormulaFieldRefs(schema);
  if (fixedRefs > 0) {
    info(t('create_form.formula_prefix_fixed', fixedRefs));
  }
  applyDefaultFormDetailStyle(schema);
  assertNoEmojiInValue(schema, {
    artifact: 'Yida form schema ' + formUuid,
    code: 'OPENYIDA_FORM_SCHEMA_EMOJI_FORBIDDEN',
  });
  const serverRevision = requireSchemaServerRevision(version, { appType, formUuid });

  step(saveStep, t('create_form.step_save_schema', saveStep));
  info(t('create_form.sending_save'));

  const saveResult = await requestWithAutoLogin(function (auth) {
    return sendPostRequest(
      auth.baseUrl,
      buildApiPath(appType, 'saveFormSchema', { prefix: '_view' }),
      { appType: appType, formUuid: formUuid, content: JSON.stringify(schema), schemaVersion: 'V5', prefix: '_view', gmtModified: serverRevision },
      formUuid,
      auth
    );
  }, authRef);

  if (!saveResult || !saveResult.success) {
    const saveErrorMsg = saveResult ? saveResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.save_schema_failed', saveErrorMsg));
    if (saveResult && !saveResult.__needLogin) {
      hint(t('common.response_detail', JSON.stringify(saveResult, null, 2)));
    }
    const saveError = createCreateFormError(saveErrorMsg, 'CREATE_FORM_SAVE_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: sanitizeFailureResult(saveResult),
    });
    if (failureContext) {
      emitCreateFormPostCreateFailure(Object.assign({}, failureContext, {
        stage: 'saveFormSchema',
        error: saveError,
      }));
    } else {
      console.log(JSON.stringify({ success: false, formUuid: formUuid, error: saveErrorMsg }));
    }
    throw saveError;
  }

  success(t('create_form.schema_saved'));
  if (version !== undefined) {
    label('Version:', String(version));
  }

  step(configStep, t('create_form.step_update_config', configStep));
  info(t('create_form.sending_config'));

  const configResult = await sendPostSaveUpdateConfigRequest(authRef, appType, formUuid, version);

  return { saveResult: saveResult, configResult: configResult };
}

// ── create 模式主流程 ─────────────────────────────────

async function mainValidateFields(parsedArgs) {
  const { fieldsJsonOrFile } = parsedArgs;
  assertNoEmojiInDefinitionFileName(fieldsJsonOrFile);
  const { fields } = readFieldsDefinition(fieldsJsonOrFile);
  const diagnostics = collectFormFieldValidationDiagnostics(fields, { rootPath: 'fields' });
  const output = {
    success: diagnostics.length === 0,
    valid: diagnostics.length === 0,
    fieldCount: Array.isArray(fields) ? fields.length : 0,
    diagnostics,
  };
  console.log(JSON.stringify(output, null, parsedArgs.json ? 2 : 0));
  if (diagnostics.length > 0) {
    process.exitCode = 1;
  }
  return output;
}

async function mainCreate(parsedArgs, authRef) {
  const { appType, formTitle, fieldsJsonOrFile, layout, theme, labelAlign } = parsedArgs;

  banner(t('create_form.create_title'));
  label('App ID:', appType);
  label('Title:', formTitle);
  label('Fields:', fieldsJsonOrFile);

  step(2, t('create_form.step_read_fields', 2));
  assertNoEmojiInDefinitionFileName(fieldsJsonOrFile);
  const { fields, columns, validations } = readFieldsDefinition(fieldsJsonOrFile);
  assertNoEmojiInFormDefinition(formTitle, fields, validations);
  validateFormFieldDefinitions(fields);
  const fieldCount = countDataFieldDefinitions(fields);
  success(t('create_form.fields_loaded', fieldCount));
  label('Columns:', String(columns));
  fields.forEach(function (field, index) {
    listItem((index + 1) + '. ' + normalizeFormDefinitionType(field) + ': ' + getDefinitionDisplayName(field));
  });

  step(3, t('create_form.step_create_blank', 3));
  info(t('create_form.sending_create'));
  const createResult = await sendCreateFormRequest(authRef, appType, formTitle);

  if (!createResult || !createResult.success || !createResult.content) {
    const errorMsg = createResult ? createResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    const errorCode = createResult && createResult.errorCode
      ? createResult.errorCode
      : 'CREATE_FORM_CREATE_BLANK_FAILED';
    fail(t('create_form.create_blank_failed', errorMsg));
    console.log(JSON.stringify({ success: false, errorCode, error: errorMsg }));
    throwCreateFormError(errorMsg, errorCode, {
      appType,
      result: createResult,
    });
  }

  const formUuid = createResult.content.formUuid || createResult.content;
  success(t('create_form.blank_created', formUuid));
  let configResult;
  let postCreateStage = 'getFormSchema';
  try {
    const shellSchemaResult = await requestWithAutoLogin(function (auth) {
      return sendGetRequest(
        auth.baseUrl,
        buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
        { formUuid: formUuid, schemaVersion: 'V5' }
      );
    }, authRef);
    if (!shellSchemaResult || shellSchemaResult.success === false || shellSchemaResult.__needLogin || shellSchemaResult.__csrfExpired) {
      const schemaErrorMsg = shellSchemaResult
        ? shellSchemaResult.errorMsg || shellSchemaResult.message || t('common.unknown_error')
        : t('common.request_failed');
      throwCreateFormError(schemaErrorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
        appType,
        formUuid,
        result: sanitizeFailureResult(shellSchemaResult),
      });
    }
    const serverRevision = extractSchemaServerRevision(shellSchemaResult);

    // Step 4 & 5: 生成 Schema 并保存，然后更新表单配置
    const corpId = resolveCorpId(authRef.authData);
    if (!corpId) {
      warn(t('create_form.no_corp_id_warning'));
    } else {
      info(t('create_form.corp_id_ok', corpId));
    }

    postCreateStage = 'buildFormSchema';
    const schema = buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign);
    const createValidationRules = collectSmartValidationRulesFromFields(fields).concat(validations || []);
    if (createValidationRules.length > 0) {
      const appliedValidations = applySmartValidations(schema, createValidationRules);
      info('已为创建表单写入 ' + appliedValidations.appliedRules.length + ' 条字段校验');
    }
    postCreateStage = 'saveSchemaAndUpdateConfig';
    const saveAndConfigResult = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, serverRevision, 4, {
      appType,
      formTitle,
      formUuid,
      fieldCount,
    });
    configResult = saveAndConfigResult.configResult;
  } catch (err) {
    emitCreateFormPostCreateFailure({
      appType,
      formTitle,
      formUuid,
      fieldCount,
      stage: postCreateStage,
      error: err,
    });
    throw err;
  }

  // 输出结果
  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, t('create_form.create_success'), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
    ]);
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, formUuid, formTitle, appType, fieldCount, url: formUrl },
      formUrl,
      { stage: 'create_form_success', title: formTitle },
      parsedArgs.browserOpenMode
    )));
  } else {
    result(true, t('create_form.create_success'), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
    ]);
    const warningPayload = warnPostSaveUpdateConfigFailure(configResult);
    console.log(JSON.stringify(withBrowserHandoff(
      Object.assign({
        success: true,
        appType,
        formTitle,
        formUuid,
        fieldCount,
        url: formUrl,
      }, warningPayload),
      formUrl,
      { stage: 'create_form_success', title: formTitle },
      parsedArgs.browserOpenMode
    )));
  }
}

async function runWithQuietOutput(fn) {
  const previousQuiet = process.env.YIDA_QUIET;
  process.env.YIDA_QUIET = '1';
  try {
    return await fn();
  } finally {
    if (previousQuiet === undefined) {
      delete process.env.YIDA_QUIET;
    } else {
      process.env.YIDA_QUIET = previousQuiet;
    }
  }
}

async function createFormForLegacyProcess(context, input) {
  return runWithQuietOutput(function () {
    return createFormForLegacyProcessQuiet(context, input);
  });
}

async function createFormForLegacyProcessQuiet(context, input) {
  const authRef = context && context.authRef ? context.authRef : context;
  const parsedArgs = {
    mode: 'create',
    appType: input.appType,
    formTitle: input.formTitle,
    fieldsJsonOrFile: input.fieldsJsonFile,
    layout: input.layout || 'single',
    theme: input.theme || 'default',
    labelAlign: input.labelAlign || 'top',
    contentLocale: input.contentLocale || null,
    browserOpenMode: 'off',
  };

  const { appType, formTitle, fieldsJsonOrFile, layout, theme, labelAlign } = parsedArgs;
  assertNoEmojiInDefinitionFileName(fieldsJsonOrFile);
  const { fields, validations } = readFieldsDefinition(fieldsJsonOrFile);
  assertNoEmojiInFormDefinition(formTitle, fields, validations, 'legacy create-form input');
  validateFormFieldDefinitions(fields);
  const fieldCount = countDataFieldDefinitions(fields);
  const createResult = await sendCreateFormRequest(authRef, appType, formTitle);

  if (!createResult || !createResult.success || !createResult.content) {
    const errorMsg = createResult ? createResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    const errorCode = createResult && createResult.errorCode
      ? createResult.errorCode
      : 'CREATE_FORM_CREATE_BLANK_FAILED';
    throwCreateFormError(errorMsg, errorCode, {
      appType,
      result: createResult,
    });
  }

  const formUuid = createResult.content.formUuid || createResult.content;
  const shellSchemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid: formUuid, schemaVersion: 'V5' }
    );
  }, authRef);
  const serverRevision = extractSchemaServerRevision(shellSchemaResult);
  const corpId = resolveCorpId(authRef.authData || authRef);
  const schema = buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign);
  const createValidationRules = collectSmartValidationRulesFromFields(fields).concat(validations || []);
  if (createValidationRules.length > 0) {
    applySmartValidations(schema, createValidationRules);
  }
  const { saveResult, configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, serverRevision, 4);
  return {
    success: true,
    appType,
    formUuid,
    formTitle,
    fieldCount,
    createResult,
    saveResult,
    configResult,
    url: authRef.baseUrl + '/' + appType + '/workbench/' + formUuid,
  };
}

// ── 为 SerialNumberField 补全 formula（递归处理子表）──
//
// 遍历字段列表，对每个 SerialNumberField：
//   - 若 formula 已有有效的 expression（从宜搭获取的已有字段），则跳过，不覆盖
//   - 若 formula 为空对象 {} 或 expression 为空（新增字段），则自动构建 expression
// 同时递归处理 TableField 的子字段（子表内也可能有流水号字段）

function fillSerialNumberFormulas(components, corpId, appType, formUuid) {
  if (!Array.isArray(components)) {return;}
  components.forEach(function (component) {
    if (component.componentName === 'SerialNumberField' && component.props) {
      const existingFormula = component.props.formula;
      const hasValidFormula = existingFormula &&
        typeof existingFormula === 'object' &&
        typeof existingFormula.expression === 'string' &&
        existingFormula.expression.length > 0;

      if (!hasValidFormula) {
        const fieldId = component.props.fieldId;
        const serialNumberRule = component.props.serialNumberRule;
        if (serialNumberRule) {
          const ruleJson = JSON.stringify({ type: 'custom', value: serialNumberRule });
          const escapedRuleJson = ruleJson.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          component.props.formula = {
            expression: 'SERIALNUMBER("' + corpId + '", "' + appType + '", "' + formUuid + '", "' + fieldId + '", "' + escapedRuleJson + '")'
          };
          info(t('create_form.serial_number_formula_set', component.props.label && component.props.label.zh_CN || fieldId));
        }
      }
    }
    // 递归处理子表、分组、卡片等容器内的字段
    if (Array.isArray(component.children)) {
      fillSerialNumberFormulas(component.children, corpId, appType, formUuid);
    }
  });
}

// ── add-option 模式主流程 ──────────────────────────────
//
// 语法糖：向选项类字段（SelectField/RadioField/CheckboxField/MultiSelectField）
// 追加一个或多个选项，无需手写完整的 update changes JSON。
//
// 流程：getSchema → 定位目标字段 → 在 dataSource 末尾追加新选项 → saveSchema

async function mainAddOption(parsedArgs, authRef) {
  const { appType, formUuid, fieldLabel, newOptions } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Field:', fieldLabel);
  label('New Options:', newOptions.join(', '));

  // Step 2: 获取 Schema
  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid, schemaVersion: 'V5' }
    );
  }, authRef);

  if (!schemaResult || schemaResult.success === false || schemaResult.__needLogin) {
    const errorMsg = schemaResult ? schemaResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.get_schema_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  let schema;
  const version = extractSchemaServerRevision(schemaResult);
  if (schemaResult.content) {
    schema = typeof schemaResult.content === 'string' ? JSON.parse(schemaResult.content) : schemaResult.content;
  } else if (schemaResult.pages) {
    schema = schemaResult;
  } else {
    fail(t('create_form.schema_extract_failed'));
    console.log(JSON.stringify({ success: false, error: t('create_form.schema_parse_failed') }));
    throwCreateFormError(t('create_form.schema_parse_failed'), 'CREATE_FORM_SCHEMA_PARSE_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  if (!schema.pages || !Array.isArray(schema.pages) || schema.pages.length === 0) {
    fail('Schema 为空，无法添加选项');
    console.log(JSON.stringify({ success: false, error: 'empty_schema' }));
    throwCreateFormError('empty_schema', 'CREATE_FORM_EMPTY_SCHEMA', { appType, formUuid });
  }

  // Step 3: 定位目标字段
  step(3, '定位字段: ' + fieldLabel);
  const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);
  if (!formContainer || !formContainer.children) {
    fail('未找到表单容器');
    console.log(JSON.stringify({ success: false, error: 'no_form_container' }));
    throwCreateFormError('no_form_container', 'CREATE_FORM_NO_FORM_CONTAINER', { appType, formUuid });
  }

  const fieldResolution = resolveFieldReference(formContainer.children, { ref: fieldLabel, label: fieldLabel });
  if (!fieldResolution.ok) {
    outputFieldResolutionFailure(appType, formUuid, [Object.assign({ action: 'add-option' }, fieldResolution.diagnostic)]);
  }

  const targetComponent = fieldResolution.match.field;
  const resolved = fieldResolution.resolved;
  if (OPTION_FIELD_TYPES.indexOf(targetComponent.componentName) === -1) {
    fail(fieldLabel + ' 不是选项类字段（当前类型: ' + targetComponent.componentName + '）');
    hint('add-option 仅支持: ' + OPTION_FIELD_TYPES.join(', '));
    console.log(JSON.stringify({ success: false, error: 'not_option_field', componentName: targetComponent.componentName, resolved }));
    throwCreateFormError('not_option_field', 'CREATE_FORM_NOT_OPTION_FIELD', {
      appType,
      formUuid,
      fieldLabel,
      componentName: targetComponent.componentName,
      resolved,
    });
  }

  // 读取现有 dataSource，追加新选项
  const props = targetComponent.props;
  const existingDataSource = Array.isArray(props.dataSource) ? props.dataSource : [];
  const existingValues = new Set(existingDataSource.map(function (item) { return item.value; }));

  const addedOptions = [];
  const skippedOptions = [];
  for (const optionText of newOptions) {
    if (existingValues.has(optionText)) {
      skippedOptions.push(optionText);
      warn('选项已存在，跳过: ' + optionText);
    } else {
      const newItem = {
        text: i18n(optionText, optionText, optionText),
        value: optionText,
        sid: 'serial_' + Date.now().toString(36) + existingDataSource.length + addedOptions.length,
        disable: false,
        defaultChecked: false,
      };
      existingDataSource.push(newItem);
      existingValues.add(optionText);
      addedOptions.push(optionText);
    }
  }

  if (addedOptions.length === 0) {
    info('没有新选项需要添加（全部已存在）');
    console.log(JSON.stringify({
      success: true,
      formUuid, appType, fieldLabel,
      resolved,
      added: [], skipped: skippedOptions,
      totalOptions: existingDataSource.length,
    }));
    return;
  }

  // 更新 dataSource
  props.dataSource = existingDataSource;
  if (props.defaultDataSource) {
    props.defaultDataSource.options = existingDataSource;
  }

  success('追加 ' + addedOptions.length + ' 个选项: ' + addedOptions.join(', '));
  if (skippedOptions.length > 0) {
    info('跳过已存在: ' + skippedOptions.join(', '));
  }

  // Step 4 & 5: 保存 Schema
  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  let configWarningPayload = null;
  if (configResult && configResult.success) {
    result(true, '选项追加成功', [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['Added', addedOptions.join(', ')],
      ['Total Options', String(existingDataSource.length)],
    ]);
  } else {
    result(true, '选项追加成功', [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['Added', addedOptions.join(', ')],
      ['Total Options', String(existingDataSource.length)],
    ]);
    configWarningPayload = warnPostSaveUpdateConfigFailure(configResult);
  }

  console.log(JSON.stringify(Object.assign({
    success: true,
    formUuid,
    appType,
    fieldLabel,
    fieldId: props.fieldId || '',
    componentName: targetComponent.componentName,
    resolved,
    added: addedOptions,
    skipped: skippedOptions,
    totalOptions: existingDataSource.length,
    url: formUrl,
  }, configWarningPayload || {})));
}

// ── bind-datasource 模式：给选项类字段绑定远程搜索数据源 ──

async function mainBindDataSource(parsedArgs, authRef) {
  const { appType, formUuid, fieldLabel, dataSourceJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Field:', fieldLabel);
  label('Data Source:', dataSourceJsonOrFile);

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid: formUuid, schemaVersion: 'V5' }
    );
  }, authRef);

  if (!schemaResult || schemaResult.success === false || schemaResult.__needLogin) {
    const errorMsg = schemaResult ? schemaResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.get_schema_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  let schema;
  const version = extractSchemaServerRevision(schemaResult);
  if (schemaResult.content) {
    schema = typeof schemaResult.content === 'string' ? JSON.parse(schemaResult.content) : schemaResult.content;
  } else if (schemaResult.pages) {
    schema = schemaResult;
  } else {
    fail(t('create_form.schema_extract_failed'));
    console.log(JSON.stringify({ success: false, error: t('create_form.schema_parse_failed') }));
    throwCreateFormError(t('create_form.schema_parse_failed'), 'CREATE_FORM_SCHEMA_PARSE_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  if (!schema.pages || !Array.isArray(schema.pages) || schema.pages.length === 0) {
    fail('Schema 为空，无法绑定数据源');
    console.log(JSON.stringify({ success: false, error: 'empty_schema' }));
    throwCreateFormError('empty_schema', 'CREATE_FORM_EMPTY_SCHEMA', { appType, formUuid });
  }

  step(3, '绑定字段数据源: ' + fieldLabel);
  const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);
  if (!formContainer || !formContainer.children) {
    fail('未找到表单容器');
    console.log(JSON.stringify({ success: false, error: 'no_form_container' }));
    throwCreateFormError('no_form_container', 'CREATE_FORM_NO_FORM_CONTAINER', { appType, formUuid });
  }

  const fieldResolution = resolveFieldReference(formContainer.children, { ref: fieldLabel, label: fieldLabel });
  if (!fieldResolution.ok) {
    outputFieldResolutionFailure(appType, formUuid, [Object.assign({ action: 'bind-datasource' }, fieldResolution.diagnostic)]);
  }

  const targetComponent = fieldResolution.match.field;
  const resolved = fieldResolution.resolved;
  if (OPTION_FIELD_TYPES.indexOf(targetComponent.componentName) === -1) {
    fail(fieldLabel + ' 不是选项类字段（当前类型: ' + targetComponent.componentName + '）');
    hint('bind-datasource 仅支持: ' + OPTION_FIELD_TYPES.join(', '));
    console.log(JSON.stringify({ success: false, error: 'not_option_field', componentName: targetComponent.componentName, resolved }));
    throwCreateFormError('not_option_field', 'CREATE_FORM_NOT_OPTION_FIELD', {
      appType,
      formUuid,
      fieldLabel,
      componentName: targetComponent.componentName,
      resolved,
    });
  }

  targetComponent.props = targetComponent.props || {};
  const dataSourceConfig = readDataSourceDefinition(dataSourceJsonOrFile);
  const normalized = applySelectDataSourceConfig(targetComponent.props, dataSourceConfig);
  success('字段数据源已绑定');
  label('URL:', normalized.url || '(仅初始化选项)');
  label('Options:', String(normalized.options.length));

  const corpId = resolveCorpId(authRef.authData);
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  let configWarningPayload = null;
  if (configResult && configResult.success) {
    result(true, '字段数据源保存成功', [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['URL', normalized.url || '-'],
      ['Options', String(normalized.options.length)],
    ]);
  } else {
    result(true, '字段数据源保存成功', [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['URL', normalized.url || '-'],
      ['Options', String(normalized.options.length)],
    ]);
    configWarningPayload = warnPostSaveUpdateConfigFailure(configResult);
  }

  console.log(JSON.stringify(withBrowserHandoff(
    Object.assign({
      success: true,
      formUuid,
      appType,
      fieldLabel,
      fieldId: targetComponent.props.fieldId || '',
      componentName: targetComponent.componentName,
      resolved,
      url: normalized.url,
      options: normalized.options.length,
      filterLocal: targetComponent.props.filterLocal,
      pageUrl: formUrl,
    }, configWarningPayload || {}),
    formUrl,
    { stage: 'bind_datasource_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── rule 模式主流程：声明式字段联动 / 自动赋值 ─────────

async function mainRule(parsedArgs, authRef) {
  const { appType, formUuid, rulesJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Rules:', rulesJsonOrFile);

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid: formUuid, schemaVersion: 'V5' }
    );
  }, authRef);

  if (!schemaResult || schemaResult.success === false || schemaResult.__needLogin) {
    const errorMsg = schemaResult ? schemaResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.get_schema_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  let schema;
  const version = extractSchemaServerRevision(schemaResult);

  if (schemaResult.content) {
    schema = typeof schemaResult.content === 'string' ? JSON.parse(schemaResult.content) : schemaResult.content;
  } else if (schemaResult.pages) {
    schema = schemaResult;
  } else {
    fail(t('create_form.schema_extract_failed'));
    hint(t('create_form.schema_response_structure', JSON.stringify(Object.keys(schemaResult))));
    console.log(JSON.stringify({ success: false, error: t('create_form.schema_parse_failed') }));
    throwCreateFormError(t('create_form.schema_parse_failed'), 'CREATE_FORM_SCHEMA_PARSE_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  step(3, '读取并应用表单联动规则');
  const rules = readRuleDefinition(rulesJsonOrFile);
  let applied;
  try {
    applied = applyFormRules(schema, rules);
  } catch (ruleError) {
    const fieldResolutionError = normalizeFieldResolutionApplyError(ruleError);
    if (fieldResolutionError) {
      outputFieldResolutionFailure(appType, formUuid, fieldResolutionError.diagnostics);
    }
    fail('表单联动规则应用失败: ' + ruleError.message);
    console.log(JSON.stringify({
      success: false,
      error: ruleError.message,
      formUuid,
      appType,
    }));
    throwCreateFormError(ruleError.message, 'CREATE_FORM_RULE_APPLY_FAILED', {
      appType,
      formUuid,
    });
  }

  success('已应用 ' + applied.rules.length + ' 条联动规则，绑定 ' + applied.bindings.length + ' 个字段事件');
  applied.rules.forEach(function (rule, index) {
    listItem((index + 1) + '. ' + rule.type + ' -> ' + (rule.targetFieldId || (rule.targetFieldIds || []).join(', ')));
  });

  const corpId = resolveCorpId(authRef.authData);
  const formContainer = schema.pages && schema.pages[0] && schema.pages[0].componentsTree
    ? findFormContainer(schema.pages[0].componentsTree[0])
    : null;
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  let configWarningPayload = null;
  if (configResult && configResult.success) {
    result(true, '表单联动规则保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Rules', String(applied.rules.length)],
    ]);
  } else {
    result(true, '表单联动规则保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Rules', String(applied.rules.length)],
    ]);
    configWarningPayload = warnPostSaveUpdateConfigFailure(configResult);
  }

  console.log(JSON.stringify(withBrowserHandoff(
    Object.assign({
      success: true,
      formUuid,
      appType,
      rulesApplied: applied.rules.length,
      rules: applied.rules.map(function (rule) {
        return {
          type: rule.type,
          sourceFieldId: rule.sourceFieldId,
          conditionFieldId: rule.condition && rule.condition.fieldId,
          targetFieldId: rule.targetFieldId,
          targetFieldIds: rule.targetFieldIds,
          resolved: buildRuleResolvedEvidence(rule, applied.fieldLookup),
        };
      }),
      eventBindings: applied.bindings.map(function (binding) {
        return {
          fieldId: binding.fieldId,
          label: binding.label,
          event: binding.eventName,
          actionName: binding.wrapperName,
          resolved: getFieldEvidenceFromLookup(applied.fieldLookup, binding.fieldId),
        };
      }),
      url: formUrl,
    }, configWarningPayload || {}),
    formUrl,
    { stage: 'form_rules_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── patch 模式主流程 ──────────────────────────────────

async function mainPatch(parsedArgs, authRef) {
  const { appType, formUuid, patchJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Patch:', patchJsonOrFile);

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid: formUuid, schemaVersion: 'V5' }
    );
  }, authRef);

  if (!schemaResult || schemaResult.success === false || schemaResult.__needLogin) {
    const errorMsg = schemaResult ? schemaResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.get_schema_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  let schema;
  const version = extractSchemaServerRevision(schemaResult);

  if (schemaResult.content) {
    schema = typeof schemaResult.content === 'string' ? JSON.parse(schemaResult.content) : schemaResult.content;
  } else if (schemaResult.pages) {
    schema = schemaResult;
  } else {
    fail(t('create_form.schema_extract_failed'));
    hint(t('create_form.schema_response_structure', JSON.stringify(Object.keys(schemaResult))));
    console.log(JSON.stringify({ success: false, error: t('create_form.schema_parse_failed') }));
    throwCreateFormError(t('create_form.schema_parse_failed'), 'CREATE_FORM_SCHEMA_PARSE_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  step(3, '读取并应用 Schema 补丁');
  const operations = readPatchDefinition(patchJsonOrFile);
  let appliedOperations;
  try {
    appliedOperations = applySchemaPatchOperations(schema, operations);
  } catch (patchError) {
    fail('Schema 补丁应用失败: ' + patchError.message);
    console.log(JSON.stringify({
      success: false,
      error: patchError.message,
      formUuid,
      appType,
    }));
    throwCreateFormError(patchError.message, 'CREATE_FORM_PATCH_APPLY_FAILED', {
      appType,
      formUuid,
    });
  }
  success('已应用 ' + appliedOperations.length + ' 个补丁操作');
  appliedOperations.forEach(function (operation, index) {
    listItem((index + 1) + '. ' + operation.action + (operation.field ? ' ' + operation.field : '') + (operation.path ? ' ' + operation.path : ''));
  });

  const corpId = resolveCorpId(authRef.authData);
  const formContainer = schema.pages && schema.pages[0] && schema.pages[0].componentsTree
    ? findFormContainer(schema.pages[0].componentsTree[0])
    : null;
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  let configWarningPayload = null;
  if (configResult && configResult.success) {
    result(true, 'Schema 补丁保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Operations', String(appliedOperations.length)],
    ]);
  } else {
    result(true, 'Schema 补丁保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Operations', String(appliedOperations.length)],
    ]);
    configWarningPayload = warnPostSaveUpdateConfigFailure(configResult);
  }

  console.log(JSON.stringify(withBrowserHandoff(
    Object.assign(
      { success: true, formUuid, appType, operationsApplied: appliedOperations.length, operations: appliedOperations, url: formUrl },
      configWarningPayload || {}
    ),
    formUrl,
    { stage: 'patch_form_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── validation 模式主流程：字段原生校验 ───────────────

async function mainValidation(parsedArgs, authRef) {
  const { appType, formUuid, validationJsonOrFile, inlineValidationRule } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Validation:', inlineValidationRule ? JSON.stringify(inlineValidationRule) : validationJsonOrFile);

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid: formUuid, schemaVersion: 'V5' }
    );
  }, authRef);

  if (!schemaResult || schemaResult.success === false || schemaResult.__needLogin) {
    const errorMsg = schemaResult ? schemaResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.get_schema_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  let schema;
  const version = extractSchemaServerRevision(schemaResult);

  if (schemaResult.content) {
    schema = typeof schemaResult.content === 'string' ? JSON.parse(schemaResult.content) : schemaResult.content;
  } else if (schemaResult.pages) {
    schema = schemaResult;
  } else {
    fail(t('create_form.schema_extract_failed'));
    hint(t('create_form.schema_response_structure', JSON.stringify(Object.keys(schemaResult))));
    console.log(JSON.stringify({ success: false, error: t('create_form.schema_parse_failed') }));
    throwCreateFormError(t('create_form.schema_parse_failed'), 'CREATE_FORM_SCHEMA_PARSE_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  step(3, '读取并应用智能校验规则');
  const validations = readValidationDefinition(validationJsonOrFile, inlineValidationRule);
  let applied;
  try {
    applied = applySmartValidations(schema, validations);
  } catch (validationError) {
    const fieldResolutionError = normalizeFieldResolutionApplyError(validationError);
    if (fieldResolutionError) {
      outputFieldResolutionFailure(appType, formUuid, fieldResolutionError.diagnostics);
    }
    fail('智能校验规则应用失败: ' + validationError.message);
    console.log(JSON.stringify({
      success: false,
      error: validationError.message,
      formUuid,
      appType,
    }));
    throwCreateFormError(validationError.message, 'CREATE_FORM_VALIDATION_APPLY_FAILED', {
      appType,
      formUuid,
    });
  }

  success('已应用 ' + applied.appliedRules.length + ' 条字段校验规则');
  applied.appliedRules.forEach(function (rule, index) {
    listItem((index + 1) + '. ' + rule.type + ' -> ' + (rule.fieldLabel || rule.fieldId));
  });

  const corpId = resolveCorpId(authRef.authData);
  const formContainer = schema.pages && schema.pages[0] && schema.pages[0].componentsTree
    ? findFormContainer(schema.pages[0].componentsTree[0])
    : null;
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  let configWarningPayload = null;
  if (configResult && configResult.success) {
    result(true, '智能校验规则保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Validations', String(applied.appliedRules.length)],
    ]);
  } else {
    result(true, '智能校验规则保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Validations', String(applied.appliedRules.length)],
    ]);
    configWarningPayload = warnPostSaveUpdateConfigFailure(configResult);
  }

  console.log(JSON.stringify(withBrowserHandoff(
    Object.assign({
      success: true,
      formUuid,
      appType,
      validationsApplied: applied.appliedRules.length,
      rules: applied.appliedRules.map(function (rule) {
        return {
          type: rule.type,
          fieldId: rule.fieldId,
          fieldLabel: rule.fieldLabel,
          targetFieldId: rule.targetFieldId,
          targetLabel: rule.targetLabel,
          resolved: rule.resolved,
          targetResolved: rule.targetResolved,
        };
      }),
      url: formUrl,
    }, configWarningPayload || {}),
    formUrl,
    { stage: 'validation_form_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── update 模式主流程 ─────────────────────────────────

async function mainUpdate(parsedArgs, authRef) {
  const { appType, formUuid, changesJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Changes:', changesJsonOrFile);

  step(2, t('create_form.step_read_changes', 2));
  const changes = readChangesDefinition(changesJsonOrFile);
  validateChangeFieldDefinitions(changes);
  success(t('create_form.changes_loaded', changes.length));
  changes.forEach(function (change, changeIndex) {
    if (change.action === 'add') {
      listItem((changeIndex + 1) + '. [' + t('create_form.action_add') + '] ' + change.field.type + ': ' + change.field.label);
    } else if (change.action === 'delete') {
      listItem((changeIndex + 1) + '. [' + t('create_form.action_delete') + '] ' + change.label);
    } else if (change.action === 'update') {
      listItem((changeIndex + 1) + '. [' + t('create_form.action_update') + '] ' + change.label + ' → ' + Object.keys(change.changes || {}).join(', '));
    }
  });

  step(3, t('create_form.step_get_schema', 3));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      buildApiPath(appType, 'getFormSchema', { prefix: '_view', namespace: 'alibaba' }),
      { formUuid: formUuid, schemaVersion: 'V5' }
    );
  }, authRef);

  if (!schemaResult || schemaResult.success === false || schemaResult.__needLogin) {
    const errorMsg = schemaResult ? schemaResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.get_schema_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_GET_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  // 从返回结果中提取 schema 内容和版本号
  let schema;
  const version = extractSchemaServerRevision(schemaResult);

  if (schemaResult.content) {
    schema = typeof schemaResult.content === 'string' ? JSON.parse(schemaResult.content) : schemaResult.content;
  } else if (schemaResult.pages) {
    schema = schemaResult;
  } else {
    fail(t('create_form.schema_extract_failed'));
    hint(t('create_form.schema_response_structure', JSON.stringify(Object.keys(schemaResult))));
    console.log(JSON.stringify({ success: false, error: t('create_form.schema_parse_failed') }));
    throwCreateFormError(t('create_form.schema_parse_failed'), 'CREATE_FORM_SCHEMA_PARSE_FAILED', {
      appType,
      formUuid,
      result: schemaResult,
    });
  }

  if (!schema.pages || !Array.isArray(schema.pages) || schema.pages.length === 0) {
    warn(t('create_form.schema_empty_init'));
    schema = buildEmptyFormSchema();
  }

  const formContainer = findFormContainer(schema.pages[0].componentsTree[0]);
  if (formContainer && formContainer.children) {
    success(t('create_form.schema_got_fields', formContainer.children.length));
  } else {
    warn(t('create_form.schema_got_empty'));
  }

  step(4, t('create_form.step_check_data', 4));
  const dataCheckResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl,
      '/dingtalk/web/' + appType + '/v1/form/searchFormDatas.json',
      { formUuid: formUuid, appType: appType, currentPage: '1', pageSize: '1' }
    );
  }, authRef);

  let existingDataCount = 0;
  if (dataCheckResult && dataCheckResult.content && typeof dataCheckResult.content.totalCount === 'number') {
    existingDataCount = dataCheckResult.content.totalCount;
  } else if (dataCheckResult && typeof dataCheckResult.totalCount === 'number') {
    existingDataCount = dataCheckResult.totalCount;
  }

  if (existingDataCount > 0) {
    warn(t('create_form.data_exists_warning', existingDataCount));
    hint(t('create_form.data_exists_impact'));

    if (!parsedArgs.force) {
      info(t('create_form.data_exists_abort'));
      const confirmationOutput = {
        success: false,
        requiresConfirmation: true,
        formUuid: formUuid,
        appType: appType,
        existingDataCount: existingDataCount,
        message: t('create_form.data_exists_confirm_message', existingDataCount),
        hint: t('create_form.data_exists_force_hint'),
      };
      console.log(JSON.stringify(confirmationOutput));
      return confirmationOutput;
    }

    warn(t('create_form.data_exists_force_proceed', existingDataCount));
  } else {
    success(t('create_form.data_check_empty'));
  }

  step(5, t('create_form.step_apply_changes', 5));
  const appliedChanges = applyChangesToSchema(schema, changes, { verbose: true });
  const fieldDiagnostics = appliedChanges.diagnostics || [];
  if (fieldDiagnostics.length > 0) {
    const errorOutput = {
      success: false,
      error: 'CREATE_FORM_FIELD_RESOLUTION_FAILED',
      message: t('create_form.field_resolution_failed'),
      appType,
      formUuid,
      changesApplied: appliedChanges.length,
      changes: appliedChanges,
      diagnostics: fieldDiagnostics,
    };
    console.log(JSON.stringify(errorOutput));
    throwCreateFormError(t('create_form.field_resolution_failed'), 'CREATE_FORM_FIELD_RESOLUTION_FAILED', {
      appType,
      formUuid,
      diagnostics: fieldDiagnostics,
    });
  }

  // 为 SerialNumberField 补全 formula（若尚未设置）
  const corpId = resolveCorpId(authRef.authData);
  if (!corpId) {
    warn(t('create_form.no_corp_id_warning'));
  }

  const formContainerUpdate = findFormContainer(schema.pages[0].componentsTree[0]);
  if (formContainerUpdate && formContainerUpdate.children) {
    fillSerialNumberFormulas(formContainerUpdate.children, corpId, appType, formUuid);
  }

  // Step 6 & 7: 保存 Schema 并更新表单配置
  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 6);

  // 输出结果
  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, t('create_form.update_success'), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Changes', String(appliedChanges.length)],
    ]);
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, formUuid, appType, changesApplied: appliedChanges.length, changes: appliedChanges, url: formUrl },
      formUrl,
      { stage: 'update_form_success', title: formUuid },
      parsedArgs.browserOpenMode
    )));
  } else {
    result(true, t('create_form.update_success'), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Changes', String(appliedChanges.length)],
    ]);
    const warningPayload = warnPostSaveUpdateConfigFailure(configResult);
    console.log(JSON.stringify(withBrowserHandoff(
      Object.assign({
        success: true,
        formUuid,
        appType,
        changesApplied: appliedChanges.length,
        changes: appliedChanges,
        url: formUrl,
      }, warningPayload),
      formUrl,
      { stage: 'update_form_success', title: formUuid },
      parsedArgs.browserOpenMode
    )));
  }
}

// ── 主入口 ────────────────────────────────────────────

async function run(args) {
  const parsedArgs = parseArgs(args);
  if (parsedArgs.help) {
    return parsedArgs;
  }
  if (parsedArgs.mode === 'validate-fields') {
    return mainValidateFields(parsedArgs);
  }

  step(1, t('common.step_login', 1));
  const authRef = createAuthRef();
  success(t('common.login_ready', authRef.baseUrl));
  label('Locale:', resolveContentLocale({ locale: parsedArgs.contentLocale, baseUrl: authRef.baseUrl }));

  return dispatchCreateFormCommand(
    parsedArgs,
    authRef,
    {
      create: mainCreate,
      update: mainUpdate,
      patch: mainPatch,
      rule: mainRule,
      validation: mainValidation,
      bindDataSource: mainBindDataSource,
      addOption: mainAddOption,
      validateFields: mainValidateFields,
    }
  );
}

if (require.main === module) {
  run().catch((err) => {
    error(t('common.exception', err.message));
    process.exitCode = err && err.exitCode ? err.exitCode : 1;
  });
}

module.exports = {
  createFormForLegacyProcess,
  run,
  parseArgs,
  _private: {
    buildFormSchema,
    buildFormNodeComponent,
    countDataFieldDefinitions,
    collectComponentNames,
    normalizeFormDefinitionType,
    validateFormFieldDefinitions,
    collectFormFieldValidationDiagnostics,
    ensureYidaGlobalThemeAction,
    applyDefaultFormDetailStyle,
    applyChangesToSchema,
  },
};
