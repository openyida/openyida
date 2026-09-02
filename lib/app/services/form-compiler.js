'use strict';

const { buildYidaI18n } = require('../../core/yida-i18n');
const {
  collectInputValidationRules,
  dedupeValidationRules,
  deepMerge,
  normalizeFieldValidationRules,
} = require('./form-validation');
const { assertNoEmojiInValue } = require('../../core/no-emoji-guard');

const OPTION_FIELD_TYPES = Object.freeze(['RadioField', 'SelectField', 'CheckboxField', 'MultiSelectField']);
const TABLE_FIELD_TYPE = 'TableField';
const ASSOCIATION_FORM_FIELD_TYPE = 'AssociationFormField';

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

function createFormCompilerError(message, code, details) {
  const error = new Error(message);
  error.code = code || 'FORM_COMPILER_FAILED';
  if (details) {
    error.details = details;
  }
  return error;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function fieldIdPrefixForComponent(componentName) {
  return componentName.charAt(0).toLowerCase() + componentName.slice(1) + '_';
}

function validateSemanticKey(rawKey) {
  if (rawKey === undefined || rawKey === null || rawKey === '') {
    return '';
  }
  const key = String(rawKey).trim();
  if (!key) {
    return '';
  }
  if (key.indexOf('.') !== -1) {
    throw createFormCompilerError('表单字段 semantic key 不能包含点号: ' + key, 'FORM_COMPILER_INVALID_SEMANTIC_KEY', { key });
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
    throw createFormCompilerError('表单字段 semantic key 格式非法: ' + key, 'FORM_COMPILER_INVALID_SEMANTIC_KEY', { key });
  }
  return key;
}

function collectExplicitSemanticKeys(field) {
  const entries = [];
  ['key', 'semanticKey', 'semantic_key'].forEach(function (propertyName) {
    if (!hasOwn(field, propertyName)) {
      return;
    }
    const key = validateSemanticKey(field[propertyName]);
    if (key) {
      entries.push({ propertyName, key });
    }
  });
  return entries;
}

function normalizeSemanticKey(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  const entries = collectExplicitSemanticKeys(field);
  if (entries.length === 0) {
    return '';
  }
  const firstKey = entries[0].key;
  const conflicting = entries.find(function (entry) {
    return entry.key !== firstKey;
  });
  if (conflicting) {
    throw createFormCompilerError(
      '字段 semantic key 声明冲突: ' + firstKey + ' / ' + conflicting.key,
      'FORM_COMPILER_SEMANTIC_KEY_CONFLICT',
      {
        key: firstKey,
        conflictingKey: conflicting.key,
        propertyName: conflicting.propertyName,
      }
    );
  }
  return firstKey;
}

function normalizeExistingBindings(existingBindings) {
  const source = existingBindings && typeof existingBindings === 'object'
    ? (existingBindings.fieldBindings || existingBindings.fields || existingBindings)
    : {};
  const normalized = {};
  Object.keys(source || {}).forEach(function (semanticPath) {
    const value = source[semanticPath];
    if (typeof value === 'string') {
      normalized[semanticPath] = { fieldId: value };
    } else if (value && typeof value === 'object') {
      const fieldId = value.fieldId || value.id || value.value;
      if (fieldId) {
        normalized[semanticPath] = Object.assign({}, value, { fieldId: String(fieldId) });
      }
    }
  });
  return normalized;
}

function createCompilerOptions(options) {
  const compilerOptions = options || {};
  return {
    existingBindings: normalizeExistingBindings(compilerOptions.existingBindings),
    fieldBindings: compilerOptions.fieldBindings || {},
    fieldBindingComponents: compilerOptions.fieldBindingComponents || {},
    semanticPath: compilerOptions.semanticPath || '',
    requireParentSemanticPath: !!compilerOptions.requireParentSemanticPath,
    onSerialNumberFormula: compilerOptions.onSerialNumberFormula,
  };
}

function childCompilerOptions(options, semanticPath) {
  return Object.assign({}, options, {
    semanticPath: semanticPath || '',
    requireParentSemanticPath: true,
  });
}

function assertFieldIdMatchesComponent(fieldId, componentName, semanticPath) {
  if (!fieldId) {
    return;
  }
  const expectedPrefix = fieldIdPrefixForComponent(componentName);
  if (!String(fieldId).startsWith(expectedPrefix)) {
    throw createFormCompilerError(
      'existing binding 的 fieldId 与字段类型不匹配: ' + semanticPath,
      'FORM_COMPILER_FIELD_BINDING_TYPE_MISMATCH',
      {
        semanticPath,
        fieldId,
        componentName,
        expectedPrefix,
      }
    );
  }
}

function resolveFieldId(componentName, semanticPath, options) {
  if (!semanticPath) {
    return generateFieldId(componentName);
  }
  const binding = options.existingBindings[semanticPath];
  if (binding && binding.fieldId) {
    assertFieldIdMatchesComponent(binding.fieldId, componentName, semanticPath);
    return binding.fieldId;
  }
  return generateFieldId(componentName);
}

function recordFieldBinding(options, semanticPath, fieldId, componentName) {
  if (!semanticPath) {
    return;
  }
  if (hasOwn(options.fieldBindings, semanticPath)) {
    throw createFormCompilerError(
      '重复的字段 semantic path: ' + semanticPath,
      'FORM_COMPILER_DUPLICATE_SEMANTIC_PATH',
      {
        semanticPath,
        existingFieldId: options.fieldBindings[semanticPath],
        fieldId,
        componentName,
      }
    );
  }
  options.fieldBindings[semanticPath] = fieldId;
  options.fieldBindingComponents[semanticPath] = componentName;
}

function normalizeFieldsObject(fieldsObject) {
  return Object.keys(fieldsObject || {}).map(function (key) {
    const field = fieldsObject[key];
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw createFormCompilerError('字段定义必须是对象: ' + key, 'FORM_COMPILER_INVALID_DEFINITION', { key });
    }
    const objectKey = validateSemanticKey(key);
    const explicitKey = normalizeSemanticKey(field);
    if (explicitKey && explicitKey !== objectKey) {
      throw createFormCompilerError(
        '对象式 fields 的属性名与字段内部 semantic key 冲突: ' + objectKey + ' / ' + explicitKey,
        'FORM_COMPILER_SEMANTIC_KEY_CONFLICT',
        {
          objectKey,
          explicitKey,
        }
      );
    }
    return Object.assign({}, field, { key: objectKey });
  });
}

