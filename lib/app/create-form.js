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
 *   项目根目录下需存在 .cache/cookies.json（由 yida-login 生成）。
 *   若接口返回 302（登录失效），脚本会自动调用 login.py 重新登录后重试。
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
const { loadCookieData, triggerLogin, resolveBaseUrl, httpPost, httpGet, requestWithAutoLogin } = require('../core/utils');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint, listItem } = require('../core/chalk');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const {
  assertLegacyDirectWriteAllowed,
  extractLegacyGuardArgs,
} = require('../core/legacy-schema-guard');
const { default: babelTransform } = require('../core/babel-transform');
const { normalizeFormulaFieldRefs } = require('../formula/evaluate');
const {
  OPTION_FIELD_TYPES,
  i18n,
  compileFormDefinition,
  buildFieldComponent,
  buildEmptyFormSchema,
  fillSerialNumberFormulas,
  extractLabelText,
  normalizeFillingRules,
  applySelectDataSourceConfig,
  resolveFieldIdReferences,
} = require('./services/form-compiler');
const {
  collectInputValidationRules,
  dedupeValidationRules,
  deepMerge,
  defaultValidationMessage,
  normalizeFieldValidationRules,
  normalizeValidationType,
  toDesignerValidationRule,
} = require('./services/form-validation');
const {
  createBlankForm,
  saveFormSchema,
  updateFormConfig,
} = require('./services/form-service');
const { readFormSchema } = require('./services/form-schema-reader');
const { requireSchemaServerRevision } = require('../schema/server-revision');

function throwCreateFormError(message, code, details) {
  throw new CliError(message, {
    code: code || 'CREATE_FORM_FAILED',
    details,
  });
}

// ── 接口路径生成 ──────────────────────────────────────

/**
 * 生成宜搭接口请求路径
 * @param {string} appType - 应用 ID
 * @param {string} apiName - 接口名称，如 'saveFormSchema', 'getFormSchema', 'saveFormSchemaInfo', 'updateFormConfig'
 * @param {Object} options - 可选参数
 * @param {string} options.prefix - 路径前缀，如 '_view'，默认为空
 * @param {string} options.namespace - 命名空间，如 'alibaba' 或 'dingtalk'，默认 'dingtalk'
 * @param {boolean} options.addTimestamp - 是否添加时间戳参数，默认 false
 * @returns {string} 完整的接口路径
 */
function buildApiPath(appType, apiName, options = {}) {
  const { prefix = '', namespace = 'dingtalk', addTimestamp = false } = options;
  const prefixPath = prefix ? `/${prefix}` : '';
  const timestamp = addTimestamp ? `?_stamp=${Date.now()}` : '';
  return `/${namespace}/web/${appType}${prefixPath}/query/formdesign/${apiName}.json${timestamp}`;
}

// ── 参数解析 ─────────────────────────────────────────

