/**
 * get-schema.js - 宜搭表单 Schema 获取命令
 *
 * 用法：
 *   openyida get-schema <appType> <formUuid> [--compact] [--resolve-fields <labelOrFieldId,...>]
 *   openyida get-schema <appType> <formUuid> [--summary-json|--field-map-json|--analysis-json]
 *   openyida get-schema <appType> --all [--summary-json|--analysis-json] [--output-dir <dir>] [--concurrency N] [--retries N]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadAuthData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');
const { throwCommandError } = require('../core/command-errors');
const { fetchFormPageList } = require('./form-navigation');
const { buildFieldResolution } = require('./schema-field-resolution');
const { buildSemanticAnalysis } = require('./schema-semantic-analysis');

// 需要在报表 fieldCode 中加 _value 后缀的字段类型
const FIELD_TYPES_NEEDING_VALUE_SUFFIX = new Set([
  'SelectField',
  'MultiSelectField',
  'EmployeeField',
  'DepartmentSelectField',
  'RadioField',
  'CheckboxField',
]);

const FIELD_COMPONENT_NAMES = new Set([
  'TextField', 'TextareaField', 'SelectField', 'MultiSelectField',
  'DateField', 'CascadeDateField', 'NumberField', 'RadioField', 'CheckboxField',
  'EmployeeField', 'DepartmentSelectField', 'PhoneField', 'EmailField',
  'CascadeSelectField', 'CountrySelectField', 'CitySelectField', 'AddressField',
  'ImageField', 'AttachmentField', 'TableField', 'AssociationFormField',
  'RateField', 'SignatureField', 'SerialNumberField',
]);

/**
 * 从 Schema 中提取字段摘要，列出每个字段的真实 fieldId、组件别名和报表用 reportFieldCode。
 * @param {object} schemaResult - getFormSchema API 返回结果
 * @returns {Array<{label, componentName, fieldId, alias, reportFieldCode, options}>}
 */
function extractFieldSummary(schemaResult) {
  const fields = [];
  const pages = schemaResult.content && schemaResult.content.pages;
  if (!pages || pages.length === 0) {
    return fields;
  }
  const aliasMaps = buildComponentAliasMaps(schemaResult);

  function traverse(node) {
    if (!node) {
      return;
    }
    if (FIELD_COMPONENT_NAMES.has(node.componentName)) {
      const props = node.props || {};
      const labelRaw = props.label;
      const label = labelRaw
        ? (typeof labelRaw === 'object' ? (labelRaw.zh_CN || labelRaw.en_US || '') : String(labelRaw))
        : '';
      const fieldId = props.fieldId || '';
      const reportFieldCode = FIELD_TYPES_NEEDING_VALUE_SUFFIX.has(node.componentName)
        ? `${fieldId}_value`
        : fieldId;
      if (fieldId) {
        const options = extractOptionSummary(props);
        const optionSource = getOptionSource(props) || [];
        const complexDefault = props.complexValue && typeof props.complexValue === 'object'
          ? props.complexValue.value
          : undefined;
        const defaultValue = firstPresent([complexDefault, props.defaultValue, props.value, props.default]);
        const validationRules = Array.isArray(props.validation) ? props.validation : [];
        const hasRequiredSignal = Object.prototype.hasOwnProperty.call(props, 'required')
          || validationRules.some(rule => rule && (rule.type === 'required' || rule.required === true));
        const required = props.required === true || props.required === 'true'
          || validationRules.some(rule => rule && (rule.type === 'required' || rule.required === true));
        fields.push({
          label,
          componentName: node.componentName,
          fieldId,
          alias: aliasMaps.aliasByFieldId[fieldId] || '',
          reportFieldCode,
          options,
          optionCount: optionSource.length,
          optionsTruncated: optionSource.length > options.length,
          ...(hasRequiredSignal
            ? { required }
            : {}),
          ...(defaultValue !== undefined ? { defaultValue } : {}),
        });
      }
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  // 遍历所有页面，避免多页面表单遗漏字段
  for (const page of pages) {
    const tree = page.componentsTree && page.componentsTree[0];
    if (tree) {
      traverse(tree);
    }
  }

  return fields;
}

function normalizeOptionLabel(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return value.zh_CN || value.zh_HK || value.en_US || value.ja_JP || value.text || value.label || value.value || '';
  }
  return String(value);
}

function firstPresent(values) {
  return values.find(value => value !== undefined && value !== null);
}

function normalizeOptionValue(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'object') {
    return value.value || value.label || value.text || fallback;
  }
  return String(value);
}