function normalizeFormDefinition(definition, options) {
  const compilerOptions = options || {};
  if (Array.isArray(definition)) {
    return {
      fields: definition,
      formTitle: compilerOptions.formTitle || compilerOptions.title || '',
      formUuid: compilerOptions.formUuid || '',
      corpId: compilerOptions.corpId || '',
      appType: compilerOptions.appType || '',
      layout: compilerOptions.layout,
      theme: compilerOptions.theme,
      labelAlign: compilerOptions.labelAlign,
    };
  }

  if (!definition || typeof definition !== 'object') {
    throw createFormCompilerError('表单定义必须是对象或字段数组', 'FORM_COMPILER_INVALID_DEFINITION');
  }

  const fields = Array.isArray(definition.fields)
    ? definition.fields
    : normalizeFieldsObject(definition.fields || {});

  return {
    fields,
    formTitle: definition.formTitle || definition.title || compilerOptions.formTitle || compilerOptions.title || '',
    formUuid: definition.formUuid || compilerOptions.formUuid || '',
    corpId: definition.corpId || compilerOptions.corpId || '',
    appType: definition.appType || compilerOptions.appType || '',
    layout: definition.layout || compilerOptions.layout,
    theme: definition.theme || compilerOptions.theme,
    labelAlign: definition.labelAlign || compilerOptions.labelAlign,
  };
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

// ── 生成选项数据源 ───────────────────────────────────

function buildOptionDataSource(options) {
  return options.map(function (optionText, optionIndex) {
    return {
      text: i18n(optionText, optionText, optionText),
      value: optionText,
      sid: 'serial_' + Date.now().toString(36) + optionIndex,
      disable: false,
      defaultChecked: false,
    };
  });
}

function normalizeOptionItem(option, optionIndex) {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    const optionText = String(option);
    return {
      text: i18n(optionText, optionText, optionText),
      value: optionText,
      sid: 'serial_' + Date.now().toString(36) + optionIndex,
      disable: false,
      defaultChecked: false,
    };
  }
  if (option && typeof option === 'object') {
    const rawText = option.text || option.label || option.name || option.title || option.value || '';
    const rawValue = option.value !== undefined ? option.value :
      option.id !== undefined ? option.id :
        option.key !== undefined ? option.key : rawText;
    return {
      text: rawText && typeof rawText === 'object' ? rawText : i18n(String(rawText), String(rawText), String(rawText)),
      value: String(rawValue),
      sid: option.sid || 'serial_' + Date.now().toString(36) + optionIndex,
      disable: option.disable || false,
      defaultChecked: option.defaultChecked || false,
    };
  }
  const fallbackText = '选项' + (optionIndex + 1);
  return {
    text: i18n(fallbackText, fallbackText, fallbackText),
    value: fallbackText,
    sid: 'serial_' + Date.now().toString(36) + optionIndex,
    disable: false,
    defaultChecked: false,
  };
}