function parseArgs(inputArgs) {
  const openOption = parseOpenOption(inputArgs || process.argv.slice(2));
  const guardSplit = extractLegacyGuardArgs(openOption.args);
  const rawArgs = guardSplit.args;

  // 解析可选参数
  const options = {
    layout: 'single',  // 布局：single/double/card/section
    theme: 'default',  // 主题：default/compact/comfortable
    labelAlign: 'top', // 标签对齐：top/left/right
    contentLocale: null,
    browserOpenMode: openOption.mode,
    legacyGuardOptions: guardSplit.guardOptions,
  };

  // 复制一份 args 用于解析（避免修改原始数组影响后续处理）
  const args = [...rawArgs];

  // 解析 --layout, --theme, --label-align, --locale, --force 参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--layout' && i + 1 < args.length) {
      options.layout = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if (args[i] === '--theme' && i + 1 < args.length) {
      options.theme = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if (args[i] === '--label-align' && i + 1 < args.length) {
      options.labelAlign = args[i + 1];
      args.splice(i, 2);
      i--;
    } else if ((args[i] === '--locale' || args[i] === '--content-locale' || args[i] === '--lang') && i + 1 < args.length) {
      options.contentLocale = args[i + 1];
      if (!normalizeYidaLocale(options.contentLocale)) {
        error(`Unsupported locale: ${options.contentLocale}`);
        throwCreateFormError(`Unsupported locale: ${options.contentLocale}`, 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      process.env.OPENYIDA_CONTENT_LOCALE = normalizeYidaLocale(options.contentLocale);
      args.splice(i, 2);
      i--;
    } else if (args[i] === '--force') {
      options.force = true;
      args.splice(i, 1);
      i--;
    }
  }

  const mode = args[0];

  if (mode === 'create') {
    if (args.length < 4) {
      usage(t('create_form.usage_create'), t('create_form.example_create'));
      throwCreateFormError(t('create_form.usage_create'), 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'create',
      appType: args[1],
      formTitle: args[2],
      fieldsJsonOrFile: args[3],
      ...options
    };
  }

  if (mode === 'update') {
    if (args.length < 4) {
      usage(t('create_form.usage_update'), t('create_form.example_update'));
      throwCreateFormError(t('create_form.usage_update'), 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'update',
      appType: args[1],
      formUuid: args[2],
      changesJsonOrFile: args[3],
      ...options
    };
  }

  if (mode === 'patch') {
    if (args.length < 4) {
      usage(
        'openyida create-form patch <appType> <formUuid> <patchJsonOrFile>',
        'openyida create-form patch APP_XXX FORM-XXX .cache/openyida/forms/form-patch.json'
      );
      throwCreateFormError('openyida create-form patch <appType> <formUuid> <patchJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'patch',
      appType: args[1],
      formUuid: args[2],
      patchJsonOrFile: args[3],
      ...options
    };
  }

  if (mode === 'rule' || mode === 'rules') {
    if (args.length < 4) {
      usage(
        'openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>',
        'openyida create-form rule APP_XXX FORM-XXX .cache/openyida/forms/form-rules.json'
      );
      throwCreateFormError('openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'rule',
      appType: args[1],
      formUuid: args[2],
      rulesJsonOrFile: args[3],
      ...options
    };
  }

  if (mode === 'validation' || mode === 'validate' || mode === 'validations') {
    const inlineRule = parseInlineValidationOptions(args.slice(3));
    if (args.length < 4 && !inlineRule) {
      usage(
        'openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>',
        'openyida create-form validation APP_XXX FORM-XXX .cache/openyida/forms/form-validations.json'
      );
      hint('openyida add-validation APP_XXX FORM-XXX --field "手机号" --type phone --message "请输入正确的手机号"');
      throwCreateFormError('openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'validation',
      appType: args[1],
      formUuid: args[2],
      validationJsonOrFile: inlineRule ? '' : args[3],
      inlineValidationRule: inlineRule,
      ...options
    };
  }

  if (mode === 'bind-datasource' || mode === 'datasource' || mode === 'data-source') {
    if (args.length < 5) {
      usage(
        'openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>',
        'openyida create-form bind-datasource APP_XXX FORM-XXX "客户" .cache/openyida/forms/customer-datasource.json'
      );
      throwCreateFormError('openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'bind-datasource',
      appType: args[1],
      formUuid: args[2],
      fieldLabel: args[3],
      dataSourceJsonOrFile: args[4],
      ...options
    };
  }

  if (mode === 'add-option') {
    if (args.length < 5) {
      usage(
        'openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...',
        'openyida create-form add-option APP_XXX FORM-XXX "优先级" "P0" "P1"'
      );
      throwCreateFormError('openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...', 'CREATE_FORM_INVALID_ARGUMENTS');
    }
    return {
      mode: 'add-option',
      appType: args[1],
      formUuid: args[2],
      fieldLabel: args[3],
      newOptions: args.slice(4).filter(function (arg) { return !arg.startsWith('--'); }),
      ...options
    };
  }

  // 兼容旧用法（无 mode 参数，默认 create 模式）
  if (args.length >= 3 && mode !== 'create' && mode !== 'update' && mode !== 'patch' && mode !== 'rule' && mode !== 'rules' && mode !== 'validation' && mode !== 'validate' && mode !== 'validations' && mode !== 'bind-datasource' && mode !== 'datasource' && mode !== 'data-source') {
    return {
      mode: 'create',
      appType: args[0],
      formTitle: args[1],
      fieldsJsonOrFile: args[2],
      ...options
    };
  }

  usage(t('create_form.usage_create_short'));
  hint(t('create_form.usage_update_short'));
  hint(t('create_form.example_create'));
  hint(t('create_form.example_update'));
  throwCreateFormError(t('create_form.usage_create_short'), 'CREATE_FORM_INVALID_ARGUMENTS');
}

// ── 登录态管理 ───────────────────────────────────────




// ── 读取字段定义 ─────────────────────────────────────

function readFieldsDefinition(fieldsJsonOrFile) {
  let rawContent;

  // 判断是 JSON 字符串还是文件路径
  if (fieldsJsonOrFile.trimStart().startsWith('[')) {
    rawContent = fieldsJsonOrFile;
  } else if (fieldsJsonOrFile.trimStart().startsWith('{')) {
    rawContent = fieldsJsonOrFile;
  } else {
    const resolvedPath = path.resolve(fieldsJsonOrFile);
    if (!fs.existsSync(resolvedPath)) {
      error(t('create_form.fields_file_not_found') + resolvedPath);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  }

  try {
    return parseFieldsDefinitionContent(rawContent);
  } catch (parseError) {
    error(t('create_form.fields_parse_failed') + parseError.message);
  }
}

function parseFieldsDefinitionContent(rawContent) {
  const parsed = JSON.parse(rawContent);
  let fields;
  let validations = [];
  let columns = 1;

  if (Array.isArray(parsed)) {
    fields = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    fields = parsed.fields || [];
    columns = parsed.columns !== undefined ? parsed.columns : 1;
    validations = Array.isArray(parsed.validations)
      ? parsed.validations
      : Array.isArray(parsed.rules)
        ? parsed.rules
        : [];
  } else {
    throw new Error(t('create_form.fields_format_invalid'));
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(t('create_form.fields_must_be_array'));
  }

  return { fields, columns, validations };
}

// ── 读取修改定义（update 模式） ─────────────────────

function readChangesDefinition(changesJsonOrFile) {
  let rawContent;

  // 判断是 JSON 字符串还是文件路径
  if (changesJsonOrFile.trimStart().startsWith('[')) {
    rawContent = changesJsonOrFile;
  } else {
    const resolvedPath = path.resolve(changesJsonOrFile);
    if (!fs.existsSync(resolvedPath)) {
      error(t('create_form.changes_file_not_found') + resolvedPath);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  }

  try {
    const changes = JSON.parse(rawContent);
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Error(t('create_form.changes_must_be_array'));
    }
    return changes;
  } catch (parseError) {
    error(t('create_form.changes_parse_failed') + parseError.message);
  }
}

// ── 读取 Schema 补丁定义（patch 模式） ────────────────

function readPatchDefinition(patchJsonOrFile) {
  let rawContent;

  if (patchJsonOrFile.trimStart().startsWith('[') || patchJsonOrFile.trimStart().startsWith('{')) {
    rawContent = patchJsonOrFile;
  } else {
    const resolvedPath = path.resolve(patchJsonOrFile);
    if (!fs.existsSync(resolvedPath)) {
      error('补丁文件不存在: ' + resolvedPath);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  }

  try {
    const patch = JSON.parse(rawContent);
    if (Array.isArray(patch)) {
      if (patch.length === 0) {
        throw new Error('补丁数组不能为空');
      }
      return patch;
    }
    if (patch && typeof patch === 'object') {
      if (Array.isArray(patch.operations)) {
        return patch.operations;
      }
      if (patch.action || patch.op) {
        return [patch];
      }
    }
    throw new Error('补丁必须是数组、{operations: []} 或单个操作对象');
  } catch (parseError) {
    error('补丁 JSON 解析失败: ' + parseError.message);
  }
}

// ── 读取表单联动规则定义（rule 模式） ─────────────────

function readRuleDefinition(rulesJsonOrFile) {
  let rawContent;

  if (rulesJsonOrFile.trimStart().startsWith('[') || rulesJsonOrFile.trimStart().startsWith('{')) {
    rawContent = rulesJsonOrFile;
  } else {
    const resolvedPath = path.resolve(rulesJsonOrFile);
    if (!fs.existsSync(resolvedPath)) {
      error('规则文件不存在: ' + resolvedPath);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        throw new Error('规则数组不能为空');
      }
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.rules)) {
        if (parsed.rules.length === 0) {
          throw new Error('rules 数组不能为空');
        }
        return parsed.rules;
      }
      if (parsed.type || parsed.action || parsed.when || parsed.target || parsed.targets) {
        return [parsed];
      }
    }
    throw new Error('规则必须是数组、{rules: []} 或单个规则对象');
  } catch (parseError) {
    error('规则 JSON 解析失败: ' + parseError.message);
  }
}

function parseMaybeJsonValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function parseInlineValidationOptions(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return null;
  }

  const rule = {};
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token || !token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2).replace(/-/g, '_');
    const next = tokens[index + 1];
    if (next && !next.startsWith('--')) {
      rule[key] = parseMaybeJsonValue(next);
      index++;
    } else {
      rule[key] = true;
    }
  }

  if (!rule.field && !rule.field_id && !rule.label && !rule.target && !rule.type) {
    return null;
  }

  if (rule.field_id && !rule.fieldId) {
    rule.fieldId = rule.field_id;
  }
  if (rule.domain_whitelist && !rule.domainWhitelist) {
    rule.domainWhitelist = String(rule.domain_whitelist).split(',').map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }
  if (rule.compare_to && !rule.compareTo) {
    rule.compareTo = rule.compare_to;
  }
  if (rule.other_field && !rule.otherField) {
    rule.otherField = rule.other_field;
  }

  return rule;
}

function readValidationDefinition(validationJsonOrFile, inlineRule) {
  if (inlineRule) {
    return [inlineRule];
  }

  let rawContent;
  if (validationJsonOrFile.trimStart().startsWith('[') || validationJsonOrFile.trimStart().startsWith('{')) {
    rawContent = validationJsonOrFile;
  } else {
    const resolvedPath = path.resolve(validationJsonOrFile);
    if (!fs.existsSync(resolvedPath)) {
      error('校验规则文件不存在: ' + resolvedPath);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        throw new Error('校验规则数组不能为空');
      }
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.validations)) {
        if (parsed.validations.length === 0) {
          throw new Error('validations 数组不能为空');
        }
        return parsed.validations;
      }
      if (Array.isArray(parsed.rules)) {
        if (parsed.rules.length === 0) {
          throw new Error('rules 数组不能为空');
        }
        return parsed.rules;
      }
      if (parsed.type || parsed.field || parsed.fieldId || parsed.target || parsed.when) {
        return [parsed];
      }
    }
    throw new Error('校验规则必须是数组、{validations: []}、{rules: []} 或单个规则对象');
  } catch (parseError) {
    error('校验规则 JSON 解析失败: ' + parseError.message);
  }
}

// ── 读取字段数据源定义（bind-datasource 模式）─────────

function readDataSourceDefinition(dataSourceJsonOrFile) {
  let rawContent;

  if (dataSourceJsonOrFile.trimStart().startsWith('{')) {
    rawContent = dataSourceJsonOrFile;
  } else {
    const resolvedPath = path.resolve(dataSourceJsonOrFile);
    if (!fs.existsSync(resolvedPath)) {
      error('数据源文件不存在: ' + resolvedPath);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('数据源配置必须是对象');
    }
    return parsed;
  } catch (parseError) {
    error('数据源 JSON 解析失败: ' + parseError.message);
  }
}

// ── 发送 GET 请求（支持 302 自动重登录） ─────────────

function sendGetRequest(baseUrl, cookies, requestPath, queryParams) {
  return httpGet(baseUrl, requestPath, queryParams, cookies);
}

// ── 空白表单 Schema 模板（update 模式） ─────────────

// ── Schema 字段操作辅助函数（update 模式） ──────────

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

function decodeJsonPointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function splitJsonPointer(pointer) {
  if (!pointer || pointer === '/') {
    return [];
  }
  if (pointer.charAt(0) !== '/') {
    throw new Error('JSON Pointer 必须以 / 开头: ' + pointer);
  }
  return pointer.split('/').slice(1).map(decodeJsonPointerSegment);
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

const FORM_RULES_BLOCK_START = '/* openyida:form-rules:start */';
const FORM_RULES_BLOCK_END = '/* openyida:form-rules:end */';

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
  if (!Array.isArray(fields)) {
    return descriptors;
  }
  fields.forEach(function (field) {
    const props = field.props || {};
    const fieldId = props.fieldId || field.fieldId || '';
    if (fieldId) {
      descriptors.push({
        fieldId,
        alias: aliasByFieldId && aliasByFieldId[fieldId] || '',
        label: extractLabelText(field),
        componentName: field.componentName || '',
        nodeId: field.id || '',
        field,
      });
    }
    collectFieldDescriptors(field.children, descriptors, aliasByFieldId);
  });
  return descriptors;
}

function buildFieldLookup(fields, page) {
  const aliasMaps = buildComponentAliasMaps(page);
  const descriptors = collectFieldDescriptors(fields, [], aliasMaps.aliasByFieldId);
  const byRef = {};
  descriptors.forEach(function (descriptor) {
    byRef[descriptor.fieldId] = descriptor;
    if (descriptor.alias) {
      byRef[descriptor.alias] = descriptor;
    }
    if (descriptor.label) {
      byRef[descriptor.label] = descriptor;
    }
  });
  return { descriptors, byRef, aliasByFieldId: aliasMaps.aliasByFieldId, fieldIdByAlias: aliasMaps.fieldIdByAlias };
}

function resolveRuleField(fieldLookup, fieldRef, role) {
  if (!fieldRef || typeof fieldRef !== 'string') {
    throw new Error(role + ' 缺少字段引用');
  }
  const found = fieldLookup.byRef[fieldRef];
  if (!found) {
    const availableFields = fieldLookup.descriptors
      .map(function (descriptor) { return descriptor.alias || descriptor.label || descriptor.fieldId; })
      .filter(Boolean)
      .join(', ');
    throw new Error('未找到' + role + ': ' + fieldRef + (availableFields ? '；可用字段: ' + availableFields : ''));
  }
  return found;
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
  const fieldDescriptor = resolveRuleField(fieldLookup, condition.field, role || '条件字段');
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
  const fallbackFieldRef = rule.source || rule.field || rule.on;
  const condition = normalizeRuntimeCondition(
    fieldLookup,
    extractCondition(rule, fallbackFieldRef, rule.equals),
    '条件字段'
  );
  if (condition.operator === 'always') {
    throw new Error('显隐规则[' + (index + 1) + '] 必须提供 source/when.field');
  }

  const targetRefs = [];
  if (Array.isArray(rule.targets)) {
    targetRefs.push(...rule.targets);
  } else if (rule.target) {
    targetRefs.push(rule.target);
  }
  if (rule.then && typeof rule.then === 'object' && rule.then.field) {
    targetRefs.push(rule.then.field);
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
  const conditionSource = rule.when && typeof rule.when === 'object' ? rule.when.field || rule.when.source : '';
  const sourceRef = rule.on || rule.source || conditionSource || rule.field || rule.from;
  const hasExplicitCondition = !!rule.when ||
    hasOwn(rule, 'operator') ||
    hasOwn(rule, 'op') ||
    hasOwn(rule, 'equals') ||
    hasOwn(rule, 'notEquals') ||
    hasOwn(rule, 'values') ||
    hasOwn(rule, 'empty') ||
    hasOwn(rule, 'notEmpty');
  const condition = hasExplicitCondition
    ? normalizeRuntimeCondition(fieldLookup, extractCondition(rule, sourceRef), '条件字段')
    : { operator: 'always' };
  const targetDescriptor = resolveRuleField(fieldLookup, rule.target || rule.fieldId, '目标字段');

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
    normalized.fromFieldId = resolveRuleField(fieldLookup, rule.from, '来源字段').fieldId;
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
  };
}

// ── 表单智能校验（validation 模式 / add-validation）──────────────────

const SMART_VALIDATION_BLOCK_START = '/* openyida:smart-validation:start */';
const SMART_VALIDATION_BLOCK_END = '/* openyida:smart-validation:end */';

function normalizeSmartValidationCondition(fieldLookup, condition) {
  if (!condition || typeof condition !== 'object') {
    return null;
  }
  return normalizeRuntimeCondition(fieldLookup, condition, '条件字段');
}

function resolveSmartRuleField(fieldLookup, rule, role) {
  const fieldRef = rule.fieldId || rule.field || rule.label || rule.target || rule.name;
  return resolveRuleField(fieldLookup, fieldRef, role || '校验字段');
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
    }));
  });

  return {
    rules: normalized.rules,
    appliedRules,
    skippedRules,
    cleanup,
  };
}

