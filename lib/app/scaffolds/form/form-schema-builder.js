'use strict';

const formCompiler = require('../../services/form-compiler');
const formRuntime = require('../../services/form-runtime');
const {
  dedupeValidationRules,
  normalizeFieldValidationRules,
} = require('../../services/form-validation');
const { CANVAS_YIDA_API_METHODS } = require('../../runtime/canvas-yida-api-methods');
const { validateFormDefinition } = require('./form-definition-validator');
const {
  ensureSemanticDividerFields,
  validateFormFieldDefinitions,
} = require('../../form-field-validator');

function createBuilderError(message, code, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details || {};
  return error;
}

function cloneDefinitionValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneDefinitionValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce(function (result, key) {
      result[key] = cloneDefinitionValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function normalizeDataSourceBindings(dataSources) {
  if (Array.isArray(dataSources)) {
    return dataSources;
  }
  if (dataSources && typeof dataSources === 'object') {
    return Object.keys(dataSources).map(function (field) {
      return Object.assign({ field }, dataSources[field]);
    });
  }
  return [];
}

function applyDataSourceBindings(fields, dataSources) {
  const bindings = normalizeDataSourceBindings(dataSources);
  const clonedFields = cloneDefinitionValue(fields || []);
  if (bindings.length === 0) {
    return clonedFields;
  }

  const matched = new Set();
  function visit(items, parentPath) {
    (items || []).forEach(function (field) {
      if (!field || typeof field !== 'object') {return;}
      const key = field.key || field.semanticKey || field.semantic_key || '';
      const path = parentPath && key ? parentPath + '.' + key : key;
      const label = field.label || field.title || '';
      bindings.forEach(function (binding, index) {
        const target = binding.field || binding.fieldKey || binding.semanticPath || binding.target;
        if (!target || (target !== key && target !== path && target !== label)) {return;}
        const config = binding.remoteDataSource || binding.searchDataSource || binding.dataSourceConfig || binding.config || binding.source || binding;
        field.remoteDataSource = cloneDefinitionValue(config);
        matched.add(index);
      });
      if (Array.isArray(field.children)) {
        const childItems = field.children.reduce(function (result, child) {
          return result.concat(Array.isArray(child) ? child : [child]);
        }, []);
        visit(childItems, path || parentPath);
      }
    });
  }
  visit(clonedFields, '');

  const missing = bindings.filter(function (_, index) { return !matched.has(index); });
  if (missing.length > 0) {
    throw createBuilderError(
      '表单数据源未找到目标字段',
      'FORM_SCHEMA_DATASOURCE_FIELD_NOT_FOUND',
      { targets: missing.map(function (item) { return item.field || item.fieldKey || item.semanticPath || item.target || ''; }) }
    );
  }
  return clonedFields;
}

function extractLabel(component) {
  const value = component && component.props && (component.props.label || component.props.title);
  if (typeof value === 'string') {return value;}
  return value && (value.zh_CN || value.en_US || value.ja_JP || value.pureEn_US) || '';
}

function collectSchemaFields(schema) {
  const page = schema.pages && schema.pages[0];
  const byReference = {};
  function visit(component) {
    if (!component || typeof component !== 'object') {return;}
    const fieldId = component.fieldId || (component.props && component.props.fieldId);
    if (fieldId) {
      byReference[fieldId] = component;
      const label = extractLabel(component);
      if (label) {byReference[label] = component;}
    }
    (component.children || []).forEach(visit);
  }
  (page && page.componentsTree || []).forEach(visit);
  const aliases = page && page.componentAlias && page.componentAlias.items || [];
  aliases.forEach(function (item) {
    if (item.alias && byReference[item.fieldId]) {byReference[item.alias] = byReference[item.fieldId];}
  });
  return byReference;
}

function applyDefinitionValidations(schema, validations) {
  const definitions = Array.isArray(validations) ? validations : [];
  if (definitions.length === 0) {return { applied: 0 };}
  const fields = collectSchemaFields(schema);
  let applied = 0;
  definitions.forEach(function (definition, index) {
    const target = definition.field || definition.fieldId || definition.fieldKey || definition.semanticPath || definition.target;
    const component = fields[target];
    if (!component) {
      throw createBuilderError(
        '表单校验未找到目标字段: ' + target,
        'FORM_SCHEMA_VALIDATION_FIELD_NOT_FOUND',
        { index, target }
      );
    }
    const rules = Array.isArray(definition.rules) ? definition.rules : [definition];
    const normalized = normalizeFieldValidationRules({ validations: rules }, { includeAdvanced: true });
    component.props = component.props || {};
    component.props.validation = dedupeValidationRules((component.props.validation || []).concat(normalized));
    applied += normalized.length;
  });
  return { applied };
}

function applyDefinitionRules(schema, rules) {
  if (!Array.isArray(rules) || rules.length === 0) {return { applied: 0 };}
  const createForm = require('../../create-form');
  const applyFormRules = createForm && createForm._private && createForm._private.applyFormRules;
  if (typeof applyFormRules !== 'function') {
    throw createBuilderError('表单规则编译器不可用', 'FORM_SCHEMA_RULE_COMPILER_UNAVAILABLE');
  }
  const result = applyFormRules(schema, rules);
  return { applied: result.rules.length, result };
}

function validateNativeFormScaffold(schema, options) {
  const root = schema && schema.pages && schema.pages[0] && schema.pages[0].componentsTree && schema.pages[0].componentsTree[0];
  const actionSource = schema && schema.actions && schema.actions.module && String(schema.actions.module.source || '');
  const missingMethods = CANVAS_YIDA_API_METHODS.filter(function (methodName) {
    return !actionSource.includes(methodName);
  });
  const missingCapabilities = [];
  if (!root || !root.lifeCycles || !root.lifeCycles.componentDidMount) {missingCapabilities.push('componentDidMount');}
  if (!actionSource.includes('openyidaInstallRuntime')) {missingCapabilities.push('runtime');}
  if (!actionSource.includes('openyida:theme:start')) {missingCapabilities.push('globalTheme');}
  if (!options || options.formDetailPreset !== 'none') {
    if (!actionSource.includes('yida-form-detail-style')) {missingCapabilities.push('formDetailStyle');}
  }
  if (missingMethods.length > 0 || missingCapabilities.length > 0) {
    throw createBuilderError(
      '原生表单脚手架能力不完整',
      'FORM_SCHEMA_SCAFFOLD_INCOMPLETE',
      { missingMethods, missingCapabilities }
    );
  }
  return {
    valid: true,
    apiMethodCount: CANVAS_YIDA_API_METHODS.length,
    lifecycle: root.lifeCycles.componentDidMount.name,
    globalTheme: true,
    formDetailStyle: !options || options.formDetailPreset !== 'none',
  };
}

function buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign, options) {
  const builderOptions = options || {};
  const resolvedFields = applyDataSourceBindings(fields, builderOptions.dataSources);
  const schema = formCompiler.buildFormSchemaCore(
    formTitle,
    resolvedFields,
    formUuid,
    corpId,
    appType,
    layout,
    theme,
    labelAlign,
    builderOptions
  );
  applyDefinitionValidations(schema, builderOptions.validations);
  applyDefinitionRules(schema, builderOptions.rules);
  validateNativeFormScaffold(schema, builderOptions);
  return schema;
}

function buildEmptyFormSchema(options) {
  return formCompiler.buildEmptyFormSchemaCore(options);
}

function compileFormDefinition(definition, options) {
  const validatedDefinition = validateFormDefinition(definition);
  const normalized = formCompiler.normalizeFormDefinition(validatedDefinition, options);
  if (!Array.isArray(normalized.fields) || normalized.fields.length === 0) {
    throw createBuilderError('表单字段定义不能为空', 'FORM_COMPILER_INVALID_DEFINITION');
  }
  normalized.fields = ensureSemanticDividerFields(normalized.fields);
  const layoutDiagnosticCodes = new Set([
    'DIVIDER_TITLE_MISSING',
    'ROOT_DIVIDER_REQUIRED',
    'SEPARATE_DIVIDERS_UNSUPPORTED',
    'TRAILING_DIVIDER_UNSUPPORTED',
    'ADJACENT_DIVIDERS_UNSUPPORTED',
  ]);
  const fieldDiagnostics = validateFormFieldDefinitions(normalized.fields, {
    rootPath: 'fields',
    definition: validatedDefinition,
    requireSemanticDividers: true,
  }).filter(function (diagnostic) {
    return layoutDiagnosticCodes.has(diagnostic.code);
  });
  if (fieldDiagnostics.length > 0) {
    throw createBuilderError(
      '原生表单字段定义不符合分组规范',
      'FORM_DEFINITION_FIELD_INVALID',
      { diagnostics: fieldDiagnostics }
    );
  }
  const fieldBindings = {};
  const fieldBindingComponents = {};
  const builderOptions = Object.assign({}, options, {
    existingBindings: options && options.existingBindings,
    fieldBindings,
    fieldBindingComponents,
    themeTokens: normalized.themeTokens,
    formDetailPreset: normalized.formDetailPreset,
    validations: normalized.validations,
    rules: normalized.rules,
    dataSources: normalized.dataSources,
  });
  const schema = buildFormSchema(
    normalized.formTitle,
    normalized.fields,
    normalized.formUuid,
    normalized.corpId,
    normalized.appType,
    normalized.layout,
    normalized.theme,
    normalized.labelAlign,
    builderOptions
  );
  return {
    schema,
    fieldBindings: Object.assign({}, fieldBindings),
    fieldBindingComponents: Object.assign({}, fieldBindingComponents),
  };
}

function ensureDefaultPresentation(schema, options) {
  const actionSource = schema && schema.actions && schema.actions.module && String(schema.actions.module.source || '');
  const configuredPreset = options && options.formDetailPreset;
  const presetMatch = actionSource.match(/var OPENYIDA_FORM_DETAIL_PRESET = ("(?:\\.|[^"\\])*");/);
  let sourcePreset = '';
  if (presetMatch) {
    try {sourcePreset = JSON.parse(presetMatch[1]);} catch (error) {sourcePreset = '';}
  }
  formRuntime.ensureFormRuntime(schema, options);
  let presentationResult = false;
  if (
    (configuredPreset || sourcePreset || 'clean-card') !== 'none' &&
    !actionSource.includes('yida-form-detail-style')
  ) {
    presentationResult = formCompiler.applyDefaultFormDetailStyle(schema, options);
  }
  validateNativeFormScaffold(schema, options);
  return presentationResult;
}

module.exports = {
  buildEmptyFormSchema,
  buildFormSchema,
  compileFormDefinition,
  ensureDefaultPresentation,
  validateNativeFormScaffold,
  _private: {
    applyDataSourceBindings,
    applyDefinitionRules,
    applyDefinitionValidations,
    collectSchemaFields,
    validateNativeFormScaffold,
  },
};