function normalizeOptionDataSource(options) {
  if (!Array.isArray(options)) {
    return [];
  }
  return options.map(normalizeOptionItem);
}

function normalizeSearchDataType(value, fallback) {
  const raw = String(value || fallback || 'json').trim();
  if (!raw) {
    return 'json';
  }
  return raw.toLowerCase() === 'jsonp' ? 'jsonp' : 'json';
}

function buildDefaultBeforeFetchSource(config) {
  if (config.beforeFetch !== undefined) {
    return String(config.beforeFetch);
  }
  const queryParam = config.queryParam || config.keywordParam || 'key';
  const queryParamLiteral = JSON.stringify(queryParam);
  return [
    'function willFetch(params) {',
    '  params = params || {};',
    '  var keyword = params.key || params.q || params.keyword || "";',
    '  params[' + queryParamLiteral + '] = keyword;',
    '  return params;',
    '}',
  ].join('\n');
}

function buildDefaultAfterFetchSource(config) {
  if (config.afterFetch !== undefined) {
    return String(config.afterFetch);
  }
  const listPath = JSON.stringify(config.listPath || config.arrayPath || 'data');
  const labelField = JSON.stringify(config.labelField || config.textField || config.labelKey || 'label');
  const valueField = JSON.stringify(config.valueField || config.valueKey || 'value');
  return [
    'function didFetch(content) {',
    '  function readPath(obj, path) {',
    '    if (!path) { return obj; }',
    '    var parts = String(path).split(".");',
    '    var current = obj;',
    '    for (var i = 0; i < parts.length; i++) {',
    '      if (current == null) { return undefined; }',
    '      current = current[parts[i]];',
    '    }',
    '    return current;',
    '  }',
    '  var list = readPath(content, ' + listPath + ');',
    '  if (!Array.isArray(list)) {',
    '    list = content && (content.list || content.items || content.values || content.result || content.data);',
    '  }',
    '  if (!Array.isArray(list)) { list = []; }',
    '  return list.map(function (item) {',
    '    if (item && typeof item === "object") {',
    '      var text = readPath(item, ' + labelField + ');',
    '      var value = readPath(item, ' + valueField + ');',
    '      if (value === undefined || value === null || value === "") { value = text; }',
    '      if (text === undefined || text === null || text === "") { text = value; }',
    '      return { text: String(text || ""), value: String(value || "") };',
    '    }',
    '    return { text: String(item), value: String(item) };',
    '  });',
    '}',
  ].join('\n');
}

function normalizeSelectDataSourceConfig(config) {
  const rawConfig = config && typeof config === 'object'
    ? (config.remoteDataSource || config.searchDataSource || config.dataSourceConfig || config)
    : {};
  const searchConfig = rawConfig.searchConfig || {};
  const url = rawConfig.url || rawConfig.endpoint || rawConfig.searchUrl || searchConfig.url || '';
  const dataType = normalizeSearchDataType(rawConfig.dataType || searchConfig.dataType || searchConfig.type, 'json');
  const beforeFetch = buildDefaultBeforeFetchSource(Object.assign({}, rawConfig, searchConfig));
  const afterFetch = buildDefaultAfterFetchSource(Object.assign({}, rawConfig, searchConfig));
  const options = normalizeOptionDataSource(rawConfig.options || rawConfig.initialOptions || rawConfig.dataSource || []);

  return {
    url,
    dataType,
    beforeFetch,
    afterFetch,
    options,
    dataSourceType: rawConfig.dataSourceType || 'custom',
    filterLocal: rawConfig.filterLocal !== undefined ? !!rawConfig.filterLocal : !url,
    showSearch: rawConfig.showSearch !== false,
    placeholder: rawConfig.placeholder,
    notFoundContent: rawConfig.notFoundContent,
    props: rawConfig.props && typeof rawConfig.props === 'object' ? rawConfig.props : null,
  };
}