function optionArrayFromDataSource(dataSource) {
  if (!dataSource) {
    return null;
  }
  if (Array.isArray(dataSource)) {
    return dataSource;
  }
  const candidates = [
    dataSource.options,
    dataSource.data,
    dataSource.list,
    dataSource.values,
  ];
  return candidates.find(Array.isArray) || null;
}

function getOptionSource(props = {}) {
  return Array.isArray(props.options)
    ? props.options
    : optionArrayFromDataSource(props.dataSource);
}

function extractOptionSummary(props = {}) {
  const source = getOptionSource(props);
  if (!source) {
    return [];
  }
  return source.slice(0, 50).map((item, index) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const text = String(item);
      return { label: text, value: text };
    }
    const label = normalizeOptionLabel(firstPresent([item.label, item.text, item.name, item.title, item.value]));
    return {
      label,
      value: normalizeOptionValue(firstPresent([item.value, item.key, item.id]), label || String(index)),
    };
  });
}

function buildComponentAliasMaps(schemaResult) {
  const aliasByFieldId = {};
  const fieldIdByAlias = {};
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;
  if (!Array.isArray(pages)) {
    return { aliasByFieldId, fieldIdByAlias };
  }

  pages.forEach((page) => {
    const items = page &&
      page.componentAlias &&
      Array.isArray(page.componentAlias.items)
      ? page.componentAlias.items
      : [];
    items.forEach((item) => {
      const fieldId = item && item.fieldId ? String(item.fieldId).trim() : '';
      const alias = item && item.alias ? String(item.alias).trim() : '';
      if (!fieldId || !alias) {
        return;
      }
      aliasByFieldId[fieldId] = alias;
      fieldIdByAlias[alias] = fieldId;
    });
  });

  return { aliasByFieldId, fieldIdByAlias };
}

function parseJsonObject(value) {
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

function resolveSchemaContent(schemaResult) {
  if (!schemaResult) {
    return null;
  }
  const content = schemaResult.content !== undefined ? schemaResult.content : schemaResult;
  return parseJsonObject(content);
}

function addImportedModules(target, value) {
  let modules = value;
  if (typeof modules === 'string') {
    const trimmed = modules.trim();
    if (!trimmed) {
      return;
    }
    try {
      modules = JSON.parse(trimmed);
    } catch {
      modules = [trimmed];
    }
  }
  if (!Array.isArray(modules)) {
    return;
  }
  modules
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .forEach((item) => {
      if (!target.includes(item)) {
        target.push(item);
      }
    });
}

function codeBytes(value) {
  return typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : 0;
}

function isComponentInstance(node) {
  return !!(node && typeof node === 'object' && (node.id || node.props || node.children));
}

function extractDisplayPageSummary(schemaResult) {
  const content = resolveSchemaContent(schemaResult);
  if (!content || typeof content !== 'object') {
    return null;
  }

  const displayPage = {
    hasYidaCodeCanvas: false,
    hasNativeJsx: false,
    runtimeCodeBytes: 0,
    sourceCodeBytes: 0,
    compiledCodeBytes: 0,
    importedModules: [],
    componentCount: 0,
  };

  function traverse(node) {
    if (!node) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }
    if (typeof node !== 'object') {
      return;
    }

    if (node.componentName === 'YidaCodeCanvas' && isComponentInstance(node)) {
      const props = node.props || {};
      displayPage.hasYidaCodeCanvas = true;
      displayPage.componentCount++;
      displayPage.runtimeCodeBytes += codeBytes(props.runtimeCode);
      displayPage.sourceCodeBytes += codeBytes(props.code);
      addImportedModules(displayPage.importedModules, props.importedModules);
    } else if (node.componentName === 'Jsx' && isComponentInstance(node)) {
      displayPage.hasNativeJsx = true;
      displayPage.componentCount++;
    }

    Object.keys(node).forEach((key) => traverse(node[key]));
  }

  traverse(content.pages || content);

  const module = content.actions && content.actions.module;
  if (displayPage.hasNativeJsx && module && typeof module === 'object') {
    displayPage.sourceCodeBytes += codeBytes(module.source);
    displayPage.compiledCodeBytes += codeBytes(module.compiled);
  }

  if (!displayPage.hasYidaCodeCanvas && !displayPage.hasNativeJsx) {
    return null;
  }
  return displayPage;
}