function collectSmartValidationRulesFromFields(fields, output) {
  const rules = output || [];
  (fields || []).forEach(function (field) {
    const fieldRules = collectInputValidationRules(field, { includeAdvanced: true });
    const fieldLabel = field.label;
    fieldRules.forEach(function (rule) {
      if (rule.type === 'required' && !field.required && !field.validation && !field.validations) {
        return;
      }
      rules.push(Object.assign({ field: fieldLabel }, rule));
    });
    if (field.type === 'TableField' && Array.isArray(field.children)) {
      collectSmartValidationRulesFromFields(field.children, rules);
    }
  });
  return rules;
}

function applyFieldChanges(component, changes) {
  const props = component.props;

  // 需要特殊处理的属性 key 集合（不走通用透传）
  const specialKeys = ['label', 'required', 'validation', 'validations', 'pattern', 'regex', 'placeholder', 'options', 'dataSource', 'associationForm',
    'linkageFields', 'mainFieldId', 'mainComponentName', 'mainFieldLabel',
    'subFieldId', 'subComponentName', 'dataFillingRules',
    'remoteDataSource', 'searchDataSource', 'dataSourceConfig', 'dataSourceUrl',
    'searchConfig', 'dataType', 'beforeFetch', 'afterFetch', 'queryParam',
    'listPath', 'labelField', 'valueField', 'filterLocal', 'showSearch',
    'dataSourceType', 'notFoundContent'];

  // ── 特殊处理：label（需要 i18n 包装）
  if (changes.label !== undefined) {
    props.label = i18n(changes.label, component.componentName);
  }

  // ── 特殊处理：required（操作 validation 数组）
  if (changes.required !== undefined) {
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
  if (changes.validation !== undefined || changes.validations !== undefined) {
    props.validation = normalizeFieldValidationRules({
      required: changes.required,
      validation: changes.validation !== undefined ? changes.validation : changes.validations,
    });
  }

  if (changes.pattern !== undefined || changes.regex !== undefined) {
    props.validation = dedupeValidationRules((props.validation || []).concat(normalizeFieldValidationRules({
      pattern: changes.pattern !== undefined ? changes.pattern : changes.regex,
      message: changes.message,
    })));
  }

  // ── 特殊处理：placeholder（需要 i18n 包装）
  if (changes.placeholder !== undefined) {
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

// ── 应用修改操作（update 模式） ─────────────────────

function applyChangesToSchema(schema, changes) {
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

  changes.forEach(function (change, changeIndex) {
    const actionDesc = t('create_form.action_label', changeIndex + 1, change.action);

    if (change.action === 'add') {
      if (!change.field || !change.field.type || !change.field.label) {
        warn(actionDesc + t('create_form.add_missing_field'));
        return;
      }

      const newComponent = buildFieldComponent(change.field);
      ensureComponentsMap(schema, change.field.type);

      if (change.field.type === 'TableField' && change.field.children) {
        change.field.children.forEach(function (childField) {
          ensureComponentsMap(schema, childField.type);
        });
      }

      if (change.after) {
        const afterIndex = findFieldIndexByLabel(formFields, change.after);
        if (afterIndex !== -1) {
          formFields.splice(afterIndex + 1, 0, newComponent);
          success(actionDesc + t('create_form.add_after_ok', change.after, change.field.label, change.field.type));
        } else {
          formFields.push(newComponent);
          warn(actionDesc + t('create_form.add_after_not_found', change.after, change.field.label));
        }
      } else if (change.before) {
        const beforeIndex = findFieldIndexByLabel(formFields, change.before);
        if (beforeIndex !== -1) {
          formFields.splice(beforeIndex, 0, newComponent);
          success(actionDesc + t('create_form.add_before_ok', change.before, change.field.label, change.field.type));
        } else {
          formFields.push(newComponent);
          warn(actionDesc + t('create_form.add_before_not_found', change.before, change.field.label));
        }
      } else {
        formFields.push(newComponent);
        success(actionDesc + t('create_form.add_ok', change.field.label, change.field.type));
      }

      appliedChanges.push({ action: 'add', label: change.field.label, type: change.field.type });

    } else if (change.action === 'delete') {
      if (!change.label) {
        warn(actionDesc + t('create_form.delete_missing_label'));
        return;
      }

      const deleteIndex = findFieldIndexByLabel(formFields, change.label);
      if (deleteIndex !== -1) {
        formFields.splice(deleteIndex, 1);
        success(actionDesc + t('create_form.delete_ok', change.label));
        appliedChanges.push({ action: 'delete', label: change.label });
      } else {
        warn(actionDesc + t('create_form.delete_not_found', change.label));
      }

    } else if (change.action === 'update') {
      if (!change.label) {
        warn(actionDesc + t('create_form.update_missing_label'));
        return;
      }
      if (!change.changes || Object.keys(change.changes).length === 0) {
        warn(actionDesc + t('create_form.update_missing_changes'));
        return;
      }

      // 支持通过 tableLabel 指定父子表，在子表 children 中查找字段
      let searchFields = formFields;
      let locationDesc = '';
      if (change.tableLabel) {
        const tableResult = findFieldByLabelDeep(formFields, change.tableLabel);
        if (!tableResult) {
          warn(actionDesc + t('create_form.update_table_not_found', change.tableLabel));
          return;
        }
        const tableComponent = tableResult.field;
        if (tableComponent.componentName !== 'TableField' || !tableComponent.children) {
          warn(actionDesc + t('create_form.update_not_table', change.tableLabel));
          return;
        }
        searchFields = tableComponent.children;
        locationDesc = t('create_form.in_table', change.tableLabel);
      }

      const updateResult = findFieldByLabelDeep(searchFields, change.label);
      if (updateResult) {
        applyFieldChanges(updateResult.field, change.changes);
        const changedProps = Object.keys(change.changes).join(', ');
        success(actionDesc + t('create_form.update_ok', locationDesc, change.label, changedProps));
        appliedChanges.push({ action: 'update', label: change.label, tableLabel: change.tableLabel || null, changedProps: changedProps });
      } else {
        warn(actionDesc + t('create_form.update_not_found', locationDesc, change.label));
      }

    } else {
      warn(actionDesc + t('create_form.unknown_action', change.action));
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
  return appliedChanges;
}

// Kept as legacy shared-helper compatibility surface.
// eslint-disable-next-line no-unused-vars
function sendPostRequest(baseUrl, csrfToken, cookies, requestPath, extraParams, formUuid) {
  const postData = querystring.stringify(
    Object.assign({ _csrf_token: csrfToken }, extraParams)
  );
  const referer = formUuid
    ? `${baseUrl}/alibaba/web/${extraParams.appType || ''}/design/pageDesigner?formUuid=${formUuid}`
    : baseUrl + '/';
  return httpPost(baseUrl, requestPath, postData, cookies, { referer });
}

// Kept as legacy shared-helper compatibility surface.
// eslint-disable-next-line no-unused-vars
function sendUpdateConfigRequest(baseUrl, csrfToken, cookies, appType, formUuid, version, value) {
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formUuid: formUuid,
    version: version,
    configType: 'MINI_RESOURCE',
    value: value,
  });
  return httpPost(
    baseUrl,
    `/dingtalk/web/${appType}/query/formdesign/updateFormConfig.json`,
    postData,
    cookies
  );
}

// ── 登录态辅助：从 cookieData 中提取 corpId ──────────

function resolveCorpId(cookieData) {
  // 优先使用已提取的 corp_id 字段
  if (cookieData.corp_id) {return cookieData.corp_id;}
  // 从 tianshu_corp_user Cookie 中提取（格式："{corpId}_{userId}"）
  if (cookieData.cookies) {
    const corpUserCookie = cookieData.cookies.find(function (c) {
      return c.name === 'tianshu_corp_user';
    });
    if (corpUserCookie && corpUserCookie.value) {
      const lastUnderscore = corpUserCookie.value.lastIndexOf('_');
      if (lastUnderscore > 0) {
        return corpUserCookie.value.slice(0, lastUnderscore);
      }
    }
  }
  return '';
}

function serialNumberFormulaLogOptions() {
  return {
    onSerialNumberFormula(fieldLabel) {
      info(t('create_form.serial_number_formula_set', fieldLabel));
    },
  };
}

// ── 保存 Schema 并更新表单配置（create/update 共用）──
//
// 封装 saveFormSchema + updateFormConfig；Schema save 只发送一次，config 保持 legacy 行为。
// 返回 { saveResult, configResult }。

async function saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, stepOffset, revisionInput) {
  const saveStep = stepOffset || 4;
  const configStep = saveStep + 1;

  const fixedRefs = normalizeFormulaFieldRefs(schema);
  if (fixedRefs > 0) {
    info(t('create_form.formula_prefix_fixed', fixedRefs));
  }

  step(saveStep, t('create_form.step_save_schema', saveStep));
  info(t('create_form.sending_save'));

  let saveResult;
  try {
    const serverRevision = requireLegacySchemaServerRevision({ gmtModified: revisionInput });
    saveResult = (await saveFormSchema(authRef, {
      appType,
      formUuid,
      schema,
      schemaVersion: 'V5',
      normalizeFormulaRefs: false,
      serverRevision,
    })).saveResult;
  } catch (serviceError) {
    saveResult = serviceError && serviceError.details && serviceError.details.result;
    if (!saveResult) {
      throw serviceError;
    }
  }

  if (!saveResult || !saveResult.success) {
    const saveErrorMsg = saveResult ? saveResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.save_schema_failed', saveErrorMsg));
    if (saveResult && !saveResult.__needLogin) {
      hint(t('common.response_detail', JSON.stringify(saveResult, null, 2)));
    }
    console.log(JSON.stringify({ success: false, formUuid: formUuid, error: saveErrorMsg }));
    throwCreateFormError(saveErrorMsg, 'CREATE_FORM_SAVE_SCHEMA_FAILED', {
      appType,
      formUuid,
      result: saveResult,
    });
  }

  success(t('create_form.schema_saved'));
  if (version !== undefined) {
    label('Version:', String(version));
  }

  step(configStep, t('create_form.step_update_config', configStep));
  info(t('create_form.sending_config'));

  const { configResult } = await updateFormConfig(authRef, {
    appType,
    formUuid,
    version: version || 1,
    value: 0,
  });

  return { saveResult: saveResult, configResult: configResult };
}

function requireLegacySchemaServerRevision(value) {
  return requireSchemaServerRevision(value, () => new CliError('远端 Schema revision 缺失或无效', {
    code: 'CREATE_FORM_SCHEMA_REVISION_INVALID',
  }));
}

// ── create 模式主流程 ─────────────────────────────────

async function createFormForLegacyProcess(context, input) {
  const authRef = context && context.authRef ? context.authRef : context;
  const rawContent = fs.readFileSync(input.fieldsJsonFile, 'utf-8');
  const parsed = parseFieldsDefinitionContent(rawContent);
  const blank = await createBlankForm(authRef, {
    appType: input.appType,
    formTitle: input.formTitle,
    formType: 'receipt',
  });
  const corpId = input.corpId || authRef.corpId || resolveCorpId(authRef.cookieData || {});
  const compiled = compileFormDefinition({
    formTitle: input.formTitle,
    fields: parsed.fields,
    formUuid: blank.formUuid,
    corpId,
    appType: input.appType,
    layout: input.layout,
    theme: input.theme,
    labelAlign: input.labelAlign,
  });
  const validationRules = collectSmartValidationRulesFromFields(parsed.fields)
    .concat(parsed.validations || []);
  if (validationRules.length > 0) {
    applySmartValidations(compiled.schema, validationRules);
  }
  normalizeFormulaFieldRefs(compiled.schema);
  const shellSchemaResult = await readFormSchema(authRef, {
    appType: input.appType,
    formUuid: blank.formUuid,
  });
  const saved = await saveFormSchema(authRef, {
    appType: input.appType,
    formUuid: blank.formUuid,
    schema: compiled.schema,
    schemaVersion: 'V5',
    normalizeFormulaRefs: false,
    serverRevision: requireSchemaServerRevision(shellSchemaResult),
  });
  const configured = await updateFormConfig(authRef, {
    appType: input.appType,
    formUuid: blank.formUuid,
    version: 1,
    value: 0,
    strict: false,
  });

  return {
    success: true,
    formUuid: blank.formUuid,
    formTitle: input.formTitle,
    appType: input.appType,
    fieldCount: parsed.fields.length,
    createResult: blank.createResult,
    saveResult: saved.saveResult,
    configResult: configured.configResult,
  };
}

async function mainCreate(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formTitle, fieldsJsonOrFile, layout, theme, labelAlign } = parsedArgs;

  banner(t('create_form.create_title'));
  label('App ID:', appType);
  label('Title:', formTitle);
  label('Fields:', fieldsJsonOrFile);

  // 登录态引用对象，供 requestWithAutoLogin 原地更新
  const authRef = { csrfToken: csrfToken, cookies: cookies, baseUrl: baseUrl, cookieData: cookieData };

  step(2, t('create_form.step_read_fields', 2));
  const { fields, columns, validations } = readFieldsDefinition(fieldsJsonOrFile);
  success(t('create_form.fields_loaded', fields.length));
  label('Columns:', String(columns));
  fields.forEach(function (field, index) {
    listItem((index + 1) + '. ' + field.type + ': ' + field.label);
  });

  step(3, t('create_form.step_create_blank', 3));
  info(t('create_form.sending_create'));
  let createResult;
  let formUuid;
  try {
    const created = await createBlankForm(authRef, {
      appType,
      formTitle,
      formType: 'receipt',
    });
    createResult = created.createResult;
    formUuid = created.formUuid;
  } catch (serviceError) {
    createResult = serviceError && serviceError.details && serviceError.details.result;
    if (!createResult) {
      throw serviceError;
    }
  }

  if (!createResult || !createResult.success || !createResult.content) {
    const errorMsg = createResult ? createResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.create_blank_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_CREATE_BLANK_FAILED', {
      appType,
      result: createResult,
    });
  }

  success(t('create_form.blank_created', formUuid));

  // Step 4 & 5: 生成 Schema 并保存，然后更新表单配置
  const corpId = resolveCorpId(authRef.cookieData);
  if (!corpId) {
    warn(t('create_form.no_corp_id_warning'));
  } else {
    info(t('create_form.corp_id_ok', corpId));
  }

  const compiled = compileFormDefinition({
    formTitle,
    fields,
    formUuid,
    corpId,
    appType,
    layout,
    theme,
    labelAlign,
  }, serialNumberFormulaLogOptions());
  const schema = compiled.schema;
  const createValidationRules = collectSmartValidationRulesFromFields(fields).concat(validations || []);
  if (createValidationRules.length > 0) {
    const appliedValidations = applySmartValidations(schema, createValidationRules);
    info('已为创建表单写入 ' + appliedValidations.appliedRules.length + ' 条字段校验');
  }
  const shellSchemaResult = await readFormSchema(authRef, { appType, formUuid });
  const { configResult } = await saveSchemaAndUpdateConfig(
    authRef,
    appType,
    formUuid,
    schema,
    1,
    4,
    requireLegacySchemaServerRevision(shellSchemaResult)
  );

  // 输出结果
  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, t('create_form.create_success'), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
    ]);
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, formUuid, formTitle, appType, fieldCount: fields.length, url: formUrl },
      formUrl,
      { stage: 'create_form_success', title: formTitle },
      parsedArgs.browserOpenMode
    )));
  } else {
    const configErrorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('create_form.config_failed', configErrorMsg), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
    ]);
    hint(t('create_form.schema_ok_config_failed'));
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, formUuid, formTitle, appType, fieldCount: fields.length, url: formUrl, configWarning: configErrorMsg },
      formUrl,
      { stage: 'create_form_success', title: formTitle },
      parsedArgs.browserOpenMode
    )));
  }
}