function applySelectDataSourceConfig(props, config) {
  const normalized = normalizeSelectDataSourceConfig(config);
  props.dataSource = normalized.options;
  props.dataSourceType = normalized.dataSourceType;
  props.showSearch = normalized.showSearch;
  props.filterLocal = normalized.filterLocal;

  if (normalized.placeholder !== undefined) {
    props.placeholder = i18n(normalized.placeholder);
  }
  if (normalized.notFoundContent !== undefined) {
    props.notFoundContent = i18n(normalized.notFoundContent);
  }

  props.searchConfig = {
    dataType: normalized.dataType,
    url: normalized.url,
    beforeFetch: normalized.beforeFetch,
    afterFetch: normalized.afterFetch,
  };
  props.defaultDataSource = Object.assign({}, props.defaultDataSource || {}, {
    customStashOptions: props.defaultDataSource && props.defaultDataSource.customStashOptions || [],
    complexType: 'custom',
    options: normalized.options,
    formula: props.defaultDataSource && props.defaultDataSource.formula || { data: [], event: { 'onPageReady,onChange': [] } },
    url: normalized.url,
    searchConfig: {
      type: normalized.dataType.toUpperCase(),
      url: normalized.url,
      beforeFetch: normalized.beforeFetch,
      afterFetch: normalized.afterFetch,
    },
  });

  if (normalized.props) {
    deepMerge(props, normalized.props);
  }
  return normalized;
}

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

const SUPPORTED_FIELD_TYPES = Object.freeze([
  'TextField',
  'TextareaField',
  'NumberField',
  'RateField',
  'DateField',
  'CascadeDateField',
  'RadioField',
  'SelectField',
  'CheckboxField',
  'MultiSelectField',
  'EmployeeField',
  'DepartmentSelectField',
  'CountrySelectField',
  'AddressField',
  'AttachmentField',
  'ImageField',
  TABLE_FIELD_TYPE,
  ASSOCIATION_FORM_FIELD_TYPE,
  'SerialNumberField',
]);

function normalizeFieldType(fieldType) {
  if (fieldType === undefined || fieldType === null || fieldType === '') {
    return '';
  }
  return FIELD_TYPE_ALIAS[fieldType] || fieldType;
}

function isSupportedFieldType(fieldType) {
  return SUPPORTED_FIELD_TYPES.indexOf(normalizeFieldType(fieldType)) !== -1;
}

function isOptionFieldType(fieldType) {
  return OPTION_FIELD_TYPES.indexOf(normalizeFieldType(fieldType)) !== -1;
}

function readFieldDefinitionType(field) {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return '';
  }
  if (field.type !== undefined && field.type !== null && field.type !== '') {
    return String(field.type).trim();
  }
  if (field.componentType !== undefined && field.componentType !== null && field.componentType !== '') {
    return String(field.componentType).trim();
  }
  if (field.componentName !== undefined && field.componentName !== null && field.componentName !== '') {
    return String(field.componentName).trim();
  }
  return '';
}

function assertSupportedFieldDefinition(field, details) {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    throw createFormCompilerError(
      '字段定义必须是对象',
      'FORM_COMPILER_INVALID_DEFINITION',
      details
    );
  }
  const rawType = readFieldDefinitionType(field);
  const componentName = normalizeFieldType(rawType);
  if (!componentName) {
    throw createFormCompilerError(
      '字段定义缺少 type/componentType/componentName',
      'FORM_COMPILER_FIELD_TYPE_MISSING',
      Object.assign({
        label: field.label,
        title: field.title,
      }, details)
    );
  }
  if (!isSupportedFieldType(componentName)) {
    throw createFormCompilerError(
      '不支持的字段类型: ' + componentName,
      'FORM_COMPILER_UNSUPPORTED_FIELD_TYPE',
      Object.assign({
        label: field.label,
        title: field.title,
        type: rawType,
        componentName,
      }, details)
    );
  }
  return componentName;
}

function hasNonEmptyAssociationFormUuid(field) {
  const associationForm = field && field.associationForm;
  if (!associationForm || typeof associationForm !== 'object' || Array.isArray(associationForm)) {
    return false;
  }
  return typeof associationForm.formUuid === 'string' && associationForm.formUuid.trim().length > 0;
}