function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function parseArgs(args) {
  const parsed = {
    appType: args[0] || '',
    formUuid: '',
    all: false,
    outputDir: '',
    concurrency: 3,
    retries: 1,
    keyword: '',
    compact: false,
    fields: [],
    // 保留已有单字段参数，作为 --fields 的单值兼容别名。
    field: '',
    json: false,
    summaryJson: false,
    analysisJson: false,
  };

  for (let index = 1; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--all') {
      parsed.all = true;
    } else if (arg === '--output-dir' && args[index + 1]) {
      parsed.outputDir = args[index + 1];
      index++;
    } else if ((arg === '--concurrency' || arg === '--parallel') && args[index + 1]) {
      parsed.concurrency = parsePositiveInt(args[index + 1], 3, 1, 10);
      index++;
    } else if ((arg === '--retries' || arg === '--retry') && args[index + 1]) {
      parsed.retries = parsePositiveInt(args[index + 1], 1, 0, 5);
      index++;
    } else if (arg === '--keyword' && args[index + 1]) {
      parsed.keyword = args[index + 1];
      index++;
    } else if (arg === '--compact') {
      parsed.compact = true;
    } else if (arg === '--resolve-fields') {
      parsed.compact = true;
      if (args[index + 1] && !args[index + 1].startsWith('--')) {
        appendFieldQueries(parsed.fields, args[index + 1]);
        index++;
      }
    } else if (arg === '--field' && args[index + 1] && !args[index + 1].startsWith('--')) {
      parsed.field = args[index + 1];
      index++;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--summary-json' || arg === '--field-map-json') {
      parsed.summaryJson = true;
    } else if (arg === '--analysis-json') {
      parsed.analysisJson = true;
    } else if (!arg.startsWith('--') && !parsed.formUuid) {
      parsed.formUuid = arg;
    }
  }

  return parsed;
}

function appendFieldQueries(target, value) {
  String(value || '')
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (!target.includes(item)) {
        target.push(item);
      }
    });
}

function ensureUsage(parsed) {
  if (!parsed.appType || (!parsed.all && !parsed.formUuid)) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('get_schema.usage'), { hint: t('get_schema.example') });
  }
  // contract v1 的 resource 对应单个 form，不与 --all 批量模式混用。
  if ((parsed.compact || parsed.field) && parsed.all) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('get_schema.usage'), { hint: t('get_schema.example') });
  }
}

/**
 * 从已解析好的字段列表中按 label 或 fieldId 精确匹配。
 * 优先按 label 完整匹配（区分大小写），未命中再按 fieldId 完整匹配。
 * 命中即返回首个，未命中返回 null。
 *
 * @param {Array<object>} fieldNodes - 来自 collectFieldNodes 的原始字段节点数组
 * @param {string} keyword - label（如「优先级」）或 fieldId（如 selectField_qkm136vkr）
 */
function findFieldNode(fieldNodes, keyword, aliasByFieldId = {}) {
  if (!keyword) {return null;}
  const target = String(keyword).trim();

  for (const node of fieldNodes) {
    const props = node.props || {};
    const labelRaw = props.label;
    const label = labelRaw
      ? (typeof labelRaw === 'object' ? (labelRaw.zh_CN || labelRaw.en_US || '') : String(labelRaw))
      : '';
    if (label === target) {return node;}
  }
  for (const node of fieldNodes) {
    const props = node.props || {};
    if (props.fieldId && aliasByFieldId[props.fieldId] === target) {return node;}
  }
  for (const node of fieldNodes) {
    const props = node.props || {};
    if (props.fieldId === target) {return node;}
  }
  return null;
}