// ── 为 SerialNumberField 补全 formula（递归处理子表）──
//
// 遍历字段列表，对每个 SerialNumberField：
//   - 若 formula 已有有效的 expression（从宜搭获取的已有字段），则跳过，不覆盖
//   - 若 formula 为空对象 {} 或 expression 为空（新增字段），则自动构建 expression
// 同时递归处理 TableField 的子字段（子表内也可能有流水号字段）

// ── add-option 模式主流程 ──────────────────────────────
//
// 语法糖：向选项类字段（SelectField/RadioField/CheckboxField/MultiSelectField）
// 追加一个或多个选项，无需手写完整的 update changes JSON。
//
// 流程：getSchema → 定位目标字段 → 在 dataSource 末尾追加新选项 → saveSchema

async function mainAddOption(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formUuid, fieldLabel, newOptions } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Field:', fieldLabel);
  label('New Options:', newOptions.join(', '));

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  // Step 2: 获取 Schema
  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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
  const serverRevision = requireLegacySchemaServerRevision(schemaResult);

  let schema;
  let version = 1;
  if (schemaResult.content && typeof schemaResult.content === 'object' && schemaResult.content.version !== undefined) {
    version = schemaResult.content.version;
  } else if (schemaResult.version !== undefined) {
    version = schemaResult.version;
  }
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

  const fieldIndex = findFieldIndexByLabel(formContainer.children, fieldLabel);
  if (fieldIndex === -1) {
    fail('未找到字段: ' + fieldLabel);
    const allLabels = formContainer.children.map(function (child) { return extractLabelText(child); }).filter(Boolean);
    hint('可用字段: ' + allLabels.join(', '));
    console.log(JSON.stringify({ success: false, error: 'field_not_found', fieldLabel, availableFields: allLabels }));
    throwCreateFormError('field_not_found', 'CREATE_FORM_FIELD_NOT_FOUND', {
      appType,
      formUuid,
      fieldLabel,
      availableFields: allLabels,
    });
  }

  const targetComponent = formContainer.children[fieldIndex];
  if (OPTION_FIELD_TYPES.indexOf(targetComponent.componentName) === -1) {
    fail(fieldLabel + ' 不是选项类字段（当前类型: ' + targetComponent.componentName + '）');
    hint('add-option 仅支持: ' + OPTION_FIELD_TYPES.join(', '));
    console.log(JSON.stringify({ success: false, error: 'not_option_field', componentName: targetComponent.componentName }));
    throwCreateFormError('not_option_field', 'CREATE_FORM_NOT_OPTION_FIELD', {
      appType,
      formUuid,
      fieldLabel,
      componentName: targetComponent.componentName,
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
  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4, serverRevision);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, '选项追加成功', [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['Added', addedOptions.join(', ')],
      ['Total Options', String(existingDataSource.length)],
    ]);
  }

  console.log(JSON.stringify({
    success: true,
    formUuid, appType, fieldLabel,
    fieldId: props.fieldId || '',
    componentName: targetComponent.componentName,
    added: addedOptions,
    skipped: skippedOptions,
    totalOptions: existingDataSource.length,
    url: formUrl,
  }));
}

