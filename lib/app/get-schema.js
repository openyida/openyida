/**
 * get-schema.js - 宜搭表单 Schema 获取命令
 *
 * 用法：
 *   openyida get-schema <appType> <formUuid>
 *   openyida get-schema <appType> --all [--output-dir <dir>] [--concurrency N] [--retries N]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');
const { fetchFormPageList } = require('./form-navigation');

// 需要在报表 fieldCode 中加 _value 后缀的字段类型
const FIELD_TYPES_NEEDING_VALUE_SUFFIX = new Set([
  'SelectField',
  'EmployeeField',
  'RadioField',
  'CheckboxField',
]);

/**
 * 从 Schema 中提取字段摘要，列出每个字段的真实 fieldId 和报表用 reportFieldCode。
 * @param {object} schemaResult - getFormSchema API 返回结果
 * @returns {Array<{label, componentName, fieldId, reportFieldCode}>}
 */
function extractFieldSummary(schemaResult) {
  const fields = [];
  const pages = schemaResult.content && schemaResult.content.pages;
  if (!pages || pages.length === 0) {
    return fields;
  }

  const FIELD_COMPONENT_NAMES = new Set([
    'TextField', 'TextareaField', 'SelectField', 'DateField', 'NumberField',
    'RadioField', 'CheckboxField', 'EmployeeField', 'PhoneField', 'EmailField',
    'CascadeSelectField', 'ImageField', 'AttachmentField', 'TableField',
  ]);

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
        fields.push({ label, componentName: node.componentName, fieldId, reportFieldCode });
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
    } else if (!arg.startsWith('--') && !parsed.formUuid) {
      parsed.formUuid = arg;
    }
  }

  return parsed;
}

function ensureUsage(parsed) {
  if (!parsed.appType || (!parsed.all && !parsed.formUuid)) {
    const { error: chalkError } = require('../core/chalk');
    chalkError(t('get_schema.usage'), { hint: t('get_schema.example') });
  }
}

function createAuthRef() {
  const { step, info, success: chalkSuccess } = require('../core/chalk');

  // Step 1: 读取登录态
  step(1, t('common.step_login', 1));
  let cookieData = loadCookieData();
  if (!cookieData) {
    info(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  chalkSuccess(t('common.login_ready', authRef.baseUrl));
  return authRef;
}

async function fetchSchema(appType, formUuid, authRef) {
  return requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: 'V5' },
      auth.cookies
    );
  }, authRef);
}

function isSuccessfulSchemaResult(result) {
  return !!(result && result.success !== false && !result.__needLogin && !result.__csrfExpired);
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
    `  ${c.bold}${'label'.padEnd(16)}${'componentName'.padEnd(20)}${'fieldId'.padEnd(28)}reportFieldCode${c.reset}\n`
  );
  process.stderr.write(`  ${c.dim}${'─'.repeat(80)}${c.reset}\n`);
  for (const field of fieldSummary) {
    process.stderr.write(
      `  ${c.green}${field.label.padEnd(16)}${c.reset}${c.dim}${field.componentName.padEnd(20)}${c.reset}${field.fieldId.padEnd(28)}${c.cyan}${field.reportFieldCode}${c.reset}\n`
    );
  }
  process.stderr.write(`  ${c.dim}${'─'.repeat(80)}${c.reset}\n`);
  process.stderr.write(`  ${c.dim}注：SelectField/EmployeeField 在报表中需加 _value 后缀${c.reset}\n\n`);
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
        return {
          formUuid: form.formUuid,
          formName: form.formName,
          formType: form.formType,
          pathName: form.pathName,
          success: true,
          attempts: attempt + 1,
          fieldSummary: extractFieldSummary(result),
          schema: result,
        };
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

function writeBatchOutput(outputDir, records) {
  if (!outputDir) {
    return records;
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

    const { schema, ...summary } = record;
    void schema;
    return {
      ...summary,
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

  // Step 2: 获取表单 Schema
  step(2, t('get_schema.step_get'));
  info(t('get_schema.sending'));

  const result = await fetchSchema(parsed.appType, parsed.formUuid, authRef);

  // 输出结果
  if (isSuccessfulSchemaResult(result)) {
    chalkSuccess(t('get_schema.success'));
    printFieldSummary(result);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const errorMsg = result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed');
    chalkResult(false, t('get_schema.failed', errorMsg));
    process.exit(1);
  }
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
    if (record.success) {
      info(`  ✅ ${record.formName || record.formUuid}`);
    } else {
      info(`  ❌ ${record.formName || record.formUuid}: ${record.errorMsg}`);
    }
    return record;
  });

  const outputRecords = writeBatchOutput(parsed.outputDir, records);
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
  parseArgs,
  filterForms,
  mapLimit,
  fetchSchemaRecord,
  run,
};