/**
 * 把 fetchSchema 的原始返回，递归收集到所有字段组件节点（含 props）。
 * 与 extractFieldSummary 不同：保留 props 完整结构，便于 --field 模式输出。
 */
function collectFieldNodes(schemaResult) {
  const nodes = [];
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;
  if (!pages || pages.length === 0) {return nodes;}

  function traverse(node) {
    if (!node) {return;}
    if (FIELD_COMPONENT_NAMES.has(node.componentName)) {
      nodes.push(node);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  for (const page of pages) {
    const tree = page.componentsTree && page.componentsTree[0];
    if (tree) {traverse(tree);}
  }
  return nodes;
}

function createAuthRef() {
  const { step, info, success: chalkSuccess } = require('../core/chalk');

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  let authData = loadAuthData();
  if (!authData) {
    info(t('common.login_no_cache'));
    authData = triggerLogin();
  }

  const authRef = {
    baseUrl: resolveBaseUrl(authData),
    authData,
    authMode: authData.auth_mode || '',
    authSource: authData.auth_source || '',
    corpId: authData.corp_id || '',
    userId: authData.user_id || '',
  };
  chalkSuccess(t('common.login_ready', authRef.baseUrl));
  return authRef;
}

async function fetchSchema(appType, formUuid, authRef) {
  return requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: 'V5' }
    );
  }, authRef);
}

function isSuccessfulSchemaResult(result) {
  const content = resolveSchemaContent(result);
  const pages = content && content.pages;
  return !!(result && result.success !== false && !result.__needLogin
    && Array.isArray(pages));
}

function printFieldSummary(result) {
  const { c } = require('../core/chalk');
  const fieldSummary = extractFieldSummary(result);
  if (fieldSummary.length === 0) {
    return;
  }

  process.stderr.write(`\n  ${c.bold}${c.cyan}📋 字段摘要${c.reset} ${c.dim}（报表配置请使用 reportFieldCode）${c.reset}\n`);
  process.stderr.write(`  ${c.dim}${'─'.repeat(80)}${c.reset}\n`);
  process.stderr.write(
    `  ${c.bold}${'label'.padEnd(16)}${'alias'.padEnd(18)}${'componentName'.padEnd(20)}${'fieldId'.padEnd(28)}reportFieldCode${c.reset}\n`
  );
  process.stderr.write(`  ${c.dim}${'─'.repeat(80)}${c.reset}\n`);
  for (const field of fieldSummary) {
    process.stderr.write(
      `  ${c.green}${field.label.padEnd(16)}${c.reset}${c.yellow}${(field.alias || '').padEnd(18)}${c.reset}${c.dim}${field.componentName.padEnd(20)}${c.reset}${field.fieldId.padEnd(28)}${c.cyan}${field.reportFieldCode}${c.reset}\n`
    );
  }
  process.stderr.write(`  ${c.dim}${'─'.repeat(80)}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}注：SelectField/EmployeeField 在报表中需加 _value 后缀${c.reset}\n\n`);
}

function buildSchemaSummary(appType, formUuid, schemaResult, meta = {}) {
  const fields = extractFieldSummary(schemaResult);
  const summary = {
    success: true,
    appType,
    formUuid,
    ...meta,
    fieldCount: fields.length,
    fields,
  };
  const displayPage = extractDisplayPageSummary(schemaResult);
  if (displayPage) {
    summary.displayPage = displayPage;
  }
  return summary;
}