// ── bind-datasource 模式：给选项类字段绑定远程搜索数据源 ──

async function mainBindDataSource(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formUuid, fieldLabel, dataSourceJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Field:', fieldLabel);
  label('Data Source:', dataSourceJsonOrFile);

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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
  const serverRevision = requireLegacySchemaServerRevision(schemaResult);

  let schema;
  let version = 1;
  if (schemaResult.content && typeof schemaResult.content === 'object' && schemaResult.content.version !== undefined) {
    version = schemaResult.content.version;
  } else if (schemaResult.version !== undefined) {
    version = schemaResult.version;
  }
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

  const found = findFieldByIdOrLabelDeep(formContainer.children, fieldLabel);
  if (!found) {
    const allFields = collectFieldDescriptors(formContainer.children)
      .map(function (field) { return field.label || field.fieldId; })
      .filter(Boolean);
    fail('未找到字段: ' + fieldLabel);
    hint('可用字段: ' + allFields.join(', '));
    console.log(JSON.stringify({ success: false, error: 'field_not_found', fieldLabel, availableFields: allFields }));
    throwCreateFormError('field_not_found', 'CREATE_FORM_FIELD_NOT_FOUND', {
      appType,
      formUuid,
      fieldLabel,
      availableFields: allFields,
    });
  }

  const targetComponent = found.field;
  if (OPTION_FIELD_TYPES.indexOf(targetComponent.componentName) === -1) {
    fail(fieldLabel + ' 不是选项类字段（当前类型: ' + targetComponent.componentName + '）');
    hint('bind-datasource 仅支持: ' + OPTION_FIELD_TYPES.join(', '));
    console.log(JSON.stringify({ success: false, error: 'not_option_field', componentName: targetComponent.componentName }));
    throwCreateFormError('not_option_field', 'CREATE_FORM_NOT_OPTION_FIELD', {
      appType,
      formUuid,
      fieldLabel,
      componentName: targetComponent.componentName,
    });
  }

  targetComponent.props = targetComponent.props || {};
  const dataSourceConfig = readDataSourceDefinition(dataSourceJsonOrFile);
  const normalized = applySelectDataSourceConfig(targetComponent.props, dataSourceConfig);
  success('字段数据源已绑定');
  label('URL:', normalized.url || '(仅初始化选项)');
  label('Options:', String(normalized.options.length));

  const corpId = resolveCorpId(authRef.cookieData);
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid, serialNumberFormulaLogOptions());
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4, serverRevision);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, '字段数据源保存成功', [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['URL', normalized.url || '-'],
      ['Options', String(normalized.options.length)],
    ]);
  } else {
    const configErrorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('create_form.config_failed', configErrorMsg), [
      ['Form UUID', formUuid],
      ['Field', fieldLabel],
      ['URL', normalized.url || '-'],
    ]);
    hint(t('create_form.schema_ok_config_failed'));
  }

  console.log(JSON.stringify(withBrowserHandoff(
    {
      success: true,
      formUuid,
      appType,
      fieldLabel,
      fieldId: targetComponent.props.fieldId || '',
      componentName: targetComponent.componentName,
      url: normalized.url,
      options: normalized.options.length,
      filterLocal: targetComponent.props.filterLocal,
      pageUrl: formUrl,
    },
    formUrl,
    { stage: 'bind_datasource_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── rule 模式主流程：声明式字段联动 / 自动赋值 ─────────

async function mainRule(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formUuid, rulesJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Rules:', rulesJsonOrFile);

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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
  const serverRevision = requireLegacySchemaServerRevision(schemaResult);

  let schema;
  let version = 1;
  if (schemaResult.content && typeof schemaResult.content === 'object' && schemaResult.content.version !== undefined) {
    version = schemaResult.content.version;
  } else if (schemaResult.version !== undefined) {
    version = schemaResult.version;
  }

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

  const corpId = resolveCorpId(authRef.cookieData);
  const formContainer = schema.pages && schema.pages[0] && schema.pages[0].componentsTree
    ? findFormContainer(schema.pages[0].componentsTree[0])
    : null;
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid, serialNumberFormulaLogOptions());
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4, serverRevision);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, '表单联动规则保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Rules', String(applied.rules.length)],
    ]);
  } else {
    const configErrorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('create_form.config_failed', configErrorMsg), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Rules', String(applied.rules.length)],
    ]);
    hint(t('create_form.schema_ok_config_failed'));
  }

  console.log(JSON.stringify(withBrowserHandoff(
    {
      success: true,
      formUuid,
      appType,
      rulesApplied: applied.rules.length,
      eventBindings: applied.bindings.map(function (binding) {
        return {
          fieldId: binding.fieldId,
          label: binding.label,
          event: binding.eventName,
          actionName: binding.wrapperName,
        };
      }),
      url: formUrl,
    },
    formUrl,
    { stage: 'form_rules_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── patch 模式主流程 ──────────────────────────────────

async function mainPatch(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formUuid, patchJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Patch:', patchJsonOrFile);

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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
  const serverRevision = requireLegacySchemaServerRevision(schemaResult);

  let schema;
  let version = 1;
  if (schemaResult.content && typeof schemaResult.content === 'object' && schemaResult.content.version !== undefined) {
    version = schemaResult.content.version;
  } else if (schemaResult.version !== undefined) {
    version = schemaResult.version;
  }

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

  const corpId = resolveCorpId(authRef.cookieData);
  const formContainer = schema.pages && schema.pages[0] && schema.pages[0].componentsTree
    ? findFormContainer(schema.pages[0].componentsTree[0])
    : null;
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid, serialNumberFormulaLogOptions());
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4, serverRevision);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, 'Schema 补丁保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Operations', String(appliedOperations.length)],
    ]);
  } else {
    const configErrorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('create_form.config_failed', configErrorMsg), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Operations', String(appliedOperations.length)],
    ]);
    hint(t('create_form.schema_ok_config_failed'));
  }

  console.log(JSON.stringify(withBrowserHandoff(
    { success: true, formUuid, appType, operationsApplied: appliedOperations.length, operations: appliedOperations, url: formUrl },
    formUrl,
    { stage: 'patch_form_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── validation 模式主流程：字段原生校验 ───────────────

async function mainValidation(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formUuid, validationJsonOrFile, inlineValidationRule } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Validation:', inlineValidationRule ? JSON.stringify(inlineValidationRule) : validationJsonOrFile);

  const authRef = { csrfToken, cookies, baseUrl, cookieData };

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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
  const serverRevision = requireLegacySchemaServerRevision(schemaResult);

  let schema;
  let version = 1;
  if (schemaResult.content && typeof schemaResult.content === 'object' && schemaResult.content.version !== undefined) {
    version = schemaResult.content.version;
  } else if (schemaResult.version !== undefined) {
    version = schemaResult.version;
  }

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

  const corpId = resolveCorpId(authRef.cookieData);
  const formContainer = schema.pages && schema.pages[0] && schema.pages[0].componentsTree
    ? findFormContainer(schema.pages[0].componentsTree[0])
    : null;
  if (formContainer && formContainer.children) {
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid, serialNumberFormulaLogOptions());
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4, serverRevision);

  const formUrl = authRef.baseUrl + '/' + appType + '/workbench/' + formUuid;
  if (configResult && configResult.success) {
    result(true, '智能校验规则保存成功', [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Validations', String(applied.appliedRules.length)],
    ]);
  } else {
    const configErrorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('create_form.config_failed', configErrorMsg), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Validations', String(applied.appliedRules.length)],
    ]);
    hint(t('create_form.schema_ok_config_failed'));
  }

  console.log(JSON.stringify(withBrowserHandoff(
    {
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
        };
      }),
      url: formUrl,
    },
    formUrl,
    { stage: 'validation_form_success', title: formUuid },
    parsedArgs.browserOpenMode
  )));
}

