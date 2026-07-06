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
const { buildYidaI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { banner, step, label, success, fail, warn, info, error, result, usage, hint, listItem } = require('../core/chalk');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { default: babelTransform } = require('../core/babel-transform');
const { normalizeFormulaFieldRefs } = require('../formula/evaluate');

// ── 选项类字段类型 ───────────────────────────────────
const OPTION_FIELD_TYPES = ['RadioField', 'SelectField', 'CheckboxField', 'MultiSelectField'];

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
  const rawArgs = openOption.args;

  // 解析可选参数
  const options = {
    layout: 'single',  // 布局：single/double/card/section
    theme: 'default',  // 主题：default/compact/comfortable
    labelAlign: 'top', // 标签对齐：top/left/right
    contentLocale: null,
    browserOpenMode: openOption.mode,
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
    const parsed = JSON.parse(rawContent);

    // 支持两种格式：
    // 1. 数组格式: [{type: "TextField", label: "姓名"}, ...]
    // 2. 对象格式: { columns: 2, fields: [{type: "TextField", label: "姓名"}, ...] }
    let fields;
    let validations = [];
    let columns = 1; // 默认单列

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
  } catch (parseError) {
    error(t('create_form.fields_parse_failed') + parseError.message);
  }
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

function normalizeValidationType(type) {
  const normalized = String(type || '').trim();
  const lower = normalized.toLowerCase();
  const typeMap = {
    mobile: 'mobile',
    phone: 'mobile',
    tel: 'mobile',
    cellphone: 'mobile',
    regex: 'regex',
    regexp: 'regex',
    pattern: 'regex',
    idcard: 'chineseID',
    id_card: 'chineseID',
    identitycard: 'chineseID',
    identity_card: 'chineseID',
    chineseid: 'chineseID',
    chinese_id: 'chineseID',
    bankcard: 'bankCard',
    bank_card: 'bankCard',
    luhn: 'bankCard',
    uscc: 'unifiedSocialCreditCode',
    creditcode: 'unifiedSocialCreditCode',
    credit_code: 'unifiedSocialCreditCode',
    unifiedsocialcreditcode: 'unifiedSocialCreditCode',
    unified_social_credit_code: 'unifiedSocialCreditCode',
    mail: 'email',
    e_mail: 'email',
    required: 'required',
    compare: 'compare',
    crossfield: 'compare',
    cross_field: 'compare',
    daterange: 'compare',
    date_range: 'compare',
    dateorder: 'compare',
    date_order: 'compare',
    conditionalrequired: 'conditionalRequired',
    conditional_required: 'conditionalRequired',
    expression: 'custom',
    javascript: 'custom',
    js: 'custom',
    customvalidate: 'customValidate',
    custom_validate: 'customValidate',
    async: 'async',
    remote: 'async',
  };
  return typeMap[lower] || normalized;
}

function defaultValidationMessage(type) {
  const messages = {
    required: i18n('此项为必填项', 'This field is required', 'この項目は必須です'),
    regex: i18n('格式不正确', 'Invalid format', '形式が正しくありません'),
    mobile: i18n('请输入正确的手机号', 'Please enter a valid phone number', '正しい電話番号を入力してください'),
    phone: i18n('请输入正确的手机号', 'Please enter a valid phone number', '正しい電話番号を入力してください'),
    idCard: i18n('身份证号不合法', 'Invalid ID card number', '身分証番号が正しくありません'),
    chineseID: i18n('身份证号不合法', 'Invalid ID card number', '身分証番号が正しくありません'),
    bankCard: i18n('银行卡号不合法', 'Invalid bank card number', '銀行カード番号が正しくありません'),
    unifiedSocialCreditCode: i18n('统一社会信用代码不合法', 'Invalid unified social credit code', '統一社会信用コードが正しくありません'),
    email: i18n('请输入正确的邮箱地址', 'Please enter a valid email address', '正しいメールアドレスを入力してください'),
    compare: i18n('字段间逻辑校验未通过', 'Cross-field validation failed', 'フィールド間検証に失敗しました'),
    conditionalRequired: i18n('此项在当前条件下为必填项', 'This field is required for the current condition', '現在の条件ではこの項目は必須です'),
    custom: i18n('自定义校验未通过', 'Custom validation failed', 'カスタム検証に失敗しました'),
    customValidate: i18n('自定义校验未通过', 'Custom validation failed', 'カスタム検証に失敗しました'),
    async: i18n('异步校验未通过', 'Async validation failed', '非同期検証に失敗しました'),
  };
  return messages[type] || i18n('校验未通过', 'Validation failed', '検証に失敗しました');
}

function normalizeDesignerValidationRule(rule) {
  if (!rule) {
    return null;
  }
  if (typeof rule === 'string') {
    return { type: normalizeValidationType(rule), message: defaultValidationMessage(normalizeValidationType(rule)) };
  }
  if (typeof rule !== 'object') {
    return null;
  }

  const type = normalizeValidationType(rule.type || rule.validator || rule.kind || (rule.pattern ? 'regex' : ''));
  if (!type) {
    return null;
  }

  const normalized = Object.assign({}, rule, {
    type,
    message: rule.message || rule.errorMessage || rule.tips || defaultValidationMessage(type),
  });

  if (rule.regex !== undefined && normalized.pattern === undefined) {
    normalized.pattern = rule.regex;
  }
  if (rule.domain_whitelist && !normalized.domainWhitelist) {
    normalized.domainWhitelist = String(rule.domain_whitelist).split(',').map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  return normalized;
}

function isNativeFieldValidationRule(rule) {
  if (!rule || rule.condition || rule.when || rule.api || rule.url || rule.endpoint || rule.targetFieldId) {
    return false;
  }
  if (rule.type === 'email' && rule.domainWhitelist && rule.domainWhitelist.length) {
    return false;
  }
  return [
    'required',
    'number',
    'email',
    'mobile',
    'url',
    'maxLength',
    'minLength',
    'minValue',
    'maxValue',
    'date',
    'money',
    'zipcode',
    'phone',
    'ip',
    'mac',
    'chineseID',
    'customValidate',
  ].indexOf(rule.type) !== -1;
}

function validationRuleSignature(rule) {
  const param = rule && rule.param && typeof rule.param === 'object'
    ? JSON.stringify(rule.param)
    : rule && rule.param;
  return [
    rule && rule.type,
    rule && rule.pattern,
    param,
    rule && rule.targetFieldId,
    rule && rule.operator,
    rule && rule.api,
    rule && rule.expression,
    rule && rule.condition ? JSON.stringify(rule.condition) : '',
  ].map(function (value) {
    return value === undefined ? '' : String(value);
  }).join('|');
}

function dedupeValidationRules(rules) {
  const seen = new Set();
  return (rules || []).filter(function (rule) {
    const signature = validationRuleSignature(rule);
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

function collectInputValidationRules(field, options) {
  const rules = [];
  const includeAdvanced = !!(options && options.includeAdvanced);
  const sourceRules = Array.isArray(field && field.validation)
    ? field.validation
    : Array.isArray(field && field.validations)
      ? field.validations
      : [];

  if (field && field.required) {
    rules.push({
      type: 'required',
      message: field.requiredMessage || field.message || defaultValidationMessage('required'),
    });
  }

  if (field && (field.pattern || field.regex)) {
    rules.push({
      type: 'regex',
      pattern: field.pattern || field.regex,
      message: field.message || defaultValidationMessage('regex'),
    });
  }

  sourceRules.forEach(function (rule) {
    const normalized = normalizeDesignerValidationRule(rule);
    if (normalized && (includeAdvanced || isNativeFieldValidationRule(normalized))) {
      rules.push(normalized);
    }
  });

  return dedupeValidationRules(rules);
}

function normalizeFieldValidationRules(field, options) {
  return dedupeValidationRules(collectInputValidationRules(field, options).map(function (rule) {
    return toDesignerValidationRule(rule);
  }).filter(Boolean));
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

function buildFieldComponent(field) {
  const componentName = FIELD_TYPE_ALIAS[field.type] || field.type;
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
  fields.forEach(function (field) {
    names.add(field.type);
    if (field.type === 'TableField' && field.children) {
      field.children.forEach(function (child) {
        names.add(child.type);
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
      version: '1.5.169',
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
    const groupFieldComponents = group.fields.map((field) => buildFieldComponent(field));

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
  const fieldComponents = fields.map(function (field) {
    return buildFieldComponent(field);
  });
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
  return {
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
}

// ── 发送 GET 请求（支持 302 自动重登录） ─────────────

function sendGetRequest(baseUrl, cookies, requestPath, queryParams) {
  return httpGet(baseUrl, requestPath, queryParams, cookies);
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
  if (!component || !component.props || !component.props.label) {
    return '';
  }
  const label = component.props.label;
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

function deepMerge(target, source) {
  Object.keys(source || {}).forEach(function (key) {
    const sourceValue = source[key];
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });
  return target;
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

// ── 发送 POST 请求（支持 302 自动重登录） ────────────

function sendPostRequest(baseUrl, csrfToken, cookies, requestPath, extraParams, formUuid) {
  const postData = querystring.stringify(
    Object.assign({ _csrf_token: csrfToken }, extraParams)
  );
  const referer = formUuid
    ? `${baseUrl}/alibaba/web/${extraParams.appType || ''}/design/pageDesigner?formUuid=${formUuid}`
    : baseUrl + '/';
  return httpPost(baseUrl, requestPath, postData, cookies, { referer });
}

// ── 发送 updateFormConfig 请求 ───────────────────────

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

// ── 保存 Schema 并更新表单配置（create/update 共用）──
//
// 封装了 saveFormSchema + updateFormConfig 两步，以及各自的 302 自动重登录重试。
// 返回 { saveResult, configResult }。

async function saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, stepOffset) {
  const saveStep = stepOffset || 4;
  const configStep = saveStep + 1;

  const fixedRefs = normalizeFormulaFieldRefs(schema);
  if (fixedRefs > 0) {
    info(t('create_form.formula_prefix_fixed', fixedRefs));
  }

  step(saveStep, t('create_form.step_save_schema', saveStep));
  info(t('create_form.sending_save'));

  const saveResult = await requestWithAutoLogin(function (auth) {
    return sendPostRequest(
      auth.baseUrl, auth.csrfToken, auth.cookies,
      buildApiPath(appType, 'saveFormSchema', { prefix: '_view' }),
      { appType: appType, formUuid: formUuid, content: JSON.stringify(schema), schemaVersion: 'V5', prefix: '_view' },
      formUuid
    );
  }, authRef);

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

  const configResult = await requestWithAutoLogin(function (auth) {
    return sendUpdateConfigRequest(auth.baseUrl, auth.csrfToken, auth.cookies, appType, formUuid, version || 1, 0);
  }, authRef);

  return { saveResult: saveResult, configResult: configResult };
}

// ── create 模式主流程 ─────────────────────────────────

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
  const createResult = await requestWithAutoLogin(function (auth) {
    return sendPostRequest(
      auth.baseUrl, auth.csrfToken, auth.cookies,
      buildApiPath(appType, 'saveFormSchemaInfo'),
      { formType: 'receipt', title: JSON.stringify(i18n(formTitle)) }
    );
  }, authRef);

  if (!createResult || !createResult.success || !createResult.content) {
    const errorMsg = createResult ? createResult.errorMsg || t('common.unknown_error') : t('common.request_failed');
    fail(t('create_form.create_blank_failed', errorMsg));
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    throwCreateFormError(errorMsg, 'CREATE_FORM_CREATE_BLANK_FAILED', {
      appType,
      result: createResult,
    });
  }

  const formUuid = createResult.content.formUuid || createResult.content;
  success(t('create_form.blank_created', formUuid));

  // Step 4 & 5: 生成 Schema 并保存，然后更新表单配置
  const corpId = resolveCorpId(authRef.cookieData);
  if (!corpId) {
    warn(t('create_form.no_corp_id_warning'));
  } else {
    info(t('create_form.corp_id_ok', corpId));
  }

  const schema = buildFormSchema(formTitle, fields, formUuid, corpId, appType, layout, theme, labelAlign);
  const createValidationRules = collectSmartValidationRulesFromFields(fields).concat(validations || []);
  if (createValidationRules.length > 0) {
    const appliedValidations = applySmartValidations(schema, createValidationRules);
    info('已为创建表单写入 ' + appliedValidations.appliedRules.length + ' 条字段校验');
  }
  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, 1, 4);

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
  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

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
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

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
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

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
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

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
    fillSerialNumberFormulas(formContainer.children, corpId, appType, formUuid);
  }

  const { configResult } = await saveSchemaAndUpdateConfig(authRef, appType, formUuid, schema, version, 4);

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
  run,
  parseArgs,
};