function hasManagedAssociationFormReference(field) {
  if (!field || field.form === undefined || field.form === null) {
    return false;
  }
  const formReference = String(field.form).trim();
  return /^form:[A-Za-z][A-Za-z0-9_-]*$/.test(formReference);
}

function assertAssociationFormFieldDefinition(field, details) {
  if (hasNonEmptyAssociationFormUuid(field) || hasManagedAssociationFormReference(field)) {
    return;
  }
  throw createFormCompilerError(
    'AssociationFormField 必须配置 associationForm.formUuid 或 form: 引用',
    'FORM_COMPILER_ASSOCIATION_FORM_UUID_MISSING',
    Object.assign({
      label: field && field.label,
      title: field && field.title,
      form: field && field.form,
      componentName: ASSOCIATION_FORM_FIELD_TYPE,
    }, details || {})
  );
}

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

// ── 生成字段组件 ─────────────────────────────────────

function buildFieldComponent(field, options) {
  const compilerOptions = createCompilerOptions(options);
  const componentName = assertSupportedFieldDefinition(field, {
    semanticPath: compilerOptions.semanticPath,
  });
  const semanticKey = normalizeSemanticKey(field);
  if (semanticKey && compilerOptions.requireParentSemanticPath && !compilerOptions.semanticPath) {
    throw createFormCompilerError(
      '子表字段声明 semantic key 时，父级 TableField 也必须声明 semantic key',
      'FORM_COMPILER_MISSING_PARENT_SEMANTIC_KEY',
      { key: semanticKey }
    );
  }
  const semanticPath = semanticKey
    ? (compilerOptions.semanticPath ? compilerOptions.semanticPath + '.' + semanticKey : semanticKey)
    : '';
  if (componentName === ASSOCIATION_FORM_FIELD_TYPE) {
    assertAssociationFormFieldDefinition(field, { semanticPath });
  }
  const fieldId = resolveFieldId(componentName, semanticPath, compilerOptions);
  const nodeId = nextNodeId();
  recordFieldBinding(compilerOptions, semanticPath, fieldId, componentName);

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
        dataSource = rawDataSource.map(normalizeOptionItem);
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
      return buildFieldComponent(childField, childCompilerOptions(compilerOptions, semanticPath));
    });
  }

  return component;
}

// ── 收集使用到的组件名称 ─────────────────────────────

function collectComponentNames(fields) {
  const names = new Set(['Page', 'RootHeader', 'RootContent', 'RootFooter', 'FooterYida', 'FormContainer']);
  fields.forEach(function (field) {
    const componentName = normalizeFieldType(readFieldDefinitionType(field));
    if (componentName) {
      names.add(componentName);
    }
    if (componentName === 'TableField' && field.children) {
      field.children.forEach(function (child) {
        const childComponentName = normalizeFieldType(readFieldDefinitionType(child));
        if (childComponentName) {
          names.add(childComponentName);
        }
      });
    }
  });
  return Array.from(names);
}

// ── 生成 componentsMap ───────────────────────────────