// ── update 模式主流程 ─────────────────────────────────

async function mainUpdate(parsedArgs, csrfToken, cookies, baseUrl, cookieData) {
  const { appType, formUuid, changesJsonOrFile } = parsedArgs;

  banner(t('create_form.update_title'));
  label('App ID:', appType);
  label('Form UUID:', formUuid);
  label('Changes:', changesJsonOrFile);

  // 登录态引用对象，供 requestWithAutoLogin 原地更新
  const authRef = { csrfToken: csrfToken, cookies: cookies, baseUrl: baseUrl, cookieData: cookieData };

  step(2, t('create_form.step_get_schema', 2));
  info(t('create_form.sending_get_schema'));
  const schemaResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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
  const serverRevision = requireLegacySchemaServerRevision(schemaResult);

  // 从返回结果中提取 schema 内容和版本号
  let schema;
  let version = 1;

  if (schemaResult.content && typeof schemaResult.content === 'object' && schemaResult.content.version !== undefined) {
    version = schemaResult.content.version;
  } else if (schemaResult.version !== undefined) {
    version = schemaResult.version;
  }

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
    formContainer.children.forEach(function (child, childIndex) {
      const labelText = extractLabelText(child);
      listItem((childIndex + 1) + '. ' + child.componentName + ': ' + labelText);
    });
  } else {
    warn(t('create_form.schema_got_empty'));
  }

  step(3, t('create_form.step_check_data', 3));
  const dataCheckResult = await requestWithAutoLogin(function (auth) {
    return sendGetRequest(
      auth.baseUrl, auth.cookies,
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

  step(4, t('create_form.step_read_changes', 4));
  const changes = readChangesDefinition(changesJsonOrFile);
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

  step(5, t('create_form.step_apply_changes', 5));
  const appliedChanges = applyChangesToSchema(schema, changes);

  // 为 SerialNumberField 补全 formula（若尚未设置）
  const corpId = resolveCorpId(authRef.cookieData);
  if (!corpId) {
    warn(t('create_form.no_corp_id_warning'));
  }

  const formContainerUpdate = findFormContainer(schema.pages[0].componentsTree[0]);
  if (formContainerUpdate && formContainerUpdate.children) {
    fillSerialNumberFormulas(formContainerUpdate.children, corpId, appType, formUuid, serialNumberFormulaLogOptions());
  }

  // Step 6 & 7: 保存 Schema 并更新表单配置
  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 6, serverRevision);

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
    const configErrorMsg = configResult ? configResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    result(false, t('create_form.config_failed', configErrorMsg), [
      ['Form UUID', formUuid],
      ['URL', formUrl],
      ['Changes', String(appliedChanges.length)],
    ]);
    hint(t('create_form.schema_ok_config_failed'));
    console.log(JSON.stringify(withBrowserHandoff(
      { success: true, formUuid, appType, changesApplied: appliedChanges.length, changes: appliedChanges, url: formUrl, configWarning: configErrorMsg },
      formUrl,
      { stage: 'update_form_success', title: formUuid },
      parsedArgs.browserOpenMode
    )));
  }
}