function filterForms(forms, keyword) {
  if (!keyword) {
    return forms;
  }
  const needle = keyword.toLowerCase();
  return forms.filter((form) => {
    return [form.formName, form.formUuid, form.formType, form.pathName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
}

function sanitizeFileName(value) {
  return String(value || 'schema')
    .replace(/[\\/:"*?<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

async function mapLimit(items, limit, iterator) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor++;
      results[current] = await iterator(items[current], current);
    }
  }

  const workerCount = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function fetchSchemaRecord(appType, form, authRef, retries) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchSchema(appType, form.formUuid, authRef);
      if (isSuccessfulSchemaResult(result)) {
        const record = {
          formUuid: form.formUuid,
          formName: form.formName,
          formType: form.formType,
          pathName: form.pathName,
          success: true,
          attempts: attempt + 1,
          fieldSummary: extractFieldSummary(result),
          schema: result,
        };
        const displayPage = extractDisplayPageSummary(result);
        if (displayPage) {
          record.displayPage = displayPage;
        }
        return record;
      }
      lastError = new Error(result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed'));
    } catch (error) {
      lastError = error;
    }
  }

  return {
    formUuid: form.formUuid,
    formName: form.formName,
    formType: form.formType,
    pathName: form.pathName,
    success: false,
    attempts: retries + 1,
    errorMsg: lastError ? lastError.message : t('common.unknown_error'),
  };
}

function summarizeRecord(record) {
  if (!record.success) {
    return record;
  }
  const { schema, ...summary } = record;
  void schema;
  return summary;
}

function writeBatchOutput(outputDir, records, options = {}) {
  const compact = !!options.compact;
  if (!outputDir) {
    return compact ? records.map(summarizeRecord) : records;
  }

  const resolvedDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const indexRecords = records.map((record) => {
    if (!record.success) {
      return record;
    }

    const baseName = sanitizeFileName(`${record.formName || 'form'}-${record.formUuid}`);
    const fileName = `${baseName}.json`;
    const filePath = path.join(resolvedDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(record.schema, null, 2), 'utf-8');

    return {
      ...summarizeRecord(record),
      schemaFile: filePath,
    };
  });

  fs.writeFileSync(path.join(resolvedDir, 'index.json'), JSON.stringify(indexRecords, null, 2), 'utf-8');
  return indexRecords;
}

async function runSingle(parsed, authRef) {
  const { banner, step, label, info, success: chalkSuccess, result: chalkResult } = require('../core/chalk');

  banner(t('get_schema.title'));
  label('App', parsed.appType);
  label('Form', parsed.formUuid);
  if (parsed.field) {
    label('Field', parsed.field);
  } else if (parsed.fields.length > 0) {
    label('Fields', parsed.fields.join(', '));
  }

  // Step 2: 获取表单 Schema
  step(2, t('get_schema.step_get'));
  info(t('get_schema.sending'));

  let result;
  try {
    result = await fetchSchema(parsed.appType, parsed.formUuid, authRef);
  } catch (error) {
    if (!parsed.compact) {
      throw error;
    }
    chalkResult(false, t('get_schema.failed', t('common.request_failed')));
    process.exit(1);
    return;
  }

  if (!isSuccessfulSchemaResult(result)) {
    const errorMsg = parsed.compact
      ? t('common.request_failed')
      : result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    chalkResult(false, t('get_schema.failed', errorMsg));
    throwCommandError(errorMsg);
  }

  // 保留既有 --field 返回结构；新 contract 仅由 --compact / --resolve-fields 触发。
  if (parsed.field) {
    const allFieldNodes = collectFieldNodes(result);
    const aliasMaps = buildComponentAliasMaps(result);
    const matched = findFieldNode(allFieldNodes, parsed.field, aliasMaps.aliasByFieldId);
    if (!matched) {
      const { error: chalkError } = require('../core/chalk');
      chalkError(`未找到字段：${parsed.field}`, {
        hint: `共 ${allFieldNodes.length} 个字段，可用 openyida get-schema ${parsed.appType} ${parsed.formUuid} 查看完整列表`,
      });
      return;
    }
    const props = matched.props || {};
    const labelRaw = props.label;
    const fieldLabel = labelRaw
      ? (typeof labelRaw === 'object' ? (labelRaw.zh_CN || labelRaw.en_US || '') : String(labelRaw))
      : '';
    const legacyField = {
      componentName: matched.componentName,
      fieldId: props.fieldId || '',
      alias: aliasMaps.aliasByFieldId[props.fieldId] || '',
      label: fieldLabel,
      props,
    };
    chalkSuccess(t('get_schema.success'));
    console.log(JSON.stringify(legacyField, null, 2));
    return;
  }

  if (parsed.compact) {
    chalkSuccess(t('get_schema.success'));
    console.log(JSON.stringify(buildFieldResolution(
      parsed.appType,
      parsed.formUuid,
      result,
      parsed.fields
    ), null, 2));
    return;
  }

  if (parsed.summaryJson) {
    console.log(JSON.stringify(buildSchemaSummary(parsed.appType, parsed.formUuid, result), null, 2));
    return;
  }

  if (parsed.analysisJson) {
    console.log(JSON.stringify(buildSemanticAnalysis(
      parsed.appType,
      parsed.formUuid,
      result,
      extractFieldSummary(result)
    ), null, 2));
    return;
  }

  chalkSuccess(t('get_schema.success'));
  printFieldSummary(result);
  console.log(JSON.stringify(result, null, 2));
}

async function runBatch(parsed, authRef) {
  const { banner, step, label, info, success: chalkSuccess, result: chalkResult } = require('../core/chalk');

  banner(t('get_schema.title'));
  label('App', parsed.appType);
  label('Mode', 'all');
  if (parsed.outputDir) {label('Output', parsed.outputDir);}

  step(2, t('list_forms.step_get'));
  const allForms = await fetchFormPageList(parsed.appType, authRef);
  const forms = filterForms(allForms, parsed.keyword);
  info(t('list_forms.found', forms.length));

  if (forms.length === 0) {
    console.log(JSON.stringify({
      appType: parsed.appType,
      total: 0,
      successCount: 0,
      failedCount: 0,
      forms: [],
    }, null, 2));
    return;
  }

  step(3, t('get_schema.step_get'));
  info(`  批量获取 ${forms.length} 个表单 Schema，并发 ${parsed.concurrency}，重试 ${parsed.retries}`);

  const records = await mapLimit(forms, parsed.concurrency, async (form) => {
    const record = await fetchSchemaRecord(parsed.appType, form, authRef, parsed.retries);
    if (record.success && parsed.analysisJson) {
      record.semanticAnalysis = buildSemanticAnalysis(
        parsed.appType,
        record.formUuid,
        record.schema,
        record.fieldSummary
      );
    }
    if (record.success) {
      info(`  ✅ ${record.formName || record.formUuid}`);
    } else {
      info(`  ❌ ${record.formName || record.formUuid}: ${record.errorMsg}`);
    }
    return record;
  });

  const outputRecords = writeBatchOutput(parsed.outputDir, records, {
    compact: parsed.summaryJson || parsed.analysisJson,
  });
  const successCount = records.filter(record => record.success).length;
  const failedCount = records.length - successCount;

  if (failedCount === 0) {
    chalkSuccess(t('get_schema.success'));
  } else {
    chalkResult(false, `  ⚠️  ${failedCount} 个 Schema 获取失败`);
  }

  console.log(JSON.stringify({
    appType: parsed.appType,
    total: records.length,
    successCount,
    failedCount,
    summaryOnly: parsed.summaryJson || undefined,
    analysisOnly: parsed.analysisJson || undefined,
    outputDir: parsed.outputDir ? path.resolve(parsed.outputDir) : undefined,
    forms: outputRecords,
  }, null, 2));
}

async function run(args) {
  const parsed = parseArgs(args);
  ensureUsage(parsed);
  const authRef = createAuthRef();

  if (parsed.all) {
    return runBatch(parsed, authRef);
  }
  return runSingle(parsed, authRef);
}

module.exports = {
  extractFieldSummary,
  extractOptionSummary,
  buildSchemaSummary,
  buildSemanticAnalysis,
  isSuccessfulSchemaResult,
  buildComponentAliasMaps,
  parseArgs,
  appendFieldQueries,
  filterForms,
  mapLimit,
  fetchSchemaRecord,
  collectFieldNodes,
  findFieldNode,
  run,
};