function buildComponentsMap(componentNames) {
  return componentNames.map(function (name) {
    return {
      package: '@ali/vc-deep-yida',
      componentName: name,
    };
  });
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
  fieldComponents.forEach(function (component) {
    const labelText = extractLabelText(component);
    if (labelText && component.props && component.props.fieldId) {
      labelToFieldId[labelText] = component.props.fieldId;
    }
  });

  // 遍历所有 AssociationFormField，解析回填规则中的 @label:xxx 引用
  fieldComponents.forEach(function (component) {
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
            rule.target = resolvedId;
          }
        }
        // 解析 source 中的 @label:xxx 引用
        if (rule.source && typeof rule.source === 'string' && rule.source.startsWith('@label:')) {
          const sourceLabel = rule.source.slice(7);
          const resolvedSourceId = labelToFieldId[sourceLabel];
          if (resolvedSourceId) {
            rule.source = resolvedSourceId;
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
      tableRules.forEach(function (tableRule) {
        if (!tableRule.rules || !Array.isArray(tableRule.rules)) {return;}

        tableRule.rules.forEach(function (rule) {
          if (rule.target && typeof rule.target === 'string' && rule.target.startsWith('@label:')) {
            const targetLabel = rule.target.slice(7);
            const resolvedId = labelToFieldId[targetLabel];
            if (resolvedId) {
              rule.target = resolvedId;
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
function buildGroupedFieldComponents(fields, formLayout, options) {
  const groups = groupFieldsByGroup(fields);

  return groups.map((group, groupIndex) => {
    // 构建分组内的字段组件
    const groupFieldComponents = group.fields.map((field) => buildFieldComponent(field, options));

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

function buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign, options) {
  const compilerOptions = createCompilerOptions(options);
  // 解析布局配置
  const layoutConfig = getLayoutConfig(layout || 'single');
  const columns = layoutConfig.columns;

  // 解析主题配置
  const themeConfig = getThemeConfig(theme || 'default', labelAlign || 'top');
  const formContainerChildren = layoutConfig.groupFields
    ? buildGroupedFieldComponents(fields, layoutConfig.formLayout, compilerOptions)
    : fields.map(function (field) {
      return buildFieldComponent(field, compilerOptions);
    });

  // 为 SerialNumberField 设置 formula（需要 corpId、appType 和 formUuid）
  fillSerialNumberFormulas(formContainerChildren, corpId, appType, formUuid, compilerOptions);

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
  assertNoEmojiInValue(schema, {
    artifact: 'compiled form schema ' + formUuid,
    code: 'OPENYIDA_FORM_SCHEMA_EMOJI_FORBIDDEN',
  });
  return schema;
}

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
        { package: '@ali/vc-deep-yida', componentName: 'RootHeader' },
        { package: '@ali/vc-deep-yida', componentName: 'FormContainer' },
        { package: '@ali/vc-deep-yida', componentName: 'RootContent' },
        { package: '@ali/vc-deep-yida', componentName: 'FooterYida' },
        { package: '@ali/vc-deep-yida', componentName: 'RootFooter' },
        { package: '@ali/vc-deep-yida', componentName: 'Page' },
      ],
    },
    ],
  };
}

function extractLabelText(component) {
  if (!component || !component.props || !component.props.label) {
    return '';
  }
  const label = component.props.label;
  if (typeof label === 'string') {
    return label;
  }
  return label.zh_CN || label.ja_JP || label.en_US || label.pureEn_US || '';
}

function fillSerialNumberFormulas(components, corpId, appType, formUuid, options) {
  const compilerOptions = options || {};
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
          if (typeof compilerOptions.onSerialNumberFormula === 'function') {
            compilerOptions.onSerialNumberFormula(component.props.label && component.props.label.zh_CN || fieldId);
          }
        }
      }
    }
    // 递归处理子表、分组、卡片等容器内的字段
    if (Array.isArray(component.children)) {
      fillSerialNumberFormulas(component.children, corpId, appType, formUuid, compilerOptions);
    }
  });
}

function compileFormDefinition(definition, options) {
  const normalized = normalizeFormDefinition(definition, options);
  if (!Array.isArray(normalized.fields) || normalized.fields.length === 0) {
    throw createFormCompilerError('表单字段定义不能为空', 'FORM_COMPILER_INVALID_DEFINITION');
  }
  const compilerOptions = createCompilerOptions(options);
  const schema = buildFormSchema(
    normalized.formTitle,
    normalized.fields,
    normalized.formUuid,
    normalized.corpId,
    normalized.appType,
    normalized.layout,
    normalized.theme,
    normalized.labelAlign,
    compilerOptions
  );

  return {
    schema,
    fieldBindings: Object.assign({}, compilerOptions.fieldBindings),
    fieldBindingComponents: Object.assign({}, compilerOptions.fieldBindingComponents),
  };
}

module.exports = {
  ASSOCIATION_FORM_FIELD_TYPE,
  FIELD_TYPE_ALIAS,
  OPTION_FIELD_TYPES,
  SUPPORTED_FIELD_TYPES,
  TABLE_FIELD_TYPE,
  i18n,
  compileFormDefinition,
  generateFieldId,
  buildFieldComponent,
  buildFormSchema,
  buildEmptyFormSchema,
  fillSerialNumberFormulas,
  extractLabelText,
  applySelectDataSourceConfig,
  resolveFieldIdReferences,
  normalizeFieldValidationRules,
  collectInputValidationRules,
  dedupeValidationRules,
  normalizeFillingRules,
  inferComponentNameFromFieldId,
  isOptionFieldType,
  isSupportedFieldType,
  normalizeFieldType,
};