// ── 主入口 ────────────────────────────────────────────

async function run(args) {
  const parsedArgs = parseArgs(args);
  assertLegacyDirectWriteAllowed({
    command: `create-form ${parsedArgs.mode}`,
    resourceType: 'form',
    action: parsedArgs.mode === 'create' ? 'create' : 'update',
    appType: parsedArgs.appType,
    formUuid: parsedArgs.formUuid,
  }, { guardOptions: parsedArgs.legacyGuardOptions });

  step(1, t('common.step_login', 1));
  let cookieData = loadCookieData();
  if (!cookieData) {
    warn(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }
  const { csrf_token: csrfToken, cookies } = cookieData;
  const baseUrl = resolveBaseUrl(cookieData);
  success(t('common.login_ready', baseUrl));
  label('Locale:', resolveContentLocale({ locale: parsedArgs.contentLocale, baseUrl: baseUrl }));

  if (parsedArgs.mode === 'update') {
    return mainUpdate(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  } else if (parsedArgs.mode === 'patch') {
    return mainPatch(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  } else if (parsedArgs.mode === 'rule') {
    return mainRule(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  } else if (parsedArgs.mode === 'validation') {
    return mainValidation(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  } else if (parsedArgs.mode === 'bind-datasource') {
    return mainBindDataSource(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  } else if (parsedArgs.mode === 'add-option') {
    return mainAddOption(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  } else {
    return mainCreate(parsedArgs, csrfToken, cookies, baseUrl, cookieData);
  }
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
};
