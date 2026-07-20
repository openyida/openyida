#!/usr/bin/env node

'use strict';

/**
 * 输出格式校验器（D9 — 输出规范性）。
 *
 * 验证 Agent 产出是否符合各技能类别定义的输出结构：
 * - 必填字段存在且非 null
 * - 字段类型正确（string / array）
 * - 对未知字段给出警告
 *
 * 由 generate.js 生成的结果包含 appType、appUrl、targets、summary 等字段，
 * 本模块按技能类别逐条校验其结构有效性。
 */

/**
 * 各技能类别的输出结构定义。
 */
const OUTPUT_SCHEMAS = {
  'yida/app': {
    requiredFields: ['appType', 'appUrl'],
    optionalFields: ['targets', 'summary', 'pages'],
    fieldTypes: { appType: 'string', appUrl: 'string', targets: 'array', summary: 'string' },
  },
  'yida/report': {
    requiredFields: ['appUrl'],
    optionalFields: ['targets', 'summary'],
    fieldTypes: { appUrl: 'string', targets: 'array' },
  },
  'yida/process': {
    requiredFields: ['appType', 'appUrl'],
    optionalFields: ['targets', 'summary', 'processCode'],
    fieldTypes: { appType: 'string', appUrl: 'string', processCode: 'string' },
  },
  'yida/connector': {
    requiredFields: ['summary'],
    optionalFields: ['connectorId', 'actions'],
    fieldTypes: { summary: 'string', connectorId: 'string', actions: 'array' },
  },
  'yida/page': {
    requiredFields: ['appUrl'],
    optionalFields: ['targets', 'summary', 'formUuid'],
    fieldTypes: { appUrl: 'string', formUuid: 'string' },
  },
};

/**
 * 获取指定类别的输出 schema。
 * @param {string} category 技能类别（如 'yida/app'）
 * @returns {object|null} schema 对象或 null
 */
function getSchema(category) {
  if (!category || typeof category !== 'string') {
    return null;
  }
  return OUTPUT_SCHEMAS[category] || null;
}

/**
 * 基础 URL 校验：是否以 http:// 或 https:// 开头且包含域名部分。
 * @param {string} url
 * @returns {boolean}
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
}

/**
 * 校验单个字段的类型是否符合 schema 中的声明。
 * @param {*} value 字段值
 * @param {string} expectedType 'string' | 'array'
 * @returns {boolean}
 */
function checkFieldType(value, expectedType) {
  if (expectedType === 'array') {
    return Array.isArray(value);
  }
  return typeof value === expectedType;
}

/**
 * 校验单条输出是否符合 schema。
 * @param {object} output Agent 产出对象
 * @param {object} schema 来自 OUTPUT_SCHEMAS 的结构定义
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateOutput(output, schema) {
  const errors = [];
  const warnings = [];

  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    errors.push('output must be a non-null object');
    return { valid: false, errors, warnings };
  }

  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [], warnings: ['no schema provided, skipping validation'] };
  }

  const required = schema.requiredFields || [];
  const optional = schema.optionalFields || [];
  const types = schema.fieldTypes || {};

  // 检查必填字段
  for (const field of required) {
    if (!(field in output) || output[field] === null || output[field] === undefined) {
      errors.push('missing required field: ' + field);
    } else if (types[field] && !checkFieldType(output[field], types[field])) {
      errors.push('field ' + field + ' should be ' + types[field] + ', got ' + (Array.isArray(output[field]) ? 'array' : typeof output[field]));
    }
  }

  // 检查可选字段的类型（如果存在）
  for (const field of optional) {
    if (field in output && output[field] !== null && output[field] !== undefined) {
      if (types[field] && !checkFieldType(output[field], types[field])) {
        errors.push('field ' + field + ' should be ' + types[field] + ', got ' + (Array.isArray(output[field]) ? 'array' : typeof output[field]));
      }
    }
  }

  // 检查未知字段
  const knownFields = new Set([...required, ...optional]);
  for (const key of Object.keys(output)) {
    if (!knownFields.has(key)) {
      warnings.push('unexpected field: ' + key);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 批量校验输出列表。
 * @param {object} options
 * @param {Array<{category: string, output: object}>} options.outputs 待校验列表
 * @returns {{results: Array, summary: {total: number, valid: number, invalid: number, rate: number|null}}}
 */
function checkOutputValidity(options) {
  const opts = options || {};
  const outputs = opts.outputs || [];

  const results = outputs.map(function (item) {
    const category = item.category;
    const output = item.output;
    const schema = getSchema(category);

    if (!schema) {
      return {
        category: category,
        output: output,
        valid: true,
        errors: [],
        warnings: ['no schema for category'],
      };
    }

    const result = validateOutput(output, schema);
    return {
      category: category,
      output: output,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    };
  });

  const validCount = results.filter(function (r) { return r.valid; }).length;
  const invalidCount = results.length - validCount;

  return {
    results: results,
    summary: {
      total: results.length,
      valid: validCount,
      invalid: invalidCount,
      rate: results.length ? +(validCount / results.length).toFixed(4) : null,
    },
  };
}

/**
 * 顶层入口：运行输出格式校验（与 checkOutputValidity 相同逻辑，提供默认值）。
 * @param {object} [options]
 * @param {Array<{category: string, output: object}>} [options.outputs]
 * @returns {{results: Array, summary: object}}
 */
function runOutputValidityEval(options) {
  return checkOutputValidity(options || {});
}

module.exports = {
  OUTPUT_SCHEMAS,
  getSchema,
  validateUrl,
  validateOutput,
  checkOutputValidity,
  runOutputValidityEval,
};
